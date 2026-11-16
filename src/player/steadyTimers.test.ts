import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SteadyTimers, type WorkerLike } from './steadyTimers';

/** A timer worker run on the (fake) page timers, counting what it was asked. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  sets = 0;
  terminated = false;
  private pending = new Map<number, ReturnType<typeof setTimeout>>();
  postMessage(msg: unknown): void {
    const m = msg as { type: string; id: number; ms?: number };
    if (m.type === 'set') {
      this.sets++;
      this.pending.set(
        m.id,
        setTimeout(() => {
          this.pending.delete(m.id);
          this.onmessage?.({ data: m.id });
        }, m.ms),
      );
    } else {
      clearTimeout(this.pending.get(m.id));
      this.pending.delete(m.id);
    }
  }
  terminate(): void {
    this.terminated = true;
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
  }
  open(): number {
    return this.pending.size;
  }
}

describe('SteadyTimers', () => {
  let hidden = false;
  let onVis: (() => void) | null = null;
  let worker: FakeWorker | null = null;
  let made = 0;
  const make = (withWorker = true) =>
    new SteadyTimers({
      hidden: () => hidden,
      onVisibilityChange: (fn) => (onVis = fn),
      now: () => performance.now(),
      makeWorker: () => {
        made++;
        return withWorker ? (worker = new FakeWorker()) : null;
      },
    });
  const setHidden = (h: boolean) => {
    hidden = h;
    onVis?.();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    hidden = false;
    onVis = null;
    worker = null;
    made = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a visible page uses its own timers (no worker is even made)', async () => {
    const st = make();
    const fired: number[] = [];
    st.timeout(() => fired.push(performance.now()), 1000);
    st.interval(() => fired.push(-performance.now()), 400);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fired).toEqual([-400, -800, 1000]);
    expect(made).toBe(0);
  });

  it('hidden: timers run on the worker, on time', async () => {
    hidden = true;
    const st = make();
    const fired: number[] = [];
    [1000, 2000, 3000].forEach((ms) => st.timeout(() => fired.push(performance.now()), ms));
    await vi.advanceTimersByTimeAsync(3000);
    expect(fired).toEqual([1000, 2000, 3000]);
    expect(worker?.sets).toBe(3);
    expect(st.size()).toBe(0);
  });

  it('a pending timer moves across when the visibility changes, keeping its due time', async () => {
    const st = make();
    const fired: number[] = [];
    st.timeout(() => fired.push(performance.now()), 3000);
    const ticks: number[] = [];
    st.interval(() => ticks.push(performance.now()), 500);
    await vi.advanceTimersByTimeAsync(1200);
    setHidden(true);
    expect(worker?.open()).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    setHidden(false);
    expect(worker?.open()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fired).toEqual([3000]);
    expect(ticks).toEqual([500, 1000, 1500, 2000, 2500, 3000]);
  });

  it('an interval that fell behind skips the missed ticks instead of bursting', async () => {
    // `skew` stands in for a tick that came 1.5 s late (a throttled or busy page).
    let skew = 0;
    const st = new SteadyTimers({ hidden: () => false, onVisibilityChange: () => {}, now: () => performance.now() + skew, makeWorker: () => null });
    const ticks: number[] = [];
    st.interval(() => {
      ticks.push(performance.now() + skew);
      if (ticks.length === 2) skew = 1500;
    }, 200);
    await vi.advanceTimersByTimeAsync(1000);
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
    // One late tick, then the old cadence: not seven queued ticks at once.
    expect(gaps).toEqual([200, 1700, 200, 200]);
  });

  it('cancel stops a timer on either side', async () => {
    const st = make();
    let n = 0;
    const stop = st.interval(() => n++, 100);
    await vi.advanceTimersByTimeAsync(250);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(250);
    stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(n).toBe(5); // 100..500 ms, then nothing
    expect(worker?.open()).toBe(0);
    expect(st.size()).toBe(0);
  });

  it('no worker here (or it fails to load): everything stays on the page timers', async () => {
    hidden = true;
    const none = make(false);
    const fired: number[] = [];
    none.timeout(() => fired.push(performance.now()), 500);
    await vi.advanceTimersByTimeAsync(500);
    expect(fired).toEqual([500]);

    const st = make();
    const later: number[] = [];
    st.timeout(() => later.push(performance.now()), 1000);
    expect(worker?.open()).toBe(1);
    worker?.onerror?.(new Error('blocked'));
    expect(worker?.terminated).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(later).toEqual([1500]);
  });
});
