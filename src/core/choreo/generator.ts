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
 */

import type { BeatMap, SectionType } from '../analysis/beatmap';
import { CH, type Pose } from '../coach/skeleton';
import { IDLE_MOVE, MOVES, keysOf, type Level, type Move } from './moves';

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
  if (m.jump) return intensity === 'chill' ? 0 : intensity === 'cardio' ? 0.7 : 1.5;
  const df = intensity === 'chill' ? 1 : difficultyFactor(m, intensity);
  if (m.impact) return (intensity === 'chill' ? 0.35 : intensity === 'cardio' ? 1 : 1.5) * df;
  return df;
}

/** Moves the generator may pick (idle and cooldown are special). */
const DANCE_MOVES = MOVES.filter((m) => !m.idle && !m.cooldown);
const COOLDOWN_MOVES = MOVES.filter((m) => m.cooldown);

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
  return (arms / 180) * 0.35 + feet * 4 + vert * 3;
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

  constructor(seedKey: string, intensity: Intensity, half: boolean) {
    this.intensity = intensity;
    this.half = half;
    this.unitBars = unitBarsFor(intensity, half);
    this.rng = mulberry32(hashString(`${seedKey}|${intensity}`));
    this.signature = pickSignature(mulberry32(hashString(`${seedKey}|sig|${intensity}`)), intensity);
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
      const choice = pattern[u % pattern.length] ?? pattern[0];
      const ub = units[u];
      const start = ub[0].start;
      const end = ub[ub.length - 1].start + ub[ub.length - 1].len;
      this.fillUnit(out, start, end, choice, o.section, phraseNo);
    }
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
    if (o.cooldown) return m.cooldown;
    if (m.cooldown || m.idle) return false;
    if (intensityFactor(m, this.intensity) <= 0) return false;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, o.energy);
    return lw[m.level] > 0;
  }

  private choose(o: PhraseOpts, avoid: Move | null): Move {
    const pool = o.cooldown ? COOLDOWN_MOVES : DANCE_MOVES;
    const lw = levelWeights(o.warmup ? 'warmup' : o.section, this.intensity, o.energy);
    const prev = this.lastMove;
    const prevPose = prev ? lastKeyPose(prev, this.lastMirror) : null;
    const weights = pool.map((m) => {
      if (m === avoid) return 0;
      if (m === prev && !(this.intensity === 'chill' && o.memoKey)) return 0; // no repeat across a phrase boundary
      let w = o.cooldown ? 1 : lw[m.level] * intensityFactor(m, this.intensity);
      if (w <= 0) return 0;
      if (this.recent.includes(m)) w *= 0.15;
      if (prev && !prev.idle) w *= 1 - 0.6 * partsOverlap(prev, m);
      if (avoid) w *= 1 - 0.5 * partsOverlap(avoid, m);
      if (prevPose) w *= Math.exp(-0.6 * transitionCost(prevPose, keysOf(m, false)[0].pose));
      return w;
    });
    const picked = pickWeighted(this.rng, pool, weights);
    if (picked) return picked;
    // Everything excluded (tiny pools): relax to anything allowed but `prev`.
    const fallback = pool.filter((m) => m !== prev && m !== avoid && (o.cooldown || intensityFactor(m, this.intensity) > 0));
    return fallback.length ? fallback[Math.floor(this.rng() * fallback.length)] : pool[0];
  }

  private fillUnit(out: MoveInstance[], start: number, end: number, choice: UnitChoice, section: SectionType, phrase: number): void {
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
      let origin = 0;
      for (let i = 0; i < n; i++) {
        const mirror = m.mirror ? i % 2 === 1 : false;
        push(m, mirror, origin, false);
        origin += m.travel * (mirror ? -1 : 1);
      }
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

/** One 8-move-beat combo per song: two 4-beat blocks of different moves. */
function pickSignature(rng: () => number, intensity: Intensity): SigStep[] {
  const pool = DANCE_MOVES.filter(
    (m) => m.beats <= 4 && intensityFactor(m, intensity) > 0 && (m.level !== 'low' || intensity === 'chill') && !(m.travel !== 0 && m.beats === 4),
  );
  const weight = (m: Move) =>
    (m.level === 'high' ? (intensity === 'chill' ? 0.3 : intensity === 'cardio' ? 1 : 1.8) : 1.2) * (m.beats === 2 ? 2 : 1) * intensityFactor(m, intensity);
  const a = pickWeighted(rng, pool, pool.map(weight));
  if (!a) return [];
  const rest = pool.filter((m) => m !== a);
  const b = pickWeighted(rng, rest, rest.map((m) => weight(m) * (1 - 0.7 * partsOverlap(a, m)))) ?? rest[0];
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
export function generateRoutine(map: BeatMap, intensity: Intensity): Routine {
  // Bad data (absurd tempo, non-increasing or non-finite beats): no routine;
  // the conductor dances the idle groove instead.
  const N = isUsableBeatMap(map) ? map.beats.length : 0;
  const half = isHalfTime(mapTempo(map));
  const ch = new Choreographer(map.videoId, intensity, half);
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

  constructor(seedKey: string, intensity: Intensity, bpm: number, startBeat: number) {
    this.half = isHalfTime(bpm);
    // The level still sets difficulty; the verse/verse/chorus cycle keeps the
    // exertion at a medium level with periodic bigger phrases.
    this.ch = new Choreographer(`${seedKey}|live`, intensity, this.half);
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
