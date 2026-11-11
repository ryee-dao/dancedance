/**
 * Small read helpers over a BeatTimeline, shared by stage renderers.
 * Pure: no DOM.
 */
import { sectionAt, type BeatMap, type Section } from '../core/analysis';
import type { BeatTimeline } from './beatSource';

export interface BeatHit {
  /** Beat time (song time, s). */
  time: number;
  /** Seconds to the following beat (best estimate). */
  period: number;
  /** True for the first beat of a bar (only known from a map). */
  downbeat: boolean;
  from: 'map' | 'live';
}

/** Index of the last element <= t in an ascending array, or -1. */
export function lastIndexAtOrBefore(arr: readonly number[], t: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Song time up to which the map can be trusted (end of the song unless partial). */
export function mapCoverageEnd(map: BeatMap): number {
  if (!map.partial) return map.duration;
  const n = map.beats.length;
  if (n === 0) return 0;
  const period = n >= 2 ? (map.beats[n - 1] - map.beats[0]) / (n - 1) : 60 / (map.bpm || 120);
  return map.beats[n - 1] + period * 0.5;
}

function downbeatSet(map: BeatMap): Set<number> {
  let s = dbCache.get(map);
  if (!s) {
    s = new Set(map.downbeats);
    dbCache.set(map, s);
  }
  return s;
}
const dbCache = new WeakMap<BeatMap, Set<number>>();

/** The most recent beat at or before `t`, from the map where it covers `t`, else from live tracking. */
export function lastBeat(tl: BeatTimeline, t: number): BeatHit | null {
  const map = tl.map;
  if (map && map.beats.length && t <= mapCoverageEnd(map)) {
    const i = lastIndexAtOrBefore(map.beats, t);
    if (i >= 0) {
      const b = map.beats;
      const period = i + 1 < b.length ? b[i + 1] - b[i] : i > 0 ? b[i] - b[i - 1] : 60 / (map.bpm || 120);
      return { time: b[i], period, downbeat: downbeatSet(map).has(i), from: 'map' };
    }
    if (!tl.live) return null;
  }
  const live = tl.live;
  if (!live || !live.locked || live.bpm <= 0) return null;
  const period = 60 / live.bpm;
  // Predicted beats take over from heard ones as time passes.
  const ni = lastIndexAtOrBefore(live.nextBeats, t);
  if (ni >= 0) return { time: live.nextBeats[ni], period, downbeat: false, from: 'live' };
  const hi = lastIndexAtOrBefore(live.beats, t);
  if (hi >= 0) {
    // Extrapolate from the last heard beat if predictions lag behind.
    const last = live.beats[hi];
    const k = Math.floor((t - last) / period);
    return { time: last + Math.max(0, k) * period, period, downbeat: false, from: 'live' };
  }
  return null;
}

/** The section at `t` if a map is known. */
export function sectionAtTime(tl: BeatTimeline, t: number): Section | undefined {
  return tl.map ? sectionAt(tl.map, t) : undefined;
}
