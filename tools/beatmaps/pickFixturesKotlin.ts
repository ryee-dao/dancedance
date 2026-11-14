/// <reference types="node" />
/**
 * Generates android/app/src/test/java/app/dancedance/tv/PickFixtures.kt from
 * pick.fixtures.ts, so the TV picker (SongPicker.kt) is tested on exactly the
 * same real search results as the cloud one. pick.test.ts fails when the
 * Kotlin file is out of date; regenerate with
 *
 *   npx tsx tools/beatmaps/pickFixturesKotlin.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fixtures from './pick.fixtures';
import type { SearchEntry } from './pick';

export const KOTLIN_FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../../android/app/src/test/java/app/dancedance/tv/PickFixtures.kt');

const str = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n')}"`;
const num = (n: number | null) => (n === null ? 'null' : `${n}L`);

export function kotlinFixtures(): string {
  const lists = Object.entries(fixtures as Record<string, SearchEntry[]>)
    .filter(([, v]) => Array.isArray(v))
    .sort(([a], [b]) => a.localeCompare(b));
  let out = `package app.dancedance.tv

// GENERATED from tools/beatmaps/pick.fixtures.ts (real YouTube search results) by
// tools/beatmaps/pickFixturesKotlin.ts. Regenerate rather than edit by hand, so the TV picker is
// tested on the same data as the cloud one (pick.test.ts checks this file is up to date).

import app.dancedance.tv.SongPicker.Entry

object PickFixtures {
`;
  for (const [name, list] of lists) {
    out += `    val ${name}: List<Entry> = listOf(\n`;
    for (const e of list) {
      const live = e.liveStatus === null ? '' : `, ${str(e.liveStatus)}`;
      out += `        Entry(${str(e.id)}, ${str(e.title)}, ${str(e.channel)}, ${e.verified}, ${num(e.views)}, ${num(e.duration)}, ${str(e.description)}${live}),\n`;
    }
    out += `    )\n\n`;
  }
  return `${out}}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(KOTLIN_FIXTURES, kotlinFixtures());
  console.log(`wrote ${KOTLIN_FIXTURES}`);
}
