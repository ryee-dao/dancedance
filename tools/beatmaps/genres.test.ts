/// <reference types="node" />
/** Storage of the multi-source `genres`: songs.json, index.json, genres.json, and the pipeline's add / retry path. */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { synthClickTrack } from '../../src/core/analysis/synth.testutil';
import { parseIndexSongs } from '../../src/beat/bpmIndex';
import { cleanGenreList, parseSongsList, type AddedSong } from '../../src/beat/cloud';
import { DEFAULT_SOURCES, type GenreLookup, type SongQuery, type SourceOutcome } from '../../src/genre';
import { catalogSongs, dueSongs, parseGenresFile, putRecord, renderGenresFile, type GenreRecord } from './genres';
import { renderIndex } from './output';
import { runBeatmaps, type Deps, type Paths, type RunOptions } from './pipeline';
import { renderSongs } from './songs';

const NOW = new Date('2026-11-14T12:00:00Z');
const AT = NOW.toISOString();

/** Every source answered 'none' (at the current source version) unless given. */
const allNone = (): Record<string, SourceOutcome> =>
  Object.fromEntries(DEFAULT_SOURCES.map((s) => [s.id, { status: 'none', at: AT, reason: 'nothing', ...(s.version ? { v: s.version } : {}) } as SourceOutcome]));
const v = (id: string) => DEFAULT_SOURCES.find((s) => s.id === id)?.version;

const lookup = (genres: string[], complete = true): GenreLookup => ({
  genres,
  sources: {
    ...allNone(),
    wikipedia: genres.length ? { status: 'found', at: AT, genres, ref: 'Page', v: v('wikipedia') } : { status: 'none', at: AT, reason: 'no article about this song', v: v('wikipedia') },
    wikidata: { status: 'none', at: AT, reason: 'no item with this title', v: v('wikidata') },
    musicbrainz: { status: 'none', at: AT, reason: 'no recording of this song by this artist', v: v('musicbrainz') },
    theaudiodb: { status: 'none', at: AT, reason: 'no track by this artist with this title' },
    itunes: complete ? { status: 'found', at: AT, genres: ['Pop'] } : { status: 'failed', at: AT, reason: 'HTTP 429' },
  },
  complete,
  at: AT,
});

const song = (o: Partial<AddedSong> = {}): AddedSong => ({ videoId: 'lyricvid001', title: 'Levitating', artist: 'Dua Lipa', addedAt: AT, durationSec: 203, hasMap: true, ...o });

describe('songs.json with and without genres', () => {
  it('genres go after genre; no genres means no field; the round trip is exact', () => {
    const without = renderSongs(undefined, [song({ genre: 'Pop' })], AT);
    expect(without).not.toContain('genres');
    expect(parseSongsList(without)[0]).toEqual({ ...song({ genre: 'Pop' }), hasMap: undefined });
    const withG = renderSongs(undefined, [song({ genre: 'Pop', genres: ['disco', 'nu-disco', 'dance-pop'] })], AT);
    expect(Object.keys(JSON.parse(withG).songs[0])).toEqual(['videoId', 'title', 'artist', 'addedAt', 'durationSec', 'hasMap', 'genre', 'genres']);
    expect(parseSongsList(withG)[0].genres).toEqual(['disco', 'nu-disco', 'dance-pop']);
    expect(renderSongs(withG, parseSongsList(withG), '2030-01-01T00:00:00Z')).toBe(withG); // stable
    expect(renderSongs(undefined, [song({ genres: [] })], AT)).toBe(renderSongs(undefined, [song()], AT));
  });

  it('levels and artist genres are stored next to genres; older files (without them) stay valid', () => {
    const s = song({ genre: 'Alternative', genres: ['alternative', 'indie rock'], genreLevels: ['song', 'album'], artistGenres: ['R&B', 'neo soul'] });
    const text = renderSongs(undefined, [s], AT);
    expect(Object.keys(JSON.parse(text).songs[0]).slice(-3)).toEqual(['genres', 'genreLevels', 'artistGenres']);
    expect(parseSongsList(text)[0]).toMatchObject({ genres: ['alternative', 'indie rock'], genreLevels: ['song', 'album'], artistGenres: ['R&B', 'neo soul'] });
    // Levels that do not match the list are dropped; artist genres alone are fine.
    const odd = JSON.stringify({ songs: [{ ...song(), genres: ['pop'], genreLevels: ['song', 'album'], artistGenres: ['pop'] }] });
    expect(parseSongsList(odd)[0].genreLevels).toBeUndefined();
    const onlyArtist = renderSongs(undefined, [song({ artistGenres: ['techno'] })], AT);
    expect(parseSongsList(onlyArtist)[0]).toMatchObject({ artistGenres: ['techno'] });
    expect(parseSongsList(onlyArtist)[0].genres).toBeUndefined();
  });

  it('bad stored lists are cleaned', () => {
    expect(cleanGenreList([' pop ', 3, 'pop', '', 'x'.repeat(61), 'rock'])).toEqual(['pop', 'rock']);
    expect(cleanGenreList('pop')).toBeUndefined();
    expect(cleanGenreList([])).toBeUndefined();
    const text = JSON.stringify({ songs: [{ ...song(), genres: 'pop' }] });
    expect('genres' in parseSongsList(text)[0]).toBe(false);
  });
});

describe('index.json with and without genres', () => {
  const maps = new Map([
    ['aaaaaaaaaaa', { analyzerVersion: 'v', bpm: 120, duration: 200 }],
    ['bbbbbbbbbbb', { analyzerVersion: 'v', bpm: 90, duration: 180 }],
  ]);
  it('writes genres only for songs that have them, and the page reads them back', () => {
    const plain = renderIndex(undefined, 'v', maps, AT, new Map([['aaaaaaaaaaa', 'Pop']]));
    expect(plain).not.toContain('genres');
    const text = renderIndex(undefined, 'v', maps, AT, new Map([['aaaaaaaaaaa', 'Pop']]), new Map([['aaaaaaaaaaa', ['nu-disco', 'dance-pop']]]));
    const parsed = parseIndexSongs(text);
    expect(parsed.aaaaaaaaaaa).toEqual({ bpm: 120, duration: 200, genre: 'Pop', genres: ['nu-disco', 'dance-pop'] });
    expect(parsed.bbbbbbbbbbb).toEqual({ bpm: 90, duration: 180 });
    expect(parseIndexSongs(plain).aaaaaaaaaaa.genres).toBeUndefined();
  });

  it('levels and artist genres reach the page through the index', () => {
    const text = renderIndex(
      undefined,
      'v',
      maps,
      AT,
      undefined,
      new Map([['aaaaaaaaaaa', ['cumbia', 'Latin pop']]]),
      new Map([
        ['aaaaaaaaaaa', { genreLevels: ['album', 'song'], artistGenres: ['cumbia'] }],
        ['bbbbbbbbbbb', { artistGenres: ['techno'] }],
      ]),
    );
    const parsed = parseIndexSongs(text);
    expect(parsed.aaaaaaaaaaa).toEqual({ bpm: 120, duration: 200, genres: ['cumbia', 'Latin pop'], genreLevels: ['album', 'song'], artistGenres: ['cumbia'] });
    expect(parsed.bbbbbbbbbbb).toEqual({ bpm: 90, duration: 180, artistGenres: ['techno'] });
  });
});

describe('genres.json', () => {
  it('round trip, sorted keys, stable timestamp', () => {
    const records: Record<string, GenreRecord> = {};
    putRecord(records, { key: 'dua lipa - levitating', artist: 'Dua Lipa', title: 'Levitating', videoId: 'lyricvid001' }, lookup(['disco']));
    putRecord(records, { key: 'abba - dancing queen', artist: 'ABBA', title: 'Dancing Queen', videoId: 'abbavideo01' }, lookup([], false));
    const text = renderGenresFile(undefined, records, AT);
    expect(Object.keys(JSON.parse(text).songs)).toEqual(['abba - dancing queen', 'dua lipa - levitating']);
    const back = parseGenresFile(text);
    expect(back).toEqual(records);
    expect(renderGenresFile(text, back, '2030-01-01T00:00:00Z')).toBe(text);
  });

  it('catalog = songs.json + starter songs; due = missing, failed or expired', () => {
    const catalog = catalogSongs([song({ genre: 'Pop' })], [{ videoId: 'starter0001', artist: 'ABBA', title: 'Dancing Queen' }], new Map([['starter0001', 'Pop']]));
    expect(catalog).toEqual([
      { videoId: 'lyricvid001', key: 'dua lipa - levitating', artist: 'Dua Lipa', title: 'Levitating', durationSec: 203, itunesGenre: 'Pop', added: true },
      { videoId: 'starter0001', key: 'abba - dancing queen', artist: 'ABBA', title: 'Dancing Queen', itunesGenre: 'Pop', added: false },
    ]);
    const records: Record<string, GenreRecord> = {};
    expect(dueSongs(catalog, records, NOW).map((c) => c.videoId)).toEqual(['lyricvid001', 'starter0001']);
    const full = (genres: string[]): GenreLookup => ({
      genres,
      sources: Object.fromEntries(DEFAULT_SOURCES.map((s) => [s.id, { status: 'found', at: AT, genres, ...(s.version ? { v: s.version } : {}) } as SourceOutcome])),
      complete: true,
      at: AT,
    });
    putRecord(records, catalog[0], full(['disco']));
    putRecord(records, catalog[1], { ...full(['disco']), sources: { ...full(['disco']).sources, musicbrainz: { status: 'failed', at: AT, reason: 'HTTP 503' } }, complete: false });
    expect(dueSongs(catalog, records, NOW).map((c) => c.videoId)).toEqual([]); // failed retried after 6 h by default
    expect(dueSongs(catalog, records, NOW, Infinity, 0).map((c) => c.videoId)).toEqual(['starter0001']); // the cloud job: next run
  });
});

// --- the pipeline -----------------------------------------------------------------

const SONG = synthClickTrack({ bpm: 120, duration: 30, accent: true, pattern: 'pop', seed: 3 });
let root: string;
let paths: Paths;
let asked: { song: SongQuery; previous: GenreLookup | null }[];

function deps(answer: (s: SongQuery, prev: GenreLookup | null) => GenreLookup | Promise<GenreLookup>): Deps {
  return {
    fetchPlaylist: async () => ({ id: 'PL', entries: [] }),
    downloadAudio: async (id, dir) => {
      const p = join(dir, `${id}.m4a`);
      await writeFile(p, 'x');
      return { kind: 'file', path: p };
    },
    decode: async () => SONG.pcm,
    makeTempDir: () => mkdtemp(join(root, 'audio-')),
    removeDir: (d) => rm(d, { recursive: true, force: true }),
    sleep: async () => {},
    random: () => 0.5,
    now: () => NOW,
    clock: () => 0,
    log: () => {},
    searchVideos: async () => ({ entries: [{ id: 'lyricvid001', title: 'Dua Lipa - Levitating (Lyrics)', channel: 'Lyrics Co', view_count: 9e6, duration: 204 }] }),
    checkEmbed: async () => 'ok',
    lookupOfficial: async () => ({ artist: 'Dua Lipa', title: 'Levitating', durationSec: 203, genre: 'Pop' }),
    lookupGenres: async (s, previous) => {
      asked.push({ song: s, previous });
      return answer(s, previous);
    },
  };
}

const opts = (o: Partial<RunOptions> = {}): RunOptions => ({ limit: 25, force: false, dryRun: false, usedCookies: false, ...o });
const LEVITATING = { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203, explicit: true };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dancedance-genres-'));
  paths = {
    beatmapsDir: join(root, 'beatmaps'),
    playlistFile: join(root, 'playlist.json'),
    starterFile: join(root, 'starter.json'),
    songsFile: join(root, 'songs.json'),
    songsStatusFile: join(root, 'songs-status.json'),
    genresFile: join(root, 'genres.json'),
  };
  await mkdir(paths.beatmapsDir);
  await writeFile(paths.starterFile, JSON.stringify([{ videoId: 'starter0001', title: 'Dancing Queen', artist: 'ABBA' }]));
  asked = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('pipeline', () => {
  it('looks genres up when it adds a song (only artist, title, length and the stored iTunes genre go in) and stores them everywhere', async () => {
    const out = await runBeatmaps(
      paths,
      opts({ adds: [LEVITATING] }),
      deps((s) => (s.artist === 'ABBA' ? lookup(['Euro disco']) : { ...lookup(['disco', 'nu-disco']), genreLevels: ['song', 'album'], artistGenres: ['dance-pop'] })),
    );
    expect(out.exitCode).toBe(0);
    expect(asked[0].song).toEqual({ videoId: 'lyricvid001', key: 'dua lipa - levitating', artist: 'Dua Lipa', title: 'Levitating', durationSec: 203, itunesGenre: 'Pop', added: true });
    const songs = parseSongsList(await readFile(paths.songsFile!, 'utf8'));
    expect(songs[0]).toMatchObject({ videoId: 'lyricvid001', genre: 'Pop', genres: ['disco', 'nu-disco'], genreLevels: ['song', 'album'], artistGenres: ['dance-pop'] });
    const index = parseIndexSongs(await readFile(join(paths.beatmapsDir, 'index.json'), 'utf8'));
    expect(index.lyricvid001.genres).toEqual(['disco', 'nu-disco']);
    expect(index.lyricvid001.artistGenres).toEqual(['dance-pop']);
    const records = parseGenresFile(await readFile(paths.genresFile!, 'utf8'));
    expect(records['dua lipa - levitating'].sources.wikipedia).toMatchObject({ status: 'found', ref: 'Page' });
    // The starter song (no map yet in this run's add mode) is looked up too, as a due catalog song.
    expect(records['abba - dancing queen'].genres).toEqual(['Euro disco']);
  });

  it('a lookup that failed is kept as such and retried on the next run, with the stored answers as its cache', async () => {
    await runBeatmaps(paths, opts({ adds: [LEVITATING] }), deps(() => lookup([], false)));
    const text = await readFile(paths.songsFile!, 'utf8');
    expect(text).not.toContain('"genres"');
    expect(parseGenresFile(await readFile(paths.genresFile!, 'utf8'))['dua lipa - levitating'].complete).toBe(false);
    asked = [];
    await runBeatmaps(paths, opts(), deps((_s, prev) => ({ ...lookup(['disco']), sources: { ...prev!.sources, ...lookup(['disco']).sources } })));
    expect(asked.map((a) => a.song.title).sort()).toEqual(['Dancing Queen', 'Levitating']);
    expect(asked.find((a) => a.song.title === 'Levitating')!.previous?.complete).toBe(false);
    expect(parseSongsList(await readFile(paths.songsFile!, 'utf8'))[0].genres).toEqual(['disco']);
    // Done: a third run asks nothing.
    asked = [];
    await runBeatmaps(paths, opts(), deps(() => lookup(['x'])));
    expect(asked).toEqual([]);
  });

  it('never fails the run when the lookup throws, and does nothing without a genres file', async () => {
    const out = await runBeatmaps(paths, opts({ adds: [LEVITATING] }), deps(() => Promise.reject(new Error('offline'))));
    expect(out.exitCode).toBe(0);
    expect(parseSongsList(await readFile(paths.songsFile!, 'utf8'))[0].videoId).toBe('lyricvid001');
    const p2 = { ...paths, genresFile: undefined };
    await rm(paths.genresFile!, { force: true });
    asked = [];
    await runBeatmaps(p2, opts(), deps(() => lookup(['x'])));
    expect(asked).toEqual([]);
    expect(existsSync(paths.genresFile!)).toBe(false);
  });
});
