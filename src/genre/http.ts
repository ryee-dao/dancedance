/**
 * A polite JSON client for the public genre sources, usable from Node and the
 * page (inject `fetch`, the clock and `sleep`).
 *
 *  - at most one request in flight per host, and a pause between requests to
 *    the same host (`spacingMs`, measured from the end of the previous one);
 *  - HTTP 429 and 5xx: honour Retry-After (seconds or a date), else wait
 *    exponentially longer (base * 2^attempt, capped); the whole host waits,
 *    and after a 429 its spacing doubles for the rest of the session;
 *  - a network error (which is also how a browser sees a 429 that carries no
 *    CORS header) is retried the same way, fewer times;
 *  - other 4xx answers are final for that URL.
 *
 * `gate` (page only) is awaited before every request, so background lookups
 * can wait while a song plays.
 */

export type GenreFetch = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'json'>>;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    /** Worth asking again later (rate limit, server trouble, network). */
    readonly transient: boolean,
    message: string,
  ) {
    super(message);
  }
}

export interface PoliteOptions {
  fetch: GenreFetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /**
   * Node only: a generic client name sent as User-Agent (and Api-User-Agent
   * for Wikimedia). Browsers send their own; setting headers there would add
   * a CORS preflight, so leave it out on the page.
   */
  userAgent?: string;
  /** Pause between requests to one host, ms (default 1000; see DEFAULT_SPACING). */
  spacingMs?: (host: string) => number;
  /** Retries after a 429 / 5xx (default 4) and after a network error (default 2). */
  maxRetries?: number;
  maxNetworkRetries?: number;
  /** First backoff wait, ms (default 2000), doubled per attempt, capped at maxBackoffMs (default 120 s). */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  /** Per-request timeout, ms (default 20 s). */
  timeoutMs?: number;
  /** Awaited before each request (e.g. "not while a song is playing"). */
  gate?: () => Promise<void>;
  log?: (line: string) => void;
}

/** Spacing per host: Wikimedia and MusicBrainz ask for about one request a second; TheAudioDB's free key allows 30 a minute; iTunes about 20. */
export function defaultSpacing(host: string): number {
  if (/(?:^|\.)itunes\.apple\.com$/.test(host)) return 3000;
  if (/(?:^|\.)theaudiodb\.com$/.test(host)) return 2100;
  if (/(?:^|\.)musicbrainz\.org$/.test(host)) return 1100;
  return 1000;
}

/** Retry-After as milliseconds (delta seconds or an HTTP date), or null. */
export function parseRetryAfter(value: string | null | undefined, nowMs: number): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(v)) return Math.round(Number(v) * 1000);
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, t - nowMs) : null;
}

interface HostState {
  /** Tail of this host's queue. */
  chain: Promise<unknown>;
  /** Earliest time the next request may start. */
  nextAt: number;
  /** Extra multiplier after 429s. */
  slow: number;
  /** The host asked for a longer pause than we wait in one go: fail fast until then. */
  closedUntil: number;
}

export class PoliteHttp {
  private hosts = new Map<string, HostState>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  /** Requests actually sent, per host (for reports and tests). */
  readonly sent = new Map<string, number>();

  constructor(private readonly o: PoliteOptions) {
    this.now = o.now ?? (() => Date.now());
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** GET a JSON document. Rejects with HttpError. */
  getJson(url: string): Promise<unknown> {
    const host = new URL(url).host;
    let h = this.hosts.get(host);
    if (!h) this.hosts.set(host, (h = { chain: Promise.resolve(), nextAt: 0, slow: 1, closedUntil: 0 }));
    const state = h;
    const run = state.chain.then(() => this.send(url, host, state));
    state.chain = run.catch(() => undefined);
    return run;
  }

  private spacing(host: string, state: HostState): number {
    return Math.round((this.o.spacingMs ?? defaultSpacing)(host) * state.slow);
  }

  private async waitTurn(state: HostState): Promise<void> {
    for (;;) {
      const wait = state.nextAt - this.now();
      if (wait > 0) await this.sleep(wait);
      if (this.o.gate) await this.o.gate();
      if (state.nextAt - this.now() <= 0) return;
    }
  }

  private async send(url: string, host: string, state: HostState): Promise<unknown> {
    const maxRetries = this.o.maxRetries ?? 4;
    const maxNet = this.o.maxNetworkRetries ?? 2;
    const base = this.o.baseBackoffMs ?? 2000;
    const cap = this.o.maxBackoffMs ?? 120_000;
    let attempt = 0;
    let netFailures = 0;
    for (;;) {
      if (this.now() < state.closedUntil) throw new HttpError(429, true, 'the host asked us to wait');
      await this.waitTurn(state);
      this.sent.set(host, (this.sent.get(host) ?? 0) + 1);
      let res: Awaited<ReturnType<GenreFetch>> | null = null;
      let netError: unknown = null;
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), this.o.timeoutMs ?? 20_000) : null;
      try {
        const headers: Record<string, string> = {};
        if (this.o.userAgent) {
          headers['User-Agent'] = this.o.userAgent;
          headers['Api-User-Agent'] = this.o.userAgent;
        }
        res = await this.o.fetch(url, { headers, signal: ctl?.signal, credentials: 'omit' });
      } catch (e) {
        netError = e;
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
      const done = this.now();
      state.nextAt = Math.max(state.nextAt, done + this.spacing(host, state));
      if (netError || !res) {
        if (netFailures++ >= maxNet) throw new HttpError(0, true, `network error (${String((netError as Error)?.message ?? netError)})`);
        const wait = Math.min(cap, base * 2 ** netFailures);
        this.o.log?.(`  ${host}: network error, waiting ${Math.round(wait / 1000)} s`);
        state.nextAt = Math.max(state.nextAt, done + wait);
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (res.status === 429) state.slow = Math.min(8, state.slow * 2);
        if (attempt >= maxRetries) throw new HttpError(res.status, true, `HTTP ${res.status}`);
        const ra = parseRetryAfter(res.headers?.get?.('retry-after'), done);
        if (ra !== null && ra > cap) {
          state.closedUntil = done + ra;
          throw new HttpError(res.status, true, `HTTP ${res.status}, asked to wait ${Math.round(ra / 1000)} s`);
        }
        const wait = Math.min(cap, Math.max(ra ?? 0, base * 2 ** attempt));
        attempt++;
        this.o.log?.(`  ${host}: HTTP ${res.status}, waiting ${Math.round(wait / 1000)} s`);
        state.nextAt = Math.max(state.nextAt, done + wait);
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, false, `HTTP ${res.status}`);
      try {
        return await res.json();
      } catch {
        throw new HttpError(res.status, true, 'unreadable JSON');
      }
    }
  }
}
