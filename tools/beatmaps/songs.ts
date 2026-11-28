/**
 * songs.json (songs added by search) and songs-status.json (requests that
 * could not be completed yet): deterministic rendering and planning. Pure.
 *
 *   songs.json         { updatedAt, songs: [{ videoId, title, artist, addedAt, durationSec, hasMap, note?, genre?, genres?, genreLevels?, artistGenres? }] }
 *                      oldest first; a song is listed as soon as its video is picked,
 *                      `hasMap` says whether beatmaps/<videoId>.json exists yet.
 *   songs-status.json  { updatedAt, requests: { [songKey]: { state, artist, title, durationSec?, videoId?, force?, message?, attempts, lastTried } } }
 *                      keys sorted; failed requests ('not-found', or 'blocked'/'error'
 *                      while searching), plus a 'map-pending' note for listed songs
 *                      whose download was refused; removed once the song has a map.
 *                      A map-pending note may carry `refused`: other uploads of the song
 *                      YouTube also withheld (videoId + when), so later runs skip them
 *                      for a while (REFUSED_FOR_MS). The app ignores the field.
 *                      'video-mismatch': a video the person chose (videoId) that doesn't look
 *                      like the song; the app offers "Use it anyway" (sent again with force).
 *                      A request with a chosen video keeps `videoId` / `force` in its
 *                      'blocked' / 'error' entry, so the automatic retry uses that video.
 */
import { parseSongsList, parseSongsStatus, songKey, type AddedSong, type SongRequestStatus } from '../../src/beat/cloud';
import { renderStable, toJsonText } from './output';
import { MAX_ADDS } from './pick';

export { parseSongsList, parseSongsStatus, songKey };
export type { AddedSong, SongRequestStatus };

/** Another upload of a song that YouTube withheld from the cloud job. */
export interface Refusal {
  videoId: string;
  /** ISO timestamp. */
  lastTried: string;
}

/** A songs-status.json request as the job keeps it: the app's fields plus `refused` (map-pending notes). */
export type RequestStatus = SongRequestStatus & { refused?: Refusal[] };

/** How long a withheld alternate upload is left alone before it may be tried again. */
export const REFUSED_FOR_MS = 3 * 24 * 3600_000;
/** Most refusals kept per song (newest first). */
export const MAX_REFUSALS = 12;

const REFUSAL_ID = /^[A-Za-z0-9_-]{11}$/;

/** parseSongsStatus, keeping each map-pending note's well-formed `refused` list. */
export function parseRequests(text: string): Record<string, RequestStatus> {
  const out: Record<string, RequestStatus> = parseSongsStatus(text);
  let raw: Record<string, { refused?: unknown }> = {};
  try {
    raw = ((JSON.parse(text) as { requests?: unknown })?.requests ?? {}) as Record<string, { refused?: unknown }>;
  } catch {
    return out;
  }
  for (const [key, r] of Object.entries(out)) {
    const list = r.state === 'map-pending' ? raw[key]?.refused : undefined;
    if (!Array.isArray(list)) continue;
    const refused = list
      .filter((x): x is Refusal => !!x && typeof x.videoId === 'string' && REFUSAL_ID.test(x.videoId) && typeof x.lastTried === 'string' && Number.isFinite(Date.parse(x.lastTried)))
      .map((x) => ({ videoId: x.videoId, lastTried: x.lastTried }))
      .slice(0, MAX_REFUSALS);
    if (refused.length) r.refused = refused;
  }
  return out;
}

/** Merge new refusals into a list: one entry per video (the newest time), newest first, expired ones dropped, capped. */
export function mergeRefusals(prev: readonly Refusal[] | undefined, ids: readonly string[], now: Date): Refusal[] {
  const at = now.toISOString();
  const byId = new Map<string, string>();
  for (const id of ids) byId.set(id, at);
  for (const r of prev ?? []) if (!byId.has(r.videoId) && now.getTime() - Date.parse(r.lastTried) < REFUSED_FOR_MS) byId.set(r.videoId, r.lastTried);
  return [...byId]
    .map(([videoId, lastTried]) => ({ videoId, lastTried }))
    .sort((a, b) => (a.lastTried < b.lastTried ? 1 : a.lastTried > b.lastTried ? -1 : a.videoId.localeCompare(b.videoId)))
    .slice(0, MAX_REFUSALS);
}

/** Video IDs refused within REFUSED_FOR_MS of `now`. */
export function recentRefusals(list: readonly Refusal[] | undefined, now: Date): Set<string> {
  return new Set((list ?? []).filter((r) => now.getTime() - Date.parse(r.lastTried) < REFUSED_FOR_MS).map((r) => r.videoId));
}

export interface AddRequest {
  artist: string;
  title: string;
  /** Official length; looked up on iTunes when missing. */
  durationSec?: number;
  /**
   * Asked for on this run (workflow inputs / CLI): retried even if it failed
   * before. Queue entries from the app and automatic retries are not explicit.
   */
  explicit: boolean;
  /** The video the person chose (a pasted link): checked and used instead of a search. */
  videoId?: string;
  /** With `videoId`: add it even if it doesn't look like the song ("Use it anyway"). */
  force?: boolean;
}

export interface AddPlanItem {
  key: string;
  req: AddRequest;
  why: 'new' | 'again' | 'retry';
}

export interface AddSkip {
  key: string;
  req: AddRequest;
  why: 'already added' | 'not found before' | 'waiting to retry' | 'waiting for the person';
}

/**
 * The one field order written to songs.json, whatever order the input has:
 * videoId, title, artist, addedAt, durationSec, hasMap (always written; a
 * missing value reads as true), then note?, genre?, genres?, genreLevels? and
 * artistGenres? only when set.
 */
function normSong(s: AddedSong): AddedSong {
  return {
    videoId: s.videoId,
    title: s.title,
    artist: s.artist,
    addedAt: s.addedAt,
    durationSec: s.durationSec,
    hasMap: s.hasMap !== false,
    ...(s.note ? { note: s.note } : {}),
    ...(s.genre ? { genre: s.genre } : {}),
    ...(s.genres?.length ? { genres: [...s.genres] } : {}),
    ...(s.genres?.length && s.genreLevels?.length === s.genres.length ? { genreLevels: [...s.genreLevels] } : {}),
    ...(s.artistGenres?.length ? { artistGenres: [...s.artistGenres] } : {}),
  };
}

/** Oldest first, then by key, so appending never reorders earlier lines. */
export function sortSongs(songs: AddedSong[]): AddedSong[] {
  return songs
    .map(normSong)
    .sort((a, b) => (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : songKey(a.artist, a.title).localeCompare(songKey(b.artist, b.title))));
}

export function renderSongs(prevText: string | undefined, songs: AddedSong[], now: string): string {
  const list = sortSongs(songs);
  return renderStable(prevText, 'updatedAt', now, (updatedAt) => toJsonText({ updatedAt, songs: list }));
}

function normRequest(r: RequestStatus): RequestStatus {
  return {
    state: r.state,
    artist: r.artist,
    title: r.title,
    ...(r.durationSec !== undefined ? { durationSec: r.durationSec } : {}),
    ...(r.videoId !== undefined ? { videoId: r.videoId } : {}),
    ...(r.videoId !== undefined && r.force ? { force: true } : {}),
    ...(r.message !== undefined ? { message: r.message } : {}),
    attempts: r.attempts,
    lastTried: r.lastTried,
    ...(r.state === 'map-pending' && r.refused?.length ? { refused: r.refused.map((x) => ({ videoId: x.videoId, lastTried: x.lastTried })) } : {}),
  };
}

export function renderSongsStatus(prevText: string | undefined, requests: Readonly<Record<string, RequestStatus>>, now: string): string {
  const sorted: Record<string, RequestStatus> = {};
  for (const k of Object.keys(requests).sort()) sorted[k] = normRequest(requests[k]);
  return renderStable(prevText, 'updatedAt', now, (updatedAt) => toJsonText({ updatedAt, requests: sorted }));
}

const HOUR = 3600_000;

/** Backoff for automatic retries of blocked/error requests: 1 h, 2 h, 4 h ... capped at 24 h. */
export function requestRetryDue(s: SongRequestStatus, now: Date): boolean {
  if (s.state === 'not-found' || s.state === 'map-pending' || s.state === 'video-mismatch') return false;
  const last = Date.parse(s.lastTried);
  if (!Number.isFinite(last)) return true;
  const delay = Math.min(24 * HOUR, HOUR * 2 ** Math.max(0, s.attempts - 1));
  return now.getTime() + 10 * 60_000 >= last + delay;
}

/**
 * Which add requests this run works on: explicit requests (unless already
 * added), queued requests the job has never seen, and due automatic retries.
 */
export function planAdds(
  requests: AddRequest[],
  songs: AddedSong[],
  status: Readonly<Record<string, SongRequestStatus>>,
  now: Date,
  /** Local sync: retry blocked/error requests now, ignoring their backoff. */
  retryBlocked = false,
): { todo: AddPlanItem[]; skipped: AddSkip[] } {
  const due = (st: SongRequestStatus) => (retryBlocked && (st.state === 'blocked' || st.state === 'error')) || requestRetryDue(st, now);
  const added = new Set(songs.map((s) => songKey(s.artist, s.title)));
  const byKey = new Map<string, AddRequest>();
  for (const r of requests) {
    const key = songKey(r.artist, r.title);
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, { ...r });
    else {
      // The explicit request (this run's own) says which video, if any; else the first that names one.
      if (r.explicit && !prev.explicit) {
        if (r.videoId) {
          prev.videoId = r.videoId;
          prev.force = r.force;
        } else {
          delete prev.videoId;
          delete prev.force;
        }
      } else if (!prev.explicit && !prev.videoId && r.videoId) {
        prev.videoId = r.videoId;
        prev.force = r.force;
      }
      prev.explicit ||= r.explicit;
      prev.durationSec ??= r.durationSec;
    }
  }
  // A blocked/error entry of a request with a chosen video: retried with that video, not a search.
  const chosen = (st: SongRequestStatus) =>
    (st.state === 'blocked' || st.state === 'error') && st.videoId ? { videoId: st.videoId, ...(st.force ? { force: true } : {}) } : {};
  const todo: AddPlanItem[] = [];
  const skipped: AddSkip[] = [];
  for (const [key, req] of byKey) {
    const st = status[key];
    if (req.videoId === undefined) delete req.force;
    if (added.has(key)) skipped.push({ key, req, why: 'already added' });
    else if (!st) todo.push({ key, req, why: 'new' });
    else if (req.explicit) todo.push({ key, req: { ...req, durationSec: req.durationSec ?? st.durationSec }, why: 'again' });
    else if (st.state === 'not-found' || st.state === 'video-mismatch') {
      // A queued request (re-sent by the app) asking for what this answer didn't cover: a video
      // other than the one checked, or the same one with "Use it anyway" (a run GitHub dropped).
      const unanswered = !!req.videoId && (req.videoId !== st.videoId || (!!req.force && st.state === 'video-mismatch'));
      if (unanswered) todo.push({ key, req: { ...req, durationSec: req.durationSec ?? st.durationSec }, why: 'new' });
      else skipped.push({ key, req, why: st.state === 'not-found' ? 'not found before' : 'waiting for the person' });
    } else if (due(st)) todo.push({ key, req: { ...req, durationSec: req.durationSec ?? st.durationSec, ...(req.videoId ? {} : chosen(st)) }, why: 'retry' });
    else skipped.push({ key, req, why: 'waiting to retry' });
  }
  // Automatic retries of earlier blocked/error requests nobody asked for again.
  for (const [key, st] of Object.entries(status).sort(([a], [b]) => a.localeCompare(b))) {
    if (byKey.has(key) || added.has(key) || !due(st)) continue;
    todo.push({ key, req: { artist: st.artist, title: st.title, durationSec: st.durationSec, explicit: false, ...chosen(st) }, why: 'retry' });
  }
  return { todo: todo.slice(0, MAX_ADDS), skipped };
}
