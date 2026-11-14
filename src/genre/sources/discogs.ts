/**
 * Discogs (no token): the genres and styles of the song's album, read from
 * its master release (`/masters/<id>`, public without authentication, 25
 * requests a minute). The master is the one MusicBrainz's album links to;
 * Discogs' search is not used (its documentation requires a token for it).
 * The master's track list must contain the song, so a wrong link is caught.
 * Styles ("Cumbia", "Euro House") come before the broad genres ("Latin",
 * "Electronic").
 */
import { titleMatches } from '../match';
import type { GenreSource, SourceAnswer } from '../types';

export function masterUrl(id: string): string {
  return `https://api.discogs.com/masters/${encodeURIComponent(id)}`;
}

export interface DiscogsMaster {
  id: string;
  title: string;
  genres: string[];
  styles: string[];
  tracks: string[];
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : []);

export function parseMaster(json: unknown): DiscogsMaster | null {
  const m = (json ?? {}) as Record<string, unknown>;
  if (typeof m.id !== 'number' && typeof m.id !== 'string') return null;
  const tracks = Array.isArray(m.tracklist) ? (m.tracklist as { title?: unknown }[]).map((t) => (typeof t?.title === 'string' ? t.title : '')).filter(Boolean) : [];
  return { id: String(m.id), title: typeof m.title === 'string' ? m.title : '', genres: strings(m.genres), styles: strings(m.styles), tracks };
}

export const discogsAlbum: GenreSource = {
  id: 'discogs-album',
  level: 'album',
  group: 'discogs',
  weight: 0.9,
  needs: ['musicbrainz-album'],
  async lookup(song, http, ctx): Promise<SourceAnswer> {
    const o = await ctx?.outcome('musicbrainz-album');
    const id = o && o.status !== 'failed' ? o.links?.discogsMaster : undefined;
    if (!id) return { status: 'none', reason: 'no Discogs master linked from the MusicBrainz album' };
    const m = parseMaster(await http.getJson(masterUrl(id)));
    if (!m) return { status: 'none', reason: 'the linked master is missing', ref: `master/${id}` };
    if (m.tracks.length && !m.tracks.some((t) => titleMatches(song.title, t))) return { status: 'none', reason: `the master (${m.title}) does not list the song`, ref: `master/${id}` };
    const genres = [...new Set([...m.styles, ...m.genres])];
    return genres.length ? { status: 'found', genres, ref: `master/${id} (${m.title})` } : { status: 'none', reason: 'the master has no genre', ref: `master/${id}` };
  },
};
