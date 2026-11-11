/**
 * Loader and minimal typings for the YouTube IFrame Player API.
 * (Hand-written so we don't add a dependency for @types/youtube.)
 */

export const YTState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cuePlaylist(opts: { listType: 'playlist'; list: string; index?: number }): void;
  getPlaylist(): string[] | null | undefined;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  /** Undocumented but long-standing; guard every use. */
  getVideoData?(): { video_id?: string; title?: string; author?: string } | undefined;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

export interface YTEvent<T = unknown> {
  target: YTPlayer;
  data: T;
}

export interface YTPlayerOptions {
  width?: number;
  height?: number;
  videoId?: string;
  host?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTEvent) => void;
    onStateChange?: (e: YTEvent<number>) => void;
    onError?: (e: YTEvent<number>) => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Load https://www.youtube.com/iframe_api once. Rejects after `timeoutMs`. */
export function loadYouTubeApi(timeoutMs = 15000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => {
      apiPromise = null; // allow a later retry
      script.remove();
      reject(new Error('YouTube player API did not load'));
    }, timeoutMs);
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube player API missing after load'));
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      apiPromise = null;
      script.remove();
      reject(new Error('YouTube player API failed to load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * The fixed container that holds YouTube iframes.
 *
 * IMPORTANT: the iframe must stay rendered at a normal size, on screen. It is
 * hidden only visually with opacity 0.01 behind the app (see #yt-host in
 * styles.css). display:none, a tiny size or an off-screen position can make
 * the browser or YouTube throttle or stop playback.
 */
export function ytHost(): HTMLElement {
  let host = document.getElementById('yt-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'yt-host';
    host.setAttribute('aria-hidden', 'true');
    document.body.prepend(host);
  }
  return host;
}

/** Common playerVars for an invisible, non-interactive player. */
export function basePlayerVars(): Record<string, string | number> {
  const vars: Record<string, string | number> = {
    autoplay: 0,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    playsinline: 1,
    rel: 0,
  };
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    vars.origin = location.origin;
  }
  return vars;
}

/** Create a YT.Player in a fresh child of the host; resolves on onReady. */
export async function createYTPlayer(
  events: YTPlayerOptions['events'] = {},
  readyTimeoutMs = 15000,
): Promise<{ player: YTPlayer; el: HTMLElement }> {
  const YT = await loadYouTubeApi();
  // `el` is our wrapper (remove it to clean up); YT replaces `target` with
  // the iframe.
  const el = document.createElement('div');
  el.className = 'yt-slot';
  const target = document.createElement('div');
  el.appendChild(target);
  ytHost().appendChild(el);
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        player.destroy();
      } catch {
        /* ignore */
      }
      el.remove();
      reject(new Error('YouTube player did not become ready'));
    }, readyTimeoutMs);
    const player: YTPlayer = new YT.Player(target, {
      width: 320,
      height: 180,
      host: 'https://www.youtube.com',
      playerVars: basePlayerVars(),
      events: {
        ...events,
        onReady: (e) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          events.onReady?.(e);
          resolve({ player, el });
        },
      },
    });
  });
}
