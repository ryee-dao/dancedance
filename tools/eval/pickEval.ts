/// <reference types="node" />
/**
 * Measure the "Add a song" picker (tools/beatmaps/pick.ts) on real searches.
 *
 *   npx tsx tools/eval/pickEval.ts --fetch      # look up missing songs/queries, then report
 *   npx tsx tools/eval/pickEval.ts              # report from the cache only
 *   npx tsx tools/eval/pickEval.ts --picks      # also print every song's pick
 *   npx tsx tools/eval/pickEval.ts --json out.json   # picks as JSON (to diff two versions)
 *   npx tsx tools/eval/pickEval.ts --picker tools/beatmaps/pick.old.ts   # measure another copy of the picker
 *       (e.g. `git show 5c21014:tools/beatmaps/pick.ts > tools/beatmaps/pick.old.ts`, the picker before
 *       the 2026-11-14 changes; it must sit beside pick.ts for its imports)
 *   npx tsx tools/eval/pickEval.ts --no-fallback   # without the third (plain) search
 *
 * Songs: the curated list in pickSample.ts (artist, title and length looked up
 * in the iTunes Search API exactly as the app gets them, src/ui/songSearch.ts)
 * plus the random known/obscure samples drawn by tools/eval/sample.ts. Then
 * the picker's two search queries go to yt-dlp's YouTube search (anonymous,
 * flat results, no downloads) and the results are ranked. Only "artist title"
 * is sent to iTunes and the query text to YouTube.
 *
 * Responses are cached in data/pick-cache.json (keyed by query), so a picker change
 * is re-measured on identical results; a query the picker newly asks for is
 * fetched on the next --fetch.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeName } from '../../src/beat/cloud';
import { itunesUrl, parseItunesResults } from '../../src/ui/songSearch';
import * as currentPicker from '../beatmaps/pick';
import type { SearchEntry, SongRequest } from '../beatmaps/pick';
import type { SampleFile } from './common';
import { SAMPLE, type SampleSong } from './pickSample';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'data/pick-cache.json');

interface ItunesPick {
  artist: string;
  title: string;
  durationSec: number;
  album: string;
  explicitness: string;
}
/** The iTunes fields the app reads, per search term. */
type ItunesRaw = Record<string, unknown>[];
interface Cache {
  itunes: Record<string, ItunesRaw>;
  search: Record<string, SearchEntry[]>;
}

const args = process.argv.slice(2);
const FETCH = args.includes('--fetch');
const PICKS = args.includes('--picks');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : undefined;
/** `--picker <module>`: measure another version of pick.ts (e.g. a copy of the previous one). */
const pickerPath = args.includes('--picker') ? args[args.indexOf('--picker') + 1] : undefined;

const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { itunes: {}, search: {} };
const save = () => writeFileSync(CACHE, JSON.stringify(cache, null, 0).replace(/\],"/g, '],\n"') + '\n');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const songKey = (s: SampleSong) => `${s.artist} - ${s.title}`;
const itunesTerm = (s: SampleSong) => `${s.artist} ${s.title}`;
const KEEP = ['kind', 'trackId', 'artistName', 'trackName', 'collectionName', 'trackTimeMillis', 'releaseDate', 'trackExplicitness', 'primaryGenreName'];

async function fetchItunes(term: string): Promise<ItunesRaw> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(itunesUrl(term).replace(/limit=\d+/, 'limit=25'));
    if (r.status === 403 || r.status === 429 || r.status >= 500) {
      console.error(`  iTunes ${r.status}, waiting 60 s`);
      await sleep(60_000);
      continue;
    }
    const json = (await r.json()) as { results?: Record<string, unknown>[] };
    return (json.results ?? []).map((x) => Object.fromEntries(KEEP.filter((k) => k in x).map((k) => [k, x[k]])));
  }
  throw new Error('iTunes kept refusing');
}

/** Only the iTunes rows by the song's artist are kept in the cache (chooseHit looks at no others). */
const byArtist = (s: SampleSong, raw: ItunesRaw): ItunesRaw => {
  const a = normalizeName(s.artist).replace(/ /g, '');
  return raw.filter((x) => typeof x.artistName === 'string' && normalizeName(x.artistName).replace(/ /g, '').includes(a));
};

const OTHER_VERSION = /\b(?:instrumental|remix|karaoke|live|sped|slowed|acoustic|version|a cappella|acapella)\b/i;

/**
 * The hit a user would tap among the app's results (parseItunesResults): by
 * this artist, the same title words (brackets such as "(feat. X)" aside), not
 * an instrumental/remix/live... the user didn't type. `tap` names the title
 * as iTunes lists it when that differs (a censored clean title).
 */
function chooseHit(s: SampleSong, raw: ItunesRaw): ItunesPick | null {
  const hits = parseItunesResults({ results: raw });
  const a = normalizeName(s.artist).replace(/ /g, '');
  const want = s.tap ?? s.title;
  const core = currentPicker.requestCore(want).join(' ');
  const ok = hits.filter(
    (h) => normalizeName(h.artist).replace(/ /g, '').includes(a) && !(OTHER_VERSION.test(h.title) && !OTHER_VERSION.test(want)) && !/\bremix\b/i.test(h.album),
  );
  const hit = ok.find((h) => currentPicker.requestCore(h.title).join(' ') === core);
  if (!hit) return null;
  const r = raw.find((x) => x.trackId === hit.trackId);
  return { artist: hit.artist, title: hit.title, durationSec: hit.durationSec, album: hit.album, explicitness: String(r?.trackExplicitness ?? '') };
}

let ytParse = currentPicker.parseSearch;

/** Search results where no entry has a channel or a view count: a degraded YouTube answer. */
let degradedAnswers = 0;
const degraded = currentPicker.degradedSearch;

/** `yt-dlp ytsearch10:<query> --flat-playlist -J`, like tools/beatmaps/youtube.ts searchVideos. */
async function ytSearch(query: string): Promise<SearchEntry[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = spawnSync('yt-dlp', ['--ignore-config', '--no-progress', '--socket-timeout', '30', '--flat-playlist', '-J', '--', `ytsearch10:${query}`], {
      encoding: 'utf8',
      maxBuffer: 16 << 20,
      timeout: 120_000,
    });
    if (r.status === 0) {
      const es = ytParse(JSON.parse(r.stdout)).map((e) => ({ ...e, description: e.description.slice(0, 40) }));
      if (!degraded(es) || attempt >= 2) return es;
      degradedAnswers++;
      console.error(`  degraded answer for "${query}", asking again in 10 s`);
      await sleep(10_000);
      continue;
    }
    const wait = 60_000 * 2 ** attempt;
    console.error(`  yt-dlp failed (${(r.stderr ?? '').trim().split('\n').pop()?.slice(0, 160)}), waiting ${wait / 1000} s`);
    await sleep(wait);
  }
  throw new Error('YouTube kept refusing; stopping (re-run --fetch later, the cache keeps what was done)');
}

/** Random samples drawn by tools/eval/sample.ts (iTunes data already resolved): known + obscure halves. */
const SAMPLE_FILES = ['data/run-20261113/sample.json', 'data/pick-obscure-sample.json'].map((f) => join(HERE, f));

interface Item {
  key: string;
  /** 'curated' (pickSample.ts), or the random sample's half. */
  group: string;
  genre: string;
  term?: string;
  song?: SampleSong;
  req?: SongRequest;
}

function items(): Item[] {
  const out: Item[] = SAMPLE.map((s) => ({ key: songKey(s), group: 'curated', genre: s.genre, term: itunesTerm(s), song: s }));
  for (const f of SAMPLE_FILES) {
    if (!existsSync(f)) continue;
    for (const s of (JSON.parse(readFileSync(f, 'utf8')) as SampleFile).songs) {
      out.push({ key: `${s.artist} - ${s.title}`, group: s.half, genre: s.genre ?? '?', req: { artist: s.artist, title: s.title, durationSec: s.durationSec } });
    }
  }
  return out;
}

async function main() {
  const picker: typeof currentPicker & { fallbackQuery?: (r: SongRequest) => string } = pickerPath ? await import(resolve(pickerPath)) : currentPicker;
  const { mergeSearches, parseSearch, rankCandidates, searchQueries } = picker;
  ytParse = parseSearch;
  const report: { song: string; group: string; request: SongRequest; pick: string | null; tier?: string; title?: string; channel?: string; duration?: number | null; ranked: number }[] = [];
  const notFound: string[] = [];
  const byGroup = new Map<string, [number, number]>();
  const byGenre = new Map<string, [number, number]>();
  let usedNetwork = false;
  /** Cached search results for a query; null = not fetched and not allowed to. */
  const results = async (q: string): Promise<SearchEntry[] | null> => {
    // A degraded answer (no entry has a channel or views; YouTube serves one now and then) is
    // asked again on --fetch, so the picker is measured on normal results. Counted in the report.
    if (q in cache.search && !(FETCH && degraded(cache.search[q]))) return cache.search[q];
    if (!FETCH) return null;
    if (usedNetwork) await sleep(2500 + Math.random() * 2500);
    cache.search[q] = await ytSearch(q);
    usedNetwork = true;
    save();
    return cache.search[q];
  };
  for (const item of items()) {
    let req = item.req;
    let explicitness = '';
    if (!req) {
      const term = item.term!;
      if (!(term in cache.itunes)) {
        if (!FETCH) continue;
        if (usedNetwork) await sleep(2500 + Math.random() * 2500);
        cache.itunes[term] = byArtist(item.song!, await fetchItunes(term));
        usedNetwork = true;
        save();
      }
      const it = chooseHit(item.song!, cache.itunes[term]);
      if (!it) {
        console.log(`?? ${item.key}: no iTunes match`);
        continue;
      }
      req = { artist: it.artist, title: it.title, durationSec: it.durationSec };
      explicitness = it.explicitness;
    }
    const queries = searchQueries(req);
    const lists: SearchEntry[][] = [];
    for (const q of queries) {
      const r = await results(q);
      if (r) lists.push(r);
    }
    if (lists.length < queries.length) {
      console.log(`.. ${item.key}: queries not fetched yet`);
      continue;
    }
    let entries = mergeSearches(lists);
    let { ranked, rejected } = rankCandidates(req, entries);
    if (!ranked.length && picker.fallbackQuery && !args.includes('--no-fallback')) {
      const q = picker.fallbackQuery(req);
      queries.push(q);
      const r = await results(q);
      if (!r) {
        console.log(`.. ${item.key}: fallback query not fetched yet`);
        continue;
      }
      entries = mergeSearches([...lists, r]);
      ({ ranked, rejected } = rankCandidates(req, entries));
    }
    const top = ranked[0];
    for (const [map, k] of [[byGroup, item.group], [byGenre, item.genre]] as const) {
      const g = map.get(k) ?? [0, 0];
      g[1]++;
      if (top) g[0]++;
      map.set(k, g);
    }
    report.push({ song: item.key, group: item.group, request: req, pick: top?.entry.id ?? null, tier: top?.tier, title: top?.entry.title, channel: top?.entry.channel, duration: top?.entry.duration, ranked: ranked.length });
    const head = `[${item.group}] ${req.artist} - ${req.title} (${req.durationSec} s${explicitness === 'cleaned' ? ', clean' : explicitness === 'explicit' ? ', explicit' : ''})`;
    if (top && PICKS) {
      console.log(`OK ${head}\n     ${top.tier} ${top.entry.id} ${top.entry.duration} s ${top.entry.views} views "${top.entry.title}" / ${top.entry.channel}${top.entry.verified ? ' ✓' : ''}`);
    }
    if (!top) {
      const lines = [`-- ${head}   [${queries.join(' | ')}]`];
      for (const r of rejected) {
        const e = r.entry;
        lines.push(`     ${r.reason.slice(0, 34).padEnd(34)} ${String(e.duration).padStart(4)} s ${String(e.views ?? '?').padStart(10)} ${e.verified ? '✓' : ' '} ${e.channel.slice(0, 26).padEnd(26)} "${e.title}"`);
      }
      notFound.push(lines.join('\n'));
    }
  }
  if (notFound.length) console.log(`\nNOT FOUND\n${notFound.join('\n')}`);
  const fmt = (m: Map<string, [number, number]>) => [...m].map(([g, [f, n]]) => `${g} ${f}/${n}`).join(', ');
  console.log(`\nby genre: ${fmt(byGenre)}`);
  console.log(`by group: ${fmt(byGroup)}`);
  const found = report.filter((r) => r.pick).length;
  console.log(`found ${found} / ${report.length} (${report.length ? ((100 * found) / report.length).toFixed(1) : 0} %)`);
  const stillDegraded = Object.values(cache.search).filter(degraded).length;
  console.log(`degraded YouTube answers: ${degradedAnswers} re-asked this run, ${stillDegraded} still in the cache`);
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
