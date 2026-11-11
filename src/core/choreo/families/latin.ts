/**
 * Latin / dance-fitness: hip isolations (sway, shake, circle, figure eight,
 * pop, drop), merengue, reggaeton, salsa, cumbia, cha-cha, mambo.
 *
 * Hip channels: `hips` = lateral pelvis shift (units), `tilt` = pelvis roll
 * (deg, + = user's right hip up), `hipTwist` = pelvis yaw, `kneeR/kneeL` =
 * knee turn-out (+ out, - in). A hip goes UP on the side it shifts to.
 */

import { at, mir, wide, type PoseSpec } from '../poseKit';
import { combo, type MoveDef, type PatternSet } from '../catalog';
import { hand } from '../../coach/poses';

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

const salsaA: PoseSpec = { r: at(1, 0.23, 0.62, 0.15, [0.7, -1, -0.5]), l: at(-1, -0.19, 0.6, 0.17, [0.7, -1, -0.5]), handR: 0.7, handL: 0.7, twist: -5 };
const maracaUp: PoseSpec = { r: at(1, 0.2, 0.95, 0.17, [0.8, -1, -0.2]), l: at(-1, -0.2, 0.95, 0.17, [0.8, -1, -0.2]), handR: 0.15, handL: 0.15 };
const maracaDn: PoseSpec = { r: at(1, 0.21, 0.9, 0.18, [0.8, -1, -0.2]), l: at(-1, -0.21, 0.9, 0.18, [0.8, -1, -0.2]), handR: 0.15, handL: 0.15 };
const kneesA: PoseSpec = { bend: 24, nod: -14, r: hand(0.03, -0.29, 0.03, [1, 0.2, -0.3]), l: hand(0.03, -0.29, 0.03, [1, 0.2, -0.3]), handR: 1, handL: 1 };

export const patterns: PatternSet = {
  foot: {
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
    merengue: { beats: 2, parts: ['hips'], keys: [[0, merengueA], [1, mir(merengueA)]] },
    dembow: { beats: 2, parts: ['hips', 'legs'], torso: true, keys: [[0, dembowA], [0.5, dembowUp], [1, mir(dembowA)], [1.5, mir(dembowUp)]] },
    salsa: {
      beats: 4, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { rf: [0.09, 0, 0.14], hips: 0.045, tilt: 4, y: -0.03, kneeL: -0.08 }],
        [1, { rf: [0.09, 0.0, 0.14], hips: -0.045, tilt: -4, y: -0.022, kneeR: -0.08 }],
        [2, { rf: [0.09, 0, 0], hips: 0.035, tilt: 3, y: -0.035 }],
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
    mambo: {
      beats: 2, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { rf: [0.09, 0, 0.15], hips: 0.03, tilt: 3, y: -0.03, bend: -4, nod: -3 }],
        [1, { rf: [0.1, 0, -0.11], hips: -0.02, tilt: -2, y: -0.035, bend: 5, nod: 3 }],
      ],
    },
  },
  arms: {
    salsaArms: { beats: 2, parts: [], keys: [[0, salsaA], [1, mir(salsaA)]] },
    maracas: { beats: 1, parts: ['arms'], keys: [[0, maracaUp], [0.5, maracaDn]] },
    knees: { beats: 1, parts: [], torso: true, keys: [[0, kneesA]] },
  },
};

export const moves: MoveDef[] = [
  combo('hip-sway', 'Hip Sway', 'hipSway', 'hips', 'low', 1, 'latin pop | hips | hips'),
  combo('latin-sway', 'Latin Sway', 'hipSway', 'salsaArms', 'low', 1, 'latin | hips | hips'),
  combo('hip-shake', 'Hip Shake', 'hipShake', 'hips', 'mid', 2, 'latin pop hiphop | hips | hips shake'),
  combo('maraca-shake', 'Maraca Shake', 'hipShake', 'maracas', 'mid', 2, 'latin | hips | shake hands'),
  combo('hip-circle', 'Hip Circle', 'hipCircle', 'hips', 'mid', 2, 'latin pop | hips | hips'),
  combo('figure-eight', 'Figure Eight Hips', 'hipEight', 'salsaArms', 'mid', 2, 'latin | hips | hips'),
  combo('hip-pop', 'Hip Pop', 'hipPop', 'hips', 'low', 1, 'funk pop latin | hips | hips'),
  combo('hip-pop-snap', 'Hip Pop & Snap', 'hipPop', 'snaps', 'mid', 2, 'funk pop | hips | hips hands'),
  combo('hip-drop', 'Hip Drop', 'hipDrop', 'hips', 'mid', 2, 'latin hiphop | hips | hips'),
  combo('merengue', 'Merengue March', 'merengue', 'salsaArms', 'low', 1, 'latin | hips | hips walk'),
  combo('merengue-clap', 'Merengue Clap', 'merengue', 'clapEvery', 'low', 2, 'latin | hips | clap walk'),
  combo('reggaeton-bounce', 'Reggaeton Bounce', 'dembow', 'rest', 'low', 1, 'latin hiphop | hips | hips'),
  combo('reggaeton-pump', 'Reggaeton Pump', 'dembow', 'fistPump', 'mid', 2, 'latin hiphop | full | punch'),
  combo('salsa-basic', 'Salsa Basic', 'salsa', 'salsaArms', 'mid', 2, 'latin | legs hips | walk'),
  combo('side-salsa', 'Side Salsa', 'salsaSide', 'salsaArms', 'mid', 2, 'latin | legs hips | walk'),
  combo('cumbia-step', 'Cumbia Step', 'cumbia', 'salsaArms', 'low', 1, 'latin | legs hips | walk'),
  combo('cha-cha', 'Cha-Cha', 'chaCha', 'salsaArms', 'mid', 3, 'latin | legs hips | walk'),
  combo('mambo-rock', 'Mambo Rock', 'mambo', 'salsaArms', 'mid', 2, 'latin | legs |'),
  combo('booty-shake', 'Booty Shake', 'booty', 'knees', 'mid', 2, 'hiphop latin | hips | shake hips'),
  combo('sway-spin', 'Sway & Spin', 'spinSway', 'turnArms', 'mid', 3, 'latin pop | turn hips | spin hips'),
  combo('turn-shake', 'Turn & Shake', 'backShake', 'hips', 'mid', 3, 'latin hiphop pop | turn hips | spin shake hips'),
];
