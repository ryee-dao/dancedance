/**
 * Partner (two-player-only) moves. Pure TypeScript (no DOM).
 *
 * A partner move is two synchronized full-body tracks (P1 = the LEFT figure,
 * P2 = the RIGHT figure) plus a depth track (who passes in front) and the
 * contact points that must line up (hands meeting, linked elbows). Kept in
 * its own registry (NOT families/index.ts), so these moves never enter the
 * single-player pool.
 *
 * Coordinates: the duo stage stands P1's root at x = -DUO_HOME / 2 and P2's
 * at +DUO_HOME / 2 (figure units). Each player's pose keys its own root `x`,
 * so "step in toward your partner" is P1 x > 0, P2 x < 0, and every step is
 * a real foot step (the animator arcs the feet). Front-facing figures stage
 * contact side by side: P1's inner hand is its RIGHT hand (screen right),
 * P2's inner hand is its LEFT hand. Symmetric moves author P1 only; P2 is
 * its mirror image. Orbiting moves (elbow swing) turn both bodies with
 * `spin` while the roots travel round the pair's centre, so the linked
 * joints stay together (a rigid rotation); the stage derives the depth from
 * the spin.
 *
 * Moves longer than 4 beats are split into 4-beat halves (the animator
 * plays them back to back; tracks interpolate across the boundary).
 */

import { at, mir, type PoseSpec } from './poseKit';
import { ARM } from '../coach/poses';
import { J } from '../coach/skeleton';
import { buildFull, type BodyPart, type Difficulty, type Level, type Move } from './catalog';
import type { Family, Focus, Theme } from './families';

/** Distance between the two players' home spots (figure units). */
export const DUO_HOME = 1.0;
const H = DUO_HOME / 2;

export type Player = 1 | 2;

export interface Contact {
  /** Move beat (within the partner move) where the joints meet. */
  at: number;
  /** [player, joint index (skeleton J)] of each side. */
  a: readonly [Player, number];
  b: readonly [Player, number];
  /** Allowed distance (figure units); default 0.07. */
  tol?: number;
}

export interface PartnerMove {
  id: string;
  name: string;
  desc: string;
  beats: 4 | 8;
  level: Level;
  difficulty: Difficulty;
  families: readonly Family[];
  focus: readonly Focus[];
  themes: readonly Theme[];
  jump: boolean;
  impact: boolean;
  /** One Move per 4 beats, per player. */
  p1: readonly Move[];
  p2: readonly Move[];
  /** Depth offsets [at, z1, z2] (toward the viewer), looping; empty = side by side. */
  depth: readonly (readonly [number, number, number])[];
  /** Orbit radius (depth from spin), 0 = none. */
  orbit: number;
  contacts: readonly Contact[];
  /** The roles differ (P1 and P2 get their own cue names). */
  roles: boolean;
  /** A prop drawn between the players (rope: P1's left hand to P2's right hand). */
  prop: 'rope' | null;
}

type Keys = (readonly [number, PoseSpec])[];

interface PartnerDef {
  id: string;
  name: string;
  desc: string;
  tags: string;
  level: Level;
  d: Difficulty;
  beats: 4 | 8;
  parts: readonly BodyPart[];
  jump?: boolean;
  impact?: boolean;
  p1: Keys;
  /** Explicit P2 keys; default = mirror of P1. */
  p2?: Keys;
  /** Cue names when the roles differ: [P1 first half, P2 first half, P1 second half, P2 second half]. */
  cues?: readonly [string, string, string?, string?];
  depth?: readonly (readonly [number, number, number])[];
  orbit?: number;
  prop?: 'rope';
  contacts?: readonly Contact[];
}

// ---------------------------------------------------------------------------
// Authoring helpers

/** P1's hand reaching a pair-space point (cx = 0 is the middle between the players). */
function h1(side: 1 | -1, X: number, Y: number, cx: number, cy: number, cz: number, elbow?: readonly [number, number, number]) {
  return at(side, cx + H - X, cy - Y, cz, elbow);
}

/** Feet under a root at x = X (wide = half-width). */
function feet(X: number, w = 0.1, liftR = 0, liftL = 0): PoseSpec {
  return { rf: [X + w, liftR, 0], lf: [X - w, liftL, 0] };
}

/** Inner hands: P1 right ↔ P2 left. */
const HANDS = (at: number, tol?: number): Contact => ({ at, a: [1, J.HA_R], b: [2, J.HA_L], ...(tol ? { tol } : {}) });

const IN = 0.25; // standard step-in (roots 0.5 apart)

// ---------------------------------------------------------------------------
// Definitions

function orbitKeys(r: number, dir: 1 | -1, arms: (th: number) => PoseSpec, beats = 8): { p1: Keys; p2: Keys } {
  const p1: Keys = [];
  const p2: Keys = [];
  const n = beats * 2;
  for (let i = 0; i < n; i++) {
    const at = i / 2;
    const th = (dir * 360 * i) / n;
    const rad = (th * Math.PI) / 180;
    const X1 = H - r * Math.cos(rad);
    const X2 = r * Math.cos(rad) - H;
    const lift = i % 2 === 1 ? 0.03 : 0;
    const a = arms(th);
    p1.push([at, { ...a, x: X1, y: -0.04, spin: th, rf: [X1 + 0.06, i % 4 === 1 ? lift : 0, 0], lf: [X1 - 0.06, i % 4 === 3 ? lift : 0, 0] }]);
    const m = mir(a);
    p2.push([at, { ...m, x: X2, y: -0.04, spin: th, rf: [X2 + 0.06, i % 4 === 3 ? lift : 0, 0], lf: [X2 - 0.06, i % 4 === 1 ? lift : 0, 0] }]);
  }
  return { p1, p2 };
}

const ELBOW_R = 0.25;
const elbowArms = (): PoseSpec => ({
  r: h1(1, H - ELBOW_R, -0.04, 0.035, 0.74, 0.13, [0.15, -1, -0.15]),
  l: ARM.hip,
  handR: 0.2,
  handL: 0,
  lean: 0,
});
const elbowSwing = orbitKeys(ELBOW_R, 1, elbowArms);

const TURN_R = 0.26;
const starArms = (): PoseSpec => ({
  r: h1(1, H - TURN_R, -0.04, 0, 1.0, 0.04, [0.6, 0, -0.6]),
  l: [60, 10, 70, 30],
  handR: 1,
  handL: 1,
});
const starTurn = orbitKeys(TURN_R, -1, starArms);

// Under-arm turn: the turner's hand stays over its own head; the arch-maker reaches over.
const ARCH_X1 = 0.36; // arch-maker step-in
const TURN_X2 = -0.36; // turner step-in (P2 coordinates)
const archTop = { cx: H + TURN_X2 - 0.03, cy: 1.0 };
function underArm(): { p1: Keys; p2: Keys } {
  const p1: Keys = [];
  const p2: Keys = [];
  // First half: P2 turns under P1's raised right hand.
  const arch = (X: number): PoseSpec => ({ x: X, y: -0.03, ...feet(X, 0.1), r: h1(1, X, -0.03, archTop.cx, archTop.cy, 0, [0.7, 0.2, -0.5]), l: ARM.hip, handR: 1, handL: 0, lean: 6 });
  const turnSpin = [0, 45, 90, 135, 180, 225, 270, 315];
  for (let i = 0; i < 8; i++) {
    const at = i / 2;
    const s = turnSpin[i];
    p1.push([at, arch(ARCH_X1)]);
    p2.push([at, { x: TURN_X2, y: -0.03, spin: s, rf: [TURN_X2 + 0.055, i % 2 ? 0.03 : 0, 0], lf: [TURN_X2 - 0.055, 0, 0], l: at2(-1, TURN_X2, archTop.cy + 0.03), r: [40, 10, 50, 20], handL: 1, handR: 1 }]);
  }
  // Second half: P1 turns under P2's raised left hand (mirror roles).
  for (let i = 0; i < 8; i++) {
    const at = 4 + i / 2;
    const s = turnSpin[i];
    const a = arch(ARCH_X1);
    p2.push([at, mir(a)]);
    const t: PoseSpec = { x: TURN_X2, y: -0.03, spin: s, rf: [TURN_X2 + 0.055, i % 2 ? 0.03 : 0, 0], lf: [TURN_X2 - 0.055, 0, 0], l: at2(-1, TURN_X2, archTop.cy + 0.03), r: [40, 10, 50, 20], handL: 1, handR: 1 };
    const m = mir(t);
    p1.push([at, { ...m, spin: s }]);
  }
  return { p1, p2 };
}
/** A hand straight over its own root (local), at height y. */
function at2(side: 1 | -1, _X: number, y: number) {
  return at(side, side * 0.03, y, 0, [0.7, 0.2, -0.5]);
}
const underArmKeys = underArm();

// See-saw: hands joined at the average height.
function seeSaw(): { p1: Keys; p2: Keys } {
  const X = 0.2;
  const ys1 = [-0.17, -0.09, 0, -0.09];
  const p1: Keys = [];
  const p2: Keys = [];
  for (let i = 0; i < 4; i++) {
    const y1 = ys1[i], y2 = ys1[(i + 2) % 4];
    const cy = 0.64 + (y1 + y2) / 2;
    const k1: PoseSpec = { x: X, y: y1, ...feet(X, 0.12), r: h1(1, X, y1, 0, cy, 0.1, [0.4, -1, -0.2]), l: y1 < -0.1 ? [70, 40, 80, 60] : [30, 10, 40, 30], handR: 0.6, handL: 1, bend: y1 < -0.1 ? 8 : 0 };
    const k2: PoseSpec = { x: X, y: y2, ...feet(X, 0.12), r: h1(1, X, y2, 0, cy, 0.1, [0.4, -1, -0.2]), l: y2 < -0.1 ? [70, 40, 80, 60] : [30, 10, 40, 30], handR: 0.6, handL: 1, bend: y2 < -0.1 ? 8 : 0 };
    p1.push([i, k1]);
    p2.push([i, mir(k2)]);
  }
  return { p1, p2 };
}
const seeSawKeys = seeSaw();

// Promenade: side by side, inner hands joined, both step the same way.
function promenade(): { p1: Keys; p2: Keys } {
  const shifts = [0.1, 0.1, -0.1, -0.1];
  const lifts: [number, number][] = [[0, 0], [0, 0.03], [0, 0], [0.03, 0]];
  const p1: Keys = [];
  const p2: Keys = [];
  for (let i = 0; i < 4; i++) {
    const s = shifts[i];
    const X1 = IN + s, X2 = -IN + s;
    const touch = i % 2 === 1;
    const swing: PoseSpec['l'] = i % 2 === 0 ? ARM.swingFwd : ARM.swingBack;
    p1.push([i, { x: X1, y: touch ? -0.02 : -0.05, rf: [X1 + (touch && s < 0 ? 0.03 : 0.09), lifts[i][0], 0], lf: [X1 - (touch && s > 0 ? 0.03 : 0.09), lifts[i][1], 0], r: h1(1, X1, -0.04, s, 0.6, 0.12), l: swing, handR: 0.5, handL: 0.5, head: s > 0 ? 4 : -4 }]);
    const m = mir({ r: h1(1, -X2, -0.04, -s, 0.6, 0.12), l: swing, handR: 0.5, handL: 0.5 });
    p2.push([i, { ...m, x: X2, y: touch ? -0.02 : -0.05, rf: [X2 + (touch && s < 0 ? 0.03 : 0.09), lifts[i][0], 0], lf: [X2 - (touch && s > 0 ? 0.03 : 0.09), lifts[i][1], 0], head: s > 0 ? 4 : -4 }]);
  }
  return { p1, p2 };
}
const promenadeKeys = promenade();

// Sweetheart sway: arms round each other's shoulders, swaying together.
function sweetheart(): { p1: Keys; p2: Keys } {
  const X = 0.3;
  const sway = [0.035, 0, -0.035, 0];
  const p1: Keys = [];
  const p2: Keys = [];
  for (let i = 0; i < 4; i++) {
    const s = sway[i];
    const X1 = X + s, X2 = -X + s;
    const lean = s > 0 ? 5 : s < 0 ? -5 : 0;
    const up = i === 0 ? [160, 10, 168, 10] as const : i === 2 ? [150, -10, 150, -20] as const : [156, 0, 160, 0] as const;
    // P1's right hand on P2's near (left) shoulder (pair-space x of P2's root is H + X2), and vice versa.
    const cx1 = H + X2 - 0.125 + 0.02;
    const cx2 = -H + X1 + 0.125 - 0.02;
    p1.push([i, { x: X1, y: -0.04, ...feet(X1, 0.09), r: h1(1, X1, -0.04, cx1, 0.8, -0.03, [0.5, 0.4, -0.6]), l: [up[0], up[1], up[2], up[3]], handR: 0.8, handL: 1, lean: lean * 0.6, tilt: s * 120, hips: s * 0.6 }]);
    // P2: left hand on P1's near (right) shoulder; outer (right) arm up.
    p2.push([i, { x: X2, y: -0.04, ...feet(X2, 0.09), l: at(-1, cx2 - H - X2, 0.84, -0.03, [0.5, 0.4, -0.6]), r: [up[0], -up[1], up[2], -up[3]], handL: 0.8, handR: 1, lean: lean * 0.6, tilt: s * 120, hips: s * 0.6 }]);
  }
  return { p1, p2 };
}
const sweetheartKeys = sweetheart();

// Do-si-do / cross over: pass each other (P1 in front going over, behind coming back).
function pass(beats: 4 | 8, arms: (i: number) => PoseSpec): { p1: Keys; p2: Keys } {
  const p1: Keys = [];
  const p2: Keys = [];
  const n = beats;
  for (let i = 0; i < n; i++) {
    const u = i / n; // 0..1 around the loop
    const X1 = DUO_HOME * (u <= 0.5 ? u * 2 : 2 - u * 2);
    const step = i % 2 === 0;
    const a = arms(i);
    p1.push([i, { ...a, x: X1, y: step ? -0.05 : -0.02, rf: [X1 + 0.08, step ? 0 : 0.035, 0], lf: [X1 - 0.08, step ? 0.035 : 0, 0] }]);
    const m = mir(a);
    p2.push([i, { ...m, x: -X1, y: step ? -0.05 : -0.02, rf: [-X1 + 0.08, step ? 0.035 : 0, 0], lf: [-X1 - 0.08, step ? 0 : 0.035, 0] }]);
  }
  return { p1, p2 };
}
const FOLD: PoseSpec = { r: at(1, -0.07, 0.68, 0.17, [0.6, -0.6, -0.2]), l: at(-1, 0.07, 0.72, 0.19, [0.6, -0.6, -0.2]), handR: 0, handL: 0 };
const doSiDo = pass(8, (i) => ({ ...FOLD, head: i < 4 ? 6 : -6, turn: i < 4 ? 14 : -14 }));
const crossOver = pass(4, (i) => (i === 2 || i === 0 ? { r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 } : { r: [60, -20, 70, 0], l: [60, -20, 70, 0], handR: 1, handL: 1 }));

// Role moves: P1 does `a` while P2 does `b`, then they swap (beats 4..8).
function swapRoles(a: Keys, b: Keys): { p1: Keys; p2: Keys } {
  return {
    p1: [...a, ...b.map(([t, s]) => [t + 4, s] as const)],
    p2: [...b.map(([t, s]) => [t, mir(s)] as const), ...a.map(([t, s]) => [t + 4, mir(s)] as const)],
  };
}

// Boxing: P1 jabs its right (inner) fist into P2's held left pad.
const BOX_X = 0.12;
const PAD = { cx: 0.02, cy: 0.8 };
const punchKeys: Keys = [
  [0, { x: BOX_X, y: -0.06, ...feet(BOX_X, 0.12), r: h1(1, BOX_X, -0.06, PAD.cx - 0.03, PAD.cy, 0.1, [0.3, -1, 0]), l: ARM.guard, ...{ handR: 0, handL: 0 }, twist: 12, lean: 3 }],
  [0.5, { x: BOX_X, y: -0.04, ...feet(BOX_X, 0.12), r: ARM.guard, l: ARM.guard, handR: 0, handL: 0, twist: -4 }],
  [1, { x: BOX_X, y: -0.06, ...feet(BOX_X, 0.12), r: h1(1, BOX_X, -0.06, PAD.cx - 0.03, PAD.cy, 0.1, [0.3, -1, 0]), l: ARM.guard, handR: 0, handL: 0, twist: 12, lean: 3 }],
  [2, { x: BOX_X, y: -0.05, ...feet(BOX_X, 0.12), r: ARM.guard, l: ARM.guard, handR: 0, handL: 0, twist: -10 }],
  [3, { x: BOX_X, y: -0.03, ...feet(BOX_X, 0.12, 0.03), r: ARM.guard, l: ARM.guard, handR: 0, handL: 0 }],
];
// The pad holder (authored as P1 = left player; P2 gets the mirror): open right palm toward the partner.
const padX = -BOX_X;
const padSide = (pad: boolean, y: number): PoseSpec => ({
  x: padX + 0.24, y, ...feet(padX + 0.24, 0.12),
  r: pad ? h1(1, padX + 0.24, y, -(PAD.cx - 0.03) - 0.02, PAD.cy, 0.1, [0.6, -0.6, -0.3]) : at(1, 0.16, 0.86, 0.12, [0.6, -0.6, -0.3]),
  l: at(-1, -0.14, 0.86, 0.12, [0.6, -0.6, -0.3]), handR: 1, handL: 1, lean: pad ? -3 : 0,
});
const padKeys: Keys = [[0, padSide(true, -0.06)], [0.5, padSide(true, -0.04)], [1, padSide(true, -0.06)], [2, padSide(false, -0.05)], [3, padSide(false, -0.03)]];
const boxing = swapRoles(punchKeys, padKeys);

// Guitar duel: one shreds toward the partner, the other cheers them on.
const shredKeys: Keys = [
  [0, { x: 0.12, y: -0.12, rf: [0.3, 0, 0.05], lf: [-0.04, 0, 0], r: at(1, 0.06, 0.58, 0.16), l: at(-1, -0.4, 0.86, 0.12, [0.2, -1, 0]), handR: 0, handL: 0, spin: 22, lean: -6, nod: 12 }],
  [1, { x: 0.12, y: -0.08, rf: [0.3, 0, 0.05], lf: [-0.04, 0, 0], r: at(1, 0.1, 0.47, 0.18), l: at(-1, -0.4, 0.9, 0.12, [0.2, -1, 0]), handR: 0, handL: 0, spin: 22, lean: -8, nod: -6 }],
  [2, { x: 0.12, y: -0.12, rf: [0.3, 0, 0.05], lf: [-0.04, 0, 0], r: at(1, 0.06, 0.58, 0.16), l: at(-1, -0.4, 0.86, 0.12, [0.2, -1, 0]), handR: 0, handL: 0, spin: 22, lean: -6, nod: 12 }],
  [3, { x: 0.12, y: -0.06, rf: [0.3, 0, 0.05], lf: [-0.04, 0, 0], r: ARM.sky, l: at(-1, -0.4, 0.92, 0.12, [0.2, -1, 0]), handR: 0, handL: 0, spin: 22, lean: -4, nod: -4 }],
];
const cheerKeys: Keys = [
  [0, { x: -0.04, y: -0.04, ...feet(-0.04, 0.1), r: [150, 10, 160, 10], l: at(-1, -0.19, 0.98, 0.05, [1, 0.2, -0.2]), handR: 1, handL: 1, lean: -6, head: -6, spin: -14 }],
  [1, { x: -0.04, y: -0.02, ...feet(-0.04, 0.1), r: [165, 0, 172, 0], l: at(-1, -0.19, 0.98, 0.05, [1, 0.2, -0.2]), handR: 1, handL: 1, lean: -9, head: -8, spin: -14 }],
  [2, { x: -0.04, y: -0.04, ...feet(-0.04, 0.1), r: [150, 10, 160, 10], l: at(-1, -0.19, 0.98, 0.05, [1, 0.2, -0.2]), handR: 1, handL: 1, lean: -6, head: -6, spin: -14 }],
  [3, { x: -0.04, y: -0.02, ...feet(-0.04, 0.1), r: ARM.sky, l: ARM.sky, handR: 0, handL: 0, lean: 0, spin: 0 }],
];
const guitarDuel = swapRoles(shredKeys, cheerKeys);

// Battle: strike poses while the partner hypes them up (points at them).
const poseKeys: Keys = [
  [0, { x: 0, y: -0.1, ...feet(0, 0.15), r: [150, 0, 120, 30], l: ARM.hip, handR: 0, handL: 0, lean: -6, head: -8 }],
  [1, { x: 0, y: -0.06, ...feet(0, 0.15), r: [150, 0, 120, 30], l: ARM.hip, handR: 0, handL: 0, lean: -6, head: -8 }],
  [2, { x: 0, y: -0.14, rf: [0.17, 0, 0.04], lf: [-0.13, 0, 0], r: ARM.cross, l: [112, 0, 100, -20], handR: 0, handL: 0, twist: -14, lean: 4, head: 6 }],
  [3, { x: 0, y: -0.1, rf: [0.17, 0, 0.04], lf: [-0.13, 0, 0], r: ARM.cross, l: [112, 0, 100, -20], handR: 0, handL: 0, twist: -14, lean: 4, head: 6 }],
];
// Hype (authored for the right player, mirrored into place by swapRoles): point at the partner, bounce.
const hypeRight: Keys = [
  [0, { x: 0, y: -0.06, ...feet(0, 0.11), l: at(-1, -0.44, 0.86, 0.1, [0.3, -1, 0]), r: [30, 10, 40, 40], handL: 0, handR: 0.5, head: 6, lean: -3 }],
  [1, { x: 0, y: -0.02, ...feet(0, 0.11), l: at(-1, -0.42, 0.95, 0.1, [0.3, -1, 0]), r: [30, 10, 40, 40], handL: 0, handR: 0.5, head: 6, lean: -3 }],
  [2, { x: 0, y: -0.06, ...feet(0, 0.11), l: [160, 0, 168, 0], r: [160, 0, 168, 0], handL: 1, handR: 1 }],
  [3, { x: 0, y: -0.02, ...feet(0, 0.11), l: at(-1, -0.42, 0.95, 0.1, [0.3, -1, 0]), r: [30, 10, 40, 40], handL: 0, handR: 0.5, head: 6 }],
];
const battle = swapRoles(poseKeys, hypeRight.map(([t, s]) => [t, mir(s)] as const));

// Wave pass: arms out in a T, hands meeting in the middle; the wave runs P1 left -> P2 right.
const WAVE_X = 0.12;
function wavePass(): { p1: Keys; p2: Keys } {
  const p1: Keys = [];
  const p2: Keys = [];
  const meet = (X: number, up: number) => h1(1, X, -0.02, 0, 0.8 + up, 0.04, [0.2, 1, -0.4]);
  const outer = (up: number): [number, number, number, number] => [90 + up * 300, 0, 90 + up * 420, 0];
  const lift = [[0.18, 0, 0], [0, 0.16, 0], [0, 0, 0.18], [0, 0.0, 0]]; // P1 outer, junction, P2 outer
  for (let i = 0; i < 4; i++) {
    const [o1, j, o2] = lift[i];
    p1.push([i, { x: WAVE_X, y: -0.02, ...feet(WAVE_X, 0.09), l: outer(o1), r: meet(WAVE_X, j), handR: 1, handL: 1, lean: (o1 - j) * 30, chestX: o1 > 0 ? -0.03 : j > 0 ? 0.03 : 0 }]);
    const m = mir({ l: outer(o2), r: meet(WAVE_X, j), handR: 1, handL: 1, lean: (o2 - j) * 30, chestX: o2 > 0 ? -0.03 : j > 0 ? 0.03 : 0 });
    p2.push([i, { ...m, x: -WAVE_X, y: -0.02, ...feet(-WAVE_X, 0.09) }]);
  }
  return { p1, p2 };
}
const wavePassKeys = wavePass();

// Tug of war: both fists on an invisible rope between them; pull, get pulled.
function tug(): { p1: Keys; p2: Keys } {
  const xs1 = [0.0, 0.06, 0.18, 0.06];
  const p1: Keys = [];
  const p2: Keys = [];
  const rope = (X: number, pulled: boolean): PoseSpec => ({
    r: h1(1, X, -0.07, -0.1, 0.72, 0.12, [0.3, -1, -0.3]),
    l: h1(-1, X, -0.07, -0.22, 0.72, 0.12, [0.3, -1, -0.3]),
    handR: 0, handL: 0, lean: pulled ? 6 : -14, twist: pulled ? 0 : -10,
  });
  for (let i = 0; i < 4; i++) {
    const X1 = xs1[i];
    const X2 = -xs1[(i + 2) % 4];
    const pulled1 = X1 > 0.1;
    // Rope hands follow the rope: the rope slides by the pull.
    const shift = (X1 - X2 * -1) / 2; // rope centre moves toward the puller
    const k1 = rope(X1, pulled1);
    const p1k: PoseSpec = {
      ...k1, x: X1, y: -0.07, rf: [X1 + 0.12, 0, 0.03], lf: [X1 - 0.14, 0, -0.02],
      r: h1(1, X1, -0.07, -0.07 + shift, 0.62, 0.12, [0.3, -1, -0.3]),
      l: h1(-1, X1, -0.07, -0.21 + shift, 0.62, 0.12, [0.3, -1, -0.3]),
    };
    const pulled2 = -X2 > 0.1;
    const k2 = rope(-X2, pulled2);
    const p2src: PoseSpec = {
      ...k2, x: -X2, y: -0.07, rf: [-X2 + 0.12, 0, 0.03], lf: [-X2 - 0.14, 0, -0.02],
      r: h1(1, -X2, -0.07, -0.07 - shift, 0.62, 0.12, [0.3, -1, -0.3]),
      l: h1(-1, -X2, -0.07, -0.21 - shift, 0.62, 0.12, [0.3, -1, -0.3]),
    };
    p1.push([i, p1k]);
    p2.push([i, mir(p2src)]);
  }
  return { p1, p2 };
}
const tugKeys = tug();

// Spin out and roll in: P2 spins away to arm's length, catches P1's hand, then rolls back in.
function spinOut(): { p1: Keys; p2: Keys } {
  const X1 = 0.2;
  const hold = (X2: number, y: number) => ({
    p1: h1(1, X1, y, (-H + X1 + (H + X2)) / 2, 0.76, 0.08, [0.5, -0.6, -0.4]),
    p2: at(-1, (-H + X1 + (H + X2)) / 2 - (H + X2), 0.76 - y, 0.08, [0.5, -0.6, -0.4]),
  });
  const TF = (X: number): PoseSpec => ({ rf: [X + 0.055, 0, 0], lf: [X - 0.055, 0, 0] });
  const tuck: PoseSpec = { r: [40, 10, 60, 60], l: [40, 10, 60, 60], handR: 0.5, handL: 0.5 };
  const steps: [number, number, number][] = [
    // [at, P2 x, P2 spin]
    [0, -0.3, 0], [0.5, -0.24, 90], [1, -0.16, 180], [1.5, -0.08, 270], [2, 0, 0], [3, 0, 0],
    [4, 0, 0], [4.5, -0.08, -90], [5, -0.16, -180], [5.5, -0.24, -270], [6, -0.3, 0], [7, -0.3, 0],
  ];
  const p1: Keys = [];
  const p2: Keys = [];
  for (const [t, X2, sp] of steps) {
    const turning = (t > 0 && t < 2) || (t > 4 && t < 6);
    const h = hold(X2, -0.04);
    p1.push([t, { x: X1, y: -0.04, ...feet(X1, 0.1), r: turning ? [150, 10, 160, 10] : h.p1, l: ARM.hip, handR: 1, handL: 0, lean: turning ? -3 : 0 }]);
    p2.push([t, turning
      ? { x: X2, y: -0.03, spin: sp, ...TF(X2), ...tuck }
      : { x: X2, y: -0.04, ...feet(X2, 0.1), l: h.p2, r: t === 3 || t === 7 ? [150, -10, 160, -10] : ARM.hip, handL: 1, handR: t === 3 || t === 7 ? 1 : 0 }]);
  }
  return { p1, p2 };
}
const spinOutKeys = spinOut();

const DEFS: PartnerDef[] = [
  {
    id: 'duo-high-five', name: 'High Five, Low Five', tags: 'party pop | arms | hands clap', level: 'low', d: 1, beats: 4, parts: ['arms'],
    desc: 'Step in toward your partner, slap a high five, then a low five.',
    p1: [
      [0, { x: IN, y: -0.03, ...feet(IN), r: at(1, 0.16, 1.0, -0.06, [0.8, 0, -0.5]), l: ARM.rest, handR: 1, handL: 0.5 }],
      [1, { x: IN, y: -0.02, ...feet(IN), r: h1(1, IN, -0.02, -0.025, 1.0, 0.06, [0.6, 0, -0.6]), l: ARM.rest, handR: 1, handL: 0.5 }],
      [2, { x: IN, y: -0.09, ...feet(IN, 0.12), r: at(1, 0.2, 0.5, -0.1), l: ARM.rest, handR: 1, handL: 0.5 }],
      [3, { x: IN, y: -0.09, ...feet(IN, 0.12), r: h1(1, IN, -0.09, -0.025, 0.5, 0.08, [0.6, -0.5, -0.4]), l: ARM.rest, handR: 1, handL: 0.5, bend: 6 }],
    ],
    contacts: [HANDS(1, 0.09), HANDS(3, 0.09)],
  },
  {
    id: 'duo-jump-high-five', name: 'Jump High Five', tags: 'party pop | full | jump hands', level: 'high', d: 2, beats: 4, parts: ['jump', 'arms'], jump: true, impact: true,
    desc: 'Crouch together, jump and slap a high five at the top, land soft.',
    p1: [
      [0, { x: IN, y: -0.16, ...feet(IN, 0.11), r: [30, -20, 40, 0], l: [30, -20, 40, 0], handR: 1, handL: 1, bend: 10 }],
      [1, { x: IN, y: 0.09, rf: [IN + 0.09, 0.08, 0], lf: [IN - 0.09, 0.08, 0], r: h1(1, IN, 0.09, -0.02, 1.14, 0.04, [0.6, 0, -0.6]), l: [150, 0, 160, 0], handR: 1, handL: 1 }],
      [2, { x: IN, y: -0.14, ...feet(IN, 0.11), r: ARM.low, l: ARM.low, handR: 1, handL: 1, bend: 6 }],
      [3, { x: IN, y: -0.04, ...feet(IN, 0.1), r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
    ],
    contacts: [HANDS(1, 0.09)],
  },
  {
    id: 'duo-fist-bump', name: 'Fist Bump Explosion', tags: 'party hiphop | arms | hands', level: 'low', d: 1, beats: 4, parts: ['arms'],
    desc: 'Bump fists in the middle, then blow your hands up and apart like an explosion.',
    p1: [
      [0, { x: IN, y: -0.04, ...feet(IN), r: ARM.guard, l: ARM.rest, handR: 0, handL: 0.4 }],
      [1, { x: IN, y: -0.05, ...feet(IN), r: h1(1, IN, -0.05, -0.03, 0.74, 0.14, [0.3, -1, -0.1]), l: ARM.rest, handR: 0, handL: 0.4, lean: 2 }],
      [2, { x: IN - 0.04, y: 0.0, ...feet(IN - 0.04), r: [150, 20, 165, 10], l: [150, 20, 165, 10], handR: 1, handL: 1, lean: -6, head: -4 }],
      [3, { x: IN - 0.02, y: -0.04, ...feet(IN - 0.02), r: [110, 10, 120, 0], l: [110, 10, 120, 0], handR: 1, handL: 1, lean: -3 }],
    ],
    contacts: [HANDS(1, 0.09)],
  },
  {
    id: 'duo-hip-bump', name: 'Partner Hip Bump', tags: 'party disco | hips | hips', level: 'mid', d: 1, beats: 4, parts: ['hips'],
    desc: 'Stand close, lean away and bump your inner hips together, then clap.',
    p1: [
      [0, { x: 0.3, y: -0.06, ...feet(0.3, 0.1), hips: 0.085, tilt: 12, lean: -12, r: ARM.hip, l: [150, 0, 160, 0], handR: 0, handL: 1, head: -6 }],
      [1, { x: 0.3, y: -0.03, ...feet(0.3, 0.1), hips: -0.02, tilt: -3, r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [2, { x: 0.3, y: -0.06, ...feet(0.3, 0.1), hips: 0.085, tilt: 12, lean: -12, r: ARM.hip, l: [150, 0, 160, 0], handR: 0, handL: 1, head: -6 }],
      [3, { x: 0.3, y: -0.03, ...feet(0.3, 0.1), hips: -0.02, tilt: -3, r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
    ],
    contacts: [{ at: 0, a: [1, J.HIP_R], b: [2, J.HIP_L], tol: 0.16 }],
  },
  {
    id: 'duo-pat-a-cake', name: 'Pat-a-Cake', tags: 'party pop | arms | clap hands', level: 'low', d: 1, beats: 4, parts: ['arms'],
    desc: 'Clap your own hands, pat your partner\'s inner hand, clap, then pat up high.',
    p1: [
      [0, { x: IN, y: -0.04, ...feet(IN), r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [1, { x: IN, y: -0.04, ...feet(IN), r: h1(1, IN, -0.04, -0.025, 0.8, 0.1, [0.6, -0.6, -0.4]), l: [40, 0, 50, 10], handR: 1, handL: 1 }],
      [2, { x: IN, y: -0.04, ...feet(IN), r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [3, { x: IN, y: -0.02, ...feet(IN), r: h1(1, IN, -0.02, -0.025, 1.0, 0.06, [0.6, 0, -0.6]), l: [40, 0, 50, 10], handR: 1, handL: 1 }],
    ],
    contacts: [HANDS(1, 0.09), HANDS(3, 0.09)],
  },
  {
    id: 'duo-patty-slap', name: 'Patty Slap', tags: 'party aerobic | arms | clap hands', level: 'low', d: 1, beats: 4, parts: ['arms', 'legs'],
    desc: 'Slap your thighs, clap, pat your partner\'s hand, clap.',
    p1: [
      [0, { x: IN, y: -0.1, ...feet(IN, 0.12), r: at(1, 0.11, 0.42, 0.1, [0.6, -0.4, -0.5]), l: at(-1, -0.11, 0.42, 0.1, [0.6, -0.4, -0.5]), handR: 1, handL: 1, bend: 10, nod: 6 }],
      [1, { x: IN, y: -0.05, ...feet(IN, 0.11), r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [2, { x: IN, y: -0.04, ...feet(IN, 0.11), r: h1(1, IN, -0.04, -0.025, 0.86, 0.1, [0.6, -0.4, -0.5]), l: [40, 0, 50, 10], handR: 1, handL: 1 }],
      [3, { x: IN, y: -0.05, ...feet(IN, 0.11), r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
    ],
    contacts: [HANDS(2, 0.09)],
  },
  {
    id: 'duo-clap-clap-pat', name: 'Clap Clap Pat', tags: 'party pop | arms | clap hands', level: 'mid', d: 2, beats: 4, parts: ['arms'],
    desc: 'Two quick claps, pat your partner low, two quick claps, pat up high.',
    p1: [
      [0, { x: IN, y: -0.04, ...feet(IN), r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [0.5, { x: IN, y: -0.02, ...feet(IN), r: hand1Open(), l: hand1Open(-1), handR: 1, handL: 1 }],
      [1, { x: IN, y: -0.07, ...feet(IN, 0.11), r: h1(1, IN, -0.07, -0.025, 0.62, 0.12, [0.6, -0.6, -0.4]), l: [30, 0, 40, 10], handR: 1, handL: 1 }],
      [2, { x: IN, y: -0.04, ...feet(IN), r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [2.5, { x: IN, y: -0.02, ...feet(IN), r: hand1Open(), l: hand1Open(-1), handR: 1, handL: 1 }],
      [3, { x: IN, y: -0.01, ...feet(IN), r: h1(1, IN, -0.01, -0.025, 1.02, 0.06, [0.6, 0, -0.6]), l: [40, 0, 50, 10], handR: 1, handL: 1 }],
    ],
    contacts: [HANDS(1, 0.09), HANDS(3, 0.09)],
  },
  {
    id: 'duo-mirror-hands', name: 'Mirror Hands', tags: 'pop | arms | hands wave', level: 'low', d: 1, beats: 4, parts: ['arms'],
    desc: 'Inner palms almost touching like a mirror, slide them slowly up, out and down together.',
    p1: [
      [0, { x: IN, y: -0.03, ...feet(IN), r: h1(1, IN, -0.03, -0.02, 0.78, 0.12, [0.6, -0.6, -0.4]), l: [30, 10, 40, 30], handR: 1, handL: 1 }],
      [1, { x: IN, y: -0.01, ...feet(IN), r: h1(1, IN, -0.01, -0.02, 1.0, 0.08, [0.6, 0, -0.6]), l: [70, 10, 80, 20], handR: 1, handL: 1, head: -4 }],
      [2, { x: IN, y: -0.03, ...feet(IN), r: h1(1, IN, -0.03, -0.02, 0.86, 0.14, [0.6, -0.4, -0.4]), l: [110, 0, 120, 0], handR: 1, handL: 1 }],
      [3, { x: IN, y: -0.06, ...feet(IN), r: h1(1, IN, -0.06, -0.02, 0.62, 0.14, [0.6, -0.6, -0.4]), l: [50, 0, 60, 10], handR: 1, handL: 1, head: 4 }],
    ],
    contacts: [HANDS(0, 0.09), HANDS(1, 0.09), HANDS(3, 0.09)],
  },
  {
    id: 'duo-london-bridge', name: 'London Bridge', tags: 'party pop | full | hands', level: 'low', d: 1, beats: 4, parts: ['arms', 'hips'],
    desc: 'Join inner hands high to make a bridge and sway side to side under it together.',
    p1: [
      [0, { x: IN, y: -0.04, ...feet(IN, 0.11), hips: 0.05, tilt: 6, r: h1(1, IN, -0.04, 0, 1.0, 0.02, [0.7, 0.1, -0.5]), l: [40, 0, 55, 30], handR: 1, handL: 1, lean: 3 }],
      [1, { x: IN, y: -0.02, ...feet(IN, 0.11), hips: 0, r: h1(1, IN, -0.02, 0, 1.0, 0.02, [0.7, 0.1, -0.5]), l: [25, 0, 40, 30], handR: 1, handL: 1 }],
      [2, { x: IN, y: -0.04, ...feet(IN, 0.11), hips: -0.05, tilt: -6, r: h1(1, IN, -0.04, 0, 1.0, 0.02, [0.7, 0.1, -0.5]), l: [60, 0, 70, 20], handR: 1, handL: 1, lean: -3 }],
      [3, { x: IN, y: -0.02, ...feet(IN, 0.11), hips: 0, r: h1(1, IN, -0.02, 0, 1.0, 0.02, [0.7, 0.1, -0.5]), l: [25, 0, 40, 30], handR: 1, handL: 1 }],
    ],
    contacts: [HANDS(0, 0.1), HANDS(1, 0.1), HANDS(2, 0.1)],
  },
  {
    id: 'duo-see-saw', name: 'See-Saw Squats', tags: 'aerobic party | legs | hands', level: 'mid', d: 1, beats: 4, parts: ['legs'], impact: true,
    desc: 'Hold inner hands; one sinks into a squat as the other rises, like a see-saw.',
    p1: seeSawKeys.p1, p2: seeSawKeys.p2,
    contacts: [HANDS(0, 0.1), HANDS(2, 0.1)],
  },
  {
    id: 'duo-promenade', name: 'Promenade', tags: 'latin pop | legs | walk hands', level: 'low', d: 1, beats: 4, parts: ['legs'],
    desc: 'Side by side with inner hands joined, step-touch the same way together, then back.',
    p1: promenadeKeys.p1, p2: promenadeKeys.p2,
    contacts: [HANDS(0, 0.1), HANDS(2, 0.1)],
  },
  {
    id: 'duo-sweetheart-sway', name: 'Sweetheart Sway', tags: 'pop latin | hips | hips wave', level: 'low', d: 1, beats: 4, parts: ['hips', 'arms'],
    desc: 'Inner arms round each other\'s shoulders, outer arms up, sway together side to side.',
    p1: sweetheartKeys.p1, p2: sweetheartKeys.p2,
    contacts: [{ at: 1, a: [1, J.HA_R], b: [2, J.SH_L], tol: 0.1 }, { at: 1, a: [2, J.HA_L], b: [1, J.SH_R], tol: 0.1 }],
  },
  {
    id: 'duo-back-to-back', name: 'Back-to-Back Shimmy', tags: 'disco party | full | shake', level: 'mid', d: 2, beats: 4, parts: ['torso', 'legs'],
    desc: 'Turn your backs to each other, shimmy your shoulders down low and back up.',
    p1: [
      [0, { x: 0.3, y: -0.03, rf: [0.38, 0, 0], lf: [0.2, 0, 0], spin: -72, shR: 0.9, shL: 0, r: [50, 30, 95, 60], l: [50, 30, 95, 60], handR: 1, handL: 1, head: 4 }],
      [0.5, { x: 0.3, y: -0.06, rf: [0.38, 0, 0], lf: [0.2, 0, 0], spin: -72, shR: 0, shL: 0.9, r: [50, 30, 95, 60], l: [50, 30, 95, 60], handR: 1, handL: 1, head: -4 }],
      [1, { x: 0.3, y: -0.1, rf: [0.39, 0, 0], lf: [0.19, 0, 0], spin: -72, shR: 0.9, shL: 0, r: [55, 30, 100, 60], l: [55, 30, 100, 60], handR: 1, handL: 1, head: 4, kneeR: 0.12, kneeL: 0.12 }],
      [1.5, { x: 0.3, y: -0.13, rf: [0.39, 0, 0], lf: [0.19, 0, 0], spin: -72, shR: 0, shL: 0.9, r: [55, 30, 100, 60], l: [55, 30, 100, 60], handR: 1, handL: 1, head: -4, kneeR: 0.14, kneeL: 0.14 }],
      [2, { x: 0.3, y: -0.15, rf: [0.39, 0, 0], lf: [0.19, 0, 0], spin: -72, shR: 0.9, shL: 0, r: [60, 30, 105, 60], l: [60, 30, 105, 60], handR: 1, handL: 1, head: 4, kneeR: 0.15, kneeL: 0.15 }],
      [2.5, { x: 0.3, y: -0.12, rf: [0.39, 0, 0], lf: [0.19, 0, 0], spin: -72, shR: 0, shL: 0.9, r: [55, 30, 100, 60], l: [55, 30, 100, 60], handR: 1, handL: 1, head: -4, kneeR: 0.12, kneeL: 0.12 }],
      [3, { x: 0.3, y: -0.07, rf: [0.38, 0, 0], lf: [0.2, 0, 0], spin: -72, shR: 0.9, shL: 0, r: [50, 30, 95, 60], l: [50, 30, 95, 60], handR: 1, handL: 1, head: 4 }],
      [3.5, { x: 0.3, y: -0.04, rf: [0.38, 0, 0], lf: [0.2, 0, 0], spin: -72, shR: 0, shL: 0.9, r: [50, 30, 95, 60], l: [50, 30, 95, 60], handR: 1, handL: 1, head: -4 }],
    ],
  },
  {
    id: 'duo-elbow-swing', name: 'Elbow Swing', tags: 'party latin | full | spin', level: 'mid', d: 2, beats: 8, parts: ['turn', 'legs'],
    desc: 'Link inner elbows and skip round each other in a full circle.',
    p1: elbowSwing.p1, p2: elbowSwing.p2, orbit: ELBOW_R,
    contacts: [0, 2, 4, 6].map((t) => ({ at: t, a: [1, J.HA_R] as const, b: [2, J.HA_L] as const, tol: 0.1 })),
  },
  {
    id: 'duo-star-turn', name: 'Star Turn', tags: 'party latin | full | spin hands', level: 'mid', d: 2, beats: 8, parts: ['turn', 'legs'],
    desc: 'Press inner palms together up high and walk round each other the other way.',
    p1: starTurn.p1, p2: starTurn.p2, orbit: TURN_R,
    contacts: [0, 2, 4, 6].map((t) => ({ at: t, a: [1, J.HA_R] as const, b: [2, J.HA_L] as const, tol: 0.1 })),
  },
  {
    id: 'duo-under-arm-turn', name: 'Under-Arm Turn', tags: 'latin pop | turn | spin hands', level: 'mid', d: 2, beats: 8, parts: ['turn', 'arms'],
    desc: 'One raises the joined hands, the other turns underneath; then swap.',
    p1: underArmKeys.p1, p2: underArmKeys.p2,
    cues: ['Make the Arch', 'Turn Under', 'Turn Under', 'Make the Arch'],
    contacts: [HANDS(0, 0.1), HANDS(2, 0.12), HANDS(4, 0.1), HANDS(6, 0.12)],
  },
  {
    id: 'duo-spin-out', name: 'Spin Out, Roll In', tags: 'latin pop | turn | spin hands', level: 'mid', d: 3, beats: 8, parts: ['turn', 'arms'],
    desc: 'P2 spins out to arm\'s length and catches P1\'s hand, then rolls back in to P1\'s side.',
    p1: spinOutKeys.p1, p2: spinOutKeys.p2,
    cues: ['Send Them Out', 'Spin Out', 'Reel Them In', 'Roll In'],
    contacts: [HANDS(0, 0.08), HANDS(3, 0.08), HANDS(6, 0.08)],
  },
  {
    id: 'duo-do-si-do', name: 'Do-Si-Do', tags: 'party | legs | walk', level: 'mid', d: 2, beats: 8, parts: ['legs'],
    desc: 'Arms folded, walk past each other (P1 in front), then walk back passing behind.',
    p1: doSiDo.p1, p2: doSiDo.p2,
    depth: [[0, 0, 0], [2, 0.2, -0.2], [4, 0, 0], [6, -0.2, 0.2]],
  },
  {
    id: 'duo-cross-over', name: 'Cross Over', tags: 'party aerobic | legs | walk clap', level: 'high', d: 3, beats: 4, parts: ['legs', 'arms'],
    desc: 'Trade places quickly with a clap on the far side, then cross straight back.',
    p1: crossOver.p1, p2: crossOver.p2,
    depth: [[0, 0, 0], [1, 0.2, -0.2], [2, 0, 0], [3, -0.2, 0.2]],
  },
  {
    id: 'duo-wave-pass', name: 'Wave Pass', tags: 'pop hiphop | arms | wave', level: 'mid', d: 2, beats: 4, parts: ['arms'],
    desc: 'Arms out, fingertips meeting: send a wave from P1\'s far hand through both of you to P2\'s far hand.',
    p1: wavePassKeys.p1, p2: wavePassKeys.p2,
    contacts: [HANDS(1, 0.1), HANDS(3, 0.1)],
  },
  {
    id: 'duo-tug-of-war', name: 'Tug of War', tags: 'party | full | hands', level: 'mid', d: 2, beats: 4, parts: ['arms', 'legs'],
    desc: 'Both grab an invisible rope between you; pull it your way, then get pulled back.',
    p1: tugKeys.p1, p2: tugKeys.p2, prop: 'rope',
  },
  {
    id: 'duo-boxing-pads', name: 'Pads and Punches', tags: 'party aerobic | arms | punch', level: 'mid', d: 2, beats: 8, parts: ['arms'],
    desc: 'One jabs twice into the partner\'s held-up palm (the pad), then swap.',
    p1: boxing.p1, p2: boxing.p2,
    cues: ['Jab Jab', 'Hold the Pad', 'Hold the Pad', 'Jab Jab'],
    contacts: [HANDS(0, 0.1), HANDS(1, 0.1), { at: 4, a: [2, J.HA_L], b: [1, J.HA_R], tol: 0.1 }],
  },
  {
    id: 'duo-guitar-duel', name: 'Guitar Duel', tags: 'rock | arms | ', level: 'high', d: 2, beats: 8, parts: ['arms', 'legs'],
    desc: 'Face-off: one shreds an air-guitar solo at the partner, who cheers; then swap.',
    p1: guitarDuel.p1, p2: guitarDuel.p2,
    cues: ['Guitar Solo', 'Cheer Them On', 'Cheer Them On', 'Guitar Solo'],
  },
  {
    id: 'duo-battle-poses', name: 'Battle Poses', tags: 'hiphop kpop | arms | point', level: 'high', d: 2, beats: 8, parts: ['arms', 'torso'],
    desc: 'Dance battle: one hits two poses while the other points and hypes; then swap.',
    p1: battle.p1, p2: battle.p2,
    cues: ['Strike a Pose', 'Hype Them Up', 'Hype Them Up', 'Strike a Pose'],
  },
];

function hand1Open(side: 1 | -1 = 1) {
  return at(side, side * 0.2, 0.76, 0.16, [0.6, -0.6, -0.3]);
}

// ---------------------------------------------------------------------------
// Build

function parseTagWords(spec: string): { families: Family[]; focus: Focus[]; themes: Theme[] } {
  const [f = '', fo = '', th = ''] = spec.split('|').map((x) => x.trim());
  const words = (s: string) => s.split(/\s+/).filter(Boolean);
  return { families: words(f) as Family[], focus: words(fo) as Focus[], themes: words(th) as Theme[] };
}

function half(keys: Keys, from: number): Keys {
  return keys.filter(([t]) => t >= from && t < from + 4).map(([t, s]) => [t - from, s] as const);
}

function buildPartner(d: PartnerDef): PartnerMove {
  const p2keys = d.p2 ?? d.p1.map(([t, s]) => [t, mir(s)] as const);
  const halves = d.beats / 4;
  const mk = (player: Player, keys: Keys): Move[] => {
    const out: Move[] = [];
    for (let i = 0; i < halves; i++) {
      const cue = d.cues?.[(player - 1) + i * 2] ?? d.name;
      out.push(
        buildFull(
          {
            kind: 'full',
            id: `${d.id}.p${player}${halves > 1 ? 'ab'[i] : ''}`,
            name: cue,
            desc: d.desc,
            tags: d.tags,
            beats: 4,
            level: d.level,
            d: d.d,
            parts: d.parts,
            jump: d.jump,
            impact: d.impact,
            keys: half(keys, i * 4),
          },
          'duo',
        ),
      );
    }
    return out;
  };
  const p1 = mk(1, d.p1);
  const p2 = mk(2, p2keys);
  const tags = parseTagWords(d.tags);
  return {
    id: d.id,
    name: d.name,
    desc: d.desc,
    beats: d.beats,
    level: d.level,
    difficulty: d.d,
    ...tags,
    jump: !!d.jump,
    impact: !!d.impact || !!d.jump,
    p1,
    p2,
    depth: d.depth ?? [],
    orbit: d.orbit ?? 0,
    contacts: d.contacts ?? [],
    roles: !!d.cues,
    prop: d.prop ?? null,
  };
}

/** Definition errors (skipped moves), for the tests. */
export const PARTNER_ERRORS: { id: string; message: string }[] = [];

/** Every partner move. */
export const PARTNER_MOVES: readonly PartnerMove[] = DEFS.flatMap((d) => {
  try {
    return [buildPartner(d)];
  } catch (e) {
    PARTNER_ERRORS.push({ id: d.id, message: (e as Error).message });
    return [];
  }
});

const BY_ID = new Map(PARTNER_MOVES.map((m) => [m.id, m]));
export function findPartnerMove(id: string): PartnerMove | undefined {
  return BY_ID.get(id);
}

/** Partner move whose half `m` belongs to (a track Move of a partner move), if any. */
const OWNER = new Map<Move, { pm: PartnerMove; player: Player; part: number }>();
for (const pm of PARTNER_MOVES) {
  pm.p1.forEach((m, i) => OWNER.set(m, { pm, player: 1, part: i }));
  pm.p2.forEach((m, i) => OWNER.set(m, { pm, player: 2, part: i }));
}
export function partnerOf(m: Move): { pm: PartnerMove; player: Player; part: number } | undefined {
  return OWNER.get(m);
}

/** Depth offsets (z1, z2) of a partner move at move beat `b` (0..beats), given each player's current spin (orbit moves). */
export function partnerDepth(pm: PartnerMove, b: number, spin1: number, spin2: number, out: [number, number]): [number, number] {
  if (pm.orbit > 0) {
    out[0] = pm.orbit * Math.sin((spin1 * Math.PI) / 180);
    out[1] = -pm.orbit * Math.sin((spin2 * Math.PI) / 180);
    return out;
  }
  const d = pm.depth;
  if (!d.length) {
    out[0] = out[1] = 0;
    return out;
  }
  const L = pm.beats;
  const bb = ((b % L) + L) % L;
  let k = d.length - 1;
  for (let i = 0; i < d.length; i++) if (d[i][0] <= bb + 1e-9) k = i;
  const k0 = d[k];
  const k1 = d[(k + 1) % d.length];
  const t0 = k0[0];
  let t1 = k1[0];
  if (t1 <= t0) t1 += L;
  const u = (bb - t0 + (bb < t0 ? L : 0)) / (t1 - t0);
  const s = u * u * (3 - 2 * u);
  out[0] = k0[1] + (k1[1] - k0[1]) * s;
  out[1] = k0[2] + (k1[2] - k0[2]) * s;
  return out;
}
