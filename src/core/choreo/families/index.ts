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
import * as afro from './afro';
import * as retro from './retro';
import * as world from './world';

export interface FamilyFile {
  patterns: PatternSet;
  moves: MoveDef[];
}

/** Family files by name (the --family argument of tools/moves/check.ts). */
export const FAMILY_FILES: Readonly<Record<string, FamilyFile>> = { shared, aerobic, cooldown, latin, disco, funk, hiphop, pop, rock, kpop, party, afro, retro, world };

/**
 * Definition errors (duplicate ids, unknown patterns, bad tags), by file. A
 * broken definition is skipped rather than breaking every other file; the
 * catalogue test requires this to be empty.
 */
export const CATALOGUE_ERRORS: { file: string; message: string }[] = [];

for (const [name, f] of Object.entries(FAMILY_FILES)) {
  for (const message of registerPatterns(name, f.patterns ?? {})) CATALOGUE_ERRORS.push({ file: name, message });
}

/**
 * Moves retired at integration review (kept in their files for reference):
 * they didn't read well enough on the figure, or sat too close to a routine.
 */
export const RETIRED: ReadonlyMap<string, string> = new Map([
  ['backslide', 'reads as heel-up steps in quarter profile, not a glide'],
  ['zombie-shuffle', "author's cut: weak identity from the front"],
  ['rowing', "author's cut: the rowing arms stay by the sides, doesn't read"],
  ['jelly-legs', "author's cut: knee wobble too subtle at tempo"],
  ['hokey-pokey', 'evokes a participation-song sequence; kept out under the sourcing policy'],
  ['carlton', "same move as hiphop's the-carlton (kept that one)"],
  ['back-kick', "author's suggested cut: the heel kick behind reads weakly from the front"],
  ['rocking-chair', "author's suggested cut (written from memory; weak match to the step)"],
  ['time-step', "author's suggested cut: a tap time-step needs sound and fast feet; doesn't read"],
  ['ramwong-hands', "author's suggested cut: the hand motif is too fine for the figure"],
  ['belly-hip-twist', "author's suggested cut: hip twist too subtle from the front"],
  ['do-si-do', 'a partner figure; solo it reads as folded arms walking'],
  ['swing-your-partner', 'a partner figure; solo it is just a turn'],
  ['locomotion', "the train-wheel arms barely move on the figure; doesn't read"],
  ['roll-high', "the arms can't reach a roll above the head; it rolls across the face instead"],
]);

/** Every catalogue move, in file order. */
export const CATALOGUE: readonly Move[] = (() => {
  const out: Move[] = [];
  const seen = new Map<string, string>();
  for (const [name, f] of Object.entries(FAMILY_FILES)) {
    for (const d of f.moves ?? []) {
      if (RETIRED.has(d.id)) continue;
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
