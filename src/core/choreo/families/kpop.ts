/** K-pop point moves: the gallop (horse-riding step), lasso, point steps. */

import { ARM, at, type PoseSpec } from '../poseKit';
import { combo, type MoveDef, type PatternSet } from '../catalog';
import { mir } from '../poseKit';

const gallopA: PoseSpec = { y: -0.07, x: 0.02, hips: 0.02, rf: [0.15, 0, 0], lf: [-0.15, 0.05, 0.02], bend: 5 };
const gallopB: PoseSpec = { y: -0.03, x: 0.02, hips: 0.02, rf: [0.15, 0.02, 0], lf: [-0.15, 0.0, 0.0], bend: 3 };
const reinsAt = (y: number): PoseSpec => ({
  r: at(1, -0.025, y, 0.21, [0.7, -1, -0.2]),
  l: at(-1, 0.025, y - 0.015, 0.23, [0.7, -1, -0.2]),
  handR: 0, handL: 0,
});
const lasso = (k: number): PoseSpec => ({ r: [162, 0, 150, k * 90], l: ARM.hip, handR: 0, handL: 0, nod: -4 });
const pointFwdA: PoseSpec = { turn: 10, nod: -4, r: [122, 58, 122, 58], l: ARM.guard, handR: 0, handL: 0 };

export const patterns: PatternSet = {
  foot: {
    gallop: { beats: 2, parts: ['legs'], keys: [[0, gallopA], [0.5, gallopB], [1, mir(gallopA)], [1.5, mir(gallopB)]] },
  },
  arms: {
    reins: { beats: 1, parts: ['arms'], keys: [[0, reinsAt(0.6)], [0.5, reinsAt(0.65)]] },
    lasso: { beats: 2, parts: ['arms'], mirror: true, keys: [[0, lasso(0)], [0.5, lasso(1)], [1, lasso(2)], [1.5, lasso(3)]] },
    pointFwd: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, pointFwdA], [1, { r: ARM.guard, l: ARM.guard, handR: 0, handL: 0 }]] },
  },
};

export const moves: MoveDef[] = [
  combo('gallop', 'Gallop', 'gallop', 'reins', 'mid', 2, 'kpop pop | full |', { desc: 'Bouncing wide stance, wrists crossed like holding reins, shuffling side to side.' }),
  combo('gallop-lasso', 'Gallop Lasso', 'gallop', 'lasso', 'mid', 2, 'kpop pop | full |'),
  combo('lasso', 'Lasso', 'sway', 'lasso', 'mid', 2, 'hiphop pop kpop | arms |'),
  combo('point-step', 'Point Step', 'stepTouch', 'pointFwd', 'mid', 2, 'kpop pop | arms | point'),
  combo('toe-tap-point', 'Toe Tap Point', 'toeTap', 'pointFwd', 'mid', 2, 'kpop | legs arms | point'),
];
