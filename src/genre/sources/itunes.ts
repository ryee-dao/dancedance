/**
 * iTunes Search API, at three levels.
 *
 * Song (`itunes`): the store's `primaryGenreName` for the track. A broad,
 * often album-level label, so it counts least. When the song already has a
 * stored iTunes genre (`itunesGenre`), that is used and nothing is asked.
 *
 * Album (`itunes-album`) and artist (`itunes-artist`): the same track's
 * album (collection) and artist, looked up by id in one request
 * (`lookup?id=<collection>,<artist>`), each with its own primaryGenreName.
 * When the "album" is the song's own single ("Punk - Single"), it is the
 * song, not an album: no album answer.
 */
import { creditMatches, isSingleOf, lengthGap, queryTitle, releaseBase, titleMatches, unaskedVersion, type SongQuery } from '../match';
import type { GenreSource, PoliteHttp, SourceAnswer } from '../types';

export function searchUrl(song: SongQuery): string {
  const q = new URLSearchParams({ term: `${song.artist} ${queryTitle(song.title)}`, entity: 'song', limit: '25' });
  return `https://itunes.apple.com/search?${q}`;
}

export function lookupUrl(ids: number[]): string {
  return `https://itunes.apple.com/lookup?${new URLSearchParams({ id: ids.join(',') })}`;
}

export interface StoreTrack {
  artist: string;
  track: string;
  album: string;
  genre: string;
  lengthSec: number | null;
  artistId: number | null;
  collectionId: number | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

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
        artistId: num(r.artistId),
        collectionId: num(r.collectionId),
      };
    })
    .filter((t) => t.artist && t.track);
}

/** Matching tracks, closest in length first; the requested album's first when it is known. */
export function matchTracks(song: SongQuery, tracks: StoreTrack[]): StoreTrack[] {
  const want = song.album ? releaseBase(song.album) : '';
  const onAlbum = (t: StoreTrack) => (want && titleMatches(want, releaseBase(t.album)) ? 0 : 1);
  return tracks
    .filter((t) => titleMatches(song.title, t.track) && creditMatches(song.artist, [t.artist], t.artist) && !unaskedVersion(song, t.track, t.album))
    .sort((a, b) => onAlbum(a) - onAlbum(b) || (lengthGap(song, a.lengthSec) ?? 999) - (lengthGap(song, b.lengthSec) ?? 999));
}

export const itunes: GenreSource = {
  id: 'itunes',
  level: 'song',
  group: 'itunes',
  weight: 0.6,
  artistTwin: 'itunes-artist',
  async lookup(song, http): Promise<SourceAnswer> {
    if (song.itunesGenre?.trim()) return { status: 'found', genres: [song.itunesGenre.trim()], ref: 'stored' };
    const best = matchTracks(song, parseTracks(await http.getJson(searchUrl(song)))).find((t) => t.genre);
    return best ? { status: 'found', genres: [best.genre], ref: `${best.artist} - ${best.track} (${best.album})` } : { status: 'none', reason: 'no matching track' };
  },
};

interface StoreEntity {
  wrapperType: string;
  id: number | null;
  name: string;
  genre: string;
}

export function parseLookup(json: unknown): StoreEntity[] {
  const list = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const wrapperType = typeof r.wrapperType === 'string' ? r.wrapperType : '';
    return {
      wrapperType,
      id: wrapperType === 'artist' ? num(r.artistId) : num(r.collectionId),
      name: String((wrapperType === 'artist' ? r.artistName : r.collectionName) ?? ''),
      genre: typeof r.primaryGenreName === 'string' ? r.primaryGenreName.trim() : '',
    };
  });
}

/** The matched track's album and artist entries (one request; both sources ask the same URL, sent once). */
async function albumAndArtist(song: SongQuery, http: PoliteHttp): Promise<{ track: StoreTrack | null; album: StoreEntity | null; artist: StoreEntity | null }> {
  const track = matchTracks(song, parseTracks(await http.getJson(searchUrl(song))))[0] ?? null;
  if (!track) return { track, album: null, artist: null };
  const ids = [track.collectionId, track.artistId].filter((x): x is number => x !== null);
  if (!ids.length) return { track, album: null, artist: null };
  const ents = parseLookup(await http.getJson(lookupUrl(ids)));
  return {
    track,
    album: ents.find((e) => e.wrapperType === 'collection' && e.id === track.collectionId) ?? null,
    artist: ents.find((e) => e.wrapperType === 'artist' && e.id === track.artistId) ?? null,
  };
}

export const itunesAlbum: GenreSource = {
  id: 'itunes-album',
  level: 'album',
  group: 'itunes',
  weight: 0.6,
  artistTwin: 'itunes-artist',
  async lookup(song, http): Promise<SourceAnswer> {
    const { track, album } = await albumAndArtist(song, http);
    if (!track) return { status: 'none', reason: 'no matching track' };
    const links = { album: track.album };
    if (isSingleOf(song.title, track.album)) return { status: 'none', reason: 'the release is the song\'s single', ref: track.album, links };
    if (!album?.genre) return { status: 'none', reason: 'the album has no genre', ref: track.album, links };
    return { status: 'found', genres: [album.genre], ref: `collection/${album.id} (${album.name})`, links };
  },
};

export const itunesArtist: GenreSource = {
  id: 'itunes-artist',
  level: 'artist',
  group: 'itunes',
  weight: 0.6,
  async lookup(song, http): Promise<SourceAnswer> {
    const { track, artist } = await albumAndArtist(song, http);
    if (!track) return { status: 'none', reason: 'no matching track' };
    if (!artist?.genre) return { status: 'none', reason: 'the artist has no genre' };
    return { status: 'found', genres: [artist.genre], ref: `artist/${artist.id} (${artist.name})` };
  },
};
