import { describe, expect, it } from 'vitest';
import { parse, serialize, validateBeatMap, type BeatMap } from './beatmap';
import { analyzeOffline } from './offline';
import { StreamingAnalyzer } from './streaming';
import { mulberry32 } from './synth.testutil';

/**
 * A little EDM-shaped track at 124 BPM:
 *   quiet verse (soft hats + claps + a pad, no bass)    8 bars
 *   build (snare roll getting denser and louder)        8 bars
 *   drop (four-on-the-floor kick + sub bass + hats)     16 bars
 *   varied break (a different drum bar every bar)       8 bars
 *   second drop                                          8 bars
 */
const BPM = 124;
const SR = 22050;
const P = 60 / BPM;
const LEAD = 0.25;
const PLAN: { name: string; bars: number }[] = [
  { name: 'verse', bars: 8 },
  { name: 'build', bars: 8 },
  { name: 'drop', bars: 16 },
  { name: 'varied', bars: 8 },
  { name: 'drop2', bars: 8 },
];

function synthEdm() {
  const total = PLAN.reduce((s, x) => s + x.bars, 0);
  const duration = LEAD + total * 4 * P + 0.5;
  const pcm = new Float32Array(Math.round(duration * SR));
  const rnd = mulberry32(5);
  const add = (t: number, len: number, f: (tt: number) => number) => {
    const i0 = Math.round(t * SR);
    const i1 = Math.min(pcm.length, i0 + Math.round(len * SR));
    for (let i = i0; i < i1; i++) pcm[i] += f((i - i0) / SR);
  };
  const kick = (t: number, g: number) => add(t, 0.25, (tt) => g * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-tt / 0.03)) * tt) * Math.exp(-tt / 0.09));
  const hat = (t: number, g: number) => add(t, 0.04, (tt) => g * (rnd() * 2 - 1) * Math.exp(-tt / 0.012));
  const snare = (t: number, g: number) => add(t, 0.15, (tt) => g * ((rnd() * 2 - 1) * 0.7 + 0.3 * Math.sin(2 * Math.PI * 190 * tt)) * Math.exp(-tt / 0.05));
  const tone = (t: number, len: number, hz: number, g: number) => add(t, len, (tt) => g * Math.sin(2 * Math.PI * hz * tt));
  const barStart: number[] = [];
  const sectionStartBar: Record<string, number> = {};
  let bar = 0;
  for (const sec of PLAN) {
    sectionStartBar[sec.name] = bar;
    for (let b = 0; b < sec.bars; b++, bar++) {
      const t0 = LEAD + bar * 4 * P;
      barStart.push(t0);
      if (sec.name === 'verse') {
        for (let k = 0; k < 8; k++) hat(t0 + (k * P) / 2, 0.06);
        snare(t0 + P, 0.08);
        snare(t0 + 3 * P, 0.08);
        tone(t0, 4 * P, 440, 0.02);
        tone(t0, 4 * P, 554, 0.015);
      } else if (sec.name === 'build') {
        const per = b < 4 ? 4 : b < 6 ? 8 : 16;
        const g = 0.04 + 0.015 * b;
        for (let k = 0; k < per; k++) snare(t0 + (k * 4 * P) / per, g);
        for (let k = 0; k < 8; k++) hat(t0 + (k * P) / 2, 0.08);
        tone(t0, 4 * P, 440, 0.03);
      } else if (sec.name === 'drop' || sec.name === 'drop2') {
        for (let k = 0; k < 4; k++) kick(t0 + k * P, 0.9);
        for (let k = 0; k < 8; k++) hat(t0 + (k * P) / 2 + P / 4, 0.12);
        snare(t0 + P, 0.25);
        snare(t0 + 3 * P, 0.25);
        tone(t0, 4 * P, 55, 0.35);
        tone(t0, 4 * P, 440, 0.04);
      } else {
        // A different bar every bar: kick / snare / hat placements and density change.
        const v = b % 4;
        const kicks = [[0, 2.5], [0, 1, 2, 3], [0, 0.75, 1.5], [0.5, 2, 3.5]][v];
        for (const k of kicks) kick(t0 + k * P, 0.5);
        const hats = [16, 3, 6, 12][v];
        for (let k = 0; k < hats; k++) hat(t0 + (k * 4 * P) / hats, 0.1);
        if (v % 2) snare(t0 + 2 * P, 0.25);
        else for (let k = 0; k < 3; k++) snare(t0 + (1 + k) * P * 1.25, 0.2);
        tone(t0, 4 * P, v < 2 ? 330 : 660, 0.04);
      }
    }
  }
  return { pcm, duration, barStart, sectionStartBar };
}

const SONG = synthEdm();

/** Map bar index (into downbeats) nearest to song bar `b`. */
function barIndexAt(map: BeatMap, b: number): number {
  const t = SONG.barStart[b];
  let best = 0;
  for (let k = 0; k < map.downbeats.length; k++) {
    if (Math.abs(map.beats[map.downbeats[k]] - t) < Math.abs(map.beats[map.downbeats[best]] - t)) best = k;
  }
  return best;
}

const digits = (s: string, a: number, b: number) => {
  const xs = [...s.slice(a, b)].map(Number);
  return xs.reduce((x, y) => x + y, 0) / xs.length;
};

describe('per-bar readings', () => {
  const map = analyzeOffline(SONG.pcm, SR, { videoId: 'edmTestVid1', source: 'device' });
  const at = (name: string, offset = 0) => barIndexAt(map, SONG.sectionStartBar[name] + offset);

  it('are present, one digit per downbeat, and survive serialisation', () => {
    expect(map.analyzerVersion).toBe('1.2.0');
    expect(map.bars).toBeDefined();
    const b = map.bars!;
    for (const s of [b.energy, b.bass, b.change]) {
      expect(s).toMatch(/^[0-9]+$/);
      expect(s.length).toBe(map.downbeats.length);
    }
    expect(parse(serialize(map))).toEqual(map);
  });

  it('read the quiet verse low, the bassy drop high and the build in between', () => {
    const b = map.bars!;
    const verse = [at('verse', 1), at('verse', 7)];
    const build = [at('build', 2), at('build', 7)];
    const drop = [at('drop', 1), at('drop', 15)];
    console.log(`[bars] energy ${b.energy}\n[bars] bass   ${b.bass}\n[bars] change ${b.change}\n[bars] drops  ${b.drops.join(',')}`);
    const e = (r: number[]) => digits(b.energy, r[0], r[1]);
    const bass = (r: number[]) => digits(b.bass, r[0], r[1]);
    expect(e(verse)).toBeLessThanOrEqual(3);
    expect(e(drop)).toBeGreaterThanOrEqual(6);
    // A snare-roll build reads energetic too, but has no bass yet: the drop
    // is the heaviest part once bass counts (the generator's target mixes both).
    expect(e(build)).toBeGreaterThan(e(verse) + 2);
    expect(bass(verse)).toBeLessThanOrEqual(3);
    expect(bass(build)).toBeLessThan(bass(drop) - 3);
    expect(bass(drop)).toBeGreaterThanOrEqual(8);
    const heavy = (r: number[]) => 0.6 * e(r) + 0.4 * bass(r);
    expect(heavy(drop)).toBeGreaterThan(heavy(build));
    expect(heavy(build)).toBeGreaterThan(heavy(verse));
  });

  it('find the drops where the build gives way to the bass, and none in the steady parts', () => {
    const drops = map.bars!.drops;
    const first = at('drop');
    expect(drops.some((k) => Math.abs(k - first) <= 1)).toBe(true);
    for (const k of drops) {
      // Never inside the quiet verse or the middle of the first drop.
      expect(k < at('verse', 8) - 1).toBe(false);
      expect(k > first + 1 && k < at('drop', 15)).toBe(false);
    }
  });

  it('read a repeating loop as steady and a bar-by-bar change of beat as restless', () => {
    const c = map.bars!.change;
    const steadyDrop = digits(c, at('drop', 2), at('drop', 15));
    const varied = digits(c, at('varied', 1), at('varied', 8));
    expect(steadyDrop).toBeLessThanOrEqual(3);
    expect(varied).toBeGreaterThan(steadyDrop + 2);
  });

  it('come out of the streaming analyser too (recorded features, same readings)', () => {
    const sa = new StreamingAnalyzer({ sampleRate: SR });
    for (let i = 0; i < SONG.pcm.length; i += 4096) sa.push(SONG.pcm.subarray(i, Math.min(SONG.pcm.length, i + 4096)));
    const live = sa.finalize('edmTestVid1', map.duration, 'tab');
    expect(live.bars).toBeDefined();
    expect(live.bars!.energy.length).toBe(live.downbeats.length);
    expect(live.bars).toEqual(map.bars);
  });

  it('are left out without a usable bar grid', () => {
    const silent = analyzeOffline(new Float32Array(SR * 10), SR);
    expect(silent.bars).toBeUndefined();
    expect(() => validateBeatMap(silent)).not.toThrow();
  });
});
