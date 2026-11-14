import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import { JUMP_CAP, NAMED_DANCE, STEADY_TIME_BPM, danceFeel, danceOf, feelMap, freeTimeDriving, freeTimePace, generateRoutine, hasFreeTime, isUsableBeatMap, jumpCap, styleGenres, type Intensity } from './generator';
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
/**
 * Shares of novelty moves are a handful of kit slots per routine (16-32 beats each), so they need many
 * songs: over 12 songs a single slot moves a share by ~0.5 %, and the loud song's own novelty share
 * (the comparison) swung from 5 % to 19 % between 12-song and 48-song windows (Nov 2026).
 */
const MANY = Array.from({ length: 48 }, (_, k) => `ch${k}`);

function shares(style: SongStyle, bpm: number, lv: Intensity, map = (id: string) => songMap(bpm, id), ids: readonly string[] = IDS) {
  let t = 0, jump = 0, nov = 0, lyrical = 0;
  for (const id of ids) {
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
    // Measured over 48 songs, three seed sets (ids ch / s / x, Nov 2026, after the trap moves and restaged
    // twist / mambo were merged): novelty on the soft song 0.6-2.3 % of the danced time, on the loud one
    // 8.6-19 %, a ratio of 0.07-0.16. Every novelty move seen on the soft song is classified (isNovelty)
    // and weighted down to 0.08-0.23 by its softness; what remains is the odd slot, not a leak.
    for (const lv of LEVELS) {
      const a = shares(soft, 104, lv, undefined, MANY);
      const b = shares(loud, 104, lv, undefined, MANY);
      expect(a.lyrical, lv).toBe(0);
      expect(a.jump, lv).toBeLessThan(0.03);
      expect(a.nov, lv).toBeLessThan(0.04);
      expect(a.nov, lv).toBeLessThan(0.35 * b.nov);
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
    const drive = resolveSongStyle({ genres: ['EDM'] }, { traits: { calm: 0.1, drive: 1, intensity: 0.9 } });
    expect(jumpCap(drive, 'chill', 124)).toBe(0);
    expect(jumpCap(drive, 'sweaty', 124)).toBeCloseTo(JUMP_CAP.sweaty, 6);
    expect(jumpCap(drive, 'sweaty', 90)).toBeLessThan(0.5 * JUMP_CAP.sweaty);
    expect(jumpCap(drive, 'cardio', 124)).toBeLessThan(jumpCap(drive, 'sweaty', 124));
    expect(jumpCap({ ...drive, calm: 0.7 }, 'sweaty', 124)).toBe(0);
    expect(jumpCap({ ...drive, soft: 1 }, 'sweaty', 124)).toBeLessThan(0.25 * JUMP_CAP.sweaty);
    // The song's energy scales it continuously (songEnergy): an ordinary song keeps a part, a gentle one none.
    const at = (intensity: number) => jumpCap(resolveSongStyle({ genres: ['EDM'] }, { traits: { calm: 0.1, drive: 0.9, intensity } }), 'sweaty', 124);
    expect(at(0.55)).toBeGreaterThan(0);
    expect(at(0.55)).toBeLessThan(0.6 * at(0.9));
    expect(at(0.3)).toBe(0);
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

  it('a strong half candidate wins unless the count is clearly the genre tempo', () => {
    // A country ballad counted at 146 (Kenny Chesney, Nov 2026: halfTempo 0.75, intensity 0.57) steps at 73 ...
    const country = resolveSongStyle({ genres: ['country'] }, { bpm: 146, traits: { calm: 0.19, intensity: 0.57, drive: 0.54 } });
    const mid = { intensity: 0.57, drive: 0.54 };
    expect(danceFeel(country, 146, { half: 0.75, halfBackbeat: 0.75 }, mid)).toBe(0.5);
    // ... but a country song counted near country's own tempo stays, and without the audio's say country (bluegrass, two-step) keeps a fast count.
    expect(danceFeel(country, 118, { half: 0.75 }, mid)).toBe(1);
    expect(danceFeel(country, 146, { half: 0.4 }, mid)).toBe(1);
    // A hip-hop anthem with a full half candidate whose genre centre sits nearer the count (All I Do Is Win, centre 99).
    const anthem = resolveSongStyle({ genres: ['hip hop', 'crunk', 'gangsta rap'] }, { bpm: 150, traits: { calm: 0, intensity: 1, drive: 0.86, halfTempo: 1, halfFeel: 1 } });
    expect(danceFeel(anthem, 150, { half: 1, halfBackbeat: 1 }, { intensity: 1, drive: 0.86 })).toBe(0.5);
    // A half-time backbeat is what trap is at its count (Mask Off, 150); weak in-between beats are not.
    const trap = resolveSongStyle({ genres: ['trap', 'hip hop'] }, { bpm: 150, traits: { calm: 0.37, intensity: 0.13, drive: 0.6, halfTempo: 1, halfFeel: 1 } });
    expect(danceFeel(trap, 150, { half: 1, halfBackbeat: 1 }, { intensity: 0.13, drive: 0.6 })).toBe(1);
    expect(danceFeel(trap, 150, { half: 1, halfBackbeat: 0.2 }, { intensity: 0.13, drive: 0.6 })).toBe(0.5);
  });

  it('without the audio: a soft song counted fast, or a count only the fast genres step at, is halved', () => {
    // A soft bedroom-pop song counted at 156 (Michael Seyer: no half candidate, intensity 0.1) steps at 78 ...
    const alt = resolveSongStyle({ genres: ['alternative'] }, { bpm: 156, traits: { calm: 0.59, intensity: 0.1, drive: 0.67 } });
    const soft = { intensity: 0.1, drive: 0.67 };
    expect(danceFeel(alt, 156, {}, soft)).toBe(0.5);
    // ... at a walking pace it stays, and so does a hard-sounding song at 156.
    expect(danceFeel(alt, 118, {}, soft)).toBe(1);
    const hardAlt = resolveSongStyle({ genres: ['alternative'] }, { bpm: 156, traits: { calm: 0, intensity: 0.9, drive: 0.8 } });
    expect(danceFeel(hardAlt, 156, {}, { intensity: 0.9, drive: 0.8 })).toBe(1);
    // Post-punk counted at 185 (Tempo Perdido, ~93): nothing outside the fast genres is stepped there.
    const postPunk = resolveSongStyle({ genres: ['post-punk', 'alternative rock', 'pop rock'] }, { bpm: 185, traits: { calm: 0, intensity: 0.87, drive: 0.6 } });
    expect(danceFeel(postPunk, 185, { half: 0.07 }, { intensity: 0.87, drive: 0.6 })).toBe(0.5);
    // A ballad's names say soft even when the audio has no intensity (older maps).
    const ballad = resolveSongStyle({ genres: ['piano ballad', 'pop'] }, { bpm: 135, traits: { calm: 0.9 } });
    expect(danceFeel(ballad, 135, {})).toBe(0.5);
    // Hip-hop at 150 with no candidate stays counted (older maps).
    expect(danceFeel(hiphop, 150, {})).toBe(1);
  });

  it('genuinely fast songs keep their count without a half candidate, soft-sounding or not', () => {
    const fast: [string[], number, number][] = [
      [['punk rock'], 175, 0.9], [['skate punk', 'hardcore punk'], 200, 1], [['drum and bass'], 174, 0.9], [['jungle'], 170, 0.6],
      [['thrash metal'], 190, 1], [['metal'], 180, 0.95], [['bluegrass'], 180, 0.25], [['country'], 170, 0.4], [['texas country', 'line dance'], 160, 0.5],
      [['lindy hop', 'swing'], 210, 0.5], [['rock and roll', 'rockabilly'], 175, 0.6], [['gabber', 'hardcore techno'], 180, 1], [['salsa'], 185, 0.6],
      [['merengue'], 150, 0.6], [['trap'], 150, 0.3], [['uk drill'], 142, 0.4], [['dubstep'], 140, 0.9], [['techno'], 140, 0.8],
    ];
    for (const [genres, bpm, intensity] of fast) {
      for (const drive of [0.6, 0.95]) {
        const style = resolveSongStyle({ genres }, { bpm, traits: { calm: 0.1, intensity, drive } });
        expect(danceFeel(style, bpm, { half: 0.3, halfBackbeat: 0.3 }, { intensity, drive }), `${genres.join('/')} ${bpm} ${drive}`).toBe(1);
      }
    }
  });

  it('a busy rhythm is energetic whatever the timbre: Hey Ya! keeps its 159', () => {
    const heyya = resolveSongStyle({ genres: ['funk', 'neo soul', 'alternative hip hop', 'electro', 'pop soul', 'soul'] }, { bpm: 159, traits: { calm: 0.02, intensity: 0.43, drive: 0.9 } });
    expect(danceFeel(heyya, 159, { half: 0.16, halfBackbeat: 0 }, { intensity: 0.43, drive: 0.9 })).toBe(1);
    // The same sound on a sparse rhythm (the soft double counts read drive 0.67-0.75) is halved.
    expect(danceFeel(heyya, 159, { half: 0.16, halfBackbeat: 0 }, { intensity: 0.43, drive: 0.7 })).toBe(0.5);
  });

  it('a strong double candidate on an energetic song doubles a half count; never on a calm or soft one', () => {
    // Shake It Off counted at 80 (doubleTempo 1, intensity 0.84), Footloose at 87, Happy at 80 (0.81).
    const pop = resolveSongStyle({ genres: ['dance-pop', 'synth-pop', 'pop'] }, { bpm: 80, traits: { calm: 0, intensity: 0.84, drive: 0.89 } });
    expect(danceFeel(pop, 80, { double: 1 }, { intensity: 0.84, drive: 0.89 })).toBe(2);
    expect(danceFeel(pop, 80, { double: 0.81 }, { intensity: 0.69, drive: 1 })).toBe(2);
    expect(danceFeel(pop, 80, { double: 0.4 }, { intensity: 0.84, drive: 0.89 })).toBe(1);
    // A counted metal song at 98 with a fair double candidate stays (its genre steps there).
    const metal = resolveSongStyle({ genres: ['nu metal', 'alternative metal'] }, { bpm: 98, traits: { calm: 0, intensity: 0.77, drive: 0.68 } });
    expect(danceFeel(metal, 98, { double: 0.61 }, { intensity: 0.77, drive: 0.68 })).toBe(1);
    // A piano ballad's busy accompaniment (My Immortal: doubleTempo 0.84) is not its step, nor a soft song's.
    const ballad = resolveSongStyle({ genres: ['gothic rock', 'piano rock'] }, { bpm: 75, traits: { calm: 1, intensity: 0.06, drive: 0.16 } });
    expect(danceFeel(ballad, 75, { double: 0.84 }, { intensity: 0.06, drive: 0.16 })).toBe(1);
    const soft = resolveSongStyle({ genres: ['mandopop'] }, { bpm: 80, traits: { calm: 0.44, intensity: 0.22, drive: 0.69 } });
    expect(danceFeel(soft, 80, { double: 0.53 }, { intensity: 0.22, drive: 0.69 })).toBe(1);
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

  it('a driving song gets a steady grid at its genre tempo, danced in its own style, never the lyrical flow', () => {
    // Crossover thrash the tracker found no beat in (Sky Church "Adamant", Nov 2026: intensity 1, heavy 0.99, 0 beats).
    const thrash = resolveSongStyle({ genres: ['thrash metal', 'crossover thrash'] }, { traits: { calm: 0, drive: 0.9, intensity: 1, heavy: 0.99 } });
    expect(freeTimeDriving(thrash)).toBe(true);
    expect(freeTimePace(thrash)).toBeGreaterThanOrEqual(STEADY_TIME_BPM[0]);
    expect(freeTimePace(thrash)).toBeLessThanOrEqual(STEADY_TIME_BPM[1]);
    let metal = 0, all = 0, jumps = 0;
    for (const lv of LEVELS) {
      for (const id of IDS.slice(0, 4)) {
        const r = generateRoutine(empty(`thrash-${id}`), lv, { style: thrash });
        expect(r.freeTime).toBe(true);
        expect(r.bpm).toBe(freeTimePace(thrash));
        expect(r.times!.length).toBe(r.beats);
        for (const i of r.instances) {
          if (i.move.idle || i.move.cooldown) continue;
          expect(i.move.genre, i.move.name).not.toBe('lyrical');
          all += i.span;
          if (i.move.genre === 'metal' || i.move.genre === 'rock') metal += i.span;
          if (lv === 'sweaty' && i.move.jump) jumps += i.span;
        }
      }
    }
    expect(metal / all).toBeGreaterThan(0.2);
    expect(jumps).toBeGreaterThan(0);
    // Hard-sounding by intensity alone (calm unknown) counts too; a calm or a mid song keeps the slow flow.
    expect(freeTimeDriving({ ...thrash, calm: undefined })).toBe(true);
    expect(freeTimeDriving(resolveSongStyle({ genres: ['jazz'] }, { traits: { calm: 0.65, intensity: 0, drive: 0.72 } }))).toBe(false);
    expect(freeTimeDriving(resolveSongStyle({ genres: ['rock'] }, { traits: { calm: 0.45, intensity: 0.4, drive: 0.5 } }))).toBe(false);
  });
});
