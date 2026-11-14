/**
 * The two tiers of the move library, and the genre sets. Pure TypeScript (no DOM).
 *
 *   GLOBAL moves (every move not listed below) read fine on any music: the
 *   aerobic, pop, party and groove steps, and style steps that don't need
 *   their own music. They are used on every song, where the level allows,
 *   weighted by the song's style, the tempo and the level (weights.ts).
 *
 *   GENRE-EXCLUSIVE moves (listed in GENRE_MOVES) only make sense with their
 *   music: headbangs and air guitar for rock, salsa and cumbia steps for
 *   Latin, line-dance steps for country, Lindy steps for swing ... They are
 *   only ever used on songs whose style opens that genre (songGenres), and
 *   there they are the kit's accents, 20-40 % of the danced time
 *   (generator.ts GENRE_MIN / GENRE_MAX).
 *
 * Genre groups and sub-styles. The broad groups (rock, hip-hop, Latin, afro,
 * disco & funk ...) open from the song's family weights and themes; their
 * SUB-STYLES (metal, punk, trap, drill, R&B, house, EDM, bass music,
 * reggaeton, Brazilian, amapiano, the Latin dances salsa, merengue, cumbia,
 * bachata, cha-cha, flamenco, tango, regional Mexican, and the mood set
 * lyrical) open from the
 * song style's sub-style scores (songStyle.ts: genre words, audio traits,
 * tempo). A sub-style either adds to its group (a metal song dances rock and
 * metal) or replaces it (reggaeton never opens the salsa steps of Latin).
 * A sub-style set with fewer than MIN_GENRE_SET moves degrades gracefully:
 * its parent opens too, so the song still gets that group's vocabulary.
 *
 * Borrowing. A set smaller than SUB_STANDALONE usable moves makes every song
 * of its style dance the same few accents, so its slots borrow fitting moves
 * from the sets NEIGHBOURS lists (by how the styles are danced; a parent the
 * set doesn't open is its nearest neighbour): borrowShare of its slots, at
 * most half and none from SUB_STANDALONE on, only from sets the song neither
 * opens nor closes, move by move through the fit filter (generator.ts
 * borrowFit). Large sets never borrow.
 *
 * Character: the song's calm (the audio `calm` trait) closes the showpiece
 * sets as it rises (no headbangs on a ballad: rock closes above ~0.65,
 * metal and punk sooner, hula hardly ever), and opens `lyrical`.
 *
 * Move ids come from RAW below plus the id lists in genreSets/*.ts (files
 * move authors fill in without touching this one).
 *
 * Variations and ornaments of a move share its tier; a recombined variation
 * takes the genre of a layer that belongs to one (variations.ts). That is why
 * a layered move only moves set together with every move sharing its
 * genre-specific layer patterns (headbangs share the power stance with air
 * guitar, so they stay in rock; metal gets the full-body ones).
 * Signature nods (songStyle.ts SONG_SIGNATURES) are separate: they open the
 * chorus of their own song, whatever tier their moves are in.
 */

import { FAMILIES, type Family, type Theme } from './families';
import { moves as electronicSets } from './genreSets/electronic';
import { moves as moodSets } from './genreSets/mood';
import { moves as urbanSets } from './genreSets/urban';
import { moves as varietySets } from './genreSets/variety';

export type Genre =
  | 'rock' | 'hiphop' | 'latin' | 'discofunk' | 'kpop'
  | 'country' | 'swing' | 'afro' | 'caribbean' | 'southasian'
  | 'folk' | 'bellydance' | 'hula' | 'capoeira'
  // Sub-styles (songStyle.ts scores them) and the mood set.
  | 'metal' | 'punk' | 'trap' | 'drill' | 'rnb' | 'house' | 'edm' | 'bass'
  | 'reggaeton' | 'brazil' | 'amapiano' | 'lyrical'
  // The Latin dances (songStyle.ts scores them from genre names).
  | 'salsa' | 'merengue' | 'cumbia' | 'bachata' | 'chacha' | 'flamenco' | 'tango' | 'mexican'
  // Added in the genre survey (Nov 2026, tools/eval/data/genre-dance-survey.md).
  | 'gospel' | 'dangdut' | 'schlager';

export const GENRES: readonly Genre[] = [
  'rock', 'hiphop', 'latin', 'discofunk', 'kpop', 'country', 'swing', 'afro', 'caribbean', 'southasian', 'folk', 'bellydance', 'hula', 'capoeira',
  'metal', 'punk', 'trap', 'drill', 'rnb', 'house', 'edm', 'bass', 'reggaeton', 'brazil', 'amapiano', 'lyrical',
  'salsa', 'merengue', 'cumbia', 'bachata', 'chacha', 'flamenco', 'tango', 'mexican',
  'gospel', 'dangdut', 'schlager',
];

/** The sub-style genres: opened by a song style's sub-style scores (SongStyle.subs), not by families or themes. */
export type SubStyle =
  | 'metal' | 'punk' | 'trap' | 'drill' | 'rnb' | 'house' | 'edm' | 'bass' | 'reggaeton' | 'brazil' | 'amapiano' | 'lyrical'
  | 'salsa' | 'merengue' | 'cumbia' | 'bachata' | 'chacha' | 'flamenco' | 'tango' | 'mexican'
  | 'gospel' | 'dangdut' | 'schlager';
export const SUB_STYLES: readonly SubStyle[] = [
  'metal', 'punk', 'trap', 'drill', 'rnb', 'house', 'edm', 'bass', 'reggaeton', 'brazil', 'amapiano', 'lyrical',
  'salsa', 'merengue', 'cumbia', 'bachata', 'chacha', 'flamenco', 'tango', 'mexican',
  'gospel', 'dangdut', 'schlager',
];
/** The Latin dances among the sub-styles: a song's leading one favours the moves named for it (generator.ts danceOf). */
export const LATIN_DANCES: readonly SubStyle[] = ['salsa', 'merengue', 'cumbia', 'bachata', 'chacha', 'flamenco', 'tango', 'mexican'];

export function isSubStyle(v: unknown): v is SubStyle {
  return typeof v === 'string' && (SUB_STYLES as readonly string[]).includes(v);
}

export const GENRE_LABEL: Readonly<Record<Genre, string>> = {
  rock: 'Rock',
  hiphop: 'Hip-hop',
  latin: 'Latin',
  discofunk: 'Disco & funk',
  kpop: 'K-pop',
  country: 'Country',
  swing: 'Swing & rock-and-roll',
  afro: 'Afrobeats',
  caribbean: 'Dancehall, reggae & soca',
  southasian: 'Bollywood, bhangra & garba',
  folk: 'Folk',
  bellydance: 'Belly dance',
  hula: 'Hula & Polynesian',
  capoeira: 'Capoeira',
  metal: 'Metal',
  punk: 'Punk',
  trap: 'Trap',
  drill: 'Drill',
  rnb: 'R&B',
  house: 'House',
  edm: 'EDM',
  bass: 'Bass music',
  reggaeton: 'Reggaeton',
  brazil: 'Brazilian',
  amapiano: 'Amapiano',
  lyrical: 'Lyrical',
  salsa: 'Salsa & mambo',
  merengue: 'Merengue',
  cumbia: 'Cumbia',
  bachata: 'Bachata',
  chacha: 'Cha-cha & ballroom Latin',
  flamenco: 'Flamenco & paso doble',
  tango: 'Tango',
  mexican: 'Regional Mexican',
  gospel: 'Gospel & praise',
  dangdut: 'Dangdut & Southeast Asian pop',
  schlager: 'Schlager & Oktoberfest',
};

export function isGenre(v: unknown): v is Genre {
  return typeof v === 'string' && (GENRES as readonly string[]).includes(v);
}

/** How a sub-style relates to its group. */
export interface SubInfo {
  /** The group set it falls back to (opened too when its own set is small); null = global moves only. */
  parent: Genre | null;
  /** Opens its parent as well (a metal song dances rock and metal); a parent it replaces stays open then. */
  withParent: boolean;
  /** Closes this set (unless it is the parent it keeps or falls back to): reggaeton is not salsa. */
  replaces: Genre | null;
}

/**
 * Own moves a genre set needs before it carries its songs' genre time alone.
 * A Medium / Hard routine uses about 3-4 genre moves (its accent kit), so two
 * songs of a set of S moves share about 16 / S of them: from 16 moves on, two
 * songs of the style share about one accent at most. Below that the whole
 * style looks alike song to song (measured, 20 songs per set, Nov 2026:
 * Brazilian alone, 9 moves, has 9 genre moves in all and its top move takes
 * 23 % of the genre time on Medium, 58 % on Easy; with Latin open too, 32
 * moves and 12 %, with the Brazilian set still 14 % of the danced time).
 * A smaller set's accent slots borrow fitting moves from its NEIGHBOURS
 * (borrowShare: none from SUB_STANDALONE usable moves on).
 */
export const SUB_STANDALONE = 16;

/**
 * withParent = the sub-style ADDS to its group by design (a metal song is
 * still a rock song, a drill song a hip-hop song): the parent opens whatever
 * the set's size. The other sub-styles with a parent (house, reggaeton,
 * Brazilian, amapiano) don't open it: their parent is their nearest
 * NEIGHBOUR and lends them its fitting moves while their own set is small
 * (one rule for every thin set, fading out at SUB_STANDALONE). Only a set
 * below MIN_GENRE_SET, too small to be a vocabulary at all, opens its parent
 * outright (set sizes Nov 2026 in brackets).
 */
export const SUB_INFO: Readonly<Record<SubStyle, SubInfo>> = {
  // Add to their group by design (a metal song is still a rock song).
  metal: { parent: 'rock', withParent: true, replaces: null }, // [9]
  punk: { parent: 'rock', withParent: true, replaces: null }, // [9]
  trap: { parent: 'hiphop', withParent: true, replaces: null }, // [11]
  drill: { parent: 'hiphop', withParent: true, replaces: null }, // [8]
  // No parent: a song whose families lead funk / hip-hop opens those itself (a "Billie Jean" must not
  // open the hip-hop party dances through its R&B). Borrows from its neighbours. [5]
  rnb: { parent: null, withParent: false, replaces: null },
  // House grew out of disco: disco & funk lends to it (and the families usually open it anyway). [9]
  house: { parent: 'discofunk', withParent: false, replaces: null },
  // EDM and bass music have no group: they borrow from each other, house and trap. [7] [8]
  edm: { parent: null, withParent: false, replaces: null },
  bass: { parent: null, withParent: false, replaces: null },
  // Reggaeton grew out of dancehall (the Caribbean set lends to it), and never opens Latin's salsa / merengue. [5]
  reggaeton: { parent: 'caribbean', withParent: false, replaces: 'latin' },
  // Replaces Latin, which still lends its fitting moves (the layered samba steps live there for the variation pool). [9]
  brazil: { parent: 'latin', withParent: false, replaces: 'latin' },
  amapiano: { parent: 'afro', withParent: false, replaces: null }, // [7] afrobeats lends to it
  lyrical: { parent: null, withParent: false, replaces: null },
  // The Latin dances. Latin (the parent set) keeps what can't be split off for the variation pool:
  // merengue, cha-cha and mambo share layers through named recombinations (Merengue Side Cha-Cha Arm,
  // Merengue Side Mambo Arms), so a merengue, cha-cha or mambo song dances the Latin set, its own
  // dance's moves favoured by their names (generator.ts NAMED_DANCE). Salsa, cumbia and bachata lean
  // on Latin (a salsa song's families open it; the small sets open it outright); flamenco, tango and
  // regional Mexican are other floors altogether and close it.
  salsa: { parent: 'latin', withParent: false, replaces: null }, // [6] salsa steps; mambo / cha-cha from Latin
  merengue: { parent: 'latin', withParent: false, replaces: null }, // [0] its steps are Latin's
  cumbia: { parent: 'latin', withParent: false, replaces: null }, // [4]
  bachata: { parent: 'latin', withParent: false, replaces: null }, // [2]
  chacha: { parent: 'latin', withParent: false, replaces: null }, // [0] cha-cha, chasses, cucaracha are Latin's
  flamenco: { parent: null, withParent: false, replaces: 'latin' }, // [4] flamenco and paso doble
  tango: { parent: null, withParent: false, replaces: 'latin' }, // [1]
  mexican: { parent: null, withParent: false, replaces: 'latin' }, // [2] folklorico, hat dance
  // Gospel and praise (families/gospel.ts): the choir step and claps, raised-hand praise, the praise-break
  // shout, step-team stomps. No group of its own (its families are pop / soul); borrows soul and R&B grooves. [11]
  gospel: { parent: null, withParent: false, replaces: null },
  // Dangdut / koplo and luk thung (families/world3.ts): joget sway, goyang. No group; borrows belly dance and Bollywood. [4]
  dangdut: { parent: null, withParent: false, replaces: null },
  // Party Schlager / Oktoberfest (families/world3.ts): schunkeln, the toast, bird-dance figures; folk lends the polka. [4]
  schlager: { parent: null, withParent: false, replaces: null },
};

// ---------------------------------------------------------------------------
// Neighbours: what a thin set borrows

/** A set a thin genre set may borrow from: how close the two DANCE (0..1); `slow`: only on a calm song. */
export interface Neighbour {
  from: Genre;
  w: number;
  slow?: boolean;
}

/**
 * Who lends to whom, by how the styles are danced (not by music history),
 * one-directional, nearest first (a parent first). A song only borrows from
 * a neighbour it doesn't open itself (open sets are its own vocabulary) and
 * never from one it closes (calm-closed; replaced, unless it is the
 * borrower's parent, which then lends only the moves named for the
 * borrower: Brazilian takes Latin's samba steps, never its salsa or paso
 * doble). Each borrowed move must fit (generator.ts borrowFit);
 * a neighbour below BORROW_CLOSE lends no showpieces (signature party dances,
 * moves named for their own style) and only moves that suit the song's
 * families as well as the borrower's own.
 *
 *   rnb       soul / funk grooves (R&B is soul's continuation: camel walk,
 *             boogaloo, four corners; the families keep the disco points out),
 *             and on a calm song the lyrical set (slow jams' waves and
 *             reaches). Not the hip-hop SET: R&B does share hip-hop's smooth
 *             grooves, but those are global moves already; the set is the
 *             named party dances (dougie, cabbage patch, the wop), exactly
 *             what a "Billie Jean" must not get through its R&B (measured:
 *             with R&B grown to 11 moves the cabbage patch fit its range).
 *             Not swing / jazz: Lindy and Charleston are kicked, bouncy,
 *             partner-born steps, nothing like R&B's isolations, whatever
 *             the shared history; not dancehall / reggaeton (their wine and
 *             perreo name their scenes) nor trap (its party dances).
 *   house     disco & funk (its parent: the hustle and roller footwork lives
 *             on in jacking), EDM (same four-on-the-floor floor, louder).
 *   edm       house (big room / electro / progressive house ARE house: the
 *             shuffle, jacking), bass music (dubstep drops at the same
 *             festivals). Not disco & funk: four-on-the-floor, but its moves
 *             (hustle, the pony, the jerk) are a different era's floor.
 *   bass      trap (the same half-time bounce on heavy 808 / sub), EDM (the
 *             festival crossover), drill (sliding-bass half-time bounce).
 *   trap      drill, bass music (the half-time bounce); hip-hop is open already.
 *   drill     trap (half-time bounce, arm swings); hip-hop is open already.
 *   reggaeton dancehall (dembow came from it; its parent), Brazilian (funk
 *             carioca's hip-led grind). Never Latin (it replaces it).
 *   brazil    Latin (its parent: the samba steps; salsa and merengue are kept
 *             out as moves named for their own style), reggaeton (perreo is
 *             close to funk carioca's rebolar).
 *   amapiano  afrobeats (its parent). Not house: the music descends from it,
 *             but the vosho and knee drops are danced nothing like jacking.
 *   metal     punk (the shared pit: circle pit, slam, two-step); rock is open.
 *   punk      metal (the shared pit); rock is open.
 *   salsa     Latin (its parent: mambo and cha-cha are salsa's Cuban roots, danced
 *             on the same floor; usually open already by the families), cumbia
 *             (the other big tropical floor, a side-to-side step).
 *   bachata,  Latin (their parent, opened outright while their sets are this
 *   cumbia    small); cumbia also regional Mexican (cumbia is danced to banda
 *             and norteño too).
 *   merengue, Latin (their steps live there).
 *   chacha
 *   flamenco  tango (the dramatic, held Spanish / Argentine lines).
 *   tango     flamenco (the same), and on a calm song lyrical (held balances,
 *             slow lunges: tango's control).
 *   mexican   cumbia (danced to the same bands), folk (norteño is polka-born:
 *             the polka and heel-toe steps), country (zapateado and the
 *             two-step floor of Tejano: heel-and-toe, boot scoot).
 *   gospel    R&B (contemporary gospel and R&B share singers, grooves and the
 *             smooth two-step), soul / funk (Motown grew out of the church: the
 *             camel walk and boogaloo of a soul-gospel floor; the families keep
 *             the disco points out), and on a calm song lyrical (a worship
 *             ballad's reaches and slow turns, as liturgical praise dance does).
 *   dangdut   belly dance (dangdut grew out of Arabic and Indian film music:
 *             the hip accents and the soft arms), Bollywood (the film-song
 *             hand gestures and sways).
 *   schlager  folk (the polka, the Schuhplattler, the hora: the Oktoberfest
 *             floor), country (line-dance steps, danced to Schlager too).
 * Lyrical lends but never borrows; the big groups and traditions don't
 * borrow (the small traditions have no style close enough to lend).
 */
export const NEIGHBOURS: Readonly<Partial<Record<Genre, readonly Neighbour[]>>> = {
  rnb: [{ from: 'discofunk', w: 0.7 }, { from: 'lyrical', w: 0.5, slow: true }],
  house: [{ from: 'discofunk', w: 1 }, { from: 'edm', w: 0.6 }],
  edm: [{ from: 'house', w: 0.8 }, { from: 'bass', w: 0.4 }],
  bass: [{ from: 'trap', w: 0.6 }, { from: 'edm', w: 0.5 }, { from: 'drill', w: 0.4 }],
  trap: [{ from: 'drill', w: 0.6 }, { from: 'bass', w: 0.5 }],
  drill: [{ from: 'trap', w: 0.6 }],
  reggaeton: [{ from: 'caribbean', w: 0.9 }, { from: 'brazil', w: 0.4 }],
  brazil: [{ from: 'latin', w: 0.7 }, { from: 'reggaeton', w: 0.4 }],
  amapiano: [{ from: 'afro', w: 0.9 }],
  metal: [{ from: 'punk', w: 0.6 }],
  punk: [{ from: 'metal', w: 0.6 }],
  salsa: [{ from: 'latin', w: 0.9 }, { from: 'cumbia', w: 0.4 }],
  bachata: [{ from: 'latin', w: 0.8 }],
  cumbia: [{ from: 'latin', w: 0.8 }, { from: 'mexican', w: 0.5 }],
  merengue: [{ from: 'latin', w: 1 }],
  chacha: [{ from: 'latin', w: 1 }],
  flamenco: [{ from: 'tango', w: 0.5 }],
  tango: [{ from: 'flamenco', w: 0.5 }, { from: 'lyrical', w: 0.4, slow: true }],
  mexican: [{ from: 'cumbia', w: 0.7 }, { from: 'folk', w: 0.45 }, { from: 'country', w: 0.4 }],
  gospel: [{ from: 'rnb', w: 0.6 }, { from: 'discofunk', w: 0.5 }, { from: 'lyrical', w: 0.6, slow: true }],
  dangdut: [{ from: 'bellydance', w: 0.6 }, { from: 'southasian', w: 0.5 }],
  schlager: [{ from: 'folk', w: 0.7 }, { from: 'country', w: 0.3 }],
};

/** Calm from which a `slow` neighbour lends (where the lyrical score starts, songStyle.ts). */
export const SLOW_CALM = 0.55;
/** Neighbours at least this close lend any fitting move (showpieces and other families included). */
export const BORROW_CLOSE = 0.75;
/** Most of a thin set's accent time that may be borrowed (at most half: the song's own moves stay in front). */
export const BORROW_MAX = 0.5;

/**
 * Share of a thin set's accent slots that borrow, from the number of its own
 * moves the song can dance (at its level and tempo): BORROW_MAX while the set
 * is barely a vocabulary (MIN_GENRE_SET), falling linearly to none at
 * SUB_STANDALONE, so a growing set needs no retuning.
 */
export function borrowShare(own: number): number {
  if (!(own > 0)) return 0;
  return BORROW_MAX * Math.min(1, Math.max(0, (SUB_STANDALONE - own) / (SUB_STANDALONE - MIN_GENRE_SET)));
}

/** How a lendable set lends to a borrower on a song: its closeness, and whether it lends only moves named for the borrower. */
export interface Lend {
  w: number;
  /** A set the song replaced, lending to the sub-style it is the parent of: only moves named for that sub-style. */
  namedOnly: boolean;
}

/**
 * The sets each open genre of a song may borrow from, with their closeness
 * (the neighbour's weight x how open the song's calm leaves it): neighbours
 * the song doesn't open, minus the sets it closes (calm-closed, or replaced
 * by an open sub-style unless that set is the borrower's parent, which then
 * lends `namedOnly`); `slow` neighbours only on a calm song (calm >=
 * SLOW_CALM).
 */
export function borrowSources(style: GenreSource): Map<Genre, Map<Genre, Lend>> {
  const { out: open, replaced } = resolveOpenness(style);
  const res = new Map<Genre, Map<Genre, Lend>>();
  for (const h of open.keys()) {
    const list = NEIGHBOURS[h];
    if (!list) continue;
    const parent = isSubStyle(h) ? SUB_INFO[h].parent : null;
    const m = new Map<Genre, Lend>();
    for (const nb of list) {
      if (open.has(nb.from) || (replaced.has(nb.from) && nb.from !== parent)) continue;
      if (nb.slow && !((style.calm ?? 0) >= SLOW_CALM)) continue;
      const k = calmGate(nb.from, gateCalm(style));
      if (k < CALM_CLOSED) continue;
      m.set(nb.from, { w: nb.w * k, namedOnly: replaced.has(nb.from) });
    }
    if (m.size) res.set(h, m);
  }
  return res;
}

/**
 * Calm tolerance of each set: its openness falls from 1 at calm <= tol to 0
 * at calm >= tol + 0.3 (closed below CALM_CLOSED, i.e. above about tol +
 * 0.21). Showpiece sets (headbangs, pogo, krump, drops) close first; gentle
 * traditions last: rock closes above calm ~0.66, metal and punk above ~0.56.
 */
export const CALM_TOLERANCE: Readonly<Record<Genre, number>> = {
  rock: 0.45, metal: 0.35, punk: 0.35, hiphop: 0.55, trap: 0.5, drill: 0.45, rnb: 0.8,
  house: 0.55, edm: 0.45, bass: 0.45, discofunk: 0.55, kpop: 0.6, latin: 0.65, reggaeton: 0.55, brazil: 0.55,
  country: 0.6, swing: 0.65, afro: 0.6, amapiano: 0.65, caribbean: 0.65, southasian: 0.65, folk: 0.6,
  bellydance: 0.75, hula: 0.9, capoeira: 0.45, lyrical: 2,
  salsa: 0.6, merengue: 0.6, cumbia: 0.65, bachata: 0.75, chacha: 0.65, flamenco: 0.55, tango: 0.65, mexican: 0.6,
  gospel: 0.75, dangdut: 0.65, schlager: 0.6,
};
/** Openness below which the calm closes a set. */
export const CALM_CLOSED = 0.3;

/**
 * The calm a song's sets are gated at: its calm, or more for a soft-but-steady
 * song (GenreSource.soft): a soft song closes the showpiece sets (no headbangs
 * or fist-pumping drops on a gentle groove: rock, metal, punk, EDM close from
 * soft ~0.9) without opening lyrical (which only the calm itself opens).
 */
export function gateCalm(style: { calm?: number; soft?: number }): number | undefined {
  const c = style.calm;
  const s = style.soft;
  if (s === undefined || !Number.isFinite(s)) return c;
  const sc = SOFT_GATE[0] + SOFT_GATE[1] * Math.min(1, Math.max(0, s));
  return c === undefined || !Number.isFinite(c) ? sc : Math.max(c, sc);
}
/** Gate calm of a song of softness s: SOFT_GATE[0] + SOFT_GATE[1] x s. */
export const SOFT_GATE: readonly [number, number] = [0.3, 0.4];

/** How open a set stays at a song's calm (1 = fully, 0 = closed); calm unknown = 1. */
export function calmGate(g: Genre, calm: number | undefined): number {
  if (calm === undefined || !Number.isFinite(calm)) return 1;
  const tol = CALM_TOLERANCE[g];
  return Math.min(1, Math.max(0, (tol + 0.3 - calm) / 0.3));
}

/** Genres a song theme opens (themes come from curated styles, genre words and title words). */
export const THEME_GENRES: Readonly<Partial<Record<Theme, Genre>>> = {
  country: 'country',
  swing: 'swing',
  afro: 'afro',
  amapiano: 'amapiano',
  dancehall: 'caribbean',
  reggae: 'caribbean',
  soca: 'caribbean',
  bollywood: 'southasian',
  bhangra: 'southasian',
  garba: 'southasian',
  folk: 'folk',
  bellydance: 'bellydance',
  hula: 'hula',
  capoeira: 'capoeira',
};

/** Genres a style family opens (disco and funk share one set). */
export const FAMILY_GENRE: Readonly<Partial<Record<Family, Genre>>> = {
  rock: 'rock',
  hiphop: 'hiphop',
  latin: 'latin',
  disco: 'discofunk',
  funk: 'discofunk',
  kpop: 'kpop',
};

/** A family genre opens when its family weighs at least this share of the song's strongest family ... */
export const FAMILY_OPEN_SHARE = 0.65;
/** A sub-style opens at this score (SongStyle.subs, 0..1) ... */
export const SUB_OPEN = 0.5;
/** ... and a sub-style set with fewer moves than this also opens its parent. */
export const MIN_GENRE_SET = 6;
/**
 * Themes whose genre styles use the latin family as a stand-in for hip-led
 * grooves: they never open the Latin set (no salsa on afrobeats).
 */
const LATIN_PROXY_THEMES: readonly Theme[] = ['afro', 'amapiano', 'dancehall', 'reggae', 'soca'];

/** The parts of a song style that decide its genres. */
export interface GenreSource {
  families: Partial<Record<Family, number>>;
  themes: readonly Theme[];
  /** Sub-style scores 0..1 (songStyle.ts). */
  subs?: Partial<Record<SubStyle, number>>;
  /** The song's calm 0..1 (undefined = unknown: nothing closes). */
  calm?: number;
  /** Soft-but-steady character 0..1 (songStyle.ts): closes showpiece sets like calm does (gateCalm), never opens lyrical. */
  soft?: number;
}

/**
 * How strongly a song's style opens each genre (0..1; absent = closed):
 *   - the genre of each style theme (fully);
 *   - each family genre whose family weighs at least FAMILY_OPEN_SHARE of
 *     the strongest family (only the strongest one itself when a theme
 *     already names a tradition, so a country song isn't also "rock"), by
 *     its share;
 *   - each sub-style scoring at least SUB_OPEN, by its score; with its
 *     parent when it adds to it or when its own set is below MIN_GENRE_SET,
 *     closing the set it replaces;
 *   - then the calm closes what it closes (calmGate).
 * (A thin set's neighbours don't open: they lend fitting moves, borrowSources.)
 */
export function genreOpenness(style: GenreSource): Map<Genre, number> {
  return resolveOpenness(style).out;
}

/** genreOpenness, plus the sets the song's sub-styles replaced (closed). */
function resolveOpenness(style: GenreSource): { out: Map<Genre, number>; replaced: Set<Genre> } {
  const out = new Map<Genre, number>();
  const open = (g: Genre, w: number) => out.set(g, Math.max(out.get(g) ?? 0, w));
  for (const t of style.themes) {
    const g = THEME_GENRES[t];
    if (g) open(g, 1);
  }
  const themed = out.size > 0;
  let max = 0;
  for (const f of FAMILIES) max = Math.max(max, style.families[f] ?? 0);
  const proxy = style.themes.some((t) => LATIN_PROXY_THEMES.includes(t));
  if (max > 0) {
    const fw = new Map<Genre, number>();
    for (const f of FAMILIES) {
      const g = FAMILY_GENRE[f];
      if (g) fw.set(g, Math.max(fw.get(g) ?? 0, style.families[f] ?? 0));
    }
    for (const [g, w] of fw) {
      if (w <= 0) continue;
      if (g === 'latin' && proxy) continue;
      if (themed ? w >= max - 1e-9 : w >= FAMILY_OPEN_SHARE * max - 1e-9) open(g, w / max);
    }
  }
  for (const s of SUB_STYLES) {
    const v = style.subs?.[s];
    if (typeof v === 'number' && v >= SUB_OPEN) open(s, Math.min(1, v));
  }
  // Sub-styles (however they opened): their parents, and the sets they replace.
  const closes = new Set<Genre>();
  for (const s of SUB_STYLES) {
    const w = out.get(s);
    if (w === undefined) continue;
    const info = SUB_INFO[s];
    const small = GENRE_MOVES[s].length < MIN_GENRE_SET;
    if (info.parent && (info.withParent || small)) open(info.parent, w);
    // A replacing sub-style never opens the set it replaces (unless that is the fallback it needs or keeps).
    if (info.replaces && !((small || info.withParent) && info.parent === info.replaces)) closes.add(info.replaces);
  }
  const replaced = new Set<Genre>();
  for (const g of closes) {
    if (style.themes.some((t) => THEME_GENRES[t] === g)) continue;
    out.delete(g);
    replaced.add(g);
  }
  const gc = gateCalm(style);
  for (const [g, w] of out) {
    const k = w * calmGate(g, gc);
    if (k < CALM_CLOSED * w || k <= 0) out.delete(g);
    else out.set(g, k);
  }
  return { out, replaced };
}

/** The genres a song's style opens (genreOpenness). */
export function songGenres(style: GenreSource): ReadonlySet<Genre> {
  return new Set(genreOpenness(style).keys());
}

// ---------------------------------------------------------------------------
// The genre sets (move ids). Everything else is global. genreSets/*.ts add to them.

const RAW: Readonly<Record<Genre, string>> = {
  rock: `
    headbang headbang-arms-up side-headbang headbang-fist
    pogo pogo-fist shoulder-barge
    air-guitar power-lunge guitar-neck-raise windmill power-windmill strum-kick guitar-spin guitar-solo duck-walk rock-star-jump
    air-bass air-drums tom-roll cymbal-crash
    mic-grab mic-stand-tilt monitor-foot
    // named: recombinations promoted in families/named.ts
    heel-toe-bass-slap jump-around-v-pump knee-lift-fist-bang swaying-drummer slow-sway-fist-bang march-bass-slap
    march-v-pump march-windmill pogo-beat-clap pogo-arena-wave pogo-drums pogo-fist-bang pogo-windmill
    barge-v-pump stomp-kick-bass-slap stomp-kick-windmill snap-kick-v-pump step-touch-windmill
    sumo-squat-bass-slap sumo-squat-v-pump`,
  hiphop: `
    dougie milly-rock cat-daddy harlem-shake stanky-leg tootsie-roll
    jersey-club-kick jerkin bankhead-bounce swag-surf walk-it-out lean-and-snap brush-off steve-martin
    krump-stomp krump-arm-swing krump-chest-pop toprock-step-out indian-step
    cabbage-patch the-reebok bart-simpson hammer-dance roger-rabbit kick-step skeeter-rabbit butterfly-knees tut-box
    the-wop the-smurf smurf-two-step bernie lean-back toprock-cross-step toprock-kick-step humpty-hop
    // named: recombinations promoted in families/named.ts
    booty-shake-dougie-arms jump-around-dougie-arms jump-around-bankhead-arms side-out-bankhead-arms
    swag-walk-cabbage-patch swag-walk-bankhead-arms`,
  // Latin: the social-floor basics that share layers (merengue, cha-cha and mambo are tied by named
  // recombinations) and the percussion moves. Each other Latin dance has its own set (the Andean huayno is folk).
  latin: `
    merengue merengue-clap merengue-turn merengue-side
    mambo-rock
    cha-cha cha-cha-chasse cha-cha-spot-turn cucaracha
    maraca-shake
    // named: recombinations promoted in families/named.ts
    box-step-mambo-arms box-step-maracas cha-cha-chasse-cha-cha-arm cha-cha-chasse-fan
    cha-cha-chasse-flow cha-cha-chasse-shimmy conga-maracas cucaracha-snake-arms merengue-side-cha-cha-arm
    merengue-side-fan merengue-side-mambo-arms
    step-touch-maracas`,
  discofunk: `
    disco-point double-disco-point kick-point fever-pose disco-vine disco-dip disco-spin bump-point hip-swing-point
    hustle-tap hustle-basic hustle-turn hitch-turn roll-the-dice roller-glide roller-crossover roller-swizzle
    hitchhike the-monkey the-jerk the-pony the-watusi mashed-potato the-freddie philly-dog batusi the-fly
    funky-chicken camel-walk good-foot popcorn jb-slide which-a-way boogaloo four-corners bump-slide funky-guitar
    the-lock lock-drop scoobot uncle-sam-point wrist-twirl muscle-man give-yourself-five
    fresno tick-arm dime-stop king-tut
    // named: recombinations promoted in families/named.ts
    back-tap-disco-point jazz-walk-disco-point jazz-walk-wings kickline-disco-point pas-de-bourree-disco-point
    shake-down-disco-point step-touch-disco-point twist-down-wings`,
  kpop: `
    big-heart cheek-tap-sway bunny-ears shy-shoulders cute-clasp-sway cat-paws peace-eyes
    salute-flick twin-point clock-arms pump-pump-open fan-chant-clap rain-down wiper-hands freeze-hit lunge-line
    point-step toe-tap-point
    // named: recombinations promoted in families/named.ts
    box-step-aegyo-clasp box-step-wipers chasse-pump-and-open cross-travel-cat-paws cross-travel-cheek-taps
    cross-travel-clock-arms cross-travel-fan-chant cross-travel-shy-shoulders cross-travel-wipers
    heel-toe-aegyo-clasp jazz-walk-big-heart jazz-walk-aegyo-clasp jazz-walk-wipers side-lunge-wipers
    march-pump-and-open shake-down-big-heart shake-down-aegyo-clasp slide-bunny-ears slide-cheek-taps
    slide-clock-arms slide-aegyo-clasp slide-peace-eyes slide-shy-shoulders step-touch-big-heart
    step-touch-cat-paws step-touch-wipers swag-walk-fan-chant triple-wipers twist-down-fan-chant
    twist-down-pump-and-open v-step-aegyo-clasp v-step-wipers grapevine-big-heart grapevine-pump-and-open`,
  country: `
    heel-hook heel-switches vine-hitch-clap heel-strut boot-scoot cowboy-kick scuff-hitch sailor-step monterey-turn
    clogging-basic hoedown-slap gallop gallop-lasso lasso
    // named: recombinations promoted in families/named.ts
    heel-hook-double-clap heel-hook-slap-clap heel-dig-hitch-clap heel-toe-lasso jazz-walk-lasso
    side-rock-hitch-clap slide-lasso cowboy-strut vine-hitch-one-arm-up`,
  swing: `
    charleston charleston-kick hand-jive truckin shorty-george bees-knees suzy-q
    gaze-afar tacky-annie boogie-back boogie-forward fall-off-the-log mess-around stomp-off crossover-push apple-jacks
    chicken-walk hitch-kick quickstep-kick shuffle-off-to-buffalo waltz-balance waltz-turn
    // named: recombinations promoted in families/named.ts
    box-step-suzie-q-arms charleston-kick-high-clap charleston-kick-snaps jazz-walk-hand-jive kick-cross-hand-jive
    bourree-charleston shorty-george-clap shorty-george-jazz-hands shorty-george-snaps step-touch-hand-jive
    the-twist-hand-jive triple-shorty-arms`,
  afro: `
    shaku-shaku gwara-gwara shoki azonto-twist soapy zanku afro-groove legwork-cross
    indlamu-stomp gumboot-slap spray-money ndombolo kuduro-stomp lamban-swing harvest-scoop kuku-step sabar-knee`,
  caribbean: `
    willie-bounce bogle signal-di-plane thunder-clap tek-weh-yuhself gully-creepa log-on pon-di-river wacky-dip
    reggae-skank jump-and-wave wine-and-wave palance bacchanal-jump`,
  southasian: `
    thumka light-bulb matka-step namaste-open lotus-rise heel-flick jhummar-sway kite-pull ghoomar-twirl
    s-pose-hit aaja-beckon shoulder-pop-walk screw-the-bulbs naagin-sway kathak-tatkar natta-heel-strike
    bhangra-shoulders boli-call bhangra-hop dhamaal chaffa luddi
    dandiya-strike garba-two-clap garba-three-clap
    // named: recombinations promoted in families/named.ts
    bhangra-hop-one-arm-up bhangra-hop-boli-call box-step-thumka-arm cross-travel-kite-pull
    cross-travel-light-bulb dhamaal-boli-call double-step-bhangra slide-lotus-rise step-touch-kite-pull
    swag-walk-bhangra swag-walk-light-bulb swag-walk-thumka-arm`,
  folk: `
    polka-step heel-toe-polka hora-step sirtaki-step kalinka-heel-toe schuhplattler tarantella-skip can-can-kick
    irish-threes irish-sevens irish-cut-rock highland-fling morris-step pas-de-basque
    dabke-stomp dabke-cross-hop yemenite-step horon-shimmy halay-dip lezginka-steps
    bon-odori-clap awa-odori-walk para-para-sweep fan-arc ribbon-eight taiko-strike yangge-cross-step balinese-agem
    tinikling-hops itik-itik huayno-skip`,
  bellydance: `egyptian-walk hip-drop-kick snake-arm-shimmy`,
  hula: `kaholo-wave hela-point uwehe tamau-hips poi-swing slap-dance`,
  capoeira: `ginga esquiva-dodge`,
  // Sub-styles: the existing moves that clearly belong (full-body moves, or layered ones whose
  // genre layers no other set uses); move authors add the rest in genreSets/*.ts.
  metal: `chug-squat hair-swing low-headbang`,
  punk: `side-pogo ska-skank mosh-two-step circle-pit`,
  trap: `the-whip the-shoot the-woah griddy jet-griddy nae-nae`,
  drill: `shmoney`,
  rnb: ``,
  house: `vogue-arms vogue-pose box-frame loose-legs`,
  edm: ``,
  bass: ``,
  reggaeton: ``,
  // The samba steps (their layers are their own: pool.json was regenerated when they moved from Latin).
  brazil: `
    frevo-hop
    samba-basic samba-whisk bota-fogo samba-reggae-drum samba-no-pe
    bota-fogo-drum-hits samba-whisk-carnival-arms samba-whisk-shimmy`,
  amapiano: `vosho pouncing-cat`,
  lyrical: ``,
  // The Latin dances split out of Latin (each set's layers are its own; see the header on layered moves).
  salsa: `salsa-basic salsa-back-basic side-salsa salsa-right-turn new-yorker side-salsa-flow`,
  merengue: ``,
  cumbia: `cumbia-step cumbia-machete cumbia-sau cumbia-candle`,
  bachata: `bachata-side bachata-basic`,
  chacha: ``,
  flamenco: `flamenco-arms flamenco-palmas flamenco-turn paso-doble-cape`,
  tango: `tango-walk`,
  mexican: `folklorico-skirt hat-dance-heels`,
  // Sets added in the genre survey: ids in genreSets/variety.ts.
  gospel: ``,
  dangdut: ``,
  schlager: ``,
};

/** genreSets/*.ts: id lists by genre, added after RAW's. */
const EXTRA: readonly Partial<Record<string, string>>[] = [electronicSets, urbanSets, moodSets, varietySets];

const idsOf = (s: string | undefined): string[] => (s ?? '').replace(/\/\/[^\n]*/g, ' ').split(/\s+/).filter(Boolean);

/** Move ids of each genre set (named variations included; see families/named.ts). */
export const GENRE_MOVES: Readonly<Record<Genre, readonly string[]>> = Object.fromEntries(
  GENRES.map((g) => {
    const ids = idsOf(RAW[g]);
    for (const x of EXTRA) for (const id of idsOf(x[g])) if (!ids.includes(id)) ids.push(id);
    return [g, ids];
  }),
) as unknown as Record<Genre, readonly string[]>;

/** Keys in genreSets/*.ts that name no genre (the tier test requires none). */
export const GENRE_SET_UNKNOWN: string[] = EXTRA.flatMap((x) => Object.keys(x).filter((k) => !isGenre(k)));

const BY_ID = new Map<string, Genre>();
/** Ids listed in more than one genre set (the tier test requires none). */
export const GENRE_CONFLICTS: string[] = [];
for (const g of GENRES) {
  for (const id of GENRE_MOVES[g]) {
    if (BY_ID.has(id) && BY_ID.get(id) !== g) GENRE_CONFLICTS.push(`${id}: ${BY_ID.get(id)} and ${g}`);
    else BY_ID.set(id, g);
  }
}

/** The genre a catalogue move id is exclusive to (undefined = global). */
export function genreOfId(id: string): Genre | undefined {
  return BY_ID.get(id);
}

/** Every listed id (tests check they exist). */
export function genreListedIds(): string[] {
  return [...BY_ID.keys()];
}
