/**
 * Flow checks: how fast a dancer's root travels from one move into the next.
 * Pure TypeScript (no DOM). Used by the tests (and tools) to hold the
 * routine to MAX_ROOT_SPEED; the generator and duo.ts keep to it by
 * construction (travel pairs, drift walks, partner moves that join).
 */

import { CH } from '../coach/skeleton';
import { beatSeconds, rootOffset } from './cards';
import type { MoveInstance } from './generator';

/** Floor units per beat a dancer covers walking in to a partner move / back out (duo.ts placeTrack). */
export const WALK_SPEED = 0.16;
/**
 * Fastest a dancer's root may move from one move into the next: floor units
 * per song beat and per second (the catalogue's quickest authored step,
 * the skater's, is 0.3 a beat). For scale, the two duo home spots are 1 apart.
 */
export const MAX_ROOT_SPEED = 0.32;
export const MAX_ROOT_SPEED_SEC = 0.8;

export interface RootStep {
  /** Song beats of the two keys. */
  from: number;
  to: number;
  /** Floor units moved per song beat and per second. */
  perBeat: number;
  perSec: number;
  a: MoveInstance;
  b: MoveInstance;
}

/** What a key belongs to: one base move (its repeats, parts and variations); duo.ts adds partner moves (both halves one). */
export type Owner = (i: MoveInstance) => string;
const byBase: Owner = (i) => i.move.base;

/**
 * The root's steps across every change of move on a track: from the last
 * body key of one move to the first key of the next (the animator's view,
 * a late last key skipped as it does), with the floor x including origins
 * and drifts. Steps inside one move are the move's own (authored) and left out.
 */
export function transitionSteps(ins: readonly MoveInstance[], times: readonly number[], owner: Owner = byBase): RootStep[] {
  const pts: { b: number; x: number; i: MoveInstance }[] = [];
  for (let n = 0; n < ins.length; n++) {
    const i = ins[n];
    const mult = i.half ? 2 : 1;
    const ks = i.move.tracks[0][i.mirror && i.move.mirror ? 'mirrorKeys' : 'keys'];
    const next = ins[n + 1];
    for (let k = 0; k < ks.length; k++) {
      // The animator skips a late last key (< half a beat before the end) when a different move follows.
      if (k > 0 && k === ks.length - 1 && ks[k].at > i.move.beats - 0.5 + 1e-9 && next && next.move !== i.move) continue;
      pts.push({ b: i.start + ks[k].at * mult, x: ks[k].pose[CH.X] + rootOffset(i, ks[k].at), i });
    }
  }
  const out: RootStep[] = [];
  for (let k = 1; k < pts.length; k++) {
    const p = pts[k - 1], q = pts[k];
    if (p.i === q.i || owner(p.i) === owner(q.i) || q.b <= p.b) continue;
    const dx = Math.abs(q.x - p.x);
    out.push({ from: p.b, to: q.b, perBeat: dx / (q.b - p.b), perSec: dx / Math.max(1e-6, beatSeconds(times, p.b, q.b)), a: p.i, b: q.i });
  }
  return out;
}

/**
 * Close every too-fast step from one move into the next (two moves whose end
 * and start poses stand apart, a slide that ends off its spot): the move
 * before it drifts over its own length toward where the next one starts
 * (or, when that one is a partner move's half, the next one drifts in from
 * where the last left off; `anchored`: instances keyed where they must be,
 * partner moves). In place.
 */
export function smoothSteps(ins: MoveInstance[], times: readonly number[], owner: Owner = byBase, anchored: (i: MoveInstance) => boolean = () => false): void {
  for (let pass = 0; pass < 3; pass++) {
    const steps = transitionSteps(ins, times, owner).filter((s) => s.perBeat > MAX_ROOT_SPEED * 0.9 || s.perSec > MAX_ROOT_SPEED_SEC * 0.9);
    if (!steps.length) return;
    for (const s of steps) {
      const ka = ins.indexOf(s.a);
      const kb = ins.indexOf(s.b);
      if (ka < 0 || kb < 0) continue;
      const dx = endX(s.b, false) - endX(s.a, true);
      if (!anchored(s.a)) ins[ka] = { ...s.a, drift: (s.a.drift ?? 0) + dx };
      else if (!anchored(s.b)) ins[kb] = { ...s.b, origin: s.b.origin - dx, drift: (s.b.drift ?? 0) + dx };
    }
  }
}

/** Floor x of an instance's first / last body key. */
function endX(i: MoveInstance, last: boolean): number {
  const ks = i.move.tracks[0][i.mirror && i.move.mirror ? 'mirrorKeys' : 'keys'];
  const k = last ? ks[ks.length - 1] : ks[0];
  return k.pose[CH.X] + rootOffset(i, k.at);
}
