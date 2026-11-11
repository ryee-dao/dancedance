/**
 * Precompute the validated move pool: generate every variation candidate,
 * validate each (validate.ts), keep counted variations only when they are
 * clearly different from every base move and every variation already kept
 * (similarity.ts), and write src/core/choreo/pool.json.
 *
 *   npx tsx tools/moves/pool.ts             # write pool.json + print the report
 *   npx tsx tools/moves/pool.ts --dry       # report only
 *   npx tsx tools/moves/pool.ts --sample 150 --out <file>   # also write a stratified
 *        random sample of accepted counted variations + every borderline one (ids, one per line)
 *
 * Deterministic: same catalogue -> byte-identical pool.json.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashString, mulberry32 } from '../../src/core/choreo/generator';
import { MOVES } from '../../src/core/choreo/moves';
import { catalogueHash } from '../../src/core/choreo/pool';
import { motionSignature, moveDistance, VARIATION_THRESHOLD, type MotionSig } from '../../src/core/choreo/similarity';
import { validateMove } from '../../src/core/choreo/validate';
import { buildVariation, isCounted, variationCandidates, type VariationSpec } from '../../src/core/choreo/variations';
import type { Move } from '../../src/core/choreo/catalog';

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dry = args.includes('--dry');
const threshold = Number(opt('threshold') ?? VARIATION_THRESHOLD);
const sampleN = Number(opt('sample') ?? 0);
const sampleOut = opt('out');

const t0 = Date.now();
const candidates = variationCandidates();
// Counted first (type priority), then ornaments; deterministic hash order inside a type.
const PRIORITY: Record<string, number> = { alt: 0, double: 1, half: 2, low: 3, combo: 4, hips: 5, clap4: 6, hit4: 7, diag: 8, spin: 9 };
candidates.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || hashString(a.id) - hashString(b.id) || (a.id < b.id ? -1 : 1));

const kept: MotionSig[] = MOVES.filter((m) => !m.cooldown && !m.idle).map(motionSignature);
const stats: Record<string, { candidates: number; invalid: number; notUnique: number; accepted: number }> = {};
const accepted: { spec: VariationSpec; move: Move; nearest: number; near: string }[] = [];
const rejectedNear: { id: string; near: string; d: number }[] = [];
const invalidReasons = new Map<string, number>();
for (const v of candidates) {
  const s = (stats[v.type] ??= { candidates: 0, invalid: 0, notUnique: 0, accepted: 0 });
  s.candidates++;
  let m: Move;
  try {
    m = buildVariation(v);
  } catch (e) {
    s.invalid++;
    invalidReasons.set(`build: ${(e as Error).message.split(':').pop()}`, (invalidReasons.get('build') ?? 0) + 1);
    continue;
  }
  const problems = validateMove(m);
  if (problems.length) {
    s.invalid++;
    for (const p of problems) {
      const k = p.replace(/[\d.]+x/, 'Nx').replace(/ at [\d.]+$/, '');
      invalidReasons.set(k, (invalidReasons.get(k) ?? 0) + 1);
    }
    continue;
  }
  if (isCounted(v.type)) {
    const sig = motionSignature(m);
    let near = '', nd = Infinity;
    for (const k of kept) {
      const d = moveDistance(sig, k, nd);
      if (d.total < nd) {
        nd = d.total;
        near = k.id;
        if (nd < threshold * 0.5) break;
      }
    }
    if (nd < threshold) {
      s.notUnique++;
      rejectedNear.push({ id: v.id, near, d: nd });
      continue;
    }
    kept.push(sig);
    accepted.push({ spec: v, move: m, nearest: nd, near });
  } else {
    accepted.push({ spec: v, move: m, nearest: Infinity, near: '' });
  }
  s.accepted++;
}

const counted = accepted.filter((a) => isCounted(a.spec.type));
const ornaments = accepted.filter((a) => !isCounted(a.spec.type));
const base = MOVES.filter((m) => !m.cooldown && !m.idle).length;
console.log(`Base moves: ${MOVES.length} (${base} dance moves + ${MOVES.length - base} cooldown/idle)`);
console.log(`Candidates: ${candidates.length}`);
for (const [t, s] of Object.entries(stats)) console.log(`  ${t.padEnd(6)} candidates ${String(s.candidates).padStart(5)}  invalid ${String(s.invalid).padStart(4)}  not unique ${String(s.notUnique).padStart(5)}  accepted ${String(s.accepted).padStart(5)}${isCounted(t as VariationSpec['type']) ? '' : '  (ornament)'}`);
console.log(`Counted variations accepted: ${counted.length}; unique moves in the pool: ${base + counted.length}; ornamented combinations: ${ornaments.length}`);
console.log('Invalid reasons:');
for (const [k, n] of [...invalidReasons].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${n}  ${k}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);

if (!dry) {
  const file = {
    catalogueHash: catalogueHash(),
    threshold,
    stats: {
      baseMoves: MOVES.length,
      candidates: candidates.length,
      counted: counted.length,
      ornaments: ornaments.length,
      byType: stats,
    },
    variations: accepted
      .slice()
      .sort((a, b) => (a.spec.id < b.spec.id ? -1 : 1))
      .map((a) => [a.spec.id, a.spec.base, a.spec.type, ...(a.spec.foot ? [a.spec.foot, a.spec.arms] : [])]),
  };
  const out = fileURLToPath(new URL('../../src/core/choreo/pool.json', import.meta.url));
  // One variation per line keeps diffs readable.
  const json = JSON.stringify(file, null, 1).replace(/\[\n\s+("[^"]*"(?:,\n\s+"[^"]*")*)\n\s+\]/g, (_m, inner: string) => `[${inner.replace(/,\n\s+/g, ', ')}]`);
  writeFileSync(out, json + '\n');
  console.log(`Wrote ${out}`);
}

if (sampleN && sampleOut) {
  // Stratified by family file x type, plus every borderline accept / reject.
  const rng = mulberry32(12345);
  const groups = new Map<string, typeof counted>();
  for (const a of counted) {
    const k = `${a.move.families[0]}|${a.spec.type}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(a);
  }
  const keys = [...groups.keys()].sort();
  const pick: string[] = [];
  let round = 0;
  while (pick.length < sampleN && round < 50) {
    for (const k of keys) {
      const g = groups.get(k)!;
      if (round < g.length && pick.length < sampleN) {
        const i = Math.floor(rng() * g.length);
        const [a] = g.splice(i, 1);
        pick.push(a.spec.id);
      }
    }
    round++;
  }
  const borderAcc = counted.filter((a) => a.nearest < threshold * 1.15).map((a) => `${a.spec.id} ${a.near} ${a.nearest.toFixed(3)}`);
  const borderRej = rejectedNear.filter((r) => r.d > threshold * 0.85).map((r) => `${r.id} ${r.near} ${r.d.toFixed(3)}`);
  writeFileSync(sampleOut, [...pick.map((p) => `S ${p}`), ...borderAcc.map((b) => `A ${b}`), ...borderRej.map((b) => `R ${b}`)].join('\n') + '\n');
  console.log(`Sample: ${pick.length}; borderline accepted ${borderAcc.length}, borderline rejected ${borderRej.length} -> ${sampleOut}`);
}
