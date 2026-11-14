import { describe, expect, it } from 'vitest';
import { notLikeUs, theBox } from '../../src/ui/catalog.fixtures';
import { lookupOfficial } from './itunes';

const artistSearch = { results: [{ wrapperType: 'artist', artistId: 1212442072, artistName: 'Roddy Ricch' }] };
const artistSongs = {
  results: [
    { wrapperType: 'artist', artistId: 1212442072, artistName: 'Roddy Ricch' },
    { wrapperType: 'track', kind: 'song', trackId: 1490463329, artistName: 'Roddy Ricch', trackName: 'The Box', collectionName: 'Please Excuse Me for Being Antisocial', trackTimeMillis: 196653, releaseDate: '2019-12-06T12:00:00Z', trackExplicitness: 'explicit', primaryGenreName: 'Hip-Hop/Rap' },
  ],
};

/** Answers by URL: the iTunes search, Deezer's search, Apple's artist search and artist song list. */
function fake(answers: { itunes: unknown; deezer: unknown; artist?: unknown; songs?: unknown }) {
  const urls: string[] = [];
  const fetchFn = async (u: string) => {
    urls.push(u);
    const body = u.includes('api.deezer.com')
      ? answers.deezer
      : u.includes('/lookup')
        ? answers.songs
        : u.includes('entity=musicArtist')
          ? answers.artist
          : answers.itunes;
    return { ok: body !== undefined, json: async () => body };
  };
  return { fetchFn, urls };
}

describe('lookupOfficial with the second catalog', () => {
  it('iTunes search first: a match there needs nothing else', async () => {
    const f = fake({ itunes: notLikeUs.itunes, deezer: notLikeUs.deezer });
    expect(await lookupOfficial({ artist: 'Kendrick Lamar', title: 'Not Like Us' }, f.fetchFn)).toMatchObject({ durationSec: 274, genre: 'Hip-Hop/Rap' });
    expect(f.urls).toHaveLength(1);
  });
  it('a song the iTunes search lacks: names and length from Deezer, the genre from Apple’s song list of the artist', async () => {
    const f = fake({ itunes: theBox.itunes, deezer: theBox.deezer, artist: artistSearch, songs: artistSongs });
    expect(await lookupOfficial({ artist: 'Roddy Ricch', title: 'The Box' }, f.fetchFn)).toEqual({ artist: 'Roddy Ricch', title: 'The Box', durationSec: 196, genre: 'Hip-Hop/Rap' });
    expect(f.urls[1]).toBe('https://api.deezer.com/search?q=Roddy+Ricch+The+Box&limit=25');
  });
  it('Deezer unreachable: Apple’s song list of the artist alone; nothing anywhere: null', async () => {
    const f = fake({ itunes: theBox.itunes, deezer: undefined, artist: artistSearch, songs: artistSongs });
    expect(await lookupOfficial({ artist: 'Roddy Ricch', title: 'The Box' }, f.fetchFn)).toMatchObject({ title: 'The Box', durationSec: 197, genre: 'Hip-Hop/Rap' });
    const none = fake({ itunes: theBox.itunes, deezer: { data: [] }, artist: { results: [] } });
    expect(await lookupOfficial({ artist: 'Roddy Ricch', title: 'The Box' }, none.fetchFn)).toBeNull();
  });
});
