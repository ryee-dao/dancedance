import { describe, expect, it } from 'vitest';
import { parse, serialize, validateBeatMap } from './beatmap';
import { analyzeOffline } from './offline';
import { StreamingAnalyzer } from './streaming';
import { fMeasure, synthClickTrack, synthNoise } from './synth.testutil';

describe('edge cases never throw and return valid maps', () => {
  it('silence', () => {
    const m = analyzeOffline(new Float32Array(22050 * 10), 22050, { videoId: 'silence' });
    expect(() => validateBeatMap(m)).not.toThrow();
    expect(m.beats).toEqual([]);
    expect(m.bpm).toBe(0);
    expect(m.sections).toHaveLength(1);
    expect(m.sections[0]).toMatchObject({ start: 0, end: 10 });
  });

  it('empty input', () => {
    const m = analyzeOffline(new Float32Array(0), 44100);
    expect(() => validateBeatMap(m)).not.toThrow();
    expect(m.beats).toEqual([]);
    expect(m.sections).toEqual([]);
  });

  it('very short input (< 5 s) of clicks', () => {
    for (const dur of [0.5, 1.5, 3, 4.5]) {
      const s = synthClickTrack({ bpm: 120, duration: dur });
      const m = analyzeOffline(s.pcm, s.sampleRate);
      expect(() => validateBeatMap(m)).not.toThrow();
      console.log(`[edge] ${dur}s clip: bpm=${m.bpm} beats=${m.beats.length} (truth ${s.beats.length})`);
      if (dur >= 3) expect(fMeasure(m.beats, s.beats).f).toBeGreaterThan(0.8);
    }
  });

  it('pure white noise gives no beats', () => {
    for (const seed of [1, 2, 3]) {
      const m = analyzeOffline(synthNoise(30, 0.1, 22050, seed), 22050);
      expect(() => validateBeatMap(m)).not.toThrow();
      console.log(`[edge] noise seed ${seed}: bpm=${m.bpm} beats=${m.beats.length}`);
      expect(m.beats).toEqual([]);
    }
  });

  it('non-finite-free output for clipped/loud input', () => {
    const s = synthClickTrack({ bpm: 128, duration: 20, gain: 8 });
    for (let i = 0; i < s.pcm.length; i++) s.pcm[i] = Math.max(-1, Math.min(1, s.pcm[i]));
    const m = analyzeOffline(s.pcm, s.sampleRate);
    expect(() => validateBeatMap(m)).not.toThrow();
    expect(fMeasure(m.beats, s.beats).f).toBeGreaterThanOrEqual(0.95);
  });

  it('streaming on short / noise input does not throw', () => {
    const sa = new StreamingAnalyzer({ sampleRate: 48000 });
    sa.push(synthNoise(6, 0.1, 48000));
    expect(sa.state.locked).toBe(false);
    expect(() => validateBeatMap(sa.finalize('n', 6, 'mic'))).not.toThrow();
  });

  it('rejects an invalid sample rate', () => {
    expect(() => analyzeOffline(new Float32Array(10), 0)).toThrow();
    expect(() => new StreamingAnalyzer({ sampleRate: NaN })).toThrow();
  });
});

describe('determinism, partial analysis, progress, speed', () => {
  it('same input gives an identical BeatMap', () => {
    const s = synthClickTrack({ bpm: 128, duration: 30, hihat: true, snrDb: 15, accent: true });
    const a = analyzeOffline(s.pcm, s.sampleRate, { videoId: 'x' });
    const b = analyzeOffline(s.pcm.slice(), s.sampleRate, { videoId: 'x' });
    expect(a).toEqual(b);
    expect(serialize(a)).toBe(serialize(b));
    expect(parse(serialize(a))).toEqual(a);
  });

  it('maxSeconds analyses only the start and marks the map partial', () => {
    const s = synthClickTrack({ bpm: 120, duration: 60, accent: true });
    const m = analyzeOffline(s.pcm, s.sampleRate, { maxSeconds: 20, videoId: 'p' });
    expect(m.partial).toBe(true);
    expect(m.duration).toBe(60);
    expect(m.beats[m.beats.length - 1]).toBeLessThanOrEqual(20);
    expect(fMeasure(m.beats, s.beats.filter((t) => t <= 20)).f).toBeGreaterThanOrEqual(0.95);
    expect(m.sections[m.sections.length - 1].end).toBe(60);
    expect(() => validateBeatMap(m)).not.toThrow();
    const full = analyzeOffline(s.pcm, s.sampleRate);
    expect(full.partial).toBeUndefined();
  });

  it('reports monotonic progress ending at 1', () => {
    const s = synthClickTrack({ bpm: 120, duration: 20 });
    const p: number[] = [];
    analyzeOffline(s.pcm, s.sampleRate, { onProgress: (f) => p.push(f) });
    expect(p.length).toBeGreaterThan(2);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
    expect(p[p.length - 1]).toBe(1);
  });

  it('analyses a 4-minute 44.1 kHz song in well under 2 s', () => {
    const s = synthClickTrack({ bpm: 123, duration: 240, sampleRate: 44100, hihat: true, accent: true, snrDb: 20 });
    analyzeOffline(s.pcm.subarray(0, 44100 * 5), 44100); // warm-up (JIT)
    const t0 = performance.now();
    const m = analyzeOffline(s.pcm, 44100);
    const ms = performance.now() - t0;
    const s22 = synthClickTrack({ bpm: 123, duration: 240, sampleRate: 22050, hihat: true, accent: true, snrDb: 20 });
    const t1 = performance.now();
    analyzeOffline(s22.pcm, 22050);
    const ms22 = performance.now() - t1;
    console.log(`[speed] 4-min song: ${ms.toFixed(0)} ms at 44.1 kHz (incl. resampling), ${ms22.toFixed(0)} ms at 22.05 kHz`);
    expect(ms).toBeLessThan(2000);
    expect(fMeasure(m.beats, s.beats).f).toBeGreaterThanOrEqual(0.95);
  });
});
