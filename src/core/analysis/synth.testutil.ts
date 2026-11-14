/**
 * Synthetic test audio (test-only helper): click tracks with known beat times.
 */

export interface SynthSection {
  /** Length in bars (4 beats each). */
  bars: number;
  /** Linear gain for this section. */
  gain: number;
  /** Add off-beat hi-hats and a sustained bass/pad layer (a "full" section). */
  full?: boolean;
}

export interface SynthOptions {
  bpm: number;
  /** Total length in seconds (ignored when `structure` is given: then it is derived). */
  duration?: number;
  sampleRate?: number;
  /** Louder, lower thump on beat 1 of each bar. */
  accent?: boolean;
  /** Off-beat (half-beat phase) hi-hats over the whole track. */
  hihat?: boolean;
  /** Hi-hat peak amplitude (default 0.35; thumps peak at ~0.6, accents ~1.0). */
  hihatLevel?: number;
  /** Additive white noise at this SNR (dB, relative to the signal's RMS over its non-silent part). */
  snrDb?: number;
  /** Seconds of digital silence before the first beat. */
  leadIn?: number;
  /** Gradual linear tempo drift: tempo goes from bpm*(1-drift) to bpm*(1+drift). */
  drift?: number;
  /** Loud/quiet section structure; overrides duration. */
  structure?: SynthSection[];
  /** 'clicks' (default): a thump on every beat. 'pop': kick on beats 1 and 3, snare on 2 and 4, hats on eighths. */
  pattern?: 'clicks' | 'pop';
  /** Colour of the additive noise (default white). */
  noiseColor?: 'white' | 'pink';
  /** Overall output gain (e.g. 0.05 to simulate a quiet microphone). */
  gain?: number;
  seed?: number;
}

export interface SynthResult {
  pcm: Float32Array;
  sampleRate: number;
  /** True beat (onset) times in seconds. */
  beats: number[];
  /** Indices into `beats` of bar starts (beat 1). */
  downbeats: number[];
  duration: number;
  /** Section boundaries (seconds) when `structure` is used: [0, b1, ..., duration]. */
  sectionTimes: number[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): () => number {
  return () => {
    const u = Math.max(1e-12, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

export function synthClickTrack(o: SynthOptions): SynthResult {
  const sr = o.sampleRate ?? 22050;
  const rand = mulberry32(o.seed ?? 12345);
  const gauss = gaussian(rand);
  const leadIn = o.leadIn ?? 0;
  const drift = o.drift ?? 0;
  const firstBeat = leadIn + 0.25;

  let duration: number;
  let sectionBeats: number[] | null = null; // beat index where each section starts
  if (o.structure) {
    // Approximate duration from bar counts (no drift with structure).
    const totalBeats = o.structure.reduce((s, x) => s + x.bars * 4, 0);
    duration = firstBeat + (totalBeats * 60) / o.bpm + 0.5;
    sectionBeats = [];
    let acc = 0;
    for (const s of o.structure) {
      sectionBeats.push(acc);
      acc += s.bars * 4;
    }
  } else {
    duration = o.duration ?? 30;
  }
  const n = Math.round(duration * sr);
  const pcm = new Float32Array(n);

  // Beat times with optional linear drift of the tempo over the track.
  const beats: number[] = [];
  let t = firstBeat;
  const span = Math.max(1e-6, duration - firstBeat);
  while (t < duration - 0.3) {
    beats.push(t);
    const frac = (t - firstBeat) / span;
    const bpmNow = o.bpm * (1 - drift + 2 * drift * frac);
    t += 60 / bpmNow;
  }
  if (sectionBeats) {
    const total = o.structure!.reduce((s, x) => s + x.bars * 4, 0);
    beats.length = Math.min(beats.length, total);
  }
  const downbeats: number[] = [];
  for (let i = 0; i < beats.length; i += 4) downbeats.push(i);

  const sectionOf = (beatIdx: number): SynthSection | null => {
    if (!o.structure || !sectionBeats) return null;
    let s = 0;
    for (let k = 0; k < sectionBeats.length; k++) if (beatIdx >= sectionBeats[k]) s = k;
    return o.structure[s];
  };

  const addThump = (at: number, amp: number, f0: number) => {
    const start = Math.round(at * sr);
    const len = Math.round(0.25 * sr);
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const tt = i / sr;
      const f = f0 + 90 * Math.exp(-tt / 0.02); // pitch drop
      phase += (2 * Math.PI * f) / sr;
      const env = Math.exp(-tt / 0.07) * Math.min(1, i / 16);
      let v = Math.sin(phase) * env;
      if (i < 0.004 * sr) v += 0.3 * gauss() * (1 - i / (0.004 * sr)); // click transient
      pcm[start + i] += amp * v;
    }
  };
  const addHat = (at: number, amp: number) => {
    const start = Math.round(at * sr);
    const len = Math.round(0.05 * sr);
    let prev = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const w = gauss();
      const hp = w - prev; // crude high-pass
      prev = w;
      pcm[start + i] += amp * 0.5 * hp * Math.exp(-(i / sr) / 0.012);
    }
  };

  const addSnare = (at: number, amp: number) => {
    const start = Math.round(at * sr);
    const len = Math.round(0.15 * sr);
    let lp = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const tt = i / sr;
      const w = gauss();
      lp += 0.5 * (w - lp);
      const v = 0.5 * lp * Math.exp(-tt / 0.05) + 0.4 * Math.sin(2 * Math.PI * 185 * tt) * Math.exp(-tt / 0.03);
      pcm[start + i] += amp * v;
    }
  };

  const hatLevel = o.hihatLevel ?? 0.35;
  const pop = o.pattern === 'pop';
  for (let b = 0; b < beats.length; b++) {
    const sec = sectionOf(b);
    const g = sec ? sec.gain : 1;
    const isDown = b % 4 === 0;
    if (pop && b % 2 === 1) addSnare(beats[b], 0.7 * g);
    else if (o.accent && isDown) addThump(beats[b], 1.0 * g, 50);
    else addThump(beats[b], 0.6 * g, 60);
    const wantHat = o.hihat || (sec?.full ?? false);
    if (pop) addHat(beats[b], hatLevel * g);
    if ((wantHat || pop) && b + 1 < beats.length) addHat((beats[b] + beats[b + 1]) / 2, hatLevel * g);
  }

  // Sustained layer in "full" sections: a bass note per bar plus noise pad.
  const sectionTimes: number[] = [0];
  if (o.structure && sectionBeats) {
    for (let k = 1; k < sectionBeats.length; k++) sectionTimes.push(beats[sectionBeats[k]]);
    sectionTimes.push(duration);
    for (let k = 0; k < o.structure.length; k++) {
      const s = o.structure[k];
      if (!s.full) continue;
      const startT = beats[sectionBeats[k]];
      const endBeat = sectionBeats[k] + s.bars * 4;
      const endT = endBeat < beats.length ? beats[endBeat] : duration;
      const i0 = Math.round(startT * sr);
      const i1 = Math.min(n, Math.round(endT * sr));
      let lp = 0;
      for (let i = i0; i < i1; i++) {
        const tt = (i - i0) / sr;
        lp += 0.05 * (gauss() - lp);
        const pad = 0.6 * lp + 0.08 * Math.sin(2 * Math.PI * 220 * tt) + 0.05 * Math.sin(2 * Math.PI * 330 * tt);
        pcm[i] += s.gain * pad;
      }
    }
  }

  if (o.snrDb !== undefined) {
    let sumSq = 0;
    const i0 = Math.round(leadIn * sr);
    for (let i = i0; i < n; i++) sumSq += pcm[i] * pcm[i];
    const rms = Math.sqrt(sumSq / Math.max(1, n - i0));
    const noiseRms = rms / Math.pow(10, o.snrDb / 20);
    if (o.noiseColor === 'pink') {
      // Paul Kellet's economy pink filter; normalise its RMS empirically.
      const raw = new Float32Array(n);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let ss = 0;
      for (let i = 0; i < n; i++) {
        const w = gauss();
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        raw[i] = b0 + b1 + b2 + w * 0.1848;
        ss += raw[i] * raw[i];
      }
      const k = noiseRms / Math.sqrt(ss / Math.max(1, n));
      for (let i = 0; i < n; i++) pcm[i] += k * raw[i];
    } else {
      for (let i = 0; i < n; i++) pcm[i] += noiseRms * gauss();
    }
  }
  const outGain = o.gain ?? 1;
  if (outGain !== 1) for (let i = 0; i < n; i++) pcm[i] *= outGain;
  return { pcm, sampleRate: sr, beats, downbeats, duration, sectionTimes };
}

/** White noise of the given RMS. */
export function synthNoise(duration: number, rms = 0.1, sampleRate = 22050, seed = 7): Float32Array {
  const gauss = gaussian(mulberry32(seed));
  const n = Math.round(duration * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rms * gauss();
  return out;
}

/** Beat-tracking F-measure with a +-tol window (each reference matched at most once). */
export function fMeasure(est: number[], ref: number[], tol = 0.05): { f: number; precision: number; recall: number } {
  if (est.length === 0 || ref.length === 0) return { f: 0, precision: 0, recall: 0 };
  const used = new Uint8Array(ref.length);
  let hits = 0;
  let j = 0;
  for (const e of est) {
    while (j < ref.length && ref[j] < e - tol) j++;
    let best = -1;
    let bestD = Infinity;
    for (let k = j; k < ref.length && ref[k] <= e + tol; k++) {
      const d = Math.abs(ref[k] - e);
      if (!used[k] && d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best >= 0) {
      used[best] = 1;
      hits++;
    }
  }
  const precision = hits / est.length;
  const recall = hits / ref.length;
  const f = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { f, precision, recall };
}

/** Signed error (est - nearest ref) for each estimate within `tol`. */
export function signedErrors(est: number[], ref: number[], tol = 0.1): number[] {
  const out: number[] = [];
  for (const e of est) {
    let best = Infinity;
    for (const r of ref) if (Math.abs(r - e) < Math.abs(best)) best = r - e;
    if (Math.abs(best) <= tol) out.push(-best);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Real-music-like synthetic material (test-only).

type Gauss = () => number;

function thump(pcm: Float32Array, sr: number, gauss: Gauss, at: number, amp: number, f0 = 55): void {
  const start = Math.round(at * sr);
  const len = Math.round(0.25 * sr);
  let phase = 0;
  for (let i = 0; i < len && start + i < pcm.length; i++) {
    const tt = i / sr;
    phase += (2 * Math.PI * (f0 + 90 * Math.exp(-tt / 0.02))) / sr;
    let v = Math.sin(phase) * Math.exp(-tt / 0.07) * Math.min(1, i / 16);
    if (i < 0.004 * sr) v += 0.3 * gauss() * (1 - i / (0.004 * sr));
    if (start + i >= 0) pcm[start + i] += amp * v;
  }
}

function noiseHit(pcm: Float32Array, sr: number, gauss: Gauss, at: number, amp: number, decay: number, lowpass: number, tone = 0): void {
  const start = Math.round(at * sr);
  const len = Math.round(Math.min(0.3, decay * 6) * sr);
  let lp = 0;
  let prev = 0;
  for (let i = 0; i < len && start + i < pcm.length; i++) {
    const tt = i / sr;
    const w = gauss();
    let v: number;
    if (lowpass > 0) {
      lp += lowpass * (w - lp);
      v = lp;
    } else {
      v = w - prev; // crude high-pass
      prev = w;
    }
    v *= Math.exp(-tt / decay);
    if (tone > 0) v += 0.6 * Math.sin(2 * Math.PI * tone * tt) * Math.exp(-tt / 0.03);
    if (start + i >= 0) pcm[start + i] += amp * v;
  }
}

export type DrumKind = 'kick' | 'snare' | 'hat' | 'clap';
export interface PatternEvent {
  /** Position in beats from the start of the bar (may be fractional). */
  at: number;
  kind: DrumKind;
  gain?: number;
}

function drum(pcm: Float32Array, sr: number, gauss: Gauss, kind: DrumKind, at: number, g: number): void {
  if (kind === 'kick') thump(pcm, sr, gauss, at, 0.9 * g);
  else if (kind === 'snare') noiseHit(pcm, sr, gauss, at, 0.7 * g, 0.05, 0.5, 185);
  else if (kind === 'clap') noiseHit(pcm, sr, gauss, at, 0.6 * g, 0.03, 0.8);
  else noiseHit(pcm, sr, gauss, at, 0.25 * g, 0.012, 0);
}

export interface PatternOptions {
  bpm: number;
  bars: number;
  /** Beats per bar (default 4). */
  beatsPerBar?: number;
  events: PatternEvent[];
  sampleRate?: number;
  seed?: number;
  /** Additive white noise SNR (dB). */
  snrDb?: number;
}

/** A drum loop: the same bar of events repeated; beats/downbeats are the metrical grid. */
export function synthPattern(o: PatternOptions): SynthResult {
  const sr = o.sampleRate ?? 22050;
  const gauss = gaussian(mulberry32(o.seed ?? 99));
  const bpb = o.beatsPerBar ?? 4;
  const P = 60 / o.bpm;
  const first = 0.25;
  const duration = first + o.bars * bpb * P + 0.5;
  const pcm = new Float32Array(Math.round(duration * sr));
  const beats: number[] = [];
  const downbeats: number[] = [];
  for (let b = 0; b < o.bars; b++) {
    const t0 = first + b * bpb * P;
    for (let k = 0; k < bpb; k++) {
      if (k === 0) downbeats.push(beats.length);
      beats.push(t0 + k * P);
    }
    for (const e of o.events) drum(pcm, sr, gauss, e.kind, t0 + e.at * P, e.gain ?? 1);
  }
  addNoise(pcm, o.snrDb, gauss);
  return { pcm, sampleRate: sr, beats, downbeats, duration, sectionTimes: [0, duration] };
}

function addNoise(pcm: Float32Array, snrDb: number | undefined, gauss: Gauss): void {
  if (snrDb === undefined) return;
  let ss = 0;
  for (let i = 0; i < pcm.length; i++) ss += pcm[i] * pcm[i];
  const k = Math.sqrt(ss / Math.max(1, pcm.length)) / Math.pow(10, snrDb / 20);
  for (let i = 0; i < pcm.length; i++) pcm[i] += k * gauss();
}

export interface SongSection {
  name: string;
  bars: number;
  /** Chord per bar, cycled: MIDI note numbers of each chord. */
  chords: number[][];
  /** Drum bar for this section. */
  drums: PatternEvent[];
}

export interface SongOptions {
  bpm: number;
  sections: SongSection[];
  sampleRate?: number;
  seed?: number;
  snrDb?: number;
}

/**
 * A "compressed master": every bar is normalised to the same RMS, so the
 * sections differ only in harmony (sustained chord tones + a bass note) and
 * drum pattern, never in loudness. sectionTimes holds the true boundaries.
 */
export function synthSong(o: SongOptions): SynthResult & { sectionNames: string[] } {
  const sr = o.sampleRate ?? 22050;
  const gauss = gaussian(mulberry32(o.seed ?? 4242));
  const P = 60 / o.bpm;
  const first = 0.25;
  const totalBars = o.sections.reduce((s, x) => s + x.bars, 0);
  const duration = first + totalBars * 4 * P + 0.5;
  const pcm = new Float32Array(Math.round(duration * sr));
  const beats: number[] = [];
  const downbeats: number[] = [];
  const sectionTimes: number[] = [0];
  const barStarts: number[] = [];
  let bar = 0;
  for (let si = 0; si < o.sections.length; si++) {
    const sec = o.sections[si];
    if (si > 0) sectionTimes.push(first + bar * 4 * P);
    for (let b = 0; b < sec.bars; b++, bar++) {
      const t0 = first + bar * 4 * P;
      barStarts.push(t0);
      for (let k = 0; k < 4; k++) {
        if (k === 0) downbeats.push(beats.length);
        beats.push(t0 + k * P);
      }
      // Harmony: chord tones (with two harmonics) and a bass note, re-struck each beat.
      const chord = sec.chords[b % sec.chords.length];
      const i0 = Math.round(t0 * sr);
      const i1 = Math.min(pcm.length, Math.round((t0 + 4 * P) * sr));
      for (let i = i0; i < i1; i++) {
        const tt = (i - i0) / sr;
        const env = 0.35 + 0.65 * Math.exp(-(tt % P) / 0.25);
        let v = 0;
        for (const note of chord) {
          const f = 440 * Math.pow(2, (note - 69) / 12);
          v += Math.sin(2 * Math.PI * f * tt) + 0.4 * Math.sin(4 * Math.PI * f * tt) + 0.2 * Math.sin(6 * Math.PI * f * tt);
        }
        const fb = 440 * Math.pow(2, (chord[0] - 12 - 69) / 12);
        v = (0.08 * v) / chord.length + 0.12 * Math.sin(2 * Math.PI * fb * tt);
        pcm[i] += env * v;
      }
      for (const e of sec.drums) drum(pcm, sr, gauss, e.kind, t0 + e.at * P, e.gain ?? 1);
    }
  }
  sectionTimes.push(duration);
  // Constant loudness: normalise every bar to the same RMS.
  for (let k = 0; k < barStarts.length; k++) {
    const i0 = Math.round(barStarts[k] * sr);
    const i1 = Math.min(pcm.length, k + 1 < barStarts.length ? Math.round(barStarts[k + 1] * sr) : pcm.length);
    let ss = 0;
    for (let i = i0; i < i1; i++) ss += pcm[i] * pcm[i];
    const g = 0.2 / Math.sqrt(ss / Math.max(1, i1 - i0) + 1e-12);
    for (let i = i0; i < i1; i++) pcm[i] *= g;
  }
  addNoise(pcm, o.snrDb, gauss);
  return { pcm, sampleRate: sr, beats, downbeats, duration, sectionTimes, sectionNames: o.sections.map((s) => s.name) };
}

// ---------------------------------------------------------------------------
// Mixes with tonal layers, for the song-trait tests (test-only).

export interface MixOptions {
  bpm: number;
  bars: number;
  /** Drum events per bar (beats from the bar start; 4 beats per bar). */
  drums?: PatternEvent[];
  /** Piano-like chords (decaying harmonic tones with a hammer click), one per `pianoEvery` beats. */
  piano?: { chords: number[][]; every?: number; level?: number };
  /** Distorted power chords (clipped saws), re-struck every 8th, root per bar (MIDI). */
  guitar?: { roots: number[]; level?: number };
  /** Sustained sub-bass sine, one note per bar (MIDI, e.g. 28 = E1 41 Hz). */
  sub?: { notes: number[]; level?: number };
  /** Sustained synth-pad chord (6 harmonics per note), one chord per bar: fills the midrange like a real mix. */
  pad?: { chords: number[][]; level?: number };
  /** Overall output gain. */
  gain?: number;
  sampleRate?: number;
  seed?: number;
  snrDb?: number;
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Drums closer to a real kit than `drum` (whose kick has a white-noise click
 * and whose snare reaches down into the kick range): a kick that is mostly a
 * pitch-dropping sine with a small beater click, a snare / clap of
 * high-passed noise over a short body tone, a high-passed hat.
 */
function mixDrum(pcm: Float32Array, sr: number, gauss: Gauss, kind: DrumKind, at: number, g: number): void {
  const start = Math.round(at * sr);
  if (kind === 'kick') {
    let phase = 0;
    for (let i = 0; i < 0.3 * sr && start + i < pcm.length; i++) {
      const t = i / sr;
      phase += (2 * Math.PI * (50 + 100 * Math.exp(-t / 0.015))) / sr;
      let v = Math.sin(phase) * Math.exp(-t / 0.09) * Math.min(1, i / 16);
      if (i < 0.002 * sr) v += 0.08 * gauss();
      if (start + i >= 0) pcm[start + i] += 0.9 * g * v;
    }
    return;
  }
  const hat = kind === 'hat';
  const decay = hat ? 0.015 : kind === 'clap' ? 0.04 : 0.07;
  const body = kind === 'snare' ? 190 : 0;
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < Math.min(0.4, decay * 6) * sr && start + i < pcm.length; i++) {
    const t = i / sr;
    const w = gauss();
    // Second difference: a steep high-pass (hat), or first difference (snare / clap).
    const v = hat ? w - 2 * p1 + p2 : w - p1;
    p2 = p1;
    p1 = w;
    let x = (hat ? 0.12 : 0.35) * v * Math.exp(-t / decay);
    if (body) x += 0.35 * Math.sin(2 * Math.PI * body * t) * Math.exp(-t / 0.04);
    if (start + i >= 0) pcm[start + i] += g * x;
  }
}

/** A drum loop plus optional piano, distorted guitar and sub-bass layers. Beats / downbeats are the true grid. */
export function synthMix(o: MixOptions): SynthResult {
  const sr = o.sampleRate ?? 22050;
  const rand = mulberry32(o.seed ?? 31);
  const gauss = gaussian(rand);
  const P = 60 / o.bpm;
  const first = 0.25;
  const duration = first + o.bars * 4 * P + 1;
  const pcm = new Float32Array(Math.round(duration * sr));
  const beats: number[] = [];
  const downbeats: number[] = [];
  for (let b = 0; b < o.bars; b++) {
    const t0 = first + b * 4 * P;
    downbeats.push(beats.length);
    for (let k = 0; k < 4; k++) beats.push(t0 + k * P);
    for (const e of o.drums ?? []) mixDrum(pcm, sr, gauss, e.kind, t0 + e.at * P, e.gain ?? 1);
  }
  if (o.piano) {
    const every = o.piano.every ?? 2;
    const lvl = o.piano.level ?? 0.15;
    let c = 0;
    for (let j = 0; j < beats.length; j += every, c++) {
      const chord = o.piano.chords[c % o.piano.chords.length];
      const i0 = Math.round(beats[j] * sr);
      const len = Math.min(pcm.length - i0, Math.round(Math.min(2.5, every * P + 0.8) * sr));
      for (const note of chord) {
        const f0 = midiHz(note);
        for (let h = 1; h <= 8; h++) {
          const fh = f0 * h * Math.sqrt(1 + 0.0004 * h * h);
          if (fh > sr / 2.2) break;
          const a = lvl / h / chord.length;
          const dec = 1.6 / Math.sqrt(h);
          for (let i = 0; i < len; i++) {
            const t = i / sr;
            pcm[i0 + i] += a * Math.sin(2 * Math.PI * fh * t) * Math.exp(-t / dec) * Math.min(1, i / (0.004 * sr));
          }
        }
      }
      // Soft, dull hammer thud (low-passed noise).
      let lp = 0;
      for (let i = 0; i < 0.01 * sr && i0 + i < pcm.length; i++) {
        lp += 0.1 * (gauss() - lp);
        pcm[i0 + i] += 0.1 * lvl * lp * (1 - i / (0.01 * sr));
      }
    }
  }
  if (o.guitar) {
    const lvl = o.guitar.level ?? 0.25;
    // A speaker cabinet: four one-pole low-passes at 7 kHz (presence kept, ~24 dB / octave above).
    const cab = [0, 0, 0, 0];
    const ca = 1 - Math.exp((-2 * Math.PI * 7000) / sr);
    for (let b = 0; b < o.bars; b++) {
      const root = o.guitar.roots[b % o.guitar.roots.length];
      const fs = [midiHz(root), midiHz(root + 7), midiHz(root + 12)];
      for (let e = 0; e < 8; e++) {
        const t0 = first + b * 4 * P + (e * P) / 2;
        const i0 = Math.round(t0 * sr);
        const len = Math.round((P / 2) * sr);
        const ph = [rand(), rand(), rand()];
        for (let i = 0; i < len && i0 + i < pcm.length; i++) {
          const t = i / sr;
          let x = 0;
          for (let q = 0; q < 3; q++) x += 2 * (((fs[q] * t + ph[q]) % 1) - 0.5);
          x = Math.tanh(6 * x) + 0.05 * gauss(); // heavy clipping + fizz
          let y = x;
          for (let q = 0; q < 4; q++) y = cab[q] += ca * (y - cab[q]);
          const env = Math.min(1, i / (0.003 * sr)) * (0.75 + 0.25 * Math.exp(-t / 0.05));
          pcm[i0 + i] += lvl * 1.6 * y * env;
        }
      }
    }
  }
  if (o.sub) {
    const lvl = o.sub.level ?? 0.4;
    for (let b = 0; b < o.bars; b++) {
      const f0 = midiHz(o.sub.notes[b % o.sub.notes.length]);
      const i0 = Math.round((first + b * 4 * P) * sr);
      const len = Math.round(4 * P * sr);
      for (let i = 0; i < len && i0 + i < pcm.length; i++) {
        const t = i / sr;
        pcm[i0 + i] += lvl * Math.sin(2 * Math.PI * f0 * t) * Math.min(1, i / (0.01 * sr), (len - i) / (0.01 * sr));
      }
    }
  }
  if (o.pad) {
    const lvl = o.pad.level ?? 0.06;
    for (let b = 0; b < o.bars; b++) {
      const chord = o.pad.chords[b % o.pad.chords.length];
      const i0 = Math.round((first + b * 4 * P) * sr);
      const len = Math.round(4 * P * sr);
      const fade = 0.03 * sr;
      for (let i = 0; i < len && i0 + i < pcm.length; i++) {
        const t = (i0 + i) / sr;
        const env = Math.min(1, i / fade, (len - i) / fade);
        let v = 0;
        for (const note of chord) {
          const f0 = midiHz(note);
          for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f0 * h * t * (1 + 0.002 * h)) / h;
        }
        pcm[i0 + i] += (lvl * env * v) / chord.length;
      }
    }
  }
  addNoise(pcm, o.snrDb, gauss);
  const g = o.gain ?? 1;
  if (g !== 1) for (let i = 0; i < pcm.length; i++) pcm[i] *= g;
  return { pcm, sampleRate: sr, beats, downbeats, duration, sectionTimes: [0, duration] };
}
