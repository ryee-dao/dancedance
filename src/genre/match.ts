/**
 * "Is this THIS song by this artist?" helpers shared by every source's
 * matcher. Built on the project's name normalisation (normalizeName in
 * src/beat/cloud.ts), so "ROSÉ", "Rosé" and "rose" agree. Pure.
 */
import { normalizeName } from '../beat/cloud';

export interface SongQuery {
  artist: string;
  title: string;
  /** Official length in seconds, when known (only used to prefer or reject versions; never sent). */
  durationSec?: number;
  /** The iTunes genre already stored with the song, if any (the iTunes source then needs no request). */
  itunesGenre?: string;
}

/** Remove a trailing "feat. X" / "ft. X" / "featuring X" (with or without brackets). */
export function stripFeat(s: string): string {
  return s.replace(/\s*[([]?\s*\b(?:feat|ft|featuring)\b\.?\s.*$/i, '').trim();
}

/** Remove bracketed parts: "Snow (Hey Oh)" -> "Snow". */
function stripBrackets(s: string): string {
  return s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "&" and "+" read as "and" in titles and names. */
const norm = (s: string) => normalizeName(s.replace(/\s*[&+]\s*/g, ' and '));
/** Normalised, without spaces. */
export const joined = (s: string) => norm(s).replace(/ /g, '');

/** The title the sources should be asked about: no "feat." part. */
export function queryTitle(title: string): string {
  return stripFeat(title) || title.trim();
}

/** Words that mark another version of a song (only a problem when the request did not ask for it). */
const VERSION =
  /\b(?:remix(?:es|ed)?|rmx|live|acoustic|unplugged|cover|karaoke|instrumental|a cappella|acapella|demo|reprise|sped up|slowed|nightcore|rework|re-?recorded|re-?recording|taylor'?s version|club mix|dub mix|mashup|medley|orchestral|piano version|tribute|in the style of|made famous)\b/i;

/** True when `text` names a version (live, remix, cover...) that the request did not ask for. */
export function unaskedVersion(q: Pick<SongQuery, 'title'>, ...texts: (string | undefined | null)[]): boolean {
  if (VERSION.test(q.title)) return false;
  return texts.some((t) => !!t && VERSION.test(t));
}

/** Same song title? Exact after normalisation, or the same once brackets are dropped on both sides. */
export function titleMatches(requestTitle: string, candidate: string): boolean {
  const a = norm(queryTitle(requestTitle));
  const b = norm(queryTitle(candidate));
  if (!a || !b) return false;
  if (a === b) return true;
  const a2 = norm(stripBrackets(queryTitle(requestTitle)));
  const b2 = norm(stripBrackets(queryTitle(candidate)));
  return !!a2 && a2 === b2;
}

/** Split a credit into billed names: "Mark Ronson ft. Bruno Mars" -> ["Mark Ronson", "Bruno Mars"]. */
export function splitCredit(artist: string): string[] {
  return artist
    .split(/\s*(?:,|&|\+|;|\/|\band\b|\bx\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bvs\.?|\bduet with\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The first-billed artist ("Beyoncé ft. JAY-Z" -> "Beyoncé"); whole credits that are one act ("Earth, Wind & Fire") stay whole when asked. */
export function primaryArtist(artist: string): string {
  const m = /^(.+?)\s+(?:feat\.?|ft\.?|featuring|with|x|&|and|vs\.?)\s+/i.exec(artist.trim());
  return (m ? m[1] : artist).trim();
}

/** Spellings with stylised letters read plainly: "P!nk" -> "Pink", "Ke$ha" -> "Kesha". */
function plainLetters(s: string): string {
  return s.replace(/(?<=\p{L})!(?=\p{L})/gu, 'i').replace(/(?<=\p{L})\$(?=\p{L})/gu, 's');
}

/** Joined spellings the request's artist may appear as: whole credit, first-billed, other billed names (5+ letters). */
export function artistVariants(artist: string): string[] {
  const out = new Set<string>();
  for (const a of [artist, plainLetters(artist)]) {
    out.add(joined(a));
    out.add(joined(primaryArtist(a)));
    const parts = splitCredit(a);
    if (parts[0]) out.add(joined(parts[0]));
    for (const p of parts.slice(1)) if (joined(p).length >= 5) out.add(joined(p));
  }
  return [...out].filter((v) => v.length >= 2);
}

/**
 * Does a source's credit name the requested artist? `names` are the
 * individual names the source credits (links, credit parts); `fullText` its
 * whole credit as text. Matching is by whole names, or by the first-billed
 * requested artist appearing in the credit text (4+ letters).
 */
export function creditMatches(requestArtist: string, names: readonly string[], fullText = ''): boolean {
  const want = new Set(artistVariants(requestArtist));
  const have = new Set<string>();
  for (const n of [...names, fullText]) {
    if (!n) continue;
    have.add(joined(n));
    have.add(joined(plainLetters(n)));
    for (const p of splitCredit(n)) have.add(joined(p));
  }
  for (const h of have) if (h && want.has(h)) return true;
  const text = joined(fullText || names.join(' '));
  const primaries = [joined(primaryArtist(requestArtist)), joined(primaryArtist(plainLetters(requestArtist)))];
  return primaries.some((p) => p.length >= 4 && text.includes(p));
}

/** |a - b| in seconds when both are known, else null. */
export function lengthGap(q: Pick<SongQuery, 'durationSec'>, seconds: number | null | undefined): number | null {
  if (!q.durationSec || !seconds || !Number.isFinite(seconds)) return null;
  return Math.abs(q.durationSec - seconds);
}
