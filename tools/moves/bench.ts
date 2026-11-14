/**
 * Figure drawing cost, headless: the coach bench (/coach-demo.html?mode=bench)
 * draws a few frames of every catalogue move in each look and reports the
 * mean ms per figure (Full tier = paths; --sprites = the sprite tiers' blits
 * after a warm pass). Medians of --runs runs.
 *
 *   npx tsx tools/moves/bench.ts [--sprites] [--runs 5] [--param cam=4.2,piv=0.55,feet=0] [--at <rev>]
 *
 * Headless Chromium on a laptop, not the TV: compare numbers only with each
 * other (same machine, same run).
 */
import { checkoutAt, launch, startVite } from './headless';

const args = process.argv.slice(2);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const runs = Number(opt('runs') ?? 5);
const p = new URLSearchParams({ mode: 'bench', reps: opt('reps') ?? '2' });
if (args.includes('--sprites')) p.set('sprites', '1');
for (const kv of (opt('param') ?? '').split(',').filter(Boolean)) {
  const i = kv.indexOf('=');
  p.set(kv.slice(0, i), kv.slice(i + 1));
}
const at = opt('at') ? checkoutAt(opt('at')!) : null;
const server = await startVite(opt('url'), at?.root);
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.viewport(1920, 1080);
  const all: Record<string, number[]> = {};
  for (let r = 0; r < runs; r++) {
    await page.open(`${server.url}/coach-demo.html?${p}`, '!!(window.__demo && window.__demo.ready)', 300_000);
    const res = await page.eval<Record<string, number>>('window.__demo.result');
    for (const [k, v] of Object.entries(res)) (all[k] ??= []).push(v);
  }
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, med(v)]))), `ms/figure (median of ${runs}; ${p})`);
} finally {
  await browser.close();
  await server.close();
  at?.cleanup();
}
