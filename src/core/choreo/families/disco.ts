/** Disco: the bump, disco point, rolling hands, hustle, shimmies. */

import { ARM, CHEST_BOX, W, at, mir, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';

const hipA: PoseSpec = { hips: 0.055, y: -0.025, lf: [-0.085, 0.025, 0.02], head: -4 };
const rollAt = (k: number): PoseSpec => {
  const a = (k * Math.PI) / 2;
  const r = 0.055;
  return {
    r: at(1, r * Math.cos(a), 0.68 + r * Math.sin(a), 0.2, [0.8, -1, -0.3]),
    l: at(-1, -r * Math.cos(a), 0.68 - r * Math.sin(a), 0.2, [0.8, -1, -0.3]),
    handR: 0, handL: 0,
  };
};
const shimmyArms = (s: number): PoseSpec => ({
  twist: 11 * s, shR: s > 0 ? 0.55 : 0, shL: s < 0 ? 0.55 : 0, lean: 1.5 * s,
  r: [48, 25, 70, 45], l: [48, 25, 70, 45], handR: 1, handL: 1,
});
const shimmyKey = (s: number, low: number): PoseSpec => ({
  y: -0.07 - (s < 0 ? 0.01 : 0), twist: 14 * s, shR: s > 0 ? 0.4 : 0, shL: s < 0 ? 0.4 : 0, lean: 2 * s,
  r: [low, 10, low + 8, 30], l: [low, 10, low + 8, 30], rf: [0.13, 0, 0], lf: [-0.13, 0, 0], handR: 1, handL: 1,
});

export const patterns: PatternSet = {
  foot: {
    hipBump: { beats: 2, parts: ['hips'], torso: true, keys: [[0, hipA], [1, mir(hipA)]] },
    backTap: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: 0.05, hips: 0.02, rf: [0.21, 0, 0], lf: [-W, 0, 0] }],
        [1, { x: 0.06, y: -0.035, twist: -6, rf: [0.21, 0, 0], lf: [0.05, 0.02, -0.11] }],
      ],
    },
  },
  arms: {
    rollingHands: { beats: 2, parts: ['arms'], keys: [[0, rollAt(0)], [0.5, rollAt(1)], [1, rollAt(2)], [1.5, rollAt(3)]] },
    discoPoint: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { head: 8, turn: 10, nod: -8, r: [142, 12, 144, 12], l: ARM.hip, handR: 0, handL: 0 }],
        [1, { head: -6, turn: -10, nod: 8, r: [48, 125, 44, 150], l: ARM.hip, handR: 0, handL: 0 }],
      ],
    },
    hitchhike: {
      beats: 2, parts: ['arms'], mirror: true, torso: true,
      keys: [
        [0, { turn: 14, head: 4, r: [62, 0, 98, 8], l: ARM.hip, handR: 0, handL: 0 }],
        [1, { r: CHEST_BOX, l: ARM.hip, handR: 0, handL: 0 }],
      ],
    },
    shoulderShimmy: { beats: 1, parts: ['torso'], torso: true, keys: [[0, shimmyArms(1)], [0.5, shimmyArms(-1)]] },
  },
};

export const moves: MoveDef[] = [
  combo('hip-bump', 'Hip Bump', 'hipBump', 'hips', 'low', 1, 'disco latin pop | hips | hips'),
  combo('bump-clap', 'Hip Bump Clap', 'hipBump', 'clap', 'low', 2, 'disco pop | hips | hips clap'),
  combo('disco-point', 'Disco Point', 'sway', 'discoPoint', 'mid', 2, 'disco | arms | point'),
  combo('hitchhike', 'Hitchhike', 'tapSide', 'hitchhike', 'mid', 2, 'disco funk | arms | point'),
  combo('rolling-hands', 'Rolling Hands', 'bounce', 'rollingHands', 'low', 1, 'disco | arms | hands'),
  combo('rolling-step', 'Rolling Step Touch', 'stepTouch', 'rollingHands', 'low', 2, 'disco | arms legs | hands walk'),
  combo('hustle-tap', 'Hustle Tap', 'backTap', 'rollingHands', 'mid', 2, 'disco | legs arms | hands'),
  combo('bump-point', 'Bump & Point', 'hipBump', 'discoPoint', 'mid', 2, 'disco | hips arms | hips point'),
  combo('disco-vine', 'Disco Vine', 'vine', 'discoPoint', 'mid', 3, 'disco | full | point walk'),
  combo('chest-slide', 'Chest Slide', 'groove', 'snaps', 'mid', 2, 'funk kpop disco | full |', { accent: 'chestIso' }),
  combo('shoulder-shimmy', 'Shoulder Shimmy', 'groove', 'shoulderShimmy', 'mid', 2, 'disco latin funk | full | shake'),
  combo('disco-spin', 'Disco Spin', 'spin', 'turnUp', 'mid', 3, 'disco pop | turn | spin point'),
  full({
    id: 'shimmy', name: 'Shimmy', tags: 'disco funk latin | full | shake', beats: 2, level: 'mid', d: 2, parts: ['torso'],
    keys: [[0, shimmyKey(1, 62)], [0.5, shimmyKey(-1, 62)], [1, shimmyKey(1, 58)], [1.5, shimmyKey(-1, 58)]],
  }),
];
