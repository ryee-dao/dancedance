import { describe, expect, it, vi } from 'vitest';
import { BeatSession, type SessionClock } from '../beat/session';
import { BeatMapCache, memoryStore } from '../beat/cache';
import { mkMap } from '../beat/testMaps.testutil';
import type { LiveDevices } from '../live/devices';
import { HelperClient, HelperError, parseHealth, type LocalHelper } from './helper';

const HEALTH = { ok: true, app: 'dancedance-helper', version: '0.1.0', ytdlp: '2026.10.26', platform: 'macos-arm64', ready: true, state: 'ready' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('helper detection', () => {
  it('probes the ports in order and caches the result', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes(':47800/')) throw new TypeError('connection refused');
      return json(HEALTH);
    });
    let t = 0;
    const c = new HelperClient({ fetch, now: () => t });
    const info = await c.detect();
    expect(info?.port).toBe(47801);
    expect(calls).toEqual(['http://127.0.0.1:47800/health', 'http://127.0.0.1:47801/health']);
    await c.detect();
    expect(fetch).toHaveBeenCalledTimes(2); // cached
    t = 61_000;
    await c.detect();
    expect(calls[2]).toBe('http://127.0.0.1:47801/health'); // known port first on re-probe
  });

  it('ignores anything that is not the helper, and does not probe when not allowed', async () => {
    const other = new HelperClient({ fetch: async () => json({ ok: true, app: 'something-else', version: '1' }) });
    expect(await other.detect()).toBeNull();
    expect(parseHealth({ ok: true, app: 'dancedance-helper', version: 1 }, 1)).toBeNull();
    const fetch = vi.fn();
    const gated = new HelperClient({ fetch, canProbe: () => false });
    expect(await gated.detect()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('available() is null while the helper is still downloading its tools', async () => {
    const c = new HelperClient({ fetch: async () => json({ ...HEALTH, ready: false, state: 'preparing' }) });
    expect(await c.available()).toBeNull();
    expect(c.info()?.state).toBe('preparing');
  });
});

describe('helper fetchAudio', () => {
  it('returns the bytes and reports progress', async () => {
    const audio = new Uint8Array([1, 2, 3, 4]);
    const c = new HelperClient({
      pollMs: 5,
      fetch: async (url, init) => {
        if (url.endsWith('/health')) return json(HEALTH);
        if (url.endsWith('/status')) return json({ current: [{ videoId: '1j_XvebOg4c', fraction: 0.5 }] });
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ videoId: '1j_XvebOg4c' });
        await new Promise((r) => setTimeout(r, 30));
        return new Response(audio, { headers: { 'Content-Type': 'audio/mp4', 'Content-Length': '4' } });
      },
    });
    await c.detect();
    const seen: string[] = [];
    const buf = await c.fetchAudio('1j_XvebOg4c', { onProgress: (p) => seen.push(`${p.phase}:${p.fraction}`) });
    expect(new Uint8Array(buf)).toEqual(audio);
    expect(seen).toContain('download:0.5');
    expect(seen[seen.length - 1]).toBe('transfer:1');
  });

  it('maps helper error codes, and forgets a helper that went away', async () => {
    let mode: 'blocked' | 'gone' | 'weird' = 'blocked';
    const c = new HelperClient({
      fetch: async (url) => {
        if (url.endsWith('/health')) return json(HEALTH);
        if (url.endsWith('/status')) return json({ current: [] });
        if (mode === 'blocked') return json({ ok: false, code: 'blocked', message: 'bot check' }, 502);
        if (mode === 'weird') return json({ ok: false, code: 'rm -rf' }, 500);
        throw new TypeError('Failed to fetch');
      },
    });
    await c.detect();
    await expect(c.fetchAudio('1j_XvebOg4c')).rejects.toMatchObject({ code: 'blocked' });
    mode = 'weird';
    await expect(c.fetchAudio('1j_XvebOg4c')).rejects.toMatchObject({ code: 'error' });
    mode = 'gone';
    await expect(c.fetchAudio('1j_XvebOg4c')).rejects.toMatchObject({ code: 'unreachable' });
    expect(c.info()).toBeNull();
    await expect(c.fetchAudio('not-an-id')).rejects.toBeInstanceOf(HelperError);
  });
});

describe('BeatSession with the helper', () => {
  const clock: SessionClock = { time: () => 0, playing: () => false, duration: () => 0 };
  const devices = { currentTab: () => null, micSupported: false, tabSupported: false } as unknown as LiveDevices;
  const item = { kind: 'youtube' as const, videoId: 'xjiYBGs0TUA', title: 'x' };
  const base = 'http://127.0.0.1:9/'; // nothing listens: cloud lookups fail fast

  function fakeHelper(over: Partial<LocalHelper> = {}): LocalHelper & { fetchAudio: ReturnType<typeof vi.fn> } {
    return {
      info: () => null,
      available: async () => ({ port: 47800, version: 't', ytdlp: 'x', platform: 'p', ready: true, state: 'ready' }),
      fetchAudio: vi.fn(async () => {
        throw new HelperError('blocked');
      }),
      ...over,
    } as LocalHelper & { fetchAudio: ReturnType<typeof vi.fn> };
  }

  it('falls through to live listening without fuss when the helper fails', async () => {
    const helper = fakeHelper();
    const s = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, localHelper: helper }, new BeatMapCache(memoryStore()));
    expect(await s.prepare()).toBe('ready');
    expect(helper.fetchAudio).toHaveBeenCalledWith('xjiYBGs0TUA', expect.anything());
    expect(s.status()).toEqual({ kind: 'none', reason: 'unsupported' }); // the normal no-map path (liveSync off in this test)
  });

  it('does not ask the helper when a complete map is cached, or when it is not running', async () => {
    const cache = new BeatMapCache(memoryStore());
    await cache.offer('xjiYBGs0TUA', mkMap({ source: 'cloud' }));
    const helper = fakeHelper();
    const s = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, localHelper: helper }, cache);
    await s.prepare();
    expect(helper.fetchAudio).not.toHaveBeenCalled();
    expect(s.status()).toMatchObject({ kind: 'map', source: 'cloud' });

    const off = fakeHelper({ available: async () => null });
    const s2 = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, localHelper: off }, new BeatMapCache(memoryStore()));
    await s2.prepare();
    expect(off.fetchAudio).not.toHaveBeenCalled();
  });

  it('shows download progress while the helper gets the song', async () => {
    let finish!: () => void;
    const helper = fakeHelper({
      fetchAudio: vi.fn((_id: string, o?: { onProgress?: (p: { phase: 'download'; fraction: number }) => void }) => {
        o?.onProgress?.({ phase: 'download', fraction: 0.5 });
        return new Promise<ArrayBuffer>((_r, reject) => (finish = () => reject(new HelperError('network'))));
      }),
    });
    const s = new BeatSession(item, clock, devices, { beatmapBase: base, liveSync: false, localHelper: helper }, new BeatMapCache(memoryStore()));
    const p = s.prepare();
    await vi.waitFor(() => expect(s.status()).toMatchObject({ kind: 'analyzing', step: 'download' }));
    expect((s.status() as { progress: number }).progress).toBeCloseTo(0.475);
    finish();
    await p;
    expect(s.status().kind).toBe('none');
  });
});
