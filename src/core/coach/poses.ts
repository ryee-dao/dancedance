/**
 * Pose authoring helpers and keyframe interpolation.
 *
 * Pure TypeScript (no DOM). Interpolation is allocation-free.
 *
 * Authoring: `pose({...})` starts from the neutral stance and overrides only
 * what a keyframe cares about. Arms can be given as raw swing angles
 * `[upperElev, upperPlane, foreElev, forePlane]` or as a hand target relative
 * to the shoulder via `hand(out, up, fwd, elbow?)`, which is solved once (at
 * module load) into the same angles so the motion still travels on arcs.
 *
 * Timing: a keyframe is HIT exactly on its beat. Between keyframes the motion
 * settles briefly after the previous hit (small overshoot), pulls back a touch
 * (anticipation), then travels and arrives on the next beat with some speed.
 */

import { ANGULAR_CHANNELS, BODY, CH, NUM_CHANNELS, createPose, mirrorPose, type Pose } from './skeleton';

// ---------------------------------------------------------------------------
// Authoring

/** [upperElevation, upperPlane, forearmElevation, forearmPlane] in degrees. */
export type ArmAngles = readonly [number, number, number, number];
/** [x (absolute, + = screen right), lift, forward]. */
export type FootSpec = readonly [number, number, number];

export interface PoseSpec {
  x?: number;
  y?: number;
  lean?: number;
  twist?: number;
  bend?: number;
  hips?: number;
  hipTwist?: number;
  head?: number;
  nod?: number;
  turn?: number;
  shR?: number;
  shL?: number;
  /** User's right arm (screen right). */
  r?: ArmAngles;
  l?: ArmAngles;
  rf?: FootSpec;
  lf?: FootSpec;
  handR?: number;
  handL?: number;
  /** Pelvis tilt, deg (+ = user's right hip up). */
  tilt?: number;
  /** Rib-cage slide, units (+ = toward screen right). */
  chestX?: number;
  /** Whole-body turn, deg. */
  spin?: number;
  /** Knee / toe turn-out per leg (+ out, - in). */
  kneeR?: number;
  kneeL?: number;
  /** The foot glides to this key's spot (no step arc): slides, swivels. */
  slideR?: boolean;
  slideL?: boolean;
  /** Hand form: a pointing index finger or rock horns (else fist / open by handR). */
  formR?: 'point' | 'horns';
  formL?: 'point' | 'horns';
}

const RAD = 180 / Math.PI;

/** Convert a direction (out, up, fwd) into [elevation, plane]. */
function toSwing(out: number, up: number, fwd: number, fallbackPlane: number): [number, number] {
  const h = Math.sqrt(out * out + fwd * fwd);
  const e = Math.atan2(h, -up) * RAD;
  const p = h < 1e-4 ? fallbackPlane : Math.atan2(fwd, out) * RAD;
  return [e, p];
}

/**
 * Arm angles that put the hand at (out, up, fwd) relative to the shoulder
 * (out = away from the body's midline). `elbow` hints where the elbow points
 * (default: out, down and back, like a relaxed arm).
 */
export function hand(out: number, up: number, fwd: number, elbow: readonly [number, number, number] = [0.6, -0.5, -0.6]): ArmAngles {
  const a = BODY.upperArm, b = BODY.forearm;
  let d = Math.sqrt(out * out + up * up + fwd * fwd);
  const maxD = a + b - 1e-4;
  let tx = out, ty = up, tz = fwd;
  if (d > maxD) {
    const k = maxD / d;
    tx *= k; ty *= k; tz *= k;
    d = maxD;
  }
  const minD = Math.abs(a - b) + 0.01;
  if (d < minD) d = minD;
  const ux = tx / d, uy = ty / d, uz = tz / d;
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  let [nx, ny, nz] = elbow;
  const dot = nx * ux + ny * uy + nz * uz;
  nx -= dot * ux; ny -= dot * uy; nz -= dot * uz;
  const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  const ex = ux * a * cosA + nx * a * sinA;
  const ey = uy * a * cosA + ny * a * sinA;
  const ez = uz * a * cosA + nz * a * sinA;
  const [ue, up2] = toSwing(ex, ey, ez, 0);
  const [fe, fp] = toSwing(tx - ex, ty - ey, tz - ez, up2);
  return [round1(ue), round1(up2), round1(fe), round1(fp)];
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Common arm shapes (side-agnostic). */
export const ARM = {
  /** Relaxed, hanging with a soft elbow. */
  rest: [10, 0, 22, 45] as ArmAngles,
  /** Straight out to the side (T). */
  out: [90, 0, 90, 0] as ArmAngles,
  /** Out and a bit low. */
  low: [55, 5, 60, 10] as ArmAngles,
  /** Straight up. */
  up: [172, 0, 176, 0] as ArmAngles,
  /** High V. */
  v: [145, 0, 150, 0] as ArmAngles,
  /** Upper arm out, forearm up. */
  goal: [88, 0, 175, 10] as ArmAngles,
  /** Fist on the hip, elbow out. */
  hip: hand(0.02, -0.25, 0.0, [1, 0.1, -0.3]),
  /** Fist pulled in at the ribs, ready to punch. */
  guard: hand(-0.05, -0.13, 0.13, [0.25, -1, -0.15]),
  /** Punch straight at the viewer at shoulder height. */
  jab: hand(-0.11, 0.0, 0.27, [0.4, -1, 0]),
  /** Punch straight up. */
  sky: [176, 5, 178, 5] as ArmAngles,
  /** Cross punch toward the other side. */
  cross: hand(-0.27, 0.0, 0.2, [0.2, -1, 0]),
  /** Hands meeting in front of the chest (clap). */
  clap: hand(-0.115, -0.11, 0.17, [0.5, -1, -0.2]),
  /** Hands meeting overhead (clap up high). */
  clapHigh: [176, 0, 230, 0] as ArmAngles,
  /** Bent arm forward, swinging (march / jog). */
  swingFwd: hand(0.02, -0.12, 0.2, [0.1, -1, -0.2]),
  swingBack: hand(0.04, -0.27, -0.1, [0.1, -0.2, -1]),
} as const;

/** Neutral stance: soft knees, feet hip-width, arms relaxed. */
export const NEUTRAL: Pose = buildNeutral();

function buildNeutral(): Pose {
  const p = createPose();
  p[CH.Y] = -0.01;
  setArm(p, CH.RA_E, ARM.rest);
  setArm(p, CH.LA_E, ARM.rest);
  p[CH.RFT_X] = BODY.footHalfX;
  p[CH.LFT_X] = -BODY.footHalfX;
  p[CH.HAND_R] = 0.4;
  p[CH.HAND_L] = 0.4;
  return p;
}

function setArm(p: Pose, c: number, a: ArmAngles): void {
  p[c] = a[0];
  p[c + 1] = a[1];
  p[c + 2] = a[2];
  p[c + 3] = a[3];
}

function setFoot(p: Pose, c: number, f: FootSpec): void {
  p[c] = f[0];
  p[c + 1] = f[1];
  p[c + 2] = f[2];
}

/** Build a pose from a partial spec over the neutral stance. */
export function pose(spec: PoseSpec): Pose {
  const p = createPose();
  p.set(NEUTRAL);
  if (spec.x !== undefined) p[CH.X] = spec.x;
  if (spec.y !== undefined) p[CH.Y] = spec.y;
  if (spec.lean !== undefined) p[CH.LEAN] = spec.lean;
  if (spec.twist !== undefined) p[CH.TWIST] = spec.twist;
  if (spec.bend !== undefined) p[CH.BEND] = spec.bend;
  if (spec.hips !== undefined) p[CH.HIPS] = spec.hips;
  if (spec.hipTwist !== undefined) p[CH.HIPTWIST] = spec.hipTwist;
  if (spec.head !== undefined) p[CH.HEAD_ROLL] = spec.head;
  if (spec.nod !== undefined) p[CH.HEAD_NOD] = spec.nod;
  if (spec.turn !== undefined) p[CH.HEAD_TURN] = spec.turn;
  if (spec.shR !== undefined) p[CH.SH_R] = spec.shR;
  if (spec.shL !== undefined) p[CH.SH_L] = spec.shL;
  if (spec.r) setArm(p, CH.RA_E, spec.r);
  if (spec.l) setArm(p, CH.LA_E, spec.l);
  if (spec.rf) setFoot(p, CH.RFT_X, spec.rf);
  if (spec.lf) setFoot(p, CH.LFT_X, spec.lf);
  if (spec.handR !== undefined) p[CH.HAND_R] = spec.handR;
  if (spec.handL !== undefined) p[CH.HAND_L] = spec.handL;
  if (spec.tilt !== undefined) p[CH.HIP_TILT] = spec.tilt;
  if (spec.chestX !== undefined) p[CH.CHEST_X] = spec.chestX;
  if (spec.spin !== undefined) p[CH.SPIN] = spec.spin;
  if (spec.kneeR !== undefined) p[CH.KNEE_R] = spec.kneeR;
  if (spec.kneeL !== undefined) p[CH.KNEE_L] = spec.kneeL;
  if (spec.slideR) p[CH.SLIDE_R] = 1;
  if (spec.slideL) p[CH.SLIDE_L] = 1;
  if (spec.formR) p[CH.FORM_R] = spec.formR === 'point' ? 1 : 2;
  if (spec.formL) p[CH.FORM_L] = spec.formL === 'point' ? 1 : 2;
  return p;
}

/** A mirrored copy (new array). */
export function mirrored(p: Pose): Pose {
  return mirrorPose(p, createPose());
}

// ---------------------------------------------------------------------------
// Timing curves

/** Main travel weight: holds briefly, then accelerates and arrives with speed. */
export function travel(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const d = 0.1; // brief hold after the previous hit
  if (u <= d) return 0;
  const x = (u - d) / (1 - d);
  // Blend of smoothstep and ease-in: arrives with ~0.8x normalised velocity.
  return 0.6 * (x * x * (3 - 2 * x)) + 0.4 * (x * x);
}

/** Small pull back before travelling (fraction of the coming change). */
export function anticipation(u: number): number {
  const a = 0.12, b = 0.48;
  if (u <= a || u >= b) return 0;
  const x = (u - a) / (b - a);
  return Math.sin(Math.PI * x) * Math.sin(Math.PI * x);
}

/** Settle after a hit (fraction of the previous change carried past the key). */
export function overshoot(u: number): number {
  const w = 0.34;
  if (u <= 0 || u >= w) return 0;
  return Math.sin((Math.PI * u) / w);
}

const ANTIC_AMT = 0.06;
const OVER_AMT = 0.07;

/** Channel classes for layered motion. */
const SNAPPY = new Uint8Array(NUM_CHANNELS);
for (const c of [
  CH.LEAN, CH.TWIST, CH.BEND, CH.HIPS, CH.HIPTWIST, CH.HEAD_ROLL, CH.HEAD_NOD, CH.HEAD_TURN, CH.SH_R, CH.SH_L,
  CH.RA_E, CH.RA_P, CH.RF_E, CH.RF_P, CH.LA_E, CH.LA_P, CH.LF_E, CH.LF_P, CH.Y, CH.HIP_TILT, CH.CHEST_X,
]) SNAPPY[c] = 1;
/** Channels interpolated at constant speed between keys (turns: no stop at every key). */
const LINEAR = new Uint8Array(NUM_CHANNELS);
LINEAR[CH.SPIN] = 1;
/** Channels that switch (no blend) late in the travel: hand forms, slide flags. */
const STEP = new Uint8Array(NUM_CHANNELS);
for (const c of [CH.SLIDE_R, CH.SLIDE_L, CH.FORM_R, CH.FORM_L]) STEP[c] = 1;
const ANGULAR = new Uint8Array(NUM_CHANNELS);
for (const c of ANGULAR_CHANNELS) ANGULAR[c] = 1;

function wrap180(d: number): number {
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d;
}

/** Shortest-way difference b - a for channel c. */
export function channelDelta(c: number, a: number, b: number): number {
  return ANGULAR[c] ? wrap180(b - a) : b - a;
}

/**
 * Interpolate between keyframes p0 (at u = 0) and p1 (at u = 1). `pm1` is the
 * key before p0 (for the settle after the p0 hit). Writes into `out`.
 * Exactly p0 at u = 0 and exactly p1 at u = 1.
 *
 */
export function interpolateKeys(pm1: Pose, p0: Pose, p1: Pose, u: number, out: Pose): Pose {
  const w = travel(u);
  const an = anticipation(u) * ANTIC_AMT;
  const ov = overshoot(u) * OVER_AMT;
  for (let c = 0; c < NUM_CHANNELS; c++) {
    const a = p0[c];
    const d = channelDelta(c, a, p1[c]);
    let v = a + d * (LINEAR[c] ? u : w);
    if (SNAPPY[c]) {
      v += channelDelta(c, pm1[c], a) * ov - d * an;
    }
    if (STEP[c]) v = u >= 0.6 ? p1[c] : a;
    out[c] = v;
  }
  // Feet: step on an arc when a planted foot moves to a new planted spot.
  footArc(p0, p1, u, out, CH.RFT_X);
  footArc(p0, p1, u, out, CH.LFT_X);
  return out;
}

function footArc(p0: Pose, p1: Pose, u: number, out: Pose, cx: number): void {
  const dx = p1[cx] - p0[cx];
  const dz = p1[cx + 2] - p0[cx + 2];
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.015) return;
  // A sliding foot glides: the same timing, no lift.
  if (p1[cx === CH.RFT_X ? CH.SLIDE_R : CH.SLIDE_L] > 0.5) {
    const w = stepCurve(u);
    out[cx] = p0[cx] + dx * w;
    out[cx + 2] = p0[cx + 2] + dz * w;
    return;
  }
  // A foot lifts most of the way in the middle of the step; feet move a
  // little faster than the body so they land before the hit.
  const lift = Math.min(0.09, 0.02 + dist * 0.45);
  const w = stepCurve(u);
  out[cx] = p0[cx] + dx * w;
  out[cx + 2] = p0[cx + 2] + dz * w;
  const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.82)));
  out[cx + 1] += lift * (arc > 0 ? arc : 0);
}

/** Foot travel: lands slightly before the beat and stays planted. */
function stepCurve(u: number): number {
  const a = 0.12, b = 0.92;
  if (u <= a) return 0;
  if (u >= b) return 1;
  const x = (u - a) / (b - a);
  return x * x * (3 - 2 * x);
}

/** out = a + (b - a) * w (angle-aware). */
export function blendPose(a: Pose, b: Pose, w: number, out: Pose): Pose {
  for (let c = 0; c < NUM_CHANNELS; c++) out[c] = a[c] + channelDelta(c, a[c], b[c]) * w;
  return out;
}

// ---------------------------------------------------------------------------
// Channel groups: a move is three tracks (body/feet, arms, torso/head), each
// with its own keyframes, so layered moves keep each layer's own timing.

export const G_BODY = 0;
export const G_ARMS = 1;
export const G_TORSO = 2;
export const NUM_GROUPS = 3;

export const GROUP_CHANNELS: readonly (readonly number[])[] = [
  [CH.X, CH.Y, CH.HIPS, CH.HIPTWIST, CH.RFT_X, CH.RFT_Y, CH.RFT_Z, CH.LFT_X, CH.LFT_Y, CH.LFT_Z, CH.HIP_TILT, CH.SPIN, CH.KNEE_R, CH.KNEE_L, CH.SLIDE_R, CH.SLIDE_L],
  [CH.SH_R, CH.SH_L, CH.RA_E, CH.RA_P, CH.RF_E, CH.RF_P, CH.LA_E, CH.LA_P, CH.LF_E, CH.LF_P, CH.HAND_R, CH.HAND_L, CH.FORM_R, CH.FORM_L],
  [CH.LEAN, CH.TWIST, CH.BEND, CH.HEAD_ROLL, CH.HEAD_NOD, CH.HEAD_TURN, CH.CHEST_X],
];

/** Group of each channel. */
export const CHANNEL_GROUP: Uint8Array = (() => {
  const g = new Uint8Array(NUM_CHANNELS);
  GROUP_CHANNELS.forEach((chs, i) => chs.forEach((c) => (g[c] = i)));
  return g;
})();

/**
 * interpolateKeys restricted to one channel group (writes only that group's
 * channels of `out`). Same timing curves; foot arcs for the body group.
 */
export function interpolateGroup(g: number, pm1: Pose, p0: Pose, p1: Pose, u: number, out: Pose): void {
  const w = travel(u);
  const an = anticipation(u) * ANTIC_AMT;
  const ov = overshoot(u) * OVER_AMT;
  const chs = GROUP_CHANNELS[g];
  for (let i = 0; i < chs.length; i++) {
    const c = chs[i];
    const a = p0[c];
    const d = channelDelta(c, a, p1[c]);
    let v = a + d * (LINEAR[c] ? u : w);
    if (SNAPPY[c]) v += channelDelta(c, pm1[c], a) * ov - d * an;
    if (STEP[c]) v = u >= 0.6 ? p1[c] : a;
    out[c] = v;
  }
  if (g === G_BODY) {
    footArc(p0, p1, u, out, CH.RFT_X);
    footArc(p0, p1, u, out, CH.LFT_X);
  }
}
