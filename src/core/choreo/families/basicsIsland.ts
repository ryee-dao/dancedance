/**
 * Simple basics for Easy: Caribbean, hula, capoeira, afrobeats and amapiano
 * basics (sets caribbean, hula, capoeira, afro, amapiano; ids in
 * ../genreSets/basics.ts). Every move is difficulty 1, low intensity, no
 * jumps or spins, feet under the body, shallow knees, the arms carrying the
 * style: the way each style's first class or first party teaches it.
 *
 *   caribbean  the one drop (the reggae drop on the third beat), the rock
 *              steady sway with finger snaps, the steppers skank (the slow
 *              knee-lift skank of the dub sound systems), soca chipping (the
 *              shuffling carnival road walk, here on the spot), a slow waist
 *              wine with the hands on the hips. (The dancehall butterfly is
 *              the global Butterfly Knees, deep and d2: left out.)
 *   hula       the ka'o (the hip sway in place that a first hula class
 *              starts on) under four of the basic hand motions: kai (ocean
 *              waves), lā (sun), aloha (love) and pua (flower); and the 'ami
 *              (hip circle) with the hula arms. (Lele walks forward: it
 *              doesn't read from the front; rain is the global Rain Down.)
 *   capoeira   the ginga taught slow and shallow (one step a beat, standing
 *              tall), the roda's palmas (two claps and a rest, swaying in
 *              the circle), the berimbau player's sway, and the maculelê
 *              stick strike (the stick dance capoeira groups teach and play
 *              in the roda). A shallow esquiva lateral measured as the
 *              existing Standing Esquiva: left out.
 *   afro       two azonto mimes on the azonto pivot (ironing, swimming),
 *              and the galala (bent knees, the feet shuffling on the spot).
 *   amapiano   hamba wena (the "go away" arm flung out to the side), the
 *              shirt pluck of the tshwala bam party, the bhenga toe tap with
 *              wobbly knees and wavy arms (gqom, which opens amapiano).
 *
 * Sources: huapala.org "Nā Keʻehi I Ka Haʻa - Hula Steps" (ka'o, 'ami, lele,
 * hela); LoveToKnow "Basic Hula Steps"; Raquelle Alexandria "7 Basic Hula Hand
 * Motions for Beginners" and Belle's Hula "Basic Hula: Hand Movements
 * Depicting Nature" (YouTube); Wikipedia "Rocksteady" (the calmer sway that
 * replaced the ska), "One drop rhythm"; Emkoz Entertainment "Basic Reggae
 * Dance Steps" and Howcast "3 Easy Dancehall Moves" (YouTube); Bizzy Boom "5
 * Soca Dance Moves" (YouTube, the chip and the wine); Howcast "How to Do the
 * Ginga", Mestre Mula "Capoeira Course - Beginner Basics - Ginga"; M & M Arts
 * "3 Palmas (Clapping Rhythms)" and Saber Capoeira "Tips for singing and
 * clapping in the capoeira circle"; Hip Shake Fitness "Learn Simple Brazilian
 * Warrior Dance Steps | Maculele" (YouTube); Wikipedia "Azonto" (the planted
 * and pivoting foot, the mimes of ironing, washing, driving, swimming...);
 * Afar "How to Dance the Azonto"; The Native "A guide to Africa's most popular
 * dance moves from the 2010s" (galala: "bend their knees and shuffle their
 * feet in one spot"); Dareallesley "Amapiano Dance Tutorial for Beginners |
 * Tshwala Bam, Hamba Wena" (YouTube); The Moveee "How to Do the Tshwala Bami
 * Dance" (the shirt pluck); Red Bull "SA dance styles" (bhenga: wavy arms,
 * toe-tapping, wobbly knees).
 * All are hand-authored full-body moves (no shared layer patterns).
 */
import { ARM, at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

// --- Caribbean ----------------------------------------------------------------------------
// One drop: the reggae skank on the one-drop beat. Sway onto one foot leaning back and away, that shoulder
// dropped, the loose arms rocking (the hand on the weighted side hanging low and out, the other forearm up
// across the belly); rock back a little on 2; on 3 (the drop) the knees bend and open, the chin and both
// shoulders drop and both loose hands fall open and low; rise easy on 4, chin up.
const ONE_DROP: (readonly [number, PoseSpec])[] = [
  [0, { x: 0.035, y: -0.05, hips: 0.06, tilt: 8, lean: 6, chestX: -0.02, bend: -5, head: 6, nod: -4, shR: 0, shL: 0.5, rf: [0.12, 0, 0.01], lf: [-0.11, 0, 0], kneeR: 0.04, kneeL: 0.1, pitchL: 18,
    r: at(1, 0.29, 0.5, 0.08, E_DOWN), l: at(-1, 0.0, 0.66, 0.22, E_DOWN), handR: 0.6, handL: 0.6 }],
  [1, { x: 0.02, y: -0.035, hips: 0.03, tilt: 4, lean: 2, chestX: -0.01, bend: -3, head: 3, nod: -2, shR: 0.2, shL: 0.3, rf: [0.12, 0, 0.01], lf: [-0.11, 0, 0], kneeR: 0.02, kneeL: 0.06, pitchL: 10,
    r: at(1, 0.2, 0.6, 0.16, E_DOWN), l: at(-1, -0.1, 0.62, 0.2, E_DOWN), handR: 0.6, handL: 0.6 }],
  [2, { x: 0.0, y: -0.11, hips: 0.0, tilt: 0, lean: 0, chestX: 0, bend: 8, head: 0, nod: 15, shR: 0, shL: 0, rf: [0.12, 0, 0.01], lf: [-0.11, 0, 0], kneeR: 0.2, kneeL: 0.2, pitchL: 0,
    r: at(1, 0.27, 0.46, 0.14, E_DOWN), l: at(-1, -0.27, 0.46, 0.14, E_DOWN), handR: 1, handL: 1 }],
  [3, { x: -0.01, y: -0.035, hips: -0.015, tilt: -2, lean: -1, chestX: 0, bend: -4, head: 0, nod: -5, shR: 0.35, shL: 0.35, rf: [0.12, 0, 0.01], lf: [-0.11, 0, 0], kneeR: 0.02, kneeL: 0.02, pitchL: 0,
    r: at(1, 0.16, 0.62, 0.18, E_DOWN), l: at(-1, -0.16, 0.62, 0.18, E_DOWN), handR: 0.5, handL: 0.5 }],
];

// Rock steady: a slow sway from side to side with the shoulders, the fingers snapping low on the off beat.
const rockSteady = (s: 1 | -1, snap: boolean): PoseSpec => ({
  x: 0.035 * s, y: snap ? -0.04 : -0.065, hips: 0.045 * s, tilt: 6 * s, lean: -2 * s, head: 4 * s, nod: snap ? -3 : 3,
  shR: s > 0 ? 0.5 : 0.1, shL: s < 0 ? 0.5 : 0.1,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: s < 0 ? 0.12 : 0, kneeL: s > 0 ? 0.12 : 0, pitchR: s < 0 ? 12 : 0, pitchL: s > 0 ? 12 : 0,
  r: at(1, 0.2 + 0.04 * s, snap ? 0.64 : 0.56, 0.15, E_DOWN), l: at(-1, -0.2 + 0.04 * s, snap ? 0.64 : 0.56, 0.15, E_DOWN),
  handR: snap ? 0.1 : 0.9, handL: snap ? 0.1 : 0.9,
});

// Steppers skank: lift one knee a little and swing the opposite fist across in front, leaning back, cool and slow.
const skank = (s: 1 | -1): PoseSpec => ({
  y: -0.04, bend: -4, nod: -4, twist: -8 * s, hips: -0.02 * s, tilt: -3 * s, head: 0,
  rf: s > 0 ? [0.09, 0.09, 0.05] : [0.09, 0, 0], lf: s < 0 ? [-0.09, 0.09, 0.05] : [-0.09, 0, 0],
  r: s > 0 ? at(1, 0.24, 0.56, -0.06, E_OUT) : at(1, -0.02, 0.72, 0.2, E_DOWN),
  l: s > 0 ? at(-1, 0.02, 0.72, 0.2, E_DOWN) : at(-1, -0.24, 0.56, -0.06, E_OUT), handR: 0.2, handL: 0.2,
});
const SKANK_MID: PoseSpec = {
  y: -0.08, bend: -2, nod: 2, twist: 0, hips: 0, tilt: 0, head: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0],
  r: at(1, 0.14, 0.62, 0.1, E_DOWN), l: at(-1, -0.14, 0.62, 0.1, E_DOWN), handR: 0.2, handL: 0.2,
};

// Chipping: tiny dragging steps on the spot, hips swinging with each, the hand on the stepping side up in the air.
const chip = (s: 1 | -1, down: boolean): PoseSpec => ({
  x: 0.015 * s, y: down ? -0.07 : -0.045, hips: 0.045 * s, tilt: 6 * s, head: -3 * s, nod: down ? 3 : -2,
  rf: s > 0 ? [0.1, 0, 0.07] : [0.09, 0, -0.03], lf: s > 0 ? [-0.09, 0, -0.03] : [-0.1, 0, 0.07], slideR: true, slideL: true,
  kneeR: 0.06, kneeL: 0.06,
  r: s > 0 ? at(1, 0.26, down ? 1.04 : 1.09, 0.08, E_UP) : at(1, 0.12, 0.7, 0.2, E_DOWN),
  l: s < 0 ? at(-1, -0.26, down ? 1.04 : 1.09, 0.08, E_UP) : at(-1, -0.12, 0.7, 0.2, E_DOWN), handR: 1, handL: 1,
});

// A hip circle (wine / 'ami) at quarter turn k of 8 per circle: side, back, other side, front.
const circleHips = (k: number, amp: number): PoseSpec => {
  const a = (k * Math.PI) / 4;
  return { hips: amp * Math.cos(a), tilt: (amp / 0.07) * 9 * Math.cos(a), bend: 6 * Math.sin(a), chestX: -0.02 * Math.cos(a), nod: 3 * Math.sin(a) };
};
const wine = (k: number): PoseSpec => ({
  y: -0.06, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1, ...circleHips(k, 0.07), head: -3 * Math.cos((k * Math.PI) / 4),
  // One hand on the hip, the other raised high and swaying with the waist; over the last beat the
  // raised hand lowers out to the side and the hip hand starts up, ready for the other side.
  r: k < 6 ? at(1, 0.2 + 0.04 * Math.cos((k * Math.PI) / 4), 1.05, 0.1, E_UP) : at(1, 0.3, k === 6 ? 0.92 : 0.8, 0.1, E_OUT),
  l: k < 7 ? ARM.hip : at(-1, -0.28, 0.86, 0.1, E_OUT), handR: 1, handL: k < 7 ? 0.6 : 1,
});

// --- Hula ---------------------------------------------------------------------------------
// Ka'o: knees soft, sway the hips from side to side in place; the heel lifts on the side the hip lifts.
const kao = (s: 1 | -1): PoseSpec => ({
  y: -0.06, x: 0.012 * s, hips: 0.055 * s, tilt: 8 * s, chestX: -0.015 * s, head: -3 * s,
  rf: [0.08, 0, 0], lf: [-0.08, 0, 0], pitchR: s > 0 ? 16 : 0, pitchL: s < 0 ? 16 : 0, kneeR: 0.05, kneeL: 0.05,
});
// Kai (ocean): both hands low in front toward the sway, palms down, rippling one over the other.
const kai = (s: 1 | -1, rUp: boolean): PoseSpec => ({
  r: s > 0 ? at(1, 0.38, rUp ? 0.72 : 0.64, 0.14, E_DOWN) : at(1, 0.04, rUp ? 0.68 : 0.62, 0.24, E_DOWN),
  l: s < 0 ? at(-1, -0.38, rUp ? 0.64 : 0.72, 0.14, E_DOWN) : at(-1, -0.04, rUp ? 0.62 : 0.68, 0.24, E_DOWN), handR: 1, handL: 1,
});
// Lā (sun): the arms rise from the sides into a circle over the head and open.
const SUN: readonly PoseSpec[] = [
  { r: at(1, 0.3, 0.58, 0.1, E_OUT), l: at(-1, -0.3, 0.58, 0.1, E_OUT), handR: 1, handL: 1 },
  { r: at(1, 0.4, 0.86, 0.06, E_OUT), l: at(-1, -0.4, 0.86, 0.06, E_OUT), handR: 1, handL: 1 },
  { r: at(1, 0.07, 1.07, 0.1, E_OUT), l: at(-1, -0.07, 1.07, 0.1, E_OUT), handR: 1, handL: 1 },
  { r: at(1, 0.3, 1.0, 0.08, E_UP), l: at(-1, -0.3, 1.0, 0.08, E_UP), handR: 1, handL: 1 },
];
// Aloha (love): the hands crossed over the heart, then opened out in front, palms up.
const ALOHA: readonly PoseSpec[] = [
  { r: at(1, -0.05, 0.73, 0.15, E_DOWN), l: at(-1, 0.05, 0.76, 0.16, E_DOWN), handR: 1, handL: 1 },
  { r: at(1, -0.04, 0.75, 0.16, E_DOWN), l: at(-1, 0.06, 0.78, 0.17, E_DOWN), handR: 1, handL: 1 },
  { r: at(1, 0.2, 0.76, 0.24, E_DOWN), l: at(-1, -0.2, 0.76, 0.24, E_DOWN), handR: 1, handL: 1 },
  { r: at(1, 0.36, 0.8, 0.14, E_OUT), l: at(-1, -0.36, 0.8, 0.14, E_OUT), handR: 1, handL: 1 },
];
// Pua (flower): the hands cupped together low in front, rising, then blooming open beside the face.
const PUA: readonly PoseSpec[] = [
  { r: at(1, 0.035, 0.6, 0.22, E_DOWN), l: at(-1, -0.035, 0.6, 0.22, E_DOWN), handR: 0.5, handL: 0.5 },
  { r: at(1, 0.04, 0.74, 0.23, E_DOWN), l: at(-1, -0.04, 0.74, 0.23, E_DOWN), handR: 0.6, handL: 0.6 },
  { r: at(1, 0.045, 0.84, 0.26, E_DOWN), l: at(-1, -0.045, 0.84, 0.26, E_DOWN), formR: 'fingers', formL: 'fingers' },
  { r: at(1, 0.15, 0.98, 0.2, E_DOWN), l: at(-1, -0.15, 0.98, 0.2, E_DOWN), formR: 'fingers', formL: 'fingers' },
];
// Hula arms: one arm out to the side at shoulder height, the other bent across the chest pointing the same way.
const HULA_ARMS: PoseSpec = { r: at(1, 0.4, 0.82, 0.08, E_OUT), l: at(-1, 0.08, 0.8, 0.21, E_DOWN), handR: 1, handL: 1, turn: 14 };
// On the last half beat the hands pass in front of the chest on their way to the other side.
const HULA_MID: PoseSpec = { r: at(1, 0.14, 0.78, 0.22, E_DOWN), l: at(-1, -0.14, 0.78, 0.22, E_DOWN), handR: 1, handL: 1, turn: 0 };
const ami = (k: number): PoseSpec => ({
  y: -0.07, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.06, kneeL: 0.06, ...circleHips(k, 0.06), ...(k === 7 ? HULA_MID : HULA_ARMS),
});

// --- Capoeira -----------------------------------------------------------------------------
const GUARD = at(1, -0.01, 0.9, 0.21, [1, -0.4, -0.2]);
// The ginga taught slow and tall: right foot back on the diagonal with the right forearm guarding the face.
const GINGA_BACK: PoseSpec = {
  spin: -18, y: -0.07, x: 0.015, bend: 6, twist: -8, turn: -4, rf: [0.15, 0, -0.13], lf: [-0.13, 0, 0.02], kneeL: 0.06,
  r: GUARD, l: at(-1, -0.28, 0.56, 0.08, E_DOWN), handR: 1, handL: 1,
};
const GINGA_BASE: PoseSpec = {
  spin: 0, y: -0.055, x: 0, bend: 3, twist: 0, turn: 0, rf: [0.14, 0, 0], lf: [-0.14, 0, 0], kneeL: 0,
  r: at(1, 0.2, 0.72, 0.18, E_DOWN), l: at(-1, -0.2, 0.72, 0.18, E_DOWN), handR: 1, handL: 1,
};
// Palmas in the roda: sway in place, clap twice, rest with the hands apart.
const roda = (s: 1 | -1, hands: 'clap' | 'near' | 'apart'): PoseSpec => ({
  x: 0.025 * s, y: hands === 'clap' ? -0.065 : -0.045, hips: 0.03 * s, tilt: 4 * s, head: 3 * s, nod: hands === 'clap' ? 4 : 0,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: s < 0 ? 0.08 : 0, kneeL: s > 0 ? 0.08 : 0,
  ...(hands === 'clap'
    ? { r: at(1, 0.02, 0.76, 0.22, E_DOWN), l: at(-1, -0.02, 0.76, 0.22, E_DOWN) }
    : hands === 'near'
      ? { r: at(1, 0.12, 0.8, 0.2, E_DOWN), l: at(-1, -0.12, 0.8, 0.2, E_DOWN) }
      : { r: at(1, 0.26, 0.7, 0.14, E_OUT), l: at(-1, -0.26, 0.7, 0.14, E_OUT) }),
  handR: 1, handL: 1,
});
// Berimbau: the left hand holds the bow upright with the gourd at the belly, the right strikes the wire; swaying.
const berimbau = (s: 1 | -1, strike: boolean): PoseSpec => ({
  x: 0.02 * s, y: strike ? -0.065 : -0.045, hips: 0.03 * s, tilt: 4 * s, head: 4, turn: -8, nod: strike ? 5 : 1,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: s < 0 ? 0.08 : 0, kneeL: s > 0 ? 0.08 : 0,
  l: at(-1, -0.02, 0.66, strike ? 0.13 : 0.22, E_DOWN), r: strike ? at(1, 0.05, 0.78, 0.26, E_OUT) : at(1, 0.22, 0.86, 0.2, E_OUT),
  handR: 0.2, handL: 0,
});
// Maculelê: a stick in each fist, struck together in front on the step and over the head on the touch.
const MAC: (readonly [number, PoseSpec])[] = [
  [0, { x: 0.03, y: -0.07, hips: 0.03, tilt: 4, nod: 4, rf: [0.17, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.08, r: at(1, 0.03, 0.78, 0.25, E_OUT), l: at(-1, -0.03, 0.78, 0.25, E_OUT), handR: 0, handL: 0 }],
  [0.5, { x: 0.04, y: -0.05, hips: 0.02, tilt: 2, nod: 0, rf: [0.17, 0, 0], lf: [-0.06, 0, 0], kneeR: 0.04, r: at(1, 0.32, 0.86, 0.1, E_OUT), l: at(-1, -0.28, 0.86, 0.1, E_OUT), handR: 0, handL: 0 }],
  [1, { x: 0.05, y: -0.06, hips: 0.04, tilt: 5, nod: -8, rf: [0.17, 0, 0], lf: [0.02, 0, 0.01], pitchL: 22, kneeL: -0.1, r: at(1, 0.03, 1.08, 0.12, E_UP), l: at(-1, -0.03, 1.08, 0.12, E_UP), handR: 0, handL: 0 }],
  [1.5, { x: 0.04, y: -0.05, hips: 0.02, tilt: 2, nod: 0, rf: [0.17, 0, 0], lf: [-0.04, 0, 0], pitchL: 0, kneeL: 0, r: at(1, 0.3, 0.64, 0.1, E_OUT), l: at(-1, -0.26, 0.64, 0.1, E_OUT), handR: 0, handL: 0 }],
];

// --- Afrobeats ----------------------------------------------------------------------------
// The azonto pivot: the left foot planted, the right on its ball twisting the knee in and out.
const pivot = (inward: boolean): PoseSpec => ({
  y: -0.06, bend: 6, rf: [0.1, 0, 0.05], lf: [-0.1, 0, 0], pitchR: 22, kneeR: inward ? -0.45 : 0.35, hipTwist: inward ? -8 : 6,
  hips: inward ? -0.015 : 0.015, tilt: inward ? -2 : 2,
});
// Galala: knees bent, the feet shuffling on the spot, fists pumping alternately in front of the waist.
const galala = (s: 1 | -1, down: boolean): PoseSpec => ({
  y: down ? -0.08 : -0.05, bend: 8, nod: down ? 6 : 2, shR: s > 0 ? 0.7 : 0.1, shL: s < 0 ? 0.7 : 0.1, hips: 0.02 * s, tilt: 2 * s,
  rf: s > 0 ? [0.09, 0, 0.08] : [0.09, 0, -0.04], lf: s > 0 ? [-0.09, 0, -0.04] : [-0.09, 0, 0.08], slideR: true, slideL: true,
  kneeR: -0.15, kneeL: -0.15,
  r: at(1, 0.16, s > 0 ? 0.84 : 0.56, 0.2, E_OUT), l: at(-1, -0.16, s < 0 ? 0.84 : 0.56, 0.2, E_OUT), handR: 0.1, handL: 0.1,
});

// --- Amapiano -----------------------------------------------------------------------------
// Bhenga: tap one toe out to the side with the other knee wobbling in, both hands waving low in front.
const bhenga = (tap: boolean, k: number): PoseSpec => ({
  y: tap ? -0.075 : -0.05, x: tap ? -0.012 : 0, hips: tap ? -0.03 : 0, tilt: tap ? -4 : 0, head: tap ? 4 : 0, turn: tap ? 12 : 0,
  rf: tap ? [0.21, 0, 0.03] : [0.1, 0, 0], lf: [-0.1, 0, 0], pitchR: tap ? 20 : 0, kneeL: tap ? -0.35 : 0.1, kneeR: tap ? 0.15 : 0,
  r: at(1, 0.22 + 0.08 * Math.cos(k), 0.66 + 0.1 * Math.sin(k), 0.2, E_OUT), l: at(-1, -0.12 + 0.08 * Math.cos(k), 0.66 - 0.1 * Math.sin(k), 0.22, E_OUT),
  handR: 1, handL: 1,
});

export const patterns: PatternSet = {};

const caribbean: MoveDef[] = [
  full({
    id: 'one-drop-rock', name: 'One Drop', tags: 'hiphop pop | full | reggae', beats: 4, level: 'low', d: 1, parts: ['legs', 'torso', 'arms'], mirror: true,
    desc: 'Reggae\'s one drop: sway onto one foot leaning back a little with that shoulder dropped, the loose arms rocking (one hand hanging low and out, the other forearm across the belly), then on the third beat drop: knees bend and open, chin and shoulders down, both loose hands falling low; rise easy on the fourth and sway to the other foot.',
    keys: ONE_DROP,
  }),
  full({
    id: 'rocksteady-sway', name: 'Rock Steady Sway', tags: 'pop hiphop | hips arms | reggae', beats: 4, level: 'low', d: 1, parts: ['hips', 'torso', 'arms'],
    desc: 'Slow and cool: sway the hips and shoulders over to one side on the beat and snap the fingers low by the hips on the next, then sway over to the other side and snap.',
    keys: [[0, rockSteady(1, false)], [1, rockSteady(1, true)], [2, rockSteady(-1, false)], [3, rockSteady(-1, true)]],
  }),
  full({
    id: 'steppers-skank', name: 'Steppers Skank', tags: 'hiphop pop | legs arms | reggae', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'The sound-system skank: leaning back a little, lift one knee a few inches and swing the opposite loose fist across in front, set it down, then the other knee and fist.',
    keys: [[0, skank(1)], [0.5, SKANK_MID], [1, skank(-1)], [1.5, SKANK_MID]],
  }),
  full({
    id: 'soca-chip', name: 'Chipping', tags: 'party latin | legs hips | walk soca', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips', 'arms'],
    desc: 'The carnival road shuffle on the spot: drag one foot a little forward and the other back with a soft knee, the hips swinging with each step and the hand on that side waving up in the air, the other loose in front; then switch feet.',
    keys: [[0, chip(1, true)], [0.5, chip(1, false)], [1, chip(-1, true)], [1.5, chip(-1, false)]],
  }),
  full({
    id: 'waist-wine', name: 'Waist Wine', tags: 'latin party | hips | hips soca dancehall', beats: 4, level: 'low', d: 1, parts: ['hips', 'arms'], mirror: true,
    desc: 'Feet a little apart and knees soft, one hand on the hip and the other raised high, roll the waist round in a slow circle over four beats: out to one side, back, to the other side, forward; then switch hands.',
    keys: [0, 1, 2, 3, 4, 5, 6, 7].map((k): readonly [number, PoseSpec] => [k / 2, wine(k)]),
  }),
];

const hula: MoveDef[] = [
  full({
    id: 'kao-ocean', name: "Ka'o Ocean Hands", tags: 'latin pop | hips arms | wave hula', beats: 2, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'Ka\'o, the hula sway in place: knees soft, sway the hips from side to side lifting the heel under the raised hip, both hands low in front toward the sway, palms down and rippling like waves.',
    keys: [[0, { ...kao(1), ...kai(1, true) }], [0.5, { ...kao(1), y: -0.065, ...kai(1, false) }], [1, { ...kao(-1), ...kai(-1, true) }], [1.5, { ...kao(-1), y: -0.065, ...kai(-1, false) }]],
  }),
  full({
    id: 'kao-sun', name: "Ka'o Sun Arms", tags: 'latin pop | hips arms | hula', beats: 4, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'Swaying the hips side to side on every beat, raise both arms from the sides up into a round sun over the head, then open them out high and float them down.',
    keys: [[0, { ...kao(1), ...SUN[0] }], [1, { ...kao(-1), ...SUN[1] }], [2, { ...kao(1), ...SUN[2] }], [3, { ...kao(-1), ...SUN[3] }]],
  }),
  full({
    id: 'kao-aloha', name: "Ka'o Aloha Hands", tags: 'latin pop | hips arms | hula', beats: 4, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'Swaying the hips side to side on every beat, cross both hands over the heart for two beats, then open them out in front, palms up, as if giving the love away.',
    keys: [[0, { ...kao(1), ...ALOHA[0] }], [1, { ...kao(-1), ...ALOHA[1] }], [2, { ...kao(1), ...ALOHA[2] }], [3, { ...kao(-1), ...ALOHA[3] }]],
  }),
  full({
    id: 'kao-flower', name: "Ka'o Flower Hands", tags: 'latin pop | hips arms | hula', beats: 4, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'Swaying the hips side to side on every beat, hold the hands cupped together low in front, raise them to the chin, wrists together, and let the fingers bloom open up in front of the face like a flower.',
    keys: [[0, { ...kao(1), ...PUA[0] }], [1, { ...kao(-1), ...PUA[1] }], [2, { ...kao(1), ...PUA[2] }], [3, { ...kao(-1), ...PUA[3] }]],
  }),
  full({
    id: 'ami-hula', name: "'Ami", tags: 'latin pop | hips | hips hula', beats: 4, level: 'low', d: 1, parts: ['hips'], mirror: true,
    desc: 'The hula hip circle: feet close and knees soft, roll the hips round slowly over four beats, one arm out to the side at shoulder height and the other bent across the chest pointing the same way, eyes following the hands.',
    keys: [0, 1, 2, 3, 4, 5, 6, 7].map((k): readonly [number, PoseSpec] => [k / 2, ami(k)]),
  }),
];

const capoeira: MoveDef[] = [
  full({
    id: 'ginga-basic', name: 'Basic Ginga', tags: 'latin hiphop | legs arms | walk capoeira', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'The ginga as a first class teaches it, slow and tall: step one foot back on the diagonal with that forearm up guarding the face, back to the base, then the other foot back with the other arm up.',
    keys: [[0, GINGA_BACK], [1, GINGA_BASE], [2, mir(GINGA_BACK)], [3, GINGA_BASE]],
  }),
  full({
    id: 'roda-palmas', name: 'Roda Palmas', tags: 'latin party | arms | clap capoeira', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'],
    desc: 'Standing in the capoeira circle: sway with the music and clap the rhythm of the roda, two claps and a rest, the hands opening wide on the rest.',
    keys: [[0, roda(1, 'clap')], [0.5, roda(1, 'near')], [1, roda(1, 'clap')], [2, roda(-1, 'apart')], [3, roda(-1, 'apart')]],
  }),
  full({
    id: 'berimbau-sway', name: 'Berimbau Sway', tags: 'latin party | arms | capoeira', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'Play an imaginary berimbau: one fist holds the bow upright with the gourd against the belly, the other hand strikes the wire in front of the chest on every beat as the gourd opens, swaying from side to side.',
    keys: [[0, berimbau(1, true)], [0.5, berimbau(1, false)], [1, berimbau(-1, true)], [1.5, berimbau(-1, false)]],
  }),
  full({
    id: 'maculele-strike', name: 'Maculelê Strike', tags: 'latin party | arms legs | capoeira', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'A stick in each fist: step out to the side and strike the sticks together in front of the chest, open them, touch the other foot in and strike them together over the head.',
    keys: MAC,
  }),
];

const afro: MoveDef[] = [
  full({
    id: 'azonto-iron', name: 'Azonto Iron', tags: 'hiphop | arms legs | afro', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Azonto miming the ironing: one foot planted and the other on its ball twisting the knee in and out on the beat, one flat hand irons out to the side and back at the waist while the other holds the cloth.',
    keys: [
      [0, { ...pivot(true), bend: 10, nod: 10, r: at(1, 0.0, 0.66, 0.24, E_OUT), l: at(-1, -0.16, 0.66, 0.22, E_OUT), handR: 1, handL: 1 }],
      [1, { ...pivot(false), bend: 10, nod: 8, turn: 10, r: at(1, 0.34, 0.66, 0.18, E_OUT), l: at(-1, -0.16, 0.66, 0.22, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'azonto-swim', name: 'Azonto Swim', tags: 'hiphop | arms legs | afro', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Azonto miming the swim: the knee twisting in and out on the pivot foot, reach one arm up and over in a slow front-crawl stroke as the other pulls down past the hip, one stroke per beat.',
    keys: [
      [0, { ...pivot(true), twist: 8, lean: -3, r: at(1, 0.14, 1.06, 0.18, E_UP), l: at(-1, -0.22, 0.5, 0.0, E_DOWN), handR: 1, handL: 1 }],
      [0.5, { ...pivot(false), y: -0.05, twist: 0, lean: 0, r: at(1, 0.38, 0.82, 0.12, E_OUT), l: at(-1, -0.36, 0.76, 0.06, E_OUT), handR: 1, handL: 1 }],
      [1, { ...pivot(true), twist: -8, lean: 3, l: at(-1, -0.14, 1.06, 0.18, E_UP), r: at(1, 0.22, 0.5, 0.0, E_DOWN), handR: 1, handL: 1 }],
      [1.5, { ...pivot(false), y: -0.05, twist: 0, lean: 0, l: at(-1, -0.38, 0.82, 0.12, E_OUT), r: at(1, 0.36, 0.76, 0.06, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'galala', name: 'Galala', tags: 'hiphop | legs arms | afro', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'The Lagos street classic: knees bent and the body tipped a little forward, shuffle the feet forward and back on the spot while the fists pump up and down in turn in front of the waist with the shoulders.',
    keys: [[0, galala(1, true)], [0.5, galala(1, false)], [1, galala(-1, true)], [1.5, galala(-1, false)]],
  }),
];

const amapiano: MoveDef[] = [
  full({
    id: 'hamba-wena', name: 'Hamba Wena', tags: 'hiphop | arms | amapiano', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Knees bouncing loose with the log drum, bring one hand in to the chest, then step a little to that side and fling the arm straight out to the side at shoulder height, palm out: "go away"; then the other side.',
    keys: [
      [0, { y: -0.08, x: -0.015, hips: -0.02, tilt: -3, nod: 4, turn: 0, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.1, r: at(1, 0.04, 0.76, 0.17, E_DOWN), l: at(-1, -0.2, 0.56, 0.08, E_DOWN), handR: 0.7, handL: 0.5 }],
      [0.5, { y: -0.05, x: 0, hips: 0, tilt: 0, nod: 0, turn: 4, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.04, r: at(1, 0.1, 0.8, 0.18, E_DOWN), l: at(-1, -0.2, 0.56, 0.08, E_DOWN), handR: 0.8, handL: 0.5 }],
      [1, { y: -0.08, x: 0.025, hips: 0.03, tilt: 4, nod: 2, turn: 18, head: 3, rf: [0.15, 0, 0.02], lf: [-0.09, 0, 0], kneeR: 0.06, r: at(1, 0.42, 0.84, 0.06, E_OUT), l: at(-1, -0.18, 0.56, 0.1, E_DOWN), handR: 1, handL: 0.5 }],
      [1.5, { y: -0.05, x: 0.02, hips: 0.02, tilt: 2, nod: 0, turn: 12, head: 1, rf: [0.15, 0, 0.02], lf: [-0.09, 0, 0], kneeR: 0.02, r: at(1, 0.4, 0.8, 0.08, E_OUT), l: at(-1, -0.18, 0.56, 0.1, E_DOWN), handR: 1, handL: 0.5 }],
    ],
  }),
  full({
    id: 'shirt-pluck', name: 'Shirt Pluck Groove', tags: 'hiphop | arms | amapiano', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'],
    desc: 'Slow knee bounce on the log drum, pinch the shirt at the chest with both hands and pluck it out with one hand as that shoulder lifts, then with the other, cool and unbothered.',
    keys: [
      [0, { y: -0.09, bend: 5, nod: 5, twist: 0, shR: 0, shL: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.08, kneeL: 0.08, r: at(1, 0.07, 0.72, 0.14, E_OUT), l: at(-1, -0.07, 0.72, 0.14, E_OUT), handR: 0.15, handL: 0.15 }],
      [0.5, { y: -0.04, bend: 1, nod: -4, twist: -10, head: -5, shR: 1, shL: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.02, kneeL: 0.02, r: at(1, 0.24, 0.84, 0.22, E_OUT), l: at(-1, -0.07, 0.72, 0.14, E_OUT), handR: 0.15, handL: 0.15 }],
      [1, { y: -0.09, bend: 5, nod: 5, twist: 0, head: 0, shR: 0, shL: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.08, kneeL: 0.08, r: at(1, 0.07, 0.72, 0.14, E_OUT), l: at(-1, -0.07, 0.72, 0.14, E_OUT), handR: 0.15, handL: 0.15 }],
      [1.5, { y: -0.04, bend: 1, nod: -4, twist: 10, head: 5, shR: 0, shL: 1, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.02, kneeL: 0.02, r: at(1, 0.07, 0.72, 0.14, E_OUT), l: at(-1, -0.24, 0.84, 0.22, E_OUT), handR: 0.15, handL: 0.15 }],
    ],
  }),
  full({
    id: 'bhenga-tap', name: 'Bhenga Toe Tap', tags: 'hiphop | legs arms | amapiano', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Gqom\'s bhenga: tap one toe out to the side as the other knee wobbles in, bring it back, the hands waving low and loose in front the whole time; tap the other side.',
    keys: [[0, bhenga(true, 0)], [0.5, bhenga(true, Math.PI / 2)], [1, bhenga(false, Math.PI)], [1.5, bhenga(false, Math.PI * 1.5)]],
  }),
];

export const moves: MoveDef[] = [...caribbean, ...hula, ...capoeira, ...afro, ...amapiano];
