/**
 * songs.json (songs added by search) and songs-status.json (requests that
 * could not be completed yet): deterministic rendering and planning. Pure.
 *
 *   songs.json         { updatedAt, songs: [{ videoId, title, artist, addedAt, durationSec, hasMap, note?, genre? }] }
 *                      oldest first; a song is listed as soon as its video is picked,
 *                      `hasMap` says whether beatmaps/<videoId>.json exists yet.
 *   songs-status.json  { updatedAt, requests: { [songKey]: { state, artist, title, durationSec?, videoId?, message?, attempts, lastTried } } }
 *                      keys sorted; failed requests ('not-found', or 'blocked'/'error'
 *                      while searching), plus a 'map-pending' note for listed songs
 *                      whose download was refused; removed once the song has a map.
 */
import { parseSongsList, parseSongsStatus, songKey, type AddedSong, type SongRequestStatus } from '../../src/beat/cloud';
import { renderStable, toJsonText } from './output';
import { MAX_ADDS } from './pick';

export { parseSongsList, parseSongsStatus, songKey };
export type { AddedSong, SongRequestStatus };

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
}

export interface AddPlanItem {
  key: string;
  req: AddRequest;
  why: 'new' | 'again' | 'retry';
}

export interface AddSkip {
  key: string;
  req: AddRequest;
  why: 'already added' | 'not found before' | 'waiting to retry';
}

/**
 * The one field order written to songs.json, whatever order the input has:
 * videoId, title, artist, addedAt, durationSec, hasMap (always written; a
 * missing value reads as true), then note? and genre? only when set.
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

function normRequest(r: SongRequestStatus): SongRequestStatus {
  return {
    state: r.state,
    artist: r.artist,
    title: r.title,
    ...(r.durationSec !== undefined ? { durationSec: r.durationSec } : {}),
    ...(r.videoId !== undefined ? { videoId: r.videoId } : {}),
    ...(r.message !== undefined ? { message: r.message } : {}),
    attempts: r.attempts,
    lastTried: r.lastTried,
  };
}

export function renderSongsStatus(prevText: string | undefined, requests: Readonly<Record<string, SongRequestStatus>>, now: string): string {
  const sorted: Record<string, SongRequestStatus> = {};
  for (const k of Object.keys(requests).sort()) sorted[k] = normRequest(requests[k]);
  return renderStable(prevText, 'updatedAt', now, (updatedAt) => toJsonText({ updatedAt, requests: sorted }));
}

const HOUR = 3600_000;

/** Backoff for automatic retries of blocked/error requests: 1 h, 2 h, 4 h ... capped at 24 h. */
export function requestRetryDue(s: SongRequestStatus, now: Date): boolean {
  if (s.state === 'not-found' || s.state === 'map-pending') return false;
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
      prev.explicit ||= r.explicit;
      prev.durationSec ??= r.durationSec;
    }
  }
  const todo: AddPlanItem[] = [];
  const skipped: AddSkip[] = [];
  for (const [key, req] of byKey) {
    const st = status[key];
    if (added.has(key)) skipped.push({ key, req, why: 'already added' });
    else if (!st) todo.push({ key, req, why: 'new' });
    else if (req.explicit) todo.push({ key, req: { ...req, durationSec: req.durationSec ?? st.durationSec }, why: 'again' });
    else if (st.state === 'not-found') skipped.push({ key, req, why: 'not found before' });
    else if (due(st)) todo.push({ key, req: { ...req, durationSec: req.durationSec ?? st.durationSec }, why: 'retry' });
    else skipped.push({ key, req, why: 'waiting to retry' });
  }
  // Automatic retries of earlier blocked/error requests nobody asked for again.
  for (const [key, st] of Object.entries(status).sort(([a], [b]) => a.localeCompare(b))) {
    if (byKey.has(key) || added.has(key) || !due(st)) continue;
    todo.push({ key, req: { artist: st.artist, title: st.title, durationSec: st.durationSec, explicit: false }, why: 'retry' });
  }
  return { todo: todo.slice(0, MAX_ADDS), skipped };
}
