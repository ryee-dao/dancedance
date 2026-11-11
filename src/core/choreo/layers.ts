/**
 * Layer patterns the move catalogue is composed from.
 *
 * Pure TypeScript (no DOM). A pattern is a short keyframed loop for ONE part
 * of the body:
 *   - FOOT:   lower body + root (feet, hips, bounce, travel)
 *   - ARMS:   arms, hands, shoulders
 *   - ACCENT: torso / head
 * A pattern may also carry torso values (e.g. a cross punch twists the
 * chest); `torso: true` makes the pattern lead the torso track when no
 * accent is given.
 *
 * All poses are from the USER's side: `r` is the user's right (screen right).
 * Asymmetric patterns (`mirror: true`) are written for the right side; the
 * other side is derived by mirroring.
 */

import { ARM, hand, mirrored, pose, type ArmAngles, type PoseSpec } from '../coach/poses';
import { CH, type Pose } from '../coach/skeleton';
import type { BodyPart } from './moves';

export interface Pattern {
  id: string;
  beats: 1 | 2 | 4;
  keys: readonly (readonly [number, PoseSpec])[];
  /** Asymmetric: written for the right side; tiles alternate sides. */
  mirror?: boolean;
  /** Net x displacement per execution (footwork only). */
  travel?: number;
  jump?: boolean;
  impact?: boolean;
  /** Leads the torso track (its lean/twist/head values are used). */
  torso?: boolean;
  parts: readonly BodyPart[];
}

const W = 0.09;

/** Hand target from a WORLD-ish position (neutral stance) for one side. */
function at(side: 1 | -1, x: number, y: number, z: number, elbow?: readonly [number, number, number]): ArmAngles {
  // Shoulder at (side * 0.125, 0.78, 0) in the neutral stance.
  return hand(side * x - 0.125, y - 0.78, z, elbow);
}

// ---------------------------------------------------------------------------
// Footwork (lower body)

const p = (id: string, d: Omit<Pattern, 'id'>): Pattern => ({ id, ...d });

const swayA: PoseSpec = { x: 0.03, hips: 0.03, lf: [-W, 0.015, 0.01], lean: 2, head: -3 };
const hipA: PoseSpec = { hips: 0.055, y: -0.025, lf: [-0.085, 0.025, 0.02], head: -4 };
const marchA: PoseSpec = { rf: [0.08, 0.13, 0.1], x: -0.01, lean: -1, head: 1.5 };
const twistA: PoseSpec = { y: -0.08, x: 0.015, hipTwist: -32, twist: 40, lean: 4, turn: -22, rf: [0.12, 0, 0.0], lf: [-0.12, 0.03, 0.03] };
const jogA: PoseSpec = { y: 0.02, x: -0.01, rf: [0.08, 0.13, 0.1] };
const jogDown: PoseSpec = { y: -0.035 };

export const FOOT: Record<string, Pattern> = {
  bounce: p('bounce', { beats: 1, parts: [], keys: [[0, { y: -0.03 }], [0.5, { y: -0.005 }]] }),
  plant: p('plant', { beats: 1, parts: [], keys: [[0, { y: -0.045, rf: [0.13, 0, 0], lf: [-0.13, 0, 0] }], [0.5, { y: -0.02, rf: [0.13, 0, 0], lf: [-0.13, 0, 0] }]] }),
  sway: p('sway', { beats: 2, parts: ['hips'], keys: [[0, swayA], [1, mir(swayA)]] }),
  hipBump: p('hipBump', { beats: 2, parts: ['hips'], torso: true, keys: [[0, hipA], [1, mir(hipA)]] }),
  stepTouch: p('stepTouch', {
    beats: 2, parts: ['legs'], mirror: true, travel: 0.16,
    keys: [
      [0, { x: 0.08, hips: 0.02, rf: [0.25, 0, 0], lf: [-W, 0, 0], head: -2 }],
      [1, { x: 0.16, y: -0.03, rf: [0.25, 0, 0], lf: [0.07, 0.02, 0.01] }],
    ],
  }),
  doubleStep: p('doubleStep', {
    beats: 4, parts: ['legs'], mirror: true, travel: 0.3,
    keys: [
      [0, { x: 0.075, hips: 0.02, rf: [0.24, 0, 0], lf: [-W, 0, 0] }],
      [1, { x: 0.15, y: -0.03, rf: [0.24, 0, 0], lf: [0.06, 0.02, 0.01] }],
      [2, { x: 0.225, hips: 0.02, rf: [0.39, 0, 0], lf: [0.06, 0, 0] }],
      [3, { x: 0.3, y: -0.03, rf: [0.39, 0, 0], lf: [0.21, 0.02, 0.01] }],
    ],
  }),
  vine: p('vine', {
    beats: 4, parts: ['legs'], mirror: true, travel: 0.32,
    keys: [
      [0, { x: 0.07, hips: 0.02, rf: [0.22, 0, 0], lf: [-W, 0, 0] }],
      [1, { x: 0.19, y: -0.03, twist: 6, rf: [0.22, 0, 0], lf: [0.29, 0, -0.08] }],
      [2, { x: 0.3, hips: 0.02, rf: [0.41, 0, 0], lf: [0.29, 0, -0.08] }],
      [3, { x: 0.32, y: -0.03, rf: [0.41, 0, 0], lf: [0.23, 0.02, 0.01] }],
    ],
  }),
  march: p('march', { beats: 2, parts: ['legs'], keys: [[0, marchA], [1, mir(marchA)]] }),
  tapSide: p('tapSide', {
    beats: 2, parts: ['legs'], mirror: true,
    keys: [
      [0, { y: -0.04, x: -0.02, lean: -3, rf: [0.3, 0, 0.02] }],
      [1, { y: 0.0, rf: [W, 0, 0] }],
    ],
  }),
  heelDig: p('heelDig', {
    beats: 2, parts: ['legs'], mirror: true,
    keys: [
      [0, { y: -0.045, x: -0.03, bend: -6, nod: 4, rf: [0.22, 0.03, 0.2] }],
      [1, { y: -0.015 }],
    ],
  }),
  kneeLift: p('kneeLift', {
    beats: 2, parts: ['legs'], mirror: true,
    keys: [
      [0, { x: -0.02, lean: -2, nod: 5, rf: [0.07, 0.23, 0.2] }],
      [1, { y: -0.02, nod: -2 }],
    ],
  }),
  kickSide: p('kickSide', {
    beats: 2, parts: ['legs'], mirror: true, torso: true,
    keys: [
      [0, { x: -0.035, lean: -13, head: 6, rf: [0.36, 0.16, 0.04] }],
      [1, { y: -0.04 }],
    ],
  }),
  kickFront: p('kickFront', {
    beats: 2, parts: ['legs'], mirror: true,
    keys: [
      [0, { x: -0.02, y: 0, bend: -5, rf: [0.09, 0.22, 0.4] }],
      [1, { y: -0.04 }],
    ],
  }),
  squat: p('squat', {
    beats: 2, parts: ['legs'], impact: true, torso: true,
    keys: [
      [0, { y: -0.2, bend: 14, nod: -8, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
      [1, { y: -0.01, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
    ],
  }),
  sumo: p('sumo', {
    beats: 2, parts: ['legs'], impact: true,
    keys: [
      [0, { y: -0.24, rf: [0.21, 0, 0], lf: [-0.21, 0, 0] }],
      [1, { y: -0.03, rf: [0.21, 0, 0], lf: [-0.21, 0, 0] }],
    ],
  }),
  sideLunge: p('sideLunge', {
    beats: 2, parts: ['legs'], mirror: true,
    keys: [
      [0, { x: 0.1, y: -0.1, hips: 0.01, rf: [0.31, 0, 0], lf: [-0.11, 0, 0] }],
      [1, { y: -0.02 }],
    ],
  }),
  jack: p('jack', {
    beats: 2, parts: ['jump', 'legs'], jump: true,
    keys: [
      [0, { y: -0.05, rf: [0.22, 0, 0], lf: [-0.22, 0, 0] }],
      [0.5, { y: 0.07, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
      [1, { y: -0.05, rf: [0.075, 0, 0], lf: [-0.075, 0, 0] }],
      [1.5, { y: 0.07, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
    ],
  }),
  jog: p('jog', { beats: 2, parts: ['jump', 'legs'], jump: true, keys: [[0, jogA], [0.5, jogDown], [1, mir(jogA)], [1.5, jogDown]] }),
  twist: p('twist', { beats: 2, parts: ['hips', 'torso'], torso: true, keys: [[0, twistA], [1, mir(twistA)]] }),
  boxStep: p('boxStep', {
    beats: 4, parts: ['legs'], mirror: true,
    keys: [
      [0, { x: -0.02, hipTwist: -8, rf: [-0.03, 0, 0.1], lf: [-W, 0, 0] }],
      [1, { x: -0.05, y: -0.02, rf: [-0.03, 0, 0.1], lf: [-0.13, 0, -0.1] }],
      [2, { x: 0.0, rf: [0.11, 0, -0.09], lf: [-0.13, 0, -0.1] }],
      [3, { x: 0.0, y: -0.03, rf: [0.11, 0, -0.09], lf: [-W, 0, 0.03] }],
    ],
  }),
};

// ---------------------------------------------------------------------------
// Arms

const GUARD = ARM.guard;
const OPEN_LOW: ArmAngles = [58, 0, 64, 4];
const CHEST_BOX = hand(-0.07, -0.02, 0.16, [1, -0.2, -0.3]);
const FIST = { handR: 0, handL: 0 } as const;
const OPEN = { handR: 1, handL: 1 } as const;

function A(spec: PoseSpec): PoseSpec {
  return spec;
}

const jabA = A({ twist: -14, turn: 8, r: ARM.jab, l: GUARD, ...FIST });
const skyA = A({ lean: 5, head: 3, nod: -6, r: ARM.sky, l: GUARD, ...FIST });
const crossA = A({ twist: -26, turn: 14, r: ARM.cross, l: GUARD, ...FIST });
const upperA = A({ twist: -12, turn: 6, nod: -4, r: hand(-0.09, 0.1, 0.17, [0.15, -1, 0.15]), l: GUARD, ...FIST });
const sidePunchA = A({ lean: -3, head: -3, r: [90, 0, 90, 0], l: GUARD, ...FIST });
const marchArmsA = A({ r: ARM.swingBack, l: ARM.swingFwd, ...FIST });
const rippleA = A({ lean: 3, head: -3, r: [100, 0, 64, 0], l: [80, 0, 116, 0], ...OPEN });
const pendA = A({ r: [52, 8, 58, 14], l: [38, 138, 46, 128], ...OPEN });
const oceanA = A({ lean: 11, head: 6, r: [128, 0, 134, 0], l: [186, 0, 214, 0], ...OPEN });
const oceanMid = A({ r: [160, 0, 167, 0], l: [160, 0, 167, 0], ...OPEN });
const swimA = A({ twist: -8, r: [162, 55, 166, 55], l: [28, -40, 32, -40], ...OPEN });
const airA = A({ lean: 13, head: 5, r: [90, 0, 90, 0], l: [90, 0, 90, 0], ...OPEN });
const climbA = A({ nod: -8, r: at(1, 0.03, 1.08, 0.08, [1, 0, -0.3]), l: at(-1, -0.03, 0.8, 0.13, [0.6, -1, -0.2]), handR: 0, handL: 0 });
const reachA = A({ lean: 6, r: [98, 0, 98, 0], l: CHEST_BOX, handR: 1, handL: 0 });
const curlUp: ArmAngles = [10, 20, 150, 75];
const curlDown: ArmAngles = [8, 10, 14, 25];

/** Cabbage-patch / rolling-arm circles from world-space hand positions. */
function circle(cx: number, cy: number, cz: number, r: number, phase: number, side: 1 | -1, elbow: readonly [number, number, number]): ArmAngles {
  return at(side, cx + r * Math.cos(phase), cy + r * Math.sin(phase), cz, elbow);
}
const Q = Math.PI / 2;
const cabbage = (k: number): PoseSpec => ({
  r: circle(0.08, 0.68, 0.17, 0.085, -k * Q, 1, [0.6, -1, -0.3]),
  l: circle(-0.08, 0.68, 0.17, 0.085, -k * Q, -1, [0.6, -1, -0.3]),
  hips: 0,
  ...FIST,
});
const lasso = (k: number): PoseSpec => ({ r: [162, 0, 150, k * 90], l: ARM.hip, handR: 0, handL: 0, nod: -4 });

export const ARMS: Record<string, Pattern> = {
  rest: p('rest', { beats: 2, parts: [], keys: [[0, { r: [16, 15, 34, 60], l: [9, -5, 18, 35] }], [1, { r: [9, -5, 18, 35], l: [16, 15, 34, 60] }]] }),
  hips: p('hips', { beats: 1, parts: [], keys: [[0, { r: ARM.hip, l: ARM.hip, ...FIST }]] }),
  guard: p('guard', { beats: 1, parts: [], keys: [[0, { r: GUARD, l: GUARD, ...FIST }]] }),
  clap: p('clap', { beats: 2, parts: ['arms'], keys: [[0, { r: OPEN_LOW, l: OPEN_LOW, ...OPEN }], [1, { r: ARM.clap, l: ARM.clap, ...OPEN }]] }),
  clapEvery: p('clapEvery', { beats: 1, parts: ['arms'], keys: [[0, { r: ARM.clap, l: ARM.clap, ...OPEN }], [0.5, { r: [40, 30, 50, 60], l: [40, 30, 50, 60], ...OPEN }]] }),
  clapHigh: p('clapHigh', { beats: 2, parts: ['arms'], keys: [[0, { r: [46, 0, 50, 0], l: [46, 0, 50, 0], ...OPEN }], [1, { nod: -6, r: ARM.clapHigh, l: ARM.clapHigh, ...OPEN }]] }),
  clapV: p('clapV', { beats: 2, parts: ['arms'], keys: [[0, { r: ARM.clap, l: ARM.clap, ...OPEN }], [1, { r: ARM.v, l: ARM.v, ...OPEN }]] }),
  jab: p('jab', { beats: 2, parts: ['arms'], torso: true, keys: [[0, jabA], [1, mir(jabA)]] }),
  skyPunch: p('skyPunch', { beats: 2, parts: ['arms'], torso: true, keys: [[0, skyA], [1, mir(skyA)]] }),
  crossJab: p('crossJab', { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, crossA], [1, mir(crossA)]] }),
  uppercut: p('uppercut', { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, upperA], [1, mir(upperA)]] }),
  sidePunch: p('sidePunch', { beats: 2, parts: ['arms'], torso: true, keys: [[0, sidePunchA], [1, mir(sidePunchA)]] }),
  shoulderPress: p('shoulderPress', { beats: 2, parts: ['arms'], keys: [[0, { nod: -5, r: ARM.up, l: ARM.up, ...FIST }], [1, { r: ARM.goal, l: ARM.goal, ...FIST }]] }),
  pushOut: p('pushOut', { beats: 2, parts: ['arms'], keys: [[0, { r: [88, 0, 92, -5], l: [88, 0, 92, -5], ...OPEN }], [1, { r: CHEST_BOX, l: CHEST_BOX, ...FIST }]] }),
  bicepCurl: p('bicepCurl', { beats: 2, parts: ['arms'], keys: [[0, { r: curlUp, l: curlUp, ...FIST }], [1, { r: curlDown, l: curlDown, ...FIST }]] }),
  latPull: p('latPull', { beats: 2, parts: ['arms'], keys: [[0, { nod: -4, r: ARM.v, l: ARM.v, ...OPEN }], [1, { r: [84, 0, 168, 8], l: [84, 0, 168, 8], ...FIST }]] }),
  butterfly: p('butterfly', {
    beats: 2, parts: ['arms'],
    keys: [
      [0, { r: ARM.goal, l: ARM.goal, ...FIST }],
      [1, { r: [75, 125, 160, 90], l: [75, 125, 160, 90], ...FIST }],
    ],
  }),
  marchArms: p('marchArms', { beats: 2, parts: ['arms'], keys: [[0, marchArmsA], [1, mir(marchArmsA)]] }),
  pullDown: p('pullDown', {
    beats: 2, parts: ['arms'],
    keys: [
      [0, { r: hand(-0.05, -0.27, 0.16, [0.6, 0.2, -1]), l: hand(-0.1, -0.27, 0.16, [0.6, 0.2, -1]), ...FIST }],
      [1, { r: ARM.v, l: ARM.v, ...OPEN }],
    ],
  }),
  ocean: p('ocean', { beats: 4, parts: ['arms', 'torso'], torso: true, keys: [[0, oceanA], [1, oceanMid], [2, mir(oceanA)], [3, oceanMid]] }),
  ripple: p('ripple', { beats: 2, parts: ['arms'], torso: true, keys: [[0, rippleA], [1, mir(rippleA)]] }),
  pendulum: p('pendulum', { beats: 2, parts: ['arms'], keys: [[0, pendA], [1, mir(pendA)]] }),
  rainbow: p('rainbow', {
    beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true,
    keys: [
      [0, { lean: -17, head: -8, r: [176, -20, 230, -15], l: ARM.hip, handR: 1, handL: 0 }],
      [1, { lean: 4, r: OPEN_LOW, l: ARM.hip, handR: 1, handL: 0 }],
    ],
  }),
  discoPoint: p('discoPoint', {
    beats: 2, parts: ['arms'], mirror: true, torso: true,
    keys: [
      [0, { head: 8, turn: 10, nod: -8, r: [142, 12, 144, 12], l: ARM.hip, handR: 0, handL: 0 }],
      [1, { head: -6, turn: -10, nod: 8, r: [48, 125, 44, 150], l: ARM.hip, handR: 0, handL: 0 }],
    ],
  }),
  hitchhike: p('hitchhike', {
    beats: 2, parts: ['arms'], mirror: true, torso: true,
    keys: [
      [0, { turn: 14, head: 4, r: [62, 0, 98, 8], l: ARM.hip, handR: 0, handL: 0 }],
      [1, { r: CHEST_BOX, l: ARM.hip, handR: 0, handL: 0 }],
    ],
  }),
  swim: p('swim', { beats: 2, parts: ['arms'], torso: true, keys: [[0, swimA], [1, mir(swimA)]] }),
  shoulderBounce: p('shoulderBounce', { beats: 1, parts: ['torso'], keys: [[0, { shR: 1.3, shL: 1.3, nod: 6, r: [20, 10, 64, 75], l: [20, 10, 64, 75] }], [0.5, { r: [16, 10, 56, 75], l: [16, 10, 56, 75] }]] }),
  shoulderRoll: p('shoulderRoll', {
    beats: 2, parts: ['torso'], mirror: true, torso: true,
    keys: [
      [0, { shR: 1, twist: -10, lean: -3, head: 4, r: [16, -10, 44, 75], l: [12, 10, 38, 70] }],
      [0.5, { shR: 0.7, twist: 6, lean: -1, head: 2, r: [14, -25, 40, 70], l: [12, 10, 38, 70] }],
      [1, { shR: 0, r: [12, 0, 36, 70], l: [12, 10, 38, 70] }],
    ],
  }),
  raiseRoof: p('raiseRoof', {
    beats: 1, parts: ['arms'],
    keys: [
      [0, { nod: -6, r: [148, 10, 172, 15], l: [148, 10, 172, 15], ...OPEN }],
      [0.5, { r: [80, 10, 160, 20], l: [80, 10, 160, 20], ...OPEN }],
    ],
  }),
  lasso: p('lasso', { beats: 2, parts: ['arms'], mirror: true, keys: [[0, lasso(0)], [0.5, lasso(1)], [1, lasso(2)], [1.5, lasso(3)]] }),
  cabbage: p('cabbage', { beats: 2, parts: ['arms'], keys: [[0, cabbage(0)], [0.5, cabbage(1)], [1, cabbage(2)], [1.5, cabbage(3)]] }),
  airplane: p('airplane', { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, airA], [1, mir(airA)]] }),
  xArms: p('xArms', {
    beats: 2, parts: ['arms'],
    keys: [
      [0, { r: hand(-0.2, -0.12, 0.21, [0.4, -1, -0.2]), l: hand(-0.22, -0.08, 0.25, [0.4, -1, -0.2]), ...FIST }],
      [1, { r: [128, 0, 132, 0], l: [128, 0, 132, 0], ...OPEN }],
    ],
  }),
  ropeClimb: p('ropeClimb', { beats: 2, parts: ['arms'], keys: [[0, climbA], [1, mir(climbA)]] }),
  sideReach: p('sideReach', { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, reachA], [1, { r: [20, 0, 26, 10], l: CHEST_BOX, handR: 1, handL: 0 }]] }),
  jackArms: p('jackArms', {
    beats: 2, parts: ['arms'],
    keys: [
      [0, { r: [142, 0, 148, 0], l: [142, 0, 148, 0], ...OPEN }],
      [0.5, { r: [82, 0, 86, 0], l: [82, 0, 86, 0], ...OPEN }],
      [1, { r: [16, 0, 18, 0], l: [16, 0, 18, 0], ...OPEN }],
      [1.5, { r: [80, 0, 84, 0], l: [80, 0, 84, 0], ...OPEN }],
    ],
  }),
  twistArms: p('twistArms', { beats: 1, parts: [], keys: [[0, { r: CHEST_BOX, l: CHEST_BOX, ...FIST }]] }),
  crunch: p('crunch', {
    beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true,
    keys: [
      // Left elbow down across to the rising right knee.
      [0, { twist: -22, bend: 10, lean: 6, nod: 8, r: [88, 0, 172, 10], l: at(-1, 0.03, 0.62, 0.17, [0.2, -1, 0.4]), ...FIST }],
      [1, { r: [88, 0, 172, 10], l: [88, 0, 172, 10], ...FIST }],
    ],
  }),
};

// ---------------------------------------------------------------------------
// Torso / head accents

const leanA: PoseSpec = { lean: 8, head: -5 };
const lookA: PoseSpec = { turn: 22, head: 4 };
export const ACCENT: Record<string, Pattern> = {
  lean: p('lean', { beats: 2, parts: ['torso'], keys: [[0, leanA], [1, mir(leanA)]] }),
  nod: p('nod', { beats: 1, parts: [], keys: [[0, { nod: 9 }], [0.5, { nod: -2 }]] }),
  look: p('look', { beats: 2, parts: [], keys: [[0, lookA], [1, mir(lookA)]] }),
  chestTwist: p('chestTwist', { beats: 2, parts: ['torso'], keys: [[0, { twist: 16, turn: -8 }], [1, { twist: -16, turn: 8 }]] }),
};

// ---------------------------------------------------------------------------

/** Mirror a spec (returns a spec-compatible full pose wrapper). */
function mir(s: PoseSpec): PoseSpec {
  return specFromPose(mirrored(pose(s)), s);
}

/** Convert a pose back into a spec, keeping only the keys `like` mentions (mirrored). */
function specFromPose(q: Pose, like: PoseSpec): PoseSpec {
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
  return o;
}
