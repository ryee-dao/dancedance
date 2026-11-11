/** Android TV: songs added on the device merged with the published songs.json. */
import { describe, expect, it } from 'vitest';
import type { AddedSong } from '../beat/cloud';
import { mergeLocal } from './addedSongs';

const s = (videoId: string, artist: string, title: string, addedAt: string): AddedSong => ({ videoId, artist, title, addedAt, durationSec: 200 });

describe('mergeLocal', () => {
  const cloud = [s('AAAAAAAAAAA', 'a-ha', 'Take On Me', '2026-11-01T10:00:00Z'), s('BBBBBBBBBBB', 'Dua Lipa', 'Levitating', '2026-11-03T10:00:00Z')];

  it('adds device songs in add order', () => {
    const local = [s('CCCCCCCCCCC', 'ABBA', 'Dancing Queen', '2026-11-02T10:00:00Z')];
    expect(mergeLocal(cloud, local).map((x) => x.videoId)).toEqual(['AAAAAAAAAAA', 'CCCCCCCCCCC', 'BBBBBBBBBBB']);
  });

  it('shows a song the cloud also published once (same video, or same artist + title)', () => {
    const local = [
      s('AAAAAAAAAAA', 'a-ha', 'Take On Me', '2026-11-05T10:00:00Z'),
      s('DDDDDDDDDDD', 'DUA LIPA', 'Levitating', '2026-11-05T10:00:00Z'),
    ];
    expect(mergeLocal(cloud, local)).toEqual(cloud);
  });

  it('is a no-op without device songs', () => {
    expect(mergeLocal(cloud, [])).toBe(cloud);
  });
});
