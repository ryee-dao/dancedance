/**
 * Synth-pop and new wave: the `synthpop` set (see AUTHORING.md, "Genre sets",
 * and ../genreSets/variety.ts, which lists every id here under its set).
 *
 * How a new wave / synth-pop club floor danced, 1979-1986 and at the 80s
 * nights since: the cool side step with the straight arms swinging across
 * the body (the step everyone did to "Safety Dance" and "Take On Me"), the
 * robot done lite (the arms in right angles ticking on the beat, the head
 * ticking with them: Kraftwerk, Devo, Men Without Hats), the New Romantic
 * poses of the Blitz club (the wrist at the brow, the chin up, held for a
 * bar), the keytar, the shoulder pops, the stiff toe-bounce that is the
 * pogo with the jump taken out, the finger-snap glide, the hunched kick
 * shuffle of the John Hughes films, the angular "mannequin" hits, the side
 * skip with the arms swinging up across, the big romantic arm sweep, the
 * pogo with a point at the synth hook, and the post-punk stomp with the arms
 * scissoring in front (the flailing, stamping dance of Joy Division gigs).
 * Sources: Wikipedia "New wave music", "New Romantic" (the Blitz Club
 * posing), "Pogo (dance)", "Robot (dance)", "Keytar"; Wendy Fonarow,
 * "Empire of Dirt" (indie / post-punk audience movement); YouTube "My 80s New
 * Wave Dance Moves" (Acel Bisa, Q1ML4M5Rosc), "Totally 80's New Wave Dance!"
 * (80s Era, wzClvJoTPOY), "80s Dance Moves" (Tamara Gassner, LJp3SePr9dg),
 * "Iconic 80's Dance Moves" (Chicago Children's Theatre, awPecmtraXc);
 * never one video's routine. Walk-Like-an-Egyptian hands are one song's
 * signature (and the King Tut of disco & funk): left out.
 *
 * Tempos: synth-pop 100-130 (the moves keep to one idea a beat), new wave up
 * to ~150 (the pogo, the flail stomp), synth ballads 70-90 (the pose, the
 * glide and the sweep).
 * All are hand-authored full-body moves (no shared layer patterns).
 */
import { FIST, OPEN, at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;
const STRAIGHT = [1, 0, 0] as const;

// --- New wave side step: step out and touch in, both straight arms swinging across the body as one ---------
const nwStep: PoseSpec = {
  x: 0.05, y: -0.05, hips: 0.03, tilt: 3, lean: -3, head: -4, nod: -6, turn: 14,
  rf: [0.2, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.06, kneeL: 0.02,
  r: at(1, 0.44, 0.66, 0.06, STRAIGHT), l: at(-1, 0.12, 0.6, 0.18, STRAIGHT), ...OPEN,
};
const nwTouch: PoseSpec = {
  x: 0.1, y: -0.035, hips: 0.02, tilt: 2, lean: 3, head: 4, nod: -6, turn: -14,
  rf: [0.2, 0, 0], lf: [0.07, 0.012, 0.01], pitchL: 18, kneeR: 0.03, kneeL: -0.04,
  r: at(1, -0.1, 0.6, 0.18, STRAIGHT), l: at(-1, -0.44, 0.66, 0.06, STRAIGHT), ...OPEN,
};

// --- Robot tick: the upper arms out at shoulder height, one forearm up and one down, swapping on the beat ---------
const UP: [number, number, number, number] = [86, 4, 172, 8];
const DOWN: [number, number, number, number] = [86, 4, 8, 8];
const rt = (rUp: boolean, held: boolean): PoseSpec => ({
  y: held ? -0.05 : -0.07, x: 0, hips: 0, tilt: 0, head: rUp ? 9 : -9, turn: rUp ? 16 : -16, nod: held ? 0 : 3,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.05, kneeL: 0.05,
  r: rUp ? UP : DOWN, l: rUp ? DOWN : UP, ...OPEN, shR: rUp ? 0.25 : 0, shL: rUp ? 0 : 0.25,
});

// --- New Romantic pose: wrist at the brow and the other arm down and out, chin up; the pose opens on beat 3 ---------
const nrBrow: PoseSpec = {
  x: 0.04, y: -0.04, hips: 0.045, tilt: 6, lean: -4, bend: -4, head: -8, turn: -22, nod: -10,
  rf: [0.17, 0, 0], lf: [-0.08, 0, 0.02], pitchL: 20, kneeL: 0.08,
  r: at(1, 0.05, 0.97, 0.13, [1, 0.6, 0]), l: at(-1, -0.42, 0.55, 0.05, STRAIGHT), handR: 1, handL: 1,
};
const nrHold: PoseSpec = { ...nrBrow, y: -0.06, lean: -5, nod: -12 };
const nrPass: PoseSpec = {
  x: 0.0, y: -0.07, hips: 0, tilt: 0, lean: 0, bend: 3, head: 0, turn: 0, nod: 6,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchL: 0, kneeR: 0.08, kneeL: 0.08,
  r: at(1, 0.12, 0.64, 0.2, E_DOWN), l: at(-1, -0.14, 0.64, 0.2, E_DOWN), handR: 1, handL: 1,
};
const nrReach: PoseSpec = {
  x: -0.04, y: -0.04, hips: -0.045, tilt: -6, lean: 5, bend: -3, head: 6, turn: 20, nod: -14,
  rf: [0.08, 0, 0.02], lf: [-0.17, 0, 0], pitchR: 20, kneeR: 0.08,
  r: at(1, 0.4, 1.02, 0.06, STRAIGHT), l: at(-1, -0.02, 0.75, 0.17, [1, -0.4, 0]), handR: 1, handL: 1,
};

// --- Keytar: slung across the body, the neck up to the left hand, the right hand's fingers walking the keys ---------
const kt = (k: number, down: boolean): PoseSpec => ({
  y: down ? -0.07 : -0.04, x: 0.012 * (k < 2 ? 1 : -1), hips: 0.025 * (k < 2 ? 1 : -1), tilt: 3 * (k < 2 ? 1 : -1),
  bend: 4, nod: down ? 10 : 0, head: 4, turn: -14, twist: -10,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.06, kneeL: 0.06,
  pitchR: k >= 2 && down ? 12 : 0, pitchL: k < 2 && down ? 12 : 0,
  r: at(1, [0.17, 0.05, 0.13, 0.02][k], down ? 0.6 : 0.64, 0.2, E_OUT), formR: 'fingers',
  l: at(-1, -0.33, 0.92, 0.16, [1, -0.6, 0]), handL: 0.4,
});

// --- Shoulder pops: one shoulder pops up with the chin dropping to it, the arms hanging stiff ---------
const sp = (s: 1 | -1, pop: boolean): PoseSpec => ({
  y: pop ? -0.04 : -0.07, x: 0.02 * s, hips: 0.03 * s, tilt: 3 * s,
  head: pop ? 22 * s : 3 * s, nod: pop ? 6 : 0, lean: pop ? -6 * s : 0, chestX: pop ? 0.035 * s : 0,
  shR: s > 0 && pop ? 1.25 : 0.05, shL: s < 0 && pop ? 1.25 : 0.05,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: s < 0 ? 0.1 : 0.02, kneeL: s > 0 ? 0.1 : 0.02,
  r: at(1, 0.24, s > 0 && pop ? 0.58 : 0.5, 0.08, STRAIGHT), l: at(-1, -0.24, s < 0 && pop ? 0.58 : 0.5, 0.08, STRAIGHT), ...FIST,
});

// --- Stiff bounce: rise on the toes and drop, rigid, arms straight down, the head snapping to one side ---------
const sbUp = (s: 1 | -1): PoseSpec => ({
  y: 0.01, x: 0.015 * s, bend: -2, nod: -8, head: 8 * s, turn: 30 * s,
  rf: [0.08, 0, 0], lf: [-0.08, 0, 0], pitchR: 36, pitchL: 36, kneeR: 0, kneeL: 0,
  r: at(1, 0.3, 0.52, 0.04, STRAIGHT), l: at(-1, -0.3, 0.52, 0.04, STRAIGHT), handR: 1, handL: 1, shR: 0.7, shL: 0.7,
});
const sbDown = (s: 1 | -1): PoseSpec => ({
  y: -0.08, x: 0.0, bend: 3, nod: 12, head: 0, turn: 8 * s,
  rf: [0.08, 0, 0], lf: [-0.08, 0, 0], pitchR: 0, pitchL: 0, kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.15, 0.48, 0.05, STRAIGHT), l: at(-1, -0.15, 0.48, 0.05, STRAIGHT), handR: 1, handL: 1, shR: 0, shL: 0,
});

// --- Snap glide: glide one foot out, draw the other in along the floor, snapping the fingers high and low ---------
const sgOut: PoseSpec = {
  x: 0.06, y: -0.07, hips: 0.04, tilt: 5, lean: -4, head: -6, turn: 18, nod: -4,
  rf: [0.24, 0, 0], lf: [-0.09, 0, 0], slideR: true, kneeR: 0.08, kneeL: 0.1, pitchL: 14,
  r: at(1, 0.3, 0.92, 0.12, E_OUT), l: at(-1, -0.2, 0.56, 0.12, E_OUT), handR: 0.1, handL: 0.1,
};
const sgIn: PoseSpec = {
  x: 0.12, y: -0.04, hips: 0.02, tilt: 2, lean: 1, head: 2, turn: 6, nod: 4,
  rf: [0.24, 0, 0], lf: [0.07, 0, 0], slideL: true, kneeR: 0.02, kneeL: 0.02, pitchL: 0,
  r: at(1, 0.24, 0.8, 0.16, E_OUT), l: at(-1, -0.16, 0.64, 0.16, E_OUT), handR: 0.9, handL: 0.9,
};

// --- Kick shuffle: hunched, kick one foot low and out as that shoulder rolls forward, bent arms swinging across ---------
const ksKick: PoseSpec = {
  y: -0.05, bend: 8, nod: 6, twist: -14, lean: 2, head: -4, hips: -0.02, tilt: -3, shR: 0.7, shL: 0.1,
  rf: [0.16, 0.08, 0.1], lf: [-0.08, 0, 0], pitchR: -10, kneeR: 0.05, kneeL: 0.1,
  r: at(1, -0.02, 0.7, 0.2, E_OUT), l: at(-1, -0.3, 0.62, 0.1, E_OUT), handR: 0.3, handL: 0.3,
};
const ksDown: PoseSpec = {
  y: -0.08, bend: 8, nod: 2, twist: 0, lean: 0, head: 0, hips: 0, tilt: 0, shR: 0.3, shL: 0.3,
  rf: [0.09, 0, 0.02], lf: [-0.09, 0, 0], pitchR: 0, kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.16, 0.64, 0.17, E_OUT), l: at(-1, -0.16, 0.64, 0.17, E_OUT), handR: 0.3, handL: 0.3,
};

// --- Mannequin hits: a new angular arm shape hit on every beat and held, the head snapping round with it ---------
const mhBase = (turn: number, y: number): PoseSpec => ({ y, turn, nod: -4, rf: [0.14, 0, 0], lf: [-0.14, 0, 0], kneeR: 0.06, kneeL: 0.06 });
const MH: readonly PoseSpec[] = [
  // An L: one arm straight up, the other straight out to the side.
  { ...mhBase(-20, -0.06), r: [170, 4, 174, 4], l: [88, 0, 90, 0], ...OPEN, lean: 3 },
  // Elbows up and out, forearms down, the hands hanging like a puppet's.
  { ...mhBase(0, -0.08), r: [96, 10, 20, 30], l: [96, 10, 20, 30], ...OPEN, lean: 0, shR: 0.4, shL: 0.4 },
  // One arm straight out, the other forearm flat across the chest.
  { ...mhBase(24, -0.06), r: [88, 0, 90, 0], l: at(-1, 0.14, 0.74, 0.18, [1, -0.2, 0]), handR: 1, handL: 0, lean: -3 },
  // Both arms straight down and out, palms flat, chin up.
  { ...mhBase(0, -0.05), r: [40, 0, 42, 0], l: [40, 0, 42, 0], ...OPEN, nod: -10, lean: 0 },
];

// --- Skip swing: skip from foot to foot to the side, both straight arms swinging up across the body ---------
const ssLand: PoseSpec = {
  x: 0.05, y: -0.08, lean: -3, head: -3, turn: 10, nod: 4,
  rf: [0.16, 0, 0], lf: [-0.04, 0.06, 0.04], kneeR: 0.12, kneeL: 0.18,
  r: at(1, 0.13, 0.56, 0.18, STRAIGHT), l: at(-1, -0.01, 0.56, 0.2, STRAIGHT), ...OPEN,
};
const ssAir: PoseSpec = {
  x: 0.06, y: 0.025, lean: -6, head: -6, turn: 14, nod: -8,
  rf: [0.15, 0.03, 0], lf: [-0.03, 0.08, 0.04], kneeR: 0.06, kneeL: 0.2,
  r: at(1, 0.38, 0.84, 0.1, STRAIGHT), l: at(-1, 0.13, 0.82, 0.24, STRAIGHT), ...OPEN,
};

// --- Romantic arm sweep: lunge to the side as both arms sweep up over the head and down the other side ---------
const RAS: readonly PoseSpec[] = [
  { x: 0.07, y: -0.1, hips: 0.03, tilt: 3, lean: -10, head: -8, turn: 14, nod: 4, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.16, kneeL: 0.02, pitchL: 10,
    r: at(1, 0.44, 0.6, 0.06, STRAIGHT), l: at(-1, 0.16, 0.56, 0.16, STRAIGHT), ...OPEN },
  { x: 0.05, y: -0.06, hips: 0.01, tilt: 1, lean: -4, head: -2, turn: 6, nod: -10, rf: [0.25, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.08, kneeL: 0.04, pitchL: 6,
    r: at(1, 0.32, 1.0, 0.08, STRAIGHT), l: at(-1, 0.08, 1.02, 0.24, STRAIGHT), ...OPEN },
  { x: -0.0, y: -0.06, hips: -0.01, tilt: -1, lean: 4, head: 2, turn: -6, nod: -12, rf: [0.21, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.04, kneeL: 0.08, pitchR: 6,
    r: at(1, -0.08, 1.02, 0.24, STRAIGHT), l: at(-1, -0.32, 1.0, 0.08, STRAIGHT), ...OPEN },
  { x: -0.03, y: -0.09, hips: -0.03, tilt: -3, lean: 9, head: 6, turn: -14, nod: 2, rf: [0.21, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.02, kneeL: 0.14, pitchR: 10,
    r: at(1, -0.14, 0.58, 0.16, STRAIGHT), l: at(-1, -0.44, 0.62, 0.06, STRAIGHT), ...OPEN },
];
const ras = (k: number): PoseSpec => RAS[k];

// --- Pogo point: stiff straight-up pogo jumps, pointing one finger up at the ceiling on every other landing ---------
const ppAir = (s: 1 | -1): PoseSpec => ({
  y: 0.045, bend: -2, nod: -6, head: 0, rf: [0.06, 0.04, 0], lf: [-0.06, 0.04, 0], pitchR: 30, pitchL: 30, kneeR: 0, kneeL: 0,
  r: s > 0 ? at(1, 0.16, 1.08, 0.06, E_UP) : at(1, 0.17, 0.5, 0.04, STRAIGHT), l: s < 0 ? at(-1, -0.16, 1.08, 0.06, E_UP) : at(-1, -0.17, 0.5, 0.04, STRAIGHT),
  handR: s > 0 ? 0 : 1, handL: s < 0 ? 0 : 1, formR: s > 0 ? 'point' : undefined, formL: s < 0 ? 'point' : undefined,
});
const ppLand = (s: 1 | -1): PoseSpec => ({
  y: -0.07, bend: 4, nod: 12, head: 6 * s, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], pitchR: 0, pitchL: 0, kneeR: 0.08, kneeL: 0.08,
  r: s > 0 ? at(1, 0.16, 0.98, 0.1, E_UP) : at(1, 0.17, 0.5, 0.04, STRAIGHT), l: s < 0 ? at(-1, -0.16, 0.98, 0.1, E_UP) : at(-1, -0.17, 0.5, 0.04, STRAIGHT),
  handR: s > 0 ? 0 : 1, handL: s < 0 ? 0 : 1, formR: s > 0 ? 'point' : undefined, formL: s < 0 ? 'point' : undefined,
});

const ppSwap: PoseSpec = {
  y: 0.045, bend: -2, nod: -6, head: 0, rf: [0.06, 0.04, 0], lf: [-0.06, 0.04, 0], pitchR: 30, pitchL: 30, kneeR: 0, kneeL: 0,
  r: at(1, 0.14, 0.76, 0.18, E_OUT), l: at(-1, -0.14, 0.76, 0.18, E_OUT), ...FIST,
};

// --- Flail stomp: stamp from foot to foot, the straight arms scissoring open and crossed in front, head shaking ---------
const fsCross = (s: 1 | -1): PoseSpec => ({
  y: -0.1, bend: 10, nod: 10, head: 10 * s, lean: 2 * s, hips: 0.015 * s, tilt: 2 * s,
  rf: s > 0 ? [0.1, 0, 0.02] : [0.1, 0.1, 0.04], lf: s > 0 ? [-0.1, 0.1, 0.04] : [-0.1, 0, 0.02], kneeR: s > 0 ? 0.12 : 0.3, kneeL: s > 0 ? 0.3 : 0.12,
  r: at(1, -0.1, s > 0 ? 0.68 : 0.62, 0.22, STRAIGHT), l: at(-1, 0.1, s > 0 ? 0.62 : 0.68, 0.24, STRAIGHT), ...OPEN,
});
const fsOpen = (s: 1 | -1): PoseSpec => ({
  y: -0.07, bend: 6, nod: 2, head: -8 * s, lean: 0, hips: 0, tilt: 0,
  rf: [0.1, 0, 0.02], lf: [-0.1, 0, 0.02], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.38, s > 0 ? 0.82 : 0.64, 0.1, STRAIGHT), l: at(-1, -0.38, s > 0 ? 0.64 : 0.82, 0.1, STRAIGHT), ...OPEN,
});

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  // --- Easy ---------------------------------------------------------------------
  full({
    id: 'new-wave-side-step', name: 'New Wave Side Step', tags: 'pop disco | arms legs | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'The cool 80s side step: step out and touch the other foot in, both arms hanging straight and swinging together across the body to the stepping side, then across to the other, the face deadpan and turning with them.',
    keys: [[0, nwStep], [1, nwTouch]],
  }),
  full({
    id: 'robot-tick', name: 'Robot Tick', tags: 'pop funk | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], bounce: 0.2,
    desc: 'Robot done lite: the upper arms held out at shoulder height, one forearm pointing up and the other hanging down, flip them on every beat with a sharp tick and a little knee dip, the head ticking round toward the raised hand.',
    keys: [[0, rt(true, false)], [0.5, rt(true, true)], [1, rt(false, false)], [1.5, rt(false, true)]],
  }),
  full({
    id: 'new-romantic-pose', name: 'New Romantic Pose', tags: 'pop | arms hips | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips', 'torso'], mirror: true, bounce: 0.1,
    desc: 'Blitz-club posing: step into the hip with the back of one wrist at the brow and the other arm down and out, chin up and looking away, hold it, then let the arms fall through and open into the other pose, one arm reaching high and the other hand at the chest.',
    keys: [[0, nrBrow], [1, nrHold], [2, nrPass], [3, nrReach]],
  }),
  full({
    id: 'keytar-groove', name: 'Keytar Groove', tags: 'pop rock | arms | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.3,
    desc: 'Play a keytar slung across the body: the left hand up on the neck by the shoulder, the right hand\'s fingers walking along the keys at the hip, bobbing the knees and swaying the weight from foot to foot every two beats.',
    keys: [[0, kt(0, true)], [0.5, kt(1, false)], [1, kt(0, true)], [1.5, kt(1, false)], [2, kt(2, true)], [2.5, kt(3, false)], [3, kt(2, true)], [3.5, kt(3, false)]],
  }),
  full({
    id: 'shoulder-pops', name: 'Shoulder Pops', tags: 'pop funk | arms | shake', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'], bounce: 0.2,
    desc: 'Arms hanging stiff with loose fists, pop one shoulder up to the ear on the beat as the head tips toward it and the weight shifts that way, drop it on the "and", then pop the other.',
    keys: [[0, sp(1, true)], [0.5, sp(1, false)], [1, sp(-1, true)], [1.5, sp(-1, false)]],
  }),
  full({
    id: 'stiff-bounce', name: 'Stiff Bounce', tags: 'pop rock | legs |', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], bounce: 0.2,
    desc: 'The new wave bounce, a pogo without the jump: body rigid and the arms hanging straight with the palms flat, rise up onto the toes on every beat with the shoulders up, the palms flicking out and the head snapping round to one side, drop back down onto the heels; the head snaps the other way on the next.',
    keys: [[0, sbUp(1)], [0.5, sbDown(1)], [1, sbUp(-1)], [1.5, sbDown(-1)]],
  }),
  full({
    id: 'finger-snap-glide', name: 'Finger-Snap Glide', tags: 'pop funk | legs arms | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true, travel: 0.12,
    desc: 'Cool and smooth: glide one foot out along the floor snapping the fingers, one hand up by the shoulder and the other low, then draw the other foot in to it with the hands opening; glide back the other way.',
    keys: [[0, sgOut], [1, sgIn]],
  }),

  // --- Medium -------------------------------------------------------------------
  full({
    id: 'kick-shuffle', name: 'Kick Shuffle', tags: 'pop rock | legs | kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'],
    desc: 'The hunched 80s school-dance shuffle: kick one foot low and out in front as that shoulder rolls forward and the bent arms swing across the other way, put it down, then kick the other.',
    keys: [[0, ksKick], [0.5, ksDown], [1, mir(ksKick)], [1.5, ksDown]],
  }),
  full({
    id: 'mannequin-hits', name: 'Mannequin Hits', tags: 'pop funk | arms | hands', beats: 4, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Snap the arms into a new stiff, angular shape on every beat and hold it, the head snapping round with each: an L (one arm up, one out), elbows up with the hands hanging, one arm out with the other forearm across the chest, both arms straight down and out.',
    keys: [[0, MH[0]], [1, MH[1]], [2, MH[2]], [3, MH[3]]],
  }),
  full({
    id: 'skip-swing', name: 'Skip & Swing', tags: 'pop aerobic | legs arms | jump', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'jump'], mirror: true, jump: true,
    desc: 'Skip from foot to foot, the free knee lifting, both straight arms swinging low through and up across the body to the side of the hop, then down and up across to the other side.',
    keys: [[0, ssLand], [0.5, ssAir], [1, mir(ssLand)], [1.5, mir(ssAir)]],
  }),
  full({
    id: 'romantic-arm-sweep', name: 'Romantic Arm Sweep', tags: 'pop | arms | wave', beats: 4, level: 'low', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Lunge to one side with both straight arms swung low to it, then sweep them up together in a big arc over the head as the weight crosses, and down the other side into the other lunge, the head following the hands.',
    keys: [[0, ras(0)], [1, ras(1)], [2, ras(2)], [3, ras(3)]],
  }),

  // --- Hard ---------------------------------------------------------------------
  full({
    id: 'pogo-point', name: 'Pogo Point', tags: 'rock pop | legs arms | jump point', beats: 4, level: 'high', d: 2, parts: ['jump', 'arms'], jump: true, impact: true,
    desc: 'The new wave pogo: jump straight up and down, body stiff and the feet together, one finger pointing up at the ceiling and the other arm straight down; every second jump swap the pointing hand, both fists passing the chest in the air.',
    keys: [[0, ppLand(1)], [0.5, ppAir(1)], [1, ppLand(1)], [1.5, ppSwap], [2, ppLand(-1)], [2.5, ppAir(-1)], [3, ppLand(-1)], [3.5, ppSwap]],
  }),
  full({
    id: 'flail-stomp', name: 'Flail Stomp', tags: 'rock pop | full | stomp', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], impact: true,
    desc: 'The post-punk stomp: hunched, stamp from foot to foot on every beat, the straight arms scissoring crossed in front of the body on the stamp and flung open wide on the "and", the head shaking.',
    keys: [[0, fsCross(1)], [0.5, fsOpen(1)], [1, fsCross(-1)], [1.5, fsOpen(-1)]],
  }),
];
