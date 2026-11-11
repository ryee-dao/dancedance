/**
 * Global tempo estimation from an onset-strength envelope.
 *
 * 1. Autocorrelation of the (mean-removed) envelope.
 * 2. Every candidate tempo on a fine log grid is scored by a comb over the
 *    first four multiples of its period (harmonic evidence) times a
 *    log-normal perceptual prior centred near 120 BPM.
 * 3. 3:2 guard: the best candidate is compared with x1.5 and /1.5 on raw comb
 *    evidence; the prior only breaks near-ties.
 * 4. Half/double guard: instead of trusting the top peak, the envelope is
 *    folded on the slower grid in short windows and the strength of the
 *    in-between pulses is compared with the on-grid pulses. Strong in-between
 *    pulses mean the faster tempo; weak ones mean the slower tempo.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */

export interface TempoOptions {
  minBpm?: number;
  maxBpm?: number;
  /** Centre of the log-normal prior. */
  priorBpm?: number;
  /** Width (standard deviation) of the prior in octaves. */
  priorOctaves?: number;
}

export interface TempoEstimate {
  /** Tempo in BPM (0 when nothing periodic was found). */
  bpm: number;
  /** Beat period in envelope frames. */
  period: number;
  /** 0..1, how periodic the envelope is at this tempo. */
  confidence: number;
  /** Raw comb evidence (normalised autocorrelation) at the chosen period. */
  evidence: number;
}

const COMB_MULTIPLES = 4;
const GRID_STEP = 1.004; // ratio between neighbouring candidate tempi

/** Normalised (r[0] = 1), lightly smoothed, unbiased autocorrelation for lags 0..maxLag. */
export function autocorrelation(env: ArrayLike<number>, maxLag: number): Float64Array {
  const n = env.length;
  const x = new Float64Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n || 1;
  for (let i = 0; i < n; i++) x[i] = env[i] - mean;
  const L = Math.min(maxLag, n - 1);
  const r = new Float64Array(Math.max(L + 1, 1));
  for (let lag = 0; lag <= L; lag++) {
    let s = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) s += x[i] * x[i + lag];
    r[lag] = s / m;
  }
  const r0 = r[0];
  if (!(r0 > 0)) return new Float64Array(r.length);
  for (let lag = 0; lag < r.length; lag++) r[lag] /= r0;
  // [1 2 1]/4 smoothing so that fractional-lag interpolation behaves.
  const s = new Float64Array(r.length);
  for (let lag = 0; lag < r.length; lag++) {
    const a = r[Math.max(0, lag - 1)];
    const b = r[Math.min(r.length - 1, lag + 1)];
    s[lag] = 0.25 * a + 0.5 * r[lag] + 0.25 * b;
  }
  s[0] = 1;
  return s;
}

function interp(r: Float64Array, lag: number): number {
  const i = Math.floor(lag);
  if (i < 0 || i + 1 >= r.length) return 0;
  const f = lag - i;
  return r[i] * (1 - f) + r[i + 1] * f;
}

/** Mean autocorrelation at the first multiples of `period` that fit in `r` (usable lags <= maxUsable). */
export function combScore(r: Float64Array, period: number, maxUsable: number): number {
  let s = 0;
  let c = 0;
  for (let k = 1; k <= COMB_MULTIPLES; k++) {
    const lag = k * period;
    if (lag > maxUsable) break;
    s += interp(r, lag);
    c++;
  }
  return c ? s / c : 0;
}

function prior(bpm: number, centre: number, octaves: number): number {
  const z = Math.log2(bpm / centre) / octaves;
  return Math.exp(-0.5 * z * z);
}

function peakNear(env: ArrayLike<number>, pos: number): number {
  const c = Math.round(pos);
  let m = 0;
  for (let i = c - 1; i <= c + 1; i++) if (i >= 0 && i < env.length && env[i] > m) m = env[i];
  return m;
}

/**
 * Strength of the pulses half-way between the beats of the slow grid
 * (period 2 * fastPeriod) relative to the on-grid pulses, 0..~1.
 * Computed in ~6 s windows (each with its own best phase) so slow tempo
 * drift does not smear it, and averaged weighted by on-grid strength.
 */
export function alternationRatio(env: ArrayLike<number>, fastPeriod: number, frameRate: number): number {
  const n = env.length;
  const slow = 2 * fastPeriod;
  const win = Math.min(n, Math.max(Math.round(6 * frameRate), Math.ceil(4 * slow)));
  if (win < slow * 2) return 0;
  const hop = Math.max(1, Math.floor(win / 2));
  let num = 0;
  let den = 0;
  for (let start = 0; start + win <= n; start += hop) {
    let bestPhase = 0;
    let bestSum = -1;
    for (let ph = 0; ph < slow; ph += 1) {
      let s = 0;
      for (let x = start + ph; x < start + win; x += slow) s += peakNear(env, x);
      if (s > bestSum) {
        bestSum = s;
        bestPhase = ph;
      }
    }
    let on = 0;
    let off = 0;
    let cnt = 0;
    for (let x = start + bestPhase; x + fastPeriod < start + win; x += slow) {
      on += peakNear(env, x);
      off += peakNear(env, x + fastPeriod);
      cnt++;
    }
    if (cnt === 0 || on <= 0) continue;
    on /= cnt;
    off /= cnt;
    num += Math.min(1, off / on) * on;
    den += on;
    if (start + win === n) break;
  }
  return den > 0 ? num / den : 0;
}

/** Ratio above which the faster of an octave pair wins (grows for very fast tempi). */
function fastThreshold(fastBpm: number): number {
  return 0.6 + 0.3 * Math.max(0, Math.log2(fastBpm / 150));
}
/** Ratio below which the slower of an octave pair wins. */
const SLOW_THRESHOLD = 0.35;

export function estimateTempo(env: ArrayLike<number>, frameRate: number, opts: TempoOptions = {}): TempoEstimate {
  const minBpm = opts.minBpm ?? 60;
  const maxBpm = opts.maxBpm ?? 200;
  const priorBpm = opts.priorBpm ?? 120;
  const priorOct = opts.priorOctaves ?? 1;
  const n = env.length;
  const none: TempoEstimate = { bpm: 0, period: 0, confidence: 0, evidence: 0 };
  const minPeriodSlow = (60 * frameRate) / minBpm;
  if (n < Math.ceil(minPeriodSlow * 1.5)) return none;

  // Need multiples of the slowest period of an octave pair (2x).
  const maxLag = Math.min(n - 1, Math.ceil(COMB_MULTIPLES * (60 * frameRate) / (minBpm / 2)) + 2);
  const r = autocorrelation(env, maxLag);
  if (r.length < 2 || r[0] === 0) return none;
  // Only lags with at least a third of the signal overlapping are trusted.
  const maxUsable = Math.min(r.length - 2, Math.floor((2 * n) / 3));

  const periodOf = (bpm: number) => (60 * frameRate) / bpm;
  const comb = (bpm: number) => combScore(r, periodOf(bpm), maxUsable);

  let best = 0;
  let bestScore = -Infinity;
  for (let bpm = minBpm; bpm <= maxBpm * 1.0001; bpm *= GRID_STEP) {
    if (periodOf(bpm) > maxUsable) continue;
    const s = comb(bpm) * prior(bpm, priorBpm, priorOct);
    if (s > bestScore) {
      bestScore = s;
      best = bpm;
    }
  }
  if (best === 0 || !(bestScore > 0)) return none;
  best = refine(best, comb);

  // 3:2 guard on raw evidence; prior only breaks near-ties.
  for (const f of [1.5, 1 / 1.5]) {
    const alt = best * f;
    if (alt < minBpm || alt > maxBpm || periodOf(alt) > maxUsable) continue;
    const altRefined = refine(alt, comb);
    if (comb(altRefined) > 1.15 * comb(best)) best = altRefined;
  }

  // Half/double guard.
  for (let iter = 0; iter < 3; iter++) {
    const fast = best * 2;
    if (fast <= maxBpm * 1.02) {
      const ratio = alternationRatio(env, periodOf(fast), frameRate);
      if (ratio > fastThreshold(fast)) {
        best = refine(fast, comb);
        continue;
      }
    }
    const slowBpm = best / 2;
    if (slowBpm >= minBpm * 0.98 && periodOf(slowBpm) * 2 <= maxUsable) {
      const ratio = alternationRatio(env, periodOf(best), frameRate);
      if (ratio < SLOW_THRESHOLD) {
        best = refine(slowBpm, comb);
        continue;
      }
    }
    break;
  }

  const period = peakPeriod(r, periodOf(best), maxUsable);
  const evidence = Math.max(comb(best), combScore(r, period, maxUsable));
  const confidence = Math.max(0, Math.min(1, (evidence - 0.08) / 0.4));
  return { bpm: (60 * frameRate) / period, period, confidence, evidence };
}

/**
 * Sub-lag period: parabolic peak positions of the autocorrelation near each
 * multiple k * P, combined by least squares through the origin. Falls back to
 * P when the peaks are missing or disagree by more than 2%.
 */
function peakPeriod(r: Float64Array, period: number, maxUsable: number): number {
  let num = 0;
  let den = 0;
  for (let k = 1; k <= COMB_MULTIPLES; k++) {
    const target = k * period;
    if (target + 3 > maxUsable) break;
    const c = Math.round(target);
    let m = c;
    for (let i = c - 2; i <= c + 2; i++) if (i > 0 && i < r.length - 1 && r[i] > r[m]) m = i;
    if (m <= 0 || m >= r.length - 1) continue;
    const y0 = r[m - 1];
    const y1 = r[m];
    const y2 = r[m + 1];
    const d = y0 - 2 * y1 + y2;
    if (!(d < 0) || !(y1 > 0)) continue;
    const p = m + Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / d));
    if (Math.abs(p - target) > 1.5 + 0.03 * target) continue;
    num += k * p;
    den += k * k;
  }
  if (den === 0) return period;
  const refined = num / den;
  return Math.abs(refined / period - 1) < 0.02 ? refined : period;
}

/** Local hill-climb on a finer grid around `bpm` (raw comb, no prior). */
function refine(bpm: number, comb: (b: number) => number): number {
  let best = bpm;
  let bestS = comb(bpm);
  for (let step = 1.002; step > 1.0001; step = Math.sqrt(step)) {
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 20) {
      improved = false;
      for (const cand of [best * step, best / step]) {
        const s = comb(cand);
        if (s > bestS) {
          bestS = s;
          best = cand;
          improved = true;
        }
      }
    }
  }
  // Never wander more than ~3% from the grid winner.
  if (Math.abs(Math.log(best / bpm)) > 0.03) return bpm;
  return best;
}
