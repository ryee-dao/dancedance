/**
 * Party: mime, sports, animal and novelty moves (steering wheel, jump shot,
 * golf swing, penguin waddle, lawnmower, shopping cart, ...). Simple, fun,
 * readable from the front, and each a different thing to copy.
 *
 * Most mimes are hand-authored full-body moves (`full`): the arms tell the
 * story and the legs must match. Asymmetric ones are written for the user's
 * right side (`mirror: true`) and alternate sides on repeat.
 */

import { ARM, at, mir, type ArmAngles, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';

type V3 = readonly [number, number, number];
/** Right / left hand at a WORLD position (x = screen x; the left hand's own side is negative x). */
const R = (x: number, y: number, z: number, e?: V3): ArmAngles => at(1, x, y, z, e);
const L = (x: number, y: number, z: number, e?: V3): ArmAngles => at(-1, x, y, z, e);
/** Elbow hints (arm's own frame: out, up, forward). */
const E_FRONT: V3 = [0.8, -1, -0.2]; // hands in front of the body, elbows out and down
const E_OUT: V3 = [1, 0, -0.2]; // elbow out to the side
const E_UP: V3 = [0.6, 0.6, -0.4]; // elbow out and up (hands overhead)
const E_BACK: V3 = [0.3, -0.3, -1]; // elbow back (pulling to the ribs)
const E_X: V3 = [0.1, -0.7, 1]; // arm reaching across the body: elbow down and forward, clear of the chest

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

const WIDE_F: PoseSpec = { rf: [0.14, 0, 0], lf: [-0.14, 0, 0] };

// Animal / character poses (written for the right side; mir() gives the left).
const penguinA: PoseSpec = {
  x: 0.03, lean: 9, hips: 0.03, tilt: 4, head: -6, kneeR: 0.22, kneeL: 0.22, rf: [0.08, 0, 0], lf: [-0.08, 0.045, 0.01],
  r: R(0.25, 0.5, 0.03, E_OUT), l: L(-0.25, 0.5, 0.03, E_OUT), handR: 1, handL: 1,
};
const TREX_R = R(0.15, 0.66, 0.2, [0.3, -1, -0.4]);
const TREX_L = L(-0.15, 0.66, 0.2, [0.3, -1, -0.4]);
const dinoA: PoseSpec = { x: 0.04, y: -0.12, lean: 6, bend: 6, turn: 14, rf: [0.18, 0, 0], lf: [-0.12, 0, 0], r: TREX_R, l: TREX_L, handR: 0.4, handL: 0.4 };
const dinoLift: PoseSpec = { x: 0.03, y: -0.06, lean: 3, bend: 4, rf: [0.15, 0, 0], lf: [-0.1, 0.12, 0.05], r: TREX_R, l: TREX_L, handR: 0.4, handL: 0.4 };
const zombieA: PoseSpec = {
  x: 0.03, y: -0.04, lean: 5, head: 14, nod: 6, rf: [0.15, 0, 0.02], lf: [-0.07, 0.01, -0.04],
  r: R(0.19, 0.8, 0.29, E_OUT), l: L(-0.19, 0.74, 0.29, E_OUT), handR: 0.5, handL: 0.5,
};
const puppetA: PoseSpec = {
  x: -0.02, lean: -5, head: 12, nod: 4, rf: [0.1, 0.15, 0.07],
  r: [132, 10, 26, 10], l: [14, 0, 10, 0], handR: 1, handL: 1,
};
const scarecrowA: PoseSpec = {
  x: 0.025, lean: 6, head: 18, hips: 0.02, kneeR: -0.25, kneeL: -0.25, rf: [0.09, 0, 0], lf: [-0.08, 0.04, 0.01],
  r: [86, 4, 8, 0], l: [92, 4, 14, 0], handR: 1, handL: 1,
};
const toyA: PoseSpec = { y: 0.0, turn: 20, rf: [0.09, 0.11, 0.17], r: [72, 40, 72, 40], l: [34, -50, 34, -50], handR: 0, handL: 0 };

export const patterns: PatternSet = {
  arms: {
    steer: { beats: 2, parts: ['arms'], torso: true, keys: [[0, wheel(55)], [1, wheel(-55)]] },
  },
};

export const moves: MoveDef[] = [
  // ---------------------------------------------------------------- Driving
  combo('the-drive', 'Steering Wheel', 'bounce', 'steer', 'low', 1, 'party pop | arms |', {
    desc: 'Bounce on the spot with both hands on an imaginary steering wheel, turning it left and right.',
  }),

  // ---------------------------------------------------------------- Ball sports
  full({
    id: 'jump-shot', name: 'Jump Shot', tags: 'party | full | jump sport', beats: 4, level: 'high', d: 2, parts: ['jump', 'arms', 'legs'], jump: true,
    desc: 'Dribble twice low on your right, gather the ball to your chest in a dip, then jump and shoot it up high with a flick of the wrist.',
    keys: [
      [0, { ...WIDE_F, y: -0.07, bend: 6, r: R(0.22, 0.42, 0.17, E_OUT), l: L(-0.2, 0.62, 0.16, E_FRONT), handR: 1, handL: 1 }],
      [0.5, { ...WIDE_F, y: -0.04, bend: 4, r: R(0.22, 0.58, 0.17, E_OUT), l: L(-0.2, 0.62, 0.16, E_FRONT), handR: 1, handL: 1 }],
      [1, { ...WIDE_F, y: -0.07, bend: 6, r: R(0.22, 0.42, 0.17, E_OUT), l: L(-0.2, 0.62, 0.16, E_FRONT), handR: 1, handL: 1 }],
      [1.5, { ...WIDE_F, y: -0.04, bend: 4, r: R(0.22, 0.58, 0.17, E_OUT), l: L(-0.2, 0.62, 0.16, E_FRONT), handR: 1, handL: 1 }],
      [2, { rf: [0.11, 0, 0], lf: [-0.11, 0, 0], y: -0.15, bend: 10, nod: -4, r: R(0.06, 0.74, 0.2, E_FRONT), l: L(-0.06, 0.74, 0.2, E_FRONT), handR: 1, handL: 1 }],
      [3, { rf: [0.09, 0.05, 0], lf: [-0.09, 0.05, 0], y: 0.12, nod: -12, r: R(0.07, 1.1, 0.14, E_UP), l: L(-0.07, 1.04, 0.12, E_UP), handR: 0.6, handL: 1 }],
      [3.5, { rf: [0.12, 0, 0], lf: [-0.12, 0, 0], y: -0.08, nod: -6, r: R(0.1, 1.0, 0.24, E_UP), l: L(-0.16, 0.8, 0.14, E_OUT), handR: 0.3, handL: 1 }],
    ],
  }),
  full({
    id: 'crossover-dribble', name: 'Crossover Dribble', tags: 'party hiphop | arms legs | sport', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Low wide stance: bounce the ball once on your right, then cross it low in front of you to the other hand and keep going.',
    keys: [
      [0, { ...WIDE_F, y: -0.1, x: 0.03, lean: 3, bend: 8, r: R(0.24, 0.4, 0.16, E_OUT), l: L(-0.2, 0.62, 0.15, E_FRONT), handR: 1, handL: 1 }],
      [0.5, { ...WIDE_F, y: -0.07, x: 0.03, lean: 2, bend: 7, r: R(0.24, 0.56, 0.16, E_OUT), l: L(-0.2, 0.62, 0.15, E_FRONT), handR: 1, handL: 1 }],
      [1, { ...WIDE_F, y: -0.12, x: -0.02, lean: -2, bend: 9, r: R(-0.04, 0.38, 0.24, E_FRONT), l: L(-0.22, 0.52, 0.16, E_OUT), handR: 1, handL: 1 }],
      [1.5, { ...WIDE_F, y: -0.07, x: -0.03, lean: -3, bend: 7, r: R(0.2, 0.62, 0.15, E_FRONT), l: L(-0.24, 0.56, 0.16, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'baseball-swing', name: 'Baseball Swing', tags: 'party | arms full | twist sport', beats: 4, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Batting stance with both fists cocked by your right shoulder, then swing the bat level across your body and finish high over the other shoulder.',
    keys: [
      [0, { ...WIDE_F, y: -0.06, x: 0.02, twist: 18, turn: -20, r: R(0.31, 0.86, 0.16, E_OUT), l: L(0.26, 0.82, 0.26, E_X), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.05, x: 0.03, twist: 24, turn: -24, r: R(0.33, 0.9, 0.14, E_OUT), l: L(0.28, 0.86, 0.24, E_X), handR: 0, handL: 0 }],
      [2, { ...WIDE_F, y: -0.09, x: -0.03, twist: -22, hipTwist: -14, turn: -26, r: R(-0.14, 0.7, 0.3, E_X), l: L(-0.2, 0.72, 0.28, E_FRONT), handR: 0, handL: 0 }],
      [3, { rf: [0.12, 0.03, -0.03], lf: [-0.14, 0, 0], y: -0.05, x: -0.04, twist: -32, hipTwist: -20, turn: -30, r: R(-0.29, 0.86, 0.22, E_X), l: L(-0.34, 0.83, 0.16, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'golf-swing', name: 'Golf Swing', tags: 'party | arms full | twist sport', beats: 4, level: 'low', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Bend over the ball with hands together low, swing them up past your right shoulder, sweep down through the ball and finish high on the other side.',
    keys: [
      [0, { ...WIDE_F, y: -0.05, bend: 18, nod: 12, r: R(0.01, 0.46, 0.22, E_FRONT), l: L(-0.02, 0.48, 0.21, E_FRONT), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.05, bend: 10, twist: 24, nod: 8, r: R(0.32, 0.9, 0.06, E_OUT), l: L(0.27, 0.87, 0.12, E_X), handR: 0, handL: 0 }],
      [2, { ...WIDE_F, y: -0.07, bend: 16, nod: 12, twist: -4, r: R(0.0, 0.46, 0.22, E_FRONT), l: L(-0.03, 0.48, 0.21, E_FRONT), handR: 0, handL: 0 }],
      [3, { rf: [0.1, 0.04, -0.03], lf: [-0.14, 0, 0], y: -0.02, bend: 2, twist: -32, hipTwist: -18, turn: -22, r: R(-0.3, 0.86, 0.2, E_X), l: L(-0.35, 0.84, 0.14, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'tennis-swing', name: 'Tennis Forehand & Backhand', tags: 'party | arms full | twist sport', beats: 4, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Ready stance: swing a forehand from low on your right up across your body, take the racket back on the other side, then hit a backhand out to the right.',
    keys: [
      [0, { ...WIDE_F, y: -0.08, x: -0.02, twist: -20, turn: -10, r: R(-0.12, 0.88, 0.28, E_X), l: L(-0.36, 0.74, 0.04, E_OUT), handR: 0, handL: 1 }],
      [1, { ...WIDE_F, y: -0.06, x: -0.03, twist: -24, r: R(-0.26, 0.64, 0.2, E_X), l: L(-0.2, 0.66, 0.2, E_FRONT), handR: 0, handL: 1 }],
      [2, { ...WIDE_F, y: -0.08, x: 0.03, twist: 20, turn: 10, r: R(0.38, 0.86, 0.14, E_OUT), l: L(-0.2, 0.62, 0.14, E_FRONT), handR: 0, handL: 1 }],
      [3, { ...WIDE_F, y: -0.06, x: 0.03, twist: 24, r: R(0.33, 0.52, -0.05, E_OUT), l: L(-0.24, 0.66, 0.12, E_FRONT), handR: 0, handL: 1 }],
    ],
  }),
  full({
    id: 'bowling', name: 'Bowling Release', tags: 'party | full | sport', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Hold the ball at your chest, swing it back, then slide into a low lunge with the back leg sweeping behind and roll it out low in front.',
    keys: [
      [0, { y: -0.01, r: R(0.1, 0.74, 0.22, E_FRONT), l: L(0.0, 0.74, 0.24, E_FRONT), handR: 1, handL: 1 }],
      [1, { y: -0.05, bend: 6, x: -0.01, r: R(0.27, 0.46, -0.18, E_BACK), l: L(-0.32, 0.72, 0.06, E_OUT), handR: 0.5, handL: 1 }],
      [2, { y: -0.15, x: -0.04, bend: 16, lean: -4, nod: -4, rf: [-0.02, 0.02, -0.17], lf: [-0.12, 0, 0.12], r: R(-0.05, 0.42, 0.3, E_X), l: L(-0.38, 0.74, 0.02, E_OUT), handR: 1, handL: 1 }],
      [3, { y: -0.13, x: -0.04, bend: 12, lean: -4, rf: [-0.02, 0.02, -0.17], lf: [-0.12, 0, 0.12], r: R(0.16, 1.02, 0.2, E_UP), l: L(-0.38, 0.76, 0.02, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'bump-set-spike', name: 'Bump, Set, Spike', tags: 'party | full | jump sport', beats: 4, level: 'high', d: 3, parts: ['jump', 'arms', 'legs'], jump: true,
    desc: 'Bump with arms together low in a squat, set with both hands above your forehead, then load, jump and spike with the right arm.',
    keys: [
      [0, { ...WIDE_F, y: -0.13, bend: 10, nod: -4, r: R(0.02, 0.5, 0.28, E_FRONT), l: L(-0.02, 0.5, 0.28, E_FRONT), handR: 0, handL: 0 }],
      [1, { rf: [0.11, 0, 0], lf: [-0.11, 0, 0], y: -0.02, nod: -12, r: R(0.09, 1.06, 0.12, E_UP), l: L(-0.09, 1.06, 0.12, E_UP), handR: 1, handL: 1 }],
      [2, { rf: [0.12, 0, 0], lf: [-0.12, 0, 0], y: -0.14, bend: 10, r: R(0.22, 0.46, -0.12, E_BACK), l: L(-0.22, 0.46, -0.12, E_BACK), handR: 1, handL: 1 }],
      [2.5, { rf: [0.1, 0.02, 0], lf: [-0.1, 0.02, 0], y: 0.02, nod: -6, r: R(0.18, 0.8, 0.2, E_OUT), l: L(-0.16, 0.8, 0.2, E_FRONT), handR: 1, handL: 1 }],
      [3, { rf: [0.1, 0.05, 0], lf: [-0.1, 0.05, 0], y: 0.12, nod: -10, r: R(0.2, 1.12, -0.02, E_UP), l: L(-0.12, 1.04, 0.14, E_UP), handR: 1, handL: 1 }],
      [3.5, { rf: [0.12, 0, 0], lf: [-0.12, 0, 0], y: -0.08, bend: 8, nod: -4, r: R(0.13, 0.86, 0.29, E_UP), l: L(-0.14, 0.62, 0.14, E_FRONT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'soccer-kick', name: 'Soccer Kick', tags: 'party | legs | kick sport', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Swing the right leg back with the opposite arm forward, then kick through the ball with arms flung wide for balance.',
    keys: [
      [0, { y: -0.04, x: -0.02, lean: -3, bend: 4, rf: [0.11, 0.13, -0.16], r: R(0.32, 0.66, -0.04, E_OUT), l: L(-0.22, 0.74, 0.18, E_FRONT), handR: 1, handL: 1 }],
      [1, { y: -0.02, x: -0.03, lean: -5, bend: -6, rf: [0.04, 0.17, 0.3], r: R(0.38, 0.8, 0.06, E_OUT), l: L(-0.38, 0.78, 0.04, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'pitcher-windup', name: 'Pitcher Wind-Up', tags: 'party | full | kick sport', beats: 4, level: 'mid', d: 3, parts: ['legs', 'arms', 'torso'], mirror: true,
    desc: 'Hands together at the chest, lift the left knee high, stride out wide with the throwing arm back, then fire the pitch down across your body.',
    keys: [
      [0, { y: -0.02, r: R(0.03, 0.78, 0.18, E_FRONT), l: L(-0.03, 0.78, 0.18, E_FRONT), handR: 0, handL: 1 }],
      [1, { y: -0.03, x: 0.02, lean: -3, lf: [-0.06, 0.25, 0.14], r: R(0.04, 0.84, 0.18, E_FRONT), l: L(-0.02, 0.84, 0.18, E_FRONT), handR: 0, handL: 1 }],
      [2, { y: -0.11, x: -0.04, twist: 16, turn: -18, lf: [-0.25, 0, 0.04], r: R(0.36, 0.96, -0.12, E_UP), l: L(-0.32, 0.8, 0.14, E_OUT), handR: 0, handL: 1 }],
      [3, { y: -0.12, x: -0.06, twist: -24, bend: 12, turn: -10, lf: [-0.25, 0, 0.04], rf: [0.11, 0.05, -0.1], r: R(-0.14, 0.58, 0.28, E_FRONT), l: L(-0.24, 0.6, -0.04, E_BACK), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'archery', name: 'Archery Draw', tags: 'party | arms | sport', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Bow arm straight out to the left, draw the string back to your right cheek, then let the arrow fly with the hand springing open behind you.',
    keys: [
      [0, { ...WIDE_F, y: -0.03, turn: -30, r: R(0.1, 0.9, 0.11, E_OUT), l: L(-0.44, 0.82, 0.05, E_OUT), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.02, turn: -30, r: R(0.36, 0.86, -0.05, E_OUT), l: L(-0.44, 0.82, 0.05, E_OUT), handR: 1, handL: 0 }],
    ],
  }),
  // ---------------------------------------------------------------- Animals and characters
  full({
    id: 'penguin-waddle', name: 'Penguin Waddle', tags: 'party | legs hips | walk animal', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'],
    desc: 'Stiff straight arms with the hands flared out, toes turned out, waddle by rocking your whole body from foot to foot.',
    keys: [[0, penguinA], [1, mir(penguinA)]],
  }),
  full({
    id: 'crab-shuffle', name: 'Crab Shuffle', tags: 'party | legs arms | walk animal', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.2,
    desc: 'Low wide squat with both arms up as claws, shuffle sideways step-together while the claws pinch open and shut.',
    keys: [
      [0, { x: 0.1, y: -0.13, rf: [0.34, 0, 0], lf: [-0.13, 0, 0], r: R(0.3, 0.96, 0.08, E_OUT), l: L(-0.3, 0.96, 0.08, E_OUT), handR: 1, handL: 1 }],
      [0.5, { x: 0.13, y: -0.11, rf: [0.34, 0, 0], lf: [-0.06, 0.03, 0], r: R(0.31, 0.92, 0.1, E_OUT), l: L(-0.31, 0.92, 0.1, E_OUT), handR: 0, handL: 0 }],
      [1, { x: 0.2, y: -0.14, rf: [0.34, 0, 0], lf: [0.07, 0, 0], r: R(0.3, 0.96, 0.08, E_OUT), l: L(-0.3, 0.96, 0.08, E_OUT), handR: 1, handL: 1 }],
      [1.5, { x: 0.2, y: -0.11, rf: [0.34, 0, 0], lf: [0.07, 0, 0], r: R(0.31, 0.92, 0.1, E_OUT), l: L(-0.31, 0.92, 0.1, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'bunny-hop', name: 'Bunny Ears Hop', tags: 'party kpop | full arms | jump animal', beats: 2, level: 'high', d: 2, parts: ['jump', 'arms'], jump: true,
    desc: 'Hands up on top of your head as bunny ears, hop with feet together from side to side, ears flopping on each hop.',
    keys: [
      [0, { x: 0.04, y: -0.07, lean: 4, rf: [0.11, 0, 0], lf: [-0.03, 0, 0], r: R(0.09, 1.05, 0.02, E_OUT), l: L(-0.09, 1.05, 0.02, E_OUT), handR: 1, handL: 1 }],
      [0.5, { x: 0.0, y: 0.08, rf: [0.05, 0.04, 0], lf: [-0.05, 0.04, 0], r: R(0.11, 1.08, 0.04, E_OUT), l: L(-0.11, 1.08, 0.04, E_OUT), handR: 0.4, handL: 0.4 }],
      [1, { x: -0.04, y: -0.07, lean: -4, rf: [0.03, 0, 0], lf: [-0.11, 0, 0], r: R(0.09, 1.05, 0.02, E_OUT), l: L(-0.09, 1.05, 0.02, E_OUT), handR: 1, handL: 1 }],
      [1.5, { x: 0.0, y: 0.08, rf: [0.05, 0.04, 0], lf: [-0.05, 0.04, 0], r: R(0.11, 1.08, 0.04, E_OUT), l: L(-0.11, 1.08, 0.04, E_OUT), handR: 0.4, handL: 0.4 }],
    ],
  }),
  full({
    id: 'dino-stomp', name: 'Dinosaur Stomp', tags: 'party rock | legs | stomp animal', beats: 2, level: 'mid', d: 1, parts: ['legs'], impact: true,
    desc: 'Tiny T-rex arms tucked at the chest, stomp heavily out to one side, lift the other knee, and stomp that way.',
    keys: [[0, dinoA], [0.5, dinoLift], [1, mir(dinoA)], [1.5, mir(dinoLift)]],
  }),
  full({
    id: 'gorilla', name: 'Gorilla Chest Beat', tags: 'party rock | arms full | stomp punch animal', beats: 2, level: 'high', d: 1, parts: ['arms', 'legs'], impact: true,
    desc: 'Wide, low gorilla stance rocking side to side, pound your chest with alternating fists twice a beat.',
    keys: [
      [0, { x: 0.03, y: -0.15, lean: 4, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.3, kneeL: 0.3, r: R(0.07, 0.7, 0.15, E_OUT), l: L(-0.32, 0.7, 0.14, E_OUT), handR: 0, handL: 0 }],
      [0.5, { x: 0.02, y: -0.13, lean: 2, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.3, kneeL: 0.3, r: R(0.32, 0.7, 0.14, E_OUT), l: L(-0.07, 0.7, 0.15, E_OUT), handR: 0, handL: 0 }],
      [1, { x: -0.03, y: -0.15, lean: -4, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.3, kneeL: 0.3, r: R(0.07, 0.7, 0.15, E_OUT), l: L(-0.32, 0.7, 0.14, E_OUT), handR: 0, handL: 0 }],
      [1.5, { x: -0.02, y: -0.13, lean: -2, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.3, kneeL: 0.3, r: R(0.32, 0.7, 0.14, E_OUT), l: L(-0.07, 0.7, 0.15, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'zombie-shuffle', name: 'Zombie Shuffle', tags: 'party | arms legs | walk', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Arms stretched out in front with limp wrists, head lolling, drag one foot then the other in a slow lurching shuffle.',
    keys: [[0, zombieA], [1, mir(zombieA)]],
  }),
  full({
    id: 'puppet', name: 'Puppet on Strings', tags: 'party | full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Floppy marionette: the strings yank the right elbow and right knee up together with the hand dangling, then drop it and pull the left side.',
    keys: [[0, puppetA], [1, mir(puppetA)]],
  }),
  full({
    id: 'monkey-scratch', name: 'Monkey Scratch', tags: 'party | arms | animal', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Bent knees bouncing, scratch the top of your head with one hand and your armpit with the other.',
    keys: [
      [0, { ...WIDE_F, y: -0.1, kneeR: 0.3, kneeL: 0.3, head: 8, r: R(0.09, 1.12, 0.03, E_OUT), l: L(-0.2, 0.66, 0.1, E_OUT), handR: 0.5, handL: 0.5 }],
      [0.5, { ...WIDE_F, y: -0.05, kneeR: 0.3, kneeL: 0.3, head: 5, r: R(0.12, 1.09, 0.05, E_OUT), l: L(-0.22, 0.6, 0.12, E_OUT), handR: 0.5, handL: 0.5 }],
      [1, { ...WIDE_F, y: -0.1, kneeR: 0.3, kneeL: 0.3, head: 8, r: R(0.09, 1.12, 0.03, E_OUT), l: L(-0.2, 0.66, 0.1, E_OUT), handR: 0.5, handL: 0.5 }],
      [1.5, { ...WIDE_F, y: -0.05, kneeR: 0.3, kneeL: 0.3, head: 5, r: R(0.12, 1.09, 0.05, E_OUT), l: L(-0.22, 0.6, 0.12, E_OUT), handR: 0.5, handL: 0.5 }],
    ],
  }),
  full({
    id: 'superhero', name: 'Superhero Take-Off', tags: 'party rock | full | jump punch', beats: 4, level: 'high', d: 2, parts: ['jump', 'arms', 'legs'], mirror: true, jump: true,
    desc: 'Crouch low with fists ready, blast off with one fist straight up, land, then stand tall in the hero pose with fists on hips.',
    keys: [
      [0, { ...WIDE_F, y: -0.18, bend: 12, nod: -6, r: R(0.12, 0.42, 0.2, E_FRONT), l: L(-0.12, 0.42, 0.2, E_FRONT), handR: 0, handL: 0 }],
      [1, { rf: [0.09, 0.05, 0], lf: [-0.09, 0.05, 0], y: 0.13, nod: -10, r: R(0.06, 1.12, 0.06, E_UP), l: ARM.hip, handR: 0, handL: 0 }],
      [2, { ...WIDE_F, y: -0.08, nod: -6, r: R(0.07, 1.1, 0.07, E_UP), l: ARM.hip, handR: 0, handL: 0 }],
      [3, { ...WIDE_F, y: 0.0, nod: -8, shR: 0.3, shL: 0.3, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'scarecrow', name: 'Scarecrow Flop', tags: 'party | arms legs |', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Arms stuck out straight from the shoulders with the forearms dangling, knees knocked and head tipped, flop from one leg to the other.',
    keys: [[0, scarecrowA], [1, mir(scarecrowA)]],
  }),
  full({
    id: 'toy-soldier', name: 'Wind-Up Toy March', tags: 'party | full | walk', beats: 2, level: 'mid', d: 1, parts: ['legs', 'arms'],
    desc: 'Stiff as a wind-up toy: straight leg lifts forward and straight arms swing forward and back, head clicking from side to side.',
    keys: [[0, toyA], [0.5, { y: -0.01, rf: [0.09, 0, 0], r: [8, 0, 8, 0], l: [8, 0, 8, 0], handR: 0, handL: 0 }], [1, mir(toyA)], [1.5, { y: -0.01, lf: [-0.09, 0, 0], r: [8, 0, 8, 0], l: [8, 0, 8, 0], handR: 0, handL: 0 }]],
  }),
  // ---------------------------------------------------------------- Everyday mimes
  full({
    id: 'hammer-nail', name: 'Hammer & Nail', tags: 'party rock | arms | punch', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Hold the nail with one hand in front of you and bang the hammer down on it with the other fist on every beat.',
    keys: [
      [0, { y: -0.06, bend: 8, nod: 10, r: R(0.04, 0.6, 0.26, E_FRONT), l: L(-0.03, 0.6, 0.27, E_FRONT), handR: 0, handL: 0.4 }],
      [0.5, { y: -0.02, bend: 4, nod: 6, r: R(0.2, 0.96, 0.14, E_OUT), l: L(-0.03, 0.6, 0.27, E_FRONT), handR: 0, handL: 0.4 }],
      [1, { y: -0.06, bend: 8, nod: 10, r: R(0.04, 0.6, 0.26, E_FRONT), l: L(-0.03, 0.6, 0.27, E_FRONT), handR: 0, handL: 0.4 }],
      [1.5, { y: -0.02, bend: 4, nod: 6, r: R(0.2, 0.96, 0.14, E_OUT), l: L(-0.03, 0.6, 0.27, E_FRONT), handR: 0, handL: 0.4 }],
    ],
  }),
  full({
    id: 'butter-churn', name: 'Churn the Butter', tags: 'party funk | arms legs |', beats: 2, level: 'mid', d: 1, parts: ['arms', 'legs'],
    desc: 'Fists stacked on an imaginary churn handle at your belly, plunge it down with a knee bend and pull it up as you rise, rocking side to side.',
    keys: [
      [0, { ...WIDE_F, x: 0.03, y: -0.12, lean: 3, r: R(0.02, 0.5, 0.24, E_FRONT), l: L(0.0, 0.42, 0.24, E_FRONT), handR: 0, handL: 0 }],
      [0.5, { ...WIDE_F, x: 0.0, y: -0.02, r: R(0.02, 0.8, 0.24, E_FRONT), l: L(0.0, 0.72, 0.24, E_FRONT), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, x: -0.03, y: -0.12, lean: -3, r: R(0.02, 0.5, 0.24, E_FRONT), l: L(0.0, 0.42, 0.24, E_FRONT), handR: 0, handL: 0 }],
      [1.5, { ...WIDE_F, x: 0.0, y: -0.02, r: R(0.02, 0.8, 0.24, E_FRONT), l: L(0.0, 0.72, 0.24, E_FRONT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'wash-windows', name: 'Wash the Windows', tags: 'party pop | arms | hands wave', beats: 2, level: 'low', d: 1, parts: ['arms'],
    desc: 'Open palms facing out at face height, wipe two big circles on the glass in opposite directions while swaying.',
    keys: [0, 0.5, 1, 1.5].map((b) => {
      const a = (b * Math.PI);
      return [b, {
        x: 0.03 * Math.cos(a), hips: 0.025 * Math.cos(a), lf: [-0.09, 0, 0], rf: [0.09, 0, 0],
        r: R(0.17 + 0.11 * Math.cos(a), 0.9 + 0.11 * Math.sin(a), 0.26, E_OUT),
        l: L(-0.17 - 0.11 * Math.cos(a), 0.9 + 0.11 * Math.sin(a), 0.26, E_OUT),
        handR: 1, handL: 1,
      }] as const;
    }),
  }),
  full({
    id: 'tug-of-war', name: 'Tug of War', tags: 'party rock | arms full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Rope out to your left: reach both hands along it, then sit back and haul it in toward your right hip, hand over hand.',
    keys: [
      [0, { rf: [0.18, 0, 0], lf: [-0.13, 0, 0.04], x: -0.03, y: -0.08, lean: -6, twist: -10, r: R(-0.14, 0.7, 0.26, E_X), l: L(-0.3, 0.72, 0.2, E_FRONT), handR: 0, handL: 0 }],
      [1, { rf: [0.18, 0, 0], lf: [-0.13, 0, 0.04], x: 0.05, y: -0.15, lean: 9, twist: 8, bend: -4, r: R(0.22, 0.6, 0.1, E_BACK), l: L(0.1, 0.64, 0.22, E_X), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'dig-and-toss', name: 'Dig & Toss', tags: 'party | full | twist', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true,
    desc: 'Drive the shovel into the ground low on your right, lift the load to your waist, then toss it up over your left shoulder.',
    keys: [
      [0, { ...WIDE_F, y: -0.14, bend: 16, nod: 8, twist: 10, r: R(0.22, 0.38, 0.22, E_OUT), l: L(0.07, 0.56, 0.26, E_X), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.07, bend: 6, twist: 6, r: R(0.18, 0.6, 0.22, E_OUT), l: L(0.04, 0.7, 0.24, E_X), handR: 0, handL: 0 }],
      [2, { ...WIDE_F, y: -0.02, x: -0.03, twist: -24, turn: -20, r: R(-0.2, 0.88, 0.27, E_X), l: L(-0.32, 0.86, 0.18, E_OUT), handR: 0, handL: 0 }],
      [3, { ...WIDE_F, y: -0.06, twist: 0, r: R(0.14, 0.62, 0.22, E_OUT), l: L(-0.02, 0.66, 0.24, E_FRONT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'pick-apples', name: 'Pick the Apples', tags: 'party pop | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Rise on your toes and reach high to one side to pick an apple, then bring it down across your body into the bag at your other hip.',
    keys: [
      [0, { x: 0.02, y: 0.02, lean: 9, rf: [0.11, 0.03, 0], lf: [-0.08, 0, 0], r: R(0.32, 1.16, 0.1, E_UP), l: L(-0.22, 0.5, 0.12, E_OUT), handR: 1, handL: 0.6 }],
      [1, { x: -0.02, y: -0.06, lean: -4, nod: 8, r: R(-0.12, 0.54, 0.22, E_X), l: L(-0.24, 0.5, 0.12, E_OUT), handR: 0.3, handL: 0.6 }],
    ],
  }),
  full({
    id: 'lawnmower', name: 'Lawnmower', tags: 'party rock | arms full |', beats: 2, level: 'mid', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'One hand steadies the mower low in front, the other grabs the cord down by your knee and yanks it up and back.',
    keys: [
      [0, { ...WIDE_F, y: -0.12, bend: 14, nod: 8, twist: -8, r: R(-0.02, 0.42, 0.26, E_X), l: L(-0.12, 0.45, 0.24, E_FRONT), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.04, bend: 4, twist: 16, lean: 4, r: R(0.32, 0.98, -0.04, E_OUT), l: L(-0.12, 0.47, 0.24, E_FRONT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'shopping-cart', name: 'Shopping Cart', tags: 'party pop | arms | walk', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Push the cart with both hands at your waist, reach out high to grab something off the shelf, drop it in the cart, and push on.',
    keys: [
      [0, { y: -0.03, rf: [0.09, 0.05, 0.06], r: R(0.13, 0.6, 0.28, E_FRONT), l: L(-0.13, 0.6, 0.28, E_FRONT), handR: 0, handL: 0 }],
      [1, { y: 0.0, x: 0.03, lean: 7, lf: [-0.09, 0.05, 0.06], r: R(0.42, 0.96, 0.1, E_OUT), l: L(-0.13, 0.6, 0.28, E_FRONT), handR: 1, handL: 0 }],
      [2, { y: -0.04, x: 0.0, rf: [0.09, 0.05, 0.06], nod: 8, r: R(0.06, 0.62, 0.3, E_FRONT), l: L(-0.13, 0.6, 0.28, E_FRONT), handR: 1, handL: 0 }],
      [3, { y: -0.03, lf: [-0.09, 0.05, 0.06], r: R(0.13, 0.6, 0.28, E_FRONT), l: L(-0.13, 0.6, 0.28, E_FRONT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'cast-and-reel', name: 'Cast & Reel', tags: 'party | arms |', beats: 4, level: 'low', d: 2, parts: ['arms'], mirror: true,
    desc: 'Rod back over your right shoulder, cast it out in front, then hold it at your waist and reel in with quick circles of the other hand.',
    keys: [
      [0, { y: -0.02, lean: 4, twist: 10, r: R(0.3, 0.96, 0.08, E_OUT), l: L(0.23, 0.85, 0.24, E_X), handR: 0, handL: 0 }],
      [1, { y: -0.06, bend: 6, twist: -4, r: R(0.05, 0.92, 0.32, E_FRONT), l: L(-0.02, 0.88, 0.3, E_FRONT), handR: 0, handL: 0 }],
      [2, { y: -0.08, bend: 4, r: R(0.15, 0.66, 0.24, E_OUT), l: L(-0.04, 0.62, 0.26, E_FRONT), handR: 0, handL: 0 }],
      [2.5, { y: -0.05, bend: 4, r: R(0.17, 0.52, 0.22, E_OUT), l: L(-0.04, 0.62, 0.26, E_FRONT), handR: 0, handL: 0 }],
      [3, { y: -0.08, bend: 4, r: R(0.15, 0.66, 0.24, E_OUT), l: L(-0.04, 0.62, 0.26, E_FRONT), handR: 0, handL: 0 }],
      [3.5, { y: -0.05, bend: 4, r: R(0.17, 0.52, 0.22, E_OUT), l: L(-0.04, 0.62, 0.26, E_FRONT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'mime-wall', name: 'Mime Wall', tags: 'party pop | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Palms flat on an invisible wall in front of you: slide one hand to a new spot and press, then the other, peering along the glass.',
    keys: [
      [0, { y: -0.03, x: 0.02, turn: 12, r: R(0.2, 1.0, 0.28, E_OUT), l: L(-0.12, 0.72, 0.28, E_OUT), handR: 1, handL: 1 }],
      [1, { y: -0.03, x: 0.03, turn: 18, r: R(0.26, 0.74, 0.28, E_OUT), l: L(-0.06, 0.98, 0.28, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  // ---------------------------------------------------------------- Fitness and board sports
  full({
    id: 'hula-hoop', name: 'Hula Hoop', tags: 'party latin | hips | hips', beats: 2, level: 'mid', d: 1, parts: ['hips'],
    desc: 'Arms up and out of the way with elbows bent, keep an imaginary hoop spinning with quick hip circles: side, front, side, back.',
    keys: [
      [0, { y: -0.05, hips: 0.075, tilt: 9, chestX: -0.02, ...WIDE_F, r: R(0.24, 1.04, 0.08, E_OUT), l: L(-0.24, 1.04, 0.08, E_OUT), handR: 1, handL: 1 }],
      [0.5, { y: -0.07, hips: 0.0, tilt: 0, x: 0.0, bend: -4, ...WIDE_F, r: R(0.25, 1.02, 0.1, E_OUT), l: L(-0.25, 1.02, 0.1, E_OUT), handR: 1, handL: 1 }],
      [1, { y: -0.05, hips: -0.075, tilt: -9, chestX: 0.02, ...WIDE_F, r: R(0.24, 1.04, 0.08, E_OUT), l: L(-0.24, 1.04, 0.08, E_OUT), handR: 1, handL: 1 }],
      [1.5, { y: -0.03, hips: 0.0, tilt: 0, bend: 4, ...WIDE_F, r: R(0.25, 1.02, 0.1, E_OUT), l: L(-0.25, 1.02, 0.1, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'jump-rope', name: 'Jump Rope', tags: 'party aerobic | legs full | jump sport', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], jump: true,
    desc: 'Small quick hops with feet together, elbows tucked and the hands turning the rope in little circles at your hips.',
    keys: [
      [0, { y: -0.05, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: R(0.26, 0.52, 0.04, E_OUT), l: L(-0.26, 0.52, 0.04, E_OUT), handR: 0, handL: 0 }],
      [0.5, { y: 0.07, rf: [0.06, 0.04, 0], lf: [-0.06, 0.04, 0], r: R(0.27, 0.48, 0.13, E_OUT), l: L(-0.27, 0.48, 0.13, E_OUT), handR: 0, handL: 0 }],
      [1, { y: -0.05, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: R(0.26, 0.56, 0.08, E_OUT), l: L(-0.26, 0.56, 0.08, E_OUT), handR: 0, handL: 0 }],
      [1.5, { y: 0.07, rf: [0.06, 0.04, 0], lf: [-0.06, 0.04, 0], r: R(0.27, 0.48, 0.13, E_OUT), l: L(-0.27, 0.48, 0.13, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'rope-crossover', name: 'Jump Rope Crossover', tags: 'party aerobic | full arms | jump', beats: 2, level: 'high', d: 3, parts: ['jump', 'arms'], jump: true,
    desc: 'Skip on alternate feet and cross your arms in front of your hips on one jump, then open them wide on the next.',
    keys: [
      [0, { y: -0.05, rf: [0.07, 0, 0], lf: [-0.07, 0.05, 0.04], r: R(0.28, 0.5, 0.06, E_OUT), l: L(-0.28, 0.5, 0.06, E_OUT), handR: 0, handL: 0 }],
      [0.5, { y: 0.07, rf: [0.07, 0.03, 0], lf: [-0.07, 0.03, 0], r: R(0.14, 0.52, 0.2, E_FRONT), l: L(-0.14, 0.52, 0.2, E_FRONT), handR: 0, handL: 0 }],
      [1, { y: -0.05, rf: [0.07, 0.05, 0.04], lf: [-0.07, 0, 0], r: R(-0.14, 0.5, 0.24, E_X), l: L(0.14, 0.48, 0.28, E_X), handR: 0, handL: 0 }],
      [1.5, { y: 0.07, rf: [0.07, 0.03, 0], lf: [-0.07, 0.03, 0], r: R(0.14, 0.52, 0.2, E_FRONT), l: L(-0.14, 0.52, 0.2, E_FRONT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'ski-slalom', name: 'Ski Slalom', tags: 'party aerobic | legs full | jump twist sport', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'hips'], jump: true,
    desc: 'Knees bent and feet together, hop from side to side swinging the knees across like slalom turns, fists low on your ski poles.',
    keys: [
      [0, { x: 0.09, y: -0.12, hipTwist: -18, lean: -5, hips: 0.02, rf: [0.14, 0, 0.02], lf: [0.03, 0, -0.02], r: R(0.24, 0.5, 0.22, E_OUT), l: L(-0.18, 0.5, 0.24, E_OUT), handR: 0, handL: 0 }],
      [0.5, { x: 0.0, y: 0.04, hipTwist: 0, rf: [0.05, 0.05, 0], lf: [-0.05, 0.05, 0], r: R(0.22, 0.54, 0.2, E_OUT), l: L(-0.22, 0.54, 0.2, E_OUT), handR: 0, handL: 0 }],
      [1, { x: -0.09, y: -0.12, hipTwist: 18, lean: 5, hips: -0.02, rf: [-0.03, 0, -0.02], lf: [-0.14, 0, 0.02], r: R(0.18, 0.5, 0.24, E_OUT), l: L(-0.24, 0.5, 0.22, E_OUT), handR: 0, handL: 0 }],
      [1.5, { x: 0.0, y: 0.04, hipTwist: 0, rf: [0.05, 0.05, 0], lf: [-0.05, 0.05, 0], r: R(0.22, 0.54, 0.2, E_OUT), l: L(-0.22, 0.54, 0.2, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'surf-rider', name: 'Surf Rider', tags: 'party pop | legs full | wave sport', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true,
    desc: 'Turned sideways in a wide, low surf stance with arms out for balance, ride the wave down and up, tipping the arms like a seesaw.',
    keys: [
      [0, { spin: 30, y: -0.1, rf: [0.19, 0, 0], lf: [-0.19, 0, 0], kneeR: 0.2, kneeL: 0.2, lean: 8, r: R(0.4, 0.68, 0.08, E_OUT), l: L(-0.38, 0.92, 0.08, E_OUT), handR: 1, handL: 1 }],
      [1, { spin: 30, y: -0.18, rf: [0.19, 0, 0], lf: [-0.19, 0, 0], kneeR: 0.2, kneeL: 0.2, lean: 2, bend: 6, r: R(0.4, 0.78, 0.1, E_OUT), l: L(-0.4, 0.8, 0.1, E_OUT), handR: 1, handL: 1 }],
      [2, { spin: 30, y: -0.1, rf: [0.19, 0, 0], lf: [-0.19, 0, 0], kneeR: 0.2, kneeL: 0.2, lean: -8, r: R(0.38, 0.92, 0.08, E_OUT), l: L(-0.4, 0.68, 0.08, E_OUT), handR: 1, handL: 1 }],
      [3, { spin: 30, y: -0.04, rf: [0.19, 0, 0], lf: [-0.19, 0, 0], kneeR: 0.2, kneeL: 0.2, lean: 0, r: R(0.4, 0.8, 0.1, E_OUT), l: L(-0.4, 0.8, 0.1, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'rowing', name: 'Row the Boat', tags: 'party aerobic | arms full | sport', beats: 2, level: 'mid', d: 1, parts: ['arms', 'legs'],
    desc: 'Sit low and reach both fists forward on the oars, then sit up tall and pull them in to your ribs with the elbows driving back.',
    keys: [
      [0, { ...WIDE_F, y: -0.14, bend: 16, nod: 6, r: R(0.13, 0.52, 0.3, E_FRONT), l: L(-0.13, 0.52, 0.3, E_FRONT), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.05, bend: -5, nod: -4, shR: 0.3, shL: 0.3, r: R(0.2, 0.6, 0.06, E_BACK), l: L(-0.2, 0.6, 0.06, E_BACK), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'ladder-climb', name: 'Ladder Climb', tags: 'party aerobic | full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Climb an imaginary ladder: one hand reaches up to grab the next rung as the opposite knee lifts onto the step, then switch.',
    keys: [
      [0, { y: -0.01, nod: -8, lf: [-0.08, 0.2, 0.14], r: R(0.13, 1.16, 0.1, E_OUT), l: L(-0.15, 0.84, 0.16, E_OUT), handR: 0, handL: 0 }],
      [1, { y: -0.01, nod: -8, rf: [0.08, 0.2, 0.14], r: R(0.15, 0.84, 0.16, E_OUT), l: L(-0.13, 1.16, 0.1, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'clean-and-press', name: 'Clean & Press', tags: 'party aerobic | full | sport', beats: 4, level: 'high', d: 2, parts: ['arms', 'legs'], impact: true,
    desc: 'Squat and grab the bar at your knees, flip it up to your shoulders as you stand, press it overhead, then bring it back down.',
    keys: [
      [0, { rf: [0.14, 0, 0], lf: [-0.14, 0, 0], y: -0.2, bend: 16, nod: 6, r: R(0.14, 0.38, 0.2, E_OUT), l: L(-0.14, 0.38, 0.2, E_OUT), handR: 0, handL: 0 }],
      [1, { rf: [0.14, 0, 0], lf: [-0.14, 0, 0], y: -0.03, r: R(0.17, 0.82, 0.13, [0.3, -1, 0.3]), l: L(-0.17, 0.82, 0.13, [0.3, -1, 0.3]), handR: 0, handL: 0 }],
      [2, { rf: [0.14, 0, 0], lf: [-0.14, 0, 0], y: 0.0, nod: -6, r: R(0.17, 1.1, 0.03, E_OUT), l: L(-0.17, 1.1, 0.03, E_OUT), handR: 0, handL: 0 }],
      [3, { rf: [0.14, 0, 0], lf: [-0.14, 0, 0], y: -0.05, r: R(0.17, 0.82, 0.13, [0.3, -1, 0.3]), l: L(-0.17, 0.82, 0.13, [0.3, -1, 0.3]), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'speed-bag', name: 'Speed Bag', tags: 'party rock aerobic | arms | punch sport', beats: 2, level: 'mid', d: 1, parts: ['arms'],
    desc: 'Fists up in front of your face, roll them over each other in fast little circles as if hitting a speed bag, bouncing on your toes.',
    keys: [0, 0.5, 1, 1.5].map((b) => {
      const a = b * Math.PI;
      return [b, {
        y: b % 1 === 0 ? -0.04 : -0.01, rf: [0.11, 0, 0], lf: [-0.11, 0, 0],
        r: R(0.07 + 0.06 * Math.cos(a), 0.98 + 0.07 * Math.sin(a), 0.24, E_OUT),
        l: L(-0.07 - 0.06 * Math.cos(a + Math.PI), 0.98 + 0.07 * Math.sin(a + Math.PI), 0.24, E_OUT),
        handR: 0, handL: 0,
      }] as const;
    }),
  }),

  // ---------------------------------------------------------------- Water
  full({
    id: 'nose-dive', name: 'Hold Your Nose & Sink', tags: 'party pop | legs full | shake', beats: 4, level: 'mid', d: 2, parts: ['legs', 'hips'], mirror: true,
    desc: 'Pinch your nose with one hand, wave the other arm up high, and shimmy your way down into a squat and back up again.',
    keys: [
      [0, { ...WIDE_F, y: -0.02, hips: 0.04, tilt: 5, r: R(0.06, 0.93, 0.15, E_OUT), l: L(-0.16, 1.16, 0.06, E_OUT), handR: 0.3, handL: 1 }],
      [1, { ...WIDE_F, y: -0.09, hips: -0.04, tilt: -5, r: R(0.06, 0.93, 0.15, E_OUT), l: L(-0.25, 1.12, 0.06, E_OUT), handR: 0.3, handL: 1 }],
      [2, { ...WIDE_F, y: -0.17, hips: 0.04, tilt: 5, bend: 6, r: R(0.06, 0.93, 0.15, E_OUT), l: L(-0.16, 1.16, 0.06, E_OUT), handR: 0.3, handL: 1 }],
      [3, { ...WIDE_F, y: -0.09, hips: -0.04, tilt: -5, r: R(0.06, 0.93, 0.15, E_OUT), l: L(-0.25, 1.12, 0.06, E_OUT), handR: 0.3, handL: 1 }],
    ],
  }),

  // ---------------------------------------------------------------- Celebrations
  full({
    id: 'touchdown-spike', name: 'Touchdown Spike', tags: 'party rock | arms full | punch sport', beats: 2, level: 'mid', d: 1, parts: ['arms', 'legs'], mirror: true, impact: true,
    desc: 'Shoot both arms straight up for the touchdown, then spike the ball down hard in front of you with a deep knee dip.',
    keys: [
      [0, { y: 0.01, nod: -8, r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
      [1, { ...WIDE_F, y: -0.15, bend: 12, nod: 8, r: R(0.1, 0.36, 0.26, E_FRONT), l: L(-0.36, 0.72, 0.06, E_OUT), handR: 0, handL: 1 }],
    ],
  }),
  full({
    id: 'champion-belt', name: 'Champion Belt', tags: 'party rock | arms hips | hips sport', beats: 4, level: 'mid', d: 2, parts: ['arms', 'hips'], mirror: true,
    desc: 'Hold the title belt out at your waist and show it off with a hip shake, then hoist it overhead in both hands and look to the crowd.',
    keys: [
      [0, { y: -0.05, hips: 0.05, tilt: 6, r: R(0.18, 0.5, 0.2, E_OUT), l: L(-0.18, 0.5, 0.2, E_OUT), handR: 0, handL: 0 }],
      [1, { y: -0.05, hips: -0.05, tilt: -6, r: R(0.18, 0.5, 0.2, E_OUT), l: L(-0.18, 0.5, 0.2, E_OUT), handR: 0, handL: 0 }],
      [2, { y: 0.01, nod: -8, turn: 20, r: R(0.22, 1.12, 0.06, E_OUT), l: L(-0.22, 1.12, 0.06, E_OUT), handR: 0, handL: 0 }],
      [3, { y: 0.0, nod: -8, turn: 30, lean: 4, r: R(0.24, 1.1, 0.06, E_OUT), l: L(-0.2, 1.13, 0.06, E_OUT), handR: 0, handL: 0 }],
    ],
  }),

  // ---------------------------------------------------------------- Party staples
  full({
    id: 'hokey-pokey', name: 'Hokey Pokey Shake', tags: 'party | legs | shake kick', beats: 4, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'Hands on hips: put your right foot in, take it out to the side, put it in again, and shake it all about.',
    keys: [
      [0, { y: -0.03, x: -0.01, rf: [0.06, 0, 0.22], r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 }],
      [1, { y: -0.04, x: -0.02, lean: -4, rf: [0.32, 0, 0.02], r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 }],
      [2, { y: -0.03, x: -0.01, rf: [0.06, 0, 0.22], r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 }],
      [2.5, { y: -0.02, x: -0.02, lean: -3, rf: [0.13, 0.1, 0.12], kneeR: 0.5, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 }],
      [3, { y: -0.03, x: -0.02, lean: -2, rf: [0.13, 0.1, 0.12], kneeR: -0.4, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 }],
      [3.5, { y: -0.02, x: -0.02, lean: -3, rf: [0.13, 0.1, 0.12], kneeR: 0.5, r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'carlton', name: 'Carlton Swing', tags: 'party pop | arms hips | hips', beats: 2, level: 'mid', d: 2, parts: ['arms', 'hips'],
    desc: 'Step side to side with a hip sway while both bent arms swing together across the body the opposite way, fists loose and head bobbing.',
    keys: [
      [0, { x: 0.04, hips: 0.05, tilt: 6, rf: [0.13, 0, 0], lf: [-0.06, 0.02, 0.01], turn: -12, r: R(-0.04, 0.6, 0.22, E_X), l: L(-0.34, 0.66, 0.08, E_OUT), handR: 0.5, handL: 0.5 }],
      [1, { x: -0.04, hips: -0.05, tilt: -6, rf: [0.06, 0.02, 0.01], lf: [-0.13, 0, 0], turn: 12, r: R(0.34, 0.66, 0.08, E_OUT), l: L(0.04, 0.6, 0.22, E_X), handR: 0.5, handL: 0.5 }],
    ],
  }),

  // ---------------------------------------------------------------- Silly connectors
  full({
    id: 'wiggle-down', name: 'Wiggle Down & Up', tags: 'party funk latin | hips legs | shake hips', beats: 4, level: 'mid', d: 2, parts: ['hips', 'legs'],
    desc: 'Wiggle your hips side to side on every half beat while you sink down low over two beats, then wiggle your way back up.',
    keys: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b, i) => {
      const s = i % 2 === 0 ? 1 : -1;
      const depth = [0, 0.05, 0.09, 0.13, 0.16, 0.13, 0.09, 0.05][i];
      return [b, {
        ...WIDE_F, y: -0.02 - depth, hips: 0.06 * s, tilt: 8 * s, lean: -3 * s, bend: depth * 40, kneeR: 0.2, kneeL: 0.2,
        r: R(0.27, 0.8 - depth * 1.4, 0.14, E_OUT), l: L(-0.27, 0.8 - depth * 1.4, 0.14, E_OUT), handR: 1, handL: 1,
      }] as const;
    }),
  }),
  full({
    id: 'tiptoe-sneak', name: 'Tiptoe Sneak', tags: 'party | legs | walk', beats: 2, level: 'low', d: 1, parts: ['legs'],
    desc: 'Up on your toes with hands curled up by your chest, lift each knee slowly and creep, peeking left and right as you go.',
    keys: [
      [0, { y: 0.02, x: 0.01, turn: 26, nod: 4, bend: 6, rf: [0.09, 0.13, 0.1], lf: [-0.08, 0.02, 0], r: R(0.13, 0.84, 0.18, E_OUT), l: L(-0.13, 0.84, 0.18, E_OUT), handR: 0.4, handL: 0.4, shR: 0.4, shL: 0.4 }],
      [1, { y: 0.02, x: -0.01, turn: -26, nod: 4, bend: 6, rf: [0.08, 0.02, 0], lf: [-0.09, 0.13, 0.1], r: R(0.13, 0.84, 0.18, E_OUT), l: L(-0.13, 0.84, 0.18, E_OUT), handR: 0.4, handL: 0.4, shR: 0.4, shL: 0.4 }],
    ],
  }),
  full({
    id: 'shake-it-out', name: 'Shake It Out', tags: 'party pop | full | shake', beats: 2, level: 'high', d: 1, parts: ['arms', 'legs'],
    desc: 'Loose and silly: shake both hands out wildly up high, then down low, bouncing hard through the knees.',
    keys: [
      [0, { ...WIDE_F, y: -0.07, lean: 4, r: R(0.32, 1.06, 0.06, E_OUT), l: L(-0.28, 0.99, 0.08, E_OUT), handR: 1, handL: 1, shR: 0.5 }],
      [0.5, { ...WIDE_F, y: -0.02, lean: -4, r: R(0.29, 0.93, 0.1, E_OUT), l: L(-0.32, 1.04, 0.06, E_OUT), handR: 1, handL: 1, shL: 0.5 }],
      [1, { ...WIDE_F, y: -0.11, lean: 4, bend: 7, r: R(0.3, 0.5, 0.12, E_OUT), l: L(-0.25, 0.53, 0.12, E_OUT), handR: 1, handL: 1 }],
      [1.5, { ...WIDE_F, y: -0.06, lean: -4, bend: 5, r: R(0.25, 0.49, 0.1, E_OUT), l: L(-0.3, 0.44, 0.1, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'jelly-legs', name: 'Jelly Legs', tags: 'party funk | legs | shake', beats: 2, level: 'mid', d: 2, parts: ['legs'],
    desc: 'Knees turned to jelly: wobble them in and out in opposition on every half beat while your floppy arms dangle out to the sides.',
    keys: [0, 0.5, 1, 1.5].map((b, i) => {
      const s = i % 2 === 0 ? 1 : -1;
      return [b, {
        ...WIDE_F, y: -0.1 + (i % 2) * 0.02, x: 0.015 * s, hips: 0.025 * s, kneeR: 0.9 * s, kneeL: -0.9 * s, head: 6 * s,
        r: [42, 0, 16, 0], l: [42, 0, 16, 0], handR: 1, handL: 1,
      }] as const;
    }),
  }),
  // ---------------------------------------------------------------- More mimes and games
  full({
    id: 'crane-kick', name: 'Crane Kick', tags: 'party kpop | legs arms | kick animal', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Raise both arms up and out like wings with the wrists bent, lift one knee and balance, then snap a front kick and set it down.',
    keys: [
      [0, { y: -0.04, r: R(0.3, 0.72, 0.08, E_OUT), l: L(-0.3, 0.72, 0.08, E_OUT), handR: 1, handL: 1 }],
      [1, { y: -0.02, x: -0.01, rf: [0.07, 0.24, 0.12], r: R(0.3, 1.1, 0.06, E_OUT), l: L(-0.3, 1.1, 0.06, E_OUT), handR: 0.3, handL: 0.3 }],
      [2, { y: -0.03, x: -0.015, lean: 3, rf: [0.07, 0.24, 0.12], r: R(0.32, 1.06, 0.06, E_OUT), l: L(-0.28, 1.12, 0.06, E_OUT), handR: 0.3, handL: 0.3 }],
      [3, { y: -0.03, x: -0.02, bend: -5, rf: [0.08, 0.23, 0.36], r: R(0.4, 0.86, 0.04, E_OUT), l: L(-0.4, 0.86, 0.04, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'kayak', name: 'Kayak Paddle', tags: 'party | arms full | twist sport', beats: 2, level: 'mid', d: 1, parts: ['arms', 'torso'],
    desc: 'Sit low holding a long paddle across your chest and dip one blade low on the right, then the left, rotating your chest each stroke.',
    keys: [
      [0, { ...WIDE_F, y: -0.12, bend: 6, twist: 16, r: R(0.33, 0.5, 0.18, E_OUT), l: L(-0.2, 0.9, 0.26, E_OUT), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.12, bend: 6, twist: -16, r: R(0.2, 0.9, 0.26, E_OUT), l: L(-0.33, 0.5, 0.18, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'elephant-trunk', name: 'Elephant Trunk', tags: 'party | arms legs | walk stomp animal', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Hold your nose with one hand, bend forward a little and let the other arm hang as a trunk, swinging it side to side with heavy, plodding steps.',
    keys: [
      [0, { y: -0.07, x: 0.025, lean: 4, bend: 14, nod: 8, rf: [0.1, 0, 0.02], lf: [-0.09, 0.03, 0], r: R(0.12, 0.4, 0.3, E_FRONT), l: L(-0.02, 0.88, 0.2, [0.2, -1, 0.3]), handR: 1, handL: 0.3 }],
      [1, { y: -0.07, x: -0.025, lean: -4, bend: 14, nod: 8, rf: [0.09, 0.03, 0], lf: [-0.1, 0, 0.02], r: R(-0.12, 0.42, 0.3, E_X), l: L(-0.02, 0.88, 0.2, [0.2, -1, 0.3]), handR: 1, handL: 0.3 }],
    ],
  }),
  full({
    id: 'quick-draw', name: 'Quick Draw', tags: 'party | arms | point', beats: 4, level: 'low', d: 2, parts: ['arms'], mirror: true,
    desc: 'Cowboy stance with hands hovering over your holsters, draw and point both finger guns, blow the smoke off one, and holster.',
    keys: [
      [0, { ...WIDE_F, y: -0.1, kneeR: 0.2, kneeL: 0.2, r: R(0.25, 0.5, 0.07, E_OUT), l: L(-0.25, 0.5, 0.07, E_OUT), handR: 1, handL: 1 }],
      [1, { ...WIDE_F, y: -0.07, r: R(0.26, 0.82, 0.25, E_OUT), l: L(-0.26, 0.82, 0.25, E_OUT), handR: 0.3, handL: 0.3, formR: 'point', formL: 'point' }],
      [2, { ...WIDE_F, y: -0.04, nod: 6, r: R(0.07, 0.88, 0.17, E_OUT), l: L(-0.27, 0.8, 0.24, E_OUT), handR: 0.3, handL: 0.3, formR: 'point', formL: 'point' }],
      [3, { ...WIDE_F, y: -0.06, r: R(0.22, 0.52, 0.04, E_OUT), l: L(-0.22, 0.52, 0.04, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'sweep-floor', name: 'Sweep the Floor', tags: 'party | arms legs |', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'],
    desc: 'Bent over a broom with both hands on the handle, sweep it low across to the right, then back across to the left, stepping with it.',
    keys: [
      [0, { ...WIDE_F, y: -0.11, x: 0.03, bend: 14, nod: 8, lean: 5, r: R(0.27, 0.4, 0.2, E_OUT), l: L(0.12, 0.54, 0.26, E_X), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.11, x: -0.03, bend: 14, nod: 8, lean: -5, r: R(-0.06, 0.42, 0.26, E_X), l: L(-0.2, 0.52, 0.22, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'hopscotch', name: 'Hopscotch', tags: 'party | legs full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], mirror: true, jump: true,
    desc: 'Hop onto one foot with the other kicked up behind and arms out, then jump to land with both feet apart, and switch feet.',
    keys: [
      [0, { y: -0.06, x: 0.03, lean: 3, rf: [0.09, 0, 0], lf: [-0.06, 0.15, -0.1], r: R(0.33, 0.74, 0.06, E_OUT), l: L(-0.33, 0.78, 0.06, E_OUT), handR: 1, handL: 1 }],
      [0.5, { y: 0.07, x: 0.0, rf: [0.08, 0.05, 0], lf: [-0.08, 0.06, 0], r: R(0.26, 0.66, 0.08, E_OUT), l: L(-0.26, 0.66, 0.08, E_OUT), handR: 1, handL: 1 }],
      [1, { y: -0.08, x: 0.0, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], r: R(0.22, 0.52, 0.08, E_OUT), l: L(-0.22, 0.52, 0.08, E_OUT), handR: 1, handL: 1 }],
      [1.5, { y: 0.07, x: -0.01, rf: [0.08, 0.06, 0], lf: [-0.08, 0.05, 0], r: R(0.26, 0.66, 0.08, E_OUT), l: L(-0.26, 0.66, 0.08, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'rollercoaster', name: 'Rollercoaster', tags: 'party pop | full |', beats: 4, level: 'mid', d: 1, parts: ['torso', 'legs'],
    desc: 'Both hands straight up like on the ride: lean into the curve one way, then the other, then drop down low for the big dip and rise back up.',
    keys: [
      [0, { y: -0.03, x: 0.02, lean: 13, hips: -0.03, head: 6, r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
      [1, { y: -0.03, x: -0.02, lean: -13, hips: 0.03, head: -6, r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
      [2, { ...WIDE_F, y: -0.17, bend: 6, nod: -10, r: [160, 10, 166, 10], l: [160, 10, 166, 10], handR: 1, handL: 1 }],
      [3, { y: 0.0, nod: -4, r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'bubble-gum', name: 'Bubble Gum Stretch', tags: 'party pop | arms |', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Pinch the gum at your mouth with both hands, then stretch it out as long as you can to one side, leaning away and watching it go.',
    keys: [
      [0, { y: -0.03, r: R(0.05, 0.86, 0.17, E_OUT), l: L(-0.05, 0.86, 0.17, E_OUT), handR: 0.3, handL: 0.3 }],
      [1, { y: -0.05, x: -0.02, lean: -6, turn: 26, r: R(0.46, 0.84, 0.08, E_OUT), l: L(-0.04, 0.86, 0.17, E_OUT), handR: 0.3, handL: 0.3 }],
    ],
  }),
  full({
    id: 'chop-wood', name: 'Chop the Wood', tags: 'party rock aerobic | full | twist', beats: 2, level: 'high', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true, impact: true,
    desc: 'Axe up high over your right shoulder, then chop it down hard and diagonally to the outside of your left knee as you squat.',
    keys: [
      [0, { ...WIDE_F, y: -0.01, twist: 14, nod: -6, r: R(0.3, 0.98, 0.18, E_OUT), l: L(0.21, 0.94, 0.28, [0, -1, 0.8]), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.17, bend: 14, twist: -18, nod: 8, r: R(-0.13, 0.42, 0.26, E_X), l: L(-0.22, 0.4, 0.22, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'tightrope', name: 'Tightrope Walk', tags: 'party | legs arms | walk', beats: 2, level: 'low', d: 2, parts: ['legs', 'arms'],
    desc: 'Arms out wide for balance, place one foot right in front of the other on the line, wobbling and tipping the arms to stay on.',
    keys: [
      [0, { y: -0.03, lean: 7, hips: -0.02, rf: [0.015, 0, 0.09], lf: [-0.02, 0.03, -0.07], r: R(0.42, 0.7, 0.04, E_OUT), l: L(-0.4, 0.9, 0.04, E_OUT), handR: 1, handL: 1 }],
      [1, { y: -0.03, lean: -7, hips: 0.02, rf: [0.02, 0.03, -0.07], lf: [-0.015, 0, 0.09], r: R(0.4, 0.9, 0.04, E_OUT), l: L(-0.42, 0.7, 0.04, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  // ---------------------------------------------------------------- Jumps and turns
  full({
    id: 'layup', name: 'Layup', tags: 'party | full | jump sport', beats: 4, level: 'high', d: 3, parts: ['jump', 'legs', 'arms'], mirror: true, jump: true,
    desc: 'Two steps carrying the ball at your hip, then take off driving the right knee up and reach the ball high to lay it in, and land.',
    keys: [
      [0, { y: -0.04, x: 0.02, rf: [0.11, 0, 0.06], lf: [-0.08, 0.03, -0.04], r: R(0.2, 0.62, 0.16, E_OUT), l: L(0.06, 0.64, 0.24, E_X), handR: 1, handL: 1 }],
      [1, { y: -0.08, x: -0.02, rf: [0.08, 0.03, -0.04], lf: [-0.11, 0, 0.06], r: R(0.18, 0.7, 0.18, E_OUT), l: L(0.04, 0.72, 0.24, E_X), handR: 1, handL: 1 }],
      [2, { y: 0.13, x: -0.01, nod: -10, rf: [0.07, 0.25, 0.14], lf: [-0.09, 0.04, 0], r: R(0.1, 1.13, 0.08, E_UP), l: L(-0.24, 0.66, 0.1, E_OUT), handR: 1, handL: 1 }],
      [3, { y: -0.08, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], r: R(0.22, 0.66, 0.14, E_OUT), l: L(-0.22, 0.62, 0.12, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'discus-spin', name: 'Discus Spin', tags: 'party | turn full | spin sport', beats: 4, level: 'high', d: 3, parts: ['turn', 'arms'], mirror: true,
    desc: 'Wind up with the throwing arm swung back, spin all the way round on the balls of your feet with that arm out long, and release it high in front.',
    keys: [
      [0, { ...WIDE_F, y: -0.08, twist: 26, turn: -16, spin: 0, r: R(0.42, 0.74, -0.06, E_OUT), l: L(0.05, 0.74, 0.26, E_X), handR: 0.6, handL: 1 }],
      [1, { rf: [0.055, 0, 0], lf: [-0.055, 0, 0], y: -0.05, twist: 10, spin: 0, r: R(0.43, 0.78, 0.0, E_OUT), l: L(-0.3, 0.76, 0.12, E_OUT), handR: 0.6, handL: 1 }],
      [1.5, { rf: [0.055, 0, 0], lf: [-0.055, 0.03, 0], y: -0.03, spin: 90, r: R(0.43, 0.8, 0.02, E_OUT), l: L(-0.3, 0.76, 0.12, E_OUT), handR: 0.6, handL: 1 }],
      [2, { rf: [0.055, 0, 0], lf: [-0.055, 0, 0], y: -0.04, spin: 180, r: R(0.43, 0.8, 0.02, E_OUT), l: L(-0.3, 0.76, 0.12, E_OUT), handR: 0.6, handL: 1 }],
      [2.5, { rf: [0.055, 0.03, 0], lf: [-0.055, 0, 0], y: -0.03, spin: 270, r: R(0.43, 0.8, 0.02, E_OUT), l: L(-0.3, 0.76, 0.12, E_OUT), handR: 0.6, handL: 1 }],
      [3, { rf: [0.13, 0.03, -0.05], lf: [-0.14, 0, 0.04], y: -0.06, spin: 0, twist: -20, bend: 4, nod: -6, r: R(-0.04, 1.0, 0.3, E_X), l: L(-0.36, 0.7, -0.02, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'victory-lap', name: 'Victory Lap', tags: 'party pop | turn full | walk spin sport', beats: 4, level: 'mid', d: 2, parts: ['turn', 'legs', 'arms'], mirror: true,
    desc: 'Jog a small circle on the spot, turning a quarter each beat, one fist pumping high over your head to the crowd.',
    keys: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b, i) => {
      const s = i % 2 === 0 ? 1 : -1;
      return [b, {
        spin: b * 90, y: -0.035, rf: [0.07, s > 0 ? 0.11 : 0, s > 0 ? 0.07 : 0], lf: [-0.07, s > 0 ? 0 : 0.11, s > 0 ? 0 : 0.07],
        r: i % 4 < 2 ? R(0.16, 1.13, 0.05, E_OUT) : R(0.2, 1.02, 0.08, E_OUT), l: s > 0 ? L(-0.19, 0.6, 0.13, E_FRONT) : L(-0.2, 0.54, 0.0, E_BACK),
        handR: 0, handL: 0,
      }] as const;
    }),
  }),

  // ---------------------------------------------------------------- Field events and flags
  full({
    id: 'shot-put', name: 'Shot Put', tags: 'party | full | punch sport', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Crouch with the shot tucked at your neck and the other arm reaching ahead, then drive up onto your toes and push it up and away.',
    keys: [
      [0, { ...WIDE_F, y: -0.15, x: 0.02, lean: 6, twist: 14, r: R(0.12, 0.86, 0.14, E_OUT), l: L(-0.32, 0.76, 0.18, E_OUT), handR: 0.6, handL: 1 }],
      [1, { rf: [0.13, 0.04, -0.03], lf: [-0.14, 0, 0], y: 0.0, x: -0.02, lean: -4, twist: -12, nod: -8, r: R(0.33, 1.02, 0.2, E_OUT), l: L(-0.24, 0.6, 0.06, E_OUT), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'karate-chop', name: 'Karate Chop', tags: 'party kpop | arms | punch sport', beats: 2, level: 'mid', d: 1, parts: ['arms'], mirror: true,
    desc: 'Low horse stance: load the flat hand up by the opposite ear, then chop it straight out to the side at shoulder height, other fist at the hip.',
    keys: [
      [0, { rf: [0.16, 0, 0], lf: [-0.16, 0, 0], y: -0.12, twist: -10, turn: 10, r: R(-0.16, 0.8, 0.24, E_X), l: ARM.hip, handR: 1, handL: 0 }],
      [1, { rf: [0.16, 0, 0], lf: [-0.16, 0, 0], y: -0.14, twist: 8, turn: 26, r: R(0.43, 0.8, 0.06, E_OUT), l: ARM.hip, handR: 1, handL: 0 }],
    ],
  }),
  full({
    id: 'wave-the-flag', name: 'Wave the Flag', tags: 'party pop rock | arms full | wave', beats: 2, level: 'mid', d: 1, parts: ['arms', 'torso'],
    desc: 'Both hands one above the other on a tall flagpole, sweep it in big arcs over your head from side to side, leaning with it.',
    keys: [
      [0, { ...WIDE_F, y: -0.04, x: 0.03, lean: 12, r: R(0.3, 1.02, 0.14, E_OUT), l: L(0.2, 0.88, 0.22, [0, -1, 0.8]), handR: 0, handL: 0 }],
      [0.5, { ...WIDE_F, y: -0.08, x: 0.0, lean: 0, r: R(0.05, 1.12, 0.12, E_OUT), l: L(-0.05, 0.98, 0.2, E_OUT), handR: 0, handL: 0 }],
      [1, { ...WIDE_F, y: -0.04, x: -0.03, lean: -12, r: R(-0.2, 0.88, 0.22, [0, -1, 0.8]), l: L(-0.3, 1.02, 0.14, E_OUT), handR: 0, handL: 0 }],
      [1.5, { ...WIDE_F, y: -0.08, x: 0.0, lean: 0, r: R(0.05, 0.98, 0.2, E_OUT), l: L(-0.05, 1.12, 0.12, E_OUT), handR: 0, handL: 0 }],
    ],
  }),
];
