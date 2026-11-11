/// <reference types="node" />
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ANALYZER_VERSION, analyzeOffline, parse, serialize } from '../../src/core/analysis';
import { synthClickTrack } from '../../src/core/analysis/synth.testutil';
import { runBeatmaps, sanitizeMessage, type Deps, type Paths, type RunOptions } from './pipeline';
import { ToolFailure, f32leToFloat32, type DownloadResult } from './youtube';
import { classifyYtDlpError } from './classify';
import { renderAnnotations, renderSummary } from './summary';
import { parseArgs } from './run';

// --- A tiny WAV writer/reader so the test exercises a real file on disk ---

function wav16(pcm: Float32Array, rate: number): Buffer {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), 44 + i * 2);
  return b;
}

function readWav16(b: Buffer): Float32Array {
  const n = b.readUInt32LE(40) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(44 + i * 2) / 32768;
  return out;
}

const BPM = 120;
const SONG = synthClickTrack({ bpm: BPM, duration: 30, accent: true, pattern: 'pop', seed: 3 });
const STARTER = [
  { videoId: 'aaaaaaaaaaa', title: 'Song A', artist: 'Artist A' },
  { videoId: 'bbbbbbbbbbb', title: 'Song B', artist: 'Artist B' },
  { videoId: 'ccccccccccc', title: 'Song C', artist: 'Artist C' },
];

let root: string;
let paths: Paths;
let audioDirs: string[];
let clock: number;
let downloads: string[];

type Behaviour = (id: string, dir: string) => Promise<DownloadResult>;

function okDownload(): Behaviour {
  return async (id, dir) => {
    const p = join(dir, `${id}.wav`);
    await writeFile(p, wav16(SONG.pcm, SONG.sampleRate));
    return { kind: 'file', path: p };
  };
}

function failing(stderr: string): Behaviour {
  return async () => {
    throw new ToolFailure(classifyYtDlpError(stderr), 'yt-dlp');
  };
}

const BOT = "ERROR: [youtube] x: Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication.";

function deps(download: Behaviour, extra: Partial<Deps> = {}): Deps {
  return {
    fetchPlaylist: async () => ({
      id: 'PLtesttesttest',
      entries: [
        { id: 'ddddddddddd', title: 'Artist D - Song D (Official Video)', channel: 'Artist D', duration: 200 },
        { id: 'eeeeeeeeeee', title: 'Very long mix', channel: 'DJ', duration: 3600 },
      ],
    }),
    downloadAudio: async (id, dir) => {
      downloads.push(id);
      return download(id, dir);
    },
    decode: async (p) => readWav16(await readFile(p)),
    makeTempDir: async () => {
      const d = await mkdtemp(join(root, 'audio-'));
      audioDirs.push(d);
      return d;
    },
    removeDir: (d) => rm(d, { recursive: true, force: true }),
    sleep: async () => {},
    random: () => 0.5,
    now: () => new Date('2026-11-10T12:00:00Z'),
    clock: () => (clock += 1),
    log: () => {},
    ...extra,
  };
}

const opts = (o: Partial<RunOptions> = {}): RunOptions => ({ limit: 25, force: false, dryRun: false, usedCookies: false, ...o });

async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const f of (await readdir(dir)).sort()) out[f] = await readFile(join(dir, f), 'utf8');
  return out;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dancedance-test-'));
  paths = { beatmapsDir: join(root, 'beatmaps'), playlistFile: join(root, 'playlist.json'), starterFile: join(root, 'starter.json') };
  await mkdir(paths.beatmapsDir);
  await writeFile(paths.starterFile, JSON.stringify(STARTER));
  audioDirs = [];
  downloads = [];
  clock = 0;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('runBeatmaps end to end (stubbed YouTube, real analyser)', () => {
  it('writes valid maps, deletes audio, and a second run changes nothing', async () => {
    const r1 = await runBeatmaps(paths, opts({ playlistUrl: 'https://www.youtube.com/playlist?list=PLtesttesttest' }), deps(okDownload()));
    expect(r1.exitCode).toBe(0);
    // Playlist first, then starter; the hour-long mix is skipped without downloading.
    expect(downloads).toEqual(['ddddddddddd', 'aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(r1.report.results.find((x) => x.videoId === 'eeeeeeeeeee')?.kind).toBe('skipped');

    for (const id of downloads) {
      const map = parse(await readFile(join(paths.beatmapsDir, `${id}.json`), 'utf8'));
      expect(map.source).toBe('cloud');
      expect(map.videoId).toBe(id);
      expect(map.analyzerVersion).toBe(ANALYZER_VERSION);
      expect(Math.abs(map.bpm - BPM)).toBeLessThan(1.5);
      expect(map.beats.length).toBeGreaterThan(50);
    }
    // No audio anywhere: every temp dir is gone and no audio landed in the output.
    expect(audioDirs.length).toBe(4);
    for (const d of audioDirs) expect(existsSync(d)).toBe(false);
    expect((await readdir(paths.beatmapsDir)).every((f) => f.endsWith('.json'))).toBe(true);

    const index = JSON.parse(await readFile(join(paths.beatmapsDir, 'index.json'), 'utf8'));
    expect(index).toMatchObject({ analyzerVersion: ANALYZER_VERSION, generatedAt: '2026-11-10T12:00:00.000Z', ids: [...downloads].sort() });
    expect(Object.keys(index.songs)).toEqual([...downloads].sort());
    for (const id of downloads) {
      const map = parse(await readFile(join(paths.beatmapsDir, `${id}.json`), 'utf8'));
      expect(index.songs[id]).toEqual({ bpm: Math.round(map.bpm * 10) / 10, duration: Math.round(map.duration) });
    }
    const status = JSON.parse(await readFile(join(paths.beatmapsDir, 'status.json'), 'utf8'));
    expect(status.videos.aaaaaaaaaaa).toEqual({ state: 'ok', attempts: 1, lastTried: '2026-11-10T12:00:00.000Z' });
    expect(status.videos.eeeeeeeeeee).toMatchObject({ state: 'error', reason: 'too-long' });
    const playlist = JSON.parse(await readFile(paths.playlistFile, 'utf8'));
    expect(playlist).toEqual({
      updatedAt: '2026-11-10T12:00:00.000Z',
      playlistId: 'PLtesttesttest',
      videos: [
        { videoId: 'ddddddddddd', title: 'Song D', artist: 'Artist D' },
        { videoId: 'eeeeeeeeeee', title: 'Very long mix', artist: 'DJ' },
      ],
    });

    const before = await snapshot(paths.beatmapsDir);
    const beforePl = await readFile(paths.playlistFile, 'utf8');
    downloads = [];
    const later = deps(okDownload(), { now: () => new Date('2026-11-10T13:00:00Z') });
    const r2 = await runBeatmaps(paths, opts({ playlistUrl: 'https://www.youtube.com/playlist?list=PLtesttesttest' }), later);
    expect(r2.exitCode).toBe(0);
    expect(downloads).toEqual([]);
    expect(r2.written).toEqual([]);
    expect(await snapshot(paths.beatmapsDir)).toEqual(before);
    expect(await readFile(paths.playlistFile, 'utf8')).toBe(beforePl);
  });

  it('writes exactly what the shared analyser produces for the same PCM (same as the browser path)', async () => {
    await runBeatmaps(paths, opts({ only: 'aaaaaaaaaaa' }), deps(okDownload()));
    const pcm = readWav16(wav16(SONG.pcm, SONG.sampleRate));
    const expected = `${serialize(analyzeOffline(pcm, 22050, { videoId: 'aaaaaaaaaaa', source: 'cloud' }))}\n`;
    expect(await readFile(join(paths.beatmapsDir, 'aaaaaaaaaaa.json'), 'utf8')).toBe(expected);
  });

  it('index.json is rebuilt from the map files, so it cannot drift', async () => {
    await runBeatmaps(paths, opts({ limit: 2 }), deps(okDownload()));
    await writeFile(join(paths.beatmapsDir, 'index.json'), '{"analyzerVersion":"1.0.0","ids":["zzzzzzzzzzz"]}');
    await rm(join(paths.beatmapsDir, 'bbbbbbbbbbb.json'));
    await runBeatmaps(paths, opts({ limit: 0 }), deps(okDownload()));
    const index = JSON.parse(await readFile(join(paths.beatmapsDir, 'index.json'), 'utf8'));
    expect(index.ids).toEqual(['aaaaaaaaaaa']);
    expect(Object.keys(index.songs)).toEqual(['aaaaaaaaaaa']);
  });

  it('honours --limit and --only', async () => {
    await runBeatmaps(paths, opts({ limit: 1 }), deps(okDownload()));
    expect(downloads).toEqual(['aaaaaaaaaaa']);
    downloads = [];
    await runBeatmaps(paths, opts({ only: 'ccccccccccc' }), deps(okDownload()));
    expect(downloads).toEqual(['ccccccccccc']);
    downloads = [];
    // Already mapped: nothing to do without --force.
    await runBeatmaps(paths, opts({ only: 'ccccccccccc' }), deps(okDownload()));
    expect(downloads).toEqual([]);
    await runBeatmaps(paths, opts({ only: 'ccccccccccc', force: true }), deps(okDownload()));
    expect(downloads).toEqual(['ccccccccccc']);
  });

  it('dry run downloads and writes nothing', async () => {
    const r = await runBeatmaps(paths, opts({ dryRun: true, playlistUrl: 'https://www.youtube.com/playlist?list=PLtesttesttest' }), deps(okDownload()));
    expect(r.exitCode).toBe(0);
    expect(downloads).toEqual([]);
    expect(r.written).toEqual([]);
    expect(await readdir(paths.beatmapsDir)).toEqual([]);
    expect(existsSync(paths.playlistFile)).toBe(false);
    expect(r.report.results.map((x) => x.videoId)).toEqual(['ddddddddddd', 'eeeeeeeeeee', 'aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(renderSummary(r.report)).toContain('dry run');
  });

  it('stops after three blocked songs in a row, fails the run and records status', async () => {
    const more = Array.from({ length: 6 }, (_, i) => ({ videoId: `blocked${String(i).padStart(4, '0')}`, title: `B${i}` }));
    await writeFile(paths.starterFile, JSON.stringify(more));
    const r = await runBeatmaps(paths, opts(), deps(failing(BOT)));
    expect(r.exitCode).toBe(1);
    expect(r.report.fatal).toBe('blocked');
    expect(downloads).toHaveLength(3);
    const status = JSON.parse(await readFile(join(paths.beatmapsDir, 'status.json'), 'utf8'));
    expect(Object.keys(status.videos)).toHaveLength(3);
    expect(status.videos.blocked0000).toMatchObject({ state: 'blocked', reason: 'blocked', attempts: 1 });
    const summary = renderSummary(r.report);
    expect(summary).toContain('YouTube is bot-blocking this runner');
    expect(summary).toContain('YT_COOKIES');
    const ann = renderAnnotations(r.report);
    expect(ann[0]).toMatch(/^::error title=YouTube is bot-blocking this runner::/);
    for (const d of audioDirs) expect(existsSync(d)).toBe(false);

    // Next hour: the blocked songs are still backing off only for the first hour, then retried.
    downloads = [];
    const soon = await runBeatmaps(paths, opts(), deps(okDownload(), { now: () => new Date('2026-11-10T12:20:00Z') }));
    expect(downloads).toEqual(['blocked0003', 'blocked0004', 'blocked0005']);
    expect(soon.exitCode).toBe(0);
    downloads = [];
    await runBeatmaps(paths, opts(), deps(okDownload(), { now: () => new Date('2026-11-10T13:00:00Z') }));
    expect(downloads).toEqual(['blocked0000', 'blocked0001', 'blocked0002']);
    const after = JSON.parse(await readFile(join(paths.beatmapsDir, 'status.json'), 'utf8'));
    expect(after.videos.blocked0000).toEqual({ state: 'ok', attempts: 2, lastTried: '2026-11-10T13:00:00.000Z' });
  });

  it('a single blocked --only run is fatal too', async () => {
    const r = await runBeatmaps(paths, opts({ only: 'aaaaaaaaaaa' }), deps(failing(BOT)));
    expect(r.report.fatal).toBe('blocked');
    expect(r.exitCode).toBe(1);
  });

  it('individual unavailable/error songs do not fail the run', async () => {
    let n = 0;
    const mixed: Behaviour = async (id, dir) => {
      n++;
      if (n === 1) throw new ToolFailure(classifyYtDlpError('ERROR: [youtube] aaaaaaaaaaa: Private video. Sign in if granted access'), 'yt-dlp');
      if (n === 2) throw new Error(`boom in ${dir}/file.webm`);
      return okDownload()(id, dir);
    };
    const r = await runBeatmaps(paths, opts(), deps(mixed));
    expect(r.exitCode).toBe(0);
    expect(r.report.results.map((x) => x.kind)).toEqual(['unavailable', 'error', 'ok']);
    const status = JSON.parse(await readFile(join(paths.beatmapsDir, 'status.json'), 'utf8'));
    expect(status.videos.aaaaaaaaaaa).toMatchObject({ state: 'error', reason: 'unavailable' });
    // The temp dir path never reaches the public status file.
    expect(status.videos.bbbbbbbbbbb.message).toContain('<tmp>/file.webm');
    expect(JSON.stringify(status)).not.toContain(root);
  });

  it('three outdated failures from the start stop the run as outdated', async () => {
    const r = await runBeatmaps(paths, opts(), deps(failing('ERROR: [youtube] x: Unable to extract yt initial data; please report this issue')));
    expect(r.report.fatal).toBe('outdated');
    expect(r.exitCode).toBe(1);
    expect(renderSummary(r.report)).toContain('YTDLP_VERSION');
  });

  it('a private playlist fails the run but the starter pack is still processed', async () => {
    const d = deps(okDownload(), {
      fetchPlaylist: async () => {
        throw new ToolFailure(classifyYtDlpError('ERROR: [youtube:tab] PLx: The playlist does not exist.'), 'yt-dlp');
      },
    });
    const r = await runBeatmaps(paths, opts({ playlistUrl: 'https://www.youtube.com/playlist?list=PLxxxxxxxxxx' }), d);
    expect(r.exitCode).toBe(1);
    expect(r.report.fatal).toBe('playlist');
    expect(downloads).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(existsSync(paths.playlistFile)).toBe(false);
  });

  it('pauses between downloads but not before the first', async () => {
    const pauses: number[] = [];
    await runBeatmaps(paths, opts(), deps(okDownload(), { sleep: async (ms) => void pauses.push(ms) }));
    expect(pauses).toEqual([5500, 5500]);
  });
});

describe('helpers', () => {
  it('f32leToFloat32 handles unaligned buffers', () => {
    const src = new Float32Array([0.5, -0.25, 1]);
    const bytes = new Uint8Array(13);
    bytes.set(new Uint8Array(src.buffer), 1);
    expect(Array.from(f32leToFloat32(bytes.subarray(1)))).toEqual([0.5, -0.25, 1]);
  });
  it('sanitizeMessage strips temp dirs and home paths', () => {
    expect(sanitizeMessage('bad /var/x/tmp1/a.webm', '/var/x/tmp1')).toBe('bad <tmp>/a.webm');
    expect(sanitizeMessage('at /Users/someone/thing and /home/runner/work')).toBe('at ~/thing and ~/work');
  });
  it('parseArgs validates input', () => {
    expect(parseArgs(['--only', 'TUVcZfQe-Kw', '--limit', '3', '--force', '--dry-run'])).toMatchObject({ only: 'TUVcZfQe-Kw', limit: 3, force: true, dryRun: true });
    expect(parseArgs(['--only', '']).only).toBeUndefined();
    expect(() => parseArgs(['--only', 'x; rm -rf /'])).toThrow();
    expect(() => parseArgs(['--limit', '-1'])).toThrow();
    expect(() => parseArgs(['--bogus'])).toThrow();
  });
});
