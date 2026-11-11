/**
 * Section segmentation (intro / verse / chorus / drop / outro).
 *
 * Deliberately simple and stable: bar-level loudness and spectral shape,
 * a novelty curve comparing the 4 bars before and after each bar line,
 * greedy peak picking with a minimum section length of 4 bars, merging of
 * neighbours with similar energy, then energy-based labels. Boundaries are
 * always downbeat times; sections are contiguous from 0 to the duration.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import type { Section, SectionType } from './beatmap';
import { NUM_BANDS, SAMPLE_RATE, HOP, type Features } from './onset';

const MIN_BARS = 4;
const NOVELTY_WINDOW = 4;
const MIN_NOVELTY_DB = 2.5;
const MERGE_ENERGY_DELTA = 0.1;
const HIGH = 0.6;

export interface SectionInput {
  features: Features;
  /** Normalised onset envelope for the same frames. */
  envelope: Float32Array;
  /** Beat times in seconds, on the features' timeline. */
  beats: ArrayLike<number>;
  /** Indices into `beats`. */
  downbeats: ArrayLike<number>;
  /** Total length to cover, seconds. */
  duration: number;
}

interface Bar {
  start: number; // seconds
  end: number;
  loud: number; // dB
  low: number; // dB
  act: number;
  bands: Float64Array;
}

const toFrame = (t: number) => Math.round((t * SAMPLE_RATE) / HOP);

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const x = p * (sorted.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  return i + 1 < sorted.length ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function barFeatures(f: Features, env: Float32Array, start: number, end: number): Bar {
  const a = Math.max(0, Math.min(f.frames - 1, toFrame(start)));
  const b = Math.max(a + 1, Math.min(f.frames, toFrame(end)));
  let p = 0;
  let pl = 0;
  let act = 0;
  const bands = new Float64Array(NUM_BANDS);
  for (let i = a; i < b; i++) {
    p += Math.pow(10, f.energyDb[i] / 10);
    pl += Math.pow(10, f.lowDb[i] / 10);
    act += env[i] ?? 0;
    for (let k = 0; k < NUM_BANDS; k++) bands[k] += Math.max(-80, f.bands[i * NUM_BANDS + k]);
  }
  const n = b - a;
  for (let k = 0; k < NUM_BANDS; k++) bands[k] /= n;
  return {
    start,
    end,
    loud: Math.max(-100, 10 * Math.log10(p / n + 1e-12)),
    low: Math.max(-100, 10 * Math.log10(pl / n + 1e-12)),
    act: act / n,
    bands,
  };
}

/** Per-bar energy 0..1: mostly loudness relative to the song, a little onset activity. */
function barEnergies(bars: Bar[]): number[] {
  const loud = bars.map((b) => b.loud).sort((x, y) => x - y);
  const p10 = percentile(loud, 0.1);
  const p90 = percentile(loud, 0.9);
  const spread = p90 - p10;
  const acts = bars.map((b) => b.act).sort((x, y) => x - y);
  const a90 = percentile(acts, 0.9);
  return bars.map((b) => {
    const rel = spread > 1e-6 ? clamp01((b.loud - p10) / spread) : 0.5;
    // Low-contrast songs: shrink towards a neutral 0.5 instead of exaggerating tiny differences.
    const alpha = clamp01(spread / 6);
    const eLoud = alpha * rel + (1 - alpha) * 0.5;
    const eAct = a90 > 0 ? clamp01(b.act / a90) : 0;
    const silent = b.loud < -70 ? 0 : 1;
    return silent * clamp01(0.8 * eLoud + 0.2 * eAct);
  });
}

export function segmentSections(input: SectionInput): Section[] {
  const { features: f, envelope: env, beats, downbeats, duration } = input;
  if (!(duration > 0)) return [];
  const dbTimes: number[] = [];
  for (let i = 0; i < downbeats.length; i++) {
    const t = beats[downbeats[i]];
    if (t > 0 && t < duration && (dbTimes.length === 0 || t > dbTimes[dbTimes.length - 1])) dbTimes.push(t);
  }
  const whole = (): Section[] => {
    const bar = barFeatures(f, env, 0, duration);
    const e = f.frames > 0 ? (bar.loud < -70 ? 0 : 0.5) : 0;
    return [{ start: 0, end: duration, type: 'verse', energy: e }];
  };
  if (f.frames === 0 || dbTimes.length < 2 * MIN_BARS) return whole();

  // Bars: [db_j, db_{j+1}); the last bar runs to the duration. The pickup
  // before the first downbeat is folded into the first section later.
  const bars: Bar[] = [];
  for (let j = 0; j < dbTimes.length; j++) {
    const s = dbTimes[j];
    const e = j + 1 < dbTimes.length ? dbTimes[j + 1] : duration;
    if (e > s) bars.push(barFeatures(f, env, s, e));
  }
  const B = bars.length;
  if (B < 2 * MIN_BARS) return whole();
  const energy = barEnergies(bars);

  // Novelty at each bar line j (between bar j-1 and bar j).
  const nov = new Float64Array(B);
  for (let j = 1; j < B; j++) {
    const w = Math.min(NOVELTY_WINDOW, j, B - j);
    let l1 = 0;
    let l2 = 0;
    const b1 = new Float64Array(NUM_BANDS);
    const b2 = new Float64Array(NUM_BANDS);
    for (let k = j - w; k < j; k++) {
      l1 += bars[k].loud;
      for (let q = 0; q < NUM_BANDS; q++) b1[q] += bars[k].bands[q];
    }
    for (let k = j; k < j + w; k++) {
      l2 += bars[k].loud;
      for (let q = 0; q < NUM_BANDS; q++) b2[q] += bars[k].bands[q];
    }
    let d = 0;
    for (let q = 0; q < NUM_BANDS; q++) d += ((b2[q] - b1[q]) / w) ** 2;
    nov[j] = Math.abs(l2 - l1) / w + 0.5 * Math.sqrt(d / NUM_BANDS);
  }
  let maxNov = 0;
  for (let j = 1; j < B; j++) maxNov = Math.max(maxNov, nov[j]);
  const thr = Math.max(MIN_NOVELTY_DB, 0.3 * maxNov);
  const cands: number[] = [];
  for (let j = MIN_BARS; j <= B - MIN_BARS; j++) {
    if (nov[j] >= thr && nov[j] >= nov[j - 1] && (j + 1 >= B || nov[j] >= nov[j + 1])) cands.push(j);
  }
  cands.sort((a, b) => nov[b] - nov[a] || a - b);
  const chosen: number[] = [];
  for (const c of cands) {
    if (chosen.every((x) => Math.abs(x - c) >= MIN_BARS)) chosen.push(c);
  }
  chosen.sort((a, b) => a - b);

  // Bar ranges -> segments with mean energy.
  interface Seg {
    a: number; // first bar
    b: number; // one past last bar
    e: number;
    low: number;
    loud: number;
  }
  const bounds = [0, ...chosen, B];
  let segs: Seg[] = [];
  for (let k = 0; k + 1 < bounds.length; k++) segs.push(makeSeg(bounds[k], bounds[k + 1]));
  function makeSeg(a: number, b: number): Seg {
    let e = 0;
    let low = 0;
    let loud = 0;
    let w = 0;
    for (let j = a; j < b; j++) {
      const len = bars[j].end - bars[j].start;
      e += energy[j] * len;
      low += bars[j].low * len;
      loud += bars[j].loud * len;
      w += len;
    }
    return { a, b, e: e / w, low: low / w, loud: loud / w };
  }
  // Merge neighbours with similar energy (keeps labels stable).
  let merged = true;
  while (merged && segs.length > 1) {
    merged = false;
    let bestK = -1;
    let bestD = Infinity;
    for (let k = 0; k + 1 < segs.length; k++) {
      const d = Math.abs(segs[k].e - segs[k + 1].e);
      if (d < MERGE_ENERGY_DELTA && d < bestD) {
        bestD = d;
        bestK = k;
      }
    }
    if (bestK >= 0) {
      const m = makeSeg(segs[bestK].a, segs[bestK + 1].b);
      segs = [...segs.slice(0, bestK), m, ...segs.slice(bestK + 2)];
      merged = true;
    }
  }

  // Labels.
  const types: SectionType[] = segs.map((s) => (s.e >= HIGH ? 'chorus' : 'verse'));
  if (segs.length > 1) {
    const maxE = Math.max(...segs.map((s) => s.e));
    if (types[0] !== 'chorus' && maxE >= segs[0].e + 0.15) types[0] = 'intro';
    const L = segs.length - 1;
    if (types[L] !== 'chorus' && maxE >= segs[L].e + 0.15) types[L] = 'outro';
    // Drop: a loud, bass-heavy section entered from a much quieter one.
    const loudSegs = segs.filter((s) => s.e >= HIGH);
    const meanShare = loudSegs.length ? loudSegs.reduce((a, s) => a + (s.low - s.loud), 0) / loudSegs.length : 0;
    for (let k = 1; k < segs.length; k++) {
      const s = segs[k];
      if (types[k] !== 'chorus') continue;
      const share = s.low - s.loud;
      if (s.e >= 0.75 && segs[k - 1].e <= 0.3 && share >= meanShare - 0.5 && share > -6) types[k] = 'drop';
    }
  }

  const out: Section[] = segs.map((s, k) => ({
    start: k === 0 ? 0 : bars[s.a].start,
    end: k === segs.length - 1 ? duration : bars[s.b].start,
    type: types[k],
    energy: Math.round(clamp01(s.e) * 1000) / 1000,
  }));
  return out;
}
