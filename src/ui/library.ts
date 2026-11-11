/**
 * The song library: starter pack + linked playlist, merged with cached
 * titles, block flags and played state. Emits:
 *   'change' - the set of songs or the playlist status changed (re-render)
 *   'song'   - one song's title/flags changed (CustomEvent<string> videoId)
 */

import starterData from '../data/starter.json';
import { reloadCloudIndex } from '../beat/bpmIndex';
import type { AddedSong } from '../beat/cloud';
import { getPlatform } from '../platform/platform';
import { cleanTitle } from '../player/playlistReader';
import { store, type BlockReason, type PlaylistLink } from '../store';
import { addedSongs } from './addedSongs';
import { toast } from './toast';

export type Era = 'current' | 'throwback';

export interface Song {
  videoId: string;
  /** null until known (playlist songs fill in from oEmbed). */
  title: string | null;
  artist: string | null;
  source: 'playlist' | 'starter' | 'added';
  era?: Era;
}

export type PlaylistStatus =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'ready'; refreshing: boolean }
  | { kind: 'error'; message: string; showingCache: boolean };

export interface SongGroup {
  id: string;
  title: string;
  songs: Song[];
}

interface StarterSong {
  videoId: string;
  title: string;
  artist: string;
  era: Era;
}

const STARTER: StarterSong[] = (starterData as StarterSong[]).filter(
  (s) => s && typeof s.videoId === 'string',
);

/** Artists with at least this many starter songs get their own row. */
const ARTIST_ROW_MIN = 5;

const DAY = 24 * 3600 * 1000;

class Library extends EventTarget {
  private playlistIds: string[] = [];
  private status: PlaylistStatus = { kind: 'none' };
  private enrichment = new Map<string, { title: string; artist?: string }>();
  private refreshToken = 0;
  private lookupsQueued = new Set<string>();
  private addedWired = false;

  /** Songs added by search (songs.json) come and go on their own; follow them. */
  private wireAdded(): void {
    if (this.addedWired) return;
    this.addedWired = true;
    addedSongs.addEventListener('change', () => {
      this.emit('change');
      this.queueLookups(); // embeddability of newly published songs
    });
    addedSongs.addEventListener('appeared', (e) => {
      const song = (e as CustomEvent<AddedSong>).detail;
      const dup = this.playlistIds.includes(song.videoId) || STARTER.some((s) => s.videoId === song.videoId);
      toast(dup ? `“${song.title}” is already in your songs.` : `“${song.title}” is ready to dance. It’s in My added songs.`, 6000);
      void reloadCloudIndex(getPlatform().beatmapBase);
    });
    addedSongs.start(getPlatform().beatmapBase);
  }

  playlistStatus(): PlaylistStatus {
    return this.status;
  }

  link(): PlaylistLink | null {
    return store.playlistLink();
  }

  /** Called once on app open: render from cache, then re-read everything. */
  async refresh(): Promise<void> {
    const token = ++this.refreshToken;
    const platform = getPlatform();
    if (this.addedWired) void addedSongs.refresh();
    this.wireAdded();
    void platform.getEnrichment().then((videos) => {
      for (const v of videos) {
        if (v.title) this.enrichment.set(v.videoId, { title: v.title, artist: v.artist });
      }
      if (videos.length) this.emit('change');
    });

    const link = store.playlistLink();
    if (!link) {
      this.playlistIds = [];
      this.status = { kind: 'none' };
      this.emit('change');
      this.queueLookups();
      return;
    }

    const cache = store.playlistCache();
    const hasCache = !!cache && cache.listId === link.listId;
    this.playlistIds = hasCache ? cache.videoIds : [];
    this.status = hasCache ? { kind: 'ready', refreshing: true } : { kind: 'loading' };
    this.emit('change');
    if (hasCache) this.queueLookups();

    try {
      const entries = await platform.getPlaylist(link.listId);
      if (token !== this.refreshToken) return;
      this.applyEntries(link.listId, entries);
    } catch (err) {
      if (token !== this.refreshToken) return;
      const message = err instanceof Error && err.message ? err.message : 'Couldn\'t read the playlist.';
      this.status = { kind: 'error', message, showingCache: hasCache };
      this.emit('change');
    }
    this.queueLookups();
  }

  /** Save a newly linked playlist (already read successfully by the caller). */
  setLink(link: PlaylistLink, entries: { videoId: string; title?: string; artist?: string }[]): void {
    this.refreshToken++;
    store.setPlaylistLink(link);
    this.applyEntries(link.listId, entries);
    this.queueLookups();
  }

  unlink(): void {
    this.refreshToken++;
    store.setPlaylistLink(null);
    store.setPlaylistCache(null);
    this.playlistIds = [];
    this.status = { kind: 'none' };
    this.emit('change');
  }

  private applyEntries(listId: string, entries: { videoId: string; title?: string; artist?: string }[]) {
    const ids = [...new Set(entries.map((e) => e.videoId))];
    for (const e of entries) {
      if (e.title) this.enrichment.set(e.videoId, { title: e.title, artist: e.artist });
    }
    this.playlistIds = ids;
    store.setPlaylistCache({ listId, videoIds: ids, readAt: Date.now() });
    this.status = { kind: 'ready', refreshing: false };
    this.emit('change');
  }

  // --- songs ---------------------------------------------------------------

  playlistSongs(): Song[] {
    return this.playlistIds.map((id) => this.song(id, 'playlist'));
  }

  /** Songs added by search, newest first, minus any already in the playlist or starter pack. */
  addedSongs(): Song[] {
    const taken = new Set([...this.playlistIds, ...STARTER.map((s) => s.videoId)]);
    return addedSongs
      .songs()
      .filter((s) => !taken.has(s.videoId))
      .map((s) => this.song(s.videoId, 'added'));
  }

  /** Starter songs not already in the playlist (playlist wins). */
  starterSongs(): Song[] {
    const inPlaylist = new Set(this.playlistIds);
    return STARTER.filter((s) => !inPlaylist.has(s.videoId)).map((s) => this.song(s.videoId, 'starter'));
  }

  /**
   * Starter pack split into rows so ~100 tiles aren't one wall:
   * eras for most songs, plus a row per artist with 5+ songs.
   */
  starterGroups(): SongGroup[] {
    const songs = this.starterSongs();
    const byArtist = new Map<string, Song[]>();
    for (const s of songs) {
      const key = s.artist ?? '';
      if (!byArtist.has(key)) byArtist.set(key, []);
      byArtist.get(key)!.push(s);
    }
    const artistRows = [...byArtist.entries()]
      .filter(([artist, list]) => artist && list.length >= ARTIST_ROW_MIN)
      .sort((a, b) => b[1].length - a[1].length);
    const inArtistRow = new Set(artistRows.flatMap(([, list]) => list.map((s) => s.videoId)));
    const rest = songs.filter((s) => !inArtistRow.has(s.videoId));
    const groups: SongGroup[] = [
      { id: 'era-current', title: '2010s to now', songs: rest.filter((s) => s.era !== 'throwback') },
      { id: 'era-throwback', title: 'Throwbacks', songs: rest.filter((s) => s.era === 'throwback') },
      ...artistRows.map(([artist, list]) => ({
        id: `artist-${artist.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: artist,
        songs: list,
      })),
    ];
    return groups.filter((g) => g.songs.length > 0);
  }

  /** Look up a song by ID (playlist first). */
  find(videoId: string): Song | null {
    if (this.playlistIds.includes(videoId)) return this.song(videoId, 'playlist');
    if (STARTER.some((s) => s.videoId === videoId)) return this.song(videoId, 'starter');
    if (addedSongs.find(videoId)) return this.song(videoId, 'added');
    return null;
  }

  /** Every song that isn't flagged as unplayable, de-duplicated. */
  playable(): Song[] {
    return [...this.playlistSongs(), ...this.addedSongs(), ...this.starterSongs()].filter((s) => !this.blockReason(s.videoId));
  }

  private song(videoId: string, source: Song['source']): Song {
    const starter = STARTER.find((s) => s.videoId === videoId);
    if (starter) {
      return { videoId, title: starter.title, artist: starter.artist, source, era: starter.era };
    }
    const added = addedSongs.find(videoId);
    if (added) return { videoId, title: added.title, artist: added.artist, source };
    const enriched = this.enrichment.get(videoId);
    if (enriched) return { videoId, title: enriched.title, artist: enriched.artist ?? null, source };
    const cached = store.titles()[videoId];
    if (cached?.status === 'ok' && cached.title) {
      const c = cleanTitle(cached.title, cached.author);
      return { videoId, title: c.title, artist: c.artist ?? null, source };
    }
    return { videoId, title: null, artist: null, source };
  }

  // --- flags -----------------------------------------------------------------

  blockReason(videoId: string): BlockReason | null {
    const b = store.blocked()[videoId];
    if (b) return b.reason;
    // A song that has actually played here is proven embeddable, whatever
    // oEmbed said (player errors after that land in `blocked` above).
    if (store.isPlayed(videoId)) return null;
    const t = store.titles()[videoId];
    if (t && t.status !== 'ok') return t.status;
    return null;
  }

  isNew(videoId: string): boolean {
    return !store.isPlayed(videoId);
  }

  markPlayed(videoId: string): void {
    store.markPlayed(videoId);
    // It played, so whatever flagged it before was wrong or is fixed.
    store.setBlocked(videoId, null);
    this.emit('song', videoId);
  }

  markBlocked(videoId: string, reason: BlockReason): void {
    store.setBlocked(videoId, reason);
    this.emit('song', videoId);
  }

  // --- metadata lookups ---------------------------------------------------------

  /**
   * oEmbed for songs without a fresh cached answer: titles for playlist
   * songs, embeddability for everything. The platform limits concurrency.
   */
  private queueLookups(): void {
    const platform = getPlatform();
    const now = Date.now();
    const titles = store.titles();
    const needs = (id: string, maxAge: number) => {
      const t = titles[id];
      return !t || now - t.t > maxAge;
    };
    const ids = [
      ...this.playlistIds.filter((id) => needs(id, 30 * DAY)),
      ...addedSongs.songs().map((s) => s.videoId).filter((id) => needs(id, 7 * DAY)),
      ...STARTER.map((s) => s.videoId).filter((id) => needs(id, 7 * DAY)),
    ];
    for (const id of ids) {
      if (this.lookupsQueued.has(id)) continue;
      this.lookupsQueued.add(id);
      void platform
        .lookupVideo(id)
        .then((info) => {
          if (!info) return; // unknown: try again next open
          store.setTitle(
            id,
            info.status === 'ok'
              ? { status: 'ok', title: info.title, author: info.author, t: Date.now() }
              : { status: info.status, t: Date.now() },
          );
          this.emit('song', id);
        })
        .finally(() => this.lookupsQueued.delete(id));
    }
  }

  private emit(type: 'change'): void;
  private emit(type: 'song', videoId: string): void;
  private emit(type: 'change' | 'song', videoId?: string): void {
    this.dispatchEvent(type === 'song' ? new CustomEvent('song', { detail: videoId }) : new Event('change'));
  }
}

export const library = new Library();

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}
