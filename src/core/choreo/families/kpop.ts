/**
 * K-pop / J-pop point choreography building blocks (idol arm lines, hearts,
 * points, aegyo, hits, travelling formation steps, jump poses), plus
 * Bollywood and bhangra basics (thumka, light bulb, bhangra hop, dhamaal).
 * Individual moves only: the generator does the sequencing.
 */

import { ARM, FIST, OPEN, OPEN_LOW, at, mir, wide, type ArmAngles, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';
import { spinKeys } from './shared';

// ---------------------------------------------------------------------------
// Original point moves: gallop, lasso, point step.

const gallopA: PoseSpec = { y: -0.07, x: 0.02, hips: 0.02, rf: [0.15, 0, 0], lf: [-0.15, 0.05, 0.02], bend: 5 };
const gallopB: PoseSpec = { y: -0.03, x: 0.02, hips: 0.02, rf: [0.15, 0.02, 0], lf: [-0.15, 0.0, 0.0], bend: 3 };
const reinsAt = (y: number): PoseSpec => ({
  r: at(1, -0.025, y, 0.21, [0.7, -1, -0.2]),
  l: at(-1, 0.025, y - 0.015, 0.23, [0.7, -1, -0.2]),
  handR: 0, handL: 0,
});
const lasso = (k: number): PoseSpec => ({ r: [162, 0, 150, k * 90], l: ARM.hip, handR: 0, handL: 0, nod: -4 });
const pointFwdA: PoseSpec = { turn: 10, nod: -4, r: [122, 58, 122, 58], l: ARM.guard, handR: 0, handL: 0, formR: 'point' };

// ---------------------------------------------------------------------------
// Arm shapes (world hand positions via `at`; elbow hints [out, up, fwd]).

const OUT_DN = [1, -0.4, -0.2] as const; // elbow out and a little down
const OUT_UP = [1, 0.4, -0.2] as const; // elbow out and up
const DOWN = [0.3, -1, 0] as const; // elbow hanging
const straight = (e: number): ArmAngles => [e, 0, e, 0];

// Hearts and aegyo.
const heartTop: PoseSpec = { r: at(1, 0.035, 1.05, 0.05, OUT_UP), l: at(-1, -0.035, 1.05, 0.05, OUT_UP), ...OPEN };
const cheeks = (y: number, z: number): PoseSpec => ({ r: at(1, 0.115, y, z, DOWN), l: at(-1, -0.115, y, z, DOWN), ...FIST });
const bunny = (y: number, h: number): PoseSpec => ({ r: at(1, 0.11, y, 0.0, OUT_UP), l: at(-1, -0.11, y, 0.0, OUT_UP), handR: h, handL: h });
const chinFists: PoseSpec = { r: at(1, 0.06, 0.72, 0.15, DOWN), l: at(-1, -0.06, 0.72, 0.15, DOWN), ...FIST };
// Peace by the eye / salute: elbow out at face height.
const behindHead: PoseSpec = { r: at(1, 0.07, 0.98, -0.05, [1, 0.3, 0]), l: at(-1, -0.07, 0.98, -0.05, [1, 0.3, 0]), ...OPEN };
const claspA: PoseSpec = { head: 14, lean: 3, r: at(1, 0.17, 0.84, 0.12, DOWN), l: at(-1, 0.13, 0.82, 0.15, [0.3, -1, -0.2]), ...OPEN };
const paw = (k: 1 | -1): PoseSpec => ({
  head: 8 * k, r: at(1, 0.15, k > 0 ? 0.82 : 0.7, 0.17, DOWN), l: at(-1, -0.15, k > 0 ? 0.7 : 0.82, 0.17, DOWN), handR: k > 0 ? 0.2 : 0.6, handL: k > 0 ? 0.6 : 0.2,
});
const peaceA: PoseSpec = { head: 10, turn: 8, r: at(1, 0.11, 0.95, 0.13, [1, 0.1, -0.2]), l: ARM.hip, handR: 0.6, handL: 0 };
const saluteA: PoseSpec = { nod: -3, r: at(1, 0.09, 1.0, 0.12, [1, 0.15, -0.1]), l: ARM.hip, handR: 1, handL: 0 };
const saluteOut: PoseSpec = { turn: 14, nod: -6, r: at(1, 0.38, 1.02, 0.12, OUT_DN), l: ARM.hip, handR: 1, handL: 0 };
// Points and lines.
const doublePtA: PoseSpec = {
  twist: 10, turn: 24, lean: -3,
  r: [92, 6, 92, 6],
  l: at(-1, 0.1, 0.8, 0.24, [0.3, -1, -0.2]),
  ...FIST,
};
const diagA: PoseSpec = { lean: -5, turn: 16, nod: -5, r: straight(138), l: straight(42), ...OPEN };
const lArmsA: PoseSpec = { head: -6, turn: 10, r: ARM.up, l: ARM.out, ...OPEN };
// Clock: the right arm steps 12 -> 3 -> 6 -> 9 o'clock (screen view).
const clock = (r: ArmAngles, turn: number): PoseSpec => ({ turn, r, l: ARM.hip, handR: 1, handL: 0 });
const ACROSS: ArmAngles = at(1, -0.17, 0.8, 0.2, [0.3, -1, -0.3]);
// Chorus arms.
const pumpLow: PoseSpec = { shR: 0, shL: 0, r: at(1, 0.2, 0.47, 0.1, DOWN), l: at(-1, -0.2, 0.47, 0.1, DOWN), ...FIST };
const pumpUp: PoseSpec = { shR: 0.5, shL: 0.5, r: at(1, 0.19, 0.71, 0.16, DOWN), l: at(-1, -0.19, 0.71, 0.16, DOWN), ...FIST };
const crossHigh: PoseSpec = { nod: -6, r: at(1, -0.035, 0.99, 0.2, [1, 0, 0.1]), l: at(-1, 0.035, 1.01, 0.22, [1, 0, 0.1]), ...OPEN };
const clapChest: PoseSpec = { r: ARM.clap, l: ARM.clap, ...OPEN };
const clapApart: PoseSpec = { r: [40, 40, 52, 70], l: [40, 40, 52, 70], ...OPEN };
// Hair flip: hand sweeps from the temple out and down.
const hairA: PoseSpec = { head: 12, turn: -10, r: at(1, 0.11, 0.97, 0.1, [1, 0.1, -0.2]), l: ARM.hip, handR: 1, handL: 0 };
const hairB: PoseSpec = { head: -4, turn: 12, r: at(1, 0.34, 0.86, 0.06, OUT_DN), l: ARM.hip, handR: 1, handL: 0 };

// Bollywood / bhangra arms.
const thumkaArms: PoseSpec = { r: at(1, 0.03, 1.06, 0.06, OUT_UP), l: ARM.hip, handR: 1, handL: 0 };
const bulb = (k: number): PoseSpec => ({
  r: at(1, 0.28, 1.0 + 0.02 * k, 0.1, OUT_DN),
  l: at(-1, -0.27, 0.5 + 0.05 * k, 0.12, OUT_DN),
  handR: k > 0 ? 1 : 0.35, handL: k > 0 ? 0.5 : 1,
});
const bhangraUp = (s: number): PoseSpec => ({ shR: s, shL: s, r: s > 0 ? [150, 10, 168, 20] : [138, 10, 172, 25], l: s > 0 ? [150, 10, 168, 20] : [138, 10, 172, 25], ...OPEN });
const namaste: PoseSpec = { nod: 6, r: at(1, -0.01, 0.74, 0.17, OUT_DN), l: at(-1, 0.01, 0.74, 0.17, OUT_DN), ...OPEN };
const lotusLow: PoseSpec = { r: at(1, 0.03, 0.66, 0.2, DOWN), l: at(-1, -0.03, 0.66, 0.2, DOWN), ...OPEN };
const lotusHigh: PoseSpec = { nod: -10, r: at(1, 0.035, 1.07, 0.1, OUT_DN), l: at(-1, -0.035, 1.07, 0.1, OUT_DN), ...OPEN };

const jhummarA: PoseSpec = { lean: 6, head: -7, r: at(1, 0.34, 0.92, 0.12, OUT_DN), l: at(-1, -0.03, 0.75, 0.18, OUT_DN), ...OPEN };
const wiperA: PoseSpec = { lean: 3, head: -4, r: at(1, 0.25, 0.95, 0.14, [0.6, -1, 0]), l: at(-1, 0.03, 0.95, 0.2, [0.6, -1, 0]), ...OPEN };
const dandiyaHigh: PoseSpec = { twist: -14, turn: 14, r: at(1, 0.19, 0.9, 0.12, OUT_DN), l: at(-1, 0.14, 0.87, 0.13, [0.3, -1, -0.2]), ...FIST };
const dandiyaOpen: PoseSpec = { twist: 0, turn: 0, r: [60, 10, 66, 20], l: [60, 10, 66, 20], ...FIST };
const dandiyaLow: PoseSpec = { twist: 14, turn: -14, r: at(1, -0.13, 0.6, 0.15, [0.3, -1, -0.2]), l: at(-1, -0.17, 0.6, 0.12, OUT_DN), ...FIST };
const kiteUp: PoseSpec = { twist: 16, turn: 18, nod: -8, r: at(1, 0.27, 1.03, 0.1, OUT_DN), l: at(-1, 0.02, 0.84, 0.2, [0.3, -1, -0.2]), ...FIST };
const kiteDown: PoseSpec = { twist: -6, turn: 6, nod: 2, r: at(1, 0.0, 0.66, 0.18, DOWN), l: at(-1, -0.16, 0.6, 0.14, DOWN), ...FIST };

export const patterns: PatternSet = {
  foot: {
    gallop: { beats: 2, parts: ['legs'], keys: [[0, gallopA], [0.5, gallopB], [1, mir(gallopA)], [1.5, mir(gallopB)]] },
    // V step: out-forward right, out-forward left, back in right, back in left.
    vStep: {
      beats: 4, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.04, x: 0.02, rf: [0.19, 0, 0.13], lf: [-0.09, 0, 0] }],
        [1, { y: -0.05, x: 0, rf: [0.19, 0, 0.13], lf: [-0.19, 0, 0.13] }],
        [2, { y: -0.03, x: -0.02, rf: [0.09, 0, 0], lf: [-0.19, 0, 0.13] }],
        [3, { y: -0.02, x: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0] }],
      ],
    },
    // Isolation step: hips go out while the rib cage slides the other way.
    isoStep: {
      beats: 2, parts: ['hips', 'torso'], mirror: true, torso: true,
      keys: [
        [0, { x: 0.04, y: -0.05, hips: 0.07, tilt: 8, chestX: -0.065, lean: -4, head: 5, rf: [0.21, 0, 0], lf: [-0.09, 0, 0] }],
        [1, { x: 0.0, y: -0.02, hips: -0.02, chestX: 0.03, lean: 2, rf: [0.11, 0, 0], lf: [-0.09, 0, 0] }],
      ],
    },
    // Big side slide: lunge out, drag the trailing foot in.
    slide: {
      beats: 2, parts: ['legs'], mirror: true, travel: 0.26,
      keys: [
        [0, { x: 0.13, y: -0.11, hips: 0.02, rf: [0.33, 0, 0], lf: [-0.09, 0, 0], kneeL: -0.1 }],
        [1, { x: 0.26, y: -0.03, rf: [0.35, 0, 0], lf: [0.2, 0.01, 0] }],
      ],
    },
    // Cross in front travelling step (formation travel).
    crossTravel: {
      beats: 4, parts: ['legs'], mirror: true, travel: 0.3,
      keys: [
        [0, { x: 0.07, hips: 0.02, rf: [0.22, 0, 0], lf: [-0.09, 0, 0] }],
        [1, { x: 0.17, y: -0.04, hipTwist: 12, rf: [0.22, 0, 0], lf: [0.27, 0, 0.1] }],
        [2, { x: 0.28, hips: 0.02, rf: [0.4, 0, 0], lf: [0.27, 0, 0.1] }],
        [3, { x: 0.3, y: -0.03, rf: [0.4, 0, 0], lf: [0.28, 0.06, 0.02] }],
      ],
    },
    // Swag walk: heavy shoulder-led step, dragging the other foot.
    swagWalk: {
      beats: 2, parts: ['legs', 'torso'], mirror: true, travel: 0.2, torso: true,
      keys: [
        [0, { x: 0.1, y: -0.07, hips: 0.03, lean: 6, twist: 14, head: -5, turn: -8, shR: 0, shL: 0.6, rf: [0.26, 0, 0], lf: [-0.09, 0, 0] }],
        [1, { x: 0.2, y: -0.02, hips: -0.01, lean: -2, twist: -4, head: 2, turn: 0, rf: [0.27, 0, 0], lf: [0.14, 0.03, 0.01] }],
      ],
    },
    // Thumka: a sharp hip pop out to one side, twice.
    thumka: {
      beats: 2, parts: ['hips'], mirror: true, torso: true,
      keys: [
        [0, { y: -0.05, hips: 0.088, tilt: 13, lean: -5, head: 8, rf: [0.11, 0, 0], lf: [-0.1, 0.03, 0.03], kneeL: -0.15 }],
        [0.5, { y: -0.03, hips: 0.02, tilt: 2, lean: -1, head: 3, rf: [0.11, 0, 0], lf: [-0.1, 0, 0.02] }],
        [1, { y: -0.05, hips: 0.088, tilt: 13, lean: -5, head: 8, rf: [0.11, 0, 0], lf: [-0.1, 0.03, 0.03], kneeL: -0.15 }],
        [1.5, { y: -0.02, hips: 0.0, tilt: 0, lean: 0, head: 0, rf: [0.11, 0, 0], lf: [-0.1, 0, 0] }],
      ],
    },
    // Bhangra hop: hop on one foot, the other knee lifted high.
    bhangraHop: {
      beats: 2, parts: ['jump', 'legs'], jump: true,
      keys: [
        [0, { y: 0.045, x: -0.015, rf: [0.08, 0.25, 0.14], lf: [-0.09, 0.02, 0] }],
        [0.5, { y: -0.07, rf: [0.1, 0, 0.02], lf: [-0.1, 0, 0] }],
        [1, { y: 0.045, x: 0.015, lf: [-0.08, 0.25, 0.14], rf: [0.09, 0.02, 0] }],
        [1.5, { y: -0.07, rf: [0.1, 0, 0], lf: [-0.1, 0, 0.02] }],
      ],
    },
    // Dhamaal: two-foot bounce jumps, knees bent on landing.
    dhamaal: {
      beats: 1, parts: ['jump', 'legs'], jump: true, impact: true,
      keys: [
        [0, { y: -0.1, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.15, kneeL: 0.15 }],
        [0.5, { y: 0.07, rf: [0.12, 0.04, 0], lf: [-0.12, 0.04, 0] }],
      ],
    },
    // Chaffa: hop on the left, swing the right foot low across the front.
    chaffa: {
      beats: 2, parts: ['legs', 'jump'], mirror: true, jump: true,
      keys: [
        [0, { y: 0.03, x: -0.02, lean: 3, rf: [0.0, 0.1, 0.18], lf: [-0.09, 0.02, 0] }],
        [0.5, { y: -0.06, rf: [0.11, 0, 0], lf: [-0.09, 0, 0] }],
        [1, { y: 0.03, x: -0.01, rf: [0.24, 0.08, 0.06], lf: [-0.09, 0.02, 0] }],
        [1.5, { y: -0.06, rf: [0.11, 0, 0], lf: [-0.09, 0, 0] }],
      ],
    },
  },
  arms: {
    reins: { beats: 1, parts: ['arms'], keys: [[0, reinsAt(0.6)], [0.5, reinsAt(0.65)]] },
    lasso: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, lasso(0)], [0.5, lasso(1)], [1, lasso(2)], [1.5, lasso(3)]] },
    pointFwd: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, pointFwdA], [1, { r: ARM.guard, l: ARM.guard, handR: 0, handL: 0 }]] },
    // Hearts and aegyo
    bigHeart: { beats: 2, parts: ['arms'], torso: true, keys: [[0, { ...heartTop, head: 8, nod: 4 }], [1, { r: OPEN_LOW, l: OPEN_LOW, ...OPEN, head: 0, nod: 0 }]] },
    cheekTap: {
      beats: 2, parts: ['arms'], torso: true,
      keys: [[0, { ...cheeks(0.9, 0.09), head: 13 }], [0.5, { ...cheeks(0.88, 0.15), head: 5 }], [1, { ...cheeks(0.9, 0.09), head: -13 }], [1.5, { ...cheeks(0.88, 0.15), head: -5 }]],
    },
    bunnyEars: { beats: 1, parts: ['arms'], torso: true, keys: [[0, { ...bunny(1.1, 1), nod: -4 }], [0.5, { ...bunny(1.05, 0.2), nod: 2 }]] },
    shyShoulders: {
      beats: 2, parts: ['torso'], torso: true,
      keys: [[0, { ...chinFists, shR: 1.2, shL: 1.2, head: 12, nod: 6 }], [0.5, { ...chinFists, shR: 0.2, shL: 0.2, head: 4 }], [1, { ...chinFists, shR: 1.2, shL: 1.2, head: -12, nod: 6 }], [1.5, { ...chinFists, shR: 0.2, shL: 0.2, head: -4 }]],
    },
    peaceEye: { beats: 2, parts: ['arms'], torso: true, keys: [[0, peaceA], [1, mir(peaceA)]] },
    salute: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, saluteA], [1, saluteOut]] },
    hairFlip: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, hairA], [1, hairB]] },
    behindHead: {
      beats: 2, parts: ['arms', 'hips'], torso: true,
      keys: [[0, { ...behindHead, head: 8, lean: -3 }], [1, { ...behindHead, head: -8, lean: 3 }]],
    },
    cuteClasp: { beats: 2, parts: ['arms'], torso: true, keys: [[0, claspA], [1, mir(claspA)]] },
    catPaws: { beats: 1, parts: ['arms'], torso: true, keys: [[0, paw(1)], [0.5, paw(-1)]] },
    // Points and lines
    doublePoint: { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, doublePtA], [1, mir(doublePtA)]] },
    diagonal: { beats: 2, parts: ['arms'], torso: true, keys: [[0, diagA], [1, mir(diagA)]] },
    lArms: { beats: 2, parts: ['arms'], torso: true, keys: [[0, lArmsA], [1, mir(lArmsA)]] },
    clockArm: {
      beats: 4, parts: ['arms'], mirror: true, torso: true,
      keys: [[0, clock(ARM.up, 0)], [1, clock(ARM.out, 18)], [2, clock(straight(12), 6)], [3, clock(ACROSS, -16)]],
    },
    // Chorus arms
    armCircle: {
      beats: 4, parts: ['arms'],
      keys: [
        [0, { nod: -5, r: straight(168), l: straight(168), ...OPEN }],
        [1, { nod: 0, r: straight(95), l: straight(95), ...OPEN }],
        [2, { r: straight(30), l: straight(30), ...OPEN }],
        [2.5, { r: at(1, -0.06, 0.5, 0.2, DOWN), l: at(-1, 0.06, 0.52, 0.22, DOWN), ...OPEN }],
        [3, { r: at(1, -0.03, 0.8, 0.28, DOWN), l: at(-1, 0.03, 0.82, 0.28, DOWN), ...OPEN }],
      ],
    },
    pumpOpen: {
      beats: 4, parts: ['arms'],
      keys: [[0, pumpLow], [0.5, pumpUp], [1, pumpLow], [1.5, pumpUp], [2, { shR: 0, shL: 0, r: ARM.v, l: ARM.v, ...OPEN }], [3, { r: straight(132), l: straight(132), ...OPEN }]],
    },
    crossOverhead: { beats: 2, parts: ['arms'], torso: true, keys: [[0, crossHigh], [1, { nod: 0, r: ARM.out, l: ARM.out, ...OPEN }]] },
    fanChant: {
      beats: 4, parts: ['arms'],
      keys: [[0, clapChest], [0.5, clapApart], [1, clapChest], [1.5, clapApart], [2, clapChest], [3, { r: ARM.v, l: ARM.v, ...OPEN }]],
    },
    // Bollywood / bhangra
    thumkaArm: { beats: 1, parts: ['arms'], keys: [[0, thumkaArms]] },
    lightBulb: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, bulb(1)], [0.5, bulb(-1)], [1, bulb(1)], [1.5, bulb(-1)]] },
    bhangraOneUp: { beats: 1, parts: ['arms'], mirror: true, keys: [[0, { shR: 0.9, shL: 0.9, r: [168, 10, 174, 15], l: at(-1, -0.33, 0.86, 0.06, OUT_DN), ...OPEN }], [0.5, { shR: 0, shL: 0, r: [160, 10, 168, 15], l: at(-1, -0.32, 0.82, 0.06, OUT_DN), ...OPEN }]] },
    bhangraArms: { beats: 1, parts: ['arms'], keys: [[0, bhangraUp(0.9)], [0.5, bhangraUp(0)]] },
    dhamaalPump: {
      beats: 2, parts: ['arms'],
      keys: [[0, { r: [176, 10, 178, 10], l: [176, 10, 178, 10], ...FIST }], [0.5, { r: [100, 10, 172, 15], l: [100, 10, 172, 15], ...FIST }], [1, { r: [176, 10, 178, 10], l: [176, 10, 178, 10], ...FIST }], [1.5, { r: [100, 10, 172, 15], l: [100, 10, 172, 15], ...FIST }]],
    },
    handFlick: { beats: 1, parts: ['arms'], keys: [[0, { r: at(1, 0.27, 0.62, 0.17, OUT_DN), l: at(-1, -0.27, 0.62, 0.17, OUT_DN), ...OPEN }], [0.5, { r: at(1, 0.07, 0.72, 0.17, DOWN), l: at(-1, -0.07, 0.72, 0.17, DOWN), ...FIST }]] },
    jhummar: { beats: 2, parts: ['arms'], torso: true, keys: [[0, jhummarA], [1, mir(jhummarA)]] },
    wiper: { beats: 2, parts: ['arms'], torso: true, keys: [[0, wiperA], [1, mir(wiperA)]] },
    dandiya: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, dandiyaHigh], [0.5, dandiyaOpen], [1, dandiyaLow], [1.5, dandiyaOpen]] },
    kitePull: { beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true, keys: [[0, kiteUp], [0.5, kiteDown], [1, kiteUp], [1.5, kiteDown]] },
    matka: { beats: 1, parts: ['arms'], mirror: true, keys: [[0, { r: at(1, 0.2, 1.03, 0.03, [1, 0.6, 0]), l: ARM.hip, handR: 1, handL: 0 }]] },
    boli: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: -10, turn: -10, nod: -6, r: at(1, 0.16, 0.95, 0.03, [1, 0.1, -0.1]), l: straight(140), handR: 1, handL: 1 }],
        [1, { head: -6, turn: -6, nod: -3, r: at(1, 0.16, 0.95, 0.03, [1, 0.1, -0.1]), l: straight(128), handR: 1, handL: 1 }],
      ],
    },
    namasteOpen: { beats: 2, parts: ['arms'], keys: [[0, namaste], [1, { nod: -4, r: [96, 30, 100, 40], l: [96, 30, 100, 40], ...OPEN }]] },
    lotus: { beats: 2, parts: ['arms'], keys: [[0, lotusLow], [1, lotusHigh]] },
  },
};

// Full-body pose moments.
const SH_ARM: ArmAngles = ARM.hip;
const rain = (y: number, hy: number, x: number, h: number): PoseSpec => ({ y, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: at(1, x, hy, 0.16, OUT_DN), l: at(-1, -x, hy, 0.16, OUT_DN), handR: h, handL: h });
const GHOOMAR: PoseSpec = { r: at(1, 0.13, 1.07, 0.06, OUT_UP), l: at(-1, -0.13, 1.07, 0.06, OUT_UP), ...OPEN };
const TURN_OPEN: ArmAngles = [70, 10, 74, 10];
const TURN_IN: ArmAngles = [36, 30, 46, 50];
const starPrep: PoseSpec = { y: -0.15, bend: 12, nod: -6, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: at(1, -0.05, 0.5, 0.18, DOWN), l: at(-1, 0.05, 0.52, 0.2, DOWN), ...FIST };

export const moves: MoveDef[] = [
  // --- Point steps (original set)
  combo('gallop', 'Gallop', 'gallop', 'reins', 'mid', 2, 'kpop pop | full |', { desc: 'Bouncing wide stance, wrists crossed like holding reins, shuffling side to side.' }),
  combo('gallop-lasso', 'Gallop Lasso', 'gallop', 'lasso', 'mid', 2, 'kpop pop | full |'),
  combo('lasso', 'Lasso', 'sway', 'lasso', 'mid', 2, 'hiphop pop kpop | arms |'),
  combo('point-step', 'Point Step', 'stepTouch', 'pointFwd', 'mid', 2, 'kpop pop | arms | point'),
  combo('toe-tap-point', 'Toe Tap Point', 'toeTap', 'pointFwd', 'mid', 2, 'kpop | legs arms | point'),

  // --- Hearts and aegyo
  combo('big-heart', 'Big Heart', 'sway', 'bigHeart', 'low', 1, 'kpop pop | arms | hands', { desc: 'Swaying, bring both hands together on top of the head, elbows out, to make a big heart, then open low.' }),
  combo('cheek-tap-sway', 'Cheek Tap Sway', 'sway', 'cheekTap', 'low', 1, 'kpop | arms | hands', { desc: 'Fists by the cheeks, tapping them while the head tilts side to side with the sway.' }),
  combo('bunny-ears', 'Bunny Ears', 'bounce', 'bunnyEars', 'low', 1, 'kpop | arms | hands', { desc: 'Hands up beside the top of the head like ears, flapping on every half beat with a knee bounce.' }),
  combo('shy-shoulders', 'Shy Shoulders', 'sway', 'shyShoulders', 'low', 1, 'kpop | full |', { desc: 'Fists under the chin, shoulders shrug up with a head tilt, alternating sides.' }),
  combo('hands-behind-head', 'Hands Behind Head', 'hipSway', 'behindHead', 'low', 1, 'kpop pop | hips arms |', { desc: 'Hands behind the head with the elbows wide, swaying the hips side to side with a head tilt.' }),
  combo('cute-clasp-sway', 'Cute Clasp Sway', 'sway', 'cuteClasp', 'low', 1, 'kpop pop | arms | hands', { desc: 'Hands clasped together beside one cheek, head tilted onto them, swaying them over to the other cheek.' }),
  combo('cat-paws', 'Cat Paws', 'bounce', 'catPaws', 'low', 1, 'kpop | arms | hands', { desc: 'Loose fists up by the shoulders, pawing down one after the other on the half beat, head tilting with them.' }),
  combo('peace-eyes', 'Peace by the Eyes', 'sway', 'peaceEye', 'low', 1, 'kpop pop | arms | hands', { desc: 'Peace sign beside the eye, elbow out to the side, other hand on the hip; switch sides.' }),
  combo('salute-flick', 'Salute Flick', 'tapSide', 'salute', 'mid', 2, 'kpop | arms | hands', { desc: 'Hand to the brow in a salute, then flick it out high to the side as the foot taps out.' }),
  combo('hair-flip', 'Hair Flip', 'sway', 'hairFlip', 'low', 1, 'kpop pop | arms |', { desc: 'Hand at the temple sweeps the hair back and out to the side, head tilting away.' }),

  // --- Points and arm lines
  combo('twin-point', 'Twin Point', 'twoStep', 'doublePoint', 'mid', 2, 'kpop pop | arms | point', { desc: 'Both index fingers point the same way at shoulder height, one arm straight and one across the chest; switch sides.' }),
  combo('diagonal-line', 'Diagonal Line', 'plant', 'diagonal', 'mid', 1, 'kpop pop | arms |', { desc: 'Both arms straight in one diagonal line, high on one side and low on the other; flip it on the beat.' }),
  combo('l-arms', 'L-Arms', 'bounce', 'lArms', 'mid', 1, 'kpop hiphop | arms |', { desc: 'One arm straight up, the other straight out to the side, making a big L; flip it on the beat.' }),
  combo('clock-arms', 'Clock Arms', 'plant', 'clockArm', 'mid', 2, 'kpop | arms | point', { desc: 'One straight arm ticks round like a clock hand: up, out, down, across; then the other arm.' }),

  // --- Chorus arms
  combo('pump-pump-open', 'Pump Pump Open', 'groove', 'pumpOpen', 'mid', 2, 'kpop pop | arms | punch', { desc: 'Fists pump down by the hips twice, then the arms fly open to a high V.' }),
  combo('cross-overhead', 'Cross Overhead', 'sway', 'crossOverhead', 'low', 1, 'kpop pop | arms |', { desc: 'Wrists cross above the head, then open the arms straight out to a T.' }),
  combo('big-arm-circle', 'Big Arm Circle', 'bounce', 'armCircle', 'low', 1, 'kpop aerobic | arms | wave', { desc: 'Both straight arms circle together: up overhead, out to the sides, down, crossing low in front and back up.' }),
  combo('fan-chant-clap', 'Fan Chant Clap', 'bounce', 'fanChant', 'low', 1, 'kpop pop | arms | clap', { desc: 'Three quick claps at the chest, then throw both arms up in a V.' }),

  full({
    id: 'rain-down', name: 'Rain Down', tags: 'kpop pop | arms legs | wave hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Fingers fluttering, hands float down from overhead past the face and chest to the hips as the knees sink, then sweep back up.',
    keys: [
      [0, { y: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], nod: -6, r: straight(150), l: straight(150), ...OPEN }],
      [0.5, { ...rain(-0.03, 0.97, 0.16, 0.4), nod: -2 }],
      [1, { ...rain(-0.06, 0.82, 0.17, 1), nod: 2 }],
      [1.5, { ...rain(-0.09, 0.68, 0.18, 0.4), nod: 5 }],
      [2, { ...rain(-0.13, 0.52, 0.21, 1), nod: 8 }],
      [3, { y: -0.04, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], nod: 0, r: straight(95), l: straight(95), ...OPEN }],
    ],
  }),
  // --- Steps
  combo('v-step', 'V Step', 'vStep', 'hips', 'low', 1, 'kpop aerobic | legs | walk', { desc: 'Step out forward right, out forward left, back in right, back in left: the feet draw a V.' }),
  combo('isolation-step', 'Isolation Step', 'isoStep', 'rest', 'mid', 2, 'kpop hiphop | hips full |', { desc: 'Step out and push the hip out while the rib cage slides the opposite way.' }),
  combo('slide-sweep', 'Side Slide Sweep', 'slide', 'crossOverhead', 'mid', 2, 'kpop pop | full | walk', { desc: 'Big lunging slide to the side dragging the trailing foot in, arms crossing overhead and opening.' }),
  combo('cross-step-travel', 'Cross Step Travel', 'crossTravel', 'doublePoint', 'mid', 3, 'kpop | full | walk point', { desc: 'Travel sideways crossing the back foot in front, pointing both hands the way you go.' }),

  combo('wiper-hands', 'Wiper Hands', 'bounce', 'wiper', 'low', 1, 'kpop pop | arms | hands wave', { desc: 'Both palms up at face height, wiping side to side together like windscreen wipers.' }),
  full({
    id: 'shoulder-dance', name: 'Shoulder Dance', tags: 'kpop | full |', beats: 2, level: 'low', d: 1, parts: ['torso'],
    desc: 'Lift one shoulder high with the head tilting toward it, then the other, on a soft knee bounce.',
    keys: [
      [0, { y: -0.04, x: 0.01, shR: 1.3, shL: 0, head: 12, lean: -3, r: SH_ARM, l: SH_ARM, ...FIST }],
      [0.5, { y: -0.015, shR: 0.2, shL: 0.1, head: 3, r: SH_ARM, l: SH_ARM, ...FIST }],
      [1, { y: -0.04, x: -0.01, shL: 1.3, shR: 0, head: -12, lean: 3, r: SH_ARM, l: SH_ARM, ...FIST }],
      [1.5, { y: -0.015, shL: 0.2, shR: 0.1, head: -3, r: SH_ARM, l: SH_ARM, ...FIST }],
    ],
  }),
  full({
    id: 'kick-step-point', name: 'Kick Step Point', tags: 'kpop hiphop | legs arms | kick point', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Kick low to the front with fists pulled in, step that foot out wide and point down the diagonal.',
    keys: [
      [0, { y: -0.01, x: -0.02, bend: -4, rf: [0.1, 0.14, 0.3], lf: [-0.09, 0, 0], r: at(1, 0.07, 0.72, 0.17, DOWN), l: at(-1, -0.07, 0.72, 0.17, DOWN), ...FIST }],
      [0.5, { y: -0.08, x: 0.03, rf: [0.22, 0, 0.02], lf: [-0.1, 0, 0], turn: 20, nod: 8, r: straight(38), l: ARM.hip, ...FIST }],
      [1, { y: -0.07, x: 0.03, rf: [0.22, 0, 0.02], lf: [-0.1, 0, 0], turn: 20, nod: 8, r: straight(40), l: ARM.hip, ...FIST }],
      [1.5, { y: -0.03, x: 0, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], turn: 0, nod: 0, r: [30, 20, 50, 40], l: ARM.hip, ...FIST }],
    ],
  }),
  full({
    id: 'lunge-line', name: 'Lunge Line Pose', tags: 'kpop | full | point', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, icon: 1,
    desc: 'Drop into a deep side lunge with both arms in one long diagonal line down the bent leg, hold, then push back up.',
    keys: [
      [0, { x: 0.12, y: -0.17, hips: 0.02, lean: 6, turn: 22, nod: 6, rf: [0.36, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.15, r: straight(38), l: straight(146), ...OPEN }],
      [1, { x: 0.13, y: -0.19, hips: 0.02, lean: 7, turn: 24, nod: 7, rf: [0.36, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.15, r: straight(36), l: straight(148), ...OPEN }],
      [2, { x: 0.05, y: -0.04, lean: 0, turn: 0, nod: 0, rf: [0.2, 0, 0], lf: [-0.1, 0, 0], r: straight(80), l: straight(80), ...OPEN }],
      [3, { x: 0, y: -0.03, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: [30, 20, 44, 40], l: [30, 20, 44, 40], ...OPEN }],
    ],
  }),
  combo('swag-walk', 'Swag Walk', 'swagWalk', 'marchArms', 'low', 2, 'kpop hiphop | legs full | walk', { desc: 'Heavy, shoulder-led side step with a lean into it, arms swinging loose, dragging the other foot in.' }),
  // --- Turns, hits and jumps
  full({
    id: 'jump-lunge-pose', name: 'Jump Lunge Pose', tags: 'kpop | full | jump punch', beats: 4, level: 'high', d: 3, parts: ['jump', 'legs', 'arms'], jump: true, mirror: true, icon: 2,
    desc: 'Crouch, spring up and land in a wide side lunge with one fist punched up the diagonal, hold, then recover.',
    keys: [
      [0, { y: -0.11, bend: 8, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: at(1, -0.04, 0.55, 0.18, DOWN), l: at(-1, 0.04, 0.56, 0.2, DOWN), ...FIST }],
      [0.5, { y: 0.09, x: 0.05, rf: [0.17, 0.04, 0], lf: [-0.06, 0.04, 0], r: [60, 20, 66, 30], l: [100, 10, 110, 10], ...FIST }],
      [1, { x: 0.1, y: -0.16, lean: -6, turn: 24, nod: -4, hips: 0.02, rf: [0.33, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.15, r: ARM.hip, l: straight(146), ...FIST }],
      [2, { x: 0.1, y: -0.17, lean: -6, turn: 24, nod: -4, hips: 0.02, rf: [0.33, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.15, r: ARM.hip, l: straight(148), ...FIST }],
      [3, { x: 0.02, y: -0.04, rf: [0.12, 0, 0], lf: [-0.1, 0, 0], r: [24, 10, 40, 30], l: [30, 10, 44, 30], ...FIST }],
    ],
  }),
  full({
    id: 'spin-point', name: 'Spin & Point', tags: 'kpop pop | turn arms | spin point', beats: 4, level: 'mid', d: 3, parts: ['turn', 'arms'],
    desc: 'Full turn on the balls of the feet, arms tucked, then hit a point up to the diagonal and hold.',
    keys: [
      ...spinKeys(0).map(([t, s]) => [t, { ...s, r: at(1, 0.06, 0.72, 0.16, DOWN), l: at(-1, -0.06, 0.72, 0.16, DOWN), ...FIST }] as const),
      [2, { y: -0.04, rf: [0.12, 0, 0], lf: [-0.09, 0, 0], lean: -4, turn: 18, nod: -6, r: straight(140), l: ARM.hip, ...FIST }],
      [3, { y: -0.02, rf: [0.12, 0, 0], lf: [-0.09, 0, 0], lean: -3, turn: 16, nod: -5, r: straight(136), l: ARM.hip, ...FIST }],
    ],
  }),
  full({
    id: 'clap-turn', name: 'Clap & Turn', tags: 'kpop pop | turn | clap spin', beats: 4, level: 'mid', d: 3, parts: ['turn', 'arms'],
    desc: 'Two claps at the chest, then a full turn with the arms opening wide.',
    keys: [
      [0, { y: -0.04, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...clapChest }],
      [0.5, { y: -0.01, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...clapApart }],
      [1, { y: -0.04, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...clapChest }],
      ...spinKeys(2).map(([t, s]) => [t, { ...s, r: t < 3.5 ? TURN_OPEN : TURN_IN, l: t < 3.5 ? TURN_OPEN : TURN_IN, ...OPEN }] as const),
    ],
  }),
  full({
    id: 'freeze-hit', name: 'Freeze Hit', tags: 'kpop hiphop | full | point', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Loose bounce, then snap into a sharp pose (one arm up on the diagonal, the other across, head snapped) and freeze.',
    keys: [
      [0, { y: -0.04, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: ARM.rest, l: ARM.rest, ...OPEN }],
      [0.5, { y: -0.02, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [24, 20, 40, 40], l: [24, 20, 40, 40], ...OPEN }],
      [1, { y: -0.07, x: 0.03, rf: [0.17, 0, 0], lf: [-0.11, 0, 0], lean: -6, turn: 30, nod: -6, r: straight(140), l: at(-1, 0.08, 0.74, 0.2, [0.3, -1, -0.2]), ...FIST }],
      [1.5, { y: -0.07, x: 0.03, rf: [0.17, 0, 0], lf: [-0.11, 0, 0], lean: -6, turn: 30, nod: -6, r: straight(141), l: at(-1, 0.08, 0.745, 0.2, [0.3, -1, -0.2]), ...FIST }],
    ],
  }),
  full({
    id: 'star-jump-pose', name: 'Star Jump Pose', tags: 'kpop aerobic | full | jump', beats: 4, level: 'high', d: 2, parts: ['jump', 'legs', 'arms'], jump: true, icon: 2,
    desc: 'Crouch with fists crossed low, explode into a star jump, land wide and hit the pose with arms in a high V.',
    keys: [
      [0, starPrep],
      [1, { y: 0.13, rf: [0.2, 0.06, 0], lf: [-0.2, 0.06, 0], r: straight(140), l: straight(140), ...OPEN }],
      [2, wide(-0.09, { rf: [0.19, 0, 0], lf: [-0.19, 0, 0], nod: -6, r: straight(142), l: straight(142), ...OPEN })],
      [3, wide(-0.04, { rf: [0.19, 0, 0], lf: [-0.19, 0, 0], r: straight(70), l: straight(70), ...OPEN })],
    ],
  }),

  full({
    id: 'tuck-open', name: 'Tuck & Open', tags: 'kpop aerobic | full | jump', beats: 4, level: 'high', d: 3, parts: ['jump', 'legs', 'arms'], jump: true, icon: 1,
    desc: 'Tuck jump with the knees up and arms hugging in, land wide and fling the arms open to the sides.',
    keys: [
      [0, { y: -0.13, bend: 10, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: [30, -40, 34, -40], l: [30, -40, 34, -40], ...FIST }],
      [1, { y: 0.15, rf: [0.08, 0.15, 0.12], lf: [-0.08, 0.15, 0.12], nod: 6, r: at(1, 0.06, 0.62, 0.22, DOWN), l: at(-1, -0.06, 0.62, 0.22, DOWN), ...FIST }],
      [2, wide(-0.1, { rf: [0.18, 0, 0], lf: [-0.18, 0, 0], nod: -5, r: straight(100), l: straight(100), ...OPEN })],
      [3, wide(-0.03, { rf: [0.16, 0, 0], lf: [-0.16, 0, 0], r: [40, 10, 46, 20], l: [40, 10, 46, 20], ...OPEN })],
    ],
  }),
  full({
    id: 'low-high-clap', name: 'Low High Clap', tags: 'kpop aerobic | full | clap', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Dip and clap low by the hip, then rise and clap high above the head.',
    keys: [
      [0, { y: -0.12, lean: 8, bend: 10, nod: 6, rf: [0.14, 0, 0], lf: [-0.13, 0, 0], r: at(1, 0.04, 0.56, 0.15, DOWN), l: at(-1, 0.02, 0.57, 0.17, DOWN), ...OPEN }],
      [1, { y: 0.0, lean: -4, nod: -8, rf: [0.12, 0, 0], lf: [-0.11, 0.02, 0.01], r: ARM.clapHigh, l: ARM.clapHigh, ...OPEN }],
    ],
  }),
  // --- Bollywood
  combo('thumka', 'Thumka', 'thumka', 'thumkaArm', 'mid', 2, 'kpop latin | hips | hips shake bollywood', { desc: 'Hand on hip, other hand curved over the head, pop the hip out sharply twice to one side, then the other.' }),
  combo('light-bulb', 'Light Bulb & Pat the Dog', 'groove', 'lightBulb', 'mid', 2, 'kpop party | arms | hands twist bollywood', { desc: 'One hand high screwing in a light bulb while the other pats a dog low, knees bouncing; switch hands.' }),
  combo('matka-step', 'Matka Step', 'stepTouch', 'matka', 'low', 1, 'kpop latin | legs hips | walk bollywood', { desc: 'One hand balancing a pot above the shoulder, the other on the hip, step-touching side to side with the hips.' }),
  combo('namaste-open', 'Namaste Open', 'sway', 'namasteOpen', 'low', 1, 'kpop | arms | hands bollywood', { desc: 'Palms together at the chest, then open the arms wide forward with palms up.' }),
  combo('lotus-rise', 'Lotus Rise', 'bounce', 'lotus', 'low', 1, 'kpop | arms | hands bollywood', { desc: 'Wrists together like a lotus at the chest, lift it above the head and bring it back down.' }),
  combo('heel-flick', 'Heel Tap Flick', 'heelDig', 'handFlick', 'low', 2, 'kpop aerobic | legs arms | hands bollywood', { desc: 'Tap a heel forward while both hands flick open out low, then snap back to fists at the chest.' }),
  combo('jhummar-sway', 'Jhummar Sway', 'hipSway', 'jhummar', 'low', 1, 'kpop latin | arms hips | wave bollywood', { desc: 'Graceful hip sway, one arm reaching out at head height and the other hand at the chest, swapping sides.' }),
  combo('kite-pull', 'Kite Pull', 'sway', 'kitePull', 'low', 2, 'kpop party | arms | bollywood', { desc: 'Both fists reach up to one side and pull a kite string down across the body, twice; then the other side.' }),
  combo('dandiya-strike', 'Dandiya Strike', 'twoStep', 'dandiya', 'mid', 2, 'kpop party | arms | clap bollywood', { desc: 'Strike both fists together high on one side like dandiya sticks, then low on the other side, stepping with it.' }),
  full({
    id: 'ghoomar-twirl', name: 'Ghoomar Twirl', tags: 'kpop latin | turn hips | spin bollywood', beats: 4, level: 'mid', d: 3, parts: ['turn', 'hips', 'arms'],
    desc: 'Twirl a full turn with both arms raised and curved overhead, then sway the hips side to side with the arms still up.',
    keys: [
      ...spinKeys(0, 0.02).map(([t, sp]) => [t, { ...sp, ...GHOOMAR }] as const),
      [2, { y: -0.04, x: 0.02, hips: 0.07, tilt: 7, lean: -4, head: 5, rf: [0.11, 0, 0], lf: [-0.1, 0.02, 0.02], ...GHOOMAR }],
      [3, { y: -0.04, x: -0.02, hips: -0.07, tilt: -7, lean: 4, head: -5, rf: [0.1, 0.02, 0.02], lf: [-0.11, 0, 0], ...GHOOMAR }],
    ],
  }),
  // --- Bhangra
  combo('bhangra-shoulders', 'Bhangra Shoulders', 'groove', 'bhangraArms', 'mid', 1, 'kpop | full | bhangra bollywood', { desc: 'Arms raised high, shoulders bouncing up on every half beat with springy knees.' }),
  combo('boli-call', 'Boli Call', 'groove', 'boli', 'mid', 1, 'kpop | arms | hands bhangra bollywood', { desc: 'One hand cupped behind the ear like a bhangra singer, the other arm raised high, bouncing on the knees.' }),
  combo('bhangra-hop', 'Bhangra Hop', 'bhangraHop', 'bhangraArms', 'high', 2, 'kpop aerobic | full | jump bhangra bollywood', { desc: 'Hop on one foot lifting the other knee high, arms up and shoulders bouncing; alternate legs.' }),
  combo('dhamaal', 'Dhamaal', 'dhamaal', 'dhamaalPump', 'high', 2, 'kpop rock | full | jump punch bhangra bollywood', { desc: 'Small two-foot bounce jumps, both fists pumping up overhead on every beat.' }),
  combo('chaffa', 'Chaffa', 'chaffa', 'bhangraOneUp', 'high', 3, 'kpop | legs | jump kick bhangra bollywood', { desc: 'Hop and swing one foot low across the front then out to the side, one arm up and the other out at shoulder height, shoulders bouncing.' }),
];
