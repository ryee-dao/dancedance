/**
 * Move catalogue machinery: the data format of layer patterns and move
 * definitions, the pattern registry, and the builders that turn definitions
 * into playable Moves. Pure TypeScript (no DOM).
 *
 * The CONTENT lives in families/*.ts (one file per style family, see
 * AUTHORING.md); families/index.ts collects every file, registers the
 * patterns and builds the moves.
 *
 * Every pose is from the USER's point of view: `r` is the user's right, which
 * the mirror-style coach shows on the screen-right side.
 *
 * A move is three tracks (body/feet, arms, torso/head), each with its own
 * keyframes at whole or half beats (0 <= at < beats). A move loops: after its
 * last key the next instance's first key follows. Travelling moves
 * (`travel` != 0) end displaced by `travel`; the generator always pairs them
 * with their mirror so the coach returns to centre.
 */

import { GROUP_CHANNELS, NUM_GROUPS, NEUTRAL, interpolateGroup, mirrored, pose, type PoseSpec } from '../coach/poses';
import { CH, createPose, mirrorPose, type Pose } from '../coach/skeleton';
import { isFamily, isFocus, isTheme, type Family, type Focus, type Theme } from './families';

export type Level = 'low' | 'mid' | 'high';
export type Difficulty = 1 | 2 | 3;
export type BodyPart = 'arms' | 'legs' | 'torso' | 'hips' | 'jump' | 'turn';

// ---------------------------------------------------------------------------
// Patterns

/**
 * A short keyframed loop for ONE part of the body:
 *   - foot:   lower body + root (feet, hips, bounce, travel, turns)
 *   - arms:   arms, hands, shoulders
 *   - accent: torso / head
 * A pattern may also carry torso values (e.g. a cross punch twists the
 * chest); `torso: true` makes it lead the torso track when no accent is given.
 * Asymmetric patterns (`mirror: true`) are written for the right side; tiles
 * alternate sides.
 */
export interface Pattern {
  id: string;
  beats: 1 | 2 | 4;
  keys: readonly (readonly [number, PoseSpec])[];
  mirror?: boolean;
  /** Net x displacement per execution (footwork only). */
  travel?: number;
  jump?: boolean;
  impact?: boolean;
  /** Leads the torso track (its lean/twist/head values are used). */
  torso?: boolean;
  parts: readonly BodyPart[];
  /** Short lowercase name of the action ('rolling hands', 'step touch'), for variation names. */
  label?: string;
}

export type PatternDef = Omit<Pattern, 'id'>;

/** Patterns of one family file, by id (ids are unique per kind across all files). */
export interface PatternSet {
  foot?: Record<string, PatternDef>;
  arms?: Record<string, PatternDef>;
  accent?: Record<string, PatternDef>;
}

/** The global pattern registry (filled by families/index.ts). */
export const FOOT: Record<string, Pattern> = {};
export const ARMS: Record<string, Pattern> = {};
export const ACCENT: Record<string, Pattern> = {};
/** Which family file defined each pattern, keyed 'foot:<id>' / 'arms:<id>' / 'accent:<id>'. */
export const PATTERN_FILE = new Map<string, string>();

/** Register a file's patterns; returns error messages (duplicate ids are skipped). */
export function registerPatterns(file: string, set: PatternSet): string[] {
  const errors: string[] = [];
  const add = (dst: Record<string, Pattern>, src: Record<string, PatternDef> | undefined, kind: string) => {
    for (const [id, d] of Object.entries(src ?? {})) {
      if (dst[id]) {
        errors.push(`Duplicate ${kind} pattern id "${id}" (first defined in ${PATTERN_FILE.get(`${kind}:${id}`)})`);
        continue;
      }
      dst[id] = { id, ...d };
      PATTERN_FILE.set(`${kind}:${id}`, file);
    }
  };
  add(FOOT, set.foot, 'foot');
  add(ARMS, set.arms, 'arms');
  add(ACCENT, set.accent, 'accent');
  return errors;
}

// ---------------------------------------------------------------------------
// Moves

export interface MoveKey {
  /** Position in move beats (0 <= at < beats); a whole or half beat. */
  at: number;
  pose: Pose;
}

export interface Track {
  keys: readonly MoveKey[];
  mirrorKeys: readonly MoveKey[];
}

export interface Move {
  id: string;
  name: string;
  /** How to do it, in a sentence (authoring / review aid). */
  desc?: string;
  /** Catalogue move this is (a variation of); === id for catalogue moves. */
  base: string;
  /** Variation label (plan-time variations only), e.g. 'hip sway'. */
  variant?: string;
  /** Family file that defines it (authoring owner). */
  file: string;
  /** Style families it belongs to. */
  families: readonly Family[];
  /** Body focus. */
  focus: readonly Focus[];
  /** Theme keys it answers (a song's title can boost these). */
  themes: readonly Theme[];
  beats: 1 | 2 | 4;
  /** Intensity: how hard it works you (the level mix picks by this). */
  level: Level;
  /** 1 = one body part / very simple, 3 = coordinated, travelling or fast changes. */
  difficulty: Difficulty;
  /** Body parts it mainly uses (consecutive moves should vary). */
  parts: readonly BodyPart[];
  /** Has a mirrored (other side) variant. */
  mirror: boolean;
  /** Net x displacement per execution (0 = stays in place). */
  travel: number;
  /** Feet leave the floor. Easy (chill) never uses these. */
  jump: boolean;
  /** Squats / jumps: high-impact moves the level setting dials. */
  impact: boolean;
  /** Contains a fast (>= 180 deg in a beat) turn: never on Easy. */
  fastTurn: boolean;
  cooldown: boolean;
  /** The neutral groove / filler. */
  idle: boolean;
  /** How much of the per-beat bounce layer to add (0..1). */
  bounce: number;
  /** Composite key index used for static thumbnails. */
  icon: number;
  /** Built from layer patterns (vs hand-authored full body). */
  layered: boolean;
  /** Layer pattern ids (layered moves). */
  foot?: string;
  arms?: string;
  accent?: string;
  /** Per-group tracks: [body, arms, torso]. */
  tracks: readonly [Track, Track, Track];
  /** Composite full poses at every key time (thumbnails, transitions, checks). */
  keys: readonly MoveKey[];
  mirrorKeys: readonly MoveKey[];
}

/**
 * Tags as one compact string: "families | focus | themes", e.g.
 * 'latin pop | hips | hips shake'. Families and focus are required.
 */
export type TagString = string;

interface DefCommon {
  id: string;
  name: string;
  desc?: string;
  tags: TagString;
  /** Intensity. */
  level: Level;
  d: Difficulty;
  cooldown?: boolean;
  idle?: boolean;
  bounce?: number;
  icon?: number;
}

/** A move layered from patterns: footwork + arms (+ torso/head accent). */
export interface ComboDef extends DefCommon {
  kind: 'combo';
  foot: string;
  arms: string;
  accent?: string;
  /** Shift the arm pattern by this many beats. */
  shift?: number;
}

/** A hand-authored full-body move (every channel keyed together). */
export interface FullDef extends DefCommon {
  kind: 'full';
  beats: 1 | 2 | 4;
  parts: readonly BodyPart[];
  mirror?: boolean;
  travel?: number;
  jump?: boolean;
  impact?: boolean;
  keys: readonly (readonly [number, PoseSpec | Pose])[];
}

export type MoveDef = ComboDef | FullDef;

/** Authoring shorthand for a combo definition. */
export function combo(
  id: string,
  name: string,
  foot: string,
  arms: string,
  level: Level,
  d: Difficulty,
  tags: TagString,
  extra: Partial<Pick<ComboDef, 'accent' | 'shift' | 'icon' | 'bounce' | 'desc'>> = {},
): ComboDef {
  return { kind: 'combo', id, name, foot, arms, level, d, tags, ...extra };
}

/** Authoring shorthand for a full-body definition. */
export function full(d: Omit<FullDef, 'kind'>): FullDef {
  return { kind: 'full', ...d };
}

// ---------------------------------------------------------------------------
// Tags

export interface Tags {
  families: readonly Family[];
  focus: readonly Focus[];
  themes: readonly Theme[];
}

export function parseTags(id: string, spec: TagString): Tags {
  const [f = '', fo = '', th = ''] = spec.split('|').map((x) => x.trim());
  const words = (s: string) => s.split(/\s+/).filter(Boolean);
  const bad = [...words(f).filter((w) => !isFamily(w)), ...words(fo).filter((w) => !isFocus(w)), ...words(th).filter((w) => !isTheme(w))];
  const families = words(f).filter(isFamily);
  const focus = words(fo).filter(isFocus);
  const themes = words(th).filter(isTheme);
  if (!families.length || !focus.length || bad.length) throw new Error(`Bad tags for ${id}: "${spec}"${bad.length ? ` (unknown: ${bad.join(', ')})` : ''}`);
  return { families, focus, themes };
}

// ---------------------------------------------------------------------------
// Builders

function mirrorKeys(keys: readonly MoveKey[]): MoveKey[] {
  return keys.map((k) => ({ at: k.at, pose: mirrored(k.pose) }));
}

export function track(keys: MoveKey[]): Track {
  keys.sort((a, b) => a.at - b.at);
  return { keys, mirrorKeys: mirrorKeys(keys) };
}

/** Sample one group of a track at `at` (within one loop) into `out`. */
function sampleTrack(keys: readonly MoveKey[], beats: number, g: number, at: number, out: Pose): void {
  let k = keys.length - 1;
  for (let i = 0; i < keys.length; i++) if (keys[i].at <= at + 1e-9) k = i;
  const k0 = keys[k];
  if (Math.abs(k0.at - at) < 1e-9 || keys.length === 1) {
    for (const c of GROUP_CHANNELS[g]) out[c] = k0.pose[c];
    return;
  }
  const k1 = keys[(k + 1) % keys.length];
  const t0 = k0.at > at ? k0.at - beats : k0.at;
  const t1 = k1.at <= t0 ? k1.at + beats : k1.at;
  interpolateGroup(g, k0.pose, k0.pose, k1.pose, (at - t0) / (t1 - t0), out);
}

function composite(tracks: readonly [Track, Track, Track], beats: number): MoveKey[] {
  const ats = new Set<number>();
  for (const t of tracks) for (const k of t.keys) ats.add(k.at);
  return [...ats]
    .sort((a, b) => a - b)
    .map((at) => {
      const q = createPose();
      q.set(NEUTRAL);
      for (let g = 0; g < NUM_GROUPS; g++) sampleTrack(tracks[g].keys, beats, g, at, q);
      return { at, pose: q };
    });
}

/** Key whose pose is furthest from neutral (most telling thumbnail). */
function autoIcon(keys: readonly MoveKey[]): number {
  let best = 0;
  let bestD = -1;
  keys.forEach((k, i) => {
    let d = 0;
    for (let c = CH.RA_E; c <= CH.LF_P; c++) d += Math.abs(k.pose[c] - NEUTRAL[c]) / 90;
    for (const c of [CH.RFT_X, CH.LFT_X, CH.RFT_Y, CH.LFT_Y, CH.RFT_Z, CH.LFT_Z, CH.Y, CH.X]) d += Math.abs(k.pose[c] - NEUTRAL[c]) * 8;
    d += (Math.abs(k.pose[CH.LEAN]) + Math.abs(k.pose[CH.TWIST])) / 30;
    d += Math.abs(k.pose[CH.HIPS]) * 6 + Math.abs(k.pose[CH.HIP_TILT]) / 40;
    // A turned key is a poor thumbnail.
    const sp = ((k.pose[CH.SPIN] % 360) + 360) % 360;
    if (sp > 20 && sp < 340) d -= 10;
    if (d > bestD + 1e-6) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Largest turn (deg) between consecutive body keys per beat. */
function maxTurnRate(t: Track, beats: number): number {
  const k = t.keys;
  let max = 0;
  for (let i = 0; i < k.length; i++) {
    const a = k[i], b = k[(i + 1) % k.length];
    let dt = b.at - a.at;
    if (dt <= 0) dt += beats;
    let d = Math.abs(b.pose[CH.SPIN] - a.pose[CH.SPIN]) % 360;
    if (d > 180) d = 360 - d;
    max = Math.max(max, d / dt);
  }
  return max;
}

interface Extra {
  mirror: boolean;
  travel: number;
  jump: boolean;
  impact: boolean;
  parts: readonly BodyPart[];
  layered: boolean;
  foot?: string;
  arms?: string;
  accent?: string;
}

export interface FinishOpts {
  id: string;
  name: string;
  desc?: string;
  file: string;
  tags: Tags;
  level: Level;
  difficulty: Difficulty;
  base?: string;
  variant?: string;
  cooldown?: boolean;
  idle?: boolean;
  bounce?: number;
  icon?: number;
}

export function finish(c: FinishOpts, beats: 1 | 2 | 4, tracks: [Track, Track, Track], extra: Extra): Move {
  const keys = composite(tracks, beats);
  return {
    id: c.id,
    name: c.name,
    ...(c.desc ? { desc: c.desc } : {}),
    base: c.base ?? c.id,
    ...(c.variant ? { variant: c.variant } : {}),
    file: c.file,
    families: c.tags.families,
    focus: c.tags.focus,
    themes: c.tags.themes,
    beats,
    level: c.level,
    difficulty: c.difficulty,
    parts: extra.parts,
    mirror: extra.mirror,
    travel: extra.travel,
    jump: extra.jump,
    impact: extra.impact || extra.jump,
    fastTurn: maxTurnRate(tracks[0], beats) >= 179,
    cooldown: !!c.cooldown,
    idle: !!c.idle,
    bounce: c.bounce ?? (extra.jump ? 0 : 1),
    icon: c.icon ?? autoIcon(keys),
    layered: extra.layered,
    foot: extra.foot,
    arms: extra.arms,
    accent: extra.accent,
    tracks,
    keys,
    mirrorKeys: mirrorKeys(keys),
  };
}

/** Build a hand-authored full-body move. */
export function buildFull(d: FullDef, file: string): Move {
  const keys = d.keys.map(([at, k]) => ({ at, pose: k instanceof Float64Array ? k : pose(k) }));
  const t = track(keys);
  return finish(
    { id: d.id, name: d.name, desc: d.desc, file, tags: parseTags(d.id, d.tags), level: d.level, difficulty: d.d, cooldown: d.cooldown, idle: d.idle, bounce: d.bounce, icon: d.icon },
    d.beats,
    [t, t, t],
    { mirror: !!d.mirror, travel: d.travel ?? 0, jump: !!d.jump, impact: !!d.impact, parts: d.parts, layered: false },
  );
}

/** Tile a pattern over `beats`, alternating sides for asymmetric patterns. */
export function tile(pat: Pattern, beats: number, shift: number): { keys: MoveKey[]; travel: number; asym: boolean } {
  const n = beats / pat.beats;
  if (!Number.isInteger(n) || n < 1) throw new Error(`Pattern ${pat.id} (${pat.beats}) doesn't tile ${beats} beats`);
  const keys: MoveKey[] = [];
  let offset = 0;
  for (let k = 0; k < n; k++) {
    const mir = !!pat.mirror && k % 2 === 1;
    for (const [at, spec] of pat.keys) {
      const q = pose(spec);
      if (mir) mirrorPose(q, q);
      q[CH.X] += offset;
      q[CH.RFT_X] += offset;
      q[CH.LFT_X] += offset;
      keys.push({ at: (((k * pat.beats + at + shift) % beats) + beats) % beats, pose: q });
    }
    offset += (pat.travel ?? 0) * (mir ? -1 : 1);
  }
  return { keys, travel: offset, asym: !!pat.mirror && n % 2 === 1 };
}

export interface LayerSpec {
  foot: string;
  arms: string;
  accent?: string;
  shift?: number;
}

/** Build a layered move from pattern ids. */
export function buildLayered(c: FinishOpts, l: LayerSpec): Move {
  const foot = FOOT[l.foot];
  const arms = ARMS[l.arms];
  const accent = l.accent ? ACCENT[l.accent] : undefined;
  if (!foot) throw new Error(`${c.id}: unknown footwork pattern "${l.foot}"`);
  if (!arms) throw new Error(`${c.id}: unknown arm pattern "${l.arms}"`);
  if (l.accent && !accent) throw new Error(`${c.id}: unknown accent pattern "${l.accent}"`);
  const beats = Math.max(foot.beats, arms.beats, accent?.beats ?? 1) as 1 | 2 | 4;
  const f = tile(foot, beats, 0);
  const a = tile(arms, beats, l.shift ?? 0);
  const torsoSrc = accent ?? (arms.torso ? arms : foot.torso ? foot : arms);
  const t = torsoSrc === arms ? a : torsoSrc === foot ? f : tile(torsoSrc, beats, 0);
  const parts = new Set<BodyPart>([...foot.parts, ...arms.parts, ...(accent?.parts ?? [])]);
  if (parts.size === 0) parts.add('torso');
  return finish(c, beats, [track(f.keys), track(a.keys), track(t.keys)], {
    mirror: f.asym || a.asym || (t !== f && t !== a && t.asym),
    travel: f.travel,
    jump: !!foot.jump,
    impact: !!foot.impact || !!foot.jump,
    parts: [...parts],
    layered: true,
    foot: l.foot,
    arms: l.arms,
    accent: l.accent,
  });
}

/** Build any move definition. */
export function buildMove(d: MoveDef, file: string): Move {
  if (d.kind === 'full') return buildFull(d, file);
  return buildLayered(
    { id: d.id, name: d.name, desc: d.desc, file, tags: parseTags(d.id, d.tags), level: d.level, difficulty: d.d, cooldown: d.cooldown, idle: d.idle, bounce: d.bounce, icon: d.icon },
    { foot: d.foot, arms: d.arms, accent: d.accent, shift: d.shift },
  );
}
