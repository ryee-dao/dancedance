/**
 * DanceDance "add a song" relay: a Cloudflare Worker that starts the
 * repository's Beat maps workflow, so the web app doesn't need a GitHub token
 * in every browser.
 *
 *   POST /add      { "trackId": 1440936016,
 *                    "song"?:  { "artist": "...", "title": "...", "durationSec"?: 219 },
 *                    "queue"?: [123, { "trackId": 456, "song"?: { ... } }] }
 *                  headers: Content-Type: application/json
 *                           X-Add-Passphrase: <passphrase>   (only when ADD_PASSPHRASE is set)
 *     200 { ok: true, source: 'apple' | 'client', song: { trackId, artist, title, durationSec?, artworkUrl }, detail? }
 *     4xx/5xx { ok: false, error: <code>, detail? }   codes: bad-origin, bad-request, passphrase,
 *         not-found, daily-limit, lookup-failed, not-configured, github-<status>
 *   POST /map      a beat map a player's browser made (source 'tab': heard via
 *                  tab audio; 'device': analysed from a local download), as the
 *                  JSON body itself (max MAP_MAX_BYTES). Same origin check and
 *                  passphrase as /add. Validated strictly (validateSharedMap),
 *                  then forwarded as the workflow input map_json; the job
 *                  checks it again and decides whether the song needs it.
 *     200 { ok: true, videoId }
 *     4xx/5xx { ok: false, error, detail? }  codes as /add, plus bad-map (detail = the rule broken)
 *                  and daily-limit (MAP_DAILY_LIMIT contributed maps per 24 h)
 *   GET /health           { ok, repo, passphrase: <required?>, dailyLimit, mapDailyLimit }
 *   GET /health?probe=1   the same plus { apple: 'ok' | 'apple-<status>' | 'apple-timeout' | ... }
 *
 * Artist, title and length come from Apple's lookup of the track ID when
 * Apple answers (source 'apple'). Only when the lookup itself fails (network
 * error, timeout, non-200, unreadable answer, after one retry) does the relay
 * fall back to the details the app took from its own iTunes search (source
 * 'client', `detail` says why). If Apple answers that the ID is not a song,
 * the answer is `not-found` whatever the app sent. Client details are
 * validated strictly: trimmed strings of 1-200 characters without control
 * characters or line breaks; durationSec an integer 20-900, or left out (the
 * cloud job then looks the length up itself). `queue` = other songs the app is
 * still waiting for (max 9), re-sent so a run GitHub dropped is retried.
 *
 * `detail` is a short diagnostic (e.g. apple-403, apple-timeout,
 * apple-bad-json, song-title); it never contains secrets or upstream bodies.
 *
 * Settings (wrangler.toml [vars] / `wrangler secret put`):
 *   GITHUB_REPO      var     "owner/repo"
 *   ALLOWED_ORIGINS  var     comma-separated, e.g. "https://jo.github.io,http://localhost:5173"
 *   DAILY_LIMIT      var     optional, default 30 (soft: counts workflow_dispatch runs in the last 24 h,
 *                            other than contributed-map runs)
 *   MAP_DAILY_LIMIT  var     optional, default 60 (soft: counts "Contributed beat map" runs in the last 24 h)
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
  MAP_DAILY_LIMIT?: string;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface HandleOptions {
  /** Per-attempt time limit for Apple's lookup (default APPLE_TIMEOUT_MS). */
  appleTimeoutMs?: number;
}

export const WORKFLOW_FILE = 'beatmaps.yml';
export const WORKFLOW_REF = 'main';
export const DEFAULT_DAILY_LIMIT = 30;
export const DEFAULT_MAP_DAILY_LIMIT = 60;
/** The run-name beatmaps.yml gives contributed-map runs (used to count them). */
export const MAP_RUN_TITLE = 'Contributed beat map';
export const MAX_BODY_BYTES = 2048;
export const MAX_QUEUE = 9;
export const APPLE_TIMEOUT_MS = 4000;
/** A well-known song used by GET /health?probe=1. */
export const PROBE_TRACK_ID = 1573849255;
const GITHUB_API = 'https://api.github.com';
const APPLE_LOOKUP = 'https://itunes.apple.com/lookup';
const APPLE_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; DanceDanceRelay/1.0)',
};
const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const PASS_HEADER = 'X-Add-Passphrase';
/** C0/C1 control characters (incl. tab, CR, LF) and Unicode line/paragraph separators. */
const CTRL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

export interface Song {
  trackId: number;
  artist: string;
  title: string;
  /** Absent only for client details without a length (the cloud job looks it up). */
  durationSec?: number;
  artworkUrl: string;
}

/** Artist/title/length the app took from its own iTunes search. */
export interface ClientDetails {
  artist: string;
  title: string;
  durationSec?: number;
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

const fail = (status: number, error: string, cors: Record<string, string>, detail?: string) =>
  json(status, detail ? { ok: false, error, detail } : { ok: false, error }, cors);

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

function cleanText(v: unknown): string | null {
  if (typeof v !== 'string' || CTRL_RE.test(v)) return null; // also a trailing line break
  const s = v.trim();
  return s.length >= 1 && s.length <= 200 ? s : null;
}

/**
 * Strictly validated client details. `undefined` = none sent; otherwise either
 * the cleaned details or the name of the bad field (for `detail`).
 */
export function parseClientDetails(v: unknown): { ok: true; details?: ClientDetails } | { ok: false; field: string } {
  if (v === undefined || v === null) return { ok: true };
  if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, field: 'song' };
  const r = v as Record<string, unknown>;
  const artist = cleanText(r.artist);
  if (!artist) return { ok: false, field: 'song-artist' };
  const title = cleanText(r.title);
  if (!title) return { ok: false, field: 'song-title' };
  const d = r.durationSec;
  if (d === undefined || d === null) return { ok: true, details: { artist, title } };
  if (typeof d !== 'number' || !Number.isInteger(d) || d < 20 || d > 900) return { ok: false, field: 'song-duration' };
  return { ok: true, details: { artist, title, durationSec: d } };
}

type AppleGet = { ok: true; data: unknown } | { ok: false; detail: string };

/** One GET to Apple with a hard time limit (covers the body too). Never throws. */
async function appleGet(url: string, fetchFn: FetchFn, timeoutMs: number): Promise<AppleGet> {
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AppleGet>((resolve) => {
    timer = setTimeout(() => {
      resolve({ ok: false, detail: 'apple-timeout' });
      ctl.abort();
    }, timeoutMs);
  });
  const attempt = (async (): Promise<AppleGet> => {
    let res: Response;
    try {
      res = await fetchFn(url, { headers: APPLE_HEADERS, signal: ctl.signal });
    } catch {
      return { ok: false, detail: 'apple-network' };
    }
    if (!res.ok) {
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      return { ok: false, detail: `apple-${res.status}` };
    }
    let text: string;
    try {
      text = await res.text();
    } catch {
      return { ok: false, detail: 'apple-network' };
    }
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, detail: 'apple-bad-json' };
    }
  })();
  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export type LookupResult =
  | { ok: true; songs: Map<number, Song>; /** why an ID is not a usable song */ reasons: Map<number, string> }
  | { ok: false; detail: string };

/** Apple's answer for these IDs (songs only, 20 s .. 15 min); null when it isn't a lookup answer. */
export function parseLookup(data: unknown, ids: number[]): { songs: Map<number, Song>; reasons: Map<number, string> } | null {
  const results = (data as { results?: unknown } | null)?.results;
  if (!data || typeof data !== 'object' || !Array.isArray(results)) return null;
  const songs = new Map<number, Song>();
  const reasons = new Map<number, string>();
  for (const raw of results) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (typeof r.trackId !== 'number' || !ids.includes(r.trackId) || songs.has(r.trackId)) continue;
    if (r.wrapperType !== 'track' || r.kind !== 'song' || typeof r.artistName !== 'string' || typeof r.trackName !== 'string') {
      reasons.set(r.trackId, 'apple-not-song');
      continue;
    }
    const durationSec = Math.round((typeof r.trackTimeMillis === 'number' ? r.trackTimeMillis : 0) / 1000);
    const artist = r.artistName.trim().slice(0, 200);
    const title = r.trackName.trim().slice(0, 200);
    if (durationSec < 20 || durationSec > 900) {
      reasons.set(r.trackId, 'apple-length');
      continue;
    }
    if (!artist || !title) {
      reasons.set(r.trackId, 'apple-not-song');
      continue;
    }
    const art = typeof r.artworkUrl100 === 'string' && r.artworkUrl100.startsWith('https://') ? r.artworkUrl100.replace(/\/\d+x\d+bb\./, '/300x300bb.') : '';
    songs.set(r.trackId, { trackId: r.trackId, artist, title, durationSec, artworkUrl: art });
    reasons.delete(r.trackId);
  }
  for (const id of ids) if (!songs.has(id) && !reasons.has(id)) reasons.set(id, 'apple-not-listed');
  return { songs, reasons };
}

/**
 * Look the IDs up on Apple: `lookup?id=…&entity=song`, then on failure one
 * retry as `lookup?id=…&country=us`. Fails only when neither gave an answer.
 */
export async function lookupTracks(ids: number[], fetchFn: FetchFn, timeoutMs = APPLE_TIMEOUT_MS): Promise<LookupResult> {
  const list = ids.join(',');
  const urls = [`${APPLE_LOOKUP}?id=${list}&entity=song`, `${APPLE_LOOKUP}?id=${list}&country=us`];
  const details: string[] = [];
  for (const url of urls) {
    const got = await appleGet(url, fetchFn, timeoutMs);
    if (!got.ok) {
      details.push(got.detail);
      continue;
    }
    const parsed = parseLookup(got.data, ids);
    if (parsed) return { ok: true, ...parsed };
    details.push('apple-bad-shape');
  }
  return { ok: false, detail: [...new Set(details)].join('/') };
}

/** GET /health?probe=1: one lookup of a fixed, well-known song. */
async function probeApple(fetchFn: FetchFn, timeoutMs: number): Promise<string> {
  const got = await appleGet(`${APPLE_LOOKUP}?id=${PROBE_TRACK_ID}&entity=song`, fetchFn, timeoutMs);
  if (!got.ok) return got.detail;
  const parsed = parseLookup(got.data, [PROBE_TRACK_ID]);
  if (!parsed) return 'apple-bad-shape';
  return parsed.songs.has(PROBE_TRACK_ID) ? 'ok' : (parsed.reasons.get(PROBE_TRACK_ID) ?? 'apple-not-listed');
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'dancedance-add-song-relay',
  };
}

// ---------------------------------------------------------------------------
// POST /map: strict validation of a contributed beat map. A compact copy of
// validateBeatMap (src/core/analysis/beatmap.ts) plus the sharing rules
// (src/core/analysis/shared.ts); a test checks both agree.

export const MAP_MAX_BYTES = 40_000;
const MAP_KEYS = new Set(['v', 'analyzerVersion', 'videoId', 'duration', 'bpm', 'beats', 'downbeats', 'sections', 'source', 'partial']);
const SECTION_KEYS = new Set(['start', 'end', 'type', 'energy']);
const SECTION_TYPES = ['intro', 'verse', 'chorus', 'drop', 'outro'];
const MAP_SOURCES = ['tab', 'device'];
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VERSION_RE = /^[0-9A-Za-z.+-]{1,32}$/;

export interface SharedSection {
  start: number;
  end: number;
  type: string;
  energy: number;
}

export interface SharedMap {
  v: 1;
  analyzerVersion: string;
  videoId: string;
  duration: number;
  bpm: number;
  beats: number[];
  downbeats: number[];
  sections: SharedSection[];
  source: 'tab' | 'device';
}

const ms = (t: number) => Math.round(t * 1000) / 1000;
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The map normalised like validateBeatMap (times to ms), or the name of the first rule it breaks. */
export function validateSharedMap(x: unknown): { ok: true; map: SharedMap } | { ok: false; rule: string } {
  const no = (rule: string) => ({ ok: false as const, rule });
  if (!obj(x)) return no('shape');
  for (const k of Object.keys(x)) if (!MAP_KEYS.has(k)) return no('extra-field');
  if (Array.isArray(x.sections)) {
    for (const s of x.sections) {
      if (!obj(s)) return no('sections');
      for (const k of Object.keys(s)) if (!SECTION_KEYS.has(k)) return no('extra-field');
    }
  }
  if (x.v !== 1) return no('version');
  if (typeof x.analyzerVersion !== 'string' || !VERSION_RE.test(x.analyzerVersion)) return no('analyzer-version');
  if (typeof x.videoId !== 'string' || !VIDEO_ID_RE.test(x.videoId)) return no('video-id');
  if (typeof x.source !== 'string' || !MAP_SOURCES.includes(x.source)) return no('source');
  if (x.partial !== undefined && typeof x.partial !== 'boolean') return no('invalid');
  if (x.partial === true) return no('partial');
  if (!fin(x.duration)) return no('invalid');
  if (!fin(x.bpm)) return no('invalid');
  const duration = ms(x.duration);
  const bpm = Math.round(x.bpm * 100) / 100;
  if (!(duration >= 30 && duration <= 900)) return no('duration');
  if (!(bpm >= 60 && bpm <= 220)) return no('bpm');
  if (!Array.isArray(x.beats) || !Array.isArray(x.downbeats) || !Array.isArray(x.sections)) return no('invalid');
  const raw = x.beats as unknown[];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (!fin(t) || t < -0.0015 || t > x.duration + 0.0015 || (i > 0 && t <= (raw[i - 1] as number))) return no('invalid');
  }
  const beats = (raw as number[]).map(ms);
  if (beats.length < 16) return no('beat-count');
  for (let i = 0; i < beats.length; i++) if (beats[i] < 0 || beats[i] > duration + 0.002 || (i > 0 && !(beats[i] > beats[i - 1]))) return no('beats');
  const span = beats[beats.length - 1] - beats[0];
  if (span < 0.6 * duration) return no('beat-span');
  const expected = (bpm * span) / 60;
  if (Math.abs(beats.length - 1 - expected) > 0.1 * expected) return no('beat-count');
  const iv = beats.slice(1).map((t, i) => t - beats[i]).sort((a, b) => a - b);
  const med = iv.length % 2 ? iv[(iv.length - 1) / 2] : (iv[iv.length / 2 - 1] + iv[iv.length / 2]) / 2;
  if (Math.abs(med - 60 / bpm) > 0.05 * (60 / bpm)) return no('beat-interval');
  const downbeats: number[] = [];
  for (const d of x.downbeats as unknown[]) {
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d >= beats.length || (downbeats.length && d <= downbeats[downbeats.length - 1])) return no('invalid');
    downbeats.push(d);
  }
  const sections: SharedSection[] = [];
  const rs = x.sections as Record<string, unknown>[];
  if (!rs.length || rs.length > 64) return no(rs.length ? 'sections' : 'invalid');
  for (const r of rs) {
    if (!fin(r.start) || !fin(r.end) || !fin(r.energy) || typeof r.type !== 'string') return no('invalid');
    if (!(r.end > r.start) || r.start < -0.0015 || r.end > x.duration + 0.0015) return no('invalid');
    if (sections.length && r.start < sections[sections.length - 1].end - 0.0015) return no('invalid');
    if (!SECTION_TYPES.includes(r.type) || r.energy < 0 || r.energy > 1) return no('invalid');
    sections.push({ start: ms(r.start), end: ms(r.end), type: r.type, energy: Math.round(r.energy * 1000) / 1000 });
  }
  for (let i = 0; i < sections.length; i++) {
    const prevEnd = i === 0 ? 0 : sections[i - 1].end;
    if (Math.abs(sections[i].start - prevEnd) > 0.002) return no('sections');
  }
  if (Math.abs(sections[sections.length - 1].end - duration) > 0.002) return no('sections');
  return {
    ok: true,
    map: { v: 1, analyzerVersion: x.analyzerVersion, videoId: x.videoId, duration, bpm, beats, downbeats, sections, source: x.source as 'tab' | 'device' },
  };
}

/** The workflow_dispatch body for a contributed map (compact JSON in the map_json input). */
export function mapDispatchBody(map: SharedMap): string {
  return JSON.stringify({ ref: WORKFLOW_REF, inputs: { map_json: JSON.stringify(map) } });
}

/**
 * workflow_dispatch runs of the Beat maps workflow in the last 24 h:
 * contributed-map runs (by run name) and all others. Soft: runs beyond the
 * first page of 100 count as add runs.
 */
async function countRuns(base: string, headers: Record<string, string>, fetchFn: FetchFn, now: Date): Promise<{ ok: true; adds: number; maps: number } | { ok: false; error: string }> {
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  try {
    const res = await fetchFn(`${base}/runs?event=workflow_dispatch&per_page=100&created=${encodeURIComponent(`>=${since}`)}`, { headers });
    if (!res.ok) return { ok: false, error: `github-${res.status}` };
    const body = (await res.json()) as { total_count?: unknown; workflow_runs?: unknown };
    const total = Number(body.total_count);
    if (!Number.isFinite(total)) return { ok: false, error: 'github-count' };
    const runs = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
    const maps = runs.filter((r) => typeof (r as { display_title?: unknown })?.display_title === 'string' && (r as { display_title: string }).display_title.startsWith(MAP_RUN_TITLE)).length;
    return { ok: true, maps, adds: Math.max(0, total - maps) };
  } catch {
    return { ok: false, error: 'github-unreachable' };
  }
}

async function handleMap(req: Request, env: Env, fetchFn: FetchFn, now: Date, cors: Record<string, string>, repo: string): Promise<Response> {
  if (Number(req.headers.get('Content-Length') ?? '0') > MAP_MAX_BYTES) return fail(413, 'bad-request', cors, 'too-large');
  let text: string;
  try {
    text = await req.text();
  } catch {
    return fail(400, 'bad-request', cors, 'body');
  }
  if (new TextEncoder().encode(text).length > MAP_MAX_BYTES) return fail(413, 'bad-request', cors, 'too-large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'bad-request', cors, 'json');
  }
  const checked = validateSharedMap(body);
  if (!checked.ok) return fail(400, 'bad-map', cors, checked.rule);
  const base = `${GITHUB_API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}`;
  const headers = githubHeaders(env.GITHUB_TOKEN!);
  const limit = Math.max(1, Math.floor(Number(env.MAP_DAILY_LIMIT) || DEFAULT_MAP_DAILY_LIMIT));
  const count = await countRuns(base, headers, fetchFn, now);
  if (!count.ok) return fail(502, count.error, cors);
  if (count.maps >= limit) return fail(429, 'daily-limit', cors);
  try {
    const res = await fetchFn(`${base}/dispatches`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: mapDispatchBody(checked.map),
    });
    if (res.status !== 204 && !res.ok) return fail(502, `github-${res.status}`, cors);
  } catch {
    return fail(502, 'github-unreachable', cors);
  }
  return json(200, { ok: true, videoId: checked.map.videoId }, cors);
}

/** The same workflow inputs the web app's direct-token path sends (an empty length is looked up by the job). */
export function dispatchBody(song: Song, queue: Song[]): string {
  const inputs: Record<string, string> = {
    add_artist: song.artist,
    add_title: song.title,
    add_duration: song.durationSec !== undefined ? String(song.durationSec) : '',
  };
  if (queue.length) inputs.add_queue = JSON.stringify(queue.map((q) => ({ artist: q.artist, title: q.title, duration: q.durationSec })));
  return JSON.stringify({ ref: WORKFLOW_REF, inputs });
}

interface Wanted {
  trackId: number;
  details?: ClientDetails;
}

export async function handle(
  req: Request,
  env: Env,
  fetchFn: FetchFn = (i, init) => fetch(i, init),
  now: () => Date = () => new Date(),
  opts: HandleOptions = {},
): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin, env);
  const originOk = Object.keys(cors).length > 0;
  const repo = (env.GITHUB_REPO ?? '').trim();
  const configured = REPO_RE.test(repo) && !!env.GITHUB_TOKEN;
  const limit = Math.max(1, Math.floor(Number(env.DAILY_LIMIT) || DEFAULT_DAILY_LIMIT));
  const timeoutMs = opts.appleTimeoutMs ?? APPLE_TIMEOUT_MS;

  if (req.method === 'OPTIONS') {
    return originOk ? new Response(null, { status: 204, headers: cors }) : fail(403, 'bad-origin', {});
  }
  if (url.pathname === '/health') {
    if (req.method !== 'GET') return fail(405, 'bad-request', cors);
    const health: Record<string, unknown> = {
      ok: configured,
      repo: REPO_RE.test(repo) ? repo : null,
      passphrase: !!env.ADD_PASSPHRASE,
      dailyLimit: limit,
      mapDailyLimit: Math.max(1, Math.floor(Number(env.MAP_DAILY_LIMIT) || DEFAULT_MAP_DAILY_LIMIT)),
    };
    if (url.searchParams.get('probe') === '1') health.apple = await probeApple(fetchFn, timeoutMs);
    return json(200, health, cors);
  }
  if (url.pathname !== '/add' && url.pathname !== '/map') return fail(404, 'bad-request', cors);
  if (req.method !== 'POST') return fail(405, 'bad-request', cors);
  if (!originOk) return fail(403, 'bad-origin', {});
  if (!/^application\/json\b/i.test(req.headers.get('Content-Type') ?? '')) return fail(415, 'bad-request', cors, 'content-type');
  if (env.ADD_PASSPHRASE && !safeEqual(req.headers.get(PASS_HEADER) ?? '', env.ADD_PASSPHRASE)) return fail(401, 'passphrase', cors);
  if (!configured) return fail(500, 'not-configured', cors);
  if (url.pathname === '/map') return handleMap(req, env, fetchFn, now(), cors, repo);
  if (Number(req.headers.get('Content-Length') ?? '0') > MAX_BODY_BYTES) return fail(413, 'bad-request', cors, 'too-large');

  let text: string;
  try {
    text = await req.text();
  } catch {
    return fail(400, 'bad-request', cors, 'body');
  }
  if (text.length > MAX_BODY_BYTES) return fail(413, 'bad-request', cors, 'too-large');
  let body: { trackId?: unknown; song?: unknown; queue?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, 'bad-request', cors, 'json');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad-request', cors, 'json');
  const trackId = toTrackId(body.trackId);
  if (!trackId) return fail(400, 'bad-request', cors, 'track-id');
  const main = parseClientDetails(body.song);
  if (!main.ok) return fail(400, 'bad-request', cors, main.field);
  if (body.queue !== undefined && !Array.isArray(body.queue)) return fail(400, 'bad-request', cors, 'queue');

  const queued: Wanted[] = [];
  for (const raw of (body.queue as unknown[] | undefined) ?? []) {
    const isObj = !!raw && typeof raw === 'object' && !Array.isArray(raw);
    const id = toTrackId(isObj ? (raw as Record<string, unknown>).trackId : raw);
    const d = parseClientDetails(isObj ? (raw as Record<string, unknown>).song : undefined);
    if (!d.ok) return fail(400, 'bad-request', cors, `queue-${d.field}`);
    if (id === null || id === trackId || queued.some((q) => q.trackId === id)) continue;
    if (queued.length < MAX_QUEUE) queued.push({ trackId: id, details: d.details });
  }

  const looked = await lookupTracks([trackId, ...queued.map((q) => q.trackId)], fetchFn, timeoutMs);
  let song: Song;
  let queue: Song[];
  let source: 'apple' | 'client';
  let detail: string | undefined;
  if (looked.ok) {
    const s = looked.songs.get(trackId);
    if (!s) return fail(404, 'not-found', cors, looked.reasons.get(trackId) ?? 'apple-not-listed');
    song = s;
    queue = queued.map((q) => looked.songs.get(q.trackId)).filter((x): x is Song => !!x);
    source = 'apple';
  } else {
    // Apple gave no usable answer: use what the app found in its own iTunes search.
    if (!main.details) return fail(502, 'lookup-failed', cors, looked.detail);
    const fromClient = (id: number, d: ClientDetails): Song => ({ trackId: id, ...d, artworkUrl: '' });
    song = fromClient(trackId, main.details);
    queue = queued.filter((q) => q.details).map((q) => fromClient(q.trackId, q.details!));
    source = 'client';
    detail = looked.detail;
  }

  const base = `${GITHUB_API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}`;
  const headers = githubHeaders(env.GITHUB_TOKEN!);

  // Soft daily cap: workflow_dispatch runs of this workflow created in the last 24 h (contributed-map runs have their own).
  const count = await countRuns(base, headers, fetchFn, now());
  if (!count.ok) return fail(502, count.error, cors);
  if (count.adds >= limit) return fail(429, 'daily-limit', cors);

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
  return json(200, { ok: true, source, song, ...(detail ? { detail } : {}) }, cors);
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env);
  },
};
