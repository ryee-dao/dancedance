/**
 * Whole lookups replayed from recorded answers (src/genre/__fixtures__/rec-*.json,
 * recorded live on 2026-11-14 with tools/beatmaps/genreFixtures.ts, trimmed to
 * the fields the sources read): every source, at every level, as it ran, and
 * the combined lists.
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PoliteHttp, type GenreFetch } from './http';
import { lookupGenres } from './lookup';
import type { GenreLookup, SongQuery, SourceId } from './types';

interface Recording {
  song: SongQuery;
  answers: Record<string, unknown>;
}

const FIX = join(__dirname, '__fixtures__');

async function run(name: string): Promise<GenreLookup & { asked: string[] }> {
  const rec = JSON.parse(readFileSync(join(FIX, `rec-${name}.json`), 'utf8')) as Recording;
  const asked: string[] = [];
  // Answers by exact URL; anything not recorded is a 404 (the test would then show a failed source).
  const fetch: GenreFetch = async (url) => {
    asked.push(url);
    if (!(url in rec.answers)) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
    return { ok: true, status: 200, headers: new Headers(), json: async () => rec.answers[url] };
  };
  const http = new PoliteHttp({ fetch, spacingMs: () => 0, sleep: async () => {}, now: () => 0 });
  const l = await lookupGenres(rec.song, { http, now: () => new Date('2026-11-14T12:00:00Z') });
  return { ...l, asked };
}

const said = (l: GenreLookup, id: SourceId) => {
  const o = l.sources[id];
  return o?.status === 'found' ? o.genres : o?.status;
};

describe('recorded lookups', () => {
  it('every request is answered and sent once, though several sources share them', async () => {
    for (const name of ['nunca-es-suficiente', 'girl-ultra-punk', 'donna-lewis', 'prince-royce', 'bts-body-to-body', 'back-in-blood', 'my-immortal', 'billie-eilish-tv']) {
      const l = await run(name);
      expect(l.complete, name).toBe(true);
      expect(new Set(l.asked).size, name).toBe(l.asked.length);
    }
  });

  it('Nunca Es Suficiente: Natalia Lafourcade\'s own 2015 single is not this version; the album (MusicBrainz -> Discogs) says cumbia', async () => {
    const l = await run('nunca-es-suficiente');
    expect(l.sources.wikipedia).toMatchObject({ status: 'none', reason: expect.stringContaining('by another artist') });
    expect(l.sources['musicbrainz-album']).toMatchObject({ links: { discogsMaster: '2422489', wikidata: 'Q56208868' } });
    expect(said(l, 'discogs-album')).toEqual(['Cumbia', 'Vallenato', 'Latin']);
    // The store's "tropical" is an umbrella: cumbia, which the album and the artist agree on (combine.ts rule 8),
    // joins the song level; the album's vallenato stays the album's.
    expect(l.genres).toEqual(['tropical', 'cumbia', 'vallenato', 'latin']);
    expect(l.genreLevels).toEqual(['song', 'song', 'album', 'album']);
    expect(l.genres).not.toContain('Latin pop');
    expect(l.artistGenres![0]).toBe('cumbia');
  });

  it('Girl Ultra "Punk": TheAudioDB\'s R&B is the artist\'s genre copied onto the track; the store\'s per-release label leads', async () => {
    const l = await run('girl-ultra-punk');
    expect(said(l, 'theaudiodb')).toEqual(['R&B']);
    expect(said(l, 'theaudiodb-artist')).toEqual(['R&B', 'Rock/Pop']);
    expect(said(l, 'wikipedia-artist')).toEqual(['R&B']);
    expect(l.genres).toEqual(['alternative', 'R&B']);
    expect(l.artistGenres![0]).toBe('R&B');
  });

  it('Donna Lewis: single-vote "hip hop" is dropped; "dream pop" (also on the album) leads', async () => {
    const l = await run('donna-lewis');
    expect(said(l, 'musicbrainz')).toContain('hip hop');
    expect(l.genres).not.toContain('hip hop');
    expect(l.genres.slice(0, 2)).toEqual(['dream pop', 'synth-pop']);
    // "electronic" (MusicBrainz's song tags) is an umbrella next to the song's specific names: Discogs and the album's
    // MusicBrainz tags repeating it do not lift it (combine.ts rule 6): it comes last among the song's own names.
    // The album's "downtempo" (Discogs alone, not credible album support) follows them (rule 4b), past the six.
    expect(l.genres[l.genres.length - 1]).toBe('electronic');
    expect(l.genreLevels![l.genres.length - 1]).toBe('song');
    expect(l.genres).not.toContain('downtempo');
  });

  it('Prince Royce: two album sources say bachata, which narrows the store\'s "Música tropical"', async () => {
    const l = await run('prince-royce');
    expect(l.genres.slice(0, 3)).toEqual(['Latin pop', 'bachata', 'tropical']);
    expect(l.genreLevels!.slice(0, 2)).toEqual(['song', 'album']);
    expect(l.artistGenres![0]).toBe('bachata');
  });

  it('BTS "Body to Body": K-pop in the top two; single-vote chart tags and "boom bap" are gone', async () => {
    const l = await run('bts-body-to-body');
    expect(l.genres.slice(0, 2)).toEqual(['pop rap', 'K-pop']);
    expect(l.genres).not.toContain('boom bap');
    expect(l.genres.join(' ')).not.toMatch(/billboard|wochen/);
  });

  it('famous songs keep their lists (Back in Blood, My Immortal, TV)', async () => {
    expect((await run('back-in-blood')).genres.slice(0, 2)).toEqual(['trap', 'drill']);
    expect((await run('my-immortal')).genres).toContain('gothic rock');
    expect((await run('billie-eilish-tv')).genres.slice(0, 2)).toEqual(['indie folk', 'singer-songwriter']);
  });
});
