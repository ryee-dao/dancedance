/** Synthetic beat maps for choreography tests (pure). */

import type { BeatMap, Section, SectionType } from '../analysis/beatmap';

export const SONG_PLAN: readonly [SectionType, number, number][] = [
  ['intro', 8, 0.3],
  ['verse', 16, 0.5],
  ['chorus', 8, 0.8],
  ['verse', 16, 0.55],
  ['chorus', 8, 0.85],
  ['drop', 8, 0.95],
  ['chorus', 8, 0.85],
  ['outro', 8, 0.25],
];

/** A regular 4/4 song with the given section plan (bars per section). */
export function songMap(bpm: number, videoId = 'song-a', plan: readonly [SectionType, number, number][] = SONG_PLAN, offset = 0.37): BeatMap {
  const per = 60 / bpm;
  const beats: number[] = [];
  const downbeats: number[] = [];
  const sections: Section[] = [];
  let b = 0;
  for (const [type, bars, energy] of plan) {
    const start = offset + b * per;
    for (let i = 0; i < bars * 4; i++) {
      if (i % 4 === 0) downbeats.push(b);
      beats.push(offset + b * per);
      b++;
    }
    sections.push({ start, end: offset + b * per, type, energy });
  }
  return { v: 1, analyzerVersion: 'test', videoId, duration: offset + b * per + 1, bpm, beats, downbeats, sections, source: 'file' };
}
