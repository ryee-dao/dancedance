/**
 * Find a beat map for a song: local cache first, then the cloud map.
 *
 * Both lookups start at once (the cloud fetch runs in parallel with the
 * cache read and with the player starting). `onMap` fires for the cached map
 * as soon as it is read, and again if the cloud map turns out better; cloud
 * maps are written to the cache. Resolves with the best map found, or null
 * (the caller then falls back to live listening). Never rejects.
 */
import type { BeatMap } from '../core/analysis';
import { isBetterMap, type BeatMapCache } from './cache';

export type MapOrigin = 'cache' | 'cloud';

export interface ResolveDeps {
  cache: Pick<BeatMapCache, 'get' | 'offer'>;
  /** Cloud lookup; omit for items without a video ID (dropped files). */
  fetchCloud?: (videoId: string) => Promise<BeatMap | null>;
}

export async function resolveBeatMap(
  key: string,
  videoId: string | null,
  deps: ResolveDeps,
  onMap: (map: BeatMap, origin: MapOrigin) => void = () => {},
): Promise<BeatMap | null> {
  const cloudP: Promise<BeatMap | null> =
    videoId && deps.fetchCloud ? deps.fetchCloud(videoId).catch(() => null) : Promise.resolve(null);
  let best: BeatMap | null = null;
  try {
    best = await deps.cache.get(key);
  } catch {
    best = null;
  }
  if (best) onMap(best, 'cache');
  const cloud = await cloudP;
  if (cloud && !(best && sameMap(best, cloud)) && isBetterMap(best, cloud)) {
    best = cloud;
    onMap(cloud, 'cloud');
    void deps.cache.offer(key, cloud).catch(() => false);
  }
  return best;
}

/** Cheap "is this the same analysis" check, so an unchanged cloud map doesn't bump the revision. */
function sameMap(a: BeatMap, b: BeatMap): boolean {
  return (
    a.source === b.source &&
    !!a.partial === !!b.partial &&
    a.analyzerVersion === b.analyzerVersion &&
    a.duration === b.duration &&
    a.bpm === b.bpm &&
    a.beats.length === b.beats.length &&
    a.beats[0] === b.beats[0] &&
    a.beats[a.beats.length - 1] === b.beats[b.beats.length - 1]
  );
}
