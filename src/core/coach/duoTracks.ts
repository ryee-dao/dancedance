/**
 * Duo tracks: the two players' plan views on top of the conductor's active
 * plan, plus the now / next cues for the strip. Pure TypeScript (no DOM).
 *
 *   - map plans (full routine known): the duo routine (choreo/duo.ts) built
 *     once from the plan's single-player routine;
 *   - live / idle / partial plans (instances still growing): P2 mirrors P1
 *     (mirror-unison), appended as P1's instances grow.
 */

import type { Intensity, MoveInstance } from '../choreo/generator';
import { duoFromRoutine, mirrorInstance, type DuoKind, type DuoRoutine } from '../choreo/duo';
import { partnerOf, type PartnerMove } from '../choreo/duoMoves';
import type { Move } from '../choreo/moves';
import type { PlanView } from './animator';
import type { Plan } from './conductor';

export interface DuoCue {
  start: number;
  end: number;
  /** Representative instance of each player (first of the cue). */
  i1: MoveInstance;
  i2: MoveInstance;
  name1: string;
  name2: string;
  kind: DuoKind;
  sig: boolean;
  partner: PartnerMove | null;
}

class View implements PlanView {
  instances: MoveInstance[] = [];
  constructor(private plan: Plan) {}
  get grid(): readonly number[] {
    return this.plan.grid;
  }
  get period(): number {
    return this.plan.period;
  }
}

export class DuoTracks {
  plan: Plan | null = null;
  v1: View | null = null;
  v2: View | null = null;
  routine: DuoRoutine | null = null;
  cues: DuoCue[] = [];
  private mapped = 0;
  private full = false;

  /** Follow the conductor's active plan. Returns true when the plan changed. */
  sync(plan: Plan | null, intensity: Intensity, seedKey: string): boolean {
    if (!plan) return false;
    let changed = false;
    if (plan !== this.plan) {
      changed = true;
      this.plan = plan;
      this.v1 = new View(plan);
      this.v2 = new View(plan);
      this.mapped = 0;
      this.cues = [];
      this.routine = null;
      this.full = plan.kind === 'map' && plan.liveFrom === Infinity && plan.instances.length > 0;
      if (this.full) {
        const end = plan.instances[plan.instances.length - 1];
        this.routine = duoFromRoutine({ instances: plan.instances, signature: plan.signature, half: plan.half, beats: end.start + end.span }, { seedKey: `${seedKey}|${plan.key}`, intensity });
        this.v1.instances = this.routine.p1;
        this.v2.instances = this.routine.p2;
        this.cues = buildCues(this.routine);
      }
    }
    if (!this.full) {
      // Growing plan: P1 = the plan, P2 = its mirror image.
      this.v1!.instances = plan.instances;
      const src = plan.instances;
      const out = this.v2!.instances;
      while (this.mapped < src.length) out.push(mirrorInstance(src[this.mapped++]));
    }
    return changed;
  }

  /** Index of the cue covering beat b (-1 = none). */
  cueAt(b: number): number {
    const c = this.cues;
    let lo = 0;
    let hi = c.length - 1;
    if (hi < 0 || b < c[0].start || b >= c[hi].end) return -1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (c[mid].start <= b) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}

function nameOf(m: Move): string {
  return m.name;
}

/** Strip cues: consecutive beats where both players' move names stay the same. */
export function buildCues(r: DuoRoutine): DuoCue[] {
  const cuts = new Set<number>();
  for (const i of r.p1) cuts.add(i.start);
  for (const i of r.p2) cuts.add(i.start);
  const starts = [...cuts].sort((a, b) => a - b);
  const end = Math.max(r.p1.length ? r.p1[r.p1.length - 1].start + r.p1[r.p1.length - 1].span : 0, r.p2.length ? r.p2[r.p2.length - 1].start + r.p2[r.p2.length - 1].span : 0);
  const out: DuoCue[] = [];
  let a = 0, b = 0, ph = 0;
  for (const s of starts) {
    while (a + 1 < r.p1.length && r.p1[a + 1].start <= s) a++;
    while (b + 1 < r.p2.length && r.p2[b + 1].start <= s) b++;
    while (ph + 1 < r.phrases.length && r.phrases[ph + 1].start <= s) ph++;
    const i1 = r.p1[a], i2 = r.p2[b];
    if (!i1 || !i2) continue;
    const pm = partnerOf(i1.move)?.pm ?? null;
    const n1 = nameOf(i1.move), n2 = nameOf(i2.move);
    const kind = r.phrases[ph]?.kind ?? 'unison';
    const last = out[out.length - 1];
    if (last && last.name1 === n1 && last.name2 === n2 && last.sig === (i1.sig || i2.sig) && last.partner === pm) continue;
    if (last) last.end = s;
    out.push({ start: s, end, i1, i2, name1: n1, name2: n2, kind, sig: i1.sig || i2.sig, partner: pm });
  }
  // Fold blips shorter than 2 beats (canon lead-ins, groove fills) into the next cue.
  for (let k = out.length - 2; k >= 0; k--) {
    if (out[k].end - out[k].start < 2) {
      out[k + 1].start = out[k].start;
      out.splice(k, 1);
    }
  }
  return out;
}

export const KIND_LABEL: Readonly<Record<DuoKind, string>> = {
  unison: 'TOGETHER',
  chase: 'CHASE · SAME WAY',
  mirror: 'MIRROR EACH OTHER',
  complement: 'DIFFERENT MOVES',
  call: 'CALL & RESPONSE',
  canon: 'CANON · P2 FOLLOWS',
  split: 'SONG COMBO · SWAP ROLES',
  partner: 'PARTNER MOVE',
  trade: 'TRADE PLACES',
};
