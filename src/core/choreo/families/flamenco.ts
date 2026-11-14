/**
 * More flamenco: the `flamenco` set (ids in
 * ../genreSets/variety.ts; the flamenco arms, palmas, turn and the paso
 * doble cape are in families/latin.ts).
 *
 *   braceo     the arms passing from position to position in semicircles,
 *              one sweeping down and out from overhead as the other rises
 *              through the centre, over a slow marking step;
 *   marcaje    marking the compás side to side, the free foot touching
 *              behind on its ball, hands on the hips (en jarra);
 *   llamada    the call: a run of stamps into a held pose, arms rounded
 *              overhead, that signals a new section.
 *
 * Cut after the render: golpe & tacón footwork (stamps and heel strikes in
 * place barely move on the figure; the regional Mexican zapateado, with its
 * knee lifts, is the version that reads) and the paso doble appel and sur
 * place (on the figure it was a march on the spot).
 *
 * Sources: flamencomalaga.com "What is flamenco braceo", Wikipedia "Glossary
 * of flamenco terms", spain-traveller.com flamenco glossary, Studio Flamenco
 * terms, NY City Center flamenco study guide (llamada, remate). Tempos: rumba flamenca and
 * flamenco pop 100-130, bulerías and alegrías counted in 12 (danced here
 * on the beat), paso doble ~120. All are hand-authored full-body moves.
 */
import { at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_UP = [1, 0.3, -0.2] as const;
const E_OUT = [1, -0.3, -0.2] as const;

/** Hands on the hips, elbows back and wide (en jarra). */
const JARRA: PoseSpec = { r: at(1, 0.16, 0.54, 0.02, [1, 0.1, -0.3]), l: at(-1, -0.16, 0.54, 0.02, [1, 0.1, -0.3]), handR: 0.2, handL: 0.2 };
const ROUND_HIGH_R = at(1, 0.07, 1.06, 0.1, E_UP);
const ROUND_HIGH_L = at(-1, -0.07, 1.06, 0.1, E_UP);

// Braceo: the arms pass in semicircles, a quarter of the circle on each beat.
const ARM_PATH_R = [ROUND_HIGH_R, at(1, 0.38, 0.84, 0.08, E_OUT), at(1, 0.04, 0.62, 0.22, [0.6, -1, 0]), at(1, 0.04, 0.86, 0.24, E_OUT)];
const ARM_PATH_L = [at(-1, -0.04, 0.62, 0.22, [0.6, -1, 0]), at(-1, -0.04, 0.86, 0.24, E_OUT), ROUND_HIGH_L, at(-1, -0.38, 0.84, 0.08, E_OUT)];
const brace = (k: number): PoseSpec => {
  const s = k % 2 === 0 ? 1 : -1;
  return {
    x: 0.02 * s, y: -0.05, bend: -6, nod: -4, lean: -2 * s, hips: 0.03 * s, tilt: 3 * s, turn: [20, 6, -20, -6][k], head: [6, 0, -6, 0][k],
    rf: [0.1, 0, 0.02], lf: [-0.1, 0, 0], kneeR: s > 0 ? 0.04 : 0.12, kneeL: s > 0 ? 0.12 : 0.04,
    r: ARM_PATH_R[k], l: ARM_PATH_L[k], handR: 0.9, handL: 0.9,
  };
};

// Marcaje: step to the side and touch the other foot behind on its ball, hands on the hips.
const marc = (s: 1 | -1, touch: boolean): PoseSpec => ({
  x: 0.045 * s, y: touch ? -0.08 : -0.06, bend: -6, nod: -3, hips: 0.04 * s, tilt: 5 * s, lean: -3 * s, turn: -14 * s, head: 4 * s,
  rf: s > 0 ? [0.17, 0, 0] : (touch ? [-0.05, 0, -0.08] : [0.0, 0, 0]),
  lf: s > 0 ? (touch ? [0.05, 0, -0.08] : [0.0, 0, 0]) : [-0.17, 0, 0],
  pitchR: s < 0 && touch ? 35 : 0, pitchL: s > 0 && touch ? 35 : 0, kneeR: 0.08, kneeL: 0.08, ...JARRA,
});

// Llamada: stamps into a held pose: heel out in front, arms rounded overhead, body arched, head turned.
const llStamp = (s: 1 | -1, y: number): PoseSpec => ({
  y, bend: 3, nod: 4, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: s > 0 ? 0.16 : 0.07, kneeL: s < 0 ? 0.16 : 0.07,
  r: at(1, 0.24, 0.62, 0.12, E_OUT), l: at(-1, -0.24, 0.62, 0.12, E_OUT), handR: 0.6, handL: 0.6,
});
const llPose: PoseSpec = {
  y: -0.06, bend: -10, nod: -10, lean: -5, turn: 28, head: 5, rf: [0.17, 0, 0.08], lf: [-0.09, 0, 0], pitchR: -25, kneeL: 0.1,
  r: ROUND_HIGH_R, l: ROUND_HIGH_L, handR: 0.9, handL: 0.9,
};

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  full({
    id: 'flamenco-braceo', name: 'Braceo', tags: 'latin | arms | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'torso'],
    desc: 'Flamenco arms over a slow side-to-side mark, chest lifted: one arm sweeps down and out from overhead in a semicircle as the other rises through the centre of the body to round overhead, and on round, the head following the high hand.',
    keys: [[0, brace(0)], [1, brace(1)], [2, brace(2)], [3, brace(3)]],
  }),
  full({
    id: 'flamenco-marcaje', name: 'Marcaje', tags: 'latin | legs hips | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'],
    desc: 'Marking the rhythm with the hands on the hips: step to the side with the hip and touch the other foot behind on its ball, the body turning toward it, then step and touch to the other side.',
    keys: [[0, marc(1, false)], [1, marc(1, true)], [2, marc(-1, false)], [3, marc(-1, true)]],
  }),
  full({
    id: 'flamenco-llamada', name: 'Llamada', tags: 'latin | full arms | stomp', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'The call: three sharp stamps, right, left, right, then plant the heel out in front and sweep both arms up to round overhead, arching the back and turning the head, and hold the pose.',
    keys: [[0, llStamp(1, -0.11)], [0.5, llStamp(-1, -0.1)], [1, llStamp(1, -0.12)], [2, llPose], [3, { ...llPose, bend: -12, nod: -12 }]],
  }),
];
