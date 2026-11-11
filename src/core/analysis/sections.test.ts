import { describe, expect, it } from 'vitest';
import type { BeatMap } from './beatmap';
import { analyzeOffline } from './offline';
import { synthClickTrack, type SynthSection } from './synth.testutil';

function assertCoverage(m: BeatMap) {
  expect(m.sections.length).toBeGreaterThanOrEqual(1);
  expect(m.sections[0].start).toBe(0);
  expect(m.sections[m.sections.length - 1].end).toBe(m.duration);
  for (let i = 1; i < m.sections.length; i++) expect(m.sections[i].start).toBe(m.sections[i - 1].end);
  for (const s of m.sections) {
    expect(s.end).toBeGreaterThan(s.start);
    expect(s.energy).toBeGreaterThanOrEqual(0);
    expect(s.energy).toBeLessThanOrEqual(1);
  }
}

function assertOnDownbeats(m: BeatMap) {
  const dbTimes = new Set(m.downbeats.map((i) => m.beats[i]));
  for (let i = 1; i < m.sections.length; i++) expect(dbTimes.has(m.sections[i].start)).toBe(true);
}

describe('sections', () => {
  for (const bpm of [100, 128]) {
    it(`quiet-loud-quiet-loud-quiet at ${bpm} BPM`, () => {
      const structure: SynthSection[] = [
        { bars: 8, gain: 0.2 },
        { bars: 8, gain: 1, full: true },
        { bars: 8, gain: 0.2 },
        { bars: 8, gain: 1, full: true },
        { bars: 8, gain: 0.2 },
      ];
      const s = synthClickTrack({ bpm, accent: true, structure });
      const m = analyzeOffline(s.pcm, s.sampleRate);
      console.log(`[sections] ${bpm} BPM truth=${s.sectionTimes.map((t) => t.toFixed(2)).join(',')}`);
      for (const x of m.sections) console.log(`[sections]   ${x.start.toFixed(3)}-${x.end.toFixed(3)} ${x.type} e=${x.energy}`);
      assertCoverage(m);
      assertOnDownbeats(m);
      expect(m.sections).toHaveLength(5);
      // Boundaries at the true structural changes (within 60 ms).
      for (let k = 1; k < 5; k++) expect(Math.abs(m.sections[k].start - s.sectionTimes[k])).toBeLessThan(0.06);
      const [a, b, c, d, e] = m.sections;
      expect(['intro', 'verse']).toContain(a.type);
      expect(['outro', 'verse']).toContain(e.type);
      expect(['chorus', 'drop']).toContain(b.type);
      expect(['chorus', 'drop']).toContain(d.type);
      expect(['verse', 'intro', 'outro']).toContain(c.type);
      for (const quiet of [a, c, e]) expect(quiet.energy).toBeLessThan(0.4);
      for (const loud of [b, d]) expect(loud.energy).toBeGreaterThan(0.7);
    });
  }

  it('uniform track gives one or more plausible sections with full coverage', () => {
    const s = synthClickTrack({ bpm: 120, duration: 60, accent: true, hihat: true });
    const m = analyzeOffline(s.pcm, s.sampleRate);
    assertCoverage(m);
    assertOnDownbeats(m);
    for (const x of m.sections) expect(x.type).not.toBe('drop');
  });

  it('minimum section length is 4 bars', () => {
    // Alternate loudness every 2 bars: too short to be sections.
    const structure: SynthSection[] = [];
    for (let i = 0; i < 12; i++) structure.push({ bars: 2, gain: i % 2 ? 1 : 0.3, full: i % 2 === 1 });
    const s = synthClickTrack({ bpm: 120, accent: true, structure });
    const m = analyzeOffline(s.pcm, s.sampleRate);
    assertCoverage(m);
    const barSec = (4 * 60) / 120;
    for (let i = 0; i < m.sections.length; i++) {
      expect(m.sections[i].end - m.sections[i].start).toBeGreaterThan(4 * barSec - 0.1);
    }
  });
});
