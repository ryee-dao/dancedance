import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeatMap } from '../core/analysis';
import type { AnalysisRequest } from '../workers/analysis.worker';
import { analyzePcm, inlineRunner, type AnalysisRunner } from './analyzeAudio';
import { mkMap } from './testMaps.testutil';

/** Fake runner: each job finishes after `ms(req)` fake milliseconds. */
function fakeRunner(ms: (req: AnalysisRequest) => number) {
  const jobs: AnalysisRequest[] = [];
  const runner: AnalysisRunner = (req) => {
    jobs.push(req);
    let timer: ReturnType<typeof setTimeout>;
    const promise = new Promise<BeatMap>((resolve) => {
      timer = setTimeout(() => resolve(mkMap({ source: req.source, videoId: req.videoId, until: req.maxSeconds ?? req.duration, duration: req.duration })), ms(req));
    });
    return { promise, cancel: () => clearTimeout(timer) };
  };
  return { runner, jobs };
}

const audio = (seconds: number) => ({ pcm: new Float32Array(seconds * 100), sampleRate: 100, duration: seconds });

describe('analyzePcm (full analysis, or first 30 s when slow)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('uses the full analysis when it finishes within the budget', async () => {
    const { runner, jobs } = fakeRunner(() => 5000);
    const a = analyzePcm(audio(200), { key: 'k', source: 'file', runner });
    await vi.advanceTimersByTimeAsync(5000);
    const first = await a.first;
    expect(first.partial).toBeUndefined();
    expect(await a.full).toBe(first);
    expect(jobs).toHaveLength(1);
  });

  it('starts a 30 s job after the 15 s budget, plays with it, and delivers the full map later', async () => {
    const { runner, jobs } = fakeRunner((req) => (req.maxSeconds ? 1000 : 40000));
    const a = analyzePcm(audio(200), { key: 'k', source: 'device', runner });
    let firstAt = -1;
    void a.first.then(() => (firstAt = Date.now()));
    const t0 = Date.now();
    await vi.advanceTimersByTimeAsync(15000);
    expect(jobs).toHaveLength(2);
    expect(jobs[1].maxSeconds).toBe(30);
    expect(jobs[1].pcm.length).toBe(30 * 100);
    expect(jobs[1].duration).toBe(200);
    await vi.advanceTimersByTimeAsync(1000);
    const first = await a.first;
    expect(firstAt - t0).toBe(16000);
    expect(first.partial).toBe(true);
    expect(first.source).toBe('device');
    await vi.advanceTimersByTimeAsync(25000);
    const full = await a.full;
    expect(full.partial).toBeUndefined();
  });

  it('does not start the partial job for songs shorter than 30 s', async () => {
    const { runner, jobs } = fakeRunner(() => 20000);
    const a = analyzePcm(audio(20), { key: 'k', source: 'file', runner });
    await vi.advanceTimersByTimeAsync(20000);
    await a.first;
    expect(jobs).toHaveLength(1);
  });

  it('honours a custom budget and rejects if the analysis fails', async () => {
    const failing: AnalysisRunner = () => ({ promise: Promise.reject(new Error('bad')), cancel() {} });
    const a = analyzePcm(audio(60), { key: 'k', source: 'file', runner: failing, budgetMs: 10 });
    await expect(a.first).rejects.toThrow('bad');
  });
});

describe('inlineRunner (no Worker available)', () => {
  it('runs the real analyzer and reports progress', async () => {
    const sr = 22050;
    const pcm = new Float32Array(sr * 12);
    for (let k = 0; k * 0.5 < 11.5; k++) {
      const i0 = Math.round((0.25 + k * 0.5) * sr);
      for (let i = 0; i < 2000; i++) pcm[i0 + i] = Math.sin(i / 3) * Math.exp(-i / 300);
    }
    const prog: number[] = [];
    const map = await inlineRunner({ pcm, sampleRate: sr, videoId: 'x', source: 'file', duration: 12 }, (f) => prog.push(f)).promise;
    expect(map.bpm).toBeGreaterThan(115);
    expect(map.bpm).toBeLessThan(125);
    expect(prog[prog.length - 1]).toBe(1);
  });
});
