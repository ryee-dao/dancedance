/// <reference types="node" />
/**
 * Record every answer one song's genre lookup gets, for the tests
 * (src/genre/__fixtures__/rec-<name>.json: { song, answers: { url: body } }).
 * The tests replay them by URL, so a lookup runs offline exactly as it ran
 * live. Answers are trimmed to the fields the sources read (trimAnswer);
 * Wikipedia texts are kept whole (the matchers read them).
 *
 *   npx tsx tools/beatmaps/genreFixtures.ts <name> "<artist>" "<title>" [--album "<album>"] [--itunes "<genre>"] [--duration <s>]
 *   npx tsx tools/beatmaps/genreFixtures.ts --trim <file>     # trim an existing recording
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupGenres, PoliteHttp, type SongQuery } from '../../src/genre';
import { GENRE_USER_AGENT } from './genreClient';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

type J = Record<string, unknown>;
const pick = (o: unknown, keys: string[]): J => {
  const out: J = {};
  if (o && typeof o === 'object') for (const k of keys) if (k in (o as J)) out[k] = (o as J)[k];
  return out;
};
const credit = (r: J) => (Array.isArray(r['artist-credit']) ? (r['artist-credit'] as J[]).map((a) => ({ ...pick(a, ['name', 'joinphrase']), artist: pick(a.artist, ['id', 'name']) })) : undefined);
const tags = (r: J) => (Array.isArray(r.tags) ? (r.tags as J[]).map((t) => pick(t, ['name', 'count'])) : undefined);
const rels = (r: J) => (Array.isArray(r.relations) ? (r.relations as J[]).map((x) => ({ type: x.type, url: pick(x.url, ['resource']) })) : undefined);
const claims = (c: unknown) => {
  const out: J = {};
  for (const p of ['P31', 'P175', 'P136']) {
    const list = (c as J | undefined)?.[p];
    if (Array.isArray(list)) out[p] = list.map((x: J) => ({ rank: x.rank, mainsnak: { datavalue: { value: pick((x.mainsnak as J)?.datavalue && ((x.mainsnak as J).datavalue as J).value, ['id']) } } }));
  }
  return out;
};

/** Only the fields the sources read (see src/genre/sources/*), so recordings stay small. */
export function trimAnswer(url: string, body: unknown): unknown {
  const b = (body ?? {}) as J;
  if (url.startsWith('https://musicbrainz.org/')) {
    if (Array.isArray(b.recordings))
      return {
        recordings: (b.recordings as J[]).map((r) => ({
          ...pick(r, ['id', 'title', 'length', 'video', 'disambiguation', 'first-release-date']),
          'artist-credit': credit(r),
          tags: tags(r),
          releases: Array.isArray(r.releases) ? (r.releases as J[]).map((x) => ({ ...pick(x, ['title', 'status', 'date']), 'release-group': pick(x['release-group'], ['id', 'title', 'primary-type', 'secondary-types']) })) : undefined,
        })),
      };
    if (Array.isArray(b['release-groups'])) return { 'release-groups': (b['release-groups'] as J[]).map((g) => ({ ...pick(g, ['id', 'title', 'disambiguation', 'primary-type', 'secondary-types']), 'artist-credit': credit(g), tags: tags(g) })) };
    if (Array.isArray(b.artists)) return { artists: (b.artists as J[]).map((a) => pick(a, ['id', 'name', 'score', 'disambiguation'])) };
    return { ...pick(b, ['id', 'name', 'title']), tags: tags(b), relations: rels(b) };
  }
  if (url.startsWith('https://www.wikidata.org/') && b.entities && typeof b.entities === 'object') {
    const ents: J = {};
    for (const [id, e] of Object.entries(b.entities as J)) {
      const x = (e ?? {}) as J;
      ents[id] = { ...pick(x, ['missing', 'labels', 'descriptions', 'sitelinks']), ...(x.claims ? { claims: claims(x.claims) } : {}) };
    }
    return { entities: ents };
  }
  if (url.startsWith('https://www.wikidata.org/') && Array.isArray(b.search)) return { search: (b.search as J[]).map((h) => ({ ...pick(h, ['id', 'label', 'description']), match: pick(h.match, ['text']) })) };
  if (url.startsWith('https://itunes.apple.com/') && Array.isArray(b.results))
    return { results: (b.results as J[]).map((r) => pick(r, ['wrapperType', 'artistName', 'trackName', 'collectionName', 'primaryGenreName', 'trackTimeMillis', 'artistId', 'collectionId'])) };
  if (url.startsWith('https://api.discogs.com/masters/')) return { ...pick(b, ['id', 'title', 'genres', 'styles']), tracklist: Array.isArray(b.tracklist) ? (b.tracklist as J[]).map((t) => pick(t, ['title'])) : [] };
  if (url.startsWith('https://www.theaudiodb.com/')) {
    if (Array.isArray(b.track)) return { track: (b.track as J[]).map((t) => pick(t, ['idTrack', 'strTrack', 'strArtist', 'strAlbum', 'strGenre', 'strMood', 'intDuration'])) };
    if (Array.isArray(b.artists)) return { artists: (b.artists as J[]).map((a) => pick(a, ['idArtist', 'strArtist', 'strGenre', 'strStyle'])) };
  }
  return body;
}

async function main(): Promise<void> {
  if (process.argv[2] === '--trim') {
    const file = resolve(process.argv[3]);
    const rec = JSON.parse(readFileSync(file, 'utf8')) as { answers: Record<string, unknown> };
    for (const [u, b] of Object.entries(rec.answers)) rec.answers[u] = trimAnswer(u, b);
    writeFileSync(file, `${JSON.stringify(rec)}\n`);
    return;
  }
  const [name, artist, title] = process.argv.slice(2);
  const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
  if (!name || !artist || !title) throw new Error('usage: genreFixtures.ts <name> <artist> <title> [--album A] [--itunes G] [--duration S]');
  const song: SongQuery = {
    artist,
    title,
    ...(arg('--album') ? { album: arg('--album') } : {}),
    ...(arg('--itunes') ? { itunesGenre: arg('--itunes') } : {}),
    ...(arg('--duration') ? { durationSec: Number(arg('--duration')) } : {}),
  };
  const answers: Record<string, unknown> = {};
  const http = new PoliteHttp({
    userAgent: GENRE_USER_AGENT,
    fetch: async (url, init) => {
      const res = await fetch(url, init);
      if (!res.ok) return res;
      const body = await res.json();
      answers[url] = trimAnswer(url, body);
      return { ok: true, status: res.status, headers: res.headers, json: async () => body };
    },
  });
  const l = await lookupGenres(song, { http, log: (s) => console.log(s) });
  console.log(`=> ${l.genres.join(', ')} | levels ${l.genreLevels?.join(', ')} | artist ${l.artistGenres?.join(', ')}`);
  const out = join(ROOT, 'src/genre/__fixtures__', `rec-${name}.json`);
  writeFileSync(out, `${JSON.stringify({ recordedAt: new Date().toISOString(), song, answers })}\n`);
  console.log(`wrote ${out} (${Object.keys(answers).length} answers)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
