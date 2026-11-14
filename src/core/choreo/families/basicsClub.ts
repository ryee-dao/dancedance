/**
 * Simple basics for Easy (difficulty 1, low impact, no jumps or spins, feet
 * under the body) for the club and loud sub-style sets: house, bass, edm,
 * metal, punk, drill (ids in ../genreSets/basics.ts). Each set had 2-5
 * Easy-eligible moves; its bigger moves (loose legs, scissor step, hakken,
 * pogo, sturdy hop, the deep chug / wall-of-death squats) stay for Medium /
 * Hard. Already global and left alone: fist pump, steering wheel (the-drive),
 * catwalk, step touch, march, heel swivel.
 *
 * House (sources: Alvin Ailey Extension "House" class outline - jacking,
 * skating, sidewalk, stomp; KQED / Just Sole! "4 house moves" - chase, heel
 * toe, swirl, jack; DNCR Dance Tutorials "How to do the Heel Toe" (YouTube
 * gaFlyRcL230: "right foot in front on the heel, turn both feet to the
 * right"); PopYourDream "House dance heel toe for beginners" (hnf1aOWyxGU);
 * Wikipedia "House dance" - jacking forward / back, side to side, rolling):
 *   Side Jack, Rolling Jack (the jack's lateral and circular forms), House
 *   Heel-Toe (heel dig then both feet swivel, in place), Step Jack (the jack
 *   on a step-touch, how the jack is first taken onto the feet).
 * Bass music (Wikipedia "Skanking" - the drum & bass skank / x-stepping;
 *   "how to dance dubstep" beginner guides - the "clam shell" open / close
 *   that underlies the hits, and wobble bass arm pumps; phonk "drift" videos -
 *   the wheel cranked into the turn):
 *   DnB Skank (small, on the spot), Wobble Arms, Clam Shell, Drift Steer.
 * EDM: Build-Up Clap (the crowd's overhead clap through a build-up / snare
 *   roll; festival crowd footage).
 * Metal (crowd gestures: the sign of the horns (Dio), fist banging toward the
 *   stage, the slow sway with a raised hand at doom / power-ballad tempo, the
 *   half-time headbang of a breakdown; Wikipedia "Headbanging", "Sign of the
 *   horns"; AUTHORING.md's metal vocabulary "slow heavy sway with fist"):
 *   Horns Sway, Fist Bang, Horns Step, Breakdown Nod.
 * Punk / ska (Wikipedia "Skanking": the original skank - running-man legs with
 *   alternating bent-elbow fist punches; the ska "stroll" - swaying side to
 *   side with bent arms, marching in time; the hardcore two-step, here taught
 *   grounded, without the hop):
 *   Ska Stroll, Skank Punches, Grounded Two-Step.
 * Drill (Chop Daily "How To Below The Knee - UK Drill (Dance Tutorial)",
 *   YouTube D0fhNuxavGY; Lord Hec "How To Drill Dance In 2020 | Pop Smoke
 *   Dance Tutorial", RX7VnMsJmrs - the "woo" pose; the drill bounce of
 *   urban.ts, kept soft):
 *   Below the Knee, Woo Bounce, Drill Sway.
 *
 * All hand-authored full-body moves; no patterns.
 */
import { FIST, OPEN, at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.6, -1, -0.3] as const;
const E_UP = [1, 0.3, -0.2] as const;
const E_BACK = [1, 0, -0.5] as const;
const HORNS = { handR: 0, handL: 0, formR: 'horns', formL: 'horns' } as const;

// ---------------------------------------------------------------------------
// House

/** Side jack: the rib cage slides over to one side on the beat with the knees, loose arms swinging with it. */
const sjA: PoseSpec = {
  y: -0.07, x: 0.02, chestX: 0.06, hips: -0.025, lean: 5, head: -5, nod: 7, shR: 0.7, shL: 0.1,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.08, kneeL: 0.08,
  r: at(1, 0.29, 0.56, 0.06, E_OUT), l: at(-1, -0.06, 0.58, 0.16, E_DOWN), handR: 0.5, handL: 0.5,
};
const sjMid: PoseSpec = {
  y: -0.025, x: 0, chestX: 0, hips: 0, lean: 0, head: 0, nod: -2, shR: 0.2, shL: 0.2,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.02, kneeL: 0.02,
  r: at(1, 0.19, 0.6, 0.12, E_OUT), l: at(-1, -0.19, 0.6, 0.12, E_OUT), handR: 0.5, handL: 0.5,
};

/** House heel-toe: the heel dug in front, then both feet swivel toward that side as the chest jacks down. */
const htHeel: PoseSpec = {
  y: -0.035, bend: -5, nod: -4, hipTwist: 0, rf: [0.17, 0, 0.12], lf: [-0.09, 0, 0], pitchR: -26, pitchL: 0, kneeR: 0, kneeL: 0.05,
  r: at(1, 0.25, 0.62, 0.12, E_OUT), l: at(-1, -0.23, 0.62, 0.12, E_OUT), handR: 0.6, handL: 0.6,
};
const htSwivel: PoseSpec = {
  y: -0.075, bend: 11, nod: 9, hipTwist: 8, rf: [0.09, 0, 0.01], lf: [-0.09, 0, 0], pitchR: 12, pitchL: 12, kneeR: 0.5, kneeL: -0.4,
  r: at(1, 0.2, 0.52, -0.07, E_BACK), l: at(-1, -0.14, 0.54, 0.15, E_DOWN), handR: 0.6, handL: 0.6,
};

/** Side step with the jack: step out as the chest drops, touch in as it arches back up. */
const ssjStep: PoseSpec = {
  x: 0.08, y: -0.08, hips: 0.02, bend: 15, nod: 11, shR: 0.6, shL: 0.6, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.08, kneeL: 0.08,
  r: at(1, 0.22, 0.5, -0.1, E_BACK), l: at(-1, -0.22, 0.5, -0.1, E_BACK), handR: 0.4, handL: 0.4,
};
const ssjTouch: PoseSpec = {
  x: 0.16, y: -0.02, hips: 0, bend: -8, nod: -7, shR: 0.1, shL: 0.1, rf: [0.25, 0, 0], lf: [0.08, 0.015, 0.01], pitchL: 20, kneeR: 0, kneeL: 0.1,
  r: at(1, 0.17, 0.66, 0.2, E_OUT), l: at(-1, -0.17, 0.66, 0.2, E_OUT), handR: 0.4, handL: 0.4,
};

/** Rolling jack: the chest circles once every two beats, forward, over, back, over, turned a little to the diagonal. */
const rollJack = (k: number): PoseSpec => {
  const a = (k * Math.PI) / 2;
  const fwd = Math.cos(a), side = Math.sin(a);
  return {
    spin: 15, y: -0.045 - 0.025 * fwd, bend: 3 + 12 * fwd, nod: 2 + 9 * fwd, chestX: 0.065 * side, lean: 6 * side, hips: -0.02 * side, head: -3 * side,
    shR: 0.4 + 0.3 * side, shL: 0.4 - 0.3 * side, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.04 + 0.04 * fwd, kneeL: 0.04 + 0.04 * fwd,
    r: at(1, 0.2 + 0.05 * side, 0.58 - 0.04 * fwd, 0.06 - 0.12 * fwd, E_OUT), l: at(-1, -0.2 + 0.05 * side, 0.58 - 0.04 * fwd, 0.06 - 0.12 * fwd, E_OUT), handR: 0.5, handL: 0.5,
  };
};

// ---------------------------------------------------------------------------
// Bass music

/** Phonk drift: hands on a wheel in front of the chest, cranked over toward the side you step to. */
const steer = (deg: number): PoseSpec => {
  const a = (deg * Math.PI) / 180;
  const R = 0.12, cy = 0.72, cz = 0.24;
  const hr = Math.PI / 6 - a, hl = Math.PI - Math.PI / 6 - a;
  return {
    r: at(1, R * Math.cos(hr), cy + R * Math.sin(hr), cz, [1, -0.6, -0.2]),
    l: at(-1, R * Math.cos(hl), cy + R * Math.sin(hl), cz, [1, -0.6, -0.2]),
    ...FIST,
  };
};

/** DnB skank, gentle: running on the spot on the balls of the feet, hunched, the fists pumping high in front. */
const dnbA: PoseSpec = {
  y: -0.05, x: 0.015, hips: 0.02, tilt: 3, bend: 12, nod: 10, shR: 0.6, shL: 0.6,
  rf: [0.08, 0, 0], lf: [-0.08, 0.05, 0.03], kneeL: 0.12, pitchR: 15,
  r: at(1, 0.06, 0.82, 0.25, E_DOWN), l: at(-1, -0.2, 0.68, -0.02, E_BACK), ...FIST,
};
const dnbMid: PoseSpec = {
  y: -0.025, x: 0, hips: 0, tilt: 0, bend: 9, nod: 3, shR: 0.4, shL: 0.4,
  rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeL: 0, pitchR: 15, pitchL: 15,
  r: at(1, 0.14, 0.76, 0.14, E_DOWN), l: at(-1, -0.14, 0.76, 0.14, E_DOWN), ...FIST,
};

/** Wobble arms: forearms out in front pumping up and down with the wobble, on a step-touch. */
const wobArms = (up: boolean): PoseSpec => ({
  shR: up ? 0.6 : 0.1, shL: up ? 0.6 : 0.1, nod: up ? -3 : 7,
  r: at(1, 0.15, up ? 0.86 : 0.66, 0.25, E_DOWN), l: at(-1, -0.15, up ? 0.86 : 0.66, 0.25, E_DOWN), handR: 0.3, handL: 0.3,
});

/** The dubstep clam: the body folds shut on the hit (knees, chest, forearms together) and opens wide. */
const clamShut: PoseSpec = {
  y: -0.07, bend: 15, nod: 13, shR: 0.8, shL: 0.8, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: -0.15, kneeL: -0.15,
  r: at(1, 0.04, 0.76, 0.24, [0.4, -1, 0]), l: at(-1, -0.04, 0.76, 0.24, [0.4, -1, 0]), ...FIST,
};
const clamOpen: PoseSpec = {
  y: -0.02, bend: -6, nod: -9, shR: 0, shL: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.36, 0.9, 0.02, E_UP), l: at(-1, -0.36, 0.9, 0.02, E_UP), ...OPEN,
};

// ---------------------------------------------------------------------------
// EDM

/** Clapping above the head through the build, bouncing on the knees. */
const clapTop: PoseSpec = {
  y: -0.065, nod: -9, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.05, kneeL: 0.05,
  r: at(1, 0.015, 1.13, 0.1, [1, 0.4, 0]), l: at(-1, -0.015, 1.13, 0.1, [1, 0.4, 0]), ...OPEN,
};
const clapApart: PoseSpec = {
  y: -0.02, nod: -4, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0, kneeL: 0,
  r: at(1, 0.2, 1.06, 0.1, [1, 0.4, 0]), l: at(-1, -0.2, 1.06, 0.1, [1, 0.4, 0]), ...OPEN,
};

// ---------------------------------------------------------------------------
// Metal

/** Horns raised high, swaying slowly over to one side. */
const hornSway: PoseSpec = {
  x: 0.045, hips: 0.04, tilt: 4, lean: 8, head: 6, nod: 6, y: -0.05,
  rf: [0.14, 0, 0], lf: [-0.14, 0.012, 0], kneeR: 0.06,
  r: at(1, 0.3, 1.06, 0.06, E_UP), l: at(-1, 0.02, 0.74, 0.18, E_DOWN), handR: 0, handL: 0, formR: 'horns',
};
/** Passing through the middle: the horns straight up over the head. */
const hornMid: PoseSpec = {
  x: 0, hips: 0, tilt: 0, lean: 0, head: 0, nod: -4, y: -0.03,
  rf: [0.14, 0, 0], lf: [-0.14, 0, 0], kneeR: 0.02, kneeL: 0.02,
  r: at(1, 0.14, 1.1, 0.1, E_UP), l: at(-1, 0.02, 0.74, 0.18, E_DOWN), handR: 0, handL: 0, formR: 'horns',
};

/** Fist banging: one fist thrust up and forward at the stage on every beat with a nod of the chest. */
const fbBang: PoseSpec = {
  y: -0.07, bend: 8, nod: 13, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.15, 1.02, 0.28, [1, -0.4, 0]), l: at(-1, -0.12, 0.62, 0.16, E_DOWN), ...FIST,
};
const fbPull: PoseSpec = {
  y: -0.03, bend: 1, nod: -3, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.01, kneeL: 0.01,
  r: at(1, 0.2, 0.84, 0.08, E_DOWN), l: at(-1, -0.12, 0.62, 0.16, E_DOWN), ...FIST,
};

/** Step-touch with the horns: the hand on the stepping side pumps the horns up high. */
const hsStep: PoseSpec = {
  x: 0.08, y: -0.07, hips: 0.02, nod: 9, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.07, kneeL: 0.05,
  r: [160, 22, 166, 22], l: at(-1, -0.1, 0.68, 0.17, E_DOWN), ...HORNS,
};
const hsTouch: PoseSpec = {
  x: 0.16, y: -0.025, hips: 0, nod: -3, rf: [0.25, 0, 0], lf: [0.08, 0.015, 0.01], pitchL: 20, kneeR: 0, kneeL: 0.1,
  r: at(1, 0.22, 0.92, 0.1, E_UP), l: at(-1, -0.1, 0.68, 0.17, E_DOWN), ...HORNS,
};

/** Breakdown nod: one slow heavy headbang every two beats, then a slow rise. */
const bnDown: PoseSpec = {
  y: -0.065, bend: 24, nod: 22, shR: 1.0, shL: 0.9, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.24, 0.44, 0.12, [1, 0, -0.3]), l: at(-1, -0.24, 0.44, 0.12, [1, 0, -0.3]), ...FIST,
};
const bnUp: PoseSpec = {
  y: -0.02, bend: -3, nod: -8, shR: 0.1, shL: 0.1, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: 0, kneeL: 0,
  r: at(1, 0.22, 0.5, 0.06, [1, 0, -0.3]), l: at(-1, -0.22, 0.5, 0.06, [1, 0, -0.3]), ...FIST,
};

// ---------------------------------------------------------------------------
// Punk

/** Ska stroll: march on the spot swaying over to one side, the bent arms swinging across with the sway. */
const stroll = (lift: 1 | -1, side: 1 | -1, deep: boolean): PoseSpec => ({
  x: 0.03 * side, hips: 0.03 * side, tilt: 3 * side, lean: 5 * side, head: 3 * side, y: deep ? -0.06 : -0.03,
  rf: [0.09, lift > 0 ? 0.06 : 0, lift > 0 ? 0.02 : 0], lf: [-0.09, lift < 0 ? 0.06 : 0, lift < 0 ? 0.02 : 0],
  kneeR: lift > 0 ? 0.1 : 0.04, kneeL: lift < 0 ? 0.1 : 0.04,
  r: at(1, 0.12 + 0.1 * side, 0.72, 0.18, E_DOWN), l: at(-1, -0.12 + 0.1 * side, 0.72, 0.18, E_DOWN), ...FIST,
});

/** Skank punches: from foot to foot on the balls of the feet, bent-elbow fist punches left and right. */
const punchA: PoseSpec = {
  y: -0.055, x: 0.02, hips: 0.025, tilt: 3, twist: -10, nod: 7, bend: 5,
  rf: [0.09, 0, 0], lf: [-0.09, 0.04, 0.01], kneeL: 0.12, pitchR: 18,
  r: at(1, -0.02, 0.74, 0.27, [0.5, -1, 0]), l: at(-1, -0.18, 0.74, 0.04, E_DOWN), ...FIST,
};
const punchMid: PoseSpec = {
  y: -0.025, x: 0, hips: 0, tilt: 0, twist: 0, nod: 0, bend: 3,
  rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeL: 0, pitchR: 18, pitchL: 18,
  r: at(1, 0.16, 0.76, 0.12, E_DOWN), l: at(-1, -0.16, 0.76, 0.12, E_DOWN), ...FIST,
};

/** Grounded hardcore two-step: the free foot kicks out low to the side as both arms swing across the other way. */
const tsKick: PoseSpec = {
  y: -0.05, x: -0.02, hips: -0.03, tilt: -3, twist: -12, lean: -4, nod: 5,
  rf: [0.25, 0.06, 0.02], lf: [-0.08, 0, 0], kneeR: 0.05, kneeL: 0.08,
  r: at(1, -0.08, 0.66, 0.22, E_DOWN), l: at(-1, -0.34, 0.64, 0.02, E_OUT), ...FIST,
};
const tsTogether: PoseSpec = {
  y: -0.065, x: 0, hips: 0, tilt: 0, twist: 0, lean: 0, nod: 2,
  rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.18, 0.62, 0.14, E_DOWN), l: at(-1, -0.18, 0.62, 0.14, E_DOWN), ...FIST,
};

// ---------------------------------------------------------------------------
// Drill

/** Below the knee: one knee drops in (heel up) with the arms swinging down loose toward it. */
const btkDrop: PoseSpec = {
  y: -0.075, x: 0.02, bend: 17, nod: 10, lean: 6, head: 4, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: -0.6, kneeL: 0.05, pitchR: 30,
  r: at(1, 0.24, 0.42, 0.16, E_OUT), l: at(-1, 0.1, 0.44, 0.24, E_DOWN), handR: 0.5, handL: 0.5,
};
const btkUp: PoseSpec = {
  y: -0.025, x: 0, bend: 6, nod: 0, lean: 0, head: 0, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: 0, kneeL: 0, pitchR: 0, pitchL: 0,
  r: at(1, 0.1, 0.66, 0.2, E_DOWN), l: at(-1, -0.1, 0.66, 0.2, E_DOWN), handR: 0.5, handL: 0.5,
};

/** The "woo" pose: one fist up by the head, the other hand at the belt, bouncing and nodding. */
const wooDown: PoseSpec = {
  y: -0.065, nod: 10, head: -4, lean: -2, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.17, 1.02, 0.08, E_UP), l: at(-1, -0.04, 0.52, 0.17, E_DOWN), handR: 0, handL: 0.6,
};
const wooUp: PoseSpec = {
  y: -0.02, nod: -3, head: -2, lean: -1, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0, kneeL: 0,
  r: at(1, 0.2, 0.95, 0.1, E_UP), l: at(-1, -0.04, 0.53, 0.17, E_DOWN), handR: 0, handL: 0.6,
};

/** Drill sway: a soft weight drop onto one foot, both loose arms swinging low over to that side. */
const dsA: PoseSpec = {
  y: -0.06, x: 0.035, hips: 0.03, tilt: 3, lean: 3, nod: 5, head: -3,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.07, kneeL: 0.02, pitchL: 14,
  r: at(1, 0.3, 0.5, 0.06, E_OUT), l: at(-1, 0.06, 0.5, 0.2, E_DOWN), handR: 0.4, handL: 0.4,
};
const dsMid: PoseSpec = {
  y: -0.03, x: 0, hips: 0, tilt: 0, lean: 0, nod: 0, head: 0,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.03, kneeL: 0.03, pitchL: 0, pitchR: 0,
  r: at(1, 0.16, 0.54, 0.16, E_DOWN), l: at(-1, -0.16, 0.54, 0.16, E_DOWN), handR: 0.4, handL: 0.4,
};

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  // --- House --------------------------------------------------------------------
  full({
    id: 'side-jack', name: 'Side Jack', tags: 'disco hiphop | full |', beats: 2, level: 'low', d: 1, parts: ['torso', 'legs'],
    desc: 'The house jack from side to side: on every beat slide the rib cage over to one side as the knees give, that shoulder lifting and the loose arms swinging with it, back through the middle on the "and", then to the other side.',
    keys: [[0, sjA], [0.5, sjMid], [1, mir(sjA)], [1.5, sjMid]],
  }),
  full({
    id: 'house-heel-toe', name: 'House Heel-Toe', tags: 'disco hiphop | legs |', beats: 2, level: 'low', d: 1, parts: ['legs'],
    desc: 'Dig one heel in front, toes up, then bring it back and swivel both feet toward that side as the chest jacks down; dig the other heel and swivel the other way.',
    keys: [[0, htHeel], [0.5, htSwivel], [1, mir(htHeel)], [1.5, mir(htSwivel)]],
  }),
  full({
    id: 'jack-step-touch', name: 'Jack Step-Touch', tags: 'disco hiphop | legs full | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], mirror: true, travel: 0.16,
    desc: 'A side step-touch on the house jack: step out as the chest drops forward and the arms swing back, touch the other foot in as the chest arches up and the arms swing forward; then back the other way.',
    keys: [[0, ssjStep], [1, ssjTouch]],
  }),

  full({
    id: 'rolling-jack', name: 'Rolling Jack', tags: 'disco hiphop | full |', beats: 2, level: 'low', d: 1, parts: ['torso'],
    desc: 'The jack in a circle: roll the chest forward and down, over to one side, up and back, over to the other side, one circle every two beats, the knees giving with the forward drop and the loose arms following.',
    keys: [0, 1, 2, 3].map((k) => [k / 2, rollJack(k)] as [number, PoseSpec]),
  }),

  // --- Bass music ---------------------------------------------------------------
  full({
    id: 'drift-steer', name: 'Drift Steer', tags: 'hiphop party | arms legs | walk', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, travel: 0.16,
    desc: 'Phonk drift on a step-touch: both hands on an imaginary wheel, crank it hard over toward the side you step to, leaning and looking into the turn, then bring it back as the other foot touches in.',
    keys: [
      [0, { x: 0.08, y: -0.07, hips: 0.02, lean: 9, head: 7, turn: 14, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.08, ...steer(80) }],
      [1, { x: 0.16, y: -0.03, hips: 0, lean: 0, head: 0, turn: 0, rf: [0.25, 0, 0], lf: [0.08, 0.015, 0.01], pitchL: 20, kneeL: 0.1, ...steer(0) }],
    ],
  }),
  full({
    id: 'dnb-skank', name: 'DnB Skank', tags: 'hiphop | legs |', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'The drum & bass skank kept small: hunched over, run lightly on the spot on the balls of the feet, one step a beat, the fists pumping high in front of the chest in turn.',
    keys: [[0, dnbA], [0.5, dnbMid], [1, mir(dnbA)], [1.5, dnbMid]],
  }),
  full({
    id: 'wobble-arms', name: 'Wobble Arms', tags: 'hiphop | arms | walk', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, travel: 0.16,
    desc: 'Step-touch from side to side while both forearms, held out in front, pump up and down with the wobble bass on every half beat, the shoulders shrugging with them.',
    keys: [
      [0, { x: 0.08, y: -0.06, hips: 0.02, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.06, ...wobArms(false) }],
      [0.5, { x: 0.12, y: -0.035, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.02, ...wobArms(true) }],
      [1, { x: 0.16, y: -0.06, hips: 0, rf: [0.25, 0, 0], lf: [0.08, 0.015, 0.01], pitchL: 20, kneeL: 0.1, ...wobArms(false) }],
      [1.5, { x: 0.16, y: -0.035, rf: [0.25, 0, 0], lf: [0.08, 0.015, 0.01], pitchL: 20, kneeL: 0.05, ...wobArms(true) }],
    ],
  }),
  full({
    id: 'clam-shell', name: 'Clam Shell', tags: 'hiphop funk | full |', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'],
    desc: 'Dubstep basic: on the hit fold shut like a clam, knees in, chest curling down and the forearms snapping together in front of it, then open up wide with the chest lifting and the open hands out by the shoulders.',
    keys: [[0, clamShut], [1, clamOpen]],
  }),

  // --- EDM ----------------------------------------------------------------------
  full({
    id: 'build-up-clap', name: 'Build-Up Clap', tags: 'aerobic pop | arms | clap hands', beats: 1, level: 'low', d: 1, parts: ['arms'],
    desc: 'Through the build, clap the hands together high above the head on every beat with the face up, bouncing on the knees, opening the hands a little in between.',
    keys: [[0, clapTop], [0.5, clapApart]],
  }),

  // --- Metal --------------------------------------------------------------------
  full({
    id: 'horns-sway', name: 'Horns Sway', tags: 'rock | arms hips |', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips', 'torso'], mirror: true,
    desc: 'One hand raised high in the horns and the other fist on the chest, sway the whole body slowly over to one side and then the other, the raised arm swinging over the head like a pendulum, the head nodding heavily on each sway; then switch hands.',
    keys: [[0, hornSway], [1, hornMid], [2, { ...hornSway, x: -0.045, hips: -0.04, tilt: -4, lean: -8, head: -6, rf: [0.14, 0.012, 0], lf: [-0.14, 0, 0], kneeR: 0, kneeL: 0.06, r: at(1, 0.0, 1.06, 0.14, [1, 0.3, 0.3]) }], [3, hornMid]],
  }),
  full({
    id: 'fist-bang', name: 'Fist Bang', tags: 'rock | arms | punch', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Wide stance: bang one fist up and forward at the stage on every beat as the chest and head nod down with it, pulling it back to the shoulder in between, the other fist low; switch fists.',
    keys: [[0, fbBang], [0.5, fbPull], [1, fbBang], [1.5, fbPull]],
  }),
  full({
    id: 'horns-step', name: 'Horns Step', tags: 'rock | arms legs | walk', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, travel: 0.16,
    desc: 'Step-touch from side to side, throwing the horns up high on the side you step to with a nod, pulling them in to the shoulder on the touch, the other fist at the belly.',
    keys: [[0, hsStep], [1, hsTouch]],
  }),
  full({
    id: 'breakdown-nod', name: 'Breakdown Nod', tags: 'rock | full |', beats: 2, level: 'low', d: 1, parts: ['torso'],
    desc: 'The half-time headbang of a breakdown: one slow, heavy nod of the head and chest every two beats with the shoulders hunching and the fists hanging, then a slow rise.',
    keys: [[0, bnDown], [1, bnUp]],
  }),

  // --- Punk ---------------------------------------------------------------------
  full({
    id: 'ska-stroll', name: 'Ska Stroll', tags: 'rock | full | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms', 'hips'],
    desc: 'March on the spot, one step a beat, swaying over to one side for two steps and then the other, the bent arms swinging across with the sway.',
    keys: [[0, stroll(-1, 1, true)], [1, stroll(1, 1, false)], [2, stroll(1, -1, true)], [3, stroll(-1, -1, false)]],
  }),
  full({
    id: 'skank-punches', name: 'Skank Punches', tags: 'rock | arms legs | punch', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'The ska skank brought down to the spot: step from foot to foot on the balls of the feet, throwing a short bent-elbow punch across the body with one fist and then the other.',
    keys: [[0, punchA], [0.5, punchMid], [1, mir(punchA)], [1.5, punchMid]],
  }),
  full({
    id: 'grounded-two-step', name: 'Grounded Two-Step', tags: 'rock | legs arms | kick', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'The hardcore two-step without the hop: kick one foot out low to the side as both arms swing across the other way, bring it back in, then kick the other foot.',
    keys: [[0, tsKick], [0.5, tsTogether], [1, mir(tsKick)], [1.5, tsTogether]],
  }),

  // --- Drill --------------------------------------------------------------------
  full({
    id: 'below-the-knee', name: 'Below the Knee', tags: 'hiphop | legs | ', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'UK drill: drop one knee in with its heel up as both loose arms swing down toward it, come back up through the middle, then drop the other knee.',
    keys: [[0, btkDrop], [0.5, btkUp], [1, mir(btkDrop)], [1.5, btkUp]],
  }),
  full({
    id: 'woo-bounce', name: 'Woo Bounce', tags: 'hiphop | arms |', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Bounce on the knees and nod on every beat holding the "woo": one fist up by the head and the other hand at the belt buckle; switch hands.',
    keys: [[0, wooDown], [0.5, wooUp], [1, wooDown], [1.5, wooUp]],
  }),
  full({
    id: 'drill-sway', name: 'Drill Sway', tags: 'hiphop | full |', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'The drill bounce kept soft: on every beat let the weight drop onto one foot, the other heel lifting, as both loose arms swing low over to that side, then the other side.',
    keys: [[0, dsA], [0.5, dsMid], [1, mir(dsA)], [1.5, dsMid]],
  }),
];
