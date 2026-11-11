/**
 * Official song length (and canonical names) from the iTunes Search API, for
 * `--add "Artist - Title"` when no length is given. The app sends the length
 * it showed the user, so this is only used by the CLI and by manual runs of
 * the workflow without a length.
 */
import { normalizeName } from '../../src/beat/cloud';
import { artistVariants, requestCore } from './pick';

export interface ItunesTrack {
  artistName: string;
  trackName: string;
  collectionName?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  /** e.g. "Pop", "Hip-Hop/Rap", "Latin". */
  primaryGenreName?: string;
}

export interface OfficialSong {
  artist: string;
  title: string;
  durationSec: number;
  /** iTunes primary genre, when known. */
  genre?: string;
}

export function itunesSearchUrl(term: string, limit = 25): string {
  const q = new URLSearchParams({ term, entity: 'song', limit: String(limit) });
  return `https://itunes.apple.com/search?${q}`;
}

/** Reject versions the request didn't ask for (in the track or the album name). */
const NOT_ORIGINAL =
  /\b(?:live|remix|mix|acoustic|karaoke|instrumental|version|edit|demo|cover|tribute|sped|slowed|unplugged|stripped|extended|re-?recorded|kidz bop|in the style of|made famous|originally performed)\b/i;

/** A usable genre name (trimmed, at most 60 characters), or undefined. */
export function cleanGenre(g: unknown): string | undefined {
  if (typeof g !== 'string') return undefined;
  const t = g.replace(/\s+/g, ' ').trim();
  return t && t.length <= 60 && !/[\u0000-\u001f]/.test(t) ? t : undefined;
}

export function parseItunes(json: unknown): ItunesTrack[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.filter(
    (r): r is ItunesTrack => !!r && typeof r.artistName === 'string' && typeof r.trackName === 'string',
  );
}

/**
 * The official length: among tracks by this artist with this title (no live,
 * remix, karaoke... unless asked for), the most common length (+-2 s); ties go
 * to the earliest release. Names are taken from the earliest such track.
 */
export function pickOfficialLength(req: { artist: string; title: string }, tracks: ItunesTrack[]): OfficialSong | null {
  const want = requestCore(req.title);
  const variants = artistVariants(req.artist);
  const reqText = `${req.artist} ${req.title}`;
  const ok = tracks.filter((t) => {
    if (!t.trackTimeMillis || t.trackTimeMillis < 20_000) return false;
    const a = normalizeName(t.artistName).replace(/ /g, '');
    if (!variants.some((v) => a.includes(v) || v.includes(a))) return false;
    const core = requestCore(t.trackName);
    if (core.length !== want.length || !core.every((w, i) => w === want[i])) return false;
    const text = `${t.trackName} ${t.collectionName ?? ''}`;
    return !(NOT_ORIGINAL.test(text) && !NOT_ORIGINAL.test(reqText));
  });
  if (!ok.length) return null;
  const secs = ok.map((t) => Math.round(t.trackTimeMillis! / 1000));
  const date = (t: ItunesTrack) => Date.parse(t.releaseDate ?? '') || Infinity;
  // Plain names ("Take On Me", not "Take On Me (2015 Remastered)") count first.
  const plain = ok.map((t) => normalizeName(t.trackName) === normalizeName(req.title));
  const score = (i: number) => {
    const near = ok.map((_, j) => j).filter((j) => Math.abs(secs[j] - secs[i]) <= 2);
    return [near.filter((j) => plain[j]).length, near.length, -date(ok[i])];
  };
  let best = 0;
  for (let i = 1; i < ok.length; i++) {
    const a = score(i);
    const b = score(best);
    if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best = i;
  }
  const cluster = ok
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => Math.abs(secs[i] - secs[best]) <= 2)
    .sort((x, y) => Number(plain[y.i]) - Number(plain[x.i]) || date(x.t) - date(y.t));
  const first = cluster[0].t;
  const genre = cleanGenre(first.primaryGenreName) ?? cluster.map((c) => cleanGenre(c.t.primaryGenreName)).find((g) => g !== undefined);
  return { artist: first.artistName, title: first.trackName, durationSec: Math.round(first.trackTimeMillis! / 1000), ...(genre ? { genre } : {}) };
}

/** Look the song up on iTunes. Resolves null when not found or unreachable. */
export async function lookupOfficial(
  req: { artist: string; title: string },
  fetchFn: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (u) => fetch(u),
): Promise<OfficialSong | null> {
  try {
    const res = await fetchFn(itunesSearchUrl(`${req.artist} ${req.title}`));
    if (!res.ok) return null;
    return pickOfficialLength(req, parseItunes(await res.json()));
  } catch {
    return null;
  }
}
