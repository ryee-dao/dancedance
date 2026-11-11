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
import { classifyYtDlpError, type Classification } from './classify';
import { MAX_DURATION_S } from './select';

export const PCM_RATE = 22050;

/** A failed external command, already classified. */
export class ToolFailure extends Error {
  constructor(
    readonly classification: Classification,
    readonly tool: string,
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
 * YouTube clients tried in turn when a signed-in download is refused. With
 * account cookies yt-dlp's default clients can need a "PO token" for the media
 * request and answer HTTP 403 without one; the `tv` client takes cookies and
 * needs no such token, and `web_safari` offers HLS formats that don't either
 * (https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide).
 */
export const COOKIE_CLIENT_FALLBACKS = ['tv', 'web_safari'] as const;

/** Download the best audio-only stream of one video into `dir`. */
export async function downloadAudio(videoId: string, dir: string, o: YtDlpOptions): Promise<DownloadResult> {
  const clients: (string | undefined)[] = [undefined, ...(o.cookiesFile ? COOKIE_CLIENT_FALLBACKS : [])];
  let last: unknown;
  for (const client of clients) {
    try {
      return await downloadAudioOnce(videoId, dir, o, client);
    } catch (e) {
      last = e;
      const kind = e instanceof ToolFailure ? e.classification.kind : undefined;
      // Only "refused" outcomes are worth another client; a removed or private video is not.
      if (kind !== 'outdated' && kind !== 'blocked') throw e;
      for (const f of await readdir(dir)) await rm(join(dir, f), { force: true });
    }
  }
  throw last;
}

async function downloadAudioOnce(videoId: string, dir: string, o: YtDlpOptions, client?: string): Promise<DownloadResult> {
  const args = [
    ...baseArgs(o),
    ...(client ? ['--extractor-args', `youtube:player_client=${client}`] : []),
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--no-part',
    '--no-mtime',
    '--max-filesize', '200M',
    '--match-filter', MATCH_FILTER,
    '-o', join(dir, '%(id)s.%(ext)s'),
    '--', `https://www.youtube.com/watch?v=${videoId}`,
  ];
  const r = await run('yt-dlp', args, { timeoutMs: 6 * 60_000, maxStdout: 4 << 20 });
  if (r.code !== 0) throw new ToolFailure(classifyYtDlpError(r.stderr), 'yt-dlp');
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
