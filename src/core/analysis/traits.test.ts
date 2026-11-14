/**
 * Song traits on synthetic signals with known character. The grid passed to
 * the traits is the signal's true beat grid (so a test checks the trait, not
 * the beat tracker); a few tests go end to end through analyzeOffline.
 */
import { describe, expect, it } from 'vitest';
import { parse, serialize } from './beatmap';
import { analyzeOffline, computeTraits, extractFeatures } from './offline';
import { synthMix, synthNoise, type MixOptions, type PatternEvent, type SynthResult } from './synth.testutil';
import { OPTIONAL_TRAIT_KEYS, TRAIT_KEYS, traitsFromFeatures, type SongTraits } from './traits';

const ALL_KEYS = [...TRAIT_KEYS, ...OPTIONAL_TRAIT_KEYS];

const K = (at: number, gain = 1): PatternEvent => ({ at, kind: 'kick', gain });
const S = (at: number, gain = 1): PatternEvent => ({ at, kind: 'snare', gain });
const C = (at: number, gain = 1): PatternEvent => ({ at, kind: 'clap', gain });
const H = (at: number, gain = 0.6): PatternEvent => ({ at, kind: 'hat', gain });
const every = (n: number, step: number, f: (at: number) => PatternEvent) => Array.from({ length: n }, (_, i) => f(i * step));

/** A sustained pad and a bass line: the midrange and low end are never empty, as in a real mix. */
const PAD = { chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], level: 0.05 };
const SUB = { notes: [33, 29, 36, 31], level: 0.25 };

function traitsOf(s: SynthResult, bpm: number): SongTraits {
  return traitsFromFeatures(extractFeatures(s.pcm, s.sampleRate), { beats: s.beats, downbeats: s.downbeats, bpm });
}

function mix(o: MixOptions): { s: SynthResult; t: SongTraits } {
  const s = synthMix(o);
  const t = traitsOf(s, o.bpm);
  console.log(`[traits] ${JSON.stringify(t)}`);
  return { s, t };
}

function expectValid(t: SongTraits) {
  expect(Object.keys(t).sort()).toEqual([...ALL_KEYS].sort());
  for (const k of ALL_KEYS) {
    const v = t[k]!;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
    expect(Math.round(v * 100) / 100).toBe(v);
  }
}

const PIANO: MixOptions = { bpm: 100, bars: 24, piano: { chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], every: 2, level: 0.12 } };
const ROCK: MixOptions = {
  bpm: 100,
  bars: 24,
  drums: [K(0), K(2), K(2.5), S(1), S(3), ...every(8, 0.5, (a) => H(a))],
  guitar: { roots: [40, 40, 36, 38] },
  sub: { notes: [28, 28, 24, 26], level: 0.2 },
};

describe('song traits: calm piano vs dense distorted rock at the same tempo', () => {
  const piano = mix(PIANO).t;
  const rock = mix(ROCK).t;

  it('are all 0..1 with 2 decimals', () => {
    expectValid(piano);
    expectValid(rock);
  });

  it('the sparse, soft piano is calm; the drums and distorted guitars are not', () => {
    expect(piano.calm).toBeGreaterThan(0.8);
    expect(rock.calm).toBeLessThan(0.4);
    // Drive is the hardest hit of each bar plus the onset density: the synthetic piano's bass
    // note enters from silence every bar, a hard low-end hit, but there are few onsets.
    expect(piano.drive).toBeLessThan(0.5);
    expect(rock.drive).toBeGreaterThan(piano.drive);
  });

  it('the distorted guitars sound hard, the piano soft', () => {
    expect(rock.intensity!).toBeGreaterThan(0.6);
    expect(piano.intensity!).toBeLessThan(0.1);
  });

  it('distortion reads as heavy, the piano not at all', () => {
    expect(rock.heavy).toBeGreaterThan(0.3);
    expect(piano.heavy).toBeLessThan(0.1);
  });

  it('hats and sub-bass only where they are', () => {
    expect(rock.hats).toBeGreaterThan(0.4);
    expect(piano.hats).toBeLessThan(0.1);
    expect(rock.bass).toBeGreaterThan(0.5);
    expect(piano.bass).toBeLessThan(0.2);
  });

  it('end to end (the analyser finds its own grid) the contrast holds', () => {
    const p = analyzeOffline(synthMix(PIANO).pcm, 22050).traits!;
    const r = analyzeOffline(synthMix(ROCK).pcm, 22050).traits!;
    expect(p.calm - r.calm).toBeGreaterThan(0.4);
    expect(r.heavy - p.heavy).toBeGreaterThan(0.3);
  });
});

describe('song traits: four-on-the-floor vs a half-time backbeat', () => {
  const four = mix({
    bpm: 128,
    bars: 32,
    drums: [K(0), K(1), K(2), K(3), C(1), C(3), ...every(4, 1, (a) => H(a + 0.5, 0.8))],
    pad: PAD,
    sub: SUB,
  }).t;
  // Trap-style at 140 counted: kick on 1 (and a syncopated one), the snare once per bar on 3, 16th hats.
  const half = mix({
    bpm: 140,
    bars: 32,
    drums: [K(0), K(1.75), S(2), ...every(16, 0.25, (a) => H(a, 0.5))],
    pad: PAD,
    sub: { notes: [33, 33, 31, 29], level: 0.5 },
  }).t;
  const back = mix({ bpm: 128, bars: 32, drums: [K(0), K(2), S(1), S(3), ...every(8, 0.5, (a) => H(a))], pad: PAD, sub: SUB }).t;

  it('a kick on every beat is four-on-the-floor; kick on 1 and 3 is not', () => {
    expect(four.fourFloor).toBeGreaterThan(0.6);
    expect(half.fourFloor).toBeLessThan(0.2);
    expect(back.fourFloor).toBeLessThan(0.2);
  });

  it('one snare per bar is half-time; snares on 2 and 4 are not', () => {
    expect(half.halfFeel).toBeGreaterThan(0.5);
    expect(four.halfFeel).toBeLessThan(0.2);
    expect(back.halfFeel).toBeLessThan(0.2);
  });

  it('16th hats are dense, off-beat 8th hats less so', () => {
    expect(half.hats).toBeGreaterThan(0.8);
    expect(four.hats).toBeLessThan(half.hats - 0.2);
  });
});

describe('song traits: straight vs swung 8ths', () => {
  const groove = (off: number) =>
    mix({ bpm: 110, bars: 24, drums: [K(0), K(2), S(1), S(3), ...every(4, 1, (a) => H(a)), ...every(4, 1, (a) => H(a + off))], pad: PAD, sub: SUB }).t;
  const straight = groove(0.5);
  const swung = groove(2 / 3);
  const light = groove(0.6);

  it('reads swing from where the off-beat 8th lands', () => {
    expect(straight.swing).toBeLessThan(0.15);
    expect(swung.swing).toBeGreaterThan(0.7);
    expect(light.swing).toBeGreaterThan(straight.swing);
    expect(light.swing).toBeLessThanOrEqual(swung.swing);
  });

  it('swung 8ths are not counted as syncopation', () => {
    expect(swung.syncop).toBeLessThan(0.2);
  });
});

describe('song traits: syncopation', () => {
  it('dembow (snares on the "a" of 1 and the "and" of 2) is syncopated; a straight rock beat is not', () => {
    const dembow = mix({ bpm: 95, bars: 24, drums: [K(0), K(1), K(2), K(3), S(0.75), S(1.5), S(2.75), S(3.5), ...every(8, 0.5, (a) => H(a, 0.4))], pad: PAD, sub: SUB }).t;
    const rock = mix({ bpm: 95, bars: 24, drums: [K(0), K(2), S(1), S(3), ...every(8, 0.5, (a) => H(a, 0.4))], pad: PAD, sub: SUB }).t;
    expect(dembow.syncop).toBeGreaterThan(0.6);
    expect(rock.syncop).toBeLessThan(0.3);
    expect(dembow.fourFloor).toBeGreaterThan(0.6); // dembow keeps a kick on every beat
  });
});

describe('song traits: bass and mode', () => {
  it('a sub-bass line raises bass', () => {
    // No kick: in a sparse synthetic mix a 50 Hz kick alone already fills the sub band.
    const drums = [S(1), S(3), ...every(8, 0.5, (a) => H(a))];
    const thin = mix({ bpm: 120, bars: 16, drums, pad: PAD }).t;
    const sub = mix({ bpm: 120, bars: 16, drums, pad: PAD, sub: { notes: [28, 28, 31, 26], level: 0.5 } }).t;
    expect(sub.bass).toBeGreaterThan(thin.bass + 0.3);
  });

  it('minor chords (i - iv - v) read more minor than major ones (I - IV - V)', () => {
    const minor = mix({ bpm: 100, bars: 24, piano: { chords: [[57, 60, 64], [50, 53, 57], [52, 55, 59], [57, 60, 64]], every: 4 } }).t;
    const major = mix({ bpm: 100, bars: 24, piano: { chords: [[60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]], every: 4 } }).t;
    expect(minor.minor).toBeGreaterThan(0.6);
    expect(major.minor).toBeLessThan(0.4);
  });
});

describe('song traits: robustness', () => {
  it('do not depend on the overall level (same signal at very different gains)', () => {
    const s = synthMix({ ...ROCK, bars: 16 });
    const ref = traitsOf(s, ROCK.bpm);
    for (const g of [0.02, 0.3, 2.5]) {
      const t = traitsOf({ ...s, pcm: s.pcm.map((x) => x * g) }, ROCK.bpm);
      for (const k of ALL_KEYS) expect(Math.abs(t[k]! - ref[k]!), `${k} at gain ${g}`).toBeLessThanOrEqual(0.02);
    }
    // End to end too (the beat grid itself is found again at each gain).
    const a = analyzeOffline(s.pcm, s.sampleRate).traits!;
    const b = analyzeOffline(s.pcm.map((x) => x * 0.05), s.sampleRate).traits!;
    for (const k of ALL_KEYS) expect(Math.abs(a[k]! - b[k]!), k).toBeLessThanOrEqual(0.05);
  });

  it('without a beat (noise) the grid traits are 0 and the rest stay in range', () => {
    const pcm = synthNoise(20, 0.1);
    const m = analyzeOffline(pcm, 22050);
    expectValid(m.traits!);
    expect(m.beats.length).toBe(0);
    for (const k of ['fourFloor', 'halfFeel', 'swing', 'syncop', 'halfTempo', 'doubleTempo'] as const) expect(m.traits![k]).toBe(0);
  });

  it('silence and very short input give defined traits', () => {
    expectValid(analyzeOffline(new Float32Array(22050 * 5), 22050).traits!);
    expectValid(computeTraits(new Float32Array(100), 22050, { beats: [], downbeats: [], bpm: 0 }));
  });
});

describe('computeTraits (fill-in for maps made before traits)', () => {
  it('matches what a fresh analysis stores, using only the map grid', () => {
    const s = synthMix({ bpm: 124, bars: 24, drums: [K(0), K(1), K(2), K(3), C(1), C(3), ...every(4, 1, (a) => H(a + 0.5))], pad: PAD, sub: SUB, sampleRate: 44100 });
    const map = analyzeOffline(s.pcm, s.sampleRate, { source: 'cloud' });
    const old = parse(serialize({ ...map, traits: undefined }));
    expect(old.traits).toBeUndefined();
    const t = computeTraits(s.pcm, s.sampleRate, old);
    for (const k of ALL_KEYS) expect(Math.abs(t[k]! - map.traits![k]!), k).toBeLessThanOrEqual(0.02);
  });

  it('maps heard through the microphone carry none; other sources do', () => {
    const s = synthMix({ bpm: 120, bars: 12, drums: [K(0), K(2), S(1), S(3)], pad: PAD });
    expect(analyzeOffline(s.pcm, s.sampleRate, { source: 'mic' }).traits).toBeUndefined();
    for (const source of ['device', 'file', 'tab', 'cloud'] as const) expect(analyzeOffline(s.pcm, s.sampleRate, { source }).traits).toBeDefined();
  });
});
