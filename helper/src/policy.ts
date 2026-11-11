/**
 * Request policy for the helper's local HTTP server: which pages may talk to
 * it, which requests are accepted, rate and concurrency limits, and how
 * yt-dlp failures map to the plain error codes the web app understands.
 *
 * Pure (no Deno APIs), so it is unit-tested directly.
 */
import { classifyYtDlpError } from '../../tools/beatmaps/classify.ts';

export const PORTS = [47800, 47801, 47802] as const;
export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
export const MAX_DURATION_S = 15 * 60;
export const MAX_BODY_BYTES = 1024;

/** http://localhost:<any port> and http://127.0.0.1:<any port>: local dev servers. */
const DEV_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

/** Codes returned to the page. The first five come from yt-dlp failures. */
export type ErrorCode =
  | 'blocked'
  | 'outdated'
  | 'unavailable'
  | 'network'
  | 'error'
  | 'not-ready'
  | 'busy'
  | 'rate-limited'
  | 'bad-request'
  | 'forbidden'
  | 'not-found';

/**
 * A config / baked origin as a bare origin ("https://me.github.io"), or null
 * when it is not a plain http(s) origin. A pasted site address keeps only its
 * origin.
 */
export function normalizeOrigin(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || !u.hostname) return null;
  return u.origin;
}

export interface OriginPolicy {
  /** Exact origins allowed to use the helper (baked Pages origin + config file). */
  allowed: ReadonlySet<string>;
  /** Also allow http://localhost:* and http://127.0.0.1:* (dev servers). */
  allowDev: boolean;
}

/** May a page with this Origin use the API? (The helper's own status page is handled separately.) */
export function isAllowedOrigin(origin: string | null, p: OriginPolicy): boolean {
  if (!origin || origin === 'null') return false;
  if (p.allowed.has(origin)) return true;
  return p.allowDev && DEV_ORIGIN_RE.test(origin);
}

/** The helper's own origins (its status page). */
export function ownOrigins(port: number): string[] {
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
}

/**
 * Host header must name this loopback server. Blocks DNS-rebinding, where a
 * hostile site points its own hostname at 127.0.0.1 to become "same origin".
 */
export function isLoopbackHost(host: string | null, port: number): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === `127.0.0.1:${port}` || h === `localhost:${port}`;
}

// ---------------------------------------------------------------------------
// Limits

export interface LimiterOptions {
  maxConcurrent: number;
  maxPerWindow: number;
  windowMs: number;
  now?: () => number;
}

export type Acquire = { ok: true; release: () => void } | { ok: false; code: 'busy' | 'rate-limited'; retryAfterS: number };

/** Concurrency limit plus a sliding-window rate limit for /audio. */
export class Limiter {
  private running = 0;
  private starts: number[] = [];
  private readonly now: () => number;

  constructor(private readonly o: LimiterOptions) {
    this.now = o.now ?? (() => Date.now());
  }

  active(): number {
    return this.running;
  }

  tryAcquire(): Acquire {
    const t = this.now();
    this.starts = this.starts.filter((s) => t - s < this.o.windowMs);
    if (this.running >= this.o.maxConcurrent) return { ok: false, code: 'busy', retryAfterS: 5 };
    if (this.starts.length >= this.o.maxPerWindow) {
      const wait = Math.ceil((this.o.windowMs - (t - this.starts[0])) / 1000);
      return { ok: false, code: 'rate-limited', retryAfterS: Math.max(1, wait) };
    }
    this.starts.push(t);
    this.running++;
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        this.running--;
      },
    };
  }
}

export const DEFAULT_LIMITS: LimiterOptions = { maxConcurrent: 2, maxPerWindow: 8, windowMs: 60_000 };

// ---------------------------------------------------------------------------
// yt-dlp failures -> page codes

export interface Failure {
  code: ErrorCode;
  /** One plain sentence for the status page / console. */
  message: string;
  /** The relevant yt-dlp line (for the log; never shown to other sites). */
  detail?: string;
}

const FRIENDLY: Partial<Record<ErrorCode, string>> = {
  blocked: 'YouTube is asking this computer to prove it is not a bot. Try again in an hour or so.',
  outdated: 'YouTube changed something. The helper updates its downloader by itself; if this keeps happening, download the newest helper.',
  unavailable: 'This video is private, removed, region-locked or age-restricted.',
  network: 'Could not reach YouTube. Check the internet connection.',
  error: 'The download did not work.',
};

/** Map a failed yt-dlp run (stderr text) to a page code, as tools/beatmaps/classify.ts does for the cloud job. */
export function classifyFailure(stderr: string): Failure {
  const c = classifyYtDlpError(stderr);
  let code: ErrorCode = c.kind;
  if (c.kind === 'error' && /^Network error/.test(c.summary)) code = 'network';
  return { code, message: FRIENDLY[code] ?? c.summary, detail: c.detail };
}

/** yt-dlp exited 0 but wrote no file: why (from its stdout). */
export function classifyNoFile(stdout: string): Failure {
  if (/does not pass filter/i.test(stdout)) {
    return { code: 'unavailable', message: 'Live streams and songs longer than 15 minutes are skipped.' };
  }
  if (/larger than max-filesize|File is larger than/i.test(stdout)) {
    return { code: 'unavailable', message: 'The audio is larger than 40 MB.' };
  }
  return { code: 'error', message: 'yt-dlp finished without producing an audio file.' };
}

/** Status code for each page code. */
export function httpStatus(code: ErrorCode): number {
  switch (code) {
    case 'bad-request':
      return 400;
    case 'forbidden':
      return 403;
    case 'not-found':
      return 404;
    case 'unavailable':
      return 422;
    case 'busy':
    case 'rate-limited':
      return 429;
    case 'not-ready':
      return 503;
    default:
      return 502;
  }
}

export function audioContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'm4a':
    case 'mp4':
    case 'aac':
      return 'audio/mp4';
    case 'webm':
    case 'weba':
      return 'audio/webm';
    case 'opus':
    case 'ogg':
      return 'audio/ogg';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

/**
 * yt-dlp format choice: audio only, no post-processing (no ffmpeg).
 * Opus/WebM first, then AAC/M4A. Measured in Chrome: beats found in the
 * browser-decoded Opus stream match the cloud maps (median 0 ms), while
 * browser-decoded AAC came out ~30 ms late (the AAC encoder delay is not
 * trimmed by decodeAudioData). The cloud job's `bestaudio` is Opus too.
 */
export const AUDIO_FORMAT =
  'ba[ext=webm][protocol^=http]/ba[ext=m4a][protocol^=http]/ba[protocol^=http][acodec!=none]';
