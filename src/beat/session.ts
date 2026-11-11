/**
 * Beat sync for one song on the play screen: decides where beats come from
 * and keeps the BeatSource up to date.
 *
 *  YouTube song: local cache -> cloud map (fetched in parallel with the
 *                player start) -> live fallback (tab audio if already shared,
 *                else the microphone, with a one-time explainer).
 *  Dropped file: local cache -> whole-file analysis in a Worker (progress on
 *                the starting screen; first 30 s if it takes too long).
 *
 * A partial map is used where it reaches, while live listening fills in the
 * rest. Live recordings covering >= 45 s are saved when the song ends.
 */
import type { BeatMap, BeatMapSource } from '../core/analysis';
import type { Platform } from '../platform/platform';
import type { PlayItem } from '../player/types';
import { store } from '../store';
import { LiveError, type Capture } from '../live/capture';
import type { LiveDevices } from '../live/devices';
import { LiveTracker, MIN_SAVE_SECONDS, type LiveClock } from '../live/liveTracker';
import { micPermission } from '../live/mic';
import { micLatency, tabLatency } from '../live/timeMap';
import { analyzeAudio } from './analyzeAudio';
import { BeatHub } from './beatHub';
import type { BeatSource } from './beatSource';
import { beatCache, fileKey, isBetterMap, type BeatMapCache } from './cache';
import { cloudStatus, describeCloudStatus, fetchCloudMap } from './cloud';
import { resolveBeatMap } from './resolve';

export type NoSyncReason = 'off' | 'denied' | 'unsupported' | 'no-device' | 'no-beat' | 'error';

export type SyncStatus =
  | { kind: 'resolving' }
  | { kind: 'analyzing'; progress: number }
  | { kind: 'map'; source: BeatMapSource; partial: boolean; listening: 'mic' | 'tab' | null; refining: number | null }
  | { kind: 'live'; mode: 'mic' | 'tab'; locked: boolean; bpm: number }
  | { kind: 'none'; reason: NoSyncReason };

export interface SessionClock extends LiveClock {
  /** Song duration (s), 0 while unknown. */
  duration(): number;
}

/** How long prepare() waits for the cache/cloud lookup before the countdown. */
const RESOLVE_WAIT_MS = 1500;

export class BeatSession {
  readonly key: string;
  readonly videoId: string | null;
  private readonly hub = new BeatHub();
  private readonly cache: BeatMapCache;
  private tracker: LiveTracker | null = null;
  private resolving = true;
  private progress: number | null = null; // file analysis before the first map
  private refining: number | null = null; // full analysis after a partial map
  private noSync: NoSyncReason | null = null;
  private note: string | null = null;
  private disposed = false;
  private resolveP: Promise<unknown>;

  constructor(
    private readonly item: PlayItem,
    private readonly clock: SessionClock,
    private readonly devices: LiveDevices,
    private readonly platform: Pick<Platform, 'beatmapBase' | 'liveSync' | 'deviceAudio' | 'noteAnalysis'>,
    cache?: BeatMapCache,
  ) {
    this.cache = cache ?? beatCache();
    if (item.kind === 'youtube') {
      this.key = item.videoId;
      this.videoId = item.videoId;
      const base = platform.beatmapBase;
      this.resolveP = resolveBeatMap(
        this.key,
        this.videoId,
        { cache: this.cache, fetchCloud: (id) => fetchCloudMap(base, id) },
        (map) => this.useMap(map),
      ).finally(() => {
        this.resolving = false;
      });
      void cloudStatus(base, item.videoId).then((s) => {
        this.note = describeCloudStatus(s);
      });
    } else {
      this.key = fileKey(item.file);
      this.videoId = null;
      this.resolveP = Promise.resolve();
    }
  }

  get source(): BeatSource {
    return this.hub;
  }

  /** Current map (diagnostics / tests). */
  map(): BeatMap | null {
    return this.hub.map();
  }

  liveTracker(): LiveTracker | null {
    return this.tracker;
  }

  /** e.g. "Cloud beat analysis was blocked by YouTube for this song." while there is no map. */
  cloudNote(): string | null {
    const m = this.hub.map();
    return m && !m.partial ? null : this.note;
  }

  /**
   * Call once the player is ready, before the countdown. Resolves 'ask-mic'
   * when the one-time microphone explainer should be shown first (then call
   * answerMic()), otherwise 'ready'.
   */
  async prepare(): Promise<'ready' | 'ask-mic'> {
    if (this.item.kind === 'file') {
      await this.prepareFile(this.item.file);
      return 'ready';
    }
    if (this.platform.deviceAudio && this.videoId) {
      // Android TV: cache -> cloud -> analyse the downloaded audio on the device.
      await this.resolveP;
      if (this.disposed) return 'ready';
      const map = this.hub.map();
      if (!map || map.partial) await this.prepareDevice(this.videoId);
      return 'ready';
    }
    await Promise.race([this.resolveP, new Promise((r) => setTimeout(r, RESOLVE_WAIT_MS))]);
    if (this.disposed) return 'ready';
    return this.decideLive();
  }

  private async decideLive(): Promise<'ready' | 'ask-mic'> {
    const map = this.hub.map();
    if (map && !map.partial) return 'ready';
    if (!this.platform.liveSync) return this.none('unsupported');
    const tab = this.devices.currentTab();
    if (tab) {
      this.attach(tab, 'tab');
      return 'ready';
    }
    if (!this.devices.micSupported) return this.none('unsupported');
    const pref = store.settings().liveSync;
    if (pref === 'off') return this.none('off');
    const perm = await micPermission();
    if (this.disposed) return 'ready';
    if (perm === 'denied') return this.none('denied');
    if (pref === 'ask' && perm !== 'granted') return 'ask-mic';
    void this.startMic();
    return 'ready';
  }

  private none(reason: NoSyncReason): 'ready' {
    this.noSync = reason;
    return 'ready';
  }

  /** The user's answer to the microphone explainer. Resolves after the browser prompt. */
  async answerMic(use: boolean): Promise<void> {
    store.updateSettings({ liveSync: use ? 'mic' : 'off' });
    if (!use) {
      this.none('off');
      return;
    }
    await this.startMic();
  }

  /** Pause menu: "Sync: microphone". */
  async useMic(): Promise<void> {
    store.updateSettings({ liveSync: 'mic' });
    await this.startMic();
  }

  /**
   * Pause menu: "Sync: share this tab (better)". Must be called from a user
   * gesture. Resolves with a message to show if it didn't work.
   */
  async useTab(): Promise<string | null> {
    try {
      const cap = await this.devices.getTab();
      if (this.disposed) return null;
      this.attach(cap, 'tab');
      this.devices.closeMic();
      return null;
    } catch (err) {
      const reason = err instanceof LiveError ? err.reason : 'error';
      if (reason === 'cancelled') return null;
      if (reason === 'denied') return 'Tab sharing was cancelled.';
      if (reason === 'no-audio') {
        if (!this.tracker && this.devices.micSupported) void this.startMic();
        return 'The tab was shared without its sound. Tick “Also share tab audio” next time. Using the microphone for now.';
      }
      return "Tab sharing didn't work here. Using the microphone instead.";
    }
  }

  /** Which live options the pause menu should offer for this song. */
  offers(): { mic: boolean; tab: boolean } {
    const map = this.hub.map();
    if (this.item.kind !== 'youtube' || !this.platform.liveSync || (map && !map.partial)) return { mic: false, tab: false };
    const mode = this.tracker?.source ?? null;
    return { mic: this.devices.micSupported && mode !== 'mic', tab: this.devices.tabSupported && mode !== 'tab' };
  }

  private async startMic(): Promise<void> {
    if (this.tracker?.source === 'mic') return;
    try {
      const cap = await this.devices.getMic();
      if (this.disposed) return;
      this.attach(cap, 'mic');
    } catch (err) {
      if (this.disposed) return;
      const reason = err instanceof LiveError ? err.reason : 'error';
      if (reason === 'cancelled') return;
      this.none(reason === 'denied' ? 'denied' : reason === 'no-device' ? 'no-device' : reason === 'unsupported' ? 'unsupported' : 'error');
    }
  }

  private attach(cap: Capture, mode: 'mic' | 'tab'): void {
    const map = this.hub.map();
    if (map && !map.partial) return;
    this.saveLive(); // switching source mid-song: keep what was heard
    const latency =
      mode === 'mic'
        ? micLatency({ ...this.devices.micLatencyParts(cap), userOffsetMs: store.settings().audioOffsetMs })
        : tabLatency();
    this.tracker = new LiveTracker(cap, { source: mode, latency, clock: this.clock });
    this.noSync = null;
    console.info('[dd:beats]', `listening via ${mode}`, { latencyMs: Math.round(latency * 1000), sampleRate: cap.sampleRate });
  }

  private useMap(map: BeatMap): void {
    if (this.disposed) return;
    this.hub.setMap(map);
    console.info('[dd:beats]', `map from ${map.source}${map.partial ? ' (partial)' : ''}`, { bpm: map.bpm, beats: map.beats.length });
    if (!map.partial && this.tracker) {
      // A complete map arrived while listening (e.g. a slow cloud fetch).
      this.tracker.stop();
      this.tracker = null;
      this.hub.setLive(null);
    }
  }

  /**
   * Android TV: analyse the song's downloaded audio (source 'device'), the
   * same way as a dropped file (first 30 s if the whole song takes too long).
   */
  private async prepareDevice(videoId: string): Promise<void> {
    const getAudio = this.platform.deviceAudio;
    if (!getAudio) return;
    try {
      const buf = await getAudio(videoId);
      if (this.disposed) return;
      this.progress = 0;
      const t0 = performance.now();
      const a = analyzeAudio(buf, {
        key: this.key,
        source: 'device',
        onProgress: (f) => {
          if (this.progress !== null) this.progress = f;
          else if (this.refining !== null) this.refining = f;
        },
      });
      const first = await a.first;
      this.progress = null;
      const firstMs = Math.round(performance.now() - t0);
      const note = { videoId, firstMs, fullMs: first.partial ? null : firstMs, partial: !!first.partial, songSeconds: first.duration };
      this.platform.noteAnalysis?.(note);
      if (!this.hub.map() || isBetterMap(this.hub.map(), first)) this.useMap(first);
      void this.cache.offer(this.key, first);
      if (first.partial) {
        this.refining = 0;
        a.full.then(
          (full) => {
            void this.cache.offer(this.key, full);
            this.refining = null;
            this.platform.noteAnalysis?.({ ...note, fullMs: Math.round(performance.now() - t0) });
            this.useMap(full);
          },
          () => {
            this.refining = null;
          },
        );
      }
    } catch (err) {
      this.progress = null;
      console.warn('[dd:beats] device analysis failed', err);
      if (!this.hub.map()) this.none('error');
    }
  }

  private async prepareFile(file: File): Promise<void> {
    const cached = await this.cache.get(this.key);
    this.resolving = false;
    if (this.disposed) return;
    if (cached) this.useMap(cached);
    if (cached && !cached.partial) return;
    this.progress = 0;
    try {
      const buf = await file.arrayBuffer();
      if (this.disposed) return;
      const a = analyzeAudio(buf, {
        key: this.key,
        source: 'file',
        // Dev-only knob so the "first 30 s, then the rest" path can be exercised.
        budgetMs: import.meta.env.DEV ? (window as { __ddAnalysisBudgetMs?: number }).__ddAnalysisBudgetMs : undefined,
        onProgress: (f) => {
          if (this.progress !== null) this.progress = f;
          else if (this.refining !== null) this.refining = f;
        },
      });
      const first = await a.first;
      this.progress = null;
      if (!this.hub.map() || isBetterMap(this.hub.map(), first)) this.useMap(first);
      void this.cache.offer(this.key, first);
      if (first.partial) {
        this.refining = 0;
        a.full.then(
          (full) => {
            void this.cache.offer(this.key, full);
            this.refining = null;
            this.useMap(full);
          },
          () => {
            this.refining = null;
          },
        );
      }
    } catch (err) {
      this.progress = null;
      console.warn('[dd:beats] file analysis failed', err);
      if (!this.hub.map()) this.none('error');
    }
  }

  /** Call every animation frame. */
  tick(): void {
    if (this.tracker) this.hub.setLive(this.tracker.live());
  }

  status(): SyncStatus {
    if (this.progress !== null) return { kind: 'analyzing', progress: this.progress };
    const map = this.hub.map();
    const listening = this.tracker?.source ?? null;
    if (map && !map.partial) {
      return map.beats.length ? { kind: 'map', source: map.source, partial: false, listening: null, refining: null } : { kind: 'none', reason: 'no-beat' };
    }
    if (map && map.beats.length && (!listening || !this.pastMap())) {
      return { kind: 'map', source: map.source, partial: true, listening, refining: this.refining };
    }
    if (this.tracker) {
      const live = this.tracker.live();
      return { kind: 'live', mode: this.tracker.source, locked: live.locked, bpm: live.bpm };
    }
    if (this.noSync) return { kind: 'none', reason: this.noSync };
    if (map) return { kind: 'map', source: map.source, partial: true, listening: null, refining: this.refining };
    if (this.resolving) return { kind: 'resolving' };
    return { kind: 'none', reason: 'off' };
  }

  private pastMap(): boolean {
    const map = this.hub.map();
    if (!map || !map.beats.length) return true;
    return this.clock.time() > map.beats[map.beats.length - 1];
  }

  /** The live capture went away (e.g. the user stopped tab sharing). */
  sourceLost(): void {
    this.saveLive();
    this.hub.setLive(null);
    this.none('off');
  }

  /** Song ended or is being left: save what live listening heard. */
  finish(): void {
    this.saveLive();
    this.tracker = null;
    this.hub.setLive(null);
  }

  private saveLive(): void {
    const t = this.tracker;
    if (!t) return;
    this.tracker = null;
    const res = t.finalize(this.key, this.clock.duration());
    const info = { covered: Math.round(res?.covered ?? t.covered()), lockAt: t.lockSongTime, chunks: t.chunks };
    if (res && res.covered >= MIN_SAVE_SECONDS) {
      console.info('[dd:beats]', `saving ${t.source} map${res.map.partial ? ' (partial)' : ''}`, { ...info, bpm: res.map.bpm, beats: res.map.beats.length });
      void this.cache.offer(this.key, res.map).then((ok) => {
        if (!ok) console.info('[dd:beats]', 'kept the existing cached map (it is better)');
      });
    } else {
      console.info('[dd:beats]', `not saving ${t.source} recording (too short)`, info);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.finish();
    // A running full analysis is left to finish: it caches its result.
    this.disposed = true;
  }
}
