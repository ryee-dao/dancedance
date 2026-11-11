import { describe, expect, it } from 'vitest';
import { RealFFT } from './fft';
import { Resampler, resample } from './resample';
import { mulberry32 } from './synth.testutil';

function naiveDft(x: Float64Array): { re: Float64Array; im: Float64Array } {
  const n = x.length;
  const re = new Float64Array(n / 2 + 1);
  const im = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) {
    let sr = 0;
    let si = 0;
    for (let t = 0; t < n; t++) {
      const a = (-2 * Math.PI * k * t) / n;
      sr += x[t] * Math.cos(a);
      si += x[t] * Math.sin(a);
    }
    re[k] = sr;
    im[k] = si;
  }
  return { re, im };
}

describe('RealFFT', () => {
  for (const n of [4, 16, 256, 1024]) {
    it(`matches a naive DFT for N=${n}`, () => {
      const rand = mulberry32(n);
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = rand() * 2 - 1;
      const fft = new RealFFT(n);
      const re = new Float64Array(n / 2 + 1);
      const im = new Float64Array(n / 2 + 1);
      fft.forward(x, re, im);
      const ref = naiveDft(x);
      const pow = new Float64Array(n / 2 + 1);
      fft.power(x, pow);
      for (let k = 0; k <= n / 2; k++) {
        expect(re[k]).toBeCloseTo(ref.re[k], 8);
        expect(im[k]).toBeCloseTo(ref.im[k], 8);
        expect(pow[k]).toBeCloseTo(ref.re[k] ** 2 + ref.im[k] ** 2, 6);
      }
    });
  }

  it('rejects non-power-of-two sizes', () => {
    expect(() => new RealFFT(1000)).toThrow();
  });
});

describe('Resampler', () => {
  it('preserves a 1 kHz sine (44.1k -> 22.05k and 48k -> 22.05k)', () => {
    for (const inRate of [44100, 48000]) {
      const n = inRate; // 1 s
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * 1000 * i) / inRate);
      const y = resample(x, inRate, 22050);
      expect(Math.abs(y.length - 22050)).toBeLessThanOrEqual(1);
      let maxErr = 0;
      for (let j = 2000; j < 20000; j++) {
        const ref = Math.sin((2 * Math.PI * 1000 * j) / 22050);
        maxErr = Math.max(maxErr, Math.abs(y[j] - ref));
      }
      expect(maxErr).toBeLessThan(0.01);
    }
  });

  it('attenuates content above the new Nyquist frequency', () => {
    const inRate = 44100;
    const x = new Float32Array(inRate);
    for (let i = 0; i < inRate; i++) x[i] = Math.sin((2 * Math.PI * 15000 * i) / inRate);
    const y = resample(x, inRate, 22050);
    let sumSq = 0;
    for (let j = 2000; j < 20000; j++) sumSq += y[j] * y[j];
    const rms = Math.sqrt(sumSq / 18000);
    expect(rms).toBeLessThan(0.01); // >~37 dB below the 0.707 input RMS
  });

  it('gives identical output for any chunking', () => {
    const rand = mulberry32(3);
    const x = new Float32Array(48000);
    for (let i = 0; i < x.length; i++) x[i] = rand() * 2 - 1;
    const whole = resample(x, 48000, 22050);
    const r = new Resampler(48000, 22050);
    const parts: number[] = [];
    const sizes = [128, 441, 4096, 1, 7];
    let k = 0;
    for (let i = 0; i < x.length; ) {
      const n = sizes[k++ % sizes.length];
      parts.push(...r.process(x.subarray(i, i + n)));
      i += n;
    }
    parts.push(...r.flush());
    expect(parts.length).toBe(whole.length);
    expect(Float32Array.from(parts)).toEqual(whole);
  });
});
