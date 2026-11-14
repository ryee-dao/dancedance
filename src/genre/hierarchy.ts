/**
 * The genre vocabulary's own structure, read from vocab.json (generated
 * mechanically by tools/beatmaps/genreVocab.ts from Wikidata's "subclass of"
 * graph of music genres and the MusicBrainz genre list; nothing in it is
 * written by hand). Pure.
 *
 * Used for:
 *  - specificity: how narrow a genre is (combine.ts ranks narrow genres a
 *    song-level source reports above broad umbrellas many sources repeat);
 *  - ancestry: "cumbia" is a kind of "tropical music", which is a kind of
 *    "Latin music", so a broad report supports the narrow one and the narrow
 *    one is never ranked under its own umbrella;
 *  - genre-like user tags: a crowd tag counts as a genre name when the
 *    MusicBrainz genre list or Wikidata knows it.
 *
 * The hand-written family tree in names.ts (genres only, never artists) is
 * the other half: both are consulted, so a relation either one knows counts.
 */
import vocab from './vocab.json';

interface Vocab {
  mb: string[];
  wd: [string, number, number, number[]][];
  alias: Record<string, number>;
}

const V = vocab as unknown as Vocab;
const INDEX = new Map<string, number>(V.wd.map((n, i) => [n[0], i]));
const MB = new Set(V.mb);
const N = V.wd.length;
const LOG_N = Math.log(1 + N);

/** Depth at which a genre counts as fully specific (longest subclass chain). */
const DEPTH_FULL = 5;

/** Index of a key's Wikidata genre (by label, then by alias), or -1. */
function nodeOf(key: string): number {
  const i = INDEX.get(key);
  if (i !== undefined) return i;
  const a = V.alias[key];
  return typeof a === 'number' ? a : -1;
}

/** Whether Wikidata knows this key as a music genre (label or alias). */
export function wdKnows(key: string): boolean {
  return nodeOf(key) >= 0;
}

/** Whether MusicBrainz's genre list has this key. */
export function mbKnows(key: string): boolean {
  return MB.has(key);
}

const ancCache = new Map<number, Set<string>>();
function ancestorsOfNode(i: number): Set<string> {
  let out = ancCache.get(i);
  if (out) return out;
  out = new Set<string>();
  const seen = new Set<number>([i]);
  const stack = [...V.wd[i][3]];
  while (stack.length) {
    const p = stack.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    out.add(V.wd[p][0]);
    stack.push(...V.wd[p][3]);
  }
  ancCache.set(i, out);
  return out;
}

/** Broader genres of `key` per Wikidata (keys, not including itself); empty when unknown. */
export function wdAncestors(keys: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const k of keys) {
    const i = nodeOf(k);
    if (i >= 0) for (const a of ancestorsOfNode(i)) out.add(a);
  }
  return out;
}

/** The Wikidata key a spelling resolves to (its label key), or null. */
export function wdKey(key: string): string | null {
  const i = nodeOf(key);
  return i >= 0 ? V.wd[i][0] : null;
}

/**
 * How specific a genre is, 0 (an umbrella such as "pop music" or "Latin
 * music") to 1 (a leaf such as "nu metal"), from Wikidata's graph: half the
 * longest subclass chain above it (capped at DEPTH_FULL), half its intrinsic
 * information content 1 - log(1 + subgenres) / log(1 + all genres) (Seco et
 * al.: umbrellas with hundreds of subgenres say little). Null when Wikidata
 * does not know the name.
 */
export function wdSpecificity(key: string): number | null {
  const i = nodeOf(key);
  if (i < 0) return null;
  const [, depth, desc] = V.wd[i];
  const ic = 1 - Math.log(1 + desc) / LOG_N;
  return 0.5 * (Math.min(depth, DEPTH_FULL) / DEPTH_FULL) + 0.5 * ic;
}
