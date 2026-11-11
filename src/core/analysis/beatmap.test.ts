import { describe, expect, it } from 'vitest';
import {
  ANALYZER_VERSION,
  BEATMAP_VERSION,
  BeatMapError,
  parse,
  serialize,
  shouldReplace,
  sourceRank,
  type BeatMap,
} from './beatmap';

const good = (): BeatMap => ({
  v: BEATMAP_VERSION,
  analyzerVersion: ANALYZER_VERSION,
  videoId: 'dQw4w9WgXcQ',
  duration: 12.3456,
  bpm: 120.004,
  beats: [0.5, 1.0004, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
  downbeats: [0, 4],
  sections: [
    { start: 0, end: 6, type: 'intro', energy: 0.2 },
    { start: 6, end: 12.3456, type: 'chorus', energy: 0.91 },
  ],
  source: 'device',
});

describe('BeatMap serialisation', () => {
  it('round-trips (times rounded to ms)', () => {
    const m = good();
    const back = parse(serialize(m));
    expect(back.beats[1]).toBe(1);
    expect(back.duration).toBe(12.346);
    expect(back.bpm).toBe(120);
    expect(back.sections[1].end).toBe(12.346);
    expect(parse(serialize(back))).toEqual(back);
    expect(back.partial).toBeUndefined();
    const p = parse(serialize({ ...m, partial: true }));
    expect(p.partial).toBe(true);
  });

  it('drops unknown fields', () => {
    const json = JSON.stringify({ ...good(), extra: 'x' });
    expect('extra' in parse(json)).toBe(false);
  });

  const bad: [string, (m: Record<string, unknown>) => unknown][] = [
    ['not JSON', () => '{nope'],
    ['an array', () => []],
    ['wrong version', (m) => ({ ...m, v: 2 })],
    ['missing analyzerVersion', (m) => ({ ...m, analyzerVersion: undefined })],
    ['videoId not a string', (m) => ({ ...m, videoId: 42 })],
    ['negative duration', (m) => ({ ...m, duration: -1 })],
    ['NaN bpm (as string)', (m) => ({ ...m, bpm: 'NaN' })],
    ['beats not an array', (m) => ({ ...m, beats: '1,2' })],
    ['decreasing beats', (m) => ({ ...m, beats: [1, 0.5] })],
    ['beat after the end', (m) => ({ ...m, beats: [0.5, 99] })],
    ['downbeat out of range', (m) => ({ ...m, downbeats: [0, 8] })],
    ['fractional downbeat', (m) => ({ ...m, downbeats: [0.5] })],
    ['unknown section type', (m) => ({ ...m, sections: [{ start: 0, end: 12, type: 'bridge', energy: 0.5 }] })],
    ['energy above 1', (m) => ({ ...m, sections: [{ start: 0, end: 12, type: 'verse', energy: 1.5 }] })],
    ['overlapping sections', (m) => ({
      ...m,
      sections: [
        { start: 0, end: 7, type: 'verse', energy: 0.5 },
        { start: 6, end: 12, type: 'verse', energy: 0.5 },
      ],
    })],
    ['no sections', (m) => ({ ...m, sections: [] })],
    ['unknown source', (m) => ({ ...m, source: 'youtube' })],
    ['partial not boolean', (m) => ({ ...m, partial: 'yes' })],
  ];
  for (const [name, mutate] of bad) {
    it(`rejects ${name} with a clear error`, () => {
      const value = mutate(good() as unknown as Record<string, unknown>);
      const json = typeof value === 'string' ? value : JSON.stringify(value);
      expect(() => parse(json)).toThrow(BeatMapError);
      expect(() => parse(json)).toThrow(/Invalid beat map/);
    });
  }

  it('serialize refuses invalid maps', () => {
    expect(() => serialize({ ...good(), beats: [2, 1] })).toThrow(BeatMapError);
  });
});

describe('source ranking', () => {
  it('prefers cloud > device > file > tab > mic', () => {
    const order = (['mic', 'tab', 'file', 'device', 'cloud'] as const).map(sourceRank);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });

  it('shouldReplace: better source, completeness first', () => {
    const mic = { ...good(), source: 'mic' as const };
    const cloud = { ...good(), source: 'cloud' as const };
    const devicePartial = { ...good(), source: 'device' as const, partial: true };
    expect(shouldReplace(undefined, mic)).toBe(true);
    expect(shouldReplace(mic, cloud)).toBe(true);
    expect(shouldReplace(cloud, mic)).toBe(false);
    expect(shouldReplace(mic, mic)).toBe(true); // same quality: newer wins
    expect(shouldReplace(devicePartial, mic)).toBe(true);
    expect(shouldReplace(mic, devicePartial)).toBe(false);
  });
});
