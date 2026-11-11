import { describe, expect, it } from 'vitest';
import { clampOffset, formatOffset, stageTime, stepOffset } from './audioOffset';

describe('audio offset', () => {
  it('clamps to ±500 ms and snaps to 10 ms', () => {
    expect(clampOffset(0)).toBe(0);
    expect(clampOffset(44)).toBe(40);
    expect(clampOffset(-46)).toBe(-50);
    expect(clampOffset(9999)).toBe(500);
    expect(clampOffset(-9999)).toBe(-500);
    expect(Object.is(clampOffset(-4), 0)).toBe(true); // no -0
    expect(clampOffset(NaN)).toBe(0);
    expect(clampOffset('40')).toBe(0);
  });
  it('steps by 10 ms and stops at the limits', () => {
    expect(stepOffset(0, 1)).toBe(10);
    expect(stepOffset(0, -1)).toBe(-10);
    expect(stepOffset(500, 1)).toBe(500);
    expect(stepOffset(-500, -1)).toBe(-500);
    let v = 0;
    for (let i = 0; i < 80; i++) v = stepOffset(v, 1);
    expect(v).toBe(500);
  });
  it('formats the readout', () => {
    expect(formatOffset(40)).toBe('Audio offset +40 ms');
    expect(formatOffset(-120)).toBe('Audio offset −120 ms');
    expect(formatOffset(0)).toBe('Audio offset 0 ms');
  });
  it('positive offset makes the stage run behind the song', () => {
    expect(stageTime(10, 200)).toBeCloseTo(9.8, 9);
    expect(stageTime(10, -100)).toBeCloseTo(10.1, 9);
    expect(stageTime(10, 5000)).toBeCloseTo(9.5, 9); // clamped
  });
});
