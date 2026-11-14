/// <reference types="node" />
/**
 * Real-music regression checks without audio: the trait statistics the
 * analyser recorded from real songs (tools/eval/stats.ts; data/<set>/stats.json)
 * are re-mapped with the current traitsFromStats and scored against each
 * song's researched audio target (tools/eval/audio.ts rules). The tempo and
 * beat counts are as recorded (they change only when the recording is redone).
 *
 * Sets: run-20261113 (the tuning set), heldout-20261114 (drawn with another
 * seed and researched before analysis; not tuned on), famous14 (the songs the
 * traits were first calibrated on, with codec variants: .140 = AAC 128 kbps,
 * .249 = Opus ~50 kbps, .251 = Opus ~160 kbps).
 *
 * The floors are the analyser 1.4.0 results; a change that lowers one should
 * explain why in the commit.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANALYZER_VERSION } from '../../src/core/analysis';
import { traitsFromStats, type SongTraits } from '../../src/core/analysis/traits';
import { score, summarise, type Score } from './audio';
import type { AudioTarget } from './common';
import type { RecordedStats } from './stats';

const DATA = join(__dirname, 'data');

function load(set: string, targetsFile: string) {
  const stats = JSON.parse(readFileSync(join(DATA, set, 'stats.json'), 'utf8')) as RecordedStats;
  if (stats.analyzerVersion !== ANALYZER_VERSION) console.warn(`[realmusic] ${set}/stats.json was recorded with analyser ${stats.analyzerVersion}, current ${ANALYZER_VERSION}: re-record with tools/eval/stats.ts`);
  const raw = JSON.parse(readFileSync(join(DATA, set, targetsFile), 'utf8')) as Record<string, unknown>;
  const targets: Record<string, AudioTarget> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_') || !v || typeof v !== 'object') continue;
    const e = v as { audio?: AudioTarget; evidence?: string };
    if ('evidence' in e) {
      if (e.audio && e.evidence !== 'none') targets[k] = e.audio;
    } else targets[k] = v as AudioTarget;
  }
  const traits: Record<string, SongTraits> = {};
  const scores: Score[] = [];
  for (const [k, s] of Object.entries(stats.songs)) {
    traits[k] = traitsFromStats(s.stats);
    const t = targets[k] ?? targets[k.split('.')[0]];
    if (t) scores.push(score(k, t, { bpm: s.bpm, beats: s.beats, traits: traits[k] as unknown as Record<string, number> }));
  }
  return { traits, scores, summary: summarise(scores) };
}

const frac = (s: string) => s.split('/').map(Number) as [number, number];
const atLeast = (s: string, n: number) => {
  const [ok, of] = frac(s);
  expect(ok, `${s}`).toBeGreaterThanOrEqual(n);
  return of;
};

describe.skipIf(!existsSync(join(DATA, 'run-20261113', 'stats.json')))('real music: the tuning set (run-20261113)', () => {
  const { summary } = load('run-20261113', 'audio-targets.json');
  it('character, tempo and beat grids', () => {
    console.log(`[realmusic] tuning ${JSON.stringify(summary)}`);
    // Analyser 1.3.0: character 20/30, tempo 7/11, grid 26/28.
    atLeast(summary.character, 27);
    atLeast(summary.tempoOrCandidate, 10);
    atLeast(summary.grid, 28);
  });
});

describe.skipIf(!existsSync(join(DATA, 'heldout-20261114', 'stats.json')))('real music: the held-out set (heldout-20261114)', () => {
  const { summary } = load('heldout-20261114', 'expectations.json');
  it('character, tempo and beat grids', () => {
    console.log(`[realmusic] held-out ${JSON.stringify(summary)}`);
    // Analyser 1.3.0: character 13/16, tempo 7/10, grid 15/16.
    atLeast(summary.character, 13);
    atLeast(summary.tempo, 8);
    atLeast(summary.grid, 15);
  });
});

describe.skipIf(!existsSync(join(DATA, 'famous14', 'stats.json')))('real music: the famous songs (famous14)', () => {
  const { traits, summary } = load('famous14', 'audio-targets.json');
  const each = (name: string, f: (t: SongTraits, key: string) => void) => {
    const keys = Object.keys(traits).filter((k) => k.split('.')[0] === name);
    expect(keys.length, name).toBeGreaterThan(0);
    for (const k of keys) f(traits[k], k);
  };
  it('every song reads the character it is known for, in every codec', () => {
    console.log(`[realmusic] famous ${JSON.stringify(summary)}`);
    each('myimmortal', (t, k) => expect(t.calm, k).toBeGreaterThanOrEqual(0.9));
    each('someonelikeyou', (t, k) => expect(t.calm, k).toBeGreaterThanOrEqual(0.9));
    for (const n of ['bringmetolife', 'faint']) {
      each(n, (t, k) => {
        expect(t.calm, k).toBeLessThanOrEqual(0.2);
        expect(t.heavy, k).toBeGreaterThanOrEqual(0.5);
        expect(t.intensity!, k).toBeGreaterThanOrEqual(0.8);
      });
    }
    each('billiejean', (t, k) => expect(t.calm, k).toBeLessThanOrEqual(0.2));
    each('maskoff', (t, k) => expect(t.halfFeel, k).toBeGreaterThanOrEqual(0.7));
    each('scarymonsters', (t, k) => expect(t.halfFeel, k).toBeGreaterThanOrEqual(0.5));
    each('stayinalive', (t, k) => expect(t.fourFloor, k).toBeGreaterThanOrEqual(0.7));
    each('inthemood', (t, k) => expect(t.swing, k).toBeGreaterThanOrEqual(0.7));
    // Not heavy: bright pop, disco, EDM, reggaeton, hip-hop.
    for (const n of ['billiejean', 'stayinalive', 'wefoundlove', 'gasolina', 'essence', 'maskoff']) each(n, (t, k) => expect(t.heavy, k).toBeLessThanOrEqual(0.1));
    atLeast(summary.character, 20);
    atLeast(summary.tempo, 14);
  });
  it('codec variants of the same song agree', () => {
    for (const n of ['bringmetolife', 'myimmortal', 'maskoff', 'wefoundlove']) {
      const ks = Object.keys(traits).filter((k) => k.split('.')[0] === n);
      for (const key of ['calm', 'intensity', 'drive', 'halfFeel', 'fourFloor', 'bass'] as const) {
        const vs = ks.map((k) => traits[k][key] ?? 0);
        // 0.2: My Immortal's 160 kbps upload gets no beat grid (the others do), which moves its drive by 0.2.
        expect(Math.max(...vs) - Math.min(...vs), `${n} ${key}`).toBeLessThanOrEqual(0.2);
      }
    }
  });
});
