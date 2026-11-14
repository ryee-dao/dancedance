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
 * Themes are not a reason to leave a move out (owner's decision, Nov 2026):
 * the drill set has the finger-gun hand accents and the rifle spray that are
 * part of the style's real vocabulary. Dances usually named after a song or an
 * artist go in under a plain descriptive name (the common name is in a
 * comment). Reggaeton hip work stays upright.
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

// Drill strut: the New York drill "woo walk" (checked against video references, Nov 2026). A bouncy
// strut on the spot: drop onto one foot as the other flicks out on the forward diagonal and lands
// heel-first, toes up; one fist held up by the head (elbow out at shoulder height), the other hand
// at the belt buckle, a little hunched, nodding on every step. The flick goes out to the side as
// well as forward so it reads head-on.
const WOO_ARMS: PoseSpec = { r: at(1, 0.22, 1.0, 0.04, [1, -0.2, -0.2]), l: at(-1, -0.03, 0.5, 0.15, E_DOWN), ...FIST };
const strutA: PoseSpec = {
  y: -0.1, x: 0.02, hips: 0.025, tilt: 2, bend: 8, nod: 7, lean: 2, turn: -6, shR: 0.7, shL: 0.1,
  rf: [0.08, 0, 0], lf: [-0.21, 0.03, 0.09], kneeR: 0.12, kneeL: 0.04, pitchL: -24, ...WOO_ARMS,
};
const strutB: PoseSpec = {
  ...strutA, x: -0.02, hips: -0.025, tilt: -2, lean: -2, turn: 4,
  lf: [-0.08, 0, 0], rf: [0.21, 0.03, 0.09], kneeL: 0.12, kneeR: 0.04, pitchL: 0, pitchR: -24,
};
const strutMid: PoseSpec = {
  y: -0.04, x: 0, hips: 0, tilt: 0, bend: 5, nod: 0, lean: 0, turn: 0, shR: 0.5, shL: 0.2,
  rf: [0.08, 0, 0.01], lf: [-0.08, 0, 0.01], kneeL: 0.05, kneeR: 0.05, pitchL: 0, pitchR: 0,
  ...WOO_ARMS, r: at(1, 0.22, 0.95, 0.05, [1, -0.2, -0.2]),
};
// Before the other side: the raised fist drops to the chest so the arms can swap.
const strutSwap: PoseSpec = { ...strutMid, r: at(1, 0.1, 0.76, 0.18, E_OUT), l: at(-1, -0.1, 0.66, 0.17, E_OUT) };

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

// --- Added Nov 2026 ---------------------------------------------------------------
// Trap. Low rolling sway (the trap-era dance commonly called "the Quan"): knees bent and hunched,
// both loose arms swinging together from side to side, the body sinking and rolling with them.
const quanA: PoseSpec = {
  x: 0.03, y: -0.09, hips: 0.03, tilt: 4, lean: 5, bend: 11, nod: 7, head: 4, turn: 10, twist: 8, shR: 0.7, shL: 0.2,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.3, 0.6, 0.17, E_OUT), l: at(-1, 0.0, 0.62, 0.21, E_ACROSS), handR: 0.6, handL: 0.6,
};
const quanMid: PoseSpec = {
  x: 0, y: -0.06, hips: 0, tilt: 0, lean: 0, bend: 4, nod: 1, head: 0, turn: 0, twist: 0, shR: 0.4, shL: 0.4,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.06, kneeL: 0.06,
  r: at(1, 0.15, 0.67, 0.22, E_OUT), l: at(-1, -0.15, 0.67, 0.22, E_OUT), handR: 0.6, handL: 0.6,
};

// Stir the pot: one hand stirring circles in front of the waist, the other holding the rim, bouncing on every beat.
const stir = (k: number, y: number, nod: number): PoseSpec => {
  const a = (k * Math.PI) / 2;
  return {
    y, bend: 8, nod, lean: 3, head: -3, turn: -5, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.06, kneeL: 0.06,
    r: at(1, 0.07 + 0.065 * Math.cos(a), 0.56 + 0.02 * Math.sin(a), 0.25 + 0.05 * Math.sin(a), E_DOWN),
    l: at(-1, -0.08, 0.58, 0.25, E_OUT), handR: 0.3, handL: 0.2,
  };
};

// Drill. Finger guns: the index finger pointed, the hand otherwise closed.
const GUN_R = { handR: 0, formR: 'point' } as const;
const GUN_L = { handL: 0, formL: 'point' } as const;
// Finger-gun point: one hand pointed out at the camera on the drill bounce, kicking up a little on the "and".
const fgPoint: PoseSpec = {
  y: -0.08, bend: 7, nod: 8, turn: 6, lean: 2, shR: 0.6, shL: 0.2,
  rf: [0.11, 0, 0.01], lf: [-0.11, 0, 0], kneeR: 0.13, kneeL: 0.08, pitchL: 12,
  r: at(1, 0.2, 0.72, 0.27, [1, -0.3, -0.2]), l: at(-1, -0.1, 0.6, 0.16, E_OUT), ...GUN_R, handL: 0.1,
};
const fgUp: PoseSpec = { ...fgPoint, y: -0.05, nod: 1, shR: 0.3, pitchL: 0, kneeR: 0.05, kneeL: 0.05, r: at(1, 0.22, 0.83, 0.22, [1, -0.3, -0.2]) };

// Finger-gun hits: both hands snapped out together to one diagonal, recoiling up on the hats, then released.
const fgHit: PoseSpec = {
  y: -0.11, x: -0.01, lean: -4, twist: 12, turn: 18, nod: 4, shR: 0.5, shL: 0.5,
  rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.3, 0.78, 0.19, [1, -0.2, -0.2]), l: at(-1, 0.05, 0.78, 0.22, [0.5, -1, 0]), ...GUN_R, ...GUN_L,
};
const fgRecoil: PoseSpec = {
  ...fgHit, y: -0.08, nod: -5, shR: 0.9, shL: 0.9,
  r: at(1, 0.28, 0.88, 0.14, [1, -0.2, -0.2]), l: at(-1, 0.04, 0.88, 0.17, [0.5, -1, 0]),
};
const fgDown: PoseSpec = {
  y: -0.05, x: 0, lean: 0, twist: 0, turn: 4, nod: 2, shR: 0.3, shL: 0.3,
  rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.05, kneeL: 0.05,
  r: at(1, 0.18, 0.6, 0.16, E_OUT), l: at(-1, -0.16, 0.6, 0.16, E_OUT), ...GUN_R, ...GUN_L,
};

// Rifle spray: low and wide, an imaginary rifle held at the hip (rear hand) and out in front (front hand),
// swept across from one side to the other with a judder of recoil on every half beat.
const spray = (t: number, kick: number): PoseSpec => ({
  y: -0.1 + kick * 0.5, x: 0.01 * t, twist: 18 * t, turn: 10 * t, lean: -2 * t, bend: 6, nod: 6 - kick * 120, shR: 0.3 + kick * 12, shL: 0.3 + kick * 12,
  rf: [0.15, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.12, kneeL: 0.12,
  r: at(1, 0.16 + 0.03 * t, 0.56 + kick, 0.12, E_BACK), l: at(-1, -0.08 + 0.1 * t, 0.64 + kick, 0.25, [0.5, -1, 0]), ...FIST,
});

// R&B. The smooth two-step: step out to the side, then close, the body easing with it.
const ts2 = (out: boolean): PoseSpec => out
  ? { x: 0.045, y: -0.055, hips: 0.02, tilt: 2, rf: [0.22, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.06 }
  : { x: 0, y: -0.03, hips: 0, tilt: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0 };
const ARMS_SOFT: PoseSpec = { r: at(1, 0.2, 0.55, 0.1, E_OUT), l: at(-1, -0.2, 0.55, 0.1, E_OUT), handR: 0.6, handL: 0.6 };

// Slow drag: a long step out, the weight easing over, the other foot dragged in along the floor.
const dragArms = (lift: number): PoseSpec => ({
  r: at(1, 0.03, 0.74, 0.17, E_DOWN), l: at(-1, -0.27, 0.52 + lift, 0.1, E_OUT), handR: 1, handL: 0.8,
});

// Chest circle: the rib cage slides to one side, lifts, slides to the other side and drops, over still hips.
const chestCircle = (k: number): PoseSpec => {
  const a = (k * Math.PI) / 2;
  return {
    y: -0.05, chestX: 0.055 * Math.cos(a), bend: -8 * Math.sin(a), lean: 3 * Math.cos(a), nod: -4 * Math.sin(a), head: -3 * Math.cos(a),
    shR: 0.3 + 0.3 * Math.max(0, Math.sin(a)), shL: 0.3 + 0.3 * Math.max(0, Math.sin(a)),
    rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.06, kneeL: 0.06,
    r: at(1, 0.21, 0.6, 0.13, E_OUT), l: at(-1, -0.21, 0.6, 0.13, E_OUT), handR: 0.7, handL: 0.7,
  };
};

// Reggaeton. Chest pop on the dembow: the chest pops up and out with the elbows pulling back, then folds in.
const rgPop: PoseSpec = {
  y: -0.05, bend: -9, nod: -6, shR: 0.6, shL: 0.6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.04, kneeL: 0.04,
  r: at(1, 0.21, 0.6, -0.03, E_BACK), l: at(-1, -0.21, 0.6, -0.03, E_BACK), ...FIST,
};
const rgFold: PoseSpec = {
  y: -0.09, bend: 8, nod: 7, shR: 0.2, shL: 0.2, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.15, 0.62, 0.17, E_OUT), l: at(-1, -0.15, 0.62, 0.17, E_OUT), ...FIST,
};

// Dembow cross step: cross one foot in front on the beat, bounce on the "and", step it out with a hip pop, bounce again.
const rgCross: PoseSpec = {
  y: -0.09, x: -0.01, twist: -10, hips: -0.02, tilt: -2, nod: 4,
  rf: [-0.04, 0, 0.08], lf: [-0.1, 0, -0.01], kneeR: 0.12, kneeL: 0.1, pitchR: 10,
  r: at(1, -0.02, 0.66, 0.22, E_ACROSS), l: at(-1, -0.3, 0.62, 0.06, E_OUT), handR: 0.4, handL: 0.4,
};
const rgOut: PoseSpec = {
  y: -0.08, x: 0.04, twist: 6, hips: 0.045, tilt: 6, nod: 2, head: 4,
  rf: [0.21, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.06, kneeL: 0.12,
  r: at(1, 0.31, 0.66, 0.08, E_OUT), l: at(-1, -0.08, 0.66, 0.2, E_ACROSS), handR: 0.4, handL: 0.4,
};

// Dembow heel tap: the heel dug out on the diagonal as the hips pop the other way, fists pumping low.
const rgHeel = (tap: boolean, y: number): PoseSpec => ({
  y, hips: tap ? -0.035 : -0.01, tilt: tap ? -5 : -1, lean: tap ? 2 : 0, nod: tap ? 5 : 1,
  rf: tap ? [0.15, 0, 0.12] : [0.1, 0, 0.01], lf: [-0.1, 0, 0], pitchR: tap ? -22 : 0, kneeL: 0.08,
  r: at(1, 0.17, tap ? 0.58 : 0.66, 0.17, E_DOWN), l: at(-1, -0.17, tap ? 0.66 : 0.58, 0.17, E_DOWN), ...FIST,
});

// Dembow turn: bouncing on the dembow while turning slowly round on the spot.
const rgTurn = (spin: number, hit: boolean): PoseSpec => ({
  spin, y: hit ? -0.09 : -0.05, hips: hit ? 0.03 : -0.02, tilt: hit ? 4 : -2,
  rf: [0.07, 0, 0], lf: [-0.07, 0, 0], pitchR: 12, pitchL: 12, kneeR: hit ? 0.1 : 0.04, kneeL: hit ? 0.1 : 0.04,
  r: at(1, 0.17, hit ? 0.66 : 0.72, 0.18, E_DOWN), l: at(-1, -0.17, hit ? 0.72 : 0.66, 0.18, E_DOWN), ...FIST,
});

// --- Added from video references (tools/moves/reference.ts), Nov 2026 ------------------
// Trap. Flex & knee hit (the dance commonly called "Hit Dem Folks", Atlanta 2015): one fist
// flexed up beside the head, elbow high, the opposite knee snapping up with a crunch of the
// body toward it; the flexed forearm pumps down in front of the face between hits.
const flexHit: PoseSpec = {
  y: -0.06, x: 0.015, hips: 0.03, tilt: -4, lean: -9, bend: 7, head: -7, nod: 6, turn: -6, shR: 0.7, shL: 0,
  rf: [0.08, 0, 0], lf: [-0.1, 0.25, -0.02], kneeR: 0.08, kneeL: 0.2,
  r: at(1, 0.21, 1.05, 0.03, [1, -0.2, -0.2]), l: at(-1, -0.23, 0.5, 0.03, E_OUT), ...FIST,
};
const flexPump: PoseSpec = {
  y: -0.1, x: 0, hips: 0.01, tilt: 0, lean: -3, bend: 4, head: -2, nod: 3, turn: -2, shR: 0.3, shL: 0.1,
  rf: [0.08, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.0, 0.88, 0.2, E_OUT), l: at(-1, -0.22, 0.5, 0.04, E_OUT), ...FIST,
};

// Trap. Ear-to-chest sway (the step commonly called "the juju", from "Juju on That Beat"):
// knees dip on every beat as the body sways side to side, both bent arms swinging together
// on a diagonal, one hand up by its ear while the other crosses the chest, passing in front
// of the chest on the "and" as the knees straighten.
const jujuA: PoseSpec = {
  y: -0.1, x: -0.03, hips: -0.035, tilt: -4, lean: -6, head: -4, nod: 3, turn: -14, shR: 0.1, shL: 0.6,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.1, kneeL: 0.06,
  l: at(-1, -0.22, 0.98, 0.05, E_OUT), r: at(1, -0.1, 0.7, 0.2, E_ACROSS), handR: 0.5, handL: 0.5,
};
const jujuMid: PoseSpec = {
  y: -0.03, x: 0, hips: 0, tilt: 0, lean: 0, head: 0, nod: 0, turn: 0, shR: 0.3, shL: 0.3,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.03, kneeL: 0.03,
  l: at(-1, -0.06, 0.74, 0.22, E_OUT), r: at(1, 0.08, 0.68, 0.21, E_OUT), handR: 0.5, handL: 0.5,
};

// Trap. Crank lean & flying pose (the main step of "Crank That", with its "Superman"): sit back
// into one hip with the other knee bent in on its toe, fists together in front of the chest
// cranking from side to side with the hips, three cranks; palms together at the chest on the dip, then
// hop into the flying pose, the
// free knee lifted out to the side, one fist punched up and the other arm out.
const crank = (side: 1 | -1, y: number): PoseSpec => ({
  y, hips: 0.04, tilt: 5, lean: -4, bend: -3, twist: 12 * side, turn: 10 * side, nod: 2, head: 2,
  rf: [0.1, 0, 0], lf: [-0.035, 0, 0.03], kneeR: 0.1, kneeL: -0.45, pitchL: 26,
  r: at(1, side > 0 ? 0.32 : -0.08, 0.74, side > 0 ? 0.14 : 0.22, E_DOWN),
  l: at(-1, side > 0 ? 0.08 : -0.32, 0.74, side > 0 ? 0.22 : 0.14, E_DOWN), ...FIST,
});
const crankDip: PoseSpec = {
  y: -0.13, hips: 0, tilt: 0, lean: 0, bend: 8, twist: 0, turn: 0, nod: 6, head: 0,
  rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.12, kneeL: 0.12, pitchL: 0,
  r: at(1, 0.03, 0.82, 0.2, E_DOWN), l: at(-1, -0.03, 0.82, 0.2, E_DOWN), ...OPEN,
};
const flying: PoseSpec = {
  y: 0.05, hips: -0.02, tilt: -6, lean: 7, bend: 3, twist: 0, turn: -10, nod: -6, head: 5,
  rf: [0.07, 0.03, 0], lf: [-0.2, 0.2, 0.05], kneeR: 0.05, kneeL: 0.5, pitchL: 0,
  r: at(1, 0.2, 1.08, 0.02, [1, -0.2, -0.2]), l: at(-1, -0.42, 0.78, 0.05, E_OUT), handR: 0, handL: 1,
};
const flyingLand: PoseSpec = {
  ...flying, y: -0.08, rf: [0.07, 0, 0], lf: [-0.15, 0.1, 0.04], kneeL: 0.3, lean: 4, nod: -2, turn: -5,
  r: at(1, 0.2, 0.96, 0.08, [1, -0.2, -0.2]), l: at(-1, -0.32, 0.72, 0.08, E_OUT),
};

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
  // The trap-era dance commonly called "the Quan" (named after an artist): descriptive name.
  full({
    id: 'low-rolling-sway', name: 'Low Rolling Sway', tags: 'hiphop | full | wave', beats: 4, level: 'low', d: 1, parts: ['arms', 'torso', 'legs'],
    desc: 'Knees bent and a little hunched, swing both loose arms together out to one side as the body sinks and rolls over that way, rise through the middle, then swing and sink to the other side.',
    keys: [[0, quanA], [1, quanMid], [2, mir(quanA)], [3, quanMid]],
  }),
  full({
    id: 'stir-the-pot', name: 'Stir the Pot', tags: 'hiphop | arms | hands', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Bouncing on the knees and looking down into it, one hand stirs a big pot in front of the waist, round once every two beats, while the other hand holds the rim; switch hands.',
    keys: [[0, stir(0, -0.08, 10)], [0.5, stir(1, -0.05, 6)], [1, stir(2, -0.08, 10)], [1.5, stir(3, -0.05, 6)]],
  }),
  // Commonly called "Hit Dem Folks" (named after a phrase from one scene): descriptive name.
  full({
    id: 'flex-knee-hit', name: 'Flex & Knee Hit', tags: 'hiphop | full |', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true,
    desc: 'Flex one fist up beside the head with the elbow high and snap the opposite knee up on the beat, crunching the body toward it; pump the forearm down in front of the face as the foot lands, then hit again; switch sides.',
    keys: [[0, flexHit], [0.5, flexPump], [1, flexHit], [1.5, flexPump]],
  }),
  // The step commonly called "the juju" (from the song "Juju on That Beat"): descriptive name.
  full({
    id: 'ear-chest-sway', name: 'Ear-to-Chest Sway', tags: 'hiphop | arms full |', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'],
    desc: 'Dip the knees and sway to one side on every beat, both bent arms swinging together on a diagonal so one hand ends by its ear and the other across the chest; straighten through the middle with the hands passing in front, then sway to the other side.',
    keys: [[0, jujuA], [0.5, jujuMid], [1, mir(jujuA)], [1.5, jujuMid]],
  }),
  // The main step of "Crank That" with its "Superman" pose (named after a song): descriptive name.
  full({
    id: 'crank-flying-pose', name: 'Crank Lean & Flying Pose', tags: 'hiphop | full | jump', beats: 4, level: 'high', d: 3, parts: ['arms', 'hips', 'jump'], mirror: true, jump: true,
    desc: 'Sit back into one hip with the other knee bent in on its toe and crank both fists from side to side in front of the chest with the hips, three times; dip, then hop into a flying pose with the free knee lifted out to the side, one fist punched up and the other arm out.',
    keys: [
      [0, crank(-1, -0.08)], [0.5, crank(1, -0.06)], [1, crank(-1, -0.08)], [1.5, crank(1, -0.06)], [2, crank(-1, -0.09)],
      [2.5, crankDip], [3, flying], [3.5, flyingLand],
    ],
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
    id: 'drill-strut', name: 'Drill Strut', tags: 'hiphop | full | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true,
    desc: 'Bouncy strut on the spot (the "woo walk"): drop onto one foot as the other flicks out on the diagonal and lands heel-first, toes up, then the other foot; one fist held up by the head and the other hand at the belt buckle, nodding on every step.',
    keys: [[0, strutA], [0.5, strutMid], [1, strutB], [1.5, strutSwap]],
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
  full({
    id: 'finger-gun-point', name: 'Finger-Gun Point', tags: 'hiphop | arms | point', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'On the drill bounce, point one finger gun out at the camera, dropping into the knees on every beat and letting the hand kick up a little on the "and", the other fist at the waist; switch hands.',
    keys: [[0, fgPoint], [0.5, fgUp], [1, fgPoint], [1.5, fgUp]],
  }),
  full({
    id: 'finger-gun-hits', name: 'Finger-Gun Hits', tags: 'hiphop | arms full | point', beats: 4, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Snap both finger guns out together to one diagonal as the knees drop and the body turns after them, kick them up on the "and", snap them out again and kick again, then drop them and reset for the other side.',
    keys: [[0, fgHit], [0.5, fgRecoil], [1, fgHit], [1.5, fgRecoil], [2, { ...fgRecoil, y: -0.07, nod: -2 }], [3, fgDown]],
  }),
  full({
    id: 'rifle-spray', name: 'Rifle Spray', tags: 'hiphop | arms full |', beats: 4, level: 'mid', d: 2, parts: ['arms', 'torso'], mirror: true,
    desc: 'Low and wide, hold an imaginary rifle with the back hand at the hip and the front hand out in front, and sweep it across from one side to the other with a judder of recoil on every half beat; switch shoulders and sweep back.',
    keys: [[0, spray(1, 0)], [0.5, spray(0.65, 0.03)], [1, spray(0.3, 0)], [1.5, spray(-0.05, 0.03)], [2, spray(-0.4, 0)], [2.5, spray(-0.75, 0.03)], [3, spray(-1, 0)]],
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
  full({
    id: 'shoulder-roll-two-step', name: 'Shoulder-Roll Two-Step', tags: 'hiphop funk | legs full | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], mirror: true,
    desc: 'Smooth two-step: step out to the side and roll that shoulder up and back as you step, arms hanging soft, then close the feet and let the shoulder settle; then the other side.',
    keys: [
      [0, { ...ts2(true), lean: -3, turn: 10, head: 4, twist: -7, shR: 1.1, shL: 0.1, ...ARMS_SOFT }],
      [0.5, { ...ts2(true), y: -0.045, lean: -2, turn: 8, head: 3, twist: 7, shR: 0.8, shL: 0.1, ...ARMS_SOFT, r: at(1, 0.22, 0.54, 0.03, E_BACK) }],
      [1, { ...ts2(false), lean: 0, turn: 0, head: 0, twist: 0, shR: 0.15, shL: 0.15, ...ARMS_SOFT }],
      [1.5, { ...ts2(false), y: -0.05, lean: 0, turn: 0, head: 0, twist: 0, shR: 0.2, shL: 0.2, ...ARMS_SOFT }],
    ],
  }),
  full({
    id: 'knee-pop-two-step', name: 'Knee-Pop Two-Step', tags: 'hiphop funk | legs | walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'], mirror: true,
    desc: 'Step out to the side, then bring that foot back in onto its toes with the knee popping in and the hip pushing out over the standing leg, the shoulder dipping with it; release the knee and step out the other way.',
    keys: [
      [0, { ...ts2(true), lean: -2, turn: 8, ...ARMS_SOFT }],
      [0.5, { ...ts2(true), y: -0.045, lean: -1, turn: 6, ...ARMS_SOFT }],
      [1, { x: -0.015, y: -0.07, hips: -0.045, tilt: -6, lean: 4, head: -5, turn: -4, shR: 0.9, shL: 0, rf: [0.07, 0, 0.02], lf: [-0.09, 0, 0], kneeR: -0.55, pitchR: 28, kneeL: 0.06, ...ARMS_SOFT, r: at(1, 0.18, 0.5, 0.1, E_OUT) }],
      [1.5, { x: -0.01, y: -0.04, hips: -0.02, tilt: -2, lean: 1, head: -2, turn: -2, shR: 0.3, shL: 0.1, rf: [0.08, 0, 0.01], lf: [-0.09, 0, 0], kneeR: -0.1, pitchR: 10, ...ARMS_SOFT }],
    ],
  }),
  full({
    id: 'hand-slide-sway', name: 'Hand-Slide Sway', tags: 'hiphop pop | hips arms | hips', beats: 4, level: 'low', d: 1, parts: ['hips', 'arms'],
    desc: 'Push the hip out to one side over two beats as that hand slides slowly down from the chest along the side to the hip, the head tipping away; then the other hip and the other hand.',
    keys: [
      [0, { y: -0.05, x: 0.01, hips: 0.01, tilt: 1, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: at(1, 0.05, 0.76, 0.16, E_DOWN), l: at(-1, -0.2, 0.55, 0.08, E_OUT), handR: 1, handL: 0.7 }],
      [1, { y: -0.07, x: 0.035, hips: 0.06, tilt: 8, lean: -4, head: -7, rf: [0.12, 0, 0], lf: [-0.12, 0.015, 0.01], kneeL: 0.1, r: at(1, 0.17, 0.56, 0.1, E_DOWN), l: at(-1, -0.2, 0.55, 0.08, E_OUT), handR: 1, handL: 0.7 }],
      [2, { y: -0.05, x: -0.01, hips: -0.01, tilt: -1, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], l: at(-1, -0.05, 0.76, 0.16, E_DOWN), r: at(1, 0.2, 0.55, 0.08, E_OUT), handL: 1, handR: 0.7 }],
      [3, { y: -0.07, x: -0.035, hips: -0.06, tilt: -8, lean: 4, head: 7, lf: [-0.12, 0, 0], rf: [0.12, 0.015, 0.01], kneeR: 0.1, l: at(-1, -0.17, 0.56, 0.1, E_DOWN), r: at(1, 0.2, 0.55, 0.08, E_OUT), handL: 1, handR: 0.7 }],
    ],
  }),
  full({
    id: 'hand-glide-two-step', name: 'Hand-Glide Two-Step', tags: 'hiphop funk | legs arms | walk hands', beats: 2, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true,
    desc: 'Two-step side to side while one flat palm glides out at chest height toward the step and back across in front of you, as if smoothing a tabletop, the other hand resting on the belly; the eyes follow the hand.',
    keys: [
      [0, { ...ts2(true), turn: 12, head: 3, r: at(1, 0.31, 0.7, 0.17, E_OUT), l: at(-1, -0.02, 0.6, 0.17, E_DOWN), handR: 1, handL: 1 }],
      [0.5, { ...ts2(true), y: -0.045, turn: 16, head: 4, r: at(1, 0.37, 0.71, 0.13, E_OUT), l: at(-1, -0.02, 0.6, 0.17, E_DOWN), handR: 1, handL: 1 }],
      [1, { ...ts2(false), turn: -2, head: 0, r: at(1, 0.06, 0.71, 0.24, E_ACROSS), l: at(-1, -0.02, 0.6, 0.17, E_DOWN), handR: 1, handL: 1 }],
      [1.5, { ...ts2(false), y: -0.05, turn: 2, head: 0, r: at(1, 0.15, 0.7, 0.24, E_OUT), l: at(-1, -0.02, 0.6, 0.17, E_DOWN), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'slow-drag', name: 'Slow Drag', tags: 'hiphop funk | legs hips | walk hips', beats: 4, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true, travel: 0.13,
    desc: 'Take a long step out to the side and ease the weight and hips over onto it, then drag the other foot in slowly along the floor to meet it over two beats, one hand on the chest and the head tipping with the sway; then the other way.',
    keys: [
      [0, { x: 0.055, y: -0.07, hips: 0.03, tilt: 4, lean: -4, head: 6, rf: [0.22, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.08, ...dragArms(0) }],
      [1, { x: 0.09, y: -0.075, hips: 0.045, tilt: 6, lean: -5, head: 8, rf: [0.22, 0, 0], lf: [-0.05, 0, 0], slideL: true, kneeR: 0.1, pitchL: 10, ...dragArms(0.02) }],
      [2, { x: 0.115, y: -0.06, hips: 0.03, tilt: 4, lean: -3, head: 5, rf: [0.22, 0, 0], lf: [0.0, 0, 0], slideL: true, kneeR: 0.07, pitchL: 18, ...dragArms(0.03) }],
      [3, { x: 0.13, y: -0.04, hips: 0.01, tilt: 1, lean: 0, head: 1, rf: [0.22, 0, 0], lf: [0.04, 0, 0], kneeR: 0.03, pitchL: 20, ...dragArms(0.01) }],
    ],
  }),
  full({
    id: 'chest-circle', name: 'Chest Circle', tags: 'hiphop funk | full |', beats: 2, level: 'mid', d: 2, parts: ['torso'],
    desc: 'Hips still and knees soft, circle the rib cage: slide it to one side, lift it up and out, slide it to the other side, and drop it, one smooth circle every two beats.',
    keys: [[0, chestCircle(0)], [0.5, chestCircle(1)], [1, chestCircle(2)], [1.5, chestCircle(3)]],
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
    id: 'dembow-shimmy', name: 'Dembow Shimmy', tags: 'latin hiphop | full | shake', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'],
    desc: 'Arms bent up in front of the chest, shimmy the shoulders forward one at a time on the dembow rhythm with a small knee bounce.',
    keys: [[0, shim(1, -0.07)], [0.75, shim(-1, -0.05)], [1, shim(1, -0.07)], [1.5, shim(-1, -0.05)]],
  }),
  full({
    id: 'dembow-chest-pop', name: 'Dembow Chest Pop', tags: 'latin hiphop | full |', beats: 2, level: 'mid', d: 2, parts: ['torso', 'arms'],
    desc: 'Feet apart, pop the chest up and out with the elbows pulling back on the beat, fold it in on the "a", pop again on the next beat and fold on the "and": the dembow rhythm in the chest.',
    keys: [[0, rgPop], [0.75, rgFold], [1, { ...rgPop, y: -0.06 }], [1.5, rgFold]],
  }),
  full({
    id: 'dembow-cross-step', name: 'Dembow Cross Step', tags: 'latin hiphop | legs hips | walk hips', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips', 'arms'], mirror: true,
    desc: 'Cross one foot in front of the other on the beat with the arms swinging across, bounce on the "and", step it out to the side on the next beat with a hip pop and the arms opening, bounce again; then cross the other foot.',
    keys: [
      [0, rgCross], [0.5, { ...rgCross, y: -0.06 }], [1, rgOut],
      [1.5, { ...rgOut, y: -0.05, x: 0.02, hips: 0.02, tilt: 2, twist: 0, rf: [0.15, 0, 0], r: at(1, 0.2, 0.64, 0.14, E_OUT), l: at(-1, -0.18, 0.64, 0.14, E_OUT) }],
    ],
  }),
  full({
    id: 'dembow-heel-tap', name: 'Dembow Heel Tap', tags: 'latin hiphop | legs hips | hips', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true,
    desc: 'Dig one heel out on the diagonal on the beat as the hips pop the other way, bring it in on the "a", dig it again on the next beat and bring it in on the "and", fists pumping low; then the other heel.',
    keys: [[0, rgHeel(true, -0.07)], [0.75, rgHeel(false, -0.05)], [1, rgHeel(true, -0.07)], [1.5, rgHeel(false, -0.05)]],
  }),
  full({
    id: 'dembow-turn', name: 'Dembow Turn', tags: 'latin hiphop | turn hips | spin hips', beats: 4, level: 'mid', d: 2, parts: ['turn', 'hips', 'legs'], mirror: true,
    desc: 'Keep the dembow bounce going, a hip pop on every beat and a lift on the "and", fists pumping low, while turning slowly all the way round on the balls of the feet over four beats.',
    keys: [0, 1, 2, 3].flatMap((b) => [[b, rgTurn(b * 90, true)], [b + 0.5, rgTurn(b * 90 + 45, false)]] as const),
  }),
];
