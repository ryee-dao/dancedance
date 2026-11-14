/// <reference types="node" />
/**
 * Backfill the multi-source `genres` list (src/genre) for every catalog song:
 * songs.json entries and the starter-pack songs in index.json (artist and
 * title from src/data/starter.json).
 *
 *   npx tsx tools/beatmaps/backfillGenreLists.ts [--dry-run] [--limit <n>] [--only <text>] [--parallel <n>]
 *   npx tsx tools/beatmaps/backfillGenreLists.ts --recombine   # no network: recompute lists from stored answers
 *   npx tsx tools/beatmaps/backfillGenreLists.ts --report      # no network: print the summary
 *   npx tsx tools/beatmaps/backfillGenreLists.ts --echo        # no network: how often each site's song answer repeats its artist answer
 *   npx tsx tools/beatmaps/backfillGenreLists.ts --refresh musicbrainz[,wikidata]  # ask those sources again (after a matcher fix)
 *
 * Re-runnable: public/genres.json is the cache (sources that found the song
 * are never asked again; 'none' answers expire, failed ones are retried), and
 * it is saved after every song so an interrupted run loses nothing. Writes
 * songs.json and index.json through the project's renderers; beat-map files
 * are never touched. Sends only artist and title, with a generic client name.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSongsList } from '../../src/beat/cloud';
import { DEFAULT_SOURCES, familyDisagreements, lookupGenres, recombine, type SourceId } from '../../src/genre';
import { sourceEntries } from '../../src/genre/combine';
import { genreHttp } from './genreClient';
import { catalogSongs, dueSongs, parseGenresFile, putRecord, renderGenresFile, type CatalogSong, type GenreRecord } from './genres';
import { renderIndex, type MapInfo } from './output';
import { applyGenreLists, readStarter, songGenreLists, songGenreMeta, songGenres } from './pipeline';
import { renderSongs } from './songs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SONGS = join(ROOT, 'public/songs.json');
const INDEX = join(ROOT, 'public/beatmaps/index.json');
const GENRES = join(ROOT, 'public/genres.json');
const STARTER = join(ROOT, 'src/data/starter.json');

async function readText(p: string): Promise<string | undefined> {
  try {
    return await readFile(p, 'utf8');
  } catch {
    return undefined;
  }
}

/** The catalog summary: songs with genres, how many sources found each, per-source hit rate, misses and disagreements. */
export function summarize(catalog: readonly CatalogSong[], records: Readonly<Record<string, GenreRecord>>): string {
  const lines: string[] = [];
  const byKey = new Map<string, CatalogSong>();
  for (const c of catalog) if (!byKey.has(c.key)) byKey.set(c.key, c);
  const songs = [...byKey.values()];
  const counts = new Map<number, number>();
  const hits = new Map<SourceId, { found: number; none: number; failed: number }>();
  const missing: string[] = [];
  const disagree: string[] = [];
  let withGenres = 0;
  for (const s of songs) {
    const r = records[s.key];
    if (!r) {
      missing.push(`${s.artist} - ${s.title}: not looked up yet`);
      continue;
    }
    let found = 0;
    for (const src of DEFAULT_SOURCES) {
      const o = r.sources[src.id];
      const h = hits.get(src.id) ?? { found: 0, none: 0, failed: 0 };
      if (o?.status === 'found') {
        h.found++;
        found++;
      } else if (o?.status === 'none') h.none++;
      else h.failed++;
      hits.set(src.id, h);
    }
    counts.set(found, (counts.get(found) ?? 0) + 1);
    if (r.genres.length) withGenres++;
    else missing.push(`${s.artist} - ${s.title}: ${Object.entries(r.sources).map(([id, o]) => `${id} ${o?.status}`).join(', ')}`);
    const d = familyDisagreements(r.sources, DEFAULT_SOURCES);
    if (d.length) {
      const said = Object.entries(r.sources)
        .filter(([, o]) => o?.status === 'found')
        .map(([id, o]) => `${id}: ${(o as { genres: string[] }).genres.slice(0, 4).join('/')}`)
        .join('; ');
      disagree.push(`${s.artist} - ${s.title}: ${d.map(([a, b]) => `${a} vs ${b}`).join(', ')}  [${said}]  => ${r.genres.join(', ')}`);
    }
  }
  lines.push(`songs (unique artist + title): ${songs.length}; with genres: ${withGenres}`);
  lines.push('sources that found the song | songs');
  for (const n of [...counts.keys()].sort((a, b) => b - a)) lines.push(`  ${n} | ${counts.get(n)}`);
  lines.push('per-source: found / none / failed-or-missing (hit rate)');
  for (const src of DEFAULT_SOURCES) {
    const h = hits.get(src.id) ?? { found: 0, none: 0, failed: 0 };
    const total = h.found + h.none + h.failed;
    lines.push(`  ${src.id.padEnd(11)} ${h.found} / ${h.none} / ${h.failed}  (${total ? Math.round((100 * h.found) / total) : 0}%)`);
  }
  for (const level of ['song', 'album', 'artist'] as const) {
    const n = songs.filter((s) => DEFAULT_SOURCES.some((src) => src.level === level && records[s.key]?.sources[src.id]?.status === 'found')).length;
    lines.push(`any ${level}-level source found: ${n}/${songs.length}`);
  }
  lines.push(`with artistGenres: ${songs.filter((s) => records[s.key]?.artistGenres?.length).length}/${songs.length}`);
  lines.push(`no genres (${missing.length}):`);
  for (const m of missing) lines.push(`  ${m}`);
  lines.push(`sources disagree on the broad family (${disagree.length}):`);
  for (const d of disagree) lines.push(`  ${d}`);
  return lines.join('\n');
}

/**
 * For each site with a song answer and an artist answer: on how many songs
 * (both found) every song genre is also an artist genre. combine.ts
 * ECHO_RATES is this measurement.
 */
export function echoRates(records: Readonly<Record<string, GenreRecord>>): Map<SourceId, { echo: number; both: number }> {
  const out = new Map<SourceId, { echo: number; both: number }>();
  for (const src of DEFAULT_SOURCES) {
    if (!src.artistTwin) continue;
    const twin = DEFAULT_SOURCES.find((x) => x.id === src.artistTwin)!;
    const r = { echo: 0, both: 0 };
    for (const rec of Object.values(records)) {
      const a = rec.sources[src.id];
      const b = rec.sources[twin.id];
      if (a?.status !== 'found' || b?.status !== 'found') continue;
      const ka = sourceEntries(a, src.strictNames).map((e) => e.key);
      const kb = new Set(sourceEntries(b, twin.strictNames).map((e) => e.key));
      if (!ka.length || !kb.size) continue;
      r.both++;
      if (ka.every((k) => kb.has(k))) r.echo++;
    }
    out.set(src.id, r);
  }
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = (n: string) => argv.includes(n);
  const arg = (n: string) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
  const dryRun = flag('--dry-run');
  const limit = Number(arg('--limit') ?? Infinity);
  const parallel = Math.max(1, Number(arg('--parallel') ?? 3));
  const only = arg('--only')?.toLowerCase();
  const log = (s: string) => console.log(s);

  const songsText = await readText(SONGS);
  const indexText = await readText(INDEX);
  const genresText = await readText(GENRES);
  if (!songsText || !indexText) throw new Error('public/songs.json and public/beatmaps/index.json are needed');
  const songs = parseSongsList(songsText);
  const starter = readStarter(await readText(STARTER));
  const records: Record<string, GenreRecord> = parseGenresFile(genresText);
  const catalog = catalogSongs(songs, starter, songGenres(songs, indexText));

  if (flag('--echo')) {
    for (const [id, r] of echoRates(records)) log(`${id.padEnd(18)} echoes its artist answer on ${r.echo}/${r.both} songs${r.both ? ` (${(r.echo / r.both).toFixed(2)})` : ''}`);
    return;
  }
  if (flag('--report')) {
    log(summarize(catalog, records));
    return;
  }
  if (flag('--recombine')) {
    for (const r of Object.values(records)) Object.assign(r, recombine(r.sources));
  } else {
    const refresh = (arg('--refresh') ?? '').split(',').filter(Boolean) as SourceId[];
    for (const r of Object.values(records)) for (const id of refresh) delete r.sources[id];
    const todo = dueSongs(catalog, records, new Date(), limit, 0).filter((c) => !only || `${c.artist} ${c.title}`.toLowerCase().includes(only));
    log(`${catalog.length} catalog songs; ${todo.length} to look up${dryRun ? ' (dry run: nothing is written)' : ''}`);
    const http = genreHttp(log);
    let next = 0;
    let done = 0;
    const save = async () => {
      if (!dryRun) await writeFile(GENRES, renderGenresFile(genresText, records, new Date().toISOString()));
    };
    const worker = async () => {
      while (next < todo.length) {
        const c = todo[next++];
        const lines: string[] = [];
        const l = await lookupGenres(c, { http, previous: records[c.key] ?? null, log: (s) => lines.push(s) });
        putRecord(records, c, l);
        done++;
        log(`[${done}/${todo.length}] ${c.artist} - ${c.title}: ${l.genres.join(', ') || '-'}${l.moods ? `  (moods: ${l.moods.join(', ')})` : ''}${l.complete ? '' : '  [some sources failed]'}\n${lines.join('\n')}`);
        await save();
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker));
    log(`requests sent: ${JSON.stringify(Object.fromEntries(http.sent))}`);
  }

  if (!dryRun) {
    const now = new Date().toISOString();
    for (const c of catalog) {
      const r = records[c.key];
      if (r && !r.videoIds.includes(c.videoId)) r.videoIds.push(c.videoId);
    }
    await writeFile(GENRES, renderGenresFile(genresText, records, now));
    applyGenreLists(songs, records);
    await writeFile(SONGS, renderSongs(songsText, songs, now));
    const index = JSON.parse(indexText) as { analyzerVersion: string; songs: Record<string, { bpm: number; duration: number }> };
    const maps = new Map<string, MapInfo>(Object.entries(index.songs).map(([id, v]) => [id, { analyzerVersion: index.analyzerVersion, bpm: v.bpm, duration: v.duration }]));
    await writeFile(INDEX, renderIndex(indexText, index.analyzerVersion, maps, now, songGenres(songs, indexText), songGenreLists(songs, starter, records, indexText), songGenreMeta(songs, starter, records, indexText)));
  }
  log(`\n${summarize(catalog, records)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
