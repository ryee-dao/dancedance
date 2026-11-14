/**
 * More Latin dances, for the thin Latin-dance sets (ids in
 * ../genreSets/variety.ts): bachata, tango, flamenco, regional Mexican and
 * cumbia. The basics are in families/latin.ts (bachata side / forward
 * basics, the tango walk, flamenco arms / palmas / turn and the paso doble
 * cape, folklórico skirt, the cumbia step, machete, sau, candle); this file
 * adds each dance's next most recognisable solo steps, staged for a figure
 * seen from the front (a forward step or a pivot is turned to the diagonal
 * so it reads).
 *
 *   bachata   (120-135 BPM, steps on 1-2-3, tap / hip on 4) the solo turn,
 *             the body wave of modern (sensual) bachata, the hair-comb
 *             styling, Dominican cross-step footwork, the double tap.
 *   tango     (Argentine 60-70 bars, ballroom ~120 BPM, counted slow =
 *             2 beats) forward ochos, the boleo, the cruzada, the lunge
 *             (corté), the caricia, the molinete grapevine.
 *
 * Sources: salsavida.com and goandance.com bachata basics; tango
 * technique (ochos, boleos, cruzada, molinete, adornos) from tango
 * teaching glossaries and class footage. All are hand-authored full-body
 * moves (no shared layer patterns), named for their dance where that is
 * the step's own name.
 */
import { at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

// ---------------------------------------------------------------------------
// Bachata

/** Bachata solo arms: elbows soft, hands loose at the waist in front. */
const BACH_ARMS: PoseSpec = { r: at(1, 0.2, 0.64, 0.15, E_OUT), l: at(-1, -0.2, 0.64, 0.15, E_OUT), handR: 0.6, handL: 0.6 };
const BELLY_L = at(-1, -0.04, 0.6, 0.18, [1, -0.4, 0]);

// Turn: a full turn travelling to the side on 1-2-3, one hand up over the head, tap and hip on 4.
const btTurn = (x: number, spin: number, up: boolean): PoseSpec => ({
  x, y: -0.04, spin, rf: [x + 0.055, 0, 0], lf: [x - 0.055, 0, 0], pitchR: 14, pitchL: 14,
  r: up ? at(1, 0.06, 1.06, 0.06, E_UP) : at(1, 0.2, 0.75, 0.12, E_OUT), l: at(-1, -0.17, 0.66, 0.16, E_OUT), handR: 0.8, handL: 0.6,
});

// Hair comb: a hand drawn up the front of the face and back over the crown on the side basic.
const hcArm = (k: number): PoseSpec => ({
  r: [at(1, 0.05, 0.86, 0.17, E_DOWN), at(1, 0.06, 0.98, 0.15, E_OUT), at(1, 0.06, 1.07, 0.02, E_UP), at(1, 0.13, 0.95, -0.08, E_OUT)][k],
  l: BELLY_L, handR: 1, handL: 1,
});

// Body wave in quarter profile: chest leads up and forward, then the hips follow through, sinking.
const wave = (x: number, bend: number, nod: number, y: number, hz: number, hx: number, hy: number, feet: PoseSpec): PoseSpec => ({
  spin: 28, x, y, bend, nod, hips: hz, ...feet,
  r: at(1, hx, hy, 0.17, E_DOWN), l: at(-1, -0.24, 0.62, 0.08, E_OUT), handR: 1, handL: 0.8,
});

// Dominican cross step: one foot crosses in front with the hip, out again, the other crosses.
const dom = (side: 1 | -1, cross: boolean): PoseSpec => {
  const s = side;
  return {
    y: cross ? -0.09 : -0.05, spin: cross ? -14 * s : 0, hips: -0.045 * s * (cross ? 1 : 0.3), tilt: -7 * s * (cross ? 1 : 0.3), twist: cross ? -6 * s : 0, turn: cross ? -4 * s : 0,
    rf: s > 0 ? (cross ? [-0.08, 0, 0.08] : [0.14, 0, 0]) : [0.1, 0, 0],
    lf: s > 0 ? [-0.1, 0, 0] : (cross ? [0.08, 0, 0.08] : [-0.14, 0, 0]),
    kneeR: 0.1, kneeL: 0.1, pitchR: s > 0 && cross ? 16 : 0, pitchL: s < 0 && cross ? 16 : 0,
    r: at(1, 0.22, 0.63, 0.15, E_OUT), l: at(-1, -0.22, 0.63, 0.15, E_OUT), handR: 0.3, handL: 0.3,
  };
};

// ---------------------------------------------------------------------------
// Tango

/**
 * Solo tango embrace, held as if with a partner in front: the left hand up and out at head height (the
 * joined hands), the right arm curved round in front of the chest (the partner's back).
 */
const EMBRACE: PoseSpec = { l: at(-1, -0.34, 0.9, 0.12, [1, -0.6, -0.2]), r: at(1, -0.04, 0.8, 0.23, [1, -0.1, 0]), handR: 1, handL: 0.7 };

// Forward ochos: the hips pivot to a diagonal and the free leg steps forward across, the chest staying to the front.
const ocho = (side: 1 | -1, step: boolean): PoseSpec => ({
  y: step ? -0.1 : -0.07, spin: 34 * side, twist: -22 * side, turn: -10 * side, hips: 0.02 * side, tilt: 2 * side,
  rf: side > 0 ? [0.055, 0, step ? 0.13 : 0.02] : [0.06, 0, step ? -0.02 : 0.0],
  lf: side > 0 ? [-0.06, 0, step ? -0.02 : 0.0] : [-0.055, 0, step ? 0.13 : 0.02],
  kneeR: side > 0 && step ? 0.05 : 0.12, kneeL: side < 0 && step ? 0.05 : 0.12,
  pitchR: side < 0 && step ? 20 : 0, pitchL: side > 0 && step ? 20 : 0, ...EMBRACE,
});

// Boleo: from a pivot the free lower leg whips up behind and wraps across, then releases to a point.
const boleoBack: PoseSpec = {
  y: -0.09, spin: 30, twist: -18, turn: -12, rf: [0.06, 0, -0.16], lf: [-0.06, 0, 0.0], pitchR: 30, kneeL: 0.12, ...EMBRACE,
};
const boleoTurn: PoseSpec = {
  y: -0.08, spin: 4, twist: 2, turn: 0, rf: [0.02, 0.12, -0.17], lf: [-0.06, 0, 0.0], pitchR: 34, kneeR: 0.05, kneeL: 0.13, ...EMBRACE,
};
const boleoWhip: PoseSpec = {
  y: -0.08, spin: -24, twist: 18, turn: 14, rf: [0.04, 0.17, -0.1], lf: [-0.06, 0, 0.0], pitchR: 40, kneeR: 0.15, kneeL: 0.14, ...EMBRACE,
};
const boleoLand: PoseSpec = {
  y: -0.1, spin: -12, twist: 8, turn: 18, rf: [0.0, 0, -0.1], lf: [-0.06, 0, 0], pitchR: 30, kneeR: 0.1, kneeL: 0.14, ...EMBRACE,
};
const boleoClose: PoseSpec = { y: -0.06, spin: 0, twist: 0, turn: 0, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], pitchR: 10, ...EMBRACE };

// Cruzada: two walking steps to the side on the diagonal, then the left foot crosses in front and the head turns.
const cruz = (x: number, rf: number, lf: number, lfz: number, turn: number, y: number): PoseSpec => ({
  x, y, spin: 20, turn, twist: -4, rf: [rf, 0, 0], lf: [lf, 0, lfz], kneeR: 0.1, kneeL: 0.08, ...EMBRACE,
});

// Lunge (corté): step out into a deep lunge on a bent knee, the body leaning away, head turned out, held.
const lungeOut: PoseSpec = {
  x: 0.07, y: -0.2, spin: 25, lean: -10, bend: -6, turn: 34, head: 8,
  rf: [0.3, 0, -0.04], lf: [-0.12, 0, 0.04], kneeR: 0.3, kneeL: 0, pitchL: 0, ...EMBRACE,
};
const lungeHold: PoseSpec = { ...lungeOut, y: -0.21, lean: -12, turn: 38 };
const lungeUp: PoseSpec = { x: 0.01, y: -0.07, spin: 10, lean: 0, bend: -2, turn: -10, head: 0, rf: [0.08, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.08, kneeL: 0.08, ...EMBRACE };

// Caricia: the free foot strokes up the inside of the standing leg's calf and down again.
const caricia = (h: number, y: number): PoseSpec => ({
  y, spin: 20, turn: -14, head: -3, rf: [0.02, h, -0.02 + h * 0.1], lf: [-0.07, 0, 0], kneeR: 0.4 + h * 1.2, kneeL: 0.1, pitchR: 30, ...EMBRACE,
});

// Molinete: a grapevine with the hips pivoting at each step: side, back cross, side, front cross.
const moli = (x: number, spin: number, rf: readonly [number, number, number], lf: readonly [number, number, number], y: number): PoseSpec => ({
  x, y, spin, twist: -spin * 0.6, turn: -spin * 0.3, rf: [...rf], lf: [...lf], kneeR: 0.1, kneeL: 0.1, ...EMBRACE,
});

export const patterns: PatternSet = {};

const bachata: MoveDef[] = [
  full({
    id: 'bachata-turn', name: 'Bachata Turn', tags: 'latin pop | turn legs | spin hips', beats: 4, level: 'mid', d: 2, parts: ['turn', 'legs'], mirror: true, travel: 0.24,
    desc: 'Make a full turn travelling to the side on 1-2-3, one hand curved up over the head and the other at the waist, then face front and tap the other foot in with a hip pop on 4; turn back the other way.',
    keys: [
      [0, btTurn(0.07, 110, true)],
      [1, btTurn(0.14, 240, true)],
      [2, { ...btTurn(0.21, 0, false), rf: [0.3, 0, 0], lf: [0.13, 0, 0], pitchR: 0, pitchL: 0 }],
      [3, { x: 0.24, y: -0.07, hips: -0.04, tilt: -7, rf: [0.3, 0, 0], lf: [0.2, 0.015, 0.01], kneeR: 0.08, kneeL: -0.15, pitchL: 25, ...BACH_ARMS }],
    ],
  }),
  full({
    id: 'bachata-body-wave', name: 'Bachata Body Wave', tags: 'latin funk | full hips | wave hips', beats: 4, level: 'mid', d: 2, parts: ['torso', 'hips'], mirror: true, bounce: 0.2,
    desc: 'Modern bachata on the side basic, turned a little to the diagonal: lift the chest up and forward as you step, let the wave roll down through the ribs to the hips as you close, sink and push the hips through, then rise and tap with a hip pop, one hand tracing down the body.',
    keys: [
      [0, wave(0.04, -12, -10, -0.03, 0.0, 0.05, 0.84, { rf: [0.19, 0, 0], lf: [-0.08, 0, 0] })],
      [1, wave(0.07, 14, 8, -0.06, -0.02, 0.07, 0.7, { rf: [0.19, 0, 0], lf: [0.04, 0, 0] })],
      [2, wave(0.12, 2, 2, -0.13, 0.04, 0.12, 0.56, { rf: [0.27, 0, 0], lf: [0.04, 0, 0], kneeR: 0.12, kneeL: 0.12 })],
      [3, { ...wave(0.14, -4, -2, -0.06, -0.04, 0.18, 0.62, { rf: [0.27, 0, 0], lf: [0.15, 0.015, 0.01] }), tilt: -7, kneeL: -0.15, pitchL: 25 }],
    ],
  }),
  full({
    id: 'bachata-hair-comb', name: 'Bachata Hair Comb', tags: 'latin pop | arms hips | hands hips', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true, travel: 0.2,
    desc: 'On the side basic (side, together, side, tap with a hip pop), draw one hand up the front of the face and back over the crown as if combing the hair, the other hand on the belly; comb with the other hand going back.',
    keys: [
      [0, { x: 0.05, y: -0.05, hips: 0.03, tilt: 3, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.06, nod: 2, ...hcArm(0) }],
      [1, { x: 0.09, y: -0.04, hips: -0.01, tilt: -1, rf: [0.2, 0, 0], lf: [0.08, 0, 0], nod: -2, ...hcArm(1) }],
      [2, { x: 0.16, y: -0.05, hips: 0.03, tilt: 3, rf: [0.3, 0, 0], lf: [0.08, 0, 0], kneeR: 0.06, nod: -8, head: 4, ...hcArm(2) }],
      [3, { x: 0.2, y: -0.07, hips: -0.045, tilt: -7, rf: [0.3, 0, 0], lf: [0.18, 0.015, 0.01], kneeL: -0.15, pitchL: 25, nod: -4, head: 6, ...hcArm(3) }],
    ],
  }),
  full({
    id: 'dominican-cross-step', name: 'Dominican Cross Step', tags: 'latin | legs hips | hips walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'],
    desc: 'Dominican bachata footwork in place: cross one foot over in front on the beat with the hip, step it back out on the "and", then cross the other; the hips working on every step, the arms bent loose at the waist.',
    keys: [[0, dom(1, true)], [0.5, dom(1, false)], [1, dom(-1, true)], [1.5, dom(-1, false)]],
  }),
  full({
    id: 'bachata-double-tap', name: 'Bachata Double Tap', tags: 'latin | legs hips | hips', beats: 4, level: 'low', d: 2, parts: ['legs', 'hips'], mirror: true,
    desc: 'Step in place right, left, right, then tap the free foot twice on 4-and, first in front and then out to the side, popping the hip on each tap; start with the other foot.',
    keys: [
      [0, { x: 0.02, y: -0.05, hips: 0.03, tilt: 3, rf: [0.11, 0, 0], lf: [-0.09, 0.01, 0], ...BACH_ARMS }],
      [1, { x: -0.02, y: -0.05, hips: -0.03, tilt: -3, rf: [0.11, 0.01, 0], lf: [-0.09, 0, 0], ...BACH_ARMS }],
      [2, { x: 0.02, y: -0.05, hips: 0.03, tilt: 3, rf: [0.11, 0, 0], lf: [-0.09, 0.01, 0], ...BACH_ARMS }],
      [3, { x: 0.03, y: -0.09, spin: -18, hips: 0.05, tilt: 8, turn: -8, rf: [0.11, 0, 0], lf: [-0.07, 0.015, 0.15], pitchL: -24, kneeL: -0.15, ...BACH_ARMS }],
      [3.5, { x: 0.04, y: -0.08, hips: 0.05, tilt: 8, turn: -18, lean: 4, rf: [0.11, 0, 0], lf: [-0.3, 0.015, 0.02], pitchL: 30, ...BACH_ARMS, l: at(-1, -0.36, 0.7, 0.08, E_OUT), handL: 1 }],
    ],
  }),
];

const tango: MoveDef[] = [
  full({
    id: 'tango-ocho', name: 'Tango Forward Ochos', tags: 'latin pop | legs hips | walk twist', beats: 4, level: 'mid', d: 2, parts: ['legs', 'hips'],
    desc: 'In the tango embrace, pivot the hips to one diagonal and step forward across with the free foot, the chest staying to the front, collect the feet and pivot, then step across to the other diagonal: a figure eight on the floor.',
    keys: [[0, ocho(1, true)], [1, { ...ocho(1, false), spin: 0, twist: 0, turn: 0 }], [2, ocho(-1, true)], [3, { ...ocho(-1, false), spin: 0, twist: 0, turn: 0 }]],
  }),
  full({
    id: 'tango-boleo', name: 'Tango Boleo', tags: 'latin pop | legs | kick twist', beats: 4, level: 'high', d: 3, parts: ['legs', 'hips'], mirror: true,
    desc: 'From a back step in the embrace, pivot sharply the other way so the free lower leg whips up behind with the knees together, let it unwind back down to a crossed toe behind, and close.',
    keys: [[0, boleoBack], [0.5, boleoTurn], [1, boleoWhip], [2, boleoLand], [3, boleoClose]],
  }),
  full({
    id: 'tango-cruzada', name: 'Tango Cruzada', tags: 'latin pop | legs | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'torso'], mirror: true, travel: 0.14,
    desc: 'Walk two slow steps to the side on the diagonal in the embrace, then cross the free foot in front of the other (the cruzada) and hold it, turning the head to look out over the crossed feet.',
    keys: [
      [0, cruz(0.04, 0.17, -0.08, 0, -6, -0.08)],
      [1, cruz(0.09, 0.17, 0.07, 0.03, -8, -0.09)],
      [2, cruz(0.13, 0.17, 0.11, 0.08, 24, -0.1)],
      [3, cruz(0.14, 0.17, 0.11, 0.08, 30, -0.11)],
    ],
  }),
  full({
    id: 'tango-lunge', name: 'Tango Lunge', tags: 'latin pop | legs full |', beats: 4, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true,
    desc: 'The corté: step out into a deep lunge on a bent knee, the other leg long, the body leaning away from it in the embrace and the head turned out, hold it for two beats, then rise and draw the feet together.',
    keys: [[0, lungeOut], [1.5, lungeHold], [2.5, lungeUp], [3.5, { ...lungeUp, turn: 0, y: -0.06 }]],
  }),
  full({
    id: 'tango-caricia', name: 'Tango Caricia', tags: 'latin pop | legs |', beats: 4, level: 'low', d: 2, parts: ['legs'], mirror: true, bounce: 0,
    desc: 'An adorno: balanced on one leg in the embrace, stroke the free foot slowly up the inside of the standing calf to the knee and back down, toe pointed, then put it down.',
    keys: [[0, caricia(0, -0.07)], [1, caricia(0.14, -0.06)], [2, caricia(0.26, -0.05)], [3, caricia(0.06, -0.07)]],
  }),
  full({
    id: 'tango-molinete', name: 'Tango Molinete', tags: 'latin pop | legs hips | walk twist', beats: 4, level: 'mid', d: 3, parts: ['legs', 'hips'], mirror: true, travel: 0.2,
    desc: 'The tango grapevine: side step, cross behind with the hips pivoting, side step, cross in front pivoting the other way, the embrace and the chest staying to the front as the hips turn under them.',
    keys: [
      [0, moli(0.05, 0, [0.2, 0, 0], [-0.08, 0, 0], -0.08)],
      [1, moli(0.1, 30, [0.2, 0, 0], [0.06, 0, -0.08], -0.1)],
      [2, moli(0.16, 0, [0.31, 0, 0], [0.06, 0, -0.02], -0.08)],
      [3, moli(0.2, -30, [0.31, 0, 0], [0.18, 0, 0.08], -0.1)],
    ],
  }),
];

export const moves: MoveDef[] = [...bachata, ...tango];
