/** Cooldown stretches (the outro picks only these). */

import { ARM, hand } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const SOFT_DOWN = [22, 0, 26, 5] as const;

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  full({
    id: 'side-stretch', name: 'Side Stretch', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['torso', 'arms'], mirror: true, cooldown: true, bounce: 0.25,
    keys: [
      [0, { lean: -19, hips: 0.03, head: -6, r: [176, -20, 228, -15], l: ARM.hip, handR: 1 }],
      [2, { lean: -24, hips: 0.035, head: -8, y: -0.025, r: [178, -20, 236, -15], l: ARM.hip, handR: 1 }],
      [3, { lean: -5, r: [150, 0, 155, 0], l: [95, 0, 100, 0], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'big-breath', name: 'Big Breath', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], cooldown: true, bounce: 0.2, icon: 1,
    keys: [
      [0, { y: -0.04, nod: 6, r: [32, 0, 36, 0], l: [32, 0, 36, 0], handR: 1, handL: 1 }],
      [2, { y: 0.0, nod: -10, r: [168, 0, 174, 0], l: [168, 0, 174, 0], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'arm-hug', name: 'Arm Hug', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], mirror: true, cooldown: true, bounce: 0.2,
    keys: [
      [0, { twist: -6, head: 4, r: hand(-0.28, -0.04, 0.16, [0, -1, 0.5]), l: hand(-0.15, -0.07, 0.2, [0.3, -1, 0.2]), handR: 1, handL: 1 }],
      [2, { twist: -9, head: 6, y: -0.025, r: hand(-0.29, -0.04, 0.15, [0, -1, 0.5]), l: hand(-0.16, -0.07, 0.2, [0.3, -1, 0.2]), handR: 1, handL: 1 }],
      [3, { r: SOFT_DOWN, l: SOFT_DOWN }],
    ],
  }),
  full({
    id: 'neck-stretch', name: 'Neck Stretch', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['torso'], mirror: true, cooldown: true, bounce: 0.15,
    keys: [
      [0, { head: 24, r: [14, 0, 18, 20], l: ARM.hip, handL: 0 }],
      [2, { head: 28, nod: 4, y: -0.02, r: [16, 0, 20, 20], l: ARM.hip, handL: 0 }],
      [3, { head: 4, r: SOFT_DOWN, l: SOFT_DOWN }],
    ],
  }),
  full({
    id: 'reach-up', name: 'Overhead Reach', tags: 'aerobic | arms |', beats: 4, level: 'low', d: 1, parts: ['arms'], cooldown: true, bounce: 0.15,
    keys: [
      [0, { nod: -8, r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
      [2, { nod: -12, y: 0.0, shR: 0.5, shL: 0.5, r: [178, 0, 180, 0], l: [178, 0, 180, 0], handR: 1, handL: 1 }],
      [3, { y: -0.04, r: [70, 0, 74, 0], l: [70, 0, 74, 0], handR: 1, handL: 1 }],
    ],
  }),
];
