/**
 * Beat sync for one song on the play screen: decides where beats come from
 * and keeps the BeatSource up to date.
 *
 *  YouTube song: local cache -> cloud map (fetched in parallel with the
 *                player start) -> the DanceDance helper app if it is running
 *                on this computer (web only: it downloads the audio, which is
 *                analysed here like the TV's, source 'device') -> live
 *                fallback (tab audio if already shared, else the microphone,
 *                with a one-time explainer).
 *  Dropped file: local cache -> whole-file analysis in a Worker (progress on
 *                the starting screen; first 30 s if it takes too long).
 *
 * A partial map is used where it reaches, while live listening fills in the
 * rest. Live recordings covering >= 45 s are saved when the song ends.
 */
import type { BeatMap, BeatMapSource } from '../core/analysis';
import type { LocalHelper } from '../platform/helper';
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
import { holdBackgroundFill } from './helperFill';
import { resolveBeatMap } from './resolve';
import { queueMapUpload, tabCoverageGate } from './shareMap';

export type NoSyncReason = 'off' | 'denied' | 'unsupported' | 'no-device' | 'no-beat' | 'error';

export type SyncStatus =
  | { kind: 'resolving' }
  /** step 'download': the helper app is getting the song (progress of that); otherwise beat analysis. */
  | { kind: 'analyzing'; progress: number; step?: 'download' | 'analyze' }
  | { kind: 'map'; source: BeatMapSource; partial: boolean; listening: 'mic' | 'tab' | null; refining: number | null }
  | { kind: 'live'; mode: 'mic' | 'tab'; locked: boolean; bpm: number }
  | { kind: 'none'; reason: NoSyncReason };

export interface SessionClock extends LiveClock {
  /** Song duration (s), 0 while unknown. */
  duration(): number;
}

/** How long prepare() waits for the cache/cloud lookup before the countdown. */
const RESOLVE_WAIT_MS = 1500;
/** How long prepare() waits to learn whether the helper app is running. */
const HELPER_CHECK_MS = 1500;

export class BeatSession {
  readonly key: string;
  readonly videoId: string | null;
  private readonly hub = new BeatHub();
  private readonly cache: BeatMapCache;
  private tracker: LiveTracker | null = null;
  private resolving = true;
  private progress: number | null = null; // file analysis before the first map
  private fetching: number | null = null; // helper download before analysis
  private readonly abort = new AbortController();
  /** The helper's background fill pauses while a song is on screen. */
  private readonly releaseFill = holdBackgroundFill();
  private refining: number | null = null; // full analysis after a partial map
  private noSync: NoSyncReason | null = null;
  private note: string | null = null;
  /** Source of the song's cloud map, once fetched (null: none). */
  private cloudSource: BeatMapSource | null = null;
  private disposed = false;
  private resolveP: Promise<unknown>;

  constructor(
    private readonly item: PlayItem,
    private readonly clock: SessionClock,
    private readonly devices: LiveDevices,
    private readonly platform: Pick<Platform, 'beatmapBase' | 'liveSync' | 'deviceAudio' | 'noteAnalysis' | 'localHelper'>,
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
        {
          cache: this.cache,
          fetchCloud: (id) =>
            fetchCloudMap(base, id).then((m) => {
              this.cloudSource = m?.source ?? null;
              return m;
            }),
        },
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
    const helper = this.platform.localHelper;
    if (helper && this.videoId) {
      // Web with the helper app running: cache -> cloud -> helper -> live listening.
      const info = await Promise.race([helper.available().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), HELPER_CHECK_MS))]);
      if (info && !this.disposed) {
        await this.resolveP;
        if (this.disposed) return 'ready';
        const map = this.hub.map();
        if (!map || map.partial) await this.prepareHelper(this.videoId, helper);
        if (this.disposed) return 'ready';
      }
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
    const pref = store.settings().liveSync;
    // "Not now" earlier in this app session for this song: don't ask again.
    if (pref === 'ask' && syncPromptSkipped(this.key)) return this.none('off');
    // Never answered and tab audio works here: offer "Share this tab" first (it needs a click each time).
    if (pref === 'ask' && this.devices.tabSupported && this.item.kind === 'youtube') return 'ask-mic';
    if (!this.devices.micSupported) return this.none('unsupported');
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

  /**
   * The user's answer to the microphone explainer. Resolves after the browser
   * prompt. "No" is "Not now": no sync for this song only (see declineSync).
   */
  async answerMic(use: boolean): Promise<void> {
    if (!use) {
      this.declineSync(false);
      return;
    }
    store.updateSettings({ liveSync: 'mic' });
    await this.startMic();
  }

  /**
   * Continue this song without beat sync. `forever` ("Don't ask again") turns
   * the "Songs without a beat map" option Off; otherwise ("Not now", Escape)
   * nothing is saved and only this song is skipped: the prompt isn't shown
   * for it again in this app session, but other songs (and later sessions)
   * still ask.
   */
  declineSync(forever: boolean): void {
    if (forever) store.updateSettings({ liveSync: 'off' });
    else skipSyncPrompt(this.key);
    this.none('off');
  }

  /**
   * The user chose "Share this tab" in the explainer (call from the click).
   * Cancelling the browser's picker counts as "Not now" for this song.
   */
  async answerTab(): Promise<string | null> {
    const msg = await this.useTab();
    if (!this.disposed && this.tracker?.source !== 'tab' && msg === 'Tab sharing was cancelled.') {
      this.declineSync(false);
      return 'No beat sync for this song. You can turn it on from the pause menu.';
    }
    return msg;
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

  /**
   * Web + helper app: get the audio from the helper, then analyse it here
   * (source 'device'), as on the TV. Any failure is quiet: prepare() goes on
   * to live listening.
   */
  private async prepareHelper(videoId: string, helper: LocalHelper): Promise<void> {
    let buf: ArrayBuffer;
    const t0 = performance.now();
    try {
      this.fetching = 0;
      buf = await helper.fetchAudio(videoId, {
        signal: this.abort.signal,
        onProgress: (p) => {
          if (this.fetching !== null && p.phase === 'download' && p.fraction !== null) this.fetching = p.fraction * 0.95;
          if (this.fetching !== null && p.phase === 'transfer' && p.fraction !== null) this.fetching = 0.95 + p.fraction * 0.05;
        },
      });
    } catch (err) {
      console.info('[dd:beats] helper could not get the song', (err as { code?: string }).code ?? err);
      return;
    } finally {
      this.fetching = null;
    }
    if (this.disposed) return;
    const fetchMs = Math.round(performance.now() - t0);
    this.progress = 0;
    try {
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
      console.info('[dd:beats] helper map', { fetchMs, analyzeMs: Math.round(performance.now() - t0) - fetchMs, partial: !!first.partial });
      if (!this.hub.map() || isBetterMap(this.hub.map(), first)) this.useMap(first);
      void this.cache.offer(this.key, first);
      const done = (full: BeatMap) => {
        void this.cache.offer(this.key, full);
        shareDeviceMap(full, this.cloudSource);
      };
      if (!first.partial) done(first);
      else {
        this.refining = 0;
        a.full.then(
          (full) => {
            done(full);
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
      console.warn('[dd:beats] analysis of the helper audio failed', err);
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
    if (this.fetching !== null) return { kind: 'analyzing', progress: this.fetching, step: 'download' };
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
    // Listen-and-share: a whole song heard via tab audio becomes everyone's beat map.
    if (res && t.source === 'tab' && this.videoId) {
      const why = tabCoverageGate(res.map, { duration: this.clock.duration(), covered: res.covered, locked: res.locked, stoppedAt: this.clock.time() });
      const shared = why ? `skipped:${why}` : queueMapUpload(res.map, { existingSource: this.cloudSource });
      console.info('[dd:beats]', `share tab map: ${shared}`, { covered: Math.round(res.covered), locked: Math.round(res.locked) });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.abort.abort(); // a helper download still running for this song
    this.releaseFill();
    this.finish();
    // A running full analysis is left to finish: it caches its result.
    this.disposed = true;
  }
}

/**
 * A complete map analysed from the helper's audio: hand it to the shared
 * uploader (shareMap.ts) so everyone gets it as a cloud map.
 */
function shareDeviceMap(map: BeatMap, existingSource: BeatMapSource | null): void {
  const shared = queueMapUpload(map, { existingSource });
  console.info('[dd:beats]', `share device map: ${shared}`);
}

// --- "Not now" on the sync prompt -------------------------------------------
// Remembered for this app session only (not saved): the prompt isn't repeated
// for the same song, but comes back in a later session.
const skippedPrompts = new Set<string>();

export function skipSyncPrompt(key: string): void {
  skippedPrompts.add(key);
}

export function syncPromptSkipped(key: string): boolean {
  return skippedPrompts.has(key);
}

/** Tests: forget "Not now" answers. */
export function resetSyncPromptMemory(): void {
  skippedPrompts.clear();
}
