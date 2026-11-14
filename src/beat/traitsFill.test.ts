import { describe, expect, it, vi } from 'vitest';
import type { BeatMap, SongTraits } from '../core/analysis';
import type { LiveDevices } from '../live/devices';
import type { DecodedAudio } from './analyzeAudio';
import { BeatMapCache, memoryStore } from './cache';
import { BeatSession, type SessionClock } from './session';
import { mkMap } from './testMaps.testutil';
import { fillTraits, gridOf, inlineTraitsRunner, needsTraits, type TraitsRunner } from './traitsFill';

const TRAITS: SongTraits = { calm: 0.9, drive: 0.1, fourFloor: 0, halfFeel: 0, bass: 0.2, hats: 0, swing: 0, syncop: 0, heavy: 0, minor: 0.6 };
const audio: DecodedAudio = { pcm: new Float32Array(1000), sampleRate: 22050, duration: 180 };
const decode = async () => audio;

/** Fake trait job finishing after `ms` (real timers). */
function fakeRunner(ms = 5, traits: SongTraits = TRAITS): TraitsRunner & { calls: number } {
  const r = Object.assign(
    (() => {
      r.calls++;
      return { promise: new Promise<SongTraits>((resolve) => setTimeout(() => resolve(traits), ms)), cancel() {} };
    }) as TraitsRunner,
    { calls: 0 },
  );
  return r;
}

describe('needsTraits / fillTraits', () => {
  it('only complete maps without traits need them', () => {
    expect(needsTraits(mkMap())).toBe(true);
    expect(needsTraits(mkMap({ partial: true, until: 30 }))).toBe(false);
    expect(needsTraits({ ...mkMap(), traits: TRAITS })).toBe(false);
    expect(needsTraits(null)).toBe(false);
  });

  it('computes on the map grid and returns the map with traits', async () => {
    const map = mkMap();
    let grid: unknown;
    const runner: TraitsRunner = (_a, g) => {
      grid = g;
      return { promise: Promise.resolve(TRAITS), cancel() {} };
    };
    const f = fillTraits(map, { getAudio: async () => new ArrayBuffer(4), decode, runner });
    expect(await f.ready).toEqual({ ...map, traits: TRAITS });
    expect(await f.done).toEqual({ ...map, traits: TRAITS });
    expect(grid).toEqual(gridOf(map));
  });

  it('gives up waiting after waitMs but still delivers the result for caching', async () => {
    const f = fillTraits(mkMap(), { getAudio: async () => new ArrayBuffer(4), decode, runner: fakeRunner(80), waitMs: 10 });
    expect(await f.ready).toBeNull();
    expect((await f.done)?.traits).toEqual(TRAITS);
  });

  it('never rejects: audio, decoding or analysis failures resolve null', async () => {
    const bad = fillTraits(mkMap(), { getAudio: () => Promise.reject(new Error('HTTP 404')), decode, runner: fakeRunner() });
    expect(await bad.ready).toBeNull();
    expect(await bad.done).toBeNull();
    const undecodable = fillTraits(mkMap(), { getAudio: async () => new ArrayBuffer(4), decode: () => Promise.reject(new Error('EncodingError')), runner: fakeRunner() });
    expect(await undecodable.done).toBeNull();
  });

  it('the main-thread runner computes real traits', async () => {
    const t = await inlineTraitsRunner({ pcm: new Float32Array(22050 * 3), sampleRate: 22050, duration: 3 }, { beats: [], downbeats: [], bpm: 0 }).promise;
    expect(Object.keys(t)).toHaveLength(10);
  });
});

describe('cache keeps traits filled in on this device', () => {
  it('when the same analysis is offered again without them', async () => {
    const cache = new BeatMapCache(memoryStore());
    const map = mkMap({ source: 'cloud' });
    await cache.offer('k', { ...map, traits: TRAITS });
    expect(await cache.offer('k', map)).toBe(true);
    expect((await cache.get('k'))?.traits).toEqual(TRAITS);
    // A different analysis replaces the map, traits and all.
    const other = mkMap({ source: 'cloud', bpm: 100 });
    await cache.offer('k', other);
    expect((await cache.get('k'))?.traits).toBeUndefined();
  });
});

describe('BeatSession fills in traits where it has the audio', () => {
  const clock: SessionClock = { time: () => 0, playing: () => false, duration: () => 0 };
  const devices = { currentTab: () => null, micSupported: false, tabSupported: false } as unknown as LiveDevices;
  const base = 'http://127.0.0.1:9/'; // nothing listens: cloud lookups fail fast
  const ID = 'xjiYBGs0TUA';
  const item = { kind: 'youtube' as const, videoId: ID, title: 'x' };

  async function cached(map: BeatMap): Promise<BeatMapCache> {
    const cache = new BeatMapCache(memoryStore());
    await cache.offer(ID, map);
    return cache;
  }

  it('TV: a cached map without traits gets them from the downloaded audio before the song starts, and keeps them', async () => {
    const map = mkMap({ source: 'cloud', videoId: ID });
    const cache = await cached(map);
    const deviceAudio = vi.fn(async () => new ArrayBuffer(8));
    const runner = fakeRunner();
    const s = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, deviceAudio }, cache, { decode, runner });
    expect(await s.prepare()).toBe('ready');
    expect(deviceAudio).toHaveBeenCalledWith(ID);
    expect(s.map()?.traits).toEqual(TRAITS);
    expect(s.map()?.beats).toEqual(map.beats);
    await vi.waitFor(async () => expect((await cache.get(ID))?.traits).toEqual(TRAITS));

    // Next time: nothing to do.
    const again = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, deviceAudio }, cache, { decode, runner });
    await again.prepare();
    expect(deviceAudio).toHaveBeenCalledTimes(1);
    expect(runner.calls).toBe(1);
    expect(again.map()?.traits).toEqual(TRAITS);
  });

  it('TV: traits that take too long are cached for next time, not swapped into the playing song', async () => {
    const cache = await cached(mkMap({ source: 'cloud', videoId: ID }));
    const s = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, deviceAudio: async () => new ArrayBuffer(8) }, cache, {
      decode,
      runner: fakeRunner(80),
      waitMs: 10,
    });
    await s.prepare();
    const playing = s.map();
    expect(playing?.traits).toBeUndefined();
    await vi.waitFor(async () => expect((await cache.get(ID))?.traits).toEqual(TRAITS));
    expect(s.map()).toBe(playing);
  });

  it('TV: a failed fill-in leaves the map as it was', async () => {
    const cache = await cached(mkMap({ source: 'cloud', videoId: ID }));
    const s = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, deviceAudio: () => Promise.reject(new Error('HTTP 500')) }, cache, { decode, runner: fakeRunner() });
    expect(await s.prepare()).toBe('ready');
    expect(s.map()?.traits).toBeUndefined();
    expect(s.status()).toMatchObject({ kind: 'map', source: 'cloud' });
  });

  it('web YouTube (no decoded audio): the map is used as it is', async () => {
    const cache = await cached(mkMap({ source: 'cloud', videoId: ID }));
    const runner = fakeRunner();
    const s = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false }, cache, { decode, runner });
    await s.prepare();
    expect(runner.calls).toBe(0);
    expect(s.map()?.traits).toBeUndefined();
  });

  it('dropped file: a cached map without traits gets them from the file', async () => {
    const file = new File([new Uint8Array(16)], 'song.mp3', { lastModified: 1 });
    const fileItem = { kind: 'file' as const, file, title: 'song' };
    const probe = new BeatSession(fileItem, clock, devices, { beatmapBase: base, liveSync: false }, new BeatMapCache(memoryStore()));
    const cache = new BeatMapCache(memoryStore());
    await cache.offer(probe.key, mkMap({ source: 'file', videoId: probe.key }));
    const s = new BeatSession(fileItem, clock, devices, { beatmapBase: base, liveSync: false }, cache, { decode, runner: fakeRunner() });
    await s.prepare();
    expect(s.map()?.traits).toEqual(TRAITS);
    await vi.waitFor(async () => expect((await cache.get(probe.key))?.traits).toEqual(TRAITS));
  });
});
