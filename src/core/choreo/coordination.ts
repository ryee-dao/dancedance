/**
 * Coordination load: how hard a move is to do with the whole body at once,
 * derived from its own keyframes (never from its name or tags). Pure
 * TypeScript (no DOM), deterministic, cached per move.
 *
 * A move is cut into its key-to-key segments (the loop wraps as in speed.ts:
 * a mirrored move continues into its other side, a travelling one from where
 * it ended). Each segment gets two demands:
 *
 *   lower   what the legs do: time in the air (a take-off or a landing),
 *           each foot that moves (a step, a weight change: both feet = a
 *           switch), kicks (a foot lifted high or thrown out), travel of the
 *           root, whole-body turns, deep level changes (squats).
 *   upper   what the rest does on top: how far each hand moves (relative to
 *           the chest, so a body sway or a turn is not an arm move; an arm
 *           working low, a relaxed swing, counts less than one lifted to the
 *           shoulders and over: HAND_LOW, LOW_ARM), the
 *           torso (lean, twist, bend, rib slide), the head, hip isolations
 *           (a hip shift or tilt is a separate thing to do over the feet),
 *           and two arms each doing its own thing (both moving, not as
 *           mirror images: alternating punches), weighted above raw hand
 *           travel. The natural counter-swing of the steps adds little: the
 *           feet taking turns, the arms swinging opposite ways, low (chest
 *           height and down) or small (GAIT_W); over a jump (both feet
 *           together) the same arms count in full.
 *
 * The demands are summed per move beat (each segment spread over the beats
 * it spans). A beat's coordination is high only when both halves are busy in
 * it: the geometric mean sqrt(lower x upper), raised when the arms keep a
 * rhythm of their own (their changes fall where the feet hold: OFF_RHYTHM).
 * The move's coordination per beat (`perBeat`) is the mean of its mean and
 * its busiest beat (one punishing beat counts, but not as a whole loop).
 *
 * The LOAD at a tempo is that per-beat value times move beats per second
 * relative to REF_BPM: twice as fast is twice the load, and half time (one
 * move beat per two song beats) halves it. The limits per level (and how they
 * fall at fast tempos) are speed.ts coordinationLimit.
 */

import { CH, J, createPose, createSkeleton, solveSkeleton, type Pose } from '../coach/skeleton';
import type { Move, MoveKey } from './catalog';

/** Tempo (move beats per minute) at which load = perBeat. */
export const REF_BPM = 120;

/** Root height above which the body is in the air (speed.ts AIR). */
const AIR = 0.01;
/** Foot travel (figure units, x / lift / forward) that counts as one whole step. */
const STEP = 0.12;
/** Foot lift above which a lifted foot starts to be a kick or a high knee. */
const KICK_FROM = 0.08;
/** Forward (or back) reach of a foot beyond which it is thrown out (half weight against lift). */
const KICK_FWD = 0.15;
/** ... and the extra lift / reach that makes a full kick. */
const KICK_SPAN = 0.2;
/** Root travel for a full unit of travel. */
const TRAVEL = 0.25;
/** Squat depth change (root y below rest) for a full level change. */
const LEVEL = 0.12;
/** Hand travel relative to the chest for one full arm move. */
const HAND = 0.35;
/** Hand height (relative to the shoulder line) at or below which an arm move counts LOW_ARM; full from the shoulders up. */
const HAND_LOW = -0.25;
const LOW_ARM = 0.5;
/** Torso angles (lean + twist + bend, deg) for a full torso move; rib slide in units. */
const TORSO_DEG = 45;
const RIB = 0.06;
/** Head angles (nod + roll + turn, deg) for a full head move. */
const HEAD_DEG = 40;
/** Hip shift (units) / tilt + yaw (deg) for a full hip isolation. */
const HIP_SHIFT = 0.06;
const HIP_DEG = 30;

/** Weights of the lower-body parts (per segment). */
const W_AIR = 0.6;
const W_STEP = 0.5;
const W_KICK = 0.5;
const W_TRAVEL = 0.4;
const W_TURN = 0.8;
const W_LEVEL = 0.4;
/** Weights of the upper-body parts (per segment). */
const W_ARM = 0.5;
const W_TORSO = 0.4;
const W_HEAD = 0.15;
const W_HIPS = 0.3;
const W_ASYM = 0.6;
/** How much of the arms' demand the counter-swing of the steps takes away (gait 1: a fully natural swing). */
const GAIT_W = 0.8;
/** Hand travel (in HAND units) below which an arm swing is small. */
const SWING_AMP = 0.6;
/** Hands this far below the shoulder line (and lower) swing low: chest height and down. */
const SWING_LOW = 0.12;

/**
 * How much two left / right displacements go opposite ways (0..1): each is the reverse of the other's mirror image
 * (x negated). One of them still (below `still`) counts as fully taking turns when `still` > 0.
 */
function reciprocal(r: readonly number[], l: readonly number[], still: number): number {
  const nr = Math.hypot(r[0], r[1], r[2]), nl = Math.hypot(l[0], l[1], l[2]);
  if (nr <= still || nl <= still) return still > 0 && Math.max(nr, nl) > still ? 1 : 0;
  return clamp01(-(r[0] * -l[0] + r[1] * l[1] + r[2] * l[2]) / (nr * nl));
}
/** How much an arm rhythm of its own (changes where the feet hold) raises the coordination. */
const OFF_RHYTHM = 0.8;
/** A segment's lower demand below this counts as the feet holding (for the arm rhythm). */
const HOLD = 0.05;

export interface Coordination {
  /** Lower-body demand per move beat (mean over the loop) and of the busiest beat. */
  lower: number;
  lowerPeak: number;
  /** Upper-body demand per move beat (mean) and of the busiest beat. */
  upper: number;
  upperPeak: number;
  /** Share of the arms' changes that fall where the feet hold, when the feet move at all (0 = on the foot rhythm). */
  off: number;
  /** Coordination of the busiest beat, and its mean over the loop. */
  peak: number;
  mean: number;
  /** The move's coordination per move beat: (mean + peak) / 2. Load at a tempo = perBeat x bpm / REF_BPM. */
  perBeat: number;
  /** The parts (sums over the loop per move beat): lower body air, steps, kicks, travel, turns, level; upper body arms, torso, head, hips, asym (arms not mirrored). */
  parts: { air: number; step: number; kick: number; travel: number; turn: number; level: number; arms: number; torso: number; head: number; hips: number; asym: number; gait: number };
}

const CACHE = new WeakMap<Move, Coordination>();
const ska = createSkeleton();
const skb = createSkeleton();
const qa = createPose();
const qb = createPose();
const wrap = createPose();

const angleDelta = (a: number, b: number) => {
  const d = Math.abs(b - a) % 360;
  return d > 180 ? 360 - d : d;
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The pose after a repeat's last key (speed.ts wrapPose). */
function wrapPose(m: Move): Pose {
  const first = (m.mirror ? m.mirrorKeys : m.keys)[0].pose;
  if (!m.travel) return first;
  wrap.set(first);
  wrap[CH.X] += m.travel;
  wrap[CH.RFT_X] += m.travel;
  wrap[CH.LFT_X] += m.travel;
  return wrap;
}

/** Solve a pose in the body's own frame (no travel, no turn), for hand positions relative to the chest. */
function solveLocal(p: Pose, tmp: Pose, sk: ReturnType<typeof createSkeleton>): void {
  tmp.set(p);
  tmp[CH.X] = 0;
  tmp[CH.SPIN] = 0;
  solveSkeleton(tmp, sk);
}

function rel(sk: ReturnType<typeof createSkeleton>, j: number, k: number): number {
  return sk.p[j * 3 + k] - sk.p[J.CHEST * 3 + k];
}

interface Seg {
  lower: number;
  upper: number;
  air: number; step: number; kick: number; travel: number; turn: number; level: number;
  arms: number; torso: number; head: number; hips: number; asym: number; gait: number;
}

/** How much of a kick a foot at this lift and forward reach is (0..1). */
function kickOf(lift: number, fwd: number): number {
  const reach = Math.max(0, lift - KICK_FROM) + Math.max(0, Math.abs(fwd) - KICK_FWD) * 0.5;
  return clamp01(reach / KICK_SPAN);
}

/** Demands of one key-to-key segment. */
function segment(a: Pose, b: Pose): Seg {
  // Lower body.
  const upA = a[CH.Y] > AIR, upB = b[CH.Y] > AIR;
  const air = upA || upB ? 1 : 0;
  let step = 0;
  const fv: [number, number, number][] = [];
  for (const [x, y, z] of [[CH.RFT_X, CH.RFT_Y, CH.RFT_Z], [CH.LFT_X, CH.LFT_Y, CH.LFT_Z]] as const) {
    const v: [number, number, number] = [b[x] - a[x], b[y] - a[y], b[z] - a[z]];
    fv.push(v);
    step += Math.min(1, Math.hypot(...v) / STEP);
  }
  // The feet take turns (a step, a march, a run): one moves alone, or the two the opposite ways (one lifts as the other
  // lands); not together like a jump's or a jack's mirrored feet.
  const alternate = step > 0.1 ? reciprocal(fv[0], fv[1], 0.02) : 0;
  const kick = Math.max(kickOf(a[CH.RFT_Y], a[CH.RFT_Z]), kickOf(a[CH.LFT_Y], a[CH.LFT_Z]), kickOf(b[CH.RFT_Y], b[CH.RFT_Z]), kickOf(b[CH.LFT_Y], b[CH.LFT_Z]));
  const travel = Math.min(1, Math.abs(b[CH.X] - a[CH.X]) / TRAVEL);
  const turn = Math.min(1.5, angleDelta(a[CH.SPIN], b[CH.SPIN]) / 180);
  const level = Math.min(1, Math.abs(Math.min(0, b[CH.Y]) - Math.min(0, a[CH.Y])) / LEVEL);
  const lower = W_AIR * air + W_STEP * step + W_KICK * kick + W_TRAVEL * travel + W_TURN * turn + W_LEVEL * level;

  // Upper body (hands relative to the chest, in the body's own frame).
  solveLocal(a, qa, ska);
  solveLocal(b, qb, skb);
  const dh = (j: number): [number, number, number] => [rel(skb, j, 0) - rel(ska, j, 0), rel(skb, j, 1) - rel(ska, j, 1), rel(skb, j, 2) - rel(ska, j, 2)];
  const vr = dh(J.HA_R), vl = dh(J.HA_L);
  const er = dh(J.EL_R), el = dh(J.EL_L);
  const lr = Math.max(Math.hypot(...vr), Math.hypot(...er)), ll = Math.max(Math.hypot(...vl), Math.hypot(...el));
  // An arm working low (a relaxed swing, hands at the waist) is less than one lifted to the shoulders and over.
  const lift = (j: number) => LOW_ARM + (1 - LOW_ARM) * clamp01((Math.max(rel(ska, j, 1), rel(skb, j, 1)) - HAND_LOW) / -HAND_LOW);
  const liftR = lift(J.HA_R), liftL = lift(J.HA_L);
  const ar = Math.min(1.2, (lr / HAND) * liftR), al = Math.min(1.2, (ll / HAND) * liftL);
  const nr = Math.hypot(...vr), nl = Math.hypot(...vl);
  // The natural counter-swing of the steps: the feet taking turns, the arms swinging opposite ways (each the mirror
  // image of the other's reverse: one forward as the other goes back), low or small. The body does it by itself.
  const recip = nr > 1e-6 && nl > 1e-6 ? reciprocal(vr, vl, 0) : 0;
  const lowOf = (j: number) => clamp01(-Math.max(rel(ska, j, 1), rel(skb, j, 1)) / SWING_LOW);
  const low = (lowOf(J.HA_R) + lowOf(J.HA_L)) / 2;
  const small = 1 - clamp01(Math.max(lr, ll) / HAND / SWING_AMP);
  const gait = recip * alternate * Math.max(low, small);
  const arms = (ar + al) * (1 - GAIT_W * gait);
  const torso = Math.min(1.5, (angleDelta(a[CH.LEAN], b[CH.LEAN]) + angleDelta(a[CH.TWIST], b[CH.TWIST]) + angleDelta(a[CH.BEND], b[CH.BEND])) / TORSO_DEG + Math.abs(b[CH.CHEST_X] - a[CH.CHEST_X]) / RIB);
  const head = Math.min(1, (angleDelta(a[CH.HEAD_NOD], b[CH.HEAD_NOD]) + angleDelta(a[CH.HEAD_ROLL], b[CH.HEAD_ROLL]) + angleDelta(a[CH.HEAD_TURN], b[CH.HEAD_TURN])) / HEAD_DEG);
  const hips = Math.min(1, Math.abs(b[CH.HIPS] - a[CH.HIPS]) / HIP_SHIFT + (angleDelta(a[CH.HIP_TILT], b[CH.HIP_TILT]) + angleDelta(a[CH.HIPTWIST], b[CH.HIPTWIST])) / HIP_DEG);
  // Two arms each doing its own thing: both moving, not as mirror images (x negated), e.g. alternating punches; not
  // the counter-swing of the steps.
  const mirrorDev = Math.hypot(vr[0] + vl[0], vr[1] - vl[1], vr[2] - vl[2]);
  const asym = nr + nl > 1e-6 ? Math.min(1, mirrorDev / (nr + nl)) * Math.min(ar, al) * (1 - gait) : 0;
  const upper = W_ARM * arms + W_TORSO * torso + W_HEAD * head + W_HIPS * hips + W_ASYM * asym;
  return { lower, upper, air, step, kick, travel, turn, level, arms, torso, head, hips, asym, gait };
}

/** A move's coordination (cached). Parts of a move share their whole move's. */
export function moveCoordination(m: Move): Coordination {
  const hit = CACHE.get(m);
  if (hit) return hit;
  if (m.whole && m.whole !== m) {
    const w = moveCoordination(m.whole);
    CACHE.set(m, w);
    return w;
  }
  const keys: readonly MoveKey[] = m.keys;
  const beats = m.beats;
  const nb = Math.max(1, Math.round(beats));
  const L = new Float64Array(nb), U = new Float64Array(nb);
  const parts = { air: 0, step: 0, kick: 0, travel: 0, turn: 0, level: 0, arms: 0, torso: 0, head: 0, hips: 0, asym: 0, gait: 0 };
  let uSum = 0, uOff = 0, lSum = 0;
  const held = keys.length <= 1 && !m.mirror && !m.travel;
  if (keys.length >= 1 && !held) {
    for (let i = 0; i < keys.length; i++) {
      const a = keys[i];
      const last = i === keys.length - 1;
      const b = last ? wrapPose(m) : keys[i + 1].pose;
      const t0 = a.at;
      const t1 = last ? beats + keys[0].at : keys[i + 1].at;
      if (t1 - t0 <= 1e-9) continue;
      const s = segment(a.pose, b);
      for (const k of Object.keys(parts) as (keyof typeof parts)[]) parts[k] += s[k];
      lSum += s.lower;
      uSum += s.upper;
      const holdFeet = s.lower < HOLD;
      if (holdFeet) uOff += s.upper;
      // Spread over the move beats the segment spans (a segment ends on its later key: its change lands there).
      const span = t1 - t0;
      for (let w = Math.floor(t0); w < Math.ceil(t1 - 1e-9); w++) {
        const ov = Math.min(t1, w + 1) - Math.max(t0, w);
        if (ov <= 0) continue;
        const k = ((w % nb) + nb) % nb;
        L[k] += (s.lower * ov) / span;
        U[k] += (s.upper * ov) / span;
      }
    }
  }
  for (const k of Object.keys(parts) as (keyof typeof parts)[]) parts[k] /= beats;
  // The arms' own rhythm only matters when the feet do something at all.
  const off = lSum / beats > 2 * HOLD && uSum > 1e-9 ? uOff / uSum : 0;
  let peak = 0, sum = 0, lp = 0, up = 0;
  for (let k = 0; k < nb; k++) {
    const c = Math.sqrt(L[k] * U[k]) * (1 + OFF_RHYTHM * off);
    peak = Math.max(peak, c);
    sum += c;
    lp = Math.max(lp, L[k]);
    up = Math.max(up, U[k]);
  }
  const mean = sum / nb;
  const info: Coordination = {
    lower: lSum / beats, lowerPeak: lp, upper: uSum / beats, upperPeak: up, off,
    peak, mean, perBeat: (peak + mean) / 2, parts,
  };
  CACHE.set(m, info);
  return info;
}

/** Coordination load of a move danced at `bpm` move beats per minute (the song's tempo, halved at half time). */
export function coordinationLoad(m: Move, bpm: number): number {
  return (moveCoordination(m).perBeat * bpm) / REF_BPM;
}
