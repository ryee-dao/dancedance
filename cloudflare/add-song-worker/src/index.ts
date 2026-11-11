/**
 * DanceDance "add a song" relay: a Cloudflare Worker that starts the
 * repository's Beat maps workflow, so the web app doesn't need a GitHub token
 * in every browser.
 *
 *   POST /add      { "trackId": 1440936016, "queue"?: [123, 456] }
 *                  headers: Content-Type: application/json
 *                           X-Add-Passphrase: <passphrase>   (only when ADD_PASSPHRASE is set)
 *     200 { ok: true, song: { trackId, artist, title, durationSec, artworkUrl } }
 *     4xx/5xx { ok: false, error: <code> }   codes: bad-origin, bad-request, passphrase,
 *         not-found, daily-limit, lookup-failed, not-configured, github-<status>
 *   GET /health    { ok, repo, passphrase: <required?>, dailyLimit }
 *
 * Artist, title and length always come from Apple's lookup of the track ID,
 * never from the caller. `queue` = other track IDs the app is still waiting
 * for (max 9), re-sent so a run GitHub dropped from its queue is retried.
 *
 * Settings (wrangler.toml [vars] / `wrangler secret put`):
 *   GITHUB_REPO      var     "owner/repo"
 *   ALLOWED_ORIGINS  var     comma-separated, e.g. "https://jo.github.io,http://localhost:5173"
 *   DAILY_LIMIT      var     optional, default 30 (soft: counts workflow_dispatch runs in the last 24 h)
 *   GITHUB_TOKEN     secret  fine-grained token, this repository only, Actions: Read and write
 *   ADD_PASSPHRASE   secret  optional shared passphrase
 *
 * The token is only sent to api.github.com and never appears in a response;
 * upstream error bodies are never passed through.
 */

export interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  ALLOWED_ORIGINS?: string;
  ADD_PASSPHRASE?: string;
  DAILY_LIMIT?: string;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export const WORKFLOW_FILE = 'beatmaps.yml';
export const WORKFLOW_REF = 'main';
export const DEFAULT_DAILY_LIMIT = 30;
export const MAX_BODY_BYTES = 2048;
export const MAX_QUEUE = 9;
const GITHUB_API = 'https://api.github.com';
const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const PASS_HEADER = 'X-Add-Passphrase';

export interface Song {
  trackId: number;
  artist: string;
  title: string;
  durationSec: number;
  artworkUrl: string;
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, ${PASS_HEADER}`,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
  });
}

const fail = (status: number, error: string, cors: Record<string, string>) => json(status, { ok: false, error }, cors);

/** Constant-time string comparison (length is not secret). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function toTrackId(v: unknown): number | null {
  const n = typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Apple's data for these tracks (songs only, 20 s .. 15 min). */
export async function lookupTracks(ids: number[], fetchFn: FetchFn): Promise<Map<number, Song> | null> {
  let res: Response;
  try {
    res = await fetchFn(`https://itunes.apple.com/lookup?id=${ids.join(',')}&entity=song`, { headers: { Accept: 'application/json' } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const out = new Map<number, Song>();
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return out;
  for (const raw of results) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (r.wrapperType !== 'track' || r.kind !== 'song') continue;
    if (typeof r.trackId !== 'number' || typeof r.artistName !== 'string' || typeof r.trackName !== 'string') continue;
    const durationSec = Math.round((typeof r.trackTimeMillis === 'number' ? r.trackTimeMillis : 0) / 1000);
    if (durationSec < 20 || durationSec > 900) continue;
    const art = typeof r.artworkUrl100 === 'string' && r.artworkUrl100.startsWith('https://') ? r.artworkUrl100.replace(/\/\d+x\d+bb\./, '/300x300bb.') : '';
    out.set(r.trackId, {
      trackId: r.trackId,
      artist: r.artistName.trim().slice(0, 200),
      title: r.trackName.trim().slice(0, 200),
      durationSec,
      artworkUrl: art,
    });
  }
  return out;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'dancedance-add-song-relay',
  };
}

/** The same workflow inputs the web app's direct-token path sends. */
export function dispatchBody(song: Song, queue: Song[]): string {
  const inputs: Record<string, string> = { add_artist: song.artist, add_title: song.title, add_duration: String(song.durationSec) };
  if (queue.length) inputs.add_queue = JSON.stringify(queue.map((q) => ({ artist: q.artist, title: q.title, duration: q.durationSec })));
  return JSON.stringify({ ref: WORKFLOW_REF, inputs });
}

export async function handle(req: Request, env: Env, fetchFn: FetchFn = (i, init) => fetch(i, init), now: () => Date = () => new Date()): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin, env);
  const originOk = Object.keys(cors).length > 0;
  const repo = (env.GITHUB_REPO ?? '').trim();
  const configured = REPO_RE.test(repo) && !!env.GITHUB_TOKEN;
  const limit = Math.max(1, Math.floor(Number(env.DAILY_LIMIT) || DEFAULT_DAILY_LIMIT));

  if (req.method === 'OPTIONS') {
    return originOk ? new Response(null, { status: 204, headers: cors }) : fail(403, 'bad-origin', {});
  }
  if (url.pathname === '/health') {
    if (req.method !== 'GET') return fail(405, 'bad-request', cors);
    return json(200, { ok: configured, repo: REPO_RE.test(repo) ? repo : null, passphrase: !!env.ADD_PASSPHRASE, dailyLimit: limit }, cors);
  }
  if (url.pathname !== '/add') return fail(404, 'bad-request', cors);
  if (req.method !== 'POST') return fail(405, 'bad-request', cors);
  if (!originOk) return fail(403, 'bad-origin', {});
  if (!/^application\/json\b/i.test(req.headers.get('Content-Type') ?? '')) return fail(415, 'bad-request', cors);
  if (Number(req.headers.get('Content-Length') ?? '0') > MAX_BODY_BYTES) return fail(413, 'bad-request', cors);
  if (env.ADD_PASSPHRASE && !safeEqual(req.headers.get(PASS_HEADER) ?? '', env.ADD_PASSPHRASE)) return fail(401, 'passphrase', cors);
  if (!configured) return fail(500, 'not-configured', cors);

  let text: string;
  try {
    text = await req.text();
  } catch {
    return fail(400, 'bad-request', cors);
  }
  if (text.length > MAX_BODY_BYTES) return fail(413, 'bad-request', cors);
  let body: { trackId?: unknown; queue?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, 'bad-request', cors);
  }
  const trackId = toTrackId(body?.trackId);
  if (!trackId) return fail(400, 'bad-request', cors);
  const queueIds = (Array.isArray(body.queue) ? body.queue : [])
    .map(toTrackId)
    .filter((x): x is number => x !== null && x !== trackId)
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, MAX_QUEUE);

  const tracks = await lookupTracks([trackId, ...queueIds], fetchFn);
  if (!tracks) return fail(502, 'lookup-failed', cors);
  const song = tracks.get(trackId);
  if (!song) return fail(404, 'not-found', cors);
  const queue = queueIds.map((id) => tracks.get(id)).filter((s): s is Song => !!s);

  const base = `${GITHUB_API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}`;
  const headers = githubHeaders(env.GITHUB_TOKEN!);

  // Soft daily cap: workflow_dispatch runs of this workflow created in the last 24 h.
  const since = new Date(now().getTime() - 24 * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  try {
    const res = await fetchFn(`${base}/runs?event=workflow_dispatch&per_page=1&created=${encodeURIComponent(`>=${since}`)}`, { headers });
    if (!res.ok) return fail(502, `github-${res.status}`, cors);
    const count = Number(((await res.json()) as { total_count?: unknown }).total_count);
    if (!Number.isFinite(count)) return fail(502, 'github-count', cors);
    if (count >= limit) return fail(429, 'daily-limit', cors);
  } catch {
    return fail(502, 'github-unreachable', cors);
  }

  try {
    const res = await fetchFn(`${base}/dispatches`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: dispatchBody(song, queue),
    });
    if (res.status !== 204 && !res.ok) return fail(502, `github-${res.status}`, cors);
  } catch {
    return fail(502, 'github-unreachable', cors);
  }
  return json(200, { ok: true, song }, cors);
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env);
  },
};
