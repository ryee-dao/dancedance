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
 * its mirror image. Orbiting moves (elbow swing, star turn) turn both bodies
 * with `spin` while the roots travel round the pair's centre, P2 always P1
 * turned 180 deg about that centre, so the linked joints stay together (a
 * rigid rotation); the stage derives the depth from the spin and draws the
 * hooked forearms interlocked (`hook`). Partners who should face each other
 * (elbow swing, do-si-do) are turned toward each other with `spin`, never
 * left facing the viewer.
 *
 * Moves longer than 4 beats are split into 4-beat halves (the animator
 * plays them back to back; tracks interpolate across the boundary).
 *
 * What a partner move suits (duo.ts chooses by these, with the same song
 * information as the single-player generator):
 *   styles   the genre sets (genres.ts) it belongs to: danced only on songs
 *            whose style opens one of them (a dap for hip-hop, which trap
 *            and drill open too; a counterbalance for lyrical). None =
 *            general purpose (high fives, clap patterns, do-si-do ...).
 *   gentle   smooth, no jumps, no impact, no claps / slaps / punches: the
 *            only kind a calm song (a ballad) gets. Checked at build.
 *   trade    the two cross over / trade places (needs a depth track);
 *            never on Easy.
 *   level / difficulty as single-player moves: Easy takes difficulty 1 and
 *            no jumps or crossings, Medium up to 2, Hard everything.
 * Tempo: partnerSpeed derives each move's speed limit from BOTH tracks
 * (speed.ts: joint travel, turns, key density; a hand going into a contact
 * counts like any hand) plus the depth the stage adds; above it the pair
 * dance it at half time together, or not at all (partnerTempoMode).
 *
 * Contacts that must meet (joined hands, palms, shoulders) are placed with
 * K / reachTo, which solve the body first, so a lean, a bend or a turn
 * doesn't pull the hands apart; duoCheck.ts (npx tsx tools/moves/duoCheck.ts)
 * checks every declared contact, both tracks and the gap between the bodies.
 */

import { at, mir, type ArmAngles, type PoseSpec } from './poseKit';
import { ARM, hand, pose } from '../coach/poses';
import { CH, J, createSkeleton, solveSkeleton } from '../coach/skeleton';
import { buildFull, type BodyPart, type Difficulty, type Level, type Move, type MoveKey } from './catalog';
import type { Family, Focus, Theme } from './families';
import type { Genre } from './genres';
import { LEVEL_SPEED, MAX_LIMIT_BPM, moveSpeed, readsAtHalf, type SpeedLevel, type TempoMode } from './speed';

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
  /** Orbit moves: P1's spin minus its angle round the circle (see orbitKeys). */
  orbitSpin: number;
  contacts: readonly Contact[];
  /** The roles differ (P1 and P2 get their own cue names). */
  roles: boolean;
  /** A prop drawn between the players (rope: P1's left hand to P2's right hand). */
  prop: 'rope' | null;
  /** Arms hooked through each other (1 = right arms, -1 = left): the renderer interlocks them. 0 = none. */
  hook: 0 | 1 | -1;
  /**
   * The genre sets it belongs to (genres.ts): it is only danced on songs
   * whose style opens at least one of them. Empty = general purpose (any
   * song its character fits).
   */
  styles: readonly Genre[];
  /**
   * Gentle: smooth, unhurried, no impact and no percussive hits (no jumps,
   * stomps, claps, slaps or punches). The only partner moves a calm song
   * (a ballad) gets.
   */
  gentle: boolean;
  /** The two cross over / trade places (a `trade` phrase); never on Easy. */
  trade: boolean;
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
  orbitSpin?: number;
  prop?: 'rope';
  hook?: 1 | -1;
  contacts?: readonly Contact[];
  /** Genre sets (PartnerMove.styles); default none = general purpose. */
  styles?: readonly Genre[];
  gentle?: boolean;
  trade?: boolean;
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

const reachSk = createSkeleton();

/**
 * Arm angles that put a hand at a PAIR-space point (cx = 0 is the middle
 * between the players, y up from the floor, z toward the viewer) for this
 * exact body pose: the body is solved first, so its height, lean, bend,
 * twist and turn (`spin`) are all accounted for (h1 / at assume the neutral
 * upright stance). `elbow` hints where the elbow points, in the arm's frame.
 */
function reachTo(spec: PoseSpec, player: Player, side: 1 | -1, to: readonly [number, number, number], elbow?: readonly [number, number, number]): ArmAngles {
  solveSkeleton(pose(spec), reachSk);
  const home = player === 1 ? -H : H;
  const s = (side === 1 ? J.SH_R : J.SH_L) * 3;
  const p = reachSk.p, rt = reachSk.rt;
  const wx = to[0] - home - p[s], wy = to[1] - p[s + 1], wz = to[2] - p[s + 2];
  // Into the torso frame (rt maps torso -> world; its transpose back).
  const lx = rt[0] * wx + rt[3] * wy + rt[6] * wz;
  const ly = rt[1] * wx + rt[4] * wy + rt[7] * wz;
  const lz = rt[2] * wx + rt[5] * wy + rt[8] * wz;
  return hand(side * lx, ly, lz, elbow);
}

type Reach = readonly [number, number, number, (readonly [number, number, number])?];
/** A key for `player` whose hands reach pair-space points (R / L: [cx, cy, cz, elbow?]); other arms as given. */
function K(player: Player, spec: PoseSpec & { R?: Reach; L?: Reach }): PoseSpec {
  const { R, L, ...s } = spec;
  const out: PoseSpec = { ...s };
  if (R) out.r = reachTo(s, player, 1, [R[0], R[1], R[2]], R[3]);
  if (L) out.l = reachTo(s, player, -1, [L[0], L[1], L[2]], L[3]);
  return out;
}

/** Inner hands: P1 right ↔ P2 left. */
const HANDS = (at: number, tol?: number): Contact => ({ at, a: [1, J.HA_R], b: [2, J.HA_L], ...(tol ? { tol } : {}) });

const IN = 0.25; // standard step-in (roots 0.5 apart)

// ---------------------------------------------------------------------------
// Definitions

/**
 * Orbit: both players circle the pair's centre at radius `r`. P2 is always P1
 * turned 180 deg about that centre (point symmetry: same body pose, spin +
 * 180, opposite side of the circle), so whatever P1's arm holds at the centre
 * P2's same arm holds from the other side: the link stays physically closed
 * all the way round.
 *
 * Each body faces its line of travel turned `face` deg toward the partner.
 * dir = 1: clockwise from above (left -> front -> right -> back), the RIGHT
 * side toward the centre (right-elbow swing). dir = -1: the other way round,
 * the LEFT side in. The angle `th` puts P1's root at pair-space
 * (-r cos th, depth r sin th); `PartnerMove.orbitSpin` recovers th from the
 * spin for the depth (th = spin - orbitSpin).
 */
function orbitSpinOffset(dir: 1 | -1, face: number): number {
  return dir > 0 ? face : 180 - face;
}

function orbitKeys(r: number | readonly [number, number], dir: 1 | -1, face: number, th0: number, body: PoseSpec, beats = 8, warp = 0): { p1: Keys; p2: Keys } {
  const p1: Keys = [];
  const p2: Keys = [];
  const n = beats * 2;
  const off = orbitSpinOffset(dir, face);
  // r = [rx, rz]: an ellipse, wider across the screen than in depth (the depth comes from
  // PartnerMove.orbit, which is then rz). `warp` (0..0.5) speeds the pair through the moments one
  // stands straight in front of the other (th 90 / 270) and slows them where they are side by side.
  const rx = typeof r === 'number' ? r : r[0];
  for (let i = 0; i < n; i++) {
    const at = i / 2;
    const u = (2 * Math.PI * i) / n;
    const th = th0 + (dir * 180 * (u - (warp * Math.sin(2 * u)) / 2)) / Math.PI;
    const rad = (th * Math.PI) / 180;
    const X1 = H - rx * Math.cos(rad);
    const X2 = rx * Math.cos(rad) - H;
    // Small skipping steps: one foot rises every half beat, alternating.
    const liftR = i % 4 === 1 ? 0.035 : 0, liftL = i % 4 === 3 ? 0.035 : 0;
    const y = i % 2 === 1 ? -0.03 : -0.05;
    p1.push([at, { ...body, x: X1, y, spin: th + off, rf: [X1 + 0.06, liftR, 0], lf: [X1 - 0.06, liftL, 0] }]);
    p2.push([at, { ...body, x: X2, y, spin: th + off + 180, rf: [X2 + 0.06, liftR, 0], lf: [X2 - 0.06, liftL, 0] }]);
  }
  return { p1, p2 };
}

/** Swing angles of a bone direction (out = away from the body's midline, up, fwd) in the torso frame. */
function swingOf(out: number, up: number, fwd: number): [number, number] {
  const hz = Math.sqrt(out * out + fwd * fwd);
  return [(Math.atan2(hz, -up) * 180) / Math.PI, (Math.atan2(fwd, out) * 180) / Math.PI];
}

/** Arm angles from an elbow and a hand position relative to the shoulder (out, up, fwd); bone lengths come from the rig. */
function armThrough(e: readonly [number, number, number], hnd: readonly [number, number, number]): [number, number, number, number] {
  const [ue, up] = swingOf(e[0], e[1], e[2]);
  const [fe, fp] = swingOf(hnd[0] - e[0], hnd[1] - e[1], hnd[2] - e[2]);
  return [Math.round(ue * 10) / 10, Math.round(up * 10) / 10, Math.round(fe * 10) / 10, Math.round(fp * 10) / 10];
}

// Elbow swing (folk-dance elbow turn): turned toward each other, right
// elbows hooked between them, free arms out for balance, skipping round the
// shared centre. Hook geometry in P1's own frame (shoulder at out 0, the
// centre of the circle at (r cos f, r sin f) from the root): each upper arm
// reaches just past the centre, offset to the side of the partner's, and the
// forearm bends up around the partner's upper arm (the crooks interlock).
const ELBOW_R = 0.19;
const ELBOW_FACE = 50;
const elbowBody = ((): PoseSpec => {
  const f = (ELBOW_FACE * Math.PI) / 180;
  // Centre of the circle relative to the right shoulder (shoulder at x 0.125 from the root).
  const cx = ELBOW_R * Math.cos(f) - 0.125, cz = ELBOW_R * Math.sin(f);
  // Along the line toward the partner's shoulder, and across it (horizontal).
  const sx = 2 * cx, sz = 2 * cz;
  const sl = Math.hypot(sx, sz);
  const dx = sx / sl, dz = sz / sl;
  const nx = dz, nz = -dx; // to P1's right of that line (outside)
  const elbow: [number, number, number] = [cx + dx * 0.03 + nx * 0.035, -0.085, cz + dz * 0.03 + nz * 0.035];
  // Forearm: bent ~90 deg, across the partner's upper arm (inward) and a
  // little up, the hand gripping over it: the two crooks interlock.
  const hand: [number, number, number] = [elbow[0] - nx * 0.125, elbow[1] + 0.08, elbow[2] - nz * 0.125];
  return {
    r: armThrough(elbow, hand),
    l: [112, -18, 128, -8],
    handR: 0.3,
    handL: 1,
  };
})();
const elbowSwing = orbitKeys(ELBOW_R, 1, ELBOW_FACE, 90 - ELBOW_FACE, elbowBody);

// Star turn: left palms pressed together up high over the centre, walking
// forward round each other the other way (left side in), free arm low and out.
const TURN_R = 0.25;
const STAR_FACE = 25;
const starBody = ((): PoseSpec => {
  const f = (STAR_FACE * Math.PI) / 180;
  // Hand just short of the centre (the two palms meet there), in neutral-stance world coordinates.
  const k = 1 - 0.022 / TURN_R;
  return {
    l: at(-1, -TURN_R * Math.cos(f) * k, 1.0, TURN_R * Math.sin(f) * k, [0.6, 0.1, -0.6]),
    r: [48, -15, 62, 10],
    handL: 1,
    handR: 1,
    turn: -14,
  };
})();
const starTurn = orbitKeys(TURN_R, -1, STAR_FACE, -30, starBody);

// Under-arm turn: the turner's hand stays over its own head; the arch-maker reaches over.
const ARCH_X1 = 0.32; // arch-maker step-in (shoulders a little apart)
const TURN_X2 = -0.32; // turner step-in (P2 coordinates)
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
// Do-si-do: partners FACE each other (three-quarter turned, so both stay
// readable) and keep facing that way the whole time: walk forward past each
// other right shoulder to right shoulder (P1 passes in front), then back up
// to place left shoulder to left shoulder (P1 behind). P2's spin is mirrored.
const DOSIDO_TURN = 55;
const doSiDo = pass(8, () => ({ ...FOLD, spin: DOSIDO_TURN }));
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

/** Hip bump: the inner arm swings back out of the way (an elbow on the hip would jab the partner). */
const BUMP_INNER: PoseSpec['r'] = [32, -55, 40, -40];

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
      [0, { x: 0.28, y: -0.06, ...feet(0.28, 0.1), hips: 0.085, tilt: 12, lean: -12, r: BUMP_INNER, l: [150, 0, 160, 0], handR: 1, handL: 1, head: -6 }],
      [1, { x: 0.28, y: -0.03, ...feet(0.28, 0.1), hips: -0.02, tilt: -3, r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
      [2, { x: 0.28, y: -0.06, ...feet(0.28, 0.1), hips: 0.085, tilt: 12, lean: -12, r: BUMP_INNER, l: [150, 0, 160, 0], handR: 1, handL: 1, head: -6 }],
      [3, { x: 0.28, y: -0.03, ...feet(0.28, 0.1), hips: -0.02, tilt: -3, r: ARM.clap, l: ARM.clap, handR: 1, handL: 1 }],
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
    id: 'duo-mirror-hands', name: 'Mirror Hands', tags: 'pop | arms | hands wave', level: 'low', d: 1, beats: 4, parts: ['arms'], gentle: true,
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
    id: 'duo-london-bridge', name: 'London Bridge', tags: 'party pop | full | hands', level: 'low', d: 1, beats: 4, parts: ['arms', 'hips'], gentle: true,
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
    id: 'duo-promenade', name: 'Promenade', tags: 'latin pop | legs | walk hands', level: 'low', d: 1, beats: 4, parts: ['legs'], gentle: true,
    desc: 'Side by side with inner hands joined, step-touch the same way together, then back.',
    p1: promenadeKeys.p1, p2: promenadeKeys.p2,
    contacts: [HANDS(0, 0.1), HANDS(2, 0.1)],
  },
  {
    id: 'duo-sweetheart-sway', name: 'Sweetheart Sway', tags: 'pop latin | hips | hips wave', level: 'low', d: 1, beats: 4, parts: ['hips', 'arms'], gentle: true,
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
    desc: 'Turn to face each other, hook right elbows, free arm out, and skip round each other in a full circle.',
    p1: elbowSwing.p1, p2: elbowSwing.p2, orbit: ELBOW_R, orbitSpin: orbitSpinOffset(1, ELBOW_FACE), hook: 1,
    // Hooked: the elbows sit side by side, each hand wrapped over the partner's upper arm.
    contacts: [0, 2, 4, 6].flatMap((t) => [
      { at: t, a: [1, J.EL_R] as const, b: [2, J.EL_R] as const, tol: 0.1 },
      { at: t, a: [1, J.HA_R] as const, b: [2, J.EL_R] as const, tol: 0.14 },
    ]),
  },
  {
    id: 'duo-star-turn', name: 'Star Turn', tags: 'party latin | full | spin hands', level: 'mid', d: 2, beats: 8, parts: ['turn', 'legs'],
    desc: 'Press left palms together up high and walk forward round each other the other way.',
    p1: starTurn.p1, p2: starTurn.p2, orbit: TURN_R, orbitSpin: orbitSpinOffset(-1, STAR_FACE),
    contacts: [0, 2, 4, 6].map((t) => ({ at: t, a: [1, J.HA_L] as const, b: [2, J.HA_L] as const, tol: 0.08 })),
  },
  {
    id: 'duo-under-arm-turn', name: 'Under-Arm Turn', tags: 'latin pop | turn | spin hands', level: 'mid', d: 2, beats: 8, parts: ['turn', 'arms'], gentle: true,
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
    id: 'duo-do-si-do', name: 'Do-Si-Do', tags: 'party | legs | walk', level: 'mid', d: 2, beats: 8, parts: ['legs'], trade: true,
    desc: 'Face each other with arms folded, walk forward past each other right shoulder to right shoulder (P1 in front), then back up to place left shoulder to left shoulder.',
    p1: doSiDo.p1, p2: doSiDo.p2,
    depth: [[0, 0, 0], [2, 0.2, -0.2], [4, 0, 0], [6, -0.2, 0.2]],
  },
  {
    id: 'duo-cross-over', name: 'Cross Over', tags: 'party aerobic | legs | walk clap', level: 'high', d: 3, beats: 4, parts: ['legs', 'arms'], trade: true,
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
    id: 'duo-guitar-duel', name: 'Guitar Duel', tags: 'rock | arms | ', level: 'high', d: 2, beats: 8, parts: ['arms', 'legs'], styles: ['rock'],
    desc: 'Face-off: one shreds an air-guitar solo at the partner, who cheers; then swap.',
    p1: guitarDuel.p1, p2: guitarDuel.p2,
    cues: ['Guitar Solo', 'Cheer Them On', 'Cheer Them On', 'Guitar Solo'],
  },
  {
    id: 'duo-battle-poses', name: 'Battle Poses', tags: 'hiphop kpop | arms | point', level: 'high', d: 2, beats: 8, parts: ['arms', 'torso'], styles: ['hiphop', 'kpop', 'house'],
    desc: 'Dance battle: one hits two poses while the other points and hypes; then swap.',
    p1: battle.p1, p2: battle.p2,
    cues: ['Strike a Pose', 'Hype Them Up', 'Hype Them Up', 'Strike a Pose'],
  },
];

// ---------------------------------------------------------------------------
// Style sets: partner moves of the genre sets (PartnerMove.styles) and the
// gentle ones for calm songs. Hands that meet are placed with K / reachTo
// (solved for the body's lean, bend and turn), so the contacts line up at
// every declared beat.

/** Soft open hands. */
const SOFT = { handR: 1, handL: 1 } as const;
const E_LOW = [0.6, -0.6, -0.4] as const;
/** A palm resting on one's own sternum (left hand). */
const HEART_L = at(-1, -0.03, 0.76, 0.16, [1, -0.3, 0]);
/** Arms open in second (out to the sides, soft). */
const SECOND: PoseSpec['r'] = [86, 8, 92, 16];
const HIGH_V: PoseSpec['r'] = [140, 8, 146, 12];
const LOW_OPEN: PoseSpec['r'] = [40, 10, 46, 18];

// Reach in, reach away (lyrical): inner hands reach to fingertips meeting, then both sweep away.
const reachInAway: Keys = [
  [0, { x: 0.1, y: -0.04, rf: [0.22, 0, 0], lf: [-0.02, 0, 0], nod: 6, head: 3, r: at(1, 0.05, 0.5, 0.15, [1, -0.2, 0]), l: at(-1, -0.05, 0.5, 0.15, [1, -0.2, 0]), ...SOFT }],
  [1, K(1, { x: 0.16, y: -0.02, rf: [0.22, 0, 0], lf: [-0.02, 0, 0], pitchL: 20, lean: 4, turn: 16, head: 5, R: [-0.025, 0.92, 0.12, [1, -0.2, 0]], l: LOW_OPEN, ...SOFT })],
  [2, { x: 0.05, y: -0.03, rf: [0.22, 0, 0], lf: [-0.02, 0, 0], pitchR: 20, lean: -8, turn: -22, head: -6, nod: -4, r: HIGH_V, l: at(-1, -0.42, 0.98, 0.08, [0.4, -1, 0]), ...SOFT }],
  [3, { x: 0.1, y: -0.05, rf: [0.22, 0, 0], lf: [-0.02, 0, 0], nod: 4, r: LOW_OPEN, l: [50, 8, 56, 14], ...SOFT }],
];

// Palm press (lyrical): turned toward each other, both palms pressed together, then released open.
const PRESS_SPIN = 65;
const palmPress: Keys = [
  [0, K(1, { x: 0.3, y: -0.03, spin: PRESS_SPIN, ...feet(0.3, 0.08), nod: 4, R: [-0.022, 0.86, -0.04, E_LOW], L: [-0.022, 0.86, 0.07, E_LOW], ...SOFT })],
  [1, K(1, { x: 0.32, y: -0.02, spin: PRESS_SPIN, ...feet(0.3, 0.08), bend: 5, pitchR: 15, pitchL: 15, nod: 6, R: [-0.022, 0.9, -0.04, E_LOW], L: [-0.022, 0.9, 0.07, E_LOW], ...SOFT })],
  [2, { x: 0.27, y: -0.03, spin: 30, ...feet(0.27, 0.08), bend: -6, nod: -8, r: HIGH_V, l: HIGH_V, ...SOFT }],
  [3, { x: 0.29, y: -0.05, spin: 55, ...feet(0.29, 0.08), nod: 6, r: at(1, 0.08, 0.66, 0.2, [1, -0.4, 0]), l: at(-1, -0.08, 0.66, 0.2, [1, -0.4, 0]), ...SOFT }],
];

// Counterbalance (lyrical): inner hands joined, lean away from each other with the outer arm curved overhead.
const counterbalance: Keys = [
  [0, K(1, { x: 0.2, y: -0.03, ...feet(0.2, 0.09), nod: 4, R: [-0.02, 0.8, 0.1, E_LOW], l: LOW_OPEN, handR: 0.6, handL: 1 })],
  [1, K(1, { x: 0.18, y: -0.05, rf: [0.29, 0, 0], lf: [0.11, 0, 0], lean: -12, head: -6, turn: -10, R: [-0.02, 0.78, 0.1, E_LOW], l: at(-1, -0.05, 1.1, 0.06, [1, 0.2, 0]), handR: 0.6, handL: 1 })],
  [2, K(1, { x: 0.18, y: -0.06, rf: [0.29, 0, 0], lf: [-0.1, 0, 0.02], pitchL: 40, slideL: true, lean: -16, head: -8, turn: -16, R: [-0.02, 0.76, 0.1, E_LOW], l: at(-1, -0.08, 1.1, 0.04, [1, 0.2, 0]), handR: 0.6, handL: 1 })],
  [3, K(1, { x: 0.2, y: -0.04, ...feet(0.2, 0.09), slideL: true, turn: 14, nod: -4, R: [-0.02, 0.8, 0.1, E_LOW], l: SECOND, handR: 0.6, handL: 1 })],
];

// Two-hand turn (lyrical): facing each other, both hands joined, walking slowly round each other.
// On a circle the two bodies spent the middle of each half-turn on top of each other (one straight in
// front of the other); the orbit is an ellipse about twice as wide across the screen as it is deep,
// so they stay apart on the screen longer and pass close in front / behind only briefly. The joined
// hands are placed for every key (reachTo: the partner distance changes round the ellipse); P2 is P1
// turned 180 deg about the centre, so the same arm angles meet P1's hands from the other side.
const TWO_RX = 0.29;
const TWO_RZ = 0.15;
const twoHandTurn = ((): { p1: Keys; p2: Keys } => {
  const o = orbitKeys([TWO_RX, TWO_RZ], 1, 90, 0, { ...SOFT, nod: 4 }, 8, 0.35);
  const p1: Keys = o.p1.map(([t, k]) => {
    const rad = (((k.spin ?? 90) - 90) * Math.PI) / 180;
    // From P1 toward the centre (x across, z toward the viewer), and P1's right of that line.
    const ux = TWO_RX * Math.cos(rad), uz = -TWO_RZ * Math.sin(rad);
    const ul = Math.hypot(ux, uz);
    const rx = uz / ul, rz = -ux / ul;
    const z1 = TWO_RZ * Math.sin(rad);
    const W = 0.08, Y = 0.8;
    return [t, K(1, { ...k, R: [W * rx, Y, W * rz - z1, E_LOW], L: [-W * rx, Y, -W * rz - z1, E_LOW] })] as const;
  });
  const p2: Keys = o.p2.map(([t, k], i) => [t, { ...k, r: p1[i][1].r, l: p1[i][1].l }] as const);
  return { p1, p2 };
})();

// Lunge and gather (lyrical, deep): hands joined, lunge away with a long reach, then pull in turned to each other.
const lungeGather: Keys = [
  [0, K(1, { x: 0.2, y: -0.04, ...feet(0.2, 0.09), R: [-0.02, 0.8, 0.1, E_LOW], l: LOW_OPEN, handR: 0.6, handL: 1 })],
  [1, K(1, { x: 0.15, y: -0.14, rf: [0.27, 0, 0], lf: [-0.08, 0, 0.02], kneeL: 0.12, lean: -10, turn: -24, R: [-0.02, 0.72, 0.1, E_LOW], l: at(-1, -0.42, 1.0, 0.1, [0.4, -1, 0]), handR: 0.6, handL: 1 })],
  [2, K(1, { x: 0.15, y: -0.12, rf: [0.27, 0, 0], lf: [-0.08, 0, 0.02], kneeL: 0.12, pitchR: 25, lean: -12, turn: -30, nod: -6, R: [-0.02, 0.74, 0.1, E_LOW], l: at(-1, -0.44, 1.06, 0.06, [0.4, -1, 0]), handR: 0.6, handL: 1 })],
  [3, K(1, { x: 0.26, y: -0.05, spin: 40, ...feet(0.26, 0.08), bend: 10, nod: 12, shR: 0.3, shL: 0.3, R: [-0.02, 0.8, 0.08, E_LOW], l: HEART_L, handR: 0.6, handL: 1 })],
];

/**
 * A move the pair travel TOGETHER (both step the same way): `f(s)` is P1's key
 * with the pair shifted by s (screen right +); P2 is the mirror of P1 shifted
 * the other way, i.e. P2 shifted the same way as P1.
 */
function together(steps: readonly (readonly [number, number])[], f: (s: number, i: number) => PoseSpec): { p1: Keys; p2: Keys } {
  return {
    p1: steps.map(([t, s], i) => [t, f(s, i)] as const),
    p2: steps.map(([t, s], i) => [t, mir(f(-s, i))] as const),
  };
}

// Dap (hip-hop): slap, grip, pull in to a shoulder bump, step back and point.
const dap: Keys = [
  [0, K(1, { x: 0.3, y: -0.04, ...feet(0.3, 0.1), lean: 2, R: [-0.02, 0.96, 0.1, [0.6, 0, -0.6]], l: ARM.rest, handR: 1, handL: 0.5 })],
  [1, K(1, { x: 0.32, y: -0.05, ...feet(0.31, 0.1), R: [-0.02, 0.8, 0.14, [0.3, -1, -0.1]], l: ARM.rest, handR: 0, handL: 0.5, nod: 4 })],
  [2, K(1, { x: 0.345, y: -0.04, ...feet(0.34, 0.1), lean: 4, head: 4, R: [-0.02, 0.76, 0.13, [0.3, -1, -0.1]], l: [30, -40, 50, -30], handR: 0, handL: 1 })],
  [3, { x: 0.25, y: -0.03, ...feet(0.25, 0.1), lean: -3, r: at(1, 0.38, 0.92, 0.14, [0.3, -1, 0]), formR: 'point', l: ARM.rest, handR: 0, handL: 0.5, head: -3 }],
];

// Shoulder to shoulder (hip-hop / drill): close side by side, knees bouncing, shoulders rocking, inner shoulders knocking.
const SHB_X = 0.33;
const shoulderBounce: Keys = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => {
  const down = Number.isInteger(t);
  const inner = down && t % 2 === 0;
  const outer = down && t % 2 === 1;
  const fwd = inner ? ARM.swingFwd : outer ? ARM.swingBack : ARM.rest;
  const back = inner ? ARM.swingBack : outer ? ARM.swingFwd : ARM.rest;
  return [t, {
    x: SHB_X, y: down ? -0.08 : -0.03, ...feet(SHB_X, 0.1),
    shR: inner ? 0.9 : 0.15, shL: outer ? 0.9 : 0.15, lean: inner ? 4 : outer ? -4 : 0, nod: down ? 8 : -2,
    r: fwd, l: back, handR: 0, handL: 0,
  }] as const;
});

// Back to back (hip-hop): backs turned to each other, arms folded, bounce; lean back on each other, then point out.
// Truly back to back: each turned a full quarter AWAY from the partner (spin -90, P2 mirrored), roots
// 0.40 apart so the two backs nearly touch; at -60 they read as two people facing the front, and at
// -105 the backs of the heads show. On the lean the roots come in a little (x 0.32, not further:
// the leaning bodies must not cross).
const B2B_SPIN = -90;
const B2B_X = 0.3;
const B2B_LEAN_X = 0.32;
const backLean: Keys = [
  [0, { x: B2B_X, y: -0.07, spin: B2B_SPIN, ...feet(B2B_X, 0.09), ...FOLD, nod: 10 }],
  [1, { x: B2B_X, y: -0.03, spin: B2B_SPIN, ...feet(B2B_X, 0.09), ...FOLD, nod: -4 }],
  [2, { x: B2B_LEAN_X, y: -0.05, spin: B2B_SPIN, ...feet(B2B_X, 0.09), ...FOLD, bend: -10, nod: -10 }],
  // Opening out to the crowd: turned back a little toward the front, the near (right) hand points out on the diagonal.
  [3, { x: B2B_X, y: -0.04, spin: B2B_SPIN + 20, ...feet(B2B_X, 0.09), l: ARM.hip, r: at(1, 0.38, 0.92, 0.12, [0.3, -1, 0]), formR: 'point', handR: 0, handL: 0, turn: 10 }],
];

// Toprock face-off (hip-hop): turned toward each other, one steps in and opens the arms as the other steps back and kicks.
const TOP_SPIN = 40;
const toprock: Keys = [
  [0, { x: 0.2, y: -0.06, spin: TOP_SPIN, rf: [0.3, 0, 0.04], lf: [0.06, 0, 0], bend: 4, twist: 8, r: [60, 20, 70, 40], l: [60, 20, 70, 40], ...SOFT }],
  [1, { x: 0.1, y: -0.03, spin: TOP_SPIN, ...feet(0.1, 0.1), nod: 6, r: at(1, -0.07, 0.7, 0.17, [0.6, -0.6, -0.2]), l: at(-1, 0.07, 0.74, 0.19, [0.6, -0.6, -0.2]), handR: 0, handL: 0 }],
  [2, { x: 0.08, y: -0.04, spin: TOP_SPIN, rf: [0.24, 0.06, 0.08], lf: [0.0, 0, 0], lean: -4, r: ARM.guard, l: [70, 10, 80, 20], handR: 0, handL: 0 }],
  [3, { x: 0.1, y: -0.07, spin: TOP_SPIN, ...feet(0.1, 0.1), nod: 8, r: ARM.guard, l: ARM.guard, handR: 0, handL: 0 }],
];
/** P2 dances P1's step two beats later (mirrored): one steps in while the other steps back. */
const toprockP2: Keys = toprock.map(([t, s]) => [(t + 2) % 4, mir(s)] as const).sort((a, b) => a[0] - b[0]);

// Pump and clap (EDM / house / bass): outer fist pumps twice, inner hands clap high together, hands up.
const PUMP_UP: PoseSpec['r'] = [150, 10, 160, 10];
const PUMP_IN: PoseSpec['r'] = [95, 10, 170, 10];
const pumpClap: Keys = [
  [0, { x: IN, y: -0.08, ...feet(IN, 0.11), l: PUMP_UP, r: ARM.low, handL: 0, handR: 0, nod: 6 }],
  [0.5, { x: IN, y: -0.03, ...feet(IN, 0.11), l: PUMP_IN, r: ARM.low, handL: 0, handR: 0, nod: -2 }],
  [1, { x: IN, y: -0.08, ...feet(IN, 0.11), l: PUMP_UP, r: ARM.low, handL: 0, handR: 0, nod: 6 }],
  [1.5, { x: IN, y: -0.03, ...feet(IN, 0.11), l: PUMP_IN, r: [60, 10, 90, 20], handL: 0, handR: 1, nod: -2 }],
  [2, K(1, { x: IN, y: -0.05, ...feet(IN, 0.11), lean: 3, R: [-0.025, 1.02, 0.06, [0.6, 0, -0.6]], l: PUMP_IN, handR: 1, handL: 0 })],
  [3, { x: IN, y: -0.06, ...feet(IN, 0.11), r: [160, 0, 168, 0], l: [160, 0, 168, 0], ...SOFT }],
];

// Build and drop (EDM / bass): hands rise on the build, crouch, jump on the drop slapping inner hands overhead, pump.
const BD_SPIN = 25;
const buildDrop: Keys = [
  [0, { x: IN, y: -0.06, spin: BD_SPIN, ...feet(IN, 0.1), r: at(1, 0.12, 0.78, 0.2, [0.6, -0.6, -0.4]), l: at(-1, -0.12, 0.78, 0.2, [0.6, -0.6, -0.4]), ...SOFT }],
  [1, { x: IN, y: -0.04, spin: BD_SPIN, ...feet(IN, 0.1), r: [100, 20, 120, 20], l: [100, 20, 120, 20], ...SOFT }],
  [2, { x: IN, y: -0.06, spin: BD_SPIN, ...feet(IN, 0.1), r: HIGH_V, l: HIGH_V, ...SOFT, nod: -6 }],
  [3, { x: IN, y: -0.15, spin: BD_SPIN, ...feet(IN, 0.11), bend: 12, nod: 8, r: [30, -30, 40, -20], l: [30, -30, 40, -20], ...SOFT }],
  [4, K(1, { x: IN + 0.02, y: 0.08, spin: 15, rf: [IN + 0.11, 0.08, 0], lf: [IN - 0.07, 0.08, 0], R: [-0.02, 1.15, 0.04, [0.6, 0, -0.6]], l: [160, 0, 168, 0], ...SOFT })],
  [5, { x: IN, y: -0.13, spin: BD_SPIN, ...feet(IN, 0.11), bend: 8, r: ARM.low, l: ARM.low, ...SOFT }],
  [6, { x: IN, y: -0.08, spin: BD_SPIN, ...feet(IN, 0.11), l: PUMP_UP, r: PUMP_IN, handR: 0, handL: 0, nod: 6 }],
  [7, { x: IN, y: -0.04, spin: BD_SPIN, ...feet(IN, 0.11), l: PUMP_IN, r: PUMP_UP, handR: 0, handL: 0, nod: -2 }],
];

// Shuffle cross-over (EDM / house): side-shuffle across past each other (P1 in front), a beat on the far side, and back (P1 behind).
function shuffleCross(): { p1: Keys; p2: Keys } {
  const p1: Keys = [];
  const p2: Keys = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 2;
    // 0 -> DUO_HOME over beats 0..3, hold to 4, back over 4..7, hold to 8.
    const u = t < 3 ? t / 3 : t < 4 ? 1 : t < 7 ? 1 - (t - 4) / 3 : 0;
    const X = DUO_HOME * u;
    const out = (t < 3) || (t >= 4 && t < 7);
    const dir = t < 4 ? 1 : -1;
    const lead = i % 2 === 0;
    // Slide steps: the lead foot glides out on the beat, the other closes on the "and".
    const rf: [number, number, number] = [X + (dir > 0 && lead && out ? 0.1 : 0.06), 0, 0];
    const lf: [number, number, number] = [X - (dir < 0 && lead && out ? 0.1 : 0.06), 0, 0];
    const arms = lead ? { r: ARM.swingFwd, l: ARM.swingBack } : { r: ARM.swingBack, l: ARM.swingFwd };
    const k: PoseSpec = { x: X, y: lead ? -0.07 : -0.03, rf, lf, slideR: !lead, slideL: lead, ...arms, handR: 0, handL: 0, nod: lead ? 6 : 0, pitchR: lead ? 0 : 20, pitchL: lead ? 20 : 0 };
    p1.push([t, k]);
    p2.push([t, mir(k)]);
  }
  return { p1, p2 };
}
const shuffleCrossKeys = shuffleCross();

// Dance-hold side step (R&B / Latin): turned toward each other holding both hands, step-touch side to side together.
const HOLD_SPIN = 50;
// Roots 0.40 apart (0.36 overlapped the two turned bodies) and a bigger step each way, so the travel together shows.
const HOLD_X = 0.3;
const holdStep = together([[0, 0.08], [1, 0.08], [2, -0.06], [3, -0.06]], (s, i) => {
  const X = HOLD_X + s;
  const tap = i % 2 === 1;
  const right = i < 2;
  return K(1, {
    x: X, y: tap ? -0.03 : -0.06, spin: HOLD_SPIN,
    rf: [X + (tap && !right ? 0.03 : 0.08), 0, 0], lf: [X - (tap && right ? 0.03 : 0.08), 0, 0], pitchR: tap && !right ? 25 : 0, pitchL: tap && right ? 25 : 0,
    hips: tap ? (right ? 0.05 : -0.05) : 0, tilt: tap ? (right ? 6 : -6) : 0, head: right ? 3 : -3,
    R: [s - 0.02, 0.82, -0.02, [0.6, -0.6, -0.4]], L: [s - 0.02, 0.72, 0.2, [0.6, -0.6, -0.4]], ...SOFT,
  });
});

// Hip-bump walk (reggaeton / dancehall / Latin): step-touch the same way together, bumping inner hips on the touch.
const HBW_X = 0.28;
const hipBumpWalk = together([[0, 0.08], [1, 0.08], [2, 0], [3, 0]], (s, i) => {
  const X = HBW_X + s;
  const bump = i % 2 === 1;
  return {
    x: X, y: bump ? -0.06 : -0.04, ...feet(X, bump ? 0.1 : 0.12),
    hips: bump ? 0.085 : -0.02, tilt: bump ? 12 : -3, lean: bump ? -12 : 2, head: bump ? -6 : 0,
    r: BUMP_INNER, l: bump ? [150, 0, 160, 0] : [100, 10, 120, 20], handR: 1, handL: 1,
  };
});

// Samba side by side (Brazilian / Latin): inner hands joined, samba bounce steps ("1 a 2") travelling one way and back.
const SAMBA_ARM: readonly NonNullable<PoseSpec['l']>[] = [[150, 10, 160, 20], [110, 15, 125, 30], [80, 20, 95, 40], [150, 10, 160, 20], [110, 15, 125, 30], [80, 20, 95, 40]];
const sambaSide = together([[0, 0.04], [0.75, 0.07], [1, 0.1], [2, 0.06], [2.75, 0.03], [3, 0]], (s, i) => {
  const X = IN + s;
  const ball = i % 3 === 1;
  const rightWay = i < 3;
  const down = !ball;
  return K(1, {
    x: X, y: down ? -0.08 : -0.02,
    rf: [X + 0.09, ball && !rightWay ? 0.03 : 0, ball ? -0.04 : 0], lf: [X - 0.09, ball && rightWay ? 0.03 : 0, ball ? -0.04 : 0], pitchR: ball ? 30 : 0, pitchL: ball ? 30 : 0,
    hips: down ? (rightWay ? 0.04 : -0.04) : 0, tilt: down ? (rightWay ? 5 : -5) : 0,
    // The outer arm sweeps up over each "2" (beats 1 -> 2 and 3 -> 4) and floats down through the steps.
    R: [s - 0.025, 0.9, 0.1, [0.6, -0.6, -0.4]], l: SAMBA_ARM[i], ...SOFT,
  });
});

// Mirror body roll (R&B): turned toward each other, inner palms pressed, rolling the body down and back up together.
// The wave is staged for the front as a sequence (the front-to-back roll alone read as two people
// standing still): chin and chest lift high, the chest drops and slides over toward the partner, the
// hips push out under it as the knees sink deep, then a slow rise with the free arm opening. The
// pressed palms slide down with the wave from above the heads to the waist.
const ROLL_SPIN = 35;
const ROLL_X = 0.26;
const bodyRoll: Keys = [
  [0, K(1, { x: ROLL_X, y: -0.01, spin: ROLL_SPIN, ...feet(ROLL_X, 0.1), bend: -10, nod: -12, chestX: -0.02, lean: -3, shR: 0.8, shL: 0.6, R: [-0.025, 0.95, 0.07, E_LOW], l: ARM.hip, handR: 1, handL: 0 })],
  [1, K(1, { x: ROLL_X, y: -0.06, spin: ROLL_SPIN, ...feet(ROLL_X, 0.1), bend: 10, nod: 8, chestX: 0.03, lean: 3, hips: -0.02, R: [-0.025, 0.84, 0.1, E_LOW], l: ARM.hip, handR: 1, handL: 0 })],
  [2, K(1, { x: ROLL_X, y: -0.15, spin: ROLL_SPIN, ...feet(ROLL_X, 0.11), kneeR: 0.12, kneeL: 0.22, bend: 4, nod: 4, chestX: -0.02, lean: -3, hips: 0.07, tilt: 9, R: [-0.025, 0.7, 0.1, E_LOW], l: ARM.hip, handR: 1, handL: 0 })],
  [3, { x: ROLL_X, y: -0.06, spin: ROLL_SPIN - 10, ...feet(ROLL_X, 0.1), bend: -2, nod: -2, hips: 0.02, tilt: 2, r: [70, 20, 100, 40], l: [80, 10, 90, 20], handR: 1, handL: 1 }],
];

// Back-to-back air guitar (rock): backs together, both shredding, headbanging on the beat; lean back on each other.
// Same staging as the back-to-back lean (spin -90, roots 0.40 apart). In profile the guitar is placed
// for the turned body: the neck reaches FORWARD (which is out to the side on the screen) and a little
// up, the strumming hand works in front of the hips.
const STRUM_DOWN = at(1, 0.08, 0.48, 0.2);
const STRUM_UP = at(1, 0.06, 0.6, 0.19);
const NECK = at(-1, -0.12, 0.84, 0.3, [0.2, -1, 0]);
const NECK_UP = at(-1, -0.12, 0.98, 0.26, [0.2, -1, 0]);
const backGuitar: Keys = [
  [0, { x: B2B_X, y: -0.1, spin: B2B_SPIN, ...feet(B2B_X, 0.11), r: STRUM_DOWN, l: NECK, handR: 0, handL: 0, nod: 14 }],
  [0.5, { x: B2B_X, y: -0.06, spin: B2B_SPIN, ...feet(B2B_X, 0.11), r: STRUM_UP, l: NECK, handR: 0, handL: 0, nod: -2 }],
  [1, { x: B2B_X, y: -0.1, spin: B2B_SPIN, ...feet(B2B_X, 0.11), r: STRUM_DOWN, l: NECK, handR: 0, handL: 0, nod: 14 }],
  [1.5, { x: B2B_X, y: -0.06, spin: B2B_SPIN, ...feet(B2B_X, 0.11), r: STRUM_UP, l: NECK, handR: 0, handL: 0, nod: -2 }],
  [2, { x: B2B_LEAN_X, y: -0.07, spin: B2B_SPIN, ...feet(B2B_X, 0.11), bend: -10, r: STRUM_DOWN, l: NECK_UP, handR: 0, handL: 0, nod: -6 }],
  [3, { x: B2B_LEAN_X, y: -0.05, spin: B2B_SPIN, ...feet(B2B_X, 0.11), bend: -8, r: STRUM_UP, l: NECK_UP, handR: 0, handL: 0, nod: -10 }],
];

// Shoulder-bump hop (rock / punk): crouch, hop in and knock inner shoulders in the air, land, fist up.
const shoulderHop: Keys = [
  [0, { x: 0.22, y: -0.12, ...feet(0.22, 0.11), bend: 8, r: [30, -20, 40, 0], l: [30, -20, 40, 0], handR: 0, handL: 0 }],
  [1, { x: 0.33, y: 0.06, rf: [0.42, 0.07, 0], lf: [0.24, 0.07, 0], lean: 8, head: 6, r: [25, -40, 40, -30], l: [60, 10, 70, 20], handR: 0, handL: 0 }],
  [2, { x: 0.3, y: -0.1, ...feet(0.3, 0.11), r: ARM.low, l: ARM.low, handR: 0, handL: 0 }],
  [3, { x: 0.25, y: -0.04, ...feet(0.25, 0.1), r: ARM.rest, l: [160, 0, 168, 0], handR: 0.5, handL: 0, nod: -4 }],
];

// Horns up together (rock / metal): inner hands joined and raised, outer hand throwing the horns, headbanging.
const HORNS_X = 0.3;
const hornsUp: Keys = ([[0, -0.08, 14, true], [1, -0.03, -4, false], [2, -0.08, 14, true], [3, -0.04, 0, false]] as const).map(([t, y, nod, up]) => [t, K(1, {
  x: HORNS_X, y, ...feet(HORNS_X, 0.11), nod,
  // The joined hands ride with the bounce (raised high, lowered to the shoulders on 4).
  R: [-0.02, (t === 3 ? 0.86 : 1.02) + y, t === 3 ? 0.1 : 0.04, t === 3 ? E_LOW : [0.7, 0.1, -0.5]],
  l: up ? [150, 10, 160, 10] : t === 3 ? at(-1, -0.2, 0.95, 0.27, [0.3, -1, 0]) : PUMP_IN, handR: 1, handL: 0, formL: 'horns',
})] as const);

// Vosho together (amapiano): inner hands joined, slow knee bounces on the log drum, a sudden drop, and a rolling rise.
const voshoPair: Keys = [
  [0, K(1, { x: IN, y: -0.06, ...feet(IN, 0.12), hips: 0.02, nod: 4, R: [-0.02, 0.66, 0.12, E_LOW], l: [30, 10, 40, 30], handR: 0.6, handL: 1 })],
  [1, K(1, { x: IN, y: -0.1, ...feet(IN, 0.12), hips: -0.02, nod: 6, R: [-0.02, 0.62, 0.12, E_LOW], l: [30, 10, 40, 30], handR: 0.6, handL: 1 })],
  [2, K(1, { x: IN, y: -0.22, ...feet(IN, 0.14), kneeR: 0.15, kneeL: 0.15, bend: 8, nod: 10, R: [-0.02, 0.48, 0.14, E_LOW], l: [60, 20, 80, 40], handR: 0.6, handL: 1 })],
  [3, K(1, { x: IN, y: -0.08, ...feet(IN, 0.12), hips: 0.04, tilt: 6, turn: 10, R: [-0.02, 0.64, 0.12, E_LOW], l: [100, 30, 130, 60], handR: 0.6, handL: 1 })],
];

const STYLE_DEFS: PartnerDef[] = [
  // --- Calm songs (lyrical): gentle, joined or mirrored, no hits -------------------
  {
    id: 'duo-reach-in-away', name: 'Reach In, Reach Away', tags: 'pop | arms | hands', level: 'low', d: 1, beats: 4, parts: ['arms', 'torso'], styles: ['lyrical'], gentle: true,
    desc: 'Side by side, both reach your inner hands slowly toward each other until the fingertips meet, then sweep away: inner arm up, outer arm reaching long out to your own side, weight and gaze following it.',
    p1: reachInAway,
    contacts: [HANDS(1, 0.08)],
  },
  {
    id: 'duo-palm-press', name: 'Palm Press & Release', tags: 'pop | arms | hands', level: 'low', d: 1, beats: 4, parts: ['arms'], styles: ['lyrical'], gentle: true,
    desc: 'Turn toward each other and press both palms together at chest height, lean softly into it, then let go and open both arms high, and gather them back in.',
    p1: palmPress,
    contacts: [0, 1].flatMap((t) => [HANDS(t, 0.08), { at: t, a: [1, J.HA_L] as const, b: [2, J.HA_R] as const, tol: 0.08 }]),
  },
  {
    id: 'duo-counterbalance', name: 'Counterbalance', tags: 'pop | full | hands', level: 'mid', d: 1, beats: 4, parts: ['arms', 'torso'], styles: ['lyrical'], gentle: true,
    desc: 'Hold inner hands and lean away from each other, the outer arm curving up over your head and the outer foot sliding out to a point; hang there, then come back upright together.',
    p1: counterbalance,
    contacts: [0, 1, 2, 3].map((t) => HANDS(t, 0.08)),
  },
  {
    id: 'duo-two-hand-turn', name: 'Two-Hand Turn', tags: 'pop | turn | spin hands walk', level: 'low', d: 2, beats: 8, parts: ['turn', 'legs'], styles: ['lyrical'], gentle: true,
    desc: 'Face each other holding both hands and walk slowly round each other in a full circle, wide to the sides and passing quickly in front and behind, arms soft, eyes on your partner.',
    p1: twoHandTurn.p1, p2: twoHandTurn.p2, orbit: TWO_RZ, orbitSpin: orbitSpinOffset(1, 90),
    contacts: [0, 2, 4, 6].flatMap((t) => [HANDS(t, 0.08), { at: t, a: [1, J.HA_L] as const, b: [2, J.HA_R] as const, tol: 0.08 }]),
  },
  {
    id: 'duo-lunge-gather', name: 'Lunge & Gather', tags: 'pop | full | hands', level: 'high', d: 2, beats: 4, parts: ['legs', 'arms', 'torso'], styles: ['lyrical'], gentle: true,
    desc: 'Inner hands joined, both sink into a deep side lunge away from each other with the outer arm reaching long and high; stretch further, then draw back in, turned to each other, outer palm to your chest.',
    p1: lungeGather,
    contacts: [0, 1, 2, 3].map((t) => HANDS(t, 0.09)),
  },

  // --- Hip-hop (trap and drill open it too) ---------------------------------------
  {
    id: 'duo-dap', name: 'Dap Handshake', tags: 'hiphop | arms | hands', level: 'low', d: 1, beats: 4, parts: ['arms'], styles: ['hiphop', 'rnb'],
    desc: 'Step in and slap inner hands, grip them at the chest, pull in to knock shoulders, then step back and point at each other.',
    p1: dap,
    contacts: [HANDS(0, 0.08), HANDS(1, 0.08), HANDS(2, 0.09), { at: 2, a: [1, J.SH_R], b: [2, J.SH_L], tol: 0.08 }],
  },
  {
    id: 'duo-shoulder-bounce', name: 'Shoulder-to-Shoulder Bounce', tags: 'hiphop | full | shake', level: 'mid', d: 1, beats: 4, parts: ['legs', 'torso'], styles: ['hiphop'],
    desc: 'Stand close side by side and bounce on every beat, rocking the shoulders in turn: on 1 and 3 your inner shoulders knock together.',
    p1: shoulderBounce,
    contacts: [0, 2].map((t) => ({ at: t, a: [1, J.SH_R] as const, b: [2, J.SH_L] as const, tol: 0.1 })),
  },
  {
    id: 'duo-back-lean', name: 'Back-to-Back Lean', tags: 'hiphop | full | point', level: 'mid', d: 2, beats: 4, parts: ['torso', 'legs'], styles: ['hiphop'],
    desc: 'Turn a full quarter away from each other so your backs are together, arms folded, and bounce; lean back on each other with the chin up, then turn out a little and point to the crowd.',
    p1: backLean,
  },
  {
    id: 'duo-toprock-face-off', name: 'Toprock Face-Off', tags: 'hiphop | legs | kick', level: 'high', d: 2, beats: 4, parts: ['legs', 'arms'], styles: ['hiphop'],
    desc: 'Turned toward each other: step in and open your arms ("come on") while your partner steps back and kicks, then swap, two beats apart.',
    p1: toprock, p2: toprockP2,
  },

  // --- Electronic: house, EDM, bass music ----------------------------------------
  {
    id: 'duo-pump-clap', name: 'Pump & Clap', tags: 'aerobic | arms | clap', level: 'mid', d: 1, beats: 4, parts: ['arms', 'legs'], styles: ['edm', 'house', 'bass'],
    desc: 'Bouncing side by side, pump your outer fist up twice, clap inner hands high together, then both hands up.',
    p1: pumpClap,
    contacts: [HANDS(2, 0.08)],
  },
  {
    id: 'duo-build-drop', name: 'Build & Drop', tags: 'aerobic | full | jump hands', level: 'high', d: 2, beats: 8, parts: ['jump', 'arms'], jump: true, impact: true, styles: ['edm', 'bass'],
    desc: 'Turned toward each other, raise your hands bit by bit over the build, crouch, jump on the drop and slap inner hands overhead, land and pump.',
    p1: buildDrop,
    contacts: [HANDS(4, 0.09)],
  },
  {
    id: 'duo-shuffle-cross', name: 'Shuffle Cross-Over', tags: 'aerobic | legs | walk', level: 'high', d: 3, beats: 8, parts: ['legs'], styles: ['edm', 'house'], trade: true,
    desc: 'Side-shuffle toward each other and on past (P1 in front) with slide steps and driving arms, a beat on the far side, then shuffle back (P1 behind).',
    p1: shuffleCrossKeys.p1, p2: shuffleCrossKeys.p2,
    depth: [[0, 0, 0], [1.5, 0.2, -0.2], [3, 0, 0], [4, 0, 0], [5.5, -0.2, 0.2], [7, 0, 0]],
  },

  // --- R&B and Latin: reggaeton, dancehall, Brazilian ------------------------------
  {
    id: 'duo-hold-step', name: 'Dance-Hold Side Step', tags: 'latin pop | hips legs | hips hands', level: 'low', d: 1, beats: 4, parts: ['legs', 'hips'], styles: ['rnb', 'latin', 'reggaeton', 'caribbean'], gentle: true,
    desc: 'Turned toward each other in a loose hold, both hands joined, step and touch side to side together with a hip on the touch.',
    p1: holdStep.p1, p2: holdStep.p2,
    contacts: [0, 1, 2, 3].flatMap((t) => [HANDS(t, 0.08), { at: t, a: [1, J.HA_L] as const, b: [2, J.HA_R] as const, tol: 0.08 }]),
  },
  {
    id: 'duo-hip-bump-walk', name: 'Hip-Bump Walk', tags: 'latin party | hips legs | hips walk', level: 'mid', d: 2, beats: 4, parts: ['hips', 'legs'], styles: ['reggaeton', 'caribbean', 'latin'],
    desc: 'Side by side, step-touch the same way together and bump inner hips on the touch, outer arm up; then back the other way.',
    p1: hipBumpWalk.p1, p2: hipBumpWalk.p2,
    contacts: [1, 3].map((t) => ({ at: t, a: [1, J.HIP_R] as const, b: [2, J.HIP_L] as const, tol: 0.16 })),
  },
  {
    id: 'duo-samba-side', name: 'Samba Side by Side', tags: 'latin | legs hips | hands', level: 'mid', d: 2, beats: 4, parts: ['legs', 'hips'], styles: ['brazil', 'latin'],
    desc: 'Inner hands joined, samba bounce steps ("1 a 2") travelling one way together and back, the outer arm sweeping up on each "2".',
    p1: sambaSide.p1, p2: sambaSide.p2,
    contacts: [0, 1, 2, 3].map((t) => HANDS(t, 0.08)),
  },
  {
    id: 'duo-body-roll', name: 'Mirror Body Roll', tags: 'funk pop | full | wave hands', level: 'mid', d: 2, beats: 4, parts: ['torso', 'hips'], styles: ['rnb'], gentle: true,
    desc: 'Turned toward each other, inner palms pressed together up high, roll the body down: chin and chest lift, the chest drops and leans in, the hips push out as the knees sink deep, the palms sliding down together; rise and open the arms.',
    p1: bodyRoll,
    contacts: [0, 1, 2].map((t) => HANDS(t, 0.08)),
  },

  // --- Rock: metal and punk open it too -----------------------------------------
  {
    id: 'duo-back-guitar', name: 'Back-to-Back Air Guitar', tags: 'rock | arms |', level: 'mid', d: 2, beats: 4, parts: ['arms', 'torso'], styles: ['rock'],
    desc: 'Turned a full quarter away from each other with your backs together, both shred an air guitar with the neck out in front of you and headbang on the beat, then lean back on each other with the necks raised.',
    p1: backGuitar,
  },
  {
    id: 'duo-shoulder-hop', name: 'Shoulder-Bump Hop', tags: 'rock | full | jump', level: 'high', d: 2, beats: 4, parts: ['jump', 'torso'], jump: true, impact: true, styles: ['rock'],
    desc: 'Crouch, hop in toward each other and knock inner shoulders in the air, land, step back with a fist up.',
    p1: shoulderHop,
    contacts: [{ at: 1, a: [1, J.SH_R], b: [2, J.SH_L], tol: 0.08 }],
  },
  {
    id: 'duo-horns-up', name: 'Horns Up Together', tags: 'rock | arms | hands', level: 'low', d: 1, beats: 4, parts: ['arms'], styles: ['rock'],
    desc: 'Side by side, inner hands joined and raised, throw the horns up with the outer hand and headbang on 1 and 3; on 4 point the horns at the crowd.',
    p1: hornsUp,
    contacts: [0, 1, 2, 3].map((t) => HANDS(t, 0.09)),
  },

  // --- Afro: amapiano -----------------------------------------------------------
  {
    id: 'duo-vosho-pair', name: 'Vosho Together', tags: 'latin hiphop | legs hips | hips hands', level: 'mid', d: 2, beats: 4, parts: ['legs', 'hips'], impact: true, styles: ['amapiano'],
    desc: 'Inner hands joined, bounce the knees slowly on the log drum, drop together into a sudden deep squat on 3, and roll back up through the hips.',
    p1: voshoPair,
    contacts: [0, 1, 2, 3].map((t) => HANDS(t, 0.09)),
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
  if (d.gentle && (d.jump || d.impact)) throw new Error(`${d.id}: a gentle partner move has no jumps or impact`);
  if (d.gentle && tags.themes.some((t) => PERCUSSIVE_THEMES.has(t))) throw new Error(`${d.id}: a gentle partner move has no percussive hits`);
  if (d.trade && !d.depth?.length) throw new Error(`${d.id}: a trade (crossing) needs a depth track`);
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
    orbitSpin: d.orbitSpin ?? 0,
    contacts: d.contacts ?? [],
    roles: !!d.cues,
    prop: d.prop ?? null,
    hook: d.hook ?? 0,
    styles: d.styles ?? [],
    gentle: !!d.gentle,
    trade: !!d.trade,
  };
}

/** Themes of percussive hits (a gentle partner move has none). */
export const PERCUSSIVE_THEMES: ReadonlySet<Theme> = new Set<Theme>(['clap', 'punch', 'stomp', 'kick', 'jump']);

/** Definition errors (skipped moves), for the tests. */
export const PARTNER_ERRORS: { id: string; message: string }[] = [];

/** Every partner move. */
export const PARTNER_MOVES: readonly PartnerMove[] = [...DEFS, ...STYLE_DEFS].flatMap((d) => {
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

const CARDS = new Map<Move, Move>();
/**
 * A partner move's half as the routine shows it: under the partner move's
 * own name for its whole length (one card, cards.ts), even when the two
 * halves give the players different roles. Same keys; partnerOf knows it.
 */
export function partnerCard(m: Move): Move {
  const own = OWNER.get(m);
  if (!own || m.name === own.pm.name) return m;
  let c = CARDS.get(m);
  if (!c) {
    c = { ...m, name: own.pm.name };
    CARDS.set(m, c);
    OWNER.set(c, own);
  }
  return c;
}

/** Depth offsets (z1, z2) of a partner move at move beat `b` (0..beats), given each player's current spin (orbit moves). */
export function partnerDepth(pm: PartnerMove, b: number, spin1: number, spin2: number, out: [number, number]): [number, number] {
  if (pm.orbit > 0) {
    // P2 is P1 turned 180 deg about the centre: opposite depth.
    void spin2;
    out[0] = pm.orbit * Math.sin(((spin1 - pm.orbitSpin) * Math.PI) / 180);
    out[1] = -out[0];
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
  // A beat a hair before a key (float noise, e.g. 0.99999999999997) counts as on it, not a whole loop later.
  let x = bb - t0;
  if (x < 0) x = x > -1e-6 ? 0 : x + L;
  const u = Math.max(0, Math.min(1, x / (t1 - t0)));
  const s = u * u * (3 - 2 * u);
  out[0] = k0[1] + (k1[1] - k0[1]) * s;
  out[1] = k0[2] + (k1[2] - k0[2]) * s;
  return out;
}

// ---------------------------------------------------------------------------
// Tempo: a partner move's speed limit (speed.ts, both tracks and the depth)

/** Pelvis speed limit (figure units / s), as speed.ts JOINT_V: walking round or past each other. */
const DEPTH_PELVIS_V = 0.9;

const TRACKS = new WeakMap<PartnerMove, readonly [Move, Move]>();
/**
 * One player's whole track as one move (its 4-beat halves back to back), so
 * the speed measure sees every key-to-key segment, the boundaries between
 * halves and the wrap back to the start included.
 */
export function partnerTrack(pm: PartnerMove, player: Player): Move {
  let t = TRACKS.get(pm);
  if (!t) {
    const mk = (hs: readonly Move[], p: Player): Move => {
      const keys: MoveKey[] = hs.flatMap((m, i) => m.keys.map((k) => ({ at: k.at + 4 * i, pose: k.pose })));
      return { ...hs[0], id: `${pm.id}.p${p}.track`, beats: pm.beats as 4, keys, mirrorKeys: keys, mirror: false, travel: 0, jump: pm.jump, whole: undefined, part: undefined };
    };
    t = [mk(pm.p1, 1), mk(pm.p2, 2)] as const;
    TRACKS.set(pm, t);
  }
  return t[player - 1];
}

export interface PartnerSpeed {
  /** Highest tempo (move beats per minute) the partner move can be danced at: the slower player sets it. */
  limit: number;
  /** What sets it: 'P1 travel:hand', 'P2 turn', 'depth' ... */
  by: string;
}

const PSPEED = new WeakMap<PartnerMove, PartnerSpeed>();
/**
 * Speed limit of a partner move (cached): the lower of the two players'
 * tracks (speed.ts moveSpeed: joint travel, turns, key density; a hand
 * going into a contact is a hand travelling, so a contact the hands cannot
 * reach in time sets the limit) and of the depth the stage adds (passing in
 * front / behind, circling round each other), which the poses don't carry.
 */
export function partnerSpeed(pm: PartnerMove): PartnerSpeed {
  const hit = PSPEED.get(pm);
  if (hit) return hit;
  let limit = MAX_LIMIT_BPM;
  let by = 'none';
  for (const p of [1, 2] as const) {
    const s = moveSpeed(partnerTrack(pm, p));
    if (s.limit < limit) {
      limit = s.limit;
      by = `P${p} ${s.by}`;
    }
  }
  if (pm.orbit > 0 || pm.depth.length) {
    const spinKeys = partnerTrack(pm, 1).keys;
    const spinAt = (b: number) => {
      let s = spinKeys[0].pose[CH.SPIN];
      for (const k of spinKeys) if (k.at <= b + 1e-9) s = k.pose[CH.SPIN];
      return s;
    };
    const za: [number, number] = [0, 0];
    const zb: [number, number] = [0, 0];
    for (const p of [1, 2] as const) {
      const ks = partnerTrack(pm, p).keys;
      for (let i = 0; i < ks.length; i++) {
        const a = ks[i];
        const last = i === ks.length - 1;
        const b = last ? ks[0] : ks[i + 1];
        const beats = last ? pm.beats - a.at + b.at : b.at - a.at;
        if (beats <= 1e-9) continue;
        partnerDepth(pm, a.at, spinAt(a.at), 0, za);
        partnerDepth(pm, b.at, spinAt(b.at), 0, zb);
        const d = Math.hypot(b.pose[CH.X] - a.pose[CH.X], zb[p - 1] - za[p - 1]);
        if (d < 1e-6) continue;
        const lim = (60 * beats * DEPTH_PELVIS_V) / d;
        if (lim < limit) {
          limit = lim;
          by = 'depth';
        }
      }
    }
  }
  const out = { limit: Math.max(30, Math.min(MAX_LIMIT_BPM, limit)), by };
  PSPEED.set(pm, out);
  return out;
}

/**
 * How a partner move is danced on a song of `bpm`, as speed.ts
 * moveTempoMode: full time within its limit (times the level's share), half
 * time when half the tempo is (and both tracks read at half time: no jump
 * floating), else 'out'. Both players always share the mode.
 */
export function partnerTempoMode(pm: PartnerMove, bpm: number | undefined, level: SpeedLevel = 'cardio'): TempoMode {
  if (!bpm || !Number.isFinite(bpm) || bpm <= 0) return 'full';
  const lim = partnerSpeed(pm).limit * LEVEL_SPEED[level];
  if (bpm <= lim + 1e-9) return 'full';
  if (bpm / 2 <= lim + 1e-9 && readsAtHalf(partnerTrack(pm, 1), bpm) && readsAtHalf(partnerTrack(pm, 2), bpm)) return 'half';
  return 'out';
}
