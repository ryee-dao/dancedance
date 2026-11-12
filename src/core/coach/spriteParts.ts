/**
 * Shared pieces for the sprite drawing (sprites.ts) used by both painters:
 * blit transforms for limb segments, filled ellipses and round-capped lines
 * as cached sprites, and the outline-by-offset polygon fill that replaces the
 * "fill, then stroke to grow" outlines of the torso shapes (no strokes).
 *
 * Allocation-free on the per-frame path (module scratch buffers).
 */

import { qScale, scaleOf, spriteKey, type PieceArtist, type SpriteCache, type SpriteEntry } from './sprites';

/** Piece kinds (the first key field). Painter-specific kinds start at 16. */
export const K_ELLIPSE = 1;
export const K_LINE = 2;
export const K_PANEL = 3;
export const K_TEXT = 4;
export const K_RING = 5;
export const K_MISC = 6;

/** Small integer ids for colours (keys). */
const colorIds = new Map<string, number>();
export function colorId(c: string): number {
  let id = colorIds.get(c);
  if (id === undefined) {
    id = colorIds.size + 1;
    colorIds.set(c, id);
  }
  return id;
}

/** Scratch transform (a, b, c, d, e, f). */
export const M = new Float64Array(6);

/**
 * Blit transform for a limb-segment sprite drawn along +x from (0, 0) to
 * (lq, 0) in sprite px, onto the screen segment A -> B, `k` screen px per
 * sprite px. Stretched along the segment to hit A and B exactly when that
 * distorts its round ends by under ~1/3 px; otherwise centred on the
 * segment (the length error splits between both ends).
 */
export function boneMatrix(out: Float64Array, ax: number, ay: number, bx: number, by: number, k: number, lq: number, rMax: number): void {
  const dx = bx - ax, dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  let ux = 1, uy = 0;
  if (d > 1e-6) {
    ux = dx / d;
    uy = dy / d;
  }
  let sx = k, tx: number, ty: number;
  const want = lq * k;
  if (lq > 0.5 && Math.abs(d / want - 1) * rMax * k <= 0.35) {
    sx = d / lq;
    tx = ax;
    ty = ay;
  } else {
    const hh = want * 0.5;
    tx = (ax + bx) * 0.5 - ux * hh;
    ty = (ay + by) * 0.5 - uy * hh;
  }
  out[0] = ux * sx;
  out[1] = uy * sx;
  out[2] = -uy * k;
  out[3] = ux * k;
  out[4] = tx;
  out[5] = ty;
}

/** out = F ∘ (translate(px, py) · rotate(rot) · scale(sx, sy)), F = (fa..ff). */
export function frameMatrix(out: Float64Array, fa: number, fb: number, fc: number, fd: number, fe: number, ff: number, px: number, py: number, rot: number, sx: number, sy: number): void {
  const c = Math.cos(rot), s = Math.sin(rot);
  // L = [c*sx, s*sx, -s*sy, c*sy, px, py]
  const la = c * sx, lb = s * sx, lc = -s * sy, ld = c * sy;
  out[0] = fa * la + fc * lb;
  out[1] = fb * la + fd * lb;
  out[2] = fa * lc + fc * ld;
  out[3] = fb * lc + fd * ld;
  out[4] = fa * px + fc * py + fe;
  out[5] = fb * px + fd * py + ff;
}

// ---------------------------------------------------------------------------
// Limb segments (and other round-ended bars): one sprite serves a range of
// lengths (20 % steps). A sprite long enough to have a straight middle is
// drawn as three slices: both round ends unscaled, the middle stretched to
// the exact length (a tapered middle stays exact when stretched along its
// axis). A shorter one (a foreshortened limb) is drawn as two overlapping
// halves, one at each end, from a sprite at least as long as the segment.

const LEN_RATIO = Math.log(1.2);

/**
 * Bucket for a segment `len` sprite px long whose round ends reach `cut` px
 * from its end points. `uniform`: a constant-width bar, always drawn as two
 * overlapping halves (exact for any length up to the sprite's).
 */
export function segBucket(len: number, cut: number, uniform = false): number {
  const l = Math.max(4, len);
  const up = Math.ceil(Math.log(l) / LEN_RATIO - 1e-9);
  if (uniform || Math.exp(up * LEN_RATIO) < 2 * cut + 4) return up;
  const near = Math.round(Math.log(l) / LEN_RATIO);
  return Math.exp(near * LEN_RATIO) >= 2 * cut + 4 ? near : up;
}

/** The sprite length of a bucket. */
export function segLength(b: number): number {
  return Math.exp(b * LEN_RATIO);
}

/**
 * Draw a segment sprite (along +x from (0, 0) to (lq, 0), round ends
 * reaching `cut` px past its end points) from A to B, k screen px per
 * sprite px.
 */
export function blitSegment(ctx: CanvasRenderingContext2D, e: SpriteEntry, ax: number, ay: number, bx: number, by: number, k: number, lq: number, cut: number, uniform = false): void {
  const dx = bx - ax, dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
  ctx.setTransform(ux * k, uy * k, -uy * k, ux * k, ax, ay);
  const delta = d / k - lq;
  const img = e.page.canvas;
  if (!uniform && lq >= 2 * cut + 4) {
    const c1 = Math.round(cut - e.lx);
    const c2 = Math.round(lq - cut - e.lx);
    ctx.drawImage(img, e.sx, e.sy, c1, e.sh, e.lx, e.ly, c1, e.sh);
    ctx.drawImage(img, e.sx + c1 - 1, e.sy, c2 - c1 + 2, e.sh, e.lx + c1 - 1, e.ly, c2 - c1 + 2 + delta, e.sh);
    ctx.drawImage(img, e.sx + c2, e.sy, e.sw - c2, e.sh, e.lx + c2 + delta, e.ly, e.sw - c2, e.sh);
    return;
  }
  const h = Math.round(lq * 0.5 - e.lx);
  ctx.drawImage(img, e.sx, e.sy, h + 1, e.sh, e.lx, e.ly, h + 1, e.sh);
  ctx.drawImage(img, e.sx + h - 1, e.sy, e.sw - h + 1, e.sh, e.lx + h - 1 + delta, e.ly, e.sw - h + 1, e.sh);
}

/** Scale bucket for a whole figure (6 % steps): its parts' sprites are drawn at this px per unit. */
export function qFigure(pxPerUnit: number): number {
  return Math.round(qScale(pxPerUnit) / 2) * 2;
}

/** Draw `e` (or, when null, the artist's piece directly) with transform M. */
export function blitOrDraw(cache: SpriteCache, ctx: CanvasRenderingContext2D, e: SpriteEntry | null, artist: PieceArtist, id: number): void {
  if (e) {
    cache.blit(ctx, e, M[0], M[1], M[2], M[3], M[4], M[5]);
    return;
  }
  cache.noteDirect();
  ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
  artist.drawPiece(ctx, id);
}

// ---------------------------------------------------------------------------
// Filled ellipses (ears, eyes, shadow, hood, ...): one sprite per colour and
// quantised radii, drawn rotated and with the small residual scale.

/**
 * Radius bucket: 1/2 px below 4 px, then 6 % steps (a filled ellipse stays
 * an exact ellipse under the residual scale; only its edge softness changes).
 */
function rBucket(r: number): number {
  if (r < 4) return Math.round(r * 2);
  return 8 + Math.round(Math.log(r / 4) / Math.log(1.06));
}
function rOf(b: number): number {
  return b <= 8 ? Math.max(0.5, b / 2) : 4 * Math.pow(1.06, b - 8);
}

class EllipseArtist implements PieceArtist {
  color = '#000';
  rx = 1;
  ry = 1;
  drawPiece(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.ellipse(0, 0, this.rx, this.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}
const ellipseArtist = new EllipseArtist();

/**
 * A filled ellipse at (cx, cy) with radii rx, ry rotated by `rot`, in the
 * frame F (canvas px; pass 1, 0, 0, 1, 0, 0 for none). Same pixels as
 * ctx.ellipse + fill up to edge anti-aliasing.
 */
export function spriteEllipse(
  cache: SpriteCache, ctx: CanvasRenderingContext2D, color: string,
  fa: number, fb: number, fc: number, fd: number, fe: number, ff: number,
  cx: number, cy: number, rx: number, ry: number, rot: number,
): void {
  if (!(rx > 0.05 && ry > 0.05)) return;
  const bx = rBucket(rx), by = rBucket(ry);
  const qx = rOf(bx), qy = rOf(by);
  const cid = colorId(color);
  const key = spriteKey(K_ELLIPSE, cid >> 6, 0, cid & 63, by >> 6, by & 63, bx);
  let e = cache.get(key);
  ellipseArtist.color = color;
  ellipseArtist.rx = qx;
  ellipseArtist.ry = qy;
  if (!e) e = cache.miss(key, -qx - 1, -qy - 1, qx + 1, qy + 1, ellipseArtist, 0);
  frameMatrix(M, fa, fb, fc, fd, fe, ff, cx, cy, rot, rx / qx, ry / qy);
  blitOrDraw(cache, ctx, e, ellipseArtist, 0);
}

// ---------------------------------------------------------------------------
// Stroked ellipse rings (floor rings, duo floor markers): one sprite per 12 %
// size step and aspect; the blit scales the rest (line width within ±6 %).

class RingArtist implements PieceArtist {
  color = '#000';
  rx = 1;
  ry = 1;
  lw = 1;
  drawPiece(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.ellipse(0, 0, this.rx, this.ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lw;
    ctx.stroke();
  }
}
const ringArtist = new RingArtist();

export function spriteRing(cache: SpriteCache, ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, rx: number, ry: number, lw: number): void {
  if (!(rx > 1 && ry > 0.5)) return;
  const b = Math.round(Math.log(rx) / Math.log(1.12));
  const qx = Math.pow(1.12, b);
  const ab = Math.max(1, Math.min(63, Math.round((ry / rx) * 50)));
  const qy = qx * (ab / 50);
  const lb = Math.max(1, Math.min(63, Math.round(lw * 4)));
  const cid = colorId(color);
  // Wider than about an atlas page: made at half (or quarter) size and blitted larger.
  let d = 1;
  while ((qx / d) * 2 + lb / 4 > 900 && d < 4) d *= 2;
  const key = spriteKey(K_RING, cid >> 6, d, cid & 63, lb, ab, b + 64);
  ringArtist.color = color;
  ringArtist.rx = qx / d;
  ringArtist.ry = qy / d;
  ringArtist.lw = lb / 4 / d;
  let e = cache.get(key);
  const m = lb / 8 / d + 1;
  if (!e) e = cache.miss(key, -qx / d - m, -qy / d - m, qx / d + m, qy / d + m, ringArtist, 0);
  frameMatrix(M, 1, 0, 0, 1, 0, 0, cx, cy, 0, (rx / qx) * d, (ry / qy) * d);
  blitOrDraw(cache, ctx, e, ringArtist, 0);
}

// ---------------------------------------------------------------------------
// Rounded panels (strip cards): drawn once per size, with the canvas
// position's fraction baked in so the blit lands on whole pixels.

class PanelArtist implements PieceArtist {
  w = 1;
  h = 1;
  r = 1;
  fx = 0;
  fy = 0;
  fill: string | null = null;
  line: string | null = null;
  lw = 1;
  drawPiece(ctx: CanvasRenderingContext2D): void {
    const x = this.fx, y = this.fy, w = this.w, h = this.h, r = this.r;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (this.fill) {
      ctx.fillStyle = this.fill;
      ctx.fill();
    }
    if (this.line) {
      ctx.strokeStyle = this.line;
      ctx.lineWidth = this.lw;
      ctx.stroke();
    }
  }
}
const panelArtist = new PanelArtist();

/** A rounded rectangle (x, y, w, h, radius r): fill and / or stroke, as one cached sprite. */
export function spritePanel(cache: SpriteCache, ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | null, line: string | null, lw: number): void {
  const ix = Math.floor(x), iy = Math.floor(y);
  const P = panelArtist;
  P.fx = Math.round((x - ix) * 16) / 16;
  P.fy = Math.round((y - iy) * 16) / 16;
  P.w = Math.round(w * 16) / 16;
  P.h = Math.round(h * 16) / 16;
  P.r = Math.round(r * 16) / 16;
  P.fill = fill;
  P.line = line;
  P.lw = lw;
  const key = `panel|${P.fx}|${P.fy}|${P.w}|${P.h}|${P.r}|${fill}|${line}|${lw}`;
  let e = cache.get(key);
  const m = lw + 2;
  if (!e) e = cache.miss(key, -m, -m, P.w + 1 + m, P.h + 1 + m, P, 0);
  M[0] = 1;
  M[1] = 0;
  M[2] = 0;
  M[3] = 1;
  M[4] = ix;
  M[5] = iy;
  blitOrDraw(cache, ctx, e, P, 0);
}

// ---------------------------------------------------------------------------
// Badges: any small still drawing (text labels, the P1 / P2 tags) made once
// and blitted wherever it goes. The caller supplies a stable string key and
// an artist that draws it around (0, 0) inside the given box.

/** Blit badge `key` (drawn by artist.drawPiece(ctx, id) within x0..x1, y0..y1) at (x, y), whole-pixel aligned. */
export function spriteBadge(cache: SpriteCache, ctx: CanvasRenderingContext2D, key: string, artist: PieceArtist, id: number, x0: number, y0: number, x1: number, y1: number, x: number, y: number, snap = true): void {
  let e = cache.get(key);
  if (!e) e = cache.miss(key, x0, y0, x1, y1, artist, id);
  M[0] = 1;
  M[1] = 0;
  M[2] = 0;
  M[3] = 1;
  M[4] = snap ? Math.round(x) : x;
  M[5] = snap ? Math.round(y) : y;
  blitOrDraw(cache, ctx, e, artist, id);
}

// ---------------------------------------------------------------------------
// Round-capped lines (thin detail strokes that move: drawstrings, ...).

/** Length bucket step for limb / line sprites (sprite px). */
export const LEN_STEP = 1.25;

class LineArtist implements PieceArtist {
  color = '#000';
  width = 1;
  len = 1;
  cap: CanvasLineCap = 'round';
  drawPiece(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.len, 0);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = this.cap;
    ctx.stroke();
  }
}
const lineArtist = new LineArtist();

/**
 * A line from (x0, y0) to (x1, y1) of `width` px (canvas px, identity frame),
 * round caps unless `butt`. `unit` = px per figure unit at this line (scale
 * bucket of the sprite).
 */
export function spriteLine(cache: SpriteCache, ctx: CanvasRenderingContext2D, color: string, x0: number, y0: number, x1: number, y1: number, width: number, unit: number, butt = false): void {
  const qs = qFigure(unit);
  const R = scaleOf(qs);
  const k = unit / R;
  const wb = Math.max(1, Math.round((width / k) * 8));
  const len = Math.hypot(x1 - x0, y1 - y0) / k;
  const cut = wb / 16 + 1;
  const b = segBucket(len, cut, true);
  const lq = segLength(b);
  const cid = colorId(color);
  const key = spriteKey(K_LINE, cid >> 6, qs, cid & 63, (wb >> 5) & 63, ((wb & 31) << 1) | (butt ? 1 : 0), b);
  let e = cache.get(key);
  lineArtist.color = color;
  lineArtist.width = wb / 8;
  lineArtist.len = lq;
  lineArtist.cap = butt ? 'butt' : 'round';
  if (!e) e = cache.miss(key, -cut - 1, -cut - 1, lq + cut + 1, cut + 1, lineArtist, 0, lq);
  if (e) {
    blitSegment(ctx, e, x0, y0, x1, y1, k, lq, cut, true);
    return;
  }
  lineArtist.len = len;
  boneMatrix(M, x0, y0, x1, y1, k, len, cut);
  blitOrDraw(cache, ctx, null, lineArtist, 0);
}

// ---------------------------------------------------------------------------
// Torso shapes: smooth closed curves, filled per frame. Their outline used to
// be "fill + stroke(2g)"; here it is one fill of the shape grown by g.

const FLAT = new Float64Array(4096);
const OFF = new Float64Array(8192);
let flatN = 0;

/**
 * Flatten the closed quadratic B-spline that HumanPainter.smooth() draws
 * through n control points (curve through the edge midpoints) into FLAT,
 * `steps` segments per piece. Returns the point count.
 */
export function flattenSmooth(pts: Float64Array, n: number, steps = 5): number {
  let o = 0;
  const lx = pts[(n - 1) * 2], ly = pts[(n - 1) * 2 + 1];
  let sx = (lx + pts[0]) * 0.5, sy = (ly + pts[1]) * 0.5;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], y = pts[i * 2 + 1];
    const j = i + 1 < n ? i + 1 : 0;
    const ex = (x + pts[j * 2]) * 0.5, ey = (y + pts[j * 2 + 1]) * 0.5;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, u = 1 - t;
      FLAT[o++] = u * u * sx + 2 * u * t * x + t * t * ex;
      FLAT[o++] = u * u * sy + 2 * u * t * y + t * t * ey;
    }
    sx = ex;
    sy = ey;
  }
  flatN = o / 2;
  return flatN;
}

/** The last flattened polygon (FLAT, flatN points). */
export function flatPoints(): { pts: Float64Array; n: number } {
  return { pts: FLAT, n: flatN };
}

/**
 * Flatten a path of line / quadratic segments given as commands into FLAT:
 * cmds = [x0, y0, (type, ...)...]: type 0 = line to (x, y), 1 = quad (cx, cy, x, y). Closed.
 */
export function flattenSegments(cmds: Float64Array, len: number, steps = 6): number {
  let o = 0;
  let px = cmds[0], py = cmds[1];
  FLAT[o++] = px;
  FLAT[o++] = py;
  let i = 2;
  while (i < len) {
    const type = cmds[i++];
    if (type === 0) {
      px = cmds[i++];
      py = cmds[i++];
      FLAT[o++] = px;
      FLAT[o++] = py;
    } else {
      const cx = cmds[i++], cy = cmds[i++], x = cmds[i++], y = cmds[i++];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        FLAT[o++] = u * u * px + 2 * u * t * cx + t * t * x;
        FLAT[o++] = u * u * py + 2 * u * t * cy + t * t * y;
      }
      px = x;
      py = y;
    }
  }
  // Drop a closing duplicate.
  if (o >= 4 && Math.abs(FLAT[o - 2] - FLAT[0]) < 1e-9 && Math.abs(FLAT[o - 1] - FLAT[1]) < 1e-9) o -= 2;
  flatN = o / 2;
  return flatN;
}

/**
 * Fill the flattened polygon (FLAT) grown by g px: the region a "fill +
 * stroke(lineWidth 2g, round joins)" covers. Round joins at convex corners,
 * mitred (clamped) concave ones. One path, filled once.
 */
export function fillGrown(ctx: CanvasRenderingContext2D, g: number, color: string): void {
  const n = flatN;
  if (n < 3) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Orientation (screen y down: area > 0 = clockwise on screen).
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 < n ? i + 1 : 0;
    area += FLAT[i * 2] * FLAT[j * 2 + 1] - FLAT[j * 2] * FLAT[i * 2 + 1];
  }
  const sg = area >= 0 ? 1 : -1;
  let o = 0;
  for (let i = 0; i < n; i++) {
    const h = i > 0 ? i - 1 : n - 1;
    const j = i + 1 < n ? i + 1 : 0;
    const x = FLAT[i * 2], y = FLAT[i * 2 + 1];
    let e0x = x - FLAT[h * 2], e0y = y - FLAT[h * 2 + 1];
    let e1x = FLAT[j * 2] - x, e1y = FLAT[j * 2 + 1] - y;
    const l0 = Math.sqrt(e0x * e0x + e0y * e0y), l1 = Math.sqrt(e1x * e1x + e1y * e1y);
    if (l0 < 1e-9 || l1 < 1e-9) continue;
    e0x /= l0;
    e0y /= l0;
    e1x /= l1;
    e1y /= l1;
    // Outward normals (for clockwise-on-screen polygons: (ey, -ex)).
    const n0x = e0y * sg, n0y = -e0x * sg, n1x = e1y * sg, n1y = -e1x * sg;
    const cross = (e0x * e1y - e0y * e1x) * sg; // > 0: convex corner
    const dot = n0x * n1x + n0y * n1y;
    if (cross > 0 && dot < 0.995 && o < OFF.length - 40) {
      // Round join: arc from n0 to n1 around the vertex.
      const a0 = Math.atan2(n0y, n0x);
      let da = Math.atan2(n1y, n1x) - a0;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      const steps = Math.max(1, Math.min(12, Math.ceil(Math.abs(da) / 0.3)));
      for (let s = 0; s <= steps; s++) {
        const a = a0 + (da * s) / steps;
        OFF[o++] = x + Math.cos(a) * g;
        OFF[o++] = y + Math.sin(a) * g;
      }
    } else {
      // Mitre: the offset edges' intersection, clamped.
      let mx = n0x + n1x, my = n0y + n1y;
      const ml = Math.sqrt(mx * mx + my * my);
      if (ml < 1e-6) {
        mx = n0x;
        my = n0y;
      } else {
        mx /= ml;
        my /= ml;
      }
      const cosh = mx * n0x + my * n0y;
      const dist = g / Math.max(0.5, cosh);
      OFF[o++] = x + mx * dist;
      OFF[o++] = y + my * dist;
    }
  }
  if (o < 6) return;
  ctx.beginPath();
  ctx.moveTo(OFF[0], OFF[1]);
  for (let i = 2; i < o; i += 2) ctx.lineTo(OFF[i], OFF[i + 1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Fill FLAT clipped to the convex quad q (4 points, either winding):
 * Sutherland-Hodgman. For a band across the torso (the chest stripe), which
 * the path renderer draws as a stroke inside clip().
 */
export function fillClippedToQuad(ctx: CanvasRenderingContext2D, q: Float64Array, color: string): void {
  let src = FLAT, n = flatN;
  let dst = OFF;
  // Quad orientation.
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) & 3;
    area += q[i * 2] * q[j * 2 + 1] - q[j * 2] * q[i * 2 + 1];
  }
  const sg = area >= 0 ? 1 : -1;
  const tmp = CLIP_TMP;
  for (let e = 0; e < 4 && n > 0; e++) {
    const ax = q[e * 2], ay = q[e * 2 + 1];
    const bx = q[((e + 1) & 3) * 2], by = q[((e + 1) & 3) * 2 + 1];
    const inside = (x: number, y: number) => ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) * sg >= 0;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const px = src[i * 2], py = src[i * 2 + 1];
      const j = i + 1 < n ? i + 1 : 0;
      const qx = src[j * 2], qy = src[j * 2 + 1];
      const pin = inside(px, py), qin = inside(qx, qy);
      if (pin) {
        dst[m++] = px;
        dst[m++] = py;
      }
      if (pin !== qin) {
        // Intersection of PQ with the edge line.
        const dx = qx - px, dy = qy - py;
        const ex = bx - ax, ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) > 1e-12) {
          const t = ((ax - px) * ey - (ay - py) * ex) / den;
          dst[m++] = px + dx * t;
          dst[m++] = py + dy * t;
        }
      }
    }
    n = m / 2;
    // Ping-pong between OFF and CLIP_TMP (never write into FLAT).
    src = dst;
    dst = dst === OFF ? tmp : OFF;
  }
  if (n < 3) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.moveTo(src[0], src[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(src[i * 2], src[i * 2 + 1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
const CLIP_TMP = new Float64Array(8192);

/** The 4 corners of a butt-capped band of `width` from (x0, y0) to (x1, y1), into out. */
export function bandQuad(out: Float64Array, x0: number, y0: number, x1: number, y1: number, width: number): void {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / d) * width * 0.5, ny = (dx / d) * width * 0.5;
  out[0] = x0 + nx;
  out[1] = y0 + ny;
  out[2] = x1 + nx;
  out[3] = y1 + ny;
  out[4] = x1 - nx;
  out[5] = y1 - ny;
  out[6] = x0 - nx;
  out[7] = y0 - ny;
}
