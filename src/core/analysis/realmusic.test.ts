/**
 * Regressions for weaknesses found on ~70 real pop / rock songs (the earlier
 * tests only used click tracks). No audio is checked in: every case is a
 * synthetic signal that reproduces the real failure with the previous
 * analyser (noted per test).
 */
import { describe, expect, it } from 'vitest';
import type { BeatMap, SectionType } from './beatmap';
import { analyzeOffline } from './offline';
import { FRAME_RATE } from './onset';
import { fMeasure, synthClickTrack, synthPattern, synthSong, type PatternEvent, type SongSection } from './synth.testutil';
import { estimateTempo } from './tempo';

const K = (at: number, gain = 1): PatternEvent => ({ at, kind: 'kick', gain });
const C = (at: number, gain = 1): PatternEvent => ({ at, kind: 'clap', gain });
const Sn = (at: number, gain = 1): PatternEvent => ({ at, kind: 'snare', gain });
const H = (at: number, gain = 0.5): PatternEvent => ({ at, kind: 'hat', gain });

describe('tempo: syncopated (tresillo / dotted) grooves are not read as their 2:3 relative', () => {
  // Thunder (Imagine Dragons, 168 BPM) came out at 111 and Shake It Off (160)
  // at 107.5: hits 1.5 beats apart put autocorrelation peaks at 1.5, 3, 5 and
  // 6.5 beats. Old analyser: 105.0 / 105.1 / 107.3 / 100.0 for these patterns.
  const cases: [string, number, PatternEvent[]][] = [
    ['kick-clap tresillo 168', 168, [K(0), C(1.5), K(3), C(4.5)]],
    ['kick tresillo + snare 168', 168, [K(0), K(1.5), K(3), K(4.5), Sn(6, 0.4)]],
    ['clap stabs 168', 168, [K(0), C(1.5), C(3), C(4.5), Sn(6, 0.5)]],
    ['tresillo 160', 160, [K(0), C(1.5), K(3), C(4.5), K(6, 0.5)]],
  ];
  for (const [name, bpm, events] of cases) {
    it(name, () => {
      // 8-beat cycle (one 4/4 bar of the half-time feel).
      const s = synthPattern({ bpm, bars: Math.round((40 * bpm) / 60 / 8), beatsPerBar: 8, events, snrDb: 25 });
      const m = analyzeOffline(s.pcm, s.sampleRate);
      const ok = [bpm, bpm / 2].some((b) => Math.abs(m.bpm / b - 1) < 0.01);
      console.log(`[tresillo] ${name}: ${m.bpm.toFixed(2)} BPM`);
      expect(ok).toBe(true);
      for (const wrong of [(bpm * 2) / 3, bpm / 3, (bpm * 4) / 3]) expect(Math.abs(m.bpm / wrong - 1)).toBeGreaterThan(0.03);
      if (Math.abs(m.bpm / bpm - 1) < 0.01) expect(fMeasure(m.beats, s.beats).f).toBeGreaterThanOrEqual(0.95);
    });
  }
});

describe('tempo: dance range', () => {
  /** Onset envelope with pulses every beat; every second pulse has strength `weak`. */
  function envelope(bpm: number, weak: number, seconds = 40): Float32Array {
    const n = Math.round(seconds * FRAME_RATE);
    const e = new Float32Array(n);
    const P = (60 * FRAME_RATE) / bpm;
    let seed = 7;
    for (let k = 0; ; k++) {
      const i = Math.round(10 + k * P);
      if (i >= n - 2) break;
      const a = k % 2 === 0 ? 1 : weak;
      e[i] += a;
      e[i + 1] += 0.4 * a;
      e[i - 1] += 0.2 * a;
    }
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      e[i] += 0.05 * (seed / 4294967296);
    }
    return e;
  }

  // Sweet but Psycho (133) and Faint (135) came out at 66.5 / 67.5: a strong
  // kick on 1 and 3 with weaker 2 and 4. Old analyser: 66.5, 67.5, 65.0, 70.0.
  for (const [bpm, weak] of [[133, 0.3], [135, 0.25], [130, 0.2], [140, 0.33]] as const) {
    it(`kick-heavy ${bpm} BPM (off-beats at ${weak}) is doubled into the dance range`, () => {
      const t = estimateTempo(envelope(bpm, weak), FRAME_RATE);
      expect(Math.abs(t.bpm / bpm - 1)).toBeLessThan(0.01);
    });
  }

  it('a genuinely slow pulse (nothing in between) is left alone', () => {
    expect(Math.abs(estimateTempo(envelope(64, 0), FRAME_RATE).bpm / 64 - 1)).toBeLessThan(0.01);
    expect(Math.abs(estimateTempo(envelope(133, 0), FRAME_RATE).bpm / 66.5 - 1)).toBeLessThan(0.01);
  });

  it('end to end: weak off-beat kicks at 135 BPM give 135 with beats re-tracked on every beat', () => {
    // Old analyser: 67.5 BPM (beats only on 1 and 3).
    const s = synthPattern({ bpm: 135, bars: 24, events: [K(0), K(2), K(1, 0.05), K(3, 0.05)], snrDb: 30 });
    const m = analyzeOffline(s.pcm, s.sampleRate);
    expect(Math.abs(m.bpm / 135 - 1)).toBeLessThan(0.01);
    expect(fMeasure(m.beats, s.beats).f).toBeGreaterThanOrEqual(0.95);
  });
});

/** Fraction of the time covered by `type`s in the map that lies inside the given spans, and vice versa. */
function overlap(m: BeatMap, spans: [number, number][], types: SectionType[]): { recall: number; precision: number } {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (let t = 0; t < m.duration; t += 0.25) {
    const s = m.sections.find((x) => t >= x.start && t < x.end);
    const lab = !!s && types.includes(s.type);
    const tr = spans.some(([a, b]) => t >= a && t < b);
    if (lab && tr) tp++;
    else if (lab) fp++;
    else if (tr) fn++;
  }
  return { recall: tp / Math.max(1, tp + fn), precision: tp / Math.max(1, tp + fp) };
}

function assertValidSections(m: BeatMap) {
  expect(m.sections[0].start).toBe(0);
  expect(m.sections[m.sections.length - 1].end).toBe(m.duration);
  const dbTimes = new Set(m.downbeats.map((i) => m.beats[i]));
  for (let i = 1; i < m.sections.length; i++) {
    expect(m.sections[i].start).toBe(m.sections[i - 1].end);
    expect(dbTimes.has(m.sections[i].start)).toBe(true);
  }
  for (const s of m.sections) {
    expect(s.energy).toBeGreaterThanOrEqual(0);
    expect(s.energy).toBeLessThanOrEqual(1);
  }
}

describe('sections on a "compressed master" (constant loudness)', () => {
  // Every bar has the same RMS; sections differ only in chords and drum
  // pattern. The old analyser returned one section for the whole song.
  const verseChords = [[57, 60, 64], [57, 60, 64], [53, 57, 60], [53, 57, 60]];
  const chorusChords = [[60, 64, 67], [55, 59, 62], [62, 66, 69], [55, 59, 62]];
  const bridgeChords = [[52, 55, 59], [52, 55, 59], [50, 53, 57], [50, 53, 57]];
  const verseDrums = [K(0), K(2), Sn(1), Sn(3), H(0), H(1), H(2), H(3)];
  const chorusDrums = [K(0), K(1), K(2), K(3), C(1), C(3), ...[0.5, 1.5, 2.5, 3.5].map((a) => H(a, 0.7))];
  const sparseDrums = [H(0), H(1), H(2), H(3), K(0, 0.6)];
  const bridgeDrums = [K(0), Sn(2), H(0), H(2)];
  const sec = (name: string, bars: number, chords: number[][], drums: PatternEvent[]): SongSection => ({ name, bars, chords, drums });
  const form = [
    sec('intro', 8, verseChords, sparseDrums),
    sec('verse', 16, verseChords, verseDrums),
    sec('chorus', 16, chorusChords, chorusDrums),
    sec('verse', 16, verseChords, verseDrums),
    sec('chorus', 16, chorusChords, chorusDrums),
    sec('bridge', 8, bridgeChords, bridgeDrums),
    sec('chorus', 16, chorusChords, chorusDrums),
    sec('outro', 8, verseChords, sparseDrums),
  ];

  for (const bpm of [100, 122]) {
    it(`finds the form, boundaries and the recurring chorus at ${bpm} BPM`, () => {
      const song = synthSong({ bpm, sections: form, snrDb: 30 });
      const m = analyzeOffline(song.pcm, song.sampleRate);
      console.log(`[compressed ${bpm}] ${m.sections.map((s) => `${s.start.toFixed(1)} ${s.type} ${s.energy}`).join(' | ')}`);
      assertValidSections(m);
      expect(m.sections.length).toBeGreaterThanOrEqual(5);
      expect(m.sections.length).toBeLessThanOrEqual(12);
      const choruses: [number, number][] = [];
      song.sectionNames.forEach((n, i) => n === 'chorus' && choruses.push([song.sectionTimes[i], song.sectionTimes[i + 1]]));
      const ov = overlap(m, choruses, ['chorus', 'drop']);
      expect(ov.recall).toBeGreaterThan(0.9);
      expect(ov.precision).toBeGreaterThan(0.9);
      // Every true chorus starts on a section boundary (within half a beat).
      const starts = m.sections.map((s) => s.start);
      for (const [a] of choruses) expect(Math.min(...starts.map((s) => Math.abs(s - a)))).toBeLessThan(30 / bpm);
      // Intro and outro are recognised as the sparse ends; the chorus is more intense than the verses.
      expect(m.sections[0].type).toBe('intro');
      expect(m.sections[m.sections.length - 1].type).toBe('outro');
      const meanE = (types: SectionType[]) => {
        const xs = m.sections.filter((s) => types.includes(s.type));
        return xs.reduce((a, s) => a + s.energy, 0) / xs.length;
      };
      expect(meanE(['chorus', 'drop'])).toBeGreaterThan(meanE(['verse']));
    });
  }

  it('labels are stable when the input is trimmed by 0.5 s or gets slight noise', () => {
    const song = synthSong({ bpm: 116, sections: form, snrDb: 30 });
    const a = analyzeOffline(song.pcm, song.sampleRate);
    const trimmed = analyzeOffline(song.pcm.slice(Math.round(0.5 * song.sampleRate)), song.sampleRate);
    const noisy = song.pcm.slice();
    let seed = 3;
    for (let i = 0; i < noisy.length; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      noisy[i] += 0.003 * (seed / 4294967296 - 0.5);
    }
    const b = analyzeOffline(noisy, song.sampleRate);
    const label = (m: BeatMap, t: number) => {
      const s = m.sections.find((x) => t >= x.start && t < x.end)?.type;
      return s === 'drop' ? 'chorus' : s;
    };
    let agreeT = 0;
    let agreeN = 0;
    let n = 0;
    for (let t = 1; t < a.duration - 1; t += 0.5, n++) {
      if (label(a, t) === label(trimmed, t - 0.5)) agreeT++;
      if (label(a, t) === label(b, t)) agreeN++;
    }
    expect(agreeT / n).toBeGreaterThan(0.95);
    expect(agreeN / n).toBeGreaterThan(0.95);
  });
});

describe('sections never collapse for long songs', () => {
  for (const [name, dur, o] of [
    ['uniform pop groove, 3 min', 180, { pattern: 'pop' as const }],
    ['uniform clicks with hats, 2 min', 120, { hihat: true, accent: true }],
    ['uniform clicks, 45 s', 45, {}],
  ] as const) {
    it(name, () => {
      const s = synthClickTrack({ bpm: 120, duration: dur, snrDb: 20, ...o });
      const m = analyzeOffline(s.pcm, s.sampleRate);
      assertValidSections(m);
      expect(m.sections.length).toBeGreaterThanOrEqual(2);
      const barS = 2;
      // Sections are whole phrases: at least 4 bars, and in full-length songs (apart from the ends) a multiple of 4 bars.
      for (let i = 0; i < m.sections.length; i++) {
        const bars = (m.sections[i].end - m.sections[i].start) / barS;
        expect(bars).toBeGreaterThan(3.9);
        if (dur >= 120 && i > 0 && i < m.sections.length - 1) expect(Math.abs(bars / 4 - Math.round(bars / 4))).toBeLessThan(0.05);
      }
      // No contrast to speak of: energies stay near the middle instead of being stretched to 0 / 1.
      for (const x of m.sections) expect(Math.abs(x.energy - 0.5)).toBeLessThan(0.25);
    });
  }
});
