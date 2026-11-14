/**
 * Per-song genres from several public sources, combined by agreement.
 *
 *   const http = new PoliteHttp({ fetch });
 *   const result = await lookupGenres({ artist, title, durationSec }, { http, previous });
 *
 * Each source runs independently (in parallel; the client keeps one request
 * per host in flight) and must confirm it found THIS song by this artist, or
 * it answers 'none'. `previous` (the stored result) is the cache: a 'found'
 * answer is kept for ever, a 'none' is asked again after NONE_TTL_MS, and a
 * 'failed' one (rate limit, network) on the next lookup. Only the artist and
 * the title are ever sent.
 *
 * Adding a source (for example a keyed one such as Last.fm) is one file
 * implementing GenreSource plus an entry in DEFAULT_SOURCES (or a custom
 * `sources` list); stored results then simply lack it and are due again.
 */
import { combineGenres } from './combine';
import { HttpError, type PoliteHttp } from './http';
import type { SongQuery } from './match';
import { itunes } from './sources/itunes';
import { musicbrainz } from './sources/musicbrainz';
import { theaudiodb } from './sources/theaudiodb';
import { wikidata } from './sources/wikidata';
import { wikipedia } from './sources/wikipedia';
import type { GenreLookup, GenreSource, SourceId, SourceOutcome } from './types';

export const DEFAULT_SOURCES: readonly GenreSource[] = [wikipedia, wikidata, musicbrainz, theaudiodb, itunes];

const DAY = 24 * 3600_000;
/** A source that had nothing is asked again after this long. */
export const NONE_TTL_MS = 30 * DAY;
/** A source that could not be asked is tried again after this long (callers may retry sooner, e.g. the next cloud run). */
export const FAILED_RETRY_MS = 6 * 3600_000;

export interface LookupOptions {
  http: PoliteHttp;
  /** The stored result for this song, if any. */
  previous?: GenreLookup | null;
  sources?: readonly GenreSource[];
  now?: () => Date;
  log?: (line: string) => void;
}

/** Whether a stored source answer can be used instead of asking again. */
export function reusable(o: SourceOutcome | undefined, now: Date): boolean {
  if (!o) return false;
  if (o.status === 'found') return true;
  if (o.status === 'none') return now.getTime() - Date.parse(o.at) < NONE_TTL_MS;
  return false;
}

/** Whether a stored result should be looked up again (missing, a failed source, an expired 'none', or a new source). */
export function lookupDue(l: GenreLookup | null | undefined, now: Date, sources: readonly GenreSource[] = DEFAULT_SOURCES, failedRetryMs = FAILED_RETRY_MS): boolean {
  if (!l) return true;
  for (const s of sources) {
    const o = l.sources[s.id];
    if (!o) return true;
    if (o.status === 'failed' && now.getTime() - Date.parse(o.at) >= failedRetryMs) return true;
    if (o.status === 'none' && !reusable(o, now)) return true;
  }
  return false;
}

/** Recompute the combined list from stored source answers (no network). */
export function recombine(sourcesSaid: Partial<Record<SourceId, SourceOutcome>>, sources: readonly GenreSource[] = DEFAULT_SOURCES): Pick<GenreLookup, 'genres' | 'moods'> {
  const c = combineGenres(sourcesSaid, sources);
  return { genres: c.genres, ...(c.moods.length ? { moods: c.moods } : {}) };
}

export async function lookupGenres(song: SongQuery, o: LookupOptions): Promise<GenreLookup> {
  const sources = o.sources ?? DEFAULT_SOURCES;
  const now = o.now ?? (() => new Date());
  const prev = o.previous?.sources ?? {};
  const out: Partial<Record<SourceId, SourceOutcome>> = {};
  await Promise.all(
    sources.map(async (src) => {
      const old = prev[src.id];
      if (reusable(old, now())) {
        out[src.id] = old;
        return;
      }
      try {
        const a = await src.lookup(song, o.http);
        out[src.id] = { ...a, at: now().toISOString() } as SourceOutcome;
      } catch (e) {
        const reason = e instanceof HttpError ? e.message : `error: ${String((e as Error)?.message ?? e).slice(0, 120)}`;
        out[src.id] = { status: 'failed', at: now().toISOString(), reason };
      }
      const r = out[src.id]!;
      o.log?.(`    ${src.id}: ${r.status}${r.status === 'found' ? ` ${JSON.stringify(r.genres)}${r.ref ? ` (${r.ref})` : ''}` : ` - ${r.reason}`}`);
    }),
  );
  const ordered: Partial<Record<SourceId, SourceOutcome>> = {};
  for (const s of sources) if (out[s.id]) ordered[s.id] = out[s.id];
  const at = Object.values(ordered).reduce((m, x) => (x && x.at > m ? x.at : m), '');
  return {
    ...recombine(ordered, sources),
    sources: ordered,
    complete: !Object.values(ordered).some((x) => x?.status === 'failed'),
    at,
  };
}

/** Validate a stored result (JSON from a file or the TV's store); null when unusable. */
export function parseGenreLookup(raw: unknown): GenreLookup | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const src = r.sources;
  if (!src || typeof src !== 'object') return null;
  const sources: Partial<Record<SourceId, SourceOutcome>> = {};
  const strings = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= 80).slice(0, n) : []);
  for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
    const x = (v ?? {}) as Record<string, unknown>;
    const at = typeof x.at === 'string' ? x.at : '';
    if (!at) continue;
    if (x.status === 'found') {
      const genres = strings(x.genres, 30);
      if (!genres.length) continue;
      const moods = strings(x.moods, 10);
      sources[id as SourceId] = { status: 'found', at, genres, ...(moods.length ? { moods } : {}), ...(typeof x.ref === 'string' ? { ref: x.ref.slice(0, 200) } : {}) };
    } else if (x.status === 'none' || x.status === 'failed') {
      const reason = typeof x.reason === 'string' ? x.reason.slice(0, 300) : '';
      sources[id as SourceId] =
        x.status === 'none'
          ? { status: 'none', at, reason, ...(typeof x.ref === 'string' ? { ref: x.ref.slice(0, 200) } : {}) }
          : { status: 'failed', at, reason };
    }
  }
  const genres = strings(r.genres, 12);
  const moods = strings(r.moods, 10);
  return {
    genres,
    ...(moods.length ? { moods } : {}),
    sources,
    complete: r.complete === true,
    at: typeof r.at === 'string' ? r.at : '',
  };
}
