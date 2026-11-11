/**
 * MediaStream (mic or tab audio) -> AudioWorklet -> mono PCM chunks on the
 * main thread, each stamped with the performance.now() time at which its
 * last sample was captured by the audio graph.
 */
import workletUrl from './worklet.ts?worker&url';

export type LiveErrorReason = 'denied' | 'no-device' | 'no-audio' | 'unsupported' | 'cancelled' | 'error';

export class LiveError extends Error {
  constructor(
    readonly reason: LiveErrorReason,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'LiveError';
  }
}

export interface CaptureChunk {
  pcm: Float32Array;
  /** performance.now() (ms) when the chunk's last sample entered the audio graph. */
  perfEnd: number;
}

/** What LiveTracker needs from a capture (fakeable in tests). */
export interface ChunkSource {
  readonly sampleRate: number;
  onChunk: ((c: CaptureChunk) => void) | null;
}

export interface Capture extends ChunkSource {
  readonly stream: MediaStream;
  /** AudioContext base + output latency in seconds (0 where unknown). */
  contextLatency(): number;
  /** True while the stream's audio track is live. */
  alive(): boolean;
  stop(): void;
}

export async function startCapture(stream: MediaStream): Promise<Capture> {
  const track = stream.getAudioTracks()[0];
  if (!track) throw new LiveError('no-audio', 'The shared stream has no audio.');
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  try {
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    await ctx.audioWorklet.addModule(workletUrl);
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'dd-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    // Keep the node pulled by the graph without making any sound.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);

    let stopped = false;
    const cap: Capture = {
      stream,
      sampleRate: ctx.sampleRate,
      onChunk: null,
      contextLatency() {
        const base = Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : 0;
        const out = Number.isFinite(ctx.outputLatency) ? ctx.outputLatency : 0;
        return Math.max(0, base) + Math.max(0, out);
      },
      alive() {
        return !stopped && track.readyState === 'live';
      },
      stop() {
        if (stopped) return;
        stopped = true;
        node.port.onmessage = null;
        try {
          src.disconnect();
          node.disconnect();
        } catch {
          /* ignore */
        }
        for (const t of stream.getTracks()) t.stop();
        void ctx.close().catch(() => {});
      },
    };
    node.port.onmessage = (e: MessageEvent<{ pcm: Float32Array; end: number }>) => {
      if (stopped || !cap.onChunk) return;
      const perfNow = performance.now();
      // currentTime on the main thread is the start of the next render
      // quantum: "now" on the audio clock. The chunk ended a little before.
      const lag = Math.max(0, ctx.currentTime - e.data.end);
      cap.onChunk({ pcm: e.data.pcm, perfEnd: perfNow - lag * 1000 });
    };
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return cap;
  } catch (err) {
    void ctx.close().catch(() => {});
    if (err instanceof LiveError) throw err;
    throw new LiveError('unsupported', `Audio capture failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
