/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse, type BeatMap } from '../core/analysis';
import { store } from '../store';
import { commonMapGate, flushMapUploads, shareRelay, MAX_QUEUE, MAX_TRIES, queuedMapUploads, queueMapUpload, SHARE_QUEUE_KEY, SHARED_TOAST, tabCoverageGate } from './shareMap';

const REAL = parse(readFileSync(join(__dirname, '../../public/beatmaps/fw-QRyQcFH8.json'), 'utf8'));
const tab = (o: Partial<BeatMap> = {}): BeatMap => ({ ...REAL, source: 'tab', ...o });
const D = REAL.duration;
const full = { duration: D, covered: D - 1, locked: D - 12, stoppedAt: D };

// A localStorage for the node test environment.
const mem = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
};

function relay(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
  };
  return Object.assign(fn, { calls });
}

beforeEach(() => {
  mem.clear();
  store.setAddRelay('https://relay.example.workers.dev');
  store.setAddPassphrase(null);
});

describe('tab coverage gate', () => {
  it('passes a whole song heard via tab audio with the tracker locked most of the time', () => {
    expect(tabCoverageGate(tab(), full)).toBeNull();
  });
  it.each<[string, Partial<BeatMap>, Partial<typeof full>, string]>([
    ['a mic map', { source: 'mic' }, {}, 'not-tab'],
    ['a partial map', { partial: true }, {}, 'partial'],
    ['stopped well before the end', {}, { stoppedAt: D - 30 }, 'not-to-the-end'],
    ['under 85% of the song captured', {}, { covered: 0.8 * D, locked: 0.8 * D }, 'coverage'],
    ['locked for under 75% of it', {}, { locked: 0.6 * D }, 'not-locked'],
    ['unknown duration', {}, { duration: 0 }, 'duration'],
  ])('rejects %s', (_, m, c, why) => {
    expect(tabCoverageGate(tab(m), { ...full, ...c })).toBe(why);
  });
});

describe('common gate', () => {
  it('accepts tab and device maps that pass the relay/job rules; rejects mic and broken ones', () => {
    expect(commonMapGate(tab())).toBeNull();
    expect(commonMapGate(tab({ source: 'device' }))).toBeNull();
    expect(commonMapGate(tab({ source: 'mic' }))).toBe('mic');
    expect(commonMapGate(tab({ bpm: REAL.bpm * 1.3 }))).toBe('beat-count');
    expect(commonMapGate(tab({ videoId: 'nope' }))).toBe('video-id');
  });
});

describe('upload queue', () => {
  it('queues, sends to POST /map with the passphrase, removes it and says one calm line', async () => {
    store.setAddPassphrase('disco');
    expect(queueMapUpload(tab(), { send: false })).toBe('queued');
    expect(queuedMapUploads()).toEqual([{ videoId: REAL.videoId, source: 'tab', tries: 0 }]);
    const f = relay(200, { ok: true, videoId: REAL.videoId });
    const said: string[] = [];
    await flushMapUploads({ fetchFn: f, notify: (m) => said.push(m) });
    expect(f.calls[0].url).toBe(`${shareRelay()}/map`);
    expect((f.calls[0].init.headers as Record<string, string>)['X-Add-Passphrase']).toBe('disco');
    expect(JSON.parse(f.calls[0].init.body as string)).toEqual(tab());
    expect(said).toEqual([SHARED_TOAST]);
    expect(queuedMapUploads()).toEqual([]);
    expect(mem.has(SHARE_QUEUE_KEY)).toBe(false);
  });

  it('never queues mic maps, maps for songs with an equal or better cloud map, or without a relay', () => {
    expect(queueMapUpload(tab({ source: 'mic' }), { send: false })).toBe('skipped:source');
    expect(queueMapUpload(tab(), { existingSource: 'cloud', send: false })).toBe('skipped:has-map');
    expect(queueMapUpload(tab(), { existingSource: 'tab', send: false })).toBe('skipped:has-map');
    expect(queueMapUpload(tab({ source: 'device' }), { existingSource: 'tab', send: false })).toBe('queued');
    mem.clear();
    store.setAddRelay(null);
    if (!import.meta.env.VITE_ADD_SONG_URL) {
      expect(queueMapUpload(tab(), { send: false })).toBe('skipped:no-relay');
      expect(queuedMapUploads()).toEqual([]);
    }
  });

  it('keeps a map for the next app open when offline, gives up after MAX_TRIES, drops rejected maps', async () => {
    queueMapUpload(tab(), { send: false });
    for (let i = 1; i < MAX_TRIES; i++) {
      await flushMapUploads({ fetchFn: async () => Promise.reject(new TypeError('offline')), notify: () => {} });
      expect(queuedMapUploads()[0].tries).toBe(i);
    }
    await flushMapUploads({ fetchFn: async () => Promise.reject(new TypeError('offline')), notify: () => {} });
    expect(queuedMapUploads()).toEqual([]);
    queueMapUpload(tab(), { send: false });
    await flushMapUploads({ fetchFn: relay(400, { ok: false, error: 'bad-map', detail: 'beat-count' }), notify: () => {} });
    expect(queuedMapUploads()).toEqual([]);
  });

  it('stays small: one entry per song (a device map wins over a tab map), at most MAX_QUEUE', () => {
    queueMapUpload(tab(), { send: false });
    queueMapUpload(tab({ source: 'device' }), { send: false });
    expect(queuedMapUploads()).toEqual([{ videoId: REAL.videoId, source: 'device', tries: 0 }]);
    expect(queueMapUpload(tab(), { send: false })).toBe('skipped:queued-better');
    for (const id of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']) queueMapUpload(tab({ videoId: id }), { send: false });
    expect(queuedMapUploads().map((q) => q.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(queuedMapUploads()).toHaveLength(MAX_QUEUE);
    expect((mem.get(SHARE_QUEUE_KEY) ?? '').length).toBeLessThan(MAX_QUEUE * 16_000);
  });
});
