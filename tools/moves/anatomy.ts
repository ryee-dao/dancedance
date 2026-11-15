/**
 * Anatomy report: runs every catalogue move (both sides first, 60 fps) and a
 * sample of generated routines (90 / 120 / 150 / 170 BPM x every level)
 * through the animator and the solver, and counts frames whose body breaks
 * an anatomical limit (src/core/coach/anatomy.ts: knees / elbows bending the
 * wrong way, bones changing length, feet through the floor or each other,
 * hands through the body, spine / neck past their range, planted feet that
 * are not flat or skate).
 *
 *   npx tsx tools/moves/anatomy.ts [--bpm 120] [--top 8] [--moves a,b] [--no-routines] [--json out.json]
 *
 * Prints, per violation kind: frames hit, moves hit, and the worst moves
 * (share of their frames, worst amount, beat and detail of the worst frame).
 */
import { writeFileSync } from 'node:fs';
import { generateRoutine, type Intensity } from '../../src/core/choreo/generator';
import { MOVES, findMove } from '../../src/core/choreo/moves';
import { songMap } from '../../src/core/choreo/testutil';
import { VIOLATIONS, scanPlan, type Violation } from '../../src/core/coach/anatomy';
import type { PlanView } from '../../src/core/coach/animator';
import { loopPlan } from '../../src/core/coach/loop';

const args = process.argv.slice(2);
const opt = (k: string): string | undefined => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const bpm = Number(opt('bpm') ?? 120);
const top = Number(opt('top') ?? 8);
const FPS = 60;

interface Worst { frames: number; total: number; max: number; beat: number; detail: string; mirror: boolean }
const perKind = new Map<Violation, Map<string, Worst>>();
for (const k of VIOLATIONS) perKind.set(k, new Map());
const framesHit = new Map<Violation, number>(VIOLATIONS.map((k) => [k, 0]));
let framesAll = 0;

function run(label: string, plan: PlanView, beats: number, mirror: boolean, moveAt?: (b: number) => string): void {
  framesAll += scanPlan(plan, beats, FPS, (hits, beat) => {
    const seen = new Set<Violation>();
    const id = moveAt ? moveAt(beat) : label;
    for (const h of hits) {
      if (!seen.has(h.kind)) {
        seen.add(h.kind);
        framesHit.set(h.kind, framesHit.get(h.kind)! + 1);
      }
      const m = perKind.get(h.kind)!;
      let w = m.get(id);
      if (!w) m.set(id, (w = { frames: 0, total: 0, max: 0, beat: 0, detail: '', mirror }));
      if (h.amount > w.max) {
        w.max = h.amount;
        w.beat = beat;
        w.detail = h.detail;
        w.mirror = mirror;
      }
    }
    for (const k of seen) perKind.get(k)!.get(id)!.frames++;
  });
}

// Frame totals per move id (for shares).
const totals = new Map<string, number>();
const ids = opt('moves') ? opt('moves')!.split(',') : MOVES.map((m) => m.id);
for (const id of ids) {
  const m = findMove(id);
  if (!m) throw new Error(`no move ${id}`);
  for (const mirrorFirst of [false, true]) {
    if (mirrorFirst && !m.mirror) continue;
    const plan = loopPlan(m, 60 / bpm, { mirrorFirst });
    const before = framesAll;
    run(m.id, plan, plan.loopBeats, mirrorFirst);
    totals.set(m.id, (totals.get(m.id) ?? 0) + framesAll - before);
  }
}
const moveFrames = framesAll;
const moveHits = new Map(framesHit);

// Routine sample.
const routineHits = new Map<Violation, number>(VIOLATIONS.map((k) => [k, 0]));
let routineFrames = 0;
if (!args.includes('--no-routines') && !opt('moves')) {
  for (const k of VIOLATIONS) framesHit.set(k, 0);
  const before = framesAll;
  for (const rb of [90, 120, 150, 170]) {
    for (const lv of ['chill', 'cardio', 'sweaty'] as Intensity[]) {
      const map = songMap(rb, `anatomy-${rb}-${lv}`);
      const r = generateRoutine(map, lv, {});
      const grid = r.times ?? map.beats;
      const plan: PlanView = { grid, instances: r.instances, period: 60 / rb };
      const byBeat = (b: number): string => {
        let id = '(groove)';
        for (const ins of r.instances) if (ins.start <= b) id = ins.move.id;
        return `routine:${id}`;
      };
      run(`routine ${rb} ${lv}`, plan, grid.length - 1, false, byBeat);
    }
  }
  routineFrames = framesAll - before;
  for (const k of VIOLATIONS) routineHits.set(k, framesHit.get(k)!);
}

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(2) : '0') + '%';
const lines: string[] = [];
lines.push(`Moves: ${ids.length} at ${bpm} BPM, ${moveFrames} frames; routines: ${routineFrames} frames`);
lines.push(`${'kind'.padEnd(10)} ${'move frames'.padStart(16)} ${'moves'.padStart(6)} ${'routine frames'.padStart(18)}`);
const summary: Record<string, { moveFrames: number; moves: number; routineFrames: number }> = {};
for (const k of VIOLATIONS) {
  const moves = [...perKind.get(k)!.keys()].filter((id) => !id.startsWith('routine:')).length;
  summary[k] = { moveFrames: moveHits.get(k)!, moves, routineFrames: routineHits.get(k)! };
  lines.push(`${k.padEnd(10)} ${`${moveHits.get(k)} (${pct(moveHits.get(k)!, moveFrames)})`.padStart(16)} ${String(moves).padStart(6)} ${`${routineHits.get(k)} (${pct(routineHits.get(k)!, routineFrames)})`.padStart(18)}`);
}
const worstOut: Record<string, unknown[]> = {};
for (const k of VIOLATIONS) {
  const m = perKind.get(k)!;
  if (!m.size) continue;
  const rows = [...m.entries()]
    .filter(([id]) => !id.startsWith('routine:'))
    .map(([id, w]) => ({ id, share: w.frames / (totals.get(id) ?? 1), ...w }))
    .sort((a, b) => b.share * (1 + b.max) - a.share * (1 + a.max));
  worstOut[k] = rows.slice(0, 40);
  lines.push(`\n${k}: worst moves`);
  for (const r of rows.slice(0, top)) lines.push(`  ${r.id.padEnd(30)} ${pct(r.frames, totals.get(r.id) ?? 1).padStart(7)}  max ${r.max.toFixed(3)}  beat ${r.beat.toFixed(2)}${r.mirror ? ' (mirrored first)' : ''}  ${r.detail}`);
  const rr = [...m.entries()].filter(([id]) => id.startsWith('routine:')).sort((a, b) => b[1].frames - a[1].frames);
  if (rr.length) lines.push(`  routines: ${rr.slice(0, 5).map(([id, w]) => `${id.slice(8)} ${w.frames}f`).join(', ')}`);
}
console.log(lines.join('\n'));
if (opt('json')) writeFileSync(opt('json')!, JSON.stringify({ summary, worst: worstOut, moveFrames, routineFrames }, null, 1));
