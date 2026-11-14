/**
 * Web Worker: whole-audio beat analysis (mono PCM in, BeatMap out), or the
 * song traits alone for an existing map's beat grid.
 *
 * Message in:  AnalysisRequest (kind omitted or 'map') or TraitsRequest.
 * Messages out: { type: 'progress', fraction } (throttled, maps only), then
 *               { type: 'done', map } / { type: 'traits', traits }, or
 *               { type: 'error', message }.
 */
import { analyzeOffline, computeTraits, type BeatMapSource, type TraitGrid } from '../core/analysis';

export interface AnalysisRequest {
  kind?: 'map';
  pcm: Float32Array;
  sampleRate: number;
  videoId: string;
  source: BeatMapSource;
  duration: number;
  maxSeconds?: number;
}

export interface TraitsRequest {
  kind: 'traits';
  pcm: Float32Array;
  sampleRate: number;
  grid: TraitGrid;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<AnalysisRequest | TraitsRequest>) => void) | null;
  postMessage(msg: unknown): void;
};

scope.onmessage = (e) => {
  const req = e.data;
  let last = -1;
  try {
    if (req.kind === 'traits') {
      scope.postMessage({ type: 'traits', traits: computeTraits(req.pcm, req.sampleRate, req.grid) });
      return;
    }
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
