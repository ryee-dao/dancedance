/**
 * Reading a YouTube playlist in the browser without an API key.
 *
 *  - parsePlaylistLink(): turn whatever the user pasted into a playlist ID.
 *  - readPlaylistIds():   a temporary hidden IFrame player cues the playlist;
 *                         once CUED, getPlaylist() returns its video IDs (the
 *                         API caps this at 200).
 *  - fetchVideoInfo():    oEmbed for title/channel. YouTube sends CORS headers
 *                         on it; 401 means embedding is disabled, 404 gone.
 *  - fetchSiteEnrichment(): optional ./playlist.json written by the cloud job.
 *
 * The pure helpers at the top have no DOM access so they run in Node tests.
 */

import { createYTPlayer, YTState, type YTPlayer } from './ytApi';

// ---------------------------------------------------------------------------
// Link parsing

export type ParsedLink = { ok: true; listId: string } | { ok: false; error: string };

/** Playlists that only exist for the signed-in user: Watch Later, Liked, Liked Music. */
const PRIVATE_LISTS = new Set(['WL', 'LL', 'LM']);

export const PRIVATE_LIST_MESSAGE =
  "Watch Later and Liked videos are private, so DanceDance can't read them. " +
  'Make a playlist, set it to Public or Unlisted, and paste its link.';

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const ID_RE = /^[A-Za-z0-9_-]+$/;

export function parsePlaylistLink(input: string): ParsedLink {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Paste a YouTube playlist link first.' };

  // Bare ID
  if (ID_RE.test(text)) {
    if (PRIVATE_LISTS.has(text.toUpperCase())) return { ok: false, error: PRIVATE_LIST_MESSAGE };
    if (text.length === 11) {
      return {
        ok: false,
        error: 'That looks like a single video, not a playlist. Open the playlist and copy its link.',
      };
    }
    if (text.length < 12) return { ok: false, error: "That doesn't look like a playlist ID." };
    return { ok: true, listId: text };
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: "That doesn't look like a YouTube playlist link." };
  }
  if (!YT_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: "That isn't a YouTube link. Copy the link from YouTube's Share button." };
  }
  const list = url.searchParams.get('list');
  if (!list) {
    if (url.searchParams.get('v') || url.hostname.endsWith('youtu.be')) {
      return {
        ok: false,
        error: 'That link is a single video, not a playlist. Open the playlist and copy its link.',
      };
    }
    return { ok: false, error: "That link doesn't contain a playlist." };
  }
  if (PRIVATE_LISTS.has(list.toUpperCase())) return { ok: false, error: PRIVATE_LIST_MESSAGE };
  if (!ID_RE.test(list)) return { ok: false, error: "That link's playlist ID looks wrong." };
  return { ok: true, listId: list };
}

// ---------------------------------------------------------------------------
// Title clean-up

const NOISE_RE =
  /\s*[([](?:[^)\]]*\b(?:official|video|audio|lyrics?|visuali[sz]er|hd|hq|4k|remaster(?:ed)?|mv|m\/v)\b[^)\]]*)[)\]]/gi;

/**
 * Turn an oEmbed title + channel into a display title and artist.
 * "Dua Lipa - Levitating (Official Music Video)" -> Levitating / Dua Lipa.
 */
export function cleanTitle(rawTitle: string, author?: string): { title: string; artist?: string } {
  let title = rawTitle.replace(NOISE_RE, '').replace(/\s{2,}/g, ' ').trim();
  if (!title) title = rawTitle.trim();
  const dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) return { artist: dash[1].trim(), title: dash[2].trim() };

  let artist: string | undefined;
  if (author) {
    const a = author.trim();
    if (/ - Topic$/.test(a)) artist = a.replace(/ - Topic$/, '');
    else if (!/vevo$/i.test(a)) artist = a.replace(/\s*(official|music)$/i, '').trim() || a;
  }
  return { title, artist };
}

// ---------------------------------------------------------------------------
// Playlist IDs via a temporary IFrame player

export class PlaylistReadError extends Error {}

export const PLAYLIST_READ_FAILED =
  "Couldn't read that playlist. Check that it's Public or Unlisted.";

/**
 * Resolve the playlist's video IDs (max 200). Uses its own short-lived player
 * so it never disturbs playback.
 */
export async function readPlaylistIds(listId: string, timeoutMs = 10000): Promise<string[]> {
  let player: YTPlayer | null = null;
  let slot: HTMLElement | null = null;
  let finish: ((ids: string[] | null) => void) | null = null;

  const result = new Promise<string[] | null>((resolve) => {
    finish = resolve;
  });
  const tryResolve = () => {
    const ids = player?.getPlaylist?.();
    if (Array.isArray(ids) && ids.length > 0) finish?.(ids.filter((x) => typeof x === 'string'));
  };

  const timer = setTimeout(() => finish?.(null), timeoutMs);
  let poll: ReturnType<typeof setInterval> | null = null;
  try {
    const created = await Promise.race([
      createYTPlayer({
        onStateChange: (e) => {
          if (e.data === YTState.CUED) tryResolve();
        },
        onError: () => finish?.(null),
      }),
      result.then(() => null),
    ]);
    if (created) {
      player = created.player;
      slot = created.el;
      player.cuePlaylist({ listType: 'playlist', list: listId, index: 0 });
      // CUED doesn't always fire (e.g. first entry unavailable): poll as well.
      poll = setInterval(tryResolve, 300);
    }
    const ids = await result;
    if (!ids) throw new PlaylistReadError(PLAYLIST_READ_FAILED);
    return [...new Set(ids)];
  } catch (err) {
    if (err instanceof PlaylistReadError) throw err;
    throw new PlaylistReadError(PLAYLIST_READ_FAILED);
  } finally {
    clearTimeout(timer);
    if (poll !== null) clearInterval(poll);
    try {
      player?.destroy();
    } catch {
      /* ignore */
    }
    slot?.remove();
  }
}

// ---------------------------------------------------------------------------
// oEmbed

export type VideoInfo =
  | { status: 'ok'; title: string; author?: string }
  | { status: 'embed' }
  | { status: 'gone' };

/** Returns null when the answer is unknown (offline, rate limited, etc.). */
export async function fetchVideoInfo(videoId: string): Promise<VideoInfo | null> {
  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`;
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (res.status === 401) return { status: 'embed' };
    if (res.status === 404 || res.status === 400) return { status: 'gone' };
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && typeof (data as { title?: unknown }).title === 'string') {
      const d = data as { title: string; author_name?: unknown };
      return {
        status: 'ok',
        title: d.title,
        author: typeof d.author_name === 'string' ? d.author_name : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ./playlist.json (written by the cloud job in a later phase)

export interface EnrichedVideo {
  videoId: string;
  title: string;
  artist?: string;
}

let enrichmentP: Promise<EnrichedVideo[]> | null = null;

/**
 * The file is optional (404 on most deployments) and only changes on deploy,
 * so the answer, including a 404, is fetched once per page load. A network
 * failure isn't cached, so a later call can try again.
 */
export function fetchSiteEnrichment(): Promise<EnrichedVideo[]> {
  if (!enrichmentP) {
    enrichmentP = loadSiteEnrichment().then((r) => {
      if (r === null) enrichmentP = null;
      return r ?? [];
    });
  }
  return enrichmentP;
}

/** Test hook: forget the cached answer. */
export function resetSiteEnrichmentCache(): void {
  enrichmentP = null;
}

/** null = couldn't reach the server (not cached). */
async function loadSiteEnrichment(): Promise<EnrichedVideo[] | null> {
  let res: Response;
  try {
    res = await fetch('./playlist.json', { cache: 'no-cache' });
  } catch {
    return null;
  }
  try {
    if (!res.ok) return [];
    // A dev server may answer unknown paths with index.html; parse defensively.
    const data: unknown = JSON.parse(await res.text());
    const videos = (data as { videos?: unknown })?.videos;
    if (!Array.isArray(videos)) return [];
    return videos.filter(
      (v): v is EnrichedVideo =>
        !!v && typeof v.videoId === 'string' && typeof v.title === 'string',
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------

/** Run async jobs with at most `limit` in flight. */
export function limitConcurrency(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= limit) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    job();
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
