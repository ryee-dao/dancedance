/**
 * The optional DanceDance helper (helper/): a small app a friend runs on
 * their computer that downloads a song's audio with yt-dlp, so the page can
 * find the beat locally (source 'device') when there is no cloud map.
 *
 * Talks to http://127.0.0.1:<47800|47801|47802>. Web platform only.
 *
 * Chrome/Edge (and Firefox) ask the user before a public site may talk to
 * apps on the same computer ("Local Network Access"), and the very first
 * request triggers that prompt. So the page only probes when it is likely to
 * be wanted: on a local dev server, when the browser already granted the
 * permission, or after the user opted in (opened DanceDance from the
 * helper's own page, clicked "Get the helper" or "Check again").
 */

export const HELPER_PORTS = [47800, 47801, 47802] as const;

export type HelperCode =
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
  | 'not-found'
  | 'unreachable'
  | 'aborted'
  | 'timeout';

const KNOWN_CODES = new Set<string>([
  'blocked', 'outdated', 'unavailable', 'network', 'error', 'not-ready', 'busy', 'rate-limited', 'bad-request', 'forbidden', 'not-found',
]);

export class HelperError extends Error {
  constructor(
    readonly code: HelperCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'HelperError';
  }
}

export interface HelperInfo {
  port: number;
  version: string;
  ytdlp: string | null;
  platform: string;
  /** yt-dlp is installed and verified. */
  ready: boolean;
  state: 'preparing' | 'ready' | 'error';
}

export interface HelperProgress {
  /** 'download': the helper is getting the song from YouTube; 'transfer': bytes are coming to the page. */
  phase: 'download' | 'transfer';
  fraction: number | null;
}

export interface FetchAudioOptions {
  onProgress?: (p: HelperProgress) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** What BeatSession needs (Platform.localHelper). */
export interface LocalHelper {
  /** Last probe result, without probing (null = not running or not checked). */
  info(): HelperInfo | null;
  /** The running, ready helper, or null. Fast: uses the cached probe when fresh. */
  available(): Promise<HelperInfo | null>;
  fetchAudio(videoId: string, opts?: FetchAudioOptions): Promise<ArrayBuffer>;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface HelperClientOptions {
  fetch?: FetchFn;
  ports?: readonly number[];
  probeTimeoutMs?: number;
  /** A probe result is reused this long. */
  maxAgeMs?: number;
  now?: () => number;
  /** Whether probing is allowed right now (see the file comment). */
  canProbe?: () => boolean | Promise<boolean>;
  pollMs?: number;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Validate a /health answer. */
export function parseHealth(data: unknown, port: number): HelperInfo | null {
  const d = data as Record<string, unknown> | null;
  if (!d || d.ok !== true || d.app !== 'dancedance-helper' || typeof d.version !== 'string') return null;
  const state = d.state === 'ready' || d.state === 'error' ? d.state : 'preparing';
  return {
    port,
    version: d.version.slice(0, 40),
    ytdlp: typeof d.ytdlp === 'string' ? d.ytdlp.slice(0, 40) : null,
    platform: typeof d.platform === 'string' ? d.platform.slice(0, 40) : '',
    ready: d.ready === true,
    state,
  };
}

export class HelperClient extends EventTarget {
  private last: HelperInfo | null = null;
  private checkedAt = -Infinity;
  private inflight: Promise<HelperInfo | null> | null = null;
  private readonly fetchFn: FetchFn;
  private readonly ports: readonly number[];
  private readonly now: () => number;

  constructor(private readonly o: HelperClientOptions = {}) {
    super();
    this.fetchFn = o.fetch ?? ((u, i) => fetch(u, i));
    this.ports = o.ports ?? HELPER_PORTS;
    this.now = o.now ?? (() => Date.now());
  }

  /** Last probe result (null = not running / not probed). */
  info(): HelperInfo | null {
    return this.last;
  }

  /** Whether a probe has run at all (to tell "not running" from "not checked"). */
  checked(): boolean {
    return this.checkedAt > -Infinity;
  }

  /** Probe the ports (deduplicated; cached for maxAgeMs unless `force`). */
  detect(opts: { force?: boolean } = {}): Promise<HelperInfo | null> {
    if (this.inflight) return this.inflight;
    if (!opts.force && this.now() - this.checkedAt < (this.o.maxAgeMs ?? 60_000)) return Promise.resolve(this.last);
    this.inflight = this.probe().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async probe(): Promise<HelperInfo | null> {
    const allowed = this.o.canProbe ? await this.o.canProbe() : true;
    let found: HelperInfo | null = null;
    if (allowed) {
      // Preferred port first; the fallbacks only if it isn't answering.
      const order = this.last ? [this.last.port, ...this.ports.filter((p) => p !== this.last!.port)] : [...this.ports];
      for (const port of order) {
        found = await this.probePort(port);
        if (found) break;
      }
    }
    const before = JSON.stringify(this.last);
    this.last = found;
    this.checkedAt = this.now();
    if (JSON.stringify(found) !== before) this.dispatchEvent(new Event('change'));
    return found;
  }

  private async probePort(port: number): Promise<HelperInfo | null> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.o.probeTimeoutMs ?? 1200);
    try {
      const res = await this.fetchFn(`http://127.0.0.1:${port}/health`, { signal: ctl.signal, cache: 'no-store' });
      if (!res.ok) return null;
      return parseHealth(await res.json(), port);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async available(): Promise<HelperInfo | null> {
    let info = await this.detect();
    // Still downloading its tools when last seen: look again (it may be ready now).
    if (info && !info.ready) info = await this.detect({ force: true });
    return info?.ready ? info : null;
  }

  /** The song's encoded audio (M4A or WebM) from the helper. Rejects with a HelperError. */
  async fetchAudio(videoId: string, opts: FetchAudioOptions = {}): Promise<ArrayBuffer> {
    if (!VIDEO_ID.test(videoId)) throw new HelperError('bad-request');
    const info = this.last ?? (await this.detect());
    if (!info) throw new HelperError('unreachable');
    const base = `http://127.0.0.1:${info.port}`;
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, opts.timeoutMs ?? 90_000);
    const onAbort = () => ctl.abort();
    opts.signal?.addEventListener('abort', onAbort);
    if (opts.signal?.aborted) ctl.abort();

    // While the helper downloads from YouTube, read its progress from /status.
    let polling = true;
    const poll = async () => {
      while (polling) {
        await new Promise((r) => setTimeout(r, this.o.pollMs ?? 700));
        if (!polling) break;
        try {
          const s = (await (await this.fetchFn(`${base}/status`, { cache: 'no-store', signal: ctl.signal })).json()) as {
            current?: { videoId?: string; fraction?: number | null }[];
          };
          const job = s.current?.find((j) => j.videoId === videoId);
          if (job && polling) opts.onProgress?.({ phase: 'download', fraction: typeof job.fraction === 'number' ? job.fraction : null });
        } catch {
          /* progress is best effort */
        }
      }
    };
    opts.onProgress?.({ phase: 'download', fraction: null });
    void poll();

    try {
      let res: Response;
      try {
        res = await this.fetchFn(`${base}/audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
          signal: ctl.signal,
          cache: 'no-store',
        });
      } catch {
        if (timedOut) throw new HelperError('timeout');
        if (opts.signal?.aborted) throw new HelperError('aborted');
        // The helper went away: forget it so the next song doesn't wait for it.
        this.last = null;
        this.checkedAt = this.now();
        this.dispatchEvent(new Event('change'));
        throw new HelperError('unreachable');
      }
      polling = false;
      if (!res.ok) {
        let code: HelperCode = 'error';
        let message: string | undefined;
        try {
          const j = (await res.json()) as { code?: string; message?: string };
          if (j.code && KNOWN_CODES.has(j.code)) code = j.code as HelperCode;
          if (typeof j.message === 'string') message = j.message.slice(0, 300);
        } catch {
          /* not JSON */
        }
        throw new HelperError(code, message);
      }
      const total = Number(res.headers.get('Content-Length')) || 0;
      if (!res.body || !total) return await res.arrayBuffer();
      const out = new Uint8Array(total);
      let got = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (got + value.byteLength > total) throw new HelperError('error', 'More data than announced');
        out.set(value, got);
        got += value.byteLength;
        opts.onProgress?.({ phase: 'transfer', fraction: got / total });
      }
      return out.buffer;
    } catch (err) {
      if (err instanceof HelperError) throw err;
      throw new HelperError(timedOut ? 'timeout' : opts.signal?.aborted ? 'aborted' : 'error');
    } finally {
      polling = false;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }
}

// ---------------------------------------------------------------------------
// The web app's shared client.

const OPT_IN_KEY = 'dd.helper';

/** Remember that this browser wants the helper (so probing, and the browser's permission prompt, are expected). */
export function setHelperOptIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(OPT_IN_KEY, '1');
    else localStorage.removeItem(OPT_IN_KEY);
  } catch {
    /* storage blocked: probing just stays off */
  }
}

export function helperOptedIn(): boolean {
  try {
    return localStorage.getItem(OPT_IN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Local dev pages, opt-in, or an already granted local-network permission. */
export async function defaultCanProbe(): Promise<boolean> {
  if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return true;
  if (helperOptedIn()) return true;
  const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
  if (!perms?.query) return false;
  for (const name of ['loopback-network', 'local-network-access', 'local-network']) {
    try {
      const st = await perms.query({ name } as unknown as PermissionDescriptor);
      if (st.state === 'granted') return true;
      if (st.state === 'denied') return false;
    } catch {
      /* unknown permission name in this browser */
    }
  }
  return false;
}

let shared: HelperClient | null = null;

/** The app-wide client; re-probes when the tab regains focus and every couple of minutes. */
export function webHelper(): HelperClient {
  if (shared) return shared;
  const client = new HelperClient({ canProbe: defaultCanProbe });
  shared = client;
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('helper') === '1') setHelperOptIn(true);
    } catch {
      /* ignore */
    }
    const refresh = () => {
      if (document.visibilityState === 'visible') void client.detect({ force: !client.info() });
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    setInterval(() => {
      if (document.visibilityState === 'visible') void client.detect({ force: true });
    }, 120_000);
    void client.detect();
  }
  return client;
}

/** Where friends download the helper (a release updated in place; see README "Helper app"). */
export function helperDownloadUrl(repo: { owner: string; repo: string } | null): string {
  const r = repo ?? { owner: 'ryee-dao', repo: 'dancedance' };
  return `https://github.com/${r.owner}/${r.repo}/releases/tag/helper`;
}

/** One plain sentence for a failure code (Options / logs). */
export function describeHelperError(code: HelperCode): string {
  switch (code) {
    case 'blocked':
      return 'YouTube is asking this computer to prove it isn’t a bot. Try again in an hour or so.';
    case 'outdated':
      return 'YouTube changed something. The helper updates itself; if it keeps happening, download the newest helper.';
    case 'unavailable':
      return 'This video can’t be downloaded (private, removed, region-locked, live or over 15 minutes).';
    case 'network':
      return 'The helper couldn’t reach YouTube.';
    case 'not-ready':
      return 'The helper is still getting ready.';
    case 'unreachable':
      return 'The helper isn’t running.';
    default:
      return 'The helper couldn’t get this song.';
  }
}
