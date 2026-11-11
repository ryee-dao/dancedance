/**
 * Beat maps shared by players ("contributed" maps): the extra rules a map
 * must pass, on top of `validateBeatMap`, before anyone uploads it, before
 * the relay forwards it, and before the cloud job publishes it.
 *
 * The relay (cloudflare/add-song-worker) has its own compact copy of these
 * rules; a test checks that both agree.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
import { BEATMAP_VERSION, SECTION_TYPES, validateBeatMap, type BeatMap } from './beatmap';

/** Sources a player may contribute: 'tab' (heard via tab audio) and 'device' (analysed from a local download). */
export const SHARED_SOURCES = ['tab', 'device'] as const;
export type SharedSource = (typeof SHARED_SOURCES)[number];
/** Request size limit of the relay's POST /map (bytes). Real maps are 5-15 KB. */
export const SHARED_MAP_MAX_BYTES = 40_000;
export const SHARED_MIN_DURATION = 30;
export const SHARED_MAX_DURATION = 900;
export const SHARED_MIN_BPM = 60;
export const SHARED_MAX_BPM = 220;
/** Beat count must be within this fraction of bpm x (last beat - first beat) / 60. */
export const SHARED_COUNT_TOLERANCE = 0.1;
/** Median beat interval must be within this fraction of 60 / bpm. */
export const SHARED_INTERVAL_TOLERANCE = 0.05;
/** The beats must span at least this fraction of the song. */
export const SHARED_MIN_SPAN = 0.6;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VERSION_RE = /^[0-9A-Za-z.+-]{1,32}$/;
const TOP_KEYS = new Set(['v', 'analyzerVersion', 'videoId', 'duration', 'bpm', 'beats', 'downbeats', 'sections', 'source', 'partial']);
const SECTION_KEYS = new Set(['start', 'end', 'type', 'energy']);
const EPS = 0.002;

export type SharedCheck = { ok: true; map: BeatMap } | { ok: false; rule: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Fraction of the song between the first and the last beat. */
export function beatSpan(map: Pick<BeatMap, 'beats' | 'duration'>): number {
  const b = map.beats;
  return b.length >= 2 && map.duration > 0 ? (b[b.length - 1] - b[0]) / map.duration : 0;
}

/** Rules on an already validated map; returns the first rule broken, or null. */
export function sharedMapProblem(map: BeatMap): string | null {
  if (map.v !== BEATMAP_VERSION) return 'version';
  if (!VERSION_RE.test(map.analyzerVersion)) return 'analyzer-version';
  if (!VIDEO_ID_RE.test(map.videoId)) return 'video-id';
  if (!(SHARED_SOURCES as readonly string[]).includes(map.source)) return 'source';
  if (map.partial) return 'partial';
  if (!(map.duration >= SHARED_MIN_DURATION && map.duration <= SHARED_MAX_DURATION)) return 'duration';
  if (!(map.bpm >= SHARED_MIN_BPM && map.bpm <= SHARED_MAX_BPM)) return 'bpm';
  const b = map.beats;
  if (b.length < 16) return 'beat-count';
  for (let i = 0; i < b.length; i++) {
    if (!Number.isFinite(b[i]) || b[i] < 0 || b[i] > map.duration + EPS) return 'beats';
    if (i > 0 && !(b[i] > b[i - 1])) return 'beats';
  }
  const span = b[b.length - 1] - b[0];
  if (span < SHARED_MIN_SPAN * map.duration) return 'beat-span';
  const expected = (map.bpm * span) / 60;
  if (Math.abs(b.length - 1 - expected) > SHARED_COUNT_TOLERANCE * expected) return 'beat-count';
  const iv = b.slice(1).map((t, i) => t - b[i]).sort((x, y) => x - y);
  const med = iv.length % 2 ? iv[(iv.length - 1) / 2] : (iv[iv.length / 2 - 1] + iv[iv.length / 2]) / 2;
  if (Math.abs(med - 60 / map.bpm) > SHARED_INTERVAL_TOLERANCE * (60 / map.bpm)) return 'beat-interval';
  for (let i = 0; i < map.downbeats.length; i++) {
    const d = map.downbeats[i];
    if (!Number.isInteger(d) || d < 0 || d >= b.length || (i > 0 && d <= map.downbeats[i - 1])) return 'downbeats';
  }
  const s = map.sections;
  if (!s.length || s.length > 64) return 'sections';
  for (let i = 0; i < s.length; i++) {
    const prevEnd = i === 0 ? 0 : s[i - 1].end;
    if (Math.abs(s[i].start - prevEnd) > EPS || !(s[i].end > s[i].start)) return 'sections';
    if (!(SECTION_TYPES as readonly string[]).includes(s[i].type) || !(s[i].energy >= 0 && s[i].energy <= 1)) return 'sections';
  }
  if (Math.abs(s[s.length - 1].end - map.duration) > EPS) return 'sections';
  return null;
}

/** Strict check of an untrusted value (exact shape, no extra fields) as a shareable map. */
export function checkSharedMap(x: unknown): SharedCheck {
  if (!isObj(x)) return { ok: false, rule: 'shape' };
  for (const k of Object.keys(x)) if (!TOP_KEYS.has(k)) return { ok: false, rule: 'extra-field' };
  if (Array.isArray(x.sections)) {
    for (const sec of x.sections) {
      if (!isObj(sec)) return { ok: false, rule: 'sections' };
      for (const k of Object.keys(sec)) if (!SECTION_KEYS.has(k)) return { ok: false, rule: 'extra-field' };
    }
  }
  let map: BeatMap;
  try {
    map = validateBeatMap(x);
  } catch {
    return { ok: false, rule: 'invalid' };
  }
  const problem = sharedMapProblem(map);
  return problem ? { ok: false, rule: problem } : { ok: true, map };
}
