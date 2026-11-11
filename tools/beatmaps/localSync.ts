/// <reference types="node" />
/**
 * Local sync for a computer YouTube doesn't block (e.g. the owner's Mac):
 *
 *   npm run beatmaps:local                 # pull, make what's pending, show what changed
 *   npm run beatmaps:local -- --push       # ... then commit only the beat-map JSON and push
 *   npm run beatmaps:local -- --allow-dirty [--limit 50] [--playlist <url>]
 *
 * 1. Refuses to run when the working tree has changes other than the data
 *    files (public/beatmaps/*.json, public/playlist.json, public/songs.json,
 *    public/songs-status.json), unless --allow-dirty.
 * 2. git pull --rebase --autostash.
 * 3. Runs the beat-map tool with --retry-blocked: songs the cloud couldn't
 *    download (blocked add requests, listed songs without a map, songs whose
 *    only map is a contributed 'tab' map) are tried now, ignoring backoff.
 *    The playlist comes from --playlist, $PLAYLIST_URL, or public/playlist.json.
 * 4. Prints the changed data files. With --push: commits exactly those (with
 *    a clear message) and pushes; without it, stops and says what it would commit.
 *
 * Needs git, yt-dlp, ffmpeg (and Deno), like `npm run beatmaps`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_FILE_RE = /^public\/(?:beatmaps\/[A-Za-z0-9_-]+|playlist|songs|songs-status)\.json$/;

export interface SyncArgs {
  push: boolean;
  allowDirty: boolean;
  limit: number;
  playlist?: string;
  help: boolean;
}

export function parseSyncArgs(argv: string[]): SyncArgs {
  const a: SyncArgs = { push: false, allowDirty: false, limit: 50, help: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--push') a.push = true;
    else if (k === '--allow-dirty') a.allowDirty = true;
    else if (k === '-h' || k === '--help') a.help = true;
    else if (k === '--limit') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 0) throw new Error('--limit must be a whole number >= 0');
      a.limit = n;
    } else if (k === '--playlist') {
      const v = argv[++i];
      if (!v) throw new Error('--playlist needs a value');
      a.playlist = v;
    } else throw new Error(`unknown argument: ${k}`);
  }
  return a;
}

export interface SyncDeps {
  git(args: string[]): string;
  /** Runs the beat-map tool; returns its exit code. */
  runTool(args: string[], env: Record<string, string>): number;
  log(line: string): void;
}

/** `git status --porcelain` paths (renames: the new path). */
export function changedPaths(porcelain: string): string[] {
  return porcelain
    .split('\n')
    .filter((l) => l.length > 3)
    .map((l) => l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''));
}

/** Playlist link: --playlist, then $PLAYLIST_URL, then the published public/playlist.json. */
export function playlistFor(root: string, args: SyncArgs, env: Record<string, string | undefined>): string | undefined {
  if (args.playlist) return args.playlist;
  if (env.PLAYLIST_URL?.trim()) return env.PLAYLIST_URL.trim();
  try {
    const id = (JSON.parse(readFileSync(join(root, 'public', 'playlist.json'), 'utf8')) as { playlistId?: unknown }).playlistId;
    if (typeof id === 'string' && /^[A-Za-z0-9_-]{10,64}$/.test(id)) return `https://www.youtube.com/playlist?list=${id}`;
  } catch {
    // none published
  }
  return undefined;
}

/** Returns the process exit code. */
export function localSync(root: string, args: SyncArgs, deps: SyncDeps, env: Record<string, string | undefined> = process.env): number {
  const dirty = changedPaths(deps.git(['status', '--porcelain', '--untracked-files=all']));
  const other = dirty.filter((p) => !DATA_FILE_RE.test(p));
  if (other.length && !args.allowDirty) {
    deps.log(`Refusing to run: the working tree has changes other than beat-map data:\n  ${other.join('\n  ')}\nCommit or stash them, or pass --allow-dirty.`);
    return 2;
  }
  deps.log('Pulling the latest commits (git pull --rebase --autostash)…');
  deps.git(['pull', '--rebase', '--autostash']);

  const toolArgs = ['--retry-blocked', '--limit', String(args.limit)];
  const playlist = playlistFor(root, args, env);
  if (playlist) toolArgs.push('--playlist', playlist);
  else deps.log('No playlist link (set PLAYLIST_URL or pass --playlist): doing the starter pack and added songs only.');
  const code = deps.runTool(toolArgs, {});
  if (code !== 0) deps.log(`The beat-map tool exited with ${code} (see above); any maps it made are still listed below.`);

  const changed = changedPaths(deps.git(['status', '--porcelain', '--untracked-files=all'])).filter((p) => DATA_FILE_RE.test(p));
  if (!changed.length) {
    deps.log('Nothing changed.');
    return code === 0 ? 0 : 1;
  }
  const maps = changed.filter((p) => p.startsWith('public/beatmaps/') && !/\/(index|status)\.json$/.test(p));
  deps.log(`Changed ${changed.length} file(s), ${maps.length} beat map(s):\n  ${changed.join('\n  ')}`);
  const message = `Beat maps from local sync (${maps.length} map file(s) changed)`;
  if (!args.push) {
    deps.log(`Not committing (no --push). It would commit exactly these files as:\n  "${message}"\nRun again with --push to commit and push them.`);
    return 0;
  }
  deps.git(['add', '--', ...changed]);
  const staged = deps.git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
  const bad = staged.filter((p) => !DATA_FILE_RE.test(p));
  if (bad.length) {
    deps.log(`Refusing to commit files other than beat-map data: ${bad.join(', ')}`);
    return 1;
  }
  deps.git(['commit', '-q', '-m', message, '--', ...changed]);
  deps.git(['push', '-q']);
  deps.log(`Committed and pushed: ${message}`);
  return 0;
}

const USAGE = `Usage: npm run beatmaps:local -- [--push] [--allow-dirty] [--limit <n>] [--playlist <url>]
  --push         commit the changed beat-map JSON and push it (otherwise: show what would be committed)
  --allow-dirty  run even if other files have uncommitted changes (they are never committed)
  --limit <n>    at most n songs this run (default 50)
  --playlist url playlist link (default: $PLAYLIST_URL, else the one in public/playlist.json)`;

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  let args: SyncArgs;
  try {
    args = parseSyncArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (!existsSync(join(root, '.git'))) {
    console.error('Run this from a git checkout of the project.');
    process.exit(2);
  }
  const code = localSync(root, args, {
    git: (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }),
    runTool: (a, env) => spawnSync(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'tools', 'beatmaps', 'run.ts'), ...a], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1,
    log: (l) => console.log(l),
  });
  process.exit(code);
}
