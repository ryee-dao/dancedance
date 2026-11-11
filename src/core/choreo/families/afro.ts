/**
 * Afro / Caribbean social dance: afrobeats (shaku shaku, azonto, gwara gwara,
 * shoki, zanku, soapy, legwork), amapiano, coupé-décalé / ndombolo / soukous /
 * kuduro, West African class staples, South African gumboot and pantsula,
 * dancehall, soca / carnival and reggae. Individual steps only; the generator
 * composes the sequences.
 *
 * There is no `afro` family: moves are tagged with the closest families
 * (mostly hiphop / latin, some pop / party) and carry the style themes
 * `afro`, `amapiano`, `dancehall`, `soca`, `reggae` so song styles find them.
 * Presentation stays friendly and neutral: no floor work, only shallow dips.
 *
 * Pattern ids added here are prefixed `af` (ids are global across files).
 */

import { ARM, FIST, OPEN, at, mir, wide, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

// Elbow hints: [out, up, fwd] in the arm's own frame.
const E_OUT: readonly [number, number, number] = [1, -0.3, -0.2];
const E_DOWN: readonly [number, number, number] = [0.6, -1, -0.3];
const E_UP: readonly [number, number, number] = [1, 0.3, -0.2];

// --- Afrobeats ------------------------------------------------------------------
// Shaku shaku: wrists crossed low in front, swung to the stepping side, head down.
const shakuA: PoseSpec = {
  y: -0.09, x: 0.035, hips: 0.03, tilt: 3, bend: 10, nod: 10, lean: 3, head: -4,
  rf: [0.19, 0, 0.07], lf: [-0.08, 0, -0.02], kneeR: 0.25,
  r: at(1, 0.1, 0.5, 0.22, E_DOWN), l: at(-1, 0.17, 0.52, 0.2, E_DOWN), handR: 0.6, handL: 0.6,
};
const shakuMid: PoseSpec = {
  y: -0.05, x: 0, hips: 0, tilt: 0, bend: 8, nod: 7, lean: 0, head: 0,
  rf: [0.09, 0.05, 0.02], lf: [-0.09, 0, 0], kneeR: 0.1,
  r: at(1, -0.035, 0.5, 0.23, E_DOWN), l: at(-1, 0.035, 0.52, 0.21, E_DOWN), handR: 0.6, handL: 0.6,
};

// Gwara gwara: the leg rolls out to the side while the same arm rolls over the head.
const gwaraKeys: (readonly [number, PoseSpec])[] = [
  [0, { y: -0.03, x: -0.02, lean: -7, head: 6, rf: [0.17, 0.13, 0.06], lf: [-0.09, 0, 0], kneeR: 0.55, hips: -0.03, tilt: -4, shR: 1.1, r: at(1, 0.08, 1.06, 0.07, E_UP), l: at(-1, -0.27, 0.6, 0.08, E_OUT), handR: 1, handL: 0.6 }],
  [0.5, { y: -0.02, x: -0.01, lean: -3, head: 2, rf: [0.24, 0.17, 0.05], lf: [-0.09, 0, 0], kneeR: 0.6, hips: -0.02, tilt: -2, shR: 0.6, r: at(1, 0.36, 0.98, 0.05, E_UP), l: at(-1, -0.27, 0.6, 0.08, E_OUT), handR: 1, handL: 0.6 }],
  [1, { y: -0.1, x: 0.03, lean: 4, head: -3, rf: [0.2, 0, 0.03], lf: [-0.1, 0, 0], kneeR: 0.2, hips: 0.03, tilt: 3, shR: 0, r: at(1, 0.36, 0.55, 0.08, E_OUT), l: at(-1, -0.2, 0.58, 0.12, E_OUT), handR: 1, handL: 0.6 }],
  [1.5, { y: -0.05, x: 0, lean: 0, head: 0, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.05, hips: 0, tilt: 0, shR: 0.2, r: at(1, 0.2, 0.6, 0.14, E_OUT), l: at(-1, -0.2, 0.6, 0.12, E_OUT), handR: 0.8, handL: 0.6 }],
];

// Shoki: dip low and rise, the shoulders leading forward one at a time, hands low and open.
const shokiA: PoseSpec = wide(-0.13, {
  twist: 20, lean: -3, bend: 8, nod: 6, turn: -8, shR: 1.2, shL: 0,
  hips: -0.02, kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.16, 0.5, 0.25, E_DOWN), l: at(-1, -0.3, 0.52, -0.02, E_OUT), ...OPEN,
});
const shokiUp: PoseSpec = wide(-0.035, {
  twist: 0, lean: 0, bend: 0, nod: -2, turn: 0, shR: 0.3, shL: 0.3, hips: 0, kneeR: 0.03, kneeL: 0.03,
  r: at(1, 0.24, 0.64, 0.14, E_OUT), l: at(-1, -0.24, 0.64, 0.14, E_OUT), ...OPEN,
});

// Azonto knee twist: both knees swing the same way (one in, one out) with the heels,
// fingers pointing down and in front, pumping with the knees.
const azontoA: PoseSpec = wide(-0.1, {
  kneeR: -0.7, kneeL: 0.7, hipTwist: -16, hips: -0.025, tilt: -4, twist: 10, lean: 3, turn: -10,
  r: at(1, -0.06, 0.66, 0.27, E_OUT), l: at(-1, -0.3, 0.6, 0.16, E_OUT), handR: 0, handL: 0, formR: 'point', formL: 'point',
});

// Soapy: hands lather against each other in front of the chest while the knees knock in and out.
const soapA: PoseSpec = {
  y: -0.1, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: -0.35, kneeL: -0.35, bend: 6, nod: 6,
  r: at(1, 0.04, 0.74, 0.22, E_DOWN), l: at(-1, -0.03, 0.66, 0.22, E_DOWN), ...OPEN,
};
const soapB: PoseSpec = {
  y: -0.05, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.25, kneeL: 0.25, bend: 4, nod: 3,
  r: at(1, 0.03, 0.66, 0.22, E_DOWN), l: at(-1, -0.04, 0.74, 0.22, E_DOWN), ...OPEN,
};

export const patterns: PatternSet = { foot: {}, arms: {}, accent: {} };

export const moves: MoveDef[] = [
  // --- Afrobeats -----------------------------------------------------------------
  full({
    id: 'shaku-shaku', name: 'Shaku Shaku', tags: 'hiphop | full | walk afro', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Hunch a little with the head down and the wrists crossed low in front, stepping out on a bent knee and swinging the crossed arms to that side, then the other.',
    keys: [[0, shakuA], [0.5, shakuMid], [1, mir(shakuA)], [1.5, mir(shakuMid)]],
  }),
  full({
    id: 'gwara-gwara', name: 'Gwara Gwara', tags: 'hiphop | full | afro amapiano', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true,
    desc: 'Lift one knee out to the side and roll that leg round as the same arm rolls up over the head and sweeps down, then land wide on it.',
    keys: gwaraKeys,
  }),
  full({
    id: 'shoki', name: 'Shoki', tags: 'hiphop | full | afro', beats: 2, level: 'mid', d: 2, parts: ['torso', 'legs'],
    desc: 'Wide stance, dip low as one shoulder drives forward with the open hand reaching low, rise, then dip with the other shoulder.',
    keys: [[0, shokiA], [0.5, shokiUp], [1, mir(shokiA)], [1.5, shokiUp]],
  }),
  full({
    id: 'azonto-twist', name: 'Azonto Knee Twist', tags: 'hiphop | legs | twist afro', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'],
    desc: 'Knees bent, swivel both knees the same way, one in and one out, both index fingers pointing to that side, then twist the other way.',
    keys: [[0, azontoA], [0.5, mir(azontoA)], [1, azontoA], [1.5, mir(azontoA)]],
  }),
  full({
    id: 'soapy', name: 'Soapy', tags: 'hiphop | full | hands afro', beats: 1, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Rub the hands against each other in front of the chest like lathering soap while the knees knock in and open out on the bounce.',
    keys: [[0, soapA], [0.5, soapB]],
  }),
  full({
    id: 'zanku', name: 'Zanku', tags: 'hiphop | legs | kick jump afro', beats: 1, level: 'high', d: 2, parts: ['legs', 'jump', 'arms'], mirror: true, jump: true,
    desc: 'Hop on one foot and flick the other leg forward and out, one hand up high and the other bent in front; land and switch legs.',
    keys: [
      [0, { y: 0.02, lean: -4, head: 3, rf: [0.16, 0.14, 0.15], lf: [-0.07, 0.03, 0], kneeR: 0.3, r: at(1, 0.2, 1.06, 0.1, E_UP), l: at(-1, -0.16, 0.7, 0.2, E_DOWN), handR: 1, handL: 0.5 }],
      [0.5, { y: -0.08, lean: 0, head: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.08, r: at(1, 0.22, 0.8, 0.14, E_OUT), l: at(-1, -0.2, 0.72, 0.16, E_DOWN), handR: 0.8, handL: 0.5 }],
    ],
  }),

  // --- Dancehall -------------------------------------------------------------------
  full({
    id: 'willie-bounce', name: 'Willie Bounce', tags: 'hiphop | full | dancehall', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'],
    desc: 'Lean back a little and bounce from foot to foot, the arms swinging loose and low in opposition, one forward and one back, like a cool bouncy walk on the spot.',
    keys: [
      [0, { y: -0.03, x: 0.04, hips: 0.035, tilt: 5, bend: -9, nod: -6, head: -4, rf: [0.13, 0, 0.03], lf: [-0.07, 0.07, 0.03], kneeL: 0.15, r: at(1, 0.13, 0.56, 0.27, E_DOWN), l: at(-1, -0.22, 0.52, -0.13, [0.3, 0.3, -1]), handR: 0.7, handL: 0.7 }],
      [0.5, { y: -0.1, x: 0.01, hips: 0.01, tilt: 1, bend: -5, nod: -2, head: 0, rf: [0.11, 0, 0.02], lf: [-0.08, 0, 0.02], kneeL: 0.05, r: at(1, 0.2, 0.52, 0.12, E_DOWN), l: at(-1, -0.2, 0.52, 0.06, E_DOWN), handR: 0.7, handL: 0.7 }],
      [1, { y: -0.03, x: -0.04, hips: -0.035, tilt: -5, bend: -9, nod: -6, head: 4, lf: [-0.13, 0, 0.03], rf: [0.07, 0.07, 0.03], kneeR: 0.15, l: at(-1, -0.13, 0.56, 0.27, E_DOWN), r: at(1, 0.22, 0.52, -0.13, [0.3, 0.3, -1]), handR: 0.7, handL: 0.7 }],
      [1.5, { y: -0.1, x: -0.01, hips: -0.01, tilt: -1, bend: -5, nod: -2, head: 0, lf: [-0.11, 0, 0.02], rf: [0.08, 0, 0.02], kneeR: 0.05, r: at(1, 0.2, 0.52, 0.06, E_DOWN), l: at(-1, -0.2, 0.52, 0.12, E_DOWN), handR: 0.7, handL: 0.7 }],
    ],
  }),
  full({
    id: 'bogle', name: 'Bogle', tags: 'hiphop | full | wave dancehall', beats: 2, level: 'mid', d: 2, parts: ['torso', 'arms', 'hips'],
    desc: 'Knees soft, roll the body in a wave from chest to hips while both arms circle forward and down in front like paddling, rocking side to side with it.',
    keys: [
      [0, wide(-0.05, { bend: -8, nod: -8, chestX: 0.03, hips: 0.02, x: 0.02, r: at(1, 0.26, 0.98, 0.12, E_UP), l: at(-1, -0.12, 0.88, 0.2, E_UP), ...OPEN })],
      [0.5, wide(-0.1, { bend: 12, nod: 8, chestX: 0.04, hips: 0.035, tilt: 4, x: 0.03, r: at(1, 0.24, 0.66, 0.29, E_DOWN), l: at(-1, -0.12, 0.6, 0.25, E_DOWN), ...OPEN })],
      [1, wide(-0.05, { bend: -8, nod: -8, chestX: -0.03, hips: -0.02, x: -0.02, l: at(-1, -0.26, 0.98, 0.12, E_UP), r: at(1, 0.12, 0.88, 0.2, E_UP), ...OPEN })],
      [1.5, wide(-0.1, { bend: 12, nod: 8, chestX: -0.04, hips: -0.035, tilt: -4, x: -0.03, l: at(-1, -0.24, 0.66, 0.29, E_DOWN), r: at(1, 0.12, 0.6, 0.25, E_DOWN), ...OPEN })],
    ],
  }),
  full({
    id: 'signal-di-plane', name: 'Signal di Plane', tags: 'hiphop pop | arms | wave dancehall', beats: 2, level: 'mid', d: 1, parts: ['arms', 'hips'],
    desc: 'Bounce on the knees with both open hands high, swinging them together from one side overhead to the other like waving down a plane.',
    keys: [
      [0, { y: -0.07, x: 0.025, hips: 0.03, tilt: 3, lean: 9, head: -6, turn: 12, r: at(1, 0.4, 0.98, 0.1, E_OUT), l: at(-1, -0.1, 1.1, 0.12, E_OUT), ...OPEN }],
      [0.5, { y: -0.02, x: 0, hips: 0, tilt: 0, lean: 0, head: 0, turn: 0, r: at(1, 0.2, 1.05, 0.14, E_OUT), l: at(-1, -0.2, 1.05, 0.14, E_OUT), ...OPEN }],
      [1, { y: -0.07, x: -0.025, hips: -0.03, tilt: -3, lean: -9, head: 6, turn: -12, l: at(-1, -0.4, 0.98, 0.1, E_OUT), r: at(1, 0.1, 1.1, 0.12, E_OUT), ...OPEN }],
      [1.5, { y: -0.02, x: 0, hips: 0, tilt: 0, lean: 0, head: 0, turn: 0, r: at(1, 0.2, 1.05, 0.14, E_OUT), l: at(-1, -0.2, 1.05, 0.14, E_OUT), ...OPEN }],
    ],
  }),
  full({
    id: 'thunder-clap', name: 'Thunder Clap', tags: 'hiphop rock | full | clap stomp jump dancehall', beats: 2, level: 'high', d: 2, parts: ['arms', 'legs', 'jump'], jump: true, impact: true,
    desc: 'Spring up and clap high overhead, then land in a wide stomp with both arms flung down and out like a thunderbolt.',
    keys: [
      [0, { y: 0.04, rf: [0.08, 0.03, 0], lf: [-0.08, 0.03, 0], nod: -8, r: at(1, 0.015, 1.12, 0.1, E_UP), l: at(-1, -0.015, 1.12, 0.1, E_UP), ...OPEN }],
      [1, wide(-0.15, { kneeR: 0.2, kneeL: 0.2, bend: 8, nod: 8, r: at(1, 0.38, 0.5, 0.12, E_OUT), l: at(-1, -0.38, 0.5, 0.12, E_OUT), ...OPEN })],
      [1.5, wide(-0.08, { kneeR: 0.08, kneeL: 0.08, bend: 3, nod: 2, r: at(1, 0.2, 0.7, 0.16, E_DOWN), l: at(-1, -0.2, 0.7, 0.16, E_DOWN), handR: 0.6, handL: 0.6 })],
    ],
  }),
  full({
    id: 'tek-weh-yuhself', name: 'Tek Weh Yuhself', tags: 'hiphop | full | walk dancehall', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.12,
    desc: 'Step out to the side and drag the other foot in, both palms brushing away toward the step with the head turned the other way, as if waving someone off.',
    keys: [
      [0, { x: 0.07, y: -0.1, hips: 0.03, tilt: 3, lean: -5, turn: -24, head: 4, rf: [0.24, 0, 0.02], lf: [-0.04, 0, 0], kneeR: 0.2, r: at(1, 0.42, 0.78, 0.14, E_OUT), l: at(-1, 0.16, 0.76, 0.22, E_DOWN), ...OPEN }],
      [0.5, { x: 0.1, y: -0.06, hips: 0.01, lean: -2, turn: -14, rf: [0.24, 0, 0.02], lf: [0.0, 0, 0], slideL: true, r: at(1, 0.34, 0.64, 0.14, E_OUT), l: at(-1, 0.08, 0.66, 0.2, E_DOWN), ...OPEN }],
      [1, { x: 0.12, y: -0.04, hips: 0, lean: 0, turn: 0, head: 0, rf: [0.21, 0, 0], lf: [0.03, 0, 0], r: at(1, 0.22, 0.6, 0.14, E_DOWN), l: at(-1, -0.04, 0.6, 0.18, E_DOWN), handR: 0.7, handL: 0.7 }],
    ],
  }),
  full({
    id: 'gully-creepa', name: 'Gully Creepa', tags: 'hiphop | legs | walk dancehall', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Crouch a little with the elbows bent and shoulders hunched, and creep with small bouncy steps, one foot then the other, the hands paddling low in front.',
    keys: [
      [0, { y: -0.15, bend: 12, nod: 6, shR: 0.7, shL: 0.7, rf: [0.12, 0, 0.07], lf: [-0.11, 0.06, -0.02], kneeR: 0.2, kneeL: 0.1, hips: 0.02, r: at(1, 0.18, 0.56, 0.24, E_OUT), l: at(-1, -0.14, 0.62, 0.2, E_OUT), handR: 0.6, handL: 0.6 }],
      [0.5, { y: -0.12, bend: 10, nod: 4, shR: 0.4, shL: 0.4, rf: [0.12, 0, 0.04], lf: [-0.11, 0, 0.0], kneeR: 0.15, kneeL: 0.15, hips: 0, r: at(1, 0.16, 0.6, 0.2, E_OUT), l: at(-1, -0.16, 0.6, 0.2, E_OUT), handR: 0.6, handL: 0.6 }],
      [1, { y: -0.15, bend: 12, nod: 6, shR: 0.7, shL: 0.7, lf: [-0.12, 0, 0.07], rf: [0.11, 0.06, -0.02], kneeL: 0.2, kneeR: 0.1, hips: -0.02, l: at(-1, -0.18, 0.56, 0.24, E_OUT), r: at(1, 0.14, 0.62, 0.2, E_OUT), handR: 0.6, handL: 0.6 }],
      [1.5, { y: -0.12, bend: 10, nod: 4, shR: 0.4, shL: 0.4, rf: [0.11, 0, 0.0], lf: [-0.12, 0, 0.04], kneeR: 0.15, kneeL: 0.15, hips: 0, r: at(1, 0.16, 0.6, 0.2, E_OUT), l: at(-1, -0.16, 0.6, 0.2, E_OUT), handR: 0.6, handL: 0.6 }],
    ],
  }),
  full({
    id: 'log-on', name: 'Log On', tags: 'hiphop | legs | stomp twist dancehall', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Lift one knee, press the foot down beside you and grind it on the ball of the foot, heel swivelling in and out, fists twisting the same way at the chest.',
    keys: [
      [0, { y: -0.03, lean: -4, rf: [0.13, 0.17, 0.06], lf: [-0.09, 0, 0], kneeR: 0.35, hips: -0.03, tilt: -4, r: at(1, 0.24, 0.72, 0.18, E_OUT), l: at(-1, -0.2, 0.72, 0.18, E_OUT), ...FIST }],
      [0.5, { y: -0.1, lean: 3, rf: [0.16, 0, 0.04], lf: [-0.09, 0, 0], kneeR: -0.6, hips: 0.03, tilt: 3, hipTwist: -10, twist: -10, r: at(1, 0.12, 0.66, 0.22, E_OUT), l: at(-1, -0.28, 0.66, 0.14, E_OUT), ...FIST }],
      [1, { y: -0.08, lean: 2, rf: [0.16, 0, 0.04], lf: [-0.09, 0, 0], kneeR: 0.6, hips: 0.02, tilt: 2, hipTwist: 10, twist: 10, r: at(1, 0.3, 0.66, 0.14, E_OUT), l: at(-1, -0.12, 0.66, 0.22, E_OUT), ...FIST }],
      [1.5, { y: -0.1, lean: 3, rf: [0.16, 0, 0.04], lf: [-0.09, 0, 0], kneeR: -0.6, hips: 0.03, tilt: 3, hipTwist: -10, twist: -10, r: at(1, 0.12, 0.66, 0.22, E_OUT), l: at(-1, -0.28, 0.66, 0.14, E_OUT), ...FIST }],
    ],
  }),
  full({
    id: 'pon-di-river', name: 'Pon di River', tags: 'hiphop party | full | jump dancehall', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms', 'jump'], jump: true,
    desc: 'Feet together, hop forward into the river with both arms swinging up in front, then hop back onto the bank with the arms swinging down and back.',
    keys: [
      [0, { y: -0.06, rf: [0.07, 0, 0.1], lf: [-0.07, 0, 0.1], bend: 8, nod: -6, r: at(1, 0.16, 0.98, 0.24, E_UP), l: at(-1, -0.16, 0.98, 0.24, E_UP), ...OPEN }],
      [0.5, { y: 0.03, rf: [0.07, 0.03, 0.02], lf: [-0.07, 0.03, 0.02], bend: 2, nod: 0, r: at(1, 0.22, 0.75, 0.16, E_OUT), l: at(-1, -0.22, 0.75, 0.16, E_OUT), ...OPEN }],
      [1, { y: -0.1, rf: [0.07, 0, -0.08], lf: [-0.07, 0, -0.08], bend: 14, nod: 8, r: at(1, 0.26, 0.48, -0.12, [0.3, 0.3, -1]), l: at(-1, -0.26, 0.48, -0.12, [0.3, 0.3, -1]), ...OPEN }],
      [1.5, { y: 0.03, rf: [0.07, 0.03, 0.02], lf: [-0.07, 0.03, 0.02], bend: 2, nod: 0, r: at(1, 0.22, 0.6, 0.1, E_OUT), l: at(-1, -0.22, 0.6, 0.1, E_OUT), ...OPEN }],
    ],
  }),
  full({
    id: 'wacky-dip', name: 'Wacky Dip', tags: 'hiphop party | legs | dancehall', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Dip a little with the knees knocking in and the hands flapping down by the knees, then pop up on one leg with that knee lifted out and the arms flung loose.',
    keys: [
      [0, { y: -0.14, rf: [0.12, 0, 0.02], lf: [-0.12, 0, 0.02], kneeR: -0.45, kneeL: -0.45, bend: 12, nod: 8, r: at(1, 0.16, 0.42, 0.2, E_OUT), l: at(-1, -0.16, 0.42, 0.2, E_OUT), ...OPEN }],
      [1, { y: -0.03, rf: [0.17, 0.15, 0.05], lf: [-0.09, 0, 0], kneeR: 0.55, lean: -6, head: 5, bend: 0, nod: -4, hips: -0.03, tilt: -4, r: at(1, 0.38, 0.72, 0.08, E_OUT), l: at(-1, -0.34, 0.88, 0.06, E_OUT), ...OPEN }],
    ],
  }),

  // --- Reggae ----------------------------------------------------------------------
  full({
    id: 'reggae-skank', name: 'Reggae Skank', tags: 'hiphop pop | full | reggae', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'Half-time and relaxed: rock onto one foot with a soft knee as the loose fists swing across the body the other way, bob the head, then rock to the other foot.',
    keys: [
      [0, { y: -0.08, x: 0.035, hips: 0.03, tilt: 3, twist: -10, nod: 8, rf: [0.11, 0, 0.03], lf: [-0.09, 0.05, -0.02], kneeL: 0.1, r: at(1, -0.02, 0.62, 0.22, E_DOWN), l: at(-1, -0.3, 0.58, 0.02, E_OUT), handR: 0.3, handL: 0.3 }],
      [1, { y: -0.03, x: 0.02, hips: 0.015, tilt: 1, twist: -4, nod: -2, rf: [0.11, 0, 0.03], lf: [-0.09, 0, -0.01], r: at(1, 0.12, 0.6, 0.16, E_DOWN), l: at(-1, -0.2, 0.6, 0.1, E_OUT), handR: 0.3, handL: 0.3 }],
      [2, { y: -0.08, x: -0.035, hips: -0.03, tilt: -3, twist: 10, nod: 8, lf: [-0.11, 0, 0.03], rf: [0.09, 0.05, -0.02], kneeR: 0.1, l: at(-1, 0.02, 0.62, 0.22, E_DOWN), r: at(1, 0.3, 0.58, 0.02, E_OUT), handR: 0.3, handL: 0.3 }],
      [3, { y: -0.03, x: -0.02, hips: -0.015, tilt: -1, twist: 4, nod: -2, lf: [-0.11, 0, 0.03], rf: [0.09, 0, -0.01], l: at(-1, -0.12, 0.6, 0.16, E_DOWN), r: at(1, 0.2, 0.6, 0.1, E_OUT), handR: 0.3, handL: 0.3 }],
    ],
  }),
  // --- Soca / carnival -------------------------------------------------------------
  full({
    id: 'jump-and-wave', name: 'Jump & Wave', tags: 'party latin | full | jump wave soca', beats: 2, level: 'high', d: 2, parts: ['jump', 'arms'], jump: true,
    desc: 'Jump on every beat, one hand waving a rag high overhead from side to side and the other fist on the hip.',
    keys: [
      [0, { y: 0.05, rf: [0.09, 0.04, 0], lf: [-0.09, 0.04, 0], lean: 5, head: -4, r: at(1, 0.34, 1.08, 0.08, E_UP), l: ARM.hip, handR: 1, handL: 0 }],
      [0.5, { y: -0.09, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.1, kneeL: 0.1, lean: 0, head: 0, r: at(1, 0.16, 1.12, 0.1, E_UP), l: ARM.hip, handR: 1, handL: 0 }],
      [1, { y: 0.05, rf: [0.09, 0.04, 0], lf: [-0.09, 0.04, 0], lean: -4, head: 4, r: at(1, 0.07, 1.12, 0.12, E_OUT), l: ARM.hip, handR: 1, handL: 0 }],
      [1.5, { y: -0.09, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.1, kneeL: 0.1, lean: 0, head: 0, r: at(1, 0.16, 1.12, 0.1, E_UP), l: ARM.hip, handR: 1, handL: 0 }],
    ],
  }),
  full({
    id: 'wine-and-wave', name: 'Wine & Wave', tags: 'latin party | hips arms | hips wave soca', beats: 2, level: 'mid', d: 2, parts: ['hips', 'arms'],
    desc: 'Feet wide and knees soft, circle the hips round while one hand twirls a rag in circles out to the side at shoulder height and the other hand rests on the hip.',
    keys: [
      [0, wide(-0.07, { hips: 0.08, tilt: 9, head: -4, r: at(1, 0.42, 0.9, 0.08, E_OUT), l: ARM.hip, handR: 0.3, handL: 0 })],
      [0.5, wide(-0.04, { hips: 0, bend: 7, nod: 4, r: at(1, 0.48, 0.8, 0.0, E_OUT), l: ARM.hip, handR: 0.3, handL: 0 })],
      [1, wide(-0.07, { hips: -0.08, tilt: -9, head: 4, r: at(1, 0.42, 0.7, 0.08, E_OUT), l: ARM.hip, handR: 0.3, handL: 0 })],
      [1.5, wide(-0.08, { hips: 0, bend: -5, nod: -3, kneeR: 0.12, kneeL: 0.12, r: at(1, 0.36, 0.8, 0.16, E_OUT), l: ARM.hip, handR: 0.3, handL: 0 })],
    ],
  }),
  full({
    id: 'palance', name: 'Palance', tags: 'party latin | legs | jump soca', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump', 'arms'], mirror: true, travel: 0.24, jump: true,
    desc: 'Gallop sideways: step out, hop the other foot in to chase it, step out again and close, both hands up and waving to the music.',
    keys: [
      [0, { x: 0.08, y: -0.07, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], lean: -4, head: 3, r: at(1, 0.3, 1.04, 0.08, E_UP), l: at(-1, -0.26, 1.06, 0.08, E_UP), ...OPEN }],
      [0.5, { x: 0.14, y: 0.04, rf: [0.24, 0.05, 0], lf: [0.07, 0.04, 0], lean: -2, head: 2, r: at(1, 0.24, 1.1, 0.08, E_UP), l: at(-1, -0.3, 1.02, 0.08, E_UP), ...OPEN }],
      [1, { x: 0.2, y: -0.07, rf: [0.33, 0, 0], lf: [0.1, 0, 0], lean: -4, head: 3, r: at(1, 0.3, 1.04, 0.08, E_UP), l: at(-1, -0.26, 1.06, 0.08, E_UP), ...OPEN }],
      [1.5, { x: 0.24, y: -0.03, rf: [0.33, 0, 0], lf: [0.15, 0.02, 0], lean: 0, head: 0, r: at(1, 0.24, 1.1, 0.08, E_UP), l: at(-1, -0.3, 1.02, 0.08, E_UP), ...OPEN }],
    ],
  }),
  full({
    id: 'bacchanal-jump', name: 'Bacchanal Jump & Turn', tags: 'party latin | full turn | jump spin soca', beats: 4, level: 'high', d: 3, parts: ['jump', 'turn', 'arms'], jump: true,
    desc: 'Jump on every beat with both hands up, turning a quarter each time to face all four sides and come back to the front.',
    keys: [0, 1, 2, 3].flatMap((b): (readonly [number, PoseSpec])[] => [
      [b, { spin: b * 90, y: -0.08, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.24, 1.06, 0.08, E_UP), l: at(-1, -0.24, 1.06, 0.08, E_UP), ...OPEN }],
      [b + 0.5, { spin: b * 90 + 45, y: 0.05, rf: [0.06, 0.04, 0], lf: [-0.06, 0.04, 0], r: at(1, 0.3, 1.12, 0.06, E_UP), l: at(-1, -0.3, 1.12, 0.06, E_UP), ...OPEN }],
    ]),
  }),
  // --- Amapiano and South African ---------------------------------------------------
  full({
    id: 'pouncing-cat', name: 'Pouncing Cat', tags: 'hiphop | full | amapiano', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'],
    desc: 'Crouch a little with the shoulders hunched and fists up as paws, shift from foot to foot on the beat while the shoulders work back and forth and one paw pounces forward and down.',
    keys: [
      [0, { y: -0.13, x: 0.03, hips: 0.025, tilt: 3, bend: 10, nod: 4, twist: -14, shR: 1.1, shL: 0.3, rf: [0.16, 0, 0.03], lf: [-0.09, 0.03, 0], kneeR: 0.15, r: at(1, 0.1, 0.6, 0.29, E_OUT), l: at(-1, -0.12, 0.76, 0.17, E_DOWN), ...FIST }],
      [0.5, { y: -0.1, x: 0, hips: 0, tilt: 0, bend: 8, nod: 2, twist: 0, shR: 0.6, shL: 0.6, rf: [0.12, 0, 0.02], lf: [-0.12, 0, 0.02], kneeR: 0.1, r: at(1, 0.11, 0.74, 0.18, E_DOWN), l: at(-1, -0.11, 0.74, 0.18, E_DOWN), ...FIST }],
      [1, { y: -0.13, x: -0.03, hips: -0.025, tilt: -3, bend: 10, nod: 4, twist: 14, shL: 1.1, shR: 0.3, lf: [-0.16, 0, 0.03], rf: [0.09, 0.03, 0], kneeL: 0.15, l: at(-1, -0.1, 0.6, 0.29, E_OUT), r: at(1, 0.12, 0.76, 0.17, E_DOWN), ...FIST }],
      [1.5, { y: -0.1, x: 0, hips: 0, tilt: 0, bend: 8, nod: 2, twist: 0, shR: 0.6, shL: 0.6, rf: [0.12, 0, 0.02], lf: [-0.12, 0, 0.02], kneeL: 0.1, r: at(1, 0.11, 0.74, 0.18, E_DOWN), l: at(-1, -0.11, 0.74, 0.18, E_DOWN), ...FIST }],
    ],
  }),
  full({
    id: 'vosho', name: 'Vosho', tags: 'hiphop | legs | amapiano', beats: 2, level: 'mid', d: 2, parts: ['legs'], impact: true,
    desc: 'Drop suddenly into a short squat with the knees out and hands to the knees, hold it a moment, then pop straight back up tall with the arms flicking open.',
    keys: [
      [0, wide(-0.2, { rf: [0.15, 0, 0.02], lf: [-0.15, 0, 0.02], kneeR: 0.3, kneeL: 0.3, bend: 16, nod: 4, r: at(1, 0.16, 0.42, 0.17, E_OUT), l: at(-1, -0.16, 0.42, 0.17, E_OUT), ...OPEN })],
      [0.5, wide(-0.19, { rf: [0.15, 0, 0.02], lf: [-0.15, 0, 0.02], kneeR: 0.3, kneeL: 0.3, bend: 14, nod: 2, r: at(1, 0.17, 0.43, 0.17, E_OUT), l: at(-1, -0.17, 0.43, 0.17, E_OUT), ...OPEN })],
      [1, { y: 0, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], bend: -4, nod: -6, r: at(1, 0.38, 0.62, 0.06, E_OUT), l: at(-1, -0.38, 0.62, 0.06, E_OUT), ...OPEN }],
      [1.5, { y: -0.04, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], bend: 0, nod: 0, r: at(1, 0.24, 0.58, 0.1, E_OUT), l: at(-1, -0.24, 0.58, 0.1, E_OUT), handR: 0.7, handL: 0.7 }],
    ],
  }),
  full({
    id: 'indlamu-stomp', name: 'Indlamu Stomp', tags: 'rock party | legs | stomp kick afro', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Shield fist held in front and stick hand raised, lift one knee high and stamp it down hard into a wide bent stance as the stick hand strikes down.',
    keys: [
      [0, { y: -0.02, lean: -5, head: 3, rf: [0.13, 0.3, 0.12], lf: [-0.09, 0, 0], kneeR: 0.25, hips: -0.03, tilt: -4, r: at(1, 0.3, 1.02, 0.04, E_UP), l: at(-1, -0.08, 0.72, 0.24, E_DOWN), ...FIST }],
      [1, wide(-0.15, { rf: [0.17, 0, 0.03], kneeR: 0.2, kneeL: 0.2, bend: 10, nod: 6, r: at(1, 0.2, 0.62, 0.24, E_OUT), l: at(-1, -0.1, 0.7, 0.24, E_DOWN), ...FIST })],
      [1.5, wide(-0.09, { rf: [0.15, 0, 0.02], kneeR: 0.1, kneeL: 0.1, bend: 4, nod: 2, r: at(1, 0.26, 0.8, 0.12, E_OUT), l: at(-1, -0.1, 0.72, 0.24, E_DOWN), ...FIST })],
    ],
  }),
  full({
    id: 'gumboot-slap', name: 'Gumboot Slap', tags: 'party rock | full | stomp hands afro', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Lift one knee and slap the side of that boot with both hands, stamp it down slapping both thighs, then the other leg.',
    keys: [
      [0, { y: -0.05, bend: 14, nod: 8, lean: -3, rf: [0.12, 0.2, 0.1], lf: [-0.09, 0, 0], kneeR: 0.2, r: at(1, 0.2, 0.38, 0.17, E_OUT), l: at(-1, 0.06, 0.38, 0.2, E_OUT), ...OPEN }],
      [0.5, { y: -0.11, bend: 10, nod: 5, lean: 0, rf: [0.12, 0, 0.02], lf: [-0.12, 0, 0.02], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.15, 0.46, 0.12, E_OUT), l: at(-1, -0.15, 0.46, 0.12, E_OUT), ...OPEN }],
      [1, { y: -0.05, bend: 14, nod: 8, lean: 3, lf: [-0.12, 0.2, 0.1], rf: [0.09, 0, 0], kneeL: 0.2, l: at(-1, -0.2, 0.38, 0.17, E_OUT), r: at(1, -0.06, 0.38, 0.2, E_OUT), ...OPEN }],
      [1.5, { y: -0.11, bend: 10, nod: 5, lean: 0, rf: [0.12, 0, 0.02], lf: [-0.12, 0, 0.02], kneeL: 0.1, kneeR: 0.1, r: at(1, 0.15, 0.46, 0.12, E_OUT), l: at(-1, -0.15, 0.46, 0.12, E_OUT), ...OPEN }],
    ],
  }),
  // --- Coupé-décalé, ndombolo, kuduro -------------------------------------------------
  full({
    id: 'spray-money', name: 'Spray the Money', tags: 'party hiphop | arms | hands afro', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'Hold a stack of notes in one hand in front of the chest and flick them off into the air with the other hand, up and out, twice per beat, bouncing side to side.',
    keys: [
      [0, { y: -0.07, x: 0.02, hips: 0.025, tilt: 3, turn: 10, r: at(1, 0.02, 0.76, 0.27, E_DOWN), l: at(-1, -0.04, 0.74, 0.25, E_DOWN), handR: 0.3, handL: 0.2 }],
      [0.5, { y: -0.03, x: 0.02, hips: 0.02, tilt: 2, turn: 14, r: at(1, 0.3, 0.98, 0.16, E_UP), l: at(-1, -0.04, 0.74, 0.25, E_DOWN), handR: 1, handL: 0.2 }],
      [1, { y: -0.07, x: -0.02, hips: -0.025, tilt: -3, turn: 6, r: at(1, 0.02, 0.76, 0.27, E_DOWN), l: at(-1, -0.04, 0.74, 0.25, E_DOWN), handR: 0.3, handL: 0.2 }],
      [1.5, { y: -0.03, x: -0.02, hips: -0.02, tilt: -2, turn: 12, r: at(1, 0.34, 0.92, 0.18, E_UP), l: at(-1, -0.04, 0.74, 0.25, E_DOWN), handR: 1, handL: 0.2 }],
    ],
  }),
  full({
    id: 'ndombolo', name: 'Ndombolo', tags: 'latin hiphop | hips | hips shake afro', beats: 2, level: 'mid', d: 2, parts: ['hips', 'arms'],
    desc: 'Knees bent and chest still, roll the hips round from side to side while the elbows lift out and the forearms swing loosely the opposite way in front of the chest.',
    keys: [
      [0, wide(-0.1, { hips: 0.07, tilt: 8, hipTwist: 10, chestX: -0.03, kneeL: -0.2, kneeR: 0.15, r: at(1, 0.06, 0.72, 0.2, E_OUT), l: at(-1, -0.32, 0.72, 0.12, E_OUT), handR: 0.7, handL: 0.7 })],
      [0.5, wide(-0.12, { hips: 0, tilt: 0, hipTwist: 0, bend: 4, chestX: 0, kneeL: 0.1, kneeR: 0.1, r: at(1, 0.2, 0.7, 0.2, E_OUT), l: at(-1, -0.2, 0.7, 0.2, E_OUT), handR: 0.7, handL: 0.7 })],
      [1, wide(-0.1, { hips: -0.07, tilt: -8, hipTwist: -10, chestX: 0.03, kneeR: -0.2, kneeL: 0.15, l: at(-1, -0.06, 0.72, 0.2, E_OUT), r: at(1, 0.32, 0.72, 0.12, E_OUT), handR: 0.7, handL: 0.7 })],
      [1.5, wide(-0.12, { hips: 0, tilt: 0, hipTwist: 0, bend: 4, chestX: 0, kneeL: 0.1, kneeR: 0.1, r: at(1, 0.2, 0.7, 0.2, E_OUT), l: at(-1, -0.2, 0.7, 0.2, E_OUT), handR: 0.7, handL: 0.7 })],
    ],
  }),
  full({
    id: 'kuduro-stomp', name: 'Kuduro Stomp', tags: 'hiphop rock | legs | stomp kick afro', beats: 1, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Flick one stiff leg out to the side with the elbows jerked up and out, then stamp it down wide as the fists punch down, sharp and angular.',
    keys: [
      [0, { y: -0.03, lean: -8, head: 5, hips: -0.03, tilt: -5, rf: [0.27, 0.1, 0.02], lf: [-0.09, 0, 0], kneeR: 0.1, r: at(1, 0.3, 0.86, 0.04, E_UP), l: at(-1, -0.3, 0.86, 0.04, E_UP), ...FIST }],
      [0.5, wide(-0.13, { lean: 3, head: -2, rf: [0.17, 0, 0.02], kneeR: 0.15, kneeL: 0.15, bend: 6, r: at(1, 0.2, 0.5, 0.14, E_OUT), l: at(-1, -0.2, 0.5, 0.14, E_OUT), ...FIST })],
    ],
  }),

  // --- West African class staples ----------------------------------------------------
  full({
    id: 'lamban-swing', name: 'Lamban Arm Swing', tags: 'aerobic party | full | stomp afro', beats: 2, level: 'high', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true, impact: true,
    desc: 'Stamp forward onto one foot and swing both arms up high with the chest lifted, then bend forward over the knees as the arms swing down past the legs and back.',
    keys: [
      [0, { y: -0.05, bend: -8, nod: -10, rf: [0.11, 0, 0.12], lf: [-0.09, 0.02, -0.04], kneeR: 0.1, r: at(1, 0.3, 1.06, 0.12, E_UP), l: at(-1, -0.3, 1.06, 0.12, E_UP), ...OPEN }],
      [1, { y: -0.13, bend: 24, nod: 8, rf: [0.11, 0, 0.12], lf: [-0.09, 0, -0.04], kneeR: 0.12, kneeL: 0.08, r: at(1, 0.22, 0.42, -0.02, E_OUT), l: at(-1, -0.22, 0.42, -0.02, E_OUT), ...OPEN }],
    ],
  }),
  full({
    id: 'harvest-scoop', name: 'Harvest Scoop', tags: 'party aerobic | full | afro', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso', 'legs'], mirror: true,
    desc: 'Lunge to one side and scoop both hands low beside that knee, then rise tall and lift it up high above the head with both hands.',
    keys: [
      [0, { y: -0.14, x: 0.05, lean: 10, bend: 10, nod: 6, head: 6, hips: -0.02, rf: [0.24, 0, 0.03], lf: [-0.09, 0, 0], kneeR: 0.2, r: at(1, 0.34, 0.42, 0.14, E_OUT), l: at(-1, 0.18, 0.44, 0.22, E_DOWN), ...OPEN }],
      [1, { y: -0.02, x: 0.01, lean: -4, bend: -4, nod: -10, head: -3, hips: 0.01, rf: [0.15, 0, 0.02], lf: [-0.1, 0, 0], kneeR: 0, r: at(1, 0.2, 1.08, 0.1, E_UP), l: at(-1, -0.2, 1.08, 0.1, E_UP), handR: 0.7, handL: 0.7 }],
    ],
  }),

  // --- More afrobeats ------------------------------------------------------------------
  full({
    id: 'afro-groove', name: 'Afro Groove', tags: 'hiphop pop | full | afro', beats: 2, level: 'low', d: 1, parts: ['hips', 'torso'],
    desc: 'Sink into one hip with the other knee bent in, roll that shoulder back and let the arms hang loose and bent, then switch on the next beat: a laid-back afrobeats rock.',
    keys: [
      [0, { y: -0.08, x: 0.035, hips: 0.06, tilt: 7, lean: -4, head: 5, nod: 4, shR: 1, shL: 0.1, rf: [0.12, 0, 0], lf: [-0.1, 0.03, 0.03], kneeL: -0.4, r: at(1, 0.24, 0.52, 0.1, E_OUT), l: at(-1, -0.12, 0.58, 0.2, E_DOWN), handR: 0.6, handL: 0.6 }],
      [0.5, { y: -0.05, x: 0.015, hips: 0.025, tilt: 2, lean: -1, head: 2, nod: 0, shR: 0.4, shL: 0.2, rf: [0.12, 0, 0], lf: [-0.1, 0, 0.01], kneeL: -0.1, r: at(1, 0.22, 0.56, 0.12, E_OUT), l: at(-1, -0.16, 0.58, 0.16, E_DOWN), handR: 0.6, handL: 0.6 }],
      [1, { y: -0.08, x: -0.035, hips: -0.06, tilt: -7, lean: 4, head: -5, nod: 4, shL: 1, shR: 0.1, lf: [-0.12, 0, 0], rf: [0.1, 0.03, 0.03], kneeR: -0.4, l: at(-1, -0.24, 0.52, 0.1, E_OUT), r: at(1, 0.12, 0.58, 0.2, E_DOWN), handR: 0.6, handL: 0.6 }],
      [1.5, { y: -0.05, x: -0.015, hips: -0.025, tilt: -2, lean: 1, head: -2, nod: 0, shL: 0.4, shR: 0.2, lf: [-0.12, 0, 0], rf: [0.1, 0, 0.01], kneeR: -0.1, l: at(-1, -0.22, 0.56, 0.12, E_OUT), r: at(1, 0.16, 0.58, 0.16, E_DOWN), handR: 0.6, handL: 0.6 }],
    ],
  }),
  full({
    id: 'legwork-cross', name: 'Legwork Cross & Flick', tags: 'hiphop | legs | kick afro', beats: 1, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'Quick legwork: tap one foot across in front of the other, then flick it out to the side, hands loose in front of the chest; switch feet every beat.',
    keys: [
      [0, { y: -0.07, hips: -0.02, twist: -6, rf: [-0.03, 0, 0.08], lf: [-0.09, 0, 0], kneeR: -0.3, r: at(1, 0.14, 0.72, 0.2, E_DOWN), l: at(-1, -0.18, 0.72, 0.18, E_DOWN), handR: 0.7, handL: 0.7 }],
      [0.5, { y: -0.04, hips: -0.03, tilt: -3, lean: -4, twist: 4, rf: [0.24, 0.09, 0.03], lf: [-0.09, 0, 0], kneeR: 0.2, r: at(1, 0.2, 0.74, 0.16, E_DOWN), l: at(-1, -0.14, 0.74, 0.2, E_DOWN), handR: 0.7, handL: 0.7 }],
    ],
  }),
  full({
    id: 'kuku-step', name: 'Kuku Step', tags: 'aerobic party | full | stomp afro', beats: 2, level: 'high', d: 2, parts: ['arms', 'legs', 'torso'], impact: true,
    desc: 'Lean forward from the hips and stamp from foot to foot, the arms swinging long and straight in opposition, one forward and up, the other back.',
    keys: [
      [0, { y: -0.1, bend: 18, nod: -4, rf: [0.1, 0, 0.04], lf: [-0.1, 0.05, -0.02], kneeR: 0.1, r: at(1, 0.32, 0.6, -0.16, [0.3, 0.3, -1]), l: at(-1, -0.08, 0.96, 0.24, E_DOWN), ...OPEN }],
      [0.5, { y: -0.06, bend: 16, nod: -2, rf: [0.1, 0, 0.03], lf: [-0.1, 0, 0], r: at(1, 0.22, 0.5, 0.08, E_OUT), l: at(-1, -0.22, 0.52, 0.12, E_OUT), ...OPEN }],
      [1, { y: -0.1, bend: 18, nod: -4, lf: [-0.1, 0, 0.04], rf: [0.1, 0.05, -0.02], kneeL: 0.1, l: at(-1, -0.32, 0.6, -0.16, [0.3, 0.3, -1]), r: at(1, 0.08, 0.96, 0.24, E_DOWN), ...OPEN }],
      [1.5, { y: -0.06, bend: 16, nod: -2, lf: [-0.1, 0, 0.03], rf: [0.1, 0, 0], r: at(1, 0.22, 0.52, 0.12, E_OUT), l: at(-1, -0.22, 0.5, 0.08, E_OUT), ...OPEN }],
    ],
  }),
  full({
    id: 'sabar-knee', name: 'Sabar Knee Lift', tags: 'aerobic party | full | kick afro', beats: 1, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Snap one knee up high as both arms fling up and open, then put it down with the arms dropping in; quick and light, switching knees every beat.',
    keys: [
      [0, { y: 0, lean: -4, bend: -4, nod: -6, rf: [0.11, 0.3, 0.13], lf: [-0.08, 0, 0], kneeR: 0.3, hips: -0.025, tilt: -4, r: at(1, 0.34, 1.0, 0.1, E_UP), l: at(-1, -0.34, 1.0, 0.1, E_UP), ...OPEN }],
      [0.5, { y: -0.08, lean: 0, bend: 6, nod: 3, rf: [0.09, 0, 0.02], lf: [-0.09, 0, 0], kneeR: 0.05, r: at(1, 0.14, 0.6, 0.2, E_DOWN), l: at(-1, -0.14, 0.6, 0.2, E_DOWN), handR: 0.7, handL: 0.7 }],
    ],
  }),
];
