/**
 * Whole-file analysis: PCM -> features -> tempo -> beats -> downbeats -> sections -> BeatMap.
 *
 * `analyzeFeatures` is the tracker stage on its own (features in, results
 * out) and is shared with `StreamingAnalyzer.finalize`.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import { ANALYZER_VERSION, BEATMAP_VERSION, roundMs, type BeatMap, type BeatMapSource, type Section } from './beatmap';
import { trackBeats } from './beats';
import { findDownbeats } from './downbeats';
import { FeatureExtractor, FeatureStore, FRAME_RATE, frameTime, onsetEnvelope, SAMPLE_RATE, type Features } from './onset';
import { Resampler } from './resample';
import { segmentSections } from './sections';
import { estimateTempo } from './tempo';

/**
 * Small constant added to envelope-peak times: with this STFT the flux peak
 * lands a few ms before the acoustic onset (measured on synthetic kicks).
 */
export const BEAT_TIME_OFFSET = 0.004;
/** Below this autocorrelation evidence the input is treated as having no beat. */
export const MIN_TEMPO_EVIDENCE = 0.1;
/** Minimum analysable length (seconds). */
const MIN_SECONDS = 2;

export interface AnalysisResult {
  bpm: number;
  /** 0..1 tempo confidence. */
  confidence: number;
  /** Beat times (s) on the features' timeline, unrounded. */
  beats: number[];
  downbeats: number[];
  sections: Section[];
}

export interface AnalyzeFeaturesOptions {
  /** Length to cover with sections (s); default: the features' length. */
  duration?: number;
}

/** Run tempo, beat, downbeat and section analysis on extracted features. */
export function analyzeFeatures(features: Features, opts: AnalyzeFeaturesOptions = {}): AnalysisResult {
  const featureSeconds = features.frames > 0 ? frameTime(features.frames - 1) : 0;
  const duration = opts.duration ?? featureSeconds;
  const env = onsetEnvelope(features);
  const empty = (confidence: number): AnalysisResult => ({
    bpm: 0,
    confidence,
    beats: [],
    downbeats: [],
    sections: segmentSections({ features, envelope: env, beats: [], downbeats: [], duration }),
  });
  if (features.frames < MIN_SECONDS * FRAME_RATE) return empty(0);
  const tempo = estimateTempo(env, FRAME_RATE);
  if (tempo.bpm === 0 || tempo.evidence < MIN_TEMPO_EVIDENCE) return empty(tempo.confidence);

  const frames = trackBeats(env, tempo.period);
  if (frames.length < 2) return empty(tempo.confidence);
  let times = Array.from(frames, (fr) => frameTime(fr) + BEAT_TIME_OFFSET);
  times = fixOutliers(times);
  const keepIdx: number[] = [];
  for (let i = 0; i < times.length; i++) if (times[i] >= 0 && times[i] <= duration) keepIdx.push(i);
  const beats = keepIdx.map((i) => times[i]);
  const beatFrames = keepIdx.map((i) => frames[i]);
  const downbeats = findDownbeats(features, beatFrames);
  const bpm = beats.length >= 4 ? 60 / regressionPeriod(beats) : tempo.bpm;
  const sections = segmentSections({ features, envelope: env, beats, downbeats, duration });
  return { bpm, confidence: tempo.confidence, beats, downbeats, sections };
}

/** Least-squares slope of beat time against beat index (average period, s). */
function regressionPeriod(t: number[]): number {
  const n = t.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += t[i];
    sxx += i * i;
    sxy += i * t[i];
  }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

/**
 * Replace isolated outlier beats (more than 35 ms off a line fitted through
 * their +-4 neighbours, where the neighbours themselves fit well) with the
 * fitted time. Leaves genuinely irregular passages alone.
 */
function fixOutliers(t: number[]): number[] {
  const n = t.length;
  if (n < 9) return t;
  const out = t.slice();
  for (let i = 0; i < n; i++) {
    const idx: number[] = [];
    for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) if (j !== i) idx.push(j);
    if (idx.length < 6) continue;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const j of idx) {
      sx += j;
      sy += t[j];
      sxx += j * j;
      sxy += j * t[j];
    }
    const m = idx.length;
    const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx);
    const icpt = (sy - slope * sx) / m;
    let rss = 0;
    for (const j of idx) rss += (t[j] - (icpt + slope * j)) ** 2;
    const rms = Math.sqrt(rss / m);
    const pred = icpt + slope * i;
    if (rms < 0.015 && Math.abs(t[i] - pred) > 0.035) out[i] = pred;
  }
  for (let i = 1; i < n; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 0.001;
  return out;
}

/** Build a BeatMap from an analysis result, shifting all times by `offset` and clipping to [0, duration]. */
export function toBeatMap(
  r: AnalysisResult,
  meta: { videoId: string; duration: number; source: BeatMapSource; partial?: boolean; offset?: number },
): BeatMap {
  const offset = meta.offset ?? 0;
  const duration = roundMs(Math.max(0, meta.duration));
  const beats: number[] = [];
  const indexMap = new Map<number, number>();
  for (let i = 0; i < r.beats.length; i++) {
    const t = roundMs(r.beats[i] + offset);
    if (t < 0 || t > duration) continue;
    if (beats.length && t <= beats[beats.length - 1]) continue;
    indexMap.set(i, beats.length);
    beats.push(t);
  }
  const downbeats: number[] = [];
  for (const d of r.downbeats) {
    const m = indexMap.get(d);
    if (m !== undefined) downbeats.push(m);
  }
  // Shift sections, clip, and stretch the ends so the whole song is covered.
  const sections: Section[] = [];
  for (const s of r.sections) {
    const start = roundMs(Math.max(0, s.start + offset));
    const end = roundMs(Math.min(duration, s.end + offset));
    if (end - start < 0.001) continue;
    sections.push({ start, end, type: s.type, energy: Math.round(s.energy * 1000) / 1000 });
  }
  if (duration > 0) {
    if (sections.length === 0) sections.push({ start: 0, end: duration, type: 'verse', energy: 0 });
    sections[0].start = 0;
    sections[sections.length - 1].end = duration;
  }
  const map: BeatMap = {
    v: BEATMAP_VERSION,
    analyzerVersion: ANALYZER_VERSION,
    videoId: meta.videoId,
    duration,
    bpm: Math.round(r.bpm * 100) / 100,
    beats,
    downbeats,
    sections,
    source: meta.source,
  };
  if (meta.partial) map.partial = true;
  return map;
}

export interface OfflineOptions {
  videoId?: string;
  /** Default 'device'. */
  source?: BeatMapSource;
  /** Song duration (s) recorded in the map; default: the PCM length. */
  duration?: number;
  /** Analyse only the first N seconds; the map is then marked `partial: true`. */
  maxSeconds?: number;
  /** Called with 0..1 as analysis progresses (synchronously). */
  onProgress?: (fraction: number) => void;
}

/** Extract features from mono PCM at any sample rate (resampled to 22050 Hz internally). */
export function extractFeatures(
  pcm: Float32Array,
  sampleRate: number,
  onProgress?: (fraction: number) => void,
): Features {
  const store = new FeatureStore(Math.ceil((pcm.length / sampleRate) * FRAME_RATE) + 8);
  const fx = new FeatureExtractor(store);
  const rs = new Resampler(sampleRate, SAMPLE_RATE);
  const chunk = Math.max(4096, Math.round(sampleRate * 2));
  for (let i = 0; i < pcm.length; i += chunk) {
    fx.push(rs.process(pcm.subarray(i, Math.min(pcm.length, i + chunk))));
    onProgress?.((0.9 * Math.min(pcm.length, i + chunk)) / pcm.length);
  }
  fx.push(rs.flush());
  fx.flush();
  return store.view();
}

/** Analyse a whole decoded file (mono PCM) into a BeatMap. */
export function analyzeOffline(pcm: Float32Array, sampleRate: number, opts: OfflineOptions = {}): BeatMap {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) throw new Error(`analyzeOffline: invalid sampleRate ${sampleRate}`);
  const fullDuration = opts.duration ?? pcm.length / sampleRate;
  let input = pcm;
  let partial = false;
  if (opts.maxSeconds !== undefined && opts.maxSeconds >= 0) {
    const n = Math.min(pcm.length, Math.round(opts.maxSeconds * sampleRate));
    if (n < pcm.length) {
      input = pcm.subarray(0, n);
      partial = true;
    }
  }
  const features = extractFeatures(input, sampleRate, opts.onProgress);
  const analysed = Math.min(fullDuration, input.length / sampleRate);
  const result = analyzeFeatures(features, { duration: partial ? analysed : fullDuration });
  opts.onProgress?.(1);
  return toBeatMap(result, {
    videoId: opts.videoId ?? '',
    duration: fullDuration,
    source: opts.source ?? 'device',
    partial,
  });
}
