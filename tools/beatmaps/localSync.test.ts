/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { changedPaths, DATA_FILE_RE, localSync, parseSyncArgs, playlistFor, type SyncDeps } from './localSync';

let base: string;
let origin: string;
let clone: string;
const git = (cwd: string, ...a: string[]) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function deps(cwd: string, tool: (args: string[]) => void = () => {}) {
  const lines: string[] = [];
  const toolCalls: string[][] = [];
  const d: SyncDeps = {
    git: (a) => git(cwd, ...a),
    runTool: (a) => {
      toolCalls.push(a);
      tool(a);
      return 0;
    },
    log: (l) => lines.push(l),
  };
  return { d, lines, toolCalls };
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'dancedance-sync-'));
  origin = join(base, 'origin.git');
  const seed = join(base, 'seed');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  mkdirSync(join(seed, 'public', 'beatmaps'), { recursive: true });
  git(seed, 'init', '-q', '-b', 'main');
  git(seed, 'config', 'user.email', 't@example.com');
  git(seed, 'config', 'user.name', 'T');
  writeFileSync(join(seed, 'README.md'), 'x\n');
  writeFileSync(join(seed, 'public', 'playlist.json'), JSON.stringify({ updatedAt: 'x', playlistId: 'PLabcdefghij', videos: [] }));
  writeFileSync(join(seed, 'public', 'beatmaps', 'index.json'), '{}\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', origin);
  git(seed, 'push', '-q', 'origin', 'main');
  clone = join(base, 'clone');
  git(base, 'clone', '-q', origin, clone);
  git(clone, 'config', 'user.email', 't@example.com');
  git(clone, 'config', 'user.name', 'T');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const makeMap = (cwd: string) => () => {
  writeFileSync(join(cwd, 'public', 'beatmaps', 'abcdefghijk.json'), '{"v":1}\n');
  writeFileSync(join(cwd, 'public', 'beatmaps', 'index.json'), '{"ids":["abcdefghijk"]}\n');
};

describe('local sync (npm run beatmaps:local)', () => {
  it('refuses a dirty tree with non-data changes unless --allow-dirty, without touching git or the tool', () => {
    writeFileSync(join(clone, 'README.md'), 'edited\n');
    const { d, lines, toolCalls } = deps(clone);
    expect(localSync(clone, parseSyncArgs([]), d, {})).toBe(2);
    expect(lines[0]).toContain('README.md');
    expect(toolCalls).toEqual([]);
    const ok = deps(clone, makeMap(clone));
    expect(localSync(clone, parseSyncArgs(['--allow-dirty']), ok.d, {})).toBe(0);
    expect(ok.toolCalls).toHaveLength(1);
  });

  it('dry by default: pulls, runs the tool with --retry-blocked and the published playlist, says what it would commit, commits nothing', () => {
    const { d, lines, toolCalls } = deps(clone, makeMap(clone));
    expect(localSync(clone, parseSyncArgs([]), d, {})).toBe(0);
    expect(toolCalls).toEqual([['--retry-blocked', '--limit', '50', '--playlist', 'https://www.youtube.com/playlist?list=PLabcdefghij']]);
    expect(lines.join('\n')).toContain('Not committing (no --push)');
    expect(lines.join('\n')).toContain('public/beatmaps/abcdefghijk.json');
    expect(git(clone, 'log', '--oneline').trim().split('\n')).toHaveLength(1);
  });

  it('--push commits only the data files and pushes; a stray file stays uncommitted', () => {
    writeFileSync(join(clone, 'notes.txt'), 'private\n');
    const { d, lines } = deps(clone, makeMap(clone));
    expect(localSync(clone, parseSyncArgs(['--push', '--allow-dirty']), d, {})).toBe(0);
    expect(lines.join('\n')).toContain('Committed and pushed');
    const files = git(origin, 'show', '--name-only', '--format=%s', 'main').trim().split('\n');
    expect(files[0]).toBe('Beat maps from local sync (1 map file(s) changed)');
    expect(files.slice(1).filter(Boolean).sort()).toEqual(['public/beatmaps/abcdefghijk.json', 'public/beatmaps/index.json']);
    expect(changedPaths(git(clone, 'status', '--porcelain'))).toEqual(['notes.txt']);
  });

  it('pulls new commits first, and reports when nothing changed', () => {
    const other = join(base, 'other');
    git(base, 'clone', '-q', origin, other);
    git(other, 'config', 'user.email', 't@example.com');
    git(other, 'config', 'user.name', 'T');
    writeFileSync(join(other, 'public', 'songs.json'), '{}\n');
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '-m', 'from elsewhere');
    git(other, 'push', '-q');
    const { d, lines } = deps(clone);
    expect(localSync(clone, parseSyncArgs(['--push']), d, {})).toBe(0);
    expect(readFileSync(join(clone, 'public', 'songs.json'), 'utf8')).toBe('{}\n');
    expect(lines).toContain('Nothing changed.');
  });

  it('only beat-map JSON counts as data; playlist precedence', () => {
    for (const p of ['public/beatmaps/abc_DEF-123.json', 'public/songs.json', 'public/songs-status.json', 'public/playlist.json', 'public/beatmaps/index.json']) expect(DATA_FILE_RE.test(p)).toBe(true);
    for (const p of ['public/beatmaps/a.mp3', 'src/x.json', 'public/beatmaps/../x.json', 'public/beatmaps/sub/x.json', '.github/workflows/beatmaps.yml']) expect(DATA_FILE_RE.test(p)).toBe(false);
    expect(playlistFor(clone, parseSyncArgs(['--playlist', 'P']), { PLAYLIST_URL: 'E' })).toBe('P');
    expect(playlistFor(clone, parseSyncArgs([]), { PLAYLIST_URL: 'E' })).toBe('E');
    expect(() => parseSyncArgs(['--force'])).toThrow();
  });
});
