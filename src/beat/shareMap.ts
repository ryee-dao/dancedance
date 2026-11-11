/**
 * Share a beat map made in this browser with everyone: queue it, then POST it
 * to the relay's /map (cloudflare/add-song-worker), which starts the cloud job
 * that publishes it as the song's beat map. Quiet and best effort:
 *
 *  - Only 'tab' maps (heard via tab audio) and 'device' maps (analysed from a
 *    downloaded copy, e.g. by the helper app) are shared, never 'mic' maps,
 *    and never when the song already has a cloud map of equal or higher rank.
 *  - Every map must pass `commonMapGate` (the same rules the relay and the job
 *    apply). Tab maps must also pass `tabCoverageGate` (the song was played to
 *    its end with tab capture covering most of it, the tracker locked for most
 *    of it); call that first with what the tracker knows.
 *  - The queue lives in localStorage (at most MAX_QUEUE maps, ~10 KB each) and
 *    is retried on the next app open; nothing happens without a relay.
 *  - One calm line when a map was handed over: "Saved this song's beat for everyone."
 */
import { checkSharedMap, serialize, sourceRank, SHARED_MAP_MAX_BYTES, type BeatMap, type BeatMapSource } from '../core/analysis';
import { parseRelayUrl, relayShareMap } from '../platform/relay';
import { store } from '../store';
import { toast } from '../ui/toast';

export const SHARE_QUEUE_KEY = 'dd.mapUploads';
export const MAX_QUEUE = 3;
/** Attempts per map before it is dropped (e.g. a relay passphrase this browser doesn't know). */
export const MAX_TRIES = 5;
export const SHARED_TOAST = 'Saved this song’s beat for everyone.';

/** Tab-capture coverage rules (see tabCoverageGate). */
export const TAB_MIN_COVERAGE = 0.85;
export const TAB_MIN_LOCKED = 0.75;
/** The song must have played to within this many seconds of its end. */
export const TAB_END_SLACK = 10;

export interface TabCoverage {
  /** Song length (s). */
  duration: number;
  /** Seconds of song the recording covers (longest segment, no seeks inside it). */
  covered: number;
  /** Seconds of that recording during which the live tracker was locked. */
  locked: number;
  /** Song time when listening stopped (s). */
  stoppedAt: number;
}

/** Why a tab map isn't trustworthy enough to share, or null. Pure. */
export function tabCoverageGate(map: BeatMap, c: TabCoverage): string | null {
  if (map.source !== 'tab') return 'not-tab';
  if (map.partial) return 'partial';
  if (!(c.duration > 0)) return 'duration';
  if (c.stoppedAt < c.duration - TAB_END_SLACK) return 'not-to-the-end';
  if (c.covered < TAB_MIN_COVERAGE * c.duration) return 'coverage';
  if (c.locked < TAB_MIN_LOCKED * c.covered) return 'not-locked';
  return null;
}

/** Why a map can't be shared at all, or null (the same rules as the relay and the cloud job). Pure. */
export function commonMapGate(map: BeatMap): string | null {
  if (map.source === 'mic') return 'mic';
  const chk = checkSharedMap(JSON.parse(JSON.stringify(map)));
  if (!chk.ok) return chk.rule;
  if (new TextEncoder().encode(serialize(chk.map)).length > SHARED_MAP_MAX_BYTES) return 'too-large';
  return null;
}

interface Entry {
  videoId: string;
  json: string;
  source: BeatMapSource;
  tries: number;
  queuedAt: number;
}

function readQueue(): Entry[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(SHARE_QUEUE_KEY) ?? '[]') as unknown;
    return Array.isArray(v)
      ? v.filter((e): e is Entry => !!e && typeof e.videoId === 'string' && typeof e.json === 'string' && typeof e.tries === 'number').slice(-MAX_QUEUE)
      : [];
  } catch {
    return [];
  }
}

function writeQueue(q: Entry[]): void {
  try {
    if (q.length) window.localStorage.setItem(SHARE_QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
    else window.localStorage.removeItem(SHARE_QUEUE_KEY);
  } catch {
    /* storage unavailable: this map just isn't shared */
  }
}

/** The relay to share through (built in, else typed into this browser), or null. */
export function shareRelay(): string | null {
  const built = parseRelayUrl(import.meta.env.VITE_ADD_SONG_URL as string | undefined);
  return built ?? parseRelayUrl(store.addRelay());
}

export type QueueResult = 'queued' | `skipped:${string}`;

/**
 * Queue a map for sharing and try to send it now. `existingSource`: the
 * source of the cloud map this song already has, if any. Never throws.
 */
export function queueMapUpload(map: BeatMap, opts: { existingSource?: BeatMapSource | null; /** default true */ send?: boolean } = {}): QueueResult {
  try {
    if (map.source !== 'tab' && map.source !== 'device') return 'skipped:source';
    if (opts.existingSource && sourceRank(opts.existingSource) >= sourceRank(map.source)) return 'skipped:has-map';
    const problem = commonMapGate(map);
    if (problem) return `skipped:${problem}`;
    if (!shareRelay()) return 'skipped:no-relay';
    const json = serialize(map);
    const q = readQueue().filter((e) => e.videoId !== map.videoId || sourceRank(e.source) > sourceRank(map.source));
    if (q.some((e) => e.videoId === map.videoId)) return 'skipped:queued-better';
    q.push({ videoId: map.videoId, json, source: map.source, tries: 0, queuedAt: Date.now() });
    writeQueue(q);
    if (opts.send !== false) void flushMapUploads();
    return 'queued';
  } catch {
    return 'skipped:error';
  }
}

let flushing: Promise<void> | null = null;

/** Send everything queued (one at a time). Called after queueing and on app open. Never rejects. */
export function flushMapUploads(
  deps: { fetchFn?: Parameters<typeof relayShareMap>[3]; notify?: (msg: string) => void } = {},
): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const relay = shareRelay();
    if (!relay) return;
    for (const e of readQueue()) {
      const res = await relayShareMap(relay, e.json, store.addPassphrase(), deps.fetchFn);
      const q = readQueue();
      const i = q.findIndex((x) => x.videoId === e.videoId && x.json === e.json);
      if (res.ok || !res.retry || e.tries + 1 >= MAX_TRIES) {
        if (i >= 0) q.splice(i, 1);
        if (res.ok) (deps.notify ?? ((m: string) => toast(m, 5000)))(SHARED_TOAST);
        else console.info('[dd:beats]', `beat map for ${e.videoId} not shared (${res.code})`);
      } else if (i >= 0) q[i] = { ...q[i], tries: q[i].tries + 1 };
      writeQueue(q);
      if (!res.ok && res.retry) break; // offline or rate limited: try again next time
    }
  })()
    .catch(() => {})
    .finally(() => {
      flushing = null;
    });
  return flushing;
}

/** Waiting maps (tests, diagnostics). */
export function queuedMapUploads(): { videoId: string; source: BeatMapSource; tries: number }[] {
  return readQueue().map(({ videoId, source, tries }) => ({ videoId, source, tries }));
}

// Retry whatever is still waiting shortly after the app opens.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  setTimeout(() => void flushMapUploads(), 8000);
}
