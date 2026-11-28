/// <reference types="node" />
/**
 * Measure the "Add a song" search stage before and after the second catalog:
 * does the song the user typed show up, and under its real title?
 *
 *   npx tsx tools/eval/searchEval.ts --fetch     # look up missing terms (iTunes, Deezer, YouTube), then report
 *   npx tsx tools/eval/searchEval.ts             # report from the caches only
 *   npx tsx tools/eval/searchEval.ts --all       # print every song's before/after hit
 *
 * Songs: the curated list (pickSample.ts SAMPLE, which holds the songs missing
 * from the iTunes search) plus EXPLICIT_SAMPLE (rap, trap, drill, reggaeton,
 * metal). For each, "artist title" goes to the iTunes Search API and to
 * Deezer's search exactly as the app sends it (src/ui/songSearch.ts,
 * src/ui/deezer.ts); "before" is the iTunes list alone (parseItunesResults),
 * "after" the merged list (mergeCatalogs). Then every song found only after
 * (or found under a censored title before and the real one after) goes
 * through the picker (tools/beatmaps/pick.ts, YouTube search by yt-dlp as in
 * pickEval.ts), and the pick is printed to be checked by hand.
 *
 * Raw catalog answers are cached in data/search-cache.json, YouTube results in
 * data/pick-cache.json (shared with pickEval.ts).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeName } from '../../src/beat/cloud';
import { deezerUrl, parseDeezer } from '../../src/ui/deezer';
import { looksCensored, mergeCatalogs } from '../../src/ui/songMerge';
import { itunesUrl, parseItunesResults, type SongHit } from '../../src/ui/songSearch';
import { degradedSearch, fallbackQueries, mergeSearches, needsMoreSearch, parseSearch, rankCandidates, requestCore, searchQueries, type SearchEntry, type SongRequest } from '../beatmaps/pick';
import { EXPLICIT_SAMPLE, SAMPLE, type SampleSong } from './pickSample';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEARCH_CACHE = join(HERE, 'data/search-cache.json');
const PICK_CACHE = join(HERE, 'data/pick-cache.json');
const args = process.argv.slice(2);
const FETCH = args.includes('--fetch');
const ALL = args.includes('--all');

interface SearchCache {
  itunes: Record<string, unknown[]>;
  deezer: Record<string, unknown>;
}
const cache: SearchCache = existsSync(SEARCH_CACHE) ? JSON.parse(readFileSync(SEARCH_CACHE, 'utf8')) : { itunes: {}, deezer: {} };
const pickCache: { itunes: unknown; search: Record<string, SearchEntry[]> } = JSON.parse(readFileSync(PICK_CACHE, 'utf8'));
const saveSearch = () => writeFileSync(SEARCH_CACHE, JSON.stringify(cache, null, 0).replace(/\],"/g, '],\n"').replace(/\}\},"/g, '}},\n"') + '\n');
const savePick = () => writeFileSync(PICK_CACHE, JSON.stringify(pickCache, null, 0).replace(/\],"/g, '],\n"') + '\n');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The iTunes fields the app reads (plus explicitness for the report). */
const IT_KEEP = ['kind', 'trackId', 'artistName', 'trackName', 'collectionName', 'trackTimeMillis', 'releaseDate', 'trackExplicitness', 'primaryGenreName', 'artworkUrl100'];

async function politeJson(url: string, what: string): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url);
    if (r.status === 403 || r.status === 429 || r.status >= 500) {
      console.error(`  ${what} ${r.status}, waiting 60 s`);
      await sleep(60_000);
      continue;
    }
    return r.json();
  }
  throw new Error(`${what} kept refusing`);
}

async function catalogs(term: string): Promise<{ itunes: unknown[]; deezer: unknown } | null> {
  if (!(term in cache.itunes)) {
    if (!FETCH) return null;
    const j = (await politeJson(itunesUrl(term), 'iTunes')) as { results?: Record<string, unknown>[] };
    cache.itunes[term] = (j.results ?? []).map((x) => Object.fromEntries(IT_KEEP.filter((k) => k in x).map((k) => [k, x[k]])));
    saveSearch();
    await sleep(3000);
  }
  if (!(term in cache.deezer)) {
    if (!FETCH) return null;
    const j = (await politeJson(deezerUrl(term), 'Deezer')) as { data?: Record<string, unknown>[] };
    // Keep only what parseDeezer reads.
    cache.deezer[term] = {
      data: (j.data ?? []).map((x) => ({
        type: x.type,
        title: x.title,
        duration: x.duration,
        explicit_lyrics: x.explicit_lyrics,
        artist: { name: (x.artist as { name?: string } | undefined)?.name },
        album: { title: (x.album as { title?: string } | undefined)?.title, md5_image: (x.album as { md5_image?: string } | undefined)?.md5_image },
      })),
    };
    saveSearch();
    await sleep(1000);
  }
  return { itunes: cache.itunes[term], deezer: cache.deezer[term] };
}

const OTHER_VERSION = /\b(?:instrumental|remix|karaoke|live|sped|slowed|acoustic|version|a cappella|acapella)\b/i;

/**
 * The hit a user would tap: by this artist (any billed name), the same title
 * words (brackets aside), not another version the user didn't type. `wants`
 * are the titles accepted, the real one first.
 */
function tap(s: SampleSong, hits: SongHit[], wants: string[]): SongHit | null {
  const names = s.artist.split(/\s*(?:,|&)\s*/).map((a) => normalizeName(a).replace(/ /g, ''));
  for (const want of wants) {
    const core = requestCore(want).join(' ');
    const hit = hits.find((h) => {
      const a = normalizeName(h.artist).replace(/ /g, '');
      if (!names.some((n) => a.includes(n))) return false;
      if (OTHER_VERSION.test(h.title.replace(/\((?:amended|clean)[^)]*\)/gi, '')) && !OTHER_VERSION.test(want)) return false;
      if (/\bremix\b/i.test(h.album)) return false;
      return requestCore(h.title).join(' ') === core;
    });
    if (hit) return hit;
  }
  return null;
}

/** Censored: found only under the clean title the user didn't type, or a title with stars / "Amended". */
const censoredHit = (s: SampleSong, h: SongHit) => looksCensored(h.title) || requestCore(h.title).join(' ') !== requestCore(s.title).join(' ');

async function ytSearch(query: string): Promise<SearchEntry[]> {
  if (query in pickCache.search && !(FETCH && degradedSearch(pickCache.search[query]))) return pickCache.search[query];
  if (!FETCH) throw new Error('not fetched');
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(2500 + Math.random() * 2500);
    const r = spawnSync('yt-dlp', ['--ignore-config', '--no-progress', '--socket-timeout', '30', '--flat-playlist', '-J', '--', `ytsearch10:${query}`], {
      encoding: 'utf8',
      maxBuffer: 16 << 20,
      timeout: 120_000,
    });
    if (r.status === 0) {
      const es = parseSearch(JSON.parse(r.stdout)).map((e) => ({ ...e, description: e.description.slice(0, 40) }));
      if (degradedSearch(es) && attempt < 2) continue;
      pickCache.search[query] = es;
      savePick();
      return es;
    }
    console.error(`  yt-dlp failed, waiting ${60 * 2 ** attempt} s`);
    await sleep(60_000 * 2 ** attempt);
  }
  throw new Error('YouTube kept refusing');
}

async function pick(req: SongRequest) {
  const lists: SearchEntry[][] = [];
  for (const q of searchQueries(req)) lists.push(await ytSearch(q));
  let res = rankCandidates(req, mergeSearches(lists));
  for (const q of fallbackQueries(req)) {
    if (!needsMoreSearch(res.ranked)) break;
    lists.push(await ytSearch(q));
    res = rankCandidates(req, mergeSearches(lists));
  }
  return res;
}

async function main() {
  const songs = [...SAMPLE.map((s) => ({ s, group: 'curated' })), ...EXPLICIT_SAMPLE.map((s) => ({ s, group: 'explicit' }))];
  const rows: { s: SampleSong; group: string; before: SongHit | null; after: SongHit | null; censoredBefore: boolean; censoredAfter: boolean }[] = [];
  for (const { s, group } of songs) {
    const term = `${s.artist} ${s.title}`;
    const raw = await catalogs(term);
    if (!raw) {
      console.log(`.. ${term}: not fetched yet`);
      continue;
    }
    const itHits = parseItunesResults({ results: raw.itunes });
    let dz: ReturnType<typeof parseDeezer> = [];
    try {
      dz = parseDeezer(raw.deezer);
    } catch {
      dz = [];
    }
    const merged = mergeCatalogs(term, itHits, dz) as SongHit[];
    const wants = [s.title, ...(s.tap ? [s.tap] : [])];
    // A censored clean title counts as found (and as censored), before and after.
    const before = tap(s, itHits, wants);
    const after = tap(s, merged, wants);
    rows.push({ s, group, before, after, censoredBefore: !!before && censoredHit(s, before), censoredAfter: !!after && censoredHit(s, after) });
    if (ALL) console.log(`${s.artist} - ${s.title}: before ${before ? `"${before.title}" ${before.durationSec} s` : '-'} | after ${after ? `"${after.title}" ${after.durationSec} s (${after.source ?? 'itunes'})` : '-'}`);
  }

  const count = (g: string | null, f: (r: (typeof rows)[number]) => boolean) => rows.filter((r) => (g === null || r.group === g) && f(r)).length;
  console.log('\nSEARCH STAGE                      curated   explicit   all');
  const line = (label: string, f: (r: (typeof rows)[number]) => boolean) =>
    console.log(`${label.padEnd(34)}${String(count('curated', f)).padStart(7)}${String(count('explicit', f)).padStart(11)}${String(count(null, f)).padStart(6)}`);
  line('songs', () => true);
  line('found before (iTunes only)', (r) => !!r.before);
  line('  of which censored title', (r) => r.censoredBefore);
  line('found after (iTunes + Deezer)', (r) => !!r.after);
  line('  of which censored title', (r) => r.censoredAfter);

  const missing = rows.filter((r) => !r.after);
  if (missing.length) console.log(`\nSTILL NOT FOUND\n${missing.map((r) => `  ${r.s.artist} - ${r.s.title}`).join('\n')}`);

  // Picker on the songs the change affects: newly found, or now under the real title.
  const changed = rows.filter((r) => r.after && (!r.before || (r.censoredBefore && !r.censoredAfter)));
  console.log(`\nPICKER on ${changed.length} newly found / uncensored songs (check title, channel, length by hand)`);
  let picked = 0;
  for (const r of changed) {
    const h = r.after!;
    const req: SongRequest = { artist: h.artist, title: h.title, durationSec: h.durationSec };
    let res;
    try {
      res = await pick(req);
    } catch (e) {
      console.log(`.. ${h.artist} - ${h.title}: ${(e as Error).message}`);
      continue;
    }
    const top = res.ranked[0];
    const why = !r.before ? 'new' : 'uncensored';
    if (top) {
      picked++;
      console.log(`OK [${why}] ${h.artist} - ${h.title} (${h.durationSec} s)\n     ${top.tier} ${top.entry.id} ${top.entry.duration} s "${top.entry.title}" / ${top.entry.channel}${top.entry.verified ? ' ✓' : ''}`);
    } else {
      console.log(`-- [${why}] ${h.artist} - ${h.title} (${h.durationSec} s): nothing usable`);
      for (const x of res.rejected.slice(0, 8)) {
        console.log(`     ${x.reason.slice(0, 34).padEnd(34)} ${String(x.entry.duration).padStart(4)} s ${x.entry.channel.slice(0, 26).padEnd(26)} "${x.entry.title}"`);
      }
    }
  }
  console.log(`picker found a video for ${picked} / ${changed.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
