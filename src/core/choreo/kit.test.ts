import { describe, expect, it } from 'vitest';
import type { BeatMap, SectionType } from '../analysis/beatmap';
import { GENRE_MAX, GENRE_MIN, generateRoutine, levelFactor, styleGenres, tierBeats, type Intensity, type MoveInstance, type Routine } from './generator';
import { MOVES, keysOf } from './moves';
import { publishedSongs } from './published.testutil';
import { resolveSongStyle, type SongStyle } from './songStyle';
import { songMap } from './testutil';
import { poseStepCost } from './weights';

/**
 * The song's kit: mostly global moves with a few genre accents, a cast that
 * differs from song to song, sections built from recurring motifs, and
 * flowing transitions without loops or a loss of variety.
 */

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const DANCE = MOVES.filter((m) => !m.idle && !m.cooldown);

interface Card { base: string; beats: number; first: MoveInstance; last: MoveInstance }
/** Runs of one base move (its variations and flourishes together); the combo is one run; the cool-down left out. */
function cards(r: Routine): Card[] {
  const out: Card[] = [];
  for (const i of r.instances) {
    if (i.move.idle || i.fill) continue;
    const key = i.sig ? 'SIG' : i.move.base;
    const l = out[out.length - 1];
    if (l && l.base === key) {
      l.beats += i.span;
      l.last = i;
    } else out.push({ base: key, beats: i.span, first: i, last: i });
  }
  return out;
}
const minutes = (m: BeatMap) => (m.beats[m.beats.length - 1] - m.beats[0]) / 60;
const median = (x: number[]) => [...x].sort((a, b) => a - b)[x.length >> 1];
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;

describe('the kit on every published map', () => {
  const songs = publishedSongs();
  const all = new Map<Intensity, { s: (typeof songs)[number]; r: Routine }[]>();
  const routines = (lv: Intensity) => {
    let x = all.get(lv);
    if (!x) all.set(lv, (x = songs.map((s) => ({ s, r: generateRoutine(s.map, lv, { style: s.style }) }))));
    return x;
  };

  it(`gives genre moves ${GENRE_MIN * 100}-${GENRE_MAX * 100} % of the danced time on songs that open a genre, none elsewhere (both routine modes)`, { timeout: 120_000 }, () => {
    for (const lv of LEVELS) {
      for (const fresh of [undefined, 3]) {
        for (const s of songs) {
          const r = fresh ? generateRoutine(s.map, lv, { style: s.style, fresh }) : routines(lv).find((x) => x.s === s)!.r;
          const t = tierBeats(r, s.style);
          const open = styleGenres(s.style);
          const tag = `${s.id} ${s.title} ${lv} ${fresh ?? 'same'}`;
          if (!open.size) {
            expect(t.genre, tag).toBe(0);
            continue;
          }
          // A level can't dance a set at all (all of it jumps, on Easy): no genre time, and that's fine.
          if (![...open].some((g) => DANCE.some((m) => m.genre === g && levelFactor(m, lv) > 0))) continue;
          const share = t.genre / (t.genre + t.global);
          expect(share, tag).toBeGreaterThanOrEqual(GENRE_MIN - 0.02);
          expect(share, tag).toBeLessThanOrEqual(GENRE_MAX + 0.02);
        }
      }
    }
  });

  it('keeps variety at least where it was before the kit (distinct moves per minute), with a floor per routine', () => {
    // Medians of distinct base moves per minute across the published maps before the kit: 2.89 / 4.05 / 4.36.
    const before: Record<Intensity, number> = { chill: 2.89, cardio: 4.05, sweaty: 4.36 };
    const floor: Record<Intensity, number> = { chill: 1.4, cardio: 2.0, sweaty: 2.3 };
    for (const lv of LEVELS) {
      const per = routines(lv).map(({ s, r }) => {
        const bases = new Set(r.instances.filter((i) => !i.move.idle && !i.move.cooldown && !i.fill).map((i) => i.move.base));
        return bases.size / minutes(s.map);
      });
      expect(median(per), lv).toBeGreaterThanOrEqual(before[lv] * 0.95);
      expect(Math.min(...per), lv).toBeGreaterThanOrEqual(floor[lv]);
    }
  });

  it('never loops: no move bouncing with another A B A B A, no move holding most of a song', () => {
    for (const lv of LEVELS) {
      for (const { s, r } of routines(lv)) {
        const cs = cards(r).filter((c) => !c.first.move.cooldown);
        let run = 0;
        for (let k = 2; k < cs.length; k++) {
          const alt = cs[k].base === cs[k - 2].base && cs[k].base !== cs[k - 1].base && cs[k].base !== 'SIG' && cs[k - 1].base !== 'SIG';
          run = alt ? run + 1 : 0;
          expect(run + 2, `${s.id} ${lv} @${cs[k].first.start}`).toBeLessThan(5);
        }
        const by = new Map<string, number>();
        let tot = 0;
        for (const c of cs) if (c.base !== 'SIG') (by.set(c.base, (by.get(c.base) ?? 0) + c.beats), (tot += c.beats));
        expect(Math.max(...by.values()) / tot, `${s.id} ${lv}`).toBeLessThan(0.65);
      }
    }
  });

  it('flows better than before: smaller pose jumps between consecutive moves', () => {
    // Mean transition cost (end pose -> next start pose) before the kit: 1.62 / 1.94 / 1.98.
    const before: Record<Intensity, number> = { chill: 1.62, cardio: 1.94, sweaty: 1.98 };
    for (const lv of LEVELS) {
      const costs: number[] = [];
      for (const { r } of routines(lv)) {
        const cs = cards(r);
        for (let k = 1; k < cs.length; k++) {
          const a = cs[k - 1].last, b = cs[k].first;
          if (a.move.cooldown || b.move.cooldown) continue;
          const ak = keysOf(a.move, a.mirror);
          costs.push(poseStepCost(ak[ak.length - 1].pose, keysOf(b.move, b.mirror)[0].pose));
        }
      }
      expect(mean(costs), lv).toBeLessThan(before[lv] * 0.97);
    }
  });

  it('casts different songs differently: low kit overlap between songs of the same style and tempo', () => {
    const top = (st: SongStyle) => Object.entries(st.families).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0];
    for (const lv of LEVELS) {
      const kits = routines(lv).filter(({ s }) => s.starter).map(({ s, r }) => ({ s, k: new Set(r.instances.filter((i) => !i.move.idle && !i.move.cooldown && !i.sig && i.section !== 'outro').map((i) => i.move.base)) }));
      const jac: number[] = [];
      for (let a = 0; a < kits.length; a++) {
        for (let b = a + 1; b < kits.length; b++) {
          const A = kits[a], B = kits[b];
          if (top(A.s.style) !== top(B.s.style) || Math.abs(A.s.map.bpm - B.s.map.bpm) > 12) continue;
          let inter = 0;
          for (const x of A.k) if (B.k.has(x)) inter++;
          jac.push(inter / (A.k.size + B.k.size - inter));
        }
      }
      expect(jac.length, lv).toBeGreaterThan(100);
      expect(mean(jac), lv).toBeLessThan(0.1);
      expect([...jac].sort((x, y) => x - y)[Math.floor(jac.length * 0.9)], lv).toBeLessThan(0.25);
    }
  });
});

describe('choreographic structure', () => {
  /** Two verses and three choruses with steady, flat readings (so only the structure decides). */
  const PLAN: [SectionType, number, number][] = [['intro', 4, 0.3], ['verse', 16, 0.6], ['chorus', 16, 0.8], ['verse', 16, 0.6], ['chorus', 16, 0.8], ['verse', 8, 0.6], ['chorus', 16, 0.8], ['outro', 8, 0.25]];
  const steady = (map: BeatMap): BeatMap => ({ ...map, bars: { energy: map.downbeats.map(() => '6').join(''), bass: map.downbeats.map(() => '6').join(''), change: map.downbeats.map(() => '2').join(''), drops: [] } });
  /** Base moves of each section run, in order (combo and warm-up aside). */
  const runs = (r: Routine, type: SectionType): string[][] => {
    const out: string[][] = [];
    let prev: MoveInstance | null = null;
    for (const i of r.instances) {
      if (i.section !== type) {
        prev = null;
        continue;
      }
      if (!prev) out.push([]);
      const cur = out[out.length - 1];
      if (!i.sig && !i.fill && cur[cur.length - 1] !== i.move.base && !(prev && prev.move.base === i.move.base)) cur.push(i.move.base);
      prev = i;
    }
    return out;
  };

  it('the chorus hook is the same phrase every chorus (later choruses may intensify it with a variation)', () => {
    let same = 0, n = 0;
    for (const lv of ['cardio', 'sweaty'] as const) {
      for (const id of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        const r = generateRoutine(steady(songMap(120, id, PLAN)), lv);
        const ch = runs(r, 'chorus');
        expect(ch.length).toBe(3);
        for (const later of ch.slice(1)) {
          const k = Math.min(2, ch[0].length, later.length);
          n++;
          if (ch[0].slice(0, k).join() === later.slice(0, k).join()) same++;
        }
      }
    }
    expect(same / n).toBeGreaterThanOrEqual(0.8);
  });

  it('verses share a motif that develops: a later verse is the first one with a swap or two', () => {
    for (const lv of ['cardio', 'sweaty'] as const) {
      for (const id of ['m1', 'm2', 'm3', 'm4']) {
        const r = generateRoutine(steady(songMap(120, id, PLAN)), lv);
        const vs = runs(r, 'verse');
        const first = new Set(vs[0]);
        // The motif's moves come back (A B C A ..., and in the next verse) ...
        const both = [...vs[0], ...vs[1]];
        expect(both.length, `${lv} ${id}`).toBeGreaterThan(new Set(both).size);
        // ... and verse 2 mostly reuses verse 1's moves.
        const shared = vs[1].filter((b) => first.has(b)).length;
        expect(shared / vs[1].length, `${lv} ${id}: ${vs[0]} / ${vs[1]}`).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it('a rock song carries its verses and hook with global moves; the rock moves are accents', () => {
    const style = resolveSongStyle({ videoId: 'rock-kit', title: 'Numb', artist: 'Linkin Park' });
    expect(styleGenres(style).has('rock')).toBe(true);
    for (const lv of ['cardio', 'sweaty'] as const) {
      for (const id of ['r1', 'r2', 'r3', 'r4']) {
        const r = generateRoutine(steady(songMap(128, id, PLAN)), lv, { style });
        const t = tierBeats(r, style);
        const share = t.genre / (t.genre + t.global);
        expect(share).toBeGreaterThanOrEqual(GENRE_MIN - 0.02);
        expect(share).toBeLessThanOrEqual(GENRE_MAX + 0.02);
        // The verse motif's main move and the hook's first move are global.
        for (const type of ['verse', 'chorus'] as const) {
          for (const run of runs(r, type)) {
            const first = r.instances.find((i) => i.move.base === run[0] && i.section === type && !i.sig)!;
            if (type === 'verse' && first.start < 64) continue; // the warm-up
            expect(first.move.genre, `${lv} ${id} ${type} ${first.move.id}`).toBeUndefined();
          }
        }
      }
    }
  });

  it('"new every time" casts a different kit; the chorus combo stays', () => {
    for (const lv of LEVELS) {
      const map = songMap(124, 'fresh-kit');
      const a = generateRoutine(map, lv);
      const b = generateRoutine(map, lv, { fresh: 4 });
      const ka = new Set(a.instances.filter((i) => !i.sig && !i.move.cooldown).map((i) => i.move.base));
      const kb = new Set(b.instances.filter((i) => !i.sig && !i.move.cooldown).map((i) => i.move.base));
      let inter = 0;
      for (const x of ka) if (kb.has(x)) inter++;
      expect(inter / (ka.size + kb.size - inter), lv).toBeLessThan(0.5);
      expect(b.signature.map((s) => s.move.id)).toEqual(a.signature.map((s) => s.move.id));
    }
  });
});
