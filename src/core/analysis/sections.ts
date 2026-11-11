/**
 * Section segmentation (intro / verse / chorus / drop / outro), built for
 * real, heavily compressed pop masters where loudness alone barely changes.
 *
 * 1. Bar-synchronous features (bars = downbeat to downbeat): half-bar chroma
 *    (harmony), spectral shape (timbre / instrumentation) and an intensity
 *    descriptor (loudness, bass, onset activity, hats/cymbals), all relative
 *    to the song (z-scores, percentiles), never absolute levels.
 * 2. A bar self-similarity matrix S (chroma + timbre cosine similarity).
 * 3. Boundary novelty at every bar line: change of the mean chroma, mean
 *    timbre and mean intensity between the 2 / 4 bars before and after, plus
 *    the change of each bar's repetition profile (its row of a path-enhanced
 *    S: bars of the same section relate to the rest of the song the same way).
 * 4. Dynamic programming picks the boundaries: sum of novelty minus a cost per
 *    boundary, plus a phrase-length prior (16 or 8 bars best, multiples of 4
 *    next). With no evidence at all this degrades into a regular 8/16-bar
 *    phrase grid instead of one section.
 * 5. Segments are compared along the diagonals of S and clustered (average
 *    linkage). The recurring cluster (2+ segments) with the highest relative
 *    intensity is the chorus, with mild pop-form priors (the last full-energy
 *    section is usually a chorus, the first one usually a verse). Intro /
 *    outro come from position plus lower intensity, drop from a big entry
 *    after a breakdown with strong bass. Neighbours with the same label are
 *    merged; a long song that still ends up as one label alternates verse /
 *    chorus over the phrase grid.
 *
 * Boundaries are always downbeat times; sections are contiguous from 0 to
 * the duration; `energy` is 0..1 relative within the song.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import type { Section, SectionType } from './beatmap';
import { HOP, NUM_BANDS, NUM_CHROMA, SAMPLE_RATE, type Features } from './onset';

const MIN_BARS = 4;
const MAX_BARS = 32;
/** Below this length (s) a single section is acceptable. */
const SHORT_SONG_SECONDS = 40;
/** Bar length (s) assumed for the time grid when there are no beats. */
const FALLBACK_BAR_SECONDS = 2;

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
  act: number; // mean onset envelope
  kick: number; // mean low-band flux
  hat: number; // mean high-band flux
  air: number; // dB, level of the top bands
  bands: Float64Array; // NUM_BANDS mean dB
  chroma: Float64Array; // 2 * NUM_CHROMA (two half bars), each half sums to 1
}

const toFrame = (t: number) => Math.round((t * SAMPLE_RATE) / HOP);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function percentile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const x = p * (n - 1);
  const i = Math.floor(x);
  const f = x - i;
  return i + 1 < n ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i];
}

function sortedCopy(x: ArrayLike<number>): Float64Array {
  return Float64Array.from(x).sort();
}

function barFeatures(f: Features, env: Float32Array, start: number, end: number): Bar {
  const a = Math.max(0, Math.min(f.frames - 1, toFrame(start)));
  const b = Math.max(a + 1, Math.min(f.frames, toFrame(end)));
  const mid = Math.max(a + 1, Math.min(b - 1, Math.round((a + b) / 2)));
  let p = 0;
  let pl = 0;
  let act = 0;
  let kick = 0;
  let hat = 0;
  const bands = new Float64Array(NUM_BANDS);
  const chroma = new Float64Array(2 * NUM_CHROMA);
  for (let i = a; i < b; i++) {
    p += Math.pow(10, f.energyDb[i] / 10);
    pl += Math.pow(10, f.lowDb[i] / 10);
    act += env[i] ?? 0;
    kick += f.fluxLow[i];
    hat += f.fluxHigh[i];
    for (let k = 0; k < NUM_BANDS; k++) bands[k] += Math.max(-80, f.bands[i * NUM_BANDS + k]);
    const off = i < mid ? 0 : NUM_CHROMA;
    for (let k = 0; k < NUM_CHROMA; k++) chroma[off + k] += f.chroma[i * NUM_CHROMA + k];
  }
  const n = b - a;
  for (let k = 0; k < NUM_BANDS; k++) bands[k] /= n;
  for (const off of [0, NUM_CHROMA]) {
    let s = 0;
    for (let k = 0; k < NUM_CHROMA; k++) s += chroma[off + k];
    for (let k = 0; k < NUM_CHROMA; k++) chroma[off + k] = s > 1e-9 ? chroma[off + k] / s : 1 / NUM_CHROMA;
  }
  const air = (bands[NUM_BANDS - 1] + bands[NUM_BANDS - 2] + bands[NUM_BANDS - 3]) / 3;
  return {
    start,
    end,
    loud: Math.max(-100, 10 * Math.log10(p / n + 1e-12)),
    low: Math.max(-100, 10 * Math.log10(pl / n + 1e-12)),
    act: act / n,
    kick: kick / n,
    hat: hat / n,
    air,
    bands,
    chroma,
  };
}

/** Robust z-score (median / IQR-based scale) of each value within the song. */
function robustZ(x: number[], minScale: number): number[] {
  const s = sortedCopy(x);
  const med = percentile(s, 0.5);
  const iqr = percentile(s, 0.75) - percentile(s, 0.25);
  const scale = Math.max(minScale, iqr / 1.35);
  return x.map((v) => (v - med) / scale);
}

/**
 * Per-bar intensity 0..1, relative within the song: loudness, bass level,
 * onset activity, kick and hat flux and top-band level, each as a robust
 * z-score, averaged, then mapped through the song's own 5th..95th percentile
 * range. Contrast is shrunk towards 0.5 when every cue is nearly flat, so a
 * uniform track does not get exaggerated differences. Silent bars are 0.
 */
function barIntensity(bars: Bar[]): number[] {
  const z = [
    { w: 0.3, v: robustZ(bars.map((b) => b.loud), 0.5) },
    { w: 0.15, v: robustZ(bars.map((b) => b.low), 0.75) },
    { w: 0.15, v: robustZ(bars.map((b) => b.act), 0.05) },
    { w: 0.15, v: robustZ(bars.map((b) => b.kick), 0.02) },
    { w: 0.1, v: robustZ(bars.map((b) => b.hat), 0.02) },
    { w: 0.15, v: robustZ(bars.map((b) => b.air), 0.75) },
  ];
  const comp = bars.map((_, j) => z.reduce((s, c) => s + c.w * Math.max(-4, Math.min(4, c.v[j])), 0));
  const s = sortedCopy(comp);
  const lo = percentile(s, 0.05);
  const hi = percentile(s, 0.95);
  const spread = hi - lo;
  // Contrast in dB-equivalent terms: how much the loudness actually moves.
  const loud = sortedCopy(bars.map((b) => b.loud));
  const loudSpread = percentile(loud, 0.9) - percentile(loud, 0.1);
  const alpha = clamp01(Math.max(spread / 1.5, loudSpread / 4));
  return bars.map((b, j) => {
    if (b.loud < -70) return 0;
    const rel = spread > 1e-6 ? clamp01((comp[j] - lo) / spread) : 0.5;
    return alpha * rel + (1 - alpha) * 0.5;
  });
}

function removeColumnMeans(rows: Float64Array[]): void {
  if (rows.length === 0) return;
  const d = rows[0].length;
  const mean = new Float64Array(d);
  for (const r of rows) for (let k = 0; k < d; k++) mean[k] += r[k] / rows.length;
  for (const r of rows) for (let k = 0; k < d; k++) r[k] -= mean[k];
}

/** Unit-length copy (zero vector stays zero), so cosine similarity is a dot product. */
function unit(r: Float64Array): Float64Array {
  let ss = 0;
  for (let k = 0; k < r.length; k++) ss += r[k] * r[k];
  const inv = ss > 1e-12 ? 1 / Math.sqrt(ss) : 0;
  return r.map((v) => v * inv);
}

function standardiseColumns(rows: Float64Array[]): void {
  if (rows.length === 0) return;
  const d = rows[0].length;
  for (let k = 0; k < d; k++) {
    let m = 0;
    for (const r of rows) m += r[k];
    m /= rows.length;
    let v = 0;
    for (const r of rows) v += (r[k] - m) ** 2;
    const sd = Math.sqrt(v / rows.length);
    for (const r of rows) r[k] = sd > 1e-9 ? (r[k] - m) / sd : 0;
  }
}

const dot = (a: Float64Array, b: Float64Array) => {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k] * b[k];
  return s;
};

interface BarVectors {
  /** Half-bar chroma distributions minus the song mean. */
  chroma: Float64Array[];
  /** Spectral shape + loudness / activity / kick, standardised per dimension. */
  timbre: Float64Array[];
}

function barVectors(bars: Bar[]): BarVectors {
  const chroma = bars.map((b) => Float64Array.from(b.chroma));
  removeColumnMeans(chroma);
  const timbre = bars.map((b) => {
    const v = new Float64Array(NUM_BANDS + 3);
    let m = 0;
    for (let k = 0; k < NUM_BANDS; k++) m += b.bands[k] / NUM_BANDS;
    for (let k = 0; k < NUM_BANDS; k++) v[k] = b.bands[k] - m;
    v[NUM_BANDS] = b.loud;
    v[NUM_BANDS + 1] = b.act;
    v[NUM_BANDS + 2] = b.kick;
    return v;
  });
  standardiseColumns(timbre);
  return { chroma, timbre };
}

/** Bar self-similarity (B x B, row-major): weighted chroma and timbre cosine similarity. */
function selfSimilarity(v: BarVectors): Float64Array {
  const B = v.chroma.length;
  const c = v.chroma.map(unit);
  const t = v.timbre.map(unit);
  const S = new Float64Array(B * B);
  for (let i = 0; i < B; i++) {
    for (let j = i; j < B; j++) {
      const x = 0.55 * dot(c[i], c[j]) + 0.45 * dot(t[i], t[j]);
      S[i * B + j] = x;
      S[j * B + i] = x;
    }
  }
  return S;
}

/**
 * Path-enhanced similarity: S averaged along the diagonal over bars -1..+2,
 * so repeated 4-bar sequences stand out and single-bar noise is suppressed.
 */
function enhance(S: Float64Array, B: number): Float64Array {
  const out = new Float64Array(B * B);
  for (let i = 0; i < B; i++) {
    for (let j = 0; j < B; j++) {
      let s = 0;
      let c = 0;
      for (let d = -1; d <= 2; d++) {
        const a = i + d;
        const b = j + d;
        if (a < 0 || b < 0 || a >= B || b >= B) continue;
        s += S[a * B + b];
        c++;
      }
      out[i * B + j] = s / c;
    }
  }
  return out;
}

/**
 * Block novelty at each bar line j: cosine distance between the mean vector
 * of the w bars before and the w bars after (w shrinks near the ends, min 2).
 * Averaging whole chord loops makes this far steadier than bar-to-bar change.
 */
function blockNovelty(rows: Float64Array[], w: number): Float64Array {
  const B = rows.length;
  const d = rows[0]?.length ?? 0;
  const nov = new Float64Array(B + 1);
  const l = new Float64Array(d);
  const r = new Float64Array(d);
  for (let j = 2; j <= B - 2; j++) {
    const ww = Math.min(w, j, B - j);
    l.fill(0);
    r.fill(0);
    for (let k = 1; k <= ww; k++) {
      const a = rows[j - k];
      const b = rows[j + k - 1];
      for (let q = 0; q < d; q++) {
        l[q] += a[q];
        r[q] += b[q];
      }
    }
    const nl = Math.sqrt(dot(l, l));
    const nr = Math.sqrt(dot(r, r));
    nov[j] = nl > 1e-12 && nr > 1e-12 ? 1 - dot(l, r) / (nl * nr) : 0;
  }
  return nov;
}

/** Scale to a 0..1 range using the 95th percentile (robust max). */
function normaliseNovelty(x: Float64Array): Float64Array {
  const s = sortedCopy(x);
  const top = percentile(s, 0.95);
  const out = new Float64Array(x.length);
  if (!(top > 1e-9)) return out;
  for (let i = 0; i < x.length; i++) out[i] = Math.min(1.5, x[i] / top);
  return out;
}

/** Phrase-length prior (log-score) for a segment of `len` bars. */
function lengthPrior(len: number, edge: boolean): number {
  let p: number;
  if (len === 16) p = 0;
  else if (len === 8) p = -0.05;
  else if (len === 12) p = -0.3;
  else if (len === 4) p = -0.4;
  else if (len === 24) p = -0.45;
  else if (len === 32) p = -0.8;
  else if (len % 4 === 0) p = -0.7;
  else if (len % 2 === 0) p = -0.85;
  else p = -1.2;
  // Intros / outros are often irregular (pickups, fades): soften the prior.
  return edge ? 0.5 * p : p;
}

const BOUNDARY_COST = 0.25;

/** Optimal boundaries (bar indices, including 0 and B) by dynamic programming. */
function dpSegment(nov: Float64Array, B: number): number[] {
  const best = new Float64Array(B + 1).fill(-Infinity);
  const from = new Int32Array(B + 1).fill(-1);
  best[0] = 0;
  for (let q = MIN_BARS; q <= B; q++) {
    const gain = q < B ? nov[q] - BOUNDARY_COST : 0;
    for (let len = MIN_BARS; len <= MAX_BARS && len <= q; len++) {
      const p = q - len;
      if (best[p] === -Infinity) continue;
      if (p > 0 && p < MIN_BARS) continue;
      const v = best[p] + lengthPrior(len, p === 0 || q === B) + gain;
      if (v > best[q]) {
        best[q] = v;
        from[q] = p;
      }
    }
  }
  if (best[B] === -Infinity) return [0, B];
  const out: number[] = [];
  for (let q = B; q > 0; q = from[q]) {
    out.push(q);
    if (from[q] < 0) break;
  }
  out.push(0);
  return out.reverse();
}

/** |mean intensity of the w bars after - the w bars before| at each bar line. */
function intensityChange(e: number[], w: number): Float64Array {
  const B = e.length;
  const out = new Float64Array(B + 1);
  for (let j = 1; j < B; j++) {
    const ww = Math.min(w, j, B - j);
    let l = 0;
    let r = 0;
    for (let k = 1; k <= ww; k++) {
      l += e[j - k];
      r += e[j + k - 1];
    }
    out[j] = Math.abs(r - l) / ww;
  }
  return out;
}

interface Seg {
  a: number; // first bar
  b: number; // one past the last bar
  e: number; // mean intensity 0..1
  bass: number; // low dB minus loudness dB
}

/** Similarity of two segments: best mean of S along an aligned diagonal (offset up to +-2 bars). */
function segmentSimilarity(S: Float64Array, B: number, x: Seg, y: Seg): number {
  const lx = x.b - x.a;
  const ly = y.b - y.a;
  let best = -Infinity;
  for (let o = -2; o <= 2; o++) {
    let s = 0;
    let c = 0;
    for (let t = 0; t < lx; t++) {
      const i = x.a + t;
      const j = y.a + t + o;
      if (j < y.a || j >= y.b) continue;
      s += S[i * B + j];
      c++;
    }
    // Require a substantial overlap (the shorter one mostly covered).
    if (c >= Math.max(MIN_BARS, 0.75 * Math.min(lx, ly))) best = Math.max(best, s / c);
  }
  return best;
}

export function segmentSections(input: SectionInput): Section[] {
  const { features: f, envelope: env, beats, downbeats, duration } = input;
  if (!(duration > 0)) return [];
  let dbTimes: number[] = [];
  for (let i = 0; i < downbeats.length; i++) {
    const t = beats[downbeats[i]];
    if (t > 0 && t < duration && (dbTimes.length === 0 || t > dbTimes[dbTimes.length - 1])) dbTimes.push(t);
  }
  const whole = (): Section[] => {
    const bar = barFeatures(f, env, 0, duration);
    const e = f.frames > 0 ? (bar.loud < -70 ? 0 : 0.5) : 0;
    return [{ start: 0, end: duration, type: 'verse', energy: e }];
  };
  if (f.frames === 0) return whole();
  if (dbTimes.length < 2 * MIN_BARS) {
    // No usable bar grid (no beat found). Long non-silent input still gets a
    // regular time grid so the song is not one section.
    if (duration < SHORT_SONG_SECONDS || barFeatures(f, env, 0, duration).loud < -70) return whole();
    dbTimes = [];
    for (let t = FALLBACK_BAR_SECONDS; t < duration - 0.5 * FALLBACK_BAR_SECONDS; t += FALLBACK_BAR_SECONDS) dbTimes.push(t);
  }

  // Bars: [db_j, db_{j+1}); the last bar runs to the duration. The pickup
  // before the first downbeat is folded into the first section.
  const bars: Bar[] = [];
  for (let j = 0; j < dbTimes.length; j++) {
    const s = dbTimes[j];
    const e = j + 1 < dbTimes.length ? dbTimes[j + 1] : duration;
    if (e > s) bars.push(barFeatures(f, env, s, e));
  }
  const B = bars.length;
  if (B < 2 * MIN_BARS) return whole();
  const intensity = barIntensity(bars);

  // Boundary novelty: harmony, timbre and intensity change between blocks of
  // 2 and of 4 bars.
  const vec = barVectors(bars);
  const S = selfSimilarity(vec);
  const both = (rows: Float64Array[]) => {
    const a = blockNovelty(rows, 2);
    const b = blockNovelty(rows, 4);
    return normaliseNovelty(a.map((x, j) => 0.5 * x + 0.5 * b[j]));
  };
  const cn = both(vec.chroma);
  const tn = both(vec.timbre);
  const e4 = intensityChange(intensity, 4);
  const e8 = intensityChange(intensity, 8);
  const en = normaliseNovelty(e4.map((x, j) => 0.6 * x + 0.4 * e8[j]));
  // Repetition profile: each bar's similarity to every other bar. Bars of the
  // same section relate to the rest of the song in the same way.
  const Se = enhance(S, B);
  const profile: Float64Array[] = [];
  for (let i = 0; i < B; i++) profile.push(Se.slice(i * B, (i + 1) * B));
  removeColumnMeans(profile);
  const rn = both(profile);
  const nov = new Float64Array(B + 1);
  for (let j = 1; j < B; j++) nov[j] = 0.25 * cn[j] + 0.2 * tn[j] + 0.2 * en[j] + 0.35 * rn[j];
  // Sharpen: a bar line only counts with its full value at a local maximum.
  const peak = new Float64Array(B + 1);
  for (let j = 1; j < B; j++) {
    const isMax = nov[j] >= nov[j - 1] && nov[j] >= nov[j + 1];
    peak[j] = isMax ? nov[j] : 0.5 * nov[j];
  }

  const bounds = dpSegment(peak, B);
  const segs: Seg[] = [];
  for (let k = 0; k + 1 < bounds.length; k++) segs.push(makeSeg(bounds[k], bounds[k + 1]));
  function makeSeg(a: number, b: number): Seg {
    let e = 0;
    let bass = 0;
    let w = 0;
    for (let j = a; j < b; j++) {
      const len = bars[j].end - bars[j].start;
      e += intensity[j] * len;
      bass += (bars[j].low - bars[j].loud) * len;
      w += len;
    }
    return { a, b, e: e / w, bass: bass / w };
  }

  const types = labelSegments(segs, S, B);

  // A long song must not come back as one section: alternate verse / chorus
  // over the phrase grid (more intense half of each pair = chorus).
  if (segs.length > 1 && types.every((t) => t === types[0]) && duration >= SHORT_SONG_SECONDS) {
    for (let k = 0; k < segs.length; k++) types[k] = k % 2 === 1 ? 'chorus' : 'verse';
    for (let k = 0; k + 1 < segs.length; k += 2) {
      if (segs[k].e > segs[k + 1].e + 0.05) {
        types[k] = 'chorus';
        types[k + 1] = 'verse';
      }
    }
  }

  // Merge neighbours with the same label.
  const outSegs: { seg: Seg; type: SectionType }[] = [];
  for (let k = 0; k < segs.length; k++) {
    const last = outSegs[outSegs.length - 1];
    if (last && last.type === types[k]) last.seg = makeSeg(last.seg.a, segs[k].b);
    else outSegs.push({ seg: segs[k], type: types[k] });
  }
  return outSegs.map(({ seg, type }, k) => ({
    start: k === 0 ? 0 : bars[seg.a].start,
    end: k === outSegs.length - 1 ? duration : bars[seg.b].start,
    type,
    energy: Math.round(clamp01(seg.e) * 1000) / 1000,
  }));
}

/** Chorus = the recurring, most intense passage; then intro / outro / drop by position and intensity. */
function labelSegments(segs: Seg[], S: Float64Array, B: number): SectionType[] {
  const n = segs.length;
  const types: SectionType[] = segs.map(() => 'verse');
  if (n === 1) return types;
  const es = sortedCopy(segs.map((s) => s.e));
  const medE = percentile(es, 0.5);
  const maxE = es[es.length - 1];

  // Pairwise segment similarity and an adaptive "same material" threshold.
  const sim: number[][] = segs.map(() => new Array<number>(n).fill(-Infinity));
  const all: number[] = [];
  for (let x = 0; x < n; x++) {
    for (let y = x + 1; y < n; y++) {
      const v = segmentSimilarity(S, B, segs[x], segs[y]);
      sim[x][y] = sim[y][x] = v;
      if (v > -Infinity) all.push(v);
    }
  }
  const sa = sortedCopy(all);
  const thr = Math.max(0.4, percentile(sa, 0.8));

  // Average-linkage clustering: merge the two clusters with the highest mean
  // pairwise similarity while it stays above the threshold.
  let clusters: number[][] = segs.map((_, i) => [i]);
  for (;;) {
    let bx = -1;
    let by = -1;
    let bv = -Infinity;
    for (let x = 0; x < clusters.length; x++) {
      for (let y = x + 1; y < clusters.length; y++) {
        let s = 0;
        let c = 0;
        for (const i of clusters[x]) for (const j of clusters[y]) if (sim[i][j] > -Infinity) (s += sim[i][j]), c++;
        const v = c ? s / c : -Infinity;
        if (v > bv) (bv = v), (bx = x), (by = y);
      }
    }
    if (bx < 0 || bv < thr) break;
    clusters = [...clusters.filter((_, k) => k !== bx && k !== by), [...clusters[bx], ...clusters[by]].sort((p, q) => p - q)];
  }

  // Chorus cluster: recurring (2+ segments) and intense. Mild pop-form priors:
  // the song's last full-energy section is usually a chorus, its first one
  // (after any intro) usually a verse.
  const firstBody = segs[0].e >= medE ? 0 : 1;
  let lastBody = n - 1;
  while (lastBody > 0 && segs[lastBody].e < medE - 0.1) lastBody--;
  // A cluster's intensity ignores sparse renditions of its material (an a
  // cappella hook in the intro, a stripped-down chorus before the last one).
  const energetic = (g: number[]) => {
    const e = g.filter((i) => segs[i].e >= medE - 0.2);
    return e.length ? e : g;
  };
  const meanOf = (g: number[]) => g.reduce((s, i) => s + segs[i].e, 0) / g.length;
  let chorus: number[] = [];
  let chorusMean = -Infinity;
  let bestScore = -Infinity;
  const recurring = clusters.map(energetic).filter((g) => g.length >= 2);
  for (const g of recurring) {
    const meanE = meanOf(g);
    if (meanE < medE - 0.05) continue;
    const score = meanE + 0.05 * Math.min(4, g.length) + (g.includes(lastBody) ? 0.1 : 0) - (g.includes(firstBody) ? 0.1 : 0);
    if (score > bestScore) {
      bestScore = score;
      chorus = g;
      chorusMean = meanE;
    }
  }
  // Songs often have two recurring high-energy passages (chorus + an extended
  // final chorus or post-chorus): any other recurring cluster that is as
  // intense counts as chorus too.
  if (chorus.length) {
    const first = chorus;
    for (const g of recurring) if (g !== first && meanOf(g) >= chorusMean - 0.03) chorus = chorus.concat(g);
  }
  // A "chorus" covering nearly every segment says nothing (one-loop songs).
  if (chorus.length >= Math.max(2, 0.75 * n)) chorus = [];
  // Weak repetition evidence: fall back to the most intense segments.
  if (chorus.length === 0) {
    const cut = percentile(es, 0.6);
    chorus = segs.map((_, i) => i).filter((i) => segs[i].e >= cut && segs[i].e > medE);
  }
  const chorusE = chorus.length ? chorus.reduce((s, i) => s + segs[i].e, 0) / chorus.length : maxE;
  for (const i of chorus) types[i] = 'chorus';
  // Variant choruses (e.g. a last chorus with a key change or a bigger
  // arrangement): a segment more intense than the chorus that still resembles
  // a chorus instance.
  for (let i = 0; i < n; i++) {
    if (types[i] === 'chorus') continue;
    const best = chorus.reduce((m, c) => Math.max(m, sim[i][c]), -Infinity);
    if (best >= 0.8 * thr && segs[i].e >= chorusE + 0.02) types[i] = 'chorus';
  }
  // A chorus straight at the start needs strong evidence (very similar to a later chorus and as intense).
  if (types[0] === 'chorus') {
    const strong = chorus.some((c) => c !== 0 && sim[0][c] >= thr + 0.1) && segs[0].e >= chorusE - 0.05;
    if (!strong) types[0] = 'verse';
  }

  // Intro / outro: first / last segment, sparser than the body of the song.
  if (types[0] !== 'chorus' && segs[0].e <= Math.min(medE, chorusE - 0.15) + 0.02) types[0] = 'intro';
  const L = n - 1;
  if (types[L] !== 'chorus' && segs[L].e <= Math.min(medE, chorusE - 0.15) + 0.02) types[L] = 'outro';

  // Drop: a loud, bass-heavy chorus entered from a much quieter passage.
  const loud = segs.filter((_, i) => types[i] === 'chorus');
  const meanBass = loud.length ? loud.reduce((s, x) => s + x.bass, 0) / loud.length : 0;
  for (let k = 1; k < n; k++) {
    if (types[k] !== 'chorus') continue;
    const s = segs[k];
    if (s.e >= 0.75 && segs[k - 1].e <= 0.3 && s.bass >= meanBass - 0.5 && s.bass > -6) types[k] = 'drop';
  }
  return types;
}
