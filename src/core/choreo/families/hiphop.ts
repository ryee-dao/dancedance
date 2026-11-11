/**
 * Hip-hop: party grooves and social dances (two-step, rock, dougie, nae nae,
 * whip, dab...), old-school party steps, bounces, arm grooves, toprock and
 * house steps. Individual moves only; the generator composes the sequences.
 *
 * Pattern ids added here are prefixed `hh` (ids are global across files).
 */

import { FIST, OPEN, at, circle, mir, wide, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';

const rockA: PoseSpec = wide(-0.075, { x: 0.05, hips: 0.035, tilt: 4, lean: -6, head: 5 });
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

// --- New-school party grooves -------------------------------------------------
const bankA: PoseSpec = { shR: 1.3, shL: 0, r: at(1, 0.25, 0.73, -0.05, [0.7, 0.3, -0.7]), l: at(-1, -0.15, 0.6, 0.16, [1, -0.3, -0.2]), ...FIST };
const naeOut: PoseSpec = { lean: -5, head: 4, r: at(1, 0.33, 1.14, 0.06, [1, 0, -0.3]), l: at(-1, -0.13, 0.6, 0.17, [1, -0.3, 0]), handR: 1, handL: 0.3 };
const naeIn: PoseSpec = { lean: 3, head: -2, r: at(1, 0.06, 1.24, 0.08, [1, 0.2, -0.2]), l: at(-1, -0.13, 0.6, 0.17, [1, -0.3, 0]), handR: 1, handL: 0.3 };
const millyA: PoseSpec = { twist: 12, lean: 4, r: at(1, 0.36, 0.8, 0.12, [1, -0.3, -0.3]), l: at(-1, 0.14, 0.74, 0.21, [0.5, -1, 0]), ...OPEN };
const millyLow: PoseSpec = { twist: 0, lean: 0, r: at(1, 0.15, 0.5, 0.17, [1, -0.3, 0]), l: at(-1, -0.15, 0.5, 0.17, [1, -0.3, 0]), ...OPEN };
/** Both fists wheeling on one side of the body (Cat Daddy). */
const daddy = (k: number): PoseSpec => ({
  lean: 7, head: -4,
  r: circle(0.29, 0.66, 0.1, 0.075, k * Q, 1, [1, 0.2, -0.4]),
  l: circle(0.1, 0.66, 0.2, 0.075, k * Q + Math.PI, -1, [0.4, -1, -0.2]),
  ...FIST,
});


// --- Party dances added Nov 2026 (sources: Steezy how-tos, Wikipedia; see AUTHORING.md) ---
/** Wop: sway onto one side, that shoulder dropping; one hand by the ear, the other swung across to the far shoulder. */
const wopA: PoseSpec = {
  y: -0.08, x: 0.035, hips: 0.03, tilt: 4, lean: 9, head: 6, shR: 0, shL: 0.7, kneeR: 0.12, kneeL: 0.12,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0],
  r: at(1, 0.24, 0.98, 0.05, [1, -0.2, -0.4]), l: at(-1, 0.12, 0.76, 0.2, [0.5, -1, 0]), ...FIST,
};
/** Smurf arms: one fist drives forward up by the shoulder while the other pulls back low, like swimming. */
const smurfA: PoseSpec = { twist: 10, r: at(1, 0.13, 0.86, 0.26, [1, -0.6, -0.2]), l: at(-1, -0.22, 0.56, -0.12, [1, 0, -0.5]), ...FIST };
/** Bernie: head tipped back, chest lifted, leaning to one side with loose dangling arms. */
const bernieA: PoseSpec = {
  y: -0.04, x: 0.03, hips: 0.03, tilt: 4, lean: 9, bend: -7, nod: -16, head: 8,
  rf: [0.12, 0, 0], lf: [-0.1, 0.03, 0.02],
  r: at(1, 0.3, 0.44, 0.02, [1, 0, -0.3]), l: at(-1, -0.22, 0.47, 0.08, [1, 0, -0.3]), handR: 0.6, handL: 0.6,
};
const bernieFlail: PoseSpec = { ...bernieA, y: -0.07, r: at(1, 0.26, 0.5, 0.1, [1, 0, -0.3]), l: at(-1, -0.27, 0.43, -0.02, [1, 0, -0.3]) };
/** Griddy: a heel dug in front (toes up), arms swinging opposite. */
const griddyTap = (side: 1 | -1, wideArms = false): PoseSpec => {
  const tap: [number, number, number] = [0.08 * side, 0, 0.15];
  const base: [number, number, number] = [-0.09 * side, 0, -0.02];
  const feet: PoseSpec = side > 0 ? { rf: tap, lf: base, pitchR: -22 } : { lf: tap, rf: base, pitchL: -22 };
  const arms: PoseSpec = wideArms
    ? { lean: 6 * side, r: at(1, 0.4, 0.82 + 0.06 * side, 0.02, [1, 0.2, -0.3]), l: at(-1, -0.4, 0.82 - 0.06 * side, 0.02, [1, 0.2, -0.3]), ...OPEN }
    : side > 0
      ? { r: at(1, 0.2, 0.52, -0.12, [1, 0, -0.5]), l: at(-1, -0.1, 0.72, 0.22, [1, -0.4, 0]), handR: 0.4, handL: 0.4 }
      : { l: at(-1, -0.2, 0.52, -0.12, [1, 0, -0.5]), r: at(1, 0.1, 0.72, 0.22, [1, -0.4, 0]), handR: 0.4, handL: 0.4 };
  return { y: -0.06, bend: 5, ...feet, ...arms };
};
/** Griddy "throw your Bs": hands circling the eyes like glasses. */
const griddyGlasses: PoseSpec = {
  y: -0.04, nod: -4, rf: [0.09, 0, 0], lf: [-0.09, 0, 0],
  r: at(1, 0.07, 0.93, 0.17, [1, -0.4, -0.2]), l: at(-1, -0.07, 0.93, 0.17, [1, -0.4, -0.2]), handR: 0.5, handL: 0.5,
};

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
    // Deep knee drop on the beat, chest folding with it.
    hhDownBounce: {
      beats: 1, parts: ['legs'], torso: true,
      keys: [
        [0, wide(-0.12, { kneeR: 0.14, kneeL: 0.14, bend: 9, nod: 8 })],
        [0.5, wide(-0.025, { bend: 0, nod: -2 })],
      ],
    },
    // Step out and back in, rocking onto the stepping side (Milly Rock base).
    hhSideOut: {
      beats: 2, parts: ['legs', 'hips'], mirror: true,
      keys: [
        [0, { x: 0.05, y: -0.06, hips: 0.03, tilt: 4, rf: [0.24, 0, 0], lf: [-0.09, 0, 0] }],
        [1, { x: 0.0, y: -0.03, rf: [0.1, 0, 0], lf: [-0.09, 0, 0] }],
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
    // Loose fists in front, dropping with the knees (Down Bounce arms).
    hhDropArms: {
      beats: 1, parts: [],
      keys: [
        [0, { r: at(1, 0.2, 0.52, 0.16, [1, 0, -0.2]), l: at(-1, -0.2, 0.52, 0.16, [1, 0, -0.2]), shR: 0.5, shL: 0.5, handR: 0.2, handL: 0.2 }],
        [0.5, { r: at(1, 0.17, 0.66, 0.18, [1, -0.3, -0.2]), l: at(-1, -0.17, 0.66, 0.18, [1, -0.3, -0.2]), handR: 0.2, handL: 0.2 }],
      ],
    },
    // Elbow pumps back with the shoulder, alternating (Bankhead Bounce).
    hhBankhead: { beats: 2, parts: ['arms', 'torso'], keys: [[0, bankA], [1, mir(bankA)]] },
    // One arm waving overhead, the other low (Nae Nae).
    hhNaeNae: { beats: 4, parts: ['arms'], mirror: true, torso: true, keys: [[0, naeOut], [1, naeIn], [2, naeOut], [3, naeIn]] },
    // Open hands sweeping across the body toward the stepping side (Milly Rock).
    hhMilly: { beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true, keys: [[0, millyA], [1, millyLow]] },
    // Fists wheeling on one side, leaning into it (Cat Daddy).
    hhCatDaddy: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, daddy(0)], [0.5, daddy(1)], [1, daddy(2)], [1.5, daddy(3)]] },
    // Fists swimming forward and back in turn (Smurf).
    hhSmurf: { beats: 2, parts: ['arms', 'torso'], torso: true, label: 'smurf arms', keys: [[0, smurfA], [1, mir(smurfA)]] },
  },
};

// Full-body moves --------------------------------------------------------------
const dabUp: PoseSpec = { y: -0.03, lean: -4, nod: 14, head: -10, turn: -14, r: [130, 4, 134, 4], l: at(-1, 0.08, 0.9, 0.27, [1, 0.2, 0.1]), handR: 1, handL: 0 };

export const moves: MoveDef[] = [
  // Classics
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

  // Bounces and grooves
  combo('down-bounce', 'Down Bounce', 'hhDownBounce', 'hhDropArms', 'low', 1, 'hiphop | legs |', {
    desc: 'Wide stance, drop the knees and fold the chest down on every beat, spring up on the and.',
  }),
  combo('bankhead-bounce', 'Bankhead Bounce', 'hhDownBounce', 'hhBankhead', 'mid', 2, 'hiphop | full |', {
    desc: 'Bounce down on the beat while one elbow pumps back with its shoulder, alternating sides.',
  }),
  full({
    id: 'swag-surf', name: 'Swag Surf', tags: 'hiphop | full | wave', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso', 'hips'],
    desc: 'Knees bent, arms out in front with soft elbows and palms down, rock the whole body side to side like riding a wave.',
    keys: [
      [0, wide(-0.09, { x: 0.04, hips: 0.03, lean: 10, head: 5, r: at(1, 0.34, 0.62, 0.16, [1, 0.3, -0.3]), l: at(-1, -0.26, 0.92, 0.18, [1, 0.3, -0.3]), ...OPEN })],
      [1, wide(-0.09, { x: -0.04, hips: -0.03, lean: -10, head: -5, l: at(-1, -0.34, 0.62, 0.16, [1, 0.3, -0.3]), r: at(1, 0.26, 0.92, 0.18, [1, 0.3, -0.3]), ...OPEN })],
    ],
  }),
  full({
    id: 'lean-and-snap', name: 'Lean & Snap', tags: 'hiphop | full | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Bend one knee and lean back off it, snapping both hands out to that side on the beat, then come back to centre.',
    keys: [
      [0, { y: -0.07, x: -0.02, lean: -8, bend: -4, head: 5, rf: [0.17, 0.02, 0.05], lf: [-0.1, 0, 0], kneeR: 0.4, r: at(1, 0.34, 0.66, 0.08, [1, 0, -0.3]), l: at(-1, 0.18, 0.7, 0.2, [0.5, -1, 0]), ...FIST }],
      [0.5, { y: -0.05, x: -0.02, lean: -8, bend: -4, head: 5, rf: [0.17, 0.02, 0.05], lf: [-0.1, 0, 0], kneeR: 0.4, r: at(1, 0.34, 0.66, 0.08, [1, 0, -0.3]), l: at(-1, 0.18, 0.7, 0.2, [0.5, -1, 0]), ...OPEN }],
      [1, { y: -0.03, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [18, 10, 50, 60], l: [18, 10, 50, 60], handR: 0.4, handL: 0.4 }],
    ],
  }),

  // New-school party dances
  combo('nae-nae', 'Nae Nae', 'rock', 'hhNaeNae', 'mid', 2, 'hiphop pop | arms | wave', {
    desc: 'Rock side to side on bent knees while one open hand waves overhead and the other stays low.',
  }),
  combo('milly-rock', 'Milly Rock', 'hhSideOut', 'hhMilly', 'mid', 2, 'hiphop | full |', {
    desc: 'Step out to the side and sweep both open hands across the body toward it, then drop them low as you step back.',
  }),
  combo('cat-daddy', 'Cat Daddy', 'hhDownBounce', 'hhCatDaddy', 'mid', 2, 'hiphop | arms |', {
    desc: 'Bounce and lean to one side while both fists wheel round each other on that side, then switch.',
  }),
  full({
    id: 'the-whip', name: 'Whip', tags: 'hiphop pop | full |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Lift the knee and throw the same arm forward like gripping a wheel, then drop into the knees.',
    keys: [
      [0, { y: -0.01, lean: -4, head: 3, rf: [0.12, 0.2, 0.13], r: at(1, 0.3, 0.9, 0.22, [1, -0.4, 0]), l: at(-1, -0.22, 0.56, -0.03, [1, 0, -0.5]), handR: 1, handL: 0.4 }],
      [1, wide(-0.1, { kneeR: 0.15, kneeL: 0.12, bend: 6, nod: 6, r: at(1, 0.24, 0.72, 0.22, [1, -0.4, 0]), l: at(-1, -0.2, 0.56, 0.05, [1, 0, -0.5]), handR: 1, handL: 0.4 })],
    ],
  }),
  full({
    id: 'the-dab', name: 'Dab', tags: 'hiphop pop | arms | point', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Bounce, then drop the head into one bent elbow while the other arm shoots straight up and out.',
    keys: [
      [0, { y: -0.07, nod: 4, r: at(1, 0.17, 0.62, 0.14, [1, -0.3, 0]), l: at(-1, -0.17, 0.62, 0.14, [1, -0.3, 0]), ...FIST }],
      [1, dabUp],
    ],
  }),
  full({
    id: 'the-shoot', name: 'Shoot', tags: 'hiphop | full | jump kick', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'Hop on one foot as the other knee kicks out to the side and both fists shoot down toward it.',
    keys: [
      [0, { y: 0.03, lean: 6, head: -4, rf: [0.24, 0.13, 0.08], lf: [-0.08, 0.02, 0], r: at(1, 0.34, 0.5, 0.12, [1, 0, -0.3]), l: at(-1, 0.13, 0.55, 0.2, [0.6, -1, 0]), ...FIST }],
      [0.5, { y: -0.07, rf: [0.11, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.18, 0.7, 0.14, [1, -0.3, 0]), l: at(-1, -0.18, 0.7, 0.14, [1, -0.3, 0]), ...FIST }],
      [1, { y: -0.04, rf: [0.11, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.18, 0.7, 0.14, [1, -0.3, 0]), l: at(-1, -0.18, 0.7, 0.14, [1, -0.3, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'brush-off', name: 'Shoulder Brush-Off', tags: 'hiphop | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Look at one shoulder and brush it off twice with the other hand, flicking the hand away each time.',
    keys: [
      [0, { y: -0.05, turn: 26, head: 6, shR: 0.6, l: at(-1, 0.13, 0.82, 0.1, [1, -0.3, -0.2]), r: [14, 10, 30, 60], handL: 1, handR: 0.4 }],
      [0.5, { y: -0.02, turn: 18, l: at(-1, 0.3, 0.66, 0.18, [1, -0.6, 0]), r: [14, 10, 30, 60], handL: 1, handR: 0.4 }],
      [1, { y: -0.05, turn: 26, head: 6, shR: 0.6, l: at(-1, 0.13, 0.82, 0.1, [1, -0.3, -0.2]), r: [14, 10, 30, 60], handL: 1, handR: 0.4 }],
      [1.5, { y: -0.02, turn: 10, l: at(-1, 0.32, 0.62, 0.16, [1, -0.6, 0]), r: [14, 10, 30, 60], handL: 1, handR: 0.4 }],
    ],
  }),
  full({
    id: 'harlem-shake', name: 'Harlem Shake', tags: 'hiphop | full | shake', beats: 2, level: 'mid', d: 2, parts: ['torso', 'arms'],
    desc: 'Bent arms up in front, jerk one shoulder forward and up, then the other, bouncing the knees.',
    keys: [
      [0, { y: -0.08, twist: -24, chestX: 0.05, lean: -6, head: 5, turn: 10, shR: 1.3, shL: 0, r: at(1, 0.3, 0.72, 0.16, [1, -0.2, -0.3]), l: at(-1, -0.2, 0.66, 0.1, [1, -0.2, -0.3]), ...FIST }],
      [0.5, { y: -0.03, twist: 0, shR: 0.3, shL: 0.3, r: at(1, 0.2, 0.7, 0.14, [1, -0.2, -0.3]), l: at(-1, -0.2, 0.7, 0.14, [1, -0.2, -0.3]), ...FIST }],
      [1, { y: -0.08, twist: 24, chestX: -0.05, lean: 6, head: -5, turn: -10, shL: 1.3, shR: 0, l: at(-1, -0.3, 0.72, 0.16, [1, -0.2, -0.3]), r: at(1, 0.2, 0.66, 0.1, [1, -0.2, -0.3]), ...FIST }],
      [1.5, { y: -0.03, twist: 0, shR: 0.3, shL: 0.3, r: at(1, 0.2, 0.7, 0.14, [1, -0.2, -0.3]), l: at(-1, -0.2, 0.7, 0.14, [1, -0.2, -0.3]), ...FIST }],
    ],
  }),
  full({
    id: 'stanky-leg', name: 'Stanky Leg', tags: 'hiphop | legs hips | twist', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'], mirror: true,
    desc: 'Lean over one bent leg and wheel that knee in and out while the hips follow, the far arm swinging loose.',
    keys: [
      [0, { y: -0.08, x: 0.03, hips: -0.03, tilt: -5, lean: 10, bend: 6, rf: [0.17, 0, 0.03], lf: [-0.1, 0, 0], kneeR: -0.75, r: at(1, 0.2, 0.5, 0.12, [1, 0, -0.3]), l: at(-1, -0.3, 0.6, 0.06, [1, 0, -0.3]), ...OPEN }],
      [0.5, { y: -0.06, x: 0.04, hips: 0.03, tilt: 3, lean: 5, bend: 5, rf: [0.17, 0, 0.03], lf: [-0.1, 0, 0], kneeR: 0.7, r: at(1, 0.26, 0.5, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.52, 0.14, [1, 0, -0.3]), ...OPEN }],
      [1, { y: -0.08, x: 0.03, hips: -0.03, tilt: -5, lean: 10, bend: 6, rf: [0.17, 0, 0.03], lf: [-0.1, 0, 0], kneeR: -0.75, r: at(1, 0.2, 0.5, 0.12, [1, 0, -0.3]), l: at(-1, -0.3, 0.6, 0.06, [1, 0, -0.3]), ...OPEN }],
      [1.5, { y: -0.06, x: 0.04, hips: 0.03, tilt: 3, lean: 5, bend: 5, rf: [0.17, 0, 0.03], lf: [-0.1, 0, 0], kneeR: 0.7, r: at(1, 0.26, 0.5, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.52, 0.14, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'tootsie-roll', name: 'Tootsie Roll', tags: 'hiphop | full |', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Roll the forearms round each other in front while sinking down into the knees for two beats, then roll back up.',
    keys: [
      [0, { y: -0.03, r: circle(0.05, 0.74, 0.22, 0.06, 0, 1, [1, -0.4, 0]), l: circle(-0.05, 0.74, 0.22, 0.06, Math.PI, -1, [1, -0.4, 0]), ...FIST }],
      [0.5, { y: -0.08, r: circle(0.05, 0.7, 0.22, 0.06, Q, 1, [1, -0.4, 0]), l: circle(-0.05, 0.7, 0.22, 0.06, Math.PI + Q, -1, [1, -0.4, 0]), ...FIST }],
      [1, { y: -0.12, bend: 6, r: circle(0.05, 0.68, 0.22, 0.06, Math.PI, 1, [1, -0.4, 0]), l: circle(-0.05, 0.68, 0.22, 0.06, 0, -1, [1, -0.4, 0]), ...FIST }],
      [1.5, { y: -0.16, bend: 8, kneeR: 0.2, kneeL: 0.2, r: circle(0.05, 0.66, 0.22, 0.06, -Q, 1, [1, -0.4, 0]), l: circle(-0.05, 0.66, 0.22, 0.06, Q, -1, [1, -0.4, 0]), ...FIST }],
      [2, { y: -0.18, bend: 9, kneeR: 0.25, kneeL: 0.25, r: circle(0.05, 0.64, 0.22, 0.06, 0, 1, [1, -0.4, 0]), l: circle(-0.05, 0.64, 0.22, 0.06, Math.PI, -1, [1, -0.4, 0]), ...FIST }],
      [2.5, { y: -0.15, bend: 7, kneeR: 0.2, kneeL: 0.2, r: circle(0.05, 0.66, 0.22, 0.06, Q, 1, [1, -0.4, 0]), l: circle(-0.05, 0.66, 0.22, 0.06, Math.PI + Q, -1, [1, -0.4, 0]), ...FIST }],
      [3, { y: -0.1, bend: 4, r: circle(0.05, 0.68, 0.22, 0.06, Math.PI, 1, [1, -0.4, 0]), l: circle(-0.05, 0.68, 0.22, 0.06, 0, -1, [1, -0.4, 0]), ...FIST }],
      [3.5, { y: -0.05, r: circle(0.05, 0.7, 0.22, 0.06, -Q, 1, [1, -0.4, 0]), l: circle(-0.05, 0.7, 0.22, 0.06, Q, -1, [1, -0.4, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'the-woah', name: 'Woah', tags: 'hiphop | arms |', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Bounce, then snap both fists to one side at the waist and freeze with a little lean back.',
    keys: [
      [0, { y: -0.06, r: at(1, 0.17, 0.66, 0.16, [1, -0.3, 0]), l: at(-1, -0.17, 0.66, 0.16, [1, -0.3, 0]), ...FIST }],
      [1, { y: -0.03, lean: -7, bend: -4, head: 6, turn: 18, nod: -4, r: at(1, 0.3, 0.52, 0.06, [1, 0.3, -0.5]), l: at(-1, 0.14, 0.56, 0.18, [0.5, -1, 0]), ...FIST }],
      [1.5, { y: -0.03, lean: -7, bend: -4, head: 6, turn: 18, nod: -4, r: at(1, 0.3, 0.52, 0.06, [1, 0.3, -0.5]), l: at(-1, 0.14, 0.56, 0.18, [0.5, -1, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'jersey-club-kick', name: 'Jersey Club Kick', tags: 'hiphop | legs | kick jump', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'Quick double bounce on both feet, then hop and flick one foot out low to the side, elbows pumping.',
    keys: [
      [0, { y: -0.08, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.24, 0.72, 0.06, [1, 0.3, -0.3]), l: at(-1, -0.24, 0.72, 0.06, [1, 0.3, -0.3]), shR: 0.6, shL: 0.6, ...FIST }],
      [0.5, { y: -0.08, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.22, 0.64, 0.1, [1, 0.3, -0.3]), l: at(-1, -0.22, 0.64, 0.1, [1, 0.3, -0.3]), ...FIST }],
      [1, { y: 0.04, lean: -6, rf: [0.3, 0.07, 0.06], lf: [-0.07, 0.02, 0], kneeR: 0.3, r: at(1, 0.26, 0.78, 0.04, [1, 0.3, -0.3]), l: at(-1, -0.2, 0.62, 0.12, [1, 0.3, -0.3]), shR: 0.8, ...FIST }],
      [1.5, { y: -0.06, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.22, 0.66, 0.1, [1, 0.3, -0.3]), l: at(-1, -0.22, 0.66, 0.1, [1, 0.3, -0.3]), ...FIST }],
    ],
  }),
  full({
    id: 'butterfly-knees', name: 'Butterfly Knees', tags: 'hiphop | legs |', beats: 1, level: 'high', d: 2, parts: ['legs'],
    desc: 'Sit low in a wide stance, hands on the thighs, and flap the knees open and closed like wings on every beat.',
    keys: [
      [0, wide(-0.17, { bend: 10, nod: 4, kneeR: 0.75, kneeL: 0.75, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], r: at(1, 0.16, 0.42, 0.14, [1, 0, -0.3]), l: at(-1, -0.16, 0.42, 0.14, [1, 0, -0.3]), ...OPEN })],
      [0.5, wide(-0.14, { bend: 8, kneeR: -0.6, kneeL: -0.6, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], r: at(1, 0.1, 0.42, 0.16, [1, 0, -0.3]), l: at(-1, -0.1, 0.42, 0.16, [1, 0, -0.3]), ...OPEN })],
    ],
  }),
  full({
    id: 'jerkin', name: "Jerkin'", tags: 'hiphop | legs | kick', beats: 2, level: 'high', d: 3, parts: ['legs', 'arms'],
    desc: 'Step one foot back as the other kicks out low in front, then switch, arms pumping and chest leaning back.',
    keys: [
      [0, { y: -0.05, bend: -6, rf: [0.12, 0.08, 0.24], lf: [-0.08, 0, -0.1], kneeR: 0.3, r: at(1, 0.24, 0.64, -0.06, [1, 0, -0.5]), l: at(-1, -0.12, 0.74, 0.2, [0.6, -1, 0]), ...FIST }],
      [0.5, { y: -0.08, rf: [0.09, 0, 0.03], lf: [-0.09, 0, -0.03], r: at(1, 0.2, 0.66, 0.08, [1, 0, -0.3]), l: at(-1, -0.2, 0.66, 0.08, [1, 0, -0.3]), ...FIST }],
      [1, { y: -0.05, bend: -6, lf: [-0.12, 0.08, 0.24], rf: [0.08, 0, -0.1], kneeL: 0.3, l: at(-1, -0.24, 0.64, -0.06, [1, 0, -0.5]), r: at(1, 0.12, 0.74, 0.2, [0.6, -1, 0]), ...FIST }],
      [1.5, { y: -0.08, rf: [0.09, 0, -0.03], lf: [-0.09, 0, 0.03], r: at(1, 0.2, 0.66, 0.08, [1, 0, -0.3]), l: at(-1, -0.2, 0.66, 0.08, [1, 0, -0.3]), ...FIST }],
    ],
  }),

  // Old-school party and line-dance steps
  full({
    id: 'steve-martin', name: 'Steve Martin', tags: 'hiphop funk | legs | kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Lean back and flick one straight leg forward and out, arms swinging the opposite way, then the other leg.',
    keys: [
      [0, { y: 0.0, bend: -6, lean: -4, nod: -4, rf: [0.26, 0.13, 0.14], lf: [-0.08, 0, 0], r: at(1, 0.26, 0.6, -0.14, [1, 0, -0.5]), l: at(-1, 0.0, 0.68, 0.26, [0.6, -1, 0]), ...OPEN }],
      [0.5, { y: -0.06, rf: [0.1, 0, 0.02], lf: [-0.09, 0, 0], r: [16, 10, 30, 50], l: [16, 10, 30, 50], ...OPEN }],
      [1, { y: 0.0, bend: -6, lean: 4, nod: -4, lf: [-0.26, 0.13, 0.14], rf: [0.08, 0, 0], l: at(-1, -0.26, 0.6, -0.14, [1, 0, -0.5]), r: at(1, 0.0, 0.68, 0.26, [0.6, -1, 0]), ...OPEN }],
      [1.5, { y: -0.06, lf: [-0.1, 0, 0.02], rf: [0.09, 0, 0], r: [16, 10, 30, 50], l: [16, 10, 30, 50], ...OPEN }],
    ],
  }),
  full({
    id: 'hammer-dance', name: 'Hammer Dance', tags: 'hiphop funk | legs | walk twist', beats: 4, level: 'high', d: 3, parts: ['legs', 'arms'], mirror: true, travel: 0.24,
    desc: 'Low wide stance, shuffle sideways on quick feet with the knees snapping in and out, arms swinging loose at the sides.',
    keys: [
      [0, { x: 0.0, y: -0.12, lean: -4, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.5, kneeL: -0.4, r: at(1, 0.3, 0.5, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.52, -0.06, [1, 0, -0.3]), ...OPEN }],
      [1, { x: 0.06, y: -0.1, rf: [0.2, 0, 0], lf: [-0.06, 0, 0], kneeR: -0.4, kneeL: 0.5, r: at(1, 0.22, 0.52, -0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.5, 0.1, [1, 0, -0.3]), ...OPEN }],
      [2, { x: 0.12, y: -0.12, lean: -4, rf: [0.25, 0, 0], lf: [-0.01, 0, 0], kneeR: 0.5, kneeL: -0.4, r: at(1, 0.3, 0.5, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.52, -0.06, [1, 0, -0.3]), ...OPEN }],
      [3, { x: 0.18, y: -0.1, rf: [0.32, 0, 0], lf: [0.06, 0, 0], kneeR: -0.4, kneeL: 0.5, r: at(1, 0.22, 0.52, -0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.5, 0.1, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'criss-cross', name: 'Criss Cross', tags: 'hiphop party | legs | jump', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump'], jump: true, impact: true,
    desc: 'Jump the feet into a cross, jump them back out wide, arms open low for balance.',
    keys: [
      [0, { y: -0.06, rf: [-0.04, 0, 0.04], lf: [0.04, 0, -0.03], kneeR: -0.1, kneeL: -0.1, r: at(1, 0.3, 0.56, 0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.56, 0.06, [1, 0, -0.3]), ...OPEN }],
      [0.5, { y: 0.07, rf: [0.06, 0.02, 0], lf: [-0.06, 0.02, 0], r: at(1, 0.32, 0.62, 0.06, [1, 0, -0.3]), l: at(-1, -0.32, 0.62, 0.06, [1, 0, -0.3]), ...OPEN }],
      [1, { y: -0.07, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], r: at(1, 0.34, 0.6, 0.04, [1, 0, -0.3]), l: at(-1, -0.34, 0.6, 0.04, [1, 0, -0.3]), ...OPEN }],
      [1.5, { y: 0.07, rf: [0.06, 0.02, 0], lf: [-0.06, 0.02, 0], r: at(1, 0.32, 0.62, 0.06, [1, 0, -0.3]), l: at(-1, -0.32, 0.62, 0.06, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'side-jump', name: 'Side-to-Side Jump', tags: 'hiphop aerobic | legs | jump', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'Feet together, jump a step to the side and land low, then jump back, arms swinging against the jump.',
    keys: [
      [0, { y: -0.1, x: 0.12, lean: -6, rf: [0.21, 0, 0], lf: [0.03, 0, 0], kneeR: 0.12, kneeL: 0.12, r: at(1, -0.02, 0.6, 0.2, [0.6, -1, 0]), l: at(-1, -0.12, 0.6, 0.2, [0.6, -1, 0]), ...FIST }],
      [0.5, { y: 0.07, x: 0.06, rf: [0.11, 0.03, 0], lf: [0.01, 0.03, 0], r: at(1, 0.18, 0.66, 0.14, [1, -0.3, 0]), l: at(-1, -0.18, 0.66, 0.14, [1, -0.3, 0]), ...FIST }],
      [1, { y: -0.1, x: 0.0, lean: 6, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.12, kneeL: 0.12, r: at(1, 0.12, 0.6, 0.2, [0.6, -1, 0]), l: at(-1, 0.02, 0.6, 0.2, [0.6, -1, 0]), ...FIST }],
      [1.5, { y: 0.07, x: 0.06, rf: [0.11, 0.03, 0], lf: [0.01, 0.03, 0], r: at(1, 0.18, 0.66, 0.14, [1, -0.3, 0]), l: at(-1, -0.18, 0.66, 0.14, [1, -0.3, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'the-carlton', name: 'Carlton', tags: 'hiphop party pop | full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Step side to side with a hip shift while both loose arms swing across the body the other way, snapping at the end of each swing.',
    keys: [
      [0, { y: -0.04, x: 0.04, hips: 0.03, tilt: 3, twist: -10, head: -4, rf: [0.17, 0, 0], lf: [-0.07, 0.02, 0], r: at(1, -0.02, 0.6, 0.24, [0.4, -1, 0]), l: at(-1, -0.36, 0.66, 0.08, [1, 0, -0.3]), ...FIST }],
      [0.5, { y: -0.07, x: 0.02, rf: [0.15, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.14, 0.46, 0.14, [1, 0, -0.3]), l: at(-1, -0.14, 0.46, 0.14, [1, 0, -0.3]), ...OPEN }],
      [1, { y: -0.04, x: -0.04, hips: -0.03, tilt: -3, twist: 10, head: 4, lf: [-0.17, 0, 0], rf: [0.07, 0.02, 0], l: at(-1, 0.02, 0.6, 0.24, [0.4, -1, 0]), r: at(1, 0.36, 0.66, 0.08, [1, 0, -0.3]), ...FIST }],
      [1.5, { y: -0.07, x: -0.02, lf: [-0.15, 0, 0], rf: [0.09, 0, 0], r: at(1, 0.14, 0.46, 0.14, [1, 0, -0.3]), l: at(-1, -0.14, 0.46, 0.14, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'the-reebok', name: 'Reebok', tags: 'hiphop | full | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Split stance: rock forward onto the front foot as the back leg lifts behind and the arms pump a big exaggerated run, then rock back.',
    keys: [
      [0, { y: -0.04, bend: 7, nod: 4, rf: [0.09, 0, 0.12], lf: [-0.09, 0.17, -0.14], kneeL: 0.1, r: at(1, 0.24, 0.6, -0.14, [1, 0, -0.5]), l: at(-1, -0.06, 0.78, 0.27, [0.6, -1, -0.2]), ...FIST }],
      [1, { y: -0.07, bend: -5, nod: -3, rf: [0.09, 0.03, 0.14], lf: [-0.09, 0, -0.12], kneeR: 0.1, l: at(-1, -0.24, 0.6, -0.14, [1, 0, -0.5]), r: at(1, 0.06, 0.78, 0.27, [0.6, -1, -0.2]), ...FIST }],
    ],
  }),
  full({
    id: 'bart-simpson', name: 'Bart Simpson', tags: 'hiphop | legs full | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.14,
    desc: 'Glide like a skateboard: step out, drag the trailing foot after it with knees and hips twisted that way and both arms flung back the other way.',
    keys: [
      [0, { x: 0.08, y: -0.08, hips: 0.02, turn: 18, lean: -4, rf: [0.26, 0, 0], lf: [-0.02, 0, -0.03], kneeR: 0.45, kneeL: -0.35, r: at(1, -0.06, 0.6, 0.22, [0.5, -1, 0]), l: at(-1, -0.36, 0.6, -0.12, [1, 0, -0.5]), ...OPEN }],
      [1, { x: 0.14, y: -0.03, rf: [0.24, 0, 0], lf: [0.06, 0, 0], r: [16, 10, 30, 50], l: [16, 10, 30, 50], handR: 0.6, handL: 0.6 }],
    ],
  }),
  full({
    id: 'walk-it-out', name: 'Walk It Out', tags: 'hiphop | full | walk twist', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'hips'],
    desc: 'Double-time bounce: step to one side turning toes, knees and hips that way as that arm shoots out to the side, then the other side.',
    keys: [
      [0, { y: -0.07, x: 0.03, hips: 0.02, rf: [0.17, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.55, kneeL: -0.4, r: at(1, 0.44, 0.74, 0.04, [1, 0, -0.3]), l: at(-1, 0.04, 0.7, 0.22, [0.5, -1, 0]), handR: 1, handL: 0.3 }],
      [0.5, { y: -0.03, x: 0.03, rf: [0.17, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.4, kneeL: -0.3, r: at(1, 0.38, 0.68, 0.06, [1, 0, -0.3]), l: at(-1, 0.04, 0.68, 0.22, [0.5, -1, 0]), handR: 1, handL: 0.3 }],
      [1, { y: -0.07, x: -0.03, hips: -0.02, lf: [-0.17, 0, 0], rf: [0.07, 0, 0], kneeL: 0.55, kneeR: -0.4, l: at(-1, -0.44, 0.74, 0.04, [1, 0, -0.3]), r: at(1, -0.04, 0.7, 0.22, [0.5, -1, 0]), handL: 1, handR: 0.3 }],
      [1.5, { y: -0.03, x: -0.03, lf: [-0.17, 0, 0], rf: [0.07, 0, 0], kneeL: 0.4, kneeR: -0.3, l: at(-1, -0.38, 0.68, 0.06, [1, 0, -0.3]), r: at(1, -0.04, 0.68, 0.22, [0.5, -1, 0]), handL: 1, handR: 0.3 }],
    ],
  }),

  // Toprock (standing breaking steps)
  full({
    id: 'indian-step', name: 'Indian Step', tags: 'hiphop | full | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Toprock: step one foot forward across the other, dipping, as that arm swings across low and the other opens out.',
    keys: [
      [0, { y: -0.08, x: -0.02, twist: -12, lean: -3, rf: [-0.01, 0, 0.17], lf: [-0.1, 0, -0.02], kneeR: 0.2, r: at(1, -0.06, 0.56, 0.22, [0.6, -1, 0]), l: at(-1, -0.4, 0.76, 0.02, [1, 0, -0.3]), ...OPEN }],
      [1, { y: -0.03, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: at(1, 0.15, 0.72, 0.18, [1, -0.3, 0]), l: at(-1, -0.15, 0.72, 0.18, [1, -0.3, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'toprock-step-out', name: 'Toprock Step Out', tags: 'hiphop | full |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Toprock: drop into a wide step to the side flinging both open hands out low, then step in and cross the fists.',
    keys: [
      [0, { y: -0.11, x: 0.04, hips: 0.02, lean: 4, rf: [0.26, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.2, kneeL: 0.15, r: at(1, 0.42, 0.62, 0.04, [1, 0.2, -0.3]), l: at(-1, -0.4, 0.62, 0.04, [1, 0.2, -0.3]), ...OPEN }],
      [1, { y: -0.03, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: at(1, -0.06, 0.6, 0.24, [0.6, -1, 0]), l: at(-1, 0.06, 0.62, 0.2, [0.6, -1, 0]), ...FIST }],
    ],
  }),

  // House and shuffle steps
  full({
    id: 'house-skate', name: 'House Skate', tags: 'hiphop | legs | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Glide one foot out and back on a bent knee like a skate push, the opposite arm swinging across, then bring it home.',
    keys: [
      [0, { y: -0.09, x: -0.04, lean: -6, head: 3, bend: 5, lf: [-0.1, 0, 0], rf: [0.24, 0.03, -0.1], kneeL: 0.2, l: at(-1, 0.08, 0.66, 0.22, [0.6, -1, 0]), r: at(1, 0.3, 0.6, -0.1, [1, 0, -0.5]), ...OPEN }],
      [1, { y: -0.03, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: [16, 10, 30, 50], l: [16, 10, 30, 50], ...OPEN }],
    ],
  }),
  full({
    id: 'loose-legs', name: 'Loose Legs', tags: 'hiphop | legs | jump kick', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'House: hop on one foot as the other leg swings loosely out to the side and then back across in front, then land.',
    keys: [
      [0, { y: 0.02, lean: -5, rf: [0.29, 0.11, 0.04], lf: [-0.08, 0.02, 0], kneeR: 0.2, r: at(1, 0.34, 0.66, 0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.62, 0.06, [1, 0, -0.3]), ...OPEN }],
      [0.5, { y: -0.04, lean: 3, rf: [-0.05, 0.09, 0.12], lf: [-0.09, 0, 0], kneeR: -0.1, r: at(1, 0.28, 0.6, 0.08, [1, 0, -0.3]), l: at(-1, -0.34, 0.66, 0.06, [1, 0, -0.3]), ...OPEN }],
      [1, { y: -0.08, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.24, 0.58, 0.1, [1, 0, -0.3]), l: at(-1, -0.24, 0.58, 0.1, [1, 0, -0.3]), ...OPEN }],
    ],
  }),
  full({
    id: 'running-man-shuffle', name: 'Running Man Shuffle', tags: 'hiphop pop | legs | walk', beats: 2, level: 'high', d: 3, parts: ['legs'],
    desc: 'Shuffle running man facing front: drive one knee up as the standing foot slides back, then swap every beat.',
    keys: [
      [0, { y: 0.0, rf: [0.08, 0.2, 0.12], lf: [-0.08, 0, -0.04], r: at(1, 0.2, 0.62, 0.08, [1, 0, -0.3]), l: at(-1, -0.2, 0.62, 0.08, [1, 0, -0.3]), ...FIST }],
      [0.5, { y: -0.07, rf: [0.08, 0, 0.06], lf: [-0.08, 0.02, -0.12], kneeL: 0.1, r: at(1, 0.2, 0.55, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.55, 0.1, [1, 0, -0.3]), ...FIST }],
      [1, { y: 0.0, lf: [-0.08, 0.2, 0.12], rf: [0.08, 0, -0.04], r: at(1, 0.2, 0.62, 0.08, [1, 0, -0.3]), l: at(-1, -0.2, 0.62, 0.08, [1, 0, -0.3]), ...FIST }],
      [1.5, { y: -0.07, lf: [-0.08, 0, 0.06], rf: [0.08, 0.02, -0.12], kneeR: 0.1, r: at(1, 0.2, 0.55, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.55, 0.1, [1, 0, -0.3]), ...FIST }],
    ],
  }),
  full({
    id: 't-step', name: 'T-Step', tags: 'hiphop | legs | twist', beats: 2, level: 'mid', d: 3, parts: ['legs'], mirror: true,
    desc: 'Shuffle T-step: swivel the standing toe out and in while the other leg hangs out to the side, knee bent.',
    keys: [
      [0, { y: -0.05, x: 0.02, hips: 0.02, kneeR: 0.55, rf: [0.09, 0, 0], lf: [-0.24, 0.12, 0.02], kneeL: 0.3, lean: 3, r: at(1, 0.24, 0.62, 0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.68, 0.06, [1, 0, -0.3]), ...OPEN }],
      [0.5, { y: -0.03, x: 0.02, hips: 0.02, kneeR: -0.4, rf: [0.09, 0, 0], lf: [-0.22, 0.06, 0.02], kneeL: 0.3, r: at(1, 0.24, 0.6, 0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.64, 0.06, [1, 0, -0.3]), ...OPEN }],
      [1, { y: -0.05, x: 0.02, hips: 0.02, kneeR: 0.55, rf: [0.09, 0, 0], lf: [-0.24, 0.12, 0.02], kneeL: 0.3, lean: 3, r: at(1, 0.24, 0.62, 0.06, [1, 0, -0.3]), l: at(-1, -0.3, 0.68, 0.06, [1, 0, -0.3]), ...OPEN }],
      [1.5, { y: -0.04, x: 0.0, kneeR: 0, rf: [0.09, 0, 0], lf: [-0.11, 0.02, 0], r: [16, 10, 30, 50], l: [16, 10, 30, 50], ...OPEN }],
    ],
  }),

  // Tutting, waving and krump
  full({
    id: 'tut-box', name: 'Tut Box', tags: 'hiphop | arms | hands', beats: 4, level: 'low', d: 2, parts: ['arms'], bounce: 0.5,
    desc: 'Tutting: snap the forearms through square shapes in front of the chest, a new right-angle box on every beat.',
    keys: [
      [0, { y: -0.04, r: at(1, 0.24, 0.98, 0.16, [1, -0.2, -0.3]), l: at(-1, 0.1, 0.74, 0.22, [1, -0.3, 0]), handR: 1, handL: 1 }],
      [1, { y: -0.02, r: at(1, 0.24, 0.98, 0.16, [1, -0.2, -0.3]), l: at(-1, -0.24, 0.98, 0.16, [1, -0.2, -0.3]), handR: 1, handL: 1 }],
      [2, { y: -0.04, l: at(-1, -0.24, 0.98, 0.16, [1, -0.2, -0.3]), r: at(1, -0.1, 0.74, 0.22, [1, -0.3, 0]), handR: 1, handL: 1 }],
      [3, { y: -0.02, r: at(1, -0.06, 0.82, 0.24, [1, -0.3, 0]), l: at(-1, 0.06, 0.66, 0.22, [1, -0.3, 0]), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'arm-wave', name: 'Arm Wave', tags: 'hiphop funk | arms | wave', beats: 4, level: 'low', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Arms out wide: roll a wave in from one fingertip, up through the elbow, across the shoulders and out the other hand.',
    keys: [
      [0, { y: -0.03, lean: 0, r: [86, 0, 120, 0], l: [90, 0, 86, 0], handR: 1, handL: 1 }],
      [1, { y: -0.04, lean: 3, shR: 1, r: [98, 0, 60, 0], l: [90, 0, 90, 0], handR: 1, handL: 1 }],
      [2, { y: -0.03, lean: -3, shR: 0, shL: 1, r: [84, 0, 92, 0], l: [98, 0, 60, 0], handR: 1, handL: 1 }],
      [3, { y: -0.04, shL: 0, r: [88, 0, 90, 0], l: [84, 0, 124, 0], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'krump-stomp', name: 'Krump Stomp', tags: 'hiphop rock | full | stomp', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Lift the knee, stomp wide and swing one fist hard down across the body as the other arm flings up and back.',
    keys: [
      [0, { y: -0.13, chestX: -0.03, lean: -5, nod: 6, rf: [0.2, 0, 0.02], lf: [-0.13, 0, 0], kneeR: 0.2, kneeL: 0.2, r: at(1, -0.12, 0.42, 0.2, [0.6, -1, 0]), l: at(-1, -0.34, 1.06, -0.02, [1, 0.3, -0.3]), ...FIST }],
      [0.5, { y: -0.08, rf: [0.2, 0, 0.02], lf: [-0.13, 0, 0], r: at(1, -0.04, 0.5, 0.2, [0.6, -1, 0]), l: at(-1, -0.32, 0.98, 0.02, [1, 0.3, -0.3]), ...FIST }],
      [1, { y: -0.04, rf: [0.12, 0.05, 0.02], lf: [-0.11, 0, 0], r: at(1, 0.17, 0.78, 0.16, [1, -0.3, 0]), l: at(-1, -0.17, 0.78, 0.16, [1, -0.3, 0]), ...FIST }],
      [1.5, { y: -0.02, lean: -3, rf: [0.14, 0.16, 0.08], lf: [-0.11, 0, 0], r: at(1, 0.2, 0.84, 0.14, [1, -0.3, 0]), l: at(-1, -0.2, 0.84, 0.14, [1, -0.3, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'krump-arm-swing', name: 'Krump Arm Swing', tags: 'hiphop rock | arms full |', beats: 2, level: 'high', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Throw one arm up high, then swing it hard down across the body into a low dip, and come back up to guard.',
    keys: [
      [0, { y: -0.03, lean: -5, nod: -6, r: at(1, 0.3, 1.14, 0.02, [1, 0.3, -0.3]), l: at(-1, -0.17, 0.74, 0.16, [1, -0.3, 0]), ...FIST }],
      [1, { y: -0.12, bend: 9, lean: 6, twist: 16, nod: 8, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], r: at(1, -0.04, 0.46, 0.3, [0.6, -1, 0]), l: at(-1, -0.3, 0.68, -0.06, [1, 0.2, -0.3]), ...FIST }],
      [1.5, { y: -0.06, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: at(1, 0.17, 0.74, 0.16, [1, -0.3, 0]), l: at(-1, -0.17, 0.74, 0.16, [1, -0.3, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'krump-chest-pop', name: 'Krump Chest Pop', tags: 'hiphop | full |', beats: 1, level: 'mid', d: 2, parts: ['torso', 'arms'],
    desc: 'Pop the chest up and out on every beat as both arms flare down and back with open hands, then recoil.',
    keys: [
      [0, wide(-0.05, { bend: -9, nod: -8, shR: 0.8, shL: 0.8, r: at(1, 0.32, 0.5, -0.1, [1, 0, -0.5]), l: at(-1, -0.32, 0.5, -0.1, [1, 0, -0.5]), ...OPEN })],
      [0.5, wide(-0.1, { bend: 8, nod: 6, r: at(1, 0.14, 0.62, 0.2, [1, -0.3, 0]), l: at(-1, -0.14, 0.62, 0.2, [1, -0.3, 0]), handR: 0.2, handL: 0.2 })],
    ],
  }),
  // Party dances (added Nov 2026)
  full({
    id: 'the-wop', name: 'Wop', tags: 'hiphop | full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso', 'legs'],
    desc: 'Sway onto one side on each beat, bending the knees and dropping that shoulder, as the arms trade across the chest: one hand from beside the ear over to the far shoulder.',
    keys: [[0, wopA], [1, mir(wopA)]],
  }),
  combo('the-smurf', 'Smurf', 'bounce', 'hhSmurf', 'mid', 1, 'hiphop | arms |', {
    desc: 'Bounce the knees to the beat while the fists swim: one drives forward up by the shoulder as the other pulls back, then they swap.',
  }),
  combo('smurf-two-step', 'Smurf Two-Step', 'twoStep', 'hhSmurf', 'mid', 2, 'hiphop | full | walk', {
    desc: 'The Smurf\'s swimming fists over a two-step instead of the bounce.',
  }),
  full({
    id: 'shmoney', name: 'Shmoney', tags: 'hiphop | full | hips twist', beats: 4, level: 'mid', d: 2, parts: ['arms', 'hips', 'torso'],
    desc: 'Arms up and relaxed by the head, sway the hips on a loose two-step, then twist the back and arms from side to side.',
    keys: [
      [0, { y: -0.06, x: 0.03, hips: 0.045, tilt: 6, rf: [0.16, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.24, 1.05, 0.08, [1, 0.3, -0.3]), l: at(-1, -0.2, 1.0, 0.1, [1, 0.3, -0.3]), handR: 0.6, handL: 0.6 }],
      [1, { y: -0.06, x: -0.03, hips: -0.045, tilt: -6, rf: [0.09, 0, 0], lf: [-0.16, 0, 0], r: at(1, 0.2, 1.0, 0.1, [1, 0.3, -0.3]), l: at(-1, -0.24, 1.05, 0.08, [1, 0.3, -0.3]), handR: 0.6, handL: 0.6 }],
      [2, { y: -0.08, twist: 26, hipTwist: 8, lean: 3, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.3, 0.98, -0.02, [1, 0.3, -0.3]), l: at(-1, -0.06, 1.02, 0.16, [1, 0.3, -0.3]), handR: 0.6, handL: 0.6 }],
      [3, { y: -0.08, twist: -26, hipTwist: -8, lean: -3, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.06, 1.02, 0.16, [1, 0.3, -0.3]), l: at(-1, -0.3, 0.98, -0.02, [1, 0.3, -0.3]), handR: 0.6, handL: 0.6 }],
    ],
  }),
  full({
    id: 'bernie', name: 'Bernie', tags: 'hiphop party | full |', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'],
    desc: 'Head tipped back and chest up, lean from side to side on loose steps with the arms dangling and flopping.',
    keys: [[0, bernieA], [0.5, bernieFlail], [1, mir(bernieA)], [1.5, mir(bernieFlail)]],
  }),
  full({
    id: 'lean-back', name: 'Lean Back', tags: 'hiphop | full legs |', beats: 2, level: 'low', d: 1, parts: ['torso', 'legs'], mirror: true,
    desc: 'Step one foot back and lean back off it, throwing that shoulder back on the beat, then roll it forward as you come back in.',
    keys: [
      [0, { y: -0.09, x: 0.03, bend: -10, twist: -30, lean: 9, nod: -8, head: 7, shR: 1.3, kneeR: 0.15, rf: [0.13, 0, -0.13], lf: [-0.09, 0, 0.02], r: at(1, 0.28, 0.5, -0.17, [1, 0, -0.5]), l: at(-1, -0.2, 0.52, 0.08, [1, 0, -0.3]), handR: 0.3, handL: 0.3 }],
      [1, { y: -0.03, bend: 6, twist: 10, lean: -2, shR: 0.3, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.2, 0.55, 0.1, [1, 0, -0.3]), l: at(-1, -0.2, 0.55, 0.08, [1, 0, -0.3]), handR: 0.3, handL: 0.3 }],
    ],
  }),
  full({
    id: 'griddy', name: 'Griddy', tags: 'hiphop party | legs arms | walk', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Tap the heels out in front, right, left, right, the arms swinging opposite, then throw the hands up round the eyes like glasses.',
    keys: [[0, griddyTap(1)], [1, griddyTap(-1)], [2, griddyTap(1)], [3, griddyGlasses]],
  }),
  full({
    id: 'jet-griddy', name: 'Jet Griddy', tags: 'hiphop party | legs arms | walk', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'The Griddy\'s heel taps with the arms held out wide like wings, tipping with the taps, then the glasses round the eyes.',
    keys: [[0, griddyTap(1, true)], [1, griddyTap(-1, true)], [2, griddyTap(1, true)], [3, griddyGlasses]],
  }),
  full({
    id: 'toprock-cross-step', name: 'Toprock Cross Step', tags: 'hiphop | legs arms |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'B-boy toprock basic: bounce and cross one foot in front of the other as the fists cross in front, then step it back out wide and open the arms.',
    keys: [
      [0, { y: -0.07, bend: 7, nod: 4, twist: -8, rf: [-0.05, 0, 0.09], lf: [-0.1, 0, -0.02], r: at(1, -0.05, 0.7, 0.22, [0.6, -1, 0]), l: at(-1, 0.06, 0.66, 0.2, [0.6, -1, 0]), ...FIST }],
      [1, { y: -0.04, bend: 2, rf: [0.2, 0, 0], lf: [-0.1, 0, 0], r: at(1, 0.34, 0.76, 0.06, [1, 0, -0.3]), l: at(-1, -0.32, 0.74, 0.06, [1, 0, -0.3]), ...FIST }],
    ],
  }),
  full({
    id: 'toprock-kick-step', name: 'Toprock Kick Step', tags: 'hiphop | legs | kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Toprock kick step: cross one foot back behind the other, then kick it out to the side to uncross and step it down, arms opening with the kick.',
    keys: [
      [0, { y: -0.07, bend: 5, rf: [-0.05, 0, -0.08], lf: [-0.09, 0, 0.02], r: at(1, 0.14, 0.68, 0.18, [1, -0.3, 0]), l: at(-1, -0.14, 0.68, 0.18, [1, -0.3, 0]), ...FIST }],
      [1, { y: -0.03, lean: -6, rf: [0.26, 0.12, 0.03], lf: [-0.09, 0, 0], r: at(1, 0.34, 0.8, 0.04, [1, 0, -0.3]), l: at(-1, -0.26, 0.7, 0.12, [1, 0, -0.3]), ...FIST }],
      [1.5, { y: -0.05, rf: [0.12, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.2, 0.7, 0.14, [1, -0.3, 0]), l: at(-1, -0.18, 0.7, 0.14, [1, -0.3, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'humpty-hop', name: 'Humpty Hop', tags: 'hiphop funk | legs | jump', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'From the Humpty Dance: hop and cross one leg in front, landing on the and, hop back out on the beat, the arms swinging back after each hop.',
    keys: [
      [0, { y: -0.08, bend: 6, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.22, 0.5, -0.12, [1, 0, -0.5]), l: at(-1, -0.22, 0.5, -0.12, [1, 0, -0.5]), handR: 0.3, handL: 0.3 }],
      [0.5, { y: 0.035, rf: [0.03, 0.06, 0.06], lf: [-0.09, 0.05, 0], r: at(1, 0.2, 0.62, 0.12, [1, -0.3, 0]), l: at(-1, -0.2, 0.62, 0.12, [1, -0.3, 0]), handR: 0.3, handL: 0.3 }],
      [1, { y: -0.08, bend: 6, lean: -4, rf: [-0.05, 0, 0.07], lf: [-0.1, 0, -0.02], r: at(1, 0.24, 0.5, -0.12, [1, 0, -0.5]), l: at(-1, -0.2, 0.5, -0.12, [1, 0, -0.5]), handR: 0.3, handL: 0.3 }],
      [1.5, { y: 0.035, rf: [0.06, 0.06, 0.04], lf: [-0.1, 0.05, 0], r: at(1, 0.2, 0.62, 0.12, [1, -0.3, 0]), l: at(-1, -0.2, 0.62, 0.12, [1, -0.3, 0]), handR: 0.3, handL: 0.3 }],
    ],
  }),
];
