/**
 * Per-song genres from several public sources, combined by agreement.
 *
 *   const http = new PoliteHttp({ fetch });
 *   const result = await lookupGenres({ artist, title, durationSec, album }, { http, previous });
 *
 * Sources answer at three levels (types.ts GenreLevel): the song itself,
 * its album, its artist. Each source runs independently (in parallel; the
 * client keeps one request per host in flight and sends a repeated request
 * once) and must confirm it found THIS song (its album, its artist), or it
 * answers 'none'. Album and artist sources may follow links that other
 * sources confirmed (`needs`): they wait for those, and when one of them
 * failed they are marked failed too (asked again later), never 'none'.
 *
 * `previous` (the stored result) is the cache: a 'found' answer is kept for
 * ever (unless the source's version is newer), a 'none' is asked again after
 * NONE_TTL_MS, and a 'failed' one on the next lookup. A source whose needed
 * source was asked anew is asked anew too. Only the artist, the title and
 * the album name are ever sent.
 *
 * Adding a source (for example a keyed one such as Last.fm) is one file
 * implementing GenreSource plus an entry in DEFAULT_SOURCES (or a custom
 * `sources` list); stored results then simply lack it and are due again.
 */
import { combineGenres } from './combine';
import { HttpError, type PoliteHttp } from './http';
import type { SongQuery } from './match';
import { discogsAlbum } from './sources/discogs';
import { itunes, itunesAlbum, itunesArtist } from './sources/itunes';
import { musicbrainz, musicbrainzAlbum, musicbrainzArtist } from './sources/musicbrainz';
import { theaudiodb, theaudiodbArtist } from './sources/theaudiodb';
import { wikidata } from './sources/wikidata';
import { wikidataAlbum, wikidataArtist, wikipediaAlbum, wikipediaArtist } from './sources/wikimediaContext';
import { wikipedia } from './sources/wikipedia';
import type { GenreLevel, GenreLookup, GenreSource, LookupContext, SourceId, SourceLinks, SourceOutcome } from './types';

/** The song's own sources. */
export const SONG_SOURCES: readonly GenreSource[] = [wikipedia, wikidata, musicbrainz, theaudiodb, itunes];
/** Its album's. */
export const ALBUM_SOURCES: readonly GenreSource[] = [musicbrainzAlbum, wikipediaAlbum, wikidataAlbum, discogsAlbum, itunesAlbum];
/** Its artist's (kept apart as artistGenres). */
export const ARTIST_SOURCES: readonly GenreSource[] = [musicbrainzArtist, wikipediaArtist, wikidataArtist, theaudiodbArtist, itunesArtist];

export const DEFAULT_SOURCES: readonly GenreSource[] = [...SONG_SOURCES, ...ALBUM_SOURCES, ...ARTIST_SOURCES];

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
export function reusable(o: SourceOutcome | undefined, now: Date, src?: Pick<GenreSource, 'version'>): boolean {
  if (!o || o.status === 'failed') return false;
  if ((o.v ?? 1) < (src?.version ?? 1)) return false;
  if (o.status === 'found') return true;
  return now.getTime() - Date.parse(o.at) < NONE_TTL_MS;
}

/** Whether a stored result should be looked up again (missing, a failed source, an expired 'none', an older source version, or a new source). */
export function lookupDue(l: GenreLookup | null | undefined, now: Date, sources: readonly GenreSource[] = DEFAULT_SOURCES, failedRetryMs = FAILED_RETRY_MS): boolean {
  if (!l) return true;
  for (const s of sources) {
    const o = l.sources[s.id];
    if (!o) return true;
    if (o.status === 'failed') {
      if (now.getTime() - Date.parse(o.at) >= failedRetryMs) return true;
      continue;
    }
    if (!reusable(o, now, s)) return true;
  }
  return false;
}

/** Recompute the combined lists from stored source answers (no network). */
export function recombine(sourcesSaid: Partial<Record<SourceId, SourceOutcome>>, sources: readonly GenreSource[] = DEFAULT_SOURCES): Pick<GenreLookup, 'genres' | 'genreLevels' | 'artistGenres' | 'moods'> {
  const c = combineGenres(sourcesSaid, sources);
  return {
    genres: c.genres,
    ...(c.genres.length ? { genreLevels: c.levels } : {}),
    ...(c.artistGenres.length ? { artistGenres: c.artistGenres } : {}),
    ...(c.moods.length ? { moods: c.moods } : {}),
  };
}

export async function lookupGenres(song: SongQuery, o: LookupOptions): Promise<GenreLookup> {
  const sources = o.sources ?? DEFAULT_SOURCES;
  const now = o.now ?? (() => new Date());
  const prev = o.previous?.sources ?? {};
  const byId = new Map(sources.map((s) => [s.id, s]));
  const running = new Map<SourceId, Promise<{ outcome: SourceOutcome; fresh: boolean }>>();
  const run = (src: GenreSource): Promise<{ outcome: SourceOutcome; fresh: boolean }> => {
    let p = running.get(src.id);
    if (p) return p;
    p = (async () => {
      const deps = await Promise.all((src.needs ?? []).filter((id) => byId.has(id)).map(async (id) => ({ id, ...(await run(byId.get(id)!)) })));
      const old = prev[src.id];
      if (reusable(old, now(), src) && !deps.some((d) => d.fresh)) return { outcome: old!, fresh: false };
      const failedDep = deps.find((d) => d.outcome.status === 'failed');
      let outcome: SourceOutcome;
      if (failedDep) {
        outcome = { status: 'failed', at: now().toISOString(), reason: `needs ${failedDep.id}, which failed` };
      } else {
        const ctx: LookupContext = {
          outcome: async (id) => (deps.some((d) => d.id === id) ? deps.find((d) => d.id === id)!.outcome : undefined),
        };
        try {
          const a = await src.lookup(song, o.http, ctx);
          outcome = { ...a, at: now().toISOString(), ...(src.version && src.version > 1 ? { v: src.version } : {}) } as SourceOutcome;
        } catch (e) {
          const reason = e instanceof HttpError ? e.message : `error: ${String((e as Error)?.message ?? e).slice(0, 120)}`;
          outcome = { status: 'failed', at: now().toISOString(), reason };
        }
      }
      o.log?.(`    ${src.id}: ${outcome.status}${outcome.status === 'found' ? ` ${JSON.stringify(outcome.genres)}${outcome.ref ? ` (${outcome.ref})` : ''}` : ` - ${outcome.reason}`}`);
      return { outcome, fresh: true };
    })();
    running.set(src.id, p);
    return p;
  };
  await Promise.all(sources.map(run));
  const ordered: Partial<Record<SourceId, SourceOutcome>> = {};
  for (const s of sources) ordered[s.id] = (await running.get(s.id)!).outcome;
  const at = Object.values(ordered).reduce((m, x) => (x && x.at > m ? x.at : m), '');
  return {
    ...recombine(ordered, sources),
    sources: ordered,
    complete: !Object.values(ordered).some((x) => x?.status === 'failed'),
    at,
  };
}

const LEVELS: readonly GenreLevel[] = ['song', 'album', 'artist'];
const LINK_KEYS = new Set(['mbArtist', 'mbReleaseGroup', 'wikidata', 'enwiki', 'discogsMaster', 'album', 'albumArticle', 'artistArticle']);

function readLinks(v: unknown): SourceLinks | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out: SourceLinks = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (LINK_KEYS.has(k) && typeof x === 'string' && x && x.length <= 300) out[k as keyof SourceLinks] = x;
  return Object.keys(out).length ? out : undefined;
}

/** Validate a stored result (JSON from a file or the TV's store); null when unusable. Results stored before levels existed stay valid. */
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
    const links = readLinks(x.links);
    const ver = typeof x.v === 'number' && Number.isInteger(x.v) && x.v > 1 ? { v: x.v } : {};
    const ref = typeof x.ref === 'string' ? { ref: x.ref.slice(0, 200) } : {};
    if (x.status === 'found') {
      const genres = strings(x.genres, 30);
      if (!genres.length) continue;
      const moods = strings(x.moods, 10);
      const counts = Array.isArray(x.counts) && x.counts.length === (x.genres as unknown[]).length && x.counts.every((c) => typeof c === 'number') ? (x.counts as number[]).slice(0, genres.length) : undefined;
      sources[id as SourceId] = { status: 'found', at, genres, ...(counts && genres.length === (x.genres as unknown[]).length ? { counts } : {}), ...(moods.length ? { moods } : {}), ...ref, ...(links ? { links } : {}), ...ver };
    } else if (x.status === 'none') {
      const reason = typeof x.reason === 'string' ? x.reason.slice(0, 300) : '';
      sources[id as SourceId] = { status: 'none', at, reason, ...ref, ...(links ? { links } : {}), ...ver };
    } else if (x.status === 'failed') {
      sources[id as SourceId] = { status: 'failed', at, reason: typeof x.reason === 'string' ? x.reason.slice(0, 300) : '' };
    }
  }
  const genres = strings(r.genres, 12);
  const levels = Array.isArray(r.genreLevels) && r.genreLevels.length === genres.length && r.genreLevels.every((l) => LEVELS.includes(l as GenreLevel)) ? (r.genreLevels as GenreLevel[]) : undefined;
  const artistGenres = strings(r.artistGenres, 8);
  const moods = strings(r.moods, 10);
  return {
    genres,
    ...(levels ? { genreLevels: levels } : {}),
    ...(artistGenres.length ? { artistGenres } : {}),
    ...(moods.length ? { moods } : {}),
    sources,
    complete: r.complete === true,
    at: typeof r.at === 'string' ? r.at : '',
  };
}
