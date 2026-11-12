/**
 * Choreography generator: BeatMap + intensity -> a timeline of move instances.
 *
 * Pure TypeScript (no DOM). Deterministic: seeded from the video ID and the
 * intensity, so the same song always gets the same routine.
 *
 * Structure:
 *   bars (from downbeats) -> section runs -> phrases (8 bars) -> holds
 *   (2, 4 or 8 bars on the phrase's grid) -> units (2 bars). A hold repeats
 *   ONE move (alternating sides, units returning to centre); a unit may
 *   instead play the signature combo. Every chorus / drop opens with the
 *   song's signature combo (one 8-beat sequence, shown as one move). The
 *   start warms up with a gentle move, the outro cools down. Above ~150 BPM
 *   every move is performed at half time (1 move beat = 2 song beats);
 *   phrases, holds and units double so they stay musically aligned.
 *
 * Assembly, in order (generateRoutine):
 *   1. plan the whole song: phrases, holds, and each hold's slot in the
 *      song's KIT (see "The song's kit" below: verse motif, chorus hook,
 *      power moves ...);
 *   2. choose the kit's genre accents on the planned time;
 *   3. dance it, casting each kit move on first use (soft weights + flow);
 *   4. the hard card rule (cards.ts enforceCards): no move the dancer sees
 *      lasts under a bar or 2 seconds; leftovers are parts of moves;
 *   5. no dash across the floor between moves (flow.ts smoothSteps).
 *
 * The music drives the phrasing (see "Phrasing" below): per-bar readings
 * from the beat map (energy, bass, groove change, drops; section energy for
 * older maps) decide how long each move is held (steady, loud passages and
 * drops hold longest; passages that keep changing switch sooner) and which
 * kit role a hold takes (loud verse passages build, soft ones break).
 *
 * Levels (shown to the user as Easy / Medium / Hard):
 *   chill  (Easy):   low impact (never a jump or a fast turn: the one hard
 *                    level rule), nearly all simple moves, 4-bar units (a
 *                    move lasts 4-8 bars).
 *   cardio (Medium): mostly easy / medium moves, 2-bar units.
 *   sweaty (Hard):   leans to hard, high-impact moves, shorter holds on
 *                    average, a longer verse motif and a four-move hook.
 * Difficulty, impact and tempo are soft weights (weights.ts, levelFactor):
 * they multiply with the style and energy lean, never exclude.
 *
 * Tiers (genres.ts): genre-exclusive moves are used only when the song's
 * style opens their genre, as the kit's accents (GENRE_MIN..GENRE_MAX of the
 * danced time); global moves everywhere. Signature nods open their own
 * song's chorus regardless.
 *
 * Live mode (no sections known) uses LivePlanner: the same phrase logic with
 * a repeating verse / verse / chorus phrase cycle.
 *
 * Song style (songStyle.ts) weights the kit's casting on top of section
 * energy and level: moves of the song's families, its focus and its title
 * themes are favoured, never to the point of emptying the pool. The pool is
 * the catalogue plus validated variations (pool.ts): Easy sees few (simple
 * ones), Hard the most. The seed is videoId + level + style; 'fresh'
 * routines add a play counter (a different kit), but the chorus combo
 * (signature) keeps the stable seed. Songs with a curated `signature` build
 * the chorus combo from those moves.
 */

import type { BeatMap, SectionType } from '../analysis/beatmap';
import type { Pose } from '../coach/skeleton';
import { FAMILIES } from './families';
import { FAMILY_GENRE, THEME_GENRES, songGenres, type Genre } from './genres';
import { IDLE_MOVE, MOVES, keysOf, type Level, type Move } from './moves';
import { getPool, warmPool } from './pool';
import { BALANCED_POP, styleKey, type SongStyle } from './songStyle';
import { difficultyFactor, impactFactor, moveVigour, moveWeights, poseStepCost, tempoFactor } from './weights';
import { enforceCards, partOf, pauseOf, renamed, tileMove } from './cards';
import { smoothSteps } from './flow';

export { moveVigour, moveWeights, tempoFactor } from './weights';

export type Intensity = 'chill' | 'cardio' | 'sweaty';

/** Above this tempo, moves are performed at half time. */
export const HALF_TIME_BPM = 150;

export interface MoveInstance {
  move: Move;
  mirror: boolean;
  /** First beat index (into the plan's beat grid). */
  start: number;
  /** Song beats covered (move.beats, doubled at half time). */
  span: number;
  half: boolean;
  /** Floor x origin at the start (travelling moves shift it). */
  origin: number;
  section: SectionType;
  /** Part of the signature combo. */
  sig: boolean;
  /** First instance of a unit (units start on downbeats). */
  unitStart: boolean;
  /** Phrase counter (for debugging / tests). */
  phrase: number;
  /** A short in-place move filling beats a unit's move doesn't divide (odd bars, pickups). */
  fill?: boolean;
  /**
   * Extra floor x the coach covers over this instance, spread evenly from its
   * start (0) to its end (`drift`): an unpaired travelling repeat dances in
   * place, two players walk in to a partner move and back out. The next
   * instance's origin includes it.
   */
  drift?: number;
}

export interface SigStep {
  move: Move;
  mirror: boolean;
}

export interface Routine {
  instances: MoveInstance[];
  signature: readonly SigStep[];
  half: boolean;
  /** Number of beats covered (instances partition [0, beats)). */
  beats: number;
  /** Beat times (s) of the map, when known (wall-time checks). */
  times?: readonly number[];
}

export interface Bar {
  start: number;
  len: number;
}

/** How a routine is personalised. */
export interface RoutineOpts {
  /** The song's style (default: balanced pop). */
  style?: SongStyle;
  /** 'fresh' routines: the play number mixed into the seed (chorus combo excluded). */
  fresh?: number;
  /** Use the variation pool (default true). */
  variations?: boolean;
}

/** Share of picks that may be variations, per level. */
const VARIATION_SHARE: Record<Intensity, number> = { chill: 0.06, cardio: 0.25, sweaty: 0.35 };
/** Chance a unit's last 4 beats become a phrase-end flourish (last unit of a phrase). */
const FLOURISH_P: Record<Intensity, number> = { chill: 0, cardio: 0.3, sweaty: 0.5 };

/** Style factor of a move for a song: families, focus and themes. */
export function styleFactor(m: Move, style: SongStyle): number {
  // A move's first family counts fully, its secondary tags at 60 % (so a
  // widely co-tagged family like pop doesn't swallow the mix).
  let fam = 0;
  m.families.forEach((f, i) => (fam = Math.max(fam, (style.families[f] ?? 0) * (i === 0 ? 1 : 0.6))));
  // Per move, a top-family move (weight ~0.5-1) is ~15-30x a non-matching one;
  // with every family in the pool that gives ~60-70 % of picks. Never 0.
  let w = 0.15 + 5 * fam;
  if (style.focus) {
    let fo = 1;
    for (const f of m.focus) fo = Math.max(fo, style.focus[f] ?? 1);
    w *= fo;
  }
  if (style.themes.length) {
    let n = 0;
    for (const t of m.themes) if (style.themes.includes(t)) n++;
    if (n) w *= n >= 2 ? 4 : 3;
  }
  return w;
}

// ---------------------------------------------------------------------------
// Genre sets
//
// Every move is GLOBAL or exclusive to one GENRE set (genres.ts): headbangs
// for rock, salsa steps for Latin, line-dance steps for country ... A
// genre-exclusive move is only ever used on songs whose style opens its genre
// (songGenres: the style's tradition themes, and its leading families); there
// the genre sets take about GENRE_SHARE of the fresh picks' weight, so a rock
// song feels like rock (the global rock-tagged moves are favoured by the
// style weights too) without being all headbangs. Signature nods are the one
// exception: they open their own song's chorus whatever their tier.

/** Bounds of the factor that scales a genre set to its share (a tiny set isn't hammered). */
const GENRE_SCALE_MIN = 0.5;
const GENRE_SCALE_MAX = 4;

/** The genres a song's style opens. */
export function styleGenres(style: SongStyle): ReadonlySet<Genre> {
  return songGenres(style);
}

/** Whether a move may be used on a song with these open genres (global moves always may). */
export function genreFits(m: Move, open: ReadonlySet<Genre>): boolean {
  return !m.genre || open.has(m.genre);
}

/** How strongly a song opens each of its genres (theme genres fully, family genres by family weight). */
function genreOpenness(style: SongStyle, open: ReadonlySet<Genre>): Map<Genre, number> {
  const out = new Map<Genre, number>();
  let max = 0;
  for (const f of FAMILIES) max = Math.max(max, style.families[f] ?? 0);
  for (const g of open) {
    let w = 0;
    for (const t of style.themes) if (THEME_GENRES[t] === g) w = 1;
    for (const f of FAMILIES) if (FAMILY_GENRE[f] === g && max > 0) w = Math.max(w, (style.families[f] ?? 0) / max);
    out.set(g, w || 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seeded randomness

export function hashString(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rng: () => number, items: readonly T[], weights: ArrayLike<number>): T | null {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i] > 0 ? weights[i] : 0;
  if (sum <= 0) return null;
  let r = rng() * sum;
  for (let i = 0; i < items.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (r < w) return items[i];
    r -= w;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Mix rules

type LevelWeights = Record<Level, number>;

function levelWeights(section: SectionType | 'warmup', intensity: Intensity, energy: number): LevelWeights {
  let w: LevelWeights;
  switch (section) {
    case 'warmup':
    case 'intro':
      w = { low: 1, mid: intensity === 'sweaty' ? 0.3 : 0.12, high: 0 };
      break;
    case 'verse':
      w = intensity === 'chill' ? { low: 2, mid: 1, high: 0.05 } : intensity === 'cardio' ? { low: 1, mid: 2, high: 0.55 } : { low: 0.35, mid: 2, high: 1.5 };
      break;
    case 'chorus':
      w = intensity === 'chill' ? { low: 1, mid: 2, high: 0.15 } : intensity === 'cardio' ? { low: 0.25, mid: 2, high: 1.3 } : { low: 0.05, mid: 1.3, high: 2.7 };
      break;
    case 'drop':
      w = intensity === 'chill' ? { low: 0.8, mid: 2, high: 0.25 } : intensity === 'cardio' ? { low: 0.1, mid: 1.6, high: 2 } : { low: 0, mid: 1, high: 3.3 };
      break;
    case 'outro':
    default:
      w = { low: 1, mid: 0.2, high: 0 };
  }
  const e = Math.min(1, Math.max(0, energy));
  return { low: w.low * (1.4 - 0.8 * e), mid: w.mid, high: w.high * (0.6 + 0.8 * e) };
}

/** Bars per unit (one move repeated) for a level. */
export function unitBarsFor(intensity: Intensity, half: boolean): number {
  const base = intensity === 'chill' ? 4 : 2;
  return half ? base * 2 : base;
}

/**
 * How well a move suits a level: its difficulty and impact weights
 * (weights.ts), soft everywhere, plus the one hard rule: Easy (chill) is low
 * impact, so it never jumps (and never turns fast). 0 = not allowed.
 */
export function levelFactor(m: Move, intensity: Intensity): number {
  if (intensity === 'chill' && (m.jump || m.fastTurn)) return 0;
  return difficultyFactor(m, intensity) * impactFactor(m, intensity);
}

/** Catalogue moves the generator may pick (idle and cooldown are special). */
const DANCE_MOVES = MOVES.filter((m) => !m.idle && !m.cooldown);
/** The outro draws from the stretches plus the calm flows of the cooldown file (tai chi, yoga shapes). */
const COOLDOWN_MOVES = MOVES.filter((m) => m.cooldown || (m.file === 'cooldown' && m.level === 'low' && !m.jump && !m.idle));

/** Longest display name a variation keeps (the NOW / NEXT cards fit about this much). */
export const MAX_NAME = 26;
/** Shorter forms of common variation suffixes. */
const SUFFIX_SHORT: Readonly<Record<string, string>> = { 'double time': 'double', 'half time': 'half', 'clap on 4': 'clap', 'hit on 4': 'hit', 'spin out': 'spin', 'alternating': 'alt' };
/** Style words a suffix can lose ("latin open break" -> "open break"). */
const SUFFIX_STYLE_WORDS = new Set(['latin', 'samba', 'bachata', 'salsa', 'disco', 'funk', 'funky', 'kpop', 'k-pop', 'hiphop', 'rock', 'pop', 'bhangra', 'bollywood', 'cha', 'merengue', 'cumbia', 'flamenco', 'aerobic', 'party']);

/**
 * A variation's display name within MAX_NAME characters: "Base · suffix"
 * with a shorter suffix (abbreviated, minus words the base already says or
 * style words), else the base name alone. Catalogue names are kept as written.
 */
export function shortName(name: string): string {
  if (name.length <= MAX_NAME) return name;
  const k = name.indexOf(' · ');
  if (k < 0) return name;
  const base = name.slice(0, k);
  let suf = name.slice(k + 3);
  const fits = (x: string) => base.length + 3 + x.length <= MAX_NAME && x.length > 0;
  if (SUFFIX_SHORT[suf] && fits(SUFFIX_SHORT[suf])) return `${base} · ${SUFFIX_SHORT[suf]}`;
  const baseWords = new Set(base.toLowerCase().split(/[\s-]+/));
  const words = suf.split(' ');
  const kept = words.filter((w) => !baseWords.has(w.toLowerCase()) && !SUFFIX_STYLE_WORDS.has(w.toLowerCase()));
  suf = kept.join(' ');
  if (kept.length && kept.length < words.length && fits(suf)) return `${base} · ${suf}`;
  return base;
}

const SHORT = new Map<Move, Move>();
/** `m`, or a copy with its shortened display name (cached, so identity is stable). */
function withShortName(m: Move): Move {
  if (m.name.length <= MAX_NAME || m.base === m.id) return m;
  let s = SHORT.get(m);
  if (!s) {
    s = { ...m, name: shortName(m.name) };
    SHORT.set(m, s);
  }
  return s;
}

let warmMoves: readonly Move[] | null = null;
let warmNext = 0;

/**
 * Fill the generator's caches ahead of the first routine, for about
 * `budgetMs` per call (idle time on the home screen): the variation pool,
 * then every pickable move's soft weights. Only caches that the first
 * routine would otherwise fill itself, so routines are unchanged. True when done.
 */
export function warmGenerator(budgetMs: number): boolean {
  const until = performance.now() + budgetMs;
  if (!warmPool(budgetMs)) return false;
  const moves = (warmMoves ??= [...dancePool(true).moves, ...COOLDOWN_MOVES]);
  while (warmNext < moves.length) {
    const m = moves[warmNext++];
    moveWeights(m);
    moveVigour(m);
    if ((warmNext & 15) === 0 && performance.now() >= until) break;
  }
  return warmNext >= moves.length;
}

/** Base moves + variations (variations get a per-level share). */
function dancePool(useVariations: boolean): { moves: readonly Move[]; isVar: Uint8Array } {
  const vars = useVariations ? getPool().variations.map(withShortName) : [];
  const moves = [...DANCE_MOVES, ...vars];
  const isVar = new Uint8Array(moves.length);
  for (let i = DANCE_MOVES.length; i < moves.length; i++) isVar[i] = 1;
  return { moves, isVar };
}

const PART_BIT: Readonly<Record<string, number>> = { arms: 1, legs: 2, torso: 4, hips: 8, jump: 16, turn: 32 };
const POPCOUNT = Uint8Array.from({ length: 64 }, (_, k) => (k & 1) + ((k >> 1) & 1) + ((k >> 2) & 1) + ((k >> 3) & 1) + ((k >> 4) & 1) + ((k >> 5) & 1));
/** A move's body parts as a bit mask (partsOverlap on masks: maskOverlap). */
function partsMask(m: Move): number {
  let b = 0;
  for (const p of m.parts) b |= PART_BIT[p] ?? 0;
  return b;
}
function maskOverlap(a: number, b: number): number {
  const u = POPCOUNT[a | b];
  return u ? POPCOUNT[a & b] / u : 0;
}

function partsOverlap(a: Move, b: Move): number {
  let inter = 0;
  for (const p of a.parts) if (b.parts.includes(p)) inter++;
  const union = a.parts.length + b.parts.length - inter;
  return union ? inter / union : 0;
}

/** How awkward is going from the end of `prev` into the start of `next`? */
export function transitionCost(prev: Pose, next: Pose): number {
  return poseStepCost(prev, next);
}

// ---------------------------------------------------------------------------
// Choreographer: shared unit / phrase logic for map and live planning

/** What the generator knows about one bar of the music. */
export interface BarFeel {
  /** 0..1 intensity, relative within the song. */
  energy: number;
  /** 0..1 bass level, relative within the song. */
  bass: number;
  /** 0..1 how new the bar's groove is (0 = a repeat of the last bars). */
  change: number;
  /** A drop starts on this bar. */
  drop: boolean;
}

/** Groove change assumed when a map has no bar readings (moderately steady). */
export const DEFAULT_CHANGE = 0.4;

export interface PhraseOpts {
  section: SectionType;
  energy: number;
  /** Low-intensity warm-up phrase. */
  warmup?: boolean;
  /** First phrase of a chorus/drop: open with the signature combo. */
  signature?: boolean;
  /** Units the signature combo opens with (default 2; Easy 1). */
  sigUnits?: number;
  /** Cooldown moves only. */
  cooldown?: boolean;
  /** Palette key (default: the section type): sections sharing it reuse the same few moves. */
  memoKey?: string;
  /** Per-bar readings, index-aligned with the phrase's bars (default: flat, from `energy`). */
  feels?: readonly BarFeel[];
  /** Which run of its section type this is (0 = the first verse / chorus ...): motifs develop, choruses intensify. */
  occ?: number;
  /** The last run of its section type (the final chorus). */
  last?: boolean;
  /** Typical target vigour of the whole section run: holds well above it build, well below it break. */
  typical?: number;
}

// ---------------------------------------------------------------------------
// Phrasing: how long a move is held, and which one
//
// A phrase (8 bars; 16 at half time) is cut into holds on its own grid: the
// whole phrase, its halves, or quarters, never below one unit (2 bars; Easy
// 4). Each candidate block is held whole with a seeded probability whose
// log-odds rise with how steady the groove is (low bar `change`), with
// energy (and, a little, in very quiet passages), at a drop and in peak
// sections, and fall when the block's two halves differ in energy; so a
// steady, loud drop holds one move for the whole phrase while a passage that
// keeps switching beats changes every unit or two. A drop always starts a
// new phrase and a new hold.
//
// Which move: the hold's slot in the song's kit (section scripts below). A
// hold well above its section's typical vigour builds, one well below it
// breaks; a drop takes the power moves. Each slot's move is cast leaning on
// the vigour its holds call for (loud, bassy bars and drops favour vigorous
// moves: jumps, big arms, headbangs, within the level's rules; soft bars
// gentle ones; vigourTilt). Recurring moves come back as a variation now and
// then, a later verse has a one-off or two, and long holds switch to a
// variation of the same move half-way, so nothing is a frozen loop.

/** Log-odds of holding a block whole, by level: [blocks of 2 units, blocks of 3+ units (a whole phrase)]. */
const HOLD_BIAS: Readonly<Record<Intensity, readonly [number, number]>> = {
  chill: [0.9, 0.9],
  cardio: [1.4, -0.2],
  sweaty: [0.8, -0.7],
};
/** Log-odds per unit of steadiness (1 - change) above STEADY_MID. */
const HOLD_STEADY_W = 5;
const STEADY_MID = 0.6;
/** Log-odds per unit of the block's target vigour above 0.5 (loud passages hold longer) ... */
const HOLD_ENERGY_W = 1.8;
/** ... and below HOLD_CALM_BELOW (so do quiet, gentle ones). */
const HOLD_CALM_W = 2;
const HOLD_CALM_BELOW = 0.35;
/** Extra log-odds when the block starts with a drop. */
const HOLD_DROP = 1.2;
/** Extra log-odds by section type. */
const HOLD_SECTION: Readonly<Record<SectionType, number>> = { intro: 0.4, verse: 0, chorus: 0.2, drop: 0.5, outro: 0.6 };
/** Log-odds lost per unit of energy contrast between a block's halves (beyond 0.15). */
const HOLD_CONTRAST_W = 5;
/** Target vigour shift by section type. */
const TARGET_SECTION: Readonly<Record<SectionType, number>> = { intro: -0.1, verse: -0.03, chorus: 0.05, drop: 0.12, outro: -0.2 };
/** Target vigour boost of a hold starting on a drop. */
const TARGET_DROP = 0.15;
/** Strength of the energy -> vigour lean (log weight ratio between the extremes is TILT / 4). */
const VIGOUR_TILT = 8;
/** Target vigour at / above which a hold is loud (it builds), at / below which it is soft (a break). */
const PALETTE_HEAVY = 0.62;
const PALETTE_SOFT = 0.38;
/** How far above / below its section's typical vigour a hold must be to build / break. */
const TIER_MARGIN = 0.12;
/** Chance a hold of a later verse is a one-off move (danced only there). */
const ONE_OFF_P: Record<Intensity, number> = { chill: 0.04, cardio: 0.12, sweaty: 0.2 };
/** Chance a recurring kit move comes back as a variation of itself in a later run of its section. */
const REPEAT_VARIANT_P: Record<Intensity, number> = { chill: 0.1, cardio: 0.3, sweaty: 0.45 };
/** Chance a long hold (a whole phrase) switches to a variation half-way. */
const MID_VARIANT_P: Record<Intensity, number> = { chill: 0.3, cardio: 0.6, sweaty: 0.7 };

/** Weight factor leaning move choice toward the target vigour (1 at a neutral target). */
export function vigourTilt(m: Move, target: number): number {
  return Math.exp(VIGOUR_TILT * (target - 0.5) * (moveVigour(m) - 0.5));
}

const mean = (xs: readonly BarFeel[], g: (f: BarFeel) => number, from = 0, to = xs.length) => {
  let s = 0;
  let n = 0;
  for (let i = Math.max(0, from); i < Math.min(xs.length, to); i++) (s += g(xs[i])), n++;
  return n ? s / n : 0;
};

/**
 * How steady the groove is over bars [from, to): 1 - the mean change, leaving
 * out the most changed bar (a fill) when there are 3 or more.
 */
export function steadiness(feels: readonly BarFeel[], from: number, to: number): number {
  const c: number[] = [];
  for (let i = Math.max(0, from); i < Math.min(feels.length, to); i++) c.push(feels[i].change);
  if (c.length === 0) return 1 - DEFAULT_CHANGE;
  c.sort((a, b) => a - b);
  if (c.length >= 3) c.pop();
  return 1 - c.reduce((a, b) => a + b, 0) / c.length;
}

/** Target vigour (0..1) of a stretch of bars. */
export function targetVigour(feels: readonly BarFeel[], section: SectionType, warmup = false): number {
  const e = mean(feels, (f) => f.energy);
  const b = mean(feels, (f) => f.bass);
  let t = 0.6 * e + 0.4 * b + TARGET_SECTION[section] + (feels[0]?.drop ? TARGET_DROP : 0);
  if (warmup) t = Math.min(t, 0.35);
  return Math.min(1, Math.max(0, t));
}

// ---------------------------------------------------------------------------
// The song's kit
//
// A routine is choreographed from a small CAST of moves picked once per song
// (deterministically from the seed, style, tempo, energy and level), each
// with a role, instead of drawing fresh moves hold by hold:
//
//   warm    the warm-up move (gentle)            intro   intro grooves (2)
//   groove  the verse motif (3, Hard 4) + one new move per later verse
//   build   loud verse passages (2)              hook    the chorus hook phrase (3)
//   power   drops (3)                            break   soft passages, a contrast (2)
//
// Section scripts say which role and motif position each hold takes:
//   verse    groove motif A B A C (Hard: A B A C D B D C); verse 2 = verse 1
//            with one position swapped for a new move; loud holds build,
//            soft holds break.
//   chorus   after the song combo, the hook phrase H1 H2 H3 H2, the same every
//            chorus; later choruses intensify H1 (a bigger variation of it),
//            the final chorus H2 as well.
//   drop     power motif P1 P2 P1 P3.
//   intro    the warm-up move, then the intro grooves; outro: cool-down flows.
// A move never follows itself across a hold boundary (a variation or an
// alternate steps in), so the motifs never collapse into a loop.
//
// Each role is cast with the soft weights (style, tempo, level, the vigour
// its passages call for, the section's level mix), plus FLOW: the pose
// distance from the move danced just before it (end pose -> start pose: arms,
// feet, height, facing; transitionCost), and contrast with the moves it plays
// against (a break doesn't use the groove's body parts). Flow and contrast
// are weights among the others, never filters.
//
// Tiers: on a song that opens genre sets, the kit is mostly global and a few
// slots are genre accents, placed deliberately (GENRE_PRIORITY: the drop's
// power move first, then the hook's third move, the verse motif's C, the
// second build move ...), chosen so that genre moves get GENRE_MIN..GENRE_MAX
// (aiming at GENRE_TARGET) of the danced time; the verse motif's A and the
// hook's H1 stay global, so verses and choruses are carried by global moves.

type Role = 'warm' | 'intro' | 'groove' | 'build' | 'hook' | 'power' | 'break';

interface Slot {
  key: string;
  role: Role;
  /** Base slot this one is a variation of ('hook.0+' intensifies 'hook.0'). */
  of: string | null;
  /** Section type it is danced in (its level mix). */
  section: SectionType;
  genre: Genre | null;
  move: Move | null;
  /** Planned beats and target vigour x beats (map routines). */
  beats: number;
  tSum: number;
}

interface HoldItem {
  kind: 'hold';
  bars: Bar[];
  feels: BarFeel[];
  o: PhraseOpts;
  phraseNo: number;
  phraseEnd: boolean;
  /** Kit slot (null: cool-down, picked per hold). */
  slot: string | null;
  target: number;
}
interface SigItem {
  kind: 'sig';
  bars: Bar[];
  section: SectionType;
  phraseNo: number;
}
type Item = HoldItem | SigItem;

/** Verse motif (indices into the groove slots), by level. */
const VERSE_MOTIF: Readonly<Record<Intensity, readonly number[]>> = { chill: [0, 1, 0, 2], cardio: [0, 1, 2, 0], sweaty: [0, 1, 2, 0, 3, 1, 3, 2] };
/** Chorus hook phrase (indices into the hook slots), by level: Hard has a fourth move. */
const HOOK_MOTIF: Readonly<Record<Intensity, readonly number[]>> = { chill: [0, 1, 2, 0], cardio: [0, 1, 2, 0], sweaty: [0, 1, 2, 3] };
const POWER_MOTIF: Readonly<Record<Intensity, readonly number[]>> = { chill: [0, 1, 0, 2], cardio: [0, 1, 0, 2], sweaty: [0, 1, 2, 0] };
/** Build-ups and breaks: A B A C as well (never a long A B A B). */
const SIDE_MOTIF: readonly number[] = [0, 1, 0, 2];
/** Motif position the n-th later verse swaps for a new move. */
const SWAP_POS: readonly number[] = [3, 1, 2];
/** Slots that become genre accents first (base slots; their variations follow them). */
const GENRE_PRIORITY: readonly string[] = [
  'power.0', 'hook.2', 'groove.2', 'build.1', 'groove.s1', 'hook.3', 'groove.c1', 'groove.t1', 'hook.4', 'build.2', 'break.1', 'break.2', 'power.2', 'groove.s2', 'build.0', 'groove.c2', 'hook.1',
  'groove.3', 'groove.1', 'intro.1', 'power.1', 'break.0', 'groove.s3', 'groove.s4', 'intro.0',
];
/** Genre accent slots of live plans (no song plan to measure). */
const LIVE_GENRE_SLOTS = new Set(['power.0', 'hook.2', 'groove.2', 'build.1', 'break.1']);
/** Share of the danced time genre moves get on a song that opens a genre: aim, floor, ceiling. */
export const GENRE_TARGET = 0.3;
export const GENRE_MIN = 0.2;
export const GENRE_MAX = 0.4;
/** Kept for callers: the genre share aimed at. */
export const GENRE_SHARE = GENRE_TARGET;
/** Weight of a transition's pose distance (exp(-FLOW_W * mean cost)). */
const FLOW_W = 1.8;
/** Neighbouring kit moves a cast looks at, each way. */
const FLOW_NEIGHBOURS = 3;
/** Candidates below this share of the best weight skip the flow score (it can only lower them). */
const FLOW_PRUNE = 3e-4;

export class Choreographer {
  readonly signature: SigStep[];
  readonly half: boolean;
  readonly unitBars: number;
  readonly style: SongStyle;
  /** The genres the song opens. */
  readonly genres: ReadonlySet<Genre>;
  /** Song tempo (BPM) the tempo weights use (undefined: no tempo lean). */
  readonly bpm: number | undefined;
  /** Live plans: genre accents by slot name (no song plan to measure). */
  liveGenres = false;
  private rng: () => number;
  private planRng: () => number;
  private intensity: Intensity;
  private lastMove: Move | null = null;
  private lastMirror = false;
  private pool: readonly Move[];
  /** Per-move static weight: style x tempo x variation share (index-aligned with pool); 0 = never. */
  private base: Float64Array;
  /** levelFactor, vigour and body-part mask of each pool move (index-aligned with pool). */
  private levelF: Float64Array;
  private vig: Float64Array;
  private partsM: Uint8Array;
  private ornaments: { get(base: string): readonly Move[] } | null;
  /** Genre-exclusive moves of genres the song doesn't open (never used). */
  private outside = new Set<Move>();
  /** Variations in the pool, by base move id. */
  private varsByBase = new Map<string, Move[]>();
  /** In-place 1- and 2-beat moves (a map with no whole bar at all). */
  private gapMoves: Move[] = [];
  private gapW: number[] = [];
  private phraseNo = 0;
  /** The kit: slots by key, and the moves / base moves cast so far. */
  private slots = new Map<string, Slot>();
  private kit = new Set<Move>();
  private kitBases = new Set<string>();
  private kitFeet = new Set<string>();
  /** The section run being planned, and its per-role hold counters. */
  private runKey = '';
  private counters = new Map<string, number>();
  /** Whether a slot comes back as its variation in a given section run. */
  private develop = new Map<string, boolean>();
  private oneOffs = 0;
  /** Slots the plan puts right before / after each slot (flow). */
  private before = new Map<string, Set<string>>();
  private after = new Map<string, Set<string>>();
  /** Open genres that have moves this level can dance, with how strongly the song opens them. */
  private genreOk: Genre[] = [];
  private openness: Map<Genre, number>;
  /** Display name of the song combo (one card). */
  private comboName = '';

  constructor(seedKey: string, intensity: Intensity, half: boolean, opts: RoutineOpts = {}, bpm?: number) {
    this.intensity = intensity;
    this.half = half;
    this.bpm = bpm;
    this.unitBars = unitBarsFor(intensity, half);
    this.style = opts.style ?? BALANCED_POP;
    const sk = styleKey(this.style);
    const fresh = opts.fresh !== undefined && opts.fresh > 0 ? `|play${opts.fresh}` : '';
    this.rng = mulberry32(hashString(`${seedKey}|${intensity}|${sk}${fresh}`));
    this.planRng = mulberry32(hashString(`${seedKey}|plan|${intensity}|${sk}${fresh}`));
    const useVars = opts.variations !== false;
    const { moves, isVar } = dancePool(useVars);
    this.pool = moves;
    const orn = useVars ? getPool().ornaments : null;
    this.ornaments = orn ? { get: (id: string) => orn.get(id).map(withShortName) } : null;
    const open = styleGenres(this.style);
    this.genres = open;
    this.openness = genreOpenness(this.style, open);
    const none = new Map<Genre, number>();
    // Static weight: style x tempo (the tier is the kit's choice), the variations scaled to their share.
    this.base = new Float64Array(moves.length);
    this.levelF = new Float64Array(moves.length);
    this.vig = new Float64Array(moves.length);
    this.partsM = new Uint8Array(moves.length);
    let mb = 0, mv = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      this.levelF[i] = levelFactor(m, intensity);
      this.vig[i] = moveVigour(m);
      this.partsM[i] = partsMask(m);
      if (!genreFits(m, open)) {
        this.outside.add(m);
        continue;
      }
      // Easy keeps to simple variations (base moves stay soft-weighted).
      if (isVar[i] && intensity === 'chill' && m.difficulty > 1) continue;
      this.base[i] = staticWeight(m, this.style, bpm, none);
      const w = this.base[i] * this.levelF[i];
      if (isVar[i]) mv += w;
      else mb += w;
    }
    const share = VARIATION_SHARE[intensity];
    const vw = mv > 0 ? Math.min(1, (share / (1 - share)) * (mb / mv)) : 0;
    for (let i = 0; i < moves.length; i++) {
      if (!isVar[i]) continue;
      this.base[i] *= vw;
      const m = moves[i];
      if (this.outside.has(m) || this.base[i] <= 0 || levelFactor(m, intensity) <= 0) continue;
      const list = this.varsByBase.get(m.base);
      if (list) list.push(m);
      else this.varsByBase.set(m.base, [m]);
    }
    for (const g of open) if (DANCE_MOVES.some((m) => m.genre === g && levelFactor(m, intensity) > 0)) this.genreOk.push(g);
    for (const m of DANCE_MOVES) {
      if (m.beats > 2 || m.travel !== 0 || m.genre || levelFactor(m, intensity) <= 0) continue;
      this.gapMoves.push(m);
      this.gapW.push(staticWeight(m, this.style, bpm, none) * levelFactor(m, intensity) * (m.beats === 1 ? 2 : 1));
    }
    // The chorus combo keeps the stable seed (same in 'fresh' mode).
    const genreK = genreScale(this.style, open, intensity, bpm);
    this.signature = pickSignature(mulberry32(hashString(`${seedKey}|sig|${intensity}|${sk}`)), intensity, this.style, open, bpm, genreK);
    this.comboName = comboName(this.signature);
  }

  /** Whether the song combo is the song's curated signature nod (outside the tier accounting). */
  get nodCombo(): boolean {
    const ids = new Set(this.style.signature ?? []);
    return this.signature.length > 0 && this.signature.every((s) => ids.has(s.move.id));
  }

  /** Plan and dance one phrase at once (live plans). */
  phrase(out: MoveInstance[], bars: readonly Bar[], o: PhraseOpts): void {
    for (const it of this.plan(bars, o)) this.emit(out, it);
  }

  /**
   * Plan one phrase (contiguous bars): the signature combo first when asked,
   * then holds on the phrase's own grid (planHolds), each given its kit slot
   * by the section's script. Nothing is danced yet (emit).
   */
  plan(bars: readonly Bar[], o: PhraseOpts): Item[] {
    const items: Item[] = [];
    if (bars.length === 0) return items;
    const unitBars = this.unitBars;
    const phraseNo = this.phraseNo++;
    const flat: BarFeel = { energy: o.energy, bass: o.energy, change: DEFAULT_CHANGE, drop: false };
    const feels = o.feels && o.feels.length === bars.length ? o.feels : bars.map(() => flat);
    const run = `${o.memoKey ?? o.section}|${o.occ ?? 0}`;
    if (run !== this.runKey) {
      this.runKey = run;
      this.counters.clear();
    }
    let from = 0;
    if (o.signature && this.signature.length) {
      let take = Math.min(bars.length, Math.max(1, o.sigUnits ?? (this.intensity === 'chill' ? 1 : 2)) * unitBars);
      if (bars.length - take < unitBars) take = bars.length;
      items.push({ kind: 'sig', bars: bars.slice(0, take), section: o.section, phraseNo });
      from = take;
    }
    if (from >= bars.length) return items;
    const calm = !!(o.warmup || o.cooldown);
    for (const h of this.planHolds(feels, from, o)) {
      const hb = bars.slice(h.a, h.a + h.len);
      const hf = feels.slice(h.a, h.a + h.len);
      const target = targetVigour(hf, o.section, o.warmup);
      const drop = hf[0]?.drop ?? false;
      const t = drop ? Math.min(1, target + TARGET_DROP) : target;
      // Loud / soft relative to the section's own typical level (most of a loud song's verse is just the verse).
      const typ = o.typical;
      const heavy = typ === undefined ? t >= PALETTE_HEAVY : t >= Math.max(PALETTE_HEAVY, typ + TIER_MARGIN);
      const soft = typ === undefined ? t <= PALETTE_SOFT : t <= Math.min(PALETTE_SOFT, typ - TIER_MARGIN) || t <= PALETTE_SOFT - 0.15;
      const tier = heavy ? 'heavy' : soft ? 'soft' : 'mid';
      const slot = o.cooldown ? null : this.slotFor(o, tier, drop);
      if (slot) {
        const s = this.slot(slot, o);
        const beats = barsEnd(hb) - hb[0].start;
        s.beats += beats;
        s.tSum += t * beats;
      }
      items.push({ kind: 'hold', bars: hb, feels: hf, o, phraseNo, phraseEnd: h.a + h.len === bars.length && !calm, slot, target: t });
    }
    return items;
  }

  /** The kit slot of the next hold of the current section run (the section scripts above). */
  private slotFor(o: PhraseOpts, tier: 'soft' | 'mid' | 'heavy', drop: boolean): string {
    const k = this.scriptSlot(o, tier, drop);
    // Now and then a later verse hold is a one-off: a move danced only there (choruses keep their hook).
    if ((o.occ ?? 0) >= 1 && o.section === 'verse' && !o.warmup && !k.endsWith('+') && k !== 'groove.0' && this.planRng() < ONE_OFF_P[this.intensity]) return `${k.slice(0, k.indexOf('.'))}.o${this.oneOffs++}`;
    // In a later run of its section, a recurring move may come back as a variation of itself, decided once per run.
    const occ = o.occ ?? 0;
    if (occ < 1 || k.endsWith('+') || k.includes('.s') || k.startsWith('warm') || k.startsWith('intro')) return k;
    const dk = `${k}@${o.memoKey ?? o.section}|${occ}`;
    let d = this.develop.get(dk);
    if (d === undefined) this.develop.set(dk, (d = this.planRng() < REPEAT_VARIANT_P[this.intensity]));
    return d ? `${k}+` : k;
  }

  private scriptSlot(o: PhraseOpts, tier: 'soft' | 'mid' | 'heavy', drop: boolean): string {
    const next = (k: string) => {
      const n = this.counters.get(k) ?? 0;
      this.counters.set(k, n + 1);
      return n;
    };
    const occ = o.occ ?? 0;
    if (o.warmup) return `warm.${SIDE_MOTIF[next('warm') % SIDE_MOTIF.length]}`;
    if (o.section === 'intro') return `intro.${SIDE_MOTIF[next('intro') % SIDE_MOTIF.length]}`;
    // A motif's second time round in the same section develops: its first move as a variation, its last a new move.
    if (o.section === 'drop' || drop) {
      const motif = POWER_MOTIF[this.intensity];
      const j = next('power');
      const p = motif[j % motif.length];
      return j >= motif.length && p === 0 ? 'power.0+' : `power.${p}`;
    }
    if (o.section === 'chorus') {
      const motif = HOOK_MOTIF[this.intensity];
      const j = next('hook');
      const h = motif[j % motif.length];
      const again = j >= motif.length;
      if (h === 0 && (occ >= 1 || again)) return 'hook.0+';
      if (h === 1 && occ >= 2 && o.last) return 'hook.1+';
      if (h === 1 && again) return 'hook.4';
      return `hook.${h}`;
    }
    if (o.section === 'outro') return `intro.${SIDE_MOTIF[next('intro') % SIDE_MOTIF.length]}`;
    // Verse.
    if (tier === 'soft') return `break.${SIDE_MOTIF[(next('break') + occ) % SIDE_MOTIF.length]}`;
    if (tier === 'heavy') return `build.${SIDE_MOTIF[next('build') % SIDE_MOTIF.length]}`;
    const motif = VERSE_MOTIF[this.intensity];
    const j = next('groove');
    const pos = j % motif.length;
    if (occ >= 1 && pos === SWAP_POS[(occ - 1) % SWAP_POS.length] % motif.length) return `groove.s${occ}`;
    // Hard: a second swap in the motif's second half.
    if (occ >= 1 && motif.length > 4 && pos === 4 + (SWAP_POS[(occ - 1) % SWAP_POS.length] % 4)) return `groove.t${occ}`;
    const g = motif[pos];
    if (j >= motif.length) {
      if (g === 0) return 'groove.0+';
      if (pos === motif.length - 1) return `groove.c${Math.floor(j / motif.length)}`;
    }
    return `groove.${g}`;
  }

  private slot(key: string, o: PhraseOpts): Slot {
    let s = this.slots.get(key);
    if (!s) {
      const plus = key.endsWith('+');
      const role = key.slice(0, key.indexOf('.')) as Role;
      s = { key, role, of: plus ? key.slice(0, -1) : null, section: o.warmup ? 'intro' : o.section, genre: null, move: null, beats: 0, tSum: 0 };
      if (s.of) {
        const b = this.slot(s.of, o);
        s.genre = b.genre;
      } else if (this.liveGenres && LIVE_GENRE_SLOTS.has(key)) s.genre = this.pickGenre();
      this.slots.set(key, s);
    }
    return s;
  }

  private pickGenre(): Genre | null {
    if (!this.genreOk.length) return null;
    return pickWeighted(this.planRng, this.genreOk, this.genreOk.map((g) => this.openness.get(g) ?? 1));
  }

  /**
   * Choose the kit's genre accents for a whole planned song: slots in
   * GENRE_PRIORITY order (with their variations) until genre moves have about
   * GENRE_TARGET of the danced time, never above GENRE_MAX, and at least
   * GENRE_MIN when the plan allows it. The song combo counts with its moves'
   * tiers, a curated signature nod not at all.
   */
  /** Remember which slots the plan puts next to each other (flow when casting). */
  link(items: readonly Item[]): void {
    const keyOf = (it: Item) => (it.kind === 'sig' ? 'SIG' : it.slot);
    for (let k = 1; k < items.length; k++) {
      const a = keyOf(items[k - 1]);
      const b = keyOf(items[k]);
      if (!a || !b || a === b) continue;
      const base = (x: string) => (x === 'SIG' ? x : (this.slots.get(x)?.of ?? x));
      const A = base(a), B = base(b);
      if (A === B) continue;
      if (!this.after.has(A)) this.after.set(A, new Set());
      if (!this.before.has(B)) this.before.set(B, new Set());
      this.after.get(A)!.add(B);
      this.before.get(B)!.add(A);
    }
  }

  assignGenres(items: readonly Item[]): void {
    if (!this.genreOk.length) return;
    const nod = this.nodCombo;
    let total = 0;
    let cur = 0;
    const sigBeats = this.signature.reduce((t, s) => t + s.move.beats, 0);
    const sigGenre = sigBeats ? this.signature.reduce((t, s) => t + (s.move.genre ? s.move.beats : 0), 0) / sigBeats : 0;
    const groups = new Map<string, number>();
    for (const it of items) {
      const beats = barsEnd(it.bars) - it.bars[0].start;
      if (it.kind === 'sig') {
        if (nod) continue;
        total += beats;
        cur += beats * sigGenre;
        continue;
      }
      if (!it.slot) continue;
      total += beats;
      const k = this.slots.get(it.slot)!.of ?? it.slot;
      groups.set(k, (groups.get(k) ?? 0) + beats);
    }
    if (total <= 0) return;
    const chosen: string[] = [];
    const take = (k: string) => {
      chosen.push(k);
      cur += groups.get(k)!;
      groups.delete(k);
    };
    for (const k of GENRE_PRIORITY) {
      if (cur >= GENRE_TARGET * total) break;
      const b = groups.get(k);
      if (b !== undefined && cur + b <= GENRE_MAX * total) take(k);
    }
    if (cur < GENRE_MIN * total) {
      const rest = [...groups.entries()].filter(([k]) => !k.startsWith('warm')).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
      for (const [k, b] of rest) {
        if (cur >= GENRE_MIN * total) break;
        if (cur + b <= GENRE_MAX * total) take(k);
      }
    }
    for (const k of chosen) {
      const g = this.pickGenre();
      for (const s of this.slots.values()) if (s.key === k || s.of === k) s.genre = g;
    }
  }

  /** Dance one planned item. */
  emit(out: MoveInstance[], it: Item): void {
    if (it.kind === 'sig') {
      for (const ub of this.units(it.bars)) this.fillSig(out, ub[0].start, barsEnd(ub), it.section, it.phraseNo);
      return;
    }
    const move = it.slot ? this.moveFor(it) : this.choose(it.o, null, it.target);
    this.emitHold(out, it.bars, move, it.o, it.phraseNo, it.phraseEnd);
  }

  /** The kit move for a hold (cast on first use); never the move just danced (an alternate instead). */
  private moveFor(it: HoldItem): Move {
    const s = this.slots.get(it.slot!)!;
    if (!s.move) s.move = this.cast(s, it);
    const prev = this.lastMove;
    let m = s.move;
    if (prev && m.base === prev.base) {
      // The same move again across a hold boundary (a section run ending where the next one starts): an alternate of the same role.
      const alt = this.slot(`${s.key}~alt`, it.o);
      alt.role = s.role;
      alt.genre = s.genre;
      if (!alt.move || alt.move.base === prev.base) alt.move = this.cast(alt, it);
      m = alt.move;
    }
    return m;
  }

  /** Cast a kit slot: a variation of its base slot, or a fresh weighted pick for its role. */
  private cast(s: Slot, it: HoldItem): Move {
    if (s.of) {
      const b = this.slots.get(s.of)!;
      if (!b.move) b.move = this.cast(b, it);
      const v = this.intensified(b.move, it.o);
      if (v) this.kit.add(v);
      return v ?? b.move;
    }
    const o = it.o;
    const t0 = s.beats > 0 ? s.tSum / s.beats : it.target;
    const target = s.role === 'power' ? Math.max(t0, 0.7) : s.role === 'break' || s.role === 'warm' ? Math.min(t0, 0.35) : t0;
    const lw = levelWeights(s.role === 'warm' ? 'warmup' : s.section, this.intensity, target);
    // Moves it plays against: a break and the hook contrast with the verse motif, the motif's moves with its first.
    const against: Move[] = [];
    const add = (k: string) => {
      const m = this.slots.get(k)?.move;
      if (m) against.push(m);
    };
    if (s.role === 'break' || s.role === 'hook') for (let n = 0; n < 4; n++) add(`groove.${n}`);
    if (s.role === 'groove' && s.key !== 'groove.0') add('groove.0');
    if (s.role === 'power') add('hook.0');
    const calm = s.role === 'warm' || s.role === 'intro';
    const develops = s.key === 'groove.0' || s.key === 'hook.0' || s.key === 'hook.1';
    const prev = this.lastMove;
    const prevPose = prev ? lastKeyPose(prev, this.lastMirror) : null;
    const tilt = s.role !== 'warm';
    const pool = this.pool;
    // The poses it must join: end poses of the slots planned before it, start poses of those after it.
    const ins: Pose[] = [];
    const outs: Pose[] = [];
    for (const k of this.before.get(s.key) ?? []) {
      const m = k === 'SIG' ? this.signature[this.signature.length - 1]?.move : this.slots.get(k)?.move;
      if (m && m !== prev && ins.length < FLOW_NEIGHBOURS) ins.push(lastKeyPose(m, false));
    }
    for (const k of this.after.get(s.key) ?? []) {
      const m = k === 'SIG' ? this.signature[0]?.move : this.slots.get(k)?.move;
      if (m && outs.length < FLOW_NEIGHBOURS) outs.push(keysOf(m, false)[0].pose);
    }
    const againstM = against.map(partsMask);
    const prevM = prev && !prev.idle ? partsMask(prev) : -1;
    const tiltK = VIGOUR_TILT * (target - 0.5);
    const pick = (genre: Genre | null): Move | null => {
      const w = new Float64Array(pool.length);
      let max = 0;
      for (let i = 0; i < pool.length; i++) {
        const m = pool[i];
        let x = this.base[i];
        if (x <= 0 || m === prev) continue;
        if (genre ? m.genre !== genre : !!m.genre) continue;
        if (this.kit.has(m)) continue;
        x *= lw[m.level] * this.levelF[i];
        if (x <= 0) continue;
        if (this.kitBases.has(m.base)) x *= 0.001;
        // ... and moves on the same footwork as one already cast look alike (three jazz walks).
        if (m.foot && this.kitFeet.has(m.foot)) x *= 0.3;
        // Moves that develop later (the motif's A, the hook's H1 / H2) start from a base move, so a variation can intensify them.
        if (develops && m.base !== m.id) x *= 0.1;
        if (calm && m.file === 'cooldown') x *= 2.5;
        const pm = this.partsM[i];
        for (const a of againstM) x *= 1 - 0.5 * maskOverlap(a, pm);
        if (prevM >= 0) {
          if (m.base === prev!.base) x *= 0.1;
          x *= 1 - 0.6 * maskOverlap(prevM, pm);
        }
        if (tilt) {
          const vt = Math.exp(tiltK * (this.vig[i] - 0.5));
          x *= this.intensity === 'chill' && m.impact ? Math.min(1, vt) : vt;
        }
        w[i] = x;
        if (x > max) max = x;
      }
      // Flow: how well it joins the moves around it (the one just danced, and the kit moves the
      // plan puts right before or after this slot): end pose -> start pose, the better side.
      // Only for the moves that can still matter (the flow factor is at most 1).
      if (prevPose || ins.length || outs.length) {
        const floor = max * FLOW_PRUNE;
        for (let i = 0; i < pool.length; i++) {
          if (w[i] <= floor) {
            w[i] = 0;
            continue;
          }
          const m = pool[i];
          const a = keysOf(m, false);
          const b = m.mirror ? keysOf(m, true) : null;
          const a0 = a[0].pose, a1 = a[a.length - 1].pose;
          const b0 = b ? b[0].pose : a0, b1 = b ? b[b.length - 1].pose : a1;
          const start = (q: Pose) => (b ? Math.min(transitionCost(q, a0), transitionCost(q, b0)) : transitionCost(q, a0));
          let c = 0, n = 0;
          if (prevPose) (c += start(prevPose)), n++;
          for (const q of ins) (c += start(q)), n++;
          for (const q of outs) (c += b ? Math.min(transitionCost(a1, q), transitionCost(b1, q)) : transitionCost(a1, q)), n++;
          w[i] *= Math.exp(-FLOW_W * (c / n));
        }
      }
      return pickWeighted(this.rng, pool, w);
    };
    let m = s.genre ? pick(s.genre) : null;
    if (!m) {
      s.genre = null;
      m = pick(null);
    }
    if (!m) m = this.choose(o, prev, target);
    this.kit.add(m);
    this.kitBases.add(m.base);
    if (m.foot) this.kitFeet.add(m.foot);
    return m;
  }

  /** A bigger version of `m` for a later chorus: a variation at least as vigorous, the most vigorous favoured. */
  private intensified(m: Move, o: PhraseOpts): Move | null {
    const list = this.variants(m, o).filter((v) => moveVigour(v) >= moveVigour(m) - 0.02);
    if (!list.length) return this.variantOf(m, o);
    return pickWeighted(this.rng, list, list.map((v) => 0.2 + moveVigour(v)));
  }

  /** Variations of `m` allowed here, of the same tier, suiting the level at least half as well as `m`. */
  private variants(m: Move, o: PhraseOpts): Move[] {
    const list: Move[] = [];
    for (const v of this.ornaments?.get(m.id) ?? []) {
      const type = v.id.slice(v.id.lastIndexOf('~') + 1);
      if ((type === 'hips' || type === 'diag') && levelFactor(v, this.intensity) > 0) list.push(v);
    }
    for (const v of this.varsByBase.get(m.base) ?? []) if (v !== m && this.allowed(v, o)) list.push(v);
    const min = 0.5 * levelFactor(m, this.intensity);
    return list.filter((v) => v.genre === m.genre && levelFactor(v, this.intensity) >= min);
  }

  /** One variation of `m` (evenly), or null. */
  private variantOf(m: Move, o: PhraseOpts): Move | null {
    const ok = this.variants(m, o);
    return ok.length ? ok[Math.floor(this.rng() * ok.length)] : null;
  }

  /** Bars cut into units of `unitBars` (a short tail joins the last unit). */
  private units(bars: readonly Bar[]): Bar[][] {
    const unitBars = this.unitBars;
    const units: Bar[][] = [];
    for (let i = 0; i < bars.length; i += unitBars) units.push(bars.slice(i, i + unitBars) as Bar[]);
    if (units.length > 1 && units[units.length - 1].length < unitBars / 2 + 0.5 && unitBars > 1) {
      const tail = units.pop()!;
      units[units.length - 1].push(...tail);
    }
    return units;
  }

  /**
   * Holds covering bars [from, n) of a phrase: the phrase's power-of-two
   * block grid (in units), each block held whole or halved (seeded, see
   * HOLD_*). Blocks never cross `from`, the phrase end or a drop; anything
   * shorter than a unit joins its neighbour.
   */
  private planHolds(feels: readonly BarFeel[], from: number, o: PhraseOpts): { a: number; len: number }[] {
    const n = feels.length;
    const minHold = this.unitBars;
    const out: { a: number; len: number }[] = [];
    // The warm-up is one gentle move.
    if (o.warmup && o.section !== 'intro') return [{ a: from, len: n - from }];
    const bias = HOLD_BIAS[this.intensity];
    const rec = (a: number, L: number) => {
      const lo = Math.max(a, from);
      const hi = Math.min(a + L, n);
      if (hi <= lo) return;
      if (L <= minHold || hi - lo <= minHold) {
        out.push({ a: lo, len: hi - lo });
        return;
      }
      // A block cut by the phrase end or across a drop must split; one cut
      // only by `from` (after the combo) may still hold its remainder.
      let forced = hi < a + L || (hi - lo) % minHold !== 0;
      for (let k = lo + 1; k < hi && !forced; k++) if (feels[k].drop) forced = true;
      if (!forced) {
        const units = (hi - lo) / minHold;
        const tv = targetVigour(feels.slice(lo, hi), o.section);
        const mid = lo + Math.floor((hi - lo) / 2);
        const contrast = Math.abs(mean(feels, (f) => f.energy, lo, mid) - mean(feels, (f) => f.energy, mid, hi));
        const x =
          (units >= 3 ? bias[1] : bias[0]) +
          HOLD_STEADY_W * (steadiness(feels, lo + 1, hi) - STEADY_MID) +
          HOLD_ENERGY_W * Math.max(0, tv - 0.5) +
          HOLD_CALM_W * Math.max(0, HOLD_CALM_BELOW - tv) +
          (feels[lo].drop ? HOLD_DROP : 0) +
          HOLD_SECTION[o.section] -
          HOLD_CONTRAST_W * Math.max(0, contrast - 0.15);
        if (this.planRng() < 1 / (1 + Math.exp(-x))) {
          out.push({ a: lo, len: hi - lo });
          return;
        }
      }
      const h = Math.max(minHold, L / 2);
      rec(a, h);
      rec(a + h, L - h);
    };
    let P = minHold;
    while (P < n) P *= 2;
    rec(0, P);
    // Fragments shorter than a unit join the previous hold (or the next).
    for (let i = 0; i < out.length; i++) {
      if (out.length > 1 && out[i].len < minHold) {
        if (i > 0) out[i - 1].len += out[i].len;
        else {
          out[1].a = out[0].a;
          out[1].len += out[0].len;
        }
        out.splice(i, 1);
        i--;
      }
    }
    return out;
  }

  /**
   * One hold: `move` repeated over the hold's units. A whole-phrase hold
   * may switch to a variation of the move half-way (a new card of 4+ bars);
   * a hold ending the phrase may close with a flourish, shown under the
   * move's own name (same card).
   */
  private emitHold(out: MoveInstance[], bars: readonly Bar[], move: Move, o: PhraseOpts, phraseNo: number, phraseEnd: boolean): void {
    const units = this.units(bars);
    const n = units.length;
    const calm = !!(o.warmup || o.cooldown);
    let second = move;
    const longHold = bars.length >= (this.half ? 16 : 8);
    if (!calm && longHold && n >= 2 && this.rng() < MID_VARIANT_P[this.intensity]) second = this.variantOf(move, o) ?? move;
    // Lead with the side that joins the last move best.
    const prev = this.lastMove;
    let side = false;
    if (prev && move.mirror) {
      const p = lastKeyPose(prev, this.lastMirror);
      side = transitionCost(p, keysOf(move, true)[0].pose) < transitionCost(p, keysOf(move, false)[0].pose);
    }
    for (let u = 0; u < n; u++) {
      const m = u >= Math.ceil(n / 2) ? second : move;
      const flourish = phraseEnd && u === n - 1 && n > 1 ? this.ornament(m, ['spin', 'hit4', 'clap4'], FLOURISH_P[this.intensity]) : null;
      this.fillUnit(out, units[u], m, o.section, phraseNo, flourish, side && m.mirror);
    }
  }

  /**
   * Fill a short gap [start, end) with an in-place 1- or 2-beat move of the
   * song's style, repeated (only a map with no whole bar at all needs it:
   * everywhere else leftover beats are danced as part of a move).
   */
  filler(out: MoveInstance[], start: number, end: number, section: SectionType): void {
    let b = start;
    const mult = this.half ? 2 : 1;
    const w = this.gapMoves.map((m, i) => (m.level === 'low' ? this.gapW[i] : 0));
    const g = pickWeighted(this.rng, this.gapMoves, w);
    if (g) {
      for (const i of tileMove(g, start, end, mult, [], { half: this.half, section, sig: false, phrase: -1, fill: true })) out.push(i);
      b = end;
    }
    for (; b < end; b++) out.push({ move: IDLE_MOVE, mirror: false, start: b, span: 1, half: false, origin: 0, section, sig: false, unitStart: false, phrase: -1, fill: true });
  }

  private allowed(m: Move, o: PhraseOpts): boolean {
    if (o.cooldown) return COOLDOWN_MOVES.includes(m) && (m.cooldown || levelFactor(m, this.intensity) > 0);
    if (m.cooldown || m.idle) return false;
    if (this.outside.has(m)) return false;
    if (levelFactor(m, this.intensity) <= 0) return false;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, o.energy);
    return lw[m.level] > 0;
  }

  /** A per-hold pick (the cool-down flows, and the last resort). */
  private choose(o: PhraseOpts, avoid: Move | null, target = o.energy): Move {
    const pool = o.cooldown ? COOLDOWN_MOVES : this.pool;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, target);
    const prev = this.lastMove;
    const prevPose = prev ? lastKeyPose(prev, this.lastMirror) : null;
    const weights = pool.map((m, i) => {
      if (m === avoid || m === prev) return 0;
      let w = o.cooldown ? (m.cooldown || levelFactor(m, this.intensity) > 0 ? 1 : 0) : lw[m.level] * levelFactor(m, this.intensity) * this.base[i];
      if (w <= 0) return 0;
      if (!o.cooldown && (this.outside.has(m) || m.genre)) return 0;
      if (o.cooldown && this.kit.has(m)) w *= 0.15;
      if (prev && m.base === prev.base) w *= 0.1;
      if (prev && !prev.idle) w *= 1 - 0.6 * partsOverlap(prev, m);
      if (prevPose) w *= Math.exp(-FLOW_W * transitionCost(prevPose, keysOf(m, false)[0].pose));
      return w;
    });
    const picked = pickWeighted(this.rng, pool, weights);
    if (picked) {
      if (o.cooldown) this.kit.add(picked);
      return picked;
    }
    const fallback = pool.filter((m) => m !== prev && m !== avoid && !this.outside.has(m) && (o.cooldown || levelFactor(m, this.intensity) > 0));
    return fallback.length ? fallback[Math.floor(this.rng() * fallback.length)] : pool[0];
  }

  /** An ornamented version of `m` of one of the given types, or null. */
  private ornament(m: Move, types: readonly string[], p: number): Move | null {
    if (p <= 0 || this.rng() >= p) return null;
    const min = 0.5 * levelFactor(m, this.intensity);
    const list = (this.ornaments?.get(m.id) ?? []).filter((v) => types.includes(v.id.slice(v.id.lastIndexOf('~') + 1)) && levelFactor(v, this.intensity) >= min && levelFactor(v, this.intensity) > 0);
    return list.length ? list[Math.floor(this.rng() * list.length)] : null;
  }

  /** One unit of a hold: the move repeated (tileMove), its last 4 move beats a flourish when given (same card name). */
  private fillUnit(out: MoveInstance[], bars: readonly Bar[], m: Move, section: SectionType, phrase: number, flourish: Move | null, mirror = false): void {
    const mult = this.half ? 2 : 1;
    const start = bars[0].start;
    const end = barsEnd(bars);
    const tiles = tileMove(m, start, end, mult, bars.map((b) => b.start), { half: this.half, section, sig: false, phrase }, { unitStart: true, mirror });
    // Phrase-end flourish: replaces the last 4 move beats when they are whole repeats of an in-place move.
    if (flourish && m.travel === 0 && (4 / m.beats) % 1 === 0) {
      const fl = 4 / m.beats;
      const last = tiles.slice(-fl);
      const full = tiles.filter((i) => i.move === m).length;
      if (last.length === fl && last.every((i) => i.move === m) && full > fl && (full - fl) % (m.mirror ? 2 : 1) === 0) {
        tiles.splice(tiles.length - fl, fl, { ...last[0], move: renamed(flourish, m.name), mirror: false, span: 4 * mult, unitStart: tiles.length === fl });
      }
    }
    for (const i of tiles) out.push(i);
    const lastI = tiles[tiles.length - 1];
    if (lastI) {
      this.lastMove = lastI.move.part ? m : lastI.move;
      this.lastMirror = lastI.mirror;
      if (lastI.move.part) this.lastMove = m;
    }
  }

  /** The song combo over [start, end): whole combos while they fit, then its steps in order, the last one in part; one card. */
  private fillSig(out: MoveInstance[], start: number, end: number, section: SectionType, phrase: number): void {
    const mult = this.half ? 2 : 1;
    let b = start;
    let origin = 0;
    let first = true;
    const name = this.comboName;
    const push = (move: Move, mirror: boolean, span: number) => {
      out.push({ move: renamed(move, name), mirror, start: b, span, half: this.half, origin, section, sig: true, unitStart: first, phrase });
      first = false;
      b += span;
      this.lastMove = move;
      this.lastMirror = mirror;
    };
    let k = 0;
    let guard = 0;
    while (b < end && guard++ < 256) {
      const s = this.signature[k % this.signature.length];
      const span = s.move.beats * mult;
      if (b + span <= end) {
        push(s.move, s.mirror, span);
        origin += s.move.travel * (s.mirror ? -1 : 1);
        k++;
        continue;
      }
      const rest = end - b;
      const piece = s.move.travel !== 0 ? pauseOf(s.move, rest / mult) : partOf(s.move, 0, rest / mult);
      push(piece, s.move.travel !== 0 ? false : s.mirror, rest);
    }
    // A combo cut mid-travel: its last travelling step becomes a pause, so the coach ends at home.
    if (Math.abs(origin) > 1e-9) {
      for (let i = out.length - 1; i >= 0 && out[i].start >= start; i--) {
        if (out[i].move.travel === 0) continue;
        out[i].move = renamed(pauseOf(out[i].move, out[i].span / mult), name);
        out[i].mirror = false;
        for (let j = i + 1; j < out.length; j++) out[j].origin = out[i].origin;
        break;
      }
    }
  }
}

/**
 * Danced time of a routine by tier, as the kit accounts for it (GENRE_MIN ..
 * GENRE_MAX): every instance but the idle groove, the cool-down (outro) and a
 * curated signature nod's combo.
 */
export function tierBeats(r: Routine, style: SongStyle = BALANCED_POP): { global: number; genre: number } {
  const nod = new Set(style.signature ?? []);
  const nodCombo = r.signature.length > 0 && r.signature.every((x) => nod.has(x.move.id));
  let global = 0;
  let genre = 0;
  for (const i of r.instances) {
    if (i.move.idle || i.move.cooldown || i.section === 'outro' || (i.sig && nodCombo)) continue;
    if (i.move.genre) genre += i.span;
    else global += i.span;
  }
  return { global, genre };
}

/** The combo's name on the NOW card: "Gallop + Lasso", or the first move's name + "combo" when that is too long. */
export function comboName(sig: readonly SigStep[]): string {
  const names: string[] = [];
  for (const s of sig) if (!names.includes(s.move.name)) names.push(s.move.name);
  if (!names.length) return 'Song Combo';
  const both = names.join(' + ');
  if (both.length <= MAX_NAME) return both;
  // Too long: drop the longer name's last words ("Stomp Kick + Hammer Fist") while each keeps a word.
  const words = names.map((n) => n.split(' '));
  const join = () => words.map((w) => w.join(' ')).join(' + ');
  while (join().length > MAX_NAME) {
    let k = -1;
    words.forEach((w, i) => {
      if (w.length > 1 && (k < 0 || w.join(' ').length > words[k].join(' ').length)) k = i;
    });
    if (k < 0) break;
    words[k].pop();
  }
  const short = words.map((w) => w.join(' '));
  if (join().length <= MAX_NAME && new Set(short).size === short.length) return join();
  const one = `${names[0]} Combo`;
  return one.length <= MAX_NAME ? one : 'Song Combo';
}

/** Beat just past the last of `bars`. */
function barsEnd(bars: readonly Bar[]): number {
  const l = bars[bars.length - 1];
  return l.start + l.len;
}

function lastKeyPose(m: Move, mirror: boolean): Pose {
  const k = keysOf(m, mirror);
  return k[k.length - 1].pose;
}

/**
 * Per open genre, the factor that brings its moves to their share of the
 * pick weight: GENRE_SHARE in all, split between the open genres by how
 * strongly the song opens each, measured on the base moves' level-weighted
 * mass (bounded, so a tiny set isn't repeated endlessly).
 */
function genreScale(style: SongStyle, open: ReadonlySet<Genre>, intensity: Intensity, bpm: number | undefined): Map<Genre, number> {
  const out = new Map<Genre, number>();
  if (open.size === 0) return out;
  const mass = new Map<Genre, number>();
  let global = 0;
  for (const m of DANCE_MOVES) {
    if (!genreFits(m, open)) continue;
    const w = styleFactor(m, style) * tempoFactor(m, bpm) * levelFactor(m, intensity);
    if (m.genre) mass.set(m.genre, (mass.get(m.genre) ?? 0) + w);
    else global += w;
  }
  const openness = genreOpenness(style, open);
  let sum = 0;
  for (const g of open) if ((mass.get(g) ?? 0) > 0) sum += openness.get(g) ?? 1;
  for (const g of open) {
    const mg = mass.get(g) ?? 0;
    if (mg <= 0 || sum <= 0) continue;
    const share = (GENRE_SHARE * (openness.get(g) ?? 1)) / sum;
    const k = (share / (1 - GENRE_SHARE)) * (global / mg);
    out.set(g, Math.min(GENRE_SCALE_MAX, Math.max(GENRE_SCALE_MIN, k)));
  }
  return out;
}

/** A move's static weight for a song: style x tempo x its genre set's scale. */
function staticWeight(m: Move, style: SongStyle, bpm: number | undefined, genreK: ReadonlyMap<Genre, number>): number {
  return styleFactor(m, style) * tempoFactor(m, bpm) * (m.genre ? (genreK.get(m.genre) ?? 1) : 1);
}

/**
 * One 8-move-beat combo per song: two 4-beat blocks of different moves. A
 * song's curated `signature` (move ids) supplies the blocks when those moves
 * suit the level (a signature nod belongs to its song, so its genre doesn't
 * matter); otherwise they're picked with the song's style weights, from the
 * moves its genres allow.
 */
function pickSignature(
  rng: () => number, intensity: Intensity, style: SongStyle = BALANCED_POP, open: ReadonlySet<Genre> = styleGenres(style),
  bpm?: number, genreK: ReadonlyMap<Genre, number> = new Map(),
): SigStep[] {
  const fits = (m: Move) => m.beats <= 4 && levelFactor(m, intensity) > 0 && !(m.travel !== 0 && m.beats === 4);
  const pool = DANCE_MOVES.filter((m) => fits(m) && genreFits(m, open) && (m.level !== 'low' || intensity === 'chill'));
  const weight = (m: Move) =>
    (m.level === 'high' ? (intensity === 'chill' ? 0.3 : intensity === 'cardio' ? 1 : 1.8) : 1.2) * (m.beats === 2 ? 2 : 1) * levelFactor(m, intensity) * staticWeight(m, style, bpm, genreK);
  const nods = (style.signature ?? []).map((id) => DANCE_MOVES.find((m) => m.id === id)).filter((m): m is Move => !!m && fits(m));
  const a = nods[0] ?? pickWeighted(rng, pool, pool.map(weight));
  if (!a) return [];
  const rest = pool.filter((m) => m !== a);
  const b = (nods[1] && nods[1] !== a ? nods[1] : null) ?? pickWeighted(rng, rest, rest.map((m) => weight(m) * (1 - 0.7 * partsOverlap(a, m)))) ?? rest[0];
  const steps: SigStep[] = [];
  for (const m of [a, b]) {
    const reps = 4 / m.beats;
    for (let i = 0; i < reps; i++) steps.push({ move: m, mirror: m.mirror ? i % 2 === 1 : false });
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Map -> bars -> routine

/** Bars from downbeats, covering [firstDownbeat, beatCount). */
export function buildBars(beatCount: number, downbeats: readonly number[]): { pickup: number; bars: Bar[] } {
  const db = downbeats.filter((d) => d >= 0 && d < beatCount);
  const starts: number[] = [];
  if (db.length === 0) {
    for (let b = 0; b < beatCount; b += 4) starts.push(b);
  } else {
    // Beats before the first downbeat: whole bars of 4 if there's room, else pickup.
    let first = db[0];
    while (first - 4 >= 0) first -= 4;
    if (first > 0 && first < db[0]) {
      for (let b = first; b < db[0]; b += 4) starts.push(b);
    } else if (first === 0 && db[0] !== 0) {
      for (let b = 0; b < db[0]; b += 4) starts.push(b);
    }
    for (const d of db) if (starts.length === 0 || d > starts[starts.length - 1]) starts.push(d);
  }
  const bars: Bar[] = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = i + 1 < starts.length ? starts[i + 1] : beatCount;
    let len = e - s;
    if (len <= 0) continue;
    // Split over-long gaps (missed downbeats) into 4-beat bars.
    let b = s;
    while (len > 6) {
      bars.push({ start: b, len: 4 });
      b += 4;
      len -= 4;
    }
    if (len > 0) {
      // Merge a 1-beat fragment into the previous bar.
      if (len === 1 && bars.length && bars[bars.length - 1].start + bars[bars.length - 1].len === b) bars[bars.length - 1].len += 1;
      else bars.push({ start: b, len });
    }
  }
  return { pickup: bars.length ? bars[0].start : beatCount, bars };
}

function medianInterval(beats: readonly number[]): number {
  if (beats.length < 2) return 0.5;
  const d: number[] = [];
  for (let i = 1; i < beats.length; i++) d.push(beats[i] - beats[i - 1]);
  d.sort((a, b) => a - b);
  return d[d.length >> 1];
}

export function isHalfTime(bpm: number): boolean {
  return bpm > HALF_TIME_BPM;
}

/** Effective tempo of a map (bpm field, or from the beats). */
export function mapTempo(map: BeatMap): number {
  if (map.bpm > 0 && Number.isFinite(map.bpm)) return map.bpm;
  const iv = medianInterval(map.beats);
  return iv > 0 && Number.isFinite(iv) ? 60 / iv : 120;
}

/** Tempo range the coach can dance to; anything outside is treated as bad data. */
export const MIN_DANCE_BPM = 30;
export const MAX_DANCE_BPM = 300;
/** Longest beat grid accepted from a map (about 30 minutes at 300 BPM). */
export const MAX_MAP_BEATS = 10000;

/** A tempo the coach can dance to (finite, within MIN..MAX_DANCE_BPM). */
export function usableBpm(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= MIN_DANCE_BPM && bpm <= MAX_DANCE_BPM;
}

/**
 * Whether a beat map is sane enough to choreograph: 2..MAX_MAP_BEATS finite,
 * strictly increasing beat times, and a tempo (bpm field when set, and the
 * beats' median interval) the coach can dance to. Callers fall back to the
 * idle groove otherwise.
 */
export function isUsableBeatMap(map: BeatMap | null | undefined): boolean {
  if (!map || !Array.isArray(map.beats)) return false;
  // The play screen asks every frame: answer from the last check while the beats are unchanged.
  const b = map.beats;
  const n = b.length;
  const hit = USABLE.get(map);
  if (hit && hit.beats === b && hit.n === n && hit.first === b[0] && hit.last === b[n - 1] && hit.bpm === map.bpm) return hit.ok;
  const ok = checkBeatMap(map);
  USABLE.set(map, { beats: b, n, first: b[0], last: b[n - 1], bpm: map.bpm, ok });
  return ok;
}

const USABLE = new WeakMap<BeatMap, { beats: readonly number[]; n: number; first: number; last: number; bpm: number | undefined; ok: boolean }>();

function checkBeatMap(map: BeatMap): boolean {
  const b = map.beats;
  const n = b.length;
  if (n < 2 || n > MAX_MAP_BEATS) return false;
  if (typeof b[0] !== 'number' || !Number.isFinite(b[0])) return false;
  for (let i = 1; i < n; i++) {
    const v = b[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= b[i - 1]) return false;
  }
  if (map.bpm !== 0 && map.bpm !== undefined && !usableBpm(map.bpm)) return false;
  return usableBpm(60 / medianInterval(b));
}

interface Run {
  bars: Bar[];
  type: SectionType;
  energy: number;
}

function sectionRuns(map: BeatMap, bars: readonly Bar[]): Run[] {
  const runs: Run[] = [];
  let lastIdx = -2;
  for (const bar of bars) {
    const t = map.beats[bar.start];
    let idx = -1;
    for (let i = 0; i < map.sections.length; i++) {
      const s = map.sections[i];
      if (t >= s.start - 0.05 && t < s.end - 0.05) {
        idx = i;
        break;
      }
    }
    if (idx === -1 && map.sections.length && t >= map.sections[map.sections.length - 1].end - 0.05) idx = map.sections.length - 1;
    const sec = idx >= 0 ? map.sections[idx] : null;
    if (idx !== lastIdx || runs.length === 0) {
      runs.push({ bars: [bar], type: sec?.type ?? 'verse', energy: sec?.energy ?? 0.5 });
      lastIdx = idx;
    } else {
      runs[runs.length - 1].bars.push(bar);
    }
  }
  // Merge tiny runs (< 2 bars) into a neighbour so no section is a fragment.
  for (let i = 0; i < runs.length; i++) {
    if (runs.length > 1 && runs[i].bars.length < 2) {
      if (i > 0) {
        runs[i - 1].bars.push(...runs[i].bars);
      } else {
        runs[1].bars.unshift(...runs[0].bars);
      }
      runs.splice(i, 1);
      i--;
    }
  }
  return runs;
}

/** Whether a map's bar readings line up with its downbeats (one digit per downbeat). */
function barsUsable(map: BeatMap): boolean {
  const b = map.bars;
  const n = map.downbeats?.length ?? 0;
  if (!b || n === 0) return false;
  for (const s of [b.energy, b.bass, b.change]) if (typeof s !== 'string' || s.length !== n || !/^[0-9]*$/.test(s)) return false;
  return Array.isArray(b.drops);
}

/**
 * What the generator knows about each bar. With the map's bar readings, a
 * bar takes the reading of the downbeat it starts at or after (bars before
 * the first downbeat take the first one), its energy smoothed a little
 * toward its section's; a drop counts on the bar that starts on that
 * downbeat. Without them (older maps), every bar of a section gets the
 * section's energy, a moderately steady groove, and drop sections start
 * with a drop.
 */
export function barFeels(map: BeatMap, bars: readonly Bar[], runs: readonly { bars: readonly Bar[]; type: SectionType; energy: number }[]): Map<Bar, BarFeel> {
  const out = new Map<Bar, BarFeel>();
  const data = barsUsable(map);
  const db = map.downbeats;
  const digit = (s: string, k: number) => (s.charCodeAt(k) - 48) / 9;
  const drops = data ? new Set(map.bars!.drops) : null;
  for (const run of runs) {
    run.bars.forEach((bar, i) => {
      if (!data) {
        out.set(bar, { energy: run.energy, bass: run.energy, change: DEFAULT_CHANGE, drop: i === 0 && run.type === 'drop' });
        return;
      }
      // Last downbeat at or before the bar start.
      let lo = 0;
      let hi = db.length - 1;
      let k = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (db[mid] <= bar.start) (k = mid), (lo = mid + 1);
        else hi = mid - 1;
      }
      const b = map.bars!;
      out.set(bar, {
        energy: 0.75 * digit(b.energy, k) + 0.25 * run.energy,
        bass: digit(b.bass, k),
        change: digit(b.change, k),
        drop: db[k] === bar.start && drops!.has(k),
      });
    });
  }
  for (const bar of bars) if (!out.has(bar)) out.set(bar, { energy: 0.5, bass: 0.5, change: DEFAULT_CHANGE, drop: false });
  return out;
}

/** Generate the full routine for a beat map. */
export function generateRoutine(map: BeatMap, intensity: Intensity, opts: RoutineOpts = {}): Routine {
  // Bad data (absurd tempo, non-increasing or non-finite beats): no routine;
  // the conductor dances the idle groove instead.
  const N = isUsableBeatMap(map) ? map.beats.length : 0;
  const half = isHalfTime(mapTempo(map));
  const ch = new Choreographer(map.videoId, intensity, half, opts, mapTempo(map));
  const out: MoveInstance[] = [];
  if (N === 0) return { instances: out, signature: ch.signature, half, beats: 0 };

  const { pickup, bars } = buildBars(N, map.downbeats);
  const firstType = map.sections[0]?.type ?? 'intro';
  if (bars.length === 0) {
    if (pickup > 0) ch.filler(out, 0, pickup, firstType);
    return { instances: out, signature: ch.signature, half, beats: N };
  }

  const runs = sectionRuns(map, bars);
  const phraseBars = half ? 16 : 8;
  const unitBars = ch.unitBars;
  const hasOutro = runs.some((r) => r.type === 'outro');

  // No outro section: cool down over the last few bars of a long enough song.
  if (!hasOutro && bars.length >= 24) {
    const last = runs[runs.length - 1];
    const take = Math.min(half ? 8 : 4, last.bars.length - 2);
    if (take >= 2) {
      const tail = last.bars.splice(last.bars.length - take, take);
      runs.push({ bars: tail, type: 'outro', energy: 0.2 });
    }
  }
  const feel = barFeels(map, bars, runs);
  // A drop in a section's last bars (too few for a move of their own) starts the next section early.
  for (let k = 0; k + 1 < runs.length; k++) {
    const bs = runs[k].bars;
    if (runs[k + 1].type === 'outro') continue;
    for (let j = Math.max(unitBars, bs.length - unitBars + 1); j < bs.length; j++) {
      if (feel.get(bs[j])!.drop) {
        runs[k + 1].bars.unshift(...bs.splice(j));
        break;
      }
    }
  }
  const feelsOf = (bs: readonly Bar[]) => bs.map((b) => feel.get(b)!);

  // 1. Plan the whole song (phrases, holds, kit slots), so the kit's genre
  //    accents can be measured on the danced time before anything is cast.
  const items: ReturnType<Choreographer['plan']> = [];
  const runsOf = new Map<SectionType, number>();
  for (const run of runs) runsOf.set(run.type, (runsOf.get(run.type) ?? 0) + 1);
  const seen = new Map<SectionType, number>();
  let warmedUp = false;
  for (const run of runs) {
    let barsLeft = run.bars.slice();
    let firstPhrase = true;
    const occ = seen.get(run.type) ?? 0;
    seen.set(run.type, occ + 1);
    const last = occ === (runsOf.get(run.type) ?? 1) - 1;
    const isPeak = run.type === 'chorus' || run.type === 'drop';
    const cooldown = run.type === 'outro';
    const typical = targetVigour(feelsOf(run.bars), run.type);
    // Warm-up: the song's first few bars stay gentle (unless it's already intro/outro).
    if (!warmedUp) {
      warmedUp = true;
      if (run.type !== 'intro' && !cooldown && barsLeft.length >= unitBars * 2 + 2) {
        const w = barsLeft.splice(0, unitBars * 2);
        items.push(...ch.plan(w, { section: run.type, energy: run.energy, warmup: true, memoKey: 'warmup', feels: feelsOf(w) }));
      }
    }
    while (barsLeft.length > 0) {
      let take = Math.min(phraseBars, barsLeft.length);
      if (barsLeft.length - take > 0 && barsLeft.length - take < unitBars) take = barsLeft.length;
      // A drop starts a new phrase (so its hold can run a whole phrase).
      for (let j = unitBars; j < take; j++) {
        if (feel.get(barsLeft[j])!.drop) {
          take = j;
          break;
        }
      }
      const pb = barsLeft.slice(0, take);
      barsLeft = barsLeft.slice(take);
      const pf = feelsOf(pb);
      // An intro warms up in its first phrase; a drop inside a (long) intro
      // means the song has properly started: dance it like a verse.
      const introDrop = run.type === 'intro' && !firstPhrase && !!pf[0]?.drop;
      items.push(...ch.plan(pb, {
        section: introDrop ? 'verse' : run.type,
        energy: run.energy,
        warmup: run.type === 'intro' && firstPhrase,
        cooldown,
        signature: isPeak && firstPhrase,
        // A drop opens with one unit of the combo, then gets to the heavy move.
        sigUnits: intensity === 'chill' ? 1 : run.type === 'drop' || pf[0]?.drop ? 1 : 2,
        memoKey: run.type,
        occ,
        last,
        typical,
        feels: pf,
      }));
      firstPhrase = false;
    }
  }
  // 2. The kit's genre accents; 3. dance it, casting each kit move on first use.
  ch.link(items);
  ch.assignGenres(items);
  for (const it of items) ch.emit(out, it);
  // 4. The hard rule: no card under a bar / MIN_CARD_SEC (the pickup before the
  //    first bar becomes a lead-in of the first move, leftovers parts of moves).
  if (pickup > 0) out.unshift({ move: IDLE_MOVE, mirror: false, start: 0, span: pickup, half: false, origin: 0, section: firstType, sig: false, unitStart: false, phrase: -1, fill: true });
  const drops = new Set<number>();
  for (const b of bars) if (feel.get(b)!.drop) drops.add(b.start);
  const instances = enforceCards(out, { times: map.beats, bars: bars.map((b) => b.start), drops, mult: half ? 2 : 1 });
  // 5. No dash across the floor from one move into the next.
  smoothSteps(instances, map.beats);
  return { instances, signature: ch.signature, half, beats: N, times: map.beats };
}

// ---------------------------------------------------------------------------
// Live planning

const LIVE_CYCLE: readonly { type: SectionType; energy: number }[] = [
  { type: 'verse', energy: 0.45 },
  { type: 'verse', energy: 0.55 },
  { type: 'chorus', energy: 0.8 },
];

/**
 * Extends a routine phrase by phrase while beats arrive. No sections are
 * known, so it uses a repeating verse / verse / chorus cycle at medium
 * intensity (the chorus phrases are the "bigger" ones and open with the
 * signature combo).
 */
/** Live planning work bound per extend() call (bad tempo data can't run away). */
const MAX_EXTEND_BEATS = 512;

export class LivePlanner {
  readonly half: boolean;
  private ch: Choreographer;
  private nextBeat: number;
  private k = 0;

  constructor(seedKey: string, intensity: Intensity, bpm: number, startBeat: number, opts: RoutineOpts = {}) {
    this.half = isHalfTime(bpm);
    // The level still sets difficulty; the verse/verse/chorus cycle keeps the
    // exertion at a medium level with periodic bigger phrases.
    this.ch = new Choreographer(`${seedKey}|live`, intensity, this.half, opts, bpm);
    this.ch.liveGenres = true;
    this.nextBeat = startBeat;
  }

  get signature(): readonly SigStep[] {
    return this.ch.signature;
  }

  /** Beat index where the next phrase will start. */
  get end(): number {
    return this.nextBeat;
  }

  /** Append phrases until the plan covers `untilBeat` (at most MAX_EXTEND_BEATS per call). */
  extend(out: MoveInstance[], untilBeat: number): void {
    const limit = Math.min(untilBeat, this.nextBeat + MAX_EXTEND_BEATS);
    while (this.nextBeat < limit) {
      const barLen = 4;
      const warm = this.k === 0;
      const nBars = warm ? (this.half ? 8 : 4) : this.half ? 16 : 8;
      const bars: Bar[] = [];
      for (let i = 0; i < nBars; i++) bars.push({ start: this.nextBeat + i * barLen, len: barLen });
      const c = LIVE_CYCLE[(this.k + 2) % LIVE_CYCLE.length];
      // Each cycle of the verse / verse / chorus loop counts as a new section run (motifs develop, choruses intensify).
      const occ = Math.floor((this.k + 2) / LIVE_CYCLE.length);
      this.ch.phrase(out, bars, warm
        ? { section: 'intro', energy: 0.3, warmup: true }
        : { section: c.type, energy: c.energy, signature: c.type === 'chorus', memoKey: c.type === 'chorus' ? 'chorus' : 'live-verse', occ });
      this.nextBeat += nBars * barLen;
      this.k++;
    }
  }
}
