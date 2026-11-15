/**
 * Feet: how long a foot is, how high its toe joint sits when it stands flat,
 * and how much a foot is "on the floor" (bearing weight) from its height.
 *
 * Pure TypeScript (no DOM), allocation-free.
 */

/** Ankle joint height of a foot standing on the floor (BODY.ankleY). */
export const ANKLE_HEIGHT = 0.035;
/** Ankle joint -> toe joint (figure units). */
export const FOOT_LEN = 0.085;
/** Toe joint height above the floor when the foot stands flat (sole on the floor). */
export const FOOT_TOE_Y = 0.011;

/** Ankle lift (above BODY.ankleY) at which a foot counts as fully off the floor. */
export const FOOT_AIR = 0.04;

/**
 * Contact weight of a foot from its ankle lift above the standing ankle
 * height: 1 = on the floor (flat, bearing weight), 0 = in the air (the foot
 * hangs off the shin). Smooth in between, so a step peels off and lands.
 */
export function footContact(lift: number): number {
  if (lift <= 0.002) return 1;
  if (lift >= FOOT_AIR) return 0;
  const x = 1 - (lift - 0.002) / (FOOT_AIR - 0.002);
  return x * x * (3 - 2 * x);
}

const DEG = Math.PI / 180;
/** Slope (deg below the horizontal) of the ankle -> toe line of a flat foot. */
export const FLAT_DEG = Math.asin((ANKLE_HEIGHT - FOOT_TOE_Y) / FOOT_LEN) / DEG;

/** How much of a foot's depth (toward / away from the viewer) still shows as shoe length. */
const DEPTH_SHOW = 0.36;

/**
 * Screen axis of a shoe drawn as a profile sneaker (every look): writes
 * out[0], out[1] = unit direction heel -> toe on the screen (x right, y DOWN)
 * and out[2] = its visible length as a fraction of the full profile length.
 *
 * The sole's tilt on the screen is the foot's real pitch (sole against the
 * floor), not the perspective drop of a toe pointing at the viewer: a flat
 * foot is drawn with its sole level, in every view. The part of the foot
 * pointing toward / away from the viewer shows as a shorter shoe turned to
 * the foot's outer side (side * cos(spin) on screen), so a foot pointing at
 * the viewer reads as a front-view sneaker, toes out, not as a foot standing
 * on its toes.
 *
 * p: solved joints (after the turn); side: +1 right foot, -1 left; spin: deg.
 */
export function shoeAxis(p: Float64Array, an: number, toe: number, side: number, spin: number, out: Float64Array | number[]): void {
  const fx = p[toe * 3] - p[an * 3], fy = p[toe * 3 + 1] - p[an * 3 + 1], fz = p[toe * 3 + 2] - p[an * 3 + 2];
  const h = Math.sqrt(fx * fx + fz * fz);
  // Sole pitch: the ankle -> toe slope minus a flat foot's.
  const phi = Math.atan2(-fy, h) - FLAT_DEG * DEG;
  const c = Math.cos(phi), s = Math.sin(phi);
  const hx = h > 1e-9 ? fx / h : 0, hz = h > 1e-9 ? fz / h : 1;
  const sx = hx * c, sy = -s, sz = hz * c;
  const o = side * Math.cos(spin * DEG);
  const ax = sx + o * DEPTH_SHOW * Math.abs(sz);
  const ay = -sy;
  const l = Math.sqrt(ax * ax + ay * ay);
  if (l < 1e-6) {
    out[0] = o >= 0 ? 1 : -1;
    out[1] = 0;
    out[2] = 0;
    return;
  }
  out[0] = ax / l;
  out[1] = ay / l;
  out[2] = l > 1 ? 1 : l;
}
