/// <reference types="node" />
/**
 * Score the analyser's audio readings (tempo, beat grid, character traits)
 * against researched audio targets. Pure: reads files, prints a table and
 * counts.
 *
 *   npx tsx tools/eval/audio.ts --targets T.json (--maps DIR | --readings R.json) [--quiet]
 *
 * T.json: { key: AudioTarget } (e.g. data/run-20261113/audio-targets.json)
 *         or an expectations.json whose entries carry `audio`.
 * DIR:    beat maps <key>.json (run.ts --stage analyse writes them).
 * R.json: { key: { bpm, beats (count), traits, tempoAlt? } } (any summary of analyses;
 *         a reading key "name.variant" is scored against target "name").
 *
 * Rules (common.ts AudioTarget):
 *   grid       a usable grid (>= 16 beats) wherever the pulse is clear or weak;
 *              a beatless song may have one or not.
 *   tempo      bpm inside danceBpm or altBpm; "cand" also counts the
 *              alternatives the reading offers (traits.halfTempo / doubleTempo
 *              >= 0.5: half / twice the bpm) when the bpm misses.
 *   character  on `calm`: calm >= 0.6; soft 0.3..0.8; mid <= 0.55; driving <= 0.3.
 *              With `intensity` present also: soft and calm <= 0.4 (a driving song
 *              may drive by its rhythm alone, e.g. trance with a tonal lead).
 *   feels      four-on-the-floor fourFloor >= 0.5, half-time halfFeel >= 0.5,
 *              swing swing >= 0.5, syncopated syncop >= 0.4, heavy-distortion
 *              heavy >= 0.5, dense-hats hats >= 0.5.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arg, flag, type AudioTarget } from './common';

export interface Reading {
  bpm: number;
  beats: number;
  traits?: Record<string, number>;
  /** The other plausible tempo (half / double), when the map exposes one. */
  tempoAlt?: number;
}

const inRange = (x: number, r?: [number, number]) => !!r && x >= r[0] && x <= r[1];

/** Tempi the reading offers besides its bpm: half / double when traits.halfTempo / doubleTempo >= 0.5, or an explicit tempoAlt. */
export function altTempos(r: Reading): number[] {
  const out: number[] = [];
  if (r.tempoAlt) out.push(r.tempoAlt);
  if ((r.traits?.halfTempo ?? 0) >= 0.5) out.push(r.bpm / 2);
  if ((r.traits?.doubleTempo ?? 0) >= 0.5) out.push(r.bpm * 2);
  return out;
}

export function characterOk(t: AudioTarget, tr: Record<string, number> | undefined): boolean | undefined {
  if (!t.character || !tr || tr.calm === undefined) return undefined;
  const c = tr.calm;
  const it = tr.intensity;
  switch (t.character) {
    case 'calm':
      return c >= 0.6 && (it === undefined || it <= 0.4);
    case 'soft':
      return c >= 0.3 && c <= 0.8 && (it === undefined || it <= 0.4);
    case 'mid':
      return c <= 0.55;
    case 'driving':
      return c <= 0.3;
  }
}

const FEEL_TRAIT: Record<string, [string, number]> = {
  'four-on-the-floor': ['fourFloor', 0.5],
  'half-time': ['halfFeel', 0.5],
  swing: ['swing', 0.5],
  syncopated: ['syncop', 0.4],
  'heavy-distortion': ['heavy', 0.5],
  'dense-hats': ['hats', 0.5],
};

export interface Score {
  key: string;
  grid?: boolean;
  tempo?: boolean;
  tempoCand?: boolean;
  character?: boolean;
  feels: { feel: string; ok: boolean; value: number }[];
}

export function score(key: string, t: AudioTarget, r: Reading): Score {
  const out: Score = { key, feels: [] };
  const hasGrid = r.beats >= 16 && r.bpm > 0;
  if (t.pulse === 'clear' || t.pulse === 'weak') out.grid = hasGrid;
  if (t.danceBpm || t.altBpm) {
    out.tempo = hasGrid && (inRange(r.bpm, t.danceBpm) || inRange(r.bpm, t.altBpm));
    const alts = altTempos(r);
    out.tempoCand = out.tempo || (hasGrid && alts.some((a) => inRange(a, t.danceBpm) || inRange(a, t.altBpm)));
  }
  out.character = characterOk(t, r.traits);
  for (const f of t.feels ?? []) {
    const ft = FEEL_TRAIT[f];
    if (!ft || !r.traits) continue;
    const v = r.traits[ft[0]] ?? 0;
    out.feels.push({ feel: f, ok: v >= ft[1], value: v });
  }
  return out;
}

function loadTargets(path: string): Record<string, AudioTarget> {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const out: Record<string, AudioTarget> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_') || !v || typeof v !== 'object') continue;
    const o = v as { audio?: AudioTarget; evidence?: string };
    if ('evidence' in o || 'consensus' in o) {
      // expectations.json: only researched targets count.
      if (o.audio && o.evidence !== 'none') out[k] = o.audio;
    } else out[k] = v as AudioTarget;
  }
  return out;
}

function loadReadings(): Record<string, Reading> {
  const mapsDir = arg('maps');
  const readings = arg('readings');
  const out: Record<string, Reading> = {};
  if (mapsDir) {
    for (const f of readdirSync(mapsDir)) {
      if (!f.endsWith('.json')) continue;
      const m = JSON.parse(readFileSync(join(mapsDir, f), 'utf8')) as { bpm: number; beats: number[]; traits?: Record<string, number>; tempoAlt?: number };
      out[f.replace(/\.json$/, '')] = { bpm: m.bpm, beats: m.beats.length, traits: m.traits, tempoAlt: m.tempoAlt };
    }
  } else if (readings && existsSync(readings)) {
    const raw = JSON.parse(readFileSync(readings, 'utf8')) as Record<string, Reading & { beats: number | number[] }>;
    for (const [k, v] of Object.entries(raw)) out[k] = { ...v, beats: Array.isArray(v.beats) ? v.beats.length : v.beats };
  }
  return out;
}

export function summarise(scores: Score[]): Record<string, string> {
  const c = (f: (s: Score) => boolean | undefined) => {
    const xs = scores.map(f).filter((x): x is boolean => x !== undefined);
    return `${xs.filter(Boolean).length}/${xs.length}`;
  };
  const feels = scores.flatMap((s) => s.feels);
  return {
    character: c((s) => s.character),
    tempo: c((s) => s.tempo),
    tempoOrCandidate: c((s) => s.tempoCand),
    grid: c((s) => s.grid),
    feels: `${feels.filter((f) => f.ok).length}/${feels.length}`,
  };
}

const isMain = process.argv[1]?.endsWith('audio.ts');
if (isMain) {
  const tPath = arg('targets');
  if (!tPath) {
    console.error('usage: tools/eval/audio.ts --targets T.json (--maps DIR | --readings R.json) [--quiet]');
    process.exit(1);
  }
  const targets = loadTargets(tPath);
  const readings = loadReadings();
  const scores: Score[] = [];
  const mark = (b?: boolean) => (b === undefined ? ' ' : b ? '+' : 'X');
  for (const [k, r] of Object.entries(readings).sort()) {
    const t = targets[k] ?? targets[k.split('.')[0]];
    if (!t) continue;
    const s = score(k, t, r);
    scores.push(s);
    if (!flag('quiet')) {
      const tr = r.traits ?? {};
      const tt = ['calm', 'intensity', 'drive', 'heavy', 'halfFeel', 'fourFloor', 'swing', 'syncop', 'hats'].filter((x) => tr[x] !== undefined).map((x) => `${x.slice(0, 4)} ${tr[x].toFixed(2)}`).join(' ');
      const exp = `${t.character ?? '-'} ${t.danceBpm ? t.danceBpm.join('-') : ''}${t.altBpm ? `|${t.altBpm.join('-')}` : ''}`;
      const alt = altTempos(r).map((a) => `/${Math.round(a)}`).join('');
      console.log(`${k.padEnd(20)} ${exp.padEnd(22)} ${String(Math.round(r.bpm * 10) / 10).padStart(6)}${alt.padEnd(5)} grid${mark(s.grid)} tempo${mark(s.tempo)}${mark(s.tempoCand)} char${mark(s.character)} ${s.feels.map((f) => `${f.feel}${f.ok ? '+' : 'X'}`).join(' ')} | ${tt}`);
    }
  }
  console.log(JSON.stringify(summarise(scores)));
}
