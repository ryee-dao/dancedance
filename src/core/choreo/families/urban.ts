/**
 * Moves of the new genre sets (see AUTHORING.md, "Genre sets", and
 * ../genreSets/). Same shape as every family file.
 *
 * Trap, drill, R&B and reggaeton. Every move here is genre-exclusive (listed
 * in genreSets/urban.ts). Trap and drill are counted at ~130-160 BPM with a
 * half-time feel: most of their moves hit sharply and hold (a quick change
 * into the beat, then a held or slowly released shape), so their speed limit
 * (speed.ts) sits around 90-130 and the generator dances them at half time
 * there; a few small actions (Rap Hands, Shoulder Rock, Drill Arm Swing) stay
 * on the counted beat. R&B (60-110) and reggaeton (88-100) moves run at full time.
 *
 * Gestures stay neutral: open hands, loose fists, no pointed "fingers", no
 * signs. Reggaeton hip work stays upright and family-friendly.
 */
import { FIST, OPEN, at, mir, wide, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

// Elbow hints: [out, up, fwd] in the arm's own frame.
const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.6, -1, -0.3] as const;
const E_UP = [1, 0.3, -0.2] as const;
const E_BACK = [1, 0, -0.5] as const;
const E_ACROSS = [0.6, -1, 0] as const;

/** Loose bent arms in front of the waist (the neutral "between hits" arms). */
const LOOSE: PoseSpec = { r: at(1, 0.19, 0.6, 0.15, E_OUT), l: at(-1, -0.19, 0.6, 0.15, E_OUT), handR: 0.4, handL: 0.4 };

// --- Trap ------------------------------------------------------------------------
// Shoulder lean: the upper body tips over to one side, that shoulder dropping and the arm hanging long.
const leanA: PoseSpec = {
  y: -0.08, x: 0.02, hips: -0.015, lean: 10, head: 5, nod: 4, turn: 7, shR: 0, shL: 1,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.12, kneeL: 0.04,
  r: at(1, 0.26, 0.47, 0.06, E_OUT), l: at(-1, -0.2, 0.6, 0.12, E_OUT), handR: 0.5, handL: 0.4,
};
const leanHold: PoseSpec = { ...leanA, y: -0.065, lean: 9, nod: 2 };

// Lean two-step: step out on a bent knee and lean the upper body back and away from it.
const ltsOut: PoseSpec = {
  x: 0.045, y: -0.1, hips: 0.03, tilt: 3, lean: -10, bend: -7, head: 6, nod: -6, turn: 16, shR: 0.8, shL: 0,
  rf: [0.25, 0, 0.02], lf: [-0.09, 0, 0], kneeR: 0.25, kneeL: 0,
  r: at(1, 0.34, 0.6, 0.1, E_OUT), l: at(-1, 0.06, 0.64, 0.22, E_ACROSS), handR: 0.5, handL: 0.5,
};
const ltsHold: PoseSpec = { ...ltsOut, y: -0.08, lean: -8, bend: -5, nod: -4 };
const ltsIn: PoseSpec = {
  x: 0, y: -0.04, hips: 0, tilt: 0, lean: 2, bend: 2, head: 0, nod: 2, turn: 0, shR: 0.3, shL: 0.3,
  rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.05, kneeL: 0.05, ...LOOSE,
};

// Hit & hold: two hard shapes, each snapped into and held.
const hitLow: PoseSpec = wide(-0.13, {
  bend: 6, nod: 12, shR: 1.2, shL: 1.2, kneeR: 0.15, kneeL: 0.15,
  r: at(1, -0.05, 0.5, 0.2, E_OUT), l: at(-1, 0.05, 0.52, 0.18, E_OUT), ...FIST,
});
const hitLowHold: PoseSpec = { ...hitLow, y: -0.15, nod: 13 };
const hitSpread: PoseSpec = wide(-0.08, {
  lean: -6, bend: -8, nod: -8, turn: 16, head: 4, shR: 0.2, shL: 0.2, kneeR: 0.05, kneeL: 0.05,
  r: at(1, 0.36, 0.5, 0.12, E_OUT), l: at(-1, -0.3, 0.52, 0.14, E_OUT), ...OPEN,
});
const hitSpreadHold: PoseSpec = { ...hitSpread, y: -0.09, lean: -7 };
const hitRelease: PoseSpec = wide(-0.05, { nod: 2, shR: 0.3, shL: 0.3, ...LOOSE });

// Rap hands: one palm-down hand bouncing in front of the chest with the flow.
const rapDown: PoseSpec = {
  y: -0.05, nod: 8, rf: [0.1, 0, 0], lf: [-0.1, 0, 0],
  r: at(1, 0.14, 0.68, 0.25, [1, -0.4, -0.2]), l: at(-1, -0.22, 0.5, 0.05, E_OUT), handR: 1, handL: 0.4,
};
const rapUp: PoseSpec = { ...rapDown, y: -0.02, nod: -2, r: at(1, 0.16, 0.84, 0.23, [1, -0.4, -0.2]) };

// --- Drill -----------------------------------------------------------------------
// Drill bounce: the weight drops onto one foot, the other heel lifting, both bent arms swinging to that side.
const dbA: PoseSpec = {
  y: -0.13, x: 0.04, hips: 0.03, tilt: 3, bend: 8, nod: 7, lean: 3, head: -3, shR: 0.2, shL: 0.6,
  rf: [0.11, 0, 0.01], lf: [-0.11, 0, 0], kneeR: 0.14, kneeL: 0.05, pitchL: 18,
  r: at(1, 0.28, 0.56, 0.13, E_OUT), l: at(-1, -0.01, 0.58, 0.21, E_ACROSS), handR: 0.3, handL: 0.3,
};
const dbUp: PoseSpec = {
  y: -0.05, x: 0, hips: 0, tilt: 0, bend: 6, nod: 0, lean: 0, head: 0, shR: 0.4, shL: 0.4,
  rf: [0.11, 0, 0.01], lf: [-0.11, 0, 0.01], kneeR: 0.05, kneeL: 0.05, pitchL: 0, pitchR: 0, ...LOOSE,
};

// Shoulder rock: shoulders rocking forward and back in turn, arms swinging with them.
const srA: PoseSpec = {
  y: -0.06, bend: 7, twist: 20, turn: -8, nod: 4, shR: 1, shL: 0.1,
  rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.12, 0.6, 0.25, E_OUT), l: at(-1, -0.26, 0.54, -0.05, E_BACK), handR: 0.4, handL: 0.4,
};
const srMid: PoseSpec = { y: -0.03, bend: 5, twist: 0, turn: 0, nod: 0, shR: 0.4, shL: 0.4, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], ...LOOSE };

// Drill strut: a heavy strut on the spot, the opposite arm swinging up across the chest.
const strutA: PoseSpec = {
  y: -0.1, x: 0.02, hips: 0.02, twist: -16, bend: -4, nod: -6, turn: 6, shL: 0.8, shR: 0.1,
  rf: [0.1, 0, 0.03], lf: [-0.09, 0.09, 0.06], kneeL: 0.15, kneeR: 0.08,
  r: at(1, 0.26, 0.54, -0.1, E_BACK), l: at(-1, 0.05, 0.8, 0.24, E_ACROSS), handR: 0.6, handL: 0.6,
};
const strutMid: PoseSpec = {
  y: -0.04, x: 0, hips: 0, twist: 0, bend: -2, nod: -2, turn: 0, shL: 0.3, shR: 0.3,
  rf: [0.1, 0, 0.02], lf: [-0.1, 0, 0.02], kneeL: 0.04, kneeR: 0.04,
  r: at(1, 0.2, 0.58, 0.08, E_OUT), l: at(-1, -0.2, 0.58, 0.08, E_OUT), handR: 0.6, handL: 0.6,
};

// Sturdy: bent over, hopping from foot to foot, the free foot flicking out low, fists pumping.
const sturdyLand: PoseSpec = {
  y: -0.12, bend: 13, nod: 4, lean: 3, rf: [0.1, 0, 0.04], lf: [-0.15, 0.1, -0.05], kneeL: 0.35, kneeR: 0.12,
  r: at(1, 0.16, 0.74, 0.22, E_OUT), l: at(-1, -0.24, 0.56, -0.06, E_BACK), ...FIST,
};
const sturdyAir: PoseSpec = {
  y: 0.04, bend: 9, nod: 2, lean: 0, rf: [0.1, 0.04, 0.01], lf: [-0.1, 0.04, 0], kneeL: 0.1, kneeR: 0.1,
  r: at(1, 0.2, 0.62, 0.12, E_OUT), l: at(-1, -0.2, 0.62, 0.12, E_OUT), ...FIST,
};

// Drill glide: slide out low to the side, slide the other foot in, hunched, arms swinging with it.
const glideOut = (x: number, lead: number, trail: number): PoseSpec => ({
  x, y: -0.14, hips: 0.02, bend: 9, nod: 5, lean: -4, turn: 10, shR: 0.7, shL: 0.3,
  rf: [lead, 0, 0], lf: [trail, 0, 0], slideR: true, kneeR: 0.16, kneeL: 0.1,
  r: at(1, 0.32, 0.6, 0.1, E_OUT), l: at(-1, -0.02, 0.6, 0.2, E_ACROSS), handR: 0.5, handL: 0.5,
});
const glideIn = (x: number, lead: number, trail: number): PoseSpec => ({
  x, y: -0.07, hips: -0.01, bend: 6, nod: 2, lean: 2, turn: 4, shR: 0.4, shL: 0.4,
  rf: [lead, 0, 0], lf: [trail, 0, 0], slideL: true, kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.24, 0.58, 0.14, E_OUT), l: at(-1, -0.12, 0.6, 0.16, E_OUT), handR: 0.5, handL: 0.5,
});

// Drill two-step: bounce out and in, the hand on the stepping side flicking down and out.
const d2Out: PoseSpec = {
  x: 0.04, y: -0.12, hips: 0.03, tilt: 3, bend: 7, nod: 8, turn: 14,
  rf: [0.24, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.2, kneeL: 0.1,
  r: at(1, 0.34, 0.5, 0.14, [1, -0.6, -0.2]), l: at(-1, -0.14, 0.66, 0.2, E_OUT), handR: 1, handL: 0.3,
};
const d2Hold: PoseSpec = { ...d2Out, y: -0.09, nod: 4, r: at(1, 0.32, 0.54, 0.15, [1, -0.6, -0.2]) };
const d2In: PoseSpec = {
  x: 0, y: -0.05, hips: 0, tilt: 0, bend: 4, nod: 0, turn: 0,
  rf: [0.1, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.05, kneeL: 0.05, ...LOOSE,
};

// --- R&B -------------------------------------------------------------------------
// Body roll in quarter profile, the near hand tracing down the front of the body.
const roll = (bend: number, nod: number, y: number, knee: number, hx: number, hy: number, hz: number): PoseSpec => ({
  spin: 40, y, bend, nod, kneeR: knee, kneeL: knee, rf: [0.08, 0, 0.02], lf: [-0.08, 0, -0.02],
  r: at(1, hx, hy, hz, E_DOWN), l: at(-1, -0.2, 0.52, 0.04, E_OUT), handR: 1, handL: 0.7,
});

// Slow hip roll: one big circle over the bar, a hand on the belly and the other arm raised by the head.
const hipRoll = (hips: number, tilt: number, bend: number, y: number): PoseSpec =>
  wide(y, {
    hips, tilt, bend, nod: bend * 0.4, head: -tilt * 0.4, kneeR: 0.08, kneeL: 0.08,
    r: at(1, 0.03, 0.6, 0.19, E_DOWN), l: at(-1, -0.17, 1.0, 0.04, E_UP), handR: 1, handL: 1,
  });

// Snap sway: weight to one side, a snap up beside that shoulder.
const snapA: PoseSpec = {
  y: -0.05, x: 0.03, hips: 0.045, tilt: 5, lean: -3, head: 5, turn: 20,
  rf: [0.11, 0, 0], lf: [-0.1, 0.02, 0.02], kneeL: -0.12,
  r: at(1, 0.3, 0.86, 0.1, E_OUT), l: at(-1, -0.02, 0.62, 0.2, E_DOWN), handR: 0.3, handL: 0.6,
};
const snapB: PoseSpec = { ...snapA, y: -0.03, r: at(1, 0.28, 0.8, 0.12, E_OUT), handR: 0.9 };

// Slow-jam sway: weight rolling slowly from foot to foot, one hand resting on the chest.
const jamA: PoseSpec = {
  y: -0.07, x: 0.035, hips: 0.04, tilt: 5, lean: 5, head: 9, nod: 4,
  rf: [0.11, 0, 0], lf: [-0.1, 0.015, 0.01], kneeR: 0.1, kneeL: -0.08,
  r: at(1, 0.04, 0.72, 0.17, E_DOWN), l: at(-1, -0.3, 0.6, 0.12, E_OUT), handR: 1, handL: 0.8,
};

// --- Reggaeton --------------------------------------------------------------------
// Dembow step: step out, bounce on the "a", close, bounce on the "and" (the dembow: 1 . . a 2 . & .).
const dembowOut: PoseSpec = {
  x: 0.055, y: -0.08, hips: 0.04, tilt: 5, rf: [0.22, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.1,
  r: at(1, 0.22, 0.7, 0.16, E_DOWN), l: at(-1, -0.12, 0.72, 0.2, E_DOWN), handR: 0.3, handL: 0.3, shR: 0.4,
};
const dembowA: PoseSpec = { ...dembowOut, y: -0.05, hips: 0.02, tilt: 2, shR: 0, r: at(1, 0.22, 0.76, 0.16, E_DOWN), l: at(-1, -0.12, 0.78, 0.2, E_DOWN) };
const dembowIn: PoseSpec = {
  x: 0.13, y: -0.08, hips: -0.03, tilt: -4, rf: [0.22, 0, 0], lf: [0.04, 0.015, 0.01], kneeL: 0.08,
  r: at(1, 0.14, 0.7, 0.2, E_DOWN), l: at(-1, -0.2, 0.7, 0.16, E_DOWN), handR: 0.3, handL: 0.3, shL: 0.4,
};
const dembowAnd: PoseSpec = { ...dembowIn, y: -0.05, hips: -0.01, tilt: -1, shL: 0, r: at(1, 0.14, 0.76, 0.2, E_DOWN), l: at(-1, -0.2, 0.76, 0.16, E_DOWN) };

// Perreo bounce, upright: the hips pop from side to side on the dembow hits (1, the "a", 2, the "and").
const perreo = (side: 1 | -1, y: number): PoseSpec =>
  wide(y, {
    hips: 0.042 * side, tilt: 7 * side, bend: 5, lean: -2 * side, head: -4 * side,
    kneeR: side > 0 ? 0.05 : 0.16, kneeL: side > 0 ? 0.16 : 0.05,
    r: at(1, 0.1, 0.98, -0.02, [1, 0.6, -0.2]), l: at(-1, -0.03, 0.6, 0.2, E_DOWN), handR: 1, handL: 1,
  });

// Hip roll on the dembow bounce, one hand behind the head and the other on the hip.
const rgRoll = (hips: number, tilt: number, bend: number, y: number): PoseSpec =>
  wide(y, {
    hips, tilt, bend, nod: bend * 0.5, kneeR: 0.12, kneeL: 0.12,
    r: at(1, 0.06, 0.98, -0.04, [1, 0.6, -0.2]), l: at(-1, -0.2, 0.55, 0.06, [1, 0, -0.4]), handR: 1, handL: 0,
  });

// Dembow knee pop: one knee pops in with the heel up, alternating on the dembow.
const kneePop = (side: 1 | -1, y: number, fists: number): PoseSpec => {
  const legs: PoseSpec = side > 0
    ? { kneeR: -0.55, kneeL: 0.1, pitchR: 24, pitchL: 0, hips: -0.03, tilt: -5 }
    : { kneeL: -0.55, kneeR: 0.1, pitchL: 24, pitchR: 0, hips: 0.03, tilt: 5 };
  return {
    y, rf: [0.11, 0, 0.01], lf: [-0.11, 0, 0.01], ...legs,
    r: at(1, 0.18, fists, 0.18, E_DOWN), l: at(-1, -0.18, fists, 0.18, E_DOWN), ...FIST,
  };
};

// Sandungueo: hop foot to foot side to side with a hip pop, arms swinging loose.
const sandLand: PoseSpec = {
  x: 0.06, y: -0.1, hips: 0.04, tilt: 6, lean: -3,
  rf: [0.17, 0, 0], lf: [-0.04, 0.06, 0.02], kneeR: 0.12, kneeL: -0.15,
  r: at(1, 0.34, 0.64, 0.1, E_OUT), l: at(-1, 0.02, 0.64, 0.2, E_ACROSS), handR: 0.6, handL: 0.6,
};
const sandAir: PoseSpec = {
  x: 0, y: 0.03, hips: 0, tilt: 0, lean: 0,
  rf: [0.09, 0.04, 0], lf: [-0.09, 0.04, 0], kneeR: 0.05, kneeL: 0.05,
  r: at(1, 0.2, 0.66, 0.14, E_OUT), l: at(-1, -0.2, 0.66, 0.14, E_OUT), handR: 0.6, handL: 0.6,
};

// Shoulder shimmy on the dembow: arms bent up at the chest, shoulders alternating.
const shim = (side: 1 | -1, y: number): PoseSpec => ({
  y, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], twist: 14 * side, chestX: 0.015 * side, shR: side > 0 ? 1 : 0.2, shL: side > 0 ? 0.2 : 1,
  hips: -0.015 * side,
  r: at(1, 0.18, 0.86, 0.12, E_OUT), l: at(-1, -0.18, 0.86, 0.12, E_OUT), handR: 0.6, handL: 0.6,
});

// Turn-up jump: crouch with the fists low, jump on the drop flinging both arms open and up, land low.
const tuLand: PoseSpec = wide(-0.12, {
  bend: 8, nod: 6, kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.22, 0.5, 0.1, E_OUT), l: at(-1, -0.22, 0.5, 0.1, E_OUT), ...FIST,
});
const tuCrouch: PoseSpec = wide(-0.15, {
  bend: 14, nod: 8, kneeR: 0.15, kneeL: 0.15,
  r: at(1, 0.15, 0.48, 0.16, E_OUT), l: at(-1, -0.15, 0.48, 0.16, E_OUT), ...FIST,
});
const tuAir: PoseSpec = {
  y: 0.06, bend: -4, nod: -10, rf: [0.11, 0.05, 0], lf: [-0.11, 0.05, 0],
  r: at(1, 0.38, 0.86, 0.06, E_UP), l: at(-1, -0.38, 0.86, 0.06, E_UP), ...OPEN,
};

// Drill arm swing: one loose arm swings forward and up, then back past the hip, the shoulder rocking with it.
const swingFwd: PoseSpec = {
  y: -0.06, twist: 10, turn: -4, nod: 5, shR: 0.7, shL: 0.2, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.1, 0.8, 0.27, E_DOWN), l: at(-1, -0.16, 0.6, 0.16, E_OUT), handR: 0.8, handL: 0.4,
};
const swingBack: PoseSpec = {
  y: -0.03, twist: -6, turn: 2, nod: -1, shR: 0.2, shL: 0.3, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.02, kneeL: 0.02,
  r: at(1, 0.24, 0.5, -0.16, E_BACK), l: at(-1, -0.16, 0.6, 0.16, E_OUT), handR: 0.8, handL: 0.4,
};

// Hip roll down: the hips keep circling while the knees sink into a wide bend and rise, hands on the hips.
const rollDown = (hips: number, tilt: number, bend: number, y: number): PoseSpec =>
  wide(y, {
    hips, tilt, bend, nod: bend * 0.4, head: -tilt * 0.4, kneeR: 0.06 - y * 0.8, kneeL: 0.06 - y * 0.8,
    r: at(1, 0.24, 0.58, 0.04, [1, 0, -0.3]), l: at(-1, -0.24, 0.58, 0.04, [1, 0, -0.3]), handR: 1, handL: 1,
  });

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  // --- Trap -----------------------------------------------------------------------
  full({
    id: 'shoulder-lean', name: 'Shoulder Lean', tags: 'hiphop | full |', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'],
    desc: 'Knees soft, tip the whole upper body over to one side on the beat with that shoulder dropping and its arm hanging long, hold it, then lean to the other side.',
    keys: [[0, leanA], [0.75, leanHold], [1, mir(leanA)], [1.75, mir(leanHold)]],
  }),
  full({
    id: 'lean-two-step', name: 'Lean Two-Step', tags: 'hiphop | legs full | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true,
    desc: 'Step out on a bent knee and lean the upper body back and away from the step, hands swinging loose toward it; hold, then bring the foot home and straighten.',
    keys: [[0, ltsOut], [0.75, ltsHold], [1, ltsIn], [1.75, { ...ltsIn, y: -0.05 }]],
  }),
  full({
    id: 'hit-and-hold', name: 'Hit & Hold', tags: 'hiphop | arms full |', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'On the bass hit, snap down into the knees with the fists crossed low in front, shoulders up and chin down, and hold; release, then snap into a lean back with both open hands spread low and hold.',
    keys: [[0, hitLow], [1, hitLowHold], [1.75, hitRelease], [2, hitSpread], [3, hitSpreadHold], [3.75, hitRelease]],
  }),
  full({
    id: 'rap-hands', name: 'Rap Hands', tags: 'hiphop | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Bob the head and knees on every beat while one hand, palm down and fingers spread, bounces up and down in front of the chest with the flow; the other hangs loose. Switch hands.',
    keys: [[0, rapDown], [0.5, rapUp], [1, rapDown], [1.5, rapUp]],
  }),

  full({
    id: 'turn-up-jump', name: 'Turn-Up Jump', tags: 'hiphop | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'arms', 'legs'], jump: true, impact: true,
    desc: 'Crouch with the fists low in front, jump on the drop flinging both arms open and up, then land low and wide with the fists dropping.',
    keys: [[0, tuLand], [0.5, tuCrouch], [1, tuAir], [1.5, { ...tuLand, y: -0.14 }]],
  }),

  // --- Drill ----------------------------------------------------------------------
  full({
    id: 'drill-bounce', name: 'Drill Bounce', tags: 'hiphop | legs full |', beats: 2, level: 'mid', d: 1, parts: ['legs', 'arms'],
    desc: 'Drop the weight onto one foot as the other heel lifts, knees bending sharply on the beat, both bent arms swinging over to that side; rise, then drop onto the other foot.',
    keys: [[0, dbA], [0.75, dbUp], [1, mir(dbA)], [1.75, dbUp]],
  }),
  full({
    id: 'shoulder-rock', name: 'Shoulder Rock', tags: 'hiphop | full |', beats: 2, level: 'low', d: 1, parts: ['torso'],
    desc: 'Hunch a little and rock the shoulders: one shoulder drives forward with its arm swinging forward as the other pulls back, then swap, on every beat.',
    keys: [[0, srA], [0.5, srMid], [1, mir(srA)], [1.5, srMid]],
  }),
  full({
    id: 'drill-arm-swing', name: 'Drill Arm Swing', tags: 'hiphop | arms |', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true,
    desc: 'Small knee bounce, one loose arm swinging forward and up to the chest and back past the hip on every beat, the shoulder rocking with it; switch arms.',
    keys: [[0, swingFwd], [0.5, swingBack], [1, swingFwd], [1.5, swingBack]],
  }),
  full({
    id: 'drill-strut', name: 'Drill Strut', tags: 'hiphop | full | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'],
    desc: 'Strut on the spot with a heavy bounce: step down onto one foot as the other knee lifts, the opposite arm swinging up across the chest and the shoulders rocking with it, chin up; then the other side.',
    keys: [[0, strutA], [0.75, strutMid], [1, mir(strutA)], [1.75, strutMid]],
  }),
  full({
    id: 'sturdy-hop', name: 'Sturdy Hop', tags: 'hiphop | legs | jump', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump', 'arms'], jump: true, impact: true,
    desc: 'Bent over with the knees bent, hop from one foot to the other on each beat, the free foot flicking out low behind to the side, fists pumping hard in opposition.',
    keys: [[0, sturdyLand], [0.5, sturdyAir], [1, mir(sturdyLand)], [1.5, sturdyAir]],
  }),
  full({
    id: 'drill-glide', name: 'Drill Glide', tags: 'hiphop | legs | walk', beats: 2, level: 'high', d: 3, parts: ['legs', 'arms'], mirror: true, travel: 0.22,
    desc: 'Low and hunched, glide the lead foot out along the floor, then slide the other foot in to meet it, twice, travelling to the side, the arms swinging toward the travel; glide back the other way.',
    keys: [
      [0, glideOut(0.05, 0.2, -0.09)],
      [0.75, glideIn(0.11, 0.2, 0.02)],
      [1, glideOut(0.16, 0.31, 0.02)],
      [1.75, glideIn(0.22, 0.31, 0.13)],
    ],
  }),
  full({
    id: 'drill-two-step', name: 'Drill Two-Step', tags: 'hiphop | legs arms | walk hands', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'Bouncy two-step: drop out onto a bent knee with the hand on that side flicking down and out, palm open, then bounce the foot back in.',
    keys: [[0, d2Out], [0.75, d2Hold], [1, d2In], [1.75, { ...d2In, y: -0.06 }]],
  }),

  // --- R&B ------------------------------------------------------------------------
  full({
    id: 'body-roll', name: 'Body Roll', tags: 'hiphop funk | full | wave', beats: 2, level: 'low', d: 2, parts: ['torso', 'hips'], mirror: true, bounce: 0.3,
    desc: 'Turned a little to one side, roll the body like a wave from the chest down to the hips, the near hand tracing down the front of the body, then rise and turn to the other side.',
    keys: [
      [0, roll(-8, -8, -0.02, 0, 0.04, 0.8, 0.17)],
      [0.5, roll(12, 6, -0.05, 0.05, 0.06, 0.66, 0.2)],
      [1, roll(-6, -2, -0.11, 0.18, 0.1, 0.54, 0.18)],
      [1.5, roll(2, 0, -0.05, 0.06, 0.18, 0.5, 0.12)],
    ],
  }),
  full({
    id: 'slow-hip-roll', name: 'Slow Hip Roll', tags: 'funk hiphop | hips | hips', beats: 4, level: 'low', d: 2, parts: ['hips'], mirror: true, bounce: 0.3,
    desc: 'Feet apart and knees soft, roll the hips round in one big slow circle over the bar, one hand on the belly and the other arm raised loosely by the head; next time circle the other way.',
    keys: [[0, hipRoll(0.07, 8, -1, -0.05)], [1, hipRoll(0, 0, 8, -0.04)], [2, hipRoll(-0.07, -8, -1, -0.05)], [3, hipRoll(0, 0, -5, -0.08)]],
  }),
  full({
    id: 'hip-roll-down', name: 'Hip Roll Down', tags: 'hiphop funk | hips legs | hips', beats: 4, level: 'mid', d: 2, parts: ['hips', 'legs'], mirror: true, bounce: 0.3,
    desc: 'Hands on the hips, keep the hips circling while you sink down into a wide knee bend over two beats, then circle back up.',
    keys: [
      [0, rollDown(0.065, 7, -1, -0.05)], [0.5, rollDown(0, 0, 8, -0.08)], [1, rollDown(-0.065, -7, -1, -0.12)], [1.5, rollDown(0, 0, -5, -0.16)],
      [2, rollDown(0.065, 7, -1, -0.17)], [2.5, rollDown(0, 0, 8, -0.14)], [3, rollDown(-0.065, -7, -1, -0.1)], [3.5, rollDown(0, 0, -5, -0.07)],
    ],
  }),
  full({
    id: 'snap-sway', name: 'Snap Sway', tags: 'hiphop funk | arms hips | hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.5,
    desc: 'Shift the weight slowly from side to side with a soft knee, snapping the fingers up beside the shoulder on the side you sway to, the head turning toward the snap.',
    keys: [[0, snapA], [0.5, snapB], [1, mir(snapA)], [1.5, mir(snapB)]],
  }),
  full({
    id: 'slow-jam-sway', name: 'Slow-Jam Sway', tags: 'pop hiphop | hips | wave', beats: 4, level: 'low', d: 1, parts: ['hips', 'torso'], bounce: 0.2,
    desc: 'Roll the weight slowly from foot to foot over two beats each, leaning and tipping the head with it, one hand resting on the chest and the other arm hanging soft.',
    keys: [[0, jamA], [1, { ...jamA, y: -0.05, lean: 4 }], [2, mir(jamA)], [3, mir({ ...jamA, y: -0.05, lean: 4 })]],
  }),

  // --- Reggaeton ------------------------------------------------------------------
  full({
    id: 'dembow-step', name: 'Dembow Step', tags: 'latin hiphop | legs hips | walk hips', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true, travel: 0.13,
    desc: 'Step out to the side with a hip shift and bounce on the "a" of the beat, touch the other foot in beside it and bounce on the "and", fists loose at the chest pulsing with the bounces; then step back the other way.',
    keys: [[0, dembowOut], [0.75, dembowA], [1, dembowIn], [1.5, dembowAnd]],
  }),
  full({
    id: 'perreo-bounce', name: 'Perreo Bounce', tags: 'latin hiphop | hips | hips shake', beats: 2, level: 'mid', d: 2, parts: ['hips', 'legs'],
    desc: 'Upright with the knees bent, pop the hips from side to side on the dembow rhythm (on the beat, the "a", the next beat, the "and"), one hand behind the head and the other low in front.',
    keys: [[0, perreo(1, -0.09)], [0.75, perreo(-1, -0.07)], [1, perreo(1, -0.09)], [1.5, perreo(-1, -0.07)]],
  }),
  full({
    id: 'reggaeton-hip-roll', name: 'Reggaeton Hip Roll', tags: 'latin hiphop | hips | hips', beats: 2, level: 'mid', d: 2, parts: ['hips'], mirror: true,
    desc: 'Knees bent and bouncing, roll the hips round once every two beats, one hand behind the head with the elbow high and the other fist on the hip.',
    keys: [[0, rgRoll(0.07, 8, -2, -0.09)], [0.5, rgRoll(0, 0, 9, -0.06)], [1, rgRoll(-0.07, -8, -2, -0.09)], [1.5, rgRoll(0, 0, -6, -0.12)]],
  }),
  full({
    id: 'dembow-knee-pop', name: 'Dembow Knee Pop', tags: 'latin hiphop | legs | hips', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'],
    desc: 'Pop one knee in with the heel up on the beat, the other on the "a", the first again on the next beat and the other on the "and", fists pumping low with the knees.',
    keys: [[0, kneePop(1, -0.08, 0.58)], [0.75, kneePop(-1, -0.07, 0.64)], [1, kneePop(1, -0.08, 0.58)], [1.5, kneePop(-1, -0.07, 0.64)]],
  }),
  full({
    id: 'sandungueo-bounce', name: 'Sandungueo Bounce', tags: 'latin hiphop | legs hips | jump hips', beats: 2, level: 'high', d: 2, parts: ['legs', 'jump', 'hips'], jump: true, impact: true,
    desc: 'Hop from foot to foot side to side, landing with a hip pop over the landing foot as the other foot taps in, arms swinging loose across the body.',
    keys: [[0, sandLand], [0.5, sandAir], [1, mir(sandLand)], [1.5, sandAir]],
  }),
  full({
    id: 'dembow-shimmy', name: 'Dembow Shimmy', tags: 'latin hiphop | full | shake', beats: 2, level: 'low', d: 2, parts: ['torso', 'arms'],
    desc: 'Arms bent up in front of the chest, shimmy the shoulders forward one at a time on the dembow rhythm with a small knee bounce.',
    keys: [[0, shim(1, -0.07)], [0.75, shim(-1, -0.05)], [1, shim(1, -0.07)], [1.5, shim(-1, -0.05)]],
  }),
];
