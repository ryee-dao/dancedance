/**
 * More country (the `country` set; ids in ../genreSets/variety.ts). The set
 * already has the line-dance and hoedown basics (heel & hook, vine hitch,
 * heel strut, boot scoot, sailor step, Monterey turn, clogging, gallop and
 * lasso), and the general line-dance steps (kick ball change, jazz square,
 * heel jack, heel swivel, hip bump, hat tip) are global moves already. This
 * file adds the country steps that were missing, from line-dance step
 * definitions (estes-eastes.org "Line dance definitions"; copperknob step
 * sheets) and Cajun / zydeco club footage:
 *
 *   heel splits (the "buttermilk"), the rolling vine (a full-turn vine),
 *   slappin' leather (boot slaps in front and to the side), the zydeco
 *   rubboard scratch. (The swivet is the global Heel Swivel: written here it
 *   measured the same as heel splits; a coaster step & clap was cut, the
 *   back-and-forward coaster doesn't read from the front even on a diagonal.)
 *
 * Tempos: country 90-130 (line dances mostly 110-130), country-pop to 140,
 * Cajun / zydeco 110-150. All are hand-authored full-body moves.
 */
import { at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;

/** Thumbs hooked in the belt loops. */
const BELT: PoseSpec = { r: at(1, 0.11, 0.54, 0.11, [1, -0.2, -0.3]), l: at(-1, -0.11, 0.54, 0.11, [1, -0.2, -0.3]), handR: 0.2, handL: 0.2 };
const CLAP: PoseSpec = { r: at(1, 0.02, 0.72, 0.2, [0.5, -1, -0.2]), l: at(-1, -0.02, 0.72, 0.2, [0.5, -1, -0.2]), handR: 1, handL: 1 };

// --- Heel splits: up on the balls, feet together, heels flicked out (toes in) and back in -------------
const hsOut: PoseSpec = { y: -0.09, rf: [0.065, 0, 0], lf: [-0.065, 0, 0], kneeR: -1, kneeL: -1, pitchR: 26, pitchL: 26, nod: 4, shR: 0.4, shL: 0.4, ...BELT };
const hsIn: PoseSpec = { y: -0.03, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], kneeR: 0.1, kneeL: 0.1, pitchR: 0, pitchL: 0, nod: 0, shR: 0, shL: 0, ...BELT };

// --- Rolling vine: a full turn travelling to the side over three steps, then touch and clap -------------
const rvArms: PoseSpec = { r: at(1, 0.07, 0.7, 0.16, E_OUT), l: at(-1, -0.07, 0.7, 0.16, E_OUT), handR: 0.5, handL: 0.5 };

// --- Slappin' leather: heel dig, hook in front and slap the boot, heel to the side, flick up and slap -------------
const slHeel: PoseSpec = {
  y: -0.04, spin: 20, rf: [0.15, 0, 0.12], lf: [-0.08, 0, 0], pitchR: -25, kneeL: 0.06, ...BELT,
};
const slHookFront: PoseSpec = {
  y: -0.08, spin: 0, bend: 16, nod: 12, lean: -3,
  rf: [-0.04, 0.24, 0.1], lf: [-0.09, 0, 0], kneeR: -0.35, kneeL: 0.1,
  r: at(1, 0.22, 0.6, 0.06, E_OUT), l: at(-1, -0.04, 0.36, 0.17, E_DOWN), handR: 0.2, handL: 1,
};
const slHeelSide: PoseSpec = {
  y: -0.05, spin: 0, rf: [0.24, 0, 0.03], lf: [-0.08, 0, 0], pitchR: -25, kneeL: 0.08, ...BELT,
};
const slFlickSide: PoseSpec = {
  y: -0.08, spin: 0, bend: 6, lean: 14, head: 6,
  rf: [0.25, 0.27, -0.03], lf: [-0.08, 0, 0], kneeR: 0.5, kneeL: 0.1,
  r: at(1, 0.29, 0.38, -0.02, E_DOWN), l: at(-1, -0.28, 0.72, 0.06, E_OUT), handR: 1, handL: 0.4,
};

// --- Rubboard scratch (zydeco): step side to side with a bounce, scraping spoons down a rubboard on the chest -------------
const rbTop = (step: boolean): PoseSpec => ({
  x: 0.035, y: step ? -0.07 : -0.04, hips: 0.03, tilt: 3, lean: -2, head: 4, nod: 2,
  rf: [0.16, 0, 0], lf: [-0.06, step ? 0 : 0.03, 0.01], kneeR: 0.08, kneeL: step ? 0 : 0.12,
  r: at(1, 0.06, 0.8, 0.19, E_OUT), l: at(-1, -0.06, 0.78, 0.19, E_OUT), handR: 0.2, handL: 0.2,
});
const rbLow = (step: boolean): PoseSpec => ({
  ...rbTop(step), y: step ? -0.1 : -0.06, nod: 6,
  r: at(1, 0.07, 0.58, 0.2, E_DOWN), l: at(-1, -0.05, 0.6, 0.2, E_DOWN),
});

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  full({
    id: 'heel-splits', name: 'Heel Splits', tags: 'pop rock | legs | country', beats: 2, level: 'low', d: 1, parts: ['legs'],
    desc: 'Feet together and thumbs in the belt loops, up on the balls of the feet: flick both heels out to the sides with the knees dipping in, then bring them back together, twice.',
    keys: [[0, hsOut], [0.5, hsIn], [1, hsOut], [1.5, hsIn]],
  }),
  full({
    id: 'rubboard-scratch', name: 'Rubboard Scratch', tags: 'pop party | arms legs | country', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Zydeco style: step to one side with a bounce in the knees and tap the other foot in, both hands scraping spoons down an imaginary rubboard on the chest on every half beat; step back the other way.',
    keys: [[0, rbTop(true)], [0.5, rbLow(true)], [1, rbTop(false)], [1.5, rbLow(false)]],
  }),
  full({
    id: 'rolling-vine', name: 'Rolling Vine', tags: 'pop rock | turn legs | country spin walk clap', beats: 4, level: 'mid', d: 3, parts: ['turn', 'legs'], mirror: true, travel: 0.36,
    desc: 'A vine that turns: step to the side turning a quarter, keep turning as you step the other foot on, step to the side again facing front to finish the full turn, then touch the other foot in and clap.',
    keys: [
      [0, { x: 0.08, y: -0.05, spin: 90, rf: [0.135, 0, 0], lf: [0.025, 0, 0], pitchL: 15, ...rvArms }],
      [0.5, { x: 0.13, y: -0.02, spin: 180, rf: [0.185, 0.03, 0.02], lf: [0.075, 0, 0], ...rvArms }],
      [1, { x: 0.19, y: -0.05, spin: 270, rf: [0.245, 0, 0], lf: [0.135, 0, 0], pitchR: 15, ...rvArms }],
      [2, { x: 0.3, y: -0.06, spin: 0, rf: [0.4, 0, 0], lf: [0.22, 0, 0], kneeR: 0.06, r: at(1, 0.34, 0.6, 0.08, E_OUT), l: at(-1, -0.26, 0.6, 0.08, E_OUT), handR: 1, handL: 1 }],
      [3, { x: 0.35, y: -0.07, spin: 0, lean: 3, rf: [0.4, 0, 0], lf: [0.3, 0.012, 0.01], kneeR: 0.08, kneeL: 0.08, ...CLAP }],
    ],
  }),
  // "Slappin' leather" (boot slaps).
  full({
    id: 'slap-leather', name: "Slappin' Leather", tags: 'rock party | legs arms | country kick', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Dig one heel forward on the diagonal, hook that foot up across in front of the other shin and slap the boot with the opposite hand, dig the heel out to the side, then flick it up behind to the side and slap it with the same hand.',
    keys: [[0, slHeel], [1, slHookFront], [2, slHeelSide], [3, slFlickSide]],
  }),
];
