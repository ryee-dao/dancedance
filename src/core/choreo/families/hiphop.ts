/** Hip-hop / party: two-step, rock, dougie, floss, sprinkler, running man, cabbage patch. */

import { at, mir, wide, type PoseSpec } from '../poseKit';
import { combo, type MoveDef, type PatternSet } from '../catalog';

const rockA: PoseSpec = wide(-0.065, { x: 0.035, hips: 0.03, tilt: 3, lean: -3, head: 3 });
const flossA: PoseSpec = { r: [46, -60, 48, -60], l: [50, 118, 52, 124], handR: 0.3, handL: 0.3 };
const sprinklerAt = (pl: number): PoseSpec => ({
  turn: pl * 0.25 - 10,
  l: at(-1, -0.05, 0.97, -0.07, [1, 0.6, -0.2]),
  r: [92, pl, 94, pl],
  handL: 1, handR: 1,
});
const dougieA: PoseSpec = { lean: -7, head: 7, r: at(1, 0.13, 0.99, 0.05, [1, 0.5, -0.3]), l: [20, 20, 40, 50], handR: 1, handL: 0.5 };
const dougieB: PoseSpec = { lean: 4, head: -3, r: [40, 10, 46, 20], l: [20, 20, 40, 50], handR: 1, handL: 0.5 };
const Q = Math.PI / 2;
const circ = (cx: number, cy: number, cz: number, r: number, ph: number, side: 1 | -1) => at(side, cx + r * Math.cos(ph), cy + r * Math.sin(ph), cz, [0.6, -1, -0.3]);
const cabbage = (k: number): PoseSpec => ({
  r: circ(0.08, 0.68, 0.17, 0.085, -k * Q, 1),
  l: circ(-0.08, 0.68, 0.17, 0.085, -k * Q, -1),
  hips: 0,
  handR: 0, handL: 0,
});

export const patterns: PatternSet = {
  foot: {
    twoStep: {
      beats: 2, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { x: 0.045, y: -0.055, hips: 0.02, rf: [0.22, 0, 0], lean: -4, head: 3 }],
        [1, { x: 0.0, y: -0.02, rf: [0.09, 0, 0], lean: 1 }],
      ],
    },
    rock: { beats: 2, parts: ['hips'], torso: true, keys: [[0, rockA], [1, mir(rockA)]] },
    floss: {
      beats: 2, parts: ['hips'],
      keys: [[0, { hips: -0.05, tilt: -4, y: -0.03, lf: [-0.09, 0.02, 0.02] }], [1, { hips: 0.05, tilt: 4, y: -0.03, rf: [0.09, 0.02, 0.02] }]],
    },
    runningMan: {
      beats: 2, parts: ['legs', 'turn'],
      keys: [
        [0, { spin: 55, y: -0.03, rf: [0.07, 0.15, 0.1], lf: [-0.07, 0, -0.1], bend: 4 }],
        [0.5, { spin: 55, y: -0.07, rf: [0.07, 0, 0.03], lf: [-0.07, 0, 0.0] }],
        [1, { spin: 55, y: -0.03, rf: [0.07, 0, -0.1], lf: [-0.07, 0.15, 0.1], bend: 4 }],
        [1.5, { spin: 55, y: -0.07, rf: [0.07, 0, 0.0], lf: [-0.07, 0, 0.03] }],
      ],
    },
  },
  arms: {
    floss: { beats: 2, parts: ['arms'], keys: [[0, flossA], [1, mir(flossA)]] },
    sprinkler: {
      beats: 4, parts: ['arms'], torso: true,
      keys: [[0, sprinklerAt(80)], [1, sprinklerAt(50)], [2, sprinklerAt(20)], [3, sprinklerAt(-5)], [3.5, sprinklerAt(60)]],
    },
    dougie: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, dougieA], [1, dougieB]] },
    cabbage: { beats: 2, parts: ['arms'], keys: [[0, cabbage(0)], [0.5, cabbage(1)], [1, cabbage(2)], [1.5, cabbage(3)]] },
    raiseRoof: {
      beats: 1, parts: ['arms'],
      keys: [
        [0, { nod: -6, r: [148, 10, 172, 15], l: [148, 10, 172, 15], handR: 1, handL: 1 }],
        [0.5, { r: [80, 10, 160, 20], l: [80, 10, 160, 20], handR: 1, handL: 1 }],
      ],
    },
    shoulderBounce: { beats: 1, parts: ['torso'], keys: [[0, { shR: 1.3, shL: 1.3, nod: 6, r: [20, 10, 64, 75], l: [20, 10, 64, 75] }], [0.5, { r: [16, 10, 56, 75], l: [16, 10, 56, 75] }]] },
    shoulderRoll: {
      beats: 2, parts: ['torso'], mirror: true, torso: true,
      keys: [
        [0, { shR: 1, twist: -10, lean: -3, head: 4, r: [16, -10, 44, 75], l: [12, 10, 38, 70] }],
        [0.5, { shR: 0.7, twist: 6, lean: -1, head: 2, r: [14, -25, 40, 70], l: [12, 10, 38, 70] }],
        [1, { shR: 0, r: [12, 0, 36, 70], l: [12, 10, 38, 70] }],
      ],
    },
  },
};

export const moves: MoveDef[] = [
  combo('two-step', 'Two-Step', 'twoStep', 'snaps', 'low', 1, 'hiphop | legs | walk'),
  combo('side-rock', 'Side Rock', 'rock', 'rest', 'low', 1, 'hiphop rock | hips |'),
  combo('dougie', 'Dougie', 'sway', 'dougie', 'mid', 2, 'hiphop | arms |'),
  combo('floss', 'Floss', 'floss', 'floss', 'mid', 2, 'hiphop pop | full |'),
  combo('sprinkler', 'Sprinkler', 'bounce', 'sprinkler', 'mid', 2, 'hiphop pop | arms |'),
  combo('running-man', 'Running Man', 'runningMan', 'marchArms', 'mid', 3, 'hiphop pop | legs turn | walk'),
  combo('cabbage-patch', 'Cabbage Patch', 'sway', 'cabbage', 'mid', 2, 'hiphop funk | arms |'),
  combo('raise-the-roof', 'Raise the Roof', 'bounce', 'raiseRoof', 'low', 1, 'hiphop | arms | hands'),
  combo('shoulder-bounce', 'Shoulder Bounce', 'bounce', 'shoulderBounce', 'low', 1, 'hiphop kpop | full |'),
  combo('shoulder-roll', 'Shoulder Roll', 'bounce', 'shoulderRoll', 'low', 1, 'hiphop funk | full |'),
];
