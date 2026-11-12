/**
 * Cached layers + dirty rectangles for the Smooth graphics tiers
 * (quality.ts). The still parts of the stage (background, glows, strip
 * panels and their text) live in an offscreen "static" canvas; each frame
 * only the rectangles where something moves (this frame or the last one)
 * are copied back from it, then the moving parts are drawn on top.
 *
 * Rectangles are kept per slot (figure 1, figure 2, floor rings, progress
 * bar, ...): a slot's rectangle from the previous frame is merged with this
 * frame's, so a figure costs one copy, not two.
 */

/** A canvas of the same kind as `like` (detached, never shown). */
export function makeLayer(like: HTMLCanvasElement, w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const doc = like.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  const canvas = doc.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  return ctx ? { canvas, ctx } : null;
}

export const MAX_SLOTS = 16;

export class DirtyRects {
  private prev = new Float64Array(MAX_SLOTS * 4);
  private cur = new Float64Array(MAX_SLOTS * 4);
  private prevOn = new Uint8Array(MAX_SLOTS);
  private curOn = new Uint8Array(MAX_SLOTS);
  private w = 1;
  private h = 1;

  /** Canvas size (clamps); also forgets every rectangle. */
  reset(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.prevOn.fill(0);
    this.curOn.fill(0);
  }

  /** Mark x0..x1, y0..y1 (device px) in `slot` as changing this frame (grows it if set already). */
  add(slot: number, x0: number, y0: number, x1: number, y1: number): void {
    if (!(x1 > x0 && y1 > y0)) return;
    const o = slot * 4;
    const c = this.cur;
    if (this.curOn[slot]) {
      c[o] = Math.min(c[o], x0);
      c[o + 1] = Math.min(c[o + 1], y0);
      c[o + 2] = Math.max(c[o + 2], x1);
      c[o + 3] = Math.max(c[o + 3], y1);
    } else {
      this.curOn[slot] = 1;
      c[o] = x0;
      c[o + 1] = y0;
      c[o + 2] = x1;
      c[o + 3] = y1;
    }
  }

  /** Copy every slot's previous + current rectangle from `src` (same size as the target). */
  restore(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement): number {
    let px = 0;
    for (let s = 0; s < MAX_SLOTS; s++) {
      const a = this.prevOn[s], b = this.curOn[s];
      if (!a && !b) continue;
      const o = s * 4;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      if (a) {
        x0 = this.prev[o];
        y0 = this.prev[o + 1];
        x1 = this.prev[o + 2];
        y1 = this.prev[o + 3];
      }
      if (b) {
        x0 = Math.min(x0, this.cur[o]);
        y0 = Math.min(y0, this.cur[o + 1]);
        x1 = Math.max(x1, this.cur[o + 2]);
        y1 = Math.max(y1, this.cur[o + 3]);
      }
      const ix0 = Math.max(0, Math.floor(x0)), iy0 = Math.max(0, Math.floor(y0));
      const ix1 = Math.min(this.w, Math.ceil(x1)), iy1 = Math.min(this.h, Math.ceil(y1));
      const rw = ix1 - ix0, rh = iy1 - iy0;
      if (rw <= 0 || rh <= 0) continue;
      ctx.drawImage(src, ix0, iy0, rw, rh, ix0, iy0, rw, rh);
      px += rw * rh;
    }
    return px;
  }

  /** End of frame: this frame's rectangles become the ones to clean up next frame. */
  swap(): void {
    const t = this.prev;
    this.prev = this.cur;
    this.cur = t;
    const u = this.prevOn;
    this.prevOn = this.curOn;
    this.curOn = u;
    this.curOn.fill(0);
  }
}
