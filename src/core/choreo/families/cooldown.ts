/**
 * Calm moves. `cooldown: true` = held stretches (the outro picks only these);
 * the rest are low-intensity moves for warm-ups, intros and the quiet parts of
 * songs: dynamic warm-ups, tai chi / qigong flows, standing yoga shapes and
 * lyrical arms.
 */

import { ARM, at, hand, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const SOFT_DOWN = [22, 0, 26, 5] as const;
/** Wide, soft-kneed tai chi / horse stance. */
const TAI = (y = -0.06, extra: PoseSpec = {}): PoseSpec => ({ y, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], ...extra });
const OPEN2 = { handR: 1, handL: 1 } as const;
/** Feet together, hinged forward, hands on the knees. */
const KNEES: PoseSpec = { bend: 28, nod: -14, rf: [0.05, 0, 0], lf: [-0.05, 0, 0], r: hand(0.0, -0.31, 0.07, [1, 0.2, -0.3]), l: hand(0.0, -0.31, 0.07, [1, 0.2, -0.3]), handR: 1, handL: 1 };
/** Palms pressed together overhead / at the heart. */
const UP_R = at(1, 0.03, 1.27, 0.07, [1, 0.15, 0]);
const UP_L = at(-1, -0.03, 1.27, 0.07, [1, 0.15, 0]);
const HEART_R = at(1, 0.015, 0.7, 0.17, [1, -0.3, 0]);
const HEART_L = at(-1, -0.015, 0.7, 0.17, [1, -0.3, 0]);

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  full({
    id: 'side-stretch', name: 'Side Stretch', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['torso', 'arms'], mirror: true, cooldown: true, bounce: 0.25,
    keys: [
      [0, { lean: -19, hips: 0.03, head: -6, r: [176, -20, 228, -15], l: ARM.hip, handR: 1 }],
      [2, { lean: -24, hips: 0.035, head: -8, y: -0.025, r: [178, -20, 236, -15], l: ARM.hip, handR: 1 }],
      [3, { lean: -5, r: [150, 0, 155, 0], l: [95, 0, 100, 0], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'big-breath', name: 'Big Breath', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], cooldown: true, bounce: 0.2, icon: 1,
    keys: [
      [0, { y: -0.04, nod: 6, r: [32, 0, 36, 0], l: [32, 0, 36, 0], handR: 1, handL: 1 }],
      [2, { y: 0.0, nod: -10, r: [168, 0, 174, 0], l: [168, 0, 174, 0], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'arm-hug', name: 'Arm Hug', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], mirror: true, cooldown: true, bounce: 0.2,
    keys: [
      [0, { twist: -6, head: 4, r: hand(-0.28, -0.04, 0.16, [0, -1, 0.5]), l: hand(-0.15, -0.07, 0.2, [0.3, -1, 0.2]), handR: 1, handL: 1 }],
      [2, { twist: -9, head: 6, y: -0.025, r: hand(-0.29, -0.04, 0.15, [0, -1, 0.5]), l: hand(-0.16, -0.07, 0.2, [0.3, -1, 0.2]), handR: 1, handL: 1 }],
      [3, { r: SOFT_DOWN, l: SOFT_DOWN }],
    ],
  }),
  full({
    id: 'neck-stretch', name: 'Neck Stretch', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['torso'], mirror: true, cooldown: true, bounce: 0.15,
    keys: [
      [0, { head: 24, r: [14, 0, 18, 20], l: ARM.hip, handL: 0 }],
      [2, { head: 28, nod: 4, y: -0.02, r: [16, 0, 20, 20], l: ARM.hip, handL: 0 }],
      [3, { head: 4, r: SOFT_DOWN, l: SOFT_DOWN }],
    ],
  }),
  full({
    id: 'reach-up', name: 'Overhead Reach', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], cooldown: true, bounce: 0.15,
    keys: [
      [0, { nod: -8, r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
      [2, { nod: -12, y: 0.0, shR: 0.5, shL: 0.5, r: [178, 0, 180, 0], l: [178, 0, 180, 0], handR: 1, handL: 1 }],
      [3, { y: -0.04, r: [70, 0, 74, 0], l: [70, 0, 74, 0], handR: 1, handL: 1 }],
    ],
  }),

  // --- Tai chi / qigong flows (slow sections, intros) ------------------------
  full({
    id: 'wild-horse-mane', name: "Part the Wild Horse's Mane", tags: 'aerobic | arms legs | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, bounce: 0.1,
    desc: 'Hold a ball at the chest, then step wide and split the hands: the leading hand rises out to eye height while the other presses down by the hip.',
    keys: [
      [0, { y: -0.06, x: -0.03, rf: [0.06, 0.02, 0.02], lf: [-0.11, 0, 0], twist: -8, r: at(1, 0.07, 0.74, 0.18, [0.6, -0.4, -0.3]), l: at(-1, 0.05, 0.52, 0.16, [0.6, -0.8, 0]), ...OPEN2 }],
      [2, { y: -0.08, x: 0.05, hips: 0.02, rf: [0.27, 0, 0.03], lf: [-0.11, 0, 0], twist: 10, turn: 12, r: at(1, 0.4, 0.95, 0.14, [0.3, -1, 0]), l: at(-1, -0.22, 0.5, 0.08, [1, 0, -0.3]), ...OPEN2 }],
      [3, { y: -0.1, x: 0.06, hips: 0.025, rf: [0.27, 0, 0.03], lf: [-0.11, 0, 0], twist: 8, turn: 10, r: at(1, 0.42, 0.97, 0.14, [0.3, -1, 0]), l: at(-1, -0.23, 0.48, 0.08, [1, 0, -0.3]), ...OPEN2 }],
    ],
  }),
  full({
    id: 'cloud-hands', name: 'Wave Hands Like Clouds', tags: 'aerobic | arms hips | hands wave', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.1,
    desc: 'Wide soft stance: one palm drifts across at face height while the other passes low across the belly, the weight and waist following the high hand.',
    keys: [
      [0, TAI(-0.06, { x: 0.04, hips: 0.035, twist: 14, turn: 14, r: at(1, 0.3, 0.94, 0.14, [0.6, -0.7, 0]), l: at(-1, 0.1, 0.46, 0.14, [0.6, -0.8, 0]), ...OPEN2 })],
      [1, TAI(-0.08, { x: 0, r: at(1, 0.36, 0.58, 0.1, [0.7, -0.6, 0]), l: at(-1, -0.08, 0.74, 0.2, [0.6, -0.7, 0]), ...OPEN2 })],
      [2, TAI(-0.06, { x: -0.04, hips: -0.035, twist: -14, turn: -14, l: at(-1, -0.3, 0.94, 0.14, [0.6, -0.7, 0]), r: at(1, -0.1, 0.46, 0.14, [0.6, -0.8, 0]), ...OPEN2 })],
      [3, TAI(-0.08, { x: 0, l: at(-1, -0.36, 0.58, 0.1, [0.7, -0.6, 0]), r: at(1, 0.08, 0.74, 0.2, [0.6, -0.7, 0]), ...OPEN2 })],
    ],
  }),
  full({
    id: 'heaven-earth', name: 'Separate Heaven and Earth', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], mirror: true, bounce: 0.1,
    desc: 'Palms together at the belly, then one palm presses up to the sky as the other presses down by the hip; float back and switch.',
    keys: [
      [0, { y: -0.05, nod: 4, r: at(1, 0.05, 0.56, 0.16, [0.6, -0.8, 0]), l: at(-1, -0.05, 0.56, 0.16, [0.6, -0.8, 0]), ...OPEN2 }],
      [1, { y: -0.03, r: at(1, 0.08, 0.86, 0.2, [0.6, -0.8, 0]), l: at(-1, -0.06, 0.62, 0.16, [0.6, -0.8, 0]), ...OPEN2 }],
      [2, { y: 0, nod: -10, turn: 6, lean: -3, r: [174, 0, 196, 0], l: at(-1, -0.2, 0.44, 0.04, [1, 0, -0.3]), ...OPEN2 }],
      [3, { y: -0.01, nod: -8, turn: 5, lean: -3, r: [176, 0, 198, 0], l: at(-1, -0.21, 0.43, 0.04, [1, 0, -0.3]), ...OPEN2 }],
    ],
  }),
  full({
    id: 'single-whip', name: 'Single Whip', tags: 'aerobic | arms legs |', beats: 4, level: 'low', d: 2, parts: ['arms', 'legs'], mirror: true, bounce: 0.1,
    desc: 'Gather both hands by one shoulder, hook that hand and send it out to the side, then step wide the other way and open the other palm out at shoulder height.',
    keys: [
      [0, { y: -0.05, x: 0.03, rf: [0.09, 0, 0], lf: [-0.08, 0.02, 0.01], twist: 14, turn: 14, r: at(1, 0.2, 0.8, 0.2, [0.7, -0.5, 0]), l: at(-1, 0.1, 0.7, 0.18, [0.5, -0.8, 0]), handR: 0, handL: 1 }],
      [1, { y: -0.05, x: 0.03, rf: [0.09, 0, 0], lf: [-0.08, 0.02, 0.01], twist: 16, turn: 16, r: at(1, 0.48, 0.84, 0.12, [0.2, -1, 0]), l: at(-1, 0.1, 0.72, 0.18, [0.5, -0.8, 0]), handR: 0, handL: 1 }],
      [2, TAI(-0.1, { x: -0.03, hips: -0.02, rf: [0.13, 0, 0], lf: [-0.25, 0, 0], twist: -6, turn: -18, r: at(1, 0.5, 0.84, 0.08, [0.2, -1, 0]), l: at(-1, -0.42, 0.82, 0.16, [0.3, -1, 0]), handR: 0, handL: 1 })],
      [3, TAI(-0.11, { x: -0.03, hips: -0.02, rf: [0.13, 0, 0], lf: [-0.25, 0, 0], twist: -5, turn: -16, r: at(1, 0.5, 0.83, 0.08, [0.2, -1, 0]), l: at(-1, -0.44, 0.8, 0.14, [0.3, -1, 0]), handR: 0, handL: 1 })],
    ],
  }),
  full({
    id: 'lift-the-sky', name: 'Lift the Sky', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], bounce: 0.1,
    desc: 'Fingers laced palms-up at the belly, lift them up the centre line and press the palms to the sky, then float the arms down wide.',
    keys: [
      [0, { y: -0.05, nod: 5, r: at(1, 0.03, 0.54, 0.15, [0.7, -0.6, 0]), l: at(-1, -0.03, 0.54, 0.15, [0.7, -0.6, 0]), ...OPEN2 }],
      [1, { y: -0.03, nod: 0, r: at(1, 0.03, 0.84, 0.17, [0.9, -0.3, 0]), l: at(-1, -0.03, 0.84, 0.17, [0.9, -0.3, 0]), ...OPEN2 }],
      [2, { y: 0.0, nod: -12, shR: 0.4, shL: 0.4, r: at(1, 0.035, 1.3, 0.05, [1, 0, 0]), l: at(-1, -0.035, 1.3, 0.05, [1, 0, 0]), ...OPEN2 }],
      [3, { y: -0.03, nod: -2, r: [96, 0, 100, 0], l: [96, 0, 100, 0], ...OPEN2 }],
    ],
  }),
  full({
    id: 'gather-press', name: 'Gather & Press Down', tags: 'aerobic | arms legs |', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], bounce: 0.1,
    desc: 'Scoop the arms out wide and up to shoulder height, bring the palms in over the head, then press them down the front of the body as the knees sink.',
    keys: [
      [0, { y: -0.02, r: [52, 0, 58, 10], l: [52, 0, 58, 10], ...OPEN2 }],
      [1, { y: 0, nod: -4, r: [112, 10, 124, 20], l: [112, 10, 124, 20], ...OPEN2 }],
      [2, { y: -0.03, nod: 0, r: at(1, 0.1, 1.04, 0.22, [0.9, 0.2, 0]), l: at(-1, -0.1, 1.04, 0.22, [0.9, 0.2, 0]), ...OPEN2 }],
      [3, TAI(-0.13, { nod: 8, r: at(1, 0.06, 0.6, 0.24, [1, -0.1, 0]), l: at(-1, -0.06, 0.6, 0.24, [1, -0.1, 0]), ...OPEN2 })],
    ],
  }),

  // --- Standing yoga shapes (held 2-4 beats, smooth entry) -------------------
  full({
    id: 'tree-pose', name: 'Tree Pose', tags: 'aerobic pop | legs arms |', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true, bounce: 0,
    desc: 'Palms together at the heart, rest one foot on the other calf with the knee turned out, grow the hands overhead, then lower and switch.',
    keys: [
      [0, { y: -0.02, x: -0.02, r: HEART_R, l: HEART_L, ...OPEN2 }],
      [1, { y: -0.01, x: -0.04, hips: -0.02, rf: [0.0, 0.2, 0.02], lf: [-0.07, 0, 0], kneeR: 0.7, r: HEART_R, l: HEART_L, ...OPEN2 }],
      [2, { y: 0, x: -0.04, hips: -0.02, nod: -6, rf: [0.0, 0.21, 0.02], lf: [-0.07, 0, 0], kneeR: 0.7, r: UP_R, l: UP_L, ...OPEN2 }],
      [3, { y: -0.03, x: -0.02, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: [120, 0, 126, 0], l: [120, 0, 126, 0], ...OPEN2 }],
    ],
  }),
  full({
    id: 'warrior-flow', name: 'Warrior II to Reverse Warrior', tags: 'aerobic pop | legs arms |', beats: 4, level: 'low', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true, bounce: 0,
    desc: 'Wide lunge with the arms long like a T, gaze over the front hand; then sweep the front arm up and back as the back hand slides down the thigh.',
    keys: [
      [0, { y: -0.1, x: 0.035, hips: 0.01, rf: [0.24, 0, 0], lf: [-0.24, 0, 0], kneeR: 0.25, turn: 30, r: [90, 0, 90, 0], l: [90, 0, 90, 0], ...OPEN2 }],
      [1, { y: -0.12, x: 0.045, hips: 0.01, rf: [0.24, 0, 0], lf: [-0.24, 0, 0], kneeR: 0.25, turn: 32, r: [92, 0, 92, 0], l: [92, 0, 92, 0], ...OPEN2 }],
      [2, { y: -0.11, x: 0.03, rf: [0.24, 0, 0], lf: [-0.24, 0, 0], kneeR: 0.25, lean: -18, head: -8, nod: -6, r: [164, 0, 170, 0], l: at(-1, -0.24, 0.42, 0.04, [1, 0, -0.2]), ...OPEN2 }],
      [3, { y: -0.12, x: 0.03, rf: [0.24, 0, 0], lf: [-0.24, 0, 0], kneeR: 0.25, lean: -21, head: -9, nod: -8, r: [166, 0, 172, 0], l: at(-1, -0.25, 0.4, 0.04, [1, 0, -0.2]), ...OPEN2 }],
    ],
  }),
  full({
    id: 'goddess-pose', name: 'Goddess Pose', tags: 'aerobic pop | legs arms |', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], bounce: 0,
    desc: 'Toes and knees turned out in a wide stance, sink low with cactus arms, then rise and press the palms together overhead.',
    keys: [
      [0, { y: -0.15, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.55, kneeL: 0.55, r: ARM.goal, l: ARM.goal, ...OPEN2 }],
      [1, { y: -0.17, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.55, kneeL: 0.55, r: [90, 0, 178, 10], l: [90, 0, 178, 10], ...OPEN2 }],
      [2, { y: -0.06, nod: -6, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.4, kneeL: 0.4, r: UP_R, l: UP_L, ...OPEN2 }],
      [3, { y: -0.08, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.45, kneeL: 0.45, r: [130, 0, 150, 5], l: [130, 0, 150, 5], ...OPEN2 }],
    ],
  }),
  full({
    id: 'triangle-reach', name: 'Triangle Reach', tags: 'aerobic pop | arms full |', beats: 4, level: 'low', d: 1, parts: ['torso', 'arms'], mirror: true, bounce: 0,
    desc: 'Wide straight-legged stance with the arms long, tip sideways over the front leg so one hand slides down the shin and the other points to the ceiling.',
    keys: [
      [0, { y: -0.03, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.2, r: [90, 0, 90, 0], l: [90, 0, 90, 0], ...OPEN2 }],
      [2, { y: -0.05, hips: -0.05, x: -0.02, lean: 28, head: 6, turn: -14, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.2, r: [14, 0, 16, 0], l: [172, 0, 176, 0], ...OPEN2 }],
      [3, { y: -0.05, hips: -0.055, x: -0.02, lean: 30, head: 7, turn: -16, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.2, r: [12, 0, 14, 0], l: [174, 0, 178, 0], ...OPEN2 }],
    ],
  }),
  full({
    id: 'eagle-arms', name: 'Eagle Arms', tags: 'aerobic pop | arms legs |', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, bounce: 0,
    desc: 'Open the arms wide, then wrap them: elbows stacked at chest height, forearms twisted up with the palms together in front of the face, knees bent and one foot tapped across.',
    keys: [
      [0, { y: -0.03, r: [96, 0, 100, 0], l: [96, 0, 100, 0], ...OPEN2 }],
      [1, { y: -0.1, rf: [-0.04, 0.03, 0.05], lf: [-0.08, 0, 0], x: -0.02, kneeR: -0.1, nod: 4, r: at(1, -0.03, 0.85, 0.22, [0.1, -1, 0.4]), l: at(-1, 0.03, 0.83, 0.2, [0.1, -1, 0.3]), ...OPEN2 }],
      [3, { y: -0.12, rf: [-0.04, 0.03, 0.05], lf: [-0.08, 0, 0], x: -0.02, kneeR: -0.1, nod: 6, r: at(1, -0.03, 0.86, 0.23, [0.1, -1, 0.4]), l: at(-1, 0.03, 0.84, 0.21, [0.1, -1, 0.3]), ...OPEN2 }],
    ],
  }),
  full({
    id: 'star-pose', name: 'Star Pose', tags: 'aerobic pop | full |', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, bounce: 0,
    desc: 'From feet together with hands at the heart, step one foot wide and stretch into a big star, arms and legs reaching to the corners; hold, then step back in.',
    keys: [
      [0, { y: -0.02, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: HEART_R, l: HEART_L, ...OPEN2 }],
      [1, { y: -0.01, x: 0.06, rf: [0.28, 0, 0], lf: [-0.16, 0, 0], nod: -6, r: [134, 0, 138, 0], l: [134, 0, 138, 0], ...OPEN2 }],
      [2.5, { y: 0, x: 0.06, rf: [0.28, 0, 0], lf: [-0.16, 0, 0], nod: -8, shR: 0.3, shL: 0.3, r: [138, 0, 142, 0], l: [138, 0, 142, 0], ...OPEN2 }],
      [3, { y: -0.03, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: [70, 0, 90, 30], l: [70, 0, 90, 30], ...OPEN2 }],
    ],
  }),
  full({
    id: 'crescent-moon', name: 'Crescent Moon', tags: 'aerobic pop | full arms |', beats: 4, level: 'low', d: 1, parts: ['torso', 'arms'], mirror: true, bounce: 0,
    desc: 'Both arms overhead with the palms pressed together, arc the whole upper body sideways into a crescent and hold, then come back through the centre.',
    keys: [
      [0, { y: -0.02, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], nod: -4, r: UP_R, l: UP_L, ...OPEN2 }],
      [1.5, { y: -0.02, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], hips: -0.06, tilt: -6, lean: 24, head: 8, r: UP_R, l: UP_L, ...OPEN2 }],
      [3, { y: -0.02, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], hips: -0.065, tilt: -7, lean: 27, head: 9, r: UP_R, l: UP_L, ...OPEN2 }],
    ],
  }),

  full({
    id: 'figure-four', name: 'Standing Figure Four', tags: 'aerobic pop | legs |', beats: 4, level: 'low', d: 1, parts: ['legs'], mirror: true, bounce: 0,
    desc: 'Hands at the heart, cross one ankle over the other knee with the knee opening out, sit back a little into the standing leg, then set the foot down.',
    keys: [
      [0, { y: -0.02, r: HEART_R, l: HEART_L, ...OPEN2 }],
      [1, { y: -0.04, x: -0.03, hips: -0.02, rf: [-0.05, 0.27, 0.07], lf: [-0.07, 0, 0], kneeR: 0.9, r: HEART_R, l: HEART_L, ...OPEN2 }],
      [2.5, { y: -0.11, x: -0.035, hips: -0.02, bend: 10, nod: -4, rf: [-0.05, 0.22, 0.09], lf: [-0.07, 0, 0], kneeR: 0.9, r: HEART_R, l: HEART_L, ...OPEN2 }],
      [3.5, { y: -0.03, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: HEART_R, l: HEART_L, ...OPEN2 }],
    ],
  }),

  // --- Lyrical / ballad arms -------------------------------------------------
  full({
    id: 'heart-reach', name: 'Reach & Pull to Heart', tags: 'pop aerobic | arms | hands', beats: 4, level: 'low', d: 1, parts: ['arms'], mirror: true, bounce: 0.15,
    desc: 'From hands on the heart, reach one arm long and high out to the side as if for someone far away, then draw the hand slowly back to the heart.',
    keys: [
      [0, { y: -0.04, nod: 6, head: -4, r: HEART_R, l: HEART_L, ...OPEN2 }],
      [1.5, { y: -0.01, x: 0.03, hips: 0.02, lean: 7, nod: -6, turn: 16, rf: [0.1, 0, 0], lf: [-0.09, 0.02, 0.01], r: at(1, 0.44, 1.02, 0.16, [0.3, -1, 0]), l: HEART_L, ...OPEN2 }],
      [2.5, { y: -0.02, x: 0.03, hips: 0.02, lean: 5, nod: -4, turn: 12, rf: [0.1, 0, 0], lf: [-0.09, 0.02, 0.01], r: at(1, 0.4, 0.98, 0.18, [0.3, -1, 0]), l: HEART_L, handR: 0.6, handL: 1 }],
      [3.5, { y: -0.05, nod: 8, head: 5, r: at(1, -0.02, 0.69, 0.18, [1, -0.3, 0]), l: at(-1, -0.04, 0.66, 0.16, [1, -0.3, 0]), ...OPEN2 }],
    ],
  }),
  full({
    id: 'open-curtains', name: 'Open the Curtains', tags: 'pop aerobic | arms | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], bounce: 0.15,
    desc: 'Backs of the hands together in front of the face, then part them like stage curtains, sweeping out and down to a wide low V as the knees soften; float back up the middle.',
    keys: [
      [0, { y: -0.02, nod: -2, r: at(1, 0.03, 0.96, 0.22, [1, 0.1, 0]), l: at(-1, -0.03, 0.96, 0.22, [1, 0.1, 0]), ...OPEN2 }],
      [1, { y: -0.03, r: at(1, 0.3, 0.98, 0.14, [0.6, -0.6, 0]), l: at(-1, -0.3, 0.98, 0.14, [0.6, -0.6, 0]), ...OPEN2 }],
      [2, { y: -0.09, nod: 6, r: [62, 0, 58, 0], l: [62, 0, 58, 0], ...OPEN2 }],
      [3, { y: -0.05, nod: 2, r: at(1, 0.06, 0.62, 0.22, [1, -0.3, 0]), l: at(-1, -0.06, 0.62, 0.22, [1, -0.3, 0]), handR: 0.6, handL: 0.6 }],
    ],
  }),
  full({
    id: 'paint-rainbow', name: 'Paint the Rainbow', tags: 'pop aerobic | arms | wave hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true, bounce: 0.15,
    desc: 'Both arms low out to one side, then paint a big arc up over the head and down to the other side as the weight shifts across.',
    keys: [
      [0, { y: -0.06, x: 0.04, hips: 0.03, lean: 10, head: 6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [58, 0, 56, 0], l: at(-1, 0.18, 0.5, 0.2, [0.4, -1, 0]), ...OPEN2 }],
      [1, { y: -0.03, x: 0.02, lean: 6, nod: -6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [138, 0, 140, 0], l: [122, 62, 132, 70], ...OPEN2 }],
      [1.75, { y: -0.01, x: 0, nod: -10, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [160, 0, 166, 0], l: [160, 0, 166, 0], ...OPEN2 }],
      [3, { y: -0.06, x: -0.04, hips: -0.03, lean: -10, head: -6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], l: [58, 0, 56, 0], r: at(1, -0.18, 0.5, 0.2, [0.4, -1, 0]), ...OPEN2 }],
    ],
  }),
  full({
    id: 'swan-arms', name: 'Swan Arms', tags: 'pop aerobic | arms | wave', beats: 2, level: 'low', d: 1, parts: ['arms'], bounce: 0.2,
    desc: 'Arms long out to the sides like wings: lift from the elbows with the wrists trailing, then press down with the wrists curling up, slow and soft.',
    keys: [
      [0, { y: -0.01, nod: -3, shR: 0.3, shL: 0.3, r: [128, 0, 72, -10], l: [128, 0, 72, -10], handR: 0.7, handL: 0.7 }],
      [1, { y: -0.05, nod: 3, r: [58, 0, 112, 10], l: [58, 0, 112, 10], ...OPEN2 }],
    ],
  }),
  full({
    id: 'slow-mo-run', name: 'Slow-Motion Run', tags: 'party pop | full | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], bounce: 0,
    desc: 'Run on the spot in exaggerated slow motion: knee floats up high, opposite arm swings big and slow, the whole body drifting like a movie replay.',
    keys: [
      [0, { y: 0, x: -0.015, lean: -2, nod: -4, rf: [0.08, 0.24, 0.16], lf: [-0.08, 0, 0], r: at(1, 0.12, 0.6, -0.12, [0.2, 0, -1]), l: at(-1, -0.08, 0.92, 0.18, [0.2, -1, 0]), handR: 0, handL: 0 }],
      [1, { y: -0.04, x: -0.01, rf: [0.08, 0.12, 0.08], lf: [-0.08, 0, 0], r: at(1, 0.16, 0.6, 0.04, [0.3, -1, 0]), l: at(-1, -0.16, 0.66, 0.06, [0.3, -1, 0]), handR: 0, handL: 0 }],
      [2, { y: 0, x: 0.015, lean: 2, nod: -4, lf: [-0.08, 0.24, 0.16], rf: [0.08, 0, 0], l: at(-1, -0.12, 0.6, -0.12, [0.2, 0, -1]), r: at(1, 0.08, 0.92, 0.18, [0.2, -1, 0]), handR: 0, handL: 0 }],
      [3, { y: -0.04, x: 0.01, lf: [-0.08, 0.12, 0.08], rf: [0.08, 0, 0], l: at(-1, -0.16, 0.6, 0.04, [0.3, -1, 0]), r: at(1, 0.16, 0.66, 0.06, [0.3, -1, 0]), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'golden-rooster', name: 'Golden Rooster Stands on One Leg', tags: 'aerobic | legs arms |', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true, bounce: 0,
    desc: 'Tai chi balance: float one knee up to hip height as the same-side palm rises to face height, the other palm pressing down beside the hip; hold, then lower.',
    keys: [
      [0, { y: -0.06, x: -0.01, r: at(1, 0.1, 0.56, 0.16, [0.6, -0.8, 0]), l: at(-1, -0.1, 0.56, 0.16, [0.6, -0.8, 0]), ...OPEN2 }],
      [1.5, { y: 0, x: -0.04, hips: -0.02, rf: [0.08, 0.27, 0.2], lf: [-0.07, 0, 0], r: at(1, 0.12, 0.98, 0.16, [0.3, -1, 0]), l: at(-1, -0.2, 0.46, 0.06, [1, 0, -0.3]), ...OPEN2 }],
      [2.75, { y: 0, x: -0.04, hips: -0.02, rf: [0.08, 0.28, 0.2], lf: [-0.07, 0, 0], r: at(1, 0.12, 1.0, 0.16, [0.3, -1, 0]), l: at(-1, -0.21, 0.45, 0.06, [1, 0, -0.3]), ...OPEN2 }],
      [3.5, { y: -0.07, x: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.16, 0.6, 0.14, [0.6, -0.8, 0]), l: at(-1, -0.14, 0.52, 0.12, [0.6, -0.8, 0]), ...OPEN2 }],
    ],
  }),

  // --- Dynamic warm-ups ------------------------------------------------------
  full({
    id: 'elbow-circles', name: 'Elbow Circles', tags: 'aerobic pop | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], bounce: 0.4,
    desc: 'Fingertips on the shoulders, draw big slow circles with the elbows: together in front, up past the ears, open wide and back, and down.',
    keys: [
      [0, { y: -0.03, nod: 4, r: at(1, 0.14, 0.86, 0.03, [-0.2, -0.3, 1]), l: at(-1, -0.14, 0.86, 0.03, [-0.2, -0.3, 1]), handR: 0.5, handL: 0.5 }],
      [1, { y: -0.01, nod: -4, r: at(1, 0.14, 0.86, 0.03, [0.4, 1, 0.3]), l: at(-1, -0.14, 0.86, 0.03, [0.4, 1, 0.3]), handR: 0.5, handL: 0.5 }],
      [2, { y: -0.02, nod: -2, shR: 0.2, shL: 0.2, r: at(1, 0.14, 0.86, 0.03, [1, 0.1, -0.4]), l: at(-1, -0.14, 0.86, 0.03, [1, 0.1, -0.4]), handR: 0.5, handL: 0.5 }],
      [3, { y: -0.04, nod: 2, r: at(1, 0.14, 0.86, 0.03, [0.3, -1, 0]), l: at(-1, -0.14, 0.86, 0.03, [0.3, -1, 0]), handR: 0.5, handL: 0.5 }],
    ],
  }),
  full({
    id: 'torso-twist', name: 'Torso Twist', tags: 'aerobic pop | full | twist', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'], bounce: 0.3,
    desc: 'Feet wide and knees soft, turn the chest from side to side and let the loose arms wrap around the body, one across the front and one behind.',
    keys: [
      [0, TAI(-0.05, { twist: 34, turn: 22, hipTwist: 8, r: at(1, 0.32, 0.6, -0.04, [0.6, -0.3, -0.6]), l: at(-1, 0.1, 0.62, 0.3, [0.3, -1, 0.3]), ...OPEN2 })],
      [1, TAI(-0.05, mir({ twist: 34, turn: 22, hipTwist: 8, r: at(1, 0.32, 0.6, -0.04, [0.6, -0.3, -0.6]), l: at(-1, 0.1, 0.62, 0.3, [0.3, -1, 0.3]), ...OPEN2 }))],
    ],
  }),
  full({
    id: 'knee-circles', name: 'Knee Circles', tags: 'aerobic | legs hips |', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], bounce: 0,
    desc: 'Feet together, hinge a little with the hands on the knees and circle the knees slowly: to one side, down, to the other side and up.',
    keys: [
      [0, { ...KNEES, y: -0.12, x: 0.05, hips: 0.03, tilt: 6, kneeR: 0.15, kneeL: -0.15 }],
      [1, { ...KNEES, y: -0.18, x: 0, bend: 30 }],
      [2, { ...KNEES, y: -0.12, x: -0.05, hips: -0.03, tilt: -6, kneeR: -0.15, kneeL: 0.15 }],
      [3, { ...KNEES, y: -0.07, x: 0, bend: 24 }],
    ],
  }),
  full({
    id: 'side-leg-swing', name: 'Side Leg Swing', tags: 'aerobic | legs | kick', beats: 4, level: 'low', d: 1, parts: ['legs'], mirror: true, bounce: 0,
    desc: 'Hand on the hip and the other arm out for balance, swing one straight leg low out to the side and back across in front of the standing leg, then set it down.',
    keys: [
      [0, { y: -0.03, x: -0.03, lean: -7, hips: -0.02, rf: [0.33, 0.12, 0.02], lf: [-0.08, 0, 0], r: ARM.hip, l: [86, 0, 90, 0], handR: 0, handL: 1 }],
      [1, { y: -0.04, x: -0.02, lean: 3, rf: [-0.07, 0.07, 0.13], lf: [-0.08, 0, 0], r: ARM.hip, l: [80, 0, 86, 0], handR: 0, handL: 1 }],
      [2, { y: -0.03, x: -0.03, lean: -7, hips: -0.02, rf: [0.33, 0.12, 0.02], lf: [-0.08, 0, 0], r: ARM.hip, l: [86, 0, 90, 0], handR: 0, handL: 1 }],
      [3, { y: -0.04, x: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: ARM.hip, l: [40, 0, 50, 10], handR: 0, handL: 1 }],
    ],
  }),
  full({
    id: 'hip-circles', name: 'Hands-on-Hips Circles', tags: 'aerobic latin | hips |', beats: 4, level: 'low', d: 1, parts: ['hips'], bounce: 0,
    desc: 'Feet wide, hands on the hips, draw a big slow circle with the pelvis: out to one side, forward, out to the other side and back.',
    keys: [
      [0, TAI(-0.05, { hips: 0.088, tilt: 12, x: 0.025, lean: -7, head: 3, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 })],
      [1, TAI(-0.07, { hips: 0, x: 0, bend: -7, nod: 4, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 })],
      [2, TAI(-0.05, { hips: -0.088, tilt: -12, x: -0.025, lean: 7, head: -3, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 })],
      [3, TAI(-0.04, { hips: 0, x: 0, bend: 9, nod: -4, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 })],
    ],
  }),

  full({
    id: 'arm-circles', name: 'Arm Circles', tags: 'aerobic pop | arms |', beats: 1, level: 'low', d: 1, parts: ['arms'], bounce: 0.3,
    desc: 'Arms long out to the sides at shoulder height, draw small steady circles with the hands.',
    keys: [
      [0, { y: -0.03, r: [92, 20, 92, 20], l: [92, 20, 92, 20], ...OPEN2 }],
      [0.25, { y: -0.015, r: [110, 0, 110, 0], l: [110, 0, 110, 0], ...OPEN2 }],
      [0.5, { y: -0.03, r: [92, -20, 92, -20], l: [92, -20, 92, -20], ...OPEN2 }],
      [0.75, { y: -0.015, r: [74, 0, 74, 0], l: [74, 0, 74, 0], ...OPEN2 }],
    ],
  }),
  full({
    id: 'sway-clap-overhead', name: 'Slow Sway & Overhead Clap', tags: 'pop aerobic | arms hips | clap', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.3,
    desc: 'Sway the weight to one side with the arms open in a high V, clap overhead on the backbeat, then sway to the other side.',
    keys: [
      [0, { x: 0.03, hips: 0.03, lean: 3, head: -3, y: -0.04, lf: [-0.09, 0.015, 0.01], r: [140, 0, 146, 0], l: [140, 0, 146, 0], ...OPEN2 }],
      [1, { x: 0.01, y: -0.02, r: ARM.clapHigh, l: ARM.clapHigh, ...OPEN2 }],
      [2, mir({ x: 0.03, hips: 0.03, lean: 3, head: -3, y: -0.04, lf: [-0.09, 0.015, 0.01], r: [140, 0, 146, 0], l: [140, 0, 146, 0], ...OPEN2 })],
      [3, { x: -0.01, y: -0.02, r: ARM.clapHigh, l: ARM.clapHigh, ...OPEN2 }],
    ],
  }),

  // --- Cooldown stretches (outro) ---------------------------------------------
  full({
    id: 'triceps-stretch', name: 'Overhead Triceps Stretch', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], mirror: true, cooldown: true, bounce: 0.1,
    desc: 'Reach one arm up, fold the elbow so the hand drops down behind the head between the shoulder blades, other hand on the hip, and lean gently away.',
    keys: [
      [0, { y: -0.02, nod: -4, r: [168, 0, 174, 0], l: [30, 0, 34, 10], ...OPEN2 }],
      [1, { y: -0.03, lean: -4, head: -3, r: at(1, 0.1, 0.97, -0.1, [1, 1, 0]), l: ARM.hip, handR: 1, handL: 0 }],
      [3, { y: -0.04, lean: -7, head: -5, nod: 4, r: at(1, 0.09, 0.96, -0.11, [1, 1, 0]), l: ARM.hip, handR: 1, handL: 0 }],
    ],
  }),
  full({
    id: 'quad-stretch', name: 'Standing Quad Stretch', tags: 'aerobic | legs |', beats: 4, level: 'low', d: 1, parts: ['legs'], mirror: true, cooldown: true, bounce: 0,
    desc: 'Balance on one leg, bend the other knee and hold that ankle behind you, knees side by side, the free arm out for balance.',
    keys: [
      [0, { y: -0.03, x: -0.02, r: [24, 0, 30, 10], l: [40, 0, 44, 0], ...OPEN2 }],
      [1.25, { y: -0.02, x: -0.04, hips: -0.02, rf: [0.09, 0.37, -0.22], lf: [-0.07, 0, 0], kneeR: -0.3, r: at(1, 0.12, 0.42, -0.2, [0.6, 0, -0.6]), l: [96, 0, 98, 0], ...OPEN2 }],
      [2.25, { y: -0.03, x: -0.04, hips: -0.02, rf: [0.09, 0.38, -0.23], lf: [-0.07, 0, 0], kneeR: -0.3, r: at(1, 0.12, 0.41, -0.21, [0.6, 0, -0.6]), l: [100, 0, 102, 0], ...OPEN2 }],
      [3.5, { y: -0.04, x: -0.02, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [24, 0, 30, 10], l: [40, 0, 44, 0], ...OPEN2 }],
    ],
  }),
  full({
    id: 'side-lunge-stretch', name: 'Side Lunge Stretch', tags: 'aerobic | legs |', beats: 4, level: 'low', d: 1, parts: ['legs'], mirror: true, cooldown: true, bounce: 0,
    desc: 'Wide stance, sink slowly into one bent knee with both hands resting on that thigh, the other leg long, and hold the inner-thigh stretch.',
    keys: [
      [0, TAI(-0.04, { rf: [0.22, 0, 0], lf: [-0.22, 0, 0], r: [30, 0, 36, 10], l: [30, 0, 36, 10], ...OPEN2 })],
      [1.5, TAI(-0.15, { x: 0.08, hips: 0.02, bend: 10, nod: -4, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.3, r: at(1, 0.17, 0.42, 0.1, [1, 0, -0.2]), l: at(-1, -0.2, 0.46, 0.08, [1, 0, -0.2]), ...OPEN2 })],
      [3, TAI(-0.17, { x: 0.09, hips: 0.02, bend: 11, nod: -4, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.3, r: at(1, 0.17, 0.41, 0.1, [1, 0, -0.2]), l: at(-1, -0.2, 0.45, 0.08, [1, 0, -0.2]), ...OPEN2 })],
    ],
  }),
  full({
    id: 'rag-doll', name: 'Rag Doll', tags: 'aerobic | full |', beats: 4, level: 'low', d: 1, parts: ['torso', 'arms'], cooldown: true, bounce: 0,
    desc: 'Knees soft, let the head and arms hang and roll down partway like a rag doll, then roll back up one bone at a time.',
    keys: [
      [0, { y: -0.03, nod: 6, r: [14, 0, 20, 20], l: [14, 0, 20, 20], ...OPEN2 }],
      [1.5, { y: -0.11, bend: 57, nod: 16, shR: 0.45, shL: 0.45, r: [61, 100, 63, 100], l: [61, 100, 63, 100], handR: 0.8, handL: 0.8 }],
      [2.5, { y: -0.12, bend: 60, nod: 16, shR: 0.5, shL: 0.5, r: [64, 102, 67, 102], l: [64, 102, 67, 102], handR: 0.8, handL: 0.8 }],
      [3.5, { y: -0.06, bend: 12, nod: 14, r: [20, 40, 24, 40], l: [20, 40, 24, 40], ...OPEN2 }],
    ],
  }),
  full({
    id: 'upper-back-stretch', name: 'Upper Back Stretch', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms', 'torso'], cooldown: true, bounce: 0,
    desc: 'Interlace the fingers in front at chest height, push the palms away and round the upper back, letting the head drop between the arms.',
    keys: [
      [0, { y: -0.03, r: at(1, 0.03, 0.66, 0.2, [1, -0.3, 0]), l: at(-1, -0.03, 0.66, 0.2, [1, -0.3, 0]), ...OPEN2 }],
      [1.5, { y: -0.08, bend: 10, nod: 20, shR: 0.5, shL: 0.5, r: at(1, 0.02, 0.74, 0.3, [1, 0, 0]), l: at(-1, -0.02, 0.74, 0.3, [1, 0, 0]), ...OPEN2 }],
      [3, { y: -0.09, bend: 12, nod: 22, shR: 0.55, shL: 0.55, r: at(1, 0.02, 0.74, 0.31, [1, 0, 0]), l: at(-1, -0.02, 0.74, 0.31, [1, 0, 0]), ...OPEN2 }],
    ],
  }),
  full({
    id: 'shrug-release', name: 'Shrug & Release', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['torso'], cooldown: true, bounce: 0,
    desc: 'Breathe in and squeeze both shoulders right up to the ears, hold, then let them drop with a long sigh.',
    keys: [
      [0, { y: -0.01, nod: -4, shR: 1.25, shL: 1.25, r: [18, 0, 24, 10], l: [18, 0, 24, 10], handR: 0.3, handL: 0.3 }],
      [1.5, { y: 0, nod: -6, shR: 1.3, shL: 1.3, r: [20, 0, 26, 10], l: [20, 0, 26, 10], handR: 0.3, handL: 0.3 }],
      [2, { y: -0.06, nod: 8, shR: 0, shL: 0, r: [8, 0, 14, 20], l: [8, 0, 14, 20], ...OPEN2 }],
      [3, { y: -0.06, nod: 9, head: 4, shR: 0, shL: 0, r: [8, 0, 14, 20], l: [8, 0, 14, 20], ...OPEN2 }],
    ],
  }),
  full({
    id: 'shake-out', name: 'Gentle Shake-Out', tags: 'aerobic party | full | shake hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], cooldown: true, bounce: 0.3,
    desc: 'Let everything go loose: shake out the hands by the sides while one foot at a time gives a little shake.',
    keys: [
      [0, { y: -0.04, x: -0.01, rf: [0.09, 0.05, 0.04], lf: [-0.09, 0, 0], r: [34, 10, 82, 40], l: [22, 0, 30, 15], handR: 1, handL: 1 }],
      [0.25, { y: -0.03, rf: [0.1, 0.03, 0.05], lf: [-0.09, 0, 0], r: [22, 0, 30, 15], l: [34, 10, 82, 40], handR: 1, handL: 1 }],
      [0.5, { y: -0.04, rf: [0.09, 0.05, 0.04], lf: [-0.09, 0, 0], r: [34, 10, 82, 40], l: [22, 0, 30, 15], handR: 1, handL: 1 }],
      [0.75, { y: -0.04, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [22, 0, 30, 15], l: [34, 10, 82, 40], handR: 1, handL: 1 }],
      [1, { y: -0.04, x: 0.01, lf: [-0.09, 0.05, 0.04], rf: [0.09, 0, 0], l: [34, 10, 82, 40], r: [22, 0, 30, 15], handR: 1, handL: 1 }],
      [1.25, { y: -0.03, lf: [-0.1, 0.03, 0.05], rf: [0.09, 0, 0], l: [22, 0, 30, 15], r: [34, 10, 82, 40], handR: 1, handL: 1 }],
      [1.5, { y: -0.04, lf: [-0.09, 0.05, 0.04], rf: [0.09, 0, 0], l: [34, 10, 82, 40], r: [22, 0, 30, 15], handR: 1, handL: 1 }],
      [1.75, { y: -0.04, lf: [-0.09, 0, 0], rf: [0.09, 0, 0], l: [22, 0, 30, 15], r: [34, 10, 82, 40], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'curtain-call', name: 'Curtain Call Bow', tags: 'aerobic pop | full |', beats: 4, level: 'low', d: 1, parts: ['torso', 'arms'], mirror: true, cooldown: true, bounce: 0,
    desc: 'Open the arms to the audience, then take a gracious bow with one hand on the stomach and the other arm sweeping out low, and rise.',
    keys: [
      [0, { y: -0.01, nod: -6, r: [62, 10, 66, 20], l: [62, 10, 66, 20], ...OPEN2 }],
      [1.5, { y: -0.06, bend: 28, nod: 16, rf: [0.09, 0, -0.05], lf: [-0.09, 0, 0.02], r: at(1, -0.02, 0.6, 0.17, [1, -0.3, 0]), l: [52, 0, 54, 0], ...OPEN2 }],
      [2.5, { y: -0.06, bend: 30, nod: 18, rf: [0.09, 0, -0.05], lf: [-0.09, 0, 0.02], r: at(1, -0.02, 0.6, 0.17, [1, -0.3, 0]), l: [50, 0, 52, 0], ...OPEN2 }],
      [3.5, { y: -0.02, bend: 0, nod: -4, r: [40, 10, 46, 20], l: [50, 10, 54, 20], ...OPEN2 }],
    ],
  }),
];
