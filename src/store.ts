/**
 * Small typed wrapper around localStorage.
 *
 * Every read and write is wrapped in try/catch: storage can be unavailable
 * (private windows, blocked site data, quota). In that case the app keeps
 * working from an in-memory copy for the rest of the session.
 */

/** Every localStorage key the app uses. Later phases should add theirs here. */
export const STORE_KEYS = {
  played: 'dd.played', // string[] of video IDs that have actually started playing
  blocked: 'dd.blocked', // Record<videoId, BlockInfo> learned from player errors
  playlistLink: 'dd.playlistLink', // PlaylistLink | null
  playlistCache: 'dd.playlistCache', // PlaylistCache | null: last successful read
  titles: 'dd.titles', // Record<videoId, TitleEntry>: oEmbed results
  settings: 'dd.settings', // Settings
} as const;

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

export interface Settings {
  /** Shifts everything synced to the music (later phase). */
  audioOffsetMs: number;
  /** Choreography intensity (later phase). */
  intensity: Intensity;
}

export const DEFAULT_SETTINGS: Settings = { audioOffsetMs: 0, intensity: 'cardio' };

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

  // --- settings -----------------------------------------------------------
  settings(): Settings {
    const s = readJson<Partial<Settings>>(STORE_KEYS.settings, {}, isObj);
    return { ...DEFAULT_SETTINGS, ...s };
  },
  updateSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.settings(), ...patch };
    writeJson(STORE_KEYS.settings, next);
    return next;
  },
};
