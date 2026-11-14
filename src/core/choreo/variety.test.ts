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
  // Dangdut (new) and Thai luk thung.
  [['dangdut'], ['dangdut'], ['latin']],
  [['dangdut koplo'], ['dangdut'], []],
  [['luk thung'], ['dangdut'], []],
  // Schlager (new): the Oktoberfest floor.
  [['Schlager'], ['schlager'], ['latin', 'discofunk']],
  [['Partyschlager'], ['schlager'], []],
  [['Oktoberfest'], ['schlager'], []],
  // Round three: synth-pop / new wave and indie (new sets).
  [['synth-pop'], ['synthpop'], ['rock', 'indie']],
  [['new wave', 'synth-pop', 'pop rock'], ['synthpop'], []],
  [['new romantic'], ['synthpop'], []],
  [['synthwave'], ['synthpop'], []],
  [['indie pop'], ['indie'], ['synthpop']],
  [['indie rock'], ['indie', 'rock'], []],
  [['shoegaze'], ['indie'], ['rock']],
  [['dream pop'], ['indie'], []],
  [['jangle pop'], ['indie'], []],
  [['twee pop'], ['indie'], []],
  [['bedroom pop'], ['indie'], []],
  [['Indie'], ['indie'], []],
  [['britpop'], ['indie'], []],
  // Grown sets, and names that opened nothing before although their set exists.
  [['bachata'], ['bachata'], ['salsa']],
  [['tango'], ['tango'], ['latin']],
  [['banda'], ['mexican'], ['latin']],
  [['quebradita'], ['mexican'], []],
  [['tecnobanda'], ['mexican'], []],
  [['cumbia sonidera'], ['cumbia'], ['salsa']],
  [['technocumbia'], ['cumbia'], []],
  [['cuarteto'], ['cumbia'], []],
  [['flamenco'], ['flamenco'], ['latin']],
  [['Arabic pop'], ['bellydance'], []],
  [['khaleeji'], ['bellydance'], []],
  [['Egyptian'], ['bellydance'], []],
  [['Persian pop'], ['bellydance'], []],
  [['country'], ['country'], []],
  [['line dance'], ['country'], []],
  [['Texas two-step'], ['country'], []],
  [['Tahitian'], ['hula'], []],
  [['Samoan'], ['hula'], []],
  [['Irish traditional'], ['folk'], ['country']],
  [['Scottish country dance'], ['folk'], ['country']],
  [['jive'], ['swing'], ['discofunk']],
  [['waltz'], ['swing'], ['discofunk']],
  [['hustle'], ['discofunk'], []],
  [['Congolese rumba'], ['afro'], ['latin', 'chacha']],
  [['azonto'], ['afro'], []],
  [['lambada'], ['brazil'], []],
  [['piseiro'], ['brazil'], []],
  [['chutney'], ['caribbean'], []],
  [['Bhojpuri'], ['southasian'], []],
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
  [['Irish rock'], ['rock']],
  [['rumba'], ['chacha', 'latin']],
  [['europop'], []],
  [['German pop'], []],
  [['Volksmusik'], ['folk']],
  [['brega funk'], ['brazil']],
  [['house'], ['discofunk', 'house']],
  [['Arabic'], ['bellydance']],
  // Modern electropop alone stays pop (the synth-pop floor needs other evidence); "Alternative" stays rock.
  [['electropop'], []],
  [['Alternative'], ['rock']],
  [['alternative rock'], ['rock']],
];

const ADDED: readonly Genre[] = ['gospel', 'dangdut', 'schlager', 'synthpop', 'indie'];

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

  it('labels the new sets\' songs by their own names', () => {
    expect(styleLabel(resolveSongStyle({ genres: ['dangdut'] }))).toBe('Dangdut');
    expect(styleLabel(resolveSongStyle({ genres: ['Schlager'] }))).toBe('Schlager');
    expect(styleLabel(resolveSongStyle({ genres: ['gospel'] }))).toBe('Gospel');
    expect(styleLabel(resolveSongStyle({ genre: 'Christian & Gospel' }))).toBe('Christian & Gospel');
  });

  it('every new set has Easy moves and is a vocabulary; gospel covers every level', () => {
    for (const g of ADDED) {
      const ms = MOVES.filter((m) => m.genre === g);
      expect(ms.length, g).toBe(GENRE_MOVES[g].length);
      expect(ms.filter((m) => m.level === 'low' && !m.jump).length, `${g} easy`).toBeGreaterThanOrEqual(1);
      expect(ms.length, g).toBeGreaterThanOrEqual(4);
    }
    // Gospel, the owner's ask, covers every level.
    const gospel = MOVES.filter((m) => m.genre === 'gospel');
    expect(gospel.filter((m) => m.level === 'low' && !m.jump).length).toBeGreaterThanOrEqual(3);
    expect(gospel.filter((m) => m.level === 'mid').length).toBeGreaterThanOrEqual(3);
    expect(gospel.filter((m) => m.level === 'high').length).toBeGreaterThanOrEqual(1);
    // Synth-pop and indie (round three): at least 6 Easy-eligible moves each, and moves at every level.
    for (const g of ['synthpop', 'indie'] as const) {
      const ms = MOVES.filter((m) => m.genre === g && m.base === m.id);
      expect(ms.filter((m) => m.difficulty === 1 && m.level !== 'high' && !m.jump).length, g).toBeGreaterThanOrEqual(6);
      expect(ms.some((m) => m.level === 'mid'), g).toBe(true);
      expect(ms.some((m) => m.level === 'high'), g).toBe(true);
    }
    // The grown sets: each has an Easy move.
    for (const g of ['bachata', 'tango', 'mexican', 'cumbia', 'flamenco', 'bellydance', 'country'] as const) {
      expect(MOVES.some((m) => m.genre === g && m.level === 'low' && !m.jump), g).toBe(true);
    }
  });
});
