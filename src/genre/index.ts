/** Multi-source, per-song genre lookup (see lookup.ts). */
export { combineGenres, familyDisagreements, MAX_GENRES, type Combined, type ScoredGenre } from './combine';
export { defaultSpacing, HttpError, parseRetryAfter, PoliteHttp, type GenreFetch, type PoliteOptions } from './http';
export { DEFAULT_SOURCES, FAILED_RETRY_MS, lookupDue, lookupGenres, NONE_TTL_MS, parseGenreLookup, recombine, reusable, type LookupOptions } from './lookup';
export type { SongQuery } from './match';
export { canonicalGenre, canonicalGenres, families, specificity } from './names';
export type { GenreLookup, GenreSource, SourceAnswer, SourceId, SourceOutcome } from './types';
