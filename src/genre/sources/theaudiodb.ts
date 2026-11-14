/**
 * TheAudioDB (public free key): a track's `strGenre`, plus `strMood` kept as
 * a mood. One request: `searchtrack.php?s=<artist>&t=<title>`. A track
 * counts when its artist and title match and neither it nor its album names
 * a version the request did not ask for; the closest in length wins.
 */
import { artistNameMatches, creditMatches, leadArtist, lengthGap, primaryArtist, queryTitle, titleMatches, unaskedVersion, type SongQuery } from '../match';
import type { GenreSource, SourceAnswer } from '../types';

/** TheAudioDB's documented public test key (no account). */
const KEY = '123';

export function trackUrl(song: SongQuery): string {
  return `https://www.theaudiodb.com/api/v1/json/${KEY}/searchtrack.php?${new URLSearchParams({ s: primaryArtist(song.artist), t: queryTitle(song.title) })}`;
}

export interface AudioDbTrack {
  id: string;
  track: string;
  artist: string;
  album: string;
  genre: string;
  mood: string;
  lengthSec: number | null;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function parseTracks(json: unknown): AudioDbTrack[] {
  const list = (json as { track?: unknown } | null)?.track;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const t = (raw ?? {}) as Record<string, unknown>;
    const ms = Number(t.intDuration);
    return {
      id: str(t.idTrack),
      track: str(t.strTrack),
      artist: str(t.strArtist),
      album: str(t.strAlbum),
      genre: str(t.strGenre),
      mood: str(t.strMood),
      lengthSec: Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null,
    };
  });
}

export function matchTracks(song: SongQuery, tracks: AudioDbTrack[]): AudioDbTrack[] {
  return tracks
    .filter((t) => titleMatches(song.title, t.track) && creditMatches(song.artist, [t.artist], t.artist) && !unaskedVersion(song, t.track, t.album))
    .sort((a, b) => (lengthGap(song, a.lengthSec) ?? 999) - (lengthGap(song, b.lengthSec) ?? 999));
}

export const theaudiodb: GenreSource = {
  id: 'theaudiodb',
  level: 'song',
  group: 'theaudiodb',
  weight: 0.7,
  artistTwin: 'theaudiodb-artist',
  async lookup(song, http): Promise<SourceAnswer> {
    const matches = matchTracks(song, parseTracks(await http.getJson(trackUrl(song))));
    const best = matches.find((t) => t.genre) ?? matches[0];
    if (!best) return { status: 'none', reason: 'no track by this artist with this title' };
    const moods = [...new Set(matches.map((t) => t.mood).filter(Boolean))];
    if (!best.genre) return { status: 'none', reason: 'the track has no genre', ref: `track/${best.id}` };
    return { status: 'found', genres: [best.genre], ...(moods.length ? { moods } : {}), ref: `track/${best.id}` };
  },
};

export function artistUrl(name: string): string {
  return `https://www.theaudiodb.com/api/v1/json/${KEY}/search.php?${new URLSearchParams({ s: name })}`;
}

export interface AudioDbArtist {
  id: string;
  name: string;
  genre: string;
  style: string;
}

export function parseArtists(json: unknown): AudioDbArtist[] {
  const list = (json as { artists?: unknown } | null)?.artists;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const a = (raw ?? {}) as Record<string, unknown>;
    return { id: str(a.idArtist), name: str(a.strArtist), genre: str(a.strGenre), style: str(a.strStyle) };
  });
}

/**
 * TheAudioDB artist (`search.php?s=<artist>`): its genre and, after it, its
 * broader style ("Rock/Pop"). Only an artist whose name is the requested one.
 */
export const theaudiodbArtist: GenreSource = {
  id: 'theaudiodb-artist',
  level: 'artist',
  group: 'theaudiodb',
  weight: 0.7,
  async lookup(song, http): Promise<SourceAnswer> {
    const a = parseArtists(await http.getJson(artistUrl(leadArtist(song.artist)))).find((x) => artistNameMatches(song.artist, x.name));
    if (!a) return { status: 'none', reason: 'no artist of this name' };
    const genres = [a.genre, a.style].filter(Boolean);
    return genres.length ? { status: 'found', genres, ref: `artist/${a.id}` } : { status: 'none', reason: 'the artist has no genre', ref: `artist/${a.id}` };
  },
};
