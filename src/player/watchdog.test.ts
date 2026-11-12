import { describe, expect, it } from 'vitest';
import { PlaybackWatchdog, type WatchdogAction } from './watchdog';

/** Drive the watchdog every 250 ms with a scripted element time. */
function drive(w: PlaybackWatchdog, fromMs: number, toMs: number, timeAt: (ms: number) => number, opts: { wantPlay?: boolean; duration?: number } = {}) {
  const out: { at: number; action: WatchdogAction }[] = [];
  for (let now = fromMs; now <= toMs; now += 250) {
    const a = w.check({ now, wantPlay: opts.wantPlay ?? true, time: timeAt(now), ended: false, duration: opts.duration ?? 300 });
    if (a !== 'none') out.push({ at: now, action: a });
  }
  return out;
}

describe('PlaybackWatchdog', () => {
  it('stays quiet while the song plays', () => {
    const w = new PlaybackWatchdog();
    expect(drive(w, 0, 60_000, (ms) => ms / 1000)).toEqual([]);
  });

  it('reloads when time stands still while playing, and reports when it moves again', () => {
    const w = new PlaybackWatchdog({ stuckMs: 4000 });
    // Plays to 175 s, then currentTime freezes (the element starved) for 8 s, then moves on.
    const t = (ms: number) => (ms < 10_000 ? 165 + ms / 1000 : ms < 18_000 ? 175 : 175 + (ms - 18_000) / 1000);
    const acts = drive(w, 0, 30_000, t);
    expect(acts[0]).toEqual({ at: 14_000, action: 'recover' });
    expect(acts.map((a) => a.action)).toEqual(['recover', 'resumed']);
    expect(w.isStalled).toBe(false);
  });

  it('retries a few times, then gives up (the player reports an error and drops the file)', () => {
    const w = new PlaybackWatchdog({ stuckMs: 4000, retryMs: 6000, maxRecoveries: 3 });
    const acts = drive(w, 0, 60_000, (ms) => (ms < 5000 ? ms / 1000 : 5));
    expect(acts.map((a) => a.action)).toEqual(['recover', 'recover', 'recover', 'give-up']);
    // Silent afterwards.
    expect(drive(w, 60_000, 90_000, () => 5)).toEqual([]);
  });

  it('a recovery that played on cleanly starts the count over', () => {
    const w = new PlaybackWatchdog({ stuckMs: 4000, maxRecoveries: 1, cleanSec: 15 });
    // Stalls at 30 s, recovers, plays 40 s, stalls again: still recovers (count reset).
    let t = 0;
    const acts: WatchdogAction[] = [];
    const step = (now: number, moving: boolean) => {
      if (moving) t += 0.25;
      const a = w.check({ now, wantPlay: true, time: t, ended: false, duration: 300 });
      if (a !== 'none') acts.push(a);
    };
    let now = 0;
    for (; now < 30_000; now += 250) step(now, true);
    for (let k = 0; k < 24; k++, now += 250) step(now, false); // 6 s stuck
    for (let k = 0; k < 160; k++, now += 250) step(now, true); // 40 s clean
    for (let k = 0; k < 24; k++, now += 250) step(now, false);
    expect(acts).toEqual(['recover', 'resumed', 'recover']);
  });

  it('does not count pauses or a not-yet-started song as stuck', () => {
    const w = new PlaybackWatchdog({ stuckMs: 4000 });
    expect(drive(w, 0, 20_000, () => 42, { wantPlay: false })).toEqual([]);
    // Resuming starts the stuck timer afresh.
    expect(drive(w, 20_250, 23_000, () => 42)).toEqual([]);
  });

  it('stuck right at the end finishes the song instead of reloading', () => {
    const w = new PlaybackWatchdog({ stuckMs: 4000 });
    const acts = drive(w, 0, 10_000, () => 299.4, { duration: 300 });
    expect(acts).toEqual([{ at: 4000, action: 'ended' }]);
  });

  it('element errors reload at once, with the same limit', () => {
    const w = new PlaybackWatchdog({ maxRecoveries: 2 });
    expect(w.noteError(1000, 100)).toBe('recover');
    expect(w.noteError(2000, 100)).toBe('recover');
    expect(w.noteError(3000, 100)).toBe('give-up');
    w.reset();
    expect(w.noteError(4000, 0)).toBe('recover');
  });
});
