/**
 * Conductor: turns the beat source's timeline into a dance plan and switches
 * plans without visible jumps.
 *
 * Pure TypeScript (no DOM).
 *
 *   - No beats yet (or live tracker not locked): idle groove at a relaxed
 *     generic tempo.
 *   - Live (locked, no map): the beat grid grows from live beats and the
 *     LivePlanner appends phrases ahead of time.
 *   - Map: the generator's full routine. A `partial` map is followed by live
 *     beats (when present) and live-planned phrases after its end.
 *
 * When the desired plan changes (lock, map arrives, revision bump, intensity
 * change) the current move plays to its end, then the new plan takes over
 * with a short crossfade. A different song switches immediately (crossfaded).
 *
 * Bad data never hangs or breaks the dance: a map that fails
 * isUsableBeatMap (absurd tempo, non-finite or non-increasing beats) or a
 * live tempo outside the danceable range is ignored (idle groove), and every
 * grid-growing loop is bounded.
 */

import type { BeatMap, SectionType } from '../analysis/beatmap';
import type { BeatTimeline, LiveBeats } from '../../beat/beatSource';
import { LivePlanner, generateRoutine, isHalfTime, isUsableBeatMap, mapTempo, usableBpm, type Intensity, type MoveInstance, type SigStep } from '../choreo/generator';
import { IDLE_MOVE } from '../choreo/moves';
import { PoseEvaluator, beatPosition, instanceIndexAt, timeOfBeat, type PlanView } from './animator';
import { blendPose } from './poses';
import { createPose, type Pose } from './skeleton';

export const IDLE_BPM = 100;
const LOOKAHEAD_SEC = 14;
const FADE_SEC = 0.35;
/** Beats a grid may grow by per frame (bounds every extrapolation loop). */
const MAX_GRID_STEP = 2048;
/** Longest gap (beats) filled with evenly spaced beats when live beats resume. */
const MAX_GAP_FILL = 64;

export type PlanKind = 'idle' | 'live' | 'map';

export class Plan implements PlanView {
  grid: number[] = [];
  instances: MoveInstance[] = [];
  period: number;
  signature: readonly SigStep[] = [];
  half = false;
  /** First beat index driven by live beats (Infinity = none). */
  liveFrom = Infinity;
  private planner: LivePlanner | null = null;
  private sections: BeatMap['sections'] = [];

  constructor(
    readonly kind: PlanKind,
    readonly key: string,
    period: number,
  ) {
    this.period = period;
  }

  static idle(key: string, t0: number): Plan {
    const p = new Plan('idle', key, 60 / IDLE_BPM);
    p.grid.push(t0);
    return p;
  }

  static fromMap(key: string, map: BeatMap, intensity: Intensity, live: LiveBeats | null): Plan {
    const t = mapTempo(map);
    const bpm = usableBpm(t) ? t : 120;
    const p = new Plan('map', key, 60 / bpm);
    p.grid = map.beats.slice();
    const r = generateRoutine(map, intensity);
    p.instances = r.instances;
    p.signature = r.signature;
    p.half = r.half;
    p.sections = map.sections;
    if (map.partial) {
      p.liveFrom = p.grid.length;
      const end = p.instances.length ? p.instances[p.instances.length - 1].start + p.instances[p.instances.length - 1].span : p.grid.length;
      p.planner = new LivePlanner(map.videoId, intensity, live && usableBpm(live.bpm) ? live.bpm : bpm, end);
    }
    return p;
  }

  static fromLive(key: string, live: LiveBeats, videoId: string, intensity: Intensity, t: number): Plan {
    const p = new Plan('live', key, 60 / (usableBpm(live.bpm) ? live.bpm : 120));
    p.liveFrom = 0;
    p.extendGrid(live, t);
    // Start dancing from the next beat; earlier beats are grooves.
    let start = 0;
    while (start < p.grid.length && p.grid[start] < t) start++;
    p.half = isHalfTime(live.bpm);
    p.planner = new LivePlanner(videoId, intensity, live.bpm, start);
    p.signature = p.planner.signature;
    for (let b = 0; b < start; b++) {
      p.instances.push({ move: IDLE_MOVE, mirror: (b & 1) === 1, start: b, span: 1, half: false, origin: 0, section: 'intro', sig: false, unitStart: false, phrase: -1 });
    }
    return p;
  }

  /** Keep the grid and instances ahead of time t. Call every frame (cheap). */
  extend(tl: BeatTimeline | null, t: number): void {
    const live = tl?.live ?? null;
    if (this.kind === 'idle') {
      const g = this.grid;
      for (let k = 0; k < MAX_GRID_STEP && g[g.length - 1] < t + LOOKAHEAD_SEC; k++) g.push(g[g.length - 1] + this.period);
    } else if (this.liveFrom !== Infinity) {
      if (live && live.locked && usableBpm(live.bpm)) this.extendGrid(live, t);
      else this.extrapolate(t);
    }
    if (this.kind === 'map' && this.liveFrom === Infinity) return; // full map: virtual grooves after the end
    const needBeat = Math.ceil(beatPosition(this, t + LOOKAHEAD_SEC)) + 1;
    if (this.planner) {
      this.planner.extend(this.instances, needBeat);
    } else {
      let end = this.instances.length ? this.instances[this.instances.length - 1].start + this.instances[this.instances.length - 1].span : 0;
      while (end < needBeat) {
        this.instances.push({ move: IDLE_MOVE, mirror: (end & 1) === 1, start: end, span: 1, half: false, origin: 0, section: 'verse', sig: false, unitStart: false, phrase: -1 });
        end++;
      }
    }
  }

  private extrapolate(t: number): void {
    const g = this.grid;
    if (g.length === 0) g.push(t);
    for (let k = 0; k < MAX_GRID_STEP && g[g.length - 1] < t + LOOKAHEAD_SEC; k++) g.push(g[g.length - 1] + this.period);
  }

  /** Merge live beats into the grid: append new ones, gently refine future ones. */
  private extendGrid(live: LiveBeats, t: number): void {
    const g = this.grid;
    const per = 60 / live.bpm;
    this.period = per;
    const merge = (c: number) => {
      if (!Number.isFinite(c)) return;
      const n = g.length;
      if (n === 0 || c > g[n - 1] + 0.5 * per) {
        if (n > 0 && c > g[n - 1] + 1.5 * per) {
          // Gap: fill with evenly spaced beats so indices stay meaningful.
          const steps = Math.min(MAX_GAP_FILL, Math.round((c - g[n - 1]) / per));
          const d = (c - g[n - 1]) / steps;
          for (let s = 1; s < steps; s++) g.push(g[n - 1] + d * s);
        }
        g.push(c);
        return;
      }
      // Refine a future beat in the live part of the grid.
      if (c < t + 0.15) return;
      let lo = Math.max(this.liveFrom === Infinity ? 0 : this.liveFrom, 0);
      let hi = n - 1;
      if (lo > hi) return;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (g[mid] <= c) lo = mid;
        else hi = mid;
      }
      const j = Math.abs(g[lo] - c) < Math.abs(g[hi] - c) ? lo : hi;
      if (g[j] < t + 0.15 || Math.abs(g[j] - c) > 0.3 * per) return;
      const nv = g[j] + (c - g[j]) * 0.25;
      if ((j === 0 || nv > g[j - 1] + 0.2 * per) && (j === n - 1 || nv < g[j + 1] - 0.2 * per)) g[j] = nv;
    };
    for (let i = 0; i < live.beats.length; i++) merge(live.beats[i]);
    for (let i = 0; i < live.nextBeats.length; i++) merge(live.nextBeats[i]);
    // Tracker quiet: keep the grid ahead by extrapolating.
    for (let k = 0; k < MAX_GRID_STEP && g.length && g[g.length - 1] < t + 2; k++) g.push(g[g.length - 1] + per);
  }

  /** Section type and energy at beat b. */
  sectionAt(t: number, inst: MoveInstance | null): { type: SectionType; energy: number } {
    for (const s of this.sections) if (t >= s.start && t < s.end) return { type: s.type, energy: s.energy };
    const type = inst?.section ?? 'verse';
    return { type, energy: type === 'chorus' || type === 'drop' ? 0.8 : type === 'intro' || type === 'outro' ? 0.3 : 0.5 };
  }
}

/** What the preview strip needs; reused object. */
export interface Upcoming {
  current: MoveInstance | null;
  next: MoveInstance | null;
  after: MoveInstance | null;
  /** Time the current move group started / the next one starts. */
  groupStart: number;
  changeAt: number;
  /** Beats until the change (fractional). */
  beatsToChange: number;
  beat: number;
}

export class Conductor {
  private active: Plan | null = null;
  private pending: { plan: Plan; at: number } | null = null;
  private fading: { plan: Plan; start: number } | null = null;
  private readonly ev = new PoseEvaluator();
  private readonly ev2 = new PoseEvaluator();
  private readonly tmp = createPose();
  private videoId = '';
  readonly up: Upcoming = { current: null, next: null, after: null, groupStart: 0, changeAt: 0, beatsToChange: 0, beat: 0 };

  get plan(): Plan | null {
    return this.active;
  }

  /** Feed the latest timeline; builds / switches plans as needed. */
  update(tl: BeatTimeline | null, videoId: string, intensity: Intensity, t: number): void {
    const key = desiredKey(tl, videoId, intensity);
    const songChanged = videoId !== this.videoId;
    this.videoId = videoId;
    const cur = this.pending?.plan ?? this.active;
    if (!cur || cur.key !== key) {
      const plan = buildPlan(key, tl, videoId, intensity, t);
      if (!this.active) {
        this.active = plan;
      } else if (songChanged) {
        this.beginFade(t);
        this.active = plan;
        this.pending = null;
      } else {
        this.pending = { plan, at: this.switchTime(this.active, t) };
      }
    }
    if (this.pending && t >= this.pending.at) {
      this.beginFade(t);
      this.active = this.pending.plan;
      this.pending = null;
    }
    this.active!.extend(tl, t);
    this.pending?.plan.extend(tl, t);
    if (this.fading) {
      if (t - this.fading.start > FADE_SEC || t < this.fading.start) this.fading = null;
      else this.fading.plan.extend(tl, t);
    }
  }

  /** Forget everything (new screen / song restart). */
  reset(): void {
    this.active = this.pending = this.fading = null;
    this.videoId = '';
  }

  private beginFade(t: number): void {
    if (this.active) this.fading = { plan: this.active, start: t };
  }

  /** End of the move playing at t (if soon), else the next beat. */
  private switchTime(plan: Plan, t: number): number {
    const b = beatPosition(plan, t);
    const idx = instanceIndexAt(plan, b);
    const inst = this.ev.inst(plan, idx);
    const endT = timeOfBeat(plan, inst.start + inst.span);
    if (endT - t <= 4.5) return endT;
    return timeOfBeat(plan, Math.floor(b) + 1);
  }

  /** Pose at time t (crossfades plan switches). */
  evaluate(t: number, out: Pose, energy = 1): Pose {
    const plan = this.active;
    if (!plan) return out;
    this.ev.evaluate(plan, t, out, { energy });
    if (this.fading) {
      const w = (t - this.fading.start) / FADE_SEC;
      if (w >= 0 && w < 1) {
        this.ev2.evaluate(this.fading.plan, t, this.tmp, { energy });
        const s = w * w * (3 - 2 * w);
        blendPose(this.tmp, out, s, out);
      }
    }
    return out;
  }

  /** Beat position of the last evaluate(). */
  get beat(): number {
    return this.ev.beat;
  }

  /** Current and upcoming move groups (consecutive repeats of a move form a group). */
  upcoming(t: number): Upcoming {
    const u = this.up;
    const plan = this.active;
    u.current = u.next = u.after = null;
    if (!plan) return u;
    const b = beatPosition(plan, t);
    u.beat = b;
    const ins = plan.instances;
    const idx = instanceIndexAt(plan, b);
    if (idx < 0 || idx >= ins.length) {
      u.current = this.ev.inst(plan, idx);
      u.groupStart = timeOfBeat(plan, Math.floor(b));
      u.changeAt = Infinity;
      u.beatsToChange = Infinity;
      if (idx < 0 && ins.length) {
        u.next = ins[0];
        u.changeAt = timeOfBeat(plan, ins[0].start);
        u.beatsToChange = ins[0].start - b;
      }
      return u;
    }
    const cur = ins[idx];
    u.current = cur;
    let s = idx;
    while (s > 0 && sameGroup(ins[s - 1], cur)) s--;
    u.groupStart = timeOfBeat(plan, ins[s].start);
    let j = idx + 1;
    while (j < ins.length && sameGroup(ins[j], cur)) j++;
    if (j < ins.length) {
      u.next = ins[j];
      u.changeAt = timeOfBeat(plan, ins[j].start);
      u.beatsToChange = ins[j].start - b;
      let k = j + 1;
      while (k < ins.length && sameGroup(ins[k], ins[j])) k++;
      u.after = k < ins.length ? ins[k] : null;
    } else {
      const end = cur.start + cur.span;
      u.changeAt = plan.kind === 'map' && plan.liveFrom === Infinity ? timeOfBeat(plan, end) : Infinity;
      u.beatsToChange = plan.kind === 'map' && plan.liveFrom === Infinity ? end - b : Infinity;
    }
    return u;
  }

  sectionAt(t: number): { type: SectionType; energy: number } {
    const plan = this.active;
    if (!plan) return { type: 'intro', energy: 0.3 };
    const idx = instanceIndexAt(plan, beatPosition(plan, t));
    const inst = idx >= 0 && idx < plan.instances.length ? plan.instances[idx] : null;
    return plan.sectionAt(t, inst);
  }
}

function sameGroup(a: MoveInstance, b: MoveInstance): boolean {
  return a.move === b.move && a.sig === b.sig;
}

function desiredKey(tl: BeatTimeline | null, videoId: string, intensity: Intensity): string {
  if (tl?.map && isUsableBeatMap(tl.map)) return `map|${videoId}|${intensity}|${tl.revision}|${tl.map.partial ? 'p' : 'f'}`;
  if (tl?.live && tl.live.locked && usableBpm(tl.live.bpm)) return `live|${videoId}|${intensity}`;
  return `idle|${videoId}`;
}

function buildPlan(key: string, tl: BeatTimeline | null, videoId: string, intensity: Intensity, t: number): Plan {
  if (key.startsWith('map|') && tl?.map) return Plan.fromMap(key, tl.map, intensity, tl.live);
  if (key.startsWith('live|') && tl?.live) return Plan.fromLive(key, tl.live, videoId, intensity, t);
  return Plan.idle(key, t);
}
