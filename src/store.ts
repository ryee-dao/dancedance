/**
 * Small typed wrapper around localStorage.
 *
 * Every read and write is wrapped in try/catch: storage can be unavailable
 * (private windows, blocked site data, quota). In that case the app keeps
 * working from an in-memory copy for the rest of the session.
 */

import { DEFAULT_COACH_STYLE, parseCoachStyle, type CoachStyle } from './core/coach/styles';

/** Every localStorage key the app uses. Later phases should add theirs here. */
export const STORE_KEYS = {
  played: 'dd.played', // string[] of video IDs that have actually started playing
  blocked: 'dd.blocked', // Record<videoId, BlockInfo> learned from player errors
  playlistLink: 'dd.playlistLink', // PlaylistLink | null
  playlistCache: 'dd.playlistCache', // PlaylistCache | null: last successful read
  titles: 'dd.titles', // Record<videoId, TitleEntry>: oEmbed results
  settings: 'dd.settings', // Settings
  levels: 'dd.levels', // Record<videoId, Intensity>: last level (Chill/Cardio/Sweaty) picked per song
  bpm: 'dd.bpm', // Record<cacheKey, number>: tempo of beat maps cached on this device
  githubToken: 'dd.githubToken', // string: fine-grained GitHub token for "Add a song" (web; never logged or put in a URL)
  githubRepo: 'dd.githubRepo', // string "owner/repo", typed on the connect step when it can't be worked out
  addRelay: 'dd.addRelay', // string: "add a song" relay (Cloudflare Worker) address, when not built in
  addPassphrase: 'dd.addPassphrase', // string: the relay's optional shared passphrase
  addPending: 'dd.addPending', // PendingAdd[]: songs sent to the cloud that haven't appeared in songs.json yet
  addedHidden: 'dd.addedHidden', // string[]: video IDs removed from "My added songs" on this device only
  plays: 'dd.plays', // Record<videoId, number>: how many times each song has started playing (least recently played first)
} as const;

/** A song sent to the cloud job, waiting to show up in songs.json. */
export interface PendingAdd {
  /** songKey(artist, title) */
  key: string;
  artist: string;
  title: string;
  durationSec: number;
  artworkUrl?: string;
  /** iTunes track ID (the relay re-sends waiting songs by ID). */
  trackId?: number;
  /** Epoch ms of the last successful send to GitHub. */
  sentAt: number;
}

export type BlockReason = 'embed' | 'gone';

export interface BlockInfo {
  reason: BlockReason;
  /** Epoch ms when it was flagged. */
  t: number;
}

export interface PlaylistLink {
  /** What the user pasted. */
  input: string;
  /** Parsed playlist ID. */
  listId: string;
}

export interface PlaylistCache {
  listId: string;
  videoIds: string[];
  /** Epoch ms of the read. */
  readAt: number;
}

export interface TitleEntry {
  /** 'ok' = oEmbed 200, 'embed' = 401 (embedding disabled), 'gone' = 404. */
  status: 'ok' | 'embed' | 'gone';
  title?: string;
  author?: string;
  /** Epoch ms of the lookup. */
  t: number;
}

export type Intensity = 'chill' | 'cardio' | 'sweaty';
export const INTENSITIES: readonly Intensity[] = ['chill', 'cardio', 'sweaty'];

/**
 * Live beat listening for songs without a beat map:
 * 'ask' = show the one-time microphone explainer first; 'mic' = listen with
 * the microphone; 'off' = the user said "Not now" (the pause menu still
 * offers it).
 */
export type LiveSyncPref = 'ask' | 'mic' | 'off';

/** 'same': a song always gets the same routine; 'fresh': a new one each play. Same union as coachStage's RoutineMode. */
export type RoutineMode = 'same' | 'fresh';
export const ROUTINE_MODES: readonly RoutineMode[] = ['same', 'fresh'];

/** At most this many songs keep a play count (the least recently played are dropped). */
export const MAX_PLAY_COUNTS = 2000;
const MAX_PLAYS = 1_000_000;

export interface Settings {
  /**
   * Shifts everything synced to the music, ms, -500..500 in 10 ms steps.
   * Positive = the coach moves later (speakers that lag).
   */
  audioOffsetMs: number;
  /** Choreography intensity. */
  intensity: Intensity;
  liveSync: LiveSyncPref;
  /** The coach's look (Options screen). A `?coach=` URL parameter overrides it. */
  coachStyle: CoachStyle;
  /** Routine per play (Options screen). */
  routineMode: RoutineMode;
}

export const DEFAULT_SETTINGS: Settings = {
  audioOffsetMs: 0,
  intensity: 'cardio',
  liveSync: 'ask',
  coachStyle: DEFAULT_COACH_STYLE,
  routineMode: 'same',
};

/** Drop out-of-range or wrongly typed values (old versions, hand edits). */
function sanitizeSettings(s: Partial<Record<keyof Settings, unknown>>): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  const off = s.audioOffsetMs;
  if (typeof off === 'number' && Number.isFinite(off)) {
    out.audioOffsetMs = Math.max(-500, Math.min(500, Math.round(off / 10) * 10)) || 0;
  }
  if (typeof s.intensity === 'string' && (INTENSITIES as readonly string[]).includes(s.intensity)) {
    out.intensity = s.intensity as Intensity;
  }
  if (s.liveSync === 'ask' || s.liveSync === 'mic' || s.liveSync === 'off') out.liveSync = s.liveSync;
  out.coachStyle = parseCoachStyle(s.coachStyle) ?? DEFAULT_COACH_STYLE;
  if (s.routineMode === 'same' || s.routineMode === 'fresh') out.routineMode = s.routineMode;
  return out;
}

/** Keep whole, non-negative, finite counts for string keys; at most MAX_PLAY_COUNTS (the last ones). */
export function sanitizePlayCounts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  const entries = Object.entries(v).filter(
    (e): e is [string, number] => e[0].length > 0 && typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 1,
  );
  for (const [k, n] of entries.slice(-MAX_PLAY_COUNTS)) out[k] = Math.min(MAX_PLAYS, Math.floor(n));
  return out;
}

// ---------------------------------------------------------------------------
// Raw access with in-memory fallback

const memory = new Map<string, string>();

function rawGet(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    /* storage unavailable: fall through to memory */
  }
  return memory.get(key) ?? null;
}

function rawSet(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable or full: memory copy still serves this session */
  }
}

function readJson<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  const raw = rawGet(key);
  if (raw === null) return fallback;
  try {
    const v: unknown = JSON.parse(raw);
    return valid(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    rawSet(key, value === null ? null : JSON.stringify(value));
  } catch {
    /* JSON.stringify can't really fail on our data, but stay defensive */
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// ---------------------------------------------------------------------------
// Parsed values are cached in memory so hot paths (tile rendering) don't
// re-parse JSON. The title cache can be written ~200 times in a burst, so its
// writes are coalesced.

let played: Set<string> | null = null;
let blocked: Record<string, BlockInfo> | null = null;
let titles: Record<string, TitleEntry> | null = null;
let titlesFlushTimer: ReturnType<typeof setTimeout> | null = null;
let levels: Record<string, Intensity> | null = null;
let localBpm: Record<string, number> | null = null;
let plays: Record<string, number> | null = null;

function flushTitles(): void {
  if (titlesFlushTimer !== null) clearTimeout(titlesFlushTimer);
  titlesFlushTimer = null;
  if (titles) writeJson(STORE_KEYS.titles, titles);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushTitles);
}

export const store = {
  // --- played -------------------------------------------------------------
  isPlayed(videoId: string): boolean {
    return this.played().has(videoId);
  },
  played(): Set<string> {
    if (!played) {
      const arr = readJson<string[]>(STORE_KEYS.played, [], Array.isArray);
      played = new Set(arr.filter((x) => typeof x === 'string'));
    }
    return played;
  },
  markPlayed(videoId: string): void {
    const s = this.played();
    if (s.has(videoId)) return;
    s.add(videoId);
    writeJson(STORE_KEYS.played, [...s]);
  },

  // --- play counts -------------------------------------------------------
  /** How many times this song has started playing on this device. */
  playCount(videoId: string): number {
    if (!plays) plays = sanitizePlayCounts(readJson<unknown>(STORE_KEYS.plays, {}, isObj));
    return plays[videoId] ?? 0;
  },
  /** One more play (moves the song to the most recently played end). */
  bumpPlayCount(videoId: string): void {
    if (!videoId) return;
    const n = Math.min(MAX_PLAYS, this.playCount(videoId) + 1);
    delete plays![videoId];
    plays![videoId] = n;
    const keys = Object.keys(plays!);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PLAY_COUNTS))) delete plays![k];
    writeJson(STORE_KEYS.plays, plays);
  },

  // --- blocked (from player errors) ---------------------------------------
  blocked(): Record<string, BlockInfo> {
    if (!blocked) blocked = readJson(STORE_KEYS.blocked, {}, isObj);
    return blocked;
  },
  setBlocked(videoId: string, reason: BlockReason | null): void {
    const b = this.blocked();
    if (reason === null) {
      if (!(videoId in b)) return;
      delete b[videoId];
    } else {
      b[videoId] = { reason, t: Date.now() };
    }
    writeJson(STORE_KEYS.blocked, b);
  },

  // --- playlist link + cache ----------------------------------------------
  playlistLink(): PlaylistLink | null {
    return readJson<PlaylistLink | null>(
      STORE_KEYS.playlistLink,
      null,
      (v) => isObj(v) && typeof v.listId === 'string' && typeof v.input === 'string',
    );
  },
  setPlaylistLink(link: PlaylistLink | null): void {
    writeJson(STORE_KEYS.playlistLink, link);
  },
  playlistCache(): PlaylistCache | null {
    return readJson<PlaylistCache | null>(
      STORE_KEYS.playlistCache,
      null,
      (v) => isObj(v) && typeof v.listId === 'string' && Array.isArray(v.videoIds),
    );
  },
  setPlaylistCache(cache: PlaylistCache | null): void {
    writeJson(STORE_KEYS.playlistCache, cache);
  },

  // --- title cache (oEmbed) -----------------------------------------------
  titles(): Record<string, TitleEntry> {
    if (!titles) titles = readJson(STORE_KEYS.titles, {}, isObj);
    return titles;
  },
  setTitle(videoId: string, entry: TitleEntry): void {
    this.titles()[videoId] = entry;
    if (titlesFlushTimer === null) titlesFlushTimer = setTimeout(flushTitles, 500);
  },

  // --- per-song level (Chill / Cardio / Sweaty) -------------------------
  songLevel(videoId: string): Intensity | null {
    if (!levels) levels = readJson(STORE_KEYS.levels, {}, isObj);
    const v = levels[videoId];
    return (INTENSITIES as readonly unknown[]).includes(v) ? v : null;
  },
  setSongLevel(videoId: string, level: Intensity): void {
    this.songLevel(videoId);
    if (levels![videoId] === level) return;
    levels![videoId] = level;
    writeJson(STORE_KEYS.levels, levels);
  },

  // --- tempo of locally cached beat maps (for BPM badges) ----------------
  localBpm(key: string): number | null {
    if (!localBpm) localBpm = readJson(STORE_KEYS.bpm, {}, isObj);
    const v = localBpm[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  },
  setLocalBpm(key: string, bpm: number): void {
    if (!(bpm > 0) || !Number.isFinite(bpm)) return;
    this.localBpm(key);
    const r = Math.round(bpm * 10) / 10;
    if (localBpm![key] === r) return;
    localBpm![key] = r;
    writeJson(STORE_KEYS.bpm, localBpm);
  },

  // --- "Add a song": GitHub connection (web) ------------------------------
  githubToken(): string | null {
    const v = rawGet(STORE_KEYS.githubToken);
    return v && v.trim() ? v : null;
  },
  setGithubToken(token: string | null): void {
    rawSet(STORE_KEYS.githubToken, token && token.trim() ? token.trim() : null);
  },
  githubRepo(): string | null {
    const v = rawGet(STORE_KEYS.githubRepo);
    return v && v.trim() ? v : null;
  },
  setGithubRepo(repo: string | null): void {
    rawSet(STORE_KEYS.githubRepo, repo && repo.trim() ? repo.trim() : null);
  },

  addRelay(): string | null {
    const v = rawGet(STORE_KEYS.addRelay);
    return v && v.trim() ? v : null;
  },
  setAddRelay(url: string | null): void {
    rawSet(STORE_KEYS.addRelay, url && url.trim() ? url.trim() : null);
  },
  addPassphrase(): string | null {
    const v = rawGet(STORE_KEYS.addPassphrase);
    return v ? v : null;
  },
  setAddPassphrase(p: string | null): void {
    rawSet(STORE_KEYS.addPassphrase, p ? p : null);
  },

  // --- "Add a song": pending requests and locally hidden songs -------------
  pendingAdds(): PendingAdd[] {
    const arr = readJson<unknown[]>(STORE_KEYS.addPending, [], Array.isArray);
    return arr.filter(
      (p): p is PendingAdd =>
        isObj(p) &&
        typeof p.key === 'string' &&
        typeof p.artist === 'string' &&
        typeof p.title === 'string' &&
        typeof p.durationSec === 'number' &&
        typeof p.sentAt === 'number',
    );
  },
  setPendingAdds(list: PendingAdd[]): void {
    writeJson(STORE_KEYS.addPending, list.length ? list : null);
  },
  hiddenAdded(): Set<string> {
    const arr = readJson<unknown[]>(STORE_KEYS.addedHidden, [], Array.isArray);
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  },
  setHiddenAdded(ids: Set<string>): void {
    writeJson(STORE_KEYS.addedHidden, ids.size ? [...ids] : null);
  },

  // --- settings -----------------------------------------------------------
  settings(): Settings {
    const s = readJson<Partial<Settings>>(STORE_KEYS.settings, {}, isObj);
    return sanitizeSettings(s);
  },
  updateSettings(patch: Partial<Settings>): Settings {
    const next = sanitizeSettings({ ...this.settings(), ...patch });
    writeJson(STORE_KEYS.settings, next);
    return next;
  },
};
