/**
 * Smooth media clock.
 *
 * The YouTube IFrame API's getCurrentTime() is a cached value that the iframe
 * posts to the page every few hundred ms, so read directly it steps and
 * jitters. Animation needs a time that moves every frame, so this clock:
 *
 *  - extrapolates from the last anchor with a wall-clock source
 *    (performance.now() by default, injectable for tests);
 *  - treats a repeated identical sample while playing as stale (the player
 *    hasn't posted a new value yet) and ignores it instead of pulling back;
 *  - corrects small errors gradually by slewing: the clock runs at most
 *    `maxSlew` faster or slower (10% by default) until the error is gone,
 *    so time stays continuous and monotonic while playing;
 *  - snaps immediately when the error exceeds `snapThreshold` (seek, stall
 *    recovery, start of playback);
 *  - freezes while not playing (paused, buffering, ended);
 *  - never extrapolates more than `maxHold` seconds past the last FRESH
 *    sample: a player that says "playing" while its time has stopped (a
 *    media element starved of data, a dead audio output) freezes the clock
 *    instead of letting the dance run on to no sound. `staleFor()` tells the
 *    player's watchdog how long that has been.
 *
 * Units: media time in seconds, wall time in milliseconds.
 */

export interface ClockOptions {
  /** Wall-clock source in milliseconds. Default: performance.now(). */
  now?: () => number;
  /** Errors larger than this (seconds) snap instead of slewing. Default 0.15. */
  snapThreshold?: number;
  /** Max correction speed as a fraction of real time. Default 0.1. */
  maxSlew?: number;
  /**
   * Longest extrapolation (seconds) without a fresh sample while playing.
   * Default 2 (the YouTube IFrame API posts every few hundred ms, and has its
   * own stall detection); media elements, which update every frame, use less.
   */
  maxHold?: number;
}

export class SmoothClock {
  private readonly now: () => number;
  private readonly snapThreshold: number;
  private readonly maxSlew: number;
  private readonly maxHold: number;

  private playing = false;
  /** Media time at the anchor. */
  private anchorMedia = 0;
  /** Wall time (ms) at the anchor. */
  private anchorWall = 0;
  /** Remaining correction (seconds) to be slewed in from the anchor onward. */
  private pending = 0;
  /** Last raw sample, for stale-repeat detection. */
  private lastSample = NaN;
  /** Wall time (ms) of the last fresh sample (or of the transition into playing). */
  private freshWall = 0;

  constructor(opts: ClockOptions = {}) {
    this.now = opts.now ?? (() => performance.now());
    this.snapThreshold = opts.snapThreshold ?? 0.15;
    this.maxSlew = opts.maxSlew ?? 0.1;
    this.maxHold = Math.max(0.05, opts.maxHold ?? 2);
  }

  /** Current smoothed media time in seconds. */
  time(): number {
    return this.estimate(this.now());
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Seconds since the player last reported a new time while playing (0 when
   * not playing). Past `maxHold` the clock stands still; a watchdog can use
   * this to notice a player stuck in "playing".
   */
  staleFor(): number {
    if (!this.playing) return 0;
    return Math.max(0, (this.now() - this.freshWall) / 1000);
  }

  /**
   * Feed a sample from the player. Call as often as you like (every frame is
   * fine); repeated identical samples while playing are ignored.
   */
  update(mediaTime: number, playing: boolean): void {
    if (!Number.isFinite(mediaTime)) return;
    const t = this.now();

    if (!playing) {
      // Frozen: report exactly what the player says.
      this.anchor(mediaTime, t);
      this.playing = false;
      this.lastSample = mediaTime;
      return;
    }

    if (!this.playing) {
      // Transition into playing: start from the reported position.
      this.anchor(mediaTime, t);
      this.playing = true;
      this.lastSample = mediaTime;
      this.freshWall = t;
      return;
    }

    if (mediaTime === this.lastSample) return; // stale repeat, nothing new
    this.lastSample = mediaTime;
    this.freshWall = t;

    const est = this.estimate(t);
    const err = mediaTime - est;
    if (Math.abs(err) > this.snapThreshold) {
      this.anchor(mediaTime, t);
    } else {
      // Re-anchor at the current estimate (continuity) and slew the rest.
      this.anchorMedia = est;
      this.anchorWall = t;
      this.pending = err;
    }
  }

  /** Hard reset to a known position (e.g. after an explicit seek). */
  seek(mediaTime: number): void {
    const t = this.now();
    this.anchor(mediaTime, t);
    this.lastSample = mediaTime;
    this.freshWall = t;
  }

  private anchor(mediaTime: number, wall: number): void {
    this.anchorMedia = mediaTime;
    this.anchorWall = wall;
    this.pending = 0;
  }

  private estimate(wall: number): number {
    if (!this.playing) return this.anchorMedia;
    // The anchor moves with every fresh sample, so this bounds the run-on
    // after the player's time stopped moving.
    const elapsed = Math.min(this.maxHold, Math.max(0, (wall - this.anchorWall) / 1000));
    const budget = elapsed * this.maxSlew;
    const applied =
      this.pending >= 0 ? Math.min(this.pending, budget) : Math.max(this.pending, -budget);
    return this.anchorMedia + elapsed + applied;
  }
}
