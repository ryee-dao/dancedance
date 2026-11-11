/** Funk / soul / sharp pop: rock step, kick ball change, heel swivel, knee pop, robot. */

import { at, type PoseSpec } from '../poseKit';
import { combo, type MoveDef, type PatternSet } from '../catalog';

const wingsOut: PoseSpec = { r: at(1, 0.13, 0.8, 0.07, [1, 0.25, -0.2]), l: at(-1, -0.13, 0.8, 0.07, [1, 0.25, -0.2]), handR: 0, handL: 0 };
const wingsIn: PoseSpec = { r: at(1, 0.15, 0.78, 0.09, [0.3, -1, -0.3]), l: at(-1, -0.15, 0.78, 0.09, [0.3, -1, -0.3]), handR: 0, handL: 0 };
const snapA: PoseSpec = { r: [24, 30, 70, 70], l: [24, 30, 70, 70], handR: 0, handL: 0, nod: 4 };
const snapB: PoseSpec = { r: [20, 25, 58, 70], l: [20, 25, 58, 70], handR: 1, handL: 1 };
const robotA: PoseSpec = { turn: 16, r: [88, 0, 176, 4], l: [86, 0, 6, 0], handR: 1, handL: 1 };
const robotB: PoseSpec = { turn: -16, r: [86, 0, 6, 0], l: [88, 0, 176, 4], handR: 1, handL: 1 };

export const patterns: PatternSet = {
  foot: {
    kneeKnock: {
      beats: 1, parts: ['legs'],
      keys: [[0, { y: -0.06, kneeR: -0.32, kneeL: -0.32, rf: [0.11, 0, 0], lf: [-0.11, 0, 0] }], [0.5, { y: -0.035, kneeR: 0.3, kneeL: 0.3, rf: [0.11, 0, 0], lf: [-0.11, 0, 0] }]],
    },
    rockBack: {
      beats: 2, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { rf: [0.11, 0, -0.14], y: -0.04, bend: 6, nod: 4, hips: 0.01 }],
        [1, { rf: [0.09, 0, 0], y: -0.015, bend: -1 }],
      ],
    },
    toeTap: {
      beats: 1, parts: ['legs'], mirror: true,
      keys: [[0, { rf: [0.13, 0, 0.11], y: -0.03, hips: -0.012 }], [0.5, { rf: [0.09, 0.01, 0.02], y: -0.012 }]],
    },
    kickBall: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { rf: [0.11, 0.14, 0.26], y: -0.005, x: -0.01, bend: -4 }],
        [1, { rf: [0.1, 0.035, -0.07], y: -0.03, x: 0.0 }],
        [1.5, { rf: [0.09, 0, 0], lf: [-0.09, 0.03, 0.02], y: -0.045 }],
      ],
    },
    heelSwivel: {
      beats: 2, parts: ['legs'],
      keys: [
        [0, { y: -0.045, kneeR: 0.6, kneeL: 0.6, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], hips: 0.012 }],
        [0.5, { y: -0.035, kneeR: -0.42, kneeL: -0.42, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], hips: -0.012 }],
        [1, { y: -0.045, kneeR: 0.6, kneeL: 0.6, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], hips: 0.012 }],
        [1.5, { y: -0.015, kneeR: 0.0, kneeL: 0.0, rf: [0.075, 0, 0], lf: [-0.075, 0, 0] }],
      ],
    },
    kneePop: {
      beats: 1, parts: ['legs', 'hips'], mirror: true,
      keys: [[0, { rf: [0.08, 0.035, 0.035], kneeR: -0.45, hips: -0.03, tilt: -4, y: -0.03 }], [0.5, { y: -0.012, kneeR: 0 }]],
    },
  },
  arms: {
    wings: { beats: 1, parts: ['arms'], keys: [[0, wingsOut], [0.5, wingsIn]] },
    snaps: { beats: 1, parts: [], keys: [[0, snapA], [0.5, snapB]] },
    robot: { beats: 2, parts: ['arms'], torso: true, keys: [[0, robotA], [1, robotB]] },
  },
};

export const moves: MoveDef[] = [
  combo('funky-chicken', 'Funky Chicken', 'kneeKnock', 'wings', 'mid', 2, 'funk | full |'),
  combo('kick-ball-change', 'Kick Ball Change', 'kickBall', 'snaps', 'mid', 2, 'funk pop | legs | kick'),
  combo('heel-swivel', 'Heel Swivel', 'heelSwivel', 'jazzHands', 'mid', 2, 'funk pop | legs | twist'),
  combo('knee-pop', 'Knee Pop', 'kneePop', 'snaps', 'mid', 2, 'funk pop hiphop | legs hips |'),
  combo('kick-point', 'Side Kick & Point', 'kickSide', 'discoPoint', 'mid', 3, 'funk pop | full | kick point'),
  combo('rock-step-clap', 'Rock Step Clap', 'rockBack', 'clap', 'low', 1, 'funk pop rock | legs | clap'),
  combo('toe-tap', 'Toe Tap Snap', 'toeTap', 'snaps', 'low', 1, 'funk pop | legs | hands'),
  combo('the-robot', 'The Robot', 'plant', 'robot', 'mid', 2, 'funk pop kpop | arms |'),
];
