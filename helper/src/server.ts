/**
 * The helper's HTTP API (bound to 127.0.0.1 only by main.ts).
 *
 *   GET  /        status page (also opened in the browser at start)
 *   GET  /health  { ok, app, version, ytdlp, platform, ready, state, progress }
 *   GET  /status  health + current downloads + recent results/errors
 *   POST /audio   { "videoId": "<11 chars>" } -> the song's audio bytes
 *   POST /quit    from the status page only
 *
 * Every request: the Host header must be 127.0.0.1:<port> or localhost:<port>,
 * and a request carrying an Origin must come from an allowed origin (or the
 * status page itself). POST /audio additionally requires an allowed Origin
 * and Content-Type: application/json, so it always goes through a CORS
 * preflight. The page never supplies URLs, paths or yt-dlp arguments: only
 * an 11-character video ID.
 *
 * Built on web-standard Request/Response and injected dependencies, so it is
 * unit-tested without a network.
 */
import {
  type Acquire,
  type ErrorCode,
  httpStatus,
  isAllowedOrigin,
  isLoopbackHost,
  MAX_BODY_BYTES,
  type OriginPolicy,
  ownOrigins,
  VIDEO_ID_RE,
} from './policy.ts';

export interface AudioResult {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}

/** Thrown by getAudio with a page code. */
export class AudioFailure extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AudioFailure';
  }
}

export interface Health {
  ok: true;
  app: 'dancedance-helper';
  version: string;
  ytdlp: string | null;
  platform: string;
  ready: boolean;
  state: 'preparing' | 'ready' | 'error';
  /** Tool download progress 0..1 while preparing. */
  progress: number | null;
  message: string | null;
}

export interface HandlerDeps {
  port: number;
  origins: OriginPolicy;
  health(): Health;
  /** Extra fields for GET /status (current jobs, recent results). */
  status(): Record<string, unknown>;
  acquire(): Acquire;
  getAudio(videoId: string, signal: AbortSignal): Promise<AudioResult>;
  statusPage(): string;
  quit(): void;
}

const ALLOWED_METHODS = 'GET, POST';
const ALLOWED_HEADERS = 'Content-Type';

function baseHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
}

function cors(h: Headers, origin: string | null): Headers {
  if (origin) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  }
  h.append('Vary', 'Origin');
  return h;
}

function json(body: unknown, status: number, origin: string | null, extra: Record<string, string> = {}): Response {
  const h = cors(baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...extra }), origin);
  return new Response(JSON.stringify(body), { status, headers: h });
}

function fail(code: ErrorCode, message: string, origin: string | null, extra: Record<string, string> = {}): Response {
  return json({ ok: false, code, message }, httpStatus(code), origin, extra);
}

/** Read at most `max` bytes of the body; null when larger. */
async function readSmallBody(req: Request, max: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

export function createHandler(d: HandlerDeps): (req: Request) => Promise<Response> {
  const own = new Set(ownOrigins(d.port));

  return async (req) => {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');

    // DNS rebinding guard: refuse any Host but our own loopback address.
    if (!isLoopbackHost(req.headers.get('Host') ?? url.host, d.port)) {
      return fail('forbidden', 'Wrong host.', null);
    }

    const external = isAllowedOrigin(origin, d.origins);
    const fromSelf = origin !== null && own.has(origin);
    // A request with an Origin header must be from an allowed page or from our own status page.
    if (origin !== null && !external && !fromSelf) {
      return fail('forbidden', 'This website is not allowed to use the DanceDance helper.', null);
    }
    const corsOrigin = external ? origin : null;

    if (req.method === 'OPTIONS') {
      // CORS preflight (+ Chrome's Private Network Access). Only allowed pages get here.
      if (!external) return fail('forbidden', 'Preflight from an unknown origin.', null);
      const method = (req.headers.get('Access-Control-Request-Method') ?? '').toUpperCase();
      const headers = (req.headers.get('Access-Control-Request-Headers') ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if ((method !== 'GET' && method !== 'POST') || headers.some((x) => x !== 'content-type')) {
        return fail('forbidden', 'Preflight asked for something the helper does not allow.', null);
      }
      const h = cors(baseHeaders(), origin);
      h.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
      h.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      h.set('Access-Control-Max-Age', '600');
      if ((req.headers.get('Access-Control-Request-Private-Network') ?? '').toLowerCase() === 'true') {
        h.set('Access-Control-Allow-Private-Network', 'true');
      }
      return new Response(null, { status: 204, headers: h });
    }

    const path = url.pathname;

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (path === '/' && origin === null) {
        const h = baseHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'",
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'no-referrer',
        });
        return new Response(req.method === 'HEAD' ? null : d.statusPage(), { status: 200, headers: h });
      }
      if (path === '/health') return json(d.health(), 200, corsOrigin);
      if (path === '/status') return json({ ...d.health(), ...d.status() }, 200, corsOrigin);
      return fail('not-found', 'Not found.', corsOrigin);
    }

    if (req.method !== 'POST') return fail('not-found', 'Not found.', corsOrigin);

    if (path === '/quit') {
      if (!fromSelf) return fail('forbidden', 'Only the helper’s own page can stop it.', null);
      setTimeout(() => d.quit(), 100);
      return json({ ok: true }, 200, null);
    }

    if (path !== '/audio') return fail('not-found', 'Not found.', corsOrigin);
    // State-changing: an allowed page only (no Origin = not a browser page we know).
    if (!external) return fail('forbidden', 'Requests must come from DanceDance in a browser.', null);
    const type = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') return fail('bad-request', 'Send JSON.', corsOrigin);

    const text = await readSmallBody(req, MAX_BODY_BYTES);
    if (text === null) return fail('bad-request', 'Request too large.', corsOrigin);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return fail('bad-request', 'Send JSON.', corsOrigin);
    }
    const videoId = (body as { videoId?: unknown } | null)?.videoId;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => k !== 'videoId') ||
      typeof videoId !== 'string' ||
      !VIDEO_ID_RE.test(videoId)
    ) {
      return fail('bad-request', 'Expected { "videoId": "<11-character YouTube video ID>" }.', corsOrigin);
    }

    const health = d.health();
    if (!health.ready) return fail('not-ready', 'The helper is still getting ready.', corsOrigin, { 'Retry-After': '10' });

    const slot = d.acquire();
    if (!slot.ok) {
      return fail(slot.code, slot.code === 'busy' ? 'The helper is busy with other songs.' : 'Too many songs at once. Wait a moment.', corsOrigin, {
        'Retry-After': String(slot.retryAfterS),
      });
    }
    try {
      const audio = await d.getAudio(videoId, req.signal);
      const h = cors(baseHeaders({ 'Content-Type': audio.contentType, 'Content-Length': String(audio.bytes.byteLength) }), corsOrigin);
      return new Response(audio.bytes as Uint8Array<ArrayBuffer>, { status: 200, headers: h });
    } catch (err) {
      if (err instanceof AudioFailure) return fail(err.code, err.message, corsOrigin);
      return fail('error', 'The download did not work.', corsOrigin);
    } finally {
      slot.release();
    }
  };
}
