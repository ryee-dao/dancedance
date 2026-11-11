import { describe, expect, it } from 'vitest';
import type { Family } from './families';
import { generateRoutine, type Intensity, type MoveInstance, type RoutineOpts } from './generator';
import { MOVES } from './moves';
import { BALANCED_POP, resolveSongStyle, signatureMoveIds, songSignature, type SongStyle } from './songStyle';
import { songMap } from './testutil';

const style = (families: Partial<Record<Family, number>>, extra: Partial<SongStyle> = {}): SongStyle => ({ families, themes: [], source: 'override', ...extra });

/** Unit-start instances of real dance moves (not grooves, cooldown or the chorus combo). */
function picks(ins: readonly MoveInstance[]): MoveInstance[] {
  return ins.filter((i) => i.unitStart && !i.move.idle && !i.move.cooldown && !i.sig);
}

function share(ids: string[], lv: Intensity, opts: RoutineOpts, pred: (i: MoveInstance) => boolean): number {
  let hit = 0, n = 0;
  for (const id of ids) {
    for (const i of picks(generateRoutine(songMap(124, id), lv, opts).instances)) {
      n++;
      if (pred(i)) hit++;
    }
  }
  return hit / n;
}

const SONGS = ['s1', 's2', 's3', 's4', 's5', 's6'];

describe('song style -> routine', () => {
  it('weights picks toward the song\'s families (measurably, never exclusively)', () => {
    for (const fam of ['latin', 'rock', 'disco'] as const) {
      const own = share(SONGS, 'cardio', { style: style({ [fam]: 1 }) }, (i) => i.move.families.includes(fam));
      const other = share(SONGS, 'cardio', { style: style({ pop: 1 }) }, (i) => i.move.families.includes(fam));
      expect(own, fam).toBeGreaterThan(0.5);
      expect(own, fam).toBeLessThan(0.97); // the rest of the pool stays reachable
      expect(own - other, fam).toBeGreaterThan(0.25);
    }
  });

  it('gives an unknown song a balanced, varied routine', () => {
    const s = resolveSongStyle({ videoId: 'zzzUnknown01', title: 'Totally Unknown Track', artist: 'Nobody You Know' });
    expect(s.source).toBe('fallback');
    const r = generateRoutine(songMap(120, 'zzzUnknown01'), 'cardio', { style: s });
    const p = picks(r.instances);
    const distinct = new Set(p.map((i) => i.move.id));
    expect(distinct.size).toBeGreaterThanOrEqual(10);
    const fams = new Set(p.flatMap((i) => i.move.families));
    expect(fams.size).toBeGreaterThanOrEqual(4);
    // No family dominates.
    for (const f of fams) expect(p.filter((i) => i.move.families[0] === f).length / p.length).toBeLessThan(0.6);
    expect(BALANCED_POP.families.pop).toBeGreaterThan(0);
  });

  it('title themes boost the matching moves', () => {
    // A larger sample: a handful of songs is noisy now that palettes recur.
    const ids = Array.from({ length: 16 }, (_, k) => `theme-${k}`);
    const base = share(ids, 'cardio', { style: style({ pop: 1 }) }, (i) => i.move.themes.includes('hips'));
    const themed = share(ids, 'cardio', { style: style({ pop: 1 }, { themes: ['hips'] }) }, (i) => i.move.themes.includes('hips'));
    expect(themed).toBeGreaterThan(base * 1.3);
  });

  it('keeps the level rules: Easy has no jumps and no fast turns, whatever the style', () => {
    for (const s of [style({ aerobic: 1 }, { themes: ['jump', 'spin'] }), style({ latin: 1 }, { themes: ['spin'] }), BALANCED_POP]) {
      let n = 0, hard = 0;
      for (const id of SONGS) {
        for (const i of generateRoutine(songMap(126, id), 'chill', { style: s }).instances) {
          expect(i.move.jump, i.move.id).toBe(false);
          expect(i.move.fastTurn, i.move.id).toBe(false);
          if (i.move.cooldown || i.move.idle) continue;
          n += i.span;
          if (i.move.difficulty > 1) hard += i.span;
        }
      }
      // Harder moves only now and then (a weight, not a rule).
      expect(hard / n).toBeLessThan(0.12);
    }
  });

  it('is deterministic, and two songs of the same family still differ', () => {
    const s = style({ latin: 1 });
    const a1 = generateRoutine(songMap(120, 'song-x'), 'cardio', { style: s }).instances.map((i) => i.move.id).join();
    const a2 = generateRoutine(songMap(120, 'song-x'), 'cardio', { style: s }).instances.map((i) => i.move.id).join();
    const b = generateRoutine(songMap(120, 'song-y'), 'cardio', { style: s }).instances.map((i) => i.move.id).join();
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('fresh routines differ per play but keep the chorus combo; same = stable', () => {
    const s = style({ disco: 1 });
    const map = songMap(118, 'fresh-song');
    const same1 = generateRoutine(map, 'cardio', { style: s });
    const same2 = generateRoutine(map, 'cardio', { style: s });
    const f1 = generateRoutine(map, 'cardio', { style: s, fresh: 1 });
    const f2 = generateRoutine(map, 'cardio', { style: s, fresh: 2 });
    const seq = (r: typeof f1) => r.instances.map((i) => i.move.id).join();
    expect(seq(same1)).toBe(seq(same2));
    expect(seq(f1)).not.toBe(seq(f2));
    expect(seq(f1)).not.toBe(seq(same1));
    const sig = (r: typeof f1) => r.signature.map((x) => x.move.id).join();
    expect(sig(f1)).toBe(sig(same1));
    expect(sig(f2)).toBe(sig(same1));
  });

  it('never repeats a move straight away, and rests a move for a few phrases', () => {
    for (const lv of ['cardio', 'sweaty'] as const) {
      for (const id of SONGS) {
        const units = picks(generateRoutine(songMap(122, id), lv, { style: BALANCED_POP }).instances);
        // Consecutive phrases never open with the move that just ended the previous one.
        for (let k = 1; k < units.length; k++) {
          if (units[k].phrase !== units[k - 1].phrase) expect(units[k].move.id, `${lv} ${id}`).not.toBe(units[k - 1].move.id);
        }
      }
    }
  });

  it('builds the chorus combo from a curated signature', () => {
    const s = style({ kpop: 1 }, { signature: ['gallop', 'lasso'] });
    const r = generateRoutine(songMap(132, 'gangnam-test'), 'cardio', { style: s });
    expect(r.signature.map((x) => x.move.id)).toEqual(expect.arrayContaining(['gallop', 'lasso']));
    const chorusSig = r.instances.filter((i) => i.sig && (i.section === 'chorus' || i.section === 'drop'));
    expect(chorusSig.length).toBeGreaterThan(0);
    expect(new Set(chorusSig.map((i) => i.move.id))).toEqual(new Set(['gallop', 'lasso']));
  });

  it('signature nods name real moves and resolve for the famous songs', () => {
    const ids = new Set(MOVES.map((m) => m.id));
    for (const id of signatureMoveIds()) expect(ids.has(id), id).toBe(true);
    expect(songSignature('Gangnam Style', 'PSY')).toEqual(['gallop', 'lasso']);
    expect(songSignature("Hips Don't Lie", 'Shakira feat. Wyclef Jean')).toContain('hip-sway');
    expect(songSignature('Gangnam Style (Live)', 'Someone Else')).toBeUndefined();
    const g = resolveSongStyle({ videoId: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY' });
    expect(g.signature).toEqual(['gallop', 'lasso']);
  });

  it('uses variations on Medium / Hard, few on Easy', () => {
    const v = (lv: Intensity) => share(SONGS, lv, { style: BALANCED_POP }, (i) => i.move.base !== i.move.id);
    expect(v('sweaty')).toBeGreaterThan(0.2);
    expect(v('cardio')).toBeGreaterThan(0.1);
    expect(v('chill')).toBeLessThan(v('cardio'));
  });
});
