import { describe, expect, it, vi } from 'vitest';
import type { BeatMap } from '../core/analysis';
import { BeatMapCache, memoryStore } from './cache';
import { resolveBeatMap } from './resolve';
import { mkMap } from './testMaps.testutil';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('resolveBeatMap', () => {
  it('uses the cache first, starts the cloud fetch in parallel, and upgrades to a better cloud map', async () => {
    const cache = new BeatMapCache(memoryStore());
    await cache.offer('v1', mkMap({ source: 'mic', partial: true, until: 60 }));
    const cloud = deferred<BeatMap | null>();
    const fetchCloud = vi.fn(() => cloud.promise);
    const seen: string[] = [];
    const p = resolveBeatMap('v1', 'v1', { cache, fetchCloud }, (m, origin) => seen.push(`${origin}:${m.source}`));
    expect(fetchCloud).toHaveBeenCalledWith('v1'); // started before the cache answered
    await vi.waitFor(() => expect(seen).toEqual(['cache:mic']));
    cloud.resolve(mkMap({ source: 'cloud' }));
    const best = await p;
    expect(best?.source).toBe('cloud');
    expect(seen).toEqual(['cache:mic', 'cloud:cloud']);
    await vi.waitFor(async () => expect((await cache.get('v1'))?.source).toBe('cloud')); // cloud map cached
  });
  it('falls through to the cloud when nothing is cached', async () => {
    const cache = new BeatMapCache(memoryStore());
    const seen: string[] = [];
    const best = await resolveBeatMap('v2', 'v2', { cache, fetchCloud: async () => mkMap({ source: 'cloud' }) }, (_m, o) => seen.push(o));
    expect(best?.source).toBe('cloud');
    expect(seen).toEqual(['cloud']);
  });
  it('resolves null (live fallback) on a 404 / network error', async () => {
    const cache = new BeatMapCache(memoryStore());
    expect(await resolveBeatMap('v3', 'v3', { cache, fetchCloud: async () => null })).toBeNull();
    expect(await resolveBeatMap('v3', 'v3', { cache, fetchCloud: () => Promise.reject(new Error('offline')) })).toBeNull();
  });
  it('keeps a complete cached map over a worse cloud result and does not re-announce an identical one', async () => {
    const cache = new BeatMapCache(memoryStore());
    const cloudMap = mkMap({ source: 'cloud' });
    await cache.offer('v4', cloudMap);
    const seen: string[] = [];
    const best = await resolveBeatMap('v4', 'v4', { cache, fetchCloud: async () => ({ ...cloudMap }) }, (_m, o) => seen.push(o));
    expect(best?.source).toBe('cloud');
    expect(seen).toEqual(['cache']);
    const c2 = new BeatMapCache(memoryStore());
    await c2.offer('v5', mkMap({ source: 'file' }));
    const r = await resolveBeatMap('v5', 'v5', { cache: c2, fetchCloud: async () => mkMap({ source: 'cloud', partial: true, until: 30 }) });
    expect(r?.source).toBe('file');
  });
  it('does not fetch for items without a video ID (dropped files)', async () => {
    const fetchCloud = vi.fn(async () => null);
    await resolveBeatMap('file:x:1:2', null, { cache: new BeatMapCache(memoryStore()), fetchCloud });
    expect(fetchCloud).not.toHaveBeenCalled();
  });
});
