/**
 * Moves of the electronic genre sets (see AUTHORING.md, "Genre sets", and
 * ../genreSets/electronic.ts): house dance, festival / rave (EDM, trance,
 * hard dance) and bass music (dubstep, drum & bass, phonk). Same shape as
 * every family file. Individual moves only; the generator composes sequences.
 *
 * Already in the catalogue and part of these vocabularies (left where they
 * are): house-skate, running-man-shuffle and t-step (hiphop, global), loose-legs
 * (hiphop, house set), the voguing moves (disco, house set), pas-de-bourree
 * (pop), heel-toe-swivel and heel-swivel (funk), fist-pump and jump-around
 * (rock, global), the-robot (funk), arm-wave (hiphop), ska-skank (rock, punk
 * set: also the drum & bass skank), mashed-potato (disco: the shuffle's
 * side flick), criss-cross (hiphop: the x-step).
 *
 * Tempo: house runs ~120-128, EDM 125-150, dubstep 140 (half-time feel),
 * drum & bass ~174. The small on-the-beat moves here stay under their speed
 * limit (speed.ts) at those tempos; the jumps and big reaches are meant to be
 * danced at half time on fast songs.
 *
 * Arms: `at(side, x, y, z, elbow)` puts a hand at a world position (x = screen
 * x, so the LEFT hand's own side is negative x); shoulders at (+-0.125, 0.78),
 * head centre ~ y 0.93. `mirror: true` moves are written for the user's RIGHT.
 */
import { FIST, OPEN, at, mir, wide, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

export const patterns: PatternSet = {};

// ---------------------------------------------------------------------------
// House

/** Jacking: the chest drops forward with the knees on the beat, arms swinging back; the chest arches back up on the and. */
const jackDown: PoseSpec = {
  y: -0.06, bend: 13, nod: 10, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.21, 0.5, -0.08, [1, 0, -0.5]), l: at(-1, -0.21, 0.5, -0.08, [1, 0, -0.5]), handR: 0.4, handL: 0.4,
};
const jackUp: PoseSpec = {
  y: -0.015, bend: -8, nod: -7, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0, kneeL: 0,
  r: at(1, 0.19, 0.58, 0.15, [1, -0.3, -0.2]), l: at(-1, -0.19, 0.58, 0.15, [1, -0.3, -0.2]), handR: 0.4, handL: 0.4,
};

/** House stomp: the free foot stamps beside the standing one (no weight) as the chest jacks down. */
const stompDown: PoseSpec = {
  y: -0.07, bend: 9, nod: 8, rf: [0.11, 0, 0.03], lf: [-0.1, 0, 0], kneeL: 0.08,
  r: at(1, 0.17, 0.5, 0.14, [1, 0, -0.3]), l: at(-1, -0.2, 0.52, 0.1, [1, 0, -0.3]), ...FIST,
};
const stompLift = (side: 1 | -1): PoseSpec => ({
  y: -0.03, bend: -3, nod: -4,
  ...(side > 0 ? { rf: [0.12, 0.08, 0.05], lf: [-0.1, 0, 0], kneeR: 0.1 } : { rf: [0.11, 0, 0.02], lf: [-0.11, 0.08, 0.05], kneeL: 0.1 }),
  r: at(1, 0.2, 0.62, 0.12, [1, -0.3, -0.2]), l: at(-1, -0.2, 0.62, 0.12, [1, -0.3, -0.2]), ...FIST,
});

const ARMS_WIDE: PoseSpec = { r: at(1, 0.34, 0.62, 0.06, [1, 0, -0.3]), l: at(-1, -0.32, 0.62, 0.06, [1, 0, -0.3]), ...OPEN };
const ARMS_IN: PoseSpec = { r: at(1, 0.22, 0.56, 0.12, [1, 0, -0.3]), l: at(-1, -0.22, 0.56, 0.12, [1, 0, -0.3]), ...OPEN };

// ---------------------------------------------------------------------------
// EDM

/** Hands up: straight arms in a high V, open hands. */
const handsUpDown: PoseSpec = { y: -0.05, nod: 4, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: [148, 8, 156, 8], l: [148, 8, 156, 8], ...OPEN };
const handsUpUp: PoseSpec = { y: -0.01, nod: -8, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: [166, 4, 172, 4], l: [166, 4, 172, 4], ...OPEN };

/** Crouched low waiting for the drop: hands down by the knees. */
const crouch = (y: number, hy: number): PoseSpec => ({
  y, bend: 16, nod: 10, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.15, kneeL: 0.15,
  r: at(1, 0.16, hy, 0.2, [1, 0, -0.3]), l: at(-1, -0.16, hy, 0.2, [1, 0, -0.3]), ...OPEN,
});

/** Trance sweep: both straight arms travelling together through a big arc overhead. */
const tranceLow: PoseSpec = { x: 0.02, hips: 0.03, y: -0.04, lean: 3, turn: 10, nod: -2, r: [70, 10, 74, 10], l: at(-1, 0.15, 0.62, 0.26, [0.4, -1, 0]), ...OPEN };
const tranceRise: PoseSpec = { x: 0.01, hips: 0.015, y: -0.02, lean: 2, turn: 6, nod: -8, r: [128, 8, 132, 8], l: at(-1, 0.1, 1.0, 0.2, [0.5, -0.4, 0.4]), ...OPEN };
const tranceTop: PoseSpec = { x: 0, hips: 0, y: -0.04, lean: 0, turn: 0, nod: -12, r: [166, 4, 170, 4], l: [166, 4, 170, 4], ...OPEN };

// ---------------------------------------------------------------------------
// Bass music

/** Rail grip: both fists out in front at chest height, as if holding the barrier. */
const rail = (y: number): PoseSpec => ({ r: at(1, 0.14, y, 0.24, [1, -0.3, -0.2]), l: at(-1, -0.14, y, 0.24, [1, -0.3, -0.2]), ...FIST });

/** Liquid contour: open hands tracing round a ball in front of the chest, opposite sides of it. */
const LQ = { cx: 0, cy: 0.8, cz: 0.22, r: 0.13 };
const liquid = (k: number): PoseSpec => {
  const a = (k * Math.PI) / 4;
  const sway = Math.cos(a);
  return {
    y: -0.03 - 0.015 * Math.abs(Math.sin(a)), x: 0.015 * sway, hips: 0.025 * sway, tilt: 3 * sway, head: -3 * sway, lean: 2 * sway,
    r: at(1, LQ.cx + LQ.r * Math.cos(a), LQ.cy + LQ.r * Math.sin(a), LQ.cz, [0.8, -1, -0.3]),
    l: at(-1, LQ.cx - LQ.r * Math.cos(a), LQ.cy - LQ.r * Math.sin(a), LQ.cz, [0.8, -1, -0.3]),
    ...OPEN,
  };
};

/** Drift: hands on a wheel centred in front of the chest, turned by `deg` (+ = clockwise, to the user's right). */
const wheel = (deg: number): PoseSpec => {
  const a = (deg * Math.PI) / 180;
  const R = 0.12, cy = 0.7, cz = 0.24;
  // Hands at 10 and 2 o'clock, rotated together.
  const hr = Math.PI / 6 - a, hl = Math.PI - Math.PI / 6 - a;
  return {
    r: at(1, R * Math.cos(hr), cy + R * Math.sin(hr), cz, [1, -0.6, -0.2]),
    l: at(-1, R * Math.cos(hl), cy + R * Math.sin(hl), cz, [1, -0.6, -0.2]),
    ...FIST,
  };
};

/** Cowbell hit: one fist chops down in front, the other cocked up by the ear. */
const COCK_R = at(1, 0.22, 0.98, 0.08, [1, 0.3, -0.3]);
const COCK_L = at(-1, -0.22, 0.98, 0.08, [1, 0.3, -0.3]);
const CHOP_R = at(1, 0.1, 0.66, 0.26, [1, -0.3, -0.2]);
const CHOP_L = at(-1, -0.1, 0.66, 0.26, [1, -0.3, -0.2]);

export const moves: MoveDef[] = [
  // --- House --------------------------------------------------------------------
  full({
    id: 'house-jack', name: 'Jacking', tags: 'disco hiphop | full |', beats: 1, level: 'low', d: 1, parts: ['torso', 'legs'],
    desc: 'The house groove: on every beat let the chest drop forward with a little knee bend and the arms swing back, then arch the chest up and back on the and.',
    keys: [[0, jackDown], [0.5, jackUp]],
  }),
  full({
    id: 'house-stomp', name: 'House Stomp', tags: 'disco hiphop | legs | stomp', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true, impact: true,
    desc: 'Jacking on the beat, stamp one foot down beside the other twice without putting weight on it, then change feet and stamp the other.',
    keys: [[0, stompDown], [0.5, stompLift(1)], [1, stompDown], [1.5, stompLift(-1)]],
  }),
  full({
    id: 'crossroads', name: 'Crossroads', tags: 'disco hiphop | legs |', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'House footwork on the balls of the feet: cross one foot in front of the other, step it out to the side, cross it behind, step it out again, arms loose and open.',
    keys: [
      [0, { y: -0.06, x: -0.02, twist: -6, rf: [-0.04, 0, 0.07], lf: [-0.1, 0, -0.01], kneeR: 0.15, pitchR: 15, ...ARMS_IN }],
      [0.5, { y: -0.03, x: 0.01, twist: 0, rf: [0.18, 0, 0], lf: [-0.1, 0, 0], ...ARMS_WIDE }],
      [1, { y: -0.06, x: -0.02, twist: 6, rf: [-0.04, 0, -0.07], lf: [-0.1, 0, 0.01], kneeR: -0.1, pitchR: 20, ...ARMS_IN }],
      [1.5, { y: -0.03, x: 0.01, twist: 0, rf: [0.18, 0, 0], lf: [-0.1, 0, 0], ...ARMS_WIDE }],
    ],
  }),
  full({
    id: 'floor-sweep', name: 'Floor Sweep', tags: 'disco hiphop | legs |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Sit into one bent knee and sweep the other foot round on the floor in a half circle, out to the side, through the front and across, the arms opening and closing against it.',
    keys: [
      [0, { y: -0.08, x: -0.03, hips: -0.02, lean: 4, rf: [0.27, 0, 0], lf: [-0.1, 0, 0], kneeL: 0.15, r: at(1, 0.36, 0.72, 0.04, [1, 0, -0.3]), l: at(-1, -0.3, 0.66, 0.08, [1, 0, -0.3]), ...OPEN }],
      [0.5, { y: -0.1, x: -0.02, hips: -0.02, lean: 0, rf: [0.17, 0, 0.2], lf: [-0.1, 0, 0], kneeL: 0.15, slideR: true, r: at(1, 0.24, 0.66, 0.16, [1, -0.3, -0.2]), l: at(-1, -0.3, 0.66, 0.1, [1, 0, -0.3]), ...OPEN }],
      [1, { y: -0.08, x: -0.02, twist: -8, lean: -3, rf: [-0.03, 0, 0.13], lf: [-0.1, 0, 0], kneeL: 0.12, slideR: true, r: at(1, -0.06, 0.6, 0.22, [0.6, -1, 0]), l: at(-1, -0.34, 0.7, 0.04, [1, 0, -0.3]), ...OPEN }],
      [1.5, { y: -0.03, x: 0, twist: 0, lean: 0, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: at(1, 0.2, 0.56, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.56, 0.1, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'lofting-reach', name: 'Lofting Reach', tags: 'disco hiphop | full | wave', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Lofting brought up to standing: sink into a wide knee bend and reach both hands down to the floor by one foot, sweep them low across to the other side, then roll up and float the arms overhead.',
    keys: [
      [0, { x: 0.06, y: -0.17, lean: 14, bend: 12, nod: 8, head: 6, rf: [0.24, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.2, r: at(1, 0.36, 0.28, 0.12, [1, 0, -0.3]), l: at(-1, 0.14, 0.32, 0.3, [0.3, -0.3, 1]), ...OPEN }],
      [1, { x: 0, y: -0.18, lean: 0, bend: 14, nod: 8, head: 0, rf: [0.24, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.15, kneeL: 0.15, r: at(1, 0.22, 0.3, 0.24, [1, 0, -0.2]), l: at(-1, -0.22, 0.3, 0.24, [1, 0, -0.2]), ...OPEN }],
      [2, { x: -0.05, y: -0.12, lean: -10, bend: 6, nod: 4, head: -4, rf: [0.24, 0, 0], lf: [-0.12, 0, 0], kneeL: 0.2, r: at(1, -0.14, 0.36, 0.3, [0.3, -0.3, 1]), l: at(-1, -0.36, 0.32, 0.12, [1, 0, -0.3]), ...OPEN }],
      [3, { x: 0, y: -0.02, lean: -4, bend: -6, nod: -8, head: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [150, 10, 155, 10], l: [122, 10, 130, 10], ...OPEN }],
    ],
  }),
  full({
    id: 'scissor-step', name: 'Scissor Step', tags: 'disco hiphop | legs | jump', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], jump: true, impact: true,
    desc: 'Light hops on the balls of the feet, switching the feet front and back like scissor blades on every beat, the arms swinging against the legs.',
    keys: [
      [0, { y: -0.06, rf: [0.08, 0, 0.13], lf: [-0.08, 0, -0.12], pitchL: 20, r: at(1, 0.22, 0.56, -0.08, [1, 0, -0.5]), l: at(-1, -0.16, 0.66, 0.2, [1, -0.3, 0]), handR: 0.5, handL: 0.5 }],
      [0.5, { y: 0.03, rf: [0.08, 0.03, 0.02], lf: [-0.08, 0.03, -0.02], r: at(1, 0.2, 0.6, 0.06, [1, 0, -0.3]), l: at(-1, -0.2, 0.6, 0.06, [1, 0, -0.3]), handR: 0.5, handL: 0.5 }],
      [1, { y: -0.06, rf: [0.08, 0, -0.12], lf: [-0.08, 0, 0.13], pitchR: 20, l: at(-1, -0.22, 0.56, -0.08, [1, 0, -0.5]), r: at(1, 0.16, 0.66, 0.2, [1, -0.3, 0]), handR: 0.5, handL: 0.5 }],
      [1.5, { y: 0.03, rf: [0.08, 0.03, -0.02], lf: [-0.08, 0.03, 0.02], r: at(1, 0.2, 0.6, 0.06, [1, 0, -0.3]), l: at(-1, -0.2, 0.6, 0.06, [1, 0, -0.3]), handR: 0.5, handL: 0.5 }],
    ],
  }),

  // --- EDM: festival, rave, trance, hard dance --------------------------------------
  full({
    id: 'hands-up-bounce', name: 'Hands Up', tags: 'aerobic pop | arms | hands', beats: 1, level: 'low', d: 1, parts: ['arms'],
    desc: 'Both arms straight up in a high V with open hands, bouncing on the knees and reaching the hands a little higher on every beat.',
    keys: [[0, handsUpDown], [0.5, handsUpUp]],
  }),
  full({
    id: 'drop-jump', name: 'Crouch & Drop', tags: 'aerobic | full | jump', beats: 4, level: 'high', d: 2, parts: ['legs', 'jump'], jump: true, impact: true,
    desc: 'Crouch low with the hands by the knees and bounce there through the build, then spring up and jump on the drop with both arms thrown up.',
    keys: [
      [0, crouch(-0.19, 0.36)],
      [1, crouch(-0.16, 0.4)],
      [2, crouch(-0.19, 0.42)],
      [2.5, { y: -0.08, bend: 4, nod: -4, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], r: at(1, 0.24, 0.8, 0.14, [1, 0, -0.3]), l: at(-1, -0.24, 0.8, 0.14, [1, 0, -0.3]), ...OPEN }],
      [3, { y: 0.07, bend: -4, nod: -10, rf: [0.12, 0.04, 0], lf: [-0.12, 0.04, 0], r: [158, 5, 164, 5], l: [158, 5, 164, 5], ...OPEN }],
      [3.5, { y: -0.09, bend: 6, nod: 4, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], r: at(1, 0.3, 0.72, 0.12, [1, 0, -0.3]), l: at(-1, -0.3, 0.72, 0.12, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'cutting-shapes', name: 'Cutting Shapes', tags: 'aerobic hiphop | legs | walk kick', beats: 2, level: 'mid', d: 3, parts: ['legs', 'arms'], mirror: true, travel: 0.16,
    desc: 'Shuffle sideways on a travelling T-step: the standing foot swivels toe, heel, toe while the other leg kicks out to the side, one arm reaching toward the travel and the other slicing across the chest.',
    keys: [
      [0, { x: 0, y: -0.05, hips: -0.02, lean: -4, lf: [-0.09, 0, 0], kneeL: 0.5, rf: [0.24, 0.09, 0.03], kneeR: 0.25, r: at(1, 0.4, 0.82, 0.06, [1, 0, -0.3]), l: at(-1, 0.08, 0.7, 0.24, [0.5, -1, 0]), ...OPEN }],
      [0.5, { x: 0.05, y: -0.04, hips: -0.02, lean: -4, lf: [-0.04, 0, 0], slideL: true, kneeL: -0.4, rf: [0.29, 0.08, 0.03], kneeR: 0.25, r: at(1, 0.4, 0.8, 0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.7, 0.12, [1, 0, -0.3]), ...OPEN }],
      [1, { x: 0.1, y: -0.05, hips: -0.02, lean: -4, lf: [0.01, 0, 0], slideL: true, kneeL: 0.5, rf: [0.34, 0.09, 0.03], kneeR: 0.25, r: at(1, 0.4, 0.82, 0.06, [1, 0, -0.3]), l: at(-1, 0.1, 0.7, 0.24, [0.5, -1, 0]), ...OPEN }],
      [1.5, { x: 0.16, y: -0.03, hips: 0, lean: 0, lf: [0.07, 0, 0], kneeL: 0, rf: [0.25, 0, 0], kneeR: 0, r: at(1, 0.24, 0.6, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.6, 0.1, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'jumpstyle-kick', name: 'Jumpstyle Kick', tags: 'aerobic | legs | jump kick', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'Hard dance basic: hop and kick one straight leg forward, land and swing it back behind, hop and kick it forward again, then land on both feet and switch legs.',
    keys: [
      [0, { y: 0.03, bend: -6, rf: [0.08, 0.16, 0.24], lf: [-0.07, 0.03, 0], r: at(1, 0.24, 0.56, -0.12, [1, 0, -0.5]), l: at(-1, -0.08, 0.7, 0.24, [0.6, -1, 0]), ...FIST }],
      [0.5, { y: -0.06, bend: 6, rf: [0.08, 0.08, -0.1], lf: [-0.08, 0, 0], kneeR: 0.1, r: at(1, 0.16, 0.7, 0.22, [0.6, -1, 0]), l: at(-1, -0.24, 0.56, -0.12, [1, 0, -0.5]), ...FIST }],
      [1, { y: 0.03, bend: -6, rf: [0.08, 0.16, 0.24], lf: [-0.07, 0.03, 0], r: at(1, 0.24, 0.56, -0.12, [1, 0, -0.5]), l: at(-1, -0.08, 0.7, 0.24, [0.6, -1, 0]), ...FIST }],
      [1.5, { y: -0.08, bend: 6, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.2, 0.6, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.6, 0.1, [1, 0, -0.3]), ...FIST }],
    ],
  }),
  full({
    id: 'hakken', name: 'Hakken', tags: 'aerobic rock | legs | jump kick', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], jump: true, impact: true,
    desc: 'Hardcore footwork: little hops from foot to foot, the free heel jabbing forward low with the toes up on every beat, fists punching down and forward in turn.',
    keys: [
      [0, { y: 0.02, bend: -3, rf: [0.08, 0.05, 0.19], lf: [-0.08, 0.02, -0.02], pitchR: -22, r: at(1, 0.12, 0.56, 0.28, [0.6, -1, 0]), l: at(-1, -0.2, 0.68, 0.0, [1, 0, -0.5]), ...FIST }],
      [0.5, { y: -0.06, bend: 5, rf: [0.08, 0, 0.02], lf: [-0.08, 0, 0], r: at(1, 0.17, 0.62, 0.16, [1, -0.3, 0]), l: at(-1, -0.17, 0.62, 0.16, [1, -0.3, 0]), ...FIST }],
      [1, { y: 0.02, bend: -3, lf: [-0.08, 0.05, 0.19], rf: [0.08, 0.02, -0.02], pitchL: -22, l: at(-1, -0.12, 0.56, 0.28, [0.6, -1, 0]), r: at(1, 0.2, 0.68, 0.0, [1, 0, -0.5]), ...FIST }],
      [1.5, { y: -0.06, bend: 5, lf: [-0.08, 0, 0.02], rf: [0.08, 0, 0], r: at(1, 0.17, 0.62, 0.16, [1, -0.3, 0]), l: at(-1, -0.17, 0.62, 0.16, [1, -0.3, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'pound-and-pump', name: 'Pound & Pump', tags: 'aerobic rock | arms full | punch', beats: 4, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Bend over and pound one fist down at the floor twice on the beat, then stand up and pump the same fist at the sky twice, the other fist on the hip.',
    keys: [
      [0, { y: -0.1, bend: 16, nod: 12, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.14, 0.36, 0.26, [1, -0.3, 0]), l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
      [0.5, { y: -0.07, bend: 12, nod: 8, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.06, kneeL: 0.06, r: at(1, 0.17, 0.58, 0.22, [1, -0.3, 0]), l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
      [1, { y: -0.1, bend: 16, nod: 12, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.14, 0.36, 0.26, [1, -0.3, 0]), l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
      [1.5, { y: -0.04, bend: 2, nod: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0, kneeL: 0, r: at(1, 0.2, 0.88, 0.12, [1, -0.3, -0.2]), l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
      [2, { y: -0.02, bend: -4, nod: -10, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [164, 8, 170, 8], l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
      [2.5, { y: -0.05, bend: 0, nod: 2, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: at(1, 0.22, 0.98, 0.08, [1, -0.2, -0.3]), l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
      [3, { y: -0.02, bend: -4, nod: -10, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [164, 8, 170, 8], l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
      [3.5, { y: -0.05, bend: 6, nod: 4, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: at(1, 0.18, 0.7, 0.18, [1, -0.3, 0]), l: at(-1, -0.14, 0.52, 0.06, [1, 0, -0.4]), ...FIST }],
    ],
  }),
  full({
    id: 'trance-sweep', name: 'Trance Arm Sweep', tags: 'pop aerobic | arms | wave', beats: 4, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Both straight arms sweep together in one big slow arc, from low at one side up past the high diagonal to straight overhead and over to the other side, swaying with them.',
    keys: [[0, tranceLow], [1, tranceRise], [2, tranceTop], [3, mir(tranceRise)]],
  }),

  // --- Bass music: dubstep, drum & bass, phonk --------------------------------------
  full({
    id: 'half-time-bounce', name: 'Half-Time Bounce', tags: 'hiphop | full |', beats: 2, level: 'low', d: 1, parts: ['torso', 'legs'],
    desc: 'Dubstep head bob: one heavy drop every two beats on the half-time snare, knees bending, chest folding and the head nodding down with the shoulders hunched, then a slow rise.',
    keys: [
      [0, { y: -0.1, bend: 12, nod: 16, shR: 0.9, shL: 0.9, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.2, 0.56, 0.14, [1, 0, -0.3]), l: at(-1, -0.2, 0.56, 0.14, [1, 0, -0.3]), handR: 0.2, handL: 0.2 }],
      [1, { y: -0.03, bend: 0, nod: -4, shR: 0.2, shL: 0.2, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0, kneeL: 0, r: at(1, 0.18, 0.64, 0.16, [1, -0.3, -0.2]), l: at(-1, -0.18, 0.64, 0.16, [1, -0.3, -0.2]), handR: 0.2, handL: 0.2 }],
    ],
  }),
  full({
    id: 'wobble-bounce', name: 'Wobble Bounce', tags: 'hiphop | legs |', beats: 2, level: 'mid', d: 1, parts: ['legs', 'torso'],
    desc: 'Low wide stance with the fists out front as if gripping the rail, bounce twice to every beat with the wobble bass, rocking the shoulders from side to side.',
    keys: [
      [0, wide(-0.13, { lean: 4, chestX: 0.02, nod: 6, kneeR: 0.12, kneeL: 0.12, ...rail(0.72) })],
      [0.5, wide(-0.08, { lean: 2, chestX: 0.01, nod: 0, kneeR: 0.06, kneeL: 0.06, ...rail(0.76) })],
      [1, wide(-0.13, { lean: -4, chestX: -0.02, nod: 6, kneeR: 0.12, kneeL: 0.12, ...rail(0.72) })],
      [1.5, wide(-0.08, { lean: -2, chestX: -0.01, nod: 0, kneeR: 0.06, kneeL: 0.06, ...rail(0.76) })],
    ],
  }),
  full({
    id: 'popping-hits', name: 'Popping Hits', tags: 'hiphop funk | arms | hands', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Pop the chest and knee on every beat as one arm hits a sharp shape on the wobble: forearm snapped up at a right angle, recoil, forearm snapped straight out, recoil; then the other arm.',
    keys: [
      [0, { y: -0.04, bend: -6, nod: -5, shR: 0.8, chestX: 0.03, kneeL: -0.3, r: [88, 0, 175, 10], l: at(-1, -0.05, 0.74, 0.2, [1, -0.3, 0]), ...OPEN }],
      [0.5, { y: -0.03, bend: 2, nod: 2, shR: 0.2, chestX: 0, kneeL: 0, r: [74, 10, 130, 20], l: at(-1, -0.05, 0.72, 0.2, [1, -0.3, 0]), ...OPEN }],
      [1, { y: -0.04, bend: -6, nod: -5, shR: 0.8, chestX: 0.03, kneeL: -0.3, r: [90, 0, 90, 0], l: at(-1, -0.05, 0.74, 0.2, [1, -0.3, 0]), ...OPEN }],
      [1.5, { y: -0.03, bend: 2, nod: 2, shR: 0.2, chestX: 0, kneeL: 0, r: at(1, 0.1, 0.74, 0.2, [1, -0.3, 0]), l: at(-1, -0.05, 0.72, 0.2, [1, -0.3, 0]), ...OPEN }],
    ],
  }),
  full({
    id: 'liquid-hands', name: 'Liquid Hands', tags: 'hiphop pop | arms | wave hands', beats: 4, level: 'low', d: 2, parts: ['arms'],
    desc: 'Liquid contour: open hands trace round an imaginary ball in front of the chest, always on opposite sides of it, one gliding over the top as the other passes underneath, the body swaying with them.',
    keys: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k / 2, liquid(k)] as const),
  }),
  full({
    id: 'drift-lean', name: 'Drift Lean', tags: 'party hiphop | full |', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true,
    desc: 'Phonk drift: sink low and crank an imaginary wheel hard to one side, leaning and sliding the foot out into the turn, hold it, then flick the wheel back and straighten up.',
    keys: [
      [0, { x: 0.05, y: -0.12, hips: 0.02, lean: 12, head: 6, rf: [0.21, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.2, slideR: true, ...wheel(80) }],
      [1, { x: 0.05, y: -0.14, hips: 0.02, lean: 13, head: 7, rf: [0.21, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.2, ...wheel(90) }],
      [2, { x: 0, y: -0.08, hips: 0, lean: -3, head: -2, rf: [0.12, 0, 0], lf: [-0.11, 0, 0], kneeR: 0, slideR: true, ...wheel(-25) }],
      [3, { x: 0, y: -0.05, hips: 0, lean: 0, head: 0, rf: [0.12, 0, 0], lf: [-0.11, 0, 0], ...wheel(0) }],
    ],
  }),
  full({
    id: 'cowbell-hits', name: 'Cowbell Hits', tags: 'hiphop | arms | punch', beats: 2, level: 'mid', d: 2, parts: ['arms'],
    desc: 'Phonk: chop the fists down in front in turn on every half beat like striking the cowbell, the other fist cocked up by the ear, with a heavy head nod and knee drop on the one.',
    keys: [
      [0, { y: -0.08, nod: 14, bend: 6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.08, kneeL: 0.08, r: CHOP_R, l: COCK_L, ...FIST }],
      [0.5, { y: -0.06, nod: 6, bend: 3, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: COCK_R, l: CHOP_L, ...FIST }],
      [1, { y: -0.03, nod: -2, bend: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: CHOP_R, l: COCK_L, ...FIST }],
      [1.5, { y: -0.03, nod: 2, bend: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: COCK_R, l: CHOP_L, ...FIST }],
    ],
  }),
  full({
    id: 'sky-points', name: 'Sky Points', tags: 'hiphop | arms | point', beats: 2, level: 'low', d: 1, parts: ['arms'],
    desc: 'Drum & bass hands in the air: both hands up by the head with the index fingers pointing at the sky, pushed up high on the half-time snare and drawn back in between.',
    keys: [
      [0, { y: -0.07, nod: -8, r: at(1, 0.2, 1.1, 0.06, [1, 0.2, -0.3]), l: at(-1, -0.2, 1.1, 0.06, [1, 0.2, -0.3]), handR: 0, handL: 0, formR: 'point', formL: 'point' }],
      [1, { y: -0.02, nod: 4, r: at(1, 0.27, 0.92, 0.08, [1, -0.2, -0.3]), l: at(-1, -0.27, 0.92, 0.08, [1, -0.2, -0.3]), handR: 0, handL: 0, formR: 'point', formL: 'point' }],
    ],
  }),
  full({
    id: 'half-time-stomp', name: 'Half-Time Stomp', tags: 'hiphop rock | full | stomp', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'On the half-time snare stamp one foot down and slam both fists down with the chest folding, rise through the next beat, then lift the other knee ready to stamp.',
    keys: [
      [0, { y: -0.13, bend: 12, nod: 14, shR: 1, shL: 1, rf: [0.16, 0, 0.02], lf: [-0.12, 0, 0], kneeR: 0.15, kneeL: 0.15, r: at(1, 0.2, 0.46, 0.18, [1, 0, -0.3]), l: at(-1, -0.2, 0.46, 0.18, [1, 0, -0.3]), ...FIST }],
      [1, { y: -0.04, bend: 0, nod: -4, shR: 0, shL: 0, rf: [0.14, 0, 0], lf: [-0.12, 0, 0], kneeR: 0, kneeL: 0, r: at(1, 0.2, 0.8, 0.16, [1, -0.3, -0.2]), l: at(-1, -0.2, 0.8, 0.16, [1, -0.3, -0.2]), ...FIST }],
      [1.5, { y: -0.02, bend: -2, nod: -6, rf: [0.13, 0, 0], lf: [-0.13, 0.12, 0.06], kneeL: 0.2, r: at(1, 0.22, 0.92, 0.12, [1, -0.3, -0.2]), l: at(-1, -0.22, 0.92, 0.12, [1, -0.3, -0.2]), ...FIST }],
    ],
  }),
];
