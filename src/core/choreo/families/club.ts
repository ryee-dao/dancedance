/**
 * More club footwork (ids in ../genreSets/variety.ts):
 *
 *   house     the farmer (knee up, step down across, step out, on the jack).
 *             The skate is already a global move (hiphop.ts House Skate);
 *             the train is left out: it travels toward and away from the
 *             viewer and doesn't read from the front. House 118-128 BPM.
 *   amapiano  the Tshwala Bam groove: bouncing on the balls of the feet,
 *             stepping left-right-left, the shoulders rolling loose from
 *             side to side with a wrist twist on each step (108-116 BPM).
 *
 * Sources: house foundation tutorials ("House Dance Tutorial - Farmer",
 * "- Skate", "- Train", studied with tools/moves/reference.ts), STEEZY
 * "What is house dance" (the foundation list), The Moveee "How to do the
 * Tshwala Bam dance". All are hand-authored full-body moves.
 */
import { at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;

/** Loose bent arms in front of the waist, swinging with the jack. */
const LOOSE = (k: number): PoseSpec => ({ r: at(1, 0.19 + k, 0.62, 0.17, E_OUT), l: at(-1, -0.19 + k, 0.62, 0.17, E_OUT), handR: 0.5, handL: 0.5 });

// --- Farmer: knee up on the jack back, step it down across, step the other out, back in -------------
const fKnee: PoseSpec = {
  y: -0.02, bend: -6, nod: -4, rf: [0.08, 0.22, 0.08], lf: [-0.08, 0, 0], kneeR: 0.15, kneeL: 0.06, pitchR: -8, ...LOOSE(0.02),
};
const fCross: PoseSpec = {
  y: -0.1, bend: 10, nod: 8, twist: -8, rf: [-0.01, 0, 0.07], lf: [-0.09, 0, -0.01], kneeR: 0.12, kneeL: 0.12, pitchR: 0, ...LOOSE(-0.03),
};
const fOut: PoseSpec = {
  y: -0.08, x: -0.03, bend: 4, nod: 2, twist: 6, hips: -0.02, rf: [-0.01, 0, 0.07], lf: [-0.22, 0, 0], kneeL: 0.12, kneeR: 0.08, ...LOOSE(-0.05),
};
const fBack: PoseSpec = {
  y: -0.05, x: 0, bend: -2, nod: -2, twist: 0, hips: 0, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.05, kneeL: 0.05, pitchL: -8, ...LOOSE(0),
};

// --- Tshwala Bam groove: bounce on the balls stepping left-right-left, shoulders rolling, wrists twisting -------------
const tb = (s: 1 | -1, step: boolean): PoseSpec => ({
  y: step ? -0.08 : -0.04, x: 0.02 * s, hips: 0.02 * s, tilt: 2 * s, chestX: 0.025 * s, twist: 8 * s, head: 4 * s, nod: step ? 4 : 0,
  shR: s > 0 ? 1.1 : 0.2, shL: s > 0 ? 0.2 : 1.1,
  rf: [0.1, s > 0 || step ? 0 : 0.02, 0.01], lf: [-0.1, s < 0 || step ? 0 : 0.02, 0.01], pitchR: 18, pitchL: 18, kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.2 + 0.03 * s, s > 0 ? 0.58 : 0.64, 0.14, E_DOWN), l: at(-1, -0.2 + 0.03 * s, s < 0 ? 0.58 : 0.64, 0.14, E_DOWN),
  handR: s > 0 ? 1 : 0.3, handL: s < 0 ? 1 : 0.3,
});

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  full({
    id: 'house-farmer', name: 'House Farmer', tags: 'disco aerobic | legs | stomp', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true,
    desc: 'On the house jack: pull one knee up as the chest jacks back, step it down across in front as the chest jacks forward, step the other foot out to the side, then bring it back in; switch knees.',
    keys: [[0, fKnee], [0.5, fCross], [1, fOut], [1.5, fBack]],
  }),
  // Named after the 2024 hit "Tshwala Bam": descriptive name.
  full({
    id: 'tshwala-groove', name: 'Shoulder-Roll Amapiano Groove', tags: 'hiphop latin | full | shake amapiano', beats: 2, level: 'low', d: 1, parts: ['torso', 'legs'],
    desc: 'Bounce on the balls of the feet stepping left, right, left with the log drum, the shoulders rolling loose from side to side and the hands twisting at the wrist on each step, relaxed and low.',
    keys: [[0, tb(1, true)], [0.5, tb(1, false)], [1, tb(-1, true)], [1.5, tb(-1, false)]],
  }),
];
