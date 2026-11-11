import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import levitatingMap from '../../../public/beatmaps/1j_XvebOg4c.json';
import onTheFloorMap from '../../../public/beatmaps/9lybsz-7TFM.json';
import { generateDuoRoutine } from './duo';
import { GENRE_SHARE, generateRoutine, genreFits, styleGenres, type Intensity, type MoveInstance } from './generator';
import { GENRES, GENRE_CONFLICTS, GENRE_MOVES, genreListedIds, genreOfId, type Genre } from './genres';
import { MOVES, findMove } from './moves';
import { getPool } from './pool';
import { UNIQUE_THRESHOLD, VARIATION_THRESHOLD } from './similarity';
import { resolveSongStyle, type SongInfo, type SongStyle } from './songStyle';
import { songMap } from './testutil';
import { layerGenre } from './variations';
import { moveWeights } from './weights';

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const DANCE = MOVES.filter((m) => !m.idle && !m.cooldown);
const styleOf = (info: SongInfo): SongStyle => resolveSongStyle(info);
const REAL = [levitatingMap, onTheFloorMap] as unknown as BeatMap[];

/** Songs of many styles: [label, song, genres it must open]. */
const SONGS: [string, SongInfo, Genre[]][] = [
  ['fallback', { videoId: 'unknown-x', title: 'Some Song', artist: 'Nobody Known' }, []],
  ['pop', { videoId: 'pop-x', title: 'Flowers', artist: 'Miley Cyrus' }, []],
  ['rock', { videoId: 'rock-x', title: 'Numb', artist: 'Linkin Park' }, ['rock']],
  ['hip-hop', { videoId: 'hh-x', title: "God's Plan", artist: 'Drake' }, ['hiphop']],
  ['latin', { videoId: 'latin-x', title: 'Hips', artist: 'Shakira', genre: 'Latin' }, ['latin']],
  ['disco', { videoId: 'disco-x', title: 'Night Fever', artist: 'Bee Gees' }, ['discofunk']],
  ['k-pop', { videoId: 'kpop-x', title: 'Dynamite', artist: 'BTS' }, ['kpop']],
  ['gangnam', { videoId: 'iSF26HsmeRI', title: 'Gangnam Style', artist: 'PSY' }, ['kpop']],
  ['country', { videoId: 'country-x', title: 'Any Man of Mine', artist: 'Shania Twain', genre: 'Country' }, ['country']],
  ['swing', { videoId: 'swing-x', title: 'Johnny B. Goode', artist: 'Chuck Berry', genre: "Rock 'n' Roll" }, ['swing', 'rock']],
  ['afro', { videoId: 'afro-x', title: 'Last Last', artist: 'Burna Boy', genre: 'Afrobeats' }, ['afro']],
  ['bollywood', { videoId: 'bolly-x', title: 'Jai Ho', artist: 'A. R. Rahman', genre: 'Bollywood' }, ['southasian']],
];
const mapsFor = (id: string): BeatMap[] => [songMap(124, id), songMap(92, `${id}-slow`), songMap(144, `${id}-fast`), { ...REAL[id.length % REAL.length], videoId: id }];

describe('two tiers: global and genre-exclusive', () => {
  it('assigns every move exactly one tier, from the explicit genre table', () => {
    expect(GENRE_CONFLICTS).toEqual([]);
    const ids = new Set(MOVES.map((m) => m.id));
    for (const id of genreListedIds()) expect(ids.has(id), `${id} is listed in a genre set but not in the catalogue`).toBe(true);
    for (const m of MOVES) expect(m.genre, m.id).toBe(genreOfId(m.id));
    let n = 0;
    for (const g of GENRES) n += GENRE_MOVES[g].length;
    expect(n).toBe(new Set(GENRES.flatMap((g) => GENRE_MOVES[g])).size);
  });

  it('variations share their tier (a recombination takes its genre layer, never two genres)', () => {
    const p = getPool();
    for (const v of [...p.variations, ...p.ornaments.all()]) {
      const base = findMove(v.base)!;
      if (!v.id.includes('~combo~')) {
        expect(v.genre, v.id).toBe(base.genre);
        continue;
      }
      const f = layerGenre('foot', v.foot!), a = layerGenre('arms', v.arms!);
      expect(f && a && f !== a, v.id).toBeFalsy();
      expect(v.genre, v.id).toBe(f ?? a ?? undefined);
    }
  });

  it('has a global library of hundreds of moves and genre sets of 50-100 for the big genres', () => {
    const global = DANCE.filter((m) => !m.genre).length;
    expect(global).toBeGreaterThanOrEqual(650);
    for (const g of ['rock', 'hiphop', 'latin', 'discofunk', 'kpop'] as Genre[]) {
      expect(GENRE_MOVES[g].length, g).toBeGreaterThanOrEqual(50);
      expect(GENRE_MOVES[g].length, g).toBeLessThanOrEqual(100);
    }
    for (const g of GENRES) expect(GENRE_MOVES[g].length, g).toBeGreaterThan(0);
  });

  it('keeps the uniqueness bars where they were', () => {
    expect(UNIQUE_THRESHOLD).toBe(0.045);
    expect(VARIATION_THRESHOLD).toBe(0.085);
  });

  it('opens genres from the song style', () => {
    for (const [label, info, want] of SONGS) {
      const open = styleGenres(styleOf(info));
      for (const g of want) expect(open.has(g), `${label} opens ${g}`).toBe(true);
      if (label === 'fallback' || label === 'pop') expect([...open], label).toEqual([]);
    }
    // A country song is not also rock; afrobeats never opens salsa.
    expect(styleGenres(styleOf(SONGS[8][1])).has('rock')).toBe(false);
    expect(styleGenres(styleOf(SONGS[10][1])).has('latin')).toBe(false);
  });
});

describe('genre-exclusive moves stay in their genre', () => {
  it('never appear on a song that does not open their genre (any level, tempo, duo); signature nods aside', () => {
    for (const [label, info] of SONGS) {
      const style = styleOf(info);
      const open = styleGenres(style);
      const nods = new Set(style.signature ?? []);
      for (const map of mapsFor(info.videoId!)) {
        for (const lv of LEVELS) {
          const r = generateRoutine(map, lv, { style });
          const out = r.instances.filter((i) => !genreFits(i.move, open) && !(i.sig && nods.has(i.move.base)));
          expect(out.map((i) => i.move.id), `${label} ${lv} @${map.bpm}`).toEqual([]);
          const duo = generateDuoRoutine(map, lv, { style });
          const duoOut = [...duo.p1, ...duo.p2].filter((i) => !genreFits(i.move, open) && !(i.sig && nods.has(i.move.base)));
          expect(duoOut.map((i) => i.move.id), `${label} duo ${lv}`).toEqual([]);
        }
      }
    }
  });

  it('a genre song dances its genre set prominently, but not only that', () => {
    for (const [label, info, want] of SONGS) {
      if (!want.length) continue;
      const style = styleOf(info);
      let genre = 0, total = 0;
      for (const map of mapsFor(info.videoId!)) {
        for (const lv of ['cardio', 'sweaty'] as const) {
          for (const i of generateRoutine(map, lv, { style }).instances) {
            if (i.move.cooldown || i.move.idle) continue;
            total += i.span;
            if (i.move.genre && want.includes(i.move.genre)) genre += i.span;
          }
        }
      }
      expect(genre / total, `${label} genre share`).toBeGreaterThan(0.1);
      expect(genre / total, `${label} genre share`).toBeLessThan(0.75);
    }
    expect(GENRE_SHARE).toBeGreaterThan(0.2);
  });

  it('signature nods still open their own song\'s chorus', () => {
    const r = generateRoutine(songMap(132, 'iSF26HsmeRI'), 'cardio', { style: styleOf(SONGS[7][1]) });
    expect(r.signature.map((s) => s.move.id)).toEqual(expect.arrayContaining(['gallop', 'lasso']));
    expect(findMove('gallop')!.genre).toBe('country');
  });
});

describe('soft weights', () => {
  const picks = (maps: BeatMap[], lv: Intensity, style?: SongStyle): MoveInstance[] =>
    maps.flatMap((m) => generateRoutine(m, lv, { style }).instances.filter((i) => !i.move.idle && !i.move.cooldown && !i.sig));
  const share = (ins: MoveInstance[], f: (i: MoveInstance) => boolean) => ins.filter(f).reduce((t, i) => t + i.span, 0) / ins.reduce((t, i) => t + i.span, 0);
  const IDS = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'];

  it('every move has finite, positive weights in range', () => {
    for (const m of [...DANCE, ...getPool().variations]) {
      const w = moveWeights(m);
      for (const t of w.tempo) expect(t > 0 && Number.isFinite(t), m.id).toBe(true);
      expect(w.impact >= 0 && w.impact <= 1, m.id).toBe(true);
      expect(w.difficulty >= 0 && w.difficulty <= 1, m.id).toBe(true);
    }
  });

  it('fast songs get more jumps than slow ones, and slow songs still get some', () => {
    const fast = picks(IDS.map((id) => songMap(142, id)), 'sweaty');
    const slow = picks(IDS.map((id) => songMap(86, id)), 'sweaty');
    const jf = share(fast, (i) => i.move.jump);
    const js = share(slow, (i) => i.move.jump);
    expect(jf, `fast ${jf.toFixed(3)} vs slow ${js.toFixed(3)}`).toBeGreaterThan(js * 1.5);
    expect(js).toBeGreaterThan(0);
  });

  it('Sweaty favours high-impact and hard moves; Chill gentle, simple ones (never jumps); none is exclusive but Chill\'s jumps', () => {
    const maps = IDS.map((id) => songMap(124, id));
    const chill = picks(maps, 'chill');
    const cardio = picks(maps, 'cardio');
    const sweaty = picks(maps, 'sweaty');
    const impact = (ins: MoveInstance[]) => ins.reduce((t, i) => t + moveWeights(i.move).impact * i.span, 0) / ins.reduce((t, i) => t + i.span, 0);
    const diff = (ins: MoveInstance[]) => ins.reduce((t, i) => t + moveWeights(i.move).difficulty * i.span, 0) / ins.reduce((t, i) => t + i.span, 0);
    expect(impact(chill)).toBeLessThan(impact(cardio));
    expect(impact(cardio)).toBeLessThan(impact(sweaty));
    expect(diff(chill)).toBeLessThan(diff(cardio));
    expect(diff(cardio)).toBeLessThan(diff(sweaty));
    expect(share(chill, (i) => i.move.jump)).toBe(0);
    expect(share(cardio, (i) => i.move.jump)).toBeGreaterThan(0);
    expect(share(cardio, (i) => i.move.difficulty === 3)).toBeGreaterThan(0);
    expect(share(sweaty, (i) => i.move.difficulty === 1)).toBeGreaterThan(0);
  });

  it('is deterministic per video id', () => {
    const style = styleOf(SONGS[2][1]);
    for (const lv of LEVELS) {
      const a = generateRoutine(songMap(128, 'det'), lv, { style }).instances.map((i) => `${i.move.id}@${i.start}`);
      const b = generateRoutine(songMap(128, 'det'), lv, { style }).instances.map((i) => `${i.move.id}@${i.start}`);
      expect(a).toEqual(b);
    }
  });
});
