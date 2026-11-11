import { describe, expect, it } from 'vitest';
import { fitText } from './renderer';

/** Canvas stand-in: every character is 0.5 em wide. */
function ctx() {
  let size = 10;
  return {
    set font(f: string) {
      size = Number(/(\d+(?:\.\d+)?)px/.exec(f)![1]);
    },
    get font() {
      return `${size}px`;
    },
    measureText: (t: string) => ({ width: t.length * size * 0.5 }),
  } as unknown as CanvasRenderingContext2D;
}

describe('fitText (strip / card names)', () => {
  it('leaves short text alone', () => {
    expect(fitText(ctx(), 'Lasso', 400, 40, 900, 0.55, 'x')).toEqual({ size: 40, text: 'Lasso' });
  });

  it('shrinks a long name to fit, with a margin, at a whole-pixel size', () => {
    const name = 'Booty Shake · bachata belly'; // 27 chars: 540 px at 40 px
    const r = fitText(ctx(), name, 440, 40, 900, 0.55, 'x');
    expect(r.text).toBe(name);
    expect(Number.isInteger(r.size)).toBe(true);
    expect(r.size).toBeLessThan(40);
    expect(name.length * r.size * 0.5).toBeLessThanOrEqual(440 * 0.96);
  });

  it('stops shrinking at the floor and ellipsizes', () => {
    const name = 'Booty Shake · bachata belly';
    const r = fitText(ctx(), name, 200, 40, 900, 0.55, 'x');
    expect(r.size).toBe(22);
    expect(r.text.endsWith('…')).toBe(true);
    expect(r.text.length * r.size * 0.5).toBeLessThanOrEqual(200 * 0.96);
    expect(name.startsWith(r.text.slice(0, -1).trimEnd())).toBe(true);
  });
});
