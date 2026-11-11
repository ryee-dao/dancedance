import { describe, expect, it } from 'vitest';
import { routineInfo } from './coachStage';

const item = { kind: 'youtube' as const, videoId: 'abc123', title: "Hips Don't Lie", artist: 'Shakira' };

describe('coach stage routine personalisation', () => {
  it("resolves the song's style once from the frame info item", () => {
    const r = routineInfo(item, null, {});
    expect(r.style.families.latin).toBeGreaterThan(0.4);
    expect(r.label).toMatch(/Latin/);
    expect(r.fresh).toBeUndefined();
  });

  it("'same' ignores the play count; 'fresh' mixes it into the key", () => {
    const same = routineInfo(item, null, { getRoutineMode: () => 'same', getPlayCount: () => 4 });
    const f4 = routineInfo(item, null, { getRoutineMode: () => 'fresh', getPlayCount: () => 4 });
    const f5 = routineInfo(item, null, { getRoutineMode: () => 'fresh', getPlayCount: () => 5 });
    expect(same.fresh).toBeUndefined();
    expect(f4.fresh).toBe(4);
    expect(f4.key).not.toBe(f5.key);
    expect(same.key).not.toBe(f4.key);
  });

  it('uses the genre of added songs and survives throwing deps', () => {
    const unknown = { kind: 'youtube' as const, videoId: 'zz', title: 'Some Track', artist: 'Unknown Band' };
    expect(routineInfo(unknown, null, { getGenre: () => 'Hard Rock' }).style.source).toBe('genre');
    const r = routineInfo(unknown, null, { getGenre: () => { throw new Error('x'); }, getRoutineMode: () => 'fresh', getPlayCount: () => { throw new Error('y'); } });
    expect(r.style.source).toBe('fallback');
    expect(r.fresh).toBe(0);
  });
});
