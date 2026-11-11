/**
 * The sync prompt for a song without a beat map: "Not now" skips sync for
 * that song in this app session only (nothing saved); "Don't ask again"
 * turns the option Off.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { store } from '../store';
import { BeatSession, resetSyncPromptMemory, syncPromptSkipped } from './session';

/** Just enough of a BeatSession for the prompt decisions. */
function fakeSession(key: string) {
  const noSync: string[] = [];
  return {
    key,
    noSync,
    item: { kind: 'youtube' as const, videoId: key, title: 'T' },
    hub: { map: () => null },
    platform: { liveSync: true },
    devices: { currentTab: () => null, tabSupported: true, micSupported: true },
    none(reason: string) {
      noSync.push(reason);
      return 'ready' as const;
    },
  };
}

const proto = BeatSession.prototype as unknown as {
  declineSync(this: unknown, forever: boolean): void;
  decideLive(this: unknown): Promise<'ready' | 'ask-mic'>;
};

describe('sync prompt answers', () => {
  afterEach(() => {
    resetSyncPromptMemory();
    store.updateSettings({ liveSync: 'ask' });
  });

  it('asks for a song without a beat map while the option is "Ask first"', async () => {
    store.updateSettings({ liveSync: 'ask' });
    expect(await proto.decideLive.call(fakeSession('song-a'))).toBe('ask-mic');
  });

  it('"Not now" skips this song only, without saving the option', async () => {
    store.updateSettings({ liveSync: 'ask' });
    const a = fakeSession('song-a');
    proto.declineSync.call(a, false);
    expect(a.noSync).toEqual(['off']);
    expect(store.settings().liveSync).toBe('ask');
    expect(syncPromptSkipped('song-a')).toBe(true);
    // Same song again in this session: not asked again.
    expect(await proto.decideLive.call(fakeSession('song-a'))).toBe('ready');
    // Another song still asks.
    expect(await proto.decideLive.call(fakeSession('song-b'))).toBe('ask-mic');
    // A later session (memory cleared) asks again for the first song.
    resetSyncPromptMemory();
    expect(await proto.decideLive.call(fakeSession('song-a'))).toBe('ask-mic');
  });

  it('"Don\'t ask again" turns the option Off', async () => {
    store.updateSettings({ liveSync: 'ask' });
    const a = fakeSession('song-a');
    proto.declineSync.call(a, true);
    expect(a.noSync).toEqual(['off']);
    expect(store.settings().liveSync).toBe('off');
    expect(await proto.decideLive.call(fakeSession('song-b'))).toBe('ready');
  });
});
