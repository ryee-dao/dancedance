/**
 * Registry of every family file. Each file exports `patterns` (PatternSet)
 * and `moves` (MoveDef[]); this module registers all patterns first (ids are
 * global, so files can use each other's patterns), then builds every move.
 *
 * Family authors never edit this file: every family file is already listed.
 */

import { buildMove, registerPatterns, type Move, type MoveDef, type PatternSet } from '../catalog';
import * as shared from './shared';
import * as aerobic from './aerobic';
import * as cooldown from './cooldown';
import * as latin from './latin';
import * as disco from './disco';
import * as funk from './funk';
import * as hiphop from './hiphop';
import * as pop from './pop';
import * as rock from './rock';
import * as kpop from './kpop';
import * as party from './party';

export interface FamilyFile {
  patterns: PatternSet;
  moves: MoveDef[];
}

/** Family files by name (the --family argument of tools/moves/check.ts). */
export const FAMILY_FILES: Readonly<Record<string, FamilyFile>> = { shared, aerobic, cooldown, latin, disco, funk, hiphop, pop, rock, kpop, party };

/**
 * Definition errors (duplicate ids, unknown patterns, bad tags), by file. A
 * broken definition is skipped rather than breaking every other file; the
 * catalogue test requires this to be empty.
 */
export const CATALOGUE_ERRORS: { file: string; message: string }[] = [];

for (const [name, f] of Object.entries(FAMILY_FILES)) {
  for (const message of registerPatterns(name, f.patterns ?? {})) CATALOGUE_ERRORS.push({ file: name, message });
}

/** Every catalogue move, in file order. */
export const CATALOGUE: readonly Move[] = (() => {
  const out: Move[] = [];
  const seen = new Map<string, string>();
  for (const [name, f] of Object.entries(FAMILY_FILES)) {
    for (const d of f.moves ?? []) {
      const prev = seen.get(d.id);
      if (prev) {
        CATALOGUE_ERRORS.push({ file: name, message: `Duplicate move id "${d.id}" (first defined in ${prev})` });
        continue;
      }
      try {
        out.push(buildMove(d, name));
        seen.set(d.id, name);
      } catch (e) {
        CATALOGUE_ERRORS.push({ file: name, message: `${d.id}: ${(e as Error).message}` });
      }
    }
  }
  return out;
})();
