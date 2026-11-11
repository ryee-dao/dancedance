/**
 * "My added songs": the published `<beatmapBase>songs.json` (written by the
 * cloud job), plus this browser's pending requests (sent to GitHub, not
 * published yet) and the songs hidden on this device.
 *
 * While anything is pending it polls songs.json and songs-status.json:
 * every 30 s for the first 10 minutes, then every minute, then every 5
 * minutes after half an hour; only while the page is visible. GitHub Pages
 * sits behind a CDN that caches files for up to 10 minutes, so each poll adds
 * a `?t=` query (rounded to the poll interval) to get a fresh copy.
 *
 * Emits 'change' (re-render) and 'appeared' (CustomEvent<AddedSong>).
 */

import {
  parseSongsList,
  parseSongsStatus,
  songKey,
  songsStatusUrl,
  songsUrl,
  type AddedSong,
  type SongRequestStatus,
} from '../beat/cloud';
import { getPlatform, type Platform } from '../platform/platform';
import { store, type PendingAdd } from '../store';

export type PendingState = 'waiting' | 'slow' | 'retrying' | 'failed';

export interface PendingView extends PendingAdd {
  state: PendingState;
  /** User-facing sentence. */
  message: string;
}

/** After this long without the song appearing, say so and offer to send again. */
export const SLOW_AFTER_MS = 15 * 60_000;
/** A cloud status older than the send (minus clock skew) belongs to an earlier attempt. */
const SKEW_MS = 2 * 60_000;

/**
 * Pure: which pending songs have appeared, and how to describe the rest.
 */
export function reconcile(
  pending: PendingAdd[],
  published: AddedSong[],
  status: Readonly<Record<string, SongRequestStatus>>,
  now: number,
): { appeared: { pending: PendingAdd; song: AddedSong }[]; views: PendingView[] } {
  const byKey = new Map(published.map((s) => [songKey(s.artist, s.title), s]));
  const appeared: { pending: PendingAdd; song: AddedSong }[] = [];
  const views: PendingView[] = [];
  for (const p of pending) {
    const st0 = status[p.key];
    // Listed under slightly different names than requested: the 'map-pending' note says which video.
    const song = byKey.get(p.key) ?? (st0?.state === 'map-pending' && st0.videoId ? published.find((s) => s.videoId === st0.videoId) : undefined);
    if (song) {
      appeared.push({ pending: p, song });
      continue;
    }
    const st = status[p.key];
    const fresh = st && Date.parse(st.lastTried) >= p.sentAt - SKEW_MS;
    if (fresh && st.state === 'not-found') {
      views.push({
        ...p,
        state: 'failed',
        message: st.message || 'The cloud couldn’t find a YouTube video of this song that it can use.',
      });
    } else if (fresh && st.state === 'blocked') {
      views.push({ ...p, state: 'retrying', message: 'YouTube is blocking the cloud job for now. It tries again by itself within a few hours.' });
    } else if (fresh && st.state === 'error') {
      views.push({ ...p, state: 'retrying', message: 'Something went wrong in the cloud job. It tries again by itself within a few hours.' });
    } else if (now - p.sentAt > SLOW_AFTER_MS) {
      views.push({
        ...p,
        state: 'slow',
        message: 'This is taking longer than usual. GitHub may have dropped the request if several were sent at once.',
      });
    } else {
      views.push({ ...p, state: 'waiting', message: 'Being added… usually 3–5 minutes' });
    }
  }
  return { appeared, views };
}

/** Poll interval for the oldest pending request's age. */
export function pollDelayMs(ageMs: number): number {
  if (ageMs < 10 * 60_000) return 30_000;
  if (ageMs < 30 * 60_000) return 60_000;
  return 5 * 60_000;
}

/** URL with a cache-busting query that changes once per `stepMs`. */
export function bust(url: string, now: number, stepMs: number): string {
  const u = new URL(url);
  u.searchParams.set('t', String(Math.floor(now / stepMs)));
  return u.href;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'text'>>;

/**
 * Android TV: songs added on the device (from the phone page) join the
 * published ones, in add order. A local song the cloud also published (same
 * video or same artist + title) is shown once, as the cloud entry.
 */
export function mergeLocal(cloud: AddedSong[], local: AddedSong[]): AddedSong[] {
  if (!local.length) return cloud;
  const ids = new Set(cloud.map((s) => s.videoId));
  const keys = new Set(cloud.map((s) => songKey(s.artist, s.title)));
  const extra = local.filter((s) => !ids.has(s.videoId) && !keys.has(songKey(s.artist, s.title)));
  const t = (s: AddedSong) => Date.parse(s.addedAt) || 0;
  return [...cloud, ...extra].map((s, i) => ({ s, i })).sort((a, b) => t(a.s) - t(b.s) || a.i - b.i).map((x) => x.s);
}

/**
 * Pure: what removing the shown song `videoId` touches. Device copies (the
 * same video, or the same artist + title as the shown entry, which mergeLocal
 * folded into the cloud one) can be removed for real; a songs.json entry can
 * only be hidden on this device.
 */
export function removalPlan(videoId: string, cloud: AddedSong[], local: AddedSong[]): { localIds: string[]; hideCloud: boolean } {
  const shown = cloud.find((s) => s.videoId === videoId) ?? local.find((s) => s.videoId === videoId);
  if (!shown) return { localIds: [], hideCloud: false };
  const key = songKey(shown.artist, shown.title);
  const localIds = local.filter((s) => s.videoId === videoId || songKey(s.artist, s.title) === key).map((s) => s.videoId);
  return { localIds, hideCloud: cloud.some((s) => s.videoId === videoId) };
}

/** removedLocal: a device copy was removed; hidden: the song (cloud copy) is now hidden here. */
export interface RemoveOutcome {
  removedLocal: boolean;
  hidden: boolean;
}

export class AddedSongs extends EventTarget {
  private published: AddedSong[] = [];
  /** songs.json as published, and songs added on this device (Android TV). */
  private cloud: AddedSong[] = [];
  private local: AddedSong[] = [];
  private localSynced = false;
  private status: Record<string, SongRequestStatus> = {};
  private views: PendingView[] = [];
  private hidden = store.hiddenAdded();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private loading: Promise<void> | null = null;
  private base = './';
  private started = false;
  private lastSig = '';
  private platform: Platform | null = null;

  constructor(private readonly fetchFn: FetchFn = (u, i) => fetch(u, i)) {
    super();
  }

  /** Begin: load the lists once, then poll while anything is pending. */
  start(base: string): void {
    this.base = base;
    if (this.started) return;
    this.started = true;
    let platform: ReturnType<typeof getPlatform> | null = null;
    try {
      platform = getPlatform();
    } catch {
      platform = null; // not initialised (tests)
    }
    this.platform = platform;
    if (platform?.localAddedSongs) {
      const p = platform;
      const sync = () => this.setLocal(p.localAddedSongs?.() ?? []);
      p.onLocalAddedSongsChange?.(sync);
      sync();
    }
    this.views = reconcile(store.pendingAdds(), [], {}, Date.now()).views;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.views.length) void this.refresh();
      });
    }
    void this.refresh();
  }

  /** Published songs not hidden on this device, newest first. */
  songs(): AddedSong[] {
    return this.published.filter((s) => !this.hidden.has(s.videoId)).reverse();
  }

  /** Every published song, hidden or not. */
  allSongs(): AddedSong[] {
    return this.published;
  }

  pending(): PendingView[] {
    return this.views;
  }

  hiddenCount(): number {
    return this.published.filter((s) => this.hidden.has(s.videoId)).length;
  }

  find(videoId: string): AddedSong | null {
    return this.published.find((s) => s.videoId === videoId && !this.hidden.has(s.videoId)) ?? null;
  }

  /** Whether this song is already published or on its way (by request key). */
  stateOf(key: string): 'added' | 'pending' | null {
    if (this.published.some((s) => songKey(s.artist, s.title) === key && !this.hidden.has(s.videoId))) return 'added';
    if (store.pendingAdds().some((p) => p.key === key)) return 'pending';
    return null;
  }

  hide(videoId: string): void {
    this.hidden.add(videoId);
    store.setHiddenAdded(this.hidden);
    this.emit();
  }

  /**
   * Remove a shown song: device copies are removed through the platform
   * (Android TV); a cloud song, or a device song the platform couldn't
   * remove, is hidden on this device instead. Never rejects.
   */
  async remove(videoId: string): Promise<RemoveOutcome> {
    const plan = removalPlan(videoId, this.cloud, this.local);
    const platform = this.platform;
    let removedLocal = false;
    if (plan.localIds.length && platform?.removeLocalAddedSong) {
      const gone = new Set<string>();
      for (const id of plan.localIds) {
        try {
          if (await platform.removeLocalAddedSong(id)) gone.add(id);
        } catch {
          // falls back to hiding below
        }
      }
      if (gone.size) {
        removedLocal = true;
        this.setLocal(this.local.filter((s) => !gone.has(s.videoId)));
      }
    }
    const stillShown = this.published.some((s) => s.videoId === videoId);
    const hidden = stillShown || !removedLocal;
    if (hidden) this.hide(videoId);
    return { removedLocal, hidden };
  }

  unhideAll(): void {
    this.hidden.clear();
    store.setHiddenAdded(this.hidden);
    this.emit();
  }

  /** Android TV: the device's own added songs changed. A song added again is shown again. */
  setLocal(list: AddedSong[]): void {
    if (this.localSynced) {
      const before = new Set(this.local.map((s) => s.videoId));
      let unhid = false;
      for (const s of list) if (!before.has(s.videoId) && this.hidden.delete(s.videoId)) unhid = true;
      if (unhid) store.setHiddenAdded(this.hidden);
    }
    this.localSynced = true;
    this.local = list;
    this.published = mergeLocal(this.cloud, this.local);
    this.emit();
  }

  /** Remember a song that was just sent to GitHub, and start polling. */
  addPending(p: PendingAdd): void {
    const list = store.pendingAdds().filter((x) => x.key !== p.key);
    list.push(p);
    store.setPendingAdds(list);
    // Un-hide it if it was hidden before and is being added again.
    const existing = this.published.find((s) => songKey(s.artist, s.title) === p.key);
    if (existing && this.hidden.delete(existing.videoId)) store.setHiddenAdded(this.hidden);
    this.recompute(Date.now());
    this.schedule();
  }

  removePending(key: string): void {
    store.setPendingAdds(store.pendingAdds().filter((x) => x.key !== key));
    this.recompute(Date.now());
  }

  /** Other waiting songs to send along with a new request (so dropped requests are retried). */
  queueFor(key: string): PendingAdd[] {
    return store.pendingAdds().filter((p) => p.key !== key && this.views.some((v) => v.key === p.key && v.state !== 'failed'));
  }

  /** Fetch songs.json (and songs-status.json while waiting). Never rejects. */
  refresh(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = this.load().finally(() => {
      this.loading = null;
      this.schedule();
    });
    return this.loading;
  }

  private async load(): Promise<void> {
    const now = Date.now();
    const waiting = store.pendingAdds().length > 0;
    const step = waiting ? 30_000 : 10 * 60_000;
    const get = async (url: string) => {
      try {
        const res = await this.fetchFn(bust(url, now, step), { cache: 'no-store' });
        return res.ok ? await res.text() : null;
      } catch {
        return null;
      }
    };
    const [songsText, statusText] = await Promise.all([
      get(songsUrl(this.base)),
      waiting ? get(songsStatusUrl(this.base)) : Promise.resolve(null),
    ]);
    if (songsText !== null) {
      this.cloud = parseSongsList(songsText);
      this.published = mergeLocal(this.cloud, this.local);
    }
    if (statusText !== null) this.status = parseSongsStatus(statusText);
    this.recompute(now);
  }

  private recompute(now: number): void {
    const pending = store.pendingAdds();
    const { appeared, views } = reconcile(pending, this.published, this.status, now);
    if (appeared.length) {
      const gone = new Set(appeared.map((a) => a.pending.key));
      store.setPendingAdds(pending.filter((p) => !gone.has(p.key)));
    }
    this.views = views;
    this.emit();
    for (const a of appeared) this.dispatchEvent(new CustomEvent('appeared', { detail: a.song }));
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const active = this.views.filter((v) => v.state !== 'failed');
    if (!active.length) return;
    const oldest = Math.min(...active.map((v) => v.sentAt));
    this.timer = setTimeout(() => {
      this.timer = null;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; // resumes on visibilitychange
      void this.refresh();
    }, pollDelayMs(Date.now() - oldest));
  }

  /** 'change' only when what the UI shows actually changed (polls usually change nothing). */
  private emit(): void {
    const sig = JSON.stringify([
      this.published.map((s) => [s.videoId, s.title, s.artist]),
      this.views.map((v) => [v.key, v.state, v.message]),
      [...this.hidden].sort(),
    ]);
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.dispatchEvent(new Event('change'));
  }
}

export const addedSongs = new AddedSongs();
