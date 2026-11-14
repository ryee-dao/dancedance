/// <reference types="node" />
/**
 * One-off / re-runnable backfill of the iTunes `primaryGenreName` for songs
 * that have no genre yet (songs.json and the starter-pack songs in index.json).
 *
 *   npx tsx tools/beatmaps/backfillGenres.ts [--dry-run] [--delay <ms>] [--limit <n>]
 *
 * Looks each song up by "artist title" (nothing else is sent), preferring the
 * result whose length is closest to the stored duration, and writes the genre
 * back with the project's own renderers (songs.json, index.json). Songs that
 * already have a genre are skipped, so it can be re-run. Waits ~3 s between
 * requests and backs off on HTTP 403/429. Beat-map files are never touched.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSongsList } from '../../src/beat/cloud';
import { itunesSearchUrl, parseItunes, pickOfficialLength, type OfficialSong, type ItunesTrack } from './itunes';
import { renderIndex, type MapInfo } from './output';
import { renderSongs } from './songs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SONGS = join(ROOT, 'public/songs.json');
const INDEX = join(ROOT, 'public/beatmaps/index.json');
const STARTER = join(ROOT, 'src/data/starter.json');

interface Target {
  videoId: string;
  artist: string;
  title: string;
  durationSec: number;
}
export interface Finding {
  target: Target;
  genre?: string;
  matched?: OfficialSong;
  problem?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch search results, retrying politely on 403 / 429 (honours Retry-After). */
async function search(term: string, log: (s: string) => void): Promise<ItunesTrack[] | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(itunesSearchUrl(term));
    if (res.status === 403 || res.status === 429) {
      const ra = Number(res.headers.get('retry-after'));
      const wait = Math.max(Number.isFinite(ra) ? ra * 1000 : 0, 30_000 * 2 ** attempt);
      log(`  HTTP ${res.status}; waiting ${Math.round(wait / 1000)} s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) return null;
    return parseItunes(await res.json());
  }
  return null;
}

/** pickOfficialLength picks the most common length; here the closest to the stored one wins. */
export function pickClosest(t: Target, tracks: ItunesTrack[]): OfficialSong | null {
  const matches: OfficialSong[] = [];
  const seen = new Set<number>();
  let rest = tracks;
  for (let i = 0; i < 10; i++) {
    const m = pickOfficialLength(t, rest);
    if (!m) break;
    if (!seen.has(m.durationSec)) matches.push(m);
    seen.add(m.durationSec);
    rest = rest.filter((x) => !x.trackTimeMillis || Math.abs(Math.round(x.trackTimeMillis / 1000) - m.durationSec) > 2);
  }
  // Prefer a genre-bearing candidate; among those the closest length.
  return matches.filter((m) => m.genre).sort((a, b) => Math.abs(a.durationSec - t.durationSec) - Math.abs(b.durationSec - t.durationSec))[0] ?? matches[0] ?? null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const arg = (n: string) => (argv.includes(n) ? Number(argv[argv.indexOf(n) + 1]) : undefined);
  const delay = arg('--delay') ?? 3000;
  const limit = arg('--limit') ?? Infinity;
  const log = (s: string) => console.log(s);

  const songsText = await readFile(SONGS, 'utf8');
  const indexText = await readFile(INDEX, 'utf8');
  const songs = parseSongsList(songsText);
  const index = JSON.parse(indexText) as { analyzerVersion: string; songs: Record<string, { bpm: number; duration: number; genre?: string }> };
  const starter = JSON.parse(await readFile(STARTER, 'utf8')) as { videoId: string; title: string; artist: string }[];
  const starterById = new Map(starter.map((s) => [s.videoId, s]));
  const listed = new Set(songs.map((s) => s.videoId));

  const targets: Target[] = [];
  for (const s of songs) if (!s.genre) targets.push({ videoId: s.videoId, artist: s.artist, title: s.title, durationSec: s.durationSec });
  for (const [id, v] of Object.entries(index.songs)) {
    if (listed.has(id) || v.genre) continue;
    const st = starterById.get(id);
    if (!st) { log(`${id}: in index.json but no artist/title known; skipped`); continue; }
    targets.push({ videoId: id, artist: st.artist, title: st.title, durationSec: v.duration });
  }
  log(`${targets.length} songs without a genre${dryRun ? ' (dry run: nothing is written)' : ''}`);

  const found = new Map<string, string>();
  const findings: Finding[] = [];
  let n = 0;
  for (const t of targets.slice(0, limit)) {
    if (n++) await sleep(delay);
    const tracks = await search(`${t.artist} ${t.title}`, log);
    const m = tracks ? pickClosest(t, tracks) : null;
    const f: Finding = { target: t, ...(m ? { matched: m } : {}) };
    if (!tracks) f.problem = 'request failed';
    else if (!m) f.problem = 'no match';
    else {
      const diff = Math.abs(m.durationSec - t.durationSec);
      if (!m.genre) f.problem = 'match has no genre';
      else f.genre = m.genre;
      if (diff > 10) f.problem = `length differs by ${diff} s (${m.durationSec} vs ${t.durationSec})`;
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm(m.artist) !== norm(t.artist)) f.problem = `${f.problem ? `${f.problem}; ` : ''}artist differs: ${m.artist}`;
    }
    if (f.genre) found.set(t.videoId, f.genre);
    findings.push(f);
    log(`${t.videoId} ${t.artist} - ${t.title}: ${f.genre ?? '-'}${f.problem ? `  [CHECK: ${f.problem}]` : ''}`);
  }

  if (!dryRun && found.size) {
    for (const s of songs) if (!s.genre && found.has(s.videoId)) s.genre = found.get(s.videoId);
    const now = new Date().toISOString();
    await writeFile(SONGS, renderSongs(songsText, songs, now));
    const maps = new Map<string, MapInfo>(Object.entries(index.songs).map(([id, v]) => [id, { analyzerVersion: index.analyzerVersion, bpm: v.bpm, duration: v.duration }]));
    const genres = new Map<string, string>();
    for (const [id, v] of Object.entries(index.songs)) if (v.genre) genres.set(id, v.genre);
    for (const [id, g] of found) genres.set(id, g);
    await writeFile(INDEX, renderIndex(indexText, index.analyzerVersion, maps, now, genres));
  }

  const counts: Record<string, number> = {};
  for (const g of found.values()) counts[g] = (counts[g] ?? 0) + 1;
  log(`\ngenres found: ${found.size}/${findings.length}`);
  log(JSON.stringify(counts));
  log('to check by hand:');
  for (const f of findings.filter((x) => x.problem)) log(`  ${f.target.videoId} ${f.target.artist} - ${f.target.title} (${f.target.durationSec} s): ${f.problem}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
