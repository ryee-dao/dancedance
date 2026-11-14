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

describe('round three: agreement under a bare umbrella, one tagger\'s specific names', () => {
  // Shaped like Hot Chocolate "Brother Louie": the song sources say pop; album and artist sources at three providers
  // (MusicBrainz, Wikimedia, iTunes) say soul / funk / disco.
  const louie = {
    musicbrainz: found(['pop', 'vocal'], [1, 1]),
    itunes: found(['Pop']),
    'musicbrainz-album': found(['disco', 'soul', 'contemporary pop/rock', 'funk', 'pop', 'r&b'], [4, 3, 2, 2, 1, 1]),
    'wikipedia-album': found(['Soul']),
    'wikidata-album': found(['pop music', 'funk', 'rhythm and blues']),
    'itunes-album': found(['Funk']),
    'musicbrainz-artist': found(['soul', 'funk', 'disco', 'pop', 'pop soul', 'pop rock'], [5, 3, 2, 2, 2, 1]),
    'wikipedia-artist': found(['R&B', 'funk', 'soul', 'disco']),
    'wikidata-artist': found(['funk', 'disco', 'soul', 'pop music']),
    'itunes-artist': found(['R&B/Soul']),
  };

  it('a style that independent album and artist providers agree on joins the song level after the umbrella', () => {
    const c = combineGenres(louie, DEFAULT_SOURCES);
    expect(c.genres.slice(0, 2)).toEqual(['pop', 'funk']);
    expect(c.levels.slice(0, 2)).toEqual(['song', 'song']);
    // Soul and disco: two providers (MusicBrainz and Wikimedia at both levels count once each), not narrower than pop.
    expect(c.levels[c.genres.indexOf('soul')]).toBe('album');
  });

  it('not from the album alone, the artist alone, or one provider at two levels', () => {
    const { 'musicbrainz-artist': _m, 'wikipedia-artist': _w, 'wikidata-artist': _d, 'itunes-artist': _i, ...albumOnly } = louie;
    expect(combineGenres(albumOnly, DEFAULT_SOURCES).levels.slice(1).every((l) => l === 'album')).toBe(true);
    const artistOnly = { musicbrainz: louie.musicbrainz, itunes: louie.itunes, 'musicbrainz-artist': louie['musicbrainz-artist'], 'wikipedia-artist': louie['wikipedia-artist'], 'wikidata-artist': louie['wikidata-artist'] };
    expect(combineGenres(artistOnly, DEFAULT_SOURCES).genres).toEqual(['pop']);
    const oneProvider = { musicbrainz: louie.musicbrainz, itunes: louie.itunes, 'musicbrainz-album': found(['funk', 'pop'], [3, 2]), 'musicbrainz-artist': found(['funk', 'soul'], [4, 2]) };
    const c = combineGenres(oneProvider, DEFAULT_SOURCES);
    expect(c.levels[c.genres.indexOf('funk')]).toBe('album');
    // A song that names its style itself is not lifted: the album's names stay the album's.
    const named = combineGenres({ ...louie, wikipedia: found(['Glam rock']) }, DEFAULT_SOURCES);
    expect(named.levels[named.genres.indexOf('glam rock')]).toBe('song');
    expect(named.levels[named.genres.indexOf('funk')]).toBe('album');
  });

  it('an artist page with one tagger keeps its specific names when another site places them (Fito Olivares: cumbia)', () => {
    const fito = {
      itunes: found(['Pop Latino']),
      'itunes-album': found(['Pop Latino']),
      'musicbrainz-artist': found(['cumbia', 'cumbia mexicana', 'latin', 'tejano'], [1, 1, 1, 1]),
      'itunes-artist': found(['Latin']),
    };
    const c = combineGenres(fito, DEFAULT_SOURCES);
    expect(c.artistGenres).toEqual(expect.arrayContaining(['cumbia', 'latin']));
    // With no other site placing them (nothing broader elsewhere), one tagger's names stay out.
    expect(combineGenres({ itunes: found(['Pop Latino']), 'musicbrainz-artist': found(['cumbia', 'tejano'], [1, 1]) }, DEFAULT_SOURCES).artistGenres).toEqual([]);
    // A recording's single votes stay junk control (one tagger's "boom bap" on a K-pop song).
    const rec = combineGenres({ musicbrainz: found(['k-pop', 'boom bap'], [1, 1]), itunes: found(['K-Pop']), wikipedia: found(['hip hop']) }, DEFAULT_SOURCES);
    expect(rec.genres).not.toContain('boom bap');
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
