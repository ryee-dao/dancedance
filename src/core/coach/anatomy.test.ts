import { describe, expect, it } from 'vitest';
import { generateRoutine, type Intensity } from '../choreo/generator';
import { MOVES } from '../choreo/moves';
import { songMap } from '../choreo/testutil';
import { VIOLATIONS, scanPlan, type Violation } from './anatomy';
import { PoseEvaluator, type PlanView } from './animator';
import { FOOT_LEN, FOOT_TOE_Y, shoeAxis } from './foot';
import { loopPlan } from './loop';
import { BODY, CH, J, createPose, createSkeleton, solveSkeleton } from './skeleton';

/** Camera views the sheets / bench use (deg of turn added to the pose). */
const VIEWS = [0, 45, 90, 180];

describe('feet', () => {
  it('a planted, unpitched foot is flat on the floor, full length, and drawn with a level sole in every view (all moves)', () => {
    const ev = new PoseEvaluator();
    const pose = createPose();
    const sk = createSkeleton();
    const ax = new Float64Array(3);
    const bad: string[] = [];
    let planted = 0;
    for (const m of MOVES) {
      const plan = loopPlan(m, 0.5);
      for (let f = 0; f <= plan.loopBeats * 8; f++) {
        const t = (f / 8) * 0.5;
        for (const view of VIEWS) {
          ev.evaluate(plan, t, pose);
          pose[CH.SPIN] += view;
          solveSkeleton(pose, sk);
          if (pose[CH.Y] > 0.002) continue;
          for (let s = 0; s < 2; s++) {
            const an = s === 0 ? J.AN_R : J.AN_L, toe = s === 0 ? J.TOE_R : J.TOE_L;
            const p = sk.p;
            if (p[an * 3 + 1] - BODY.ankleY > 0.002 || Math.abs(pose[s === 0 ? CH.PITCH_R : CH.PITCH_L]) > 0.05) continue;
            planted++;
            const len = Math.hypot(p[toe * 3] - p[an * 3], p[toe * 3 + 1] - p[an * 3 + 1], p[toe * 3 + 2] - p[an * 3 + 2]);
            shoeAxis(p, an, toe, s === 0 ? 1 : -1, pose[CH.SPIN], ax);
            const slope = (Math.atan2(Math.abs(ax[1]), Math.abs(ax[0])) * 180) / Math.PI;
            if (Math.abs(p[toe * 3 + 1] - FOOT_TOE_Y) > 0.003 || Math.abs(len - FOOT_LEN) > 1e-6 || slope > 3) {
              bad.push(`${m.id} beat ${(f / 8).toFixed(2)} view ${view} ${s ? 'L' : 'R'}: toe y ${p[toe * 3 + 1].toFixed(3)} len ${len.toFixed(3)} sole ${slope.toFixed(1)} deg`);
            }
          }
        }
      }
    }
    expect(planted).toBeGreaterThan(100_000);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('a foot up on the ball or digging its heel is drawn visibly tipped, the right way', () => {
    const pose = createPose();
    const sk = createSkeleton();
    const ax = new Float64Array(3);
    for (const view of VIEWS) {
      for (const pitch of [-25, 20, 40]) {
        pose.fill(0);
        pose[CH.RFT_X] = 0.09;
        pose[CH.LFT_X] = -0.09;
        pose[CH.PITCH_R] = pitch;
        pose[CH.SPIN] = view;
        solveSkeleton(pose, sk);
        // The toe stays on the floor when up on the ball; the heel stays down on a heel dig.
        if (pitch > 0) expect(sk.p[J.TOE_R * 3 + 1]).toBeCloseTo(FOOT_TOE_Y, 3);
        else expect(sk.p[J.AN_R * 3 + 1]).toBeCloseTo(BODY.ankleY, 6);
        shoeAxis(sk.p, J.AN_R, J.TOE_R, 1, view, ax);
        const down = (Math.atan2(ax[1], Math.abs(ax[0])) * 180) / Math.PI; // + = toes down on the screen
        if (pitch > 0) expect(down, `view ${view} pitch ${pitch}`).toBeGreaterThan(pitch * 0.6);
        else expect(down, `view ${view} pitch ${pitch}`).toBeLessThan(pitch * 0.6);
      }
    }
  });
});

/** Kinds that no move or routine frame may break any more. */
const NEVER: readonly Violation[] = ['kneeBack', 'kneeTwist', 'bone', 'floor', 'flatFoot', 'handHead', 'twist', 'lean', 'neck'];
/**
 * Kinds still found in a few crossing / gliding / arm-wrapping moves (see
 * tools/moves/anatomy.ts): a ratchet, frames at most (catalogue, 120 BPM, 60 fps,
 * both sides) and moves at most. Lower them when moves are fixed.
 */
const CAP: Partial<Record<Violation, { frames: number; moves: number }>> = {
  elbowFold: { frames: 120, moves: 4 }, // forearms swinging right past the upper arm (tricep presses)
  elbowBack: { frames: 900, moves: 30 },
  legsCross: { frames: 1800, moves: 40 },
  footSlide: { frames: 1300, moves: 35 },
  float: { frames: 10, moves: 2 },
  handTorso: { frames: 20, moves: 2 },
};

describe('anatomy', () => {
  it('every move stays within the body limits (both sides first, 120 BPM)', () => {
    const frames = new Map<Violation, number>(VIOLATIONS.map((k) => [k, 0]));
    const moves = new Map<Violation, Set<string>>(VIOLATIONS.map((k) => [k, new Set()]));
    const examples: string[] = [];
    for (const m of MOVES) {
      for (const mirrorFirst of m.mirror ? [false, true] : [false]) {
        const plan = loopPlan(m, 0.5, { mirrorFirst });
        scanPlan(plan, plan.loopBeats, 60, (hits, beat) => {
          const seen = new Set<Violation>();
          for (const h of hits) {
            if (seen.has(h.kind)) continue;
            seen.add(h.kind);
            frames.set(h.kind, frames.get(h.kind)! + 1);
            moves.get(h.kind)!.add(m.id);
            if (NEVER.includes(h.kind) && examples.length < 10) examples.push(`${m.id} beat ${beat.toFixed(2)}: ${h.detail}`);
          }
        });
      }
    }
    expect(examples).toEqual([]);
    for (const [k, cap] of Object.entries(CAP) as [Violation, { frames: number; moves: number }][]) {
      expect(frames.get(k), `${k} frames`).toBeLessThanOrEqual(cap.frames);
      expect(moves.get(k)!.size, `${k} moves (${[...moves.get(k)!].slice(0, 8).join(', ')})`).toBeLessThanOrEqual(cap.moves);
    }
  });

  it('generated routines stay within the body limits (90 / 120 / 150 / 170 BPM, every level)', () => {
    const examples: string[] = [];
    let total = 0;
    const capped = new Map<Violation, number>();
    for (const bpm of [90, 120, 150, 170]) {
      for (const lv of ['chill', 'cardio', 'sweaty'] as Intensity[]) {
        const map = songMap(bpm, `anatomy-${bpm}-${lv}`);
        const r = generateRoutine(map, lv, {});
        const grid = r.times ?? map.beats;
        const plan: PlanView = { grid, instances: r.instances, period: 60 / bpm };
        total += scanPlan(plan, grid.length - 1, 30, (hits, beat) => {
          for (const h of hits) {
            if (NEVER.includes(h.kind)) {
              if (examples.length < 10) examples.push(`${bpm} ${lv} beat ${beat.toFixed(1)}: ${h.detail}`);
            } else capped.set(h.kind, (capped.get(h.kind) ?? 0) + 1);
          }
        });
      }
    }
    expect(examples).toEqual([]);
    // The rest: a small share of the frames.
    for (const [k, n] of capped) expect(n / total, k).toBeLessThan(0.01);
  });
});
