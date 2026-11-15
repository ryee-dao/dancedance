/// <reference types="node" />
/**
 * Print the routine a published song gets, card by card (what the NOW card
 * shows): start bar, length in beats and seconds, tier (global / genre /
 * combo), the move, and the bar energies it covers.
 *
 *   npx tsx tools/choreo/routine.ts <videoId> [chill|cardio|sweaty] [play number for "new every time"] [--duo]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BeatMap } from '../../src/core/analysis/beatmap';
import { beatSeconds, cardsOf } from '../../src/core/choreo/cards';
import { generateDuoRoutine } from '../../src/core/choreo/duo';
import { buildBars, generateRoutine, styleGenres, tierBeats, type Intensity } from '../../src/core/choreo/generator';
import { publishedSources } from '../../src/core/choreo/publishedSources';
import { songStyleOf, styleLabel } from '../../src/core/choreo/songStyle';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const duo = args.includes('--duo');
const [id, level = 'sweaty', play] = args.filter((a) => a !== '--duo');
if (!id) {
  console.error('usage: tools/choreo/routine.ts <videoId> [chill|cardio|sweaty] [play number] [--duo]');
  process.exit(1);
}
const map = JSON.parse(readFileSync(`${root}public/beatmaps/${id}.json`, 'utf8')) as BeatMap;
const readJson = (p: string) => JSON.parse(readFileSync(`${root}${p}`, 'utf8'));
// The style as the app resolves it (genre lists, levels, artist genres, the map's audio traits).
const info = publishedSources(id, { starter: readJson('src/data/starter.json'), songs: readJson('public/songs.json'), index: readJson('public/beatmaps/index.json') });
const style = songStyleOf(info, map);
const lv = level as Intensity;
const opts = { style, fresh: play ? Number(play) : undefined };
const r = generateRoutine(map, lv, opts);
const { bars } = buildBars(map.beats.length, map.downbeats);
const barOf = (b: number) => {
  let k = 0;
  for (let i = 0; i < bars.length; i++) if (bars[i].start <= b) k = i;
  return k;
};
const digits = map.bars?.energy ?? '';
const dbIdx = (b: number) => {
  let k = 0;
  map.downbeats.forEach((d, i) => {
    if (d <= b) k = i;
  });
  return k;
};
const open = [...styleGenres(style)];
console.log(`${info.title} — ${info.artist} | ${lv}${play ? ` play ${play}` : ''} | ${map.bpm.toFixed(0)} BPM | ${styleLabel(style)}${open.length ? ` (opens ${open.join(', ')})` : ''}`);
const show = (ins: typeof r.instances, label = '') => {
  let section = '';
  for (const c of cardsOf(ins)) {
    const i = ins[c.from];
    if (i.section !== section) console.log(`  -- ${(section = i.section)}`);
    const tier = i.sig ? 'combo' : i.move.genre ? i.move.genre : i.move.cooldown || i.move.idle ? 'cool-down' : 'global';
    const e = digits ? digits.slice(dbIdx(c.start), dbIdx(c.end - 1) + 1) : '';
    console.log(`  ${label}bar ${String(barOf(c.start)).padStart(3)}  ${String(c.end - c.start).padStart(3)} beats ${beatSeconds(map.beats, c.start, c.end).toFixed(1).padStart(5)} s  ${tier.padEnd(10)} ${i.move.name}  [${e}]`);
  }
};
if (duo) {
  const d = generateDuoRoutine(map, lv, opts);
  show(d.p1, 'P1 ');
  show(d.p2, 'P2 ');
} else show(r.instances);
const t = tierBeats(r, style);
console.log(`  genre moves: ${((100 * t.genre) / Math.max(1, t.genre + t.global)).toFixed(0)} % of the danced time; ${new Set(r.instances.map((i) => i.move.base)).size} different moves`);
