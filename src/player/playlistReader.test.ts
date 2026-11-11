import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanTitle,
  fetchSiteEnrichment,
  limitConcurrency,
  parsePlaylistLink,
  PRIVATE_LIST_MESSAGE,
  resetSiteEnrichmentCache,
} from './playlistReader';

const ID = 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG';

describe('parsePlaylistLink', () => {
  it.each([
    [`https://www.youtube.com/playlist?list=${ID}`],
    [`https://youtube.com/playlist?list=${ID}&si=abc123`],
    [`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${ID}&index=3`],
    [`https://music.youtube.com/playlist?list=${ID}`],
    [`https://youtu.be/dQw4w9WgXcQ?list=${ID}`],
    [`https://m.youtube.com/playlist?list=${ID}`],
    [`youtube.com/playlist?list=${ID}`],
    [`  ${ID}  `],
  ])('accepts %s', (input) => {
    expect(parsePlaylistLink(input)).toEqual({ ok: true, listId: ID });
  });

  it.each([
    ['https://www.youtube.com/playlist?list=WL'],
    ['https://www.youtube.com/playlist?list=LL'],
    ['https://music.youtube.com/playlist?list=LM'],
    ['WL'],
    ['ll'],
  ])('rejects private list %s', (input) => {
    expect(parsePlaylistLink(input)).toEqual({ ok: false, error: PRIVATE_LIST_MESSAGE });
  });

  it('rejects single videos, other sites and empty input', () => {
    for (const input of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
      'https://example.com/playlist?list=PL123456789012',
      '',
      'hello there',
    ]) {
      const r = parsePlaylistLink(input);
      expect(r.ok, input).toBe(false);
    }
  });
});

describe('cleanTitle', () => {
  it('splits "Artist - Title" and strips noise', () => {
    expect(cleanTitle('Dua Lipa - Levitating (Official Music Video)', 'Dua Lipa')).toEqual({
      artist: 'Dua Lipa',
      title: 'Levitating',
    });
    expect(cleanTitle('Linkin Park – Numb [Official Video] [4K]', 'Linkin Park')).toEqual({
      artist: 'Linkin Park',
      title: 'Numb',
    });
  });

  it('uses Topic channels and skips VEVO channel names', () => {
    expect(cleanTitle('Levitating', 'Dua Lipa - Topic')).toEqual({ title: 'Levitating', artist: 'Dua Lipa' });
    expect(cleanTitle('Levitating', 'DuaLipaVEVO')).toEqual({ title: 'Levitating', artist: undefined });
  });

  it('keeps meaningful parentheses', () => {
    expect(cleanTitle('Stressed Out (Tomsize Remix)', 'twenty one pilots').title).toBe(
      'Stressed Out (Tomsize Remix)',
    );
  });
});

describe('limitConcurrency', () => {
  it('never runs more than the limit at once', async () => {
    const run = limitConcurrency(2);
    let active = 0;
    let peak = 0;
    const job = () =>
      run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return 1;
      });
    const results = await Promise.all([job(), job(), job(), job(), job()]);
    expect(results).toEqual([1, 1, 1, 1, 1]);
    expect(peak).toBe(2);
  });
});

describe('fetchSiteEnrichment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSiteEnrichmentCache();
  });

  it('asks for playlist.json once per page load, even when it is a 404', async () => {
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchSiteEnrichment()).toEqual([]);
    expect(await fetchSiteEnrichment()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses videos and caches them; a network failure is retried later', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(new Response(JSON.stringify({ videos: [{ videoId: 'abc', title: 'T' }, { bad: 1 }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchSiteEnrichment()).toEqual([]);
    expect(await fetchSiteEnrichment()).toEqual([{ videoId: 'abc', title: 'T' }]);
    expect(await fetchSiteEnrichment()).toEqual([{ videoId: 'abc', title: 'T' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
