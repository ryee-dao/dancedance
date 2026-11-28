/// <reference types="node" />
/**
 * "Paste a YouTube link" after a song wasn't found: the job checks the chosen video against
 * the picker's rules (pick.ts judgeVideo) and adds it, records why not ('video-mismatch'), or
 * refuses it; "Use it anyway" (force) adds it regardless.
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { synthClickTrack } from '../../src/core/analysis/synth.testutil';
import { parseSongsList, parseSongsStatus } from '../../src/beat/cloud';
import { classifyYtDlpError } from './classify';
import { CHOSEN_WINDOW, judgeVideo, MV_WINDOW, parseQueue, parseVideoInfo, THIRD_PARTY_WINDOW, WINDOW, type VideoInfo } from './pick';
import { runBeatmaps, type Deps, type Paths, type RunOptions } from './pipeline';
import { parseArgs } from './run';
import { planAdds, renderSongsStatus, requestRetryDue, type AddRequest } from './songs';
import { renderAnnotations, renderSummary } from './summary';
import { ToolFailure, type EmbedCheck } from './youtube';

const SONG = synthClickTrack({ bpm: 120, duration: 30, accent: true, pattern: 'pop', seed: 3 });
const NOW = new Date('2026-11-10T12:00:00Z');
const NO_AUDIO = 'ERROR: [youtube] x: Requested format is not available. Use --list-formats for a list of available formats';

/** yt-dlp -J answers, as seen live on 2026-11-26 (trimmed). */
const ART_TRACK = {
  id: '8O7yWgX6--4',
  title: 'The 808 Track (feat. Mighty High Coup)',
  channel: 'Bassnectar',
  channel_is_verified: false,
  duration: 271,
  view_count: 40_000,
  live_status: 'not_live',
  availability: 'public',
  playable_in_embed: true,
  description: 'Provided to YouTube by Amorphous Music\n\nThe 808 Track (feat. Mighty High Coup) · Bassnectar · Mighty High Coup',
};
const FAN_UPLOAD = { ...ART_TRACK, id: '3Mq0VpLSnwc', title: 'The 808 Track (Bassnectar)', channel: 'PURPLETAC0S69', duration: 314, description: '' };
const UNRELATED = { ...ART_TRACK, id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)', channel: 'Rick Astley', channel_is_verified: true, duration: 213, description: '' };
const REQ: AddRequest = { artist: 'Bassnectar', title: 'The 808 Track (feat. Mighty High Coup)', durationSec: 271, explicit: true };
const KEY = 'bassnectar - the 808 track feat mighty high coup';

let root: string;
let paths: Paths;
let downloads: string[];
let searches: string[];
let infos: string[];

interface World {
  info?: Record<string, unknown | 'blocked' | 'private'>;
  embed?: Record<string, EmbedCheck>;
  download?: Record<string, 'ok' | 'withheld' | 'blocked'>;
}

function deps(w: World = {}): Deps {
  return {
    fetchPlaylist: async () => {
      throw new Error('no playlist on an add run');
    },
    downloadAudio: async (id, dir) => {
      downloads.push(id);
      const how = w.download?.[id] ?? 'ok';
      if (how === 'withheld') throw new ToolFailure(classifyYtDlpError(NO_AUDIO), 'yt-dlp');
      if (how === 'blocked') throw new ToolFailure(classifyYtDlpError("ERROR: [youtube] x: Sign in to confirm you're not a bot"), 'yt-dlp');
      const p = join(dir, `${id}.m4a`);
      await writeFile(p, 'fake audio');
      return { kind: 'file', path: p };
    },
    decode: async () => SONG.pcm,
    makeTempDir: () => mkdtemp(join(root, 'audio-')),
    removeDir: (d) => rm(d, { recursive: true, force: true }),
    sleep: async () => {},
    random: () => 0.5,
    now: () => NOW,
    clock: () => 1,
    log: () => {},
    searchVideos: async (q) => {
      searches.push(q);
      return { entries: [] };
    },
    checkEmbed: async (id) => w.embed?.[id] ?? 'ok',
    videoInfo: async (id) => {
      infos.push(id);
      const v = w.info?.[id] ?? [ART_TRACK, FAN_UPLOAD, UNRELATED].find((x) => x.id === id);
      if (v === 'blocked') throw new ToolFailure(classifyYtDlpError("ERROR: [youtube] x: Sign in to confirm you're not a bot"), 'yt-dlp');
      if (v === 'private') throw new ToolFailure(classifyYtDlpError('ERROR: [youtube] x: Private video. Sign in if you have been granted access'), 'yt-dlp');
      return v;
    },
    lookupOfficial: async () => null,
  };
}

const opts = (adds: AddRequest[], o: Partial<RunOptions> = {}): RunOptions => ({ limit: 25, force: false, dryRun: false, usedCookies: false, adds, ...o });
const statusOnDisk = async () => (existsSync(paths.songsStatusFile!) ? parseSongsStatus(await readFile(paths.songsStatusFile!, 'utf8')) : {});
const songsOnDisk = async () => (existsSync(paths.songsFile!) ? parseSongsList(await readFile(paths.songsFile!, 'utf8')) : []);

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dancedance-chosen-'));
  paths = {
    beatmapsDir: join(root, 'beatmaps'),
    playlistFile: join(root, 'playlist.json'),
    starterFile: join(root, 'starter.json'),
    songsFile: join(root, 'songs.json'),
    songsStatusFile: join(root, 'songs-status.json'),
  };
  await mkdir(paths.beatmapsDir);
  await writeFile(paths.starterFile, '[]');
  downloads = [];
  searches = [];
  infos = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const info = (o: Record<string, unknown>): VideoInfo => parseVideoInfo({ ...ART_TRACK, ...o })!;
const req = { artist: REQ.artist, title: REQ.title, durationSec: 271 };

describe('judgeVideo: the picker’s rules for a video the person chose', () => {
  it('the genuine art track matches; a fan upload 43 s longer and an unrelated video do not, with a plain reason', () => {
    expect(judgeVideo(req, parseVideoInfo(ART_TRACK)!)).toEqual({ kind: 'match' });
    expect(judgeVideo(req, parseVideoInfo(FAN_UPLOAD)!)).toEqual({ kind: 'mismatch', reason: 'length', message: 'This video is 5:14 but the song is 4:31.' });
    expect(judgeVideo(req, parseVideoInfo(UNRELATED)!)).toMatchObject({ kind: 'mismatch', message: 'The video’s title doesn’t mention “The 808 Track”.' });
  });
  it('version words the request lacks, a missing artist, a missing qualifier', () => {
    expect(judgeVideo(req, info({ title: 'The 808 Track (Karaoke Version)' }))).toMatchObject({ kind: 'mismatch', reason: 'karaoke', message: 'This looks like a karaoke version.' });
    expect(judgeVideo(req, info({ title: 'Bassnectar - The 808 Track (sped up)' }))).toMatchObject({ kind: 'mismatch', message: 'This looks like a sped-up version.' });
    expect(judgeVideo(req, info({ title: 'The 808 Track', channel: 'Karaoke Hits' }))).toMatchObject({ message: 'This looks like a karaoke version (going by the channel’s name).' });
    expect(judgeVideo(req, info({ title: 'The 808 Track', channel: 'Some Uploader', description: '' }))).toMatchObject({ kind: 'mismatch', message: 'The video doesn’t name Bassnectar in its title or channel.' });
    const tv = { artist: 'Taylor Swift', title: "Love Story (Taylor's Version)", durationSec: 235 };
    expect(judgeVideo(tv, info({ title: 'Taylor Swift - Love Story', channel: 'Taylor Swift', duration: 235 }))).toMatchObject({ kind: 'mismatch', message: 'The video’s title doesn’t say “taylor s version”, which the song’s title does.' });
  });
  it('length: CHOSEN_WINDOW (-3 .. +6 s), MV_WINDOW for the artist’s own official music video', () => {
    expect(CHOSEN_WINDOW[1]).toBe(WINDOW[1]);
    expect(CHOSEN_WINDOW[0]).toBeLessThan(THIRD_PARTY_WINDOW[0]);
    for (const [d, kind] of [[268, 'match'], [267, 'mismatch'], [277, 'match'], [278, 'mismatch']] as const) {
      expect(judgeVideo(req, info({ duration: d })).kind, String(d)).toBe(kind);
    }
    const mv = { title: 'Bassnectar - The 808 Track (Official Music Video)', channel: 'Bassnectar', channel_is_verified: true, description: '' };
    expect(judgeVideo(req, info({ ...mv, duration: 271 + MV_WINDOW[1] })).kind).toBe('match');
    expect(judgeVideo(req, info({ ...mv, duration: 271 + MV_WINDOW[1] + 1 })).kind).toBe('mismatch');
  });
  it('refuses what could never play or isn’t a song: live, private, not embeddable, too short or long, no such video', () => {
    expect(judgeVideo(req, info({ live_status: 'is_live' }))).toMatchObject({ kind: 'refuse', reason: 'live' });
    expect(judgeVideo(req, info({ live_status: 'is_upcoming' }))).toMatchObject({ kind: 'refuse', reason: 'live' });
    expect(judgeVideo(req, info({ availability: 'private' }))).toMatchObject({ kind: 'refuse', reason: 'unavailable' });
    expect(judgeVideo(req, info({ availability: 'needs_auth' }))).toMatchObject({ kind: 'refuse', reason: 'unavailable' });
    expect(judgeVideo(req, info({ playable_in_embed: false }))).toMatchObject({ kind: 'refuse', reason: 'embed' });
    expect(judgeVideo(req, info({ duration: 19 }))).toMatchObject({ kind: 'refuse', reason: 'length', message: 'This video is 0:19 long. Songs need to be between 0:20 and 15:00.' });
    expect(judgeVideo(req, info({ duration: 901 }))).toMatchObject({ kind: 'refuse', reason: 'length' });
    // yt-dlp's placeholder for an ID that doesn't exist.
    expect(judgeVideo(req, parseVideoInfo({ id: 'xxxxxxxxxx0', title: 'youtube video #xxxxxxxxxx0' })!)).toMatchObject({ kind: 'refuse', reason: 'unavailable' });
    expect(parseVideoInfo({ id: 'short', title: 'x' })).toBeNull();
  });
});

describe('the job with a chosen video', () => {
  it('a matching video is added like a found one, marked user-video; no search', async () => {
    const out = await runBeatmaps(paths, opts([{ ...REQ, videoId: '8O7yWgX6--4' }]), deps());
    expect(out.exitCode).toBe(0);
    expect(searches).toEqual([]);
    expect(downloads).toEqual(['8O7yWgX6--4']);
    expect(await songsOnDisk()).toMatchObject([{ videoId: '8O7yWgX6--4', note: 'user-video', durationSec: 271 }]);
    expect(JSON.parse(await readFile(paths.songsFile!, 'utf8')).songs[0].hasMap).toBe(true);
    expect(await statusOnDisk()).toEqual({});
    expect(out.report.adds?.[0]).toMatchObject({ kind: 'added', videoId: '8O7yWgX6--4', tier: 'user-video' });
  });

  it('a mismatch adds nothing and records why with the video; "Use it anyway" then adds it, marked user-video-forced', async () => {
    const out = await runBeatmaps(paths, opts([{ ...REQ, videoId: '3Mq0VpLSnwc' }]), deps());
    expect(out.exitCode).toBe(0);
    expect(downloads).toEqual([]);
    expect(await songsOnDisk()).toEqual([]);
    const text = await readFile(paths.songsStatusFile!, 'utf8');
    expect(JSON.parse(text).requests[KEY]).toEqual({
      state: 'video-mismatch',
      artist: REQ.artist,
      title: REQ.title,
      durationSec: 271,
      videoId: '3Mq0VpLSnwc',
      message: 'This video is 5:14 but the song is 4:31.',
      attempts: 1,
      lastTried: NOW.toISOString(),
    });
    expect(renderSummary(out.report)).toContain('Chosen video doesn’t match');
    expect(renderAnnotations(out.report).join('\n')).toContain('::notice');
    // Not retried by itself, and a queued re-send of the same answer waits for the person.
    expect(requestRetryDue((await statusOnDisk())[KEY], new Date('2026-12-01'))).toBe(false);
    infos = [];
    await runBeatmaps(paths, opts([{ ...REQ, videoId: '3Mq0VpLSnwc', explicit: false }]), deps());
    expect(infos).toEqual([]);
    // "Use it anyway".
    const forced = await runBeatmaps(paths, opts([{ ...REQ, videoId: '3Mq0VpLSnwc', force: true }]), deps());
    expect(forced.report.adds?.[0]).toMatchObject({ kind: 'added', tier: 'user-video-forced' });
    expect(await songsOnDisk()).toMatchObject([{ videoId: '3Mq0VpLSnwc', note: 'user-video-forced' }]);
    expect(existsSync(join(paths.beatmapsDir, '3Mq0VpLSnwc.json'))).toBe(true);
    expect(await statusOnDisk()).toEqual({});
  });

  it('refused even with force: not embeddable, removed, private, a video another song uses; the status says why', async () => {
    const cases: [AddRequest, World, RegExp][] = [
      [{ ...REQ, videoId: '8O7yWgX6--4', force: true }, { embed: { '8O7yWgX6--4': 'disabled' } }, /doesn’t allow it to play on other sites/],
      [{ ...REQ, videoId: '8O7yWgX6--4', force: true }, { embed: { '8O7yWgX6--4': 'gone' } }, /private, removed or not available/],
      [{ ...REQ, videoId: '8O7yWgX6--4', force: true }, { info: { '8O7yWgX6--4': 'private' } }, /^YouTube says: Private video\. This video can't be used\.$/],
      [{ ...REQ, videoId: '8O7yWgX6--4', force: true }, { info: { '8O7yWgX6--4': { ...ART_TRACK, live_status: 'is_upcoming' } } }, /live stream or a premiere/],
    ];
    for (const [r, w, msg] of cases) {
      downloads = [];
      await rm(paths.songsStatusFile!, { force: true });
      await runBeatmaps(paths, opts([r]), deps(w));
      expect(downloads).toEqual([]);
      const st = (await statusOnDisk())[KEY];
      expect(st).toMatchObject({ state: 'not-found', videoId: '8O7yWgX6--4', force: true });
      expect(st.message).toMatch(msg);
    }
    await writeFile(paths.songsFile!, JSON.stringify({ songs: [{ videoId: '8O7yWgX6--4', title: 'Other', artist: 'Someone', addedAt: NOW.toISOString(), durationSec: 271 }] }));
    await runBeatmaps(paths, opts([{ ...REQ, videoId: '8O7yWgX6--4' }]), deps());
    expect((await statusOnDisk())[KEY]).toMatchObject({ state: 'not-found', message: 'This video is already in the song list as Someone - Other.' });
  });

  it('YouTube refuses the lookup: blocked, retried later automatically with the same video and force flag', async () => {
    const out = await runBeatmaps(paths, opts([{ ...REQ, videoId: '3Mq0VpLSnwc', force: true }], { stopAfter: 1 }), deps({ info: { '3Mq0VpLSnwc': 'blocked' } }));
    expect(out.report.adds?.[0].kind).toBe('blocked');
    expect((await statusOnDisk())[KEY]).toMatchObject({ state: 'blocked', videoId: '3Mq0VpLSnwc', force: true });
    expect(renderSongsStatus(undefined, { k: { ...(await statusOnDisk())[KEY] } }, NOW.toISOString())).toContain('"force": true');
    // Two hours later nobody asks again: the retry uses the chosen video (forced), never a search.
    infos = [];
    const later = await runBeatmaps(paths, opts([]), { ...deps(), now: () => new Date('2026-11-10T14:30:00Z') });
    expect(infos).toEqual(['3Mq0VpLSnwc']);
    expect(searches).toEqual([]);
    expect(later.report.adds?.[0]).toMatchObject({ kind: 'added', videoId: '3Mq0VpLSnwc', tier: 'user-video-forced' });
  });

  it('YouTube withholds the audio: listed with a pending map, as a found song; later runs keep the video (no other uploads)', async () => {
    const out = await runBeatmaps(paths, opts([{ ...REQ, videoId: '8O7yWgX6--4' }]), deps({ download: { '8O7yWgX6--4': 'withheld' } }));
    expect(out.exitCode).toBe(0);
    expect(out.report.adds?.[0]).toMatchObject({ kind: 'listed', videoId: '8O7yWgX6--4', cause: 'withheld' });
    expect(await songsOnDisk()).toMatchObject([{ videoId: '8O7yWgX6--4', note: 'user-video', hasMap: false }]);
    expect((await statusOnDisk())[KEY]).toMatchObject({ state: 'map-pending', videoId: '8O7yWgX6--4' });
    downloads = [];
    await runBeatmaps(paths, opts([]), { ...deps({ download: { '8O7yWgX6--4': 'withheld' } }), now: () => new Date('2026-11-10T14:00:00Z') });
    expect(downloads).toEqual(['8O7yWgX6--4']);
    expect(searches).toEqual([]);
    expect(await songsOnDisk()).toMatchObject([{ videoId: '8O7yWgX6--4' }]);
  });

  it('dry run: checks the video, downloads and writes nothing', async () => {
    const out = await runBeatmaps(paths, opts([{ ...REQ, videoId: '3Mq0VpLSnwc' }], { dryRun: true }), deps());
    expect(out.report.adds?.[0]).toMatchObject({ kind: 'mismatch', videoSeconds: 314 });
    expect(downloads).toEqual([]);
    expect(existsSync(paths.songsStatusFile!)).toBe(false);
  });
});

describe('requests carrying a chosen video', () => {
  it('add_queue keeps video and force; a bad video drops the item (never a silent search)', () => {
    expect(
      parseQueue(JSON.stringify([
        { artist: 'A', title: 'T', duration: 200, video: '8O7yWgX6--4', force: true },
        { artist: 'B', title: 'U', duration: 200, video: 'not-an-id' },
        { artist: 'C', title: 'V', duration: 200, force: true },
        { artist: 'D', title: 'W', duration: 200, video: '3Mq0VpLSnwc', force: 'yes' },
      ])),
    ).toEqual([
      { artist: 'A', title: 'T', durationSec: 200, videoId: '8O7yWgX6--4', force: true },
      { artist: 'C', title: 'V', durationSec: 200 },
      { artist: 'D', title: 'W', durationSec: 200, videoId: '3Mq0VpLSnwc' },
    ]);
  });
  it('CLI / workflow arguments', () => {
    const a = parseArgs(['--add-artist', 'A', '--add-title', 'T', '--add-duration', '200', '--add-video', '8O7yWgX6--4', '--add-video-force']);
    expect(a.adds).toEqual([{ artist: 'A', title: 'T', durationSec: 200, explicit: true, videoId: '8O7yWgX6--4', force: true }]);
    expect(parseArgs(['--add-artist', 'A', '--add-title', 'T', '--add-video', '']).adds[0]).not.toHaveProperty('videoId');
    expect(() => parseArgs(['--add-artist', 'A', '--add-title', 'T', '--add-video', 'x; rm -rf /'])).toThrow(/11-character/);
    expect(() => parseArgs(['--add-artist', 'A', '--add-title', 'T', '--add-video-force'])).toThrow();
    expect(() => parseArgs(['--add-video', '8O7yWgX6--4'])).toThrow(/single --add/);
  });
  it('planning: explicit wins; a queued video the status hasn’t answered is handled; a retry keeps the video', () => {
    const st = (state: string, o: Record<string, unknown> = {}) => ({ state, artist: 'A', title: 'T', durationSec: 200, attempts: 1, lastTried: '2026-11-10T08:00:00Z', ...o }) as never;
    const q = (o: Partial<AddRequest>): AddRequest => ({ artist: 'A', title: 'T', durationSec: 200, explicit: false, ...o });
    const plan = (reqs: AddRequest[], status: Record<string, never>) => planAdds(reqs, [], status, NOW);
    expect(plan([q({ videoId: '8O7yWgX6--4' }), q({ explicit: true })], {}).todo[0].req).not.toHaveProperty('videoId');
    expect(plan([q({}), q({ explicit: true, videoId: '8O7yWgX6--4', force: true })], {}).todo[0].req).toMatchObject({ videoId: '8O7yWgX6--4', force: true });
    expect(plan([q({ videoId: '3Mq0VpLSnwc' })], { 'a - t': st('not-found') }).todo).toHaveLength(1);
    expect(plan([q({ videoId: '3Mq0VpLSnwc' })], { 'a - t': st('not-found', { videoId: '3Mq0VpLSnwc' }) }).skipped[0].why).toBe('not found before');
    expect(plan([q({ videoId: '3Mq0VpLSnwc' })], { 'a - t': st('video-mismatch', { videoId: '3Mq0VpLSnwc' }) }).skipped[0].why).toBe('waiting for the person');
    expect(plan([q({ videoId: '3Mq0VpLSnwc', force: true })], { 'a - t': st('video-mismatch', { videoId: '3Mq0VpLSnwc' }) }).todo[0].req).toMatchObject({ force: true });
    expect(plan([], { 'a - t': st('error', { videoId: '3Mq0VpLSnwc', force: true }) }).todo[0].req).toMatchObject({ videoId: '3Mq0VpLSnwc', force: true });
    expect(plan([], { 'a - t': st('error') }).todo[0].req).not.toHaveProperty('videoId');
    expect(plan([], { 'a - t': st('video-mismatch', { videoId: '3Mq0VpLSnwc' }) }).todo).toEqual([]);
  });
});
