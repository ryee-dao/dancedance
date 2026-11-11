import { describe, expect, it } from 'vitest';
import type { BeatMap, SectionType } from '../analysis/beatmap';
import { generateDuoRoutine } from './duo';
import { generateRoutine, moveVigour, vigourTilt, type Intensity, type MoveInstance, type Routine } from './generator';
import { songMap } from './testutil';

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

/** A map with per-bar readings: `at(bar)` gives [energy, bass, change] digits and whether a drop starts there. */
function withBars(map: BeatMap, at: (bar: number) => { e: number; b: number; c: number; drop?: boolean }): BeatMap {
  const n = map.downbeats.length;
  let energy = '';
  let bass = '';
  let change = '';
  const drops: number[] = [];
  for (let k = 0; k < n; k++) {
    const r = at(k);
    energy += r.e;
    bass += r.b;
    change += r.c;
    if (r.drop) drops.push(k);
  }
  return { ...map, bars: { energy, bass, change, drops } };
}

function covered(r: Routine): void {
  let b = 0;
  for (const i of r.instances) {
    expect(i.start).toBe(b);
    b += i.span;
  }
  expect(b).toBe(r.beats);
}

/** Runs of the same base move (variations / ornaments count as the same; the combo is one run; fills skipped). */
function holds(r: Routine): { start: number; beats: number; inst: MoveInstance }[] {
  const out: { start: number; beats: number; inst: MoveInstance; key: string }[] = [];
  for (const i of r.instances) {
    if (i.fill) continue;
    const key = i.sig ? 'SIG' : i.move.base;
    const last = out[out.length - 1];
    if (last && last.key === key && last.start + last.beats === i.start) last.beats += i.span;
    else out.push({ start: i.start, beats: i.span, inst: i, key });
  }
  return out;
}

const meanHoldBars = (rs: Routine[]) => {
  let s = 0;
  let n = 0;
  for (const r of rs) for (const h of holds(r)) if (!h.inst.sig && !h.inst.move.cooldown && h.inst.section === 'verse') (s += h.beats / 4), n++;
  return s / n;
};

/** One long verse between a short intro and outro, so section type doesn't vary. */
const LONG_VERSE: [SectionType, number, number][] = [['intro', 8, 0.3], ['verse', 64, 0.6], ['outro', 8, 0.25]];

describe('music-driven phrasing', () => {
  it('covers every beat, deterministically, with bar readings; duo too', () => {
    for (const lv of LEVELS) {
      for (const bpm of [96, 124, 170]) {
        const m = withBars(songMap(bpm, `cov${bpm}`), (k) => ({ e: (k * 7) % 10, b: (k * 3) % 10, c: (k * 5) % 10, drop: k % 24 === 12 }));
        const r = generateRoutine(m, lv);
        covered(r);
        const key = (x: Routine) => x.instances.map((i) => `${i.move.id}@${i.start}`).join();
        expect(key(generateRoutine(m, lv))).toBe(key(r));
        const duo = generateDuoRoutine(m, lv);
        expect(duo.p1.reduce((t, i) => t + i.span, 0)).toBe(r.beats);
        expect(duo.p2.reduce((t, i) => t + i.span, 0)).toBe(r.beats);
      }
    }
  });

  it('keeps Easy low-impact however loud and bassy the bars are', () => {
    for (const id of IDS) {
      const m = withBars(songMap(128, id), (k) => ({ e: 9, b: 9, c: 1, drop: k % 16 === 8 }));
      for (const i of generateRoutine(m, 'chill').instances) {
        expect(i.move.jump, i.move.id).toBe(false);
        expect(i.move.fastTurn, i.move.id).toBe(false);
        // Squats / stomps stay rare (impact weight); jumps never.
        if (!i.move.cooldown && !i.move.idle) expect(i.move.level, i.move.id).not.toBe('high');
      }
    }
  });

  it('changes moves only on phrase boundaries (every unit of the section grid)', () => {
    for (const lv of LEVELS) {
      for (const id of IDS) {
        const map = withBars(songMap(122, id), (k) => ({ e: 2 + ((k >> 3) % 2) * 6, b: 5, c: (k * 3) % 10 }));
        const r = generateRoutine(map, lv);
        const db = new Set(map.downbeats);
        const unitBeats = lv === 'chill' ? 16 : 8;
        // Section starts (beat index) from the plan.
        const secStarts = map.sections.map((s) => map.beats.findIndex((t) => t >= s.start - 1e-6));
        for (const h of holds(r)) {
          if (h.start === 0) continue;
          expect(db.has(h.start), `${lv} ${id} change at beat ${h.start} is not on a downbeat`).toBe(true);
          const sec = Math.max(...secStarts.filter((s) => s <= h.start));
          expect((h.start - sec) % unitBeats, `${lv} ${id} change at beat ${h.start} (section from ${sec})`).toBe(0);
        }
      }
    }
  });

  it('never changes faster than a unit outside the combo and gap fills', () => {
    for (const lv of LEVELS) {
      for (const id of IDS) {
        const map = withBars(songMap(122, id), (k) => ({ e: (k * 7) % 10, b: (k * 3) % 10, c: 9 }));
        const r = generateRoutine(map, lv);
        const hs = holds(r);
        for (let k = 1; k + 1 < hs.length; k++) {
          const h = hs[k];
          if (h.inst.sig || h.inst.move.cooldown) continue;
          expect(h.beats, `${lv} ${id} @${h.start} ${h.inst.move.id}`).toBeGreaterThanOrEqual(lv === 'chill' ? 16 : 8);
        }
      }
    }
  });

  it('gives loud, bassy bars more vigorous moves on average, and soft bars gentler ones', () => {
    for (const lv of LEVELS) {
      let loud = 0, nl = 0, soft = 0, ns = 0;
      for (const id of IDS) {
        // 8-bar blocks alternating soft (energy 1, bass 1) and heavy (9, 9), all in one verse.
        const map = withBars(songMap(124, id, LONG_VERSE), (k) => ((k >> 3) % 2 ? { e: 9, b: 9, c: 2 } : { e: 1, b: 1, c: 2 }));
        const r = generateRoutine(map, lv);
        for (const i of r.instances) {
          if (i.sig || i.fill || i.section !== 'verse' || i.move.cooldown) continue;
          const bar = map.downbeats.filter((d) => d <= i.start).length - 1;
          const v = moveVigour(i.move) * i.span;
          if ((bar >> 3) % 2) (loud += v), (nl += i.span);
          else (soft += v), (ns += i.span);
        }
      }
      const dl = loud / nl;
      const ds = soft / ns;
      expect(dl, `${lv}: heavy ${dl.toFixed(2)} vs soft ${ds.toFixed(2)}`).toBeGreaterThan(ds + (lv === 'chill' ? 0.03 : 0.12));
    }
  });

  it('holds moves longer in a steady groove than in one that keeps changing (weighted, both ways)', () => {
    for (const lv of ['cardio', 'sweaty'] as const) {
      const steady = IDS.map((id) => generateRoutine(withBars(songMap(124, id, LONG_VERSE), () => ({ e: 7, b: 7, c: 1 })), lv));
      const busy = IDS.map((id) => generateRoutine(withBars(songMap(124, id, LONG_VERSE), () => ({ e: 7, b: 7, c: 8 })), lv));
      const s = meanHoldBars(steady);
      const b = meanHoldBars(busy);
      expect(s, `${lv}: steady ${s.toFixed(2)} vs busy ${b.toFixed(2)} bars`).toBeGreaterThan(b * 1.4);
      // Not rigid: a steady groove still has some shorter holds, a busy one some longer.
      const lens = (rs: Routine[]) => rs.flatMap((r) => holds(r).filter((h) => !h.inst.sig && h.inst.section === 'verse').map((h) => h.beats / 4));
      expect(lens(steady).some((x) => x <= 4)).toBe(true);
      expect(lens(busy).some((x) => x >= 4)).toBe(true);
      expect(Math.max(...lens(steady))).toBeLessThanOrEqual(8);
    }
  });

  it('starts a new hold on a drop, and holds it', () => {
    for (const lv of ['cardio', 'sweaty'] as const) {
      let total = 0;
      for (const id of IDS) {
        // Quiet verse bars, then a drop 12 bars into the long verse: loud, bassy and steady.
        const dropBar = 8 + 12;
        const map = withBars(songMap(124, id, LONG_VERSE), (k) => (k < dropBar ? { e: 2, b: 1, c: 3 } : { e: 9, b: 9, c: 1, drop: k === dropBar }));
        const r = generateRoutine(map, lv);
        const at = map.downbeats[dropBar];
        const h = holds(r).find((x) => x.start === at);
        expect(h, `${lv} ${id}: a hold starts on the drop`).toBeDefined();
        total += h!.beats / 4;
      }
      expect(total / IDS.length, lv).toBeGreaterThanOrEqual(4);
    }
  });

  it('builds each section type from a small palette of recurring moves', () => {
    for (const lv of LEVELS) {
      for (const id of IDS) {
        const r = generateRoutine(songMap(120, id), lv);
        const verse = new Map<string, number>();
        for (const h of holds(r)) if (h.inst.section === 'verse' && !h.inst.sig) verse.set(h.inst.move.base, (verse.get(h.inst.move.base) ?? 0) + 1);
        const holdsN = [...verse.values()].reduce((a, b) => a + b, 0);
        // Two 16-bar verses: fewer distinct moves than holds (moves come back).
        expect(verse.size, `${lv} ${id}`).toBeLessThan(holdsN);
        expect([...verse.values()].some((n) => n >= 2), `${lv} ${id}`).toBe(true);
      }
    }
  });

  it('ignores bar readings that do not line up with the downbeats (falls back to section energy)', () => {
    const plain = songMap(120, 'fallback');
    const bad = withBars(plain, () => ({ e: 9, b: 9, c: 9 }));
    bad.bars!.energy = bad.bars!.energy.slice(1);
    const key = (x: Routine) => x.instances.map((i) => `${i.move.id}@${i.start}`).join();
    for (const lv of LEVELS) expect(key(generateRoutine(bad, lv))).toBe(key(generateRoutine(plain, lv)));
  });

  it('plays the pickup before the first bar as one move (no NOW-card flicker at the start)', () => {
    for (const lead of [1, 2, 3]) {
      const m = songMap(120, `pickup${lead}`);
      m.downbeats = m.downbeats.map((d) => d + lead).filter((d) => d < m.beats.length);
      for (const lv of LEVELS) {
        const r = generateRoutine(m, lv);
        covered(r);
        const pick = r.instances.filter((i) => i.start < lead);
        expect(new Set(pick.map((i) => i.move.id)).size, `${lead} ${lv}`).toBe(1);
        for (const i of pick) expect(i.move.idle).toBe(false);
      }
    }
  });

  it('vigour: a neutral target changes nothing; heavy targets favour vigorous moves', () => {
    const gentle = generateRoutine(songMap(120, 'v'), 'cardio').instances.map((i) => i.move).sort((a, b) => moveVigour(a) - moveVigour(b));
    const lo = gentle[0];
    const hi = gentle[gentle.length - 1];
    expect(vigourTilt(lo, 0.5)).toBeCloseTo(1);
    expect(vigourTilt(hi, 0.5)).toBeCloseTo(1);
    expect(vigourTilt(hi, 1) / vigourTilt(lo, 1)).toBeGreaterThan(2);
    expect(vigourTilt(lo, 0) / vigourTilt(hi, 0)).toBeGreaterThan(2);
  });
});
