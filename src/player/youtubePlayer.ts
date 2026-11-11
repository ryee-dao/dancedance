/**
 * YouTube playback through one hidden IFrame player.
 *
 * Visibility constraint: the iframe lives in #yt-host at 320x180, fixed on
 * screen, behind the app at opacity 0.01 with pointer-events: none. Never use
 * display:none, a tiny size, or an off-screen position: browsers and YouTube
 * may throttle or refuse to play media they consider hidden.
 *
 * Start sequence (load()):
 *   1. a brand-new IFrame player for every load() (no state carried over
 *      from an earlier song), mute, loadVideoById (muted autoplay is allowed)
 *   2. "starting" phase: poll until the REAL song is playing:
 *        state === PLAYING
 *        && getVideoData().video_id === our ID
 *        && getCurrentTime() has kept increasing for >= 1 s of wall time
 *        && (if an ad was seen) that run began near 0, because the song
 *           restarts from 0 once the ads are over.
 *      What real prerolls look like (observed in Chrome, 2026-11): state stays
 *      UNSTARTED (-1) while getCurrentTime() climbs 0 -> ~15 s, resets to 0
 *      and climbs again for a second ad; getVideoData().video_id and
 *      getDuration() already report the SONG. Then BUFFERING, then PLAYING
 *      from ~0. So "time moving while not PLAYING", "time jumping back
 *      without a seek" and "time past the song's duration" all mean an ad
 *      (or other pre-content) is running. The ad plays while we're muted.
 *   3. "settling": pause, seekTo(0), unmute; wait for PAUSED near 0.
 *   4. resolve. The UI runs its 3-2-1 countdown, then calls play().
 *
 * Statuses: 'ad' while an ad is detected (see above, or PLAYING with the song
 * time standing still); 'ad-long' after 90 s of ads (the UI offers skip);
 * 'needs-gesture' when nothing starts at all (autoplay blocked) or play()
 * doesn't take; 'slow' after 30 s without a confirmed start and no ad
 * activity, or after 8 s if the player hasn't reported a single state
 * change. While ads keep the time moving we never report 'slow'.
 * A start stuck in BUFFERING at 0 with no duration for 10 s is retried once
 * with a brand-new player before 'slow' is reported.
 * While the page is hidden (background tab) browsers and YouTube may defer
 * media loading entirely, so hidden time doesn't count toward any timer.
 *
 * After play() the player is supervised too: 'ad' when it reports PLAYING but
 * the song time stands still (a mid-roll or late preroll ad), 'slow' when it
 * buffers for a long time, and 'playing' once the song is moving again. While
 * the song time stands still the clock freezes instead of running ahead.
 *
 * Every state transition is logged to the console with a `[dd:player]`
 * prefix so a stuck start can be diagnosed from a pasted log.
 *
 * Mid-song recovery: if YouTube reports error 2 or 5 after the song has
 * started, the IFrame player is recreated once and the song resumes (muted
 * until it is confirmed playing again) from the last known time; time()
 * holds that position meanwhile and onRecovering(true/false) brackets it.
 * A second failure, or no resume within RECOVER_MS, reaches onError.
 */

import { SmoothClock } from './clock';
import { PlayerError, type MediaPlayer, type PlayItem, type StartStatus } from './types';
import { createYTPlayer, YTState, type YTPlayer } from './ytApi';

const POLL_MS = 200;
/** Content time must advance continuously for this long to count as started. */
const CONFIRM_MS = 1000;
/** "PLAYING but not advancing" for this long is reported as a likely ad. */
const AD_HINT_MS = 2500;
/** Stuck unstarted/cued this long: probably autoplay blocked. */
const GESTURE_HINT_MS = 6000;
/** Give the user retry/skip options after this long. */
const SLOW_MS = 30000;
/** ...or this soon when the player hasn't reported any state change at all. */
const NOTHING_MS = 8000;
/** Ready phase: PLAYING with the song time standing still this long = stalled. */
const STALL_MS = 1500;
/** Ready phase: stalled this long while PLAYING is reported as an ad. */
const STALL_AD_MS = 3000;
/** Ready phase: buffering this long is reported as slow. */
const BUFFER_SLOW_MS = 10000;
/** After play(), not PLAYING (or buffering) within this long: blocked. */
const PLAY_CHECK_MS = 3000;
/** Max wait for pause + seek(0) to settle before resolving anyway. */
const SETTLE_MS = 4000;
/** Ads for this long: tell the user we're still in ads and offer skip. */
const AD_LONG_MS = 90000;
/** Ad activity (time moving outside the song) within this window = ad still running. */
const AD_ACTIVE_MS = 3000;
/** Time moving while not PLAYING, summed, beyond this = an ad / pre-content. */
const OFF_PLAY_ADVANCE_S = 0.5;
/** After an ad, the song's confirming run must begin below this content time... */
const FRESH_START_S = 3;
/** ...or keep advancing in PLAYING this long instead. */
const CONFIRM_LONG_MS = 4000;
/** BUFFERING at 0 with no duration this long: retry once with a new player. */
const STUCK_RETRY_MS = 10000;
/** Mid-song recovery: the new player must be playing again within this long. */
const RECOVER_MS = 20000;
/** ...and its time advancing (from about where we were) for this long. */
const RECOVER_CONFIRM_MS = 600;

type Phase = 'idle' | 'starting' | 'settling' | 'ready' | 'recovering';

const STATE_NAMES: Record<number, string> = {
  [-1]: 'UNSTARTED',
  0: 'ENDED',
  1: 'PLAYING',
  2: 'PAUSED',
  3: 'BUFFERING',
  5: 'CUED',
};
const stateName = (s: number) => STATE_NAMES[s] ?? String(s);

/** Console diagnostics the user can paste into a bug report. */
function log(...args: unknown[]): void {
  if (import.meta.env.MODE === 'test') return;
  console.info('[dd:player]', ...args);
}

export class YouTubePlayer implements MediaPlayer {
  readonly kind = 'youtube' as const;
  onEnded: (() => void) | null = null;
  onError: ((err: PlayerError) => void) | null = null;
  onStatus: ((status: StartStatus) => void) | null = null;
  /** Mid-song recovery started (true) / succeeded (false). A failed recovery ends with onError instead. */
  onRecovering: ((active: boolean) => void) | null = null;

  private yt: YTPlayer | null = null;
  private slot: HTMLElement | null = null;
  private readyP: Promise<YTPlayer> | null = null;
  private destroyed = false;
  private loadToken = 0;
  private pending: { resolve: () => void; reject: (e: PlayerError) => void } | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private phase: Phase = 'idle';
  private videoId = '';
  private clock = new SmoothClock();
  private lastClockSample = 0;
  private dur = 0;

  // start detection
  private phaseStart = 0;
  private lastT = -1;
  private advancingSince = 0; // wall ms when the current run of increases began (0 = none)
  private playingStuckSince = 0;
  private status: StartStatus | null = null;
  private slowSent = false;
  /** Content time at the start of the current advancing run. */
  private runStartT = 0;
  /** Wall ms of the last state change or time movement (true-stall detection). */
  private lastActivityAt = 0;
  private lastStartState = NaN;
  /** Seconds of time movement seen while the state was not PLAYING. */
  private offPlayAdvance = 0;
  /** Wall ms when ad / pre-content activity was first / last seen (0 = never). */
  private adSeenAt = 0;
  private adActiveAt = 0;
  private adCount = 0;
  private adLongSent = false;
  private retried = false;
  private slowAfterMs = SLOW_MS;
  private lastPollAt = 0;
  private hiddenLogged = false;
  /** Bumped whenever the IFrame player is replaced; stale callbacks are ignored. */
  private gen = 0;
  /** Any onStateChange since loadVideoById (diagnostics / early escape). */
  sawStateEvent = false;
  private lastPolledState = NaN;
  private loadAt = 0;

  // play() supervision
  private lastRaw = NaN;
  private lastRawChangeAt = 0;
  private readyStatus: StartStatus | null = null;
  private lastUnmuteAt = 0;
  private wantPlaying = false;
  private playRequestedAt = 0;
  private gestureSent = false;

  // mid-song recovery
  private recoverUsed = false;
  private recoverAt = 0;
  private recoverErr: PlayerError | null = null;

  load(item: PlayItem): Promise<void> {
    if (item.kind !== 'youtube') return Promise.reject(new PlayerError(2, 'Not a YouTube item'));
    this.cancelPending();
    const token = ++this.loadToken;
    this.loadAt = performance.now();
    log(`load ${item.videoId}`, { haveApi: typeof window !== 'undefined' && !!window.YT?.Player, hadPlayer: !!this.yt });
    // Every song gets a brand-new IFrame player: nothing (ad state, playlist
    // context, a wedged buffer) carries over from the previous one.
    this.teardownPlayer();
    this.phase = 'idle';
    this.wantPlaying = false;
    this.recoverUsed = false;
    return this.ensurePlayer().then((p) => {
      if (token !== this.loadToken || this.destroyed) throw new PlayerError('cancelled');
      log(`player ready after ${Math.round(performance.now() - this.loadAt)} ms; loadVideoById`);
      return new Promise<void>((resolve, reject) => {
        this.pending = { resolve, reject };
        this.videoId = item.videoId;
        this.dur = 0;
        this.clock.update(0, false);
        this.status = null;
        this.slowSent = false;
        this.adLongSent = false;
        this.retried = false;
        this.slowAfterMs = SLOW_MS;
        this.emitStatus('loading');
        this.beginStart(p);
        this.startPolling();
      });
    });
  }

  /** mute + loadVideoById on `p` and (re)start the "starting" phase. */
  private beginStart(p: YTPlayer): void {
    this.sawStateEvent = false;
    this.lastPolledState = NaN;
    this.enterPhase('starting');
    this.adSeenAt = 0;
    this.adActiveAt = 0;
    this.adCount = 0;
    this.offPlayAdvance = 0;
    this.lastStartState = NaN;
    this.lastActivityAt = performance.now();
    p.mute();
    p.loadVideoById({ videoId: this.videoId, startSeconds: 0 });
  }

  /** Destroy the IFrame player (if any) so the next ensurePlayer() makes a new one. */
  private teardownPlayer(): void {
    this.gen++;
    const yt = this.yt;
    const slot = this.slot;
    this.yt = null;
    this.slot = null;
    this.readyP = null;
    if (yt) {
      try {
        yt.stopVideo();
      } catch {
        /* ignore */
      }
      try {
        yt.destroy();
      } catch {
        /* ignore */
      }
    }
    slot?.remove();
  }

  /** Stuck start: replace the IFrame player with a brand-new one and load again. */
  private retryWithFreshPlayer(): void {
    const token = this.loadToken;
    this.retried = true;
    this.teardownPlayer();
    this.phase = 'starting';
    this.ensurePlayer().then(
      (p) => {
        if (token !== this.loadToken || this.destroyed || !this.pending) return;
        log('retry: fresh player ready; loadVideoById again');
        // The retry already used part of the patience budget.
        this.slowAfterMs = Math.max(SLOW_MS - STUCK_RETRY_MS, 10000);
        this.beginStart(p);
      },
      (err: unknown) => {
        if (token !== this.loadToken || !this.pending) return;
        const { reject } = this.pending;
        this.pending = null;
        this.phase = 'idle';
        reject(err instanceof PlayerError ? err : new PlayerError('api'));
      },
    );
  }

  /** Live detail for the "Starting soon" screen while an ad runs. */
  loadingDetail(): string | null {
    if (this.phase !== 'starting' || !this.adSeenAt) return null;
    const now = performance.now();
    if (now - this.adActiveAt > AD_ACTIVE_MS) return null;
    const secs = Math.floor((now - this.adSeenAt) / 1000);
    return this.adCount > 1 ? `Ad ${this.adCount}: ads for ${secs} s so far` : `Ad playing: ${secs} s so far`;
  }

  play(): void {
    const p = this.yt;
    log('play()', this.snapshot(p));
    if (this.phase === 'recovering') {
      this.wantPlaying = true; // honoured once the new player is going
      this.playRequestedAt = performance.now();
      return;
    }
    if (!p) return;
    if (this.phase === 'starting') {
      // User kick while autoplay is blocked; stay muted until confirmed.
      p.mute();
      p.playVideo();
      this.status = null; // allow the hint to show again if it still fails
      this.phaseStart = performance.now();
      return;
    }
    if (this.phase !== 'ready') return;
    this.wantPlaying = true;
    this.playRequestedAt = performance.now();
    this.lastRawChangeAt = this.playRequestedAt;
    this.gestureSent = false;
    p.playVideo();
  }

  pause(): void {
    const p = this.yt;
    log('pause()', this.snapshot(p));
    if (this.phase === 'recovering') {
      this.wantPlaying = false;
      return;
    }
    if (!p || this.phase !== 'ready') return;
    this.wantPlaying = false;
    p.pauseVideo();
    this.clock.update(safeTime(p), false);
  }

  isPlaying(): boolean {
    return this.phase === 'ready' && this.yt?.getPlayerState() === YTState.PLAYING && !this.stalled(performance.now());
  }

  /** PLAYING is reported but the song time hasn't moved for a while (ad / stall). */
  private stalled(now: number): boolean {
    return this.wantPlaying && now - this.lastRawChangeAt > STALL_MS;
  }

  private noteRaw(t: number, now: number): void {
    if (t !== this.lastRaw) {
      this.lastRaw = t;
      this.lastRawChangeAt = now;
    }
  }

  time(): number {
    if (this.phase === 'recovering') return this.recoverAt; // hold the place
    const p = this.yt;
    if (!p || this.phase !== 'ready') return 0;
    const now = performance.now();
    // The API value is a cache posted from the iframe; sampling it more than
    // ~30x/s adds nothing.
    if (now - this.lastClockSample >= 30) {
      this.lastClockSample = now;
      const raw = safeTime(p);
      this.noteRaw(raw, now);
      this.clock.update(raw, p.getPlayerState() === YTState.PLAYING && !this.stalled(now));
    }
    const t = this.clock.time();
    return this.dur > 0 ? Math.min(Math.max(0, t), this.dur) : Math.max(0, t);
  }

  duration(): number {
    return this.dur;
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelPending();
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.teardownPlayer();
    this.onEnded = this.onError = this.onStatus = null;
  }

  // -------------------------------------------------------------------------

  /** Compact state for the [dd:player] log. */
  private snapshot(p: YTPlayer | null): Record<string, unknown> {
    if (!p) return { phase: this.phase, player: 'none' };
    let vid: string | undefined;
    let muted: boolean | undefined;
    try {
      vid = p.getVideoData?.()?.video_id;
      muted = p.isMuted();
    } catch {
      /* the iframe may be gone */
    }
    return {
      phase: this.phase,
      state: stateName(p.getPlayerState()),
      t: Math.round(safeTime(p) * 1000) / 1000,
      vid,
      want: this.videoId,
      muted,
      sinceLoad: Math.round(performance.now() - this.loadAt),
    };
  }

  private ensurePlayer(): Promise<YTPlayer> {
    if (!this.readyP) {
      const gen = this.gen;
      this.readyP = createYTPlayer({
        onStateChange: (e) => {
          if (gen === this.gen) this.handleState(e.data);
        },
        onError: (e) => {
          if (gen === this.gen) this.handleError(e.data);
        },
      })
        .then(({ player, el }) => {
          if (this.destroyed || gen !== this.gen) {
            try {
              player.destroy();
            } catch {
              /* ignore */
            }
            el.remove();
            throw new PlayerError('cancelled');
          }
          this.yt = player;
          this.slot = el;
          return player;
        })
        .catch((err: unknown) => {
          if (gen === this.gen) this.readyP = null;
          if (err instanceof PlayerError) throw err;
          throw new PlayerError('api', "Couldn't reach YouTube. Check the internet connection.");
        });
    }
    return this.readyP;
  }

  private cancelPending(): void {
    if (this.pending) {
      const { reject } = this.pending;
      this.pending = null;
      reject(new PlayerError('cancelled'));
    }
    if (this.phase !== 'ready') this.phase = 'idle';
  }

  private enterPhase(phase: Phase): void {
    log(`phase ${this.phase} -> ${phase}`);
    this.phase = phase;
    this.phaseStart = performance.now();
    this.lastT = -1;
    this.advancingSince = 0;
    this.playingStuckSince = 0;
  }

  private emitStatus(s: StartStatus): void {
    if (this.status === s) return;
    log(`status ${s}`, this.snapshot(this.yt));
    this.status = s;
    this.onStatus?.(s);
  }

  private startPolling(): void {
    if (this.pollTimer === null) this.pollTimer = setInterval(() => this.poll(), POLL_MS);
  }

  private poll(): void {
    const p = this.yt;
    if (!p || this.destroyed) return;
    const now = performance.now();
    const state = p.getPlayerState();
    const t = safeTime(p);
    if (state !== this.lastPolledState) {
      log(`poll ${stateName(this.lastPolledState)} -> ${stateName(state)}`, this.snapshot(p));
      this.lastPolledState = state;
    }

    const dt = this.lastPollAt ? Math.min(now - this.lastPollAt, 2000) : 0;
    this.lastPollAt = now;

    if (this.phase === 'starting') {
      // A hidden page (background tab) may not load media at all until it is
      // shown again; don't let that time count toward any hint or timeout.
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (hidden) {
        if (!this.hiddenLogged) log('page is hidden; YouTube may wait until it is visible', this.snapshot(p));
        this.hiddenLogged = true;
        this.phaseStart += dt;
        this.loadAt += dt;
        this.lastActivityAt += dt;
        if (this.advancingSince) this.advancingSince += dt;
        if (this.playingStuckSince) this.playingStuckSince += dt;
        if (this.adSeenAt) this.adSeenAt += dt;
      } else if (this.hiddenLogged) {
        this.hiddenLogged = false;
        log('page is visible again', this.snapshot(p));
        if (state !== YTState.PLAYING && state !== YTState.BUFFERING) p.playVideo();
      }

      const vid = p.getVideoData?.()?.video_id;
      // If the method doesn't exist we can't check; otherwise require a match.
      const idOk = p.getVideoData ? vid === this.videoId : true;
      const known = this.lastT >= 0;
      const forward = known && t > this.lastT;
      const delta = known ? t - this.lastT : 0;
      const songDur = p.getDuration() || 0;
      if (delta !== 0 || state !== this.lastStartState) this.lastActivityAt = now;
      this.lastStartState = state;

      // Ad / pre-content evidence (we never seek during this phase):
      //  - time moving while the player doesn't say PLAYING
      //  - time jumping back to ~0 (the next ad, or the song after the ads)
      //  - a time past the song's own length
      let adNow = false;
      if (forward && state !== YTState.PLAYING) {
        this.offPlayAdvance += delta;
        if (this.offPlayAdvance > OFF_PLAY_ADVANCE_S) adNow = true;
      }
      const jumpedBack = known && this.lastT >= 1 && t < this.lastT - 0.5;
      if (jumpedBack) adNow = true;
      if (songDur > 0 && t > songDur + 1) adNow = true;
      if (adNow) {
        if (!this.adSeenAt) {
          this.adSeenAt = now;
          this.adCount = 1;
          log('ad / pre-content detected (time moving outside the song)', this.snapshot(p));
        } else if (jumpedBack && now - this.adActiveAt < AD_ACTIVE_MS && state === YTState.UNSTARTED) {
          this.adCount++;
          log(`time reset without a seek: ad ${this.adCount}`, this.snapshot(p));
        }
        this.adActiveAt = now;
        this.offPlayAdvance = 0;
      }
      const adActive = this.adSeenAt > 0 && now - this.adActiveAt < AD_ACTIVE_MS;

      const advancing = state === YTState.PLAYING && idOk && forward;
      if (advancing) {
        if (this.advancingSince === 0) {
          this.advancingSince = now;
          this.runStartT = this.lastT;
        }
      } else {
        this.advancingSince = 0;
      }
      this.lastT = t;

      // After an ad the song restarts near 0; a run that began far into the
      // timeline is more likely still an ad, so it must hold for longer.
      const freshStart = !this.adSeenAt || this.runStartT < FRESH_START_S;
      const needMs = freshStart ? CONFIRM_MS : CONFIRM_LONG_MS;
      if (this.advancingSince && now - this.advancingSince >= needMs && t >= 0.6 && !adNow) {
        log('song confirmed playing; pausing and rewinding', { ...this.snapshot(p), adsSeen: this.adCount });
        // Real song confirmed. Rewind silently, then unmute.
        p.pauseVideo();
        p.seekTo(0, true);
        this.enterPhase('settling');
        return;
      }

      // Hints for the "Starting soon" screen.
      const elapsed = now - this.phaseStart;
      if (this.status === 'needs-gesture' && (state === YTState.PLAYING || state === YTState.BUFFERING || adActive)) {
        this.emitStatus('loading'); // the kick worked; hide the Start prompt
      }
      if (adActive && this.status !== 'ad-long') this.emitStatus('ad');
      if (state === YTState.PLAYING && !advancing) {
        if (this.playingStuckSince === 0) this.playingStuckSince = now;
        if (now - this.playingStuckSince > AD_HINT_MS && this.status !== 'ad-long') this.emitStatus('ad');
      } else {
        this.playingStuckSince = 0;
      }
      if (this.adSeenAt && !this.adLongSent && now - this.adSeenAt > AD_LONG_MS) {
        log('still in ads after 90 s; offering skip', this.snapshot(p));
        this.adLongSent = true;
        this.emitStatus('ad-long');
      }
      if (
        (state === YTState.UNSTARTED || state === YTState.CUED) &&
        t === 0 &&
        !adActive &&
        elapsed > GESTURE_HINT_MS
      ) {
        this.emitStatus('needs-gesture');
      }
      // Stuck before the video even loaded (no duration, no time): one retry
      // with a brand-new player before bothering the user.
      if (
        !this.retried &&
        !hidden &&
        state === YTState.BUFFERING &&
        t === 0 &&
        songDur === 0 &&
        now - this.lastActivityAt > STUCK_RETRY_MS
      ) {
        log('stuck buffering with no duration; retrying once with a fresh player', this.snapshot(p));
        this.retryWithFreshPlayer();
        return;
      }
      const nothingYet = !this.sawStateEvent && now - this.loadAt > NOTHING_MS && this.status !== 'needs-gesture';
      // While ads keep the time moving the player is clearly alive: no
      // "not responding". A true stall (no state change, no time movement)
      // or no start at all within the budget gets the escape options.
      const stalled = this.adSeenAt
        ? !adActive && now - this.lastActivityAt > this.slowAfterMs
        : now - this.phaseStart > this.slowAfterMs;
      if (!this.slowSent && (stalled || nothingYet)) {
        log(nothingYet ? 'no player state change at all; offering retry/skip' : 'still not started; offering retry/skip', this.snapshot(p));
        this.slowSent = true;
        this.status = 'slow';
        this.onStatus?.('slow');
      }
      return;
    }

    if (this.phase === 'settling') {
      const settled = (state === YTState.PAUSED || state === YTState.CUED) && t < 0.5;
      const timedOut = now - this.phaseStart > SETTLE_MS;
      if (settled || timedOut) {
        if (timedOut && state === YTState.PLAYING) {
          p.pauseVideo();
          p.seekTo(0, true);
        }
        p.unMute();
        this.dur = p.getDuration() || 0;
        this.readyStatus = null;
        this.lastRaw = NaN;
        log(`settled (${settled ? 'paused at 0' : 'timed out'}); unmuted; ready`, this.snapshot(p));
        this.phase = 'ready';
        this.clock.seek(0);
        this.clock.update(0, false);
        const pending = this.pending;
        this.pending = null;
        pending?.resolve();
      }
      return;
    }

    if (this.phase === 'recovering') {
      this.pollRecovery(p, state, t, now);
      return;
    }

    if (this.phase === 'ready') {
      if (!this.dur) this.dur = p.getDuration() || 0;
      this.noteRaw(t, now);
      if (!this.wantPlaying) return;
      if (state !== YTState.PLAYING && state !== YTState.BUFFERING) {
        if (!this.gestureSent && now - this.playRequestedAt > PLAY_CHECK_MS) {
          this.gestureSent = true;
          log('play() did not take; asking for a press', this.snapshot(p));
          this.onStatus?.('needs-gesture');
        }
        return;
      }
      const still = now - this.lastRawChangeAt;
      if (state === YTState.PLAYING && still > STALL_AD_MS) this.emitReady('ad', p);
      else if (state === YTState.BUFFERING && still > BUFFER_SLOW_MS) this.emitReady('slow', p);
      else if (still < STALL_MS && this.readyStatus !== null && this.readyStatus !== 'playing') this.emitReady('playing', p);
      // We unmute after the start sequence; make sure nothing re-muted us.
      if (state === YTState.PLAYING && now - this.lastUnmuteAt > 2000) {
        try {
          if (p.isMuted()) {
            this.lastUnmuteAt = now;
            log('player is muted during playback; unmuting', this.snapshot(p));
            p.unMute();
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  private emitReady(s: StartStatus, p: YTPlayer): void {
    if (this.readyStatus === s) return;
    log(`playback status ${s}`, this.snapshot(p));
    this.readyStatus = s;
    this.onStatus?.(s);
  }

  private handleState(state: number): void {
    const p0 = this.yt;
    log(`event ${stateName(state)}`, this.snapshot(p0));
    this.sawStateEvent = true;
    if (this.phase !== 'ready') return;
    const p = this.yt;
    if (p) this.clock.update(safeTime(p), state === YTState.PLAYING);
    if (state === YTState.PLAYING) this.gestureSent = false;
    if (state === YTState.ENDED && this.wantPlaying) {
      this.wantPlaying = false;
      this.onEnded?.();
    }
  }

  private handleError(code: number): void {
    log(`error ${code}`, this.snapshot(this.yt));
    const err = new PlayerError(code, describeYTError(code));
    if (this.pending) {
      const { reject } = this.pending;
      this.pending = null;
      this.phase = 'idle';
      reject(err);
      return;
    }
    if (this.phase === 'recovering') {
      this.failRecovery(`error ${code} again`);
      return;
    }
    if (this.phase === 'ready') {
      if ((code === 2 || code === 5) && !this.recoverUsed) {
        this.recover(err);
        return;
      }
      this.wantPlaying = false;
      this.onError?.(err);
    }
  }

  /** Error 2/5 mid-song: recreate the player once and resume from where we were. */
  private recover(err: PlayerError): void {
    const at = this.time();
    this.recoverUsed = true;
    this.recoverErr = err;
    this.recoverAt = at;
    log(`recovering from error ${err.code}: new player, resume at ${at.toFixed(2)} s`);
    const token = this.loadToken;
    this.teardownPlayer();
    this.enterPhase('recovering');
    this.clock.seek(at);
    this.clock.update(at, false);
    this.onRecovering?.(true);
    this.ensurePlayer().then(
      (p) => {
        if (token !== this.loadToken || this.destroyed || this.phase !== 'recovering') return;
        this.phaseStart = performance.now();
        p.mute();
        p.loadVideoById({ videoId: this.videoId, startSeconds: at });
        this.startPolling();
      },
      () => {
        if (token === this.loadToken && this.phase === 'recovering') this.failRecovery('no new player');
      },
    );
  }

  private pollRecovery(p: YTPlayer, state: number, t: number, now: number): void {
    const vid = p.getVideoData?.()?.video_id;
    const idOk = p.getVideoData ? vid === this.videoId : true;
    // Back near where we were (not an ad running from 0) and moving forward.
    const near = t >= this.recoverAt - 1.5 && t <= this.recoverAt + 15;
    const advancing = state === YTState.PLAYING && idOk && near && this.lastT >= 0 && t > this.lastT;
    if (advancing) {
      if (this.advancingSince === 0) this.advancingSince = now;
    } else if (state !== YTState.PLAYING || !near) {
      this.advancingSince = 0;
    }
    this.lastT = t;
    if (this.advancingSince && now - this.advancingSince >= RECOVER_CONFIRM_MS) {
      log('recovered; unmuting', this.snapshot(p));
      if (!this.wantPlaying) p.pauseVideo();
      p.unMute();
      this.lastUnmuteAt = now;
      this.dur = p.getDuration() || this.dur;
      this.readyStatus = null;
      this.lastRaw = NaN;
      this.lastRawChangeAt = now;
      this.playRequestedAt = now;
      this.gestureSent = false;
      this.phase = 'ready';
      this.clock.seek(t);
      this.clock.update(t, this.wantPlaying);
      this.recoverErr = null;
      this.onRecovering?.(false);
      return;
    }
    if (now - this.phaseStart > RECOVER_MS) this.failRecovery('timed out');
  }

  private failRecovery(why: string): void {
    log(`recovery failed (${why})`, this.snapshot(this.yt));
    const err = this.recoverErr ?? new PlayerError(5, describeYTError(5));
    this.recoverErr = null;
    this.phase = 'idle';
    this.wantPlaying = false;
    this.onError?.(err);
  }
}

function safeTime(p: YTPlayer): number {
  try {
    const t = p.getCurrentTime();
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

export function describeYTError(code: number): string {
  switch (code) {
    case 2:
      return 'YouTube rejected the video request.';
    case 5:
      return "YouTube's player hit an error.";
    case 100:
      return 'This video is unavailable.';
    case 101:
    case 150:
      return "This video can't be played outside YouTube.";
    default:
      return `YouTube player error ${code}.`;
  }
}
