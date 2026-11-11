/**
 * The move catalogue.
 *
 * Pure TypeScript (no DOM). Most moves are CURATED combinations of layer
 * patterns (layers.ts): a footwork pattern, an arm pattern and optionally a
 * torso/head accent. Moves layering can't express (jumps with a particular
 * shape, shimmies, stretches) are hand-authored as full-body keyframes.
 *
 * Every move is defined from the USER's point of view: `r` is the user's
 * right, which the mirror-style coach shows on the screen-right side.
 *
 * A move is three tracks (body/feet, arms, torso/head), each with its own
 * keyframes at whole or half beats (0 <= at < beats). A move loops: after its
 * last key the next instance's first key follows.
 *
 * Travelling moves (`travel` != 0) end displaced by `travel`; the generator
 * always pairs them with their mirror so the coach returns to centre.
 */

import { GROUP_CHANNELS, G_ARMS, G_BODY, G_TORSO, NUM_GROUPS, interpolateGroup, mirrored, pose, type PoseSpec } from '../coach/poses';
import { ARM, NEUTRAL, hand } from '../coach/poses';
import { CH, createPose, mirrorPose, type Pose } from '../coach/skeleton';
import { ACCENT, ARMS, FOOT, type Pattern } from './layers';

export type Level = 'low' | 'mid' | 'high';
export type Difficulty = 1 | 2 | 3;
export type BodyPart = 'arms' | 'legs' | 'torso' | 'hips' | 'jump';

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
  beats: 1 | 2 | 4;
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

// ---------------------------------------------------------------------------
// Builders

function mirrorKeys(keys: readonly MoveKey[]): MoveKey[] {
  return keys.map((k) => ({ at: k.at, pose: mirrored(k.pose) }));
}

function track(keys: MoveKey[]): Track {
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
    if (d > bestD + 1e-6) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

interface Common {
  id: string;
  name: string;
  level: Level;
  difficulty: Difficulty;
  cooldown?: boolean;
  idle?: boolean;
  bounce?: number;
  icon?: number;
}

function finish(
  c: Common,
  beats: 1 | 2 | 4,
  tracks: [Track, Track, Track],
  extra: Pick<Move, 'mirror' | 'travel' | 'jump' | 'impact' | 'parts' | 'layered'> & { foot?: string; arms?: string; accent?: string },
): Move {
  const keys = composite(tracks, beats);
  return {
    id: c.id,
    name: c.name,
    beats,
    level: c.level,
    difficulty: c.difficulty,
    parts: extra.parts,
    mirror: extra.mirror,
    travel: extra.travel,
    jump: extra.jump,
    impact: extra.impact || extra.jump,
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

// --- hand-authored full-body moves ------------------------------------------

interface FullDef extends Common {
  beats: 1 | 2 | 4;
  parts: readonly BodyPart[];
  mirror?: boolean;
  travel?: number;
  jump?: boolean;
  impact?: boolean;
  keys: readonly (readonly [number, PoseSpec | Pose])[];
}

function full(d: FullDef): Move {
  const keys = d.keys.map(([at, k]) => ({ at, pose: k instanceof Float64Array ? k : pose(k) }));
  const t = track(keys);
  return finish(d, d.beats, [t, t, t], {
    mirror: !!d.mirror,
    travel: d.travel ?? 0,
    jump: !!d.jump,
    impact: !!d.impact,
    parts: d.parts,
    layered: false,
  });
}

// --- layered moves ----------------------------------------------------------

/** Tile a pattern over `beats`, alternating sides for asymmetric patterns. */
function tile(pat: Pattern, beats: number, shift: number): { keys: MoveKey[]; travel: number; asym: boolean } {
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
      keys.push({ at: (k * pat.beats + at + shift) % beats, pose: q });
    }
    offset += (pat.travel ?? 0) * (mir ? -1 : 1);
  }
  return { keys, travel: offset, asym: !!pat.mirror && n % 2 === 1 };
}

interface ComboOpts {
  level: Level;
  d: Difficulty;
  accent?: string;
  /** Shift the arm pattern by this many beats (e.g. arms up on the way out of a squat). */
  shift?: number;
  icon?: number;
  bounce?: number;
}

function combo(id: string, name: string, footId: string, armsId: string, o: ComboOpts): Move {
  const foot = FOOT[footId];
  const arms = ARMS[armsId];
  const accent = o.accent ? ACCENT[o.accent] : undefined;
  if (!foot) throw new Error(`Unknown footwork ${footId}`);
  if (!arms) throw new Error(`Unknown arms ${armsId}`);
  const beats = Math.max(foot.beats, arms.beats, accent?.beats ?? 1) as 1 | 2 | 4;
  const f = tile(foot, beats, 0);
  const a = tile(arms, beats, o.shift ?? 0);
  const torsoSrc = accent ?? (arms.torso ? arms : foot.torso ? foot : arms);
  const t = torsoSrc === arms ? a : torsoSrc === foot ? f : tile(torsoSrc, beats, 0);
  const parts = new Set<BodyPart>([...foot.parts, ...arms.parts, ...(accent?.parts ?? [])]);
  if (parts.size === 0) parts.add('torso');
  return finish({ id, name, level: o.level, difficulty: o.d, icon: o.icon, bounce: o.bounce }, beats, [track(f.keys), track(a.keys), track(t.keys)], {
    mirror: f.asym || a.asym || (t !== f && t !== a && t.asym),
    travel: f.travel,
    jump: !!foot.jump,
    impact: !!foot.impact || !!foot.jump,
    parts: [...parts],
    layered: true,
    foot: footId,
    arms: armsId,
    accent: o.accent,
  });
}

// ---------------------------------------------------------------------------
// Hand-authored moves

const M = (s: PoseSpec): Pose => mirrored(pose(s));
const SOFT_DOWN = [22, 0, 26, 5] as const;

const groove = full({
  id: 'groove', name: 'Warm Bounce', beats: 1, level: 'low', difficulty: 1, parts: ['torso'], mirror: true, idle: true,
  keys: [[0, { x: 0.012, lean: 2.5, hips: 0.012, head: -2, r: [16, 15, 34, 60], l: [9, -5, 18, 35] }]],
});

const shimmyKey = (s: number, low: number): PoseSpec => ({
  y: -0.07 - (s < 0 ? 0.01 : 0), twist: 14 * s, shR: s > 0 ? 0.4 : 0, shL: s < 0 ? 0.4 : 0, lean: 2 * s,
  r: [low, 10, low + 8, 30], l: [low, 10, low + 8, 30], rf: [0.13, 0, 0], lf: [-0.13, 0, 0], handR: 1, handL: 1,
});
const shimmy = full({
  id: 'shimmy', name: 'Shimmy', beats: 2, level: 'mid', difficulty: 2, parts: ['torso'],
  keys: [[0, shimmyKey(1, 62)], [0.5, shimmyKey(-1, 62)], [1, shimmyKey(1, 58)], [1.5, shimmyKey(-1, 58)]],
});

const skaterA: PoseSpec = {
  y: -0.08, x: 0.15, lean: 6, bend: 8, rf: [0.19, 0, 0], lf: [0.03, 0.09, -0.12],
  r: [42, 122, 48, 140], l: [44, 0, 48, 0], head: 4, handR: 1, handL: 1,
};
const skaterAir: PoseSpec = { y: 0.06, x: 0.0, rf: [0.09, 0.02, -0.04], lf: [-0.09, 0.02, -0.04], r: [20, 60, 30, 80], l: [20, 60, 30, 80] };
const skater = full({
  id: 'skater', name: 'Skater Hop', beats: 2, level: 'high', difficulty: 3, parts: ['jump', 'legs', 'arms'], jump: true,
  keys: [[0, skaterA], [0.5, skaterAir], [1, M(skaterA)], [1.5, skaterAir]],
});

const rocket = full({
  id: 'rocket', name: 'Rocket Jump', beats: 2, level: 'high', difficulty: 2, parts: ['jump', 'legs'], jump: true, icon: 2,
  keys: [
    [0, { y: -0.16, bend: 14, nod: -6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [32, -55, 36, -55], l: [32, -55, 36, -55], handR: 0, handL: 0 }],
    [0.5, { y: -0.01, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [118, 30, 122, 30], l: [118, 30, 122, 30], handR: 1, handL: 1 }],
    [1, { y: 0.13, nod: -10, rf: [0.1, 0.03, 0], lf: [-0.1, 0.03, 0], r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
    [1.5, { y: -0.07, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: [80, 15, 85, 15], l: [80, 15, 85, 15], handR: 1, handL: 1 }],
  ],
});

// --- cooldown ---

const sideStretch = full({
  id: 'side-stretch', name: 'Side Stretch', beats: 4, level: 'low', difficulty: 1, parts: ['torso', 'arms'], mirror: true, cooldown: true, bounce: 0.25,
  keys: [
    [0, { lean: -19, hips: 0.03, head: -6, r: [176, -20, 228, -15], l: ARM.hip, handR: 1 }],
    [2, { lean: -24, hips: 0.035, head: -8, y: -0.025, r: [178, -20, 236, -15], l: ARM.hip, handR: 1 }],
    [3, { lean: -5, r: [150, 0, 155, 0], l: [95, 0, 100, 0], handR: 1, handL: 1 }],
  ],
});

const bigBreath = full({
  id: 'big-breath', name: 'Big Breath', beats: 4, level: 'low', difficulty: 1, parts: ['arms'], cooldown: true, bounce: 0.2, icon: 1,
  keys: [
    [0, { y: -0.04, nod: 6, r: [32, 0, 36, 0], l: [32, 0, 36, 0], handR: 1, handL: 1 }],
    [2, { y: 0.0, nod: -10, r: [168, 0, 174, 0], l: [168, 0, 174, 0], handR: 1, handL: 1 }],
  ],
});

const armHug = full({
  id: 'arm-hug', name: 'Arm Hug', beats: 4, level: 'low', difficulty: 1, parts: ['arms'], mirror: true, cooldown: true, bounce: 0.2,
  keys: [
    [0, { twist: -6, head: 4, r: hand(-0.28, -0.04, 0.16, [0, -1, 0.5]), l: hand(-0.15, -0.07, 0.2, [0.3, -1, 0.2]), handR: 1, handL: 1 }],
    [2, { twist: -9, head: 6, y: -0.025, r: hand(-0.29, -0.04, 0.15, [0, -1, 0.5]), l: hand(-0.16, -0.07, 0.2, [0.3, -1, 0.2]), handR: 1, handL: 1 }],
    [3, { r: SOFT_DOWN, l: SOFT_DOWN }],
  ],
});

const neckStretch = full({
  id: 'neck-stretch', name: 'Neck Stretch', beats: 4, level: 'low', difficulty: 1, parts: ['torso'], mirror: true, cooldown: true, bounce: 0.15,
  keys: [
    [0, { head: 24, r: [14, 0, 18, 20], l: ARM.hip, handL: 0 }],
    [2, { head: 28, nod: 4, y: -0.02, r: [16, 0, 20, 20], l: ARM.hip, handL: 0 }],
    [3, { head: 4, r: SOFT_DOWN, l: SOFT_DOWN }],
  ],
});

const reachUp = full({
  id: 'reach-up', name: 'Overhead Reach', beats: 4, level: 'low', difficulty: 1, parts: ['arms'], cooldown: true, bounce: 0.15,
  keys: [
    [0, { nod: -8, r: ARM.up, l: ARM.up, handR: 1, handL: 1 }],
    [2, { nod: -12, y: 0.0, shR: 0.5, shL: 0.5, r: [178, 0, 180, 0], l: [178, 0, 180, 0], handR: 1, handL: 1 }],
    [3, { y: -0.04, r: [70, 0, 74, 0], l: [70, 0, 74, 0], handR: 1, handL: 1 }],
  ],
});

// ---------------------------------------------------------------------------
// The curated catalogue of layered moves

const L = (level: Level, d: Difficulty, extra: Omit<ComboOpts, 'level' | 'd'> = {}): ComboOpts => ({ level, d, ...extra });

const LAYERED: Move[] = [
  // Step touch family
  combo('step-touch', 'Step Touch', 'stepTouch', 'rest', L('low', 1)),
  combo('step-clap', 'Step Touch Clap', 'stepTouch', 'clap', L('low', 1)),
  combo('step-swing', 'Step Touch Swing', 'stepTouch', 'pendulum', L('low', 1)),
  combo('step-high-clap', 'Step Touch High Clap', 'stepTouch', 'clapHigh', L('low', 2)),
  combo('step-sky', 'Step Touch Punch Up', 'stepTouch', 'skyPunch', L('mid', 2)),
  combo('step-press', 'Step Touch Press', 'stepTouch', 'shoulderPress', L('mid', 2)),
  combo('step-curl', 'Step & Curl', 'stepTouch', 'bicepCurl', L('low', 2)),
  combo('step-side-punch', 'Step Touch Side Punch', 'stepTouch', 'sidePunch', L('mid', 2)),
  combo('step-cross', 'Step Touch Cross Jab', 'stepTouch', 'crossJab', L('mid', 2)),
  combo('step-butterfly', 'Step Touch Butterfly', 'stepTouch', 'butterfly', L('low', 2)),
  combo('wave-step', 'Wave Step', 'stepTouch', 'ripple', L('low', 2)),
  combo('ocean-step', 'Ocean Step', 'stepTouch', 'ocean', L('low', 2)),
  combo('double-step', 'Double Step Touch', 'doubleStep', 'rest', L('low', 2)),
  combo('double-clap', 'Double Step Clap', 'doubleStep', 'clap', L('mid', 2)),
  combo('double-press', 'Double Step Press', 'doubleStep', 'shoulderPress', L('mid', 2)),
  // Grapevine
  combo('vine', 'Grapevine', 'vine', 'rest', L('mid', 2)),
  combo('vine-clap', 'Grapevine Clap', 'vine', 'clap', L('mid', 2)),
  combo('vine-sky', 'Grapevine Punch Up', 'vine', 'skyPunch', L('mid', 3)),
  // March
  combo('march', 'March', 'march', 'marchArms', L('low', 1)),
  combo('march-sky', 'March & Punch Up', 'march', 'skyPunch', L('mid', 2)),
  combo('march-press', 'March & Press', 'march', 'shoulderPress', L('mid', 2)),
  combo('march-clap', 'March & Clap', 'march', 'clapEvery', L('low', 2)),
  combo('march-curl', 'March & Curl', 'march', 'bicepCurl', L('low', 2)),
  combo('march-push', 'March & Push Out', 'march', 'pushOut', L('low', 2)),
  // Taps, heels, knees, kicks
  combo('side-tap', 'Side Tap', 'tapSide', 'hips', L('low', 1)),
  combo('tap-punch', 'Tap & Side Punch', 'tapSide', 'sidePunch', L('mid', 2)),
  combo('tap-high-clap', 'Tap & High Clap', 'tapSide', 'clapHigh', L('mid', 2)),
  combo('hitchhike', 'Hitchhike', 'tapSide', 'hitchhike', L('mid', 2)),
  combo('rainbow', 'Rainbow Reach', 'tapSide', 'rainbow', L('mid', 2)),
  combo('heel-push', 'Heel Dig Push Out', 'heelDig', 'pushOut', L('low', 2)),
  combo('heel-clap', 'Heel Dig Clap', 'heelDig', 'clap', L('low', 2)),
  combo('knee-lift', 'Knee Lift', 'kneeLift', 'hips', L('mid', 1)),
  combo('knee-pump', 'Knee Pump', 'kneeLift', 'pullDown', L('mid', 2)),
  combo('standing-crunch', 'Standing Crunch', 'kneeLift', 'crunch', L('mid', 3)),
  combo('side-kick', 'Side Kick', 'kickSide', 'guard', L('mid', 2)),
  combo('kick-punch', 'Side Kick Punch', 'kickSide', 'sidePunch', L('mid', 3)),
  // Squats and lunges
  combo('chair-squat', 'Chair Squat', 'squat', 'clapV', L('high', 1)),
  combo('sumo-squat', 'Sumo Squat', 'sumo', 'hips', L('high', 1)),
  combo('sumo-press', 'Sumo Press', 'sumo', 'shoulderPress', L('high', 2, { shift: 1 })),
  combo('lunge-reach', 'Side Lunge Reach', 'sideLunge', 'sideReach', L('mid', 2)),
  combo('lunge-cross', 'Lunge & Cross', 'sideLunge', 'crossJab', L('mid', 3, { shift: 1 })),
  combo('lunge-sky', 'Lunge & Punch Up', 'sideLunge', 'skyPunch', L('mid', 2)),
  combo('airplane-lunge', 'Airplane Lunge', 'sideLunge', 'airplane', L('mid', 2)),
  // Jumps
  combo('jumping-jack', 'Jumping Jack', 'jack', 'jackArms', L('high', 2)),
  combo('clap-jack', 'Clap Jack', 'jack', 'clapHigh', L('high', 2, { shift: 1 })),
  combo('cross-jack', 'Cross Jack', 'jack', 'xArms', L('high', 2, { shift: 1 })),
  combo('jog', 'Jog', 'jog', 'marchArms', L('high', 2)),
  combo('jog-sky', 'Jog & Punch Up', 'jog', 'skyPunch', L('high', 3)),
  // Social-dance classics
  combo('the-twist', 'The Twist', 'twist', 'twistArms', L('mid', 1)),
  combo('hip-bump', 'Hip Bump', 'hipBump', 'hips', L('low', 1)),
  combo('bump-clap', 'Hip Bump Clap', 'hipBump', 'clap', L('low', 2)),
  combo('disco-point', 'Disco Point', 'sway', 'discoPoint', L('mid', 2)),
  combo('box-step', 'Box Step', 'boxStep', 'rest', L('mid', 2)),
  combo('box-clap', 'Box Step Clap', 'boxStep', 'clap', L('mid', 3)),
  combo('cabbage-patch', 'Cabbage Patch', 'sway', 'cabbage', L('mid', 2)),
  combo('lasso', 'Lasso', 'sway', 'lasso', L('mid', 2)),
  combo('swim', 'Freestyle Swim', 'sway', 'swim', L('mid', 2)),
  combo('raise-the-roof', 'Raise the Roof', 'bounce', 'raiseRoof', L('low', 1)),
  // Upper body on the spot
  combo('shoulder-bounce', 'Shoulder Bounce', 'bounce', 'shoulderBounce', L('low', 1)),
  combo('shoulder-roll', 'Shoulder Roll', 'bounce', 'shoulderRoll', L('low', 1)),
  combo('ocean-arms', 'Ocean Arms', 'bounce', 'ocean', L('low', 1)),
  combo('ripple', 'Ripple Wave', 'sway', 'ripple', L('low', 1)),
  combo('pendulum', 'Pendulum Sway', 'sway', 'pendulum', L('low', 1)),
  combo('airplane', 'Airplane', 'sway', 'airplane', L('low', 1)),
  combo('cross-jab', 'Cross Jab', 'plant', 'crossJab', L('mid', 2)),
  combo('sky-punch', 'Sky Punch', 'plant', 'skyPunch', L('mid', 1)),
  combo('side-punch', 'Side Punch', 'plant', 'sidePunch', L('mid', 1)),
  combo('overhead-press', 'Overhead Press', 'plant', 'shoulderPress', L('mid', 1)),
  combo('push-the-walls', 'Push the Walls', 'plant', 'pushOut', L('low', 1)),
  combo('bicep-curl', 'Bicep Curl', 'bounce', 'bicepCurl', L('low', 1)),
  combo('butterfly', 'Butterfly', 'plant', 'butterfly', L('low', 1)),
  combo('cross-open', 'Cross & Open', 'plant', 'xArms', L('low', 1)),
  combo('rope-climb', 'Rope Climb', 'bounce', 'ropeClimb', L('low', 1)),
  combo('clap-groove', 'Clap Groove', 'sway', 'clapEvery', L('low', 1)),
];

const FULL: Move[] = [groove, shimmy, skater, rocket, sideStretch, bigBreath, armHug, neckStretch, reachUp];

export const MOVES: readonly Move[] = [...FULL, ...LAYERED];

const BY_ID = new Map<string, Move>();
for (const m of MOVES) {
  if (BY_ID.has(m.id)) throw new Error(`Duplicate move id ${m.id}`);
  BY_ID.set(m.id, m);
}

export function getMove(id: string): Move {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}

export function findMove(id: string): Move | undefined {
  return BY_ID.get(id);
}

export const IDLE_MOVE = groove;

/** A relaxed "ready" stance used during loading / countdown. */
export const READY_POSE: Pose = pose({ y: -0.015, r: [14, 10, 40, 70], l: [14, 10, 40, 70], handR: 0.3, handL: 0.3 });

/** Composite keys of a move for a given side. */
export function keysOf(m: Move, mirror: boolean): readonly MoveKey[] {
  return mirror && m.mirror ? m.mirrorKeys : m.keys;
}

/** Keys of one group track for a given side. */
export function trackKeys(m: Move, g: number, mirror: boolean): readonly MoveKey[] {
  const t = m.tracks[g];
  return mirror && m.mirror ? t.mirrorKeys : t.keys;
}

/** Compose an ad-hoc layered move (dev tools / tests; not in the catalogue). */
export function composeMove(footId: string, armsId: string, o: Partial<ComboOpts> = {}): Move {
  return combo(`${footId}+${armsId}`, `${footId} + ${armsId}`, footId, armsId, { level: 'mid', d: 2, ...o });
}

export { NEUTRAL, CH, G_BODY, G_ARMS, G_TORSO };
