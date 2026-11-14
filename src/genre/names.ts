/**
 * Genre names: one spelling per genre, a small family tree, and the junk
 * filter. Pure; shared by the cloud job (Node) and the page.
 *
 * Every source spells genres its own way ("hip hop", "Hip-Hop/Rap",
 * "hip-hop music", "trap music", "R&B/Soul", "contemporary R&B"), so names
 * are first reduced to a key (lowercase, no accents, hyphens as spaces, no
 * trailing "music") and then looked up in the vocabulary below. The tree is
 * about genres, never about artists: it only says that "nu metal" is a kind
 * of "alternative metal", which is a kind of "metal", so that agreement and
 * specificity can be scored (see combine.ts).
 *
 * Unknown names from curated sources (Wikipedia, Wikidata) are kept in their
 * normalised spelling; unknown user tags (MusicBrainz) must at least look
 * like a genre. Store labels such as "Soundtrack" or "Holiday", decades,
 * nationalities and "seen live"-style tags are dropped everywhere.
 */

import { mbKnows, wdAncestors, wdKnows, wdSpecificity } from './hierarchy';

/** [display name, parents, aliases]. Roots have no parents. */
type Entry = readonly [name: string, parents: readonly string[], aliases?: readonly string[]];

const ENTRIES: readonly Entry[] = [
  // --- roots (broad families) ---
  ['pop', [], ['pop music', 'popular music', 'pop vocal', 'french pop', 'german pop', 'europop music']],
  ['rock', [], ['rock music', 'classic rock', 'rock and pop', 'arena rock']],
  ['metal', [], ['heavy metal', 'heavy metal music', 'metal music']],
  ['hip hop', [], ['hip hop music', 'hip-hop/rap', 'hip hop/rap', 'rap', 'rap music', 'hiphop', 'rap/hip hop']],
  ['R&B', [], ['r&b', 'rnb', 'r and b', 'r b', 'r&b/soul', 'r and b/soul', 'rhythm and blues', 'contemporary r&b', 'contemporary r and b', 'r&b music', 'urban contemporary']],
  ['soul', [], ['soul music']],
  ['funk', [], ['funk music']],
  ['disco', [], ['disco music']],
  ['electronic', [], ['electronic music', 'electronica', 'electronic/dance']],
  ['dance', [], ['dance music', 'club', 'club music']],
  ['country', [], ['country music']],
  ['latin', [], ['latin music', 'latino', 'latin urban']],
  ['reggae', [], ['reggae music']],
  ['jazz', [], ['jazz music']],
  ['blues', [], ['blues music']],
  ['folk', [], ['folk music', 'traditional folk music', 'traditional folk', 'contemporary folk music']],
  ['classical', [], ['classical music', 'orchestral']],
  ['alternative', [], ['alternative music', 'alternative/indie', 'indie', 'adult alternative', 'indie alternative']],
  ['punk', [], ['punk rock', 'punk music']],
  ['gospel', [], ['gospel music', 'christian', 'christian music', 'contemporary christian', 'ccm', 'worship', 'christian & gospel']],
  ['world', [], ['world music', 'worldwide', 'african', 'african music']],
  ['industrial', ['electronic', 'rock'], ['industrial music']],
  ['novelty', [], ['novelty song', 'comedy music']],

  // --- pop ---
  ['dance-pop', ['pop', 'dance'], ['dance pop', 'pop dance', 'dance/pop']],
  ['synth-pop', ['pop', 'electronic'], ['synthpop', 'technopop', 'synth pop']],
  ['electropop', ['pop', 'electronic'], ['electro pop', 'electro-pop']],
  ['teen pop', ['pop']],
  ['bubblegum pop', ['pop'], ['bubblegum']],
  ['pop rock', ['pop', 'rock'], ['pop/rock', 'rock/pop', 'pop-rock', 'pop rock music']],
  ['power pop', ['pop', 'rock']],
  ['indie pop', ['pop', 'alternative'], ['indiepop', 'indie-pop']],
  ['alt-pop', ['pop', 'alternative'], ['alternative pop', 'alt pop']],
  ['art pop', ['pop']],
  ['psychedelic pop', ['pop'], ['psych pop']],
  ['dream pop', ['pop', 'alternative']],
  ['baroque pop', ['pop']],
  ['chamber pop', ['pop']],
  ['bedroom pop', ['pop', 'alternative']],
  ['hyperpop', ['pop', 'electronic']],
  ['sophisti-pop', ['pop']],
  ['europop', ['pop', 'dance'], ['euro pop', 'euro-pop']],
  ['K-pop', ['pop'], ['kpop', 'k pop', 'korean pop']],
  ['J-pop', ['pop'], ['jpop', 'j pop']],
  ['C-pop', ['pop'], ['mandopop', 'cantopop']],
  ['Latin pop', ['pop', 'latin'], ['pop latino', 'latin pop music']],
  ['country pop', ['country', 'pop']],
  ['pop rap', ['pop', 'hip hop'], ['pop-rap', 'pop hip hop']],
  ['pop soul', ['pop', 'soul'], ['soul pop', 'soul-pop']],
  ['soft rock', ['rock', 'pop']],
  ['adult contemporary', ['pop'], ['adult contemporary music']],
  ['blue-eyed soul', ['soul', 'pop']],
  ['new wave', ['rock', 'pop'], ['new wave music']],
  ['disco-pop', ['pop', 'disco'], ['disco pop', 'pop disco']],
  ['Eurodance', ['dance', 'electronic'], ['euro dance', 'euro-dance']],
  ['Hi-NRG', ['dance', 'disco'], ['hi nrg', 'high energy']],

  // --- rock ---
  ['alternative rock', ['rock', 'alternative'], ['alt rock', 'alt-rock', 'alternative rock music', 'modern rock']],
  ['indie rock', ['rock', 'alternative']],
  ['hard rock', ['rock']],
  ['pop punk', ['punk', 'pop', 'rock'], ['pop-punk']],
  ['emo', ['punk', 'rock'], ['emo music']],
  ['emo pop', ['emo', 'pop'], ['emo-pop']],
  ['post-grunge', ['rock', 'alternative'], ['post grunge']],
  ['grunge', ['rock', 'alternative']],
  ['funk rock', ['funk', 'rock'], ['funk-rock']],
  ['rap rock', ['rock', 'hip hop'], ['rap-rock']],
  ['electronic rock', ['rock', 'electronic'], ['electro rock', 'electro-rock']],
  ['dance-rock', ['rock', 'dance'], ['dance rock']],
  ['dance-punk', ['punk', 'dance'], ['dance punk']],
  ['garage rock', ['rock']],
  ['psychedelic rock', ['rock'], ['psychedelia']],
  ['neo-psychedelia', ['rock', 'alternative'], ['neo psychedelia', 'neopsychedelia']],
  ['space rock', ['rock']],
  ['synth-rock', ['rock', 'electronic'], ['synth rock']],
  ['progressive rock', ['rock'], ['prog rock', 'prog']],
  ['heartland rock', ['rock']],
  ['blues rock', ['blues', 'rock']],
  ['folk rock', ['folk', 'rock']],
  ['gothic rock', ['rock'], ['goth rock', 'goth']],
  ['symphonic rock', ['rock']],
  ['piano rock', ['rock', 'pop']],
  ['art rock', ['rock']],
  ['glam rock', ['rock']],
  ['rock and roll', ['rock'], ['rock n roll', 'rock & roll', 'rock\'n\'roll', 'rock n\' roll']],
  ['rockabilly', ['rock', 'country']],
  ['southern rock', ['rock']],
  ['surf rock', ['rock'], ['surf']],
  ['stoner rock', ['rock']],
  ['Britpop', ['rock', 'pop', 'alternative'], ['brit pop']],
  ['post-punk', ['punk', 'rock'], ['post punk']],
  ['post-hardcore', ['punk', 'rock'], ['post hardcore']],
  ['hardcore punk', ['punk'], ['hardcore']],
  ['skate punk', ['punk']],
  ['ska punk', ['punk', 'reggae']],
  ['post-rock', ['rock']],
  ['experimental rock', ['rock']],
  ['industrial rock', ['industrial', 'rock']],
  ['yacht rock', ['rock', 'pop']],
  ['Latin rock', ['latin', 'rock']],
  ['country rock', ['country', 'rock']],
  ['indie folk', ['folk', 'alternative'], ['alternative folk', 'alt-folk', 'indie-folk']],
  ['folk pop', ['folk', 'pop']],
  ['singer-songwriter', ['folk'], ['singer/songwriter', 'singer songwriter']],

  // --- metal ---
  ['alternative metal', ['metal', 'alternative'], ['alt metal', 'alt-metal']],
  ['nu metal', ['alternative metal'], ['nu-metal', 'numetal']],
  ['rap metal', ['metal', 'hip hop'], ['rap-metal']],
  ['gothic metal', ['metal'], ['goth metal']],
  ['symphonic metal', ['metal']],
  ['metalcore', ['metal', 'punk']],
  ['thrash metal', ['metal'], ['thrash']],
  ['death metal', ['metal']],
  ['black metal', ['metal']],
  ['power metal', ['metal']],
  ['groove metal', ['metal']],
  ['progressive metal', ['metal']],
  ['glam metal', ['metal', 'rock'], ['hair metal']],
  ['industrial metal', ['metal', 'industrial']],

  // --- hip hop ---
  ['trap', ['hip hop'], ['trap music', 'trap rap', 'atlanta trap']],
  ['drill', ['hip hop'], ['drill music', 'drill rap']],
  ['UK drill', ['drill'], ['uk drill music']],
  ['Chicago drill', ['drill']],
  ['Brooklyn drill', ['drill'], ['new york drill', 'ny drill']],
  ['gangsta rap', ['hip hop'], ['gangsta']],
  ['conscious hip hop', ['hip hop'], ['conscious rap', 'political hip hop']],
  ['alternative hip hop', ['hip hop', 'alternative'], ['alternative rap', 'alt hip hop']],
  ['southern hip hop', ['hip hop'], ['dirty south', 'southern rap']],
  ['East Coast hip hop', ['hip hop'], ['east coast rap']],
  ['West Coast hip hop', ['hip hop'], ['west coast rap']],
  ['Midwest hip hop', ['hip hop']],
  ['crunk', ['hip hop', 'dance']],
  ['hyphy', ['hip hop']],
  ['boom bap', ['hip hop']],
  ['emo rap', ['hip hop', 'emo'], ['emo hip hop']],
  ['cloud rap', ['hip hop']],
  ['mumble rap', ['trap']],
  ['jazz rap', ['hip hop', 'jazz'], ['jazz hip hop']],
  ['G-funk', ['hip hop', 'funk'], ['g funk']],
  ['hip house', ['hip hop', 'house']],
  ['trip hop', ['electronic', 'hip hop'], ['trip-hop']],
  ['grime', ['hip hop', 'electronic']],
  ['comedy hip hop', ['hip hop', 'novelty'], ['comedy rap']],
  ['Christian hip hop', ['hip hop', 'gospel']],
  ['country rap', ['country', 'hip hop'], ['hick hop']],
  ['Latin trap', ['latin', 'trap']],
  ['plugg', ['trap']],
  ['rage', ['trap']],

  // --- R&B / soul / funk / disco ---
  ['neo soul', ['soul', 'R&B'], ['neo-soul']],
  ['new jack swing', ['R&B', 'hip hop'], ['swingbeat']],
  ['quiet storm', ['R&B']],
  ['alternative R&B', ['R&B', 'alternative'], ['alternative r and b', 'pbr&b']],
  ['hip hop soul', ['R&B', 'hip hop']],
  ['doo-wop', ['R&B'], ['doo wop']],
  ['Motown', ['soul'], ['motown sound']],
  ['Philadelphia soul', ['soul'], ['philly soul']],
  ['Northern soul', ['soul']],
  ['Southern soul', ['soul']],
  ['psychedelic soul', ['soul']],
  ['P-Funk', ['funk'], ['p funk']],
  ['electro-funk', ['funk', 'electronic'], ['electrofunk', 'electro funk']],
  ['boogie', ['funk', 'disco'], ['post-disco boogie']],
  ['funk-pop', ['funk', 'pop'], ['funk pop', 'pop-funk', 'pop funk']],
  ['disco-funk', ['disco', 'funk'], ['disco funk']],
  ['electro-disco', ['disco', 'electronic'], ['electro disco', 'electrodisco']],
  ['post-disco', ['disco'], ['post disco']],
  ['Euro disco', ['disco'], ['euro-disco', 'eurodisco']],
  ['Italo disco', ['disco'], ['italo-disco', 'italo']],
  ['nu-disco', ['disco', 'dance'], ['nu disco', 'neo-disco', 'disco revival']],

  // --- electronic / dance ---
  ['EDM', ['electronic', 'dance'], ['electronic dance music', 'electronic dance', 'dance/electronic', 'electro dance']],
  ['house', ['electronic', 'dance'], ['house music']],
  ['deep house', ['house']],
  ['progressive house', ['house']],
  ['electro house', ['house'], ['electro-house']],
  ['big room house', ['house'], ['big room']],
  ['tropical house', ['house'], ['tropical-house']],
  ['future house', ['house']],
  ['tech house', ['house']],
  ['French house', ['house'], ['french touch']],
  ['Chicago house', ['house']],
  ['acid house', ['house']],
  ['techno', ['electronic', 'dance']],
  ['trance', ['electronic', 'dance'], ['trance music']],
  ['dubstep', ['electronic']],
  ['brostep', ['dubstep']],
  ['complextro', ['electro house']],
  ['moombahton', ['electronic', 'dance']],
  ['moombahcore', ['moombahton', 'dubstep']],
  ['drum and bass', ['electronic'], ['drum & bass', 'drum n bass', 'dnb', 'd&b', 'jungle']],
  ['future bass', ['electronic']],
  ['electro', ['electronic'], ['electro music']],
  ['electroclash', ['electronic']],
  ['hardstyle', ['electronic', 'dance']],
  ['synthwave', ['electronic'], ['retrowave', 'outrun']],
  ['chillwave', ['electronic']],
  ['downtempo', ['electronic']],
  ['ambient', ['electronic'], ['ambient music']],
  ['IDM', ['electronic'], ['intelligent dance music']],
  ['electro swing', ['electronic', 'jazz']],
  ['breakbeat', ['electronic']],
  ['big beat', ['electronic']],
  ['UK garage', ['electronic', 'dance'], ['uk garage music', '2-step', '2 step garage']],
  ['trap EDM', ['electronic', 'trap'], ['edm trap', 'festival trap']],

  // --- country ---
  ['bro-country', ['country'], ['bro country']],
  ['alt-country', ['country', 'alternative'], ['alternative country']],
  ['bluegrass', ['country', 'folk']],
  ['Americana', ['country', 'folk']],
  ['honky-tonk', ['country'], ['honky tonk']],
  ['outlaw country', ['country']],

  // --- latin / world / reggae ---
  ['reggaeton', ['latin'], ['reggaetón', 'reguetón', 'regueton']],
  ['urbano', ['latin', 'hip hop'], ['urbano latino', 'latin urbano', 'música urbana', 'musica urbana']],
  ['tropical', ['latin'], ['musica tropical', 'tropical music', 'latin tropical', 'salsa y tropical']],
  ['salsa', ['tropical']],
  ['bachata', ['tropical']],
  ['merengue', ['tropical']],
  ['cumbia', ['tropical']],
  ['dembow', ['latin']],
  ['bossa nova', ['latin', 'jazz']],
  ['flamenco', ['latin']],
  ['tango', ['latin']],
  ['samba', ['latin']],
  ['mambo', ['latin']],
  ['cha-cha-chá', ['latin'], ['cha cha cha', 'cha-cha']],
  ['regional Mexican', ['latin'], ['regional mexicano', 'musica mexicana', 'música mexicana', 'mexican regional']],
  ['banda', ['regional Mexican']],
  ['corrido', ['regional Mexican'], ['corridos', 'corridos tumbados']],
  ['Afrobeats', ['world', 'pop'], ['afrobeats music', 'afropop', 'afro pop', 'afro-pop', 'afrobeat pop']],
  ['Afrobeat', ['world', 'funk'], ['afro-beat']],
  ['amapiano', ['world', 'house']],
  ['soca', ['world', 'dance']],
  ['calypso', ['world']],
  ['zouk', ['world']],
  ['highlife', ['world']],
  ['bhangra', ['world', 'dance']],
  ['dancehall', ['reggae'], ['dancehall music', 'ragga']],
  ['dancehall pop', ['dancehall', 'pop'], ['dancehall-pop']],
  ['ska', ['reggae']],
  ['dub', ['reggae']],
  ['roots reggae', ['reggae']],
  ['reggae fusion', ['reggae', 'pop']],
  ['rocksteady', ['reggae']],

  // --- jazz / blues / classical / other ---
  ['smooth jazz', ['jazz']],
  ['swing', ['jazz'], ['swing music']],
  ['big band', ['jazz']],
  ['acid jazz', ['jazz', 'funk']],
  ['jazz fusion', ['jazz'], ['fusion']],
  ['jazz pop', ['jazz', 'pop'], ['jazz-pop']],
  ['vocal jazz', ['jazz']],
  ['bebop', ['jazz']],
  ['electric blues', ['blues']],
  ['opera', ['classical']],
  ['neoclassical', ['classical'], ['neo-classical']],
  ['Celtic', ['folk', 'world'], ['celtic music']],
  ['show tunes', [], ['musical theatre', 'musical theater', 'broadway']],
  ['children\'s music', [], ['children\'s', 'kids', 'children']],
];

/**
 * Names that are never a genre for this purpose, from any source: store
 * shelves, formats, moods, eras, places and listening habits.
 */
const JUNK = new Set(
  [
    'soundtrack', 'soundtracks', 'film soundtrack', 'original soundtrack', 'film score', 'score', 'tv soundtrack', 'video game music', 'anime',
    'music', 'musica', 'song', 'songs', 'single', 'singles', 'album', 'ep', 'other', 'unknown', 'misc', 'various', 'none', 'n a',
    'holiday', 'christmas', 'fitness workout', 'fitness and workout', 'fitness & workout', 'workout', 'karaoke', 'instrumental', 'acoustic', 'vocal', 'vocals',
    'cover', 'covers', 'live', 'remix', 'remixes', 'mashup', 'ballad', 'ballads', 'power ballad', 'love song', 'love songs', 'love',
    'seen live', 'favorite', 'favorites', 'favourite', 'favourites', 'my favorite', 'awesome', 'beautiful', 'catchy', 'sexy', 'cool', 'fun',
    'party', 'summer', 'chill', 'sad', 'happy', 'epic', 'classic', 'classics', 'oldies', 'hits', 'top 40', 'top hits', 'chart', 'charts',
    'radio', 'billboard', 'number one', 'number one hit', 'eurovision', 'viral', 'tiktok', 'meme', 'spotify',
    'female vocalists', 'female vocalist', 'male vocalists', 'male vocalist', 'female vocals', 'male vocals', 'female', 'male', 'duet',
    'american', 'british', 'english', 'uk', 'usa', 'us', 'canadian', 'australian', 'swedish', 'korean', 'japanese', 'irish', 'scottish',
    'french', 'german', 'norwegian', 'danish', 'dutch', 'italian', 'spanish', 'puerto rican', 'colombian', 'barbadian', 'mexican',
    'brazilian', 'jamaican', 'nigerian', 'new zealand', 'welsh', 'belgian', 'finnish',
    'spoken word', 'edits', 'general', 'pop general', 'todd in the shadows', 'rapping', 'singing', 'stage and screen', 'music video', 'comedy', 'easy listening', 'lounge', 'background',
  ].map((s) => keyOf(s)),
);

/** Matching key: lowercase, accents dropped, "&" kept, hyphens/slashes/punctuation as spaces, trailing "music"/"song" dropped. */
export function keyOf(name: string): string {
  return (name ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s*\((?:music|genre|music genre|musical genre)\)\s*$/, '')
    .replace(/[^\p{L}\p{N}&']+/gu, ' ')
    .replace(/'/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/ (?:music|genre)$/, '');
}

interface Node {
  name: string;
  parents: string[];
}

const NODES = new Map<string, Node>();
const ALIASES = new Map<string, string>();
for (const [name, parents] of ENTRIES) {
  const k = keyOf(name);
  NODES.set(k, { name, parents: parents.map(keyOf) });
  ALIASES.set(k, k);
}
for (const [name, , aliases] of ENTRIES) {
  const k = keyOf(name);
  for (const a of aliases ?? []) {
    const ak = keyOf(a);
    if (!ALIASES.has(ak)) ALIASES.set(ak, k);
  }
}

const depthCache = new Map<string, number>();
function depthOfKey(k: string, seen = new Set<string>()): number {
  const cached = depthCache.get(k);
  if (cached !== undefined) return cached;
  const node = NODES.get(k);
  if (!node || !node.parents.length || seen.has(k)) return 0;
  seen.add(k);
  const d = 1 + Math.min(...node.parents.map((p) => depthOfKey(p, seen)));
  depthCache.set(k, d);
  return d;
}

const ancestorCache = new Map<string, Set<string>>();
function ancestorsOfKey(k: string): Set<string> {
  let out = ancestorCache.get(k);
  if (out) return out;
  out = new Set<string>();
  const stack = [...(NODES.get(k)?.parents ?? [])];
  while (stack.length) {
    const p = stack.pop()!;
    if (out.has(p) || p === k) continue;
    out.add(p);
    stack.push(...(NODES.get(p)?.parents ?? []));
  }
  ancestorCache.set(k, out);
  return out;
}

/** An unknown user tag looks like a genre when it ends in a known genre: "melodic dubstep", "contemporary folk", "uk hip hop". */
function endsInKnownGenre(k: string): boolean {
  const words = k.split(' ');
  for (let i = 1; i < words.length; i++) if (ALIASES.has(words.slice(i).join(' '))) return true;
  return false;
}

export interface GenreName {
  /** Display spelling, e.g. "hip hop", "R&B", "nu metal". */
  name: string;
  /** Matching key (same for every spelling of the genre). */
  key: string;
  /** In the vocabulary (has a place in the family tree). */
  known: boolean;
}

/**
 * One genre name as a source spelled it -> the common spelling, or null when
 * it is junk. `strict` (user tags): unknown names must be at most three words
 * and end in a known genre.
 */
export function canonicalGenre(raw: string, strict = false): GenreName | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 60) return null;
  const k = keyOf(text);
  if (!k || JUNK.has(k) || /^\d+$/.test(k) || /^(?:\d0|\d{4}) ?s$/.test(k) || /^(?:19|20)\d0s?$/.test(k)) return null;
  const known = ALIASES.get(k);
  if (known) return { name: NODES.get(known)!.name, key: known, known: true };
  if (strict && (k.split(' ').length > 3 || !(endsInKnownGenre(k) || mbKnows(k) || wdKnows(k)))) return null;
  if (/\b(?:song|songs|album|single|ep|records|label|band|singer|rapper)\b/.test(k)) return null;
  return { name: k, key: k, known: false };
}

/**
 * A source's list of names -> canonical genres, in order, without duplicates.
 * Compound store labels ("Hip-Hop/Rap", "R&B/Soul") are known aliases; other
 * names with a slash are split.
 */
export function canonicalGenres(raw: readonly string[], strict = false): GenreName[] {
  const out: GenreName[] = [];
  const seen = new Set<string>();
  const push = (g: GenreName | null) => {
    if (g && !seen.has(g.key)) {
      seen.add(g.key);
      out.push(g);
    }
  };
  for (const r of raw) {
    if (typeof r !== 'string') continue;
    const whole = canonicalGenre(r, strict);
    if (whole?.known || !/[/]/.test(r)) push(whole);
    else for (const part of r.split('/')) push(canonicalGenre(part, strict));
  }
  return out;
}

/** 0 for a broad family ("rock"), 1 for a genre ("hard rock"), 2+ for subgenres ("nu metal") in the hand tree; unknown names count as 1. */
export function specificity(key: string): number {
  return NODES.has(key) ? depthOfKey(key) : 1;
}

/** Every spelling of a key that the generated vocabulary may know it by: the key, its display name, its aliases. */
const SPELLINGS = new Map<string, string[]>();
for (const [alias, k] of ALIASES) SPELLINGS.set(k, [...(SPELLINGS.get(k) ?? []), alias]);
function spellings(key: string): string[] {
  return [key, ...(SPELLINGS.get(key) ?? []).filter((a) => a !== key)];
}

/**
 * Broader genres Wikidata's subclass graph gives a key, in this file's
 * spelling. Umbrellas over a third of all genres ("popular music", "regional
 * music") are left out: they say nothing, and "popular music" would read as
 * "pop".
 */
const wdAncCache = new Map<string, Set<string>>();
function wdAncestorsCanon(key: string): Set<string> {
  let out = wdAncCache.get(key);
  if (out) return out;
  out = new Set<string>();
  for (const a of wdAncestors(spellings(key))) {
    if (tooBroad(a)) continue;
    const c = ALIASES.get(a) ?? a;
    if (c !== key) out.add(c);
  }
  wdAncCache.set(key, out);
  return out;
}

function tooBroad(wdKey: string): boolean {
  const s = wdSpecificity(wdKey);
  return s !== null && s < 0.05;
}

/** Every broader genre of a genre (not itself): the hand tree's, plus Wikidata's. */
const allAncCache = new Map<string, ReadonlySet<string>>();
export function ancestors(key: string): ReadonlySet<string> {
  const cached = allAncCache.get(key);
  if (cached) return cached;
  const hand = ancestorsOfKey(key);
  const wd = wdAncestorsCanon(key);
  if (!wd.size) {
    allAncCache.set(key, hand);
    return hand;
  }
  const out = new Set(hand);
  for (const a of wd) {
    out.add(a);
    for (const b of ancestorsOfKey(a)) out.add(b);
  }
  out.delete(key);
  allAncCache.set(key, out);
  return out;
}

/** Whether one genre is a broader or narrower form of the other (not the same). */
export function related(a: string, b: string): boolean {
  return a !== b && (ancestors(a).has(b) || ancestors(b).has(a));
}

/** Whether `broad` is a broader form of `narrow`. */
export function broaderThan(broad: string, narrow: string): boolean {
  return broad !== narrow && ancestors(narrow).has(broad) && !ancestors(broad).has(narrow);
}

/** The broad families (roots of the hand tree) a genre belongs to, through either tree; empty when nothing places it. */
export function families(key: string): string[] {
  const node = NODES.get(key);
  if (node && !node.parents.length) return [key];
  const out = new Set<string>();
  for (const a of ancestors(key)) if (NODES.has(a) && !NODES.get(a)!.parents.length) out.add(a);
  return [...out].sort();
}

/**
 * How specific a genre is, 0..1: Wikidata's measure (hierarchy.ts: subclass
 * depth and number of subgenres) when the generated vocabulary knows the
 * name, else the hand tree's depth (root 0.1, genre 0.5, subgenre 0.75);
 * 0.5 for names neither knows.
 */
export function genreSpecificity(key: string): number {
  for (const s of spellings(key)) {
    const wd = wdSpecificity(s);
    if (wd !== null) return wd;
  }
  return NODES.has(key) ? [0.1, 0.5, 0.75][Math.min(2, depthOfKey(key))] : 0.5;
}

/** Display name of a key (vocabulary spelling, or the key itself). */
export function displayName(key: string): string {
  return NODES.get(key)?.name ?? key;
}
