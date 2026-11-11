/**
 * Automatic validity checks for a move (catalogue moves and variations).
 * Pure TypeScript (no DOM). Used by the tests and by tools/moves/check.ts.
 *
 * A move is valid when:
 *   - format: 1/2/4 beats, keys on whole/half beats inside the loop, finite,
 *     mirror tracks are exact mirror images, travel => mirror, jump => impact;
 *   - joint limits at every key: elbow bend <= 165, lean <= 30, twist <= 45,
 *     root height in [-0.26, 0.15], feet never below the floor, gentle head
 *     (|nod| <= 22, |roll| <= 30, |turn| <= 40);
 *   - played at 60 fps on both sides at 100 and 140 BPM: feet on the floor,
 *     joints in frame, knees never bend backward (in the body's own frame, so
 *     turns are fine), hands / elbows never pass through the torso or head,
 *     and no joint jumps between frames (continuity).
 */

import { PoseEvaluator } from '../coach/animator';
import { loopPlan } from '../coach/loop';
import { GROUP_CHANNELS, NUM_GROUPS } from '../coach/poses';
import { BODY, CH, J, NUM_CHANNELS, createPose, createSkeleton, mirrorPose, solveSkeleton, swingDir, type Skeleton } from '../coach/skeleton';
import type { Move } from './catalog';

const DEG = 180 / Math.PI;
const tmpA = new Float64Array(3);
const tmpB = new Float64Array(3);

/** Interior elbow bend (0 = straight) for one arm of a pose. */
export function elbowBend(p: Float64Array, side: 1 | -1): number {
  const c = side === 1 ? CH.RA_E : CH.LA_E;
  swingDir(tmpA, side, p[c], p[c + 1]);
  swingDir(tmpB, side, p[c + 2], p[c + 3]);
  const d = tmpA[0] * tmpB[0] + tmpA[1] * tmpB[1] + tmpA[2] * tmpB[2];
  return Math.acos(Math.max(-1, Math.min(1, d))) * DEG;
}

function v(sk: Skeleton, j: number): [number, number, number] {
  return [sk.p[j * 3], sk.p[j * 3 + 1], sk.p[j * 3 + 2]];
}

/** Distance from point to segment in the x-y plane. */
function segDist2D(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  const x = a[0] + dx * t - p[0], y = a[1] + dy * t - p[1];
  return Math.sqrt(x * x + y * y);
}

/** Problems with a solved skeleton, as strings (empty = fine). */
export function checkSkeleton(sk: Skeleton): string[] {
  const out: string[] = [];
  const pelvis = v(sk, J.PELVIS);
  for (const [an, toe] of [[J.AN_R, J.TOE_R], [J.AN_L, J.TOE_L]]) {
    if (sk.p[an * 3 + 1] < BODY.ankleY - 0.006) out.push('ankle below floor');
    if (sk.p[toe * 3 + 1] < -0.012) out.push('toe below floor');
  }
  for (const j of [J.HA_R, J.HA_L, J.AN_R, J.AN_L, J.HEAD]) {
    const [x, y] = v(sk, j);
    if (Math.abs(x - pelvis[0]) > 0.62 || y < -0.01 || y > 1.42) out.push(`joint ${jointName(j)} out of frame`);
  }
  // Knees bend forward (never backward), in the body's own frame (turns rotate it).
  const sa = Math.sin((sk.spin * Math.PI) / 180), ca = Math.cos((sk.spin * Math.PI) / 180);
  const bz = (j: number) => sk.p[j * 3] * sa + sk.p[j * 3 + 2] * ca;
  for (const [h, k, a] of [[J.HIP_R, J.KN_R, J.AN_R], [J.HIP_L, J.KN_L, J.AN_L]]) {
    if (bz(k) < Math.min(bz(h), bz(a)) - 0.02) out.push('knee bends backward');
  }
  // Hands / elbows must not pass through the torso or head.
  const chest = v(sk, J.CHEST);
  const head = v(sk, J.HEAD);
  const torsoZ = (pelvis[2] + chest[2]) / 2;
  for (const j of [J.HA_R, J.HA_L, J.EL_R, J.EL_L]) {
    const p = v(sk, j);
    if (segDist2D(p, pelvis, chest) < 0.075 && Math.abs(p[2] - torsoZ) < 0.045) out.push(`${jointName(j)} inside the torso`);
    const dh = Math.hypot(p[0] - head[0], p[1] - head[1], p[2] - head[2]);
    if (dh < BODY.headR * 0.95) out.push(`${jointName(j)} inside the head`);
  }
  return out;
}

const JOINT_NAMES = Object.fromEntries(Object.entries(J).map(([k, i]) => [i, k]));
function jointName(j: number): string {
  return JOINT_NAMES[j] ?? String(j);
}

/** Static checks on keyframes (format + joint limits). */
export function checkKeys(m: Move): string[] {
  const out: string[] = [];
  if (![1, 2, 4].includes(m.beats)) out.push(`beats ${m.beats} not 1/2/4`);
  if (![1, 2, 3].includes(m.difficulty)) out.push(`difficulty ${m.difficulty}`);
  for (let g = 0; g < NUM_GROUPS; g++) {
    const t = m.tracks[g];
    if (!t.keys.length) out.push(`track ${g} has no keys`);
    if (t.mirrorKeys.length !== t.keys.length) out.push(`track ${g} mirror key count`);
    let last = -1;
    for (let k = 0; k < t.keys.length; k++) {
      const key = t.keys[k];
      if (!(key.at > last)) out.push(`track ${g} keys not increasing at ${key.at}`);
      if (key.at < 0 || key.at >= m.beats) out.push(`track ${g} key at ${key.at} outside the loop`);
      if (!Number.isInteger(key.at * 2)) out.push(`track ${g} key at ${key.at} not on a whole / half beat`);
      last = key.at;
      for (let c = 0; c < NUM_CHANNELS; c++) if (!Number.isFinite(key.pose[c])) out.push(`track ${g} key ${key.at} channel ${c} not finite`);
      const mk = t.mirrorKeys[k];
      if (mk) {
        const back = mirrorPose(mk.pose, createPose());
        for (const c of GROUP_CHANNELS[g]) if (Math.abs(back[c] - key.pose[c]) > 1e-9) out.push(`track ${g} mirror mismatch`);
      }
    }
  }
  for (const k of m.keys) {
    const p = k.pose;
    for (const side of [1, -1] as const) if (elbowBend(p, side) > 165) out.push(`elbow bend > 165 at ${k.at}`);
    if (p[CH.RFT_Y] < 0 || p[CH.LFT_Y] < 0) out.push(`foot lift < 0 at ${k.at}`);
    if (Math.abs(p[CH.LEAN]) > 30) out.push(`lean > 30 at ${k.at}`);
    if (Math.abs(p[CH.TWIST]) > 45) out.push(`twist > 45 at ${k.at}`);
    if (p[CH.Y] < -0.26 || p[CH.Y] > 0.15) out.push(`root height out of range at ${k.at}`);
    if (Math.abs(p[CH.HEAD_NOD]) > 22) out.push(`head nod > 22 (keep it gentle) at ${k.at}`);
    if (Math.abs(p[CH.HEAD_ROLL]) > 30) out.push(`head roll > 30 at ${k.at}`);
    if (Math.abs(p[CH.HEAD_TURN]) > 40) out.push(`head turn > 40 at ${k.at}`);
    if (Math.abs(p[CH.HIPS]) > 0.09) out.push(`hip shift > 0.09 at ${k.at}`);
    if (Math.abs(p[CH.HIP_TILT]) > 14) out.push(`hip tilt > 14 at ${k.at}`);
    if (Math.abs(p[CH.CHEST_X]) > 0.07) out.push(`chest slide > 0.07 at ${k.at}`);
  }
  if (m.travel !== 0 && !m.mirror) out.push('travels but has no mirror (would drift off stage)');
  if (m.jump && !m.impact) out.push('jump without impact');
  return [...new Set(out)];
}

export interface PlayCheckOptions {
  bpms?: readonly number[];
  fps?: number;
}

/**
 * Play the move in a loop (both sides) and check every frame. Returns
 * problems (deduplicated) and the worst per-frame joint step relative to the
 * allowed bound (> 1 = a jump).
 */
export function checkPlayback(m: Move, o: PlayCheckOptions = {}): { problems: string[]; stepRatio: number } {
  const ev = new PoseEvaluator();
  const pose = createPose();
  const sk = createSkeleton();
  const prev = new Float64Array(sk.p.length);
  const fps = o.fps ?? 60;
  const problems = new Set<string>();
  let ratio = 0;
  for (const bpm of o.bpms ?? [100, 140]) {
    for (const mirrorFirst of [false, true]) {
      const plan = loopPlan(m, 60 / bpm, { mirrorFirst });
      const dur = plan.loopBeats * plan.period;
      let maxStep = 0;
      const n = Math.ceil(dur * fps);
      for (let f = 0; f <= n; f++) {
        ev.evaluate(plan, f / fps, pose);
        solveSkeleton(pose, sk);
        for (const pr of checkSkeleton(sk)) problems.add(pr);
        if (f > 0) {
          // Real joints only (HEAD_UP / HEAD_FWD are orientation helpers a unit away).
          for (let j = 0; j < J.HEAD_UP * 3; j += 3) {
            const d = Math.hypot(sk.p[j] - prev[j], sk.p[j + 1] - prev[j + 1], sk.p[j + 2] - prev[j + 2]);
            if (d > maxStep) maxStep = d;
          }
        }
        prev.set(sk.p);
      }
      // Motion speeds up with tempo, so the bound does too (0.07 units/frame at
      // 100 BPM, 60 fps ~ 4 body-heights/s peak); a real discontinuity is several
      // times larger. Turns rotate the whole body (hands sweep a circle): a
      // little more headroom.
      const bound = 0.07 * (bpm / 100) * (60 / fps) * (m.parts.includes('turn') ? 1.2 : 1);
      ratio = Math.max(ratio, maxStep / bound);
    }
  }
  if (ratio >= 1) problems.add(`joint jumps between frames (${ratio.toFixed(2)}x the limit)`);
  return { problems: [...problems], stepRatio: ratio };
}

/** Every validity problem of a move (empty = valid). */
export function validateMove(m: Move, o: PlayCheckOptions = {}): string[] {
  return [...checkKeys(m), ...checkPlayback(m, o).problems];
}
