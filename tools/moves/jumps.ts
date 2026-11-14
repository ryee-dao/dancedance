/**
 * Where does a move's motion jump? Prints the fastest joint steps (60 fps) with
 * their beat, to fix a "joint jumps between frames" validity failure.
 *
 *   npx tsx tools/moves/jumps.ts <move id> [--bpm 140] [--top 6]
 */
import { findMove } from '../../src/core/choreo/moves';
import { PoseEvaluator } from '../../src/core/coach/animator';
import { loopPlan } from '../../src/core/coach/loop';
import { J, createPose, createSkeleton, solveSkeleton } from '../../src/core/coach/skeleton';

const args = process.argv.slice(2);
const opt = (k: string): string | undefined => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const m = findMove(args[0]);
if (!m) throw new Error(`no move "${args[0]}"`);
const bpm = Number(opt('bpm') ?? 140);
const names: Record<number, string> = Object.fromEntries(Object.entries(J).map(([k, v]) => [v, k]));
const ev = new PoseEvaluator();
const pose = createPose();
const sk = createSkeleton();
const prev = new Float64Array(sk.p.length);
const rows: [number, string, number, boolean][] = [];
for (const mirrorFirst of [false, true]) {
  const plan = loopPlan(m, 60 / bpm, { mirrorFirst });
  const n = Math.ceil(plan.loopBeats * plan.period * 60);
  for (let f = 0; f <= n; f++) {
    ev.evaluate(plan, f / 60, pose);
    solveSkeleton(pose, sk);
    if (f > 0) {
      for (let j = 0; j < J.HEAD_UP; j++) {
        const d = Math.hypot(sk.p[j * 3] - prev[j * 3], sk.p[j * 3 + 1] - prev[j * 3 + 1], sk.p[j * 3 + 2] - prev[j * 3 + 2]);
        rows.push([d, names[j], f / 60 / plan.period, mirrorFirst]);
      }
    }
    prev.set(sk.p);
  }
}
// Same bound as validate.ts (60 fps).
const bound = 0.07 * (bpm / 100) * (m.parts.includes('turn') ? 1.2 : 1);
rows.sort((a, b) => b[0] - a[0]);
for (const [d, j, b, mf] of rows.slice(0, Number(opt('top') ?? 6))) {
  console.log(`${(d / bound).toFixed(2)}x  ${j.padEnd(8)} beat ${b.toFixed(2)}${mf ? '  (mirrored first)' : ''}`);
}
