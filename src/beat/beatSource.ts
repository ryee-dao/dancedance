/**
 * The seam between "where beats come from" (cloud map, cached map, on-device
 * analysis, live mic/tab tracking) and "what dances to them" (the coach).
 *
 * All times are SONG time in seconds: the same timeline as `Player.time()`.
 * The audio-offset setting is applied by the play screen before it hands a time
 * to the stage renderer, so consumers never add it themselves.
 */
import type { BeatMap } from '../core/analysis';

export interface LiveBeats {
  /** True once the live tracker has a stable tempo and phase. */
  locked: boolean;
  bpm: number;
  /** Beats heard so far, ascending, song time. Grows over time. */
  beats: readonly number[];
  /** Predicted upcoming beats (at least the next 8 when locked), song time. */
  nextBeats: readonly number[];
}

export interface BeatTimeline {
  /**
   * A beat map if one is known. May be `partial` (covers only the start of the
   * song); in that case `live` may also be present for the remainder.
   */
  map: BeatMap | null;
  /** Live tracking state while listening via mic or tab audio, else null. */
  live: LiveBeats | null;
  /**
   * Increments whenever `map` is replaced (e.g. partial -> full, or a live
   * recording is finalized). Consumers re-plan when it changes; `live` updates
   * do not bump it.
   */
  revision: number;
}

export interface BeatSource {
  /** Cheap; safe to call every animation frame. */
  current(): BeatTimeline;
}
