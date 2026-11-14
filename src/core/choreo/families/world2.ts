/**
 * More Middle Eastern and North African dance: the `bellydance` set (ids in
 * ../genreSets/variety.ts), which every Arabic, Turkish, raï, shaabi,
 * khaleeji and mizrahi song opens and which had three moves (the Egyptian
 * walk, the hip drop kick, the snake-arm shimmy).
 *
 *   raqs sharqi  hip lifts, hip slides, the maya (the vertical figure eight
 *                of the hips, front plane), the hip shimmy;
 *   khaleeji     (the Gulf women's dance) the hair toss of the na'ashat and
 *                the drop step with the thobe sleeves framing the face;
 *   saidi        (Upper Egypt) the cane hop.
 *
 * Sources: Wikipedia "Glossary of belly dance terms" and "Khaleegy (dance)",
 * raqs.co.nz move glossary, Belly Dance Geek "The big 5: khaleegy", Atlanta
 * Belly Dance "Saudi" overview. Tempos: Arabic pop 90-130, maqsoum /
 * baladi 90-120, khaleeji 90-110 (counted in 2 or 6/8), saidi 100-130.
 * All are hand-authored full-body moves (no shared layer patterns).
 */
import { at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

/** Belly dance arms held out softly at shoulder height, wrists soft. */
const FRAME: PoseSpec = { r: at(1, 0.42, 0.79, 0.1, [0.3, 1, -0.2]), l: at(-1, -0.42, 0.79, 0.1, [0.3, 1, -0.2]), handR: 1, handL: 1 };
/** One arm curved overhead, the other out to the side. */
const HIGH_LOW: PoseSpec = { r: at(1, 0.1, 1.06, 0.06, E_UP), l: at(-1, -0.38, 0.78, 0.06, [1, -0.4, -0.2]), handR: 1, handL: 1 };

// --- Hip lifts: one foot forward on its ball, that hip punched up on the beat, released ------------
const lift = (up: boolean): PoseSpec => ({
  y: -0.06, hips: up ? 0.08 : 0.0, tilt: up ? 14 : -3, lean: up ? -5 : 0, chestX: up ? -0.02 : 0, head: up ? -4 : 0,
  rf: [0.11, 0, 0.06], lf: [-0.09, 0, 0], pitchR: 32, kneeR: up ? -0.1 : 0.12, kneeL: 0.12, ...FRAME,
});

// --- Hip slides: the hips glide straight out to one side and the other, the chest held still ---------
const slide = (s: 1 | -1): PoseSpec => ({
  y: -0.07, hips: 0.09 * s, tilt: 5 * s, chestX: -0.05 * s, lean: -3 * s,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: s > 0 ? 0.02 : 0.14, kneeL: s > 0 ? 0.14 : 0.02, ...FRAME,
});

// --- Maya: one hip lifts and pushes out, drops, and the same on the other side: a vertical figure eight ---------
const maya = (k: number): PoseSpec => {
  const hips = [0.07, 0.025, -0.07, -0.025][k];
  const tilt = [11, -7, -11, 7][k];
  return {
    y: -0.07, hips, tilt, chestX: -hips * 0.35, lean: -tilt * 0.2, head: -tilt * 0.3,
    rf: [0.1, 0, 0.02], lf: [-0.1, 0, 0], pitchR: 12, pitchL: 12, kneeR: tilt > 0 ? -0.05 : 0.14, kneeL: tilt < 0 ? -0.05 : 0.14, ...HIGH_LOW,
  };
};

// --- Hip shimmy: the knees alternate straightening very fast so the hips shimmer, arms framing the head ---------
const shim = (s: 1 | -1): PoseSpec => ({
  y: -0.065, hips: 0.035 * s, tilt: 7 * s, rf: [0.08, 0, 0.02], lf: [-0.08, 0, 0], kneeR: s > 0 ? -0.05 : 0.18, kneeL: s > 0 ? 0.18 : -0.05,
  r: at(1, 0.24, 1.0, 0.06, E_UP), l: at(-1, -0.24, 1.0, 0.06, E_UP), handR: 1, handL: 1,
});

// --- Khaleeji hair toss: hair and head swung from side to side with the upper body, hands holding the thobe at the chest ---------
const toss = (s: 1 | -1, y: number): PoseSpec => ({
  y, x: 0.015 * s, lean: 13 * s, head: 26 * s, turn: 16 * s, nod: 6, bend: 6, hips: -0.02 * s,
  rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.12, 0.78, 0.2, E_OUT), l: at(-1, -0.12, 0.78, 0.2, E_OUT), handR: 0.3, handL: 0.3,
});

// --- Khaleeji step: a small drop step on bent knees, the hands lifting the thobe sleeves to frame the face ---------
const kStep = (s: 1 | -1, drop: boolean): PoseSpec => ({
  y: drop ? -0.1 : -0.05, x: 0.02 * s, hips: 0.03 * s, tilt: 4 * s, head: 6 * s, turn: 8 * s,
  rf: s > 0 ? [0.1, 0, 0.02] : [0.08, drop ? 0 : 0.02, 0.0], lf: s > 0 ? [-0.08, drop ? 0 : 0.02, 0.0] : [-0.1, 0, 0.02],
  kneeR: drop ? 0.16 : 0.06, kneeL: drop ? 0.16 : 0.06, pitchR: s < 0 ? 18 : 0, pitchL: s > 0 ? 18 : 0,
  r: at(1, 0.19, 0.96 + (s > 0 ? 0.03 : 0), 0.12, E_OUT), l: at(-1, -0.19, 0.96 + (s < 0 ? 0.03 : 0), 0.12, E_OUT), handR: 0.4, handL: 0.4,
});

// --- Saidi cane hop: a cane held up overhead in one hand, hop on one foot with the other knee up, step down ---------
const caneUp = (twirl: number): PoseSpec => ({ r: at(1, 0.18 + twirl, 1.05, 0.06, E_UP), l: at(-1, -0.2, 0.58, 0.04, [1, 0, -0.4]), handR: 0, handL: 1 });
const sLand: PoseSpec = { y: -0.1, bend: 3, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.14, kneeL: 0.14, ...caneUp(0) };
const sHop: PoseSpec = { y: 0.04, bend: 0, rf: [0.09, 0.03, 0], lf: [-0.11, 0.2, 0.06], kneeR: 0.06, kneeL: 0.3, ...caneUp(0.05) };
const sDown: PoseSpec = { y: -0.08, bend: 3, rf: [0.09, 0, 0], lf: [-0.11, 0, 0.04], kneeR: 0.1, kneeL: 0.12, ...caneUp(-0.03) };

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  full({
    id: 'hip-lifts', name: 'Belly Dance Hip Lifts', tags: 'latin pop | hips | hips bellydance', beats: 2, level: 'low', d: 1, parts: ['hips'], mirror: true,
    desc: 'One foot a little forward on its ball and the arms held out softly: punch that hip straight up on the beat by straightening the knee, let it fall on the "and", lift again; switch sides.',
    keys: [[0, lift(true)], [0.5, lift(false)], [1, lift(true)], [1.5, lift(false)]],
  }),
  full({
    id: 'hip-slides', name: 'Hip Slides', tags: 'latin pop | hips | hips bellydance', beats: 2, level: 'low', d: 1, parts: ['hips'], bounce: 0.2,
    desc: 'Knees soft and arms held out at shoulder height: glide the hips straight out to one side and then the other, the chest staying still in the middle.',
    keys: [[0, slide(1)], [1, slide(-1)]],
  }),
  full({
    id: 'maya', name: 'Maya', tags: 'latin pop | hips | hips wave bellydance', beats: 4, level: 'mid', d: 2, parts: ['hips', 'torso'], mirror: true, bounce: 0.1,
    desc: 'A vertical figure eight of the hips, one arm curved overhead and the other out: lift one hip up and out, let it drop and roll in, then lift the other up and out and drop it, smoothly, without stopping.',
    keys: [[0, maya(0)], [1, maya(1)], [2, maya(2)], [3, maya(3)]],
  }),
  full({
    id: 'hip-shimmy', name: 'Hip Shimmy', tags: 'latin pop | hips | shake hips bellydance', beats: 2, level: 'mid', d: 2, parts: ['hips', 'arms'],
    desc: 'Arms curved up framing the head, knees soft: straighten the knees alternately as fast as you can so the hips shimmer from side to side, the upper body calm.',
    keys: [[0, shim(1)], [0.25, shim(-1)], [0.5, shim(1)], [0.75, shim(-1)], [1, shim(1)], [1.25, shim(-1)], [1.5, shim(1)], [1.75, shim(-1)]],
  }),
  full({
    id: 'khaleeji-hair-toss', name: 'Khaleeji Hair Toss', tags: 'pop latin | full | shake bellydance', beats: 2, level: 'mid', d: 2, parts: ['torso', 'arms'],
    desc: 'The Gulf hair dance: in a wide stance with soft knees and the hands holding the dress at the chest, swing the head and the hair from side to side with the upper body, a big toss on every beat.',
    keys: [[0, toss(1, -0.09)], [1, toss(-1, -0.09)]],
  }),
  full({
    id: 'khaleeji-step', name: 'Khaleeji Drop Step', tags: 'pop latin | legs arms | hands bellydance', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], bounce: 0.2,
    desc: 'A small, limping drop step on bent knees, the hands holding the wide sleeves up beside the face to frame it, the head tilting toward the stepping foot.',
    keys: [[0, kStep(1, true)], [0.5, kStep(1, false)], [1, kStep(-1, true)], [1.5, kStep(-1, false)]],
  }),
  full({
    id: 'saidi-cane-hop', name: 'Saidi Cane Hop', tags: 'party latin | legs arms | jump bellydance', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump', 'arms'], mirror: true, jump: true, impact: true,
    desc: 'Saidi style, a cane held up overhead in one hand and the other hand on the hip: hop on one foot pulling the other knee up, step it down in front, and hop again; switch sides.',
    keys: [[0, sLand], [0.5, sHop], [1, sDown], [1.5, { ...sHop, y: 0.03 }]],
  }),
];
