import { describe, expect, it } from 'vitest';
import type { Move } from './catalog';
import { MOVES } from './moves';
import { isReferenceMove, moveVigour, moveWeights, vigourAgainst, weightRef, weightsAgainst, type WeightRef } from './weights';

const DANCE = MOVES.filter((m) => !m.idle && !m.cooldown);
const GLOBAL = DANCE.filter((m) => !m.genre);

/** Every global move's weights and vigour against a reference. */
const snapshot = (r: WeightRef) => GLOBAL.map((m) => ({ id: m.id, w: weightsAgainst(m, r), v: vigourAgainst(m, r) }));

/** Synthetic moves cloned from real ones: the most vigorous / busiest ones, so they would shift any percentile they joined. */
function synthetic(n: number, genre: Move['genre']): Move[] {
  const loud = [...DANCE].sort((a, b) => moveVigour(b) - moveVigour(a) || b.keys.length / b.beats - a.keys.length / a.beats).slice(0, n);
  return loud.map((m, i) => {
    const { genre: _g, ...rest } = m;
    return { ...rest, id: `synthetic-${i}`, base: `synthetic-${i}`, ...(genre ? { genre } : {}) } as Move;
  });
}

describe('soft weights reference', () => {
  it('is the global dance moves only', () => {
    for (const m of MOVES) expect(isReferenceMove(m), m.id).toBe(!m.idle && !m.cooldown && !m.genre);
    // The cached catalogue weights are the ones against that reference.
    const r = weightRef(MOVES);
    for (const m of DANCE.slice(0, 200)) {
      expect(moveWeights(m), m.id).toEqual(weightsAgainst(m, r));
      expect(moveVigour(m), m.id).toBe(vigourAgainst(m, r));
    }
  });

  it('adding or removing genre-exclusive moves never changes a global move\'s weights', () => {
    const base = snapshot(weightRef(MOVES));
    // A batch of vigorous synthetic genre moves, then every genre move removed.
    expect(snapshot(weightRef([...MOVES, ...synthetic(150, 'metal')]))).toEqual(base);
    expect(snapshot(weightRef(MOVES.filter((m) => !m.genre)))).toEqual(base);
    // The same synthetic moves as GLOBAL moves do shift them (the check has teeth).
    const shifted = snapshot(weightRef([...MOVES, ...synthetic(150, undefined)]));
    expect(shifted.filter((x, i) => x.v !== base[i].v || x.w.difficulty !== base[i].w.difficulty).length).toBeGreaterThan(GLOBAL.length / 4);
  });

  it('one genre set never changes another set\'s weights', () => {
    const house = DANCE.filter((m) => m.genre === 'house');
    expect(house.length).toBeGreaterThan(0);
    const without = weightRef(MOVES.filter((m) => !m.genre || m.genre === 'house'));
    const withMore = weightRef([...MOVES, ...synthetic(150, 'edm')]);
    for (const m of house) {
      expect(weightsAgainst(m, withMore), m.id).toEqual(weightsAgainst(m, without));
      expect(vigourAgainst(m, withMore), m.id).toBe(vigourAgainst(m, without));
    }
  });
});
