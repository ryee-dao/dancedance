import { describe, expect, it } from 'vitest';
import { pose } from './poses';
import { towardViewer } from './renderer';
import { CH, HAND_FORM, J, createSkeleton, solveSkeleton, spineBend } from './skeleton';
import { VIEW, depthScale, screenUp } from './styles';

describe('stage camera (VIEW)', () => {
  it('leaves every point in the picture plane (z = 0) where it was', () => {
    for (const y of [0, 0.3, 0.55, 0.95, 1.3]) expect(screenUp(y, 0, depthScale(0))).toBeCloseTo(y, 12);
  });

  it('draws a foot stepped toward the viewer lower on the screen, a step back higher', () => {
    const sk = solveSkeleton(pose({ rf: [0.09, 0, 0.15], lf: [-0.09, 0, -0.15] }), createSkeleton());
    const up = (j: number) => screenUp(sk.p[j * 3 + 1], sk.p[j * 3 + 2], depthScale(sk.p[j * 3 + 2]));
    // The eye is above the feet: depth shows as height on the floor.
    expect(VIEW.piv).toBeGreaterThan(0.5);
    expect(up(J.AN_R)).toBeLessThan(up(J.AN_L) - 0.05);
    // ... while a hand at chest height barely moves for the same depth.
    const handDrop = screenUp(0.75, 0, 1) - screenUp(0.75, 0.15, depthScale(0.15));
    const footDrop = screenUp(0.035, 0, 1) - screenUp(0.035, 0.15, depthScale(0.15));
    expect(handDrop).toBeLessThan(footDrop * 0.3);
  });
});

describe('hands', () => {
  it('measures how much a forearm points at the viewer', () => {
    const p = new Float64Array(21 * 3);
    p[J.HA_R * 3 + 2] = 0.15; // straight at the viewer
    expect(towardViewer(p, J.EL_R, J.HA_R)).toBe(1);
    p[J.HA_R * 3 + 2] = 0;
    p[J.HA_R * 3] = 0.15; // out to the side
    expect(towardViewer(p, J.EL_R, J.HA_R)).toBe(0);
  });

  it("has a 'fingers' form (spread fingers) next to point and horns", () => {
    const q = pose({ formR: 'fingers', formL: 'point' });
    expect(q[CH.FORM_R]).toBe(HAND_FORM.fingers);
    const sk = solveSkeleton(q, createSkeleton());
    expect(sk.formR).toBe(3);
    expect(sk.formL).toBe(1);
  });
});

describe('spine curve', () => {
  it('is straight standing upright and bends into an arc with a side bend', () => {
    const out = new Float64Array(3);
    const sk = solveSkeleton(pose({}), createSkeleton());
    spineBend(sk.p, sk.rt, sk.rp, 0.45, out);
    expect(Math.hypot(out[0], out[1], out[2])).toBeLessThan(1e-9);
    // Leaning to screen right: the chest goes right, the middle of the spine stays behind the chord (to the left).
    const lean = solveSkeleton(pose({ lean: 20 }), createSkeleton());
    spineBend(lean.p, lean.rt, lean.rp, 0.45, out);
    expect(out[0]).toBeLessThan(-0.005);
    // The waist joint sits on that curve.
    const chordX = lean.p[0] + (lean.p[J.CHEST * 3] - lean.p[0]) * 0.45;
    expect(lean.p[J.WAIST * 3]).toBeCloseTo(chordX + out[0], 9);
  });
});
