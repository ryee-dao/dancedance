/**
 * Every published beat map (public/beatmaps, read-only) with the song's
 * style resolved the way the app does at play time: the song's sources as a
 * device reads them (publishedSources: songs.json, else the cloud index's
 * genre lists, levels and artist genres; the starter pack's curated style)
 * and the map's tempo, section energy and audio traits (songStyleOf, the
 * function the app's routineInfo calls). For the whole-catalogue tests.
 * Tests only.
 */

import type { BeatMap } from '../analysis/beatmap';
import starter from '../../data/starter.json';
import songsJson from '../../../public/songs.json';
import indexJson from '../../../public/beatmaps/index.json';
import { publishedSources, type PublishedData } from './publishedSources';
import { songStyleOf, type SongStyle } from './songStyle';

export interface PublishedSong {
  id: string;
  title: string;
  starter: boolean;
  map: BeatMap;
  style: SongStyle;
}

const MAPS = import.meta.glob('../../../public/beatmaps/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

let cache: PublishedSong[] | null = null;

/** The parsed files the app reads its song sources from. */
export const PUBLISHED_DATA: PublishedData = { starter: starter as PublishedData['starter'], songs: songsJson as PublishedData['songs'], index: indexJson as PublishedData['index'] };

export function publishedSongs(): PublishedSong[] {
  if (cache) return cache;
  const out: PublishedSong[] = [];
  for (const [path, data] of Object.entries(MAPS).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const map = data as BeatMap;
    if (!map || !Array.isArray(map.beats) || !map.videoId) continue;
    const id = path.slice(path.lastIndexOf('/') + 1, -5);
    const src = publishedSources(id, PUBLISHED_DATA);
    const style = songStyleOf(src, map);
    out.push({ id, title: src.title ?? id, starter: src.starter, map, style });
  }
  return (cache = out);
}
