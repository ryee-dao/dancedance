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
    const message = (v as { message?: unknown }).message;
    out[id] = typeof message === 'string' ? { state, message: message.slice(0, 300) } : { state };
  }
  return out;
}

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

/** User-facing sentence for a non-ok status, or null. */
export function describeCloudStatus(s: CloudStatus | null): string | null {
  if (!s || s.state === 'ok') return null;
  if (s.state === 'blocked') return 'Cloud beat analysis was blocked by YouTube for this song.';
  return 'Cloud beat analysis failed for this song.';
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
  /** 'music-video': no lyric/audio upload passed, so the official music video was used. */
  note?: 'music-video';
}

/**
 * A request the job could not complete (songs-status.json). Requests that
 * succeeded are removed from that file; their song is in songs.json.
 *   'not-found' - no suitable, embeddable YouTube video (final until asked again)
 *   'blocked'   - YouTube refused the runner; later runs retry automatically
 *   'error'     - something else went wrong; later runs retry automatically
 */
export interface SongRequestStatus {
  state: 'not-found' | 'blocked' | 'error';
  artist: string;
  title: string;
  /** Official length that was requested (lets later runs retry on their own). */
  durationSec?: number;
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
    const durationSec = typeof s.durationSec === 'number' && Number.isFinite(s.durationSec) ? Math.round(s.durationSec) : 0;
    out.push({
      videoId: s.videoId,
      title: s.title.slice(0, 200),
      artist: s.artist.slice(0, 200),
      addedAt: typeof s.addedAt === 'string' ? s.addedAt : '',
      durationSec,
      ...(s.note === 'music-video' ? { note: 'music-video' as const } : {}),
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
    if (r.state !== 'not-found' && r.state !== 'blocked' && r.state !== 'error') continue;
    if (typeof r.artist !== 'string' || typeof r.title !== 'string') continue;
    out[key] = {
      state: r.state,
      artist: r.artist.slice(0, 200),
      title: r.title.slice(0, 200),
      ...(typeof r.durationSec === 'number' && Number.isFinite(r.durationSec) ? { durationSec: Math.round(r.durationSec) } : {}),
      ...(typeof r.message === 'string' ? { message: r.message.slice(0, 300) } : {}),
      attempts: typeof r.attempts === 'number' && r.attempts >= 0 ? Math.floor(r.attempts) : 0,
      lastTried: typeof r.lastTried === 'string' ? r.lastTried : '',
    };
  }
  return out;
}
