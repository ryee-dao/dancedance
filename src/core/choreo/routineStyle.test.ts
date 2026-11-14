import { describe, expect, it } from 'vitest';
import type { Family } from './families';
import { cardsOf } from './cards';
import { GENRE_MAX, GENRE_MIN, generateRoutine, moveVigour, type Intensity, type MoveInstance, type RoutineOpts } from './generator';
import { moveSmoothness } from './weights';
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
    // A dozen songs: each casts one kit, so a handful is a small sample.
    const ids = Array.from({ length: 12 }, (_, k) => `s${k + 1}`);
    for (const fam of ['latin', 'rock', 'disco'] as const) {
      const own = share(ids, 'cardio', { style: style({ [fam]: 1 }) }, (i) => i.move.families.includes(fam));
      const other = share(ids, 'cardio', { style: style({ pop: 1 }) }, (i) => i.move.families.includes(fam));
      expect(own, fam).toBeGreaterThan(0.5);
      expect(own, fam).toBeLessThan(0.97); // the rest of the pool stays reachable
      expect(own - other, fam).toBeGreaterThan(0.25);
    }
  });

  it('gives an unknown song a balanced, varied routine', () => {
    // One kit per song is a small sample: over 40 unknown songs (Nov 2026) the families per routine average
    // 4.7 (before and after the jump budget), a fifth to a quarter of the songs at 3.
    let famSum = 0, famLow = 0, mostSum = 0, distinctSum = 0;
    for (let k = 0; k < 40; k++) {
      const id = k === 0 ? 'zzzUnknown01' : `zzzUnknown${k}x`;
      const s = resolveSongStyle({ videoId: id, title: 'Totally Unknown Track', artist: 'Nobody You Know' });
      expect(s.source).toBe('fallback');
      const p = picks(generateRoutine(songMap(120, id), 'cardio', { style: s }).instances);
      const distinct = new Set(p.map((i) => i.move.id));
      // A kit of recurring moves (verse motif, hook, power move, break ...), not a stream of new ones
      // (40 songs, Nov 2026: 7-14 distinct, mean 10.0 before the jump budget, 10.1 after).
      expect(distinct.size).toBeGreaterThanOrEqual(7);
      distinctSum += distinct.size;
      const fams = new Set(p.flatMap((i) => i.move.families));
      famSum += fams.size;
      if (fams.size < 4) famLow++;
      expect(fams.size).toBeGreaterThanOrEqual(2);
      // No family dominates: the most used one's share of the picks (40 songs, Nov 2026: mean 0.58 before
      // the jump budget, 0.56 after; single songs range 0.26-0.95 either way).
      let most = 0;
      for (const f of fams) most = Math.max(most, p.filter((i) => i.move.families[0] === f).length / p.length);
      mostSum += most;
    }
    expect(mostSum / 40).toBeLessThan(0.62);
    expect(distinctSum / 40).toBeGreaterThanOrEqual(9.5);
    expect(famSum / 40).toBeGreaterThanOrEqual(4.3);
    expect(famLow).toBeLessThanOrEqual(12);
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

describe('song character x level', () => {
  // 24 songs: over 6 the averages swing too much to compare (6-song windows of the banger-vs-ballad
  // vigour gap below ranged 0.06-0.22, Nov 2026); over 24-48 they hold within about +-0.02.
  const IDS = Array.from({ length: 24 }, (_, k) => `c${k + 1}`);
  /** Danced-time averages over several songs at one level (no grooves, cool-down or combo). */
  function stats(st: SongStyle, bpm: number, lv: Intensity) {
    let t = 0, jump = 0, genre = 0, lyrical = 0, smooth = 0, vig = 0, keys = 0, cards = 0, cardBeats = 0;
    const ids = new Set<string>();
    for (const id of IDS) {
      const r = generateRoutine(songMap(bpm, id), lv, { style: st });
      for (const i of r.instances) {
        if (i.move.idle || i.move.cooldown || i.sig) continue;
        t += i.span;
        if (i.move.jump) jump += i.span;
        if (i.move.genre === 'lyrical') lyrical += i.span;
        else if (i.move.genre) genre += i.span;
        smooth += moveSmoothness(i.move) * i.span;
        vig += moveVigour(i.move) * i.span;
        // Keys per SONG beat: how busy the coach is on the music.
        keys += (i.move.keys.length / i.move.beats / (i.half ? 2 : 1)) * i.span;
        ids.add(i.move.base);
      }
      for (const c of cardsOf(r.instances)) {
        cards++;
        cardBeats += c.end - c.start;
      }
    }
    // genre = genre time other than the lyrical mood set (which any calm song opens by design).
    return { jump: jump / t, genre: genre / t, lyrical: lyrical / t, smooth: smooth / t, vig: vig / t, keys: keys / t, card: cardBeats / cards, ids };
  }
  const ballad = resolveSongStyle({ title: 'My Immortal', genre: 'Hard Rock' }, { bpm: 78, traits: { calm: 0.9, heavy: 0.2, drive: 0.15 } });
  const driving = resolveSongStyle({ title: 'Bring Me to Life', genre: 'Hard Rock' }, { bpm: 78, traits: { calm: 0.15, heavy: 0.8, drive: 0.85 } });

  it('a calm "Hard Rock" song (My Immortal) gets no rock showpieces, no jumps, smooth moves and longer holds', () => {
    const SHOWPIECES = /headbang|hair-swing|air-guitar|pogo|mosh|circle-pit|windmill|rock-star-jump|guitar/;
    for (const lv of ['chill', 'cardio', 'sweaty'] as const) {
      const c = stats(ballad, 78, lv);
      const d = stats(driving, 78, lv);
      // No genre time but the lyrical set's, and that one carries a real share (the kit's GENRE_MIN..MAX).
      expect(c.genre, lv).toBe(0);
      expect(c.lyrical, lv).toBeGreaterThan(GENRE_MIN);
      expect(c.lyrical, lv).toBeLessThan(GENRE_MAX);
      expect(d.lyrical, lv).toBe(0);
      expect([...c.ids].filter((id) => SHOWPIECES.test(id)), lv).toEqual([]);
      expect(c.jump, lv).toBeLessThan(0.01);
      expect(c.smooth, lv).toBeGreaterThan(d.smooth + 0.1);
      expect(c.card, lv).toBeGreaterThan(d.card);
      // The driving song of the same family keeps its rock accents.
      expect(d.genre, lv).toBeGreaterThan(0.15);
    }
  });

  it('the level still sets the work: Hard on a ballad is bigger than Easy, without jumps; Easy on a banger stays on the beat', () => {
    const easy = stats(ballad, 78, 'chill');
    const hard = stats(ballad, 78, 'sweaty');
    expect(hard.vig).toBeGreaterThan(easy.vig + 0.15);
    expect(hard.jump).toBeLessThan(0.01);
    expect(hard.smooth).toBeGreaterThan(0.6);
    // Hard on a ballad is demanding through range and control (big, sustained moves; no novelty filler):
    // 24 songs, Nov 2026: vigour 0.42 before, 0.50 with that lean.
    expect(hard.vig).toBeGreaterThan(0.45);
    const banger = resolveSongStyle({ title: 'X', genre: 'Dance' }, { bpm: 170, traits: { calm: 0.1, drive: 0.9, fourFloor: 0.9 } });
    const bEasy = stats(banger, 170, 'chill');
    const bHard = stats(banger, 170, 'sweaty');
    expect(bEasy.jump).toBe(0);
    // About a key per song beat at most: on the beat, not a frantic full-speed sequence.
    expect(bEasy.keys).toBeLessThan(1.05);
    expect(bEasy.vig).toBeLessThan(bHard.vig - 0.2);
    // ... and the banger's character still shows on Hard: more vigorous than the ballad (24 songs, Nov 2026:
    // 0.60 vs 0.50; the margin was 0.58 vs 0.42 before Hard on a ballad leaned to big, controlled moves).
    expect(bHard.vig).toBeGreaterThan(hard.vig + 0.08);
  });
});
