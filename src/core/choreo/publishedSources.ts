/**
 * The style sources of a published song as the app reads them on a device
 * (ui/library.ts songGenre / songGenres / songGenreLevels / songArtistGenres):
 * the added song's own entry (public/songs.json) first, else the cloud index
 * (public/beatmaps/index.json, which carries the catalogue and starter
 * songs' lookups); title and artist from the starter pack, else songs.json.
 * Pure: the caller passes the parsed files. For the tools and the
 * whole-catalogue tests, with songStyleOf (songStyle.ts), so they judge the
 * style the app plays.
 */
import type { SongSources } from './songStyle';

interface Entry {
  videoId?: string;
  title?: string;
  artist?: string;
  genre?: unknown;
  genres?: unknown;
  genreLevels?: unknown;
  artistGenres?: unknown;
}

export interface PublishedData {
  starter: readonly Entry[];
  /** public/songs.json */
  songs: { songs?: readonly Entry[] };
  /** public/beatmaps/index.json */
  index: { songs?: Record<string, Entry> };
}

const nonEmpty = (x: unknown): x is unknown[] => Array.isArray(x) && x.length > 0;
const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);

/** The sources of one published song (by video id), as a device reads them. */
export function publishedSources(videoId: string, data: PublishedData): SongSources & { starter: boolean } {
  const st = data.starter.find((s) => s.videoId === videoId);
  const own = (data.songs.songs ?? []).find((s) => s.videoId === videoId);
  const cloud = data.index.songs?.[videoId];
  const info = st ?? own;
  const ownGenres = nonEmpty(own?.genres);
  const genres = ownGenres ? own!.genres : cloud?.genres;
  const genreLevels = ownGenres ? own!.genreLevels : nonEmpty(cloud?.genres) ? cloud!.genreLevels : undefined;
  const artistGenres = nonEmpty(own?.artistGenres) ? own!.artistGenres : cloud?.artistGenres;
  const genre = str(own?.genre) ?? str(cloud?.genre);
  return {
    videoId,
    title: info?.title ?? videoId,
    artist: info?.artist ?? '',
    starter: !!st,
    ...(genre ? { genre } : {}),
    ...(genres !== undefined ? { genres } : {}),
    ...(genreLevels !== undefined ? { genreLevels } : {}),
    ...(artistGenres !== undefined ? { artistGenres } : {}),
  };
}
