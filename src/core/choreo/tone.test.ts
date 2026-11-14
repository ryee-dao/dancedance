import { describe, expect, it } from 'vitest';
import { EASY_HARD_CAP, calmTone, calmToned, generateRoutine, highCap, songDrive, type Intensity, type MoveInstance, type Routine } from './generator';
import { MOVES } from './moves';
import { publishedSongs } from './published.testutil';
import { resolveSongStyle, type SongStyle } from './songStyle';
import { songMap } from './testutil';

/**
 * The generic fill's tone: calm-toned moves (tai chi, yoga, warm-up flows,
 * ballet arms) stay out of the main sections of songs that aren't calm, and
 * the share of high-intensity moves follows the song's drive as well as the
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
        const d = danced(generateRoutine(s.map, lv, { style: s.style }));
        // A slot may run half over the budget when it is cast (HIGH_OVER), variations a little more.
        expect(share(d, (i) => i.move.level === 'high'), `${s.title} ${lv}`).toBeLessThanOrEqual(highCap(s.style, lv) + 0.1);
        if (lv === 'chill') expect(share(d, (i) => i.move.difficulty > 1), s.title).toBeLessThanOrEqual(2 * EASY_HARD_CAP);
      }
    }
  });
});
