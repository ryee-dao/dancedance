/**
 * Check the move catalogue: validity and uniqueness.
 *
 *   npx tsx tools/moves/check.ts                  # every family file
 *   npx tsx tools/moves/check.ts --family rock    # one file (compared against ALL moves)
 *   npx tsx tools/moves/check.ts --family rock --near 8   # also list each move's nearest neighbours
 *   npx tsx tools/moves/check.ts --pairs 0.04,0.09        # all pairs with distance in a range (threshold tuning)
 *   npx tsx tools/moves/check.ts --threshold 0.07         # override the uniqueness threshold
 *
 * Reports definition errors, validity problems (validate.ts) and
 * near-duplicates (similarity.ts: distance < threshold), including against
 * moves in other files. Exit code 1 when anything fails.
 */

import { CATALOGUE_ERRORS, MOVES } from '../../src/core/choreo/moves';
import { motionSignature, moveDistance, UNIQUE_THRESHOLD, type MotionSig } from '../../src/core/choreo/similarity';
import { validateMove } from '../../src/core/choreo/validate';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const family = opt('family');
const threshold = Number(opt('threshold') ?? UNIQUE_THRESHOLD);
const nearN = Number(opt('near') ?? 0);
const pairs = opt('pairs');

let failed = false;
const errs = CATALOGUE_ERRORS.filter((e) => !family || e.file === family);
if (errs.length) {
  failed = true;
  console.log('Definition errors:');
  for (const e of errs) console.log(`  [${e.file}] ${e.message}`);
}

const mine = MOVES.filter((m) => !family || m.file === family);
if (family && !MOVES.some((m) => m.file === family) && !errs.length) console.log(`No moves in family file "${family}".`);

// Validity.
let invalid = 0;
for (const m of mine) {
  const p = validateMove(m);
  if (p.length) {
    invalid++;
    failed = true;
    console.log(`INVALID ${m.file}/${m.id}: ${p.join('; ')}`);
  }
}

// Uniqueness.
const t0 = Date.now();
const sigs = new Map<string, MotionSig>();
for (const m of MOVES) sigs.set(m.id, motionSignature(m));
const byId = new Map(MOVES.map((m) => [m.id, m]));
const label = (id: string) => `${byId.get(id)!.file}/${id}`;
const dupes: string[] = [];
const seen = new Set<string>();
for (const m of mine) {
  const a = sigs.get(m.id)!;
  const near: { id: string; total: number; pose: number; rhythm: number }[] = [];
  for (const o of MOVES) {
    if (o.id === m.id) continue;
    const d = moveDistance(a, sigs.get(o.id)!, nearN ? Infinity : threshold);
    near.push({ id: o.id, total: d.total, pose: d.pose, rhythm: d.rhythm });
    if (d.total < threshold) {
      const key = [m.id, o.id].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        dupes.push(`NEAR-DUPLICATE ${label(m.id)} ~ ${label(o.id)}: ${d.total.toFixed(3)} (pose ${d.pose.toFixed(3)}, rhythm ${d.rhythm.toFixed(2)})`);
      }
    }
  }
  if (nearN) {
    near.sort((x, y) => x.total - y.total);
    console.log(`${label(m.id)} nearest: ${near.slice(0, nearN).map((n) => `${n.id} ${n.total.toFixed(3)}`).join(', ')}`);
  }
}
if (dupes.length) {
  failed = true;
  for (const d of dupes) console.log(d);
}

if (pairs) {
  const [lo, hi] = pairs.split(',').map(Number);
  const out: [number, string][] = [];
  for (let i = 0; i < mine.length; i++) {
    for (const o of MOVES) {
      if (o.id <= mine[i].id && mine.includes(o)) continue;
      if (o.id === mine[i].id) continue;
      const d = moveDistance(sigs.get(mine[i].id)!, sigs.get(o.id)!, hi);
      if (d.total >= lo && d.total <= hi) out.push([d.total, `${mine[i].id},${o.id}  ${d.total.toFixed(3)} (pose ${d.pose.toFixed(3)} rhythm ${d.rhythm.toFixed(2)})`]);
    }
  }
  out.sort((x, y) => x[0] - y[0]);
  for (const [, s] of out) console.log(`PAIR ${s}`);
}

console.log(
  `${family ? `[${family}] ` : ''}${mine.length} moves checked (${MOVES.length} in the catalogue): ${invalid} invalid, ${dupes.length} near-duplicate pair(s) below ${threshold} (${Date.now() - t0} ms).`,
);
process.exit(failed ? 1 : 0);
