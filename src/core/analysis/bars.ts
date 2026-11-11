/**
 * Per-bar readings for the choreographer: how loud, how bassy and how much
 * the groove changes in each bar, plus where the drops are.
 *
 * One reading per downbeat: bar k runs from downbeat k to downbeat k + 1
 * (the last bar is one typical bar long, clipped to the song). Every reading
 * is 0..1:
 *
 *  - energy: overall intensity relative within the song (the per-bar value
 *            section energy is averaged from: loudness, bass, onset activity,
 *            kick / hat flux, top-band level).
 *  - bass:   level below 200 Hz relative within the song (contrast shrunk
 *            toward the middle when the low end barely moves).
 *  - change: how new the bar's groove is: 1 - its best rhythmic + timbral
 *            match with the previous 1, 2 or 4 bars. Absolute: a loop that
 *            keeps repeating reads low, a song that keeps switching beats
 *            reads high (near-silent bars count half).
 *  - drops:  bar indices where a quiet or stripped-back passage gives way to
 *            a sudden, sustained jump in energy and bass (an EDM drop, a band
 *            kicking in after a break).
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import { HOP, SAMPLE_RATE, type Features } from './onset';
import { barFeatures, barIntensity, percentile, sortedCopy, type Bar } from './sections';

export interface BarValues {
  energy: number[];
  bass: number[];
  change: number[];
  /** Bar indices (into the downbeats) where a drop starts. */
  drops: number[];
}

export interface BarInput {
  features: Features;
  envelope: Float32Array;
  beats: ArrayLike<number>;
  downbeats: ArrayLike<number>;
  duration: number;
}

/** Sub-bar steps of the rhythm pattern (16th notes in 4/4). */
const STEPS = 16;
/** Fewer bars than this: no readings (the generator falls back to section energy). */
const MIN_READING_BARS = 4;
/** Drop: bass rise (dB) over 4 bars, and its step right at the drop bar. */
const DROP_LOW_JUMP = 5;
const DROP_LOW_STEP = 3;
/** Low-band spread (dB, 5th..95th percentile) that gets the full bass contrast. */
const BASS_FULL_SPREAD = 6;

const toFrame = (t: number) => Math.round((t * SAMPLE_RATE) / HOP);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Map values onto 0..1 through the song's p-th .. (1-p)-th percentile range. */
function relative(x: number[], p = 0.05, minSpread = 1e-6): number[] {
  const s = sortedCopy(x);
  const lo = percentile(s, p);
  const hi = percentile(s, 1 - p);
  const spread = hi - lo;
  if (!(spread > minSpread)) return x.map(() => 0.5);
  return x.map((v) => clamp01((v - lo) / spread));
}

/** Unit-length rhythm vector of a bar: STEPS steps x (low, mid + high) flux maxima. */
function barPattern(f: Features, start: number, end: number): Float64Array {
  const rhythm = new Float64Array(2 * STEPS);
  const a = Math.max(0, toFrame(start));
  const b = Math.min(f.frames, Math.max(a + 1, toFrame(end)));
  const n = b - a;
  for (let i = a; i < b; i++) {
    const s = Math.min(STEPS - 1, Math.floor(((i - a) * STEPS) / Math.max(1, n)));
    rhythm[s] = Math.max(rhythm[s], f.fluxLow[i]);
    rhythm[STEPS + s] = Math.max(rhythm[STEPS + s], 0.6 * f.fluxMid[i] + 0.4 * f.fluxHigh[i]);
  }
  let ss = 0;
  for (let k = 0; k < rhythm.length; k++) ss += rhythm[k] * rhythm[k];
  const inv = ss > 1e-12 ? 1 / Math.sqrt(ss) : 0;
  for (let k = 0; k < rhythm.length; k++) rhythm[k] *= inv;
  return rhythm;
}

const dot = (x: Float64Array, y: Float64Array) => {
  let s = 0;
  for (let k = 0; k < x.length; k++) s += x[k] * y[k];
  return s;
};

/** Timbre vector of a bar: band levels relative to their mean (dB), unit length. */
function timbre(bar: Bar): Float64Array {
  const n = bar.bands.length;
  let m = 0;
  for (let k = 0; k < n; k++) m += bar.bands[k] / n;
  const v = new Float64Array(n);
  for (let k = 0; k < n; k++) v[k] = bar.bands[k] - m;
  return v;
}

/** Per-bar readings, or undefined when there are too few bars. */
export function barReadings(input: BarInput): BarValues | undefined {
  const { features: f, envelope: env, beats, downbeats, duration } = input;
  const nb = downbeats.length;
  if (nb < MIN_READING_BARS || f.frames === 0) return undefined;
  const times: number[] = [];
  for (let k = 0; k < nb; k++) times.push(beats[downbeats[k]]);
  const lens: number[] = [];
  for (let k = 1; k < nb; k++) lens.push(times[k] - times[k - 1]);
  const typical = percentile(sortedCopy(lens), 0.5);
  const bars: Bar[] = [];
  const pats: Float64Array[] = [];
  for (let k = 0; k < nb; k++) {
    const s = times[k];
    const e = k + 1 < nb ? times[k + 1] : Math.min(duration, s + typical);
    const end = e > s ? e : s + Math.max(0.05, typical);
    bars.push(barFeatures(f, env, s, end));
    pats.push(barPattern(f, s, end));
  }

  const energy = barIntensity(bars);

  // Bass: relative level below 200 Hz; a low end that moves less than
  // BASS_FULL_SPREAD dB over the song keeps part of its contrast only.
  const lows = bars.map((b) => b.low);
  const lowRel = relative(lows);
  const ls = sortedCopy(lows);
  const alpha = clamp01((percentile(ls, 0.95) - percentile(ls, 0.05)) / BASS_FULL_SPREAD);
  const bass = bars.map((b, k) => (b.loud < -70 ? 0 : alpha * lowRel[k] + (1 - alpha) * 0.6));

  // Change: 1 - best match with the previous 1 / 2 / 4 bars (rhythm and
  // timbre), scaled up so a typical repeat reads ~0.3; halved in near-silent
  // bars, whose rhythm pattern is mostly noise.
  const tim = bars.map(timbre);
  const timScale = 6; // dB distance that counts as a full change
  const change = bars.map((_, k) => {
    if (k === 0) return 0;
    let best = 0;
    for (const lag of [1, 2, 4]) {
      const j = k - lag;
      if (j < 0) continue;
      const r = dot(pats[k], pats[j]);
      let d = 0;
      for (let q = 0; q < tim[k].length; q++) d += (tim[k][q] - tim[j][q]) ** 2;
      const t = 1 - Math.min(1, Math.sqrt(d / tim[k].length) / timScale);
      best = Math.max(best, 0.65 * r + 0.35 * t);
    }
    const quiet = 0.5 + 0.5 * clamp01(energy[k] / 0.25);
    return clamp01((1 - best) * 2.5 * quiet);
  });

  const drops = findDrops(bars, energy);
  return { energy, bass, change, drops };
}

/**
 * Drops: bar k where the low end comes in hard and stays: the 4 bars from k
 * on have at least DROP_LOW_JUMP dB more bass than the 4 before, with a step
 * of DROP_LOW_STEP dB right at k, and they are loud (energy >= 0.6) and
 * louder than before (in energy or in dB). A noisy build (snare rolls,
 * risers) may read as energetic; it is the bass entry that marks the drop.
 * At most one per 8 bars (the strongest).
 */
function findDrops(bars: Bar[], energy: number[]): number[] {
  const n = bars.length;
  const mean = (a: number, b: number, g: (j: number) => number) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, a); j < Math.min(n, b); j++) (s += g(j)), c++;
    return c ? s / c : 0;
  };
  const cands: { k: number; score: number }[] = [];
  for (let k = 2; k + 2 <= n; k++) {
    const postE = mean(k, k + 4, (j) => energy[j]);
    const jumpE = postE - mean(k - 4, k, (j) => energy[j]);
    const jumpLow = mean(k, k + 4, (j) => bars[j].low) - mean(k - 4, k, (j) => bars[j].low);
    const step = bars[k].low - mean(k - 2, k, (j) => bars[j].low);
    const jumpLoud = mean(k, k + 4, (j) => bars[j].loud) - mean(k - 4, k, (j) => bars[j].loud);
    if (postE >= 0.6 && jumpLow >= DROP_LOW_JUMP && step >= DROP_LOW_STEP && (jumpE >= 0.2 || jumpLoud >= 2)) {
      cands.push({ k, score: jumpLow / 6 + step / 6 + Math.max(0, jumpE) });
    }
  }
  cands.sort((x, y) => y.score - x.score);
  const out: number[] = [];
  for (const c of cands) if (out.every((k) => Math.abs(k - c.k) >= 8)) out.push(c.k);
  return out.sort((x, y) => x - y);
}
