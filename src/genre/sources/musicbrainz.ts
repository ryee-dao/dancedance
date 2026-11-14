/**
 * MusicBrainz: community tags (votes > 0) of the song's single, else of its
 * studio recordings.
 *
 * 1. Release-group search (title + artist). Kept: primary type Single, no
 *    secondary type (Live, Remix, Compilation, DJ-mix...), title and credit
 *    match, no version named in the title or disambiguation.
 * 2. Only when that gives no tags: recording search. Kept: title and credit
 *    match, not a video, no "live" / "remix" / "DJ-mix"... disambiguation,
 *    and within 30 s of the official length when both are known.
 *
 * Tags are user tags, so names are read strictly (names.ts drops junk and
 * unknown words that don't look like a genre).
 */
import { creditMatches, lengthGap, primaryArtist, queryTitle, titleMatches, unaskedVersion, type SongQuery } from '../match';
import type { GenreSource, SourceAnswer } from '../types';

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

interface Tagged {
  id: string;
  title: string;
  credit: string[];
  creditText: string;
  disambiguation: string;
  tags: { name: string; count: number }[];
}

function readCredit(r: { 'artist-credit'?: unknown }): { names: string[]; text: string } {
  const ac = Array.isArray(r['artist-credit']) ? (r['artist-credit'] as { name?: unknown; joinphrase?: unknown; artist?: { name?: unknown } }[]) : [];
  const names: string[] = [];
  let text = '';
  for (const a of ac) {
    const n = typeof a?.name === 'string' ? a.name : '';
    if (n) names.push(n);
    if (typeof a?.artist?.name === 'string' && a.artist.name !== n) names.push(a.artist.name);
    text += n + (typeof a?.joinphrase === 'string' ? a.joinphrase : '');
  }
  return { names, text };
}

function readTags(r: { tags?: unknown }): { name: string; count: number }[] {
  if (!Array.isArray(r.tags)) return [];
  return (r.tags as { name?: unknown; count?: unknown }[])
    .filter((t) => typeof t?.name === 'string' && typeof t.count === 'number' && t.count > 0)
    .map((t) => ({ name: t.name as string, count: t.count as number }));
}

export interface ReleaseGroup extends Tagged {
  primaryType: string;
  secondaryTypes: string[];
}

export function parseReleaseGroups(json: unknown): ReleaseGroup[] {
  const list = (json as { 'release-groups'?: unknown[] } | null)?.['release-groups'];
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const c = readCredit(r);
    return {
      id: typeof r.id === 'string' ? r.id : '',
      title: typeof r.title === 'string' ? r.title : '',
      credit: c.names,
      creditText: c.text,
      disambiguation: typeof r.disambiguation === 'string' ? r.disambiguation : '',
      primaryType: typeof r['primary-type'] === 'string' ? (r['primary-type'] as string) : '',
      secondaryTypes: Array.isArray(r['secondary-types']) ? (r['secondary-types'] as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      tags: readTags(r),
    };
  });
}

export interface Recording extends Tagged {
  lengthSec: number | null;
  video: boolean;
}

export function parseRecordings(json: unknown): Recording[] {
  const list = (json as { recordings?: unknown[] } | null)?.recordings;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const c = readCredit(r);
    return {
      id: typeof r.id === 'string' ? r.id : '',
      title: typeof r.title === 'string' ? r.title : '',
      credit: c.names,
      creditText: c.text,
      disambiguation: typeof r.disambiguation === 'string' ? r.disambiguation : '',
      lengthSec: typeof r.length === 'number' && r.length > 0 ? Math.round(r.length / 1000) : null,
      video: r.video === true,
      tags: readTags(r),
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
export function tallyTags(entries: Tagged[], minShare = 0): string[] {
  const votes = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) votes.set(t.name, (votes.get(t.name) ?? 0) + t.count);
  const top = Math.max(0, ...votes.values());
  const min = Math.max(1, Math.round(top * minShare));
  return [...votes.entries()]
    .filter(([, v]) => v >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([n]) => n);
}

export const RECORDING_MIN_SHARE = 0.25;

export const musicbrainz: GenreSource = {
  id: 'musicbrainz',
  group: 'musicbrainz',
  weight: 0.8,
  strictNames: true,
  async lookup(song, http): Promise<SourceAnswer> {
    const groups = matchReleaseGroups(song, parseReleaseGroups(await http.getJson(releaseGroupUrl(song))));
    const fromGroups = tallyTags(groups);
    if (fromGroups.length) return { status: 'found', genres: fromGroups, ref: `release-group/${groups.filter((g) => g.tags.length).map((g) => g.id).join(',')}` };
    const recs = matchRecordings(song, parseRecordings(await http.getJson(recordingUrl(song))));
    const fromRecs = tallyTags(recs, RECORDING_MIN_SHARE);
    if (fromRecs.length) return { status: 'found', genres: fromRecs, ref: `recording/${recs.filter((r) => r.tags.length).map((r) => r.id).slice(0, 5).join(',')}` };
    if (!groups.length && !recs.length) return { status: 'none', reason: 'no recording of this song by this artist' };
    return { status: 'none', reason: `${groups.length} single(s) and ${recs.length} recording(s) found, none tagged` };
  },
};
