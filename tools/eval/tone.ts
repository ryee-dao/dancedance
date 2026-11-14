/// <reference types="node" />
/**
 * Tone fit of the routines, measured: does a routine dance moves whose tone
 * does not fit the song's AUDIO tone? Over the evaluation sets and the
 * published songs (choreo.ts songPasses, styles as the app resolves them),
 * every level. Offline and pure.
 *
 *   npx tsx tools/eval/tone.ts [--set all|catalog|...] [--out report.json]
 *
 * Song tone, from the audio only (songStyle.ts calm, intensity; generator.ts
 * songEnergy at the danced tempo, after the tempo feel): 'calm' (calm >=
 * BALLAD_CALM, or energy < CALM_ENERGY), 'loud' (energy >= ENERGY_MID), else
 * 'mid'; 'unknown' without audio intensity (nothing to judge by).
 * Move tone, from its data only: moveAggression (weights.ts: level, how sharp
 * rather than flowing, jumps / stomps / kicks / punches / impact) and the
 * jump flag; calmToned (generator.ts: the calm-moves file's flows, port de
 * bras arms).
 * Mismatches:
 *   over gate     a danced move above the song's tone ceiling (generator.ts
 *                 toneGate), on any song;
 *   loud-on-calm  independent of the gate's own numbers: a danced move above
 *                 TONE_LOUD aggression (the most aggressive move of the
 *                 ballad set, lyrical, is 0.50), or a jump, on a calm song;
 *   calm-on-loud  a calm-toned move in the main sections (not the intro, the
 *                 outro or the warm-up phrase) of a song with no calm tone
 *                 (calmTone 0).
 *   soft-on-loud  a danced move below TONE_SOFT aggression (a low, very
 *                 smooth move with no accents: waves, flowing arms, sways)
 *                 on a loud song: reported as its share of the danced time
 *                 (some is normal: Easy's simple steps), compared between
 *                 the genre-known and the unknown-genre path.
 * Pass --compare before.json to count the routines that changed (by tone class);
 * --strip to resolve every song as if its genre lookup had failed (no tag, no
 * lists, no artist genres; a starter song's curated style stays, as in the app);
 * --strip-traits to drop the map's audio traits too (the "Mixed styles" path).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { calmTone, calmToned, generateRoutine, songEnergy, styleGenres, toneGate, ENERGY_MID, type Intensity, type MoveInstance, type Routine } from '../../src/core/choreo/generator';
import { BALLAD_CALM } from '../../src/core/choreo/songStyle';
import { moveAggression } from '../../src/core/choreo/weights';
import { arg } from './common';
import { passStyle, songPasses } from './choreo';

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
/** Aggression above which a move is too loud for a calm song (lyrical's most aggressive move: 0.50). */
export const TONE_LOUD = 0.5;
/** Song energy below which a song is calm by its audio, whatever its calm reading. */
export const CALM_ENERGY = 0.15;
/** Aggression below which a move is soft and flowing (a low level, very smooth, no accents: about smoothness >= 0.8). */
export const TONE_SOFT = 0.08;

export type ToneClass = 'calm' | 'mid' | 'loud' | 'unknown';

const danced = (r: Routine) => r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
const span = (xs: readonly MoveInstance[]) => xs.reduce((a, i) => a + i.span, 0);
function main(r: Routine): MoveInstance[] {
  const d = danced(r);
  const first = Math.min(...d.filter((i) => i.phrase >= 0).map((i) => i.phrase));
  return d.filter((i) => i.section !== 'intro' && i.section !== 'outro' && i.phrase !== first);
}

interface Row {
  set: string;
  name: string;
  level: Intensity;
  cls: ToneClass;
  calm?: number;
  intensity?: number;
  energy: number;
  open: string[];
  /** Share of danced beats over the tone gate, in loud moves (loud-on-calm), in calm-toned main-section moves (calm-on-loud). */
  over: number;
  ceiling: number;
  loud: number;
  calmToned: number;
  /** Share of danced beats in soft moves (soft-on-loud). */
  soft: number;
  softMoves: string[];
  offenders: string[];
  /** Routine key (top moves) for before / after comparison. */
  sig: string;
}

async function run() {
  const rows: Row[] = [];
  const strip = process.argv.includes('--strip') || process.argv.includes('--strip-traits');
  const noTraits = process.argv.includes('--strip-traits');
  for (const p0 of await songPasses(arg('set', 'all')!)) {
    const { videoId, title, artist } = p0.info;
    const p = strip ? { ...p0, info: { videoId, title, artist }, map: noTraits ? { ...p0.map, traits: undefined } : p0.map } : p0;
    const style = passStyle(p);
    // The song's real audio tone judges the routine (with --strip-traits the routine never saw it).
    const truth = noTraits ? passStyle({ ...p, map: p0.map }) : style;
    const open = [...styleGenres(style)];
    for (const level of LEVELS) {
      const r = generateRoutine(p.map, level, { style });
      const e = songEnergy(truth, r.bpm);
      const cls: ToneClass = truth.intensity === undefined ? 'unknown' : (truth.calm ?? 0) >= BALLAD_CALM || e < CALM_ENERGY ? 'calm' : e >= ENERGY_MID ? 'loud' : 'mid';
      const d = danced(r);
      const all = Math.max(1, span(d));
      const loudMoves = d.filter((i) => moveAggression(i.move) > TONE_LOUD || i.move.jump);
      const calmMoves = calmTone(truth) > 0 ? [] : main(r).filter((i) => calmToned(i.move));
      const ceiling = toneGate(truth, r.bpm, e).ceiling;
      const over = d.filter((i) => moveAggression(i.move) > ceiling + 1e-9);
      const softD = d.filter((i) => moveAggression(i.move) < TONE_SOFT);
      const softM = new Map<string, number>();
      for (const i of softD) softM.set(i.move.id, (softM.get(i.move.id) ?? 0) + i.span);
      const off = new Map<string, number>();
      for (const i of [...over, ...(cls === 'calm' ? loudMoves.filter((x) => !over.includes(x)) : []), ...calmMoves]) {
        const k = `${i.move.id}${i.move.genre ? `[${i.move.genre}]` : ''} a=${moveAggression(i.move).toFixed(2)}${i.move.jump ? ' jump' : ''}`;
        off.set(k, (off.get(k) ?? 0) + i.span);
      }
      rows.push({
        set: p.set, name: p.name, level, cls, ...(truth.calm !== undefined ? { calm: truth.calm } : {}), ...(truth.intensity !== undefined ? { intensity: truth.intensity } : {}),
        energy: Math.round(e * 1000) / 1000, open, ceiling: Math.round(ceiling * 1000) / 1000,
        over: Math.round((1000 * span(over)) / all) / 1000,
        loud: Math.round((1000 * span(loudMoves)) / all) / 1000, calmToned: Math.round((1000 * span(calmMoves)) / all) / 1000,
        soft: Math.round((1000 * span(softD)) / all) / 1000, softMoves: [...softM].sort((a, b) => b[1] - a[1]).map(([k, b]) => `${k} ${b}`),
        offenders: [...off].sort((a, b) => b[1] - a[1]).map(([k, b]) => `${k} ${b}`),
        sig: d.map((i) => i.move.id).join(' '),
      });
    }
  }
  const out = arg('out');
  if (out) writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
  // Summary.
  const cmp = arg('compare');
  const before = cmp ? new Map((JSON.parse(readFileSync(cmp, 'utf8')) as Row[]).map((x) => [`${x.set}|${x.name}|${x.level}`, x.sig])) : null;
  const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
  for (const cls of ['calm', 'mid', 'loud', 'unknown'] as const) {
    for (const level of LEVELS) {
      const rs = rows.filter((x) => x.cls === cls && x.level === level);
      if (!rs.length) continue;
      const overR = rs.filter((x) => x.over > 0).length;
      const loudR = rs.filter((x) => x.loud > 0).length;
      const calmR = rs.filter((x) => x.calmToned > 0).length;
      const mean = (f: (x: Row) => number) => pct(rs.reduce((a, x) => a + f(x), 0) / rs.length);
      const ch = before ? ` changed ${rs.filter((x) => before.get(`${x.set}|${x.name}|${x.level}`) !== x.sig).length}` : '';
      console.log(`${cls.padEnd(7)} ${level.padEnd(6)} routines ${String(rs.length).padStart(4)}  over gate ${String(overR).padStart(3)} (${mean((x) => x.over)})  agg>${TONE_LOUD}/jump ${String(loudR).padStart(3)} (${mean((x) => x.loud)})  calm-toned main ${String(calmR).padStart(3)}  soft ${mean((x) => x.soft)}${ch}`);
    }
  }
  const bad = (x: Row) => Math.max(x.over, x.cls === 'calm' ? x.loud : 0, x.calmToned);
  const worst = rows.filter((x) => bad(x) > 0).sort((a, b) => bad(b) - bad(a));
  console.log(`\nmismatched routines: ${worst.length} of ${rows.length}`);
  for (const x of worst.slice(0, Number(arg('top', '25')))) {
    console.log(`${x.set} ${x.name} ${x.level} [${x.cls} calm ${x.calm ?? '-'} int ${x.intensity ?? '-'} e ${x.energy} ceiling ${x.ceiling}; ${x.open.join(',') || '-'}] over ${pct(x.over)} loud ${pct(x.loud)} calmToned ${pct(x.calmToned)}: ${x.offenders.slice(0, 4).join('; ')}`);
  }
  const softest = rows.filter((x) => x.cls === 'loud').sort((a, b) => b.soft - a.soft);
  console.log(`\nsoft moves on loud songs, most first:`);
  for (const x of softest.slice(0, Number(arg('top', '25')))) {
    console.log(`${x.set} ${x.name} ${x.level} [calm ${x.calm ?? '-'} int ${x.intensity ?? '-'} e ${x.energy}; ${x.open.join(',') || '-'}] soft ${pct(x.soft)}: ${x.softMoves.slice(0, 5).join('; ')}`);
  }
}

if (process.argv[1]?.endsWith('tone.ts')) void run();
