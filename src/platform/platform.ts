/**
 * Platform seam: where songs and their metadata come from.
 *
 * The web build reads playlists through the YouTube IFrame API and titles
 * through oEmbed (web.ts). A later phase adds androidtv.ts, backed by the
 * native `window.DanceBridge` (NewPipe), and selects it in getPlatform().
 * UI code must only talk to this interface, never to the bridge directly.
 */

export interface PlaylistEntry {
  videoId: string;
  /** Present when the source already knows it (e.g. native bridge). */
  title?: string;
  artist?: string;
}

/** 'ok' with metadata; 'embed' = owner disabled embedding; 'gone' = removed. */
export type VideoLookup =
  | { status: 'ok'; title: string; author?: string }
  | { status: 'embed' }
  | { status: 'gone' };

export interface Platform {
  readonly id: 'web' | 'androidtv';
  /** Running on a TV (remote-only input, no file picker, no mouse). */
  readonly isTV: boolean;
  /** Whether "Play a file" (file input / drag-and-drop) makes sense here. */
  readonly canPlayFiles: boolean;
  /**
   * Read a playlist's entries (max 200 on web).
   * Rejects with an Error whose message is suitable to show the user.
   */
  getPlaylist(listId: string): Promise<PlaylistEntry[]>;
  /** Title and embeddability. Resolves null when unknown (network, rate limit). */
  lookupVideo(videoId: string): Promise<VideoLookup | null>;
  /** Extra titles published with the site (./playlist.json). Never rejects. */
  getEnrichment(): Promise<PlaylistEntry[]>;
}

/** Shape the Android shell will inject (later phase). Declared here so the seam is explicit. */
declare global {
  interface Window {
    DanceBridge?: unknown;
  }
}

let current: Platform | null = null;

export function setPlatform(p: Platform): void {
  current = p;
}

export function getPlatform(): Platform {
  if (!current) throw new Error('Platform not initialised: call setPlatform() at startup');
  return current;
}
