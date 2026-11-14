/**
 * Render what the coach actually draws, headless, to PNG files.
 *
 * Starts the Vite dev server on a free port (or uses --url), opens the coach
 * bench (/coach-demo.html) or the duo bench (/duo-demo.html) in a local
 * headless Chromium (tools/moves/headless.ts) and saves the canvases.
 *
 *   # contact sheet: each move x 10 frames, one row per look (classic / human / sticker)
 *   npx tsx tools/moves/sheet.ts --moves the-whip,nae-nae
 *   npx tsx tools/moves/sheet.ts --family urban            # every move of a family file (paged)
 *   npx tsx tools/moves/sheet.ts --genre trap              # a genre set (GENRE_MOVES)
 *   npx tsx tools/moves/sheet.ts --signatures              # the SONG_SIGNATURES nod moves
 *
 *   # one move, big: 12 frames over the move (--frames, --span beats), every look,
 *   # plus a side view (camera at 90 deg) and a motion-path cell
 *   npx tsx tools/moves/sheet.ts --strip dougie
 *
 *   # the real stage (background, name strip) of one move at chosen beats, 3 looks side by side
 *   npx tsx tools/moves/sheet.ts --gallery dougie --beats 0,0.5,1,1.5
 *
 *   # two-player partner moves (duo bench), one row per look
 *   npx tsx tools/moves/sheet.ts --duo duo-two-hand-turn,duo-back-lean
 *   npx tsx tools/moves/sheet.ts --duo all
 *
 * Common options:
 *   --out <dir>        output directory (default $TMPDIR/dancedance-sheets)
 *   --name <base>      file name base (default derived from the selection)
 *   --bpm <n>          tempo (default 120)
 *   --styles a,b,c     looks (default classic,human,sticker)
 *   --frames <n>       frames per row (default 10; --strip 12)
 *   --span <beats>     beats the frames cover (default: two loops of the move)
 *   --views 0,90       one row per camera yaw (90 = from the side: shows motion
 *                      toward / away from the viewer; 45 = a quarter-profile preview)
 *   --trail            add a cell with the hand / toe / head paths over the span
 *   --per <n>          moves per page (default 8; long selections write page files)
 *   --cw / --ch <px>   cell size
 *   --build female|male
 *   --at <rev>         render the app as it was at that revision (before / after,
 *                      e.g. --at HEAD~1 --name before); ids are looked up there
 *   --url <http://..>  use a running dev server instead of starting one
 *
 * Prints the written paths. Images are scratch output: never commit them.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkoutAt, launch, startVite, type Page } from './headless';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string): boolean => args.includes(`--${name}`);

if (flag('help') || flag('h') || !args.length) {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL(import.meta.url), 'utf8'));
  console.log(src.slice(src.indexOf('/**') + 3, src.indexOf('*/')).replace(/^ \* ?/gm, ''));
  process.exit(args.length ? 0 : 1);
}

const out = resolve(opt('out') ?? join(tmpdir(), 'dancedance-sheets'));
mkdirSync(out, { recursive: true });
const bpm = Number(opt('bpm') ?? 120);
const styles = opt('styles') ?? 'classic,human,sticker';
const build = opt('build');
const per = Number(opt('per') ?? 8);
const written: string[] = [];

async function moveIds(): Promise<{ ids: string[]; name: string } | null> {
  if (opt('moves')) return { ids: opt('moves')!.split(','), name: opt('moves')!.split(',').slice(0, 3).join('+') };
  if (opt('family')) {
    const { MOVES } = await import('../../src/core/choreo/moves');
    return { ids: MOVES.filter((m) => m.file === opt('family')).map((m) => m.id), name: `family-${opt('family')}` };
  }
  if (opt('genre')) {
    const { GENRE_MOVES } = await import('../../src/core/choreo/genres');
    const g = opt('genre') as keyof typeof GENRE_MOVES;
    if (!GENRE_MOVES[g]) throw new Error(`unknown genre set "${g}" (${Object.keys(GENRE_MOVES).join(' ')})`);
    return { ids: [...GENRE_MOVES[g]], name: `genre-${g}` };
  }
  if (flag('signatures')) {
    const { signatureMoveIds } = await import('../../src/core/choreo/songStyle');
    return { ids: signatureMoveIds(), name: 'signatures' };
  }
  return null;
}

function common(extra: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  const all: Record<string, string | number | undefined> = { bpm, build, ...extra };
  for (const [k, v] of Object.entries(all)) if (v !== undefined && v !== '') p.set(k, String(v));
  return p.toString();
}

async function save(page: Page, file: string): Promise<void> {
  const png = await page.canvasPng();
  const path = join(out, file);
  writeFileSync(path, png);
  written.push(path);
}

const at = opt('at') ? checkoutAt(opt('at')!) : null;
const server = await startVite(opt('url'), at?.root);
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.viewport(1600, 1000);
  const base = server.url;

  const sel = await moveIds();
  if (sel) {
    // Contact sheet(s), paged.
    const { MOVES } = await import('../../src/core/choreo/moves');
    const known = new Set(MOVES.map((m) => m.id));
    const missing = sel.ids.filter((id) => !known.has(id) && !id.includes('~'));
    if (missing.length && !at) console.warn(`not in the catalogue (skipped unless a pool variation): ${missing.join(', ')}`);
    const pages = Math.max(1, Math.ceil(sel.ids.length / per));
    const name = opt('name') ?? sel.name;
    for (let pg = 0; pg < pages; pg++) {
      const ids = sel.ids.slice(pg * per, pg * per + per);
      const q = common({
        mode: 'sheet', moves: ids.join(','), styles, frames: opt('frames') ?? 10, span: opt('span'), views: opt('views'),
        trail: flag('trail') ? 1 : undefined, cw: opt('cw'), ch: opt('ch'), per: 999,
      });
      await page.open(`${base}/coach-demo.html?${q}`);
      await save(page, `${name}${pages > 1 ? `-p${pg + 1}` : ''}.png`);
    }
  }

  if (opt('strip')) {
    // One move, big: every look, front + side view, motion paths.
    const id = opt('strip')!;
    const q = common({
      mode: 'sheet', moves: id, styles, frames: opt('frames') ?? 12, span: opt('span'), views: opt('views') ?? '0,90',
      trail: 1, cw: opt('cw') ?? 220, ch: opt('ch') ?? 300,
    });
    await page.open(`${base}/coach-demo.html?${q}`);
    await save(page, `${opt('name') ?? id}-strip.png`);
  }

  if (opt('gallery')) {
    // The real stage at chosen beats, three looks side by side, one PNG per beat.
    const id = opt('gallery')!;
    const beats = (opt('beats') ?? '0,0.5,1,1.5,2,2.5,3,3.5').split(',').map(Number);
    await page.viewport(Number(opt('w') ?? 1500), Number(opt('h') ?? 640));
    await page.open(`${base}/coach-demo.html?${common({ mode: 'gallery', move: id, compare: 1, ui: 0, freeze: 1, beat: beats[0] })}`);
    for (const b of beats) {
      await page.eval(`(window.__demo.at(${b}), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`);
      const png = await page.screenshot();
      const path = join(out, `${opt('name') ?? id}-stage-b${b.toFixed(2)}.png`);
      writeFileSync(path, png);
      written.push(path);
    }
  }

  if (opt('duo')) {
    const v = opt('duo')!;
    const q = common({
      mode: 'sheet', styles, frames: opt('frames') ?? 8, cw: opt('cw'), ch: opt('ch'), per: 999,
      ...(v === 'all' ? {} : { moves: v }),
    });
    await page.open(`${base}/duo-demo.html?${q}`);
    await save(page, `${opt('name') ?? (v === 'all' ? 'duo-all' : `duo-${v.split(',').slice(0, 3).join('+')}`)}.png`);
  }

  if (page.errors.length) console.warn(`page errors:\n  ${page.errors.join('\n  ')}`);
} finally {
  await browser.close();
  await server.close();
  at?.cleanup();
}
for (const w of written) console.log(w);
