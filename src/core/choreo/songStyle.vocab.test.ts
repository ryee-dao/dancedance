import { describe, expect, it } from 'vitest';
import { styleGenres } from './generator';
import type { Genre } from './genres';
import { ITUNES_GENRES, LIST_GENRES, UNPLACED_GENRES } from './genreVocab.testutil';
import { readGenre, resolveSongStyle, styleLabel, type SongInfo } from './songStyle';

/**
 * The reviewed genre vocabulary (genreVocab.testutil.ts; the full table:
 * tools/eval/genreTable.ts -> tools/eval/data/genre-vocabulary.md): every
 * name is placed, labelled in ordinary words, and opens sensible sets.
 */

const asTag = (g: string): SongInfo => ({ genre: g });
const asList = (g: string): SongInfo => ({ genres: [g] });

describe('genre vocabulary', () => {
  it('places every iTunes primary genre and every common list name, and ignores what is not a genre', () => {
    for (const g of [...ITUNES_GENRES, ...LIST_GENRES]) expect(readGenre(g).placed, g).toBe(true);
    for (const g of UNPLACED_GENRES) expect(readGenre(g).placed, g).toBe(false);
  });

  it('labels the music in ordinary words: never "Aerobics", "Latin groove", or "Pop" for what is not pop', () => {
    for (const [g, info] of [...ITUNES_GENRES.map((x) => [x, asTag(x)] as const), ...LIST_GENRES.map((x) => [x, asList(x)] as const)]) {
      const label = styleLabel(resolveSongStyle(info));
      expect(label, g).not.toMatch(/Aerobics|Latin groove|Mixed styles/);
      if (/^Pop\b/.test(label)) expect(g.toLowerCase(), `${g} -> ${label}`).toMatch(/pop/);
    }
  });

  it('music that is not dance music reads as such: a neutral mix under its own name, calm, no showpiece sets', () => {
    for (const g of ['Classical', 'Opera', 'New Age', 'Ambient', 'Spoken Word', 'Baroque Era', 'Choral', 'Gregorian chant', 'drone', 'Indian Classical']) {
      const s = resolveSongStyle(asTag(g));
      expect(s.still, g).toBe(true);
      expect(s.families, g).toEqual({ pop: 1 });
      expect(styleLabel(s), g).not.toMatch(/Ballad|Pop/);
      expect([...styleGenres(s)].filter((x) => x !== 'lyrical'), g).toEqual([]);
    }
    // ... but a song that mixes one in with dance music isn't "still".
    expect(resolveSongStyle({ genres: ['ambient', 'house'] }).still).toBeUndefined();
  });

  // [name, label, sets it must open, sets it must not open]
  const CASES: [string, string, Genre[], Genre[]][] = [
    ['Blues', 'Blues', ['rnb'], ['rock', 'swing']],
    ['jump blues', 'Jump blues', ['swing'], ['rock']],
    ['Texas blues', 'Texas blues', ['rock'], ['swing']],
    // Jazz dances the swing set (or smooth and flowing), never the disco & funk floor: the swing set from the swing
    // era's names, plain jazz only on a lively song (no audio here: gentle).
    ['Jazz', 'Jazz', [], ['discofunk', 'swing']],
    ['swing', 'Swing', ['swing'], ['discofunk']],
    ['big band', 'Big band', ['swing'], ['discofunk']],
    ['vocal jazz', 'Vocal jazz', [], ['discofunk', 'swing']],
    ['bop', 'Bop', [], ['discofunk', 'swing']],
    ['Electronic', 'Electronic', [], ['discofunk']],
    ['Eurodance', 'Eurodance', ['edm'], ['rnb']],
    ['R&B/Soul', 'R&B', ['rnb'], []],
    ['Hip-Hop/Rap', 'Hip-hop', ['hiphop'], ['trap']],
    ['K-Pop', 'K-pop', ['kpop'], []],
    // J-pop and C-pop / Mandopop: their own scenes, pop and ballad material by the traits, not K-pop's aegyo point
    // choreography; idol pop dances it.
    ['J-Pop', 'J-pop', [], ['kpop']],
    ['idol pop', 'Idol pop', ['kpop'], []],
    ['Mandopop', 'C-pop', [], ['kpop']],
    ['C-pop', 'C-pop', [], ['kpop']],
    ['Cantopop', 'C-pop', [], ['kpop']],
    // Bachata grew past MIN_GENRE_SET in the genre survey: Latin no longer opens outright, it lends (genres.ts NEIGHBOURS).
    ['bachata', 'Bachata', ['bachata'], ['salsa', 'cumbia', 'brazil']],
    ['salsa', 'Salsa', ['salsa'], ['bachata', 'brazil']],
    ['cumbia', 'Cumbia', ['cumbia', 'latin'], ['salsa', 'brazil']],
    ['merengue', 'Merengue', ['latin'], ['salsa', 'brazil']],
    ['cha-cha-chá', 'Cha-cha-chá', ['latin'], ['brazil']],
    ['flamenco', 'Flamenco', ['flamenco'], ['latin']],
    ['tango', 'Tango', ['tango'], ['latin']],
    ['banda', 'Banda', ['mexican'], ['latin']],
    ['samba', 'Samba', ['brazil'], ['latin']],
    ['reggaeton', 'Reggaeton', ['reggaeton'], ['latin']],
    ['Worldwide', 'World music', [], []],
    ['Fitness & Workout', 'Fitness & Workout', [], []],
    ['Downtempo', 'Downtempo', [], ['rock', 'edm']],
    ['Dangdut', 'Dangdut', [], ['latin']],
    ['dabke', 'Dabke', ['folk'], ['bellydance']],
    // Named folk traditions open the world folk-dance set; plain / Western folk does not.
    ['Russian folk', 'Russian folk', ['folk'], []],
    ['Irish folk', 'Irish folk', ['folk'], []],
    ['traditional folk', 'Traditional folk', ['folk'], []],
    ['folk dance', 'Folk dance', ['folk'], []],
    ['Celtic', 'Celtic', ['folk'], []],
    ['Folk', 'Folk', [], ['folk']],
    ['Contemporary Folk', 'Contemporary Folk', [], ['folk']],
    ['indie folk', 'Indie folk', [], ['folk']],
    ['American folk', 'American folk', [], ['folk']],
    // Sertanejo is Brazil's country music: the country floor, not samba.
    ['Sertanejo', 'Sertanejo', ['country'], ['brazil', 'latin']],
    ['forró', 'Forró', ['brazil'], []],
    // Surf music is the 1960s floor, not the jive of the swing set.
    ['surf pop', 'Surf pop', [], ['swing']],
    ['surf rock', 'Surf rock', [], ['swing']],
    ['rockabilly', 'Rockabilly', ['swing'], []],
    // A song form is not a genre: calm and slow, no set of its own.
    ['ballad', 'Ballad', [], ['rock', 'swing']],
  ];
  it.each(CASES)('%s -> %s', (g, label, open, closed) => {
    const s = resolveSongStyle(asList(g));
    expect(styleLabel(s)).toBe(label);
    const o = styleGenres(s);
    for (const x of open) expect(o.has(x), `${g} opens ${x}`).toBe(true);
    for (const x of closed) expect(o.has(x), `${g} does not open ${x}`).toBe(false);
  });
});
