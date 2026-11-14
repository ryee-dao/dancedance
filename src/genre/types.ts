/** Shared shapes of the multi-source genre lookup (see lookup.ts). */
import type { PoliteHttp } from './http';
import type { SongQuery } from './match';

export type { SongQuery };

/**
 * What a source's genres are about: the song itself (its own article, item,
 * single or recording, its store track), the album or EP it is on, or the
 * artist in general. Song outranks album outranks artist; artist genres are
 * kept apart (GenreLookup.artistGenres), never mixed into `genres`.
 */
export type GenreLevel = 'song' | 'album' | 'artist';

/** Built-in sources. A keyed source added later (e.g. Last.fm) adds its id here. */
export type SourceId =
  // the song
  | 'wikipedia'
  | 'wikidata'
  | 'musicbrainz'
  | 'theaudiodb'
  | 'itunes'
  | 'title'
  // its album
  | 'musicbrainz-album'
  | 'wikipedia-album'
  | 'wikidata-album'
  | 'discogs-album'
  | 'itunes-album'
  // the artist
  | 'musicbrainz-artist'
  | 'wikipedia-artist'
  | 'wikidata-artist'
  | 'theaudiodb-artist'
  | 'itunes-artist';

/**
 * Ids a source found that other sources can follow (all optional): the
 * MusicBrainz artist / release group, a Wikidata item, a Wikipedia article,
 * a Discogs master, the store's album name.
 */
export type SourceLinks = Partial<Record<'mbArtist' | 'mbReleaseGroup' | 'wikidata' | 'enwiki' | 'discogsMaster' | 'album' | 'albumArticle' | 'artistArticle', string>>;

/** What one source said about one song. */
export type SourceOutcome =
  | {
      status: 'found';
      /** ISO time of the answer. */
      at: string;
      /** Genre names as the source spelled them (normalised later, so the vocabulary can improve). */
      genres: string[];
      /** Crowd sources: votes behind each name (same order as `genres`). */
      counts?: number[];
      /** Mood words, kept apart from genres (TheAudioDB). */
      moods?: string[];
      /** Which page / item / record was confirmed (debugging). */
      ref?: string;
      links?: SourceLinks;
      /** Version of the source that answered (absent = 1); an answer from an older version is asked again. */
      v?: number;
    }
  | {
      /** The source answered but has no confirmed song with genres. Cached with an expiry. */
      status: 'none';
      at: string;
      reason: string;
      ref?: string;
      links?: SourceLinks;
      v?: number;
    }
  | {
      /** The source could not be asked (rate limit, network): try again later. Never cached as an answer. */
      status: 'failed';
      at: string;
      reason: string;
    };

/** A source's answer before it is stamped with a time. */
export type SourceAnswer =
  | { status: 'found'; genres: string[]; counts?: number[]; moods?: string[]; ref?: string; links?: SourceLinks }
  | { status: 'none'; reason: string; ref?: string; links?: SourceLinks };

/** What a source can see of the other sources' answers for the same song (only those it `needs`). */
export interface LookupContext {
  outcome(id: SourceId): Promise<SourceOutcome | undefined>;
}

export interface GenreSource {
  id: SourceId;
  level: GenreLevel;
  /**
   * Sources that share editors or data (Wikipedia and Wikidata) are one
   * group; a second source from the same group counts half when sources agree.
   */
  group: string;
  /** How much one report from this source counts (curated encyclopedias 1, user tags less, store labels least). */
  weight: number;
  /** Names from this source are user tags: unknown ones must look like a genre, and single votes need support. */
  strictNames?: boolean;
  /** Bumped when the source starts answering differently; older stored answers are then asked again. */
  version?: number;
  /** Answers without sending any request (the title): its answer says nothing about being online. */
  local?: boolean;
  /** Other sources whose answers this one follows (it waits for them). */
  needs?: readonly SourceId[];
  /**
   * The same site's answer about the artist. When the song answer only
   * repeats it, the site probably copies the artist's genre onto every track,
   * and the song answer counts as artist-level (combine.ts).
   */
  artistTwin?: SourceId;
  /** Find THIS song (its album, its artist) and return genres, or 'none'. Throws HttpError when it could not ask. */
  lookup(song: SongQuery, http: PoliteHttp, ctx?: LookupContext): Promise<SourceAnswer>;
}

/** The stored result for one song: combined genres plus, for debugging and caching, what each source said. */
export interface GenreLookup {
  /** At most MAX_GENRES names about the song, best first: song-level evidence, then album-level. */
  genres: string[];
  /** Level of each entry of `genres` (same order). Absent in results stored before levels were kept. */
  genreLevels?: GenreLevel[];
  /** The artist's usual genres, best first: weak evidence, kept apart from `genres`. */
  artistGenres?: string[];
  /** Mood words from sources that give them (TheAudioDB), never mixed into genres. */
  moods?: string[];
  sources: Partial<Record<SourceId, SourceOutcome>>;
  /** Every source answered (found or none); false when some failed and should be asked again. */
  complete: boolean;
  /** ISO time of the newest source answer. */
  at: string;
}

export type { PoliteHttp };
