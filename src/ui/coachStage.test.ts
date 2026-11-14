import { describe, expect, it } from 'vitest';
import { routineInfo } from './coachStage';

const item = { kind: 'youtube' as const, videoId: 'abc123', title: "Hips Don't Lie", artist: 'Shakira' };

describe('coach stage routine personalisation', () => {
  it("resolves the song's style once from the frame info item: from the song, never from the artist's name", () => {
    // Title words only (no genre known): themes, but no Latin from "Shakira".
    const bare = routineInfo(item, null, {});
    expect(bare.style.themes).toEqual(expect.arrayContaining(['hips']));
    expect(bare.style.source).toBe('fallback');
    const r = routineInfo(item, null, { getGenre: () => 'Pop', getGenres: () => ['Latin pop', 'reggaeton'] });
    expect(r.style.families.latin).toBeGreaterThan(0.4);
    expect(r.label).toMatch(/Latin/);
    expect(r.fresh).toBeUndefined();
  });

  it('passes the genre list, the artist genre (a small blend) and the map traits through', () => {
    const unknown = { kind: 'youtube' as const, videoId: 'bib', title: 'Back in Blood', artist: 'Pooh Shiesty' };
    const r = routineInfo(unknown, null, { getGenre: () => 'Hip-Hop/Rap', getGenres: () => ['Hip hop', 'drill', 'trap'] });
    expect(r.label).toBe('Hip-hop · Drill');
    // An artist genre alone never decides a style.
    const a = routineInfo(unknown, null, { getArtistGenre: () => 'Heavy metal' });
    expect(a.style.source).toBe('fallback');
    expect(a.style.families.rock ?? 0).toBeLessThan(0.2);
    // The beat map's traits set the character: a calm "Hard Rock" song is a ballad.
    const ballad = { kind: 'youtube' as const, videoId: 'mi', title: 'My Immortal', artist: 'Evanescence' };
    const map = { bpm: 78, sections: [{ energy: 0.5 }], traits: { calm: 0.9, heavy: 0.2 } };
    const b = routineInfo(ballad, map, { getGenre: () => 'Hard Rock' });
    expect(b.label).toBe('Hard Rock · Ballad');
    expect(b.style.calm).toBeGreaterThan(0.8);
    // Bad or missing traits: neutral, no crash.
    expect(routineInfo(ballad, { bpm: 78, sections: [], traits: { calm: 'x', heavy: NaN } }, { getGenre: () => 'Hard Rock' }).style.calm).toBeUndefined();
    const boom = () => {
      throw new Error('z');
    };
    expect(routineInfo(ballad, { bpm: 78, sections: [] }, { getGenres: boom }).style.source).toBe('fallback');
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
