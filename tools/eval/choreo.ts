/// <reference types="node" />
/**
 * Choreography summary of the evaluation sets with the CURRENT analyser
 * readings: per song the resolved style (label, sets opened, tempo feel),
 * and per level the top moves, jump share and genre share. Offline and pure;
 * meant for before / after comparisons of choreography changes.
 *
 *   npx tsx tools/eval/choreo.ts --out summary.json [--set run|heldout|famous|catalog|all]
 *   npx tsx tools/eval/choreo.ts --diff before.json after.json   (per-song changes, markdown)
 *   npx tsx tools/eval/choreo.ts --table before.json after.json  (every song, before / after side by side, markdown)
 *   npx tsx tools/eval/choreo.ts --set levels [--recombine] --out x.json   (the run with genre-lookups-levels.json)
 *   npx tsx tools/eval/choreo.ts --set catalog [--genres <genres.json>] [--recombine] --out x.json
 *
 * Inputs per set:
 *   run      data/run-20261113: sample, stats.json (traits re-mapped with the
 *            current traitsFromStats, tempo and beat count as recorded by
 *            analyser 1.4.0), the saved maps (sections, bar readings) when
 *            their grid matches the recorded tempo, else a uniform grid at the
 *            recorded tempo; pass A = iTunes tag, pass B = + genres.json list.
 *   heldout  data/heldout-20261114: sample + stats.json (no maps: a uniform
 *            grid and a template section plan), iTunes tag only.
 *   famous   data/famous14: stats.json, a genre tag per song written here.
 *   catalog  public/beatmaps with the app's inputs (starter style, songs.json
 *            tag, public/genres.json list by video id); the published maps
 *            carry no traits.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BeatMap, Section, SectionType } from '../../src/core/analysis/beatmap';
import { traitsFromStats } from '../../src/core/analysis/traits';
import { generateRoutine, styleGenres, tierBeats, type Intensity } from '../../src/core/choreo/generator';
import { resolveSongStyle, styleLabel, type SongInfo, type SongStyle } from '../../src/core/choreo/songStyle';
import { traitsOf } from '../../src/core/choreo/songTraits';
import starter from '../../src/data/starter.json';
import { recombine } from '../../src/genre/lookup';
import type { GenreLevel, GenreLookup } from '../../src/genre/types';
import { arg } from './common';
import type { RecordedStats } from './stats';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data');
const ROOT = join(HERE, '..', '..');
const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const readJson = <T>(p: string, d: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : d);

export interface LevelOut {
  jump: number;
  high: number;
  genre: number;
  half: number;
  top: string[];
  genres: Record<string, number>;
}
export interface SongOut {
  set: string;
  key: string;
  name: string;
  genre?: string;
  genres?: string[];
  genreLevels?: GenreLevel[];
  artistGenres?: string[];
  expect?: string;
  bpm: number;
  traits?: Record<string, number>;
  label: string;
  open: string[];
  calm?: number;
  /** Routine-level notes (tempo feel, free time) when the generator reports them. */
  notes: string[];
  levels: Record<string, LevelOut>;
}

const PLAN: readonly [SectionType, number, number][] = [
  ['intro', 0.07, 0.3], ['verse', 0.18, 0.5], ['chorus', 0.12, 0.8], ['verse', 0.16, 0.55], ['chorus', 0.12, 0.85], ['verse', 0.1, 0.6], ['chorus', 0.17, 0.9], ['outro', 0.08, 0.3],
];

/** A uniform grid at `bpm` over `duration` s (beats from `t0`), template sections when none are given. */
function uniformMap(id: string, bpm: number, duration: number, sections?: Section[], t0 = 0.4): BeatMap {
  const beats: number[] = [];
  const downbeats: number[] = [];
  if (bpm > 0) for (let t = t0, k = 0; t < duration - 0.3; t += 60 / bpm, k++) {
    beats.push(Math.round(t * 1000) / 1000);
    if (k % 4 === 0) downbeats.push(k);
  }
  let secs = sections;
  if (!secs || !secs.length) {
    secs = [];
    let s = 0;
    for (const [type, f, energy] of PLAN) {
      secs.push({ start: s, end: s + f * duration, type, energy });
      s += f * duration;
    }
  }
  return { v: 1, analyzerVersion: 'eval', videoId: id, duration, bpm, beats, downbeats, sections: secs, source: 'cloud' };
}

function summarise(set: string, key: string, name: string, info: SongInfo, map: BeatMap, extra: Partial<SongOut> = {}): SongOut {
  const secs = map.sections ?? [];
  const energy = secs.length ? secs.reduce((a, x) => a + x.energy, 0) / secs.length : undefined;
  const style: SongStyle = resolveSongStyle(info, { bpm: map.bpm, energy, traits: traitsOf(map) });
  const levels: Record<string, LevelOut> = {};
  const notes = new Set<string>();
  for (const lv of LEVELS) {
    const r = generateRoutine(map, lv, { style });
    const meta = r as unknown as { feel?: number; freeTime?: boolean };
    if (meta.feel && meta.feel !== 1) notes.add(`feel x${meta.feel}`);
    if (meta.freeTime) notes.add('free time');
    const danced = r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
    const beats = danced.reduce((a, i) => a + i.span, 0) || 1;
    const sh = (f: (i: (typeof danced)[number]) => boolean) => r3(danced.filter(f).reduce((a, i) => a + i.span, 0) / beats);
    const by = new Map<string, number>();
    const gb: Record<string, number> = {};
    for (const i of danced) {
      by.set(i.move.name, (by.get(i.move.name) ?? 0) + i.span);
      if (i.move.genre) gb[i.move.genre] = (gb[i.move.genre] ?? 0) + i.span;
    }
    const t = tierBeats(r, style);
    levels[lv] = {
      jump: sh((i) => i.move.jump),
      high: sh((i) => i.move.level === 'high'),
      half: sh((i) => i.half),
      genre: r3(t.genre / Math.max(1, t.genre + t.global)),
      top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, b]) => `${n} ${b}`),
      genres: gb,
    };
  }
  return {
    set, key, name, bpm: map.bpm, label: styleLabel(style), open: [...styleGenres(style)], ...(style.calm !== undefined ? { calm: style.calm } : {}),
    notes: [...notes], levels, ...(info.genre ? { genre: info.genre } : {}), ...(info.genres?.length ? { genres: [...info.genres] } : {}),
    ...(map.traits ? { traits: map.traits as unknown as Record<string, number> } : {}), ...extra,
  };
}

interface Sampled { key: string; artist: string; title: string; genre?: string; durationSec: number }

/** A song's genre lists by level, as the app passes them to the choreographer (library.ts songGenres / songGenreLevels / songArtistGenres). */
interface Lists {
  genres: string[];
  genreLevels?: GenreLevel[];
  artistGenres?: string[];
}
function listInfo(l: Lists | undefined): Partial<SongInfo> {
  if (!l) return {};
  return {
    ...(l.genres.length ? { genres: l.genres } : {}),
    ...(l.genres.length && l.genreLevels?.length === l.genres.length ? { genreLevels: l.genreLevels } : {}),
    ...(l.artistGenres?.length ? { artistGenre: l.artistGenres[0], artistGenres: l.artistGenres } : {}),
  };
}
/** Stored lookups (genres.json records, genre-lookups-levels.json): as saved, or recombined from their source answers with the current combine.ts. */
function readLookups(path: string, recombined: boolean): Map<string, Lists & { videoIds?: string[] }> {
  const raw = readJson<Record<string, unknown>>(path, {});
  const recs = (raw.songs && typeof raw.songs === 'object' ? raw.songs : raw) as Record<string, GenreLookup & { videoIds?: string[] }>;
  const out = new Map<string, Lists & { videoIds?: string[] }>();
  for (const [k, r] of Object.entries(recs)) {
    if (!r || !Array.isArray(r.genres)) continue;
    const l = recombined && r.sources ? recombine(r.sources) : r;
    out.set(k, { genres: l.genres, ...(l.genreLevels ? { genreLevels: l.genreLevels } : {}), ...(l.artistGenres ? { artistGenres: l.artistGenres } : {}), ...(r.videoIds ? { videoIds: r.videoIds } : {}) });
  }
  return out;
}

function evalSet(dir: string, setName: string, withLists: boolean, levels?: Map<string, Lists>): SongOut[] {
  const sample = readJson<{ songs: Sampled[] }>(join(dir, 'sample.json'), { songs: [] });
  const stats = readJson<RecordedStats>(join(dir, 'stats.json'), { analyzerVersion: '', songs: {} });
  const expect = readJson<Record<string, { consensus?: { line?: string }; memory?: { family?: string; sub?: string } }>>(join(dir, 'expectations.json'), {});
  const lists = readJson<Record<string, string[]>>(join(dir, 'genres.json'), {});
  const out: SongOut[] = [];
  for (const s of sample.songs) {
    const st = stats.songs[s.key];
    if (!st) continue;
    const traits = traitsFromStats(st.stats);
    const mapPath = join(dir, 'maps', `${s.key}.json`);
    const old = existsSync(mapPath) ? (JSON.parse(readFileSync(mapPath, 'utf8')) as BeatMap) : null;
    let map: BeatMap;
    if (old && old.bpm > 0 && Math.abs(old.bpm / Math.max(1, st.bpm) - 1) < 0.02) map = { ...old, bpm: st.bpm, traits: traits as BeatMap['traits'] };
    else map = { ...uniformMap(s.key, st.beats >= 16 ? st.bpm : 0, old?.duration ?? s.durationSec, old?.sections, old?.beats[0] ?? 0.4), traits: traits as BeatMap['traits'] };
    const e = expect[s.key];
    const exp = e?.consensus?.line ?? (e?.memory ? `memory: ${[e.memory.family, e.memory.sub].filter(Boolean).join(' / ')}` : undefined);
    const base: SongInfo = { videoId: s.key, title: s.title, artist: s.artist, ...(s.genre ? { genre: s.genre } : {}) };
    const name = `${s.artist} - ${s.title}`;
    if (levels) {
      // Pass L: the lookups by level (genre-lookups-levels.json), as the app passes them.
      const l = levels.get(s.key);
      out.push(summarise(`${setName}:L`, s.key, name, { ...base, ...listInfo(l) }, map, { ...(exp ? { expect: exp } : {}), ...(l?.genreLevels ? { genreLevels: l.genreLevels } : {}), ...(l?.artistGenres ? { artistGenres: l.artistGenres } : {}) }));
      continue;
    }
    out.push(summarise(`${setName}:A`, s.key, name, base, map, exp ? { expect: exp } : {}));
    if (withLists && lists[s.key]?.length) out.push(summarise(`${setName}:B`, s.key, name, { ...base, genres: lists[s.key] }, map, exp ? { expect: exp } : {}));
  }
  return out;
}

/** famous14: the songs' usual iTunes tags and genre lists (from their Wikipedia infoboxes). */
const FAMOUS: Record<string, [string, string, string[]]> = {
  billiejean: ['Billie Jean', 'Pop', ['post-disco', 'R&B', 'funk', 'dance-pop']],
  bringmetolife: ['Bring Me to Life', 'Hard Rock', ['nu metal', 'alternative metal', 'gothic metal', 'rap rock']],
  essence: ['Essence', 'Afrobeats', ['afrobeats', 'R&B']],
  faint: ['Faint', 'Hard Rock', ['nu metal', 'rap metal', 'alternative metal']],
  gasolina: ['Gasolina', 'Latin', ['reggaeton']],
  inthemood: ['In the Mood', 'Jazz', ['swing', 'big band']],
  maskoff: ['Mask Off', 'Hip-Hop/Rap', ['trap', 'hip hop']],
  myimmortal: ['My Immortal', 'Hard Rock', ['gothic rock', 'soft rock', 'piano rock']],
  prideandjoy: ['Pride and Joy', 'Blues', ['Texas blues', 'blues rock']],
  scarymonsters: ['Scary Monsters and Nice Sprites', 'Dance', ['dubstep', 'brostep']],
  someonelikeyou: ['Someone Like You', 'Pop', ['soul', 'pop', 'piano ballad']],
  stayinalive: ['Stayin\' Alive', 'Pop', ['disco']],
  watercolour: ['Watercolour', 'Electronic', ['drum and bass', 'liquid funk']],
  wefoundlove: ['We Found Love', 'Pop', ['electro house', 'dance-pop', 'EDM']],
};

function famous(): SongOut[] {
  const stats = readJson<RecordedStats>(join(DATA, 'famous14', 'stats.json'), { analyzerVersion: '', songs: {} });
  const out: SongOut[] = [];
  const seen = new Set<string>();
  for (const [k, st] of Object.entries(stats.songs)) {
    const name = k.split('.')[0];
    if (seen.has(name) || !FAMOUS[name]) continue;
    seen.add(name);
    const [title, genre, genres] = FAMOUS[name];
    const map = { ...uniformMap(name, st.beats >= 16 ? st.bpm : 0, Math.max(150, st.beats * (60 / Math.max(1, st.bpm)) + 2)), traits: traitsFromStats(st.stats) as BeatMap['traits'] };
    out.push(summarise('famous:B', name, title, { videoId: name, title, genre, genres }, map));
  }
  return out;
}

function catalog(genresPath = join(ROOT, 'public', 'genres.json'), recombined = false): SongOut[] {
  const songs = readJson<{ songs: { videoId: string; title: string; artist: string; genre?: string; genres?: string[] }[] }>(join(ROOT, 'public', 'songs.json'), { songs: [] });
  const byVid = new Map<string, Lists>();
  for (const e of readLookups(genresPath, recombined).values()) for (const v of e.videoIds ?? []) if (e.genres.length) byVid.set(v, e);
  const info = new Map<string, { title: string; artist: string; genre?: string }>();
  for (const s of starter as { videoId: string; title: string; artist: string }[]) info.set(s.videoId, s);
  for (const s of songs.songs) if (!info.has(s.videoId)) info.set(s.videoId, s);
  const out: SongOut[] = [];
  const dir = join(ROOT, 'public', 'beatmaps');
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const map = JSON.parse(readFileSync(join(dir, f), 'utf8')) as BeatMap;
    if (!map?.videoId || !Array.isArray(map.beats)) continue;
    const id = f.slice(0, -5);
    const i = info.get(id) ?? { title: id, artist: '' };
    const l = byVid.get(id);
    const extra = { ...(l?.genreLevels ? { genreLevels: l.genreLevels } : {}), ...(l?.artistGenres ? { artistGenres: l.artistGenres } : {}) };
    out.push(summarise('catalog', id, `${i.artist} - ${i.title}`, { videoId: id, title: i.title, artist: i.artist, ...(i.genre ? { genre: i.genre } : {}), ...listInfo(l) }, map, extra));
  }
  return out;
}

function diff(aPath: string, bPath: string) {
  const a = JSON.parse(readFileSync(aPath, 'utf8')) as SongOut[];
  const b = JSON.parse(readFileSync(bPath, 'utf8')) as SongOut[];
  const am = new Map(a.map((s) => [`${s.set}|${s.key}`, s]));
  const pct = (x: number) => `${Math.round(100 * x)}%`;
  for (const s of b) {
    const o = am.get(`${s.set}|${s.key}`);
    const j = (x?: SongOut) => (x ? LEVELS.map((l) => pct(x.levels[l].jump)).join('/') : '-');
    const changed = !o || o.label !== s.label || o.open.join() !== s.open.join() || j(o) !== j(s) || LEVELS.some((l) => o.levels[l].top.slice(0, 3).join() !== s.levels[l].top.slice(0, 3).join());
    if (!changed) continue;
    console.log(`\n### ${s.set} ${s.name} [${s.genre ?? ''}${s.genres ? `; ${s.genres.join(', ')}` : ''}] ${s.bpm} BPM`);
    if (s.expect) console.log(`expect: ${s.expect}`);
    console.log(`label: ${o?.label} -> ${s.label}; open: ${o?.open.join(',') || '-'} -> ${s.open.join(',') || '-'}; calm ${o?.calm} -> ${s.calm}${s.notes.length ? `; ${s.notes.join(', ')}` : ''}`);
    console.log(`jumps E/M/H: ${j(o)} -> ${j(s)}`);
    for (const l of LEVELS) console.log(`  ${l}: ${s.levels[l].top.slice(0, 5).join('; ')}`);
  }
}

/** A list with its album-level entries marked: "Latin pop, bachata [album]". */
const listCell = (s?: SongOut) => (s?.genres ?? []).map((g, i) => (s?.genreLevels?.[i] === 'album' ? `${g} [album]` : g)).join(', ') || '-';

/** Every song of `after`, before and after side by side (markdown table): label and sets opened. */
function table(aPath: string, bPath: string) {
  const a = JSON.parse(readFileSync(aPath, 'utf8')) as SongOut[];
  const b = JSON.parse(readFileSync(bPath, 'utf8')) as SongOut[];
  const am = new Map(a.map((s) => [`${s.set}|${s.key}`, s]));
  const cell = (s: string) => s.replace(/\|/g, '/');
  const open = (s?: SongOut) => s?.open.join(', ') || '-';
  console.log('| # | Song | Genre list before | Genre list after | Artist genres | Label before | Label after | Sets before | Sets after | Changed |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  let changed = 0, lead = 0;
  b.forEach((s, i) => {
    const o = am.get(`${s.set}|${s.key}`);
    const ch = [o?.label !== s.label ? 'label' : '', open(o) !== open(s) ? 'sets' : ''].filter(Boolean).join(', ');
    if (ch) changed++;
    if (o?.label !== s.label) lead++;
    console.log(`| ${i + 1} | ${cell(s.name)} | ${cell(listCell(o))} | ${cell(listCell(s))} | ${cell(s.artistGenres?.join(', ') ?? '-')} | ${cell(o?.label ?? '-')} | ${cell(s.label)} | ${cell(open(o))} | ${cell(open(s))} | ${ch} |`);
  });
  console.log(`\n${b.length} songs; label or sets changed on ${changed}; label changed on ${lead}.`);
}

if (process.argv[1]?.endsWith('choreo.ts')) {
  if (process.argv.includes('--diff')) {
    const i = process.argv.indexOf('--diff');
    diff(process.argv[i + 1], process.argv[i + 2]);
  } else if (process.argv.includes('--table')) {
    const i = process.argv.indexOf('--table');
    table(process.argv[i + 1], process.argv[i + 2]);
  } else {
    const which = arg('set', 'all')!;
    const recombined = process.argv.includes('--recombine');
    const out: SongOut[] = [];
    if (which === 'all' || which === 'run') out.push(...evalSet(join(DATA, 'run-20261113'), 'run', true));
    // The run's lookups by level (genre-lookups-levels.json), as saved or --recombine'd with the current combine.ts.
    if (which === 'levels') out.push(...evalSet(join(DATA, 'run-20261113'), 'run', false, readLookups(join(DATA, 'run-20261113', 'genre-lookups-levels.json'), recombined)));
    if (which === 'all' || which === 'heldout') out.push(...evalSet(join(DATA, 'heldout-20261114'), 'heldout', false));
    if (which === 'all' || which === 'famous') out.push(...famous());
    if (which === 'all' || which === 'catalog') out.push(...catalog(arg('genres') ?? undefined, recombined));
    const file = arg('out');
    if (file) writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
    console.error(`${out.length} song passes`);
  }
}
