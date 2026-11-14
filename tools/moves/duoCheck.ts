/**
 * Check the partner (two-player) moves: validity of both tracks, contact
 * points, bodies staying apart, speed limit, and what each suits.
 *
 *   npx tsx tools/moves/duoCheck.ts              # every partner move
 *   npx tsx tools/moves/duoCheck.ts dap lunge    # ids containing these words
 *
 * Exit code 1 when anything fails.
 */

import { partnerReport } from '../../src/core/choreo/duoCheck';
import { PARTNER_ERRORS, PARTNER_MOVES } from '../../src/core/choreo/duoMoves';

const words = process.argv.slice(2);
let failed = false;
for (const e of PARTNER_ERRORS) {
  failed = true;
  console.log(`DEFINITION ${e.id}: ${e.message}`);
}
for (const pm of PARTNER_MOVES) {
  if (words.length && !words.some((w) => pm.id.includes(w))) continue;
  const r = partnerReport(pm);
  const tags = [pm.styles.length ? pm.styles.join('/') : 'general', pm.gentle ? 'gentle' : '', pm.trade ? 'trade' : '', pm.jump ? 'jump' : ''].filter(Boolean).join(' ');
  const contacts = r.contacts.length ? ` contacts ${r.contacts.map((c) => `${c.at}:${c.dist.toFixed(3)}`).join(' ')}` : '';
  console.log(`${r.problems.length ? 'FAIL' : 'ok  '} ${pm.id.padEnd(24)} ${pm.level.padEnd(4)} d${pm.difficulty} ${pm.beats}b  limit ${r.limit.toFixed(0).padStart(3)} BPM (${r.by})  gap ${r.gap.toFixed(2)}  ${tags}${contacts}`);
  for (const p of r.problems) console.log(`       ${p}`);
  if (r.problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
