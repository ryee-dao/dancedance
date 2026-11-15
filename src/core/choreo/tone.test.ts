import { describe, expect, it } from 'vitest';
import { EASY_HARD_CAP, GLOBAL_MOVE_CAP, calmTone, calmToned, generateRoutine, highCap, songDrive, songEnergy, type Intensity, type MoveInstance, type Routine } from './generator';
import { moveAggression, moveReach } from './weights';
import { MOVES } from './moves';
import { publishedSongs } from './published.testutil';
import { resolveSongStyle, type SongStyle } from './songStyle';
import { songMap } from './testutil';

/**
 * The generic fill's tone: calm-toned moves (tai chi, yoga, warm-up flows,
 * ballet arms) stay out of the main sections of songs that aren't calm, and
 * the share of high-intensity moves follows the song's energy as well as the
 * level.
 */

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const IDS = Array.from({ length: 16 }, (_, k) => `tone${k}`);
const danced = (r: Routine) => r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
const beats = (xs: readonly MoveInstance[]) => xs.reduce((a, i) => a + i.span, 0);
/** The main sections: not the intro, the outro or the warm-up (the routine's first phrase). */
function main(r: Routine): MoveInstance[] {
  const d = danced(r);
  const first = Math.min(...d.filter((i) => i.phrase >= 0).map((i) => i.phrase));
  return d.filter((i) => i.section !== 'intro' && i.section !== 'outro' && i.phrase !== first);
}
const share = (xs: readonly MoveInstance[], f: (i: MoveInstance) => boolean) => beats(xs.filter(f)) / Math.max(1, beats(xs));
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;

describe('calm-toned moves', () => {
  it('are the calm-moves file\'s flows and the port de bras arms, not its stretches', () => {
    const toned = MOVES.filter(calmToned);
    expect(toned.length).toBeGreaterThan(20);
    for (const id of ['heaven-earth', 'single-whip', 'cloud-hands', 'tree-pose', 'port-de-bras', 'kickline-port-de-bras']) expect(toned.some((m) => m.id === id), id).toBe(true);
    for (const m of MOVES) if (m.cooldown || m.idle) expect(calmToned(m), m.id).toBe(false);
    expect(toned.some((m) => m.id === 'step-touch')).toBe(false);
  });

  it('never come into the main sections or the combo of a song that is not calm (every published map, every level)', () => {
    let checked = 0;
    for (const s of publishedSongs()) {
      if (calmTone(s.style) > 0) continue;
      for (const lv of LEVELS) {
        const r = generateRoutine(s.map, lv, { style: s.style });
        const bad = main(r).filter((i) => calmToned(i.move));
        expect(bad.map((i) => `${i.move.name} ${i.section}@${i.start}`), `${s.title} ${lv}`).toEqual([]);
        expect(r.signature.filter((x) => calmToned(x.move)).map((x) => x.move.name), `${s.title} ${lv}`).toEqual([]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('stay welcome on calm songs, and a driving song\'s warm-up takes them less', () => {
    const ballad = resolveSongStyle({ title: 'Ballad', genre: 'Pop' }, { bpm: 76, traits: { calm: 0.9, drive: 0.2, intensity: 0.05 } });
    const banger = resolveSongStyle({ title: 'Banger', genre: 'Pop' }, { bpm: 124, traits: { calm: 0.05, drive: 0.95, intensity: 0.8 } });
    expect(calmTone(ballad)).toBe(1);
    expect(calmTone(banger)).toBe(0);
    const warm = (r: Routine) => {
      const d = danced(r);
      const first = Math.min(...d.filter((i) => i.phrase >= 0).map((i) => i.phrase));
      return d.filter((i) => i.phrase === first || i.section === 'intro');
    };
    const calmMain: number[] = [], calmWarm: number[] = [], bangWarm: number[] = [];
    for (const id of IDS) {
      const a = generateRoutine(songMap(76, id), 'chill', { style: ballad });
      const b = generateRoutine(songMap(124, id), 'chill', { style: banger });
      calmMain.push(share(main(a), (i) => calmToned(i.move)));
      calmWarm.push(share(warm(a), (i) => calmToned(i.move)));
      bangWarm.push(share(warm(b), (i) => calmToned(i.move)));
    }
    expect(mean(calmMain)).toBeGreaterThan(0.05);
    expect(mean(bangWarm)).toBeLessThan(mean(calmWarm));
  });

  it('punches (fitness boxing) are rare on a calm song', () => {
    const ballad = resolveSongStyle({ title: 'Ballad', genre: 'Rock' }, { bpm: 80, traits: { calm: 0.85, drive: 0.3, intensity: 0.1 } });
    const anthem = resolveSongStyle({ title: 'Anthem', genre: 'Rock' }, { bpm: 128, traits: { calm: 0.05, drive: 0.9, intensity: 0.9 } });
    for (const lv of ['cardio', 'sweaty'] as const) {
      const soft: number[] = [], hard: number[] = [];
      for (const id of IDS) {
        soft.push(share(main(generateRoutine(songMap(80, id), lv, { style: ballad })), (i) => i.move.themes.includes('punch')));
        hard.push(share(main(generateRoutine(songMap(128, id), lv, { style: anthem })), (i) => i.move.themes.includes('punch')));
      }
      expect(mean(soft), lv).toBeLessThan(0.03);
      expect(mean(soft), lv).toBeLessThan(mean(hard));
    }
  });
});

describe('high-intensity fill follows the song', () => {
  const style = (intensity: number): SongStyle => resolveSongStyle({ title: 'Song', genre: 'Pop' }, { bpm: 124, traits: { calm: 0.15, drive: 0.8, intensity } });

  it('a soft song gets fewer high-intensity moves than a hard-hitting one at the same level and tempo', () => {
    const soft = style(0.1), hard = style(0.95);
    expect(songDrive(soft)).toBeLessThan(0.1);
    expect(songDrive(hard)).toBeGreaterThan(0.9);
    // Measured Nov 2026 (16 songs at 124 BPM, calm 0.15): Medium 8 % vs 13 %, Hard 13 % vs 42 %
    // (10 % vs 14 % and 17 % vs 38 % before the drive lean and highCap).
    for (const [lv, gap] of [['cardio', 0.03], ['sweaty', 0.2]] as const) {
      const s: number[] = [], h: number[] = [];
      for (const id of IDS) {
        s.push(share(danced(generateRoutine(songMap(124, id), lv, { style: soft })), (i) => i.move.level === 'high'));
        h.push(share(danced(generateRoutine(songMap(124, id), lv, { style: hard })), (i) => i.move.level === 'high'));
      }
      expect(mean(s) + gap, lv).toBeLessThan(mean(h));
    }
  });

  it('stays within the high-intensity budget (highCap) on every published map, and Easy keeps to simple moves', () => {
    for (const s of publishedSongs()) {
      for (const lv of LEVELS) {
        const r = generateRoutine(s.map, lv, { style: s.style });
        const d = danced(r);
        // A slot may run half over the budget when it is cast (HIGH_OVER), variations a little more.
        // The budget is the song's energy at the tempo it is danced at (songEnergy).
        expect(share(d, (i) => i.move.level === 'high'), `${s.title} ${lv}`).toBeLessThanOrEqual(highCap(s.style, lv, r.bpm) + 0.1);
        if (lv === 'chill') expect(share(d, (i) => i.move.difficulty > 1), s.title).toBeLessThanOrEqual(2 * EASY_HARD_CAP);
      }
      // Easy's hard-move cap holds by construction (EASY_HARD_CAP_THIN at most, odd-run slots and the cool-down
      // included), in every play of a song, not only its first.
      for (const fresh of [1, 2]) {
        const d = danced(generateRoutine(s.map, 'chill', { style: s.style, fresh }));
        expect(share(d, (i) => i.move.difficulty > 1), `${s.title} play ${fresh}`).toBeLessThanOrEqual(2 * EASY_HARD_CAP);
      }
    }
  });
});

describe('the song\'s energy steers the material within the level', () => {
  const IDS24 = Array.from({ length: 24 }, (_, k) => `e${k}`);
  const st = (genres: string[], intensity: number, calm: number) => resolveSongStyle({ genres }, { traits: { calm, drive: 0.85, intensity } });
  /** Danced-time averages over 24 songs: aggression of the genre / global moves, reach, high and jump shares, the top global move of the main sections. */
  function stats(s: SongStyle, bpm: number, lv: Intensity) {
    let t = 0, g = 0, ga = 0, gl = 0, gla = 0, reach = 0, high = 0, jump = 0;
    const top: number[] = [];
    for (const id of IDS24) {
      const r = generateRoutine(songMap(bpm, id), lv, { style: s });
      const by = new Map<string, number>();
      const m = main(r);
      for (const i of m) if (!i.sig && !i.move.genre) by.set(i.move.base, (by.get(i.move.base) ?? 0) + i.span);
      top.push(Math.max(0, ...by.values()) / Math.max(1, beats(m)));
      for (const i of danced(r)) {
        const a = moveAggression(i.move);
        t += i.span;
        reach += moveReach(i.move) * i.span;
        if (i.move.level === 'high') high += i.span;
        if (i.move.jump) jump += i.span;
        if (i.move.genre) (g += i.span), (ga += a * i.span);
        else (gl += i.span), (gla += a * i.span);
      }
    }
    return { genreAggr: ga / Math.max(1, g), globalAggr: gla / Math.max(1, gl), reach: reach / t, high: high / t, jump: jump / t, top: mean(top), topMax: Math.max(...top) };
  }

  it('reads intensity, drive, the danced tempo, calm and softness continuously', () => {
    const e = (intensity: number, bpm = 120, calm = 0.1) => songEnergy(resolveSongStyle({ genre: 'Pop' }, { traits: { calm, drive: 0.85, intensity } }), bpm);
    expect(e(0.1)).toBeLessThan(e(0.5));
    expect(e(0.5)).toBeLessThan(e(0.9));
    expect(e(0.5, 80)).toBeLessThan(e(0.5, 128));
    expect(e(0.5, 120, 0.9)).toBeLessThan(0.5 * e(0.5, 120, 0.1));
    expect(e(0.95, 128)).toBeGreaterThan(0.85);
    expect(e(0.1, 80, 0.8)).toBeLessThan(0.1);
    // No audio intensity (an older map): the genre names and the tempo, around the middle.
    const plain = songEnergy(resolveSongStyle({ genre: 'Pop' }), 116);
    expect(plain).toBeGreaterThan(0.4);
    expect(plain).toBeLessThan(0.65);
  });

  // Nov 2026, 24 songs each (before -> after the energy steered the casting): the genre moves' aggression
  // (moveAggression), gentle / energetic rock, Medium 0.35 / 0.58 -> 0.31 / 0.63, Hard 0.44 / 0.71 -> 0.42 / 0.75;
  // R&B Medium 0.24 / 0.28 -> 0.21 / 0.33, Hard 0.28 / 0.40 -> 0.24 / 0.47. The generic fill of a plain pop song,
  // gentle / bright: Easy 0.14 / 0.25 -> 0.12 / 0.26, Medium 0.26 / 0.46 -> 0.23 / 0.55, Hard 0.32 / 0.59 -> 0.28 / 0.64.
  it('an open set dances its aggressive moves on its energetic songs and its smooth ones on its gentle songs', () => {
    for (const [genres, gap] of [[['rock'], 0.25], [['R&B'], 0.1]] as const) {
      for (const lv of ['cardio', 'sweaty'] as const) {
        const gentle = stats(st([...genres], 0.3, 0.25), 100, lv);
        const hard = stats(st([...genres], 0.95, 0), 124, lv);
        expect(hard.genreAggr - gentle.genreAggr, `${genres} ${lv}`).toBeGreaterThan(gap);
      }
    }
  });

  it('a song with no genre set: the generic fill follows the song too (gentle songs gentle, bright songs bright)', () => {
    for (const [lv, gap] of [['chill', 0.08], ['cardio', 0.22], ['sweaty', 0.25]] as const) {
      const gentle = stats(st(['pop'], 0.25, 0.25), 100, lv);
      const bright = stats(st(['pop'], 0.9, 0), 124, lv);
      expect(bright.globalAggr - gentle.globalAggr, lv).toBeGreaterThan(gap);
      if (lv !== 'chill') expect(bright.high - gentle.high, lv).toBeGreaterThan(0.15);
    }
  });

  it('Hard on a gentle song is still a workout: bigger range, deeper bends, more travel, not aggressive or jumpy', () => {
    const gentle = st(['pop'], 0.25, 0.25);
    const easy = stats(gentle, 100, 'chill');
    const medium = stats(gentle, 100, 'cardio');
    const hard = stats(gentle, 100, 'sweaty');
    // 24 songs, Nov 2026: reach Easy / Medium / Hard 0.17 / 0.34 / 0.42 before -> 0.16 / 0.36 / 0.46, Hard's
    // high-intensity share 21 % -> 11 %, no jumps either way.
    expect(hard.reach).toBeGreaterThan(medium.reach + 0.05);
    expect(medium.reach).toBeGreaterThan(easy.reach + 0.1);
    expect(hard.reach).toBeGreaterThan(0.42);
    expect(hard.high).toBeLessThan(0.15);
    expect(hard.jump).toBe(0);
  });

  it('no global kit move carries more than its share of the main sections', () => {
    // 24 ordinary pop songs, Nov 2026: the top global move's share of the main sections, mean, before -> after:
    // Easy 0.31 -> 0.20, Medium 0.22 -> 0.20, Hard 0.22 -> 0.20; at most 0.38 / 0.31 / 0.31 -> 0.25 / 0.25 / 0.25.
    for (const lv of LEVELS) {
      const s = stats(st(['pop'], 0.55, 0.1), 116, lv);
      expect(s.top, lv).toBeLessThan(GLOBAL_MOVE_CAP[lv] + 0.04);
      expect(s.topMax, lv).toBeLessThanOrEqual(0.3);
    }
  });
});
