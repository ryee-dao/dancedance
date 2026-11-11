/**
 * YouTube playback through one hidden IFrame player.
 *
 * Visibility constraint: the iframe lives in #yt-host at 320x180, fixed on
 * screen, behind the app at opacity 0.01 with pointer-events: none. Never use
 * display:none, a tiny size, or an off-screen position: browsers and YouTube
 * may throttle or refuse to play media they consider hidden.
 *
 * Start sequence (load()):
 *   1. mute, loadVideoById (muted autoplay is allowed by browsers)
 *   2. "starting" phase: poll until the REAL song is playing:
 *        state === PLAYING
 *        && getVideoData().video_id === our ID
 *        && getCurrentTime() has kept increasing for >= 1 s of wall time.
 *      A preroll ad keeps the content time at ~0 (and may report another ID
 *      or a non-PLAYING state), so it never satisfies this. Because the ad
 *      plays while we're muted, nobody hears it. Requiring a sustained run of
 *      increases (not a single one) guards against the API's cached time
 *      momentarily ticking forward and then resetting while an ad runs.
 *   3. "settling": pause, seekTo(0), unmute; wait for PAUSED near 0.
 *   4. resolve. The UI runs its 3-2-1 countdown, then calls play().
 *
 * Statuses: 'ad' when the player reports PLAYING but our song isn't
 * advancing; 'needs-gesture' when nothing starts at all (autoplay blocked)
 * or play() doesn't take; 'slow' after 45 s without a confirmed start.
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
const SLOW_MS = 45000;
/** After play(), not PLAYING (or buffering) within this long: blocked. */
const PLAY_CHECK_MS = 3000;
/** Max wait for pause + seek(0) to settle before resolving anyway. */
const SETTLE_MS = 4000;

type Phase = 'idle' | 'starting' | 'settling' | 'ready';

export class YouTubePlayer implements MediaPlayer {
  readonly kind = 'youtube' as const;
  onEnded: (() => void) | null = null;
  onError: ((err: PlayerError) => void) | null = null;
  onStatus: ((status: StartStatus) => void) | null = null;

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

  // play() supervision
  private wantPlaying = false;
  private playRequestedAt = 0;
  private gestureSent = false;

  load(item: PlayItem): Promise<void> {
    if (item.kind !== 'youtube') return Promise.reject(new PlayerError(2, 'Not a YouTube item'));
    this.cancelPending();
    const token = ++this.loadToken;
    return this.ensurePlayer().then((p) => {
      if (token !== this.loadToken || this.destroyed) throw new PlayerError('cancelled');
      return new Promise<void>((resolve, reject) => {
        this.pending = { resolve, reject };
        this.videoId = item.videoId;
        this.dur = 0;
        this.wantPlaying = false;
        this.clock.update(0, false);
        this.enterPhase('starting');
        this.status = null;
        this.slowSent = false;
        this.emitStatus('loading');
        p.mute();
        p.loadVideoById({ videoId: item.videoId, startSeconds: 0 });
        this.startPolling();
      });
    });
  }

  play(): void {
    const p = this.yt;
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
    this.gestureSent = false;
    p.playVideo();
  }

  pause(): void {
    const p = this.yt;
    if (!p || this.phase !== 'ready') return;
    this.wantPlaying = false;
    p.pauseVideo();
    this.clock.update(safeTime(p), false);
  }

  isPlaying(): boolean {
    return this.phase === 'ready' && this.yt?.getPlayerState() === YTState.PLAYING;
  }

  time(): number {
    const p = this.yt;
    if (!p || this.phase !== 'ready') return 0;
    const now = performance.now();
    // The API value is a cache posted from the iframe; sampling it more than
    // ~30x/s adds nothing.
    if (now - this.lastClockSample >= 30) {
      this.lastClockSample = now;
      this.clock.update(safeTime(p), p.getPlayerState() === YTState.PLAYING);
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
    try {
      this.yt?.destroy();
    } catch {
      /* ignore */
    }
    this.slot?.remove();
    this.yt = null;
    this.slot = null;
    this.onEnded = this.onError = this.onStatus = null;
  }

  // -------------------------------------------------------------------------

  private ensurePlayer(): Promise<YTPlayer> {
    if (!this.readyP) {
      this.readyP = createYTPlayer({
        onStateChange: (e) => this.handleState(e.data),
        onError: (e) => this.handleError(e.data),
      })
        .then(({ player, el }) => {
          if (this.destroyed) {
            player.destroy();
            el.remove();
            throw new PlayerError('cancelled');
          }
          this.yt = player;
          this.slot = el;
          return player;
        })
        .catch((err: unknown) => {
          this.readyP = null;
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
    this.phase = phase;
    this.phaseStart = performance.now();
    this.lastT = -1;
    this.advancingSince = 0;
    this.playingStuckSince = 0;
  }

  private emitStatus(s: StartStatus): void {
    if (this.status === s) return;
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

    if (this.phase === 'starting') {
      const vid = p.getVideoData?.()?.video_id;
      // If the method doesn't exist we can't check; otherwise require a match.
      const idOk = p.getVideoData ? vid === this.videoId : true;
      const advancing = state === YTState.PLAYING && idOk && t > this.lastT && this.lastT >= 0;
      if (advancing) {
        if (this.advancingSince === 0) this.advancingSince = now;
      } else {
        this.advancingSince = 0;
      }
      this.lastT = t;

      if (this.advancingSince && now - this.advancingSince >= CONFIRM_MS && t >= 0.6) {
        // Real song confirmed. Rewind silently, then unmute.
        p.pauseVideo();
        p.seekTo(0, true);
        this.enterPhase('settling');
        return;
      }

      // Hints for the "Starting soon" screen.
      const elapsed = now - this.phaseStart;
      if (this.status === 'needs-gesture' && (state === YTState.PLAYING || state === YTState.BUFFERING)) {
        this.emitStatus('loading'); // the kick worked; hide the Start prompt
      }
      if (state === YTState.PLAYING && !advancing) {
        if (this.playingStuckSince === 0) this.playingStuckSince = now;
        if (now - this.playingStuckSince > AD_HINT_MS) this.emitStatus('ad');
      } else {
        this.playingStuckSince = 0;
      }
      if (
        (state === YTState.UNSTARTED || state === YTState.CUED) &&
        t === 0 &&
        elapsed > GESTURE_HINT_MS
      ) {
        this.emitStatus('needs-gesture');
      }
      if (!this.slowSent && now - this.phaseStart > SLOW_MS) {
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
        this.phase = 'ready';
        this.clock.seek(0);
        this.clock.update(0, false);
        const pending = this.pending;
        this.pending = null;
        pending?.resolve();
      }
      return;
    }

    if (this.phase === 'ready') {
      if (!this.dur) this.dur = p.getDuration() || 0;
      if (this.wantPlaying && state !== YTState.PLAYING && state !== YTState.BUFFERING) {
        if (!this.gestureSent && now - this.playRequestedAt > PLAY_CHECK_MS) {
          this.gestureSent = true;
          this.onStatus?.('needs-gesture');
        }
      }
    }
  }

  private handleState(state: number): void {
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
    const err = new PlayerError(code, describeYTError(code));
    if (this.pending) {
      const { reject } = this.pending;
      this.pending = null;
      this.phase = 'idle';
      reject(err);
      return;
    }
    if (this.phase === 'ready') {
      this.wantPlaying = false;
      this.onError?.(err);
    }
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
