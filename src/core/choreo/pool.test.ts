import { describe, expect, it } from 'vitest';
import { hashString } from './generator';
import { MOVES } from './moves';
import { catalogueHash, getPool, poolSpecs } from './pool';
import data from './pool.json';
import { UNIQUE_THRESHOLD, VARIATION_THRESHOLD, motionSignature, moveDistance } from './similarity';
import { checkKeys, checkPlayback } from './validate';
import { isCounted } from './variations';

const pool = getPool();

describe('move pool (pool.json)', () => {
  it('was computed from the current catalogue (else run: npx tsx tools/moves/pool.ts)', () => {
    expect((data as { catalogueHash: string }).catalogueHash).toBe(catalogueHash());
    expect(pool.skipped).toBe(0);
  });

  it('has many distinct moves: base + counted variations, and ornaments on top', () => {
    const specs = poolSpecs();
    expect(pool.variations.length).toBe(specs.filter((s) => isCounted(s.type)).length);
    expect(pool.moves.length).toBe(MOVES.length + pool.variations.length);
    const ids = new Set(pool.moves.map((m) => m.id));
    expect(ids.size).toBe(pool.moves.length);
    for (const m of pool.variations) {
      expect(m.base).not.toBe(m.id);
      expect(m.name).toContain(' · ');
      expect(m.families.length).toBeGreaterThan(0);
    }
    // Startup cost stays small (built once, lazily).
    expect(pool.buildMs).toBeLessThan(3000);
  });

  // tools/moves/pool.ts validated every entry at 100 and 140 BPM when it wrote
  // pool.json; this re-checks a deterministic third of them at 120 BPM.
  it('variations and ornaments pass the validity checks (a third, 120 BPM, both sides)', { timeout: 120_000 }, () => {
    const bad: string[] = [];
    const all = [...pool.variations, ...[...pool.ornaments.values()].flat()];
    for (const m of all.filter((x) => hashString(x.id) % 3 === 0)) {
      const p = [...checkKeys(m), ...checkPlayback(m, { bpms: [120] }).problems];
      if (p.length) bad.push(`${m.id}: ${p.join('; ')}`);
    }
    expect(bad).toEqual([]);
  });

  it('counted variations are clearly different from every other move (sampled)', { timeout: 120_000 }, () => {
    const all = pool.moves.filter((m) => !m.cooldown && !m.idle);
    const sigs = new Map(all.map((m) => [m.id, motionSignature(m)]));
    const sample = pool.variations.filter((m) => hashString(m.id) % 8 === 0).slice(0, 80);
    expect(sample.length).toBeGreaterThan(10);
    for (const v of sample) {
      const a = sigs.get(v.id)!;
      for (const o of all) {
        if (o.id === v.id) continue;
        const d = moveDistance(a, sigs.get(o.id)!, VARIATION_THRESHOLD);
        expect(d.total, `${v.id} ~ ${o.id}`).toBeGreaterThanOrEqual(VARIATION_THRESHOLD - 1e-9);
      }
    }
  });

  it('base moves have no near-duplicates', { timeout: 120_000 }, () => {
    const base = MOVES.filter((m) => !m.cooldown && !m.idle);
    const sigs = base.map(motionSignature);
    const dupes: string[] = [];
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < sigs.length; j++) {
        const d = moveDistance(sigs[i], sigs[j], UNIQUE_THRESHOLD);
        if (d.total < UNIQUE_THRESHOLD) dupes.push(`${sigs[i].id} ~ ${sigs[j].id} ${d.total.toFixed(3)}`);
      }
    }
    expect(dupes).toEqual([]);
  });
});
