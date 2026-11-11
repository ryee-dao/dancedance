/**
 * "Add a song by search": choose the YouTube video for a requested song
 * (artist, title, official length) from yt-dlp flat search results.
 * Pure: no I/O. The caller checks embeddability (oEmbed) in ranked order.
 *
 * Ranking, best first:
 *   1 'official'    official lyric video or official audio on the artist's own,
 *                   VEVO or label channel (verified); lyric before audio
 *   2 'lyric'       third-party lyric video, most views first (>= 300 k views)
 *   3 'topic'       the artist's genuine "Provided to YouTube" art track
 *   4 'music-video' fallback: the official music video closest in length
 *
 * Tiers 1-3 must be within -1 .. +6 s of the official length; the fallback
 * within -2 .. +60 s. Live, remix, cover, sped up, slowed, karaoke, "1 hour",
 * extended, other "versions", translations and other artists' songs are
 * rejected unless the request itself asks for them.
 */
import { normalizeName } from '../../src/beat/cloud';

export interface SongRequest {
  artist: string;
  title: string;
  /** Official length in whole seconds. */
  durationSec: number;
}

/** One yt-dlp flat search entry, reduced to what the ranking uses. */
export interface SearchEntry {
  id: string;
  title: string;
  channel: string;
  /** yt-dlp `channel_is_verified` (missing in flat results = false). */
  verified: boolean;
  views: number | null;
  duration: number | null;
  /** Search snippet of the description (art tracks start "Provided to YouTube by"). */
  description: string;
  liveStatus: string | null;
}

export type Tier = 'official' | 'lyric' | 'topic' | 'music-video';

export interface Ranked {
  entry: SearchEntry;
  tier: Tier;
}

export interface Rejected {
  entry: SearchEntry;
  reason: string;
}

export const LYRIC_MIN_VIEWS = 300_000;
export const TOPIC_MIN_VIEWS = 10_000;
/** Allowed length difference (video - official), seconds. */
export const WINDOW: readonly [number, number] = [-1, 6];
export const MV_WINDOW: readonly [number, number] = [-2, 60];

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The two searches run for a request. */
export function searchQueries(req: Pick<SongRequest, 'artist' | 'title'>): string[] {
  const title = req.title.replace(/\s*(?:\(([^)]*)\)|\[([^\]]*)\])/g, (m, a, b) => (QUALIFIER.test(a ?? b ?? '') ? m : ' '));
  const base = `${req.artist} ${stripFeat(title)}`.replace(/\s+/g, ' ').trim();
  return [`${base} lyrics`, `${base} official audio`];
}

/** `yt-dlp ytsearchN:... --flat-playlist -J` output -> entries (deduplicated, in order). */
export function parseSearch(json: unknown): SearchEntry[] {
  const entries = (json as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) return [];
  const out: SearchEntry[] = [];
  for (const raw of entries) {
    const e = (raw ?? {}) as Record<string, unknown>;
    if (typeof e.id !== 'string' || !VIDEO_ID.test(e.id) || typeof e.title !== 'string') continue;
    const channel = [e.channel, e.uploader].find((x): x is string => typeof x === 'string' && x.length > 0) ?? '';
    out.push({
      id: e.id,
      title: e.title,
      channel,
      verified: e.channel_is_verified === true,
      views: typeof e.view_count === 'number' && Number.isFinite(e.view_count) ? e.view_count : null,
      duration: typeof e.duration === 'number' && Number.isFinite(e.duration) ? e.duration : null,
      description: typeof e.description === 'string' ? e.description : '',
      liveStatus: typeof e.live_status === 'string' ? e.live_status : null,
    });
  }
  return mergeSearches([out]);
}

/** Union of several result lists; the first occurrence of a video wins. */
export function mergeSearches(lists: SearchEntry[][]): SearchEntry[] {
  const seen = new Set<string>();
  const out: SearchEntry[] = [];
  for (const list of lists) {
    for (const e of list) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Text helpers

const toks = (s: string): string[] => normalizeName(s).split(' ').filter(Boolean);
const joined = (s: string): string => toks(s).join('');

/** Words that decorate upload titles but are not part of the song title. */
const NOISE = new Set([
  'lyrics', 'lyric', 'video', 'official', 'audio', 'hd', 'hq', '4k', 'music', 'mv', 'visualizer', 'visualiser',
  'with', 'letra', 'oficial', 'remastered', 'remaster', 'full', 'song', 'explicit', 'the',
]);

/** Remove a trailing "feat. X" / "ft. X" / "featuring X". */
function stripFeat(s: string): string {
  return s.replace(/\s*[([]?\s*\b(?:feat|ft|featuring)\b\.?\s.*$/i, '').trim();
}

/** Title words without brackets, quotes, features, trailing "| ..." or "// ...", or decoration. */
export function coreTokens(title: string): string[] {
  let s = title.split(/\s(?:\||\/\/)\s?/)[0];
  s = s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|【[^】]*】/g, ' ');
  s = s.replace(/"[^"]*"|“[^”]*”/g, ' ');
  s = stripFeat(s);
  return toks(s).filter((w) => !NOISE.has(w));
}

const sameTokens = (a: string[], b: string[]) => a.length > 0 && a.length === b.length && a.every((w, i) => w === b[i]);

/**
 * Ways the request's artist may be written, joined without spaces: the full
 * credit, the first-billed name, and other billed names of 5+ letters
 * ("Earth, Wind & Fire" stays whole-or-"earth"; "ROSÉ & Bruno Mars" also
 * matches "brunomars").
 */
export function artistVariants(artist: string): string[] {
  const parts = splitCredit(artist).map(joined);
  const out = [joined(artist), parts[0] ?? '', ...parts.slice(1).filter((p) => p.length >= 5)].filter((v) => v.length >= 2);
  return [...new Set(out)];
}

function splitCredit(artist: string): string[] {
  return artist.split(/\s*(?:,|&|\+|;|\/|\band\b|\bx\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bvs\.?)\s*/i).filter((p) => p.trim());
}

/** Token lists of the credit and each billed name, longest first. */
function artistTokenLists(artist: string): string[][] {
  const lists = [toks(artist), ...splitCredit(artist).map(toks)].filter((l) => l.length > 0);
  return lists.sort((a, b) => b.length - a.length);
}

function mentionsArtist(text: string, variants: string[]): boolean {
  const j = joined(text);
  return variants.some((v) => j.includes(v));
}

/** Remove the first contiguous occurrence of `needle` from `hay`. */
function removeRun(hay: string[], needle: string[]): string[] | null {
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((w, k) => hay[i + k] === w)) return [...hay.slice(0, i), ...hay.slice(i + needle.length)];
  }
  return null;
}

/** The requested title's words, without " - Remastered 2011"-style suffixes. */
export function requestCore(title: string): string[] {
  const t = title.replace(/\s[-–—]\s.*\b(?:remaster(?:ed)?|edit|version|mix|mono|stereo|single|live|acoustic|demo|from)\b.*$/i, '');
  return coreTokens(t);
}

/** Channel name with "- Topic", "VEVO", "Official", "and 2 more" etc. removed, joined. */
function channelCore(channel: string): string {
  const s = channel
    .replace(/\s+and\s+\d+\s+more$/i, '')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '');
  return toks(s)
    .filter((w) => !['official', 'music', 'tv', 'channel', 'vevo'].includes(w))
    .join('')
    .replace(/(?:official|music)$/, '');
}

const LABELS = new Set(
  [
    'atlantic records', 'warner records', 'warner bros records', 'warner music group', 'republic records', 'columbia records',
    'interscope records', 'capitol records', 'rca records', 'epic records', 'island records', 'def jam recordings',
    'universal music group', 'sony music entertainment', 'parlophone', 'parlophone records', 'mercury records', 'arista records',
    'geffen records', 'roc nation', 'polydor records', 'virgin records', 'rhino', 'rhino entertainment', 'big machine records',
    'hollywood records', 'aftermath records', 'young money', 'cash money records', 'bad boy records', 'jive records',
    'elektra records', '300 entertainment', 'fueled by ramen', 'sire records', 'reprise records', 'capitol music group',
    'motown records', 'ultra records', 'spinnin records', 'monstercat', 'hybe labels', 'sm town', 'jyp entertainment',
    'yg entertainment', 'xl recordings', 'domino recordings', 'sub pop records', 'big beat records', 'astralwerks',
  ].map(joined),
);

/**
 * Words that mean "not the original recording". Each is only a reason to
 * reject when the request's own title doesn't contain it.
 */
const BAD: [string, RegExp][] = [
  ['live', /\blive\b|\bconcert\b|\btour\b|\bfestival\b|\bperformance\b|\bperforms?\b/i],
  ['remix', /\bremix(?:es|ed)?\b|\bmix\b|\brework\b|\bbootleg\b|\bflip\b/i],
  ['cover', /\bcover\b|\btribute\b|\bparody\b|\bimpression\b/i],
  ['sped up', /\bsped\b|\bspeed\s*up\b|\bspeedup\b|\bfaster\b/i],
  ['slowed', /\bslowed\b|\bslow(?:er)? version\b/i],
  ['reverb', /\breverb\b/i],
  ['nightcore', /\bnightcore\b/i],
  ['8D', /\b8\s*d\b|\b16\s*d\b/i],
  ['karaoke', /\bkaraoke\b|\bsing\s*along\b/i],
  ['instrumental', /\binstrumental\b|\bbacking track\b|\bminus one\b/i],
  ['mashup', /\bmash\s*-?\s*up\b|\bmedley\b|\bmegamix\b/i],
  ['1 hour', /\b\d+\s*(?:hours?|hrs?)\b|\bloop(?:ed)?\b|\bon repeat\b/i],
  ['extended', /\bextended\b|\bfull length\b/i],
  ['edit', /\bclean\b|\bradio\s*edit\b|\bedit\b|\bcensored\b/i],
  ['reaction', /\breact(?:ion|s|ing)?\b|\breview\b|\bfirst time hearing\b/i],
  ['acoustic', /\bacoustic\b|\bunplugged\b|\bstripped\b|\bpiano\b|\bguitar\b|\borchestra(?:l)?\b|\bsymphonic\b|\blofi\b|\blo-fi\b/i],
  ['version', /\bversion\b|\bversi[oó]n\b|\brerecord(?:ed|ing)?\b|\bre-recorded\b/i],
  ['demo', /\bdemo\b|\bsnippet\b|\bpreview\b|\bunreleased\b|\bleak(?:ed)?\b/i],
  ['other media', /\breversed\b|\bbackwards\b|\bbass\s*boost(?:ed)?\b|\btiktok\b|\bchipmunk\b|\b8\s*-?\s*bit\b|\bshorts?\b|\btutorial\b|\bchoreography\b|\bdance (?:video|practice|cover)\b|\blesson\b|\bfan\s*made\b|\bteaser\b|\btrailer\b|\bbehind the scenes\b|\bmaking of\b|\binterview\b/i],
  ['translation', /\blegendad[oa]\b|\btraduc(?:ida|ido|ción|cion|ao|ão)\b|\btradução\b|\btraduzione\b|\bsub(?:titulado|titulada|s?)?\s*(?:español|espanol|ita|pt|br)\b|\bespañol\b|\bespanol\b|\bперевод\b|\bvietsub\b|\bthaisub\b|\bpolskie\b|\bnapisy\b/i],
];

/** A bracketed qualifier in the request that changes which recording it is ("Taylor's Version"). */
const QUALIFIER = /\b(?:version|remix|mix|live|acoustic|demo|extended|instrumental|sped|slowed|unplugged|stripped|re-?recorded)\b/i;

function requestQualifiers(title: string): string[][] {
  const out: string[][] = [];
  for (const m of title.matchAll(/\(([^)]*)\)|\[([^\]]*)\]|\s[-–—]\s(.+)$/g)) {
    const inner = m[1] ?? m[2] ?? m[3] ?? '';
    if (/^\s*(?:feat|ft|featuring|with|from)\b/i.test(inner)) continue;
    if (QUALIFIER.test(inner)) out.push(toks(inner).filter((w) => !NOISE.has(w)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Classification

interface Facts {
  dt: number;
  lyric: boolean;
  audio: boolean;
  artTrack: boolean;
  artistChannel: boolean;
  official: boolean;
  musicVideo: boolean;
}

/** BAD labels that also disqualify a channel ("Nightcore Hub", "Karaoke Version", "7clouds Acoustic"). */
const BAD_CHANNEL = new Set(['cover', 'sped up', 'slowed', 'reverb', 'nightcore', '8D', 'karaoke', 'instrumental', 'acoustic', '1 hour']);

/** Why `e` can't be this song (null = it matches). */
function mismatch(req: SongRequest, e: SearchEntry, variants: string[]): string | null {
  const title = e.title;
  const reqText = `${req.title} ${req.artist}`;
  for (const [label, re] of BAD) {
    if (re.test(title) && !re.test(reqText)) return label;
    if (BAD_CHANNEL.has(label) && re.test(e.channel) && !re.test(reqText)) return `${label} channel`;
  }
  const words = new Set(toks(title));
  for (const q of requestQualifiers(req.title)) {
    if (!q.every((w) => words.has(w))) return `not the requested "${q.join(' ')}"`;
  }
  const want = requestCore(req.title);
  if (!want.length) return 'empty title';
  const dash = /\s+[-–—~]+\s+/.exec(title);
  if (dash) {
    const left = title.slice(0, dash.index);
    const right = title.slice(dash.index + dash[0].length);
    const inLeft = mentionsArtist(left, variants);
    const inRight = mentionsArtist(right, variants);
    if ((inLeft && sameTokens(coreTokens(right), want)) || (inRight && sameTokens(coreTokens(left), want))) return null;
    if (!inLeft && !inRight) return mentionsArtist(e.channel, variants) ? 'different song' : 'different artist';
    return 'different song or artist';
  }
  // No "Artist - Title" separator: the title's words, maybe with the artist's name in them.
  let have = coreTokens(title);
  for (const name of artistTokenLists(req.artist)) {
    const cut = removeRun(have, name);
    if (cut) {
      have = cut;
      break;
    }
  }
  if (!sameTokens(have, want)) return 'different song';
  return mentionsArtist(title, variants) || mentionsArtist(e.channel, variants) ? null : 'artist not named';
}

function facts(req: SongRequest, e: SearchEntry, variants: string[]): Facts {
  const core = channelCore(e.channel);
  const artistChannel = core.length > 0 && variants.includes(core);
  const label = LABELS.has(joined(e.channel));
  const artTrack = /^\s*provided to youtube by\b/i.test(e.description) || /\s-\s*topic$/i.test(e.channel);
  const lyric = /\blyrics?\b|\blyric\s*video\b/i.test(e.title);
  const audio = /\baudio\b/i.test(e.title);
  return {
    dt: (e.duration ?? NaN) - req.durationSec,
    lyric,
    audio,
    artTrack,
    artistChannel,
    official: e.verified && (artistChannel || label) && !artTrack,
    musicVideo: /\bvideo\b|\bmv\b|\bclip\b/i.test(e.title) || !/[([]/.test(e.title),
  };
}

/**
 * Rank the candidates for a request. `ranked` is in the order to try them;
 * `rejected` explains the rest (for logs and tests).
 */
export function rankCandidates(req: SongRequest, entries: SearchEntry[]): { ranked: Ranked[]; rejected: Rejected[] } {
  const variants = artistVariants(req.artist);
  const tiers: Record<Tier, { e: SearchEntry; key: number[] }[]> = { official: [], lyric: [], topic: [], 'music-video': [] };
  const rejected: Rejected[] = [];
  for (const e of entries) {
    const reject = (reason: string) => rejected.push({ entry: e, reason });
    if (e.liveStatus === 'is_live' || e.liveStatus === 'is_upcoming' || e.liveStatus === 'post_live') {
      reject('live stream');
      continue;
    }
    if (e.duration === null) {
      reject('no length');
      continue;
    }
    const why = mismatch(req, e, variants);
    if (why) {
      reject(why);
      continue;
    }
    const f = facts(req, e, variants);
    const views = e.views ?? 0;
    const inWindow = f.dt >= WINDOW[0] && f.dt <= WINDOW[1];
    if (inWindow && f.official && (f.lyric || f.audio)) {
      tiers.official.push({ e, key: [f.lyric ? 0 : 1, -views] });
    } else if (inWindow && f.lyric && !f.artTrack && !f.artistChannel && !/topic/i.test(e.channel)) {
      if (views >= LYRIC_MIN_VIEWS) tiers.lyric.push({ e, key: [-views] });
      else reject(`lyric video with only ${views} views`);
    } else if (inWindow && f.artTrack && f.artistChannel) {
      if (views >= TOPIC_MIN_VIEWS) tiers.topic.push({ e, key: [-views] });
      else reject(`art track with only ${views} views`);
    } else if (f.official && f.musicVideo && !f.lyric && f.dt >= MV_WINDOW[0] && f.dt <= MV_WINDOW[1]) {
      tiers['music-video'].push({ e, key: [Math.abs(f.dt), -views] });
    } else if (!inWindow) {
      reject(`length ${e.duration} s vs ${req.durationSec} s`);
    } else if (f.artTrack) {
      reject('art track from another channel');
    } else if (f.artistChannel && !e.verified) {
      reject("unverified channel using the artist's name");
    } else {
      reject(f.official ? 'official upload, but not lyric/audio' : 'not official, not a lyric video');
    }
  }
  const cmp = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  const ranked: Ranked[] = [];
  for (const tier of ['official', 'lyric', 'topic', 'music-video'] as Tier[]) {
    for (const c of tiers[tier].sort((a, b) => cmp(a.key, b.key))) ranked.push({ entry: c.e, tier });
  }
  return { ranked, rejected };
}

// ---------------------------------------------------------------------------
// Request validation (workflow inputs, CLI)

export const MAX_ADDS = 10;
const CTRL = /[\u0000-\u001f\u007f]/;

/** Trim and validate one requested song; null when unusable. Duration may be absent (looked up later). */
export function cleanRequest(artist: unknown, title: unknown, duration?: unknown): { artist: string; title: string; durationSec?: number } | null {
  if (typeof artist !== 'string' || typeof title !== 'string') return null;
  const a = artist.replace(/\s+/g, ' ').trim();
  const t = title.replace(/\s+/g, ' ').trim();
  if (!a || !t || a.length > 200 || t.length > 200 || CTRL.test(a) || CTRL.test(t)) return null;
  const d = typeof duration === 'string' && duration.trim() ? Number(duration) : duration;
  const out: { artist: string; title: string; durationSec?: number } = { artist: a, title: t };
  if (typeof d === 'number' && Number.isFinite(d) && d >= 20 && d <= 15 * 60) out.durationSec = Math.round(d);
  return out;
}

/** "Artist - Title" (CLI). The first spaced dash separates them. */
export function splitArtistTitle(s: string): { artist: string; title: string } | null {
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(s.trim());
  return m ? { artist: m[1].trim(), title: m[2].trim() } : null;
}

/** The app's `add_queue` input: a JSON array of {artist, title, duration}. Invalid items are dropped. */
export function parseQueue(text: string | undefined): { artist: string; title: string; durationSec?: number }[] {
  if (!text?.trim()) return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: { artist: string; title: string; durationSec?: number }[] = [];
  for (const raw of data.slice(0, MAX_ADDS)) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const c = cleanRequest(r.artist, r.title, r.duration ?? r.durationSec);
    if (c) out.push(c);
  }
  return out;
}
