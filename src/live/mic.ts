/**
 * Microphone input for live beat tracking.
 *
 * Echo cancellation, noise suppression and auto gain are all off: they are
 * built for speech and would smear or remove the music we want to hear.
 * Nothing is recorded or sent anywhere; samples go straight into the
 * on-page analyser.
 */
import { LiveError } from './capture';

export type MicPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

export function micSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof AudioWorkletNode !== 'undefined';
}

/** The browser's remembered decision, where the Permissions API can tell. */
export async function micPermission(): Promise<MicPermission> {
  try {
    const st = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return st.state === 'granted' || st.state === 'denied' || st.state === 'prompt' ? st.state : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function openMic(): Promise<MediaStream> {
  if (!micSupported()) throw new LiveError('unsupported', 'This browser has no microphone access.');
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new LiveError('denied', 'Microphone access was not allowed.');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new LiveError('no-device', 'No microphone was found.');
    throw new LiveError('error', `The microphone could not be opened${name ? ` (${name})` : ''}.`);
  }
}

/** Input latency reported for the track (Chrome), in seconds; 0 where unknown. */
export function trackLatency(stream: MediaStream): number {
  const s = stream.getAudioTracks()[0]?.getSettings() as (MediaTrackSettings & { latency?: number }) | undefined;
  const l = s?.latency;
  return typeof l === 'number' && Number.isFinite(l) && l >= 0 && l < 1 ? l : 0;
}
