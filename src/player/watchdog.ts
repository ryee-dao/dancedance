/**
 * Playback watchdog for an <audio> element: the song must never sit stuck
 * while the screen says it is playing.
 *
 * Fed with the element's state a few times a second, it notices when the
 * song is meant to be playing but its time has stood still for `stuckMs`
 * (a media element starved of data, a stream Chromium gave up on, a decoder
 * that stopped, a file damaged past some point) and when the element
 * reported an error, and decides what to do:
 *
 *  - 'recover':  reload the file and carry on from the same spot (the
 *                player also shows its "Buffering…" notice meanwhile);
 *  - 'resumed':  time moves again after a stall (clear the notice);
 *  - 'ended':    stuck within a second or so of the end: finish the song;
 *  - 'give-up':  reloading didn't help `maxRecoveries` times in a row: the
 *                player reports an error (the play screen skips the song)
 *                and the file is dropped so the next play gets a fresh copy.
 *
 * A recovery counts as done once the song has played `cleanSec` past the spot
 * it was reloaded at; then the count starts over. Pure logic (no DOM, wall
 * time passed in), so it is unit-tested on its own.
 */

export type WatchdogAction = 'none' | 'recover' | 'resumed' | 'ended' | 'give-up';

export interface WatchdogSample {
  /** Wall time, ms. */
  now: number;
  /** The player wants to be playing (play() called, not paused / ended). */
  wantPlay: boolean;
  /** The element's currentTime, s. */
  time: number;
  ended: boolean;
  /** s; 0 while unknown. */
  duration: number;
}

export interface WatchdogOptions {
  /** Time standing still this long while meant to be playing counts as stuck. Default 4000. */
  stuckMs?: number;
  /** After a reload, wait this long for it to work before the next one. Default 6000. */
  retryMs?: number;
  /** Reloads in a row (without clean playback in between) before giving up. Default 3. */
  maxRecoveries?: number;
  /** Clean playback (s) past the reload point that ends a recovery. Default 15. */
  cleanSec?: number;
  /** Stuck this close to the end (s) finishes the song instead. Default 1.5. */
  endSlackSec?: number;
}

export class PlaybackWatchdog {
  private readonly stuckMs: number;
  private readonly retryMs: number;
  private readonly maxRecoveries: number;
  private readonly cleanSec: number;
  private readonly endSlackSec: number;

  private lastTime = Number.NaN;
  private movedAt = 0;
  private stalled = false;
  private recoveries = 0;
  /** Song time the last reload resumed from. */
  private recoveredFrom = 0;
  private lastRecoverAt = -Infinity;
  private done = false;

  constructor(opts: WatchdogOptions = {}) {
    this.stuckMs = opts.stuckMs ?? 4000;
    this.retryMs = opts.retryMs ?? 6000;
    this.maxRecoveries = opts.maxRecoveries ?? 3;
    this.cleanSec = opts.cleanSec ?? 15;
    this.endSlackSec = opts.endSlackSec ?? 1.5;
  }

  /** New song (or a fresh load): forget everything. */
  reset(): void {
    this.lastTime = Number.NaN;
    this.movedAt = 0;
    this.stalled = false;
    this.recoveries = 0;
    this.recoveredFrom = 0;
    this.lastRecoverAt = -Infinity;
    this.done = false;
  }

  /** Reloads so far in the current run of trouble (diagnostics / tests). */
  get recoveryCount(): number {
    return this.recoveries;
  }

  /** True while it considers the song stuck (between a stall and 'resumed'). */
  get isStalled(): boolean {
    return this.stalled;
  }

  check(s: WatchdogSample): WatchdogAction {
    if (this.done) return 'none';
    if (!s.wantPlay || s.ended || !Number.isFinite(s.time)) {
      // Not meant to be moving: nothing to watch; start the stuck timer afresh on resume.
      this.movedAt = s.now;
      this.lastTime = s.time;
      if (this.stalled && !s.wantPlay) this.stalled = false;
      return 'none';
    }
    if (s.time !== this.lastTime) {
      this.lastTime = s.time;
      this.movedAt = s.now;
      if (this.recoveries > 0 && s.time - this.recoveredFrom >= this.cleanSec) this.recoveries = 0;
      if (this.stalled) {
        this.stalled = false;
        return 'resumed';
      }
      return 'none';
    }
    if (s.now - this.movedAt < this.stuckMs) return 'none';
    if (s.duration > 0 && s.time >= s.duration - this.endSlackSec) {
      this.done = true;
      return 'ended';
    }
    this.stalled = true;
    if (s.now - this.lastRecoverAt < this.retryMs) return 'none';
    return this.recoverOrGiveUp(s.now, s.time);
  }

  /** The element reported an error while playing: reload now, or give up after too many. */
  noteError(now: number, time: number): WatchdogAction {
    if (this.done) return 'none';
    this.stalled = true;
    return this.recoverOrGiveUp(now, time);
  }

  private recoverOrGiveUp(now: number, time: number): WatchdogAction {
    if (this.recoveries >= this.maxRecoveries) {
      this.done = true;
      return 'give-up';
    }
    this.recoveries++;
    this.recoveredFrom = Number.isFinite(time) ? time : this.recoveredFrom;
    this.lastRecoverAt = now;
    // Give the reload the full stuck window before judging it.
    this.movedAt = now;
    return 'recover';
  }
}
