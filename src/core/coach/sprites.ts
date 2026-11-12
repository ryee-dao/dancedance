/**
 * Sprite cache for the lighter graphics tiers (quality.ts): the coach is
 * composed each frame from small pre-drawn images instead of fresh paths.
 *
 * Why: on weak TV chips every stroked path (and every non-convex fill) costs
 * about half a millisecond to rasterise, while drawImage of a cached bitmap
 * is nearly free. So each body part is drawn ONCE by the look's own painter
 * code (renderer.ts / humanPainter.ts stay the single source of truth) into
 * a slot of a shared atlas canvas, and from then on blitted with a
 * transform (rotation, uniform scale, translation are free).
 *
 * Parts whose shape depends on continuous pose parameters are keyed by
 * quantised parameters (see the painters and spriteParts.ts: segment length
 * in 20 % steps with the middle stretched, hand openness / foreshortening,
 * face turn, ...). Sprites are made at the figure's scale (6 % steps); the
 * part's perspective and the residual are the blit's uniform scale.
 *
 * Budget: making an entry draws paths, which is exactly what is slow on the
 * devices this is for, so a frame may make only `budget` new entries; a miss
 * past the budget draws that part with its paths for that frame. Prewarming
 * (the stages) fills the cache from the routine's upcoming poses.
 *
 * Memory: entries live in atlas pages (1024x1024, 4 MB each); when the page
 * limit is reached the least recently used page is cleared and reused (its
 * entries are made again on demand). The cache is shared by every stage on
 * the page, so it survives songs and stage rebuilds.
 *
 * Draw-call budget per frame is the stage's business; this module only
 * blits, so a steady-state frame costs drawImage calls (+ setTransform).
 */

export interface PieceArtist {
  /**
   * Draw piece `id` in sprite-local pixels (origin = the piece's anchor), with
   * the parameters the artist stored before asking the cache. Called while
   * making an entry (into the atlas) or, as a fallback, onto the target under
   * the blit transform.
   */
  drawPiece(ctx: CanvasRenderingContext2D, id: number): void;
}

/** Numeric keys for body parts (spriteKey); a few stage pieces use strings. */
export type SpriteKey = number | string;

export interface SpriteEntry {
  key: SpriteKey;
  page: AtlasPage;
  /** Source rectangle in the page (includes a 1 px transparent rim). */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Sprite-local position of the source rectangle's top-left. */
  lx: number;
  ly: number;
  /** The piece's main quantised parameter (e.g. its length in px), for callers that accept a neighbour bucket. */
  aux: number;
}

interface Shelf {
  y: number;
  h: number;
  x: number;
}

export interface AtlasPage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  shelves: Shelf[];
  /** Bottom of the last shelf. */
  top: number;
  lastUsed: number;
  keys: SpriteKey[];
}

export type MakeCanvas = (w: number, h: number) => { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null;

/** A transparent canvas from the global document (null without a DOM). */
export function defaultMakeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

export interface SpriteStats {
  entries: number;
  pages: number;
  /** Bitmap memory of the atlas pages (bytes, 4 per pixel). */
  bytes: number;
  /** Sum of the entries' own areas × 4 (how full the pages are). */
  usedBytes: number;
  made: number;
  /** Lookups that found no entry for their exact key. */
  misses: number;
  /** Parts drawn with their paths because no sprite could be made that frame (budget used up). */
  direct: number;
  /** Pages cleared to make room. */
  evictions: number;
  /** Most entries made in one frame (since resetStats). */
  maxMadePerFrame: number;
}

const PAGE = 1024;
const GUTTER = 2;
const RIM = 1;

export class SpriteCache {
  /** New entries the current frame may still make. */
  budget = Infinity;
  private readonly map = new Map<SpriteKey, SpriteEntry>();
  private readonly pages: AtlasPage[] = [];
  private frameNo = 1;
  private madeThisFrame = 0;
  private usedArea = 0;
  private st = { made: 0, misses: 0, direct: 0, evictions: 0, maxMadePerFrame: 0 };

  constructor(
    private readonly makeCanvas: MakeCanvas = defaultMakeCanvas,
    /** Atlas pages kept at most (LRU by page). */
    readonly maxPages = 10,
    readonly pageSize = PAGE,
  ) {}

  /** Start of a drawn frame: `budget` = entries it may make. */
  beginFrame(budget: number): void {
    if (this.madeThisFrame > this.st.maxMadePerFrame) this.st.maxMadePerFrame = this.madeThisFrame;
    this.frameNo++;
    this.madeThisFrame = 0;
    this.budget = budget;
  }

  /** Entries made in the current frame so far. */
  get madeNow(): number {
    return this.madeThisFrame;
  }

  get(key: SpriteKey): SpriteEntry | null {
    const e = this.map.get(key);
    if (!e) return null;
    e.page.lastUsed = this.frameNo;
    return e;
  }

  has(key: SpriteKey): boolean {
    return this.map.has(key);
  }

  /**
   * After get(key) found nothing: make the entry now if the frame's budget
   * allows (else the caller draws that part with its paths this frame). The piece covers x0..x1, y0..y1 in sprite-local px. Null: no
   * budget (or no canvas available).
   */
  miss(key: SpriteKey, x0: number, y0: number, x1: number, y1: number, artist: PieceArtist, id: number, aux = 0): SpriteEntry | null {
    this.st.misses++;
    if (this.budget <= 0) return null;
    return this.make(key, x0, y0, x1, y1, artist, id, aux);
  }

  /** Count a part drawn with its paths because no entry was available. */
  noteDirect(): void {
    this.st.direct++;
  }

  private make(key: SpriteKey, x0: number, y0: number, x1: number, y1: number, artist: PieceArtist, id: number, aux: number): SpriteEntry | null {
    const lx = Math.floor(x0) - RIM;
    const ly = Math.floor(y0) - RIM;
    const w = Math.ceil(x1) + RIM - lx;
    const h = Math.ceil(y1) + RIM - ly;
    if (!(w > 0 && h > 0) || w > this.pageSize - GUTTER * 2 || h > this.pageSize - GUTTER * 2) return null;
    const slot = this.alloc(w, h);
    if (!slot) return null;
    const { page, x, y } = slot;
    const c = page.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(x, y, w, h);
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.setTransform(1, 0, 0, 1, x - lx, y - ly);
    c.globalAlpha = 1;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    artist.drawPiece(c, id);
    c.restore();
    const e: SpriteEntry = { key, page, sx: x, sy: y, sw: w, sh: h, lx, ly, aux };
    this.map.set(key, e);
    page.keys.push(key);
    page.lastUsed = this.frameNo;
    this.usedArea += w * h;
    this.budget--;
    this.madeThisFrame++;
    this.st.made++;
    return e;
  }

  /** Space for a w x h entry: a shelf of a similar height with room, a new shelf, a new page or a recycled one. */
  private alloc(w: number, h: number): { page: AtlasPage; x: number; y: number } | null {
    const P = this.pageSize;
    for (let i = this.pages.length - 1; i >= 0; i--) {
      const pg = this.pages[i];
      for (const s of pg.shelves) {
        if (s.h >= h && s.h <= h * 1.35 + 4 && s.x + w + GUTTER <= P) {
          const x = s.x;
          s.x += w + GUTTER;
          return { page: pg, x, y: s.y };
        }
      }
      const sh = Math.ceil(h / 4) * 4;
      if (pg.top + sh + GUTTER <= P) {
        const s = { y: pg.top, h: sh, x: GUTTER + w + GUTTER };
        pg.top += sh + GUTTER;
        pg.shelves.push(s);
        return { page: pg, x: GUTTER, y: s.y };
      }
    }
    let pg: AtlasPage | null = null;
    if (this.pages.length < this.maxPages) {
      const l = this.makeCanvas(P, P);
      if (!l) return null;
      pg = { canvas: l.canvas, ctx: l.ctx, shelves: [], top: GUTTER, lastUsed: this.frameNo, keys: [] };
      this.pages.push(pg);
    } else {
      // Recycle the least recently used page (never one used this frame).
      let best = -1;
      for (let i = 0; i < this.pages.length; i++) {
        const p = this.pages[i];
        if (p.lastUsed >= this.frameNo) continue;
        if (best < 0 || p.lastUsed < this.pages[best].lastUsed) best = i;
      }
      if (best < 0) return null;
      pg = this.pages[best];
      for (const k of pg.keys) {
        const e = this.map.get(k);
        if (e && e.page === pg) {
          this.map.delete(k);
          this.usedArea -= e.sw * e.sh;
        }
      }
      pg.keys = [];
      pg.shelves = [];
      pg.top = GUTTER;
      pg.ctx.setTransform(1, 0, 0, 1, 0, 0);
      pg.ctx.clearRect(0, 0, P, P);
      this.st.evictions++;
      // Move it to the end (newest).
      this.pages.splice(best, 1);
      this.pages.push(pg);
    }
    pg.lastUsed = this.frameNo;
    const sh = Math.ceil(h / 4) * 4;
    const s = { y: pg.top, h: sh, x: GUTTER + w + GUTTER };
    pg.top += sh + GUTTER;
    pg.shelves.push(s);
    return { page: pg, x: GUTTER, y: s.y };
  }

  /** Draw entry `e` with the sprite-local -> target transform (a, b, c, d, e, f as in setTransform). */
  blit(ctx: CanvasRenderingContext2D, e: SpriteEntry, a: number, b: number, c: number, d: number, tx: number, ty: number): void {
    ctx.setTransform(a, b, c, d, tx, ty);
    ctx.drawImage(e.page.canvas, e.sx, e.sy, e.sw, e.sh, e.lx, e.ly, e.sw, e.sh);
  }

  /** Forget everything (tests). */
  clear(): void {
    this.map.clear();
    for (const p of this.pages) {
      p.keys = [];
      p.shelves = [];
      p.top = GUTTER;
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      p.ctx.clearRect(0, 0, this.pageSize, this.pageSize);
    }
    this.usedArea = 0;
  }

  /** Every key (tests / diagnostics). */
  keys(): SpriteKey[] {
    return [...this.map.keys()];
  }

  /** Entries and their bitmap bytes per piece kind (diagnostics / tests). */
  byKind(): Record<string, { n: number; kb: number }> {
    const out: Record<string, { n: number; kb: number }> = {};
    for (const e of this.map.values()) {
      const k = typeof e.key === 'string' ? e.key.split('|')[0] : String(Math.floor(e.key / 2 ** 43));
      const o = (out[k] ??= { n: 0, kb: 0 });
      o.n++;
      o.kb += (e.sw * e.sh * 4) / 1024;
    }
    for (const o of Object.values(out)) o.kb = Math.round(o.kb);
    return out;
  }

  resetStats(): void {
    this.st = { made: 0, misses: 0, direct: 0, evictions: 0, maxMadePerFrame: 0 };
  }

  stats(): SpriteStats {
    return {
      entries: this.map.size,
      pages: this.pages.length,
      bytes: this.pages.length * this.pageSize * this.pageSize * 4,
      usedBytes: this.usedArea * 4,
      ...this.st,
      maxMadePerFrame: Math.max(this.st.maxMadePerFrame, this.madeThisFrame),
    };
  }
}

/** Small ids for looks (style | build | tint) in sprite keys. */
const lookIds = new Map<string, number>();
export function lookIdOf(key: string): number {
  let id = lookIds.get(key);
  if (id === undefined) {
    id = (lookIds.size % 63) + 1;
    lookIds.set(key, id);
  }
  return id;
}

/** The cache shared by every stage on the page (kept across songs). */
let shared: SpriteCache | null = null;
export function sharedSpriteCache(): SpriteCache {
  shared ??= new SpriteCache();
  return shared;
}
/** Test hook: use this cache as the shared one (null = a fresh default next time). */
export function setSharedSpriteCache(c: SpriteCache | null): void {
  shared = c;
}

// ---------------------------------------------------------------------------
// Keys and quantisers

const LOG_STEP = Math.log(1.03);

/** Scale bucket (3 % steps on a log scale) of a px-per-unit value. */
export function qScale(pxPerUnit: number): number {
  const q = Math.round(Math.log(pxPerUnit > 1 ? pxPerUnit : 1) / LOG_STEP);
  return q < 0 ? 0 : q > 255 ? 255 : q;
}

/** The px-per-unit a scale bucket stands for. */
export function scaleOf(q: number): number {
  return Math.exp(q * LOG_STEP);
}

/** Clamp to 0..max (integers). */
function cl(v: number, max: number): number {
  v = Math.round(v);
  return v < 0 ? 0 : v > max ? max : v;
}

/**
 * Pack a key: piece kind (0..63), look (0..63), scale bucket (0..255), three
 * small fields (0..63 each) and the main bucket (0..2047, lowest digits, so
 * neighbouring buckets are key ± 1). 49 bits: exact in a double.
 */
export function spriteKey(kind: number, look: number, qs: number, f1: number, f2: number, f3: number, main: number): number {
  return ((((((cl(kind, 63) * 64 + cl(look, 63)) * 256 + cl(qs, 255)) * 64 + cl(f1, 63)) * 64 + cl(f2, 63)) * 64 + cl(f3, 63)) * 2048) + cl(main, 2047);
}

// ---------------------------------------------------------------------------
// A canvas context that draws nothing (prewarming runs the painters on it so
// only the cache's own atlas drawing happens).

const NOOP = (): void => {};
const NULL_METHODS = [
  'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform', 'resetTransform', 'transform', 'beginPath', 'moveTo', 'lineTo', 'arc', 'arcTo',
  'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'fill', 'stroke', 'clip', 'rect', 'roundRect', 'fillRect', 'clearRect', 'strokeRect',
  'drawImage', 'fillText', 'strokeText', 'putImageData', 'setLineDash',
] as const;

export function nullContext(): CanvasRenderingContext2D {
  const o: Record<string, unknown> = {
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over', imageSmoothingEnabled: true, canvas: null,
  };
  for (const k of NULL_METHODS) o[k] = NOOP;
  o.measureText = () => ({ width: 0 });
  return o as unknown as CanvasRenderingContext2D;
}
