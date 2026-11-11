/** Shared types for the two media players (YouTube IFrame and <audio>). */

export type PlayItem =
  | { kind: 'youtube'; videoId: string; title: string; artist?: string }
  | { kind: 'file'; file: File; title: string };

/**
 * Progress reports while a player is getting the real song ready, and after
 * play() if the browser refuses to start playback.
 *  - 'loading':       waiting for the video to start
 *  - 'ad':            the player is busy but our song isn't advancing (likely
 *                     a muted preroll ad)
 *  - 'needs-gesture': the browser blocked autoplay; call play() from a user
 *                     action (button / OK key) to continue
 *  - 'slow':          nothing has started after a generous timeout; the UI
 *                     should offer retry / skip (loading keeps going)
 */
export type StartStatus = 'loading' | 'ad' | 'needs-gesture' | 'slow';

/**
 * Player error. `code` is the YouTube IFrame error number where there is one
 * (2, 5, 100, 101, 150, ...) or one of our own strings.
 */
export class PlayerError extends Error {
  readonly code: number | 'api' | 'decode' | 'cancelled';
  constructor(code: number | 'api' | 'decode' | 'cancelled', message?: string) {
    super(message ?? `Player error ${String(code)}`);
    this.code = code;
  }
  /** Embedding disabled by the owner. */
  get embedBlocked(): boolean {
    return this.code === 101 || this.code === 150;
  }
  /** Removed, private or otherwise unavailable. */
  get unavailable(): boolean {
    return this.code === 100;
  }
}

/** Common interface for every playback backend. */
export interface MediaPlayer {
  readonly kind: PlayItem['kind'];
  /**
   * Prepare the song. Resolves once the real song (not an ad) is loaded and
   * paused at 0 with sound enabled. Rejects with PlayerError on failure.
   * Calling load() again, or destroy(), cancels a pending load.
   */
  load(item: PlayItem): Promise<void>;
  /** Start or resume. Also the retry path after a 'needs-gesture' status. */
  play(): void;
  pause(): void;
  /** True while playback is running (not paused, ended or buffering). */
  isPlaying(): boolean;
  /** Smoothed song time in seconds; safe to call every animation frame. */
  time(): number;
  /** Duration in seconds, 0 while unknown. */
  duration(): number;
  onEnded: (() => void) | null;
  /** Errors after load() resolved. Errors during load reject load(). */
  onError: ((err: PlayerError) => void) | null;
  onStatus: ((status: StartStatus) => void) | null;
  destroy(): void;
}
