/**
 * Levels (song / album / artist), the generated genre hierarchy, and the
 * ranking and junk rules of combine.ts, on synthetic answers shaped like the
 * real ones (the recorded lookups are replayed in recorded.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { combineGenres, echoShare, umbrellasLast } from './combine';
import { wdKnows, wdSpecificity, mbKnows } from './hierarchy';
import { DEFAULT_SOURCES } from './lookup';
import { ancestors, broaderThan, canonicalGenre, genreSpecificity, related } from './names';
import type { SourceOutcome } from './types';

const AT = '2026-11-14T00:00:00.000Z';
const found = (genres: string[], counts?: number[]): SourceOutcome => ({ status: 'found', at: AT, genres, ...(counts ? { counts } : {}) });
const key = (n: string) => canonicalGenre(n)!.key;

describe('generated genre hierarchy (Wikidata subclass graph + MusicBrainz genre list)', () => {
  it('knows genres by label and alias, and MusicBrainz genre names', () => {
    expect(wdKnows('cumbia')).toBe(true);
    expect(wdKnows('k pop')).toBe(true);
    expect(wdKnows('seen live')).toBe(false);
    expect(mbKnows('boom bap')).toBe(true);
    expect(mbKnows('billboard hot 100')).toBe(false);
  });

  it('narrow genres are more specific than the umbrellas over them', () => {
    const s = (n: string) => genreSpecificity(key(n));
    expect(s('cumbia')).toBeGreaterThan(s('latin'));
    expect(s('Latin pop')).toBeGreaterThan(s('pop'));
    expect(s('Latin pop')).toBeGreaterThan(s('latin'));
    expect(s('K-pop')).toBeGreaterThan(s('pop'));
    expect(s('nu metal')).toBeGreaterThan(s('metal'));
    expect(s('metal')).toBeGreaterThan(s('rock'));
    expect(s('Eurodance')).toBeGreaterThan(s('electronic'));
    // Regional groupings do not make a genre deeper.
    expect(wdSpecificity('reggae')!).toBeLessThan(0.4);
  });

  it('relations come from both trees, without the meaningless "popular music" umbrella', () => {
    expect(broaderThan(key('tropical'), key('cumbia'))).toBe(true); // Wikidata: cumbia ⊂ tropical music
    expect(broaderThan(key('latin'), key('cumbia'))).toBe(true);
    expect(ancestors(key('dream pop')).has('indie rock')).toBe(true); // Wikidata only
    expect(related(key('pop'), key('hip hop'))).toBe(false); // both are "popular music"; that says nothing
    expect(related(key('rock'), key('pop'))).toBe(false);
  });

  it('a crowd tag the genre lists know counts, others must still end in a known genre', () => {
    expect(canonicalGenre('boom bap', true)?.key).toBe('boom bap');
    expect(canonicalGenre('cumbia sonidera', true)?.key).toBe('cumbia sonidera');
    expect(canonicalGenre('billboard hot 100', true)).toBeNull();
    expect(canonicalGenre('5+ wochen', true)).toBeNull();
  });
});

describe('levels', () => {
  it('artist genres never enter the song list; they have their own', () => {
    const c = combineGenres(
      { itunes: found(['Alternative']), 'musicbrainz-artist': found(['r&b', 'neo soul'], [3, 2]), 'wikipedia-artist': found(['R&B', 'neo soul']) },
      DEFAULT_SOURCES,
    );
    expect(c.genres).toEqual(['alternative']);
    expect(c.levels).toEqual(['song']);
    expect(c.artistGenres.slice(0, 2).sort()).toEqual(['R&B', 'neo soul']);
  });

  it('song-level genres come before album-level ones, each labelled', () => {
    const c = combineGenres({ wikipedia: found(['Synth-pop']), 'discogs-album': found(['Electro', 'Electronic']), 'musicbrainz-album': found(['electro'], [2]) }, DEFAULT_SOURCES);
    expect(c.genres[0]).toBe('synth-pop');
    expect(c.levels[0]).toBe('song');
    expect(c.genres.slice(1)).toContain('electro');
    expect(c.levels.slice(1).every((l) => l === 'album')).toBe(true);
  });

  it('an album genre that narrows the song\'s own genre joins the song list; two album sources put it first', () => {
    // The store calls the track "Música tropical"; its album's editors say bachata.
    const one = combineGenres({ itunes: found(['Música tropical']), 'discogs-album': found(['Bachata', 'Latin']), 'itunes-album': found(['Música tropical']) }, DEFAULT_SOURCES);
    expect(one.genres.slice(0, 2)).toEqual(['tropical', 'bachata']);
    expect(one.levels.slice(0, 2)).toEqual(['song', 'album']);
    const two = combineGenres({ itunes: found(['Música tropical']), 'discogs-album': found(['Bachata', 'Latin']), 'musicbrainz-album': found(['bachata'], [2]) }, DEFAULT_SOURCES);
    expect(two.genres[0]).toBe('bachata');
    expect(two.levels[0]).toBe('album');
    expect(two.genres.indexOf('tropical')).toBeGreaterThan(0);
    // An album genre unrelated to the song's own comes after it.
    const other = combineGenres({ wikipedia: found(['Latin pop']), 'discogs-album': found(['Cumbia']), 'musicbrainz-album': found(['cumbia'], [2]) }, DEFAULT_SOURCES);
    expect(other.genres).toEqual(['Latin pop', 'cumbia']);
  });
});

describe('ranking for specificity', () => {
  it('a narrow genre a credible song source reports is not buried under the umbrella others repeat', () => {
    const c = combineGenres(
      { wikipedia: found(['K-pop']), wikidata: found(['pop music']), theaudiodb: found(['Pop']), itunes: found(['Pop']), musicbrainz: found(['pop'], [4]) },
      DEFAULT_SOURCES,
    );
    expect(c.genres[0]).toBe('K-pop');
  });

  it("album sources repeating the album's umbrella do not lift it over the song's own specific names", () => {
    // Shaped like We Found Love: the song sources say electro house / EDM; one tags R&B; the album's sources all say R&B.
    const song = { wikipedia: found(['EDM']), wikidata: found(['electro house']), musicbrainz: found(['contemporary r&b', 'dubstep', 'electronic'], [3, 3, 2]) };
    const album = { 'wikipedia-album': found(['Pop', 'dance', 'R&B']), 'wikidata-album': found(['rhythm and blues']), 'musicbrainz-album': found(['pop', 'contemporary r&b', 'dance-pop'], [5, 3, 2]), 'discogs-album': found(['R&B', 'Pop']) };
    const alone = combineGenres(song, DEFAULT_SOURCES);
    const both = combineGenres({ ...song, ...album }, DEFAULT_SOURCES);
    const rank = (c: typeof both, g: string) => c.genres.indexOf(g);
    expect(rank(both, 'R&B')).toBeGreaterThan(rank(both, 'electro house'));
    expect(rank(both, 'R&B')).toBeGreaterThan(rank(both, 'EDM'));
    // The umbrella's score is what the song sources give it.
    const score = (c: typeof both, k: string) => c.scored.find((s) => s.key === k)!.score;
    expect(score(both, 'r&b')).toBeCloseTo(score(alone, 'r&b'), 1);
    // A specific genre is still confirmed by the album (here by its related "dance"; below by the same name).
    expect(score(both, 'dubstep')).toBeGreaterThan(score(alone, 'dubstep'));
    const confirmed = combineGenres({ ...song, 'discogs-album': found(['Dubstep']) }, DEFAULT_SOURCES);
    expect(score(confirmed, 'dubstep')).toBeGreaterThan(score(alone, 'dubstep'));
  });

  it('when the song sources only say umbrellas, the album supports them as before', () => {
    const c = combineGenres({ itunes: found(['Música tropical']), 'discogs-album': found(['Bachata']), 'itunes-album': found(['Música tropical']) }, DEFAULT_SOURCES);
    const plain = combineGenres({ itunes: found(['Música tropical']), 'discogs-album': found(['Bachata']) }, DEFAULT_SOURCES);
    expect(c.scored.find((s) => s.key === 'tropical')!.score).toBeGreaterThan(plain.scored.find((s) => s.key === 'tropical')!.score);
  });

  it('the umbrella rule only moves a genre under its own narrower forms', () => {
    const list = [{ key: 'pop' }, { key: 'hip hop' }, { key: 'k pop' }];
    expect(umbrellasLast(list, () => true).map((x) => x.key)).toEqual(['hip hop', 'k pop', 'pop']);
  });
});

describe('junk control', () => {
  it('a crowd tag with one vote needs another source', () => {
    const c = combineGenres(
      { wikipedia: found(['Pop']), wikidata: found(['pop music']), itunes: found(['Pop']), musicbrainz: found(['pop', 'adult contemporary', 'dream pop', 'electronic', 'hip hop'], [3, 1, 1, 1, 1]) },
      DEFAULT_SOURCES,
    );
    expect(c.genres).toContain('pop');
    expect(c.genres).not.toContain('hip hop');
    expect(c.genres).not.toContain('electronic');
    expect(c.genres).not.toContain('dream pop');
  });

  it('a tag in a family no other source shares is down-weighted', () => {
    const c = combineGenres({ wikipedia: found(['Pop']), theaudiodb: found(['Pop']), itunes: found(['Pop']), musicbrainz: found(['hip hop'], [3]) }, DEFAULT_SOURCES);
    const hh = c.scored.find((s) => s.key === 'hip hop')!;
    expect(hh.score).toBeLessThan(c.scored.find((s) => s.key === 'pop')!.score / 2);
  });

  it('a site that repeats its artist genre on the track counts less there', () => {
    const others = { 'wikipedia-artist': found(['R&B']) };
    const echo = combineGenres({ theaudiodb: found(['R&B']), 'theaudiodb-artist': found(['R&B', 'Rock/Pop']), ...others }, DEFAULT_SOURCES);
    const own = combineGenres({ theaudiodb: found(['R&B']), 'theaudiodb-artist': found(['Rock']), ...others }, DEFAULT_SOURCES);
    expect(echo.scored[0].score).toBeLessThan(own.scored[0].score);
    expect(echoShare('theaudiodb')).toBeLessThan(0.2);
    expect(echoShare('musicbrainz')).toBe(1); // MusicBrainz users tag recordings themselves
    // The site's own artist page alone does not make it the artist's known genre: a store label set per release.
    const alone = combineGenres({ itunes: found(['Alternative']), 'itunes-artist': found(['Alternative']), 'wikipedia-artist': found(['R&B']) }, DEFAULT_SOURCES);
    const plain = combineGenres({ itunes: found(['Alternative']) }, DEFAULT_SOURCES);
    expect(alone.scored[0].score).toBe(plain.scored[0].score);
  });
});
