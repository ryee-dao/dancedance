/// <reference types="node" />
/**
 * Generates android/app/src/test/java/app/dancedance/tv/CatalogFixtures.kt from
 * src/ui/catalog.fixtures.ts (recorded iTunes and Deezer search answers), so the
 * TV's merge (SongCatalog.kt) is tested on the same data as the web's
 * (songMerge.test.ts fails when the Kotlin file is out of date). Regenerate with
 *
 *   npx tsx tools/beatmaps/catalogFixturesKotlin.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fixtures from '../../src/ui/catalog.fixtures';

export const KOTLIN_CATALOG_FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../../android/app/src/test/java/app/dancedance/tv/CatalogFixtures.kt');

const str = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n')}"`;

export function kotlinCatalogFixtures(): string {
  const list = Object.entries(fixtures as Record<string, unknown>)
    .filter((e): e is [string, fixtures.CatalogFixture] => !!e[1] && typeof e[1] === 'object' && 'term' in (e[1] as object))
    .sort(([a], [b]) => a.localeCompare(b));
  let out = `package app.dancedance.tv

// GENERATED from src/ui/catalog.fixtures.ts (recorded iTunes and Deezer search answers) by
// tools/beatmaps/catalogFixturesKotlin.ts. Regenerate rather than edit by hand (songMerge.test.ts
// checks this file is up to date).

object CatalogFixtures {
    /** One search: the term, iTunes' answer and Deezer's answer, as JSON text. */
    data class Fixture(val term: String, val itunesJson: String, val deezerJson: String)
`;
  for (const [name, f] of list) {
    out += `\n    val ${name} = Fixture(\n        ${str(f.term)},\n        ${str(JSON.stringify(f.itunes))},\n        ${str(JSON.stringify(f.deezer))},\n    )\n`;
  }
  return out + '}\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(KOTLIN_CATALOG_FIXTURES, kotlinCatalogFixtures());
  console.log(`wrote ${KOTLIN_CATALOG_FIXTURES}`);
}
