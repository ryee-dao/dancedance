/**
 * Genre lookups for songs PLAYED on this device that no published source has
 * genres for: a linked playlist's songs (the cloud looks up only songs.json
 * and the starter pack; the TV's own runner only the songs added on the TV).
 * Without genres such a song is danced by its audio alone, or, with no
 * audio traits either, as "Mixed styles".
 *
 * When such a song plays, it is noted in the page's store (store.genreSongs)
 * and the shared background runner (src/genre/background.ts) looks it up
 * first on its next run, without blocking play: on the web while the song
 * plays (a few small requests beside a YouTube stream), on the TV once the
 * play screen is closed (as for added songs). The result is stored with the
 * song and read by library.ts songGenres & co., so the song's next play is
 * danced by its genres. Empty or failed answers are stored too and retried
 * (the runner's `periodic` schedule, lookup.ts lookupDue). The lookup code
 * is a separate chunk, loaded only when there is something to look up.
 */
import type { GenreRunner, LocalSong } from '../genre/background';
import { getPlatform } from '../platform/platform';
import { store } from '../store';
import { hasPublishedGenres, library } from './library';

/** Window event (detail: the video id) fired when a song starts playing. */
export const SONG_PLAYED_EVENT = 'dd:song-played';

/** Delay before the first run after start-up (songs played before and still due), and after a play. */
const START_DELAY_MS = 25_000;
const PLAY_DELAY_MS = 5_000;

let runner: Promise<GenreRunner | null> | null = null;
let installed = false;

function isTv(): boolean {
  try {
    return getPlatform().isTV;
  } catch {
    return false;
  }
}

/** The played songs the lookup is for: noted, and still without genres from a published source. */
export function playedGenreSongs(parse: (v: unknown) => LocalSong['genreLookup']): LocalSong[] {
  return Object.entries(store.genreSongs())
    .filter(([id]) => !hasPublishedGenres(id))
    .map(([videoId, e]) => ({ videoId, artist: e.artist, title: e.title, ...(e.durationSec ? { durationSec: e.durationSec } : {}), genreLookup: parse(e.lookup) }));
}

function load(): Promise<GenreRunner | null> {
  return (runner ??= Promise.all([import('../genre/background'), import('../genre/lookup')]).then(
    ([{ GenreRunner }, { parseGenreLookup }]) =>
      new GenreRunner({
        songs: () => playedGenreSongs(parseGenreLookup),
        save: (videoId, lookup) => store.setGenreLookup(videoId, lookup),
        // The TV downloads and decodes the song's audio around play: wait until the play screen is closed there.
        busy: () => isTv() && typeof document !== 'undefined' && !!document.querySelector('#app > .screen.play'),
        fetch: (url, init) => fetch(url, init),
        log: (line) => console.info(line),
        periodic: true,
      }),
    (err: unknown) => {
      console.warn('[dd:genres] genre lookup failed to load', err);
      runner = null; // try again on the next play
      return null;
    },
  ));
}

/** Start the runner a while after start-up when songs played before are still due (call once). */
export function installPlayedGenreLookups(): void {
  if (installed) return;
  installed = true;
  if (!Object.keys(store.genreSongs()).length) return;
  setTimeout(() => void load().then((r) => r?.kick(0)), START_DELAY_MS);
}

/**
 * A song started playing: when nothing this device reads has genres for it, note it and have it looked up first
 * (in the background; its next play is danced by the result). Starter songs (curated styles) and added songs (the
 * cloud's or the TV's own lookups) are left to their own lookups.
 */
export function notePlayedForGenres(videoId: string): void {
  // Other runners (the TV's, for the songs added on it) take the song first too when it is due.
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SONG_PLAYED_EVENT, { detail: videoId }));
  const song = library.find(videoId);
  if (!song || song.source !== 'playlist' || !song.artist || !song.title || hasPublishedGenres(videoId)) return;
  store.noteGenreSong(videoId, { artist: song.artist, title: song.title });
  void load().then((r) => r?.prioritize(videoId, PLAY_DELAY_MS));
}
