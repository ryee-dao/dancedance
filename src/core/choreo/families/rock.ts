/**
 * Rock / alternative / pop-punk / nu-metal / funk-rock, built as a workout:
 * neck-safe headbangs (nod-depth, driven by the torso and knees), frontman
 * moves, pogo jumps, air guitar / drums / bass, mic-stand moves, mosh-pit
 * footwork in a friendly form, boxing-flavoured combos and funk-rock grooves.
 *
 * New pattern ids are prefixed `rk` so they never collide with other files.
 */

import { ARM, FIST, OPEN, at, mir, type PoseSpec } from '../poseKit';
import { combo, full, type MoveDef, type PatternSet } from '../catalog';
import { spinKeys } from './shared';

const pumpUp: PoseSpec = { nod: -8, r: [166, 8, 172, 8], l: ARM.hip, handR: 0, handL: 0 };
const pumpDn: PoseSpec = { nod: 2, r: at(1, 0.2, 1.0, 0.06, [1, -0.2, -0.3]), l: ARM.hip, handR: 0, handL: 0 };
const pumpOff: PoseSpec = { r: at(1, 0.17, 0.83, 0.12, [1, -0.6, -0.3]), l: at(-1, -0.17, 0.75, 0.1, [1, -0.4, -0.3]), handR: 0, handL: 0 };
const guitarA = (dy: number): PoseSpec => ({
  bend: 6, twist: 10, lean: -4,
  l: at(-1, -0.36, 0.86, 0.17, [0.3, -1, 0]),
  r: at(1, 0.06, 0.63 + dy, 0.18, [0.8, -0.6, -0.4]),
  handL: 0.2, handR: 0,
});

// Air guitar / bass hand positions (fretting = left hand, strumming = right).
const FRET = at(-1, -0.36, 0.86, 0.17, [0.3, -1, 0]);
const FRET_HIGH = at(-1, -0.33, 1.14, 0.12, [0.4, -1, 0]);
const strum = (dy: number) => at(1, 0.06, 0.63 + dy, 0.18, [0.8, -0.6, -0.4]);
const BASS_FRET = at(-1, -0.4, 0.66, 0.14, [0.3, -1, 0.1]);
const slap = (dy: number) => at(1, 0.12, 0.52 + dy, 0.2, [1, -0.2, -0.4]);

// Drumsticks: hands in front of the hips / waist, sticks up or down.
const stick = (side: 1 | -1, x: number, y: number, z = 0.27): PoseSpec['r'] => at(side, x, y, z, [0.5, -1, 0]);
const drumR: PoseSpec = { nod: 5, r: stick(1, 0.2, 0.5), l: at(-1, -0.25, 0.9, 0.16, [1, -0.1, -0.2]), ...FIST };
const fillA = (x: number, y: number, tw: number): PoseSpec => ({ twist: tw, r: stick(1, x + 0.07, y), l: stick(-1, x - 0.11, y + 0.05), ...FIST });

const getUpLow: PoseSpec = { r: at(1, 0.24, 0.55, 0.16, [1, -0.4, -0.3]), l: at(-1, -0.24, 0.55, 0.16, [1, -0.4, -0.3]), ...OPEN };
const getUpHigh: PoseSpec = { nod: -6, r: at(1, 0.3, 0.98, 0.14, [1, -0.3, -0.3]), l: at(-1, -0.3, 0.98, 0.14, [1, -0.3, -0.3]), ...OPEN };

const vUp: PoseSpec = { r: [150, 4, 156, 4], l: [150, 4, 156, 4], ...FIST, formR: 'horns', formL: 'horns' };
const vLow: PoseSpec = { r: [128, 6, 140, 10], l: [128, 6, 140, 10], ...FIST, formR: 'horns', formL: 'horns' };
const KNEE_HANDS = { r: at(1, 0.16, 0.42, 0.2, [1, 0.1, -0.3]), l: at(-1, -0.16, 0.42, 0.2, [1, 0.1, -0.3]), ...OPEN };

// Boxing (nu-metal energy): fists, guard, staggered stance.
const GUARD = ARM.guard;
const STAGGER = { rf: [0.13, 0, -0.07], lf: [-0.1, 0, 0.09] } as const;
const WIDE_LOW = { rf: [0.2, 0, 0], lf: [-0.2, 0, 0] } as const;
const MIC_R = at(1, 0.03, 0.83, 0.18, [1, -0.6, -0.2]);
const MIC_L = at(-1, -0.01, 0.79, 0.19, [1, -0.6, -0.2]);
const hookWind: PoseSpec = { twist: 10, y: -0.06, ...STAGGER, r: at(1, 0.34, 0.84, 0.06, [0.2, 1, -0.3]), l: GUARD, ...FIST };
const hookHit: PoseSpec = { twist: -28, turn: 10, y: -0.08, ...STAGGER, r: at(1, 0.02, 0.8, 0.2, [1, 0, 0]), l: GUARD, ...FIST };
const upDip: PoseSpec = { y: -0.13, twist: -10, bend: 6, lean: 4, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], r: at(1, 0.12, 0.5, 0.18, [0.5, -1, -0.2]), l: GUARD, ...FIST };
const upHit: PoseSpec = { y: -0.03, twist: -12, lean: -5, nod: -6, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], r: at(1, 0.06, 0.84, 0.18, [0.3, -1, 0.3]), l: GUARD, ...FIST };
const hammerHit: PoseSpec = { y: -0.1, nod: 8, bend: 5, ...WIDE_LOW, r: at(1, 0.06, 0.62, 0.26, [1, -0.3, -0.2]), l: at(-1, -0.2, 1.1, 0.08, [1, 0.3, -0.2]), ...FIST };
const sprintA: PoseSpec = { y: 0.03, x: -0.01, rf: [0.08, 0.2, 0.14], lf: [-0.08, 0, 0], r: at(1, 0.2, 0.5, -0.06, [0.1, -0.3, -1]), l: at(-1, -0.12, 0.88, 0.18, [0.1, -1, -0.2]), ...FIST };
const skankA: PoseSpec = { y: -0.02, bend: 7, nod: 5, rf: [0.11, 0.12, 0.2], lf: [-0.08, 0, 0], kneeR: 0.15, r: at(1, 0.14, 0.5, 0.3, [0.5, -1, -0.1]), l: at(-1, -0.22, 0.86, -0.02, [0.3, 0.3, -1]), ...FIST };
const skankDn: PoseSpec = { y: -0.07, bend: 4, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: at(1, 0.16, 0.6, 0.14, [0.5, -1, -0.2]), l: at(-1, -0.16, 0.6, 0.14, [0.5, -1, -0.2]), ...FIST };
const twoStepA: PoseSpec = { y: 0.04, lean: -7, bend: 5, rf: [0.24, 0.13, 0.12], lf: [-0.06, 0.02, 0], r: at(1, -0.12, 0.55, 0.22, [0.5, -1, 0]), l: at(-1, -0.34, 0.66, -0.04, [1, 0, -0.3]), ...FIST };
const twoStepDn: PoseSpec = { y: -0.08, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: at(1, 0.14, 0.58, 0.16, [0.6, -1, -0.2]), l: at(-1, -0.14, 0.58, 0.16, [0.6, -1, -0.2]), ...FIST };
const ropeHigh: PoseSpec = { y: -0.02, lean: 6, twist: -6, nod: -8, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], r: at(1, 0.34, 1.1, 0.14, [1, 0.2, -0.2]), l: at(-1, 0.1, 0.84, 0.2, [0.3, -1, 0.2]), ...FIST };
const ropeLow: PoseSpec = { y: -0.14, lean: -5, twist: 14, bend: 8, nod: 4, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], r: at(1, -0.06, 0.56, 0.22, [0.6, -1, -0.2]), l: at(-1, -0.2, 0.5, 0.14, [0.8, -0.6, -0.3]), ...FIST };
const funkSwing: PoseSpec = { y: -0.08, x: 0.04, lean: 8, bend: 6, nod: 6, rf: [0.22, 0, 0.02], lf: [-0.1, 0.02, 0], r: at(1, 0.34, 0.5, 0.12, [1, -0.2, -0.3]), l: at(-1, 0.16, 0.52, 0.18, [0.6, -1, -0.2]), ...OPEN };
const lighterA: PoseSpec = { r: [158, 12, 168, 30], l: ARM.rest, handR: 0, handL: 0.4 };
const FIST_SH_R = at(1, 0.22, 0.96, 0.08, [1, -0.2, -0.3]);
const FIST_SH_L = at(-1, -0.22, 0.96, 0.08, [1, -0.2, -0.3]);
const PIT_FEET = (k: number): PoseSpec => (k % 2 === 0
  ? { y: 0.02, rf: [0.06, 0.1, 0.05], lf: [-0.06, 0, 0], r: ARM.swingBack, l: ARM.swingFwd, ...FIST }
  : { y: 0.02, rf: [0.06, 0, 0], lf: [-0.06, 0.1, 0.05], r: ARM.swingFwd, l: ARM.swingBack, ...FIST });

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
    // Pogo: straight-legged vertical hops, feet together.
    rkPogo: {
      beats: 1, parts: ['jump', 'legs'], jump: true,
      keys: [[0, { y: -0.05, rf: [0.06, 0, 0], lf: [-0.06, 0, 0] }], [0.5, { y: 0.13, rf: [0.06, 0.03, 0], lf: [-0.06, 0.03, 0] }]],
    },
    // Drummer's seat: low wide stance, right heel pumping the bass pedal.
    rkKickPedal: {
      beats: 1, parts: ['legs'],
      keys: [[0, { y: -0.11, rf: [0.17, 0, 0.06], lf: [-0.17, 0, 0], kneeR: 0.1, kneeL: 0.1 }], [0.5, { y: -0.1, rf: [0.17, 0.07, 0.08], lf: [-0.17, 0, 0], kneeR: 0.1, kneeL: 0.1 }]],
    },
    // Slow wide sway for ballads (lighters up).
    rkSlowSway: {
      beats: 4, parts: ['hips'], torso: true,
      keys: [[0, { x: 0.05, hips: 0.03, lean: 7, head: 6, rf: [0.15, 0, 0], lf: [-0.15, 0.01, 0] }], [2, { x: -0.05, hips: -0.03, lean: -7, head: -6, rf: [0.15, 0.01, 0], lf: [-0.15, 0, 0] }]],
    },
    // Bob and weave: a U-shaped duck under a punch, side to side.
    rkBobWeave: {
      beats: 2, parts: ['legs', 'torso'], torso: true,
      keys: [
        [0, { x: 0.07, y: -0.05, lean: 6, rf: [0.17, 0, 0], lf: [-0.17, 0, 0] }],
        [0.5, { x: 0, y: -0.18, bend: 10, nod: 4, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.12, kneeL: 0.12 }],
        [1, { x: -0.07, y: -0.05, lean: -6, rf: [0.17, 0, 0], lf: [-0.17, 0, 0] }],
        [1.5, { x: 0, y: -0.18, bend: 10, nod: 4, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.12, kneeL: 0.12 }],
      ],
    },
    // Front snap kick at hip height: chamber, snap, recoil, down.
    rkSnapKick: {
      beats: 2, parts: ['legs'], mirror: true,
      keys: [
        [0, { y: -0.03, bend: -2, rf: [0.09, 0.2, 0.14] }],
        [0.5, { y: -0.01, bend: -6, rf: [0.09, 0.2, 0.34] }],
        [1, { y: -0.03, bend: -2, rf: [0.09, 0.2, 0.14] }],
        [1.5, { y: -0.05, rf: [0.11, 0, 0] }],
      ],
    },
    // Side stomp: knee chambered and turned out, heel driven down to the side.
    rkSideStomp: {
      beats: 2, parts: ['legs'], mirror: true, impact: true,
      keys: [
        [0, { y: -0.02, x: -0.02, rf: [0.14, 0.22, 0.12], kneeR: 0.45, lf: [-0.09, 0, 0] }],
        [1, { y: -0.11, x: 0.03, rf: [0.3, 0, 0.02], kneeR: 0.2, lf: [-0.1, 0, 0] }],
      ],
    },
    // Shoulder barge: a big side step leading with the shoulder.
    rkBarge: {
      beats: 2, parts: ['legs'], mirror: true, travel: 0.16, torso: true,
      keys: [
        [0, { x: 0.1, y: -0.1, lean: 12, twist: -14, head: 6, rf: [0.3, 0, 0], lf: [-0.08, 0, 0] }],
        [1, { x: 0.16, y: -0.03, lean: 2, twist: 0, rf: [0.26, 0, 0], lf: [0.08, 0.03, 0.01] }],
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
        [1.5, { r: [80, 60, 84, 70], l: ARM.hip, handR: 0, handL: 0 }],
      ],
    },
    airGuitar: { beats: 1, parts: ['arms'], torso: true, keys: [[0, guitarA(0.04)], [0.5, guitarA(-0.04)]] },
    // Lighter held high (ballads).
    rkLighter: { beats: 2, parts: ['arms'], keys: [[0, lighterA], [1, { ...lighterA, r: [150, 18, 160, 34] }]] },
    // Both arms high, swaying like a stadium crowd.
    rkArenaWave: {
      beats: 2, parts: ['arms'],
      keys: [[0, { r: [150, -6, 150, -10], l: [176, 10, 178, 20], ...OPEN }], [1, { r: [176, 10, 178, 20], l: [150, -6, 150, -10], ...OPEN }]],
    },
    // Fists: guard up, ready to fight (bob and weave).
    rkHighGuard: { beats: 1, parts: [], keys: [[0, { r: at(1, 0.08, 0.84, 0.2, [0.4, -1, -0.1]), l: at(-1, -0.08, 0.84, 0.2, [0.4, -1, -0.1]), ...FIST }]] },
    // Alternating hammer fists from overhead down to the chest.
    rkHammer: { beats: 1, parts: ['arms'], keys: [[0, { r: hammerHit.r, l: hammerHit.l, ...FIST }], [0.5, { r: mir(hammerHit).r, l: mir(hammerHit).l, ...FIST }]] },
    // Shoulder barge arms: elbow up and out in front of the leading shoulder.
    rkBargeArms: {
      beats: 2, parts: ['arms'], mirror: true,
      keys: [
        [0, { r: at(1, 0.26, 0.74, 0.16, [1, 0.4, 0]), l: GUARD, shR: 0.9, ...FIST }],
        [1, { r: GUARD, l: GUARD, shR: 0.2, ...FIST }],
      ],
    },
    // One fist punching the sky on every bang, alternating sides.
    rkFistBang: {
      beats: 2, parts: ['arms'],
      keys: [[0, { r: [174, 6, 176, 6], l: FIST_SH_L, ...FIST }], [0.5, { r: FIST_SH_R, l: FIST_SH_L, ...FIST }], [1, { r: FIST_SH_R, l: [174, 6, 176, 6], ...FIST }], [1.5, { r: FIST_SH_R, l: FIST_SH_L, ...FIST }]],
    },
    // Both fists high in a V, pumping on the bang.
    rkVPump: { beats: 1, parts: ['arms'], keys: [[0, vLow], [0.5, vUp]] },
    // Hands on the knees (low headbang).
    rkKneeHands: { beats: 1, parts: [], keys: [[0, KNEE_HANDS]] },
    // Palms-up lifts: "get up!"
    rkGetUp: { beats: 1, parts: ['arms'], keys: [[0, getUpLow], [0.5, getUpHigh]] },
    // Snare and hi-hat: sticks alternate every half beat.
    rkDrums: { beats: 1, parts: ['arms'], keys: [[0, drumR], [0.5, mir(drumR)]] },
    // Air bass: low instrument, thumb slapping on the beat.
    rkSlapBass: {
      beats: 1, parts: ['arms'], torso: true,
      keys: [
        [0, { twist: 10, lean: -4, nod: 6, l: BASS_FRET, r: slap(-0.04), handL: 0.3, handR: 0.6 }],
        [0.5, { twist: 2, lean: 0, nod: -2, l: BASS_FRET, r: slap(0.17), handL: 0.3, handR: 0.2 }],
      ],
    },
  },
  accent: {
    headBang: { beats: 1, parts: [], keys: [[0, { nod: 16, bend: 4 }], [0.5, { nod: -6, bend: 0 }]] },
    // Torso-driven bang: the chest bows, the neck only nods.
    rkBodyBang: { beats: 1, parts: ['torso'], keys: [[0, { nod: 13, bend: 13 }], [0.5, { nod: -5, bend: 1 }]] },
    rkLowBang: { beats: 1, parts: ['torso'], keys: [[0, { nod: 16, bend: 24, head: 0 }], [0.5, { nod: 0, bend: 10 }]] },
    rkSideBang: {
      beats: 2, parts: ['torso'],
      keys: [[0, { lean: 13, head: 20, nod: 9, bend: 5 }], [0.5, { lean: 3, head: 4, nod: -3, bend: 0 }], [1, { lean: -13, head: -20, nod: 9, bend: 5 }], [1.5, { lean: -3, head: -4, nod: -3, bend: 0 }]],
    },
    rkHairCircle: {
      beats: 2, parts: ['torso'],
      keys: [
        [0, { lean: 13, head: 16, nod: 6, bend: 5 }],
        [0.5, { lean: 0, head: 0, nod: 16, bend: 17 }],
        [1, { lean: -13, head: -16, nod: 6, bend: 5 }],
        [1.5, { lean: 0, head: 0, nod: -8, bend: -5 }],
      ],
    },
  },
};

export const moves: MoveDef[] = [
  // --- Stomps and fist pumps -------------------------------------------------
  combo('stomp-clap', 'Stomp Clap', 'stomp', 'clap', 'low', 1, 'rock | legs | stomp clap'),
  combo('stomp-punch', 'Stomp & Punch Up', 'stomp', 'skyPunch', 'mid', 2, 'rock | full | stomp punch'),
  combo('fist-pump', 'Fist Pump', 'powerStance', 'fistPump', 'mid', 1, 'rock | arms | punch'),
  full({
    id: 'stomp-stomp-clap', name: 'Stomp Stomp Clap', tags: 'rock | full | stomp clap', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Stomp right, stomp left on the half beats, then clap in front of the chest and hold.',
    keys: [
      [0, { y: -0.07, bend: 6, nod: 8, rf: [0.14, 0, 0.03], lf: [-0.12, 0.11, 0.03], r: [24, 0, 30, 10], l: [24, 0, 30, 10], ...FIST }],
      [0.5, { y: -0.07, bend: 6, nod: 8, rf: [0.14, 0, 0.03], lf: [-0.14, 0, 0.03], r: [24, 0, 30, 10], l: [24, 0, 30, 10], ...FIST }],
      [1, { y: -0.03, nod: -4, rf: [0.14, 0, 0.03], lf: [-0.14, 0, 0.03], r: ARM.clap, l: ARM.clap, ...OPEN }],
      [1.5, { y: -0.02, rf: [0.14, 0.11, 0.03], lf: [-0.14, 0, 0.03], r: ARM.clap, l: ARM.clap, ...OPEN }],
    ],
  }),

  // --- Headbangs (nod-depth; the torso and knees do the work) ----------------
  combo('headbang', 'Headbang Bounce', 'powerStance', 'guard', 'low', 1, 'rock | full |', { accent: 'headBang' }),
  combo('headbang-arms-up', 'Headbang Arms Up', 'powerStance', 'rkVPump', 'mid', 1, 'rock | arms full | punch', {
    accent: 'rkBodyBang', desc: 'Both fists up in a V, pumping higher as the chest bows forward on every beat.',
  }),
  combo('low-headbang', 'Low Headbang', 'sumo', 'rkKneeHands', 'high', 2, 'rock | legs full |', {
    accent: 'rkLowBang', desc: 'Wide low squat with hands on the knees, nodding the chest down on every beat as you pulse.',
  }),
  combo('side-headbang', 'Side-to-Side Headbang', 'powerStance', 'hips', 'low', 1, 'rock | full |', {
    accent: 'rkSideBang', desc: 'Hands on hips in a wide stance; tip the head and chest to one side, then the other.',
  }),
  combo('hair-swing', 'Hair Swing Circle', 'groove', 'rest', 'low', 2, 'rock | full |', {
    accent: 'rkHairCircle', desc: 'A small circle with the chest and head: right, down, left, up, loose arms.',
  }),

  // --- Pogo and jumps -------------------------------------------------------
  combo('pogo', 'Pogo', 'rkPogo', 'rest', 'high', 1, 'rock | legs | jump', { desc: 'Straight-legged hops on the spot, feet together, arms loose.' }),
  combo('pogo-fist', 'Pogo Punch', 'rkPogo', 'skyPunch', 'high', 2, 'rock | full | jump punch', { desc: 'Pogo hops with a fist punching the sky on every jump, alternating hands.' }),
  full({
    id: 'side-pogo', name: 'Side Pogo', tags: 'rock | legs | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs'], jump: true, impact: true,
    desc: 'Feet-together hops from side to side, arms out low for balance.',
    keys: [
      [0, { x: 0.09, y: -0.05, lean: -3, rf: [0.15, 0, 0], lf: [0.03, 0, 0], r: [40, 0, 44, 0], l: [40, 0, 44, 0], ...FIST }],
      [0.5, { x: 0, y: 0.12, rf: [0.06, 0.04, 0], lf: [-0.06, 0.04, 0], r: [52, 0, 56, 0], l: [52, 0, 56, 0], ...FIST }],
      [1, { x: -0.09, y: -0.05, lean: 3, rf: [-0.03, 0, 0], lf: [-0.15, 0, 0], r: [40, 0, 44, 0], l: [40, 0, 44, 0], ...FIST }],
      [1.5, { x: 0, y: 0.12, rf: [0.06, 0.04, 0], lf: [-0.06, 0.04, 0], r: [52, 0, 56, 0], l: [52, 0, 56, 0], ...FIST }],
    ],
  }),
  full({
    id: 'tuck-jump', name: 'Tuck Jump', tags: 'rock aerobic | legs full | jump', beats: 2, level: 'high', d: 3, parts: ['jump', 'legs'], jump: true, impact: true,
    desc: 'Dip, jump and pull both knees up toward the chest, land soft and stand tall.',
    keys: [
      [0, { y: -0.13, bend: 10, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: [30, -40, 34, -40], l: [30, -40, 34, -40], ...FIST }],
      [0.5, { y: 0.14, bend: 6, nod: 4, rf: [0.09, 0.17, 0.13], lf: [-0.09, 0.17, 0.13], r: at(1, 0.2, 0.68, 0.24, [1, -0.3, -0.2]), l: at(-1, -0.2, 0.68, 0.24, [1, -0.3, -0.2]), ...FIST }],
      [1, { y: -0.13, bend: 10, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: [44, 20, 50, 20], l: [44, 20, 50, 20], ...FIST }],
      [1.5, { y: -0.02, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: [24, -20, 28, -20], l: [24, -20, 28, -20], ...FIST }],
    ],
  }),
  full({
    id: 'star-jump', name: 'Star Jump', tags: 'rock aerobic | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'arms'], jump: true, impact: true,
    desc: 'Sink low with arms down, explode into a star with arms and legs wide, land soft and sink again.',
    keys: [
      [0, { y: -0.12, bend: 8, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: [32, 15, 38, 25], l: [32, 15, 38, 25], ...FIST }],
      [0.5, { y: 0.1, rf: [0.2, 0.05, 0], lf: [-0.2, 0.05, 0], r: [124, 0, 128, 0], l: [124, 0, 128, 0], ...OPEN }],
      [1, { y: -0.06, bend: 3, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: [72, 0, 76, 0], l: [72, 0, 76, 0], ...OPEN }],
      [1.5, { y: -0.08, bend: 5, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: [36, 10, 42, 15], l: [36, 10, 42, 15], ...FIST }],
    ],
  }),
  combo('jump-around', 'Jump Around', 'jumpAround', 'fistPump', 'high', 2, 'rock hiphop | full | jump punch'),

  // --- Frontman --------------------------------------------------------------
  combo('get-up', 'Get Up Lifts', 'powerStance', 'rkGetUp', 'mid', 1, 'rock | arms | hands', { desc: 'Palms up, scoop both hands from the waist to above the shoulders on every beat: get up!' }),
  combo('backbeat-clap', 'Backbeat Clap', 'powerStance', 'clapHigh', 'low', 1, 'rock | arms | clap', { desc: 'Bounce in a wide stance, clap high over your head on beats 2 and 4.' }),

  // --- Air instruments ------------------------------------------------------
  combo('windmill', 'Windmill', 'powerStance', 'windmill', 'mid', 2, 'rock | arms |'),
  combo('air-guitar', 'Air Guitar', 'powerStance', 'airGuitar', 'low', 1, 'rock | arms |'),
  full({
    id: 'guitar-neck-raise', name: 'Guitar Neck Raise', tags: 'rock | arms |', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Lean back and raise the guitar neck toward the sky, strumming hard on the beat.',
    keys: [
      [0, { y: -0.09, bend: -9, lean: -6, twist: 8, nod: -10, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], l: FRET_HIGH, r: strum(0.02), handL: 0.2, handR: 0 }],
      [0.5, { y: -0.06, bend: -6, lean: -5, twist: 6, nod: -6, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], l: FRET_HIGH, r: strum(-0.07), handL: 0.2, handR: 0 }],
      [1, { y: -0.1, bend: -9, lean: -6, twist: 8, nod: -10, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], l: FRET_HIGH, r: strum(0.02), handL: 0.2, handR: 0 }],
      [1.5, { y: -0.06, bend: -3, lean: -3, twist: 6, nod: -2, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], l: FRET, r: strum(-0.07), handL: 0.2, handR: 0 }],
    ],
  }),
  full({
    id: 'duck-walk', name: 'Duck Walk', tags: 'rock | legs full | walk', beats: 2, level: 'high', d: 3, parts: ['legs', 'arms', 'jump'], mirror: true, travel: 0.16, jump: true, impact: true,
    desc: 'Crouch on one leg with the other kicked out in front, hopping sideways while you strum.',
    keys: [
      [0, { x: 0.04, y: -0.15, bend: 10, nod: 6, twist: 8, lf: [-0.07, 0, 0], rf: [0.19, 0.1, 0.2], l: FRET, r: strum(0.02), handL: 0.2, handR: 0 }],
      [0.5, { x: 0.08, y: -0.11, bend: 8, nod: -4, twist: 8, lf: [-0.04, 0.03, 0], rf: [0.23, 0.12, 0.2], l: FRET, r: strum(-0.07), handL: 0.2, handR: 0 }],
      [1, { x: 0.12, y: -0.15, bend: 10, nod: 6, twist: 8, lf: [0.0, 0, 0], rf: [0.27, 0.1, 0.2], l: FRET, r: strum(0.02), handL: 0.2, handR: 0 }],
      [1.5, { x: 0.16, y: -0.08, bend: 4, nod: -2, twist: 6, lf: [0.07, 0, 0], rf: [0.25, 0.02, 0.06], l: FRET, r: strum(-0.07), handL: 0.2, handR: 0 }],
    ],
  }),
  combo('air-bass', 'Slap Bass', 'groove', 'rkSlapBass', 'low', 1, 'rock funk | arms |', { desc: 'Bass held low on the hip, thumb slapping the strings on every beat while the knees bounce.' }),
  combo('air-drums', 'Air Drums', 'rkKickPedal', 'rkDrums', 'low', 1, 'rock party | arms |', { desc: 'Sit low and wide, sticks alternating snare and hi-hat on every half beat, right heel on the kick pedal.' }),
  full({
    id: 'tom-roll', name: 'Tom Roll', tags: 'rock party | arms |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Roll around the kit: sticks hit high toms on your right, then sweep across to the floor tom on your left.',
    keys: [
      [0, { y: -0.1, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], ...fillA(0.22, 0.74, -12), nod: 4 }],
      [0.5, { y: -0.1, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], ...fillA(0.1, 0.7, -6), nod: 6 }],
      [1, { y: -0.11, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], ...fillA(-0.06, 0.64, 6), nod: 8 }],
      [1.5, { y: -0.11, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], ...fillA(-0.18, 0.58, 14), nod: 8 }],
    ],
  }),
  full({
    id: 'cymbal-crash', name: 'Cymbal Crash', tags: 'rock party | arms |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Two hits on the snare, then reach high and wide to smash the crash cymbal.',
    keys: [
      [0, { y: -0.1, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], ...drumR, nod: 6 }],
      [0.5, { y: -0.1, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], ...mir(drumR), nod: 6 }],
      [1, { y: -0.06, lean: 9, twist: -6, nod: -8, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], r: at(1, 0.44, 1.12, 0.1, [1, 0.3, -0.2]), l: stick(-1, -0.15, 0.68), ...FIST }],
      [1.5, { y: -0.08, lean: 4, nod: -2, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], r: at(1, 0.34, 0.92, 0.16, [1, 0, -0.2]), l: stick(-1, -0.15, 0.72), ...FIST }],
    ],
  }),
  // --- Frontman: crowd, mic, lighters ---------------------------------------
  full({
    id: 'crowd-point', name: 'Point to the Crowd', tags: 'rock pop | arms | point', beats: 4, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Bouncing in a wide stance, sweep a pointing arm slowly across the crowd from your side to the far side and back.',
    keys: [
      [0, { y: -0.08, twist: 10, turn: 14, ...WIDE_LOW, r: at(1, 0.42, 0.92, 0.18, [1, 0, -0.2]), l: ARM.hip, handR: 0.6, handL: 0 }],
      [1, { y: -0.05, twist: 0, turn: 0, ...WIDE_LOW, r: at(1, 0.14, 0.94, 0.32, [1, -0.3, -0.2]), l: ARM.hip, handR: 0.6, handL: 0 }],
      [2, { y: -0.08, twist: -14, turn: -18, ...WIDE_LOW, r: at(1, -0.2, 0.82, 0.27, [1, -0.3, -0.2]), l: ARM.hip, handR: 0.6, handL: 0 }],
      [3, { y: -0.05, twist: 0, turn: 0, ...WIDE_LOW, r: at(1, 0.14, 0.94, 0.32, [1, -0.3, -0.2]), l: ARM.hip, handR: 0.6, handL: 0 }],
    ],
  }),
  full({
    id: 'chest-thump', name: 'Chest Thump & Point', tags: 'rock hiphop | arms | point', beats: 2, level: 'mid', d: 1, parts: ['arms'], mirror: true,
    desc: 'Thump your fist on your chest twice, then fling the arm up to point at the sky.',
    keys: [
      [0, { y: -0.08, nod: 6, ...WIDE_LOW, r: at(1, 0.06, 0.7, 0.13, [1, -0.5, -0.3]), l: ARM.hip, handR: 0, handL: 0 }],
      [0.5, { y: -0.04, ...WIDE_LOW, r: at(1, 0.14, 0.72, 0.24, [1, -0.5, -0.3]), l: ARM.hip, handR: 0, handL: 0 }],
      [1, { y: -0.08, nod: 6, ...WIDE_LOW, r: at(1, 0.06, 0.7, 0.13, [1, -0.5, -0.3]), l: ARM.hip, handR: 0, handL: 0 }],
      [1.5, { y: -0.03, nod: -8, lean: -4, ...WIDE_LOW, r: [148, 20, 154, 20], l: ARM.hip, handR: 0.6, handL: 0 }],
    ],
  }),
  full({
    id: 'mic-grab', name: 'Mic Grab Scream', tags: 'rock | full |', beats: 2, level: 'low', d: 1, parts: ['torso'],
    desc: 'Both hands on the mic at your mouth: crunch forward over it on one beat, arch back on the next.',
    keys: [
      [0, { y: -0.11, bend: 14, nod: 8, ...WIDE_LOW, kneeR: 0.12, kneeL: 0.12, r: MIC_R, l: MIC_L, ...FIST }],
      [1, { y: -0.03, bend: -9, nod: -12, ...WIDE_LOW, r: MIC_R, l: MIC_L, ...FIST }],
    ],
  }),
  full({
    id: 'mic-stand-tilt', name: 'Mic Stand Tilt', tags: 'rock | full |', beats: 2, level: 'low', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Grab an imaginary mic stand with both hands and tip it out to one side, leaning with it, then pull it back upright.',
    keys: [
      [0, { y: -0.08, x: 0.03, lean: 13, head: 10, ...WIDE_LOW, r: at(1, 0.32, 0.72, 0.2, [1, -0.4, -0.2]), l: at(-1, 0.18, 0.62, 0.22, [0.8, -0.8, -0.2]), ...FIST }],
      [1, { y: -0.04, x: 0, lean: 0, head: 0, ...WIDE_LOW, r: at(1, 0.04, 0.8, 0.2, [1, -0.6, -0.2]), l: at(-1, -0.02, 0.66, 0.22, [1, -0.6, -0.2]), ...FIST }],
    ],
  }),
  full({
    id: 'mic-point', name: 'Point the Mic', tags: 'rock pop | arms | point', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Sing into the mic, then hold it out to the crowd at arm\'s length while the other hand waves them in.',
    keys: [
      [0, { y: -0.06, nod: 4, ...WIDE_LOW, r: MIC_R, l: ARM.hip, handR: 0, handL: 0 }],
      [1, { y: -0.08, lean: 4, nod: -6, ...WIDE_LOW, r: at(1, 0.26, 0.88, 0.32, [1, -0.2, -0.2]), l: [150, 0, 156, 0], handR: 0, handL: 1 }],
    ],
  }),
  combo('lighter-sway', 'Lighter Sway', 'rkSlowSway', 'rkLighter', 'low', 1, 'rock pop | arms hips | wave', { desc: 'Slow wide sway for the ballad, one fist held high as if holding a lighter.' }),
  combo('arena-wave', 'Arena Wave', 'rkSlowSway', 'rkArenaWave', 'low', 1, 'rock pop | arms | wave', { desc: 'Both hands high, swaying from side to side with the whole stadium.' }),

  // --- Mosh pit (friendly) and punk footwork ---------------------------------
  full({
    id: 'ska-skank', name: 'Ska Skank', tags: 'rock | full | kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Bouncy alternating low kicks forward from the knee, fists pumping opposite like running.',
    keys: [[0, skankA], [0.5, skankDn], [1, mir(skankA)], [1.5, skankDn]],
  }),
  full({
    id: 'mosh-two-step', name: 'Hardcore Two-Step', tags: 'rock | full | kick jump', beats: 2, level: 'high', d: 3, parts: ['legs', 'arms', 'jump'], jump: true, impact: true,
    desc: 'Hop on one foot and kick the other out to the side while the arms swing across, then switch.',
    keys: [[0, twoStepA], [0.5, twoStepDn], [1, mir(twoStepA)], [1.5, twoStepDn]],
  }),
  combo('shoulder-barge', 'Shoulder Barge', 'rkBarge', 'rkBargeArms', 'mid', 2, 'rock | full | walk', { desc: 'Big side step leading with a raised shoulder and elbow, then close the feet.' }),
  full({
    id: 'sprint', name: 'Sprint in Place', tags: 'rock aerobic | legs full | jump', beats: 1, level: 'high', d: 2, parts: ['legs', 'arms', 'jump'], jump: true, impact: true,
    desc: 'Fast high knees on the balls of the feet, arms driving hard from hip to cheek.',
    keys: [[0, sprintA], [0.5, mir(sprintA)]],
  }),
  full({
    id: 'slam-clap', name: 'Slam Clap', tags: 'rock aerobic | full | clap', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Squat and reach both hands down toward the floor, then drive up tall and clap over your head.',
    keys: [
      [0, { y: -0.2, bend: 16, nod: -6, rf: [0.16, 0, 0], lf: [-0.16, 0, 0], r: at(1, 0.07, 0.42, 0.28, [1, -0.3, -0.3]), l: at(-1, -0.07, 0.42, 0.28, [1, -0.3, -0.3]), ...OPEN }],
      [1, { y: 0.0, nod: -10, rf: [0.16, 0, 0], lf: [-0.16, 0, 0], r: ARM.clapHigh, l: ARM.clapHigh, ...OPEN }],
    ],
  }),
  full({
    id: 'power-pump', name: 'Power Stance Pump', tags: 'rock aerobic | legs arms | punch', beats: 1, level: 'high', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Hold a wide low squat and punch down toward the floor in front, alternating fists, pulsing the knees.',
    keys: [
      [0, { y: -0.2, bend: 9, nod: 6, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], r: at(1, 0.06, 0.4, 0.3, [0.6, -1, -0.1]), l: at(-1, -0.2, 0.86, 0.1, [1, -0.6, -0.2]), ...FIST }],
      [0.5, { y: -0.17, bend: 9, nod: 6, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], r: at(1, 0.2, 0.86, 0.1, [1, -0.6, -0.2]), l: at(-1, -0.06, 0.4, 0.3, [0.6, -1, -0.1]), ...FIST }],
    ],
  }),
  combo('hammer-fist', 'Hammer Fist', 'powerStance', 'rkHammer', 'mid', 2, 'rock | arms | punch', { desc: 'Alternate fists: raise one overhead and hammer it down in front of the chest as the other goes up.' }),
  full({
    id: 'rope-pull', name: 'Rope Pull Down', tags: 'rock aerobic | full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Grab a rope high on one side and haul it down across the body to the opposite hip as you sink.',
    keys: [[0, ropeHigh], [1, ropeLow]],
  }),
  full({
    id: 'funk-stomp-swing', name: 'Funk Stomp Swing', tags: 'rock funk | full | stomp', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Stomp out to one side and swing both loose arms down toward it, then stomp and swing to the other side.',
    keys: [[0, funkSwing], [1, mir(funkSwing)]],
  }),

  // --- Boxing (nu-metal energy) -----------------------------------------------
  full({
    id: 'jab-cross', name: 'Jab-Cross', tags: 'rock aerobic | arms | punch', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Boxer stance: snap the front jab and the rear cross on the half beats, then bounce back to guard.',
    keys: [
      [0, { y: -0.06, twist: 12, turn: -6, ...STAGGER, l: at(-1, -0.08, 0.8, 0.3, [0.3, -1, 0]), r: GUARD, ...FIST }],
      [0.5, { y: -0.07, twist: -26, turn: 10, ...STAGGER, r: at(1, 0.0, 0.8, 0.3, [0.3, -1, 0]), l: GUARD, ...FIST }],
      [1, { y: -0.09, twist: 0, ...STAGGER, r: at(1, 0.08, 0.84, 0.2, [0.4, -1, -0.1]), l: at(-1, -0.08, 0.84, 0.2, [0.4, -1, -0.1]), ...FIST }],
      [1.5, { y: -0.04, twist: 0, ...STAGGER, r: at(1, 0.08, 0.84, 0.2, [0.4, -1, -0.1]), l: at(-1, -0.08, 0.84, 0.2, [0.4, -1, -0.1]), ...FIST }],
    ],
  }),
  full({
    id: 'hook-punch', name: 'Hook Punch', tags: 'rock aerobic | arms | punch twist', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Swing the elbow up to shoulder height and hook the fist across in front of your face, turning the whole chest.',
    keys: [[0, hookWind], [0.5, hookHit], [1, { ...hookHit, r: GUARD, twist: -6, turn: 0 }], [1.5, { ...hookWind, r: GUARD, twist: 0, y: -0.04 }]],
  }),
  full({
    id: 'dip-uppercut', name: 'Uppercut', tags: 'rock aerobic | full | punch', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs', 'torso'],
    desc: 'Dip the knees and drop the fist to the waist, then drive up through the legs and punch up to chin height; alternate.',
    keys: [[0, upDip], [0.5, upHit], [1, mir(upDip)], [1.5, mir(upHit)]],
  }),
  combo('bob-weave', 'Bob and Weave', 'rkBobWeave', 'rkHighGuard', 'mid', 2, 'rock aerobic | legs | ', { desc: 'Fists up by the face, duck down and across under a punch in a U shape, side to side.' }),

  // --- Kicks and jumps ----------------------------------------------------------
  combo('snap-kick', 'Front Snap Kick', 'rkSnapKick', 'guard', 'mid', 2, 'rock aerobic | legs | kick', { desc: 'Lift the knee, snap the foot forward at hip height, pull it back and step down; guard up.' }),
  combo('side-stomp', 'Side Stomp Kick', 'rkSideStomp', 'guard', 'mid', 2, 'rock aerobic | legs | stomp kick', { desc: 'Chamber the knee turned out, then drive the heel down hard to the side and sink.' }),
  full({
    id: 'jump-kick', name: 'Jump Kick', tags: 'rock | legs full | jump kick', beats: 2, level: 'high', d: 3, parts: ['jump', 'legs'], mirror: true, jump: true, impact: true,
    desc: 'Crouch, hop up and snap a low kick forward in the air, land soft and stand.',
    keys: [
      [0, { y: -0.11, bend: 8, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: GUARD, l: GUARD, ...FIST }],
      [0.5, { y: 0.09, bend: -5, rf: [0.09, 0.2, 0.3], lf: [-0.08, 0.1, 0], r: [52, -20, 60, -10], l: at(-1, -0.08, 0.82, 0.22, [0.4, -1, -0.1]), ...FIST }],
      [1, { y: -0.11, bend: 8, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: GUARD, l: GUARD, ...FIST }],
      [1.5, { y: -0.03, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: GUARD, l: GUARD, ...FIST }],
    ],
  }),
  full({
    id: 'twist-jump', name: 'Twist Jump', tags: 'rock aerobic | legs | jump twist', beats: 2, level: 'high', d: 2, parts: ['jump', 'legs', 'hips'], jump: true, impact: true,
    desc: 'Small hops with the feet together, twisting the hips and feet to one side while the arms swing the other way.',
    keys: [
      [0, { y: -0.06, spin: 38, twist: -38, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: at(1, -0.08, 0.76, 0.3, [0.6, -1, 0]), l: at(-1, -0.42, 0.78, 0.06, [1, -0.3, -0.2]), ...FIST }],
      [0.5, { y: 0.08, spin: 0, twist: 0, rf: [0.06, 0.03, 0], lf: [-0.06, 0.03, 0], r: [62, 20, 70, 30], l: [62, 20, 70, 30], ...FIST }],
      [1, { y: -0.06, spin: -38, twist: 38, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], r: at(1, 0.42, 0.78, 0.06, [1, -0.3, -0.2]), l: at(-1, 0.08, 0.76, 0.3, [0.6, -1, 0]), ...FIST }],
      [1.5, { y: 0.08, spin: 0, twist: 0, rf: [0.06, 0.03, 0], lf: [-0.06, 0.03, 0], r: [62, 20, 70, 30], l: [62, 20, 70, 30], ...FIST }],
    ],
  }),
  // --- More guitar ---------------------------------------------------------------
  full({
    id: 'power-windmill', name: 'Power Chord Windmill', tags: 'rock | arms |', beats: 2, level: 'mid', d: 2, parts: ['arms'], mirror: true,
    desc: 'Hold the guitar neck out to the side and swing the strumming arm in a big circle, smashing the chord on the way down.',
    keys: [
      [0, { y: -0.12, bend: 8, nod: 8, ...WIDE_LOW, l: FRET, r: at(1, 0.1, 0.56, 0.2, [1, -0.4, -0.3]), handL: 0.2, handR: 0 }],
      [0.5, { y: -0.07, lean: -4, ...WIDE_LOW, l: FRET, r: [96, 0, 100, 0], handL: 0.2, handR: 0 }],
      [1, { y: -0.04, lean: -6, nod: -8, ...WIDE_LOW, l: FRET, r: [176, 0, 178, 0], handL: 0.2, handR: 0 }],
      [1.5, { y: -0.07, lean: -2, ...WIDE_LOW, l: FRET, r: [118, 30, 122, 40], handL: 0.2, handR: 0 }],
    ],
  }),
  full({
    id: 'strum-kick', name: 'Strum & Kick', tags: 'rock | full | kick', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Two strums in a wide stance, then kick one leg up in front as you hit the big chord.',
    keys: [
      [0, { y: -0.09, ...WIDE_LOW, ...guitarA(0.04) }],
      [0.5, { y: -0.06, ...WIDE_LOW, ...guitarA(-0.05) }],
      [1, { y: -0.01, x: -0.05, bend: -6, lean: -6, twist: 10, nod: -8, rf: [0.13, 0.2, 0.3], lf: [-0.1, 0, 0], l: FRET_HIGH, r: strum(-0.08), handL: 0.2, handR: 0 }],
      [1.5, { y: -0.07, ...WIDE_LOW, ...guitarA(0.04) }],
    ],
  }),
  full({
    id: 'rock-star-jump', name: 'Rock Star Jump', tags: 'rock | full | jump', beats: 2, level: 'high', d: 3, parts: ['jump', 'legs', 'arms'], jump: true, impact: true,
    desc: 'Crouch over the guitar, leap with both knees pulled up while you hit the chord, land low and strum.',
    keys: [
      [0, { y: -0.12, ...WIDE_LOW, ...guitarA(0.04), bend: 9 }],
      [0.5, { y: 0.12, rf: [0.11, 0.14, 0.1], lf: [-0.11, 0.14, 0.1], ...guitarA(-0.06), l: FRET_HIGH, bend: 2, nod: -8 }],
      [1, { y: -0.13, ...WIDE_LOW, ...guitarA(0.04), bend: 10, nod: 8 }],
      [1.5, { y: -0.06, ...WIDE_LOW, ...guitarA(-0.05) }],
    ],
  }),
  full({
    id: 'chug-squat', name: 'Chug Squat', tags: 'rock aerobic | legs arms |', beats: 1, level: 'high', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Sink into a deep wide squat and chug palm-muted down-strums, pulsing the knees on every half beat.',
    keys: [
      [0, { y: -0.21, bend: 10, nod: 10, twist: 8, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.15, kneeL: 0.15, l: at(-1, -0.36, 0.78, 0.17, [0.3, -1, 0]), r: strum(-0.07), handL: 0.2, handR: 0 }],
      [0.5, { y: -0.16, bend: 7, nod: 2, twist: 8, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.15, kneeL: 0.15, l: at(-1, -0.36, 0.8, 0.17, [0.3, -1, 0]), r: strum(0.05), handL: 0.2, handR: 0 }],
    ],
  }),
  full({
    id: 'guitar-spin', name: 'Guitar Spin', tags: 'rock | turn arms | spin', beats: 4, level: 'mid', d: 3, parts: ['turn', 'arms'],
    desc: 'Two big strums in a wide stance, then spin all the way round holding the guitar and land facing the crowd.',
    keys: [
      [0, { y: -0.09, ...WIDE_LOW, ...guitarA(0.04) }],
      [1, { y: -0.05, rf: [0.075, 0, 0], lf: [-0.075, 0, 0], ...guitarA(-0.05) }],
      ...spinKeys(2).map(([t, k]) => [t, { ...k, ...guitarA(0) }] as const),
    ],
  }),
  combo('power-lunge', 'Power Lunge Strum', 'sideLunge', 'airGuitar', 'mid', 2, 'rock aerobic | legs arms |', { desc: 'Lunge out wide to the side and strum hard on the way down, then push back up.' }),
  full({
    id: 'guitar-solo', name: 'Guitar Solo', tags: 'rock | arms |', beats: 2, level: 'low', d: 2, parts: ['arms'], mirror: true,
    desc: 'Knees pinched, face to the sky: slide the fretting hand up the neck while the picking hand shreds fast.',
    keys: [
      [0, { y: -0.06, bend: -5, nod: -12, twist: 6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: -0.3, kneeL: -0.3, l: at(-1, -0.2, 0.82, 0.22, [0.3, -1, 0]), r: strum(0.03), handL: 0.2, handR: 0 }],
      [0.5, { y: -0.08, bend: -5, nod: -12, twist: 6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: -0.3, kneeL: -0.3, l: at(-1, -0.27, 0.85, 0.2, [0.3, -1, 0]), r: strum(-0.06), handL: 0.2, handR: 0 }],
      [1, { y: -0.06, bend: -7, nod: -14, twist: 8, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: -0.3, kneeL: -0.3, l: at(-1, -0.36, 0.88, 0.17, [0.3, -1, 0]), r: strum(0.03), handL: 0.2, handR: 0 }],
      [1.5, { y: -0.08, bend: -7, nod: -14, twist: 8, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: -0.3, kneeL: -0.3, l: at(-1, -0.43, 0.9, 0.12, [0.3, -1, 0]), r: strum(-0.06), handL: 0.2, handR: 0 }],
    ],
  }),
  full({
    id: 'monitor-foot', name: 'Foot on the Monitor', tags: 'rock | full |', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Plant one foot up on an imaginary stage monitor, lean over the knee and strum down to the crowd.',
    keys: [
      [0, { y: -0.07, x: -0.02, bend: 12, nod: 8, lean: -3, rf: [0.15, 0.17, 0.2], lf: [-0.1, 0, 0], kneeR: 0.2, ...{ l: FRET, r: strum(0.04), handL: 0.2, handR: 0 } }],
      [0.5, { y: -0.09, x: -0.02, bend: 15, nod: 4, lean: -3, rf: [0.15, 0.17, 0.2], lf: [-0.1, 0, 0], kneeR: 0.2, ...{ l: FRET, r: strum(-0.06), handL: 0.2, handR: 0 } }],
      [1, { y: -0.07, x: -0.02, bend: 12, nod: 8, lean: -3, rf: [0.15, 0.17, 0.2], lf: [-0.1, 0, 0], kneeR: 0.2, ...{ l: FRET, r: strum(0.04), handL: 0.2, handR: 0 } }],
      [1.5, { y: -0.05, x: 0, bend: 4, nod: -6, lean: 0, rf: [0.14, 0.04, 0.08], lf: [-0.1, 0, 0], kneeR: 0.1, ...{ l: FRET, r: strum(-0.06), handL: 0.2, handR: 0 } }],
    ],
  }),

  // --- More frontman / headbang --------------------------------------------------
  combo('headbang-fist', 'Headbang Fist Pump', 'powerStance', 'rkFistBang', 'mid', 2, 'rock | full | punch', {
    accent: 'rkBodyBang', desc: 'Bow the chest on every beat while one fist punches straight up, switching fists each beat.',
  }),
  full({
    id: 'hand-to-ear', name: 'Can\'t Hear You', tags: 'rock pop | arms |', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Cup one hand to your ear and lean in, while the other arm beckons the crowd to get louder.',
    keys: [
      [0, { y: -0.08, lean: 5, head: 8, ...WIDE_LOW, r: at(1, 0.22, 0.95, 0.04, [1, 0.3, -0.3]), l: at(-1, -0.38, 0.68, 0.18, [0.6, -1, -0.2]), handR: 1, handL: 1 }],
      [1, { y: -0.05, lean: 5, head: 8, ...WIDE_LOW, r: at(1, 0.22, 0.95, 0.04, [1, 0.3, -0.3]), l: at(-1, -0.2, 0.86, 0.22, [0.8, -1, -0.2]), handR: 1, handL: 0.3 }],
    ],
  }),
  full({
    id: 'circle-pit', name: 'Circle Pit Run', tags: 'rock | legs turn | jump spin', beats: 4, level: 'high', d: 3, parts: ['legs', 'turn', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'Jog on the spot while turning a full circle over four beats, arms pumping like a runner.',
    keys: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k / 2, { ...PIT_FEET(k), spin: k * 45 }] as const),
  }),

];
