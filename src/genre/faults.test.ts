/**
 * Combination faults the round-two random-song evaluation found
 * (tools/eval/data/run-20261115: genre-lookups.json keeps every source's raw
 * answer), as rules on answers shaped like those, and the title as evidence.
 */
import { describe, expect, it } from 'vitest';
import { combineGenres, MAX_GENRES } from './combine';
import { DEFAULT_SOURCES, lookupDue, recombineStored } from './lookup';
import { titleGenre } from './sources/title';
import type { GenreLookup, SourceOutcome } from './types';

const AT = '2026-11-14T00:00:00.000Z';
const found = (genres: string[], counts?: number[]): SourceOutcome => ({ status: 'found', at: AT, genres, ...(counts ? { counts } : {}) });

describe('album genres, song forms, first and last names', () => {
  // Shaped like Celine Dion "The Power of Love": the song sources say pop (MusicBrainz also "ballad", one vote); one
  // Discogs album style is "New Jack Swing"; two album sources say soft rock.
  const celine = {
    wikidata: found(['pop music']),
    musicbrainz: found(['ballad', 'electronic', 'pop'], [1, 1, 1]),
    theaudiodb: found(['Pop']),
    itunes: found(['Pop']),
    'musicbrainz-album': found(['pop', 'ballad', 'rock', 'soft rock', 'adult contemporary', 'electronic'], [10, 4, 2, 2, 1, 1]),
    'wikipedia-album': found(['Pop']),
    'wikidata-album': found(['pop music', 'soft rock']),
    'discogs-album': found(['New Jack Swing', 'Dance-pop', 'Ballad', 'Vocal', 'Electronic', 'Funk / Soul', 'Pop']),
    'itunes-album': found(['Pop']),
  };

  it('an album genre with one album source behind it follows the song\'s own names', () => {
    const c = combineGenres(celine, DEFAULT_SOURCES);
    const at = (g: string) => c.genres.indexOf(g);
    expect(at('new jack swing')).toBeGreaterThan(at('pop'));
    expect(at('new jack swing')).toBeGreaterThan(at('electronic'));
    // Two album sources (credible) still narrow the song's umbrella ahead of it, as rule 5 says.
    expect(at('soft rock')).toBeLessThan(at('pop'));
  });

  it('"ballad" is kept as a song form: after the genres, at song level, never ranked among them', () => {
    const c = combineGenres(celine, DEFAULT_SOURCES);
    expect(c.genres[c.genres.length - 1]).toBe('ballad');
    expect(c.levels[c.genres.length - 1]).toBe('song');
    expect(c.genres.filter((g) => g === 'ballad')).toHaveLength(1);
    expect(c.genres.length).toBeLessThanOrEqual(MAX_GENRES + 1);
    expect(c.scored.some((s) => s.key === 'ballad')).toBe(false);
    // An album's "Ballad" style alone says the album has ballads, not that this song is one.
    const albumOnly = combineGenres({ itunes: found(['Pop']), 'discogs-album': found(['Pop', 'Ballad']), 'wikipedia-album': found(['Pop']) }, DEFAULT_SOURCES);
    expect(albumOnly.genres).not.toContain('ballad');
  });

  it('a song source\'s first-listed genre counts even when no other source shares its family (I\'m Yours: Reggae)', () => {
    const c = combineGenres(
      {
        wikipedia: found(['Reggae', 'folk-pop', 'soft rock', 'Jawaiian', 'surf pop']),
        wikidata: found(['pop music']),
        musicbrainz: found(['pop rock', 'soft rock', 'pop', 'rock'], [2, 2, 1, 1]),
        theaudiodb: found(['Acoustic']),
        itunes: found(['Pop']),
        'wikipedia-album': found(['Pop', 'folk', 'blue-eyed soul', 'jazz']),
        'wikidata-album': found(['pop music']),
        'itunes-album': found(['Pop']),
      },
      DEFAULT_SOURCES,
    );
    expect(c.genres).toContain('reggae');
  });

  it('a lone outlier listed after a source\'s main genre is dropped (Hey Sexy Lady: Wikipedia\'s last "tango")', () => {
    const c = combineGenres(
      {
        wikipedia: found(['Reggae', 'dancehall', 'tango']),
        wikidata: found(['reggae']),
        musicbrainz: found(['pop rap', 'hip hop', 'hip-hop', 'ragga hip-hop', 'ragga hiphop'], [2, 1, 1, 1, 1]),
        theaudiodb: found(['Reggae']),
        itunes: found(['Pop']),
        'wikipedia-album': found(['Dancehall', 'reggae fusion']),
        'discogs-album': found(['Ragga HipHop', 'Hip Hop']),
      },
      DEFAULT_SOURCES,
    );
    expect(c.genres).not.toContain('tango');
    expect(c.genres.slice(0, 2)).toEqual(['dancehall', 'reggae']);
    // The same name supported by another source (or as the source's main genre) stays.
    const backed = combineGenres({ wikipedia: found(['Reggae', 'dancehall', 'tango']), musicbrainz: found(['tango', 'pop'], [3, 1]), theaudiodb: found(['Reggae']), itunes: found(['Pop']) }, DEFAULT_SOURCES);
    expect(backed.genres).toContain('tango');
  });
});

describe('the title as song-level evidence', () => {
  it('an exact, specific genre name of the vocabulary', () => {
    expect(titleGenre('Reggaeton')).toBe('Reggaeton');
    expect(titleGenre('Reggaeton (feat. Alexis y Fido)')).toBe('Reggaeton');
    expect(titleGenre('Sertanejo - Remastered 2003')).toBe('Sertanejo');
    expect(titleGenre('Bachata')).toBe('Bachata');
  });

  it('not a common word, an umbrella, a form or a longer title', () => {
    for (const t of ['House', 'Trap', 'Soul', 'Swing', 'Funk', 'Bounce', 'Jungle', 'Pop', 'Rock', 'Jazz', 'Folk', 'Ballad', 'Lullaby', 'Love', 'Bachata Rosa', 'Despacito', 'Hello']) {
      expect(titleGenre(t), t).toBeNull();
    }
  });

  it('a song called "Reggaeton" that only the store tags "Pop" reads as reggaeton; a local source never makes a lookup due offline', async () => {
    const stored: Pick<GenreLookup, 'sources'> = { sources: { itunes: found(['Pop']), 'wikidata-artist': found(['hip-hop', 'contemporary R&B']) } };
    const l = await recombineStored(stored, { artist: 'Tony Sunshine', title: 'Reggaeton' });
    expect(l.genres[0]).toBe('reggaeton');
    expect(l.genres).toContain('pop');
    // One source that says otherwise outweighs the title: it never leads against the song's own sources.
    const rock = await recombineStored({ sources: { wikipedia: found(['Hard rock']), musicbrainz: found(['hard rock', 'rock'], [3, 2]), itunes: found(['Rock']) } }, { artist: 'X', title: 'Bachata' });
    expect(rock.genres[0]).toBe('hard rock');
    expect(DEFAULT_SOURCES.filter((s) => s.local).map((s) => s.id)).toEqual(['title']);
    expect(lookupDue(null, new Date(AT))).toBe(true);
  });
});
