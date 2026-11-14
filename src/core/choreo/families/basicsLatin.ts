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

// Merengue twist march: march in place, every beat the hip of the free foot drops deep as its knee turns in
// and its heel lifts; the arms, bent up at shoulder height with the elbows high (the Zumba merengue arms),
// swing together as one bar the other way, the shoulders rocking with them.
const mtw: PoseSpec = {
  x: -0.012, y: -0.045, hips: -0.085, tilt: -13, hipTwist: -16, chestX: 0.03, lean: 3, twist: 6, head: 4,
  rf: [0.08, 0.012, 0.03], lf: [-0.09, 0, 0], pitchR: 30, kneeR: -0.4, kneeL: 0.06,
  r: at(1, 0.28, 0.74, 0.16, [1, 0.7, -0.2]), l: at(-1, -0.03, 0.74, 0.21, [1, 0.7, -0.2]), handR: 0.2, handL: 0.2, shR: 0.45, shL: 0,
};
// Passing through the middle on the "and": the hips level, the body up, the arm bar centred.
const MTW_MID: PoseSpec = {
  x: 0, y: -0.025, hips: 0, tilt: 0, hipTwist: 0, chestX: 0, lean: 0, twist: 0, head: 0,
  rf: [0.09, 0, 0.01], lf: [-0.09, 0, 0], pitchR: 6, pitchL: 6, kneeR: 0, kneeL: 0,
  r: at(1, 0.15, 0.73, 0.2, [1, 0.7, -0.2]), l: at(-1, -0.15, 0.73, 0.2, [1, 0.7, -0.2]), handR: 0.2, handL: 0.2, shR: 0.15, shL: 0.15,
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

// Güiro: the gourd held slanting up across the body, its handle in the left fist low at the left hip and its
// far end up by the right chest; the stick in the right hand scrapes the whole length of it (one long stroke
// down, two short ones back up and down), the elbow high, the body turned a little toward it and the eyes on
// it, the weight swaying from foot to foot.
const G_FAR = at(1, 0.2, 0.84, 0.2, [1, 0.5, -0.3]);
const G_NEAR = at(1, -0.1, 0.6, 0.24, [1, 0.2, -0.3]);
const G_MID = at(1, 0.06, 0.73, 0.23, [1, 0.35, -0.3]);
const gFeet = (w: number, settle: boolean): PoseSpec => ({
  spin: -18, x: (settle ? 0.015 : 0.03) * w, y: settle ? -0.035 : -0.055, hips: (settle ? 0.03 : 0.06) * w, tilt: (settle ? 4 : 8) * w,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], pitchR: w < 0 ? 20 : 0, pitchL: w > 0 ? 20 : 0, kneeR: w < 0 ? 0.12 : 0.02, kneeL: w > 0 ? 0.12 : 0.02,
  nod: 12, turn: -14, head: -4,
});
const gr = (feet: PoseSpec, stick: PoseSpec['r']): PoseSpec => ({
  ...feet, r: stick, l: at(-1, -0.2, 0.58, 0.2, [0.6, -1, -0.3]), handR: 0.1, handL: 0.1,
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
    desc: 'March in place on every beat, dropping the hip of the free foot deep as its knee turns in and its heel lifts; the arms, bent up at shoulder height with the elbows high, swing together the other way.',
    keys: [[0, mtw], [0.5, MTW_MID], [1, mir(mtw)], [1.5, MTW_MID]],
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
    desc: 'Turned a little, hold an imaginary güiro slanting up across the body, its handle low at one hip, and scrape the stick down its whole length in one long stroke, then two short ones back up and down, elbow high and eyes on it, swaying the weight from foot to foot.',
    keys: [
      [0, gr(gFeet(1, false), G_FAR)],
      [1, gr(gFeet(1, true), G_NEAR)],
      [1.5, gr(gFeet(1, true), G_MID)],
      [2, gr(gFeet(-1, false), G_NEAR)],
      [3, gr(gFeet(-1, true), G_FAR)],
      [3.5, gr(gFeet(-1, true), G_MID)],
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


/**
 * Salsa basic in place: the Cuban hip over each step (a big shift and tilt, the rib cage sliding the other
 * way) and the arms bent at 90 degrees counter-swinging like a walker's: the hand on the stepping side drops
 * back by the hip as the other comes up in front of the chest, the shoulders turning with them. The first
 * step breaks a little forward, the third comes back.
 */
const sbip = (w: number, fwd: number, y = -0.055): PoseSpec => ({
  x: 0.02 * w, y, hips: 0.075 * w, tilt: 11 * w, chestX: -0.035 * w, lean: -2 * w, twist: 10 * w, head: -3 * w,
  rf: w > 0 ? [0.1, 0, fwd] : [0.1, 0, 0.01], lf: [-0.09, 0, 0],
  pitchR: w < 0 ? 26 : 0, pitchL: w > 0 ? 26 : 0, kneeR: w < 0 ? -0.2 : 0.04, kneeL: w > 0 ? -0.2 : 0.04,
  r: w > 0 ? at(1, 0.27, 0.6, 0.02, E_OUT) : at(1, 0.06, 0.8, 0.24, E_OUT),
  l: w > 0 ? at(-1, -0.06, 0.8, 0.24, E_OUT) : at(-1, -0.27, 0.6, 0.02, E_OUT),
  handR: 0.4, handL: 0.4, shR: w > 0 ? 0 : 0.3, shL: w > 0 ? 0.3 : 0,
});

const salsa: MoveDef[] = [
  full({
    id: 'salsa-basic-in-place', name: 'Salsa Basic in Place', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The first salsa basic: step right a little forward, left, right back in place and pause on 4 with the left heel up, the hips swinging out over each step and the rib cage the other way, the arms bent at 90 degrees counter-swinging like a walker\'s; then left, right, left and pause.',
    keys: [
      [0, sbip(1, 0.08)],
      [1, sbip(-1, 0.08, -0.04)],
      [2, sbip(1, 0.01)],
      [3, { ...sbip(1, 0.01, -0.03), hips: 0.04, tilt: 5, chestX: -0.015, twist: 2, lf: [-0.08, 0.02, 0], pitchL: 30, nod: 4,
        r: at(1, 0.2, 0.7, 0.14, E_OUT), l: at(-1, -0.2, 0.7, 0.14, E_OUT) }],
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

// Hip roll: the hips roll round over the three steps (out to the right, back with the knees bending, across to
// the left) and pop up on the tap, the rib cage and the lean going against them so the roll shows. The left
// hand rides on the left hip; the right hand leads the roll, sliding across the front of the waist with the
// hips (out at the right hip, low at the belly, over to the left hip) and flicking up to the chest on the pop.
const L_ON_HIP = (hips: number, tilt: number) => at(-1, -0.16 + hips, 0.56 - 0.0012 * tilt, 0.07, [1, 0, -0.3]);
const ROLL: readonly PoseSpec[] = [
  { x: 0.025, y: -0.055, hips: 0.088, tilt: 13, chestX: -0.04, lean: -4, head: 4, rf: [0.11, 0, 0], lf: [-0.1, 0, 0], pitchL: 16, kneeL: -0.12,
    r: at(1, 0.25, 0.56, 0.08, [1, 0, -0.3]), l: L_ON_HIP(0.088, 13), handR: 1, handL: 1 },
  { x: 0.0, y: -0.085, hips: 0.0, tilt: 0, bend: 10, nod: 5, chestX: 0, lean: 0, head: 0, rf: [0.11, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.12, kneeL: 0.12, pitchR: 6, pitchL: 6,
    r: at(1, 0.04, 0.53, 0.2, E_OUT), l: L_ON_HIP(0, 0), handR: 1, handL: 1 },
  { x: -0.025, y: -0.055, hips: -0.088, tilt: -13, bend: -2, chestX: 0.04, lean: 4, head: -4, rf: [0.11, 0, 0], lf: [-0.1, 0, 0], pitchR: 16, kneeR: -0.12,
    r: at(1, -0.12, 0.58, 0.17, E_OUT), l: L_ON_HIP(-0.088, -13), handR: 1, handL: 1 },
  { x: 0.03, y: -0.06, hips: -0.09, tilt: -14, bend: 0, chestX: 0.035, lean: 5, head: -6, rf: [0.11, 0, 0], lf: [-0.04, 0.035, 0.02], pitchL: 30, kneeL: -0.35, kneeR: 0.08,
    r: at(1, 0.06, 0.8, 0.22, E_OUT), l: L_ON_HIP(-0.09, -14), handR: 1, handL: 1, shL: 0.4 },
];
const bRoll = (k: number): PoseSpec => ROLL[k];

/**
 * Bachata basic in place: the open hold (both hands forward at the waist, as if holding a partner's hands,
 * swaying with the body), three steps with the hips, then the tap: the free foot lifts and taps in beside the
 * other with its knee bent in as that hip pops right up, the body leaning away and the held hands dipping
 * toward the popped hip.
 */
const bOpen = (s: number, y = 0.68): PoseSpec => ({
  r: at(1, 0.15 + 0.08 * s, y, 0.24, E_OUT), l: at(-1, -0.15 + 0.08 * s, y, 0.24, E_OUT), handR: 0.7, handL: 0.7,
});
const bBasic = (w: number): PoseSpec => ({
  x: 0.035 * w, y: -0.05, hips: 0.065 * w, tilt: 9 * w, chestX: -0.015 * w, rf: [0.11, 0, 0], lf: [-0.1, 0, 0],
  pitchR: w < 0 ? 14 : 0, pitchL: w > 0 ? 14 : 0, kneeR: w < 0 ? 0.08 : 0.02, kneeL: w > 0 ? 0.08 : 0.02, ...bOpen(w),
});
const B_POP: PoseSpec = {
  x: 0.035, y: -0.06, hips: -0.088, tilt: -14, chestX: 0.035, lean: 5, head: -6, rf: [0.11, 0, 0], lf: [-0.04, 0.035, 0.02],
  pitchL: 30, kneeL: -0.35, kneeR: 0.08, shL: 0.45, ...bOpen(-1.4, 0.62),
};

const bachata: MoveDef[] = [
  full({
    id: 'bachata-basic-in-place', name: 'Bachata Basic in Place', tags: 'latin | legs hips | hips', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The bachata basic without travelling, hands held forward at the waist as in an open hold: step right, left, right, swaying with each step, then lift the left foot and tap it in beside the right, knee bent in, as the left hip pops right up and the hands dip toward it; then start left.',
    keys: [
      [0, bBasic(1)],
      [1, bBasic(-1)],
      [2, bBasic(1)],
      [3, B_POP],
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
    desc: 'One hand on the hip, roll the hips round over the three steps in place (out to the right, back with the knees bending, across to the left), the other hand sliding across the waist with them, and pop the hip up on the tap as that hand flicks up to the chest; then roll the other way.',
    keys: [[0, bRoll(0)], [1, bRoll(1)], [2, bRoll(2)], [3, bRoll(3)]],
  }),
];

// =====================================================================================
// Cumbia

// Forward shuffle (Colombian cumbia): the front foot slides forward flat, the back foot pushes on its ball;
// on the diagonal so the slide reads. Both hands hold the edges of a wide skirt (the pollera) spread out at
// the hips, lifting it up and forward as the foot slides out and letting it fall as it draws back; the hips
// swing out over the front foot and the body sits back a little on the draw (the cumbia's back break).
const cfs = (fwd: boolean): PoseSpec => ({
  spin: 26, x: fwd ? 0.02 : -0.01, y: fwd ? -0.07 : -0.045, hips: fwd ? 0.07 : -0.03, tilt: fwd ? 10 : -4, hipTwist: fwd ? 8 : 0,
  lean: fwd ? -4 : 2, bend: fwd ? 2 : -5, head: fwd ? -4 : 2, nod: fwd ? 4 : -3,
  rf: [0.11, 0, fwd ? 0.16 : 0.02], lf: [-0.08, 0, -0.03], slideR: true, pitchL: fwd ? 26 : 12, pitchR: fwd ? 0 : 14, kneeR: 0.06, kneeL: 0.14,
  r: at(1, fwd ? 0.36 : 0.32, fwd ? 0.68 : 0.52, fwd ? 0.14 : 0.06, E_OUT), l: at(-1, fwd ? -0.32 : -0.36, fwd ? 0.66 : 0.52, fwd ? 0.14 : 0.06, E_OUT),
  handR: 0.15, handL: 0.15,
});

const cumbia: MoveDef[] = [
  full({
    id: 'cumbia-forward-shuffle', name: 'Cumbia Forward Shuffle', tags: 'latin pop | legs hips | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'The Colombian cumbia step, turned a little to the diagonal: slide the front foot forward flat while the back foot pushes on its ball, the hip swinging out over it and both hands lifting a wide skirt spread at the hips, then draw it back sitting back a little as the skirt falls; then lead with the other foot.',
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

// Hip hit (golpe de cadera): the perreo stance, feet wide, knees bent and the chest tipped forward; the hip
// hits out to one side on the beat as the fist on that side yanks down to the hip and the other fist stays
// cocked up by the shoulder, then back to the middle on the "and" with both fists at the chest.
const rh = (w: number): PoseSpec => w === 0
  ? {
    x: 0, y: -0.07, hips: 0, tilt: 0, lean: 0, bend: 7, head: 0, nod: 3, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.12, kneeL: 0.12,
    r: at(1, 0.15, 0.76, 0.19, [0.7, -1, -0.3]), l: at(-1, -0.15, 0.76, 0.19, [0.7, -1, -0.3]), ...FIST, shR: 0, shL: 0,
  }
  : {
    x: 0.015 * w, y: -0.095, hips: 0.088 * w, tilt: 13 * w, chestX: -0.03 * w, lean: -6 * w, bend: 10, head: -5 * w, nod: 5, turn: 10 * w,
    rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: w < 0 ? 0.25 : 0.06, kneeL: w > 0 ? 0.25 : 0.06,
    r: w > 0 ? at(1, 0.26, 0.54, 0.1, E_OUT) : at(1, 0.2, 0.9, 0.16, [0.7, -1, -0.3]),
    l: w < 0 ? at(-1, -0.26, 0.54, 0.1, E_OUT) : at(-1, -0.2, 0.9, 0.16, [0.7, -1, -0.3]),
    ...FIST, shR: w < 0 ? 0.4 : 0, shL: w > 0 ? 0.4 : 0,
  };

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
    desc: 'The golpe de cadera in the perreo stance (feet wide, knees bent, chest tipped forward): hit one hip out to the side on the beat as that fist yanks down to the hip and the other stays cocked by the shoulder, come back to the middle with both fists at the chest on the "and", then hit the other side.',
    keys: [[0, rh(1)], [0.5, rh(0)], [1, rh(-1)], [1.5, rh(0)]],
  }),
];

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [...latin, ...salsa, ...bachata, ...cumbia, ...reggaeton];
