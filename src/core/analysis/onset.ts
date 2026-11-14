/**
 * Shared feature extraction: STFT -> log-compressed magnitude -> band-wise
 * half-wave-rectified spectral flux, plus per-frame energy features.
 *
 * Both the offline analyser and the streaming analyser push PCM through the
 * same `FeatureExtractor`; everything downstream (tempo, beats, downbeats,
 * sections) operates on the recorded `Features`, never on PCM.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import { RealFFT } from './fft';

export const SAMPLE_RATE = 22050;
export const N_FFT = 1024;
export const HOP = 512;
export const FRAME_RATE = SAMPLE_RATE / HOP; // ~43.07 frames per second
export const NUM_BANDS = 12;
/** Pitch classes in the chroma descriptor (C = 0). */
export const NUM_CHROMA = 12;
/** Chroma uses bins between these frequencies (below ~200 Hz one bin spans several semitones). */
const CHROMA_MIN_HZ = 190;
const CHROMA_MAX_HZ = 4200;

/** Magnitude compression: log(1 + GAMMA * |X| / (N/4)). */
const GAMMA = 1000;
/** Flux band edges (Hz). */
const LOW_MAX_HZ = 200;
const MID_MAX_HZ = 2000;
/** Weights of the low / mid / high band flux in the onset envelope. */
export const ONSET_WEIGHTS = { low: 0.6, mid: 0.27, high: 0.13 } as const;

/**
 * Level-relative descriptors for the song traits (traits.ts), one row of
 * TRAIT_DIMS values per frame. Every level is measured against the signal's
 * own running level L (a ~4 s average of the total power), so scaling the
 * input by any gain leaves them unchanged; content far below L (where lossy
 * codecs drop or noise-fill bins differently at every bitrate) sits on a
 * floor and does not count.
 *
 *  TR_KICK       rise of the 43-150 Hz band power since the previous frame
 *                (dB, clipped to 0..20, / 20), floored at -30 dB re L: kick
 *                drums, bass entries.
 *  TR_MID        the same for 800 Hz - 5 kHz (floor -30 dB): snare / clap
 *                crack, but also any loud midrange onset.
 *  TR_MID_RISE   fraction of the 800 Hz - 5 kHz bins that rose by more than
 *                6 dB: high for a broadband crack, low for a tonal onset
 *                (piano, voice) that raises only its partials.
 *  TR_HIGH       band rise for 5 - 10 kHz (floor -35 dB): hi-hats, shakers, cymbals.
 *  TR_HIGH_RISE  fraction of rising 5 - 10 kHz bins.
 *  TR_FLAT       spectral flatness (geometric / arithmetic mean power, bins
 *                floored at -40 dB re the mean bin power) over 1 - 5 kHz.
 *  TR_FILL       fraction of the 1 - 5 kHz bins above -30 dB re the mean bin
 *                power: a dense, distorted midrange fills nearly all of them.
 *  TR_CHROMA     12 values: chroma of log(1 + power / bin floor) (190 Hz - 4.2 kHz).
 */
export const TR_KICK = 0;
export const TR_MID = 1;
export const TR_MID_RISE = 2;
export const TR_HIGH = 3;
export const TR_HIGH_RISE = 4;
export const TR_FLAT = 5;
export const TR_FILL = 6;
export const TR_CHROMA = 7;
export const TRAIT_DIMS = TR_CHROMA + NUM_CHROMA;
/** Per-bin floor of the level-relative log power, re the running mean bin power (-40 dB). */
const BIN_FLOOR = 1e-4;
/** A bin counts as filled above this, re the running mean bin power (-30 dB). */
const FILL_LEVEL = 1e-3;
/** Running level: exponential average over ~4 s of frames. */
const LEVEL_ALPHA = 1 / (4 * (SAMPLE_RATE / HOP));
/** Rise (natural log of a power ratio) that counts a bin as rising: 6 dB. */
const RISE_LN = Math.log(4);
const JUMP_CLIP = Math.log(100); // 20 dB
interface TraitBand {
  hz: [number, number];
  /** Band floor re the running total power. */
  floor: number;
}
const TR_KICK_BAND: TraitBand = { hz: [43, 150], floor: 1e-3 };
const TR_MID_BAND: TraitBand = { hz: [800, 5000], floor: 1e-3 };
const TR_HIGH_BAND: TraitBand = { hz: [5000, 10000], floor: 3e-4 };
const TR_BANDS = [TR_KICK_BAND, TR_MID_BAND, TR_HIGH_BAND];
const TR_BAND_SLOTS = [TR_KICK, TR_MID, TR_HIGH];
const TR_FLAT_HZ: [number, number] = [1000, 5000];

/** Frame index -> time (s) of the frame centre. */
export function frameTime(frame: number): number {
  return (frame * HOP) / SAMPLE_RATE;
}

/** Read-only view of extracted features; every array has `frames` entries (bands: frames * NUM_BANDS). */
export interface Features {
  readonly frames: number;
  /** Mean positive log-magnitude increase per bin, < 200 Hz. */
  readonly fluxLow: Float32Array;
  /** Same, 200 Hz - 2 kHz. */
  readonly fluxMid: Float32Array;
  /** Same, > 2 kHz. */
  readonly fluxHigh: Float32Array;
  /** Frame RMS level in dBFS. */
  readonly energyDb: Float32Array;
  /** Level below 200 Hz, dB relative to a full-scale sine. */
  readonly lowDb: Float32Array;
  /** NUM_BANDS log-spaced band levels (dB), row-major [frame * NUM_BANDS + band]. */
  readonly bands: Float32Array;
  /**
   * Coarse chroma: compressed magnitude summed per pitch class (190 Hz - 4.2 kHz,
   * each bin split between its two nearest pitch classes), row-major
   * [frame * NUM_CHROMA + pitchClass]. Un-normalised; used for harmonic
   * similarity between bars.
   */
  readonly chroma: Float32Array;
  /** Level-relative trait descriptors, row-major [frame * TRAIT_DIMS + k] (see TR_KICK etc.). */
  readonly trait: Float32Array;
}

/** Growable store of per-frame features. */
export class FeatureStore {
  private cap: number;
  private n = 0;
  private fl: Float32Array;
  private fm: Float32Array;
  private fh: Float32Array;
  private en: Float32Array;
  private lo: Float32Array;
  private bd: Float32Array;
  private ch: Float32Array;
  private tr: Float32Array;

  constructor(initialCapacity = 2048) {
    this.cap = Math.max(16, initialCapacity);
    this.fl = new Float32Array(this.cap);
    this.fm = new Float32Array(this.cap);
    this.fh = new Float32Array(this.cap);
    this.en = new Float32Array(this.cap);
    this.lo = new Float32Array(this.cap);
    this.bd = new Float32Array(this.cap * NUM_BANDS);
    this.ch = new Float32Array(this.cap * NUM_CHROMA);
    this.tr = new Float32Array(this.cap * TRAIT_DIMS);
  }

  get frames(): number {
    return this.n;
  }

  /**
   * Appends one frame; `bands` must hold NUM_BANDS values, `chroma`
   * (optional, default zeros) NUM_CHROMA, `trait` (optional, default zeros)
   * TRAIT_DIMS.
   */
  push(
    fluxLow: number,
    fluxMid: number,
    fluxHigh: number,
    energyDb: number,
    lowDb: number,
    bands: ArrayLike<number>,
    chroma?: ArrayLike<number>,
    trait?: ArrayLike<number>,
  ): void {
    if (this.n === this.cap) this.grow();
    const i = this.n++;
    this.fl[i] = fluxLow;
    this.fm[i] = fluxMid;
    this.fh[i] = fluxHigh;
    this.en[i] = energyDb;
    this.lo[i] = lowDb;
    const b = i * NUM_BANDS;
    for (let k = 0; k < NUM_BANDS; k++) this.bd[b + k] = bands[k];
    if (chroma) {
      const c = i * NUM_CHROMA;
      for (let k = 0; k < NUM_CHROMA; k++) this.ch[c + k] = chroma[k];
    }
    if (trait) {
      const t = i * TRAIT_DIMS;
      for (let k = 0; k < TRAIT_DIMS; k++) this.tr[t + k] = trait[k];
    }
  }

  /** Zero-copy view of frames [start, end). */
  view(start = 0, end = this.n): Features {
    const s = Math.max(0, Math.min(start, this.n));
    const e = Math.max(s, Math.min(end, this.n));
    return {
      frames: e - s,
      fluxLow: this.fl.subarray(s, e),
      fluxMid: this.fm.subarray(s, e),
      fluxHigh: this.fh.subarray(s, e),
      energyDb: this.en.subarray(s, e),
      lowDb: this.lo.subarray(s, e),
      bands: this.bd.subarray(s * NUM_BANDS, e * NUM_BANDS),
      chroma: this.ch.subarray(s * NUM_CHROMA, e * NUM_CHROMA),
      trait: this.tr.subarray(s * TRAIT_DIMS, e * TRAIT_DIMS),
    };
  }

  private grow(): void {
    const cap = this.cap * 2;
    const g = (a: Float32Array, m = 1) => {
      const b = new Float32Array(cap * m);
      b.set(a);
      return b;
    };
    this.fl = g(this.fl);
    this.fm = g(this.fm);
    this.fh = g(this.fh);
    this.en = g(this.en);
    this.lo = g(this.lo);
    this.bd = g(this.bd, NUM_BANDS);
    this.ch = g(this.ch, NUM_CHROMA);
    this.tr = g(this.tr, TRAIT_DIMS);
    this.cap = cap;
  }
}

/**
 * Incremental STFT feature extractor for 22050 Hz mono PCM. Frames are
 * centred: frame i is centred on sample i * HOP (the signal is treated as
 * zero before its start), so `frameTime(i)` is the frame's time.
 */
export class FeatureExtractor {
  readonly store: FeatureStore;
  private readonly fft = new RealFFT(N_FFT);
  private readonly window = new Float64Array(N_FFT);
  private readonly buf = new Float32Array(N_FFT);
  private pos = N_FFT / 2; // centred framing: N/2 leading zeros
  private readonly frame = new Float64Array(N_FFT);
  private readonly pow = new Float64Array(N_FFT / 2 + 1);
  private logMag = new Float64Array(N_FFT / 2 + 1);
  private prevLog = new Float64Array(N_FFT / 2 + 1);
  private readonly bandVals = new Float64Array(NUM_BANDS);
  private readonly bandEdges: Int32Array;
  private readonly chromaVals = new Float64Array(NUM_CHROMA);
  /** Per chroma bin (from chromaLo): lower pitch class and weight of the upper one. */
  private readonly chromaPc: Uint8Array;
  private readonly chromaW: Float32Array;
  private readonly chromaLo: number;
  private readonly lowEnd: number;
  private readonly midEnd: number;
  /** Trait descriptors: level-relative log power of the previous frame, running level, bin ranges. */
  private relPrev = new Float64Array(N_FFT / 2 + 1);
  private relCur = new Float64Array(N_FFT / 2 + 1);
  private level = 0;
  private readonly traitVals = new Float64Array(TRAIT_DIMS);
  private readonly trLo: number;
  private readonly trHi: number;
  private readonly kickBins: [number, number];
  private readonly midBins: [number, number];
  private readonly highBins: [number, number];
  private readonly flatBins: [number, number];
  private readonly trBands: [number, number][];
  /** Band powers (natural log, floored) of the previous frame: kick, mid, high. */
  private readonly bandPrev = new Float64Array(3);
  private flushed = false;
  private frameCount = 0;

  constructor(store = new FeatureStore()) {
    this.store = store;
    for (let i = 0; i < N_FFT; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT);
    const binHz = SAMPLE_RATE / N_FFT;
    this.lowEnd = Math.round(LOW_MAX_HZ / binHz); // bins 1..lowEnd-1
    this.midEnd = Math.round(MID_MAX_HZ / binHz);
    // Log-spaced band edges from 40 Hz to Nyquist.
    this.bandEdges = new Int32Array(NUM_BANDS + 1);
    const fLo = 40;
    const fHi = SAMPLE_RATE / 2;
    let prev = 0;
    for (let b = 0; b <= NUM_BANDS; b++) {
      const f = fLo * Math.pow(fHi / fLo, b / NUM_BANDS);
      let bin = Math.min(N_FFT / 2 + 1, Math.round(f / binHz));
      if (b > 0 && bin <= prev) bin = prev + 1;
      this.bandEdges[b] = bin;
      prev = bin;
    }
    this.bandEdges[NUM_BANDS] = N_FFT / 2 + 1;
    const bins = (r: [number, number]): [number, number] => [Math.round(r[0] / binHz), Math.min(N_FFT / 2, Math.round(r[1] / binHz))];
    this.kickBins = bins(TR_KICK_BAND.hz);
    this.midBins = bins(TR_MID_BAND.hz);
    this.highBins = bins(TR_HIGH_BAND.hz);
    this.flatBins = bins(TR_FLAT_HZ);
    this.trBands = [this.kickBins, this.midBins, this.highBins];
    this.chromaLo = Math.ceil(CHROMA_MIN_HZ / binHz);
    const chromaHi = Math.floor(CHROMA_MAX_HZ / binHz);
    const nc = Math.max(0, chromaHi - this.chromaLo + 1);
    this.chromaPc = new Uint8Array(nc);
    this.chromaW = new Float32Array(nc);
    for (let j = 0; j < nc; j++) {
      // Fractional MIDI pitch of the bin centre; C = pitch class 0.
      const midi = 69 + 12 * Math.log2(((this.chromaLo + j) * binHz) / 440);
      const lo = Math.floor(midi);
      this.chromaPc[j] = ((lo % 12) + 12) % 12;
      this.chromaW[j] = midi - lo;
    }
    this.trLo = Math.min(this.kickBins[0], this.chromaLo);
    this.trHi = Math.max(this.highBins[1], this.chromaLo + nc);
  }

  /** Push 22050 Hz mono samples; complete frames are appended to the store. */
  push(samples: Float32Array): void {
    if (this.flushed) throw new Error('FeatureExtractor: push after flush');
    const buf = this.buf;
    let i = 0;
    const n = samples.length;
    while (i < n) {
      const take = Math.min(N_FFT - this.pos, n - i);
      buf.set(samples.subarray(i, i + take), this.pos);
      this.pos += take;
      i += take;
      if (this.pos === N_FFT) {
        this.processFrame();
        buf.copyWithin(0, HOP, N_FFT);
        this.pos = N_FFT - HOP;
      }
    }
  }

  /** Pad with N/2 zeros so the last samples get centred frames. No pushes afterwards. */
  flush(): void {
    if (this.flushed) return;
    this.push(new Float32Array(N_FFT / 2));
    this.flushed = true;
  }

  private processFrame(): void {
    const { buf, frame, window, pow } = this;
    let sumSq = 0;
    for (let i = 0; i < N_FFT; i++) {
      const v = buf[i];
      sumSq += v * v;
      frame[i] = v * window[i];
    }
    this.fft.power(frame, pow);
    // Normalise so a full-scale sine peaks at magnitude ~1.
    const norm = 1 / ((N_FFT / 4) * (N_FFT / 4));
    const logMag = this.logMag;
    const prev = this.prevLog;
    const nb = N_FFT / 2 + 1;
    let fl = 0;
    let fm = 0;
    let fh = 0;
    let lowPow = 0;
    const lowEnd = this.lowEnd;
    const midEnd = this.midEnd;
    for (let k = 0; k < nb; k++) {
      const p = pow[k] * norm;
      const l = Math.log1p(GAMMA * Math.sqrt(p));
      logMag[k] = l;
      const d = l - prev[k];
      if (k >= 1) {
        if (k < lowEnd) {
          lowPow += p;
          if (d > 0) fl += d;
        } else if (k < midEnd) {
          if (d > 0) fm += d;
        } else if (d > 0) fh += d;
      }
    }
    fl /= lowEnd - 1;
    fm /= midEnd - lowEnd;
    fh /= nb - midEnd;
    // The first two frames overlap the (zero) region before the stream
    // started; their flux would only measure the stream starting.
    if (this.frameCount++ < 2) fl = fm = fh = 0;
    const edges = this.bandEdges;
    const bv = this.bandVals;
    for (let b = 0; b < NUM_BANDS; b++) {
      let s = 0;
      for (let k = edges[b]; k < edges[b + 1]; k++) s += pow[k];
      bv[b] = 10 * Math.log10(s * norm + 1e-10);
    }
    const cv = this.chromaVals;
    cv.fill(0);
    const pcs = this.chromaPc;
    const cw = this.chromaW;
    for (let j = 0, k = this.chromaLo; j < pcs.length; j++, k++) {
      const m = logMag[k];
      const w = cw[j];
      const pc = pcs[j];
      cv[pc] += (1 - w) * m;
      cv[pc === 11 ? 0 : pc + 1] += w * m;
    }
    const energyDb = 10 * Math.log10(sumSq / N_FFT + 1e-10);
    const lowDb = 10 * Math.log10(lowPow + 1e-10);
    this.traitFrame(pow, norm, this.frameCount <= 2);
    this.store.push(fl, fm, fh, energyDb, lowDb, bv, cv, this.traitVals);
    // Swap log buffers.
    this.prevLog = logMag;
    this.logMag = prev;
  }

  /** Level-relative trait descriptors of the current frame into traitVals (see TR_KICK etc.). */
  private traitFrame(pow: Float64Array, norm: number, first: boolean): void {
    const nb = N_FFT / 2 + 1;
    let total = 0;
    for (let k = 1; k < nb; k++) total += pow[k];
    total *= norm;
    if (this.level <= 0) this.level = total;
    else this.level += LEVEL_ALPHA * (total - this.level);
    const L = this.level + 1e-30;
    const binFloor = (BIN_FLOOR * L) / (nb - 1);
    const fillLevel = (FILL_LEVEL * L) / (nb - 1);
    const cur = this.relCur;
    const prev = this.relPrev;
    for (let k = this.trLo; k < this.trHi; k++) cur[k] = Math.log(pow[k] * norm + binFloor);
    const tv = this.traitVals;
    tv.fill(0);
    for (let b = 0; b < 3; b++) {
      const [k0, k1] = this.trBands[b];
      let p = 0;
      let rising = 0;
      for (let k = k0; k < k1; k++) {
        p += pow[k];
        if (cur[k] - prev[k] > RISE_LN) rising++;
      }
      const lp = Math.log(p * norm + TR_BANDS[b].floor * L);
      const jump = lp - this.bandPrev[b];
      this.bandPrev[b] = lp;
      if (first) continue;
      tv[TR_BAND_SLOTS[b]] = jump <= 0 ? 0 : jump >= JUMP_CLIP ? 1 : jump / JUMP_CLIP;
      if (b > 0) tv[TR_BAND_SLOTS[b] + 1] = rising / (k1 - k0);
    }
    const [f0, f1] = this.flatBins;
    let lsum = 0;
    let psum = 0;
    let filled = 0;
    for (let k = f0; k < f1; k++) {
      const q = pow[k] * norm;
      lsum += cur[k];
      psum += q + binFloor;
      if (q > fillLevel) filled++;
    }
    tv[TR_FLAT] = Math.exp(lsum / (f1 - f0)) / (psum / (f1 - f0));
    tv[TR_FILL] = filled / (f1 - f0);
    const lf = Math.log(binFloor);
    const pcs = this.chromaPc;
    const cw = this.chromaW;
    for (let j = 0, k = this.chromaLo; j < pcs.length; j++, k++) {
      const m = cur[k] - lf; // log(1 + power / bin floor)
      const w = cw[j];
      const pc = pcs[j];
      tv[TR_CHROMA + pc] += (1 - w) * m;
      tv[TR_CHROMA + (pc === 11 ? 0 : pc + 1)] += w * m;
    }
    this.relPrev = cur;
    this.relCur = prev;
  }
}

/** Raw (un-normalised) weighted onset strength of frame i. */
export function rawOnset(f: Features, i: number): number {
  return ONSET_WEIGHTS.low * f.fluxLow[i] + ONSET_WEIGHTS.mid * f.fluxMid[i] + ONSET_WEIGHTS.high * f.fluxHigh[i];
}

/** Half-width (frames) of the moving average subtracted from the raw onset strength. */
export const DETREND_HALF_WIDTH = 21;

/**
 * Normalised onset-strength envelope over a whole feature set (non-causal):
 * weighted flux minus a centred ~1 s moving average, half-wave rectified,
 * divided by its standard deviation. All zeros for silence.
 */
export function onsetEnvelope(f: Features): Float32Array {
  const n = f.frames;
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) raw[i] = rawOnset(f, i);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + raw[i];
  const out = new Float32Array(n);
  const w = DETREND_HALF_WIDTH;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - w);
    const b = Math.min(n, i + w + 1);
    const mean = (prefix[b] - prefix[a]) / (b - a);
    const v = raw[i] - mean;
    const r = v > 0 ? v : 0;
    out[i] = r;
    sum += r;
    sumSq += r * r;
  }
  normaliseStd(out, sum, sumSq);
  return out;
}

/** Divide by the standard deviation in place (no-op for (near-)constant input). */
export function normaliseStd(x: Float32Array, sum?: number, sumSq?: number): void {
  const n = x.length;
  if (n < 2) return;
  if (sum === undefined || sumSq === undefined) {
    sum = 0;
    sumSq = 0;
    for (let i = 0; i < n; i++) {
      sum += x[i];
      sumSq += x[i] * x[i];
    }
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  if (!(variance > 1e-12)) {
    x.fill(0);
    return;
  }
  const inv = 1 / Math.sqrt(variance);
  for (let i = 0; i < n; i++) x[i] *= inv;
}
