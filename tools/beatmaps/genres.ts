/**
 * public/genres.json: the multi-source genre lookup (src/genre) of every
 * catalog song, kept for debugging ("which source said what") and as the
 * lookup cache. Pure: no I/O.
 *
 *   { updatedAt, songs: { [songKey]: { artist, title, videoIds, genres, moods?, complete, at,
 *                                      sources: { wikipedia: { status, at, genres? | reason, ref? }, ... } } } }
 *
 * Keys are songKey(artist, title), sorted. The combined `genres` list is
 * also written next to each song in songs.json and index.json (that is what
 * the app reads); this file is only for people and for later lookups.
 */
import { songKey, type AddedSong } from '../../src/beat/cloud';
import { lookupDue, parseGenreLookup, type GenreLookup, type SongQuery } from '../../src/genre';
import { renderStable, toJsonText } from './output';

export interface GenreRecord extends GenreLookup {
  artist: string;
  title: string;
  videoIds: string[];
}

/** A catalog song the lookup can ask about. */
export interface CatalogSong extends SongQuery {
  videoId: string;
  key: string;
  /** Listed in songs.json (else a starter-pack song, only in index.json). */
  added: boolean;
}

export function parseGenresFile(text: string | undefined): Record<string, GenreRecord> {
  const out: Record<string, GenreRecord> = {};
  if (!text) return out;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return out;
  }
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!songs || typeof songs !== 'object' || Array.isArray(songs)) return out;
  for (const [key, raw] of Object.entries(songs as Record<string, unknown>)) {
    const l = parseGenreLookup(raw);
    const r = (raw ?? {}) as { artist?: unknown; title?: unknown; videoIds?: unknown };
    if (!l || typeof r.artist !== 'string' || typeof r.title !== 'string') continue;
    const videoIds = Array.isArray(r.videoIds) ? r.videoIds.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{11}$/.test(x)) : [];
    out[key] = { artist: r.artist, title: r.title, videoIds, ...l };
  }
  return out;
}

function normRecord(r: GenreRecord): GenreRecord {
  return {
    artist: r.artist,
    title: r.title,
    videoIds: [...new Set(r.videoIds)].sort(),
    genres: r.genres,
    ...(r.moods?.length ? { moods: r.moods } : {}),
    complete: r.complete,
    at: r.at,
    sources: r.sources,
  };
}

export function renderGenresFile(prevText: string | undefined, records: Readonly<Record<string, GenreRecord>>, now: string): string {
  const songs: Record<string, GenreRecord> = {};
  for (const k of Object.keys(records).sort()) songs[k] = normRecord(records[k]);
  return renderStable(prevText, 'updatedAt', now, (updatedAt) => toJsonText({ updatedAt, songs }));
}

/**
 * Every catalog song: songs.json entries, then starter-pack songs (artist and
 * title from starter.json; their iTunes genre from index.json). One entry per
 * video; songs that share artist + title share a lookup.
 */
export function catalogSongs(
  songs: readonly AddedSong[],
  starter: readonly { videoId: string; artist?: string; title?: string }[],
  indexGenres: ReadonlyMap<string, string> = new Map(),
): CatalogSong[] {
  const out: CatalogSong[] = [];
  const seen = new Set<string>();
  for (const s of songs) {
    if (seen.has(s.videoId) || !s.artist || !s.title) continue;
    seen.add(s.videoId);
    out.push({ videoId: s.videoId, key: songKey(s.artist, s.title), artist: s.artist, title: s.title, ...(s.durationSec ? { durationSec: s.durationSec } : {}), ...(s.genre ? { itunesGenre: s.genre } : {}), added: true });
  }
  for (const s of starter) {
    if (seen.has(s.videoId) || !s.artist || !s.title) continue;
    seen.add(s.videoId);
    const g = indexGenres.get(s.videoId);
    out.push({ videoId: s.videoId, key: songKey(s.artist, s.title), artist: s.artist, title: s.title, ...(g ? { itunesGenre: g } : {}), added: false });
  }
  return out;
}

/** Catalog songs whose lookup is missing or due again, one per song key, at most `limit`. */
export function dueSongs(catalog: readonly CatalogSong[], records: Readonly<Record<string, GenreRecord>>, now: Date, limit = Infinity, failedRetryMs?: number): CatalogSong[] {
  const out: CatalogSong[] = [];
  const keys = new Set<string>();
  for (const c of catalog) {
    if (keys.has(c.key) || out.length >= limit) continue;
    if (!lookupDue(records[c.key], now, undefined, failedRetryMs)) continue;
    keys.add(c.key);
    out.push(c);
  }
  return out;
}

/** Store a lookup for a catalog song (keeps the other video IDs that share it). */
export function putRecord(records: Record<string, GenreRecord>, song: Pick<CatalogSong, 'key' | 'artist' | 'title' | 'videoId'>, lookup: GenreLookup): void {
  const prev = records[song.key];
  records[song.key] = { artist: song.artist, title: song.title, videoIds: [...new Set([...(prev?.videoIds ?? []), song.videoId])], ...lookup };
}

/** videoId -> combined genres, for every catalog song whose lookup found some. */
export function genreListsFor(catalog: readonly CatalogSong[], records: Readonly<Record<string, GenreRecord>>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of catalog) {
    const g = records[c.key]?.genres;
    if (g?.length) out.set(c.videoId, g);
  }
  return out;
}
