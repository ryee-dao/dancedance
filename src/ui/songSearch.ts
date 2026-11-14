/**
 * Song search for "Add a song": two song catalogs, asked at the same time,
 * one request each per search, only the search text sent.
 *
 *  - The iTunes Search API, called straight from the browser. It sends CORS
 *    headers (Access-Control-Allow-Origin: *), so a plain fetch works; if a
 *    browser still blocks it, the API's JSONP mode (`callback=`) is the
 *    fallback. Anonymous searches list only the clean versions of explicit
 *    songs (and nothing for songs without one).
 *  - Deezer's public search API (src/ui/deezer.ts), which lists the explicit
 *    versions. It sends no CORS headers, so it is read through its JSONP mode,
 *    inside a sandboxed frame with an opaque origin: Deezer's script cannot
 *    reach this page (its storage holds the GitHub token); only the parsed
 *    data comes back by postMessage.
 *
 * The lists are merged by src/ui/songMerge.ts. A source that says it is busy
 * (iTunes: 403/429/503; Deezer: its quota error) is left alone for a minute.
 * Nothing is cached or stored.
 */

import { normalizeName, songKey } from '../beat/cloud';
import { DeezerError, deezerUrl, parseDeezer, type DeezerTrack } from './deezer';
import { mergeCatalogs, versionCore } from './songMerge';

export interface SongHit {
  key: string;
  /** iTunes track ID; 0 when the song came only from Deezer (or its iTunes ID named a censored title). */
  trackId: number;
  artist: string;
  title: string;
  album: string;
  year: string;
  durationSec: number;
  /** 300x300 artwork (may be empty). */
  artworkUrl: string;
  /** iTunes primary genre, when listed. */
  genre?: string;
  /** iTunes: the clean version of an explicit song. */
  clean?: boolean;
  /** Absent = iTunes. */
  source?: 'itunes' | 'deezer';
}

export type SearchFailure = 'offline' | 'busy' | 'failed';

export class SongSearchError extends Error {
  constructor(readonly kind: SearchFailure) {
    super(kind);
    this.name = 'SongSearchError';
  }
}

export const ITUNES_SEARCH = 'https://itunes.apple.com/search';
export const RESULT_LIMIT = 12;
/** How long a source that said "too many requests" is left alone. */
export const BACKOFF_MS = 60_000;

export function itunesUrl(term: string, callback?: string): string {
  const q = new URLSearchParams({ term: term.trim(), entity: 'song', limit: String(RESULT_LIMIT) });
  if (callback) q.set('callback', callback);
  return `${ITUNES_SEARCH}?${q}`;
}

/**
 * Song results, one per song: the same artist + title within 2 s (album vs
 * deluxe edition) is shown once, the first (most relevant) one kept.
 */
export function parseItunesResults(json: unknown): SongHit[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: SongHit[] = [];
  for (const raw of results) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (r.kind !== undefined && r.kind !== 'song') continue;
    if (typeof r.artistName !== 'string' || typeof r.trackName !== 'string') continue;
    const ms = typeof r.trackTimeMillis === 'number' ? r.trackTimeMillis : 0;
    const durationSec = Math.round(ms / 1000);
    if (durationSec < 20 || durationSec > 15 * 60) continue; // the job only maps up to 15 min
    const key = songKey(r.artistName, r.trackName);
    if (out.some((h) => h.key === key && Math.abs(h.durationSec - durationSec) <= 2)) continue;
    const art = typeof r.artworkUrl100 === 'string' ? r.artworkUrl100 : '';
    const genre = typeof r.primaryGenreName === 'string' ? r.primaryGenreName.replace(/\s+/g, ' ').trim() : '';
    out.push({
      key,
      trackId: typeof r.trackId === 'number' ? r.trackId : 0,
      artist: r.artistName.trim(),
      title: r.trackName.trim(),
      album: typeof r.collectionName === 'string' ? r.collectionName : '',
      year: typeof r.releaseDate === 'string' ? r.releaseDate.slice(0, 4) : '',
      durationSec,
      artworkUrl: /^https:\/\//.test(art) ? art.replace(/\/\d+x\d+bb\./, '/300x300bb.') : '',
      ...(genre && genre.length <= 60 ? { genre } : {}),
      ...(r.trackExplicitness === 'cleaned' ? { clean: true } : {}),
    });
  }
  return out;
}

let jsonpSeq = 0;

/** iTunes JSONP: a <script> with `callback=`; used only if fetch is blocked. */
function jsonp(term: string, signal?: AbortSignal, timeoutMs = 10000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const name = `__ddItunes${Date.now().toString(36)}${jsonpSeq++}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      delete w[name];
      script.remove();
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      done();
      reject(new DOMException('aborted', 'AbortError'));
    };
    w[name] = (data: unknown) => {
      done();
      resolve(data);
    };
    script.onerror = () => {
      done();
      reject(new Error('jsonp failed'));
    };
    timer = window.setTimeout(() => {
      done();
      reject(new Error('jsonp timeout'));
    }, timeoutMs);
    signal?.addEventListener('abort', onAbort);
    script.src = itunesUrl(term, name);
    document.head.appendChild(script);
  });
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Deezer's JSONP answer, run in a hidden `sandbox="allow-scripts"` frame (an
 * opaque origin: no access to this page, its storage or cookies), sent back
 * by postMessage as plain data. No referrer is sent.
 */
function deezerJsonp(term: string, signal?: AbortSignal, timeoutMs = 8000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      reject(new Error('no document'));
      return;
    }
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.display = 'none';
    const src = deezerUrl(term, { callback: 'ddDeezer' });
    frame.srcdoc =
      `<!doctype html><meta name="referrer" content="no-referrer"><script>` +
      `function ddSend(m){m.dd=${JSON.stringify(nonce)};parent.postMessage(m,'*')}` +
      `function ddDeezer(d){ddSend({data:d})}<\/script>` +
      `<script src="${escAttr(src)}" referrerpolicy="no-referrer" onerror="ddSend({error:1})"><\/script>`;
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      signal?.removeEventListener('abort', onAbort);
      frame.remove();
    };
    const onAbort = () => {
      done();
      reject(new DOMException('aborted', 'AbortError'));
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const m = e.data as { dd?: unknown; data?: unknown; error?: unknown } | null;
      if (!m || m.dd !== nonce) return;
      done();
      if (m.error) reject(new Error('deezer failed'));
      else resolve(m.data);
    };
    timer = window.setTimeout(() => {
      done();
      reject(new Error('deezer timeout'));
    }, timeoutMs);
    window.addEventListener('message', onMessage);
    signal?.addEventListener('abort', onAbort);
    document.body.appendChild(frame);
  });
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

/** When each source may be asked again after a 403/429 (epoch ms). */
export class Backoff {
  private until = new Map<string, number>();
  constructor(private now: () => number = () => Date.now()) {}
  paused(source: string): boolean {
    return (this.until.get(source) ?? 0) > this.now();
  }
  pause(source: string, ms = BACKOFF_MS): void {
    this.until.set(source, this.now() + ms);
  }
}

const sharedBackoff = new Backoff();

export interface SearchOptions {
  signal?: AbortSignal;
  fetchFn?: FetchFn;
  jsonpFn?: typeof jsonp;
  /** Deezer's raw answer for the term (default: JSONP in a sandboxed frame). */
  deezerFn?: (term: string, signal?: AbortSignal) => Promise<unknown>;
  online?: () => boolean;
  backoff?: Backoff;
}

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';

async function searchItunes(term: string, o: SearchOptions, online: () => boolean, backoff: Backoff): Promise<SongHit[]> {
  if (backoff.paused('itunes')) throw new SongSearchError('busy');
  const fetchFn = o.fetchFn ?? ((u, i) => fetch(u, i));
  let res: Awaited<ReturnType<FetchFn>> | null = null;
  try {
    res = await fetchFn(itunesUrl(term), { signal: o.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (e) {
    if (isAbort(e)) throw e;
    if (!online()) throw new SongSearchError('offline');
    // Network or CORS failure: try JSONP once.
    try {
      return parseItunesResults(await (o.jsonpFn ?? jsonp)(term, o.signal));
    } catch (e2) {
      if (isAbort(e2)) throw e2;
      throw new SongSearchError(online() ? 'failed' : 'offline');
    }
  }
  if (res.status === 403 || res.status === 429 || res.status === 503) {
    backoff.pause('itunes');
    throw new SongSearchError('busy');
  }
  if (!res.ok) throw new SongSearchError('failed');
  try {
    return parseItunesResults(await res.json());
  } catch {
    throw new SongSearchError('failed');
  }
}

async function searchDeezer(term: string, o: SearchOptions, backoff: Backoff): Promise<DeezerTrack[]> {
  if (backoff.paused('deezer')) throw new DeezerError('busy');
  const raw = await (o.deezerFn ?? deezerJsonp)(term, o.signal);
  try {
    return parseDeezer(raw);
  } catch (e) {
    if (e instanceof DeezerError && e.kind === 'busy') backoff.pause('deezer');
    throw e;
  }
}

/**
 * Search songs in both catalogs and merge the lists. Either catalog alone is
 * enough; when iTunes fails and Deezer has nothing either, rejects with
 * iTunes' SongSearchError ('offline' | 'busy' | 'failed'). AbortError when
 * `signal` aborts.
 */
export async function searchSongs(term: string, o: SearchOptions = {}): Promise<SongHit[]> {
  const online = o.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  if (!online()) throw new SongSearchError('offline');
  const backoff = o.backoff ?? sharedBackoff;
  const [it, dz] = await Promise.allSettled([searchItunes(term, o, online, backoff), searchDeezer(term, o, backoff)]);
  if (o.signal?.aborted || (it.status === 'rejected' && isAbort(it.reason))) throw new DOMException('aborted', 'AbortError');
  const merged = mergeCatalogs(term, it.status === 'fulfilled' ? it.value : [], dz.status === 'fulfilled' ? dz.value : []) as SongHit[];
  if (it.status === 'rejected' && !merged.length) {
    throw it.reason instanceof SongSearchError ? it.reason : new SongSearchError('failed');
  }
  return merged;
}

// --- The iTunes track ID of a song found only on Deezer (for the relay) ------------------------

const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup';

export function itunesArtistUrl(artist: string): string {
  const q = new URLSearchParams({ term: artist.trim(), entity: 'musicArtist', limit: '5' });
  return `${ITUNES_SEARCH}?${q}`;
}

export function itunesArtistSongsUrl(artistId: number): string {
  return `${ITUNES_LOOKUP}?id=${artistId}&entity=song&limit=200`;
}

/** The artist IDs whose name is exactly `artist` (normalised), from a musicArtist search. */
export function parseArtistIds(json: unknown, artist: string): number[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const want = normalizeName(artist);
  return results
    .filter((r) => r && typeof r.artistId === 'number' && typeof r.artistName === 'string' && normalizeName(r.artistName) === want)
    .map((r) => r.artistId as number);
}

/**
 * The track in an artist's song list (`lookup?id=…&entity=song`, which, unlike
 * the search, lists explicit tracks) with this title and a length within 2 s;
 * the explicit one first. Null if none.
 */
export function pickArtistTrack(json: unknown, hit: Pick<SongHit, 'title' | 'durationSec'>): { trackId: number; genre?: string } | null {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return null;
  const near = results.filter(
    (r) =>
      r &&
      r.kind === 'song' &&
      typeof r.trackId === 'number' &&
      typeof r.trackName === 'string' &&
      typeof r.trackTimeMillis === 'number' &&
      Math.abs(Math.round(r.trackTimeMillis / 1000) - hit.durationSec) <= 2,
  );
  // The same title, else the same title core ("TQG" for "TQG (feat. Shakira)").
  const exact = near.filter((r) => normalizeName(r.trackName) === normalizeName(hit.title));
  const ok = exact.length ? exact : near.filter((r) => versionCore(r.trackName) === versionCore(hit.title) && !!versionCore(hit.title));
  const best = ok.find((r) => r.trackExplicitness === 'explicit') ?? ok[0];
  if (!best) return null;
  return { trackId: best.trackId, ...(typeof best.primaryGenreName === 'string' ? { genre: best.primaryGenreName } : {}) };
}

/**
 * Find the iTunes track ID for a hit that has none (the relay checks every
 * song against Apple by ID): Apple's artist by name, then that artist's songs.
 * Two requests, made only when such a song is added through the relay; only
 * the artist name is sent. Resolves 0 when not found or unreachable.
 */
export async function findItunesTrackId(hit: Pick<SongHit, 'artist' | 'title' | 'durationSec'>, fetchFn: FetchFn = (u, i) => fetch(u, i)): Promise<number> {
  const init: RequestInit = { credentials: 'omit', referrerPolicy: 'no-referrer' };
  const names = [hit.artist, hit.artist.split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b)\s*/i)[0]].filter((n, i, a) => n && a.indexOf(n) === i);
  try {
    for (const name of names) {
      const res = await fetchFn(itunesArtistUrl(name), init);
      if (!res.ok) return 0;
      const ids = parseArtistIds(await res.json(), name);
      if (!ids.length) continue;
      const songs = await fetchFn(itunesArtistSongsUrl(ids[0]), init);
      if (!songs.ok) return 0;
      const t = pickArtistTrack(await songs.json(), hit);
      if (t) return t.trackId;
    }
  } catch {
    return 0;
  }
  return 0;
}
