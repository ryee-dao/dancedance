/**
 * Wikidata: the "genre" (P136) statements of the song's item, found on its
 * own (not through Wikipedia):
 *
 * 1. `wbsearchentities` for the title (up to 50 items); keep items whose
 *    label or alias is the title and whose description does not say it is
 *    something else (an album, a film, a disambiguation page...).
 * 2. `wbgetentities` (claims) for up to 8 of them; keep items that are a
 *    song, single, musical work or track (P31).
 * 3. `wbgetentities` (labels) for their performers (P175) and genres.
 *
 * An item counts only when a performer's label is the requested artist and
 * its label/description names no version the request did not ask for.
 */
import { creditMatches, queryTitle, titleMatches, unaskedVersion } from '../match';
import type { GenreSource, SourceAnswer } from '../types';

const API = 'https://www.wikidata.org/w/api.php';

function api(params: Record<string, string>): string {
  return `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
}

/** "Instance of" values that mean a song-like item. */
export const SONG_TYPES = new Set([
  'Q7366', // song
  'Q134556', // single
  'Q105543609', // musical work/composition
  'Q2188189', // musical work
  'Q207628', // musical composition
  'Q55850593', // music track with vocals
  'Q55850643', // music track without vocals
  'Q7302866', // audio track
]);

const NOT_A_SONG = /\b(?:album|EP|extended play|compilation|disambiguation|film|movie|television|TV series|series|episode|novel|book|video game|magazine|company|band|group|human|person|family name|given name|surname|painting|play|musical|tour|concert|soundtrack album|mixtape|live album)\b/i;

export function searchUrl(title: string): string {
  return api({ action: 'wbsearchentities', language: 'en', uselang: 'en', type: 'item', limit: '50', search: queryTitle(title) });
}

export function entitiesUrl(ids: string[], props: 'claims|labels|descriptions' | 'labels'): string {
  return api({ action: 'wbgetentities', ids: ids.join('|'), props, languages: 'en', languagefallback: '1' });
}

export interface SearchHit {
  id: string;
  label: string;
  description: string;
  matchText: string;
}

export function parseSearch(json: unknown): SearchHit[] {
  const list = (json as { search?: unknown[] } | null)?.search;
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const r = (raw ?? {}) as { id?: unknown; label?: unknown; description?: unknown; match?: { text?: unknown } };
      return {
        id: typeof r.id === 'string' ? r.id : '',
        label: typeof r.label === 'string' ? r.label : '',
        description: typeof r.description === 'string' ? r.description : '',
        matchText: typeof r.match?.text === 'string' ? r.match.text : '',
      };
    })
    .filter((h) => /^Q\d+$/.test(h.id));
}

const SONGISH = /\b(?:song|single|track|recording|composition|anthem)\b/i;

/**
 * Search hits worth fetching: the label (or matched alias) is the title, and
 * the description, when there is one, says it is a song, single or track
 * (and not an album, film...). Songs and singles first.
 */
export function songCandidates(title: string, hits: SearchHit[], max = 6): SearchHit[] {
  const ok = hits.filter((h) => {
    if (!titleMatches(title, h.label) && !titleMatches(title, h.matchText)) return false;
    if (!h.description) return true;
    return SONGISH.test(h.description) && !(NOT_A_SONG.test(h.description) && !/\b(?:song|single)\b/i.test(h.description));
  });
  const rank = (h: SearchHit) => (/\b(?:song|single)\b/i.test(h.description) ? 0 : h.description ? 1 : 2);
  return ok.sort((a, b) => rank(a) - rank(b)).slice(0, max);
}

export interface ItemClaims {
  id: string;
  label: string;
  description: string;
  instanceOf: string[];
  performers: string[];
  genres: string[];
}

function claimIds(claims: Record<string, unknown> | undefined, prop: string): string[] {
  const list = claims?.[prop];
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const c of list) {
    const snak = (c as { mainsnak?: { datavalue?: { value?: { id?: unknown } } }; rank?: unknown })?.mainsnak;
    const id = snak?.datavalue?.value?.id;
    if (typeof id === 'string' && (c as { rank?: unknown }).rank !== 'deprecated') out.push(id);
  }
  return out;
}

const enText = (o: unknown): string => {
  const v = (o as { en?: { value?: unknown } } | undefined)?.en?.value;
  if (typeof v === 'string') return v;
  // languagefallback may answer in another key
  const first = o && typeof o === 'object' ? Object.values(o as Record<string, { value?: unknown }>)[0]?.value : undefined;
  return typeof first === 'string' ? first : '';
};

export function parseClaims(json: unknown): ItemClaims[] {
  const ents = (json as { entities?: Record<string, unknown> } | null)?.entities;
  if (!ents || typeof ents !== 'object') return [];
  const out: ItemClaims[] = [];
  for (const [id, raw] of Object.entries(ents)) {
    const e = (raw ?? {}) as { claims?: Record<string, unknown>; labels?: unknown; descriptions?: unknown; missing?: unknown };
    if (e.missing !== undefined) continue;
    out.push({
      id,
      label: enText(e.labels),
      description: enText(e.descriptions),
      instanceOf: claimIds(e.claims, 'P31'),
      performers: claimIds(e.claims, 'P175'),
      genres: claimIds(e.claims, 'P136'),
    });
  }
  return out;
}

export function parseLabels(json: unknown): Map<string, string> {
  const ents = (json as { entities?: Record<string, { labels?: unknown }> } | null)?.entities;
  const out = new Map<string, string>();
  if (!ents || typeof ents !== 'object') return out;
  for (const [id, e] of Object.entries(ents)) {
    const l = enText(e?.labels);
    if (l) out.set(id, l);
  }
  return out;
}

export const wikidata: GenreSource = {
  id: 'wikidata',
  group: 'wikimedia',
  weight: 1,
  async lookup(song, http): Promise<SourceAnswer> {
    const cands = songCandidates(song.title, parseSearch(await http.getJson(searchUrl(song.title))));
    if (!cands.length) return { status: 'none', reason: 'no item with this title' };
    const items = parseClaims(await http.getJson(entitiesUrl(cands.map((c) => c.id), 'claims|labels|descriptions'))).filter((i) => i.instanceOf.some((t) => SONG_TYPES.has(t)));
    if (!items.length) return { status: 'none', reason: 'no song item with this title' };
    const need = [...new Set(items.flatMap((i) => [...i.performers, ...i.genres]))].slice(0, 50);
    const labels = need.length ? parseLabels(await http.getJson(entitiesUrl(need, 'labels'))) : new Map<string, string>();
    const desc = new Map(cands.map((c) => [c.id, c.description]));
    const confirmed = items.filter((i) => {
      const names = i.performers.map((p) => labels.get(p) ?? '').filter(Boolean);
      const description = i.description || desc.get(i.id) || '';
      return names.length > 0 && creditMatches(song.artist, names) && !unaskedVersion(song, i.label, description);
    });
    if (!confirmed.length) return { status: 'none', reason: 'no song item by this artist' };
    // Songs and singles before tracks/recordings; then the items with genres.
    const rank = (i: ItemClaims) => (i.instanceOf.some((t) => t === 'Q7366' || t === 'Q134556') ? 0 : 1);
    confirmed.sort((a, b) => rank(a) - rank(b));
    const genres: string[] = [];
    const refs: string[] = [];
    for (const i of confirmed) {
      const g = i.genres.map((id) => labels.get(id)).filter((x): x is string => !!x);
      if (g.length) refs.push(i.id);
      for (const x of g) if (!genres.includes(x)) genres.push(x);
    }
    const ref = (refs.length ? refs : confirmed.map((i) => i.id)).join(',');
    return genres.length ? { status: 'found', genres, ref } : { status: 'none', reason: 'the item has no genre', ref };
  },
};
