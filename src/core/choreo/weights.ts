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

/** The catalogue's dance moves (reference distribution for the percentiles). */
const REF_MOVES = MOVES.filter((m) => !m.idle && !m.cooldown);

function rawVigour(m: Move, motionPct: number): number {
  const level = m.level === 'high' ? 1 : m.level === 'mid' ? 0.5 : 0;
  return 0.45 * level + 0.35 * motionPct + 0.2 * (m.jump ? 1 : m.impact ? 0.6 : 0);
}

let REF: { motion: Float64Array; raw: Float64Array; density: Float64Array } | null = null;
function ref() {
  if (!REF) {
    const motion = Float64Array.from(REF_MOVES.map(moveMotion)).sort();
    const raw = Float64Array.from(REF_MOVES.map((x) => rawVigour(x, rankIn(motion, moveMotion(x))))).sort();
    const density = Float64Array.from(REF_MOVES.map((x) => x.keys.length / x.beats)).sort();
    REF = { motion, raw, density };
  }
  return REF;
}

const VIGOUR = new Map<Move, number>();
/**
 * How vigorous a move looks, 0 (gentle) .. 1 (all-out), as a percentile among
 * the catalogue's dance moves: its level, how much it moves per beat, and
 * jumps / squats.
 */
export function moveVigour(m: Move): number {
  const hit = VIGOUR.get(m);
  if (hit !== undefined) return hit;
  const r = ref();
  const v = rankIn(r.raw, rawVigour(m, rankIn(r.motion, moveMotion(m))));
  VIGOUR.set(m, v);
  return v;
}

const FAST_THEMES = new Set(['kick', 'stomp', 'punch', 'jump']);
const SMOOTH_THEMES = new Set(['wave', 'hips']);

const WEIGHTS = new Map<Move, MoveWeights>();

/** The move's soft weights (cached). */
export function moveWeights(m: Move): MoveWeights {
  const hit = WEIGHTS.get(m);
  if (hit) return hit;
  const keys = m.keys;
  let minY = 0, maxY = 0, offBeat = 0;
  for (const k of keys) {
    minY = Math.min(minY, k.pose[CH.Y]);
    maxY = Math.max(maxY, k.pose[CH.Y]);
    if (!Number.isInteger(k.at * 2)) offBeat++;
  }
  const syncop = keys.length ? offBeat / keys.length : 0;
  const r = ref();
  const densityPct = rankIn(r.density, keys.length / m.beats);
  const motionPct = rankIn(r.motion, moveMotion(m));
  const vig = moveVigour(m);
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
  const w: MoveWeights = { tempo: o?.tempo ?? tempo, impact: o?.impact ?? impact, difficulty: o?.difficulty ?? difficulty };
  WEIGHTS.set(m, w);
  return w;
}

// ---------------------------------------------------------------------------
// How the generator applies them

/** Song tempo (BPM) at / below which the slow weight applies fully, and at / above which the fast one does; mid at the centre. */
export const SLOW_BPM = 90;
export const MID_BPM = 115;
export const FAST_BPM = 140;

/** Tempo multiplier of a move for a song (geometric blend of its slow / mid / fast weights). */
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
