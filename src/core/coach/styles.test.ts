import { describe, expect, it } from 'vitest';
import { humanLook, LOOKS, MALE_LOOKS } from './humanPainter';
import { COACH_BUILDS, DEFAULT_COACH_BUILD, duoBuilds, parseCoachBuild, partnerBuild } from './styles';

describe('coach builds (female / male versions of every look)', () => {
  it('parses only known builds; the default keeps the original (female) figures', () => {
    expect(COACH_BUILDS.map((b) => b.id)).toEqual(['female', 'male']);
    expect(DEFAULT_COACH_BUILD).toBe('female');
    expect(parseCoachBuild('male')).toBe('male');
    expect(parseCoachBuild('female')).toBe('female');
    expect(parseCoachBuild('Male')).toBeNull();
    expect(parseCoachBuild(undefined)).toBeNull();
    expect(parseCoachBuild(1)).toBeNull();
  });

  it('two players are always the female + male pair, P1 the chosen version', () => {
    expect(partnerBuild('female')).toBe('male');
    expect(partnerBuild('male')).toBe('female');
    expect(duoBuilds('female')).toEqual(['female', 'male']);
    expect(duoBuilds('male')).toEqual(['male', 'female']);
  });

  it('the female human looks are the original ones; each male look differs in build, hair and outfit', () => {
    for (const st of ['human', 'sticker'] as const) {
      expect(humanLook(st, 'female')).toBe(LOOKS[st]);
      const f = LOOKS[st], m = MALE_LOOKS[st];
      expect(humanLook(st, 'male')).toBe(m);
      // Build: broader shoulders relative to the hips.
      expect(m.shoulderW / m.hipW).toBeGreaterThan(f.shoulderW / f.hipW + 0.1);
      expect(m.arm[0]).toBeGreaterThan(f.arm[0]);
      // Hair.
      expect(m.hairStyle).not.toBe(f.hairStyle);
      expect(['crop', 'beanie']).toContain(m.hairStyle);
      // Outfit.
      const outfit = (l: typeof m) => JSON.stringify([l.shortsLen, l.sleeve, l.hood, l.stripe, l.top, l.band]);
      expect(outfit(m)).not.toBe(outfit(f));
    }
  });
});
