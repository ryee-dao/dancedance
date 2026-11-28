import { describe, expect, it } from 'vitest';
import {
  applyPipelineRules,
  checkTree,
  MergeError,
  mergeAggregate,
  mergeKeyed,
  mergeMapFile,
  pick3,
  planLanding,
  syncIndexWithMaps,
  toJsonText,
  type Git,
} from './mergeData';

const T0 = '2026-11-24T05:49:14.243Z';
const T1 = '2026-11-27T01:23:47.680Z';
const T2 = '2026-11-27T01:25:50.000Z';

const song = (videoId: string, artist: string, title: string, addedAt: string, hasMap = true) => ({ videoId, title, artist, addedAt, durationSec: 200, hasMap });
const req = (artist: string, title: string, state = 'not-found', extra: Record<string, unknown> = {}) => ({ state, artist, title, ...extra, attempts: 1, lastTried: T1 });
const mapText = (videoId: string, bpm = 120, duration = 200.4) => `${JSON.stringify({ v: 1, analyzerVersion: '1.4.0', videoId, duration, bpm, beats: [0.5, 1] })}\n`;
const parse = (t: string | undefined) => JSON.parse(t ?? 'null');

describe('pick3', () => {
  it('takes the side that changed a value, ours when both did', () => {
    expect(pick3(1, 1, 2)).toBe(2);
    expect(pick3(1, 3, 1)).toBe(3);
    expect(pick3(1, 3, 2)).toBe(3);
    expect(pick3(undefined, undefined, 2)).toBe(2);
  });
  it('keeps a value one side removed and the other changed', () => {
    expect(pick3(1, undefined, 2)).toBe(2);
    expect(pick3(1, 3, undefined)).toBe(3);
  });
  it('removes a value only one side removed', () => {
    expect(pick3(1, undefined, 1)).toBeUndefined();
    expect(pick3(1, 1, undefined)).toBeUndefined();
  });
  it('compares objects by content, not key order', () => {
    expect(pick3({ a: 1, b: 2 }, { b: 2, a: 1 }, { a: 5, b: 2 })).toEqual({ a: 5, b: 2 });
  });
});

describe('mergeKeyed', () => {
  it('unions both sides and sorts keys', () => {
    expect(Object.keys(mergeKeyed({ m: 1 }, { m: 1, z: 2 }, { m: 1, a: 3 }))).toEqual(['a', 'm', 'z']);
  });
});

describe('mergeAggregate: the incident (both runs wrote songs-status.json)', () => {
  const base = toJsonText({ updatedAt: T0, requests: { 'x - old': req('X', 'Old') } });
  const entry808 = req('Bassnectar', 'The 808 Track (feat. Mighty High Coup)', 'not-found', { durationSec: 271, message: 'no match' });
  const theirs = toJsonText({ updatedAt: T1, requests: { 'bassnectar - the 808 track feat mighty high coup': entry808, 'x - old': req('X', 'Old') } });

  it('identical entries on both sides merge to one, with the later timestamp', () => {
    const ours = toJsonText({ updatedAt: T2, requests: { 'bassnectar - the 808 track feat mighty high coup': entry808, 'x - old': req('X', 'Old'), 'y - new': req('Y', 'New') } });
    const out = parse(mergeAggregate('public/songs-status.json', { base, ours, theirs }));
    expect(out.updatedAt).toBe(T2);
    expect(Object.keys(out.requests)).toEqual(['bassnectar - the 808 track feat mighty high coup', 'x - old', 'y - new']);
  });

  it('keeps the tip byte for byte when this run adds nothing new', () => {
    const ours = toJsonText({ updatedAt: T2, requests: { 'bassnectar - the 808 track feat mighty high coup': entry808, 'x - old': req('X', 'Old') } });
    expect(mergeAggregate('public/songs-status.json', { base, ours, theirs })).toBe(theirs);
  });

  it('takes the later timestamp even when the tip is newer', () => {
    const ours = toJsonText({ updatedAt: '2026-11-26T00:00:00.000Z', requests: { 'x - old': req('X', 'Old'), 'y - new': req('Y', 'New') } });
    expect(parse(mergeAggregate('public/songs-status.json', { base, ours, theirs })).updatedAt).toBe(T1);
  });

  it('an entry removed by one side and untouched by the other goes', () => {
    const ours = toJsonText({ updatedAt: T2, requests: {} });
    expect(Object.keys(parse(mergeAggregate('public/songs-status.json', { base, ours, theirs })).requests)).toEqual(['bassnectar - the 808 track feat mighty high coup']);
  });
});

describe('mergeAggregate: songs.json', () => {
  const a = song('aaaaaaaaaaa', 'A', 'Song A', '2026-11-01T00:00:00.000Z');
  const base = toJsonText({ updatedAt: T0, songs: [a] });

  it('never drops a song the other run added; keeps addedAt order', () => {
    const b = song('bbbbbbbbbbb', 'B', 'Song B', T2);
    const c = song('ccccccccccc', 'C', 'Song C', T1);
    const ours = toJsonText({ updatedAt: T2, songs: [a, b] });
    const theirs = toJsonText({ updatedAt: T1, songs: [a, c] });
    const out = parse(mergeAggregate('public/songs.json', { base, ours, theirs }));
    expect(out.songs.map((s: { videoId: string }) => s.videoId)).toEqual(['aaaaaaaaaaa', 'ccccccccccc', 'bbbbbbbbbbb']);
    expect(out.updatedAt).toBe(T2);
    expect(Object.keys(out)).toEqual(['updatedAt', 'songs']);
  });

  it('the same song added by both (same key) is listed once, as this run has it', () => {
    const ours = toJsonText({ updatedAt: T2, songs: [a, song('bbbbbbbbbbb', 'B', 'Song B', T2)] });
    const theirs = toJsonText({ updatedAt: T1, songs: [a, song('ddddddddddd', 'b', 'song b', T1)] });
    const out = parse(mergeAggregate('public/songs.json', { base, ours, theirs }));
    expect(out.songs.map((s: { videoId: string }) => s.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('refuses two entries with the same key on one side', () => {
    const ours = toJsonText({ updatedAt: T2, songs: [a, { ...a, videoId: 'eeeeeeeeeee' }] });
    const theirs = toJsonText({ updatedAt: T1, songs: [a, song('ccccccccccc', 'C', 'Song C', T1)] });
    expect(() => mergeAggregate('public/songs.json', { base, ours, theirs })).toThrow(MergeError);
  });
});

describe('mergeAggregate: index.json', () => {
  const e = (bpm: number) => ({ bpm, duration: 200 });
  const base = toJsonText({ analyzerVersion: '1.4.0', generatedAt: T0, ids: ['aaaaaaaaaaa'], songs: { aaaaaaaaaaa: e(100) } });
  it('unions songs and rebuilds ids from them', () => {
    const ours = toJsonText({ analyzerVersion: '1.4.0', generatedAt: T2, ids: ['aaaaaaaaaaa', 'zzzzzzzzzzz'], songs: { aaaaaaaaaaa: e(100), zzzzzzzzzzz: e(90) } });
    const theirs = toJsonText({ analyzerVersion: '1.4.0', generatedAt: T1, ids: ['-bbbbbbbbbb', 'aaaaaaaaaaa'], songs: { '-bbbbbbbbbb': e(80), aaaaaaaaaaa: e(100) } });
    const out = parse(mergeAggregate('public/beatmaps/index.json', { base, ours, theirs }));
    expect(out.ids).toEqual(['-bbbbbbbbbb', 'aaaaaaaaaaa', 'zzzzzzzzzzz']);
    expect(Object.keys(out.songs)).toEqual(out.ids);
    expect(Object.keys(out)).toEqual(['analyzerVersion', 'generatedAt', 'ids', 'songs']);
    expect(out.generatedAt).toBe(T2);
  });
  it('keeps an entry the other side changed (e.g. genres) when this run did not touch it', () => {
    const ours = toJsonText({ analyzerVersion: '1.4.0', generatedAt: T2, ids: ['aaaaaaaaaaa', 'zzzzzzzzzzz'], songs: { aaaaaaaaaaa: e(100), zzzzzzzzzzz: e(90) } });
    const theirs = toJsonText({ analyzerVersion: '1.4.0', generatedAt: T1, ids: ['aaaaaaaaaaa'], songs: { aaaaaaaaaaa: { ...e(100), genre: 'Pop' } } });
    expect(parse(mergeAggregate('public/beatmaps/index.json', { base, ours, theirs })).songs.aaaaaaaaaaa.genre).toBe('Pop');
  });
});

describe('mergeAggregate: refusals', () => {
  it('refuses invalid JSON', () => {
    expect(() => mergeAggregate('public/songs-status.json', { base: '{}', ours: '{"requests":{}}', theirs: '{"requests":' })).toThrow(/not valid JSON/);
  });
  it('refuses a deleted aggregate the other side changed', () => {
    expect(() => mergeAggregate('public/genres.json', { base: '{"songs":{}}', ours: undefined, theirs: '{"songs":{"a":1}}' })).toThrow(MergeError);
  });
  it('refuses a collection of the wrong shape', () => {
    expect(() => mergeAggregate('public/beatmaps/status.json', { base: '{"videos":{}}', ours: '{"videos":[]}', theirs: '{"videos":{"a":1}}' })).toThrow(/not an object/);
  });
  it('refuses a file it has no rule for', () => {
    expect(() => mergeAggregate('public/other.json', { base: '{}', ours: '{}', theirs: '{}' })).toThrow(MergeError);
  });
});

describe('mergeMapFile', () => {
  const p = 'public/beatmaps/aaaaaaaaaaa.json';
  it('takes the side that changed it, ours when both did', () => {
    expect(mergeMapFile(p, { base: undefined, ours: undefined, theirs: mapText('aaaaaaaaaaa') })).toBe(mapText('aaaaaaaaaaa'));
    expect(mergeMapFile(p, { base: undefined, ours: mapText('aaaaaaaaaaa', 1), theirs: mapText('aaaaaaaaaaa', 2) })).toBe(mapText('aaaaaaaaaaa', 1));
  });
  it('never drops a map one side changed and the other deleted', () => {
    expect(mergeMapFile(p, { base: mapText('aaaaaaaaaaa'), ours: undefined, theirs: mapText('aaaaaaaaaaa', 2) })).toBe(mapText('aaaaaaaaaaa', 2));
    expect(mergeMapFile(p, { base: mapText('aaaaaaaaaaa'), ours: mapText('aaaaaaaaaaa', 3), theirs: undefined })).toBe(mapText('aaaaaaaaaaa', 3));
  });
  it('refuses a file that is not a map of its video', () => {
    expect(() => mergeMapFile(p, { ours: mapText('bbbbbbbbbbb'), theirs: mapText('aaaaaaaaaaa') })).toThrow(MergeError);
  });
});

describe('applyPipelineRules', () => {
  const songs = toJsonText({ updatedAt: T0, songs: [song('aaaaaaaaaaa', 'A', 'Song A', T0, false), song('bbbbbbbbbbb', 'B', 'Song B', T0, true)] });
  const status = toJsonText({
    updatedAt: T0,
    requests: {
      'a - song a': req('A', 'Song A', 'map-pending', { videoId: 'aaaaaaaaaaa' }),
      'b - song b': req('B', 'Song B'),
      'c - song c': req('C', 'Song C'),
    },
  });
  it('hasMap follows the map files; pending notes and failed requests of listed songs go', () => {
    const out = applyPipelineRules({ songs, songsStatus: status }, (id) => id === 'aaaaaaaaaaa' || id === 'bbbbbbbbbbb', T2);
    expect(parse(out.songs).songs.map((s: { hasMap: boolean }) => s.hasMap)).toEqual([true, true]);
    expect(parse(out.songs).updatedAt).toBe(T2);
    expect(Object.keys(parse(out.songsStatus).requests)).toEqual(['c - song c']);
  });
  it('changes nothing when the files already agree', () => {
    const ok = toJsonText({ updatedAt: T0, requests: { 'a - song a': req('A', 'Song A', 'map-pending', { videoId: 'aaaaaaaaaaa' }) } });
    expect(applyPipelineRules({ songs, songsStatus: ok }, (id) => id === 'bbbbbbbbbbb', T2)).toEqual({});
  });
});

describe('checkTree', () => {
  const index = toJsonText({ analyzerVersion: '1.4.0', generatedAt: T0, ids: ['aaaaaaaaaaa'], songs: { aaaaaaaaaaa: { bpm: 1, duration: 1 } } });
  const files = (extra: Record<string, string>) => (p: string) => ({ 'public/beatmaps/index.json': index, ...extra })[p];
  it('passes when every listed id has a map and every new map is listed', () => {
    expect(() => checkTree(files({ 'public/beatmaps/aaaaaaaaaaa.json': mapText('aaaaaaaaaaa') }), ['public/beatmaps/aaaaaaaaaaa.json', 'public/beatmaps/index.json'])).not.toThrow();
  });
  it('fails on a listed id without a map file', () => {
    expect(() => checkTree(files({}), [])).toThrow(/no map file/);
  });
  it('fails on a new map file the index does not list', () => {
    expect(() => checkTree(files({ 'public/beatmaps/aaaaaaaaaaa.json': mapText('aaaaaaaaaaa'), 'public/beatmaps/bbbbbbbbbbb.json': mapText('bbbbbbbbbbb') }), ['public/beatmaps/bbbbbbbbbbb.json'])).toThrow(/does not list/);
  });
});

describe('syncIndexWithMaps', () => {
  it('index bpm/duration follow the winning map file', () => {
    const index = toJsonText({ analyzerVersion: '1.4.0', generatedAt: T0, ids: ['aaaaaaaaaaa'], songs: { aaaaaaaaaaa: { bpm: 99, duration: 1 } } });
    const out = parse(syncIndexWithMaps(index, new Map([['aaaaaaaaaaa', mapText('aaaaaaaaaaa', 120.04, 200.6)]]), T2));
    expect(out.songs.aaaaaaaaaaa).toEqual({ bpm: 120, duration: 201 });
    expect(out.generatedAt).toBe(T2);
  });
});

describe('planLanding', () => {
  const fakeGit = (trees: Record<string, Record<string, string>>): Git => ({
    show: (rev, p) => trees[rev][p],
    changed: (from, to) => [...new Set([...Object.keys(trees[from]), ...Object.keys(trees[to])])].filter((p) => trees[from][p] !== trees[to][p]).sort(),
  });
  const status = (requests: Record<string, unknown>, ts: string) => toJsonText({ updatedAt: ts, requests });

  it("writes this run's files over the tip, merging those both changed", () => {
    const git = fakeGit({
      base: { 'public/songs-status.json': status({}, T0) },
      ours: { 'public/songs-status.json': status({ 'y - y': req('Y', 'Y') }, T2), 'public/beatmaps/bbbbbbbbbbb.json': mapText('bbbbbbbbbbb') },
      theirs: { 'public/songs-status.json': status({ 'x - x': req('X', 'X') }, T1), 'public/favicon.svg': '<svg/>' },
    });
    const { writes } = planLanding(git, { base: 'base', ours: 'ours', theirs: 'theirs' });
    expect(writes.get('public/beatmaps/bbbbbbbbbbb.json')).toBe(mapText('bbbbbbbbbbb'));
    expect(Object.keys(parse(writes.get('public/songs-status.json')).requests)).toEqual(['x - x', 'y - y']);
    expect(writes.has('public/favicon.svg')).toBe(false);
  });

  it('refuses when this run changed something outside the allowed JSON', () => {
    const git = fakeGit({ base: {}, ours: { 'public/x.mp3': 'audio' }, theirs: {} });
    expect(() => planLanding(git, { base: 'base', ours: 'ours', theirs: 'theirs' })).toThrow(/other than beat-map JSON/);
  });
});

describe('requests with a chosen video (video-mismatch, videoId / force)', () => {
  const mismatch = req('Bassnectar', 'The 808 Track', 'video-mismatch', { durationSec: 271, videoId: '3Mq0VpLSnwc', message: 'This video is 5:14 but the song is 4:31.' });
  const blocked = req('X', 'Chosen', 'blocked', { videoId: '8O7yWgX6--4', force: true, message: 'YouTube didn\'t answer about this video' });
  it('pass through the entry-by-entry merge unchanged, from either side', () => {
    const base = toJsonText({ updatedAt: T0, requests: {} });
    const theirs = toJsonText({ updatedAt: T1, requests: { 'x - chosen': blocked } });
    const ours = toJsonText({ updatedAt: T2, requests: { 'bassnectar - the 808 track': mismatch } });
    const out = parse(mergeAggregate('public/songs-status.json', { base, ours, theirs }));
    expect(out.requests).toEqual({ 'bassnectar - the 808 track': mismatch, 'x - chosen': blocked });
  });
  it('stay after the pipeline rules (only a listed song removes a request), and go once the song is listed', () => {
    const status = toJsonText({ updatedAt: T1, requests: { 'bassnectar - the 808 track': mismatch } });
    expect(applyPipelineRules({ songsStatus: status, songs: toJsonText({ updatedAt: T1, songs: [] }) }, () => false, T2)).toEqual({});
    const listed = toJsonText({ updatedAt: T1, songs: [{ ...song('3Mq0VpLSnwc', 'Bassnectar', 'The 808 Track', T1), note: 'user-video-forced' }] });
    const out = applyPipelineRules({ songsStatus: status, songs: listed }, () => true, T2);
    expect(parse(out.songsStatus).requests).toEqual({});
  });
});
