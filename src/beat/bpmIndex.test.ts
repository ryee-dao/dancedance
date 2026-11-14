import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('loadCloudIndex', () => {
  it('asks again in the background when the index could not be read at start-up (doubling), and stops once it has it', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const { loadCloudIndex, cloudGenres, INDEX_RETRY_MS } = await import('./bpmIndex');
    let calls = 0;
    const body = JSON.stringify({ songs: { AAAAAAAAAAA: { bpm: 140, duration: 200, genres: ['trap', 'drill'] } } });
    const fetchFn = async () => {
      calls++;
      if (calls < 3) throw new TypeError('Failed to fetch');
      return { ok: true, text: async () => body } as Response;
    };
    await loadCloudIndex('https://x.example/', fetchFn, true);
    expect(calls).toBe(1);
    expect(cloudGenres('AAAAAAAAAAA')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(INDEX_RETRY_MS);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(INDEX_RETRY_MS); // the second wait is twice as long
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(INDEX_RETRY_MS);
    expect(calls).toBe(3);
    expect(cloudGenres('AAAAAAAAAAA')).toEqual(['trap', 'drill']);
    await vi.advanceTimersByTimeAsync(100 * INDEX_RETRY_MS);
    expect(calls).toBe(3);
  });
});
