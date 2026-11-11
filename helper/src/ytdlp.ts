/**
 * One audio download: run yt-dlp (argument array, no shell) into a fresh
 * private work folder, read the file, delete the folder, return the bytes.
 */
import { AudioFailure, type AudioResult } from './server.ts';
import { join } from './paths.ts';
import { AUDIO_FORMAT, audioContentType, classifyFailure, classifyNoFile, MAX_AUDIO_BYTES, MAX_DURATION_S } from './policy.ts';
import { JS_RUNTIME_ENV } from './jsruntime.ts';

export interface Progress {
  phase: 'starting' | 'downloading';
  /** 0..1 once yt-dlp knows the size. */
  fraction: number | null;
}

export interface DownloadOptions {
  ytdlp: string;
  /** The helper binary itself, used by yt-dlp as its "deno" JavaScript runtime. */
  jsRuntime: string | null;
  videoId: string;
  /** Parent of the per-job folder (the helper's private temp dir). */
  tempDir: string;
  /** yt-dlp cache (player code), inside the private temp dir: gone when the helper exits. */
  cacheDir: string;
  signal: AbortSignal;
  onProgress?: (p: Progress) => void;
  timeoutMs?: number;
}

const AUDIO_EXT = /\.(m4a|mp4|aac|webm|weba|opus|ogg|mp3)$/i;

/** yt-dlp arguments: fixed apart from the (already validated) video ID and our own folders. */
export function ytdlpArgs(o: Pick<DownloadOptions, 'videoId' | 'jsRuntime' | 'cacheDir'>, outDir: string): string[] {
  const args = [
    '--ignore-config',
    '--no-playlist',
    '--no-part',
    '--no-mtime',
    '--cache-dir', o.cacheDir,
    '--socket-timeout', '20',
    '--retries', '3',
    '-f', AUDIO_FORMAT,
    '--max-filesize', String(MAX_AUDIO_BYTES),
    '--match-filter', `!is_live & duration <=? ${MAX_DURATION_S}`,
    '--newline',
    '--progress-template', 'download:[ddh] %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s',
    '-o', join(outDir, 'audio.%(ext)s'),
  ];
  if (o.jsRuntime) args.push('--js-runtimes', `deno:${o.jsRuntime}`);
  args.push('--', `https://www.youtube.com/watch?v=${o.videoId}`);
  return args;
}

/** Parse a "[ddh] <downloaded> <total>" progress line. */
export function parseProgress(line: string): number | null {
  const m = /\[ddh\]\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/.exec(line);
  if (!m) return null;
  const total = Number(m[2]);
  return total > 0 ? Math.min(1, Number(m[1]) / total) : null;
}

async function collect(stream: ReadableStream<Uint8Array>, onLine: (l: string) => void, max = 256 * 1024): Promise<string> {
  let text = '';
  let buf = '';
  const dec = new TextDecoder();
  for await (const chunk of stream) {
    const s = dec.decode(chunk, { stream: true });
    if (text.length < max) text += s;
    buf += s;
    let i: number;
    while ((i = buf.search(/\r?\n/)) >= 0) {
      onLine(buf.slice(0, i));
      buf = buf.slice(buf[i] === '\r' ? i + 2 : i + 1);
    }
  }
  if (buf) onLine(buf);
  return text;
}

export async function downloadAudio(o: DownloadOptions): Promise<AudioResult> {
  const dir = await Deno.makeTempDir({ dir: o.tempDir, prefix: 'job-' });
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  o.signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 4 * 60_000);
  try {
    o.onProgress?.({ phase: 'starting', fraction: null });
    const env: Record<string, string> = { [JS_RUNTIME_ENV]: 'js-runtime' };
    let child: Deno.ChildProcess;
    try {
      child = new Deno.Command(o.ytdlp, {
        args: ytdlpArgs(o, dir),
        stdin: 'null',
        stdout: 'piped',
        stderr: 'piped',
        env,
        signal: ctl.signal,
      }).spawn();
    } catch {
      throw new AudioFailure('not-ready', 'yt-dlp is missing. Restart the helper.');
    }
    const onLine = (l: string) => {
      const f = parseProgress(l);
      if (f !== null) o.onProgress?.({ phase: 'downloading', fraction: f });
    };
    const [status, stdout, stderr] = await Promise.all([child.status, collect(child.stdout, onLine), collect(child.stderr, onLine)]);
    if (o.signal.aborted) throw new AudioFailure('error', 'Cancelled.');
    if (ctl.signal.aborted) throw new AudioFailure('network', 'YouTube took too long to answer.');
    if (!status.success) {
      const f = classifyFailure(stderr);
      throw Object.assign(new AudioFailure(f.code, f.message), { detail: f.detail });
    }
    let file: string | null = null;
    for await (const e of Deno.readDir(dir)) {
      if (e.isFile && AUDIO_EXT.test(e.name)) file = e.name;
    }
    if (!file) {
      const f = classifyNoFile(stdout);
      throw new AudioFailure(f.code, f.message);
    }
    const info = await Deno.stat(join(dir, file));
    if (info.size > MAX_AUDIO_BYTES) throw new AudioFailure('unavailable', 'The audio is larger than 40 MB.');
    const bytes = await Deno.readFile(join(dir, file));
    const ext = file.split('.').pop() ?? '';
    return { bytes, ext, contentType: audioContentType(ext) };
  } finally {
    clearTimeout(timer);
    o.signal.removeEventListener('abort', onAbort);
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
}
