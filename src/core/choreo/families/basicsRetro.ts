/**
 * Simple basics for Easy: country, swing and gospel basics (sets country,
 * swing, gospel); ids in ../genreSets/basics.ts. Every move is difficulty 1,
 * low intensity, no jumps or turns, feet under the body, the arms carrying
 * the style. All are hand-authored full-body moves (no shared layer patterns).
 *
 * Country (line-dance basics the sets lacked; the kick ball change, jazz
 * square, step touch, side rock, heel dig clap and hat tip are global moves
 * already, the heel strut, heel splits and rubboard scratch are in the set):
 *   toe-fan     Toe Fans: weight on one foot, the free toe swings out on its
 *                  heel and back in.
 *   heel-bounce Heel Bounces ("heel raises"): up on the balls of both feet
 *                  and down, twice, one hand on the hat brim.
 *   sugar-foot  Sugar Foot: the free toe, then its heel, touched to the
 *                  instep of the standing foot.
 *   heel-toe    Heel & Toe: the free heel touched forward on the diagonal,
 *                  then its toe touched back.
 *   Sources: estes-eastes.org "Line Dance Definitions" (toe-fan, heel bounce,
 *   sugar foot, touch, heel strut); copperknob.co.uk "Line dancing
 *   terminology"; roots-boots.net line-dance definitions.
 *
 * Swing (solo jazz / Lindy and East Coast swing basics as taught to beginners):
 *   rock-triple  Rock Step & Triple: rock back, recover, triple step to the
 *                   side (the jive / East Coast swing count 1-2, 3-&-4).
 *   spank-baby   Spank the Baby: tap out to the side with the teapot arm
 *                   pushing that way, close and lift the foot behind as the
 *                   other hand spanks.
 *   side-triples Side Triple Steps: the triple step (step, close, step) side
 *                   to side, loose arms swinging with it.
 *   peckin       Peckin': the head pecking forward on each step like a
 *                   chicken, the loose arms swinging against it.
 *   (A scarecrow was written and cut: the global party move Scarecrow Flop is
 *   the same idea.)
 *   Sources: Wikibooks "Swing Dancing/Jazz dance moves" (pecking);
 *   Elena Collins "Move of the Week: Spank the Baby" (blog, 2018-11-23);
 *   wikiHow "Jive" and MasterClass "How to Swing Dance" (rock step, triple
 *   steps); lurklurk.org "Jazz steps" (names and mirroring).
 *
 * Gospel:
 *   reach-receive Reach & Receive: the praise-dance reaching arms (both
 *                    open hands reaching forward and up "as if reaching out to
 *                    God"), drawn back in to the heart.
 *   Sources: LoveToKnow "Praise Dance Moves" (the arm vocabulary: raised,
 *   reaching out in front, open to the sides; the bow).
 *
 * Tempos: country 90-140, swing 120-200 (solo jazz 120-180), gospel 60-130.
 */
import { ARM, at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

/** Thumbs hooked in the belt loops (country). */
const BELT_R = at(1, 0.11, 0.54, 0.11, [1, -0.2, -0.3]);
const BELT_L = at(-1, -0.11, 0.54, 0.11, [1, -0.2, -0.3]);
const BELT: PoseSpec = { r: BELT_R, l: BELT_L, handR: 0.2, handL: 0.2 };

// ---------------------------------------------------------------------------
// Country

// --- Toe fans: weight on the left, the right toe swings out on its heel, then back in -------------
const tfOut: PoseSpec = {
  y: -0.05, x: -0.02, hips: -0.04, tilt: -4, lean: 3, twist: 12, hipTwist: 8, nod: 10, turn: 20, head: 4, shR: 0.4,
  rf: [0.1, 0, 0.01], lf: [-0.09, 0, 0], kneeR: 1.3, kneeL: 0.05, pitchR: -14, ...BELT,
};
const tfIn: PoseSpec = {
  y: -0.03, x: -0.01, hips: -0.02, tilt: -2, lean: 0, twist: 0, hipTwist: 0, nod: 3, turn: 4, head: 0, shR: 0,
  rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: -0.1, kneeL: 0.05, pitchR: 0, ...BELT,
};

// --- Heel bounces: up on the balls of both feet and down, one hand at the hat brim -------------
const HAT_R = at(1, 0.08, 0.99, 0.11, [1, 0.2, -0.1]);
const hbUp: PoseSpec = {
  y: 0.012, nod: -3, head: 4, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], pitchR: 24, pitchL: 24, kneeR: 0, kneeL: 0,
  r: HAT_R, l: BELT_L, handR: 0.3, handL: 0.2,
};
const hbDown: PoseSpec = {
  y: -0.04, nod: 7, head: 6, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], pitchR: 0, pitchL: 0, kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.09, 0.97, 0.12, [1, 0.2, -0.1]), l: BELT_L, handR: 0.3, handL: 0.2,
};

/** Last count: heels down, the hat hand lowering toward the belt to change hands. */
const hbSwap: PoseSpec = {
  ...hbDown, y: -0.035, nod: 2, head: 2,
  r: at(1, 0.1, 0.72, 0.14, [1, -0.2, -0.3]), l: at(-1, -0.1, 0.66, 0.13, [1, -0.2, -0.3]),
};

// --- Sugar foot: the free toe to the standing instep (knee in), then the heel (toe out) -------------
const sfToe: PoseSpec = {
  y: -0.06, x: -0.02, hips: -0.035, tilt: -4, lean: 1, nod: 9, turn: 8,
  rf: [-0.025, 0, 0.035], lf: [-0.09, 0, 0], pitchR: 34, kneeR: -0.7, kneeL: 0.05,
  r: ARM.hip, l: ARM.hip, handR: 0, handL: 0,
};
const sfHeel: PoseSpec = {
  y: -0.05, x: -0.02, hips: -0.03, tilt: -3, lean: 3, nod: 7, turn: 10,
  rf: [-0.015, 0, 0.05], lf: [-0.09, 0, 0], pitchR: -22, kneeR: 0.9, kneeL: 0.05,
  r: ARM.hip, l: ARM.hip, handR: 0, handL: 0,
};

// --- Heel & toe: the free heel touched forward on the diagonal, then its toe touched back -------------
const htHeel: PoseSpec = {
  spin: 26, y: -0.05, x: -0.01, hips: -0.02, lean: -2, bend: -7, nod: -2,
  rf: [0.14, 0, 0.16], lf: [-0.08, 0, 0], pitchR: -26, kneeL: 0.08, ...BELT,
};
const htToe: PoseSpec = {
  spin: 14, y: -0.07, x: -0.015, hips: -0.03, tilt: -3, bend: 12, nod: 12,
  rf: [0.1, 0, -0.14], lf: [-0.08, 0, 0], pitchR: 38, kneeR: -0.15, kneeL: 0.1,
  ...BELT,
};

// ---------------------------------------------------------------------------
// Swing

/** Loose swing arms, both hands swung toward one side (s = +1 screen right) at height y. */
const swingArms = (s: number, y = 0.52): PoseSpec => ({
  r: at(1, 0.17 + 0.13 * s, y + 0.09 * s, 0.14, E_OUT),
  l: at(-1, -0.17 + 0.13 * s, y - 0.09 * s, 0.14, E_OUT),
  handR: 0.8, handL: 0.8,
});

// --- Rock step & triple: rock back on the right, recover, triple step right-left-right to the side -------------
const rtRock: PoseSpec = {
  y: -0.06, x: 0.0, hips: 0.02, tilt: 2, bend: 7, nod: 4, twist: 6,
  rf: [0.1, 0, -0.14], lf: [-0.09, 0, 0.01], pitchR: 18, kneeL: 0.08, ...swingArms(-1, 0.5),
};
const rtRecover: PoseSpec = {
  y: -0.035, x: -0.01, hips: -0.03, tilt: -3, bend: 1, nod: 0, twist: 0,
  rf: [0.09, 0, 0], lf: [-0.09, 0, 0.01], kneeL: 0.05, ...swingArms(0, 0.55),
};
const rtTriple1: PoseSpec = {
  y: -0.06, x: 0.03, hips: 0.03, tilt: 3, lean: 2,
  rf: [0.17, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.06, ...swingArms(1, 0.55),
};
const rtTriple2: PoseSpec = {
  y: -0.03, x: 0.035, hips: 0.0, tilt: 0, lean: 1,
  rf: [0.17, 0, 0], lf: [0.04, 0, 0], ...swingArms(0.5, 0.57),
};
const rtTriple3: PoseSpec = {
  y: -0.065, x: 0.045, hips: 0.035, tilt: 4, lean: 3, head: 4,
  rf: [0.19, 0, 0], lf: [-0.01, 0, 0], kneeR: 0.06, ...swingArms(1, 0.6),
};

// --- Spank the baby: tap out with the teapot spout arm, close and lift the foot behind, spank -------------
const sbTap: PoseSpec = {
  x: 0.02, y: -0.05, hips: -0.02, tilt: -2, lean: -3, head: 6, turn: 16,
  rf: [0.25, 0, 0.01], lf: [-0.08, 0, 0], pitchR: 22, kneeL: 0.08,
  r: at(1, 0.36, 0.76, 0.1, E_OUT), l: ARM.hip, handR: 1, handL: 0,
};
const sbSpank: PoseSpec = {
  x: -0.01, y: -0.06, hips: -0.04, tilt: -5, lean: 2, bend: 5, head: -4, turn: -6, nod: 4,
  rf: [0.07, 0.075, -0.1], lf: [-0.08, 0, 0], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.07, 0.66, 0.18, E_DOWN), l: at(-1, -0.15, 0.48, -0.06, [1, -0.4, 0]), handR: 0.4, handL: 1,
};

/** Halfway: the tapping foot drawing in under the body, the arm starting to pull in. */
const sbClose: PoseSpec = {
  ...sbTap, x: 0.005, y: -0.055, hips: -0.03, tilt: -3, lean: 0, head: 2, turn: 4,
  rf: [0.08, 0.04, -0.06], pitchR: 0,
  r: at(1, 0.22, 0.7, 0.16, E_OUT),
};

// --- Side triples: triple step to the side (step, close, step), the loose arms swinging that way, then back -------------
const stStep1: PoseSpec = {
  x: 0.03, y: -0.06, hips: 0.03, tilt: 3, lean: 2, head: 3, shR: 0.3,
  rf: [0.16, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.06, ...swingArms(1, 0.56),
};
const stClose: PoseSpec = {
  x: 0.05, y: -0.03, hips: 0.0, tilt: 0, lean: 1, head: 1, shR: 0.1,
  rf: [0.16, 0, 0], lf: [0.05, 0, 0], ...swingArms(0.35, 0.56),
};
const stStep2: PoseSpec = {
  x: 0.07, y: -0.065, hips: 0.035, tilt: 4, lean: 3, head: 4, shR: 0.35,
  rf: [0.19, 0, 0], lf: [0.05, 0, 0], kneeR: 0.06, ...swingArms(1, 0.6),
};

// --- Peckin': step side to side, the head pecking forward on each beat -------------
/** Arms swinging against the peck: back as the head goes forward, forward as it pulls back. */
const pkArmsBack: PoseSpec = { r: [38, -70, 30, -70], l: [38, -70, 30, -70], handR: 0.6, handL: 0.6 };
const pkArmsFwd: PoseSpec = { r: [34, 70, 48, 75], l: [34, 70, 48, 75], handR: 0.6, handL: 0.6 };
const pkPeck = (step: boolean): PoseSpec => ({
  spin: 30, x: step ? 0.025 : 0.035, y: step ? -0.06 : -0.045, hips: 0.02, tilt: 2, bend: 18, nod: 22,
  rf: [0.15, 0, 0], lf: step ? [-0.06, 0, 0] : [0.03, 0.012, 0.01], kneeR: 0.05, pitchL: step ? 0 : 18,
  ...pkArmsBack,
});
const pkBack = (step: boolean): PoseSpec => ({
  ...pkPeck(step), ...pkArmsFwd, y: -0.035, bend: -3, nod: -14,
});

// ---------------------------------------------------------------------------
// Gospel

// --- Reach & receive: step out reaching both open hands forward and up, close and draw them to the heart -------------
const rrReach: PoseSpec = {
  spin: 16, x: 0.03, y: -0.05, hips: 0.03, tilt: 3, lean: 2, bend: 3, nod: -14, head: 4,
  rf: [0.16, 0, 0.03], lf: [-0.07, 0, 0], kneeR: 0.06,
  r: at(1, 0.27, 1.02, 0.18, E_UP), l: at(-1, -0.2, 1.04, 0.2, E_UP), handR: 1, handL: 1,
};
const rrHeart: PoseSpec = {
  spin: 6, x: 0.05, y: -0.04, hips: 0.02, tilt: 2, lean: 0, bend: 5, nod: 10, head: 2,
  rf: [0.15, 0, 0], lf: [0.03, 0.012, 0.01], pitchL: 16, kneeR: 0.05,
  r: at(1, -0.02, 0.73, 0.17, [1, -0.4, 0]), l: at(-1, 0.03, 0.7, 0.18, [1, -0.4, 0]), handR: 1, handL: 1,
};

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  // --- country ---
  full({
    id: 'toe-fan', name: 'Toe Fans', tags: 'pop rock | legs | country', beats: 2, level: 'low', d: 1, parts: ['legs'], mirror: true,
    desc: 'Thumbs in the belt loops and the weight on one foot: swing the other toe out to the side on its heel, looking down at it, then swing it back in; then the other foot.',
    keys: [[0, tfOut], [1, tfIn]],
  }),
  full({
    id: 'heel-bounce', name: 'Heel Bounces', tags: 'pop rock | legs | country', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Feet together, one hand holding the brim of the hat and the other thumb in the belt: lift both heels up onto the balls of the feet and drop them, three times, then change hands.',
    keys: [[0, hbDown], [0.5, hbUp], [1, hbDown], [1.5, hbUp], [2, hbDown], [2.5, hbUp], [3, hbSwap]],
  }),
  full({
    id: 'sugar-foot', name: 'Sugar Foot', tags: 'pop rock | legs | country', beats: 2, level: 'low', d: 1, parts: ['legs'], mirror: true,
    desc: 'Hands on the hips and the weight on one foot: touch the other toe to the instep of the standing foot with the knee turned in, then turn the knee out and touch the heel there; then the other foot.',
    keys: [[0, sfToe], [1, sfHeel]],
  }),
  full({
    id: 'heel-toe', name: 'Heel & Toe', tags: 'pop rock | legs | country', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Thumbs in the belt loops: touch the free heel forward on the diagonal, then touch its toe back behind, the head dipping; then the other foot.',
    keys: [[0, htHeel], [1, htToe]],
  }),
  // --- swing ---
  full({
    id: 'rock-triple', name: 'Rock Step & Triple', tags: 'pop party | legs | swing', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'The swing basic in place: rock back onto one foot, recover onto the other, then triple step to the side (step, close, step) with the loose arms swinging toward it; rock back on the other foot.',
    keys: [[0, rtRock], [1, rtRecover], [2, rtTriple1], [2.5, rtTriple2], [3, rtTriple3]],
  }),
  full({
    id: 'spank-baby', name: 'Spank the Baby', tags: 'pop party | legs arms | swing', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Arms like a teapot, one hand on the hip: tap one foot out to the side pushing the spout arm that way, then bring it in and lift it behind as that arm pulls in and the other hand spanks the bottom; then the other side.',
    keys: [[0, sbTap], [0.5, sbClose], [1, sbSpank]],
  }),
  full({
    id: 'side-triples', name: 'Side Triple Steps', tags: 'pop party | legs | swing walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true, travel: 0.1,
    desc: 'The swing triple step: step to the side, close the other foot, step again (1-and-2) with the loose arms swinging that way and the shoulder lifting; then triple back the other way.',
    keys: [[0, stStep1], [0.5, stClose], [1, stStep2]],
  }),
  full({
    id: 'peckin', name: "Peckin'", tags: 'pop party | legs | swing', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], mirror: true,
    desc: 'Turned a little to one side, step and touch, pecking the head forward like a chicken on every beat as both loose arms swing back, then pulling it back as they swing forward; then turn and peck the other way.',
    keys: [[0, pkPeck(true)], [0.5, pkBack(true)], [1, pkPeck(false)]],
  }),
  // --- gospel ---
  full({
    id: 'reach-receive', name: 'Reach & Receive', tags: 'pop | arms legs | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Step out on the diagonal reaching both open hands forward and up, palms up and eyes up, then touch the other foot in and draw both hands back to the heart with a small bow of the head; reach to the other side.',
    keys: [[0, rrReach], [1, rrHeart]],
  }),
];

