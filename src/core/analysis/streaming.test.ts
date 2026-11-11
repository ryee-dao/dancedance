import { describe, expect, it } from 'vitest';
import { analyzeOffline } from './offline';
import { StreamingAnalyzer } from './streaming';
import { fMeasure, synthClickTrack, synthPattern, type PatternEvent, type SynthOptions } from './synth.testutil';

const CHUNKS = [128, 441, 4096];

function stream(o: SynthOptions, timeOffset = 0) {
  const s = synthClickTrack(o);
  const sa = new StreamingAnalyzer({ sampleRate: s.sampleRate, timeOffset });
  let lockAt = -1;
  let maxErr = 0;
  let checks = 0;
  const lastTrue = s.beats[s.beats.length - 1];
  let k = 0;
  for (let i = 0; i < s.pcm.length; ) {
    const n = CHUNKS[k++ % CHUNKS.length];
    sa.push(s.pcm.subarray(i, Math.min(s.pcm.length, i + n)));
    i += n;
    const st = sa.state;
    if (st.locked && lockAt < 0) lockAt = st.time;
    if (st.locked && st.nextBeats.length && st.nextBeats[0] < lastTrue + 0.1) {
      const nb = st.nextBeats[0];
      let d = Infinity;
      for (const b of s.beats) d = Math.min(d, Math.abs(b - nb));
      maxErr = Math.max(maxErr, d);
      checks++;
    }
  }
  return { s, sa, lockAt, maxErr, checks };
}

describe('StreamingAnalyzer', () => {
  for (const bpm of [80, 96, 100, 120, 128, 140, 160, 174]) {
    it(`locks within 10 s and predicts beats within 60 ms (${bpm} BPM, quiet noisy mic, odd chunks)`, () => {
      // Quiet "mic": -26 dB overall gain, 10 dB SNR white noise, 44.1 kHz.
      const { s, sa, lockAt, maxErr, checks } = stream({
        bpm,
        duration: 30,
        sampleRate: 44100,
        snrDb: 10,
        gain: 0.05,
        accent: true,
        seed: bpm * 7,
      });
      const live = fMeasure(sa.state.beats, s.beats);
      console.log(
        `[stream] ${bpm}: lock at ${lockAt.toFixed(2)} s, live bpm ${sa.state.bpm.toFixed(2)}, max next-beat error ${(maxErr * 1000).toFixed(1)} ms over ${checks} checks, live-beats F=${live.f.toFixed(3)}`,
      );
      expect(lockAt).toBeGreaterThan(0);
      expect(lockAt).toBeLessThanOrEqual(10);
      expect(checks).toBeGreaterThan(100);
      expect(maxErr).toBeLessThanOrEqual(0.06);
      expect(Math.abs(sa.state.bpm / bpm - 1)).toBeLessThan(0.01);
      expect(live.f).toBeGreaterThan(0.9);

      const fin = sa.finalize('vid', s.duration, 'mic');
      const off = analyzeOffline(s.pcm, s.sampleRate, { videoId: 'vid', source: 'mic' });
      // Same features, same tracker: the saved map equals the offline result.
      expect(fin).toEqual(off);
      expect(fMeasure(fin.beats, s.beats).f).toBeGreaterThanOrEqual(0.95);
    });
  }

  it('locks within 10 s of the music starting after a 3 s noise-only lead-in', () => {
    const { lockAt, maxErr } = stream({ bpm: 110, duration: 25, leadIn: 3, accent: true, hihat: true, snrDb: 15 });
    console.log(`[stream] 3 s noise-only lead-in: lock at ${lockAt.toFixed(2)} s, max next-beat error ${(maxErr * 1000).toFixed(1)} ms`);
    expect(lockAt).toBeGreaterThan(3);
    expect(lockAt - 3).toBeLessThanOrEqual(10);
    expect(maxErr).toBeLessThanOrEqual(0.06);
  });

  it('runs much faster than real time', () => {
    const s = synthClickTrack({ bpm: 125, duration: 120, sampleRate: 48000, hihat: true, snrDb: 15 });
    const sa = new StreamingAnalyzer({ sampleRate: 48000 });
    const t0 = performance.now();
    for (let i = 0; i < s.pcm.length; i += 2048) sa.push(s.pcm.subarray(i, i + 2048));
    const ms = performance.now() - t0;
    console.log(`[stream] 120 s of 48 kHz audio processed live in ${ms.toFixed(0)} ms (${((ms / 120000) * 100).toFixed(2)}% of real time)`);
    expect(ms).toBeLessThan(12000);
  });

  it('applies the time offset in finalize (song time = input time + offset)', () => {
    const o: SynthOptions = { bpm: 120, duration: 20, accent: true };
    const { s, sa } = stream(o, 1.5);
    const fin = sa.finalize('vid', 25, 'tab');
    const off = analyzeOffline(s.pcm, s.sampleRate);
    expect(fin.beats.length).toBe(off.beats.length);
    for (let i = 0; i < fin.beats.length; i++) expect(fin.beats[i]).toBeCloseTo(off.beats[i] + 1.5, 3);
    expect(fin.duration).toBe(25);
    expect(fin.sections[0].start).toBe(0);
    expect(fin.sections[fin.sections.length - 1].end).toBe(25);
    expect(fin.partial).toBeUndefined(); // 1.5 s + 20 s of 25 s: misses < 5 s
    const sa2 = new StreamingAnalyzer({ sampleRate: s.sampleRate });
    sa2.push(s.pcm);
    expect(sa2.finalize('vid', 60, 'mic').partial).toBe(true);
  });

  it('does not lock on silence or noise, and unlocks when music stops', () => {
    const sr = 22050;
    const music = synthClickTrack({ bpm: 120, duration: 15, accent: true }).pcm;
    const pcm = new Float32Array(sr * 25);
    pcm.set(music, 0); // 15 s music then 10 s silence
    const sa = new StreamingAnalyzer({ sampleRate: sr });
    let lockedDuringMusic = false;
    for (let i = 0; i < pcm.length; i += 1000) {
      sa.push(pcm.subarray(i, i + 1000));
      if (sa.state.time < 15 && sa.state.locked) lockedDuringMusic = true;
    }
    expect(lockedDuringMusic).toBe(true);
    expect(sa.state.locked).toBe(false);
    expect(sa.state.nextBeats).toEqual([]);

    const silent = new StreamingAnalyzer({ sampleRate: sr });
    silent.push(new Float32Array(sr * 12));
    expect(silent.state.locked).toBe(false);
    const m = silent.finalize('s', 12, 'mic');
    expect(m.beats).toEqual([]);
  });

  it('rejects pushes after finalize', () => {
    const sa = new StreamingAnalyzer({ sampleRate: 22050 });
    sa.push(new Float32Array(1000));
    sa.finalize('x', 1, 'mic');
    expect(() => sa.push(new Float32Array(10))).toThrow();
  });

  /**
   * A 124 BPM pop groove with a 16 s kick-only half-time breakdown (one hit
   * every other beat) in the middle, at -26 dB in a noisy room. Over the
   * breakdown a 10 s window honestly measures 62 BPM; the old tracker followed
   * it after ~2 s and stayed in the wrong octave.
   */
  function halfTimeBreakdown() {
    const bpm = 124;
    const P = 60 / bpm;
    const sr = 22050;
    const groove: PatternEvent[] = [
      { at: 0, kind: 'kick' },
      { at: 2, kind: 'kick' },
      { at: 1, kind: 'snare' },
      { at: 3, kind: 'snare' },
      ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((at) => ({ at, kind: 'hat' as const, gain: 0.6 })),
    ];
    const half: PatternEvent[] = [{ at: 0, kind: 'kick' }, { at: 2, kind: 'kick' }];
    const parts = [
      synthPattern({ bpm, bars: 12, events: groove, seed: 1 }),
      synthPattern({ bpm, bars: 8, events: half, seed: 2 }),
      synthPattern({ bpm, bars: 12, events: groove, seed: 3 }),
    ];
    // Each part is 0.25 s + whole bars + 0.5 s long; splice them on the bar grid.
    const barS = 4 * P;
    const total = parts.reduce((n, p, i) => n + Math.round(((i === 0 ? 0.25 : 0) + (p.beats.length / 4) * barS) * sr), 0);
    const pcm = new Float32Array(total + sr);
    let at = 0;
    parts.forEach((p, i) => {
      const from = i === 0 ? 0 : Math.round(0.25 * sr);
      const len = Math.round(((i === 0 ? 0.25 : 0) + (p.beats.length / 4) * barS) * sr);
      pcm.set(p.pcm.subarray(from, from + len), at);
      at += len;
    });
    const truth: number[] = [];
    for (let t = 0.25; t < at / sr; t += P) truth.push(t);
    // Quiet, noisy capture.
    let seed = 5;
    for (let i = 0; i < pcm.length; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      pcm[i] = 0.05 * (pcm[i] + 0.02 * (seed / 4294967296 - 0.5));
    }
    return { pcm, sr, truth, bpm };
  }

  it('holds the tempo octave through a half-time breakdown', () => {
    const { pcm, sr, bpm } = halfTimeBreakdown();
    const sa = new StreamingAnalyzer({ sampleRate: sr });
    let lockAt = -1;
    let minBpm = Infinity;
    let maxBpm = 0;
    for (let i = 0; i < pcm.length; i += 512) {
      sa.push(pcm.subarray(i, Math.min(pcm.length, i + 512)));
      const st = sa.state;
      if (st.locked && lockAt < 0) lockAt = st.time;
      if (lockAt >= 0 && st.locked) {
        minBpm = Math.min(minBpm, st.bpm);
        maxBpm = Math.max(maxBpm, st.bpm);
      }
    }
    console.log(`[stream] half-time breakdown: lock at ${lockAt.toFixed(1)} s, bpm range after lock ${minBpm.toFixed(1)}-${maxBpm.toFixed(1)}`);
    expect(lockAt).toBeGreaterThan(0);
    expect(lockAt).toBeLessThan(12);
    expect(minBpm / bpm).toBeGreaterThan(0.97);
    expect(maxBpm / bpm).toBeLessThan(1.03);
  });

  it('committed beats are monotonic, unique and on the true grid (within 40 ms) after lock', () => {
    for (const variant of ['breakdown', 'noisy hats'] as const) {
      let pcm: Float32Array;
      let sr: number;
      let truth: number[];
      let bpm: number;
      if (variant === 'breakdown') ({ pcm, sr, truth, bpm } = halfTimeBreakdown());
      else {
        const s = synthClickTrack({ bpm: 124, duration: 40, hihat: true, hihatLevel: 0.6, snrDb: 8, accent: true, seed: 77, sampleRate: 44100, gain: 0.1 });
        ({ pcm, sampleRate: sr } = s);
        truth = s.beats;
        bpm = 124;
      }
      const sa = new StreamingAnalyzer({ sampleRate: sr });
      const sizes = [128, 441, 4096, 1000];
      for (let i = 0, k = 0; i < pcm.length; k++) {
        const n = sizes[k % sizes.length];
        sa.push(pcm.subarray(i, Math.min(pcm.length, i + n)));
        i += n;
      }
      const beats = sa.state.beats;
      const P = 60 / bpm;
      expect(beats.length).toBeGreaterThan(20);
      let worst = 0;
      for (let k = 0; k < beats.length; k++) {
        if (k > 0) expect(beats[k] - beats[k - 1]).toBeGreaterThan(0.6 * P); // no duplicates / half-beat insertions
        let d = Infinity;
        for (const t of truth) d = Math.min(d, Math.abs(t - beats[k]));
        worst = Math.max(worst, d);
      }
      console.log(`[stream] committed beats (${variant}): ${beats.length}, worst error ${(worst * 1000).toFixed(1)} ms`);
      expect(worst).toBeLessThanOrEqual(0.04);
      // And they cover the music after lock (no long holes).
      const gaps = beats.slice(1).map((b, k) => b - beats[k]);
      expect(Math.max(...gaps)).toBeLessThan(2.6 * P);
    }
  });
});
