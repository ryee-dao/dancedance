/**
 * The coach stage: plugs the animated coach into the play screen.
 *
 *   setStageRenderer(() => createCoachStage({ getIntensity, isTV, getStyle }))
 *
 * The coach's look comes from `deps.getStyle()` (read every frame, so a
 * setting change applies live), overridden by a `?coach=<style>` URL
 * parameter for quick comparisons; default 'classic'.
 *
 * Reads from the play screen's per-frame info: `info.beats: BeatSource | null`
 * (song time; `timeSec` is already shifted by the audio offset) and
 * `info.intensity` (per-song level; falls back to deps.getIntensity()). Both
 * are read defensively: a missing beat source means the coach grooves at a
 * relaxed generic tempo.
 *
 * Phases: loading / countdown show a breathing ready stance; paused freezes
 * the frame; playing dances. The canvas is capped per graphics tier
 * (core/coach/quality.ts: Full 1920x1080, or 1280x720 on TV; Smooth
 * 1280x720; Smoothest 960x540 at 30 fps) and upscaled by CSS. The tier
 * follows Options → Graphics and steps down by itself on a slow device.
 */

import type { BeatSource } from '../beat/beatSource';
import type { Intensity } from '../core/choreo/generator';
import { READY_POSE, type Move } from '../core/choreo/moves';
import { resolveSongStyle, styleKey, styleLabel, type SongStyle, type StyleOverride } from '../core/choreo/songStyle';
import { PoseEvaluator } from '../core/coach/animator';
import { Conductor, type Plan } from '../core/coach/conductor';
import { timeOfBeat } from '../core/coach/animator';
import type { SpriteStats } from '../core/coach/sprites';
import { loopPlan, type LoopPlan } from '../core/coach/loop';
import { blendPose } from '../core/coach/poses';
import { SPRITE_BUDGET, StageRenderer2D, type SceneInfo, type StripInfo } from '../core/coach/renderer';
import { CH, createPose, createSkeleton, solveSkeleton } from '../core/coach/skeleton';
import { GraphicsMeter, graphicsPrefOf, urlSprites } from './graphics';
import type { GraphicsPref, GraphicsStats, Tier } from '../core/coach/quality';
import { DEFAULT_COACH_BUILD, DEFAULT_COACH_STYLE, parseCoachBuild, parseCoachStyle, type CoachBuild, type CoachStyle } from '../core/coach/styles';
import type { FrameInfo, StageRenderer } from './play';
import { createPlayersStage, hudTopFraction, urlPlayers } from './duoStage'; // two-player mode (duo agent)

export interface CoachStageDeps {
  getIntensity(): Intensity;
  isTV: boolean;
  /** The coach's look (default 'classic'). A `?coach=<style>` URL parameter wins. */
  getStyle?: () => CoachStyle;
  /**
   * Which version of the look dances (default 'female'), read every frame.
   * Two players: P1 dances it, P2 the other version. `?build=` wins.
   */
  getBuild?: () => CoachBuild;
  /** 'same' (default): a song always gets the same routine; 'fresh': a new one each play. */
  getRoutineMode?: () => RoutineMode;
  /** Completed plays of a song so far (mixed into the seed in 'fresh' mode). Read once per song. */
  getPlayCount?: (videoId: string) => number;
  /** iTunes primary genre of a song, when known (added songs). Read once per song. */
  getGenre?: (videoId: string) => string | undefined;
  /** Dev bench: force a song style (families / themes / signature). */
  getStyleOverride?: () => StyleOverride | undefined;
  /** Two-player mode (duoStage.ts): 1 or 2 players, read every frame. `?players=2` wins. */
  getPlayers?: () => 1 | 2;
  /** Graphics setting (quality.ts), read every frame; default 'auto'. `?gfx=auto|smooth|full` wins. */
  getGraphics?: () => GraphicsPref;
  /** Graphics test only: always draw at this tier (no stepping down). */
  pinTier?: Tier;
  /** Graphics test / comparisons: sprite drawing on or off in the lighter tiers (default: the tier's). `?gfxsprites=` wins. */
  sprites?: boolean;
  /** Tests / bench: new sprites a frame may make (default SPRITE_BUDGET, more while waiting). */
  spriteBudget?: number;
}

/** New sprites a frame may make while the song hasn't started (the countdown frames are cheap). */
export const WAIT_SPRITE_BUDGET = 16;
/** Upcoming poses sampled per frame for prewarming (1/30 s apart), and how far ahead (s). */
const WARM_SAMPLES = 2;
const WARM_SAMPLES_WAITING = 8;
const WARM_AHEAD = 4;
const WARM_STEP = 1 / 30;

export type RoutineMode = 'same' | 'fresh';

export interface FrameStats {
  /** Average time between frames (ms) over the last ~second. */
  frameMs: number;
  /** Average time spent in frame() (ms). */
  drawMs: number;
  fps: number;
}

export interface CoachStage extends StageRenderer {
  /** Recent frame timing, for a diagnostics screen. */
  frameStats(): FrameStats;
  /** Frame timing plus the graphics tier and resolution in use. */
  graphicsStats(): GraphicsStats;
  /** Sprite cache counters (sprite tiers; null otherwise). */
  spriteStats?(): SpriteStats | null;
}

/** The sprite setting for a stage: the bench / URL override, else the tier's. */
export function spritesFor(deps: Pick<CoachStageDeps, 'sprites'>, tierSprites: boolean): boolean {
  return deps.sprites ?? urlSprites ?? tierSprites;
}

/** Time of a plan's first planned move (prewarming starts there while waiting). */
export function planStart(plan: Plan): number {
  return plan.instances.length ? timeOfBeat(plan, plan.instances[0].start) : plan.grid.length ? plan.grid[0] : 0;
}

type InfoWithBeats = FrameInfo & { beats?: BeatSource | null };

const READY_FADE_SEC = 0.6;

export function createCoachStage(deps: CoachStageDeps): CoachStage {
  // Two-player mode (duo agent): switches between this stage and the duo stage per frame.
  if (deps.getPlayers || urlPlayers()) return createPlayersStage(deps, () => new CoachStageImpl(deps));
  return new CoachStageImpl(deps);
}

class CoachStageImpl implements CoachStage {
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private r: StageRenderer2D | null = null;
  private ro: ResizeObserver | null = null;
  private onWinResize = () => this.resize();
  private conductor = new Conductor();
  private pose = createPose();
  private ready = createPose();
  private sk = createSkeleton();
  private needResize = true;
  /** Last measured top of the page's bottom HUD (fraction of the height); see hudTopFraction. */
  private hudTop = 0.9;
  private hudCheckAt = 0;
  private lastPhase = '';
  private playStartWall = 0;
  private frozenDrawn = false;
  // Strip state.
  private strip: StripInfo = { now: '', sig: false, progress: 0, beatsToChange: Infinity, next: null, after: null };
  private nextMove: Move | null = null;
  private nextMirror = false;
  private nextLoop: LoopPlan | null = null;
  private nextEval = new PoseEvaluator();
  private nextPose = createPose();
  private nextSk = createSkeleton();
  private afterMove: Move | null = null;
  private afterSk = createSkeleton();
  private nextCard = { name: '', skeleton: this.nextSk as typeof this.nextSk | null };
  private afterCard = { name: '', skeleton: this.afterSk as typeof this.afterSk | null };
  private scene: SceneInfo = { t: 0, beat: 0, half: false, energy: 0.3, strip: null };
  // Stats + graphics tier.
  private readonly meter: GraphicsMeter;
  private readonly urlStyle: CoachStyle | null = urlCoachStyle();
  // Song style + routine personalisation, resolved once per song (again when its beat map arrives).
  private songKey = '';
  private routine: RoutineInfo | null = null;
  // Sprite prewarming: upcoming poses drawn into the sprite cache (not the screen).
  private warmEv = new PoseEvaluator();
  private warmPose = createPose();
  private warmSk = createSkeleton();
  private warmT = -Infinity;
  private warmPlan: Plan | null = null;

  constructor(private deps: CoachStageDeps) {
    this.meter = new GraphicsMeter(deps.isTV, 1, deps.pinTier ?? null);
  }

  private style(): CoachStyle {
    return this.urlStyle ?? parseCoachStyle(this.deps.getStyle?.()) ?? DEFAULT_COACH_STYLE;
  }

  private build(): CoachBuild {
    return coachBuildOf(this.deps);
  }

  mount(stage: HTMLElement): void {
    this.host = stage;
    const c = document.createElement('canvas');
    c.className = 'coach-canvas';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    stage.appendChild(c);
    this.canvas = c;
    this.r = new StageRenderer2D(c, this.style(), this.build());
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => (this.needResize = true));
      this.ro.observe(stage);
    }
    window.addEventListener('resize', this.onWinResize);
    this.conductor.reset();
    this.resize();
  }

  unmount(): void {
    this.ro?.disconnect();
    this.ro = null;
    window.removeEventListener('resize', this.onWinResize);
    this.canvas?.remove();
    this.canvas = null;
    this.r = null;
    this.host = null;
  }

  /** Routine personalisation, cached per song (and per beat-map arrival). */
  private routineFor(item: FrameInfo['item'], videoId: string, map: { bpm: number; sections: readonly { energy: number }[] } | null): RoutineInfo {
    const ov = this.deps.getStyleOverride?.();
    const k = `${videoId}|${item.title}|${map ? 'map' : 'nomap'}${ov ? `|${JSON.stringify(ov)}` : ''}`;
    if (this.routine && k === this.songKey) return this.routine;
    // The play count / mode are read once per song: keep the earlier read when only the map arrived.
    const sameSong = this.songKey.split('|')[0] === videoId && this.routine;
    const r = routineInfo(item, map, this.deps);
    if (sameSong) {
      r.fresh = this.routine!.fresh;
      r.key = `${styleKey(r.style)}${r.fresh ? `|play${r.fresh}` : ''}`;
    }
    this.songKey = k;
    this.routine = r;
    return r;
  }

  frameStats(): FrameStats {
    return this.meter.frameStats();
  }

  graphicsStats(): GraphicsStats {
    return this.meter.stats(this.canvas);
  }

  spriteStats(): SpriteStats | null {
    return this.r?.sprites?.stats() ?? null;
  }

  /**
   * Sprite tiers: draw poses a little ahead of the playhead (from the start
   * of the routine while waiting) into the sprite cache, using what is left
   * of this frame's budget of new sprites.
   */
  private prewarm(t: number, waiting: boolean): void {
    const r = this.r;
    const plan = this.conductor.plan;
    if (!r?.sprites || !plan || plan.kind === 'idle') return;
    if (plan !== this.warmPlan) {
      this.warmPlan = plan;
      this.warmT = -Infinity;
    }
    const from = waiting ? planStart(plan) : t + 0.2;
    if (this.warmT < from) this.warmT = from;
    const until = (waiting ? from : t) + WARM_AHEAD * (waiting ? 4 : 1);
    const n = waiting ? WARM_SAMPLES_WAITING : WARM_SAMPLES;
    for (let i = 0; i < n && r.sprites.budget > 0 && this.warmT < until; i++) {
      this.warmEv.evaluate(plan, this.warmT, this.warmPose, { energy: plan.sectionAt(this.warmT, null).energy });
      solveSkeleton(this.warmPose, this.warmSk);
      r.warm(this.warmSk, this.warmT);
      r.warmNext(this.warmSk, this.warmT);
      this.warmT += WARM_STEP;
    }
  }

  private resize(): void {
    this.needResize = false;
    if (!this.host || !this.r) return;
    const rect = this.host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    let w = Math.max(1, rect.width) * dpr;
    let h = Math.max(1, rect.height) * dpr;
    const spec = this.meter.spec();
    const k = Math.min(1, spec.maxW / w, spec.maxH / h);
    w *= k;
    h *= k;
    this.hudTop = hudTopFraction(this.host, rect);
    this.hudCheckAt = performance.now();
    this.r.quality.cached = spec.cached;
    this.r.quality.sprites = spritesFor(this.deps, spec.sprites);
    this.r.resize(w, h, true, this.hudTop);
    if (this.canvas) this.meter.noteCanvas(this.canvas);
    this.frozenDrawn = false;
  }

  frame(timeSec: number, info: FrameInfo): void {
    const wall = performance.now();
    if (!this.r) return;
    const item0 = info.item;
    const songKey = item0.kind === 'youtube' ? item0.videoId : `file:${item0.title}`;
    const tick = this.meter.tick(wall, graphicsPrefOf(this.deps), info.phase === 'playing', songKey);
    if (tick.changed) this.needResize = true;
    // The HUD can lay out after the stage was sized (fonts, a screen shown
    // late): re-check it now and then and re-layout if it moved.
    if (!this.needResize && this.host && wall - this.hudCheckAt > 1000) {
      this.hudCheckAt = wall;
      const f = hudTopFraction(this.host, this.host.getBoundingClientRect());
      if (Math.abs(f - this.hudTop) > 0.004) this.needResize = true;
    }
    if (this.needResize) this.resize();
    const style = this.style();
    const build = this.build();
    if (style !== this.r.style || build !== this.r.build) {
      this.r.style = style;
      this.r.build = build;
      this.frozenDrawn = false;
    }

    const phase = info.phase;
    if (phase === 'paused' && this.lastPhase === 'paused' && this.frozenDrawn) return; // frozen
    // 30 fps tiers: skip this display frame (the next drawn one reads the audio clock afresh).
    if (!tick.draw && phase === this.lastPhase) return;
    const src = (info as InfoWithBeats).beats ?? null;
    const tl = src ? src.current() : null;
    const item = info.item;
    const videoId = item.kind === 'youtube' ? item.videoId : `file:${item.title}`;
    // Per-song level from the frame info when present, else the setting.
    const intensity = (info as Partial<FrameInfo>).intensity ?? this.deps.getIntensity();
    const t = timeSec;

    if (phase === 'playing' && this.lastPhase !== 'playing' && this.lastPhase !== 'paused') this.playStartWall = wall;
    this.lastPhase = phase;

    const r = this.routineFor(item, videoId, tl?.map ?? null);
    this.conductor.update(tl, videoId, intensity, t, { style: r.style, fresh: r.fresh }, r.key);
    const sec = this.conductor.sectionAt(t);
    const waiting = phase === 'loading' || phase === 'countdown';

    // Ready stance (breathing on the wall clock while time stands still).
    const br = Math.sin(wall / 1000 * 2.2);
    this.ready.set(READY_POSE);
    this.ready[CH.Y] += br * 0.006;
    this.ready[CH.RA_E] += br * 2;
    this.ready[CH.LA_E] += br * 2;
    this.ready[CH.HEAD_NOD] += br * 1.5;

    if (waiting) {
      this.pose.set(this.ready);
    } else {
      this.conductor.evaluate(t, this.pose, sec.energy);
      const since = (wall - this.playStartWall) / 1000;
      if (since < READY_FADE_SEC && since >= 0) {
        const w = since / READY_FADE_SEC;
        blendPose(this.ready, this.pose, w * w * (3 - 2 * w), this.pose);
      }
    }
    solveSkeleton(this.pose, this.sk);

    // Strip.
    const up = this.conductor.upcoming(t);
    const s = this.strip;
    const plan = this.conductor.plan;
    if (waiting) {
      s.now = 'Get ready';
      s.sig = false;
      s.progress = 0;
      s.beatsToChange = Infinity;
    } else {
      s.now = up.current ? up.current.move.name : 'Warm Bounce';
      s.sig = !!up.current?.sig;
      const span = up.changeAt - up.groupStart;
      s.progress = Number.isFinite(span) && span > 0 ? (t - up.groupStart) / span : 0;
      s.beatsToChange = up.beatsToChange;
    }
    s.style = waiting ? undefined : r.label;
    const next = waiting ? (up.next ?? up.current) : up.next;
    if (next && plan) {
      if (next.move !== this.nextMove || next.mirror !== this.nextMirror) {
        this.nextMove = next.move;
        this.nextMirror = next.mirror;
        this.nextLoop = loopPlan(next.move, plan.period, { half: next.half, mirrorFirst: next.mirror });
      }
      const lp = this.nextLoop!;
      const nb = up.beat - next.start;
      const lb = ((nb % lp.loopBeats) + lp.loopBeats) % lp.loopBeats;
      this.nextEval.evaluate(lp, waiting ? 0 : lb * lp.period, this.nextPose, { energy: 0.5 });
      solveSkeleton(this.nextPose, this.nextSk);
      this.nextCard.name = next.move.name;
      s.next = this.nextCard;
    } else {
      s.next = null;
      this.nextMove = null;
    }
    const after = waiting ? null : up.after;
    if (after) {
      if (after.move !== this.afterMove) {
        this.afterMove = after.move;
        const k = after.move.keys[after.move.icon] ?? after.move.keys[0];
        const q = createPose();
        q.set(k.pose);
        q[CH.X] = 0;
        const dx = (q[CH.RFT_X] + q[CH.LFT_X]) / 2;
        q[CH.RFT_X] -= dx;
        q[CH.LFT_X] -= dx;
        solveSkeleton(q, this.afterSk);
      }
      this.afterCard.name = after.move.name;
      s.after = this.afterCard;
    } else {
      s.after = null;
      this.afterMove = null;
    }

    const sc = this.scene;
    sc.t = waiting ? wall / 1000 : t;
    sc.beat = waiting ? 0 : this.conductor.beat;
    sc.half = !!plan?.half;
    sc.energy = waiting ? 0.25 : sec.energy;
    sc.strip = s;
    this.r.spriteBudget = this.deps.spriteBudget ?? (waiting || phase === 'paused' ? WAIT_SPRITE_BUDGET : SPRITE_BUDGET);
    this.r.render(this.sk, sc);
    this.prewarm(t, waiting || phase === 'paused');
    this.frozenDrawn = phase === 'paused';
    this.meter.drawn(wall, performance.now() - wall);
  }
}

export interface RoutineInfo {
  style: SongStyle;
  fresh?: number;
  key: string;
  label: string;
}

/**
 * The routine personalisation for a song: its style (title / artist / genre,
 * plus tempo / energy priors once the beat map is known) and, in 'fresh'
 * mode, the play number. Pure apart from the deps it reads.
 */
export function routineInfo(
  item: FrameInfo['item'],
  map: { bpm: number; sections: readonly { energy: number }[] } | null,
  deps: Pick<CoachStageDeps, 'getRoutineMode' | 'getPlayCount' | 'getGenre' | 'getStyleOverride'>,
): RoutineInfo {
  const videoId = item.kind === 'youtube' ? item.videoId : undefined;
  const artist = item.kind === 'youtube' ? item.artist : undefined;
  let genre: string | undefined;
  try {
    genre = videoId ? deps.getGenre?.(videoId) : undefined;
  } catch {
    genre = undefined;
  }
  const secs = map?.sections ?? [];
  const energy = secs.length ? secs.reduce((a, s) => a + s.energy, 0) / secs.length : undefined;
  const override = deps.getStyleOverride?.();
  const style = resolveSongStyle({ videoId, title: item.title, artist, genre, ...(override ? { style: override } : {}) }, map ? { bpm: map.bpm, energy } : undefined);
  let fresh: number | undefined;
  if ((deps.getRoutineMode?.() ?? 'same') === 'fresh') {
    let n = 0;
    try {
      n = videoId ? deps.getPlayCount?.(videoId) ?? 0 : 0;
    } catch {
      n = 0;
    }
    fresh = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return { style, fresh, key: `${styleKey(style)}${fresh ? `|play${fresh}` : ''}`, label: styleLabel(style) };
}

/** `?coach=<style>` on the page URL, if valid. */
/** The version that dances: `?build=female|male` on the page URL, else the setting. */
export function coachBuildOf(deps: Pick<CoachStageDeps, 'getBuild'>): CoachBuild {
  let url: CoachBuild | null = null;
  try {
    url = typeof location === 'undefined' ? null : parseCoachBuild(new URLSearchParams(location.search).get('build'));
  } catch {
    url = null;
  }
  return url ?? parseCoachBuild(deps.getBuild?.()) ?? DEFAULT_COACH_BUILD;
}

function urlCoachStyle(): CoachStyle | null {
  try {
    return typeof location === 'undefined' ? null : parseCoachStyle(new URLSearchParams(location.search).get('coach'));
  } catch {
    return null;
  }
}
