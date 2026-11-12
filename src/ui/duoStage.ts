/**
 * Two-player coach stage: two coaches side by side (P1 left, P2 right)
 * dancing a duo routine (core/choreo/duo.ts) with a duo now / next strip.
 *
 *   createDuoStage(deps)          always two players
 *   createPlayersStage(deps, one) switches between one and two players every
 *                                 frame from deps.getPlayers() / ?players=2
 *
 * Same plan handling as the single stage (the shared Conductor builds and
 * switches the single-player plan, with the same song style / fresh-routine
 * personalisation); DuoTracks turns that plan into two tracks.
 */

import type { BeatSource } from '../beat/beatSource';
import { partnerOf } from '../core/choreo/duoMoves';
import { partnerDepth } from '../core/choreo/duoMoves';
import type { MoveInstance } from '../core/choreo/generator';
import { IDLE_MOVE, READY_POSE } from '../core/choreo/moves';
import { PoseEvaluator, beatPosition, timeOfBeat } from '../core/coach/animator';
import { Conductor } from '../core/coach/conductor';
import { DuoRenderer2D, type DuoCard, type DuoSceneInfo, type DuoStripInfo } from '../core/coach/duoRenderer';
import { DuoTracks, KIND_LABEL, type DuoCue } from '../core/coach/duoTracks';
import { blendPose } from '../core/coach/poses';
import { CH, createPose, createSkeleton, solveSkeleton, type Skeleton } from '../core/coach/skeleton';
import { DEFAULT_COACH_STYLE, parseCoachStyle, type CoachBuild, type CoachStyle } from '../core/coach/styles';
import { WAIT_SPRITE_BUDGET, coachBuildOf, planStart, routineInfo, spritesFor, type CoachStage, type CoachStageDeps, type FrameStats, type RoutineInfo } from './coachStage';
import { SPRITE_BUDGET } from '../core/coach/renderer';
import type { SpriteStats } from '../core/coach/sprites';
import type { FrameInfo } from './play';
import type { GraphicsStats } from '../core/coach/quality';
import { GraphicsMeter, graphicsPrefOf } from './graphics';

export type Players = 1 | 2;

/** `?players=2` on the page URL. */
export function urlPlayers(): Players | null {
  try {
    if (typeof location === 'undefined') return null;
    const v = new URLSearchParams(location.search).get('players');
    return v === '2' ? 2 : v === '1' ? 1 : null;
  } catch {
    return null;
  }
}

export interface DuoStageDeps extends CoachStageDeps {
  /** 1 or 2 players (read every frame). A `?players=` URL parameter wins. */
  getPlayers?: () => Players;
}

type InfoWithBeats = FrameInfo & { beats?: BeatSource | null };

const READY_FADE_SEC = 0.6;
const SWITCH_FADE_SEC = 0.35;

export function createDuoStage(deps: CoachStageDeps): CoachStage {
  return new DuoStageImpl(deps);
}

/** A stage that shows one or two players, following deps.getPlayers() (or ?players=) every frame. */
export function createPlayersStage(deps: DuoStageDeps, single: () => CoachStage): CoachStage {
  return new PlayersStage(deps, single);
}

class PlayersStage implements CoachStage {
  private host: HTMLElement | null = null;
  private cur: CoachStage | null = null;
  private players: Players = 1;
  private readonly url = urlPlayers();
  constructor(private deps: DuoStageDeps, private makeSingle: () => CoachStage) {}

  private want(): Players {
    if (this.url) return this.url;
    try {
      return this.deps.getPlayers?.() === 2 ? 2 : 1;
    } catch {
      return 1;
    }
  }

  private swap(p: Players): void {
    this.cur?.unmount();
    this.players = p;
    this.cur = p === 2 ? createDuoStage(this.deps) : this.makeSingle();
    if (this.host) this.cur.mount(this.host);
  }

  mount(stage: HTMLElement): void {
    this.host = stage;
    this.swap(this.want());
  }
  unmount(): void {
    this.cur?.unmount();
    this.cur = null;
    this.host = null;
  }
  frame(timeSec: number, info: FrameInfo): void {
    const p = this.want();
    if (p !== this.players || !this.cur) this.swap(p);
    this.cur!.frame(timeSec, info);
  }
  frameStats(): FrameStats {
    return this.cur?.frameStats() ?? { frameMs: 16.7, drawMs: 0, fps: 60 };
  }
  graphicsStats(): GraphicsStats {
    return this.cur?.graphicsStats() ?? { frameMs: 16.7, drawMs: 0, drawnFps: 0, tier: 0, tierName: 'Full', resolution: '', reason: '' };
  }
  spriteStats(): SpriteStats | null {
    return this.cur?.spriteStats?.() ?? null;
  }
}

function urlCoachStyle(): CoachStyle | null {
  try {
    return typeof location === 'undefined' ? null : parseCoachStyle(new URLSearchParams(location.search).get('coach'));
  } catch {
    return null;
  }
}

class Thumb {
  ev = new PoseEvaluator();
  pose = createPose();
  sk = createSkeleton();
  inst: MoveInstance | null = null;
  readonly view = { grid: [] as number[], instances: [] as MoveInstance[], period: 0.5 };
}

class DuoStageImpl implements CoachStage {
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private r: DuoRenderer2D | null = null;
  private ro: ResizeObserver | null = null;
  private onWinResize = () => (this.needResize = true);
  private conductor = new Conductor();
  private tracks = new DuoTracks();
  private ev1 = new PoseEvaluator();
  private ev2 = new PoseEvaluator();
  private pose1 = createPose();
  private pose2 = createPose();
  private from1 = createPose();
  private from2 = createPose();
  private fadeStart = -Infinity;
  private drawn = false;
  private ready = createPose();
  private sk1 = createSkeleton();
  private sk2 = createSkeleton();
  private needResize = true;
  private lastPhase = '';
  private playStartWall = 0;
  private frozenDrawn = false;
  private songKey = '';
  private routine: RoutineInfo | null = null;
  private depth: [number, number] = [0, 0];
  private th1 = new Thumb();
  private th2 = new Thumb();
  private nowCard: DuoCard = { shared: true, name1: '', name2: '', sk1: null, sk2: null, pair: false };
  private nextCard: DuoCard = { shared: true, name1: '', name2: '', sk1: null, sk2: null, pair: false };
  private afterCard: DuoCard = { shared: true, name1: '', name2: '', sk1: null, sk2: null, pair: false };
  private strip: DuoStripInfo = { label: '', sig: false, now: this.nowCard, progress: 0, beatsToChange: Infinity, next: null, after: null };
  private scene: DuoSceneInfo = { t: 0, beat: 0, half: false, energy: 0.3, z1: 0, z2: 0, prop: null, strip: null };
  private prop: 'rope' | null = null;
  private hook: 0 | 1 | -1 = 0;
  private readonly meter: GraphicsMeter;
  private readonly urlStyle = urlCoachStyle();
  // Sprite prewarming (as the single stage): upcoming poses of both tracks drawn into the cache.
  private wEv1 = new PoseEvaluator();
  private wEv2 = new PoseEvaluator();
  private wPose1 = createPose();
  private wPose2 = createPose();
  private wSk1 = createSkeleton();
  private wSk2 = createSkeleton();
  private wDepth: [number, number] = [0, 0];
  private warmT = -Infinity;
  private warmView: object | null = null;

  constructor(private deps: CoachStageDeps) {
    this.meter = new GraphicsMeter(deps.isTV, 2, deps.pinTier ?? null);
  }

  spriteStats(): SpriteStats | null {
    return this.r?.sprites?.stats() ?? null;
  }

  /** Sprite tiers: draw both tracks' poses a little ahead into the sprite cache (see CoachStageImpl.prewarm). */
  private prewarm(t: number, waiting: boolean): void {
    const r = this.r;
    const v1 = this.tracks.v1, v2 = this.tracks.v2, plan = this.tracks.plan;
    if (!r?.sprites || !v1 || !v2 || !plan || plan.kind === 'idle') return;
    if (v1 !== this.warmView) {
      this.warmView = v1;
      this.warmT = -Infinity;
    }
    const from = waiting ? planStart(plan) : t + 0.2;
    if (this.warmT < from) this.warmT = from;
    const until = (waiting ? from : t) + (waiting ? 16 : 4);
    const n = waiting ? 8 : 2;
    for (let i = 0; i < n && r.sprites.budget > 0 && this.warmT < until; i++) {
      const wt = this.warmT;
      const e = plan.sectionAt(wt, null).energy;
      this.wEv1.evaluate(v1, wt, this.wPose1, { energy: e });
      this.wEv2.evaluate(v2, wt, this.wPose2, { energy: e });
      this.wDepth[0] = this.wDepth[1] = 0;
      let hook: 0 | 1 | -1 = 0;
      const i1 = this.wEv1.inst(v1, this.wEv1.instIndex);
      const own = partnerOf(i1.move);
      if (own) {
        hook = own.pm.hook;
        const mb = own.part * 4 + (this.wEv1.beat - i1.start) / (i1.half ? 2 : 1);
        partnerDepth(own.pm, mb, this.wPose1[CH.SPIN], this.wPose2[CH.SPIN], this.wDepth);
      }
      solveSkeleton(this.wPose1, this.wSk1);
      solveSkeleton(this.wPose2, this.wSk2);
      r.warm(this.wSk1, this.wSk2, this.wDepth[0], this.wDepth[1], hook, wt);
      this.warmT += 1 / 30;
    }
  }

  private style(): CoachStyle {
    return this.urlStyle ?? parseCoachStyle(this.deps.getStyle?.()) ?? DEFAULT_COACH_STYLE;
  }

  /** P1's version (the chosen one); the renderer gives P2 the other. */
  private build(): CoachBuild {
    return coachBuildOf(this.deps);
  }

  mount(stage: HTMLElement): void {
    this.host = stage;
    stage.classList.add('duo'); // play-screen CSS places DOM panels around the duo strip
    const c = document.createElement('canvas');
    c.className = 'coach-canvas';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    stage.appendChild(c);
    this.canvas = c;
    this.r = new DuoRenderer2D(c, this.style(), this.build());
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
    this.host?.classList.remove('duo');
    this.host = null;
  }

  frameStats(): FrameStats {
    return this.meter.frameStats();
  }

  graphicsStats(): GraphicsStats {
    return this.meter.stats(this.canvas);
  }

  /** Last measured top of the page's bottom HUD (fraction of the height); see hudTopFraction. */
  private hudTop = 0.9;
  private hudCheckAt = 0;

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

  private routineFor(item: FrameInfo['item'], videoId: string, map: { bpm: number; sections: readonly { energy: number }[] } | null): RoutineInfo {
    const ov = this.deps.getStyleOverride?.();
    const k = `${videoId}|${item.title}|${map ? 'map' : 'nomap'}${ov ? `|${JSON.stringify(ov)}` : ''}`;
    if (this.routine && k === this.songKey) return this.routine;
    const sameSong = this.songKey.split('|')[0] === videoId && this.routine;
    const r = routineInfo(item, map, this.deps);
    if (sameSong) {
      r.fresh = this.routine!.fresh;
      r.key = `${r.key.split('|play')[0]}${r.fresh ? `|play${r.fresh}` : ''}`;
    }
    this.songKey = k;
    this.routine = r;
    return r;
  }

  frame(timeSec: number, info: FrameInfo): void {
    const wall = performance.now();
    if (!this.r) return;
    const item0 = info.item;
    const tick = this.meter.tick(wall, graphicsPrefOf(this.deps), info.phase === 'playing', item0.kind === 'youtube' ? item0.videoId : `file:${item0.title}`);
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
    if (phase === 'paused' && this.lastPhase === 'paused' && this.frozenDrawn) return;
    // 30 fps tiers: skip this display frame (the next drawn one reads the audio clock afresh).
    if (!tick.draw && phase === this.lastPhase) return;
    const src = (info as InfoWithBeats).beats ?? null;
    const tl = src ? src.current() : null;
    const item = info.item;
    const videoId = item.kind === 'youtube' ? item.videoId : `file:${item.title}`;
    const intensity = (info as Partial<FrameInfo>).intensity ?? this.deps.getIntensity();
    const t = timeSec;
    if (phase === 'playing' && this.lastPhase !== 'playing' && this.lastPhase !== 'paused') this.playStartWall = wall;
    this.lastPhase = phase;

    const ri = this.routineFor(item, videoId, tl?.map ?? null);
    this.conductor.update(tl, videoId, intensity, t, { style: ri.style, fresh: ri.fresh }, ri.key);
    const plan = this.conductor.plan;
    if (this.tracks.sync(plan, intensity, videoId) && this.drawn) {
      // Plan switch: crossfade from the last drawn poses.
      this.from1.set(this.pose1);
      this.from2.set(this.pose2);
      this.fadeStart = t;
    }
    const sec = this.conductor.sectionAt(t);
    const waiting = phase === 'loading' || phase === 'countdown';

    const br = Math.sin((wall / 1000) * 2.2);
    this.ready.set(READY_POSE);
    this.ready[CH.Y] += br * 0.006;
    this.ready[CH.RA_E] += br * 2;
    this.ready[CH.LA_E] += br * 2;
    this.ready[CH.HEAD_NOD] += br * 1.5;

    const v1 = this.tracks.v1, v2 = this.tracks.v2;
    this.depth[0] = this.depth[1] = 0;
    this.prop = null;
    this.hook = 0;
    if (waiting || !v1 || !v2) {
      this.pose1.set(this.ready);
      this.pose2.set(this.ready);
    } else {
      this.ev1.evaluate(v1, t, this.pose1, { energy: sec.energy });
      this.ev2.evaluate(v2, t, this.pose2, { energy: sec.energy });
      const fw = (t - this.fadeStart) / SWITCH_FADE_SEC;
      if (fw >= 0 && fw < 1) {
        const s = fw * fw * (3 - 2 * fw);
        blendPose(this.from1, this.pose1, s, this.pose1);
        blendPose(this.from2, this.pose2, s, this.pose2);
      }
      const since = (wall - this.playStartWall) / 1000;
      if (since < READY_FADE_SEC && since >= 0) {
        const w = since / READY_FADE_SEC;
        const s = w * w * (3 - 2 * w);
        blendPose(this.ready, this.pose1, s, this.pose1);
        blendPose(this.ready, this.pose2, s, this.pose2);
      }
      // Depth (who passes in front) during partner moves.
      const i1 = this.ev1.inst(v1, this.ev1.instIndex);
      const own = partnerOf(i1.move);
      if (own) {
        this.prop = own.pm.prop;
        this.hook = own.pm.hook;
        const mult = i1.half ? 2 : 1;
        const mb = own.part * 4 + (this.ev1.beat - i1.start) / mult;
        partnerDepth(own.pm, mb, this.pose1[CH.SPIN], this.pose2[CH.SPIN], this.depth);
      }
    }
    if (!waiting) this.drawn = true;
    solveSkeleton(this.pose1, this.sk1);
    solveSkeleton(this.pose2, this.sk2);

    this.updateStrip(t, waiting);

    const sc = this.scene;
    sc.t = waiting ? wall / 1000 : t;
    sc.beat = waiting ? 0 : this.conductor.beat || this.ev1.beat;
    sc.half = !!plan?.half;
    sc.energy = waiting ? 0.25 : sec.energy;
    sc.z1 = this.depth[0];
    sc.z2 = this.depth[1];
    sc.prop = this.prop;
    sc.hook = this.hook;
    sc.strip = this.strip;
    this.r.spriteBudget = this.deps.spriteBudget ?? (waiting || phase === 'paused' ? WAIT_SPRITE_BUDGET : SPRITE_BUDGET);
    this.r.render(this.sk1, this.sk2, sc);
    this.prewarm(t, waiting);
    this.frozenDrawn = phase === 'paused';
    this.meter.drawn(wall, performance.now() - wall);
  }

  private updateStrip(t: number, waiting: boolean): void {
    const s = this.strip;
    const tr = this.tracks;
    const plan = tr.plan;
    const now = this.nowCard;
    s.next = null;
    s.after = null;
    if (waiting || !plan || !tr.v1) {
      now.shared = true;
      now.name1 = now.name2 = 'Get ready';
      s.label = 'TWO PLAYERS';
      s.sig = false;
      s.progress = 0;
      s.beatsToChange = Infinity;
      return;
    }
    const b = beatPosition(tr.v1, t);
    if (tr.cues.length) {
      const k = tr.cueAt(b);
      const cue = k >= 0 ? tr.cues[k] : null;
      if (cue) {
        setCard(now, cue);
        s.label = cue.sig && cue.kind !== 'split' ? 'SONG COMBO' : KIND_LABEL[cue.kind];
        s.sig = cue.sig;
        const t0 = timeOfBeat(tr.v1, cue.start), t1 = timeOfBeat(tr.v1, cue.end);
        s.progress = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
        s.beatsToChange = cue.end - b;
        const nx = tr.cues[k + 1];
        if (nx) {
          setCard(this.nextCard, nx);
          this.thumbs(this.nextCard, nx, b, plan.period);
          s.next = this.nextCard;
          const af = tr.cues[k + 2];
          if (af) {
            setCard(this.afterCard, af);
            this.afterCard.sk1 = this.afterCard.sk2 = null;
            s.after = this.afterCard;
          }
        }
        return;
      }
    }
    // Growing plans (live / idle): P2 mirrors P1, one shared card.
    const up = this.conductor.upcoming(t);
    now.shared = true;
    now.name1 = now.name2 = up.current ? up.current.move.name : IDLE_MOVE.name;
    s.label = 'MIRROR EACH OTHER';
    s.sig = !!up.current?.sig;
    const span = up.changeAt - up.groupStart;
    s.progress = Number.isFinite(span) && span > 0 ? (t - up.groupStart) / span : 0;
    s.beatsToChange = up.beatsToChange;
    if (up.next) {
      const c = this.nextCard;
      c.shared = true;
      c.pair = false;
      c.name1 = c.name2 = up.next.move.name;
      c.sk1 = this.thumb(this.th1, up.next, b, plan.period);
      c.sk2 = null;
      s.next = c;
    }
  }

  private thumbs(card: DuoCard, cue: DuoCue, b: number, period: number): void {
    card.sk1 = this.thumb(this.th1, cue.i1, b, period);
    card.sk2 = card.shared && !card.pair ? null : this.thumb(this.th2, cue.i2, b, period);
  }

  /** A looping preview pose of an upcoming instance (allocation-free once warmed up). */
  private thumb(th: Thumb, inst: MoveInstance, b: number, period: number): Skeleton {
    const v = th.view;
    if (th.inst !== inst || v.period !== period) {
      th.inst = inst;
      v.period = period;
      const pm = partnerOf(inst.move);
      const moves = pm ? (pm.player === 1 ? pm.pm.p1 : pm.pm.p2) : [inst.move];
      v.instances.length = 0;
      let s = 0;
      for (let r = 0; r < 3; r++) {
        for (const m of moves) {
          const mirror = m.mirror ? (r % 2 === 1) !== inst.mirror : false;
          v.instances.push({ ...inst, move: m, mirror, start: s, span: m.beats, half: false, origin: 0 });
          s += m.beats;
        }
      }
      v.grid.length = 0;
      for (let k = 0; k <= s + 1; k++) v.grid.push(k * period);
    }
    const loop = v.instances.length ? (v.instances[v.instances.length - 1].start + v.instances[v.instances.length - 1].span) * (2 / 3) : 4;
    const lb = (((b % loop) + loop) % loop);
    th.ev.evaluate(v, lb * period, th.pose, { energy: 0.5 });
    if (!partnerOf(inst.move)) {
      // Keep travelling moves centred on the card.
      th.pose[CH.X] = 0;
    }
    solveSkeleton(th.pose, th.sk);
    return th.sk;
  }
}

function setCard(c: DuoCard, cue: DuoCue): void {
  c.shared = cue.name1 === cue.name2;
  c.pair = !!cue.partner && c.shared;
  c.name1 = cue.name1;
  c.name2 = cue.name2;
}

/**
 * Top of the play screen's bottom HUD (progress bar + time) as a fraction of
 * the stage height, so the canvas can keep its floor labels and strip above it.
 */
export function hudTopFraction(host: HTMLElement, rect: DOMRect): number {
  const hud = host.parentElement?.querySelector('.hud-bottom');
  if (!hud) return 1; // no HUD on this page (demo bench): nothing to avoid
  const r = hud.getBoundingClientRect();
  if (r.height > 0 && rect.height > 0) return Math.max(0.7, Math.min(1, (r.top - rect.top) / rect.height));
  // Not laid out (yet): estimate from the CSS (root font clamp(16px, 1.15vw, 32px);
  // the HUD is about 4.4rem tall including its bottom offset).
  if (rect.height <= 0 || typeof window === 'undefined') return 0.9;
  const rem = Math.max(16, Math.min(32, window.innerWidth * 0.0115));
  return Math.max(0.7, Math.min(1, 1 - (4.4 * rem) / rect.height));
}
