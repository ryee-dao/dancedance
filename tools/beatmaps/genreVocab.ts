/// <reference types="node" />
/**
 * Regenerate src/genre/vocab.json: the genre vocabulary's own structure,
 * taken mechanically from two public lists (no hand-written order):
 *
 *  - Wikidata: every item that is an instance of "music genre" (Q188451),
 *    with its English label and aliases and its "subclass of" (P279)
 *    parents. From that graph each genre gets
 *      depth: the longest chain of subclass links up to a top genre, not
 *             counting regional groupings ("music of South Korea")
 *             ("cumbia" -> tropical music -> Latin music: deeper than
 *             "Latin pop" -> pop music, deeper than "pop music");
 *      desc:  how many genres are (transitively) subclasses of it
 *             ("pop music" 300+, "K-pop" 2): umbrella labels have many.
 *  - MusicBrainz: the curated genre list (/ws/2/genre/all), used to tell a
 *    genre-like user tag from junk.
 *
 *   npx tsx tools/beatmaps/genreVocab.ts            # fetch both and write the file
 *
 * Two requests in all, with the generic client name. The file is checked in;
 * rerun it now and then (the lists change slowly).
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keyOf } from '../../src/genre/names';
import { GENRE_USER_AGENT } from './genreClient';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'src/genre/vocab.json');

const SPARQL = 'https://query.wikidata.org/sparql';
/** Every music genre with its English label, aliases, sitelink count and subclass-of parents. */
const QUERY = `SELECT ?g ?l ?sl (GROUP_CONCAT(DISTINCT ?p; separator=" ") AS ?ps) (GROUP_CONCAT(DISTINCT ?a; separator="|") AS ?as) WHERE {
  ?g wdt:P31 wd:Q188451 . ?g rdfs:label ?l . FILTER(LANG(?l) = "en")
  ?g wikibase:sitelinks ?sl .
  OPTIONAL { ?g wdt:P279 ?p }
  OPTIONAL { ?g skos:altLabel ?a . FILTER(LANG(?a) = "en") }
} GROUP BY ?g ?l ?sl`;

export interface WdGenre {
  id: string;
  label: string;
  aliases: string[];
  sitelinks: number;
  parents: string[];
}

export interface VocabFile {
  generatedAt: string;
  about: string;
  /** MusicBrainz genre list, as keys (names.ts keyOf). */
  mb: string[];
  /** Wikidata genres: [key, depth, desc, parent indexes]. */
  wd: [string, number, number, number[]][];
  /** Extra spellings (Wikidata aliases) -> index into wd. */
  alias: Record<string, number>;
}

const MAX_DEPTH = 8;
const REGIONAL = /\bmusic of\b/i;

/** Build the compact vocabulary from the raw lists (pure; tested). */
export function buildVocab(genres: readonly WdGenre[], mbNames: readonly string[], now: string, keep: (g: WdGenre) => boolean = (g) => g.sitelinks >= 3): VocabFile {
  const byId = new Map(genres.map((g) => [g.id, g]));
  const kids = new Map<string, string[]>();
  for (const g of genres) for (const p of g.parents) if (byId.has(p)) kids.set(p, [...(kids.get(p) ?? []), g.id]);
  const descCache = new Map<string, number>();
  const desc = (id: string): number => {
    const c = descCache.get(id);
    if (c !== undefined) return c;
    const seen = new Set<string>();
    const stack = [...(kids.get(id) ?? [])];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x) || x === id) continue;
      seen.add(x);
      stack.push(...(kids.get(x) ?? []));
    }
    descCache.set(id, seen.size);
    return seen.size;
  };
  const depthCache = new Map<string, number>();
  const depth = (id: string, onPath = new Set<string>()): number => {
    const c = depthCache.get(id);
    if (c !== undefined) return c;
    if (onPath.has(id)) return 0;
    onPath.add(id);
    // Regional groupings ("music of South Korea") are places, not narrower genres: they do not add depth.
    const ps = (byId.get(id)?.parents ?? []).filter((p) => byId.has(p) && !REGIONAL.test(byId.get(p)!.label));
    const d = ps.length ? Math.min(MAX_DEPTH, 1 + Math.max(...ps.map((p) => depth(p, onPath)))) : 0;
    onPath.delete(id);
    depthCache.set(id, d);
    return d;
  };
  const mbKeys = new Set(mbNames.map(keyOf).filter(Boolean));
  // Kept: well-known genres (sitelinks), or ones MusicBrainz also lists; then all their ancestors.
  const kept = new Set<string>();
  for (const g of genres) if (keep(g) || mbKeys.has(keyOf(g.label))) kept.add(g.id);
  const stack = [...kept];
  while (stack.length) {
    const id = stack.pop()!;
    for (const p of byId.get(id)?.parents ?? []) if (byId.has(p) && !kept.has(p)) {
      kept.add(p);
      stack.push(p);
    }
  }
  // One node per key: the best-known item wins.
  const ids = [...kept].sort((a, b) => (byId.get(b)!.sitelinks - byId.get(a)!.sitelinks) || a.localeCompare(b));
  const index = new Map<string, number>();
  const keyIndex = new Map<string, number>();
  const nodes: { id: string; key: string }[] = [];
  for (const id of ids) {
    const key = keyOf(byId.get(id)!.label);
    if (!key || key.length > 50) continue;
    if (keyIndex.has(key)) {
      index.set(id, keyIndex.get(key)!);
      continue;
    }
    keyIndex.set(key, nodes.length);
    index.set(id, nodes.length);
    nodes.push({ id, key });
  }
  const wd: VocabFile['wd'] = nodes.map(({ id, key }) => {
    const parents = [...new Set((byId.get(id)!.parents ?? []).map((p) => index.get(p)).filter((i): i is number => i !== undefined && nodes[i].key !== key))].sort((a, b) => a - b);
    return [key, depth(id), desc(id), parents];
  });
  const alias: Record<string, number> = {};
  for (const id of ids) {
    const i = index.get(id);
    if (i === undefined) continue;
    for (const a of byId.get(id)!.aliases) {
      const k = keyOf(a);
      if (k && k.length <= 50 && !keyIndex.has(k) && !(k in alias)) alias[k] = i;
    }
  }
  const sortedAlias: Record<string, number> = {};
  for (const k of Object.keys(alias).sort()) sortedAlias[k] = alias[k];
  return {
    generatedAt: now,
    about: 'Generated by tools/beatmaps/genreVocab.ts from Wikidata (music genre items, P279 subclass of) and the MusicBrainz genre list. Do not edit by hand.',
    mb: [...mbKeys].sort(),
    wd,
    alias: sortedAlias,
  };
}

export function parseSparql(json: unknown): WdGenre[] {
  const rows = (json as { results?: { bindings?: Record<string, { value: string }>[] } })?.results?.bindings ?? [];
  const id = (u: string) => u.replace(/^.*\//, '');
  return rows.map((b) => ({
    id: id(b.g.value),
    label: b.l.value,
    sitelinks: Number(b.sl?.value ?? 0),
    parents: (b.ps?.value ?? '').split(' ').filter(Boolean).map(id),
    aliases: (b.as?.value ?? '').split('|').filter(Boolean),
  }));
}

async function main(): Promise<void> {
  const headers = { 'User-Agent': GENRE_USER_AGENT, Accept: 'application/sparql-results+json' };
  const wdRes = await fetch(`${SPARQL}?${new URLSearchParams({ query: QUERY })}`, { headers });
  if (!wdRes.ok) throw new Error(`Wikidata SPARQL: HTTP ${wdRes.status}`);
  const genres = parseSparql(await wdRes.json());
  await new Promise((r) => setTimeout(r, 1500));
  const mbRes = await fetch('https://musicbrainz.org/ws/2/genre/all?fmt=txt', { headers: { 'User-Agent': GENRE_USER_AGENT } });
  if (!mbRes.ok) throw new Error(`MusicBrainz genre list: HTTP ${mbRes.status}`);
  const mb = (await mbRes.text()).split('\n').map((s) => s.trim()).filter(Boolean);
  const vocab = buildVocab(genres, mb, new Date().toISOString());
  await writeFile(OUT, `${JSON.stringify(vocab)}\n`);
  console.log(`${genres.length} Wikidata genres -> ${vocab.wd.length} kept, ${Object.keys(vocab.alias).length} aliases; ${vocab.mb.length} MusicBrainz genres. Wrote ${OUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
