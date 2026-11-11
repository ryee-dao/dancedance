/**
 * Dynamic-programming beat tracker after D. Ellis, "Beat Tracking by Dynamic
 * Programming" (J. New Music Research, 2007).
 *
 *   C(t) = O(t) + max_{tau in [t - 2P, t - P/2]} ( C(tau) - alpha * log((t - tau) / P)^2 )
 *
 * O is the (lightly smoothed) onset envelope, P the tempo period in frames
 * and alpha the "tightness". The best final beat is found and the chain is
 * back-traced. Because the transition penalty only grows with the squared
 * log deviation of each individual interval, gradual tempo drift of a few
 * percent costs almost nothing per beat, so the tracker follows it without
 * re-estimating the tempo.
 *
 * Beat positions are then refined to sub-frame precision by parabolic
 * interpolation of the envelope peak nearest each beat.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */

export interface BeatTrackOptions {
  /** Transition tightness alpha (default 100, as in librosa). */
  tightness?: number;
  /** Trim leading/trailing beats weaker than this fraction of the median beat strength (default 0.2). */
  trimRatio?: number;
}

/** Track beats; returns sub-frame beat positions (in envelope frames), ascending. */
export function trackBeats(env: Float32Array, period: number, opts: BeatTrackOptions = {}): Float64Array {
  const n = env.length;
  if (!(period >= 2) || n < period * 2) return new Float64Array(0);
  const alpha = opts.tightness ?? 100;
  const trimRatio = opts.trimRatio ?? 0.2;

  // Local score: Gaussian smoothing with sigma = P / 32 (as librosa).
  const sigma = Math.max(0.5, period / 32);
  const half = Math.ceil(3 * sigma);
  const kernel = new Float64Array(2 * half + 1);
  let ksum = 0;
  for (let i = -half; i <= half; i++) {
    const v = Math.exp(-0.5 * (i / sigma) * (i / sigma));
    kernel[i + half] = v;
    ksum += v;
  }
  const ls = new Float64Array(n);
  let maxLs = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j >= 0 && j < n) s += env[j] * kernel[k + half];
    }
    ls[i] = s / ksum;
    if (ls[i] > maxLs) maxLs = ls[i];
  }
  if (!(maxLs > 0)) return new Float64Array(0);

  const lo = Math.max(1, Math.round(period / 2));
  const hi = Math.max(lo + 1, Math.round(period * 2));
  const tx = new Float64Array(hi + 1);
  for (let d = lo; d <= hi; d++) {
    const l = Math.log(d / period);
    tx[d] = -alpha * l * l;
  }

  const cum = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  let started = false;
  const startThresh = 0.01 * maxLs;
  for (let i = 0; i < n; i++) {
    if (!started) {
      cum[i] = ls[i];
      if (ls[i] >= startThresh) started = true;
      continue;
    }
    let best = -Infinity;
    let bestJ = -1;
    for (let d = lo; d <= hi; d++) {
      const j = i - d;
      if (j < 0) break;
      const v = cum[j] + tx[d];
      if (v > best) {
        best = v;
        bestJ = j;
      }
    }
    if (bestJ < 0) {
      cum[i] = ls[i];
    } else {
      cum[i] = ls[i] + best;
      back[i] = bestJ;
    }
  }

  // Last beat: the last local maximum of the cumulative score that is at
  // least half the median local-maximum value (librosa's rule).
  const maxima: number[] = [];
  for (let i = 1; i < n - 1; i++) if (cum[i] > cum[i - 1] && cum[i] >= cum[i + 1]) maxima.push(i);
  if (maxima.length === 0) return new Float64Array(0);
  const vals = maxima.map((i) => cum[i]).sort((a, b) => a - b);
  const med = vals[vals.length >> 1];
  let last = maxima[maxima.length - 1];
  for (let m = maxima.length - 1; m >= 0; m--) {
    if (cum[maxima[m]] >= 0.5 * med) {
      last = maxima[m];
      break;
    }
  }

  const chain: number[] = [];
  for (let i = last; i >= 0; i = back[i]) {
    chain.push(i);
    if (chain.length > n) break; // defensive
  }
  chain.reverse();

  // Trim weak leading/trailing beats (silence, fades).
  const strength = chain.map((b) => peakAround(env, b));
  const sorted = strength.slice().sort((a, b) => a - b);
  const medStrength = sorted[sorted.length >> 1] ?? 0;
  const thr = trimRatio * medStrength;
  let s = 0;
  let e = chain.length - 1;
  while (s <= e && strength[s] <= thr) s++;
  while (e >= s && strength[e] <= thr) e--;
  const out = new Float64Array(Math.max(0, e - s + 1));
  for (let k = s; k <= e; k++) out[k - s] = refinePeak(env, chain[k]);
  // Guarantee strictly increasing output after refinement.
  for (let k = 1; k < out.length; k++) if (out[k] <= out[k - 1]) out[k] = out[k - 1] + 0.5;
  return out;
}

function peakAround(env: Float32Array, b: number): number {
  let m = 0;
  for (let i = b - 1; i <= b + 1; i++) if (i >= 0 && i < env.length && env[i] > m) m = env[i];
  return m;
}

/**
 * Sub-frame position of the envelope peak within +-1 frame of `b`
 * (parabolic interpolation through the peak and its neighbours).
 */
export function refinePeak(env: ArrayLike<number>, b: number): number {
  const n = env.length;
  let m = b;
  for (let i = b - 1; i <= b + 1; i++) if (i >= 0 && i < n && env[i] > env[m]) m = i;
  if (m <= 0 || m >= n - 1 || !(env[m] > 0)) return b;
  const y0 = env[m - 1];
  const y1 = env[m];
  const y2 = env[m + 1];
  const denom = y0 - 2 * y1 + y2;
  if (!(denom < 0)) return m;
  let d = (0.5 * (y0 - y2)) / denom;
  if (d > 0.5) d = 0.5;
  else if (d < -0.5) d = -0.5;
  return m + d;
}
