/**
 * Gospel and praise: the `gospel` set (see AUTHORING.md, "Genre sets", and
 * ../genreSets/variety.ts, which lists every id here under its set).
 *
 * The real vocabulary of a gospel choir and a praising congregation, as a
 * non-dancer in the pews does it: the choir's side-to-side step with the clap
 * on the backbeat and its travelling two-step; raised-hand praise, lifted
 * hands swaying, pointing up and the hand to the heart, the handkerchief wave
 * and the tambourine; the bow and rise; the praise-break "shout" (fast,
 * hunched stepping in place with the fists pumping in front of the chest,
 * sometimes breaking into hops: the holy dance of the Black church and
 * Pentecostal congregations); and step-team stomps and claps from church
 * step ministries. Sources: the Wikipedia articles "Shout (Black gospel
 * music)" and "Ring shout", tutorial footage ("How to Shout 101", choir
 * two-step training videos), line-dance step sheets of choir sways.
 *
 * Tempos: worship songs 60-80 (the calm opens lyrical alongside, and the
 * gentle moves here stay), praise songs 95-130, praise breaks 130-170 (the
 * shout is stepped on the beat with the fists on the half beat).
 * All are hand-authored full-body moves (no shared layer patterns).
 */
import { ARM, FIST, OPEN, at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;

/** Palm on the chest (the "hand to the heart"). */
const HEART_L = at(-1, -0.03, 0.74, 0.16, [1, -0.4, 0]);

// --- Choir step & clap: step out, touch the other foot in, clap up on that side on the backbeat ---------
const csStep: PoseSpec = {
  x: 0.03, y: -0.05, hips: 0.02, tilt: 2, lean: 2, head: 2,
  rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.06, kneeL: 0.02,
  r: at(1, 0.3, 0.55, 0.08, E_OUT), l: at(-1, -0.28, 0.55, 0.08, E_OUT), ...OPEN,
};
const csClap: PoseSpec = {
  x: 0.1, y: -0.09, hips: 0.04, tilt: 5, lean: 6, head: 8, nod: -3, turn: 10,
  rf: [0.15, 0, 0], lf: [0.04, 0.012, 0.01], kneeR: 0.12, kneeL: 0.1, pitchL: 20,
  r: at(1, 0.2, 0.88, 0.17, E_OUT), l: at(-1, 0.15, 0.88, 0.2, [0.5, -1, 0]), ...OPEN,
};

// --- Choir two-step: step, close, step, touch to the side, the arms swinging low, a double clap up high ---------
const ctArmsLow = (x: number): PoseSpec => ({ r: at(1, x + 0.24, 0.54, 0.12, E_OUT), l: at(-1, x - 0.02, 0.56, 0.2, E_DOWN), handR: 0.7, handL: 0.7 });
const ctArmsMid: PoseSpec = { r: at(1, 0.14, 0.66, 0.2, E_OUT), l: at(-1, -0.14, 0.66, 0.2, E_OUT), handR: 0.7, handL: 0.7 };
const ctClapHigh: PoseSpec = { r: at(1, 0.26, 0.92, 0.14, E_OUT), l: at(-1, 0.19, 0.92, 0.17, [0.5, -1, 0]), ...OPEN };

// --- Raised-hand praise: one open hand lifted high, the other on the heart, swaying ---------
const rhp = (sway: 1 | -1, lift: number): PoseSpec => ({
  x: 0.035 * sway, y: -0.05, hips: 0.04 * sway, tilt: 4 * sway, lean: 3 * sway, head: 6 * sway, nod: -10,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: sway > 0 ? 0.08 : 0, kneeL: sway > 0 ? 0 : 0.08,
  r: at(1, 0.2 + 0.03 * sway, 0.98 + lift, 0.1, E_UP), l: HEART_L, ...OPEN,
});

// --- Lifted hands sway: both hands up in a wide V, palms out, swaying slowly over two beats ---------
const lhs = (sway: 1 | -1, step: boolean): PoseSpec => ({
  x: 0.05 * sway, y: step ? -0.06 : -0.03, hips: 0.035 * sway, tilt: 4 * sway, lean: 7 * sway, head: 6 * sway, nod: -12,
  rf: sway > 0 ? [0.17, 0, 0] : [-0.01, step ? 0 : 0.012, 0.01], lf: sway > 0 ? [0.01, step ? 0 : 0.012, 0.01] : [-0.17, 0, 0],
  r: at(1, 0.36, 1.05, 0.06, E_UP), l: at(-1, -0.36, 1.05, 0.06, E_UP), ...OPEN,
});

// --- Point to heaven: point straight up on the step, then both hands to the heart on the touch ---------
const pthUp: PoseSpec = {
  x: 0.04, y: -0.05, hips: 0.03, tilt: 3, nod: -14, head: 4,
  rf: [0.17, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.06,
  r: at(1, 0.15, 1.09, 0.04, E_UP), l: HEART_L, handR: 0, formR: 'point', handL: 1,
};
const pthHeart: PoseSpec = {
  x: 0.07, y: -0.08, hips: 0.02, tilt: 1, nod: 8, head: 0,
  rf: [0.17, 0, 0], lf: [0.03, 0.012, 0.01], kneeR: 0.1, kneeL: 0.08,
  r: at(1, 0.05, 0.7, 0.19, [1, -0.6, 0]), l: HEART_L, ...OPEN,
};

// --- Handkerchief wave: one arm waving a handkerchief in big arcs over the head, bouncing ---------
const hw = (hx: number, hy: number, lean: number, y: number): PoseSpec => ({
  y, lean, head: lean * 0.6, nod: -8, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, hx, hy, 0.1, [1, 0.1, 0]), l: at(-1, -0.2, 0.55, 0.04, [1, 0, -0.4]), handR: 0.4, handL: 1,
});

// --- Tambourine: shaken high, struck on the other palm, then against the hip ---------
const tamUp = (dx: number, y: number): PoseSpec => ({
  y, x: 0.015, hips: 0.02, tilt: 2, nod: -8, head: 3, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.06, kneeL: 0.04,
  r: at(1, 0.2 + dx, 1.02, 0.08, E_UP), l: at(-1, -0.2, 0.62, 0.12, E_OUT), handR: 0.3, handL: 1,
});
const tamPalm: PoseSpec = {
  y: -0.09, x: -0.01, hips: -0.02, tilt: -2, bend: 6, nod: 8, head: -3, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.0, 0.66, 0.22, E_OUT), l: at(-1, -0.05, 0.62, 0.22, [0.5, -1, 0]), handR: 0.3, handL: 1,
};
const tamHip: PoseSpec = {
  y: -0.06, x: 0.03, hips: 0.05, tilt: 6, bend: 2, nod: 4, head: 4, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.04, kneeL: 0.1,
  r: at(1, 0.24, 0.5, 0.04, [1, 0, -0.4]), l: at(-1, -0.18, 0.66, 0.14, E_OUT), handR: 0.3, handL: 1,
};

// --- Bow & rise: arms crossed on the chest, bow, rise opening the arms wide and up ---------
const CROSS_R = at(1, -0.07, 0.76, 0.15, [0.3, -1, 0.3]);
const CROSS_L = at(-1, 0.07, 0.74, 0.17, [0.3, -1, 0.3]);
const bowStand: PoseSpec = { y: -0.02, nod: 4, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: CROSS_R, l: CROSS_L, ...OPEN };
const bowDown: PoseSpec = { y: -0.13, bend: 34, nod: 20, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.08, kneeL: 0.08, r: CROSS_R, l: CROSS_L, ...OPEN };
const bowOpen: PoseSpec = { y: -0.05, bend: 4, nod: -2, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: ARM.out, l: ARM.out, ...OPEN };
const bowHigh: PoseSpec = { y: 0, bend: -6, nod: -16, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], pitchR: 18, pitchL: 18, r: at(1, 0.3, 1.03, 0.04, E_UP), l: at(-1, -0.3, 1.03, 0.04, E_UP), ...OPEN };

// --- Praise-break shout: hunched, quick alternating steps in place, fists pumping in front of the chest ---------
const shout = (side: 1 | -1, y: number): PoseSpec => {
  const lift = 0.13, down = side > 0;
  return {
    y, x: 0.012 * side, bend: 13, nod: 7, lean: 2 * side, twist: 9 * side, hips: 0.015 * side, tilt: 3 * side,
    rf: down ? [0.06, 0, 0.02] : [0.07, lift, 0.04], lf: down ? [-0.07, lift, 0.04] : [-0.06, 0, 0.02],
    kneeR: down ? 0.1 : 0.32, kneeL: down ? 0.32 : 0.1,
    r: at(1, 0.13, down ? 0.58 : 0.8, 0.2, E_OUT), l: at(-1, -0.13, down ? 0.8 : 0.58, 0.2, E_OUT), ...FIST,
  };
};

// --- Shout hop: the shout breaking into hops from foot to foot, the free knee up, one fist thrown up ---------
const shLand: PoseSpec = {
  y: -0.12, x: 0.03, bend: 14, nod: 8, lean: 3, twist: 8, hips: 0.02, tilt: 3,
  rf: [0.07, 0, 0.02], lf: [-0.1, 0.14, 0.05], kneeR: 0.12, kneeL: 0.3,
  r: at(1, 0.14, 0.58, 0.2, E_OUT), l: at(-1, -0.16, 0.86, 0.17, E_OUT), ...FIST,
};
const shAir: PoseSpec = {
  y: 0.05, x: 0, bend: 8, nod: 2, lean: 0, twist: 0, hips: 0, tilt: 0,
  rf: [0.08, 0.06, 0.02], lf: [-0.08, 0.06, 0.02], kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.24, 0.98, 0.1, E_UP), l: at(-1, -0.14, 0.68, 0.2, E_OUT), ...FIST,
};

// --- Step-team stomp & clap: stomp, stomp, clap, slap the thighs, arms crossed and chin up ---------
const stkLift: PoseSpec = {
  y: -0.04, bend: 3, rf: [0.12, 0.19, 0.03], lf: [-0.11, 0, 0], kneeR: 0.22,
  r: at(1, 0.2, 0.62, 0.15, E_OUT), l: at(-1, -0.2, 0.62, 0.15, E_OUT), ...FIST,
};
const stkStomp = (side: 1 | -1): PoseSpec => ({
  y: -0.12, bend: 8, nod: 8, hips: 0.02 * side, tilt: 2 * side,
  rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.14, kneeL: 0.14,
  r: at(1, 0.26, 0.42, 0.02, [1, 0, -0.5]), l: at(-1, -0.26, 0.42, 0.02, [1, 0, -0.5]), ...FIST,
});
const stkLiftL: PoseSpec = { ...stkStomp(1), y: -0.06, bend: 4, nod: 2, lf: [-0.13, 0.19, 0.03], kneeL: 0.22, kneeR: 0.06 };
const stkClap: PoseSpec = { y: -0.06, nod: -4, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.06, kneeL: 0.06, r: ARM.clap, l: ARM.clap, ...OPEN };
const stkSlap: PoseSpec = {
  y: -0.13, bend: 14, nod: 10, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.15, kneeL: 0.15,
  r: at(1, 0.13, 0.43, 0.12, E_DOWN), l: at(-1, -0.13, 0.43, 0.12, E_DOWN), ...OPEN,
};
const stkCross: PoseSpec = {
  y: -0.03, bend: -4, nod: -10, rf: [0.13, 0, 0], lf: [-0.13, 0, 0],
  r: at(1, -0.08, 0.76, 0.14, [0.3, -1, 0.3]), l: at(-1, 0.08, 0.72, 0.17, [0.3, -1, 0.3]), ...FIST,
};

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  // --- Easy: the choir and the pews ---------------------------------------------
  full({
    id: 'choir-step-clap', name: 'Choir Step & Clap', tags: 'pop funk | legs arms | clap', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'The gospel choir step: step out to the side with the arms opening low, then touch the other foot in beside it, dip and clap up by that shoulder on the backbeat, leaning into it; step back the other way.',
    keys: [[0, csStep], [1, csClap]],
  }),
  full({
    id: 'raised-hand-praise', name: 'Raised-Hand Praise', tags: 'pop | arms hips | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true, bounce: 0.2,
    desc: 'Lift one open hand high with the palm to the sky and the other palm on the heart, eyes up, and sway slowly from side to side; change hands.',
    keys: [[0, rhp(1, 0.04)], [1, rhp(-1, 0.06)], [2, rhp(1, 0.06)], [3, { ...rhp(-1, 0), r: at(1, 0.2, 0.86, 0.15, E_UP) }]],
  }),
  full({
    id: 'lifted-hands-sway', name: 'Lifted Hands Sway', tags: 'pop | arms hips | hands wave', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.1,
    desc: 'Both hands lifted high and wide with the palms open, step and sway slowly to one side over two beats, leaning the arms over with the body, then to the other side.',
    keys: [[0, lhs(1, true)], [1, lhs(1, false)], [2, lhs(-1, true)], [3, lhs(-1, false)]],
  }),
  full({
    id: 'point-to-heaven', name: 'Point to Heaven', tags: 'pop | arms legs | point hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Step out and point one finger straight up to the sky with the other hand on the heart, then touch the other foot in and bring both hands to the heart with a small bow of the head; point up with the other hand.',
    keys: [[0, pthUp], [1, pthHeart]],
  }),

  // --- Medium -----------------------------------------------------------------
  full({
    id: 'choir-two-step', name: 'Choir Two-Step', tags: 'pop funk | legs arms | clap walk', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.24,
    desc: 'Travel to the side step, close, step, touch, swinging both arms low toward the travel, then clap twice up high by the shoulder on the touch, leaning into it; travel back the other way.',
    keys: [
      [0, { x: 0.05, y: -0.06, hips: 0.02, tilt: 2, lean: 2, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.06, ...ctArmsLow(0.04) }],
      [1, { x: 0.12, y: -0.04, hips: -0.01, tilt: -1, lean: 0, rf: [0.2, 0, 0], lf: [0.07, 0, 0], ...ctArmsMid }],
      [2, { x: 0.2, y: -0.07, hips: 0.03, tilt: 3, lean: 2, rf: [0.33, 0, 0], lf: [0.07, 0, 0], kneeR: 0.07, ...ctArmsLow(0.18) }],
      [3, { x: 0.26, y: -0.09, hips: 0.04, tilt: 5, lean: 7, head: 8, nod: -4, turn: 12, rf: [0.33, 0, 0], lf: [0.17, 0.012, 0.01], kneeR: 0.12, kneeL: 0.1, pitchL: 20, ...ctClapHigh }],
      [3.5, { x: 0.26, y: -0.07, hips: 0.035, tilt: 4, lean: 6, head: 7, nod: -4, turn: 12, rf: [0.33, 0, 0], lf: [0.17, 0.012, 0.01], kneeR: 0.08, kneeL: 0.08, pitchL: 20, r: at(1, 0.24, 0.78, 0.14, E_OUT), l: at(-1, 0.16, 0.78, 0.18, [0.5, -1, 0]), ...OPEN }],
    ],
  }),
  full({
    id: 'handkerchief-wave', name: 'Handkerchief Wave', tags: 'pop party | arms | wave hands', beats: 2, level: 'mid', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Wave a handkerchief over the head in big arcs from one side to the other, bouncing in the knees on every beat, the other hand on the hip; change hands.',
    keys: [[0, hw(0.38, 0.95, -4, -0.08)], [0.5, hw(0.2, 1.07, 0, -0.03)], [1, hw(0.02, 1.0, 5, -0.08)], [1.5, hw(0.2, 1.07, 0, -0.03)]],
  }),
  full({
    id: 'tambourine-praise', name: 'Tambourine Praise', tags: 'pop funk | arms | shake clap', beats: 4, level: 'mid', d: 2, parts: ['arms', 'hips'], mirror: true,
    desc: 'Shake a tambourine high over one shoulder for two beats, then strike it down on the other palm in front of the waist and against the hip; change hands.',
    keys: [[0, tamUp(0.04, -0.04)], [0.5, tamUp(-0.04, -0.06)], [1, tamUp(0.04, -0.04)], [1.5, tamUp(-0.04, -0.06)], [2, tamPalm], [3, tamHip]],
  }),
  full({
    id: 'praise-bow-rise', name: 'Bow & Rise', tags: 'pop | full | hands', beats: 4, level: 'mid', d: 2, parts: ['torso', 'arms'], bounce: 0,
    desc: 'Arms crossed on the chest, bow forward from the hips with soft knees, then rise and open the arms wide, and up on the toes reach both hands high, eyes up; cross the arms again.',
    keys: [[0, bowStand], [1, bowDown], [2, bowOpen], [3, bowHigh]],
  }),
  full({
    id: 'praise-shout', name: 'Praise Shout', tags: 'funk aerobic | legs full | stomp', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'The praise-break "shout": hunched over with the knees bent, step quickly from foot to foot in place on every half beat, knees lifting, the fists pumping up and down in front of the chest against the feet.',
    keys: [[0, shout(1, -0.1)], [0.5, shout(-1, -0.1)], [1, shout(1, -0.11)], [1.5, shout(-1, -0.1)]],
  }),

  // --- Hard -------------------------------------------------------------------
  full({
    id: 'shout-hop', name: 'Shout Hop', tags: 'funk aerobic | legs full | jump', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump', 'arms'], mirror: true, jump: true, impact: true,
    desc: 'The shout breaking into hops: hunched, hop from foot to foot with the free knee pulled up high, one fist thrown up toward the sky as you leave the floor and the other pumping at the chest.',
    keys: [[0, shLand], [0.5, shAir], [1, mir(shLand)], [1.5, mir(shAir)]],
  }),
  full({
    id: 'step-team-stomp-clap', name: 'Step-Team Stomp & Clap', tags: 'hiphop funk | full | stomp clap', beats: 4, level: 'high', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'Step-team style: stomp right, stomp left with the fists driving down by the hips, clap in front of the chest, slap both thighs low, then snap the fists crossed onto the chest, chin up; lift the knee and stomp again.',
    keys: [[0, stkStomp(1)], [0.5, stkLiftL], [1, stkStomp(-1)], [2, stkClap], [2.5, stkSlap], [3, stkCross], [3.5, stkLift]],
  }),
];
