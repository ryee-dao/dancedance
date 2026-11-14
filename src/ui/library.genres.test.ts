/** Genres a song is danced by when no published source has any: this device's own lookup of the played song. */
import { afterEach, describe, expect, it, vi } from 'vitest';

async function fresh() {
  const data = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) },
    addEventListener: () => {},
    dispatchEvent: () => true,
  });
  vi.resetModules();
  const store = (await import('../store')).store;
  const lib = await import('./library');
  return { store, ...lib };
}

afterEach(() => vi.unstubAllGlobals());

describe('songGenres & co. with this device\'s own lookup', () => {
  it('read a played song\'s stored lookup when no published source has genres for it', async () => {
    const { store, songGenres, songGenreLevels, songArtistGenres, songGenre, hasPublishedGenres } = await fresh();
    const id = 'AAAAAAAAAAA';
    expect(songGenres(id)).toBeUndefined();
    store.noteGenreSong(id, { artist: 'Pooh Shiesty', title: 'Back in Blood' });
    expect(songGenres(id)).toBeUndefined(); // noted, not looked up yet
    store.setGenreLookup(id, {
      genres: ['trap', 'drill', 'southern hip hop', 'hip hop'],
      genreLevels: ['song', 'song', 'album', 'song'],
      artistGenres: ['trap', 'southern hip hop'],
      sources: { itunes: { status: 'found', at: 'x', genres: ['Hip-Hop/Rap'] } },
      complete: true,
      at: 'x',
    });
    expect(songGenres(id)).toEqual(['trap', 'drill', 'southern hip hop', 'hip hop']);
    expect(songGenreLevels(id)).toEqual(['song', 'song', 'album', 'song']);
    expect(songArtistGenres(id)).toEqual(['trap', 'southern hip hop']);
    expect(songGenre(id)).toBe('Hip-Hop/Rap');
    expect(hasPublishedGenres(id)).toBe(false);
    // A malformed stored answer reads as nothing.
    store.setGenreLookup(id, { genres: 'trap' });
    expect(songGenres(id)).toBeUndefined();
  });
});
