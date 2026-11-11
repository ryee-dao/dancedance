/**
 * Live beat analysis for microphone / tab audio arriving in arbitrary chunks.
 *
 * The audio goes through exactly the same resampler and FeatureExtractor as
 * the offline path, and every feature frame is recorded. On top of that a
 * live tracker re-estimates the tempo over the last 10 s every ~0.19 s,
 * locks once the estimate is stable, and runs the DP beat tracker over the
 * recent window to keep the beat phase and predict upcoming beats.
 *
 * `finalize` runs the offline tracker (`analyzeFeatures`) over everything
 * recorded, so the saved map is as good as the recording allows; for the
 * same audio it is identical to `analyzeOffline` (with zero offset).
 *
 * Times in `state` are on the input-stream timeline (seconds of audio pushed
 * so far, starting at 0). `timeOffset` maps them to song time:
 * songTime = inputTime + timeOffset. `finalize` applies it.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import type { BeatMap, BeatMapSource } from './beatmap';
import { trackBeats } from './beats';
import { analyzeFeatures, BEAT_TIME_OFFSET, toBeatMap } from './offline';
import { FeatureExtractor, FeatureStore, FRAME_RATE, frameTime, normaliseStd, rawOnset, SAMPLE_RATE } from './onset';
import { Resampler } from './resample';
import { estimateTempo } from './tempo';

export interface StreamingOptions {
  /** Sample rate of the pushed chunks (Hz). */
  sampleRate: number;
  /** Song time = input-stream time + timeOffset (s). Default 0. */
  timeOffset?: number;
}

export interface StreamingState {
  /** True once a stable tempo and beat phase have been found. */
  locked: boolean;
  /** Current tempo estimate (0 before any estimate). */
  bpm: number;
  /** 0..1 smoothed tempo confidence. */
  confidence: number;
  /** Input-stream time (s) of the audio pushed so far. */
  time: number;
  /** Predicted upcoming beat times (input-stream time), empty when not locked. */
  nextBeats: number[];
  /** Beats detected so far (input-stream time), ascending. Read-only; grows in place. */
  beats: number[];
  /** Current input -> song time offset (s). */
  timeOffset: number;
}

const UPDATE_EVERY = 8; // frames (~186 ms)
const WINDOW_SECONDS = 10;
const MIN_SECONDS = 4;
const LOCK_MIN_SECONDS = 6;
const LOCK_STABLE_UPDATES = 6;
const MIN_LIVE_EVIDENCE = 0.12;
const DETREND = 43; // causal moving-average length (frames)
const COMMIT_DELAY = 0.4; // s: beats older than this are final
const SILENCE_DB = -70;
const UNLOCK_SILENT_SECONDS = 3;
const PREDICT_COUNT = 4;

export class StreamingAnalyzer {
  readonly sampleRate: number;
  private readonly resampler: Resampler;
  private readonly store = new FeatureStore(4096);
  private readonly extractor = new FeatureExtractor(this.store);
  private live = new Float32Array(4096);
  private readonly detrendRing = new Float64Array(DETREND);
  private detrendSum = 0;
  private processed = 0; // frames turned into live envelope values
  private inputSamples = 0;
  private sinceUpdate = 0;
  private signalFrames = 0;
  private silentFrames = 0;
  private candidateBpm = 0;
  private stableCount = 0;
  private mismatch = 0;
  private finalized = false;
  private readonly st: StreamingState;

  constructor(opts: StreamingOptions) {
    if (!(opts.sampleRate > 0) || !Number.isFinite(opts.sampleRate)) {
      throw new Error(`StreamingAnalyzer: invalid sampleRate ${opts.sampleRate}`);
    }
    this.sampleRate = opts.sampleRate;
    this.resampler = new Resampler(opts.sampleRate, SAMPLE_RATE);
    this.st = {
      locked: false,
      bpm: 0,
      confidence: 0,
      time: 0,
      nextBeats: [],
      beats: [],
      timeOffset: opts.timeOffset ?? 0,
    };
  }

  /** Current state (live object; treat as read-only). */
  get state(): Readonly<StreamingState> {
    return this.st;
  }

  setTimeOffset(offset: number): void {
    if (Number.isFinite(offset)) this.st.timeOffset = offset;
  }

  /** Push mono samples at the constructor's sample rate. */
  push(chunk: Float32Array): void {
    if (this.finalized) throw new Error('StreamingAnalyzer: push after finalize');
    this.inputSamples += chunk.length;
    this.st.time = this.inputSamples / this.sampleRate;
    this.extractor.push(this.resampler.process(chunk));
    this.consumeFrames();
  }

  private consumeFrames(): void {
    const total = this.store.frames;
    if (total === this.processed) return;
    const f = this.store.view();
    if (this.live.length < total) {
      const next = new Float32Array(Math.max(total, this.live.length * 2));
      next.set(this.live);
      this.live = next;
    }
    for (let i = this.processed; i < total; i++) {
      const raw = rawOnset(f, i);
      const slot = i % DETREND;
      this.detrendSum += raw - this.detrendRing[slot];
      this.detrendRing[slot] = raw;
      const mean = this.detrendSum / Math.min(i + 1, DETREND);
      const v = raw - mean;
      this.live[i] = v > 0 ? v : 0;
      if (f.energyDb[i] > SILENCE_DB) {
        this.signalFrames++;
        this.silentFrames = 0;
      } else this.silentFrames++;
      this.processed = i + 1;
      if (++this.sinceUpdate >= UPDATE_EVERY) {
        this.sinceUpdate = 0;
        this.update();
      }
    }
  }

  private update(): void {
    const st = this.st;
    const n = this.processed;
    if (this.silentFrames > UNLOCK_SILENT_SECONDS * FRAME_RATE) {
      st.locked = false;
      st.nextBeats = [];
      this.stableCount = 0;
      this.candidateBpm = 0;
      st.confidence *= 0.9;
      return;
    }
    if (n < MIN_SECONDS * FRAME_RATE) return;
    const w = Math.min(n, Math.round(WINDOW_SECONDS * FRAME_RATE));
    const start = n - w;
    const win = this.live.slice(start, n);
    normaliseStd(win);
    const est = estimateTempo(win, FRAME_RATE);
    st.confidence = 0.7 * st.confidence + 0.3 * est.confidence;

    if (est.bpm === 0 || est.evidence < MIN_LIVE_EVIDENCE) {
      this.stableCount = 0;
    } else if (this.candidateBpm > 0 && Math.abs(Math.log(est.bpm / this.candidateBpm)) < 0.025) {
      this.stableCount++;
      this.candidateBpm = 0.7 * this.candidateBpm + 0.3 * est.bpm;
    } else {
      this.candidateBpm = est.bpm;
      this.stableCount = 1;
    }

    if (!st.locked) {
      if (this.stableCount >= LOCK_STABLE_UPDATES && this.signalFrames >= LOCK_MIN_SECONDS * FRAME_RATE) {
        st.locked = true;
        st.bpm = this.candidateBpm;
        this.mismatch = 0;
      } else {
        if (this.candidateBpm > 0) st.bpm = this.candidateBpm;
        return;
      }
    } else if (est.bpm > 0 && est.evidence >= MIN_LIVE_EVIDENCE) {
      if (Math.abs(Math.log(est.bpm / st.bpm)) < 0.04) {
        st.bpm = 0.85 * st.bpm + 0.15 * est.bpm;
        this.mismatch = 0;
      } else if (++this.mismatch >= 12 && this.stableCount >= 6) {
        // Sustained, self-consistent different tempo: follow it.
        st.bpm = this.candidateBpm;
        this.mismatch = 0;
      }
    }

    // Phase: DP beat tracking over the recent window at the locked tempo.
    const period = (60 * FRAME_RATE) / st.bpm;
    const frames = trackBeats(win, period);
    if (frames.length < 3) return;
    const times = Array.from(frames, (fr) => frameTime(fr + start) + BEAT_TIME_OFFSET);
    const now = frameTime(n - 1);
    const periodS = 60 / st.bpm;

    // Commit settled beats.
    const beats = st.beats;
    for (const t of times) {
      if (t > now - COMMIT_DELAY) break;
      const last = beats.length ? beats[beats.length - 1] : -Infinity;
      if (t > last + 0.7 * periodS) beats.push(t);
    }

    // Predict: robust line through the most recent beats.
    const recent = times.slice(-8);
    const fit = fitLine(recent);
    let slope = fit.slope;
    if (!(Math.abs(Math.log(slope / periodS)) < 0.05)) slope = periodS;
    const lastIdx = recent.length - 1;
    const lastBeat = fit.icpt + fit.slope * lastIdx;
    const next: number[] = [];
    let t = lastBeat;
    let guard = 0;
    while (next.length < PREDICT_COUNT && guard++ < 64) {
      t += slope;
      if (t > now) next.push(t);
    }
    st.nextBeats = next;
  }

  /**
   * Finish: run the offline tracker over all recorded features and return the
   * BeatMap in song time (times shifted by the current timeOffset and clipped
   * to [0, duration]). Marked partial when the recording misses more than 5 s
   * of the song. No pushes are accepted afterwards.
   */
  finalize(videoId: string, duration: number, source: BeatMapSource): BeatMap {
    if (!this.finalized) {
      this.extractor.push(this.resampler.flush());
      this.extractor.flush();
      this.finalized = true;
    }
    const offset = this.st.timeOffset;
    const recorded = this.inputSamples / this.sampleRate;
    const result = analyzeFeatures(this.store.view(), { duration: Math.max(0, duration - offset) });
    const covered = Math.max(0, Math.min(duration, offset + recorded) - Math.max(0, offset));
    return toBeatMap(result, { videoId, duration, source, offset, partial: covered < duration - 5 });
  }
}

function fitLine(t: number[]): { slope: number; icpt: number } {
  const solve = (idx: number[]) => {
    const m = idx.length;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const i of idx) {
      sx += i;
      sy += t[i];
      sxx += i * i;
      sxy += i * t[i];
    }
    const den = m * sxx - sx * sx;
    const slope = den !== 0 ? (m * sxy - sx * sy) / den : 0;
    return { slope, icpt: (sy - slope * sx) / m };
  };
  const all = t.map((_, i) => i);
  let fit = solve(all);
  const keep = all.filter((i) => Math.abs(t[i] - (fit.icpt + fit.slope * i)) < 0.04);
  if (keep.length >= 3 && keep.length < all.length) fit = solve(keep);
  return fit;
}
