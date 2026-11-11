/** Local file playback (MP3 / M4A) through an <audio> element. */

import { SmoothClock } from './clock';
import { PlayerError, type MediaPlayer, type PlayItem, type StartStatus } from './types';

export class AudioFilePlayer implements MediaPlayer {
  readonly kind = 'file' as const;
  onEnded: (() => void) | null = null;
  onError: ((err: PlayerError) => void) | null = null;
  onStatus: ((status: StartStatus) => void) | null = null;

  private audio = new Audio();
  private url: string | null = null;
  private clock = new SmoothClock();
  private loaded = false;
  private pending: { reject: (e: PlayerError) => void } | null = null;

  constructor() {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => {
      this.clock.update(this.audio.currentTime, false);
      this.onEnded?.();
    });
    this.audio.addEventListener('error', () => {
      if (this.loaded) this.onError?.(new PlayerError('decode', 'This file stopped playing.'));
    });
  }

  load(item: PlayItem): Promise<void> {
    if (item.kind !== 'file') return Promise.reject(new PlayerError('decode', 'Not a file item'));
    this.pending?.reject(new PlayerError('cancelled'));
    this.loaded = false;
    this.revoke();
    this.url = URL.createObjectURL(item.file);
    const a = this.audio;
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        a.removeEventListener('canplay', onReady);
        a.removeEventListener('error', onErr);
        this.pending = null;
      };
      const onReady = () => {
        cleanup();
        a.currentTime = 0;
        this.clock.seek(0);
        this.clock.update(0, false);
        this.loaded = true;
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new PlayerError('decode', "This file couldn't be played."));
      };
      this.pending = {
        reject: (e) => {
          cleanup();
          reject(e);
        },
      };
      a.addEventListener('canplay', onReady);
      a.addEventListener('error', onErr);
      a.src = this.url!;
      a.load();
    });
  }

  play(): void {
    if (!this.loaded) return;
    this.audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this.onStatus?.('needs-gesture');
      } else if (!(err instanceof DOMException && err.name === 'AbortError')) {
        this.onError?.(new PlayerError('decode', "This file couldn't be played."));
      }
    });
  }

  pause(): void {
    this.audio.pause();
    this.clock.update(this.audio.currentTime, false);
  }

  isPlaying(): boolean {
    const a = this.audio;
    // readyState < 3 means it's waiting for data (buffering).
    return this.loaded && !a.paused && !a.ended && a.readyState >= 3;
  }

  time(): number {
    if (!this.loaded) return 0;
    this.clock.update(this.audio.currentTime, this.isPlaying());
    return Math.max(0, Math.min(this.clock.time(), this.duration() || Infinity));
  }

  duration(): number {
    const d = this.audio.duration;
    return Number.isFinite(d) ? d : 0;
  }

  destroy(): void {
    this.pending?.reject(new PlayerError('cancelled'));
    this.loaded = false;
    this.onEnded = this.onError = this.onStatus = null;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.revoke();
  }

  private revoke(): void {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

/** Accept MP3 and M4A by MIME type or extension. */
export function isSupportedAudioFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'].includes(type)) {
    return true;
  }
  return /\.(mp3|m4a)$/i.test(file.name);
}

/** File name without extension, used as the song title. */
export function fileTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || file.name;
}
