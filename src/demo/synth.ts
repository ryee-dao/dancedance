/** Synthetic beat maps and beat sources for the coach bench (dev only). */

import type { BeatSource, BeatTimeline } from '../beat/beatSource';
import type { BeatMap, Section, SectionType } from '../core/analysis/beatmap';

export const SECTION_PLAN: readonly [SectionType, number, number][] = [
  // type, bars, energy
  ['intro', 8, 0.3],
  ['verse', 16, 0.5],
  ['chorus', 8, 0.8],
  ['verse', 16, 0.55],
  ['chorus', 8, 0.85],
  ['drop', 8, 0.95],
  ['chorus', 8, 0.85],
  ['outro', 8, 0.25],
];

/** Tempo range the synthetic song supports. */
export const SYNTH_MIN_BPM = 40;
export const SYNTH_MAX_BPM = 240;

export function synthMap(bpm: number, videoId = 'demo-song', offset = 0.4): BeatMap {
  if (!Number.isFinite(bpm) || bpm < SYNTH_MIN_BPM || bpm > SYNTH_MAX_BPM) {
    throw new RangeError(`synthMap: bpm ${bpm} outside ${SYNTH_MIN_BPM}..${SYNTH_MAX_BPM}`);
  }
  const per = 60 / bpm;
  const beats: number[] = [];
  const downbeats: number[] = [];
  const sections: Section[] = [];
  let b = 0;
  for (const [type, bars, energy] of SECTION_PLAN) {
    const start = offset + b * per;
    for (let i = 0; i < bars * 4; i++) {
      if (i % 4 === 0) downbeats.push(b);
      beats.push(Math.round((offset + b * per) * 1000) / 1000);
      b++;
    }
    sections.push({ start: Math.round(start * 1000) / 1000, end: Math.round((offset + b * per) * 1000) / 1000, type, energy });
  }
  const duration = offset + b * per + 2;
  sections[sections.length - 1].end = Math.round(duration * 1000) / 1000;
  return { v: 1, analyzerVersion: 'demo', videoId, duration, bpm, beats, downbeats, sections, source: 'file' };
}

export type SimMode = 'map' | 'live' | 'partial' | 'none';

/** A beat source simulating the different sync situations. */
export class SimSource implements BeatSource {
  mode: SimMode = 'map';
  revision = 0;
  /** Seconds until the live tracker "locks". */
  lockAfter = 6;
  /** Partial map covers this many seconds. */
  partialSec = 40;
  private map: BeatMap;
  private partial: BeatMap;
  private tl: BeatTimeline = { map: null, live: null, revision: 0 };
  private beats: number[] = [];
  private nextBeats: number[] = [];
  now = 0;

  constructor(public bpm: number) {
    this.map = synthMap(bpm);
    this.partial = this.makePartial();
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    this.map = synthMap(bpm);
    this.partial = this.makePartial();
    this.revision++;
  }

  get fullMap(): BeatMap {
    return this.map;
  }

  private makePartial(): BeatMap {
    const m = this.map;
    const n = m.beats.findIndex((t) => t > this.partialSec);
    const k = n < 0 ? m.beats.length : n;
    return {
      ...m,
      partial: true,
      beats: m.beats.slice(0, k),
      downbeats: m.downbeats.filter((d) => d < k),
      sections: m.sections.filter((s) => s.start < this.partialSec).map((s) => ({ ...s, end: Math.min(s.end, this.partialSec) })),
    };
  }

  /** Simulate the map arriving (live -> map, or partial -> full). */
  upgrade(): void {
    if (this.mode === 'live' || this.mode === 'partial') {
      this.mode = 'map';
      this.revision++;
    }
  }

  current(): BeatTimeline {
    const tl = this.tl;
    tl.revision = this.revision;
    const t = this.now;
    if (this.mode === 'map') {
      tl.map = this.map;
      tl.live = null;
    } else if (this.mode === 'none') {
      tl.map = null;
      tl.live = null;
    } else {
      tl.map = this.mode === 'partial' ? this.partial : null;
      const per = 60 / this.bpm;
      const locked = this.mode === 'partial' || t > this.lockAfter;
      // Heard beats: the true grid with a little jitter; predictions ahead.
      this.beats.length = 0;
      this.nextBeats.length = 0;
      for (const b of this.map.beats) {
        if (b > t) break;
        if (b > t - 12) this.beats.push(b + (Math.sin(b * 12.9898) * 0.008));
      }
      if (locked) {
        const last = this.beats.length ? this.beats[this.beats.length - 1] : t;
        for (let i = 1; i <= 8; i++) this.nextBeats.push(last + i * per);
      }
      tl.live = { locked, bpm: locked ? this.bpm : 0, beats: this.beats, nextBeats: this.nextBeats };
    }
    return tl;
  }
}
