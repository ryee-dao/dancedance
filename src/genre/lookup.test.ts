import { describe, expect, it } from 'vitest';
import { GenreRunner, type LocalSong } from './background';
import { HttpError, PoliteHttp, type GenreFetch } from './http';
import { DEFAULT_SOURCES, FAILED_RETRY_MS, lookupDue, lookupGenres, NONE_TTL_MS, parseGenreLookup } from './lookup';
import type { GenreLookup, GenreSource, SourceAnswer } from './types';

const DAY = 24 * 3600_000;
const T0 = Date.parse('2026-11-14T00:00:00Z');

/** Sources with scripted answers; counts calls. */
function fakeSources(answers: Record<string, () => SourceAnswer>): { sources: GenreSource[]; calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const mk = (id: GenreSource['id'], group: string, weight: number): GenreSource => ({
    id,
    level: 'song',
    group,
    weight,
    async lookup() {
      calls[id] = (calls[id] ?? 0) + 1;
      return answers[id]();
    },
  });
  return {
    calls,
    sources: [mk('wikipedia', 'wikimedia', 1), mk('musicbrainz', 'musicbrainz', 0.8), mk('itunes', 'itunes', 0.6)],
  };
}

const http = new PoliteHttp({ fetch: (async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({}) })) as GenreFetch, sleep: async () => {} });
const SONG = { artist: 'Evanescence', title: 'Bring Me to Life' };

describe('lookupGenres and its cache', () => {
  it('combines the answers, records what each said, and is complete when every source answered', async () => {
    const { sources } = fakeSources({
      wikipedia: () => ({ status: 'found', genres: ['Nu metal', 'rap rock'], ref: 'Bring Me to Life' }),
      musicbrainz: () => ({ status: 'found', genres: ['nu metal'] }),
      itunes: () => ({ status: 'none', reason: 'no matching track' }),
    });
    const l = await lookupGenres(SONG, { http, sources, now: () => new Date(T0) });
    expect(l.genres).toEqual(['nu metal', 'rap rock']);
    expect(l.complete).toBe(true);
    expect(l.sources.wikipedia).toEqual({ status: 'found', at: '2026-11-14T00:00:00.000Z', genres: ['Nu metal', 'rap rock'], ref: 'Bring Me to Life' });
    expect(Object.keys(l.sources)).toEqual(['wikipedia', 'musicbrainz', 'itunes']);
  });

  it('found answers are kept for ever; failed ones are asked again; none ones after they expire', async () => {
    let mb: () => SourceAnswer = () => {
      throw new HttpError(429, true, 'HTTP 429');
    };
    const { sources, calls } = fakeSources({
      wikipedia: () => ({ status: 'found', genres: ['Nu metal'] }),
      musicbrainz: () => mb(),
      itunes: () => ({ status: 'none', reason: 'no matching track' }),
    });
    let now = T0;
    const first = await lookupGenres(SONG, { http, sources, now: () => new Date(now) });
    expect(first.complete).toBe(false);
    expect(first.sources.musicbrainz).toMatchObject({ status: 'failed', reason: 'HTTP 429' });
    expect(first.genres).toEqual(['nu metal']); // a partial result is still usable
    expect(lookupDue(first, new Date(now), sources)).toBe(false);
    expect(lookupDue(first, new Date(now + FAILED_RETRY_MS), sources)).toBe(true);

    now += FAILED_RETRY_MS;
    mb = () => ({ status: 'found', genres: ['nu metal', 'alternative metal'] });
    const second = await lookupGenres(SONG, { http, sources, now: () => new Date(now), previous: first });
    expect(calls).toEqual({ wikipedia: 1, musicbrainz: 2, itunes: 1 }); // only the failed one again
    expect(second.complete).toBe(true);
    expect(second.genres[0]).toBe('nu metal');
    expect(lookupDue(second, new Date(now + NONE_TTL_MS - DAY), sources)).toBe(false);
    expect(lookupDue(second, new Date(Date.parse(second.sources.itunes!.at) + NONE_TTL_MS), sources)).toBe(true);

    now = Date.parse(second.sources.itunes!.at) + NONE_TTL_MS;
    await lookupGenres(SONG, { http, sources, now: () => new Date(now), previous: second });
    expect(calls).toEqual({ wikipedia: 1, musicbrainz: 2, itunes: 2 }); // the expired 'none'
  });

  it('an empty result is stored, not final: due again later', async () => {
    const { sources } = fakeSources({
      wikipedia: () => ({ status: 'none', reason: 'no article' }),
      musicbrainz: () => ({ status: 'none', reason: 'no recording' }),
      itunes: () => ({ status: 'none', reason: 'no track' }),
    });
    const l = await lookupGenres(SONG, { http, sources, now: () => new Date(T0) });
    expect(l.genres).toEqual([]);
    expect(lookupDue(l, new Date(T0 + DAY), sources)).toBe(false);
    expect(lookupDue(l, new Date(T0 + NONE_TTL_MS), sources)).toBe(true);
    // A new source added later makes stored results due.
    expect(lookupDue(l, new Date(T0), [...sources, { ...sources[0], id: 'theaudiodb' }])).toBe(true);
  });

  it('parses a stored lookup defensively (round trip through JSON)', async () => {
    const { sources } = fakeSources({
      wikipedia: () => ({ status: 'found', genres: ['Pop'] }),
      musicbrainz: () => ({ status: 'none', reason: 'x', ref: 'r' }),
      itunes: () => ({ status: 'found', genres: ['Pop'] }),
    });
    const l = await lookupGenres(SONG, { http, sources, now: () => new Date(T0) });
    expect(parseGenreLookup(JSON.parse(JSON.stringify(l)))).toEqual(l);
    expect(parseGenreLookup(null)).toBeNull();
    expect(parseGenreLookup({ genres: ['x'] })).toBeNull();
    const bad = parseGenreLookup({ genres: [1, 'pop'], sources: { wikipedia: { status: 'found', at: 'x', genres: [] }, itunes: { status: 'weird', at: 'x' } }, complete: 'yes' })!;
    expect(bad).toEqual({ genres: ['pop'], sources: {}, complete: false, at: '' });
  });
});

describe('levels, links and versions', () => {
  const src = (id: GenreSource['id'], level: GenreSource['level'], answer: (ctx?: Parameters<GenreSource['lookup']>[2]) => Promise<SourceAnswer>, extra: Partial<GenreSource> = {}): GenreSource => ({
    id,
    level,
    group: id.split('-')[0],
    weight: 0.8,
    lookup: (_s, _h, ctx) => answer(ctx),
    ...extra,
  });

  it('a source follows the links another one confirmed, and is marked failed (not none) when that one failed', async () => {
    let mbFails = false;
    const seen: string[] = [];
    const sources = [
      src('musicbrainz-album', 'album', async () => {
        if (mbFails) throw new HttpError(503, true, 'HTTP 503');
        return { status: 'none', reason: 'the album has no tags', links: { discogsMaster: '42' } };
      }),
      src(
        'discogs-album',
        'album',
        async (ctx) => {
          const o = await ctx!.outcome('musicbrainz-album');
          seen.push(o?.status === 'none' ? o.links?.discogsMaster ?? '' : '');
          return { status: 'found', genres: ['Cumbia'] };
        },
        { needs: ['musicbrainz-album'] },
      ),
      src('itunes', 'song', async () => ({ status: 'found', genres: ['Música tropical'] })),
    ];
    const l = await lookupGenres(SONG, { http, sources, now: () => new Date(T0) });
    expect(seen).toEqual(['42']);
    expect(l.genres).toEqual(['tropical', 'cumbia']); // one album source does not outrank the song's own label
    expect(l.genreLevels).toEqual(['song', 'album']);
    mbFails = true;
    const l2 = await lookupGenres(SONG, { http, sources, now: () => new Date(T0) });
    expect(l2.sources['discogs-album']).toMatchObject({ status: 'failed', reason: 'needs musicbrainz-album, which failed' });
    expect(l2.complete).toBe(false);
  });

  it('artist sources fill artistGenres only', async () => {
    const sources = [src('itunes', 'song', async () => ({ status: 'found', genres: ['Alternative'] })), src('wikipedia-artist', 'artist', async () => ({ status: 'found', genres: ['R&B'] }))];
    const l = await lookupGenres(SONG, { http, sources, now: () => new Date(T0) });
    expect(l.genres).toEqual(['alternative']);
    expect(l.artistGenres).toEqual(['R&B']);
    expect(parseGenreLookup(JSON.parse(JSON.stringify(l)))).toEqual(l);
  });

  it('an answer from an older version of a source is asked again; the version is stored', async () => {
    let calls = 0;
    const sources = [src('musicbrainz', 'song', async () => (calls++, { status: 'found', genres: ['pop'], counts: [2] }), { version: 2 })];
    const old = parseGenreLookup({ genres: ['pop'], sources: { musicbrainz: { status: 'found', at: '2026-11-01T00:00:00Z', genres: ['pop'] } }, complete: true, at: 'x' })!;
    expect(lookupDue(old, new Date(T0), sources)).toBe(true);
    const l = await lookupGenres(SONG, { http, sources, previous: old, now: () => new Date(T0) });
    expect(calls).toBe(1);
    expect(l.sources.musicbrainz).toMatchObject({ v: 2, counts: [2] });
    expect(lookupDue(l, new Date(T0), sources)).toBe(false);
  });

  it('results stored before levels existed are still read', () => {
    const old = { genres: ['nu metal', 'rap rock'], sources: { wikipedia: { status: 'found', at: 'x', genres: ['Nu metal'], ref: 'p' } }, complete: true, at: 'x' };
    expect(parseGenreLookup(old)).toEqual(old);
    // Levels that do not fit the list are dropped.
    expect(parseGenreLookup({ ...old, genreLevels: ['song'] })!.genreLevels).toBeUndefined();
    expect(parseGenreLookup({ ...old, genreLevels: ['song', 'album'], artistGenres: ['metal', 3] })).toMatchObject({ genreLevels: ['song', 'album'], artistGenres: ['metal'] });
  });
});

describe('GenreRunner (songs added on the TV)', () => {
  function setup(songs: LocalSong[], opts: { busyFor?: number } = {}) {
    let t = T0;
    let busyLeft = opts.busyFor ?? 0;
    const saved: [string, GenreLookup][] = [];
    const requests: number[] = [];
    // Every source answers "nothing" quickly: the runner only needs answers, not genres.
    const fetch: GenreFetch = async (url) => {
      requests.push(t);
      const body = url.includes('wikipedia') ? { query: { pages: [], search: [] } } : url.includes('wbsearch') ? { search: [] } : {};
      return { ok: true, status: 200, headers: new Headers(), json: async () => body };
    };
    const runner = new GenreRunner({
      songs: () => songs,
      save: (id, l) => {
        saved.push([id, l]);
        const s = songs.find((x) => x.videoId === id);
        if (s) s.genreLookup = l;
        return !!s;
      },
      busy: () => {
        if (busyLeft > 0) {
          busyLeft--;
          return true;
        }
        return false;
      },
      fetch,
      now: () => t,
      sleep: async (ms) => void (t += ms),
      setTimer: (fn) => fn(),
    });
    return { runner, saved, requests, time: () => t };
  }

  const song = (id: string, extra: Partial<LocalSong> = {}): LocalSong => ({ videoId: id, artist: 'Pooh Shiesty', title: 'Back in Blood', ...extra });

  it('looks up songs without a stored lookup and hands each result to the store', async () => {
    const { runner, saved } = setup([song('AAAAAAAAAAA'), song('BBBBBBBBBBB', { itunesGenre: 'Hip-Hop/Rap' })]);
    expect(runner.due().map((s) => s.videoId)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB']);
    expect(await runner.run()).toBe(2);
    expect(saved.map(([id]) => id)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB']);
    expect(saved[1][1].genres).toEqual(['hip hop']); // the stored iTunes genre counts as the iTunes source
    expect(runner.due()).toEqual([]); // stored now: not due until something expires
  });

  it('waits while a song is playing (no request goes out during playback)', async () => {
    const { runner, requests } = setup([song('AAAAAAAAAAA')], { busyFor: 5 });
    await runner.run();
    // busy() said yes 5 times, polled every 3 s: nothing was sent in the first 15 s.
    expect(Math.min(...requests)).toBeGreaterThanOrEqual(T0 + 15_000);
  });

  it('skips songs whose lookup is still fresh, and songs removed meanwhile', async () => {
    const fresh = parseGenreLookup({
      genres: ['drill'],
      sources: Object.fromEntries(DEFAULT_SOURCES.map((s) => [s.id, { status: 'found', at: '2026-11-13T00:00:00Z', genres: ['drill'], ...(s.version ? { v: s.version } : {}) }])),
      complete: true,
      at: '2026-11-13T00:00:00Z',
    });
    const { runner, saved } = setup([song('AAAAAAAAAAA', { genreLookup: fresh }), song('BBBBBBBBBBB')]);
    expect(runner.due().map((s) => s.videoId)).toEqual(['BBBBBBBBBBB']);
    await runner.run();
    expect(saved.map(([id]) => id)).toEqual(['BBBBBBBBBBB']);
  });

  it('stops a run when every source failed (offline) and leaves the songs due', async () => {
    const songs = [song('AAAAAAAAAAA'), song('BBBBBBBBBBB')];
    let t = T0;
    const saved: string[] = [];
    let calls = 0;
    const runner = new GenreRunner({
      songs: () => songs,
      save: (id, l) => {
        saved.push(id);
        songs.find((s) => s.videoId === id)!.genreLookup = l;
        return true;
      },
      busy: () => false,
      fetch: async () => {
        calls++;
        throw new TypeError('Failed to fetch');
      },
      now: () => t,
      sleep: async (ms) => void (t += ms),
    });
    await runner.run();
    expect(saved).toEqual(['AAAAAAAAAAA']);
    expect(songs[0].genreLookup?.complete).toBe(false);
    expect(runner.due().map((s) => s.videoId)).toEqual(['BBBBBBBBBBB']); // A waits FAILED_RETRY_MS
    t += FAILED_RETRY_MS;
    expect(runner.due().map((s) => s.videoId)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB']);
    expect(calls).toBeGreaterThan(0);
  });
});
