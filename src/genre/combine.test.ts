import { describe, expect, it } from 'vitest';
import { combineGenres, familyDisagreements } from './combine';
import { DEFAULT_SOURCES } from './lookup';
import { creditMatches, titleMatches, unaskedVersion } from './match';
import { canonicalGenre, canonicalGenres, families, specificity } from './names';
import type { SourceId, SourceOutcome } from './types';

const AT = '2026-11-14T00:00:00.000Z';
const found = (genres: string[], moods?: string[]): SourceOutcome => ({ status: 'found', at: AT, genres, ...(moods ? { moods } : {}) });
const names = (raw: string[], strict = false) => canonicalGenres(raw, strict).map((g) => g.name);

describe('genre names', () => {
  it('one spelling for every way the sources write a genre', () => {
    expect(names(['hip hop', 'Hip-Hop', 'Hip-Hop/Rap', 'hip hop music', 'hip-hop'])).toEqual(['hip hop']);
    expect(names(['trap music', 'Trap'])).toEqual(['trap']);
    expect(names(['R&B/Soul', 'R&B', 'contemporary R&B', 'Rhythm and blues', 'r b'])).toEqual(['R&B']);
    expect(names(['Pop music', 'pop'])).toEqual(['pop']);
    expect(names(['Dance-pop', 'dance pop'])).toEqual(['dance-pop']);
    expect(names(['Nu metal', 'nu-metal'])).toEqual(['nu metal']);
    expect(names(['pop/rock', 'Pop/Rock', 'Rock/Pop'])).toEqual(['pop rock']);
    expect(canonicalGenre('Hard Rock')).toEqual({ name: 'hard rock', key: 'hard rock', known: true });
  });

  it('drops junk: store shelves, decades, places, listening habits', () => {
    expect(names(['Soundtrack', 'Holiday', '2000s', '80s', 'british', 'seen live', 'female vocalists', 'party', 'love song', 'Fitness & Workout'])).toEqual([]);
  });

  it('reads song forms ("ballad") as forms, not genres', () => {
    expect(canonicalGenre('Ballad')).toEqual({ name: 'ballad', key: 'ballad', known: true, form: true });
    expect(canonicalGenre('power ballads')?.key).toBe('power ballad');
    expect(names(['ballad', 'Ballads'])).toEqual(['ballad']);
  });

  it('keeps unknown names from curated sources, but user tags must look like a genre', () => {
    expect(names(['Bounce'])).toEqual(['bounce']);
    expect(names(['my road trip'], true)).toEqual([]);
    expect(names(['Bounce'], true)).toEqual(['bounce']); // MusicBrainz's genre list has it
    expect(names(['melodic dubstep'], true)).toEqual(['melodic dubstep']);
    expect(names(['goth rock alternative metal nu metal rock metal'], true)).toEqual([]);
    expect(names(['pkg-jewel case', 'discoth que'], true)).toEqual([]);
  });

  it('knows how specific a genre is and which family it is in', () => {
    expect(specificity('rock')).toBe(0);
    expect(specificity('hard rock')).toBe(1);
    expect(specificity('nu metal')).toBe(2);
    expect(families('nu metal')).toEqual(['alternative', 'metal', 'rock']); // Wikidata: metal is a kind of rock
    expect(families('rap rock')).toEqual(['hip hop', 'rock']);
    expect(families('unheard-of genre')).toEqual([]);
  });
});

describe('song matching', () => {
  it('titles: feat. parts, brackets, & and punctuation', () => {
    expect(titleMatches('Back in Blood (feat. Lil Durk)', 'Back in Blood')).toBe(true);
    expect(titleMatches('Kings & Queens', 'Kings and Queens')).toBe(true);
    expect(titleMatches("Can't Stop the Feeling!", 'CAN’T STOP THE FEELING!')).toBe(true);
    expect(titleMatches('Everybody (Backstreet\'s Back)', 'Everybody')).toBe(true);
    expect(titleMatches('Numb', 'Numb/Encore')).toBe(false);
    expect(titleMatches('TV', 'Guitar Songs')).toBe(false);
  });

  it('credits: billed names, stylised letters, "featuring"', () => {
    expect(creditMatches('Beyoncé ft. JAY-Z', ['Beyoncé', 'Jay-Z'])).toBe(true);
    expect(creditMatches('P!nk', ['Pink'])).toBe(true);
    expect(creditMatches('Pitbull ft. Ke$ha', ['Pitbull', 'Kesha'])).toBe(true);
    expect(creditMatches('ROSÉ & Bruno Mars', ['Rosé', 'Bruno Mars'])).toBe(true);
    expect(creditMatches('Earth, Wind & Fire', ['Earth, Wind & Fire'])).toBe(true);
    expect(creditMatches('Mark Ronson ft. Bruno Mars', [], 'Mark Ronson featuring Bruno Mars')).toBe(true);
    expect(creditMatches('Taio Cruz', ['BTS'])).toBe(false);
    expect(creditMatches('Evanescence', ['Within Temptation'])).toBe(false);
  });

  it('versions: remixes, live and covers only when asked for', () => {
    expect(unaskedVersion({ title: 'Billie Jean' }, 'Billie Jean (Nicolas Jaar remix)')).toBe(true);
    expect(unaskedVersion({ title: 'My Immortal' }, 'live, 2004-05-25: Le Zénith')).toBe(true);
    expect(unaskedVersion({ title: 'Billie Jean (Remix)' }, 'Billie Jean (Remix)')).toBe(false);
    expect(unaskedVersion({ title: 'Levitating' }, 'Levitating', 'Future Nostalgia')).toBe(false);
  });
});

describe('combining by agreement', () => {
  it('a subgenre confirmed by two sources outranks a broad label from one', () => {
    const c = combineGenres({ wikipedia: found(['Nu metal']), musicbrainz: found(['nu metal']), itunes: found(['Rock']) }, DEFAULT_SOURCES);
    expect(c.genres).toEqual(['nu metal', 'rock']);
    expect(c.scored[0].by).toEqual(['wikipedia', 'musicbrainz']);
    // Even when every other source says something under "rock".
    const c2 = combineGenres(
      { wikipedia: found(['alternative metal']), theaudiodb: found(['alternative metal']), musicbrainz: found(['hard rock']), wikidata: found(['soft rock']), itunes: found(['Rock']) },
      DEFAULT_SOURCES,
    );
    expect(c2.genres[0]).toBe('alternative metal');
    expect(c2.genres.indexOf('rock')).toBeGreaterThan(0);
  });

  it('Wikipedia and Wikidata are one group: together they count less than two independent sources', () => {
    const wm = combineGenres({ wikipedia: found(['funk']), wikidata: found(['funk']) }, DEFAULT_SOURCES).scored[0].score;
    const two = combineGenres({ wikipedia: found(['funk']), musicbrainz: found(['funk']) }, DEFAULT_SOURCES).scored[0].score;
    expect(wm).toBeLessThan(two);
  });

  it('at most 6, junk dropped, moods kept apart', () => {
    const c = combineGenres(
      {
        wikipedia: found(['Post-disco', 'R&B', 'funk', 'dance-pop']),
        musicbrainz: found(['pop', 'electronic', 'dance', 'disco', 'funk', 'seen live']),
        theaudiodb: found(['Pop'], ['Quirky', '...']),
        itunes: found(['Pop']),
        wikidata: found(['funk', 'dance-pop', 'rhythm and blues', 'post-disco', 'contemporary R&B']),
      },
      DEFAULT_SOURCES,
    );
    expect(c.genres).toHaveLength(6);
    expect(c.genres.slice(0, 2).sort()).toEqual(['dance-pop', 'funk']);
    expect(c.levels).toEqual(['song', 'song', 'song', 'song', 'song', 'song']);
    expect(c.genres).toContain('post-disco');
    expect(c.genres).not.toContain('seen live');
    expect(c.moods).toEqual(['quirky']);
    expect(c.genres).not.toContain('quirky');
  });

  it('a store label like "Soundtrack" never becomes a genre', () => {
    const c = combineGenres({ itunes: found(['Soundtrack']), wikipedia: found(['Disco-pop', 'dance-pop']) }, DEFAULT_SOURCES);
    expect(c.genres).toEqual(['disco-pop', 'dance-pop']); // the source's own order breaks the tie
  });

  it('only what a source said exactly is ever listed (relations just add weight)', () => {
    const c = combineGenres({ wikipedia: found(['dance-pop']), itunes: found(['Pop']) }, DEFAULT_SOURCES);
    expect(c.genres.sort()).toEqual(['dance-pop', 'pop']);
    expect(c.scored.find((s) => s.name === 'dance-pop')!.score).toBeGreaterThan(1 + 0.25); // own 1 + specificity + iTunes' "pop" related
  });

  it('flags sources that disagree on the broad family', () => {
    expect(familyDisagreements({ wikipedia: found(['Nu metal']), itunes: found(['Hard Rock']) }, DEFAULT_SOURCES)).toEqual([]);
    expect(familyDisagreements({ wikipedia: found(['trap']), itunes: found(['Hard Rock']), theaudiodb: found(['Alternative']) }, DEFAULT_SOURCES)).toEqual([['wikipedia', 'itunes']] as [SourceId, SourceId][]);
  });
});
