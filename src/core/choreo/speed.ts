/**
 * Tempo feasibility: how fast a move can be danced, derived from its own
 * keyframes. Pure TypeScript (no DOM), deterministic, cached per move (the
 * key poses are solved once; no sampling).
 *
 * A move is authored in move beats. Danced at full time on a song of B BPM a
 * move beat lasts 60 / B seconds; at half time, twice that. Every move has a
 * SPEED LIMIT: the highest tempo (move beats per minute) at which it can still
 * be done and copied. It is the lowest of:
 *
 *   travel   for every key-to-key segment (the loop wraps: a mirrored move
 *            continues into its other side, a travelling one from where it
 *            ended), how far each joint has to go (figure units, solved from
 *            the key poses) against how fast that joint can move: hands and
 *            elbows fastest, then the head and chest, then the feet and knees
 *            (a leg is heavy), the pelvis least (it carries the whole body).
 *            A leg lifting while the other one carries the body (single-leg
 *            support) is slower, and so is a pelvis that drops or rises
 *            (squats, jumps).
 *   turns    degrees of whole-body turn per second.
 *   density  the shortest time between two keys (a hit has to be seen).
 *
 * The same weights.ts measures the soft weights from; this one is a hard
 * limit. The generator performs a move at half time on its own when the song
 * is faster than its limit (`moveTempoMode`), and leaves it out when even
 * half time is too fast, or when it does not read at half time: a jump whose
 * time in the air would stretch past MAX_AIR_SEC floats, so it is left out
 * rather than slowed. Simple on-the-beat moves (bounces, pumps, step-touches)
 * have high limits, so fast songs keep them at full time.
 *
 * COORDINATION: each level also has a most coordination load (COORD_LOAD;
 * coordination.ts: how busy the legs and the arms / torso are AT ONCE, per
 * second at the tempo danced). A move over it at full time is danced at half
 * time when that is within it (and still moves: MIN_HALF_BPM), else it is
 * left out on that song at that level (the generator hands its weight to a
 * simpler form of it when there is one: Choreographer.simplerForms).
 */

import { CH, createPose, createSkeleton, J, solveSkeleton, type Pose } from '../coach/skeleton';
import type { Move, MoveKey } from './catalog';
import { REF_BPM, coordinationLoad } from './coordination';

/** Joint speed limits (figure units per second; 1 unit = standing height). */
const JOINT_V: readonly (readonly [number, number])[] = [
  [J.HA_R, 2.4], [J.HA_L, 2.4],
  [J.EL_R, 1.8], [J.EL_L, 1.8],
  [J.HEAD, 1.2], [J.CHEST, 1.0],
  [J.KN_R, 1.1], [J.KN_L, 1.1],
  [J.AN_R, 1.5], [J.AN_L, 1.5],
  [J.PELVIS, 0.9],
];
/** A lifted leg while the other carries the body (single-leg support) moves this much slower. */
const SINGLE_LEG = 0.7;
/** Vertical pelvis travel (squat, rise, jump) counts this much more than sideways sway. */
const PELVIS_VERTICAL = 1.5;
/** Foot lift (figure units) above which a foot is off the floor. */
const LIFT = 0.035;
/** Root height above which the body is in the air. */
const AIR = 0.01;
/** Whole-body turn limit (deg per second). */
const SPIN_V = 480;
/** Shortest time between two keys (s). */
const MIN_KEY_SEC = 0.11;
/** Longest a jump may take from its take-off key to its landing key, halved (s): longer floats. */
export const MAX_AIR_SEC = 0.55;
/** Limits are capped here (a held pose has no limit worth telling apart). */
export const MAX_LIMIT_BPM = 400;

const angleDelta = (a: number, b: number) => {
  const d = Math.abs(b - a) % 360;
  return d > 180 ? 360 - d : d;
};

export interface SpeedInfo {
  /** Highest tempo (move beats per minute) the move can be danced at. */
  limit: number;
  /** What sets it: 'travel:<joint>', 'turn', 'density' or 'none'. */
  by: string;
  /** Longest airborne stretch (move beats between the grounded keys around it; 0 = never leaves the floor). */
  air: number;
}

const SPEED = new WeakMap<Move, SpeedInfo>();
const sk = createSkeleton();
const sk2 = createSkeleton();
const wrap = createPose();

const JOINT_NAME: Record<number, string> = { [J.HA_R]: 'hand', [J.HA_L]: 'hand', [J.EL_R]: 'elbow', [J.EL_L]: 'elbow', [J.HEAD]: 'head', [J.CHEST]: 'chest', [J.KN_R]: 'knee', [J.KN_L]: 'knee', [J.AN_R]: 'foot', [J.AN_L]: 'foot', [J.PELVIS]: 'pelvis' };

/** The pose after a repeat's last key: the next repeat's first key (the other side for a mirrored move, shifted by its travel). */
function wrapPose(m: Move): Pose {
  const first = (m.mirror ? m.mirrorKeys : m.keys)[0].pose;
  if (!m.travel) return first;
  wrap.set(first);
  wrap[CH.X] += m.travel;
  wrap[CH.RFT_X] += m.travel;
  wrap[CH.LFT_X] += m.travel;
  return wrap;
}

function segmentLimit(a: Pose, b: Pose, beats: number): [number, string] {
  solveSkeleton(a, sk);
  solveSkeleton(b, sk2);
  let best = MAX_LIMIT_BPM;
  let by = 'none';
  const liftR = a[CH.RFT_Y] > LIFT || b[CH.RFT_Y] > LIFT;
  const liftL = a[CH.LFT_Y] > LIFT || b[CH.LFT_Y] > LIFT;
  // One leg up while the other stays down: the body balances on one leg.
  const single = liftR !== liftL;
  for (const [j, v0] of JOINT_V) {
    const o = j * 3;
    const dx = sk2.p[o] - sk.p[o], dy = sk2.p[o + 1] - sk.p[o + 1], dz = sk2.p[o + 2] - sk.p[o + 2];
    const vy = j === J.PELVIS ? dy * PELVIS_VERTICAL : dy;
    const d = Math.sqrt(dx * dx + vy * vy + dz * dz);
    if (d < 1e-6) continue;
    let v = v0;
    if (single && (((j === J.AN_R || j === J.KN_R) && liftR) || ((j === J.AN_L || j === J.KN_L) && liftL))) v *= SINGLE_LEG;
    // d / (beats * 60 / bpm) <= v  ->  bpm <= 60 * beats * v / d
    const lim = (60 * beats * v) / d;
    if (lim < best) {
      best = lim;
      by = `travel:${JOINT_NAME[j] ?? j}`;
    }
  }
  const turn = angleDelta(a[CH.SPIN], b[CH.SPIN]);
  if (turn > 1e-6) {
    const lim = (60 * beats * SPIN_V) / turn;
    if (lim < best) {
      best = lim;
      by = 'turn';
    }
  }
  const dens = (60 * beats) / MIN_KEY_SEC;
  if (dens < best) {
    best = dens;
    by = 'density';
  }
  return [best, by];
}

/** Longest airborne stretch of a move (move beats from the grounded key before an airborne key to the grounded key after it). */
function airBeats(m: Move): number {
  const keys = m.keys;
  const n = keys.length;
  if (!m.jump || n === 0) return 0;
  const up = keys.map((k) => k.pose[CH.Y] > AIR);
  if (up.every(Boolean)) return m.beats;
  let best = 0;
  for (let i = 0; i < n; i++) {
    if (!up[i] || up[(i - 1 + n) % n]) continue;
    // A run of airborne keys starting at i: from the grounded key before it to the grounded key after it.
    let j = i;
    while (up[(j + 1) % n]) j = (j + 1) % n;
    const before = keys[(i - 1 + n) % n].at;
    const after = keys[(j + 1) % n].at;
    let span = after - before;
    if (span <= 0) span += m.beats;
    best = Math.max(best, span);
  }
  return best;
}

/** The move's speed limit and what sets it (cached). Parts of a move share their whole move's limit. */
export function moveSpeed(m: Move): SpeedInfo {
  const hit = SPEED.get(m);
  if (hit) return hit;
  if (m.whole && m.whole !== m) {
    const w = moveSpeed(m.whole);
    SPEED.set(m, w);
    return w;
  }
  const keys: readonly MoveKey[] = m.keys;
  let limit = MAX_LIMIT_BPM;
  let by = 'none';
  // A single-key move that neither mirrors nor travels is a held pose.
  const held = keys.length <= 1 && !m.mirror && !m.travel;
  if (keys.length >= 1 && !held) {
    for (let i = 0; i < keys.length; i++) {
      const a = keys[i];
      const last = i === keys.length - 1;
      const b = last ? wrapPose(m) : keys[i + 1].pose;
      const beats = last ? m.beats - a.at + keys[0].at : keys[i + 1].at - a.at;
      if (beats <= 1e-9) continue;
      const [lim, why] = segmentLimit(a.pose, b, beats);
      if (lim < limit) {
        limit = lim;
        by = why;
      }
    }
  }
  const info: SpeedInfo = { limit: Math.max(30, Math.min(MAX_LIMIT_BPM, limit)), by, air: airBeats(m) };
  SPEED.set(m, info);
  return info;
}

/** The move's speed limit (move beats per minute). */
export function speedLimit(m: Move): number {
  return moveSpeed(m).limit;
}

export type TempoMode = 'full' | 'half' | 'out';
export type SpeedLevel = 'chill' | 'cardio' | 'sweaty';

/** How much of the limit each level uses (Easy keeps further from it: on the beat, never frantic). */
export const LEVEL_SPEED: Readonly<Record<SpeedLevel, number>> = { chill: 0.85, cardio: 1, sweaty: 1 };

/** Whether a move reads at half time on a song of `bpm` (a jump whose air time would float does not). */
export function readsAtHalf(m: Move, bpm: number): boolean {
  const air = moveSpeed(m).air;
  return air <= 0 || (0.5 * air * 60 * 2) / bpm <= MAX_AIR_SEC + 1e-9;
}

/**
 * Most coordination load (coordination.ts) a level dances, at any tempo. The
 * load grows with the tempo a move is danced at, so the coordination a move
 * may have per beat falls as the tempo rises (coordinationLimit). Set from
 * the measured loads (Nov 2026, published songs): Easy one thing at a time (a
 * march with swinging arms 1.05 x tempo / 120 fits up to ~140 BPM; a march
 * with arms pumping overhead, 2.1, only at half time); Medium moderate (a
 * jumping jack, 2.2, at full time up to ~95 BPM); Hard demanding but doable
 * (jumping jacks up to ~145 BPM, nothing like a jump with hammer fists, 2.9,
 * at full time above ~110).
 */
export const COORD_LOAD: Readonly<Record<SpeedLevel, number>> = { chill: 1.25, cardio: 1.75, sweaty: 2.75 };
/** Slowest tempo (move beats per minute) a move is slowed to for its coordination: below it, it is left out instead. */
export const MIN_HALF_BPM = 50;

/** Most coordination per move beat (coordination.ts perBeat) a level dances at `bpm` move beats per minute: it falls as the tempo rises. */
export function coordinationLimit(level: SpeedLevel, bpm: number): number {
  return (COORD_LOAD[level] * REF_BPM) / bpm;
}

/** Whether a move danced at `bpm` move beats per minute is within the level's coordination load. */
export function coordinationOk(m: Move, bpm: number, level: SpeedLevel): boolean {
  return coordinationLoad(m, bpm) <= COORD_LOAD[level] + 1e-9;
}

/**
 * How a move is performed on a song of `bpm` (beats of the beat grid per
 * minute): full time when the tempo is within its limit (times the level's
 * share) and its coordination load there is within the level's
 * (COORD_LOAD), half time when half the tempo is (and the move reads at half
 * time), else 'out' (not used on this song at this level).
 */
export function moveTempoMode(m: Move, bpm: number | undefined, level: SpeedLevel = 'cardio'): TempoMode {
  return tempoMode(m, bpm, level, true);
}

/** moveTempoMode by the speed limit alone (no coordination load): what a move dropped for its coordination would have been. */
export function speedTempoMode(m: Move, bpm: number | undefined, level: SpeedLevel = 'cardio'): TempoMode {
  return tempoMode(m, bpm, level, false);
}

function tempoMode(m: Move, bpm: number | undefined, level: SpeedLevel, coord: boolean): TempoMode {
  if (!bpm || !Number.isFinite(bpm) || bpm <= 0) return 'full';
  const lim = moveSpeed(m).limit * LEVEL_SPEED[level];
  const fast = bpm > lim + 1e-9;
  if (!fast && (!coord || coordinationOk(m, bpm, level))) return 'full';
  // Half time for the coordination alone only while it still moves (MIN_HALF_BPM), not as a crawl.
  if (bpm / 2 <= lim + 1e-9 && readsAtHalf(m, bpm) && (!coord || (coordinationOk(m, bpm / 2, level) && (fast || bpm / 2 >= MIN_HALF_BPM - 1e-9)))) return 'half';
  return 'out';
}
