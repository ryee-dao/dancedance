/**
 * Wikipedia and Wikidata for the song's album and its artist. Each is found
 * through a link another source confirmed, best first:
 *
 *   album:  MusicBrainz's album (its Wikidata link) -> the item's genres
 *           (P136) and its English article; the song article's `album`
 *           link; else the store's album name as an article title
 *           ("Album (Artist album)", "Album (album)", "Album (EP)", "Album")
 *           whose album infobox credits this artist and has this name;
 *   artist: MusicBrainz's artist (its Wikidata link) -> genres and article;
 *           the song article's `artist` link; else the name as an article
 *           title ("Artist (band)", "(musician)", "(singer)", "(rapper)",
 *           "(DJ)", "Artist") with a musical-artist infobox of that name
 *           whose full text mentions the song or the album (so a namesake is
 *           not taken for the artist).
 *
 * The Wikipedia source reads the infobox `genre` field; the Wikidata source
 * the item's genre statements (when there is no MusicBrainz link, the item
 * the Wikipedia article belongs to).
 */
import { artistNameMatches, creditMatches, isSingleOf, leadArtist, releaseBase, titleMatches, type SongQuery } from '../match';
import type { GenreSource, LookupContext, PoliteHttp, SourceAnswer, SourceId, SourceLinks, SourceOutcome } from '../types';
import { entitiesUrl, itemUrl, parseItem, parseLabels } from './wikidata';
import { pagesUrl, parsePages, type WikiPage } from './wikipedia';
import { listItems, parseInfoboxes, plainText } from './wikitext';

const links = async (ctx: LookupContext | undefined, id: SourceId): Promise<SourceLinks> => {
  const o: SourceOutcome | undefined = await ctx?.outcome(id);
  return (o && o.status !== 'failed' && o.links) || {};
};

const WP = 'https://en.wikipedia.org/w/api.php';

function fullTextUrl(title: string): string {
  return `${WP}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', action: 'query', redirects: '1', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title })}`;
}

/** An infobox of `kind` on the page: its genres, name and artist parameter. */
function infobox(page: WikiPage, kind: RegExp): { genres: string[]; name: string; artist: string; artistNames: string[] } | null {
  if (page.missing || page.disambiguation) return null;
  const b = parseInfoboxes(page.content).find((x) => kind.test(x.kind));
  if (!b) return null;
  return {
    genres: listItems(b.params.genre).map((n) => (n.label.length >= 2 ? n.label : n.target)),
    name: plainText(b.params.name),
    artist: plainText(b.params.artist),
    artistNames: listItems(b.params.artist).flatMap((n) => [n.label, n.target]),
  };
}

const ALBUM_BOX = /^infobox (?:album|ep)\b/;
const ARTIST_BOX = /^infobox (?:musical artist|band|musician|singer|person)\b/;

/** Wikidata item -> its genre labels and English article (one request for the item, one for labels). */
async function itemGenres(http: PoliteHttp, q: string): Promise<{ genres: string[]; enwiki: string } | null> {
  const item = parseItem(await http.getJson(itemUrl(q)), q);
  if (!item) return null;
  const labels = item.genres.length ? parseLabels(await http.getJson(entitiesUrl(item.genres.slice(0, 50), 'labels'))) : new Map<string, string>();
  return { genres: item.genres.map((g) => labels.get(g)).filter((x): x is string => !!x), enwiki: item.enwiki };
}

/** The article of a Wikidata item, if it has an English one. */
async function itemArticle(http: PoliteHttp, q: string): Promise<string> {
  return parseItem(await http.getJson(itemUrl(q)), q)?.enwiki ?? '';
}

async function page(http: PoliteHttp, title: string): Promise<WikiPage | undefined> {
  return parsePages(await http.getJson(pagesUrl([title]))).get(title);
}

/** The store's / MusicBrainz's album name for the song, when it is an album and not the song's own single. */
async function albumName(song: SongQuery, ctx: LookupContext | undefined): Promise<string> {
  const names = [song.album, (await links(ctx, 'musicbrainz-album')).album, (await links(ctx, 'itunes-album')).album].filter((x): x is string => !!x);
  for (const n of names) if (!isSingleOf(song.title, n)) return releaseBase(n);
  return '';
}

export function albumForms(album: string, artist: string): string[] {
  const a = leadArtist(artist);
  return [...new Set([`${album} (${a} album)`, `${album} (${a} EP)`, `${album} (album)`, `${album} (EP)`, album])];
}

export function artistForms(artist: string): string[] {
  const a = leadArtist(artist);
  return [...new Set([`${a} (band)`, `${a} (musician)`, `${a} (singer)`, `${a} (rapper)`, `${a} (DJ)`, `${a} (group)`, a])];
}

export const wikipediaAlbum: GenreSource = {
  id: 'wikipedia-album',
  level: 'album',
  group: 'wikimedia',
  weight: 1,
  needs: ['musicbrainz-album', 'wikipedia', 'itunes-album'],
  async lookup(song, http, ctx): Promise<SourceAnswer> {
    const mb = await links(ctx, 'musicbrainz-album');
    const wp = await links(ctx, 'wikipedia');
    const album = await albumName(song, ctx);
    // By MusicBrainz's link: confirmed to be the album; it only needs an album infobox. The song article's
    // album link must also carry the album's name when that is known (an article can cover several versions).
    const linked: [string, boolean][] = [
      [mb.enwiki ?? '', true],
      [mb.wikidata ? await itemArticle(http, mb.wikidata) : '', true],
      [wp.albumArticle ?? '', false],
    ];
    const tried = new Set<string>();
    for (const [t, sure] of linked) {
      if (!t || tried.has(t)) continue;
      tried.add(t);
      const p = await page(http, t);
      const box = p && infobox(p, ALBUM_BOX);
      if (!p || !box) continue;
      if (!sure && album && !titleMatches(album, box.name || p.title.replace(/\s*\([^)]*\)\s*$/, ''))) continue;
      const l: SourceLinks = { ...(p.item ? { wikidata: p.item } : {}) };
      return box.genres.length ? { status: 'found', genres: box.genres, ref: p.title, links: l } : { status: 'none', reason: 'the album article lists no genre', ref: p.title, links: l };
    }
    // By name: the infobox must credit this artist and carry the album's name.
    if (!album) return { status: 'none', reason: 'no album (the song is a single, or the album is unknown)' };
    const forms = albumForms(album, song.artist);
    const pages = parsePages(await http.getJson(pagesUrl(forms)));
    for (const f of forms) {
      const p = pages.get(f);
      const box = p && infobox(p, ALBUM_BOX);
      if (!p || !box) continue;
      if (!creditMatches(song.artist, box.artistNames, box.artist)) continue;
      if (!titleMatches(album, box.name || p.title.replace(/\s*\([^)]*\)\s*$/, ''))) continue;
      const l: SourceLinks = { ...(p.item ? { wikidata: p.item } : {}) };
      return box.genres.length ? { status: 'found', genres: box.genres, ref: p.title, links: l } : { status: 'none', reason: 'the album article lists no genre', ref: p.title, links: l };
    }
    return { status: 'none', reason: `no article about the album ${album}` };
  },
};

/** Whether `text` mentions the title (as a whole phrase, ignoring case). */
function mentions(text: string, title: string): boolean {
  const t = title.trim();
  if (t.length < 3) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${esc}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

export const wikipediaArtist: GenreSource = {
  id: 'wikipedia-artist',
  level: 'artist',
  group: 'wikimedia',
  weight: 1,
  needs: ['musicbrainz-artist', 'wikipedia', 'musicbrainz-album', 'itunes-album'],
  async lookup(song, http, ctx): Promise<SourceAnswer> {
    const mb = await links(ctx, 'musicbrainz-artist');
    const wp = await links(ctx, 'wikipedia');
    const linked = [mb.enwiki, mb.wikidata ? await itemArticle(http, mb.wikidata) : '', wp.artistArticle].filter((x): x is string => !!x);
    for (const t of [...new Set(linked)]) {
      const p = await page(http, t);
      const box = p && infobox(p, ARTIST_BOX);
      if (!p || !box) continue;
      const l: SourceLinks = { ...(p.item ? { wikidata: p.item } : {}) };
      return box.genres.length ? { status: 'found', genres: box.genres, ref: p.title, links: l } : { status: 'none', reason: 'the artist article lists no genre', ref: p.title, links: l };
    }
    const forms = artistForms(song.artist);
    const pages = parsePages(await http.getJson(pagesUrl(forms)));
    const album = await albumName(song, ctx);
    for (const f of forms) {
      const p = pages.get(f);
      const box = p && infobox(p, ARTIST_BOX);
      if (!p || !box) continue;
      if (!artistNameMatches(song.artist, box.name || p.title.replace(/\s*\([^)]*\)\s*$/, ''))) continue;
      // A namesake is common: the article must mention the song or the album.
      const full = parsePages(await http.getJson(fullTextUrl(p.title))).get(p.title)?.content ?? '';
      const title = song.title.replace(/\s*[([].*$/, '').trim();
      if (!mentions(full, title) && !(album && mentions(full, album))) continue;
      const l: SourceLinks = { ...(p.item ? { wikidata: p.item } : {}) };
      return box.genres.length ? { status: 'found', genres: box.genres, ref: `${p.title} (by name; mentions the song or album)`, links: l } : { status: 'none', reason: 'the artist article lists no genre', ref: p.title, links: l };
    }
    return { status: 'none', reason: 'no article about this artist' };
  },
};

function wikidataLevel(id: 'wikidata-album' | 'wikidata-artist', level: 'album' | 'artist', mbId: SourceId, wpId: SourceId): GenreSource {
  return {
    id,
    level,
    group: 'wikimedia',
    weight: 1,
    needs: [mbId, wpId],
    async lookup(_song, http, ctx): Promise<SourceAnswer> {
      const q = (await links(ctx, mbId)).wikidata ?? (await links(ctx, wpId)).wikidata;
      if (!q) return { status: 'none', reason: `no Wikidata item linked from MusicBrainz or Wikipedia for the ${level}` };
      const g = await itemGenres(http, q);
      if (!g) return { status: 'none', reason: 'the linked item is missing', ref: q };
      return g.genres.length ? { status: 'found', genres: g.genres, ref: q } : { status: 'none', reason: `the ${level} item has no genre`, ref: q };
    },
  };
}

export const wikidataAlbum = wikidataLevel('wikidata-album', 'album', 'musicbrainz-album', 'wikipedia-album');
export const wikidataArtist = wikidataLevel('wikidata-artist', 'artist', 'musicbrainz-artist', 'wikipedia-artist');
