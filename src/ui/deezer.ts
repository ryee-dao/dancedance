/**
 * Deezer's public search API (api.deezer.com/search, no key, no login): the
 * second song catalog for "Add a song". The anonymous iTunes search lists only
 * the clean versions of explicit songs, and nothing at all for songs without
 * a clean version (Roddy Ricch "The Box", Playboi Carti "Magnolia", ...);
 * Deezer lists the explicit versions under their real titles, with the track
 * length in whole seconds.
 *
 * Pure parsing here, shared by the web search (src/ui/songSearch.ts) and the
 * cloud job (tools/beatmaps/itunes.ts); the TV has the same in Deezer.kt.
 * Only the search text is sent.
 */

import { songKey } from '../beat/cloud';

export const DEEZER_SEARCH = 'https://api.deezer.com/search';
export const DEEZER_LIMIT = 10;

export interface DeezerTrack {
  artist: string;
  title: string;
  album: string;
  durationSec: number;
  explicit: boolean;
  /** 300x300 cover (HTTPS) or ''. */
  artworkUrl: string;
}

/** Thrown for Deezer's own error answers (they come as HTTP 200 with an `error` object). */
export class DeezerError extends Error {
  constructor(
    /** 'busy' = quota exceeded (Deezer code 4) or HTTP 403/429/503. */
    readonly kind: 'busy' | 'failed',
  ) {
    super(`deezer ${kind}`);
    this.name = 'DeezerError';
  }
}

export function deezerUrl(term: string, o: { limit?: number; callback?: string } = {}): string {
  const q = new URLSearchParams({ q: term.trim(), limit: String(o.limit ?? DEEZER_LIMIT) });
  if (o.callback) {
    q.set('output', 'jsonp');
    q.set('callback', o.callback);
  }
  return `${DEEZER_SEARCH}?${q}`;
}

const MD5 = /^[0-9a-f]{32}$/;

/**
 * Tracks from a search answer: songs 20 s .. 15 min (the job maps up to 15
 * min), in Deezer's order. Throws DeezerError for an error answer.
 */
export function parseDeezer(json: unknown): DeezerTrack[] {
  const o = (json ?? {}) as { data?: unknown; error?: unknown };
  if (o.error && typeof o.error === 'object') {
    const code = (o.error as { code?: unknown }).code;
    throw new DeezerError(code === 4 ? 'busy' : 'failed');
  }
  if (!Array.isArray(o.data)) return [];
  const out: DeezerTrack[] = [];
  for (const raw of o.data) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (r.type !== undefined && r.type !== 'track') continue;
    const artist = (r.artist as { name?: unknown } | undefined)?.name;
    const album = (r.album ?? {}) as Record<string, unknown>;
    if (typeof artist !== 'string' || typeof r.title !== 'string' || !artist.trim() || !r.title.trim()) continue;
    const durationSec = typeof r.duration === 'number' ? Math.round(r.duration) : 0;
    if (durationSec < 20 || durationSec > 15 * 60) continue;
    const md5 = typeof album.md5_image === 'string' ? album.md5_image : typeof r.md5_image === 'string' ? r.md5_image : '';
    out.push({
      artist: artist.trim(),
      title: r.title.trim(),
      album: typeof album.title === 'string' ? album.title.trim() : '',
      durationSec,
      explicit: r.explicit_lyrics === true,
      artworkUrl: MD5.test(md5) ? `https://cdn-images.dzcdn.net/images/cover/${md5}/300x300-000000-80-0-0.jpg` : '',
    });
  }
  return out;
}

/** One entry per artist + title within 2 s (the same song on an album and a single), first kept. */
export function dedupeDeezer(tracks: DeezerTrack[]): DeezerTrack[] {
  const out: DeezerTrack[] = [];
  for (const t of tracks) {
    const key = songKey(t.artist, t.title);
    if (out.some((o) => songKey(o.artist, o.title) === key && Math.abs(o.durationSec - t.durationSec) <= 2)) continue;
    out.push(t);
  }
  return out;
}
