/**
 * Platform seam: where songs and their metadata come from.
 *
 * The web build reads playlists through the YouTube IFrame API and titles
 * through oEmbed (web.ts). A later phase adds androidtv.ts, backed by the
 * native `window.DanceBridge` (NewPipe), and selects it in getPlatform().
 * UI code must only talk to this interface, never to the bridge directly.
 */

import type { AddedSong } from '../beat/cloud';
import type { MediaPlayer, PlayItem } from '../player/types';
import type { LocalHelper } from './helper';

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
  /**
   * Where cloud beat maps live: `<beatmapBase>beatmaps/<videoId>.json` and
   * `<beatmapBase>beatmaps/status.json`. Absolute, or relative to the page.
   * Web: './' (the site itself). Android TV: the GitHub Pages URL.
   */
  readonly beatmapBase: string;
  /**
   * Whether live beat listening (microphone / tab audio) is offered for
   * songs without a beat map. Android TV analyses downloaded audio instead.
   */
  readonly liveSync: boolean;
  /**
   * Web only: the optional DanceDance helper app on this computer (helper/),
   * which downloads a song's audio for on-device analysis. Absent on TV.
   */
  readonly localHelper?: LocalHelper;

  // --- Android TV only (androidtv.ts); absent on web -----------------------
  /** A player for this item, or null for the default one. TV: audio only, no iframe. */
  createPlayer?(item: PlayItem): MediaPlayer | null;
  /** The song's downloaded audio (encoded), for on-device beat analysis (source 'device'). */
  deviceAudio?(videoId: string): Promise<ArrayBuffer>;
  /** Reports an on-device analysis, for the diagnostics panel. */
  noteAnalysis?(info: DeviceAnalysisNote): void;
  /** Leave the app (BACK pressed on the home screen). */
  exitApp?(): void;
  /** Songs added on this device (TV: from the phone page), merged into "My added songs". */
  localAddedSongs?(): AddedSong[];
  /** Called whenever localAddedSongs() changes; returns an unsubscribe function. */
  onLocalAddedSongsChange?(fn: () => void): () => void;
  /** Really remove a song added on this device (TV: through the bridge); true if it was there. */
  removeLocalAddedSong?(videoId: string): boolean | Promise<boolean>;
}

export interface DeviceAnalysisNote {
  videoId: string;
  /** ms from having the audio bytes to the first usable map. */
  firstMs: number;
  /** ms to the complete map (null while still running). */
  fullMs: number | null;
  /** The first map covered only the start of the song. */
  partial: boolean;
  songSeconds: number;
}

/** Shape the Android shell will inject: see the contract in androidtv.ts. */
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
