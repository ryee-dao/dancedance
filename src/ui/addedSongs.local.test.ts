/** Android TV: songs added on the device merged with the published songs.json. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddedSong } from '../beat/cloud';
import { setPlatform, type Platform } from '../platform/platform';
import { store } from '../store';
import { AddedSongs, mergeLocal, removalPlan } from './addedSongs';

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

describe('removalPlan', () => {
  const cloud = [s('AAAAAAAAAAA', 'a-ha', 'Take On Me', '2026-11-01T10:00:00Z')];

  it('a device-only song is removed from the device, nothing is hidden', () => {
    const local = [s('CCCCCCCCCCC', 'ABBA', 'Dancing Queen', '2026-11-02T10:00:00Z')];
    expect(removalPlan('CCCCCCCCCCC', cloud, local)).toEqual({ localIds: ['CCCCCCCCCCC'], hideCloud: false });
  });

  it('a cloud-only song is only hidden', () => {
    expect(removalPlan('AAAAAAAAAAA', cloud, [])).toEqual({ localIds: [], hideCloud: true });
  });

  it('a song on both removes every device copy (same video or same artist + title) and hides the cloud one', () => {
    const local = [s('AAAAAAAAAAA', 'a-ha', 'Take On Me', '2026-11-05T10:00:00Z'), s('DDDDDDDDDDD', 'A-HA', 'take on me', '2026-11-05T10:00:00Z')];
    expect(removalPlan('AAAAAAAAAAA', cloud, local)).toEqual({ localIds: ['AAAAAAAAAAA', 'DDDDDDDDDDD'], hideCloud: true });
  });

  it('an unknown song touches nothing', () => {
    expect(removalPlan('ZZZZZZZZZZZ', cloud, [])).toEqual({ localIds: [], hideCloud: false });
  });
});

describe('AddedSongs.remove on Android TV', () => {
  const cloudSongs = [s('AAAAAAAAAAA', 'a-ha', 'Take On Me', '2026-11-01T10:00:00Z'), s('BBBBBBBBBBB', 'Dua Lipa', 'Levitating', '2026-11-03T10:00:00Z')];

  /** A fake TV platform that behaves like androidtv.ts: removal updates the list and notifies. */
  function tv(initial: AddedSong[], refuse = false) {
    let list = initial.slice();
    const listeners = new Set<() => void>();
    const removeLocalAddedSong = vi.fn((videoId: string) => {
      if (refuse || !list.some((x) => x.videoId === videoId)) return false;
      list = list.filter((x) => x.videoId !== videoId);
      for (const fn of listeners) fn();
      return true;
    });
    setPlatform({
      localAddedSongs: () => list,
      onLocalAddedSongsChange: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      removeLocalAddedSong,
    } as unknown as Platform);
    return { removeLocalAddedSong, list: () => list };
  }

  async function model(): Promise<AddedSongs> {
    const m = new AddedSongs(async () => ({ ok: true, text: async () => JSON.stringify({ songs: cloudSongs }) }));
    m.start('https://jo.github.io/dd/');
    await m.refresh();
    return m;
  }

  beforeEach(() => store.setHiddenAdded(new Set()));

  it('removes a device song for real (not hidden, nothing to show again)', async () => {
    const p = tv([s('CCCCCCCCCCC', 'ABBA', 'Dancing Queen', '2026-11-02T10:00:00Z')]);
    const m = await model();
    expect(m.songs().map((x) => x.videoId)).toEqual(['BBBBBBBBBBB', 'CCCCCCCCCCC', 'AAAAAAAAAAA']);
    expect(await m.remove('CCCCCCCCCCC')).toEqual({ removedLocal: true, hidden: false });
    expect(p.removeLocalAddedSong).toHaveBeenCalledWith('CCCCCCCCCCC');
    expect(p.list()).toEqual([]);
    expect(m.songs().map((x) => x.videoId)).toEqual(['BBBBBBBBBBB', 'AAAAAAAAAAA']);
    expect(m.hiddenCount()).toBe(0);
  });

  it('hides a cloud song without touching the device, and "show removed" brings it back', async () => {
    const p = tv([]);
    const m = await model();
    expect(await m.remove('AAAAAAAAAAA')).toEqual({ removedLocal: false, hidden: true });
    expect(p.removeLocalAddedSong).not.toHaveBeenCalled();
    expect(m.songs().map((x) => x.videoId)).toEqual(['BBBBBBBBBBB']);
    expect(m.hiddenCount()).toBe(1);
    m.unhideAll();
    expect(m.songs().map((x) => x.videoId)).toEqual(['BBBBBBBBBBB', 'AAAAAAAAAAA']);
  });

  it('a song on both: removes the device copy and hides the cloud one', async () => {
    const p = tv([s('DDDDDDDDDDD', 'DUA LIPA', 'levitating', '2026-11-04T10:00:00Z')]);
    const m = await model();
    expect(m.songs().map((x) => x.videoId)).toEqual(['BBBBBBBBBBB', 'AAAAAAAAAAA']); // shown once, as the cloud entry
    expect(await m.remove('BBBBBBBBBBB')).toEqual({ removedLocal: true, hidden: true });
    expect(p.removeLocalAddedSong).toHaveBeenCalledWith('DDDDDDDDDDD');
    expect(p.list()).toEqual([]);
    expect(m.songs().map((x) => x.videoId)).toEqual(['AAAAAAAAAAA']);
    expect(m.hiddenCount()).toBe(1);
    m.unhideAll(); // the cloud copy comes back; the device copy stays gone
    expect(m.songs().map((x) => x.videoId)).toEqual(['BBBBBBBBBBB', 'AAAAAAAAAAA']);
    expect(p.list()).toEqual([]);
  });

  it('falls back to hiding when the device refuses', async () => {
    tv([s('CCCCCCCCCCC', 'ABBA', 'Dancing Queen', '2026-11-02T10:00:00Z')], true);
    const m = await model();
    expect(await m.remove('CCCCCCCCCCC')).toEqual({ removedLocal: false, hidden: true });
    expect(m.songs().map((x) => x.videoId)).toEqual(['BBBBBBBBBBB', 'AAAAAAAAAAA']);
    expect(m.hiddenCount()).toBe(1);
  });
});
