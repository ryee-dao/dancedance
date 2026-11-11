/**
 * Choreography generator: BeatMap + intensity -> a timeline of move instances.
 *
 * Pure TypeScript (no DOM). Deterministic: seeded from the video ID and the
 * intensity, so the same song always gets the same routine.
 *
 * Structure:
 *   bars (from downbeats) -> section runs -> phrases (8 bars) -> units (2 bars).
 *   A unit repeats ONE move (alternating sides) or plays the signature combo.
 *   Phrases repeat so each move can be picked up. Every chorus /
 *   drop opens with the song's signature combo (one 8-beat sequence). The
 *   start warms up with low moves, the outro cools down.
 *   Above ~150 BPM every move is performed at half time (1 move beat = 2 song
 *   beats); phrases and units double so they stay musically aligned.
 *
 * Levels (shown to the user as Easy / Medium / Hard):
 *   chill  (Easy):   difficulty-1 moves only, 4-bar units (a move lasts 4-8
 *                    bars), the same A/B pair for a whole section, no jumps.
 *   cardio (Medium): difficulty 1-2, 2-bar units, AABA phrases.
 *   sweaty (Hard):   all difficulties (favouring coordinated moves), 2-bar
 *                    units with ABAC phrases, more high-impact moves.
 *
 * Live mode (no sections known) uses LivePlanner: the same unit logic with a
 * repeating verse / verse / chorus phrase cycle.
 *
 * Song style (songStyle.ts) weights the pick on top of section energy and
 * level: moves of the song's families (~60-70 % of picks), its focus and its
 * title themes are favoured, never to the point of emptying the pool. The
 * pool is the catalogue plus validated variations (pool.ts): Easy sees few
 * (simple ones), Hard the most. A move doesn't come back within
 * NO_REPEAT_PHRASES phrases (section memos aside). The seed is
 * videoId + level + style; 'fresh' routines add a play counter, but the
 * chorus combo (signature) keeps the stable seed. Songs with a curated
 * `signature` build the chorus combo from those moves.
 */

import type { BeatMap, SectionType } from '../analysis/beatmap';
import { CH, type Pose } from '../coach/skeleton';
import { IDLE_MOVE, MOVES, keysOf, type Level, type Move } from './moves';
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
/** Chance a unit plays an ornamented version of its move (hip sway, diagonal). */
const ORNAMENT_P: Record<Intensity, number> = { chill: 0, cardio: 0.15, sweaty: 0.25 };

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

/** Base moves + variations (variations get a per-level share). */
function dancePool(useVariations: boolean): { moves: readonly Move[]; isVar: Uint8Array } {
  const vars = useVariations ? getPool().variations : [];
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

export interface PhraseOpts {
  section: SectionType;
  energy: number;
  /** Low-intensity warm-up phrase. */
  warmup?: boolean;
  /** First phrase of a chorus/drop: open with the signature combo. */
  signature?: boolean;
  /** Cooldown moves only. */
  cooldown?: boolean;
  /** Section memo key (repeat the same A/B when a section type returns). */
  memoKey?: string;
}

type UnitChoice = { kind: 'move'; move: Move } | { kind: 'sig' };

export class Choreographer {
  readonly signature: SigStep[];
  readonly half: boolean;
  readonly unitBars: number;
  private rng: () => number;
  private intensity: Intensity;
  private lastMove: Move | null = null;
  private lastMirror = false;
  private recent: Move[] = [];
  private memo = new Map<string, [Move, Move]>();
  private phraseNo = 0;
  readonly style: SongStyle;
  private pool: readonly Move[];
  /** Per-move static weight: style x variation share (index-aligned with pool). */
  private base: Float64Array;
  /** Phrase number each move was last used in. */
  private lastUsed = new Map<Move, number>();
  private ornaments: { get(base: string): readonly Move[] } | null;

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
    this.ornaments = useVars ? getPool().ornaments : null;
    // Variations as a share of the picks (there are many more of them than base moves).
    // Variations get VARIATION_SHARE of the total (style x level) weight mass.
    this.base = new Float64Array(moves.length);
    let mb = 0, mv = 0;
    for (let i = 0; i < moves.length; i++) {
      this.base[i] = styleFactor(moves[i], this.style);
      const w = this.base[i] * intensityFactor(moves[i], intensity);
      if (isVar[i]) mv += w;
      else mb += w;
    }
    const share = VARIATION_SHARE[intensity];
    const vw = mv > 0 ? (share / (1 - share)) * (mb / mv) : 0;
    for (let i = 0; i < moves.length; i++) if (isVar[i]) this.base[i] *= vw;
    // The chorus combo keeps the stable seed (same in 'fresh' mode).
    this.signature = pickSignature(mulberry32(hashString(`${seedKey}|sig|${intensity}|${sk}`)), intensity, this.style);
  }

  /** Fill `bars` (contiguous) with one phrase. */
  phrase(out: MoveInstance[], bars: readonly Bar[], o: PhraseOpts): void {
    if (bars.length === 0) return;
    const unitBars = this.unitBars;
    const units: Bar[][] = [];
    for (let i = 0; i < bars.length; i += unitBars) units.push(bars.slice(i, i + unitBars) as Bar[]);
    // Absorb a lone trailing bar into the previous unit (keeps units >= 2 bars).
    if (units.length > 1 && units[units.length - 1].length < unitBars / 2 + 0.5 && unitBars > 1) {
      const tail = units.pop()!;
      units[units.length - 1].push(...tail);
    }
    const n = units.length;
    const phraseNo = this.phraseNo++;

    let pattern: UnitChoice[];
    if (o.signature && this.signature.length) {
      const B = this.choose(o, null);
      const S: UnitChoice = { kind: 'sig' };
      const b: UnitChoice = { kind: 'move', move: B };
      pattern = n === 1 ? [S] : n === 2 ? (this.intensity === 'chill' ? [S, b] : [S, S]) : n === 3 ? [S, b, S] : [S, S, b, S];
    } else {
      let A: Move;
      let B: Move;
      const memo = o.memoKey ? this.memo.get(o.memoKey) : undefined;
      if (memo && (memo[0] !== this.lastMove || this.intensity === 'chill') && this.allowed(memo[0], o) && this.allowed(memo[1], o)) {
        [A, B] = memo;
      } else {
        A = this.choose(o, null);
        this.recent.push(A);
        B = this.choose(o, A);
        this.recent.pop();
        if (o.memoKey && !this.memo.has(o.memoKey)) this.memo.set(o.memoKey, [A, B]);
      }
      const a: UnitChoice = { kind: 'move', move: A };
      const b: UnitChoice = { kind: 'move', move: B };
      if (this.intensity === 'chill') {
        // Easy: long repetition, one change per phrase.
        pattern = n === 1 ? [a] : n === 2 ? [a, b] : [a, a, b, b];
      } else if (this.intensity === 'sweaty' && n >= 2) {
        // Hard: quicker changes, a third move per phrase.
        this.recent.push(A, B);
        const C = this.choose(o, B);
        this.recent.length -= 2;
        const c: UnitChoice = { kind: 'move', move: C };
        pattern = n === 2 ? [a, b] : n === 3 ? [a, b, a] : [a, b, a, c];
      } else {
        pattern = n === 1 ? [a] : n === 2 ? [a, a] : n === 3 ? [a, a, b] : [a, a, b, a];
      }
    }
    for (let u = 0; u < n; u++) {
      let choice = pattern[u % pattern.length] ?? pattern[0];
      const ub = units[u];
      const start = ub[0].start;
      const end = ub[ub.length - 1].start + ub[ub.length - 1].len;
      let flourish: Move | null = null;
      if (choice.kind === 'move' && !o.cooldown && !o.warmup) {
        const orn = this.ornament(choice.move, ['hips', 'diag'], ORNAMENT_P[this.intensity]);
        if (orn) choice = { kind: 'move', move: orn };
        // Phrase end: the unit's last 4 beats spin out / hit a pose.
        if (u === n - 1 && n > 1) flourish = this.ornament(pattern[u % pattern.length].kind === 'move' ? (pattern[u % pattern.length] as { move: Move }).move : choice.move, ['spin', 'hit4', 'clap4'], FLOURISH_P[this.intensity]);
      }
      this.fillUnit(out, start, end, choice, o.section, phraseNo, flourish);
    }
    for (const c of pattern) if (c.kind === 'move') this.lastUsed.set(c.move, phraseNo);
  }

  /** Fill [start, end) with the groove (filler for pickups / leftovers). */
  filler(out: MoveInstance[], start: number, end: number, section: SectionType, unitStart = false): void {
    for (let b = start; b < end; b++) {
      const mirror = this.lastMove === IDLE_MOVE ? !this.lastMirror : false;
      out.push({ move: IDLE_MOVE, mirror, start: b, span: 1, half: false, origin: 0, section, sig: false, unitStart: unitStart && b === start, phrase: -1 });
      this.lastMove = IDLE_MOVE;
      this.lastMirror = mirror;
    }
  }

  private allowed(m: Move, o: PhraseOpts): boolean {
    if (o.cooldown) return COOLDOWN_MOVES.includes(m) && (m.cooldown || intensityFactor(m, this.intensity) > 0);
    if (m.cooldown || m.idle) return false;
    if (intensityFactor(m, this.intensity) <= 0) return false;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, o.energy);
    return lw[m.level] > 0;
  }

  private choose(o: PhraseOpts, avoid: Move | null): Move {
    const pool = o.cooldown ? COOLDOWN_MOVES : this.pool;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, o.energy);
    const prev = this.lastMove;
    const prevPose = prev ? lastKeyPose(prev, this.lastMirror) : null;
    const phrase = this.phraseNo;
    const weights = pool.map((m, i) => {
      if (m === avoid) return 0;
      if (m === prev && !(this.intensity === 'chill' && o.memoKey)) return 0; // no repeat across a phrase boundary
      let w = o.cooldown ? (m.cooldown || intensityFactor(m, this.intensity) > 0 ? 1 : 0) : lw[m.level] * intensityFactor(m, this.intensity) * this.base[i];
      if (w <= 0) return 0;
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
      return w;
    });
    const picked = pickWeighted(this.rng, pool, weights);
    if (picked) return picked;
    // Everything excluded (tiny pools): relax to anything allowed but `prev`.
    const fallback = pool.filter((m) => m !== prev && m !== avoid && (o.cooldown || intensityFactor(m, this.intensity) > 0));
    return fallback.length ? fallback[Math.floor(this.rng() * fallback.length)] : pool[0];
  }

  /** An ornamented version of `m` of one of the given types, or null. */
  private ornament(m: Move, types: readonly string[], p: number): Move | null {
    if (p <= 0 || this.rng() >= p) return null;
    const list = (this.ornaments?.get(m.id) ?? []).filter((v) => types.includes(v.id.slice(v.id.lastIndexOf('~') + 1)) && intensityFactor(v, this.intensity) > 0);
    return list.length ? list[Math.floor(this.rng() * list.length)] : null;
  }

  private fillUnit(out: MoveInstance[], start: number, end: number, choice: UnitChoice, section: SectionType, phrase: number, flourish: Move | null = null): void {
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
    if (b < end) {
      const wasFirst = first;
      this.filler(out, b, end, section, wasFirst);
    }
    if (choice.kind === 'move') {
      this.recent.push(choice.move);
      if (this.recent.length > 3) this.recent.shift();
    }
  }
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
function pickSignature(rng: () => number, intensity: Intensity, style: SongStyle = BALANCED_POP): SigStep[] {
  const ok = (m: Move) => m.beats <= 4 && intensityFactor(m, intensity) > 0 && !(m.travel !== 0 && m.beats === 4);
  const pool = DANCE_MOVES.filter((m) => ok(m) && (m.level !== 'low' || intensity === 'chill'));
  const weight = (m: Move) =>
    (m.level === 'high' ? (intensity === 'chill' ? 0.3 : intensity === 'cardio' ? 1 : 1.8) : 1.2) * (m.beats === 2 ? 2 : 1) * intensityFactor(m, intensity) * styleFactor(m, style);
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
  if (pickup > 0) ch.filler(out, 0, pickup, firstType);
  if (bars.length === 0) return { instances: out, signature: ch.signature, half, beats: N };

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
        ch.phrase(out, w, { section: run.type, energy: run.energy, warmup: true });
      }
    }
    while (barsLeft.length > 0) {
      let take = Math.min(phraseBars, barsLeft.length);
      if (barsLeft.length - take > 0 && barsLeft.length - take < unitBars) take = barsLeft.length;
      const pb = barsLeft.slice(0, take);
      barsLeft = barsLeft.slice(take);
      ch.phrase(out, pb, {
        section: run.type,
        energy: run.energy,
        warmup: run.type === 'intro',
        cooldown,
        signature: isPeak && firstPhrase,
        memoKey: !isPeak && (firstPhrase || intensity === 'chill') ? run.type : undefined,
      });
      firstPhrase = false;
    }
  }
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
