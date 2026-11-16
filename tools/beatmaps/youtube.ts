/// <reference types="node" />
/**
 * Thin wrappers around the yt-dlp and ffmpeg processes.
 *
 * Audio only ever lands in a per-song directory under the OS temp dir that the
 * caller deletes in a `finally`. Nothing here prints cookies or full stderr.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyYtDlpError, type Classification, type FailureKind } from './classify';
import { MAX_DURATION_S } from './select';

export const PCM_RATE = 22050;

/** A failed external command, already classified. */
export class ToolFailure extends Error {
  constructor(
    readonly classification: Classification,
    readonly tool: string,
    /** Non-secret yt-dlp lines worth logging with the failure (e.g. whether a PO token was made). */
    readonly diagnostics: readonly string[] = [],
  ) {
    super(`${tool}: ${classification.summary}${classification.detail ? ` (${classification.detail})` : ''}`);
    this.name = 'ToolFailure';
  }
}

interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: string;
}

const MAX_STDERR = 256 * 1024;

function run(cmd: string, args: string[], opts: { timeoutMs: number; maxStdout: number }): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = '';
    let overflow = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs);
    child.stdout.on('data', (b: Buffer) => {
      size += b.length;
      if (size > opts.maxStdout) {
        overflow = true;
        child.kill('SIGKILL');
        return;
      }
      chunks.push(b);
    });
    child.stderr.on('data', (b: Buffer) => {
      if (stderr.length < MAX_STDERR) stderr += b.toString('utf8');
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (overflow) stderr += `\nERROR: ${cmd} output exceeded ${opts.maxStdout} bytes`;
      else if (signal === 'SIGKILL') stderr += `\nERROR: ${cmd} timed out after ${Math.round(opts.timeoutMs / 1000)} s`;
      resolve({ code, signal, stdout: Buffer.concat(chunks), stderr });
    });
  });
}

/** True when `cmd <versionFlag>` runs (ffmpeg uses `-version`). */
export function hasCommand(cmd: string): boolean {
  const flag = cmd === 'ffmpeg' ? '-version' : '--version';
  try {
    return spawnSync(cmd, [flag], { stdio: 'ignore', timeout: 15_000 }).status === 0;
  } catch {
    return false;
  }
}

export interface YtDlpOptions {
  cookiesFile?: string;
  /** Extra `--js-runtimes` value when Deno (yt-dlp's default) is not installed. */
  jsRuntime?: string;
  /**
   * A PO token provider plugin is installed and its server answered (the workflow sets
   * YTDLP_POT_PROVIDER). yt-dlp uses it by itself where a client requires a token; this
   * only adds the attempts that ask for tokens on purpose (see attemptPlan).
   */
  poTokenProvider?: boolean;
  /**
   * Only the first two routes (signed-in defaults, then without cookies) and a shorter timeout:
   * for alternate uploads of a song, where a refused video fails every route anyway and a good
   * one works on the first.
   */
  lightAttempts?: boolean;
}

/**
 * Lines about PO tokens from a yt-dlp run (it prints "Generating a gvs PO Token for web client
 * via bgutil HTTP server" when it asks the provider, and warnings when the provider fails).
 * yt-dlp never prints a token itself without trace logging; anything token-like is cut anyway.
 */
export function poTokenLines(stdout: string, stderr: string): string[] {
  return `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .filter((l) => /PO Token|\[pot[:\]]|bgutil/i.test(l) && !/^\s*\[debug\]/.test(l))
    .map((l) => l.trim().replace(/[A-Za-z0-9_-]{40,}/g, '<…>').slice(0, 200))
    .filter((l, i, a) => l && a.indexOf(l) === i)
    .slice(0, 3);
}

/** Arguments shared by every yt-dlp call. */
export function baseArgs(o: YtDlpOptions): string[] {
  const args = ['--ignore-config', '--no-progress', '--socket-timeout', '30', '--retries', '3'];
  if (o.jsRuntime) args.push('--js-runtimes', o.jsRuntime);
  if (o.cookiesFile) args.push('--cookies', o.cookiesFile);
  return args;
}

/** `yt-dlp --flat-playlist -J`: metadata only, no media. */
export async function fetchFlatPlaylist(url: string, o: YtDlpOptions): Promise<unknown> {
  const r = await run('yt-dlp', [...baseArgs(o), '--flat-playlist', '-J', '--', url], { timeoutMs: 180_000, maxStdout: 64 << 20 });
  if (r.code !== 0) throw new ToolFailure(classifyYtDlpError(r.stderr), 'yt-dlp');
  try {
    return JSON.parse(r.stdout.toString('utf8'));
  } catch {
    throw new ToolFailure({ kind: 'error', summary: 'yt-dlp returned unreadable playlist JSON', detail: '' }, 'yt-dlp');
  }
}

export type DownloadResult = { kind: 'file'; path: string } | { kind: 'filtered'; message: string };

// Upcoming premieres fail on their own ("Premieres in ..."), classified as unavailable.
const MATCH_FILTER = `!is_live & duration<=?${MAX_DURATION_S}`;
const AUDIO_EXT = /\.(?:m4a|webm|opus|mp4|mp3|ogg|aac|mka|weba|wav|flac)$/i;

/**
 * YouTube clients tried in turn when a signed-in download fails. With account
 * cookies yt-dlp's default clients (web_embedded, tv_samsung and web in yt-dlp
 * 2026.10) can come back without usable audio: web needs a "PO token" for its
 * media, and YouTube sometimes offers a signed-in session on GitHub's machines
 * no audio at all for a video, per video and on and off. Each fallback takes
 * cookies and needs no PO token (yt-dlp's INNERTUBE_CLIENTS and its PO Token
 * Guide, https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide):
 *   tv             the TV app (TVHTML5) at its current version
 *   tv_downgraded  the same app at an older version, which YouTube answers on its own
 *   web_safari     Safari's web player, whose HLS formats need no token for signed-in sessions
 * Clients that take no cookies (visionos, android_vr, ios) are dropped by
 * yt-dlp when cookies are passed; the cookie-less attempt reaches them.
 * mweb needs a PO token for its media, so it is tried only with a provider;
 * web_music and web_creator need one too and add nothing for plain videos.
 */
export const COOKIE_CLIENT_FALLBACKS = ['tv', 'tv_downgraded', 'web_safari'] as const;

/** One way of asking yt-dlp for the audio. */
export interface AttemptSpec {
  /** `--extractor-args youtube:<this>`; undefined = yt-dlp's defaults. */
  extractorArgs?: string;
  /** Whether the cookies (if any) are passed. */
  cookies: boolean;
  /** For logs and summaries. */
  label: string;
}

/**
 * The attempts for one video. Without cookies: one, with yt-dlp's defaults (as
 * always). With cookies, in this order:
 *   default            yt-dlp's defaults, signed in (unchanged first attempt)
 *   no cookies         the defaults without cookies (tv_samsung, visionos, web): a
 *                      different session from the one YouTube refused, and quick
 *                      (on GitHub it is often bot-checked within seconds), so it
 *                      comes early, before the slower fallbacks can use up the time
 *   po token           only with a PO token provider (o.poTokenProvider): the
 *                      defaults signed in, with a token fetched for every client
 *                      (`fetch_pot=always`), against YouTube's HTTP 403 on media
 *   mweb               only with a provider: the mobile web client, which takes
 *                      cookies and needs a GVS token (the PO Token Guide's suggestion)
 *   COOKIE_CLIENT_FALLBACKS (tv, tv_downgraded, web_safari), signed in
 * With `lightAttempts` (alternate uploads), only the first two.
 */
export function attemptPlan(o: YtDlpOptions): AttemptSpec[] {
  if (!o.cookiesFile) return [{ cookies: false, label: 'default' }];
  const all: AttemptSpec[] = [
    { cookies: true, label: 'default' },
    { cookies: false, label: 'no cookies' },
    ...(o.poTokenProvider
      ? [
          { extractorArgs: 'fetch_pot=always', cookies: true, label: 'po token' },
          { extractorArgs: 'player_client=mweb', cookies: true, label: 'mweb' },
        ]
      : []),
    ...COOKIE_CLIENT_FALLBACKS.map((client) => ({ extractorArgs: `player_client=${client}`, cookies: true, label: client })),
  ];
  return o.lightAttempts ? all.slice(0, 2) : all;
}

/** What one attempt said. */
export interface DownloadAttempt {
  label: string;
  cookies: boolean;
  classification: Classification;
  /** How long it took (ms), when known. */
  ms?: number;
  /** poTokenLines of the attempt (whether yt-dlp asked the PO token provider, and what went wrong). */
  diagnostics?: readonly string[];
}

const RANK: Record<FailureKind, number> = { unavailable: 5, blocked: 4, outdated: 3, withheld: 2, error: 1 };

/**
 * Which attempt speaks for the song when all failed: the most telling kind
 * (unavailable > blocked > outdated > withheld > error), the earliest on a tie.
 * A bot check of the cookie-less attempt is expected on GitHub's machines and
 * says nothing about the signed-in session, so it counts only when nothing
 * else is known.
 */
export function representative(attempts: readonly DownloadAttempt[], usedCookies: boolean): DownloadAttempt {
  const counted = attempts.filter((a) => !(usedCookies && !a.cookies && a.classification.kind === 'blocked'));
  let best: DownloadAttempt | undefined;
  for (const a of counted.length ? counted : attempts) if (!best || RANK[a.classification.kind] > RANK[best.classification.kind]) best = a;
  if (!best) throw new Error('representative() needs at least one attempt');
  return best;
}

/** "default: withheld; tv: error; ..." (kinds only, short enough for status.json). */
export function attemptsLine(attempts: readonly DownloadAttempt[]): string {
  return attempts.map((a) => `${a.label}: ${a.classification.kind}`).join('; ');
}

/**
 * A download that failed on every attempt: `classification` is the representative one, `attempts` all of
 * them, `skipped` the labels of attempts left out because the song's time budget ran out.
 */
export class DownloadFailure extends ToolFailure {
  constructor(
    classification: Classification,
    readonly attempts: readonly DownloadAttempt[],
    readonly skipped: readonly string[] = [],
  ) {
    super(classification, 'yt-dlp');
    this.name = 'DownloadFailure';
  }
}

/** The first attempt (the timeout every download had before the fallbacks). */
const ATTEMPT_TIMEOUT_MS = 6 * 60_000;
/** Each later attempt: a working download of a song's audio takes seconds; a stalled one shouldn't eat the rest. */
const FALLBACK_TIMEOUT_MS = 3 * 60_000;
/** All attempts of one song together: a later attempt gets what is left, and none starts with under MIN_ATTEMPT_MS. */
export const DOWNLOAD_BUDGET_MS = 10 * 60_000;
const MIN_ATTEMPT_MS = 45_000;

export type AttemptFn = (videoId: string, dir: string, o: YtDlpOptions, extractorArgs: string | undefined, timeoutMs: number) => Promise<DownloadResult>;

/**
 * Try `attemptPlan(o)` in turn until one gives a file (or a "filtered" answer).
 * An 'unavailable' answer (removed, private...) ends it at once. Throws a
 * DownloadFailure listing every attempt made. `attempt` and `now` are for tests.
 */
export async function downloadWithFallbacks(
  videoId: string,
  dir: string,
  o: YtDlpOptions,
  attempt: AttemptFn = downloadAudioOnce,
  now: () => number = Date.now,
  budgetMs = DOWNLOAD_BUDGET_MS,
): Promise<DownloadResult> {
  const deadline = now() + budgetMs;
  const tried: DownloadAttempt[] = [];
  const skipped: string[] = [];
  const failure = () => new DownloadFailure(representative(tried, !!o.cookiesFile).classification, tried, skipped);
  for (const [i, spec] of attemptPlan(o).entries()) {
    const left = deadline - now();
    // Out of time: the rest are listed as skipped (in the log too), not dropped silently.
    if (i > 0 && left < MIN_ATTEMPT_MS) {
      skipped.push(spec.label);
      continue;
    }
    const opts: YtDlpOptions = spec.cookies ? o : { ...o, cookiesFile: undefined };
    const t0 = now();
    const first = i === 0 && !o.lightAttempts ? ATTEMPT_TIMEOUT_MS : FALLBACK_TIMEOUT_MS;
    try {
      return await attempt(videoId, dir, opts, spec.extractorArgs, i === 0 ? first : Math.min(FALLBACK_TIMEOUT_MS, left));
    } catch (e) {
      const classification: Classification =
        e instanceof ToolFailure ? e.classification : { kind: 'error', summary: 'yt-dlp could not be run', detail: String((e as Error)?.message ?? e).slice(0, 300) };
      const diagnostics = e instanceof ToolFailure && e.diagnostics.length ? { diagnostics: e.diagnostics } : {};
      tried.push({ label: spec.label, cookies: spec.cookies, classification, ms: now() - t0, ...diagnostics });
      // A refusal is worth another client (the tv client can also answer "The
      // page needs to be reloaded", a plain error); a removed or private video is not.
      if (classification.kind === 'unavailable') throw failure();
      for (const f of await readdir(dir)) await rm(join(dir, f), { force: true });
    }
  }
  throw failure();
}

/** Download the best audio-only stream of one video into `dir`. */
export function downloadAudio(videoId: string, dir: string, o: YtDlpOptions): Promise<DownloadResult> {
  return downloadWithFallbacks(videoId, dir, o);
}

async function downloadAudioOnce(videoId: string, dir: string, o: YtDlpOptions, extractorArgs: string | undefined, timeoutMs: number): Promise<DownloadResult> {
  const args = [
    ...baseArgs(o),
    ...(extractorArgs ? ['--extractor-args', `youtube:${extractorArgs}`] : []),
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--no-part',
    '--no-mtime',
    '--max-filesize', '200M',
    '--match-filter', MATCH_FILTER,
    '-o', join(dir, '%(id)s.%(ext)s'),
    '--', `https://www.youtube.com/watch?v=${videoId}`,
  ];
  const r = await run('yt-dlp', args, { timeoutMs, maxStdout: 4 << 20 });
  if (r.code !== 0) throw new ToolFailure(classifyYtDlpError(r.stderr), 'yt-dlp', poTokenLines(r.stdout.toString('utf8'), r.stderr));
  const files = (await readdir(dir)).filter((f) => AUDIO_EXT.test(f));
  if (files.length) return { kind: 'file', path: join(dir, files[0]) };
  const out = r.stdout.toString('utf8');
  if (/does not pass filter/i.test(out)) {
    return { kind: 'filtered', message: 'Skipped: live stream, upcoming premiere, or longer than 15 min' };
  }
  if (/larger than max-filesize|File is larger than/i.test(out)) {
    return { kind: 'filtered', message: 'Skipped: audio file larger than 200 MB' };
  }
  throw new ToolFailure(classifyYtDlpError(`${r.stderr}\nERROR: yt-dlp finished without producing an audio file`), 'yt-dlp');
}

/** Copy little-endian f32 bytes into an aligned Float32Array. */
export function f32leToFloat32(buf: Uint8Array): Float32Array {
  const n = Math.floor(buf.byteLength / 4);
  const out = new Float32Array(n);
  new Uint8Array(out.buffer).set(buf.subarray(0, n * 4));
  return out;
}

/** Decode any audio file to mono 22050 Hz float PCM with ffmpeg (piped, no temp file). */
export async function decodeWithFfmpeg(path: string): Promise<Float32Array> {
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', path, '-vn', '-ac', '1', '-ar', String(PCM_RATE), '-f', 'f32le', 'pipe:1'];
  // 15 min of mono f32 at 22050 Hz is ~80 MB; allow some headroom.
  const r = await run('ffmpeg', args, { timeoutMs: 3 * 60_000, maxStdout: (MAX_DURATION_S + 120) * PCM_RATE * 4 });
  if (r.code !== 0) {
    throw new ToolFailure({ kind: 'error', summary: 'ffmpeg could not decode the audio', detail: r.stderr.trim().split('\n').pop()?.slice(0, 300) ?? '' }, 'ffmpeg');
  }
  return f32leToFloat32(r.stdout);
}

/** `yt-dlp "ytsearch10:<query>" --flat-playlist -J`: search results, metadata only. */
export async function searchVideos(query: string, o: YtDlpOptions, count = 10): Promise<unknown> {
  const r = await run('yt-dlp', [...baseArgs(o), '--flat-playlist', '-J', '--', `ytsearch${count}:${query}`], {
    timeoutMs: 120_000,
    maxStdout: 16 << 20,
  });
  if (r.code !== 0) throw new ToolFailure(classifyYtDlpError(r.stderr), 'yt-dlp');
  try {
    return JSON.parse(r.stdout.toString('utf8'));
  } catch {
    throw new ToolFailure({ kind: 'error', summary: 'yt-dlp returned unreadable search JSON', detail: '' }, 'yt-dlp');
  }
}

export type EmbedCheck = 'ok' | 'disabled' | 'gone' | 'unknown';

/** Map an oEmbed HTTP status: 200 ok, 401/403 embedding disabled, 400/404 removed or private. */
export function embedFromStatus(status: number): EmbedCheck {
  if (status === 200) return 'ok';
  if (status === 401 || status === 403) return 'disabled';
  if (status === 400 || status === 404) return 'gone';
  return 'unknown';
}

/** Whether YouTube allows embedding this video (the web app plays it in an iframe). */
export async function checkEmbed(
  videoId: string,
  fetchFn: (url: string, init?: RequestInit) => Promise<{ status: number }> = (u, i) => fetch(u, i),
): Promise<EmbedCheck> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(15_000) });
    return embedFromStatus(res.status);
  } catch {
    return 'unknown';
  }
}
