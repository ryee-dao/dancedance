/**
 * The shared beat-map JSON format and helpers.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */

export const BEATMAP_VERSION = 1;
/** Bump whenever analysis results change (cached maps from older analysers can then be refreshed). */
export const ANALYZER_VERSION = '1.2.0';

export type BeatMapSource = 'cloud' | 'device' | 'file' | 'tab' | 'mic';
export type SectionType = 'intro' | 'verse' | 'chorus' | 'drop' | 'outro';

export interface Section {
  start: number;
  end: number;
  type: SectionType;
  energy: number;
}

/**
 * Optional per-bar readings (analyser 1.2.0+), for the choreographer. Each
 * string has one digit 0-9 per downbeat: character k describes the bar from
 * downbeat k to downbeat k + 1 (the last one: one typical bar). Maps without
 * them fall back to section energy.
 */
export interface BarReadings {
  /** Overall intensity, relative within the song (0 = quietest, 9 = loudest). */
  energy: string;
  /** Bass (below 200 Hz) level, relative within the song. */
  bass: string;
  /** How new the bar's groove is compared with the previous 1, 2 or 4 bars (0 = a repeat). */
  change: string;
  /** Bar indices (into downbeats) where a drop starts, increasing. */
  drops: number[];
}

/** Longest list of drops a map may carry. */
export const MAX_DROPS = 64;
export const BAR_READING_KEYS = ['energy', 'bass', 'change'] as const;
const DIGITS_RE = /^[0-9]*$/;

export interface BeatMap {
  v: number;
  analyzerVersion: string;
  videoId: string;
  duration: number;
  bpm: number;
  beats: number[];
  downbeats: number[];
  sections: Section[];
  source: BeatMapSource;
  partial?: boolean;
  /** Per-bar readings (optional; see BarReadings). */
  bars?: BarReadings;
}

export const BEATMAP_SOURCES: readonly BeatMapSource[] = ['cloud', 'device', 'file', 'tab', 'mic'];
export const SECTION_TYPES: readonly SectionType[] = ['intro', 'verse', 'chorus', 'drop', 'outro'];

/** Higher is better: cloud 5 > device 4 > file 3 > tab 2 > mic 1. */
export function sourceRank(source: BeatMapSource): number {
  switch (source) {
    case 'cloud':
      return 5;
    case 'device':
      return 4;
    case 'file':
      return 3;
    case 'tab':
      return 2;
    case 'mic':
      return 1;
    default:
      return 0;
  }
}

/**
 * Cache policy: should `incoming` replace `existing`? A complete map beats a
 * partial one; among equally complete maps the better source wins; a map of
 * the same source and completeness replaces the older one (newer analysis).
 */
export function shouldReplace(existing: BeatMap | undefined | null, incoming: BeatMap): boolean {
  if (!existing) return true;
  const ec = existing.partial ? 0 : 1;
  const ic = incoming.partial ? 0 : 1;
  if (ic !== ec) return ic > ec;
  return sourceRank(incoming.source) >= sourceRank(existing.source);
}

/** Round seconds to milliseconds. */
export function roundMs(t: number): number {
  return Math.round(t * 1000) / 1000;
}

export class BeatMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeatMapError';
  }
}

const TIME_EPS = 0.0015;

function fail(msg: string): never {
  throw new BeatMapError(`Invalid beat map: ${msg}`);
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function finiteNum(x: unknown, name: string): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) fail(`${name} must be a finite number`);
  return x;
}

/**
 * Validate an unknown value as a BeatMap (structure, types, ranges, ordering)
 * and return a normalised copy (times rounded to ms, unknown fields dropped).
 * Throws BeatMapError with a description of the first problem found.
 */
export function validateBeatMap(x: unknown): BeatMap {
  if (!isObj(x)) fail('expected an object');
  const v = finiteNum(x.v, 'v');
  if (v !== BEATMAP_VERSION) fail(`unsupported version v=${v} (expected ${BEATMAP_VERSION})`);
  if (typeof x.analyzerVersion !== 'string' || x.analyzerVersion.length === 0 || x.analyzerVersion.length > 32) {
    fail('analyzerVersion must be a non-empty string');
  }
  if (typeof x.videoId !== 'string' || x.videoId.length > 256) fail('videoId must be a string (<= 256 chars)');
  const duration = finiteNum(x.duration, 'duration');
  if (duration < 0 || duration > 24 * 3600) fail('duration out of range');
  const bpm = finiteNum(x.bpm, 'bpm');
  if (bpm < 0 || bpm > 1000) fail('bpm out of range');
  if (typeof x.source !== 'string' || !(BEATMAP_SOURCES as readonly string[]).includes(x.source)) {
    fail(`source must be one of ${BEATMAP_SOURCES.join(', ')}`);
  }
  if (x.partial !== undefined && typeof x.partial !== 'boolean') fail('partial must be a boolean');

  if (!Array.isArray(x.beats)) fail('beats must be an array');
  const beats: number[] = [];
  for (let i = 0; i < x.beats.length; i++) {
    const t = finiteNum(x.beats[i], `beats[${i}]`);
    if (t < -TIME_EPS || t > duration + TIME_EPS) fail(`beats[${i}]=${t} outside [0, duration]`);
    if (i > 0 && t <= beats[i - 1]) fail(`beats must be strictly increasing (at index ${i})`);
    beats.push(t);
  }

  if (!Array.isArray(x.downbeats)) fail('downbeats must be an array');
  const downbeats: number[] = [];
  for (let i = 0; i < x.downbeats.length; i++) {
    const d = x.downbeats[i];
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d >= beats.length) {
      fail(`downbeats[${i}] must be an integer index into beats`);
    }
    if (i > 0 && d <= downbeats[i - 1]) fail(`downbeats must be strictly increasing (at index ${i})`);
    downbeats.push(d);
  }

  if (!Array.isArray(x.sections)) fail('sections must be an array');
  const sections: Section[] = [];
  for (let i = 0; i < x.sections.length; i++) {
    const s = x.sections[i];
    if (!isObj(s)) fail(`sections[${i}] must be an object`);
    const start = finiteNum(s.start, `sections[${i}].start`);
    const end = finiteNum(s.end, `sections[${i}].end`);
    if (!(end > start)) fail(`sections[${i}] must have end > start`);
    if (start < -TIME_EPS || end > duration + TIME_EPS) fail(`sections[${i}] outside [0, duration]`);
    if (i > 0 && start < sections[i - 1].end - TIME_EPS) fail(`sections overlap or are unordered (at index ${i})`);
    if (typeof s.type !== 'string' || !(SECTION_TYPES as readonly string[]).includes(s.type)) {
      fail(`sections[${i}].type must be one of ${SECTION_TYPES.join(', ')}`);
    }
    const energy = finiteNum(s.energy, `sections[${i}].energy`);
    if (energy < 0 || energy > 1) fail(`sections[${i}].energy must be within 0..1`);
    sections.push({ start: roundMs(start), end: roundMs(end), type: s.type as SectionType, energy: Math.round(energy * 1000) / 1000 });
  }
  if (sections.length === 0 && duration > 0) fail('at least one section is required');
  const bars = x.bars === undefined ? undefined : validateBars(x.bars, downbeats.length);

  const out: BeatMap = {
    v,
    analyzerVersion: x.analyzerVersion as string,
    videoId: x.videoId as string,
    duration: roundMs(duration),
    bpm: Math.round(bpm * 100) / 100,
    beats: beats.map(roundMs),
    downbeats,
    sections,
    source: x.source as BeatMapSource,
  };
  if (x.partial === true) out.partial = true;
  if (bars) out.bars = bars;
  return out;
}

/** Validate optional per-bar readings against the downbeat count (unknown sub-fields dropped). */
function validateBars(x: unknown, nDownbeats: number): BarReadings {
  if (!isObj(x)) fail('bars must be an object');
  const out = {} as BarReadings;
  for (const k of BAR_READING_KEYS) {
    const v = x[k];
    if (typeof v !== 'string' || !DIGITS_RE.test(v)) fail(`bars.${k} must be a string of digits`);
    if (v.length !== nDownbeats) fail(`bars.${k} must have one digit per downbeat (${nDownbeats})`);
    out[k] = v;
  }
  if (!Array.isArray(x.drops) || x.drops.length > MAX_DROPS) fail(`bars.drops must be an array of at most ${MAX_DROPS} bar indices`);
  const drops: number[] = [];
  for (let i = 0; i < x.drops.length; i++) {
    const d = x.drops[i];
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d >= nDownbeats) fail(`bars.drops[${i}] must be an integer bar index`);
    if (i > 0 && d <= drops[i - 1]) fail(`bars.drops must be strictly increasing (at index ${i})`);
    drops.push(d);
  }
  out.drops = drops;
  return out;
}

/** Digit (0-9) of a 0..1 reading. */
export function quantiseReading(x: number): string {
  const v = Number.isFinite(x) ? Math.round(Math.min(1, Math.max(0, x)) * 9) : 0;
  return String(v);
}

/** Validate and serialise to compact JSON. */
export function serialize(map: BeatMap): string {
  return JSON.stringify(validateBeatMap(map));
}

/** Parse JSON text into a validated BeatMap. Throws BeatMapError on malformed input. */
export function parse(json: string): BeatMap {
  if (typeof json !== 'string') throw new BeatMapError('Invalid beat map: expected a JSON string');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new BeatMapError(`Invalid beat map: not valid JSON (${(e as Error).message})`);
  }
  return validateBeatMap(data);
}

/** Section covering time t (seconds), or undefined. */
export function sectionAt(map: BeatMap, t: number): Section | undefined {
  for (const s of map.sections) if (t >= s.start && t < s.end) return s;
  return map.sections.length && t >= map.sections[map.sections.length - 1].end ? map.sections[map.sections.length - 1] : undefined;
}
