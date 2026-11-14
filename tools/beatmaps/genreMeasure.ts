/// <reference types="node" />
/**
 * Measure the genre lookup (src/genre) on the saved evaluation run, whose
 * songs carry a researched consensus written before any lookup ran.
 *
 *   npx tsx tools/beatmaps/genreMeasure.ts --lookup [--run <dir>] [--only <text>]
 *       looks every sampled song up again with the current sources (the run's
 *       stored answers serve as the cache, so only new or changed sources are
 *       asked) -> <dir>/genre-lookups-levels.json
 *   npx tsx tools/beatmaps/genreMeasure.ts --report [--run <dir>]
 *       before (genre-lookups.json as saved) / after (recombined from
 *       genre-lookups-levels.json): per-source and per-level hit rates for the
 *       known and obscure halves, and how often the top entries agree with
 *       the consensus.
 *
 *   npx tsx tools/beatmaps/genreMeasure.ts --grid [--run <dir>] [--catalog-before <old genres.json>]
 *       the same agreement numbers for a few values of the two ranking
 *       weights (combine.ts RankWeights), and on the catalog how often the
 *       first entry stays the same as (or a form of) the list in an older
 *       public/genres.json: a check that a weight good for the sample does
 *       not make the catalog worse.
 *
 * Default run: tools/eval/data/run-20261113.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { combineGenres, DEFAULT_SOURCES, lookupGenres, parseGenreLookup, recombine, type GenreLookup, type SourceId } from '../../src/genre';
import type { RankWeights } from '../../src/genre/combine';
import { broaderThan, canonicalGenre, families, keyOf, related } from '../../src/genre/names';
import { genreHttp } from './genreClient';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

interface Sampled {
  key: string;
  half: 'known' | 'obscure';
  artist: string;
  title: string;
  collection?: string;
  genre?: string;
  durationSec: number;
}

interface Consensus {
  family?: string;
  sub?: string;
  line: string;
}

const readJson = <T>(p: string, dflt: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : dflt);

/** The names a consensus mentions, as canonical keys ("Latin / cumbia (Mexican sonidera)" -> latin, cumbia, ...). */
export function consensusKeys(c: Consensus, part: 'all' | 'sub' = 'all'): Set<string> {
  const out = new Set<string>();
  const text = (part === 'sub' ? [c.sub] : [c.family, c.sub]).filter(Boolean).join(' / ');
  for (const part of text.split(/[/,;()]|\bwith\b|\band\b|\bor\b/i)) {
    const t = part.trim();
    if (!t) continue;
    const g = canonicalGenre(t, false);
    if (g?.known) out.add(g.key);
    // Also every known genre named inside a longer phrase ("melodic punk rock (Slovak)" -> punk).
    const words = keyOf(t).split(' ');
    for (let i = 0; i < words.length; i++)
      for (let j = Math.min(words.length, i + 4); j > i; j--) {
        const k = canonicalGenre(words.slice(i, j).join(' '), false);
        if (k?.known) out.add(k.key);
      }
  }
  return out;
}

/**
 * Does a list entry agree with the consensus? 'sub': it is one of the
 * consensus's specific genres (its `sub` part) or a narrower form of one;
 * 'exact' / 'related': one of all its genres or a broader / narrower form;
 * 'family': the same broad family.
 */
export function agrees(entry: string, c: Consensus): 'sub' | 'exact' | 'related' | 'family' | null {
  const g = canonicalGenre(entry, false);
  if (!g) return null;
  const sub = consensusKeys(c, 'sub');
  if (sub.has(g.key) || [...sub].some((k) => broaderThan(k, g.key))) return 'sub';
  const keys = consensusKeys(c);
  if (keys.has(g.key)) return 'exact';
  if ([...keys].some((k) => related(k, g.key))) return 'related';
  const fam = new Set([...keys].flatMap((k) => families(k)));
  if (families(g.key).some((f) => fam.has(f))) return 'family';
  return null;
}

async function lookupAll(dir: string, only?: string): Promise<void> {
  const sample = readJson<{ songs: Sampled[] }>(join(dir, 'sample.json'), { songs: [] }).songs;
  const before = readJson<Record<string, unknown>>(join(dir, 'genre-lookups.json'), {});
  const outPath = join(dir, 'genre-lookups-levels.json');
  const after = readJson<Record<string, GenreLookup>>(outPath, {});
  const http = genreHttp((l) => console.error(`  http: ${l}`));
  for (const s of sample) {
    if (only && !`${s.artist} ${s.title}`.toLowerCase().includes(only.toLowerCase())) continue;
    const previous = parseGenreLookup(after[s.key]) ?? parseGenreLookup(before[s.key]);
    const lines: string[] = [];
    const l = await lookupGenres(
      { artist: s.artist, title: s.title, durationSec: s.durationSec, ...(s.genre ? { itunesGenre: s.genre } : {}), ...(s.collection ? { album: s.collection } : {}) },
      { http, previous, log: (x) => lines.push(x) },
    );
    after[s.key] = l;
    console.error(`${s.artist} - ${s.title}\n${lines.join('\n')}\n  => ${l.genres.map((g, i) => `${g} [${l.genreLevels?.[i]}]`).join(', ') || '-'} | artist: ${l.artistGenres?.join(', ') ?? '-'}${l.complete ? '' : ' [some failed]'}`);
    writeFileSync(outPath, `${JSON.stringify(after, null, 2)}\n`);
  }
  console.error(`requests sent: ${JSON.stringify(Object.fromEntries(http.sent))}`);
}

function pct(n: number, d: number): string {
  return d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : '-';
}

export function report(dir: string): string {
  const sample = readJson<{ songs: Sampled[] }>(join(dir, 'sample.json'), { songs: [] }).songs;
  const exp = readJson<Record<string, { consensus?: Consensus }>>(join(dir, 'expectations.json'), {});
  const beforeRaw = readJson<Record<string, unknown>>(join(dir, 'genre-lookups.json'), {});
  const afterRaw = readJson<Record<string, unknown>>(join(dir, 'genre-lookups-levels.json'), {});
  const lines: string[] = [];
  for (const half of ['known', 'obscure'] as const) {
    const songs = sample.filter((s) => s.half === half);
    lines.push(`\n== ${half} half (${songs.length} songs)`);
    lines.push('per source: found (before -> after)');
    for (const src of DEFAULT_SOURCES) {
      const count = (raw: Record<string, unknown>) => songs.filter((s) => parseGenreLookup(raw[s.key])?.sources[src.id as SourceId]?.status === 'found').length;
      lines.push(`  ${src.level.padEnd(6)} ${src.id.padEnd(18)} ${String(count(beforeRaw)).padStart(2)} -> ${count(afterRaw)}`);
    }
    for (const level of ['song', 'album', 'artist'] as const) {
      const any = (raw: Record<string, unknown>, besides?: SourceId) =>
        songs.filter((s) => {
          const l = parseGenreLookup(raw[s.key]);
          return DEFAULT_SOURCES.some((src) => src.level === level && src.id !== besides && l?.sources[src.id]?.status === 'found');
        }).length;
      lines.push(`  any ${level}-level source: ${any(beforeRaw)} -> ${any(afterRaw)}${level === 'song' ? `; besides iTunes: ${any(beforeRaw, 'itunes')} -> ${any(afterRaw, 'itunes')}` : ''}`);
    }
    const nonEmpty = (raw: Record<string, unknown>, field: 'genres' | 'artistGenres') => songs.filter((s) => (parseGenreLookup(raw[s.key])?.[field]?.length ?? 0) > 0).length;
    lines.push(`  songs with a genres list: ${nonEmpty(beforeRaw, 'genres')} -> ${nonEmpty(afterRaw, 'genres')}; with artistGenres: ${nonEmpty(beforeRaw, 'artistGenres')} -> ${nonEmpty(afterRaw, 'artistGenres')}`);
    lines.push(`  more than one name in the list: ${songs.filter((s) => (parseGenreLookup(beforeRaw[s.key])?.genres.length ?? 0) > 1).length} -> ${songs.filter((s) => (parseGenreLookup(afterRaw[s.key])?.genres.length ?? 0) > 1).length}`);
  }
  // Agreement with the researched consensus.
  lines.push('\n== top entries vs the researched consensus (songs with a consensus)');
  const judged = sample.filter((s) => exp[s.key]?.consensus);
  for (const [label, raw] of [['before', beforeRaw], ['after', afterRaw]] as const) {
    let first = 0;
    let firstSpecific = 0;
    let two = 0;
    let both = 0;
    let subTop2 = 0;
    let subFirst = 0;
    for (const s of judged) {
      const l = parseGenreLookup(raw[s.key]);
      const c = exp[s.key]!.consensus!;
      const top = (label === 'after' && l ? recombine(l.sources).genres : l?.genres ?? []).slice(0, 2);
      const a = top.map((g) => agrees(g, c));
      if (a[0]) first++;
      if (a[0] === 'sub' || a[0] === 'exact' || a[0] === 'related') firstSpecific++;
      if (a[0] === 'sub') subFirst++;
      if (a.includes('sub')) subTop2++;
      if (a.some(Boolean)) two++;
      if (top.length === 2 ? a.every(Boolean) : !!a[0]) both++;
    }
    lines.push(`  ${label.padEnd(6)} #1 agrees ${pct(first, judged.length)}; #1 names the consensus genre or a form of it ${pct(firstSpecific, judged.length)}; one of top two agrees ${pct(two, judged.length)}; both of the top two agree ${pct(both, judged.length)}; the consensus's specific genre (or a narrower one) is #1 ${pct(subFirst, judged.length)}, in the top two ${pct(subTop2, judged.length)}`);
  }
  lines.push('\n== lists (before | after [levels] | artist)');
  for (const s of sample) {
    const b = parseGenreLookup(beforeRaw[s.key]);
    const a = parseGenreLookup(afterRaw[s.key]);
    const r = a ? recombine(a.sources) : null;
    const c = exp[s.key]?.consensus;
    lines.push(`  [${s.half}] ${s.artist} - ${s.title}${c ? `  (consensus: ${c.family} / ${c.sub})` : ''}`);
    lines.push(`      before: ${b?.genres.join(', ') || '-'}`);
    lines.push(`      after:  ${r?.genres.map((g, i) => `${g} [${r.genreLevels?.[i]}]`).join(', ') || '-'}   artist: ${r?.artistGenres?.join(', ') || '-'}`);
  }
  return lines.join('\n');
}

/** Agreement of the top two with the consensus, for lists made with weights `w`. */
export function agreement(dir: string, w?: RankWeights): { first: number; subFirst: number; subTop2: number; n: number } {
  const sample = readJson<{ songs: Sampled[] }>(join(dir, 'sample.json'), { songs: [] }).songs;
  const exp = readJson<Record<string, { consensus?: Consensus }>>(join(dir, 'expectations.json'), {});
  const raw = readJson<Record<string, unknown>>(join(dir, 'genre-lookups-levels.json'), {});
  let first = 0;
  let subFirst = 0;
  let subTop2 = 0;
  let n = 0;
  for (const s of sample) {
    const c = exp[s.key]?.consensus;
    const l = parseGenreLookup(raw[s.key]);
    if (!c || !l) continue;
    n++;
    const top = combineGenres(l.sources, DEFAULT_SOURCES, 6, w).genres.slice(0, 2);
    const a = top.map((g) => agrees(g, c));
    if (a[0]) first++;
    if (a[0] === 'sub') subFirst++;
    if (a.includes('sub')) subTop2++;
  }
  return { first, subFirst, subTop2, n };
}

/** On the catalog: the new first entry is the old one, or a narrower / broader form of it. */
export function catalogStability(genresFile: string, beforeFile: string, w?: RankWeights): { same: number; related: number; n: number; changed: string[] } {
  const now = readJson<{ songs: Record<string, unknown> }>(genresFile, { songs: {} }).songs;
  const before = readJson<{ songs: Record<string, { artist: string; title: string; genres: string[] }> }>(beforeFile, { songs: {} }).songs;
  let same = 0;
  let rel = 0;
  let n = 0;
  const changed: string[] = [];
  for (const [k, b] of Object.entries(before)) {
    const l = parseGenreLookup(now[k]);
    if (!l || !b.genres?.length) continue;
    n++;
    const c = combineGenres(l.sources, DEFAULT_SOURCES, 6, w);
    const o = canonicalGenre(b.genres[0])?.key;
    const x = c.scored[0]?.key;
    if (o && o === x) same++;
    else if (o && x && related(o, x)) rel++;
    else changed.push(`${b.artist} - ${b.title}: ${b.genres.slice(0, 3).join(', ')}  ->  ${c.genres.slice(0, 3).map((g, i) => `${g}${c.levels[i] === 'album' ? ' [album]' : ''}`).join(', ')}`);
  }
  return { same, related: rel, n, changed };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (n: string) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
  const dir = resolve(ROOT, arg('--run') ?? 'tools/eval/data/run-20261113');
  if (argv.includes('--lookup')) await lookupAll(dir, arg('--only'));
  if (argv.includes('--report')) console.log(report(dir));
  if (argv.includes('--grid')) {
    const before = arg('--catalog-before');
    for (const specWeight of [0.3, 0.6])
      for (const positionDecay of [0, 0.3])
      for (const albumShare of [0.1, 0.3, 0.5])
      for (const umbrellaSpec of [0.35, 1]) {
        const w = { specWeight, positionDecay, albumShare, umbrellaSpec };
        const a = agreement(dir, w);
        const c = before ? catalogStability(join(ROOT, 'public/genres.json'), resolve(before), w) : null;
        console.log(
          `spec ${specWeight} decay ${positionDecay} album ${albumShare} umbrella<${umbrellaSpec}: sample #1 agrees ${a.first}/${a.n}, consensus genre #1 ${a.subFirst}/${a.n}, in top two ${a.subTop2}/${a.n}` +
            (c ? `; catalog #1 same ${c.same}/${c.n}, a form of the old #1 ${c.related}/${c.n}` : ''),
        );
      }
  }
  if (argv.includes('--catalog-changes')) {
    const c = catalogStability(join(ROOT, 'public/genres.json'), resolve(arg('--catalog-changes')!));
    console.log(`catalog #1 same ${c.same}/${c.n}, a form of the old #1 ${c.related}/${c.n}; changed:\n  ${c.changed.join('\n  ')}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
