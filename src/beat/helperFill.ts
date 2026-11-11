/**
 * Background fill: while the app is open and the helper app is running,
 * quietly find the beat of songs that still have no cloud map (playlist,
 * then added songs, then the starter pack), one at a time: get the audio
 * from the helper, analyse it in a Worker, cache the map and hand it to the
 * shared uploader.
 *
 * Polite by design: one song at most every INTERVAL_MS, at most MAX_PER_OPEN
 * per app open, paused (and the current song abandoned) while a song is
 * playing, and it stops for this app open when YouTube blocks the helper,
 * yt-dlp is out of date, or several songs in a row fail.
 */
import type { BeatMap } from '../core/analysis';
import type { HelperCode, LocalHelper } from '../platform/helper';
import { analyzeAudio } from './analyzeAudio';
import { beatCache } from './cache';
import { absoluteBase } from './cloud';
import { queueMapUpload } from './shareMap';

export const INTERVAL_MS = 25_000;
export const MAX_PER_OPEN = 20;
const MAX_FAILS_IN_A_ROW = 3;

export interface FillState {
  /** Songs mapped this app open. */
  done: number;
  /** Songs still waiting (null until the first look). */
  remaining: number | null;
  /** Song being worked on. */
  current: string | null;
  /** Why it stopped for this app open, if it did. */
  stopped: null | 'blocked' | 'outdated' | 'errors' | 'limit';
  paused: boolean;
}

export interface FillDeps {
  helper: LocalHelper;
  /** Candidate video IDs in priority order. */
  candidates(): string[];
  /** Video IDs that have a cloud map (null while unknown: then nothing runs). */
  cloudIds(): Promise<Set<string> | null>;
  /** A complete map is already cached here. */
  hasFullMap(videoId: string): Promise<boolean>;
  /** Decode + analyse (source 'device'); cancellable. */
  analyze(buf: ArrayBuffer, videoId: string): { promise: Promise<BeatMap>; cancel(): void };
  /** Cache and share a finished map. */
  save(map: BeatMap): void;
  intervalMs?: number;
  maxPerOpen?: number;
}

export class HelperFill extends EventTarget {
  private st: FillState = { done: 0, remaining: null, current: null, stopped: null, paused: false };
  private holds = 0;
  private tried = new Set<string>();
  private fails = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private job: { abort: AbortController; cancel?: () => void } | null = null;
  private running = false;

  constructor(private readonly d: FillDeps) {
    super();
  }

  state(): FillState {
    return this.st;
  }

  private set(s: Partial<FillState>): void {
    this.st = { ...this.st, ...s };
    this.dispatchEvent(new Event('change'));
  }

  start(): void {
    if (this.timer === null && !this.st.stopped) this.schedule(this.d.intervalMs ?? INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.abandon();
  }

  /** A song is playing: pause and abandon the current background song. Returns the release. */
  hold(): () => void {
    this.holds++;
    this.abandon();
    this.set({ paused: true });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds--;
      if (this.holds === 0) this.set({ paused: false });
    };
  }

  private abandon(): void {
    const j = this.job;
    if (!j) return;
    this.job = null;
    j.abort.abort();
    j.cancel?.();
  }

  private schedule(ms: number): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.step().finally(() => {
        if (!this.st.stopped) this.schedule(this.d.intervalMs ?? INTERVAL_MS);
      });
    }, ms);
  }

  /** One round: pick the next song and map it (exposed for tests). */
  async step(): Promise<void> {
    if (this.running || this.holds > 0 || this.st.stopped) return;
    this.running = true;
    try {
      if (this.st.done >= (this.d.maxPerOpen ?? MAX_PER_OPEN)) return this.set({ stopped: 'limit' });
      if (!(await this.d.helper.available())) return;
      const cloud = await this.d.cloudIds();
      if (!cloud) return;
      const waiting: string[] = [];
      for (const id of new Set(this.d.candidates())) {
        if (cloud.has(id) || this.tried.has(id)) continue;
        if (await this.d.hasFullMap(id)) continue;
        waiting.push(id);
      }
      this.set({ remaining: waiting.length });
      const id = waiting[0];
      if (!id || this.holds > 0) return;
      this.tried.add(id);
      const job: { abort: AbortController; cancel?: () => void } = { abort: new AbortController() };
      this.job = job;
      this.set({ current: id });
      try {
        const buf = await this.d.helper.fetchAudio(id, { signal: job.abort.signal });
        if (this.job !== job) throw abandoned();
        const a = this.d.analyze(buf, id);
        job.cancel = a.cancel;
        const map = await a.promise;
        if (this.job !== job) throw abandoned();
        this.d.save(map);
        this.fails = 0;
        this.set({ done: this.st.done + 1, remaining: Math.max(0, waiting.length - 1) });
        console.info('[dd:fill] mapped', id, `(${this.st.done} this time)`);
      } catch (err) {
        const code = (err as { code?: HelperCode | 'abandoned' }).code;
        if (code === 'abandoned' || code === 'aborted') {
          this.tried.delete(id); // a song started playing; try it again later
          return;
        }
        console.info('[dd:fill] could not map', id, code ?? err);
        if (code === 'blocked' || code === 'outdated') return this.set({ stopped: code });
        if (code === 'unavailable') return; // that video only
        if (++this.fails >= MAX_FAILS_IN_A_ROW) this.set({ stopped: 'errors' });
      } finally {
        if (this.job === job) this.job = null;
        this.set({ current: null });
      }
    } finally {
      this.running = false;
    }
  }
}

function abandoned(): Error {
  return Object.assign(new Error('abandoned'), { code: 'abandoned' as const });
}

/** One plain line for Options, or null when there is nothing to say. */
export function describeFill(s: FillState): string | null {
  if (s.stopped === 'blocked') return 'Background beat-finding paused: YouTube is asking this computer to prove it isn’t a bot.';
  if (s.stopped === 'outdated') return 'Background beat-finding paused until the helper updates its downloader.';
  if (s.stopped === 'errors') return 'Background beat-finding stopped after a few failures. It tries again next time you open DanceDance.';
  if (s.current) return `Finding beats in the background… (${s.done} done${s.remaining ? `, ${s.remaining} to go` : ''})`;
  if (s.remaining === 0) return s.done ? `Every song has a beat map (${s.done} found in the background).` : null;
  if (s.done || s.remaining) return `Finding beats in the background: ${s.done} done${s.remaining ? `, ${s.remaining} to go` : ''}${s.paused ? ' (paused while you dance)' : ''}.`;
  return null;
}

// ---------------------------------------------------------------------------
// App-wide instance (web with the helper only).

let shared: HelperFill | null = null;

export function setBackgroundFill(f: HelperFill | null): void {
  shared = f;
}

export function backgroundFill(): HelperFill | null {
  return shared;
}

/** BeatSession calls this while a song is on screen. */
export function holdBackgroundFill(): () => void {
  return shared ? shared.hold() : () => {};
}

/** The real dependencies: cloud index, local cache, Worker analysis, shared uploader. */
export function createBackgroundFill(beatmapBase: string, helper: LocalHelper, candidates: () => string[]): HelperFill {
  let idsP: Promise<Set<string> | null> | null = null;
  return new HelperFill({
    helper,
    candidates,
    cloudIds: () => {
      idsP ??= fetch(new URL('beatmaps/index.json', absoluteBase(beatmapBase)).href, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { ids?: unknown } | null) => (j && Array.isArray(j.ids) ? new Set(j.ids.filter((x): x is string => typeof x === 'string')) : null))
        .catch(() => null)
        .then((s) => {
          if (!s) idsP = null; // try again next round
          return s;
        });
      return idsP;
    },
    hasFullMap: async (id) => {
      const m = await beatCache().get(id);
      return !!m && !m.partial;
    },
    analyze: (buf, id) => {
      const a = analyzeAudio(buf, { key: id, source: 'device', budgetMs: 10 * 60_000 });
      return { promise: a.full, cancel: a.cancel };
    },
    save: (map) => {
      void beatCache().offer(map.videoId, map);
      console.info('[dd:fill] share:', queueMapUpload(map, { existingSource: null }));
    },
  });
}
