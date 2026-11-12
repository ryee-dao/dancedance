/**
 * Android TV implementation of the platform seam, backed by the native
 * `window.DanceBridge` that the Kotlin shell (android/) injects into its
 * WebView. Selected in app.ts when that object exists.
 *
 * On TV: the playlist comes from NewPipe Extractor (re-read on every app
 * open), songs play as audio only (no YouTube iframe at all) from a file the
 * shell downloads into its cache, and beat maps come from the local cache,
 * then the cloud (GitHub Pages), then on-device analysis of that file.
 *
 * ===========================================================================
 * Bridge contract, version 2. Mirrored in
 * android/app/src/main/java/app/dancedance/tv/DanceBridge.kt; keep in sync.
 * ===========================================================================
 *
 * `@JavascriptInterface` methods are synchronous and run on a WebView
 * background thread, so the slow ones take a request id, return at once and
 * answer later by calling `window.__danceBridgeReceive(json)` with
 *   {type:'result', id, ok:true, value}  or
 *   {type:'result', id, ok:false, error:{code, message}}.
 * Native events arrive on the same function as {type:'event', name, data}.
 * The GitHub token never crosses into JavaScript.
 *
 * v2: songs added from the phone page ("Find a song"): getAddedSongs(),
 * removeAddedSong(), and the 'addedSongsChanged' event.
 * v3: setAudioFormats() and PreparedAudio.primingSec (beat alignment, below).
 * v4: getGraphicsInfo() and setWebViewLayerType() for the graphics test.
 *
 * Beat alignment. Cloud maps are made from YouTube's WebM/Opus stream, so the
 * shell downloads that by default: WebView decodes and plays it sample-aligned
 * with the cloud timeline (Opus pre-skip is honoured). YouTube's M4A/AAC files
 * mostly carry 1600 samples (36.3 ms) of undeclared encoder priming that
 * Chromium decodes AND plays (measured, WebView 113), so when the M4A fallback
 * is used the shell reports `primingSec` and this side takes it off both the
 * playback clock and the audio handed to on-device analysis.
 */

import type { AddedSong } from '../beat/cloud';
import { fetchVideoInfo, limitConcurrency, cleanTitle } from '../player/playlistReader';
import { ANALYSIS_RATE } from '../beat/analyzeAudio';
import { SmoothClock } from '../player/clock';
import { PlayerError, type MediaPlayer, type PlayItem, type StartStatus } from '../player/types';
import { store } from '../store';
import { toast } from '../ui/toast';
import type { DeviceAnalysisNote, Platform, PlaylistEntry } from './platform';

// ---------------------------------------------------------------------------
// Contract types

export const BRIDGE_VERSION = 4;

/** The raw object the shell injects as `window.DanceBridge`. */
export interface DanceBridgeNative {
  bridgeVersion(): number;
  /** JSON TvConfig. */
  getConfig(): string;
  /** JSON {input, listId} or "null": the playlist linked from the phone (native is the source of truth). */
  getLinkedPlaylist(): string;
  unlinkPlaylist(): void;
  /** JSON TvAddedSong[] (oldest first): songs added from the phone page. */
  getAddedSongs(): string;
  /** Remove one; true if it was there. Emits 'addedSongsChanged'. */
  removeAddedSong(videoId: string): boolean;
  /** JSON NativeDiagnostics. */
  getDiagnostics(): string;
  setKeepScreenOn(on: boolean): void;
  /** Leave the app (the page calls this for BACK on its home screen). */
  exitApp(): void;
  /** Abort a running prepareAudio download. */
  cancelAudio(videoId: string): void;
  stopLinkServer(): void;
  /** v3: download format order, e.g. "webm,m4a"; returns the order in effect. */
  setAudioFormats?(csv: string): string;
  /** v4: JSON NativeGraphicsInfo (graphics test). */
  getGraphicsInfo?(): string;
  /** v4: the WebView's View layer type ('none' | 'hardware' | 'software'); returns the type now set, or an error text. */
  setWebViewLayerType?(type: string): string;
  // async: answer delivered later by request id
  /** value: BridgePlaylistEntry[] in playlist order (all pages). */
  getPlaylist(requestId: string, listIdOrUrl: string): void;
  /** value: PreparedAudio. Emits 'audioProgress' events while downloading. */
  prepareAudio(requestId: string, videoId: string): void;
  /** value: CloudTriggerResult (never an error). */
  requestCloudAnalysis(requestId: string, missingCount: number): void;
  /** value: LinkServerInfo. Emits 'linkVisited' / 'linkSubmitted'. */
  startLinkServer(requestId: string): void;
}

export interface TvConfig {
  bridgeVersion: number;
  appVersion: string;
  versionCode: number;
  newPipeVersion: string;
  /** e.g. https://owner.github.io/repo/ (where cloud beat maps live); null in local builds. */
  pagesBaseUrl: string | null;
  cloudRepoConfigured: boolean;
  /** Repo configured at build time AND a GitHub token linked from the phone. */
  canTriggerCloud: boolean;
}

export interface NativeDiagnostics {
  appVersion: string;
  versionCode: number;
  buildType: string;
  newPipeVersion: string;
  device: string;
  android: string;
  webView: string | null;
  cpuCores: number;
  maxHeapMb: number;
  cacheBytes: number;
  cacheFiles: number;
  cacheCapBytes: number;
  lastDownload: string | null;
  pagesBaseUrl: string | null;
  cloudRepo: string | null;
  hasGithubToken: boolean;
  tokenStorage: 'keystore' | 'plain' | 'none';
  lastCloudTrigger: (CloudTriggerResult & { at: number }) | null;
}

/** v4: what the graphics test shows about the device's display and the WebView's view. */
export interface NativeGraphicsInfo {
  /** e.g. "12 (API 31)". */
  android: string;
  /** Manufacturer and model. */
  device: string;
  viewHardwareAccelerated: boolean;
  windowHardwareAccelerated: boolean;
  layerType: string;
  /** The WebView's size in device pixels, e.g. "1920x1080". */
  viewPx: string;
  /** Current display mode, e.g. "3840x2160@60Hz". */
  displayMode: string;
  /** Supported modes, comma-separated (shortened). */
  modes: string;
  density: number;
}

/** `title` is YouTube's raw title and `artist` the uploader; cleaned up on this side. */
/** A song added from the phone page: the web's AddedSong plus the chosen video's details. */
export interface TvAddedSong extends AddedSong {
  /** The YouTube video's own title and channel. */
  videoTitle: string;
  channel: string;
  /** Which rule picked it: 'official' | 'lyric' | 'topic' | 'music-video'. */
  tier: string;
}

export interface BridgePlaylistEntry {
  videoId: string;
  title: string;
  artist: string | null;
  durationSec: number | null;
}

export interface PreparedAudio {
  videoId: string;
  /** Same-origin URL (https://appassets.androidplatform.net/audio/<id>.<ext>): fetch()-able and seekable in <audio>. */
  url: string;
  mimeType: 'audio/mp4' | 'audio/webm';
  bytes: number;
  durationSec: number | null;
  fromCache: boolean;
  downloadMs: number;
  /** v3: seconds of encoder priming at the start that the cloud timeline doesn't have (M4A only; else 0). */
  primingSec?: number;
}

export interface AudioProgress {
  videoId: string;
  phase: 'resolving' | 'downloading' | 'retrying';
  receivedBytes: number;
  totalBytes: number | null;
  attempt: number;
}

export type CloudTriggerResult =
  | { status: 'started' }
  | { status: 'rate-limited'; retryAfterSec: number }
  | { status: 'not-needed' | 'no-token' | 'not-configured' }
  | { status: 'failed'; message: string; httpStatus?: number };

export interface LinkServerInfo {
  /** http://<lan-ip>:<port>/<random token> */
  url: string;
  /** QR code of `url` as an SVG data URL. */
  qrDataUrl: string;
}

export type BridgeEvent =
  | { name: 'audioProgress'; data: AudioProgress }
  | { name: 'linkVisited'; data: Record<string, never> }
  | { name: 'linkSubmitted'; data: { input: string; listId: string; songCount: number; token: 'saved' | 'removed' | 'unchanged' } }
  | { name: 'lifecycle'; data: { state: 'pause' | 'resume' } }
  | { name: 'addedSongsChanged'; data: { songs: TvAddedSong[]; added: TvAddedSong | null; removedVideoId: string | null } };

export type BridgeErrorCode =
  | 'network'
  | 'unavailable'
  | 'private'
  | 'age-restricted'
  | 'geo'
  | 'paid'
  | 'bot-check'
  | 'extractor'
  | 'no-audio'
  | 'playlist-unavailable'
  | 'bad-input'
  | 'no-network-for-link'
  | 'storage'
  | 'cancelled'
  | 'internal';

export class BridgeError extends Error {
  constructor(
    readonly code: BridgeErrorCode,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Client

type Listener<N extends BridgeEvent['name']> = (data: Extract<BridgeEvent, { name: N }>['data']) => void;

declare global {
  interface Window {
    __danceBridgeReceive?: (json: string) => void;
  }
}

class BridgeClient {
  private seq = 0;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: BridgeError) => void }>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  constructor(readonly native: DanceBridgeNative) {
    window.__danceBridgeReceive = (json) => this.receive(json);
  }

  call<T>(method: 'getPlaylist' | 'prepareAudio' | 'requestCloudAnalysis' | 'startLinkServer', ...args: (string | number)[]): Promise<T> {
    const id = `r${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      try {
        (this.native[method] as (id: string, ...a: (string | number)[]) => void)(id, ...args);
      } catch (err) {
        this.pending.delete(id);
        reject(new BridgeError('internal', `The app's native side failed (${String(err)}).`));
      }
    });
  }

  on<N extends BridgeEvent['name']>(name: N, fn: Listener<N>): () => void {
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    const f = fn as (data: unknown) => void;
    set.add(f);
    return () => set.delete(f);
  }

  /** Parse a sync JSON answer; null on garbage. */
  json<T>(text: string): T | null {
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  private receive(json: string): void {
    let m: { type?: string; id?: string; ok?: boolean; value?: unknown; error?: { code?: string; message?: string }; name?: string; data?: unknown };
    try {
      m = JSON.parse(json);
    } catch {
      return;
    }
    if (m.type === 'result' && m.id) {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.value);
      else p.reject(new BridgeError((m.error?.code as BridgeErrorCode) ?? 'internal', m.error?.message ?? 'Something went wrong.'));
    } else if (m.type === 'event' && m.name) {
      for (const fn of this.listeners.get(m.name) ?? []) {
        try {
          fn(m.data ?? {});
        } catch (err) {
          console.error('[dd:tv] event handler failed', err);
        }
      }
    }
  }
}

let client: BridgeClient | null = null;

/** The bridge client when running inside the Android TV shell, else null. */
export function tvBridge(): BridgeClient | null {
  if (client) return client;
  const native = window.DanceBridge as DanceBridgeNative | undefined;
  if (!native || typeof native.getConfig !== 'function') return null;
  client = new BridgeClient(native);
  return client;
}

export function hasTvBridge(): boolean {
  return tvBridge() !== null;
}

// ---------------------------------------------------------------------------
// Shared state for the TV screens (diagnostics)

export type AnalysisNote = DeviceAnalysisNote;

export interface FrameStats {
  frames: number;
  avgMs: number;
  fps: number;
  /** 95th percentile frame time, ms. */
  p95Ms: number;
  /** Frames longer than 50 ms. */
  longFrames: number;
}

export const tvState = {
  config: null as TvConfig | null,
  lastAnalysis: null as AnalysisNote | null,
  cloud: null as { at: number; missing: number; result: CloudTriggerResult | { status: 'skipped'; reason: string } } | null,
  /** Live stats while a song plays, then the last song's. */
  frames: null as FrameStats | null,
  framesLive: false,
  /** Download format order agreed with the shell at startup ("webm,m4a"), for diagnostics. */
  audioFormats: null as string | null,
};

// ---------------------------------------------------------------------------
// Platform

const oembedSlot = limitConcurrency(4);
const LINK_OFFERED_KEY = 'dd.tv.linkOffered';

export function createAndroidTvPlatform(): Platform {
  const b = tvBridge();
  if (!b) throw new Error('DanceBridge is not available');
  const config = b.json<TvConfig>(b.native.getConfig());
  tvState.config = config;
  if (config && config.bridgeVersion !== BRIDGE_VERSION) {
    console.warn('[dd:tv] bridge version mismatch', config.bridgeVersion, BRIDGE_VERSION);
  }
  syncLinkFromNative();
  void configureAudioFormats(b);
  installLifecycle(b);
  installAddedSongs(b);
  installFrameSampler();

  return {
    id: 'androidtv',
    isTV: true,
    canPlayFiles: false,
    // Local builds have no Pages URL: the maps bundled in the APK still work.
    beatmapBase: config?.pagesBaseUrl ?? './',
    liveSync: false,
    async getPlaylist(listId) {
      let raw: BridgePlaylistEntry[];
      try {
        raw = await b.call<BridgePlaylistEntry[]>('getPlaylist', listId);
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err));
      }
      const entries: PlaylistEntry[] = raw.map((e) => {
        const c = cleanTitle(e.title, e.artist ?? undefined);
        return { videoId: e.videoId, title: c.title || e.title, artist: c.artist };
      });
      void maybeTriggerCloud(entries.map((e) => e.videoId));
      return entries;
    },
    async lookupVideo(videoId) {
      // oEmbed still tells us about removed videos. "Embedding disabled"
      // doesn't matter on TV (no iframe), so it counts as playable.
      const info = await oembedSlot(() => fetchVideoInfo(videoId));
      if (info?.status === 'embed') return { status: 'ok', title: '' };
      return info;
    },
    async getEnrichment() {
      return []; // titles come with the playlist from the bridge
    },
    createPlayer(item) {
      return item.kind === 'youtube' ? new TvAudioPlayer() : null;
    },
    async deviceAudio(videoId) {
      const p = await prepareAudio(videoId);
      const res = await fetch(p.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      return p.primingSec && p.primingSec > 0 ? trimPriming(buf, p.primingSec) : buf;
    },
    noteAnalysis(info) {
      tvState.lastAnalysis = info;
      console.info('[dd:tv] analysis', JSON.stringify(info));
    },
    exitApp() {
      b.native.exitApp();
    },
    localAddedSongs() {
      return localAdded;
    },
    onLocalAddedSongsChange(fn) {
      addedListeners.add(fn);
      return () => addedListeners.delete(fn);
    },
    removeLocalAddedSong(videoId) {
      let removed: boolean;
      try {
        removed = b.native.removeAddedSong(videoId) === true;
      } catch (err) {
        console.warn('[dd:tv] removeAddedSong failed', err);
        return false;
      }
      // The native side also emits 'addedSongsChanged'; update now so the tile goes at once.
      if (removed) {
        localAdded = localAdded.filter((s) => s.videoId !== videoId);
        for (const fn of addedListeners) fn();
      }
      return removed;
    },
  };
}

// --- songs added from the phone page ------------------------------------------

let localAdded: TvAddedSong[] = [];
const addedListeners = new Set<() => void>();

function installAddedSongs(b: BridgeClient): void {
  localAdded = b.json<TvAddedSong[]>(b.native.getAddedSongs()) ?? [];
  b.on('addedSongsChanged', ({ songs, added }) => {
    localAdded = Array.isArray(songs) ? songs : [];
    for (const fn of addedListeners) fn();
    if (added) toast(`Added: ${added.title}`, 5000);
  });
}

/** The phone link is stored natively; mirror it into the web store before the library reads it. */
export function syncLinkFromNative(): void {
  const b = tvBridge();
  if (!b) return;
  const native = b.json<{ input: string; listId: string } | null>(b.native.getLinkedPlaylist());
  const web = store.playlistLink();
  if (native?.listId === web?.listId && native?.input === web?.input) return;
  store.setPlaylistLink(native ? { input: native.input, listId: native.listId } : null);
}

/** First launch without a linked playlist: open the link screen once. */
export function shouldOfferTvLink(): boolean {
  if (store.playlistLink()) return false;
  try {
    if (localStorage.getItem(LINK_OFFERED_KEY)) return false;
    localStorage.setItem(LINK_OFFERED_KEY, String(Date.now()));
  } catch {
    /* storage unavailable: offer it every launch, which is harmless */
  }
  return true;
}

// --- audio downloads (shared by the player and on-device analysis) --------

const preparing = new Map<string, Promise<PreparedAudio>>();

/** 48 ms of Opus in WebM (559 bytes): the startup decode probe. */
const OPUS_PROBE = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAH/EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHGTbuMU6uEElTDZ1OsggE8TbuMU6uEHFO7a1OsggHp7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmoCrXsYMPQkBNgIRMYXZmV0GETGF2ZkSJiEBIAAAAAAAAFlSua/GuAQAAAAAAAGjXgQFzxYgAAAAAAAAAAZyBACK1nIN1bmSIgQCGhkFfT1BVU1aqg2MuoFa7hATEtACDgQIj44OEATEtAOGRn4EBtYhA53AAAAAAAGJkgRBV7oEAY6KTT3B1c0hlYWQBATgBgLsAAAAAABJUw2fRc3POY8CLY8WIAAAAAAAAAAFnyJlFo4dFTkNPREVSRIeMTGF2YyBsaWJvcHVzZ8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMC4wNDgwMDAwMDAAH0O2ddLngQCjkYEAAIAIg22C0Bz96kn+AT/Ao5qBABWACKcaXYqYLl9vBctKGu2388jWBcFewKCeoZKBACkACAZtM5AK7H1As5EiKcSbgQd1ooQAzf5gHFO7a5G7j7OBALeK94EB8YIBkvCBAw==';

let formatsReady: Promise<void> | null = null;

/**
 * Once per app open, before the first download: WebM/Opus when this WebView
 * can both play and decode it (every Chromium we know of), else M4A first.
 */
function configureAudioFormats(b: BridgeClient): Promise<void> {
  formatsReady ??= (async () => {
    if (typeof b.native.setAudioFormats !== 'function') return; // older shell: its own default
    const opus = await canUseOpus();
    tvState.audioFormats = b.native.setAudioFormats(opus ? 'webm,m4a' : 'm4a,webm');
    console.info('[dd:tv] audio formats', tvState.audioFormats);
  })().catch((err: unknown) => console.warn('[dd:tv] audio format setup failed', err));
  return formatsReady;
}

async function canUseOpus(): Promise<boolean> {
  try {
    if (!document.createElement('audio').canPlayType('audio/webm; codecs="opus"')) return false;
    const bytes = Uint8Array.from(atob(OPUS_PROBE), (c) => c.charCodeAt(0));
    const ctx = new OfflineAudioContext(1, 1, ANALYSIS_RATE);
    const decoded = await Promise.race([
      ctx.decodeAudioData(bytes.buffer),
      new Promise<null>((r) => setTimeout(() => r(null), 3000)),
    ]);
    return !!decoded && decoded.length > 0;
  } catch {
    return false;
  }
}

/**
 * The analysis input for an M4A with undeclared priming: decoded the way
 * analyzeAudio does (mono, ANALYSIS_RATE), priming dropped, as 16-bit WAV, so
 * the device map lands on the cloud timeline like the player's clock does.
 */
async function trimPriming(buf: ArrayBuffer, primingSec: number): Promise<ArrayBuffer> {
  let audio: AudioBuffer;
  try {
    audio = await new OfflineAudioContext(1, 1, ANALYSIS_RATE).decodeAudioData(buf.slice(0));
  } catch {
    return buf; // let the analysis report the decode failure itself
  }
  const skip = Math.min(audio.length, Math.round(primingSec * audio.sampleRate));
  const n = audio.length - skip;
  const chs = audio.numberOfChannels;
  const out = new ArrayBuffer(44 + 2 * n);
  const v = new DataView(out);
  const str = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + 2 * n, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, audio.sampleRate, true);
  v.setUint32(28, audio.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, 2 * n, true);
  const data = Array.from({ length: chs }, (_, c) => audio.getChannelData(c));
  for (let i = 0; i < n; i++) {
    let x = 0;
    for (let c = 0; c < chs; c++) x += data[c][i + skip];
    x /= chs;
    v.setInt16(44 + 2 * i, Math.max(-32768, Math.min(32767, Math.round(x * 32767))), true);
  }
  return out;
}

/** Download (or reuse) a song's audio. Concurrent calls share one download. */
export function prepareAudio(videoId: string): Promise<PreparedAudio> {
  const b = tvBridge();
  if (!b) return Promise.reject(new BridgeError('internal', 'Not running on the TV app.'));
  let p = preparing.get(videoId);
  if (!p) {
    p = configureAudioFormats(b).then(() => b.call<PreparedAudio>('prepareAudio', videoId));
    preparing.set(videoId, p);
    // Keep successful results briefly (the cache answers instantly anyway).
    p.then(
      () => setTimeout(() => preparing.delete(videoId), 60_000),
      () => preparing.delete(videoId),
    );
  }
  return p;
}

export function cancelAudio(videoId: string): void {
  preparing.delete(videoId);
  tvBridge()?.native.cancelAudio(videoId);
}

// --- TV -> cloud trigger -----------------------------------------------------

let cloudChecked = false;

/**
 * Once per app open: if the playlist has songs with neither a cloud map nor
 * a recorded cloud failure, ask the shell to start the cloud job (it holds
 * the token and enforces the 10-minute limit).
 */
async function maybeTriggerCloud(videoIds: string[]): Promise<void> {
  const b = tvBridge();
  if (!b || cloudChecked || !videoIds.length) return;
  cloudChecked = true;
  // Re-read: a token linked from the phone a moment ago changes canTriggerCloud.
  const cfg = b.json<TvConfig>(b.native.getConfig()) ?? tvState.config;
  tvState.config = cfg;
  const at = Date.now();
  if (!cfg?.pagesBaseUrl || !cfg.cloudRepoConfigured) {
    tvState.cloud = { at, missing: 0, result: { status: 'skipped', reason: 'Cloud features are off in this build.' } };
    return;
  }
  if (!cfg.canTriggerCloud) {
    tvState.cloud = { at, missing: 0, result: { status: 'skipped', reason: 'No GitHub token linked.' } };
    return;
  }
  const get = async (path: string): Promise<unknown> => {
    const res = await fetch(new URL(path, cfg.pagesBaseUrl!).href, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  let mapped: Set<string>;
  let known: Set<string>;
  try {
    const [index, status] = await Promise.all([get('beatmaps/index.json'), get('beatmaps/status.json').catch(() => ({}))]);
    const ids = (index as { ids?: unknown }).ids;
    const songs = (index as { songs?: unknown }).songs;
    mapped = new Set([
      ...(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []),
      ...(songs && typeof songs === 'object' ? Object.keys(songs) : []),
    ]);
    const videos = (status as { videos?: unknown }).videos;
    known = new Set(videos && typeof videos === 'object' ? Object.keys(videos) : []);
  } catch (err) {
    tvState.cloud = { at, missing: 0, result: { status: 'skipped', reason: `Couldn't read the cloud index (${String(err)}).` } };
    return;
  }
  const missing = videoIds.filter((id) => !mapped.has(id) && !known.has(id)).length;
  const result = await b.call<CloudTriggerResult>('requestCloudAnalysis', missing);
  tvState.cloud = { at, missing, result };
  console.info('[dd:tv] cloud trigger', missing, JSON.stringify(result));
}

// --- app lifecycle -----------------------------------------------------------

const players = new Set<TvAudioPlayer>();

function installLifecycle(b: BridgeClient): void {
  b.on('lifecycle', ({ state }) => {
    if (state !== 'pause') return;
    // The play screen turns this into its Paused menu; the players also stop
    // themselves in case no screen is listening.
    window.dispatchEvent(new CustomEvent('dd:app-pause'));
    for (const p of players) p.pause();
  });
}

// --- frame-time sampler (diagnostics) ---------------------------------------

/**
 * Measures requestAnimationFrame intervals while the play screen is up: the
 * whole frame pipeline including the stage renderer, which is what decides
 * whether the coach looks smooth on the projector.
 */
function installFrameSampler(): void {
  const root = document.getElementById('app');
  if (!root) return;
  let raf = 0;
  let last = 0;
  let samples: number[] = [];
  const publish = () => {
    if (samples.length < 10) return;
    const sorted = samples.slice().sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);
    const avg = sum / samples.length;
    tvState.frames = {
      frames: samples.length,
      avgMs: Math.round(avg * 10) / 10,
      fps: Math.round((1000 / avg) * 10) / 10,
      p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
      longFrames: samples.filter((s) => s > 50).length,
    };
  };
  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    if (last) {
      const dt = t - last;
      if (dt < 1000) samples.push(dt); // ignore gaps (app paused)
      if (samples.length > 3600) samples = samples.slice(-3600);
      if (samples.length % 30 === 0) publish();
    }
    last = t;
  };
  const check = () => {
    const playing = !!root.querySelector(':scope > .screen.play');
    if (playing && !raf) {
      samples = [];
      last = 0;
      tvState.framesLive = true;
      raf = requestAnimationFrame(tick);
    } else if (!playing && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      publish();
      tvState.framesLive = false;
    }
  };
  new MutationObserver(check).observe(root, { childList: true });
}

// ---------------------------------------------------------------------------
// Player: audio only, from the shell's download cache

const SLOW_MS = 45_000;

/**
 * Plays a YouTube item on TV: the shell downloads the audio-only stream
 * (NewPipe), then a plain <audio> element plays it from a same-origin URL.
 * Same contract as the other players, so the play screen's Starting soon ->
 * 3-2-1 flow is unchanged; `loadingDetail()` feeds its progress line.
 */
export class TvAudioPlayer implements MediaPlayer {
  readonly kind = 'youtube' as const;
  onEnded: (() => void) | null = null;
  onError: ((err: PlayerError) => void) | null = null;
  onStatus: ((status: StartStatus) => void) | null = null;

  private audio = new Audio();
  private clock = new SmoothClock();
  private loaded = false;
  private videoId: string | null = null;
  private detail: string | null = null;
  private pending: { reject: (e: PlayerError) => void } | null = null;
  private offProgress: (() => void) | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private src: string | null = null;
  private wantPlay = false;
  private lastTime = 0;
  private lastRecovery = 0;
  /** Encoder priming the element plays before the music (M4A fallback only): off the clock. */
  private priming = 0;

  constructor() {
    players.add(this);
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => {
      this.clock.update(this.audio.currentTime, false);
      keepScreenOn(false);
      this.onEnded?.();
    });
    this.audio.addEventListener('error', () => {
      if (!this.loaded) return;
      if (this.recover()) return;
      this.onError?.(new PlayerError('decode', 'The song stopped playing.'));
    });
  }

  /**
   * Android releases the WebView's audio decoder while the app is in the
   * background; the element then errors on the next play(). The file is
   * local, so reload it and carry on from the same spot.
   */
  private recover(): boolean {
    const now = performance.now();
    if (!this.src || now - this.lastRecovery < 5000) return false;
    this.lastRecovery = now;
    const a = this.audio;
    const at = this.lastTime;
    const resume = this.wantPlay;
    console.warn('[dd:tv] audio element failed; reloading at', at.toFixed(1));
    const onMeta = () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.currentTime = at;
      if (resume) void a.play().catch(() => {});
    };
    a.addEventListener('loadedmetadata', onMeta);
    a.src = this.src;
    a.load();
    return true;
  }

  loadingDetail(): string | null {
    return this.detail;
  }

  load(item: PlayItem): Promise<void> {
    if (item.kind !== 'youtube') return Promise.reject(new PlayerError('decode', 'Not a YouTube item'));
    this.reset();
    const videoId = item.videoId;
    this.videoId = videoId;
    this.detail = 'Getting the song from YouTube…';
    const b = tvBridge();
    this.offProgress =
      b?.on('audioProgress', (p) => {
        if (p.videoId === videoId) this.detail = progressText(p);
      }) ?? null;
    this.slowTimer = setTimeout(() => this.onStatus?.('slow'), SLOW_MS);

    return new Promise<void>((resolve, reject) => {
      let done = false;
      const finish = (err?: PlayerError) => {
        if (done) return;
        done = true;
        this.pending = null;
        this.clearLoadState();
        if (err) reject(err);
        else resolve();
      };
      this.pending = { reject: (e) => finish(e) };
      prepareAudio(videoId).then(
        (prepared) => {
          if (done) return;
          this.detail = prepared.fromCache ? 'Song ready.' : 'Downloaded.';
          this.priming = prepared.primingSec && prepared.primingSec > 0 ? prepared.primingSec : 0;
          const a = this.audio;
          const onReady = () => {
            a.removeEventListener('canplay', onReady);
            a.removeEventListener('error', onErr);
            if (done) return;
            a.currentTime = 0;
            this.clock.seek(0);
            this.clock.update(0, false);
            this.loaded = true;
            finish();
          };
          const onErr = () => {
            a.removeEventListener('canplay', onReady);
            a.removeEventListener('error', onErr);
            finish(new PlayerError('decode', "This song's audio couldn't be played."));
          };
          a.addEventListener('canplay', onReady);
          a.addEventListener('error', onErr);
          this.src = prepared.url;
          a.src = prepared.url;
          a.load();
        },
        (err: unknown) => finish(toPlayerError(err)),
      );
    });
  }

  play(): void {
    if (!this.loaded) return;
    this.wantPlay = true;
    keepScreenOn(true);
    this.audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'NotAllowedError') this.onStatus?.('needs-gesture');
      else if (!(err instanceof DOMException && err.name === 'AbortError')) {
        this.onError?.(new PlayerError('decode', "This song's audio couldn't be played."));
      }
    });
  }

  pause(): void {
    this.wantPlay = false;
    this.audio.pause();
    this.clock.update(this.audio.currentTime, false);
    keepScreenOn(false);
  }

  isPlaying(): boolean {
    const a = this.audio;
    return this.loaded && !a.paused && !a.ended && a.readyState >= 3;
  }

  time(): number {
    if (!this.loaded) return 0;
    if (this.audio.currentTime > 0) this.lastTime = this.audio.currentTime;
    this.clock.update(this.audio.currentTime, this.isPlaying());
    return Math.max(0, Math.min(this.clock.time() - this.priming, this.duration() || Infinity));
  }

  duration(): number {
    const d = this.audio.duration;
    return Number.isFinite(d) ? d : 0;
  }

  destroy(): void {
    // Backing out while it downloads cancels the download.
    if (!this.loaded && this.videoId) cancelAudio(this.videoId);
    this.reset();
    this.onEnded = this.onError = this.onStatus = null;
    players.delete(this);
  }

  private reset(): void {
    this.pending?.reject(new PlayerError('cancelled'));
    this.pending = null;
    this.clearLoadState();
    this.loaded = false;
    this.detail = null;
    this.src = null;
    this.wantPlay = false;
    this.lastTime = 0;
    this.priming = 0;
    keepScreenOn(false);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private clearLoadState(): void {
    this.offProgress?.();
    this.offProgress = null;
    if (this.slowTimer !== null) clearTimeout(this.slowTimer);
    this.slowTimer = null;
  }
}

function keepScreenOn(on: boolean): void {
  try {
    tvBridge()?.native.setKeepScreenOn(on);
  } catch {
    /* ignore */
  }
}

function progressText(p: AudioProgress): string {
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
  if (p.phase === 'resolving') return 'Getting the song from YouTube…';
  if (p.phase === 'retrying') return `Connection hiccup, retrying… (${mb(p.receivedBytes)} MB so far)`;
  if (p.totalBytes) return `Downloading the song… ${Math.floor((100 * p.receivedBytes) / p.totalBytes)}%`;
  return `Downloading the song… ${mb(p.receivedBytes)} MB`;
}

/** Map bridge failures onto the play screen's error handling. */
function toPlayerError(err: unknown): PlayerError {
  if (!(err instanceof BridgeError)) return new PlayerError('api', "Couldn't get this song from YouTube.");
  switch (err.code) {
    case 'cancelled':
      return new PlayerError('cancelled');
    case 'unavailable':
      return new PlayerError(100, err.message); // flagged "Unavailable", skipped
    case 'private':
    case 'age-restricted':
    case 'geo':
    case 'paid':
      return new PlayerError(150, err.message); // flagged "Can't play here", skipped
    default:
      // network, bot-check, extractor ("update the app"), no-audio, storage...
      return new PlayerError('api', err.message);
  }
}
