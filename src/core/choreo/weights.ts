/**
 * Soft weights of a move: how well it suits slow / mid / fast songs, how
 * high-impact it is, and how hard it is. Pure TypeScript (no DOM),
 * deterministic, cheap (computed from the move's keyframes on first use and
 * cached, so the TV never runs the heavy similarity sampling).
 *
 * They are MULTIPLIERS in the generator, never exclusions: a hop is strongly
 * favoured on Sweaty and on fast songs and turns up only rarely elsewhere.
 * The hard rules live in the generator (Chill never jumps or turns fast;
 * genre-exclusive moves only in their genre).
 *
 * Derivation (all from the move data):
 *   impact      jumps (airtime) 0.85..1; otherwise squat depth, the bounce of
 *               the hips, and the authored `impact` flag (squats / stomps).
 *   difficulty  the authored difficulty (1..3) first, then what makes a move
 *               harder to copy at tempo: off-beat (quarter-beat) keys, many
 *               changes per beat, travel, turns, several body parts at once.
 *   tempo       [slow, mid, fast]: jumps, percussive kicks / stomps / punches
 *               and vigorous moves lean fast; smooth, flowing moves (waves,
 *               hips, rolls) and gentle, low-motion moves lean slow;
 *               quarter-beat footwork leans away from fast (too busy at 140).
 * OVERRIDES hand-corrects the outliers the formula gets wrong.
 * Density, motion and vigour are percentiles against the GLOBAL dance moves
 * only (isReferenceMove): a genre-exclusive move never changes another move's
 * weights.
 *
 * The hard tempo limit of a move (how fast it can be danced at all, half
 * time above it) is speed.ts; the song's character (calm) x level is
 * calmFactor / busyFactor below.
 */

import { CH } from '../coach/skeleton';
import type { Move } from './catalog';
import { MOVES } from './moves';

export interface MoveWeights {
  /** Multipliers at slow (<= 90 BPM), mid (~115) and fast (>= 140) songs. */
  tempo: readonly [number, number, number];
  /** 0 = gentle (no jumps, no squats) .. 1 = big jumps. */
  impact: number;
  /** 0 = simplest .. 1 = hardest. */
  difficulty: number;
}

/** Hand corrections (by base move id; variations inherit their base's). */
const OVERRIDES: Readonly<Record<string, Partial<MoveWeights>>> = {
  // Slow, held shapes that the motion measure rates as busy.
  'lighter-sway': { tempo: [2, 1, 0.4] },
  'arena-wave': { tempo: [1.8, 1, 0.5] },
  'swag-surf': { tempo: [1.8, 1, 0.5] },
  'slow-mo-run': { tempo: [2.2, 0.8, 0.3] },
  // Running steps are made for fast songs even though they're quarter-beat busy.
  'running-man': { tempo: [0.6, 1, 1.6] },
  'running-man-shuffle': { tempo: [0.5, 1, 1.8] },
  't-step': { tempo: [0.5, 1, 1.7] },
  'house-skate': { tempo: [0.6, 1, 1.5] },
  'fast-feet': { tempo: [0.3, 0.8, 2] },
  // Gentle-looking but punishing: deep, held squats.
  'chair-squat': { impact: 0.55 },
  'sumo-squat': { impact: 0.55 },
};

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const angleDelta = (a: number, b: number) => {
  let d = Math.abs(b - a) % 360;
  return d > 180 ? 360 - d : d;
};

/** How awkward is going from one pose into another (arms, feet, height, facing). */
export function poseStepCost(prev: Float64Array, next: Float64Array): number {
  let arms = 0;
  for (let c = CH.RA_E; c <= CH.LF_P; c++) arms += angleDelta(prev[c], next[c]);
  const feet =
    Math.abs(next[CH.RFT_X] - prev[CH.RFT_X]) + Math.abs(next[CH.LFT_X] - prev[CH.LFT_X]) +
    Math.abs(next[CH.RFT_Y] - prev[CH.RFT_Y]) + Math.abs(next[CH.LFT_Y] - prev[CH.LFT_Y]);
  const vert = Math.abs(next[CH.Y] - prev[CH.Y]);
  const spin = angleDelta(prev[CH.SPIN], next[CH.SPIN]);
  return (arms / 180) * 0.35 + feet * 4 + vert * 3 + (spin / 90) * 1.5;
}

/** How much a move moves per beat: limbs, feet, bounce, torso and head over its loop. */
export function moveMotion(m: Move): number {
  const keys = m.keys;
  if (keys.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i].pose;
    const b = keys[(i + 1) % keys.length].pose;
    sum += poseStepCost(a, b);
    sum += ((angleDelta(a[CH.LEAN], b[CH.LEAN]) + angleDelta(a[CH.TWIST], b[CH.TWIST]) + angleDelta(a[CH.BEND], b[CH.BEND]) +
      angleDelta(a[CH.HEAD_NOD], b[CH.HEAD_NOD]) + angleDelta(a[CH.HEAD_ROLL], b[CH.HEAD_ROLL])) / 90) * 0.5;
    sum += Math.abs(b[CH.HIPS] - a[CH.HIPS]) * 3;
  }
  return sum / m.beats;
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
 * Whether a move belongs to the reference distribution of the percentiles
 * (density, motion, vigour): the catalogue's GLOBAL dance moves only.
 * Genre-exclusive moves are ranked against it but never shape it, so adding
 * or removing a genre move (or a whole set) cannot shift any other move's
 * weights: global moves keep their weights, and so their selection, on every
 * song that doesn't open that set, and one set's moves never move another
 * set's. Variations are ranked against it too (they are not catalogue moves).
 */
export function isReferenceMove(m: Move): boolean {
  return !m.idle && !m.cooldown && !m.genre;
}

function rawVigour(m: Move, motionPct: number): number {
  const level = m.level === 'high' ? 1 : m.level === 'mid' ? 0.5 : 0;
  return 0.45 * level + 0.35 * motionPct + 0.2 * (m.jump ? 1 : m.impact ? 0.6 : 0);
}

/** Sorted reference values the percentiles rank against. */
export interface WeightRef {
  motion: Float64Array;
  raw: Float64Array;
  density: Float64Array;
}

/** The percentile reference of a catalogue: its reference moves (isReferenceMove). */
export function weightRef(catalogue: readonly Move[]): WeightRef {
  const refMoves = catalogue.filter(isReferenceMove);
  const motion = Float64Array.from(refMoves.map(moveMotion)).sort();
  const raw = Float64Array.from(refMoves.map((x) => rawVigour(x, rankIn(motion, moveMotion(x))))).sort();
  const density = Float64Array.from(refMoves.map((x) => x.keys.length / x.beats)).sort();
  return { motion, raw, density };
}

let REF: WeightRef | null = null;
function ref(): WeightRef {
  return (REF ??= weightRef(MOVES));
}

/** A move's vigour against a reference (uncached; moveVigour is the catalogue's, cached). */
export function vigourAgainst(m: Move, r: WeightRef): number {
  return rankIn(r.raw, rawVigour(m, rankIn(r.motion, moveMotion(m))));
}

const VIGOUR = new Map<Move, number>();
/**
 * How vigorous a move looks, 0 (gentle) .. 1 (all-out), as a percentile among
 * the catalogue's global dance moves: its level, how much it moves per beat,
 * and jumps / squats.
 */
export function moveVigour(m: Move): number {
  const hit = VIGOUR.get(m);
  if (hit !== undefined) return hit;
  const v = vigourAgainst(m, ref());
  VIGOUR.set(m, v);
  return v;
}

const FAST_THEMES = new Set(['kick', 'stomp', 'punch', 'jump']);
const SMOOTH_THEMES = new Set(['wave', 'hips']);

const WEIGHTS = new Map<Move, MoveWeights>();

/** The move's soft weights against the catalogue's reference (cached). */
export function moveWeights(m: Move): MoveWeights {
  const hit = WEIGHTS.get(m);
  if (hit) return hit;
  const w = weightsAgainst(m, ref());
  WEIGHTS.set(m, w);
  return w;
}

/** A move's soft weights against a percentile reference (uncached; see weightRef). */
export function weightsAgainst(m: Move, r: WeightRef): MoveWeights {
  const keys = m.keys;
  let minY = 0, maxY = 0, offBeat = 0;
  for (const k of keys) {
    minY = Math.min(minY, k.pose[CH.Y]);
    maxY = Math.max(maxY, k.pose[CH.Y]);
    if (!Number.isInteger(k.at * 2)) offBeat++;
  }
  const syncop = keys.length ? offBeat / keys.length : 0;
  const densityPct = rankIn(r.density, keys.length / m.beats);
  const motionPct = rankIn(r.motion, moveMotion(m));
  const vig = vigourAgainst(m, r);
  const turn = m.parts.includes('turn');

  // Impact.
  let impact: number;
  if (m.jump) impact = 0.85 + 0.15 * clamp(maxY / 0.1);
  else {
    const depth = clamp((-minY - 0.03) / 0.12);
    const bob = clamp((maxY - minY) / 0.12);
    impact = clamp(0.08 + (m.impact ? 0.35 : 0) + 0.3 * depth + 0.15 * bob, 0, 0.75);
  }

  // Difficulty.
  const difficulty = clamp(
    0.12 + 0.55 * ((m.difficulty - 1) / 2) + 0.12 * syncop + 0.06 * densityPct + (m.parts.length >= 3 ? 0.05 : 0) + (turn ? 0.07 : 0) + (m.fastTurn ? 0.05 : 0) + (m.travel !== 0 ? 0.05 : 0),
  );

  // Tempo lean.
  const perc = m.themes.some((t) => FAST_THEMES.has(t)) ? 1 : 0;
  const smooth = m.themes.some((t) => SMOOTH_THEMES.has(t)) || m.focus.includes('hips') ? 1 : 0;
  const J = m.jump ? 1 : 0;
  const fastScore = 0.9 * J + 0.3 * perc + 0.5 * (vig - 0.5) - 0.8 * syncop - 0.3 * smooth - (turn ? 0.15 : 0);
  const slowScore = 0.45 * smooth + 0.5 * (0.5 - motionPct) - 1.0 * J - (m.impact && !m.jump ? 0.25 : 0) + (m.beats === 4 ? 0.1 : 0) - 0.2 * perc;
  const tempo: [number, number, number] = [clamp(Math.exp(slowScore), 0.3, 2.5), 1, clamp(Math.exp(fastScore), 0.3, 1.7)];

  const o = OVERRIDES[m.base] ?? OVERRIDES[m.id];
  return { tempo: o?.tempo ?? tempo, impact: o?.impact ?? impact, difficulty: o?.difficulty ?? difficulty };
}

// ---------------------------------------------------------------------------
// How the generator applies them

/** Song tempo (BPM) at / below which the slow weight applies fully, and at / above which the fast one does; mid at the centre. */
export const SLOW_BPM = 90;
export const MID_BPM = 115;
export const FAST_BPM = 140;

/**
 * Tempo multiplier of a move at a tempo (geometric blend of its slow / mid /
 * fast weights). Pass the tempo the move is DANCED at: half the song's when
 * it is performed at half time (generator.ts dancedBpm; speed.ts).
 */
export function tempoFactor(m: Move, bpm: number | undefined): number {
  if (!bpm || !Number.isFinite(bpm)) return 1;
  const [s, md, f] = moveWeights(m).tempo;
  if (bpm <= MID_BPM) {
    const t = clamp((MID_BPM - bpm) / (MID_BPM - SLOW_BPM));
    return Math.pow(s, t) * Math.pow(md, 1 - t);
  }
  const t = clamp((bpm - MID_BPM) / (FAST_BPM - MID_BPM));
  return Math.pow(f, t) * Math.pow(md, 1 - t);
}

export type LevelName = 'chill' | 'cardio' | 'sweaty';

/** Preferred difficulty per level, the spread around it, and the floor (never 0). */
const DIFF_TARGET: Readonly<Record<LevelName, readonly [number, number, number]>> = {
  chill: [0.1, 0.1, 0.002],
  cardio: [0.4, 0.15, 0.12],
  sweaty: [0.65, 0.3, 0.3],
};

/** Difficulty multiplier of a move at a level (peaks at the level's target, never 0). */
export function difficultyFactor(m: Move, level: LevelName): number {
  const [t, s, floor] = DIFF_TARGET[level];
  const d = moveWeights(m).difficulty;
  // Medium minds simple moves only a little (they stay welcome).
  const x = d < t && level === 'cardio' ? (d - t) * 0.5 : d - t;
  return floor + (1 - floor) * Math.exp(-(x * x) / (2 * s * s));
}

/**
 * Impact multiplier at a level: Chill strongly prefers gentle moves (jumps
 * are excluded outright in the generator), Medium mildly, Hard leans hard
 * toward jumps and squats.
 */
export function impactFactor(m: Move, level: LevelName): number {
  const i = moveWeights(m).impact;
  if (level === 'chill') return Math.exp(-4.5 * Math.max(0, i - 0.1));
  if (level === 'cardio') return Math.exp(-0.9 * Math.max(0, i - 0.3));
  return 0.7 + 0.9 * i;
}

// ---------------------------------------------------------------------------
// The song's character (calm, from the audio traits) x the level

/** Percussive accents of a move: jumps, stomps / kicks / punches, and (below Hard) the impact flag. */
function percussive(m: Move, level: LevelName): number {
  return clamp((m.jump ? 0.6 : 0) + (m.themes.some((t) => FAST_THEMES.has(t)) ? 0.3 : 0) + (m.impact && level !== 'sweaty' ? 0.3 : 0));
}

/** How smooth / flowing a move is, 0..1, from its tempo lean (slow-leaning moves are the flowing ones). */
export function moveSmoothness(m: Move): number {
  const [s, , f] = moveWeights(m).tempo;
  return clamp(0.5 + 0.5 * Math.tanh(Math.log(s / f)));
}

/**
 * Novelty moves: the party file / family (mime, sports, animals) and the fad
 * and cheerleading moves the families tag as pop or hip-hop (the Floss, the
 * Dab, Cheer Kick, Ta-Da ...). Fun on a party song, silly on a gentle one.
 */
const NOVELTY_IDS = new Set(['floss', 'the-dab', 'sprinkler', 'raise-the-roof', 'ta-da', 'peekaboo', 'under-leg-clap', 'the-carlton', 'heisman', 'bunny-hop']);
const NOVELTY_RE = /(?:^|-)(?:cheer|touchdown|floss|dab|raise-the-roof)(?:-|$)/;
export function isNovelty(m: Move): boolean {
  return m.file === 'party' || m.families.includes('party') || NOVELTY_IDS.has(m.base) || NOVELTY_IDS.has(m.id) || NOVELTY_RE.test(m.base);
}

/**
 * Character multiplier of a move for a song's calm (0..1; undefined = 1) and
 * softness / hardness (songStyle.ts soft, hard; undefined = neutral).
 * A calm song (above 0.5) favours smooth, flowing moves and loses
 * percussive accents, jumps and novelty moves (at every level); below Hard it
 * also loses vigorous moves, on Hard it keeps them and favours the big,
 * smooth ones (range and control: the level still sets how hard you work,
 * the song how it looks). A driving song (below 0.5) leans mildly toward
 * vigorous moves. A soft-but-steady song (soft) loses jumps, kicks,
 * percussive and novelty moves, and leans a little smooth, without the
 * calm's ballad lean; a hard-hitting one (hard) welcomes sharp, percussive
 * hits. Continuous, never 0.
 */
export function calmFactor(m: Move, calm: number | undefined, level: LevelName, soft?: number, hard?: number): number {
  let f = 1;
  const smooth = moveSmoothness(m);
  const perc = percussive(m, level);
  const nov = isNovelty(m) ? 1 : 0;
  if (calm !== undefined && Number.isFinite(calm)) {
    const c = clamp(calm);
    const vig = moveVigour(m);
    if (c >= 0.5) {
      const up = 2 * (c - 0.5);
      const vigK = level === 'sweaty' ? 0 : level === 'cardio' ? 1.2 : 2;
      f = Math.exp(2.2 * up * (smooth - 0.5) * 2 - 3.2 * up * perc - vigK * up * Math.max(0, vig - 0.5) * 2 - 4 * up * nov);
      // Hard on a calm song is demanding through range and control: big, sustained, smooth moves.
      if (level === 'sweaty') f *= Math.exp(0.8 * up * (vig - 0.5) * 2 * smooth);
      // A calm song never really jumps, whatever the level.
      if (m.jump) f *= Math.exp(-3 * up);
    } else {
      const dn = 2 * (0.5 - c);
      f = Math.exp(0.9 * dn * (vig - 0.5) * 2 - 0.6 * dn * (smooth - 0.5) * 2);
    }
  }
  if (soft !== undefined && Number.isFinite(soft) && soft > 0) {
    const k = clamp(soft);
    f *= Math.exp(-3 * k * (m.jump ? 1 : 0) - 2.2 * k * perc - 2 * k * nov + 0.8 * k * (smooth - 0.5) * 2);
  }
  if (hard !== undefined && Number.isFinite(hard) && hard > 0) f *= Math.exp(0.6 * clamp(hard) * perc);
  return f;
}

const AGGRESSION = new Map<Move, number>();
/**
 * How aggressive / high-energy a move is, 0 (smooth, gentle: a slow drag, a
 * slow-jam sway) .. 1 (all-out: a pogo, a krump stomp, a hop), from its data
 * alone: its level (how hard it works you), how sharp rather than flowing it
 * is (moveSmoothness), and its percussive accents (jumps; kicks, stomps and
 * punches; the impact flag). Range of motion is deliberately left out: a big,
 * smooth move is a workout without being aggressive (moveReach).
 */
export function moveAggression(m: Move): number {
  const hit = AGGRESSION.get(m);
  if (hit !== undefined) return hit;
  const level = m.level === 'high' ? 1 : m.level === 'mid' ? 0.5 : 0;
  const hits = m.jump ? 1 : clamp((m.themes.some((t) => FAST_THEMES.has(t)) ? 0.6 : 0) + (m.impact ? 0.3 : 0));
  const a = clamp(0.3 * level + 0.4 * (1 - moveSmoothness(m)) + 0.3 * hits);
  AGGRESSION.set(m, a);
  return a;
}

const REACH = new Map<Move, number>();
/**
 * How much a move asks of the body without hitting hard, 0..1: its range of
 * motion (a percentile among the global dance moves, as moveVigour's), how
 * deep it bends (squat depth) and whether it travels. Hard on a gentle song
 * works through these: bigger range, deeper bends, more travel.
 */
export function moveReach(m: Move): number {
  const hit = REACH.get(m);
  if (hit !== undefined) return hit;
  let minY = 0;
  for (const k of m.keys) minY = Math.min(minY, k.pose[CH.Y]);
  const depth = clamp((-minY - 0.03) / 0.12);
  const r = clamp(0.55 * rankIn(ref().motion, moveMotion(m)) + 0.3 * depth + 0.15 * (m.travel !== 0 ? 1 : 0));
  REACH.set(m, r);
  return r;
}

/**
 * Easy on a fast song stays on the beat: moves busier than a key per beat
 * lose weight as the tempo they are danced at rises past 115 BPM (Medium and
 * Hard: 1).
 */
export function busyFactor(m: Move, effBpm: number | undefined, level: LevelName): number {
  if (level !== 'chill' || !effBpm || !Number.isFinite(effBpm)) return 1;
  const kpb = m.keys.length / m.beats;
  return Math.exp(-1.5 * clamp((effBpm - 115) / 30) * Math.max(0, kpb - 1));
}
