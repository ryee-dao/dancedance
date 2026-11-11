/// <reference types="node" />
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { synthClickTrack } from '../../src/core/analysis/synth.testutil';
import { parseSongsList, parseSongsStatus } from '../../src/beat/cloud';
import { classifyYtDlpError } from './classify';
import { runBeatmaps, type Deps, type Paths, type RunOptions } from './pipeline';
import { parseArgs } from './run';
import { planAdds, renderSongs, requestRetryDue, type AddRequest } from './songs';
import { renderSummary } from './summary';
import { ToolFailure, type EmbedCheck } from './youtube';

const SONG = synthClickTrack({ bpm: 120, duration: 30, accent: true, pattern: 'pop', seed: 3 });
const NOW = new Date('2026-11-10T12:00:00Z');

/** Search results keyed by query; every request gets the same two lists. */
function results(...entries: Record<string, unknown>[]) {
  return { entries };
}
const LYRIC = { id: 'lyricvid001', title: 'Dua Lipa - Levitating (Lyrics)', channel: 'Lyrics Co', view_count: 9e6, duration: 204 };
const LYRIC2 = { id: 'lyricvid002', title: 'Levitating - Dua Lipa (Lyrics)', channel: 'Other Lyrics', view_count: 5e6, duration: 205 };
const OFFICIAL_MV = { id: 'officialmv1', title: 'Dua Lipa - Levitating (Official Music Video)', channel: 'Dua Lipa', channel_is_verified: true, view_count: 9e8, duration: 230 };
const REMIX = { id: 'remixvid001', title: 'Dua Lipa - Levitating (Remix) Lyrics', channel: 'Remixes', view_count: 9e7, duration: 204 };

let root: string;
let paths: Paths;
let downloads: string[];
let searches: string[];
let embedChecks: string[];
let audioDirs: string[];
let clock: number;

interface World {
  search?: (q: string) => Promise<unknown>;
  embed?: Record<string, EmbedCheck>;
  download?: Record<string, 'ok' | 'unavailable' | 'blocked'>;
  itunes?: { artist: string; title: string; durationSec: number } | null;
}

function deps(w: World = {}): Deps {
  return {
    fetchPlaylist: async () => {
      throw new Error('playlist must not be read on an add run');
    },
    downloadAudio: async (id, dir) => {
      downloads.push(id);
      const how = w.download?.[id] ?? 'ok';
      if (how === 'unavailable') throw new ToolFailure(classifyYtDlpError('ERROR: [youtube] x: Video unavailable'), 'yt-dlp');
      if (how === 'blocked') throw new ToolFailure(classifyYtDlpError("ERROR: [youtube] x: Sign in to confirm you're not a bot"), 'yt-dlp');
      const p = join(dir, `${id}.m4a`);
      await writeFile(p, 'fake audio');
      return { kind: 'file', path: p };
    },
    decode: async () => SONG.pcm,
    makeTempDir: async () => {
      const d = await mkdtemp(join(root, 'audio-'));
      audioDirs.push(d);
      return d;
    },
    removeDir: (d) => rm(d, { recursive: true, force: true }),
    sleep: async () => {},
    random: () => 0.5,
    now: () => NOW,
    clock: () => (clock += 1),
    log: () => {},
    searchVideos: async (q) => {
      searches.push(q);
      return w.search ? w.search(q) : results(LYRIC, REMIX, LYRIC2, OFFICIAL_MV);
    },
    checkEmbed: async (id) => {
      embedChecks.push(id);
      return w.embed?.[id] ?? 'ok';
    },
    lookupOfficial: async () => (w.itunes === undefined ? { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 } : w.itunes),
  };
}

const LEVITATING: AddRequest = { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203, explicit: true };
const opts = (o: Partial<RunOptions> = {}): RunOptions => ({ limit: 25, force: false, dryRun: false, usedCookies: false, adds: [LEVITATING], ...o });

async function snapshot(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const f of (await readdir(paths.beatmapsDir)).sort()) out[`beatmaps/${f}`] = await readFile(join(paths.beatmapsDir, f), 'utf8');
  for (const f of [paths.songsFile!, paths.songsStatusFile!]) if (existsSync(f)) out[f.slice(root.length + 1)] = await readFile(f, 'utf8');
  return out;
}

const songsOnDisk = async () => parseSongsList(await readFile(paths.songsFile!, 'utf8'));
const statusOnDisk = async () => (existsSync(paths.songsStatusFile!) ? parseSongsStatus(await readFile(paths.songsStatusFile!, 'utf8')) : {});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dancedance-add-'));
  paths = {
    beatmapsDir: join(root, 'beatmaps'),
    playlistFile: join(root, 'playlist.json'),
    starterFile: join(root, 'starter.json'),
    songsFile: join(root, 'songs.json'),
    songsStatusFile: join(root, 'songs-status.json'),
  };
  await mkdir(paths.beatmapsDir);
  await writeFile(paths.starterFile, JSON.stringify([{ videoId: 'starter0001', title: 'S', artist: 'A' }]));
  downloads = [];
  searches = [];
  embedChecks = [];
  audioDirs = [];
  clock = 0;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('add a song by search', () => {
  it('picks the best lyric video, analyses it and lists it in songs.json; nothing else is touched', async () => {
    const out = await runBeatmaps(paths, opts({ playlistUrl: 'https://www.youtube.com/playlist?list=PLx' }), deps());
    expect(out.exitCode).toBe(0);
    expect(searches).toEqual(['Dua Lipa Levitating lyrics', 'Dua Lipa Levitating official audio']);
    expect(embedChecks).toEqual(['lyricvid001']);
    expect(downloads).toEqual(['lyricvid001']); // not the starter song, not the playlist
    expect(await songsOnDisk()).toEqual([
      { videoId: 'lyricvid001', title: 'Levitating', artist: 'Dua Lipa', addedAt: NOW.toISOString(), durationSec: 203 },
    ]);
    expect(existsSync(join(paths.beatmapsDir, 'lyricvid001.json'))).toBe(true);
    const index = JSON.parse(await readFile(join(paths.beatmapsDir, 'index.json'), 'utf8'));
    expect(index.ids).toEqual(['lyricvid001']);
    expect(existsSync(paths.songsStatusFile!)).toBe(false);
    expect(audioDirs.every((d) => !existsSync(d))).toBe(true);
    expect(out.report.adds).toMatchObject([{ kind: 'added', videoId: 'lyricvid001', tier: 'lyric', videoSeconds: 204, officialSeconds: 203 }]);
    expect(out.report.playlist.skipped).toBe(true);
    expect(renderSummary(out.report)).toContain('### Added by search');
  });

  it('a repeat add of the same song is a no-op (no search, no download, files byte-identical)', async () => {
    await runBeatmaps(paths, opts(), deps());
    const before = await snapshot();
    downloads = [];
    searches = [];
    const later = { ...deps(), now: () => new Date('2026-11-11T08:00:00Z') };
    const again = await runBeatmaps(paths, opts({ adds: [{ ...LEVITATING, artist: 'dua lipa', title: 'LEVITATING' }] }), later);
    expect(again.written).toEqual([]);
    expect(searches).toEqual([]);
    expect(downloads).toEqual([]);
    expect(await snapshot()).toEqual(before);
    expect(again.report.adds).toMatchObject([{ kind: 'already', videoId: 'lyricvid001' }]);
  });

  it('skips videos with embedding disabled, and downloads that are unavailable, then uses the next one', async () => {
    const out = await runBeatmaps(paths, opts(), deps({ embed: { lyricvid001: 'disabled' }, download: { lyricvid002: 'unavailable' } }));
    // lyric 1 not embeddable -> lyric 2 unavailable -> official music video (fallback)
    expect(embedChecks).toEqual(['lyricvid001', 'lyricvid002', 'officialmv1']);
    expect(downloads).toEqual(['lyricvid002', 'officialmv1']);
    expect(await songsOnDisk()).toMatchObject([{ videoId: 'officialmv1', note: 'music-video' }]);
    // The failed candidate is not recorded as a song failure in status.json.
    const st = JSON.parse(await readFile(join(paths.beatmapsDir, 'status.json'), 'utf8'));
    expect(Object.keys(st.videos)).toEqual(['officialmv1']);
    expect(out.report.adds?.[0]).toMatchObject({ kind: 'added', tier: 'music-video' });
  });

  it('records "not found" for the app when nothing matches, and does not retry it by itself', async () => {
    const out = await runBeatmaps(paths, opts(), deps({ search: async () => results(REMIX) }));
    expect(out.exitCode).toBe(0);
    expect(existsSync(paths.songsFile!)).toBe(false);
    expect(await statusOnDisk()).toEqual({
      'dua lipa - levitating': {
        state: 'not-found',
        artist: 'Dua Lipa',
        title: 'Levitating',
        durationSec: 203,
        message: "Couldn't find a YouTube video of this song that matches its official length.",
        attempts: 1,
        lastTried: NOW.toISOString(),
      },
    });
    // A regular (hourly) run leaves it alone.
    searches = [];
    await runBeatmaps(paths, opts({ adds: [] }), deps());
    expect(searches).toEqual([]);
    // Asking again explicitly tries again, and success clears the failure.
    await runBeatmaps(paths, opts(), deps());
    expect(searches).toHaveLength(2);
    expect(await statusOnDisk()).toEqual({});
    expect(await songsOnDisk()).toHaveLength(1);
  });

  it('a bot-blocked run records "blocked", fails the run, and a later regular run retries it', async () => {
    const out = await runBeatmaps(paths, opts({ stopAfter: 1 }), deps({ download: { lyricvid001: 'blocked' } }));
    expect(out.exitCode).toBe(1);
    expect(out.report.fatal).toBe('blocked');
    expect((await statusOnDisk())['dua lipa - levitating']).toMatchObject({ state: 'blocked', attempts: 1 });
    // Two hours later the hourly run (no adds) retries it on its own.
    const later = { ...deps(), now: () => new Date('2026-11-10T14:00:00Z') };
    const retry = await runBeatmaps(paths, opts({ adds: [] }), later);
    expect(retry.exitCode).toBe(0);
    expect(await songsOnDisk()).toMatchObject([{ videoId: 'lyricvid001' }]);
    expect(await statusOnDisk()).toEqual({});
  });

  it('looks up the official length on iTunes when it is missing, and uses the canonical names', async () => {
    const out = await runBeatmaps(
      paths,
      opts({ adds: [{ artist: 'dua lipa', title: 'levitating', explicit: true }] }),
      deps({ itunes: { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 } }),
    );
    expect(out.report.adds?.[0]).toMatchObject({ kind: 'added', officialSeconds: 203 });
    expect((await songsOnDisk())[0]).toMatchObject({ artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 });
    const missing = await runBeatmaps(paths, opts({ adds: [{ artist: 'Nobody', title: 'Nothing', explicit: true }] }), deps({ itunes: null }));
    expect(missing.report.adds?.[0]).toMatchObject({ kind: 'not-found' });
  });

  it('queued requests from the app: new ones are handled, earlier failures wait for their backoff', async () => {
    await writeFile(
      paths.songsStatusFile!,
      JSON.stringify({ updatedAt: NOW.toISOString(), requests: { 'abba - waterloo': { state: 'blocked', artist: 'ABBA', title: 'Waterloo', durationSec: 165, attempts: 1, lastTried: NOW.toISOString() } } }),
    );
    const queued: AddRequest[] = [
      { artist: 'ABBA', title: 'Waterloo', durationSec: 165, explicit: false },
      { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203, explicit: false },
    ];
    const out = await runBeatmaps(paths, opts({ adds: queued }), deps());
    expect(out.report.adds?.map((a) => `${a.title}:${a.kind}`)).toEqual(['Waterloo:skipped', 'Levitating:added']);
  });

  it('songs in songs.json without a current map are processed by regular runs', async () => {
    await writeFile(
      paths.songsFile!,
      renderSongs(undefined, [{ videoId: 'addedsong01', title: 'T', artist: 'A', addedAt: '2026-11-01T00:00:00Z', durationSec: 200 }], NOW.toISOString()),
    );
    await runBeatmaps(paths, opts({ adds: [] }), deps());
    expect(downloads).toContain('addedsong01');
  });

  it('dry run searches and picks but downloads and writes nothing', async () => {
    const out = await runBeatmaps(paths, opts({ dryRun: true }), deps());
    expect(downloads).toEqual([]);
    expect(out.written).toEqual([]);
    expect(existsSync(paths.songsFile!)).toBe(false);
    expect(out.report.adds).toMatchObject([{ kind: 'planned', videoId: 'lyricvid001' }]);
  });
});

describe('songs.json and add planning', () => {
  it('renders oldest first, stable timestamps', () => {
    const a = { videoId: 'aaaaaaaaaaa', title: 'B', artist: 'X', addedAt: '2026-11-02T00:00:00Z', durationSec: 200 };
    const b = { videoId: 'bbbbbbbbbbb', title: 'A', artist: 'X', addedAt: '2026-11-01T00:00:00Z', durationSec: 180, note: 'music-video' as const };
    const t1 = renderSongs(undefined, [a, b], '2026-11-03T00:00:00.000Z');
    expect(JSON.parse(t1).songs.map((s: { videoId: string }) => s.videoId)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
    expect(t1.split('\n')[2]).toBe('  "songs": [');
    expect(renderSongs(t1, [b, a], '2026-11-04T00:00:00.000Z')).toBe(t1);
  });

  it('plans: dedupes, skips added songs, retries explicit ones, waits on backoff', () => {
    const songs = [{ videoId: 'aaaaaaaaaaa', title: 'Levitating', artist: 'Dua Lipa', addedAt: '', durationSec: 203 }];
    const status = {
      'abba - waterloo': { state: 'not-found' as const, artist: 'ABBA', title: 'Waterloo', attempts: 1, lastTried: NOW.toISOString() },
      'a - b': { state: 'error' as const, artist: 'A', title: 'B', durationSec: 100, attempts: 1, lastTried: '2026-11-10T10:00:00Z' },
    };
    const p = planAdds(
      [
        { artist: 'Dua Lipa', title: 'LEVITATING', explicit: true },
        { artist: 'ABBA', title: 'Waterloo', explicit: false },
        { artist: 'ABBA', title: 'waterloo', explicit: true },
        { artist: 'New', title: 'Song', explicit: false },
      ],
      songs,
      status,
      NOW,
    );
    expect(p.todo.map((t) => `${t.key}:${t.why}`)).toEqual(['abba - waterloo:again', 'new - song:new', 'a - b:retry']);
    expect(p.todo[2].req.durationSec).toBe(100);
    expect(p.skipped.map((s) => `${s.key}:${s.why}`)).toEqual(['dua lipa - levitating:already added']);
    expect(requestRetryDue({ state: 'blocked', artist: '', title: '', attempts: 3, lastTried: '2026-11-10T09:00:00Z' }, NOW)).toBe(false); // 4 h backoff
    expect(requestRetryDue({ state: 'blocked', artist: '', title: '', attempts: 3, lastTried: '2026-11-10T07:00:00Z' }, NOW)).toBe(true);
  });

  it('CLI and workflow arguments', () => {
    expect(parseArgs(['--add', 'a-ha - Take On Me', '--duration', '225']).adds).toEqual([{ artist: 'a-ha', title: 'Take On Me', durationSec: 225, explicit: true }]);
    expect(parseArgs(['--add-artist', 'Earth, Wind & Fire', '--add-title', 'September', '--add-duration', '', '--add-queue', '[{"artist":"A","title":"B","duration":"190"}]']).adds).toEqual([
      { artist: 'Earth, Wind & Fire', title: 'September', explicit: true },
      { artist: 'A', title: 'B', durationSec: 190, explicit: false },
    ]);
    expect(() => parseArgs(['--add', 'no separator'])).toThrow(/Artist - Title/);
    expect(() => parseArgs(['--add-title', 'x'])).toThrow(/both/);
    expect(() => parseArgs(['--add', 'a - b', '--only', 'abcdefghijk'])).toThrow(/cannot be combined/);
  });
});
