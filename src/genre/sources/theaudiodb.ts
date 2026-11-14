/**
 * TheAudioDB (public free key): a track's `strGenre`, plus `strMood` kept as
 * a mood. One request: `searchtrack.php?s=<artist>&t=<title>`. A track
 * counts when its artist and title match and neither it nor its album names
 * a version the request did not ask for; the closest in length wins.
 */
import { creditMatches, lengthGap, primaryArtist, queryTitle, titleMatches, unaskedVersion, type SongQuery } from '../match';
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
  group: 'theaudiodb',
  weight: 0.7,
  async lookup(song, http): Promise<SourceAnswer> {
    const matches = matchTracks(song, parseTracks(await http.getJson(trackUrl(song))));
    const best = matches.find((t) => t.genre) ?? matches[0];
    if (!best) return { status: 'none', reason: 'no track by this artist with this title' };
    const moods = [...new Set(matches.map((t) => t.mood).filter(Boolean))];
    if (!best.genre) return { status: 'none', reason: 'the track has no genre', ref: `track/${best.id}` };
    return { status: 'found', genres: [best.genre], ...(moods.length ? { moods } : {}), ref: `track/${best.id}` };
  },
};
