import { describe, expect, it } from 'vitest';
import { PoseEvaluator } from '../coach/animator';
import { loopPlan } from '../coach/loop';
import { GROUP_CHANNELS, NUM_GROUPS } from '../coach/poses';
import { BODY, CH, J, NUM_CHANNELS, createPose, createSkeleton, mirrorPose, solveSkeleton, swingDir, type Skeleton } from '../coach/skeleton';
import { MOVES, type Move } from './moves';

const DEG = 180 / Math.PI;
const tmpA = new Float64Array(3);
const tmpB = new Float64Array(3);

/** Interior elbow bend (0 = straight) for one arm of a pose. */
function elbowBend(p: Float64Array, side: 1 | -1): number {
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
function checkSkeleton(sk: Skeleton): string[] {
  const out: string[] = [];
  const pelvis = v(sk, J.PELVIS);
  for (const [an, toe] of [[J.AN_R, J.TOE_R], [J.AN_L, J.TOE_L]]) {
    if (sk.p[an * 3 + 1] < BODY.ankleY - 0.006) out.push(`ankle below floor ${sk.p[an * 3 + 1].toFixed(3)}`);
    if (sk.p[toe * 3 + 1] < -0.012) out.push('toe below floor');
  }
  for (const j of [J.HA_R, J.HA_L, J.AN_R, J.AN_L, J.HEAD]) {
    const [x, y] = v(sk, j);
    if (Math.abs(x - pelvis[0]) > 0.62 || y < -0.01 || y > 1.42) out.push(`joint ${j} out of frame (${x.toFixed(2)}, ${y.toFixed(2)})`);
  }
  // Knees bend forward (never backward).
  for (const [h, k, a] of [[J.HIP_R, J.KN_R, J.AN_R], [J.HIP_L, J.KN_L, J.AN_L]]) {
    const hz = sk.p[h * 3 + 2], kz = sk.p[k * 3 + 2], az = sk.p[a * 3 + 2];
    if (kz < Math.min(hz, az) - 0.02) out.push('knee bends backward');
  }
  // Hands / elbows / knees must not pass through the torso or head.
  const chest = v(sk, J.CHEST);
  const head = v(sk, J.HEAD);
  const torsoZ = (pelvis[2] + chest[2]) / 2;
  for (const j of [J.HA_R, J.HA_L, J.EL_R, J.EL_L]) {
    const p = v(sk, j);
    if (segDist2D(p, pelvis, chest) < 0.075 && Math.abs(p[2] - torsoZ) < 0.045) out.push(`joint ${j} inside the torso`);
    const dh = Math.hypot(p[0] - head[0], p[1] - head[1], p[2] - head[2]);
    if (dh < BODY.headR * 0.95) out.push(`joint ${j} inside the head`);
  }
  return out;
}

describe('move catalogue', () => {
  it('has a curated catalogue of distinct, valid entries', () => {
    expect(MOVES.length).toBeGreaterThanOrEqual(80);
    const ids = new Set(MOVES.map((m) => m.id));
    const names = new Set(MOVES.map((m) => m.name));
    expect(ids.size).toBe(MOVES.length);
    expect(names.size).toBe(MOVES.length);
    // Layered entries are unique combinations.
    const combos = new Set(MOVES.filter((m) => m.layered).map((m) => `${m.foot}|${m.arms}|${m.accent ?? ''}`));
    expect(combos.size).toBe(MOVES.filter((m) => m.layered).length);
    for (const d of [1, 2, 3]) expect(MOVES.some((m) => m.difficulty === d && !m.cooldown)).toBe(true);
    for (const l of ['low', 'mid', 'high']) expect(MOVES.some((m) => m.level === l)).toBe(true);
    expect(MOVES.filter((m) => m.cooldown).length).toBeGreaterThanOrEqual(3);
  });

  it.each(MOVES.map((m) => [m.id, m] as [string, Move]))('%s: keyframes are well formed', (_id, m) => {
    expect([1, 2, 4]).toContain(m.beats);
    expect([1, 2, 3]).toContain(m.difficulty);
    for (let g = 0; g < NUM_GROUPS; g++) {
      const t = m.tracks[g];
      expect(t.keys.length).toBeGreaterThan(0);
      expect(t.mirrorKeys.length).toBe(t.keys.length);
      let last = -1;
      for (let k = 0; k < t.keys.length; k++) {
        const key = t.keys[k];
        expect(key.at).toBeGreaterThan(last);
        expect(key.at).toBeGreaterThanOrEqual(0);
        expect(key.at).toBeLessThan(m.beats);
        expect(Number.isInteger(key.at * 2)).toBe(true); // whole or half beats
        last = key.at;
        for (let c = 0; c < NUM_CHANNELS; c++) expect(Number.isFinite(key.pose[c])).toBe(true);
        // Mirrored variant is exactly the mirror image.
        const mk = t.mirrorKeys[k];
        expect(mk.at).toBe(key.at);
        const back = mirrorPose(mk.pose, createPose());
        for (const c of GROUP_CHANNELS[g]) expect(back[c]).toBeCloseTo(key.pose[c], 9);
      }
    }
    for (const k of m.keys) {
      const p = k.pose;
      for (const side of [1, -1] as const) expect(elbowBend(p, side)).toBeLessThanOrEqual(165);
      expect(p[CH.RFT_Y]).toBeGreaterThanOrEqual(0);
      expect(p[CH.LFT_Y]).toBeGreaterThanOrEqual(0);
      expect(Math.abs(p[CH.LEAN])).toBeLessThanOrEqual(30);
      expect(Math.abs(p[CH.TWIST])).toBeLessThanOrEqual(45);
      expect(p[CH.Y]).toBeGreaterThanOrEqual(-0.26);
      expect(p[CH.Y]).toBeLessThanOrEqual(0.15);
    }
    if (m.travel !== 0) expect(m.mirror).toBe(true);
    if (m.jump) expect(m.impact).toBe(true);
  });

  it.each(MOVES.map((m) => [m.id, m] as [string, Move]))('%s: plays cleanly at 60 fps (both sides, 100 and 140 BPM)', (_id, m) => {
    const ev = new PoseEvaluator();
    const pose = createPose();
    const sk = createSkeleton();
    const prev = new Float64Array(sk.p.length);
    for (const bpm of [100, 140]) {
      for (const mirrorFirst of [false, true]) {
        const plan = loopPlan(m, 60 / bpm, { mirrorFirst });
        const dur = plan.loopBeats * plan.period;
        let maxStep = 0;
        const problems = new Set<string>();
        for (let f = 0; f <= Math.ceil(dur * 60); f++) {
          ev.evaluate(plan, f / 60, pose);
          solveSkeleton(pose, sk);
          for (const pr of checkSkeleton(sk)) problems.add(pr);
          if (f > 0) {
            for (let j = 0; j < sk.p.length; j += 3) {
              const d = Math.hypot(sk.p[j] - prev[j], sk.p[j + 1] - prev[j + 1], sk.p[j + 2] - prev[j + 2]);
              if (d > maxStep) maxStep = d;
            }
          }
          prev.set(sk.p);
        }
        expect([...problems]).toEqual([]);
        // No joint jumps between 60 fps frames. Motion speeds up with tempo,
        // so the bound does too (0.07 units/frame at 100 BPM ~ 4 body-heights/s
        // peak); a real discontinuity is several times larger.
        expect(maxStep).toBeLessThan(0.07 * (bpm / 100));
      }
    }
  });
});
