/**
 * One result list from the two song catalogs (iTunes first, Deezer second).
 *
 * The anonymous iTunes search lists only the clean versions of explicit songs
 * (some under censored titles: "umean" for Gunna's "fukumean", "Get Ur Freak
 * On (Amended LP Version)") and leaves out songs that have no clean version.
 * Deezer lists the explicit versions under their real titles. So:
 *
 *  - A Deezer track that is the same recording as an iTunes hit (an artist in
 *    common, length within 2 s, the same title, or an explicit track whose
 *    real title the censored iTunes one fits) is merged into it, each iTunes
 *    hit taking at most one: the iTunes hit keeps its place, album, year,
 *    artwork and genre; a censored title is replaced by the real one. The
 *    clean iTunes track ID then names the censored title, so it is dropped
 *    (the relay path looks the explicit track up when the song is added).
 *  - Other Deezer tracks are added only when every word of the search is in
 *    their artist or title, brackets aside except "(feat. X)" (so "Roddy
 *    Ricch The Box" keeps Roddy Ricch's "The Box" but not EC Twins' "The
 *    Box"), and they are not karaoke, covers, remixes or sped-up edits the
 *    search didn't ask for; once per artist + title + length (within 2 s).
 *    A clean and an explicit version of different lengths are
 *    different recordings for the picker and stay separate, each with its own
 *    length.
 *  - Hits whose artist and title hold every word of the search come first,
 *    in their catalog order, then the rest; at most MERGED_LIMIT.
 *
 * Mirrored in android/.../SongMerge.kt (same rules, same fixtures in the tests).
 */

import { normalizeName, songKey } from '../beat/cloud';
import { dedupeDeezer, type DeezerTrack } from './deezer';

export const MERGED_LIMIT = 15;

/** The fields the merge reads and writes; songSearch.ts's SongHit has these and more. */
export interface MergeHit {
  key: string;
  trackId: number;
  artist: string;
  title: string;
  album: string;
  year: string;
  durationSec: number;
  artworkUrl: string;
  genre?: string;
  /** iTunes says this is the clean version of an explicit song. */
  clean?: boolean;
  /** Where the hit came from (absent = iTunes). */
  source?: 'itunes' | 'deezer';
}

const words = (s: string): string[] => normalizeName(s).split(' ').filter(Boolean);
const joined = (s: string): string => words(s).join('');

/** Search words that need not appear in a result. */
const STOP = new Set(['the', 'a', 'feat', 'ft', 'featuring', 'and', 'by', 'x', 'with', 'vs']);

export function queryTokens(term: string): string[] {
  return words(term).filter((w) => !STOP.has(w));
}

/** Every token starts a word of `text`, or (3+ letters) appears in it with the spaces removed. */
function covers(tokens: string[], text: string): boolean {
  const ws = words(text);
  const j = ws.join('');
  return tokens.every((t) => ws.some((w) => w.startsWith(t)) || (t.length >= 3 && j.includes(t)));
}

const BRACKETS = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g;
const FEAT = /\s*\b(?:feat|ft|featuring)\b\.?\s.*$/i;
const SUFFIX = /\s[-–—]\s.*$/;

/** The title without brackets, " - ..." suffixes or "feat. X" (stars kept). */
function coreText(title: string): string {
  return title.replace(BRACKETS, ' ').replace(SUFFIX, '').replace(FEAT, '').trim();
}

/** Normalised title without any brackets, e.g. "creepin" for "Creepin' (Instrumental)". */
export function titleCore(title: string): string {
  return words(coreText(title)).join(' ');
}

/** Brackets and " - ..." parts that name no other version: a feature, or the explicit / clean / album edition. */
const SAME_SONG_PART = /^(?:feat|ft|featuring|with)\b|\b(?:explicit|dirty|clean|amended|edited|censored|(?:album|lp|single) version)\b/i;

/** The title with only same-song brackets removed (stars kept): "Get Ur Freak On (Amended LP Version)" → "Get Ur Freak On". */
function versionText(title: string): string {
  return title
    .replace(/\(([^)]*)\)|\[([^\]]*)\]|\{([^}]*)\}/g, (m, a?: string, b?: string, c?: string) => (SAME_SONG_PART.test((a ?? b ?? c ?? '').trim()) ? ' ' : m))
    .replace(/\s[-–—]\s(.*)$/, (m, rest: string) => (SAME_SONG_PART.test(rest.trim()) ? '' : m))
    .replace(FEAT, '')
    .trim();
}

/** Normalised title that tells versions apart: "creepin instrumental", but "get ur freak on" for the amended one. */
export function versionCore(title: string): string {
  return words(versionText(title)).join(' ');
}

/**
 * A title that shows it was censored or edited for a clean release: stars, or
 * "Amended" / "Clean" / "Edited" in brackets or after " - " (not a song called "Clean").
 */
const CENSORED = /\*|[([{][^)\]}]*\b(?:amended|clean|edited|censored)\b|\s[-–—]\s.*\b(?:amended|clean|edited|censored)\b/i;

export function looksCensored(title: string): boolean {
  return CENSORED.test(title);
}

/** Letters and digits (accents dropped, lower case) and the stars of a censored word. */
function squash(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}*]+/gu, '');
}

/**
 * Whether `real` is the uncensored form of the clean title `clean`: stars
 * stand for any letters ("B*tch", "F**k"), and a word cut out entirely still
 * leaves the rest ("umean" in "fukumean"; 3+ letters). Not when the real
 * title only adds words after the clean one ("Lucid Dreams" is not
 * "Lucid Dreams (Remix)").
 */
export function censorFits(clean: string, real: string): boolean {
  const c = squash(versionText(clean));
  const r = squash(versionText(real)).replace(/\*/g, '');
  if (!c || !r) return false;
  if (c.includes('*')) {
    const parts = c.split(/\*+/);
    const re = new RegExp(`^${parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\p{L}*')}$`, 'u');
    return re.test(r);
  }
  return c === r || (c.length >= 3 && r.includes(c) && !r.startsWith(c));
}

const CREDIT = /\s*(?:,|&|\+|;|\/|\band\b|\bx\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bvs\.?)\s*/i;

/** The credit and each billed name, joined without spaces. */
function artistParts(artist: string): string[] {
  return [joined(artist), ...artist.split(CREDIT).map(joined)].filter((p) => p.length >= 2);
}

/** An artist in common ("Drake & 21 Savage" and "Drake"). */
export function sameArtist(a: string, b: string): boolean {
  const pa = artistParts(a);
  return artistParts(b).some((p) => pa.includes(p));
}

/**
 * The same recording: an artist in common, within 2 s, and the same title, or
 * an explicit Deezer track whose real title the clean / censored one fits.
 */
export function sameRecording(hit: Pick<MergeHit, 'artist' | 'title' | 'durationSec' | 'clean'>, d: DeezerTrack): boolean {
  if (Math.abs(hit.durationSec - d.durationSec) > 2 || !sameArtist(hit.artist, d.artist)) return false;
  const a = versionCore(hit.title);
  if (a && a === versionCore(d.title)) return true;
  return d.explicit && (!!hit.clean || looksCensored(hit.title)) && censorFits(hit.title, d.title);
}

/**
 * Karaoke, covers, sped-up edits...: Deezer adds none of these unless the
 * search asks for one (the iTunes list is shown as it comes, as before).
 */
const NOT_THE_SONG =
  /\b(?:karaoke|instrumental|originally (?:performed|by)|in the style of|made famous|tribute|emulation|8-bit|sped up|slowed|nightcore|reverb|chopped|screwed|reversed|lullaby|cover|type beat|remix|rework|parody|diss+|mashup|medley|workout)\b/i;

/**
 * The words a Deezer track must hold all search words in (with its artist):
 * the title without what brackets add ("Not Like Us (Kendrick Lamar) [GAME BOY
 * Sound]" by someone else does not count as Kendrick Lamar's), except a
 * "(feat. X)" credit.
 */
function relevanceText(title: string): string {
  return title.replace(/\(([^)]*)\)|\[([^\]]*)\]|\{([^}]*)\}/g, (_m, a?: string, b?: string, c?: string) => {
    const inner = (a ?? b ?? c ?? '').trim();
    return /^(?:feat|ft|featuring|with)\b/i.test(inner) ? ` ${inner} ` : ' ';
  });
}

export function fromDeezer(d: DeezerTrack): MergeHit {
  return {
    key: songKey(d.artist, d.title),
    trackId: 0,
    artist: d.artist,
    title: d.title,
    album: d.album,
    year: '',
    durationSec: d.durationSec,
    artworkUrl: d.artworkUrl,
    source: 'deezer',
  };
}

/** Merge (see the file comment). `itunes` is parseItunesResults' list, `deezer` parseDeezer's. */
export function mergeCatalogs<H extends MergeHit>(term: string, itunes: H[], deezer: DeezerTrack[], limit = MERGED_LIMIT): (H | MergeHit)[] {
  const out: (H | MergeHit)[] = [...itunes];
  /** iTunes rows that already took a Deezer track. */
  const taken = new Set<number>();
  const tokens = queryTokens(term);
  for (const d of dedupeDeezer(deezer)) {
    const i = out.findIndex((h, idx) => idx < itunes.length && !taken.has(idx) && sameRecording(h, d));
    if (i < 0 && [...taken].some((idx) => sameRecording(out[idx], d) && versionCore(out[idx].title) === versionCore(d.title))) continue; // another copy
    if (i >= 0) {
      taken.add(i);
      const h = out[i];
      const censored = looksCensored(h.title) || (!!h.clean && versionCore(h.title) !== versionCore(d.title));
      if (censored && !looksCensored(d.title) && h.title !== d.title) {
        out[i] = { ...h, title: d.title, key: songKey(h.artist, d.title), trackId: 0, clean: false };
      }
      if (!out[i].artworkUrl && d.artworkUrl) out[i] = { ...out[i], artworkUrl: d.artworkUrl };
      continue;
    }
    if (!tokens.length || !covers(tokens, `${d.artist} ${relevanceText(d.title)}`)) continue;
    if (NOT_THE_SONG.test(`${d.title} ${d.album}`) && !NOT_THE_SONG.test(term)) continue;
    const key = songKey(d.artist, d.title);
    if (out.some((h) => h.key === key && Math.abs(h.durationSec - d.durationSec) <= 2)) continue;
    out.push(fromDeezer(d));
  }
  // Each merged iTunes hit already appears once; titles a merge changed may now equal another row.
  const unique = out.filter((h, i) => !out.some((o, j) => j < i && o.key === h.key && Math.abs(o.durationSec - h.durationSec) <= 2));
  const strong = (h: MergeHit) => tokens.length > 0 && covers(tokens, `${h.artist} ${coreText(h.title)}`);
  return [...unique.filter(strong), ...unique.filter((h) => !strong(h))].slice(0, limit);
}
