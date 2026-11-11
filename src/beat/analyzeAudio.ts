/**
 * Whole-audio beat analysis for encoded audio (dropped MP3/M4A on web,
 * downloaded audio on Android TV): decode -> 22050 Hz mono -> analyzeOffline
 * in a Web Worker.
 *
 * Two results:
 *  - `first`: the map to start playing with. Normally the full analysis. If
 *    that isn't done within `budgetMs` (default 15 s), a second job analyses
 *    only the first `partialSeconds` (default 30 s) and `first` resolves with
 *    that partial map instead.
 *  - `full`: the complete analysis (same object as `first` when it was fast
 *    enough). The caller swaps it in when it lands, which bumps the
 *    BeatTimeline revision.
 *
 * Platform-neutral: needs only Web Audio decoding and (optionally) Worker.
 */
import { analyzeOffline, type BeatMap } from '../core/analysis';
import type { AnalysisRequest } from '../workers/analysis.worker';

export const ANALYSIS_RATE = 22050;
export const DEFAULT_BUDGET_MS = 15000;
export const DEFAULT_PARTIAL_SECONDS = 30;

export interface DecodedAudio {
  pcm: Float32Array;
  sampleRate: number;
  duration: number;
}

export interface AnalysisJob {
  promise: Promise<BeatMap>;
  cancel(): void;
}

export type AnalysisRunner = (req: AnalysisRequest, onProgress?: (fraction: number) => void) => AnalysisJob;

export interface AnalyzeOptions {
  /** Cache key, stored as the map's videoId (video ID or fileKey()). */
  key: string;
  source: 'file' | 'device';
  budgetMs?: number;
  partialSeconds?: number;
  /** Progress of the full analysis, 0..1 (decoding counts as the first 5 %). */
  onProgress?: (fraction: number) => void;
  runner?: AnalysisRunner;
}

export interface AudioAnalysis {
  first: Promise<BeatMap>;
  full: Promise<BeatMap>;
  cancel(): void;
}

/** Decode encoded audio to mono, resampled to 22050 Hz where the browser can. */
export async function decodeToMono(buf: ArrayBuffer): Promise<DecodedAudio> {
  let audio: AudioBuffer;
  const Offline =
    typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : ((globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext ?? null);
  if (Offline) {
    // An offline context's decodeAudioData resamples to the context's rate.
    const ctx = new Offline(1, 1, ANALYSIS_RATE);
    audio = await ctx.decodeAudioData(buf);
  } else {
    const ctx = new AudioContext();
    try {
      audio = await ctx.decodeAudioData(buf);
    } finally {
      void ctx.close();
    }
  }
  const n = audio.length;
  const chs = audio.numberOfChannels;
  const pcm = new Float32Array(n);
  for (let c = 0; c < chs; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < n; i++) pcm[i] += d[i];
  }
  if (chs > 1) for (let i = 0; i < n; i++) pcm[i] /= chs;
  return { pcm, sampleRate: audio.sampleRate, duration: audio.duration };
}

/** Run each job in its own Worker (falls back to the main thread if Workers are unavailable). */
export function defaultRunner(): AnalysisRunner {
  return (req, onProgress) => {
    let worker: Worker | null = null;
    try {
      if (typeof Worker !== 'undefined') {
        worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
      }
    } catch {
      worker = null;
    }
    if (!worker) return inlineRunner(req, onProgress);
    const w = worker;
    let rejectFn: ((e: Error) => void) | null = null;
    const promise = new Promise<BeatMap>((resolve, reject) => {
      rejectFn = reject;
      w.onmessage = (e: MessageEvent<{ type: string; fraction?: number; map?: BeatMap; message?: string }>) => {
        const m = e.data;
        if (m.type === 'progress' && typeof m.fraction === 'number') onProgress?.(m.fraction);
        else if (m.type === 'done' && m.map) {
          w.terminate();
          resolve(m.map);
        } else if (m.type === 'error') {
          w.terminate();
          reject(new Error(m.message ?? 'Analysis failed'));
        }
      };
      w.onerror = (e) => {
        w.terminate();
        reject(new Error(e.message || 'Analysis worker failed'));
      };
      w.postMessage(req);
    });
    return {
      promise,
      cancel() {
        w.terminate();
        rejectFn?.(new Error('cancelled'));
      },
    };
  };
}

/** Main-thread fallback (blocks while it runs). */
export const inlineRunner: AnalysisRunner = (req, onProgress) => {
  let cancelled = false;
  const promise = new Promise<BeatMap>((resolve, reject) => {
    setTimeout(() => {
      if (cancelled) return reject(new Error('cancelled'));
      try {
        resolve(
          analyzeOffline(req.pcm, req.sampleRate, {
            videoId: req.videoId,
            source: req.source,
            duration: req.duration,
            maxSeconds: req.maxSeconds,
            onProgress,
          }),
        );
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    }, 0);
  });
  return {
    promise,
    cancel() {
      cancelled = true;
    },
  };
};

/** The full / first-30-s orchestration over decoded PCM (testable with a fake runner). */
export function analyzePcm(audio: DecodedAudio, opts: AnalyzeOptions): AudioAnalysis {
  const runner = opts.runner ?? defaultRunner();
  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const partialSeconds = opts.partialSeconds ?? DEFAULT_PARTIAL_SECONDS;
  const base = { sampleRate: audio.sampleRate, videoId: opts.key, source: opts.source, duration: audio.duration };

  const fullJob = runner({ ...base, pcm: audio.pcm }, opts.onProgress);
  let partialJob: AnalysisJob | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const first = new Promise<BeatMap>((resolve, reject) => {
    let settled = false;
    let fullFailed: Error | null = null;
    let partialPending = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      fn();
    };
    fullJob.promise.then(
      (m) => settle(() => resolve(m)),
      (e: Error) => {
        fullFailed = e;
        if (!partialPending) settle(() => reject(e));
      },
    );
    timer = setTimeout(() => {
      timer = null;
      if (settled) return;
      const n = Math.min(audio.pcm.length, Math.round(partialSeconds * audio.sampleRate));
      if (n >= audio.pcm.length) return; // shorter than the partial window: just wait
      partialPending = true;
      partialJob = runner({ ...base, pcm: audio.pcm.slice(0, n), maxSeconds: partialSeconds });
      partialJob.promise.then(
        (m) => settle(() => resolve({ ...m, partial: true })),
        (e: Error) => {
          partialPending = false;
          if (fullFailed) settle(() => reject(fullFailed ?? e));
        },
      );
    }, budget);
  });

  return {
    first,
    full: fullJob.promise,
    cancel() {
      if (timer !== null) clearTimeout(timer);
      fullJob.cancel();
      (partialJob as AnalysisJob | null)?.cancel();
    },
  };
}

/** Decode and analyse encoded audio. */
export function analyzeAudio(buf: ArrayBuffer, opts: AnalyzeOptions): AudioAnalysis {
  let inner: AudioAnalysis | null = null;
  let cancelled = false;
  const decoded = decodeToMono(buf);
  const started = decoded.then((audio) => {
    if (cancelled) throw new Error('cancelled');
    opts.onProgress?.(0.05);
    inner = analyzePcm(audio, {
      ...opts,
      onProgress: opts.onProgress ? (f) => opts.onProgress?.(0.05 + 0.95 * f) : undefined,
    });
    return inner;
  });
  const first = started.then((a) => a.first);
  const full = started.then((a) => a.full);
  // Callers may only await one of them; don't report the other as unhandled.
  first.catch(() => {});
  full.catch(() => {});
  return {
    first,
    full,
    cancel() {
      cancelled = true;
      inner?.cancel();
    },
  };
}
