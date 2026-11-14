/**
 * On-device fill-in of song traits (analyser 1.3.0) for maps made before
 * them (or before their 1.4.0 re-calibration): a cloud map from an older
 * run, or one cached on this device.
 *
 * Wherever the app has the song's audio (Android TV's downloaded audio, a
 * dropped file) and the map it resolved is complete but has no `traits`,
 * the audio is decoded and the traits are computed on the map's own beat
 * grid in a Worker (computeTraits: the feature extraction of a full
 * analysis, without the tempo / beat / section stages). The caller waits
 * for it while the song loads, up to `waitMs`; the result is cached either
 * way, so it is done once per song. Nothing runs on the playback path: a
 * result that arrives after the wait is only cached, never swapped into the
 * song that is already playing.
 *
 * Platform-neutral: needs Web Audio decoding and (optionally) Worker.
 */
import { computeTraits, type BeatMap, type SongTraits, type TraitGrid } from '../core/analysis';
import { decodeToMono, type DecodedAudio } from './analyzeAudio';
import type { TraitsRequest } from '../workers/analysis.worker';

/** How long a song's start waits for its traits (ms). */
export const TRAITS_WAIT_MS = 8000;

export interface TraitsJob {
  promise: Promise<SongTraits>;
  cancel(): void;
}

export type TraitsRunner = (audio: DecodedAudio, grid: TraitGrid) => TraitsJob;

/**
 * A complete map that still lacks traits, or carries traits from before
 * analyser 1.4.0 (they have no `intensity`; 1.4.0 re-calibrated calm, drive,
 * halfFeel and heavy), so they are recomputed on the map's own grid.
 * Partial maps are replaced by a full analysis anyway.
 */
export function needsTraits(map: BeatMap | null | undefined): map is BeatMap {
  return !!map && !map.partial && (!map.traits || map.traits.intensity === undefined) && map.duration > 0;
}

export function gridOf(map: BeatMap): TraitGrid {
  return { beats: map.beats, downbeats: map.downbeats, bpm: map.bpm };
}

export interface FillTraitsOptions {
  /** The song's encoded audio. */
  getAudio(): Promise<ArrayBuffer>;
  /** Default: decodeToMono (Web Audio, 22050 Hz mono). */
  decode?(buf: ArrayBuffer): Promise<DecodedAudio>;
  /** Default: a Worker (main thread if Workers are unavailable). */
  runner?: TraitsRunner;
  /** Default TRAITS_WAIT_MS. */
  waitMs?: number;
}

export interface TraitsFill {
  /** The map with traits if they were ready within the wait, else null. Never rejects. */
  ready: Promise<BeatMap | null>;
  /** The map with traits whenever they are done (null on failure), for caching. Never rejects. */
  done: Promise<BeatMap | null>;
}

/** Start filling in `map`'s traits from the song's audio (see the module comment). */
export function fillTraits(map: BeatMap, opts: FillTraitsOptions): TraitsFill {
  const decode = opts.decode ?? decodeToMono;
  const runner = opts.runner ?? workerTraitsRunner();
  const grid = gridOf(map);
  const done: Promise<BeatMap | null> = opts
    .getAudio()
    .then((buf) => decode(buf))
    .then((audio) => runner(audio, grid).promise)
    .then((traits) => ({ ...map, traits }))
    .catch((err: unknown) => {
      console.info('[dd:beats] song traits could not be computed', err instanceof Error ? err.message : err);
      return null;
    });
  const wait = opts.waitMs ?? TRAITS_WAIT_MS;
  const ready = Promise.race([done, new Promise<null>((r) => setTimeout(() => r(null), wait))]);
  return { ready, done };
}

/** Run the traits job in a Worker (falls back to the main thread if Workers are unavailable). */
export function workerTraitsRunner(): TraitsRunner {
  return (audio, grid) => {
    let worker: Worker | null = null;
    try {
      if (typeof Worker !== 'undefined') {
        worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
      }
    } catch {
      worker = null;
    }
    if (!worker) return inlineTraitsRunner(audio, grid);
    const w = worker;
    let rejectFn: ((e: Error) => void) | null = null;
    const promise = new Promise<SongTraits>((resolve, reject) => {
      rejectFn = reject;
      w.onmessage = (e: MessageEvent<{ type: string; traits?: SongTraits; message?: string }>) => {
        const m = e.data;
        if (m.type === 'traits' && m.traits) {
          w.terminate();
          resolve(m.traits);
        } else if (m.type === 'error') {
          w.terminate();
          reject(new Error(m.message ?? 'Trait analysis failed'));
        }
      };
      w.onerror = (e) => {
        w.terminate();
        reject(new Error(e.message || 'Analysis worker failed'));
      };
      const req: TraitsRequest = { kind: 'traits', pcm: audio.pcm, sampleRate: audio.sampleRate, grid: { beats: Array.from(grid.beats), downbeats: Array.from(grid.downbeats), bpm: grid.bpm } };
      try {
        w.postMessage(req, [audio.pcm.buffer]);
      } catch {
        w.postMessage(req);
      }
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
export const inlineTraitsRunner: TraitsRunner = (audio, grid) => {
  let cancelled = false;
  const promise = new Promise<SongTraits>((resolve, reject) => {
    setTimeout(() => {
      if (cancelled) return reject(new Error('cancelled'));
      try {
        resolve(computeTraits(audio.pcm, audio.sampleRate, grid));
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
