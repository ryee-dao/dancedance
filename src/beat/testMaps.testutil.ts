import { ANALYZER_VERSION, BEATMAP_VERSION, type BeatMap, type BeatMapSource } from '../core/analysis';

/** A valid BeatMap with evenly spaced beats. */
export function mkMap(o: { source?: BeatMapSource; partial?: boolean; bpm?: number; duration?: number; until?: number; first?: number; videoId?: string } = {}): BeatMap {
  const duration = o.duration ?? 180;
  const bpm = o.bpm ?? 120;
  const period = 60 / bpm;
  const until = o.until ?? duration;
  const beats: number[] = [];
  for (let t = o.first ?? 0.5; t <= until; t += period) beats.push(Math.round(t * 1000) / 1000);
  const m: BeatMap = {
    v: BEATMAP_VERSION,
    analyzerVersion: ANALYZER_VERSION,
    videoId: o.videoId ?? 'vid',
    duration,
    bpm,
    beats,
    downbeats: beats.map((_, i) => i).filter((i) => i % 4 === 0),
    sections: [
      { start: 0, end: duration / 2, type: 'verse', energy: 0.4 },
      { start: duration / 2, end: duration, type: 'chorus', energy: 0.9 },
    ],
    source: o.source ?? 'cloud',
  };
  if (o.partial) m.partial = true;
  return m;
}
