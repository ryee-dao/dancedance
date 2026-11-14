/**
 * The album- and artist-level sources' parsers and matchers, on trimmed
 * copies of real answers (November 2026). Whole lookups, every request as it
 * was answered live, are replayed in recorded.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { PoliteHttp, type GenreFetch } from './http';
import { isSingleOf, leadCredited, type SongQuery } from './match';
import { discogsAlbum, parseMaster } from './sources/discogs';
import { itunesAlbum, itunesArtist } from './sources/itunes';
import { albumGroups, creditedArtist, matchRecordings, musicbrainzArtist, parseRecordings, readUrlLinks } from './sources/musicbrainz';
import { parseArtists as parseAdbArtists, theaudiodbArtist } from './sources/theaudiodb';
import { albumForms, artistForms, wikidataArtist } from './sources/wikimediaContext';

/** A client answering with `answer(url)`; records the URLs sent. */
function client(answer: (url: string) => unknown, seen: string[] = []): PoliteHttp {
  const fetch: GenreFetch = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, headers: new Headers(), json: async () => answer(url) };
  };
  return new PoliteHttp({ fetch, spacingMs: () => 0, sleep: async () => {}, now: () => 0 });
}

describe('MusicBrainz album and artist', () => {
  const NUNCA: SongQuery = { artist: 'Los Ángeles Azules & Natalia Lafourcade', title: 'Nunca Es Suficiente', durationSec: 266 };
  const rec = (releases: { title: string; date: string; type: string; secondary?: string[]; id: string }[], first = '2018-06-08') => ({
    recordings: [
      {
        id: '35428188-2cb2-4f80-b8c6-579fc48b5f79',
        title: 'Nunca es suficiente',
        length: 266016,
        'first-release-date': first,
        'artist-credit': [
          { name: 'Los Ángeles Azules', joinphrase: ' & ', artist: { id: 'dcb5e5c6-5f21-4266-b5b6-556f54a6b6b5', name: 'Los Ángeles Azules' } },
          { name: 'Natalia Lafourcade', artist: { id: '2ceb4e66-4eaa-4dba-ad3a-30df3b742557', name: 'Natalia Lafourcade' } },
        ],
        releases: releases.map((r) => ({ title: r.title, status: 'Official', date: r.date, 'release-group': { id: r.id, title: r.title, 'primary-type': r.type, 'secondary-types': r.secondary ?? [] } })),
      },
    ],
  });

  it('the album the recording first came out on: no compilation, no later soundtrack', () => {
    const recs = matchRecordings(
      NUNCA,
      parseRecordings(
        rec([
          { title: 'Lo más romántico de la cumbia', date: '2019', type: 'Album', secondary: ['Compilation'], id: 'c' },
          { title: 'Una película de amor', date: '2024', type: 'Album', secondary: ['Soundtrack'], id: 's' },
          { title: 'Esto sí es cumbia', date: '2018-06-08', type: 'Album', id: 'a' },
        ]),
      ),
    );
    expect(albumGroups(NUNCA, recs).map((g) => g.id)).toEqual(['a']);
    // The store's album name wins among albums of the same time.
    const two = matchRecordings(NUNCA, parseRecordings(rec([{ title: 'Esto sí es cumbia', date: '2018', type: 'Album', id: 'a' }, { title: 'Otro', date: '2018', type: 'EP', id: 'b' }])));
    expect(albumGroups({ ...NUNCA, album: 'Otro - EP' }, two).map((g) => g.id)).toEqual(['b', 'a']);
  });

  it("reads the album's links to Wikidata and Discogs, and the credited lead artist", () => {
    const links = readUrlLinks({
      relations: [
        { type: 'discogs', url: { resource: 'https://www.discogs.com/master/2422489' } },
        { type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q56208868' } },
        { type: 'allmusic', url: { resource: 'https://www.allmusic.com/album/x' } },
      ],
    });
    expect(links).toEqual({ discogsMaster: '2422489', wikidata: 'Q56208868' });
    const recs = matchRecordings(NUNCA, parseRecordings(rec([])));
    expect(creditedArtist(NUNCA, recs)).toEqual({ id: 'dcb5e5c6-5f21-4266-b5b6-556f54a6b6b5', name: 'Los Ángeles Azules' });
  });

  it('an artist found by name only when exactly one artist has that name', async () => {
    const http = (artists: unknown[]) =>
      client((url) => (url.includes('/artist?') ? { artists } : url.includes('/artist/') ? { tags: [{ name: 'metalcore', count: 2 }], relations: [] } : { recordings: [], 'release-groups': [] }));
    const song = { artist: 'Fencer', title: 'Sanitarium' };
    expect(await musicbrainzArtist.lookup(song, http([{ id: 'a', name: 'Fencer' }, { id: 'b', name: 'Fencer' }]))).toMatchObject({ status: 'none', reason: '2 artists of this name; the song confirms none' });
    expect(await musicbrainzArtist.lookup(song, http([{ id: 'a', name: 'Fencer' }, { id: 'c', name: 'Fencers' }]))).toMatchObject({ status: 'found', genres: ['metalcore'], counts: [2], links: { mbArtist: 'a' } });
  });
});

describe('Discogs master (through the MusicBrainz link)', () => {
  const master = { id: 2422489, title: 'Esto Sí Es Cumbia', genres: ['Latin'], styles: ['Cumbia', 'Vallenato'], tracklist: [{ title: 'Perdón, Perdón' }, { title: 'Nunca Es Suficiente' }] };
  const ctx = { outcome: async () => ({ status: 'none' as const, at: 'x', reason: 'the album has no tags', links: { discogsMaster: '2422489' } }) };

  it('styles first, then genres; the track list must contain the song; no link, no request', async () => {
    const seen: string[] = [];
    const http = client(() => master, seen);
    expect(parseMaster(master)).toMatchObject({ styles: ['Cumbia', 'Vallenato'], genres: ['Latin'] });
    expect(await discogsAlbum.lookup({ artist: 'Los Ángeles Azules', title: 'Nunca Es Suficiente' }, http, ctx)).toMatchObject({ status: 'found', genres: ['Cumbia', 'Vallenato', 'Latin'] });
    expect(seen).toEqual(['https://api.discogs.com/masters/2422489']);
    expect(await discogsAlbum.lookup({ artist: 'Los Ángeles Azules', title: 'Otra Canción' }, http, ctx)).toMatchObject({ status: 'none' });
    expect(await discogsAlbum.lookup({ artist: 'x', title: 'y' }, http, { outcome: async () => undefined })).toMatchObject({ status: 'none', reason: 'no Discogs master linked from the MusicBrainz album' });
    expect(seen).toHaveLength(1); // the same master was asked once
  });
});

describe('iTunes album and artist, TheAudioDB artist', () => {
  it("one lookup for the album and the artist; the song's own single is no album", async () => {
    const search = {
      results: [{ artistName: 'Girl Ultra & Little Jesus', trackName: 'Punk', collectionName: 'Punk - Single', primaryGenreName: 'Alternative', artistId: 1207957662, collectionId: 1604870494, trackTimeMillis: 200000 }],
    };
    const lookup = {
      results: [
        { wrapperType: 'collection', collectionId: 1604870494, collectionName: 'Punk - Single', primaryGenreName: 'Alternative' },
        { wrapperType: 'artist', artistId: 1207957662, artistName: 'Girl Ultra', primaryGenreName: 'Alternative' },
      ],
    };
    const seen: string[] = [];
    const http = client((url) => (url.includes('/lookup') ? lookup : search), seen);
    const song = { artist: 'Girl Ultra & Little Jesus', title: 'Punk' };
    expect(await itunesAlbum.lookup(song, http)).toMatchObject({ status: 'none', reason: "the release is the song's single" });
    expect(await itunesArtist.lookup(song, http)).toMatchObject({ status: 'found', genres: ['Alternative'] });
    expect(seen).toHaveLength(2); // the search and the lookup, each sent once for both sources
    expect(isSingleOf('Punk', 'Punk - Single')).toBe(true);
    expect(isSingleOf('Punk', 'EL SUR')).toBe(false);
  });

  it('TheAudioDB artist: genre then style, only for the same name', async () => {
    const body = { artists: [{ idArtist: '184561', strArtist: 'Girl Ultra', strGenre: 'R&B', strStyle: 'Rock/Pop' }] };
    const http = client(() => body);
    expect(parseAdbArtists(body)[0]).toMatchObject({ genre: 'R&B', style: 'Rock/Pop' });
    expect(await theaudiodbArtist.lookup({ artist: 'Girl Ultra & Little Jesus', title: 'Punk' }, http)).toMatchObject({ status: 'found', genres: ['R&B', 'Rock/Pop'] });
    expect(await theaudiodbArtist.lookup({ artist: 'Ultra', title: 'Punk' }, http)).toMatchObject({ status: 'none' });
  });
});

describe('Wikipedia and Wikidata for the album and artist', () => {
  it('article title forms', () => {
    expect(albumForms('Hasta la Raíz', 'Natalia Lafourcade')).toEqual(['Hasta la Raíz (Natalia Lafourcade album)', 'Hasta la Raíz (Natalia Lafourcade EP)', 'Hasta la Raíz (album)', 'Hasta la Raíz (EP)', 'Hasta la Raíz']);
    expect(artistForms('Girl Ultra & Little Jesus')[0]).toBe('Girl Ultra (band)');
  });

  it("a song article about another artist's version is not this song (the first-billed artist must be credited)", () => {
    expect(leadCredited('Los Ángeles Azules & Natalia Lafourcade', ['Natalia Lafourcade'])).toBe(false);
    expect(leadCredited('Los Ángeles Azules & Natalia Lafourcade', ['Los Ángeles Azules', 'Natalia Lafourcade'])).toBe(true);
    expect(leadCredited('Mark Ronson ft. Bruno Mars', ['Mark Ronson'])).toBe(true);
    expect(leadCredited('Earth, Wind & Fire', ['Earth, Wind & Fire'])).toBe(true);
  });

  it("Wikidata: an item's genres, through the MusicBrainz link", async () => {
    const http = client((url) =>
      url.includes('sitelinks')
        ? { entities: { Q5981294: { claims: { P136: [{ mainsnak: { datavalue: { value: { id: 'Q723418' } } }, rank: 'normal' }] }, sitelinks: { enwiki: { title: 'Los Ángeles Azules' } } } } }
        : { entities: { Q723418: { labels: { en: { value: 'cumbia' } } } } },
    );
    const ctx = { outcome: async (id: string) => (id === 'musicbrainz-artist' ? { status: 'found' as const, at: 'x', genres: ['cumbia'], links: { wikidata: 'Q5981294' } } : undefined) };
    expect(await wikidataArtist.lookup({ artist: 'Los Ángeles Azules', title: 'x' }, http, ctx)).toEqual({ status: 'found', genres: ['cumbia'], ref: 'Q5981294' });
    expect(await wikidataArtist.lookup({ artist: 'x', title: 'y' }, http, { outcome: async () => undefined })).toMatchObject({ status: 'none' });
  });
});
