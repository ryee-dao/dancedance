/**
 * Live beat tracking for one song: capture chunks -> StreamingAnalyzer, with
 * input-stream time mapped to song time through the player's clock.
 *
 *  - Chunks are only analysed while the song is actually playing (not during
 *    the countdown, pause, buffering or an ad), so the analyser's input
 *    timeline only advances together with the song and one offset holds.
 *  - The offset is re-measured on every chunk and smoothed (median); after a
 *    pause it re-syncs by itself. If the song time jumps (seek, stall), a new
 *    segment with a fresh analyser starts.
 *  - `finalize` turns the longest segment into a BeatMap in song time.
 */
import { StreamingAnalyzer, type BeatMap } from '../core/analysis';
import type { LiveBeats } from '../beat/beatSource';
import type { CaptureChunk, ChunkSource } from './capture';
import { median, OffsetEstimator, rawOffset } from './timeMap';

export interface LiveClock {
  /** Song time (s), NOT shifted by the audio offset. */
  time(): number;
  /** True while the song is audibly advancing. */
  playing(): boolean;
}

export interface LiveTrackerOptions {
  source: 'mic' | 'tab';
  /** Player -> capture latency, s (see timeMap.ts). Fixed for the song. */
  latency: number;
  clock: LiveClock;
  /** performance.now() replacement for tests. */
  now?: () => number;
}

/** A finished recording ready to cache. */
export interface LiveResult {
  map: BeatMap;
  /** Seconds of song covered by the recording. */
  covered: number;
  /** Seconds of that recording during which the live tracker was locked. */
  locked: number;
}

/** Minimum recording worth saving. */
export const MIN_SAVE_SECONDS = 45;
/** Predicted beats exposed when locked. */
const NEXT_COUNT = 8;

interface Segment {
  an: StreamingAnalyzer;
  est: OffsetEstimator;
  /** Seconds pushed while locked. */
  locked: number;
  /** Per chunk: input time at its end, and the raw offset measured for it (outliers left out). */
  trackT: number[];
  trackOff: number[];
}

/** Half-width (s) of the window whose median offset is used for a beat at a given input time. */
const OFFSET_WINDOW = 1;

const EMPTY: LiveBeats = Object.freeze({ locked: false, bpm: 0, beats: [], nextBeats: [] });

export class LiveTracker {
  readonly source: 'mic' | 'tab';
  private readonly cap: ChunkSource;
  private readonly opts: LiveTrackerOptions;
  private readonly now: () => number;
  private segments: Segment[] = [];
  private seg: Segment | null = null;
  private stopped = false;
  private chunksSeen = 0;
  private lockedAt = -1;

  // LiveBeats cache
  private cached: LiveBeats = EMPTY;
  private cBeatsLen = -1;
  private cNext: readonly number[] | null = null;
  private cOffset = NaN;
  private cLocked = false;

  constructor(cap: ChunkSource, opts: LiveTrackerOptions) {
    this.cap = cap;
    this.opts = opts;
    this.source = opts.source;
    this.now = opts.now ?? (() => performance.now());
    cap.onChunk = (c) => this.onChunk(c);
  }

  /** Detach from the capture (the capture itself stays open for the next song). */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.cap.onChunk) this.cap.onChunk = null;
  }

  /** Chunks received from the capture so far (diagnostics). */
  get chunks(): number {
    return this.chunksSeen;
  }

  /** Song time (s) at which the tracker first locked, or -1. */
  get lockSongTime(): number {
    return this.lockedAt;
  }

  /** Seconds of song analysed in the longest segment. */
  covered(): number {
    let best = 0;
    for (const s of this.segments) best = Math.max(best, s.an.state.time);
    return best;
  }

  onChunk(c: CaptureChunk): void {
    if (this.stopped) return;
    this.chunksSeen++;
    const clock = this.opts.clock;
    if (!clock.playing()) return;
    const perfNow = this.now();
    const songNow = clock.time();
    const dur = c.pcm.length / this.cap.sampleRate;
    if (!this.seg) this.newSegment();
    let seg = this.seg!;
    const measure = (s: Segment) =>
      rawOffset({ songNow, perfNow, capturePerf: c.perfEnd, inputTime: s.an.state.time + dur, latency: this.opts.latency });
    let raw = measure(seg);
    if (seg.est.push(raw) === 'jump') {
      seg = this.newSegment();
      raw = measure(seg);
      seg.est.push(raw);
    }
    const off = seg.est.value;
    if (off !== null && Math.abs(raw - off) <= 0.25) {
      seg.trackT.push(seg.an.state.time + dur);
      seg.trackOff.push(raw);
    }
    if (off !== null) seg.an.setTimeOffset(off);
    seg.an.push(c.pcm);
    if (seg.an.state.locked) seg.locked += dur;
    if (seg.an.state.locked && this.lockedAt < 0) this.lockedAt = songNow;
  }

  private newSegment(): Segment {
    const s: Segment = { an: new StreamingAnalyzer({ sampleRate: this.cap.sampleRate }), est: new OffsetEstimator(), locked: 0, trackT: [], trackOff: [] };
    this.segments.push(s);
    this.seg = s;
    return s;
  }

  /** Current live state in song time. Cheap when nothing changed. */
  live(): LiveBeats {
    const seg = this.seg;
    if (!seg) return EMPTY;
    const st = seg.an.state;
    const off = st.timeOffset;
    if (st.beats.length === this.cBeatsLen && st.nextBeats === this.cNext && off === this.cOffset && st.locked === this.cLocked) {
      return this.cached;
    }
    this.cBeatsLen = st.beats.length;
    this.cNext = st.nextBeats;
    this.cOffset = off;
    this.cLocked = st.locked;
    const beats = st.beats.map((b) => b + off);
    const next = st.nextBeats.map((b) => b + off);
    if (st.locked && st.bpm > 0 && next.length) {
      const period = 60 / st.bpm;
      while (next.length < NEXT_COUNT) next.push(next[next.length - 1] + period);
    }
    this.cached = { locked: st.locked, bpm: st.bpm, beats, nextBeats: st.locked ? next : [] };
    return this.cached;
  }

  /**
   * Finish listening and build a map from the longest segment. Returns null
   * if nothing usable was heard. Stops the tracker.
   */
  finalize(videoId: string, duration: number): LiveResult | null {
    this.stop();
    let best: Segment | null = null;
    for (const s of this.segments) if (!best || s.an.state.time > best.an.state.time) best = s;
    if (!best || best.an.state.time < 1) return null;
    const covered = best.an.state.time;
    try {
      const map = best.an.finalize(videoId, Math.max(duration, best.an.state.timeOffset + covered), this.source, offsetTrack(best));
      if (map.beats.length < 4) return null;
      return { map, covered, locked: best.locked };
    } catch {
      return null;
    }
  }
}

/**
 * Input time -> offset for finalize: the median of the offsets measured
 * within OFFSET_WINDOW of that time (nearest measurement when none), so a
 * dropped buffer or slow drift late in the song doesn't move earlier beats.
 */
function offsetTrack(seg: Segment): ((t: number) => number) | undefined {
  const T = seg.trackT;
  const O = seg.trackOff;
  if (T.length < 8) return undefined;
  const lowerBound = (x: number) => {
    let lo = 0;
    let hi = T.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (T[m] < x) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  return (t: number) => {
    const a = lowerBound(t - OFFSET_WINDOW);
    const b = lowerBound(t + OFFSET_WINDOW);
    if (b > a) return median(O.slice(a, b));
    const i = Math.min(T.length - 1, a);
    return O[i];
  };
}
