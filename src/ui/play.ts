/**
 * Play screen: full-screen stage plus overlays (Starting soon, microphone
 * explainer, 3-2-1, paused, press-OK-to-start). Plays one item or a shuffle
 * queue.
 *
 * The coach draws itself by registering a StageRenderer with
 * setStageRenderer(). It is mounted into #coach-stage and its frame() hook
 * runs every animation frame with the song time (already shifted by the
 * audio offset) and the song's BeatSource.
 *
 * Keys: Enter/Space (and media Play/Pause) toggle pause; Escape/Backspace go
 * home; Left/Right adjust the audio offset by 10 ms (hold to repeat).
 */

import { clampOffset, formatOffset, stageTime, stepOffset } from '../beat/audioOffset';
import type { BeatSource } from '../beat/beatSource';
import { BeatSession, type SyncStatus } from '../beat/session';
import { LiveDevices } from '../live/devices';
import { getPlatform } from '../platform/platform';
import { AudioFilePlayer } from '../player/audioPlayer';
import { PlayerError, type MediaPlayer, type PlayItem, type StartStatus } from '../player/types';
import { YouTubePlayer } from '../player/youtubePlayer';
import { store, type Intensity } from '../store';
import { BeatPulseStage } from './beatStage';
import { formatTime, h, type Nav, type Screen } from './dom';
import { isOkKey, popScope, pushScope, type Scope } from './focusNav';
import { library } from './library';
import { toast } from './toast';

// ---------------------------------------------------------------------------
// Stage renderer hook (public API for later phases)

export type PlayPhase = 'loading' | 'countdown' | 'playing' | 'paused';

export interface FrameInfo {
  phase: PlayPhase;
  /** True while audio is actually advancing. */
  playing: boolean;
  /** Seconds, 0 while unknown. */
  duration: number;
  item: PlayItem;
  /**
   * Where the song's beats come from (cloud/cached/analysed map and/or live
   * listening), in song time. Null only if beat sync isn't set up.
   */
  beats: BeatSource | null;
  /** Choreography intensity chosen on the home screen. */
  intensity: Intensity;
  /** The audio offset already applied to `timeSec`, ms (positive = later). */
  audioOffsetMs: number;
}

export interface StageRenderer {
  /** Called once when the play screen opens. `stage` is #coach-stage. */
  mount(stage: HTMLElement): void;
  /**
   * Called every animation frame, including while loading/paused (then the
   * time doesn't advance). `timeSec` is the smoothed song time in seconds
   * minus the audio offset, i.e. the moment of the song the viewer is
   * hearing; compare it directly with beat times from `info.beats`.
   * `info.item` changes when Shuffle moves to the next song.
   */
  frame(timeSec: number, info: FrameInfo): void;
  /** Called when the play screen closes. */
  unmount(): void;
}

let rendererFactory: () => StageRenderer = () => new BeatPulseStage();

/** Replace the stage renderer (pass null to restore the default beat-pulse stage). */
export function setStageRenderer(factory: (() => StageRenderer) | null): void {
  rendererFactory = factory ?? (() => new BeatPulseStage());
}

// ---------------------------------------------------------------------------

/** The "No beat sync" explanation stays on the stage this long after it appears (or after resuming). */
const NO_SYNC_HELP_MS = 15000;

/** Show "Next: ..." this many seconds before the end in Shuffle. */
const NEXT_HINT_SEC = 15;

export function createPlay(
  nav: Nav,
  queue: PlayItem[],
  opts: { shuffle?: boolean; intensity?: Intensity } = {},
): Screen {
  const shuffle = !!opts.shuffle;
  const platform = getPlatform();
  const devices = new LiveDevices();
  const settings = store.settings();
  const intensity = opts.intensity ?? settings.intensity;
  let offsetMs = clampOffset(settings.audioOffsetMs);
  let index = 0;
  let item = queue[0];
  let player: MediaPlayer | null = null;
  let session: BeatSession | null = null;
  let phase: PlayPhase = 'loading';
  let token = 0; // bumps on every song start / exit; stale callbacks compare against it
  let timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;
  let markedPlayed = false;
  let lastShownSec = -1;
  let lastDur = -1;
  let loadStartedAt = 0;

  // --- DOM ---------------------------------------------------------------
  const stage = h('div', { id: 'coach-stage', class: 'coach-stage', 'data-mount': 'coach' });
  const nowTitle = h('div', { class: 'now-title' });
  const nowArtist = h('div', { class: 'now-artist' });
  const elapsed = h('span', { class: 'elapsed' }, '0:00');
  const total = h('span', { class: 'total' }, '0:00');
  const fill = h('div', { class: 'progress-fill' });
  const nextPill = h('div', { class: 'next-pill', hidden: true });
  const chipText = h('span', { class: 'sync-chip-text' });
  const chip = h('div', { class: 'sync-chip', hidden: true, role: 'status' }, h('i', { class: 'sync-dot' }), chipText);
  const offsetReadout = h('div', { class: 'offset-readout', hidden: true, 'aria-live': 'polite' });
  const helpTitle = h('p', { class: 'sync-help-title' });
  const helpBody = h('p', { class: 'sync-help-body' });
  const syncHelp = h('div', { class: 'sync-help', hidden: true, role: 'status' }, helpTitle, helpBody);
  const overlay = h('div', { class: 'overlay', hidden: true });
  const el = h(
    'main',
    { class: 'screen play', 'aria-label': 'Now playing' },
    stage,
    syncHelp,
    h('div', { class: 'hud hud-top' }, nowTitle, nowArtist),
    chip,
    h(
      'div',
      { class: 'hud hud-bottom' },
      h('div', { class: 'progress' }, fill),
      h('div', { class: 'time' }, elapsed, h('span', { class: 'time-sep' }, ' / '), total),
    ),
    nextPill,
    offsetReadout,
    overlay,
  );

  const renderer = rendererFactory();
  renderer.mount(stage);

  devices.onTabEnded = () => {
    session?.sourceLost();
    toast('Tab sharing stopped, so beat sync is off for now. Pause to pick it again.');
  };

  if (import.meta.env.DEV) {
    // Test/diagnostics hook for driving the dev build.
    (window as unknown as { __ddPlay?: unknown }).__ddPlay = {
      session: () => session,
      player: () => player,
      renderer: () => renderer,
      offset: () => offsetMs,
      intensity: () => intensity,
    };
  }

  // --- overlays ------------------------------------------------------------
  let overlayScope: Scope | null = null;
  type OverlayKind = 'none' | 'starting' | 'countdown' | 'paused' | 'gesture' | 'stall' | 'sync-ask' | 'sync-wait';
  let overlayKind: OverlayKind = 'none';
  // Live parts of the starting overlay, updated by the frame loop.
  let startingSync: HTMLElement | null = null;
  let startingElapsed: HTMLElement | null = null;

  function setOverlay(kind: OverlayKind, content: HTMLElement | null, focusFirst?: string): void {
    if (overlayScope) popScope(overlayScope);
    overlayScope = null;
    overlayKind = kind;
    startingSync = startingElapsed = null;
    if (!content) {
      overlay.hidden = true;
      overlay.replaceChildren();
      return;
    }
    overlay.hidden = false;
    overlay.dataset.kind = kind;
    overlay.replaceChildren(content);
    if (content.querySelector('button')) {
      const scope: Scope = {
        root: overlay,
        onBack: exit,
        onKey: (e) => {
          if (isMediaToggle(e)) {
            togglePause();
            return true;
          }
          return false;
        },
        defaultFocus: () =>
          (focusFirst && overlay.querySelector<HTMLElement>(`[data-action="${focusFirst}"]`)) ||
          overlay.querySelector('button'),
      };
      overlayScope = scope;
      if (el.isConnected) pushScope(scope);
    }
  }

  function startingOverlay(status: StartStatus): void {
    const text: Record<StartStatus, string> = {
      loading: item.kind === 'file' ? 'Getting your file ready…' : 'Getting the video ready…',
      ad: 'An ad is playing with the sound off. Your song starts right after.',
      'ad-long': 'Still in ads (sound off). Your song starts right after them.',
      'needs-gesture': 'Your browser is waiting for a press before it plays.',
      slow: item.kind === 'youtube' ? "YouTube isn't responding yet." : 'This is taking a long time.',
      playing: 'Getting the video ready…',
    };
    const skip = btn('skip', hasNext() ? 'Skip song' : 'Back to songs');
    const buttons =
      status === 'needs-gesture'
        ? [btn('start', 'Press OK to start', true), btn('retry', 'Try again'), skip]
        : status === 'slow'
          ? [btn('wait', 'Keep waiting', true), btn('retry', 'Try again'), skip]
          : status === 'ad-long'
            ? [btn('wait-ad', 'Keep waiting', true), skip]
            : [];
    const syncLine = h('p', { class: 'overlay-sync' });
    const elapsedEl = h('span', { class: 'overlay-elapsed' });
    setOverlay(
      'starting',
      h(
        'div',
        { class: 'overlay-card' },
        h('div', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
        h('p', { class: 'overlay-title' }, 'Starting soon…'),
        h('p', { class: 'overlay-song' }, displayTitle(item)),
        h('p', { class: 'overlay-status' }, text[status], ' ', elapsedEl),
        syncLine,
        buttons.length > 0 && h('div', { class: 'overlay-buttons' }, ...buttons),
      ),
    );
    startingSync = syncLine;
    startingElapsed = elapsedEl;
    updateStartingLive();
  }

  function updateStartingLive(): void {
    if (startingElapsed) {
      const secs = Math.floor((performance.now() - loadStartedAt) / 1000);
      const txt = secs >= 3 ? `(${secs} s)` : '';
      if (startingElapsed.textContent !== txt) startingElapsed.textContent = txt;
    }
    if (startingSync) {
      const st = session?.status();
      const txt =
        st?.kind === 'analyzing'
          ? st.step === 'download'
            ? `Getting the song…${st.progress > 0 ? ` ${Math.round(st.progress * 100)}%` : ''}`
            : `Finding the beat… ${Math.round(st.progress * 100)}%`
          : (player?.loadingDetail?.() ?? '');
      if (startingSync.textContent !== txt) startingSync.textContent = txt;
    }
  }

  function micAskOverlay(my: number): void {
    const card = h(
      'div',
      { class: 'overlay-card' },
      h('p', { class: 'overlay-title' }, 'Dance on the beat'),
      ...(devices.tabSupported
        ? [
            // Tab audio is the better way in: one click, exact sync, and the result is shared.
            h('p', { class: 'overlay-status overlay-explain' }, 'Share this tab so the coach can hear the song. You only need to do this the first time anyone plays it.'),
            h(
              'p',
              { class: 'overlay-status' },
              'Pick this tab and keep “Also share tab audio” on. The sound stays on this page; after the song has played through, only its beat timings are saved for everyone.',
            ),
          ]
        : [
            h(
              'p',
              { class: 'overlay-status overlay-explain' },
              "This song has no beat map yet, so the coach can listen through your microphone to find the beat. Nothing is recorded or sent anywhere: the sound is only used on this page, while you play.",
            ),
            h('p', { class: 'overlay-status' }, 'Your browser will ask once and remember your answer.'),
            h('p', { class: 'overlay-status overlay-tip' }, 'It will sync perfectly once someone has played it in Chrome or Edge on a computer.'),
          ]),
      platform.localHelper &&
        !platform.localHelper.info() &&
        h('p', { class: 'overlay-status overlay-tip' }, 'Or get the DanceDance helper app (see Options) to find the beat without listening.'),
      devices.tabSupported
        ? h(
            'div',
            { class: 'overlay-buttons' },
            btn('tab-yes', 'Share this tab', true),
            devices.micSupported && btn('mic-yes', 'Use microphone instead'),
            btn('mic-no', 'Not now'),
          )
        : h('div', { class: 'overlay-buttons' }, btn('mic-yes', 'Use microphone', true), btn('mic-no', 'Not now')),
    );
    card.dataset.token = String(my);
    setOverlay('sync-ask', card, devices.tabSupported ? 'tab-yes' : 'mic-yes');
  }

  function answerMic(use: boolean): void {
    const my = token;
    const s = session;
    if (!s) return;
    if (use) {
      setOverlay(
        'sync-wait',
        h(
          'div',
          { class: 'overlay-card' },
          h('p', { class: 'overlay-title' }, 'One moment…'),
          h('p', { class: 'overlay-status' }, 'If your browser asks, allow the microphone.'),
        ),
      );
    }
    void s.answerMic(use).finally(() => {
      if (my !== token) return;
      const st = s.status();
      if (use && st.kind === 'none' && st.reason === 'denied') {
        toast('No beat sync for this song. You can turn it on from the pause menu.');
      }
      countdown(my);
    });
  }

  function pausedOverlay(): void {
    const st = session?.status() ?? null;
    const offers = session?.offers() ?? { mic: false, tab: false };
    const note = session?.cloudNote() ?? null;
    setOverlay(
      'paused',
      h(
        'div',
        { class: 'overlay-card' },
        h('p', { class: 'overlay-title' }, 'Paused'),
        st && h('p', { class: 'overlay-status' }, describeSync(st, true)),
        note && h('p', { class: 'overlay-status overlay-note' }, note),
        h(
          'div',
          { class: 'overlay-buttons' },
          btn('resume', 'Resume', true),
          offers.mic && btn('sync-mic', 'Sync: microphone'),
          offers.tab && btn('sync-tab', 'Sync: share this tab (better)'),
          shuffle && hasNext() && btn('skip', 'Next song'),
          btn('home', 'Back to songs'),
        ),
        h('p', { class: 'overlay-hint' }, `${formatOffset(offsetMs)} · ←/→ during play to adjust`),
      ),
      'resume',
    );
  }

  function gestureOverlay(): void {
    setOverlay(
      'gesture',
      h(
        'div',
        { class: 'overlay-card' },
        h('p', { class: 'overlay-title' }, 'Ready'),
        h('p', { class: 'overlay-status' }, 'Your browser needs a press before the music can start.'),
        h('div', { class: 'overlay-buttons' }, btn('start', 'Press OK to start', true), btn('home', 'Back to songs')),
      ),
    );
  }

  function stallOverlay(kind: 'ad' | 'slow'): void {
    setOverlay(
      'stall',
      h(
        'div',
        { class: 'overlay-card' },
        h('p', { class: 'overlay-title' }, kind === 'ad' ? 'Ad break' : 'Buffering…'),
        h(
          'p',
          { class: 'overlay-status' },
          kind === 'ad'
            ? 'YouTube is playing an ad. Your song continues right after it.'
            : 'The video is taking a while to load. It continues by itself when it can.',
        ),
        h(
          'div',
          { class: 'overlay-buttons' },
          btn('dismiss', 'Keep waiting', true),
          btn('skip', hasNext() ? 'Skip song' : 'Back to songs'),
        ),
      ),
    );
  }

  function countdownOverlay(n: number): void {
    setOverlay(
      'countdown',
      h('div', { class: 'countdown', 'aria-live': 'assertive' }, h('span', { class: 'countdown-num' }, String(n))),
    );
  }

  overlay.addEventListener('click', (e) => {
    // Handled here; don't let it bubble to the stage's click-to-pause (the
    // button may already be detached by then, so a contains() check fails).
    e.stopPropagation();
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    switch (action) {
      case 'start':
        player?.play();
        if (phase === 'loading') startingOverlay('loading');
        else setOverlay('none', null);
        break;
      case 'wait':
        startingOverlay('loading');
        break;
      case 'wait-ad':
        startingOverlay('ad');
        break;
      case 'dismiss':
        setOverlay('none', null);
        break;
      case 'retry':
        player?.destroy();
        player = null;
        startItem(index);
        break;
      case 'skip':
        advance();
        break;
      case 'resume':
        togglePause();
        break;
      case 'home':
        exit();
        break;
      case 'mic-yes':
        answerMic(true);
        break;
      case 'mic-no':
        answerMic(false);
        break;
      case 'tab-yes': {
        const my = token;
        const s = session;
        if (!s) break;
        // Called synchronously from the click so the browser sees the gesture.
        const p = s.answerTab();
        setOverlay('sync-wait', h('div', { class: 'overlay-card' }, h('p', { class: 'overlay-title' }, 'One moment…'), h('p', { class: 'overlay-status' }, 'Choose this tab in the box your browser shows.')));
        void p.then((msg) => {
          if (my !== token) return;
          if (msg) toast(msg, 6000);
          countdown(my);
        });
        break;
      }
      case 'sync-mic': {
        const my = token;
        const s = session;
        void s?.useMic().then(() => {
          if (my !== token || !s) return;
          const st = s.status();
          if (st.kind === 'none' && st.reason === 'denied') {
            toast("The microphone is blocked for this site. Allow it in the browser's site settings to use it.");
          }
          if (phase === 'paused') pausedOverlay();
        });
        break;
      }
      case 'sync-tab': {
        const my = token;
        const s = session;
        // Called synchronously from the click so the browser sees the gesture.
        void s?.useTab().then((msg) => {
          if (my !== token) return;
          if (msg) toast(msg, 6000);
          if (phase === 'paused') pausedOverlay();
        });
        break;
      }
    }
  });

  // --- song lifecycle ----------------------------------------------------

  function hasNext(): boolean {
    return shuffle && index + 1 < queue.length;
  }

  function playerFor(it: PlayItem): MediaPlayer {
    if (player && player.kind === it.kind) return player;
    player?.destroy();
    // Android TV supplies its own audio-only player for YouTube items.
    player = platform.createPlayer?.(it) ?? (it.kind === 'youtube' ? new YouTubePlayer() : new AudioFilePlayer());
    return player;
  }

  function clearTimers(): void {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }

  function startItem(i: number): void {
    clearTimers();
    session?.dispose();
    session = null;
    index = i;
    item = queue[i];
    const my = ++token;
    phase = 'loading';
    markedPlayed = false;
    lastShownSec = -1;
    lastDur = -1;
    loadStartedAt = performance.now();
    nextPill.hidden = true;
    nowTitle.textContent = displayTitle(item);
    nowArtist.textContent = displayArtist(item);
    elapsed.textContent = '0:00';
    total.textContent = '0:00';
    fill.style.transform = 'scaleX(0)';

    const p = playerFor(item);
    const s = new BeatSession(
      item,
      {
        time: () => (player ? player.time() : 0),
        playing: () => phase === 'playing' && !!player && player.isPlaying(),
        duration: () => (player ? player.duration() : 0),
      },
      devices,
      platform,
    );
    session = s;
    startingOverlay('loading');

    p.onStatus = (st) => {
      if (my !== token) return;
      if (phase === 'loading') {
        if (overlayKind === 'starting') startingOverlay(st);
      } else if (phase === 'playing') {
        if (st === 'needs-gesture') gestureOverlay();
        else if (st === 'ad' || st === 'slow') stallOverlay(st);
        else if (st === 'playing' && overlayKind === 'stall') setOverlay('none', null);
      }
    };
    p.onEnded = () => {
      if (my !== token) return;
      session?.finish();
      if (hasNext()) startItem(index + 1);
      else exit();
    };
    p.onError = (err) => {
      if (my === token) handleError(err);
    };
    const prep = s.prepare().catch(() => 'ready' as const);
    Promise.all([p.load(item), prep]).then(
      ([, next]) => {
        if (my !== token) return;
        if (next === 'ask-mic') micAskOverlay(my);
        else countdown(my);
      },
      (err: unknown) => {
        if (my !== token) return;
        if (err instanceof PlayerError && err.code === 'cancelled') return;
        handleError(err instanceof PlayerError ? err : new PlayerError('api'));
      },
    );
  }

  function countdown(my: number): void {
    phase = 'countdown';
    const d = player?.duration() ?? 0;
    if (d) total.textContent = formatTime(d);
    [3, 2, 1].forEach((n, k) => {
      timers.push(
        setTimeout(() => {
          if (my === token) countdownOverlay(n);
        }, k * 1000),
      );
    });
    timers.push(
      setTimeout(() => {
        if (my !== token) return;
        setOverlay('none', null);
        phase = 'playing';
        player?.play();
        const note = session?.cloudNote();
        const st = session?.status();
        if (note && st && st.kind !== 'map') toast(note);
      }, 3000),
    );
  }

  function handleError(err: PlayerError): void {
    const id = item.kind === 'youtube' ? item.videoId : null;
    if (err.code === 'api' || err.code === 'decode') {
      // Not specific to this song (YouTube unreachable / bad file): go home.
      toast(err.message);
      exit();
      return;
    }
    if (err.embedBlocked) {
      if (id) library.markBlocked(id, 'embed');
      toast("This video can't be played outside YouTube. Skipping.");
    } else if (err.unavailable) {
      if (id) library.markBlocked(id, 'gone');
      toast('This video is unavailable. Skipping.');
    } else {
      toast("Couldn't play this video. Skipping.");
    }
    advance();
  }

  function advance(): void {
    if (hasNext()) startItem(index + 1);
    else exit();
  }

  function togglePause(): void {
    if (!player) return;
    if (phase === 'playing') {
      player.pause();
      phase = 'paused';
      pausedOverlay();
    } else if (phase === 'paused') {
      setOverlay('none', null);
      phase = 'playing';
      player.play();
    }
  }

  let exited = false;
  function exit(): void {
    if (exited) return;
    exited = true;
    const focusId = item.kind === 'youtube' ? item.videoId : undefined;
    nav.home(focusId ? { focusId } : { focusAction: 'file' });
  }

  // --- audio offset (Left/Right) ------------------------------------------

  let readoutTimer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function adjustOffset(dir: -1 | 1): void {
    offsetMs = stepOffset(offsetMs, dir);
    offsetReadout.textContent = formatOffset(offsetMs);
    offsetReadout.hidden = false;
    if (readoutTimer !== null) clearTimeout(readoutTimer);
    readoutTimer = setTimeout(() => {
      offsetReadout.hidden = true;
    }, 1500);
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveOffset, 400);
  }
  function saveOffset(): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = null;
    if (store.settings().audioOffsetMs !== offsetMs) store.updateSettings({ audioOffsetMs: offsetMs });
  }

  // --- frame loop --------------------------------------------------------

  let shownChip = '';
  let shownHelp = '';
  let helpShownAt = 0;
  function frame(): void {
    raf = requestAnimationFrame(frame);
    const p = player;
    const t = p ? p.time() : 0;
    const dur = p ? p.duration() : 0;
    const playing = !!p && p.isPlaying();

    if (playing && overlayKind === 'gesture') setOverlay('none', null);
    if (!markedPlayed && playing && phase === 'playing' && t > 0.3) {
      markedPlayed = true;
      if (item.kind === 'youtube') library.markPlayed(item.videoId);
    }

    // HUD: text only when the second changes; progress bar every frame.
    const sec = Math.floor(t);
    if (sec !== lastShownSec) {
      lastShownSec = sec;
      elapsed.textContent = formatTime(t);
    }
    if (dur !== lastDur) {
      lastDur = dur;
      total.textContent = formatTime(dur);
    }
    fill.style.transform = `scaleX(${dur > 0 ? Math.min(1, t / dur) : 0})`;

    const showNext = hasNext() && dur > 0 && phase !== 'loading' && dur - t < NEXT_HINT_SEC;
    if (showNext && nextPill.hidden) nextPill.textContent = `Next: ${displayTitle(queue[index + 1])}`;
    nextPill.hidden = !showNext;

    session?.tick();
    if (overlayKind === 'starting') updateStartingLive();
    updateChip();

    try {
      renderer.frame(stageTime(t, offsetMs), {
        phase,
        playing,
        duration: dur,
        item,
        beats: session?.source ?? null,
        intensity,
        audioOffsetMs: offsetMs,
      });
    } catch (err) {
      console.error('Stage renderer failed', err);
    }
  }

  function updateChip(): void {
    const st = session?.status();
    const help = st && session && (phase === 'playing' || phase === 'countdown') ? syncHelpText(st, session.offers()) : null;
    const helpKey = help ? help.title + '|' + help.body : '';
    if (helpKey !== shownHelp) {
      shownHelp = helpKey;
      helpShownAt = performance.now();
      syncHelp.hidden = !help;
      helpTitle.textContent = help?.title ?? '';
      helpBody.textContent = help?.body ?? '';
    } else if (help && st?.kind === 'none' && !syncHelp.hidden && performance.now() - helpShownAt > NO_SYNC_HELP_MS) {
      // Said it; get out of the way (the chip still says "No beat sync").
      syncHelp.hidden = true;
    }
    const text = st && phase !== 'loading' ? describeSync(st, false) : '';
    if (text === shownChip) return;
    shownChip = text;
    chip.hidden = !text;
    chipText.textContent = text;
    chip.dataset.kind = !st ? 'none' : st.kind === 'map' ? 'ok' : st.kind === 'live' ? (st.locked ? 'ok' : 'listen') : st.kind === 'none' ? 'none' : 'listen';
  }

  // --- keys ----------------------------------------------------------------

  const scope: Scope = {
    root: el,
    onBack: exit,
    onKey: (e) => {
      if (isOkKey(e) || isMediaToggle(e)) {
        if (!e.repeat) togglePause();
        return true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Held keys auto-repeat, so holding keeps stepping.
        adjustOffset(e.key === 'ArrowLeft' ? -1 : 1);
        return true;
      }
      // Up/Down have nothing to do here.
      return e.key.startsWith('Arrow');
    },
  };

  // Mouse: clicking the stage toggles pause like OK does.
  el.addEventListener('click', (e) => {
    if (!overlay.contains(e.target as Node)) togglePause();
  });

  // Android TV: the app went to the background (HOME pressed): pause with the menu up.
  const onAppPause = () => {
    if (phase === 'playing') togglePause();
  };
  window.addEventListener('dd:app-pause', onAppPause);

  startItem(0);
  raf = requestAnimationFrame(frame);

  return {
    el,
    scope,
    destroy() {
      token++;
      clearTimers();
      cancelAnimationFrame(raf);
      window.removeEventListener('dd:app-pause', onAppPause);
      if (readoutTimer !== null) clearTimeout(readoutTimer);
      if (saveTimer !== null) saveOffset();
      if (overlayScope) popScope(overlayScope);
      session?.dispose();
      session = null;
      devices.release();
      player?.destroy();
      player = null;
      renderer.unmount();
    },
    mounted() {
      // An overlay opened before the screen was attached still needs its scope.
      if (overlayScope) pushScope(overlayScope);
    },
  };

  // Helpers needing closure state ------------------------------------------
  function btn(action: string, label: string, primary = false): HTMLButtonElement {
    return h('button', { class: primary ? 'btn btn-primary' : 'btn', type: 'button', 'data-action': action }, label);
  }
}

/** Status chip text (short) or the pause-menu sentence (long). */
export function describeSync(st: SyncStatus, long: boolean): string {
  switch (st.kind) {
    case 'resolving':
      return long ? 'Looking for a beat map…' : '';
    case 'analyzing':
      return `Finding the beat… ${Math.round(st.progress * 100)}%`;
    case 'map':
      if (st.partial && st.listening) return long ? 'Synced to a saved beat map; listening to fill in the rest.' : 'Synced · listening for the rest';
      if (st.refining !== null) return long ? 'Synced to the first part; analysing the rest of the song.' : 'Synced · analysing the rest';
      return long ? `Synced to a beat map (${mapSourceLabel(st.source)}).` : 'Synced';
    case 'live':
      if (st.locked) return long ? `Listening via ${st.mode === 'tab' ? 'tab audio' : 'microphone'} · locked at ${Math.round(st.bpm)} BPM.` : `Locked · ${Math.round(st.bpm)} BPM`;
      return long
        ? `Listening via ${st.mode === 'tab' ? 'tab audio' : 'microphone'}… finding the beat.`
        : 'Listening… finding the beat';
    case 'none':
      if (!long) return 'No beat sync';
      switch (st.reason) {
        case 'denied':
          return 'No beat sync for this song: the microphone is not allowed.';
        case 'no-device':
          return 'No beat sync for this song: no microphone was found.';
        case 'unsupported':
          return 'No beat sync for this song: listening is not available here.';
        case 'no-beat':
          return 'No steady beat was found in this song.';
        case 'error':
          return "No beat sync for this song: the analysis didn't work.";
        default:
          return 'No beat sync for this song.';
      }
  }
}

/**
 * Words on the stage while there is no beat to follow yet: what is going on
 * and what the user can do about it. Null once beats are flowing.
 */
export function syncHelpText(st: SyncStatus, offers: { mic: boolean; tab: boolean }): { title: string; body: string } | null {
  if (st.kind === 'live' && !st.locked) {
    return {
      title: 'Listening for the beat…',
      body:
        st.mode === 'tab'
          ? "Listening to this tab's sound. The beat usually locks within about 10 seconds."
          : 'The microphone is listening to your speakers. The beat usually locks within about 10 seconds; keep the music loud enough to hear.',
    };
  }
  if (st.kind !== 'none') return null;
  const long = describeSync(st, true).replace(/^No beat sync for this song: /, '');
  const why = long.charAt(0).toUpperCase() + long.slice(1);
  const choices = [offers.mic && '“Sync: microphone”', offers.tab && '“Sync: share this tab”'].filter(Boolean);
  const body = choices.length
    ? `${why} To follow the beat, press OK to pause and choose ${choices.join(' or ')}.`
    : `${why} The music plays as normal; the moves just won't follow the beat.`;
  return { title: 'No beat sync', body };
}

function mapSourceLabel(source: string): string {
  switch (source) {
    case 'cloud':
      return 'from the cloud';
    case 'device':
    case 'file':
      return 'analysed on this device';
    case 'tab':
      return 'saved from tab audio';
    default:
      return 'saved from listening';
  }
}

function isMediaToggle(e: KeyboardEvent): boolean {
  return e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || e.key === 'MediaPause';
}

function displayTitle(item: PlayItem): string {
  if (item.kind === 'youtube') return library.find(item.videoId)?.title ?? item.title;
  return item.title;
}

function displayArtist(item: PlayItem): string {
  if (item.kind === 'youtube') return library.find(item.videoId)?.artist ?? item.artist ?? '';
  return 'From your file';
}
