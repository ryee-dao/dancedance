/**
 * Deterministic, diff-friendly rendering of index.json, status.json and
 * playlist.json, plus playlist metadata parsing. Pure: no I/O.
 *
 * Every file carries a timestamp, and the timestamp only moves when the rest
 * of the file changes, so a run that changes nothing produces no commit.
 */
import type { Candidate, VideoStatus } from './select';

export interface PlaylistVideo {
  videoId: string;
  title: string;
  artist?: string;
}

export interface PlaylistInfo {
  playlistId: string;
  videos: PlaylistVideo[];
  /** Same videos with the metadata the planner uses. */
  candidates: Candidate[];
}

/** Pretty JSON with a trailing newline (stable for a given object shape). */
export function toJsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Render with the previous timestamp if that reproduces the previous file
 * byte for byte (nothing changed); otherwise render with `now`.
 */
export function renderStable(prevText: string | undefined, tsKey: string, now: string, render: (ts: string) => string): string {
  if (prevText !== undefined) {
    try {
      const prevTs = (JSON.parse(prevText) as Record<string, unknown>)[tsKey];
      if (typeof prevTs === 'string' && render(prevTs) === prevText) return prevText;
    } catch {
      // Unreadable previous file: rewrite it.
    }
  }
  return render(now);
}

/** What index.json needs to know about one beat-map file. */
export interface MapInfo {
  analyzerVersion: string;
  bpm: number;
  duration: number;
  /** The map's `source` ('cloud' from this job; 'tab' / 'device' when contributed). */
  source?: string;
  /** Fraction of the song between its first and last beat. */
  span?: number;
}

/**
 * index.json: `{ analyzerVersion, generatedAt, ids, songs: { [id]: { bpm, duration, genre? } } }`.
 * IDs and song keys are sorted; bpm has 1 decimal, duration whole seconds.
 * `genre` (iTunes primary genre) is only present for songs listed in `genres`.
 */
export function renderIndex(
  prevText: string | undefined,
  analyzerVersion: string,
  maps: ReadonlyMap<string, MapInfo>,
  now: string,
  genres?: ReadonlyMap<string, string>,
): string {
  const ids = [...maps.keys()].sort();
  const songs: Record<string, { bpm: number; duration: number; genre?: string }> = {};
  for (const id of ids) {
    const m = maps.get(id)!;
    const genre = genres?.get(id);
    songs[id] = { bpm: Math.round(m.bpm * 10) / 10, duration: Math.round(m.duration), ...(genre ? { genre } : {}) };
  }
  return renderStable(prevText, 'generatedAt', now, (generatedAt) => toJsonText({ analyzerVersion, generatedAt, ids, songs }));
}

/** Normalise one status entry to a fixed field order (drops unknown fields). */
function normStatus(s: VideoStatus): VideoStatus {
  return {
    state: s.state,
    ...(s.reason !== undefined && s.state !== 'ok' ? { reason: s.reason } : {}),
    ...(s.message !== undefined && s.state !== 'ok' ? { message: s.message } : {}),
    attempts: s.attempts,
    lastTried: s.lastTried,
  };
}

export function renderStatus(prevText: string | undefined, videos: Readonly<Record<string, VideoStatus>>, now: string): string {
  const sorted: Record<string, VideoStatus> = {};
  for (const id of Object.keys(videos).sort()) sorted[id] = normStatus(videos[id]);
  return renderStable(prevText, 'updatedAt', now, (updatedAt) => toJsonText({ updatedAt, videos: sorted }));
}

export function renderPlaylist(prevText: string | undefined, playlistId: string, videos: PlaylistVideo[], now: string): string {
  const list = videos.map((v) => (v.artist ? { videoId: v.videoId, title: v.title, artist: v.artist } : { videoId: v.videoId, title: v.title }));
  return renderStable(prevText, 'updatedAt', now, (updatedAt) => toJsonText({ updatedAt, playlistId, videos: list }));
}

/** Parse the `videos` of a previous status.json, dropping malformed entries. */
export function parseStatus(text: string | undefined): Record<string, VideoStatus> {
  if (!text) return {};
  try {
    const videos = (JSON.parse(text) as { videos?: unknown }).videos;
    if (!videos || typeof videos !== 'object') return {};
    const out: Record<string, VideoStatus> = {};
    for (const [id, raw] of Object.entries(videos as Record<string, unknown>)) {
      const s = raw as Partial<VideoStatus> | null;
      if (!s || (s.state !== 'ok' && s.state !== 'blocked' && s.state !== 'error')) continue;
      out[id] = {
        state: s.state,
        ...(typeof s.reason === 'string' ? { reason: s.reason } : {}),
        ...(typeof s.message === 'string' ? { message: s.message } : {}),
        attempts: typeof s.attempts === 'number' && s.attempts >= 0 ? Math.floor(s.attempts) : 0,
        lastTried: typeof s.lastTried === 'string' ? s.lastTried : '',
      } as VideoStatus;
    }
    return out;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Playlist metadata

const TITLE_NOISE =
  /\s*[([](?:official\s*(?:music\s*)?(?:video|audio|visuali[sz]er|lyric(?:s)?\s*video|hd\s*video)|lyrics?(?:\s*video)?|audio|visuali[sz]er|hd|hq|4k(?:\s*remaster(?:ed)?)?|(?:\d{4}\s*)?remaster(?:ed)?(?:\s*\d{4})?|music\s*video|video\s*oficial|explicit)[)\]]\s*/gi;

/**
 * Best-effort title/artist from a YouTube title and channel name:
 * "Dua Lipa - Levitating (Official Music Video)" -> { artist: 'Dua Lipa', title: 'Levitating' }.
 * Falls back to the channel name ("Dua Lipa - Topic" -> "Dua Lipa"; VEVO channels are not used).
 */
export function splitTitle(rawTitle: string, channel?: string): { title: string; artist?: string } {
  const cleaned = rawTitle.replace(TITLE_NOISE, ' ').replace(/\s{2,}/g, ' ').trim() || rawTitle.trim();
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(cleaned);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  let artist = channel?.trim();
  if (artist) artist = artist.replace(/\s*-\s*Topic$/i, '').trim();
  if (!artist || /vevo$/i.test(artist)) return { title: cleaned };
  return { title: cleaned, artist };
}

const PLACEHOLDER_TITLES = /^\[(?:private|deleted|unavailable) video\]$/i;

/** Turn `yt-dlp --flat-playlist -J` output into playlist.json entries and planner candidates. */
export function parseFlatPlaylist(json: unknown): PlaylistInfo {
  const data = (json ?? {}) as { id?: unknown; entries?: unknown };
  const playlistId = typeof data.id === 'string' ? data.id : '';
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const videos: PlaylistVideo[] = [];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id)) continue;
    const rawTitle = typeof e.title === 'string' ? e.title : '';
    if (PLACEHOLDER_TITLES.test(rawTitle.trim())) continue;
    if (e.availability === 'private' || e.availability === 'needs_auth' || e.availability === 'subscriber_only') continue;
    seen.add(id);
    const channel = [e.channel, e.uploader].find((x): x is string => typeof x === 'string' && x.length > 0);
    const { title, artist } = rawTitle ? splitTitle(rawTitle, channel) : { title: id, artist: undefined };
    videos.push(artist ? { videoId: id, title, artist } : { videoId: id, title });
    const c: Candidate = { videoId: id, title, origin: 'playlist' };
    if (artist) c.artist = artist;
    if (typeof e.duration === 'number' && Number.isFinite(e.duration)) c.duration = e.duration;
    if (typeof e.live_status === 'string') c.liveStatus = e.live_status;
    candidates.push(c);
  }
  return { playlistId, videos, candidates };
}

/** Extract the `list=` ID from a playlist URL (or accept a bare ID). */
export function playlistIdFromUrl(url: string): string | null {
  const s = url.trim();
  if (/^[A-Za-z0-9_-]{10,64}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const list = u.searchParams.get('list');
    return list && /^[A-Za-z0-9_-]{10,64}$/.test(list) ? list : null;
  } catch {
    return null;
  }
}

/**
 * Normalise cookie-file text pasted into a secret: CRLF -> LF, and add the
 * Netscape header line that yt-dlp requires when it is missing.
 */
export function normalizeCookies(text: string): string {
  let t = text.replace(/\r\n?/g, '\n').trim();
  if (!/^#\s*(?:Netscape )?HTTP Cookie File/i.test(t)) t = `# Netscape HTTP Cookie File\n${t}`;
  return `${t}\n`;
}
