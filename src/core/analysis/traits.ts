/**
 * Song traits: a few absolute, per-song descriptors of the music's
 * character, comparable across songs (unlike the per-bar and per-section
 * readings, which are relative within one song). Every trait is 0..1.
 *
 * Inputs are the level-relative descriptors of onset.ts (TR_KICK etc.: band
 * power rises against a floor that follows the signal's own level, the
 * fraction of bins that rose, flatness, how much of the midrange is filled),
 * the band levels (as dB differences) and the beat grid. Scaling the input
 * by any gain leaves all of them unchanged, and content far below the
 * running level (where lossy codecs differ most between bitrates) is ignored.
 *
 * Rhythm is read on the beat grid: each beat is cut into four 16th-note
 * slots, and each slot gets the peak of a descriptor around it minus that
 * descriptor's median over the surrounding two bars (its "prominence"), so
 * steady texture (a held distorted chord, cymbal wash, noise) does not count
 * as hits. Per-frame "snare" = sqrt(midrange rise x fraction of midrange bins
 * rising): a broadband crack scores high, a tonal onset (piano, voice) that
 * raises only its partials scores low. "Hat" is the same for 5 - 10 kHz.
 *
 *  drive     kick prominence per beat (0.55), midrange and high-band rises
 *            (0.25, 0.2), scaled by how much of the onset activity sits on
 *            the 16th grid rather than between it. Dense, distorted mixes
 *            mask their drums and read lower than they sound (see heavy).
 *  hats      fraction of 16th slots with a hat hit.
 *  fourFloor per bar: the weakest of the four on-beat kicks minus half the
 *            off-beat kick level, when it is not much weaker than the
 *            others; mean over bars (bars without a kick count as 0).
 *  halfFeel  snare per beat of the bar, averaged over 8-bar windows: by how
 *            much the strongest beat beats the other three, discounted when
 *            the kick lands there too (a downbeat accent, not a backbeat);
 *            gated on a high-band crack. Wherever the downbeat landed, one
 *            snare per bar reads as half-time and 2-and-4 does not.
 *  swing     position of the strongest off-beat peak in the beat-relative
 *            profile of snare + hat activity (0.5 straight, 0.6-0.67 swung),
 *            when that peak is strong enough.
 *  syncop    share of the (background-removed) kick or snare accents on the
 *            16th off-beats (and half on the 8th off-beat), the larger of
 *            the two; reduced by swing (swung 8ths land near the 4th 16th).
 *  bass      level below ~100 Hz re the whole spectrum (dB).
 *  heavy     flatness of the 1-5 kHz band in its quieter frames (25th
 *            percentile: sustained noise, not just cymbal hits) x how filled
 *            that band stays: distorted guitars, a wall of sound.
 *  minor     Krumhansl-Kessler key profiles on the mean chroma: best minor
 *            minus best major correlation (weak: relative keys share notes).
 *  calm      1 - (drive 0.45, strong onsets per second 0.25, heavy 0.2,
 *            hats 0.1). Not the counted tempo: ballads are often counted at
 *            double time, so slowness shows as sparse onsets instead.
 *
 * A song without a usable grid gets 0 for fourFloor, halfFeel, swing and
 * syncop; hats and drive then use a 120 BPM pseudo-grid.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs. Deterministic.
 */
import {
  FRAME_RATE,
  frameTime,
  NUM_BANDS,
  TR_CHROMA,
  TR_FILL,
  TR_FLAT,
  TR_HIGH,
  TR_HIGH_RISE,
  TR_KICK,
  TR_MID,
  TR_MID_RISE,
  TRAIT_DIMS,
  type Features,
} from './onset';

/** Absolute per-song descriptors, each 0..1 (stored with 2 decimals). */
export interface SongTraits {
  /** 1 = very calm (slow, sparse hits, little percussion, soft); 0 = driving. */
  calm: number;
  /** Drum / percussive strength. */
  drive: number;
  /** A steady kick on every beat (house, disco, EDM). */
  fourFloor: number;
  /** Backbeat at half the counted tempo (trap, drill, dubstep). */
  halfFeel: number;
  /** Sub-bass weight. */
  bass: number;
  /** Hi-hat / 16th-note density (trap rolls, drum & bass). */
  hats: number;
  /** Swung or shuffled 8ths. */
  swing: number;
  /** Syncopation (dembow, afrobeats). */
  syncop: number;
  /** Distortion / wall of sound (metal, hard rock). */
  heavy: number;
  /** Minor-mode likelihood (a weak estimate: relative major / minor keys share their notes). */
  minor: number;
}

export const TRAIT_KEYS = ['calm', 'drive', 'fourFloor', 'halfFeel', 'bass', 'hats', 'swing', 'syncop', 'heavy', 'minor'] as const satisfies readonly (keyof SongTraits)[];

/** The beat grid traits are read on (times in seconds on the features' timeline). */
export interface TraitGrid {
  beats: ArrayLike<number>;
  /** Indices into beats. */
  downbeats: ArrayLike<number>;
  bpm: number;
}

/** Round to the stored precision (2 decimals) and clamp to 0..1. */
export function roundTrait(x: number): number {
  return Number.isFinite(x) ? Math.round(Math.min(1, Math.max(0, x)) * 100) / 100 : 0;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);
/** Linear map of x from [a, b] onto 0..1 (clamped). */
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

function quantile(xs: ArrayLike<number>, p: number): number {
  const s = Float64Array.from(xs).sort();
  const n = s.length;
  if (n === 0) return 0;
  const x = p * (n - 1);
  const i = Math.floor(x);
  const f = x - i;
  return i + 1 < n ? s[i] * (1 - f) + s[i + 1] * f : s[i];
}

const median = (xs: ArrayLike<number>) => quantile(xs, 0.5);

const mean = (xs: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : 0;
};

/** Frames quieter than this under the song's loud level are ignored (dB). */
const ACTIVE_DB = 30;
/** Fewer beats than this: no usable grid. */
const MIN_GRID_BEATS = 16;
/** Prominence above which a 16th slot counts as a hat hit. */
const HIT_HAT = 0.2;
/** A local peak of the broadband onset signal this far above its 1 s median is a strong onset. */
const ONSET_PROMINENCE = 0.12;

/** Raw measurements behind the traits (exported for tests and calibration). */
export interface TraitStats {
  /** Active (non-silent) seconds analysed. */
  seconds: number;
  /** Whether a real beat grid was used. */
  grid: boolean;
  /** Mean per-beat strongest kick / snare-band / hat-band prominence. */
  kick: number;
  midRise: number;
  highRise: number;
  /** Share of onset peaks on the 16th grid vs half-way between (0.5 = no grid locking). */
  gridLock: number;
  /** Fraction of 16th slots with a hat hit. */
  hatDensity: number;
  /** Strong broadband onsets per active second. */
  onsetRate: number;
  /** Mean per-bar four-on-the-floor score. */
  fourFloor: number;
  /** Mean margin of the one dominant snare beat per bar over the others, away from the kick (8-bar windows). */
  half: number;
  /** Strongest off-beat peak: position in the beat and strength over the profile median. */
  offPos: number;
  offStrength: number;
  /** Off-beat accent share of the kick and of the snare. */
  syncKick: number;
  syncSnare: number;
  /** Level below ~100 Hz re the whole spectrum (dB). */
  subDb: number;
  /** 25th percentile of the 1-5 kHz flatness and of its fill. */
  flatness: number;
  fill: number;
  /** Best minor-key minus best major-key profile correlation. */
  modeDiff: number;
}

/** Song traits from extracted features and a beat grid. */
export function traitsFromFeatures(f: Features, grid: TraitGrid): SongTraits {
  return traitsFromStats(traitStats(f, grid));
}

/** Map raw statistics onto 0..1 traits. */
export function traitsFromStats(s: TraitStats): SongTraits {
  if (s.seconds < 2) {
    return { calm: 1, drive: 0, fourFloor: 0, halfFeel: 0, bass: 0, hats: 0, swing: 0, syncop: 0, heavy: 0, minor: 0.5 };
  }
  const hits = 0.55 * ramp(s.kick, 0.15, 0.6) + 0.25 * ramp(s.midRise, 0.12, 0.5) + 0.2 * ramp(s.highRise, 0.12, 0.6);
  const drive = clamp01(hits * (0.75 + 0.25 * ramp(s.gridLock, 0.52, 0.75)));
  const hats = ramp(s.hatDensity, 0.1, 0.7);
  const fourFloor = s.grid ? ramp(s.fourFloor, 0.1, 0.55) : 0;
  // Gated on a high-band crack: a once-per-bar chord or piano hit is not a backbeat.
  const halfFeel = s.grid ? ramp(s.half, 0.08, 0.2) * ramp(s.highRise, 0.15, 0.3) : 0;
  const swing = s.grid ? ramp(s.offPos, 0.55, 0.63) * ramp(s.offStrength, 0.04, 0.09) : 0;
  const syncop = s.grid ? ramp(Math.max(s.syncKick, s.syncSnare), 0.22, 0.5) * (1 - swing) : 0;
  const bass = ramp(s.subDb, -15, -1);
  const heavy = ramp(s.flatness, 0.09, 0.17) * ramp(s.fill, 0.9, 0.985);
  const density = ramp(s.onsetRate, 2, 5);
  const driving = 0.45 * drive + 0.25 * density + 0.2 * heavy + 0.1 * hats;
  const calm = 1 - ramp(driving, 0.1, 0.6);
  const minor = clamp01(0.5 + 5 * (s.modeDiff - 0.05));
  return {
    calm: roundTrait(calm),
    drive: roundTrait(drive),
    fourFloor: roundTrait(fourFloor),
    halfFeel: roundTrait(halfFeel),
    bass: roundTrait(bass),
    hats: roundTrait(hats),
    swing: roundTrait(swing),
    syncop: roundTrait(syncop),
    heavy: roundTrait(heavy),
    minor: roundTrait(minor),
  };
}

/** Per-frame descriptor k as its own array. */
function column(f: Features, k: number): Float32Array {
  const out = new Float32Array(f.frames);
  for (let i = 0; i < f.frames; i++) out[i] = f.trait[i * TRAIT_DIMS + k];
  return out;
}

const toFrame = (t: number) => Math.round(t * FRAME_RATE);

/** Running-median block size (frames) and histogram resolution (values are 0..1). */
const MED_STEP = 4;
const MED_BINS = 200;

/**
 * Median of x (values in 0..1) over [i - half, i + half] for every block of
 * MED_STEP frames (entry b is for frame b * MED_STEP), from a sliding
 * histogram: O(frames) instead of a sort per window.
 */
function runningMedian(x: Float32Array, half: number): Float32Array {
  const n = x.length;
  const out = new Float32Array(Math.ceil(n / MED_STEP) + 1);
  if (n === 0) return out;
  const hist = new Int32Array(MED_BINS);
  const bin = (v: number) => (v <= 0 ? 0 : v >= 1 ? MED_BINS - 1 : Math.floor(v * MED_BINS));
  let lo = 0; // window is [lo, hi)
  let hi = 0;
  let count = 0;
  for (let b = 0; b < out.length; b++) {
    const c = Math.min(n - 1, b * MED_STEP);
    const a = Math.max(0, c - half);
    const e = Math.min(n, c + half + 1);
    while (hi < e) (hist[bin(x[hi++])]++, count++);
    while (lo < a) (hist[bin(x[lo++])]--, count--);
    let need = count / 2;
    let k = 0;
    while (k < MED_BINS - 1 && need >= hist[k]) need -= hist[k++];
    out[b] = (k + (hist[k] > 0 ? need / hist[k] : 0.5)) / MED_BINS;
  }
  return out;
}

/** Raw trait statistics (see TraitStats). */
export function traitStats(f: Features, grid: TraitGrid): TraitStats {
  const n = f.frames;
  // Active frames: within ACTIVE_DB of the song's loud level (90th percentile).
  const loudRef = quantile(f.energyDb.filter((x) => x > -100), 0.9);
  const active = new Uint8Array(n);
  let nActive = 0;
  for (let i = 0; i < n; i++) {
    if (f.energyDb[i] > -100 && f.energyDb[i] > loudRef - ACTIVE_DB) {
      active[i] = 1;
      nActive++;
    }
  }
  const seconds = nActive / FRAME_RATE;
  const kick = column(f, TR_KICK);
  const midJ = column(f, TR_MID);
  const midR = column(f, TR_MID_RISE);
  const highJ = column(f, TR_HIGH);
  const highR = column(f, TR_HIGH_RISE);
  const snare = new Float32Array(n);
  const hat = new Float32Array(n);
  const onset = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    snare[i] = Math.sqrt(midJ[i] * midR[i]);
    hat[i] = Math.sqrt(highJ[i] * highR[i]);
    onset[i] = 0.5 * (snare[i] + hat[i]) + 0.5 * kick[i];
  }

  // Beat grid (or a 120 BPM pseudo-grid).
  const hasGrid = grid.beats.length >= MIN_GRID_BEATS && grid.bpm > 0;
  let beats: number[];
  let downbeats: number[];
  if (hasGrid) {
    beats = Array.from(grid.beats);
    downbeats = Array.from(grid.downbeats).filter((d) => d >= 0 && d < beats.length);
    if (downbeats.length < 2) {
      downbeats = [];
      for (let i = 0; i < beats.length; i += 4) downbeats.push(i);
    }
  } else {
    beats = [];
    for (let t = 0.25; t < frameTime(Math.max(0, n - 1)); t += 0.5) beats.push(t);
    downbeats = [];
    for (let i = 0; i < beats.length; i += 4) downbeats.push(i);
  }
  const nb = beats.length;
  const period = (j: number) => (j + 1 < nb ? beats[j + 1] - beats[j] : j > 0 ? beats[j] - beats[j - 1] : 0.5);
  const act = beats.map((t, j) => {
    const a = Math.max(0, toFrame(t));
    const b = Math.min(n, Math.max(a + 1, toFrame(t + period(j))));
    let c = 0;
    for (let i = a; i < b; i++) c += active[i];
    return b > a && c * 2 >= b - a;
  });
  const activeBeats = act.map((a, j) => (a ? j : -1)).filter((j) => j >= 0);
  const peakNear = (x: Float32Array, t: number) => {
    const c = toFrame(t);
    let m = 0;
    for (let i = Math.max(0, c - 1); i <= Math.min(n - 1, c + 1); i++) if (x[i] > m) m = x[i];
    return m;
  };

  /** [beat][slot] prominence of x: peak around each 16th slot minus x's median over the surrounding ~2 bars. */
  const typical = nb > 1 ? median(beats.slice(1).map((t, j) => t - beats[j])) : 0.5;
  const halfWin = Math.max(20, Math.min(200, Math.round(4 * typical * FRAME_RATE)));
  const slots = (x: Float32Array): Float64Array[] => {
    const med = runningMedian(x, halfWin);
    return beats.map((t, j) => {
      const base = med[Math.min(med.length - 1, Math.max(0, Math.round(toFrame(t + period(j) / 2) / MED_STEP)))];
      const v = new Float64Array(4);
      for (let q = 0; q < 4; q++) v[q] = Math.max(0, peakNear(x, t + (q * period(j)) / 4) - base);
      return v;
    });
  };
  const K = slots(kick);
  const MJ = slots(midJ);
  const HJ = slots(highJ);
  const SN = slots(snare);
  const HT = slots(hat);
  const maxOf = (x: Float64Array) => Math.max(x[0], x[1], x[2], x[3]);
  const beatMean = (g: (j: number) => number) => mean(activeBeats.map(g));

  // Grid locking: onset peaks on the 16th slots vs half-way between them.
  let on = 0;
  let off = 0;
  for (const j of activeBeats) {
    const p = period(j);
    for (let q = 0; q < 4; q++) {
      on += peakNear(onset, beats[j] + (q * p) / 4);
      off += peakNear(onset, beats[j] + ((q + 0.5) * p) / 4);
    }
  }

  // Bars (4/4 only, all beats active): four-on-the-floor; snare per beat of the bar.
  const ff: number[] = [];
  const bars: number[][] = [];
  for (let d = 0; d < downbeats.length; d++) {
    const j0 = downbeats[d];
    const j1 = d + 1 < downbeats.length ? downbeats[d + 1] : j0 + 4;
    if (j1 - j0 !== 4 || j1 > nb) continue;
    let ok = true;
    for (let j = j0; j < j1; j++) ok &&= act[j];
    if (!ok) continue;
    const onK = [0, 1, 2, 3].map((q) => K[j0 + q][0]);
    const offK = [0, 1, 2, 3].map((q) => Math.max(K[j0 + q][2], 0.5 * (K[j0 + q][1] + K[j0 + q][3])));
    // Every beat needs a kick of similar weight (a snare's low end on 2 and 4 is not a kick).
    const lo = Math.min(...onK);
    ff.push(clamp01((lo - 0.5 * mean(offK)) / 0.3) * ramp(lo / Math.max(1e-9, median(onK)), 0.3, 0.6));
    bars.push([...[0, 1, 2, 3].map((q) => SN[j0 + q][0]), ...onK]);
  }
  // Half-time: in each 8-bar window, the beat of the bar with the most snare, by how much it
  // beats every other beat, discounted when it is also where the kick lands (that is a
  // downbeat accent: the "1" with its kick and chord change, not a backbeat).
  const halfW: number[] = [];
  for (let w = 0; w + 4 <= bars.length; w += 8) {
    const seg = bars.slice(w, w + 8);
    const avg = [0, 1, 2, 3, 4, 5, 6, 7].map((q) => mean(seg.map((b) => b[q])));
    const S = avg.slice(0, 4);
    const Kq = avg.slice(4);
    let top = 0;
    for (let q = 1; q < 4; q++) if (S[q] > S[top]) top = q;
    const margin = S[top] - Math.max(...S.filter((_, q) => q !== top));
    const kMax = Math.max(...Kq);
    halfW.push(margin * (kMax > 1e-6 ? 1 - Kq[top] / kMax : 1));
  }

  // Swing: beat-relative profile of snare + hat activity (48 bins per beat).
  const BINS = 48;
  const acc = new Float64Array(BINS);
  const cnt = new Float64Array(BINS);
  for (const j of activeBeats) {
    const p = period(j);
    const a = Math.max(0, toFrame(beats[j]) - 1);
    const b = Math.min(n, toFrame(beats[j] + p) + 1);
    for (let i = a; i < b; i++) {
      const pos = (frameTime(i) - beats[j]) / p;
      if (pos < 0 || pos >= 1) continue;
      const bin = Math.min(BINS - 1, Math.floor(pos * BINS));
      acc[bin] += 0.5 * (snare[i] + hat[i]);
      cnt[bin]++;
    }
  }
  const raw = Array.from(acc, (v, i) => (cnt[i] ? v / cnt[i] : 0));
  const prof = raw.map((_, i) => 0.25 * raw[(i + BINS - 1) % BINS] + 0.5 * raw[i] + 0.25 * raw[(i + 1) % BINS]);
  const profMed = median(prof);
  let offPos = 0.5;
  let offStrength = 0;
  let best = -Infinity;
  for (let i = Math.round(0.4 * BINS); i < Math.round(0.73 * BINS); i++) {
    if (prof[i] > prof[i - 1] && prof[i] >= prof[i + 1] && prof[i] > best) {
      best = prof[i];
      const [y0, y1, y2] = [prof[i - 1], prof[i], prof[i + 1]];
      const den = y0 - 2 * y1 + y2;
      const delta = den < 0 ? (0.5 * (y0 - y2)) / den : 0;
      offPos = (i + 0.5 + Math.max(-0.5, Math.min(0.5, delta))) / BINS;
      offStrength = prof[i] - profMed;
    }
  }

  // Syncopation: accents per 16th slot summed over beats, background (the weakest slot) removed.
  const sync = (X: Float64Array[]) => {
    const A = new Float64Array(4);
    for (const j of activeBeats) for (let q = 0; q < 4; q++) A[q] += X[j][q];
    const lo = Math.min(A[0], A[1], A[2], A[3]);
    const B = Array.from(A, (v) => v - lo);
    const sum = B[0] + B[1] + B[2] + B[3];
    return sum > 1e-9 ? (B[1] + B[3] + 0.5 * B[2]) / sum : 0;
  };

  // Strong broadband onsets per active second (peaks over a 1 s running median, >= 70 ms apart).
  const scaled = onset.map((v) => v / 1.5); // onset is 0..1.5
  const onsetMed = runningMedian(scaled, Math.round(FRAME_RATE));
  let onsets = 0;
  let last = -10;
  for (let i = 1; i + 1 < n; i++) {
    if (!active[i]) continue;
    const base = 1.5 * onsetMed[Math.round(i / MED_STEP)];
    if (onset[i] > onset[i - 1] && onset[i] >= onset[i + 1] && onset[i] - base > ONSET_PROMINENCE && i - last >= 3) {
      onsets++;
      last = i;
    }
  }

  // Spectrum over active frames: sub-bass share, 1-5 kHz flatness and fill, mean chroma.
  let pSub = 0;
  let pAll = 0;
  const flat: number[] = [];
  const fill: number[] = [];
  const chroma = new Float64Array(12);
  for (let i = 0; i < n; i++) {
    if (!active[i]) continue;
    const row = i * NUM_BANDS;
    for (let k = 0; k < NUM_BANDS; k++) {
      const p = Math.pow(10, f.bands[row + k] / 10);
      pAll += p;
      if (k < 2) pSub += p; // 40 - 102 Hz
    }
    const t = i * TRAIT_DIMS;
    flat.push(f.trait[t + TR_FLAT]);
    fill.push(f.trait[t + TR_FILL]);
    let cs = 0;
    for (let k = 0; k < 12; k++) cs += f.trait[t + TR_CHROMA + k];
    if (cs > 1e-9) for (let k = 0; k < 12; k++) chroma[k] += f.trait[t + TR_CHROMA + k] / cs;
  }

  return {
    seconds,
    grid: hasGrid,
    kick: beatMean((j) => maxOf(K[j])),
    midRise: beatMean((j) => maxOf(MJ[j])),
    highRise: beatMean((j) => maxOf(HJ[j])),
    gridLock: on + off > 0 ? on / (on + off) : 0.5,
    hatDensity: beatMean((j) => HT[j].reduce((c, v) => c + (v > HIT_HAT ? 1 : 0), 0) / 4),
    onsetRate: seconds > 0 ? onsets / seconds : 0,
    fourFloor: mean(ff),
    half: mean(halfW),
    offPos,
    offStrength,
    syncKick: sync(K),
    syncSnare: sync(SN),
    subDb: pAll > 0 ? 10 * Math.log10(pSub / pAll + 1e-12) : -60,
    flatness: quantile(flat, 0.25),
    fill: quantile(fill, 0.25),
    modeDiff: keyModeDiff(chroma),
  };
}

/** Krumhansl-Kessler key profiles (C major / C minor). */
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Correlation of chroma rotated by `shift` with a key profile. */
function corr(a: ArrayLike<number>, b: ArrayLike<number>, shift: number): number {
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let k = 0; k < 12; k++) {
    const x = a[(k + shift) % 12] - ma;
    const y = b[k] - mb;
    sab += x * y;
    saa += x * x;
    sbb += y * y;
  }
  return saa > 1e-12 && sbb > 1e-12 ? sab / Math.sqrt(saa * sbb) : 0;
}

/** Best minor-key correlation minus best major-key correlation of a mean chroma vector. */
function keyModeDiff(chroma: ArrayLike<number>): number {
  let bMaj = -1;
  let bMin = -1;
  for (let s = 0; s < 12; s++) {
    bMaj = Math.max(bMaj, corr(chroma, MAJOR, s));
    bMin = Math.max(bMin, corr(chroma, MINOR, s));
  }
  return bMin - bMaj;
}
