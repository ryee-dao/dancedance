/**
 * Retro: solo versions of swing-era, 50s / 60s, ballroom, country and folk
 * steps as individual moves (solo jazz and lindy, jive and rockabilly,
 * twist-era extras, ballroom basics with frame arms, country line-dance
 * steps, folk circle-dance steps, tap steps). Tagged with the closest
 * existing families plus the `swing`, `country` and `folk` themes.
 *
 * Every move is a single step; the generator does all sequencing (no set
 * routine is reproduced). Kicks stay at hip height or lower; hops are low.
 */

import { ARM, at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

// ---------------------------------------------------------------------------
// Shared arm shapes (written for the user's right side; mir() for the left).

/** Thumbs hooked in the front of the belt (country). */
const BELT_R = at(1, 0.11, 0.54, 0.11, [1, -0.2, -0.3]);
const BELT_L = at(-1, -0.11, 0.54, 0.11, [1, -0.2, -0.3]);
const BELT: PoseSpec = { r: BELT_R, l: BELT_L, handR: 0.2, handL: 0.2 };
const HIPS: PoseSpec = { r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 };
/** Arms straight down at the sides, hands fisted (Irish step dance). */
const IRISH: PoseSpec = { r: [4, 0, 6, 0], l: [4, 0, 6, 0], handR: 0, handL: 0 };
/** Ballroom frame: left hand raised to the side at eye level, right arm curved around a partner. */
const FRAME: PoseSpec = {
  l: [82, 20, 150, 40],
  r: [76, 40, 84, 128],
  handR: 1, handL: 0.6,
};
/** Arms folded high in front of the chest (Russian / Cossack). */
const FOLDED: PoseSpec = {
  r: at(1, -0.13, 0.74, 0.18, [1, 0, -0.2]),
  l: at(-1, 0.13, 0.7, 0.14, [1, 0, -0.2]),
  handR: 0, handL: 0,
};

// ---------------------------------------------------------------------------
// Swing / solo jazz

const gazeOut: PoseSpec = {
  x: 0.06, y: -0.04, hips: 0.05, tilt: 6, lean: -4, turn: 32, head: 3,
  rf: [0.22, 0, 0.02], lf: [-0.08, 0, 0], kneeL: -0.15,
  r: at(1, 0.05, 0.99, 0.12, [1, 0.4, -0.1]), l: [38, -20, 46, -20], handR: 1, handL: 1,
};


/** Tacky Annie: touch one toe back (knee bent, hip sitting into the standing side), or replace it. */
const annie = (back: boolean, side: 1 | -1): PoseSpec => {
  const s: PoseSpec = back
    ? {
      y: -0.1, bend: 10, nod: 4, hips: -0.05, tilt: -6, lean: -3,
      rf: [0.11, 0.03, -0.14], pitchR: 35, lf: [-0.09, 0, 0], kneeR: -0.25,
      r: at(1, 0.2, 0.5, 0.2, [1, -0.3, -0.3]), l: at(-1, -0.12, 0.56, 0.24, [1, -0.3, -0.3]), handR: 0.5, handL: 0.5,
    }
    : {
      y: -0.06, bend: 7, nod: 2, hips: 0, tilt: 0,
      rf: [0.09, 0, 0], pitchR: 0, lf: [-0.09, 0, 0], kneeR: 0,
      r: at(1, 0.16, 0.54, 0.16, [1, -0.3, -0.3]), l: at(-1, -0.16, 0.54, 0.16, [1, -0.3, -0.3]), handR: 0.5, handL: 0.5,
    };
  return side > 0 ? s : mir(s);
};

const boogieBack: PoseSpec = {
  y: -0.09, hips: 0.06, tilt: 8, bend: 12, nod: 4, shR: 0.6, shL: 0.6,
  rf: [0.12, 0, -0.13], lf: [-0.09, 0, 0.02], kneeR: 0.15, kneeL: 0.1,
  r: at(1, 0.17, 0.62, 0.26, [1, -0.3, -0.2]), l: at(-1, -0.17, 0.62, 0.26, [1, -0.3, -0.2]), handR: 1, handL: 1,
};
const boogieBackUp: PoseSpec = {
  y: -0.05, hips: 0.02, tilt: 2, bend: 6, nod: 0, shR: 0.1, shL: 0.1,
  rf: [0.12, 0, -0.13], lf: [-0.09, 0, 0.02], kneeR: 0.05, kneeL: 0.05,
  r: at(1, 0.2, 0.7, 0.16, [1, -0.3, -0.2]), l: at(-1, -0.2, 0.7, 0.16, [1, -0.3, -0.2]), handR: 1, handL: 1,
};

/** Boogie Forward: point the foot across in front (point) or sweep it forward and out, hip pushed to that side (step). */
const boogieFwd = (side: 1 | -1, step: boolean): PoseSpec => {
  const s: PoseSpec = step
    ? {
      y: -0.1, bend: 10, nod: 3, lean: 4, x: 0.03,
      hips: 0.07, tilt: 10,
      rf: [0.15, 0, 0.1], lf: [-0.09, 0, -0.02], kneeR: 0.2,
      r: at(1, 0.24, 0.6, 0.12, [1, -0.3, -0.3]), l: at(-1, -0.14, 0.62, 0.2, [1, -0.3, -0.3]), handR: 1, handL: 1,
    }
    : {
      y: -0.08, bend: 8, nod: 4, lean: -2, x: -0.01,
      hips: -0.03, tilt: -4,
      rf: [-0.05, 0, 0.1], pitchR: 30, lf: [-0.09, 0, 0], kneeR: -0.2,
      r: at(1, 0.14, 0.6, 0.2, [1, -0.3, -0.3]), l: at(-1, -0.22, 0.6, 0.12, [1, -0.3, -0.3]), handR: 1, handL: 1,
    };
  return side > 0 ? s : mir(s);
};

/** Fall Off the Log arms: a finger snap out to the sides on the kick, loose otherwise. */
const logSnap: PoseSpec = { r: at(1, 0.27, 0.74, 0.12, [1, -0.3, -0.2]), l: at(-1, -0.27, 0.74, 0.12, [1, -0.3, -0.2]), handR: 0, handL: 0 };
const logLoose: PoseSpec = { r: [26, 10, 40, 30], l: [26, 10, 40, 30], handR: 1, handL: 1 };



/** Mess Around: both hands on the hips, the body does the work (the phase is unused since the 2026-11 fix). */
const messAt = (_ph: number): PoseSpec => ({ r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 });

/** Stomp Off: stomp the right foot slightly forward, right arm lifting... */
const stompOut: PoseSpec = {
  y: -0.1, bend: 6, nod: 6, x: 0.02, hips: 0.03, tilt: 4,
  rf: [0.1, 0, 0.1], lf: [-0.09, 0, 0],
  r: at(1, 0.24, 1.04, 0.12, [1, 0.2, -0.2]), l: [26, 10, 36, 30], handR: 1, handL: 1,
};
/** ...then draw it back and close it to the left foot, taking the weight, ready to stomp the left. */
const stompKick: PoseSpec = {
  y: -0.04, bend: 2, x: 0.01, hips: 0.02,
  rf: [0.06, 0, 0], lf: [-0.07, 0.03, 0.02],
  r: [40, 10, 50, 30], l: [30, 10, 40, 30], handR: 1, handL: 1,
};


// ---------------------------------------------------------------------------
// Swing / rockabilly / 50s-60s

/**
 * Shim Sham pushes: a lunge turned toward screen right (right foot forward), the
 * hips pushing forward (push) or easing back (release), arms swinging loose.
 */
const pushLunge = (push: boolean): PoseSpec => ({
  spin: 35, x: 0.02, y: push ? -0.1 : -0.07,
  bend: push ? -9 : 6, hips: push ? 0.05 : 0.01, tilt: push ? 6 : 0, nod: push ? -3 : 2,
  rf: [0.12, 0, 0.12], lf: [-0.11, 0, -0.06], kneeR: 0.15,
  r: push ? [40, -20, 46, -10] : [22, 10, 30, 30], l: push ? [40, -20, 46, -10] : [22, 10, 30, 30], handR: 1, handL: 1,
});

/**
 * Apple Jacks (weight on the user's LEFT foot for side 1): the free right knee bends
 * and points across in front of the standing leg, the left arm pushes forward and
 * the right arm swings out to the side; side -1 is the mirror.
 */
const appleJack = (side: 1 | -1): PoseSpec => {
  const s: PoseSpec = {
    y: -0.09, lean: -4, head: -4, hips: -0.05, tilt: -6, twist: -6,
    lf: [-0.09, 0, 0], rf: [0.05, 0.03, 0.04], pitchR: 30, kneeR: -0.55, kneeL: 0.1,
    l: at(-1, -0.06, 0.78, 0.3, [1, -0.3, -0.2]), r: [84, -5, 92, -5], handR: 1, handL: 1,
  };
  return side > 0 ? s : mir(s);
};
const appleMid: PoseSpec = {
  y: -0.05, rf: [0.08, 0, 0.02], lf: [-0.08, 0, 0.02],
  r: [40, 5, 50, 20], l: [40, 5, 50, 20], handR: 1, handL: 1,
};

const jigKick = (side: 1 | -1): PoseSpec => {
  const s: PoseSpec = {
    y: -0.02, twist: -10, hips: -0.02, rf: [-0.02, 0.12, 0.2], lf: [-0.09, 0, 0],
    r: ARM.swingBack, l: ARM.swingFwd, handR: 1, handL: 1,
  };
  return side > 0 ? s : mir(s);
};
const jigStep = (side: 1 | -1): PoseSpec => {
  const s: PoseSpec = {
    y: -0.07, twist: -5, hips: -0.03, rf: [-0.04, 0, 0.07], lf: [-0.1, 0, -0.02], kneeR: -0.1,
    r: [20, -10, 30, -10], l: [26, 30, 40, 40], handR: 1, handL: 1,
  };
  return side > 0 ? s : mir(s);
};

/** Chicken Walk (jive): knees kept bent, one foot slides forward on its toe, hips and shoulders turn to that side. */
const chicken = (side: 1 | -1): PoseSpec => ({
  y: -0.07, bend: 4, twist: 14 * side, hipTwist: 10 * side, hips: 0.045 * side, tilt: 5 * side, shR: side > 0 ? 0.5 : 0, shL: side < 0 ? 0.5 : 0,
  rf: side > 0 ? [0.07, 0, 0.1] : [0.06, 0, -0.02], lf: side < 0 ? [-0.07, 0, 0.1] : [-0.06, 0, -0.02],
  pitchR: side > 0 ? 18 : 0, pitchL: side < 0 ? 18 : 0,
  slideR: true, slideL: true, kneeR: -0.2, kneeL: -0.2,
  r: [22, 20, 52, 60], l: [22, 20, 52, 60], handR: 0.5, handL: 0.5,
});

const strollSnap: PoseSpec = { l: at(-1, -0.27, 0.96, 0.06, [1, -0.2, -0.2]), r: [20, -10, 30, 0], handL: 0, handR: 1 };

const kickHi: PoseSpec = { r: [128, 10, 146, 10], l: [62, 0, 70, 0], handR: 1, handL: 1 };

const loco = (k: number): PoseSpec => {
  const ph = (k * Math.PI) / 2;
  return {
    y: k % 2 === 0 ? -0.08 : -0.05, bend: 9, nod: 3,
    rf: [0.08, k === 1 ? 0.05 : 0, k === 1 ? 0.04 : 0], lf: [-0.08, k === 3 ? 0.05 : 0, k === 3 ? 0.04 : 0],
    r: at(1, 0.23, 0.6 + 0.11 * Math.sin(ph), 0.12 + 0.1 * Math.cos(ph), [0.3, -1, -0.3]),
    l: at(-1, -0.23, 0.6 - 0.11 * Math.sin(ph), 0.12 - 0.1 * Math.cos(ph), [0.3, -1, -0.3]),
    handR: 0, handL: 0,
  };
};


// ---------------------------------------------------------------------------
// Ballroom (solo, frame arms) and country

const TANGO: PoseSpec = {
  l: [74, 35, 128, 65],
  r: [68, 50, 76, 140],
  handR: 1, handL: 0.4,
};

/** Hooked elbow out for an elbow swing. */
const HOOK_R = at(1, 0.24, 0.92, 0.2, [1, 0, 0]);

const T0: PoseSpec = { rf: [0.055, 0, 0], lf: [-0.055, 0, 0] };


// ---------------------------------------------------------------------------
// Folk

/** Hands joined with neighbours, raised in a W at head height (hora). */
const HORA: PoseSpec = { r: at(1, 0.33, 0.96, 0.08, [1, -0.6, -0.2]), l: at(-1, -0.33, 0.96, 0.08, [1, -0.6, -0.2]), handR: 1, handL: 1 };
/** Arms straight out on the neighbours' shoulders (sirtaki). */
const ZORBA: PoseSpec = { r: [86, 12, 88, 12], l: [86, 12, 88, 12], handR: 1, handL: 1 };
/** Arms down holding neighbours' hands (dabke). */
const LINKED: PoseSpec = { r: [24, 0, 26, 0], l: [24, 0, 26, 0], handR: 0, handL: 0 };
const FLING: PoseSpec = { r: ARM.hip, l: at(-1, -0.08, 1.18, 0.05, [1, 0.2, -0.2]), handR: 0, handL: 1 };
const tamb = (dx: number): PoseSpec => ({ r: at(1, 0.24 + dx * 0.6, 1.08, 0.08, [1, 0.2, -0.2]), l: ARM.hip, handR: 1, handL: 0 });
const skirt = (up: boolean): PoseSpec => (up
  ? { r: at(1, 0.33, 0.66, 0.06, [1, -0.3, -0.2]), l: at(-1, -0.33, 0.66, 0.06, [1, -0.3, -0.2]), handR: 0, handL: 0 }
  : { r: at(1, 0.27, 0.46, 0.08, [1, -0.3, -0.3]), l: at(-1, -0.27, 0.46, 0.08, [1, -0.3, -0.3]), handR: 0, handL: 0 });
const HANKY_LO: PoseSpec = { r: at(1, 0.2, 0.64, 0.2, [1, -0.3, -0.3]), l: at(-1, -0.2, 0.64, 0.2, [1, -0.3, -0.3]), handR: 1, handL: 1 };
const HANKY_HI: PoseSpec = { r: [138, 20, 150, 20], l: [138, 20, 150, 20], handR: 1, handL: 1 };
const BEHIND: PoseSpec = { r: ARM.hip, l: ARM.hip, handR: 0, handL: 0 };
const THIGHS: PoseSpec = { r: at(1, 0.13, 0.44, 0.12, [1, -0.3, -0.3]), l: at(-1, -0.13, 0.44, 0.12, [1, -0.3, -0.3]), handR: 1, handL: 1 };


// ---------------------------------------------------------------------------
// Tap

/** Vaudeville arms: out low to the sides, palms open. */
const VAUDE: PoseSpec = { r: [62, 12, 70, 20], l: [62, 12, 70, 20], handR: 1, handL: 1 };
const VAUDE_HI: PoseSpec = { r: [96, 15, 110, 20], l: [96, 15, 110, 20], handR: 1, handL: 1 };
const TAP_ARMS = (k: 1 | -1): PoseSpec => ({ r: k > 0 ? [34, 20, 60, 50] : [22, 10, 34, 30], l: k < 0 ? [34, 20, 60, 50] : [22, 10, 34, 30], handR: 1, handL: 1 });


/** Waltz turn: rise and fall while rotating a quarter per beat in the frame. */
const waltzTurn = (spin: number, down: boolean): PoseSpec => ({
  spin, y: down ? -0.08 : -0.01, lean: down ? -3 : -1, turn: -20,
  rf: down ? [0.08, 0, 0.05] : [0.055, 0, 0], lf: down ? [-0.08, 0, -0.02] : [-0.055, 0, 0], ...FRAME,
});


/** Highland arms in fifth: both arms curved overhead. */
const HIGH5: PoseSpec = { r: at(1, 0.08, 1.12, 0.03, [1, 0.3, -0.1]), l: at(-1, -0.08, 1.12, 0.03, [1, 0.3, -0.1]), handR: 1, handL: 1 };
const lineSwing = (side: 1 | -1): PoseSpec => (side > 0
  ? { r: [70, 20, 76, 25], l: at(-1, 0.06, 0.66, 0.24, [1, -0.6, -0.2]), handR: 1, handL: 1 }
  : { r: at(1, -0.06, 0.66, 0.24, [1, -0.6, -0.2]), l: [70, 20, 76, 25], handR: 1, handL: 1 });

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  // --- Swing / solo jazz -------------------------------------------------
  full({
    id: 'gaze-afar', name: 'Gaze Afar', tags: 'pop party | arms | swing point', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Jazz step: step out and shade your eyes with that hand, looking off into the distance, then step back together.',
    keys: [
      [0, gazeOut],
      [1, { ...gazeOut, y: -0.06, turn: 36 }],
      [2, { y: -0.03, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [16, 15, 34, 60], l: [16, 15, 34, 60], handR: 1, handL: 1 }],
      [3, { y: -0.05, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [12, 10, 26, 50], l: [12, 10, 26, 50], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'tacky-annie', name: 'Tacky Annie', tags: 'pop party | legs | swing', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Hunched a little with soft knees, touch the right toe back behind you and replace it, then touch the left toe back and replace it, loose hands swinging low.',
    keys: [[0, annie(true, 1)], [1, annie(false, 1)], [2, annie(true, -1)], [3, annie(false, -1)]],
  }),
  full({
    id: 'boogie-back', name: 'Boogie Back', tags: 'pop funk | hips legs | swing hips', beats: 2, level: 'mid', d: 2, parts: ['hips', 'legs', 'arms'], mirror: true,
    desc: 'Kick one foot forward with a clap, step it back with the hips pushed back and out, shoulders hunched, then close the other foot to it.',
    keys: [
      [0, { y: -0.03, bend: -3, rf: [0.11, 0.13, 0.2], lf: [-0.09, 0, 0], r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [0.5, boogieBack],
      [1, { ...boogieBackUp, lf: [-0.11, 0, -0.11] }],
    ],
  }),
  full({
    id: 'boogie-forward', name: 'Boogie Forward', tags: 'pop funk | hips | swing hips walk', beats: 4, level: 'mid', d: 2, parts: ['hips', 'legs'],
    desc: 'Point one foot across in front of the other, then sweep it forward and out in a slow step, pushing that hip out to the side; then the other foot.',
    keys: [[0, boogieFwd(1, false)], [1, boogieFwd(1, true)], [2, boogieFwd(-1, false)], [3, boogieFwd(-1, true)]],
  }),
  full({
    id: 'fall-off-the-log', name: 'Fall Off the Log', tags: 'pop party | legs full | swing', beats: 4, level: 'mid', d: 3, parts: ['legs', 'torso', 'arms'], mirror: true, travel: 0.26,
    desc: 'Kick one foot out to its side with a finger snap, leaning away as if about to fall, then step it behind the other foot, step to the side and cross it over in front, travelling the other way.',
    keys: [
      [0, { x: 0, y: -0.04, lean: 10, head: 6, hips: 0.03, rf: [0.04, 0, 0], lf: [-0.23, 0.12, 0.02], ...logSnap }],
      [1, { x: 0.04, y: -0.08, lean: 0, rf: [0.04, 0, 0], lf: [0.08, 0, -0.07], kneeL: 0.1, ...logLoose }],
      [2, { x: 0.1, y: -0.05, lean: -2, hips: 0.02, rf: [0.18, 0, 0], lf: [0.08, 0, -0.07], ...logLoose }],
      [3, { x: 0.17, y: -0.08, lean: -4, rf: [0.18, 0, 0], lf: [0.22, 0, 0.07], kneeL: -0.1, ...logLoose }],
    ],
  }),
  full({
    id: 'mess-around', name: 'Mess Around', tags: 'pop latin | hips | swing hips', beats: 4, level: 'low', d: 2, parts: ['hips', 'arms'], mirror: true,
    desc: 'Black Bottom era: hands on the hips, feet loose in one place, and let the body roll round in a slow, sitting circle.',
    keys: [
      [0, { y: -0.05, hips: 0.07, tilt: 9, lean: -3, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...messAt(0) }],
      [1, { y: -0.11, hips: 0, bend: -4, kneeR: 0.2, kneeL: 0.2, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...messAt(Math.PI / 2) }],
      [2, { y: -0.05, hips: -0.07, tilt: -9, lean: 3, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...messAt(Math.PI) }],
      [3, { y: -0.03, hips: 0, bend: 5, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...messAt(1.5 * Math.PI) }],
    ],
  }),
  full({
    id: 'stomp-off', name: 'Stomp Off', tags: 'pop rock | legs | swing stomp', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true, impact: true,
    desc: 'Close one foot to the other, then stomp the free foot down slightly forward, lifting the same-side arm.',
    keys: [[0, stompOut], [1, stompKick]],
  }),
  // --- Swing / rockabilly / 50s-60s -------------------------------------
  full({
    id: 'crossover-push', name: 'Push & Crossover', tags: 'pop party | hips legs | swing hips', beats: 4, level: 'mid', d: 2, parts: ['hips', 'legs'], mirror: true,
    desc: 'In a lunge turned about 45 degrees to one side, push the hips forward three times, then bring the back foot forward across the front one and take the lunge facing the other diagonal.',
    keys: [
      [0, pushLunge(true)],
      [0.5, pushLunge(false)],
      [1, pushLunge(true)],
      [1.5, pushLunge(false)],
      [2, pushLunge(true)],
      [2.5, pushLunge(false)],
      [3, { spin: 0, y: -0.06, x: 0.01, rf: [0.1, 0, 0.06], lf: [-0.02, 0, 0.1], kneeL: -0.15, r: [24, 10, 34, 30], l: [24, 10, 34, 30], handR: 1, handL: 1 }],
      [3.5, { spin: -20, y: -0.08, x: 0, rf: [0.11, 0, -0.04], lf: [-0.12, 0, 0.12], kneeL: 0.15, r: [24, 10, 34, 30], l: [24, 10, 34, 30], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'apple-jacks', name: 'Apple Jacks', tags: 'pop party | legs | swing', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso'],
    desc: 'Shift onto one foot as the other knee bends and points across in front of the standing leg, the opposite arm pushing forward and the near arm swinging out to the side; then change feet.',
    keys: [[0, appleJack(1)], [0.5, appleMid], [1, appleJack(-1)], [1.5, appleMid]],
  }),
  full({
    id: 'jig-walk', name: 'Jig Walk', tags: 'pop party | legs | swing walk kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Kick one foot low across the other and step it down crossed, then the other foot, loose arms swinging opposite.',
    keys: [[0, jigKick(1)], [0.5, jigStep(1)], [1, jigKick(-1)], [1.5, jigStep(-1)]],
  }),
  full({
    id: 'chicken-walk', name: 'Chicken Walk', tags: 'pop rock | hips legs | swing walk hips', beats: 2, level: 'mid', d: 2, parts: ['hips', 'legs'],
    desc: 'Jive / swing chicken walk: knees kept bent, slide one foot forward with the toe on the floor and shift onto it, hips and shoulders turning to that side, then the other.',
    keys: [[0, chicken(1)], [0.5, { ...chicken(1), hips: 0, tilt: 0, y: -0.05, rf: [0.06, 0, -0.03], lf: [-0.06, 0, -0.03] }], [1, chicken(-1)], [1.5, { ...chicken(-1), hips: 0, tilt: 0, y: -0.05, rf: [0.06, 0, -0.03], lf: [-0.06, 0, -0.03] }]],
  }),
  full({
    id: 'the-stroll', name: 'The Stroll', tags: 'pop rock | legs hips | swing walk', beats: 4, level: 'low', d: 2, parts: ['legs', 'hips'], mirror: true, travel: 0.14,
    desc: 'Cool and slouchy: point the foot out on the diagonal with a finger snap up by the shoulder, cross it behind, step out and close with a low clap.',
    keys: [
      [0, { x: 0.01, y: -0.03, hips: 0.05, tilt: 6, lean: 3, head: -6, rf: [0.09, 0, 0], lf: [-0.21, 0, 0.1], kneeL: 0.2, ...strollSnap }],
      [1, { x: 0.04, y: -0.08, hips: -0.02, lean: -2, rf: [0.09, 0, 0], lf: [0.15, 0, -0.07], kneeR: 0.15, r: at(1, 0.2, 0.55, 0.1, [1, -0.3, -0.3]), l: at(-1, -0.2, 0.55, 0.1, [1, -0.3, -0.3]), handR: 0, handL: 0 }],
      [2, { x: 0.1, y: -0.04, hips: 0.04, tilt: 4, rf: [0.28, 0, 0], lf: [0.15, 0, -0.07], r: [30, 10, 40, 20], l: [30, 10, 40, 20], handR: 1, handL: 1 }],
      [3, { x: 0.14, y: -0.06, hips: 0, rf: [0.28, 0, 0], lf: [0.1, 0, 0], r: at(1, 0.03, 0.6, 0.2, [0.5, -1, -0.2]), l: at(-1, -0.03, 0.6, 0.2, [0.5, -1, -0.2]), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'hitch-kick', name: 'Hitch Kick', tags: 'rock pop | legs | swing kick jump', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true,
    desc: 'Jazz hitch kick: flick one leg up, then hop and pass the other leg through in a small scissor kick, one arm reaching up.',
    keys: [
      [0, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0.14, 0.1], ...kickHi }],
      [0.5, { y: 0.06, bend: -4, lean: -3, rf: [0.09, 0.2, 0.28], lf: [-0.09, 0.08, 0.06], ...kickHi, r: [150, 8, 160, 8] }],
      [1, { y: -0.07, rf: [0.1, 0, 0.08], lf: [-0.09, 0.06, -0.06], r: [100, 10, 110, 10], l: [50, 0, 60, 0], handR: 1, handL: 1 }],
      [1.5, { y: -0.03, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [60, 5, 66, 5], l: [50, 0, 60, 0], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'locomotion', name: 'Locomotion', tags: 'pop party | arms legs | swing walk', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Chug on the spot with small shuffling steps, leaning a little forward, fists driving round like train wheels at the sides.',
    keys: [[0, loco(0)], [0.5, loco(1)], [1, loco(2)], [1.5, loco(3)]],
  }),
  full({
    id: 'polka-step', name: 'Polka Step', tags: 'party pop | legs | folk jump', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump'], mirror: true, travel: 0.18, jump: true,
    desc: 'Hands on hips, step to the side, close, step again and hop on that foot, then polka back the other way.',
    keys: [
      [0, { x: 0.05, y: -0.05, hips: 0.03, lean: -3, rf: [0.18, 0, 0], lf: [-0.09, 0, 0], ...HIPS }],
      [0.5, { x: 0.09, y: -0.03, rf: [0.18, 0, 0], lf: [0.06, 0, 0], ...HIPS }],
      [1, { x: 0.14, y: -0.05, hips: 0.03, rf: [0.27, 0, 0], lf: [0.06, 0, 0], ...HIPS }],
      [1.5, { x: 0.16, y: 0.05, lean: 5, head: 4, rf: [0.26, 0.02, 0], lf: [0.1, 0.12, 0.06], ...HIPS }],
    ],
  }),
  // --- Ballroom, solo with frame arms -----------------------------------
  full({
    id: 'waltz-balance', name: 'Waltz Balance', tags: 'pop latin | legs | walk', beats: 2, level: 'low', d: 1, parts: ['legs'], mirror: true,
    desc: 'Arms held in a ballroom frame, step to the side with a soft knee, close and rise onto the toes, then lower; the head looks away over the raised hand.',
    keys: [
      [0, { x: 0.04, y: -0.08, hips: 0.02, lean: -3, turn: -22, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], ...FRAME }],
      [0.5, { x: 0.07, y: -0.005, lean: -2, turn: -24, rf: [0.2, 0, 0], lf: [0.07, 0, 0], ...FRAME }],
      [1, { x: 0.07, y: -0.04, lean: -1, turn: -20, rf: [0.2, 0, 0], lf: [0.07, 0, 0], ...FRAME }],
      [1.5, { x: 0.04, y: -0.02, turn: -18, rf: [0.18, 0, 0], lf: [-0.04, 0, 0], ...FRAME }],
    ],
  }),
  full({
    id: 'tango-walk', name: 'Tango Walk', tags: 'latin pop | legs | walk', beats: 4, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true,
    desc: 'Low, stalking walks in a compact tango frame: slow step, slow step, then close the feet sharply and snap the head round to the other side.',
    keys: [
      [0, { y: -0.1, bend: -3, twist: 6, turn: -28, hips: 0.02, rf: [0.08, 0, 0.12], lf: [-0.09, 0, -0.02], kneeL: 0.1, ...TANGO }],
      [1, { y: -0.11, bend: -3, twist: 6, turn: -28, hips: -0.02, rf: [0.08, 0, 0.12], lf: [-0.07, 0, 0.14], ...TANGO }],
      [2, { y: -0.1, bend: -3, twist: 4, turn: -26, rf: [0.09, 0, 0.0], lf: [-0.07, 0, 0.14], ...TANGO }],
      [2.5, { y: -0.12, bend: -4, twist: 4, turn: -26, rf: [0.08, 0, 0.0], lf: [-0.07, 0, 0.0], ...TANGO }],
      [3, { y: -0.12, bend: -5, twist: -6, turn: 30, nod: -3, rf: [0.08, 0, 0.0], lf: [-0.07, 0, 0.0], ...TANGO }],
    ],
  }),
  full({
    id: 'quickstep-kick', name: 'Quickstep Chassé & Kick', tags: 'pop party | legs | swing kick walk', beats: 2, level: 'high', d: 3, parts: ['legs'], mirror: true, travel: 0.16,
    desc: 'Light and bouncy in a ballroom frame: chassé to the side (step, close, step) and flick the free foot forward in a low kick.',
    keys: [
      [0, { x: 0.05, y: -0.06, lean: -3, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], ...FRAME }],
      [0.5, { x: 0.09, y: -0.02, rf: [0.2, 0, 0], lf: [0.07, 0, 0], ...FRAME }],
      [1, { x: 0.14, y: -0.06, lean: 3, rf: [0.25, 0, 0], lf: [0.07, 0, 0], ...FRAME }],
      [1.5, { x: 0.16, y: -0.02, lean: 4, bend: -4, rf: [0.25, 0, 0], lf: [0.1, 0.17, 0.26], ...FRAME }],
    ],
  }),

  // --- Country & western -------------------------------------------------
  full({
    id: 'heel-strut', name: 'Heel Strut', tags: 'rock pop | legs hips | country walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'],
    desc: 'Thumbs in the belt, step the heel forward with the toes up, then drop the toes to the floor and sit into that hip; then the other foot.',
    keys: [
      [0, { y: -0.03, bend: -4, lean: -2, hips: -0.02, rf: [0.1, 0.03, 0.16], pitchR: -30, lf: [-0.09, 0, 0], kneeR: 0.15, ...BELT }],
      [0.5, { y: -0.06, bend: -2, lean: 4, hips: 0.06, tilt: 8, rf: [0.1, 0, 0.12], lf: [-0.09, 0, 0], ...BELT }],
      [1, { y: -0.03, bend: -4, lean: 2, hips: 0.02, rf: [0.09, 0, 0], lf: [-0.1, 0.03, 0.16], pitchL: -30, kneeL: 0.15, ...BELT }],
      [1.5, { y: -0.06, bend: -2, lean: -4, hips: -0.06, tilt: -8, rf: [0.09, 0, 0], lf: [-0.1, 0, 0.12], ...BELT }],
    ],
  }),
  full({
    id: 'boot-scoot', name: 'Boot Scoot', tags: 'rock pop | legs | country', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'Thumbs in the belt, lift one knee and scoot the standing foot forward along the floor twice, then step down and close.',
    keys: [
      [0, { y: -0.04, bend: -3, rf: [0.09, 0.2, 0.12], lf: [-0.09, 0, 0], kneeR: 0.2, ...BELT }],
      [0.5, { y: -0.06, bend: -3, rf: [0.09, 0.2, 0.17], lf: [-0.09, 0, 0.06], slideL: true, kneeR: 0.2, ...BELT }],
      [1, { y: -0.04, bend: -3, rf: [0.09, 0.2, 0.2], lf: [-0.09, 0, 0.11], slideL: true, kneeR: 0.2, ...BELT }],
      [1.5, { y: -0.06, rf: [0.09, 0, 0.0], lf: [-0.09, 0, 0.0], ...BELT }],
    ],
  }),
  full({
    id: 'cowboy-kick', name: 'Cowboy Kick', tags: 'rock party | legs | country kick', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'Lean back a touch with thumbs in the belt, kick one boot out low on the diagonal, hitch it back to the knee, then step it down.',
    keys: [
      [0, { y: -0.03, bend: -6, lean: -4, nod: -3, rf: [0.2, 0.17, 0.26], kneeR: 0.2, lf: [-0.09, 0, 0], ...BELT }],
      [0.5, { y: -0.04, bend: -2, rf: [0.1, 0.2, 0.08], lf: [-0.09, 0, 0], kneeR: 0.1, ...BELT }],
      [1, { y: -0.07, rf: [0.11, 0, 0.02], lf: [-0.09, 0, 0], ...BELT }],
      [1.5, { y: -0.04, rf: [0.11, 0, 0.02], lf: [-0.09, 0, 0], ...BELT }],
    ],
  }),
  full({
    id: 'scuff-hitch', name: 'Scuff Hitch Stomp', tags: 'rock pop | legs | country stomp', beats: 2, level: 'mid', d: 2, parts: ['legs'], mirror: true, impact: true,
    desc: 'Scuff the heel forward along the floor, swing it up into a knee hitch turned out to the side, then stomp it down beside the other foot.',
    keys: [
      [0, { y: -0.04, rf: [0.1, 0.0, 0.14], slideR: true, lf: [-0.09, 0, 0], ...HIPS }],
      [0.5, { y: -0.02, lean: -3, rf: [0.15, 0.24, 0.06], kneeR: 0.45, lf: [-0.09, 0, 0], ...HIPS }],
      [1, { y: -0.09, bend: 5, nod: 5, rf: [0.12, 0, 0], lf: [-0.09, 0, 0], ...HIPS }],
      [1.5, { y: -0.04, rf: [0.11, 0, 0], lf: [-0.09, 0, 0], ...HIPS }],
    ],
  }),
  full({
    id: 'sailor-step', name: 'Sailor Step', tags: 'pop rock | legs | country swing', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true,
    desc: 'Cross one foot behind the other, step the other foot out a little to its side, then step the first foot out to its side (1&2), body swaying with it; then the other side.',
    keys: [
      [0, { y: -0.07, x: -0.02, lean: -6, hips: -0.03, rf: [-0.04, 0, -0.07], lf: [-0.1, 0, 0], kneeR: 0.1, r: [34, 5, 44, 10], l: [22, 0, 30, 10], handR: 1, handL: 1 }],
      [0.5, { y: -0.04, x: -0.04, lean: -3, rf: [-0.04, 0, -0.07], lf: [-0.18, 0, 0], r: [28, 5, 36, 10], l: [28, 0, 36, 10], handR: 1, handL: 1 }],
      [1, { y: -0.07, x: 0.03, lean: 7, head: 5, hips: 0.03, rf: [0.17, 0, 0], lf: [-0.18, 0, 0], r: [52, 5, 60, 10], l: [26, 0, 34, 10], handR: 1, handL: 1 }],
      [1.5, { y: -0.04, x: 0.02, lean: 3, rf: [0.15, 0, 0], lf: [-0.12, 0, 0], r: [30, 5, 38, 10], l: [26, 0, 34, 10], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'monterey-turn', name: 'Monterey Turn', tags: 'pop rock | turn legs | country spin', beats: 4, level: 'mid', d: 3, parts: ['turn', 'legs'], mirror: true,
    desc: 'Touch the right toe out to the side, make a half turn right on the ball of the left foot bringing the right foot in beside it, then do it again to face the front.',
    keys: [
      [0, { y: -0.04, spin: 0, rf: [0.22, 0, 0.02], lf: [-0.07, 0, 0], kneeR: 0.2, pitchR: 20, ...HIPS }],
      [0.5, { ...T0, y: -0.02, spin: 80, pitchL: 18, ...HIPS }],
      [1, { ...T0, y: -0.05, spin: 180, ...HIPS }],
      [2, { y: -0.04, spin: 180, rf: [0.22, 0, 0.02], lf: [-0.07, 0, 0], kneeR: 0.2, pitchR: 20, ...HIPS }],
      [2.5, { ...T0, y: -0.02, spin: 260, pitchL: 18, ...HIPS }],
      [3, { ...T0, y: -0.05, spin: 0, ...HIPS }],
    ],
  }),
  full({
    id: 'clogging-basic', name: 'Clogging Basic', tags: 'rock party | legs | country stomp', beats: 2, level: 'high', d: 3, parts: ['legs'], mirror: true, impact: true,
    desc: 'Loose arms and bouncy knees: brush the toe forward and back (double toe), step down on it, then rock-step onto the other foot and back.',
    keys: [
      [0, { y: -0.05, rf: [0.09, 0.05, 0.09], lf: [-0.09, 0, 0], r: [18, 5, 26, 10], l: [18, 5, 26, 10], handR: 1, handL: 1 }],
      [0.25, { y: -0.04, rf: [0.09, 0.04, -0.03], lf: [-0.09, 0, 0], r: [18, 5, 26, 10], l: [18, 5, 26, 10], handR: 1, handL: 1 }],
      [0.5, { y: -0.08, hips: 0.03, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [24, 5, 30, 10], l: [14, 5, 20, 10], handR: 1, handL: 1 }],
      [1, { y: -0.06, hips: -0.03, rf: [0.09, 0.08, 0.02], lf: [-0.11, 0, -0.04], r: [14, 5, 20, 10], l: [24, 5, 30, 10], handR: 1, handL: 1 }],
      [1.5, { y: -0.08, hips: 0.03, rf: [0.09, 0, 0], lf: [-0.09, 0.06, 0.02], r: [24, 5, 30, 10], l: [14, 5, 20, 10], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'hoedown-slap', name: 'Knee Slap & Clap', tags: 'party rock | full | country clap', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Lift one knee and slap it with the same hand, clap, then lift and slap the other knee and clap.',
    keys: [
      [0, { y: -0.04, bend: 8, nod: 5, rf: [0.09, 0.24, 0.14], lf: [-0.09, 0, 0], r: at(1, 0.1, 0.5, 0.24, [1, -0.3, -0.3]), l: [30, 0, 40, 10], handR: 1, handL: 1 }],
      [0.5, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [1, { y: -0.04, bend: 8, nod: 5, rf: [0.09, 0, 0], lf: [-0.09, 0.24, 0.14], l: at(-1, -0.1, 0.5, 0.24, [1, -0.3, -0.3]), r: [30, 0, 40, 10], handR: 1, handL: 1 }],
      [1.5, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'swing-your-partner', name: 'Swing Your Partner', tags: 'party pop | turn | country folk spin', beats: 4, level: 'mid', d: 2, parts: ['turn', 'legs', 'arms'], mirror: true,
    desc: 'Hook one elbow out as if linked with a partner, other fist on the hip, and skip round in a full circle.',
    keys: [
      [0, { y: -0.05, spin: 0, lean: 4, rf: [0.07, 0, 0], lf: [-0.07, 0.06, 0.03], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
      [0.5, { y: -0.01, spin: 45, lean: 4, rf: [0.07, 0.06, 0.03], lf: [-0.07, 0, 0], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
      [1, { y: -0.05, spin: 90, lean: 4, rf: [0.07, 0, 0], lf: [-0.07, 0.06, 0.03], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
      [1.5, { y: -0.01, spin: 135, lean: 4, rf: [0.07, 0.06, 0.03], lf: [-0.07, 0, 0], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
      [2, { y: -0.05, spin: 180, lean: 4, rf: [0.07, 0, 0], lf: [-0.07, 0.06, 0.03], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
      [2.5, { y: -0.01, spin: 225, lean: 4, rf: [0.07, 0.06, 0.03], lf: [-0.07, 0, 0], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
      [3, { y: -0.05, spin: 270, lean: 4, rf: [0.07, 0, 0], lf: [-0.07, 0.06, 0.03], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
      [3.5, { y: -0.01, spin: 315, lean: 4, rf: [0.07, 0.06, 0.03], lf: [-0.07, 0, 0], r: HOOK_R, l: ARM.hip, handR: 0, handL: 0 }],
    ],
  }),
  full({
    id: 'do-si-do', name: 'Do-Si-Do', tags: 'party pop | legs | country folk walk', beats: 4, level: 'low', d: 1, parts: ['legs'],
    desc: 'Arms folded, walk a small loop as if passing a partner back to back: forward on the diagonal, slide across, back, and slide home.',
    keys: [
      [0, { x: 0.04, y: -0.05, rf: [0.13, 0, 0.12], lf: [-0.07, 0, 0.02], ...FOLDED, r: at(1, -0.12, 0.66, 0.17, [1, 0, -0.2]), l: at(-1, 0.12, 0.62, 0.13, [1, 0, -0.2]) }],
      [1, { x: -0.05, y: -0.04, rf: [0.03, 0, 0.1], lf: [-0.16, 0, 0.08], ...FOLDED, r: at(1, -0.12, 0.66, 0.17, [1, 0, -0.2]), l: at(-1, 0.12, 0.62, 0.13, [1, 0, -0.2]) }],
      [2, { x: -0.04, y: -0.05, rf: [0.07, 0, -0.1], lf: [-0.13, 0, -0.12], ...FOLDED, r: at(1, -0.12, 0.66, 0.17, [1, 0, -0.2]), l: at(-1, 0.12, 0.62, 0.13, [1, 0, -0.2]) }],
      [3, { x: 0.05, y: -0.04, rf: [0.16, 0, -0.08], lf: [-0.03, 0, -0.1], ...FOLDED, r: at(1, -0.12, 0.66, 0.17, [1, 0, -0.2]), l: at(-1, 0.12, 0.62, 0.13, [1, 0, -0.2]) }],
    ],
  }),
  // --- Folk & circle dances ----------------------------------------------
  full({
    id: 'hora-step', name: 'Hora Step', tags: 'party pop | full | folk jump kick', beats: 4, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.18, jump: true,
    desc: 'Arms raised in a W as if holding hands in the circle: step to the side, cross behind, step to the side, then hop and kick the free foot low across.',
    keys: [
      [0, { x: 0.05, y: -0.06, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], ...HORA }],
      [1, { x: 0.09, y: -0.07, rf: [0.2, 0, 0], lf: [0.12, 0, -0.07], kneeL: 0.1, ...HORA }],
      [2, { x: 0.15, y: -0.06, rf: [0.29, 0, 0], lf: [0.12, 0, -0.07], ...HORA }],
      [3, { x: 0.17, y: 0.04, lean: 4, rf: [0.27, 0.02, 0], lf: [0.2, 0.13, 0.15], ...HORA }],
      [3.5, { x: 0.18, y: -0.05, rf: [0.27, 0, 0], lf: [0.12, 0.04, 0.04], ...HORA }],
    ],
  }),
  full({
    id: 'sirtaki-step', name: 'Sirtaki Step', tags: 'party pop | legs | folk kick', beats: 4, level: 'mid', d: 2, parts: ['legs'], mirror: true,
    desc: 'Arms stretched out along the neighbours\' shoulders: dip on one leg with the other foot pointed, then rise and swing it forward in a slow low kick.',
    keys: [
      [0, { y: -0.11, bend: 2, rf: [0.1, 0.02, 0.13], lf: [-0.09, 0, 0], kneeL: 0.15, ...ZORBA }],
      [1, { y: -0.03, bend: -3, rf: [0.1, 0.17, 0.24], lf: [-0.09, 0, 0], ...ZORBA }],
      [2, { y: -0.11, bend: 2, rf: [0.09, 0, 0], lf: [-0.1, 0.02, 0.13], kneeR: 0.15, ...ZORBA }],
      [3, { y: -0.03, bend: -3, rf: [0.09, 0, 0], lf: [-0.1, 0.17, 0.24], ...ZORBA }],
    ],
  }),
  full({
    id: 'irish-threes', name: 'Irish Threes', tags: 'party pop | legs | folk jump', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true,
    desc: 'Arms held straight down at the sides: hop with the free foot flicked up behind, then three quick steps on the balls of the feet.',
    keys: [
      [0, { y: 0.05, rf: [0.08, 0.16, -0.09], lf: [-0.07, 0.02, 0], kneeR: 0.1, ...IRISH }],
      [0.5, { y: -0.01, rf: [0.06, 0, -0.01], lf: [-0.07, 0, 0], ...IRISH }],
      [0.75, { y: 0.0, rf: [0.06, 0, -0.01], lf: [-0.06, 0.04, 0], ...IRISH }],
      [1, { y: -0.02, rf: [0.06, 0.03, 0], lf: [-0.06, 0, 0], ...IRISH }],
      [1.5, { y: -0.05, rf: [0.07, 0, 0], lf: [-0.08, 0.06, -0.04], ...IRISH }],
    ],
  }),
  full({
    id: 'irish-cut-rock', name: 'Irish Cut & Rock', tags: 'party pop | legs | folk', beats: 2, level: 'mid', d: 3, parts: ['legs'], mirror: true,
    desc: 'Arms straight down, ankles crossed on the toes: rock side to side over the crossed feet, then cut the front foot up in front of the other shin.',
    keys: [
      [0, { y: -0.02, x: 0.03, hips: 0.03, lean: -3, rf: [-0.03, 0, 0.04], lf: [0.03, 0.03, -0.02], ...IRISH }],
      [0.5, { y: -0.03, x: -0.03, hips: -0.03, lean: 3, rf: [-0.03, 0.03, 0.04], lf: [0.03, 0, -0.02], ...IRISH }],
      [1, { y: -0.02, x: 0.03, hips: 0.03, lean: -3, rf: [-0.03, 0, 0.04], lf: [0.03, 0.03, -0.02], ...IRISH }],
      [1.5, { y: -0.02, x: -0.02, hips: -0.02, rf: [-0.04, 0.22, 0.09], lf: [0.0, 0, -0.02], kneeR: 0.2, ...IRISH }],
    ],
  }),
  full({
    id: 'highland-fling', name: 'Highland Fling', tags: 'party pop | legs | folk jump', beats: 4, level: 'high', d: 3, parts: ['legs', 'jump'], jump: true,
    desc: 'One arm curved up overhead, the other fist on the hip: small hops on one foot while the other foot points out to the side and tucks up behind the calf, then the other foot.',
    keys: [
      [0, { y: 0.03, rf: [0.21, 0.07, 0.02], lf: [-0.07, 0.02, 0], kneeR: 0.3, lean: -3, ...FLING }],
      [0.5, { y: -0.05, rf: [0.21, 0.07, 0.02], lf: [-0.07, 0, 0], kneeR: 0.3, ...FLING }],
      [1, { y: 0.03, rf: [0.0, 0.2, -0.06], lf: [-0.07, 0.02, 0], kneeR: 0.45, ...FLING }],
      [1.5, { y: -0.05, rf: [0.04, 0.06, 0.0], lf: [-0.07, 0, 0], kneeR: 0.2, ...FLING }],
      [2, { y: 0.03, lf: [-0.21, 0.07, 0.02], rf: [0.07, 0.02, 0], kneeL: 0.3, lean: 3, ...FLING }],
      [2.5, { y: -0.05, lf: [-0.21, 0.07, 0.02], rf: [0.07, 0, 0], kneeL: 0.3, ...FLING }],
      [3, { y: 0.03, lf: [0.0, 0.2, -0.06], rf: [0.07, 0.02, 0], kneeL: 0.45, ...FLING }],
      [3.5, { y: -0.05, lf: [-0.04, 0.06, 0.0], rf: [0.07, 0, 0], kneeL: 0.2, ...FLING }],
    ],
  }),
  full({
    id: 'kalinka-heel-toe', name: 'Kalinka Heel-Toe', tags: 'party pop | legs | folk', beats: 2, level: 'mid', d: 2, parts: ['legs'],
    desc: 'Arms folded high across the chest, bounce and dig one heel forward, tap the same toe back beside the other foot, then the other side.',
    keys: [
      [0, { y: -0.06, bend: -3, rf: [0.11, 0.03, 0.17], lf: [-0.09, 0, 0], ...FOLDED }],
      [0.5, { y: -0.03, rf: [0.08, 0.05, -0.05], lf: [-0.09, 0, 0], kneeR: -0.15, ...FOLDED }],
      [1, { y: -0.06, bend: -3, rf: [0.09, 0, 0], lf: [-0.11, 0.03, 0.17], ...FOLDED }],
      [1.5, { y: -0.03, rf: [0.09, 0, 0], lf: [-0.08, 0.05, -0.05], kneeL: -0.15, ...FOLDED }],
    ],
  }),
  full({
    id: 'schuhplattler', name: 'Schuhplattler Slaps', tags: 'party pop | full | folk clap', beats: 2, level: 'mid', d: 3, parts: ['legs', 'arms'], mirror: true,
    desc: 'Slap both thighs, clap, then lift one foot out to the side and slap the side of the shoe with the same hand, and step down.',
    keys: [
      [0, { y: -0.07, bend: 8, nod: 4, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], ...THIGHS }],
      [0.5, { y: -0.04, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [1, { y: -0.05, lean: 14, bend: 6, x: -0.02, rf: [0.2, 0.26, -0.02], kneeR: 0.5, lf: [-0.1, 0, 0], r: at(1, 0.24, 0.46, 0.04, [1, -0.2, -0.3]), l: [40, 0, 50, 10], handR: 1, handL: 1 }],
      [1.5, { y: -0.06, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: [26, 5, 34, 10], l: [26, 5, 34, 10], handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'tarantella-skip', name: 'Tarantella Skip', tags: 'party pop | legs arms | folk jump shake', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms', 'jump'], jump: true,
    desc: 'Skip lightly from foot to foot, the other knee coming up, one hand high shaking a tambourine and the other on the hip.',
    keys: [
      [0, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0.03, 0], lean: 3, ...tamb(0.03) }],
      [0.5, { y: 0.04, rf: [0.09, 0.02, 0], lf: [-0.09, 0.14, 0.09], lean: 3, ...tamb(-0.03) }],
      [1, { y: -0.06, rf: [0.09, 0.03, 0], lf: [-0.09, 0, 0], lean: -3, ...tamb(0.03) }],
      [1.5, { y: 0.04, rf: [0.09, 0.14, 0.09], lf: [-0.09, 0.02, 0], lean: -3, ...tamb(-0.03) }],
    ],
  }),
  full({
    id: 'can-can-kick', name: 'Can-Can Kick', tags: 'party pop | legs | folk kick', beats: 4, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Holding an imaginary skirt out at the sides, lift the knee high, kick the foot out low and swish the skirt up, then step down.',
    keys: [
      [0, { y: -0.04, lean: -3, rf: [0.1, 0.28, 0.14], lf: [-0.09, 0, 0], ...skirt(false) }],
      [1, { y: -0.02, bend: -6, lean: -4, rf: [0.11, 0.24, 0.34], lf: [-0.09, 0, 0], ...skirt(true) }],
      [2, { y: -0.07, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], ...skirt(false) }],
      [3, { y: -0.04, hips: 0.04, tilt: 5, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], ...skirt(true) }],
    ],
  }),
  full({
    id: 'morris-step', name: 'Morris Step', tags: 'party pop | full | folk wave jump', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms', 'jump'], jump: true,
    desc: 'Step-hop on alternate feet, the free leg swinging forward low, both hands flicking handkerchiefs up overhead on every hop.',
    keys: [
      [0, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0.04, 0.02], ...HANKY_LO }],
      [0.5, { y: 0.05, rf: [0.09, 0.02, 0], lf: [-0.09, 0.12, 0.16], ...HANKY_HI }],
      [1, { y: -0.06, rf: [0.09, 0.04, 0.02], lf: [-0.09, 0, 0], ...HANKY_LO }],
      [1.5, { y: 0.05, rf: [0.09, 0.12, 0.16], lf: [-0.09, 0.02, 0], ...HANKY_HI }],
    ],
  }),
  full({
    id: 'hat-dance-heels', name: 'Hat Dance Heels', tags: 'latin party | legs | folk clap', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'],
    desc: 'Fists on the hips, hop-switch the heels forward quick-quick-slow, then two big claps.',
    keys: [
      [0, { y: -0.04, rf: [0.11, 0.03, 0.18], lf: [-0.08, 0, 0], ...BEHIND }],
      [0.5, { y: -0.04, rf: [0.08, 0, 0], lf: [-0.11, 0.03, 0.18], ...BEHIND }],
      [1, { y: -0.04, rf: [0.11, 0.03, 0.18], lf: [-0.08, 0, 0], ...BEHIND }],
      [1.5, { y: -0.05, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...BEHIND }],
      [2, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [2.5, { y: -0.03, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [40, 10, 50, 30], l: [40, 10, 50, 30], handR: 1, handL: 1 }],
      [3, { y: -0.06, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [3.5, { y: -0.04, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...BEHIND }],
    ],
  }),
  full({
    id: 'dabke-stomp', name: 'Dabke Stomp', tags: 'party rock | legs | folk stomp kick', beats: 2, level: 'high', d: 2, parts: ['legs'], mirror: true, impact: true,
    desc: 'Arms down as if linked with the line: cross one foot in front, step back, kick that foot low forward, then stomp it down hard with the shoulders dropping.',
    keys: [
      [0, { y: -0.05, rf: [-0.03, 0, 0.07], lf: [-0.1, 0, 0], kneeR: -0.1, ...LINKED }],
      [0.5, { y: -0.04, rf: [-0.03, 0, 0.07], lf: [-0.1, 0, -0.03], ...LINKED }],
      [1, { y: -0.02, bend: -3, rf: [0.1, 0.13, 0.22], lf: [-0.1, 0, -0.03], ...LINKED }],
      [1.5, { y: -0.1, bend: 6, nod: 6, shR: 0.6, shL: 0.6, rf: [0.11, 0, 0.02], lf: [-0.1, 0, 0], ...LINKED }],
    ],
  }),
  // --- Tap & more line-dance / step-dance ---------------------------------
  full({
    id: 'shuffle-off-to-buffalo', name: 'Shuffle Off to Buffalo', tags: 'pop party | legs | swing walk', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, travel: 0.16, jump: true,
    desc: 'Vaudeville tap travel, arms out low: shuffle one foot (brush forward and back), hop on the other, step the shuffling foot crossed over in front, then leap sideways onto the other foot.',
    keys: [
      [0, { x: 0, y: -0.05, lean: 3, rf: [0.09, 0, 0], lf: [-0.09, 0.04, 0.08], ...VAUDE }],
      [0.25, { x: 0.01, y: -0.04, rf: [0.09, 0, 0], lf: [-0.09, 0.04, -0.03], ...VAUDE }],
      [0.5, { x: 0.05, y: 0.03, lean: 4, rf: [0.14, 0.02, 0], lf: [-0.04, 0.08, 0.02], ...VAUDE_HI }],
      [1, { x: 0.1, y: -0.07, lean: 2, rf: [0.13, 0, 0], lf: [0.18, 0, 0.08], kneeL: -0.15, ...VAUDE }],
      [1.5, { x: 0.16, y: 0.02, lean: 3, rf: [0.25, 0.02, 0], lf: [0.1, 0.05, 0.04], ...VAUDE_HI }],
    ],
  }),
  full({
    id: 'time-step', name: 'Time Step', tags: 'pop party | legs | swing stomp', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true, impact: true,
    desc: 'The tap time step: stamp, shuffle the same foot forward and back, hop on the other foot, then step-step quickly, loose arms swinging.',
    keys: [
      [0, { y: -0.08, bend: 4, rf: [0.1, 0, 0.02], lf: [-0.09, 0, 0], ...TAP_ARMS(1) }],
      [0.5, { y: -0.05, rf: [0.1, 0.05, 0.09], lf: [-0.09, 0, 0], ...TAP_ARMS(1) }],
      [0.75, { y: -0.04, rf: [0.1, 0.04, -0.03], lf: [-0.09, 0, 0], ...TAP_ARMS(1) }],
      [1, { y: 0.03, lean: -3, rf: [0.11, 0.08, 0.02], lf: [-0.09, 0.02, 0], ...TAP_ARMS(-1) }],
      [1.25, { y: -0.06, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], ...TAP_ARMS(-1) }],
      [1.5, { y: -0.05, rf: [0.1, 0, 0], lf: [-0.09, 0.06, 0.03], ...TAP_ARMS(-1) }],
    ],
  }),
  full({
    id: 'irish-sevens', name: 'Irish Sevens', tags: 'party pop | legs | folk walk', beats: 4, level: 'high', d: 3, parts: ['legs'], mirror: true, travel: 0.24,
    desc: 'Arms straight down at the sides, travel sideways on the balls of the feet with seven quick steps, the back foot stepping in behind each time.',
    keys: [
      [0, { x: 0, y: -0.02, rf: [0.08, 0, 0], lf: [-0.07, 0.14, -0.08], ...IRISH }],
      [0.5, { x: 0.03, y: 0.0, rf: [0.13, 0, 0], lf: [0.04, 0, -0.04], ...IRISH }],
      [1, { x: 0.07, y: -0.01, rf: [0.13, 0, 0], lf: [0.07, 0, -0.04], ...IRISH }],
      [1.5, { x: 0.1, y: 0.0, rf: [0.2, 0, 0], lf: [0.07, 0, -0.04], ...IRISH }],
      [2, { x: 0.14, y: -0.01, rf: [0.2, 0, 0], lf: [0.14, 0, -0.04], ...IRISH }],
      [2.5, { x: 0.17, y: 0.0, rf: [0.27, 0, 0], lf: [0.14, 0, -0.04], ...IRISH }],
      [3, { x: 0.21, y: -0.01, rf: [0.27, 0, 0], lf: [0.21, 0, -0.04], ...IRISH }],
      [3.5, { x: 0.24, y: -0.03, rf: [0.32, 0, 0], lf: [0.17, 0.04, 0], ...IRISH }],
    ],
  }),
  full({
    id: 'rocking-chair', name: 'Rocking Chair', tags: 'rock pop | legs | country', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], mirror: true,
    desc: 'Thumbs in the belt, rock forward onto one foot leaning in, back to centre, rock back onto it leaning away, and centre again.',
    keys: [
      [0, { y: -0.08, bend: 18, nod: 5, rf: [0.09, 0, 0.15], lf: [-0.09, 0.06, -0.04], kneeR: 0.15, ...BELT }],
      [0.5, { y: -0.03, bend: 0, rf: [0.09, 0, 0.07], lf: [-0.09, 0, 0], ...BELT }],
      [1, { y: -0.05, bend: -12, nod: -6, rf: [0.09, 0, -0.13], lf: [-0.09, 0.06, 0.05], ...BELT }],
      [1.5, { y: -0.03, bend: 0, rf: [0.09, 0, -0.05], lf: [-0.09, 0, 0], ...BELT }],
    ],
  }),
  full({
    id: 'waltz-turn', name: 'Waltz Turn', tags: 'pop latin | turn | spin', beats: 4, level: 'low', d: 2, parts: ['turn', 'legs'], mirror: true,
    desc: 'Holding a ballroom frame, turn a quarter on every beat with a down-up rise and fall, all the way round.',
    keys: [
      [0, waltzTurn(0, true)], [0.5, waltzTurn(45, false)],
      [1, waltzTurn(90, true)], [1.5, waltzTurn(135, false)],
      [2, waltzTurn(180, true)], [2.5, waltzTurn(225, false)],
      [3, waltzTurn(270, true)], [3.5, waltzTurn(315, false)],
    ],
  }),
  full({
    id: 'heel-toe-polka', name: 'Heel-Toe Polka', tags: 'party pop | legs | folk', beats: 4, level: 'mid', d: 2, parts: ['legs'], mirror: true, travel: 0.16,
    desc: 'Hands on hips: dig the heel out to the side, tap the same toe in by the other foot, then polka step-close-step away toward that side.',
    keys: [
      [0, { x: -0.01, y: -0.05, lean: -3, rf: [0.22, 0.03, 0.04], lf: [-0.09, 0, 0], ...HIPS }],
      [1, { x: -0.01, y: -0.06, lean: 2, rf: [-0.02, 0.04, 0.06], kneeR: -0.3, lf: [-0.09, 0, 0], ...HIPS }],
      [2, { x: 0.05, y: -0.05, rf: [0.18, 0, 0], lf: [-0.09, 0, 0], ...HIPS }],
      [2.5, { x: 0.1, y: -0.02, rf: [0.18, 0, 0], lf: [0.07, 0, 0], ...HIPS }],
      [3, { x: 0.15, y: -0.05, rf: [0.26, 0, 0], lf: [0.07, 0, 0], ...HIPS }],
      [3.5, { x: 0.16, y: -0.03, lean: 3, rf: [0.26, 0, 0], lf: [0.12, 0.08, 0.03], ...HIPS }],
    ],
  }),
  full({
    id: 'pas-de-basque', name: 'Highland Pas de Basque', tags: 'party pop | legs | folk jump', beats: 2, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, jump: true,
    desc: 'Both arms curved overhead: spring onto one foot to the side, beat the other in beside it, step in place, then point the free foot forward.',
    keys: [
      [0, { y: 0.03, x: 0.03, rf: [0.15, 0.03, 0], lf: [-0.07, 0.08, 0.02], ...HIGH5 }],
      [0.5, { y: -0.05, x: 0.03, rf: [0.15, 0, 0], lf: [0.03, 0, 0.02], ...HIGH5 }],
      [1, { y: -0.03, x: 0.02, rf: [0.13, 0, 0], lf: [0.03, 0.03, 0.02], ...HIGH5 }],
      [1.5, { y: -0.04, x: 0.0, rf: [0.09, 0, 0], lf: [-0.07, 0.03, 0.13], kneeL: 0.2, ...HIGH5 }],
    ],
  }),
  full({
    id: 'yemenite-step', name: 'Yemenite Step', tags: 'party pop | legs | folk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Step to the side sinking into the knee, rise onto the ball of the other foot beside it, then cross the first foot over in front with a dip, arms swinging toward the step.',
    keys: [
      [0, { y: -0.11, x: 0.04, lean: 3, hips: 0.03, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], ...lineSwing(1) }],
      [0.5, { y: -0.02, x: 0.0, rf: [0.2, 0, 0], lf: [0.0, 0.02, 0.02], ...lineSwing(1) }],
      [1, { y: -0.09, x: -0.03, lean: -3, twist: -8, rf: [-0.08, 0, 0.07], lf: [0.0, 0, 0.02], kneeR: -0.1, ...lineSwing(-1) }],
      [1.5, { y: -0.05, x: 0.0, rf: [0.04, 0, 0.03], lf: [-0.09, 0, 0], ...lineSwing(-1) }],
    ],
  }),
];
