/**
 * Known tempos for song tiles ("124 BPM" badges): from beat maps cached on
 * this device (remembered in the store when cached), else from the cloud
 * index `<base>beatmaps/index.json`, whose optional `songs` field is
 * `{ [videoId]: { bpm, duration } }`. The index is fetched once per app open.
 *
 * `bpmEvents` fires 'change' when either source learns something new.
 */
import { store } from '../store';
import { absoluteBase, type FetchLike } from './cloud';

export interface IndexSong {
  bpm: number;
  duration: number;
}

export const bpmEvents = new EventTarget();

let cloudSongs: Record<string, IndexSong> = {};
let indexP: Promise<void> | null = null;

/** Parse index.json's `songs`; tolerates its absence and bad entries. */
export function parseIndexSongs(text: string): Record<string, IndexSong> {
  const out: Record<string, IndexSong> = {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return out;
  }
  const songs = (data as { songs?: unknown } | null)?.songs;
  if (!songs || typeof songs !== 'object' || Array.isArray(songs)) return out;
  for (const [id, v] of Object.entries(songs as Record<string, unknown>)) {
    const bpm = (v as { bpm?: unknown } | null)?.bpm;
    const duration = (v as { duration?: unknown } | null)?.duration;
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0 || bpm > 1000) continue;
    out[id] = { bpm, duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : 0 };
  }
  return out;
}

/** Fetch the cloud index once per app open. Never rejects. */
export function loadCloudIndex(base: string, fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<void> {
  if (!indexP) {
    const url = new URL('beatmaps/index.json', absoluteBase(base)).href;
    indexP = fetchFn(url, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        const songs = text ? parseIndexSongs(text) : {};
        if (Object.keys(songs).length) {
          cloudSongs = songs;
          bpmEvents.dispatchEvent(new Event('change'));
        }
      })
      .catch(() => {});
  }
  return indexP;
}

/**
 * Fetch the index again (a song was just added by search). The query string
 * gets past the Pages CDN cache. Never rejects.
 */
export function reloadCloudIndex(base: string, fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<void> {
  const url = new URL('beatmaps/index.json', absoluteBase(base));
  url.searchParams.set('t', String(Date.now()));
  indexP = fetchFn(url.href, { cache: 'no-store' })
    .then((res) => (res.ok ? res.text() : ''))
    .then((text) => {
      const songs = text ? parseIndexSongs(text) : {};
      if (Object.keys(songs).length) {
        cloudSongs = songs;
        bpmEvents.dispatchEvent(new Event('change'));
      }
    })
    .catch(() => {});
  return indexP;
}

/** Rounded tempo for a song, or null when unknown. */
export function knownBpm(videoId: string): number | null {
  const bpm = store.localBpm(videoId) ?? cloudSongs[videoId]?.bpm ?? null;
  return bpm && bpm > 0 ? Math.round(bpm) : null;
}

/** Called by the beat-map cache after storing a map. */
export function noteCachedBpm(key: string, bpm: number): void {
  if (!(bpm > 0)) return;
  const before = knownBpm(key);
  store.setLocalBpm(key, bpm);
  if (knownBpm(key) !== before) bpmEvents.dispatchEvent(new Event('change'));
}
