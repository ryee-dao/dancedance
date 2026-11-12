/**
 * Graphics tiers for the coach stage, and the governor that picks one.
 *
 *   tier 0  Full      the original drawing (beat-pulsing glows, full res:
 *                     1920x1080 on the web, 1280x720 on TV), every path drawn
 *                     fresh, whole canvas redrawn every frame.
 *   tier 1  Smooth    the same figures, strip and floor rings, but the glows
 *                     behind the coaches are baked into a cached background
 *                     (they follow the section energy, no beat pulse), only
 *                     the parts that move are redrawn each frame (dirty
 *                     rectangles), and the coaches are composed from
 *                     pre-drawn pieces (sprites.ts: image blits instead of
 *                     stroked / filled paths, which are what weak TV chips
 *                     are slow at). 1280x720 at most.
 *   tier 2  Smoothest tier 1 at 960x540, drawn at 30 fps (the pose is still
 *                     taken from the audio clock at every drawn frame, so the
 *                     moves stay exactly on the beat).
 *
 * The setting (Options → Graphics): 'full' pins tier 0; 'smooth' starts at
 * tier 1 and may step to 2; 'auto' starts at 0 on the web and 1 on TV and
 * steps down when frames keep missing their budget. It never steps back up
 * during a song; the next song starts from the lowest tier reached (per
 * player count), so a weak device settles after one song.
 *
 * Sprites or paths in tiers 1 / 2: sprites by default (GPU-rastered canvases
 * draw bitmaps far faster than stroked paths). Which is faster depends on
 * the device, though (a canvas rastered on the CPU samples transformed
 * bitmaps slowly and fills paths quickly), so it is measured, not assumed:
 * the first time a lighter tier misses its budget, the other method is
 * tried for one window and the faster one is kept (remembered like the
 * tier) before any further step down. No device is detected by name.
 *
 * Pure TypeScript (no DOM).
 */

export type GraphicsPref = 'auto' | 'smooth' | 'full';
export const GRAPHICS_PREFS: readonly GraphicsPref[] = ['auto', 'smooth', 'full'];

export function parseGraphicsPref(v: unknown): GraphicsPref | null {
  return typeof v === 'string' && (GRAPHICS_PREFS as readonly string[]).includes(v) ? (v as GraphicsPref) : null;
}

export type Tier = 0 | 1 | 2;

export interface TierSpec {
  tier: Tier;
  /** Name for the diagnostics readout. */
  name: string;
  /** Backing-store cap (device px); the CSS size is unchanged, the browser upscales. */
  maxW: number;
  maxH: number;
  /** Glows baked into the cached background, only moving parts redrawn. */
  cached: boolean;
  /** Coaches and moving strip parts composed from pre-drawn sprites (with `cached`). */
  sprites: boolean;
  /** Frames drawn per second (the display may run faster; extra frames are skipped). */
  fps: 60 | 30;
}

export function tierSpec(tier: Tier, isTV: boolean): TierSpec {
  switch (tier) {
    case 0:
      return { tier, name: 'Full', maxW: isTV ? 1280 : 1920, maxH: isTV ? 720 : 1080, cached: false, sprites: false, fps: 60 };
    case 1:
      return { tier, name: 'Smooth', maxW: 1280, maxH: 720, cached: true, sprites: true, fps: 60 };
    default:
      return { tier: 2, name: 'Smoothest', maxW: 960, maxH: 540, cached: true, sprites: true, fps: 30 };
  }
}

/** Mean frame interval over a window above this (ms) counts as missing the budget. */
export const BUDGET_MS: Record<60 | 30, number> = { 60: 22, 30: 40 };
/** Length of a measuring window (ms) and the settling time ignored after a start / switch. */
export const WINDOW_MS = 2000;
export const SETTLE_MS = 1500;

/** Lowest tier reached per (pref, TV, players) this session: where the next song starts. */
const floors = new Map<string, Tier>();
/** Sprites or paths, once measured per (pref, TV, players). */
const methods = new Map<string, boolean>();

/** Test hook: forget what earlier songs learned. */
export function resetGraphicsMemory(): void {
  floors.clear();
  methods.clear();
}

export class TierGovernor {
  private pref: GraphicsPref = 'auto';
  private key = '';
  private _tier: Tier = 0;
  private winStart = -1;
  private winFrames = 0;
  private winSum = 0;
  private settleUntil = 0;
  /** Sprites (true) or paths in tiers 1 / 2; see the note at the top. */
  private spritesOn = true;
  /** Mean frame time of the other method while the current one is on trial (NaN = no trial). */
  private trialOther = NaN;
  /** Why the tier last changed (diagnostics). */
  reason = '';

  constructor(
    private readonly isTV: boolean,
    private readonly players: 1 | 2 = 1,
    /** Dev / measuring: always this tier (`?gfxtier=` on the page URL). */
    private readonly pinned: Tier | null = null,
  ) {}

  get tier(): Tier {
    return this._tier;
  }

  spec(): TierSpec {
    const s = tierSpec(this._tier, this.isTV);
    if (s.sprites && !this.spritesOn) s.sprites = false;
    return s;
  }

  /** The tier a song starts at for this setting. */
  startTier(pref: GraphicsPref): Tier {
    if (this.pinned !== null) return this.pinned;
    if (pref === 'full') return 0;
    const base: Tier = pref === 'smooth' || this.isTV ? 1 : 0;
    const learned = floors.get(this.memKey(pref));
    return learned !== undefined && learned > base ? learned : base;
  }

  private memKey(pref: GraphicsPref): string {
    return `${pref}|${this.isTV ? 'tv' : 'web'}|${this.players}`;
  }

  /**
   * Call every animation frame. Returns true when the tier changed (the
   * stage then resizes / rebuilds its caches). `active` = a song is playing
   * and the page is visible (loading, countdown and pause don't count).
   */
  update(pref: GraphicsPref, now: number, intervalMs: number, active: boolean, songKey: string): boolean {
    const key = `${pref}|${songKey}`;
    if (key !== this.key) {
      // New song or a changed setting: start from the remembered tier.
      this.key = key;
      this.pref = pref;
      const t = this.startTier(pref);
      const changed = t !== this._tier;
      this._tier = t;
      this.reason = pref === 'full' ? 'setting: Full' : pref === 'smooth' ? 'setting: Smooth' : this.isTV ? 'TV default' : 'default';
      if (floors.has(this.memKey(pref)) && t === floors.get(this.memKey(pref)) && t > 0) this.reason = 'learned on an earlier song';
      const m = methods.get(this.memKey(pref));
      const sp = this.pinned !== null || m === undefined ? true : m;
      const methodChanged = sp !== this.spritesOn;
      this.spritesOn = sp;
      this.trialOther = NaN;
      this.restart(now);
      return changed || methodChanged;
    }
    if (!active || !(intervalMs > 0) || intervalMs > 500) {
      // Paused, hidden, or a long gap (tab switch): measure afresh afterwards.
      this.restart(now);
      return false;
    }
    if (now < this.settleUntil) return false;
    if (this.winStart < 0) this.winStart = now;
    this.winFrames++;
    this.winSum += intervalMs;
    if (now - this.winStart < WINDOW_MS) return false;
    const mean = this.winSum / this.winFrames;
    const budget = BUDGET_MS[this.spec().fps === 30 ? 30 : 60];
    this.winStart = now;
    this.winFrames = 0;
    this.winSum = 0;
    if (this.pref === 'full' || this.pinned !== null) return false;
    const mk = this.memKey(this.pref);
    if (!Number.isNaN(this.trialOther)) {
      // The other method's window is over: keep the faster one.
      const other = this.trialOther;
      this.trialOther = NaN;
      if (mean > other) this.spritesOn = !this.spritesOn;
      methods.set(mk, this.spritesOn);
      const best = Math.min(mean, other);
      this.reason = `${this.spritesOn ? 'pre-drawn pieces' : 'paths'} faster here (${Math.round(Math.min(mean, other))} vs ${Math.round(Math.max(mean, other))} ms)`;
      if (best > budget && this._tier < 2) {
        this._tier = (this._tier + 1) as Tier;
        this.reason += `; stepped down: ${Math.round(best)} ms frames`;
        if ((floors.get(mk) ?? 0) < this._tier) floors.set(mk, this._tier);
      }
      this.restart(now);
      return true;
    }
    if (mean <= budget) return false;
    if (this._tier >= 1 && !methods.has(mk)) {
      // First miss in a lighter tier: try the other drawing method for a window.
      this.trialOther = mean;
      this.spritesOn = !this.spritesOn;
      this.reason = `trying ${this.spritesOn ? 'pre-drawn pieces' : 'paths'}: ${Math.round(mean)} ms frames`;
      this.restart(now);
      return true;
    }
    if (this._tier >= 2) return false;
    this._tier = (this._tier + 1) as Tier;
    this.reason = `stepped down: ${Math.round(mean)} ms frames`;
    if ((floors.get(mk) ?? 0) < this._tier) floors.set(mk, this._tier);
    this.restart(now);
    return true;
  }

  private restart(now: number): void {
    this.winStart = -1;
    this.winFrames = 0;
    this.winSum = 0;
    this.settleUntil = now + SETTLE_MS;
  }
}

/**
 * Frame pacing for 30 fps tiers: true when this animation frame should be
 * drawn. Uses wall time, not a frame counter, so a 60 Hz display draws every
 * other frame and a slower one draws whenever ~33 ms have passed.
 */
export function shouldDraw(fps: 60 | 30, now: number, lastDraw: number): boolean {
  if (fps === 60) return true;
  return now - lastDraw >= 1000 / 30 - 6;
}

/** Live readout of a stage's graphics state (diagnostics, the on-screen FPS line). */
export interface GraphicsStats {
  /** Average time between animation frames (ms). */
  frameMs: number;
  /** Average time spent drawing a frame (ms, JavaScript side). */
  drawMs: number;
  /** Frames actually drawn per second. */
  drawnFps: number;
  tier: Tier;
  tierName: string;
  /** Backing store size, e.g. "1280x720". */
  resolution: string;
  reason: string;
}
