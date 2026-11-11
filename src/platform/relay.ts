/**
 * Optional "add a song" relay (cloudflare/add-song-worker): the app sends
 * only an iTunes track ID; the Worker looks the song up and starts the
 * GitHub workflow with its own token, so no token is needed in the browser.
 */

export const PASS_HEADER = 'X-Add-Passphrase';

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
  | { ok: true; song: { trackId: number; artist: string; title: string; durationSec: number; artworkUrl: string } }
  | { ok: false; error: RelayError; code: string; message: string };

/** Plain-English message for a relay error code. */
export function explainRelayError(code: string): { error: RelayError; message: string } {
  switch (code) {
    case 'bad-origin':
      return { error: 'bad-origin', message: 'The relay doesn’t accept requests from this site. Add this address to ALLOWED_ORIGINS in the Worker’s settings.' };
    case 'passphrase':
      return { error: 'passphrase', message: 'The relay needs its passphrase. Type it once and this browser remembers it.' };
    case 'not-found':
      return { error: 'not-found', message: 'Apple’s music catalogue no longer lists this song, so the relay can’t add it.' };
    case 'daily-limit':
      return { error: 'daily-limit', message: 'The relay has added as many songs as it allows today. Try again tomorrow.' };
    case 'lookup-failed':
      return { error: 'lookup-failed', message: 'The relay couldn’t reach Apple’s music catalogue. Try again in a minute.' };
    case 'not-configured':
      return { error: 'not-configured', message: 'The relay isn’t set up yet: it needs GITHUB_REPO and the GITHUB_TOKEN secret.' };
    case 'bad-request':
      return { error: 'bad-request', message: 'The relay didn’t understand the request. Check that its address is right.' };
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
  return { error: 'server', message: 'The relay had a problem. Try again in a minute.' };
}

type FetchFn = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

export async function relayAdd(
  relay: string,
  trackId: number,
  queue: number[],
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
      body: JSON.stringify({ trackId, ...(queue.length ? { queue: queue.slice(0, 9) } : {}) }),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    // Also what a CORS rejection looks like from inside the page.
    return { ok: false, error: 'network', code: 'network', message: 'Couldn’t reach the relay. Check your connection and the relay address.' };
  }
  let body: { ok?: unknown; error?: unknown; song?: unknown } = {};
  try {
    body = JSON.parse(await res.text()) as typeof body;
  } catch {
    /* not JSON */
  }
  if (res.ok && body.ok === true && body.song && typeof body.song === 'object') {
    const s = body.song as Record<string, unknown>;
    if (typeof s.artist === 'string' && typeof s.title === 'string' && typeof s.durationSec === 'number') {
      return {
        ok: true,
        song: { trackId, artist: s.artist, title: s.title, durationSec: s.durationSec, artworkUrl: typeof s.artworkUrl === 'string' ? s.artworkUrl : '' },
      };
    }
  }
  const code = typeof body.error === 'string' ? body.error.slice(0, 40) : `http-${res.status}`;
  return { ok: false, code, ...explainRelayError(code) };
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
