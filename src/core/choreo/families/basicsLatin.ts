/**
 * Simple basics for Easy (Nov 2026): the Latin social-floor basics as they
 * are taught first, for the sets latin, salsa, bachata, cumbia and
 * reggaeton (ids in ../genreSets/basics.ts). Every move is difficulty 1,
 * low intensity, no jumps or turns (a held diagonal at most), the feet
 * under the body and the arms carrying the style; most are danced in place
 * where the existing set already had the travelling or harder version.
 * All are hand-authored full-body moves (no shared layer patterns).
 *
 *   latin     merengue twist march, merengue side step with a hip circle
 *             (Zumba-style merengue steps: "how to dance merengue for dance
 *             exercise", zumba-sheila-blog-learn.blogspot.com, which lists
 *             the march with hip twist and the side step with hip circle,
 *             the circle reversing going back); cha-cha side basic (side,
 *             replace, cha-cha-cha in place: NC State "Social Dance" text,
 *             ncstate.pressbooks.pub/socialdance, and ballroompages.com
 *             cha-cha guide); güiro scrape and bongo hands (the percussion
 *             of merengue / son; the güiro's long-short-short stroke, the
 *             bongo martillo's alternating hands).
 *   salsa     basic in place, cumbia basic (crossing back basic), the
 *             tapped basic, diagonal back breaks, step touch (piano step):
 *             Library of Dance "Salsa Shines" basics list
 *             (libraryofdance.org/dances/salsa-shines) and The Dance Dojo
 *             "7 Salsa Moves for Beginners" (on-the-spot, side, back,
 *             crossing back / cumbia, front-back basics); front and back
 *             taps from beginner shine courses (Udemy "Salsa shines
 *             footwork vol 1"), toe-tap shine in abanicosalsa "Salsa Shines -
 *             Suzie Q, Toe Tap, Hook Step" (YouTube Xm8w6L1bFoQ).
 *   bachata   the basic in place (three steps and a tap with the hip:
 *             goandance.com "4 basic bachata steps", thedancedojo.com
 *             bachata beginner guide), with the beginner ladies'-styling
 *             arm and hip work on it (hand slides, arm extension / wave,
 *             arm drops, hip circles: incognito-dance and
 *             latindanceshoes.com.au "3 mini lady styling" course outlines).
 *   cumbia    the Colombian forward step: the front foot flat, the back
 *             foot pushing on its ball, the hips doing the work (EcuRed
 *             "Cumbia"), skirt held low.
 *   reggaeton knee lift with the hip (Zumba reggaeton basics), weight shift
 *             with reach and pull arms ("paso básico" weight shift side to
 *             side, studio class outlines), hip hit (golpe de cadera: Baila
 *             Facilito "Cómo bailar reggaeton - 5 pasos básicos", YouTube
 *             dIRnhKZcCKk).
 *
 * Considered and left out: a d1 salsa side basic (measures as the existing
 * Side Salsa), a bachata side tap (0.018 from the basic in place: one beat
 * of four differs), salsa heel taps (the Dembow Heel Tap's shape), the
 * bachata box (8 counts; a move is at most 4 beats).
 */
import { at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;
const FIST = { handR: 0, handL: 0 } as const;

// =====================================================================================
// Latin (merengue, cha-cha, percussion)

// Merengue twist march: march in place, the weight on one foot turning the other hip forward and across;
// the bent arms swing the other way.
const mtw: PoseSpec = {
  y: -0.04, hips: -0.03, tilt: -5, hipTwist: -22, twist: 8, head: 2,
  rf: [0.08, 0, 0.02], lf: [-0.09, 0, 0], pitchR: 18, kneeR: -0.3, kneeL: 0.05,
  r: at(1, 0.28, 0.66, 0.14, E_OUT), l: at(-1, -0.05, 0.64, 0.21, E_OUT), handR: 0.5, handL: 0.5,
};

// Merengue side step with a hip circle: step out and close, the hips circling (side, back, other side,
// front) on each step-close; the arms up and open, swaying against the hips.
const mhcArms = (s: number): PoseSpec => ({
  r: at(1, 0.15 - 0.04 * s, 1.07, 0.06, E_UP), l: at(-1, -0.15 - 0.04 * s, 1.07, 0.06, E_UP), handR: 1, handL: 1,
});

// Cha-cha side basic: side, replace, cha-cha-cha in place.
const ccArms = (open: number): PoseSpec => ({
  r: at(1, 0.16 + 0.22 * open, 0.68 + 0.06 * open, 0.17 - 0.11 * open, E_OUT), l: at(-1, -0.17, 0.66, 0.17, E_OUT),
  handR: 0.6 + 0.4 * open, handL: 0.6,
});
const cc = (x: number, rf: number, w: number, y: number, open: number, extra: PoseSpec = {}): PoseSpec => ({
  x, y, hips: 0.04 * w, tilt: 5 * w, rf: [rf, 0, 0], lf: [-0.09, 0, 0],
  pitchR: w < 0 ? 12 : 0, pitchL: w > 0 ? 12 : 0, kneeR: w < 0 ? 0.08 : 0, kneeL: w > 0 ? 0.08 : 0, ...ccArms(open), ...extra,
});

// Güiro: the gourd held across the waist in the left hand, the stick in the right scraping it (one long
// stroke, two short ones), the weight swaying from foot to foot.
const GA = at(1, 0.0, 0.67, 0.23, E_DOWN);
const GB = at(1, 0.22, 0.61, 0.19, E_DOWN);
const GM = at(1, 0.1, 0.645, 0.22, E_DOWN);
const gFeet = (w: number, settle: boolean): PoseSpec => ({
  x: (settle ? 0.012 : 0.025) * w, y: settle ? -0.03 : -0.045, hips: (settle ? 0.02 : 0.04) * w, tilt: (settle ? 2 : 5) * w,
  rf: [0.1, 0, 0], lf: [-0.1, 0, 0], pitchR: w < 0 ? 16 : 0, pitchL: w > 0 ? 16 : 0, kneeR: w < 0 ? 0.1 : 0.02, kneeL: w > 0 ? 0.1 : 0.02,
  nod: 7, turn: -6,
});
const gr = (feet: PoseSpec, stick: PoseSpec['r']): PoseSpec => ({
  ...feet, r: stick, l: at(-1, -0.07, 0.66, 0.21, [0.6, -1, -0.3]), handR: 0.15, handL: 0.25,
});

// Bongos: the hands pat a pair of small drums held in front of the waist, alternating every half beat.
const bong = (w: number, right: boolean): PoseSpec => ({
  x: 0.02 * w, y: right ? -0.05 : -0.035, hips: 0.035 * w, tilt: 4 * w,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], pitchR: w < 0 ? 12 : 0, pitchL: w > 0 ? 12 : 0, kneeR: 0.06, kneeL: 0.06, nod: right ? 6 : 3,
  r: right ? at(1, 0.09, 0.56, 0.24, E_OUT) : at(1, 0.1, 0.7, 0.21, E_OUT),
  l: right ? at(-1, -0.1, 0.7, 0.21, E_OUT) : at(-1, -0.09, 0.56, 0.24, E_OUT),
  handR: 1, handL: 1,
});

const latin: MoveDef[] = [
  full({
    id: 'merengue-twist-march', name: 'Merengue Twist March', tags: 'latin | hips | hips walk', beats: 2, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'March in place on every beat, the heel of the free foot lifting; standing on one foot turns the other hip forward and across, and the bent arms swing the other way.',
    keys: [[0, mtw], [1, mir(mtw)]],
  }),
  full({
    id: 'merengue-hip-circle', name: 'Merengue Hip Circle', tags: 'latin | hips | hips walk', beats: 2, level: 'low', d: 1, parts: ['hips', 'legs'], mirror: true, travel: 0.14,
    desc: 'Merengue side step and close with the hips circling through it (out, back, across, front), both arms up and open; the circle turns the other way going back.',
    keys: [
      [0, { x: 0.07, y: -0.045, hips: 0.05, tilt: 6, rf: [0.23, 0, 0], lf: [-0.09, 0, 0], kneeL: 0.06, ...mhcArms(1) }],
      [0.5, { x: 0.1, y: -0.03, hips: 0.01, tilt: 1, bend: 6, nod: 3, rf: [0.23, 0, 0], lf: [-0.03, 0.01, 0], ...mhcArms(0) }],
      [1, { x: 0.14, y: -0.045, hips: -0.05, tilt: -6, rf: [0.23, 0, 0], lf: [0.05, 0, 0], kneeR: 0.06, ...mhcArms(-1) }],
      [1.5, { x: 0.14, y: -0.06, hips: 0, bend: -4, nod: -2, rf: [0.23, 0, 0], lf: [0.05, 0, 0], kneeR: 0.1, kneeL: 0.1, ...mhcArms(0) }],
    ],
  }),
  full({
    id: 'cha-cha-side-basic', name: 'Cha-Cha Side Basic', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'Step to the side opening that arm out low, replace the weight on the other foot, then cha-cha-cha in place (three small quick steps) with the hips; start the other way.',
    keys: [
      [0, cc(0.035, 0.2, 1, -0.045, 1)],
      [1, cc(-0.01, 0.2, -1, -0.035, 0.4)],
      [2, cc(0.0, 0.1, 1, -0.045, 0)],
      [2.5, cc(-0.01, 0.1, -1, -0.035, 0)],
      [3, cc(0.01, 0.1, 1, -0.045, 0)],
    ],
  }),
  full({
    id: 'guiro-scrape', name: 'Güiro Scrape', tags: 'latin party | arms | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'Hold an imaginary güiro across the waist in one hand and scrape it with the stick in the other, one long stroke and two short ones, looking down at it and swaying the weight from foot to foot.',
    keys: [
      [0, gr(gFeet(1, false), GA)],
      [1, gr(gFeet(1, true), GB)],
      [1.5, gr(gFeet(1, true), GM)],
      [2, gr(gFeet(-1, false), GB)],
      [3, gr(gFeet(-1, true), GA)],
      [3.5, gr(gFeet(-1, true), GM)],
    ],
  }),
  full({
    id: 'bongo-hands', name: 'Bongo Hands', tags: 'latin party | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'],
    desc: 'Pat a pair of imaginary bongos held in front of the waist, right hand on the beat and left on the "and", palms flat, swaying the weight from foot to foot with the beat.',
    keys: [[0, bong(1, true)], [0.5, bong(1, false)], [1, bong(-1, true)], [1.5, bong(-1, false)]],
  }),
];

// =====================================================================================
// Salsa

/** Basic arms: elbows bent, hands at the waist, swinging against the hips. */
const sLow = (s: number): PoseSpec => ({
  r: at(1, 0.2 - 0.05 * s, 0.62, 0.16, E_OUT), l: at(-1, -0.2 - 0.05 * s, 0.62, 0.16, E_OUT), handR: 0.7, handL: 0.7, twist: -5 * s,
});
/** Shine arms: hands up loose in front of the chest. */
const sShine = (s: number): PoseSpec => ({
  r: at(1, 0.22 - 0.04 * s, 0.7, 0.18, E_DOWN), l: at(-1, -0.22 - 0.04 * s, 0.7, 0.18, E_DOWN), handR: 0.7, handL: 0.7,
});
/** In-place weight change onto the right (w = 1) or left (w = -1) foot. */
const sStep = (w: number, y = -0.045): PoseSpec => ({
  x: 0.015 * w, y, hips: 0.04 * w, tilt: 5 * w, rf: [0.1, 0, 0.02], lf: [-0.09, 0, 0],
  pitchR: w < 0 ? 14 : 0, pitchL: w > 0 ? 14 : 0, kneeR: w < 0 ? 0.1 : 0.02, kneeL: w > 0 ? 0.1 : 0.02,
});

// Cumbia basic (crossing back basic): the right foot crosses back behind on the diagonal, the body opening to it.
const scb = (k: number): PoseSpec => [
  { x: 0.0, y: -0.06, spin: 22, hips: 0.035, tilt: 4, hipTwist: 8, rf: [-0.02, 0, -0.13], lf: [-0.09, 0, 0], pitchR: 20, kneeL: 0.1, lean: -2,
    r: at(1, 0.38, 0.72, 0.05, E_OUT), l: at(-1, -0.16, 0.66, 0.17, E_OUT), handR: 1, handL: 0.6 },
  { x: -0.015, y: -0.04, spin: 12, hips: -0.035, tilt: -4, rf: [-0.02, 0, -0.13], lf: [-0.09, 0, 0], pitchR: 24, kneeL: 0.04,
    r: at(1, 0.3, 0.68, 0.1, E_OUT), l: at(-1, -0.18, 0.64, 0.16, E_OUT), handR: 0.8, handL: 0.6 },
  { x: 0.01, y: -0.045, spin: 0, hips: 0.035, tilt: 4, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], pitchL: 10, ...sLow(1), twist: 0 },
  { x: 0.01, y: -0.03, spin: 0, hips: 0.015, tilt: 2, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], pitchL: 14, ...sLow(0.5), twist: 0 },
][k] as PoseSpec;

// Front and back taps: tap the toe in front, step it in; tap the other toe behind, bring it in.
const SFT_LOW: PoseSpec = { r: at(1, 0.3, 0.5, 0.0, E_OUT), l: at(-1, -0.3, 0.5, 0.0, E_OUT), handR: 1, handL: 1 };
const SFT_FWD: PoseSpec = { r: at(1, 0.12, 0.8, 0.24, E_OUT), l: at(-1, -0.12, 0.8, 0.24, E_OUT), handR: 0.6, handL: 0.6 };
const sft = (k: number): PoseSpec => [
  { x: -0.015, y: -0.05, hips: -0.04, tilt: -5, lean: -2, nod: 6, rf: [0.11, 0, 0.16], lf: [-0.09, 0, 0], pitchR: 26, kneeL: 0.1, ...SFT_LOW },
  { x: 0.015, y: -0.04, hips: 0.04, tilt: 5, rf: [0.1, 0, 0.01], lf: [-0.09, 0, 0], pitchL: 10, ...sLow(0.5) },
  { x: 0.02, y: -0.05, spin: 14, hips: 0.045, tilt: 6, bend: 4, rf: [0.1, 0, 0.01], lf: [-0.1, 0, -0.16], pitchL: 32, kneeR: 0.1, ...SFT_FWD },
  { x: 0.01, y: -0.035, spin: 0, hips: 0.03, tilt: 3, rf: [0.1, 0, 0.01], lf: [-0.07, 0.01, 0], pitchL: 16, ...sLow(-0.5) },
][k] as PoseSpec;


const salsa: MoveDef[] = [
  full({
    id: 'salsa-basic-in-place', name: 'Salsa Basic in Place', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The first salsa basic: step right, left, right in place and pause on 4, the hips moving over each step and the bent arms swinging against them; then left, right, left and pause.',
    keys: [
      [0, { ...sStep(1), ...sShine(1), twist: -5 }],
      [1, { ...sStep(-1, -0.035), ...sShine(-1), twist: 5 }],
      [2, { ...sStep(1), ...sShine(1), twist: -5 }],
      [3, { ...sStep(1, -0.03), hips: 0.02, tilt: 2, pitchL: 18, nod: 3, ...sShine(0.4), twist: -2 }],
    ],
  }),
  full({
    id: 'salsa-tap-basic', name: 'Salsa Tap Basic', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'Cuban-style basic in place: step right, left, right, and on 4 tap the left toe out to the side as that arm flares open, hands up loose at the chest; then start with the left.',
    keys: [
      [0, { ...sStep(1), ...sLow(1) }],
      [1, { ...sStep(-1, -0.035), ...sLow(-1) }],
      [2, { ...sStep(1), ...sLow(1), l: at(-1, -0.26, 0.7, 0.12, E_OUT) }],
      [3, { ...sStep(1, -0.05), x: 0.03, hips: 0.05, tilt: 6, lean: -3, turn: -8, lf: [-0.22, 0, 0.03], pitchL: 28, kneeL: -0.05, ...sLow(1), twist: 0, l: at(-1, -0.36, 1.0, 0.06, E_UP), handL: 1 }],
    ],
  }),
  full({
    id: 'salsa-cumbia-basic', name: 'Salsa Cumbia Basic', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The crossing back basic: step the right foot back behind the left on the diagonal, opening the body and the right arm to it, replace onto the left, close the right beside it and pause; then the left foot crosses back.',
    keys: [[0, scb(0)], [1, scb(1)], [2, scb(2)], [3, scb(3)]],
  }),
  full({
    id: 'salsa-front-back-tap', name: 'Salsa Front & Back Taps', tags: 'latin | legs | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'A first shine: tap the right toe in front as both hands swing open low behind the hips, step it in beside the left, tap the left toe behind as the hands swing forward to the chest, bring it in beside the right.',
    keys: [[0, sft(0)], [1, sft(1)], [2, sft(2)], [3, sft(3)]],
  }),
  full({
    id: 'salsa-piano-step', name: 'Salsa Piano Step', tags: 'latin | legs hips | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true, travel: 0.12,
    desc: 'The salsa step-touch shine: step to the side with the Cuban hip and touch the other foot in beside it, the hands loose at the waist swinging out with the step; then back the other way.',
    keys: [
      [0, { x: 0.06, y: -0.05, hips: 0.045, tilt: 6, lean: -2, rf: [0.21, 0, 0], lf: [-0.09, 0, 0], kneeL: 0.08, pitchL: 12, ...sLow(-1.6), twist: 6 }],
      [1, { x: 0.12, y: -0.035, hips: 0.03, tilt: 3, rf: [0.21, 0, 0], lf: [0.08, 0.012, 0.01], pitchL: 24, kneeL: -0.08, ...sLow(0), twist: 0 }],
    ],
  }),
  full({
    id: 'salsa-diagonal-break', name: 'Salsa Diagonal Back Break', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'Break back on the diagonal: turn a little and step the right foot back and out, replace onto the left, close the right in and pause, the bent arms swinging at the waist; then break back with the left.',
    keys: [
      [0, { x: 0.03, y: -0.06, spin: -24, hips: 0.04, tilt: 5, hipTwist: -6, rf: [0.2, 0, -0.12], lf: [-0.08, 0, 0], pitchR: 22, kneeL: 0.1, bend: 3, ...sLow(-1) }],
      [1, { x: 0.0, y: -0.04, spin: -14, hips: -0.04, tilt: -5, rf: [0.2, 0, -0.12], lf: [-0.08, 0, 0], pitchR: 26, kneeL: 0.04, ...sLow(1) }],
      [2, { x: 0.01, y: -0.045, spin: 0, hips: 0.035, tilt: 4, rf: [0.1, 0, 0.01], lf: [-0.09, 0, 0], pitchL: 10, ...sLow(-0.5) }],
      [3, { x: 0.01, y: -0.03, spin: 0, hips: 0.015, tilt: 2, rf: [0.1, 0, 0.01], lf: [-0.09, 0, 0], pitchL: 14, nod: 3, ...sLow(0) }],
    ],
  }),
];

// =====================================================================================
// Bachata

/** Basic arms: hands low in front of the hips, palms down, swinging a little with the hips. */
const bLow = (s: number): PoseSpec => ({
  r: at(1, 0.17 + 0.03 * s, 0.56 + 0.02 * s, 0.18, E_OUT), l: at(-1, -0.17 + 0.03 * s, 0.56 - 0.02 * s, 0.18, E_OUT), handR: 1, handL: 1,
});
/** In-place weight change; `tap` = the left foot taps in beside the right with the hip popping up. */
const bStep = (w: number): PoseSpec => ({
  x: 0.015 * w, y: -0.045, hips: 0.035 * w, tilt: 4 * w, rf: [0.1, 0, 0], lf: [-0.09, 0, 0],
  pitchR: w < 0 ? 10 : 0, pitchL: w > 0 ? 10 : 0, kneeR: w < 0 ? 0.08 : 0.02, kneeL: w > 0 ? 0.08 : 0.02,
});
const bTap: PoseSpec = {
  x: 0.01, y: -0.055, hips: -0.06, tilt: -10, rf: [0.1, 0, 0], lf: [-0.035, 0.015, 0.01], pitchL: 25, kneeL: -0.18, kneeR: 0.06, head: -3,
};
const BELLY_L = at(-1, -0.04, 0.6, 0.18, [1, -0.4, 0]);

// Hand slide: the right hand slides down the front of the body from the chest to the hip and flicks out low.
const bSlide = (k: number): PoseSpec => ({
  r: [at(1, 0.05, 0.8, 0.17, E_OUT), at(1, 0.07, 0.68, 0.18, E_OUT), at(1, 0.13, 0.55, 0.15, E_OUT), at(1, 0.38, 0.6, 0.06, E_OUT)][k],
  l: BELLY_L, handR: 1, handL: 1,
});

// Arm wave: the right arm out to the side at shoulder height, rolling a wave out through the wrist.
const bWave = (k: number): PoseSpec => ({
  r: [at(1, 0.4, 0.84, 0.06, [1, -0.6, -0.2]), at(1, 0.42, 0.74, 0.06, [1, 0.4, -0.2]), at(1, 0.4, 0.86, 0.06, [1, -0.6, -0.2]), at(1, 0.36, 0.66, 0.08, [1, 0.3, -0.2])][k],
  l: BELLY_L, handR: 1, handL: 1,
});

// Arm drop: the right arm rises out to the side and up over the head over the three steps, then drops
// down in front of the body to the hip on the tap; the left hand on the belly.
const bDrop = (k: number): PoseSpec => ({
  r: [at(1, 0.36, 0.7, 0.06, E_OUT), at(1, 0.38, 0.92, 0.05, E_UP), at(1, 0.2, 1.06, 0.05, E_UP), at(1, 0.12, 0.6, 0.17, E_OUT)][k],
  l: BELLY_L, handR: 1, handL: 1, head: k === 2 ? 4 : 0, turn: k === 2 ? 8 : 0,
});

// Hip roll: the hips roll round over the three steps (out, back, across) and pop up on the tap.
const bRoll = (k: number): PoseSpec => [
  { x: 0.02, y: -0.05, hips: 0.05, tilt: 6, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], pitchL: 10, kneeL: 0.08 },
  { x: 0.0, y: -0.035, hips: 0.0, bend: 7, nod: 3, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], pitchR: 8, pitchL: 8 },
  { x: -0.02, y: -0.06, hips: -0.04, tilt: -5, bend: -3, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], pitchR: 10, kneeR: 0.08 },
  { ...bTap, x: 0.0 },
][k] as PoseSpec;
const HIPS_HANDS: PoseSpec = { r: at(1, 0.15, 0.55, 0.06, [1, 0, -0.3]), l: at(-1, -0.15, 0.55, 0.06, [1, 0, -0.3]), handR: 1, handL: 1 };

const bachata: MoveDef[] = [
  full({
    id: 'bachata-basic-in-place', name: 'Bachata Basic in Place', tags: 'latin | legs hips | hips', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The bachata basic without travelling: step right, left, right in place, then tap the left foot in beside the right as that hip pops up, the hands low in front of the hips swinging with them; then start left.',
    keys: [
      [0, { ...bStep(1), ...bLow(1) }],
      [1, { ...bStep(-1), ...bLow(-1) }],
      [2, { ...bStep(1), ...bLow(1) }],
      [3, { ...bTap, ...bLow(-1.5), r: at(1, 0.13, 0.6, 0.16, E_OUT), l: at(-1, -0.24, 0.6, 0.14, E_OUT) }],
    ],
  }),
  full({
    id: 'bachata-hand-slide', name: 'Bachata Hand Slide', tags: 'latin | arms hips | hands hips', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'On the basic in place, slide one hand slowly down the front of the body from the chest to the hip over the three steps and flick it out low on the tap, the other hand on the belly; then the other hand.',
    keys: [
      [0, { ...bStep(1), ...bSlide(0) }],
      [1, { ...bStep(-1), ...bSlide(1) }],
      [2, { ...bStep(1), ...bSlide(2) }],
      [3, { ...bTap, ...bSlide(3) }],
    ],
  }),
  full({
    id: 'bachata-arm-wave', name: 'Bachata Arm Wave', tags: 'latin | arms hips | wave hips', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'On the basic in place, hold one arm out to the side at shoulder height and roll a slow wave out along it, the elbow and then the wrist rising and sinking, the other hand on the belly; tap with the hip and change arms.',
    keys: [
      [0, { ...bStep(1), ...bWave(0) }],
      [1, { ...bStep(-1), ...bWave(1) }],
      [2, { ...bStep(1), ...bWave(2) }],
      [3, { ...bTap, ...bWave(3) }],
    ],
  }),
  full({
    id: 'bachata-arm-drop', name: 'Bachata Arm Drop', tags: 'latin | arms hips | hips', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'On the basic in place, raise one arm slowly out to the side and up over the head over the three steps, then let it drop down the body to the hip as the other hip pops on the tap; then the other arm.',
    keys: [
      [0, { ...bStep(1), ...bDrop(0) }],
      [1, { ...bStep(-1), ...bDrop(1) }],
      [2, { ...bStep(1), ...bDrop(2) }],
      [3, { ...bTap, ...bDrop(3) }],
    ],
  }),
  full({
    id: 'bachata-hip-roll', name: 'Bachata Hip Roll', tags: 'latin | hips | hips', beats: 4, level: 'low', d: 1, parts: ['hips'], mirror: true,
    desc: 'Hands on the hips, roll the hips round over the three steps in place (out to the right, back, across to the left) and pop the hip up on the tap; then roll the other way.',
    keys: [[0, { ...bRoll(0), ...HIPS_HANDS }], [1, { ...bRoll(1), ...HIPS_HANDS }], [2, { ...bRoll(2), ...HIPS_HANDS }], [3, { ...bRoll(3), ...HIPS_HANDS }]],
  }),
];

// =====================================================================================
// Cumbia

// Forward shuffle (Colombian cumbia): the front foot slides forward flat, the back foot pushes on its ball;
// on the diagonal so the slide reads; the hands hold the skirt out low.
const cfs = (fwd: boolean): PoseSpec => ({
  spin: 20, y: fwd ? -0.065 : -0.045, hips: fwd ? 0.035 : -0.015, tilt: fwd ? 4 : -2, hipTwist: fwd ? 6 : 0, lean: fwd ? -2 : 0,
  rf: [0.1, 0, fwd ? 0.12 : 0.02], lf: [-0.08, 0, -0.02], slideR: true, pitchL: fwd ? 22 : 12, kneeR: 0.08, kneeL: 0.12,
  r: at(1, fwd ? 0.3 : 0.26, fwd ? 0.62 : 0.53, 0.09, E_OUT), l: at(-1, fwd ? -0.25 : -0.3, fwd ? 0.52 : 0.6, 0.09, E_OUT), handR: 0.3, handL: 0.3,
});

const cumbia: MoveDef[] = [
  full({
    id: 'cumbia-forward-shuffle', name: 'Cumbia Forward Shuffle', tags: 'latin pop | legs hips | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The Colombian cumbia step, turned a little to the diagonal: slide the front foot forward flat while the back foot pushes on its ball, draw it back, the hips swaying and the hands holding a skirt out low; then lead with the other foot.',
    keys: [[0, cfs(true)], [1, cfs(false)]],
  }),
];

// =====================================================================================
// Reggaeton

// Knee lift: lift one knee with that hip, the fists pulling down to meet it; down on the "and" with a bounce.
const rkUp: PoseSpec = {
  y: -0.04, hips: 0.02, tilt: 8, bend: 5, nod: 5, rf: [0.12, 0.16, 0.07], lf: [-0.09, 0, 0], kneeR: 0.25, kneeL: 0.08, spin: -10,
  r: at(1, 0.2, 0.58, 0.2, E_DOWN), l: at(-1, 0.04, 0.62, 0.22, E_DOWN), ...FIST, shR: 0.3,
};
const rkDown: PoseSpec = {
  y: -0.075, hips: 0, tilt: 0, bend: 0, nod: 0, spin: 0, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.18, 0.74, 0.17, E_DOWN), l: at(-1, -0.18, 0.74, 0.17, E_DOWN), ...FIST,
};

// Reach and pull: the weight shifts to one side as the opposite fist pulls down from overhead to the chest;
// on the "and" the other arm reaches up ready to pull.
const rpPull = (w: number): PoseSpec => {
  const s: PoseSpec = {
    x: 0.035, y: -0.08, hips: 0.045, tilt: 6, lean: -2, head: -3, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], pitchL: 10, kneeR: 0.1, kneeL: 0.06,
    r: at(1, 0.2, 0.56, 0.12, E_DOWN), l: at(-1, -0.14, 0.7, 0.18, E_DOWN), ...FIST,
  };
  return w > 0 ? s : mir(s);
};
const rpReach = (w: number): PoseSpec => {
  const s: PoseSpec = {
    x: 0.0, y: -0.05, hips: 0, tilt: 0, lean: 3, head: 3, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.04, kneeL: 0.04,
    r: at(1, 0.16, 1.06, 0.05, E_UP), l: at(-1, -0.16, 0.66, 0.18, E_DOWN), ...FIST,
  };
  return w > 0 ? s : mir(s);
};

// Hip hit (golpe de cadera): wide and low-ish, the hip hits out to one side on the beat and back to the
// middle on the "and"; elbows bent up with the fists at the chest.
const rh = (w: number): PoseSpec => ({
  x: 0.012 * w, y: w === 0 ? -0.05 : -0.075, hips: 0.06 * w, tilt: 9 * w, lean: -3 * w, head: -3 * w, rf: [0.13, 0, 0], lf: [-0.13, 0, 0],
  kneeR: w < 0 ? 0.18 : 0.05, kneeL: w > 0 ? 0.18 : 0.05,
  r: at(1, 0.17 + 0.03 * w, 0.76, 0.17, [0.7, -1, -0.3]), l: at(-1, -0.17 + 0.03 * w, 0.76, 0.17, [0.7, -1, -0.3]), ...FIST, shR: w > 0 ? 0.3 : 0, shL: w < 0 ? 0.3 : 0,
});

const reggaeton: MoveDef[] = [
  full({
    id: 'reggaeton-knee-lift', name: 'Reggaeton Knee Lift', tags: 'latin hiphop | legs hips | hips', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'Lift one knee with that hip hitching up and both fists pulling down to meet it, put it down with a knee bounce on the "and" as the fists come back up, then lift the other knee.',
    keys: [[0, rkUp], [0.5, rkDown], [1, mir(rkUp)], [1.5, rkDown]],
  }),
  full({
    id: 'reggaeton-reach-pull', name: 'Reggaeton Reach & Pull', tags: 'latin hiphop | arms hips | hips', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'],
    desc: 'Feet apart, shift the weight and the hip to one side as the opposite fist pulls down hard from overhead to the chest, reach the other fist up on the "and", then shift the other way pulling it down.',
    keys: [[0, rpPull(1)], [0.5, rpReach(1)], [1, rpPull(-1)], [1.5, rpReach(-1)]],
  }),
  full({
    id: 'reggaeton-hip-hit', name: 'Reggaeton Hip Hit', tags: 'latin hiphop | hips | hips', beats: 2, level: 'low', d: 1, parts: ['hips'],
    desc: 'The golpe de cadera: feet apart and knees soft, hit one hip out to the side on the beat and bring it back to the middle on the "and", then hit the other, the elbows bent up with the fists at the chest.',
    keys: [[0, rh(1)], [0.5, rh(0)], [1, rh(-1)], [1.5, rh(0)]],
  }),
];

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [...latin, ...salsa, ...bachata, ...cumbia, ...reggaeton];
