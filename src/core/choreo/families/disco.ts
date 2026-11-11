/**
 * Disco: 70s / 80s dance-floor vocabulary and modern nu-disco club steps.
 * The bump, disco points, rolling hands, hustle, shimmies, line-dance steps,
 * 60s floor dances (monkey, jerk, pony, watusi), roller glides and
 * voguing-style arms.
 *
 * Arms: `at(side, x, y, z, elbow)` puts a hand at a world position (x = screen
 * x, so the LEFT hand's own side is negative x); shoulders at (+-0.125, 0.78),
 * head centre ~ y 0.93, pelvis ~ y 0.5. `mirror: true` moves are written for
 * the user's RIGHT (screen-right) side.
 */

import { ARM, CHEST_BOX, W, at, mir, type ArmAngles, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';
import { spinKeys } from './shared';

// ---------------------------------------------------------------------------
// Shared shapes

const hipA: PoseSpec = { hips: 0.055, y: -0.025, lf: [-0.085, 0.025, 0.02], head: -4 };
/** Rolling hands: forearms circling around each other at (cx, cy, cz). */
const roll = (k: number, cy = 0.68, cz = 0.2, rad = 0.055, elbow: readonly [number, number, number] = [0.8, -1, -0.3]): PoseSpec => {
  const a = (k * Math.PI) / 2;
  return {
    r: at(1, rad * Math.cos(a), cy + rad * Math.sin(a), cz, elbow),
    l: at(-1, -rad * Math.cos(a), cy - rad * Math.sin(a), cz, elbow),
    handR: 0, handL: 0,
  };
};
const rollAt = (k: number): PoseSpec => roll(k);
const shimmyArms = (s: number): PoseSpec => ({
  twist: 11 * s, shR: s > 0 ? 0.55 : 0, shL: s < 0 ? 0.55 : 0, lean: 1.5 * s,
  r: [48, 25, 70, 45], l: [48, 25, 70, 45], handR: 1, handL: 1,
});
const shimmyKey = (s: number, low: number): PoseSpec => ({
  y: -0.07 - (s < 0 ? 0.01 : 0), twist: 14 * s, shR: s > 0 ? 0.4 : 0, shL: s < 0 ? 0.4 : 0, lean: 2 * s,
  r: [low, 10, low + 8, 30], l: [low, 10, low + 8, 30], rf: [0.13, 0, 0], lf: [-0.13, 0, 0], handR: 1, handL: 1,
});

/** Straight arm pointing up and out on the diagonal (the disco point). */
const POINT_UP: ArmAngles = [146, 12, 148, 12];
/** Straight arm pointing down and out on its own side. */
const POINT_DOWN: ArmAngles = [42, 12, 42, 12];
/** Fist pulled in at the chest, elbow out (the point's "load"). */
const FIST_IN: ArmAngles = at(1, 0.06, 0.76, 0.17, [1, -0.4, -0.2]);
const FIST_IN_L: ArmAngles = at(-1, -0.06, 0.76, 0.17, [1, -0.4, -0.2]);
/** Fist up beside the shoulder, elbow out and down (the bump's arm). */
const FIST_UP_R: ArmAngles = at(1, 0.23, 0.9, 0.1, [1, -0.4, -0.3]);
const FIST_LOW_L: ArmAngles = at(-1, -0.08, 0.62, 0.19, [0.6, -1, -0.3]);

// ---------------------------------------------------------------------------
// Patterns (other families may use these ids too)

export const patterns: PatternSet = {
  foot: {
    hipBump: { beats: 2, parts: ['hips'], torso: true, keys: [[0, hipA], [1, mir(hipA)]] },
    backTap: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: 0.05, hips: 0.02, rf: [0.21, 0, 0], lf: [-W, 0, 0] }],
        [1, { x: 0.06, y: -0.035, twist: -6, rf: [0.21, 0, 0], lf: [0.05, 0.02, -0.11] }],
      ],
    },
  },
  arms: {
    rollingHands: { beats: 2, parts: ['arms'], keys: [[0, rollAt(0)], [0.5, rollAt(1)], [1, rollAt(2)], [1.5, rollAt(3)]] },
    rollHigh: { beats: 2, parts: ['arms'], keys: [0, 1, 2, 3].map((k) => [k / 2, { ...roll(k, 0.98, 0.17, 0.055, [1, -0.2, 0.1]), nod: -4 }] as const) },
    rollLow: { beats: 2, parts: ['arms'], keys: [0, 1, 2, 3].map((k) => [k / 2, roll(k, 0.5, 0.24, 0.06)] as const) },
    discoPoint: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: 8, turn: 10, nod: -8, r: [142, 12, 144, 12], l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
        [1, { head: -6, turn: -10, nod: 8, r: [48, 125, 44, 150], l: ARM.hip, handR: 0, handL: 0 }],
      ],
    },
    hitchhike: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { turn: 14, head: 4, r: [62, 0, 98, 8], l: ARM.hip, handR: 0, handL: 0 }],
        [1, { r: CHEST_BOX, l: ARM.hip, handR: 0, handL: 0 }],
      ],
    },
    shoulderShimmy: { beats: 1, parts: ['torso'], torso: true, keys: [[0, shimmyArms(1)], [0.5, shimmyArms(-1)]] },
  },
};

// ---------------------------------------------------------------------------
// Hand-authored key shapes

// The bump: hip thrown out to the side, knees soft, fist up on the bump side.
const bumpR: PoseSpec = {
  hips: 0.085, tilt: 11, y: -0.06, x: 0.01, lean: -5, head: 5, lf: [-0.09, 0.02, 0.03], kneeL: -0.15, kneeR: 0.1,
  r: FIST_UP_R, l: FIST_LOW_L, handR: 0, handL: 0,
};
const bumpMid: PoseSpec = { hips: 0.02, y: -0.035, r: at(1, 0.12, 0.66, 0.19, [1, -0.6, -0.2]), l: at(-1, -0.12, 0.66, 0.19, [1, -0.6, -0.2]), handR: 0, handL: 0 };

// Bump & point: bump the hip and point down at it.
const bumpPointR: PoseSpec = {
  hips: 0.08, tilt: 10, y: -0.055, lean: 4, head: 6, turn: 18, nod: 10, lf: [-0.09, 0.02, 0.03], kneeL: -0.15,
  r: POINT_DOWN, l: FIST_IN_L, handR: 0, handL: 0,
};

// Saturday-night pose: one arm high on the diagonal, the other low on the opposite diagonal, foot pointed out.
const feverR: PoseSpec = {
  x: -0.02, hips: -0.05, tilt: -6, y: -0.03, rf: [0.25, 0, 0.03], lf: [-W, 0, 0], kneeR: 0.25, lean: -3, head: 8, turn: 14, nod: -8,
  r: POINT_UP, l: POINT_DOWN, handR: 0, handL: 0, formR: 'point',
};

// Roll the dice: shake cupped hands by the right ear, then throw them forward-down to the left.
const diceR = (up: number): PoseSpec => ({
  x: 0.02, hips: 0.04, tilt: 4, y: -0.03 - up * 0.01, lf: [-W, 0.015, 0.02], turn: 12, head: 5,
  r: at(1, 0.25, 0.84 + up * 0.035, 0.16, [1, -0.5, -0.2]), l: at(-1, 0.16, 0.82 + up * 0.035, 0.2, [0.3, -1, 0.1]),
  handR: 0.2, handL: 0.2,
});
const diceThrow: PoseSpec = {
  x: -0.04, hips: -0.04, y: -0.05, rf: [W, 0, 0], lf: [-0.2, 0, 0.04], twist: -14, lean: -5, turn: -18, nod: 8,
  r: at(1, -0.12, 0.6, 0.29, [0.3, -1, 0]), l: at(-1, -0.33, 0.58, 0.22, [0.3, -1, 0]), handR: 1, handL: 1,
};

// Hustle: rock back (and), replace, step side, together; leading hand out low.
const hustleArms: PoseSpec = { r: at(1, 0.3, 0.74, 0.16, [1, -0.6, -0.2]), l: at(-1, -0.04, 0.73, 0.17, [1, -0.6, -0.2]), handR: 1, handL: 0.6 };

// Hitch turn: a quarter turn on every beat, knee hitch and clap on the "and".
const hitchKey = (spin: number): PoseSpec => ({
  spin, y: -0.02, rf: [0.06, 0.2, 0.12], lf: [-0.06, 0, 0], kneeR: 0.1, r: ARM.clap, l: ARM.clap, handR: 1, handL: 1, nod: 4,
});
const landKey = (spin: number): PoseSpec => ({
  spin, y: -0.05, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], r: [30, 10, 40, 20], l: [30, 10, 40, 20], handR: 1, handL: 1,
});

// Chassé with an arm sweep: arms scoop low across the body and open high toward the travel.
const chasseLow: ArmAngles = at(1, -0.06, 0.48, 0.2, [0.4, -1, -0.3]);
const chasseLowL: ArmAngles = at(-1, 0.02, 0.5, 0.2, [0.4, -1, -0.3]);


// 60s floor dances.
const WIDE_FEET: PoseSpec = { rf: [0.12, 0, 0], lf: [-0.12, 0, 0] };
const monkeyA: PoseSpec = {
  ...WIDE_FEET, y: -0.09, bend: 6, nod: 9, kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.07, 1.0, 0.17, [1, -0.3, 0]), l: at(-1, -0.09, 0.6, 0.2, [0.6, -1, -0.3]), handR: 0, handL: 0,
};
const monkeyMid: PoseSpec = {
  ...WIDE_FEET, y: -0.03, bend: -2, nod: -4,
  r: at(1, 0.08, 0.8, 0.21, [1, -0.6, -0.1]), l: at(-1, -0.08, 0.8, 0.21, [1, -0.6, -0.1]), handR: 0, handL: 0,
};
const jerkUp = (s: number): PoseSpec => ({
  ...WIDE_FEET, y: -0.02, bend: -5, nod: -6, hips: 0.035 * s, tilt: 4 * s,
  r: at(1, 0.25, 0.98, 0.07, [1, -0.6, -0.1]), l: at(-1, -0.25, 0.98, 0.07, [1, -0.6, -0.1]), handR: 1, handL: 1,
});
const jerkDown: PoseSpec = {
  ...WIDE_FEET, y: -0.09, bend: 8, nod: 7, kneeR: 0.15, kneeL: 0.15,
  r: at(1, 0.11, 0.54, 0.2, [0.8, -1, -0.2]), l: at(-1, -0.11, 0.54, 0.2, [0.8, -1, -0.2]), handR: 0.4, handL: 0.4,
};
const ponyLand: PoseSpec = {
  x: 0.06, y: -0.07, hips: 0.035, rf: [0.15, 0, 0], lf: [-0.03, 0.14, 0.05], kneeL: -0.1,
  r: at(1, 0.13, 0.72, 0.2, [1, -0.6, -0.2]), l: at(-1, -0.13, 0.64, 0.2, [1, -0.6, -0.2]), handR: 0, handL: 0,
};
const ponyAir: PoseSpec = {
  x: 0, y: 0.03, rf: [0.09, 0.02, 0], lf: [-0.09, 0.02, 0],
  r: at(1, 0.13, 0.68, 0.2, [1, -0.6, -0.2]), l: at(-1, -0.13, 0.68, 0.2, [1, -0.6, -0.2]), handR: 0, handL: 0,
};
const watusiA: PoseSpec = {
  ...WIDE_FEET, y: -0.08, lean: 6, hips: -0.03, twist: 10, head: -4, turn: 16,
  r: [92, 5, 92, 5], l: at(-1, 0.06, 0.8, 0.27, [0.4, -1, 0]), handR: 1, handL: 1,
};
const watusiMid: PoseSpec = {
  ...WIDE_FEET, y: -0.03,
  r: at(1, 0.13, 0.74, 0.3, [0.6, -1, 0]), l: at(-1, -0.13, 0.74, 0.3, [0.6, -1, 0]), handR: 1, handL: 1,
};
const mashKick: PoseSpec = {
  rf: [0.22, 0.05, 0.03], lf: [-0.075, 0, 0], kneeL: 0.5, y: -0.05, hips: -0.025, lean: -3,
  r: at(1, 0.24, 0.62, 0.15, [1, -0.6, -0.2]), l: at(-1, -0.04, 0.66, 0.2, [1, -0.6, -0.2]), handR: 0.3, handL: 0.3,
};
const mashIn: PoseSpec = {
  rf: [0.075, 0, 0], lf: [-0.075, 0, 0], kneeR: -0.35, kneeL: -0.35, y: -0.03,
  r: at(1, 0.14, 0.64, 0.18, [1, -0.6, -0.2]), l: at(-1, -0.14, 0.64, 0.18, [1, -0.6, -0.2]), handR: 0.3, handL: 0.3,
};

// Claps on the diagonal: high over one shoulder, then low by the other hip.
const clapHighR: PoseSpec = {
  x: 0.02, y: 0, hips: 0.02, lean: 5, head: 5, turn: 14, nod: -8, rf: [0.11, 0, 0], lf: [-0.11, 0.0, 0],
  r: at(1, 0.27, 0.98, 0.24, [1, -0.4, 0.2]), l: at(-1, 0.23, 0.97, 0.27, [0.2, -0.6, 1]), handR: 1, handL: 1,
};
const clapLowL: PoseSpec = {
  x: -0.02, y: -0.11, hips: -0.03, lean: -5, twist: -12, head: -4, turn: -16, nod: 10, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.15, kneeL: 0.15,
  r: at(1, -0.15, 0.52, 0.24, [0.3, -1, 0]), l: at(-1, -0.21, 0.5, 0.21, [1, -0.5, -0.2]), handR: 1, handL: 1,
};

// Roller disco.
const glideR: PoseSpec = {
  x: 0.1, y: -0.11, hips: 0.03, lean: 9, bend: 9, head: 4, rf: [0.2, 0, 0], lf: [-0.01, 0.07, -0.14], kneeR: 0.1,
  r: at(1, -0.12, 0.72, 0.25, [0.6, -1, 0]), l: [60, -30, 62, -30], handR: 1, handL: 1,
};
const glideRide: PoseSpec = { ...glideR, y: -0.07, lean: 5, bend: 6, lf: [-0.04, 0.03, -0.09], r: at(1, -0.06, 0.7, 0.24, [0.6, -1, 0]), l: [54, -20, 58, -20] };
const glideMid: PoseSpec = {
  x: 0, y: -0.04, rf: [0.12, 0, 0], lf: [-0.12, 0, 0],
  r: at(1, 0.24, 0.6, 0.14, [1, -0.6, -0.2]), l: at(-1, -0.24, 0.6, 0.14, [1, -0.6, -0.2]), handR: 1, handL: 1,
};
const crossArms: PoseSpec = { r: [78, 8, 84, 10], l: [78, 8, 84, 10], handR: 1, handL: 1 };

// Voguing: framing the face, angular arm lines, the walk and the pose.
const frameTop: ArmAngles = at(1, -0.03, 1.13, 0.15, [1, 0.4, 0.3]);
const frameSideL: ArmAngles = at(-1, -0.22, 0.99, 0.1, [0.3, -1, 0]);
const frameChin: PoseSpec = {
  y: -0.04, r: at(1, 0.05, 0.8, 0.2, [1, -0.3, 0.2]), l: at(-1, -0.05, 0.8, 0.2, [1, -0.3, 0.2]), handR: 1, handL: 1, nod: -4,
};
const frameA: PoseSpec = { y: -0.02, hips: 0.04, tilt: 5, lf: [-W, 0.015, 0.02], head: -8, turn: -10, r: frameTop, l: frameSideL, handR: 1, handL: 1 };
const catwalkA: PoseSpec = {
  rf: [-0.015, 0, 0.09], lf: [-W, 0, -0.02], hips: 0.07, tilt: 9, y: -0.03, twist: -9, turn: 8, head: 3,
  r: at(1, 0.2, 0.5, -0.1, [0.2, 0.2, -1]), l: at(-1, -0.04, 0.68, 0.2, [0.8, -1, -0.2]), handR: 1, handL: 1,
};
const voguePoseA: PoseSpec = {
  x: 0.02, hips: 0.075, tilt: 10, y: -0.03, rf: [0.21, 0, 0.04], lf: [-W, 0, 0], kneeR: 0.2, lean: -4, head: 10, turn: 16, nod: -6,
  r: at(1, 0.04, 0.83, 0.16, [1, -0.5, 0]), l: ARM.hip, handR: 1, handL: 0,
};
const voguePoseB: PoseSpec = {
  x: -0.02, hips: -0.075, tilt: -10, y: -0.04, rf: [W, 0, 0], lf: [-0.2, 0, 0.04], kneeL: 0.2, lean: 5, head: -8, turn: -12, nod: -4,
  r: at(1, 0.07, 1.04, -0.03, [1, 0.5, 0]), l: [40, 10, 42, 10], handR: 1, handL: 1,
};

// Disco dip: step wide, sink and sweep one arm down toward the floor, rise sweeping it overhead.
const dipDown: PoseSpec = {
  x: 0.06, y: -0.19, rf: [0.22, 0, 0], lf: [-0.13, 0, 0], lean: 12, bend: 10, head: 6, nod: 8, kneeR: 0.15,
  r: at(1, 0.33, 0.33, 0.14, [1, -0.2, 0]), l: [62, 0, 66, 0], handR: 1, handL: 1,
};
const dipUp: PoseSpec = {
  x: 0.02, y: -0.02, rf: [0.18, 0, 0], lf: [-0.13, 0, 0], lean: -8, head: -5, nod: -10,
  r: [168, 30, 172, 30], l: [55, 0, 60, 0], handR: 1, handL: 1,
};

// The Freddie: hop on one foot, flinging the other leg and the same-side arm out on the diagonal.
const freddieA: PoseSpec = {
  y: 0.04, x: -0.02, lean: -6, rf: [0.24, 0.1, 0.08], lf: [-0.08, 0.02, 0], kneeR: 0.2,
  r: [128, 10, 132, 10], l: [30, 0, 40, 10], handR: 1, handL: 1,
};
const freddieLand: PoseSpec = { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [40, 10, 50, 20], l: [40, 10, 50, 20], handR: 1, handL: 1 };

// The swim family of dances: breaststroke arms, holding the nose and sinking down.
const breastIn: PoseSpec = {
  x: 0.02, hips: 0.03, y: -0.02, bend: 5, nod: 3,
  r: at(1, 0.03, 0.8, 0.29, [1, -0.4, -0.1]), l: at(-1, -0.03, 0.8, 0.29, [1, -0.4, -0.1]), handR: 1, handL: 1,
};
const breastOut: PoseSpec = {
  x: 0, hips: 0, y: -0.07, bend: 0, nod: -2,
  r: at(1, 0.4, 0.8, 0.12, [0.4, -1, -0.2]), l: at(-1, -0.4, 0.8, 0.12, [0.4, -1, -0.2]), handR: 1, handL: 1,
};
const breastPull: PoseSpec = {
  x: -0.02, hips: -0.03, y: -0.04,
  r: at(1, 0.09, 0.68, 0.17, [1, -0.5, -0.2]), l: at(-1, -0.09, 0.68, 0.17, [1, -0.5, -0.2]), handR: 1, handL: 1,
};
const NOSE: ArmAngles = at(-1, -0.02, 0.93, 0.16, [1, -0.8, 0]);
const sink = (y: number, s: number, wave: number): PoseSpec => ({
  y, hips: 0.05 * s, tilt: 6 * s, lean: -2 * s, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.12, kneeL: 0.12, nod: 4,
  r: [150 + wave * 12, 10, 160 - wave * 30, 10], l: NOSE, handR: 1, handL: 0.3,
});

// Hip swing with a point at the crowd.
const swingPointR: PoseSpec = {
  hips: 0.08, tilt: 9, y: -0.04, x: 0.012, lf: [-0.085, 0.024, 0.04], kneeL: -0.16, lean: 2, head: -3, nod: 3,
  r: [100, 38, 102, 38], l: ARM.hip, handR: 0, handL: 0,
};

// Roller swizzle: feet slide apart with the knees out, then together with the knees in.
const swizOut: PoseSpec = { y: -0.1, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.35, kneeL: 0.35, r: [62, 10, 66, 10], l: [62, 10, 66, 10], handR: 1, handL: 1 };
const swizIn: PoseSpec = { y: -0.04, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], kneeR: -0.3, kneeL: -0.3, r: [48, 20, 54, 20], l: [48, 20, 54, 20], handR: 1, handL: 1 };

export const moves: MoveDef[] = [
  // --- The bump and hip work -------------------------------------------------
  full({
    id: 'hip-bump', name: 'The Bump', tags: 'disco pop | hips | hips', beats: 2, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'Knees soft, throw one hip out to the side with that fist up by the shoulder, then bump the other side.',
    keys: [[0, bumpR], [0.5, bumpMid], [1, mir(bumpR)], [1.5, mir(bumpMid)]],
  }),
  combo('bump-clap', 'Hip Bump Clap', 'hipBump', 'clap', 'low', 2, 'disco pop | hips | hips clap'),
  full({
    id: 'bump-point', name: 'Bump & Point', tags: 'disco | hips arms | hips point', beats: 2, level: 'mid', d: 2, parts: ['hips', 'arms'],
    desc: 'Bump a hip out and point straight down at it with that arm, looking at the point; then the other side.',
    keys: [[0, bumpPointR], [0.5, { ...bumpMid, r: FIST_IN, l: FIST_IN_L }], [1, mir(bumpPointR)], [1.5, mir({ ...bumpMid, r: FIST_IN, l: FIST_IN_L })]],
  }),
  combo('shoulder-shimmy', 'Shoulder Shimmy', 'groove', 'shoulderShimmy', 'mid', 2, 'disco latin funk | full | shake'),
  full({
    id: 'shimmy', name: 'Shimmy', tags: 'disco funk latin | full | shake', beats: 2, level: 'mid', d: 2, parts: ['torso'],
    desc: 'Low wide stance, shake the shoulders forward and back fast with the hands open low.',
    keys: [[0, shimmyKey(1, 62)], [0.5, shimmyKey(-1, 62)], [1, shimmyKey(1, 58)], [1.5, shimmyKey(-1, 58)]],
  }),
  combo('chest-slide', 'Chest Slide', 'groove', 'snaps', 'mid', 2, 'funk kpop disco | full |', { accent: 'chestIso' }),

  full({
    id: 'hip-swing-point', name: 'Hip Swing Point', tags: 'disco pop | hips arms | hips point', beats: 2, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'Swing the hips side to side and point out at the crowd on the diagonal with the hand on the same side, other fist on the hip.',
    keys: [[0, swingPointR], [1, mir(swingPointR)]],
  }),
  combo('shimmy-walk', 'Shimmy Walk', 'stepTouch', 'shoulderShimmy', 'mid', 2, 'disco latin | full | shake walk', { desc: 'Step-touch side to side while the shoulders shimmy fast.' }),

  // --- Points ----------------------------------------------------------------
  combo('disco-point', 'Disco Point', 'sway', 'discoPoint', 'mid', 2, 'disco | arms | point'),
  full({
    id: 'double-disco-point', name: 'Double Disco Point', tags: 'disco | arms | point', beats: 4, level: 'mid', d: 2, parts: ['arms'], mirror: true,
    desc: 'Point up on the diagonal twice (pull the fist back to the chest between), then point down across the body twice.',
    keys: [
      [0, { x: 0.02, hips: 0.03, y: -0.02, head: 7, turn: 12, nod: -8, r: POINT_UP, l: ARM.hip, handR: 0, handL: 0 }],
      [0.5, { x: 0.02, hips: 0.03, y: -0.04, r: FIST_IN, l: ARM.hip, handR: 0, handL: 0 }],
      [1, { x: 0.02, hips: 0.03, y: -0.02, head: 7, turn: 12, nod: -8, r: POINT_UP, l: ARM.hip, handR: 0, handL: 0 }],
      [1.5, { x: 0.02, hips: 0.03, y: -0.04, r: FIST_IN, l: ARM.hip, handR: 0, handL: 0 }],
      [2, { x: -0.02, hips: -0.03, y: -0.05, head: -5, turn: -12, nod: 10, r: [48, 125, 44, 150], l: ARM.hip, handR: 0, handL: 0 }],
      [2.5, { x: -0.02, hips: -0.03, y: -0.03, r: FIST_IN, l: ARM.hip, handR: 0, handL: 0 }],
      [3, { x: -0.02, hips: -0.03, y: -0.05, head: -5, turn: -12, nod: 10, r: [48, 125, 44, 150], l: ARM.hip, handR: 0, handL: 0 }],
      [3.5, { x: 0, y: -0.03, r: FIST_IN, l: ARM.hip, handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'fever-pose', name: 'Fever Pose', tags: 'disco | arms full | point', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Hit the Saturday-night diagonal: one arm pointing high, the other low on the opposite side, foot pointed out; hold, then switch.',
    keys: [[0, feverR], [1, { ...feverR, y: -0.06 }], [2, mir(feverR)], [3, mir({ ...feverR, y: -0.06 })]],
  }),
  combo('hitchhike', 'Hitchhike', 'tapSide', 'hitchhike', 'mid', 2, 'disco funk | arms | point'),
  combo('disco-vine', 'Disco Vine', 'vine', 'discoPoint', 'mid', 3, 'disco | full | point walk'),

  // --- Rolling hands -----------------------------------------------------------
  combo('rolling-hands', 'Rolling Hands', 'bounce', 'rollingHands', 'low', 1, 'disco | arms | hands'),
  combo('rolling-step', 'Rolling Step Touch', 'stepTouch', 'rollingHands', 'low', 2, 'disco | arms legs | hands walk'),
  combo('hustle-tap', 'Hustle Tap', 'backTap', 'rollingHands', 'mid', 2, 'disco | legs arms | hands'),
  combo('roll-high', 'High Roll', 'sway', 'rollHigh', 'mid', 1, 'disco | arms | hands', { desc: 'Roll the forearms around each other above the head while swaying.' }),
  combo('roll-low', 'Low Roll', 'groove', 'rollLow', 'low', 1, 'disco | arms | hands', { desc: 'Sink into a wide bouncy stance and roll the forearms low, in front of the hips.' }),
  combo('vine-roll', 'Vine & Roll', 'vine', 'rollingHands', 'mid', 3, 'disco aerobic | full | hands walk', { desc: 'Grapevine to the side while rolling the forearms in front of the chest.' }),
  full({
    id: 'roll-the-dice', name: 'Roll the Dice', tags: 'disco party | arms | hands', beats: 4, level: 'mid', d: 2, parts: ['arms', 'hips'], mirror: true,
    desc: 'Shake cupped hands by your ear for four counts, then throw the dice forward and down to the other side.',
    keys: [[0, diceR(1)], [0.5, diceR(-1)], [1, diceR(1)], [1.5, diceR(-1)], [2, diceThrow], [3, { ...diceThrow, y: -0.03, r: [30, 20, 60, 40], l: [30, 20, 60, 40], handR: 1, handL: 1 }]],
  }),
  full({
    id: 'roll-up', name: 'Roll It Up', tags: 'disco | arms full | hands', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Roll the forearms from the hips up past the face, bending low and rising with them, and fling the hands open overhead.',
    keys: [
      ...[0, 1, 2, 3, 4, 5].map((k) => [k / 2, { ...roll(k, 0.5 + k * 0.085, 0.22, 0.05, [1, -0.6, 0]), y: -0.13 + k * 0.022, rf: [0.12, 0, 0], lf: [-0.12, 0, 0] }] as const),
      [3, { y: -0.01, nod: -8, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: ARM.v, l: ARM.v, handR: 1, handL: 1 }],
      [3.5, { y: -0.08, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [58, 0, 64, 4], l: [58, 0, 64, 4], handR: 1, handL: 1 }],
    ],
  }),

  // --- Hustle and line-dance steps -----------------------------------------------
  full({
    id: 'hustle-basic', name: 'Hustle Basic', tags: 'disco | legs | walk', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true, travel: 0.12,
    desc: 'Rock back on the and, replace, then step side and close, leading hand held out low.',
    keys: [
      [0, { x: 0, y: -0.04, twist: -10, bend: 3, rf: [0.1, 0, -0.13], lf: [-W, 0, 0], ...hustleArms }],
      [0.5, { x: 0, y: -0.02, twist: 0, rf: [0.1, 0, 0], lf: [-W, 0, 0], ...hustleArms }],
      [1, { x: 0.06, y: -0.04, hips: 0.02, rf: [0.23, 0, 0], lf: [-W, 0, 0], ...hustleArms }],
      [1.5, { x: 0.12, y: -0.02, rf: [0.23, 0, 0], lf: [0.03, 0, 0], ...hustleArms }],
    ],
  }),
  full({
    id: 'hitch-turn', name: 'Hitch Turn', tags: 'disco aerobic | turn legs | spin clap', beats: 4, level: 'mid', d: 3, parts: ['turn', 'legs'], mirror: true,
    desc: 'Turn a quarter on every beat, hitching the knee and clapping on the and, all the way round.',
    keys: [
      [0, landKey(0)], [0.5, hitchKey(45)], [1, landKey(90)], [1.5, hitchKey(135)],
      [2, landKey(180)], [2.5, hitchKey(225)], [3, landKey(270)], [3.5, hitchKey(315)],
    ],
  }),
  full({
    id: 'chasse-sweep', name: 'Chassé Sweep', tags: 'disco pop | full | walk wave', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.22,
    desc: 'Chassé to the side (step, close, step) as both arms scoop low across the body and sweep open high toward the travel.',
    keys: [
      [0, { x: 0.07, rf: [0.2, 0, 0], lf: [-W, 0, 0], hips: 0.015, y: -0.05, lean: -4, r: chasseLow, l: chasseLowL, handR: 1, handL: 1 }],
      [0.5, { x: 0.13, y: -0.03, rf: [0.2, 0, 0], lf: [0.1, 0, 0], r: [90, 40, 95, 40], l: [70, 60, 80, 70], handR: 1, handL: 1 }],
      [1, { x: 0.2, rf: [0.31, 0, 0], lf: [0.1, 0, 0], hips: 0.015, lean: 8, head: 6, nod: -6, r: [150, 5, 152, 5], l: [122, 20, 128, 20], handR: 1, handL: 1 }],
      [1.5, { x: 0.22, y: -0.03, rf: [0.31, 0, 0], lf: [0.13, 0, 0], lean: 3, r: [70, 20, 80, 25], l: [60, 35, 70, 40], handR: 1, handL: 1 }],
    ],
  }),

  // --- 60s floor dances ----------------------------------------------------------
  full({
    id: 'the-monkey', name: 'The Monkey', tags: 'disco rock | arms full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Knees bouncing in a wide stance, pump the fists alternately up past the face and down to the chest, head bobbing forward on each pump.',
    keys: [[0, monkeyA], [0.5, monkeyMid], [1, mir(monkeyA)], [1.5, monkeyMid]],
  }),
  full({
    id: 'the-jerk', name: 'The Jerk', tags: 'disco rock funk | arms full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'],
    desc: 'Flick both open hands up beside the head as the chest jerks back, then drop them to the waist as the knees sink; the hip pops to alternate sides.',
    keys: [[0, jerkUp(1)], [0.5, jerkDown], [1, jerkUp(-1)], [1.5, jerkDown]],
  }),
  full({
    id: 'the-pony', name: 'The Pony', tags: 'disco rock | legs | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], jump: true, impact: true,
    desc: 'Light hop-step-step from foot to foot, the free foot flicking up behind, fists bobbing in front like holding reins.',
    keys: [[0, ponyLand], [0.5, ponyAir], [1, mir(ponyLand)], [1.5, mir(ponyAir)]],
  }),
  full({
    id: 'the-watusi', name: 'The Watusi', tags: 'disco rock | arms full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'],
    desc: 'In a low bouncy stance, swing both flat hands out to one side at shoulder height (one arm straight, one across), through the front, then to the other side.',
    keys: [[0, watusiA], [0.5, watusiMid], [1, mir(watusiA)], [1.5, watusiMid]],
  }),
  full({
    id: 'mashed-potato', name: 'Mashed Potato', tags: 'disco rock funk | legs | twist', beats: 2, level: 'mid', d: 2, parts: ['legs'],
    desc: 'Flick one foot out low to the side while the standing heel swivels out, bring it back with the knees twisting in, then the other foot.',
    keys: [[0, mashKick], [0.5, mashIn], [1, mir(mashKick)], [1.5, mir(mashIn)]],
  }),
  full({
    id: 'breaststroke', name: 'Breaststroke', tags: 'disco pop party | arms | wave', beats: 2, level: 'low', d: 1, parts: ['arms'],
    desc: 'The swim with breaststroke arms: reach both hands forward together, sweep them wide apart, pull them back to the chest, hips swaying.',
    keys: [[0, breastIn], [1, breastOut], [1.5, breastPull]],
  }),
  full({
    id: 'swim-dive', name: 'Swim Dive', tags: 'disco party | full | wave', beats: 4, level: 'mid', d: 2, parts: ['legs', 'hips', 'arms'],
    desc: 'Hold your nose with one hand and wave the other overhead while wiggling the hips down into a low squat, then wiggle back up.',
    keys: [
      [0, sink(-0.03, 1, 1)], [0.5, sink(-0.07, -1, -1)], [1, sink(-0.12, 1, 1)], [1.5, sink(-0.17, -1, -1)],
      [2, sink(-0.21, 1, 1)], [2.5, sink(-0.17, -1, -1)], [3, sink(-0.12, 1, 1)], [3.5, sink(-0.07, -1, -1)],
    ],
  }),
  full({
    id: 'the-freddie', name: 'The Freddie', tags: 'disco rock aerobic | full | jump kick', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'arms'], jump: true, impact: true,
    desc: 'Hop on one foot as the other leg and the same-side arm fling out on the diagonal, land, then fling the other side.',
    keys: [[0, freddieA], [0.5, freddieLand], [1, mir(freddieA)], [1.5, freddieLand]],
  }),

  // --- Claps and shimmies -----------------------------------------------------------
  full({
    id: 'diagonal-clap', name: 'Diagonal Clap', tags: 'disco pop | arms full | clap', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Clap high above one shoulder standing tall, then sink and clap low by the opposite hip.',
    keys: [[0, clapHighR], [1, clapLowL]],
  }),
  full({
    id: 'shimmy-down', name: 'Shimmy Down', tags: 'disco latin | full | shake', beats: 4, level: 'mid', d: 2, parts: ['torso', 'legs'],
    desc: 'Shimmy the shoulders while sinking down into a low wide squat over two counts, then shimmy back up.',
    keys: [
      [0, { ...shimmyKey(1, 72), y: -0.02 }], [0.5, { ...shimmyKey(-1, 70), y: -0.06 }],
      [1, { ...shimmyKey(1, 66), y: -0.11 }], [1.5, { ...shimmyKey(-1, 62), y: -0.16 }],
      [2, { ...shimmyKey(1, 58), y: -0.2 }], [2.5, { ...shimmyKey(-1, 62), y: -0.15 }],
      [3, { ...shimmyKey(1, 66), y: -0.1 }], [3.5, { ...shimmyKey(-1, 70), y: -0.05 }],
    ],
  }),

  // --- Voguing --------------------------------------------------------------------
  full({
    id: 'box-frame', name: 'Box Frame', tags: 'disco kpop | arms | hands', beats: 2, level: 'low', d: 2, parts: ['arms'],
    desc: 'Frame the face with flat hands: one forearm across the top of the head and one hand up beside the face, then frame under the chin, then switch.',
    keys: [[0, frameA], [0.5, frameChin], [1, mir(frameA)], [1.5, frameChin]],
  }),
  full({
    id: 'vogue-arms', name: 'Vogue Arms', tags: 'disco kpop | arms | hands', beats: 4, level: 'mid', d: 3, parts: ['arms'], mirror: true,
    desc: 'Hit a sharp new arm line on every beat: one arm up with the other across the chest, arm out with a hand at the temple, goal posts, hands meeting in a diamond overhead.',
    keys: [
      [0, { y: -0.03, hips: 0.03, turn: 10, r: [172, 0, 176, 0], l: at(-1, 0.1, 0.72, 0.19, [1, 0, 0]), handR: 1, handL: 1 }],
      [1, { y: -0.03, hips: -0.03, turn: -14, r: [90, 0, 90, 0], l: at(-1, -0.14, 0.98, 0.1, [1, 0.3, -0.2]), handR: 1, handL: 1 }],
      [2, { y: -0.05, r: ARM.goal, l: ARM.goal, handR: 1, handL: 1, nod: 4 }],
      [3, { y: -0.01, nod: -6, r: at(1, 0.03, 1.13, 0.08, [1, 0.3, 0]), l: at(-1, -0.03, 1.13, 0.08, [1, 0.3, 0]), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'catwalk', name: 'Catwalk', tags: 'disco kpop pop | legs hips | walk hips', beats: 2, level: 'low', d: 2, parts: ['legs', 'hips'],
    desc: 'Walk on the spot crossing each foot in front of the other, the hip popping over the front foot and the arms swinging long.',
    keys: [[0, catwalkA], [1, mir(catwalkA)]],
  }),
  full({
    id: 'vogue-pose', name: 'Vogue Pose', tags: 'disco kpop | full | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'Strike a pose and hold it: hip out, hand under the chin, other fist on the hip; then a new pose with a hand behind the head and the hip to the other side.',
    keys: [[0, voguePoseA], [1, { ...voguePoseA, y: -0.05 }], [2, voguePoseB], [3, { ...voguePoseB, y: -0.06 }]],
  }),

  // --- Roller disco ---------------------------------------------------------------
  full({
    id: 'roller-glide', name: 'Roller Glide', tags: 'disco | legs full | walk', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Push off into a long low glide to one side, back foot trailing and arms swinging like skating, ride it, then glide the other way.',
    keys: [[0, glideR], [1, glideRide], [1.5, glideMid], [2, mir(glideR)], [3, mir(glideRide)], [3.5, glideMid]],
  }),
  full({
    id: 'roller-crossover', name: 'Roller Crossover', tags: 'disco | legs | walk', beats: 2, level: 'mid', d: 3, parts: ['legs'], mirror: true, travel: 0.24,
    desc: 'Travel sideways crossing the trailing foot over in front, arms held out for balance, leaning into the curve.',
    keys: [
      [0, { x: 0.05, y: -0.05, lean: 4, rf: [0.18, 0, 0], lf: [-W, 0, 0], ...crossArms }],
      [0.5, { x: 0.11, y: -0.07, lean: 6, twist: 6, rf: [0.18, 0, 0], lf: [0.27, 0, 0.07], kneeL: -0.1, ...crossArms }],
      [1, { x: 0.19, y: -0.05, lean: 4, rf: [0.37, 0, 0], lf: [0.27, 0, 0.07], ...crossArms }],
      [1.5, { x: 0.24, y: -0.04, lean: 2, rf: [0.33, 0, 0], lf: [0.15, 0, 0], ...crossArms }],
    ],
  }),
  full({
    id: 'roller-swizzle', name: 'Roller Swizzle', tags: 'disco | legs |', beats: 2, level: 'mid', d: 2, parts: ['legs'],
    desc: 'Like skating lemons: slide the feet apart with the knees opening and sinking, then draw them together with the knees turning in, arms out for balance.',
    keys: [[0, swizOut], [1, swizIn]],
  }),

  // --- Dips and turns -------------------------------------------------------------
  full({
    id: 'disco-dip', name: 'Disco Dip', tags: 'disco | full | wave', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Step wide and sink low, sweeping one hand down toward the floor, then rise and sweep it high overhead with a lean back.',
    keys: [[0, { y: -0.05, rf: [0.15, 0, 0], lf: [-0.13, 0, 0], r: [50, 40, 60, 40], l: [50, 0, 56, 0], handR: 1, handL: 1 }], [1, dipDown], [2, dipUp], [3, { ...dipUp, y: -0.05, lean: -3, r: [120, 20, 126, 20] }]],
  }),
  full({
    id: 'hustle-turn', name: 'Hustle Turn', tags: 'disco pop | turn | spin', beats: 4, level: 'mid', d: 3, parts: ['turn', 'legs'], mirror: true,
    desc: 'Rock back on the and with the lead hand out, replace, then spin a full turn under your own raised arm.',
    keys: [
      [0, { y: -0.04, twist: -10, rf: [0.1, 0, -0.13], lf: [-W, 0, 0], ...hustleArms }],
      [0.5, { y: -0.02, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], ...hustleArms }],
      ...spinKeys(1).map(([t, k]) => [t, { ...k, r: [166, 10, 170, 10], l: at(-1, -0.05, 0.72, 0.17, [1, -0.6, -0.2]), handR: 1, handL: 1 }] as const),
      [3, { y: -0.03, spin: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [120, 10, 124, 10], l: [50, 0, 54, 0], handR: 1, handL: 1 }],
    ],
  }),
  combo('disco-spin', 'Disco Spin', 'spin', 'turnUp', 'mid', 3, 'disco pop | turn | spin point'),
];
