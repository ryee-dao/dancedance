/**
 * Known tempos for song tiles ("124 BPM" badges): from beat maps cached on
 * this device (remembered in the store when cached), else from the cloud
 * index `<base>beatmaps/index.json`, whose optional `songs` field is
 * `{ [videoId]: { bpm, duration, genre?, genres?, genreLevels?, artistGenres? } }`. The index is fetched once per app open.
 *
 * `bpmEvents` fires 'change' when either source learns something new.
 */
import { store } from '../store';
import { absoluteBase, cleanGenreLevels, cleanGenreList, type FetchLike, type GenreLevelName } from './cloud';

export interface IndexSong {
  bpm: number;
  duration: number;
  /** iTunes primary genre (songs added by search), when known. */
  genre?: string;
  /** Multi-source genres of the song (src/genre), best first, when looked up. */
  genres?: string[];
  /** Level of each `genres` entry ('song' / 'album'). */
  genreLevels?: GenreLevelName[];
  /** The artist's usual genres: weak evidence, kept apart from `genres`. */
  artistGenres?: string[];
}

export const bpmEvents = new EventTarget();

let cloudSongs: Record<string, IndexSong> = {};
let indexP: Promise<void> | null = null;

/** Parse index.json's `songs`; tolerates its absence and bad entries. */
export function parseIndexSongs(text: string): Record<string, IndexSong> {
  const out: Record<string, IndexSong> = {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return out;
  }
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!songs || typeof songs !== 'object' || Array.isArray(songs)) return out;
  for (const [id, v] of Object.entries(songs as Record<string, unknown>)) {
    const bpm = (v as { bpm?: unknown } | null)?.bpm;
    const duration = (v as { duration?: unknown } | null)?.duration;
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0 || bpm > 1000) continue;
    const genre = (v as { genre?: unknown }).genre;
    const genres = cleanGenreList((v as { genres?: unknown }).genres);
    const genreLevels = cleanGenreLevels((v as { genreLevels?: unknown }).genreLevels, genres);
    const artistGenres = cleanGenreList((v as { artistGenres?: unknown }).artistGenres);
    out[id] = {
      bpm,
      duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : 0,
      ...(typeof genre === 'string' && genre.trim() ? { genre: genre.trim().slice(0, 60) } : {}),
      ...(genres ? { genres } : {}),
      ...(genreLevels ? { genreLevels } : {}),
      ...(artistGenres ? { artistGenres } : {}),
    };
  }
  return out;
}

/** Retries of a cloud index that could not be read at app open: after INDEX_RETRY_MS, doubling, at most INDEX_RETRIES times. */
export const INDEX_RETRY_MS = 30_000;
export const INDEX_RETRIES = 6;
let indexRetries = 0;

/**
 * Fetch the cloud index once per app open. Never rejects. When it can't be read (offline at start-up, a hosting
 * hiccup), it is asked again in the background (INDEX_RETRY_MS, doubling): the index carries every published song's
 * tempo and genres, and without it they would be danced without genres for the whole session.
 */
export function loadCloudIndex(base: string, fetchFn: FetchLike = (u, i) => fetch(u, i), retry = typeof window !== 'undefined'): Promise<void> {
  if (!indexP) {
    const url = new URL('beatmaps/index.json', absoluteBase(base)).href;
    indexP = fetchFn(url, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        const songs = text ? parseIndexSongs(text) : {};
        if (Object.keys(songs).length) {
          cloudSongs = songs;
          bpmEvents.dispatchEvent(new Event('change'));
          return true;
        }
        return false;
      })
      .catch(() => false)
      .then((ok) => {
        if (ok || !retry || indexRetries >= INDEX_RETRIES || Object.keys(cloudSongs).length) return;
        const wait = INDEX_RETRY_MS * 2 ** indexRetries++;
        setTimeout(() => {
          if (Object.keys(cloudSongs).length) return;
          indexP = null;
          void loadCloudIndex(base, fetchFn, retry);
        }, wait);
      });
  }
  return indexP;
}

/**
 * Fetch the index again (a song was just added by search). The query string
 * gets past the Pages CDN cache. Never rejects.
 */
export function reloadCloudIndex(base: string, fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<void> {
  const url = new URL('beatmaps/index.json', absoluteBase(base));
  url.searchParams.set('t', String(Date.now()));
  indexP = fetchFn(url.href, { cache: 'no-store' })
    .then((res) => (res.ok ? res.text() : ''))
    .then((text) => {
      const songs = text ? parseIndexSongs(text) : {};
      if (Object.keys(songs).length) {
        cloudSongs = songs;
        bpmEvents.dispatchEvent(new Event('change'));
      }
    })
    .catch(() => {});
  return indexP;
}

/** Rounded tempo for a song, or null when unknown. */
export function knownBpm(videoId: string): number | null {
  const bpm = store.localBpm(videoId) ?? cloudSongs[videoId]?.bpm ?? null;
  return bpm && bpm > 0 ? Math.round(bpm) : null;
}

/** The cloud index's genre for a song (songs added by search), when known. */
export function cloudGenre(videoId: string): string | undefined {
  return cloudSongs[videoId]?.genre;
}

/** The cloud index's multi-source genres for a song (catalog and starter songs), when known. */
export function cloudGenres(videoId: string): string[] | undefined {
  return cloudSongs[videoId]?.genres;
}

/** The cloud index's artist-level genres for a song (weak evidence), when known. */
export function cloudArtistGenres(videoId: string): string[] | undefined {
  return cloudSongs[videoId]?.artistGenres;
}

/** The cloud index's level of each `genres` entry, when known. */
export function cloudGenreLevels(videoId: string): GenreLevelName[] | undefined {
  return cloudSongs[videoId]?.genreLevels;
}

/** Called by the beat-map cache after storing a map. */
export function noteCachedBpm(key: string, bpm: number): void {
  if (!(bpm > 0)) return;
  const before = knownBpm(key);
  store.setLocalBpm(key, bpm);
  if (knownBpm(key) !== before) bpmEvents.dispatchEvent(new Event('change'));
}
