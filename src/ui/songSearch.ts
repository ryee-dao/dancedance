/**
 * Song search for "Add a song": the iTunes Search API, called straight from
 * the browser. It sends CORS headers (Access-Control-Allow-Origin: *), so a
 * plain fetch works; if a browser still blocks it, the API's JSONP mode
 * (`callback=`) is the fallback. Only the search text is sent.
 */

import { songKey } from '../beat/cloud';

export interface SongHit {
  key: string;
  trackId: number;
  artist: string;
  title: string;
  album: string;
  year: string;
  durationSec: number;
  /** 300x300 artwork (may be empty). */
  artworkUrl: string;
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
    out.push({
      key,
      trackId: typeof r.trackId === 'number' ? r.trackId : 0,
      artist: r.artistName.trim(),
      title: r.trackName.trim(),
      album: typeof r.collectionName === 'string' ? r.collectionName : '',
      year: typeof r.releaseDate === 'string' ? r.releaseDate.slice(0, 4) : '',
      durationSec,
      artworkUrl: /^https:\/\//.test(art) ? art.replace(/\/\d+x\d+bb\./, '/300x300bb.') : '',
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

type FetchFn = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

/**
 * Search songs. Rejects with SongSearchError ('offline' | 'busy' | 'failed'),
 * or an AbortError when `signal` aborts.
 */
export async function searchSongs(
  term: string,
  o: { signal?: AbortSignal; fetchFn?: FetchFn; jsonpFn?: typeof jsonp; online?: () => boolean } = {},
): Promise<SongHit[]> {
  const online = o.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  if (!online()) throw new SongSearchError('offline');
  const fetchFn = o.fetchFn ?? ((u, i) => fetch(u, i));
  let res: Awaited<ReturnType<FetchFn>> | null = null;
  try {
    res = await fetchFn(itunesUrl(term), { signal: o.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    if (!online()) throw new SongSearchError('offline');
    // Network or CORS failure: try JSONP once.
    try {
      return parseItunesResults(await (o.jsonpFn ?? jsonp)(term, o.signal));
    } catch (e2) {
      if ((e2 as Error)?.name === 'AbortError') throw e2;
      throw new SongSearchError(online() ? 'failed' : 'offline');
    }
  }
  if (res.status === 403 || res.status === 429 || res.status === 503) throw new SongSearchError('busy');
  if (!res.ok) throw new SongSearchError('failed');
  try {
    return parseItunesResults(await res.json());
  } catch {
    throw new SongSearchError('failed');
  }
}
