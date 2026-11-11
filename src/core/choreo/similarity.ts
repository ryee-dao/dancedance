/**
 * How different two moves LOOK and FEEL to copy: a pose-space distance over
 * time plus a rhythm signature. Pure TypeScript (no DOM).
 *
 * Signature: the move is looped (both sides, as the generator plays it) and
 * sampled over an 8-beat window at 4 samples per beat, tempo-normalised (the
 * sampling is in beats). Per sample we keep 11 joints (pelvis, chest, head,
 * elbows, hands, knees, ankles) in figure units (1 = body height), plus the
 * total joint speed (the rhythm: when the accents fall).
 *
 * Distance between A and B = the best alignment over B's mirror image and
 * cyclic shifts of whole beats (the same move started on the other side or a
 * beat later is the same move) of:
 *   pose   = max over body groups (arms, legs + pelvis, head + chest) of the
 *            mean joint distance in that group. Max, not mean: a move that
 *            differs only in its arm path IS a different move.
 *   rhythm = mean |speed_a - speed_b| of the normalised speed profiles (0..~1).
 *   total  = pose + RHYTHM_WEIGHT * rhythm, + CATEGORY_GAP when exactly one of
 *            the two leaves the floor (jumps) or turns: a jog is not a march.
 * Two moves closer than UNIQUE_THRESHOLD (total) count as the same move.
 */

import { PoseEvaluator } from '../coach/animator';
import { loopPlan } from '../coach/loop';
import { J, createPose, createSkeleton, solveSkeleton } from '../coach/skeleton';
import type { Move } from './catalog';

/** Joints sampled, and their mirror partners (indices into this list). */
const JOINTS = [J.PELVIS, J.CHEST, J.HEAD, J.EL_R, J.HA_R, J.EL_L, J.HA_L, J.KN_R, J.AN_R, J.KN_L, J.AN_L] as const;
const MIRROR_OF = [0, 1, 2, 5, 6, 3, 4, 9, 10, 7, 8];
const GROUPS: readonly (readonly number[])[] = [
  [3, 4, 5, 6], // arms
  [0, 7, 8, 9, 10], // pelvis + legs
  [1, 2], // chest + head
];
const NJ = JOINTS.length;
export const SIG_BEATS = 8;
export const SAMPLES_PER_BEAT = 4;
const T = SIG_BEATS * SAMPLES_PER_BEAT;

/** Weight of the rhythm term in the total distance. */
export const RHYTHM_WEIGHT = 0.03;
/**
 * Two moves closer than this (total distance, figure units) are the same move
 * for counting / naming. Tuned by eye on contact sheets of pairs around it
 * (see tools/moves/check.ts --pairs).
 */
export const UNIQUE_THRESHOLD = 0.045;
/**
 * Stricter bar for VARIATIONS (they must look like a different move to copy,
 * not a tweak): pairs around 0.07 still read as the same move when the arms
 * match and only in-place footwork differs; above ~0.085 they read as
 * different (contact sheets of distance bands, Nov 2026).
 */
export const VARIATION_THRESHOLD = 0.085;
/** Added when one move jumps / turns and the other doesn't. */
export const CATEGORY_GAP = 0.05;

export interface MotionSig {
  id: string;
  /** T * NJ * 3 positions, and the mirror image. */
  frames: Float64Array;
  framesM: Float64Array;
  /** Per group: mean position (NJ * 3), for the lower-bound prefilter. */
  mean: Float64Array;
  meanM: Float64Array;
  /** Normalised speed profile (T). */
  speed: Float64Array;
  jump: boolean;
  turn: boolean;
}

const ev = new PoseEvaluator();
const pose = createPose();
const sk = createSkeleton();

export function motionSignature(m: Move): MotionSig {
  const period = 0.5;
  const plan = loopPlan(m, period, { minBeats: SIG_BEATS });
  const frames = new Float64Array(T * NJ * 3);
  for (let t = 0; t < T; t++) {
    const beat = (t / SAMPLES_PER_BEAT) % plan.loopBeats;
    ev.evaluate(plan, beat * period, pose, { layers: false });
    solveSkeleton(pose, sk);
    for (let j = 0; j < NJ; j++) {
      const s = JOINTS[j] * 3, d = (t * NJ + j) * 3;
      frames[d] = sk.p[s];
      frames[d + 1] = sk.p[s + 1];
      frames[d + 2] = sk.p[s + 2];
    }
  }
  const framesM = new Float64Array(frames.length);
  for (let t = 0; t < T; t++) {
    for (let j = 0; j < NJ; j++) {
      const s = (t * NJ + MIRROR_OF[j]) * 3, d = (t * NJ + j) * 3;
      framesM[d] = -frames[s];
      framesM[d + 1] = frames[s + 1];
      framesM[d + 2] = frames[s + 2];
    }
  }
  const mean = meanOf(frames), meanM = meanOf(framesM);
  // Speed: total joint displacement to the next sample (cyclic), normalised to mean 1.
  const speed = new Float64Array(T);
  let sum = 0;
  for (let t = 0; t < T; t++) {
    const u = (t + 1) % T;
    let s = 0;
    for (let k = 0; k < NJ * 3; k += 3) {
      const a = t * NJ * 3 + k, b = u * NJ * 3 + k;
      s += Math.hypot(frames[b] - frames[a], frames[b + 1] - frames[a + 1], frames[b + 2] - frames[a + 2]);
    }
    speed[t] = s;
    sum += s;
  }
  const mu = sum / T || 1;
  for (let t = 0; t < T; t++) speed[t] /= mu;
  return { id: m.id, frames, framesM, mean, meanM, speed, jump: m.jump, turn: m.parts.includes('turn') };
}

function meanOf(f: Float64Array): Float64Array {
  const out = new Float64Array(NJ * 3);
  for (let t = 0; t < T; t++) for (let k = 0; k < NJ * 3; k++) out[k] += f[t * NJ * 3 + k];
  for (let k = 0; k < NJ * 3; k++) out[k] /= T;
  return out;
}

/** Lower bound of the pose distance (mean poses; exact by the triangle inequality). */
function lowerBound(a: Float64Array, b: Float64Array): number {
  let best = 0;
  for (const g of GROUPS) {
    let s = 0;
    for (const j of g) s += Math.hypot(a[j * 3] - b[j * 3], a[j * 3 + 1] - b[j * 3 + 1], a[j * 3 + 2] - b[j * 3 + 2]);
    best = Math.max(best, s / g.length);
  }
  return best;
}

export interface MoveDistance {
  pose: number;
  rhythm: number;
  total: number;
  /** Best alignment used B's mirror image / a shift of this many beats. */
  mirrored: boolean;
  shift: number;
}

const groupSum = new Float64Array(GROUPS.length);

/** Pose + rhythm distance between two signatures (see the module doc). `cap`: stop early above it. */
export function moveDistance(a: MotionSig, b: MotionSig, cap = Infinity): MoveDistance {
  let best: MoveDistance = { pose: Infinity, rhythm: 0, total: Infinity, mirrored: false, shift: 0 };
  const gap = (a.jump !== b.jump ? CATEGORY_GAP : 0) + (a.turn !== b.turn ? CATEGORY_GAP : 0);
  for (const mirrored of [false, true]) {
    const bf = mirrored ? b.framesM : b.frames;
    if (lowerBound(a.mean, mirrored ? b.meanM : b.mean) + gap > Math.min(cap, best.total)) continue;
    for (let sh = 0; sh < SIG_BEATS; sh++) {
      const off = sh * SAMPLES_PER_BEAT;
      groupSum.fill(0);
      for (let t = 0; t < T; t++) {
        const ta = t * NJ * 3, tb = ((t + off) % T) * NJ * 3;
        for (let gi = 0; gi < GROUPS.length; gi++) {
          for (const j of GROUPS[gi]) {
            const p = ta + j * 3, q = tb + j * 3;
            groupSum[gi] += Math.hypot(a.frames[p] - bf[q], a.frames[p + 1] - bf[q + 1], a.frames[p + 2] - bf[q + 2]);
          }
        }
      }
      let pd = 0;
      for (let gi = 0; gi < GROUPS.length; gi++) pd = Math.max(pd, groupSum[gi] / (T * GROUPS[gi].length));
      let rd = 0;
      for (let t = 0; t < T; t++) rd += Math.abs(a.speed[t] - b.speed[(t + off) % T]);
      rd /= 2 * T;
      const total = pd + RHYTHM_WEIGHT * rd + gap;
      if (total < best.total) best = { pose: pd, rhythm: rd, total, mirrored, shift: sh };
    }
  }
  return best;
}

export interface NearPair {
  a: string;
  b: string;
  d: MoveDistance;
}

/**
 * Greedy uniqueness filter: walk `candidates` in order and keep each one that
 * is at least `threshold` from everything already kept (`kept` seeds the pool).
 * Returns the kept signatures and the rejected ones with their nearest match.
 */
export function uniqueFilter(
  candidates: readonly MotionSig[],
  threshold = UNIQUE_THRESHOLD,
  kept: MotionSig[] = [],
): { kept: MotionSig[]; rejected: NearPair[] } {
  const rejected: NearPair[] = [];
  for (const c of candidates) {
    let near: NearPair | null = null;
    for (const k of kept) {
      const d = moveDistance(c, k, threshold);
      if (d.total < threshold) {
        near = { a: c.id, b: k.id, d };
        break;
      }
    }
    if (near) rejected.push(near);
    else kept.push(c);
  }
  return { kept, rejected };
}

/** Nearest other signature to `a` (by total distance). */
export function nearest(a: MotionSig, pool: readonly MotionSig[]): { id: string; d: MoveDistance } | null {
  let best: { id: string; d: MoveDistance } | null = null;
  for (const b of pool) {
    if (b.id === a.id) continue;
    const d = moveDistance(a, b, best ? best.d.total : Infinity);
    if (!best || d.total < best.d.total) best = { id: b.id, d };
  }
  return best;
}
