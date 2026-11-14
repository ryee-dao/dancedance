/// <reference types="node" />
/**
 * Shared bits of the song-style evaluation harness (tools/eval): file
 * formats, a seeded RNG, and a polite fetch for the iTunes endpoints.
 *
 * File formats (all JSON):
 *   sample.json        SampleFile   what sample.ts picked (songs + skipped)
 *   videos.json        Record<key, VideoPick>     run.ts --stage find: the YouTube video + top comments
 *   expectations.json  Record<key, Expectation>   memory guess + researched consensus, written BEFORE analysis
 *   verdicts.json      Record<key, Verdict>        the judge's verdict, written AFTER looking at results
 *   genres.json        Record<key, string[]>       optional per-song genre lists (SongInfo.genres)
 *   results.json       ResultsFile  what run.ts produced (one SongResult per song)
 * `key` is the iTunes trackId as a string.
 */

export interface SampledSong {
  key: string;
  half: 'known' | 'obscure';
  artist: string;
  title: string;
  collection?: string;
  /** iTunes primaryGenreName. */
  genre?: string;
  durationSec: number;
  releaseYear?: number;
  /** Where the dice found it ("chart us/18", "term '80s hits'", "word 'gnomic'"). */
  source: string;
}

export interface SkippedPick {
  source: string;
  artist?: string;
  title?: string;
  genre?: string;
  why: string;
}

export interface SampleFile {
  seed: number;
  createdAt: string;
  songs: SampledSong[];
  skipped: SkippedPick[];
}

export interface Guess {
  family?: string;
  sub?: string;
  /** 'calm' (ballad / sad / chill), 'mid', 'driving' (hype / heavy / banger). */
  energy?: 'calm' | 'mid' | 'driving';
  /** Rhythm or texture that should show (four-on-the-floor, half-time trap feel, swing, heavy guitars ...). */
  rhythm?: string;
}

export interface EvidenceSource {
  /** Site or source name ("AllMusic review", "Bandcamp tags", "YouTube top comments"). */
  site: string;
  /** Short quote or paraphrase. */
  says: string;
  url?: string;
}

export interface Expectation {
  /** The judge's guess from memory alone; absent = "unknown to judge" from memory. */
  memory?: Guess;
  /** The researched consensus (written before the pipeline ran, never revised after). */
  consensus?: Guess & { line: string };
  /** 'several' independent sources agree, a 'single' source, or 'none' found (then memory, else unknown). */
  evidence: 'several' | 'single' | 'none';
  sources: EvidenceSource[];
  /** Where memory and research disagree. */
  disagreement?: string;
  /** false = nothing found and no memory: only internal consistency is judged. */
  known: boolean;
}

export interface Verdict {
  verdict: 'right' | 'acceptable' | 'wrong' | 'unjudged';
  reason: string;
  /** Failure causes (genre-too-broad, trait-misread, lexicon-gap, tempo-double, tempo-half, level-handling, fetch). */
  causes?: string[];
}

export interface LevelSummary {
  level: 'chill' | 'cardio' | 'sweaty';
  /** Share of danced beats from genre-exclusive sets (tierBeats). */
  genreShare: number;
  /** Danced beats per genre set actually used. */
  genreBeats: Record<string, number>;
  /** Share of danced instances (and beats) performed at half time. */
  halfInstances: number;
  halfBeats: number;
  /** Shares of danced beats in jump moves and in high-level moves. */
  jumpShare: number;
  highShare: number;
  distinctMoves: number;
  /** Ten most-used moves by danced beats: "Name (genre|global) beats". */
  top: { name: string; tier: string; beats: number }[];
}

export interface VideoPick {
  status: 'ok' | 'not-found' | 'error';
  message?: string;
  id?: string;
  title?: string;
  channel?: string;
  /** pick.ts tier, or 'relaxed-topic' / 'relaxed-any' when the cloud job's own ranking found nothing. */
  tier?: string;
  seconds?: number | null;
  views?: number | null;
  /** Whether the cloud job's own ranking (pick.ts rankCandidates) chose it. */
  strictPick?: boolean;
  /** A few top listener comments (text only, trimmed). */
  comments?: string[];
}

export interface StyleSummary {
  label: string;
  source: string;
  calm?: number;
  families: Record<string, number>;
  subs?: Record<string, number>;
  themes: string[];
  subName?: string;
  open: string[];
  openness: Record<string, number>;
}

/** Pass B: the same song with the looked-up genre list (SongInfo.genres). */
export interface PassB {
  genres: string[];
  /** What each source said ("found: [...]", "none: reason", "failed: reason"). */
  said: Record<string, string>;
  style?: StyleSummary;
  levels?: LevelSummary[];
  verdict?: Verdict;
}

export interface SongResult {
  song: SampledSong;
  status: 'ok' | 'not-found' | 'fetch-failed' | 'analysis-failed';
  message?: string;
  video?: VideoPick;
  bpm?: number;
  traits?: Record<string, number>;
  /** Pass A: iTunes genre tag + traits + bpm. */
  style?: StyleSummary;
  halfCount?: boolean;
  levels?: LevelSummary[];
  /** Pass B, when a genres file was given. */
  b?: PassB;
  expectation?: Expectation;
  verdict?: Verdict;
}

export interface ResultsFile {
  createdAt: string;
  analyzerVersion: string;
  sample: string;
  genresFile?: string;
  results: SongResult[];
}

/** mulberry32: small, seedable, good enough for sampling. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let lastFetch = 0;
/**
 * GET JSON with default client headers, at least `gapMs` after the previous
 * request (plus jitter); backs off 60 s / 120 s / 240 s on 403 / 429 / 5xx and
 * gives up after that. Only the URL (search text) is sent.
 */
export async function politeJson(url: string, gapMs = 3500): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastFetch + gapMs + Math.random() * 1500 - Date.now();
    if (wait > 0) await sleep(wait);
    lastFetch = Date.now();
    const res = await fetch(url);
    if (res.ok) return res.json();
    if ((res.status === 403 || res.status === 429 || res.status >= 500) && attempt < 3) {
      const back = 60_000 * 2 ** attempt;
      console.error(`  HTTP ${res.status}; backing off ${back / 1000} s`);
      await sleep(back);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url.replace(/\?.*$/, '?…')}`);
  }
}

export function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

export const flag = (name: string) => process.argv.includes(`--${name}`);
