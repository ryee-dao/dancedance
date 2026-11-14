/**
 * "Add a song by search": choose the YouTube video for a requested song
 * (artist, title, official length) from yt-dlp flat search results.
 * Pure: no I/O. The caller checks embeddability (oEmbed) in ranked order.
 *
 * Ranking, best first:
 *   1 'official'    official lyric video or official audio on the artist's own,
 *                   VEVO or label channel (verified); lyric before audio
 *   2 'lyric'       third-party lyric video, most views first (>= 300 k views)
 *   3 'topic'       the artist's genuine "Provided to YouTube" art track (>= 10 k views,
 *                   or on the artist's verified channel, or, for a little-known song,
 *                   on the artist's "- Topic" channel at the official length; or on a
 *                   label's "- Topic" channel when the art track's "Title · Artist"
 *                   credit names the artist, same conditions)
 *   4 'music-video' fallback: the official music video closest in length
 *
 * Within that order, an upload tagged with an era or style the request doesn't
 * name ("Insane (1920s Style)") goes after the untagged ones, and one tagged
 * with a bare year ("Insane (1920)") after an untagged one with 10x its views.
 *
 * When the two searches (searchQueries) rank nothing, the caller runs the plain
 * "Artist Title" search (fallbackQuery) too and ranks all results again.
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
/** A matching upload with this many views makes the song "known" (see genuineArtTrack). */
export const KNOWN_SONG_VIEWS = 100_000;
/** Allowed length difference (video - official), seconds. */
export const WINDOW: readonly [number, number] = [-1, 6];
export const MV_WINDOW: readonly [number, number] = [-2, 60];

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** "Artist Title" without feat. credits or non-qualifier brackets. */
function queryBase(req: Pick<SongRequest, 'artist' | 'title'>): string {
  const title = req.title.replace(/\s*(?:\(([^)]*)\)|\[([^\]]*)\])/g, (m, a, b) => (QUALIFIER.test(a ?? b ?? '') ? m : ' '));
  return `${req.artist} ${stripFeat(title)}`.replace(/\s+/g, ' ').trim();
}

/** The two searches run for a request. */
export function searchQueries(req: Pick<SongRequest, 'artist' | 'title'>): string[] {
  const base = queryBase(req);
  return [`${base} lyrics`, `${base} official audio`];
}

/**
 * The third search, run only when the first two rank nothing: plain "Artist
 * Title". For little-known songs the "lyrics" / "official audio" words pull in
 * other songs, while the plain search finds the art track or the upload.
 */
export function fallbackQuery(req: Pick<SongRequest, 'artist' | 'title'>): string {
  return queryBase(req);
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

/**
 * A degraded answer: results where no entry has a channel or a view count.
 * YouTube serves one now and then (about 1 query in 25 in tools/eval/pickEval.ts);
 * nothing in it can be ranked, so the caller asks again.
 */
export function degradedSearch(entries: SearchEntry[]): boolean {
  return entries.length > 0 && entries.every((e) => !e.channel && e.views === null);
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
  'with', 'letra', 'letras', 'paroles', 'lirik', '가사', '歌詞', 'oficial', 'remastered', 'remaster', 'full', 'song', 'explicit', 'the',
]);

/** A lyric video, in English or the usual other words ("Letra", "Paroles", "Lirik", 가사, 歌詞). */
const LYRIC = /\blyrics?\b|\blyric\s*video\b|\bletras?\b|\bparoles\b|\blirik\b|가사|歌詞/i;

/** Remove a trailing "feat. X" / "ft. X" / "featuring X". */
function stripFeat(s: string): string {
  return s.replace(/\s*[([]?\s*\b(?:feat|ft|featuring)\b\.?\s.*$/i, '').trim();
}

const QUOTED = /"[^"]*"|“[^”]*”/g;

/**
 * Title words without brackets, quotes, features, trailing "| ..." or "// ...", or decoration.
 * `keepQuoted` keeps the words inside double quotes (only the marks go): the
 * quotes then hold the song title (`21 Savage - "Rap Saved Me" Ft Quavo`),
 * not an appended lyric line (`HOT TO GO! (Lyrics) "you can take me hot to go"`).
 */
export function coreTokens(title: string, keepQuoted = false): string[] {
  let s = title.split(/\s(?:\||\/\/)\s?/)[0];
  s = s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|【[^】]*】/g, ' ');
  s = keepQuoted ? s.replace(/["“”]/g, ' ') : s.replace(QUOTED, ' ');
  s = stripFeat(s);
  return toks(s).filter((w) => !NOISE.has(w));
}

/** The ways an upload title's words can be read: quoted text dropped, and (when there is any) kept. */
function titleReadings(title: string): string[][] {
  const out = [coreTokens(title)];
  if (/["“”]/.test(title)) out.push(coreTokens(title, true));
  return out;
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

/**
 * Words a channel puts around the artist's name ("officialfacetoface", "Face To Face Band",
 * "FaceToFaceVEVO"), "official" also in other languages ("Legendaire Officiel", "米津玄師 公式").
 * Normalised like channel names (NFKD: 공식 is compared as its jamo).
 */
const CHANNEL_AFFIXES = [
  'official', 'vevo', 'music', 'band', 'tv', 'topic', 'channel',
  'officiel', 'oficial', 'offiziell', 'ufficiale', 'officieel', 'oficjalny', 'официальный', '公式', 'オフィシャル', '官方', '공식',
].map(joined);

/**
 * A channel name made of the artist's name in two scripts or forms: "神山羊 / Yoh Kamiyama".
 * Only " / " and " | " with spaces (not "AC/DC"), or their full-width forms.
 */
const CHANNEL_NAME_SPLIT = /\s+[/|]\s+|\s*[／｜]\s*/;

/**
 * Ways the artist may be written in a channel name: artistVariants, also with "&" / "+"
 * spelled "and" and "and" spelled "&" ("Heavy D & The Boyz" -> "HeavyDAndTheBoyzVEVO").
 */
function channelVariants(artist: string): string[] {
  const out = [
    ...artistVariants(artist),
    joined(artist.replace(/\s*[&+]\s*/g, ' and ')),
    joined(artist.replace(/\s+and\s+/gi, ' & ')),
  ];
  return [...new Set(out)].filter((v) => v.length >= 2);
}

/** "and" in a channel's billing ("X and the Y", "X & His Orchestra", "X y La Y", "X con Y"). */
const BILLING_JOIN = /\s+(?:and|y|e|et|und|con|with|avec|mit)\s+|\s*[&+]\s*/gi;
/** Words that start a band billing: "the", "his", "La", "Su", ... */
const BILLING_ARTICLE = new Set([
  'the', 'his', 'her', 'their', 'la', 'el', 'los', 'las', 'le', 'les', 'su', 'sus', 'son', 'sa', 'ses', 'seu', 'sua', 'os', 'die', 'der', 'das', 'seine', 'ihre', 'il',
]);
/** Words that make a billing a band: "X & Orchestra", "X y Conjunto Azul". */
const BILLING_ENSEMBLE = new Set([
  'orchestra', 'orquesta', 'orquestra', 'orchestre', 'orchester', 'band', 'banda', 'boys', 'conjunto', 'grupo', 'combo', 'ensemble',
  'trio', 'quartet', 'quintet', 'crew', 'gang', 'mariachi', 'sonora', 'singers', 'choir', 'coro', 'players', 'allstars',
]);

/** `rest` reads as the artist's band, not another act: "the Boyz", "La Pura Sabrosura", "Orchestra". */
function bandBilling(rest: string): boolean {
  const w = toks(rest);
  return w.length > 0 && (BILLING_ARTICLE.has(w[0]) || w.some((x) => BILLING_ENSEMBLE.has(x)));
}

/**
 * Leading names of a channel billed as "<lead> <and> <band>" ("Fito Olivares Y La Pura
 * Sabrosura" -> "Fito Olivares"). Only the first-billed side: "Calvin Harris & Disciples"
 * is not Disciples', and a duo ("Brooks & Dunn") is not Brooks'.
 */
function billingLeads(channel: string): string[] {
  const out: string[] = [];
  for (const m of channel.matchAll(BILLING_JOIN)) {
    const lead = channel.slice(0, m.index);
    if (lead.trim() && bandBilling(channel.slice(m.index! + m[0].length))) out.push(lead);
  }
  return out;
}

/**
 * The channel is the artist's own: one of its cores spells the artist. A verified channel
 * may also give the name in two forms ("神山羊 / Yoh Kamiyama"), either of which counts, or
 * bill the artist with a band ("Fito Olivares Y La Pura Sabrosura"), when the artist leads.
 */
function isArtistChannel(e: SearchEntry, variants: string[]): boolean {
  const names = [e.channel];
  if (e.verified) {
    const parts = e.channel.split(CHANNEL_NAME_SPLIT).filter((p) => p.trim());
    if (parts.length >= 2) names.push(...parts);
    names.push(...names.flatMap(billingLeads));
  }
  return names.some((n) => channelCores(n).some((c) => variants.includes(c)));
}

/** `j` (joined) without leading / trailing CHANNEL_AFFIXES; at least 3 letters stay. */
function stripAffixes(j: string): string {
  for (let changed = true; changed; ) {
    changed = false;
    for (const a of CHANNEL_AFFIXES) {
      if (j.length - a.length < 3) continue;
      if (j.startsWith(a)) (j = j.slice(a.length)), (changed = true);
      else if (j.endsWith(a)) (j = j.slice(0, -a.length)), (changed = true);
    }
  }
  return j;
}

/**
 * Ways the channel name may spell the artist: joined, with "- Topic", "and 2
 * more" and VEVO removed, with or without the words official / music / tv /
 * channel / vevo, and with CHANNEL_AFFIXES glued to the front or back stripped.
 */
function channelCores(channel: string): string[] {
  const s = channel
    .replace(/\s+and\s+\d+\s+more$/i, '')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '');
  const plain = toks(s).join('');
  const filtered = toks(s)
    .filter((w) => !['official', 'music', 'tv', 'channel', 'vevo'].includes(w))
    .join('')
    .replace(/(?:official|music)$/, '');
  return [...new Set([plain, filtered, stripAffixes(plain), stripAffixes(filtered)])].filter((c) => c.length > 0);
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
    // UK rap/drill premiere platforms: the official music video often appears only there.
    'grm daily', 'mixtape madness', 'link up tv',
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
  ['other media', /\breversed\b|\b\d{3}\s*hz\b|\bbackwards\b|\bbass\s*boost(?:ed)?\b|\btiktok\b|\bchipmunk\b|\b8\s*-?\s*bit\b|\bshorts?\b|\btutorial\b|\bchoreography\b|\bdance (?:video|practice|cover)\b|\blesson\b|\bfan\s*made\b|\bteaser\b|\btrailer\b|\bbehind the scenes\b|\bmaking of\b|\binterview\b/i],
  ['translation', /\blegendad[oa]\b|\btraduc(?:ida|ido|ción|cion|ao|ão)\b|\btradução\b|\btraduzione\b|\bsub(?:titulado|titulada|s?)?\s*(?:español|espanol|ita|pt|br)\b|\bespañol\b|\bespanol\b|перевод|해석|번역|和訳|中字|中文字幕|\bvietsub\b|\bthaisub\b|\bpolskie\b|\bnapisy\b/i],
];

/** Labels that name the released recording itself: "(Album Version)", "(Single Version)", "(Explicit Version)", "(Original Mix)". */
const SAME_RECORDING = /\b(?:album|single|lp|explicit|dirty)\s+version\b|\boriginal\s+mix\b/gi;

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
  /** A label's art track whose credit line names the artist (see creditsArtist). */
  credited: boolean;
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
    const t = label === 'version' || label === 'remix' ? title.replace(SAME_RECORDING, ' ') : title;
    if (re.test(t) && !re.test(reqText)) return label;
    if (BAD_CHANNEL.has(label) && re.test(e.channel) && !re.test(reqText)) return `${label} channel`;
  }
  const words = new Set(toks(title));
  for (const q of requestQualifiers(req.title)) {
    if (!q.every((w) => words.has(w))) return `not the requested "${q.join(' ')}"`;
  }
  const want = requestCore(req.title);
  if (!want.length) return 'empty title';
  // "Artist | Title" / "Artist | 'Title'": the artist's name exactly, then the title.
  const bars = title.split(/\s+\|\s+/);
  if (bars.length >= 2 && variants.includes(joined(bars[0])) && titleReadings(bars[1]).some((r) => sameTokens(r, want))) return null;
  const dash = /\s+[-–—~]+\s+/.exec(title);
  if (dash) {
    const left = title.slice(0, dash.index);
    const right = title.slice(dash.index + dash[0].length);
    const inLeft = mentionsArtist(left, variants);
    const inRight = mentionsArtist(right, variants);
    const isWant = (side: string) => titleReadings(side).some((r) => sameTokens(r, want));
    if ((inLeft && isWant(right)) || (inRight && isWant(left))) return null;
    if (!inLeft && !inRight) return mentionsArtist(e.channel, variants) ? 'different song' : 'different artist';
    return 'different song or artist';
  }
  // No "Artist - Title" separator: the title's words, maybe with the artist's name in them.
  const names = artistTokenLists(req.artist);
  const withoutArtist = (have: string[]) => {
    for (const name of names) {
      const cut = removeRun(have, name);
      if (cut) return cut;
    }
    return have;
  };
  if (!titleReadings(title).some((r) => sameTokens(withoutArtist(r), want))) return 'different song';
  if (mentionsArtist(title, variants) || mentionsArtist(e.channel, variants)) return null;
  return creditsArtist(req, e) ? null : 'artist not named';
}

const PROVIDED = /^\s*provided to youtube by\b/i;
const TOPIC_CHANNEL = /\s-\s*topic$/i;

/**
 * A label's art track ("Release - Topic") whose YouTube-generated credit line
 * ("Provided to YouTube by <label> <Title> · <Artist> · ...") names the
 * requested artist, with exactly the requested title. The credit must follow
 * the upload's own title and start one of the "·" parts with the artist's name.
 */
function creditsArtist(req: SongRequest, e: SearchEntry): boolean {
  if (!PROVIDED.test(e.description) || !TOPIC_CHANNEL.test(e.channel)) return false;
  if (normalizeName(e.title) !== normalizeName(req.title)) return false;
  const parts = e.description.split('·');
  if (parts.length < 2) return false;
  const head = toks(parts[0]);
  const t = toks(e.title);
  if (head.length <= t.length || !t.every((w, i) => head[head.length - t.length + i] === w)) return false;
  const names = artistTokenLists(req.artist);
  return parts.slice(1).some((p) => {
    const words = toks(p);
    return names.some((n) => n.every((w, i) => words[i] === w));
  });
}

function facts(req: SongRequest, e: SearchEntry, chanVariants: string[]): Facts {
  const artistChannel = isArtistChannel(e, chanVariants);
  const label = LABELS.has(joined(e.channel));
  const artTrack = PROVIDED.test(e.description) || TOPIC_CHANNEL.test(e.channel);
  const lyric = LYRIC.test(e.title);
  const audio = /\baudio\b/i.test(e.title);
  return {
    dt: (e.duration ?? NaN) - req.durationSec,
    lyric,
    audio,
    artTrack,
    artistChannel,
    credited: !artistChannel && creditsArtist(req, e),
    official: e.verified && (artistChannel || label) && !artTrack,
    musicVideo: /\bvideo\b|\bmv\b|\bclip\b/i.test(e.title) || !/[([]/.test(withoutRequestBrackets(e.title, req.title)),
  };
}

/**
 * An art track that needs no view count: uploaded by the artist's own verified
 * channel (an impostor can't be verified), or, for a little-known song (no
 * matching upload has KNOWN_SONG_VIEWS), a real "Provided to YouTube by" upload
 * on a "- Topic" channel at the official length (+-1 s).
 */
function genuineArtTrack(e: SearchEntry, f: Facts, knownSong: boolean): boolean {
  if (e.verified && !TOPIC_CHANNEL.test(e.channel)) return true;
  return littleKnownArtTrack(e, f, knownSong);
}

function littleKnownArtTrack(e: SearchEntry, f: Facts, knownSong: boolean): boolean {
  return !knownSong && PROVIDED.test(e.description) && TOPIC_CHANNEL.test(e.channel) && Math.abs(f.dt) <= 1;
}

const BRACKETS = /\(([^)]*)\)|\[([^\]]*)\]/g;

/** A bracket that only describes the song: "(A Hazbin Hotel Song)". */
const DESCRIPTIVE = /^\s*an?\s+\S.*\bsong\s*$/i;

/**
 * `title` without the bracketed parts the requested title has too ("Delilah
 * (pull me out of this)") and without descriptive ones ("(A Hazbin Hotel Song)").
 */
function withoutRequestBrackets(title: string, reqTitle: string): string {
  const own = new Set([...reqTitle.matchAll(BRACKETS)].map((m) => normalizeName(m[1] ?? m[2] ?? '')));
  return title.replace(BRACKETS, (m, a, b) => (own.has(normalizeName(a ?? b ?? '')) || DESCRIPTIVE.test(a ?? b ?? '') ? ' ' : m));
}

/** A bracketed era or style the request doesn't name: "(1920s Style)", "(80s)", "(Swing)". */
const ERA_STYLE = /\b(?:\d{2}|\d{4})'?s\b|\b(?:style|era|vintage|retro|swing|jazz|ragtime|big\s*band)\b/i;
/** A bracketed bare year: "(1920)". Often the original's release year ("(1985)"), so it only counts beside a far more viewed upload. */
const YEAR_TAG = /^\s*\d{4}\s*$/;

function eraTag(title: string, reqTitle: string): 'style' | 'year' | null {
  let out: 'style' | 'year' | null = null;
  for (const m of withoutRequestBrackets(title, reqTitle).matchAll(BRACKETS)) {
    const inner = m[1] ?? m[2] ?? '';
    if (ERA_STYLE.test(inner) && !ERA_STYLE.test(reqTitle)) return 'style';
    if (YEAR_TAG.test(inner)) out = 'year';
  }
  return out;
}

/**
 * Rank the candidates for a request. `ranked` is in the order to try them;
 * `rejected` explains the rest (for logs and tests).
 */
export function rankCandidates(req: SongRequest, entries: SearchEntry[]): { ranked: Ranked[]; rejected: Rejected[] } {
  const variants = artistVariants(req.artist);
  const chanVariants = channelVariants(req.artist);
  const tiers: Record<Tier, { e: SearchEntry; key: number[] }[]> = { official: [], lyric: [], topic: [], 'music-video': [] };
  const rejected: Rejected[] = [];
  const why = new Map(entries.map((e) => [e, mismatch(req, e, variants)]));
  // A song with a popular upload: a genuine art track of it has views too.
  const knownSong = entries.some((e) => why.get(e) === null && (e.views ?? 0) >= KNOWN_SONG_VIEWS);
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
    const whyNot = why.get(e);
    if (whyNot) {
      reject(whyNot);
      continue;
    }
    const f = facts(req, e, chanVariants);
    const views = e.views ?? 0;
    const inWindow = f.dt >= WINDOW[0] && f.dt <= WINDOW[1];
    if (inWindow && f.official && (f.lyric || f.audio)) {
      tiers.official.push({ e, key: [f.lyric ? 0 : 1, -views] });
    } else if (inWindow && f.lyric && !f.artTrack && !f.artistChannel && !/topic/i.test(e.channel)) {
      if (views >= LYRIC_MIN_VIEWS) tiers.lyric.push({ e, key: [-views] });
      else reject(`lyric video with only ${views} views`);
    } else if (inWindow && f.artTrack && f.artistChannel) {
      if (views >= TOPIC_MIN_VIEWS || genuineArtTrack(e, f, knownSong)) tiers.topic.push({ e, key: [-views] });
      else reject(`art track with only ${views} views`);
    } else if (inWindow && f.credited) {
      // A label's art track: only for a little-known song, at the official length.
      if (littleKnownArtTrack(e, f, knownSong)) tiers.topic.push({ e, key: [-views] });
      else reject(knownSong ? 'label art track of a known song' : `label art track ${e.duration} s vs ${req.durationSec} s`);
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
  return { ranked: untaggedFirst(req, ranked), rejected };
}

/**
 * An upload tagged with an era or style the request doesn't name goes after
 * the untagged ones; one tagged with a bare year only after an untagged one
 * with 10x its views ("Insane (1920)", 3.9 M, a 1920s re-arrangement, vs the
 * original's 175 M). Kept, not rejected: it may be all there is.
 */
function untaggedFirst(req: SongRequest, ranked: Ranked[]): Ranked[] {
  const tag = new Map(ranked.map((r) => [r, eraTag(r.entry.title, req.title)]));
  const untagged = ranked.filter((r) => !tag.get(r));
  const most = Math.max(0, ...untagged.map((r) => r.entry.views ?? 0));
  const later = (r: Ranked) => {
    const t = tag.get(r);
    if (t === 'style') return untagged.length > 0;
    return t === 'year' && most > 0 && most >= 10 * (r.entry.views ?? 0);
  };
  return [...ranked.filter((r) => !later(r)), ...ranked.filter(later)];
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
