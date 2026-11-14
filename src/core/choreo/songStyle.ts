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
 *     `genreLevels` says which names are about the song and which about its
 *     album: album names beside song names are a weaker score, and add a
 *     dance only where they narrow the song's own broad names (genreEvidence);
 *   - the song's absolute audio traits (songTraits.ts, from the beat map):
 *     they decide the CHARACTER on top of any genre (calm, heavy,
 *     four-on-the-floor, half-time feel ...), and the lean itself when there
 *     is no genre at all;
 *   - tempo (a weak prior, <= 15 %), title keywords (themes, a calm hint);
 *   - `artistGenres` (or the single `artistGenre`): the artist's usual
 *     genres, a small blended score (all together at most ARTIST_SHARE of the
 *     families and of each sub-style score), never the base.
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
import { calmGate, CALM_CLOSED, GENRE_LABEL, SUB_STYLES, THEME_LEAD, isSubStyle, type SubStyle } from './genres';
import { readTraits, type SongTraits } from './songTraits';

export type { SongTraits } from './songTraits';

export interface SongStyle {
  /** Weights, normalised to sum 1. */
  families: Partial<Record<Family, number>>;
  /** Multipliers around 1 (e.g. hips: 1.6). */
  focus?: Partial<Record<Focus, number>>;
  themes: Theme[];
  /**
   * Weight 0..1 of a theme only weaker genre evidence says (a name far down the list, the store's tag beside
   * a list: THEME_FADE); absent = 1. Its set opens that much (genres.ts): a flavour, not the song's tradition.
   */
  themeW?: Partial<Record<Theme, number>>;
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
  /**
   * The music's name from the song's genre names, as the owner sees it ("Eurodance", "Blues",
   * "K-pop", "Classical"); styleLabel uses it ahead of the families (which say how it is DANCED).
   */
  label?: string;
  /** The label already names a sub-style or scene ("Nu metal", "Bachata", "K-pop"): no " · Sub" suffix. */
  labelSpecific?: boolean;
  /** Not dance music (classical, ambient, spoken word): a neutral mix, no " · Ballad" suffix. */
  still?: boolean;
  /**
   * Soft-but-steady character 0..1: low audio intensity on a steady beat (or genre names that
   * say soft: romantic bachata, soft rock). No jumps, kicks or percussive showpieces, but not a
   * lyrical ballad either (that is `calm`). Undefined = unknown (neutral).
   */
  soft?: number;
  /** Hard-hitting sound 0..1 (audio intensity): sharp, percussive moves suit it. */
  hard?: number;
  /**
   * The audio readings the character came from (traits intensity and drive, 0..1; undefined = not read), for the
   * song's energy (generator.ts songEnergy), which uses them continuously rather than through soft / hard alone.
   */
  intensity?: number;
  drive?: number;
  /** Tempo people usually step to for the song's genre names (BPM); the tempo-octave check and the free-time pace. */
  bpm?: number;
  /** The scene a song-level genre name says (K-pop, J-pop ...): it leads the dancing. */
  scene?: string;
  /** The calm the genre names alone hint (a calm genre needs no " · Ballad"). */
  nameCalm?: number;
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
  /**
   * Level of each `genres` entry ('song': about the track; 'album': about its album), same order. Album names
   * beside song names are a weaker score (genreEvidence). Absent, or not matching `genres`: all song-level.
   */
  genreLevels?: readonly string[];
  /** The artist's usual genre: a small blended score at most, never the base. */
  artistGenre?: string;
  /** The artist's usual genres, best first (used instead of `artistGenre` when given): together at most ARTIST_SHARE. */
  artistGenres?: readonly string[];
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
// sub-style evidence (max), themes, focus, a calm hint, a softness hint, the
// tempo people step to, and the name the owner sees (`label`).
//
// The vocabulary reviewed (iTunes primary genres, the common Wikipedia /
// MusicBrainz / TheAudioDB names) and what each maps to is pinned in
// songStyle.vocab.test.ts. Music that is not dance music (classical,
// ambient, new age, spoken word ...) reads as `still`: a neutral, smooth
// family mix, a calm hint, and its own name as the label (never "Pop").

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
  /**
   * The music's name as the owner sees it ("Hip-hop" for "Hip-Hop/Rap");
   * absent = the genre name as written; null = never names the song (too vague).
   */
  label?: string | null;
  /** Use `label` even when the name as written is clean ("Worldwide" -> "World music"). */
  fixed?: true;
  /** A scene label (K-pop, J-pop ...): when any song-level name says it, it leads the dancing (genreEvidence). */
  scene?: string;
  /** Not dance music (classical, ambient, spoken word): no "Ballad" suffix, a neutral mix. */
  still?: true;
  /** Softness hint 0..1: soft-but-steady music the audio may read as driving (romantic bachata, soft rock, quiet storm). */
  soft?: number;
  /** Tempo people usually step to (BPM): the tempo-octave check (generator.ts danceFeel) and the free-time pace. */
  bpm?: number;
  /**
   * A song form, not a genre ("ballad", "power ballad"; the lookup appends one after the genres): it says how the song
   * moves, not what it is. Its calm, softness and stepping tempo count wherever it is listed; its family, label and
   * place among the names barely (FORM_FAM), unless nothing else is known.
   */
  form?: true;
  /**
   * A tradition theme the music has when it is bright: the Western folk family dances the country floor on a
   * major-key song with a steady, unsoft beat, and stays gentle (no tradition set; soft, lyrical) when minor or soft.
   */
  bright?: Theme;
}

/**
 * Bare umbrella names ("Pop", "Rock", "Electronic", "Dance", "Hip-hop"): they say the family, not the form. The
 * audio may refine one into a sub-style of that family (heavy guitars into metal, four-on-the-floor into house);
 * beside a name that says the form (alternative, post-punk, disco, synth-pop) it may not (TRAIT_ALONE).
 */
const BROAD_NAMES = new Set([
  'pop', 'pop music', 'rock', 'rock music', 'electronic', 'electronic music', 'electronica', 'electronic dance', 'dance', 'dance music',
  'hip hop', 'hiphop', 'rap', 'hip hop rap', 'rap hip hop', 'latin', 'latino', 'latin music', 'world', 'world music', 'worldwide',
]);

/**
 * Peoples and places whose "<X> folk" is a folk-dance tradition (the world folk set): Russian folk, Irish folk.
 * American / contemporary / indie folk is the singer-songwriter music (no folk-dance set).
 */
const FOLK_PEOPLES = [
  'russian', 'ukrainian', 'belarusian', 'polish', 'czech', 'slovak', 'hungarian', 'romanian', 'moldovan', 'bulgarian', 'serbian', 'croatian',
  'bosnian', 'slovenian', 'macedonian', 'albanian', 'greek', 'turkish', 'kurdish', 'armenian', 'georgian', 'azerbaijani', 'persian',
  'iranian', 'arabic', 'arab', 'jewish', 'israeli', 'yiddish', 'german', 'austrian', 'bavarian', 'alpine', 'swiss', 'dutch', 'flemish',
  'french', 'breton', 'occitan', 'basque', 'galician', 'spanish', 'portuguese', 'italian', 'sicilian', 'neapolitan', 'sardinian', 'irish',
  'scottish', 'welsh', 'cornish', 'manx', 'nordic', 'scandinavian', 'swedish', 'norwegian', 'danish', 'finnish',
  'icelandic', 'faroese', 'sami', 'estonian', 'latvian', 'lithuanian', 'baltic', 'slavic', 'chinese', 'japanese', 'korean', 'mongolian',
  'tibetan', 'uyghur', 'kazakh', 'uzbek', 'indian', 'bengali', 'punjabi', 'pakistani', 'nepali', 'thai', 'vietnamese', 'indonesian',
  'javanese', 'balinese', 'malay', 'filipino', 'african', 'ethiopian', 'malian', 'west african', 'andean', 'peruvian', 'bolivian',
  'chilean', 'argentine', 'argentinian', 'mexican', 'colombian', 'venezuelan', 'brazilian', 'native american', 'hawaiian', 'appalachian',
  'european', 'eastern european', 'balkan', 'celtic', 'gaelic', 'cossack', 'gypsy', 'romani',
].join('|');

const word = (alts: string) => new RegExp(`(?<![a-z0-9])(?:${alts})(?![a-z0-9])`, 'g');
const HIPS: FocusMap = { hips: 1.3 };
/** The neutral mix of music that isn't dance music: smooth global moves only. */
const STILL: Weights = { pop: 1 };

const LEXICON: readonly Lex[] = [
  // --- "Christian rock", "Christian hip hop" ...: the music is its second word's, not a gospel floor (the prefix
  // alone is read and removed here, before anything else, so the rest reads as rock, metal, hip-hop ...).
  { re: word('christian(?= (?:rock|metal|punk|hardcore|metalcore|alternative|hip hop|rap|hiphop|edm|electronic|dance|pop punk|ska|indie))|christian alternative'), fam: {}, conf: 0.5 },
  // --- Scenes: they lead the dancing whenever a song-level name says them.
  { re: word('k pop|kpop|korean pop|k rap|k hip hop|k r and b'), fam: { kpop: 1, pop: 0.4, hiphop: 0.2 }, scene: 'K-pop', label: 'K-pop', fixed: true, bpm: 118 },
  { re: word('j pop|jpop|idol pop|idol'), fam: { kpop: 0.7, pop: 0.7 }, scene: 'J-pop', label: 'J-pop', fixed: true, bpm: 120 },
  // C-pop / Mandopop: ballad-led pop with no idol point choreography of its own (no K-pop set); the traits decide how calm.
  { re: word('c pop|cpop|mandopop|cantopop hk pop|cantopop|hk pop|tai pop'), fam: { pop: 1 }, scene: 'C-pop', label: 'C-pop', fixed: true, bpm: 105 },
  { re: word('t pop|thai pop|v pop|vpop|p pop|ppop'), fam: { kpop: 0.7, pop: 0.7 }, scene: 'Asian pop', label: 'Asian pop', bpm: 118 },
  { re: word('j rock|jrock|visual kei|j punk|j ska'), fam: { rock: 1, pop: 0.3 }, label: 'J-rock' },
  { re: word('anime|anison|vocaloid|j synth'), fam: { pop: 0.8, kpop: 0.5, rock: 0.1 }, label: 'Anime' },
  { re: word('city pop'), fam: { pop: 0.6, disco: 0.4, funk: 0.4 }, label: 'City pop' },
  { re: word('enka|kayokyoku|kayo kyoku'), fam: { pop: 1 }, calm: 0.55 },
  { re: word('korean'), fam: { kpop: 0.8, pop: 0.6 }, label: 'Korean' },
  // --- Latin: reggaeton and Brazilian split out, then each Latin dance (genres.ts sub-styles).
  { re: word('latin trap'), fam: { latin: 0.8, hiphop: 0.6 }, sub: { reggaeton: 0.7, trap: 0.5 }, focus: HIPS, bpm: 90 },
  { re: word('reggaeton|reguetón|dembow|perreo|neoperreo|urbano latino|urbano|latin urban|musica urbana|latin rap|latin hip hop|reggae en espanol'), fam: { latin: 1, hiphop: 0.4 }, sub: { reggaeton: 1 }, focus: HIPS, label: 'Reggaeton', bpm: 95 },
  { re: word('moombahton'), fam: { latin: 0.6, aerobic: 0.4 }, sub: { reggaeton: 0.6 }, focus: HIPS, bpm: 108 },
  { re: word('baile funk|funk carioca|brazilian funk|funk brasileiro|funk ostentacao|brega funk|brazilian phonk'), fam: { latin: 0.8, hiphop: 0.4 }, sub: { brazil: 1 }, focus: HIPS, label: 'Baile funk', bpm: 130 },
  { re: word('bossa nova'), fam: { latin: 0.8, pop: 0.3 }, sub: { brazil: 0.8 }, calm: 0.7, soft: 0.8, label: 'Bossa nova', bpm: 70 },
  // Sertanejo is Brazil's country music (viola caipira, rodeo culture): the country floor, not samba.
  { re: word('sertanejo universitario|sertanejo raiz|sertanejo|musica sertaneja|musica caipira|caipira|moda de viola'), fam: { pop: 0.6, latin: 0.3, rock: 0.2 }, themes: ['country'], label: 'Sertanejo', bpm: 100 },
  { re: word('samba|axe|pagode|forro|piseiro|xote|xaxado|baiao|arrocha|brega|tecnobrega|lambada|carimbo|maracatu|afoxe|frevo|mpb|musica popular brasileira|choro|brazilian|brasil'), fam: { latin: 1, pop: 0.2 }, sub: { brazil: 1 }, focus: { hips: 1.4 }, bpm: 105 },
  { re: word('bachata urbana|bachata sensual|bachata romantica|bachata'), fam: { latin: 1, pop: 0.3 }, sub: { bachata: 1 }, focus: { hips: 1.4 }, soft: 0.5, label: 'Bachata', bpm: 128 },
  { re: word('merengue tipico|merengue|perico ripiao|mambo dominicano'), fam: { latin: 1, pop: 0.2 }, sub: { merengue: 1 }, focus: { hips: 1.4 }, label: 'Merengue', bpm: 140 },
  { re: word('cumbia villera|cumbia sonidera|cumbia andina|tecnocumbia|technocumbia|cuarteto|cumbia|chicha|porro|champeta'), fam: { latin: 1, pop: 0.2 }, sub: { cumbia: 1 }, focus: { hips: 1.4 }, label: 'Cumbia', bpm: 95 },
  { re: word('vallenato'), fam: { latin: 1, pop: 0.3 }, sub: { cumbia: 0.7 }, focus: HIPS, label: 'Vallenato', bpm: 110 },
  { re: word('latin jazz|afro cuban jazz|afro cuban'), fam: { latin: 0.8, funk: 0.4 }, sub: { salsa: 0.6 }, themes: ['swing'], bpm: 160 },
  { re: word('salsa y tropical'), fam: { latin: 1, pop: 0.2 }, sub: { salsa: 0.6 }, focus: { hips: 1.4 }, label: 'Salsa', bpm: 170 },
  { re: word('salsa dura|salsa romantica|salsa choke|salsa|timba|songo|pachanga|boogaloo latino|latin boogaloo'), fam: { latin: 1, pop: 0.2 }, sub: { salsa: 1 }, focus: { hips: 1.4 }, label: 'Salsa', bpm: 185 },
  { re: word('son cubano|son montuno|guaracha|mambo|guajira'), fam: { latin: 1, pop: 0.2 }, sub: { salsa: 0.9 }, focus: { hips: 1.4 }, bpm: 180 },
  { re: word('rumba flamenca|rumba catalana|flamenco pop|nuevo flamenco|flamenco|sevillanas|bulerias|copla|paso doble|pasodoble'), fam: { latin: 0.8, pop: 0.2 }, sub: { flamenco: 1 }, label: 'Flamenco', bpm: 120 },
  { re: word('cha cha cha|cha cha|chachacha|danzon|latin ballroom|ballroom|cucaracha'), fam: { latin: 1, pop: 0.2 }, sub: { chacha: 1 }, focus: { hips: 1.4 }, label: 'Cha-cha', bpm: 122 },
  { re: word('congolese rumba|rumba congolaise|rumba congolese|rumba lingala|soukous'), fam: { latin: 0.5, hiphop: 0.5, pop: 0.4 }, themes: ['afro'], focus: HIPS, label: 'Congolese rumba', bpm: 110 },
  { re: word('rumba'), fam: { latin: 1, pop: 0.2 }, sub: { chacha: 0.7, salsa: 0.4 }, focus: { hips: 1.4 }, label: 'Rumba', bpm: 110 },
  { re: word('nuevo tango|tango nuevo|electrotango|electro tango|tango|milonga'), fam: { latin: 0.8, pop: 0.3 }, sub: { tango: 1 }, label: 'Tango', bpm: 118 },
  { re: word('corridos tumbados|corrido tumbado|corridos belicos'), fam: { latin: 0.9, hiphop: 0.3 }, sub: { mexican: 0.8 }, label: 'Corridos tumbados', bpm: 110 },
  { re: word('regional mexican|regional mexicano|musica mexicana|mariachi|norteno|nortena|banda sinaloense|banda|corridos|corrido|ranchera|grupera|duranguense|huapango|son huasteco|son jarocho|chilena|quebradita|tecnobanda|technobanda|tejano|tex mex|folklorico|jarabe tapatio|jarabe|hat dance'), fam: { latin: 0.9, pop: 0.2 }, sub: { mexican: 1 }, label: 'Regional Mexican', bpm: 120 },
  { re: word('bolero|latin ballad|balada|baladas y boleros|baladas'), fam: { latin: 0.8, pop: 0.4 }, calm: 0.65, soft: 0.7, label: 'Bolero', bpm: 80 },
  { re: word('tropical music|musica tropical|tropical(?! house)'), fam: { latin: 1, pop: 0.2 }, focus: { hips: 1.4 }, label: 'Tropical', bpm: 110 },
  // --- Africa and the Caribbean.
  { re: word('amapiano|gqom|kwaito|south african house'), fam: { latin: 0.5, hiphop: 0.5, pop: 0.3 }, sub: { amapiano: 1 }, themes: ['afro', 'amapiano'], focus: HIPS, label: 'Amapiano', bpm: 112 },
  { re: word('afro house|afro tech'), fam: { aerobic: 0.4, latin: 0.4, disco: 0.3 }, sub: { house: 0.7 }, themes: ['afro'], focus: HIPS, bpm: 122 },
  { re: word('afrobeats?|afro beats?|afro pop|afropop|afro fusion|afrofusion|afroswing|afro swing|afro trap|highlife|naija|alte|bongo flava|gengetone|coupe decale|kuduro|kizomba|semba|soukous|ndombolo|makossa|mbalax|juju|fuji|azonto|hiplife|zouglou|mapouka|bikutsi|kwassa kwassa|singeli|benga|mbaqanga|maskandi|batida|afro|african|africa'), fam: { latin: 0.5, hiphop: 0.5, pop: 0.4 }, themes: ['afro'], focus: HIPS, bpm: 105 },
  { re: word('reggae fusion|dancehall|modern dancehall|ragga|raggamuffin'), fam: { latin: 0.5, hiphop: 0.4, pop: 0.3 }, themes: ['dancehall'], focus: HIPS, label: 'Dancehall', bpm: 98 },
  { re: word('ska punk|skacore|third wave ska'), fam: { rock: 1, pop: 0.2 }, sub: { punk: 1 }, bpm: 160 },
  { re: word('ska|rocksteady'), fam: { rock: 0.5, latin: 0.3, pop: 0.3 }, sub: { punk: 0.5 }, themes: ['reggae'], label: 'Ska', bpm: 140 },
  { re: word('lovers rock'), fam: { latin: 0.5, hiphop: 0.3, pop: 0.4 }, themes: ['reggae'], focus: HIPS, soft: 0.7, label: 'Reggae', bpm: 75 },
  { re: word('reggae|roots reggae|dub'), fam: { latin: 0.5, hiphop: 0.4, pop: 0.3 }, themes: ['reggae'], focus: HIPS, label: 'Reggae', bpm: 85 },
  { re: word('soca|chutney soca|chutney|calypso|zouk|kompa|compas|bouyon|mento|steelpan|steel pan|steel band|caribbean'), fam: { latin: 0.5, hiphop: 0.3, pop: 0.3 }, themes: ['soca'], focus: HIPS, bpm: 115 },
  // --- Metal, punk and their kin.
  { re: word('folk metal|pagan metal|viking metal|celtic metal|medieval metal'), fam: { rock: 1, aerobic: 0.1 }, sub: { metal: 0.9 }, themes: ['folk'], bpm: 130 },
  { re: word('nu metal|rap metal|rapcore'), fam: { rock: 1, hiphop: 0.3 }, sub: { metal: 0.9 }, bpm: 100 },
  { re: word('rap rock'), fam: { rock: 0.8, hiphop: 0.5 }, sub: { metal: 0.45 }, bpm: 100 },
  { re: word('trap metal'), fam: { rock: 0.6, hiphop: 0.7 }, sub: { metal: 0.6, trap: 0.6 }, bpm: 140 },
  { re: word('post hardcore|melodic hardcore'), fam: { rock: 1, aerobic: 0.1 }, sub: { punk: 0.7, metal: 0.5 }, bpm: 140 },
  {
    re: word('metalcore|deathcore|progressive metalcore|death metal|black metal|thrash metal|thrash|doom metal|heavy metal|power metal|speed metal|groove metal|gothic metal|symphonic metal|alternative metal|industrial metal|progressive metal|djent|sludge metal|sludge|stoner metal|glam metal|grindcore|metal'),
    fam: { rock: 1, aerobic: 0.1 }, sub: { metal: 1 }, label: 'Metal', bpm: 120,
  },
  { re: word('hard rock|hair metal'), fam: { rock: 1 }, sub: { metal: 0.45 }, bpm: 120 },
  { re: word('post grunge|grunge'), fam: { rock: 1 }, sub: { metal: 0.3 }, bpm: 110 },
  { re: word('pop punk|emo pop|easycore'), fam: { rock: 0.8, pop: 0.4 }, sub: { punk: 0.8 }, bpm: 160 },
  { re: word('post punk revival|post punk|new wave|coldwave'), fam: { rock: 0.7, pop: 0.5, disco: 0.2 }, sub: { punk: 0.25 }, bpm: 130 },
  { re: word('happy hardcore|uk hardcore|hardcore techno|gabber|hardstyle|jumpstyle|speedcore'), fam: { aerobic: 0.9, pop: 0.2 }, sub: { edm: 0.9 }, bpm: 155 },
  { re: word('breakcore|drill n bass|drill and bass|digital hardcore'), fam: { aerobic: 0.9, hiphop: 0.1 }, sub: { bass: 0.85 }, name: 'Breakcore', bpm: 175 },
  { re: word('midwest emo'), fam: { rock: 0.9, pop: 0.3 }, sub: { punk: 0.6 }, bpm: 140 },
  { re: word('hardcore punk|hardcore(?! hip hop| rap)|punk rock|skate punk|street punk|oi|emo(?! rap)|screamo|punk'), fam: { rock: 1, aerobic: 0.3 }, sub: { punk: 1 }, label: 'Punk', bpm: 170 },
  { re: word('industrial rock|industrial|ebm|electronic body music|aggrotech|futurepop'), fam: { rock: 0.5, aerobic: 0.5 }, sub: { metal: 0.3 }, label: 'Industrial', bpm: 125 },
  // --- Rock and pop compounds.
  { re: word('power ballads?|rock ballad'), fam: { rock: 0.6, pop: 0.6 }, calm: 0.65, soft: 0.5, form: true, label: 'Power ballad', bpm: 75 },
  { re: word('soft rock|yacht rock|piano rock|acoustic rock|adult alternative'), fam: { rock: 0.6, pop: 0.6 }, calm: 0.62, soft: 0.6, bpm: 100 },
  { re: word('folk pop|pop folk'), fam: { pop: 0.7, rock: 0.4 }, calm: 0.55, soft: 0.5, bpm: 105 },
  { re: word('folk rock|indie folk|contemporary folk|freak folk|anti folk|chamber folk|americana folk|american folk|alternative folk|alt folk|psychedelic folk|psych folk|progressive folk|folktronica|neofolk|dark folk|stomp and holler|folk punk'), fam: { pop: 0.7, rock: 0.4 }, calm: 0.55, soft: 0.5, bright: 'country', bpm: 105 },
  { re: word('rock and roll|rock n roll|rock n rollo|rockabilly|psychobilly|doo wop|skiffle'), fam: { rock: 1, pop: 0.3 }, themes: ['swing'], bpm: 150 },
  // Surf music is the 1960s floor (the twist, the swim, the pony: global and disco & funk moves), not the jive.
  { re: word('surf rock|surf pop|surf music|surf'), fam: { rock: 0.7, pop: 0.5, disco: 0.15 }, bpm: 140 },
  { re: word('funk rock|funk metal'), fam: { funk: 0.7, rock: 0.6 }, bpm: 115 },
  { re: word('pop rock|power pop|pop punk revival|pop rock'), fam: { pop: 0.7, rock: 0.6 }, bpm: 120 },
  { re: word('dream pop|shoegaze|slowcore|sadcore|post rock|space rock|ethereal wave'), fam: { pop: 0.6, rock: 0.5 }, calm: 0.7, soft: 0.6, bpm: 90 },
  { re: word('darkwave|gothic rock|goth rock|deathrock|goth'), fam: { rock: 0.6, pop: 0.4, disco: 0.2 }, bpm: 125 },
  { re: word('bedroom pop|chamber pop|baroque pop|indie pop|art pop|sophisti pop|alt pop|alternative pop'), fam: { pop: 0.9, rock: 0.3 }, calm: 0.5, bpm: 110 },
  // --- Hip-hop, bass music and electronic.
  { re: word('drill|uk drill|ny drill|brooklyn drill|chicago drill|bronx drill|jersey drill'), fam: { hiphop: 1 }, sub: { drill: 1, trap: 0.3 }, label: 'Drill', bpm: 142 },
  { re: word('phonk|drift phonk|memphis rap'), fam: { hiphop: 0.6, aerobic: 0.4 }, sub: { bass: 1 }, name: 'Phonk', label: 'Phonk', bpm: 130 },
  { re: word('dubstep|riddim|brostep|tearout'), fam: { aerobic: 0.8, hiphop: 0.2 }, sub: { bass: 1 }, name: 'Dubstep', label: 'Dubstep', bpm: 140 },
  { re: word('drum and bass|drum n bass|drum bass|dnb|d and b|jungle|liquid funk|liquid dnb|neurofunk|jump up|techstep|ragga jungle'), fam: { aerobic: 0.9, hiphop: 0.1 }, sub: { bass: 1 }, name: 'Drum & bass', label: 'Drum & bass', bpm: 172 },
  { re: word('future bass|bass music|bass house|trap edm|edm trap|midtempo bass'), fam: { aerobic: 0.7, hiphop: 0.3 }, sub: { bass: 0.8, edm: 0.3 }, bpm: 145 },
  { re: word('uk garage|2 step|speed garage|garage house|bassline|uk funky|garage(?! rock| punk)'), fam: { aerobic: 0.5, disco: 0.3, hiphop: 0.3 }, sub: { house: 0.6 }, bpm: 132 },
  { re: word('grime'), fam: { hiphop: 0.9, aerobic: 0.2 }, sub: { drill: 0.3 }, label: 'Grime', bpm: 140 },
  { re: word('jersey club|baltimore club|footwork|juke|chicago footwork|ghetto house|ghettotech'), fam: { hiphop: 0.6, aerobic: 0.5 }, sub: { bass: 0.3 }, bpm: 140 },
  { re: word('big room house|big room|electro house|progressive house|festival|complextro|melbourne bounce'), fam: { aerobic: 0.8, pop: 0.3 }, sub: { edm: 1 }, bpm: 128 },
  { re: word('tropical house|melodic house'), fam: { pop: 0.6, aerobic: 0.4, disco: 0.2 }, sub: { house: 0.6, edm: 0.3 }, calm: 0.45, soft: 0.4, bpm: 112 },
  { re: word('deep house|tech house|future house|french house|disco house|chicago house|acid house|soulful house|piano house|house'), fam: { disco: 0.5, aerobic: 0.5, pop: 0.3 }, sub: { house: 1 }, label: 'House', bpm: 124 },
  { re: word('eurodance|eurobeat|euro house|italo dance|hands up|hi nrg|hinrg'), fam: { pop: 0.5, aerobic: 0.6, disco: 0.2 }, sub: { edm: 0.5 }, bpm: 135 },
  { re: word('edm|electronic dance music|trance|psytrance|psychedelic trance|goa trance|uplifting trance|hard trance|techno|hard techno|minimal techno|detroit techno|acid techno|rave'), fam: { aerobic: 0.8, pop: 0.3 }, sub: { edm: 1 }, bpm: 132 },
  { re: word('electropop|electro pop|synth pop|synthpop|synthwave|retrowave|electroclash|hyperpop|digicore|glitchcore|nightcore'), fam: { pop: 0.8, disco: 0.3, aerobic: 0.3 }, bpm: 120 },
  { re: word('dance pop|(?<!belly |folk |line |square )dance'), fam: { pop: 0.5, aerobic: 0.5, disco: 0.3 }, label: 'Dance', bpm: 122 },
  { re: word('dark ambient|ambient|drone|space music|new age|meditation|healing|relaxation|sleep|nature sounds|soundscape|field recording|sound art|musique concrete'), fam: STILL, calm: 0.85, soft: 0.9, still: true, bpm: 70 },
  { re: word('downtempo|chillwave|chillout|chill out|lo fi hip hop|lo fi|lofi|trip hop|vaporwave'), fam: { pop: 0.6, hiphop: 0.2 }, calm: 0.75, soft: 0.7, bpm: 85 },
  { re: word('chiptune|8 bit|bitpop|video game music|video games?|vgm|game music'), fam: { aerobic: 0.5, pop: 0.5 }, conf: 0.6, bpm: 130 },
  { re: word('electronica|electronic|electro(?! swing)|idm|glitch|breakbeat|breaks|big beat|indietronica'), fam: { aerobic: 0.6, pop: 0.4, disco: 0.15 }, label: 'Electronic', bpm: 125 },
  // --- Gospel and worship (before soul and R&B: "gospel soul", "urban contemporary gospel" are gospel floors).
  // Gospel opens the gospel set (the choir step and claps, raised-hand praise, the praise-break shout); worship /
  // CCM names, whose floor is the raised hands and the sway rather than the shout, open it less firmly (with a
  // list, the iTunes "Christian & Gospel" tag alone stays below SUB_OPEN, as every tag does).
  { re: word('southern gospel|bluegrass gospel|country gospel'), fam: { pop: 0.7, rock: 0.15, funk: 0.15 }, sub: { gospel: 0.8 }, calm: 0.5, bpm: 100 },
  { re: word('urban contemporary gospel|contemporary gospel|traditional gospel|black gospel|gospel music|gospel soul|praise break|gospel'), fam: { pop: 0.7, funk: 0.2 }, sub: { gospel: 1 }, calm: 0.5, label: 'Gospel', bpm: 100 },
  { re: word('christian and gospel|christian|worship|praise and worship|ccm|inspirational|contemporary christian|spirituals'), fam: { pop: 0.7, funk: 0.2 }, sub: { gospel: 0.6 }, calm: 0.5, label: 'Gospel', bpm: 100 },
  // --- Disco, soul, R&B, funk.
  { re: word('post disco|boogie(?! woogie)'), fam: { disco: 0.8, funk: 0.6 }, bpm: 115 },
  { re: word('nu disco|italo disco|euro disco|hustle|disco'), fam: { disco: 1, funk: 0.3 }, label: 'Disco', bpm: 118 },
  { re: word('new jack swing'), fam: { hiphop: 0.6, funk: 0.6, pop: 0.3 }, sub: { rnb: 0.7 }, bpm: 105 },
  { re: word('quiet storm|slow jam'), fam: { funk: 0.5, pop: 0.5, hiphop: 0.3 }, sub: { rnb: 0.8 }, calm: 0.68, soft: 0.7, bpm: 70 },
  { re: word('contemporary r and b|alternative r and b|r and b|rhythm and blues|rnb|neo soul|urban contemporary|urban(?! cowboy)'), fam: { funk: 0.6, hiphop: 0.4, pop: 0.4, disco: 0.1 }, sub: { rnb: 1 }, label: 'R&B', bpm: 90 },
  { re: word('g funk'), fam: { hiphop: 0.8, funk: 0.4 }, bpm: 92 },
  { re: word('soul blues|southern soul'), fam: { funk: 0.7, pop: 0.3 }, sub: { rnb: 0.6 }, bpm: 95 },
  { re: word('soul|motown|northern soul|philly soul|funk soul|blue eyed soul'), fam: { funk: 0.8, pop: 0.4, disco: 0.2 }, sub: { rnb: 0.3 }, label: 'Soul', bpm: 105 },
  { re: word('acid jazz|jazz funk|jazz fusion|fusion|nu jazz|crossover jazz'), fam: { funk: 0.8, pop: 0.3 }, bpm: 110 },
  { re: word('go go'), fam: { funk: 1, hiphop: 0.3 }, label: 'Go-go', bpm: 105 },
  { re: word('funk'), fam: { funk: 1, disco: 0.3 }, label: 'Funk', bpm: 108 },
  // --- Hip-hop.
  // The bare umbrella name, however it is written ("Hip hop", "hip-hop", "Rap", "Hip-Hop/Rap"), shows one way.
  { re: /^ (?:hip hop|hiphop|rap|hip hop rap|rap hip hop) $/g, fam: { hiphop: 1, pop: 0.2, funk: 0.1 }, label: 'Hip-hop', fixed: true, bpm: 92 },
  { re: word('cloud rap|emo rap|sad rap'), fam: { hiphop: 0.9, pop: 0.2 }, sub: { trap: 0.5 }, calm: 0.45, bpm: 140 },
  { re: word('crunk|snap|hyphy|rage|plugg|pluggnb'), fam: { hiphop: 1, pop: 0.1 }, sub: { trap: 0.4 }, bpm: 145 },
  { re: word('trap'), fam: { hiphop: 1, pop: 0.1 }, sub: { trap: 1 }, label: 'Trap', bpm: 145 },
  { re: word('chopped and screwed|screwed|screw'), fam: { hiphop: 1 }, calm: 0.5, label: 'Chopped and screwed', bpm: 70 },
  { re: word('pop rap|hip pop'), fam: { hiphop: 0.7, pop: 0.6 }, label: 'Pop rap', bpm: 95 },
  { re: word('country rap|hick hop'), fam: { hiphop: 0.6, pop: 0.3, rock: 0.2 }, themes: ['country'], bpm: 95 },
  { re: word('jazz rap|lo fi rap|abstract hip hop'), fam: { hiphop: 1, funk: 0.3 }, calm: 0.45, bpm: 88 },
  {
    re: word('boom bap|golden age hip hop|old school hip hop|old school rap|east coast hip hop|west coast hip hop|southern hip hop|midwest hip hop|conscious hip hop|gangsta rap|hardcore hip hop|hardcore rap|underground rap|alternative rap|dirty south|miami bass|bounce|horrorcore|deutschrap|hip hop|hiphop|rap'),
    fam: { hiphop: 1, pop: 0.2, funk: 0.1 }, label: 'Hip-hop', bpm: 92,
  },
  // --- Country and folk.
  { re: word('scottish country dance|scottish country|english country dance|english country|ceilidh|irish traditional|irish trad|scottish traditional|celtic traditional'), fam: { pop: 0.6, party: 0.2, rock: 0.2 }, themes: ['folk'], bpm: 115 },
  { re: word('country pop|bro country|pop country'), fam: { pop: 0.7, rock: 0.3, aerobic: 0.2 }, themes: ['country'], label: 'Country pop', bpm: 115 },
  { re: word('cajun|zydeco'), fam: { pop: 0.5, rock: 0.3, party: 0.2 }, themes: ['country'], bpm: 120 },
  { re: word('country(?! blues)|americana|bluegrass|honky tonk|outlaw country|alt country|western swing|western|red dirt|texas country|cowpunk|nashville sound|urban cowboy|line dance|line dancing|texas two step|square dance|appalachian|clogging|mountain music'), fam: { pop: 0.6, rock: 0.4, aerobic: 0.2 }, themes: ['country'], label: 'Country', bpm: 110 },
  // --- Ballads and the gentle.
  { re: word('piano ballad|ballad|ballads|torch song|lullaby|lullabies|lullabye'), fam: { pop: 0.8, rock: 0.2 }, calm: 0.85, soft: 0.8, form: true, label: 'Ballad', bpm: 70 },
  { re: word('singer songwriter|acoustic(?! blues)|unplugged'), fam: { pop: 0.9, rock: 0.2 }, calm: 0.6, soft: 0.6, label: 'Singer-songwriter', bpm: 95 },
  // --- Jazz, swing and blues.
  // Jazz is danced as swing (the swing set) or smooth and flowing: never the disco & funk floor (no disco points on Coltrane).
  { re: word('smooth jazz|cool jazz|vocal jazz|jazz vocal'), fam: { pop: 0.8, funk: 0.2 }, themes: ['swing'], calm: 0.7, soft: 0.7, bpm: 100 },
  { re: word('electro swing'), fam: { funk: 0.5, aerobic: 0.4, disco: 0.3 }, themes: ['swing'], bpm: 125 },
  { re: word('free jazz|avant garde jazz|avant garde|experimental'), fam: STILL, calm: 0.5, conf: 0.5, bpm: 90 },
  { re: word('jump blues|boogie woogie'), fam: { funk: 0.5, rock: 0.3, pop: 0.2 }, themes: ['swing'], bpm: 150 },
  // The ballroom swing and standard dances: the swing set has the jive / Charleston kicks and the waltz steps.
  { re: word('jive|charleston|foxtrot|quickstep|viennese waltz|waltz'), fam: { pop: 0.7, funk: 0.2, rock: 0.1 }, themes: ['swing'], bpm: 120 },
  { re: word('jazz|swing|big band|lindy hop|bebop|hard bop|post bop|bop|modal jazz|dixieland|trad jazz|ragtime|stride'), fam: { pop: 0.7, funk: 0.25, rock: 0.15 }, themes: ['swing'], label: 'Jazz', bpm: 135 },
  { re: word('blues rock|electric blues|chicago blues|texas blues|british blues|modern blues|contemporary blues'), fam: { rock: 0.7, funk: 0.4 }, bpm: 115 },
  { re: word('delta blues|country blues|acoustic blues|piedmont blues|folk blues|classic blues'), fam: { funk: 0.5, pop: 0.3, rock: 0.2 }, sub: { rnb: 0.4 }, calm: 0.5, soft: 0.5, bpm: 90 },
  // Blues dancing is the slow drag, grind and sway of a pulsing groove: the R&B set's isolations, soul grooves; never headbangs.
  { re: word('blues'), fam: { funk: 0.6, pop: 0.25, rock: 0.25 }, sub: { rnb: 0.55 }, label: 'Blues', bpm: 100 },
  // --- Traditions.
  { re: word('bhangra|punjabi'), fam: { pop: 0.6, hiphop: 0.4, aerobic: 0.3 }, themes: ['bhangra', 'bollywood'], label: 'Bhangra', bpm: 110 },
  { re: word('garba|dandiya|gujarati'), fam: { pop: 0.7, latin: 0.3 }, themes: ['garba', 'bollywood'], label: 'Garba', bpm: 120 },
  { re: word('indian classical|carnatic|carnatic classical|hindustani|hindustani classical|ghazals?|bhajan|devotional and spiritual|devotional|kirtan'), fam: STILL, calm: 0.7, still: true, bpm: 75 },
  { re: word('bollywood|filmi|indian pop|indipop|indian|hindi|desi|tollywood|kollywood|tamil|telugu|malayalam|kannada|regional indian|bhojpuri|haryanvi|marathi|lavani|lollywood|pashto'), fam: { pop: 0.7, latin: 0.3, disco: 0.2 }, themes: ['bollywood'], bpm: 110 },
  { re: word('qawwali|sufi'), fam: { pop: 0.6, latin: 0.2 }, themes: ['bollywood'], calm: 0.5, bpm: 100 },
  { re: word('arabic pop|arabic|arab|middle eastern|middle east|khaleeji|levant|maghreb|raqs|belly dance|bellydance|arabesque|mahraganat|shaabi|chaabi|rai|mizrahi|turkish pop|turkish|egyptian|lebanese|moroccan|algerian|tunisian|arabesk|persian pop|persian|iranian|bandari'), fam: { pop: 0.7, latin: 0.3 }, themes: ['bellydance'], bpm: 105 },
  { re: word('dangdut|koplo|joget'), fam: { pop: 0.7, latin: 0.3 }, sub: { dangdut: 1 }, focus: HIPS, label: 'Dangdut', bpm: 120 },
  // Thai luk thung and mor lam: a party dance close to the joget (sway, soft hands); less firmly the same floor.
  { re: word('luk thung|look thung|luk thoong|mor lam|molam|lam sing'), fam: { pop: 0.8, latin: 0.2 }, sub: { dangdut: 0.6 }, focus: HIPS, bpm: 120 },
  { re: word('hawaiian|hapa haole|hula|polynesian|hawaii|tahitian|otea|aparima|samoan|siva|tongan|fijian|pacific islands?'), fam: { pop: 0.7, latin: 0.2 }, themes: ['hula'], label: 'Hawaiian', bpm: 95 },
  { re: word('capoeira'), fam: { latin: 0.8 }, themes: ['capoeira'], label: 'Capoeira', bpm: 110 },
  // The named folk traditions (a nation's or people's folk, folk dance, folklore): the world folk-dance set.
  {
    re: word(`(?:${FOLK_PEOPLES}) folk(?: music)?|celtic|polka|klezmer|balkan|folk dances?|traditional folk|traditional music|volksmusik|turbo folk|chalga|manele|rebetiko|laiko|sirtaki|dabke|horon|halay|folklore|folkloric|world folk|ethnic`),
    fam: { pop: 0.6, party: 0.2, rock: 0.2 }, themes: ['folk'], label: 'Folk', bpm: 115,
  },
  // Plain "folk" (a store shelf, an infobox's "folk") is the Western singer-songwriter music: gentle, by its traits.
  { re: word('folk music|folk'), fam: { pop: 0.7, rock: 0.4 }, calm: 0.55, soft: 0.5, bright: 'country', label: 'Folk', bpm: 105 },
  { re: word('fado|chanson|cabaret|canzone|variete|ye ye'), fam: { pop: 0.9, latin: 0.1 }, calm: 0.55, bpm: 100 },
  // --- Latin umbrella (after its dances).
  { re: word('alternativo and rock latino|rock en espanol|latin rock|rock latino'), fam: { rock: 0.7, latin: 0.5 }, label: 'Latin rock', bpm: 120 },
  { re: word('raices|latin folk|andean|nueva cancion|trova'), fam: { latin: 0.8, pop: 0.3 }, label: 'Latin folk', bpm: 105 },
  { re: word('latin pop|pop latino|pop in spanish|latin|latino|latina|spanish pop|pop en espanol|contemporary latin'), fam: { latin: 0.9, pop: 0.5 }, focus: HIPS, label: 'Latin pop', bpm: 105 },
  // --- Contexts and umbrellas.
  { re: word('fitness and workout|fitness|workout|aerobics'), fam: { aerobic: 0.8, pop: 0.5 }, label: 'Workout', bpm: 130 },
  { re: word('children s music|childrens music|children|kids|nursery rhymes|nursery|novelty|comedy songs|parody'), fam: { party: 0.7, pop: 0.6, aerobic: 0.4 }, label: "Children's music", bpm: 115 },
  { re: word('christmas|holiday'), fam: { pop: 0.8, party: 0.3, disco: 0.2 }, label: 'Holiday', conf: 0.7, bpm: 115 },
  { re: word('hymns?|choral|choir|a cappella|gregorian chant|chant|sacred|requiem|mass|oratorio|cantata'), fam: STILL, calm: 0.85, soft: 0.9, still: true, label: 'Choral', bpm: 70 },
  {
    re: word('classical|baroque era|baroque|classical era|romantic era|romantic|renaissance|medieval|early music|modern era|minimalism|impressionist|chamber music|orchestral|symphony|symphonic|concerto|sonata|opera|operetta|art song|lieder|contemporary classical|modern classical|neoclassical|piano'),
    fam: STILL, calm: 0.8, soft: 0.8, still: true, conf: 0.8, label: 'Classical', bpm: 75,
  },
  { re: word('film score|original score|score|cinematic|trailer music'), fam: STILL, calm: 0.7, still: true, conf: 0.6, label: 'Film score', bpm: 80 },
  { re: word('spoken word|poetry|audiobook|audiobooks|comedy|stand up|asmr|sound effects|speech'), fam: STILL, calm: 0.75, still: true, conf: 0.6, label: 'Spoken word', bpm: 70 },
  { re: word('soundtrack|musicals|musical theatre|musical|show tunes|broadway|disney|film|tv soundtrack|film soundtrack'), fam: { pop: 0.7, disco: 0.2, aerobic: 0.2 }, conf: 0.5, label: 'Soundtrack', bpm: 110 },
  { re: word('vocal'), fam: { pop: 1, funk: 0.1 }, calm: 0.6, soft: 0.5, label: 'Vocal standards', fixed: true, bpm: 105 },
  { re: word('easy listening|adult contemporary|traditional pop|vocal pop|vocal standards|lounge|exotica|space age pop'), fam: { pop: 1, funk: 0.1 }, calm: 0.6, soft: 0.5, bpm: 100 },
  { re: word('instrumental'), fam: { pop: 0.8 }, calm: 0.6, conf: 0.5, label: 'Instrumental', bpm: 100 },
  // Party Schlager, Oktoberfest and apres-ski: the beer-hall floor (schunkeln, the toast, the polka from folk).
  { re: word('partyschlager|party schlager|schlager|oktoberfest|ballermann|apres ski|stimmungsmusik|volkstumliche musik|discofox'), fam: { pop: 0.7, latin: 0.3, disco: 0.2 }, sub: { schlager: 1 }, label: 'Schlager', bpm: 120 },
  { re: word('europop|french pop|german pop|italian pop|greek|afrikaans'), fam: { pop: 0.7, latin: 0.3, disco: 0.2 }, bpm: 120 },
  { re: word('world music|worldbeat|world|worldwide|international'), fam: { pop: 0.6, latin: 0.3, disco: 0.2 }, conf: 0.5, label: 'World music', fixed: true, bpm: 110 },
  { re: word('chinese|japanese|thai|indonesian|malaysian|filipino|opm|original pilipino music|vietnamese'), fam: { pop: 0.8, kpop: 0.3 }, conf: 0.6, bpm: 110 },
  { re: word('teen pop|bubblegum pop|bubblegum|pop'), fam: { pop: 1, hiphop: 0.15, disco: 0.1 }, label: 'Pop', bpm: 112 },
  { re: word('alternative rock|alt rock|indie rock|garage rock|britpop|madchester|college rock|art rock|progressive rock|prog rock|psychedelic rock|psychedelic|stoner rock|arena rock|glam rock|southern rock|classic rock|heartland rock|roots rock|gothic rock|noise rock|math rock|krautrock|rock'), fam: { rock: 1, pop: 0.25 }, label: 'Rock', bpm: 120 },
  { re: word('alternative|alt|indie'), fam: { rock: 0.7, pop: 0.5 }, label: 'Alternative', bpm: 115 },
];

/** One genre name, read: its normalised families and everything else it says (placed = false: nothing matched). */
interface Reading {
  placed: boolean;
  fam: Weights;
  subs: Subs;
  themes: Set<Theme>;
  focus: FocusMap | null;
  calm: number | null;
  soft: number | null;
  name?: string;
  conf: number;
  /** The name the owner sees (null: too vague to name the song). */
  label: string | null;
  scene?: string;
  still: boolean;
  /** Typical stepping tempo (geometric mean of the matched entries'). */
  bpm?: number;
  /** Every matched entry is a song form ("ballad"): see Lex.form. */
  form: boolean;
  /** A tradition the music has when it is bright (Lex.bright). */
  bright?: Theme;
  /** A bare umbrella name (BROAD_NAMES). */
  broad: boolean;
}

/** "R&B/Soul" -> "r and b soul"; "Hip-Hop/Rap" -> "hip hop rap"; "Rock 'n' Roll" -> "rock n roll". */
function normGenre(s: string): string {
  return ` ${fold(s)
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/** A genre name as the owner sees it: as written, trimmed, first letter capitalised; null for store-style compounds ("Hip-Hop/Rap"). */
function asWritten(name: string): string | null {
  const s = name.replace(/\s+/g, ' ').trim();
  if (!s || s.length > 28 || /[/\\|]/.test(s)) return null;
  // Lower-case tag sources ("edm", "uk garage", "r&b"): their acronyms as people write them.
  const t = s.split(' ').map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w)).join(' ');
  return t[0].toUpperCase() + t.slice(1);
}
const ACRONYMS = new Set(['uk', 'us', 'edm', 'idm', 'dnb', 'ebm', 'mpb', 'dj', 'ny', 'nyc', 'opm', 'r&b', 'rnb', 'ccm', 'vgm']);

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
  const softs: number[] = [];
  let placed = false;
  let subName: string | undefined;
  let conf = 0;
  let label: string | null | undefined;
  let scene: string | undefined;
  let still = true;
  let logBpm = 0, nBpm = 0;
  let form = true;
  let bright: Theme | undefined;
  const broad = BROAD_NAMES.has(s.trim());
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
    if (e.soft !== undefined) softs.push(e.soft);
    if (e.name && !subName) subName = e.name;
    // The first (most specific) entry names the reading: its label, else the name as written.
    if (label === undefined) label = e.label === null ? null : e.fixed ? e.label! : (asWritten(key) ?? e.label ?? null);
    if (e.scene && !scene) scene = e.scene;
    if (!e.still) still = false;
    if (e.bpm) (logBpm += Math.log2(e.bpm)), nBpm++;
    if (!e.form) form = false;
    if (e.bright && !bright) bright = e.bright;
  }
  const r: Reading = {
    placed,
    fam: normWeights(fam) ?? {},
    subs,
    themes,
    focus,
    calm: calms.length ? Math.max(...calms) : null,
    soft: softs.length ? Math.max(...softs) : null,
    conf: placed ? conf : 0,
    label: placed ? (label ?? null) : null,
    still: placed && still,
    ...(subName ? { name: subName } : {}),
    ...(scene ? { scene } : {}),
    ...(nBpm ? { bpm: Math.round(2 ** (logBpm / nBpm)) } : {}),
    form: placed && form,
    ...(bright ? { bright } : {}),
    broad: placed && broad,
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
  /** Per theme, the weight of the strongest name saying it relative to the strongest name of all (1 = a leading name). */
  themeRel: Map<Theme, number>;
  focus: FocusMap | null;
  /** Calm hint (weighted mean of the names that hint one, pulled toward neutral by the names that don't). */
  calm: number | null;
  /** Softness hint (as calm: names that say soft-but-steady music). */
  soft: number | null;
  name?: string;
  /** The name the owner sees: the strongest named evidence (a scene first). */
  label?: string;
  /** That name already names a sub-style or scene. */
  labelSpecific?: boolean;
  /** All the placed names are not dance music (classical, ambient ...). */
  still: boolean;
  /** The scene a song-level name says (K-pop, J-pop ...), when any does. */
  scene?: string;
  /** Typical stepping tempo of the genre names (weighted geometric mean). */
  bpm?: number;
  /**
   * Leading families of the names about the song itself (the tag included; album names, forms, refinements and
   * bare umbrellas aside): a name here says the music's form in that family, so the audio does not turn it into
   * another sub-style of the family (TRAIT_ALONE).
   */
  formed: Set<Family>;
  /** Traditions the leading names give a bright song (Lex.bright). */
  bright: Set<Theme>;
  /** Artist genres read as a refinement of a bare umbrella, left out of the weak artist score. */
  refined: string[];
}

/**
 * How much each kind of genre evidence counts. The song's own list (`genres`,
 * e.g. its Wikipedia infobox, most important first) is the primary evidence.
 * The single tag (iTunes primaryGenreName) is the fallback when the list
 * placed nothing; with a list, it is a tie-breaker: ITUNES_TIE of the family
 * weight, and its sub-style evidence counts at most ITUNES_SUB (below
 * SUB_OPEN: it opens a sub-style only together with other evidence, a list
 * name or the audio; "R&B/Soul" alone never makes a eurodance song R&B).
 *
 * Levels (`genreLevels`, parallel to `genres`): the list holds names about
 * the song itself ('song') and about its album ('album'). The style is about
 * the song, so beside any song-level name an album-level name is a weaker
 * score, one rule for all of them:
 *   - its family / label / calm / tempo weight is ALBUM_FAM of a song-level
 *     name's at the same place (positions count within each level);
 *   - its sub-style evidence counts at most ALBUM_SUB (below SUB_OPEN, like the
 *     tag's: it opens a set only together with other evidence), its themes and
 *     body focus not at all, and it never names a scene;
 *   - except where it NARROWS the song's own names (narrowsSong): it says a
 *     dance (a sub-style, scene or tradition) in the main family of a broad
 *     song-level name, and no song-level name of that family says one. Then
 *     its dance counts as a song-level name's would at its place: bachata
 *     under "Latin pop, tropical", cumbia under "tropical". R&B from the album
 *     next to "electro house", rock next to "K-pop", nu metal next to
 *     "alternative metal" stay weak.
 * With no song-level name at all, album names are the best evidence there is
 * and count ALBUM_ALONE of a song-level name's (weights and sub-styles).
 * The relation is the lexicon's own (a name's families and what it says), not
 * the lookup's genre vocabulary.
 *
 * The artist's genres (`artistGenres`, best first; or the single
 * `artistGenre`) are read as a list of their own and blended in at
 * ARTIST_SHARE at most (resolveSongStyle).
 *
 * A bare umbrella: when everything said about the song itself is the store's
 * tag, and the tag is broad ("Alternative", "Pop", "Rock", "Folk": no dance,
 * scene or tradition), the song level says only the family. Then the
 * artist's and the album's names WITHIN that family (their families overlap
 * the tag's by REFINE_OVERLAP) refine it: they join the evidence at REFINE_W
 * of a song-level name's weight (sub-style evidence REFINE_SUB of its score),
 * never naming the label or a scene, so the tag stays the main thing.
 * "Alternative" + the artist's "punk" dances punk-flavoured alternative;
 * "Country" + the artist's "hip hop" stays country (no overlap).
 *
 * Song forms (Lex.form: "ballad", which the lookup appends after the genres)
 * say how the song moves: their calm, softness and tempo count wherever they
 * are listed (as a song-level name's, an album one's beside song names), their
 * family and label FORM_FAM, and they take no place among the genres.
 */
const ITUNES_TIE = 0.3;
/** Family share a refining name must have in common with the bare umbrella (alternative vs shoegaze 0.87, vs punk 0.58; pop vs synth-pop 0.65, vs R&B 0.45, vs house 0.31). */
export const REFINE_OVERLAP = 0.5;
/** Weight of a refining artist / album name relative to a song-level name at the same place. */
export const REFINE_W = 0.5;
/** Sub-style evidence of a refining name: this share of its score (punk 1 -> 0.6: opens the punk set). */
export const REFINE_SUB = 0.6;
/**
 * A theme's weight (SongStyle.themeW) from its strongest name's weight relative to the strongest name of
 * all (names weigh 1 / (1 + 0.5 i) at place i): 0 at THEME_FADE[0], whole from THEME_FADE[1]. The first
 * three names say a tradition whole (0.5 at the third); the fourth 0.67, the fifth 0.44, the sixth 0.29;
 * the store's tag beside a list (ITUNES_TIE) 0.33.
 */
export const THEME_FADE: readonly [number, number] = [0.2, 0.5];
/** Family and label weight of a song form beside genre names. */
const FORM_FAM = 0.3;
export const ITUNES_SUB = 0.4;
/** Weight of an album-level name beside song-level ones, relative to a song-level name at the same place. */
export const ALBUM_FAM = 0.3;
/** Most sub-style evidence an album-level name gives beside song-level ones, unless it narrows them (below SUB_OPEN). */
export const ALBUM_SUB = 0.4;
/** Album-level names when there is no song-level name: nearly song-level evidence. */
export const ALBUM_ALONE = 0.85;
/** Share of a name's families its main family must have for the name to be a form of that family (bachata 0.77 latin; reggae 0.42: a blend). */
const NARROW_SHARE = 0.6;
/** Sub-style score from which a name says which dance (hard rock's metal 0.45 does; grunge's 0.3 does not). */
const SPECIFIC_SUB = 0.45;
/**
 * A list name's sub-style evidence falls by position (1 - 0.12 i) to this floor: from the fifth name on it
 * can't open a sub-style alone (SUB_OPEN), as the tag can't ("Eurodance, electronic, dance, house, euro
 * house, R&B": no slow-jam R&B on a eurodance song).
 */
const LIST_POS_FLOOR = 0.4;
/** A scene a song-level name says takes this share of the families (it leads the dancing: BTS with "pop rap, boom bap, hip hop, alt-pop, K-pop"). */
const SCENE_LEAD = 0.6;

/** A reading's own family when one family makes up at least NARROW_SHARE of it (bachata: latin; reggae, a latin / hip-hop blend: none). */
function mainFamily(r: Reading): Family | null {
  const f = topFamily(r.fam);
  return f && (r.fam[f] ?? 0) >= NARROW_SHARE ? f : null;
}
/** The name says which dance, scene or tradition (a sub-style, a scene, a theme), not only the broad family. */
function isSpecific(r: Reading): boolean {
  return !!r.scene || r.themes.size > 0 || Object.values(r.subs).some((v) => (v ?? 0) >= SPECIFIC_SUB);
}
/**
 * Whether an album-level name narrows what the song-level names say: it is specific, it is a form of one
 * family (mainFamily), song-level names lead with that family, and they are all broad there ("tropical",
 * "Latin pop", "hip hop", "rock", "electronic": its umbrella); none of them says a dance of that family
 * already. Bachata under "Latin pop, tropical", cumbia under "tropical": yes. R&B under "electro house"
 * (another family), rock under "K-pop" (not specific), nu metal next to "alternative metal" (the song
 * already says which): no.
 */
function narrowsSong(a: Reading, song: readonly Reading[]): boolean {
  const f = mainFamily(a);
  if (!f || !isSpecific(a)) return false;
  const kin = song.filter((s) => topFamily(s.fam) === f);
  return kin.length > 0 && !kin.some(isSpecific);
}

/** Share of family mass two readings have in common (the sum of the smaller weights; both are normalised). */
function overlap(a: Weights, b: Weights): number {
  let o = 0;
  for (const f of FAMILIES) o += Math.min(a[f] ?? 0, b[f] ?? 0);
  return o;
}

function genreEvidence(list: readonly string[] | undefined, tag: string | undefined, levels?: readonly string[], artist?: readonly string[]): GenreEvidence {
  /**
   * album: an album-level name beside song-level ones; adds: ... that narrows them (its dance, themes and focus
   * count); refine: an artist name refining a bare umbrella; wc: weight of its calm / softness / tempo (a form's
   * counts wherever it is listed).
   */
  type Item = { r: Reading; w: number; pos: number; tag: boolean; album?: true; adds?: boolean; refine?: true; wc: number; tw?: number };
  const items: Item[] = [];
  // Levels apply only when they match the list entry for entry; without them every name is song-level.
  const lv = Array.isArray(levels) && list && levels.length === list.length ? levels : undefined;
  const read = (list ?? [])
    .map((g, at) => ({ r: typeof g === 'string' ? readGenre(g) : null, album: lv?.[at] === 'album', at, g }))
    .filter((x): x is { r: Reading; album: boolean; at: number; g: string } => !!x.r?.placed);
  const songNames = read.filter((x) => !x.album && !x.r.form).map((x) => x.r);
  const tagR = typeof tag === 'string' && tag.trim() ? readGenre(tag) : null;
  // A bare umbrella: the song's own names say nothing beyond the store's broad tag.
  const tagKey = tagR?.placed ? normGenre(tag!) : '';
  const bare = !!tagR?.placed && !isSpecific(tagR) && !tagR.still && read.every((x) => x.album || x.r.form || normGenre(x.g) === tagKey);
  const refines = (r: Reading) => bare && !r.form && !r.still && overlap(r.fam, tagR!.fam) >= REFINE_OVERLAP;
  // Positions count within a level (an album name listed among the song's own does not push them down), except
  // that an album name narrowing the song's names keeps the place the lookup gave it among them. Forms take no place.
  const posAt = (i: number) => Math.max(LIST_POS_FLOOR, 1 - 0.12 * i);
  const isAlbum = (j: number) => lv?.[j] === 'album';
  const formAt = new Set(read.filter((x) => x.r.form).map((x) => x.at));
  const formsOnly = read.length > 0 && read.every((x) => x.r.form);
  read.forEach(({ r, album, at }) => {
    let i = 0;
    for (let j = 0; j < at; j++) if (isAlbum(j) === album && !formAt.has(j)) i++;
    let w = r.conf / (1 + 0.5 * i);
    let pos = posAt(i);
    // A form's calm, softness and tempo count wherever it is listed; beside genres its family and label barely.
    const wc = r.form ? r.conf * (album && songNames.length ? ALBUM_FAM : 1) : 0;
    if (r.form && !formsOnly) (w *= FORM_FAM), (pos = 0);
    if (album && !songNames.length) {
      // Nothing is known about the song itself: its album's names are the best evidence there is.
      w *= ALBUM_ALONE;
      pos *= ALBUM_ALONE;
      items.push({ r, w, pos, tag: false, wc: wc || w });
    } else if (album) {
      // Beside the song's own names an album name is a weaker score; it adds a dance only where it narrows them
      // (or, under a bare umbrella, refines it as the artist's names do).
      const ref = refines(r);
      const adds = narrowsSong(r, songNames) || (ref && isSpecific(r));
      const wa = w * (ref ? REFINE_W : ALBUM_FAM);
      const pa = adds ? posAt(at) * (ref && !narrowsSong(r, songNames) ? REFINE_SUB : 1) : Math.min(pos, ALBUM_SUB);
      // A narrowing album name says its dance as a song-level name at its place would (its theme weight too).
      items.push({ r, w: wa, pos: pa, tag: false, album: true, adds, wc: wc || wa, ...(adds ? { tw: r.conf / (1 + 0.5 * at) } : {}) });
    } else items.push({ r, w, pos, tag: false, wc: wc || w });
  });
  const listed = items.length > 0;
  if (tagR?.placed) items.push(listed ? { r: tagR, w: ITUNES_TIE * tagR.conf, pos: ITUNES_SUB, tag: true, wc: ITUNES_TIE * tagR.conf } : { r: tagR, w: tagR.conf, pos: tagR.conf, tag: true, wc: tagR.conf });
  // The artist's names within the bare umbrella's family refine it.
  const refined: string[] = [];
  if (bare && artist?.length) {
    artist.forEach((g, i) => {
      const r = typeof g === 'string' ? readGenre(g) : null;
      if (!r?.placed || !refines(r)) return;
      refined.push(g);
      const w = (REFINE_W * r.conf) / (1 + 0.5 * i);
      items.push({ r, w, pos: REFINE_SUB * posAt(i), tag: false, refine: true, wc: w });
    });
  }
  const out: GenreEvidence = { fam: null, subs: {}, themes: new Set(), themeRel: new Map(), focus: null, calm: null, soft: null, still: false, formed: new Set(), bright: new Set(), refined };
  if (!items.length) return out;
  const fam: Record<string, number> = {};
  let cw = 0, cs = 0, sw = 0, ss = 0, wAll = 0, lb = 0, lw = 0;
  let labelW = -1;
  let scene: Reading | null = null;
  // A theme weighs as the strongest name saying it, against the strongest name of all (its place in the list).
  const wTop = Math.max(...items.map((it) => it.tw ?? it.w));
  for (const it of items) {
    const { r, w, pos, wc } = it;
    wAll += Math.max(w, wc);
    for (const f of FAMILIES) if (r.fam[f]) fam[f] = (fam[f] ?? 0) + w * r.fam[f]!;
    for (const k of SUB_STYLES) if (r.subs[k]) out.subs[k] = Math.max(out.subs[k] ?? 0, r.subs[k]! * pos);
    // An album name that does not narrow the song's own names brings no tradition and no body focus.
    const own = !it.album || it.adds;
    if (own) {
      const rel = wTop > 0 ? Math.min(1, (it.tw ?? w) / wTop) : 1;
      for (const t of r.themes) {
        out.themes.add(t);
        out.themeRel.set(t, Math.max(out.themeRel.get(t) ?? 0, rel));
      }
    }
    if (own && r.focus && !out.focus) out.focus = r.focus;
    if (r.calm !== null) (cw += wc), (cs += wc * r.calm);
    if (r.soft !== null) (sw += wc), (ss += wc * r.soft);
    if (r.name && !out.name && !it.refine) out.name = r.name;
    const specific = isSpecific(r);
    // A refining name never names the song: the umbrella stays the main thing.
    if (it.refine) {
      // (no label)
    } else if (r.label && w > labelW) (labelW = w), (out.label = r.label), (out.labelSpecific = specific);
    // A bare umbrella first ("Pop", "Rock") and its own compound second ("Pop rock"): the compound says more.
    else if (r.label && !it.tag && !it.album && !r.form && items.indexOf(it) === 1 && out.label && r.label.length > out.label.length && r.label.toLowerCase().includes(out.label.toLowerCase())) (out.label = r.label), (out.labelSpecific = specific);
    if (r.bpm) (lb += wc * Math.log2(r.bpm)), (lw += wc);
    if (r.scene && !it.tag && !it.album && !it.refine && !scene) scene = r;
    // A tradition of bright music comes from the leading name only (the first song name, or the tag alone).
    if (r.bright && !it.album && !it.refine && (it.tag ? !listed : items.indexOf(it) === 0)) out.bright.add(r.bright);
  }
  out.fam = normWeights(fam);
  if (scene && out.fam) {
    out.fam = blend(out.fam, scene.fam, SCENE_LEAD);
    out.scene = scene.scene;
    out.label = scene.label ?? scene.scene;
    out.labelSpecific = true;
  }
  out.still = items.every((x) => x.r.still);
  for (const x of items) {
    if (x.album || x.refine || x.r.form || x.r.broad) continue;
    const f = topFamily(x.r.fam);
    if (f) out.formed.add(f);
  }
  if (cw > 0) {
    const neutral = 0.4;
    out.calm = neutral + (cs / cw - neutral) * Math.min(1, (cw / wAll) * 1.5);
  }
  if (sw > 0) out.soft = (ss / sw) * Math.min(1, (sw / wAll) * 1.5);
  if (lw > 0) out.bpm = Math.round(2 ** (lb / lw));
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
  salsa: ['latin'], merengue: ['latin'], cumbia: ['latin'], bachata: ['latin'], chacha: ['latin'], flamenco: ['latin'], tango: ['latin'], mexican: ['latin'],
  gospel: ['pop', 'funk'], dangdut: ['pop', 'latin'], schlager: ['pop', 'party'],
};

/** The strongest family of a mix. */
function topFamily(fam: Weights): Family | null {
  let best: Family | null = null, bv = 0;
  for (const f of FAMILIES) if ((fam[f] ?? 0) > bv) (bv = fam[f]!), (best = f);
  return best;
}

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

/** Calm from which the lyrical (ballad) set starts to open, and where it is fully open (analyser 1.4.0 calm: soft-but-steady songs read ~0.4-0.64, ballads 0.79+). */
export const LYRICAL_CALM: readonly [number, number] = [0.62, 0.86];
/** Audio intensity range over which a song goes from soft (1) to not soft (0) ... */
const SOFT_INTENSITY: readonly [number, number] = [0.2, 0.45];
/** ... as long as its rhythm is not all-out (a trance lead is tonal, its drive is not soft). */
const SOFT_DRIVE: readonly [number, number] = [0.85, 1];
/** Intensity from which a song is hard-hitting (1 at the top of the range). */
const HARD_INTENSITY: readonly [number, number] = [0.7, 0.9];
/**
 * Trap and drill from the audio need a genre name for them: a half-time feel
 * is what any song counted at double tempo shows (analyser 1.4.0: halfTempo
 * includes halfFeel), so without a trap / drill name the audio evidence counts
 * only this much (below SUB_OPEN on its own).
 */
const HALF_FEEL_ALONE = 0.35;
/**
 * The audio refines a bare umbrella, never a name that already says the form in that family: heavy guitars make
 * "Rock" metal, not "Alternative", punk or post-punk; four-on-the-floor makes "Pop" or "Electronic" house, not
 * 1982 disco and synth-pop (an "R&B/Soul" tag on a eurodance track says nothing of EDM's family: it may). When a
 * song-level name (or the tag) leads with a family of the sub-style's group (SUB_GROUP) and no name gives the
 * sub-style evidence of its own (SUB_KEEP), the audio evidence for these sub-styles counts only this much (below
 * SUB_OPEN).
 */
const TRAIT_ALONE = 0.35;
const REFINED_BY_AUDIO: ReadonlySet<SubStyle> = new Set(['metal', 'punk', 'house', 'edm', 'bass']);
/** A bright song for the Western folk family's country floor (Lex.bright): major key, not soft, not calm. */
const BRIGHT_MINOR = 0.4;
const BRIGHT_SOFT = 0.5;
const BRIGHT_CALM = 0.55;

export function resolveSongStyle(song: SongInfo, priors?: StylePriors): SongStyle {
  const curated = song.style ?? (song.videoId ? STARTER_STYLES.get(song.videoId) : undefined);
  const traits = readTraits(priors?.traits);
  const bpm = priors?.bpm;
  const artistNames = Array.isArray(song.artistGenres) ? song.artistGenres.filter((g): g is string => typeof g === 'string') : typeof song.artistGenre === 'string' ? [song.artistGenre] : [];
  const ev = genreEvidence(Array.isArray(song.genres) ? song.genres : undefined, song.genre, Array.isArray(song.genreLevels) ? song.genreLevels : undefined, artistNames);
  // The artist's genres: their own list (positions weigh them), blended in at ARTIST_SHARE at most below.
  // (Names that refined a bare umbrella are in `ev` already.)
  const artistList = Array.isArray(song.artistGenres) ? song.artistGenres.filter((g): g is string => typeof g === 'string' && !ev.refined.includes(g)) : [];
  const artistEv = artistList.length ? genreEvidence(artistList, undefined) : typeof song.artistGenre === 'string' && !ev.refined.length ? genreEvidence(undefined, song.artistGenre) : null;

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
  // Music that isn't dance music keeps its neutral mix (no tempo lean).
  const still = source === 'genre' && ev.still;
  const prior = still ? null : priorWeights(bpm);
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
  // Soft-but-steady: low audio intensity on a beat that isn't all-out, or genre names that say so
  // (the analyser reads soft-but-bright styles such as bachata as driving: the genre carries them).
  const intensity = traits?.intensity;
  let soft: number | undefined;
  if (intensity !== undefined) soft = (1 - ramp(intensity, SOFT_INTENSITY[0], SOFT_INTENSITY[1])) * (1 - ramp(traits?.drive ?? 0.5, SOFT_DRIVE[0], SOFT_DRIVE[1]));
  const soundsSoft = soft;
  if (ev.soft !== null) soft = Math.max(soft ?? 0, ev.soft);
  const hard = intensity !== undefined ? ramp(intensity, HARD_INTENSITY[0], HARD_INTENSITY[1]) : undefined;

  // Sub-styles: the genre names' evidence, reinforced by the traits where the song's group fits.
  const subs: Subs = {};
  const ts = traits ? traitSubs(traits, bpm) : {};
  const trapNamed = (ev.subs.trap ?? 0) >= SUB_KEEP || (ev.subs.drill ?? 0) >= SUB_KEEP;
  for (const s of SUB_STYLES) {
    if (s === 'lyrical') continue;
    const word = ev.subs[s] ?? 0;
    let trait = (ts[s] ?? 0) * groupFit(families, s);
    if ((s === 'trap' || s === 'drill') && !trapNamed) trait *= HALF_FEEL_ALONE;
    // The bass-music set's half-time bounce on a song whose names say hip-hop is the same misread (and not its floor).
    if (s === 'bass' && !word && topFamily(families) === 'hiphop') trait *= HALF_FEEL_ALONE;
    if (REFINED_BY_AUDIO.has(s) && word < SUB_KEEP && SUB_GROUP[s].some((f) => ev.formed.has(f))) trait *= TRAIT_ALONE;
    const art = (artistEv?.subs[s] ?? 0) * ARTIST_SHARE;
    const v = 1 - (1 - word) * (1 - 0.85 * trait) * (1 - art);
    if (v >= SUB_KEEP) subs[s] = Math.round(v * 1000) / 1000;
  }
  if (calm !== undefined) {
    // The true ballad: calm, and (when the audio says) soft-sounding too.
    const ly = ramp(calm, LYRICAL_CALM[0], LYRICAL_CALM[1]) * (intensity !== undefined ? 1 - ramp(intensity, 0.35, 0.6) : 1);
    if (ly >= SUB_KEEP) subs.lyrical = Math.round(ly * 1000) / 1000;
  }

  const themeSet = new Set<Theme>([...themesOf(curated?.themes), ...ev.themes, ...keywordThemes(song.title)]);
  // The Western folk family on a bright song (major key, a steady unsoft beat) dances the country floor; else it stays gentle.
  if (ev.bright.size && traits && (traits.minor ?? 1) < BRIGHT_MINOR && soundsSoft !== undefined && soundsSoft < BRIGHT_SOFT && (traits.calm ?? 1) < BRIGHT_CALM) for (const t of ev.bright) themeSet.add(t);
  const themes = THEMES.filter((t) => themeSet.has(t));
  // A theme only a trailing name says (or the store's tag beside a list) is a flavour of the song, not its tradition.
  const curatedThemes = new Set<Theme>([...themesOf(curated?.themes), ...keywordThemes(song.title), ...(ev.bright.size ? [...ev.bright].filter((t) => themeSet.has(t)) : [])]);
  const themeW: Partial<Record<Theme, number>> = {};
  for (const t of themes) {
    if (curatedThemes.has(t)) continue;
    const w = ramp(ev.themeRel.get(t) ?? 1, THEME_FADE[0], THEME_FADE[1]);
    if (w < 1) themeW[t] = Math.round(w * 1000) / 1000;
  }

  let focus = normFocus(curated?.focus) ?? normFocus(ev.focus);
  if (!focus && themeSet.has('hips')) focus = { hips: 1.3 };

  const signature = Array.isArray(curated?.signature) ? curated.signature.filter((s): s is string => typeof s === 'string') : songSignature(song.title, song.artist);

  const out: SongStyle = { families: ordered(families), themes, source };
  if (Object.keys(themeW).length) out.themeW = themeW;
  if (focus) out.focus = focus;
  if (signature && signature.length) out.signature = [...signature];
  if (Object.keys(subs).length) out.subs = subs;
  if (calm !== undefined) out.calm = Math.round(calm * 1000) / 1000;
  if (ev.name && subs.bass !== undefined) out.subName = ev.name;
  if (ev.label) out.label = ev.label;
  if (ev.calm !== null) out.nameCalm = Math.round(ev.calm * 1000) / 1000;
  if (ev.labelSpecific) out.labelSpecific = true;
  if (still) out.still = true;
  if (soft !== undefined) out.soft = Math.round(soft * 1000) / 1000;
  if (hard !== undefined) out.hard = Math.round(hard * 1000) / 1000;
  if (intensity !== undefined) out.intensity = Math.round(clamp(intensity) * 1000) / 1000;
  if (traits?.drive !== undefined && Number.isFinite(traits.drive)) out.drive = Math.round(clamp(traits.drive) * 1000) / 1000;
  if (ev.bpm) out.bpm = ev.bpm;
  if (ev.scene) out.scene = ev.scene;
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
  salsa: null, merengue: null, cumbia: null, bachata: null, chacha: null, flamenco: null, tango: null, mexican: null,
  gospel: null, dangdut: null, schlager: null,
};

/** A family as a music style name: "Dance", not "Aerobics" (families say how a song is danced, the label what it is). */
const MUSIC_LABEL: Readonly<Record<Family, string>> = { ...FAMILY_LABEL, aerobic: 'Dance', latin: 'Latin' };

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

/** Label of a song nothing is known about (no genre, no audio): it gets a balanced mix of styles. */
export const UNKNOWN_LABEL = 'Mixed styles';

/**
 * Human label of the MUSIC, in ordinary words: the song's genre name when it
 * has one ("Eurodance", "Blues", "K-pop", "Classical", "Nu metal"), with a
 * sub-style the name doesn't say ("Hip-hop · Drill") or " · Ballad" for a
 * calm song (never on music that isn't dance music); without genre names the
 * tradition or the families ("Disco · Funk", "Rock", "Dance": never
 * "Aerobics"); "Ballad" for a calm song known only by its audio, "Mixed
 * styles" when nothing is known.
 */
export function styleLabel(s: SongStyle): string {
  const top = topFamilies(s);
  // A flavour theme (themeW) doesn't name the song.
  const tradition = THEME_HEAD.find(([t]) => s.themes.includes(t) && (s.themeW?.[t] ?? 1) >= THEME_LEAD)?.[1];
  const fams = top.length ? top.map((f) => MUSIC_LABEL[f]).join(' · ') : null;
  if (s.still && s.label) return s.label;
  if (s.calm !== undefined && s.calm >= BALLAD_CALM) {
    const head = s.label ?? tradition ?? (s.source === 'override' || s.source === 'genre' ? (top.length ? MUSIC_LABEL[top[0]] : null) : null);
    if (!head) return 'Ballad';
    // A calm genre (smooth jazz, downtempo, bossa nova) is calm by its name: no suffix for what the name says.
    if (s.label && (s.nameCalm ?? 0) >= BALLAD_CALM - 0.05) return head;
    return /ballad|lullab/i.test(head) ? head : `${head} · Ballad`;
  }
  const sub = labelSub(s);
  if (sub && !(s.label && s.labelSpecific)) {
    const name = sub === 'bass' && s.subName ? s.subName : GENRE_LABEL[sub];
    if (s.label) return s.label.toLowerCase().includes(name.toLowerCase()) ? s.label : `${s.label} · ${name}`;
    const h = SUB_HEAD[sub];
    return h ? `${h} · ${name}` : name;
  }
  if (s.label) return s.label;
  if (tradition) return tradition;
  if (s.source === 'fallback') return UNKNOWN_LABEL;
  return fams ?? UNKNOWN_LABEL;
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
