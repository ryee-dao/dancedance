/**
 * Headless rendering helpers for the move tools (sheet.ts): a Vite dev server
 * on a free port and a local headless Chromium driven over the DevTools
 * protocol, with no extra dependencies.
 *
 * The browser is Playwright's cached headless shell
 * (~/Library/Caches/ms-playwright/chromium_headless_shell-*), launched
 * directly with --remote-debugging-port; Node's built-in WebSocket speaks
 * CDP to it. Override the binary with CHROME_BIN=/path/to/chrome. It never
 * touches the user's own Chrome profile: every run gets a fresh temporary
 * user-data-dir that is deleted afterwards.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const REPO = resolve(import.meta.dirname, '../..');

/** A free TCP port on localhost. */
export function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = netServer();
    s.unref();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      const port = typeof a === 'object' && a ? a.port : 0;
      s.close(() => res(port));
    });
  });
}

export interface DevServer {
  url: string;
  close(): Promise<void>;
}

/** Start the project's Vite dev server (or reuse one given as `url`). */
export async function startVite(url?: string): Promise<DevServer> {
  if (url) return { url: url.replace(/\/$/, ''), close: async () => {} };
  const { createServer } = await import('vite');
  const port = await freePort();
  const server = await createServer({
    root: REPO,
    configFile: join(REPO, 'vite.config.ts'),
    logLevel: 'error',
    clearScreen: false,
    server: { port, strictPort: true, host: '127.0.0.1', open: false, hmr: false, watch: null },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

/** The cached headless shell (newest revision), or CHROME_BIN. */
export function findChrome(): string {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const linux = join(homedir(), '.cache/ms-playwright');
  for (const root of [cache, linux]) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
    for (const d of dirs) {
      for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']) {
        const bin = join(root, d, sub, 'chrome-headless-shell');
        if (existsSync(bin)) return bin;
      }
    }
  }
  throw new Error('No headless Chromium found: set CHROME_BIN, or run `npx playwright install chromium-headless-shell` once.');
}

type Pending = { res: (v: unknown) => void; rej: (e: Error) => void };

/** One page over CDP. */
export class Page {
  private id = 0;
  private pending = new Map<number, Pending>();
  readonly errors: string[] = [];
  private constructor(private ws: WebSocket) {
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.rej(new Error(msg.error.message));
        else p.res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = (msg.params as { exceptionDetails?: { text?: string; exception?: { description?: string } } }).exceptionDetails;
        this.errors.push(d?.exception?.description ?? d?.text ?? 'exception');
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const p = msg.params as { type: string; args: { value?: unknown; description?: string }[] };
        if (p.type === 'error') this.errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
  }

  static async connect(wsUrl: string): Promise<Page> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((res, rej) => {
      ws.addEventListener('open', () => res(), { once: true });
      ws.addEventListener('error', () => rej(new Error(`CDP connect failed: ${wsUrl}`)), { once: true });
    });
    const p = new Page(ws);
    await p.send('Page.enable');
    await p.send('Runtime.enable');
    return p;
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<T>((res, rej) => this.pending.set(id, { res: res as (v: unknown) => void, rej }));
  }

  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send<{ result: { value?: T }; exceptionDetails?: { text: string; exception?: { description?: string } } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  }

  async viewport(width: number, height: number): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }

  /** Navigate and wait until `window.__demo.ready` (or `readyExpr`) is true. */
  async open(url: string, readyExpr = '!!(window.__demo && window.__demo.ready)', timeoutMs = 60_000): Promise<void> {
    this.errors.length = 0;
    await this.send('Page.navigate', { url });
    const t0 = Date.now();
    for (;;) {
      let ok = false;
      try {
        ok = await this.eval<boolean>(readyExpr);
      } catch {
        // page still loading
      }
      if (ok) return;
      if (this.errors.length) throw new Error(`page error at ${url}:\n  ${this.errors.join('\n  ')}`);
      if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${url}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /** PNG bytes of the first canvas on the page (exact canvas pixels). */
  async canvasPng(selector = 'canvas'): Promise<Buffer> {
    const url = await this.eval<string>(`document.querySelector(${JSON.stringify(selector)}).toDataURL('image/png')`);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  }

  /** PNG screenshot of the viewport. */
  async screenshot(): Promise<Buffer> {
    const r = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(r.data, 'base64');
  }

  close(): void {
    this.ws.close();
  }
}

export interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

/** Launch the headless shell with a throwaway profile. */
export async function launch(): Promise<Browser> {
  const bin = findChrome();
  const profile = mkdtempSync(join(tmpdir(), 'dd-headless-'));
  const proc: ChildProcess = spawn(
    bin,
    [
      '--headless',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--mute-audio',
      '--force-device-scale-factor=1',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const wsUrl = await new Promise<string>((res, rej) => {
    let buf = '';
    const timer = setTimeout(() => rej(new Error(`headless Chromium did not start (${bin})\n${buf}`)), 20_000);
    proc.stderr!.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        res(m[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      rej(new Error(`headless Chromium exited (${code})\n${buf}`));
    });
  });
  const http = wsUrl.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '');
  const pages: Page[] = [];
  return {
    async newPage() {
      const r = await fetch(`${http}/json/new?about:blank`, { method: 'PUT' });
      const t = (await r.json()) as { webSocketDebuggerUrl: string };
      const p = await Page.connect(t.webSocketDebuggerUrl);
      pages.push(p);
      return p;
    },
    async close() {
      for (const p of pages) p.close();
      proc.kill();
      await new Promise((r) => setTimeout(r, 200));
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
