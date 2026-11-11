/**
 * Party: mime, sports and novelty moves (steering wheel, air drums, shopping
 * cart, basketball shot, ...). Simple, fun, readable from the front.
 */

import { at, type PoseSpec } from '../poseKit';
import { combo, type MoveDef, type PatternSet } from '../catalog';

/** Hands on a steering wheel in front of the chest, turned by `a` degrees. */
const wheel = (a: number): PoseSpec => {
  const r = 0.12, cy = 0.66, cz = 0.22;
  const t = (a * Math.PI) / 180;
  // Hands at 10 and 2 o'clock, rotated together.
  const ar = Math.PI / 6 - t, al = Math.PI - Math.PI / 6 - t;
  return {
    r: at(1, r * Math.cos(ar), cy + r * Math.sin(ar), cz, [0.8, -1, -0.2]),
    l: at(-1, r * Math.cos(al), cy + r * Math.sin(al), cz, [0.8, -1, -0.2]),
    handR: 0, handL: 0,
    lean: a * 0.12,
  };
};

export const patterns: PatternSet = {
  arms: {
    steer: { beats: 2, parts: ['arms'], torso: true, keys: [[0, wheel(55)], [1, wheel(-55)]] },
  },
};

export const moves: MoveDef[] = [
  combo('the-drive', 'Steering Wheel', 'bounce', 'steer', 'low', 1, 'party pop | arms |', {
    desc: 'Bounce on the spot with both hands on an imaginary steering wheel, turning it left and right.',
  }),
];
