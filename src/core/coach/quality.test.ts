import { beforeEach, describe, expect, it } from 'vitest';
import { DirtyRects } from './dirty';
import { SETTLE_MS, TierGovernor, WINDOW_MS, parseGraphicsPref, resetGraphicsMemory, shouldDraw, tierSpec } from './quality';

/** Feed `ms`-long frames for `dur` ms of wall time; returns the wall time reached. */
function run(g: TierGovernor, pref: 'auto' | 'smooth' | 'full', from: number, dur: number, ms: number, song = 's1', active = true): number {
  let t = from;
  while (t < from + dur) {
    t += ms;
    g.update(pref, t, ms, active, song);
  }
  return t;
}

describe('graphics tiers', () => {
  beforeEach(() => resetGraphicsMemory());

  it('parses the setting', () => {
    expect(parseGraphicsPref('smooth')).toBe('smooth');
    expect(parseGraphicsPref('fast')).toBeNull();
    expect(parseGraphicsPref(undefined)).toBeNull();
  });

  it('keeps the web Full tier at the old resolutions and caps the Smooth tiers', () => {
    expect(tierSpec(0, false)).toMatchObject({ maxW: 1920, maxH: 1080, cached: false, fps: 60 });
    expect(tierSpec(0, true)).toMatchObject({ maxW: 1280, maxH: 720 });
    expect(tierSpec(1, false)).toMatchObject({ maxW: 1280, cached: true, fps: 60 });
    expect(tierSpec(2, true)).toMatchObject({ maxW: 960, maxH: 540, cached: true, fps: 30 });
  });

  it('starts Full on the web and Smooth on TV', () => {
    const web = new TierGovernor(false);
    web.update('auto', 0, 16, true, 'a');
    expect(web.tier).toBe(0);
    const tv = new TierGovernor(true);
    tv.update('auto', 0, 16, true, 'a');
    expect(tv.tier).toBe(1);
  });

  it('steps down after a couple of seconds over budget, never up during the song', () => {
    const g = new TierGovernor(false);
    g.update('auto', 0, 16, true, 's1');
    let t = run(g, 'auto', 0, SETTLE_MS + WINDOW_MS - 200, 40);
    expect(g.tier).toBe(0); // not a full window yet
    t = run(g, 'auto', t, 400, 40);
    expect(g.tier).toBe(1);
    expect(g.spec().sprites).toBe(true);
    // Smooth now, still slow: first the other drawing method gets a window...
    t = run(g, 'auto', t, SETTLE_MS + WINDOW_MS + 100, 40);
    expect(g.tier).toBe(1);
    expect(g.spec().sprites).toBe(false);
    expect(g.reason).toMatch(/trying paths/);
    // ...then (just as slow) the next step down.
    t = run(g, 'auto', t, SETTLE_MS + WINDOW_MS + 100, 40);
    expect(g.tier).toBe(2);
    // Fast frames don't bring it back up.
    run(g, 'auto', t, 10_000, 8);
    expect(g.tier).toBe(2);
  });

  it('stays put while frames are on budget, paused or hidden', () => {
    const g = new TierGovernor(false);
    let t = run(g, 'auto', 0, 10_000, 16.7);
    expect(g.tier).toBe(0);
    t = run(g, 'auto', t, 10_000, 60, 's1', false); // paused / hidden: not measured
    expect(g.tier).toBe(0);
  });

  it('starts the next song where the last one ended up (per player count)', () => {
    const g = new TierGovernor(false, 2);
    run(g, 'auto', 0, 12_000, 45);
    expect(g.tier).toBe(2);
    const next = new TierGovernor(false, 2);
    next.update('auto', 0, 16, true, 's2');
    expect(next.tier).toBe(2);
    expect(next.reason).toMatch(/earlier song/);
    const single = new TierGovernor(false, 1);
    single.update('auto', 0, 16, true, 's2');
    expect(single.tier).toBe(0);
  });

  it('measures sprites against paths once and keeps the faster (remembered for the next song)', () => {
    // A device where the sprite drawing is the slow one (e.g. a CPU-rastered canvas).
    const g = new TierGovernor(true);
    let t = 0;
    const step = (dur: number) => {
      const end = t + dur;
      while (t < end) {
        const ms = g.spec().sprites ? 45 : 18;
        t += ms;
        g.update('auto', t, ms, true, 'a');
      }
    };
    step(SETTLE_MS + WINDOW_MS + 200); // sprites: over budget -> try paths
    expect(g.tier).toBe(1);
    expect(g.spec().sprites).toBe(false);
    step(SETTLE_MS + WINDOW_MS + 200); // paths on budget: keep them, no step down
    expect(g.tier).toBe(1);
    expect(g.spec().sprites).toBe(false);
    expect(g.reason).toMatch(/paths faster here/);
    step(10_000);
    expect(g.tier).toBe(1);
    const next = new TierGovernor(true);
    next.update('auto', 0, 16, true, 'b');
    expect(next.spec().sprites).toBe(false);
    // Full ignores it; a pinned tier (graphics test) always uses sprites.
    const pinned = new TierGovernor(true, 1, 1);
    pinned.update('auto', 0, 16, true, 'c');
    expect(pinned.spec().sprites).toBe(true);
  });

  it('keeps sprites when they are the faster method', () => {
    const g = new TierGovernor(true);
    let t = 0;
    for (let i = 0; i < 1000; i++) {
      const ms = g.spec().sprites ? 30 : 60;
      t += ms;
      g.update('auto', t, ms, true, 'a');
    }
    expect(g.spec().sprites).toBe(true);
    expect(g.tier).toBe(2); // 30 ms is still over budget at 60 fps: stepped down, sprites kept
  });

  it('Full never steps down; Smooth starts at 1', () => {
    const g = new TierGovernor(true);
    run(g, 'full', 0, 10_000, 60);
    expect(g.tier).toBe(0);
    const s = new TierGovernor(false);
    s.update('smooth', 0, 16, true, 'x');
    expect(s.tier).toBe(1);
  });

  it('a 30 fps tier draws every other 60 Hz frame, by wall time', () => {
    let last = -Infinity;
    let drawn = 0;
    for (let i = 0; i < 60; i++) {
      const now = i * (1000 / 60);
      if (shouldDraw(30, now, last)) {
        drawn++;
        last = now;
      }
    }
    expect(drawn).toBe(30);
    expect(shouldDraw(60, 1, 0)).toBe(true);
  });
});

describe('dirty rectangles', () => {
  function fakeCtx() {
    const calls: number[][] = [];
    return { calls, ctx: { drawImage: (_src: unknown, ...a: number[]) => calls.push(a) } as unknown as CanvasRenderingContext2D };
  }
  const src = {} as HTMLCanvasElement;

  it('repaints the union of last and this frame per slot, clamped to the canvas', () => {
    const d = new DirtyRects();
    d.reset(100, 50);
    d.add(0, 10.4, 5, 20, 15);
    const f = fakeCtx();
    expect(d.restore(f.ctx, src)).toBe(10 * 10);
    expect(f.calls[0]).toEqual([10, 5, 10, 10, 10, 5, 10, 10]);
    d.swap();
    // Next frame the figure moved right and partly off the canvas.
    d.add(0, 90, 40, 120, 60);
    const g = fakeCtx();
    d.restore(g.ctx, src);
    expect(g.calls).toHaveLength(1);
    expect(g.calls[0].slice(0, 4)).toEqual([10, 5, 90, 45]);
    d.swap();
    // A slot not drawn this frame still cleans up last frame's box.
    const h = fakeCtx();
    d.restore(h.ctx, src);
    expect(h.calls[0].slice(0, 4)).toEqual([90, 40, 10, 10]);
    d.swap();
    const i = fakeCtx();
    expect(d.restore(i.ctx, src)).toBe(0);
  });

  it('grows a slot added twice in one frame', () => {
    const d = new DirtyRects();
    d.reset(100, 100);
    d.add(3, 0, 0, 10, 10);
    d.add(3, 20, 20, 30, 30);
    const f = fakeCtx();
    d.restore(f.ctx, src);
    expect(f.calls[0].slice(0, 4)).toEqual([0, 0, 30, 30]);
  });
});
