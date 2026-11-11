/**
 * Human-proportioned coach styles (see styles.ts), drawn from the same solved
 * skeleton as the classic cartoon.
 *
 * Body shapes hang off the skeleton's torso / pelvis frames in 3D and are
 * projected with the shared perspective, so the torso narrows when it twists,
 * the waist bends between the chest and the pelvis frames, and hands / feet
 * foreshorten when they point at the viewer. Limbs are chains of tapered
 * capsules (hull of two circles) with equal radii at the joints, so elbows and
 * knees stay closed and round through any bend.
 *
 * Every part is drawn in two passes: an outline pass (shapes grown by the
 * outline width) and a fill pass. Parts are depth-sorted like the classic
 * figure (far arm / leg behind the torso, near or crossing limbs in front),
 * so each part's outline separates it from whatever it covers (the sticker
 * look uses a light outline for a layered paper cut-out feel).
 *
 * The per-frame path allocates nothing (scratch arrays, constant colours).
 */

import { BODY, J, NUM_JOINTS, type Skeleton } from './skeleton';
import { CAM, PIV_Y } from './styles';

export type HairStyle = 'ponytail' | 'puff';

/** [from, to] along a limb chain (0 = root joint, 1 = middle joint, 2 = end joint). */
export type Span = readonly [number, number];

export interface HumanLook {
  // --- Build (figure units; 1.0 = standing height). ---
  /** Neck half-width at the collar. */
  neckW: number;
  neckR: number;
  /** Deltoid outer half-width, chest half-width under the arms, waist, hips. */
  shoulderW: number;
  chestW: number;
  waistW: number;
  hipW: number;
  /** Torso half-depth (silhouette widening when twisted). */
  depth: number;
  /** Arm radii: shoulder, elbow, forearm bulge (at 1.25), wrist. */
  arm: readonly [number, number, number, number];
  /** Leg radii: hip, knee, calf bulge (at 1.3), ankle. */
  leg: readonly [number, number, number, number];
  headRx: number;
  headRy: number;
  hand: number;
  /** Shoe radii: heel, toe. */
  shoe: readonly [number, number];

  // --- Outfit. ---
  skin: string;
  skinLine: string;
  hair: string;
  hairStyle: HairStyle;
  /** Hair band / tie colour (null = none). */
  band: string | null;
  top: string;
  /** Shirt hem height in the pelvis frame (lower = longer top). */
  hemY: number;
  /** Neckline dip in the chest frame. */
  neckDip: number;
  /** Arm cover in the side colour (sleeve / compression sleeve), or null. */
  sleeve: Span | null;
  /** Second, darker side-colour band on the arm (wristband / cuff), or null. */
  cuff: Span | null;
  shorts: string;
  /** How far the shorts reach down the thigh (0..1). */
  shortsLen: number;
  /** Leg cover in the side colour (leggings / joggers / socks), or null. */
  legCover: Span | null;
  /** Shoe upper: 'side' = side colour, else a colour. */
  shoeUpper: string;
  /** Sole: 'side' = side colour, else a colour. */
  sole: string;

  // --- Line work. ---
  /** Part outline (separates overlapping parts and the figure from the stage). */
  outline: string;
  /** Detail lines: hems, pocket, shoe welt. */
  line: string;
  /** Outline width (units). */
  ol: number;
  /** Thin lines at sleeve / sock / shirt hems (false = flat colour blocks). */
  hem: boolean;
  /** Hoodie details (hood behind the neck, pocket, drawstrings). */
  hood: string | null;
  eye: string;
  /** Cheek blush colour, or null. */
  blush: string | null;
}

export const SIDE = {
  right: '#ff5c8a',
  rightDark: '#d63a6c',
  left: '#33dcb4',
  leftDark: '#14a586',
} as const;


const PASS_LINE = 1;
const PASS_FILL = 2;

// Shirt outline (right side, top to bottom). Frames: 0 chest (at CHEST),
// 1 shoulder (chest axes at the shoulder joint), 2 waist (chest / pelvis blend),
// 3 pelvis (at PELVIS). x values are filled from the look at draw time.
const SHIRT_N = 9;
const WAIST_Y = -0.185; // chest frame; = BODY.torso + WAIST_Y in the pelvis frame
const SHORTS_N = 4;

export class HumanPainter {
  look: HumanLook;
  // Projection.
  private cx = 0;
  private floorY = 0;
  private scale = 1;
  private qx = 0;
  private qy = 0;
  private qs = 1;
  // World-space scratch point.
  private wx = 0;
  private wy = 0;
  private wz = 0;
  // Projected shapes (x, y pairs).
  private readonly shirt = new Float64Array((SHIRT_N * 2 + 2) * 2);
  private readonly shortsP = new Float64Array((SHORTS_N * 2 + 2) * 2);
  // Depth order.
  private readonly order = new Int8Array(7);
  private readonly zkey = new Float64Array(7);
  // Hand frames per side: [hx, hy, hz, tx, ty] (3D hand direction, thumb dir in xy).
  private readonly handDir = new Float64Array(10);
  // Ponytail / puff spring.
  private tailA = 0;
  private tailV = 0;
  private lastHx = NaN;
  private lastHy = NaN;
  private lastT = NaN;
  private olPx = 1;
  private grow = 0;
  private readonly legFront = new Uint8Array(2);
  private readonly legRaised = new Uint8Array(2);
  private readonly armK = new Float64Array(8);
  private readonly legK = new Float64Array(8);
  private readonly quad = new Float64Array(8);
  // Shoe frame (screen): origin, along, up, length, px per unit.
  private shx = 0;
  private shy = 0;
  private sax = 1;
  private say = 0;
  private snx = 0;
  private sny = -1;
  private sL = 1;
  private sS = 1;
  private sSh = 0;
  // Hem lines recorded by flat capsule ends: (x0, y0, x1, y1) * 4.
  private readonly hems = new Float64Array(16);
  private hemN = 0;

  constructor(look: HumanLook) {
    this.look = look;
    this.setLook(look);
  }

  setLook(look: HumanLook): void {
    this.look = look;
    const a = look.arm, l = look.leg;
    this.armK.set([0, a[0], 1, a[1], 1.25, a[2], 2, a[3]]);
    this.legK.set([0, l[0], 1, l[1], 1.3, l[2], 2, l[3]]);
  }

  // -------------------------------------------------------------------------
  // Projection helpers

  private proj(x: number, y: number, z: number): void {
    const s = CAM / (CAM - z);
    this.qs = s * this.scale;
    this.qx = this.cx + x * this.qs;
    this.qy = this.floorY - (PIV_Y + (y - PIV_Y) * s) * this.scale;
  }

  /** World point = joint origin + R * (x, y, z) -> (wx, wy, wz). */
  private local(p: Float64Array, j: number, R: Float64Array, x: number, y: number, z: number): void {
    this.wx = p[j * 3] + R[0] * x + R[1] * y + R[2] * z;
    this.wy = p[j * 3 + 1] + R[3] * x + R[4] * y + R[5] * z;
    this.wz = p[j * 3 + 2] + R[6] * x + R[7] * y + R[8] * z;
  }

  /** Point at t along the chain j0 -> j1 -> j2 -> (wx, wy, wz). */
  private chain(p: Float64Array, j0: number, j1: number, j2: number, t: number): void {
    let a = j0, b = j1, u = t;
    if (t > 1) {
      a = j1;
      b = j2;
      u = t - 1;
    }
    this.wx = p[a * 3] + (p[b * 3] - p[a * 3]) * u;
    this.wy = p[a * 3 + 1] + (p[b * 3 + 1] - p[a * 3 + 1]) * u;
    this.wz = p[a * 3 + 2] + (p[b * 3 + 2] - p[a * 3 + 2]) * u;
  }

  // -------------------------------------------------------------------------
  // Primitive: capsule (hull of two circles), added to the current path.

  private cap(ctx: CanvasRenderingContext2D, ax: number, ay: number, ra: number, bx: number, by: number, rb: number, flatA = false, flatB = false): void {
    const dx = bx - ax, dy = by - ay;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (flatA || flatB) {
      if (d < 0.5) {
        // Degenerate (pointing at the viewer): a circle reads best.
        const r = ra > rb ? ra : rb;
        ctx.moveTo(ax + r, ay);
        ctx.arc(ax, ay, r, 0, Math.PI * 2);
        return;
      }
      // Hem: cut the capsule straight across at a flat end.
      const base = Math.atan2(dy, dx);
      const c = (ra - rb) / d;
      const phi = Math.acos(c < -1 ? -1 : c > 1 ? 1 : c);
      ctx.moveTo(ax + Math.cos(base + phi) * ra, ay + Math.sin(base + phi) * ra);
      if (flatA) {
        ctx.lineTo(ax + Math.cos(base - phi) * ra, ay + Math.sin(base - phi) * ra);
        this.hemLine(ax, ay, ra, base, phi);
      } else ctx.arc(ax, ay, ra, base + phi, base + Math.PI * 2 - phi);
      if (flatB) {
        ctx.lineTo(bx + Math.cos(base - phi) * rb, by + Math.sin(base - phi) * rb);
        ctx.lineTo(bx + Math.cos(base + phi) * rb, by + Math.sin(base + phi) * rb);
        this.hemLine(bx, by, rb, base, phi);
      } else ctx.arc(bx, by, rb, base - phi, base + phi);
      ctx.closePath();
      return;
    }
    if (d <= Math.abs(ra - rb) + 0.01) {
      // One circle contains the other.
      if (ra >= rb) {
        ctx.moveTo(ax + ra, ay);
        ctx.arc(ax, ay, ra, 0, Math.PI * 2);
      } else {
        ctx.moveTo(bx + rb, by);
        ctx.arc(bx, by, rb, 0, Math.PI * 2);
      }
      return;
    }
    const base = Math.atan2(dy, dx);
    const phi = Math.acos((ra - rb) / d);
    ctx.moveTo(ax + Math.cos(base + phi) * ra, ay + Math.sin(base + phi) * ra);
    ctx.arc(ax, ay, ra, base + phi, base + Math.PI * 2 - phi);
    ctx.arc(bx, by, rb, base - phi, base + phi);
    ctx.closePath();
  }

  /** Detail line width (px). */
  private lineW(): number {
    const w = this.olPx * 0.9, m = 0.0065 * this.scale;
    return w < m ? w : m;
  }

  /** Remember a flat hem's end line (for a thin stroke after the fill). */
  private hemLine(x: number, y: number, r: number, base: number, phi: number): void {
    if (this.hemN >= 4) return;
    const h = this.hems, o = this.hemN * 4;
    h[o] = x + Math.cos(base + phi) * r;
    h[o + 1] = y + Math.sin(base + phi) * r;
    h[o + 2] = x + Math.cos(base - phi) * r;
    h[o + 3] = y + Math.sin(base - phi) * r;
    this.hemN++;
  }

  /**
   * Capsules along a limb chain for t in [a, b], radius profile `k`, grown by
   * `extra` units. `hem`: ends inside the chain are cut flat (clothing hems).
   */
  private limb(ctx: CanvasRenderingContext2D, p: Float64Array, j0: number, j1: number, j2: number, k: Float64Array, a: number, b: number, extra: number, hem = false, hemStart = true): void {
    for (let i = 0; i < 6; i += 2) {
      const t0 = k[i], t1 = k[i + 2];
      const ta = a > t0 ? a : t0;
      const tb = b < t1 ? b : t1;
      if (tb <= ta) continue;
      const r0 = k[i + 1] + (k[i + 3] - k[i + 1]) * ((ta - t0) / (t1 - t0));
      const r1 = k[i + 1] + (k[i + 3] - k[i + 1]) * ((tb - t0) / (t1 - t0));
      this.chain(p, j0, j1, j2, ta);
      this.proj(this.wx, this.wy, this.wz);
      const ax = this.qx, ay = this.qy, ra = (r0 + extra) * this.qs;
      this.chain(p, j0, j1, j2, tb);
      this.proj(this.wx, this.wy, this.wz);
      this.cap(ctx, ax, ay, ra, this.qx, this.qy, (r1 + extra) * this.qs, hem && hemStart && ta === a && a > 0.001, hem && tb === b && b < 1.999);
    }
  }

  /** Smooth closed path through n projected points (quadratic midpoints). */
  private smooth(ctx: CanvasRenderingContext2D, pts: Float64Array, n: number): void {
    const lx = pts[(n - 1) * 2], ly = pts[(n - 1) * 2 + 1];
    ctx.moveTo((lx + pts[0]) * 0.5, (ly + pts[1]) * 0.5);
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2], y = pts[i * 2 + 1];
      const j = i + 1 < n ? i + 1 : 0;
      ctx.quadraticCurveTo(x, y, (x + pts[j * 2]) * 0.5, (y + pts[j * 2 + 1]) * 0.5);
    }
    ctx.closePath();
  }

  /** Fill the current path for a pass: the outline pass grows polygons via a stroke. */
  private paint(ctx: CanvasRenderingContext2D, pass: number, fill: string, strokeGrow: boolean): void {
    if (pass === PASS_FILL) {
      ctx.fillStyle = fill;
      ctx.fill();
      return;
    }
    ctx.fillStyle = this.look.outline;
    ctx.fill();
    if (strokeGrow) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = this.grow * 2 * this.scale;
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------

  draw(ctx: CanvasRenderingContext2D, sk: Skeleton, px: Float64Array, ps: Float64Array, cx: number, floorY: number, scale: number, t: number, mini: boolean): void {
    this.cx = cx;
    this.floorY = floorY;
    this.scale = scale;
    const L = this.look;
    const p = sk.p;
    this.olPx = L.ol * (mini ? 0.75 : 1) * scale;
    this.prepareTorso(sk);
    this.prepareHands(sk);
    this.updateSpring(px, ps, t, mini);

    // Depth order: 0 legL, 1 legR, 2 torso (neck, shorts), 3 head, 4 armL,
    // 5 armR, 6 shirt. The shirt hangs over a leg stepping forward, but a
    // knee raised toward the viewer comes in front of it.
    const zk = this.zkey;
    const lz = (p[J.KN_L * 3 + 2] + p[J.AN_L * 3 + 2]) * 0.5;
    const rz = (p[J.KN_R * 3 + 2] + p[J.AN_R * 3 + 2]) * 0.5;
    this.legFront[0] = lz > 0.1 ? 1 : 0;
    this.legFront[1] = rz > 0.1 ? 1 : 0;
    const lr = this.legFront[0] === 1 && L.shortsLen > 0 && p[J.KN_L * 3 + 2] - p[J.HIP_L * 3 + 2] > 0.35 * BODY.thigh;
    const rr = this.legFront[1] === 1 && L.shortsLen > 0 && p[J.KN_R * 3 + 2] - p[J.HIP_R * 3 + 2] > 0.35 * BODY.thigh;
    this.legRaised[0] = lr ? 1 : 0;
    this.legRaised[1] = rr ? 1 : 0;
    zk[0] = lz > 0.1 ? (lr ? 0.45 + lz * 0.02 : Math.min(0.43, 0.15 + lz)) : -1 + lz;
    zk[1] = rz > 0.1 ? (rr ? 0.45 + rz * 0.02 : Math.min(0.43, 0.15 + rz)) : -1 + rz;
    zk[2] = 0;
    zk[6] = 0.44;
    zk[3] = 0.05;
    const al = (p[J.EL_L * 3 + 2] + p[J.HA_L * 3 + 2]) * 0.5;
    const ar = (p[J.EL_R * 3 + 2] + p[J.HA_R * 3 + 2]) * 0.5;
    zk[4] = al < -0.04 ? -0.5 + al : 0.5 + al;
    zk[5] = ar < -0.04 ? -0.5 + ar : 0.5 + ar;
    const ord = this.order;
    for (let i = 0; i < 7; i++) ord[i] = i;
    for (let i = 1; i < 7; i++) {
      const v = ord[i];
      let j = i - 1;
      while (j >= 0 && zk[ord[j]] > zk[v]) {
        ord[j + 1] = ord[j];
        j--;
      }
      ord[j + 1] = v;
    }

    this.grow = L.ol * (mini ? 0.75 : 1);
    for (let i = 0; i < 7; i++) {
      this.part(ctx, sk, ord[i], PASS_LINE, mini);
      this.part(ctx, sk, ord[i], PASS_FILL, mini);
    }
  }

  private part(ctx: CanvasRenderingContext2D, sk: Skeleton, id: number, pass: number, mini: boolean): void {
    switch (id) {
      case 0:
        this.leg(ctx, sk, -1, pass);
        break;
      case 1:
        this.leg(ctx, sk, 1, pass);
        break;
      case 2:
        this.torso(ctx, sk, pass);
        break;
      case 3:
        this.head(ctx, sk, pass, mini);
        break;
      case 4:
        this.arm(ctx, sk, -1, pass);
        break;
      case 5:
        this.arm(ctx, sk, 1, pass);
        break;
      case 6:
        this.shirtPart(ctx, sk, pass);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Torso

  private prepareTorso(sk: Skeleton): void {
    const L = this.look;
    const p = sk.p, RT = sk.rt, RP = sk.rp;
    const s = this.shirt;
    // Right side then the left side mirrored, then the hem / neckline middles.
    let n = 0;
    for (let side = 1; side >= -1; side -= 2) {
      for (let k = 0; k < SHIRT_N; k++) {
        const i = side === 1 ? k : SHIRT_N - 1 - k;
        this.shirtPoint(p, RT, RP, i, side, L);
        this.proj(this.wx, this.wy, this.wz);
        s[n * 2] = this.qx;
        s[n * 2 + 1] = this.qy;
        n++;
      }
      // Middle point after each side: hem centre (after right), neckline (after left).
      if (side === 1) this.torsoPt(p, RP, J.PELVIS, 0, L.hemY - 0.006, 0, L.depth);
      else this.torsoPt(p, RT, J.CHEST, 0, L.neckDip, 0, L.depth);
      this.proj(this.wx, this.wy, this.wz);
      s[n * 2] = this.qx;
      s[n * 2 + 1] = this.qy;
      n++;
    }
    // Shorts (pelvis frame): right side down, crotch, left side up, waistband middle.
    const q = this.shortsP;
    n = 0;
    for (let side = 1; side >= -1; side -= 2) {
      for (let k = 0; k < SHORTS_N; k++) {
        const i = side === 1 ? k : SHORTS_N - 1 - k;
        let x = 0, y = 0;
        if (i === 0) {
          x = L.hipW - 0.01;
          y = 0.06;
        } else if (i === 1) {
          x = L.hipW + 0.004;
          y = 0.0;
        } else if (i === 2) {
          x = L.hipW - 0.006;
          y = -0.05;
        } else {
          x = 0.028;
          y = -0.09;
        }
        this.torsoPt(p, RP, J.PELVIS, side * x, y, 0, L.depth);
        this.proj(this.wx, this.wy, this.wz);
        q[n * 2] = this.qx;
        q[n * 2 + 1] = this.qy;
        n++;
      }
      if (side === 1) this.torsoPt(p, RP, J.PELVIS, 0, -0.086, 0, L.depth);
      else this.torsoPt(p, RP, J.PELVIS, 0, 0.062, 0, L.depth);
      this.proj(this.wx, this.wy, this.wz);
      q[n * 2] = this.qx;
      q[n * 2 + 1] = this.qy;
      n++;
    }
  }

  /** Point on the torso surface: local (x, y) in frame R at joint j, pushed back/forward so twisted silhouettes keep their depth. */
  private torsoPt(p: Float64Array, R: Float64Array, j: number, x: number, y: number, xOff: number, depth: number): void {
    const xz = R[6];
    const sg = xz / (Math.abs(xz) + 0.03);
    const z = -((x + xOff) / 0.13) * sg * depth;
    this.local(p, j, R, x, y, z);
  }

  private shirtPoint(p: Float64Array, RT: Float64Array, RP: Float64Array, i: number, side: number, L: HumanLook): void {
    const sj = side === 1 ? J.SH_R : J.SH_L;
    const sh = BODY.shoulderHalf;
    switch (i) {
      case 0:
        this.torsoPt(p, RT, J.CHEST, side * L.neckW, 0.03, 0, L.depth);
        break;
      case 1:
        this.torsoPt(p, RT, J.CHEST, side * (L.neckW + 0.04), 0.022, 0, L.depth);
        break;
      case 2:
        this.torsoPt(p, RT, sj, side * -0.012, 0.03, side * sh, L.depth);
        break;
      case 3:
        this.torsoPt(p, RT, sj, side * (L.shoulderW - sh), 0.0, side * sh, L.depth);
        break;
      case 4:
        this.torsoPt(p, RT, sj, side * (L.chestW - sh), -0.075, side * sh, L.depth);
        break;
      case 5:
        this.torsoPt(p, RT, J.CHEST, side * (L.chestW - 0.006), -0.13, 0, L.depth);
        break;
      case 6: {
        // Waist: halfway between where the chest and the pelvis frames put it.
        this.torsoPt(p, RT, J.CHEST, side * L.waistW, WAIST_Y, 0, L.depth);
        const ax = this.wx, ay = this.wy, az = this.wz;
        this.torsoPt(p, RP, J.PELVIS, side * L.waistW, BODY.torso + WAIST_Y, 0, L.depth);
        this.wx = (this.wx + ax) * 0.5;
        this.wy = (this.wy + ay) * 0.5;
        this.wz = (this.wz + az) * 0.5;
        break;
      }
      case 7:
        this.torsoPt(p, RP, J.PELVIS, side * (L.hipW - 0.004), 0.04, 0, L.depth);
        break;
      default:
        this.torsoPt(p, RP, J.PELVIS, side * (L.hipW + 0.004), L.hemY, 0, L.depth);
        break;
    }
  }

  private torso(ctx: CanvasRenderingContext2D, sk: Skeleton, pass: number): void {
    const L = this.look;
    const p = sk.p;
    const nP = SHORTS_N * 2 + 2;
    const g = this.grow;
    // Neck (from inside the collar up into the head).
    ctx.beginPath();
    this.local(p, J.CHEST, sk.rt, 0, -0.01, 0);
    this.proj(this.wx, this.wy, this.wz);
    const nx = this.qx, ny = this.qy, ns = this.qs;
    this.headCentre(p);
    this.proj(this.wx, this.wy, this.wz);
    const hx = this.qx, hy = this.qy, hs = this.qs;
    const grow = pass === PASS_FILL ? 0 : g;
    if (L.hood) {
      // Hood resting behind the neck.
      ctx.beginPath();
      this.local(p, J.CHEST, sk.rt, 0, 0.035, -0.03);
      this.proj(this.wx, this.wy, this.wz);
      const ox = this.qx, oy = this.qy;
      this.local(p, J.CHEST, sk.rt, 0.078, 0.035, -0.03);
      this.proj(this.wx, this.wy, this.wz);
      const rx = Math.hypot(this.qx - ox, this.qy - oy);
      const rot = Math.atan2(this.qy - oy, this.qx - ox);
      const gp = grow * this.scale;
      ctx.ellipse(ox, oy, rx + gp, rx * 0.5 + gp, rot, 0, Math.PI * 2);
      this.paint(ctx, pass, L.hood, false);
    }
    ctx.beginPath();
    this.cap(ctx, nx, ny, (L.neckR + grow) * ns, nx + (hx - nx) * 0.7, ny + (hy - ny) * 0.7, (L.neckR * 0.92 + grow) * hs);
    this.paint(ctx, pass, L.skin, false);

    // Shorts body + the shorts legs of legs behind the torso or raised in
    // front of it (the shirt hem covers their tops; the thigh comes later).
    ctx.beginPath();
    this.smooth(ctx, this.shortsP, nP);
    this.paint(ctx, pass, L.shorts, true);
    if (L.shortsLen > 0) {
      ctx.beginPath();
      const e = pass === PASS_FILL ? 0 : 0.03;
      if (!this.legFront[0] || this.legRaised[0]) this.limb(ctx, p, J.HIP_L, J.KN_L, J.AN_L, this.legK, 0, L.shortsLen + e, 0.006 + grow, true);
      if (!this.legFront[1] || this.legRaised[1]) this.limb(ctx, p, J.HIP_R, J.KN_R, J.AN_R, this.legK, 0, L.shortsLen + e, 0.006 + grow, true);
      this.paint(ctx, pass, L.shorts, false);
    }
  }

  private shirtPart(ctx: CanvasRenderingContext2D, sk: Skeleton, pass: number): void {
    const L = this.look;
    const p = sk.p;
    const nS = SHIRT_N * 2 + 2;
    ctx.beginPath();
    this.smooth(ctx, this.shirt, nS);
    if (pass === PASS_FILL && L.hem) {
      // Thin line where the shirt overlaps the neck and shorts.
      ctx.strokeStyle = L.line;
      ctx.lineWidth = this.lineW() * 1.2;
      ctx.stroke();
    }
    this.paint(ctx, pass, L.top, true);
    if (pass !== PASS_FILL) return;
    if (L.hood) {
      // Kangaroo pocket + drawstrings.
      const q = this.quad;
      for (let i = 0; i < 4; i++) {
        const sx = i === 0 || i === 3 ? -1 : 1;
        const top = i < 2;
        this.torsoPt(p, sk.rp, J.PELVIS, sx * (top ? 0.052 : 0.074), top ? 0.1 : 0.025, 0, L.depth);
        this.proj(this.wx, this.wy, this.wz);
        q[i * 2] = this.qx;
        q[i * 2 + 1] = this.qy;
      }
      ctx.beginPath();
      this.smooth(ctx, q, 4);
      ctx.strokeStyle = L.line;
      ctx.lineWidth = this.lineW();
      ctx.stroke();
      ctx.fillStyle = L.hood;
      ctx.fill();
      ctx.beginPath();
      for (let sd = -1; sd <= 1; sd += 2) {
        this.local(p, J.CHEST, sk.rt, sd * 0.02, 0.012, 0.01);
        this.proj(this.wx, this.wy, this.wz);
        ctx.moveTo(this.qx, this.qy);
        this.local(p, J.CHEST, sk.rt, sd * 0.025, -0.07, 0.01);
        this.proj(this.wx, this.wy, this.wz);
        ctx.lineTo(this.qx, this.qy);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.008 * this.scale;
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // Limbs

  private prepareHands(sk: Skeleton): void {
    const p = sk.p;
    const hd = this.handDir;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      const el = side === 1 ? J.EL_R : J.EL_L;
      const ha = side === 1 ? J.HA_R : J.HA_L;
      let fx = p[ha * 3] - p[el * 3], fy = p[ha * 3 + 1] - p[el * 3 + 1], fz = p[ha * 3 + 2] - p[el * 3 + 2];
      const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
      fx /= fl;
      fy /= fl;
      fz /= fl;
      // Fingers can't point into the other hand: a forearm pointing across the
      // body bends the wrist so the hand points up (claps, cross punches).
      const med = Math.max(0, -side * fx);
      let hx = fx + side * med * 0.75, hy = fy + med * 0.8;
      const hz = fz;
      const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      hx /= hl;
      hy /= hl;
      const o = s * 5;
      hd[o] = hx;
      hd[o + 1] = hy;
      hd[o + 2] = hz / hl;
      // Thumb: palm toward the viewer -> thumb = -side * (h x z).
      hd[o + 3] = -side * hy;
      hd[o + 4] = side * hx;
    }
  }

  private arm(ctx: CanvasRenderingContext2D, sk: Skeleton, side: number, pass: number): void {
    const L = this.look;
    const p = sk.p;
    const sh = side === 1 ? J.SH_R : J.SH_L;
    const el = side === 1 ? J.EL_R : J.EL_L;
    const ha = side === 1 ? J.HA_R : J.HA_L;
    const open = side === 1 ? sk.handR : sk.handL;
    const col = side === 1 ? SIDE.right : SIDE.left;
    const dark = side === 1 ? SIDE.rightDark : SIDE.leftDark;
    const k = this.armK;
    const fill = pass === PASS_FILL;
    const g = fill ? 0 : this.grow;

    // Skin arm (+ the cloth radius where a sleeve covers it, so the outline fits).
    ctx.beginPath();
    if (!fill) {
      ctx.beginPath();
      this.limb(ctx, p, sh, el, ha, k, 0, 2, g);
      if (L.sleeve) this.limb(ctx, p, sh, el, ha, k, L.sleeve[0], L.sleeve[1] + 0.03, 0.004 + g, true);
      if (L.cuff) this.limb(ctx, p, sh, el, ha, k, L.cuff[0] - 0.03, L.cuff[1] + 0.03, 0.006 + g, true);
      this.paint(ctx, pass, L.skin, false);
      this.hand(ctx, p, ha, side, open, pass);
      return;
    }
    // The hand covers the last bit of the forearm, so a sleeve to the wrist hides the skin.
    this.skin(ctx, p, sh, el, ha, k, 0, L.sleeve, 0.07);
    if (L.sleeve) this.cover(ctx, p, sh, el, ha, k, L.sleeve[0], L.sleeve[1], 0.004, col);
    if (L.cuff) this.cover(ctx, p, sh, el, ha, k, L.cuff[0], L.cuff[1], 0.006, dark);
    this.hand(ctx, p, ha, side, open, pass);
  }

  /** A side-colour cover on a limb, with a thin line across each hem. */
  private cover(ctx: CanvasRenderingContext2D, p: Float64Array, j0: number, j1: number, j2: number, k: Float64Array, a: number, b: number, thick: number, color: string, hemStart = true): void {
    const L = this.look;
    this.hemN = 0;
    ctx.beginPath();
    this.limb(ctx, p, j0, j1, j2, k, a, b, thick, true, hemStart);
    ctx.fillStyle = color;
    ctx.fill();
    const n = this.hemN;
    if (L.hem && n > 0) {
      const h = this.hems;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        ctx.moveTo(h[i * 4], h[i * 4 + 1]);
        ctx.lineTo(h[i * 4 + 2], h[i * 4 + 3]);
      }
      ctx.strokeStyle = L.line;
      ctx.lineWidth = this.lineW();
      ctx.stroke();
    }
  }

  /**
   * Skin of a limb where no full cover hides it: [0, a] and [b, 2] around the
   * cover span (with a little overlap under the cover), or all of it.
   */
  private skin(ctx: CanvasRenderingContext2D, p: Float64Array, j0: number, j1: number, j2: number, k: Float64Array, from: number, cover: Span | null, minEnd: number): void {
    const a = cover ? cover[0] : 2, b = cover ? cover[1] : 2;
    ctx.beginPath();
    if (a > from + 0.001) this.limb(ctx, p, j0, j1, j2, k, from, Math.min(2, a + 0.04), 0);
    if (cover && 2 - b > minEnd) this.limb(ctx, p, j0, j1, j2, k, Math.max(from, b - 0.04), 2, 0);
    ctx.fillStyle = this.look.skin;
    ctx.fill();
  }


  private hand(ctx: CanvasRenderingContext2D, p: Float64Array, ha: number, side: number, open: number, pass: number): void {
    const L = this.look;
    const o = open < 0 ? 0 : open > 1 ? 1 : open;
    const hs = L.hand;
    const d = this.handDir;
    const b = side === 1 ? 0 : 5;
    const hx = d[b], hy = d[b + 1], hz = d[b + 2], tx = d[b + 3], ty = d[b + 4];
    const ax = p[ha * 3], ay = p[ha * 3 + 1], az = p[ha * 3 + 2];
    const g = pass === PASS_FILL ? 0 : this.grow;
    // Palm: root circle near the wrist, tip circle further out when open.
    const r0 = 0.026 * hs, r1 = (0.021 + 0.007 * (1 - o)) * hs;
    const d0 = 0.014 * hs, d1 = (0.014 + 0.046 * o) * hs;
    this.proj(ax + hx * d0, ay + hy * d0, az + hz * d0);
    const px0 = this.qx, py0 = this.qy, s0 = this.qs;
    this.proj(ax + hx * d1, ay + hy * d1, az + hz * d1);
    const px1 = this.qx, py1 = this.qy, s1 = this.qs;
    // Thumb: from the base of the palm out to the thumb side.
    const tb = 0.012 * hs, te = (0.026 + 0.014 * o) * hs, tw = (0.028 + 0.01 * o) * hs;
    this.proj(ax + hx * tb + tx * 0.008 * hs, ay + hy * tb + ty * 0.008 * hs, az + hz * tb);
    const tx0 = this.qx, ty0 = this.qy, ts0 = this.qs;
    this.proj(ax + hx * te + tx * tw, ay + hy * te + ty * tw, az + hz * te);
    const tx1 = this.qx, ty1 = this.qy, ts1 = this.qs;
    const tr = 0.0105 * hs;
    if (pass !== PASS_FILL) {
      ctx.beginPath();
      this.cap(ctx, px0, py0, (r0 + g) * s0, px1, py1, (r1 + g) * s1);
      this.cap(ctx, tx0, ty0, (tr + g) * ts0, tx1, ty1, (tr * 0.9 + g) * ts1);
      this.paint(ctx, pass, L.skin, false);
      return;
    }
    const fist = o < 0.45;
    if (!fist) this.thumb(ctx, tx0, ty0, tr * ts0, tx1, ty1, tr * 0.9 * ts1);
    ctx.beginPath();
    this.cap(ctx, px0, py0, r0 * s0, px1, py1, r1 * s1);
    ctx.fillStyle = L.skin;
    ctx.fill();
    if (fist) {
      // Thumb folded over the fingers: a short crease, only when it reads.
      const ddx = tx1 - tx0, ddy = ty1 - ty0;
      if (ddx * ddx + ddy * ddy > (0.012 * s0) * (0.012 * s0)) {
        ctx.strokeStyle = L.skinLine;
        ctx.lineWidth = Math.max(1, 0.0075 * s0);
        ctx.beginPath();
        ctx.moveTo(px0 + (tx0 - px0) * 0.3, py0 + (ty0 - py0) * 0.3);
        ctx.lineTo(tx1 + (px1 - tx1) * 0.35, ty1 + (py1 - ty1) * 0.35);
        ctx.stroke();
      }
    }
  }

  private thumb(ctx: CanvasRenderingContext2D, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): void {
    const L = this.look;
    const e = this.olPx * 0.5;
    ctx.beginPath();
    this.cap(ctx, x0, y0, r0 + e, x1, y1, r1 + e);
    ctx.fillStyle = L.outline;
    ctx.fill();
    ctx.beginPath();
    this.cap(ctx, x0, y0, r0, x1, y1, r1);
    ctx.fillStyle = L.skin;
    ctx.fill();
  }

  private leg(ctx: CanvasRenderingContext2D, sk: Skeleton, side: number, pass: number): void {
    const L = this.look;
    const p = sk.p;
    const hip = side === 1 ? J.HIP_R : J.HIP_L;
    const kn = side === 1 ? J.KN_R : J.KN_L;
    const an = side === 1 ? J.AN_R : J.AN_L;
    const toe = side === 1 ? J.TOE_R : J.TOE_L;
    const col = side === 1 ? SIDE.right : SIDE.left;
    const dark = side === 1 ? SIDE.rightDark : SIDE.leftDark;
    const k = this.legK;
    const fill = pass === PASS_FILL;
    const g = fill ? 0 : this.grow;
    const front = this.legFront[side === 1 ? 1 : 0] === 1;
    // A thigh raised toward the viewer (knee lifts) is in front of its own
    // shorts leg, which the torso already drew: start the thigh past the hem.
    const raised = this.legRaised[side === 1 ? 1 : 0] === 1;
    const t0 = raised ? Math.max(0.15, L.shortsLen * 0.85) : 0;

    if (!fill) {
      ctx.beginPath();
      this.limb(ctx, p, hip, kn, an, k, t0, 2, g);
      if (L.legCover) this.limb(ctx, p, hip, kn, an, k, Math.max(t0, L.legCover[0] - 0.03), L.legCover[1], 0.004 + g, true);
      this.paint(ctx, pass, L.skin, false);
    } else {
      // The shoe hides the ankle, so leggings to the ankle hide the skin.
      this.skin(ctx, p, hip, kn, an, k, t0, L.legCover, 0.08);
      if (L.legCover) {
        const a = Math.max(t0, L.legCover[0]);
        this.cover(ctx, p, hip, kn, an, k, a, L.legCover[1], 0.004, col, a > t0);
      }
    }
    // Shorts leg (the torso draws it for legs behind it).
    if (front && !raised && L.shortsLen > 0) {
      if (fill) this.cover(ctx, p, hip, kn, an, k, 0, L.shortsLen, 0.006, L.shorts);
      else {
        ctx.beginPath();
        this.limb(ctx, p, hip, kn, an, k, 0, L.shortsLen + 0.03, 0.006 + g, true);
        this.paint(ctx, pass, L.shorts, false);
      }
    }
    // Shoe last: its collar wraps the ankle.
    this.shoe(ctx, p, an, kn, toe, side, pass, col, dark);
  }

  /**
   * Sneaker in a screen-space frame from heel to toe: flat sole, round toe
   * box, collar at the ankle. Seen mostly from the front, the toes point
   * out and toward the viewer; a lifted foot turns with the shin.
   */
  private shoe(ctx: CanvasRenderingContext2D, p: Float64Array, an: number, kn: number, toe: number, side: number, pass: number, col: string, dark: string): void {
    const L = this.look;
    const ax = p[an * 3], ay = p[an * 3 + 1], az = p[an * 3 + 2];
    const FLOOR = 0.034;
    this.proj(ax, ay < FLOOR ? FLOOR : ay, az - 0.008);
    const hx = this.qx, hy = this.qy, s = this.qs;
    let ty = ay + (p[toe * 3 + 1] - ay) * 1.25;
    if (ty < FLOOR) ty = FLOOR;
    this.proj(ax + (p[toe * 3] - ax) * 1.25, ty, az + (p[toe * 3 + 2] - az) * 1.25);
    const dx = this.qx - hx, dy = this.qy - hy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    // Toes pointing at the viewer project short (and down a lifted shin):
    // blend toward a front-view sneaker turned out, keep a readable length.
    let w = 1.25 - d / (0.09 * s);
    w = w < 0 ? 0 : w > 1 ? 1 : w;
    let ux = (dx / d) * (1 - w) + side * 0.97 * w, uy = (dy / d) * (1 - w) + 0.24 * w;
    const ul = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= ul;
    uy /= ul;
    const len = Math.max(d, 0.042 * s);
    // "Up" in the shoe frame: perpendicular, toward the knee.
    let nx = uy, ny = -ux;
    if (nx * (this.pxOf(p, kn) - hx) + ny * (this.pyOf(p, kn) - hy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    this.shx = hx;
    this.shy = hy;
    this.sax = ux;
    this.say = uy;
    this.snx = nx;
    this.sny = ny;
    this.sL = len;
    this.sS = s;
    const sole = 0.01 * s;
    ctx.beginPath();
    this.shoePath(ctx, -sole);
    if (pass !== PASS_FILL) {
      this.shoePath(ctx, 0);
      this.paint(ctx, pass, '', true);
      return;
    }
    ctx.fillStyle = L.sole === 'side' ? dark : L.sole;
    ctx.fill();
    ctx.beginPath();
    this.shoePath(ctx, 0);
    if (L.hem) {
      ctx.strokeStyle = L.line;
      ctx.lineWidth = this.lineW();
      ctx.stroke();
    }
    ctx.fillStyle = L.shoeUpper === 'side' ? col : L.shoeUpper;
    ctx.fill();
    // Lace stripe across the instep in the other tone.
    ctx.strokeStyle = L.shoeUpper === 'side' ? (L.sole === 'side' ? '#ffffff' : L.sole) : col;
    ctx.lineWidth = 0.009 * s;
    ctx.beginPath();
    this.sp(ctx, true, this.sL * 0.05, 0.01 * s);
    this.sp(ctx, false, this.sL * 0.55, -0.002 * s);
    ctx.stroke();
  }

  private pxOf(p: Float64Array, j: number): number {
    this.proj(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
    return this.qx;
  }
  private pyOf(p: Float64Array, j: number): number {
    this.proj(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
    return this.qy;
  }

  /** moveTo / lineTo a point (u along, v up) in the shoe frame. */
  private sp(ctx: CanvasRenderingContext2D, move: boolean, u: number, v: number): void {
    const x = this.shx + this.sax * u + this.snx * (v + this.sSh);
    const y = this.shy + this.say * u + this.sny * (v + this.sSh);
    if (move) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  /** quadraticCurveTo in the shoe frame. */
  private sq(ctx: CanvasRenderingContext2D, cu: number, cv: number, u: number, v: number): void {
    const a = this.sax, b = this.say, n = this.snx, m = this.sny, o = this.sSh;
    ctx.quadraticCurveTo(this.shx + a * cu + n * (cv + o), this.shy + b * cu + m * (cv + o), this.shx + a * u + n * (v + o), this.shy + b * u + m * (v + o));
  }

  private shoePath(ctx: CanvasRenderingContext2D, shift: number): void {
    const s = this.sS, Lf = this.sL;
    this.sSh = shift;
    const rb = 0.022 * s, rt = 0.024 * s, h = 0.024 * s, top = 0.02 * s;
    this.sp(ctx, true, -rb * 0.4, -h);
    this.sp(ctx, false, Lf, -h);
    this.sq(ctx, Lf + rt * 1.25, -h, Lf + rt * 1.15, -h + rt * 0.85);
    this.sq(ctx, Lf + rt * 0.95, 0.006 * s, Lf * 0.42, 0.012 * s);
    this.sq(ctx, Lf * 0.08, top, -rb * 0.3, top);
    this.sq(ctx, -rb * 1.3, top * 0.95, -rb * 1.15, 0);
    this.sq(ctx, -rb * 1.1, -h, -rb * 0.4, -h);
    ctx.closePath();
    this.sSh = 0;
  }

  // -------------------------------------------------------------------------
  // Head

  /** Head centre: a little above the skeleton's head joint (smaller human head). */
  private headCentre(p: Float64Array): void {
    const k = 1.2;
    this.wx = p[J.NECK * 3] + (p[J.HEAD * 3] - p[J.NECK * 3]) * k;
    this.wy = p[J.NECK * 3 + 1] + (p[J.HEAD * 3 + 1] - p[J.NECK * 3 + 1]) * k;
    this.wz = p[J.NECK * 3 + 2] + (p[J.HEAD * 3 + 2] - p[J.NECK * 3 + 2]) * k;
  }

  private updateSpring(px: Float64Array, ps: Float64Array, t: number, mini: boolean): void {
    if (mini) return;
    const hx = px[J.HEAD * 2], hy = px[J.HEAD * 2 + 1];
    const scale = this.scale;
    if (!Number.isNaN(this.lastT) && t > this.lastT && t - this.lastT < 0.2) {
      const dt = t - this.lastT;
      const vx = (hx - this.lastHx) / scale / dt;
      const vy = (hy - this.lastHy) / scale / dt;
      const target = Math.max(-0.9, Math.min(0.9, -vx * 0.6 + vy * 0.25));
      this.tailV += ((target - this.tailA) * 90 - this.tailV * 9) * dt;
      this.tailA += this.tailV * dt;
    }
    this.lastHx = hx;
    this.lastHy = hy;
    this.lastT = t;
    void ps;
  }

  private head(ctx: CanvasRenderingContext2D, sk: Skeleton, pass: number, mini: boolean): void {
    const L = this.look;
    const p = sk.p;
    this.headCentre(p);
    const cx3 = this.wx, cy3 = this.wy, cz3 = this.wz;
    this.proj(cx3, cy3, cz3);
    const hx = this.qx, hy = this.qy, s = this.qs;
    // Orientation: roll from the head's up axis, facing from its forward axis.
    const ux = p[J.HEAD_UP * 3] - p[J.HEAD * 3], uy = p[J.HEAD_UP * 3 + 1] - p[J.HEAD * 3 + 1];
    const roll = Math.atan2(ux, uy);
    const fx = p[J.HEAD_FWD * 3] - p[J.HEAD * 3];
    const fy = p[J.HEAD_FWD * 3 + 1] - p[J.HEAD * 3 + 1];
    const rx = L.headRx * s, ry = L.headRy * s;
    const g = pass === PASS_FILL ? 0 : this.grow * this.scale;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(roll);
    const fo = Math.max(-0.6, Math.min(0.6, fx * 1.6)) * rx; // face shift with turn
    const lift = Math.max(-0.4, Math.min(0.4, -fy * 1.5)) * ry; // + = looking down

    // Back hair (behind the head).
    this.backHair(ctx, pass, rx, ry, g, s, mini);
    // Ears + face.
    ctx.beginPath();
    const ex = rx * 0.97;
    const ey = ry * 0.08 + lift * 0.3;
    ctx.moveTo(-ex - fo * 0.4 + rx * 0.17 + g, ey);
    ctx.ellipse(-ex - fo * 0.4, ey, rx * 0.17 + g, ry * 0.2 + g, 0, 0, Math.PI * 2);
    ctx.moveTo(ex - fo * 0.4 + rx * 0.17 + g, ey);
    ctx.ellipse(ex - fo * 0.4, ey, rx * 0.17 + g, ry * 0.2 + g, 0, 0, Math.PI * 2);
    this.face(ctx, rx + g, ry + g, fo * 0.25);
    if (pass === PASS_FILL) {
      ctx.fillStyle = L.skin;
      ctx.fill();
    } else {
      ctx.fillStyle = L.outline;
      ctx.fill();
    }
    if (pass === PASS_FILL) {
      // Inner ear line so the ears read against the face.
      ctx.strokeStyle = L.skinLine;
      ctx.lineWidth = Math.max(1, this.olPx * 0.5);
      ctx.beginPath();
      ctx.moveTo(-ex - fo * 0.4 + rx * 0.06, ey - ry * 0.08);
      ctx.lineTo(-ex - fo * 0.4 + rx * 0.06, ey + ry * 0.06);
      ctx.moveTo(ex - fo * 0.4 - rx * 0.06, ey - ry * 0.08);
      ctx.lineTo(ex - fo * 0.4 - rx * 0.06, ey + ry * 0.06);
      ctx.stroke();
      this.frontHair(ctx, rx, ry, fo, s);
      if (!mini) this.features(ctx, rx, ry, fo, lift);
    }
    ctx.restore();
  }

  /** Egg-shaped face outline (local, y down), slightly shifted toward where it faces. */
  private face(ctx: CanvasRenderingContext2D, rx: number, ry: number, fo: number): void {
    ctx.moveTo(0, -ry);
    ctx.bezierCurveTo(rx * 0.56, -ry, rx, -ry * 0.6, rx, -ry * 0.08);
    ctx.bezierCurveTo(rx, ry * 0.42, rx * 0.5 + fo, ry, fo, ry);
    ctx.bezierCurveTo(-rx * 0.5 + fo, ry, -rx, ry * 0.42, -rx, -ry * 0.08);
    ctx.bezierCurveTo(-rx, -ry * 0.6, -rx * 0.56, -ry, 0, -ry);
    ctx.closePath();
  }

  private backHair(ctx: CanvasRenderingContext2D, pass: number, rx: number, ry: number, g: number, s: number, mini: boolean): void {
    const L = this.look;
    const fill = pass === PASS_FILL;
    if (L.hairStyle === 'ponytail') {
      // High ponytail: a teardrop hanging from the crown, swinging with the spring.
      const a = 0.62 + (mini ? 0 : this.tailA) * 0.9;
      const bx = rx * 0.15, by = -ry * 0.82;
      const len = ry * 2.5;
      const dx = Math.sin(a), dy = Math.cos(a);
      const nx = -dy, ny = dx;
      const w0 = rx * 0.32 + g, w1 = rx * 0.48 + g;
      const mx = bx + dx * len * 0.45, my = by + dy * len * 0.45;
      const tx = bx + dx * (len + g), ty = by + dy * (len + g);
      ctx.beginPath();
      ctx.moveTo(bx + nx * w0, by + ny * w0);
      ctx.quadraticCurveTo(mx + nx * w1 * 1.5, my + ny * w1 * 1.5, tx, ty);
      ctx.quadraticCurveTo(mx - nx * w1 * 1.5, my - ny * w1 * 1.5, bx - nx * w0, by - ny * w0);
      ctx.closePath();
      this.flat(ctx, pass, L.hair);
      if (fill && L.band) {
        ctx.beginPath();
        ctx.ellipse(bx + dx * rx * 0.1, by + dy * rx * 0.1, rx * 0.26, rx * 0.17, a, 0, Math.PI * 2);
        ctx.fillStyle = L.band;
        ctx.fill();
      }
    } else if (L.hairStyle === 'puff') {
      // Curly puff: a scalloped cloud behind and above the head.
      const bounce = mini ? 0 : this.tailA * 0.06;
      const pcx = this.tailA * rx * (mini ? 0 : 0.1), pcy = -ry * (0.55 + bounce);
      const R = rx * 1.42;
      ctx.beginPath();
      ctx.moveTo(pcx + R * 0.8 + g, pcy);
      ctx.arc(pcx, pcy, R * 0.8 + g, 0, Math.PI * 2);
      const n = 11;
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + 0.2;
        const bx = pcx + Math.cos(an) * R * 0.78, by = pcy + Math.sin(an) * R * 0.72;
        const br = R * 0.3 + g;
        ctx.moveTo(bx + br, by);
        ctx.arc(bx, by, br, 0, Math.PI * 2);
      }
      this.flat(ctx, pass, L.hair);
    }
    void s;
  }

  private flat(ctx: CanvasRenderingContext2D, pass: number, color: string): void {
    const L = this.look;
    ctx.fillStyle = pass === PASS_FILL ? color : L.outline;
    ctx.fill();
  }

  private frontHair(ctx: CanvasRenderingContext2D, rx: number, ry: number, fo: number, s: number): void {
    const L = this.look;
    ctx.beginPath();
    const f = fo * 0.5;
    if (L.hairStyle === 'puff') {
      // Hairline under the puff.
      ctx.moveTo(-rx * 1.02, -ry * 0.05);
      ctx.bezierCurveTo(-rx * 1.06, -ry * 0.8, -rx * 0.6, -ry * 1.12, f, -ry * 1.12);
      ctx.bezierCurveTo(rx * 0.6, -ry * 1.12, rx * 1.06, -ry * 0.8, rx * 1.02, -ry * 0.05);
      ctx.bezierCurveTo(rx * 0.85, -ry * 0.4, rx * 0.45 + f, -ry * 0.55, f, -ry * 0.5);
      ctx.bezierCurveTo(-rx * 0.45 + f, -ry * 0.55, -rx * 0.85, -ry * 0.4, -rx * 1.02, -ry * 0.05);
    } else {
      // Swept fringe (ponytail look): side part, fuller on one side.
      ctx.moveTo(-rx * 1.04, -ry * 0.02);
      ctx.bezierCurveTo(-rx * 1.1, -ry * 0.82, -rx * 0.6, -ry * 1.12, f, -ry * 1.12);
      ctx.bezierCurveTo(rx * 0.62, -ry * 1.12, rx * 1.1, -ry * 0.82, rx * 1.04, -ry * 0.02);
      ctx.bezierCurveTo(rx * 0.86, -ry * 0.3, rx * 0.6 + f, -ry * 0.38, rx * 0.25 + f, -ry * 0.62);
      ctx.bezierCurveTo(-rx * 0.1 + f, -ry * 0.42, -rx * 0.8, -ry * 0.44, -rx * 1.04, -ry * 0.02);
    }
    ctx.closePath();
    ctx.fillStyle = L.hair;
    ctx.fill();
    if (L.band && L.hairStyle === 'puff') {
      // Wide headband between the hairline and the puff.
      ctx.strokeStyle = L.band;
      ctx.lineWidth = ry * 0.24;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.ellipse(f * 0.5, -ry * 0.1, rx * 0.98, ry * 0.86, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.lineCap = 'round';
    }
    void s;
  }

  private features(ctx: CanvasRenderingContext2D, rx: number, ry: number, fo: number, lift: number): void {
    const L = this.look;
    const ex = fo * 0.75, ey = ry * 0.06 + lift * 0.5;
    const sp = rx * 0.4;
    // Eyes.
    ctx.fillStyle = L.eye;
    ctx.beginPath();
    ctx.ellipse(ex - sp, ey, rx * 0.105, ry * 0.12, 0, 0, Math.PI * 2);
    ctx.moveTo(ex + sp + rx * 0.105, ey);
    ctx.ellipse(ex + sp, ey, rx * 0.105, ry * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brows.
    ctx.strokeStyle = L.hair;
    ctx.lineWidth = ry * 0.07;
    ctx.beginPath();
    ctx.moveTo(ex - sp - rx * 0.17, ey - ry * 0.2);
    ctx.quadraticCurveTo(ex - sp, ey - ry * 0.28, ex - sp + rx * 0.16, ey - ry * 0.21);
    ctx.moveTo(ex + sp - rx * 0.16, ey - ry * 0.21);
    ctx.quadraticCurveTo(ex + sp, ey - ry * 0.28, ex + sp + rx * 0.17, ey - ry * 0.2);
    ctx.stroke();
    // Blush.
    if (L.blush) {
      ctx.fillStyle = L.blush;
      ctx.beginPath();
      ctx.ellipse(ex - sp * 1.2, ey + ry * 0.26, rx * 0.15, ry * 0.08, 0, 0, Math.PI * 2);
      ctx.moveTo(ex + sp * 1.2 + rx * 0.15, ey + ry * 0.26);
      ctx.ellipse(ex + sp * 1.2, ey + ry * 0.26, rx * 0.15, ry * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nose + smile.
    ctx.strokeStyle = L.skinLine;
    ctx.lineWidth = ry * 0.06;
    ctx.beginPath();
    ctx.moveTo(ex * 1.15 + rx * 0.02, ey + ry * 0.12);
    ctx.quadraticCurveTo(ex * 1.15 + rx * 0.1, ey + ry * 0.26, ex * 1.15 - rx * 0.04, ey + ry * 0.3);
    ctx.stroke();
    ctx.strokeStyle = L.eye;
    ctx.lineWidth = ry * 0.07;
    ctx.beginPath();
    const mx = ex * 1.1, my = ey + ry * 0.45;
    ctx.moveTo(mx - rx * 0.26, my - ry * 0.02);
    ctx.quadraticCurveTo(mx, my + ry * 0.16, mx + rx * 0.26, my - ry * 0.02);
    ctx.stroke();
  }
}

/** Number of joints (re-exported for the dispatcher's scratch sizes). */
export const HUMAN_JOINTS = NUM_JOINTS;

// ---------------------------------------------------------------------------
// Looks

export const LOOKS: Readonly<Record<'human' | 'sticker', HumanLook>> = {
  /** Stylised human: slim build, outlined illustration, ponytail, tee + shorts over two-tone leggings. */
  human: {
    neckW: 0.03,
    neckR: 0.025,
    shoulderW: 0.136,
    chestW: 0.108,
    waistW: 0.08,
    hipW: 0.116,
    depth: 0.05,
    arm: [0.033, 0.026, 0.027, 0.019],
    leg: [0.047, 0.034, 0.037, 0.022],
    headRx: 0.06,
    headRy: 0.075,
    hand: 1,
    shoe: [0.024, 0.027],
    skin: '#f0c29c',
    skinLine: '#b9785a',
    hair: '#3a2217',
    hairStyle: 'ponytail',
    band: '#ffd84a',
    top: '#f7f3ff',
    hemY: -0.004,
    neckDip: 0.004,
    sleeve: [0, 0.5],
    cuff: [1.84, 1.97],
    shorts: '#7a5cff',
    shortsLen: 0.3,
    legCover: [0, 1.96],
    shoeUpper: '#f7f3ff',
    sole: 'side',
    outline: '#120e1f',
    line: '#120e1f',
    ol: 0.0105,
    hem: true,
    hood: null,
    eye: '#1b1022',
    blush: null,
  },
  /** Soft sticker: fuller build, light cut-out outlines, curly puff, hoodie and two-tone joggers. */
  sticker: {
    neckW: 0.034,
    neckR: 0.029,
    shoulderW: 0.14,
    chestW: 0.128,
    waistW: 0.118,
    hipW: 0.132,
    depth: 0.07,
    arm: [0.04, 0.033, 0.034, 0.024],
    leg: [0.064, 0.043, 0.046, 0.027],
    headRx: 0.066,
    headRy: 0.076,
    hand: 1.1,
    shoe: [0.026, 0.029],
    skin: '#7d4b31',
    skinLine: '#4a2616',
    hair: '#1c1311',
    hairStyle: 'puff',
    band: '#ffd84a',
    top: '#c3b2ff',
    hemY: -0.075,
    neckDip: 0.0,
    sleeve: [0, 1.95],
    cuff: [1.8, 1.95],
    shorts: '#4a3d80',
    shortsLen: 0,
    legCover: [0, 1.97],
    shoeUpper: '#fff7ea',
    sole: 'side',
    outline: '#fff4e2',
    line: '#2a1838',
    ol: 0.011,
    hem: true,
    hood: '#b29ff6',
    eye: '#1a0d12',
    blush: '#c0566a',
  },
};
