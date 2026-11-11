/**
 * The move catalogue: every base move, built from the family files
 * (families/*.ts) by families/index.ts. Pure TypeScript (no DOM).
 *
 * Every move is defined from the USER's point of view: `r` is the user's
 * right, which the mirror-style coach shows on the screen-right side.
 * See catalog.ts for the Move format and AUTHORING.md for how to add moves.
 */

import { pose } from '../coach/poses';
import { NEUTRAL } from '../coach/poses';
import { CH, type Pose } from '../coach/skeleton';
import { buildLayered, parseTags, type Difficulty, type Level, type Move, type MoveKey } from './catalog';
import { CATALOGUE, CATALOGUE_ERRORS } from './families/index';

export type { BodyPart, Difficulty, Level, Move, MoveKey, Track } from './catalog';

export const MOVES: readonly Move[] = CATALOGUE;
export { CATALOGUE_ERRORS };

const BY_ID = new Map<string, Move>();
for (const m of MOVES) BY_ID.set(m.id, m);

export function getMove(id: string): Move {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}

export function findMove(id: string): Move | undefined {
  return BY_ID.get(id);
}

/** The neutral groove / filler. */
export const IDLE_MOVE: Move = MOVES.find((m) => m.idle) ?? MOVES[0];

/** A relaxed "ready" stance used during loading / countdown. */
export const READY_POSE: Pose = pose({ y: -0.015, r: [14, 10, 40, 70], l: [14, 10, 40, 70], handR: 0.3, handL: 0.3 });

/** Composite keys of a move for a given side. */
export function keysOf(m: Move, mirror: boolean): readonly MoveKey[] {
  return mirror && m.mirror ? m.mirrorKeys : m.keys;
}

/** Keys of one group track for a given side. */
export function trackKeys(m: Move, g: number, mirror: boolean): readonly MoveKey[] {
  const t = m.tracks[g];
  return mirror && m.mirror ? t.mirrorKeys : t.keys;
}

/** Compose an ad-hoc layered move (dev tools / tests; not in the catalogue). */
export function composeMove(footId: string, armsId: string, o: { accent?: string; shift?: number; level?: Level; d?: Difficulty } = {}): Move {
  return buildLayered(
    { id: `${footId}+${armsId}`, name: `${footId} + ${armsId}`, file: 'adhoc', tags: parseTags('adhoc', 'pop | full |'), level: o.level ?? 'mid', difficulty: o.d ?? 2 },
    { foot: footId, arms: armsId, accent: o.accent, shift: o.shift },
  );
}

export { NEUTRAL, CH };
