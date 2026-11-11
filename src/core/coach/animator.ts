/**
 * Evaluates the coach's pose for a song time from a plan (beat grid + move
 * instances).
 *
 * Pure TypeScript (no DOM). The per-frame path is allocation-free.
 *
 * Each move has three tracks (body/feet, arms, torso/head). Every track is
 * interpolated between ITS OWN previous and next keyframes, which may belong
 * to neighbouring move instances, so transitions are continuous and layered
 * moves keep each layer's timing. Keyframes land exactly on beat times.
 *
 * On top: a subtle bounce on every beat (down on the beat) and secondary
 * motion (head drags behind fast torso moves, small nod on the beat).
 */

import type { MoveInstance } from '../choreo/generator';
import { IDLE_MOVE, trackKeys, type MoveKey } from '../choreo/moves';
import { GROUP_CHANNELS, G_BODY, G_TORSO, NUM_GROUPS, interpolateGroup } from './poses';
import { CH, createPose, type Pose } from './skeleton';

export interface PlanView {
  /** Beat times in seconds, ascending. Indices are stable. */
  readonly grid: readonly number[];
  readonly instances: readonly MoveInstance[];
  /** Beat period used to extrapolate outside the grid. */
  readonly period: number;
}

/** Fractional beat index for time t (extrapolates outside the grid). */
export function beatPosition(plan: PlanView, t: number, hint = 0): number {
  const g = plan.grid;
  const n = g.length;
  const per = plan.period > 0 ? plan.period : 0.5;
  if (n === 0) return t / per;
  if (t < g[0]) return (t - g[0]) / per;
  if (t >= g[n - 1]) return n - 1 + (t - g[n - 1]) / per;
  let i = hint >= 0 && hint < n - 1 && g[hint] <= t && t < g[hint + 1] ? hint : -1;
  if (i < 0 && hint + 1 < n - 1 && g[hint + 1] <= t && t < g[hint + 2]) i = hint + 1;
  if (i < 0) {
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (g[mid] <= t) lo = mid;
      else hi = mid;
    }
    i = lo;
  }
  return i + (t - g[i]) / (g[i + 1] - g[i]);
}

/** Time of a (fractional) beat index. */
export function timeOfBeat(plan: PlanView, b: number): number {
  const g = plan.grid;
  const n = g.length;
  const per = plan.period > 0 ? plan.period : 0.5;
  if (n === 0) return b * per;
  if (b <= 0) return g[0] + b * per;
  if (b >= n - 1) return g[n - 1] + (b - (n - 1)) * per;
  const i = Math.floor(b);
  return g[i] + (g[i + 1] - g[i]) * (b - i);
}

/** Index of the instance covering beat b; < 0 or >= length outside (virtual grooves). */
export function instanceIndexAt(plan: PlanView, b: number): number {
  const ins = plan.instances;
  const n = ins.length;
  if (n === 0) return Math.floor(b) - 1_000_000;
  if (b < ins[0].start) return Math.floor(b - ins[0].start);
  const last = ins[n - 1];
  const end = last.start + last.span;
  if (b >= end) return n + Math.floor(b - end);
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ins[mid].start <= b) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface EvalOptions {
  /** Add the bounce and secondary-motion layers (default true). */
  layers?: boolean;
  /** Bounce amount multiplier (energy), default 1. */
  energy?: number;
}

const BOUNCE = 0.016;
const HEAD_LAG_SEC = 0.09;

export class PoseEvaluator {
  /** Instance index of the last evaluation (may be virtual). */
  instIndex = 0;
  /** Fractional beat index of the last evaluation. */
  beat = 0;

  private hint = 0;
  private readonly pm1 = createPose();
  private readonly p0 = createPose();
  private readonly p1 = createPose();
  private readonly lag = createPose();
  // Virtual groove instances (outside the planned range), reused.
  private readonly virt: MoveInstance[] = [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({
    move: IDLE_MOVE, mirror: false, start: 0, span: 1, half: false, origin: 0, section: 'verse' as const, sig: false, unitStart: false, phrase: -1,
  }));
  private virtNext = 0;

  /** Evaluate the pose at time t into `out`. */
  evaluate(plan: PlanView, t: number, out: Pose, opts: EvalOptions = {}): Pose {
    const b = beatPosition(plan, t, this.hint);
    this.hint = Math.max(0, Math.floor(b));
    this.beat = b;
    const idx = instanceIndexAt(plan, b);
    this.instIndex = idx;
    for (let g = 0; g < NUM_GROUPS; g++) this.evalGroup(plan, b, idx, g, out);
    if (opts.layers === false) return out;

    const inst = this.inst(plan, idx);
    // Bounce: knees give on every beat (every other beat at half time).
    const half = inst.half;
    const ph = half ? b / 2 : b;
    const frac = ph - Math.floor(ph);
    const e = opts.energy ?? 1;
    const amp = BOUNCE * inst.move.bounce * (0.7 + 0.5 * e);
    out[CH.Y] -= amp * dip(frac);
    out[CH.HEAD_NOD] += 3.5 * inst.move.bounce * dip(frac - 0.1);
    out[CH.SH_R] += 0.12 * inst.move.bounce * dip(frac - 0.05);
    out[CH.SH_L] += 0.12 * inst.move.bounce * dip(frac - 0.05);

    // Secondary: the head drags a little behind torso lean / twist.
    const bl = beatPosition(plan, t - HEAD_LAG_SEC, this.hint);
    this.evalGroup(plan, bl, instanceIndexAt(plan, bl), G_TORSO, this.lag);
    out[CH.HEAD_ROLL] -= (out[CH.LEAN] - this.lag[CH.LEAN]) * 0.55;
    out[CH.HEAD_TURN] -= (out[CH.TWIST] - this.lag[CH.TWIST]) * 0.35;
    return out;
  }

  /** Instance by index; virtual grooves outside the planned range. */
  inst(plan: PlanView, idx: number): MoveInstance {
    const ins = plan.instances;
    const n = ins.length;
    if (idx >= 0 && idx < n) return ins[idx];
    const v = this.virt[this.virtNext];
    this.virtNext = (this.virtNext + 1) & 7;
    if (n === 0) v.start = idx + 1_000_000;
    else if (idx < 0) v.start = ins[0].start + idx;
    else v.start = ins[n - 1].start + ins[n - 1].span + (idx - n);
    v.mirror = (idx & 1) === 1;
    v.section = n ? ins[idx < 0 ? 0 : n - 1].section : 'verse';
    return v;
  }

  private evalGroup(plan: PlanView, b: number, idx: number, g: number, out: Pose): void {
    // Find the key at or before b in this group's track (may be in an earlier instance).
    let i = idx;
    let inst = this.inst(plan, i);
    let keys = trackKeys(inst.move, g, inst.mirror);
    let mult = inst.half ? 2 : 1;
    const lb = (b - inst.start) / mult;
    let k = -1;
    for (let j = 0; j < keys.length; j++) if (keys[j].at <= lb + 1e-9) k = j;
    let guard = 0;
    while (k < 0 && guard++ < 8) {
      i--;
      inst = this.inst(plan, i);
      keys = trackKeys(inst.move, g, inst.mirror);
      mult = inst.half ? 2 : 1;
      k = keys.length - 1;
    }
    // A late last key (quarter-beat grid, < half a beat before the move ends)
    // would leave a quarter beat to reach a DIFFERENT next move: skip it there.
    if (this.lateEnd(plan, i, inst, keys, k)) k--;
    const i0 = i;
    const inst0 = inst;
    const key0 = keys[k];
    const g0 = inst0.start + key0.at * mult;
    // Next key.
    let i1 = i0;
    let k1 = k + 1;
    let inst1 = inst0;
    let keys1 = keys;
    if (k1 < keys1.length && this.lateEnd(plan, i0, inst0, keys, k1)) k1 = keys1.length;
    guard = 0;
    while (k1 >= keys1.length && guard++ < 8) {
      i1++;
      inst1 = this.inst(plan, i1);
      keys1 = trackKeys(inst1.move, g, inst1.mirror);
      k1 = 0;
    }
    const key1 = keys1[k1];
    const g1 = inst1.start + key1.at * (inst1.half ? 2 : 1);
    // Previous key (for the settle after key0).
    let im = i0;
    let km = k - 1;
    let instm = inst0;
    let keysm = keys;
    guard = 0;
    while (km < 0 && guard++ < 8) {
      im--;
      instm = this.inst(plan, im);
      keysm = trackKeys(instm.move, g, instm.mirror);
      km = keysm.length - 1;
    }
    const keym = keysm[km];

    this.load(keym, instm, g, this.pm1);
    this.load(key0, inst0, g, this.p0);
    this.load(key1, inst1, g, this.p1);
    const span = g1 - g0;
    let u = span > 1e-9 ? (b - g0) / span : 1;
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
    interpolateGroup(g, this.pm1, this.p0, this.p1, u, out);
  }

  /** Key k is a late last key of `inst` and a different move follows (see evalGroup). */
  private lateEnd(plan: PlanView, idx: number, inst: MoveInstance, keys: readonly MoveKey[], k: number): boolean {
    if (k <= 0 || k !== keys.length - 1 || keys[k].at <= inst.move.beats - 0.5 + 1e-9) return false;
    const n = plan.instances.length;
    const next = idx + 1 >= 0 && idx + 1 < n ? plan.instances[idx + 1].move : IDLE_MOVE;
    return next !== inst.move;
  }

  private load(key: MoveKey, inst: MoveInstance, g: number, dst: Pose): void {
    const chs = GROUP_CHANNELS[g];
    const src = key.pose;
    for (let j = 0; j < chs.length; j++) dst[chs[j]] = src[chs[j]];
    if (g === G_BODY && inst.origin !== 0) {
      dst[CH.X] += inst.origin;
      dst[CH.RFT_X] += inst.origin;
      dst[CH.LFT_X] += inst.origin;
    }
  }
}

/** Beat dip: 1 on the beat, easing to 0 by mid-beat. */
function dip(frac: number): number {
  let f = frac - Math.floor(frac);
  if (f > 0.5) f -= 1; // -0.5..0.5 around the beat
  const x = Math.cos(Math.PI * Math.min(1, Math.abs(f) * 2.2));
  const v = 0.5 + 0.5 * x;
  return v * v;
}
