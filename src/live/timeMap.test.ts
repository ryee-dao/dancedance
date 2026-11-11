import { describe, expect, it } from 'vitest';
import { MIC_EXTRA_LATENCY, OffsetEstimator, TAB_CAPTURE_LATENCY, median, micLatency, rawOffset, tabLatency } from './timeMap';

describe('live time mapping', () => {
  it('rawOffset: song time at capture, minus latency, minus input time', () => {
    // Song is at 20.000 s now; the chunk ended 30 ms ago; 50 ms of path latency;
    // the analyser has 12 s of input. The sound was the song at 19.920 s.
    const off = rawOffset({ songNow: 20, perfNow: 1000, capturePerf: 970, inputTime: 12, latency: 0.05 });
    expect(off).toBeCloseTo(19.92 - 12, 9);
  });
  it('mic latency = context + track + constant + user offset; tab = capture pipeline only', () => {
    expect(micLatency({ contextLatency: 0.03, trackLatency: 0.01, userOffsetMs: 0 })).toBeCloseTo(0.04 + MIC_EXTRA_LATENCY, 9);
    expect(micLatency({ contextLatency: 0.03, trackLatency: 0.01, userOffsetMs: 200 })).toBeCloseTo(0.24 + MIC_EXTRA_LATENCY, 9);
    expect(micLatency({ contextLatency: NaN, trackLatency: -1, userOffsetMs: NaN })).toBeCloseTo(MIC_EXTRA_LATENCY, 9);
    expect(tabLatency()).toBe(TAB_CAPTURE_LATENCY);
    expect(tabLatency()).toBeLessThan(0.1);
  });
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
  it('OffsetEstimator rejects jitter and single outliers', () => {
    const e = new OffsetEstimator();
    const jitter = [0, 0.004, -0.003, 0.002, -0.004, 0.001];
    for (let i = 0; i < 60; i++) expect(e.push(5 + jitter[i % jitter.length])).toBe('ok');
    expect(e.value!).toBeCloseTo(5, 2);
    expect(e.push(9)).toBe('ok'); // one bad message
    expect(e.value!).toBeCloseTo(5, 2);
  });
  it('OffsetEstimator reports a jump when the song time moves for good (seek / stall)', () => {
    const e = new OffsetEstimator({ jumpCount: 4 });
    for (let i = 0; i < 10; i++) e.push(5);
    expect(e.push(7)).toBe('ok');
    expect(e.push(7)).toBe('ok');
    expect(e.push(7)).toBe('ok');
    expect(e.push(7)).toBe('jump');
    expect(e.value).toBe(7);
  });
});
