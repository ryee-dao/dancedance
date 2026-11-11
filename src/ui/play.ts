/**
 * Play screen: full-screen stage plus overlays (Starting soon, 3-2-1,
 * paused, press-OK-to-start). Plays one item or a shuffle queue.
 *
 * Later phases draw the coach by registering a StageRenderer with
 * setStageRenderer(). It is mounted into #coach-stage and its frame() hook
 * runs every animation frame with the smoothed song time in seconds.
 *
 * Keys: Enter/Space (and media Play/Pause) toggle pause; Escape/Backspace go
 * home; Left/Right are deliberately unbound (reserved for audio offset).
 */

import { AudioFilePlayer } from '../player/audioPlayer';
import { PlayerError, type MediaPlayer, type PlayItem, type StartStatus } from '../player/types';
import { YouTubePlayer } from '../player/youtubePlayer';
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
}

export interface StageRenderer {
  /** Called once when the play screen opens. `stage` is #coach-stage. */
  mount(stage: HTMLElement): void;
  /**
   * Called every animation frame, including while loading/paused (then the
   * time doesn't advance). `timeSec` is the smoothed song time in seconds.
   * `info.item` changes when Shuffle moves to the next song.
   */
  frame(timeSec: number, info: FrameInfo): void;
  /** Called when the play screen closes. */
  unmount(): void;
}

let rendererFactory: () => StageRenderer = () => new PlaceholderStage();

/** Replace the stage renderer (pass null to restore the placeholder). */
export function setStageRenderer(factory: (() => StageRenderer) | null): void {
  rendererFactory = factory ?? (() => new PlaceholderStage());
}

/** Shown until the coach exists: a slowly turning light ring driven by frame(). */
class PlaceholderStage implements StageRenderer {
  private root: HTMLElement | null = null;
  private ring: HTMLElement | null = null;
  mount(stage: HTMLElement): void {
    this.ring = h('div', { class: 'ph-ring' });
    this.root = h(
      'div',
      { class: 'ph-stage' },
      h('div', { class: 'ph-floor' }),
      this.ring,
      h('p', { class: 'ph-note' }, 'Your coach will dance here'),
    );
    stage.appendChild(this.root);
  }
  frame(timeSec: number): void {
    if (this.ring) this.ring.style.transform = `translate(-50%, -50%) rotate(${(timeSec * 24) % 360}deg)`;
  }
  unmount(): void {
    this.root?.remove();
    this.root = this.ring = null;
  }
}

// ---------------------------------------------------------------------------

/** Show "Next: ..." this many seconds before the end in Shuffle. */
const NEXT_HINT_SEC = 15;

export function createPlay(nav: Nav, queue: PlayItem[], opts: { shuffle?: boolean } = {}): Screen {
  const shuffle = !!opts.shuffle;
  let index = 0;
  let item = queue[0];
  let player: MediaPlayer | null = null;
  let phase: PlayPhase = 'loading';
  let token = 0; // bumps on every song start / exit; stale callbacks compare against it
  let timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;
  let markedPlayed = false;
  let lastShownSec = -1;
  let lastDur = -1;

  // --- DOM ---------------------------------------------------------------
  const stage = h('div', { id: 'coach-stage', class: 'coach-stage', 'data-mount': 'coach' });
  const nowTitle = h('div', { class: 'now-title' });
  const nowArtist = h('div', { class: 'now-artist' });
  const elapsed = h('span', { class: 'elapsed' }, '0:00');
  const total = h('span', { class: 'total' }, '0:00');
  const fill = h('div', { class: 'progress-fill' });
  const nextPill = h('div', { class: 'next-pill', hidden: true });
  const overlay = h('div', { class: 'overlay', hidden: true });
  const el = h(
    'main',
    { class: 'screen play', 'aria-label': 'Now playing' },
    stage,
    h('div', { class: 'hud hud-top' }, nowTitle, nowArtist),
    h(
      'div',
      { class: 'hud hud-bottom' },
      h('div', { class: 'progress' }, fill),
      h('div', { class: 'time' }, elapsed, h('span', { class: 'time-sep' }, ' / '), total),
    ),
    nextPill,
    overlay,
  );

  const renderer = rendererFactory();
  renderer.mount(stage);

  // --- overlays ------------------------------------------------------------
  let overlayScope: Scope | null = null;
  let overlayKind: 'none' | 'starting' | 'countdown' | 'paused' | 'gesture' = 'none';

  function setOverlay(kind: typeof overlayKind, content: HTMLElement | null, focusFirst?: string): void {
    if (overlayScope) popScope(overlayScope);
    overlayScope = null;
    overlayKind = kind;
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
      loading: 'Getting the video ready…',
      ad: 'An ad is playing with the sound off. Your song starts right after.',
      'needs-gesture': 'Your browser is waiting for a press before it plays.',
      slow: 'This is taking a long time.',
    };
    const buttons =
      status === 'needs-gesture'
        ? [btn('start', 'Press OK to start', true)]
        : status === 'slow'
          ? [btn('wait', 'Keep waiting', true), btn('retry', 'Try again'), btn('skip', hasNext() ? 'Skip song' : 'Back to songs')]
          : [];
    setOverlay(
      'starting',
      h(
        'div',
        { class: 'overlay-card' },
        h('div', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
        h('p', { class: 'overlay-title' }, 'Starting soon…'),
        h('p', { class: 'overlay-song' }, displayTitle(item)),
        h('p', { class: 'overlay-status' }, text[status]),
        buttons.length > 0 && h('div', { class: 'overlay-buttons' }, ...buttons),
      ),
    );
  }

  function pausedOverlay(): void {
    setOverlay(
      'paused',
      h(
        'div',
        { class: 'overlay-card' },
        h('p', { class: 'overlay-title' }, 'Paused'),
        h(
          'div',
          { class: 'overlay-buttons' },
          btn('resume', 'Resume', true),
          shuffle && hasNext() && btn('skip', 'Next song'),
          btn('home', 'Back to songs'),
        ),
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
        h('div', { class: 'overlay-buttons' }, btn('start', 'Press OK to start', true)),
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
    }
  });

  // --- song lifecycle ----------------------------------------------------

  function hasNext(): boolean {
    return shuffle && index + 1 < queue.length;
  }

  function playerFor(it: PlayItem): MediaPlayer {
    if (player && player.kind === it.kind) return player;
    player?.destroy();
    player = it.kind === 'youtube' ? new YouTubePlayer() : new AudioFilePlayer();
    return player;
  }

  function clearTimers(): void {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }

  function startItem(i: number): void {
    clearTimers();
    index = i;
    item = queue[i];
    const my = ++token;
    phase = 'loading';
    markedPlayed = false;
    lastShownSec = -1;
    lastDur = -1;
    nextPill.hidden = true;
    nowTitle.textContent = displayTitle(item);
    nowArtist.textContent = displayArtist(item);
    elapsed.textContent = '0:00';
    total.textContent = '0:00';
    fill.style.transform = 'scaleX(0)';
    startingOverlay('loading');

    const p = playerFor(item);
    p.onStatus = (s) => {
      if (my !== token) return;
      if (phase === 'loading') startingOverlay(s);
      else if (s === 'needs-gesture' && phase === 'playing') gestureOverlay();
    };
    p.onEnded = () => {
      if (my !== token) return;
      if (hasNext()) startItem(index + 1);
      else exit();
    };
    p.onError = (err) => {
      if (my === token) handleError(err);
    };
    p.load(item).then(
      () => {
        if (my === token) countdown(my);
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

  // --- frame loop --------------------------------------------------------

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

    try {
      renderer.frame(t, { phase, playing, duration: dur, item });
    } catch (err) {
      console.error('Stage renderer failed', err);
    }
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
      // Arrows have nothing to navigate here. Left/Right are reserved for
      // the audio offset control in a later phase.
      return e.key.startsWith('Arrow');
    },
  };

  // Mouse: clicking the stage toggles pause like OK does.
  el.addEventListener('click', (e) => {
    if (!overlay.contains(e.target as Node)) togglePause();
  });

  startItem(0);
  raf = requestAnimationFrame(frame);

  return {
    el,
    scope,
    destroy() {
      token++;
      clearTimers();
      cancelAnimationFrame(raf);
      if (overlayScope) popScope(overlayScope);
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
