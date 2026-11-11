import { describe, expect, it } from 'vitest';
import { SmoothClock } from './clock';

function setup(opts: { snapThreshold?: number; maxSlew?: number } = {}) {
  let wall = 1000; // ms
  const clock = new SmoothClock({ now: () => wall, ...opts });
  return {
    clock,
    advance(ms: number) {
      wall += ms;
    },
  };
}

describe('SmoothClock', () => {
  it('starts frozen at zero', () => {
    const { clock, advance } = setup();
    expect(clock.time()).toBe(0);
    advance(500);
    expect(clock.time()).toBe(0);
    expect(clock.isPlaying()).toBe(false);
  });

  it('interpolates smoothly between coarse samples during steady playback', () => {
    const { clock, advance } = setup();
    clock.update(0, true);
    // Player posts a new value every 250 ms, sampled every 16 ms.
    let media = 0;
    let prev = clock.time();
    for (let frame = 1; frame <= 120; frame++) {
      advance(16);
      if (frame % 16 === 0) media += 0.256; // exact 250ms-ish posts
      clock.update(media, true);
      const now = clock.time();
      expect(now).toBeGreaterThan(prev); // moves every frame
      prev = now;
    }
    // ~1.92 s of wall time elapsed.
    expect(clock.time()).toBeCloseTo(1.92, 1);
  });

  it('ignores stale repeated samples instead of pulling back', () => {
    const { clock, advance } = setup();
    clock.update(10, true);
    advance(200);
    clock.update(10, true); // same cached value, still 10
    expect(clock.time()).toBeCloseTo(10.2, 5);
  });

  it('freezes while paused and resumes from the reported time', () => {
    const { clock, advance } = setup();
    clock.update(5, true);
    advance(1000);
    expect(clock.time()).toBeCloseTo(6, 5);
    clock.update(6.01, false); // paused
    advance(2000);
    expect(clock.time()).toBeCloseTo(6.01, 5);
    expect(clock.isPlaying()).toBe(false);
    clock.update(6.01, true); // resumed
    advance(500);
    expect(clock.time()).toBeCloseTo(6.51, 5);
  });

  it('snaps on a large jump (seek)', () => {
    const { clock, advance } = setup();
    clock.update(30, true);
    advance(100);
    clock.update(2, true); // seeked back to 2 s
    expect(clock.time()).toBeCloseTo(2, 5);
    advance(500);
    expect(clock.time()).toBeCloseTo(2.5, 5);
  });

  it('snaps when the error is just above the threshold', () => {
    const { clock, advance } = setup({ snapThreshold: 0.15 });
    clock.update(1, true);
    advance(1000); // estimate 2.0
    clock.update(2.2, true); // +0.2 error
    expect(clock.time()).toBeCloseTo(2.2, 5);
  });

  it('corrects small drift gradually without jumping', () => {
    const { clock, advance } = setup({ maxSlew: 0.1 });
    clock.update(0, true);
    advance(1000); // estimate 1.0
    clock.update(1.05, true); // player is 50 ms ahead
    // No jump at the moment of the update.
    expect(clock.time()).toBeCloseTo(1.0, 5);
    advance(100); // 10 ms of correction allowed in 100 ms
    expect(clock.time()).toBeCloseTo(1.11, 5);
    advance(400); // total budget 50 ms reached: fully corrected
    expect(clock.time()).toBeCloseTo(1.55, 5);
    advance(500); // back to real-time rate
    expect(clock.time()).toBeCloseTo(2.05, 5);
  });

  it('corrects small negative drift by running slower, staying monotonic', () => {
    const { clock, advance } = setup({ maxSlew: 0.1 });
    clock.update(0, true);
    advance(1000);
    clock.update(0.96, true); // player is 40 ms behind
    let prev = clock.time();
    for (let i = 0; i < 50; i++) {
      advance(16);
      const t = clock.time();
      expect(t).toBeGreaterThan(prev);
      prev = t;
    }
    // 800 ms later: fully corrected to 0.96 + 0.8
    expect(clock.time()).toBeCloseTo(1.76, 5);
  });

  it('seek() resets immediately', () => {
    const { clock, advance } = setup();
    clock.update(40, true);
    advance(100);
    clock.seek(0);
    expect(clock.time()).toBeCloseTo(0, 5);
    advance(250);
    expect(clock.time()).toBeCloseTo(0.25, 5);
  });

  it('ignores non-finite samples', () => {
    const { clock, advance } = setup();
    clock.update(3, true);
    advance(100);
    clock.update(Number.NaN, true);
    expect(clock.time()).toBeCloseTo(3.1, 5);
  });
});
