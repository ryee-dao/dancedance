/**
 * Cloud beat maps published with the site: `<base>/beatmaps/<videoId>.json`
 * and `<base>/beatmaps/status.json`.
 *
 * `base` comes from the platform (`./` on web, the GitHub Pages URL on
 * Android TV). Missing files are normal (404, or the dev server's HTML
 * fallback) and resolve to null; nothing here ever rejects.
 */
import { parse, type BeatMap } from '../core/analysis';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

export interface CloudStatus {
  state: 'ok' | 'blocked' | 'error';
  /** Why (tools/beatmaps/select.ts StatusReason), e.g. 'withheld', 'unavailable'. */
  reason?: string;
  message?: string;
}

/** Resolve `base` (absolute or relative to the page) to an absolute directory URL. */
export function absoluteBase(base: string, pageUrl?: string): string {
  const page = pageUrl ?? (typeof location !== 'undefined' ? location.href : 'http://localhost/');
  const b = base.endsWith('/') ? base : `${base}/`;
  return new URL(b, page).href;
}

export function beatmapUrl(base: string, videoId: string, pageUrl?: string): string {
  return new URL(`beatmaps/${encodeURIComponent(videoId)}.json`, absoluteBase(base, pageUrl)).href;
}

export function statusUrl(base: string, pageUrl?: string): string {
  return new URL('beatmaps/status.json', absoluteBase(base, pageUrl)).href;
}

async function fetchText(fetchFn: FetchLike, url: string, timeoutMs: number): Promise<string | null> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(url, { cache: 'no-cache', signal: ctl?.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** The cloud map for a video, or null (missing, malformed, wrong video, network error). */
export async function fetchCloudMap(
  base: string,
  videoId: string,
  fetchFn: FetchLike = defaultFetch(),
  timeoutMs = 10000,
): Promise<BeatMap | null> {
  const text = await fetchText(fetchFn, beatmapUrl(base, videoId), timeoutMs);
  if (text === null) return null;
  try {
    const map = parse(text);
    if (map.videoId && map.videoId !== videoId) return null;
    return { ...map, videoId, source: 'cloud' };
  } catch {
    return null; // e.g. the dev server's index.html fallback
  }
}

/** Parse status.json; unknown shapes yield an empty record. */
export function parseStatus(text: string): Record<string, CloudStatus> {
  const out: Record<string, CloudStatus> = {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return out;
  }
  const videos = (data as { videos?: unknown } | null)?.videos;
  if (!videos || typeof videos !== 'object' || Array.isArray(videos)) return out;
  for (const [id, v] of Object.entries(videos as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const state = (v as { state?: unknown }).state;
    if (state !== 'ok' && state !== 'blocked' && state !== 'error') continue;
    const { message, reason } = v as { message?: unknown; reason?: unknown };
    out[id] = {
      state,
      ...(typeof reason === 'string' && /^[a-z-]{1,20}$/.test(reason) ? { reason } : {}),
      ...(typeof message === 'string' ? { message: message.slice(0, 300) } : {}),
    };
  }
  return out;
}

/** Reasons the cloud job won't try a song again by itself (removed, private, too long, live). */
const FINAL_REASONS = new Set(['unavailable', 'too-long', 'live', 'filtered']);

const statusCache = new Map<string, Promise<Record<string, CloudStatus>>>();

/** status.json entry for a video (fetched once per base per session), or null. */
export async function cloudStatus(
  base: string,
  videoId: string,
  fetchFn: FetchLike = defaultFetch(),
): Promise<CloudStatus | null> {
  const url = statusUrl(base);
  let p = statusCache.get(url);
  if (!p) {
    p = fetchText(fetchFn, url, 10000).then((t) => (t === null ? {} : parseStatus(t)));
    statusCache.set(url, p);
  }
  return (await p)[videoId] ?? null;
}

/**
 * User-facing sentence for a non-ok status (shown while the song has no full
 * map), or null. Calm and without technical words: the song plays either way,
 * and the cloud job retries most failures by itself.
 */
export function describeCloudStatus(s: CloudStatus | null): string | null {
  if (!s || s.state === 'ok') return null;
  if (s.state === 'error' && s.reason && FINAL_REASONS.has(s.reason)) return 'There’s no ready-made beat map for this song, so the coach finds the beat by listening.';
  return 'The coach finds the beat by listening for now. A better beat map is being prepared and will arrive on its own.';
}

function defaultFetch(): FetchLike {
  return (url, init) => fetch(url, init);
}

// ---------------------------------------------------------------------------
// Songs added by search: `<base>songs.json` and `<base>songs-status.json`,
// written by the beat-map job (tools/beatmaps) and read by the app. The key
// helpers live here so the Node tool and the browser agree byte for byte.

/** One song in songs.json. `artist`/`title` are the requested (iTunes) names. */
export interface AddedSong {
  videoId: string;
  title: string;
  artist: string;
  /** ISO timestamp. */
  addedAt: string;
  /** Official length the video was matched against. */
  durationSec: number;
  /**
   * Whether `beatmaps/<videoId>.json` exists. A song is listed as soon as its
   * video is picked; until a map exists (`false`) the app finds the beat by
   * listening. Older files have no field, which means true.
   */
  hasMap?: boolean;
  /** 'music-video': no lyric/audio upload passed, so the official music video was used. */
  note?: 'music-video';
  /** iTunes primary genre ("Pop", "Latin", ...), when the cloud job learned it. */
  genre?: string;
  /**
   * Genres of this song gathered from several public sources and combined by
   * agreement (src/genre), best first, at most about 6: ["nu metal", "rap rock", ...].
   * Absent until looked up (or when no source could confirm the song).
   */
  genres?: string[];
  /** Which level each `genres` entry came from ('song' or 'album'; same order). Absent in older files. */
  genreLevels?: GenreLevelName[];
  /**
   * The artist's usual genres (src/genre artist-level sources), best first: weak
   * evidence about the song, kept apart from `genres`. Absent until looked up.
   */
  artistGenres?: string[];
}

export type GenreLevelName = 'song' | 'album' | 'artist';

/** A stored `genreLevels` list: valid only when it has one known level per entry of `genres`. */
export function cleanGenreLevels(v: unknown, genres: readonly string[] | undefined): GenreLevelName[] | undefined {
  if (!Array.isArray(v) || !genres?.length || v.length !== genres.length) return undefined;
  return v.every((x) => x === 'song' || x === 'album' || x === 'artist') ? (v as GenreLevelName[]) : undefined;
}

/** A stored `genres` list, cleaned: strings only, trimmed, at most 60 characters each and 8 in all; undefined when empty. */
export function cleanGenreList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const g of v) {
    if (typeof g !== 'string') continue;
    const t = g.replace(/\s+/g, ' ').trim();
    if (t && t.length <= 60 && !/[\u0000-\u001f]/.test(t) && !out.includes(t)) out.push(t);
    if (out.length >= 8) break;
  }
  return out.length ? out : undefined;
}

/**
 * A request the job could not complete (songs-status.json). Requests that
 * succeeded are removed from that file; their song is in songs.json.
 *   'not-found' - no suitable, embeddable YouTube video (final until asked again)
 *   'blocked'   - YouTube refused the runner; later runs retry automatically
 *   'error'     - something else went wrong; later runs retry automatically
 *   'map-pending' - not a failure: the song is listed in songs.json (videoId)
 *                 but YouTube refused the cloud download, so it has no beat map
 *                 yet; removed once a map exists
 */
export interface SongRequestStatus {
  state: 'not-found' | 'blocked' | 'error' | 'map-pending';
  artist: string;
  title: string;
  /** Official length that was requested (lets later runs retry on their own). */
  durationSec?: number;
  /** 'map-pending': the listed video. */
  videoId?: string;
  message?: string;
  attempts: number;
  /** ISO timestamp. */
  lastTried: string;
}

/** Lowercase, accents and punctuation removed, single spaces (any script). */
export function normalizeName(s: string): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Request key for a song: "taylor swift - shake it off". Same in the app and the job. */
export function songKey(artist: string, title: string): string {
  return `${normalizeName(artist)} - ${normalizeName(title)}`;
}

export function songsUrl(base: string, pageUrl?: string): string {
  return new URL('songs.json', absoluteBase(base, pageUrl)).href;
}

export function songsStatusUrl(base: string, pageUrl?: string): string {
  return new URL('songs-status.json', absoluteBase(base, pageUrl)).href;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Parse songs.json; bad entries are dropped, unknown shapes yield []. */
export function parseSongsList(text: string): AddedSong[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!Array.isArray(songs)) return [];
  const out: AddedSong[] = [];
  const seen = new Set<string>();
  for (const raw of songs) {
    const s = (raw ?? {}) as Record<string, unknown>;
    if (typeof s.videoId !== 'string' || !VIDEO_ID.test(s.videoId) || seen.has(s.videoId)) continue;
    if (typeof s.title !== 'string' || !s.title.trim() || typeof s.artist !== 'string') continue;
    seen.add(s.videoId);
    const genres = cleanGenreList(s.genres);
    const genreLevels = cleanGenreLevels(s.genreLevels, genres);
    const artistGenres = cleanGenreList(s.artistGenres);
    const durationSec = typeof s.durationSec === 'number' && Number.isFinite(s.durationSec) ? Math.round(s.durationSec) : 0;
    out.push({
      videoId: s.videoId,
      title: s.title.slice(0, 200),
      artist: s.artist.slice(0, 200),
      addedAt: typeof s.addedAt === 'string' ? s.addedAt : '',
      durationSec,
      ...(s.hasMap === false ? { hasMap: false } : {}),
      ...(s.note === 'music-video' ? { note: 'music-video' as const } : {}),
      ...(typeof s.genre === 'string' && s.genre.trim() ? { genre: s.genre.trim().slice(0, 60) } : {}),
      ...(genres ? { genres } : {}),
      ...(genreLevels ? { genreLevels } : {}),
      ...(artistGenres ? { artistGenres } : {}),
    });
  }
  return out;
}

/** Parse songs-status.json's `requests`; unknown shapes yield {}. */
export function parseSongsStatus(text: string): Record<string, SongRequestStatus> {
  const out: Record<string, SongRequestStatus> = {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return out;
  }
  const reqs = (data as { requests?: unknown } | null)?.requests;
  if (!reqs || typeof reqs !== 'object' || Array.isArray(reqs)) return out;
  for (const [key, raw] of Object.entries(reqs as Record<string, unknown>)) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (r.state !== 'not-found' && r.state !== 'blocked' && r.state !== 'error' && r.state !== 'map-pending') continue;
    if (typeof r.artist !== 'string' || typeof r.title !== 'string') continue;
    out[key] = {
      state: r.state,
      artist: r.artist.slice(0, 200),
      title: r.title.slice(0, 200),
      ...(typeof r.durationSec === 'number' && Number.isFinite(r.durationSec) ? { durationSec: Math.round(r.durationSec) } : {}),
      ...(typeof r.videoId === 'string' && VIDEO_ID.test(r.videoId) ? { videoId: r.videoId } : {}),
      ...(typeof r.message === 'string' ? { message: r.message.slice(0, 300) } : {}),
      attempts: typeof r.attempts === 'number' && r.attempts >= 0 ? Math.floor(r.attempts) : 0,
      lastTried: typeof r.lastTried === 'string' ? r.lastTried : '',
    };
  }
  return out;
}
