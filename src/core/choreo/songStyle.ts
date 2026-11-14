/**
 * A song's dance style: which move families it leans toward, which
 * sub-styles clearly apply (metal, trap, house, reggaeton ...), how calm it
 * is, which body parts to favour, and theme hints from its title. Pure
 * TypeScript (no DOM), deterministic.
 *
 * Style comes from the SONG, mechanically: there is no artist table. Inputs:
 *   - curated per-song style (the starter pack's `style`, or `song.style`):
 *     families, focus, themes, signature, as written;
 *   - genre names of the song: `genres` (e.g. a Wikipedia infobox list, most
 *     important first) as the primary evidence, the single `genre` tag
 *     (iTunes `primaryGenreName`) as the fallback and a tie-breaker. Each
 *     name is read by its words and known compounds ("Southern hip hop",
 *     "nu metal", "dance-pop", "drum and bass"), several names BLEND (order
 *     weights them), and a name nothing places is ignored, not guessed;
 *   - the song's absolute audio traits (songTraits.ts, from the beat map):
 *     they decide the CHARACTER on top of any genre (calm, heavy,
 *     four-on-the-floor, half-time feel ...), and the lean itself when there
 *     is no genre at all;
 *   - tempo (a weak prior, <= 15 %), title keywords (themes, a calm hint);
 *   - `artistGenre`: the artist's usual genre, a small blended score (at
 *     most ARTIST_SHARE of the families and of each sub-style score), never
 *     the base.
 *
 * The genre family comes from the track's genre names; the character from
 * the audio: "Hard Rock" says nothing about My Immortal being a piano
 * ballad, its calm trait does. A calm song keeps its family for the label
 * ("Rock · Ballad"), leans a little toward pop, and closes the showpiece
 * genre sets (genres.ts calmGate); the generator turns the calm into smooth,
 * low-impact flowing moves and longer holds.
 *
 * Resolution of the families: curated (source 'override') > genre names
 * ('genre') > traits ('traits') > a balanced mix ('fallback').
 */
import starterData from '../../data/starter.json';
import { FAMILIES, FAMILY_LABEL, FOCI, isFamily, isTheme, THEMES, type Family, type Focus, type Theme } from './families';
import { calmGate, CALM_CLOSED, GENRE_LABEL, SUB_STYLES, isSubStyle, type SubStyle } from './genres';
import { readTraits, type SongTraits } from './songTraits';

export type { SongTraits } from './songTraits';

export interface SongStyle {
  /** Weights, normalised to sum 1. */
  families: Partial<Record<Family, number>>;
  /** Multipliers around 1 (e.g. hips: 1.6). */
  focus?: Partial<Record<Focus, number>>;
  themes: Theme[];
  /** Move ids, passed through from curated data. */
  signature?: string[];
  /** Where the families came from, for debugging / tests. */
  source: 'override' | 'genre' | 'traits' | 'fallback';
  /** Sub-style scores 0..1 (only those above SUB_KEEP); genres.ts opens those >= SUB_OPEN. */
  subs?: Partial<Record<SubStyle, number>>;
  /** The song's calm 0..1 (1 = a quiet ballad, 0 = driving); undefined = unknown (neutral). */
  calm?: number;
  /** Display name of the bass-music sub-style when a genre name said which ("Dubstep", "Drum & bass", "Phonk"). */
  subName?: string;
}

export interface StyleOverride {
  families?: Partial<Record<Family, number>>;
  focus?: Partial<Record<Focus, number>>;
  themes?: string[];
  signature?: string[];
}

export interface SongInfo {
  videoId?: string;
  title?: string;
  artist?: string;
  /** The track's single genre tag (iTunes primaryGenreName): fallback and tie-breaker. */
  genre?: string;
  /** The song's own genre names, most important first (e.g. its Wikipedia infobox): primary evidence. */
  genres?: readonly string[];
  /** The artist's usual genre: a small blended score at most, never the base. */
  artistGenre?: string;
  style?: StyleOverride;
}

export interface StylePriors {
  bpm?: number;
  /**
   * Mean section energy 0..1. Kept for callers, not used: section energy is
   * relative within a song (a ballad's chorus is its own peak), so it says
   * nothing absolute about the song. The traits do.
   */
  energy?: number;
  /** The beat map's absolute audio traits (validated here). */
  traits?: SongTraits | unknown;
}

type Weights = Partial<Record<Family, number>>;
type FocusMap = Partial<Record<Focus, number>>;
type Subs = Partial<Record<SubStyle, number>>;

/** Fallback mix: pop strongest, then a bit of everything so unknown songs still get variety. */
export const BALANCED_POP: SongStyle = Object.freeze({
  families: Object.freeze({ pop: 0.28, hiphop: 0.15, disco: 0.13, aerobic: 0.11, funk: 0.1, latin: 0.09, party: 0.06, rock: 0.04, kpop: 0.04 }),
  themes: [],
  source: 'fallback',
}) as SongStyle;

/** Largest share the artist's genre may take of the families and of any sub-style score. */
export const ARTIST_SHARE = 0.12;
/** Sub-style scores below this are dropped from the style. */
const SUB_KEEP = 0.2;
/** A sub-style names the label from this score. */
export const SUB_LABEL = 0.55;
/** Calm at / above which the label says "Ballad". */
export const BALLAD_CALM = 0.7;

// ---------------------------------------------------------------------------
// Helpers

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** 0 at / below a, 1 at / above b, linear between. */
const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a));

/** Keep valid families with positive finite weights, scaled to sum 1; null when nothing is left. */
function normWeights(w: unknown): Weights | null {
  if (!w || typeof w !== 'object') return null;
  let sum = 0;
  const raw = w as Record<string, unknown>;
  for (const f of FAMILIES) {
    const v = raw[f];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) sum += v;
  }
  if (!(sum > 0)) return null;
  const out: Weights = {};
  for (const f of FAMILIES) {
    const v = raw[f];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[f] = v / sum;
  }
  return out;
}

function blend(a: Weights, b: Weights, share: number): Weights {
  const out: Weights = {};
  for (const f of FAMILIES) {
    const v = (1 - share) * (a[f] ?? 0) + share * (b[f] ?? 0);
    if (v > 0) out[f] = v;
  }
  return normWeights(out) ?? a;
}

/** Valid focus keys with positive finite multipliers (clamped to 0.25..3); null when empty. */
function normFocus(f: unknown): FocusMap | null {
  if (!f || typeof f !== 'object') return null;
  const out: FocusMap = {};
  let any = false;
  for (const k of FOCI) {
    const v = (f as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = Math.max(0.25, Math.min(3, v));
      any = true;
    }
  }
  return any ? out : null;
}

function themesOf(list: unknown): Theme[] {
  return Array.isArray(list) ? list.filter(isTheme) : [];
}

/** Lowercase, accents stripped. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// (a) Starter pack curated styles

const STARTER_STYLES: ReadonlyMap<string, StyleOverride> = (() => {
  const m = new Map<string, StyleOverride>();
  for (const raw of starterData as unknown[]) {
    const e = raw as { videoId?: unknown; style?: unknown } | null;
    if (e && typeof e.videoId === 'string' && e.style && typeof e.style === 'object') m.set(e.videoId, e.style as StyleOverride);
  }
  return m;
})();

// ---------------------------------------------------------------------------
// Artist credits (signature nods only: an artist never decides a style)

/** Artist name -> canonical key: accents, punctuation, spaces, "and"/"&" and a leading "the" removed. */
export function artistKey(name: string): string {
  const tokens = fold(name)
    .replace(/\$/g, 's')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (tokens[0] === 'the' && tokens.length > 1) tokens.shift();
  return tokens.filter((t) => t !== 'and').join('');
}

const STRONG_SEP = /\s+(?:feat\.?|ft\.?|featuring|with|x|×|vs\.?|versus)\s+|\s*[()[\]]\s*/;
const WEAK_SEP = /\s*(?:,|&|\+|\/|;|\s(?:and)\s)\s*/;

/** Lookup keys for an artist credit: the whole credit, then each collaborator. */
export function artistCandidates(credit: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const k = artistKey(s);
    if (k && !out.includes(k)) out.push(k);
  };
  const folded = fold(credit);
  add(folded);
  for (const seg of folded.split(STRONG_SEP)) {
    if (!seg.trim()) continue;
    add(seg);
    for (const piece of seg.split(WEAK_SEP)) if (piece.trim()) add(piece);
  }
  return out;
}

// ---------------------------------------------------------------------------
// (b) Genre names, read by words and compounds
//
// Each genre name is normalised ("R&B/Soul" -> "r and b soul", "Hip-Hop/Rap"
// -> "hip hop rap", "Rock 'n' Roll" -> "rock n roll") and run through the
// lexicon in order: compounds first; what an entry matches is removed, so
// "nu metal" doesn't also read as plain "metal" and "liquid funk" not as funk.
// Everything a name matches adds up: its families (then normalised per name),
// sub-style evidence (max), themes, focus, a calm hint.

interface Lex {
  re: RegExp;
  fam: Weights;
  sub?: Subs;
  themes?: Theme[];
  focus?: FocusMap;
  /** Calm hint 0..1 (a ballad is calm whatever the traits are missing). */
  calm?: number;
  /** Display name for the bass-music sub-style. */
  name?: string;
  /** Confidence of the entry (a vague name like "Soundtrack" says little). */
  conf?: number;
}

const word = (alts: string) => new RegExp(`(?<![a-z0-9])(?:${alts})(?![a-z0-9])`, 'g');
const HIPS: FocusMap = { hips: 1.3 };

const LEXICON: readonly Lex[] = [
  // --- Compounds that contain another entry's words.
  { re: word('k pop|kpop|korean pop|k rap|korean'), fam: { kpop: 1, pop: 0.4, hiphop: 0.2 } },
  { re: word('j pop|j rock|anime|c pop|mandopop|cantopop|city pop|j pop rock'), fam: { pop: 0.8, kpop: 0.5, rock: 0.1 } },
  { re: word('latin trap'), fam: { latin: 0.8, hiphop: 0.6 }, sub: { reggaeton: 0.7, trap: 0.5 }, focus: HIPS },
  { re: word('reggaeton|dembow|perreo|neoperreo|urbano latino|urbano|latin urban|musica urbana|latin rap|latin hip hop'), fam: { latin: 1, hiphop: 0.4 }, sub: { reggaeton: 1 }, focus: HIPS },
  { re: word('moombahton'), fam: { latin: 0.6, aerobic: 0.4 }, sub: { reggaeton: 0.6 }, focus: HIPS },
  { re: word('baile funk|funk carioca|brazilian funk|funk brasileiro|funk ostentacao|brega funk'), fam: { latin: 0.8, hiphop: 0.4 }, sub: { brazil: 1 }, focus: HIPS },
  { re: word('bossa nova'), fam: { latin: 0.8, pop: 0.3 }, sub: { brazil: 0.8 }, calm: 0.7 },
  { re: word('samba|axe|pagode|sertanejo|forro|frevo|mpb|musica popular brasileira|brazilian|brasil'), fam: { latin: 1, pop: 0.2 }, sub: { brazil: 1 }, focus: { hips: 1.4 } },
  { re: word('amapiano|gqom|kwaito|south african house'), fam: { latin: 0.5, hiphop: 0.5, pop: 0.3 }, sub: { amapiano: 1 }, themes: ['afro', 'amapiano'], focus: HIPS },
  { re: word('afro house|afro tech'), fam: { aerobic: 0.4, latin: 0.4, disco: 0.3 }, sub: { house: 0.7 }, themes: ['afro'], focus: HIPS },
  { re: word('afrobeats?|afro beats?|afro pop|afropop|afro fusion|afrofusion|afroswing|afro swing|highlife|naija|alte|afro|african'), fam: { latin: 0.5, hiphop: 0.5, pop: 0.4 }, themes: ['afro'], focus: HIPS },
  { re: word('reggae fusion|dancehall|ragga|raggamuffin'), fam: { latin: 0.5, hiphop: 0.4, pop: 0.3 }, themes: ['dancehall'], focus: HIPS },
  { re: word('ska punk|skacore|third wave ska'), fam: { rock: 1, pop: 0.2 }, sub: { punk: 1 } },
  { re: word('ska|rocksteady'), fam: { rock: 0.5, latin: 0.3, pop: 0.3 }, sub: { punk: 0.5 }, themes: ['reggae'] },
  { re: word('reggae|roots reggae|lovers rock|dub'), fam: { latin: 0.5, hiphop: 0.4, pop: 0.3 }, themes: ['reggae'], focus: HIPS },
  { re: word('soca|calypso|zouk|kompa'), fam: { latin: 0.5, hiphop: 0.3, pop: 0.3 }, themes: ['soca'], focus: HIPS },
  { re: word('nu metal|rap metal|rapcore'), fam: { rock: 1, hiphop: 0.3 }, sub: { metal: 0.9 } },
  { re: word('rap rock'), fam: { rock: 0.8, hiphop: 0.5 }, sub: { metal: 0.45 } },
  { re: word('trap metal'), fam: { rock: 0.6, hiphop: 0.7 }, sub: { metal: 0.6, trap: 0.6 } },
  {
    re: word('metalcore|deathcore|death metal|black metal|thrash metal|thrash|doom metal|heavy metal|power metal|speed metal|groove metal|gothic metal|symphonic metal|alternative metal|industrial metal|progressive metal|djent|sludge metal|glam metal|metal'),
    fam: { rock: 1, aerobic: 0.1 }, sub: { metal: 1 },
  },
  { re: word('hard rock|hair metal'), fam: { rock: 1 }, sub: { metal: 0.45 } },
  { re: word('post grunge|grunge'), fam: { rock: 1 }, sub: { metal: 0.3 } },
  { re: word('pop punk|emo pop|easycore'), fam: { rock: 0.8, pop: 0.4 }, sub: { punk: 0.8 } },
  { re: word('post punk|post punk revival|new wave'), fam: { rock: 0.7, pop: 0.5, disco: 0.2 }, sub: { punk: 0.25 } },
  { re: word('happy hardcore|uk hardcore|hardcore techno|gabber|hardstyle|jumpstyle'), fam: { aerobic: 0.9, pop: 0.2 }, sub: { edm: 0.9 } },
  { re: word('hardcore punk|hardcore(?! hip hop| rap)|punk rock|skate punk|street punk|oi|emo(?! rap)|screamo|punk'), fam: { rock: 1, aerobic: 0.3 }, sub: { punk: 1 } },
  { re: word('power ballad'), fam: { rock: 0.6, pop: 0.6 }, calm: 0.65 },
  { re: word('soft rock|yacht rock|piano rock|acoustic rock|adult alternative'), fam: { rock: 0.6, pop: 0.6 }, calm: 0.62 },
  { re: word('folk rock|indie folk|folk pop|contemporary folk|freak folk|anti folk|chamber folk'), fam: { pop: 0.7, rock: 0.4 }, calm: 0.55 },
  { re: word('rock and roll|rock n roll|rock n rollo|rockabilly|doo wop|surf rock'), fam: { rock: 1, pop: 0.3 }, themes: ['swing'] },
  { re: word('funk rock|funk metal'), fam: { funk: 0.7, rock: 0.6 } },
  { re: word('pop rock|power pop|pop punk revival'), fam: { pop: 0.7, rock: 0.6 } },
  { re: word('dream pop|shoegaze|slowcore|sadcore'), fam: { pop: 0.6, rock: 0.5 }, calm: 0.7 },
  { re: word('bedroom pop|chamber pop|baroque pop|indie pop|art pop|sophisti pop|alt pop|alternative pop'), fam: { pop: 0.9, rock: 0.3 }, calm: 0.5 },
  { re: word('drill|uk drill|ny drill|brooklyn drill|chicago drill|bronx drill|jersey drill'), fam: { hiphop: 1 }, sub: { drill: 1, trap: 0.3 } },
  { re: word('phonk|drift phonk|memphis rap'), fam: { hiphop: 0.6, aerobic: 0.4 }, sub: { bass: 1 }, name: 'Phonk' },
  { re: word('dubstep|riddim|brostep|tearout'), fam: { aerobic: 0.8, hiphop: 0.2 }, sub: { bass: 1 }, name: 'Dubstep' },
  { re: word('drum and bass|drum n bass|drum bass|dnb|d and b|jungle|liquid funk|liquid dnb|neurofunk|jump up'), fam: { aerobic: 0.9, hiphop: 0.1 }, sub: { bass: 1 }, name: 'Drum & bass' },
  { re: word('future bass|bass music|bass house|trap edm|edm trap|midtempo bass'), fam: { aerobic: 0.7, hiphop: 0.3 }, sub: { bass: 0.8, edm: 0.3 } },
  { re: word('uk garage|2 step|speed garage|garage house|bassline|uk funky'), fam: { aerobic: 0.5, disco: 0.3, hiphop: 0.3 }, sub: { house: 0.6 } },
  { re: word('grime'), fam: { hiphop: 0.9, aerobic: 0.2 }, sub: { drill: 0.3 } },
  { re: word('jersey club|baltimore club|footwork|juke|chicago footwork'), fam: { hiphop: 0.6, aerobic: 0.5 }, sub: { bass: 0.3 } },
  { re: word('big room house|big room|electro house|progressive house|festival|complextro|melbourne bounce'), fam: { aerobic: 0.8, pop: 0.3 }, sub: { edm: 1 } },
  { re: word('tropical house|melodic house'), fam: { pop: 0.6, aerobic: 0.4, disco: 0.2 }, sub: { house: 0.6, edm: 0.3 }, calm: 0.45 },
  { re: word('deep house|tech house|future house|french house|disco house|chicago house|acid house|soulful house|piano house|house'), fam: { disco: 0.5, aerobic: 0.5, pop: 0.3 }, sub: { house: 1 } },
  { re: word('eurodance|eurobeat|euro house|italo dance|hands up'), fam: { pop: 0.5, aerobic: 0.6, disco: 0.2 }, sub: { edm: 0.5 } },
  { re: word('edm|electronic dance music|trance|psytrance|uplifting trance|techno|hard techno|rave'), fam: { aerobic: 0.8, pop: 0.3 }, sub: { edm: 1 } },
  { re: word('electropop|electro pop|synth pop|synthpop|synthwave|electroclash|hyperpop'), fam: { pop: 0.8, disco: 0.3, aerobic: 0.3 } },
  { re: word('dance pop|dance'), fam: { pop: 0.5, aerobic: 0.5, disco: 0.3 } },
  { re: word('downtempo|chillwave|chillout|chill out|lo fi|lofi|trip hop|ambient|new age|meditation'), fam: { pop: 0.6, hiphop: 0.2 }, calm: 0.82 },
  { re: word('electronica|electronic|electro(?! swing)|idm|breakbeat|big beat|indietronica'), fam: { aerobic: 0.6, pop: 0.4, disco: 0.15 } },
  { re: word('post disco|boogie'), fam: { disco: 0.8, funk: 0.6 } },
  { re: word('nu disco|disco'), fam: { disco: 1, funk: 0.3 } },
  { re: word('new jack swing'), fam: { hiphop: 0.6, funk: 0.6, pop: 0.3 }, sub: { rnb: 0.7 } },
  { re: word('quiet storm|slow jam'), fam: { funk: 0.5, pop: 0.5, hiphop: 0.3 }, sub: { rnb: 0.8 }, calm: 0.68 },
  { re: word('contemporary r and b|alternative r and b|r and b|rhythm and blues|rnb|neo soul|urban contemporary|urban'), fam: { funk: 0.6, hiphop: 0.4, pop: 0.4, disco: 0.1 }, sub: { rnb: 1 } },
  { re: word('g funk'), fam: { hiphop: 0.8, funk: 0.4 } },
  { re: word('soul|motown|northern soul|philly soul|funk soul|blue eyed soul'), fam: { funk: 0.8, pop: 0.4, disco: 0.2 }, sub: { rnb: 0.3 } },
  { re: word('funk'), fam: { funk: 1, disco: 0.3 } },
  { re: word('cloud rap|emo rap|sad rap'), fam: { hiphop: 0.9, pop: 0.2 }, sub: { trap: 0.5 }, calm: 0.45 },
  { re: word('crunk|snap|hyphy|rage|plugg|pluggnb'), fam: { hiphop: 1, pop: 0.1 }, sub: { trap: 0.4 } },
  { re: word('trap'), fam: { hiphop: 1, pop: 0.1 }, sub: { trap: 1 } },
  { re: word('pop rap|hip pop'), fam: { hiphop: 0.7, pop: 0.6 } },
  { re: word('country rap|hick hop'), fam: { hiphop: 0.6, pop: 0.3, rock: 0.2 }, themes: ['country'] },
  {
    re: word('boom bap|golden age hip hop|old school hip hop|old school rap|east coast hip hop|west coast hip hop|southern hip hop|midwest hip hop|conscious hip hop|gangsta rap|hardcore hip hop|dirty south|miami bass|bounce|hip hop|hiphop|rap'),
    fam: { hiphop: 1, pop: 0.2, funk: 0.1 },
  },
  { re: word('country pop|bro country|pop country'), fam: { pop: 0.7, rock: 0.3, aerobic: 0.2 }, themes: ['country'] },
  { re: word('country|americana|bluegrass|honky tonk|outlaw country|alt country|western swing|western|red dirt|texas country|cowpunk|nashville sound'), fam: { pop: 0.6, rock: 0.4, aerobic: 0.2 }, themes: ['country'] },
  { re: word('ballad|ballads|torch song|lullaby|lullabies|lullabye'), fam: { pop: 0.8, rock: 0.2 }, calm: 0.85 },
  { re: word('singer songwriter|acoustic|unplugged'), fam: { pop: 0.9, rock: 0.2 }, calm: 0.6 },
  { re: word('smooth jazz|cool jazz|vocal jazz'), fam: { funk: 0.5, pop: 0.5 }, themes: ['swing'], calm: 0.7 },
  { re: word('electro swing'), fam: { funk: 0.5, aerobic: 0.4, disco: 0.3 }, themes: ['swing'] },
  { re: word('jazz|swing|big band|lindy hop|jump blues|bebop|dixieland'), fam: { funk: 0.6, pop: 0.3, rock: 0.2 }, themes: ['swing'] },
  { re: word('blues|rhythm n blues'), fam: { rock: 0.5, funk: 0.5 }, themes: ['swing'], calm: 0.45 },
  { re: word('bhangra|punjabi'), fam: { pop: 0.6, hiphop: 0.4, aerobic: 0.3 }, themes: ['bhangra', 'bollywood'] },
  { re: word('garba|dandiya|gujarati'), fam: { pop: 0.7, latin: 0.3 }, themes: ['garba', 'bollywood'] },
  { re: word('bollywood|filmi|indian pop|indipop|hindi|desi|tollywood|kollywood'), fam: { pop: 0.7, latin: 0.3, disco: 0.2 }, themes: ['bollywood'] },
  { re: word('arabic|arab|middle eastern|khaleeji|raqs|belly dance|bellydance|arabesque|mahraganat|shaabi|rai|turkish pop|turkish'), fam: { pop: 0.7, latin: 0.3 }, themes: ['bellydance'] },
  { re: word('hawaiian|hapa haole|hula|polynesian'), fam: { pop: 0.7, latin: 0.2 }, themes: ['hula'] },
  { re: word('capoeira'), fam: { latin: 0.8 }, themes: ['capoeira'] },
  { re: word('celtic|irish folk|polka|klezmer|balkan|folk dance|traditional folk|folk|world folk'), fam: { pop: 0.6, party: 0.2, rock: 0.2 }, themes: ['folk'] },
  { re: word('flamenco|rumba|tango|bachata|merengue|cumbia|salsa|tropical|tropical music|mambo|cha cha|son cubano|timba|vallenato|tejano|salsa y tropical'), fam: { latin: 1, pop: 0.2 }, focus: { hips: 1.4 } },
  { re: word('bolero|latin ballad|balada'), fam: { latin: 0.8, pop: 0.4 }, calm: 0.65 },
  { re: word('corridos tumbados|corrido tumbado|corridos belicos'), fam: { latin: 0.9, hiphop: 0.3 } },
  { re: word('regional mexican|regional mexicano|musica mexicana|mariachi|norteno|banda|corridos|corrido|ranchera|grupera'), fam: { latin: 0.9, pop: 0.2 } },
  { re: word('latin pop|pop latino|pop in spanish|latin|latino|latina|spanish pop|pop en espanol'), fam: { latin: 0.9, pop: 0.5 }, focus: HIPS },
  { re: word('fitness|workout|aerobics'), fam: { aerobic: 0.8, pop: 0.5 } },
  { re: word('children s music|childrens music|children|kids|nursery|novelty|comedy|parody'), fam: { party: 0.7, pop: 0.6, aerobic: 0.4 } },
  { re: word('christmas|holiday'), fam: { pop: 0.8, party: 0.3, disco: 0.2 } },
  { re: word('gospel|christian|worship|ccm|inspirational|contemporary christian'), fam: { pop: 0.7, funk: 0.2 }, calm: 0.5 },
  { re: word('classical|opera|orchestral|instrumental|piano|neoclassical|film score|original score|score'), fam: { pop: 0.7 }, calm: 0.75, conf: 0.6 },
  { re: word('soundtrack|musicals|musical|show tunes|disney|film|tv soundtrack|film soundtrack'), fam: { pop: 0.7, disco: 0.2, aerobic: 0.2 }, conf: 0.5 },
  { re: word('easy listening|adult contemporary|traditional pop|vocal pop|vocal|lounge'), fam: { pop: 1, funk: 0.1 }, calm: 0.6 },
  { re: word('schlager|europop|french pop|german pop|chanson|greek|italian pop|world|worldwide'), fam: { pop: 0.7, latin: 0.3, disco: 0.2 } },
  { re: word('teen pop|bubblegum pop|bubblegum|pop'), fam: { pop: 1, hiphop: 0.15, disco: 0.1 } },
  { re: word('alternative rock|alt rock|indie rock|garage rock|britpop|college rock|art rock|progressive rock|psychedelic rock|stoner rock|arena rock|glam rock|southern rock|classic rock|heartland rock|blues rock|gothic rock|post rock|math rock|rock'), fam: { rock: 1, pop: 0.25 } },
  { re: word('alternative|alt|indie'), fam: { rock: 0.7, pop: 0.5 } },
];

/** One genre name, read: its normalised families and everything else it says (placed = false: nothing matched). */
interface Reading {
  placed: boolean;
  fam: Weights;
  subs: Subs;
  themes: Set<Theme>;
  focus: FocusMap | null;
  calm: number | null;
  name?: string;
  conf: number;
}

/** "R&B/Soul" -> "r and b soul"; "Hip-Hop/Rap" -> "hip hop rap"; "Rock 'n' Roll" -> "rock n roll". */
function normGenre(s: string): string {
  return ` ${fold(s)
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const READINGS = new Map<string, Reading>();

/** What one genre name says (cached by name). */
export function readGenre(name: string | undefined): Reading {
  const key = name ?? '';
  const hit = READINGS.get(key);
  if (hit) return hit;
  let s = normGenre(key);
  const fam: Record<string, number> = {};
  const subs: Subs = {};
  const themes = new Set<Theme>();
  let focus: FocusMap | null = null;
  const calms: number[] = [];
  let placed = false;
  let label: string | undefined;
  let conf = 0;
  for (const e of LEXICON) {
    e.re.lastIndex = 0;
    if (!e.re.test(s)) continue;
    e.re.lastIndex = 0;
    s = s.replace(e.re, ' ');
    placed = true;
    conf = Math.max(conf, e.conf ?? 1);
    for (const f of FAMILIES) if (e.fam[f]) fam[f] = (fam[f] ?? 0) + e.fam[f]!;
    for (const k of SUB_STYLES) if (e.sub?.[k]) subs[k] = Math.max(subs[k] ?? 0, e.sub[k]!);
    for (const t of e.themes ?? []) themes.add(t);
    if (e.focus) {
      focus ??= {};
      for (const k of FOCI) if (e.focus[k]) focus[k] = Math.max(focus[k] ?? 1, e.focus[k]!);
    }
    if (e.calm !== undefined) calms.push(e.calm);
    if (e.name && !label) label = e.name;
  }
  const r: Reading = {
    placed,
    fam: normWeights(fam) ?? {},
    subs,
    themes,
    focus,
    calm: calms.length ? Math.max(...calms) : null,
    conf: placed ? conf : 0,
    ...(label ? { name: label } : {}),
  };
  READINGS.set(key, r);
  return r;
}

/** Family weights for a genre name, or null when nothing in it can be placed. */
export function genreFamilies(genre: string | undefined): Weights | null {
  const r = readGenre(genre);
  return r.placed ? { ...r.fam } : null;
}

/** Style themes implied by a genre name (afro, dancehall, soca, swing, country, folk ...). */
export function genreThemes(genre: string | undefined): Theme[] {
  const r = readGenre(genre);
  return THEMES.filter((t) => r.themes.has(t));
}

/** Everything the genre names of a song say, blended. */
interface GenreEvidence {
  /** Normalised family weights, or null when no name was placed. */
  fam: Weights | null;
  subs: Subs;
  themes: Set<Theme>;
  focus: FocusMap | null;
  /** Calm hint (weighted mean of the names that hint one, pulled toward neutral by the names that don't). */
  calm: number | null;
  name?: string;
}

/**
 * Blend genre names: the song's own list first (weight 1 / (1 + 0.5 i) by
 * position), then the single tag (as a tie-breaker, ITUNES_TIE, when the list
 * placed anything; fully otherwise). Families add by weight; a sub-style
 * takes its best evidence, discounted by position.
 */
const ITUNES_TIE = 0.3;
function genreEvidence(list: readonly string[] | undefined, tag: string | undefined): GenreEvidence {
  const items: { r: Reading; w: number; pos: number }[] = [];
  (list ?? []).forEach((g, i) => {
    if (typeof g !== 'string') return;
    const r = readGenre(g);
    if (r.placed) items.push({ r, w: r.conf / (1 + 0.5 * i), pos: Math.max(0.6, 1 - 0.1 * i) });
  });
  if (typeof tag === 'string' && tag.trim()) {
    const r = readGenre(tag);
    if (r.placed) items.push(items.length ? { r, w: ITUNES_TIE * r.conf, pos: 0.7 } : { r, w: r.conf, pos: r.conf });
  }
  const out: GenreEvidence = { fam: null, subs: {}, themes: new Set(), focus: null, calm: null };
  if (!items.length) return out;
  const fam: Record<string, number> = {};
  let cw = 0, cs = 0, wAll = 0;
  for (const { r, w, pos } of items) {
    wAll += w;
    for (const f of FAMILIES) if (r.fam[f]) fam[f] = (fam[f] ?? 0) + w * r.fam[f]!;
    for (const k of SUB_STYLES) if (r.subs[k]) out.subs[k] = Math.max(out.subs[k] ?? 0, r.subs[k]! * pos);
    for (const t of r.themes) out.themes.add(t);
    if (r.focus && !out.focus) out.focus = r.focus;
    if (r.calm !== null) {
      cw += w;
      cs += w * r.calm;
    }
    if (r.name && !out.name) out.name = r.name;
  }
  out.fam = normWeights(fam);
  if (cw > 0) {
    const neutral = 0.4;
    out.calm = neutral + (cs / cw - neutral) * Math.min(1, (cw / wAll) * 1.5);
  }
  return out;
}

// ---------------------------------------------------------------------------
// (c) Title keywords -> themes (and a calm hint)

const kw = (alts: string) => new RegExp(`(?<![a-z0-9])(?:${alts})(?![a-z0-9])`);

const KEYWORDS: [RegExp, Theme[]][] = [
  [kw("hips?|booty|body|bodies|twerk(?:s|ing|in')?"), ['hips', 'shake']],
  [kw("shake|shakes|shakin'?|shaking|shakedown|shook|wiggle"), ['shake']],
  [kw("jump|jumps|jumping|jumpin'?|bounce|bounces|bouncing|bouncin'?|hop|hops|hopping|hoppin'?"), ['jump']],
  [kw("clap|claps|clapping|clappin'?|hands?"), ['clap', 'hands']],
  [kw("twist|twists|twisted|twisting|twistin'?"), ['twist']],
  [kw("spin|spins|spinning|spinnin'?|round|around|turn|turns|turning|turnin'?"), ['spin']],
  [kw("walk|walks|walking|walkin'?|moonwalk|strut|step|steps|stepping|steppin'?|run|runs|running|runnin'?"), ['walk']],
  [kw("stomp|stomps|stomping|stompin'?|rock|rocks|rocking|rockin'?"), ['stomp']],
  [kw("point|points|pointing|pointin'?"), ['point']],
  [kw("punch|punches|punching|fight|fights|fighting|fighter"), ['punch']],
  [kw("wave|waves|waving|wavin'?"), ['wave']],
  [kw("kick|kicks|kicking|kickin'?"), ['kick']],
  [kw("ball|ballin'?|game|games|champion|champions|winner|winners|olympic|olympics|basketball|football|soccer|goal|goals|knockout|slam dunk"), ['sport']],
  [kw("tiger|tigers|lion|lions|dog|dogs|cat|cats|bird|birds|chicken|chickens|horse|horses|pony|monkey|monkeys|bear|bears|wolf|wolves|shark|sharks|bee|bees|duck|ducks|penguin|penguins|bunny|frog|frogs|snake|snakes|elephant|gorilla|kangaroo|zebra|panda|dinosaur"), ['animal']],
  [kw("bhangra"), ['bhangra', 'bollywood']],
  [kw("bollywood"), ['bollywood']],
  [kw("garba|dandiya"), ['garba']],
  [kw("hula|aloha|hawaii|hawaiian"), ['hula']],
  [kw("capoeira"), ['capoeira']],
  [kw("bellydance|belly dance|habibi"), ['bellydance']],
];

/** Title words that say a version is calm ("Acoustic", "Piano Version", "Lullaby"). */
const CALM_TITLE = kw("acoustic|unplugged|piano version|piano|lullaby|lullabies|ballad|slowed|stripped|orchestral version|reverb");

/** Themes suggested by words in a title or artist name (whole words only). */
export function keywordThemes(...texts: (string | undefined)[]): Theme[] {
  const found = new Set<Theme>();
  for (const t of texts) {
    if (!t) continue;
    const s = fold(t).replace(/[‘’]/g, "'");
    for (const [re, themes] of KEYWORDS) if (re.test(s)) for (const th of themes) found.add(th);
  }
  return THEMES.filter((t) => found.has(t));
}

// ---------------------------------------------------------------------------
// (d) Audio traits: the lean without a genre, sub-style evidence, calm

/** A traits field, or `dflt` when absent. */
const tv = (t: SongTraits, k: keyof SongTraits, dflt = 0.35) => t[k] ?? dflt;

/** A family lean from the traits alone (no genre known), normalised. */
function traitWeights(t: SongTraits): Weights | null {
  const heavy = tv(t, 'heavy'), drive = tv(t, 'drive'), four = tv(t, 'fourFloor'), half = tv(t, 'halfFeel');
  const bass = tv(t, 'bass'), hats = tv(t, 'hats'), swing = tv(t, 'swing'), syncop = tv(t, 'syncop'), calm = tv(t, 'calm');
  const w: Weights = {
    rock: 1.3 * heavy * heavy + 0.3 * drive * (1 - half) * (1 - four),
    hiphop: 1.1 * half + 0.45 * hats * (1 - four) + 0.35 * bass * (1 - four),
    aerobic: 0.9 * four * drive + 0.25 * hats * four,
    disco: 0.75 * four * (1 - heavy) + 0.2 * swing,
    funk: 0.6 * swing * (1 - heavy) + 0.25 * syncop * (1 - half),
    latin: 0.85 * syncop * (1 - heavy) * (1 - 0.5 * half),
    pop: 0.3 + 0.7 * calm,
    party: 0.04,
    kpop: 0.03,
  };
  return normWeights(w);
}

/** Sub-style evidence from the traits and tempo (before the genre family's say). */
function traitSubs(t: SongTraits, bpm: number | undefined): Subs {
  const out: Subs = {};
  const has = (k: keyof SongTraits) => typeof t[k] === 'number';
  const calm = tv(t, 'calm', 0.4);
  const notCalm = 1 - ramp(calm, 0.45, 0.75);
  const b = typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0 ? bpm : undefined;
  const minorW = 0.85 + 0.15 * tv(t, 'minor', 0.5);
  if (has('heavy')) out.metal = ramp(t.heavy!, 0.5, 0.85) * (0.6 + 0.4 * tv(t, 'drive', 0.5)) * notCalm;
  if (has('drive') && b) out.punk = ramp(t.drive!, 0.55, 0.85) * ramp(b, 150, 172) * ramp(tv(t, 'heavy', 0.4), 0.25, 0.55) * (1 - tv(t, 'halfFeel', 0)) * notCalm;
  if (has('halfFeel')) {
    const hf = ramp(t.halfFeel!, 0.4, 0.75);
    out.trap = hf * Math.max(ramp(tv(t, 'hats', 0), 0.4, 0.75), ramp(tv(t, 'bass', 0), 0.5, 0.8)) * (1 - ramp(tv(t, 'heavy', 0), 0.5, 0.8)) * notCalm;
    out.drill = hf * ramp(tv(t, 'syncop', 0), 0.45, 0.75) * ramp(tv(t, 'hats', 0), 0.35, 0.7) * minorW * notCalm;
  }
  if (has('fourFloor') && b) {
    const ff = ramp(t.fourFloor!, 0.5, 0.85);
    out.house = ff * ramp(b, 112, 118) * (1 - ramp(b, 127, 133)) * notCalm;
    out.edm = ff * ramp(b, 122, 126) * (1 - ramp(b, 160, 175)) * ramp(tv(t, 'drive', 0.5), 0.5, 0.8) * notCalm;
  }
  if (has('bass') && b) {
    const sub = ramp(t.bass!, 0.6, 0.9);
    out.bass = sub * Math.max(ramp(tv(t, 'halfFeel', 0), 0.5, 0.8) * ramp(b, 130, 140), ramp(tv(t, 'hats', 0), 0.6, 0.85) * ramp(b, 160, 168)) * notCalm;
  }
  if (has('swing')) out.rnb = 0.75 * ramp(t.swing!, 0.3, 0.6) * ramp(calm, 0.3, 0.55) * (1 - ramp(calm, 0.82, 0.95)) * (1 - ramp(tv(t, 'drive', 0.4), 0.7, 0.9));
  if (has('syncop') && b) {
    out.reggaeton = ramp(t.syncop!, 0.45, 0.75) * ramp(b, 84, 89) * (1 - ramp(b, 102, 108)) * ramp(tv(t, 'bass', 0.4), 0.4, 0.7) * (1 - tv(t, 'fourFloor', 0) * 0.6) * notCalm;
    out.amapiano = 0.8 * ramp(tv(t, 'bass', 0), 0.6, 0.85) * ramp(b, 106, 110) * (1 - ramp(b, 116, 120)) * ramp(t.syncop!, 0.4, 0.7);
  }
  return out;
}

/** Which family a sub-style belongs to (its group must lead the song for the traits to open it). */
const SUB_GROUP: Readonly<Record<SubStyle, readonly Family[]>> = {
  metal: ['rock'], punk: ['rock'], trap: ['hiphop'], drill: ['hiphop'], rnb: ['hiphop', 'pop'],
  house: ['disco', 'aerobic', 'pop'], edm: ['aerobic', 'pop', 'disco'], bass: ['aerobic', 'hiphop'],
  reggaeton: ['latin', 'hiphop'], brazil: ['latin'], amapiano: ['latin', 'hiphop'], lyrical: [...FAMILIES],
};

/** How well a family mix fits a sub-style's group (1 when the group leads, 0 when it is absent). */
function groupFit(fam: Weights, s: SubStyle): number {
  let max = 0;
  for (const f of FAMILIES) max = Math.max(max, fam[f] ?? 0);
  if (max <= 0) return 0;
  let g = 0;
  for (const f of SUB_GROUP[s]) g = Math.max(g, fam[f] ?? 0);
  return clamp(g / max / 0.65);
}

// ---------------------------------------------------------------------------
// (e) Tempo prior

/** A weak family lean from tempo, normalised; null when there is nothing to say. */
function priorWeights(bpm: number | undefined): Weights | null {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) return null;
  let w: Weights;
  if (bpm < 85) w = { hiphop: 0.6, pop: 0.4 };
  else if (bpm <= 104) w = { latin: 0.5, hiphop: 0.5 };
  else if (bpm <= 118) w = { funk: 0.5, hiphop: 0.3, disco: 0.2 };
  else if (bpm <= 132) w = { disco: 0.4, pop: 0.4, aerobic: 0.2 };
  else if (bpm < 160) w = { pop: 0.5, aerobic: 0.3, rock: 0.2 };
  else w = { rock: 0.6, aerobic: 0.4 };
  return normWeights(w);
}

/** How much of the final mix the tempo prior may take, by where the families came from (at most 15 %). */
const PRIOR_SHARE: Record<SongStyle['source'], number> = { override: 0.05, genre: 0.1, traits: 0.12, fallback: 0.15 };
/** How far a calm song's families lean toward pop (at calm 1). */
const CALM_POP = 0.35;

// ---------------------------------------------------------------------------
// Resolution

function ordered(w: Weights): Weights {
  const out: Weights = {};
  for (const f of FAMILIES) if (w[f]) out[f] = w[f];
  return out;
}

// ---------------------------------------------------------------------------
// Signature-move nods: famous songs whose association with one or two single
// moves is obvious. The moves open every chorus (the generator composes the
// rest). Keyed by a title key + artist key (any credited artist). These are
// per SONG, not per artist.

const SONG_SIGNATURES: readonly (readonly [string, string, readonly string[]])[] = [
  ['gangnamstyle', 'psy', ['gallop', 'lasso']],
  ['hipsdontlie', 'shakira', ['hip-sway', 'hip-shake']],
  ['thetwist', 'chubbychecker', ['the-twist']],
  ['letstwistagain', 'chubbychecker', ['the-twist']],
  ['twistandshout', 'beatles', ['the-twist']],
  ['twistandshout', 'isleybrothers', ['the-twist']],
  ['stayinalive', 'beegees', ['disco-point']],
  ['nightfever', 'beegees', ['disco-point']],
  ['lefreak', 'chic', ['disco-point']],
  ['thehustle', 'vanmccoy', ['hustle-tap']],
  ['billiejean', 'michaeljackson', ['heel-swivel', 'spin-pose']],
  ['beatit', 'michaeljackson', ['kick-point', 'heel-swivel']],
  ['dontstoptilyougetenough', 'michaeljackson', ['heel-swivel', 'spin-pose']],
  ['smoothcriminal', 'michaeljackson', ['spin-pose']],
  ['getup', 'jamesbrown', ['jb-slide']],
  ['getupsexmachine', 'jamesbrown', ['jb-slide']],
  ['partyrockanthem', 'lmfao', ['running-man-shuffle']],
  ['watchmewhipnaenae', 'silento', ['the-whip', 'nae-nae']],
  ['watchme', 'silento', ['the-whip', 'nae-nae']],
  ['stankylegg', 'gsboyz', ['stanky-leg']],
  ['ucanttouchthis', 'mchammer', ['hammer-dance']],
  ['canttouchthis', 'mchammer', ['hammer-dance']],
  ['teachmehowtodougie', 'caliswagdistrict', ['dougie']],
  ['tootseeroll', '69boyz', ['tootsie-roll']],
  ['walkitout', 'unk', ['walk-it-out']],
  ['millyrock', '2milly', ['milly-rock']],
  ['shoot', 'blocboyjb', ['the-shoot']],
  ['swagsurfin', 'fastlifeyungstaz', ['swag-surf']],
  ['jumparound', 'houseofpain', ['jump-around']],
  ['mambono5', 'loubega', ['mambo-rock']],
  ['september', 'earthwindfire', ['disco-point']],
  ['dancingqueen', 'abba', ['hip-bump']],
];

function titleKey(t: string | undefined): string {
  return fold(t ?? '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft)\b.*$/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** The signature nod for a famous song, if any. */
export function songSignature(title: string | undefined, artist: string | undefined): string[] | undefined {
  const tk = titleKey(title);
  if (!tk) return undefined;
  const artists = artist ? artistCandidates(artist) : [];
  for (const [t, a, sig] of SONG_SIGNATURES) if (t === tk && artists.includes(a)) return [...sig];
  return undefined;
}

/** Every move id named by a signature nod (tests check they exist). */
export function signatureMoveIds(): string[] {
  const ids = new Set<string>(SONG_SIGNATURES.flatMap(([, , s]) => s));
  for (const st of STARTER_STYLES.values()) for (const id of st.signature ?? []) ids.add(id);
  return [...ids];
}

export function resolveSongStyle(song: SongInfo, priors?: StylePriors): SongStyle {
  const curated = song.style ?? (song.videoId ? STARTER_STYLES.get(song.videoId) : undefined);
  const traits = readTraits(priors?.traits);
  const bpm = priors?.bpm;
  const ev = genreEvidence(Array.isArray(song.genres) ? song.genres : undefined, song.genre);
  const artistEv = typeof song.artistGenre === 'string' ? genreEvidence(undefined, song.artistGenre) : null;

  // Families: curated > genre names > traits > balanced mix.
  let families: Weights | null = null;
  let source: SongStyle['source'] = 'fallback';
  const cur = normWeights(curated?.families);
  if (cur) {
    families = cur;
    source = 'override';
  } else if (ev.fam) {
    families = ev.fam;
    source = 'genre';
  } else if (traits) {
    const tw = traitWeights(traits);
    if (tw) {
      families = tw;
      source = 'traits';
    }
  }
  if (!families) families = { ...BALANCED_POP.families };
  if (source !== 'override' && artistEv?.fam) families = blend(families, artistEv.fam, ARTIST_SHARE);
  const prior = priorWeights(bpm);
  if (prior) families = blend(families, prior, PRIOR_SHARE[source]);

  // Character: calm from the traits (the title / genre names hint when they are missing).
  const titleCalm = song.title && CALM_TITLE.test(fold(song.title)) ? 0.7 : null;
  const hint = ev.calm !== null && titleCalm !== null ? Math.max(ev.calm, titleCalm) : (ev.calm ?? titleCalm);
  let calm: number | undefined;
  if (traits?.calm !== undefined) calm = hint !== null ? 0.85 * traits.calm + 0.15 * hint : traits.calm;
  else if (hint !== null) calm = hint;
  if (calm !== undefined) calm = clamp(calm);
  // A calm song leans a little toward pop (smooth, flowing), keeping its family; curated mixes stay as written.
  if (calm !== undefined && calm > 0.5 && source !== 'override') families = blend(families, { pop: 1 }, CALM_POP * 2 * (calm - 0.5));

  // Sub-styles: the genre names' evidence, reinforced by the traits where the song's group fits.
  const subs: Subs = {};
  const ts = traits ? traitSubs(traits, bpm) : {};
  for (const s of SUB_STYLES) {
    if (s === 'lyrical') continue;
    const word = ev.subs[s] ?? 0;
    const trait = (ts[s] ?? 0) * groupFit(families, s);
    const art = (artistEv?.subs[s] ?? 0) * ARTIST_SHARE;
    const v = 1 - (1 - word) * (1 - 0.85 * trait) * (1 - art);
    if (v >= SUB_KEEP) subs[s] = Math.round(v * 1000) / 1000;
  }
  if (calm !== undefined) {
    const ly = ramp(calm, 0.55, 0.8);
    if (ly >= SUB_KEEP) subs.lyrical = Math.round(ly * 1000) / 1000;
  }

  const themeSet = new Set<Theme>([...themesOf(curated?.themes), ...ev.themes, ...keywordThemes(song.title)]);
  const themes = THEMES.filter((t) => themeSet.has(t));

  let focus = normFocus(curated?.focus) ?? normFocus(ev.focus);
  if (!focus && themeSet.has('hips')) focus = { hips: 1.3 };

  const signature = Array.isArray(curated?.signature) ? curated.signature.filter((s): s is string => typeof s === 'string') : songSignature(song.title, song.artist);

  const out: SongStyle = { families: ordered(families), themes, source };
  if (focus) out.focus = focus;
  if (signature && signature.length) out.signature = [...signature];
  if (Object.keys(subs).length) out.subs = subs;
  if (calm !== undefined) out.calm = Math.round(calm * 1000) / 1000;
  if (ev.name && subs.bass !== undefined) out.subName = ev.name;
  return out;
}

/** The 1–2 strongest families, strongest first (ties in FAMILIES order). */
function topFamilies(s: SongStyle): Family[] {
  const list = FAMILIES.filter((f) => (s.families[f] ?? 0) > 0).sort((a, b) => (s.families[b] ?? 0) - (s.families[a] ?? 0));
  if (!list.length) return [];
  const w1 = s.families[list[0]] ?? 0;
  const w2 = list[1] ? (s.families[list[1]] ?? 0) : 0;
  return w2 > 0 && w2 >= 0.6 * w1 ? list.slice(0, 2) : list.slice(0, 1);
}

/** Label head of a sub-style ("Rock · Metal"); null = the sub-style's own label alone ("R&B"). */
const SUB_HEAD: Readonly<Record<SubStyle, string | null>> = {
  metal: 'Rock', punk: 'Rock', trap: 'Hip-hop', drill: 'Hip-hop', rnb: null, house: 'Electronic', edm: 'Electronic', bass: 'Electronic',
  reggaeton: 'Latin', brazil: 'Latin', amapiano: 'Afro', lyrical: null,
};

/** Tradition themes that name the song ahead of its families (a country song's families are pop / rock). */
const THEME_HEAD: readonly (readonly [Theme, string])[] = [
  ['country', 'Country'], ['amapiano', 'Afro'], ['afro', 'Afrobeats'], ['dancehall', 'Dancehall'], ['reggae', 'Reggae'], ['soca', 'Soca'],
  ['bhangra', 'Bhangra'], ['bollywood', 'Bollywood'], ['garba', 'Garba'], ['bellydance', 'Belly dance'], ['hula', 'Hula'], ['capoeira', 'Capoeira'], ['folk', 'Folk'],
];

/** The sub-style that names the song, if one clearly applies (calm-closed ones don't). */
export function labelSub(s: SongStyle): SubStyle | null {
  let best: SubStyle | null = null;
  let bv = SUB_LABEL - 1e-9;
  const top = topFamilies(s)[0];
  for (const k of SUB_STYLES) {
    if (k === 'lyrical') continue;
    const v = s.subs?.[k] ?? 0;
    if (v <= bv || calmGate(k, s.calm) < CALM_CLOSED) continue;
    // Its group must lead the song (Billie Jean is R&B, but it dances as funk and disco).
    if (!top || !SUB_GROUP[k].includes(top)) continue;
    best = k;
    bv = v;
  }
  return best;
}

/** Human label, e.g. "Latin groove", "Rock", "Disco · Funk", "Hip-hop · Drill", "Rock · Ballad". */
export function styleLabel(s: SongStyle): string {
  const top = topFamilies(s);
  const tradition = THEME_HEAD.find(([t]) => s.themes.includes(t))?.[1];
  const head = tradition ?? (top.length ? FAMILY_LABEL[top[0]] : FAMILY_LABEL.pop);
  if (s.calm !== undefined && s.calm >= BALLAD_CALM) return `${head} · Ballad`;
  const sub = labelSub(s);
  if (sub) {
    const name = sub === 'bass' && s.subName ? s.subName : GENRE_LABEL[sub];
    const h = SUB_HEAD[sub];
    return h ? `${h} · ${name}` : name;
  }
  if (tradition) return tradition;
  return top.length ? top.map((f) => FAMILY_LABEL[f]).join(' · ') : FAMILY_LABEL.pop;
}

/** Short stable string for seeding: "disco:0.50,funk:0.50|kick,spin" (+ "|trap:0.90" sub-styles, "|c0.80" calm when known). */
export function styleKey(s: SongStyle): string {
  const fam = Object.keys(s.families)
    .filter(isFamily)
    .filter((f) => (s.families[f] ?? 0) > 0)
    .sort()
    .map((f) => `${f}:${(s.families[f] ?? 0).toFixed(2)}`)
    .join(',');
  const th = [...s.themes].filter(isTheme).sort().join(',');
  let key = `${fam}|${th}`;
  const subs = Object.keys(s.subs ?? {})
    .filter(isSubStyle)
    .sort()
    .map((k) => `${k}:${(s.subs![k] ?? 0).toFixed(2)}`)
    .join(',');
  if (subs) key += `|${subs}`;
  if (s.calm !== undefined && Number.isFinite(s.calm)) key += `|c${s.calm.toFixed(2)}`;
  return key;
}

/** Exposed for tests and tooling: the curated style of a starter song. */
export function starterStyle(videoId: string): StyleOverride | undefined {
  return STARTER_STYLES.get(videoId);
}
