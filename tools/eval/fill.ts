/// <reference types="node" />
/**
 * What the generic fill looks like on every saved evaluation sample: the
 * genre share per level, how concentrated the moves are, wrong-toned fill
 * (tai chi / yoga / warm-up flows / ballet arms in the main sections of a song
 * that isn't calm), jumps, and high-intensity moves against the song's audio
 * intensity. Offline and pure; for before / after comparisons.
 *
 *   npx tsx tools/eval/fill.ts [--out songs.json] [--sets r15,r1,run,levels,heldout,famous,catalog]
 *   npx tsx tools/eval/fill.ts --compare before.json after.json   (summary of both, side by side)
 *
 * Sets (the inputs each song is styled with):
 *   r15      data/run-20261115: saved maps, the app's inputs (pass B of run.ts score)
 *   r1       data/run-20261115/round1-rescore: round one, the same way
 *   run      data/run-20261113 as choreo.ts reads it (stats-re-mapped traits; pass A and, with a list, B)
 *   levels   data/run-20261113 with genre-lookups-levels.json (choreo.ts --set levels)
 *   heldout  data/heldout-20261114 (no maps: uniform grid, template sections; iTunes tag)
 *   famous   data/famous14 (uniform grid; tags and lists from choreo.ts)
 *   catalog  public/beatmaps with the app's inputs (no traits)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BeatMap, Section, SectionType } from '../../src/core/analysis/beatmap';
import { traitsFromStats } from '../../src/core/analysis/traits';
import type { Move } from '../../src/core/choreo/catalog';
import { JUMP_CAP, generateRoutine, styleGenres, tierBeats, type Intensity } from '../../src/core/choreo/generator';
import { resolveSongStyle, styleLabel, type SongInfo, type SongStyle } from '../../src/core/choreo/songStyle';
import { traitsOf } from '../../src/core/choreo/songTraits';
import starter from '../../src/data/starter.json';
import type { GenreLookup } from '../../src/genre/types';
import { arg } from './common';
import type { RecordedStats } from './stats';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data');
const ROOT = join(HERE, '..', '..');
const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const readJson = <T>(p: string, d: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : d);

/**
 * Calm-discipline moves (judged by this tool, independent of the generator's own rule): the calm-moves
 * file's flows (tai chi / qigong, standing yoga, warm-up circles, lyrical arms) and the ballet arms.
 */
export function calmToned(m: Move): boolean {
  if (m.cooldown || m.idle) return false;
  if (m.file === 'cooldown') return true;
  return /(^|-)(port-de-bras|grand-plie)(-|$|~)/.test(m.base);
}
/** Fitness-boxing moves (jabs, uppercuts, the speed bag). */
export function boxing(m: Move): boolean {
  return /(^|-)(jab|cross-jab|uppercuts?|speed-bag|hooks?|boxer)(-|$|~)/.test(m.base) || (m.themes.includes('punch') && m.themes.includes('sport'));
}

interface LevelRow {
  genre: number;
  /** The song opens a genre set (the genre share applies). */
  open: boolean;
  jump: number;
  high: number;
  /** Share of danced beats in moves above difficulty 1. */
  hard: number;
  /** Largest share of the danced main-section beats one base move takes, and of the genre beats one genre move takes. */
  top1: number;
  topGenre1: number;
  distinct: number;
  /** Calm-toned / boxing moves among the ten most danced base moves of the main sections (names). */
  calmTop: string[];
  boxTop: string[];
  calmShare: number;
  top: string[];
}
export interface SongRow {
  set: string;
  key: string;
  name: string;
  label: string;
  open: string[];
  calm?: number;
  soft?: number;
  hard?: number;
  intensity?: number;
  /** Calm / soft / lyrical: calm-toned moves are fine in its main sections. */
  calmSong: boolean;
  levels: Record<string, LevelRow>;
}

const ONLY = arg('only');

function summarise(set: string, key: string, name: string, info: SongInfo, map: BeatMap): SongRow | null {
  if (ONLY && !name.includes(ONLY)) return null;
  if (ONLY) console.error(`${set} ${name}`);
  const secs = map.sections ?? [];
  const energy = secs.length ? secs.reduce((a, x) => a + x.energy, 0) / secs.length : undefined;
  const traits = traitsOf(map);
  const style: SongStyle = resolveSongStyle(info, { bpm: map.bpm, energy, traits });
  const open = [...styleGenres(style)];
  const calmSong = (style.calm ?? 0) >= 0.55 || (style.soft ?? 0) >= 0.5 || open.includes('lyrical');
  const levels: Record<string, LevelRow> = {};
  for (const lv of LEVELS) {
    if (ONLY) console.error(` ${lv}`);
    const r = generateRoutine(map, lv, { style });
    const danced = r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
    const beats = danced.reduce((a, i) => a + i.span, 0) || 1;
    const sh = (f: (i: (typeof danced)[number]) => boolean) => r3(danced.filter(f).reduce((a, i) => a + i.span, 0) / beats);
    // The main sections: not the intro, the warm-up (the routine's first phrase) or the outro.
    const first = Math.min(...danced.filter((i) => i.phrase >= 0).map((i) => i.phrase));
    const main = danced.filter((i) => i.section !== 'outro' && i.section !== 'intro' && i.phrase !== first);
    const mainBeats = main.reduce((a, i) => a + i.span, 0) || 1;
    const by = new Map<string, { m: Move; b: number }>();
    const gby = new Map<string, number>();
    let gAll = 0;
    let calmB = 0;
    for (const i of main) {
      const k = i.sig ? `combo:${i.move.base}` : i.move.base;
      const e = by.get(k) ?? { m: i.move, b: 0 };
      e.b += i.span;
      by.set(k, e);
      if (i.move.genre) {
        gby.set(i.move.base, (gby.get(i.move.base) ?? 0) + i.span);
        gAll += i.span;
      }
      if (calmToned(i.move)) calmB += i.span;
    }
    const sorted = [...by.values()].sort((a, b) => b.b - a.b);
    const top10 = sorted.slice(0, 10);
    const t = tierBeats(r, style);
    levels[lv] = {
      genre: r3(t.genre / Math.max(1, t.genre + t.global)),
      open: open.length > 0,
      jump: sh((i) => i.move.jump),
      high: sh((i) => i.move.level === 'high'),
      hard: sh((i) => i.move.difficulty > 1),
      top1: r3((sorted[0]?.b ?? 0) / mainBeats),
      topGenre1: gAll ? r3(Math.max(...gby.values()) / gAll) : 0,
      distinct: by.size,
      calmTop: top10.filter((e) => calmToned(e.m)).map((e) => e.m.name),
      boxTop: top10.filter((e) => boxing(e.m)).map((e) => e.m.name),
      calmShare: r3(calmB / mainBeats),
      top: top10.slice(0, 6).map((e) => `${e.m.name}${e.m.genre ? `/${e.m.genre}` : ''} ${e.b}`),
    };
  }
  return {
    set, key, name, label: styleLabel(style), open, calmSong, levels,
    ...(style.calm !== undefined ? { calm: style.calm } : {}),
    ...(style.soft !== undefined ? { soft: style.soft } : {}),
    ...(style.hard !== undefined ? { hard: style.hard } : {}),
    ...(traits?.intensity !== undefined ? { intensity: traits.intensity } : {}),
  };
}

interface Sampled { key: string; artist: string; title: string; genre?: string; durationSec: number }

/** run.ts score, pass B (what the app passes): saved maps, the lookup's list with its levels and the artist's genres. */
function appSet(dir: string, set: string): SongRow[] {
  const sample = readJson<{ songs: Sampled[] }>(join(dir, 'sample.json'), { songs: [] });
  const lookups = readJson<Record<string, GenreLookup>>(join(dir, 'genre-lookups.json'), {});
  const genres = readJson<Record<string, string[]>>(join(dir, 'genres.json'), {});
  const out: SongRow[] = [];
  for (const s of sample.songs) {
    const p = join(dir, 'maps', `${s.key}.json`);
    if (!existsSync(p)) continue;
    const map = JSON.parse(readFileSync(p, 'utf8')) as BeatMap;
    const lk = lookups[s.key];
    const list = genres[s.key] ?? [];
    const levels = list.length && lk?.genreLevels?.length === list.length && lk.genres.join('|') === list.join('|') ? lk.genreLevels : undefined;
    const artistGenres = lk?.artistGenres?.length ? lk.artistGenres : undefined;
    const info: SongInfo = {
      videoId: map.videoId, title: s.title, artist: s.artist, genre: s.genre,
      ...(list.length ? { genres: list } : {}),
      ...(levels && levels.every((l) => l === 'song' || l === 'album') ? { genreLevels: levels } : {}),
      ...(artistGenres ? { artistGenres } : {}),
    };
    push(out, summarise(set, s.key, `${s.artist} - ${s.title}`, info, map));
  }
  return out;
}

const PLAN: readonly [SectionType, number, number][] = [
  ['intro', 0.07, 0.3], ['verse', 0.18, 0.5], ['chorus', 0.12, 0.8], ['verse', 0.16, 0.55], ['chorus', 0.12, 0.85], ['verse', 0.1, 0.6], ['chorus', 0.17, 0.9], ['outro', 0.08, 0.3],
];
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

/** As choreo.ts evalSet: stats-re-mapped traits on the saved map when its grid matches, else a uniform grid. */
function statsSet(dir: string, set: string, mode: 'A' | 'AB' | 'levels'): SongRow[] {
  const sample = readJson<{ songs: Sampled[] }>(join(dir, 'sample.json'), { songs: [] });
  const stats = readJson<RecordedStats>(join(dir, 'stats.json'), { analyzerVersion: '', songs: {} });
  const lists = readJson<Record<string, string[]>>(join(dir, 'genres.json'), {});
  const lv = mode === 'levels' ? readJson<Record<string, GenreLookup>>(join(dir, 'genre-lookups-levels.json'), {}) : {};
  const out: SongRow[] = [];
  for (const s of sample.songs) {
    const st = stats.songs[s.key];
    if (!st) continue;
    const traits = traitsFromStats(st.stats);
    const mapPath = join(dir, 'maps', `${s.key}.json`);
    const old = existsSync(mapPath) ? (JSON.parse(readFileSync(mapPath, 'utf8')) as BeatMap) : null;
    const map: BeatMap = old && old.bpm > 0 && Math.abs(old.bpm / Math.max(1, st.bpm) - 1) < 0.02
      ? { ...old, bpm: st.bpm, traits: traits as BeatMap['traits'] }
      : { ...uniformMap(s.key, st.beats >= 16 ? st.bpm : 0, old?.duration ?? s.durationSec, old?.sections, old?.beats[0] ?? 0.4), traits: traits as BeatMap['traits'] };
    const base: SongInfo = { videoId: s.key, title: s.title, artist: s.artist, ...(s.genre ? { genre: s.genre } : {}) };
    const name = `${s.artist} - ${s.title}`;
    if (mode === 'levels') {
      const l = lv[s.key];
      const info: SongInfo = {
        ...base,
        ...(l?.genres?.length ? { genres: l.genres } : {}),
        ...(l?.genres?.length && l.genreLevels?.length === l.genres.length ? { genreLevels: l.genreLevels } : {}),
        ...(l?.artistGenres?.length ? { artistGenre: l.artistGenres[0], artistGenres: l.artistGenres } : {}),
      };
      push(out, summarise(`${set}:L`, s.key, name, info, map));
      continue;
    }
    push(out, summarise(`${set}:A`, s.key, name, base, map));
    if (mode === 'AB' && lists[s.key]?.length) push(out, summarise(`${set}:B`, s.key, name, { ...base, genres: lists[s.key] }, map));
  }
  return out;
}

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
function famous(): SongRow[] {
  const stats = readJson<RecordedStats>(join(DATA, 'famous14', 'stats.json'), { analyzerVersion: '', songs: {} });
  const out: SongRow[] = [];
  const seen = new Set<string>();
  for (const [k, st] of Object.entries(stats.songs)) {
    const name = k.split('.')[0];
    if (seen.has(name) || !FAMOUS[name]) continue;
    seen.add(name);
    const [title, genre, genres] = FAMOUS[name];
    const map = { ...uniformMap(name, st.beats >= 16 ? st.bpm : 0, Math.max(150, st.beats * (60 / Math.max(1, st.bpm)) + 2)), traits: traitsFromStats(st.stats) as BeatMap['traits'] };
    push(out, summarise('famous:B', name, title, { videoId: name, title, genre, genres }, map));
  }
  return out;
}

function catalog(): SongRow[] {
  const songs = readJson<{ songs: { videoId: string; title: string; artist: string; genre?: string }[] }>(join(ROOT, 'public', 'songs.json'), { songs: [] });
  const raw = readJson<Record<string, unknown>>(join(ROOT, 'public', 'genres.json'), {});
  const recs = (raw.songs && typeof raw.songs === 'object' ? raw.songs : raw) as Record<string, GenreLookup & { videoIds?: string[] }>;
  const byVid = new Map<string, GenreLookup>();
  for (const r of Object.values(recs)) if (r && Array.isArray(r.genres) && r.genres.length) for (const v of r.videoIds ?? []) byVid.set(v, r);
  const info = new Map<string, { title: string; artist: string; genre?: string }>();
  for (const s of starter as { videoId: string; title: string; artist: string }[]) info.set(s.videoId, s);
  for (const s of songs.songs) if (!info.has(s.videoId)) info.set(s.videoId, s);
  const out: SongRow[] = [];
  const dir = join(ROOT, 'public', 'beatmaps');
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const map = JSON.parse(readFileSync(join(dir, f), 'utf8')) as BeatMap;
    if (!map?.videoId || !Array.isArray(map.beats)) continue;
    const id = f.slice(0, -5);
    const i = info.get(id) ?? { title: id, artist: '' };
    const l = byVid.get(id);
    push(out, summarise('catalog', id, `${i.artist} - ${i.title}`, {
      videoId: id, title: i.title, artist: i.artist, ...(i.genre ? { genre: i.genre } : {}),
      ...(l?.genres.length ? { genres: l.genres } : {}),
      ...(l?.genres.length && l.genreLevels?.length === l.genres.length ? { genreLevels: l.genreLevels } : {}),
      ...(l?.artistGenres?.length ? { artistGenre: l.artistGenres[0], artistGenres: l.artistGenres } : {}),
    }, map));
  }
  return out;
}

function push(out: SongRow[], r: SongRow | null) {
  if (r) out.push(r);
}

const pct = (x: number) => `${Math.round(100 * x)}`;
const meanOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const corr = (xs: number[], ys: number[]) => {
  const mx = meanOf(xs), my = meanOf(ys);
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < xs.length; i++) (a += (xs[i] - mx) * (ys[i] - my)), (b += (xs[i] - mx) ** 2), (c += (ys[i] - my) ** 2);
  return b && c ? a / Math.sqrt(b * c) : 0;
};

/** Summary lines (markdown table rows) of a set of song rows. */
export function summary(rows: SongRow[], title: string): string[] {
  const out: string[] = [`#### ${title} (${rows.length} song passes)`, '', '| | Easy | Medium | Hard |', '|---|---|---|---|'];
  const row = (name: string, f: (lv: Intensity) => string) => out.push(`| ${name} | ${LEVELS.map(f).join(' | ')} |`);
  const opened = rows.filter((r) => r.open.length);
  row(`genre share, open sets (n=${opened.length}): mean / min`, (lv) => {
    const xs = opened.map((r) => r.levels[lv].genre);
    return xs.length ? `${pct(meanOf(xs))} / ${pct(Math.min(...xs))}` : '-';
  });
  row('top move share of main beats: mean / max', (lv) => {
    const xs = rows.map((r) => r.levels[lv].top1);
    return `${pct(meanOf(xs))} / ${pct(Math.max(...xs))}`;
  });
  row('top genre move share of genre beats: mean / max', (lv) => {
    const xs = opened.map((r) => r.levels[lv].topGenre1).filter((x) => x > 0);
    return xs.length ? `${pct(meanOf(xs))} / ${pct(Math.max(...xs))}` : '-';
  });
  row('distinct moves (mean)', (lv) => meanOf(rows.map((r) => r.levels[lv].distinct)).toFixed(1));
  const noncalm = rows.filter((r) => !r.calmSong);
  row(`non-calm songs (n=${noncalm.length}) with a calm-toned move in the top 10`, (lv) => `${noncalm.filter((r) => r.levels[lv].calmTop.length).length}`);
  row('... calm-toned share of main beats, non-calm songs: mean / max', (lv) => {
    const xs = noncalm.map((r) => r.levels[lv].calmShare);
    return xs.length ? `${pct(meanOf(xs))} / ${pct(Math.max(...xs))}` : '-';
  });
  const calm = rows.filter((r) => r.calmSong);
  row(`calm songs (n=${calm.length}): calm-toned share mean`, (lv) => (calm.length ? pct(meanOf(calm.map((r) => r.levels[lv].calmShare))) : '-'));
  row(`boxing move in the top 10 of a calm song`, (lv) => `${calm.filter((r) => r.levels[lv].boxTop.length).length}`);
  row('jump share: mean / max (cap)', (lv) => {
    const xs = rows.map((r) => r.levels[lv].jump);
    return `${pct(meanOf(xs))} / ${pct(Math.max(...xs))} (${pct(JUMP_CAP[lv])})`;
  });
  row('difficulty 2+ share: mean / max', (lv) => {
    const xs = rows.map((r) => r.levels[lv].hard ?? 0);
    return `${pct(meanOf(xs))} / ${pct(Math.max(...xs))}`;
  });
  row('high share: mean', (lv) => pct(meanOf(rows.map((r) => r.levels[lv].high))));
  const withI = rows.filter((r) => r.intensity !== undefined);
  if (withI.length >= 4) {
    row(`high share vs intensity (n=${withI.length}): corr`, (lv) => corr(withI.map((r) => r.intensity!), withI.map((r) => r.levels[lv].high)).toFixed(2));
    const lo = withI.filter((r) => r.intensity! < 0.45 || (r.calm ?? 0) >= 0.55);
    const hi = withI.filter((r) => r.intensity! >= 0.65 && (r.calm ?? 0) < 0.45);
    row(`high share, soft/calm (n=${lo.length}) vs intense (n=${hi.length})`, (lv) => `${pct(meanOf(lo.map((r) => r.levels[lv].high)))} vs ${pct(meanOf(hi.map((r) => r.levels[lv].high)))}`);
  }
  out.push('');
  return out;
}

function report(rows: SongRow[]): string[] {
  const sets = [...new Set(rows.map((r) => r.set))];
  const lines: string[] = [];
  lines.push(...summary(rows, 'all'));
  for (const s of sets) lines.push(...summary(rows.filter((r) => r.set === s), s));
  return lines;
}

if (process.argv[1]?.endsWith('fill.ts')) {
  if (process.argv.includes('--compare')) {
    const i = process.argv.indexOf('--compare');
    for (const p of [process.argv[i + 1], process.argv[i + 2]]) {
      console.log(`### ${p}\n`);
      console.log(report(JSON.parse(readFileSync(p, 'utf8')) as SongRow[]).join('\n'));
    }
  } else {
    const want = new Set((arg('sets') ?? 'r15,r1,run,levels,heldout,famous,catalog').split(','));
    const rows: SongRow[] = [];
    if (want.has('r15')) rows.push(...appSet(join(DATA, 'run-20261115'), 'r15'));
    if (want.has('r1')) rows.push(...appSet(join(DATA, 'run-20261115', 'round1-rescore'), 'r1'));
    if (want.has('run')) rows.push(...statsSet(join(DATA, 'run-20261113'), 'run', 'AB'));
    if (want.has('levels')) rows.push(...statsSet(join(DATA, 'run-20261113'), 'run', 'levels'));
    if (want.has('heldout')) rows.push(...statsSet(join(DATA, 'heldout-20261114'), 'heldout', 'A'));
    if (want.has('famous')) rows.push(...famous());
    if (want.has('catalog')) rows.push(...catalog());
    const file = arg('out');
    if (file) writeFileSync(file, `${JSON.stringify(rows, null, 1)}\n`);
    console.log(report(rows).join('\n'));
  }
}
