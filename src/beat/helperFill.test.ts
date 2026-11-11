import { describe, expect, it, vi } from 'vitest';
import { HelperError, type LocalHelper } from '../platform/helper';
import { describeFill, HelperFill, type FillDeps } from './helperFill';
import { mkMap } from './testMaps.testutil';

function deps(over: Partial<FillDeps> & { fetch?: LocalHelper['fetchAudio'] } = {}) {
  const saved: string[] = [];
  const helper: LocalHelper = {
    info: () => null,
    available: async () => ({ port: 47800, version: 't', ytdlp: 'x', platform: 'p', ready: true, state: 'ready' }),
    fetchAudio: over.fetch ?? (async () => new ArrayBuffer(8)),
  };
  const d: FillDeps = {
    helper,
    candidates: () => ['playlist0001', 'cloudmapped', 'cachedfull1', 'starter0001'],
    cloudIds: async () => new Set(['cloudmapped']),
    hasFullMap: async (id) => id === 'cachedfull1',
    analyze: (_b, id) => ({ promise: Promise.resolve(mkMap({ source: 'device', videoId: id })), cancel: () => {} }),
    save: (m) => saved.push(m.videoId),
    ...over,
  };
  return { d, saved };
}

describe('background fill', () => {
  it('maps songs without a cloud or cached map, in order, one per step', async () => {
    const { d, saved } = deps();
    const f = new HelperFill(d);
    await f.step();
    expect(saved).toEqual(['playlist0001']);
    expect(f.state()).toMatchObject({ done: 1, remaining: 1 });
    await f.step();
    expect(saved).toEqual(['playlist0001', 'starter0001']);
    await f.step();
    expect(f.state().remaining).toBe(0);
    expect(describeFill(f.state())).toMatch(/Every song has a beat map/);
  });

  it('does nothing while a song is playing, and abandons the song in progress', async () => {
    let release!: () => void;
    let signal: AbortSignal | undefined;
    const { d, saved } = deps({
      fetch: (_id, o) => {
        signal = o?.signal;
        return new Promise((_r, reject) => o?.signal?.addEventListener('abort', () => reject(new HelperError('aborted'))));
      },
    });
    const f = new HelperFill(d);
    const p = f.step();
    await vi.waitFor(() => expect(f.state().current).toBe('playlist0001'));
    release = f.hold();
    await p;
    expect(signal?.aborted).toBe(true);
    expect(saved).toEqual([]);
    expect(f.state()).toMatchObject({ paused: true, current: null });
    const spy = vi.spyOn(d.helper, 'available');
    await f.step();
    expect(spy).not.toHaveBeenCalled(); // paused
    release();
    expect(f.state().paused).toBe(false);
  });

  it('stops on blocked or outdated, skips unavailable videos, stops after repeated errors', async () => {
    const blocked = new HelperFill(deps({ fetch: async () => { throw new HelperError('blocked'); } }).d);
    await blocked.step();
    expect(blocked.state().stopped).toBe('blocked');
    const unavailable = new HelperFill(deps({ fetch: async () => { throw new HelperError('unavailable'); } }).d);
    await unavailable.step();
    await unavailable.step();
    expect(unavailable.state().stopped).toBeNull();
    const many = deps({ fetch: async () => { throw new HelperError('network'); }, candidates: () => ['a0000000001', 'a0000000002', 'a0000000003', 'a0000000004'] });
    const errors = new HelperFill(many.d);
    for (let i = 0; i < 4; i++) await errors.step();
    expect(errors.state().stopped).toBe('errors');
  });

  it('respects the per-open cap and does nothing when the helper is not running', async () => {
    const { d, saved } = deps({ maxPerOpen: 1 });
    const f = new HelperFill(d);
    await f.step();
    await f.step();
    expect(saved.length).toBe(1);
    expect(f.state().stopped).toBe('limit');
    const off = deps({ fetch: vi.fn() });
    off.d.helper.available = async () => null;
    await new HelperFill(off.d).step();
    expect(off.saved).toEqual([]);
  });
});
