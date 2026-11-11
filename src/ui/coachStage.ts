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
 * the frame; playing dances. The canvas is capped at 1920x1080 (1280x720 on
 * TV) internally and upscaled by CSS.
 */

import type { BeatSource } from '../beat/beatSource';
import type { Intensity } from '../core/choreo/generator';
import { READY_POSE, type Move } from '../core/choreo/moves';
import { resolveSongStyle, styleKey, styleLabel, type SongStyle, type StyleOverride } from '../core/choreo/songStyle';
import { PoseEvaluator } from '../core/coach/animator';
import { Conductor } from '../core/coach/conductor';
import { loopPlan, type LoopPlan } from '../core/coach/loop';
import { blendPose } from '../core/coach/poses';
import { StageRenderer2D, type SceneInfo, type StripInfo } from '../core/coach/renderer';
import { CH, createPose, createSkeleton, solveSkeleton } from '../core/coach/skeleton';
import { DEFAULT_COACH_STYLE, parseCoachStyle, type CoachStyle } from '../core/coach/styles';
import type { FrameInfo, StageRenderer } from './play';
import { createPlayersStage, urlPlayers } from './duoStage'; // two-player mode (duo agent)

export interface CoachStageDeps {
  getIntensity(): Intensity;
  isTV: boolean;
  /** The coach's look (default 'classic'). A `?coach=<style>` URL parameter wins. */
  getStyle?: () => CoachStyle;
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
}

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
  // Stats.
  private lastWall = 0;
  private frameEma = 16.7;
  private drawEma = 1;
  private readonly urlStyle: CoachStyle | null = urlCoachStyle();
  // Song style + routine personalisation, resolved once per song (again when its beat map arrives).
  private songKey = '';
  private routine: RoutineInfo | null = null;

  constructor(private deps: CoachStageDeps) {}

  private style(): CoachStyle {
    return this.urlStyle ?? parseCoachStyle(this.deps.getStyle?.()) ?? DEFAULT_COACH_STYLE;
  }

  mount(stage: HTMLElement): void {
    this.host = stage;
    const c = document.createElement('canvas');
    c.className = 'coach-canvas';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    stage.appendChild(c);
    this.canvas = c;
    this.r = new StageRenderer2D(c, this.style());
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
    return { frameMs: this.frameEma, drawMs: this.drawEma, fps: this.frameEma > 0 ? 1000 / this.frameEma : 0 };
  }

  private resize(): void {
    this.needResize = false;
    if (!this.host || !this.r) return;
    const rect = this.host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    let w = Math.max(1, rect.width) * dpr;
    let h = Math.max(1, rect.height) * dpr;
    const capW = this.deps.isTV ? 1280 : 1920;
    const capH = this.deps.isTV ? 720 : 1080;
    const k = Math.min(1, capW / w, capH / h);
    w *= k;
    h *= k;
    this.r.resize(w, h, true);
    this.frozenDrawn = false;
  }

  frame(timeSec: number, info: FrameInfo): void {
    const wall = performance.now();
    if (this.lastWall) {
      const d = wall - this.lastWall;
      if (d > 0 && d < 500) this.frameEma += (d - this.frameEma) * 0.05;
    }
    this.lastWall = wall;
    if (!this.r) return;
    if (this.needResize) this.resize();
    const style = this.style();
    if (style !== this.r.style) {
      this.r.style = style;
      this.frozenDrawn = false;
    }

    const phase = info.phase;
    if (phase === 'paused' && this.lastPhase === 'paused' && this.frozenDrawn) return; // frozen
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
    this.r.render(this.sk, sc);
    this.frozenDrawn = phase === 'paused';
    const dt = performance.now() - wall;
    this.drawEma += (dt - this.drawEma) * 0.05;
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
function urlCoachStyle(): CoachStyle | null {
  try {
    return typeof location === 'undefined' ? null : parseCoachStyle(new URLSearchParams(location.search).get('coach'));
  } catch {
    return null;
  }
}
