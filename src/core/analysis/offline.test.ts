import { describe, expect, it } from 'vitest';
import { analyzeOffline } from './offline';
import { fMeasure, synthClickTrack, type SynthOptions } from './synth.testutil';

const TEMPI = [80, 96, 100, 120, 128, 140, 160, 174];

function check(name: string, o: SynthOptions, minF = 0.95) {
  const s = synthClickTrack(o);
  const m = analyzeOffline(s.pcm, s.sampleRate, { videoId: 'test' });
  const fm = fMeasure(m.beats, s.beats, 0.05);
  const tempoErr = Math.abs(m.bpm / o.bpm - 1);
  console.log(
    `[beats] ${name.padEnd(22)} bpm=${m.bpm.toFixed(2).padStart(6)} (err ${(tempoErr * 100).toFixed(2)}%)  F=${fm.f.toFixed(3)} P=${fm.precision.toFixed(3)} R=${fm.recall.toFixed(3)}`,
  );
  expect(fm.f).toBeGreaterThanOrEqual(minF);
  return { s, m, fm, tempoErr };
}

describe('tempo: correct value and octave', () => {
  for (const bpm of TEMPI) {
    it(`${bpm} BPM within 1%`, () => {
      const { tempoErr } = check(`tempo ${bpm}`, { bpm, duration: 30 });
      expect(tempoErr).toBeLessThan(0.01);
    });
    it(`${bpm} BPM with off-beat hi-hats stays in the right octave`, () => {
      const { tempoErr } = check(`tempo+hats ${bpm}`, { bpm, duration: 30, hihat: true, hihatLevel: 0.45 });
      expect(tempoErr).toBeLessThan(0.01);
    });
  }
});

describe('beat positions: F-measure >= 0.95 at +-50 ms', () => {
  for (const bpm of TEMPI) {
    it(`clean ${bpm}`, () => {
      check(`clean ${bpm}`, { bpm, duration: 30, accent: true, seed: bpm });
    });
    it(`10 dB SNR white noise ${bpm}`, () => {
      const { tempoErr } = check(`noise10dB ${bpm}`, { bpm, duration: 30, accent: true, snrDb: 10, seed: bpm + 1 });
      expect(tempoErr).toBeLessThan(0.01);
    });
    it(`off-beat hi-hats (half-beat phase trap) ${bpm}`, () => {
      const { m, s } = check(`hats ${bpm}`, { bpm, duration: 30, hihat: true, hihatLevel: 0.45, seed: bpm + 2 });
      // Phase: beats must sit on the thumps, not half-way between.
      expect(fMeasure(m.beats, s.beats.slice(1).map((t, i) => (t + s.beats[i]) / 2)).f).toBeLessThan(0.1);
    });
    it(`2 s silent lead-in ${bpm}`, () => {
      const { m } = check(`leadin ${bpm}`, { bpm, duration: 30, leadIn: 2, seed: bpm + 3 });
      expect(m.beats[0]).toBeGreaterThan(2);
    });
    it(`+-2% gradual tempo drift ${bpm}`, () => {
      check(`drift2% ${bpm}`, { bpm, duration: 60, drift: 0.02, seed: bpm + 4 });
    });
  }
  it('noise + hats + drift + lead-in combined (120)', () => {
    check('combined 120', { bpm: 120, duration: 60, drift: 0.02, hihat: true, snrDb: 10, leadIn: 2, accent: true });
  });
  it('44.1 kHz input is resampled internally', () => {
    const { tempoErr } = check('44.1k 128', { bpm: 128, duration: 30, sampleRate: 44100, accent: true });
    expect(tempoErr).toBeLessThan(0.01);
  });
});

describe('harder synthetic variants (beyond the brief)', () => {
  for (const bpm of TEMPI) {
    it(`pop pattern (kick 1/3, snare 2/4, eighth hats) ${bpm}`, () => {
      const { tempoErr } = check(`pop ${bpm}`, { bpm, duration: 30, pattern: 'pop', accent: true, seed: bpm + 5 });
      expect(tempoErr).toBeLessThan(0.01);
    });
  }
  for (const bpm of [96, 128, 174]) {
    it(`hi-hats louder than the kick ${bpm}`, () => {
      const { tempoErr } = check(`loud hats ${bpm}`, { bpm, duration: 30, hihat: true, hihatLevel: 1.5, seed: bpm + 6 });
      expect(tempoErr).toBeLessThan(0.01);
    });
    it(`3 dB SNR pink noise ${bpm}`, () => {
      check(`pink3dB ${bpm}`, { bpm, duration: 30, snrDb: 3, noiseColor: 'pink', accent: true, seed: bpm + 7 });
    });
    it(`+-5% gradual tempo drift ${bpm}`, () => {
      check(`drift5% ${bpm}`, { bpm, duration: 60, drift: 0.05, seed: bpm + 8 });
    });
  }
});

describe('downbeats', () => {
  for (const bpm of [80, 120, 174]) {
    for (const variant of ['clean', 'hats+noise'] as const) {
      it(`land on the accented beat (${bpm} BPM, ${variant})`, () => {
        const o: SynthOptions =
          variant === 'clean'
            ? { bpm, duration: 40, accent: true }
            : { bpm, duration: 40, accent: true, hihat: true, snrDb: 10, seed: 9 };
        const s = synthClickTrack(o);
        const m = analyzeOffline(s.pcm, s.sampleRate);
        const est = m.downbeats.map((i) => m.beats[i]);
        const ref = s.downbeats.map((i) => s.beats[i]);
        const fm = fMeasure(est, ref, 0.05);
        console.log(`[downbeats] ${bpm} ${variant}: F=${fm.f.toFixed(3)} (${est.length} est / ${ref.length} ref)`);
        expect(fm.f).toBeGreaterThanOrEqual(0.95);
        // Downbeats are 4 beats apart.
        for (let k = 1; k < m.downbeats.length; k++) expect(m.downbeats[k] - m.downbeats[k - 1]).toBe(4);
      });
    }
  }
});
