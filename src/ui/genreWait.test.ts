/** The loading screen's wait for a song's genres (genreLookups.ts waitForGenres) and the shared in-flight lookup. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupInFlight, sharedLookup } from '../genre/background';
import type { GenreLookup } from '../genre/types';
import { waitForGenres, type GenreWaitDeps } from './genreLookups';

const SONG = { artist: 'Pooh Shiesty', title: 'Back in Blood' };
const found = (genres: string[]): GenreLookup => ({ genres, sources: {}, complete: true, at: '2026-11-14T00:00:00Z' });

function deps(over: Partial<GenreWaitDeps> = {}): GenreWaitDeps & { calls: number } {
  const d = {
    calls: 0,
    song: () => SONG,
    hasGenres: () => false,
    online: () => true,
    lookup: async () => {
      d.calls++;
      return found(['trap', 'drill']);
    },
    timeoutMs: 1000,
    ...over,
  };
  return d;
}

afterEach(() => vi.useRealTimers());

describe('waitForGenres', () => {
  it('needs no wait for a song that has genres (published or looked up before), nor for one with nothing to look up', async () => {
    const d = deps({ hasGenres: () => true });
    expect(await waitForGenres('AAAAAAAAAAA', d)).toBe('ready');
    expect(d.calls).toBe(0);
    expect(await waitForGenres('AAAAAAAAAAA', deps({ song: () => null }))).toBe('skipped');
  });

  it('plays as before when offline (the background lookup finishes it later)', async () => {
    const d = deps({ online: () => false });
    expect(await waitForGenres('AAAAAAAAAAA', d)).toBe('offline');
    expect(d.calls).toBe(0);
  });

  it('waits for a lookup that finishes in time', async () => {
    expect(await waitForGenres('AAAAAAAAAAA', deps())).toBe('found');
    expect(await waitForGenres('AAAAAAAAAAA', deps({ lookup: async () => found([]) }))).toBe('none');
    expect(await waitForGenres('AAAAAAAAAAA', deps({ lookup: () => Promise.reject(new Error('x')) }))).toBe('none');
  });

  it('stops waiting at the timeout and lets the lookup finish (and store) for the next play', async () => {
    vi.useFakeTimers();
    let done = false;
    const d = deps({
      lookup: () =>
        new Promise((r) =>
          setTimeout(() => {
            done = true;
            r(found(['trap']));
          }, 5000),
        ),
    });
    const w = waitForGenres('AAAAAAAAAAA', d);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await w).toBe('timeout');
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(4000);
    expect(done).toBe(true);
  });

  it('at the timeout, dances by the sources that answered by then (stored as they landed)', async () => {
    vi.useFakeTimers();
    let stored = false;
    const d = deps({
      hasGenres: () => stored,
      lookup: () =>
        new Promise((r) => {
          setTimeout(() => (stored = true), 400); // a fast source answers
          setTimeout(() => r(found(['trap', 'drill'])), 30_000); // a slow one keeps going
        }),
    });
    const w = waitForGenres('AAAAAAAAAAA', d);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await w).toBe('partial');
  });

  it('joins a lookup already running for the song (the background runner\'s) instead of asking again', async () => {
    let asked = 0;
    let finish!: (l: GenreLookup) => void;
    const running = sharedLookup('BBBBBBBBBBB', () => {
      asked++;
      return new Promise<GenreLookup>((r) => (finish = r));
    });
    expect(lookupInFlight('BBBBBBBBBBB')).toBe(running);
    const d = deps({ lookup: (id) => sharedLookup(id, async () => (asked++, found(['x']))) });
    const w = waitForGenres('BBBBBBBBBBB', d);
    finish(found(['trap', 'drill']));
    expect(await w).toBe('found');
    expect(asked).toBe(1);
    expect(lookupInFlight('BBBBBBBBBBB')).toBeNull();
  });
});
