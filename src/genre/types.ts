/** Shared shapes of the multi-source genre lookup (see lookup.ts). */
import type { PoliteHttp } from './http';
import type { SongQuery } from './match';

export type { SongQuery };

/** Built-in sources. A keyed source added later (e.g. Last.fm) adds its id here. */
export type SourceId = 'wikipedia' | 'wikidata' | 'musicbrainz' | 'theaudiodb' | 'itunes';

/** What one source said about one song. */
export type SourceOutcome =
  | {
      status: 'found';
      /** ISO time of the answer. */
      at: string;
      /** Genre names as the source spelled them (normalised later, so the vocabulary can improve). */
      genres: string[];
      /** Mood words, kept apart from genres (TheAudioDB). */
      moods?: string[];
      /** Which page / item / record was confirmed (debugging). */
      ref?: string;
    }
  | {
      /** The source answered but has no confirmed song with genres. Cached with an expiry. */
      status: 'none';
      at: string;
      reason: string;
      ref?: string;
    }
  | {
      /** The source could not be asked (rate limit, network): try again later. Never cached as an answer. */
      status: 'failed';
      at: string;
      reason: string;
    };

/** A source's answer before it is stamped with a time. */
export type SourceAnswer =
  | { status: 'found'; genres: string[]; moods?: string[]; ref?: string }
  | { status: 'none'; reason: string; ref?: string };

export interface GenreSource {
  id: SourceId;
  /**
   * Sources that share editors or data (Wikipedia and Wikidata) are one
   * group; a second source from the same group counts half when sources agree.
   */
  group: string;
  /** How much one report from this source counts (curated encyclopedias 1, user tags less, store labels least). */
  weight: number;
  /** Names from this source are user tags: unknown ones must look like a genre. */
  strictNames?: boolean;
  /** Find THIS song by this artist and return its genres, or 'none'. Throws HttpError when it could not ask. */
  lookup(song: SongQuery, http: PoliteHttp): Promise<SourceAnswer>;
}

/** The stored result for one song: combined genres plus, for debugging and caching, what each source said. */
export interface GenreLookup {
  /** At most MAX_GENRES names, best first. */
  genres: string[];
  /** Mood words from sources that give them (TheAudioDB), never mixed into genres. */
  moods?: string[];
  sources: Partial<Record<SourceId, SourceOutcome>>;
  /** Every source answered (found or none); false when some failed and should be asked again. */
  complete: boolean;
  /** ISO time of the newest source answer. */
  at: string;
}

export type { PoliteHttp };
