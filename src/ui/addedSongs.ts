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
 * A request GitHub dropped without the job ever answering for the song (see
 * `dropped` in reconcile) is sent again by the app itself, the same way "Send
 * again" does, a few times at most (autoResendAt), and only while the page is visible.
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
import { SITE_GRACE_MS, type RunSummary } from '../platform/pipelineHealth';
import { getPlatform, type Platform } from '../platform/platform';
import { explainRelayError } from '../platform/relay';
import { matchRun, songProgress, type Progress } from '../platform/songProgress';
import { store, type PendingAdd } from '../store';

/**
 * 'site-failed': the beat map was made and committed, but the site didn't
 * publish it (sending again wouldn't help: the fix is on GitHub).
 * 'check': the video the person chose doesn't look like the song (songs-status.json
 * 'video-mismatch'); nothing was added, and they may say "Use it anyway".
 */
export type PendingState = 'waiting' | 'slow' | 'retrying' | 'failed' | 'site-failed' | 'check';

/** States that wait for the person, not the cloud: not polled, not re-sent with other songs. */
export const WAITING_FOR_PERSON: readonly PendingState[] = ['failed', 'check'];

export interface PendingView extends PendingAdd {
  state: PendingState;
  /** User-facing sentence. */
  message: string;
  /** The cloud found no usable video: the person may paste a YouTube link instead. */
  canPaste?: boolean;
  /** 'check' (and a refused link): the video the cloud checked. */
  checkedVideo?: string;
  /** Stage, percentage and time left, when the job's progress is known (see songProgress). */
  progress?: Progress;
  /** GitHub dropped the request without the job answering for this song (see reconcile). */
  dropped?: DropReason;
  /** With `dropped`: when the app sends it again by itself (epoch ms); absent once it won't. */
  autoAt?: number;
}

/**
 * Why a request counts as dropped: the run that would have handled it was cancelled (GitHub keeps one
 * waiting run per group and cancels it for a newer request, maybe another person's), the job failed
 * before adding it, or the job finished well without adding it or saying why.
 */
export type DropReason = 'cancelled' | 'failed' | 'finished';

/**
 * What the cloud says beyond the live site's files (src/ui/songHealth.ts
 * gathers it): the latest runs, and the repository's own songs.json, which
 * has a new song as soon as its beat map is committed, before the site is rebuilt.
 */
export interface CloudFacts {
  /** null: GitHub couldn't be asked (rate-limited, offline). */
  runs: RunSummary[] | null;
  /** null: the repository's songs.json couldn't be read. */
  repoSongs: AddedSong[] | null;
  /** When each pending song (by key) was first seen in the repository. */
  inRepoSince: Readonly<Record<string, number>>;
  /** The highest percentage shown so far per pending song. */
  floors?: Readonly<Record<string, number>>;
  /** When `runs` was fetched (epoch ms); a list from before a send can't show that send's run. */
  runsAt?: number;
  /**
   * Present when this page can send dropped songs again by itself; `stopped`: songs it won't this
   * session (an automatic send got an answer the person must act on), with that answer.
   */
  auto?: { stopped: Readonly<Record<string, string>> };
}

/**
 * Automatic resends of one dropped song. Each one can itself cancel someone else's waiting request,
 * so this stays small: three drops in a row mean something the person should see (a busy evening,
 * a job that keeps failing), and the manual "Send again" is still there.
 */
export const AUTO_RESEND_CAP = 3;
/**
 * Wait before automatic resend n (0-based), counted from when the drop became known. At least 2 min:
 * the new request is then well clear of the dropped run's time window (matchRun allows 90 s), and
 * the runs list (cached 1-2 min) has time to show it; then longer, as a busy group calms down.
 */
export const AUTO_BACKOFF_MS = [2 * 60_000, 5 * 60_000, 10 * 60_000] as const;
/** Up to this much is added to each wait, different per browser and per song, so people dropped together don't resend together. */
export const AUTO_JITTER_MS = 60_000;
/** An automatic send that didn't get through (offline, relay unreachable) is tried again after this, without counting. */
export const AUTO_RETRY_MS = 2 * 60_000;
/** The runs list must be this much younger than the send before a drop counts for an automatic resend. */
const RUNS_SETTLE_MS = 60_000;

const DROP_TEXT: Record<DropReason, string> = {
  cancelled: 'GitHub dropped this request because another song was sent at about the same time.',
  failed: 'The song job failed before it could add this song.',
  finished: 'The song job finished, but this song wasn’t added.',
};
const AUTO_TEXT = 'It’s sent again by itself in a few minutes.';

/** Stable 0..AUTO_JITTER_MS-1 per song, send and attempt (sentAt differs per browser; survives reloads). */
export function autoJitter(p: Pick<PendingAdd, 'key' | 'sentAt'>, attempt: number): number {
  let h = 0x811c9dc5;
  for (const c of `${p.key}|${p.sentAt}|${attempt}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h % AUTO_JITTER_MS;
}

/**
 * Pure: when a song dropped at `droppedAt` is sent again by itself, or null when it isn't any more
 * (cap reached, or the relay's daily limit). A try that didn't get through waits AUTO_RETRY_MS.
 */
export function autoResendAt(p: PendingAdd, droppedAt: number): number | null {
  const n = p.autoResends ?? 0;
  if (p.autoStop || n >= AUTO_RESEND_CAP) return null;
  const due = Math.max(droppedAt, p.sentAt) + AUTO_BACKOFF_MS[Math.min(n, AUTO_BACKOFF_MS.length - 1)] + autoJitter(p, n);
  return p.autoTriedAt ? Math.max(due, p.autoTriedAt + AUTO_RETRY_MS) : due;
}

/** What an automatic send's failure means: 'later' (never got through: not counted), 'count' (try again, counted), 'stop'. */
export function autoFailure(error: string): 'later' | 'count' | 'daily-limit' | 'stop' {
  if (error === 'network') return 'later';
  if (error === 'daily-limit') return 'daily-limit';
  // The relay couldn't look the song up, or the relay or GitHub had a hiccup (token path: GitHub's rate limit or 5xx).
  if (error === 'lookup-failed' || error === 'server' || error === 'rate-limit') return 'count';
  // passphrase, not connected, old relay, refused requests: the person has to act.
  return 'stop';
}

/** After this long without the song appearing, say so and offer to send again. */
export const SLOW_AFTER_MS = 15 * 60_000;
/** A cloud status older than the send (minus clock skew) belongs to an earlier attempt. */
const SKEW_MS = 2 * 60_000;
/** A run that finished well this long ago without the song in the repository didn't add it (raw files are cached up to 5 min). */
const FINISHED_WITHOUT_MS = 6 * 60_000;

/** The song a pending request became, in a songs.json list (by key, or by the video its map-pending note names). */
export function findAdded(list: readonly AddedSong[], p: PendingAdd, st: SongRequestStatus | undefined): AddedSong | undefined {
  return (
    list.find((s) => songKey(s.artist, s.title) === p.key) ??
    (st?.state === 'map-pending' && st.videoId ? list.find((s) => s.videoId === st.videoId) : undefined)
  );
}

/**
 * Pure: which pending songs have appeared, and how to describe the rest.
 * With `facts` it also follows the job itself: progress, a job that failed,
 * or a song that was made but didn't reach the site.
 */
export function reconcile(
  pending: PendingAdd[],
  published: AddedSong[],
  status: Readonly<Record<string, SongRequestStatus>>,
  now: number,
  facts?: CloudFacts,
): { appeared: { pending: PendingAdd; song: AddedSong }[]; views: PendingView[] } {
  const appeared: { pending: PendingAdd; song: AddedSong }[] = [];
  const views: PendingView[] = [];
  for (const p of pending) {
    const st = status[p.key];
    // Listed under slightly different names than requested: the 'map-pending' note says which video.
    const song = findAdded(published, p, st);
    if (song) {
      appeared.push({ pending: p, song });
      continue;
    }
    const fresh = st && Date.parse(st.lastTried) >= p.sentAt - SKEW_MS;
    const inRepo = facts?.repoSongs ? !!findAdded(facts.repoSongs, p, st) : false;
    const inRepoSince = inRepo ? (facts!.inRepoSince[p.key] ?? now) : null;
    const run = facts ? matchRun(facts.runs, p.sentAt, inRepo) : null;
    const progress = facts
      ? songProgress({ now, sentAt: p.sentAt, run, runsKnown: !!facts.runs, otherRunning: otherRunning(facts.runs, run), inRepoSince, live: false, floor: facts.floors?.[p.key] })
      : undefined;
    const withProgress = progress ? { progress } : {};
    /**
     * A dropped request: the manual view (today's message and "Send again"), unless the app sends it
     * again by itself. Only with the repository's songs.json read (so it isn't there already) and a
     * runs list from after this send (matchRun then saw every run since: none of them is still going,
     * including any later request from this browser, which carries the song along).
     */
    const drop = (reason: DropReason, droppedAt: number, manual: PendingView): PendingView => {
      const out: PendingView = { ...manual, dropped: reason };
      if (!facts?.auto) return out;
      const auto = facts.auto;
      if (p.autoStop === 'daily-limit') return { ...out, message: explainRelayError('daily-limit').message };
      const stopped = auto.stopped[p.key];
      if (stopped) return { ...out, message: stopped };
      const settled = facts.runsAt === undefined || facts.runsAt >= p.sentAt + RUNS_SETTLE_MS;
      const at = facts.repoSongs && settled ? autoResendAt(p, droppedAt) : null;
      if (at === null) return out;
      return { ...p, state: 'retrying', message: `${DROP_TEXT[reason]} ${AUTO_TEXT}`, dropped: reason, autoAt: at };
    };
    const ended = run ? Date.parse(run.updatedAt) || now : now;
    // An answer about a video counts only for that choice: a link pasted (or "Use it anyway" sent)
    // a moment after it must not show it again.
    const sameChoice = !st || (st.videoId ?? undefined) === (p.videoId ?? undefined) || (!p.videoId && st.state === 'not-found');
    if (fresh && st.state === 'not-found' && sameChoice) {
      views.push({
        ...p,
        state: 'failed',
        message: st.message || 'The cloud couldn’t find a YouTube video of this song that it can use.',
        canPaste: true,
        ...(st.videoId ? { checkedVideo: st.videoId } : {}),
      });
    } else if (fresh && st.state === 'video-mismatch' && st.videoId && (!p.videoId || p.videoId === st.videoId) && !p.force) {
      views.push({
        ...p,
        state: 'check',
        message: st.message || 'This video doesn’t look like the song.',
        canPaste: true,
        checkedVideo: st.videoId,
      });
    } else if (progress?.failure === 'site' || (inRepoSince !== null && now - inRepoSince > SITE_GRACE_MS)) {
      views.push({
        ...p,
        state: 'site-failed',
        message:
          progress?.failure === 'site'
            ? 'Its beat map is ready, but the site didn’t update, so it isn’t here yet. Options → Songs says what to do.'
            : 'Its beat map is ready, but the site hasn’t updated for a while. Options → Songs says what to do.',
        ...withProgress,
      });
    } else if (fresh && st.state === 'blocked') {
      views.push({ ...p, state: 'retrying', message: 'YouTube is blocking the cloud job for now. It tries again by itself within a few hours.' });
    } else if (fresh && st.state === 'error') {
      views.push({ ...p, state: 'retrying', message: 'Something went wrong in the cloud job. It tries again by itself within a few hours.' });
    } else if (progress?.failure === 'job') {
      views.push(drop('failed', ended, { ...p, state: 'failed', message: 'The song job failed before it could add this song. Options → Songs says why.', ...withProgress }));
    } else if (run && run.status === 'completed' && run.conclusion === 'cancelled' && facts?.repoSongs && !inRepo) {
      // matchRun picks a finished run only when no run since the send is still going.
      views.push(drop('cancelled', ended, { ...p, state: 'slow', message: `${DROP_TEXT.cancelled} Send it again to retry.` }));
    } else if (run && run.status === 'completed' && run.conclusion === 'success' && facts?.repoSongs && !inRepo && now - Date.parse(run.updatedAt) > FINISHED_WITHOUT_MS) {
      views.push(drop('finished', ended + FINISHED_WITHOUT_MS, { ...p, state: 'slow', message: 'The song job finished, but this song wasn’t added. Send it again to retry.' }));
    } else if (now - p.sentAt > SLOW_AFTER_MS && !inRepo && !(run && run.status !== 'completed')) {
      views.push({
        ...p,
        state: 'slow',
        message: 'This is taking longer than usual. GitHub may have dropped the request if several were sent at once.',
      });
    } else if (progress) {
      views.push({ ...p, state: 'waiting', message: `${progress.label}: ${progress.percent}%${progress.eta ? `, ${progress.eta}` : ''}`, progress });
    } else {
      views.push({ ...p, state: 'waiting', message: 'Being added… usually 3–5 minutes' });
    }
  }
  return { appeared, views };
}

/** Whether a Beat maps run other than `mine` is going (a queued run waits for it). */
function otherRunning(runs: RunSummary[] | null, mine: RunSummary | null): boolean {
  return !!runs?.some((r) => r.workflow === 'beatmaps' && r.status === 'in_progress' && r.id !== mine?.id);
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

/** What sending a song again answers (githubConnect's SendResult). */
export type AutoSendResult = { ok: true } | { ok: false; error: string; message: string };
/** Sends a dropped song again, the way "Send again" does (set by githubConnect.ts). */
export type AutoSender = (p: PendingAdd) => Promise<AutoSendResult>;

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
  /** From songHealth: runs and the repository's files (undefined until it has looked). */
  private facts: { runs: RunSummary[] | null; runsAt?: number; repoSongs: AddedSong[] | null; repoRequests: Record<string, SongRequestStatus> | null } | undefined;
  private seenInRepo: Record<string, number> = {};
  private floors: Record<string, number> = {};
  private ticker: ReturnType<typeof setInterval> | null = null;
  private hidden = store.hiddenAdded();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private loading: Promise<void> | null = null;
  private base = './';
  private started = false;
  private lastSig = '';
  private platform: Platform | null = null;
  private autoSend: AutoSender | null = null;
  /** Songs not sent again by themselves this session, with the answer that stopped it. */
  private autoStopped: Record<string, string> = {};
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private autoBusy = false;
  /** A few seconds more per tab, so two tabs of one browser don't send the same song at once. */
  private readonly tabDelay = Math.floor(Math.random() * 10_000);

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

  /**
   * The added-song entry whose genres a song is danced by: the shown entry when it has genres, else any copy of the
   * same song that does (hidden on this device, or the TV's own copy that mergeLocal folded into a cloud entry the
   * cloud's lookup found nothing for: same video, or same artist + title). Null when no copy has genres.
   */
  genreEntry(videoId: string): AddedSong | null {
    const has = (s: AddedSong | undefined | null): boolean => !!s?.genres?.length;
    const shown = this.find(videoId);
    if (shown && has(shown)) return shown;
    const any = this.published.find((s) => s.videoId === videoId);
    if (any && has(any)) return any;
    const key = any ? songKey(any.artist, any.title) : null;
    return this.local.find((s) => has(s) && (s.videoId === videoId || (key !== null && songKey(s.artist, s.title) === key))) ?? null;
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
    delete this.autoStopped[p.key];
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
    delete this.autoStopped[key];
    store.setPendingAdds(store.pendingAdds().filter((x) => x.key !== key));
    this.recompute(Date.now());
  }

  /** Other waiting songs to send along with a new request (so dropped requests are retried). */
  queueFor(key: string): PendingAdd[] {
    return store.pendingAdds().filter((p) => p.key !== key && this.views.some((v) => v.key === p.key && !WAITING_FOR_PERSON.includes(v.state)));
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

  /**
   * songHealth's latest look at the cloud: runs (null when GitHub couldn't be
   * asked) and the repository's songs.json / songs-status.json (null when unread).
   */
  setCloudFacts(f: { runs: RunSummary[] | null; runsAt?: number; repoSongs: AddedSong[] | null; repoRequests: Record<string, SongRequestStatus> | null }): void {
    const now = Date.now();
    if (f.repoSongs) {
      for (const p of store.pendingAdds()) {
        if (!(p.key in this.seenInRepo) && findAdded(f.repoSongs, p, (f.repoRequests ?? this.status)[p.key])) this.seenInRepo[p.key] = now;
      }
    }
    this.facts = f;
    this.recompute(now);
    this.schedule();
  }

  /** Whether any song is still on its way (songHealth polls the cloud only then). */
  hasPending(): boolean {
    return store.pendingAdds().length > 0;
  }

  private recompute(now: number): void {
    const pending = store.pendingAdds();
    // The repository's songs-status.json is newer than the site's when the site is behind.
    const status = this.facts?.repoRequests ? { ...this.status, ...this.facts.repoRequests } : this.status;
    const facts: CloudFacts | undefined = this.facts && {
      runs: this.facts.runs,
      repoSongs: this.facts.repoSongs,
      inRepoSince: this.seenInRepo,
      floors: this.floors,
      ...(this.facts.runsAt !== undefined ? { runsAt: this.facts.runsAt } : {}),
      ...(this.autoSend ? { auto: { stopped: this.autoStopped } } : {}),
    };
    const { appeared, views } = reconcile(pending, this.published, status, now, facts);
    if (appeared.length) {
      const gone = new Set(appeared.map((a) => a.pending.key));
      store.setPendingAdds(pending.filter((p) => !gone.has(p.key)));
    }
    const keys = new Set(views.map((v) => v.key));
    for (const k of Object.keys(this.floors)) if (!keys.has(k)) delete this.floors[k];
    for (const k of Object.keys(this.seenInRepo)) if (!keys.has(k)) delete this.seenInRepo[k];
    for (const v of views) if (v.progress && v.progress.stage !== 'failed') this.floors[v.key] = Math.max(this.floors[v.key] ?? 0, v.progress.percent);
    this.views = views;
    if (!views.length && this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    this.emit();
    for (const a of appeared) this.dispatchEvent(new CustomEvent('appeared', { detail: a.song }));
    this.scheduleAuto();
  }

  /** How dropped songs are sent again (githubConnect.ts); without one they wait for "Send again". */
  setAutoSend(fn: AutoSender | null): void {
    this.autoSend = fn;
    if (this.started) this.recompute(Date.now());
  }

  /** Wake up when the first dropped song is due to be sent again; a hidden page waits until it is shown. */
  private scheduleAuto(): void {
    if (this.autoTimer !== null) clearTimeout(this.autoTimer);
    this.autoTimer = null;
    if (!this.autoSend || this.autoBusy) return;
    const due = this.views.filter((v) => v.autoAt !== undefined).map((v) => v.autoAt!);
    if (!due.length) return;
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; // resumes on visibilitychange
      void this.sendDue();
    }, Math.max(0, Math.min(...due) - Date.now()) + this.tabDelay);
  }

  /** Send the most overdue dropped song again (one at a time; it carries the other waiting songs along). */
  private async sendDue(): Promise<void> {
    const send = this.autoSend;
    if (!send || this.autoBusy) return;
    const now = Date.now();
    const v = this.views.filter((x) => x.autoAt !== undefined && x.autoAt <= now).sort((a, b) => a.autoAt! - b.autoAt!)[0];
    if (!v) return this.scheduleAuto();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // Offline: look again in a minute (not counted, nothing sent).
      this.autoTimer = setTimeout(() => this.scheduleAuto(), 60_000);
      return;
    }
    // Read it again: another tab may have sent it (new sentAt) or be sending it (autoTriedAt) meanwhile.
    const list = store.pendingAdds();
    const p = list.find((x) => x.key === v.key);
    if (!p || p.sentAt !== v.sentAt || (p.autoResends ?? 0) !== (v.autoResends ?? 0) || (p.autoTriedAt && now - p.autoTriedAt < AUTO_RETRY_MS)) {
      return this.recompute(now);
    }
    this.patchStored(p, { autoTriedAt: now });
    this.autoBusy = true;
    let res: AutoSendResult;
    try {
      res = await send({ ...p, autoTriedAt: now });
    } catch {
      res = { ok: false, error: 'network', message: '' };
    }
    this.autoBusy = false;
    // On success the sender replaced it (addPending, with a new sentAt and one more autoResends).
    const still = store.pendingAdds().find((x) => x.key === p.key);
    if (!res.ok && still && still.sentAt === p.sentAt) {
      const what = autoFailure(res.error);
      if (what === 'count') this.patchStored(still, { autoResends: (still.autoResends ?? 0) + 1 });
      else if (what === 'daily-limit') this.patchStored(still, { autoStop: 'daily-limit' });
      else if (what === 'stop') this.autoStopped[p.key] = res.message;
    }
    this.recompute(Date.now());
    this.schedule();
  }

  /** Update one stored pending song (only if it is still that send). */
  private patchStored(p: PendingAdd, patch: Partial<PendingAdd>): void {
    store.setPendingAdds(store.pendingAdds().map((x) => (x.key === p.key && x.sentAt === p.sentAt ? { ...x, ...patch } : x)));
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const active = this.views.filter((v) => !WAITING_FOR_PERSON.includes(v.state));
    // The bar and time left move between polls: redraw from what is known every 15 s (no network).
    const ticking = active.some((v) => v.progress && v.state === 'waiting');
    if (ticking && this.ticker === null) {
      this.ticker = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') this.recompute(Date.now());
      }, 15_000);
    } else if (!ticking && this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
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
