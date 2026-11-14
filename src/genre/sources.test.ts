/**
 * Each source's parser and matcher against recorded answers (src/genre/__fixtures__,
 * trimmed copies of real responses from November 2026).
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PoliteHttp, type GenreFetch } from './http';
import type { SongQuery } from './match';
import { itunes, matchTracks as matchStore, parseTracks as parseStore } from './sources/itunes';
import { matchRecordings, matchReleaseGroups, musicbrainz, parseRecordings, parseReleaseGroups, RECORDING_MIN_SHARE, tallyTags } from './sources/musicbrainz';
import { matchTracks, parseTracks, theaudiodb, trackUrl } from './sources/theaudiodb';
import { parseSearch as parseWdSearch, songCandidates, wikidata } from './sources/wikidata';
import { baseTitle, checkPage, parsePages, titleForms, wikipedia } from './sources/wikipedia';
import { listItems, parseInfoboxes } from './sources/wikitext';

const FIX = join(__dirname, '__fixtures__');
const fx = (name: string): unknown => (JSON.parse(readFileSync(join(FIX, `${name}.json`), 'utf8')) as { body: unknown }).body;

/** A client whose fetch answers from fixtures: the first route whose test matches the URL. */
function fixtureHttp(routes: [RegExp, string | number][], seen: string[] = []): PoliteHttp {
  const fetch: GenreFetch = async (url) => {
    seen.push(url);
    const r = routes.find(([re]) => re.test(decodeURIComponent(url.replace(/\+/g, ' '))));
    if (!r) throw new Error(`no fixture for ${url}`);
    const [, f] = r;
    if (typeof f === 'number') return { ok: false, status: f, headers: new Headers(), json: async () => ({}) };
    return { ok: true, status: 200, headers: new Headers(), json: async () => fx(f) };
  };
  return new PoliteHttp({ fetch, spacingMs: () => 0, sleep: async () => {}, now: () => 0 });
}

const BACK_IN_BLOOD: SongQuery = { artist: 'Pooh Shiesty', title: 'Back in Blood (feat. Lil Durk)', durationSec: 132 };
const MY_IMMORTAL: SongQuery = { artist: 'Evanescence', title: 'My Immortal', durationSec: 273 };
const TV: SongQuery = { artist: 'Billie Eilish', title: 'TV', durationSec: 281 };

describe('Wikipedia', () => {
  it('asks for the usual title forms in one request, without the "feat." part', () => {
    expect(titleForms(BACK_IN_BLOOD)).toEqual(['Back in Blood (Pooh Shiesty song)', 'Back in Blood (song)', 'Back in Blood']);
    expect(titleForms({ artist: 'Beyoncé ft. JAY-Z', title: 'Crazy in Love' })).toEqual([
      'Crazy in Love (Beyoncé song)',
      'Crazy in Love (Beyoncé ft. JAY-Z song)',
      'Crazy in Love (song)',
      'Crazy in Love',
    ]);
    expect(baseTitle('TV (Billie Eilish song)')).toBe('TV');
    expect(baseTitle('My Immortal (song)')).toBe('My Immortal');
    expect(baseTitle('Snow (Hey Oh)')).toBe('Snow (Hey Oh)');
  });

  it('reads infobox genre lists: links (label wins), hlist/flatlist, refs and comments dropped', () => {
    const pages = parsePages(fx('wp-bring-me-to-life'));
    const page = pages.get('Bring Me to Life (Evanescence song)')!;
    expect(page.title).toBe('Bring Me to Life'); // followed the redirect
    const box = parseInfoboxes(page.content).find((b) => b.kind === 'infobox song')!;
    expect(listItems(box.params.genre).map((n) => n.label)).toEqual(['Nu metal', 'rap rock', 'alternative rock', 'gothic metal']);
    expect(listItems('{{hlist|[[Pop music|Pop]]|[[hip-hop music|hip-hop]]<ref>x</ref>|[[Contemporary R&B|R&B]]}}').map((n) => [n.label, n.target])).toEqual([
      ['Pop', 'Pop music'],
      ['hip-hop', 'hip-hop music'],
      ['R&B', 'Contemporary R&B'],
    ]);
    expect(listItems('<!-- no -->[[Post-disco]]<ref name="a"/>, [[Rhythm and blues|R&B]]<br />funk')).toHaveLength(3);
  });

  it('finds the song article among the forms and skips the disambiguation page', () => {
    const pages = parsePages(fx('wp-my-immortal'));
    expect(pages.get('My Immortal (Evanescence song)')!.missing).toBe(true);
    expect(pages.get('My Immortal')!.disambiguation).toBe(true);
    expect(checkPage(MY_IMMORTAL, pages.get('My Immortal')!)).toEqual({ ok: false, reason: 'disambiguation page' });
    expect(checkPage(MY_IMMORTAL, pages.get('My Immortal (song)')!)).toMatchObject({ ok: true, genres: ['Alternative rock'] });
  });

  it('rejects a song of the same name by another artist, and a non-song page', () => {
    const pages = parsePages(fx('wp-butter-wrong-artist'));
    const taio: SongQuery = { artist: 'Taio Cruz', title: 'Butter' };
    expect(checkPage(taio, pages.get('Butter (song)')!)).toEqual({ ok: false, reason: 'by another artist' });
    expect(checkPage(taio, pages.get('Butter')!).ok).toBe(false);
    // ...while the same page is right for its own artist.
    expect(checkPage({ artist: 'BTS', title: 'Butter' }, pages.get('Butter (song)')!).ok).toBe(true);
  });

  it('a song with no article of its own: the EP page it redirects to is rejected, then the search finds nothing', async () => {
    const pages = parsePages(fx('wp-tv-forms'));
    expect(pages.get('TV (Billie Eilish song)')!.title).toBe('Guitar Songs');
    expect(checkPage(TV, pages.get('TV (Billie Eilish song)')!)).toEqual({ ok: false, reason: 'not a song article (album: EP)' });
    const seen: string[] = [];
    const http = fixtureHttp([[/list=search/, 'wp-tv-search'], [/titles=/, 'wp-tv-forms']], seen);
    const a = await wikipedia.lookup(TV, http);
    expect(a.status).toBe('none');
    expect(a.status === 'none' && a.reason).toContain('Guitar Songs: not a song article (album: EP)');
    expect(seen).toHaveLength(2); // forms + search; no hit had the song's title, so no third request
  });

  it('returns the confirmed genres in one request when a form is the article', async () => {
    const seen: string[] = [];
    const a = await wikipedia.lookup({ artist: 'Michael Jackson', title: 'Billie Jean' }, fixtureHttp([[/titles=/, 'wp-billie-jean']], seen));
    expect(a).toEqual({ status: 'found', genres: ['Post-disco', 'R&B', 'funk', 'dance-pop'], ref: 'Billie Jean', links: { albumArticle: 'Thriller (album)', artistArticle: 'Michael Jackson' } });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('origin=*');
  });
});

describe('Wikidata', () => {
  it('keeps only song-like items whose label is the title', () => {
    const tv = songCandidates('TV', parseWdSearch(fx('wd-search-tv')));
    expect(tv.map((c) => c.id)).toEqual(['Q113233217', 'Q115786780']); // not television, Tuvalu, a website...
    const bib = songCandidates('Back in Blood (feat. Lil Durk)', parseWdSearch(fx('wd-search-back-in-blood')));
    expect(bib.map((c) => c.id)).toEqual(['Q105038558']); // not the two albums or the disambiguation page
  });

  it('confirms the performer and reads the genre labels', async () => {
    const a = await wikidata.lookup(
      BACK_IN_BLOOD,
      fixtureHttp([
        [/wbsearchentities/, 'wd-search-back-in-blood'],
        [/props=claims/, 'wd-claims-back-in-blood'],
        [/props=labels/, 'wd-labels-back-in-blood'],
      ]),
    );
    expect(a).toEqual({ status: 'found', genres: ['drill', 'trap music', 'hip-hop'], ref: 'Q105038558' });
  });

  it('a confirmed item without genres is "none"; another performer is rejected', async () => {
    const routes: [RegExp, string][] = [
      [/wbsearchentities/, 'wd-search-tv'],
      [/props=claims/, 'wd-claims-tv'],
      [/props=labels/, 'wd-labels-tv'],
    ];
    expect(await wikidata.lookup(TV, fixtureHttp(routes))).toMatchObject({ status: 'none', reason: 'the item has no genre' });
    expect(await wikidata.lookup({ artist: 'Marilyn Manson', title: 'TV' }, fixtureHttp(routes))).toMatchObject({ status: 'none', reason: 'no song item by this artist' });
  });
});

describe('MusicBrainz', () => {
  it('uses the single (not reworks or other release types) and only positive votes', () => {
    const groups = parseReleaseGroups(fx('mb-rg-billie-jean'));
    const m = matchReleaseGroups({ artist: 'Michael Jackson', title: 'Billie Jean' }, groups);
    expect(m.map((g) => g.title)).toEqual(['Billie Jean']);
    expect(tallyTags(m)).toEqual(['pop', 'electronic', 'dance', 'disco', 'funk']);
  });

  it('rejects the live single and drops tags voted down', () => {
    const m = matchReleaseGroups(MY_IMMORTAL, parseReleaseGroups(fx('mb-rg-my-immortal')));
    expect(m).toHaveLength(1);
    expect(m[0].secondaryTypes).toEqual([]);
    const tags = tallyTags(m);
    expect(tags).toContain('pop/rock');
    expect(tags).not.toContain('gothic rock'); // -1
    expect(tags).not.toContain('post-grunge'); // 0
  });

  it('a soundtrack single still counts as the song', () => {
    const m = matchReleaseGroups({ artist: 'Justin Timberlake', title: "Can't Stop the Feeling!" }, parseReleaseGroups(fx('mb-rg-cant-stop')));
    expect(m).toHaveLength(1);
    expect(tallyTags(m)).toEqual(['pop', 'r&b', 'funk']);
  });

  it('falls back to studio recordings, and one person\'s stray tags are dropped', async () => {
    const recs = matchRecordings({ artist: 'Skrillex', title: 'Bangarang', durationSec: 215 }, parseRecordings(fx('mb-rec-bangarang')));
    expect(tallyTags(recs)).toContain('indie rock');
    const tags = tallyTags(recs, RECORDING_MIN_SHARE);
    expect(tags.slice(0, 3)).toEqual(['dubstep', 'electronic', 'house']);
    expect(tags).not.toContain('indie rock');
    expect(tags).not.toContain('sexy');
    const a = await musicbrainz.lookup(TV, fixtureHttp([[/release-group/, 'mb-rg-tv'], [/recording/, 'mb-rec-tv']]));
    expect(a).toMatchObject({ status: 'found', genres: ['contemporary folk', 'indie folk', 'singer-songwriter'] });
  });
});

describe('TheAudioDB', () => {
  it('genre and mood (kept apart) for the matching track', async () => {
    expect(trackUrl(BACK_IN_BLOOD)).toBe('https://www.theaudiodb.com/api/v1/json/123/searchtrack.php?s=Pooh+Shiesty&t=Back+in+Blood');
    const a = await theaudiodb.lookup(MY_IMMORTAL, fixtureHttp([[/searchtrack/, 'adb-my-immortal']]));
    expect(a).toEqual({ status: 'found', genres: ['Rock'], moods: ['Troubled'], ref: 'track/33152319' });
    expect(await theaudiodb.lookup(BACK_IN_BLOOD, fixtureHttp([[/searchtrack/, 'adb-back-in-blood']]))).toMatchObject({ status: 'none' });
    expect(await theaudiodb.lookup(TV, fixtureHttp([[/searchtrack/, 'adb-tv']]))).toMatchObject({ status: 'none', reason: 'the track has no genre' });
    // Another artist's track of the same name is not this song.
    expect(matchTracks({ artist: 'Within Temptation', title: 'My Immortal' }, parseTracks(fx('adb-my-immortal')))).toEqual([]);
  });
});

describe('iTunes', () => {
  it('uses a stored genre without asking', async () => {
    const seen: string[] = [];
    expect(await itunes.lookup({ ...MY_IMMORTAL, itunesGenre: 'Hard Rock' }, fixtureHttp([], seen))).toEqual({ status: 'found', genres: ['Hard Rock'], ref: 'stored' });
    expect(seen).toEqual([]);
  });

  it('matches artist and title, skipping other versions; reports the store label as is', async () => {
    const tracks = parseStore(fx('it-tv'));
    const m = matchStore(TV, tracks);
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((t) => /^TV$/i.test(t.track))).toBe(true);
    const a = await itunes.lookup(TV, fixtureHttp([[/itunes/, 'it-tv']]));
    expect(a).toMatchObject({ status: 'found', genres: ['Alternative'] });
    // "Soundtrack" comes back as said; names.ts drops it when combining.
    const c = await itunes.lookup({ artist: 'Justin Timberlake', title: "Can't Stop the Feeling!" }, fixtureHttp([[/itunes/, 'it-cant-stop']]));
    expect(c).toMatchObject({ status: 'found', genres: ['Soundtrack'] });
  });
});

describe('failures', () => {
  it('a source that cannot be reached throws, so the lookup records it as failed (not as "none")', async () => {
    await expect(wikipedia.lookup(TV, fixtureHttp([[/./, 404]]))).rejects.toMatchObject({ status: 404 });
  });
});
