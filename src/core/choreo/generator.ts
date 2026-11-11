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
 *   song's signature combo (one 8-beat sequence). The start warms up with a
 *   gentle move, the outro cools down. Above ~150 BPM every move is
 *   performed at half time (1 move beat = 2 song beats); phrases, holds and
 *   units double so they stay musically aligned.
 *
 * The music drives the phrasing (see "Phrasing" below): per-bar readings
 * from the beat map (energy, bass, groove change, drops; section energy for
 * older maps) decide how long each move is held (steady, loud passages and
 * drops hold longest; passages that keep changing switch sooner) and lean
 * the pick toward vigorous moves in loud, bassy bars and gentle ones in soft
 * bars. Each section type keeps a small palette of recurring moves.
 *
 * Levels (shown to the user as Easy / Medium / Hard):
 *   chill  (Easy):   difficulty-1 moves only, 4-bar units (a move lasts 4-8
 *                    bars), a palette of 2 moves per section type, no jumps.
 *   cardio (Medium): difficulty 1-2, 2-bar units, palettes of 3.
 *   sweaty (Hard):   all difficulties (favouring coordinated moves), shorter
 *                    holds on average, palettes of 4, more high-impact moves.
 *
 * Live mode (no sections known) uses LivePlanner: the same phrase logic with
 * a repeating verse / verse / chorus phrase cycle.
 *
 * Song style (songStyle.ts) weights the pick on top of section energy and
 * level: moves of the song's families (~60-70 % of picks), its focus and its
 * title themes are favoured, never to the point of emptying the pool. The
 * pool is the catalogue plus validated variations (pool.ts): Easy sees few
 * (simple ones), Hard the most. A fresh pick doesn't come back within
 * NO_REPEAT_PHRASES phrases (palette moves aside). The seed is
 * videoId + level + style; 'fresh' routines add a play counter, but the
 * chorus combo (signature) keeps the stable seed. Songs with a curated
 * `signature` build the chorus combo from those moves.
 */

import type { BeatMap, SectionType } from '../analysis/beatmap';
import { CH, type Pose } from '../coach/skeleton';
import { FAMILIES, THEME_TRADITIONS, TRADITION_BY_ID, TRADITION_FILES, TRADITION_THEMES, type Theme, type Tradition } from './families';
import { IDLE_MOVE, MOVES, findMove, keysOf, type Level, type Move } from './moves';
import { getPool } from './pool';
import { BALANCED_POP, styleKey, type SongStyle } from './songStyle';

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

/** Phrases a move stays out after it was used (section memos aside). */
export const NO_REPEAT_PHRASES = 3;
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
// Specialty moves
//
// A specialty move's identity belongs to one dance tradition (a folk dance,
// Bollywood, afrobeats, country, swing, salsa ...). It carries a tradition
// theme (families.ts TRADITION_THEMES), is listed in TRADITION_BY_ID, or
// comes from a tradition file (world / retro / afro). Its family tags only
// say what it can sit next to, so they don't make it eligible: a specialty
// move is used only when the song's style opens one of its traditions (a
// matching theme, or for latin steps a latin-led family mix). Ordinary moves
// that merely carry a secondary family tag are unaffected.

/** Latin traditional steps open when latin is at least this share of the song's top family weight. */
const LATIN_HOME_SHARE = 0.8;
/** Distinct non-matching specialty moves a routine may still use ("spice"), per level. */
export const SPICE_ALLOWANCE: Readonly<Record<Intensity, number>> = { chill: 0, cardio: 0, sweaty: 1 };
/** Weight factor of a spice candidate (relative to its style weight). */
const SPICE_WEIGHT = 0.3;

const SPECIALTY = new Map<string, readonly Tradition[]>();

/** Traditions of a move ([] = an ordinary move). Variations and ornaments share their base move's. */
export function specialtyOf(m: Move): readonly Tradition[] {
  const hit = SPECIALTY.get(m.id);
  if (hit) return hit;
  const base = m.base !== m.id ? findMove(m.base) : undefined;
  const set = new Set<Tradition>();
  for (const x of base ? [m, base] : [m]) {
    for (const t of x.themes) if (TRADITION_THEMES.includes(t)) set.add(t as Tradition);
    for (const t of TRADITION_BY_ID[x.id] ?? []) set.add(t);
  }
  if (set.size === 0 && TRADITION_FILES.has(base?.file ?? m.file)) set.add('folk');
  const out = [...set].sort();
  SPECIALTY.set(m.id, out);
  return out;
}

/**
 * Afro-Caribbean themes: their genre / artist styles use the latin family as
 * a stand-in for hip-led grooves, so it doesn't open salsa / bachata steps.
 */
const LATIN_PROXY_THEMES: readonly Theme[] = ['afro', 'amapiano', 'dancehall', 'reggae', 'soca'];

/** Traditions a song's style opens: its tradition themes, plus latin steps for a latin-led mix. */
export function styleTraditions(style: SongStyle): ReadonlySet<Tradition> {
  const s = new Set<Tradition>();
  for (const t of style.themes) for (const x of THEME_TRADITIONS[t] ?? []) s.add(x);
  let max = 0;
  for (const f of FAMILIES) max = Math.max(max, style.families[f] ?? 0);
  const latinLed = max > 0 && (style.families.latin ?? 0) >= LATIN_HOME_SHARE * max;
  if (latinLed && !style.themes.some((t) => LATIN_PROXY_THEMES.includes(t))) s.add('latin');
  return s;
}

/** Whether a move suits a song with these open traditions (ordinary moves always do). */
export function specialtyFits(m: Move, open: ReadonlySet<Tradition>): boolean {
  const tr = specialtyOf(m);
  return tr.length === 0 || tr.some((t) => open.has(t));
}

/** Weight factor of a specialty move whose tradition the song's themes ask for (so it shows prominently). */
const THEME_MATCH_BOOST = 5;
/** ... and of a latin traditional step in a latin-led song (plenty of latin grooves compete already). */
const LATIN_MATCH_BOOST = 1.5;

/** Extra weight of a matching specialty move (1 for ordinary or non-matching moves). */
export function traditionBoost(m: Move, open: ReadonlySet<Tradition>): number {
  const tr = specialtyOf(m);
  if (tr.length === 0) return 1;
  if (tr.some((t) => t !== 'latin' && open.has(t))) return THEME_MATCH_BOOST;
  return tr.includes('latin') && open.has('latin') ? LATIN_MATCH_BOOST : 1;
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

function pickWeighted<T>(rng: () => number, items: readonly T[], weights: readonly number[]): T | null {
  let sum = 0;
  for (const w of weights) sum += w > 0 ? w : 0;
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

/** Difficulty mix per level (0 = not allowed). */
function difficultyFactor(m: Move, intensity: Intensity): number {
  const d = m.difficulty;
  if (intensity === 'chill') return d === 1 ? 1 : 0;
  if (intensity === 'cardio') return d === 1 ? 0.8 : d === 2 ? 1.2 : 0;
  return d === 1 ? 0.45 : d === 2 ? 1 : 1.6;
}

/** Bars per unit (one move repeated) for a level. */
export function unitBarsFor(intensity: Intensity, half: boolean): number {
  const base = intensity === 'chill' ? 4 : 2;
  return half ? base * 2 : base;
}

function intensityFactor(m: Move, intensity: Intensity): number {
  if (difficultyFactor(m, intensity) <= 0) return 0;
  if (m.fastTurn && intensity === 'chill') return 0;
  if (m.jump) return intensity === 'chill' ? 0 : intensity === 'cardio' ? 0.7 : 1.5;
  const df = intensity === 'chill' ? 1 : difficultyFactor(m, intensity);
  if (m.impact) return (intensity === 'chill' ? 0.35 : intensity === 'cardio' ? 1 : 1.5) * df;
  return df;
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

/** Base moves + variations (variations get a per-level share). */
function dancePool(useVariations: boolean): { moves: readonly Move[]; isVar: Uint8Array } {
  const vars = useVariations ? getPool().variations.map(withShortName) : [];
  const moves = [...DANCE_MOVES, ...vars];
  const isVar = new Uint8Array(moves.length);
  for (let i = DANCE_MOVES.length; i < moves.length; i++) isVar[i] = 1;
  return { moves, isVar };
}

function partsOverlap(a: Move, b: Move): number {
  let inter = 0;
  for (const p of a.parts) if (b.parts.includes(p)) inter++;
  const union = a.parts.length + b.parts.length - inter;
  return union ? inter / union : 0;
}

/** How awkward is going from the end of `prev` into the start of `next`? */
export function transitionCost(prev: Pose, next: Pose): number {
  let arms = 0;
  for (let c = CH.RA_E; c <= CH.LF_P; c++) {
    let d = Math.abs(next[c] - prev[c]) % 360;
    if (d > 180) d = 360 - d;
    arms += d;
  }
  const feet =
    Math.abs(next[CH.RFT_X] - prev[CH.RFT_X]) + Math.abs(next[CH.LFT_X] - prev[CH.LFT_X]) +
    Math.abs(next[CH.RFT_Y] - prev[CH.RFT_Y]) + Math.abs(next[CH.LFT_Y] - prev[CH.LFT_Y]);
  const vert = Math.abs(next[CH.Y] - prev[CH.Y]);
  // Facing: entering / leaving a turned key swings the whole body round.
  let spin = Math.abs(next[CH.SPIN] - prev[CH.SPIN]) % 360;
  if (spin > 180) spin = 360 - spin;
  return (arms / 180) * 0.35 + feet * 4 + vert * 3 + (spin / 90) * 1.5;
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
}

type UnitChoice = { kind: 'move'; move: Move } | { kind: 'sig' };

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
// Each section type keeps a small palette of moves per vibe tier (soft /
// medium / heavy target vigour; 2-4 moves by level, one more for restless
// passages) that recur, with an ornamented / variation version
// now and then; a few one-off picks keep it from looping. Long holds switch
// to a variation of the same move half-way, so they aren't a frozen loop.
// Move choice leans on the bars' energy + bass: loud, bassy bars and drops
// favour vigorous moves (jumps, big arms, headbangs, within the level's
// rules), soft bars gentle ones (vigourTilt).

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
/** Target vigour at / above which a hold draws on the section's heavy palette; at / below, its soft one. */
const PALETTE_HEAVY = 0.62;
const PALETTE_SOFT = 0.38;
/** Weight factor of a first move that can also fill the pickup. */
const PICKUP_FIT_BOOST = 4;
/** Moves per palette. */
const PALETTE_SIZE: Record<Intensity, number> = { chill: 2, cardio: 3, sweaty: 4 };
/** Chance a hold adds a new palette move while the palette isn't full (a second one always joins). */
const PALETTE_GROW_P = 0.35;
/** Chance a hold is a one-off pick (not from the palette). */
const ONE_OFF_P: Record<Intensity, number> = { chill: 0.04, cardio: 0.12, sweaty: 0.2 };
/** Weight of the palette's first (main) move. */
const MAIN_MOVE_BIAS = 1.6;
/** Chance a recurring move comes back as a variation of itself. */
const REPEAT_VARIANT_P: Record<Intensity, number> = { chill: 0.1, cardio: 0.3, sweaty: 0.45 };
/** Chance a long hold (a whole phrase) switches to a variation half-way. */
const MID_VARIANT_P: Record<Intensity, number> = { chill: 0.3, cardio: 0.6, sweaty: 0.7 };

const VIGOUR = new Map<Move, number>();
let VIGOUR_REF: { motion: Float64Array; raw: Float64Array } | null = null;

const angleDelta = (a: number, b: number) => {
  let d = Math.abs(b - a) % 360;
  return d > 180 ? 360 - d : d;
};

/** How much a move moves per beat: limbs, feet, bounce, torso and head over its loop. */
function moveMotion(m: Move): number {
  const keys = m.keys;
  if (keys.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i].pose;
    const b = keys[(i + 1) % keys.length].pose;
    sum += transitionCost(a, b);
    sum += ((angleDelta(a[CH.LEAN], b[CH.LEAN]) + angleDelta(a[CH.TWIST], b[CH.TWIST]) + angleDelta(a[CH.BEND], b[CH.BEND]) +
      angleDelta(a[CH.HEAD_NOD], b[CH.HEAD_NOD]) + angleDelta(a[CH.HEAD_ROLL], b[CH.HEAD_ROLL])) / 90) * 0.5;
    sum += Math.abs(b[CH.HIPS] - a[CH.HIPS]) * 3;
  }
  return sum / m.beats;
}

function rawVigour(m: Move, motionPct: number): number {
  const level = m.level === 'high' ? 1 : m.level === 'mid' ? 0.5 : 0;
  return 0.45 * level + 0.35 * motionPct + 0.2 * (m.jump ? 1 : m.impact ? 0.6 : 0);
}

function rankIn(sorted: Float64Array, v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  let up = lo;
  while (up < sorted.length && sorted[up] === v) up++;
  return sorted.length > 1 ? (lo + up - 1) / 2 / (sorted.length - 1) : 0.5;
}

/**
 * How vigorous a move looks, 0 (gentle) .. 1 (all-out), as a percentile among
 * the catalogue's dance moves: its level, how much it moves per beat, and
 * jumps / squats.
 */
export function moveVigour(m: Move): number {
  const hit = VIGOUR.get(m);
  if (hit !== undefined) return hit;
  if (!VIGOUR_REF) {
    const motion = Float64Array.from(DANCE_MOVES.map(moveMotion)).sort();
    const raw = Float64Array.from(DANCE_MOVES.map((x) => rawVigour(x, rankIn(motion, moveMotion(x))))).sort();
    VIGOUR_REF = { motion, raw };
  }
  const v = rankIn(VIGOUR_REF.raw, rawVigour(m, rankIn(VIGOUR_REF.motion, moveMotion(m))));
  VIGOUR.set(m, v);
  return v;
}

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

export class Choreographer {
  readonly signature: SigStep[];
  readonly half: boolean;
  readonly unitBars: number;
  private rng: () => number;
  private intensity: Intensity;
  private lastMove: Move | null = null;
  private lastMirror = false;
  private recent: Move[] = [];
  /** Palettes: the few moves a section type keeps coming back to, per vibe tier. */
  private palettes = new Map<string, Move[]>();
  /** Base moves already danced (a recurring one may come back as a variation). */
  private used = new Set<Move>();
  /** Variations in the pool, by base move id. */
  private varsByBase = new Map<string, Move[]>();
  private phraseNo = 0;
  /** Beats before the first bar (set by generateRoutine; the first pick prefers a move that fits them). */
  pickupBeats = 0;
  readonly style: SongStyle;
  private pool: readonly Move[];
  /** Per-move static weight: style x variation share (index-aligned with pool). */
  private base: Float64Array;
  /** Phrase number each move was last used in. */
  private lastUsed = new Map<Move, number>();
  private ornaments: { get(base: string): readonly Move[] } | null;
  /** Specialty moves of traditions the song doesn't open (excluded, spice aside). */
  private outside = new Set<Move>();
  /** Base ids of the spice moves used so far. */
  private spiced: string[] = [];
  /** In-place 1- and 2-beat moves for gaps, with their style weights. */
  private gapMoves: Move[] = [];
  private gapW: number[] = [];

  constructor(seedKey: string, intensity: Intensity, half: boolean, opts: RoutineOpts = {}) {
    this.intensity = intensity;
    this.half = half;
    this.unitBars = unitBarsFor(intensity, half);
    this.style = opts.style ?? BALANCED_POP;
    const sk = styleKey(this.style);
    const fresh = opts.fresh !== undefined && opts.fresh > 0 ? `|play${opts.fresh}` : '';
    this.rng = mulberry32(hashString(`${seedKey}|${intensity}|${sk}${fresh}`));
    const useVars = opts.variations !== false;
    const { moves, isVar } = dancePool(useVars);
    this.pool = moves;
    const orn = useVars ? getPool().ornaments : null;
    this.ornaments = orn ? { get: (id: string) => orn.get(id).map(withShortName) } : null;
    // Variations as a share of the picks (there are many more of them than base moves).
    // Variations get VARIATION_SHARE of the total (style x level) weight mass.
    this.base = new Float64Array(moves.length);
    const open = styleTraditions(this.style);
    let mb = 0, mv = 0;
    for (let i = 0; i < moves.length; i++) {
      this.base[i] = styleFactor(moves[i], this.style) * traditionBoost(moves[i], open);
      if (!specialtyFits(moves[i], open)) {
        this.outside.add(moves[i]);
        continue;
      }
      const w = this.base[i] * intensityFactor(moves[i], intensity);
      if (isVar[i]) mv += w;
      else mb += w;
    }
    const share = VARIATION_SHARE[intensity];
    const vw = mv > 0 ? (share / (1 - share)) * (mb / mv) : 0;
    for (let i = 0; i < moves.length; i++) {
      if (!isVar[i]) continue;
      this.base[i] *= vw;
      const m = moves[i];
      if (this.outside.has(m) || intensityFactor(m, intensity) <= 0) continue;
      const list = this.varsByBase.get(m.base);
      if (list) list.push(m);
      else this.varsByBase.set(m.base, [m]);
    }
    for (const m of DANCE_MOVES) {
      if (m.beats > 2 || m.travel !== 0 || this.outside.has(m) || intensityFactor(m, intensity) <= 0) continue;
      this.gapMoves.push(m);
      this.gapW.push(styleFactor(m, this.style) * traditionBoost(m, open) * intensityFactor(m, intensity) * (m.beats === 1 ? 2 : 1));
    }
    // The chorus combo keeps the stable seed (same in 'fresh' mode).
    this.signature = pickSignature(mulberry32(hashString(`${seedKey}|sig|${intensity}|${sk}`)), intensity, this.style, open);
  }

  /**
   * Fill `bars` (contiguous, one phrase) with holds: the signature combo
   * first when asked, then holds on the phrase's own grid (planHolds), each
   * one move (pickHold) repeated in units.
   */
  phrase(out: MoveInstance[], bars: readonly Bar[], o: PhraseOpts): void {
    if (bars.length === 0) return;
    const unitBars = this.unitBars;
    const phraseNo = this.phraseNo++;
    const flat: BarFeel = { energy: o.energy, bass: o.energy, change: DEFAULT_CHANGE, drop: false };
    const feels = o.feels && o.feels.length === bars.length ? o.feels : bars.map(() => flat);
    let from = 0;
    if (o.signature && this.signature.length) {
      let take = Math.min(bars.length, Math.max(1, o.sigUnits ?? (this.intensity === 'chill' ? 1 : 2)) * unitBars);
      if (bars.length - take < unitBars) take = bars.length;
      for (const ub of this.units(bars.slice(0, take))) this.fillUnit(out, ub[0].start, barsEnd(ub), { kind: 'sig' }, o.section, phraseNo);
      from = take;
    }
    if (from >= bars.length) return;
    const calm = !!(o.warmup || o.cooldown);
    for (const h of this.planHolds(feels, from, o)) {
      const hb = bars.slice(h.a, h.a + h.len);
      const hf = feels.slice(h.a, h.a + h.len);
      const t = targetVigour(hf, o.section, o.warmup);
      const move = o.cooldown ? this.choose(o, null, false, t) : this.pickHold(o, t, hf);
      this.emitHold(out, hb, move, o, phraseNo, h.a + h.len === bars.length && !calm);
    }
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
        if (this.rng() < 1 / (1 + Math.exp(-x))) {
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
   * The move for one hold: usually one of the section type's palette moves
   * (leaning toward the hold's target vigour, the main move favoured); while
   * the palette grows, or now and then as a one-off, a fresh pick. A move
   * coming back may return as a variation of itself.
   */
  private pickHold(o: PhraseOpts, target: number, feels: readonly BarFeel[]): Move {
    const prev = this.lastMove;
    const drop = feels[0]?.drop ?? false;
    const t = drop ? Math.min(1, target + TARGET_DROP) : target;
    // One palette per section type and vibe (soft / medium / heavy passages).
    const tier = t >= PALETTE_HEAVY ? 'heavy' : t <= PALETTE_SOFT ? 'soft' : 'mid';
    const key = `${o.memoKey ?? o.section}|${tier}`;
    let pal = this.palettes.get(key);
    if (!pal) this.palettes.set(key, (pal = []));
    const restless = mean(feels, (f) => f.change) > 0.6 ? 1 : 0;
    const size = PALETTE_SIZE[this.intensity] + restless;
    const main = pal[0];
    const cands = pal.filter((m) => m !== prev && (!prev || m.base !== prev.base) && this.allowed(m, o));
    const grow = pal.length < size && (pal.length < 2 || this.rng() < PALETTE_GROW_P);
    let move: Move | null = null;
    let oneOff = false;
    if (!grow && cands.length) {
      oneOff = this.rng() < ONE_OFF_P[this.intensity];
      if (!oneOff) move = pickWeighted(this.rng, cands, cands.map((m) => vigourTilt(m, t) * (m === main ? MAIN_MOVE_BIAS : 1)));
    }
    if (!move) {
      // Fresh pick, kept apart from the palette's moves.
      const n = this.recent.length;
      this.recent.push(...pal);
      move = this.choose(o, prev, oneOff, t);
      this.recent.length = n;
      if (!oneOff && pal.length < size && !pal.includes(move)) pal.push(move);
    }
    const again = this.used.has(move);
    this.used.add(move);
    if (again && this.rng() < REPEAT_VARIANT_P[this.intensity]) {
      const v = this.variantOf(move, o);
      if (v && v !== prev) return v;
    }
    return move;
  }

  /** A variation of `m` (an ornamented version or a pool variation of its base) allowed here, or null. */
  private variantOf(m: Move, o: PhraseOpts): Move | null {
    const list: Move[] = [];
    for (const v of this.ornaments?.get(m.id) ?? []) {
      const type = v.id.slice(v.id.lastIndexOf('~') + 1);
      if ((type === 'hips' || type === 'diag') && intensityFactor(v, this.intensity) > 0) list.push(v);
    }
    for (const v of this.varsByBase.get(m.base) ?? []) if (v !== m && this.allowed(v, o)) list.push(v);
    return list.length ? list[Math.floor(this.rng() * list.length)] : null;
  }

  /**
   * One hold: `move` repeated over the hold's units. A whole-phrase hold
   * may switch to a variation of the move half-way; a hold ending the phrase
   * may close with a flourish.
   */
  private emitHold(out: MoveInstance[], bars: readonly Bar[], move: Move, o: PhraseOpts, phraseNo: number, phraseEnd: boolean): void {
    const units = this.units(bars);
    const n = units.length;
    const calm = !!(o.warmup || o.cooldown);
    let second = move;
    const longHold = bars.length >= (this.half ? 16 : 8);
    if (!calm && longHold && n >= 2 && this.rng() < MID_VARIANT_P[this.intensity]) second = this.variantOf(move, o) ?? move;
    for (let u = 0; u < n; u++) {
      const m = u >= Math.ceil(n / 2) ? second : move;
      const flourish = phraseEnd && u === n - 1 && n > 1 ? this.ornament(m, ['spin', 'hit4', 'clap4'], FLOURISH_P[this.intensity]) : null;
      this.fillUnit(out, units[u][0].start, barsEnd(units[u]), { kind: 'move', move: m }, o.section, phraseNo, flourish, calm);
    }
    this.lastUsed.set(move, phraseNo);
    this.lastUsed.set(second, phraseNo);
  }

  /**
   * Fill a short gap [start, end) (a pickup, an odd bar's spare beat, what a
   * move's length doesn't divide) with an in-place 1- or 2-beat move of the
   * song's style, repeated, then a 1-beat move for any odd beat. Never the
   * idle groove: that is only for "no beats yet" / pre-lock plans.
   */
  filler(out: MoveInstance[], start: number, end: number, section: SectionType, unitStart = false, phrase = -1, calm = false): void {
    let b = start;
    let first = unitStart;
    let tries = 0;
    while (b < end && tries++ < 8) {
      const r = end - b;
      // Half time: a 1-beat move over 2 song beats when there's room.
      const mult = this.half && r >= 2 ? 2 : 1;
      const prev = this.lastMove;
      const w = this.gapMoves.map((m, i) => {
        if (m.beats * mult > r || m === prev) return 0;
        if (calm && m.level !== 'low') return 0;
        if (!calm && m.level === 'high' && this.intensity !== 'sweaty') return 0;
        let x = this.gapW[i];
        // Moves that share the neighbour's family and body parts blend in best.
        if (prev && !prev.idle) {
          if (m.families[0] && prev.families.includes(m.families[0])) x *= 2;
          x *= 0.5 + partsOverlap(prev, m);
        }
        return x;
      });
      const g = pickWeighted(this.rng, this.gapMoves, w) ?? this.gapMoves.find((m) => m.beats === 1 && m !== prev) ?? null;
      if (!g) break;
      const span = g.beats * mult;
      const reps = Math.max(1, Math.floor(r / span));
      for (let k = 0; k < reps && b + span <= end; k++) {
        const mirror = g.mirror ? k % 2 === 1 : false;
        out.push({ move: g, mirror, start: b, span, half: mult === 2, origin: 0, section, sig: false, unitStart: first, phrase, fill: true });
        first = false;
        b += span;
        this.lastMove = g;
        this.lastMirror = mirror;
      }
    }
    // Last resort (no gap move fits at all): the groove.
    for (; b < end; b++) {
      out.push({ move: IDLE_MOVE, mirror: false, start: b, span: 1, half: false, origin: 0, section, sig: false, unitStart: first, phrase, fill: true });
      first = false;
      this.lastMove = IDLE_MOVE;
      this.lastMirror = false;
    }
  }

  /**
   * The beats before the first bar (a pickup): the first move itself when it
   * fits them exactly, so the NOW card doesn't flicker through fillers in
   * the song's first second, else one calm 1-beat move repeated.
   */
  pickup(n: number, first: MoveInstance | undefined, section: SectionType): MoveInstance[] {
    const out: MoveInstance[] = [];
    if (n <= 0) return out;
    const mult = this.half ? 2 : 1;
    const m0 = first && !first.sig && !first.move.idle && !first.move.cooldown ? first.move : null;
    const base = { origin: 0, section, sig: false, unitStart: false, phrase: -1, fill: true };
    if (m0 && m0.travel === 0 && m0.beats <= 2 && n % (m0.beats * mult) === 0) {
      const span = m0.beats * mult;
      const reps = n / span;
      // Alternate sides so the last pickup instance leads into the first unit's.
      for (let k = 0; k < reps; k++) out.push({ ...base, move: m0, mirror: m0.mirror && (reps - k) % 2 === 1, start: k * span, span, half: this.half });
      return out;
    }
    const w = this.gapMoves.map((m, i) => (m.beats === 1 && m.level === 'low' ? this.gapW[i] : 0));
    const g = pickWeighted(this.rng, this.gapMoves, w) ?? this.gapMoves.find((m) => m.beats === 1) ?? IDLE_MOVE;
    for (let b = 0; b < n; b++) out.push({ ...base, move: g, mirror: g.mirror && (n - b) % 2 === 1, start: b, span: 1, half: false });
    return out;
  }

  /**
   * May a specialty move the song doesn't open be picked now, as the
   * routine's spice? Only for Hard's one-off third move of a phrase (never
   * the chorus combo, a section memo, the warm-up or the cool-down), and only
   * SPICE_ALLOWANCE distinct moves per routine; a spice move is not reused.
   */
  private spiceOk(m: Move, o: PhraseOpts, slot: boolean): boolean {
    if (!slot || o.cooldown || o.warmup) return false;
    return !this.spiced.includes(m.base) && this.spiced.length < SPICE_ALLOWANCE[this.intensity];
  }

  private allowed(m: Move, o: PhraseOpts): boolean {
    if (o.cooldown) return COOLDOWN_MOVES.includes(m) && (m.cooldown || intensityFactor(m, this.intensity) > 0);
    if (m.cooldown || m.idle) return false;
    if (this.outside.has(m)) return false;
    if (intensityFactor(m, this.intensity) <= 0) return false;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, o.energy);
    return lw[m.level] > 0;
  }

  private choose(o: PhraseOpts, avoid: Move | null, spiceSlot = false, target = o.energy): Move {
    const pool = o.cooldown ? COOLDOWN_MOVES : this.pool;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, target);
    const tilt = !o.cooldown && !o.warmup;
    const prev = this.lastMove;
    const prevPose = prev ? lastKeyPose(prev, this.lastMirror) : null;
    const phrase = this.phraseNo;
    const weights = pool.map((m, i) => {
      if (m === avoid) return 0;
      if (m === prev) return 0; // no repeat across a hold boundary
      let w = o.cooldown ? (m.cooldown || intensityFactor(m, this.intensity) > 0 ? 1 : 0) : lw[m.level] * intensityFactor(m, this.intensity) * this.base[i];
      if (w <= 0) return 0;
      if (!o.cooldown && this.outside.has(m)) {
        if (!this.spiceOk(m, o, spiceSlot)) return 0;
        w *= SPICE_WEIGHT;
      }
      // Not again within NO_REPEAT_PHRASES phrases; other versions of the same base move rarely.
      const used = this.lastUsed.get(m);
      if (!o.cooldown && used !== undefined && phrase - used <= NO_REPEAT_PHRASES) return 0;
      // Calm flows (cooldown file) suit warm-ups, intros and quiet passages.
      if (!o.cooldown && m.file === 'cooldown' && (o.warmup || o.energy < 0.35)) w *= 2.5;
      if (avoid && m.base === avoid.base) w *= 0.1;
      if (prev && m.base === prev.base) w *= 0.1;
      if (this.recent.includes(m)) w *= 0.15;
      if (prev && !prev.idle) w *= 1 - 0.6 * partsOverlap(prev, m);
      if (avoid) w *= 1 - 0.5 * partsOverlap(avoid, m);
      if (prevPose) w *= Math.exp(-0.9 * transitionCost(prevPose, keysOf(m, false)[0].pose));
      // The very first move also covers the pickup when it fits it (one NOW card for the song's first bar).
      if (!prev && this.pickupBeats > 0 && m.travel === 0 && m.beats <= 2 && this.pickupBeats % (m.beats * (this.half ? 2 : 1)) === 0) w *= PICKUP_FIT_BOOST;
      // Energy -> vigour (Easy: never pushes squats up).
      if (tilt) w *= this.intensity === 'chill' && m.impact ? Math.min(1, vigourTilt(m, target)) : vigourTilt(m, target);
      return w;
    });
    const picked = pickWeighted(this.rng, pool, weights);
    if (picked) {
      if (!o.cooldown && this.outside.has(picked) && !this.spiced.includes(picked.base)) this.spiced.push(picked.base);
      return picked;
    }
    // Everything excluded (tiny pools): relax to anything allowed but `prev`.
    const fallback = pool.filter((m) => m !== prev && m !== avoid && !this.outside.has(m) && (o.cooldown || intensityFactor(m, this.intensity) > 0));
    return fallback.length ? fallback[Math.floor(this.rng() * fallback.length)] : pool[0];
  }

  /** An ornamented version of `m` of one of the given types, or null. */
  private ornament(m: Move, types: readonly string[], p: number): Move | null {
    if (p <= 0 || this.rng() >= p) return null;
    const list = (this.ornaments?.get(m.id) ?? []).filter((v) => types.includes(v.id.slice(v.id.lastIndexOf('~') + 1)) && intensityFactor(v, this.intensity) > 0);
    return list.length ? list[Math.floor(this.rng() * list.length)] : null;
  }

  private fillUnit(out: MoveInstance[], start: number, end: number, choice: UnitChoice, section: SectionType, phrase: number, flourish: Move | null = null, calm = false): void {
    const mult = this.half ? 2 : 1;
    let b = start;
    let first = true;
    const push = (move: Move, mirror: boolean, origin: number, sig: boolean) => {
      out.push({ move, mirror, start: b, span: move.beats * mult, half: this.half, origin, section, sig, unitStart: first, phrase });
      first = false;
      b += move.beats * mult;
      this.lastMove = move;
      this.lastMirror = mirror;
    };
    if (choice.kind === 'sig') {
      let origin = 0;
      const sigBeats = this.signature.reduce((t, s) => t + s.move.beats * mult, 0);
      // Repeat the whole combo while it fits (Easy units hold it twice).
      while (sigBeats > 0 && b + sigBeats <= end) {
        for (const s of this.signature) {
          push(s.move, s.mirror, origin, true);
          origin += s.move.travel * (s.mirror ? -1 : 1);
        }
      }
    } else {
      const m = choice.move;
      const span = m.beats * mult;
      let n = Math.floor((end - b) / span);
      if (m.travel !== 0 && n % 2 === 1) n -= 1;
      // Phrase-end flourish: replace the last 4 move beats (an even number of instances).
      let fl = flourish && m.travel === 0 && (4 / m.beats) % 1 === 0 ? 4 / m.beats : 0;
      if (fl && (n <= fl || (n - fl) % (m.mirror ? 2 : 1) !== 0)) fl = 0;
      let origin = 0;
      for (let i = 0; i < n - fl; i++) {
        const mirror = m.mirror ? i % 2 === 1 : false;
        push(m, mirror, origin, false);
        origin += m.travel * (mirror ? -1 : 1);
      }
      if (fl && flourish) push(flourish, false, origin, false);
    }
    if (b < end) this.filler(out, b, end, section, first, phrase, calm);
    if (choice.kind === 'move') {
      this.recent.push(choice.move);
      if (this.recent.length > 3) this.recent.shift();
    }
  }
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
 * One 8-move-beat combo per song: two 4-beat blocks of different moves. A
 * song's curated `signature` (move ids) supplies the blocks when those moves
 * suit the level; otherwise they're picked with the song's style weights.
 */
function pickSignature(rng: () => number, intensity: Intensity, style: SongStyle = BALANCED_POP, open: ReadonlySet<Tradition> = styleTraditions(style)): SigStep[] {
  // Never a spice move: the chorus combo is the song's identity.
  const ok = (m: Move) => m.beats <= 4 && intensityFactor(m, intensity) > 0 && !(m.travel !== 0 && m.beats === 4) && specialtyFits(m, open);
  const pool = DANCE_MOVES.filter((m) => ok(m) && (m.level !== 'low' || intensity === 'chill'));
  const weight = (m: Move) =>
    (m.level === 'high' ? (intensity === 'chill' ? 0.3 : intensity === 'cardio' ? 1 : 1.8) : 1.2) * (m.beats === 2 ? 2 : 1) * intensityFactor(m, intensity) * styleFactor(m, style) * traditionBoost(m, open);
  const nods = (style.signature ?? []).map((id) => DANCE_MOVES.find((m) => m.id === id)).filter((m): m is Move => !!m && ok(m));
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
  const ch = new Choreographer(map.videoId, intensity, half, opts);
  const out: MoveInstance[] = [];
  if (N === 0) return { instances: out, signature: ch.signature, half, beats: 0 };

  const { pickup, bars } = buildBars(N, map.downbeats);
  const firstType = map.sections[0]?.type ?? 'intro';
  if (bars.length === 0) {
    if (pickup > 0) ch.filler(out, 0, pickup, firstType, false, -1, true);
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
  ch.pickupBeats = pickup;
  const feelsOf = (bs: readonly Bar[]) => bs.map((b) => feel.get(b)!);

  let warmedUp = false;
  for (const run of runs) {
    let barsLeft = run.bars.slice();
    let firstPhrase = true;
    const isPeak = run.type === 'chorus' || run.type === 'drop';
    const cooldown = run.type === 'outro';
    // Warm-up: the song's first few bars stay gentle (unless it's already intro/outro).
    if (!warmedUp) {
      warmedUp = true;
      if (run.type !== 'intro' && !cooldown && barsLeft.length >= unitBars * 2 + 2) {
        const w = barsLeft.splice(0, unitBars * 2);
        ch.phrase(out, w, { section: run.type, energy: run.energy, warmup: true, memoKey: 'warmup', feels: feelsOf(w) });
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
      ch.phrase(out, pb, {
        section: introDrop ? 'verse' : run.type,
        energy: run.energy,
        warmup: run.type === 'intro' && firstPhrase,
        cooldown,
        signature: isPeak && firstPhrase,
        // A drop opens with one unit of the combo, then gets to the heavy move.
        sigUnits: intensity === 'chill' ? 1 : run.type === 'drop' || pf[0]?.drop ? 1 : 2,
        memoKey: run.type,
        feels: pf,
      });
      firstPhrase = false;
    }
  }
  if (pickup > 0) out.unshift(...ch.pickup(pickup, out[0], firstType));
  return { instances: out, signature: ch.signature, half, beats: N };
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
    this.ch = new Choreographer(`${seedKey}|live`, intensity, this.half, opts);
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
      this.ch.phrase(out, bars, warm
        ? { section: 'intro', energy: 0.3, warmup: true }
        : { section: c.type, energy: c.energy, signature: c.type === 'chorus', memoKey: c.type === 'chorus' ? undefined : 'live-verse' });
      this.nextBeat += nBars * barLen;
      this.k++;
    }
  }
}
