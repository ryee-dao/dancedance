/**
 * Checks for partner moves (duoMoves.ts): per-half key checks, looped
 * playback of the whole move for both players, and contact points lining up.
 * Pure TypeScript (no DOM). Used by the tests and the authoring probe.
 */

import { PoseEvaluator } from '../coach/animator';
import { createPose, createSkeleton, solveSkeleton, J, type Skeleton } from '../coach/skeleton';
import { partnerLoop } from './duo';
import { DUO_HOME, partnerDepth, type PartnerMove, type Player } from './duoMoves';
import { checkKeys, checkSkeleton } from './validate';

/** Solved skeletons of both players at move beat `b` (pair space: P1 home at -DUO_HOME/2), plus depth. */
export function partnerFrame(pm: PartnerMove, b: number, bpm = 120): { sk: [Skeleton, Skeleton]; z: [number, number] } {
  const per = 60 / bpm;
  const sk: [Skeleton, Skeleton] = [createSkeleton(), createSkeleton()];
  const spins: number[] = [];
  for (const p of [1, 2] as const) {
    const plan = partnerLoop(pm, p, per);
    const ev = new PoseEvaluator();
    const q = createPose();
    ev.evaluate(plan, (b + pm.beats) * per, q, { layers: false });
    solveSkeleton(q, sk[p - 1]);
    spins.push(sk[p - 1].spin);
  }
  const z = partnerDepth(pm, b, spins[0], spins[1], [0, 0]);
  return { sk, z };
}

/** World position of a player's joint in pair space. */
export function jointWorld(f: { sk: [Skeleton, Skeleton]; z: [number, number] }, player: Player, j: number): [number, number, number] {
  const s = f.sk[player - 1];
  const home = player === 1 ? -DUO_HOME / 2 : DUO_HOME / 2;
  return [home + s.p[j * 3], s.p[j * 3 + 1], s.p[j * 3 + 2] + f.z[player - 1]];
}

/** Contact distances (figure units) of every declared contact. */
export function contactReport(pm: PartnerMove): { at: number; dist: number; tol: number }[] {
  return pm.contacts.map((c) => {
    const f = partnerFrame(pm, c.at);
    const a = jointWorld(f, c.a[0], c.a[1]);
    const b = jointWorld(f, c.b[0], c.b[1]);
    return { at: c.at, dist: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), tol: c.tol ?? 0.07 };
  });
}

/** Every validity problem of a partner move (empty = valid). */
export function validatePartner(pm: PartnerMove, bpms: readonly number[] = [100, 140]): string[] {
  const out = new Set<string>();
  for (const [p, moves] of [[1, pm.p1], [2, pm.p2]] as const) {
    for (const m of moves) for (const pr of checkKeys(m)) out.add(`P${p} ${m.id}: ${pr}`);
  }
  const fps = 60;
  for (const bpm of bpms) {
    for (const p of [1, 2] as const) {
      const plan = partnerLoop(pm, p, 60 / bpm);
      const ev = new PoseEvaluator();
      const q = createPose();
      const sk = createSkeleton();
      const prev = new Float64Array(sk.p.length);
      const dur = plan.loopBeats * plan.period;
      let maxStep = 0;
      const n = Math.ceil(dur * fps);
      for (let f = 0; f <= n; f++) {
        ev.evaluate(plan, f / fps + pm.beats * plan.period, q);
        solveSkeleton(q, sk);
        for (const pr of checkSkeleton(sk)) out.add(`P${p}: ${pr}`);
        if (f > 0) {
          for (let j = 0; j < J.HEAD_UP * 3; j += 3) {
            const d = Math.hypot(sk.p[j] - prev[j], sk.p[j + 1] - prev[j + 1], sk.p[j + 2] - prev[j + 2]);
            if (d > maxStep) maxStep = d;
          }
        }
        prev.set(sk.p);
      }
      const turn = pm.p1.some((m) => m.parts.includes('turn'));
      const bound = 0.07 * (bpm / 100) * (60 / fps) * (turn ? 1.2 : 1);
      if (maxStep / bound >= 1) out.add(`P${p}: joint jumps between frames (${(maxStep / bound).toFixed(2)}x the limit at ${bpm} BPM)`);
    }
  }
  return [...out];
}
