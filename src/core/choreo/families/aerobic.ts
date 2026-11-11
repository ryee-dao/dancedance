/**
 * Aerobics / dance-fitness staples: step touch, grapevine, march, taps, kicks,
 * squats, lunges, jacks, punches and the classic arm patterns.
 */

import { ARM, CHEST_BOX, FIST, OPEN, OPEN_LOW, W, at, hand, mir, type ArmAngles, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';
import { mirrored, pose } from '../../coach/poses';

const marchA: PoseSpec = { rf: [0.08, 0.13, 0.1], x: -0.01, lean: -1, head: 1.5 };
const jogA: PoseSpec = { y: 0.02, x: -0.01, rf: [0.08, 0.13, 0.1] };
const jogDown: PoseSpec = { y: -0.035 };

const GUARD = ARM.guard;
const jabA: PoseSpec = { twist: -14, turn: 8, r: ARM.jab, l: GUARD, ...FIST };
const skyA: PoseSpec = { lean: 5, head: 3, nod: -6, r: ARM.sky, l: GUARD, ...FIST };
const crossA: PoseSpec = { twist: -26, turn: 14, r: ARM.cross, l: GUARD, ...FIST };
const upperA: PoseSpec = { twist: -12, turn: 6, nod: -4, r: hand(-0.09, 0.1, 0.17, [0.15, -1, 0.15]), l: GUARD, ...FIST };
const sidePunchA: PoseSpec = { lean: -3, head: -3, r: [90, 0, 90, 0], l: GUARD, ...FIST };
const marchArmsA: PoseSpec = { r: ARM.swingBack, l: ARM.swingFwd, ...FIST };
const airA: PoseSpec = { lean: 13, head: 5, r: [90, 0, 90, 0], l: [90, 0, 90, 0], ...OPEN };
const climbA: PoseSpec = { nod: -8, r: at(1, 0.03, 1.08, 0.08, [1, 0, -0.3]), l: at(-1, -0.03, 0.8, 0.13, [0.6, -1, -0.2]), handR: 0, handL: 0 };
const reachA: PoseSpec = { lean: 6, r: [98, 0, 98, 0], l: CHEST_BOX, handR: 1, handL: 0 };
const curlUp: ArmAngles = [10, 20, 150, 75];
const curlDown: ArmAngles = [8, 10, 14, 25];

export const patterns: PatternSet = {
  foot: {
    stepTouch: {
      beats: 2, parts: ['legs'], mirror: true, travel: 0.16,
      keys: [
        [0, { x: 0.08, hips: 0.02, rf: [0.25, 0, 0], lf: [-W, 0, 0], head: -2 }],
        [1, { x: 0.16, y: -0.03, rf: [0.25, 0, 0], lf: [0.07, 0.02, 0.01] }],
      ],
    },
    doubleStep: {
      beats: 4, parts: ['legs'], mirror: true, travel: 0.3,
      keys: [
        [0, { x: 0.075, hips: 0.02, rf: [0.24, 0, 0], lf: [-W, 0, 0] }],
        [1, { x: 0.15, y: -0.03, rf: [0.24, 0, 0], lf: [0.06, 0.02, 0.01] }],
        [2, { x: 0.225, hips: 0.02, rf: [0.39, 0, 0], lf: [0.06, 0, 0] }],
        [3, { x: 0.3, y: -0.03, rf: [0.39, 0, 0], lf: [0.21, 0.02, 0.01] }],
      ],
    },
    vine: {
      beats: 4, parts: ['legs'], mirror: true, travel: 0.32,
      keys: [
        [0, { x: 0.07, hips: 0.02, rf: [0.22, 0, 0], lf: [-W, 0, 0] }],
        [1, { x: 0.19, y: -0.03, twist: 6, rf: [0.22, 0, 0], lf: [0.29, 0, -0.08] }],
        [2, { x: 0.3, hips: 0.02, rf: [0.41, 0, 0], lf: [0.29, 0, -0.08] }],
        [3, { x: 0.32, y: -0.03, rf: [0.41, 0, 0], lf: [0.23, 0.02, 0.01] }],
      ],
    },
    march: { beats: 2, parts: ['legs'], keys: [[0, marchA], [1, mir(marchA)]] },
    tapSide: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.04, x: -0.02, lean: -3, rf: [0.3, 0, 0.02] }],
        [1, { y: 0.0, rf: [W, 0, 0] }],
      ],
    },
    heelDig: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.045, x: -0.03, bend: -6, nod: 4, rf: [0.22, 0.03, 0.2] }],
        [1, { y: -0.015 }],
      ],
    },
    kneeLift: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: -0.02, lean: -2, nod: 5, rf: [0.07, 0.23, 0.2] }],
        [1, { y: -0.02, nod: -2 }],
      ],
    },
    kickSide: {
      beats: 2, parts: ['legs'], mirror: true, torso: true,
      keys: [
        [0, { x: -0.035, lean: -13, head: 6, rf: [0.36, 0.16, 0.04] }],
        [1, { y: -0.04 }],
      ],
    },
    kickFront: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: -0.02, y: 0, bend: -5, rf: [0.09, 0.22, 0.4] }],
        [1, { y: -0.04 }],
      ],
    },
    squat: {
      beats: 2, parts: ['legs'], impact: true, torso: true,
      keys: [
        [0, { y: -0.2, bend: 14, nod: -8, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
        [1, { y: -0.01, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
      ],
    },
    sumo: {
      beats: 2, parts: ['legs'], impact: true,
      keys: [
        [0, { y: -0.24, rf: [0.21, 0, 0], lf: [-0.21, 0, 0] }],
        [1, { y: -0.03, rf: [0.21, 0, 0], lf: [-0.21, 0, 0] }],
      ],
    },
    sideLunge: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { x: 0.1, y: -0.1, hips: 0.01, rf: [0.31, 0, 0], lf: [-0.11, 0, 0] }],
        [1, { y: -0.02 }],
      ],
    },
    jack: {
      beats: 2, parts: ['jump', 'legs'], jump: true,
      keys: [
        [0, { y: -0.05, rf: [0.22, 0, 0], lf: [-0.22, 0, 0] }],
        [0.5, { y: 0.07, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
        [1, { y: -0.05, rf: [0.075, 0, 0], lf: [-0.075, 0, 0] }],
        [1.5, { y: 0.07, rf: [0.15, 0, 0], lf: [-0.15, 0, 0] }],
      ],
    },
    jog: { beats: 2, parts: ['jump', 'legs'], jump: true, keys: [[0, jogA], [0.5, jogDown], [1, mir(jogA)], [1.5, jogDown]] },
  },
  arms: {
    clap: { beats: 2, parts: ['arms'], keys: [[0, { r: OPEN_LOW, l: OPEN_LOW, ...OPEN }], [1, { r: ARM.clap, l: ARM.clap, ...OPEN }]] },
    clapEvery: { beats: 1, parts: ['arms'], keys: [[0, { r: ARM.clap, l: ARM.clap, ...OPEN }], [0.5, { r: [40, 30, 50, 60], l: [40, 30, 50, 60], ...OPEN }]] },
    clapHigh: { beats: 2, parts: ['arms'], keys: [[0, { r: [46, 0, 50, 0], l: [46, 0, 50, 0], ...OPEN }], [1, { nod: -6, r: ARM.clapHigh, l: ARM.clapHigh, ...OPEN }]] },
    clapV: { beats: 2, parts: ['arms'], keys: [[0, { r: ARM.clap, l: ARM.clap, ...OPEN }], [1, { r: ARM.v, l: ARM.v, ...OPEN }]] },
    jab: { beats: 2, parts: ['arms'], torso: true, keys: [[0, jabA], [1, mir(jabA)]] },
    skyPunch: { beats: 2, parts: ['arms'], torso: true, keys: [[0, skyA], [1, mir(skyA)]] },
    crossJab: { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, crossA], [1, mir(crossA)]] },
    uppercut: { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, upperA], [1, mir(upperA)]] },
    sidePunch: { beats: 2, parts: ['arms'], torso: true, keys: [[0, sidePunchA], [1, mir(sidePunchA)]] },
    shoulderPress: { beats: 2, parts: ['arms'], keys: [[0, { nod: -5, r: ARM.up, l: ARM.up, ...FIST }], [1, { r: ARM.goal, l: ARM.goal, ...FIST }]] },
    pushOut: { beats: 2, parts: ['arms'], keys: [[0, { r: [88, 0, 92, -5], l: [88, 0, 92, -5], ...OPEN }], [1, { r: CHEST_BOX, l: CHEST_BOX, ...FIST }]] },
    bicepCurl: { beats: 2, parts: ['arms'], keys: [[0, { r: curlUp, l: curlUp, ...FIST }], [1, { r: curlDown, l: curlDown, ...FIST }]] },
    latPull: { beats: 2, parts: ['arms'], keys: [[0, { nod: -4, r: ARM.v, l: ARM.v, ...OPEN }], [1, { r: [84, 0, 168, 8], l: [84, 0, 168, 8], ...FIST }]] },
    butterfly: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: ARM.goal, l: ARM.goal, ...FIST }],
        [1, { r: [75, 125, 160, 90], l: [75, 125, 160, 90], ...FIST }],
      ],
    },
    marchArms: { beats: 2, parts: ['arms'], keys: [[0, marchArmsA], [1, mir(marchArmsA)]] },
    pullDown: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: hand(-0.05, -0.27, 0.16, [0.6, 0.2, -1]), l: hand(-0.1, -0.27, 0.16, [0.6, 0.2, -1]), ...FIST }],
        [1, { r: ARM.v, l: ARM.v, ...OPEN }],
      ],
    },
    airplane: { beats: 2, parts: ['arms', 'torso'], torso: true, keys: [[0, airA], [1, mir(airA)]] },
    xArms: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: hand(-0.2, -0.12, 0.21, [0.4, -1, -0.2]), l: hand(-0.22, -0.08, 0.25, [0.4, -1, -0.2]), ...FIST }],
        [1, { r: [128, 0, 132, 0], l: [128, 0, 132, 0], ...OPEN }],
      ],
    },
    ropeClimb: { beats: 2, parts: ['arms'], keys: [[0, climbA], [1, mir(climbA)]] },
    sideReach: { beats: 2, parts: ['arms'], mirror: true, torso: true, keys: [[0, reachA], [1, { r: [20, 0, 26, 10], l: CHEST_BOX, handR: 1, handL: 0 }]] },
    jackArms: {
      beats: 2, parts: ['arms'],
      keys: [
        [0, { r: [142, 0, 148, 0], l: [142, 0, 148, 0], ...OPEN }],
        [0.5, { r: [82, 0, 86, 0], l: [82, 0, 86, 0], ...OPEN }],
        [1, { r: [16, 0, 18, 0], l: [16, 0, 18, 0], ...OPEN }],
        [1.5, { r: [80, 0, 84, 0], l: [80, 0, 84, 0], ...OPEN }],
      ],
    },
    crunch: {
      beats: 2, parts: ['arms', 'torso'], mirror: true, torso: true,
      keys: [
        // Left elbow down across to the rising right knee.
        [0, { twist: -22, bend: 10, lean: 6, nod: 8, r: [88, 0, 172, 10], l: at(-1, 0.03, 0.62, 0.17, [0.2, -1, 0.4]), ...FIST }],
        [1, { r: [88, 0, 172, 10], l: [88, 0, 172, 10], ...FIST }],
      ],
    },
  },
};

const skaterA: PoseSpec = {
  y: -0.08, x: 0.15, lean: 6, bend: 8, rf: [0.19, 0, 0], lf: [0.03, 0.09, -0.12],
  r: [42, 122, 48, 140], l: [44, 0, 48, 0], head: 4, handR: 1, handL: 1,
};
const skaterAir: PoseSpec = { y: 0.06, x: 0.0, rf: [0.09, 0.02, -0.04], lf: [-0.09, 0.02, -0.04], r: [20, 60, 30, 80], l: [20, 60, 30, 80] };
const M = (s: PoseSpec) => mirrored(pose(s));

export const moves: MoveDef[] = [
  // Step touch family
  combo('step-touch', 'Step Touch', 'stepTouch', 'rest', 'low', 1, 'aerobic pop | legs | walk'),
  combo('step-clap', 'Step Touch Clap', 'stepTouch', 'clap', 'low', 1, 'aerobic pop | legs arms | clap walk'),
  combo('step-swing', 'Step Touch Swing', 'stepTouch', 'pendulum', 'low', 1, 'aerobic pop | legs arms | walk'),
  combo('step-high-clap', 'Step Touch High Clap', 'stepTouch', 'clapHigh', 'low', 2, 'aerobic pop | arms legs | clap'),
  combo('step-sky', 'Step Touch Punch Up', 'stepTouch', 'skyPunch', 'mid', 2, 'aerobic rock | arms | punch'),
  combo('step-press', 'Step Touch Press', 'stepTouch', 'shoulderPress', 'mid', 2, 'aerobic | arms |'),
  combo('step-curl', 'Step & Curl', 'stepTouch', 'bicepCurl', 'low', 2, 'aerobic | arms |'),
  combo('step-side-punch', 'Step Touch Side Punch', 'stepTouch', 'sidePunch', 'mid', 2, 'aerobic | arms | punch'),
  combo('step-cross', 'Step Touch Cross Jab', 'stepTouch', 'crossJab', 'mid', 2, 'aerobic | arms | punch'),
  combo('step-butterfly', 'Step Touch Butterfly', 'stepTouch', 'butterfly', 'low', 2, 'aerobic | arms |'),
  combo('double-step', 'Double Step Touch', 'doubleStep', 'rest', 'low', 2, 'aerobic pop | legs | walk'),
  combo('double-clap', 'Double Step Clap', 'doubleStep', 'clap', 'mid', 2, 'aerobic pop | legs | clap walk'),
  combo('double-press', 'Double Step Press', 'doubleStep', 'shoulderPress', 'mid', 2, 'aerobic | full |'),
  // Grapevine
  combo('vine', 'Grapevine', 'vine', 'rest', 'mid', 2, 'aerobic pop | legs | walk'),
  combo('vine-clap', 'Grapevine Clap', 'vine', 'clap', 'mid', 2, 'aerobic pop | legs | clap walk'),
  combo('vine-sky', 'Grapevine Punch Up', 'vine', 'skyPunch', 'mid', 3, 'aerobic | full | punch walk'),
  // March
  combo('march', 'March', 'march', 'marchArms', 'low', 1, 'aerobic rock | legs | walk stomp'),
  combo('march-sky', 'March & Punch Up', 'march', 'skyPunch', 'mid', 2, 'aerobic rock | full | punch'),
  combo('march-press', 'March & Press', 'march', 'shoulderPress', 'mid', 2, 'aerobic | full |'),
  combo('march-clap', 'March & Clap', 'march', 'clapEvery', 'low', 2, 'aerobic rock | legs | clap stomp'),
  combo('march-curl', 'March & Curl', 'march', 'bicepCurl', 'low', 2, 'aerobic | arms |'),
  combo('march-push', 'March & Push Out', 'march', 'pushOut', 'low', 2, 'aerobic | arms | hands'),
  // Taps, heels, knees, kicks
  combo('side-tap', 'Side Tap', 'tapSide', 'hips', 'low', 1, 'aerobic pop | legs |'),
  combo('tap-punch', 'Tap & Side Punch', 'tapSide', 'sidePunch', 'mid', 2, 'aerobic | arms | punch'),
  combo('tap-high-clap', 'Tap & High Clap', 'tapSide', 'clapHigh', 'mid', 2, 'aerobic pop | arms | clap'),
  combo('heel-push', 'Heel Dig Push Out', 'heelDig', 'pushOut', 'low', 2, 'aerobic | legs | hands'),
  combo('heel-clap', 'Heel Dig Clap', 'heelDig', 'clap', 'low', 2, 'aerobic pop | legs | clap'),
  combo('knee-lift', 'Knee Lift', 'kneeLift', 'hips', 'mid', 1, 'aerobic | legs |'),
  combo('knee-pump', 'Knee Pump', 'kneeLift', 'pullDown', 'mid', 2, 'aerobic rock | full |'),
  combo('standing-crunch', 'Standing Crunch', 'kneeLift', 'crunch', 'mid', 3, 'aerobic | full |'),
  combo('side-kick', 'Side Kick', 'kickSide', 'guard', 'mid', 2, 'aerobic kpop | legs | kick'),
  combo('kick-punch', 'Side Kick Punch', 'kickSide', 'sidePunch', 'mid', 3, 'aerobic | full | kick punch'),
  // Squats and lunges
  combo('chair-squat', 'Chair Squat', 'squat', 'clapV', 'high', 1, 'aerobic | legs |'),
  combo('sumo-squat', 'Sumo Squat', 'sumo', 'hips', 'high', 1, 'aerobic | legs |'),
  combo('sumo-press', 'Sumo Press', 'sumo', 'shoulderPress', 'high', 2, 'aerobic | full |', { shift: 1 }),
  combo('lunge-reach', 'Side Lunge Reach', 'sideLunge', 'sideReach', 'mid', 2, 'aerobic | full |'),
  combo('lunge-cross', 'Lunge & Cross', 'sideLunge', 'crossJab', 'mid', 3, 'aerobic | full | punch', { shift: 1 }),
  combo('lunge-sky', 'Lunge & Punch Up', 'sideLunge', 'skyPunch', 'mid', 2, 'aerobic | full | punch'),
  combo('airplane-lunge', 'Airplane Lunge', 'sideLunge', 'airplane', 'mid', 2, 'aerobic | full |'),
  // Jumps
  combo('jumping-jack', 'Jumping Jack', 'jack', 'jackArms', 'high', 2, 'aerobic | full | jump'),
  combo('clap-jack', 'Clap Jack', 'jack', 'clapHigh', 'high', 2, 'aerobic | full | jump clap', { shift: 1 }),
  combo('cross-jack', 'Cross Jack', 'jack', 'xArms', 'high', 2, 'aerobic | full | jump', { shift: 1 }),
  combo('jog', 'Jog', 'jog', 'marchArms', 'high', 2, 'aerobic | legs | jump walk'),
  combo('jog-sky', 'Jog & Punch Up', 'jog', 'skyPunch', 'high', 3, 'aerobic rock | full | jump punch'),
  // Upper body on the spot
  combo('airplane', 'Airplane', 'sway', 'airplane', 'low', 1, 'aerobic pop | arms |'),
  combo('cross-jab', 'Cross Jab', 'plant', 'crossJab', 'mid', 2, 'aerobic rock | arms | punch'),
  combo('sky-punch', 'Sky Punch', 'plant', 'skyPunch', 'mid', 1, 'aerobic rock | arms | punch'),
  combo('side-punch', 'Side Punch', 'plant', 'sidePunch', 'mid', 1, 'aerobic | arms | punch'),
  combo('overhead-press', 'Overhead Press', 'plant', 'shoulderPress', 'mid', 1, 'aerobic | arms |'),
  combo('push-the-walls', 'Push the Walls', 'plant', 'pushOut', 'low', 1, 'aerobic pop | arms | hands'),
  combo('bicep-curl', 'Bicep Curl', 'bounce', 'bicepCurl', 'low', 1, 'aerobic | arms |'),
  combo('butterfly', 'Butterfly', 'plant', 'butterfly', 'low', 1, 'aerobic | arms |'),
  combo('cross-open', 'Cross & Open', 'plant', 'xArms', 'low', 1, 'aerobic | arms |'),
  combo('rope-climb', 'Rope Climb', 'bounce', 'ropeClimb', 'low', 1, 'aerobic hiphop | arms |'),
  // Hand-authored jumps
  full({
    id: 'skater', name: 'Skater Hop', tags: 'aerobic | legs full | jump', beats: 2, level: 'high', d: 3, parts: ['jump', 'legs', 'arms'], jump: true,
    keys: [[0, skaterA], [0.5, skaterAir], [1, M(skaterA)], [1.5, skaterAir]],
  }),
  full({
    id: 'rocket', name: 'Rocket Jump', tags: 'aerobic rock | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], jump: true, icon: 2,
    keys: [
      [0, { y: -0.16, bend: 14, nod: -6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [32, -55, 36, -55], l: [32, -55, 36, -55], handR: 0, handL: 0 }],
      [0.5, { y: -0.01, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [118, 30, 122, 30], l: [118, 30, 122, 30], handR: 1, handL: 1 }],
      [1, { y: 0.13, nod: -10, rf: [0.1, 0.03, 0], lf: [-0.1, 0.03, 0], r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
      [1.5, { y: -0.07, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [80, 15, 85, 15], l: [80, 15, 85, 15], handR: 1, handL: 1 }],
    ],
  }),
];
