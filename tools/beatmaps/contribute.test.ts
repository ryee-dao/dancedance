/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkSharedMap, parse, type BeatMap } from '../../src/core/analysis';
import { decideContribution, TAB_BETTER_SPAN, type KnownSongs } from './contribute';
import { runBeatmaps, type Deps, type Paths, type RunOptions } from './pipeline';
import { parseArgs } from './run';
import { planWork, type VideoStatus } from './select';
import { renderSummary } from './summary';

const PUBLIC = join(__dirname, '../../public/beatmaps');
/** A real cloud map (Spice Girls - Wannabe) re-labelled as a contribution. */
const REAL = parse(readFileSync(join(PUBLIC, 'fw-QRyQcFH8.json'), 'utf8'));
const ADDED_ID = 'addedsong01';
const asTab = (o: Partial<BeatMap> = {}): BeatMap => ({ ...REAL, videoId: ADDED_ID, source: 'tab', ...o });
const NOW = new Date('2026-11-11T06:00:00Z');

let root: string;
let paths: Paths;

const fail = async () => {
  throw new Error('contributed-map runs must not touch YouTube');
};
const deps: Deps = {
  fetchPlaylist: fail,
  downloadAudio: fail,
  decode: fail,
  searchVideos: fail,
  checkEmbed: fail,
  makeTempDir: fail,
  removeDir: async () => {},
  sleep: async () => {},
  random: () => 0.5,
  now: () => NOW,
  clock: () => 0,
  log: () => {},
};
const opts = (map: unknown): RunOptions => ({ limit: 25, force: false, dryRun: false, usedCookies: false, contributed: typeof map === 'string' ? map : JSON.stringify(map) });
const songsJson = () => JSON.parse(readFileSync(paths.songsFile!, 'utf8'));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dancedance-contrib-'));
  paths = {
    beatmapsDir: join(root, 'beatmaps'),
    playlistFile: join(root, 'playlist.json'),
    starterFile: join(root, 'starter.json'),
    songsFile: join(root, 'songs.json'),
    songsStatusFile: join(root, 'songs-status.json'),
  };
  await mkdir(paths.beatmapsDir);
  await writeFile(paths.starterFile, JSON.stringify([{ videoId: 'starter0001', title: 'S', artist: 'A' }]));
  await writeFile(paths.playlistFile, JSON.stringify({ updatedAt: 'x', playlistId: 'PL', videos: [{ videoId: 'playlist001', title: 'P' }] }));
  await writeFile(
    paths.songsFile!,
    `${JSON.stringify({ updatedAt: '2026-11-11T05:00:00.000Z', songs: [{ videoId: ADDED_ID, title: 'Wannabe', artist: 'Spice Girls', addedAt: '2026-11-11T05:00:00.000Z', durationSec: 173, hasMap: false }] }, null, 2)}\n`,
  );
  await writeFile(
    paths.songsStatusFile!,
    `${JSON.stringify({ updatedAt: '2026-11-11T05:00:00.000Z', requests: { 'spice girls - wannabe': { state: 'map-pending', artist: 'Spice Girls', title: 'Wannabe', durationSec: 173, videoId: ADDED_ID, message: 'Listed.', attempts: 1, lastTried: '2026-11-11T05:00:00.000Z' } } }, null, 2)}\n`,
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('contributed beat maps (map_json)', () => {
  it('accepts a valid tab map for a listed song without a map: writes it, indexes it, marks hasMap; deterministic', async () => {
    const out = await runBeatmaps(paths, opts(asTab()), deps);
    expect(out.exitCode).toBe(0);
    expect(out.report.contribution).toMatchObject({ videoId: ADDED_ID, outcome: 'accepted', source: 'tab' });
    expect(renderSummary(out.report)).toContain('Contributed beat map');
    const file = readFileSync(join(paths.beatmapsDir, `${ADDED_ID}.json`), 'utf8');
    expect(parse(file)).toMatchObject({ videoId: ADDED_ID, source: 'tab', bpm: REAL.bpm });
    const index = JSON.parse(readFileSync(join(paths.beatmapsDir, 'index.json'), 'utf8'));
    expect(index.songs[ADDED_ID]).toEqual({ bpm: Math.round(REAL.bpm * 10) / 10, duration: Math.round(REAL.duration) });
    expect(songsJson().songs[0].hasMap).toBe(true);
    expect(JSON.parse(readFileSync(paths.songsStatusFile!, 'utf8')).requests).toEqual({});
    expect(existsSync(join(paths.beatmapsDir, 'status.json'))).toBe(false); // download history untouched
    // Same map again: nothing changes at all.
    const before = readdirSync(paths.beatmapsDir).map((f) => readFileSync(join(paths.beatmapsDir, f), 'utf8'));
    const again = await runBeatmaps(paths, opts(asTab()), deps);
    expect(again.written).toEqual([]);
    expect(again.report.contribution?.outcome).toBe('ignored');
    expect(readdirSync(paths.beatmapsDir).map((f) => readFileSync(join(paths.beatmapsDir, f), 'utf8'))).toEqual(before);
  });

  it('accepts maps for starter and playlist songs too, but never for unknown videos', async () => {
    expect((await runBeatmaps(paths, opts(asTab({ videoId: 'playlist001' })), deps)).report.contribution?.outcome).toBe('accepted');
    expect((await runBeatmaps(paths, opts(asTab({ videoId: 'starter0001' })), deps)).report.contribution?.outcome).toBe('accepted');
    const out = await runBeatmaps(paths, opts(asTab({ videoId: 'unknown0001' })), deps);
    expect(out.report.contribution).toMatchObject({ outcome: 'rejected', videoId: 'unknown0001' });
    expect(existsSync(join(paths.beatmapsDir, 'unknown0001.json'))).toBe(false);
  });

  it.each<[string, unknown]>([
    ['not JSON', '{"v":1,'],
    ['an extra field', { ...asTab(), cmd: '$(rm -rf /)' }],
    ['an extra section field', { ...asTab(), sections: asTab().sections.map((s, i) => (i ? s : { ...s, x: 1 })) }],
    ['a mic map', asTab({ source: 'mic' })],
    ['a cloud map', asTab({ source: 'cloud' })],
    ['a partial map', asTab({ partial: true })],
    ['too few beats for the tempo', asTab({ beats: REAL.beats.filter((_, i) => i % 2 === 0), downbeats: [] })],
    ['a tempo that does not match the beats', asTab({ bpm: REAL.bpm * 1.3 })],
    ['a short song', asTab({ duration: 20, beats: REAL.beats.filter((t) => t < 20), downbeats: [], sections: [{ start: 0, end: 20, type: 'verse', energy: 0.5 }] })],
    ['a length far from the official one', asTab({ duration: 400, sections: REAL.sections.map((s, i, a) => (i === a.length - 1 ? { ...s, end: 400 } : s)) })],
    ['a bad video ID', asTab({ videoId: 'x"; echo 1' })],
  ])('rejects %s and writes nothing', async (_, map) => {
    const out = await runBeatmaps(paths, opts(map), deps);
    expect(out.exitCode).toBe(0);
    expect(out.report.contribution?.outcome).toBe('rejected');
    expect(out.written).toEqual([]);
  });

  it('ranking: cloud is never replaced, device replaces tab, device does not replace device, tab only replaces a clearly shorter tab map', () => {
    const known: KnownSongs = { ids: new Set([ADDED_ID]), durations: new Map() };
    const tab = asTab();
    expect(decideContribution(tab, known, { source: 'cloud', span: 0.5 }).kind).toBe('ignore');
    expect(decideContribution(asTab({ source: 'device' }), known, { source: 'cloud', span: 0.5 }).kind).toBe('ignore');
    expect(decideContribution(asTab({ source: 'device' }), known, { source: 'tab', span: 0.99 })).toMatchObject({ kind: 'accept', replaces: 'tab' });
    expect(decideContribution(asTab({ source: 'device' }), known, { source: 'device', span: 0.1 }).kind).toBe('ignore');
    expect(decideContribution(tab, known, { source: 'device', span: 0.1 }).kind).toBe('ignore');
    const span = (REAL.beats[REAL.beats.length - 1] - REAL.beats[0]) / REAL.duration;
    expect(decideContribution(tab, known, { source: 'tab', span: span - TAB_BETTER_SPAN + 0.001 }).kind).toBe('ignore');
    expect(decideContribution(tab, known, { source: 'tab', span: span - TAB_BETTER_SPAN - 0.01 })).toMatchObject({ kind: 'accept', replaces: 'tab' });
    expect(decideContribution(tab, known, { source: 'mic', span: 1 }).kind).toBe('accept');
  });

  it('end to end: a device map replaces a contributed tab map; a later tab map is ignored', async () => {
    await runBeatmaps(paths, opts(asTab()), deps);
    const dev = await runBeatmaps(paths, opts(asTab({ source: 'device' })), deps);
    expect(dev.report.contribution).toMatchObject({ outcome: 'accepted', replaces: 'tab' });
    expect(parse(await readFile(join(paths.beatmapsDir, `${ADDED_ID}.json`), 'utf8')).source).toBe('device');
    expect((await runBeatmaps(paths, opts(asTab()), deps)).report.contribution?.outcome).toBe('ignored');
  });

  it('every real cloud map in public/beatmaps passes the sharing rules once re-labelled tab', () => {
    const names = readdirSync(PUBLIC).filter((f) => /^[A-Za-z0-9_-]{11}\.json$/.test(f));
    expect(names.length).toBeGreaterThan(50);
    const bad = names.map((f) => [f, checkSharedMap({ ...JSON.parse(readFileSync(join(PUBLIC, f), 'utf8')), source: 'tab' })] as const).filter(([, r]) => !r.ok);
    expect(bad).toEqual([]);
  });

  it('the CLI reads the map from MAP_JSON (never argv) and refuses to mix modes', () => {
    expect(parseArgs(['--contributed-map'])).toMatchObject({ contributedMap: true });
    expect(() => parseArgs(['--contributed-map', '--only', 'abcdefghijk'])).toThrow();
    expect(parseArgs(['--retry-blocked']).retryBlocked).toBe(true);
  });
});

describe('selection of songs whose only map came from listening', () => {
  const c = (videoId: string) => ({ videoId, origin: 'playlist' as const });
  const base = { analyzerVersion: '1.1.0', now: NOW, limit: 10 };
  it('re-analyses tab-only songs after everything else, with the usual backoff; device/cloud maps are done', () => {
    const plan = planWork({
      ...base,
      candidates: [c('tabmap00001'), c('newsong0001'), c('devmap00001'), c('cloudmap001')],
      existing: new Map([['tabmap00001', '1.1.0'], ['devmap00001', '1.1.0'], ['cloudmap001', '1.1.0']]),
      sources: new Map([['tabmap00001', 'tab'], ['devmap00001', 'device'], ['cloudmap001', 'cloud']]),
      status: {},
    });
    expect(plan.todo).toEqual([{ candidate: c('newsong0001'), why: 'new' }, { candidate: c('tabmap00001'), why: 'upgrade' }]);
    expect(plan.done).toBe(2);
    const blocked: VideoStatus = { state: 'blocked', reason: 'blocked', attempts: 3, lastTried: new Date(NOW.getTime() - 3600_000).toISOString() };
    const p2 = { ...base, candidates: [c('tabmap00001')], existing: new Map([['tabmap00001', '1.1.0']]), sources: new Map([['tabmap00001', 'tab']]), status: { tabmap00001: blocked } };
    expect(planWork(p2)).toMatchObject({ todo: [], waiting: 1 });
    // Local sync ignores the backoff of blocked songs.
    expect(planWork({ ...p2, retryBlocked: true }).todo).toEqual([{ candidate: c('tabmap00001'), why: 'upgrade' }]);
  });
});
