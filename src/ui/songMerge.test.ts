import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kotlinCatalogFixtures, KOTLIN_CATALOG_FIXTURES } from '../../tools/beatmaps/catalogFixturesKotlin';
import { espresso, freakOn, fukumean, loseYourself, lucidDreams, notLikeUs, theBox, type CatalogFixture } from './catalog.fixtures';
import { DeezerError, deezerUrl, parseDeezer } from './deezer';
import { censorFits, looksCensored, mergeCatalogs, sameArtist, versionCore } from './songMerge';
import { Backoff, findItunesTrackId, parseItunesResults, pickArtistTrack, searchSongs, SongSearchError, type SongHit } from './songSearch';

const merged = (f: CatalogFixture) => mergeCatalogs(f.term, parseItunesResults(f.itunes), parseDeezer(f.deezer)) as SongHit[];
const by = (hits: SongHit[], artist: string, title: string) => hits.filter((h) => h.artist === artist && h.title === title);

describe('Deezer search parser (recorded answers)', () => {
  it('reads artist, real title, album, whole-second length, explicit flag and a 300 px cover', () => {
    const t = parseDeezer(theBox.deezer)[0];
    expect(t).toEqual({
      artist: 'Roddy Ricch',
      title: 'The Box',
      album: 'Please Excuse Me for Being Antisocial',
      durationSec: 196,
      explicit: true,
      artworkUrl: 'https://cdn-images.dzcdn.net/images/cover/4cecb47ae25837b9dd022004b5cacbdc/300x300-000000-80-0-0.jpg',
    });
    expect(parseDeezer(fukumean.deezer).find((x) => x.title === 'fukumean (instrumental)')?.explicit).toBe(false);
  });
  it('drops what is not a 20 s .. 15 min track, and reports the quota error as busy', () => {
    expect(parseDeezer({ data: [{ type: 'album', title: 'X', duration: 200, artist: { name: 'A' } }, { title: 'Y', duration: 3600, artist: { name: 'A' } }] })).toEqual([]);
    expect(() => parseDeezer({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } })).toThrow(new DeezerError('busy'));
    expect(parseDeezer(null)).toEqual([]);
  });
  it('sends only the search text', () => {
    expect(deezerUrl(' the box ')).toBe('https://api.deezer.com/search?q=the+box&limit=10');
  });
});

describe('merging iTunes and Deezer', () => {
  it('adds a song iTunes lists no version of, first, with its own length and no iTunes ID', () => {
    const hits = merged(theBox);
    expect(hits[0]).toMatchObject({ artist: 'Roddy Ricch', title: 'The Box', durationSec: 196, trackId: 0, source: 'deezer' });
    expect(parseItunesResults(theBox.itunes).some((h) => h.artist === 'Roddy Ricch' && h.title === 'The Box')).toBe(false);
  });
  it('drops Deezer hits by other artists that do not hold the search words, and karaoke / emulations', () => {
    const artists = merged(theBox).filter((h) => h.source === 'deezer').map((h) => h.artist);
    expect(artists).toEqual(['Roddy Ricch']); // not Ella Mai "How", Blxst, 8-Bit Arcade, "sped up nightcore"
    // Someone else's track that names the artist only in brackets.
    expect(merged(notLikeUs).filter((h) => h.source === 'deezer')).toEqual([]);
    // The iTunes list itself is shown as it comes (EC Twins' "The Box" stays, after the real one).
    expect(merged(theBox).findIndex((h) => h.artist === 'EC Twins')).toBeGreaterThan(0);
  });
  it('the same recording from both catalogs is one entry: iTunes keeps its ID, genre and artwork', () => {
    const hits = by(merged(notLikeUs), 'Kendrick Lamar', 'Not Like Us');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ durationSec: 274, trackId: 1781353929, genre: 'Hip-Hop/Rap' });
    expect(hits[0].artworkUrl).toMatch(/mzstatic/);
  });
  it('a censored clean title gives way to the real one; the clean ID (which names the censored title) is dropped', () => {
    const hits = merged(fukumean);
    expect(hits.filter((h) => h.artist === 'Gunna' && /mean$/i.test(h.title)).map((h) => h.title)).toEqual(['fukumean']);
    expect(hits[0]).toMatchObject({ artist: 'Gunna', title: 'fukumean', durationSec: 125, trackId: 0, genre: 'Hip-Hop/Rap', key: 'gunna - fukumean' });
    expect(hits[0].artworkUrl).toMatch(/mzstatic/);
    const freak = merged(freakOn);
    expect(freak[0]).toMatchObject({ artist: 'Missy Elliott', title: 'Get Ur Freak On', durationSec: 237, trackId: 0 });
    expect(freak.some((h) => /Amended/.test(h.title))).toBe(false);
  });
  it('a clean title is not renamed to another version of the same length (remix, a cappella)', () => {
    const lucid = merged(lucidDreams);
    expect(lucid[0]).toMatchObject({ artist: 'Juice WRLD', title: 'Lucid Dreams', durationSec: 240, trackId: 1447177630 });
    expect(by(lucid, 'Juice WRLD', 'Lucid Dreams (Remix)')).toEqual([]); // merged into the iTunes remix row
    const esp = merged(espresso);
    expect(by(esp, 'Sabrina Carpenter', 'Espresso')).toHaveLength(1);
    expect(by(esp, 'Sabrina Carpenter', 'Espresso')[0].trackId).toBeGreaterThan(0);
    expect(censorFits('Lucid Dreams', 'Lucid Dreams (Remix)')).toBe(false);
  });
  it('clean and explicit versions of different lengths stay two entries, each with its own length', () => {
    const hits = by(merged(loseYourself), 'Eminem', 'Lose Yourself');
    expect(hits.map((h) => [h.durationSec, h.source ?? 'itunes', !!h.clean])).toEqual([
      [322, 'itunes', true],
      [326, 'deezer', false],
    ]);
  });
  it('each song once (artist + title within 2 s), at most 15', () => {
    for (const f of [theBox, fukumean, freakOn, loseYourself, notLikeUs, lucidDreams, espresso]) {
      const hits = merged(f);
      expect(hits.length).toBeLessThanOrEqual(15);
      hits.forEach((h, i) => expect(hits.some((o, j) => j !== i && o.key === h.key && Math.abs(o.durationSec - h.durationSec) <= 2)).toBe(false));
    }
  });
  it('title helpers', () => {
    expect(looksCensored('B*tch Better Have My Money')).toBe(true);
    expect(looksCensored('Get Ur Freak On (Amended LP Version)')).toBe(true);
    expect(looksCensored('Clean')).toBe(false); // a song called Clean
    expect(censorFits('B**ch', 'Bitch')).toBe(true);
    expect(censorFits('umean', 'fukumean')).toBe(true);
    expect(censorFits('Love', 'Hate')).toBe(false);
    expect(versionCore('Get Ur Freak On (Amended LP Version)')).toBe('get ur freak on');
    expect(versionCore("Creepin' (Instrumental)")).toBe('creepin instrumental');
    expect(versionCore('TQG (feat. Shakira)')).toBe('tqg');
    expect(sameArtist('Drake & 21 Savage', 'Drake')).toBe(true);
    expect(sameArtist('8-Bit Arcade', 'Roddy Ricch')).toBe(false);
  });
});

describe('searchSongs with both catalogs', () => {
  const itunesOk = (f: CatalogFixture) => async () => ({ ok: true, status: 200, json: async () => f.itunes });
  it('merges the two answers', async () => {
    const hits = await searchSongs(theBox.term, { fetchFn: itunesOk(theBox), deezerFn: async () => theBox.deezer, online: () => true, backoff: new Backoff() });
    expect(hits[0]).toMatchObject({ artist: 'Roddy Ricch', title: 'The Box' });
  });
  it('either catalog alone is enough; iTunes errors show only when Deezer has nothing either', async () => {
    const busy = async () => ({ ok: false, status: 429, json: async () => ({}) });
    const hits = await searchSongs(theBox.term, { fetchFn: busy, deezerFn: async () => theBox.deezer, online: () => true, backoff: new Backoff() });
    expect(hits.map((h) => h.title)).toEqual(['The Box']);
    const noDeezer = async () => {
      throw new Error('deezer failed');
    };
    expect(await searchSongs(theBox.term, { fetchFn: itunesOk(theBox), deezerFn: noDeezer, online: () => true, backoff: new Backoff() })).toHaveLength(11);
    await expect(searchSongs('x', { fetchFn: busy, deezerFn: noDeezer, online: () => true, backoff: new Backoff() })).rejects.toEqual(new SongSearchError('busy'));
  });
  it('backs off a catalog for a minute after 403/429 (Deezer: its quota error)', async () => {
    let now = 0;
    const backoff = new Backoff(() => now);
    let itCalls = 0;
    let dzCalls = 0;
    const busy = async () => {
      itCalls++;
      return { ok: false, status: 403, json: async () => ({}) };
    };
    const quota = async () => {
      dzCalls++;
      return { error: { code: 4, message: 'Quota limit exceeded' } };
    };
    await expect(searchSongs('x', { fetchFn: busy, deezerFn: quota, online: () => true, backoff })).rejects.toMatchObject({ kind: 'busy' });
    await expect(searchSongs('x', { fetchFn: busy, deezerFn: quota, online: () => true, backoff })).rejects.toMatchObject({ kind: 'busy' });
    expect([itCalls, dzCalls]).toEqual([1, 1]);
    now = 61_000;
    await expect(searchSongs('x', { fetchFn: busy, deezerFn: quota, online: () => true, backoff })).rejects.toMatchObject({ kind: 'busy' });
    expect([itCalls, dzCalls]).toEqual([2, 2]);
  });
  it('a stale search aborts both requests', async () => {
    const ctl = new AbortController();
    const pending = (_u: string, i?: RequestInit) =>
      new Promise<never>((_, reject) => i?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    const dz = (_t: string, signal?: AbortSignal) => new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    const p = searchSongs('x', { fetchFn: pending, deezerFn: dz, signal: ctl.signal, online: () => true, backoff: new Backoff() });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('iTunes ID of a Deezer-only song (for the relay)', () => {
  const artistSearch = { results: [{ wrapperType: 'artist', artistId: 1212442072, artistName: 'Roddy Ricch' }, { wrapperType: 'artist', artistId: 9, artistName: 'Roddy Ricch Tribute' }] };
  const artistSongs = {
    results: [
      { wrapperType: 'artist', artistId: 1212442072, artistName: 'Roddy Ricch' },
      { kind: 'song', trackId: 1545235483, trackName: 'The Box (Apple Music Awards 2020 Live)', trackTimeMillis: 190524, trackExplicitness: 'explicit' },
      { kind: 'song', trackId: 1490463329, trackName: 'The Box', trackTimeMillis: 196653, trackExplicitness: 'explicit', primaryGenreName: 'Hip-Hop/Rap' },
    ],
  };
  it('finds the explicit track in the artist’s song list (lookup by artist ID lists explicit tracks)', async () => {
    expect(pickArtistTrack(artistSongs, { title: 'The Box', durationSec: 196 })).toEqual({ trackId: 1490463329, genre: 'Hip-Hop/Rap' });
    expect(pickArtistTrack(artistSongs, { title: 'The Box', durationSec: 230 })).toBeNull();
    const urls: string[] = [];
    const fetchFn = async (u: string) => {
      urls.push(u);
      return { ok: true, status: 200, json: async () => (u.includes('/lookup') ? artistSongs : artistSearch) };
    };
    expect(await findItunesTrackId({ artist: 'Roddy Ricch', title: 'The Box', durationSec: 196 }, fetchFn)).toBe(1490463329);
    expect(urls).toEqual([
      'https://itunes.apple.com/search?term=Roddy+Ricch&entity=musicArtist&limit=5',
      'https://itunes.apple.com/lookup?id=1212442072&entity=song&limit=200',
    ]);
    const down = async () => ({ ok: false, status: 503, json: async () => ({}) });
    expect(await findItunesTrackId({ artist: 'Roddy Ricch', title: 'The Box', durationSec: 196 }, down)).toBe(0);
  });
});

describe('Kotlin copy of the catalog fixtures', () => {
  it('CatalogFixtures.kt is up to date (regenerate: npx tsx tools/beatmaps/catalogFixturesKotlin.ts)', () => {
    expect(readFileSync(KOTLIN_CATALOG_FIXTURES, 'utf8')).toBe(kotlinCatalogFixtures());
  });
});
