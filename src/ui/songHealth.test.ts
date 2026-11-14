import { describe, expect, it } from 'vitest';
import { restoreRuns, runsMaxAge } from './songHealth';

describe('song health: GitHub budget', () => {
  it('asks GitHub directly at most every 5 min, every 2 min while a song is on its way (10 after half an hour)', () => {
    const MIN = 60_000;
    expect(runsMaxAge('github', null, false)).toBe(5 * MIN);
    expect(runsMaxAge('github', 3 * MIN, false)).toBe(2 * MIN);
    expect(runsMaxAge('github', 45 * MIN, false)).toBe(10 * MIN);
    expect(runsMaxAge(null, null, true)).toBe(30_000); // "Check again"
    expect(runsMaxAge('relay', null, false)).toBe(MIN); // the relay caches for a minute itself
    // While waiting, each look is the list plus usually one jobs call (finished runs' jobs are kept):
    // 15 looks in the first half hour, about 30 calls, half of GitHub's hourly allowance.
    expect((30 * MIN) / runsMaxAge('github', 0, false)).toBe(15);
  });
  it('a saved answer is used only when it looks right', () => {
    expect(restoreRuns(null)).toBeNull();
    expect(restoreRuns({ state: 'rate-limited', until: 5, at: 1 })).toEqual({ state: 'rate-limited', until: 5, at: 1 });
    expect(restoreRuns({ state: 'ok', via: 'github', at: 1, runs: [{ id: 1, workflow: 'beatmaps', kind: 'add', status: 'completed', createdAt: '2026-11-14T22:10:18Z' }] })).toMatchObject({
      state: 'ok',
      runs: [{ id: 1, conclusion: null, startedAt: '2026-11-14T22:10:18Z' }],
    });
    expect(restoreRuns({ state: 'ok', via: 'elsewhere', at: 1, runs: [] })).toBeNull();
    expect(restoreRuns({ state: 'ok', via: 'github', at: 'x', runs: [] })).toBeNull();
  });
});
