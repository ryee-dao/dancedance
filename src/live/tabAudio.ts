/**
 * "Share this tab" audio capture: the better-sync live option. The audio is
 * taken from the tab before it reaches the speakers, so there is no room
 * echo and no speaker latency.
 *
 * Chromium desktop only (preferCurrentTab / tab audio). Hidden elsewhere:
 * Safari and Firefox can't capture tab audio, Android WebView has no
 * getDisplayMedia.
 */
import { LiveError } from './capture';

export function tabShareSupported(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') return false;
  if (typeof AudioWorkletNode === 'undefined') return false;
  // CaptureController ships with Chromium's tab-capture features (M109+);
  // Firefox and Safari don't have it.
  if (typeof (window as { CaptureController?: unknown }).CaptureController !== 'function') return false;
  const uaData = (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile) return false;
  if (/Android|Mobile|wv\)/i.test(navigator.userAgent)) return false;
  return true;
}

/**
 * Ask the user to share this tab with audio. Rejects with LiveError:
 * 'denied' (cancelled the picker), 'no-audio' (shared without "Also share
 * tab audio"), 'unsupported' or 'error'.
 */
export async function openTabAudio(): Promise<MediaStream> {
  if (!tabShareSupported()) throw new LiveError('unsupported', 'This browser cannot share tab audio.');
  let stream: MediaStream;
  try {
    const opts = {
      video: true, // required by the API; we never look at it
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'exclude',
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'exclude',
    };
    stream = await navigator.mediaDevices.getDisplayMedia(opts as DisplayMediaStreamOptions);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'AbortError') throw new LiveError('denied', 'Tab sharing was cancelled.');
    throw new LiveError('error', `Tab sharing failed${name ? ` (${name})` : ''}.`);
  }
  if (stream.getAudioTracks().length === 0) {
    for (const t of stream.getTracks()) t.stop();
    throw new LiveError('no-audio', 'The tab was shared without its audio.');
  }
  // Keep the (unused) video track alive: stopping it can end the capture.
  for (const t of stream.getVideoTracks()) t.enabled = false;
  return stream;
}
