import { describe, expect, it } from 'vitest';
import type { BeatTimeline, LiveBeats } from '../../beat/beatSource';
import type { BeatMap } from '../analysis/beatmap';
import { LivePlanner, MAX_MAP_BEATS, generateRoutine, isUsableBeatMap, usableBpm, type MoveInstance } from '../choreo/generator';
import { songMap } from '../choreo/testutil';
import { Conductor } from './conductor';
import { NUM_CHANNELS, createPose } from './skeleton';

/** A regular grid of `n` beats at `bpm` (the bpm field says `bpmField`). */
function gridMap(bpm: number, n: number, bpmField = bpm, partial = false): BeatMap {
  const per = 60 / bpm;
  const beats: number[] = [];
  const downbeats: number[] = [];
  for (let i = 0; i < n; i++) {
    beats.push(0.5 + i * per);
    if (i % 4 === 0) downbeats.push(i);
  }
  const end = 0.5 + n * per;
  return { v: 1, analyzerVersion: 'test', videoId: 'bad', duration: end, bpm: bpmField, beats, downbeats, sections: [{ start: 0, end, type: 'verse', energy: 0.5 }], source: 'file', partial };
}

const BAD_MAPS: [string, () => BeatMap][] = [
  ['4000 BPM', () => gridMap(4000, 2000)],
  ['thousands of beats per minute, bpm field 0', () => gridMap(90000, 5000, 0)],
  ['NaN bpm field', () => ({ ...gridMap(120, 64), bpm: NaN })],
  ['Infinity bpm field', () => ({ ...gridMap(120, 64), bpm: Infinity })],
  ['5000 BPM field over a sane grid', () => gridMap(120, 64, 5000)],
  ['zero-length beat grid (all beats equal)', () => ({ ...gridMap(120, 64), beats: new Array(64).fill(3) })],
  ['non-increasing beats', () => {
    const m = gridMap(120, 64);
    m.beats[10] = m.beats[9];
    m.beats[20] = m.beats[19] - 1;
    return m;
  }],
  ['NaN beat time', () => {
    const m = gridMap(120, 64);
    m.beats[5] = NaN;
    return m;
  }],
  ['too many beats', () => gridMap(200, MAX_MAP_BEATS + 1)],
  ['partial map at 4000 BPM', () => gridMap(4000, 400, 4000, true)],
];

function finitePose(p: Float64Array): boolean {
  for (let c = 0; c < NUM_CHANNELS; c++) if (!Number.isFinite(p[c])) return false;
  return true;
}

/** Run a conductor over `seconds` at 30 fps; returns the plan kinds seen and the wall time. */
function drive(tlAt: (t: number) => BeatTimeline, seconds: number): { kinds: Set<string>; ms: number; finite: boolean } {
  const c = new Conductor();
  const pose = createPose();
  const kinds = new Set<string>();
  let finite = true;
  const t0 = performance.now();
  for (let f = 0; f < seconds * 30; f++) {
    const t = f / 30;
    c.update(tlAt(t), 'bad-song', 'cardio', t);
    c.evaluate(t, pose);
    c.upcoming(t);
    c.sectionAt(t);
    kinds.add(c.plan!.kind);
    if (!finitePose(pose)) finite = false;
  }
  return { kinds, ms: performance.now() - t0, finite };
}

describe('pathological beat data', () => {
  it('recognises usable tempos and maps', () => {
    expect(usableBpm(120)).toBe(true);
    for (const v of [0, -5, NaN, Infinity, 4000, 10]) expect(usableBpm(v)).toBe(false);
    expect(isUsableBeatMap(songMap(124))).toBe(true);
    expect(isUsableBeatMap(gridMap(120, 64, 0))).toBe(true); // bpm field unknown: tempo from the beats
    for (const [, make] of BAD_MAPS) expect(isUsableBeatMap(make())).toBe(false);
    expect(isUsableBeatMap(null)).toBe(false);
  });

  it.each(BAD_MAPS)('generator returns no routine for: %s', (_name, make) => {
    const t0 = performance.now();
    const r = generateRoutine(make(), 'sweaty');
    expect(r.instances.length).toBe(0);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it.each(BAD_MAPS)('conductor dances the idle groove for: %s', (_name, make) => {
    const map = make();
    const tl: BeatTimeline = { map, live: null, revision: 1 };
    const r = drive(() => tl, 30);
    expect([...r.kinds]).toEqual(['idle']);
    expect(r.finite).toBe(true);
    expect(r.ms).toBeLessThan(2000);
  });

  it.each([NaN, 0, -120, Infinity, 4000, 1e9])('ignores a locked live tracker reporting %s BPM', (bpm) => {
    // Beats arriving thousands per minute, with the bogus tempo.
    const live: LiveBeats = { locked: true, bpm, beats: [], nextBeats: [] };
    const r = drive((t) => {
      live.beats = [t - 0.002, t - 0.001, t];
      live.nextBeats = [t + 0.001, t + 1e6];
      return { map: null, live, revision: 0 };
    }, 20);
    expect([...r.kinds]).toEqual(['idle']);
    expect(r.finite).toBe(true);
    expect(r.ms).toBeLessThan(2000);
  });

  it('a good partial map followed by a bogus live tempo stays bounded', () => {
    const map = gridMap(120, 32, 120, true);
    const live: LiveBeats = { locked: true, bpm: 1e9, beats: [], nextBeats: [] };
    const r = drive((t) => {
      live.beats = [t];
      live.nextBeats = [t + 1e-9, Number.NaN, t + 1e7];
      return { map, live, revision: 3 };
    }, 40);
    expect(r.kinds.has('map')).toBe(true);
    expect(r.finite).toBe(true);
    expect(r.ms).toBeLessThan(3000);
  });

  it('the live planner bounds the work of one extend() call', () => {
    const lp = new LivePlanner('x', 'cardio', 120, 0);
    const out: MoveInstance[] = [];
    lp.extend(out, 1e9);
    expect(lp.end).toBeLessThan(2000);
    expect(out.length).toBeGreaterThan(0);
  });
});
