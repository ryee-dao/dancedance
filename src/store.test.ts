import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fresh store module over a fake localStorage holding `initial`. */
async function freshStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
    addEventListener: () => {},
  });
  vi.resetModules();
  const mod = await import('./store');
  return { ...mod, data };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings.routineMode', () => {
  it("defaults to 'same' and keeps valid values", async () => {
    const { store } = await freshStore();
    expect(store.settings().routineMode).toBe('same');
    expect(store.updateSettings({ routineMode: 'fresh' }).routineMode).toBe('fresh');
    expect(store.settings().routineMode).toBe('fresh');
  });

  it('drops bad stored values without touching the other settings', async () => {
    const { store } = await freshStore({ 'dd.settings': JSON.stringify({ routineMode: 'random', intensity: 'sweaty' }) });
    expect(store.settings()).toMatchObject({ routineMode: 'same', intensity: 'sweaty' });
  });
});

describe('settings.coachBuild', () => {
  it("defaults to 'female' (today's figures), keeps a choice and persists it", async () => {
    const { store, data } = await freshStore();
    expect(store.settings().coachBuild).toBe('female');
    expect(store.updateSettings({ coachBuild: 'male' }).coachBuild).toBe('male');
    expect(JSON.parse(data.get('dd.settings') ?? '{}').coachBuild).toBe('male');
    const again = await freshStore(Object.fromEntries(data));
    expect(again.store.settings().coachBuild).toBe('male');
  });

  it('drops bad stored values without touching the other settings', async () => {
    const { store } = await freshStore({ 'dd.settings': JSON.stringify({ coachBuild: 'robot', coachStyle: 'human' }) });
    expect(store.settings()).toMatchObject({ coachBuild: 'female', coachStyle: 'human' });
  });
});

describe('play counts', () => {
  it('start at 0, count up, and persist', async () => {
    const { store, data } = await freshStore();
    expect(store.playCount('aaaaaaaaaaa')).toBe(0);
    store.bumpPlayCount('aaaaaaaaaaa');
    store.bumpPlayCount('aaaaaaaaaaa');
    store.bumpPlayCount('bbbbbbbbbbb');
    expect(store.playCount('aaaaaaaaaaa')).toBe(2);
    expect(store.playCount('bbbbbbbbbbb')).toBe(1);
    expect(JSON.parse(data.get('dd.plays')!)).toEqual({ aaaaaaaaaaa: 2, bbbbbbbbbbb: 1 });
    const again = await freshStore(Object.fromEntries(data));
    expect(again.store.playCount('aaaaaaaaaaa')).toBe(2);
  });

  it('sanitise what is stored', async () => {
    const { sanitizePlayCounts } = await freshStore();
    expect(sanitizePlayCounts({ a: 3, b: 2.7, c: -1, d: 'x', e: NaN, f: Infinity, g: 0, '': 4, h: 5e9 })).toEqual({ a: 3, b: 2, h: 1_000_000 });
    expect(sanitizePlayCounts([1, 2])).toEqual({});
    expect(sanitizePlayCounts(null)).toEqual({});
    const { store } = await freshStore({ 'dd.plays': '{"a": "lots", "b": 4}' });
    expect(store.playCount('a')).toBe(0);
    expect(store.playCount('b')).toBe(4);
    const broken = await freshStore({ 'dd.plays': 'not json' });
    expect(broken.store.playCount('b')).toBe(0);
  });

  it('keep at most MAX_PLAY_COUNTS songs, dropping the least recently played', async () => {
    const { MAX_PLAY_COUNTS } = await freshStore();
    const many = Object.fromEntries(Array.from({ length: MAX_PLAY_COUNTS }, (_, i) => [`v${i}`, 1]));
    const { store, data } = await freshStore({ 'dd.plays': JSON.stringify(many) });
    store.bumpPlayCount('v0'); // v0 becomes the most recent
    store.bumpPlayCount('new'); // pushes out v1, the oldest
    const saved = JSON.parse(data.get('dd.plays')!) as Record<string, number>;
    expect(Object.keys(saved).length).toBe(MAX_PLAY_COUNTS);
    expect(saved.v0).toBe(2);
    expect(saved.new).toBe(1);
    expect('v1' in saved).toBe(false);
    expect(store.playCount('v1')).toBe(0);
  });
});
