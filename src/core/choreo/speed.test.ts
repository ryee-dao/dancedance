import { describe, expect, it } from 'vitest';
import { partOf } from './cards';
import { MOVES, getMove } from './moves';
import { getPool } from './pool';
import { LEVEL_SPEED, MAX_AIR_SEC, MAX_LIMIT_BPM, moveSpeed, moveTempoMode, readsAtHalf, speedLimit } from './speed';
import { readTraits, traitsOf } from './songTraits';

const DANCE = MOVES.filter((m) => !m.idle && !m.cooldown);

describe('speed limits (from the keyframes)', () => {
  it('every move and variation has a finite limit in range', () => {
    for (const m of [...MOVES, ...getPool().variations]) {
      const s = moveSpeed(m);
      expect(s.limit >= 30 && s.limit <= MAX_LIMIT_BPM, m.id).toBe(true);
      expect(s.air >= 0, m.id).toBe(true);
      if (!m.jump) expect(s.air, m.id).toBe(0);
    }
  });

  it('simple on-the-beat moves stay full time on fast songs; leg raises, kicks and big jumps do not', () => {
    for (const id of ['step-touch', 'march', 'headbang', 'fist-pump', 'hip-sway']) expect(speedLimit(getMove(id)), id).toBeGreaterThanOrEqual(180);
    for (const id of ['kickline', 'can-can-kick', 'kick-ball-change', 'tuck-jump', 'pogo']) expect(speedLimit(getMove(id)), id).toBeLessThan(150);
    // Single-leg raises sit between: fine at 140, not at 180.
    const knee = speedLimit(getMove('knee-lift'));
    expect(knee).toBeGreaterThan(140);
    expect(knee).toBeLessThan(180);
    // Most of the catalogue can be danced at full time up to ~130 BPM (as authored: copyable at 100-140).
    const at130 = DANCE.filter((m) => speedLimit(m) >= 130).length / DANCE.length;
    expect(at130).toBeGreaterThan(0.75);
  });

  it('a part of a move shares its whole move\'s limit', () => {
    const m = getMove('kickline');
    expect(speedLimit(partOf(m, 0, 1))).toBe(speedLimit(m));
  });

  it('modes: full within the limit, half above it, out when even half time is too fast or a jump would float', () => {
    const m = getMove('can-can-kick');
    const lim = speedLimit(m);
    expect(moveTempoMode(m, lim - 1)).toBe('full');
    expect(moveTempoMode(m, lim + 1)).toBe('half');
    expect(moveTempoMode(m, 2 * lim + 1)).toBe('out');
    // Easy keeps further from the limit.
    expect(moveTempoMode(m, lim * LEVEL_SPEED.chill + 1, 'chill')).toBe('half');
    expect(moveTempoMode(m, undefined)).toBe('full');
    // A jump over its limit is slowed only while its time in the air stays short.
    const pogo = getMove('pogo');
    const air = moveSpeed(pogo).air;
    const floatBpm = (air * 60) / MAX_AIR_SEC; // at half time below this, the air time is too long
    expect(readsAtHalf(pogo, floatBpm + 1)).toBe(true);
    expect(readsAtHalf(pogo, floatBpm - 1)).toBe(false);
    if (speedLimit(pogo) < floatBpm - 1) expect(moveTempoMode(pogo, floatBpm - 1)).toBe('out');
  });
});

describe('song traits (beat map)', () => {
  it('are read defensively: numbers only, clamped to 0..1, absent when nothing is usable', () => {
    expect(readTraits({ calm: 0.9, heavy: 1.4, drive: -1, hats: 'x', bass: NaN, swing: Infinity })).toEqual({ calm: 0.9, heavy: 1, drive: 0 });
    expect(readTraits({})).toBeUndefined();
    expect(readTraits(null)).toBeUndefined();
    expect(readTraits('calm')).toBeUndefined();
    expect(traitsOf({ bpm: 120 })).toBeUndefined();
    expect(traitsOf({ traits: { fourFloor: 0.8 } })).toEqual({ fourFloor: 0.8 });
    expect(traitsOf(undefined)).toBeUndefined();
  });
});
