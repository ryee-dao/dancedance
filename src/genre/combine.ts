/**
 * Combine what the sources said into one ordered genre list, by agreement.
 *
 * Each source's names are first put in the common spelling (names.ts). Then
 * every genre any source reported gets a support score:
 *   - a source that reported it exactly adds its weight (1 for the
 *     encyclopedias, 0.8 MusicBrainz tags, 0.7 TheAudioDB, 0.6 iTunes);
 *   - a source that reported a broader or narrower form of it ("pop" for
 *     "dance-pop", or "nu metal" for "alternative metal") adds 0.3 x weight;
 *   - within one group of related sources (Wikipedia + Wikidata) only the
 *     strongest counts in full, the others half.
 * Score = support + 0.25 x specificity (0 family, 1 genre, 2 subgenre)
 *         + up to 0.1 for being listed early by a source.
 * So "nu metal" from two sources (about 2.0) beats a lone "rock" (1.0 plus a
 * little from related reports), and a genre from one source can still make
 * the list when nobody contradicts it. Genres are only ever taken from what
 * a source said exactly; relations only add weight.
 */
import { canonicalGenres, displayName, families, related, specificity } from './names';
import type { GenreSource, SourceId, SourceOutcome } from './types';

export const MAX_GENRES = 6;
export const RELATED_SHARE = 0.3;
export const SPECIFICITY_BONUS = 0.25;
export const SAME_GROUP_SHARE = 0.5;

export interface ScoredGenre {
  name: string;
  key: string;
  score: number;
  /** Sources that reported this genre exactly. */
  by: SourceId[];
}

export interface Combined {
  genres: string[];
  moods: string[];
  scored: ScoredGenre[];
}

type SourceInfo = Pick<GenreSource, 'id' | 'group' | 'weight' | 'strictNames'>;

export function combineGenres(outcomes: Partial<Record<SourceId, SourceOutcome>>, sources: readonly SourceInfo[], max = MAX_GENRES): Combined {
  const lists: { src: SourceInfo; keys: string[] }[] = [];
  const moods: string[] = [];
  for (const src of sources) {
    const o = outcomes[src.id];
    if (o?.status !== 'found') continue;
    const keys = canonicalGenres(o.genres, src.strictNames).map((g) => g.key);
    if (keys.length) lists.push({ src, keys });
    for (const m of o.moods ?? []) {
      const t = m.replace(/\s+/g, ' ').trim().toLowerCase();
      if (t && t.length <= 40 && /\p{L}{2}/u.test(t) && !moods.includes(t)) moods.push(t);
    }
  }
  const candidates = new Set(lists.flatMap((l) => l.keys));
  const scored: ScoredGenre[] = [];
  for (const g of candidates) {
    const byGroup = new Map<string, number[]>();
    const by: SourceId[] = [];
    let early = 0;
    for (const { src, keys } of lists) {
      const pos = keys.indexOf(g);
      let share = 0;
      if (pos >= 0) {
        share = 1;
        by.push(src.id);
        early = Math.max(early, 1 - pos / keys.length);
      } else if (keys.some((k) => related(k, g))) {
        share = RELATED_SHARE;
      }
      if (share > 0) {
        const list = byGroup.get(src.group) ?? [];
        list.push(share * src.weight);
        byGroup.set(src.group, list);
      }
    }
    let support = 0;
    for (const list of byGroup.values()) {
      list.sort((a, b) => b - a);
      list.forEach((v, i) => (support += i === 0 ? v : v * SAME_GROUP_SHARE));
    }
    const score = support + SPECIFICITY_BONUS * specificity(g) + 0.1 * early;
    scored.push({ name: displayName(g), key: g, score: Math.round(score * 1000) / 1000, by });
  }
  scored.sort((a, b) => b.score - a.score || b.by.length - a.by.length || a.key.localeCompare(b.key));
  return { genres: scored.slice(0, max).map((s) => s.name), moods, scored };
}

/** Broad families (pop, rock, hip hop...) each found source's genres belong to. */
export function sourceFamilies(outcomes: Partial<Record<SourceId, SourceOutcome>>, sources: readonly SourceInfo[]): Map<SourceId, Set<string>> {
  const out = new Map<SourceId, Set<string>>();
  for (const src of sources) {
    const o = outcomes[src.id];
    if (o?.status !== 'found') continue;
    const fams = new Set<string>();
    for (const g of canonicalGenres(o.genres, src.strictNames)) for (const f of families(g.key)) fams.add(f);
    if (fams.size) out.set(src.id, fams);
  }
  return out;
}

/**
 * Broad families grouped for the "do the sources even agree?" check: rock,
 * metal and punk are one camp; dance, electronic and disco another; hip hop,
 * R&B, soul, funk and gospel another; country, folk and blues another.
 * "alternative" says too little to disagree with anything.
 */
const CAMP: Record<string, string> = {
  rock: 'rock', metal: 'rock', punk: 'rock', industrial: 'rock',
  dance: 'dance', electronic: 'dance', disco: 'dance',
  'hip hop': 'urban', 'r&b': 'urban', soul: 'urban', funk: 'urban', gospel: 'urban',
  country: 'country', folk: 'country', blues: 'country',
};

/** Pairs of sources whose genres fall in no common camp at all (e.g. one says "rock", another "hip hop"). */
export function familyDisagreements(outcomes: Partial<Record<SourceId, SourceOutcome>>, sources: readonly SourceInfo[]): [SourceId, SourceId][] {
  const fams = [...sourceFamilies(outcomes, sources).entries()]
    .map(([id, set]) => [id, new Set([...set].filter((f) => f !== 'alternative').map((f) => CAMP[f] ?? f))] as const)
    .filter(([, set]) => set.size > 0);
  const out: [SourceId, SourceId][] = [];
  for (let i = 0; i < fams.length; i++) {
    for (let j = i + 1; j < fams.length; j++) {
      const [a, fa] = fams[i];
      const [b, fb] = fams[j];
      if (![...fa].some((f) => fb.has(f))) out.push([a, b]);
    }
  }
  return out;
}
