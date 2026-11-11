/**
 * Optional "add a song" relay (cloudflare/add-song-worker): the app sends the
 * iTunes track ID plus the artist/title/length it found in its own iTunes
 * search. The Worker prefers Apple's lookup of the ID and uses the app's
 * details only when that lookup fails; it starts the GitHub workflow with its
 * own token, so no token is needed in the browser.
 */

export const PASS_HEADER = 'X-Add-Passphrase';
/** The Worker's request size limit (bytes). */
export const RELAY_MAX_BODY_BYTES = 2048;
export const RELAY_MAX_QUEUE = 9;
/** Control characters and line breaks, which the Worker rejects. */
const CTRL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** A relay address: https (or http on localhost), no query or fragment; normalised without a trailing slash. */
export function parseRelayUrl(input: string | null | undefined): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
  if (u.username || u.password || u.search || u.hash) return null;
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

/** A song as the app found it in its iTunes search. */
export interface RelaySong {
  trackId: number;
  artist: string;
  title: string;
  durationSec?: number;
}

export interface RelayDetails {
  artist: string;
  title: string;
  durationSec?: number;
}

/**
 * The details the Worker accepts (trimmed, 1-200 characters, no control
 * characters; length a whole number 20-900 or left out). Null when the names
 * can't be sent; the Worker then relies on Apple alone.
 */
export function relayDetails(s: { artist: string; title: string; durationSec?: number }): RelayDetails | null {
  const clean = (v: unknown) => {
    if (typeof v !== 'string' || CTRL_RE.test(v)) return null;
    const t = v.trim();
    return t.length >= 1 && t.length <= 200 ? t : null;
  };
  const artist = clean(s.artist);
  const title = clean(s.title);
  if (!artist || !title) return null;
  const d = typeof s.durationSec === 'number' && Number.isFinite(s.durationSec) ? Math.round(s.durationSec) : NaN;
  return d >= 20 && d <= 900 ? { artist, title, durationSec: d } : { artist, title };
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * The POST /add body: the song (with its details) and as many waiting songs
 * as fit in the Worker's size limit (with details, else by ID only).
 */
export function relayBody(song: RelaySong, queue: RelaySong[]): string {
  const withSong = (s: RelaySong) => {
    const d = relayDetails(s);
    return d ? { trackId: s.trackId, song: d } : { trackId: s.trackId };
  };
  const body: { trackId: number; song?: RelayDetails; queue?: (number | { trackId: number; song?: RelayDetails })[] } = withSong(song);
  const items: (number | { trackId: number; song?: RelayDetails })[] = [];
  const fits = (next: typeof items) => bytes(JSON.stringify({ ...body, queue: next })) <= RELAY_MAX_BODY_BYTES;
  for (const q of queue) {
    if (items.length >= RELAY_MAX_QUEUE || q.trackId === song.trackId) continue;
    const full = withSong(q);
    if (fits([...items, full])) items.push(full);
    else if (fits([...items, q.trackId])) items.push(q.trackId);
  }
  if (items.length) body.queue = items;
  return JSON.stringify(body);
}

export type RelayError =
  | 'bad-origin'
  | 'passphrase'
  | 'not-found'
  | 'daily-limit'
  | 'lookup-failed'
  | 'not-configured'
  | 'bad-request'
  | 'github'
  | 'network'
  | 'server';

export type RelayResult =
  | {
      ok: true;
      /** Where the relay took the names from: Apple's lookup, or (when that failed) the details the app sent. */
      source: 'apple' | 'client';
      /** Why the relay fell back to the app's details, e.g. apple-403. */
      detail?: string;
      song: { trackId: number; artist: string; title: string; durationSec?: number; artworkUrl: string };
    }
  | { ok: false; error: RelayError; code: string; detail?: string; message: string };

/** The relay's short diagnostic (e.g. apple-403), or undefined when absent or odd-looking. */
function cleanDetail(v: unknown): string | undefined {
  return typeof v === 'string' && /^[a-z0-9][a-z0-9/-]{0,79}$/i.test(v) ? v : undefined;
}

const withDetail = (message: string, detail?: string) => (detail ? `${message} (Relay detail: ${detail}.)` : message);

/** Plain-English message for a relay error code (and its optional detail). */
export function explainRelayError(code: string, detail?: string): { error: RelayError; message: string } {
  switch (code) {
    case 'bad-origin':
      return { error: 'bad-origin', message: 'The relay doesn’t accept requests from this site. Add this address to ALLOWED_ORIGINS in the Worker’s settings.' };
    case 'passphrase':
      return { error: 'passphrase', message: 'The relay needs its passphrase. Type it once and this browser remembers it.' };
    case 'not-found':
      return { error: 'not-found', message: withDetail('Apple’s music catalogue no longer lists this song, so the relay can’t add it.', detail) };
    case 'daily-limit':
      return { error: 'daily-limit', message: 'The relay has added as many songs as it allows today. Try again tomorrow.' };
    case 'lookup-failed':
      return {
        error: 'lookup-failed',
        message: withDetail(
          'The relay couldn’t look this song up in Apple’s music catalogue. Try again in a minute. If it keeps happening, the relay may be out of date: run npx wrangler deploy in cloudflare/add-song-worker.',
          detail,
        ),
      };
    case 'not-configured':
      return { error: 'not-configured', message: 'The relay isn’t set up yet: it needs GITHUB_REPO and the GITHUB_TOKEN secret.' };
    case 'bad-request':
      if (detail && /^(?:queue-)?song/.test(detail)) {
        return { error: 'bad-request', message: withDetail('The relay didn’t accept this song’s name or length. Search for the song again and pick it from the results.', detail) };
      }
      return { error: 'bad-request', message: withDetail('The relay didn’t understand the request. Check that its address is right.', detail) };
  }
  const gh = /^github-(\d+)$/.exec(code);
  if (gh) {
    const s = Number(gh[1]);
    if (s === 401) return { error: 'github', message: 'GitHub rejected the relay’s token. Make a new token and save it with wrangler secret put GITHUB_TOKEN.' };
    if (s === 403) return { error: 'github', message: 'The relay’s GitHub token can’t start the beat-map job. It needs Actions: Read and write on this repository.' };
    if (s === 404) return { error: 'github', message: 'GitHub couldn’t find the Beat maps workflow. Check GITHUB_REPO in the relay and that beatmaps.yml is on main.' };
    if (s === 422) return { error: 'github', message: 'GitHub refused the request. The Beat maps workflow on GitHub may be older than this app: push the latest one.' };
    return { error: 'github', message: `GitHub answered the relay with an error (${s}). Try again in a minute.` };
  }
  if (code.startsWith('github-')) return { error: 'github', message: 'The relay couldn’t reach GitHub. Try again in a minute.' };
  return { error: 'server', message: withDetail('The relay had a problem. Try again in a minute.', detail) };
}

type FetchFn = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

export async function relayAdd(
  relay: string,
  song: RelaySong,
  queue: RelaySong[],
  passphrase: string | null,
  fetchFn: FetchFn = (u, i) => fetch(u, i),
): Promise<RelayResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (passphrase) headers[PASS_HEADER] = passphrase;
  let res: Awaited<ReturnType<FetchFn>>;
  try {
    res = await fetchFn(`${relay}/add`, {
      method: 'POST',
      headers,
      body: relayBody(song, queue),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    // Also what a CORS rejection looks like from inside the page.
    return { ok: false, error: 'network', code: 'network', message: 'Couldn’t reach the relay. Check your connection and the relay address.' };
  }
  let body: { ok?: unknown; error?: unknown; song?: unknown; source?: unknown; detail?: unknown } = {};
  try {
    body = JSON.parse(await res.text()) as typeof body;
  } catch {
    /* not JSON */
  }
  if (!body || typeof body !== 'object') body = {};
  const detail = cleanDetail(body.detail);
  if (res.ok && body.ok === true && body.song && typeof body.song === 'object') {
    const s = body.song as Record<string, unknown>;
    if (typeof s.artist === 'string' && typeof s.title === 'string') {
      const durationSec = typeof s.durationSec === 'number' && s.durationSec > 0 ? s.durationSec : song.durationSec;
      return {
        ok: true,
        // A relay from before the fallback existed sends no source: it always used Apple.
        source: body.source === 'client' ? 'client' : 'apple',
        ...(detail ? { detail } : {}),
        song: {
          trackId: song.trackId,
          artist: s.artist,
          title: s.title,
          ...(durationSec !== undefined ? { durationSec } : {}),
          artworkUrl: typeof s.artworkUrl === 'string' ? s.artworkUrl : '',
        },
      };
    }
  }
  const code = typeof body.error === 'string' ? body.error.slice(0, 40) : `http-${res.status}`;
  return { ok: false, code, ...(detail ? { detail } : {}), ...explainRelayError(code, detail) };
}

/** GET /health: whether the relay is set up and needs a passphrase. Null when unreachable. */
export async function relayHealth(
  relay: string,
  fetchFn: FetchFn = (u, i) => fetch(u, i),
): Promise<{ ok: boolean; repo: string | null; passphrase: boolean } | null> {
  try {
    const res = await fetchFn(`${relay}/health`, { method: 'GET', credentials: 'omit', cache: 'no-store' });
    if (!res.ok) return null;
    const b = JSON.parse(await res.text()) as Record<string, unknown>;
    return { ok: b.ok === true, repo: typeof b.repo === 'string' ? b.repo : null, passphrase: b.passphrase === true };
  } catch {
    return null;
  }
}
