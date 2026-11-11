/**
 * The validated move pool the generator draws from: the base catalogue plus
 * the variations listed in pool.json (precomputed by tools/moves/pool.ts:
 * every listed variation passed validate.ts, and the counted ones the
 * uniqueness check). At runtime the specs are only BUILT, lazily on first
 * use, so a weak TV chip never validates anything. Pure TypeScript (no DOM).
 */

import type { Move } from './catalog';
import { MOVES } from './moves';
import { buildVariation, isCounted, type VariationSpec, type VariationType } from './variations';
import data from './pool.json';

export interface PoolFile {
  /** catalogueHash() of the catalogue the pool was computed from. */
  catalogueHash: string;
  threshold: number;
  /** [id, base, type, foot?, arms?] */
  variations: string[][];
  stats?: Record<string, unknown>;
}

export interface MovePool {
  /** Base moves + counted variations (each a distinct move to copy). */
  moves: readonly Move[];
  /** Counted variations only. */
  variations: readonly Move[];
  /** Ornamented versions of base moves (built lazily per base move, then cached). */
  ornaments: Ornaments;
  /** Specs that no longer build (the catalogue changed since pool.json). */
  skipped: number;
  /** Build time (ms). */
  buildMs: number;
}

/** Ornaments by base move id, built on first request (they are only needed when picked). */
export class Ornaments {
  private built = new Map<string, readonly Move[]>();
  constructor(private specs: ReadonlyMap<string, readonly VariationSpec[]>) {}
  get(base: string): readonly Move[] {
    let list = this.built.get(base);
    if (!list) {
      const out: Move[] = [];
      for (const v of this.specs.get(base) ?? []) {
        try {
          out.push(buildVariation(v));
        } catch {
          // The catalogue changed since pool.json: skip.
        }
      }
      this.built.set(base, (list = out));
    }
    return list;
  }
  /** Every ornament (builds them all: dev tools / tests). */
  all(): Move[] {
    return [...this.specs.keys()].flatMap((b) => this.get(b));
  }
  get count(): number {
    let n = 0;
    for (const l of this.specs.values()) n += l.length;
    return n;
  }
}

let pool: MovePool | null = null;

export function poolSpecs(file: PoolFile = data as unknown as PoolFile): VariationSpec[] {
  return file.variations.map(([id, base, type, foot, arms]) => ({ id, base, type: type as VariationType, ...(foot ? { foot } : {}), ...(arms ? { arms } : {}) }));
}

/** The pool (built once, on first use). */
export function getPool(): MovePool {
  if (pool) return pool;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const variations: Move[] = [];
  const orn = new Map<string, VariationSpec[]>();
  let skipped = 0;
  for (const v of poolSpecs()) {
    if (!isCounted(v.type)) {
      let list = orn.get(v.base);
      if (!list) orn.set(v.base, (list = []));
      list.push(v);
      continue;
    }
    try {
      variations.push(buildVariation(v));
    } catch {
      skipped++;
    }
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  pool = { moves: [...MOVES, ...variations], variations, ornaments: new Ornaments(orn), skipped, buildMs: t1 - t0 };
  return pool;
}

/** Any move by id: catalogue, counted variation or ornament. */
export function findPoolMove(id: string): Move | undefined {
  const p = getPool();
  return p.moves.find((m) => m.id === id) ?? p.ornaments.get(id.split('~')[0]).find((m) => m.id === id);
}

/** Forget the built pool (tests). */
export function resetPool(): void {
  pool = null;
}

/** Stable hash of the base catalogue (ids, layers, keyframes), to spot a stale pool.json. */
export function catalogueHash(moves: readonly Move[] = MOVES): string {
  let h = 0x811c9dc5;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  for (const m of moves) {
    mix(`${m.id}|${m.foot}|${m.arms}|${m.accent}|${m.beats}|${m.level}|${m.difficulty}|${m.families.join(',')}`);
    for (const t of m.tracks) for (const k of t.keys) {
      mix(String(k.at));
      for (let c = 0; c < k.pose.length; c++) mix((Math.round(k.pose[c] * 1000) / 1000).toString());
    }
  }
  return (h >>> 0).toString(16);
}
