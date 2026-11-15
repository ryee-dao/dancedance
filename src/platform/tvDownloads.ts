/**
 * The TV's song downloads, by who asked: the user's songs (foreground: the
 * song opened, playing) and the background beat-finding (helperFill.ts).
 * Pure apart from the injected `start` / `cancel` (the bridge's prepareAudio
 * / cancelAudio).
 *
 * Priority: a background download never holds up one of the user's.
 *   - The background asks for one song at a time, and only while nothing of
 *     the user's is loading (foregroundLoading; a prepared song counts for
 *     RETAIN_MS more, the time its analysis may take).
 *   - Opening a song abandons the background's song: its download is
 *     cancelled at once (freeing the shell's download slot and the
 *     bandwidth), unless it is the very song opened, whose download then
 *     simply goes on as the user's (concurrent requests share one download).
 *   - The shell (Audio.kt) runs two downloads at most and shares one per
 *     video; with the background at one, the user's request always has a
 *     slot of its own and never queues behind it.
 */
export const RETAIN_MS = 60_000;

export class TvDownloads<T> {
  private readonly jobs = new Map<string, Promise<T>>();
  private readonly fg = new Set<string>();
  private readonly bg = new Set<string>();

  constructor(
    private readonly start: (videoId: string) => Promise<T>,
    private readonly cancelNative: (videoId: string) => void,
    private readonly later: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
  ) {}

  /** Download (or join) a song's audio; `background`: for the beat-finding. */
  prepare(videoId: string, background = false): Promise<T> {
    (background ? this.bg : this.fg).add(videoId);
    let p = this.jobs.get(videoId);
    if (!p) {
      const mine = this.start(videoId);
      p = mine;
      this.jobs.set(videoId, mine);
      // Keep successful results briefly (the cache answers instantly anyway).
      mine.then(
        () => void this.later(() => void (this.jobs.get(videoId) === mine && this.forget(videoId)), RETAIN_MS),
        () => void (this.jobs.get(videoId) === mine && this.forget(videoId)),
      );
    }
    return p;
  }

  private forget(videoId: string): void {
    this.jobs.delete(videoId);
    this.fg.delete(videoId);
    this.bg.delete(videoId);
  }

  /** A song of the user's is downloading, or was prepared within RETAIN_MS (its analysis may still run). */
  foregroundLoading(): boolean {
    for (const id of this.jobs.keys()) if (this.fg.has(id)) return true;
    return false;
  }

  /** Is a download for this song known (any asker)? */
  has(videoId: string): boolean {
    return this.jobs.has(videoId);
  }

  /** Cancel a download (the shell's too). */
  cancel(videoId: string): void {
    this.forget(videoId);
    this.cancelNative(videoId);
  }

  /** The background gave up its song (a song was opened): cancel its download unless the user wants that song too. */
  abandonBackground(videoId: string, opening: string | null): boolean {
    if (this.fg.has(videoId) || opening === videoId || !this.jobs.has(videoId)) return false;
    this.cancel(videoId);
    return true;
  }

  /** Forget a song's download without cancelling it (its cached file is being dropped). */
  drop(videoId: string): void {
    this.forget(videoId);
  }
}
