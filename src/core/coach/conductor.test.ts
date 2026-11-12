import { describe, expect, it } from 'vitest';
import type { BeatTimeline, LiveBeats } from '../../beat/beatSource';
import type { BeatMap } from '../analysis/beatmap';
import { songMap } from '../choreo/testutil';
import { beatPosition, instanceIndexAt, timeOfBeat } from './animator';
import { Conductor, type Plan } from './conductor';
import { J, createPose, createSkeleton, solveSkeleton } from './skeleton';

/** Simulated beat source: live tracker locks after `lockAt`, map arrives at `mapAt`. */
class Sim {
  map: BeatMap;
  partial: BeatMap;
  live: LiveBeats = { locked: false, bpm: 0, beats: [], nextBeats: [] };
  tl: BeatTimeline = { map: null, live: null, revision: 0 };
  constructor(public bpm: number, public lockAt: number, public mapAt: number, public partialUntil = 0) {
    this.map = songMap(bpm, 'sim-song');
    const k = this.map.beats.findIndex((t) => t > partialUntil);
    this.partial = { ...this.map, partial: true, beats: this.map.beats.slice(0, k), downbeats: this.map.downbeats.filter((d) => d < k), sections: this.map.sections.filter((s) => s.start < partialUntil) };
  }
  at(t: number): BeatTimeline {
    const per = 60 / this.bpm;
    const heard = this.map.beats.filter((b) => b <= t && b > t - 10).map((b, i) => b + ((i % 3) - 1) * 0.004);
    const locked = t >= this.lockAt;
    const last = heard.length ? heard[heard.length - 1] : t;
    this.live = { locked, bpm: locked ? this.bpm : 0, beats: heard, nextBeats: locked ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => last + i * per) : [] };
    if (t >= this.mapAt) {
      if (this.tl.map !== this.map) this.tl.revision++;
      this.tl.map = this.map;
      this.tl.live = null;
    } else if (this.partialUntil > 0) {
      if (this.tl.map !== this.partial) this.tl.revision++;
      this.tl.map = this.partial;
      this.tl.live = this.live;
    } else {
      this.tl.map = null;
      this.tl.live = this.live;
    }
    return this.tl;
  }
}

function run(sim: Sim, until: number, onFrame?: (t: number, c: Conductor) => void): { maxStep: number; kinds: string[] } {
  const c = new Conductor();
  const pose = createPose();
  const sk = createSkeleton();
  const prev = new Float64Array(sk.p.length);
  let maxStep = 0;
  const kinds: string[] = [];
  for (let f = 0; f < until * 60; f++) {
    const t = f / 60;
    c.update(sim.at(t), 'sim-song', 'cardio', t);
    c.evaluate(t, pose);
    solveSkeleton(pose, sk);
    // Real joints only (HEAD_UP / HEAD_FWD are orientation helpers a unit away; turns swing them).
    if (f > 0) for (let j = 0; j < J.HEAD_UP * 3; j += 3) maxStep = Math.max(maxStep, Math.hypot(sk.p[j] - prev[j], sk.p[j + 1] - prev[j + 1], sk.p[j + 2] - prev[j + 2]));
    prev.set(sk.p);
    const k = c.plan!.kind;
    if (kinds[kinds.length - 1] !== k) kinds.push(k);
    onFrame?.(t, c);
  }
  return { maxStep, kinds };
}

describe('Conductor', () => {
  it('grooves before lock, dances live after, then takes the map without jumps', () => {
    const sim = new Sim(118, 8, 40);
    let liveCovered = true;
    const { maxStep, kinds } = run(sim, 70, (t, c) => {
      const p = c.plan!;
      if (p.kind === 'live') {
        const last = p.instances[p.instances.length - 1];
        // Plan stays ahead of the playhead as beats arrive.
        if (!last || timeOfBeat(p, last.start + last.span) < t + 8) liveCovered = false;
      }
    });
    expect(kinds).toEqual(['idle', 'live', 'map']);
    expect(liveCovered).toBe(true);
    expect(maxStep).toBeLessThan(0.1);
  });

  it('keeps the current move until its end when the plan changes', () => {
    const sim = new Sim(120, 2, 30);
    const c = new Conductor();
    for (let f = 0; f < 29.9 * 60; f++) c.update(sim.at(f / 60), 'sim-song', 'cardio', f / 60);
    expect(c.plan!.kind).toBe('live');
    const t0 = 30.01;
    c.update(sim.at(t0), 'sim-song', 'cardio', t0);
    const up = c.upcoming(t0);
    expect(c.plan!.kind).toBe('live'); // pending until the current move ends
    expect(up.current).not.toBeNull();
    let switched = -1;
    for (let f = 1; f < 600 && switched < 0; f++) {
      const t = t0 + f / 60;
      c.update(sim.at(t), 'sim-song', 'cardio', t);
      if (c.plan!.kind === 'map') switched = t;
    }
    expect(switched).toBeGreaterThan(t0);
    expect(switched - t0).toBeLessThan(5);
  });

  it('uses a partial map, then live beats after it, and survives the full-map revision', () => {
    const sim = new Sim(124, 0, 75, 30);
    const { maxStep, kinds } = run(sim, 90, (t, c) => {
      const p = c.plan!;
      if (p.kind === 'map' && t > 32 && t < 70) {
        // Past the partial map's end the plan keeps extending from live beats.
        expect(p.liveFrom).toBeLessThan(Infinity);
        const last = p.instances[p.instances.length - 1];
        expect(last.start + last.span).toBeGreaterThan(sim.partial.beats.length);
        expect(p.grid[p.grid.length - 1]).toBeGreaterThan(t + 2);
      }
    });
    expect(kinds[kinds.length - 1]).toBe('map');
    // Same bound as the routine continuity test (animator.test.ts) at 124 BPM.
    expect(maxStep).toBeLessThan(0.095 * (124 / 100));
  });

  it('a full map replacing the first-30-s map mid-song keeps the moves on screen and announced', () => {
    // The on-device case: partial map at the start, the full analysis lands at 41 s.
    const sim = new Sim(104, 0, 41, 30);
    const shown: { t: number; name: string; next: string }[] = [];
    let swapAt = -1;
    let before: Plan | null = null;
    const { maxStep } = run(sim, 75, (t, c) => {
      const up = c.upcoming(t);
      shown.push({ t, name: up.current?.move.name ?? '', next: up.next?.move.name ?? '' });
      if (swapAt < 0 && c.plan!.liveFrom === Infinity) swapAt = t;
      if (swapAt < 0) before = c.plan;
    });
    expect(swapAt).toBeGreaterThan(41);
    // The switch happens on the next beat, not at the end of some move.
    expect(swapAt - 41).toBeLessThan(1);
    // What the partial plan would have danced from the swap through its next card...
    const old = before! as Plan;
    const t1 = 41 + 6;
    for (const s of shown.filter((x) => x.t >= 41 && x.t < t1)) {
      const b = beatPosition(old, s.t);
      const inst = old.instances[instanceIndexAt(old, b)];
      expect(s.name).toBe(inst.move.name);
    }
    // ...and the coach never jumps (same bound as the other plan switches).
    expect(maxStep).toBeLessThan(0.095 * (104 / 100));
  });

  it('a level change still takes effect at the end of the current move', () => {
    const map = songMap(120, 'lvl');
    const tl: BeatTimeline = { map, live: null, revision: 1 };
    const c = new Conductor();
    for (let f = 0; f < 20 * 60; f++) c.update(tl, 'lvl', 'cardio', f / 60);
    const key = c.plan!.key;
    let switched = -1;
    for (let f = 0; f < 10 * 60 && switched < 0; f++) {
      const t = 20 + f / 60;
      c.update(tl, 'lvl', 'sweaty', t);
      if (c.plan!.key !== key) switched = t;
    }
    expect(switched).toBeGreaterThan(20);
    expect(switched - 20).toBeLessThan(5);
    // Not spliced: the new level's routine from the start.
    const fresh = new Conductor();
    fresh.update(tl, 'lvl', 'sweaty', 0);
    expect(c.plan!.instances.map((i) => i.move.id)).toEqual(fresh.plan!.instances.map((i) => i.move.id));
  });

  it('re-plans when the level changes, and is deterministic', () => {
    const map = songMap(120, 'det');
    const tl: BeatTimeline = { map, live: null, revision: 1 };
    const a = new Conductor();
    const b = new Conductor();
    a.update(tl, 'det', 'sweaty', 0);
    b.update(tl, 'det', 'sweaty', 0);
    expect(a.plan!.instances.map((i) => i.move.id)).toEqual(b.plan!.instances.map((i) => i.move.id));
    const before = a.plan!.key;
    a.update(tl, 'det', 'chill', 1);
    for (let f = 1; f < 600; f++) a.update(tl, 'det', 'chill', 1 + f / 60);
    expect(a.plan!.key).not.toBe(before);
  });
});
