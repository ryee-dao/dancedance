/**
 * A song's genre result is one of its essentials: without it the routine is
 * danced by the audio alone, or, with no audio traits either, as "Mixed
 * styles". This prepares it for every song in the library that no published
 * source has genres for (a linked playlist's songs; songs added on this
 * device are looked up by their own runner, platform/androidtv.ts), in the
 * background, and finishes it on the loading screen when it is still missing.
 *
 * Background (installPlayedGenreLookups): the shared runner
 * (src/genre/background.ts) works through those songs by itself, from a few
 * seconds after start-up, again whenever the library changes, with retries
 * and backoff (`periodic`). Order: the song being opened, then songs never
 * looked up, then retries. It is a background job and always yields: on the
 * TV it waits while a song's audio is being downloaded or analysed (busy),
 * and while a song plays it keeps to one small request every PLAY_PACE_MS
 * (the requests are a few KB of JSON; the audio is already on the device or
 * streaming, so they take nothing the dancing needs).
 *
 * Loading screen (genresBeforePlay): when the song about to play has no genre
 * result yet, its song-level lookup (the sources about the track itself: the
 * genres the style needs) runs, or the one already running is awaited, for at
 * most GENRE_WAIT_MS beside the audio's own loading; on a timeout or offline
 * the song plays as before and the lookup finishes for its next play.
 *
 * Results are stored with the song on this device (store.genreSongs) and read
 * by library.ts songGenres & co.; a song the cloud has genres for is never
 * looked up here. The lookup code is a separate chunk, loaded only when there
 * is something to look up.
 */
import type { GenreRunner, LocalSong } from '../genre/background';
import type { GenreLookup } from '../genre/types';
import { getPlatform } from '../platform/platform';
import { store } from '../store';
import { hasPublishedGenres, library, songGenres } from './library';

/** Window event (detail: the video id) fired when a song starts playing. */
export const SONG_PLAYED_EVENT = 'dd:song-played';

/** Delay before the first run after start-up, and after the library changed. */
const START_DELAY_MS = 3_000;
const CHANGE_DELAY_MS = 2_000;
/** While a song plays, at most one background lookup request this often. */
export const PLAY_PACE_MS = 2_000;
/**
 * Longest the loading screen waits for a song's genres, counted from the start of loading (beside the audio's own
 * download and analysis). Measured Nov 2026 (14 songs: "Back in Blood" under both credits and round three of the eval
 * sets; each of the song's own sources on its own, as here, from a cold start): some genres by 2 s for 13 of 14
 * (iTunes and TheAudioDB answer in about 0.2 s), every song source by 6 s for 5 of 14 (Wikipedia median 1.5 s,
 * MusicBrainz 4.1 s, Wikidata 2.7 s, with tails to a minute); the whole song-level lookup in one go took a median of
 * 26 s, so it can't be waited for.
 */
export const GENRE_WAIT_MS = 6_000;

let runner: Promise<GenreRunner | null> | null = null;
let installed = false;

function isTv(): boolean {
  try {
    return getPlatform().isTV;
  } catch {
    return false;
  }
}

function playScreenOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('#app > .screen.play');
}

/** Songs added on this device (the TV): their own runner looks them up and stores the result with the song. */
function deviceAdded(): Set<string> {
  try {
    return new Set((getPlatform().localAddedSongs?.() ?? []).map((s) => s.videoId));
  } catch {
    return new Set();
  }
}

/** The library songs this device looks up, with their stored results: no published genres, not added on this device. */
export function genreSongs(parse: (v: unknown) => LocalSong['genreLookup']): LocalSong[] {
  const own = deviceAdded();
  const stored = store.genreSongs();
  const out = new Map<string, LocalSong>();
  const add = (videoId: string, artist: string | null | undefined, title: string | null | undefined) => {
    if (!artist?.trim() || !title?.trim() || out.has(videoId) || own.has(videoId) || hasPublishedGenres(videoId)) return;
    const e = stored[videoId];
    const same = e && e.artist === artist && e.title === title;
    out.set(videoId, { videoId, artist, title, ...(same && e.durationSec ? { durationSec: e.durationSec } : {}), genreLookup: same ? parse(e.lookup) : null });
  };
  let songs: { videoId: string; artist: string | null; title: string | null; source: string }[] = [];
  try {
    songs = library.playable();
  } catch {
    songs = [];
  }
  for (const s of songs) if (s.source !== 'starter') add(s.videoId, s.artist, s.title);
  for (const [id, e] of Object.entries(stored)) add(id, e.artist, e.title);
  return [...out.values()];
}

/** Keep a result with the song (noted first when it was only in the library). */
function saveLookup(videoId: string, song: { artist: string; title: string }, lookup: GenreLookup): boolean {
  if (!store.genreSongs()[videoId]) store.noteGenreSong(videoId, song);
  return store.setGenreLookup(videoId, lookup);
}

function load(): Promise<GenreRunner | null> {
  return (runner ??= Promise.all([import('../genre/background'), import('../genre/lookup')]).then(
    ([{ GenreRunner }, { parseGenreLookup }]) => {
      const r = new GenreRunner({
        songs: () => genreSongs(parseGenreLookup),
        save: (videoId, lookup) => {
          const s = genreSongs(parseGenreLookup).find((x) => x.videoId === videoId);
          return s ? saveLookup(videoId, s, lookup) : false;
        },
        // The TV: never while a song's audio is being downloaded or analysed (the loading path comes first).
        busy: () => isTv() && foregroundBusy(),
        pace: () => (playScreenOpen() ? PLAY_PACE_MS : 0),
        fetch: (url, init) => fetch(url, init),
        log: (line) => console.info(line),
        periodic: true,
      });
      return r;
    },
    (err: unknown) => {
      console.warn('[dd:genres] genre lookup failed to load', err);
      runner = null; // try again on the next kick
      return null;
    },
  ));
}

/** The TV's foreground loading (a song's audio download / analysis), set by the platform; false elsewhere. */
let foregroundBusy: () => boolean = () => false;
export function setForegroundBusy(fn: () => boolean): void {
  foregroundBusy = fn;
}

/** Start the background preparation of genres (call once): soon after start-up, and again when the library changes. */
export function installPlayedGenreLookups(): void {
  if (installed) return;
  installed = true;
  const kick = (ms: number) => setTimeout(() => void load().then((r) => r?.kick(0)), ms);
  kick(START_DELAY_MS);
  try {
    library.addEventListener('change', () => kick(CHANGE_DELAY_MS));
  } catch {
    /* no library (tests) */
  }
}

/**
 * A song started playing: other runners (the TV's, for the songs added on it) take it first when it is due, and this
 * one too (its result serves the next play when the loading screen couldn't wait for it).
 */
export function notePlayedForGenres(videoId: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SONG_PLAYED_EVENT, { detail: videoId }));
  const song = library.find(videoId);
  if (!song || song.source === 'starter' || !song.artist || !song.title || hasPublishedGenres(videoId) || deviceAdded().has(videoId)) return;
  store.noteGenreSong(videoId, { artist: song.artist, title: song.title });
  void load().then((r) => r?.prioritize(videoId, 5000));
}

/** 'partial': the wait ended with some of the song's sources answered, their genres stored (the rest finish later). */
export type GenreWait = 'ready' | 'found' | 'partial' | 'none' | 'timeout' | 'offline' | 'skipped';

export interface GenreWaitDeps {
  /** The song's artist and title (null: nothing to look up); its stored iTunes genre, if any. */
  song(videoId: string): { artist: string; title: string; itunesGenre?: string } | null;
  /** Whether the song has genres already (published, or this device's own result). */
  hasGenres(videoId: string): boolean;
  online(): boolean;
  /** Run (or join) the song-level lookup, storing what each source says as it lands; resolves with the whole result. */
  lookup(videoId: string, song: { artist: string; title: string; itunesGenre?: string }): Promise<GenreLookup>;
  timeoutMs?: number;
}

/**
 * The loading screen's wait for a song's genres (pure apart from `deps`): at once when the song has them, or when
 * there is nothing to look up or no network; else the song-level lookup (joined when one is running already), for
 * at most `timeoutMs`. The lookup goes on after a timeout and is stored for the next play.
 */
export async function waitForGenres(videoId: string, deps: GenreWaitDeps): Promise<GenreWait> {
  if (deps.hasGenres(videoId)) return 'ready';
  const song = deps.song(videoId);
  if (!song) return 'skipped';
  if (!deps.online()) return 'offline';
  const job = deps.lookup(videoId, song).then(
    (l) => (l.genres.length ? 'found' : 'none') as GenreWait,
    () => 'none' as GenreWait,
  );
  const timeout = new Promise<GenreWait>((r) => setTimeout(() => r(deps.hasGenres(videoId) ? 'partial' : 'timeout'), deps.timeoutMs ?? GENRE_WAIT_MS));
  return Promise.race([job, timeout]);
}

/** The app's waitForGenres: library songs without published genres, this device's store, the shared lookup. */
export function genresBeforePlay(videoId: string): Promise<GenreWait> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  // Once the wait is over (the song plays), what is left of the lookup keeps to the background pace.
  let paced = false;
  return waitForGenres(videoId, {
    song: (id) => {
      const s = library.find(id);
      if (!s || s.source === 'starter' || !s.artist || !s.title) return null;
      return { artist: s.artist, title: s.title, ...(s.genre ? { itunesGenre: s.genre } : {}) };
    },
    hasGenres: (id) => !!songGenres(id)?.length,
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    lookup: async (id, song) => {
      const [{ sharedLookup }, { lookupGenres, recombine, SONG_SOURCES, parseGenreLookup }, { PoliteHttp }] = await Promise.all([
        import('../genre/background'),
        import('../genre/lookup'),
        import('../genre/http'),
      ]);
      const stored = store.genreSongs()[id];
      const previous = stored && stored.artist === song.artist && stored.title === song.title ? parseGenreLookup(stored.lookup) : null;
      // The loading path: its requests go first (no busy gate); once the song plays they keep to the background pace.
      const http = new PoliteHttp({ fetch: (url, init) => fetch(url, init), gate: () => (paced ? new Promise((r) => setTimeout(r, PLAY_PACE_MS)) : Promise.resolve()) });
      // Each of the song's own sources on its own, its answer stored as it lands: when the wait ends, the genres of the
      // sources that answered by then dance the song (the slow ones finish for its next play). What the album and
      // artist sources said before is kept (the background runner asks those later, the stored answers as its cache).
      const said: GenreLookup['sources'] = { ...(previous?.sources ?? {}) };
      const result = (): GenreLookup => ({ ...recombine(said), sources: { ...said }, complete: false, at: new Date().toISOString() });
      return sharedLookup(id, async () => {
        await Promise.all(
          SONG_SOURCES.map((src) =>
            lookupGenres(song, { http, previous, sources: [src] }).then(
              (l) => {
                Object.assign(said, l.sources);
                saveLookup(id, song, result());
              },
              () => {},
            ),
          ),
        );
        return result();
      });
    },
  }).then((r) => {
    paced = true;
    console.info('[dd:genres] before play', videoId, r, `${Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0)} ms`);
    return r;
  });
}
