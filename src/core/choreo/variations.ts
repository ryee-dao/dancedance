/**
 * Variation engine: systematic variations of the base moves, built at plan
 * time from a small spec. Pure TypeScript (no DOM), deterministic.
 *
 * Two kinds:
 *   COUNTED variations change what the user does enough to be a different
 *   move to copy (they still have to pass the uniqueness check):
 *     - 'combo'  a different footwork under a move's arms, or different arms
 *                over its footwork (layer recombination, family-coherent)
 *     - 'low'    low / wide stance (level change)
 *     - 'double' double-time arms
 *     - 'half'   half-time arms
 *     - 'alt'    alternating single arm (both-arm patterns)
 *   ORNAMENTS decorate a base move without making it a new move (not counted,
 *   not separately named moves in the counts; the display name gets a suffix):
 *     - 'hips'   hip sway added to idle hips
 *     - 'clap4'  clap accent on beat 4
 *     - 'hit4'   pose hit (arms up, held) on beat 4
 *     - 'diag'   facing the diagonal
 *     - 'spin'   phrase-end flourish: two beats of the move, then a spin out
 *
 * Every candidate is validated (validate.ts) and, for counted ones, checked
 * for uniqueness (similarity.ts) by tools/moves/pool.ts, which writes the
 * accepted list to pool.json. The app only BUILDS the listed specs (no
 * validation at runtime).
 */

import { NEUTRAL, pose, type PoseSpec } from '../coach/poses';
import { CH, J, createSkeleton, solveSkeleton } from '../coach/skeleton';
import { ACCENT, ARMS, FOOT, finish, tile, track, type Difficulty, type Level, type Move, type MoveKey, type Pattern, type Tags, type Track } from './catalog';
import { FAMILIES, type Family, type Focus, type Theme } from './families';
import { MOVES } from './moves';
import { spinKeys } from './families/shared';

export type VariationType = 'combo' | 'low' | 'double' | 'half' | 'alt' | 'hips' | 'clap4' | 'hit4' | 'diag' | 'spin';
export const COUNTED_TYPES: readonly VariationType[] = ['combo', 'low', 'double', 'half', 'alt'];
export const ORNAMENT_TYPES: readonly VariationType[] = ['hips', 'clap4', 'hit4', 'diag', 'spin'];

export interface VariationSpec {
  /** `${base}~${type}` or `${base}~combo~${foot}+${arms}`. */
  id: string;
  base: string;
  type: VariationType;
  /** combo: the new layers. */
  foot?: string;
  arms?: string;
}

export function isCounted(t: VariationType): boolean {
  return (COUNTED_TYPES as readonly string[]).includes(t);
}

/** Neutral footwork from the shared file: recombining onto these keeps the arm move's identity. */
const NEUTRAL_FEET = new Set(['bounce', 'plant', 'sway', 'groove']);
/** Arm patterns that are a resting position, not an action. */
function isActiveArms(p: Pattern): boolean {
  return p.parts.includes('arms') || p.parts.includes('torso');
}

// ---------------------------------------------------------------------------
// Catalogue indexes

interface LayerInfo {
  /** Families of the catalogue moves using the pattern. */
  families: Set<Family>;
  /** Canonical move (most representative) for naming. */
  canon: Move;
  moves: Move[];
}

let footIndex: Map<string, LayerInfo> | null = null;
let armsIndex: Map<string, LayerInfo> | null = null;

function indexes(): { foot: Map<string, LayerInfo>; arms: Map<string, LayerInfo> } {
  if (footIndex && armsIndex) return { foot: footIndex, arms: armsIndex };
  const foot = new Map<string, LayerInfo>();
  const arms = new Map<string, LayerInfo>();
  const add = (map: Map<string, LayerInfo>, id: string, m: Move) => {
    let e = map.get(id);
    if (!e) map.set(id, (e = { families: new Set(), canon: m, moves: [] }));
    e.moves.push(m);
    for (const f of m.families) e.families.add(f);
  };
  for (const m of MOVES) {
    if (!m.layered || m.cooldown || m.idle || !m.foot || !m.arms) continue;
    add(foot, m.foot, m);
    add(arms, m.arms, m);
  }
  // Canonical: footwork named by the move with the calmest arms; arms by the one on neutral feet.
  for (const [, e] of foot) e.canon = e.moves.find((m) => !isActiveArms(ARMS[m.arms!])) ?? e.moves[0];
  for (const [, e] of arms) e.canon = e.moves.find((m) => NEUTRAL_FEET.has(m.foot!)) ?? e.moves[0];
  footIndex = foot;
  armsIndex = arms;
  return { foot, arms };
}

const BY_ID = new Map(MOVES.map((m) => [m.id, m]));
const COMBOS = new Set(MOVES.filter((m) => m.layered).map((m) => `${m.foot}|${m.arms}`));

const FOOT_LABEL: Record<string, string> = { bounce: 'bounce', plant: 'wide stance', sway: 'sway', groove: 'knee groove' };

/**
 * Family-file id prefixes ('rkDrums', 'fkKneePush', 'popSpinArms', 'hhWave',
 * 'aeSeal', 'latinOneUp', 'sambaDrum'): authors' namespaces, never shown.
 */
const ID_PREFIX = /^(?:pop|rk|fk|hh|kp|ds|lt|pa|pt|ae|latin|salsa|samba|flamenco|bachata|cumbia|folk|paso|bhangra)(?=[A-Z])/;
/**
 * Variation labels for layer patterns whose id (or canonical move name) reads
 * badly on the NOW card. Short lowercase phrases saying what the dancer does.
 */
const LABEL: Readonly<Record<string, string>> = {
  aeSeal: 'seal clap',
  aeTricepExt: 'tricep extension',
  latinOneUp: 'one arm up',
  bhangraOneUp: 'one arm up',
  latinCrossUp: 'arms crossed up',
  latinFlow: 'flowing arms',
  latinFan: 'hand fan',
  latinSnake: 'snake arms',
  rkLighter: 'lighter arm',
  rkDrums: 'air drums',
  rkVPump: 'V pump',
  rkHammer: 'hammer fists',
  clapEvery: 'clap each beat',
  clapV: 'V clap',
  popKickV: 'V arms',
  popVMotions: 'V motions',
  popTMotion: 'T motion',
  lArms: 'L arms',
  popDoubleClap: 'double clap',
  popSpiritRise: 'spirit fingers',
  popBurst: 'burst open',
  cuteClasp: 'clasped hands',
  pumpOpen: 'pump and open',
  lightBulb: 'light bulb',
  peaceEye: 'peace sign eyes',
  reins: 'hold the reins',
  sambaArms: 'swinging arms',
  sambaDrum: 'drum hits',
  sambaCarnival: 'carnival arms',
  sambaWhiskArms: 'whisk arms',
  bachataArms: 'low arm flick',
  folkFaldeo: 'skirt swish',
  pasoCape: 'cape swirl',
};
function humanize(id: string): string {
  return id.replace(ID_PREFIX, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}
function title(s: string): string {
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
/** Label of an arm pattern: override, its own label, the name of its move on neutral feet, or its id. */
function armLabel(id: string, canon: Move | undefined): string {
  return LABEL[id] ?? ARMS[id]?.label ?? (canon && NEUTRAL_FEET.has(canon.foot!) ? canon.name.toLowerCase() : humanize(id));
}
function footLabel(id: string, canon: Move | undefined): string {
  return LABEL[id] ?? FOOT_LABEL[id] ?? FOOT[id]?.label ?? (canon && !isActiveArms(ARMS[canon.arms!]) ? canon.name.toLowerCase() : humanize(id));
}

// ---------------------------------------------------------------------------
// Candidate generation

/** Every variation candidate of the catalogue (deterministic order). */
export function variationCandidates(): VariationSpec[] {
  const out: VariationSpec[] = [];
  const { foot, arms } = indexes();
  // Recombinations: every (footwork, active arms) pair used by the catalogue,
  // family-coherent, not already a catalogue move.
  for (const [fId, fi] of foot) {
    const fp = FOOT[fId];
    if (!fp || fp.parts.includes('turn')) continue;
    for (const [aId, ai] of arms) {
      const ap = ARMS[aId];
      if (!ap || !isActiveArms(ap) || COMBOS.has(`${fId}|${aId}`)) continue;
      if (ai.moves.every((m) => m.parts.includes('turn'))) continue; // arms made for a turn
      // Torso-led arms written for one particular footwork (crunch: elbow to the rising knee).
      if ((ap.torso || handsLow(ap)) && !ai.moves.some((m) => NEUTRAL_FEET.has(m.foot!))) continue;
      if (fp.torso && ap.torso) continue; // both want the torso
      const neutral = NEUTRAL_FEET.has(fId);
      if (!neutral && ![...fi.families].some((f) => ai.families.has(f))) continue;
      const base = neutral ? ai.canon : fi.canon;
      out.push({ id: `${base.id}~combo~${fId}+${aId}`, base: base.id, type: 'combo', foot: fId, arms: aId });
    }
  }
  for (const m of MOVES) {
    if (m.cooldown || m.idle) continue;
    for (const t of ['low', 'double', 'half', 'alt', 'hips', 'clap4', 'hit4', 'diag', 'spin'] as const) {
      if (applicable(m, t)) out.push({ id: `${m.id}~${t}`, base: m.id, type: t });
    }
  }
  return out;
}

function applicable(m: Move, t: VariationType): boolean {
  const fp = m.foot ? FOOT[m.foot] : undefined;
  const ap = m.arms ? ARMS[m.arms] : undefined;
  if (!m.layered || !fp || !ap) return false;
  const turn = m.parts.includes('turn');
  switch (t) {
    case 'low': {
      if (turn || fp.jump || fp.impact) return false;
      const minY = Math.min(...fp.keys.map(([, s]) => s.y ?? -0.01));
      return minY > -0.09;
    }
    case 'double':
      return !turn && !ap.torso && !GAIT_ARMS.test(ap.id) && isActiveArms(ap) && ap.beats >= 2 && ap.keys.every(([at]) => Number.isInteger(at)) && ap.keys.length >= 2;
    case 'half':
      return !turn && !ap.torso && !GAIT_ARMS.test(ap.id) && isActiveArms(ap) && ap.beats <= 2 && ap.keys.length >= 2 && Math.max(fp.beats, ap.beats * 2) <= 4;
    case 'alt':
      return !turn && !fp.jump && isActiveArms(ap) && !ap.mirror && symmetricArms(ap) && !handsMeet(ap);
    case 'hips':
      return !turn && !fp.parts.includes('hips') && !fp.jump && !fp.impact && !fp.torso && fp.keys.every(([, s]) => Math.abs(s.hips ?? 0) <= 0.025 && s.tilt === undefined);
    case 'clap4':
    case 'hit4':
      return !turn && m.travel === 0 && isActiveArms(ap);
    case 'diag':
      return !turn && m.travel === 0;
    case 'spin':
      return !turn && !fp.jump && m.travel === 0 && m.beats <= 4;
    default:
      return false;
  }
}

const SK = createSkeleton();
/** The hands meet in some key (claps, butterfly): one-armed it makes no sense. */
function handsMeet(p: Pattern): boolean {
  return p.keys.some(([, s]) => {
    solveSkeleton(pose(s), SK);
    const a = J.HA_R * 3, b = J.HA_L * 3;
    return Math.hypot(SK.p[a] - SK.p[b], SK.p[a + 1] - SK.p[b + 1], SK.p[a + 2] - SK.p[b + 2]) < 0.12;
  });
}

/** A hand goes below the hips (pushing a knee or thigh): arms written for one footwork. */
function handsLow(p: Pattern): boolean {
  return p.keys.some(([, s]) => {
    solveSkeleton(pose(s), SK);
    return SK.p[J.HA_R * 3 + 1] < 0.42 || SK.p[J.HA_L * 3 + 1] < 0.42;
  });
}

/** Arm swings coupled to a gait (march / jog arms): double / half time breaks the walk. */
const GAIT_ARMS = /march|jog|run|walk|swing/i;

function symmetricArms(p: Pattern): boolean {
  return p.keys.every(([, s]) => {
    if (!s.r || !s.l) return false;
    for (let i = 0; i < 4; i++) if (Math.abs(s.r[i] - s.l[i]) > 1e-6) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Pattern transforms

function low(p: Pattern): Pattern {
  return {
    ...p,
    id: `${p.id}~low`,
    keys: p.keys.map(([at, s]) => {
      const q = pose(s);
      const o: PoseSpec = {
        ...s,
        y: Math.max(-0.2, q[CH.Y] - 0.075),
        rf: [q[CH.RFT_X] + 0.045, q[CH.RFT_Y], q[CH.RFT_Z]],
        lf: [q[CH.LFT_X] - 0.045, q[CH.LFT_Y], q[CH.LFT_Z]],
        kneeR: q[CH.KNEE_R] + 0.12,
        kneeL: q[CH.KNEE_L] + 0.12,
        bend: (s.bend ?? 0) + 4,
      };
      return [at, o] as const;
    }),
  };
}

function doubleTime(p: Pattern): Pattern {
  return { ...p, id: `${p.id}~double`, beats: (p.beats / 2) as 1 | 2, keys: p.keys.map(([at, s]) => [at / 2, s] as const) };
}

function halfTime(p: Pattern): Pattern {
  return { ...p, id: `${p.id}~half`, beats: (p.beats * 2) as 2 | 4, keys: p.keys.map(([at, s]) => [at * 2, s] as const) };
}

const ALT_REST: PoseSpec['l'] = [14, 10, 34, 50];

/** One arm does the pattern while the other rests; repeats alternate arms. */
function alternate(p: Pattern): Pattern {
  // A 1-beat pattern alternates every beat: stretch it over 2 beats per side.
  const base = p.beats === 1 ? halfTime(p) : p;
  return {
    ...base,
    id: `${p.id}~alt`,
    mirror: true,
    torso: false,
    keys: base.keys.map(([at, s]) => [at, { ...s, l: ALT_REST, handL: 0.4, lean: (s.lean ?? 0) - 2, head: 3 }] as const),
  };
}

/** Hip sway on top of footwork with idle hips (tiled to at least 2 beats). */
function hipsOn(p: Pattern): Pattern {
  const reps = p.beats === 1 ? 2 : 1;
  const keys: (readonly [number, PoseSpec])[] = [];
  for (let r = 0; r < reps; r++) {
    for (const [at, s] of p.keys) {
      const b = r * p.beats + at;
      const onBeat = Number.isInteger(b);
      const side = Math.floor(b) % 2 === 0 ? 1 : -1;
      keys.push([b, { ...s, hips: onBeat ? side * 0.05 : 0, tilt: onBeat ? side * 6 : 0, x: (s.x ?? 0) + (onBeat ? side * 0.01 : 0) }]);
    }
  }
  // Every whole beat needs a key so the hips swing on each beat.
  const beats = p.beats * reps;
  for (let b = 0; b < beats; b++) {
    if (!keys.some(([at]) => at === b)) {
      const side = b % 2 === 0 ? 1 : -1;
      const prev = [...keys].filter(([at]) => at < b).pop() ?? keys[0];
      keys.push([b, { ...prev[1], hips: side * 0.05, tilt: side * 6 }]);
    }
  }
  keys.sort((a, b) => a[0] - b[0]);
  return { ...p, id: `${p.id}~hips`, beats: beats as 1 | 2 | 4, keys, parts: [...p.parts, 'hips'] };
}

// ---------------------------------------------------------------------------
// Building

const FAMILY_ORDER = new Map(FAMILIES.map((f, i) => [f, i]));

function mergeTags(a: Move, b: Move | null, families?: readonly Family[]): Tags {
  const fam = families ?? (b ? [...new Set([...a.families, ...b.families])] : a.families);
  const focus = b ? [...new Set<Focus>([...a.focus, ...b.focus])] : a.focus;
  const themes = b ? [...new Set<Theme>([...a.themes, ...b.themes])] : a.themes;
  return { families: [...fam].sort((x, y) => (FAMILY_ORDER.get(x)! - FAMILY_ORDER.get(y)!)), focus, themes };
}

const LEVELS: readonly Level[] = ['low', 'mid', 'high'];
const maxLevel = (a: Level, b: Level): Level => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);
const clampD = (d: number): Difficulty => Math.max(1, Math.min(3, d)) as Difficulty;

interface Built {
  tracks: [Track, Track, Track];
  beats: 1 | 2 | 4;
  travel: number;
  mirror: boolean;
  parts: string[];
  jump: boolean;
  impact: boolean;
}

function layers(foot: Pattern, arms: Pattern, accent: Pattern | undefined, shift: number, minBeats = 1): Built {
  const beats = Math.max(foot.beats, arms.beats, accent?.beats ?? 1, minBeats) as 1 | 2 | 4;
  const f = tile(foot, beats, 0);
  const a = tile(arms, beats, shift);
  const torsoSrc = accent ?? (arms.torso ? arms : foot.torso ? foot : arms);
  const t = torsoSrc === arms ? a : torsoSrc === foot ? f : tile(torsoSrc, beats, 0);
  const parts = new Set([...foot.parts, ...arms.parts, ...(accent?.parts ?? [])]);
  if (parts.size === 0) parts.add('torso');
  return {
    tracks: [track(f.keys), track(a.keys), track(t.keys)],
    beats,
    travel: f.travel,
    mirror: f.asym || a.asym || (t !== f && t !== a && t.asym),
    parts: [...parts],
    jump: !!foot.jump,
    impact: !!foot.impact || !!foot.jump,
  };
}

const SUFFIX: Record<VariationType, string> = {
  combo: '',
  low: 'low',
  double: 'double time',
  half: 'half time',
  alt: 'alternating',
  hips: 'hip sway',
  clap4: 'clap on 4',
  hit4: 'hit on 4',
  diag: 'diagonal',
  spin: 'spin out',
};

/** Build a variation from its spec (throws when the spec doesn't apply). */
export function buildVariation(v: VariationSpec): Move {
  const m = BY_ID.get(v.base);
  if (!m || !m.layered || !m.foot || !m.arms) throw new Error(`Variation ${v.id}: base ${v.base} is not a layered catalogue move`);
  const fp = FOOT[m.foot], ap = ARMS[m.arms];
  const name = (s: string) => `${m.name} · ${s}`;
  const common = { base: m.id, variant: SUFFIX[v.type], file: m.file };
  switch (v.type) {
    case 'combo': {
      const { foot, arms } = indexes();
      const nf = FOOT[v.foot!], na = ARMS[v.arms!];
      if (!nf || !na) throw new Error(`Variation ${v.id}: unknown layers`);
      const fm = foot.get(v.foot!)?.canon ?? m, am = arms.get(v.arms!)?.canon ?? m;
      const neutral = NEUTRAL_FEET.has(v.foot!);
      const al = armLabel(v.arms!, am), fl = footLabel(v.foot!, fm);
      const display = neutral
        ? `${NEUTRAL_FEET.has(am.foot!) ? am.name : title(al)} · ${fl}`
        : `${!isActiveArms(ARMS[fm.arms!]) ? fm.name : title(fl)} · ${al}`;
      const shared = [...fm.families].filter((f) => am.families.includes(f));
      const b = layers(nf, na, undefined, 0);
      const d = clampD(Math.max(fm.difficulty, am.difficulty) + (neutral ? 0 : 1));
      return finish(
        { id: v.id, name: display, ...common, variant: neutral ? fl : al, tags: mergeTags(fm, am, shared.length ? shared : undefined), level: maxLevel(fm.level, am.level), difficulty: d },
        b.beats,
        b.tracks,
        { mirror: b.mirror, travel: b.travel, jump: b.jump, impact: b.impact, parts: b.parts as Move['parts'], layered: true, foot: v.foot, arms: v.arms },
      );
    }
    default: {
      let f = fp, a = ap;
      let minBeats = 1;
      if (v.type === 'low') f = low(fp);
      else if (v.type === 'double') a = doubleTime(ap);
      else if (v.type === 'half') a = halfTime(ap);
      else if (v.type === 'alt') a = alternate(ap);
      else if (v.type === 'hips') f = hipsOn(fp);
      else if (v.type === 'clap4' || v.type === 'hit4' || v.type === 'spin') minBeats = 4;
      const b = layers(f, a, m.accent ? ACCENT[m.accent] : undefined, 0, minBeats);
      if (v.type === 'clap4' || v.type === 'hit4') accent4(b, v.type);
      if (v.type === 'diag') diagonal(b);
      if (v.type === 'spin') spinOut(b);
      const level = v.type === 'low' ? maxLevel(m.level, 'mid') : m.level;
      const d = clampD(m.difficulty + (v.type === 'double' || v.type === 'alt' || v.type === 'spin' ? 1 : 0));
      const parts = new Set(b.parts);
      if (v.type === 'spin') parts.add('turn');
      return finish(
        { id: v.id, name: name(SUFFIX[v.type]), ...common, tags: v.type === 'spin' ? withTheme(m, 'spin') : mergeTags(m, null), level, difficulty: d },
        b.beats,
        b.tracks,
        { mirror: b.mirror, travel: b.travel, jump: b.jump, impact: b.impact, parts: [...parts] as Move['parts'], layered: true, foot: m.foot, arms: m.arms, accent: m.accent },
      );
    }
  }
}

function withTheme(m: Move, t: Theme): Tags {
  return { families: m.families, focus: [...new Set<Focus>([...m.focus, 'turn'])], themes: [...new Set<Theme>([...m.themes, t])] };
}

function replaceTrack(b: Built, g: 0 | 1 | 2, keys: MoveKey[]): void {
  b.tracks[g] = track(keys);
}

/** Beat 4 (the last beat of the 4-beat loop): clap, or arms flung up and held. */
function accent4(b: Built, t: 'clap4' | 'hit4'): void {
  const arms = b.tracks[1].keys.filter((k) => k.at < 3).map((k) => ({ at: k.at, pose: k.pose }));
  const hit = pose(
    t === 'clap4'
      ? { r: [62, 30, 112, 95], l: [62, 30, 112, 95], handR: 1, handL: 1 }
      : { r: [150, 8, 152, 8], l: [150, 8, 152, 8], handR: 1, handL: 1, nod: -6 },
  );
  if (t === 'clap4') {
    // A real clap: hands meet in front of the chest.
    const c = pose({ r: [40, 70, 110, 120], l: [40, 70, 110, 120], handR: 1, handL: 1 });
    arms.push({ at: 3, pose: c });
    arms.push({ at: 3.5, pose: hit });
  } else {
    arms.push({ at: 3, pose: hit });
  }
  replaceTrack(b, 1, arms);
}

function diagonal(b: Built): void {
  const keys = b.tracks[0].keys.map((k) => {
    const q = new Float64Array(k.pose);
    q[CH.SPIN] = 30;
    return { at: k.at, pose: q };
  });
  replaceTrack(b, 0, keys);
}

/** Beats 0-1 as the move, then a 360 spin out over beats 2-3 with soft arms. */
function spinOut(b: Built): void {
  const body = b.tracks[0].keys.filter((k) => k.at < 2).map((k) => ({ at: k.at, pose: k.pose }));
  for (const [at, s] of spinKeys(2)) body.push({ at, pose: pose(s) });
  // Feet / root of the spin start from the move's own spot.
  replaceTrack(b, 0, body);
  const arms = b.tracks[1].keys.filter((k) => k.at < 2).map((k) => ({ at: k.at, pose: k.pose }));
  arms.push({ at: 2, pose: pose({ r: [40, 60, 70, 90], l: [40, 60, 70, 90], handR: 0.4, handL: 0.4 }) });
  arms.push({ at: 3, pose: pose({ r: [104, 0, 110, 0], l: [104, 0, 110, 0], handR: 1, handL: 1 }) });
  replaceTrack(b, 1, arms);
  const torso = b.tracks[2].keys.filter((k) => k.at < 2).map((k) => ({ at: k.at, pose: k.pose }));
  torso.push({ at: 2, pose: new Float64Array(NEUTRAL) });
  replaceTrack(b, 2, torso);
}
