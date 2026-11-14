/**
 * iTunes Search API: the store's `primaryGenreName` for the track. A broad,
 * often album-level label, so it counts least. When the song already has a
 * stored iTunes genre (`itunesGenre`), that is used and nothing is asked.
 */
import { creditMatches, lengthGap, queryTitle, titleMatches, unaskedVersion, type SongQuery } from '../match';
import type { GenreSource, SourceAnswer } from '../types';

export function searchUrl(song: SongQuery): string {
  const q = new URLSearchParams({ term: `${song.artist} ${queryTitle(song.title)}`, entity: 'song', limit: '25' });
  return `https://itunes.apple.com/search?${q}`;
}

export interface StoreTrack {
  artist: string;
  track: string;
  album: string;
  genre: string;
  lengthSec: number | null;
}

export function parseTracks(json: unknown): StoreTrack[] {
  const list = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      return {
        artist: typeof r.artistName === 'string' ? r.artistName : '',
        track: typeof r.trackName === 'string' ? r.trackName : '',
        album: typeof r.collectionName === 'string' ? r.collectionName : '',
        genre: typeof r.primaryGenreName === 'string' ? r.primaryGenreName.trim() : '',
        lengthSec: typeof r.trackTimeMillis === 'number' && r.trackTimeMillis > 0 ? Math.round(r.trackTimeMillis / 1000) : null,
      };
    })
    .filter((t) => t.artist && t.track);
}

/** Matching tracks, closest in length first. */
export function matchTracks(song: SongQuery, tracks: StoreTrack[]): StoreTrack[] {
  return tracks
    .filter((t) => titleMatches(song.title, t.track) && creditMatches(song.artist, [t.artist], t.artist) && !unaskedVersion(song, t.track, t.album))
    .sort((a, b) => (lengthGap(song, a.lengthSec) ?? 999) - (lengthGap(song, b.lengthSec) ?? 999));
}

export const itunes: GenreSource = {
  id: 'itunes',
  group: 'itunes',
  weight: 0.6,
  async lookup(song, http): Promise<SourceAnswer> {
    if (song.itunesGenre?.trim()) return { status: 'found', genres: [song.itunesGenre.trim()], ref: 'stored' };
    const best = matchTracks(song, parseTracks(await http.getJson(searchUrl(song)))).find((t) => t.genre);
    return best ? { status: 'found', genres: [best.genre], ref: `${best.artist} - ${best.track} (${best.album})` } : { status: 'none', reason: 'no matching track' };
  },
};
