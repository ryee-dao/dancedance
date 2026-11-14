/// <reference types="node" />
/**
 * Real music: the song's energy over the saved evaluation samples of rounds
 * two and three (data/run-20261115, data/run-20261116: saved maps, the app's
 * inputs, as fill.ts and run.ts score pass B). The level sets how hard the
 * workout is; within it the song's energy (songEnergy: audio intensity,
 * drive, danced tempo, calm, softness) scales the high-intensity and jump
 * shares and which moves are cast. Round three's judged songs are checked by
 * name; the numbers in the comments are Nov 2026, before -> after.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appSet, type SongRow } from './fill';

const DATA = join(__dirname, 'data');
const have = existsSync(join(DATA, 'run-20261116', 'maps')) && existsSync(join(DATA, 'run-20261115', 'maps'));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const corr = (xs: number[], ys: number[]) => {
  const mx = mean(xs), my = mean(ys);
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < xs.length; i++) (a += (xs[i] - mx) * (ys[i] - my)), (b += (xs[i] - mx) ** 2), (c += (ys[i] - my) ** 2);
  return b && c ? a / Math.sqrt(b * c) : 0;
};

describe.skipIf(!have)('real music: the song\'s energy over the saved samples (rounds two and three)', () => {
  let rows: SongRow[] = [];
  const song = (name: string) => {
    const r = rows.find((x) => x.set === 'r16' && x.name.includes(name));
    if (!r) throw new Error(`no ${name}`);
    return r.levels;
  };
  const load = () => {
    if (!rows.length) rows = [...appSet(join(DATA, 'run-20261116'), 'r16'), ...appSet(join(DATA, 'run-20261115'), 'r15')];
    return rows;
  };

  it('is measured on enough songs', () => {
    expect(load().filter((r) => r.intensity !== undefined).length).toBeGreaterThanOrEqual(70);
  });

  it('Medium and Hard high-intensity and jump shares follow the audio intensity', () => {
    const xs = load().filter((r) => r.intensity !== undefined);
    const I = xs.map((r) => r.intensity!);
    // 77 songs: high r 0.59 -> 0.73 (Medium), 0.56 -> 0.75 (Hard); jumps 0.33 -> 0.58, 0.51 -> 0.69.
    expect(corr(I, xs.map((r) => r.levels.cardio.high))).toBeGreaterThan(0.65);
    expect(corr(I, xs.map((r) => r.levels.sweaty.high))).toBeGreaterThan(0.65);
    expect(corr(I, xs.map((r) => r.levels.cardio.jump))).toBeGreaterThan(0.45);
    expect(corr(I, xs.map((r) => r.levels.sweaty.jump))).toBeGreaterThan(0.6);
  });

  it('round three, song by song: gentle songs are not danced aggressive or jumpy on Hard, the banger is', () => {
    load();
    // Wistful synth-pop: Hard 46 % high, 11 % jumps before.
    expect(song('Rule the World').sweaty.high).toBeLessThan(0.4);
    expect(song('Rule the World').sweaty.jump).toBeLessThanOrEqual(0.1);
    // A tender filmi duet: 21 % jumps (bhangra hops) before.
    expect(song('Pardesiya').sweaty.jump).toBeLessThan(0.08);
    // Lo-fi hip-hop (intensity 0.24, 86 BPM): Krump and 12 % jumps before.
    expect(song('Cherry Lips').sweaty.jump).toBe(0);
    expect(song('Cherry Lips').sweaty.high).toBeLessThan(0.1);
    // Reflective jangle rock (calm 0.39, intensity 0.42): headbangs, pogo, 18 % jumps before.
    expect(song('Made for Greatness').sweaty.jump).toBe(0);
    expect(song('Made for Greatness').sweaty.high).toBeLessThan(0.2);
    expect(song('Made for Greatness').sweaty.top.filter((t) => /pogo|headbang/i.test(t))).toEqual([]);
    // A 78 BPM slow jam: V Step Jab, The Fly, 19 % high before.
    expect(song('Don\'t Let Go').sweaty.high).toBeLessThan(0.15);
    expect(song('Don\'t Let Go').sweaty.top.filter((t) => /V Step Jab|The Fly/.test(t))).toEqual([]);
    // A brassy banger (intensity 0.99): Hard 12 % high, no jumps, Slow-Jam Sway and Slow Drag before.
    // Its shares averaged over the first 8 plays (RoutineOpts.fresh): one play's cardio high share swings
    // 0.05-0.27 with which moves get cast (a catalogue change that only reshuffles the picks moved the
    // first play from 0.21 to 0.09); the 8-play means were 0.15 / 0.36 / 0.17 before the Nov 2026
    // older-moves readability restage and 0.18 / 0.34 / 0.19 after it.
    const plays = Array.from({ length: 8 }, (_, f) => appSet(join(DATA, 'run-20261116'), 'r16', { only: 'HUSBAND', ...(f ? { fresh: f } : {}) })[0].levels);
    expect(mean(plays.map((p) => p.sweaty.high))).toBeGreaterThan(0.3);
    expect(mean(plays.map((p) => p.sweaty.jump))).toBeGreaterThan(0.05);
    expect(mean(plays.map((p) => p.cardio.high))).toBeGreaterThan(0.15);
    for (const lv of ['cardio', 'sweaty'] as const) expect(song('HUSBAND')[lv].top.filter((t) => /Slow-Jam Sway|Slow Drag/.test(t)), lv).toEqual([]);
  });

  it('no global filler hogs the main sections, and the genre share holds', () => {
    const xs = load();
    // Top global move of the main sections, mean: Easy 28 % -> 19 %, Medium 22 % -> 19 %, Hard 20 % -> 18 %
    // (Ripple Wave 224 beats of one song before, Knee Lift Airplane 193, Hair Flip 164, Step Touch L Arms 128).
    expect(mean(xs.map((r) => r.levels.chill.topGlobal1 ?? 0))).toBeLessThan(0.22);
    expect(mean(xs.map((r) => r.levels.cardio.topGlobal1 ?? 0))).toBeLessThan(0.21);
    for (const n of ['Aventura', 'Pardesiya', 'Made for Greatness', 'Surface - Happy', 'Toto - Africa']) expect(song(n).chill.topGlobal1 ?? 0, n).toBeLessThanOrEqual(0.25);
    // Genre share on songs that open a set: 49 / 50 / 50 % before and after.
    for (const lv of ['chill', 'cardio', 'sweaty'] as const) {
      const g = xs.filter((r) => r.open.length).map((r) => r.levels[lv].genre);
      expect(mean(g), lv).toBeGreaterThan(0.46);
      expect(mean(g), lv).toBeLessThan(0.53);
    }
  });
});
