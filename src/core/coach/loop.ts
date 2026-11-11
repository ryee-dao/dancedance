/**
 * A seamless looping plan for one move (preview cards, gallery, tests).
 * Pure TypeScript (no DOM).
 */

import type { MoveInstance } from '../choreo/generator';
import type { Move } from '../choreo/moves';
import type { PlanView } from './animator';

export interface LoopPlan extends PlanView {
  /** Beats in one loop (repeats * span). */
  loopBeats: number;
  move: Move;
}

/**
 * Repeat `move` (alternating sides when it has a mirror, always an even count
 * so travelling moves come back), plus one extra copy so the end of the loop
 * interpolates into its own start.
 */
export function loopPlan(move: Move, period: number, opts: { half?: boolean; mirrorFirst?: boolean; minBeats?: number } = {}): LoopPlan {
  const half = !!opts.half;
  const span = move.beats * (half ? 2 : 1);
  let reps = Math.max(1, Math.ceil((opts.minBeats ?? 8) / span));
  if ((move.mirror || move.travel !== 0) && reps % 2) reps++;
  const instances: MoveInstance[] = [];
  let origin = 0;
  for (let i = 0; i <= reps; i++) {
    const mirror = move.mirror ? (i % 2 === 1) !== !!opts.mirrorFirst : false;
    instances.push({ move, mirror, start: i * span, span, half, origin: i === reps ? 0 : origin, section: 'verse', sig: false, unitStart: i === 0, phrase: 0 });
    origin += move.travel * (mirror ? -1 : 1);
  }
  const grid: number[] = [];
  for (let b = 0; b <= (reps + 1) * span + 1; b++) grid.push(b * period);
  return { grid, instances, period, loopBeats: reps * span, move };
}
