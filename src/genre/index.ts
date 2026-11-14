/** Multi-source, per-song genre lookup (see lookup.ts). */
export { combineGenres, familyDisagreements, MAX_GENRES, type Combined, type ScoredGenre } from './combine';
export { defaultSpacing, HttpError, parseRetryAfter, PoliteHttp, type GenreFetch, type PoliteOptions } from './http';
export { ALBUM_SOURCES, ARTIST_SOURCES, DEFAULT_SOURCES, FAILED_RETRY_MS, SONG_SOURCES, lookupDue, lookupGenres, NONE_TTL_MS, parseGenreLookup, recombine, recombineStored, reusable, type LookupOptions } from './lookup';
export type { SongQuery } from './match';
export { canonicalGenre, canonicalGenres, families, genreSpecificity, specificity } from './names';
export type { GenreLevel, GenreLookup, GenreSource, LookupContext, SourceAnswer, SourceId, SourceLinks, SourceOutcome } from './types';
