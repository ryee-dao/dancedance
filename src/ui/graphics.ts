/**
 * Frame timing + graphics tier for a coach stage (single or two players):
 * wraps the TierGovernor (core/coach/quality.ts) with the frame-interval
 * and draw-time averages the diagnostics show, the 30 fps pacing, and a
 * shared readout (`liveGraphics`) for the diagnostics panel and the
 * on-screen frame-rate line.
 */

import { TierGovernor, parseGraphicsPref, shouldDraw, type GraphicsPref, type GraphicsStats, type Tier, type TierSpec } from '../core/coach/quality';

/** The stage that drew last, for the diagnostics panel (null before the first song). */
export const liveGraphics: { stats: GraphicsStats | null } = { stats: null };

/** `?gfx=auto|smooth|full` on the page URL, else the setting, else 'auto'. */
export function graphicsPrefOf(deps: { getGraphics?: () => GraphicsPref }): GraphicsPref {
  return urlGfx ?? parseGraphicsPref(safe(() => deps.getGraphics?.())) ?? 'auto';
}

const urlGfx: GraphicsPref | null = (() => {
  try {
    return typeof location === 'undefined' ? null : parseGraphicsPref(new URLSearchParams(location.search).get('gfx'));
  } catch {
    return null;
  }
})();

/** `?gfxtier=0|1|2`: pin a tier (measuring, screenshots). */
const urlTier: Tier | null = (() => {
  try {
    const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('gfxtier');
    return v === '0' || v === '1' || v === '2' ? (Number(v) as Tier) : null;
  } catch {
    return null;
  }
})();

/** `?gfxsprites=0|1`: force the sprite drawing off / on in the lighter tiers (comparisons). */
export const urlSprites: boolean | null = (() => {
  try {
    const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('gfxsprites');
    return v === '0' ? false : v === '1' ? true : null;
  } catch {
    return null;
  }
})();

function safe<T>(f: () => T): T | undefined {
  try {
    return f();
  } catch {
    return undefined;
  }
}

export class GraphicsMeter {
  private readonly gov: TierGovernor;
  private lastWall = 0;
  private lastDraw = -Infinity;
  private frameEma = 16.7;
  private drawEma = 1;
  // Drawn frames per second, over ~1 s windows.
  private drawnCount = 0;
  private drawnSince = 0;
  private drawnFps = 0;
  private publishedAt = 0;
  private readonly out = { changed: false, draw: true };

  /** `pinned`: always this tier (the graphics test); else `?gfxtier=`, else the governor decides. */
  constructor(isTV: boolean, players: 1 | 2, pinned: Tier | null = null) {
    this.gov = new TierGovernor(isTV, players, pinned ?? urlTier);
  }

  spec(): TierSpec {
    return this.gov.spec();
  }

  /**
   * Once per animation frame, before drawing: `changed` = the tier changed
   * (resize the canvas, rebuild caches); `draw` = draw this frame (false on
   * the skipped frames of a 30 fps tier).
   */
  tick(wall: number, pref: GraphicsPref, playing: boolean, songKey: string): { changed: boolean; draw: boolean } {
    const d = this.lastWall ? wall - this.lastWall : 0;
    if (d > 0 && d < 500) this.frameEma += (d - this.frameEma) * 0.05;
    this.lastWall = wall;
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    this.out.changed = this.gov.update(pref, wall, d, playing && visible, songKey);
    if (this.out.changed) this.lastDraw = -Infinity;
    this.out.draw = shouldDraw(this.gov.spec().fps, wall, this.lastDraw);
    return this.out;
  }

  /** After drawing a frame: `ms` = time spent. */
  drawn(wall: number, ms: number): void {
    this.lastDraw = wall;
    this.drawEma += (ms - this.drawEma) * 0.05;
    this.drawnCount++;
    if (!this.drawnSince) this.drawnSince = wall;
    if (wall - this.drawnSince >= 1000) {
      this.drawnFps = (this.drawnCount * 1000) / (wall - this.drawnSince);
      this.drawnCount = 0;
      this.drawnSince = wall;
    }
    if (wall - this.publishedAt > 500) {
      this.publishedAt = wall;
      liveGraphics.stats = this.stats(null);
    }
  }

  frameStats(): { frameMs: number; drawMs: number; fps: number } {
    return { frameMs: this.frameEma, drawMs: this.drawEma, fps: this.frameEma > 0 ? 1000 / this.frameEma : 0 };
  }

  private res = '';
  stats(canvas: HTMLCanvasElement | null): GraphicsStats {
    if (canvas) this.res = `${canvas.width}x${canvas.height}`;
    const sp = this.gov.spec();
    return {
      frameMs: Math.round(this.frameEma * 10) / 10,
      drawMs: Math.round(this.drawEma * 100) / 100,
      drawnFps: Math.round(this.drawnFps * 10) / 10,
      tier: sp.tier,
      tierName: sp.name,
      resolution: this.res,
      reason: this.gov.reason,
    };
  }

  /** The canvas size in use (for stats()). */
  noteCanvas(canvas: HTMLCanvasElement): void {
    this.res = `${canvas.width}x${canvas.height}`;
  }
}
