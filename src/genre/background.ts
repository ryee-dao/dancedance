/**
 * Background genre lookups for songs added on this device (the Android TV:
 * songs added from the phone page). The lookup itself is the shared one
 * (lookup.ts) running in the page; the result goes to `save`, which on the TV
 * hands it to the native store through the bridge so it stays with the song.
 *
 * Rules:
 *  - runs a while after start-up, and shortly after a song is added
 *    (`kick`); at most MAX_PER_RUN songs per run, one song at a time;
 *  - never while `busy()` (a song is playing or its audio is being prepared):
 *    it waits before every song and before every single request;
 *  - a song is due when it has no stored lookup, a source failed (retried
 *    after FAILED_RETRY_MS) or a 'none' answer expired (NONE_TTL_MS); an
 *    empty or failed lookup is stored as such and retried later, never final;
 *  - a run stops early when every source failed for a song (offline).
 */
import { PoliteHttp, type GenreFetch } from './http';
import { DEFAULT_SOURCES, lookupDue, lookupGenres } from './lookup';
import type { SongQuery } from './match';
import type { GenreLookup } from './types';

export const MAX_PER_RUN = 10;
export const BUSY_POLL_MS = 3000;

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
}

export class GenreRunner {
  private running = false;
  private again = false;
  private timer: unknown = null;
  private readonly http: PoliteHttp;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly d: GenreRunnerDeps) {
    this.sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = d.now ?? (() => Date.now());
    // No User-Agent from the page (the browser sends its own; a custom header would add a CORS preflight).
    this.http = new PoliteHttp({ fetch: d.fetch, now: this.now, sleep: this.sleep, gate: () => this.whenIdle(), log: d.log });
  }

  /** Wait until nothing is playing. */
  async whenIdle(): Promise<void> {
    while (this.d.busy()) await this.sleep(BUSY_POLL_MS);
  }

  /** Songs that need a lookup now, oldest first. */
  due(): LocalSong[] {
    const now = new Date(this.now());
    return this.d.songs().filter((s) => s.artist.trim() && s.title.trim() && lookupDue(s.genreLookup, now));
  }

  /** Start a run after `delayMs` (one at a time; a kick during a run queues one more). */
  kick(delayMs = 3000): void {
    if (this.running) {
      this.again = true;
      return;
    }
    if (this.timer !== null) return;
    const set = this.d.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
    this.timer = set(() => {
      this.timer = null;
      void this.run();
    }, delayMs);
  }

  /** One pass. Returns how many songs were saved. */
  async run(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let saved = 0;
    try {
      for (const s of this.due().slice(0, MAX_PER_RUN)) {
        await this.whenIdle();
        const current = this.d.songs().find((x) => x.videoId === s.videoId);
        if (!current) continue;
        const l = await lookupGenres(current, { http: this.http, previous: current.genreLookup ?? null, now: () => new Date(this.now()) });
        if (this.d.save(current.videoId, l)) saved++;
        this.d.log?.(`[dd:genres] ${current.artist} - ${current.title}: ${l.genres.join(', ') || 'none'}${l.complete ? '' : ' (some sources failed; retried later)'}`);
        // Only a source that had to ask over the network says whether we are online (the title needs no request).
        const answered = DEFAULT_SOURCES.some((src) => !src.local && l.sources[src.id] && l.sources[src.id]!.status !== 'failed');
        if (!answered) break; // offline or blocked everywhere: try again on a later run
      }
    } catch (e) {
      this.d.log?.(`[dd:genres] run failed: ${String((e as Error)?.message ?? e)}`);
    } finally {
      this.running = false;
    }
    if (this.again) {
      this.again = false;
      this.kick();
    }
    return saved;
  }
}
