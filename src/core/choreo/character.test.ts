import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import { JUMP_CAP, NAMED_DANCE, danceFeel, danceOf, feelMap, freeTimePace, generateRoutine, hasFreeTime, isUsableBeatMap, jumpCap, styleGenres, type Intensity } from './generator';
import { GENRE_MOVES } from './genres';
import { resolveSongStyle, styleLabel, type SongInfo, type SongStyle } from './songStyle';
import { songMap } from './testutil';
import { isNovelty } from './weights';

/**
 * The song's character (calm and soft-but-steady), the jump budget, the
 * tempo feel, scenes, the iTunes tag as a tie-breaker, the Latin dances and
 * free time (songStyle.ts, generator.ts).
 */

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const IDS = Array.from({ length: 12 }, (_, k) => `ch${k}`);

function shares(style: SongStyle, bpm: number, lv: Intensity, map = (id: string) => songMap(bpm, id)) {
  let t = 0, jump = 0, nov = 0, lyrical = 0;
  for (const id of IDS) {
    for (const i of generateRoutine(map(id), lv, { style }).instances) {
      if (i.move.idle || i.move.cooldown) continue;
      t += i.span;
      if (i.move.jump) jump += i.span;
      if (isNovelty(i.move)) nov += i.span;
      if (i.move.genre === 'lyrical') lyrical += i.span;
    }
  }
  return { jump: jump / t, nov: nov / t, lyrical: lyrical / t };
}

describe('the iTunes tag is a tie-breaker when the song has genre names', () => {
  it('"R&B/Soul" alone opens R&B; next to a eurodance list it does not', () => {
    expect(styleGenres(resolveSongStyle({ genre: 'R&B/Soul' })).has('rnb')).toBe(true);
    const s = resolveSongStyle({ genre: 'R&B/Soul', genres: ['Eurodance', 'electronic', 'dance', 'house', 'euro house'] }, { bpm: 131, traits: { calm: 0, fourFloor: 1, drive: 0.8 } });
    expect(styleGenres(s).has('rnb')).toBe(false);
    expect(styleLabel(s)).toBe('Eurodance');
    // A name low in the list can't open a sub-style alone either.
    expect(styleGenres(resolveSongStyle({ genres: ['Eurodance', 'electronic', 'dance', 'house', 'euro house', 'R&B'] })).has('rnb')).toBe(false);
    // With the list agreeing, the tag still helps.
    expect(styleGenres(resolveSongStyle({ genre: 'R&B/Soul', genres: ['soul', 'R&B'] })).has('rnb')).toBe(true);
  });
});

describe('scenes lead the dancing', () => {
  it('a K-pop name anywhere in the song\'s list makes it dance K-pop (BTS: "pop rap, boom bap, hip hop, alt-pop, K-pop, pop")', () => {
    const s = resolveSongStyle({ genre: 'Pop', genres: ['pop rap', 'boom bap', 'hip hop', 'alt-pop', 'K-pop', 'pop'] }, { bpm: 120 });
    const top = Object.entries(s.families).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0];
    expect(top).toBe('kpop');
    expect(styleGenres(s).has('kpop')).toBe(true);
    expect(styleLabel(s)).toBe('K-pop');
    expect(styleLabel(resolveSongStyle({ genres: ['J-pop', 'idol'] }))).toBe('J-pop');
    // The iTunes tag alone is not a scene that overrides a list.
    expect(resolveSongStyle({ genre: 'K-Pop', genres: ['hip hop', 'trap'] }).scene).toBeUndefined();
  });
});

describe('the song\'s character', () => {
  const soft = resolveSongStyle({ genre: 'Pop', genres: ['pop', 'adult contemporary'] }, { bpm: 104, traits: { calm: 0.44, intensity: 0.14, drive: 0.78, fourFloor: 1 } });
  const loud = resolveSongStyle({ genre: 'Pop', genres: ['pop'] }, { bpm: 104, traits: { calm: 0.05, intensity: 0.85, drive: 0.9 } });

  it('a soft song on a steady beat: no lyrical ballet, no jumps, hardly any novelty or cheer moves, at any level', () => {
    expect(soft.soft).toBeGreaterThan(0.8);
    expect(styleGenres(soft).has('lyrical')).toBe(false);
    for (const lv of LEVELS) {
      const a = shares(soft, 104, lv);
      const b = shares(loud, 104, lv);
      expect(a.lyrical, lv).toBe(0);
      expect(a.jump, lv).toBeLessThan(0.03);
      expect(a.nov, lv).toBeLessThan(Math.max(0.02, 0.5 * b.nov));
    }
  });

  it('a calm song quiets the party and novelty moves at every level, and never jumps', () => {
    const calm = resolveSongStyle({ genre: 'Ambient' }, { bpm: 124, traits: { calm: 0.8, intensity: 0.1, drive: 0.4 } });
    for (const lv of LEVELS) {
      const a = shares(calm, 124, lv);
      expect(a.nov, lv).toBeLessThan(0.02);
      expect(a.jump, lv).toBe(0);
    }
  });

  it('old maps (no intensity) behave as before: no softness from the audio', () => {
    expect(resolveSongStyle({ genre: 'Pop' }, { bpm: 104, traits: { calm: 0.44, drive: 0.78 } }).soft).toBeUndefined();
  });
});

describe('the jump budget', () => {
  it('never lets jumps take more than the song\'s share of the danced time', () => {
    const styles: [SongStyle, number][] = [
      [resolveSongStyle({ genres: ['nu metal', 'rap rock'] }, { bpm: 98, traits: { calm: 0, intensity: 0.8, drive: 0.7 } }), 98],
      [resolveSongStyle({ genres: ['hip hop'] }, { bpm: 75, traits: { calm: 0, intensity: 1, drive: 0.86 } }), 75],
      [resolveSongStyle({ genres: ['EDM'] }, { bpm: 128, traits: { calm: 0.1, intensity: 0.8, drive: 1, fourFloor: 1 } }), 128],
      [resolveSongStyle({ genres: ['punk rock'] }, { bpm: 172, traits: { calm: 0, intensity: 0.9, drive: 0.9 } }), 172],
    ];
    for (const [s, bpm] of styles) {
      for (const lv of LEVELS) {
        const cap = jumpCap(s, lv, bpm);
        expect(cap).toBeLessThanOrEqual(JUMP_CAP[lv] + 1e-9);
        for (const id of IDS.slice(0, 6)) {
          let t = 0, j = 0;
          for (const i of generateRoutine(songMap(bpm, id), lv, { style: s }).instances) {
            if (i.move.idle || i.move.cooldown || i.section === 'outro') continue;
            t += i.span;
            if (i.move.jump) j += i.span;
          }
          expect(j / t, `${styleLabel(s)} ${lv} ${id}`).toBeLessThanOrEqual(cap + 0.02);
        }
      }
    }
  });

  it('is largest on a driving song at a brisk tempo, smaller on slow, soft or calm ones, none on Easy', () => {
    const drive = resolveSongStyle({ genres: ['EDM'] }, { traits: { calm: 0.1, drive: 1 } });
    expect(jumpCap(drive, 'chill', 124)).toBe(0);
    expect(jumpCap(drive, 'sweaty', 124)).toBeCloseTo(JUMP_CAP.sweaty, 6);
    expect(jumpCap(drive, 'sweaty', 90)).toBeLessThan(0.5 * JUMP_CAP.sweaty);
    expect(jumpCap(drive, 'cardio', 124)).toBeLessThan(jumpCap(drive, 'sweaty', 124));
    expect(jumpCap({ ...drive, calm: 0.7 }, 'sweaty', 124)).toBe(0);
    expect(jumpCap({ ...drive, soft: 1 }, 'sweaty', 124)).toBeLessThan(0.25 * JUMP_CAP.sweaty);
  });
});

describe('tempo feel', () => {
  const hiphop = resolveSongStyle({ genres: ['hip hop', 'pop rap'] }, { bpm: 150, traits: { calm: 0, halfTempo: 1, halfFeel: 1 } });
  const trap = resolveSongStyle({ genres: ['trap', 'hip hop'] }, { bpm: 150, traits: { calm: 0.37, halfTempo: 1, halfFeel: 1 } });
  const dnb = resolveSongStyle({ genres: ['drum and bass', 'liquid funk'] }, { bpm: 87, traits: { calm: 0, doubleTempo: 0.75 } });

  it('steps at half or twice the count only when the audio and the genre agree', () => {
    expect(danceFeel(hiphop, 150, { half: 1 })).toBe(0.5);
    expect(danceFeel(hiphop, 150, { half: 0.3 })).toBe(1); // the audio doesn't offer it
    expect(danceFeel(hiphop, 150, {})).toBe(1); // older maps: no candidate, no change
    expect(danceFeel(trap, 150, { half: 1 })).toBe(1); // trap steps at 150
    expect(danceFeel(dnb, 87, { double: 0.75 })).toBe(2);
    expect(danceFeel(resolveSongStyle({ title: 'x' }), 150, { half: 1 })).toBe(1); // no genre names: no say
  });

  it('dances the whole song on the felt grid and says so', () => {
    const map: BeatMap = { ...songMap(150, 'feel'), traits: { calm: 0, halfTempo: 1, halfFeel: 1 } as BeatMap['traits'] };
    const r = generateRoutine(map, 'cardio', { style: hiphop });
    expect(r.feel).toBe(0.5);
    expect(r.bpm).toBeCloseTo(75, 6);
    expect(r.times!.length).toBe(r.beats);
    expect(r.beats).toBe(map.beats.length / 2);
    let b = 0;
    for (const i of r.instances) {
      expect(i.start).toBe(b);
      b += i.span;
    }
    expect(b).toBe(r.beats);
    const fast = generateRoutine({ ...songMap(87, 'dnb'), traits: { calm: 0, doubleTempo: 0.75 } as BeatMap['traits'] }, 'sweaty', { style: dnb });
    expect(fast.feel).toBe(2);
    // A map without the new traits is danced as counted.
    expect(generateRoutine(songMap(150, 'old'), 'cardio', { style: hiphop }).feel).toBeUndefined();
  });

  it('the felt grid keeps the downbeats on beats and the map usable', () => {
    const m = songMap(150, 'grid');
    const h = feelMap(m, 0.5);
    expect(isUsableBeatMap(h)).toBe(true);
    for (const d of h.downbeats) expect(h.beats[d]).toBe(m.beats[2 * d]);
    const d2 = feelMap(songMap(87, 'grid2'), 2);
    expect(isUsableBeatMap(d2)).toBe(true);
    expect(d2.beats.length).toBe(2 * songMap(87, 'grid2').beats.length);
  });
});

describe('the Latin dances', () => {
  const genreBeats = (info: SongInfo, bpm: number) => {
    const style = resolveSongStyle(info, { bpm, traits: { calm: 0.2 } });
    const by = new Map<string, number>();
    let named = 0, all = 0;
    for (const id of IDS) {
      for (const lv of ['cardio', 'sweaty'] as const) {
        for (const i of generateRoutine(songMap(bpm, id), lv, { style }).instances) {
          if (!i.move.genre || i.move.idle || i.move.cooldown) continue;
          by.set(i.move.genre, (by.get(i.move.genre) ?? 0) + i.span);
          all += i.span;
          const d = danceOf(style);
          if (d && i.move.name.toLowerCase().includes(d === 'chacha' ? 'cha-cha' : d)) named += i.span;
        }
      }
    }
    return { style, by, all, named };
  };

  it('a bachata dances bachata first, and no salsa, cumbia or samba', () => {
    const { by, all } = genreBeats({ genres: ['bachata'] }, 128);
    expect((by.get('bachata') ?? 0) / all).toBeGreaterThan(0.5);
    for (const g of ['salsa', 'cumbia', 'brazil']) expect(by.get(g) ?? 0, g).toBe(0);
  });

  it('a merengue gets merengue-named moves first from the Latin set (NAMED_DANCE)', () => {
    expect(NAMED_DANCE).toBeGreaterThan(1);
    expect(GENRE_MOVES.merengue.length).toBe(0);
    const { all, named } = genreBeats({ genres: ['merengue'] }, 140);
    expect(named / all).toBeGreaterThan(0.4);
  });

  it('flamenco, tango and regional Mexican never get the Latin party steps', () => {
    for (const [g, bpm] of [['flamenco', 120], ['tango', 118], ['banda', 120]] as const) {
      const { by } = genreBeats({ genres: [g] }, bpm);
      expect(by.get('latin') ?? 0, g).toBe(0);
    }
  });
});

describe('free time: a song with no beat grid', () => {
  const empty = (id: string, d = 240): BeatMap => ({ v: 1, analyzerVersion: 't', videoId: id, duration: d, bpm: 0, beats: [], downbeats: [], sections: [], source: 'cloud' });

  it('gets a slow flow on a nominal grid, marked as free time, at every level', () => {
    expect(hasFreeTime(empty('a'))).toBe(true);
    expect(hasFreeTime({ ...empty('b'), partial: true })).toBe(false);
    expect(hasFreeTime(empty('c', 5))).toBe(false);
    const style = resolveSongStyle({ genre: 'Classical' }, { traits: { calm: 1 } });
    for (const lv of LEVELS) {
      const r = generateRoutine(empty('free'), lv, { style });
      expect(r.freeTime).toBe(true);
      expect(r.instances.length).toBeGreaterThan(10);
      expect(r.times!.length).toBe(r.beats);
      expect(r.instances.filter((i) => i.move.jump)).toEqual([]);
      expect(r.bpm).toBeGreaterThanOrEqual(56);
      expect(r.bpm).toBeLessThanOrEqual(96);
    }
    // The pace follows what is known: a calm piece slower than a metal track.
    expect(freeTimePace(style)).toBeLessThan(freeTimePace(resolveSongStyle({ genre: 'Metal' }, { traits: { calm: 0.6 } })));
  });
});
