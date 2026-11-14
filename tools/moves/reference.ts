/**
 * See how a real dance is done: find a reference clip, cut a short
 * low-resolution section and lay its frames out as a strip you can read
 * step by step. For studying the steps only: author every move from scratch
 * in the pose format; never trace or copy footage.
 *
 *   # candidate videos (anonymous yt-dlp search; only the phrase is sent)
 *   npx tsx tools/moves/reference.ts search "dougie dance tutorial" [--n 8]
 *
 *   # title, length and chapters of a video (find the teaching part of a long tutorial)
 *   npx tsx tools/moves/reference.ts info <url | video id>
 *
 *   # frames of one video over a time range (seconds or m:ss)
 *   npx tsx tools/moves/reference.ts frames <url | video id> --from 0:42 --to 0:48 [--fps 4]
 *
 *   # a direct GIF / short clip URL
 *   npx tsx tools/moves/reference.ts frames https://example.org/move.gif [--from 0 --to 3]
 *
 *   # put a coach render (tools/moves/sheet.ts output) under the strip, same width
 *   npx tsx tools/moves/reference.ts frames <url> --from 12 --to 16 --with /path/to/strip.png
 *
 *   # or stack any two images (reference strip over render)
 *   npx tsx tools/moves/reference.ts compare <top.png> <bottom.png> --name dougie-vs
 *
 * Options for `frames`:
 *   --fps <n>      frames per second sampled (default 4; 6-8 for fast footwork)
 *   --cols <n>     tiles per row (default 8)
 *   --width <px>   width of one tile (default 200)
 *   --crop x0,y0,x1,y1  keep this part of the frame (fractions 0..1), e.g.
 *                  0.3,0,0.7,1 for a dancer small in the middle of a wide shot
 *   --flip         mirror the footage left-right (the coach is a mirror of the
 *                  player, so a tutorial filmed from the front compares best flipped)
 *   --out <dir>    output directory (default $TMPDIR/dancedance-refs)
 *   --name <base>  output file base name
 *   --keep         keep the downloaded clip (default: deleted when done)
 *
 * Downloads stay small: video only, at most 360p, just the requested section
 * (yt-dlp --download-sections), into a temporary directory that is removed
 * afterwards. yt-dlp runs with --ignore-config and no cookies (no account);
 * ffmpeg is /opt/homebrew/bin/ffmpeg or FFMPEG=... Never commit the output.
 * Tiles are left to right, top to bottom; the printed legend gives each tile's time.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const FFMPEG = process.env.FFMPEG ?? (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
const FFPROBE = FFMPEG.replace(/ffmpeg$/, 'ffprobe');
const YTDLP = process.env.YTDLP ?? (existsSync('/opt/homebrew/bin/yt-dlp') ? '/opt/homebrew/bin/yt-dlp' : 'yt-dlp');

const [cmd, ...rest] = process.argv.slice(2);
const positional: string[] = [];
const opts: Record<string, string | true> = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = rest[i + 1];
    if (v === undefined || v.startsWith('--')) opts[k] = true;
    else {
      opts[k] = v;
      i++;
    }
  } else positional.push(a);
}
const opt = (k: string): string | undefined => (typeof opts[k] === 'string' ? (opts[k] as string) : undefined);
const out = resolve(opt('out') ?? join(tmpdir(), 'dancedance-refs'));

function usage(): never {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  console.log(src.slice(src.indexOf('/**') + 3, src.indexOf('*/')).replace(/^ \* ?/gm, ''));
  process.exit(1);
}

/** Seconds from "75", "1:15" or "0:01:15". */
function secs(v: string | undefined, dflt: number): number {
  if (v === undefined) return dflt;
  return v.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
}

const mmss = (t: number): string => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function run(bin: string, args: string[], quiet = true): string {
  return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'pipe' : 'inherit'], maxBuffer: 64 << 20 });
}

// yt-dlp with no user config and no cookies: an anonymous client.
const YT_BASE = ['--ignore-config', '--no-cookies', '--no-cookies-from-browser', '--no-playlist', '--no-warnings', '--no-progress'];

function search(phrase: string, n: number): void {
  const raw = run(YTDLP, [...YT_BASE.filter((a) => a !== '--no-playlist'), '--flat-playlist', '--dump-json', `ytsearch${n}:${phrase}`]);
  const rows = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as { id: string; title: string; duration?: number; channel?: string; uploader?: string; view_count?: number });
  for (const r of rows) {
    const d = r.duration ? `${Math.floor(r.duration / 60)}:${String(Math.round(r.duration % 60)).padStart(2, '0')}` : '?';
    const views = !r.view_count ? "" : r.view_count >= 1e6 ? `${(r.view_count / 1e6).toFixed(1)}M views` : `${Math.round(r.view_count / 1e3)}K views`;
    console.log(`${r.id}  ${d.padStart(6)}  ${views.padStart(11)}  ${r.title}  [${r.channel ?? r.uploader ?? ''}]`);
    console.log(`           https://www.youtube.com/watch?v=${r.id}`);
  }
}

const isDirect = (u: string): boolean => /\.(gif|mp4|webm|mov|m4v)(\?|$)/i.test(u);

/** Download the section into tmp; returns the clip path and whether it is already trimmed. */
async function fetchClip(src: string, from: number, to: number, tmp: string): Promise<{ path: string; trimmed: boolean }> {
  if (isDirect(src)) {
    const r = await fetch(src, { headers: { 'user-agent': 'Mozilla/5.0 (reference-frames)' } });
    if (!r.ok) throw new Error(`download failed: ${r.status} ${src}`);
    const len = Number(r.headers.get('content-length') ?? 0);
    if (len > 60 << 20) throw new Error(`refusing a ${Math.round(len / 1e6)} MB file: use a shorter clip`);
    const ext = (src.match(/\.(gif|mp4|webm|mov|m4v)/i)?.[1] ?? 'bin').toLowerCase();
    const path = join(tmp, `clip.${ext}`);
    writeFileSync(path, Buffer.from(await r.arrayBuffer()));
    return { path, trimmed: false };
  }
  const url = /^[\w-]{11}$/.test(src) ? `https://www.youtube.com/watch?v=${src}` : src;
  run(YTDLP, [
    ...YT_BASE,
    '-f', 'bv*[height<=360][ext=mp4]/bv*[height<=360]/b[height<=360]/wv*/w',
    '--download-sections', `*${from}-${to}`,
    '--force-keyframes-at-cuts',
    '--ffmpeg-location', FFMPEG,
    '-o', join(tmp, 'clip.%(ext)s'),
    url,
  ]);
  const f = readdirSync(tmp).find((x) => x.startsWith('clip.'));
  if (!f) throw new Error('yt-dlp produced no file');
  return { path: join(tmp, f), trimmed: true };
}

function duration(path: string): number {
  try {
    return Number(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).trim()) || 0;
  } catch {
    return 0;
  }
}

/** Stack a over b, both scaled to the same width. */
function stack(top: string, bottom: string, dest: string): void {
  run(FFMPEG, [
    '-y', '-v', 'error', '-i', top, '-i', bottom,
    '-filter_complex', "[0:v]scale=1800:-2[a];[1:v]scale=1800:-2[b];[a][b]vstack=inputs=2",
    '-frames:v', '1', '-update', '1', dest,
  ]);
}

async function frames(src: string): Promise<void> {
  const from = secs(opt('from'), 0);
  const to = secs(opt('to'), from + 6);
  if (!(to > from)) throw new Error('--to must be after --from');
  if (to - from > 30) throw new Error('keep the range to 30 s or less');
  const fps = Number(opt('fps') ?? 4);
  const cols = Number(opt('cols') ?? 8);
  const width = Number(opt('width') ?? 200);
  if (cols * width > 1900) console.warn(`note: ${cols} x ${width}px = ${cols * width}px wide; image viewers scale this down. Keep cols x width under ~1900 (or use --crop).`);
  mkdirSync(out, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'dd-ref-'));
  try {
    const clip = await fetchClip(src, from, to, tmp);
    const kb = Math.round(statSync(clip.path).size / 1024);
    // A trimmed download starts at 0 (or near it); an untrimmed file is cut here.
    const t0 = clip.trimmed ? 0 : from;
    const len = clip.trimmed ? Math.min(to - from, duration(clip.path) || to - from) : to - from;
    const n = Math.max(1, Math.floor(len * fps));
    const rows = Math.ceil(n / cols);
    const name = opt('name') ?? `${slug(src.replace(/^https?:\/\/(www\.)?/, ''))}-${from}-${to}`;
    const dest = join(out, `${name}.png`);
    const crop = opt('crop')?.split(',').map(Number);
    const cropF = crop && crop.length === 4 && crop.every(Number.isFinite)
      ? [`crop=iw*${crop[2] - crop[0]}:ih*${crop[3] - crop[1]}:iw*${crop[0]}:ih*${crop[1]}`]
      : [];
    const vf = [`fps=${fps}`, ...cropF, `scale=${width}:-2`, ...(opts.flip ? ['hflip'] : []), `tile=${cols}x${rows}:padding=4:margin=4:color=white`].join(',');
    const ff = ['-y', '-v', 'error', '-ss', String(t0), '-t', String(len), '-i', clip.path, '-vf', vf, '-frames:v', '1', '-update', '1', dest];
    try {
      run(FFMPEG, ff);
    } catch {
      run(FFMPEG, ff); // a cut clip sometimes needs a second read; a real error throws with ffmpeg's message
    }
    console.log(`clip ${kb} KB, ${len.toFixed(1)} s from ${from}s; ${n} tiles at ${fps} fps, ${cols} per row${opts.flip ? ', mirrored' : ''}`);
    const legend: string[] = [];
    for (let i = 0; i < n; i++) legend.push(`#${i + 1}@${mmss(from + i / fps)}`);
    console.log(`tile times: ${legend.join(' ')}`);
    if (opts.keep) {
      const kept = join(out, `${name}-clip${clip.path.slice(clip.path.lastIndexOf('.'))}`);
      execFileSync('cp', [clip.path, kept]);
      console.log(kept);
    }
    console.log(dest);
    if (opt('with')) {
      const both = join(out, `${name}-vs-render.png`);
      stack(dest, resolve(opt('with')!), both);
      console.log(both);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function info(src: string): void {
  const url = /^[\w-]{11}$/.test(src) ? `https://www.youtube.com/watch?v=${src}` : src;
  const j = JSON.parse(run(YTDLP, [...YT_BASE, '--skip-download', '--dump-single-json', url])) as {
    title?: string; duration?: number; channel?: string; chapters?: { start_time: number; title: string }[]; description?: string;
  };
  console.log(`${j.title ?? ''}  [${j.channel ?? ''}]  ${j.duration ? mmss(j.duration) : '?'}`);
  for (const c of j.chapters ?? []) console.log(`  ${mmss(c.start_time)}  ${c.title}`);
  if (!j.chapters?.length) console.log('  (no chapters)');
  const stamps = (j.description ?? '').split('\n').filter((l) => /\b\d{1,2}:\d{2}\b/.test(l)).slice(0, 30);
  if (stamps.length) console.log(`timestamps in the description:\n  ${stamps.join('\n  ')}`);
}

try {
  if (cmd === 'search' && positional[0]) search(positional.join(' '), Number(opt('n') ?? 6));
  else if (cmd === 'info' && positional[0]) info(positional[0]);
  else if (cmd === 'frames' && positional[0]) await frames(positional[0]);
  else if (cmd === 'compare' && positional.length === 2) {
    mkdirSync(out, { recursive: true });
    const dest = join(out, `${opt('name') ?? 'compare'}.png`);
    stack(resolve(positional[0]), resolve(positional[1]), dest);
    console.log(dest);
  } else usage();
} catch (e) {
  const err = e as { stderr?: string; message: string };
  console.error(err.stderr?.toString().trim() || err.message);
  process.exit(1);
}
