import { describe, expect, it, vi } from 'vitest';
import { songMap } from './testutil';

/**
 * The home screen fills the generator's caches ahead of time, a slice at a
 * time (warmGenerator / warmPool). That must only change WHEN the work is
 * done, never what a routine is.
 */

type Gen = typeof import('./generator');
type Pool = typeof import('./pool');

async function fresh(): Promise<{ gen: Gen; pool: Pool }> {
  vi.resetModules();
  const pool = await import('./pool');
  const gen = await import('./generator');
  return { gen, pool };
}

const sig = (r: ReturnType<Gen['generateRoutine']>) =>
  r.instances.map((i) => `${i.move.id}:${i.move.name}${i.mirror ? 'L' : 'R'}@${i.start}+${i.span}`).join(' ');

const poolSig = (p: ReturnType<Pool['getPool']>) =>
  [
    p.skipped,
    p.variations.length,
    p.moves.map((m) => `${m.id}|${m.keys.map((k) => `${k.at}:${Array.from(k.pose, (v) => v.toFixed(4)).join(',')}`).join(';')}`).join('\n'),
    p.ornaments.count,
  ].join('#');

describe('warming the generator ahead of time', () => {
  it('a pool built in small slices is the same as one built at once', { timeout: 120_000 }, async () => {
    const a = await fresh();
    const whole = poolSig(a.pool.getPool());

    const b = await fresh();
    let calls = 0;
    while (!b.pool.warmPool(0)) calls++;
    expect(calls).toBeGreaterThan(10);
    expect(poolSig(b.pool.getPool())).toBe(whole);

    // getPool() part-way through a sliced build finishes it the same way.
    const c = await fresh();
    for (let i = 0; i < 5; i++) c.pool.warmPool(0);
    expect(poolSig(c.pool.getPool())).toBe(whole);
  });

  it('routines are identical with or without warming first', { timeout: 120_000 }, async () => {
    const maps = [songMap(124, 'warm-a'), songMap(92, 'warm-b'), songMap(150, 'warm-c')];
    const levels = ['chill', 'cardio', 'sweaty'] as const;

    const cold = await fresh();
    const want = maps.flatMap((m) => levels.map((l) => sig(cold.gen.generateRoutine(m, l))));

    const warm = await fresh();
    let slices = 0;
    while (!warm.gen.warmGenerator(1)) slices++;
    expect(slices).toBeGreaterThan(1);
    const got = maps.flatMap((m) => levels.map((l) => sig(warm.gen.generateRoutine(m, l))));
    expect(got).toEqual(want);
  });

  it('isUsableBeatMap re-checks a map whose beats changed', async () => {
    const { gen } = await fresh();
    const map = songMap(124, 'warm-d');
    expect(gen.isUsableBeatMap(map)).toBe(true);
    expect(gen.isUsableBeatMap(map)).toBe(true);
    map.beats.push(map.beats[map.beats.length - 1] - 1); // not increasing
    expect(gen.isUsableBeatMap(map)).toBe(false);
    map.beats = map.beats.slice(0, -1);
    expect(gen.isUsableBeatMap(map)).toBe(true);
    map.bpm = 1000;
    expect(gen.isUsableBeatMap(map)).toBe(false);
  });
});
