/**
 * MusicBrainz: community tags (votes > 0), at three levels.
 *
 * Song (`musicbrainz`): the song's single, else its studio recordings.
 * 1. Release-group search (title + artist). Kept: primary type Single, no
 *    secondary type (Live, Remix, Compilation, DJ-mix...), title and credit
 *    match, no version named in the title or disambiguation.
 * 2. Only when that gives no tags: recording search. Kept: title and credit
 *    match, not a video, no "live" / "remix" / "DJ-mix"... disambiguation,
 *    and within 30 s of the official length when both are known.
 *
 * Album (`musicbrainz-album`): the album or EP (release group) one of those
 * matching recordings was released on; or, when no recording matched, the
 * release group of the store's album name by this artist. Its tags, plus its
 * links to Wikidata and Discogs (for the other album sources).
 *
 * Artist (`musicbrainz-artist`): the artist credited on the matched
 * recording, single or album; else an artist search, used only when exactly
 * one artist has this name. Its tags and its Wikidata link.
 *
 * Tags are user tags, so names are read strictly (names.ts drops junk and
 * unknown words that don't look like a genre) and every answer carries the
 * vote counts: combine.ts lets a tag with a single vote count only when
 * another source supports it.
 */
import { artistNameMatches, creditMatches, isSingleOf, leadArtist, lengthGap, primaryArtist, queryTitle, releaseBase, titleMatches, unaskedVersion, type SongQuery } from '../match';
import type { GenreSource, PoliteHttp, SourceAnswer, SourceLinks } from '../types';

const WS = 'https://musicbrainz.org/ws/2';

/** Lucene phrase: quotes and backslashes escaped. */
const phrase = (s: string) => `"${s.replace(/[\\"]/g, (c) => `\\${c}`)}"`;

export function releaseGroupUrl(song: SongQuery): string {
  const q = `releasegroup:${phrase(queryTitle(song.title))} AND artist:${phrase(primaryArtist(song.artist))}`;
  return `${WS}/release-group?${new URLSearchParams({ query: q, fmt: 'json', limit: '15' })}`;
}

export function recordingUrl(song: SongQuery): string {
  const q = `recording:${phrase(queryTitle(song.title))} AND artist:${phrase(primaryArtist(song.artist))}`;
  return `${WS}/recording?${new URLSearchParams({ query: q, fmt: 'json', limit: '50' })}`;
}

export function albumSearchUrl(album: string, artist: string): string {
  const q = `releasegroup:${phrase(album)} AND artist:${phrase(primaryArtist(artist))}`;
  return `${WS}/release-group?${new URLSearchParams({ query: q, fmt: 'json', limit: '15' })}`;
}

export function artistSearchUrl(name: string): string {
  return `${WS}/artist?${new URLSearchParams({ query: `artist:${phrase(name)}`, fmt: 'json', limit: '10' })}`;
}

export function releaseGroupLookupUrl(id: string): string {
  return `${WS}/release-group/${id}?${new URLSearchParams({ inc: 'tags url-rels', fmt: 'json' })}`;
}

export function artistLookupUrl(id: string): string {
  return `${WS}/artist/${id}?${new URLSearchParams({ inc: 'tags url-rels', fmt: 'json' })}`;
}

export interface Tag {
  name: string;
  count: number;
}

interface Credit {
  names: string[];
  text: string;
  /** Artist ids in billing order, with the name they are credited as. */
  artists: { id: string; name: string }[];
}

interface Tagged {
  id: string;
  title: string;
  credit: string[];
  creditText: string;
  creditArtists: { id: string; name: string }[];
  disambiguation: string;
  tags: Tag[];
}

function readCredit(r: { 'artist-credit'?: unknown }): Credit {
  const ac = Array.isArray(r['artist-credit']) ? (r['artist-credit'] as { name?: unknown; joinphrase?: unknown; artist?: { id?: unknown; name?: unknown } }[]) : [];
  const names: string[] = [];
  const artists: { id: string; name: string }[] = [];
  let text = '';
  for (const a of ac) {
    const n = typeof a?.name === 'string' ? a.name : '';
    if (n) names.push(n);
    const an = typeof a?.artist?.name === 'string' ? a.artist.name : '';
    if (an && an !== n) names.push(an);
    if (typeof a?.artist?.id === 'string') artists.push({ id: a.artist.id, name: an || n });
    text += n + (typeof a?.joinphrase === 'string' ? a.joinphrase : '');
  }
  return { names, text, artists };
}

export function readTags(r: { tags?: unknown }): Tag[] {
  if (!Array.isArray(r.tags)) return [];
  return (r.tags as { name?: unknown; count?: unknown }[])
    .filter((t) => typeof t?.name === 'string' && typeof t.count === 'number' && t.count > 0)
    .map((t) => ({ name: t.name as string, count: t.count as number }));
}

export interface ReleaseGroup extends Tagged {
  primaryType: string;
  secondaryTypes: string[];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readGroup(raw: unknown): ReleaseGroup {
  const r = (raw ?? {}) as Record<string, unknown>;
  const c = readCredit(r);
  return {
    id: str(r.id),
    title: str(r.title),
    credit: c.names,
    creditText: c.text,
    creditArtists: c.artists,
    disambiguation: str(r.disambiguation),
    primaryType: str(r['primary-type']),
    secondaryTypes: Array.isArray(r['secondary-types']) ? (r['secondary-types'] as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    tags: readTags(r),
  };
}

export function parseReleaseGroups(json: unknown): ReleaseGroup[] {
  const list = (json as { 'release-groups'?: unknown[] } | null)?.['release-groups'];
  return Array.isArray(list) ? list.map(readGroup) : [];
}

/** A release a recording appears on, with its release group's type. */
export interface RecordingRelease {
  title: string;
  status: string;
  date: string;
  group: { id: string; title: string; primaryType: string; secondaryTypes: string[] };
}

export interface Recording extends Tagged {
  /** "1982-11-30" (may be just a year), or "" when unknown. */
  firstReleaseDate: string;
  lengthSec: number | null;
  video: boolean;
  releases: RecordingRelease[];
}

export function parseRecordings(json: unknown): Recording[] {
  const list = (json as { recordings?: unknown[] } | null)?.recordings;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const c = readCredit(r);
    const releases: RecordingRelease[] = Array.isArray(r.releases)
      ? (r.releases as Record<string, unknown>[]).map((rel) => {
          const g = (rel?.['release-group'] ?? {}) as Record<string, unknown>;
          return {
            title: str(rel?.title),
            status: str(rel?.status),
            date: str(rel?.date),
            group: {
              id: str(g.id),
              title: str(g.title),
              primaryType: str(g['primary-type']),
              secondaryTypes: Array.isArray(g['secondary-types']) ? (g['secondary-types'] as unknown[]).filter((x): x is string => typeof x === 'string') : [],
            },
          };
        })
      : [];
    return {
      id: str(r.id),
      title: str(r.title),
      credit: c.names,
      creditText: c.text,
      creditArtists: c.artists,
      disambiguation: str(r.disambiguation),
      firstReleaseDate: str(r['first-release-date']),
      lengthSec: typeof r.length === 'number' && r.length > 0 ? Math.round(r.length / 1000) : null,
      video: r.video === true,
      tags: readTags(r),
      releases,
    };
  });
}

/** Secondary types that are still the song itself (a soundtrack single, a mixtape single); Live, Remix, DJ-mix, Compilation... are not. */
const OK_SECONDARY = new Set(['Soundtrack', 'Mixtape/Street']);

/** Disambiguation comments that mark another version. */
const OTHER_VERSION = /\b(?:live|remix|mix|dj-?mix|acoustic|demo|instrumental|karaoke|cover|a cappella|reprise|session|rehearsal|reality audio|dolby|atmos|spatial)\b/i;

export function matchReleaseGroups(song: SongQuery, groups: ReleaseGroup[]): ReleaseGroup[] {
  return groups.filter(
    (g) =>
      g.primaryType === 'Single' &&
      !g.secondaryTypes.some((t) => !OK_SECONDARY.has(t)) &&
      titleMatches(song.title, g.title) &&
      creditMatches(song.artist, g.credit, g.creditText) &&
      !unaskedVersion(song, g.title, g.disambiguation) &&
      !(g.disambiguation && OTHER_VERSION.test(g.disambiguation) && !OTHER_VERSION.test(song.title)),
  );
}

export function matchRecordings(song: SongQuery, recs: Recording[]): Recording[] {
  return recs.filter((r) => {
    if (r.video || !titleMatches(song.title, r.title) || !creditMatches(song.artist, r.credit, r.creditText)) return false;
    if (unaskedVersion(song, r.title, r.disambiguation)) return false;
    if (r.disambiguation && OTHER_VERSION.test(r.disambiguation) && !OTHER_VERSION.test(song.title)) return false;
    const gap = lengthGap(song, r.lengthSec);
    return gap === null || gap <= 30;
  });
}

/**
 * Sum of votes per tag over the matching entries, most votes first. With
 * `minShare`, tags with fewer votes than that share of the top tag's are
 * dropped (recordings collect one person's "indie rock" on a dubstep track;
 * singles' tags are fewer and more deliberate, so they keep every vote).
 */
export function tallyCounts(entries: { tags: Tag[] }[], minShare = 0): Tag[] {
  const votes = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) votes.set(t.name, (votes.get(t.name) ?? 0) + t.count);
  const top = Math.max(0, ...votes.values());
  const min = Math.max(1, Math.round(top * minShare));
  return [...votes.entries()]
    .filter(([, v]) => v >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

export function tallyTags(entries: { tags: Tag[] }[], minShare = 0): string[] {
  return tallyCounts(entries, minShare).map((t) => t.name);
}

export const RECORDING_MIN_SHARE = 0.25;

const found = (tags: Tag[], ref: string, links?: SourceLinks): SourceAnswer => ({
  status: 'found',
  genres: tags.map((t) => t.name),
  counts: tags.map((t) => t.count),
  ref,
  ...(links && Object.keys(links).length ? { links } : {}),
});

/** The song's matching singles and recordings (shared by the three sources; the client sends each search once). */
async function songMatches(song: SongQuery, http: PoliteHttp): Promise<{ groups: ReleaseGroup[]; recs: Recording[] }> {
  const groups = matchReleaseGroups(song, parseReleaseGroups(await http.getJson(releaseGroupUrl(song))));
  const recs = matchRecordings(song, parseRecordings(await http.getJson(recordingUrl(song))));
  return { groups, recs };
}

export const musicbrainz: GenreSource = {
  id: 'musicbrainz',
  level: 'song',
  group: 'musicbrainz',
  weight: 0.8,
  strictNames: true,
  version: 2,
  artistTwin: 'musicbrainz-artist',
  async lookup(song, http): Promise<SourceAnswer> {
    const { groups, recs } = await songMatches(song, http);
    const fromGroups = tallyCounts(groups);
    if (fromGroups.length) return found(fromGroups, `release-group/${groups.filter((g) => g.tags.length).map((g) => g.id).join(',')}`);
    const fromRecs = tallyCounts(recs, RECORDING_MIN_SHARE);
    if (fromRecs.length) return found(fromRecs, `recording/${recs.filter((r) => r.tags.length).map((r) => r.id).slice(0, 5).join(',')}`);
    if (!groups.length && !recs.length) return { status: 'none', reason: 'no recording of this song by this artist' };
    return { status: 'none', reason: `${groups.length} single(s) and ${recs.length} recording(s) found, none tagged` };
  },
};

/** Album and EP release groups the matched recordings first came out on (no compilations, live or remix albums), the store's album first, else the earliest. */
export function albumGroups(song: SongQuery, recs: Recording[]): { id: string; title: string; n: number; date: string }[] {
  const byId = new Map<string, { id: string; title: string; n: number; date: string }>();
  for (const r of recs) {
    for (const rel of r.releases) {
      const g = rel.group;
      // An album or EP (a soundtrack album counts; compilations, live and remix albums do not).
      if (!g.id || !(g.primaryType === 'Album' || g.primaryType === 'EP') || g.secondaryTypes.some((t) => !OK_SECONDARY.has(t))) continue;
      if (rel.status && rel.status !== 'Official') continue;
      const cur = byId.get(g.id) ?? { id: g.id, title: g.title || rel.title, n: 0, date: rel.date || '9999' };
      cur.n++;
      if (rel.date && rel.date < cur.date) cur.date = rel.date;
      byId.set(g.id, cur);
    }
  }
  const want = song.album ? releaseBase(song.album) : '';
  const named = (t: string) => (want && titleMatches(want, t) ? 0 : 1);
  // The album the song came out on: released within a year of the song's first release (not a later
  // soundtrack or anniversary album that reuses it). The store's album first, then the earliest.
  const first = Math.min(...recs.map((r) => Number(r.firstReleaseDate.slice(0, 4)) || 9999));
  return [...byId.values()]
    .filter((g) => first === 9999 || Number(g.date.slice(0, 4)) <= first + 1)
    .sort((a, b) => named(a.title) - named(b.title) || a.date.slice(0, 4).localeCompare(b.date.slice(0, 4)) || b.n - a.n);
}

/** Links a release group or artist lookup carries: Wikidata item, Discogs master, English Wikipedia article. */
export function readUrlLinks(json: unknown): SourceLinks {
  const rels = (json as { relations?: { type?: unknown; url?: { resource?: unknown } }[] } | null)?.relations;
  const out: SourceLinks = {};
  for (const r of Array.isArray(rels) ? rels : []) {
    const url = typeof r?.url?.resource === 'string' ? r.url.resource : '';
    let m: RegExpExecArray | null;
    if (r?.type === 'wikidata' && (m = /wikidata\.org\/wiki\/(Q\d+)/.exec(url))) out.wikidata ??= m[1];
    else if (r?.type === 'discogs' && (m = /discogs\.com\/master\/(\d+)/.exec(url))) out.discogsMaster ??= m[1];
    else if (r?.type === 'wikipedia' && (m = /^https?:\/\/en\.wikipedia\.org\/wiki\/(.+)$/.exec(url))) out.enwiki ??= decodeURIComponent(m[1]).replace(/_/g, ' ');
  }
  return out;
}

export const musicbrainzAlbum: GenreSource = {
  id: 'musicbrainz-album',
  level: 'album',
  group: 'musicbrainz',
  weight: 0.8,
  strictNames: true,
  // 2: the album the song first came out on.
  version: 2,
  async lookup(song, http): Promise<SourceAnswer> {
    const { recs } = await songMatches(song, http);
    let pick = albumGroups(song, recs)[0] as { id: string; title: string } | undefined;
    let how = 'release of the matched recording';
    if (!pick && song.album && !isSingleOf(song.title, song.album)) {
      const album = releaseBase(song.album);
      const groups = parseReleaseGroups(await http.getJson(albumSearchUrl(album, song.artist))).filter(
        (g) => (g.primaryType === 'Album' || g.primaryType === 'EP') && !g.secondaryTypes.length && titleMatches(album, g.title) && creditMatches(song.artist, g.credit, g.creditText),
      );
      pick = groups[0];
      how = 'album of this name by this artist';
    }
    if (!pick) return { status: 'none', reason: recs.length ? 'the recordings are on no album or EP' : 'no recording or album of this song by this artist' };
    const json = await http.getJson(releaseGroupLookupUrl(pick.id));
    const links: SourceLinks = { mbReleaseGroup: pick.id, album: pick.title, ...readUrlLinks(json) };
    const tags = tallyCounts([{ tags: readTags(json as { tags?: unknown }) }]);
    const ref = `release-group/${pick.id} (${pick.title}; ${how})`;
    return tags.length ? found(tags, ref, links) : { status: 'none', reason: 'the album has no tags', ref, links };
  },
};

export interface MbArtist {
  id: string;
  name: string;
  score: number;
  disambiguation: string;
}

export function parseArtists(json: unknown): MbArtist[] {
  const list = (json as { artists?: unknown[] } | null)?.artists;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return { id: str(r.id), name: str(r.name), score: typeof r.score === 'number' ? r.score : 0, disambiguation: str(r.disambiguation) };
  });
}

/** The credited artist that is the requested (lead) artist, from the matched entries. */
export function creditedArtist(song: SongQuery, entries: { creditArtists: { id: string; name: string }[] }[]): { id: string; name: string } | null {
  for (const e of entries) for (const a of e.creditArtists) if (a.id && artistNameMatches(song.artist, a.name)) return a;
  return null;
}

export const musicbrainzArtist: GenreSource = {
  id: 'musicbrainz-artist',
  level: 'artist',
  group: 'musicbrainz',
  weight: 0.8,
  strictNames: true,
  async lookup(song, http): Promise<SourceAnswer> {
    const { groups, recs } = await songMatches(song, http);
    let artist = creditedArtist(song, [...groups, ...recs]);
    let how = 'credited on the song';
    if (!artist) {
      const name = leadArtist(song.artist);
      const same = parseArtists(await http.getJson(artistSearchUrl(name))).filter((a) => a.id && artistNameMatches(song.artist, a.name));
      if (same.length > 1) return { status: 'none', reason: `${same.length} artists of this name; the song confirms none` };
      if (same.length === 1) {
        artist = same[0];
        how = 'the only artist of this name';
      }
    }
    if (!artist) return { status: 'none', reason: 'no artist of this name' };
    const json = await http.getJson(artistLookupUrl(artist.id));
    const links: SourceLinks = { mbArtist: artist.id, ...readUrlLinks(json) };
    const tags = tallyCounts([{ tags: readTags(json as { tags?: unknown }) }]);
    const ref = `artist/${artist.id} (${artist.name}; ${how})`;
    return tags.length ? found(tags, ref, links) : { status: 'none', reason: 'the artist has no tags', ref, links };
  },
};
