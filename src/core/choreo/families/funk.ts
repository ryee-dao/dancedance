/**
 * Funk / soul / sharp pop-funk: locking, popping-flavoured hits, James Brown
 * footwork, Soul Train grooves, Michael Jackson-era pose hits, R&B two-steps
 * and new jack swing basics. Individual moves only: the generator sequences.
 */

import { ARM, at, mir, wide, type ArmAngles, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';
import { spinKeys } from './shared';

type Side = 1 | -1;
type Elbow = readonly [number, number, number];
/** Hand at a world position with X measured OUTWARD on that arm's own side. */
const H = (s: Side, X: number, y: number, z: number, e?: Elbow): ArmAngles => at(s, s * X, y, z, e);
/** Both hands at mirrored world positions. */
const both = (X: number, y: number, z: number, e?: Elbow): PoseSpec => ({ r: H(1, X, y, z, e), l: H(-1, X, y, z, e) });

const ELB_OUT: Elbow = [1, 0.1, -0.2];
const ELB_DOWN: Elbow = [0.4, -1, -0.2];
const ELB_FLEX: Elbow = [1, -0.3, -0.3];

// ---------------------------------------------------------------------------
// Original basics

const wingsOut: PoseSpec = { r: at(1, 0.13, 0.8, 0.07, [1, 0.25, -0.2]), l: at(-1, -0.13, 0.8, 0.07, [1, 0.25, -0.2]), handR: 0, handL: 0 };
const wingsIn: PoseSpec = { r: at(1, 0.15, 0.78, 0.09, [0.3, -1, -0.3]), l: at(-1, -0.15, 0.78, 0.09, [0.3, -1, -0.3]), handR: 0, handL: 0 };
const snapA: PoseSpec = { r: [24, 30, 70, 70], l: [24, 30, 70, 70], handR: 0, handL: 0, nod: 4 };
const snapB: PoseSpec = { r: [20, 25, 58, 70], l: [20, 25, 58, 70], handR: 1, handL: 1 };
// Stiff 90-degree arms that hinge in ticks while the chest and head turn like a machine.
const robotA: PoseSpec = { turn: 18, twist: 12, r: [16, 0, 92, 30], l: [16, 0, 150, 30], handR: 1, handL: 1 };
const robotA2: PoseSpec = { turn: 18, twist: 12, r: [44, 0, 98, 30], l: [16, 0, 150, 30], handR: 1, handL: 1 };
const robotB: PoseSpec = { turn: -18, twist: -12, r: [16, 0, 150, 30], l: [16, 0, 92, 30], handR: 1, handL: 1 };
const robotB2: PoseSpec = { turn: -18, twist: -12, r: [16, 0, 150, 30], l: [44, 0, 98, 30], handR: 1, handL: 1 };

export const patterns: PatternSet = {
  foot: {
    kneeKnock: {
      beats: 1, parts: ['legs'],
      keys: [[0, { y: -0.06, kneeR: -0.32, kneeL: -0.32, rf: [0.11, 0, 0], lf: [-0.11, 0, 0] }], [0.5, { y: -0.035, kneeR: 0.3, kneeL: 0.3, rf: [0.11, 0, 0], lf: [-0.11, 0, 0] }]],
    },
    rockBack: {
      beats: 2, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { rf: [0.11, 0, -0.14], y: -0.04, bend: 6, nod: 4, hips: 0.01 }],
        [1, { rf: [0.09, 0, 0], y: -0.015, bend: -1 }],
      ],
    },
    toeTap: {
      beats: 1, parts: ['legs'], mirror: true,
      keys: [[0, { rf: [0.13, 0, 0.11], y: -0.03, hips: -0.012 }], [0.5, { rf: [0.09, 0.01, 0.02], y: -0.012 }]],
    },
    fkTapDiag: {
      beats: 1, parts: ['legs'], mirror: true, torso: true,
      keys: [[0, { rf: [0.17, 0, 0.13], y: -0.04, hips: -0.015, lean: 5, nod: 8 }], [0.5, { rf: [0.09, 0.02, 0.02], y: -0.012, lean: 1, nod: 2 }]],
    },
    kickBall: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { rf: [0.11, 0.14, 0.26], y: -0.005, x: -0.01, bend: -4 }],
        [1, { rf: [0.1, 0.035, -0.07], y: -0.03, x: 0.0 }],
        [1.5, { rf: [0.09, 0, 0], lf: [-0.09, 0.03, 0.02], y: -0.045 }],
      ],
    },
    heelSwivel: {
      beats: 2, parts: ['legs'],
      keys: [
        [0, { y: -0.045, kneeR: 0.6, kneeL: 0.6, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], hips: 0.012 }],
        [0.5, { y: -0.035, kneeR: -0.42, kneeL: -0.42, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], hips: -0.012 }],
        [1, { y: -0.045, kneeR: 0.6, kneeL: 0.6, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], hips: 0.012 }],
        [1.5, { y: -0.015, kneeR: 0.0, kneeL: 0.0, rf: [0.075, 0, 0], lf: [-0.075, 0, 0] }],
      ],
    },
    kneePop: {
      beats: 1, parts: ['legs', 'hips'], mirror: true,
      keys: [[0, { rf: [0.07, 0.06, 0.05], kneeR: -0.7, hips: -0.04, tilt: -6, y: -0.05 }], [0.5, { y: -0.015, kneeR: 0, rf: [0.09, 0, 0] }]],
    },
    // Heel-toe swivel travelling sideways: toes out, then heels out.
    fkHeelToe: {
      beats: 2, parts: ['legs'], mirror: true, travel: 0.16,
      keys: [
        [0, { x: 0.03, y: -0.05, rf: [0.13, 0, 0], lf: [-0.05, 0, 0], kneeR: 0.6, kneeL: 0.6, hips: 0.02 }],
        [0.5, { x: 0.07, y: -0.03, rf: [0.17, 0, 0], lf: [-0.01, 0, 0], kneeR: -0.45, kneeL: -0.45, hips: 0.0 }],
        [1, { x: 0.11, y: -0.05, rf: [0.21, 0, 0], lf: [0.03, 0, 0], kneeR: 0.6, kneeL: 0.6, hips: 0.02 }],
        [1.5, { x: 0.16, y: -0.03, rf: [0.25, 0, 0], lf: [0.07, 0, 0], kneeR: -0.45, kneeL: -0.45, hips: 0.0 }],
      ],
    },
  },
  arms: {
    wings: { beats: 1, parts: ['arms'], keys: [[0, wingsOut], [0.5, wingsIn]] },
    snaps: { beats: 1, parts: [], keys: [[0, snapA], [0.5, snapB]] },
    robot: { beats: 2, parts: ['arms'], torso: true, keys: [[0, robotA], [0.5, robotA2], [1, robotB], [1.5, robotB2]] },
    // Point down at the tapping foot (tiles with toeTap, same side each beat).
    fkTapPoint: {
      beats: 1, parts: ['arms'], mirror: true,
      keys: [
        [0, { r: H(1, 0.33, 0.52, 0.06, ELB_OUT), l: ARM.hip, handR: 0, handL: 0 }],
        [0.5, { r: H(1, 0.24, 0.6, 0.08, ELB_OUT), l: ARM.hip, handR: 0, handL: 0 }],
      ],
    },
    // Knee pop: the hand on the popping side pushes down on the thigh.
    fkKneePush: {
      beats: 1, parts: ['arms'], mirror: true,
      keys: [
        [0, { r: H(1, 0.11, 0.4, 0.17, ELB_OUT), l: H(-1, 0.3, 0.86, 0.04, ELB_DOWN), handR: 1, handL: 0, shL: 0.5 }],
        [0.5, { r: H(1, 0.16, 0.55, 0.12, ELB_OUT), l: H(-1, 0.26, 0.74, 0.05, ELB_DOWN), handR: 1, handL: 0, shL: 0 }],
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Locking

const lockOpen: PoseSpec = { ...wide(-0.02), ...both(0.15, 0.62, 0.22, ELB_DOWN), handR: 1, handL: 1, nod: 2 };
const lockRoll: PoseSpec = { ...wide(-0.05), ...both(0.07, 0.72, 0.2, ELB_DOWN), handR: 0, handL: 0 };
const lockHit: PoseSpec = { ...wide(-0.13, { kneeR: 0.2, kneeL: 0.2 }), ...both(0.2, 0.84, 0.1, [0.6, -1, -0.2]), handR: 0, handL: 0, shR: 0.8, shL: 0.8, bend: -4, nod: -6 };

const samPoint: PoseSpec = {
  y: -0.07, rf: [0.12, 0, 0.13], lf: [-0.09, 0, -0.02], lean: -3, bend: 6, nod: 4, turn: 8,
  r: H(1, 0.3, 0.9, 0.2, ELB_OUT), l: ARM.hip, handR: 0, handL: 0,
};
const samBack: PoseSpec = { y: -0.02, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: H(1, 0.17, 0.83, 0.06, ELB_DOWN), l: ARM.hip, handR: 0, handL: 0 };

const twirlA: PoseSpec = { y: -0.03, r: H(1, 0.22, 0.8, 0.15, ELB_DOWN), l: H(-1, -0.12, 0.72, 0.18, ELB_DOWN), handR: 0.6, handL: 0.6, turn: 10, lean: 3 };
const twirlB: PoseSpec = { y: -0.04, r: H(1, 0.16, 0.72, 0.18, ELB_DOWN), l: H(-1, -0.14, 0.76, 0.14, ELB_DOWN), handR: 0.6, handL: 0.6, turn: 10, lean: 3 };
const twirlOpen: PoseSpec = { ...wide(-0.08), ...both(0.33, 0.63, 0.08, [0.3, -1, -0.3]), handR: 1, handL: 1, shR: 0.4, shL: 0.4, nod: -4 };

const scooKnee: PoseSpec = { y: -0.01, rf: [0.08, 0.2, 0.14], bend: 2, r: H(1, 0.22, 0.58, 0.04, ELB_OUT), l: H(-1, 0.16, 0.8, 0.22, ELB_DOWN), handR: 0, handL: 0 };
const scooKick: PoseSpec = { y: -0.03, rf: [0.1, 0.13, 0.36], bend: -5, r: H(1, 0.22, 0.6, 0.06, ELB_OUT), l: H(-1, 0.17, 0.74, 0.2, ELB_DOWN), handR: 0, handL: 0 };
const scooDown: PoseSpec = { y: -0.07, rf: [0.09, 0, 0.02], r: H(1, 0.2, 0.66, 0.14, ELB_OUT), l: H(-1, 0.2, 0.66, 0.14, ELB_OUT), handR: 0, handL: 0 };

const flexUp: PoseSpec = { ...wide(-0.07), r: [92, 5, 150, 20], l: [92, 5, 150, 20], handR: 0, handL: 0, shR: 0.3, shL: 0.3, nod: -5 };
const flexCrab: PoseSpec = { ...wide(-0.13, { kneeR: 0.25, kneeL: 0.25 }), ...both(0.08, 0.6, 0.17, ELB_FLEX), handR: 0, handL: 0, shR: 1.2, shL: 1.2, bend: 6, nod: 6 };

const fiveSlap: PoseSpec = { y: -0.04, x: 0.02, lean: 8, turn: 16, r: H(1, 0.16, 0.82, 0.2, ELB_OUT), l: H(-1, -0.14, 0.82, 0.2, [0.3, -1, 0.3]), handR: 1, handL: 1 };
const fiveBack: PoseSpec = { y: -0.06, x: 0, lean: 0, turn: 0, ...both(0.22, 0.62, 0.16, ELB_OUT), handR: 0, handL: 0, shR: 0.4, shL: 0.4 };

const dropUp: PoseSpec = { ...wide(-0.02), r: ARM.v, l: ARM.v, handR: 1, handL: 1, nod: -6 };
const dropDown: PoseSpec = { ...wide(-0.17, { kneeR: 0.35, kneeL: 0.35 }), ...both(0.17, 0.4, 0.18, ELB_OUT), handR: 1, handL: 1, bend: 10, nod: 6 };

// ---------------------------------------------------------------------------
// Popping-flavoured hits and Michael Jackson-era pose hits

const fresnoHit: PoseSpec = {
  x: 0.045, y: -0.08, hips: 0.02, rf: [0.24, 0, 0], lf: [-0.09, 0, 0], lean: -3, head: 4, shR: 0.5,
  r: [92, 8, 2, 0], l: H(-1, -0.02, 0.6, 0.18, ELB_DOWN), handR: 1, handL: 0,
};
const fresnoBack: PoseSpec = { x: 0, y: -0.03, hips: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], lean: 0, head: 0, shR: 0, ...both(0.17, 0.56, 0.08, ELB_DOWN), handR: 0, handL: 0 };

const TUT_FLAT = H(1, -0.03, 0.76, 0.24, [1, 0.1, -0.2]);
const tutA: PoseSpec = { ...wide(-0.05), chestX: 0.04, head: -4, r: TUT_FLAT, l: [88, 0, 175, 10], handR: 1, handL: 1 };
const tutB: PoseSpec = { ...wide(-0.05), chestX: 0.04, head: -4, r: [88, 0, 175, 10], l: H(-1, -0.03, 0.62, 0.24, [1, 0.1, -0.2]), handR: 1, handL: 1 };

const hatTilt: PoseSpec = {
  y: -0.07, rf: [0.06, 0.04, 0.03], lf: [-0.1, 0, 0], kneeR: -0.5, hips: -0.03, tilt: -5, nod: 12, head: 8, turn: -10,
  r: H(1, 0.08, 1.0, 0.13, [1, 0.3, -0.1]), l: H(-1, 0.3, 0.55, 0.04, ELB_OUT), handR: 0.2, handL: 1,
};
const hatDown: PoseSpec = { y: -0.03, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0, hips: 0, tilt: 0, nod: -2, head: 0, turn: 0, ...both(0.16, 0.54, 0.06, ELB_DOWN), handR: 0.5, handL: 0.5 };

const LAPEL = (X: number, y: number): PoseSpec => ({ ...both(X, y, 0.15, [1, -0.5, -0.1]), handR: 0, handL: 0 });
const tugA: PoseSpec = { y: 0.0, ...LAPEL(0.06, 0.74), shR: 1.1, shL: 1.1, nod: -8, kneeR: -0.2, kneeL: -0.2, rf: [0.07, 0, 0], lf: [-0.07, 0, 0] };
const tugB: PoseSpec = { y: -0.08, ...LAPEL(0.13, 0.6), shR: 0, shL: 0, nod: 8, kneeR: 0.2, kneeL: 0.2, rf: [0.11, 0, 0], lf: [-0.11, 0, 0] };

// The spin lands in the hat-tilt pose, feet a little wider.
const POSE_HIT: PoseSpec = { ...hatTilt, y: -0.06, rf: [0.12, 0, 0.02], kneeR: -0.4, spin: 0 };

const swingOut: PoseSpec = { y: -0.03, x: -0.02, rf: [0.3, 0.09, 0.03], hips: -0.03, tilt: -5, lean: -5, r: H(1, 0.16, 0.6, 0.18, ELB_DOWN), l: H(-1, 0.33, 0.78, 0.02, ELB_OUT), handR: 0, handL: 0 };
const swingIn: PoseSpec = { y: -0.06, x: 0.01, rf: [-0.03, 0.07, 0.12], hips: 0.05, tilt: 7, lean: 3, r: H(1, 0.3, 0.74, 0.04, ELB_OUT), l: H(-1, 0.14, 0.6, 0.18, ELB_DOWN), handR: 0, handL: 0 };

const glideA: PoseSpec = { x: 0.1, y: -0.07, hips: 0.02, rf: [0.26, 0, 0], lf: [-0.09, 0, 0], turn: 18, r: H(1, 0.4, 0.8, 0.06, ELB_DOWN), l: H(-1, -0.06, 0.7, 0.2, ELB_DOWN), handR: 0, handL: 0 };
const glideB: PoseSpec = { x: 0.18, y: -0.02, rf: [0.26, 0, 0], lf: [0.1, 0, 0.0], turn: 18, r: H(1, 0.33, 0.74, 0.1, ELB_DOWN), l: H(-1, -0.02, 0.64, 0.2, ELB_DOWN), handR: 1, handL: 1 };

// ---------------------------------------------------------------------------
// James Brown-style footwork and 60s soul dances

const camelDip: PoseSpec = {
  y: -0.14, x: -0.02, rf: [0.1, 0.02, 0.16], lf: [-0.09, 0, -0.04], kneeL: -0.5, hips: -0.06, tilt: -9, bend: 8, shR: 1, shL: 1, nod: 4,
  r: H(1, 0.24, 0.5, 0.16, ELB_DOWN), l: H(-1, 0.22, 0.56, -0.06, ELB_DOWN), handR: 0, handL: 0,
};

const goodFoot: PoseSpec = {
  y: -0.04, x: -0.02, rf: [0.24, 0.05, 0.14], lf: [-0.08, 0, 0], kneeR: 0.5, lean: -4, shR: 0.6, shL: 0.6,
  ...both(0.15, 0.78, 0.16, [1, -0.6, -0.1]), handR: 0, handL: 0,
};
const goodBounce: PoseSpec = { ...goodFoot, y: -0.09, shR: 0, shL: 0, ...both(0.16, 0.72, 0.16, [1, -0.6, -0.1]) };

const popcornUp: PoseSpec = {
  y: -0.03, rf: [0.02, 0.15, 0.08], kneeR: -0.55, hips: -0.03, tilt: -5, lean: 3,
  r: H(1, 0.06, 0.6, 0.2, ELB_DOWN), l: H(-1, -0.06, 0.62, 0.2, ELB_DOWN), handR: 1, handL: 1,
};
const popcornDown: PoseSpec = { y: -0.07, rf: [0.09, 0, 0], kneeR: 0, hips: 0, tilt: 0, lean: 0, ...both(0.22, 0.6, 0.1, ELB_DOWN), handR: 1, handL: 1 };

// ---------------------------------------------------------------------------
// Soul Train grooves

const cornerKey = (sx: number, fwd: number): PoseSpec => ({
  ...wide(-0.08), hips: 0.065 * sx, tilt: 9 * sx, hipTwist: 18 * fwd * sx, lean: 3 * sx, head: -4 * sx,
  r: H(1, 0.3, 0.92, 0.08, ELB_DOWN), l: H(-1, 0.3, 0.92, 0.08, ELB_DOWN), handR: 1, handL: 1,
});

// ---------------------------------------------------------------------------
// New jack swing

const rabbitKick: PoseSpec = {
  y: 0.04, spin: 25, bend: 6, rf: [0.08, 0.17, -0.16], lf: [-0.07, 0.02, 0.02],
  r: H(1, 0.17, 0.62, -0.06, ELB_DOWN), l: H(-1, 0.15, 0.74, 0.18, ELB_DOWN), handR: 0, handL: 0,
};
const rabbitLand: PoseSpec = { ...rabbitKick, y: -0.07, rf: [0.08, 0, -0.04], lf: [-0.07, 0, 0.02], bend: 3, ...both(0.17, 0.66, 0.08, ELB_DOWN) };

const kickStep: PoseSpec = {
  y: 0.04, bend: -4, rf: [0.1, 0.17, 0.33], lf: [-0.08, 0.02, -0.02],
  r: H(1, 0.2, 0.6, -0.04, ELB_OUT), l: H(-1, 0.04, 0.76, 0.2, ELB_DOWN), handR: 0, handL: 0,
};
const kickLand: PoseSpec = { y: -0.08, bend: 3, rf: [0.09, 0, 0.02], lf: [-0.09, 0, 0], ...both(0.18, 0.64, 0.1, ELB_DOWN), handR: 0, handL: 0 };

// ---------------------------------------------------------------------------
// More locking, soul and pose hits

const whichKey = (s: Side): PoseSpec => ({
  y: -0.08, spin: 32 * s, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], turn: -26 * s, kneeR: 0.1, kneeL: 0.1,
  r: H(1, 0.12, 0.7, 0.2, ELB_DOWN), l: H(-1, 0.12, 0.7, 0.2, ELB_DOWN), handR: 0, handL: 0, shR: 0.4, shL: 0.4,
});

const boogaKey: PoseSpec = {
  x: 0.03, y: -0.1, hips: 0.06, tilt: 8, kneeL: -0.55, kneeR: 0.2, rf: [0.12, 0, 0], lf: [-0.11, 0, 0.02], lean: -3, head: 4,
  r: H(1, 0.26, 0.5, 0.1, ELB_OUT), l: H(-1, 0.22, 0.56, 0.14, ELB_OUT), handR: 1, handL: 1,
};
const boogaMid: PoseSpec = { x: 0, y: -0.05, hips: 0, tilt: 0, kneeL: 0, kneeR: 0, lean: 0, head: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...both(0.24, 0.55, 0.12, ELB_OUT), handR: 1, handL: 1 };

const PAW = [0.6, -1, 0.1] as const;
const phillyA: PoseSpec = {
  y: -0.02, rf: [0.08, 0.14, 0.1], lf: [-0.09, 0, 0], nod: 5,
  r: H(1, 0.12, 0.62, 0.24, PAW), l: H(-1, 0.12, 0.76, 0.2, PAW), handR: 1, handL: 1,
};
const phillyDown: PoseSpec = { y: -0.07, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], nod: 0, ...both(0.12, 0.69, 0.22, PAW), handR: 1, handL: 1 };

const dimeStart: PoseSpec = { ...wide(-0.05), turn: -12, r: H(1, -0.12, 0.8, 0.22, [0.3, -1, 0]), l: ARM.hip, handR: 1, handL: 0 };
const dimeStop: PoseSpec = { ...wide(-0.09, { kneeL: 0.2 }), turn: 20, nod: 4, shR: 0.3, r: H(1, 0.42, 0.8, 0.1, [0.3, -1, 0]), l: ARM.hip, handR: 1, handL: 0 };

const bumpSlide: PoseSpec = { x: 0.11, y: -0.06, hips: 0.08, tilt: 10, rf: [0.25, 0, 0], lf: [-0.06, 0, 0], lean: -5, head: 5, r: H(1, 0.33, 0.66, 0.08, ELB_OUT), l: H(-1, 0.04, 0.64, 0.2, ELB_DOWN), handR: 1, handL: 0 };
const bumpIn: PoseSpec = { x: 0.18, y: -0.03, hips: -0.01, tilt: 0, rf: [0.27, 0, 0], lf: [0.09, 0, 0], lean: 1, head: 0, ...both(0.18, 0.58, 0.1, ELB_DOWN), handR: 0.6, handL: 0.6 };

const beltTug: PoseSpec = {
  y: -0.07, rf: [0.07, 0.05, 0.05], lf: [-0.1, 0, 0], kneeR: -0.6, hips: -0.035, tilt: -6, nod: -8, turn: 12,
  r: H(1, 0.12, 0.57, 0.13, [1, -0.3, -0.2]), l: H(-1, 0.12, 1.14, 0.05, ELB_OUT), handR: 0, handL: 0, shL: 0.3,
};
const beltDown: PoseSpec = { y: -0.03, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0, hips: 0, tilt: 0, nod: 2, turn: 0, r: H(1, 0.15, 0.56, 0.12, [1, -0.3, -0.2]), l: H(-1, 0.25, 0.7, 0.08, ELB_DOWN), handR: 0, handL: 0, shL: 0 };

const skeeterKick = (lift: number, fwd: number, y: number): PoseSpec => ({
  y, bend: -3, rf: [0.12, lift, fwd], lf: [-0.07, y > 0 ? 0.02 : 0, 0],
  r: H(1, 0.24, 0.66, 0.06, ELB_OUT), l: H(-1, 0.24, 0.66, 0.06, ELB_OUT), handR: 0, handL: 0, shR: 0.3, shL: 0.3,
});

// ---------------------------------------------------------------------------
// Snake, backslide, slides and the air sax

// Moonwalk in quarter profile: one foot flat sliding back, the other on its toe with the knee bent.
const backslide = (s: Side): PoseSpec => ({
  spin: 55, y: -0.05, bend: 3, rf: s > 0 ? [0.06, 0.035, -0.02] : [0.06, 0, -0.16], lf: s > 0 ? [-0.06, 0, -0.16] : [-0.06, 0.035, -0.02],
  kneeR: 0, kneeL: 0, r: H(1, 0.18, 0.55, 0.1, ELB_DOWN), l: H(-1, 0.18, 0.55, 0.1, ELB_DOWN), handR: 0.6, handL: 0.6,
});

// Air sax held on the right: neck at the lips, bell low by the right hip.
const SAX = (dy: number): PoseSpec => ({
  r: H(1, 0.13, 0.56 + dy, 0.2, [1, -0.5, -0.1]), l: H(-1, -0.04, 0.7 + dy, 0.22, [1, -0.5, -0.1]), handR: 0.2, handL: 0.2,
});
const saxUp: PoseSpec = { y: -0.03, rf: [0.12, 0, 0.02], lf: [-0.1, 0, 0], ...SAX(0.07), bend: -6, nod: -8, lean: -3, head: 4, twist: 6 };
const saxDown: PoseSpec = { y: -0.11, rf: [0.12, 0, 0.02], lf: [-0.1, 0, 0], kneeR: 0.2, kneeL: 0.2, ...SAX(-0.05), bend: 9, nod: 8, lean: 3, head: -3, twist: -4 };

const snakeKey: PoseSpec = {
  y: -0.06, chestX: 0.065, hips: -0.06, tilt: -7, lean: -4, head: 10, rf: [0.11, 0, 0], lf: [-0.11, 0, 0],
  r: H(1, 0.36, 0.78, 0.06, ELB_DOWN), l: H(-1, 0.16, 0.55, 0.1, ELB_DOWN), handR: 1, handL: 1,
};

const jbSlideA: PoseSpec = { x: 0.06, y: -0.08, rf: [0.15, 0, 0], lf: [-0.13, 0.15, 0.03], lean: 7, kneeR: 0.25, r: H(1, 0.36, 0.72, 0.04, ELB_DOWN), l: H(-1, 0.3, 0.7, 0.04, ELB_DOWN), handR: 1, handL: 1 };
const jbSlideB: PoseSpec = { x: 0.18, y: -0.06, rf: [0.27, 0, 0], lf: [0.06, 0.12, 0.05], lean: 7, kneeR: 0.25, r: H(1, 0.34, 0.68, 0.06, ELB_DOWN), l: H(-1, 0.3, 0.66, 0.06, ELB_DOWN), handR: 1, handL: 1 };

// ---------------------------------------------------------------------------
// Popping ticks and the locking Funky Guitar

// One straight arm rises out to the side in four sharp ticks, then drops.
const tickKey = (elev: number, y: number): PoseSpec => ({
  ...wide(y), r: [elev, 6, elev + 2, 6], l: ARM.hip, handR: 1, handL: 0, turn: elev > 100 ? 14 : 8, nod: elev > 100 ? -6 : 0,
});

const FRET: ArmAngles = H(-1, 0.26, 0.74, 0.18, [0.3, -1, 0]);
const guitarKick: PoseSpec = {
  y: -0.03, x: -0.03, lean: -9, head: 5, rf: [0.3, 0.13, 0.06], lf: [-0.09, 0, 0],
  r: H(1, -0.02, 0.58, 0.2, [1, -0.6, 0]), l: FRET, handR: 0, handL: 0.2,
};
const guitarDown: PoseSpec = { y: -0.1, x: 0, lean: 0, head: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: H(1, 0.0, 0.5, 0.2, [1, -0.6, 0]), l: FRET, handR: 0, handL: 0.2 };

// ---------------------------------------------------------------------------
// 60s soul novelties

// The Fly: swat an imaginary fly, high on one side, then low on the other.
const flyHigh: PoseSpec = { y: -0.03, x: 0.02, lean: 6, turn: 18, nod: -8, r: H(1, 0.3, 1.04, 0.12, ELB_OUT), l: H(-1, 0.2, 0.62, 0.12, ELB_DOWN), handR: 1, handL: 1, rf: [0.11, 0, 0], lf: [-0.09, 0.02, 0] };
const flyLow: PoseSpec = { y: -0.1, x: -0.02, lean: -6, turn: -14, nod: 8, r: H(1, 0.16, 0.66, 0.16, ELB_DOWN), l: H(-1, 0.32, 0.5, 0.12, ELB_OUT), handR: 1, handL: 1, rf: [0.09, 0.02, 0], lf: [-0.11, 0, 0] };

// The Batusi: two-finger V swiped across the eyes, one hand then the other.
const batKey = (s: Side): PoseSpec => ({
  y: -0.06, twist: 8 * s, turn: -6 * s, rf: [0.11, 0, 0], lf: [-0.11, 0, 0],
  r: s > 0 ? H(1, 0.02, 0.95, 0.2, [1, -0.4, -0.1]) : H(1, 0.3, 0.72, 0.08, ELB_DOWN),
  l: s < 0 ? H(-1, 0.02, 0.95, 0.2, [1, -0.4, -0.1]) : H(-1, 0.3, 0.72, 0.08, ELB_DOWN),
  handR: s > 0 ? 0.5 : 1, handL: s < 0 ? 0.5 : 1,
});
const batSwipe = (s: Side): PoseSpec => ({ ...batKey(s), y: -0.03, r: s > 0 ? H(1, 0.17, 0.95, 0.18, [1, -0.4, -0.1]) : batKey(s).r, l: s < 0 ? H(-1, 0.17, 0.95, 0.18, [1, -0.4, -0.1]) : batKey(s).l });

export const moves: MoveDef[] = [
  // Original basics
  combo('funky-chicken', 'Funky Chicken', 'kneeKnock', 'wings', 'mid', 2, 'funk | full |', { desc: 'Knees knock in and out while bent elbows flap like wings.' }),
  combo('kick-ball-change', 'Kick Ball Change', 'kickBall', 'snaps', 'mid', 2, 'funk pop | legs | kick', { desc: 'Kick forward, step onto the ball of that foot behind, change weight to the other foot.' }),
  combo('heel-swivel', 'Heel Swivel', 'heelSwivel', 'jazzHands', 'mid', 2, 'funk pop | legs | twist', { desc: 'Feet together, swivel both heels out and in on the half beats.' }),
  combo('knee-pop', 'Knee Pop', 'kneePop', 'fkKneePush', 'mid', 2, 'funk pop hiphop | legs hips |', { desc: 'Pop one knee in with the heel up while that hand pushes the thigh down and the other fist rises.' }),
  combo('kick-point', 'Side Kick & Point', 'kickSide', 'discoPoint', 'mid', 3, 'funk pop | full | kick point'),
  combo('rock-step-clap', 'Rock Step Clap', 'rockBack', 'clap', 'low', 1, 'funk pop rock | legs | clap'),
  combo('toe-tap', 'Tap & Point Down', 'fkTapDiag', 'fkTapPoint', 'low', 1, 'funk pop | legs | point', { desc: 'Tap the toe out on the diagonal and point down at it, other fist on the hip.' }),
  combo('the-robot', 'The Robot', 'plant', 'robot', 'mid', 2, 'funk pop kpop | arms |'),

  // Locking
  full({
    id: 'the-lock', name: 'The Lock', tags: 'funk | arms full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Hands roll in front of the chest, then freeze: knees bent, fists up by the shoulders, shoulders up.',
    keys: [[0, lockOpen], [0.5, lockRoll], [1, lockHit], [1.5, { ...lockHit, y: -0.11, shR: 0.6, shL: 0.6 }]],
  }),
  full({
    id: 'uncle-sam-point', name: 'Uncle Sam Point', tags: 'funk | arms | point', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Step forward and point straight out at the crowd on the diagonal, other fist on the hip; pull the fist back.',
    keys: [[0, samPoint], [0.5, { ...samPoint, y: -0.06 }], [1, samBack]],
  }),
  full({
    id: 'wrist-twirl', name: 'Wrist Twirl', tags: 'funk disco | arms | hands', beats: 2, level: 'low', d: 2, parts: ['arms'], mirror: true,
    desc: 'Twirl the wrists around each other up by one shoulder, then flick both hands open low and wide.',
    keys: [[0, twirlA], [0.5, twirlB], [1, twirlOpen], [1.5, { ...both(0.2, 0.7, 0.16, ELB_DOWN), y: -0.04, handR: 0.6, handL: 0.6 }]],
  }),
  full({
    id: 'scoobot', name: 'Scoobot', tags: 'funk | legs | kick', beats: 2, level: 'mid', d: 3, parts: ['legs', 'arms'], mirror: true,
    desc: 'Knee up, kick it out forward, step down; bent arms pump in opposition like a stylised run.',
    keys: [[0, scooKnee], [0.5, scooKick], [1, scooDown], [1.5, { ...scooDown, y: -0.03 }]],
  }),
  full({
    id: 'muscle-man', name: 'Muscle Man', tags: 'funk party | arms | hands', beats: 2, level: 'mid', d: 1, parts: ['arms', 'legs'],
    desc: 'Hit a double-biceps flex, then crunch both fists together in front of the belly with the shoulders up.',
    keys: [[0, flexUp], [0.5, { ...flexUp, y: -0.05 }], [1, flexCrab], [1.5, { ...flexCrab, y: -0.11, shR: 0.9, shL: 0.9 }]],
  }),
  full({
    id: 'give-yourself-five', name: 'Give Yourself Five', tags: 'funk party | arms | clap hands', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Slap your own hands together high out to one side, then drop both fists low with a shoulder shrug.',
    keys: [[0, fiveSlap], [1, fiveBack]],
  }),
  full({
    id: 'lock-drop', name: 'Lock Drop', tags: 'funk | legs full |', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Arms up in a V, then drop to a half squat with the hands toward the knees and spring back up.',
    keys: [[0, dropUp], [0.5, { ...dropUp, y: -0.05, r: ARM.out, l: ARM.out }], [1, dropDown], [1.5, { ...dropDown, y: -0.09, ...both(0.3, 0.62, 0.12, ELB_OUT) }]],
  }),
  // Popping-flavoured hits
  full({
    id: 'fresno', name: 'Fresno', tags: 'funk hiphop | full |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Step wide to the side and hit: that upper arm snaps out level with the forearm hanging, then step back in.',
    keys: [[0, fresnoHit], [0.5, { ...fresnoHit, y: -0.06, shR: 0.2 }], [1, fresnoBack]],
  }),
  full({
    id: 'king-tut', name: 'King Tut', tags: 'funk hiphop | arms | hands', beats: 2, level: 'low', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Flat hands in square 90-degree shapes: one forearm level across the chest, the other straight up; swap with a head slide.',
    keys: [[0, tutA], [0.5, { ...tutA, y: -0.03 }], [1, tutB], [1.5, { ...tutB, y: -0.03, chestX: 0.0, head: 0 }]],
  }),

  // Michael Jackson-era pose hits and pop-funk steps
  full({
    id: 'hat-tilt', name: 'Hat Tilt', tags: 'funk pop | arms full | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Hit a pose: fingertips to the brim of an imaginary hat, head tipped down, knee popped in, other arm long and open.',
    keys: [[0, hatTilt], [0.5, { ...hatTilt, y: -0.06 }], [1, hatDown]],
  }),
  full({
    id: 'jacket-tug', name: 'Jacket Tug', tags: 'funk pop | arms | hands', beats: 1, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Grab both lapels and tug the jacket: knees in and shoulders up, then snap the lapels down and out as the knees bend.',
    keys: [[0, tugA], [0.5, tugB]],
  }),
  full({
    id: 'spin-pose', name: 'Spin into Pose', tags: 'funk pop | turn | spin', beats: 4, level: 'mid', d: 3, parts: ['turn', 'arms'],
    desc: 'One quick turn on the balls of the feet with the arms tucked, landing in a hat-tilt pose held for two counts.',
    keys: [
      ...spinKeys(0).map(([t, k]) => [t, { ...k, ...both(0.08, 0.7, 0.16, ELB_DOWN), handR: 0, handL: 0 }] as const),
      [2, POSE_HIT],
      [3, { ...POSE_HIT, y: -0.05 }],
    ],
  }),
  full({
    id: 'leg-swing-snap', name: 'Leg Swing Hip Snap', tags: 'funk pop | legs hips | kick hips', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'], mirror: true,
    desc: 'Swing one leg out to the side, then sweep it across the front with a sharp hip snap; the arms swing the other way.',
    keys: [[0, swingOut], [1, swingIn], [1.5, { ...swingIn, rf: [0.09, 0, 0], y: -0.04, hips: 0.02, tilt: 2 }]],
  }),
  full({
    id: 'snap-glide', name: 'Snap Glide', tags: 'funk pop | legs | walk hands', beats: 2, level: 'low', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.18,
    desc: 'Step out wide and glide the other foot in along the floor, snapping both hands up at shoulder height toward the travel side.',
    keys: [[0, glideA], [1, glideB]],
  }),
  // James Brown-style footwork and 60s soul dances
  full({
    id: 'camel-walk', name: 'Camel Walk', tags: 'funk | legs hips | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'],
    desc: 'Slide one heel forward while the back knee sinks in, shoulders hunched and fists low, then switch feet.',
    keys: [[0, camelDip], [0.5, { ...camelDip, y: -0.05, shR: 0.2, shL: 0.2 }], [1, mir(camelDip)], [1.5, { ...mir(camelDip), y: -0.05, shR: 0.2, shL: 0.2 }]],
  }),
  full({
    id: 'good-foot', name: 'The Good Foot', tags: 'funk | legs | kick', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'Put one foot out on its heel on the diagonal and bounce on the standing leg, fists up at the chest, shoulders popping.',
    keys: [[0, goodFoot], [0.5, goodBounce], [1, { ...goodFoot, y: -0.05 }], [1.5, { ...goodBounce, rf: [0.09, 0.01, 0.02], kneeR: 0 }]],
  }),
  full({
    id: 'popcorn', name: 'The Popcorn', tags: 'funk | legs | kick', beats: 1, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'Snap one knee up and in across the body, hands dropping toward it, then land and pop the other knee.',
    keys: [[0, popcornUp], [0.5, popcornDown]],
  }),
  combo('heel-toe-swivel', 'Heel-Toe Swivel', 'fkHeelToe', 'snaps', 'mid', 3, 'funk pop | legs | walk twist', { desc: 'Travel sideways by swivelling the toes out, then the heels out, feet together, snapping the fingers.' }),

  // Soul Train grooves
  full({
    id: 'four-corners', name: 'Four Corners', tags: 'funk | hips | hips', beats: 2, level: 'mid', d: 2, parts: ['hips'],
    desc: 'Hands up by the shoulders, hit the hips into four corners in turn: front right, back right, back left, front left.',
    keys: [[0, cornerKey(1, 1)], [0.5, cornerKey(1, -1)], [1, cornerKey(-1, 1)], [1.5, cornerKey(-1, -1)]],
  }),

  // New jack swing
  full({
    id: 'roger-rabbit', name: 'Roger Rabbit', tags: 'funk hiphop | legs | jump kick', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true,
    desc: 'Turned a little to the side, skip back: hop and kick one foot up behind, land, then the other, arms pumping.',
    keys: [[0, rabbitKick], [0.5, rabbitLand], [1, { ...rabbitKick, rf: [0.08, 0.02, 0.02], lf: [-0.07, 0.17, -0.16] }], [1.5, rabbitLand]],
  }),
  full({
    id: 'kick-step', name: 'Kick Step', tags: 'funk hiphop | legs | jump kick', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump'], mirror: true, jump: true,
    desc: 'Hop and kick one foot straight out in front, land, then hop and kick the other, arms swinging in opposition.',
    keys: [[0, kickStep], [0.5, kickLand], [1, mir(kickStep)], [1.5, kickLand]],
  }),
  // More locking, soul and pose hits
  full({
    id: 'which-a-way', name: 'Which-a-Way', tags: 'funk | turn full | twist', beats: 2, level: 'mid', d: 2, parts: ['turn', 'legs'],
    desc: 'Snap the whole body to face one diagonal while the head looks back the other way, then snap to the other diagonal.',
    keys: [[0, whichKey(1)], [0.5, { ...whichKey(1), y: -0.04 }], [1, whichKey(-1)], [1.5, { ...whichKey(-1), y: -0.04 }]],
  }),
  full({
    id: 'boogaloo', name: 'Boogaloo', tags: 'funk | hips legs | hips', beats: 2, level: 'mid', d: 2, parts: ['hips', 'legs'],
    desc: 'Roll one knee in as the hips roll out to the other side, hands loose and low, then roll through centre to the other side.',
    keys: [[0, boogaKey], [0.5, boogaMid], [1, mir(boogaKey)], [1.5, boogaMid]],
  }),
  full({
    id: 'philly-dog', name: 'Philly Dog', tags: 'funk party | legs arms | walk', beats: 2, level: 'mid', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Lift one knee as the palms-down hands paddle in front of the chest, one up and one down, then the other knee.',
    keys: [[0, phillyA], [0.5, phillyDown]],
  }),
  full({
    id: 'dime-stop', name: 'Dime Stop', tags: 'funk hiphop | arms | hands', beats: 2, level: 'low', d: 2, parts: ['arms'], mirror: true,
    desc: 'Glide a flat hand across from the other shoulder and stop it dead out to the side on the beat; hold the freeze.',
    keys: [[0, dimeStart], [1, dimeStop], [1.5, { ...dimeStop, y: -0.07 }]],
  }),
  full({
    id: 'bump-slide', name: 'Bump & Slide', tags: 'funk disco | hips legs | hips walk', beats: 2, level: 'mid', d: 2, parts: ['hips', 'legs'], mirror: true, travel: 0.18,
    desc: 'Step out and bump the hip toward the travel side with that arm out, then slide the other foot in along the floor.',
    keys: [[0, bumpSlide], [1, bumpIn]],
  }),
  full({
    id: 'belt-tug', name: 'Belt Tug', tags: 'funk pop | arms legs | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Pose hit: one fist tugs the belt at the hip as that knee pops in, the other fist punches straight up, chin up.',
    keys: [[0, beltTug], [0.5, { ...beltTug, y: -0.06 }], [1, beltDown]],
  }),
  full({
    id: 'skeeter-rabbit', name: 'Skeeter Rabbit', tags: 'funk | legs | jump kick', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true,
    desc: 'Hop and kick the same foot out twice, low then higher, with the arms out and bent, then switch legs.',
    keys: [[0, skeeterKick(0.08, 0.2, 0.03)], [0.5, skeeterKick(0.18, 0.3, 0.05)], [1, skeeterKick(0, 0.03, -0.08)], [1.5, { ...skeeterKick(0, 0.02, -0.04), rf: [0.09, 0, 0] }]],
  }),
  // Snake, backslide, slides and the air sax
  full({
    id: 'backslide', name: 'Backslide', tags: 'funk pop | legs turn | walk', beats: 2, level: 'mid', d: 3, parts: ['legs', 'turn'],
    desc: 'Turned to a quarter profile, slide one flat foot back while the other knee bends up onto its toe, then switch: a moonwalk on the spot.',
    keys: [[0, backslide(1)], [0.5, { ...backslide(1), y: -0.03 }], [1, backslide(-1)], [1.5, { ...backslide(-1), y: -0.03 }]],
  }),
  full({
    id: 'air-sax', name: 'Air Sax', tags: 'funk party | arms full | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Play an imaginary saxophone held down by the right hip: lean back and lift the bell on the beat, then sink and bend over it.',
    keys: [[0, saxUp], [1, saxDown], [1.5, { ...saxDown, y: -0.08 }]],
  }),
  full({
    id: 'the-snake', name: 'The Snake', tags: 'funk | full | wave', beats: 2, level: 'low', d: 2, parts: ['torso', 'hips'],
    desc: 'Slide the rib cage one way and the hips the other in an S-curve, one arm floating out, then wave it back to the other side.',
    keys: [[0, snakeKey], [1, mir(snakeKey)]],
  }),
  full({
    id: 'jb-slide', name: 'James Brown Slide', tags: 'funk | legs | walk', beats: 2, level: 'mid', d: 3, parts: ['legs'], mirror: true, travel: 0.18,
    desc: 'Glide sideways on one foot with the other foot lifted and fluttering beside it, arms out loose for balance.',
    keys: [[0, jbSlideA], [1, jbSlideB]],
  }),
  // Popping ticks and the locking Funky Guitar
  full({
    id: 'tick-arm', name: 'Tick Arm', tags: 'funk hiphop | arms |', beats: 2, level: 'low', d: 2, parts: ['arms'], mirror: true,
    desc: 'Raise one straight arm out to the side in four sharp ticks, each one a frozen hit, then drop it; other fist on the hip.',
    keys: [[0, tickKey(30, -0.05)], [0.5, tickKey(70, -0.07)], [1, tickKey(110, -0.05)], [1.5, tickKey(150, -0.07)]],
  }),
  full({
    id: 'funky-guitar', name: 'Funky Guitar', tags: 'funk rock | full | kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Strum a low guitar across the belly and kick the leg out to the side on the beat, leaning away, then sink and strum.',
    keys: [[0, guitarKick], [0.5, { ...guitarKick, rf: [0.2, 0.05, 0.04], r: H(1, 0.02, 0.5, 0.2, [1, -0.6, 0]) }], [1, guitarDown], [1.5, { ...guitarDown, y: -0.06, r: H(1, -0.02, 0.6, 0.2, [1, -0.6, 0]) }]],
  }),
  // 60s soul novelties
  full({
    id: 'the-fly', name: 'The Fly', tags: 'funk party | arms | hands', beats: 2, level: 'mid', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Swat at an imaginary fly high up to one side, then dip and swat it low on the other side.',
    keys: [[0, flyHigh], [1, flyLow], [1.5, { ...flyLow, y: -0.06 }]],
  }),
  full({
    id: 'batusi', name: 'Batusi', tags: 'funk party | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms'],
    desc: 'Twist and draw a two-finger V across the eyes with one hand, other arm out low, then swipe with the other hand.',
    keys: [[0, batKey(1)], [0.5, batSwipe(1)], [1, batKey(-1)], [1.5, batSwipe(-1)]],
  }),
];
