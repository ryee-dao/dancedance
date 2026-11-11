/**
 * Mapping live input-stream time to song time. Pure: no DOM.
 *
 * The StreamingAnalyzer timestamps everything on its input timeline (seconds
 * of audio pushed). For each captured chunk we know, on the performance.now()
 * clock, when its last sample entered the audio graph, and the player tells
 * us the song time "now". So:
 *
 *   songTimeOfSound = playerTimeAt(captureTime) - latency
 *   offset          = songTimeOfSound - inputTimeAtChunkEnd
 *
 * `latency` is how long the sound took from the player to our audio graph:
 *  - tab audio: no speakers involved, only Chrome's capture pipeline
 *    (TAB_CAPTURE_LATENCY, measured)
 *  - microphone: speaker/output latency + mic input latency + a small
 *    constant, plus the user's audio-offset setting (which describes extra
 *    speaker lag such as Bluetooth).
 */

/** Extra mic path delay not reported by any API (air, driver buffers), seconds. */
export const MIC_EXTRA_LATENCY = 0.02;

export interface MicLatencyParts {
  /** AudioContext baseLatency + outputLatency, s. */
  contextLatency: number;
  /** MediaStreamTrack settings latency, s (0 if unknown). */
  trackLatency: number;
  /** The user's audio offset setting, ms (positive = speakers lag). */
  userOffsetMs: number;
}

export function micLatency(p: MicLatencyParts): number {
  const fin = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);
  const user = Number.isFinite(p.userOffsetMs) ? p.userOffsetMs / 1000 : 0;
  return fin(p.contextLatency) + fin(p.trackLatency) + MIC_EXTRA_LATENCY + user;
}

/**
 * Chrome's tab-capture pipeline delay, seconds. Measured in Chrome for
 * Testing 2026-11: live predicted beats from tab audio landed 31-47 ms
 * (median ~41 ms) after the cloud beat map on two songs, while the file
 * path (same analyser, no capture) showed no bias.
 */
export const TAB_CAPTURE_LATENCY = 0.04;

export function tabLatency(): number {
  return TAB_CAPTURE_LATENCY;
}

export interface RawOffsetInput {
  /** Player song time at perfNow, s. */
  songNow: number;
  /** performance.now() when songNow was read, ms. */
  perfNow: number;
  /** performance.now() when the chunk's last sample was captured, ms. */
  capturePerf: number;
  /** Analyzer input time at the end of the chunk, s. */
  inputTime: number;
  /** Player -> capture latency, s. */
  latency: number;
}

/** One noisy measurement of songTime - inputTime. Assumes the song plays at 1x. */
export function rawOffset(i: RawOffsetInput): number {
  const songAtCapture = i.songNow - (i.perfNow - i.capturePerf) / 1000;
  return songAtCapture - i.latency - i.inputTime;
}

export interface OffsetEstimatorOptions {
  /** Median window (chunks). Default 31. */
  window?: number;
  /** A measurement this far (s) from the estimate counts as a jump candidate. Default 0.25. */
  jumpThreshold?: number;
  /** This many consecutive jump candidates = a real discontinuity (seek, ad). Default 4. */
  jumpCount?: number;
}

/**
 * Robust running estimate of the offset: the median of the recent
 * measurements (rejects message-delivery jitter). Reports 'jump' when the
 * measurements move away and stay away (the song time jumped).
 */
export class OffsetEstimator {
  private readonly window: number;
  private readonly jumpThreshold: number;
  private readonly jumpCount: number;
  private readonly recent: number[] = [];
  private outliers = 0;
  private est: number | null = null;

  constructor(o: OffsetEstimatorOptions = {}) {
    this.window = o.window ?? 31;
    this.jumpThreshold = o.jumpThreshold ?? 0.25;
    this.jumpCount = o.jumpCount ?? 4;
  }

  get value(): number | null {
    return this.est;
  }

  /** Add a measurement. 'jump' means the caller should start a new segment (the estimator has reset to it). */
  push(raw: number): 'ok' | 'jump' {
    if (!Number.isFinite(raw)) return 'ok';
    if (this.est !== null && Math.abs(raw - this.est) > this.jumpThreshold) {
      if (++this.outliers >= this.jumpCount) {
        this.reset(raw);
        return 'jump';
      }
      return 'ok';
    }
    this.outliers = 0;
    this.recent.push(raw);
    if (this.recent.length > this.window) this.recent.shift();
    this.est = median(this.recent);
    return 'ok';
  }

  reset(seed?: number): void {
    this.recent.length = 0;
    this.outliers = 0;
    this.est = null;
    if (seed !== undefined && Number.isFinite(seed)) {
      this.recent.push(seed);
      this.est = seed;
    }
  }
}

export function median(xs: readonly number[]): number {
  const a = xs.slice().sort((p, q) => p - q);
  const n = a.length;
  if (n === 0) return NaN;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}
