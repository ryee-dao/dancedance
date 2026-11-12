/**
 * Every published beat map (public/beatmaps, read-only) with the song's
 * style resolved the way the app does (starter style, else artist / genre
 * from public/songs.json), for the whole-catalogue tests. Tests only.
 */

import type { BeatMap } from '../analysis/beatmap';
import starter from '../../data/starter.json';
import songsJson from '../../../public/songs.json';
import { resolveSongStyle, type SongStyle } from './songStyle';

export interface PublishedSong {
  id: string;
  title: string;
  starter: boolean;
  map: BeatMap;
  style: SongStyle;
}

const MAPS = import.meta.glob('../../../public/beatmaps/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

let cache: PublishedSong[] | null = null;

export function publishedSongs(): PublishedSong[] {
  if (cache) return cache;
  const info = new Map<string, { title: string; artist: string; genre?: string; starter: boolean }>();
  for (const s of starter as { videoId: string; title: string; artist: string }[]) info.set(s.videoId, { title: s.title, artist: s.artist, starter: true });
  for (const s of (songsJson as { songs: { videoId: string; title: string; artist: string; genre?: string }[] }).songs) {
    if (!info.has(s.videoId)) info.set(s.videoId, { title: s.title, artist: s.artist, genre: s.genre, starter: false });
  }
  const out: PublishedSong[] = [];
  for (const [path, data] of Object.entries(MAPS).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const map = data as BeatMap;
    if (!map || !Array.isArray(map.beats) || !map.videoId) continue;
    const id = path.slice(path.lastIndexOf('/') + 1, -5);
    const i = info.get(id) ?? { title: id, artist: '', starter: false };
    const secs = map.sections ?? [];
    const energy = secs.length ? secs.reduce((a, s) => a + s.energy, 0) / secs.length : undefined;
    const style = resolveSongStyle({ videoId: id, title: i.title, artist: i.artist, genre: i.genre }, { bpm: map.bpm, energy });
    out.push({ id, title: i.title, starter: i.starter, map, style });
  }
  return (cache = out);
}
