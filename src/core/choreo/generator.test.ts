import { describe, expect, it } from 'vitest';
import { LivePlanner, generateRoutine, type Intensity, type MoveInstance, type Routine } from './generator';
import { songMap } from './testutil';

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];

function covered(r: Routine): void {
  let b = 0;
  for (const i of r.instances) {
    expect(i.start).toBe(b);
    expect(i.span).toBeGreaterThan(0);
    b += i.span;
  }
  expect(b).toBe(r.beats);
}

function sigRuns(r: Routine): string[] {
  // Each maximal run of consecutive signature instances, as a string.
  const runs: string[] = [];
  let cur: MoveInstance[] = [];
  for (const i of r.instances) {
    if (i.sig) cur.push(i);
    else if (cur.length) {
      runs.push(cur.map((x) => `${x.move.id}${x.mirror ? 'L' : 'R'}`).join(' '));
      cur = [];
    }
  }
  if (cur.length) runs.push(cur.map((x) => `${x.move.id}${x.mirror ? 'L' : 'R'}`).join(' '));
  return runs;
}

const beatsOf = (r: Routine, f: (i: MoveInstance) => boolean) => r.instances.filter(f).reduce((t, i) => t + i.span, 0);

describe('generateRoutine', () => {
  const map = songMap(120);
  const downbeats = new Set(map.downbeats);

  it('covers every beat exactly once, for every level and tempo', () => {
    for (const bpm of [72, 100, 120, 128, 140, 165, 178]) {
      for (const lv of LEVELS) covered(generateRoutine(songMap(bpm, `v${bpm}`), lv));
    }
  });

  it('starts units (and every 4-beat move) on downbeats', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      for (const i of r.instances) {
        if (i.unitStart) expect(downbeats.has(i.start)).toBe(true);
        if (i.move.beats === 4 && !i.half) expect(downbeats.has(i.start)).toBe(true);
      }
    }
  });

  it('handles irregular bars, pickups and missing downbeats', () => {
    const m = songMap(124, 'odd');
    m.downbeats = m.downbeats.filter((_, k) => k % 7 !== 3).map((d) => d + 1);
    for (const lv of LEVELS) covered(generateRoutine(m, lv));
    const none = { ...songMap(124, 'nodb'), downbeats: [] };
    covered(generateRoutine(none, 'cardio'));
    const empty = { ...songMap(124, 'empty'), beats: [], downbeats: [] };
    expect(generateRoutine(empty, 'cardio').instances.length).toBe(0);
  });

  it('mixes intensity measurably; Easy never jumps', () => {
    const songs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => songMap(122, id));
    const frac = (lv: Intensity, f: (i: MoveInstance) => boolean) => {
      let hit = 0;
      let all = 0;
      for (const s of songs) {
        const r = generateRoutine(s, lv);
        hit += beatsOf(r, f);
        all += r.beats;
      }
      return hit / all;
    };
    const impact = LEVELS.map((lv) => frac(lv, (i) => i.move.impact));
    expect(impact[0]).toBeLessThan(impact[1]);
    expect(impact[1]).toBeLessThan(impact[2]);
    expect(frac('chill', (i) => i.move.jump)).toBe(0);
    expect(frac('sweaty', (i) => i.move.jump)).toBeGreaterThan(frac('cardio', (i) => i.move.jump));
  });

  it('drives difficulty and change rate by level', () => {
    const songs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => songMap(122, id));
    const stats = LEVELS.map((lv) => {
      let dSum = 0;
      let n = 0;
      let distinctPerMin = 0;
      let changesPerMin = 0;
      let maxD = 0;
      for (const s of songs) {
        const r = generateRoutine(s, lv);
        const mins = (s.beats[s.beats.length - 1] - s.beats[0]) / 60;
        const dance = r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
        for (const i of dance) {
          dSum += i.move.difficulty * i.span;
          n += i.span;
          maxD = Math.max(maxD, i.move.difficulty);
        }
        distinctPerMin += new Set(dance.map((i) => i.move.id)).size / mins;
        let ch = 0;
        for (let k = 1; k < dance.length; k++) if (dance[k].move !== dance[k - 1].move) ch++;
        changesPerMin += ch / mins;
      }
      return { meanD: dSum / n, distinct: distinctPerMin / songs.length, changes: changesPerMin / songs.length, maxD };
    });
    expect(stats[0].maxD).toBe(1);
    expect(stats[1].maxD).toBeLessThanOrEqual(2);
    expect(stats[2].maxD).toBe(3);
    expect(stats[0].meanD).toBeLessThan(stats[1].meanD);
    expect(stats[1].meanD).toBeLessThan(stats[2].meanD);
    expect(stats[0].distinct).toBeLessThan(stats[1].distinct);
    expect(stats[1].distinct).toBeLessThan(stats[2].distinct);
    expect(stats[0].changes).toBeLessThan(stats[2].changes);
  });

  it('Easy holds each move for at least 4 bars (outside fillers)', () => {
    const r = generateRoutine(map, 'chill');
    let runStart = 0;
    for (let k = 1; k <= r.instances.length; k++) {
      const prev = r.instances[k - 1];
      const cur = r.instances[k];
      if (!cur || cur.move !== prev.move || cur.sig !== prev.sig) {
        const len = prev.start + prev.span - r.instances[runStart].start;
        if (!prev.move.idle && !prev.sig) expect(len).toBeGreaterThanOrEqual(16);
        runStart = k;
      }
    }
  });

  it('opens every chorus/drop with the same signature combo', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      expect(r.signature.length).toBeGreaterThan(0);
      const sigBeats = r.signature.reduce((t, s) => t + s.move.beats, 0);
      expect(sigBeats).toBe(8);
      const one = r.signature.map((s) => `${s.move.id}${s.mirror ? 'L' : 'R'}`).join(' ');
      // Each peak section starts with the combo.
      for (const sec of map.sections.filter((s) => s.type === 'chorus' || s.type === 'drop')) {
        const startBeat = map.beats.findIndex((t) => t >= sec.start - 1e-6);
        const first = r.instances.findIndex((i) => i.start === startBeat);
        expect(first).toBeGreaterThanOrEqual(0);
        const seq = r.instances.slice(first, first + r.signature.length).map((x) => `${x.move.id}${x.mirror ? 'L' : 'R'}`).join(' ');
        expect(seq).toBe(one);
        expect(r.instances[first].sig).toBe(true);
      }
      // And the combo only ever appears as whole copies of the same sequence.
      for (const run of sigRuns(r)) expect(run.split(' ').length % r.signature.length).toBe(0);
      for (const run of sigRuns(r)) expect(run.startsWith(one)).toBe(true);
    }
  });

  it('cools down in the outro and warms up at the start', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      const outro = r.instances.filter((i) => i.section === 'outro' && !i.move.idle);
      expect(outro.length).toBeGreaterThan(0);
      // Stretches, or the calm flows of the cooldown file (low intensity).
      for (const i of outro) expect(i.move.cooldown || (i.move.file === 'cooldown' && i.move.level === 'low')).toBe(true);
      const firstBars = r.instances.filter((i) => i.start < 32);
      for (const i of firstBars) expect(i.move.level).not.toBe('high');
    }
    // A song without an outro still ends with a cooldown.
    const noOutro = songMap(118, 'no-outro', [['verse', 16, 0.5], ['chorus', 16, 0.8], ['verse', 8, 0.5]]);
    const r = generateRoutine(noOutro, 'cardio');
    const last = r.instances[r.instances.length - 1].move;
    expect(last.cooldown || last.idle || (last.file === 'cooldown' && last.level === 'low')).toBe(true);
  });

  it('is deterministic per (song, level) and differs between songs', () => {
    const key = (r: Routine) => r.instances.map((i) => `${i.move.id}${i.mirror ? 'L' : ''}@${i.start}`).join(',');
    for (const lv of LEVELS) {
      expect(key(generateRoutine(songMap(120, 'same'), lv))).toBe(key(generateRoutine(songMap(120, 'same'), lv)));
      expect(key(generateRoutine(songMap(120, 'one'), lv))).not.toBe(key(generateRoutine(songMap(120, 'two'), lv)));
    }
    expect(key(generateRoutine(songMap(120, 'same'), 'chill'))).not.toBe(key(generateRoutine(songMap(120, 'same'), 'sweaty')));
  });

  it('performs moves at half time above 150 BPM', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(songMap(170, 'fast'), lv);
      expect(r.half).toBe(true);
      for (const i of r.instances) {
        if (!i.move.idle) {
          expect(i.half).toBe(true);
          expect(i.span).toBe(i.move.beats * 2);
        }
      }
      const slow = generateRoutine(songMap(128, 'fast'), lv);
      expect(slow.half).toBe(false);
    }
  });

  it('never repeats the same move across a phrase boundary (Medium/Hard)', () => {
    for (const lv of ['cardio', 'sweaty'] as const) {
      const r = generateRoutine(map, lv);
      const dance = r.instances.filter((i) => !i.move.idle && !i.sig && !i.move.cooldown);
      for (let k = 1; k < dance.length; k++) {
        if (dance[k].phrase !== dance[k - 1].phrase) expect(dance[k].move).not.toBe(dance[k - 1].move);
      }
    }
  });

  it('returns travelling moves to centre at unit ends', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      for (let k = 0; k < r.instances.length; k++) {
        const i = r.instances[k];
        const next = r.instances[k + 1];
        const end = i.origin + i.move.travel * (i.mirror ? -1 : 1);
        if (!next || next.unitStart) expect(Math.abs(end)).toBeLessThan(1e-9);
        else expect(Math.abs(next.origin - end)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('LivePlanner', () => {
  it('extends phrase by phrase, contiguous, with periodic bigger phrases', () => {
    const out: MoveInstance[] = [];
    const lp = new LivePlanner('live-song', 'cardio', 124, 6);
    lp.extend(out, 20);
    expect(out[0].start).toBe(6);
    const n1 = out.length;
    expect(lp.end).toBeGreaterThanOrEqual(20);
    lp.extend(out, 400);
    expect(out.length).toBeGreaterThan(n1);
    let b = 6;
    for (const i of out) {
      expect(i.start).toBe(b);
      b += i.span;
    }
    expect(out.some((i) => i.sig)).toBe(true);
    expect(out.some((i) => i.section === 'chorus')).toBe(true);
    // Deterministic.
    const out2: MoveInstance[] = [];
    const lp2 = new LivePlanner('live-song', 'cardio', 124, 6);
    lp2.extend(out2, 400);
    expect(out2.map((i) => i.move.id)).toEqual(out.map((i) => i.move.id));
  });
});
