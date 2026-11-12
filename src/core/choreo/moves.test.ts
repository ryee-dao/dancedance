import { describe, expect, it } from 'vitest';
import { FAMILIES, FOCI } from './families';
import { CATALOGUE_ERRORS, MOVES, type Move } from './moves';
import { checkKeys, checkPlayback } from './validate';
import { PoseEvaluator } from '../coach/animator';
import { loopPlan } from '../coach/loop';
import { J, createPose, createSkeleton, solveSkeleton } from '../coach/skeleton';

describe('move catalogue', () => {
  it('builds every family file without definition errors', () => {
    expect(CATALOGUE_ERRORS).toEqual([]);
  });

  it('has a curated catalogue of distinct, tagged entries', () => {
    expect(MOVES.length).toBeGreaterThanOrEqual(140);
    const ids = new Set(MOVES.map((m) => m.id));
    const names = new Set(MOVES.map((m) => m.name));
    expect(ids.size).toBe(MOVES.length);
    expect(names.size).toBe(MOVES.length);
    // Layered entries are unique combinations.
    const combos = new Set(MOVES.filter((m) => m.layered).map((m) => `${m.foot}|${m.arms}|${m.accent ?? ''}`));
    expect(combos.size).toBe(MOVES.filter((m) => m.layered).length);
    for (const d of [1, 2, 3]) expect(MOVES.some((m) => m.difficulty === d && !m.cooldown)).toBe(true);
    for (const l of ['low', 'mid', 'high']) expect(MOVES.some((m) => m.level === l)).toBe(true);
    expect(MOVES.filter((m) => m.cooldown).length).toBeGreaterThanOrEqual(3);
    expect(MOVES.filter((m) => m.idle).length).toBe(1);
    for (const m of MOVES) {
      expect(m.families.length, m.id).toBeGreaterThan(0);
      expect(m.focus.length, m.id).toBeGreaterThan(0);
      for (const f of m.families) expect(FAMILIES).toContain(f);
      for (const f of m.focus) expect(FOCI).toContain(f);
    }
    // Every dance family has moves to draw from.
    for (const f of FAMILIES) expect(MOVES.some((m) => m.families.includes(f) && !m.cooldown), f).toBe(true);
    // Turns exist, and the fast ones are flagged (chill never sees them).
    expect(MOVES.some((m) => m.parts.includes('turn'))).toBe(true);
    expect(MOVES.find((m) => m.id === 'spin')?.fastTurn).toBe(true);
  });

  it.each(MOVES.map((m) => [m.id, m] as [string, Move]))('%s: keyframes are well formed and within joint limits', (_id, m) => {
    expect(checkKeys(m)).toEqual([]);
  });

  it.each(MOVES.map((m) => [m.id, m] as [string, Move]))('%s: plays cleanly at 60 fps (both sides, 100 and 140 BPM)', (_id, m) => {
    expect(checkPlayback(m).problems).toEqual([]);
  });

  // The looks take the head's roll from its up axis. Pitched past ~80 deg
  // (bend + nod, with the settle after a hit) that axis tips toward the
  // viewer and the face draws upside down with the chin up: a forward fold
  // then reads as a backbend. Keep folds to a half fold with the head hanging.
  it('never pitches the head so far that the face flips', () => {
    const ev = new PoseEvaluator();
    const pose = createPose();
    const sk = createSkeleton();
    const bad: string[] = [];
    for (const m of MOVES) {
      const plan = loopPlan(m, 0.5);
      for (let i = 0; i < 96; i++) {
        ev.evaluate(plan, (i / 96) * plan.loopBeats * 0.5, pose);
        solveSkeleton(pose, sk);
        const upY = sk.p[J.HEAD_UP * 3 + 1] - sk.p[J.HEAD * 3 + 1];
        if (upY < 0.2) {
          bad.push(m.id);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
