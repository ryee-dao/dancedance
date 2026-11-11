/**
 * Rock: stomp-clap, power stance fist pumps, gentle headbang (nod-level, never
 * whiplash), windmill, air guitar, jump around.
 */

import { ARM, at, type PoseSpec } from '../poseKit';
import { combo, type MoveDef, type PatternSet } from '../catalog';

const pumpUp: PoseSpec = { nod: -8, r: [166, 8, 172, 8], l: ARM.hip, handR: 0, handL: 0 };
const pumpDn: PoseSpec = { nod: 2, r: at(1, 0.2, 1.0, 0.06, [1, -0.2, -0.3]), l: ARM.hip, handR: 0, handL: 0 };
const pumpOff: PoseSpec = { r: at(1, 0.17, 0.83, 0.12, [1, -0.6, -0.3]), l: at(-1, -0.17, 0.75, 0.1, [1, -0.4, -0.3]), handR: 0, handL: 0 };
const guitarA = (dy: number): PoseSpec => ({
  bend: 6, twist: 10, lean: -4,
  l: at(-1, -0.36, 0.86, 0.17, [0.3, -1, 0]),
  r: at(1, 0.06, 0.63 + dy, 0.18, [0.8, -0.6, -0.4]),
  handL: 0.2, handR: 0,
});

export const patterns: PatternSet = {
  foot: {
    stomp: {
      beats: 2, parts: ['legs'], mirror: true, impact: true, torso: true,
      keys: [
        [0, { y: -0.075, rf: [0.15, 0, 0.02], lf: [-0.12, 0, 0], bend: 7, nod: 9 }],
        [1, { y: -0.03, rf: [0.14, 0.11, 0.06], lf: [-0.12, 0, 0], bend: 0, nod: -2 }],
      ],
    },
    powerStance: {
      beats: 1, parts: ['legs'],
      keys: [[0, { y: -0.1, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.12, kneeL: 0.12 }], [0.5, { y: -0.055, rf: [0.2, 0, 0], lf: [-0.2, 0, 0] }]],
    },
    jumpAround: {
      beats: 2, parts: ['jump', 'legs'], jump: true,
      keys: [
        [0, { y: -0.08, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], bend: 6 }],
        [0.5, { y: 0.09, x: 0.03, rf: [0.12, 0.04, 0], lf: [-0.12, 0.05, 0] }],
        [1, { y: -0.08, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], bend: 6 }],
        [1.5, { y: 0.09, x: -0.03, rf: [0.12, 0.05, 0], lf: [-0.12, 0.04, 0] }],
      ],
    },
  },
  arms: {
    fistPump: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, pumpUp], [0.5, pumpDn], [1, pumpUp], [1.5, pumpOff]] },
    windmill: {
      beats: 2, parts: ['arms'], mirror: true,
      keys: [
        [0, { r: [24, 0, 26, 0], l: ARM.hip, handR: 0, handL: 0 }],
        [0.5, { r: [104, 0, 106, 0], l: ARM.hip, handR: 0, handL: 0 }],
        [1, { r: [176, 0, 178, 0], l: ARM.hip, handR: 0, handL: 0, nod: -6 }],
        [1.5, { r: [108, 135, 110, 140], l: ARM.hip, handR: 0, handL: 0 }],
      ],
    },
    airGuitar: { beats: 1, parts: ['arms'], torso: true, keys: [[0, guitarA(0.04)], [0.5, guitarA(-0.04)]] },
  },
  accent: {
    headBang: { beats: 1, parts: [], keys: [[0, { nod: 16, bend: 4 }], [0.5, { nod: -6, bend: 0 }]] },
  },
};

export const moves: MoveDef[] = [
  combo('stomp-clap', 'Stomp Clap', 'stomp', 'clap', 'low', 1, 'rock | legs | stomp clap'),
  combo('stomp-punch', 'Stomp & Punch Up', 'stomp', 'skyPunch', 'mid', 2, 'rock | full | stomp punch'),
  combo('fist-pump', 'Fist Pump', 'powerStance', 'fistPump', 'mid', 1, 'rock | arms | punch'),
  combo('headbang', 'Headbang Bounce', 'powerStance', 'guard', 'low', 1, 'rock | full |', { accent: 'headBang' }),
  combo('windmill', 'Windmill', 'powerStance', 'windmill', 'mid', 2, 'rock | arms |'),
  combo('air-guitar', 'Air Guitar', 'powerStance', 'airGuitar', 'low', 1, 'rock | arms |'),
  combo('jump-around', 'Jump Around', 'jumpAround', 'fistPump', 'high', 2, 'rock hiphop | full | jump punch'),
];
