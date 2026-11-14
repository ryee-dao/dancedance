/// <reference types="node" />
/**
 * Print a results.json (tools/eval/run.ts --stage eval) as a markdown table,
 * with verdict counts by half (known / obscure) and by evidence strength, and
 * per-song level detail.
 *
 *   npx tsx tools/eval/report.ts results.json [--detail]
 */
import { readFileSync } from 'node:fs';
import type { ResultsFile, SongResult } from './common';

const path = process.argv[2];
if (!path) {
  console.error('usage: tools/eval/report.ts results.json [--detail]');
  process.exit(1);
}
const file = JSON.parse(readFileSync(path, 'utf8')) as ResultsFile;
const pct = (x: number) => `${Math.round(100 * x)}%`;
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ');
const KEY_TRAITS = ['calm', 'drive', 'fourFloor', 'halfFeel', 'heavy', 'swing', 'syncop', 'bass', 'hats'];
const SHORT: Record<string, string> = { calm: 'calm', drive: 'drv', fourFloor: '4f', halfFeel: 'half', heavy: 'hvy', swing: 'swg', syncop: 'syn', bass: 'bass', hats: 'hat', minor: 'min' };

function traitsCell(r: SongResult): string {
  if (!r.traits) return '';
  return KEY_TRAITS.map((k) => `${SHORT[k]} ${(r.traits![k] ?? 0).toFixed(2)}`).join(', ');
}

const rows = file.results.map((r, i) => {
  const e = r.expectation;
  const exp = e?.consensus?.line ?? (e?.memory ? `memory: ${[e.memory.family, e.memory.sub, e.memory.energy].filter(Boolean).join(' / ')}` : 'unknown to judge');
  const style = r.style ? `${r.style.label} (calm ${r.style.calm ?? '?'}); opens ${r.style.open.join(', ') || 'none'}` : r.status;
  return `| ${i + 1} | ${cell(r.song.artist)} | ${cell(r.song.title)} | ${r.song.half} | ${r.song.genre ?? ''} | ${r.bpm?.toFixed(0) ?? ''} | ${traitsCell(r)} | ${cell(style)} | ${cell(exp)} | ${e?.evidence ?? ''} | ${r.verdict?.verdict ?? ''} | ${cell(r.verdict?.reason ?? r.message ?? '')} |`;
});
console.log('| # | Artist | Title | Half | iTunes genre | BPM | Key traits | Label; sets opened | Consensus | Evidence | Verdict | Reason |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);

const counts = (pred: (r: SongResult) => boolean) => {
  const c: Record<string, number> = { right: 0, acceptable: 0, wrong: 0, unjudged: 0 };
  for (const r of file.results) if (pred(r) && r.status === 'ok') c[r.verdict?.verdict ?? 'unjudged']++;
  return `right ${c.right}, acceptable ${c.acceptable}, wrong ${c.wrong}, unjudged ${c.unjudged}`;
};
console.log('');
console.log(`All:      ${counts(() => true)}`);
console.log(`Known:    ${counts((r) => r.song.half === 'known')}`);
console.log(`Obscure:  ${counts((r) => r.song.half === 'obscure')}`);
for (const ev of ['several', 'single', 'none'] as const) console.log(`Evidence ${ev}: ${counts((r) => r.expectation?.evidence === ev)}`);
console.log(`Not fetched / not found: ${file.results.filter((r) => r.status !== 'ok').length}`);

// --- Pass B (looked-up genre list), when present
if (file.results.some((r) => r.b)) {
  console.log('\n| # | Artist | Title | Looked-up genres | A label | B label; sets opened | A | B | B reason |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  file.results.forEach((r, i) => {
    if (!r.b) return;
    const bl = r.b.style ? `${r.b.style.label} (calm ${r.b.style.calm ?? '?'}); opens ${r.b.style.open.join(', ') || 'none'}` : 'no list: same as A';
    console.log(`| ${i + 1} | ${cell(r.song.artist)} | ${cell(r.song.title)} | ${cell(r.b.genres.join(', ') || '-')} | ${cell(r.style?.label ?? r.status)} | ${cell(bl)} | ${r.verdict?.verdict ?? ''} | ${r.b.verdict?.verdict ?? ''} | ${cell(r.b.verdict?.reason ?? '')} |`);
  });
  const rank: Record<string, number> = { wrong: 0, acceptable: 1, right: 2 };
  let up = 0, same = 0, down = 0;
  for (const r of file.results) {
    const a = rank[r.verdict?.verdict ?? ''], b = rank[r.b?.verdict?.verdict ?? ''];
    if (a === undefined || b === undefined) continue;
    if (b > a) up++;
    else if (b < a) down++;
    else same++;
  }
  console.log(`\nB vs A: improved ${up}, same ${same}, worse ${down}`);
  const bCounts = (pred: (r: SongResult) => boolean) => {
    const c: Record<string, number> = { right: 0, acceptable: 0, wrong: 0, unjudged: 0 };
    for (const r of file.results) if (pred(r) && r.status === 'ok') c[r.b?.verdict?.verdict ?? 'unjudged']++;
    return `right ${c.right}, acceptable ${c.acceptable}, wrong ${c.wrong}, unjudged ${c.unjudged}`;
  };
  console.log(`B all:     ${bCounts(() => true)}`);
  console.log(`B known:   ${bCounts((r) => r.song.half === 'known')}`);
  console.log(`B obscure: ${bCounts((r) => r.song.half === 'obscure')}`);
  for (const ev of ['several', 'single', 'none'] as const) console.log(`B evidence ${ev}: ${bCounts((r) => r.expectation?.evidence === ev)}`);
  console.log('\nLookup hit rate per source (found / none / failed), all sampled songs:');
  for (const half of ['known', 'obscure'] as const) {
    const rs = file.results.filter((r) => r.song.half === half && r.b);
    const ids = [...new Set(rs.flatMap((r) => Object.keys(r.b!.said)))];
    const parts = ids.map((id) => {
      const st = rs.map((r) => (r.b!.said[id] ?? '?').split(':')[0]);
      const f = st.filter((x) => x === 'found').length;
      return `${id} ${f}/${st.filter((x) => x === 'none').length}/${st.filter((x) => x === 'failed').length} (${Math.round((100 * f) / Math.max(1, rs.length))}%)`;
    });
    console.log(`  ${half} (${rs.length}): ${parts.join('; ')}; with a list: ${rs.filter((r) => r.b!.genres.length).length}`);
  }
}

if (process.argv.includes('--detail')) {
  for (const r of file.results) {
    if (r.status !== 'ok' || !r.style || !r.levels) continue;
    console.log(`\n## ${r.song.artist} - ${r.song.title} [${r.song.genre}] ${r.bpm?.toFixed(1)} BPM${r.halfCount ? ' (half-time count)' : ''}`);
    console.log(`video ${r.video?.id} ${r.video?.tier} "${r.video?.title}"`);
    console.log(`traits ${JSON.stringify(r.traits)}`);
    console.log(`style ${r.style.label} | source ${r.style.source} | calm ${r.style.calm} | families ${JSON.stringify(r.style.families)} | subs ${JSON.stringify(r.style.subs ?? {})} | themes ${r.style.themes.join(',')} | open ${JSON.stringify(r.style.openness)}`);
    const lv = (levels: NonNullable<SongResult['levels']>, tag: string) => {
      for (const l of levels) {
        console.log(`  ${tag}${l.level.padEnd(6)} genre ${pct(l.genreShare)} ${JSON.stringify(l.genreBeats)} | half ${pct(l.halfInstances)} inst / ${pct(l.halfBeats)} beats | jump ${pct(l.jumpShare)} | high ${pct(l.highShare)} | ${l.distinctMoves} moves`);
        console.log(`         ${l.top.map((t) => `${t.name} (${t.tier}) ${t.beats}`).join('; ')}`);
      }
    };
    lv(r.levels, '');
    if (r.b) {
      console.log(`B genres [${r.b.genres.join(', ')}]  said ${JSON.stringify(r.b.said)}`);
      if (r.b.style && r.b.levels) {
        console.log(`B style ${r.b.style.label} | source ${r.b.style.source} | calm ${r.b.style.calm} | families ${JSON.stringify(r.b.style.families)} | subs ${JSON.stringify(r.b.style.subs ?? {})} | themes ${r.b.style.themes.join(',')} | open ${JSON.stringify(r.b.style.openness)}`);
        lv(r.b.levels, 'B ');
      }
    }
  }
}
