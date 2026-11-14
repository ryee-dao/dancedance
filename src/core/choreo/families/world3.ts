/**
 * Two popular scenes that had no dance of their own (ids in
 * ../genreSets/variety.ts):
 *
 *   dangdut    Indonesian and Malay dangdut / koplo (and Thai luk thung,
 *              danced much the same at a party): the joget sway with its
 *              soft hand rolls and pointing fingers, and the goyang (shakes)
 *              of the dangdut stage: the saw (gergaji), the dribble and the
 *              broken hip hits (patah-patah). The horizontal "drill" hip
 *              circle (goyang ngebor) is left out: it doesn't read from the
 *              front. Dangdut 120-140 BPM (koplo's kendang double time),
 *              luk thung ~100-130.
 *   schlager   German-language party Schlager, Oktoberfest and après-ski:
 *              schunkeln (the arm-in-arm sway, here with the arms hooked as
 *              if with the neighbours), the toast with the raised stein, and
 *              the beak snaps and wing flaps of the bird dance (its figures
 *              as separate moves, never the routine). The polka steps come
 *              from the folk set (its neighbour). Discofox, the couple dance
 *              of Schlager, is a three-beat pattern over 4/4 that the
 *              figure can't count; it's left out.
 *
 * Sources: Esplanade "Dangdut: a guide to Indonesia's most popular music",
 * Malay Mail "From drill dance to the dribble: dangdut twerking through the
 * ages", Wikipedia "Schunkeln", SFDH folk-dance encyclopedia "Chicken dance".
 * All are hand-authored full-body moves (no shared layer patterns).
 */
import { at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

// --- Dangdut ----------------------------------------------------------------------------
// Joget sway: step-touch side to side, forearms up in front, the hands rolling softly and one finger pointing out.
const joget = (point: boolean, touch: boolean): PoseSpec => ({
  x: touch ? 0.07 : 0.03, y: touch ? -0.08 : -0.05, hips: touch ? 0.045 : 0.025, tilt: touch ? 6 : 3, head: 5, turn: 10,
  rf: [0.15, 0, 0], lf: touch ? [0.04, 0.012, 0.01] : [-0.13, 0, 0], kneeR: 0.08, kneeL: touch ? 0.1 : 0.04, pitchL: touch ? 20 : 0,
  r: point ? at(1, 0.32, 0.92, 0.16, E_OUT) : at(1, 0.12, 0.8, 0.22, E_OUT), l: point ? at(-1, -0.05, 0.76, 0.22, E_OUT) : at(-1, -0.14, 0.86, 0.2, E_OUT),
  handR: point ? 0 : 0.8, handL: 0.8, ...(point ? { formR: 'point' as const } : {}),
});

// Goyang gergaji (the saw): palms pressed together beside one hip, sawing up and down with the hip pushed out.
const saw = (up: boolean): PoseSpec => ({
  y: up ? -0.05 : -0.09, hips: up ? 0.03 : 0.065, tilt: up ? 3 : 9, lean: -3, twist: up ? 4 : 10, turn: -6,
  rf: [0.12, 0, 0], lf: [-0.11, 0, 0], kneeR: up ? 0.04 : 0.12, kneeL: up ? 0.08 : 0.16,
  r: at(1, 0.22, up ? 0.7 : 0.52, 0.18, E_DOWN), l: at(-1, 0.18, up ? 0.7 : 0.52, 0.2, [0.4, -1, 0]), handR: 1, handL: 1,
});

// Goyang dribble: one hand bouncing a ball low beside the hip, the knees and hips bouncing with it.
const dribble = (down: boolean, s: number): PoseSpec => ({
  y: down ? -0.1 : -0.05, hips: 0.035 * s, tilt: 5 * s, lean: down ? 4 : 1, bend: down ? 6 : 2, nod: 4,
  rf: [0.13, 0, 0], lf: [-0.12, 0, 0], kneeR: down ? 0.12 : 0.04, kneeL: down ? 0.12 : 0.04,
  r: at(1, 0.3, down ? 0.4 : 0.56, 0.12, E_DOWN), l: at(-1, -0.18, 0.54, 0.03, [1, 0, -0.4]), handR: 1, handL: 0.6,
});

// Goyang patah-patah (broken hits): the hips snap from side to side in sharp hits, fists up by the shoulders.
const patah = (s: 1 | -1, low: boolean): PoseSpec => ({
  y: low ? -0.12 : -0.07, hips: 0.07 * s, tilt: 11 * s, chestX: -0.02 * s, head: -4 * s,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: s > 0 ? 0 : 0.18, kneeL: s > 0 ? 0.18 : 0,
  r: at(1, 0.24, 0.9, 0.08, E_UP), l: at(-1, -0.24, 0.9, 0.08, E_UP), handR: 0, handL: 0,
});

// --- Schlager ---------------------------------------------------------------------------
// Schunkeln: forearms hooked out to the sides as if arm in arm with the neighbours, swaying wide from side to side.
const schunkel = (s: 1 | -1): PoseSpec => ({
  x: 0.03 * s, y: -0.06, lean: 13 * s, head: 8 * s, hips: -0.02 * s,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: s > 0 ? 0.12 : 0.04, kneeL: s > 0 ? 0.04 : 0.12,
  r: at(1, 0.34, 0.66, 0.06, [0.6, -0.8, -0.2]), l: at(-1, -0.34, 0.66, 0.06, [0.6, -0.8, -0.2]), handR: 0.3, handL: 0.3,
});

// Toast: the stein raised high, swayed, brought in to clink and up to drink.
const stein = (x: number, y: number, z: number): PoseSpec => ({ r: at(1, x, y, z, E_OUT), l: at(-1, -0.16, 0.56, 0.06, [1, 0, -0.4]), handR: 0, handL: 0.5 });
const TOASTS: readonly PoseSpec[] = [
  { x: 0.03, y: -0.05, lean: 4, head: 4, nod: -6, hips: 0.03, tilt: 3, rf: [0.13, 0, 0], lf: [-0.12, 0, 0], kneeL: 0.08, ...stein(0.24, 1.06, 0.08) },
  { x: -0.03, y: -0.05, lean: -5, head: -4, nod: -4, hips: -0.03, tilt: -3, rf: [0.13, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.08, ...stein(0.14, 1.04, 0.1) },
  { x: 0, y: -0.07, lean: 0, head: 0, nod: 4, bend: 4, rf: [0.13, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.08, kneeL: 0.08, ...stein(0.06, 0.8, 0.27) },
  { x: 0, y: -0.04, lean: -2, head: 0, nod: -14, bend: -6, rf: [0.13, 0, 0], lf: [-0.12, 0, 0], ...stein(0.06, 0.9, 0.16) },
];
const toast = (k: number): PoseSpec => TOASTS[k];

// Bird-dance figures: beak snaps (hands up in front snapping like beaks), wing flaps (hands in the armpits, elbows flapping).
const beak = (shut: boolean, y: number): PoseSpec => ({
  y, bend: 3, nod: shut ? 4 : 0, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.16, 0.86, 0.24, E_OUT), l: at(-1, -0.16, 0.86, 0.24, E_OUT), handR: shut ? 0 : 1, handL: shut ? 0 : 1,
});
const wing = (up: boolean): PoseSpec => ({
  y: up ? -0.04 : -0.08, bend: 4, shR: up ? 1 : 0.3, shL: up ? 1 : 0.3, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: up ? 0.03 : 0.1, kneeL: up ? 0.03 : 0.1,
  r: at(1, up ? 0.3 : 0.22, up ? 0.82 : 0.68, 0.0, [1, up ? 0.6 : -0.2, -0.3]), l: at(-1, up ? -0.3 : -0.22, up ? 0.82 : 0.68, 0.0, [1, up ? 0.6 : -0.2, -0.3]),
  handR: 0, handL: 0,
});

export const patterns: PatternSet = {};

const dangdut: MoveDef[] = [
  full({
    id: 'joget-sway', name: 'Joget Sway', tags: 'pop latin | arms hips | point hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'The everyday dangdut dance: step to the side and touch the other foot in with the hip, the forearms up in front of the chest with the hands rolling softly, one finger pointing out to the stepping side on the touch; then the other way.',
    keys: [[0, joget(false, false)], [0.5, { ...joget(false, false), r: at(1, 0.16, 0.86, 0.22, E_OUT), l: at(-1, -0.1, 0.78, 0.22, E_OUT) }], [1, joget(true, true)], [1.5, { ...joget(false, true), y: -0.06 }]],
  }),
  full({
    id: 'goyang-gergaji', name: 'Goyang Gergaji', tags: 'pop latin | hips arms | hips shake', beats: 2, level: 'mid', d: 1, parts: ['hips', 'arms'], mirror: true,
    desc: 'The dangdut "saw": palms pressed together beside one hip, saw them up and down on every half beat as the hip pushes out with each stroke and the knees dip.',
    keys: [[0, saw(false)], [0.5, saw(true)], [1, saw(false)], [1.5, saw(true)]],
  }),
  full({
    id: 'goyang-dribble', name: 'Dribble Shake', tags: 'pop latin | hips arms | hips', beats: 2, level: 'mid', d: 1, parts: ['hips', 'arms'], mirror: true,
    desc: 'Dangdut\'s goyang dribble: bounce an imaginary ball low beside one hip on every half beat, the knees and hips bouncing and swaying with it, the other hand on the hip.',
    keys: [[0, dribble(true, 1)], [0.5, dribble(false, 0.4)], [1, dribble(true, -0.4)], [1.5, dribble(false, -1)]],
  }),
  full({
    id: 'goyang-patah', name: 'Broken Hip Hits', tags: 'pop latin | hips | hips shake', beats: 2, level: 'mid', d: 2, parts: ['hips'],
    desc: 'Goyang patah-patah: snap the hips from side to side in sharp, jerky hits, sinking lower on the second pair, the fists up by the shoulders and the chest still.',
    keys: [[0, patah(1, false)], [0.5, patah(-1, false)], [1, patah(1, true)], [1.5, patah(-1, true)]],
  }),
];

const schlager: MoveDef[] = [
  full({
    id: 'schunkeln', name: 'Schunkeln', tags: 'party pop | full hips | wave', beats: 2, level: 'low', d: 1, parts: ['torso', 'hips'], bounce: 0.2,
    desc: 'The beer-hall sway: forearms hooked out to the sides as if arm in arm with the neighbours, sway the whole body wide from side to side with the music.',
    keys: [[0, schunkel(1)], [1, schunkel(-1)]],
  }),
  full({
    id: 'prost-toast', name: 'Prost Toast', tags: 'party pop | arms | wave', beats: 4, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Raise a stein high and sway with it from side to side, bring it in front to clink with the neighbours, then lift it to drink, head back.',
    keys: [[0, toast(0)], [1, toast(1)], [2, toast(2)], [3, toast(3)]],
  }),
  // The figures of the bird dance (also known as the chicken dance), as separate moves, never its routine.
  full({
    id: 'beak-snaps', name: 'Beak Snaps', tags: 'party | arms | hands animal', beats: 1, level: 'low', d: 1, parts: ['arms'],
    desc: 'Both hands up in front of the chest like beaks, snap them shut and open on every half beat with a little bounce.',
    keys: [[0, beak(true, -0.07)], [0.5, beak(false, -0.04)]],
  }),
  full({
    id: 'wing-flaps', name: 'Wing Flaps', tags: 'party | arms | animal', beats: 1, level: 'low', d: 1, parts: ['arms'],
    desc: 'Fists tucked under the armpits, flap the elbows up and down like wings on every half beat, bobbing the knees.',
    keys: [[0, wing(true)], [0.5, wing(false)]],
  }),
];

export const moves: MoveDef[] = [...dangdut, ...schlager];
