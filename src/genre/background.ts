/**
 * Background genre lookups for songs held on this device: songs added on the
 * Android TV (from the phone page), and any song played here that no
 * published source has genres for (a linked playlist's songs, on the web and
 * the TV). The lookup itself is the shared one (lookup.ts) running in the
 * page; the result goes to `save` (on the TV, the native store through the
 * bridge for its added songs; else the page's own store).
 *
 * Rules:
 *  - runs a while after start-up, shortly after a song is added or played
 *    (`kick`, `prioritize`); at most MAX_PER_RUN songs per run, one song at a
 *    time; with `periodic`, it comes back by itself: soon while songs are
 *    still due, after a backoff (RETRY_MIN_MS doubling to RETRY_MAX_MS) when a
 *    run found every source unreachable, and every RECHECK_MS otherwise (a
 *    failed source falls due after FAILED_RETRY_MS, an empty answer after
 *    NONE_TTL_MS), so a device left on for days still retries;
 *  - never while `busy()` (on the TV: a song is playing or its audio is being
 *    prepared): it waits before every song and before every single request;
 *  - a song is due when it has no stored lookup, a source failed (retried
 *    after FAILED_RETRY_MS) or a 'none' answer expired (NONE_TTL_MS); an
 *    empty or failed lookup is stored as such and retried later, never final;
 *  - order: songs asked for (`prioritize`, e.g. the song just played), then
 *    songs never looked up, then the longest-waiting retries (so songs whose
 *    sources keep failing can't take every slot from new ones);
 *  - a run stops early when every source failed for a song (offline).
 */
import { PoliteHttp, type GenreFetch } from './http';
import { DEFAULT_SOURCES, lookupDue, lookupGenres } from './lookup';
import type { SongQuery } from './match';
import type { GenreLookup } from './types';

export const MAX_PER_RUN = 10;
export const BUSY_POLL_MS = 3000;
/** With `periodic`: the next run while songs are still due, the offline backoff's bounds, and the idle re-check. */
export const RETRY_SOON_MS = 60_000;
export const RETRY_MIN_MS = 2 * 60_000;
export const RETRY_MAX_MS = 60 * 60_000;
export const RECHECK_MS = 30 * 60_000;

export interface LocalSong extends SongQuery {
  videoId: string;
  /** The stored lookup (cache), if any. */
  genreLookup?: GenreLookup | null;
}

export interface GenreRunnerDeps {
  /** Songs added on this device, current state. */
  songs(): LocalSong[];
  /** Persist one song's result; false when the song is gone. */
  save(videoId: string, lookup: GenreLookup): boolean;
  /** True while a song plays or its audio is being prepared. */
  busy(): boolean;
  fetch: GenreFetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  log?: (line: string) => void;
  /** Schedule the next run by itself after each run (see the rules above). */
  periodic?: boolean;
  /**
   * Extra wait before each request (ms), read every time: a background job's pace while a song plays (the runner
   * then keeps to one small request every so often, never a burst beside the dancing).
   */
  pace?: () => number;
}

/**
 * Lookups running now, by video id, whichever runner (or the play screen's wait) started them: a second asker for
 * the same song waits for that one instead of asking the sources again.
 */
const IN_FLIGHT = new Map<string, Promise<GenreLookup>>();

/** The lookup running now for this song, if any. */
export function lookupInFlight(videoId: string): Promise<GenreLookup> | null {
  return IN_FLIGHT.get(videoId) ?? null;
}

/** Run `job` as this song's lookup unless one is running already (then that one's result). */
export function sharedLookup(videoId: string, job: () => Promise<GenreLookup>): Promise<GenreLookup> {
  const hit = IN_FLIGHT.get(videoId);
  if (hit) return hit;
  const p = job().finally(() => {
    if (IN_FLIGHT.get(videoId) === p) IN_FLIGHT.delete(videoId);
  });
  IN_FLIGHT.set(videoId, p);
  return p;
}

export class GenreRunner {
  private running = false;
  private again = false;
  private timer: unknown = null;
  /** Songs asked for, first in the next run. */
  private readonly first = new Set<string>();
  /** The current offline backoff (0 = none). */
  private backoff = 0;
  private readonly http: PoliteHttp;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly d: GenreRunnerDeps) {
    this.sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = d.now ?? (() => Date.now());
    if (!d.setTimer) this.clear = (t) => clearTimeout(t as ReturnType<typeof setTimeout>);
    // No User-Agent from the page (the browser sends its own; a custom header would add a CORS preflight).
    this.http = new PoliteHttp({ fetch: d.fetch, now: this.now, sleep: this.sleep, gate: () => this.whenIdle(), log: d.log });
  }

  /** Wait until nothing is playing. */
  async whenIdle(): Promise<void> {
    while (this.d.busy()) await this.sleep(BUSY_POLL_MS);
    const pace = this.d.pace?.() ?? 0;
    if (pace > 0) {
      await this.sleep(pace);
      while (this.d.busy()) await this.sleep(BUSY_POLL_MS);
    }
  }

  /** Songs that need a lookup now: asked-for first, then never looked up (in list order), then the oldest retries. */
  due(): LocalSong[] {
    const now = new Date(this.now());
    const due = this.d.songs().filter((s) => s.artist.trim() && s.title.trim() && lookupDue(s.genreLookup, now));
    const rank = (s: LocalSong) => (this.first.has(s.videoId) ? 0 : s.genreLookup ? 2 : 1);
    const at = (s: LocalSong) => Date.parse(s.genreLookup?.at ?? '') || 0;
    return due.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || (rank(a.s) === 2 ? at(a.s) - at(b.s) : 0) || a.i - b.i).map((x) => x.s);
  }

  /** Look this song up first on the next run (it was just played), and start one soon. */
  prioritize(videoId: string, delayMs = 3000): void {
    this.first.add(videoId);
    this.kick(delayMs);
  }

  /** Start a run after `delayMs` (one at a time; a kick during a run queues one more). */
  kick(delayMs = 3000): void {
    if (this.running) {
      this.again = true;
      return;
    }
    if (this.timer !== null) {
      // A sooner run replaces a scheduled later one (a periodic re-check, a backoff).
      if (this.timerAt <= this.now() + delayMs) return;
      this.clear?.(this.timer);
    }
    const set = this.d.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
    this.timerAt = this.now() + delayMs;
    this.timer = set(() => {
      this.timer = null;
      void this.run();
    }, delayMs);
  }
  private timerAt = 0;
  /** Cancels a scheduled run (the default timer only; injected timers can't be cancelled and simply run). */
  private clear: ((t: unknown) => void) | null = null;

  /** One pass. Returns how many songs were saved. */
  async run(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let saved = 0;
    let offline = false;
    try {
      for (const s of this.due().slice(0, MAX_PER_RUN)) {
        await this.whenIdle();
        const current = this.d.songs().find((x) => x.videoId === s.videoId);
        if (!current) continue;
        const l = await sharedLookup(current.videoId, () => lookupGenres(current, { http: this.http, previous: current.genreLookup ?? null, now: () => new Date(this.now()) }));
        this.first.delete(current.videoId);
        if (this.d.save(current.videoId, l)) saved++;
        this.d.log?.(`[dd:genres] ${current.artist} - ${current.title}: ${l.genres.join(', ') || 'none'}${l.complete ? '' : ' (some sources failed; retried later)'}`);
        // Only a source that had to ask over the network says whether we are online (the title needs no request).
        const answered = DEFAULT_SOURCES.some((src) => !src.local && l.sources[src.id] && l.sources[src.id]!.status !== 'failed');
        if (!answered) {
          offline = true;
          break; // offline or blocked everywhere: try again on a later run
        }
      }
    } catch (e) {
      this.d.log?.(`[dd:genres] run failed: ${String((e as Error)?.message ?? e)}`);
    } finally {
      this.running = false;
    }
    if (this.again) {
      this.again = false;
      this.kick();
    } else if (this.d.periodic) {
      this.backoff = offline ? Math.min(RETRY_MAX_MS, Math.max(RETRY_MIN_MS, 2 * this.backoff)) : 0;
      this.kick(offline ? this.backoff : this.due().length ? RETRY_SOON_MS : RECHECK_MS);
    }
    return saved;
  }
}
