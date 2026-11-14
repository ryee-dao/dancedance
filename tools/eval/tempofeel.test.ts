/// <reference types="node" />
/**
 * Real-music regression checks of the tempo feel (generator.ts danceFeel) and
 * the free time of a beatless map, without audio: every saved sample with a
 * researched stepping tempo (expectations / audio targets `danceBpm`, `altBpm`).
 *
 *   run-20261115 and its round1-rescore,  the saved analyser 1.4.0 maps, styled as the app
 *   fast-20261114                          does (the looked-up genres, levels, artist genres);
 *                                          fast-20261114: 28 well-known genuinely fast songs
 *                                          (pop, hip-hop, rock, rock and roll, ska, northern
 *                                          soul, K-pop, merengue) and controls, hand-picked
 *   run-20261113, heldout-20261114,        the recorded 1.4.0 trait statistics (stats.json)
 *   famous14                               on an even grid at the recorded tempo; heldout is
 *                                          styled from its iTunes tag only, famous14 from the
 *                                          common-knowledge genre names below
 *
 * Before the Nov 2026 round-two fixes: 55 of 64 songs danced in their range,
 * 2 of 10 songs counted at double tempo stepped at the felt one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../../src/core/analysis';
import { traitsFromStats } from '../../src/core/analysis/traits';
import { calmToned, danceFeel, feelAudio, generateRoutine, STEADY_TIME_BPM, tempoCandidates } from '../../src/core/choreo/generator';
import { resolveSongStyle, type SongStyle } from '../../src/core/choreo/songStyle';
import { traitsOf } from '../../src/core/choreo/songTraits';
import type { GenreLookup } from '../../src/genre';
import type { AudioTarget, SampledSong } from './common';
import type { RecordedStats } from './stats';

const DATA = join(__dirname, 'data');
const read = <T>(p: string, dflt: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : dflt);

/** The famous songs' genre names (common knowledge; famous14 has no lookups). */
const FAMOUS: Record<string, [string, string[]]> = {
  billiejean: ['Pop', ['post-disco', 'funk', 'dance-pop']],
  bringmetolife: ['Rock', ['nu metal', 'alternative metal', 'gothic metal']],
  essence: ['African', ['afrobeats', 'r&b']],
  faint: ['Rock', ['nu metal', 'rap metal']],
  gasolina: ['Urbano latino', ['reggaeton']],
  inthemood: ['Jazz', ['swing', 'big band']],
  maskoff: ['Hip-Hop/Rap', ['trap', 'hip hop']],
  myimmortal: ['Rock', ['piano rock', 'gothic rock']],
  prideandjoy: ['Blues', ['texas blues', 'blues rock']],
  scarymonsters: ['Dance', ['dubstep', 'brostep']],
  someonelikeyou: ['Pop', ['pop', 'soul', 'piano ballad']],
  stayinalive: ['Pop', ['disco']],
  watercolour: ['Electronic', ['drum and bass', 'electronic rock']],
  wefoundlove: ['Pop', ['electro house', 'dance-pop']],
};

interface Case {
  set: string;
  key: string;
  map: BeatMap;
  style: SongStyle;
  target?: AudioTarget;
}

function targetOf(e: unknown): AudioTarget | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const x = e as { audio?: AudioTarget; danceBpm?: unknown };
  return x.audio ?? (x.danceBpm ? (x as AudioTarget) : undefined);
}

/** As the app styles a song (src/ui/coachStage.ts routineInfo; tools/eval/run.ts pass B). */
function styleOf(map: BeatMap, song: { title?: string; artist?: string; genre?: string }, list: string[] | undefined, lk: GenreLookup | undefined): SongStyle {
  const secs = map.sections ?? [];
  const energy = secs.length ? secs.reduce((a, x) => a + x.energy, 0) / secs.length : undefined;
  const levels = list?.length && lk?.genreLevels?.length === list.length && lk.genres.join('|') === list.join('|') ? lk.genreLevels : undefined;
  const artistGenres = list && lk?.artistGenres?.length ? lk.artistGenres : undefined;
  return resolveSongStyle(
    {
      videoId: map.videoId, title: song.title, artist: song.artist, genre: song.genre,
      ...(list?.length ? { genres: list } : {}),
      ...(levels && levels.every((l) => l === 'song' || l === 'album') ? { genreLevels: levels } : {}),
      ...(artistGenres ? { artistGenres } : {}),
    },
    { bpm: map.bpm, energy, traits: traitsOf(map) },
  );
}

/** An even grid at the recorded tempo, with the traits re-mapped from the recorded statistics. */
function statsMap(key: string, s: RecordedStats['songs'][string]): BeatMap {
  const n = s.bpm > 0 ? s.beats : 0;
  const per = s.bpm > 0 ? 60 / s.bpm : 0.5;
  const beats = Array.from({ length: n }, (_, i) => Math.round((0.3 + i * per) * 1000) / 1000);
  const duration = Math.max(s.stats.seconds, n * per + 1);
  return {
    v: 1, analyzerVersion: '1.4.0', videoId: `stats-${key}`, duration, bpm: n ? s.bpm : 0, beats,
    downbeats: beats.map((_, i) => i).filter((i) => i % 4 === 0), sections: [{ start: 0, end: duration, type: 'verse', energy: 0.5 }],
    source: 'cloud', traits: traitsFromStats(s.stats) as BeatMap['traits'],
  };
}

function load(): Case[] {
  const out: Case[] = [];
  for (const [set, dir, expect, targets] of [
    ['r2', 'run-20261115', 'run-20261115/expectations.json', ''],
    ['r1', 'run-20261115/round1-rescore', 'run-20261113/expectations.json', 'run-20261113/audio-targets.json'],
    ['fast', 'fast-20261114', 'fast-20261114/audio-targets.json', ''],
  ] as const) {
    const songs = read<{ songs: SampledSong[] }>(join(DATA, dir, 'sample.json'), { songs: [] }).songs;
    const lookups = read<Record<string, GenreLookup>>(join(DATA, dir, 'genre-lookups.json'), {});
    const genres = read<Record<string, string[]>>(join(DATA, dir, 'genres.json'), {});
    const exp = read<Record<string, unknown>>(join(DATA, expect), {});
    const tg = targets ? read<Record<string, unknown>>(join(DATA, targets), {}) : {};
    for (const s of songs) {
      const p = join(DATA, dir, 'maps', `${s.key}.json`);
      if (!existsSync(p)) continue;
      const map = JSON.parse(readFileSync(p, 'utf8')) as BeatMap;
      out.push({ set, key: s.key, map, style: styleOf(map, s, genres[s.key] ?? [], lookups[s.key]), target: targetOf(exp[s.key]) ?? targetOf(tg[s.key]) });
    }
  }
  for (const [set, dir, expect] of [
    ['t13', 'run-20261113', 'run-20261113/audio-targets.json'],
    ['ho', 'heldout-20261114', 'heldout-20261114/expectations.json'],
    ['fam', 'famous14', 'famous14/audio-targets.json'],
  ] as const) {
    const stats = read<RecordedStats>(join(DATA, dir, 'stats.json'), { analyzerVersion: '', songs: {} }).songs;
    const songs = read<{ songs: SampledSong[] }>(join(DATA, dir, 'sample.json'), { songs: [] }).songs;
    const lookups = read<Record<string, GenreLookup>>(join(DATA, dir, 'genre-lookups.json'), {});
    const genres = read<Record<string, string[]>>(join(DATA, dir, 'genres.json'), {});
    const exp = read<Record<string, unknown>>(join(DATA, expect), {});
    for (const [key, s] of Object.entries(stats)) {
      const base = key.split('.')[0];
      const fam = FAMOUS[base];
      const song = songs.find((x) => x.key === key) ?? { title: base, genre: fam?.[0] };
      const map = statsMap(key, s);
      out.push({ set, key, map, style: styleOf(map, song, fam ? fam[1] : (genres[key] ?? []), lookups[key]), target: targetOf(exp[key] ?? exp[base]) });
    }
  }
  return out;
}

const within = (bpm: number, r?: readonly [number, number]) => !!r && bpm >= r[0] * 0.96 && bpm <= r[1] * 1.04;

describe.skipIf(!existsSync(join(DATA, 'run-20261115', 'maps')))('real music: the tempo feel over every saved sample', () => {
  const cases = load();
  const graded = cases
    .filter((c) => c.map.bpm > 0 && c.map.beats.length >= 16 && c.target?.danceBpm)
    .map((c) => {
      const feel = danceFeel(c.style, c.map.bpm, tempoCandidates(c.map), feelAudio(c.map));
      const danced = c.map.bpm * feel;
      const t = c.target!;
      return { ...c, feel, danced, ok: within(danced, t.danceBpm) || within(danced, t.altBpm), counted: within(c.map.bpm, t.danceBpm), double: within(c.map.bpm / 2, t.danceBpm) };
    });
  const label = (g: (typeof graded)[number]) => `${g.set}/${g.key} ${g.map.bpm} -> ${g.danced} (${JSON.stringify(g.target?.danceBpm)})`;

  it('is graded on enough songs', () => {
    expect(graded.length).toBeGreaterThanOrEqual(60);
  });

  it('every song counted at its stepping tempo keeps it (punk, metal, trap, drum and bass, disco, ballads)', () => {
    const lost = graded.filter((g) => g.counted && !g.ok).map(label);
    expect(lost).toEqual([]);
    expect(graded.filter((g) => g.counted).length).toBeGreaterThanOrEqual(45);
  });

  it('a song counted at double tempo steps at the felt one', () => {
    const dbl = graded.filter((g) => g.double);
    const fixed = dbl.filter((g) => within(g.danced, g.target!.danceBpm));
    console.log(`[tempofeel] double counts stepped at the felt tempo ${fixed.length}/${dbl.length}; not: ${dbl.filter((g) => !fixed.includes(g)).map(label).join('; ')}`);
    expect(dbl.length).toBeGreaterThanOrEqual(8);
    // Before the round-two fixes 2 of 10; Céline Dion's power ballad (no half candidate, mid intensity) is still counted.
    expect(fixed.length).toBeGreaterThanOrEqual(dbl.length - 1);
  });

  it('genuinely fast songs (pop, hip-hop, rock, rock and roll, ska, northern soul, K-pop) counted fast keep their count', () => {
    // data/fast-20261114: 28 well-known fast songs and a few controls, researched before the tempo feel was retuned.
    const fast = graded.filter((g) => g.set === 'fast' && g.counted && g.target!.danceBpm![0] >= 140);
    expect(fast.length).toBeGreaterThanOrEqual(12);
    expect(fast.filter((g) => !g.ok).map(label)).toEqual([]);
  });

  it('a fast song counted at half steps at its tempo when the analysis offers the double strongly', () => {
    const half = graded.filter((g) => within(g.map.bpm * 2, g.target!.danceBpm) && !within(g.map.bpm, g.target!.danceBpm) && !within(g.map.bpm, g.target!.altBpm));
    const strong = half.filter((g) => (tempoCandidates(g.map).double ?? 0) >= 0.75);
    console.log(`[tempofeel] half counts stepped at the tempo ${half.filter((g) => g.feel === 2).length}/${half.length}; not: ${half.filter((g) => g.feel !== 2).map(label).join('; ')}`);
    expect(strong.length).toBeGreaterThanOrEqual(4);
    expect(strong.filter((g) => g.feel !== 2).map(label)).toEqual([]);
  });

  it('most songs are danced in their researched range', () => {
    const ok = graded.filter((g) => g.ok).length;
    console.log(`[tempofeel] in range ${ok}/${graded.length}`);
    expect(ok / graded.length).toBeGreaterThanOrEqual(0.9);
  });

  it('a driving song with no beat grid gets a steady grid with its own style, never the lyrical flow', () => {
    const beatless = cases.filter((c) => c.map.beats.length < 16 && c.map.duration > 20);
    const driving = beatless.filter((c) => (c.map.traits?.intensity ?? 0) >= 0.8);
    expect(driving.length).toBeGreaterThanOrEqual(1);
    for (const c of driving) {
      for (const lv of ['chill', 'cardio', 'sweaty'] as const) {
        const r = generateRoutine(c.map, lv, { style: c.style });
        expect(r.freeTime, c.key).toBe(true);
        expect(r.bpm!, c.key).toBeGreaterThanOrEqual(STEADY_TIME_BPM[0]);
        expect(r.instances.filter((i) => i.move.genre === 'lyrical'), c.key).toEqual([]);
        // ... and its own character: no calm-toned flow (tai chi, yoga, ballet arms) outside the warm-up and the outro.
        const first = Math.min(...r.instances.filter((i) => i.phrase >= 0).map((i) => i.phrase));
        const main = r.instances.filter((i) => !i.move.idle && !i.move.cooldown && i.section !== 'intro' && i.section !== 'outro' && i.phrase !== first);
        expect(main.filter((i) => calmToned(i.move)).map((i) => i.move.name), `${c.key} ${lv}`).toEqual([]);
      }
    }
    // The calm beatless ones (jazz ballads, a recitative, a slow piano ballad) keep the slow flow.
    for (const c of beatless.filter((x) => (x.map.traits?.calm ?? 0) >= 0.6)) expect(generateRoutine(c.map, 'cardio', { style: c.style }).bpm!, c.key).toBeLessThan(STEADY_TIME_BPM[0]);
  });
});
