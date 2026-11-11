/**
 * Latin / dance-fitness: hip isolations (sway, shake, circle, figure eight,
 * pop, drop) each with its own arm styling, merengue, reggaeton, salsa,
 * bachata, cumbia, cha-cha, mambo, samba, conga, flamenco and paso doble.
 *
 * Hip channels: `hips` = lateral pelvis shift (units), `tilt` = pelvis roll
 * (deg, + = user's right hip up), `hipTwist` = pelvis yaw, `kneeR/kneeL` =
 * knee turn-out (+ out, - in). A hip goes UP on the side it shifts to.
 *
 * Pattern ids are global across files; the new ones here are prefixed with
 * the style (salsa*, bachata*, samba*, flamenco*, latin*) to stay unique.
 */

import { ARM, at, mir, wide, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';
import { hand } from '../../coach/poses';

// ---------------------------------------------------------------------------
// Hip isolations (footwork)
const shakeA: PoseSpec = wide(-0.065, { hips: 0.034, tilt: 6, kneeR: 0.1, kneeL: 0.1 });
const circR: PoseSpec = wide(-0.045, { hips: 0.06, tilt: 6, bend: -1, head: -3 });
const circBack: PoseSpec = wide(-0.03, { hips: 0, bend: 8, nod: 4 });
const circFront: PoseSpec = wide(-0.07, { hips: 0, bend: -5, nod: -3, kneeR: 0.14, kneeL: 0.14 });
const eightA: PoseSpec = wide(-0.045, { hips: 0.025, hipTwist: -20, tilt: 3, twist: 6 });
const eightB: PoseSpec = wide(-0.035, { hips: 0.066, hipTwist: 0, tilt: 7, twist: 0, head: -3 });
const popA: PoseSpec = { hips: 0.064, tilt: 9, y: -0.032, lf: [-0.078, 0.035, 0.045], kneeL: -0.22, lean: 2, head: -5 };
const popSettle: PoseSpec = { hips: 0.022, tilt: 2, y: -0.02, lf: [-0.085, 0.01, 0.015], kneeL: -0.06 };
const merengueA: PoseSpec = { hips: -0.045, tilt: -6, y: -0.03, rf: [0.09, 0.045, 0.03], kneeR: -0.12 };
const dembowA: PoseSpec = wide(-0.075, { hips: 0.032, tilt: 4, bend: 6, nod: 4 });
const dembowUp: PoseSpec = wide(-0.025, { hips: 0.01, bend: 2 });

// ---------------------------------------------------------------------------
// Arm stylings
const OPEN = { handR: 1, handL: 1 } as const;
const salsaA: PoseSpec = { r: at(1, 0.23, 0.62, 0.15, [0.7, -1, -0.5]), l: at(-1, -0.19, 0.6, 0.17, [0.7, -1, -0.5]), handR: 0.7, handL: 0.7, twist: -5 };
const maracaUp: PoseSpec = { r: at(1, 0.2, 0.95, 0.17, [0.8, -1, -0.2]), l: at(-1, -0.2, 0.95, 0.17, [0.8, -1, -0.2]), handR: 0.15, handL: 0.15 };
const maracaDn: PoseSpec = { r: at(1, 0.21, 0.9, 0.18, [0.8, -1, -0.2]), l: at(-1, -0.21, 0.9, 0.18, [0.8, -1, -0.2]), handR: 0.15, handL: 0.15 };
const kneesA: PoseSpec = { bend: 24, nod: -14, r: hand(0.03, -0.29, 0.03, [1, 0.2, -0.3]), l: hand(0.03, -0.29, 0.03, [1, 0.2, -0.3]), handR: 1, handL: 1 };
// Hula-style flowing arms: one arm reaches out toward the hip, the other floats across in front.
const flowA: PoseSpec = { r: at(1, 0.38, 0.74, 0.06, [0.3, -1, -0.1]), l: at(-1, 0.04, 0.66, 0.2, [0.6, -1, -0.3]), ...OPEN };
// Wrists crossed overhead.
const crossUp: PoseSpec = { r: at(1, -0.015, 1.04, 0.05, [1, 0.2, -0.1]), l: at(-1, 0.015, 1.03, 0.03, [1, 0.2, -0.1]), ...OPEN };
// One arm up overhead, the other fist on the hip.
const oneUpA: PoseSpec = { r: at(1, 0.17, 1.07, 0.04, [1, 0, -0.2]), l: ARM.hip, handR: 1, handL: 0 };
// Hair brush: the hand sweeps from the forehead over the top of the head and out.
const brush0: PoseSpec = { r: at(1, 0.05, 0.97, 0.15, [1, 0.3, -0.3]), l: ARM.hip, handR: 1, handL: 0 };
const brush1: PoseSpec = { r: at(1, 0.07, 1.06, 0.01, [1, 0.3, -0.3]), l: ARM.hip, handR: 1, handL: 0 };
const brush2: PoseSpec = { r: at(1, 0.17, 0.95, -0.06, [1, 0.3, 0]), l: ARM.hip, handR: 1, handL: 0 };
const brush3: PoseSpec = { r: at(1, 0.38, 0.78, 0.04, [0.4, -1, -0.2]), l: ARM.hip, handR: 1, handL: 0 };
// Snake arms: both arms out at shoulder height, one wrist rising as the other sinks.
const snakeA: PoseSpec = { r: [86, 8, 110, 8], l: [74, 8, 52, 8], ...OPEN };
// Closed dance frame adapted for solo: one hand raised out at head height, the other curved across the chest.
const frameA: PoseSpec = { l: at(-1, -0.3, 0.9, 0.1, [0.4, -1, -0.2]), r: at(1, 0.0, 0.73, 0.2, [1, -0.4, -0.1]), handR: 1, handL: 0.6, shR: 0.35, shL: 0 };
// Clap beside the shoulder.
const sideClapA: PoseSpec = { r: at(1, 0.15, 0.84, 0.19, [0.8, -1, -0.2]), l: at(-1, 0.1, 0.84, 0.19, [0.3, -1, -0.3]), ...OPEN };
const sideClapOpen: PoseSpec = { r: at(1, 0.28, 0.76, 0.12, [0.6, -1, -0.2]), l: at(-1, -0.08, 0.72, 0.18, [0.6, -1, -0.2]), ...OPEN };
// Low elbow pump (reggaeton): fists pump down with the bounce.
const pumpLowA: PoseSpec = { r: at(1, 0.18, 0.5, 0.14, [0.6, -1, -0.6]), l: at(-1, -0.15, 0.78, 0.2, [0.6, -1, -0.4]), handR: 0, handL: 0 };
// Open break: arms open wide and low.
const openWide: PoseSpec = { r: at(1, 0.4, 0.66, 0.06, [0.3, -1, -0.1]), l: at(-1, -0.4, 0.66, 0.06, [0.3, -1, -0.1]), ...OPEN };
// Side basic: the arm on the stepping side opens out low; both come back in on the close.
const swingSideA: PoseSpec = { r: at(1, 0.38, 0.6, 0.06, [0.3, -1, -0.1]), l: at(-1, -0.17, 0.6, 0.17, [0.7, -1, -0.5]), handR: 1, handL: 0.7 };
// Cha-cha arm: one arm opens out to the side at shoulder height on the chasse.
const chaArmOut: PoseSpec = { r: at(1, 0.43, 0.84, 0.05, [0.3, -1, 0]), l: at(-1, -0.12, 0.66, 0.2, [0.7, -1, -0.4]), handR: 1, handL: 0.7 };
// Turn arm: right hand overhead, left curved in front of the waist.
const turnHandUp: PoseSpec = { r: at(1, 0.06, 1.07, 0.04, [1, 0.2, -0.1]), l: at(-1, 0.0, 0.58, 0.2, [1, -0.3, -0.2]), handR: 0.6, handL: 1 };
// Skirt arms: both hands out at the sides as if spreading a wide skirt.
const skirtSpread: PoseSpec = { r: at(1, 0.36, 0.5, 0.06, [0.3, -1, 0]), l: at(-1, -0.36, 0.5, 0.06, [0.3, -1, 0]), ...OPEN };
// Suzy Q: both hands wipe toward one side at waist height.
const wipeA: PoseSpec = { r: at(1, 0.3, 0.68, 0.14, [0.6, -1, -0.3]), l: at(-1, 0.03, 0.66, 0.2, [0.6, -1, -0.3]), ...OPEN };
// Samba arms: one arm forward at chest height, the other out low to the side.
const sambaArmA: PoseSpec = { r: at(1, 0.13, 0.78, 0.28, [0.6, -1, -0.2]), l: at(-1, -0.4, 0.6, 0.0, [0.3, -1, -0.1]), ...OPEN };
// Samba whisk: arm on the stepping side sweeps up and out on the diagonal.
const whiskA: PoseSpec = { r: at(1, 0.36, 1.0, 0.06, [0.6, -0.3, -0.3]), l: at(-1, -0.04, 0.72, 0.2, [0.8, -1, -0.3]), ...OPEN };
// Conga: hands forward on the shoulders of the dancer in front.
const congaHands: PoseSpec = { r: at(1, 0.15, 0.78, 0.29, [0.6, -1, -0.2]), l: at(-1, -0.15, 0.78, 0.29, [0.6, -1, -0.2]), handR: 0.8, handL: 0.8 };
// Bachata: hands low in front of the hips, flicking up on the tap.
const bachLow: PoseSpec = { r: at(1, 0.2, 0.5, 0.15, [0.6, -1, -0.3]), l: at(-1, -0.12, 0.52, 0.18, [0.6, -1, -0.3]), ...OPEN };
const bachFlick: PoseSpec = { r: at(1, 0.24, 0.8, 0.16, [0.8, -1, -0.3]), l: at(-1, -0.2, 0.62, 0.16, [0.6, -1, -0.3]), ...OPEN };
// Mambo: palms push forward on the forward break, pull in on the back break.
const mamboPush: PoseSpec = { r: at(1, 0.12, 0.76, 0.3, [0.6, -1, -0.2]), l: at(-1, -0.12, 0.76, 0.3, [0.6, -1, -0.2]), ...OPEN };
const mamboPull: PoseSpec = { r: at(1, 0.2, 0.7, 0.12, [0.6, -1, -0.5]), l: at(-1, -0.2, 0.7, 0.12, [0.6, -1, -0.5]), handR: 0.3, handL: 0.3 };
// Flamenco: one arm rounded overhead, the other rounded low at the side; wrists circling.
const flamA: PoseSpec = { r: at(1, 0.1, 1.04, 0.08, [1, 0.3, -0.2]), l: at(-1, -0.33, 0.6, 0.06, [0.3, -1, 0.2]), handR: 1, handL: 0.5, lean: -4, head: 5, nod: -6 };
const flamB: PoseSpec = { ...flamA, r: at(1, 0.14, 1.02, 0.1, [1, 0.3, -0.2]), handR: 0.3, handL: 1 };
// Palmas: clap up beside the cheek.
const palmaA: PoseSpec = { r: at(1, 0.11, 0.92, 0.16, [1, -1, -0.2]), l: at(-1, 0.09, 0.92, 0.16, [0.4, -1, -0.2]), ...OPEN, nod: -5, turn: 10 };
const palmaOpen: PoseSpec = { r: at(1, 0.24, 0.88, 0.12, [1, -1, -0.2]), l: at(-1, -0.08, 0.86, 0.16, [0.6, -1, -0.2]), ...OPEN, nod: -2, turn: 6 };
// Both arms rounded overhead (flamenco turn).
const roundUp: PoseSpec = { r: at(1, 0.11, 1.03, 0.08, [1, 0.3, -0.2]), l: at(-1, -0.11, 1.03, 0.08, [1, 0.3, -0.2]), handR: 0.6, handL: 0.6 };
// Paso doble cape: both hands hold a cape low at one side, sweep it overhead to the other.
const capeLow: PoseSpec = { r: at(1, 0.34, 0.62, 0.1, [0.4, -1, -0.2]), l: at(-1, 0.12, 0.62, 0.2, [0.6, -1, -0.3]), handR: 0.2, handL: 0.2 };
const capeUp: PoseSpec = { r: at(1, 0.13, 1.04, 0.08, [1, 0.2, -0.2]), l: at(-1, -0.13, 1.04, 0.08, [1, 0.2, -0.2]), handR: 0.2, handL: 0.2 };
// Cumbia: candle held up beside the shoulder, the other hand spreading the skirt.
const candleA: PoseSpec = { r: at(1, 0.22, 0.95, 0.08, [1, -0.6, -0.2]), l: at(-1, -0.34, 0.5, 0.06, [0.3, -1, 0]), handR: 0.2, handL: 0.4 };
// Carnival arms: both arms high and wide, one higher than the other, alternating.
const carnivalA: PoseSpec = { r: at(1, 0.34, 1.04, 0.05, [1, -0.2, -0.2]), l: at(-1, -0.36, 0.92, 0.06, [1, -0.2, -0.2]), ...OPEN };
// Fan: one hand flicks a fan beside the face, the other fist on the hip.
const fanA: PoseSpec = { r: at(1, 0.15, 0.88, 0.18, [1, -1, -0.2]), l: ARM.hip, handR: 1, handL: 0 };
const fanB: PoseSpec = { r: at(1, 0.24, 0.94, 0.13, [1, -1, -0.2]), l: ARM.hip, handR: 1, handL: 0 };
// Shake it down: the hands slide from the hips down the thighs and back.
const slideTop: PoseSpec = { r: ARM.hip, l: ARM.hip, handR: 1, handL: 1 };
const slideLow: PoseSpec = { r: at(1, 0.2, 0.36, 0.16, [1, -0.2, -0.3]), l: at(-1, -0.2, 0.36, 0.16, [1, -0.2, -0.3]), handR: 1, handL: 1, bend: 12, nod: -6 };
// Bota fogo: the arm on the crossing side reaches forward and up, the other back and low.
const fogoA: PoseSpec = { r: at(1, 0.16, 0.98, 0.22, [0.8, -1, -0.2]), l: at(-1, -0.34, 0.56, -0.04, [0.3, -1, 0]), ...OPEN };
// Cucaracha: arms open low on the side press, wrists cross low in front on the replace.
const cucaOpen: PoseSpec = { r: at(1, 0.4, 0.72, 0.05, [0.3, -1, -0.1]), l: at(-1, -0.36, 0.62, 0.06, [0.3, -1, -0.1]), ...OPEN };
const cucaCross: PoseSpec = { r: at(1, -0.03, 0.48, 0.2, [1, -0.3, -0.2]), l: at(-1, 0.03, 0.5, 0.22, [1, -0.3, -0.2]), ...OPEN };
// Samba-reggae drum: one stick raised high, the other strikes the drum at the hip; alternate.
const drumA: PoseSpec = { r: at(1, 0.26, 1.02, 0.1, [1, -0.3, -0.2]), l: at(-1, 0.02, 0.56, 0.24, [0.8, -1, -0.2]), handR: 0, handL: 0 };
// Folklorico skirt work (faldeo): both hands hold the skirt edges and sweep them high on one side, low on the other.
const faldeoA: PoseSpec = { r: at(1, 0.4, 0.86, 0.06, [0.3, -1, -0.1]), l: at(-1, -0.36, 0.46, 0.06, [0.3, -1, 0]), handR: 0.3, handL: 0.3 };
// Cumbia machete: one hand cocked beside the head, elbow high, chops down across to the other hip; other fist on the hip.
const macheteUp: PoseSpec = { r: at(1, 0.17, 0.97, -0.04, [1, 0.6, -0.2]), l: ARM.hip, handR: 0, handL: 0, twist: 8 };
const macheteDown: PoseSpec = { r: at(1, -0.1, 0.5, 0.22, [1, -0.6, -0.2]), l: ARM.hip, handR: 0, handL: 0, twist: -10 };
// Bachata styling: one hand on the belly, the other arm out low to the side, lifting on the tap.
const bellyA: PoseSpec = { l: at(-1, -0.02, 0.58, 0.17, [1, -0.4, -0.3]), r: at(1, 0.4, 0.6, 0.06, [0.3, -1, -0.1]), handR: 1, handL: 1 };
const bellyTap: PoseSpec = { ...bellyA, r: at(1, 0.38, 0.84, 0.06, [0.3, -1, -0.1]) };

export const patterns: PatternSet = {
  foot: {
    // Hip isolations
    hipShake: { beats: 1, parts: ['hips'], keys: [[0, shakeA], [0.5, mir(shakeA)]] },
    hipCircle: { beats: 2, parts: ['hips', 'torso'], torso: true, keys: [[0, circR], [0.5, circBack], [1, mir(circR)], [1.5, circFront]] },
    hipEight: { beats: 2, parts: ['hips'], torso: true, keys: [[0, eightA], [0.5, eightB], [1, mir(eightA)], [1.5, mir(eightB)]] },
    hipPop: { beats: 2, parts: ['hips'], torso: true, keys: [[0, popA], [0.5, popSettle], [1, mir(popA)], [1.5, mir(popSettle)]] },
    hipDrop: {
      beats: 2, parts: ['hips', 'legs'], mirror: true,
      keys: [
        [0, { tilt: -9, hips: -0.018, y: -0.045, rf: [0.09, 0.045, 0.045], kneeR: -0.2 }],
        [1, { tilt: 1, hips: 0.01, y: -0.015 }],
      ],
    },
    booty: {
      beats: 1, parts: ['hips', 'legs'], impact: true,
      keys: [
        [0, { y: -0.15, rf: [0.19, 0, 0.02], lf: [-0.19, 0, 0.02], hips: 0.035, tilt: 8, kneeR: 0.22, kneeL: 0.22 }],
        [0.5, { y: -0.16, rf: [0.19, 0, 0.02], lf: [-0.19, 0, 0.02], hips: -0.035, tilt: -8, kneeR: 0.22, kneeL: 0.22 }],
      ],
    },
    // Merengue and reggaeton
    merengue: { beats: 2, parts: ['hips'], keys: [[0, merengueA], [1, mir(merengueA)]] },
    merengueTurn: {
      beats: 4, parts: ['hips', 'turn'],
      keys: [
        [0, { ...merengueA, rf: [0.06, 0.045, 0.03], lf: [-0.06, 0, 0], spin: 0 }],
        [1, { ...mir(merengueA), lf: [-0.06, 0.045, 0.03], rf: [0.06, 0, 0], spin: 90 }],
        [2, { ...merengueA, rf: [0.06, 0.045, 0.03], lf: [-0.06, 0, 0], spin: 180 }],
        [3, { ...mir(merengueA), lf: [-0.06, 0.045, 0.03], rf: [0.06, 0, 0], spin: 270 }],
      ],
    },
    dembow: { beats: 2, parts: ['hips', 'legs'], torso: true, keys: [[0, dembowA], [0.5, dembowUp], [1, mir(dembowA)], [1.5, mir(dembowUp)]] },
    // Salsa
    salsa: {
      beats: 4, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { rf: [0.09, 0, 0.14], hips: 0.045, tilt: 4, y: -0.03, kneeL: -0.08 }],
        [1, { rf: [0.09, 0.0, 0.14], hips: -0.045, tilt: -4, y: -0.022, kneeR: -0.08 }],
        [2, { rf: [0.09, 0, 0], hips: 0.035, tilt: 3, y: -0.035 }],
        [3, { hips: 0.01, y: -0.015 }],
      ],
    },
    salsaBack: {
      beats: 4, parts: ['legs', 'hips'], mirror: true, torso: true,
      keys: [
        [0, { rf: [0.1, 0, -0.15], hips: 0.045, tilt: 4, y: -0.04, bend: 4, kneeL: -0.08 }],
        [1, { rf: [0.1, 0, -0.15], hips: -0.045, tilt: -4, y: -0.025, bend: -2, kneeR: -0.06 }],
        [2, { rf: [0.09, 0, 0], hips: 0.035, tilt: 3, y: -0.035, bend: 0 }],
        [3, { hips: 0.01, y: -0.015 }],
      ],
    },
    salsaSide: {
      beats: 4, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { x: 0.05, rf: [0.24, 0, 0], hips: 0.045, tilt: 4, y: -0.035, kneeL: -0.08 }],
        [1, { x: 0.0, rf: [0.24, 0, 0], hips: -0.04, tilt: -4, y: -0.025 }],
        [2, { rf: [0.09, 0, 0], hips: 0.03, tilt: 3, y: -0.035 }],
        [3, { hips: 0.01, y: -0.015 }],
      ],
    },
    salsaSuzyQ: {
      beats: 2, parts: ['legs', 'hips'], mirror: true, torso: true,
      keys: [
        [0, { rf: [-0.1, 0, 0.09], hipTwist: -18, hips: -0.02, y: -0.05, kneeR: -0.12, twist: 8 }],
        [1, { rf: [0.15, 0, 0], hipTwist: 10, hips: 0.045, tilt: 5, y: -0.03, twist: -6 }],
      ],
    },
    // Salsa right turn: forward break, replace, then a full turn on 2-3.
    salsaTurn: {
      beats: 4, parts: ['legs', 'turn'], mirror: true,
      keys: [
        [0, { rf: [0.09, 0, 0.14], hips: 0.04, tilt: 4, y: -0.03, spin: 0 }],
        [1, { rf: [0.09, 0, 0.14], hips: -0.04, tilt: -4, y: -0.025, spin: 0 }],
        [2, { rf: [0.055, 0, 0.02], lf: [-0.055, 0, 0], y: -0.05, spin: 0 }],
        [2.5, { rf: [0.055, 0, 0], lf: [-0.055, 0.02, 0], y: -0.02, spin: 120 }],
        [3, { rf: [0.055, 0, 0], lf: [-0.055, 0, 0], y: -0.03, spin: 240 }],
      ],
    },
    // Cumbia, cha-cha, mambo
    cumbia: {
      beats: 2, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { rf: [0.13, 0, -0.13], hips: 0.035, tilt: 4, hipTwist: 10, y: -0.045, lean: -2 }],
        [1, { rf: [0.09, 0, 0], hips: -0.015, y: -0.02 }],
      ],
    },
    chaCha: {
      beats: 4, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { rf: [0.09, 0, 0.13], hips: 0.04, tilt: 4, y: -0.03 }],
        [1, { rf: [0.09, 0, 0.13], hips: -0.04, tilt: -4, y: -0.025 }],
        [2, { rf: [0.1, 0, 0], hips: 0.035, tilt: 4, y: -0.035 }],
        [2.5, { rf: [0.1, 0, 0], lf: [-0.05, 0, 0], hips: -0.03, tilt: -3, y: -0.03 }],
        [3, { rf: [0.12, 0, 0], lf: [-0.05, 0, 0], hips: 0.04, tilt: 4, y: -0.035 }],
      ],
    },
    // Cha-cha chasse travelling: rock back on the left, then side-together-side to the right.
    chaChasse: {
      beats: 4, parts: ['legs', 'hips'], mirror: true, travel: 0.24,
      keys: [
        [0, { x: 0, lf: [-0.1, 0, -0.13], hips: -0.04, tilt: -4, y: -0.035 }],
        [1, { x: 0, lf: [-0.09, 0, 0], hips: 0.035, tilt: 4, y: -0.025 }],
        [2, { x: 0.1, rf: [0.28, 0, 0], lf: [-0.09, 0, 0], hips: 0.04, tilt: 4, y: -0.04 }],
        [2.5, { x: 0.16, rf: [0.28, 0, 0], lf: [0.12, 0, 0], hips: -0.025, tilt: -3, y: -0.03 }],
        [3, { x: 0.24, rf: [0.37, 0, 0], lf: [0.12, 0, 0], hips: 0.04, tilt: 4, y: -0.045 }],
      ],
    },
    mambo: {
      beats: 2, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { rf: [0.09, 0, 0.15], hips: 0.03, tilt: 3, y: -0.03, bend: -4, nod: -3 }],
        [1, { rf: [0.1, 0, -0.11], hips: -0.02, tilt: -2, y: -0.035, bend: 5, nod: 3 }],
      ],
    },
    // Bachata: side, together, side, tap with a hip pop.
    bachataSide: {
      beats: 4, parts: ['legs', 'hips'], mirror: true, travel: 0.2,
      keys: [
        [0, { x: 0.07, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], hips: 0.03, tilt: 3, y: -0.035 }],
        [1, { x: 0.13, rf: [0.25, 0, 0], lf: [0.07, 0, 0], hips: -0.02, tilt: -2, y: -0.025 }],
        [2, { x: 0.2, rf: [0.38, 0, 0], lf: [0.07, 0, 0], hips: 0.03, tilt: 3, y: -0.035 }],
        [3, { x: 0.2, rf: [0.38, 0, 0], lf: [0.17, 0.035, 0.03], hips: -0.06, tilt: -10, y: -0.04, kneeL: -0.2 }],
      ],
    },
    // Samba basic: step forward, ball change, replace, with the samba bounce.
    sambaBasic: {
      beats: 2, parts: ['legs', 'hips'], mirror: true, torso: true,
      keys: [
        [0, { rf: [0.09, 0, 0.13], y: -0.07, hips: 0.02, bend: -4, kneeR: 0.05 }],
        [0.5, { rf: [0.09, 0, 0.13], lf: [-0.09, 0.03, 0.02], y: -0.025, bend: 3 }],
        [1, { rf: [0.09, 0, 0], y: -0.065, hips: -0.015, bend: -2 }],
        [1.5, { y: -0.02, bend: 2 }],
      ],
    },
    // Samba whisk: side step, cross behind on the ball of the foot, replace.
    sambaWhisk: {
      beats: 2, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { x: 0.05, rf: [0.24, 0, 0], lf: [-0.09, 0, 0], hips: 0.04, tilt: 5, y: -0.06 }],
        [0.5, { x: 0.07, rf: [0.24, 0, 0], lf: [0.1, 0.03, -0.11], hips: -0.01, y: -0.03, kneeL: -0.15 }],
        [1, { x: 0.05, rf: [0.24, 0, 0], lf: [-0.04, 0, 0], hips: 0.03, tilt: 4, y: -0.065 }],
      ],
    },
    // Conga: three marching steps and a side kick on 4.
    conga: {
      beats: 4, parts: ['legs'], mirror: true,
      keys: [
        [0, { rf: [0.09, 0.09, 0.06], y: -0.02, hips: -0.02 }],
        [1, { lf: [-0.09, 0.09, 0.06], y: -0.02, hips: 0.02 }],
        [2, { rf: [0.09, 0.09, 0.06], y: -0.02, hips: -0.02 }],
        [3, { lf: [-0.3, 0.14, 0.04], y: -0.03, hips: 0.03, lean: 6 }],
      ],
    },
    // Shake it down: hip shake sinking for two beats and rising for two.
    hipShakeDown: {
      beats: 4, parts: ['hips', 'legs'],
      keys: [
        [0, wide(-0.05, { hips: 0.034, tilt: 6, kneeR: 0.1, kneeL: 0.1 })],
        [0.5, wide(-0.09, { hips: -0.034, tilt: -6, kneeR: 0.14, kneeL: 0.14 })],
        [1, wide(-0.13, { hips: 0.034, tilt: 6, kneeR: 0.18, kneeL: 0.18 })],
        [1.5, wide(-0.16, { hips: -0.034, tilt: -6, kneeR: 0.2, kneeL: 0.2 })],
        [2, wide(-0.16, { hips: 0.034, tilt: 6, kneeR: 0.2, kneeL: 0.2 })],
        [2.5, wide(-0.13, { hips: -0.034, tilt: -6, kneeR: 0.18, kneeL: 0.18 })],
        [3, wide(-0.09, { hips: 0.034, tilt: 6, kneeR: 0.14, kneeL: 0.14 })],
        [3.5, wide(-0.06, { hips: -0.034, tilt: -6, kneeR: 0.1, kneeL: 0.1 })],
      ],
    },
    // Bachata forward basic: forward, replace, close, tap with a hip pop.
    bachataFwd: {
      beats: 4, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { rf: [0.09, 0, 0.14], hips: 0.035, tilt: 4, y: -0.035 }],
        [1, { rf: [0.09, 0, 0.14], hips: -0.035, tilt: -4, y: -0.025 }],
        [2, { rf: [0.09, 0, 0], hips: 0.03, tilt: 3, y: -0.035 }],
        [3, { rf: [0.09, 0, 0], lf: [-0.07, 0.035, 0.03], hips: 0.065, tilt: 10, y: -0.04, kneeL: -0.2 }],
      ],
    },
    // Samba bota fogo: cross in front, ball change, replace (a travelling-feel cross step).
    sambaFogo: {
      beats: 2, parts: ['legs', 'hips'], mirror: true, torso: true,
      keys: [
        [0, { rf: [-0.06, 0, 0.11], lf: [-0.11, 0, 0], hipTwist: -16, y: -0.065, twist: 10, hips: -0.01 }],
        [0.5, { rf: [-0.06, 0, 0.11], lf: [-0.14, 0.03, -0.03], hipTwist: -8, y: -0.025, twist: 5 }],
        [1, { rf: [0.06, 0, 0.04], lf: [-0.1, 0, 0], hipTwist: 4, y: -0.06, twist: 0, hips: 0.02 }],
      ],
    },
    // Cucaracha: press to the side with the hip, replace, close.
    cucaracha: {
      beats: 2, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { rf: [0.24, 0, 0.02], hips: 0.06, tilt: 8, x: 0.04, y: -0.045, kneeL: -0.08 }],
        [1, { rf: [0.09, 0, 0], hips: -0.035, tilt: -4, x: 0, y: -0.03 }],
      ],
    },
    // Samba-reggae: wide sway step side to side with a deep bounce.
    sambaReggae: {
      beats: 2, parts: ['legs'], mirror: true, impact: true,
      keys: [
        [0, { x: 0.05, rf: [0.19, 0, 0], lf: [-0.11, 0, 0], y: -0.1, hips: 0.03, lean: -3 }],
        [1, { x: 0.02, rf: [0.19, 0, 0], lf: [-0.11, 0.03, 0.02], y: -0.04, hips: 0.0 }],
      ],
    },
    // Folklorico heel step: tap the heel forward and back with a lively bounce.
    folkHeel: {
      beats: 1, parts: ['legs'], mirror: true,
      keys: [
        [0, { rf: [0.1, 0.03, 0.14], y: -0.05, hips: -0.015, kneeR: 0.1 }],
        [0.5, { rf: [0.09, 0, 0], y: -0.02, hips: 0.01 }],
      ],
    },
    // Cumbia sau: step out to the side, then drag the other foot in along the floor.
    cumbiaSau: {
      beats: 2, parts: ['legs', 'hips'], mirror: true, travel: 0.1,
      keys: [
        [0, { x: 0.06, rf: [0.26, 0, 0], lf: [-0.09, 0, 0], y: -0.07, hips: 0.03, tilt: 4, lean: -4 }],
        [0.5, { x: 0.08, rf: [0.26, 0, 0], lf: [-0.02, 0, 0], y: -0.06, hips: 0.02, lean: -3 }],
        [1, { x: 0.1, rf: [0.26, 0, 0], lf: [0.08, 0, 0], y: -0.03, hips: -0.01, lean: 0 }],
      ],
    },
    // Merengue side walk: step out with the hip, close.
    merengueSide: {
      beats: 2, parts: ['legs', 'hips'], mirror: true, travel: 0.14,
      keys: [
        [0, { x: 0.07, rf: [0.23, 0, 0], lf: [-0.09, 0, 0], hips: -0.04, tilt: -6, y: -0.04 }],
        [1, { x: 0.14, rf: [0.23, 0, 0], lf: [0.05, 0, 0], hips: 0.04, tilt: 6, y: -0.04 }],
      ],
    },
    // Samba no pe: quick right-left on the balls of the feet.
    sambaNoPe: {
      beats: 1, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { rf: [0.11, 0, 0.05], lf: [-0.09, 0.025, -0.02], y: -0.06, hips: 0.03, tilt: 4 }],
        [0.5, { rf: [0.1, 0.03, 0.04], lf: [-0.08, 0, -0.02], y: -0.025, hips: -0.01, tilt: -1 }],
      ],
    },
    // Flamenco stamps (zapateado): alternate flat-foot stamps on every half beat.
    flamencoStamp: {
      beats: 1, parts: ['legs'], impact: true,
      keys: [
        [0, { rf: [0.09, 0, 0.02], lf: [-0.09, 0.055, 0.02], y: -0.055, hips: 0.012 }],
        [0.5, { rf: [0.09, 0.055, 0.02], lf: [-0.09, 0, 0.02], y: -0.05, hips: -0.012 }],
      ],
    },
    // Flamenco turn: a slow stamping turn, a quarter per beat.
    flamencoTurn: {
      beats: 4, parts: ['turn', 'legs'],
      keys: [
        [0, { rf: [0.06, 0, 0], lf: [-0.06, 0.04, 0.01], y: -0.05, spin: 0 }],
        [1, { rf: [0.06, 0.04, 0.01], lf: [-0.06, 0, 0], y: -0.05, spin: 90 }],
        [2, { rf: [0.06, 0, 0], lf: [-0.06, 0.04, 0.01], y: -0.05, spin: 180 }],
        [3, { rf: [0.06, 0.04, 0.01], lf: [-0.06, 0, 0], y: -0.05, spin: 270 }],
      ],
    },
    // Paso doble appel: a stamp into a proud wide stance, then rise.
    pasoAppel: {
      beats: 2, parts: ['legs'], impact: true, mirror: true,
      keys: [
        [0, { rf: [0.17, 0, 0.02], lf: [-0.13, 0, 0], y: -0.08, x: 0.02, kneeR: 0.12, kneeL: 0.12 }],
        [1, { rf: [0.17, 0, 0.02], lf: [-0.13, 0, 0], y: -0.025, x: 0.0 }],
      ],
    },
  },
  arms: {
    salsaArms: { beats: 2, parts: [], keys: [[0, salsaA], [1, mir(salsaA)]] },
    maracas: { beats: 1, parts: ['arms'], keys: [[0, maracaUp], [0.5, maracaDn]] },
    knees: { beats: 1, parts: [], torso: true, keys: [[0, kneesA]] },
    latinFlow: { beats: 2, parts: ['arms'], keys: [[0, flowA], [1, mir(flowA)]] },
    latinCrossUp: { beats: 1, parts: ['arms'], keys: [[0, crossUp]] },
    latinOneUp: { beats: 2, parts: ['arms'], keys: [[0, oneUpA], [1, mir(oneUpA)]] },
    latinHairBrush: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, brush0], [0.5, brush1], [1, brush2], [1.5, brush3]] },
    latinSnake: { beats: 2, parts: ['arms'], keys: [[0, snakeA], [1, mir(snakeA)]] },
    latinFrame: { beats: 2, parts: [], keys: [[0, frameA], [1, { ...frameA, shR: 0, shL: 0.35 }]] },
    latinSideClap: { beats: 2, parts: ['arms'], keys: [[0, sideClapA], [0.5, sideClapOpen], [1, mir(sideClapA)], [1.5, mir(sideClapOpen)]] },
    latinLowPump: { beats: 2, parts: ['arms'], keys: [[0, pumpLowA], [1, mir(pumpLowA)]] },
    latinOpenBreak: { beats: 4, parts: ['arms'], keys: [[0, openWide], [1, openWide], [2, salsaA], [3, mir(salsaA)]] },
    latinSwingSide: { beats: 4, parts: [], mirror: true, keys: [[0, swingSideA], [1, swingSideA], [2, salsaA], [3, mir(salsaA)]] },
    chaChaArm: { beats: 4, parts: ['arms'], mirror: true, keys: [[0, salsaA], [1, mir(salsaA)], [2, chaArmOut], [3, chaArmOut]] },
    latinTurnHand: { beats: 4, parts: ['arms'], mirror: true, keys: [[0, salsaA], [1, mir(salsaA)], [2, turnHandUp], [3, turnHandUp]] },
    latinSkirtTurn: { beats: 4, parts: ['arms'], keys: [[0, flowA], [1, mir(flowA)], [2, skirtSpread], [3, skirtSpread]] },
    suzyArms: { beats: 2, parts: ['arms'], keys: [[0, mir(wipeA)], [1, wipeA]] },
    sambaArms: { beats: 2, parts: ['arms'], keys: [[0, sambaArmA], [1, mir(sambaArmA)]] },
    sambaWhiskArms: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, whiskA], [1, { ...whiskA, r: at(1, 0.3, 0.9, 0.08, [0.6, -0.3, -0.3]) }]] },
    congaArms: { beats: 1, parts: [], keys: [[0, congaHands]] },
    bachataArms: { beats: 4, parts: ['arms'], mirror: true, keys: [[0, bachLow], [2, bachLow], [3, bachFlick]] },
    latinSlide: { beats: 4, parts: [], torso: true, keys: [[0, slideTop], [1.5, slideLow], [2, slideLow]] },
    sambaFogoArms: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, fogoA], [1, { ...fogoA, r: at(1, 0.2, 0.86, 0.2, [0.8, -1, -0.2]) }]] },
    cucarachaArms: { beats: 2, parts: ['arms'], keys: [[0, cucaOpen], [1, cucaCross]] },
    sambaDrum: { beats: 2, parts: ['arms'], keys: [[0, drumA], [0.5, { ...drumA, r: at(1, 0.24, 0.86, 0.16, [1, -0.3, -0.2]), l: at(-1, -0.12, 0.7, 0.2, [0.8, -1, -0.2]) }], [1, mir(drumA)], [1.5, mir({ ...drumA, r: at(1, 0.24, 0.86, 0.16, [1, -0.3, -0.2]), l: at(-1, -0.12, 0.7, 0.2, [0.8, -1, -0.2]) })]] },
    folkFaldeo: { beats: 2, parts: ['arms'], keys: [[0, faldeoA], [1, mir(faldeoA)]] },
    cumbiaMachete: { beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true, keys: [[0, macheteUp], [1, macheteDown]] },
    latinFan: { beats: 4, parts: ['arms'], mirror: true, keys: [[0, fanA], [0.5, fanB], [1, fanA], [1.5, fanB], [2, fanA], [2.5, fanB], [3, fanA], [3.5, fanB]] },
    bachataBelly: { beats: 4, parts: ['arms'], mirror: true, keys: [[0, bellyA], [2, bellyA], [3, bellyTap]] },
    flamencoArms: { beats: 4, parts: ['arms', 'torso'], mirror: true, torso: true, keys: [[0, flamA], [1, flamB], [2, flamA], [3, flamB]] },
    flamencoPalmas: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, palmaA], [0.5, palmaOpen], [1, palmaA], [1.5, palmaOpen]] },
    flamencoRound: { beats: 2, parts: ['arms'], keys: [[0, roundUp], [1, { ...roundUp, handR: 1, handL: 1 }]] },
    pasoCape: { beats: 4, parts: ['arms'], keys: [[0, capeLow], [1, capeUp], [2, mir(capeLow)], [3, capeUp]] },
    cumbiaCandle: { beats: 4, parts: [], mirror: true, keys: [[0, candleA], [2, { ...candleA, r: at(1, 0.22, 0.98, 0.09, [1, -0.6, -0.2]) }]] },
    sambaCarnival: { beats: 2, parts: ['arms'], keys: [[0, carnivalA], [1, mir(carnivalA)]] },
    mamboArms: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, mamboPush], [1, mamboPull]] },
  },
};

export const moves: MoveDef[] = [
  // Hip isolations, each with its own arm styling
  combo('hip-sway', 'Hip Sway', 'hipSway', 'latinFlow', 'low', 1, 'latin pop | hips | hips', { desc: 'Sway the hips side to side while the arms float toward the hip that rises.' }),
  combo('latin-sway', 'Latin Sway', 'hipSway', 'salsaArms', 'low', 1, 'latin | hips | hips'),
  combo('hip-shake', 'Hip Shake', 'hipShake', 'hips', 'mid', 2, 'latin pop hiphop | hips | hips shake'),
  combo('maraca-shake', 'Maraca Shake', 'hipShake', 'maracas', 'mid', 2, 'latin | hips | shake hands'),
  combo('hip-circle', 'Hip Circle', 'hipCircle', 'latinCrossUp', 'mid', 2, 'latin pop | hips | hips', { desc: 'Circle the hips right, back, left, forward with the wrists crossed overhead.' }),
  combo('figure-eight', 'Figure Eight Hips', 'hipEight', 'latinSnake', 'mid', 2, 'latin | hips arms | hips', { desc: 'Trace a figure eight with the hips while both arms float out at shoulder height, wrists waving.' }),
  combo('hip-pop', 'Hip Pop', 'hipPop', 'latinOneUp', 'low', 1, 'latin pop funk | hips | hips', { desc: 'Pop one hip up and throw the same arm up overhead, other fist on the hip; alternate.' }),
  combo('hip-drop', 'Hip Drop', 'hipDrop', 'latinHairBrush', 'mid', 2, 'latin hiphop | hips arms | hips', { desc: 'Drop one hip with the heel lifted while that hand brushes back over the hair.' }),
  combo('fan-shake', 'Fan Shake', 'hipShake', 'latinFan', 'mid', 2, 'latin | hips arms | hips shake hands', { desc: 'Quick hip shake with one hand fanning beside the face and the other fist on the hip.' }),
  combo('shake-it-down', 'Shake It Down', 'hipShakeDown', 'latinSlide', 'mid', 2, 'latin pop | hips legs | hips shake', { desc: 'Keep the hips shaking while sinking into a low wide squat over two beats, then shake back up; the hands slide down the thighs and back.' }),
  combo('booty-shake', 'Booty Shake', 'booty', 'knees', 'mid', 2, 'hiphop latin | hips | shake hips'),
  // Merengue
  combo('merengue', 'Merengue March', 'merengue', 'latinFrame', 'low', 1, 'latin | hips | hips walk', { desc: 'March in place dropping the hip of the lifted foot, arms held in a dance frame.' }),
  combo('merengue-clap', 'Merengue Side Clap', 'merengue', 'latinSideClap', 'low', 2, 'latin | hips arms | clap walk', { desc: 'Merengue march clapping beside one shoulder, then the other.' }),
  combo('merengue-turn', 'Merengue Turn', 'merengueTurn', 'latinFrame', 'low', 2, 'latin | turn hips | spin walk', { desc: 'Keep the merengue march going while turning a quarter each beat.' }),
  // Reggaeton
  combo('reggaeton-bounce', 'Reggaeton Bounce', 'dembow', 'latinLowPump', 'low', 1, 'latin hiphop | hips | hips', { desc: 'Dembow knee bounce with the hips, one fist pulling down as the other comes up to the chest.' }),
  combo('reggaeton-pump', 'Reggaeton Pump', 'dembow', 'fistPump', 'mid', 2, 'latin hiphop | full | punch'),
  // Salsa
  combo('salsa-basic', 'Salsa Basic', 'salsa', 'salsaArms', 'mid', 2, 'latin | legs hips | walk'),
  combo('salsa-back-basic', 'Salsa Back Basic', 'salsaBack', 'latinOpenBreak', 'mid', 2, 'latin | legs arms | walk', { desc: 'Break back on one foot with the arms opening wide, replace, close and pause.' }),
  combo('side-salsa', 'Side Salsa', 'salsaSide', 'latinSwingSide', 'mid', 2, 'latin | legs hips | walk', { desc: 'Salsa side basic: step out, replace, close, the arm on the stepping side opening out low.' }),
  combo('suzy-q', 'Suzy Q', 'salsaSuzyQ', 'suzyArms', 'mid', 2, 'latin | legs hips | twist', { desc: 'Cross one foot in front with a hip twist, step it back out wide; the hands wipe the other way.' }),
  combo('salsa-right-turn', 'Salsa Right Turn', 'salsaTurn', 'latinTurnHand', 'mid', 3, 'latin | turn legs | spin', { desc: 'Forward break and replace, then turn on 2-3 with one hand over the head.' }),
  // Cumbia, cha-cha, mambo
  combo('cumbia-step', 'Cumbia Step', 'cumbia', 'salsaArms', 'low', 1, 'latin | legs hips | walk'),
  combo('cha-cha', 'Cha-Cha', 'chaCha', 'chaChaArm', 'mid', 3, 'latin | legs hips | walk', { desc: 'Rock step, then cha-cha-cha in place with the arm opening out to the side.' }),
  combo('cha-cha-chasse', 'Cha-Cha Chassé', 'chaChasse', 'salsaArms', 'mid', 3, 'latin | legs hips | walk', { desc: 'Rock back, replace, then side-together-side travelling to the side.' }),
  combo('cucaracha', 'Cucaracha', 'cucaracha', 'cucarachaArms', 'low', 2, 'latin | legs hips | hips', { desc: 'Press out to the side with the hip, replace and close; arms open wide on the press and cross low on the return.' }),
  combo('mambo-rock', 'Mambo Rock', 'mambo', 'mamboArms', 'mid', 2, 'latin | legs arms |', { desc: 'Rock forward pushing both palms out, rock back pulling them in.' }),
  // Bachata
  combo('bachata-side', 'Bachata Side Step', 'bachataSide', 'bachataArms', 'low', 2, 'latin | legs hips | hips walk', { desc: 'Side, together, side, then tap the other foot with a hip pop; travel back the other way.' }),
  combo('bachata-basic', 'Bachata Forward Basic', 'bachataFwd', 'bachataBelly', 'low', 2, 'latin | legs hips | hips walk', { desc: 'Step forward, replace, close, then tap with a hip pop; one hand on the belly, the other arm out low and lifting on the tap.' }),
  // Samba
  combo('samba-basic', 'Samba Basic', 'sambaBasic', 'sambaArms', 'mid', 2, 'latin | legs arms |', { desc: 'Bouncy forward step and ball change, one arm swinging forward as the other opens low.' }),
  combo('samba-whisk', 'Samba Whisk', 'sambaWhisk', 'sambaWhiskArms', 'mid', 2, 'latin | legs arms |', { desc: 'Step to the side, cross the other foot behind on the ball, replace; the arm sweeps up on the step side.' }),
  // Conga
  combo('conga', 'Conga', 'conga', 'congaArms', 'low', 1, 'latin party | legs | walk kick', { desc: 'Three marching steps and a kick out to the side, hands forward on an imaginary partner\'s shoulders.' }),
  combo('merengue-side', 'Merengue Side Walk', 'merengueSide', 'latinFrame', 'low', 1, 'latin | legs hips | hips walk', { desc: 'Step to the side and close, the hip dropping with every step, arms in a dance frame.' }),
  combo('bota-fogo', 'Samba Bota Fogo', 'sambaFogo', 'sambaFogoArms', 'mid', 3, 'latin | legs arms | twist', { desc: 'Cross one foot in front with a twist, ball change, replace; the same-side arm reaches forward and up.' }),
  combo('samba-reggae-drum', 'Samba-Reggae Drum', 'sambaReggae', 'sambaDrum', 'high', 2, 'latin party | full | stomp', { desc: 'Wide bouncing side sway while beating an imaginary drum at the hip, one stick high, one striking.' }),
  combo('samba-no-pe', 'Samba No Pé', 'sambaNoPe', 'sambaCarnival', 'high', 3, 'latin | legs arms |', { desc: 'Fast carnival samba on the balls of the feet, arms high and wide, one then the other higher.' }),
  // Cumbia (candle)
  combo('cumbia-machete', 'Cumbia Machete', 'cumbia', 'cumbiaMachete', 'mid', 2, 'latin | arms legs |', { desc: 'Cumbia step back and replace cocking one hand beside the head, elbow high, and chopping it down across the body like a machete.' }),
  combo('cumbia-sau', 'Cumbia Sau', 'cumbiaSau', 'hips', 'low', 1, 'latin | legs hips | walk', { desc: 'Step out wide with a knee bend and drag the other foot in along the floor, hands on hips; travel and come back.' }),
  combo('cumbia-candle', 'Cumbia Candle Step', 'cumbia', 'cumbiaCandle', 'low', 2, 'latin | legs arms | walk', { desc: 'Cumbia step back and replace, one hand holding a candle up by the shoulder, the other spreading the skirt.' }),
  // Flamenco and paso doble
  combo('flamenco-arms', 'Flamenco Arms', 'flamencoStamp', 'flamencoArms', 'mid', 2, 'latin | arms legs | stomp hands', { desc: 'Stamp the feet in place, one arm rounded overhead and the other low, wrists circling; swap arms every bar.' }),
  combo('flamenco-palmas', 'Flamenco Palmas', 'flamencoStamp', 'flamencoPalmas', 'mid', 2, 'latin | arms legs | clap stomp', { desc: 'Stamp the feet and clap up beside the head, one side then the other.' }),
  combo('flamenco-turn', 'Flamenco Turn', 'flamencoTurn', 'flamencoRound', 'mid', 2, 'latin | turn | spin stomp', { desc: 'Stamp a slow full turn, a quarter each beat, with both arms rounded overhead.' }),
  combo('paso-doble-cape', 'Paso Doble Cape', 'pasoAppel', 'pasoCape', 'mid', 2, 'latin | arms legs | stomp', { desc: 'Stamp into a proud wide stance and sweep an imaginary cape from one hip, overhead, to the other.' }),
  combo('folklorico-skirt', 'Folklórico Skirt', 'folkHeel', 'folkFaldeo', 'mid', 2, 'latin | arms legs | stomp', { desc: 'Quick heel taps in front while both hands hold a wide skirt and sweep it high on one side, low on the other.' }),
  // Turns
  combo('sway-spin', 'Sway & Spin', 'spinSway', 'latinSkirtTurn', 'mid', 3, 'latin pop | turn hips | spin hips', { desc: 'Two hip sways with flowing arms, then a full turn with the arms spread low.' }),
  combo('turn-shake', 'Turn & Shake', 'backShake', 'hips', 'mid', 3, 'latin hiphop pop | turn hips | spin shake hips'),
];

// ---------------------------------------------------------------------------
// Hand-authored moves (feet, arms and turn tied together)

const SPOT_IN: PoseSpec = { r: at(1, 0.06, 0.72, 0.17, [0.8, -1, -0.3]), l: at(-1, -0.06, 0.72, 0.17, [0.8, -1, -0.3]), handR: 0.6, handL: 0.6 };
const SPOT_OUT: PoseSpec = { r: at(1, 0.42, 0.86, 0.05, [0.3, -1, 0]), l: at(-1, -0.42, 0.86, 0.05, [0.3, -1, 0]), ...OPEN };
const TURN_FEET: PoseSpec = { rf: [0.055, 0, 0], lf: [-0.055, 0, 0] };

moves.push(
  // Cha-cha spot turn: a full turn on 1-2, then cha-cha-cha in place with the arms opening.
  full({
    id: 'cha-cha-spot-turn', name: 'Cha-Cha Spot Turn', tags: 'latin | turn legs | spin', beats: 4, level: 'mid', d: 3, parts: ['turn', 'legs', 'arms'], mirror: true,
    desc: 'Turn all the way round on the spot over two beats, then cha-cha-cha in place throwing the arms open.',
    keys: [
      [0, { ...TURN_FEET, ...SPOT_IN, y: -0.045, spin: 0 }],
      [0.5, { ...TURN_FEET, ...SPOT_IN, y: -0.02, spin: 100 }],
      [1, { ...TURN_FEET, ...SPOT_IN, y: -0.025, spin: 200 }],
      [1.5, { ...TURN_FEET, ...SPOT_IN, y: -0.02, spin: 300 }],
      [2, { rf: [0.12, 0, 0], lf: [-0.07, 0, 0], ...SPOT_OUT, y: -0.04, hips: 0.035, tilt: 4, spin: 0 }],
      [2.5, { rf: [0.12, 0, 0], lf: [0.01, 0, 0], ...SPOT_OUT, y: -0.035, hips: -0.03, tilt: -3, spin: 0 }],
      [3, { rf: [0.15, 0, 0], lf: [0.01, 0, 0], ...SPOT_OUT, y: -0.045, hips: 0.04, tilt: 4, spin: 0 }],
    ],
  }),
  // New Yorker: open to a quarter profile stepping across, free arm out to the side; back to face front for the cha-cha-cha.
  full({
    id: 'new-yorker', name: 'New Yorker', tags: 'latin | legs arms |', beats: 4, level: 'mid', d: 3, parts: ['legs', 'arms'], mirror: true,
    desc: 'Open to the side stepping the far foot across with the near arm flung out, rock back, then cha-cha-cha facing front.',
    keys: [
      [0, { spin: 35, lf: [-0.04, 0, 0.13], rf: [0.09, 0, 0], y: -0.04, hips: -0.03, r: at(1, 0.44, 0.84, 0.02, [0.3, -1, 0]), l: at(-1, -0.1, 0.64, 0.2, [0.7, -1, -0.4]), handR: 1, handL: 0.7 }],
      [1, { spin: 20, lf: [-0.06, 0, 0.1], rf: [0.09, 0, 0], y: -0.03, hips: 0.035, tilt: 4, r: at(1, 0.4, 0.74, 0.06, [0.3, -1, 0]), l: at(-1, -0.12, 0.64, 0.2, [0.7, -1, -0.4]), handR: 1, handL: 0.7 }],
      [2, { spin: 0, lf: [-0.09, 0, 0], rf: [0.07, 0, 0], y: -0.04, hips: -0.035, tilt: -4, ...salsaA }],
      [2.5, { spin: 0, lf: [-0.04, 0, 0], rf: [0.07, 0, 0], y: -0.035, hips: 0.03, tilt: 3, ...salsaA }],
      [3, { spin: 0, lf: [-0.04, 0, 0], rf: [0.1, 0, 0], y: -0.045, hips: -0.035, tilt: -4, ...mir(salsaA) }],
    ],
  }),
);
