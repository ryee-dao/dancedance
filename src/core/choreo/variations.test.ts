import { describe, expect, it } from 'vitest';
import { MAX_NAME, shortName } from './generator';
import { findMove } from './moves';
import { getPool } from './pool';

const pool = getPool();
const built = [...pool.variations, ...pool.ornaments.all()];

/** Family-file id prefixes that must never reach the NOW card. */
const RAW_PREFIX = /\b(ae|rk|fk|hh)\b/i;
/** Latin style words that only lead a suffix on a latin move. */
const STYLE_LEAD = /^(latin|salsa|samba|flamenco|bachata|cumbia|paso|folk)\b/i;

describe('variation display names', () => {
  it('has variations and ornaments to check', () => {
    expect(pool.variations.length).toBeGreaterThan(100);
    expect(built.length).toBeGreaterThan(pool.variations.length);
  });

  for (const [label, shorten] of [['full', false], ['shortened', true]] as const) {
    it(`reads as "<Move> · <1-3 word phrase>" without raw pattern ids (${label})`, () => {
      const bad: string[] = [];
      for (const m of built) {
        const name = shorten ? shortName(m.name) : m.name;
        const k = name.indexOf(' · ');
        if (k < 0) continue; // shortened to the base name alone
        const head = name.slice(0, k), suf = name.slice(k + 3);
        const words = suf.split(/\s+/).filter(Boolean);
        const latin = m.families.includes('latin');
        if (RAW_PREFIX.test(name)) bad.push(`${m.id}: raw prefix in "${name}"`);
        if (/[a-z][A-Z]/.test(suf)) bad.push(`${m.id}: camelCase in "${name}"`);
        if (words.length < 1 || words.length > 3) bad.push(`${m.id}: ${words.length} words in "${name}"`);
        const lead = STYLE_LEAD.exec(suf)?.[1].toLowerCase();
        if (lead && (lead === 'latin' || (!latin && !head.toLowerCase().includes(lead)))) bad.push(`${m.id}: style prefix in "${name}"`);
      }
      expect(bad).toEqual([]);
    });
  }

  it(`keeps every shown name within ${MAX_NAME} characters (or the base name alone)`, () => {
    for (const m of built) {
      const n = shortName(m.name);
      if (n.length > MAX_NAME) expect(n, m.id).toBe(findMove(m.base!)?.name);
    }
  });
});
