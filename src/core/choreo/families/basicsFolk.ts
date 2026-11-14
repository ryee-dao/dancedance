/**
 * Simple basics for Easy (difficulty 1, low impact, no hops, feet under the
 * body) for the sets folk, bellydance, dangdut and schlager; ids in
 * ../genreSets/basics.ts. Each is a different dance's own beginner basic, the
 * way it is taught before the hops and the speed come in; all are
 * hand-authored full-body moves (no shared layer patterns).
 *
 *   folk        Walking Hora (the hora's side-behind-side and low lift in the
 *               W hold, the hop replaced by a rise; the hopped one is
 *               hora-step), Walking Polka (step-close-step and hold, the polka
 *               before its hop), An Dro (Breton: little fingers linked, the
 *               arms looping forward-out then in-down over step-close-step and
 *               two steps in place), Morris Walking Step (walking on the spot
 *               with the handkerchiefs swung down and up; the stepping of
 *               morris-step without the hop), Dabke Cross Walk (the dabke
 *               cross-over, cross-side-cross, with a small lift for the stamp),
 *               Pandanggo Sway Balance (Philippine pandanggo sa ilaw: sway
 *               balance with a point, the oil lamps on the backs of the hands,
 *               the arms in lateral position).
 *   bellydance  Shoulder Shimmy (with a slow lean), Chest Slides (arms in a
 *               crown), Snake Arms Sway (slow alternating snake arms over a
 *               weight shift). The hip twist, hip lifts / slides and the
 *               Egyptian walk already exist.
 *   dangdut     The koplo crowd's joget: the Helicopter Hand (one hand up,
 *               the wrist circling), the Tug-of-War (reach, haul the rope to
 *               the hip) and the Koplo Arm Swing (loose hands swinging across
 *               and back as the weight rocks).
 *   schlager    Polonaise March (the Karneval / party conga line, hands on the
 *               shoulders in front) and the Clap-Along Sway (Mitklatschen).
 *               Overhead clap sways and hands-up sways already exist as global
 *               moves.
 *
 * Sources: Wikipedia "Hora (dance)", "An dro", "Joget", "Polonaise" (German
 * Polonäse); Lyrids Folk Dance Festival notes "Tricot" (an dro arm loops);
 * godsballroom.com "How to dance the dabke" and folkdancefootnotes.org
 * "Dabke" (the cross-over basic); Cecil Sharp "The Morris Book" (Project
 * Gutenberg 12926) and Derek Dommett "Basics for everyone" (great-western.org.uk,
 * beginners start by walking); salsavida.com "Pandanggo sa Ilaw" and Philippine
 * PE folk-dance notes (sway balance with a point, lateral arm position);
 * Mojok.co "Jenis-jenis penonton dangdut koplo dari gaya joget dan goyangnya"
 * (the helicopter and tug-of-war joget) and the Temon Holic koplo tutorial
 * (YouTube tU7B7D1VkjI); dutchreview.com "Dance the Polonaise at parties" and
 * smartergerman.com "Polonäse Blankenese"; belly-dance beginner technique
 * (shoulder shimmy, chest slides, snake arms) as in the existing set
 * (families/world.ts, world2.ts).
 */
import { ARM, at, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

// --- Folk ------------------------------------------------------------------------------
// Hora W hold: hands joined with the neighbours, raised to about head height, elbows bent down.
const wHold = (y: number): PoseSpec => ({ r: at(1, 0.31, y, 0.06, [1, -0.6, -0.2]), l: at(-1, -0.31, y, 0.06, [1, -0.6, -0.2]), handR: 1, handL: 1 });
const HIPS: PoseSpec = { r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 };
// An dro: little fingers linked with the neighbours, the arms looping forward and out, then in and down.
const anDro = (k: 0 | 1 | 2 | 3 | 4): PoseSpec => {
  const P = [[0.2, 0.5, 0.12], [0.22, 0.66, 0.24], [0.3, 0.8, 0.16], [0.24, 0.6, 0.04], [0.2, 0.47, -0.05]][k];
  const e = k === 2 ? E_OUT : E_DOWN;
  return { r: at(1, P[0], P[1], P[2], e), l: at(-1, -P[0], P[1], P[2], e), handR: 0.4, handL: 0.4 };
};
// Morris: both handkerchiefs swung up in front to shoulder height, then down by the hips.
const HANKY_UP: PoseSpec = { r: at(1, 0.2, 0.88, 0.25, [1, -0.6, -0.2]), l: at(-1, -0.2, 0.88, 0.25, [1, -0.6, -0.2]), handR: 1, handL: 1 };
const HANKY_DN: PoseSpec = { r: at(1, 0.17, 0.46, 0.05, E_DOWN), l: at(-1, -0.17, 0.46, 0.05, E_DOWN), handR: 1, handL: 1 };
// Dabke: hands linked low with the line, the shoulders dropping on the steps.
const dabArms = (sh: number): PoseSpec => ({ r: at(1, 0.21, 0.5, 0.06, E_DOWN), l: at(-1, -0.21, 0.5, 0.06, E_DOWN), handR: 0.3, handL: 0.3, shR: sh, shL: sh });
// Pandanggo sa ilaw: lamps on the backs of the hands, both arms carried to one side (lateral position), or open.
const lamps = (s: 1 | 0 | -1, y: number): PoseSpec => (s === 0
  ? { r: at(1, 0.36, y, 0.1, E_OUT), l: at(-1, -0.36, y, 0.1, E_OUT), handR: 1, handL: 1 }
  : s > 0
    ? { r: at(1, 0.4, y, 0.1, E_OUT), l: at(-1, 0.08, y - 0.02, 0.24, E_OUT), handR: 1, handL: 1 }
    : { r: at(1, -0.08, y - 0.02, 0.24, E_OUT), l: at(-1, -0.4, y, 0.1, E_OUT), handR: 1, handL: 1 });

const folk: MoveDef[] = [
  full({
    id: 'hora-walk', name: 'Walking Hora', tags: 'party pop | legs arms | folk walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true, travel: 0.18,
    desc: 'Hands joined high in a W as in the circle: step to the side, cross the other foot behind, step to the side again, then lift the free foot low across in front, rising on the standing foot instead of hopping.',
    keys: [
      [0, { x: 0.05, y: -0.05, hips: 0.02, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], ...wHold(0.92) }],
      [1, { x: 0.09, y: -0.06, rf: [0.2, 0, 0], lf: [0.12, 0, -0.07], kneeL: 0.1, ...wHold(0.92) }],
      [2, { x: 0.15, y: -0.05, hips: 0.02, rf: [0.29, 0, 0], lf: [0.12, 0, -0.07], ...wHold(0.92) }],
      [3, { x: 0.17, y: -0.02, lean: 3, head: 4, rf: [0.27, 0, 0], lf: [0.19, 0.08, 0.1], kneeL: 0.1, pitchR: 12, ...wHold(0.99) }],
    ],
  }),
  full({
    id: 'polka-walk', name: 'Walking Polka', tags: 'party pop | legs | folk walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], mirror: true, travel: 0.16,
    desc: 'The polka before the hop: fists on the hips, step to the side, close the other foot, step again leading with the shoulder, then hold with the free heel lifted; then polka back the other way.',
    keys: [
      [0, { x: 0.05, y: -0.05, twist: 7, lean: -2, rf: [0.18, 0, 0], lf: [-0.09, 0, 0], ...HIPS }],
      [0.5, { x: 0.09, y: -0.025, twist: 4, rf: [0.18, 0, 0], lf: [0.06, 0, 0], ...HIPS }],
      [1, { x: 0.14, y: -0.05, twist: 7, rf: [0.26, 0, 0], lf: [0.06, 0, 0], ...HIPS }],
      [1.5, { x: 0.15, y: -0.03, twist: 0, lean: 3, head: 6, rf: [0.26, 0, 0], lf: [0.12, 0.02, 0.02], pitchL: 15, ...HIPS }],
    ],
  }),
  full({
    id: 'an-dro', name: 'An Dro', tags: 'party pop | arms legs | folk walk', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, travel: 0.12,
    desc: 'The Breton line dance: little fingers linked low with the neighbours, step-close-step to the side as the arms loop forward and up, then step back and in place as they loop in and down.',
    keys: [
      [0, { x: 0.04, y: -0.05, rf: [0.17, 0, 0.03], lf: [-0.09, 0, 0], ...anDro(0) }],
      [0.5, { x: 0.07, y: -0.03, rf: [0.17, 0, 0.03], lf: [0.05, 0, 0.01], ...anDro(1) }],
      [1, { x: 0.11, y: -0.05, rf: [0.24, 0, 0.04], lf: [0.05, 0, 0.01], ...anDro(2) }],
      [2, { x: 0.09, y: -0.04, rf: [0.24, 0, 0.04], lf: [0.03, 0, -0.05], ...anDro(3) }],
      [3, { x: 0.12, y: -0.05, rf: [0.25, 0, 0], lf: [0.03, 0, -0.05], ...anDro(4) }],
    ],
  }),
  full({
    id: 'morris-walk', name: 'Morris Walking Step', tags: 'party pop | arms legs | folk walk wave', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Upright and light, walk on the spot, swinging both handkerchiefs up in front to shoulder height on each step and down past the hips in between.',
    keys: [
      [0, { y: -0.03, rf: [0.09, 0, 0], lf: [-0.09, 0.05, 0.04], kneeL: 0.08, nod: -3, ...HANKY_UP }],
      [0.5, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0, 0.02], ...HANKY_DN }],
      [1, { y: -0.03, rf: [0.09, 0.05, 0.04], lf: [-0.09, 0, 0.02], kneeR: 0.08, nod: -3, ...HANKY_UP }],
      [1.5, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...HANKY_DN }],
    ],
  }),
  full({
    id: 'dabke-walk', name: 'Dabke Cross Walk', tags: 'party | legs | folk walk', beats: 4, level: 'low', d: 1, parts: ['legs'], mirror: true, travel: 0.2,
    desc: 'Hands linked low with the line: cross one foot over in front, step the other to the side, cross over again, then lift the free foot in a small tap instead of the stamp, the shoulders dropping on every step.',
    keys: [
      [0, { x: 0.07, y: -0.06, twist: 5, rf: [0.09, 0, 0], lf: [0.1, 0, 0.07], kneeL: -0.1, ...dabArms(0.4) }],
      [1, { x: 0.13, y: -0.05, rf: [0.2, 0, 0], lf: [0.1, 0, 0.07], ...dabArms(0) }],
      [2, { x: 0.18, y: -0.06, twist: 5, rf: [0.2, 0, 0], lf: [0.22, 0, 0.07], kneeL: -0.1, ...dabArms(0.4) }],
      [3, { x: 0.2, y: -0.07, bend: 4, nod: 4, rf: [0.28, 0.04, 0.05], lf: [0.22, 0, 0.07], kneeR: 0.1, ...dabArms(0.6) }],
    ],
  }),
  full({
    id: 'pandanggo-sway', name: 'Pandanggo Sway Balance', tags: 'pop party | arms legs | folk', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Palms down as if balancing an oil lamp on the back of each hand, both arms carried out to one side: step to that side, cross the other foot in front, step back in place and point the free foot forward as the arms sway over to the other side.',
    keys: [
      [0, { x: 0.04, y: -0.05, lean: -3, head: 5, rf: [0.15, 0, 0.03], lf: [-0.09, 0, 0], ...lamps(1, 0.82) }],
      [1, { x: 0.09, y: -0.06, rf: [0.15, 0, 0.03], lf: [0.07, 0, 0.09], kneeL: -0.1, ...lamps(1, 0.76) }],
      [2, { x: 0.09, y: -0.04, rf: [0.1, 0, -0.02], lf: [0.07, 0, 0.09], ...lamps(0, 0.8) }],
      [3, { x: 0.09, y: -0.03, lean: 3, head: -5, rf: [0.1, 0, -0.02], lf: [-0.05, 0, 0.13], pitchL: 25, ...lamps(-1, 0.84) }],
    ],
  }),
];

// --- Belly dance ----------------------------------------------------------------------------
// Arms in second position: out to the sides a little below the shoulders, elbows soft.
const SECOND: PoseSpec = { r: at(1, 0.4, 0.74, 0.08, E_OUT), l: at(-1, -0.4, 0.74, 0.08, E_OUT), handR: 1, handL: 1 };
// A crown: both arms curved up over the head, the hands apart.
const CROWN: PoseSpec = { r: at(1, 0.14, 1.06, 0.1, E_UP), l: at(-1, -0.14, 1.06, 0.1, E_UP), handR: 1, handL: 1 };
const shimmy = (s: 1 | -1, x: number): PoseSpec => ({
  x, y: -0.05, twist: 15 * s, lean: x * 200, head: -4 * s, shR: s > 0 ? 0.7 : 0, shL: s > 0 ? 0 : 0.7, hips: x * 0.5,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.06, kneeL: 0.06, ...SECOND,
});
const chestSlide = (s: 1 | -1 | 0): PoseSpec => ({
  y: -0.05, chestX: 0.07 * s, lean: 3 * s, head: -5 * s, shR: s > 0 ? 0.3 : 0, shL: s < 0 ? 0.3 : 0, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.06, kneeL: 0.06, ...CROWN,
});
// Snake arms: one arm rising elbow-first, the other sinking, wrists trailing; the weight shifting under them.
const snakeArm = (side: 1 | -1, k: 0 | 1 | 2 | 3): ArmPair => {
  // k: 0 low, 1 rising (elbow up, wrist low), 2 high, 3 sinking (elbow down, wrist high)
  const P: [number, number, number, readonly [number, number, number]][] = [
    [0.36, 0.6, 0.04, E_DOWN], [0.36, 0.76, 0.04, [1, 0.6, -0.2]], [0.37, 0.9, 0.04, E_OUT], [0.38, 0.78, 0.04, [0.6, -1, -0.2]],
  ];
  const [x, y, z, e] = P[k];
  return at(side, side * x, y, z, e);
};
type ArmPair = ReturnType<typeof at>;

const belly: MoveDef[] = [
  full({
    id: 'belly-shoulder-shimmy', name: 'Belly Dance Shoulder Shimmy', tags: 'latin pop | full arms | shake bellydance', beats: 4, level: 'low', d: 1, parts: ['torso', 'arms'],
    desc: 'Arms held out softly in second position, knees soft: push the shoulders forward and back in turn on every half beat while leaning slowly over to one side and then the other.',
    keys: [[0, shimmy(1, 0.02)], [0.5, shimmy(-1, 0.04)], [1, shimmy(1, 0.02)], [1.5, shimmy(-1, 0)], [2, shimmy(1, -0.02)], [2.5, shimmy(-1, -0.04)], [3, shimmy(1, -0.02)], [3.5, shimmy(-1, 0)]],
  }),
  full({
    id: 'chest-slides', name: 'Chest Slides', tags: 'latin pop | full | bellydance', beats: 2, level: 'low', d: 1, parts: ['torso'],
    desc: 'Arms curved up in a crown over the head and the hips still: slide the rib cage straight out to one side, back to the middle, then out to the other side.',
    keys: [[0, chestSlide(1)], [0.5, chestSlide(0)], [1, chestSlide(-1)], [1.5, chestSlide(0)]],
  }),
  full({
    id: 'snake-arms', name: 'Snake Arms Sway', tags: 'latin pop | arms | wave bellydance', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'],
    desc: 'Arms out to the sides, one rising elbow-first with the wrist trailing as the other sinks the same way, slowly, while the weight sways from one foot to the other.',
    keys: [
      [0, { x: 0.03, y: -0.05, hips: 0.035, tilt: 4, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeL: 0.08, r: snakeArm(1, 1), l: snakeArm(-1, 3), handR: 1, handL: 1 }],
      [1, { x: 0.02, y: -0.04, hips: 0.02, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: snakeArm(1, 2), l: snakeArm(-1, 0), handR: 1, handL: 1 }],
      [2, { x: -0.03, y: -0.05, hips: -0.035, tilt: -4, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.08, r: snakeArm(1, 3), l: snakeArm(-1, 1), handR: 1, handL: 1 }],
      [3, { x: -0.02, y: -0.04, hips: -0.02, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: snakeArm(1, 0), l: snakeArm(-1, 2), handR: 1, handL: 1 }],
    ],
  }),
];

// --- Dangdut --------------------------------------------------------------------------------
const heli = (k: number, touch: boolean): PoseSpec => {
  const a = (k * Math.PI) / 2;
  return {
    x: touch ? 0.07 : 0.04, y: touch ? -0.07 : -0.05, hips: touch ? 0.045 : 0.025, tilt: touch ? 6 : 3, head: 4, turn: -8,
    rf: [0.15, 0, 0], lf: touch ? [0.04, 0.012, 0.01] : [-0.1, 0, 0], kneeR: 0.06, kneeL: touch ? 0.1 : 0.04, pitchL: touch ? 18 : 0,
    r: at(1, 0.2 + 0.05 * Math.cos(a), 1.12 + 0.04 * Math.sin(a), 0.06, E_UP), l: at(-1, -0.06, 0.74, 0.2, E_OUT),
    formR: 'point', handL: 0.8,
  };
};
const tug = (pull: boolean, low: boolean): PoseSpec => ({
  x: pull ? -0.02 : 0.02, y: low ? -0.08 : -0.05, bend: pull ? -2 : 8, twist: pull ? -12 : 6, lean: pull ? -3 : 2, nod: pull ? -2 : 4,
  rf: [0.13, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.08, kneeL: 0.08,
  r: pull ? at(1, -0.06, 0.62, 0.22, E_DOWN) : at(1, 0.34, 0.7, 0.2, E_DOWN),
  l: pull ? at(-1, -0.25, 0.6, 0.12, E_DOWN) : at(-1, 0.18, 0.68, 0.26, E_DOWN), handR: 0, handL: 0,
});
const swing = (s: 1 | -1): PoseSpec => ({
  x: 0.03 * s, y: -0.06, hips: 0.035 * s, tilt: 5 * s, twist: -8 * s, head: 4 * s,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: s > 0 ? 0.04 : 0.14, kneeL: s > 0 ? 0.14 : 0.04,
  r: s > 0 ? at(1, -0.08, 0.76, 0.22, E_OUT) : at(1, 0.3, 0.5, -0.04, E_DOWN),
  l: s > 0 ? at(-1, -0.3, 0.5, -0.04, E_DOWN) : at(-1, 0.08, 0.76, 0.22, E_OUT), handR: 0.6, handL: 0.6,
});

const dangdut: MoveDef[] = [
  full({
    id: 'joget-helicopter', name: 'Helicopter Hand', tags: 'pop latin | arms hips | hands point', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true,
    desc: 'The koplo crowd\'s helicopter: step to the side and touch the other foot in with the hip, one hand raised overhead with the finger up, circling it from the wrist like a rotor, the other forearm in front of the chest; then the other way with the other hand.',
    keys: [[0, heli(0, false)], [0.5, heli(1, false)], [1, heli(2, true)], [1.5, heli(3, true)]],
  }),
  full({
    id: 'joget-tug', name: 'Tug-of-War Joget', tags: 'pop latin | arms full | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Lean in and reach both fists out to the front diagonal as if gripping a rope, then haul it back to the other hip, twisting and sitting into the knees; reach and haul again.',
    keys: [[0, tug(false, false)], [0.5, tug(false, true)], [1, tug(true, false)], [1.5, tug(true, true)]],
  }),
  full({
    id: 'koplo-swing', name: 'Koplo Arm Swing', tags: 'pop latin | arms hips | swing', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'],
    desc: 'Rocking from foot to foot with the hips swaying, swing one loose hand across in front of the chest as the other swings out low behind the hip, then swap, on every beat.',
    keys: [[0, swing(1)], [1, swing(-1)]],
  }),
];

// --- Schlager -------------------------------------------------------------------------------
const polo = (s: 1 | -1, up: boolean, spin: number): PoseSpec => ({
  x: 0.015 * s, y: up ? -0.03 : -0.06, spin, head: 6 * s, lean: 2 * s,
  rf: s > 0 ? [0.09, 0, 0] : [0.09, up ? 0.05 : 0, 0.03], lf: s > 0 ? [-0.09, up ? 0.05 : 0, 0.03] : [-0.09, 0, 0],
  kneeR: s < 0 && up ? 0.08 : 0, kneeL: s > 0 && up ? 0.08 : 0,
  r: at(1, 0.15, 0.76, 0.27, E_DOWN), l: at(-1, -0.15, 0.76, 0.27, E_DOWN), handR: 1, handL: 1,
});
const klatsch = (s: 1 | -1, clap: boolean): PoseSpec => ({
  x: 0.04 * s, y: clap ? -0.06 : -0.04, hips: 0.03 * s, tilt: 3 * s, head: 5 * s, nod: clap ? 3 : -3,
  rf: s > 0 ? [0.14, 0, 0] : [-0.01, 0.012, 0.01], lf: s > 0 ? [0.01, 0.012, 0.01] : [-0.14, 0, 0], pitchR: s < 0 ? 18 : 0, pitchL: s > 0 ? 18 : 0,
  r: clap ? at(1, 0.02, 0.8, 0.24, E_DOWN) : at(1, 0.2, 0.84, 0.18, E_OUT), l: clap ? at(-1, -0.02, 0.8, 0.24, E_DOWN) : at(-1, -0.2, 0.84, 0.18, E_OUT), handR: 1, handL: 1,
});

const schlager: MoveDef[] = [
  full({
    id: 'polonaise', name: 'Polonaise March', tags: 'party pop | legs arms | walk', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'],
    desc: 'The party conga line: both hands forward as if on the shoulders of the person in front, march on the spot with a bob, rocking the head from side to side and turning slowly to one diagonal and then the other as the line winds round the room.',
    keys: [
      [0, polo(1, false, 24)], [0.5, polo(1, true, 24)], [1, polo(-1, false, 12)], [1.5, polo(-1, true, -12)],
      [2, polo(1, false, -24)], [2.5, polo(1, true, -24)], [3, polo(-1, false, -12)], [3.5, polo(-1, true, 12)],
    ],
  }),
  full({
    id: 'clap-along', name: 'Clap-Along Sway', tags: 'party pop | arms hips | clap', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'],
    desc: 'Mitklatschen: step to one side and touch the other foot in, clapping in front of the chin on the beat, open the hands on the "and", then step to the other side and clap again.',
    keys: [[0, klatsch(1, true)], [0.5, klatsch(1, false)], [1, klatsch(-1, true)], [1.5, klatsch(-1, false)]],
  }),
];

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [...folk, ...belly, ...dangdut, ...schlager];
