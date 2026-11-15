import { describe, expect, it } from 'vitest';
import { ARM, hand, type PoseSpec } from '../coach/poses';
import { buildFull, type Move } from './catalog';
import { REF_BPM, coordinationLoad, moveCoordination } from './coordination';
import { generateDuoRoutine } from './duo';
import { generateRoutine, mapTempo, type Intensity, type MoveInstance, type Routine } from './generator';
import { publishedSongs } from './published.testutil';
import { findMove } from './moves';
import { COORD_LOAD, LEVEL_SPEED, MIN_HALF_BPM, coordinationLimit, dancedTempoMode, moveTempoMode, readsAtHalf, speedLimit } from './speed';
import { songMap } from './testutil';

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];

/** A hand-built 2-beat move: four keys a half beat apart. */
function move(id: string, keys: PoseSpec[], jump = false): Move {
  return buildFull({ kind: 'full', id, name: id, tags: 'pop | full', level: 'mid', d: 1, beats: 2, parts: ['legs', 'arms'], jump, keys: keys.map((k, i) => [i * 0.5, k] as const) }, 'test');
}
const OUT_R: [number, number, number] = [0.2, 0, 0];
const OUT_L: [number, number, number] = [-0.2, 0, 0];
const IN_R: [number, number, number] = [0.075, 0, 0];
const IN_L: [number, number, number] = [-0.075, 0, 0];
const UP_R: [number, number, number] = [0.075, 0.1, 0.02];
const UP_L: [number, number, number] = [-0.075, 0.1, 0.02];

// Feet only: a march in place, the arms hanging still.
const feet = move('t-feet', [{ rf: UP_R, lf: IN_L }, { rf: IN_R, lf: IN_L }, { rf: IN_R, lf: UP_L }, { rf: IN_R, lf: IN_L }]);
// Arms only: feet planted, both arms up and down.
const arms = move('t-arms', [{ r: ARM.up, l: ARM.up }, { r: ARM.rest, l: ARM.rest }, { r: ARM.up, l: ARM.up }, { r: ARM.rest, l: ARM.rest }]);
// Both: the march with the arms going up and down (on the foot rhythm).
const both = move('t-both', [{ rf: UP_R, lf: IN_L, r: ARM.up, l: ARM.up }, { rf: IN_R, lf: IN_L, r: ARM.rest, l: ARM.rest }, { rf: IN_R, lf: UP_L, r: ARM.up, l: ARM.up }, { rf: IN_R, lf: IN_L, r: ARM.rest, l: ARM.rest }]);
// Jump + arms: a jumping jack (feet out and in through the air) with the same arms.
const jack = move('t-jack', [{ y: -0.05, rf: OUT_R, lf: OUT_L, r: ARM.up, l: ARM.up }, { y: 0.07, r: ARM.rest, l: ARM.rest }, { y: -0.05, rf: IN_R, lf: IN_L, r: ARM.up, l: ARM.up }, { y: 0.07, r: ARM.rest, l: ARM.rest }], true);
// The same jumps under arms of their own: one arm up while the other comes down (as much arm travel, not mirrored).
const jackOwn = move('t-jack-own', [{ y: -0.05, rf: OUT_R, lf: OUT_L, r: ARM.up, l: ARM.rest }, { y: 0.07, r: ARM.rest, l: ARM.up }, { y: -0.05, rf: IN_R, lf: IN_L, r: ARM.up, l: ARM.rest }, { y: 0.07, r: ARM.rest, l: ARM.up }], true);

describe('coordination load (from the keyframes)', () => {
  it('lets the arms\' natural counter-swing of the steps add little, but not the same feet under arms pumped overhead', () => {
    // A march: the feet take turns; the arms swing low, one forward as the other goes back, with the steps.
    const FWD = hand(0.04, -0.24, 0.14), BACK = hand(0.04, -0.27, -0.1);
    const swing = move('t-swing', [{ rf: UP_R, lf: IN_L, r: FWD, l: BACK }, { rf: IN_R, lf: IN_L }, { rf: IN_R, lf: UP_L, r: BACK, l: FWD }, { rf: IN_R, lf: IN_L }]);
    const pump = move('t-pump', [{ rf: UP_R, lf: IN_L, r: ARM.up, l: ARM.rest }, { rf: IN_R, lf: IN_L }, { rf: IN_R, lf: UP_L, r: ARM.rest, l: ARM.up }, { rf: IN_R, lf: IN_L }]);
    expect(moveCoordination(swing).parts.gait).toBeGreaterThan(0.5);
    expect(moveCoordination(swing).perBeat).toBeLessThan(0.5 * moveCoordination(pump).perBeat);
    // The same swing over jumps (both feet together) is not a step's counter-swing.
    const hop = move('t-hop', [{ y: -0.05, r: FWD, l: BACK }, { y: 0.07 }, { y: -0.05, r: BACK, l: FWD }, { y: 0.07 }], true);
    expect(moveCoordination(hop).parts.gait).toBe(0);
  });

  it('ranks catalogue anchors as a dancer would: arms of their own over jumps above big mirrored arms; feet drills by their feet', () => {
    const c = (id: string) => moveCoordination(findMove(id)!).perBeat;
    expect(c('jumping-jack-punch')).toBeGreaterThan(c('jumping-jack'));
    expect(c('march')).toBeLessThan(0.5 * c('march-get-up'));
    expect(c('fast-feet')).toBeLessThan(c('jumping-jack'));
    expect(c('running-man-shuffle')).toBeLessThan(c('march-diagonal'));
  });

  it('is zero for feet alone or arms alone, and high only when both halves are busy', () => {
    const f = moveCoordination(feet), a = moveCoordination(arms), b = moveCoordination(both), j = moveCoordination(jack);
    expect(f.lower).toBeGreaterThan(0.5);
    expect(f.upper).toBeLessThan(0.05);
    expect(a.upper).toBeGreaterThan(0.5);
    expect(a.lower).toBeLessThan(0.05);
    expect(f.perBeat).toBeLessThan(0.15);
    expect(a.perBeat).toBeLessThan(0.15);
    expect(b.perBeat).toBeGreaterThan(5 * Math.max(f.perBeat, a.perBeat, 0.05));
    // Jumping under the same arms is more than stepping under them.
    expect(j.lower).toBeGreaterThan(b.lower + 0.5);
    expect(j.perBeat).toBeGreaterThan(b.perBeat);
    // Arms of their own (not mirror images) over the same jumps: more again.
    expect(moveCoordination(jackOwn).parts.asym).toBeGreaterThan(1);
    expect(j.parts.asym).toBeLessThan(0.05);
    expect(moveCoordination(jackOwn).perBeat).toBeGreaterThan(j.perBeat);
  });

  it('scales with the tempo the move is danced at (half time halves it); the limit per beat falls as the tempo rises', () => {
    expect(coordinationLoad(jack, 2 * REF_BPM)).toBeCloseTo(2 * coordinationLoad(jack, REF_BPM), 9);
    expect(coordinationLoad(jack, 140 / 2)).toBeCloseTo(coordinationLoad(jack, 140) / 2, 9);
    for (const lv of LEVELS) expect(coordinationLimit(lv, 150)).toBeLessThan(coordinationLimit(lv, 100));
    expect(COORD_LOAD.chill).toBeLessThan(COORD_LOAD.cardio);
    expect(COORD_LOAD.cardio).toBeLessThan(COORD_LOAD.sweaty);
  });

  it('decides the tempo mode: full within the load, half time when that passes, else out', () => {
    let seen = 0;
    for (const m of [both, jack, jackOwn]) {
      const c = moveCoordination(m).perBeat;
      for (const lv of LEVELS) {
        // The tempo at which the move reaches the level's load, where its speed limit doesn't bind first.
        const edge = (COORD_LOAD[lv] * REF_BPM) / c;
        if (edge + 1 >= speedLimit(m) * LEVEL_SPEED[lv]) continue;
        seen++;
        expect(dancedTempoMode(m, edge - 1, lv), `${m.id} ${lv}`).toBe('full');
        expect(dancedTempoMode(m, edge + 1, lv), `${m.id} ${lv}`).toBe((edge + 1) / 2 >= MIN_HALF_BPM && readsAtHalf(m, edge + 1) ? 'half' : 'out');
      }
    }
    expect(seen).toBeGreaterThanOrEqual(4);
    // The single-focus moves are never held back by it.
    for (const m of [feet, arms]) for (const lv of LEVELS) expect(dancedTempoMode(m, Math.min(150, speedLimit(m) * 0.8), lv), m.id).toBe('full');
  });
});

/** Every instance of a routine danced within its level's coordination load at the tempo it is danced at. */
function overLoad(tag: string, r: Routine, ins: readonly MoveInstance[], bpm: number, lv: Intensity, bad: string[]): number {
  let n = 0;
  for (const i of ins) {
    if (i.move.idle) continue;
    n++;
    const danced = i.half ? bpm / 2 : bpm;
    const load = coordinationLoad(i.move, danced);
    if (load > COORD_LOAD[lv] + 1e-6) bad.push(`${tag} ${lv} ${i.move.id} @${danced.toFixed(0)} load ${load.toFixed(2)} > ${COORD_LOAD[lv]}`);
  }
  void r;
  return n;
}

describe('the coordination limit holds on every routine', () => {
  it('no danced instance exceeds its level\'s coordination load, on every published map and a tempo sweep, both routine modes, single and duo', () => {
    const bad: string[] = [];
    let n = 0;
    const maps = [
      ...publishedSongs().map((s) => ({ tag: s.id, map: s.map, style: s.style })),
      ...[90, 110, 128, 150, 170].flatMap((bpm) => ['a', 'b', 'c'].map((id) => ({ tag: `sweep-${bpm}-${id}`, map: songMap(bpm, `coord-${bpm}-${id}`), style: undefined }))),
    ];
    for (const { tag, map, style } of maps) {
      for (const lv of LEVELS) {
        for (const fresh of [undefined, 3]) {
          const opts = { ...(style ? { style } : {}), ...(fresh ? { fresh } : {}) };
          const r = generateRoutine(map, lv, opts);
          // The tempo the routine is danced at: the counted one, or half / twice it (tempo feel), or its free-time grid.
          const bpm = r.freeTime && r.bpm ? r.bpm : mapTempo(map) * (r.feel ?? 1);
          n += overLoad(`${tag}${fresh ? ' fresh' : ''}`, r, r.instances, bpm, lv, bad);
          const duo = generateDuoRoutine(map, lv, opts);
          n += overLoad(`${tag}${fresh ? ' fresh' : ''} duo p1`, r, duo.p1, bpm, lv, bad);
          n += overLoad(`${tag}${fresh ? ' fresh' : ''} duo p2`, r, duo.p2, bpm, lv, bad);
        }
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
    expect(n).toBeGreaterThan(50000);
  });
});

describe('the coordination limit fixes only what is over it', () => {
  const key = (xs: readonly MoveInstance[]) => xs.map((i) => `${i.move.id}${i.mirror ? 'L' : 'R'}@${i.start}+${i.span}${i.half ? 'h' : ''}${i.sig ? 's' : ''}:${i.origin.toFixed(3)}`).join(' ');
  const sigKey = (r: Routine) => r.signature.map((x) => `${x.move.id}${x.mirror ? 'L' : 'R'}`).join(' ');

  it('leaves every routine with nothing over the limit exactly as it is (published songs, every level, both routine modes, solo and duo)', () => {
    const changed: string[] = [];
    let same = 0, over = 0;
    for (const s of publishedSongs()) {
      for (const lv of LEVELS) {
        for (const fresh of [undefined, 3]) {
          const opts = { style: s.style, ...(fresh ? { fresh } : {}) };
          const off = generateRoutine(s.map, lv, { ...opts, coordination: false });
          const duoOff = generateDuoRoutine(s.map, lv, { ...opts, coordination: false });
          const bpm = off.freeTime && off.bpm ? off.bpm : mapTempo(s.map) * (off.feel ?? 1);
          // Drawn without the limit: is anything danced over it (the combo too, as it would be danced)?
          const bad: string[] = [];
          overLoad('', off, off.instances, bpm, lv, bad);
          overLoad('', off, duoOff.p1, bpm, lv, bad);
          overLoad('', off, duoOff.p2, bpm, lv, bad);
          const sigHalf = off.signature.some((x) => moveTempoMode(x.move, bpm, lv) === 'half');
          for (const x of off.signature) if (coordinationLoad(x.move, sigHalf ? bpm / 2 : bpm) > COORD_LOAD[lv] + 1e-6) bad.push(x.move.id);
          if (bad.length) {
            over++;
            continue;
          }
          same++;
          const on = generateRoutine(s.map, lv, opts);
          const duoOn = generateDuoRoutine(s.map, lv, opts);
          if (key(on.instances) !== key(off.instances) || sigKey(on) !== sigKey(off)) changed.push(`${s.title} ${lv} ${fresh ?? 'same'}`);
          if (key(duoOn.p1) !== key(duoOff.p1) || key(duoOn.p2) !== key(duoOff.p2)) changed.push(`${s.title} ${lv} ${fresh ?? 'same'} duo`);
        }
      }
    }
    expect(changed).toEqual([]);
    expect(same).toBeGreaterThan(300);
    expect(over).toBeGreaterThan(0);
  });
});
