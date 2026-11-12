/**
 * The coach-dependent half of the graphics test (graphicsTest.ts): the real
 * coach / duo stages driven by a synthetic 120 BPM clock (no audio, no
 * YouTube), and the real figure painter on its own. Lives in the play chunk
 * (exported from playChunk.ts) so the test loads it the same way the play
 * screen does.
 */

import type { Intensity } from '../core/choreo/generator';
import { warmGenerator } from '../core/choreo/generator';
import { findMove } from '../core/choreo/moves';
import { PoseEvaluator } from '../core/coach/animator';
import { loopPlan } from '../core/coach/loop';
import type { Tier } from '../core/coach/quality';
import { FigurePainter } from '../core/coach/renderer';
import { createPose, createSkeleton, solveSkeleton } from '../core/coach/skeleton';
import type { CoachBuild, CoachStyle } from '../core/coach/styles';
import type { SpriteStats } from '../core/coach/sprites';
import { synthMap } from '../demo/synth';
import { createCoachStage, type CoachStage } from './coachStage';
import { createDuoStage } from './duoStage';
import type { FrameInfo } from './play';

const BPM = 120;
/** Where the synthetic song starts: the first chorus (busy moves). */
const START_SEC = 50;

export interface BenchStage {
  mount(host: HTMLElement): void;
  /** One frame at `elapsedSec` since the test started. */
  frame(elapsedSec: number): void;
  unmount(): void;
  /** e.g. "Smooth 1280x720". */
  describe(): string;
  /**
   * Sprite tiers: draw this stretch of the song once with no limit on new
   * sprites (what the countdown's prewarming does for a real song), so the
   * measurement sees the steady state.
   */
  prewarm(fromSec: number, toSec: number): void;
  /** Sprite cache counters (null without sprites). */
  spriteStats(): SpriteStats | null;
}

export interface BenchStageOptions {
  players: 1 | 2;
  tier: Tier;
  isTV: boolean;
  style: CoachStyle;
  build: CoachBuild;
  /** Sprite drawing on / off (default: the tier's). */
  sprites?: boolean;
}

/** Build the routine generator's caches now (they would otherwise fill in idle time during the test). */
export function warmAll(): void {
  const until = performance.now() + 20_000;
  while (!warmGenerator(50) && performance.now() < until) {
    /* keep going */
  }
}

/** The real coach (or duo) stage, pinned to one graphics tier, dancing a fixed routine. */
export function benchStage(o: BenchStageOptions): BenchStage {
  const map = synthMap(BPM, 'gfx-test');
  const timeline = { map, live: null, revision: 1 };
  const deps = {
    getIntensity: (): Intensity => 'cardio',
    isTV: o.isTV,
    getStyle: () => o.style,
    getBuild: () => o.build,
    getRoutineMode: () => 'same' as const,
    getGraphics: () => (o.tier === 0 ? 'full' : 'smooth') as 'full' | 'smooth',
    pinTier: o.tier,
    sprites: o.sprites,
    spriteBudget: undefined as number | undefined,
  };
  const stage: CoachStage = o.players === 2 ? createDuoStage(deps) : createCoachStage(deps);
  const info: FrameInfo = {
    phase: 'playing',
    playing: true,
    duration: map.duration,
    item: { kind: 'youtube', videoId: 'gfx-test', title: 'Graphics test', artist: 'DanceDance' },
    beats: { current: () => timeline },
    intensity: 'cardio',
    audioOffsetMs: 0,
  };
  return {
    mount: (host) => stage.mount(host),
    frame: (sec) => stage.frame(START_SEC + sec, info),
    unmount: () => stage.unmount(),
    describe: () => {
      const g = stage.graphicsStats();
      return `${g.tierName} ${g.resolution}`;
    },
    prewarm: (fromSec, toSec) => {
      deps.spriteBudget = Infinity;
      for (let t = fromSec; t < toSec; t += 1 / 60) stage.frame(START_SEC + t, info);
      deps.spriteBudget = undefined;
    },
    spriteStats: () => stage.spriteStats?.() ?? null,
  };
}

/** The real figure painter alone (one coach, the "step-clap" move), for the path / clip rows. */
export function benchFigure(style: CoachStyle, build: CoachBuild): (ctx: CanvasRenderingContext2D, w: number, h: number, sec: number) => void {
  const move = findMove('step-clap') ?? findMove('march');
  const plan = move ? loopPlan(move, 60 / BPM) : null;
  const painter = new FigurePainter();
  painter.style = style;
  painter.build = build;
  const ev = new PoseEvaluator();
  const pose = createPose();
  const sk = createSkeleton();
  return (ctx, w, h, sec) => {
    if (!plan) throw new Error('no preview move');
    const loopSec = plan.loopBeats * plan.period;
    ev.evaluate(plan, sec % loopSec, pose);
    solveSkeleton(pose, sk);
    painter.draw(ctx, sk, w / 2, h * 0.92, h * 0.6, sec, { shadow: true });
  };
}
