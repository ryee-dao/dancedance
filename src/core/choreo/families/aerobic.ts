/**
 * Aerobics / dance-fitness staples: step touch, grapevine, march, taps, kicks,
 * squats, lunges, jacks, punches and the classic arm patterns.
 */

import { ARM, CHEST_BOX, FIST, OPEN, OPEN_LOW, W, at, hand, mir, type ArmAngles, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';
import { mirrored, pose } from '../../coach/poses';

const marchA: PoseSpec = { rf: [0.08, 0.13, 0.1], x: -0.01, lean: -1, head: 1.5 };
const jogA: PoseSpec = { y: 0.02, x: -0.01, rf: [0.08, 0.13, 0.1] };
const jogDown: PoseSpec = { y: -0.035 };

const GUARD = ARM.guard;
const jabA: PoseSpec = { twist: -14, turn: 8, r: ARM.jab, l: GUARD, ...FIST };
const skyA: PoseSpec = { lean: 5, head: 3, nod: -6, r: ARM.sky, l: GUARD, ...FIST };
const crossA: PoseSpec = { twist: -26, turn: 14, r: ARM.cross, l: GUARD, ...FIST };
const upperA: PoseSpec = { twist: -12, turn: 6, nod: -4, r: hand(-0.09, 0.1, 0.17, [0.15, -1, 0.15]), l: GUARD, ...FIST };
const sidePunchA: PoseSpec = { lean: -3, head: -3, r: [90, 0, 90, 0], l: GUARD, ...FIST };
const marchArmsA: PoseSpec = { r: ARM.swingBack, l: ARM.swingFwd, ...FIST };
const airA: PoseSpec = { lean: 13, head: 5, r: [90, 0, 90, 0], l: [90, 0, 90, 0], ...OPEN };
const climbA: PoseSpec = { nod: -8, r: at(1, 0.03, 1.08, 0.08, [1, 0, -0.3]), l: at(-1, -0.03, 0.8, 0.13, [0.6, -1, -0.2]), handR: 0, handL: 0 };
const reachA: PoseSpec = { lean: 6, r: [98, 0, 98, 0], l: CHEST_BOX, handR: 1, handL: 0 };
const curlUp: ArmAngles = [10, 20, 150, 75];
const curlDown: ArmAngles = [8, 10, 14, 25];

const CLASP = { r: at(1, 0.02, 0.72, 0.2, [1, -0.6, -0.3]), l: at(-1, -0.02, 0.72, 0.2, [1, -0.6, -0.3]), ...FIST };
const BEHIND_HEAD = { r: at(1, 0.07, 0.99, -0.05, [1, 0.3, -0.2]), l: at(-1, -0.07, 0.99, -0.05, [1, 0.3, -0.2]), handR: 1, handL: 1 };
const sideCrunch: PoseSpec = {
  y: -0.02, x: -0.03, lean: 13, head: 8, rf: [0.2, 0.2, 0.06], lf: [-0.09, 0, 0], kneeR: 0.5,
  r: at(1, 0.24, 0.84, -0.02, [1, 0.1, -0.2]), l: BEHIND_HEAD.l, handR: 1, handL: 1,
};
const windmillTouch: PoseSpec = {
  y: -0.12, bend: 44, twist: -24, lean: -9, nod: 6, turn: -10, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], kneeL: 0.1,
  r: [50, 145, 52, 145], l: [168, 0, 172, 0], ...OPEN,
};

const GUARD_UP = { r: at(1, 0.08, 0.84, 0.2, [0.4, -1, -0.1]), l: at(-1, -0.08, 0.84, 0.2, [0.4, -1, -0.1]), ...FIST };
const heisman: PoseSpec = {
  y: 0.03, x: -0.07, lean: -4, head: -4, turn: -10, rf: [0.0, 0.25, 0.18], lf: [-0.13, 0, 0], kneeR: -0.15,
  r: at(1, 0.08, 0.76, 0.14, [1, -0.6, -0.3]), l: [92, -2, 94, -2], handR: 0, handL: 1,
};
const backKick: PoseSpec = {
  y: -0.03, x: -0.02, bend: 14, spin: -50, turn: 30, head: 6, rf: [0.12, 0.26, -0.28], lf: [-0.08, 0, 0.02], ...GUARD_UP,
};
const tireA: PoseSpec = { y: 0.03, x: -0.02, rf: [0.18, 0.2, 0.1], lf: [-0.18, 0, 0], kneeR: 0.2, r: at(1, 0.34, 0.62, 0.1, [1, -0.2, -0.2]), l: at(-1, -0.3, 0.86, 0.12, [1, -0.2, -0.2]), ...FIST };
const tireDn: PoseSpec = { y: -0.05, rf: [0.18, 0, 0], lf: [-0.18, 0, 0] };
const fastFeet = (k: number): PoseSpec => ({
  y: k % 2 ? -0.1 : -0.11, bend: 12, nod: 2, rf: [0.17, k % 2 ? 0 : 0.09, 0.02], lf: [-0.17, k % 2 ? 0.09 : 0, 0.02], kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.15, k % 2 ? 0.56 : 0.66, 0.24, [0.5, -1, -0.2]), l: at(-1, -0.15, k % 2 ? 0.66 : 0.56, 0.24, [0.5, -1, -0.2]), ...OPEN,
});
const athletic = (x: number, rx: number, lx: number, slide: boolean): PoseSpec => ({
  x, y: slide ? -0.08 : -0.15, bend: 10, rf: [rx, 0, 0], lf: [lx, 0, 0], kneeR: 0.1, kneeL: 0.1, ...(slide ? { slideL: true } : {}),
  r: at(1, 0.16, 0.66, 0.2, [0.6, -1, -0.2]), l: at(-1, -0.16, 0.66, 0.2, [0.6, -1, -0.2]), ...OPEN,
});
const sqKickLow: PoseSpec = { y: -0.19, bend: 12, nod: 4, rf: [0.16, 0, 0], lf: [-0.16, 0, 0], kneeR: 0.1, kneeL: 0.1, ...GUARD_UP };
const sqKickOut: PoseSpec = { y: 0.0, x: -0.05, lean: -14, head: 6, rf: [0.42, 0.2, 0.03], lf: [-0.1, 0, 0], ...GUARD_UP };

const skipA: PoseSpec = {
  y: 0.045, x: -0.02, lean: -2, nod: -3, rf: [0.08, 0.2, 0.14], lf: [-0.08, 0.03, 0],
  r: at(1, 0.2, 0.58, -0.08, [0.2, -0.2, -1]), l: [132, 40, 142, 50], handR: 0.5, handL: 0.5,
};
const skipHop: PoseSpec = { y: -0.04, x: -0.02, rf: [0.08, 0.12, 0.1], lf: [-0.08, 0, 0], r: [52, 20, 60, 30], l: [80, 40, 88, 50], handR: 0.5, handL: 0.5 };
const skipLand: PoseSpec = { y: -0.035, x: 0, rf: [0.08, 0, 0], lf: [-0.08, 0.07, 0.05], r: [92, 40, 100, 50], l: [56, 20, 62, 30], handR: 0.5, handL: 0.5 };
const gateFront: PoseSpec = { y: -0.01, x: -0.03, lean: -2, rf: [0.07, 0.25, 0.2], lf: [-0.09, 0, 0], r: at(1, 0.04, 0.66, 0.24, [1, -0.5, -0.3]), l: at(-1, -0.04, 0.66, 0.24, [1, -0.5, -0.3]), ...OPEN };
const gateOut: PoseSpec = { y: -0.02, x: -0.04, lean: -4, head: -3, rf: [0.24, 0.21, 0.02], lf: [-0.09, 0, 0], kneeR: 0.8, r: [84, -6, 88, -6], l: [84, -6, 88, -6], ...OPEN };
const toeKick: PoseSpec = {
  y: -0.03, x: -0.02, bend: 8, nod: 4, rf: [0.03, 0.3, 0.4], lf: [-0.09, 0, -0.02],
  r: [40, -10, 44, -10], l: at(-1, 0.02, 0.66, 0.3, [1, -0.3, -0.2]), handR: 1, handL: 1,
};
const CARIOCA_ARMS = { r: [74, 0, 80, 0] as ArmAngles, l: [74, 0, 80, 0] as ArmAngles, ...OPEN };

const lungeTwist: PoseSpec = {
  y: -0.16, x: 0.0, twist: 26, turn: 16, nod: 2, rf: [0.11, 0, 0.2], lf: [-0.09, 0, -0.2],
  r: at(1, 0.26, 0.8, 0.2, [1, -0.3, -0.2]), l: at(-1, 0.2, 0.8, 0.22, [0.5, -1, -0.2]), ...OPEN,
};
const QT_ARMS = { r: at(1, 0.16, 0.74, 0.18, [0.5, -1, -0.2]), l: at(-1, -0.16, 0.74, 0.18, [0.5, -1, -0.2]), ...FIST };
const qtLand = (spin: number): PoseSpec => ({ y: -0.07, spin, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.08, kneeL: 0.08, ...QT_ARMS });
const qtAir = (spin: number): PoseSpec => ({ y: 0.07, spin, rf: [0.07, 0.04, 0], lf: [-0.07, 0.04, 0], ...QT_ARMS });

export const patterns: PatternSet = {
  foot: {
    stepTouch: {
      beats: 2, parts: ['legs'], mirror: true, travel: 0.16,
      keys: [
        [0, { x: 0.08, hips: 0.02, rf: [0.25, 0, 0], lf: [-W, 0, 0], head: -2 }],
        [1, { x: 0.16, y: -0.03, rf: [0.25, 0, 0], lf: [0.07, 0.02, 0.01] }],
      ],
    },
    doubleStep: {
      beats: 4, parts: ['legs'], mirror: true, travel: 0.3,
      keys: [
        [0, { x: 0.075, hips: 0.02, rf: [0.24, 0, 0], lf: [-W, 0, 0] }],
        [1, { x: 0.15, y: -0.03, rf: [0.24, 0, 0], lf: [0.06, 0.02, 0.01] }],
        [2, { x: 0.225, hips: 0.02, rf: [0.39, 0, 0], lf: [0.06, 0, 0] }],
        [3, { x: 0.3, y: -0.03, rf: [0.39, 0, 0], lf: [0.21, 0.02, 0.01] }],
      ],
    },
    vine: {
      beats: 4, parts: ['legs'], mirror: true, travel: 0.32,
      keys: [
        [0, { x: 0.07, hips: 0.02, rf: [0.22, 0, 0], lf: [-W, 0, 0] }],
        [1, { x: 0.19, y: -0.03, twist: 6, rf: [0.22, 0, 0], lf: [0.29, 0, -0.08] }],
        [2, { x: 0.3, hips: 0.02, rf: [0.41, 0, 0], lf: [0.29, 0, -0.08] }],
        [3, { x: 0.32, y: -0.03, rf: [0.41, 0, 0], lf: [0.23, 0.02, 0.01] }],
      ],
    },
    march: { beats: 2, parts: ['legs'], keys: [[0, marchA], [1, mir(marchA)]] },
    tapSide: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.04, x: -0.02, lean: -3, rf: [0.3, 0, 0.02] }],
        [1, { y: 0.0, rf: [W, 0, 0] }],
      ],
    },
    heelDig: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.045, x: -0.03, bend: -6, nod: 4, rf: [0.22, 0.03, 0.2], pitchR: -35 }],
        [1, { y: -0.015, pitchR: 0 }],
      ],
    },
    kneeLift: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: -0.02, lean: -2, nod: 5, rf: [0.07, 0.23, 0.2] }],
        [1, { y: -0.02, nod: -2 }],
      ],
    },
    kickSide: {
      beats: 2, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { x: -0.035, lean: -13, head: 6, rf: [0.36, 0.16, 0.04] }],
        [1, { y: -0.04 }],
      ],
    },
    kickFront: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: -0.02, y: 0, bend: -5, rf: [0.09, 0.22, 0.4] }],
        [1, { y: -0.04 }],
      ],
    },
    squat: {
      beats: 2, parts: ['legs'], impact: true, torso: true,
      keys: [
        [0, { y: -0.2, bend: 14, nod: -8, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
        [1, { y: -0.01, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
      ],
    },
    sumo: {
      beats: 2, parts: ['legs'], impact: true,
      keys: [
        [0, { y: -0.24, rf: [0.21, 0, 0], lf: [-0.21, 0, 0] }],
        [1, { y: -0.03, rf: [0.21, 0, 0], lf: [-0.21, 0, 0] }],
      ],
    },
    sideLunge: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: 0.1, y: -0.1, hips: 0.01, rf: [0.31, 0, 0], lf: [-0.11, 0, 0] }],
        [1, { y: -0.02 }],
      ],
    },
    jack: {
      beats: 2, parts: ['jump', 'legs'], jump: true,
      keys: [
        [0, { y: -0.05, rf: [0.22, 0, 0], lf: [-0.22, 0, 0] }],
        [0.5, { y: 0.07, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
        [1, { y: -0.05, rf: [0.075, 0, 0], lf: [-0.075, 0, 0] }],
        [1.5, { y: 0.07, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
      ],
    },
    jog: { beats: 2, parts: ['jump', 'legs'], jump: true, keys: [[0, jogA], [0.5, jogDown], [1, mir(jogA)], [1.5, jogDown]] },
  },
  arms: {
    aeSeal: {
      beats: 2, parts: ['arms'],
      keys: [[0, { r: [88, 0, 90, 0], l: [88, 0, 90, 0], ...OPEN }], [1, { r: at(1, 0.0, 0.8, 0.3, [1, -0.6, -0.3]), l: at(-1, 0.0, 0.8, 0.3, [1, -0.6, -0.3]), ...OPEN }]],
    },
    aeUprightRow: {
      beats: 2, parts: ['arms'],
      keys: [[0, { r: at(1, 0.04, 0.5, 0.13, [1, -0.3, -0.3]), l: at(-1, -0.04, 0.5, 0.13, [1, -0.3, -0.3]), ...FIST }], [1, { nod: -4, shR: 0.5, shL: 0.5, r: at(1, 0.04, 0.9, 0.12, [1, 0.6, -0.1]), l: at(-1, -0.04, 0.9, 0.12, [1, 0.6, -0.1]), ...FIST }]],
    },
    aeLateralRaise: {
      beats: 2, parts: ['arms'],
      keys: [[0, { r: [12, 0, 16, 10], l: [12, 0, 16, 10], ...FIST }], [1, { r: [88, 0, 92, 0], l: [88, 0, 92, 0], ...FIST }]],
    },
    aeTricepExt: {
      beats: 2, parts: ['arms'],
      keys: [[0, { nod: -4, r: [170, 6, 174, 6], l: [170, 6, 174, 6], ...FIST }], [1, { nod: 4, ...BEHIND_HEAD, ...FIST }]],
    },
    clap: { beats: 2, parts: ['arms'], keys: [[0, { r: OPEN_LOW, l: OPEN_LOW, ...OPEN }], [1, { r: ARM.clap, l: ARM.clap, ...OPEN }]] },
    clapEvery: { beats: 1, parts: ['arms'], keys: [[0, { r: ARM.clap, l: ARM.clap, ...OPEN }], [0.5, { r: [40, 30, 50, 60], l: [40, 30, 50, 60], ...OPEN }]] },
    clapHigh: { beats: 2, parts: ['arms'], keys: [[0, { r: [46, 0, 50, 0], l: [46, 0, 50, 0], ...OPEN }], [1, { nod: -6, r: ARM.clapHigh, l: ARM.clapHigh, ...OPEN }]] },
    clapV: { beats: 2, parts: ['arms'], keys: [[0, { r: ARM.clap, l: ARM.clap, ...OPEN }], [1, { r: ARM.v, l: ARM.v, ...OPEN }]] },
    jab: { beats: 2, parts: ['arms'], torso: true, keys: [[0, jabA], [1, mir(jabA)]] },
    skyPunch: { beats: 2, parts: ['arms'], torso: true, keys: [[0, skyA], [1, mir(skyA)]] },
    crossJab: { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, crossA], [1, mir(crossA)]] },
    uppercut: { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, upperA], [1, mir(upperA)]] },
    sidePunch: { beats: 2, parts: ['arms'], torso: true, keys: [[0, sidePunchA], [1, mir(sidePunchA)]] },
    shoulderPress: { beats: 2, parts: ['arms'], keys: [[0, { nod: -5, r: ARM.up, l: ARM.up, ...FIST }], [1, { r: ARM.goal, l: ARM.goal, ...FIST }]] },
    pushOut: { beats: 2, parts: ['arms'], keys: [[0, { r: [88, 0, 92, -5], l: [88, 0, 92, -5], ...OPEN }], [1, { r: CHEST_BOX, l: CHEST_BOX, ...FIST }]] },
    bicepCurl: { beats: 2, parts: ['arms'], keys: [[0, { r: curlUp, l: curlUp, ...FIST }], [1, { r: curlDown, l: curlDown, ...FIST }]] },
    latPull: { beats: 2, parts: ['arms'], keys: [[0, { nod: -4, r: ARM.v, l: ARM.v, ...OPEN }], [1, { r: [84, 0, 168, 8], l: [84, 0, 168, 8], ...FIST }]] },
    butterfly: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: ARM.goal, l: ARM.goal, ...FIST }],
        [1, { r: [75, 125, 160, 90], l: [75, 125, 160, 90], ...FIST }],
      ],
    },
    marchArms: { beats: 2, parts: ['arms'], keys: [[0, marchArmsA], [1, mir(marchArmsA)]] },
    pullDown: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: hand(-0.05, -0.27, 0.16, [0.6, 0.2, -1]), l: hand(-0.1, -0.27, 0.16, [0.6, 0.2, -1]), ...FIST }],
        [1, { r: ARM.v, l: ARM.v, ...OPEN }],
      ],
    },
    airplane: { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, airA], [1, mir(airA)]] },
    xArms: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: hand(-0.2, -0.12, 0.21, [0.4, -1, -0.2]), l: hand(-0.22, -0.08, 0.25, [0.4, -1, -0.2]), ...FIST }],
        [1, { r: [128, 0, 132, 0], l: [128, 0, 132, 0], ...OPEN }],
      ],
    },
    ropeClimb: { beats: 2, parts: ['arms'], keys: [[0, climbA], [1, mir(climbA)]] },
    sideReach: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, reachA], [1, { r: [20, 0, 26, 10], l: CHEST_BOX, handR: 1, handL: 0 }]] },
    jackArms: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: [142, 0, 148, 0], l: [142, 0, 148, 0], ...OPEN }],
        [0.5, { r: [82, 0, 86, 0], l: [82, 0, 86, 0], ...OPEN }],
        [1, { r: [16, 0, 18, 0], l: [16, 0, 18, 0], ...OPEN }],
        [1.5, { r: [80, 0, 84, 0], l: [80, 0, 84, 0], ...OPEN }],
      ],
    },
    crunch: {
      beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true,
      keys: [
        // Left elbow down across to the rising right knee.
        [0, { twist: -22, bend: 10, lean: 6, nod: 8, r: [88, 0, 172, 10], l: at(-1, 0.03, 0.62, 0.17, [0.2, -1, 0.4]), ...FIST }],
        [1, { r: [88, 0, 172, 10], l: [88, 0, 172, 10], ...FIST }],
      ],
    },
  },
};

const skaterA: PoseSpec = {
  y: -0.08, x: 0.15, lean: 6, bend: 8, rf: [0.19, 0, 0], lf: [0.03, 0.09, -0.12],
  r: [42, 122, 48, 140], l: [44, 0, 48, 0], head: 4, handR: 1, handL: 1,
};
const skaterAir: PoseSpec = { y: 0.06, x: 0.0, rf: [0.09, 0.02, -0.04], lf: [-0.09, 0.02, -0.04], r: [20, 60, 30, 80], l: [20, 60, 30, 80] };
const M = (s: PoseSpec) => mirrored(pose(s));

// --- Hi/lo, HIIT and kickboxing additions (new ids; helpers prefixed `ae`) ---
const AE_WIDE = { rf: [0.18, 0, 0], lf: [-0.18, 0, 0] } as const;
const aeRowFwd = { r: at(1, 0.1, 0.66, 0.28, [1, -0.3, -0.2]), l: at(-1, -0.1, 0.66, 0.28, [1, -0.3, -0.2]), ...OPEN };
const aeRowBack = { r: at(1, 0.2, 0.68, -0.1, [0.6, 0.1, -1]), l: at(-1, -0.2, 0.68, -0.1, [0.6, 0.1, -1]), ...FIST };
const aeRun = (s: 1 | -1) => ({
  r: s > 0 ? at(1, 0.16, 0.82, 0.16, [0.2, -1, -0.2]) : at(1, 0.2, 0.55, -0.1, [0.1, -0.2, -1]),
  l: s > 0 ? at(-1, -0.2, 0.55, -0.1, [0.1, -0.2, -1]) : at(-1, -0.16, 0.82, 0.16, [0.2, -1, -0.2]),
  ...FIST,
});
const hamCurl: PoseSpec = { x: 0.07, y: -0.01, hips: 0.03, lean: -3, head: 2, rf: [0.18, 0, 0], lf: [-0.03, 0.21, -0.13], ...aeRowBack };
const hamOut: PoseSpec = { x: 0, y: -0.06, ...AE_WIDE, ...aeRowFwd };
const repKnee: PoseSpec = { y: 0, x: -0.02, lean: -2, nod: 4, rf: [0.08, 0.25, 0.2], lf: [-0.09, 0, 0], r: at(1, 0.24, 0.84, 0.08, [1, 0.2, -0.3]), l: at(-1, -0.24, 0.84, 0.08, [1, 0.2, -0.3]), ...FIST };
const repTap: PoseSpec = { y: -0.08, x: 0.0, nod: -4, rf: [0.13, 0, -0.16], lf: [-0.09, 0, 0], r: [158, 4, 164, 4], l: [158, 4, 164, 4], ...OPEN };
const heelJackA: PoseSpec = { y: -0.05, x: -0.02, rf: [0.25, 0.03, 0.12], lf: [-0.08, 0, 0], r: [62, 15, 66, 15], l: [62, 15, 66, 15], ...OPEN };
const heelJackAir: PoseSpec = { y: 0.06, rf: [0.06, 0.03, 0], lf: [-0.06, 0.03, 0], r: ARM.clap, l: ARM.clap, ...OPEN };
const buttKickA: PoseSpec = { y: 0.03, x: -0.01, rf: [0.08, 0.22, -0.14], lf: [-0.08, 0, 0], r: at(1, 0.17, 0.46, -0.12, [1, 0, -0.6]), l: at(-1, -0.17, 0.46, -0.12, [1, 0, -0.6]), ...OPEN };
const buttKickDn: PoseSpec = { y: -0.035, rf: [0.08, 0, 0], lf: [-0.08, 0, 0] };
const curtsyDn: PoseSpec = { y: -0.15, x: -0.03, hips: -0.02, bend: 4, nod: 3, rf: [-0.13, 0, -0.15], lf: [-0.1, 0, 0], kneeL: 0.1, r: [74, 0, 78, 0], l: [74, 0, 78, 0], ...OPEN };
const curtsyUp: PoseSpec = { y: -0.01, x: 0, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: at(1, 0.03, 0.76, 0.18, [1, -0.6, -0.3]), l: at(-1, -0.03, 0.76, 0.18, [1, -0.6, -0.3]), ...OPEN };
const revLunge: PoseSpec = { y: -0.17, bend: 6, nod: 3, rf: [0.11, 0, -0.24], lf: [-0.09, 0, 0.04], ...aeRun(-1) };
const revKnee: PoseSpec = { y: 0.0, x: -0.02, nod: -2, rf: [0.08, 0.26, 0.2], lf: [-0.09, 0, 0], ...aeRun(1) };
const inOut = (rx: number, lx: number, k: number): PoseSpec => ({
  y: k % 2 ? -0.07 : -0.09, bend: 7, nod: 4, rf: [rx, 0, 0], lf: [lx, 0, 0],
  r: at(1, 0.12, k % 2 ? 0.66 : 0.6, 0.2, [0.4, -1, -0.2]), l: at(-1, -0.12, k % 2 ? 0.6 : 0.66, 0.2, [0.4, -1, -0.2]), ...FIST,
});

export const moves: MoveDef[] = [
  // Step touch family
  combo('step-touch', 'Step Touch', 'stepTouch', 'rest', 'low', 1, 'aerobic pop | legs | walk'),
  combo('step-clap', 'Step Touch Clap', 'stepTouch', 'clap', 'low', 1, 'aerobic pop | legs arms | clap walk'),
  combo('step-swing', 'Step Touch Swing', 'stepTouch', 'pendulum', 'low', 1, 'aerobic pop | legs arms | walk'),
  combo('step-high-clap', 'Step Touch High Clap', 'stepTouch', 'clapHigh', 'low', 2, 'aerobic pop | arms legs | clap'),
  combo('step-sky', 'Step Touch Punch Up', 'stepTouch', 'skyPunch', 'mid', 2, 'aerobic rock | arms | punch'),
  combo('step-press', 'Step Touch Press', 'stepTouch', 'shoulderPress', 'mid', 2, 'aerobic | arms |'),
  combo('step-curl', 'Step & Curl', 'stepTouch', 'bicepCurl', 'low', 2, 'aerobic | arms |'),
  combo('step-side-punch', 'Step Touch Side Punch', 'stepTouch', 'sidePunch', 'mid', 2, 'aerobic | arms | punch'),
  combo('step-cross', 'Step Touch Cross Jab', 'stepTouch', 'crossJab', 'mid', 2, 'aerobic | arms | punch'),
  combo('step-butterfly', 'Step Touch Butterfly', 'stepTouch', 'butterfly', 'low', 2, 'aerobic | arms |'),
  combo('double-step', 'Double Step Touch', 'doubleStep', 'rest', 'low', 2, 'aerobic pop | legs | walk'),
  combo('double-clap', 'Double Step Clap', 'doubleStep', 'clap', 'mid', 2, 'aerobic pop | legs | clap walk'),
  combo('double-press', 'Double Step Press', 'doubleStep', 'shoulderPress', 'mid', 2, 'aerobic | full |'),
  // Grapevine
  combo('vine', 'Grapevine', 'vine', 'rest', 'mid', 2, 'aerobic pop | legs | walk'),
  combo('vine-clap', 'Grapevine Clap', 'vine', 'clap', 'mid', 2, 'aerobic pop | legs | clap walk'),
  combo('vine-sky', 'Grapevine Punch Up', 'vine', 'skyPunch', 'mid', 3, 'aerobic | full | punch walk'),
  // March
  combo('march', 'March', 'march', 'marchArms', 'low', 1, 'aerobic rock | legs | walk stomp'),
  combo('march-sky', 'March & Punch Up', 'march', 'skyPunch', 'mid', 2, 'aerobic rock | full | punch'),
  combo('march-press', 'March & Press', 'march', 'shoulderPress', 'mid', 2, 'aerobic | full |'),
  combo('march-clap', 'March & Clap', 'march', 'clapEvery', 'low', 2, 'aerobic rock | legs | clap stomp'),
  combo('march-curl', 'March & Curl', 'march', 'bicepCurl', 'low', 2, 'aerobic | arms |'),
  combo('march-push', 'March & Push Out', 'march', 'pushOut', 'low', 2, 'aerobic | arms | hands'),
  // Taps, heels, knees, kicks
  combo('side-tap', 'Side Tap', 'tapSide', 'hips', 'low', 1, 'aerobic pop | legs |'),
  combo('tap-punch', 'Tap & Side Punch', 'tapSide', 'sidePunch', 'mid', 2, 'aerobic | arms | punch'),
  combo('tap-high-clap', 'Tap & High Clap', 'tapSide', 'clapHigh', 'mid', 2, 'aerobic pop | arms | clap'),
  combo('heel-push', 'Heel Dig Push Out', 'heelDig', 'pushOut', 'low', 2, 'aerobic | legs | hands'),
  combo('heel-clap', 'Heel Dig Clap', 'heelDig', 'clap', 'low', 2, 'aerobic pop | legs | clap'),
  combo('knee-lift', 'Knee Lift', 'kneeLift', 'hips', 'mid', 1, 'aerobic | legs |'),
  combo('knee-pump', 'Knee Pump', 'kneeLift', 'pullDown', 'mid', 2, 'aerobic rock | full |'),
  combo('standing-crunch', 'Standing Crunch', 'kneeLift', 'crunch', 'mid', 3, 'aerobic | full |'),
  combo('side-kick', 'Side Kick', 'kickSide', 'guard', 'mid', 2, 'aerobic kpop | legs | kick'),
  combo('kick-punch', 'Side Kick Punch', 'kickSide', 'sidePunch', 'mid', 3, 'aerobic | full | kick punch'),
  // Squats and lunges
  combo('chair-squat', 'Chair Squat', 'squat', 'clapV', 'high', 1, 'aerobic | legs |'),
  combo('sumo-squat', 'Sumo Squat', 'sumo', 'hips', 'high', 1, 'aerobic | legs |'),
  combo('sumo-press', 'Sumo Press', 'sumo', 'shoulderPress', 'high', 2, 'aerobic | full |', { shift: 1 }),
  combo('lunge-reach', 'Side Lunge Reach', 'sideLunge', 'sideReach', 'mid', 2, 'aerobic | full |'),
  combo('lunge-cross', 'Lunge & Cross', 'sideLunge', 'crossJab', 'mid', 3, 'aerobic | full | punch', { shift: 1 }),
  combo('lunge-sky', 'Lunge & Punch Up', 'sideLunge', 'skyPunch', 'mid', 2, 'aerobic | full | punch'),
  combo('airplane-lunge', 'Airplane Lunge', 'sideLunge', 'airplane', 'mid', 2, 'aerobic | full |'),
  // Jumps
  combo('jumping-jack', 'Jumping Jack', 'jack', 'jackArms', 'high', 2, 'aerobic | full | jump'),
  combo('clap-jack', 'Clap Jack', 'jack', 'clapHigh', 'high', 2, 'aerobic | full | jump clap', { shift: 1 }),
  combo('cross-jack', 'Cross Jack', 'jack', 'xArms', 'high', 2, 'aerobic | full | jump', { shift: 1 }),
  combo('jog', 'Jog', 'jog', 'marchArms', 'high', 2, 'aerobic | legs | jump walk'),
  combo('jog-sky', 'Jog & Punch Up', 'jog', 'skyPunch', 'high', 3, 'aerobic rock | full | jump punch'),
  // Upper body on the spot
  combo('airplane', 'Airplane', 'sway', 'airplane', 'low', 1, 'aerobic pop | arms |'),
  combo('cross-jab', 'Cross Jab', 'plant', 'crossJab', 'mid', 2, 'aerobic rock | arms | punch'),
  combo('sky-punch', 'Sky Punch', 'plant', 'skyPunch', 'mid', 1, 'aerobic rock | arms | punch'),
  combo('side-punch', 'Side Punch', 'plant', 'sidePunch', 'mid', 1, 'aerobic | arms | punch'),
  combo('overhead-press', 'Overhead Press', 'plant', 'shoulderPress', 'mid', 1, 'aerobic | arms |'),
  combo('push-the-walls', 'Push the Walls', 'plant', 'pushOut', 'low', 1, 'aerobic pop | arms | hands'),
  combo('bicep-curl', 'Bicep Curl', 'bounce', 'bicepCurl', 'low', 1, 'aerobic | arms |'),
  combo('butterfly', 'Butterfly', 'plant', 'butterfly', 'low', 1, 'aerobic | arms |'),
  combo('cross-open', 'Cross & Open', 'plant', 'xArms', 'low', 1, 'aerobic | arms |'),
  combo('rope-climb', 'Rope Climb', 'bounce', 'ropeClimb', 'low', 1, 'aerobic hiphop | arms |'),
  // Hand-authored jumps
  full({
    id: 'skater', name: 'Skater Hop', tags: 'aerobic | legs full | jump', beats: 2, level: 'high', d: 3, parts: ['jump', 'legs', 'arms'], jump: true,
    keys: [[0, skaterA], [0.5, skaterAir], [1, M(skaterA)], [1.5, skaterAir]],
  }),
  full({
    id: 'rocket', name: 'Rocket Jump', tags: 'aerobic rock | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], jump: true, icon: 2,
    keys: [
      [0, { y: -0.16, bend: 14, nod: -6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [32, -55, 36, -55], l: [32, -55, 36, -55], handR: 0, handL: 0 }],
      [0.5, { y: -0.01, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [118, 30, 122, 30], l: [118, 30, 122, 30], handR: 1, handL: 1 }],
      [1, { y: 0.13, nod: -10, rf: [0.1, 0.03, 0], lf: [-0.1, 0.03, 0], r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
      [1.5, { y: -0.07, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [80, 15, 85, 15], l: [80, 15, 85, 15], handR: 1, handL: 1 }],
    ],
  }),

  // --- Hi/lo staples ---------------------------------------------------------
  full({
    id: 'hamstring-curl', name: 'Hamstring Curl', tags: 'aerobic pop | legs arms |', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Step wide to the side and curl the other heel up behind you, pulling both elbows back like a row.',
    keys: [[0, hamOut], [1, hamCurl]],
  }),
  full({
    id: 'knee-repeater', name: 'Knee Repeater', tags: 'aerobic | legs full |', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Three knee lifts in a row on the same leg, tapping the toe back between them; reach up on the tap, pull the fists down as the knee comes up.',
    keys: [[0, repKnee], [0.5, repTap], [1, repKnee], [1.5, repTap], [2, repKnee], [3, { y: -0.04, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [30, 10, 36, 20], l: [30, 10, 36, 20], ...OPEN }]],
  }),
  full({
    id: 'heel-jack', name: 'Heel Jack', tags: 'aerobic | legs | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'arms'], jump: true, impact: true,
    desc: 'Hop and dig one heel out on the diagonal with the arms opening low, hop the feet together with a clap, then the other heel.',
    keys: [[0, heelJackA], [0.5, heelJackAir], [1, mir(heelJackA)], [1.5, heelJackAir]],
  }),
  full({
    id: 'butt-kicks', name: 'Butt Kicks', tags: 'aerobic | legs | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], jump: true,
    desc: 'Jog on the spot kicking each heel up to your backside, palms resting on your glutes.',
    keys: [[0, buttKickA], [0.5, { ...buttKickDn, r: buttKickA.r, l: buttKickA.l }], [1, mir(buttKickA)], [1.5, { ...buttKickDn, r: buttKickA.r, l: buttKickA.l }]],
  }),
  full({
    id: 'in-in-out-out', name: 'In-In-Out-Out', tags: 'aerobic | legs |', beats: 2, level: 'mid', d: 2, parts: ['legs'],
    desc: 'Quick agility-ladder feet in a low athletic stance: right in, left in, right out wide, left out wide, arms pumping.',
    keys: [[0, inOut(0.04, -0.24, 0)], [0.5, inOut(0.04, -0.04, 1)], [1, inOut(0.24, -0.04, 2)], [1.5, inOut(0.24, -0.24, 3)]],
  }),

  // --- Lunges ------------------------------------------------------------------
  full({
    id: 'curtsy-lunge', name: 'Curtsy Lunge', tags: 'aerobic | legs |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Step one foot back and across behind the other and sink both knees like a curtsy, arms opening out to the sides; come up with the hands together.',
    keys: [[0, curtsyDn], [1, curtsyUp]],
  }),
  full({
    id: 'lunge-knee-drive', name: 'Reverse Lunge Knee Drive', tags: 'aerobic rock | legs full |', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Step back into a low lunge with sprinter arms, then drive the same knee up high in front and swap the arms.',
    keys: [[0, revLunge], [1, revKnee]],
  }),

  // --- HIIT, core and sculpt ---------------------------------------------------
  full({
    id: 'squat-jack', name: 'Squat Jack', tags: 'aerobic | legs | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], jump: true, impact: true,
    desc: 'Jump the feet out wide and land in a low squat with the hands clasped at the chest, then jump them back together and stand.',
    keys: [
      [0, { y: -0.19, bend: 10, nod: 4, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], kneeR: 0.12, kneeL: 0.12, ...CLASP }],
      [0.5, { y: 0.06, rf: [0.13, 0.04, 0], lf: [-0.13, 0.04, 0], ...CLASP }],
      [1, { y: -0.04, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], ...CLASP }],
      [1.5, { y: 0.06, rf: [0.13, 0.04, 0], lf: [-0.13, 0.04, 0], ...CLASP }],
    ],
  }),
  combo('seal-jack', 'Seal Jack', 'jack', 'aeSeal', 'high', 2, 'aerobic | full | jump clap', { desc: 'Jumping jack with the arms flying open to a T as the feet go out, then clapping straight in front of the chest as they close.' }),
  full({
    id: 'side-crunch', name: 'Standing Side Crunch', tags: 'aerobic | full |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso', 'arms'], mirror: true,
    desc: 'Hands behind the head, lift one knee out to the side and crunch the same elbow down to meet it, then stand tall.',
    keys: [[0, sideCrunch], [1, { y: -0.03, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...BEHIND_HEAD }]],
  }),
  full({
    id: 'windmill-toe-touch', name: 'Windmill Toe Touch', tags: 'aerobic | full | twist', beats: 4, level: 'mid', d: 2, parts: ['torso', 'arms'],
    desc: 'Wide stance, arms in a T: fold and twist to touch one hand toward the opposite foot with the other arm to the sky, then switch.',
    keys: [[0, windmillTouch], [1, { y: -0.03, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], r: [88, 0, 90, 0], l: [88, 0, 90, 0], ...OPEN }], [2, mir(windmillTouch)], [3, { y: -0.03, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], r: [88, 0, 90, 0], l: [88, 0, 90, 0], ...OPEN }]],
  }),
  combo('upright-row', 'Upright Row', 'bounce', 'aeUprightRow', 'low', 1, 'aerobic | arms |', { desc: 'Fists together in front of the thighs, pull them straight up to the chin leading with the elbows high and wide.' }),
  combo('lateral-raise', 'Lateral Raise', 'plant', 'aeLateralRaise', 'low', 1, 'aerobic | arms |', { desc: 'Fists by the thighs, raise both straight arms out to the sides to shoulder height, then lower.' }),
  combo('tricep-extension', 'Overhead Tricep Extension', 'bounce', 'aeTricepExt', 'low', 1, 'aerobic | arms |', { desc: 'Elbows pointing up, drop the fists behind your head, then straighten both arms to the ceiling.' }),

  // --- Boot camp and cardio kickboxing ------------------------------------------
  full({
    id: 'heisman', name: 'Heisman', tags: 'aerobic party | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'arms'], mirror: true, jump: true, impact: true,
    desc: 'Hop onto one foot and drive the other knee up across the body, stiff-arm straight out to the side and the ball tucked at your chest; switch.',
    keys: [[0, heisman], [1, { y: -0.07, x: 0, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], ...GUARD_UP }]],
  }),
  full({
    id: 'back-kick', name: 'Back Kick', tags: 'aerobic | legs | kick', beats: 4, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true,
    desc: 'Guard up, look over your shoulder, hinge forward and drive the heel straight back behind you, then step it down.',
    keys: [
      [0, { y: -0.05, bend: 6, spin: -25, turn: 20, rf: [0.11, 0.16, 0.08], lf: [-0.08, 0, 0], ...GUARD_UP }], [1, backKick],
      [2, { y: -0.05, bend: 6, spin: -25, turn: 20, rf: [0.11, 0.16, 0.08], lf: [-0.08, 0, 0], ...GUARD_UP }], [3, { y: -0.06, spin: 0, rf: [0.11, 0, 0], lf: [-0.09, 0, 0], ...GUARD_UP }],
    ],
  }),
  full({
    id: 'tire-run', name: 'Tire Run', tags: 'aerobic | legs | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'arms'], jump: true, impact: true,
    desc: 'Run through imaginary tyres: feet land wide apart as each knee drives high, arms out wide and pumping for balance.',
    keys: [[0, tireA], [0.5, tireDn], [1, mir(tireA)], [1.5, tireDn]],
  }),
  full({
    id: 'fast-feet', name: 'Fast Feet', tags: 'aerobic | legs |', beats: 1, level: 'high', d: 2, parts: ['legs'],
    desc: 'Football-drill fast feet: sit low and wide on the balls of the feet and patter the feet as fast as you can, hands ready in front.',
    keys: [[0, fastFeet(0)], [0.25, fastFeet(1)], [0.5, fastFeet(0)], [0.75, fastFeet(1)]],
  }),
  full({
    id: 'lateral-shuffle', name: 'Lateral Shuffle', tags: 'aerobic | legs | walk', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true, travel: 0.24,
    desc: 'Low athletic stance, hands ready: push off and shuffle sideways step-slide, step-slide, without crossing the feet.',
    keys: [
      [0, athletic(0.07, 0.29, -0.15, false)], [0.5, athletic(0.12, 0.29, -0.04, true)],
      [1, athletic(0.19, 0.41, -0.04, false)], [1.5, athletic(0.24, 0.41, 0.07, true)],
    ],
  }),
  full({
    id: 'squat-side-kick', name: 'Squat & Side Kick', tags: 'aerobic | legs | kick', beats: 4, level: 'high', d: 3, parts: ['legs'], impact: true,
    desc: 'Guard up: sit into a squat, stand and kick one leg out to the side; squat again and kick the other leg.',
    keys: [[0, sqKickLow], [1, sqKickOut], [2, sqKickLow], [3, mir(sqKickOut)]],
  }),

  // --- More hi/lo and sculpt ----------------------------------------------------
  full({
    id: 'skip', name: 'Skip in Place', tags: 'aerobic pop | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'arms'], jump: true,
    desc: 'Skip on the spot: hop up with one knee high and the opposite arm swinging up overhead, land, and skip on the other side.',
    keys: [[0, skipA], [0.5, skipHop], [0.75, skipLand], [1, mir(skipA)], [1.5, mir(skipHop)], [1.75, mir(skipLand)]],
  }),
  full({
    id: 'gate-opener', name: 'Gate Opener', tags: 'aerobic | legs hips |', beats: 2, level: 'low', d: 2, parts: ['legs', 'hips', 'arms'], mirror: true,
    desc: 'Lift the knee up in front with the palms together, then swing the knee open to the side like a gate as the arms open wide; step down.',
    keys: [[0, gateFront], [0.5, gateOut], [1, { y: -0.05, x: 0, rf: [0.12, 0, 0], lf: [-0.11, 0, 0], r: [40, 0, 46, 10], l: [40, 0, 46, 10], ...OPEN }]],
  }),
  full({
    id: 'toe-touch-kick', name: 'Toe Touch Kick', tags: 'aerobic | legs | kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Kick one straight leg up in front to hip height and reach the opposite hand across to tap the toe, other arm back; step down and switch.',
    keys: [[0, toeKick], [1, { y: -0.05, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: [30, 0, 34, 10], l: [30, 0, 34, 10], handR: 1, handL: 1 }]],
  }),
  full({
    id: 'step-jack', name: 'Step Jack', tags: 'aerobic | full |', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Low-impact jumping jack: step one foot out wide as both arms sweep up overhead, step it back in as the arms come down.',
    keys: [
      [0, { y: -0.03, x: 0.03, rf: [0.26, 0, 0], lf: [-0.09, 0, 0], r: [150, 0, 156, 0], l: [150, 0, 156, 0], ...OPEN }],
      [1, { y: -0.05, x: 0, rf: [0.08, 0, 0], lf: [-0.09, 0, 0], r: [18, 0, 22, 0], l: [18, 0, 22, 0], ...OPEN }],
    ],
  }),
  full({
    id: 'carioca', name: 'Carioca', tags: 'aerobic latin | legs hips | walk twist', beats: 2, level: 'mid', d: 3, parts: ['legs', 'hips'], mirror: true, travel: 0.34,
    desc: 'Quick sideways travel: step out, cross the trailing foot behind, step out, cross it in front, hips twisting on every cross and arms out for balance.',
    keys: [
      [0, { x: 0.06, y: -0.05, hipTwist: 0, rf: [0.19, 0, 0], lf: [-0.06, 0, 0], ...CARIOCA_ARMS }],
      [0.5, { x: 0.13, y: -0.06, hipTwist: -22, twist: 8, rf: [0.19, 0, 0], lf: [0.25, 0, -0.07], ...CARIOCA_ARMS }],
      [1, { x: 0.22, y: -0.05, hipTwist: 0, rf: [0.35, 0, 0], lf: [0.25, 0, -0.07], ...CARIOCA_ARMS }],
      [1.5, { x: 0.31, y: -0.06, hipTwist: 22, twist: -8, rf: [0.35, 0, 0], lf: [0.41, 0, 0.07], ...CARIOCA_ARMS }],
    ],
  }),

  full({
    id: 'lunge-twist', name: 'Lunge Twist', tags: 'aerobic | full | twist', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso', 'arms'], mirror: true, impact: true,
    desc: 'Step forward into a lunge and rotate the chest over the front knee with both arms straight out together, then step back and centre.',
    keys: [[0, lungeTwist], [1, { y: -0.03, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.03, 0.76, 0.18, [1, -0.6, -0.3]), l: at(-1, -0.03, 0.76, 0.18, [1, -0.6, -0.3]), ...OPEN }]],
  }),
  full({
    id: 'quarter-turn-hop', name: 'Quarter-Turn Hops', tags: 'aerobic | legs turn | jump spin', beats: 4, level: 'high', d: 3, parts: ['jump', 'turn', 'legs'], jump: true, impact: true,
    desc: 'Feet together, fists up: hop a quarter turn to one side, hop back to the front, hop a quarter turn the other way, hop back.',
    keys: [[0, qtLand(0)], [0.5, qtAir(45)], [1, qtLand(90)], [1.5, qtAir(45)], [2, qtLand(0)], [2.5, qtAir(-45)], [3, qtLand(-90)], [3.5, qtAir(-45)]],
  }),
];
