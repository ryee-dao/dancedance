import { describe, expect, it } from 'vitest';
import { BeatMapCache, fileKey, idbStore, isBetterMap, memoryStore, type KVStore } from './cache';
import { mkMap } from './testMaps.testutil';

describe('isBetterMap (cache replacement policy)', () => {
  it('anything beats nothing', () => {
    expect(isBetterMap(null, mkMap({ source: 'mic', partial: true }))).toBe(true);
  });
  it('better sources win among complete maps: cloud > device > file > tab > mic', () => {
    const order = ['mic', 'tab', 'file', 'device', 'cloud'] as const;
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j < order.length; j++) {
        const existing = mkMap({ source: order[i] });
        const incoming = mkMap({ source: order[j] });
        expect(isBetterMap(existing, incoming), `${order[j]} over ${order[i]}`).toBe(j >= i);
      }
    }
  });
  it('complete beats partial regardless of source', () => {
    expect(isBetterMap(mkMap({ source: 'cloud', partial: true, until: 30 }), mkMap({ source: 'mic' }))).toBe(true);
    expect(isBetterMap(mkMap({ source: 'mic' }), mkMap({ source: 'cloud', partial: true, until: 30 }))).toBe(false);
  });
  it('a shorter partial never replaces a longer partial', () => {
    const long = mkMap({ source: 'mic', partial: true, until: 120 });
    const short = mkMap({ source: 'mic', partial: true, until: 50 });
    expect(isBetterMap(long, short)).toBe(false);
    expect(isBetterMap(short, long)).toBe(true);
  });
});

describe('BeatMapCache', () => {
  it('stores, reads back, and keeps the better map', async () => {
    const stored: string[] = [];
    const c = new BeatMapCache(memoryStore(), (k) => stored.push(k));
    expect(await c.get('a')).toBeNull();
    expect(await c.offer('a', mkMap({ source: 'mic', partial: true, until: 60 }))).toBe(true);
    expect((await c.get('a'))?.source).toBe('mic');
    expect(await c.offer('a', mkMap({ source: 'file' }))).toBe(true);
    expect(await c.offer('a', mkMap({ source: 'tab' }))).toBe(false); // worse than file
    expect((await c.get('a'))?.source).toBe('file');
    expect(await c.offer('a', mkMap({ source: 'cloud' }))).toBe(true);
    expect((await c.get('a'))?.source).toBe('cloud');
    expect(stored).toEqual(['a', 'a', 'a']);
  });
  it('treats corrupt entries as missing and refuses invalid maps', async () => {
    const m = memoryStore();
    await m.set('bad', { json: '{"v":1' });
    await m.set('weird', 42);
    const c = new BeatMapCache(m);
    expect(await c.get('bad')).toBeNull();
    expect(await c.get('weird')).toBeNull();
    const invalid = { ...mkMap(), beats: [2, 1] };
    expect(await c.offer('x', invalid)).toBe(false);
    expect(await c.offer('bad', mkMap())).toBe(true); // corrupt entry gets overwritten
  });
  it('never rejects when the store fails', async () => {
    const broken: KVStore = {
      get: () => Promise.reject(new Error('boom')),
      set: () => Promise.reject(new Error('boom')),
    };
    const c = new BeatMapCache(broken);
    await expect(c.get('a')).resolves.toBeNull();
    await expect(c.offer('a', mkMap())).resolves.toBe(false);
  });
  it('idbStore falls back to memory without IndexedDB (e.g. Node, blocked site data)', async () => {
    const s = idbStore('test-db');
    await s.set('k', { json: 'x' });
    expect(await s.get('k')).toEqual({ json: 'x' });
    const c = new BeatMapCache(idbStore('test-db-2'));
    expect(await c.offer('v', mkMap())).toBe(true);
    expect((await c.get('v'))?.beats.length).toBeGreaterThan(10);
  });
  it('fileKey uses name, size and lastModified', () => {
    expect(fileKey({ name: 'a.mp3', size: 10, lastModified: 5 })).toBe('file:a.mp3:10:5');
    expect(fileKey({ name: 'a.mp3', size: 10, lastModified: 6 })).not.toBe(fileKey({ name: 'a.mp3', size: 10, lastModified: 5 }));
  });
});
