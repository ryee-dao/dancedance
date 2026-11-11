import { describe, expect, it } from 'vitest';
import { generateRoutine, type Intensity } from '../choreo/generator';
import { trackKeys } from '../choreo/moves';
import { songMap } from '../choreo/testutil';
import { PoseEvaluator, beatPosition, timeOfBeat, type PlanView } from './animator';
import { GROUP_CHANNELS, NUM_GROUPS, G_BODY, NEUTRAL, interpolateKeys, pose } from './poses';
import { CH, J, NUM_CHANNELS, createPose, createSkeleton, mirrorPose, solveSkeleton } from './skeleton';

function planFor(bpm: number, lv: Intensity, id = 'anim'): PlanView {
  const map = songMap(bpm, id);
  const r = generateRoutine(map, lv);
  return { grid: map.beats, instances: r.instances, period: 60 / bpm };
}

describe('poses', () => {
  it('mirroring twice is the identity', () => {
    const p = pose({ x: 0.1, lean: 7, twist: -12, hips: 0.03, r: [120, 20, 140, 30], l: [30, -10, 50, 40], rf: [0.2, 0.05, 0.1], lf: [-0.05, 0, -0.04], handR: 1 });
    const m = mirrorPose(mirrorPose(p, createPose()), createPose());
    for (let c = 0; c < NUM_CHANNELS; c++) expect(m[c]).toBeCloseTo(p[c], 12);
  });

  it('interpolation hits both keys exactly', () => {
    const a = pose({ r: [20, 0, 30, 10], rf: [0.2, 0, 0], y: -0.05 });
    const b = pose({ r: [170, 0, 175, 0], rf: [0.09, 0, 0], y: 0 });
    const out = createPose();
    interpolateKeys(NEUTRAL, a, b, 0, out);
    for (let c = 0; c < NUM_CHANNELS; c++) expect(out[c]).toBeCloseTo(a[c], 9);
    interpolateKeys(NEUTRAL, a, b, 1, out);
    for (let c = 0; c < NUM_CHANNELS; c++) expect(out[c]).toBeCloseTo(b[c], 9);
  });
});

describe('PoseEvaluator over a routine', () => {
  it('hits every keyframe exactly on its beat time', () => {
    for (const lv of ['chill', 'cardio', 'sweaty'] as const) {
      const plan = planFor(120, lv);
      const ev = new PoseEvaluator();
      const out = createPose();
      let checked = 0;
      for (const inst of plan.instances) {
        const mult = inst.half ? 2 : 1;
        for (let g = 0; g < NUM_GROUPS; g++) {
          for (const k of trackKeys(inst.move, g, inst.mirror)) {
            const b = inst.start + k.at * mult;
            if (b >= plan.grid.length - 1) continue;
            ev.evaluate(plan, timeOfBeat(plan, b), out, { layers: false });
            for (const c of GROUP_CHANNELS[g]) {
              let want = k.pose[c];
              if (g === G_BODY && (c === CH.X || c === CH.RFT_X || c === CH.LFT_X)) want += inst.origin;
              expect(out[c]).toBeCloseTo(want, 6);
            }
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(500);
    }
  });

  it('beat position and time agree', () => {
    const plan = planFor(126, 'cardio');
    for (const b of [-3.5, 0, 0.25, 10.5, 99.9, plan.grid.length + 4]) expect(beatPosition(plan, timeOfBeat(plan, b))).toBeCloseTo(b, 9);
  });

  it('stays continuous across a whole song at 60 fps (all levels, normal and half time)', () => {
    for (const [bpm, lv] of [[120, 'chill'], [120, 'cardio'], [120, 'sweaty'], [128, 'sweaty'], [170, 'sweaty']] as const) {
      const plan = planFor(bpm, lv, `cont-${bpm}-${lv}`);
      const ev = new PoseEvaluator();
      const p = createPose();
      const sk = createSkeleton();
      const prev = new Float64Array(sk.p.length);
      const prevPose = createPose();
      const end = plan.grid[plan.grid.length - 1] + 2;
      let maxStep = 0;
      let maxChannel = 0;
      for (let f = 0; f < end * 60; f++) {
        ev.evaluate(plan, f / 60, p);
        solveSkeleton(p, sk);
        if (f > 0) {
          for (let j = 0; j < J.HEAD_UP * 3; j += 3) maxStep = Math.max(maxStep, Math.hypot(sk.p[j] - prev[j], sk.p[j + 1] - prev[j + 1], sk.p[j + 2] - prev[j + 2]));
          for (const c of [CH.RA_E, CH.RF_E, CH.LA_E, CH.LF_E, CH.LEAN, CH.TWIST]) maxChannel = Math.max(maxChannel, Math.abs(p[c] - prevPose[c]));
        }
        prev.set(sk.p);
        prevPose.set(p);
      }
      const effBpm = bpm > 150 ? bpm / 2 : bpm;
      // Transitions between moves can take only half a beat, so allow a bit
      // more than within a move (measured peak: 0.094 at 120 BPM); turns
      // rotate the whole body, so a little more headroom (peak 0.098 at 128).
      expect(maxStep).toBeLessThan(0.085 * Math.max(1, effBpm / 100));
      expect(maxChannel).toBeLessThan(25); // degrees per frame
    }
  });
});
