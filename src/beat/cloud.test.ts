import { describe, expect, it } from 'vitest';
import { parseIndexSongs } from './bpmIndex';
import { absoluteBase, beatmapUrl, describeCloudStatus, fetchCloudMap, parseSongsList, parseStatus, statusUrl, type FetchLike } from './cloud';
import { mkMap } from './testMaps.testutil';

const page = 'https://host.example/app/index.html';

function fakeFetch(routes: Record<string, { status: number; body: string }>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const r = routes[url] ?? { status: 404, body: 'not found' };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body };
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

describe('cloud beat maps', () => {
  it('builds URLs from a relative or absolute base', () => {
    expect(absoluteBase('./', page)).toBe('https://host.example/app/');
    expect(beatmapUrl('./', 'abc', page)).toBe('https://host.example/app/beatmaps/abc.json');
    expect(beatmapUrl('https://me.github.io/dancedance', 'a-b_c', page)).toBe('https://me.github.io/dancedance/beatmaps/a-b_c.json');
    expect(statusUrl('https://me.github.io/dancedance/', page)).toBe('https://me.github.io/dancedance/beatmaps/status.json');
  });
  it('returns the map, or null for 404 / HTML fallback / another video', async () => {
    const base = 'https://x.test/';
    const f = fakeFetch({
      'https://x.test/beatmaps/ok.json': { status: 200, body: JSON.stringify(mkMap({ videoId: 'ok', source: 'cloud' })) },
      'https://x.test/beatmaps/html.json': { status: 200, body: '<!doctype html><html></html>' },
      'https://x.test/beatmaps/other.json': { status: 200, body: JSON.stringify(mkMap({ videoId: 'zzz' })) },
    });
    expect((await fetchCloudMap(base, 'ok', f))?.source).toBe('cloud');
    expect(await fetchCloudMap(base, 'missing', f)).toBeNull();
    expect(await fetchCloudMap(base, 'html', f)).toBeNull();
    expect(await fetchCloudMap(base, 'other', f)).toBeNull();
    const throwing: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await fetchCloudMap(base, 'ok', throwing)).toBeNull();
  });
  it('parses status.json tolerantly and phrases blocked songs', () => {
    const s = parseStatus(JSON.stringify({ videos: { a: { state: 'blocked', message: 'bot check' }, b: { state: 'ok' }, c: { state: 'nope' }, d: 5 } }));
    expect(s).toEqual({ a: { state: 'blocked', message: 'bot check' }, b: { state: 'ok' } });
    expect(parseStatus('not json')).toEqual({});
    expect(parseStatus('{"videos":[]}')).toEqual({});
    expect(describeCloudStatus(s.a)).toMatch(/blocked by YouTube/);
    expect(describeCloudStatus(s.b)).toBeNull();
    expect(describeCloudStatus({ state: 'error' })).toMatch(/failed/);
  });
  it('reads BPMs from index.json songs, tolerating its absence', () => {
    expect(parseIndexSongs(JSON.stringify({ ids: ['a'] }))).toEqual({});
    expect(parseIndexSongs('garbage')).toEqual({});
    expect(
      parseIndexSongs(JSON.stringify({ ids: ['a', 'b'], songs: { a: { bpm: 123.6, duration: 200 }, b: { bpm: 0 }, c: { duration: 3 } } })),
    ).toEqual({ a: { bpm: 123.6, duration: 200 } });
  });
  it('reads optional genres from index.json songs and songs.json', () => {
    expect(
      parseIndexSongs(JSON.stringify({ songs: { a: { bpm: 100, duration: 200, genre: ' Latin ' }, b: { bpm: 90, duration: 1, genre: 7 }, c: { bpm: 90, duration: 1, genre: '' } } })),
    ).toEqual({ a: { bpm: 100, duration: 200, genre: 'Latin' }, b: { bpm: 90, duration: 1 }, c: { bpm: 90, duration: 1 } });
    const songs = parseSongsList(
      JSON.stringify({
        songs: [
          { videoId: 'aaaaaaaaaaa', title: 'T', artist: 'A', addedAt: 'x', durationSec: 200, genre: 'Hip-Hop/Rap' },
          { videoId: 'bbbbbbbbbbb', title: 'T2', artist: 'A', addedAt: 'x', durationSec: 200, genre: 42 },
        ],
      }),
    );
    expect(songs[0].genre).toBe('Hip-Hop/Rap');
    expect('genre' in songs[1]).toBe(false);
  });
});
