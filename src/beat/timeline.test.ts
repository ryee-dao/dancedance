import { describe, expect, it } from 'vitest';
import type { BeatTimeline, LiveBeats } from './beatSource';
import { lastBeat, lastIndexAtOrBefore, mapCoverageEnd, sectionAtTime } from './timeline';
import { mkMap } from './testMaps.testutil';

const live = (o: Partial<LiveBeats>): LiveBeats => ({ locked: true, bpm: 120, beats: [], nextBeats: [], ...o });

describe('timeline helpers', () => {
  it('binary search', () => {
    expect(lastIndexAtOrBefore([1, 2, 3], 0.5)).toBe(-1);
    expect(lastIndexAtOrBefore([1, 2, 3], 2)).toBe(1);
    expect(lastIndexAtOrBefore([1, 2, 3], 9)).toBe(2);
  });
  it('finds the last beat and downbeats from a map', () => {
    const tl: BeatTimeline = { map: mkMap({ first: 0.5 }), live: null, revision: 1 };
    expect(lastBeat(tl, 0.2)).toBeNull();
    const h = lastBeat(tl, 0.6)!;
    expect(h.time).toBe(0.5);
    expect(h.downbeat).toBe(true);
    expect(h.period).toBeCloseTo(0.5, 3);
    expect(lastBeat(tl, 1.05)!.downbeat).toBe(false);
    expect(sectionAtTime(tl, 100)?.type).toBe('chorus');
  });
  it('hands over from a partial map to live beats after the map ends', () => {
    const map = mkMap({ partial: true, until: 30, first: 0.5 });
    expect(mapCoverageEnd(map)).toBeCloseTo(30.25, 2); // last beat 30.0 + half a period
    const tl: BeatTimeline = { map, live: live({ beats: [40, 40.5, 41], nextBeats: [41.5, 42] }), revision: 1 };
    expect(lastBeat(tl, 10)!.from).toBe('map');
    const h = lastBeat(tl, 41.7)!;
    expect(h.from).toBe('live');
    expect(h.time).toBe(41.5);
    expect(lastBeat(tl, 41.2)!.time).toBe(41);
  });
  it('ignores live tracking until it is locked', () => {
    const tl: BeatTimeline = { map: null, live: live({ locked: false, beats: [1, 1.5] }), revision: 0 };
    expect(lastBeat(tl, 2)).toBeNull();
  });
});
