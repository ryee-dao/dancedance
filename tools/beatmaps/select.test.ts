import { describe, expect, it } from 'vitest';
import { isDue, planWork, preflightSkip, retryDelayMs, unionCandidates, type Candidate, type VideoStatus } from './select';

const V = '1.0.0';
const NOW = new Date('2026-11-10T12:00:00Z');
const id = (n: number) => `vid${String(n).padStart(8, '0')}`; // 11 chars
const cand = (n: number, origin: Candidate['origin'] = 'starter'): Candidate => ({ videoId: id(n), origin });
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe('unionCandidates', () => {
  it('keeps playlist order first, dedupes, drops invalid IDs', () => {
    const pl = [{ ...cand(1, 'playlist'), title: 'from playlist' }, cand(2, 'playlist')];
    const st = [{ ...cand(1), title: 'from starter' }, cand(3), { videoId: 'bad id', origin: 'starter' as const }];
    const u = unionCandidates(pl, st);
    expect(u.map((c) => c.videoId)).toEqual([id(1), id(2), id(3)]);
    expect(u[0].title).toBe('from playlist');
  });
});

describe('retry backoff', () => {
  const st = (reason: VideoStatus['reason'], attempts: number, h: number, state: VideoStatus['state'] = 'error'): VideoStatus => ({
    state,
    reason,
    attempts,
    lastTried: hoursAgo(h),
  });
  it('grows exponentially and is capped', () => {
    expect(retryDelayMs(st('error', 1, 0))).toBe(3600_000);
    expect(retryDelayMs(st('error', 3, 0))).toBe(4 * 3600_000);
    expect(retryDelayMs(st('error', 30, 0))).toBe(7 * 24 * 3600_000);
    expect(retryDelayMs(st('blocked', 30, 0, 'blocked'))).toBe(12 * 3600_000);
    expect(retryDelayMs(st('unavailable', 1, 0))).toBe(24 * 3600_000);
    expect(retryDelayMs(st('unavailable', 30, 0))).toBe(30 * 24 * 3600_000);
    expect(retryDelayMs(st('too-long', 1, 0))).toBe(Infinity);
  });
  it('an hourly cron retries a first failure on the next run (start-time jitter allowed)', () => {
    expect(isDue(st('error', 1, 0.9), NOW)).toBe(true);
    expect(isDue(st('error', 1, 0.5), NOW)).toBe(false);
    expect(isDue(st('error', 4, 5), NOW)).toBe(false); // needs 8 h
    expect(isDue(st('error', 4, 8), NOW)).toBe(true);
    expect(isDue({ state: 'error', attempts: 1, lastTried: 'garbage' }, NOW)).toBe(true);
  });
});

describe('planWork', () => {
  const base = { analyzerVersion: V, now: NOW, limit: 25 };

  it('skips songs mapped at the current version and orders new > retry > stale', () => {
    const candidates = [cand(1), cand(2), cand(3), cand(4), cand(5), cand(6)];
    const existing = new Map([
      [id(1), V], // done
      [id(2), '0.9.0'], // stale
      [id(5), '0.9.0'], // stale but failed re-analysis recently
    ]);
    const status: Record<string, VideoStatus> = {
      [id(3)]: { state: 'error', reason: 'error', attempts: 1, lastTried: hoursAgo(2) }, // due
      [id(4)]: { state: 'blocked', reason: 'blocked', attempts: 3, lastTried: hoursAgo(1) }, // waiting (4 h)
      [id(5)]: { state: 'error', reason: 'error', attempts: 2, lastTried: hoursAgo(0.5) }, // waiting
    };
    const p = planWork({ ...base, candidates, existing, status });
    expect(p.todo.map((w) => [w.candidate.videoId, w.why])).toEqual([
      [id(6), 'new'],
      [id(3), 'retry'],
      [id(2), 'stale'],
    ]);
    expect(p.done).toBe(1);
    expect(p.waiting).toBe(2);
    expect(p.deferred).toBe(0);
  });

  it('caps at limit and reports the rest as deferred', () => {
    const candidates = Array.from({ length: 40 }, (_, i) => cand(i));
    const p = planWork({ ...base, candidates, existing: new Map(), status: {}, limit: 25 });
    expect(p.todo).toHaveLength(25);
    expect(p.todo[0].candidate.videoId).toBe(id(0));
    expect(p.deferred).toBe(15);
  });

  it('a song marked ok whose map file vanished is processed again as new', () => {
    const p = planWork({
      ...base,
      candidates: [cand(1)],
      existing: new Map(),
      status: { [id(1)]: { state: 'ok', attempts: 1, lastTried: hoursAgo(1) } },
    });
    expect(p.todo.map((w) => w.why)).toEqual(['new']);
  });

  it('force ignores existing maps and backoff', () => {
    const p = planWork({
      ...base,
      force: true,
      candidates: [cand(1), cand(2)],
      existing: new Map([[id(1), V]]),
      status: { [id(2)]: { state: 'error', reason: 'too-long', attempts: 1, lastTried: hoursAgo(0) } },
    });
    expect(p.todo.map((w) => w.why)).toEqual(['forced', 'forced']);
    expect(p.done).toBe(0);
  });

  it('limit 0 processes nothing', () => {
    expect(planWork({ ...base, candidates: [cand(1)], existing: new Map(), status: {}, limit: 0 }).todo).toEqual([]);
  });
});

describe('preflightSkip', () => {
  it('skips live streams and songs over 15 minutes', () => {
    expect(preflightSkip({ ...cand(1), liveStatus: 'is_live' })?.reason).toBe('live');
    expect(preflightSkip({ ...cand(1), duration: 16 * 60 })?.reason).toBe('too-long');
    expect(preflightSkip({ ...cand(1), duration: 15 * 60 })).toBeNull();
    expect(preflightSkip({ ...cand(1), liveStatus: 'was_live', duration: 200 })).toBeNull();
    expect(preflightSkip(cand(1))).toBeNull();
  });
});
