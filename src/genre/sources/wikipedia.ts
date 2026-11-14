/**
 * English Wikipedia: the `genre` field of the song's own infobox.
 *
 * 1. One request asks for the usual article titles at once, with their lead
 *    section: "Title (Artist song)", "Title (song)", "Title" (redirects
 *    followed; disambiguation pages recognised).
 * 2. Only if none of those is the song: a full-text search, and one more
 *    request for the lead sections of up to three hits whose title is the
 *    song's title.
 *
 * A page counts only when its lead has an `Infobox song` (or single) whose
 * `artist` is the requested artist and whose name is the requested title,
 * and neither names a version the request did not ask for. Album and EP
 * pages, list pages, other artists' songs of the same name and
 * disambiguation pages are rejected; then the answer is 'none'.
 */
import { creditMatches, primaryArtist, queryTitle, titleMatches, unaskedVersion, type SongQuery } from '../match';
import type { GenreSource, PoliteHttp, SourceAnswer } from '../types';
import { isDisambiguation, listItems, parseInfoboxes, plainText } from './wikitext';

const API = 'https://en.wikipedia.org/w/api.php';

function api(params: Record<string, string>): string {
  return `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
}

/** Article titles to try, best first (also used as the request's `titles`). */
export function titleForms(song: SongQuery): string[] {
  const t = queryTitle(song.title);
  const artists = [...new Set([primaryArtist(song.artist), song.artist.trim()])].filter(Boolean);
  return [...new Set([...artists.map((a) => `${t} (${a} song)`), `${t} (song)`, t])];
}

export function pagesUrl(titles: string[]): string {
  return api({
    action: 'query',
    redirects: '1',
    prop: 'pageprops|revisions',
    ppprop: 'disambiguation',
    rvprop: 'content',
    rvslots: 'main',
    rvsection: '0',
    titles: titles.join('|'),
  });
}

export function searchUrl(song: SongQuery): string {
  return api({ action: 'query', list: 'search', srnamespace: '0', srlimit: '6', srprop: '', srsearch: `${queryTitle(song.title)} ${primaryArtist(song.artist)} song` });
}

export interface WikiPage {
  title: string;
  missing: boolean;
  disambiguation: boolean;
  content: string;
}

/** Parse a `prop=revisions` answer: requested title -> page (after redirects and normalisation). */
export function parsePages(json: unknown): Map<string, WikiPage> {
  const q = (json as { query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages?: unknown[] } } | null)?.query;
  const pages = new Map<string, WikiPage>();
  for (const raw of q?.pages ?? []) {
    const p = (raw ?? {}) as { title?: unknown; missing?: unknown; invalid?: unknown; pageprops?: { disambiguation?: unknown }; revisions?: { slots?: { main?: { content?: unknown } } }[] };
    if (typeof p.title !== 'string') continue;
    const content = p.revisions?.[0]?.slots?.main?.content;
    const text = typeof content === 'string' ? content : '';
    pages.set(p.title, {
      title: p.title,
      missing: !!p.missing || !!p.invalid,
      disambiguation: (p.pageprops?.disambiguation !== undefined) || isDisambiguation(text),
      content: text,
    });
  }
  const follow = (t: string) => {
    let cur = t;
    for (const n of q?.normalized ?? []) if (n.from === cur) cur = n.to;
    for (let i = 0; i < 3; i++) {
      const r = (q?.redirects ?? []).find((x) => x.from === cur);
      if (!r) break;
      cur = r.to;
    }
    return cur;
  };
  const out = new Map<string, WikiPage>();
  const requested = new Set<string>([...pages.keys(), ...(q?.normalized ?? []).map((n) => n.from), ...(q?.redirects ?? []).map((r) => r.from)]);
  for (const t of requested) {
    const page = pages.get(follow(t));
    if (page) out.set(t, page);
  }
  return out;
}

export function parseSearch(json: unknown): string[] {
  const hits = (json as { query?: { search?: { title?: unknown }[] } } | null)?.query?.search;
  return Array.isArray(hits) ? hits.map((h) => h?.title).filter((t): t is string => typeof t === 'string') : [];
}

/** "Billie Jean (song)" -> "Billie Jean"; "TV (Billie Eilish song)" -> "TV". */
export function baseTitle(pageTitle: string): string {
  return pageTitle.replace(/\s*\((?:[^()]*\s)?(?:song|single)\)\s*$/i, '').trim();
}

export type PageVerdict = { ok: true; genres: string[] } | { ok: false; reason: string };

/** Is this page THIS song by this artist? If so, its infobox genres (possibly none). */
export function checkPage(song: SongQuery, page: WikiPage): PageVerdict {
  if (page.missing) return { ok: false, reason: 'no such page' };
  if (page.disambiguation) return { ok: false, reason: 'disambiguation page' };
  const boxes = parseInfoboxes(page.content);
  const songBoxes = boxes.filter((b) => /^infobox (?:song|single)\b/.test(b.kind));
  if (!songBoxes.length) {
    const kind = boxes[0]?.kind.replace(/^infobox /, '') ?? 'no infobox';
    const type = plainText(boxes[0]?.params.type);
    return { ok: false, reason: `not a song article (${kind}${type ? `: ${type}` : ''})` };
  }
  const base = baseTitle(page.title);
  let reason = 'by another artist';
  for (const b of songBoxes) {
    const artistNames = listItems(b.params.artist).flatMap((n) => [n.label, n.target]);
    if (!creditMatches(song.artist, artistNames, plainText(b.params.artist))) continue;
    const name = plainText(b.params.name) || base;
    if (!titleMatches(song.title, name) && !titleMatches(song.title, base)) {
      reason = `another song by the artist (${name})`;
      continue;
    }
    if (unaskedVersion(song, name, page.title, plainText(b.params.type))) {
      reason = `another version (${name})`;
      continue;
    }
    const genres = listItems(b.params.genre).map((n) => pickName(n.label, n.target));
    return { ok: true, genres };
  }
  return { ok: false, reason };
}

/** [[Hip hop music|hip-hop]]: the label, unless it is empty or just a pronoun-like word. */
function pickName(label: string, target: string): string {
  return label && label.length >= 2 ? label : target;
}

async function fetchPages(http: PoliteHttp, titles: string[]): Promise<Map<string, WikiPage>> {
  return parsePages(await http.getJson(pagesUrl(titles)));
}

export const wikipedia: GenreSource = {
  id: 'wikipedia',
  group: 'wikimedia',
  weight: 1,
  async lookup(song, http): Promise<SourceAnswer> {
    const forms = titleForms(song);
    const pages = await fetchPages(http, forms);
    const checked = new Set<string>();
    const reasons: string[] = [];
    const tryPage = (p: WikiPage | undefined): SourceAnswer | null => {
      if (!p || checked.has(p.title)) return null;
      checked.add(p.title);
      const v = checkPage(song, p);
      if (v.ok) return v.genres.length ? { status: 'found', genres: v.genres, ref: p.title } : { status: 'none', reason: 'the article lists no genre', ref: p.title };
      if (!p.missing) reasons.push(`${p.title}: ${v.reason}`);
      return null;
    };
    for (const f of forms) {
      const r = tryPage(pages.get(f));
      if (r) return r;
    }
    const hits = parseSearch(await http.getJson(searchUrl(song)))
      .filter((t) => !checked.has(t) && titleMatches(song.title, baseTitle(t)))
      .slice(0, 3);
    if (hits.length) {
      const more = await fetchPages(http, hits);
      for (const t of hits) {
        const r = tryPage(more.get(t));
        if (r) return r;
      }
    }
    return { status: 'none', reason: reasons.length ? `no article about this song (${reasons.slice(0, 3).join('; ')})` : 'no article about this song' };
  },
};
