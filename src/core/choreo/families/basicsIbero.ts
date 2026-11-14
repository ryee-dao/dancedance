/**
 * Simple basics for Easy: tango, flamenco, regional Mexican and Brazilian
 * basics (sets tango, flamenco, mexican, brazil); ids in ../genreSets/basics.ts.
 * Every move is difficulty 1, low intensity, no jumps, spins or stamps, the
 * feet under the body: the steps these dances are taught with in a first
 * class, before the harder figures already in their sets.
 *
 *   tango     (in the solo embrace, the left hand up holding the partner's
 *             hand, the right arm curved round the partner's back)
 *             cadencia (the weight change in place), cunita (the cradle: a
 *             rock forward and back on the diagonal), the side step and
 *             collect (paso al costado), golpecitos (toe taps beside the
 *             standing foot) and the ocho cortado kept to rock, rock, cross.
 *   flamenco  the paso de sevillanas (forward, close behind, replace, the
 *             arms rising), palmas on a side step-touch, floreo (the hands
 *             circling at the wrists, raised either side of the head) and
 *             the skirt sweep (one hand swinging the skirt forward and
 *             back). Braceo and marcaje are in families/flamenco.ts.
 *   mexican   the jarabe atole step (forward, behind, forward with the skirt
 *             and the shoulder), the mecedora (rocking chair), the jarabe
 *             push step, and the norteño two-step (the polka step of
 *             norteño / Tejano dance halls without its hop).
 *   brazil    the forró forward-and-back basic (base frente e trás), the
 *             xote "dois pra lá, dois pra cá", and the samba no pé basic in
 *             place taught slow (back on the ball, close, replace).
 *
 * Sources:
 *   tango: Wikipedia "Figures of Argentine tango" (cadencia: weight change in
 *     place; cunita: rocking forward / back / side, from rocking a cradle;
 *     ocho cortado; golpecitos and adornos); tanguito.co.uk beginner class
 *     notes (collect, change weight, step to the side); escuelatangoba.com
 *     "How to dance Argentine tango: salida básica"; fredosaurus.com basic eight.
 *   flamenco: studioflamenco.com "Sevillanas" (paso de sevillanas, pasada),
 *     ifema.es "Cómo bailar flamenco: pasos básicos" (paseíllo, marcaje,
 *     palmas, braceo), Wikipedia "Glossary of flamenco terms" (floreo: the
 *     hand flourishes; manejo de la falda / bata), experienceflamenco.com
 *     sevillanas posts.
 *   mexican: Society of Folk Dance Historians "Jarabe Tapatío" (atole step,
 *     mecedora / rocking-chair step, push steps), Dance Spirit "Inside the
 *     history and techniques of folklórico", Smithsonian Folkways "Pasito
 *     duranguense" and Texas Monthly "How to dance cumbia" (norteño and
 *     Tejano dance-hall polka two-step).
 *   brazil: UFRGS Movimento (2009) study of xote and baião steps ("basic
 *     sideways step", "basic forward and backward step"), Wikipedia "Xote",
 *     fluentu.com / theculturetrip.com "How to forró like a Brazilian"
 *     (dois pra lá, dois pra cá), Wikipedia "Samba (Brazilian dance)" (samba
 *     no pé).
 * Tempos: tango 110-130 counted on the beat, flamenco pop / rumba / sevillanas
 * 100-130, norteño and banda 100-140, forró / xote 80-120, samba 90-110
 * (danced at half time above). All are hand-authored full-body moves.
 */
import { at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

/** Key k of a list of poses (the list typed as poses so the foot triples stay tuples). */
const pick = (list: PoseSpec[], k: number): PoseSpec => list[k];

// ---------------------------------------------------------------------------
// Tango

/** The solo embrace: left hand up and out (the joined hands), right arm curved round in front of the chest. */
const EMB: PoseSpec = { l: at(-1, -0.34, 0.9, 0.12, [1, -0.6, -0.2]), r: at(1, -0.04, 0.8, 0.23, [1, -0.1, 0]), handR: 1, handL: 0.7 };

// Cadencia: the weight rocks from foot to foot in place three times and holds, the free heel lifting, the chest quiet.
const cad = (s: 1 | -1, settle: boolean): PoseSpec => ({
  x: (settle ? 0.035 : 0.045) * s, y: settle ? -0.06 : -0.08, hips: 0.035 * s, tilt: 4 * s, lean: -1.5 * s, turn: -10 * s,
  rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: s > 0 ? 0.08 : 0.12, kneeL: s > 0 ? 0.12 : 0.08,
  pitchR: s < 0 ? (settle ? 26 : 16) : 0, pitchL: s > 0 ? (settle ? 26 : 16) : 0, ...EMB,
});

// Cunita: on the diagonal, right foot in front: rock forward onto it, back onto the back foot, the head following.
const cun = (fwd: boolean): PoseSpec => ({
  spin: 26, y: fwd ? -0.08 : -0.09, bend: fwd ? 3 : -3, nod: fwd ? 2 : -2, turn: fwd ? -6 : 4, hips: fwd ? 0.015 : -0.015,
  rf: [0.08, 0, 0.13], lf: [-0.07, 0, -0.05], kneeR: fwd ? 0.12 : 0.03, kneeL: fwd ? 0.03 : 0.12,
  pitchR: fwd ? 0 : -16, pitchL: fwd ? 22 : 0, ...EMB,
});

// Side step and collect: step to the side, draw the other foot in to touch the standing foot, ankles together.
const sideOut: PoseSpec = { x: 0.05, y: -0.08, hips: 0.02, tilt: 2, turn: -8, rf: [0.21, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.1, kneeL: 0.04, pitchL: 12, ...EMB };
const sideIn: PoseSpec = { x: 0.12, y: -0.045, hips: 0.03, tilt: 3, turn: 14, head: 3, rf: [0.21, 0, 0], lf: [0.15, 0.012, 0.01], kneeR: 0.04, kneeL: -0.12, pitchL: 32, ...EMB };

// Golpecitos: balanced on the left, the right toe taps the floor beside the standing foot.
const golTap = (z: number): PoseSpec => ({
  spin: 16, x: -0.02, y: -0.08, hips: -0.03, tilt: -3, turn: 10, nod: 4,
  rf: [0.03, 0, z], lf: [-0.08, 0, 0], pitchR: 38, kneeR: 0.18, kneeL: 0.1, ...EMB,
});
const golUp = (z: number): PoseSpec => ({ ...golTap(z), y: -0.07, rf: [0.04, 0.035, z], pitchR: 24, kneeR: 0.3 });

// Ocho cortado (kept simple): rock forward on the right, rock back onto the left, then cross the right over in front.
const ocFwd: PoseSpec = { spin: 22, y: -0.08, bend: 3, hips: 0.015, rf: [0.08, 0, 0.13], lf: [-0.08, 0, -0.03], kneeR: 0.12, kneeL: 0.02, pitchL: 20, ...EMB };
const ocBack: PoseSpec = { spin: 22, y: -0.09, bend: -3, hips: -0.02, tilt: -2, rf: [0.08, 0, 0.13], lf: [-0.08, 0, -0.03], kneeR: 0.03, kneeL: 0.12, pitchR: -14, ...EMB };
const ocCross: PoseSpec = { spin: 8, y: -0.1, turn: 22, head: 3, hips: -0.02, rf: [-0.03, 0, 0.06], lf: [-0.08, 0, -0.01], kneeR: 0.1, kneeL: 0.1, pitchR: 10, ...EMB };

// ---------------------------------------------------------------------------
// Flamenco

const ROUND_HIGH_R = at(1, 0.07, 1.06, 0.1, E_UP);
const ROUND_HIGH_L = at(-1, -0.07, 1.06, 0.1, E_UP);

// Paso de sevillanas: step forward on the diagonal, close the other foot behind on its ball, replace, hold;
// the arms rise from low in front up to round overhead.
const sev = (k: number): PoseSpec => pick([
  { spin: 18, y: -0.07, bend: -4, nod: -2, turn: -8, hips: 0.02, tilt: 2, rf: [0.1, 0, 0.12], lf: [-0.08, 0, 0], kneeR: 0.08, kneeL: 0.04,
    r: at(1, 0.14, 0.64, 0.2, E_OUT), l: at(-1, -0.14, 0.64, 0.2, E_OUT), handR: 0.8, handL: 0.8 },
  { spin: 18, y: -0.04, bend: -6, nod: -4, turn: -10, rf: [0.1, 0, 0.12], lf: [0.02, 0, 0.06], pitchL: 30, kneeR: 0.04, kneeL: 0.1,
    r: at(1, 0.24, 0.86, 0.14, E_OUT), l: at(-1, -0.22, 0.84, 0.14, E_OUT), handR: 0.9, handL: 0.9 },
  { spin: 18, y: -0.07, bend: -8, nod: -6, turn: -14, hips: 0.025, tilt: 3, rf: [0.1, 0, 0.12], lf: [0.02, 0, 0.06], pitchR: 0, kneeR: 0.1, kneeL: 0.06,
    r: ROUND_HIGH_R, l: at(-1, -0.2, 1.02, 0.1, E_UP), handR: 0.9, handL: 0.9 },
  { spin: 10, y: -0.05, bend: -9, nod: -8, turn: -18, head: 4, hips: 0.02, tilt: 2, rf: [0.09, 0, 0.06], lf: [-0.04, 0, 0.03], kneeR: 0.06, kneeL: 0.06,
    r: ROUND_HIGH_R, l: ROUND_HIGH_L, handR: 1, handL: 1 },
], k);

/** A step-touch in place: weight on the right, touch the left in beside it, step it back out, touch the right in. */
const stFeet = (k: number): PoseSpec => pick([
  { x: 0.035, rf: [0.14, 0, 0], lf: [-0.14, 0, 0], kneeR: 0.08, kneeL: 0.02 },
  { x: 0.065, rf: [0.14, 0, 0], lf: [0.03, 0.012, 0.01], pitchL: 26, kneeR: 0.08, kneeL: -0.08 },
  { x: -0.035, rf: [0.14, 0, 0], lf: [-0.14, 0, 0], kneeR: 0.02, kneeL: 0.08 },
  { x: -0.065, rf: [-0.03, 0.012, 0.01], lf: [-0.14, 0, 0], pitchR: 26, kneeR: -0.08, kneeL: 0.08 },
], k);

// Palmas on a side step-touch: clap in front of the chest on every step and every touch, the head turned to the step.
const CLAP_IN: PoseSpec = { r: at(1, 0.015, 0.71, 0.22, [0.6, -1, -0.2]), l: at(-1, 0.0, 0.7, 0.22, [0.4, -1, -0.2]), handR: 1, handL: 1 };
const CLAP_OUT: PoseSpec = { r: at(1, 0.15, 0.74, 0.18, [0.8, -1, -0.2]), l: at(-1, -0.13, 0.73, 0.18, [0.8, -1, -0.2]), handR: 1, handL: 1 };
const palm = (k: number, clap: boolean): PoseSpec => {
  const s = k < 2 ? 1 : -1;
  return {
    y: k % 2 ? -0.05 : -0.07, bend: -5, nod: -3, hips: 0.03 * s, tilt: 4 * s, lean: -2 * s, turn: 16 * s,
    ...stFeet(k), ...(clap ? CLAP_IN : CLAP_OUT),
  };
};

// Floreo: both hands raised either side of the head, the wrists circling (the fingers opening and closing in turn),
// over a slow step-touch beside the standing foot.
const flo = (k: number): PoseSpec => {
  const s = k < 2 ? 1 : -1;
  const ph = (k * Math.PI) / 2;
  return {
    y: k % 2 ? -0.05 : -0.07, bend: -6, nod: -4, hips: 0.035 * s, tilt: 4 * s, lean: -2 * s, turn: -12 * s, head: 3 * s,
    ...stFeet(k),
    r: at(1, 0.19 + 0.055 * Math.cos(ph), 0.98 + 0.055 * Math.sin(ph), 0.16, [1, 0.1, -0.2]),
    l: at(-1, -0.19 + 0.055 * Math.cos(ph), 0.98 - 0.055 * Math.sin(ph), 0.16, [1, 0.1, -0.2]),
    handR: k % 2 ? 0.35 : 1, handL: k % 2 ? 1 : 0.35, ...(k % 2 ? { formL: 'fingers' as const } : { formR: 'fingers' as const }),
  };
};

// Skirt sweep: the right hand swings the skirt forward and up as the right foot steps forward, out to the side,
// then back behind as the foot steps back; the left arm rounded overhead.
const falda = (k: number): PoseSpec => pick([
  { spin: 16, y: -0.07, bend: -4, nod: -3, turn: -10, hips: 0.02, tilt: 2, rf: [0.1, 0, 0.12], lf: [-0.08, 0, 0], kneeR: 0.08, pitchL: 14,
    r: at(1, 0.22, 0.62, 0.26, E_DOWN), l: ROUND_HIGH_L, handR: 0.2, handL: 0.9 },
  { spin: 6, y: -0.05, bend: -6, nod: -4, turn: -16, hips: 0.035, tilt: 4, rf: [0.12, 0, 0.04], lf: [-0.08, 0, 0], kneeL: 0.08,
    r: at(1, 0.36, 0.66, 0.06, E_DOWN), l: ROUND_HIGH_L, handR: 0.2, handL: 0.9 },
  { spin: -6, y: -0.08, bend: -7, nod: -5, turn: 10, hips: -0.02, tilt: -2, rf: [0.1, 0, -0.1], lf: [-0.08, 0, 0], kneeL: 0.12, pitchR: 26,
    r: at(1, 0.28, 0.52, -0.14, E_DOWN), l: ROUND_HIGH_L, handR: 0.2, handL: 0.9 },
  { spin: 0, y: -0.05, bend: -6, nod: -4, turn: 4, hips: 0, tilt: 0, rf: [0.09, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.04, kneeL: 0.04,
    r: at(1, 0.3, 0.56, 0.06, E_DOWN), l: ROUND_HIGH_L, handR: 0.2, handL: 0.9 },
], k);

// ---------------------------------------------------------------------------
// Regional Mexican

/** Both hands holding the skirt out at the hips. */
const SKIRT: PoseSpec = { r: at(1, 0.3, 0.52, 0.08, E_OUT), l: at(-1, -0.3, 0.52, 0.08, E_OUT), handR: 0.3, handL: 0.3 };

// Atole step (jarabe): forward on the right on the diagonal, the left behind it, forward again; the right shoulder dips
// forward and the right hand brings the skirt forward while the left stays back.
const atole = (k: number): PoseSpec => {
  const arms: PoseSpec = { r: at(1, 0.26, 0.56, k === 3 ? 0.12 : 0.24, E_OUT), l: at(-1, -0.3, 0.56, -0.08, E_OUT), handR: 0.3, handL: 0.3 };
  return pick([
    { spin: 20, x: 0.02, y: -0.07, bend: 5, twist: -6, lean: 3, hips: 0.02, tilt: 2, rf: [0.12, 0, 0.1], lf: [-0.08, 0, 0], kneeR: 0.1, pitchL: 14, ...arms },
    { spin: 20, x: 0.03, y: -0.05, bend: 5, twist: -8, lean: 4, hips: 0.01, rf: [0.12, 0, 0.1], lf: [0.05, 0, 0.02], kneeL: 0.08, pitchL: 28, ...arms },
    { spin: 20, x: 0.04, y: -0.08, bend: 6, twist: -10, lean: 5, hips: 0.03, tilt: 3, rf: [0.14, 0, 0.16], lf: [0.05, 0, 0.02], kneeR: 0.12, pitchL: 18, ...arms },
    { spin: 8, x: 0.02, y: -0.05, bend: 2, twist: -3, lean: 2, hips: 0.01, rf: [0.11, 0, 0.06], lf: [-0.06, 0, 0], kneeR: 0.04, ...arms },
  ], k);
};

// Mecedora (rocking chair): the left foot stays in front; step back onto the right with the left toe lifting in front,
// then forward onto the left with the right toe lifting behind, the body rocking with it.
const mecBack: PoseSpec = {
  spin: 22, y: -0.08, bend: -5, nod: -3, hips: 0.02, rf: [0.07, 0, -0.07], lf: [-0.07, 0.035, 0.1], kneeR: 0.12, kneeL: 0.05, pitchL: -12, ...SKIRT,
  r: at(1, 0.3, 0.54, 0.02, E_OUT), l: at(-1, -0.28, 0.58, 0.16, E_OUT),
};
const mecFwd: PoseSpec = {
  spin: 22, y: -0.08, bend: 5, nod: 3, hips: -0.02, rf: [0.07, 0.035, -0.08], lf: [-0.07, 0, 0.1], kneeR: 0.05, kneeL: 0.12, pitchR: 24, ...SKIRT,
  r: at(1, 0.28, 0.58, 0.16, E_OUT), l: at(-1, -0.3, 0.54, 0.02, E_OUT),
};

// Push step: sink on the left knee as the right foot pushes out to the side along the floor, close it beside on its
// ball; the skirt held high on the standing side.
const push = (k: number): PoseSpec => pick([
  { x: -0.03, y: -0.09, hips: -0.03, tilt: -4, lean: 3, head: -3, rf: [0.2, 0, 0.01], lf: [-0.08, 0, 0], kneeL: 0.16, kneeR: -0.05, pitchR: 20, slideR: true,
    l: at(-1, -0.33, 0.88, 0.1, E_OUT), r: at(1, 0.29, 0.52, 0.08, E_OUT), handR: 0.3, handL: 0.3 },
  { x: 0.0, y: -0.05, hips: 0.0, tilt: 0, lean: 1, head: -2, rf: [0.04, 0, 0], lf: [-0.08, 0, 0], kneeL: 0.06, kneeR: 0.04, pitchR: 26,
    l: at(-1, -0.32, 0.84, 0.1, E_OUT), r: at(1, 0.29, 0.52, 0.08, E_OUT), handR: 0.3, handL: 0.3 },
], k);

// Norteño two-step: the dance-hall polka step without its hop: side, close, side, and a touch, bouncing softly;
// the right thumb hooked at the belt buckle, the left hand up holding the partner's hand.
const NORT: PoseSpec = { r: at(1, 0.06, 0.55, 0.14, [1, -0.2, -0.3]), l: at(-1, -0.3, 0.84, 0.14, [1, -0.6, -0.2]), handR: 0.2, handL: 0.6 };
const nort = (x: number, rf: number, lf: number, y: number, s: number, touch = false): PoseSpec => ({
  x, y, hips: 0.025 * s, tilt: 3 * s, lean: -1.5 * s, bend: 3, turn: -6,
  rf: [rf, 0, 0], lf: [lf, touch ? 0.012 : 0, touch ? 0.01 : 0], pitchL: touch ? 22 : 0, kneeR: 0.08, kneeL: 0.08, ...NORT,
});

// ---------------------------------------------------------------------------
// Brazil

/** Forró hold: the right hand up to the side holding the partner's hand, the left arm curved round in front. */
const FORRO: PoseSpec = { r: at(1, 0.34, 0.9, 0.14, [0.6, -0.8, 0]), l: at(-1, 0.04, 0.82, 0.28, [1, -0.3, 0]), handR: 1, handL: 1 };

// Forward-and-back basic: forward on the right, weight back to the left, back on the right, weight forward to the left,
// a soft bounce and the hips swaying on every step, turned a little to the diagonal so the steps read.
const ffb = (k: number): PoseSpec => pick([
  { spin: 20, y: -0.08, bend: 2, hips: 0.03, tilt: 4, rf: [0.08, 0, 0.13], lf: [-0.08, 0, 0], kneeR: 0.12, pitchL: 16, ...FORRO },
  { spin: 20, y: -0.04, bend: 0, hips: -0.015, tilt: -2, rf: [0.08, 0, 0.13], lf: [-0.08, 0, 0], kneeL: 0.08, pitchR: -10, ...FORRO },
  { spin: 20, y: -0.08, bend: -2, hips: 0.03, tilt: 4, rf: [0.08, 0, -0.1], lf: [-0.08, 0, 0], kneeR: 0.12, pitchR: 22, ...FORRO },
  { spin: 20, y: -0.04, bend: 0, hips: -0.015, tilt: -2, rf: [0.08, 0, -0.1], lf: [-0.08, 0, 0], kneeL: 0.08, pitchR: 22, ...FORRO },
], k);

// Xote: two to one side, two to the other: a strong step out and a softer close with the weight, the body swaying.
const xote = (k: number): PoseSpec => {
  const s = k < 2 ? 1 : -1;
  const feet = pick([
    { x: 0.03, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.1, kneeL: 0.03, y: -0.08 },
    { x: 0.075, rf: [0.13, 0, 0], lf: [0.01, 0, 0], kneeR: 0.05, kneeL: 0.08, y: -0.05 },
    { x: -0.03, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.03, kneeL: 0.1, y: -0.08 },
    { x: -0.075, rf: [-0.01, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.08, kneeL: 0.05, y: -0.05 },
  ], k);
  return { ...feet, hips: 0.04 * s, tilt: 5 * s, lean: -2.5 * s, turn: -8 * s, ...FORRO };
};

// Samba no pé basic, slow: the right foot steps back on its ball, the left closes on its ball, the right replaces;
// the hips swing to the side and the bent arms swing in opposition at the waist.
const SAMBA_A = (s: 1 | -1): PoseSpec => ({
  r: at(1, 0.2, s > 0 ? 0.6 : 0.74, s > 0 ? 0.08 : 0.22, E_OUT), l: at(-1, -0.2, s > 0 ? 0.74 : 0.6, s > 0 ? 0.22 : 0.08, E_OUT), handR: 0.8, handL: 0.8,
});
const smb = (k: number): PoseSpec => pick([
  { spin: 14, y: -0.08, hips: 0.045, tilt: 6, lean: -2, rf: [0.1, 0, -0.08], lf: [-0.08, 0, 0], pitchR: 30, kneeL: 0.12, ...SAMBA_A(1) },
  { spin: 14, y: -0.05, hips: 0.0, tilt: 0, rf: [0.1, 0, -0.08], lf: [-0.05, 0, -0.04], pitchR: 30, pitchL: 30, kneeR: 0.06, kneeL: 0.06, ...SAMBA_A(1) },
  { spin: 6, y: -0.08, hips: -0.04, tilt: -5, lean: 2, rf: [0.09, 0, 0.02], lf: [-0.05, 0, -0.04], pitchL: 24, kneeR: 0.12, ...SAMBA_A(-1) },
  { spin: 6, y: -0.05, hips: -0.02, tilt: -2, rf: [0.09, 0, 0.02], lf: [-0.08, 0, 0], kneeR: 0.06, ...SAMBA_A(-1) },
], k);

export const patterns: PatternSet = {};

const tango: MoveDef[] = [
  full({
    id: 'tango-cadencia', name: 'Tango Cadencia', tags: 'latin pop | legs hips |', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'In the tango embrace, rock the weight from foot to foot in place, one, two, three, and hold, the free heel peeling up as the hips settle over the other foot, the chest staying quiet; then start with the other foot.',
    keys: [[0, cad(1, false)], [1, cad(-1, false)], [2, cad(1, false)], [3, cad(1, true)]],
  }),
  full({
    id: 'tango-cunita', name: 'Tango Cunita', tags: 'latin pop | legs |', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], mirror: true,
    desc: 'The cradle: turned to the diagonal in the embrace with one foot in front, rock forward onto it and back onto the back foot, the free heel or toe lifting each time.',
    keys: [[0, cun(true)], [1, cun(false)]],
  }),
  full({
    id: 'tango-side-step', name: 'Tango Side Step', tags: 'latin pop | legs | walk', beats: 4, level: 'low', d: 1, parts: ['legs'], mirror: true, travel: 0.12,
    desc: 'The paso al costado: in the embrace, step to the side, then draw the other foot in to the standing foot so the ankles meet, collected and still, and step back the other way.',
    keys: [[0, sideOut], [1, sideIn], [3, { ...sideIn, y: -0.06, turn: 18 }]],
  }),
  full({
    id: 'tango-golpecitos', name: 'Tango Golpecitos', tags: 'latin pop | legs |', beats: 2, level: 'low', d: 1, parts: ['legs'], mirror: true,
    desc: 'An adorno for a pause: balanced on one leg in the embrace, tap the toe of the free foot lightly on the floor beside the standing foot, in front and then beside it.',
    keys: [[0, golTap(0.06)], [0.5, golUp(0.05)], [1, golTap(0.0)], [1.5, golUp(0.03)]],
  }),
  full({
    id: 'tango-ocho-cortado', name: 'Tango Ocho Cortado', tags: 'latin pop | legs | walk', beats: 4, level: 'low', d: 1, parts: ['legs'], mirror: true,
    desc: 'The cut eight, kept simple: on the diagonal in the embrace, rock forward onto one foot, rock back onto the other, then cross the first foot over in front and hold, looking out over it.',
    keys: [[0, ocFwd], [1, ocBack], [2, ocCross], [3, { ...ocCross, y: -0.09, turn: 26 }]],
  }),
];

const flamenco: MoveDef[] = [
  full({
    id: 'sevillanas-step', name: 'Paso de Sevillanas', tags: 'latin | legs arms | hands', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'The basic sevillanas step: step forward on the diagonal, close the other foot behind on its ball, replace onto the front foot and hold, the chest lifted as both arms rise from low in front to round overhead.',
    keys: [[0, sev(0)], [1, sev(1)], [2, sev(2)], [3, sev(3)]],
  }),
  full({
    id: 'palmas-step', name: 'Palmas Step-Touch', tags: 'latin | arms legs | clap', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Keep the compás with palmas: clap in front of the chest on every count while stepping to the side and touching the other foot in, the head turned toward the step, then to the other side.',
    keys: [
      [0, palm(0, true)], [0.5, palm(0, false)], [1, palm(1, true)], [1.5, palm(1, false)],
      [2, palm(2, true)], [2.5, palm(2, false)], [3, palm(3, true)], [3.5, palm(3, false)],
    ],
  }),
  full({
    id: 'floreo', name: 'Floreo', tags: 'latin | arms | hands', beats: 4, level: 'low', d: 1, parts: ['arms'],
    desc: 'Both hands raised either side of the head, circle them at the wrists so the fingers open and close one hand after the other, over a slow step-touch from side to side with the chest lifted.',
    keys: [[0, flo(0)], [1, flo(1)], [2, flo(2)], [3, flo(3)]],
  }),
  full({
    id: 'flamenco-skirt', name: 'Flamenco Skirt Sweep', tags: 'latin | arms legs | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'One hand holding the skirt, the other arm rounded overhead: sweep the skirt forward as that foot steps forward, out to the side, then back behind you as the foot steps back, and close.',
    keys: [[0, falda(0)], [1, falda(1)], [2, falda(2)], [3, falda(3)]],
  }),
];

const mexican: MoveDef[] = [
  full({
    id: 'atole-step', name: 'Atole Step', tags: 'latin party | legs arms |', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'A jarabe basic: step forward on the diagonal, bring the other foot in behind it, step forward again and settle, the shoulder dipping forward and that hand bringing the skirt forward while the other stays back.',
    keys: [[0, atole(0)], [1, atole(1)], [2, atole(2)], [3, atole(3)]],
  }),
  full({
    id: 'mecedora', name: 'Mecedora', tags: 'latin party | legs |', beats: 2, level: 'low', d: 1, parts: ['legs'], mirror: true,
    desc: 'The rocking-chair step, holding the skirt: one foot stays in front; rock back onto the back foot as the front toe lifts, then forward onto the front foot as the back toe lifts behind.',
    keys: [[0, mecBack], [1, mecFwd]],
  }),
  full({
    id: 'push-step', name: 'Jarabe Push Step', tags: 'latin party | legs arms |', beats: 2, level: 'low', d: 1, parts: ['legs'], mirror: true,
    desc: 'Sink on one bent knee as the other foot pushes out to the side along the floor, then close it beside on its ball, twice, the skirt held high on the standing side; then push twice with the other foot.',
    keys: [[0, push(0)], [0.5, push(1)], [1, push(0)], [1.5, push(1)]],
  }),
  full({
    id: 'norteno-two-step', name: 'Norteño Two-Step', tags: 'latin party | legs | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true, travel: 0.16,
    desc: 'The dance-hall polka step without the hop: side, close, side and touch, bouncing softly in the knees, one thumb at the belt buckle and the other hand up as if holding a partner\'s; then back the other way.',
    keys: [
      [0, nort(0.05, 0.19, -0.09, -0.07, 1)],
      [1, nort(0.09, 0.19, 0.06, -0.04, -1)],
      [2, nort(0.14, 0.27, 0.06, -0.07, 1)],
      [3, nort(0.16, 0.27, 0.17, -0.05, 0, true)],
    ],
  }),
];

const brazil: MoveDef[] = [
  full({
    id: 'forro-forward-back', name: 'Forró Forward & Back', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The forró base frente e trás in a dance hold: step forward, let the weight come back to the other foot, step back, let the weight come forward, with a soft bounce and the hips swaying on every step.',
    keys: [[0, ffb(0)], [1, ffb(1)], [2, ffb(2)], [3, ffb(3)]],
  }),
  full({
    id: 'xote', name: 'Xote Step', tags: 'latin | legs hips | hips', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'],
    desc: 'Dois pra lá, dois pra cá: in a dance hold, a strong step to the side and a soft close with the weight, then the same to the other side, the body swaying slowly with each pair.',
    keys: [
      [0, xote(0)], [1, xote(1)], [2, xote(2)], [3, xote(3)],
    ],
  }),
  full({
    id: 'samba-basic-in-place', name: 'Samba Basic in Place', tags: 'latin | legs hips | hips', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The samba no pé basic taught slow: step back on the ball of one foot with the hip swinging out, close the other on its ball, replace onto the first foot, the bent arms swinging in opposition at the waist.',
    keys: [[0, smb(0)], [1, smb(1)], [2, smb(2)], [3, smb(3)]],
  }),
];

export const moves: MoveDef[] = [...tango, ...flamenco, ...mexican, ...brazil];
