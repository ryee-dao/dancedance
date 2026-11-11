/**
 * DanceDance helper: a tiny local server that lets the DanceDance web app
 * use this computer to download a song's audio (with yt-dlp) for beat
 * analysis. The README section "Helper app" documents it for friends and the owner.
 *
 * Flags (for development): --no-open, --port <n>, --version
 */
import { BUILD } from './build_info.ts';
import { CONFIG_FILE, loadConfig } from './config.ts';
import { JS_RUNTIME_ENV, runJsRuntime } from './jsruntime.ts';
import { appDataDir, dirname, join } from './paths.ts';
import { DEFAULT_LIMITS, Limiter, PORTS } from './policy.ts';
import { AudioFailure, createHandler, type Health } from './server.ts';
import { statusPage } from './statusPage.ts';
import { errText, type ToolState, Tools } from './tools.ts';
import { downloadAudio, type Progress } from './ytdlp.ts';

if (Deno.env.get(JS_RUNTIME_ENV) === 'js-runtime') {
  Deno.exit(await runJsRuntime(Deno.args));
}

const PLATFORM = `${{ darwin: 'macos', windows: 'windows', linux: 'linux' }[Deno.build.os as string] ?? Deno.build.os}-${Deno.build.arch === 'x86_64' ? 'x64' : Deno.build.arch === 'aarch64' ? 'arm64' : Deno.build.arch}`;
const LOG_MAX = 256 * 1024;
const TTY = Deno.stdout.isTerminal();
const enc = new TextEncoder();

const args = Deno.args;
if (args.includes('--version')) {
  console.log(`dancedance-helper ${BUILD.version} (${PLATFORM})`);
  Deno.exit(0);
}
const noOpen = args.includes('--no-open') || Deno.env.get('DANCEDANCE_HELPER_NO_OPEN') === '1';
const portArg = Number(args[args.indexOf('--port') + 1]);
const ports = args.includes('--port') && portArg > 0 ? [portArg] : [...PORTS];

// --- files -----------------------------------------------------------------
const appDir = appDataDir();
await Deno.mkdir(appDir, { recursive: true });
const logPath = join(appDir, 'helper.log');

function log(msg: string): void {
  const line = `${new Date().toISOString()} ${msg}\n`;
  try {
    try {
      if (Deno.statSync(logPath).size > LOG_MAX) Deno.renameSync(logPath, `${logPath}.1`);
    } catch { /* no log yet */ }
    Deno.writeTextFileSync(logPath, line, { append: true });
  } catch { /* logging must never break the helper */ }
}

let progressShown = false;
function say(msg: string): void {
  if (progressShown && TTY) Deno.stdout.writeSync(enc.encode('\n'));
  progressShown = false;
  console.log(msg);
}
function sayProgress(msg: string): void {
  if (TTY) {
    Deno.stdout.writeSync(enc.encode(`\r${msg}   `));
    progressShown = true;
  }
}

/** Private temp dir (0700) for audio and yt-dlp's cache; removed on exit. Stale ones from crashes are swept. */
const sysTmp = Deno.env.get('TMPDIR') || Deno.env.get('TEMP') || Deno.env.get('TMP') || (Deno.build.os === 'windows' ? 'C:\\Windows\\Temp' : '/tmp');
try {
  for await (const e of Deno.readDir(sysTmp)) {
    if (!e.isDirectory || !e.name.startsWith('dancedance-helper-')) continue;
    const p = join(sysTmp, e.name);
    const st = await Deno.stat(p).catch(() => null);
    if (st?.mtime && Date.now() - st.mtime.getTime() > 3600_000) await Deno.remove(p, { recursive: true }).catch(() => {});
  }
} catch { /* ignore */ }
const tempDir = await Deno.makeTempDir({ prefix: 'dancedance-helper-' });
const cacheDir = join(tempDir, 'yt-dlp-cache');

// --- config ------------------------------------------------------------------
const configPath = Deno.env.get('DANCEDANCE_HELPER_CONFIG') || join(dirname(Deno.execPath()), CONFIG_FILE);
const config = await loadConfig(configPath);

say(`DanceDance helper ${BUILD.version}`);
for (const w of config.warnings) say(`Note: ${w}`);
log(`start ${BUILD.version} ${PLATFORM}; origins ${config.allowedOrigins.join(', ')}${config.allowLocalhost ? ' + localhost' : ''}`);

// --- tools -----------------------------------------------------------------
let lastToolPhase = '';
const tools = new Tools(appDir, log, (s: ToolState) => {
  if (s.phase === 'downloading') sayProgress(`Getting ready (first run only): downloading yt-dlp... ${Math.round((s.progress ?? 0) * 100)}%`);
  if (s.phase !== lastToolPhase) {
    lastToolPhase = s.phase;
    if (s.phase === 'ready') say(`Ready. yt-dlp ${s.ytdlpVersion} (checked).`);
    if (s.phase === 'error') say(`Problem: ${s.message} Will try again in 5 minutes.`);
  }
});
const toolsReady = tools.ensure();
setInterval(() => void tools.ensure(), 5 * 60_000); // hourly-ish retry after errors; the daily update check is inside ensure()

// --- jobs ------------------------------------------------------------------
interface Recent { videoId: string; at: number; ok: boolean; code?: string; message?: string; ms: number; bytes: number }
const current = new Map<string, Progress & { videoId: string; startedAt: number }>();
const recent: Recent[] = [];
const limiter = new Limiter(DEFAULT_LIMITS);
let jobSeq = 0;

function note(r: Recent): void {
  recent.unshift(r);
  recent.length = Math.min(recent.length, 20);
}

async function getAudio(videoId: string, signal: AbortSignal) {
  const key = `${videoId}#${++jobSeq}`;
  const t0 = Date.now();
  current.set(key, { videoId, phase: 'starting', fraction: null, startedAt: t0 });
  try {
    const audio = await downloadAudio({
      ytdlp: tools.ytdlpPath(),
      jsRuntime: Deno.execPath(),
      videoId,
      tempDir,
      cacheDir,
      signal,
      onProgress: (p) => current.set(key, { ...p, videoId, startedAt: t0 }),
    });
    const ms = Date.now() - t0;
    note({ videoId, at: Date.now(), ok: true, ms, bytes: audio.bytes.byteLength });
    log(`audio ${videoId} ok ${audio.ext} ${audio.bytes.byteLength} B in ${ms} ms`);
    say(`Got a song for DanceDance (${(audio.bytes.byteLength / 1e6).toFixed(1)} MB, ${(ms / 1000).toFixed(1)} s).`);
    return audio;
  } catch (err) {
    const code = err instanceof AudioFailure ? err.code : 'error';
    const message = err instanceof AudioFailure ? err.message : errText(err);
    const detail = (err as { detail?: string }).detail;
    note({ videoId, at: Date.now(), ok: false, code, message, ms: Date.now() - t0, bytes: 0 });
    log(`audio ${videoId} failed ${code}: ${message}${detail ? ` | ${detail}` : ''}`);
    if (!signal.aborted) say(`A song could not be downloaded: ${message}`);
    if (code === 'outdated') tools.maybeUpdateSoon();
    throw err;
  } finally {
    current.delete(key);
  }
}

function health(): Health {
  const s = tools.state();
  return {
    ok: true,
    app: 'dancedance-helper',
    version: BUILD.version,
    ytdlp: s.ytdlpVersion,
    platform: PLATFORM,
    ready: s.phase === 'ready',
    state: s.phase === 'ready' ? 'ready' : s.phase === 'error' ? 'error' : 'preparing',
    progress: s.progress,
    message: s.message,
  };
}

// --- server ----------------------------------------------------------------
const quitCtl = new AbortController();
let cleaned = false;
async function cleanup(): Promise<void> {
  if (cleaned) return;
  cleaned = true;
  quitCtl.abort();
  await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  log('stop');
}
async function quit(): Promise<void> {
  await cleanup();
  say('DanceDance helper stopped.');
  Deno.exit(0);
}
for (const sig of (Deno.build.os === 'windows' ? ['SIGINT', 'SIGBREAK'] : ['SIGINT', 'SIGTERM', 'SIGHUP']) as Deno.Signal[]) {
  try {
    Deno.addSignalListener(sig, () => void quit());
  } catch { /* not supported here */ }
}
globalThis.addEventListener('unload', () => {
  try {
    Deno.removeSync(tempDir, { recursive: true });
  } catch { /* already gone */ }
});

async function isOurHelper(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    return ((await r.json()) as { app?: string }).app === 'dancedance-helper';
  } catch {
    return false;
  }
}

function openBrowser(url: string): void {
  if (noOpen) return;
  // Fixed URL of our own status page; no page-supplied text reaches these commands.
  const cmd: [string, string[]] =
    Deno.build.os === 'darwin' ? ['open', [url]] : Deno.build.os === 'windows' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  try {
    new Deno.Command(cmd[0], { args: cmd[1], stdin: 'null', stdout: 'null', stderr: 'null' }).spawn().status.catch(() => {});
  } catch { /* no browser opener: the console message has the address */ }
}

let server: Deno.HttpServer | null = null;
let port = 0;
for (const p of ports) {
  try {
    const handler = createHandler({
      port: p,
      origins: { allowed: new Set(config.allowedOrigins), allowDev: config.allowLocalhost },
      health,
      status: () => ({
        current: [...current.values()].map((c) => ({ videoId: c.videoId, phase: c.phase, fraction: c.fraction, startedAt: c.startedAt })),
        recent,
      }),
      acquire: () => limiter.tryAcquire(),
      getAudio,
      statusPage: () => statusPage({ version: BUILD.version, siteUrl: config.siteUrl }),
      quit: () => void quit(),
    });
    server = Deno.serve({ hostname: '127.0.0.1', port: p, signal: quitCtl.signal, onListen: () => {} }, handler);
    port = p;
    break;
  } catch (err) {
    if (!(err instanceof Deno.errors.AddrInUse)) throw err;
    if (await isOurHelper(p)) {
      say('The DanceDance helper is already running. Opening its page.');
      openBrowser(`http://127.0.0.1:${p}/`);
      await cleanup();
      Deno.exit(0);
    }
  }
}
if (!server) {
  say(`Could not start: ports ${ports.join(', ')} are all in use by other programs.`);
  log('no free port');
  await cleanup();
  Deno.exit(1);
}

const statusUrl = `http://127.0.0.1:${port}/`;
say('DanceDance helper is running. Leave this window open while you dance.');
say(`Open DanceDance: ${config.siteUrl}`);
say(`Helper status page: ${statusUrl}`);
say('To stop the helper, close this window or press Ctrl+C.');
log(`listening on 127.0.0.1:${port}`);
openBrowser(statusUrl);
await toolsReady;
await server.finished;
