/**
 * Small authoring helpers shared by the family files (families/*.ts).
 * Pure TypeScript (no DOM).
 */

import { ARM, hand, mirrored, pose, type ArmAngles, type PoseSpec } from '../coach/poses';
import { CH, type Pose } from '../coach/skeleton';

export { ARM, hand, type ArmAngles, type PoseSpec };

/** Neutral foot x (hip width). */
export const W = 0.09;
/** Half-width of a wide (shoulder-width+) stance. */
export const WIDE = 0.13;

export const FIST = { handR: 0, handL: 0 } as const;
export const OPEN = { handR: 1, handL: 1 } as const;
/** Hands in a box in front of the chest (fists). */
export const CHEST_BOX = hand(-0.07, -0.02, 0.16, [1, -0.2, -0.3]);
export const OPEN_LOW: ArmAngles = [58, 0, 64, 4];

/**
 * Arm angles that put one hand at a WORLD position of the neutral stance:
 * x = screen x from the body midline (+ = screen right = the user's right, so
 * the LEFT hand's own side is NEGATIVE x), y = up from the floor, z = toward
 * the viewer. Shoulders are at (+-0.125, 0.78, 0). `elbow` hints where the
 * elbow points (out, up, fwd in that arm's own frame).
 * Example: both hands in front of the chest, shoulder-width apart:
 *   r: at(1, 0.1, 0.7, 0.2), l: at(-1, -0.1, 0.7, 0.2)
 */
export function at(side: 1 | -1, x: number, y: number, z: number, elbow?: readonly [number, number, number]): ArmAngles {
  return hand(side * x - 0.125, y - 0.78, z, elbow);
}

/** A hand circling (cx, cy, cz) with radius r at `phase` (rad). */
export function circle(cx: number, cy: number, cz: number, r: number, phase: number, side: 1 | -1, elbow: readonly [number, number, number]): ArmAngles {
  return at(side, cx + r * Math.cos(phase), cy + r * Math.sin(phase), cz, elbow);
}

/** Wide stance at root height y. */
export function wide(y: number, extra: PoseSpec = {}): PoseSpec {
  return { y, rf: [WIDE, 0, 0], lf: [-WIDE, 0, 0], ...extra };
}

/** Mirror a spec (left/right swapped), keeping only the keys it mentions. */
export function mir(s: PoseSpec): PoseSpec {
  return specFromPose(mirrored(pose(s)), s);
}

/** Convert a pose back into a spec, keeping only the keys `like` mentions. */
export function specFromPose(q: Pose, like: PoseSpec): PoseSpec {
  const o: { -readonly [K in keyof PoseSpec]: PoseSpec[K] } = {};
  const has = (k: keyof PoseSpec) => like[k] !== undefined;
  const hasPair = (a: keyof PoseSpec, b: keyof PoseSpec) => has(a) || has(b);
  if (has('x')) o.x = q[CH.X];
  if (has('y')) o.y = q[CH.Y];
  if (has('lean')) o.lean = q[CH.LEAN];
  if (has('twist')) o.twist = q[CH.TWIST];
  if (has('bend')) o.bend = q[CH.BEND];
  if (has('hips')) o.hips = q[CH.HIPS];
  if (has('hipTwist')) o.hipTwist = q[CH.HIPTWIST];
  if (has('head')) o.head = q[CH.HEAD_ROLL];
  if (has('nod')) o.nod = q[CH.HEAD_NOD];
  if (has('turn')) o.turn = q[CH.HEAD_TURN];
  if (hasPair('shR', 'shL')) {
    o.shR = q[CH.SH_R];
    o.shL = q[CH.SH_L];
  }
  if (hasPair('r', 'l')) {
    o.r = [q[CH.RA_E], q[CH.RA_P], q[CH.RF_E], q[CH.RF_P]];
    o.l = [q[CH.LA_E], q[CH.LA_P], q[CH.LF_E], q[CH.LF_P]];
  }
  if (hasPair('rf', 'lf')) {
    o.rf = [q[CH.RFT_X], q[CH.RFT_Y], q[CH.RFT_Z]];
    o.lf = [q[CH.LFT_X], q[CH.LFT_Y], q[CH.LFT_Z]];
  }
  if (hasPair('handR', 'handL')) {
    o.handR = q[CH.HAND_R];
    o.handL = q[CH.HAND_L];
  }
  if (has('tilt')) o.tilt = q[CH.HIP_TILT];
  if (has('chestX')) o.chestX = q[CH.CHEST_X];
  if (has('spin')) o.spin = q[CH.SPIN];
  if (hasPair('kneeR', 'kneeL')) {
    o.kneeR = q[CH.KNEE_R];
    o.kneeL = q[CH.KNEE_L];
  }
  if (hasPair('slideR', 'slideL')) {
    if (q[CH.SLIDE_R] > 0.5) o.slideR = true;
    if (q[CH.SLIDE_L] > 0.5) o.slideL = true;
  }
  if (hasPair('formR', 'formL')) {
    const f = (v: number) => (v > 1.5 ? 'horns' : v > 0.5 ? 'point' : undefined);
    const fr = f(q[CH.FORM_R]), fl = f(q[CH.FORM_L]);
    if (fr) o.formR = fr;
    if (fl) o.formL = fl;
  }
  return o;
}
