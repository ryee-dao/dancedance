/**
 * Pop / jazz / musical theatre / cheer / swing-era: the twist, box step,
 * chassé, jazz square, pas de bourrée, paddle and three-step turns, cheer
 * motions, Charleston, hand jive, hand choreography, waves and turns.
 *
 * Pattern ids added by this file are prefixed `pop` (ids are global).
 */

import { ARM, CHEST_BOX, OPEN_LOW, W, at, mir, type ArmAngles, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';

const twistA: PoseSpec = { y: -0.08, x: 0.015, hipTwist: -32, twist: 40, lean: 4, turn: -22, rf: [0.12, 0, 0.0], lf: [-0.12, 0.03, 0.03] };
const rippleA: PoseSpec = { lean: 3, head: -3, r: [100, 0, 64, 0], l: [80, 0, 116, 0], handR: 1, handL: 1 };
const pendA: PoseSpec = { r: [52, 8, 58, 14], l: [38, 138, 46, 128], handR: 1, handL: 1 };
const oceanA: PoseSpec = { lean: 11, head: 6, r: [128, 0, 134, 0], l: [186, 0, 214, 0], handR: 1, handL: 1 };
const oceanMid: PoseSpec = { r: [160, 0, 167, 0], l: [160, 0, 167, 0], handR: 1, handL: 1 };
const swimA: PoseSpec = { twist: -8, r: [162, 55, 166, 55], l: [28, -40, 32, -40], handR: 1, handL: 1 };
const jazzA: PoseSpec = { r: [58, 22, 70, 30], l: [58, 22, 70, 30], handR: 1, handL: 1 };
const jazzB: PoseSpec = { r: [52, 22, 62, 30], l: [52, 22, 62, 30], handR: 0.85, handL: 0.85 };

// --- Cheer motions (fists, sharp) -----------------------------------------
const C_HIGH_V: ArmAngles = [146, 0, 148, 0];
const C_LOW_V: ArmAngles = [36, 0, 38, 0];
const C_T: ArmAngles = [90, 0, 90, 0];
const C_UP: ArmAngles = [177, 0, 178, 0];
/** Hands clasped under the chin (the cheer "clasp" between motions). */
const clasp: PoseSpec = { r: at(1, 0.018, 0.76, 0.19, [1, -0.8, 0.3]), l: at(-1, -0.018, 0.76, 0.19, [1, -0.8, 0.3]), handR: 0, handL: 0 };
const brokenT: PoseSpec = { r: at(1, 0.07, 0.8, 0.1, [1, 0.15, -0.2]), l: at(-1, -0.07, 0.8, 0.1, [1, 0.15, -0.2]), handR: 0, handL: 0 };
const daggers: PoseSpec = { r: at(1, 0.15, 0.84, 0.09, [0.25, -1, 0.1]), l: at(-1, -0.15, 0.84, 0.09, [0.25, -1, 0.1]), handR: 0, handL: 0 };
/** K: right arm high diagonal, left arm reaching across low to the right. */
const kMotion: PoseSpec = { lean: -4, head: 4, r: C_HIGH_V, l: at(-1, 0.18, 0.52, 0.24, [0.2, -0.5, 1]), handR: 0, handL: 0 };
/** L: right arm straight up, left arm straight out. */
const lMotion: PoseSpec = { lean: -3, r: C_UP, l: C_T, handR: 0, handL: 0 };
/** Bow and arrow: right arm out, left fist pulled across to the right shoulder. */
const bowArrow: PoseSpec = { turn: 24, lean: -3, r: C_T, l: at(-1, 0.07, 0.8, 0.15, [1, 0.25, -0.1]), handR: 0, handL: 0 };

// --- Jazz / theatre arms ---------------------------------------------------
/** Presentational jazz arm: right arm up-and-out, left low, both open. */
const presentA: PoseSpec = { head: -4, turn: 10, r: [128, 12, 132, 12], l: [34, 18, 40, 24], handR: 1, handL: 1 };
const presentLow: PoseSpec = { r: at(1, -0.05, 0.56, 0.16, [0.6, -1, -0.2]), l: at(-1, 0.05, 0.55, 0.18, [0.6, -1, -0.2]), handR: 1, handL: 1 };
/** Charleston arms: both arms swing together to one side, hands flat. */
const charlArms = (s: 1 | -1): PoseSpec => ({
  r: s > 0 ? [62, 30, 70, 40] : at(1, -0.06, 0.55, 0.2, [0.4, -1, 0]),
  l: s > 0 ? at(-1, 0.06, 0.55, 0.2, [0.4, -1, 0]) : [62, 30, 70, 40],
  handR: 1, handL: 1,
});

export const patterns: PatternSet = {
  foot: {
    twist: { beats: 2, parts: ['hips', 'torso'], torso: true, keys: [[0, twistA], [1, mir(twistA)]] },
    boxStep: {
      beats: 4, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: -0.02, hipTwist: -8, rf: [-0.03, 0, 0.1], lf: [-W, 0, 0] }],
        [1, { x: -0.05, y: -0.02, rf: [-0.03, 0, 0.1], lf: [-0.13, 0, -0.1] }],
        [2, { x: 0.0, rf: [0.11, 0, -0.09], lf: [-0.13, 0, -0.1] }],
        [3, { x: 0.0, y: -0.03, rf: [0.11, 0, -0.09], lf: [-W, 0, 0.03] }],
      ],
    },
    chasse: {
      beats: 2, parts: ['legs'], mirror: true, travel: 0.22,
      keys: [
        [0, { x: 0.07, rf: [0.2, 0, 0], lf: [-W, 0, 0], hips: 0.015 }],
        [0.5, { x: 0.13, y: -0.02, rf: [0.2, 0, 0], lf: [0.1, 0, 0] }],
        [1, { x: 0.2, rf: [0.31, 0, 0], lf: [0.1, 0, 0], hips: 0.015 }],
        [1.5, { x: 0.22, y: -0.03, rf: [0.31, 0, 0], lf: [0.13, 0, 0] }],
      ],
    },
    jazzSquare: {
      beats: 4, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { x: -0.02, rf: [-0.035, 0, 0.11], lf: [-0.11, 0, 0], twist: -8, hipTwist: -10 }],
        [1, { x: -0.03, rf: [-0.035, 0, 0.11], lf: [-0.12, 0, -0.11], twist: -4 }],
        [2, { x: 0.0, rf: [0.12, 0, -0.08], lf: [-0.12, 0, -0.11], twist: 4 }],
        [3, { x: 0.0, y: -0.03, rf: [0.12, 0, -0.08], lf: [-0.09, 0, 0.04], twist: 0 }],
      ],
    },
    triple: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { rf: [0.02, 0.0, -0.08], y: -0.03, hips: 0.01 }],
        [0.5, { rf: [0.02, 0.0, -0.08], lf: [-0.18, 0, 0], y: -0.02 }],
        [1, { rf: [0.09, 0, 0.03], lf: [-0.18, 0, 0], y: -0.035 }],
        [1.5, { rf: [0.09, 0, 0.03], lf: [-0.12, 0, 0], y: -0.015 }],
      ],
    },
    // Pas de bourrée (1-&-2): right steps behind, left steps out, right steps out into a plié.
    popPasDeBourree: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: -0.03, y: -0.025, rf: [-0.035, 0, -0.09], lf: [-0.1, 0, 0.01], hipTwist: 8 }],
        [0.5, { x: -0.06, y: -0.01, rf: [-0.035, 0.0, -0.09], lf: [-0.19, 0, 0] }],
        [1, { x: -0.02, y: -0.075, rf: [0.13, 0, 0.02], lf: [-0.19, 0, 0], kneeR: 0.12, kneeL: 0.12 }],
        [1.5, { x: -0.02, y: -0.06, rf: [0.13, 0, 0.02], lf: [-0.19, 0, 0], kneeR: 0.1, kneeL: 0.1 }],
      ],
    },
    // Paddle turn: the right foot pushes the floor like a paddle, a quarter turn per beat.
    popPaddle: {
      beats: 4, parts: ['turn', 'legs'], mirror: true,
      keys: [
        [0, { y: -0.05, spin: 0, rf: [0.16, 0, 0.03], lf: [-0.04, 0, 0], kneeR: 0.15 }],
        [0.5, { y: -0.02, spin: 45, rf: [0.06, 0, 0.0], lf: [-0.04, 0, 0] }],
        [1, { y: -0.05, spin: 90, rf: [0.16, 0, 0.03], lf: [-0.04, 0, 0], kneeR: 0.15 }],
        [1.5, { y: -0.02, spin: 135, rf: [0.06, 0, 0.0], lf: [-0.04, 0, 0] }],
        [2, { y: -0.05, spin: 180, rf: [0.16, 0, 0.03], lf: [-0.04, 0, 0], kneeR: 0.15 }],
        [2.5, { y: -0.02, spin: 225, rf: [0.06, 0, 0.0], lf: [-0.04, 0, 0] }],
        [3, { y: -0.05, spin: 270, rf: [0.16, 0, 0.03], lf: [-0.04, 0, 0], kneeR: 0.15 }],
        [3.5, { y: -0.02, spin: 315, rf: [0.06, 0, 0.0], lf: [-0.04, 0, 0] }],
      ],
    },
    // Three-step turn travelling right (R, L, R = one full turn), then touch and hold.
    popThreeStep: {
      beats: 4, parts: ['turn', 'legs'], mirror: true, travel: 0.3,
      keys: [
        [0, { x: 0.06, y: -0.04, spin: 0, rf: [0.17, 0, 0], lf: [-0.03, 0, 0] }],
        [0.5, { x: 0.12, y: -0.02, spin: 100, rf: [0.175, 0, 0], lf: [0.065, 0.03, 0] }],
        [1, { x: 0.19, y: -0.03, spin: 200, rf: [0.245, 0, 0], lf: [0.135, 0, 0] }],
        [1.5, { x: 0.25, y: -0.02, spin: 290, rf: [0.31, 0, 0], lf: [0.2, 0.02, 0] }],
        [2, { x: 0.3, y: -0.05, spin: 0, rf: [0.39, 0, 0], lf: [0.21, 0, 0] }],
        [3, { x: 0.3, y: -0.02, spin: 0, rf: [0.39, 0, 0], lf: [0.3, 0.02, 0.01] }],
      ],
    },
    // Feet apart / together, sharp (the cheer hit step).
    popHitStep: {
      beats: 2, parts: ['legs'],
      keys: [
        [0, { y: -0.05, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
        [1, { y: -0.01, rf: [0.055, 0, 0], lf: [-0.055, 0, 0] }],
      ],
    },
    // Charleston basic: right toe taps forward, back to centre, left toe taps back, back, heels swivelling.
    popCharleston: {
      beats: 4, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.05, hipTwist: -10, rf: [0.07, 0.02, 0.17], lf: [-0.09, 0, 0], kneeR: -0.3, kneeL: -0.3 }],
        [1, { y: -0.02, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.25, kneeL: 0.25 }],
        [2, { y: -0.05, hipTwist: 10, rf: [0.09, 0, 0], lf: [-0.07, 0.02, -0.16], kneeR: -0.3, kneeL: -0.3 }],
        [3, { y: -0.02, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.25, kneeL: 0.25 }],
      ],
    },
    // Charleston kick: kick the right leg forward low, step, kick the left leg back, step.
    popCharlestonKick: {
      beats: 4, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.01, x: -0.02, rf: [0.23, 0.2, 0.32], lf: [-0.09, 0, 0], kneeL: -0.25 }],
        [1, { y: -0.05, rf: [0.09, 0, 0.04], lf: [-0.09, 0, 0], kneeR: 0.25, kneeL: 0.25 }],
        [2, { y: -0.02, x: 0.02, rf: [0.09, 0, 0.04], lf: [-0.11, 0.16, -0.2], kneeR: -0.25 }],
        [3, { y: -0.05, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.25, kneeL: 0.25 }],
      ],
    },
    // Jazz walk on the spot: each foot crosses in front of the other, hip pushed out to the standing side.
    popJazzWalk: {
      beats: 2, parts: ['legs', 'hips'],
      keys: [
        [0, { y: -0.04, hips: -0.065, tilt: -9, rf: [-0.06, 0, 0.1], lf: [-0.1, 0, 0], kneeR: -0.2 }],
        [1, { y: -0.04, hips: 0.065, tilt: 9, rf: [0.1, 0, 0], lf: [0.06, 0, 0.1], kneeL: -0.2 }],
      ],
    },
    // The twist travelling down to a low squat and back up (level change).
    popTwistDown: {
      beats: 4, parts: ['hips', 'torso', 'legs'], torso: true,
      keys: [
        [0, { ...twistA, y: -0.05 }],
        [1, { ...mir(twistA), y: -0.12 }],
        [2, { ...twistA, y: -0.2, bend: 8 }],
        [3, { ...mir(twistA), y: -0.12 }],
      ],
    },
    // Shorty George (mild): knees bent and pressed together, swinging side to side.
    popShorty: {
      beats: 2, parts: ['legs', 'hips'], torso: true,
      keys: [
        [0, { x: 0.035, y: -0.13, hips: 0.025, bend: 10, lean: -4, rf: [0.08, 0, 0], lf: [-0.08, 0.03, 0.02], kneeR: -0.45, kneeL: -0.45 }],
        [1, { x: -0.035, y: -0.13, hips: -0.025, bend: 10, lean: 4, rf: [0.08, 0.03, 0.02], lf: [-0.08, 0, 0], kneeR: -0.45, kneeL: -0.45 }],
      ],
    },
    // Kickline: low kick right, step, low kick left, step (hip height at most).
    popKickline: {
      beats: 2, parts: ['legs'],
      keys: [
        [0, { y: 0.0, x: -0.03, rf: [0.29, 0.24, 0.3], lf: [-0.09, 0, 0] }],
        [0.5, { y: -0.05, rf: [W, 0, 0], lf: [-W, 0, 0] }],
        [1, { y: 0.0, x: 0.03, rf: [W, 0, 0], lf: [-0.29, 0.24, 0.3] }],
        [1.5, { y: -0.05, rf: [W, 0, 0], lf: [-W, 0, 0] }],
      ],
    },
    // Flick kick: knee up, flick the lower leg out on the "and", step down.
    popFlick: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.02, x: -0.015, rf: [0.09, 0.2, 0.12], kneeR: 0.2 }],
        [0.5, { y: -0.01, x: -0.02, rf: [0.2, 0.15, 0.27] }],
        [1, { y: -0.05, rf: [W, 0, 0.02] }],
      ],
    },
    // Passé turn: plié prep in fourth, rise into passé and turn once, land.
    popPasse: {
      beats: 4, parts: ['turn', 'legs'], mirror: true,
      keys: [
        [0, { y: -0.08, spin: 0, rf: [0.12, 0, -0.08], lf: [-0.08, 0, 0.04], kneeR: 0.15, kneeL: 0.15 }],
        [1, { y: -0.08, spin: 0, rf: [0.12, 0, -0.08], lf: [-0.08, 0, 0.04], kneeR: 0.15, kneeL: 0.15 }],
        [1.5, { y: 0.0, spin: 0, rf: [0.03, 0.24, 0.05], lf: [-0.03, 0, 0], kneeR: 0.6 }],
        [2, { y: 0.0, spin: 100, rf: [0.03, 0.24, 0.05], lf: [-0.03, 0, 0], kneeR: 0.6 }],
        [2.5, { y: 0.0, spin: 200, rf: [0.03, 0.24, 0.05], lf: [-0.03, 0, 0], kneeR: 0.6 }],
        [3, { y: -0.02, spin: 300, rf: [0.03, 0.2, 0.05], lf: [-0.03, 0, 0], kneeR: 0.5 }],
        [3.5, { y: -0.06, spin: 0, rf: [0.1, 0, 0], lf: [-0.08, 0, 0] }],
      ],
    },
    // Heel and hook (country-pop): heel dig forward, hook the foot across in front of the shin, step down.
    popHeelHook: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.045, x: -0.02, rf: [0.16, 0.03, 0.19] }],
        [1, { y: -0.02, x: -0.01, rf: [-0.03, 0.17, 0.08], kneeR: -0.2 }],
        [1.5, { y: -0.05, rf: [W, 0, 0] }],
      ],
    },
    // Kick and cross: low kick forward, cross the same foot over in front, step it back out.
    popKickCross: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.01, x: -0.02, rf: [0.16, 0.17, 0.26] }],
        [1, { y: -0.05, x: -0.03, hipTwist: -12, rf: [-0.08, 0, 0.07], lf: [-0.11, 0, 0], kneeL: 0.1 }],
        [1.5, { y: -0.03, rf: [W, 0, 0], lf: [-W, 0, 0] }],
      ],
    },
    // Plié low, then rise up onto the toes (for the jazz burst).
    popPlieRise: {
      beats: 2, parts: ['legs'],
      keys: [
        [0, { y: -0.13, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.25, kneeL: 0.25 }],
        [1, { y: 0.02, rf: [0.1, 0, 0], lf: [-0.1, 0, 0] }],
      ],
    },
    // Grapevine that ends in a knee hitch instead of a touch.
    popVineHitch: {
      beats: 4, parts: ['legs'], mirror: true, travel: 0.3,
      keys: [
        [0, { x: 0.07, hips: 0.02, rf: [0.22, 0, 0], lf: [-W, 0, 0] }],
        [1, { x: 0.18, y: -0.03, hipTwist: 6, rf: [0.22, 0, 0], lf: [0.28, 0, -0.08] }],
        [2, { x: 0.29, hips: 0.02, rf: [0.39, 0, 0], lf: [0.28, 0, -0.08] }],
        [3, { x: 0.3, y: -0.01, rf: [0.39, 0, 0], lf: [0.24, 0.22, 0.17] }],
      ],
    },
    // Cheer kick: one hip-height kick on 1, step down, clasp; alternate legs.
    popCheerKick: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: 0.0, x: -0.03, lean: 0, rf: [0.28, 0.26, 0.3] }],
        [1, { y: -0.05, rf: [W, 0, 0] }],
      ],
    },
    // Heel switches (country-pop): right heel out on 1, feet together on "and", left heel out on 2.
    popHeelSwitch: {
      beats: 1, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.04, x: -0.015, rf: [0.15, 0.025, 0.19], lf: [-0.07, 0, 0] }],
        [0.5, { y: -0.02, rf: [0.07, 0, 0], lf: [-0.07, 0, 0] }],
      ],
    },
  },
  arms: {
    twistArms: { beats: 1, parts: [], keys: [[0, { r: CHEST_BOX, l: CHEST_BOX, handR: 0, handL: 0 }]] },
    ripple: { beats: 2, parts: ['arms'], torso: true, keys: [[0, rippleA], [1, mir(rippleA)]] },
    pendulum: { beats: 2, parts: ['arms'], keys: [[0, pendA], [1, mir(pendA)]] },
    ocean: { beats: 4, parts: ['arms', 'torso'], torso: true, keys: [[0, oceanA], [1, oceanMid], [2, mir(oceanA)], [3, oceanMid]] },
    rainbow: {
      beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true,
      keys: [
        [0, { lean: -17, head: -8, r: [176, -20, 230, -15], l: ARM.hip, handR: 1, handL: 0 }],
        [1, { lean: 4, r: OPEN_LOW, l: ARM.hip, handR: 1, handL: 0 }],
      ],
    },
    swim: { beats: 2, parts: ['arms'], torso: true, keys: [[0, swimA], [1, mir(swimA)]] },
    jazzHands: { beats: 1, parts: ['arms'], keys: [[0, jazzA], [0.5, jazzB]] },
    // Double clap on 1-&, hands thrown open wide on 2.
    popDoubleClap: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
        [0.5, { r: [36, 30, 50, 60], l: [36, 30, 50, 60], handR: 1, handL: 1 }],
        [1, { r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
        [1.5, { r: [104, 4, 108, 6], l: [104, 4, 108, 6], handR: 1, handL: 1 }],
      ],
    },
    // --- Hand choreography ---
    // Heart shape at the chest, lifted up to one side, back to the chest, up to the other side.
    popHeart: {
      beats: 4, parts: ['arms'], torso: true,
      keys: [
        [0, { r: at(1, 0.03, 0.7, 0.23, [1, -0.3, 0]), l: at(-1, -0.03, 0.7, 0.23, [1, -0.3, 0]), handR: 0.5, handL: 0.5 }],
        [1, { head: 7, turn: 12, r: at(1, 0.19, 0.95, 0.2, [1, -0.3, 0]), l: at(-1, 0.13, 0.95, 0.22, [1, -0.3, 0]), handR: 0.5, handL: 0.5 }],
        [2, { r: at(1, 0.03, 0.7, 0.23, [1, -0.3, 0]), l: at(-1, -0.03, 0.7, 0.23, [1, -0.3, 0]), handR: 0.5, handL: 0.5 }],
        [3, { head: -7, turn: -12, r: at(1, -0.13, 0.95, 0.22, [1, -0.3, 0]), l: at(-1, -0.19, 0.95, 0.2, [1, -0.3, 0]), handR: 0.5, handL: 0.5 }],
      ],
    },
    // "Call me": hand to the ear like a phone, then point out to the side.
    popPhone: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: 9, turn: 8, r: at(1, 0.13, 0.94, 0.05, [1, 0.1, -0.2]), l: ARM.hip, handR: 0.5, handL: 0 }],
        [1, { head: -2, turn: 22, r: [84, 28, 88, 32], l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
      ],
    },
    // Raised hand waving goodbye from the elbow (switches hands every 2 beats).
    popWaveBye: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: -4, r: [100, 12, 140, 12], l: ARM.hip, handR: 1, handL: 0 }],
        [0.5, { head: -4, r: [100, 12, 200, 12], l: ARM.hip, handR: 1, handL: 0 }],
        [1, { head: -4, r: [100, 12, 140, 12], l: ARM.hip, handR: 1, handL: 0 }],
        [1.5, { head: -4, r: [100, 12, 200, 12], l: ARM.hip, handR: 1, handL: 0 }],
      ],
    },
    // Hands frame the face, then open wide at head height.
    popFrame: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: at(1, 0.118, 0.93, 0.1, [1, -0.6, 0.1]), l: at(-1, -0.118, 0.93, 0.1, [1, -0.6, 0.1]), handR: 1, handL: 1 }],
        [1, { r: [124, 6, 126, 6], l: [124, 6, 126, 6], handR: 1, handL: 1 }],
      ],
    },
    // Clap overhead, then slap both thighs.
    popSlapClap: {
      beats: 2, parts: ['arms', 'torso'], torso: true,
      keys: [
        [0, { nod: -6, r: ARM.clapHigh, l: ARM.clapHigh, handR: 1, handL: 1 }],
        [1, { bend: 8, nod: 6, r: at(1, 0.1, 0.5, 0.1, [0.6, -0.4, -0.5]), l: at(-1, -0.1, 0.5, 0.1, [0.6, -0.4, -0.5]), handR: 1, handL: 1 }],
      ],
    },
    // Hand jive: pat, clap, pat, clap, fist over fist (both ways), hitchhike right, left.
    popHandJive: {
      beats: 4, parts: ['arms'],
      keys: [
        [0, { r: at(1, 0.1, 0.52, 0.12, [0.6, -0.4, -0.5]), l: at(-1, -0.1, 0.52, 0.12, [0.6, -0.4, -0.5]), handR: 1, handL: 1 }],
        [0.5, { r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
        [1, { r: at(1, 0.1, 0.52, 0.12, [0.6, -0.4, -0.5]), l: at(-1, -0.1, 0.52, 0.12, [0.6, -0.4, -0.5]), handR: 1, handL: 1 }],
        [1.5, { r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
        [2, { r: at(1, 0.0, 0.69, 0.21, [0.8, -1, -0.2]), l: at(-1, 0.0, 0.6, 0.21, [0.8, -1, -0.2]), handR: 0, handL: 0 }],
        [2.5, { r: at(1, 0.0, 0.6, 0.21, [0.8, -1, -0.2]), l: at(-1, 0.0, 0.69, 0.21, [0.8, -1, -0.2]), handR: 0, handL: 0 }],
        [3, { r: at(1, 0.21, 0.9, 0.06, [0.4, -1, 0.4]), l: at(-1, -0.06, 0.62, 0.2, [0.8, -1, -0.2]), handR: 0, handL: 0 }],
        [3.5, { r: at(1, 0.06, 0.62, 0.2, [0.8, -1, -0.2]), l: at(-1, -0.21, 0.9, 0.06, [0.4, -1, 0.4]), handR: 0, handL: 0 }],
      ],
    },
    // Tip the hat at the brow, then sweep the hand out low to present.
    popHatTip: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { nod: 7, head: 5, r: at(1, 0.08, 0.99, 0.11, [1, 0.2, -0.1]), l: ARM.hip, handR: 0, handL: 0 }],
        [1, { nod: -3, head: -3, r: [68, 34, 72, 40], l: ARM.hip, handR: 1, handL: 0 }],
      ],
    },
    // Pom shake: fists vibrating in a high V.
    popPomShake: {
      beats: 1, parts: ['arms'],
      keys: [
        [0, { shR: 0.3, shL: 0.3, r: [152, 0, 154, 0], l: [152, 0, 154, 0], handR: 0, handL: 0 }],
        [0.5, { r: [134, 0, 136, 0], l: [134, 0, 136, 0], handR: 0, handL: 0 }],
      ],
    },
    // Truckin': index finger raised overhead, wagging; other hand on the hip.
    popTruckin: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: -5, r: at(1, 0.22, 1.1, 0.05, [1, -0.2, -0.1]), l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
        [0.5, { head: -2, r: at(1, 0.15, 1.13, 0.05, [1, -0.2, -0.1]), l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
        [1, { head: -5, r: at(1, 0.22, 1.1, 0.05, [1, -0.2, -0.1]), l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
      ],
    },
    // Shorty George arms: both arms straight, pointing down to the floor on the side the knees swing to.
    popShortyArms: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: at(1, 0.27, 0.48, 0.16, [0.6, -0.4, -0.5]), l: at(-1, 0.06, 0.46, 0.22, [0.6, -0.4, -0.5]), handR: 0.3, handL: 0.3 }],
        [1, { r: at(1, -0.06, 0.46, 0.22, [0.6, -0.4, -0.5]), l: at(-1, -0.27, 0.48, 0.16, [0.6, -0.4, -0.5]), handR: 0.3, handL: 0.3 }],
      ],
    },
    // Kickline arms: out to the sides at shoulder height (as if linked), steady.
    popLineArms: { beats: 1, parts: [], keys: [[0, { r: [86, 6, 88, 8], l: [86, 6, 88, 8], handR: 1, handL: 1 }]] },
    // Flick: hands pulled in at the chest, flicked open with the kick.
    popFlickArms: {
      beats: 2, parts: ['arms'], mirror: true,
      keys: [
        [0, { r: at(1, 0.06, 0.74, 0.17, [1, -0.3, -0.1]), l: at(-1, -0.06, 0.74, 0.17, [1, -0.3, -0.1]), handR: 0, handL: 0 }],
        [0.5, { r: [112, 8, 116, 10], l: [44, 10, 48, 12], handR: 1, handL: 1 }],
        [1, { r: [40, 15, 50, 25], l: [40, 15, 50, 25], handR: 1, handL: 1 }],
      ],
    },
    // Pirouette arms: open second for the prep, rounded first for the turn, open to land.
    popPirArms: {
      beats: 4, parts: ['arms'],
      keys: [
        [0, { r: [80, 12, 86, 18], l: [80, 12, 86, 18], handR: 1, handL: 1 }],
        [1, { r: [80, 12, 86, 18], l: [80, 12, 86, 18], handR: 1, handL: 1 }],
        [2, { r: at(1, 0.04, 0.62, 0.2, [1, -0.3, 0]), l: at(-1, -0.04, 0.62, 0.2, [1, -0.3, 0]), handR: 1, handL: 1 }],
        [3, { r: at(1, 0.04, 0.62, 0.2, [1, -0.3, 0]), l: at(-1, -0.04, 0.62, 0.2, [1, -0.3, 0]), handR: 1, handL: 1 }],
        [3.5, { r: [128, 10, 134, 14], l: [128, 10, 134, 14], handR: 1, handL: 1 }],
      ],
    },
    // Port de bras: bras bas, first, fifth (overhead), open second.
    popPortDeBras: {
      beats: 4, parts: ['arms'],
      keys: [
        [0, { r: at(1, 0.05, 0.5, 0.15, [1, -0.2, 0]), l: at(-1, -0.05, 0.5, 0.15, [1, -0.2, 0]), handR: 1, handL: 1 }],
        [1, { r: at(1, 0.06, 0.68, 0.23, [1, -0.2, 0]), l: at(-1, -0.06, 0.68, 0.23, [1, -0.2, 0]), handR: 1, handL: 1 }],
        [2, { nod: -6, r: at(1, 0.06, 1.12, 0.1, [1, 0, 0]), l: at(-1, -0.06, 1.12, 0.1, [1, 0, 0]), handR: 1, handL: 1 }],
        [3, { r: [84, 10, 90, 14], l: [84, 10, 90, 14], handR: 1, handL: 1 }],
      ],
    },
    // Spirit fingers rising: jazz hands shaking low, at the shoulders, high, then high again.
    popSpiritRise: {
      beats: 4, parts: ['arms'],
      keys: [
        [0, { r: [32, 12, 38, 16], l: [32, 12, 38, 16], handR: 1, handL: 1 }],
        [0.5, { r: [38, 12, 44, 16], l: [38, 12, 44, 16], handR: 0.7, handL: 0.7 }],
        [1, { r: [86, 8, 90, 10], l: [86, 8, 90, 10], handR: 1, handL: 1 }],
        [1.5, { r: [92, 8, 96, 10], l: [92, 8, 96, 10], handR: 0.7, handL: 0.7 }],
        [2, { nod: -6, r: [146, 6, 150, 6], l: [146, 6, 150, 6], handR: 1, handL: 1 }],
        [2.5, { nod: -6, r: [152, 6, 156, 6], l: [152, 6, 156, 6], handR: 0.7, handL: 0.7 }],
        [3, { nod: -6, r: [146, 6, 150, 6], l: [146, 6, 150, 6], handR: 1, handL: 1 }],
        [3.5, { r: [100, 8, 104, 10], l: [100, 8, 104, 10], handR: 0.7, handL: 0.7 }],
      ],
    },
    // Thumbs hooked in the belt loops, shoulders easy.
    popBeltLoops: { beats: 1, parts: [], keys: [[0, { r: at(1, 0.075, 0.5, 0.11, [1, -0.3, -0.3]), l: at(-1, -0.075, 0.5, 0.11, [1, -0.3, -0.3]), handR: 0, handL: 0 }]] },
    // Blow a kiss: fingertips at the lips, then thrown up and out.
    popKiss: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: 4, nod: 3, r: at(1, 0.03, 0.87, 0.16, [1, -0.6, 0]), l: ARM.hip, handR: 0.6, handL: 0 }],
        [1, { head: -4, turn: 16, nod: -4, r: [122, 40, 126, 40], l: ARM.hip, handR: 1, handL: 0 }],
      ],
    },
    // Jazz burst: fists tucked at the chest, then exploding open wide with spread hands.
    popBurst: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { nod: 6, r: at(1, 0.06, 0.72, 0.16, [1, -0.6, -0.1]), l: at(-1, -0.06, 0.72, 0.16, [1, -0.6, -0.1]), handR: 0, handL: 0 }],
        [1, { nod: -6, r: [110, 2, 112, 2], l: [110, 2, 112, 2], handR: 1, handL: 1 }],
      ],
    },
    // Clap under the hitched knee on 4 (arms swing open on the vine).
    popVineClap: {
      beats: 4, parts: ['arms'], mirror: true,
      keys: [
        [0, { r: [56, 4, 60, 6], l: [56, 4, 60, 6], handR: 1, handL: 1 }],
        [1, { r: [40, 10, 46, 14], l: [40, 10, 46, 14], handR: 1, handL: 1 }],
        [2, { r: [80, 4, 84, 6], l: [80, 4, 84, 6], handR: 1, handL: 1 }],
        [3, { r: at(1, -0.1, 0.5, 0.25, [0.6, -0.4, 0.3]), l: at(-1, -0.17, 0.5, 0.25, [0.6, -0.4, 0.3]), handR: 1, handL: 1 }],
      ],
    },
    // "Who knows?" shrug: shoulders up, palms up and out, head tilted.
    popShrug: {
      beats: 2, parts: ['arms', 'torso'], torso: true,
      keys: [
        [0, { head: 10, shR: 1.2, shL: 1.2, r: [36, 40, 92, 20], l: [36, 40, 92, 20], handR: 1, handL: 1 }],
        [1, { head: -3, r: [14, 10, 30, 40], l: [14, 10, 30, 40], handR: 1, handL: 1 }],
      ],
    },
    // "No, no, no": index finger wagging in front of the chest, the head shaking gently with it.
    popFingerWag: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { turn: -14, r: at(1, 0.14, 0.78, 0.25, [1, -0.6, 0]), l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
        [0.5, { turn: 14, r: at(1, 0.0, 0.8, 0.26, [1, -0.6, 0]), l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
        [1, { turn: -14, r: at(1, 0.14, 0.78, 0.25, [1, -0.6, 0]), l: ARM.hip, handR: 0, handL: 0, formR: 'point' }],
      ],
    },
    // Fan yourself: open hand fanning in front of the face, other hand on the hip.
    popFan: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: 6, nod: -6, r: at(1, 0.16, 0.95, 0.2, [1, -0.6, 0]), l: ARM.hip, handR: 1, handL: 0 }],
        [0.5, { head: 6, nod: -6, r: at(1, 0.05, 0.92, 0.22, [1, -0.6, 0]), l: ARM.hip, handR: 1, handL: 0 }],
        [1, { head: 6, nod: -6, r: at(1, 0.16, 0.95, 0.2, [1, -0.6, 0]), l: ARM.hip, handR: 1, handL: 0 }],
        [1.5, { head: 6, nod: -6, r: at(1, 0.05, 0.92, 0.22, [1, -0.6, 0]), l: ARM.hip, handR: 1, handL: 0 }],
      ],
    },
    // Cheer kick arms: high V with the kick, clasp on the way down.
    popKickV: { beats: 2, parts: ['arms'], keys: [[0, { r: C_HIGH_V, l: C_HIGH_V, handR: 0, handL: 0 }], [1, clasp]] },
    // Low-high clap: clap down by the right hip, overhead, down by the left hip, overhead.
    popClapLowHigh: {
      beats: 4, parts: ['arms', 'torso'], torso: true,
      keys: [
        [0, { lean: -5, twist: -10, r: at(1, 0.24, 0.5, 0.2, [1, -0.4, 0]), l: at(-1, 0.2, 0.5, 0.22, [1, -0.4, 0]), handR: 1, handL: 1 }],
        [1, { nod: -6, r: ARM.clapHigh, l: ARM.clapHigh, handR: 1, handL: 1 }],
        [2, { lean: 5, twist: 10, r: at(1, -0.2, 0.5, 0.22, [1, -0.4, 0]), l: at(-1, -0.24, 0.5, 0.2, [1, -0.4, 0]), handR: 1, handL: 1 }],
        [3, { nod: -6, r: ARM.clapHigh, l: ARM.clapHigh, handR: 1, handL: 1 }],
      ],
    },
    // Jazz spin arms: open second, close in to the chest for the turn, open high to finish.
    popSpinArms: {
      beats: 4, parts: ['arms'],
      keys: [
        [0, { r: [84, 8, 88, 10], l: [84, 8, 88, 10], handR: 1, handL: 1 }],
        [1, { r: [70, 30, 120, 70], l: [70, 30, 120, 70], handR: 1, handL: 1 }],
        [2, { r: at(1, 0.03, 0.72, 0.17, [0.8, -0.6, -0.2]), l: at(-1, -0.03, 0.72, 0.17, [0.8, -0.6, -0.2]), handR: 0.4, handL: 0.4 }],
        [3, { r: C_HIGH_V, l: C_HIGH_V, handR: 1, handL: 1 }],
      ],
    },
    // Cheer motions.
    popVMotions: { beats: 4, parts: ['arms'], keys: [[0, { r: C_HIGH_V, l: C_HIGH_V, handR: 0, handL: 0 }], [1, clasp], [2, { r: C_LOW_V, l: C_LOW_V, handR: 0, handL: 0 }], [3, clasp]] },
    popTMotion: { beats: 2, parts: ['arms'], keys: [[0, { r: C_T, l: C_T, handR: 0, handL: 0 }], [1, brokenT]] },
    popTouchdown: { beats: 2, parts: ['arms'], keys: [[0, { nod: -6, r: C_UP, l: C_UP, handR: 0, handL: 0 }], [1, daggers]] },
    popKMotion: { beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true, keys: [[0, kMotion], [1, { ...clasp, lean: 0, head: 0 }]] },
    popLMotion: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, lMotion], [1, { ...clasp, lean: 0 }]] },
    popBowArrow: { beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true, keys: [[0, bowArrow], [1, { ...clasp, turn: 0, lean: 0 }]] },
    // Jazz presentational sweep (with the pas de bourrée).
    popPresent: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, { ...presentLow, head: 0, turn: 0 }], [1, presentA]] },
    popCharlestonArms: { beats: 2, parts: ['arms'], keys: [[0, charlArms(1)], [1, charlArms(-1)]] },
    // Jazz walk arms: low, swinging opposite to the stepping foot, a finger snap on every step.
    popWalkSnaps: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { shL: 0.4, r: [28, -35, 46, 20], l: at(-1, 0.02, 0.56, 0.2, [0.6, -1, -0.2]), handR: 0, handL: 0 }],
        [1, { shR: 0.4, r: at(1, -0.02, 0.56, 0.2, [0.6, -1, -0.2]), l: [28, -35, 46, 20], handR: 0, handL: 0 }],
      ],
    },
  },
};

export const moves: MoveDef[] = [
  // --- Original pop staples ---
  combo('the-twist', 'The Twist', 'twist', 'twistArms', 'mid', 1, 'funk pop | hips full | twist'),
  combo('box-step', 'Box Step', 'boxStep', 'rest', 'mid', 2, 'pop latin | legs | walk'),
  combo('box-clap', 'Box Step Clap', 'boxStep', 'clap', 'mid', 3, 'pop | legs | clap walk'),
  combo('swim', 'Freestyle Swim', 'sway', 'swim', 'mid', 2, 'pop disco | arms | wave'),
  combo('ocean-arms', 'Ocean Arms', 'bounce', 'ocean', 'low', 1, 'pop | arms | wave'),
  combo('ripple', 'Ripple Wave', 'sway', 'ripple', 'low', 1, 'pop kpop | arms | wave'),
  combo('pendulum', 'Pendulum Sway', 'sway', 'pendulum', 'low', 1, 'pop | arms |'),
  combo('wave-step', 'Wave Step', 'stepTouch', 'ripple', 'low', 2, 'pop kpop | arms | wave'),
  combo('ocean-step', 'Ocean Step', 'stepTouch', 'ocean', 'low', 2, 'pop | arms | wave'),
  combo('rainbow', 'Rainbow Reach', 'tapSide', 'rainbow', 'mid', 2, 'pop | arms | wave'),
  combo('clap-groove', 'Double Clap Groove', 'sway', 'popDoubleClap', 'low', 1, 'pop hiphop | arms | clap hands', {
    desc: 'Sway side to side; clap on 1, clap on 2, and fling both hands open wide on the "and" after each.',
  }),
  combo('chasse', 'Chassé', 'chasse', 'jazzHands', 'mid', 2, 'pop | legs | walk'),
  combo('jazz-square', 'Jazz Square', 'jazzSquare', 'snaps', 'mid', 2, 'pop funk | legs | walk'),
  combo('triple-step', 'Triple Step', 'triple', 'jazzHands', 'mid', 2, 'pop | legs | walk'),
  combo('step-jazz-hands', 'Step Touch Jazz Hands', 'stepTouch', 'jazzHands', 'low', 1, 'pop | legs arms | hands walk'),
  combo('pivot-turn', 'Pivot Turn', 'pivot', 'hips', 'mid', 3, 'pop funk | turn | spin walk'),
  combo('spin', 'Jazz Spin', 'spin', 'popSpinArms', 'mid', 3, 'pop funk disco | turn | spin', {
    desc: 'Arms open to the sides, then pull in to the chest for a full turn and open high to finish.',
  }),
  combo('turn-around', 'Turn Around', 'halfTurn', 'hips', 'mid', 2, 'pop latin | turn | spin'),

  // --- Jazz / theatre footwork ---
  combo('pas-de-bourree', 'Pas de Bourrée', 'popPasDeBourree', 'popPresent', 'mid', 3, 'pop | legs | walk', {
    desc: 'Step behind, step side, step out into a soft plié (1-&-2) as one arm sweeps up and out; alternate sides.',
  }),
  combo('paddle-turn', 'Paddle Turn', 'popPaddle', 'jazzHands', 'mid', 2, 'pop funk | turn legs | spin', {
    desc: 'Turn on the spot a quarter per beat, the right foot pushing the floor like a paddle, jazz hands low.',
  }),
  combo('three-step-turn', 'Three-Step Turn', 'popThreeStep', 'turnArms', 'mid', 3, 'pop | turn legs | spin walk', {
    desc: 'Travel sideways with three steps (right, left, right) making one full turn, then touch and face front.',
  }),
  combo('jazz-walk', 'Jazz Walk', 'popJazzWalk', 'popWalkSnaps', 'low', 2, 'pop funk | legs hips | walk hips', {
    desc: 'Walk on the spot crossing each foot in front of the other, pushing the hip out over the standing leg, arms swinging low across the body.',
  }),

  // --- Cheer motions ---
  combo('high-v-low-v', 'High V Low V', 'popHitStep', 'popVMotions', 'mid', 2, 'pop | arms | punch', {
    desc: 'Cheer motions: hit a high V, clasp, hit a low V, clasp, feet jumping apart-together without leaving the floor.',
  }),
  combo('t-motion', 'T & Broken T', 'popHitStep', 'popTMotion', 'mid', 1, 'pop | arms |', {
    desc: 'Arms straight out in a T with fists, then bend them to a broken T (fists at the chest, elbows up).',
  }),
  combo('touchdown', 'Touchdown & Daggers', 'march', 'popTouchdown', 'mid', 1, 'pop rock | arms | punch', {
    desc: 'March on the spot; shoot both fists straight up (touchdown), then pull them down to daggers at the shoulders.',
  }),
  combo('k-motion', 'K Motion', 'sideLunge', 'popKMotion', 'mid', 2, 'pop | full | punch', {
    desc: 'Lunge to the side and hit a K: one arm high diagonal, the other reaching low across the body; clasp and switch.',
  }),
  combo('l-motion', 'L Motion', 'stepTouch', 'popLMotion', 'mid', 2, 'pop | arms | walk', {
    desc: 'Step touch side to side hitting an L: one arm straight up, the other straight out; clasp and switch.',
  }),
  combo('bow-and-arrow', 'Bow and Arrow', 'tapSide', 'popBowArrow', 'mid', 2, 'pop | arms | point', {
    desc: 'Tap to the side, one arm straight out like the bow and the other fist pulled across the chest, looking down the arm.',
  }),

  // --- Swing era ---
  combo('charleston', 'Charleston', 'popCharleston', 'popCharlestonArms', 'mid', 2, 'pop | legs | kick swing', {
    desc: 'Toe tap forward, step, toe tap back, step, heels swivelling in and out while both arms swing side to side.',
  }),
  combo('charleston-kick', 'Charleston Kick', 'popCharlestonKick', 'jazzHands', 'high', 3, 'pop | legs | kick swing', {
    desc: 'Kick one leg forward, step, kick the other leg back, step, knees swivelling, jazz hands low.',
  }),
  combo('hand-jive', 'Hand Jive', 'bounce', 'popHandJive', 'mid', 3, 'pop | arms | clap hands swing', {
    desc: 'Bounce and keep the hands busy: pat the thighs, clap, pat, clap, fist over fist both ways, thumb over each shoulder.',
  }),

  // --- Hand choreography ---
  combo('heart-hands', 'Heart Hands', 'sway', 'popHeart', 'low', 1, 'pop kpop | arms | hands', {
    desc: 'Sway with the hands making a heart at the chest, lift it up beside the head to one side, back to the chest, then to the other side.',
  }),
  combo('call-me', 'Call Me', 'tapSide', 'popPhone', 'low', 1, 'pop | arms | hands point', {
    desc: 'Tap to the side with a phone hand at the ear, then point out to that side; switch.',
  }),
  combo('wave-goodbye', 'Wave Goodbye', 'bounce', 'popWaveBye', 'low', 1, 'pop party | arms | wave hands', {
    desc: 'Bounce with one hand raised, waving from the elbow on every half beat; switch hands every two beats.',
  }),
  combo('frame-the-face', 'Frame the Face', 'hipSway', 'popFrame', 'low', 1, 'pop kpop | arms hips | hands hips', {
    desc: 'Hip sway with both hands framing the face, then throw them open wide at head height.',
  }),
  combo('hat-tip', 'Hat Tip', 'stepTouch', 'popHatTip', 'low', 2, 'pop | arms | walk hands', {
    desc: 'Step touch, tipping an imaginary hat at the brow, then sweep the hand out low to present; switch sides.',
  }),

  // --- Claps and cheer accents ---
  combo('slap-clap', 'Slap & Clap', 'groove', 'popSlapClap', 'mid', 1, 'pop rock | arms | clap', {
    desc: 'Bouncing in a wide stance, clap high over the head, then slap both thighs.',
  }),
  combo('pom-shake', 'Pom Shake', 'groove', 'popPomShake', 'mid', 1, 'pop | arms | shake', {
    desc: 'Wide bouncing stance with both fists up in a high V, shaking them like pom-poms on every half beat.',
  }),
  full({
    id: 'under-leg-clap', name: 'Under-the-Leg Clap', tags: 'pop aerobic | full | clap', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Lift one knee and clap under the thigh, then step down and clap high over the head; switch legs.',
    keys: [
      [0, { x: -0.02, y: -0.01, bend: 14, nod: 8, rf: [0.08, 0.24, 0.2], r: at(1, 0.1, 0.5, 0.26, [0.6, -0.4, 0.3]), l: at(-1, 0.03, 0.5, 0.26, [0.6, -0.4, 0.3]), handR: 1, handL: 1 }],
      [1, { y: -0.03, nod: -6, rf: [W, 0, 0], r: ARM.clapHigh, l: ARM.clapHigh, handR: 1, handL: 1 }],
    ],
  }),
  // --- Swing era / jazz / theatre (batch 3) ---
  combo('truckin', "Truckin'", 'march', 'popTruckin', 'low', 1, 'pop | arms legs | walk point swing', {
    desc: 'March on the spot with one hand on the hip and the other index finger raised high, wagging side to side; switch.',
  }),
  combo('shorty-george', 'Shorty George', 'popShorty', 'popShortyArms', 'mid', 2, 'pop | legs hips | swing', {
    desc: 'Knees bent and pressed together, swing them side to side while both straight arms point down toward the floor.',
  }),
  combo('twist-down', 'Twist Down', 'popTwistDown', 'twistArms', 'high', 2, 'pop funk | hips legs | twist', {
    desc: 'Do the twist while sinking lower each beat to a low squat, then twist back up.',
  }),
  combo('kickline', 'Kickline', 'popKickline', 'popLineArms', 'high', 2, 'pop aerobic | legs | kick', {
    desc: 'Drill-team kicks: low kick right, step, low kick left, step, arms out to the sides as if linked.',
  }),
  combo('flick-kick', 'Flick Kick', 'popFlick', 'popFlickArms', 'mid', 2, 'pop | legs | kick', {
    desc: 'Lift the knee, flick the lower leg out on the "and" as the hands flick open, step down; alternate legs.',
  }),
  combo('pirouette', 'Passé Turn', 'popPasse', 'popPirArms', 'mid', 3, 'pop | turn legs | spin', {
    desc: 'Plié with arms open, rise onto one foot with the other toe at the knee and turn once, arms rounded in front, then land.',
  }),
  combo('port-de-bras', 'Port de Bras', 'sway', 'popPortDeBras', 'low', 1, 'pop | arms |', {
    desc: 'Sway while the arms flow through ballet positions: low and rounded, rounded in front, rounded overhead, open wide.',
  }),
  combo('spirit-fingers', 'Spirit Fingers Rise', 'bounce', 'popSpiritRise', 'low', 1, 'pop | arms | hands shake', {
    desc: 'Wiggling jazz hands climb from low, to shoulder height, to a high V, then float back down.',
  }),
  full({
    id: 'layout-reach', name: 'Lunge & Over-the-Top Reach', tags: 'pop aerobic | full |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true,
    desc: 'Lunge to the side and sweep the opposite arm up and over the head toward the lunge, bending the side long; return and switch.',
    keys: [
      [0, { x: 0.08, y: -0.11, hips: 0.01, rf: [0.31, 0, 0], lf: [-0.11, 0, 0], lean: 18, head: 8, l: [166, 0, 172, 0], r: [26, 0, 30, 0], handR: 1, handL: 1 }],
      [1, { x: 0.02, y: -0.03, rf: [0.15, 0, 0], lf: [-0.11, 0, 0], lean: -2, l: [50, 0, 56, 6], r: [40, 0, 46, 6], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'strike-a-pose', name: 'Strike a Pose', tags: 'pop | full | hips', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'Bounce for two counts, then hit a pop-video pose: hand behind the head, other hand on the hip, hip popped out; hold.',
    keys: [
      [0, { y: -0.04, r: [16, 15, 34, 60], l: [9, -5, 18, 35] }],
      [1, { y: -0.01, r: [9, -5, 18, 35], l: [16, 15, 34, 60] }],
      [2, { y: -0.03, hips: 0.065, tilt: 9, lf: [-0.085, 0.03, 0.04], kneeL: -0.2, lean: -4, head: 8, turn: -12, r: at(1, 0.11, 1.0, -0.03, [1, 0.3, -0.3]), l: ARM.hip, handR: 1, handL: 0 }],
      [3, { y: -0.045, hips: 0.06, tilt: 8, lf: [-0.085, 0.03, 0.04], kneeL: -0.2, lean: -3, head: 7, turn: -12, r: at(1, 0.11, 1.0, -0.03, [1, 0.3, -0.3]), l: ARM.hip, handR: 1, handL: 0 }],
    ],
  }),
  // --- Country-pop / theatre accents (batch 4) ---
  combo('heel-hook', 'Heel & Hook', 'popHeelHook', 'popBeltLoops', 'mid', 2, 'pop rock | legs | kick country', {
    desc: 'Thumbs in the belt loops: dig the heel forward, hook the same foot across in front of the other shin, step down; switch.',
  }),
  combo('kick-cross', 'Kick & Cross', 'popKickCross', 'popPresent', 'mid', 2, 'pop | legs | kick', {
    shift: 1,
    desc: 'Low kick forward as one arm opens up and out, then cross the same foot over in front as the hands cross low, step it back out; switch.',
  }),
  combo('blow-a-kiss', 'Blow a Kiss', 'hipBump', 'popKiss', 'low', 1, 'pop | arms hips | hands hips', {
    desc: 'Bump the hips side to side; touch the fingertips to the lips, then throw the kiss up and out; switch hands.',
  }),
  combo('jazz-burst', 'Jazz Burst', 'popPlieRise', 'popBurst', 'mid', 1, 'pop | full | hands', {
    desc: 'Sink into a plié with fists tucked at the chest, then rise tall and burst the arms open wide with spread hands.',
  }),
  full({
    id: 'ta-da', name: 'Ta-Da!', tags: 'pop | full | hands', beats: 4, level: 'mid', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Step out into a lunge and fling both arms up and open with jazz hands, hold it, then step back together.',
    keys: [
      [0, { x: 0.07, y: -0.1, rf: [0.3, 0, 0.03], lf: [-0.1, 0, 0], lean: 4, head: -6, nod: -6, r: [140, 14, 144, 14], l: [140, 14, 144, 14], handR: 1, handL: 1 }],
      [1, { x: 0.07, y: -0.115, rf: [0.3, 0, 0.03], lf: [-0.1, 0, 0], lean: 5, head: -6, nod: -6, r: [146, 14, 150, 14], l: [146, 14, 150, 14], handR: 0.8, handL: 0.8 }],
      [2, { x: 0.0, y: -0.02, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: at(1, -0.05, 0.56, 0.16, [0.6, -1, -0.2]), l: at(-1, 0.05, 0.55, 0.18, [0.6, -1, -0.2]), handR: 1, handL: 1 }],
      [3, { x: 0.0, y: -0.05, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: at(1, -0.05, 0.56, 0.16, [0.6, -1, -0.2]), l: at(-1, 0.05, 0.55, 0.18, [0.6, -1, -0.2]), handR: 1, handL: 1 }],
    ],
  }),
  // --- More theatre / pop accents (batch 5) ---
  combo('vine-hitch-clap', 'Vine Hitch Clap', 'popVineHitch', 'popVineClap', 'mid', 2, 'pop aerobic | legs | walk clap country', {
    desc: 'Grapevine to the side (side, behind, side), then hitch the trailing knee up and clap under it; go back the other way.',
  }),
  combo('shrug', 'Who Knows Shrug', 'sway', 'popShrug', 'low', 1, 'pop party | arms |', {
    desc: 'Sway and shrug: shoulders up to the ears, palms up and out, head tilted, then drop it all.',
  }),
  combo('finger-wag', 'No-No Finger Wag', 'twoStep', 'popFingerWag', 'low', 1, 'pop | arms | point', {
    desc: 'Two-step with one hand on the hip, wagging the index finger "no, no, no" in front of the chest; switch hands.',
  }),
  full({
    id: 'peekaboo', name: 'Peekaboo', tags: 'pop kpop | full | hands', beats: 2, level: 'mid', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Drop into a plié hiding the face behind both hands, then pop up leaning to one side, hands open beside the face; switch sides.',
    keys: [
      [0, { y: -0.13, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.2, kneeL: 0.2, nod: 8, r: at(1, 0.045, 0.92, 0.2, [1, -0.8, 0]), l: at(-1, -0.045, 0.92, 0.2, [1, -0.8, 0]), handR: 1, handL: 1 }],
      [1, { y: -0.01, x: 0.03, hips: 0.03, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], lean: 9, head: 10, r: at(1, 0.2, 0.9, 0.12, [1, -0.8, 0]), l: at(-1, 0.03, 0.88, 0.2, [1, -0.8, 0]), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'liberty', name: 'Liberty', tags: 'pop | full | punch', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Cheer balance: stand on one leg with the other toe at the knee and punch one fist straight up, other fist on the hip; step down and clasp.',
    keys: [
      [0, { y: 0.0, x: -0.015, rf: [0.04, 0.24, 0.06], kneeR: 0.65, r: C_UP, l: ARM.hip, handR: 0, handL: 0, nod: -5 }],
      [1, { y: -0.05, rf: [W, 0, 0], ...clasp }],
    ],
  }),
  full({
    id: 'contract-release', name: 'Contract & Release', tags: 'pop | full |', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'],
    desc: 'Jazz contraction: curl the chest in over a soft plié with the arms rounded low, then release tall with the chest lifted and arms open high.',
    keys: [
      [0, { y: -0.1, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.15, kneeL: 0.15, bend: 16, nod: 12, shR: 0.4, shL: 0.4, r: at(1, 0.06, 0.52, 0.2, [1, -0.3, 0]), l: at(-1, -0.06, 0.52, 0.2, [1, -0.3, 0]), handR: 1, handL: 1 }],
      [1, { y: 0.0, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], bend: -6, nod: -8, r: [128, 22, 132, 26], l: [128, 22, 132, 26], handR: 1, handL: 1 }],
    ],
  }),
  // --- Batch 6 ---
  combo('cheer-kick', 'Cheer Kick', 'popCheerKick', 'popKickV', 'high', 2, 'pop | legs arms | kick', {
    desc: 'Kick one leg to hip height as both fists hit a high V, step down into a clasp; alternate legs.',
  }),
  combo('fan-yourself', 'Fan Yourself', 'hipSway', 'popFan', 'low', 1, 'pop party | arms hips | hands', {
    desc: 'Hip sway with one hand on the hip, fanning the face with the other open hand ("it\'s hot in here"); switch hands.',
  }),
  full({
    id: 'bees-knees', name: "Bee's Knees", tags: 'pop | legs arms | hands swing', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Charleston classic: knees bent with hands on them, knees open and close while the hands cross and uncross over them.',
    keys: [
      [0, { y: -0.13, rf: [0.11, 0, 0.02], lf: [-0.11, 0, 0.02], kneeR: -0.45, kneeL: -0.45, bend: 18, nod: -10, r: at(1, 0.06, 0.48, 0.24, [1, -0.2, 0.2]), l: at(-1, -0.06, 0.48, 0.24, [1, -0.2, 0.2]), handR: 1, handL: 1 }],
      [0.5, { y: -0.13, rf: [0.11, 0, 0.02], lf: [-0.11, 0, 0.02], kneeR: 0.45, kneeL: 0.45, bend: 18, nod: -10, r: at(1, -0.06, 0.48, 0.27, [1, -0.2, 0.2]), l: at(-1, 0.06, 0.48, 0.23, [1, -0.2, 0.2]), handR: 1, handL: 1 }],
      [1, { y: -0.13, rf: [0.11, 0, 0.02], lf: [-0.11, 0, 0.02], kneeR: -0.45, kneeL: -0.45, bend: 18, nod: -10, r: at(1, 0.06, 0.48, 0.24, [1, -0.2, 0.2]), l: at(-1, -0.06, 0.48, 0.24, [1, -0.2, 0.2]), handR: 1, handL: 1 }],
      [1.5, { y: -0.12, rf: [0.11, 0, 0.02], lf: [-0.11, 0, 0.02], kneeR: 0.45, kneeL: 0.45, bend: 18, nod: -10, r: at(1, 0.16, 0.48, 0.22, [1, -0.2, 0.2]), l: at(-1, -0.16, 0.48, 0.22, [1, -0.2, 0.2]), handR: 1, handL: 1 }],
    ],
  }),
  // --- Batch 7 ---
  combo('heel-switches', 'Heel Switches', 'popHeelSwitch', 'hips', 'mid', 2, 'pop rock | legs | kick country', {
    desc: 'Hands on hips, quick alternating heel digs: one heel out on the beat, feet together on the "and", other heel out.',
  }),
  combo('hip-to-sky-clap', 'Hip-to-Sky Clap', 'groove', 'popClapLowHigh', 'mid', 2, 'pop | arms | clap', {
    desc: 'Wide bouncing stance: clap down by one hip, sweep up and clap overhead, clap down by the other hip, overhead again.',
  }),
];
