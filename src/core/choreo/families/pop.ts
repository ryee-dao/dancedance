/** Pop / jazz: the twist, box step, chassé, jazz square, triple step, waves, turns. */

import { ARM, CHEST_BOX, OPEN_LOW, W, mir, type PoseSpec } from '../poseKit';
import { combo, type MoveDef, type PatternSet } from '../catalog';

const twistA: PoseSpec = { y: -0.08, x: 0.015, hipTwist: -32, twist: 40, lean: 4, turn: -22, rf: [0.12, 0, 0.0], lf: [-0.12, 0.03, 0.03] };
const rippleA: PoseSpec = { lean: 3, head: -3, r: [100, 0, 64, 0], l: [80, 0, 116, 0], handR: 1, handL: 1 };
const pendA: PoseSpec = { r: [52, 8, 58, 14], l: [38, 138, 46, 128], handR: 1, handL: 1 };
const oceanA: PoseSpec = { lean: 11, head: 6, r: [128, 0, 134, 0], l: [186, 0, 214, 0], handR: 1, handL: 1 };
const oceanMid: PoseSpec = { r: [160, 0, 167, 0], l: [160, 0, 167, 0], handR: 1, handL: 1 };
const swimA: PoseSpec = { twist: -8, r: [162, 55, 166, 55], l: [28, -40, 32, -40], handR: 1, handL: 1 };
const jazzA: PoseSpec = { r: [58, 22, 70, 30], l: [58, 22, 70, 30], handR: 1, handL: 1 };
const jazzB: PoseSpec = { r: [52, 22, 62, 30], l: [52, 22, 62, 30], handR: 0.85, handL: 0.85 };

export const patterns: PatternSet = {
  foot: {
    twist: { beats: 2, parts: ['hips', 'torso'], torso: true, keys: [[0, twistA], [1, mir(twistA)]] },
    boxStep: {
      beats: 4, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: -0.02, hipTwist: -8, rf: [-0.03, 0, 0.1], lf: [-W, 0, 0] }],
        [1, { x: -0.05, y: -0.02, rf: [-0.03, 0, 0.1], lf: [-0.13, 0, -0.1] }],
        [2, { x: 0.0, rf: [0.11, 0, -0.09], lf: [-0.13, 0, -0.1] }],
        [3, { x: 0.0, y: -0.03, rf: [0.11, 0, -0.09], lf: [-W, 0, 0.03] }],
      ],
    },
    chasse: {
      beats: 2, parts: ['legs'], mirror: true, travel: 0.22,
      keys: [
        [0, { x: 0.07, rf: [0.2, 0, 0], lf: [-W, 0, 0], hips: 0.015 }],
        [0.5, { x: 0.13, y: -0.02, rf: [0.2, 0, 0], lf: [0.1, 0, 0] }],
        [1, { x: 0.2, rf: [0.31, 0, 0], lf: [0.1, 0, 0], hips: 0.015 }],
        [1.5, { x: 0.22, y: -0.03, rf: [0.31, 0, 0], lf: [0.13, 0, 0] }],
      ],
    },
    jazzSquare: {
      beats: 4, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { x: -0.02, rf: [-0.035, 0, 0.11], lf: [-0.11, 0, 0], twist: -8, hipTwist: -10 }],
        [1, { x: -0.03, rf: [-0.035, 0, 0.11], lf: [-0.12, 0, -0.11], twist: -4 }],
        [2, { x: 0.0, rf: [0.12, 0, -0.08], lf: [-0.12, 0, -0.11], twist: 4 }],
        [3, { x: 0.0, y: -0.03, rf: [0.12, 0, -0.08], lf: [-0.09, 0, 0.04], twist: 0 }],
      ],
    },
    triple: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { rf: [0.02, 0.0, -0.08], y: -0.03, hips: 0.01 }],
        [0.5, { rf: [0.02, 0.0, -0.08], lf: [-0.18, 0, 0], y: -0.02 }],
        [1, { rf: [0.09, 0, 0.03], lf: [-0.18, 0, 0], y: -0.035 }],
        [1.5, { rf: [0.09, 0, 0.03], lf: [-0.12, 0, 0], y: -0.015 }],
      ],
    },
  },
  arms: {
    twistArms: { beats: 1, parts: [], keys: [[0, { r: CHEST_BOX, l: CHEST_BOX, handR: 0, handL: 0 }]] },
    ripple: { beats: 2, parts: ['arms'], torso: true, keys: [[0, rippleA], [1, mir(rippleA)]] },
    pendulum: { beats: 2, parts: ['arms'], keys: [[0, pendA], [1, mir(pendA)]] },
    ocean: { beats: 4, parts: ['arms', 'torso'], torso: true, keys: [[0, oceanA], [1, oceanMid], [2, mir(oceanA)], [3, oceanMid]] },
    rainbow: {
      beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true,
      keys: [
        [0, { lean: -17, head: -8, r: [176, -20, 230, -15], l: ARM.hip, handR: 1, handL: 0 }],
        [1, { lean: 4, r: OPEN_LOW, l: ARM.hip, handR: 1, handL: 0 }],
      ],
    },
    swim: { beats: 2, parts: ['arms'], torso: true, keys: [[0, swimA], [1, mir(swimA)]] },
    jazzHands: { beats: 1, parts: ['arms'], keys: [[0, jazzA], [0.5, jazzB]] },
  },
};

export const moves: MoveDef[] = [
  combo('the-twist', 'The Twist', 'twist', 'twistArms', 'mid', 1, 'funk pop | hips full | twist'),
  combo('box-step', 'Box Step', 'boxStep', 'rest', 'mid', 2, 'pop latin | legs | walk'),
  combo('box-clap', 'Box Step Clap', 'boxStep', 'clap', 'mid', 3, 'pop | legs | clap walk'),
  combo('swim', 'Freestyle Swim', 'sway', 'swim', 'mid', 2, 'pop disco | arms | wave'),
  combo('ocean-arms', 'Ocean Arms', 'bounce', 'ocean', 'low', 1, 'pop | arms | wave'),
  combo('ripple', 'Ripple Wave', 'sway', 'ripple', 'low', 1, 'pop kpop | arms | wave'),
  combo('pendulum', 'Pendulum Sway', 'sway', 'pendulum', 'low', 1, 'pop | arms |'),
  combo('wave-step', 'Wave Step', 'stepTouch', 'ripple', 'low', 2, 'pop kpop | arms | wave'),
  combo('ocean-step', 'Ocean Step', 'stepTouch', 'ocean', 'low', 2, 'pop | arms | wave'),
  combo('rainbow', 'Rainbow Reach', 'tapSide', 'rainbow', 'mid', 2, 'pop | arms | wave'),
  combo('clap-groove', 'Clap Groove', 'sway', 'clapEvery', 'low', 1, 'pop hiphop | arms | clap hands'),
  combo('chasse', 'Chassé', 'chasse', 'jazzHands', 'mid', 2, 'pop | legs | walk'),
  combo('jazz-square', 'Jazz Square', 'jazzSquare', 'snaps', 'mid', 2, 'pop funk | legs | walk'),
  combo('triple-step', 'Triple Step', 'triple', 'jazzHands', 'mid', 2, 'pop | legs | walk'),
  combo('step-jazz-hands', 'Step Touch Jazz Hands', 'stepTouch', 'jazzHands', 'low', 1, 'pop | legs arms | hands walk'),
  combo('pivot-turn', 'Pivot Turn', 'pivot', 'hips', 'mid', 3, 'pop funk | turn | spin walk'),
  combo('spin', 'Spin', 'spin', 'turnArms', 'mid', 3, 'pop funk disco | turn | spin'),
  combo('turn-around', 'Turn Around', 'halfTurn', 'hips', 'mid', 2, 'pop latin | turn | spin'),
];
