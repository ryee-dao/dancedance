import { describe, expect, it } from 'vitest';
import { songKey } from '../beat/cloud';
import { AddedSongs, bust, pollDelayMs, reconcile } from './addedSongs';
import { itunesUrl, parseItunesResults, searchSongs, SongSearchError } from './songSearch';

const T = Date.parse('2026-11-10T12:00:00Z');
const pend = (artist: string, title: string, sentAt = T) => ({ key: songKey(artist, title), artist, title, durationSec: 200, sentAt });
const song = (videoId: string, artist: string, title: string) => ({ videoId, artist, title, addedAt: '', durationSec: 200 });

describe('reconcile', () => {
  it('pending songs appear when songs.json lists them (by artist + title, any case)', () => {
    const r = reconcile([pend('a-ha', 'Take On Me'), pend('ABBA', 'Waterloo')], [song('abcdefghijk', 'A-HA', 'take on me')], {}, T + 60_000);
    expect(r.appeared.map((a) => a.song.videoId)).toEqual(['abcdefghijk']);
    expect(r.views).toMatchObject([{ title: 'Waterloo', state: 'waiting', message: 'Being added… usually 3–5 minutes' }]);
  });
  it('shows cloud failures for this attempt, ignores older ones, and flags slow requests', () => {
    const k = songKey('ABBA', 'Waterloo');
    const st = (state: 'not-found' | 'blocked' | 'error', lastTried: string) => ({ [k]: { state, artist: 'ABBA', title: 'Waterloo', attempts: 1, lastTried, message: 'No video.' } });
    expect(reconcile([pend('ABBA', 'Waterloo')], [], st('not-found', '2026-11-10T12:03:00Z'), T).views[0]).toMatchObject({ state: 'failed', message: 'No video.' });
    expect(reconcile([pend('ABBA', 'Waterloo')], [], st('blocked', '2026-11-10T12:03:00Z'), T).views[0].state).toBe('retrying');
    expect(reconcile([pend('ABBA', 'Waterloo')], [], st('not-found', '2026-11-09T12:00:00Z'), T).views[0].state).toBe('waiting');
    expect(reconcile([pend('ABBA', 'Waterloo')], [], {}, T + 16 * 60_000).views[0].state).toBe('slow');
  });
  it('a song listed without a map appears at once (also under other names, via its map-pending note)', () => {
    const listed = { ...song('abcdefghijk', 'Spice Girls', 'Wannabe'), hasMap: false };
    expect(reconcile([pend('Spice Girls', 'Wannabe')], [listed], {}, T).appeared[0].song.hasMap).toBe(false);
    const note = { [songKey('spice girls', 'wannabe (remastered)')]: { state: 'map-pending' as const, artist: 'Spice Girls', title: 'Wannabe', videoId: 'abcdefghijk', attempts: 1, lastTried: '2026-11-10T12:03:00Z' } };
    const r = reconcile([pend('spice girls', 'wannabe (remastered)')], [listed], note, T);
    expect(r.appeared.map((a) => a.song.videoId)).toEqual(['abcdefghijk']);
    expect(r.views).toEqual([]);
  });
  it('polls politely and busts the CDN cache once per interval', () => {
    expect([0, 9 * 60_000, 11 * 60_000, 31 * 60_000].map(pollDelayMs)).toEqual([30_000, 30_000, 60_000, 300_000]);
    expect(bust('https://jo.github.io/dd/songs.json', 61_000, 30_000)).toBe('https://jo.github.io/dd/songs.json?t=2');
  });
});

describe('AddedSongs model', () => {
  it('loads songs.json, hides and un-hides locally', async () => {
    const urls: string[] = [];
    const m = new AddedSongs(async (url) => {
      urls.push(url);
      return { ok: true, text: async () => JSON.stringify({ songs: [song('abcdefghijk', 'A', 'One'), song('bbbbbbbbbbb', 'B', 'Two')] }) };
    });
    m.start('https://jo.github.io/dd/');
    await m.refresh();
    expect(urls[0]).toMatch(/^https:\/\/jo\.github\.io\/dd\/songs\.json\?t=\d+$/);
    expect(m.songs().map((s) => s.videoId)).toEqual(['bbbbbbbbbbb', 'abcdefghijk']); // newest first
    m.hide('bbbbbbbbbbb');
    expect(m.songs().map((s) => s.videoId)).toEqual(['abcdefghijk']);
    expect(m.hiddenCount()).toBe(1);
    expect(m.find('bbbbbbbbbbb')).toBeNull();
    m.unhideAll();
    expect(m.songs()).toHaveLength(2);
    // Web: remove() can only hide (songs live in the cloud list).
    expect(await m.remove('abcdefghijk')).toEqual({ removedLocal: false, hidden: true });
    expect(m.songs().map((s) => s.videoId)).toEqual(['bbbbbbbbbbb']);
    m.unhideAll();
  });
});

describe('iTunes song search', () => {
  const sample = {
    resultCount: 5,
    results: [
      { kind: 'song', trackId: 1, artistName: 'Taylor Swift', trackName: 'Shake It Off', collectionName: '1989', trackTimeMillis: 219209, releaseDate: '2014-08-19T07:00:00Z', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg' },
      { kind: 'song', trackId: 2, artistName: 'Taylor Swift', trackName: "Shake It Off (Taylor's Version)", collectionName: '1989 (TV)', trackTimeMillis: 219209 },
      { kind: 'song', trackId: 3, artistName: 'Taylor Swift', trackName: 'Shake It Off', collectionName: '1989 (Deluxe)', trackTimeMillis: 219200 },
      { kind: 'music-video', trackId: 4, artistName: 'Taylor Swift', trackName: 'Shake It Off', trackTimeMillis: 241000 },
      { kind: 'song', trackId: 5, artistName: 'DJ', trackName: 'Mega Mix', trackTimeMillis: 3_600_000 },
    ],
  };
  it('one row per song, 300 px artwork, no music videos or hour-long mixes', () => {
    const hits = parseItunesResults(sample);
    expect(hits.map((x) => x.trackId)).toEqual([1, 2]);
    expect(hits[0]).toEqual({
      key: 'taylor swift - shake it off',
      trackId: 1,
      artist: 'Taylor Swift',
      title: 'Shake It Off',
      album: '1989',
      year: '2014',
      durationSec: 219,
      artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/x/300x300bb.jpg',
    });
  });
  it('sends only the search text', () => {
    expect(itunesUrl(' shake it off ')).toBe('https://itunes.apple.com/search?term=shake+it+off&entity=song&limit=12');
  });
  it('falls back to JSONP when fetch is blocked, and reports offline / busy', async () => {
    const blocked = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await searchSongs('x', { fetchFn: blocked, jsonpFn: async () => sample, online: () => true })).toHaveLength(2);
    await expect(searchSongs('x', { online: () => false })).rejects.toEqual(new SongSearchError('offline'));
    const busy = async () => ({ ok: false, status: 403, json: async () => ({}) });
    await expect(searchSongs('x', { fetchFn: busy, online: () => true })).rejects.toMatchObject({ kind: 'busy' });
    const fail = async () => {
      throw new Error('jsonp failed');
    };
    await expect(searchSongs('x', { fetchFn: blocked, jsonpFn: fail, online: () => true })).rejects.toMatchObject({ kind: 'failed' });
  });
});
