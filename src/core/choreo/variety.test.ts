import { describe, expect, it } from 'vitest';
import { styleGenres } from './generator';
import { GENRE_MOVES, type Genre } from './genres';
import { MOVES } from './moves';
import { resolveSongStyle, styleLabel, type SongInfo } from './songStyle';

/**
 * The sets added or grown in the genre survey (Nov 2026,
 * tools/eval/data/genre-dance-survey.md; ids in genreSets/variety.ts): the
 * genre names that open them, and songs of other styles left as they were.
 */

const open = (info: SongInfo) => styleGenres(resolveSongStyle(info));

// [genre names of a song, sets it must open, sets it must not open]
const OPENS: [readonly string[], Genre[], Genre[]][] = [
  // Gospel and worship.
  [['gospel'], ['gospel'], ['discofunk', 'rnb', 'hiphop']],
  [['urban contemporary gospel'], ['gospel'], ['rnb']],
  [['traditional gospel'], ['gospel'], []],
  [['southern gospel'], ['gospel'], ['country']],
  [['contemporary Christian'], ['gospel'], []],
  [['worship'], ['gospel'], []],
  [['CCM', 'pop'], ['gospel'], []],
];

// Songs of other styles: none of the new sets, and what they opened before.
const UNCHANGED: [readonly string[], Genre[]][] = [
  [['pop'], []],
  [['R&B'], ['discofunk', 'hiphop', 'rnb']],
  [['soul'], ['discofunk']],
  [['Christian rock'], ['rock']],
  [['Christian hip hop'], ['hiphop']],
  [['christian metal'], ['rock', 'metal']],
  [['dance-pop'], []],
  [['hip hop'], ['hiphop']],
];

const ADDED: readonly Genre[] = ['gospel'];

describe('genre survey sets', () => {
  it.each(OPENS)('%j opens its set', (genres, want, not) => {
    const o = open({ genres });
    for (const g of want) expect(o.has(g), `${genres} opens ${g}`).toBe(true);
    for (const g of not) expect(o.has(g), `${genres} does not open ${g}`).toBe(false);
  });

  it.each(UNCHANGED)('%j opens exactly what it did', (genres, want) => {
    const o: Genre[] = [...open({ genres })].filter((g) => g !== 'lyrical').sort();
    expect(o).toEqual([...want].sort());
    for (const g of ADDED) expect(o.includes(g), `${genres}: ${g}`).toBe(false);
  });

  it('the iTunes tag alone opens gospel, but with a song list only as a tie-breaker', () => {
    expect(open({ genre: 'Christian & Gospel' }).has('gospel')).toBe(true);
    expect(open({ genres: ['pop'], genre: 'Christian & Gospel' }).has('gospel')).toBe(false);
  });

  it('labels gospel songs by their own names', () => {
    expect(styleLabel(resolveSongStyle({ genres: ['gospel'] }))).toBe('Gospel');
    expect(styleLabel(resolveSongStyle({ genre: 'Christian & Gospel' }))).toBe('Christian & Gospel');
  });

  it('every new set has moves for every level: Easy without jumps, and Hard showpieces', () => {
    for (const g of ADDED) {
      const ms = MOVES.filter((m) => m.genre === g);
      expect(ms.length, g).toBe(GENRE_MOVES[g].length);
      expect(ms.filter((m) => m.level === 'low' && !m.jump).length, `${g} easy`).toBeGreaterThanOrEqual(3);
      expect(ms.filter((m) => m.level === 'mid').length, `${g} medium`).toBeGreaterThanOrEqual(3);
      expect(ms.filter((m) => m.level === 'high').length, `${g} hard`).toBeGreaterThanOrEqual(1);
    }
  });
});
