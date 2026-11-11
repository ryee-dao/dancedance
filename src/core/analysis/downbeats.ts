/**
 * Downbeat (bar phase) estimation, 4/4 assumed.
 *
 * Each beat gets an accent score from its low-band level, low-band onset
 * strength and the spectral change from the previous beat interval (chord /
 * texture changes tend to land on beat 1). Scores are normalised against the
 * neighbouring beats so loud/quiet sections do not dominate. A 4-state
 * Viterbi pass over the beats then chooses each beat's position in the bar,
 * advancing by one position per beat and paying a large penalty to jump; this
 * picks the bar phase with the strongest accents and survives an occasional
 * extra or missing beat without flipping the phase for the rest of the song.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import { NUM_BANDS, type Features } from './onset';

const BEATS_PER_BAR = 4;
const SWITCH_PENALTY = 6;

/** Per-beat accent scores (z-like, relative to neighbouring beats). */
export function beatAccents(f: Features, beatFrames: ArrayLike<number>): Float64Array {
  const nb = beatFrames.length;
  const lowE = new Float64Array(nb);
  const lowF = new Float64Array(nb);
  const change = new Float64Array(nb);
  const n = f.frames;
  const meanBands = (a: number, b: number, out: Float64Array) => {
    out.fill(0);
    const s = Math.max(0, Math.min(n, a));
    const e = Math.max(s + 1, Math.min(n, b));
    if (s >= n) return;
    for (let i = s; i < e && i < n; i++) {
      for (let k = 0; k < NUM_BANDS; k++) out[k] += Math.max(-80, f.bands[i * NUM_BANDS + k]);
    }
    const cnt = Math.min(e, n) - s;
    for (let k = 0; k < NUM_BANDS; k++) out[k] /= cnt;
  };
  const prev = new Float64Array(NUM_BANDS);
  const cur = new Float64Array(NUM_BANDS);
  for (let i = 0; i < nb; i++) {
    const b = Math.round(beatFrames[i]);
    let me = -200;
    for (let k = b; k <= b + 3; k++) if (k >= 0 && k < n && f.lowDb[k] > me) me = f.lowDb[k];
    lowE[i] = Math.max(-80, me);
    let mf = 0;
    for (let k = b - 1; k <= b + 1; k++) if (k >= 0 && k < n && f.fluxLow[k] > mf) mf = f.fluxLow[k];
    lowF[i] = mf;
    if (i > 0) {
      const a = Math.round(beatFrames[i - 1]);
      const c = i + 1 < nb ? Math.round(beatFrames[i + 1]) : b + (b - a);
      meanBands(a, b, prev);
      meanBands(b, c, cur);
      let d = 0;
      for (let k = 0; k < NUM_BANDS; k++) d += (cur[k] - prev[k]) * (cur[k] - prev[k]);
      change[i] = Math.sqrt(d / NUM_BANDS);
    }
  }
  const zl = localZ(lowE);
  const zf = localZ(lowF);
  const zc = localZ(change);
  const acc = new Float64Array(nb);
  for (let i = 0; i < nb; i++) acc[i] = zl[i] + 0.5 * zf[i] + 0.5 * zc[i];
  return acc;
}

/** x minus its mean over +-4 neighbouring beats, scaled by the mean absolute residual. */
function localZ(x: Float64Array): Float64Array {
  const n = x.length;
  const r = new Float64Array(n);
  let mad = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) {
      s += x[j];
      c++;
    }
    r[i] = x[i] - s / c;
    mad += Math.abs(r[i]);
  }
  mad /= n || 1;
  if (!(mad > 1e-9)) return new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = Math.max(-4, Math.min(4, r[i] / mad));
  return r;
}

/** Indices into the beat array of the downbeats (beat 1 of each 4/4 bar). */
export function findDownbeats(f: Features, beatFrames: ArrayLike<number>): number[] {
  const nb = beatFrames.length;
  if (nb === 0) return [];
  const acc = beatAccents(f, beatFrames);
  const S = BEATS_PER_BAR;
  // Viterbi over bar positions.
  let score = new Float64Array(S);
  let next = new Float64Array(S);
  const back = new Uint8Array(nb * S);
  for (let s = 0; s < S; s++) score[s] = s === 0 ? acc[0] : 0;
  for (let i = 1; i < nb; i++) {
    for (let s = 0; s < S; s++) {
      const natural = (s + S - 1) % S;
      let best = score[natural];
      let arg = natural;
      for (let p = 0; p < S; p++) {
        if (p === natural) continue;
        const v = score[p] - SWITCH_PENALTY;
        if (v > best) {
          best = v;
          arg = p;
        }
      }
      next[s] = best + (s === 0 ? acc[i] : 0);
      back[i * S + s] = arg;
    }
    const t = score;
    score = next;
    next = t;
  }
  let state = 0;
  for (let s = 1; s < S; s++) if (score[s] > score[state]) state = s;
  const pos = new Uint8Array(nb);
  for (let i = nb - 1; i >= 0; i--) {
    pos[i] = state;
    if (i > 0) state = back[i * S + state];
  }
  const out: number[] = [];
  for (let i = 0; i < nb; i++) if (pos[i] === 0) out.push(i);
  return out;
}
