/**
 * Web Worker: whole-audio beat analysis (mono PCM in, BeatMap out).
 *
 * Message in:  AnalysisRequest
 * Messages out: { type: 'progress', fraction } (throttled), then
 *               { type: 'done', map } or { type: 'error', message }.
 */
import { analyzeOffline, type BeatMapSource } from '../core/analysis';

export interface AnalysisRequest {
  pcm: Float32Array;
  sampleRate: number;
  videoId: string;
  source: BeatMapSource;
  duration: number;
  maxSeconds?: number;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(msg: unknown): void;
};

scope.onmessage = (e) => {
  const req = e.data;
  let last = -1;
  try {
    const map = analyzeOffline(req.pcm, req.sampleRate, {
      videoId: req.videoId,
      source: req.source,
      duration: req.duration,
      maxSeconds: req.maxSeconds,
      onProgress: (f) => {
        if (f - last >= 0.02 || f >= 1) {
          last = f;
          scope.postMessage({ type: 'progress', fraction: f });
        }
      },
    });
    scope.postMessage({ type: 'done', map });
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
