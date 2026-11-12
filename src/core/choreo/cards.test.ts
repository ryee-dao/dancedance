import { describe, expect, it } from 'vitest';
import type { BeatMap, SectionType } from '../analysis/beatmap';
import { MIN_CARD_BEATS, MIN_CARD_SEC, beatSeconds, cardLongEnough, cardsOf, enforceCards, sameCard } from './cards';
import { duoOwner, generateDuoRoutine, type DuoRoutine } from './duo';
import { MAX_ROOT_SPEED, MAX_ROOT_SPEED_SEC, transitionSteps } from './flow';
import { LivePlanner, generateRoutine, type Intensity, type MoveInstance, type Routine } from './generator';
import { MOVES } from './moves';
import { publishedSongs } from './published.testutil';
import { resolveSongStyle } from './songStyle';
import { songMap } from './testutil';

/**
 * The hard rule: what the dancer sees as one move (a NOW card: the same
 * name, the combo as a whole) lasts at least a bar and MIN_CARD_SEC, on
 * every published map, level, routine mode, single and duo.
 */

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
/** Routine modes: "same every time" (no play number) and "new every time" (two play numbers). */
const MODES: (number | undefined)[] = [undefined, 1, 6];

/** Duo cards: a change of either player's card. */
function duoCards(d: DuoRoutine): [number, number][] {
  const cuts = new Set<number>([0]);
  for (const t of [d.p1, d.p2]) for (const c of cardsOf(t)) cuts.add(c.start);
  const s = [...cuts].sort((a, b) => a - b);
  return s.map((x, k) => [x, s[k + 1] ?? d.beats]);
}

function covered(ins: readonly MoveInstance[], beats: number): void {
  let b = 0;
  for (const i of ins) {
    expect(i.start).toBe(b);
    expect(i.span).toBeGreaterThan(0);
    b += i.span;
  }
  expect(b).toBe(beats);
}

function shortCards(r: Routine, times: readonly number[]): string[] {
  return cardsOf(r.instances).filter((c) => !cardLongEnough(times, c.start, c.end)).map((c) => `@${c.start} ${c.end - c.start}b ${r.instances[c.from].move.name}`);
}

describe('no move flashes by: every card lasts a bar and MIN_CARD_SEC (published maps)', () => {
  const songs = publishedSongs();

  it('has the published maps', () => {
    expect(songs.length).toBeGreaterThan(90);
  });

  it('single and duo, every level, both routine modes; roots never dash between moves', { timeout: 300_000 }, () => {
    const bad: string[] = [];
    const fast: string[] = [];
    let cards = 0;
    for (const s of songs) {
      for (const lv of LEVELS) {
        for (const fresh of MODES) {
          const tag = `${s.id} ${lv} ${fresh ?? 'same'}`;
          const d = generateDuoRoutine(s.map, lv, { style: s.style, fresh });
          const r = generateRoutine(s.map, lv, { style: s.style, fresh });
          covered(r.instances, r.beats);
          for (const x of shortCards(r, s.map.beats)) bad.push(`${tag} single ${x}`);
          for (const [a, b] of duoCards(d)) {
            cards++;
            if (!cardLongEnough(s.map.beats, a, b)) bad.push(`${tag} duo @${a} ${b - a}b`);
          }
          cards += cardsOf(r.instances).length;
          for (const [who, ins] of [['single', r.instances], ['p1', d.p1], ['p2', d.p2]] as const) {
            for (const st of transitionSteps(ins, s.map.beats, who === 'single' ? undefined : duoOwner)) {
              if (st.perBeat > MAX_ROOT_SPEED || st.perSec > MAX_ROOT_SPEED_SEC) fast.push(`${tag} ${who} @${st.from} ${st.perBeat.toFixed(2)}/beat ${st.perSec.toFixed(2)}/s ${st.a.move.id} -> ${st.b.move.id}`);
            }
          }
        }
      }
    }
    expect(cards).toBeGreaterThan(10_000);
    expect(bad.slice(0, 20)).toEqual([]);
    expect(fast.slice(0, 20)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Each source of short moves, one at a time

/** A map with per-bar readings: `at(bar)` gives [energy, bass, change] digits and whether a drop starts there. */
function withBars(map: BeatMap, at: (bar: number) => { e: number; b: number; c: number; drop?: boolean }): BeatMap {
  let energy = '', bass = '', change = '';
  const drops: number[] = [];
  map.downbeats.forEach((_, k) => {
    const r = at(k);
    energy += r.e;
    bass += r.b;
    change += r.c;
    if (r.drop) drops.push(k);
  });
  return { ...map, bars: { energy, bass, change, drops } };
}

function assertRule(map: BeatMap, label: string, opts: Parameters<typeof generateRoutine>[2] = {}): Routine {
  for (const lv of LEVELS) {
    const r = generateRoutine(map, lv, opts);
    covered(r.instances, r.beats);
    expect(shortCards(r, map.beats), `${label} ${lv}`).toEqual([]);
    const d = generateDuoRoutine(map, lv, opts);
    for (const [a, b] of duoCards(d)) expect(cardLongEnough(map.beats, a, b), `${label} duo ${lv} @${a}`).toBe(true);
  }
  return generateRoutine(map, 'sweaty', opts);
}

describe('sources of short moves', () => {
  it('odd bars (5- and 3-beat bars, missed downbeats): leftovers are part of the move around them', () => {
    for (const bpm of [96, 124, 170]) {
      const m = songMap(bpm, `odd${bpm}`);
      const db: number[] = [];
      for (let b = 0, k = 0; b < m.beats.length; k++) {
        db.push(b);
        b += k % 5 === 2 ? 5 : k % 7 === 4 ? 3 : 4;
      }
      m.downbeats = db;
      const r = assertRule(m, `odd ${bpm}`);
      expect(r.instances.filter((i) => i.fill)).toEqual([]);
      expect(r.instances.some((i) => i.move.part)).toBe(true);
    }
  });

  it('pickups of 1-3 beats before the first bar, also when the song opens on a chorus (the combo)', () => {
    for (const lead of [1, 2, 3]) {
      for (const plan of [undefined, [['chorus', 16, 0.8], ['verse', 16, 0.5], ['chorus', 16, 0.8]] as [SectionType, number, number][]]) {
        const m = songMap(124, `pick${lead}${plan ? 'c' : ''}`, plan);
        m.downbeats = m.downbeats.map((d) => d + lead).filter((d) => d < m.beats.length);
        const r = assertRule(m, `pickup ${lead}`);
        expect(sameCard(r.instances[0], r.instances.find((i) => i.start >= lead)!)).toBe(true);
      }
    }
  });

  it('the song combo is one card (named as one move) even where its 4-beat blocks are under 2 seconds', () => {
    const m = songMap(140, 'combo140');
    const r = assertRule(m, 'combo');
    const sig = cardsOf(r.instances).filter((c) => r.instances[c.from].sig);
    expect(sig.length).toBeGreaterThan(0);
    for (const c of sig) {
      const names = new Set(r.instances.slice(c.from, c.to).map((i) => i.move.name));
      expect(names.size).toBe(1);
      expect(c.end - c.start).toBeGreaterThanOrEqual(8);
      // Both of the combo's moves are danced inside the one card.
      expect(new Set(r.instances.slice(c.from, c.to).map((i) => i.move.base)).size).toBeGreaterThanOrEqual(Math.min(2, new Set(r.signature.map((x) => x.move.base)).size));
    }
  });

  it('a phrase-end flourish keeps the move\'s name (same card)', () => {
    let seen = 0;
    for (const id of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) {
      const r = generateRoutine(songMap(118, id), 'sweaty');
      r.instances.forEach((i, k) => {
        if (!/~(spin|hit4|clap4)$/.test(i.move.id)) return;
        seen++;
        expect(sameCard(i, r.instances[k - 1]), i.move.id).toBe(true);
      });
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('drops: a new card starts on the drop and lasts the minimum, even a bar before a section change', () => {
    // Drops one bar before the chorus and at the last bar of the song's sections.
    const m = withBars(songMap(128, 'drops'), (k) => ({ e: 5, b: 5, c: 3, drop: k === 23 || k === 39 || k === 55 }));
    const r = assertRule(m, 'drops');
    for (const k of [23, 39, 55]) {
      const at = m.downbeats[k];
      const c = cardsOf(r.instances).find((x) => x.start <= at && at < x.end)!;
      expect(c.end - c.start, `drop bar ${k}`).toBeGreaterThanOrEqual(MIN_CARD_BEATS);
    }
  });

  it('sections that end off the phrase grid (1-, 3-, 5- and 9-bar sections) and a ragged song end', () => {
    const plan: [SectionType, number, number][] = [['intro', 3, 0.3], ['verse', 9, 0.5], ['chorus', 5, 0.8], ['verse', 1, 0.5], ['chorus', 9, 0.85], ['drop', 3, 0.95], ['verse', 5, 0.6], ['outro', 3, 0.25]];
    for (const bpm of [88, 126, 166]) {
      const m = songMap(bpm, `ragged${bpm}`, plan);
      // Two stray beats after the last bar.
      m.beats.push(m.beats[m.beats.length - 1] + 60 / bpm, m.beats[m.beats.length - 1] + 120 / bpm);
      assertRule(m, `ragged ${bpm}`);
    }
  });

  it('fast songs (half time) and songs just under it: never under MIN_CARD_SEC', () => {
    for (const bpm of [134, 142, 149, 151, 178]) {
      const m = withBars(songMap(bpm, `fast${bpm}`), (k) => ({ e: (k * 7) % 10, b: (k * 3) % 10, c: (k * 5) % 10, drop: k % 13 === 6 }));
      const r = assertRule(m, `fast ${bpm}`);
      for (const c of cardsOf(r.instances)) expect(beatSeconds(m.beats, c.start, c.end)).toBeGreaterThanOrEqual(MIN_CARD_SEC - 1e-6);
    }
  });

  it('a mid-hold variation is a new card that obeys the minimum', () => {
    let switches = 0;
    for (const id of ['v1', 'v2', 'v3', 'v4']) {
      const m = withBars(songMap(122, id), () => ({ e: 8, b: 8, c: 0 }));
      const r = assertRule(m, `steady ${id}`);
      const cs = cardsOf(r.instances);
      for (let k = 1; k < cs.length; k++) {
        const a = r.instances[cs[k - 1].from].move, b = r.instances[cs[k].from].move;
        if (a.base === b.base && a.name !== b.name) {
          switches++;
          expect(cs[k].end - cs[k].start).toBeGreaterThanOrEqual(8);
        }
      }
    }
    expect(switches).toBeGreaterThan(0);
  });

  it('duo: call & response, canon, partner roles and the split combo each show one card per phrase', () => {
    const kinds = new Set<string>();
    for (const id of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']) {
      for (const lv of LEVELS) {
        const map = songMap(120, id);
        const d = generateDuoRoutine(map, lv, { style: resolveSongStyle({ title: 'Gangnam Style', artist: 'PSY' }) });
        for (const p of d.phrases) {
          if (!['call', 'canon', 'partner', 'trade', 'split'].includes(p.kind)) continue;
          kinds.add(p.kind);
          for (const t of [d.p1, d.p2]) {
            const names = new Set(t.filter((i) => i.start >= p.start && i.start < p.end).map((i) => i.move.name));
            expect(names.size, `${id} ${lv} ${p.kind} @${p.start}: ${[...names]}`).toBe(1);
          }
        }
        for (const [a, b] of duoCards(d)) expect(cardLongEnough(map.beats, a, b), `${id} ${lv} @${a}`).toBe(true);
      }
    }
    for (const k of ['call', 'partner', 'split']) expect(kinds.has(k), k).toBe(true);
  });

  it('live plans (no map yet) keep the minimum too', () => {
    for (const bpm of [96, 124, 140, 170]) {
      for (const lv of LEVELS) {
        const out: MoveInstance[] = [];
        new LivePlanner(`live${bpm}`, lv, bpm, 0, {}).extend(out, 600);
        const times = Array.from({ length: 1200 }, (_, k) => (k * 60) / bpm);
        const cs = cardsOf(out);
        // The last card may still be growing.
        for (const c of cs.slice(0, -1)) expect(cardLongEnough(times, c.start, c.end), `${bpm} ${lv} @${c.start} ${out[c.from].move.name}`).toBe(true);
      }
    }
  });

  it('enforceCards absorbs a short card into its neighbours, never adding one', () => {
    const m = MOVES.find((x) => !x.idle && !x.cooldown && x.beats === 2 && x.travel === 0 && x.mirror)!;
    const n = MOVES.find((x) => !x.idle && !x.cooldown && x.beats === 4 && x.travel === 0 && x !== m)!;
    const o = MOVES.find((x) => !x.idle && !x.cooldown && x.beats === 1 && x.travel === 0 && x !== m && x !== n)!;
    const base = { half: false, origin: 0, section: 'verse' as const, sig: false, unitStart: false, phrase: 0 };
    const ins: MoveInstance[] = [
      ...[0, 2, 4, 6].map((b, k) => ({ ...base, move: m, mirror: k % 2 === 1, start: b, span: 2 })),
      { ...base, move: o, mirror: false, start: 8, span: 1 },
      ...[9, 13].map((b) => ({ ...base, move: n, mirror: false, start: b, span: 4 })),
    ];
    const times = Array.from({ length: 18 }, (_, k) => k * 0.5);
    const out = enforceCards(ins, { times, bars: [0, 4, 9, 13], drops: new Set(), mult: 1 });
    covered(out, 17);
    expect(out.some((i) => i.move === o)).toBe(false);
    expect(cardsOf(out).length).toBe(2);
    for (const c of cardsOf(out)) expect(c.end - c.start).toBeGreaterThanOrEqual(MIN_CARD_BEATS);
  });
});
