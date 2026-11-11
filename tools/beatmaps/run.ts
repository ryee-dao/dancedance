/// <reference types="node" />
/**
 * Cloud beat-map job (also runs locally):
 *
 *   npm run beatmaps -- [--only <videoId>] [--limit <n>] [--force] [--dry-run] [--playlist <url>]
 *   npm run beatmaps -- --add "Artist - Title" [--duration <s>] [--dry-run]
 *
 * Add mode finds the best YouTube video for the song (see pick.ts), analyses
 * it and lists it in public/songs.json. The official length comes from iTunes
 * unless given. The workflow passes --add-artist/--add-title/--add-duration
 * (separate values, so no splitting) and --add-queue (JSON from the app).
 *
 * Environment:
 *   PLAYLIST_URL   YouTube playlist link (optional; without it only the starter pack is processed)
 *   YT_COOKIES     Netscape cookies.txt content (optional; never printed)
 *   GITHUB_ACTIONS / GITHUB_STEP_SUMMARY   set by GitHub Actions
 *
 * Needs `yt-dlp` and `ffmpeg` on PATH, plus Deno (or it falls back to this Node) for yt-dlp's YouTube support.
 */
import { appendFileSync, rmSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCookies } from './output';
import { runBeatmaps, type Deps } from './pipeline';
import { lookupOfficial } from './itunes';
import { cleanRequest, MAX_ADDS, parseQueue, splitArtistTitle } from './pick';
import { VIDEO_ID_RE } from './select';
import type { AddRequest } from './songs';
import { renderAnnotations, renderSummary } from './summary';
import { checkEmbed, decodeWithFfmpeg, downloadAudio, fetchFlatPlaylist, hasCommand, searchVideos, type YtDlpOptions } from './youtube';

export const DEFAULT_LIMIT = 25;

export interface CliArgs {
  only?: string;
  limit: number;
  force: boolean;
  dryRun: boolean;
  playlist?: string;
  help: boolean;
  /** Songs to add by search. */
  adds: AddRequest[];
}

export function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { limit: DEFAULT_LIMIT, force: false, dryRun: false, help: false, adds: [] };
  let addArtist: string | undefined;
  let addTitle: string | undefined;
  let addDuration: string | undefined;
  let duration: string | undefined;
  const queue: AddRequest[] = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${k} needs a value`);
      return v;
    };
    switch (k) {
      case '--only': {
        const v = val().trim();
        if (v) a.only = v;
        break;
      }
      case '--limit': {
        const n = Number(val());
        if (!Number.isInteger(n) || n < 0) throw new Error('--limit must be a whole number >= 0');
        a.limit = n;
        break;
      }
      case '--playlist':
        a.playlist = val();
        break;
      case '--force':
        a.force = true;
        break;
      case '--dry-run':
        a.dryRun = true;
        break;
      case '--add': {
        const v = val();
        const parts = splitArtistTitle(v);
        const req = parts && cleanRequest(parts.artist, parts.title);
        if (!req) throw new Error('--add needs "Artist - Title", for example --add "a-ha - Take On Me"');
        a.adds.push({ ...req, explicit: true });
        break;
      }
      case '--duration':
        duration = val();
        break;
      case '--add-artist':
        addArtist = val();
        break;
      case '--add-title':
        addTitle = val();
        break;
      case '--add-duration':
        addDuration = val();
        break;
      case '--add-queue':
        queue.push(...parseQueue(val()).map((r) => ({ ...r, explicit: false })));
        break;
      case '-h':
      case '--help':
        a.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${k}`);
    }
  }
  if (addTitle !== undefined || addArtist !== undefined) {
    const req = cleanRequest(addArtist ?? '', addTitle ?? '', addDuration);
    if (!req) throw new Error('--add-artist and --add-title must both be given (up to 200 characters each)');
    a.adds.unshift({ ...req, explicit: true });
  }
  if (duration !== undefined) {
    const n = Number(duration);
    if (a.adds.length !== 1 || !Number.isFinite(n) || n < 20 || n > 900) throw new Error('--duration is the length in seconds (20-900) of a single --add');
    a.adds[0].durationSec = Math.round(n);
  }
  a.adds.push(...queue);
  if (a.adds.length > MAX_ADDS) a.adds = a.adds.slice(0, MAX_ADDS);
  if (a.adds.length && a.only) throw new Error('--add and --only cannot be combined');
  if (a.only !== undefined && !VIDEO_ID_RE.test(a.only)) throw new Error('--only must be an 11-character YouTube video ID');
  return a;
}

const USAGE = `Usage: npm run beatmaps -- [--only <videoId>] [--limit <n>] [--force] [--dry-run] [--playlist <url>]
  --only <id>     process just this video
  --limit <n>     at most n songs this run (default ${DEFAULT_LIMIT})
  --force         re-analyse even if a current map exists, ignoring retry backoff
  --dry-run       show what would be processed; download and write nothing
  --playlist url  playlist link (default: $PLAYLIST_URL)

Add a song by search (finds the YouTube video, makes its beat map, lists it in public/songs.json):
  npm run beatmaps -- --add "Artist - Title" [--duration <seconds>] [--dry-run]
  --add "A - T"   repeatable; the official length is looked up on iTunes unless --duration is given
  --dry-run       search and pick the video, but download and write nothing`;

async function main(): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const gha = process.env.GITHUB_ACTIONS === 'true';
  const playlistUrl = (args.playlist ?? process.env.PLAYLIST_URL ?? '').trim() || undefined;
  const cookieText = process.env.YT_COOKIES ?? '';

  if (!args.dryRun || playlistUrl || args.adds.length) {
    const missing = ['yt-dlp', ...(args.dryRun ? [] : ['ffmpeg'])].filter((c) => !hasCommand(c));
    if (missing.length) {
      const msg = `Missing required tool(s): ${missing.join(', ')}. Install them (e.g. brew install yt-dlp ffmpeg deno) and try again.`;
      console.error(gha ? `::error title=Missing tools::${msg}` : msg);
      return 2;
    }
  }

  const ytOpts: YtDlpOptions = {};
  if (!hasCommand('deno')) {
    // yt-dlp enables only Deno by default; Node >= 22 is also supported when named explicitly.
    ytOpts.jsRuntime = `node:${process.execPath}`;
    console.log('Deno not found: letting yt-dlp use this Node.js for YouTube challenges');
  }

  const temps = new Set<string>();
  const cleanupSync = () => {
    for (const d of temps) {
      try {
        // Synchronous fallback for signal exits; async rm is used normally.
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  };
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sig, () => {
      cleanupSync();
      process.exit(130);
    });
  }

  let cookieDir: string | undefined;
  try {
    if (cookieText.trim()) {
      cookieDir = await mkdtemp(join(tmpdir(), 'dancedance-cookies-'));
      temps.add(cookieDir);
      const file = join(cookieDir, 'cookies.txt');
      await writeFile(file, normalizeCookies(cookieText), { mode: 0o600 });
      ytOpts.cookiesFile = file;
      console.log('Using cookies from YT_COOKIES');
    }

    const deps: Deps = {
      fetchPlaylist: (url) => fetchFlatPlaylist(url, ytOpts),
      searchVideos: (q) => searchVideos(q, ytOpts),
      checkEmbed: (id) => checkEmbed(id),
      lookupOfficial: (req) => lookupOfficial(req),
      downloadAudio: (id, dir) => downloadAudio(id, dir, ytOpts),
      decode: decodeWithFfmpeg,
      makeTempDir: async () => {
        const d = await mkdtemp(join(tmpdir(), 'dancedance-audio-'));
        temps.add(d);
        return d;
      },
      removeDir: async (d) => {
        await rm(d, { recursive: true, force: true });
        temps.delete(d);
      },
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      random: Math.random,
      now: () => new Date(),
      clock: () => performance.now() / 1000,
      log: (line) => console.log(line),
    };

    const outcome = await runBeatmaps(
      {
        beatmapsDir: join(root, 'public', 'beatmaps'),
        playlistFile: join(root, 'public', 'playlist.json'),
        starterFile: join(root, 'src', 'data', 'starter.json'),
        songsFile: join(root, 'public', 'songs.json'),
        songsStatusFile: join(root, 'public', 'songs-status.json'),
      },
      {
        playlistUrl,
        only: args.only,
        limit: args.limit,
        force: args.force,
        dryRun: args.dryRun,
        usedCookies: !!ytOpts.cookiesFile,
        adds: args.adds,
      },
      deps,
    );

    const summary = renderSummary(outcome.report);
    if (gha) for (const line of renderAnnotations(outcome.report)) console.log(line);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    else console.log(`\n${summary}`);
    console.log(outcome.written.length ? `Changed ${outcome.written.length} file(s).` : 'No files changed.');
    return outcome.exitCode;
  } finally {
    if (cookieDir) await rm(cookieDir, { recursive: true, force: true });
    temps.delete(cookieDir ?? '');
    cleanupSync();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`beat-map job crashed: ${(e as Error)?.stack ?? e}`);
      process.exitCode = 1;
    },
  );
}
