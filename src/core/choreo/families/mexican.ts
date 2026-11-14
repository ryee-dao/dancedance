/**
 * Regional Mexican and cumbia: more moves for the `mexican` and `cumbia`
 * sets (ids in ../genreSets/variety.ts). The basics are in families/latin.ts
 * and retro.ts (folklórico skirt, hat-dance heels; the cumbia step,
 * machete, sau, candle).
 *
 *   mexican   folklórico zapateado (heel, ball, flat strikes), the huapango
 *             campanas (weight shifting side to side with two heel strikes
 *             a side), puntas, the remate (a run of stamps closing a phrase
 *             into a held pose), the banda caballito (the trotting bounce of
 *             tecnobanda) and the quebradita hop. Banda and norteño 100-140
 *             BPM, huapango ~120-150, folklórico sones up to ~160.
 *   cumbia    the side basic of cumbia sonidera, the Colombian kick-and-
 *             step-back basic, the circular basic (the back break turning a
 *             quarter a bar), the turn, the men's hat sway and the women's
 *             pollera (skirt) wave. Cumbia 85-110 BPM.
 *
 * Sources: Dance Spirit "Baile folklórico", mexicotravelandleisure.com on
 * huapango, Wikipedia "Quebradita", the AAHPERD "Dances from Mexico"
 * handout, salsavida.com cumbia dancepedia, classpop.com "How to dance
 * cumbia", and a traditional cumbia colombiana tutorial (skirt and hat
 * work). All are hand-authored full-body moves (no shared layer patterns).
 */
import { FIST, at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

/** Folklórico men's arms: hands clasped behind the back, chest proud. */
const BACK_HANDS: PoseSpec = { r: at(1, 0.05, 0.52, -0.12, [1, 0, -0.5]), l: at(-1, -0.05, 0.52, -0.12, [1, 0, -0.5]), ...FIST };
/** Holding a wide skirt out at the hips. */
const SKIRT: PoseSpec = { r: at(1, 0.3, 0.52, 0.08, E_OUT), l: at(-1, -0.3, 0.52, 0.08, E_OUT), handR: 0.3, handL: 0.3 };

// --- Zapateado: heel strike, ball, flat stamp, in place ---------------------------------------
const zHeel: PoseSpec = { y: -0.07, bend: -3, rf: [0.12, 0.01, 0.1], lf: [-0.08, 0, 0], pitchR: -28, kneeL: 0.1, ...SKIRT };
const zKnee: PoseSpec = { y: -0.04, bend: -3, rf: [0.09, 0.13, 0.04], lf: [-0.08, 0, 0], pitchR: -10, kneeR: 0.35, ...SKIRT };
const zFlat: PoseSpec = { y: -0.11, bend: -2, nod: 3, rf: [0.08, 0, 0.0], lf: [-0.08, 0, 0], kneeR: 0.12, kneeL: 0.08, ...SKIRT, r: at(1, 0.31, 0.5, 0.08, E_OUT), l: at(-1, -0.31, 0.5, 0.08, E_OUT) };
const zLift: PoseSpec = { y: -0.05, bend: -3, rf: [0.08, 0, 0], lf: [-0.09, 0.13, 0.03], pitchL: -10, kneeL: 0.35, kneeR: 0.06, ...SKIRT };

// --- Campanas (huapango): weight to one side, the other heel striking twice ------------------
const camp = (side: 1 | -1, hit: boolean): PoseSpec => ({
  x: 0.035 * side, y: hit ? -0.09 : -0.06, hips: 0.03 * side, tilt: 4 * side, lean: -3 * side, head: 3 * side,
  rf: side > 0 ? [0.12, 0, 0] : [0.05, hit ? 0.0 : 0.03, 0.07], lf: side > 0 ? [-0.05, hit ? 0.0 : 0.03, 0.07] : [-0.12, 0, 0],
  pitchR: side < 0 ? -22 : 0, pitchL: side > 0 ? -22 : 0, kneeR: 0.08, kneeL: 0.08, ...BACK_HANDS,
});

// --- Puntas: one foot taps the toe out, alternating, the skirt swept up on the other side ----------
const punta = (side: 1 | -1): PoseSpec => ({
  y: -0.07, hips: -0.025 * side, tilt: -3 * side,
  rf: side > 0 ? [0.2, 0, 0.05] : [0.08, 0, 0], lf: side > 0 ? [-0.08, 0, 0] : [-0.2, 0, 0.05],
  pitchR: side > 0 ? 40 : 0, pitchL: side < 0 ? 40 : 0, kneeR: side > 0 ? -0.2 : 0.1, kneeL: side < 0 ? -0.2 : 0.1, lean: 3 * side, head: -4 * side,
  // Faldeo in opposition: the skirt swept up high on the side away from the pointing foot.
  r: side < 0 ? at(1, 0.34, 0.92, 0.1, E_OUT) : at(1, 0.28, 0.5, 0.08, E_OUT), l: side > 0 ? at(-1, -0.34, 0.92, 0.1, E_OUT) : at(-1, -0.28, 0.5, 0.08, E_OUT), handR: 0.3, handL: 0.3,
});
const puntaIn: PoseSpec = { y: -0.04, hips: 0, tilt: 0, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.04, kneeL: 0.04, pitchR: 0, pitchL: 0, ...SKIRT };

// --- Remate: three quick stamps, then a held pose, hat (or skirt) flung up -------------------
const remStamp = (side: 1 | -1, y: number): PoseSpec => ({
  y, bend: 4, nod: 6, hips: 0.015 * side, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: side > 0 ? 0.16 : 0.06, kneeL: side < 0 ? 0.16 : 0.06, ...BACK_HANDS,
});
const remPose: PoseSpec = {
  y: -0.05, bend: -6, nod: -8, lean: -4, rf: [0.2, 0, 0.04], lf: [-0.1, 0, 0], pitchR: -20, kneeL: 0.06,
  r: at(1, 0.3, 1.02, 0.06, E_UP), l: at(-1, -0.2, 0.5, -0.06, [1, 0, -0.5]), handR: 0.3, handL: 0,
};

// --- Caballito: the trotting horse bounce, knees pumping, one hand up as if holding the hat, the other at the reins ----------
const cab = (side: 1 | -1, low: boolean): PoseSpec => ({
  y: low ? -0.13 : -0.05, bend: 8, nod: low ? 6 : 0, hips: 0.02 * side, tilt: 2 * side,
  rf: [0.11, side > 0 && !low ? 0.05 : 0, 0.02], lf: [-0.11, side < 0 && !low ? 0.05 : 0, 0.02],
  kneeR: low ? 0.18 : 0.08, kneeL: low ? 0.18 : 0.08,
  r: at(1, 0.24, 1.0 + (low ? -0.03 : 0.02), 0.06, E_UP), l: at(-1, -0.05, low ? 0.6 : 0.66, 0.24, E_DOWN), handR: 0.3, handL: 0,
});

// --- Quebradita hop: hop onto one foot with the other kicked forward-out, land, switch ----------
const qLand: PoseSpec = {
  y: -0.11, x: 0.03, lean: -3, bend: 4, rf: [0.12, 0, 0], lf: [-0.16, 0.08, 0.1], kneeR: 0.14, kneeL: 0.05, pitchL: -15,
  r: at(1, 0.3, 0.98, 0.06, E_UP), l: at(-1, -0.22, 0.62, 0.15, E_OUT), handR: 0.3, handL: 0.3,
};
const qAir: PoseSpec = {
  y: 0.04, x: 0, lean: 0, bend: 2, rf: [0.1, 0.05, 0.01], lf: [-0.1, 0.05, 0.01], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.24, 1.02, 0.06, E_UP), l: at(-1, -0.2, 0.66, 0.15, E_OUT), handR: 0.3, handL: 0.3,
};

// --- Cumbia --------------------------------------------------------------------------
/** Cumbia arms: elbows bent, forearms forward at the waist, swinging with the hips. */
const cArms = (s: number): PoseSpec => ({ r: at(1, 0.2 + 0.03 * s, 0.66, 0.15, E_OUT), l: at(-1, -0.2 + 0.03 * s, 0.66, 0.15, E_OUT), handR: 0.5, handL: 0.5 });

// Side basic (sonidera): side, together, side, with the hips swaying and the knees soft, then the other way.
const csb = (x: number, rf: number, lf: number, s: number, y: number): PoseSpec => ({
  x, y, hips: 0.04 * s, tilt: 5 * s, lean: -2 * s, rf: [rf, 0, 0], lf: [lf, 0, 0], kneeR: 0.06, kneeL: 0.06, ...cArms(s),
});

// Kick and step back (Colombian basic), on the diagonal so the kick and the back step read.
const ckKick: PoseSpec = { spin: 28, y: -0.04, lean: -3, rf: [0.09, 0.14, 0.2], lf: [-0.08, 0, 0], kneeL: 0.06, hips: -0.02, ...cArms(-1) };
const ckBack: PoseSpec = { spin: 28, y: -0.09, lean: 2, hips: 0.04, tilt: 5, hipTwist: 10, rf: [0.11, 0, -0.14], lf: [-0.08, 0, 0], kneeR: 0.12, pitchR: 20, ...cArms(1) };
const ckBack2: PoseSpec = { spin: 28, y: -0.06, hips: -0.02, tilt: -2, rf: [0.09, 0, 0], lf: [-0.08, 0, 0], ...cArms(0) };

// Circular basic: the back break and replace, turning a quarter on each bar.
const circ = (spin: number, back: boolean): PoseSpec => ({
  spin, y: back ? -0.07 : -0.04, hips: back ? 0.035 : -0.015, tilt: back ? 4 : -1, hipTwist: back ? 10 : 0,
  rf: back ? [0.12, 0, -0.13] : [0.08, 0, 0], lf: [-0.08, 0, 0], pitchR: back ? 20 : 0, kneeR: back ? 0.1 : 0.04, ...cArms(back ? 1 : 0),
});

// Hat sway: the hat held out in one hand, waved on the sway, the other hand behind; the dragging step.
const hat = (s: 1 | -1, drag: boolean): PoseSpec => ({
  x: 0.04 * s, y: drag ? -0.05 : -0.09, hips: 0.03 * s, tilt: 3 * s, lean: -3 * s, head: 4 * s,
  rf: s > 0 ? [0.17, 0, 0] : [drag ? 0.02 : -0.04, drag ? 0.012 : 0, 0], lf: s > 0 ? [drag ? -0.02 : 0.04, drag ? 0.012 : 0, 0] : [-0.17, 0, 0],
  slideR: s < 0 && drag, slideL: s > 0 && drag, kneeR: 0.1, kneeL: 0.1,
  r: at(1, s > 0 ? 0.36 : 0.2, s > 0 ? 0.9 : 0.78, 0.12, E_OUT), l: at(-1, -0.05, 0.52, -0.12, [1, 0, -0.5]), handR: 0.2, handL: 0,
});

// Pollera wave: both hands hold the skirt edges and swing it in big arcs from side to side on the slide step.
const pol = (s: 1 | -1, y: number): PoseSpec => ({
  x: 0.03 * s, y, hips: 0.04 * s, tilt: 5 * s, lean: 4 * s, head: 5 * s,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: s > 0 ? 0.06 : 0.12, kneeL: s > 0 ? 0.12 : 0.06,
  r: at(1, s > 0 ? 0.36 : 0.18, s > 0 ? 0.86 : 0.5, 0.1, E_OUT), l: at(-1, s > 0 ? -0.18 : -0.36, s > 0 ? 0.5 : 0.86, 0.1, E_OUT), handR: 0.3, handL: 0.3,
});

export const patterns: PatternSet = {};

const mexican: MoveDef[] = [
  full({
    id: 'zapateado', name: 'Zapateado', tags: 'latin party | legs | stomp', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true, impact: true,
    desc: 'Folklórico footwork in place, holding the skirt out at the hips: strike one heel out in front, lift that knee, stamp the foot flat, then lift the other knee ready to start with that heel.',
    keys: [[0, zHeel], [0.5, zKnee], [1, zFlat], [1.5, zLift]],
  }),
  full({
    id: 'campanas', name: 'Campanas', tags: 'latin party | legs hips | stomp', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'],
    desc: 'Huapango step, hands behind the back: shift the weight to one side and strike the other heel on the floor in front twice, then shift to the other side and strike twice with the other heel.',
    keys: [[0, camp(1, true)], [0.5, camp(1, false)], [1, camp(-1, true)], [1.5, camp(-1, false)]],
  }),
  full({
    id: 'puntas', name: 'Puntas', tags: 'latin party | legs |', beats: 2, level: 'low', d: 1, parts: ['legs'],
    desc: 'Tap one pointed toe out to the side with the knee turned in while the opposite hand sweeps the skirt up high (faldeo in opposition), bring it back, then tap the other.',
    keys: [[0, punta(1)], [0.5, puntaIn], [1, punta(-1)], [1.5, puntaIn]],
  }),
  full({
    id: 'remate', name: 'Remate', tags: 'latin party | legs arms | stomp', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'The flourish that closes a phrase: hands behind the back, three quick stamps right, left, right, then plant the heel out in front and fling one hand up high as if raising the hat, chest proud, and hold.',
    keys: [[0, remStamp(1, -0.11)], [0.5, remStamp(-1, -0.1)], [1, remStamp(1, -0.12)], [2, remPose], [3, { ...remPose, y: -0.06, nod: -6 }]],
  }),
  full({
    id: 'caballito', name: 'Caballito', tags: 'latin party | legs full |', beats: 2, level: 'mid', d: 1, parts: ['legs', 'arms'], impact: true,
    desc: 'The banda trot: bounce hard in the knees on every beat as if riding a horse at a trot, heels lifting in turn, one hand up as if holding the hat and the other fist low in front holding the reins.',
    keys: [[0, cab(1, true)], [0.5, cab(1, false)], [1, cab(-1, true)], [1.5, cab(-1, false)]],
  }),
  full({
    id: 'quebradita-hop', name: 'Quebradita Hop', tags: 'latin party | legs | jump kick', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'Hop onto one foot with the other kicked out low in front on the diagonal, one hand up holding the hat, hop and switch feet.',
    keys: [[0, qLand], [0.5, qAir], [1, mir(qLand)], [1.5, mir(qAir)]],
  }),
];

const cumbia: MoveDef[] = [
  full({
    id: 'cumbia-side-basic', name: 'Cumbia Side Basic', tags: 'latin pop | legs hips | hips walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true, travel: 0.2,
    desc: 'Cumbia sonidera side basic: step to the side, close, step to the side again and touch, the hips swaying with each step and the bent arms swinging with them; go back the other way.',
    keys: [
      [0, csb(0.05, 0.2, -0.09, 1, -0.07)],
      [1, csb(0.09, 0.2, 0.07, -1, -0.05)],
      [2, csb(0.16, 0.31, 0.07, 1, -0.07)],
      [3, { ...csb(0.2, 0.31, 0.2, -1, -0.06), lf: [0.2, 0.015, 0.01] }],
    ],
  }),
  full({
    id: 'cumbia-kick-back', name: 'Cumbia Kick & Back', tags: 'latin pop | legs hips | kick', beats: 4, level: 'mid', d: 2, parts: ['legs', 'hips'], mirror: true,
    desc: 'The Colombian basic, turned a little to the diagonal: kick one foot low forward, step it back behind with the hip pushing out, replace the weight and pause; then the other foot.',
    keys: [[0, ckKick], [1, ckBack], [2, ckBack2], [3, { ...ckBack2, y: -0.05, hips: 0, tilt: 0 }]],
  }),
  full({
    id: 'cumbia-circle', name: 'Cumbia Circle Basic', tags: 'latin pop | legs turn | walk spin', beats: 4, level: 'mid', d: 2, parts: ['legs', 'turn'], mirror: true,
    desc: 'The cumbia back break and replace, turning a quarter on each one so the basic goes round in a full circle, the hips swaying with every break.',
    keys: [[0, circ(0, true)], [0.5, circ(45, false)], [1, circ(90, true)], [1.5, circ(135, false)], [2, circ(180, true)], [2.5, circ(225, false)], [3, circ(270, true)], [3.5, circ(315, false)]],
  }),
  full({
    id: 'cumbia-hat-sway', name: 'Cumbia Hat Sway', tags: 'latin pop | arms legs | wave', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'The men\'s cumbia: hold the hat out in one hand and wave it out and up as you step to that side, dragging the other foot in along the floor, the other hand behind the back; sway back the other way.',
    keys: [[0, hat(1, false)], [1, hat(1, true)], [2, hat(-1, false)], [3, hat(-1, true)]],
  }),
  full({
    id: 'pollera-wave', name: 'Pollera Wave', tags: 'latin pop | arms hips | wave hips', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.3,
    desc: 'The women\'s cumbia: hold the edges of a wide skirt in both hands and swing it in big arcs from side to side, one hand high and the other low, the hips swaying with it on a small sliding step.',
    keys: [[0, pol(1, -0.07)], [1, pol(-1, -0.07)]],
  }),
  full({
    id: 'cumbia-turn', name: 'Cumbia Turn', tags: 'latin pop | turn | spin', beats: 4, level: 'mid', d: 2, parts: ['turn', 'legs'], mirror: true,
    desc: 'Break back with the hip on the cumbia basic, replace, then turn all the way round on the spot over two beats with one hand up and the other at the waist, and face front.',
    keys: [
      [0, { ...circ(0, true) }],
      [1, { ...circ(0, false) }],
      [2, { y: -0.04, spin: 120, rf: [0.055, 0, 0], lf: [-0.055, 0, 0], pitchR: 14, pitchL: 14, r: at(1, 0.06, 1.05, 0.06, E_UP), l: at(-1, -0.17, 0.66, 0.16, E_OUT), handR: 0.7, handL: 0.5 }],
      [2.5, { y: -0.03, spin: 240, rf: [0.055, 0, 0], lf: [-0.055, 0, 0], pitchR: 14, pitchL: 14, r: at(1, 0.06, 1.05, 0.06, E_UP), l: at(-1, -0.17, 0.66, 0.16, E_OUT), handR: 0.7, handL: 0.5 }],
      [3, { y: -0.06, spin: 0, hips: 0.03, tilt: 4, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], ...cArms(1) }],
    ],
  }),
];

export const moves: MoveDef[] = [...mexican, ...cumbia];
