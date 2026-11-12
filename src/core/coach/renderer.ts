/**
 * Canvas 2D renderer for the coach, its stage and the "next move" strip.
 *
 * Design: a chunky, rounded figure with thick dark outlines so it reads on a
 * washed-out projector from across a room. The coach is a mirror: the user's
 * RIGHT limbs are on the screen-right side and are coral; the LEFT limbs are
 * teal. A yellow headband with trailing tails gives the head some secondary
 * motion. The background is a calm dark stage whose glow follows section
 * energy with a gentle pulse (no flashing).
 *
 * The figure's look is a pluggable style (styles.ts): 'classic' is drawn
 * here; the human-proportioned styles live in humanPainter.ts. The stage
 * (background, shadow, now / next / then strip) is shared by every style.
 *
 * The per-frame path avoids allocations (gradients are cached per resize).
 */

import { findMove } from '../choreo/moves';
import { PoseEvaluator } from './animator';
import { HumanPainter, humanLook } from './humanPainter';
import { loopPlan, type LoopPlan } from './loop';
import { DirtyRects, MAX_SLOTS, makeLayer } from './dirty';
import { BODY, J, NUM_JOINTS, createPose, createSkeleton, solveSkeleton, type Skeleton } from './skeleton';
import { CAM, DEFAULT_COACH_BUILD, DEFAULT_COACH_STYLE, PIV_Y, type CoachBuild, type CoachStyle } from './styles';

export const COLORS = {
  bg0: '#0f0d17',
  bg1: '#1b1430',
  floor: '#211a36',
  outline: '#120e1f',
  body: '#f7f3ff',
  shorts: '#8a6cff',
  right: '#ff5c8a',
  rightDark: '#c23462',
  rightLight: '#ffd0dc',
  left: '#33dcb4',
  leftDark: '#16967a',
  leftLight: '#c6fff0',
  band: '#ffd84a',
  ink: '#f7f4ff',
  muted: '#b5aed0',
  panel: 'rgba(30, 26, 44, 0.82)',
  panelLine: '#3a3452',
} as const;


/** Widths in figure units. */
/** How far the feet and their shadow reach below the floor line (× scale). */
const FEET_BELOW_FLOOR = 0.05;

const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

/**
 * Fit one line of text into maxW: shrink the font from `size` down to
 * `size * floor`, then (if still too wide) cut it with an ellipsis. Measures
 * at the whole-pixel size that is drawn and keeps a small margin (4%).
 */
export function fitText(
  c: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  size: number,
  weight: number,
  floor: number,
  font: string,
): { size: number; text: string } {
  const limit = Math.max(1, maxW * 0.96);
  const measure = (t: string, s: number) => {
    c.font = `${weight} ${s}px ${font}`;
    return c.measureText(t).width;
  };
  let s = Math.max(1, Math.round(size));
  let w = measure(text, s);
  if (w <= limit) return { size: s, text };
  const min = Math.max(1, Math.round(size * floor));
  s = Math.max(min, Math.floor((s * limit) / w));
  w = measure(text, s);
  while (w > limit && s > min) w = measure(text, --s);
  if (w <= limit) return { size: s, text };
  // Still too wide at the floor: ellipsize.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid).trimEnd() + '…', s) <= limit) lo = mid;
    else hi = mid - 1;
  }
  return { size: s, text: lo > 0 ? text.slice(0, lo).trimEnd() + '…' : '…' };
}

const W_NECK = 0.055;

/**
 * Classic build per version. The female one is the original figure (pinched
 * waist, short shorts, headband with trailing tails); the male one is broader
 * across the shoulders, straighter, with thicker limbs, long shorts, a short
 * flat-top crop under a sweatband and a jersey stripe.
 */
interface ClassicBuild {
  upper: number;
  fore: number;
  thigh: number;
  shin: number;
  /** Extra shoulder width past the shoulder joints (units). */
  shoulderOut: number;
  /** Waist half-width as a fraction of the shoulder line (smaller = more pinched). */
  waist: number;
  capR: number;
  /** How far the shorts reach down the thigh (0..1). */
  shorts: number;
  male: boolean;
}
const CLASSIC: Record<CoachBuild, ClassicBuild> = {
  female: { upper: 0.06, fore: 0.054, thigh: 0.08, shin: 0.066, shoulderOut: 0, waist: 0.36, capR: 0.045, shorts: 0.3, male: false },
  male: { upper: 0.07, fore: 0.062, thigh: 0.086, shin: 0.071, shoulderOut: 0.03, waist: 0.47, capR: 0.054, shorts: 0.62, male: true },
};
const W_FOOT = 0.054;
const OUTLINE = 0.014;

export interface FigureOptions {
  /** Simplified drawing for thumbnails (no face, thinner outline). */
  mini?: boolean;
  /** Floor shadow. */
  shadow?: boolean;
  alpha?: number;
}

/**
 * Draws a solved skeleton. Holds per-figure state (headband tails), so use one
 * painter per on-screen figure.
 */
export class FigurePainter {
  /** Look of the figure; 'classic' is the original cartoon. */
  style: CoachStyle = DEFAULT_COACH_STYLE;
  /** Female or male version of the look. */
  build: CoachBuild = DEFAULT_COACH_BUILD;
  /**
   * Recolour the top (two-player identity): the classic torso, or the human
   * looks' shirt (+ hood). null = the look's own colours.
   */
  tint: { top: string; hood: string } | null = null;
  private tintedLook: { key: string; look: ReturnType<typeof humanLook> } | null = null;
  private human: HumanPainter | null = null;
  private readonly px = new Float64Array(NUM_JOINTS * 2);
  private readonly ps = new Float64Array(NUM_JOINTS);
  private readonly order = new Int8Array(6);
  private readonly zkey = new Float64Array(6);
  private readonly wide = new Float64Array(8);
  private sk3: Float64Array | null = null;
  // Headband tail state (spring).
  private tailA = 0;
  private tailV = 0;
  private lastHx = NaN;
  private lastHy = NaN;
  private lastT = NaN;

  /** Project the skeleton for a figure standing at (cx, floorY) with `scale` px per unit. */
  project(sk: Skeleton, cx: number, floorY: number, scale: number): void {
    const p = sk.p;
    for (let j = 0; j < NUM_JOINTS; j++) {
      const x = p[j * 3], y = p[j * 3 + 1], z = p[j * 3 + 2];
      const s = CAM / (CAM - z);
      this.ps[j] = s;
      this.px[j * 2] = cx + x * s * scale;
      this.px[j * 2 + 1] = floorY - (PIV_Y + (y - PIV_Y) * s) * scale;
    }
  }

  /**
   * Screen box (x0, y0, x1, y1 into out[o..o+3]) that draw() with the same
   * arguments stays inside: the projected joints plus room for the look's
   * outlines, hair, hands, feet and floor shadow. For dirty-rectangle redraws.
   */
  bounds(sk: Skeleton, cx: number, floorY: number, scale: number, out: Float64Array, o = 0): void {
    this.project(sk, cx, floorY, scale);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, smax = 1;
    for (let j = 0; j < NUM_JOINTS; j++) {
      const x = this.px[j * 2], y = this.px[j * 2 + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (this.ps[j] > smax) smax = this.ps[j];
    }
    const m = (this.style === 'classic' ? 0.24 : 0.27) * scale * smax + 4;
    out[o] = x0 - m;
    out[o + 1] = y0 - m;
    out[o + 2] = x1 + m;
    // The floor shadow sits a little below the floor line.
    out[o + 3] = Math.max(y1 + m, floorY + 0.06 * scale);
  }

  /** Screen position of joint j after project(). */
  jx(j: number): number {
    return this.px[j * 2];
  }
  jy(j: number): number {
    return this.px[j * 2 + 1];
  }

  draw(ctx: CanvasRenderingContext2D, sk: Skeleton, cx: number, floorY: number, scale: number, t: number, o: FigureOptions = {}): void {
    this.project(sk, cx, floorY, scale);
    this.sk3 = sk.p;
    const mini = !!o.mini;
    if (this.style !== 'classic') {
      const look = this.lookNow();
      if (!this.human) this.human = new HumanPainter(look);
      else if (this.human.look !== look) this.human.setLook(look);
      ctx.save();
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (o.shadow !== false) this.shadow(ctx, sk, cx, floorY, scale);
      this.human.draw(ctx, sk, this.px, this.ps, cx, floorY, scale, t, mini);
      ctx.restore();
      return;
    }
    const ol = (mini ? OUTLINE * 0.8 : OUTLINE) * scale;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (o.shadow !== false) this.shadow(ctx, sk, cx, floorY, scale);

    // Draw order: 0 legL, 1 legR, 2 torso, 3 head, 4 armL, 5 armR.
    const p = sk.p;
    const zArm = (e: number, h: number) => (p[e * 3 + 2] + p[h * 3 + 2]) * 0.5;
    const zLeg = (k: number, a: number) => (p[k * 3 + 2] + p[a * 3 + 2]) * 0.5;
    const zk = this.zkey;
    const lz = zLeg(J.KN_L, J.AN_L), rz = zLeg(J.KN_R, J.AN_R);
    zk[0] = lz > 0.1 ? 0.15 + lz : -1 + lz;
    zk[1] = rz > 0.1 ? 0.15 + rz : -1 + rz;
    zk[2] = 0;
    zk[3] = 0.05;
    const al = zArm(J.EL_L, J.HA_L), ar = zArm(J.EL_R, J.HA_R);
    zk[4] = al < -0.04 ? -0.5 + al : 0.5 + al;
    zk[5] = ar < -0.04 ? -0.5 + ar : 0.5 + ar;
    const ord = this.order;
    for (let i = 0; i < 6; i++) ord[i] = i;
    for (let i = 1; i < 6; i++) {
      const v = ord[i];
      let j = i - 1;
      while (j >= 0 && zk[ord[j]] > zk[v]) {
        ord[j + 1] = ord[j];
        j--;
      }
      ord[j + 1] = v;
    }
    for (let i = 0; i < 6; i++) {
      switch (ord[i]) {
        case 0:
          this.leg(ctx, J.HIP_L, J.KN_L, J.AN_L, J.TOE_L, COLORS.left, COLORS.leftDark, scale, ol);
          break;
        case 1:
          this.leg(ctx, J.HIP_R, J.KN_R, J.AN_R, J.TOE_R, COLORS.right, COLORS.rightDark, scale, ol);
          break;
        case 2:
          this.torso(ctx, scale, ol);
          break;
        case 3:
          this.head(ctx, scale, ol, t, mini);
          break;
        case 4:
          this.arm(ctx, J.SH_L, J.EL_L, J.HA_L, COLORS.left, COLORS.leftLight, sk.handL, scale, ol, sk.formL);
          break;
        case 5:
          this.arm(ctx, J.SH_R, J.EL_R, J.HA_R, COLORS.right, COLORS.rightLight, sk.handR, scale, ol, sk.formR);
          break;
      }
    }
    ctx.restore();
  }

  /**
   * Redraw one forearm + hand over whatever was drawn since this figure's
   * last draw() (same projection): a partner's arm hooked through yours
   * (elbow swing) passes in front of your upper arm although the partner's
   * body is behind you. side: 1 = right, -1 = left.
   */
  redrawForearm(ctx: CanvasRenderingContext2D, sk: Skeleton, side: 1 | -1, scale: number, alpha = 1): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (this.style !== 'classic' && this.human) {
      this.human.redrawForearm(ctx, sk, side);
      ctx.restore();
      return;
    }
    const ol = OUTLINE * scale;
    const el = side === 1 ? J.EL_R : J.EL_L, ha = side === 1 ? J.HA_R : J.HA_L;
    const col = side === 1 ? COLORS.right : COLORS.left, light = side === 1 ? COLORS.rightLight : COLORS.leftLight;
    const px = this.px, w = CLASSIC[this.build].fore * ((this.ps[el] + this.ps[ha]) * 0.5) * scale;
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? COLORS.outline : col;
      ctx.lineWidth = w + (pass === 0 ? ol * 2 : 0);
      ctx.beginPath();
      ctx.moveTo(px[el * 2], px[el * 2 + 1]);
      ctx.lineTo(px[ha * 2], px[ha * 2 + 1]);
      ctx.stroke();
    }
    const open = side === 1 ? sk.handR : sk.handL;
    const r = BODY.handR * this.ps[ha] * scale * (0.92 + 0.22 * Math.max(0, Math.min(1, open)));
    ctx.fillStyle = light;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = ol * 1.6;
    ctx.beginPath();
    ctx.arc(px[ha * 2], px[ha * 2 + 1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** The human look for the current style / build / tint (cached, so the per-frame path allocates nothing). */
  private lookNow(): ReturnType<typeof humanLook> {
    const base = humanLook(this.style as 'human' | 'sticker', this.build);
    if (!this.tint) return base;
    const key = `${this.style}|${this.build}|${this.tint.top}|${this.tint.hood}`;
    if (this.tintedLook?.key !== key) this.tintedLook = { key, look: { ...base, top: this.tint.top, ...(base.hood ? { hood: this.tint.hood } : {}) } };
    return this.tintedLook.look;
  }

  private shadow(ctx: CanvasRenderingContext2D, sk: Skeleton, cx: number, floorY: number, scale: number): void {
    const air = sk.air;
    const x = cx + ((sk.p[J.AN_L * 3] + sk.p[J.AN_R * 3]) * 0.5) * scale;
    const spread = Math.abs(sk.p[J.AN_R * 3] - sk.p[J.AN_L * 3]);
    const k = Math.max(0.35, 1 - air * 3.2);
    ctx.globalAlpha *= 0.55 * k;
    ctx.fillStyle = '#05040a';
    ctx.beginPath();
    ctx.ellipse(x, floorY + 0.01 * scale, (0.2 + spread * 0.5) * k * scale, 0.035 * k * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha /= 0.55 * k;
  }

  private seg2(ctx: CanvasRenderingContext2D, a: number, b: number, c: number, w1: number, w2: number, color: string, ol: number, scale: number): void {
    const px = this.px, ps = this.ps;
    const s1 = (ps[a] + ps[b]) * 0.5 * scale;
    const s2 = (ps[b] + ps[c]) * 0.5 * scale;
    // Outline pass for the whole chain, then fills (no seam at the joint).
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = w1 * s1 + ol * 2;
    ctx.beginPath();
    ctx.moveTo(px[a * 2], px[a * 2 + 1]);
    ctx.lineTo(px[b * 2], px[b * 2 + 1]);
    ctx.stroke();
    ctx.lineWidth = w2 * s2 + ol * 2;
    ctx.beginPath();
    ctx.moveTo(px[b * 2], px[b * 2 + 1]);
    ctx.lineTo(px[c * 2], px[c * 2 + 1]);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w1 * s1;
    ctx.beginPath();
    ctx.moveTo(px[a * 2], px[a * 2 + 1]);
    ctx.lineTo(px[b * 2], px[b * 2 + 1]);
    ctx.stroke();
    ctx.lineWidth = w2 * s2;
    ctx.beginPath();
    ctx.moveTo(px[b * 2], px[b * 2 + 1]);
    ctx.lineTo(px[c * 2], px[c * 2 + 1]);
    ctx.stroke();
  }

  private arm(ctx: CanvasRenderingContext2D, sh: number, el: number, ha: number, color: string, light: string, open: number, scale: number, ol: number, form = 0): void {
    const B = CLASSIC[this.build];
    this.seg2(ctx, sh, el, ha, B.upper, B.fore, color, ol, scale);
    // Hand: a round mitt, bigger when open.
    const px = this.px;
    if (form > 0) open = 0;
    const r = BODY.handR * this.ps[ha] * scale * (0.92 + 0.22 * (open < 0 ? 0 : open > 1 ? 1 : open));
    const x = px[ha * 2], y = px[ha * 2 + 1];
    if (form > 0) {
      // Pointing index finger / rock horns, out along the forearm.
      let dx = x - px[el * 2], dy = y - px[el * 2 + 1];
      const dl = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= dl;
      dy /= dl;
      const spread = form === 2 ? [0.42, -0.42] : [0];
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? COLORS.outline : light;
        ctx.lineWidth = r * 0.62 + (pass === 0 ? ol * 3.2 : 0);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const a of spread) {
          const c = Math.cos(a), s = Math.sin(a);
          const fx = dx * c - dy * s, fy = dx * s + dy * c;
          ctx.moveTo(x + fx * r * 0.4, y + fy * r * 0.4);
          ctx.lineTo(x + fx * r * (form === 2 ? 1.95 : 2.25), y + fy * r * (form === 2 ? 1.95 : 2.25));
        }
        ctx.stroke();
      }
    }
    ctx.fillStyle = light;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = ol * 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cuff ring in the limb colour (helps tell the side at a glance).
    ctx.strokeStyle = color;
    ctx.lineWidth = ol * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  private leg(ctx: CanvasRenderingContext2D, hip: number, kn: number, an: number, toe: number, color: string, dark: string, scale: number, ol: number): void {
    const B = CLASSIC[this.build];
    this.seg2(ctx, hip, kn, an, B.thigh, B.shin, color, ol, scale);
    // Shoe: seen from the front, perpendicular to the shin, toes outward.
    const px = this.px;
    const s = this.ps[an] * scale;
    let sx = px[an * 2] - px[kn * 2], sy = px[an * 2 + 1] - px[kn * 2 + 1];
    const sl = Math.sqrt(sx * sx + sy * sy) || 1;
    sx /= sl;
    sy /= sl;
    const side = px[toe * 2] >= px[an * 2] ? 1 : -1;
    let qx = -sy, qy = sx;
    if (qx * side < 0) {
      qx = -qx;
      qy = -qy;
    }
    const bx = px[an * 2] + sx * 0.024 * s, by = px[an * 2 + 1] + sy * 0.024 * s;
    const ax = bx - qx * 0.012 * s, ay = by - qy * 0.012 * s;
    const tx = bx + qx * 0.042 * s, ty = by + qy * 0.042 * s;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = W_FOOT * s + ol * 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.strokeStyle = dark;
    ctx.lineWidth = W_FOOT * s;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // Sole stripe.
    const o = W_FOOT * s * 0.3;
    ctx.strokeStyle = COLORS.body;
    ctx.lineWidth = W_FOOT * s * 0.26;
    ctx.beginPath();
    ctx.moveTo(ax + sx * o, ay + sy * o);
    ctx.lineTo(tx + sx * o, ty + sy * o);
    ctx.stroke();
  }

  /**
   * Screen points of joints a / b (left / right) into wide[o..o+3], spread to
   * at least `minHalf` px from their midpoint across the body axis.
   */
  private widen(a: number, b: number, o: number, minHalf: number): void {
    const px = this.px, W = this.wide;
    const ax = px[a * 2], ay = px[a * 2 + 1], bx = px[b * 2], by = px[b * 2 + 1];
    W[o] = ax; W[o + 1] = ay; W[o + 2] = bx; W[o + 3] = by;
    const dx = bx - ax, dy = by - ay;
    const half = Math.sqrt(dx * dx + dy * dy) * 0.5;
    if (half >= minHalf) return;
    // Across the body: perpendicular to pelvis -> chest, signed like a -> b.
    let qx = px[J.PELVIS * 2 + 1] - px[J.CHEST * 2 + 1], qy = px[J.CHEST * 2] - px[J.PELVIS * 2];
    const ql = Math.sqrt(qx * qx + qy * qy) || 1;
    qx /= -ql;
    qy /= -ql;
    if (qx * dx + qy * dy < 0) {
      qx = -qx;
      qy = -qy;
    }
    const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5;
    W[o] = mx - qx * minHalf;
    W[o + 1] = my - qy * minHalf;
    W[o + 2] = mx + qx * minHalf;
    W[o + 3] = my + qy * minHalf;
  }

  private torso(ctx: CanvasRenderingContext2D, scale: number, ol: number): void {
    const px = this.px, ps = this.ps;
    // Shorts over the thigh tops.
    const hl = J.HIP_L, hr = J.HIP_R;
    const kl = J.KN_L, kr = J.KN_R;
    const B = CLASSIC[this.build];
    const k = B.shorts;
    const lx = px[hl * 2] + (px[kl * 2] - px[hl * 2]) * k, ly = px[hl * 2 + 1] + (px[kl * 2 + 1] - px[hl * 2 + 1]) * k;
    const rx = px[hr * 2] + (px[kr * 2] - px[hr * 2]) * k, ry = px[hr * 2 + 1] + (px[kr * 2 + 1] - px[hr * 2 + 1]) * k;
    const sw = (B.thigh + (B.male ? 0.02 : 0.008)) * ps[hl] * scale;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = sw + ol * 2;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(px[hl * 2], px[hl * 2 + 1]);
    ctx.lineTo(px[hr * 2], px[hr * 2 + 1]);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.strokeStyle = COLORS.shorts;
    ctx.lineWidth = sw;
    ctx.stroke();

    // Neck.
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = W_NECK * ps[J.NECK] * scale + ol * 2;
    ctx.beginPath();
    ctx.moveTo(px[J.CHEST * 2], px[J.CHEST * 2 + 1]);
    ctx.lineTo(px[J.NECK * 2], px[J.NECK * 2 + 1]);
    ctx.stroke();
    ctx.strokeStyle = COLORS.body;
    ctx.lineWidth = W_NECK * ps[J.NECK] * scale;
    ctx.stroke();

    // Chest: a rounded trapezoid from the shoulders to the hips. Turned side-on
    // (spins) the shoulder / hip lines collapse: keep a minimum body depth.
    const sl = J.SH_L, sr = J.SH_R;
    const wx = px[J.WAIST * 2], wy = px[J.WAIST * 2 + 1];
    const W = this.wide;
    this.widen(J.SH_L, J.SH_R, 0, 0.062 * scale);
    this.widen(hl, hr, 4, 0.05 * scale);
    let slx = W[0], sly = W[1], srx = W[2], sry = W[3];
    const hlx = W[4], hly = W[5], hrx = W[6], hry = W[7];
    // Waist half-width follows the shoulder line direction.
    const dx = srx - slx, dy = sry - sly;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const ww = len * B.waist;
    if (B.shoulderOut > 0) {
      // Broader shoulders: the torso reaches past the shoulder joints (scaled with the visible width, so a turned body stays narrow).
      const o = B.shoulderOut * scale * Math.min(1, len / (0.25 * scale));
      slx -= ux * o;
      sly -= uy * o;
      srx += ux * o;
      sry += uy * o;
    }
    ctx.beginPath();
    ctx.moveTo(slx - ux * 0.01 * scale, sly - 0.012 * scale);
    ctx.lineTo(srx + ux * 0.01 * scale, sry - 0.012 * scale);
    ctx.quadraticCurveTo(wx + ux * ww * 1.05, wy + uy * ww, hrx + ux * 0.012 * scale, hry - 0.01 * scale);
    ctx.lineTo(hlx - ux * 0.012 * scale, hly - 0.01 * scale);
    ctx.quadraticCurveTo(wx - ux * ww * 1.05, wy - uy * ww, slx - ux * 0.01 * scale, sly - 0.012 * scale);
    ctx.closePath();
    ctx.fillStyle = this.tint ? this.tint.top : COLORS.body;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = ol * 2;
    ctx.stroke();
    ctx.fill();
    if (B.male) {
      // Jersey stripe across the chest, clipped to the torso.
      ctx.save();
      ctx.clip();
      const cy = 0.42;
      const ax = slx + (wx - ux * ww - slx) * cy, ay = sly + (wy - uy * ww - sly) * cy;
      const bx = srx + (wx + ux * ww - srx) * cy, by = sry + (wy + uy * ww - sry) * cy;
      ctx.strokeStyle = COLORS.band;
      ctx.lineCap = 'butt';
      ctx.lineWidth = 0.04 * scale;
      ctx.beginPath();
      ctx.moveTo(ax - ux * scale, ay - uy * scale);
      ctx.lineTo(bx + ux * scale, by + uy * scale);
      ctx.stroke();
      ctx.restore();
      ctx.lineCap = 'round';
    }
    // Shoulder caps in the side colours (the arm colour starts at the shoulder).
    const capR = B.capR * scale;
    ctx.lineWidth = ol * 1.4;
    ctx.fillStyle = COLORS.left;
    ctx.beginPath();
    ctx.arc(px[sl * 2], px[sl * 2 + 1], capR * ps[sl], 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.right;
    ctx.beginPath();
    ctx.arc(px[sr * 2], px[sr * 2 + 1], capR * ps[sr], 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Shorts top over the lower torso, with a waistband.
    const k2 = 0.42;
    const blx = hlx + (wx - ux * ww * 0.95 - hlx) * k2, bly = hly + (wy - uy * ww - hly) * k2;
    const brx = hrx + (wx + ux * ww * 0.95 - hrx) * k2, bry = hry + (wy + uy * ww - hry) * k2;
    ctx.beginPath();
    ctx.moveTo(hlx - ux * 0.012 * scale, hly - 0.01 * scale);
    ctx.lineTo(blx, bly);
    ctx.lineTo(brx, bry);
    ctx.lineTo(hrx + ux * 0.012 * scale, hry - 0.01 * scale);
    ctx.closePath();
    ctx.fillStyle = COLORS.shorts;
    ctx.fill();
    ctx.strokeStyle = COLORS.band;
    ctx.lineWidth = 0.02 * scale;
    ctx.beginPath();
    ctx.moveTo(blx + ux * ol, bly + uy * ol);
    ctx.lineTo(brx - ux * ol, bry - uy * ol);
    ctx.stroke();
  }

  private head(ctx: CanvasRenderingContext2D, scale: number, ol: number, t: number, mini: boolean): void {
    const px = this.px, ps = this.ps;
    const hx = px[J.HEAD * 2], hy = px[J.HEAD * 2 + 1];
    const r = BODY.headR * ps[J.HEAD] * scale;
    // Head orientation from the projected up / forward helper points.
    const ux = px[J.HEAD_UP * 2] - hx, uy = px[J.HEAD_UP * 2 + 1] - hy;
    const roll = Math.atan2(ux, -uy);
    const fx = (px[J.HEAD_FWD * 2] - hx) / scale; // + = facing screen right
    const fy = (px[J.HEAD_FWD * 2 + 1] - hy) / scale; // + = looking down
    // Facing the viewer (1) .. side-on (0) .. back to the viewer (< 0), from the 3D forward axis.
    const p3 = this.sk3;
    const fz = p3 ? p3[J.HEAD_FWD * 3 + 2] - p3[J.HEAD * 3 + 2] : 1;
    const back = fz < -0.25;

    ctx.fillStyle = COLORS.body;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = ol * 2;
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(roll);
    const male = CLASSIC[this.build].male;
    // Headband tails (behind the face side), swinging with head motion (the female version).
    if (!mini && !male) {
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
      // Back to the viewer: the knot and both tails hang at the back of the head.
      const side = back ? 0.08 : fx >= 0 ? -1 : 1;
      const bx = side * r * 0.92, by = back ? -r * 0.62 : -r * 0.3;
      const a = back ? 1.25 + this.tailA * 0.3 : 0.35 + this.tailA * side;
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 0.034 * scale + ol * 1.6;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + side * Math.cos(a) * r * 0.85, by + Math.sin(a) * r * 0.85);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + side * Math.cos(a + 0.5) * r * 0.7, by + Math.sin(a + 0.5) * r * 0.7);
      ctx.stroke();
      ctx.strokeStyle = COLORS.band;
      ctx.lineWidth = 0.034 * scale;
      ctx.stroke();
    }
    // Band across the forehead.
    const fo = Math.max(-0.5, Math.min(0.5, fx * 9)) * r;
    const lift = Math.max(-0.4, Math.min(0.4, fy * 6)) * r;
    if (male) {
      this.maleHair(ctx, r, ol, back ? 0 : fo, back);
      ctx.restore();
      if (!back && !mini) this.face(ctx, hx, hy, roll, r, fo, lift, fz);
      return;
    }
    ctx.strokeStyle = COLORS.band;
    ctx.lineWidth = r * 0.34;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.ellipse(0, 0, r - r * 0.17, r - r * 0.17, 0, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.lineCap = 'round';
    if (back) {
      // Back of the head: no face; a darker crown and the band's knot in the middle.
      ctx.fillStyle = COLORS.muted;
      ctx.beginPath();
      ctx.arc(0, 0, r - ol, Math.PI * 1.12, Math.PI * 1.88);
      ctx.lineTo(0, -r * 0.05);
      ctx.closePath();
      ctx.globalAlpha *= 0.35;
      ctx.fill();
      ctx.globalAlpha /= 0.35;
      ctx.strokeStyle = COLORS.band;
      ctx.lineWidth = r * 0.34;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.ellipse(0, 0, r - r * 0.17, r - r * 0.17, 0, Math.PI * 1.06, Math.PI * 1.94);
      ctx.stroke();
      ctx.lineCap = 'round';
    }
    ctx.restore();
    if (!back && !mini) this.face(ctx, hx, hy, roll, r, fo, lift, fz);
  }

  /** Eyes + smile, shifted toward where the face points; closer together side-on. */
  private face(ctx: CanvasRenderingContext2D, hx: number, hy: number, roll: number, r: number, fo: number, lift: number, fz: number): void {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(roll);
    const ex = fo * 0.8, ey = r * 0.12 + lift * 0.5;
    const sp = r * 0.32 * Math.max(0.3, Math.min(1, fz * 1.15));
    ctx.fillStyle = COLORS.outline;
    ctx.beginPath();
    ctx.ellipse(ex - sp, ey, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + sp, ey, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.arc(ex, ey + r * 0.22, r * 0.26, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    if (CLASSIC[this.build].male) {
      // Straight, heavier brows.
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - sp - r * 0.14, ey - r * 0.27);
      ctx.lineTo(ex - sp + r * 0.12, ey - r * 0.3);
      ctx.moveTo(ex + sp - r * 0.12, ey - r * 0.3);
      ctx.lineTo(ex + sp + r * 0.14, ey - r * 0.27);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The male classic's hair (local head frame, y down): a short flat-top crop
   * standing a little above the head, under a narrow sweatband (no tails).
   * Back view: the crop covers the back of the head, the band goes round.
   */
  private maleHair(ctx: CanvasRenderingContext2D, r: number, ol: number, fo: number, back: boolean): void {
    const f = fo * 0.35;
    ctx.beginPath();
    ctx.moveTo(-r * 0.99, back ? r * 0.2 : -r * 0.1);
    ctx.lineTo(-r * 0.97, -r * 0.82);
    // Spiky crop: a few short tufts along the crown.
    const tufts = MALE_TUFTS;
    for (let i = 0; i < tufts.length; i += 2) ctx.lineTo(tufts[i] * r + f * (1 - Math.abs(tufts[i])), tufts[i + 1] * r);
    ctx.lineTo(r * 0.97, -r * 0.82);
    ctx.lineTo(r * 0.99, back ? r * 0.2 : -r * 0.1);
    if (back) ctx.quadraticCurveTo(0, r * 0.45, -r * 0.99, r * 0.2);
    else {
      // Hairline across the forehead.
      ctx.quadraticCurveTo(r * 0.5 + f, -r * 0.62, f, -r * 0.6);
      ctx.quadraticCurveTo(-r * 0.5 + f, -r * 0.62, -r * 0.99, -r * 0.1);
    }
    ctx.closePath();
    ctx.fillStyle = CLASSIC_HAIR;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = ol * 2;
    ctx.stroke();
    ctx.fill();
    // Sweatband over the hairline.
    ctx.strokeStyle = COLORS.band;
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.ellipse(f * 0.5, -r * 0.08, r * 0.97, r * 0.6, 0, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
    ctx.lineCap = 'round';
  }
}

/** Hair of the male classic coach (mid-tone so it reads on the dark stage). */
const CLASSIC_HAIR = '#b06a3b';
/** Crown outline of the male classic's spiky crop (x, y pairs × head radius, left to right). */
const MALE_TUFTS = [-0.8, -1.22, -0.55, -1.02, -0.3, -1.34, -0.05, -1.08, 0.22, -1.36, 0.45, -1.06, 0.72, -1.26, 0.86, -0.98];

// ---------------------------------------------------------------------------
// Stage

export interface StripCard {
  name: string;
  /** Solved skeleton for the thumbnail, or null. */
  skeleton: Skeleton | null;
}

export interface StripInfo {
  now: string;
  sig: boolean;
  /** 0..1 progress through the current move group. */
  progress: number;
  /** Beats until the change (Infinity = none planned). */
  beatsToChange: number;
  next: StripCard | null;
  after: StripCard | null;
  /** The song's resolved style ("Latin groove"), shown subtly on the NOW label. */
  style?: string;
}

export interface SceneInfo {
  t: number;
  /** Fractional beat index (for the beat-reactive background). */
  beat: number;
  half: boolean;
  /** 0..1 section energy. */
  energy: number;
  strip: StripInfo | null;
}

export interface Layout {
  w: number;
  h: number;
  figX: number;
  floorY: number;
  scale: number;
  strip: { x: number; y: number; w: number; h: number; vertical: boolean } | null;
}

/** Strip drawing passes: everything (Full), only the still parts (into the static layer), only the moving parts. */
const ALL = 0;
const STATIC = 1;
const MOVING = 2;
type Pass = typeof ALL | typeof STATIC | typeof MOVING;

/** Dirty-rectangle slots (dirty.ts). */
const SLOT_FIG = 0;
const SLOT_RINGS = 1;
const SLOT_STRIP = 2;
/** First slot of the strip's moving parts (progress bar, countdown dots, NEXT figure). */
const SLOT_STRIP_DYN = 3;

/** Cached-tier knobs, set by the stage (quality.ts). */
export interface StageQuality {
  /** Glows baked into a cached background; only moving parts redrawn. */
  cached: boolean;
}

export class StageRenderer2D {
  readonly painter = new FigurePainter();
  private readonly nextPainter = new FigurePainter();
  private readonly afterPainter = new FigurePainter();
  private ctx: CanvasRenderingContext2D;
  private readonly mainCtx: CanvasRenderingContext2D;
  private bgGrad: CanvasGradient | null = null;
  private floorGrad: CanvasGradient | null = null;
  private glowGrad: CanvasGradient | null = null;
  private glowGrad2: CanvasGradient | null = null;
  layout: Layout = { w: 1, h: 1, figX: 0, floorY: 0, scale: 1, strip: null };
  private energy = 0.4;
  private fontCache = new Map<string, { size: number; text: string }>();
  /** Set by the stage; 'cached' switches to the Smooth drawing (see quality.ts). */
  quality: StageQuality = { cached: false };
  // Layers: the background (gradient + floor), the baked glows on top of it, and that plus the strip's still parts.
  private base: ReturnType<typeof makeLayer> = null;
  private glowLayer: ReturnType<typeof makeLayer> = null;
  private staticLayer: ReturnType<typeof makeLayer> = null;
  private bakedEnergy = NaN;
  private stripKey = '';
  private needFull = true;
  private readonly dirty = new DirtyRects();
  private readonly box = new Float64Array(4);
  /** Moving strip parts recorded by the last STATIC pass: x0, y0, x1, y1 each. */
  private readonly stripDyn = new Float64Array((MAX_SLOTS - SLOT_STRIP_DYN) * 4);
  private stripDynN = 0;
  private pass: Pass = ALL;
  /** Pixels copied back from the static layer last frame (diagnostics / tests). */
  restoredPx = 0;

  constructor(readonly canvas: HTMLCanvasElement, style: CoachStyle = DEFAULT_COACH_STYLE, build: CoachBuild = DEFAULT_COACH_BUILD) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.mainCtx = ctx;
    this.style = style;
    this.build = build;
  }

  /** The coach's look (also used by the next / then thumbnails). */
  get style(): CoachStyle {
    return this.painter.style;
  }
  set style(s: CoachStyle) {
    if (s !== this.painter.style) this.invalidate();
    this.painter.style = s;
    this.nextPainter.style = s;
    this.afterPainter.style = s;
  }

  /** Female or male version of the look (also the thumbnails). */
  get build(): CoachBuild {
    return this.painter.build;
  }
  set build(b: CoachBuild) {
    if (b !== this.painter.build) this.invalidate();
    this.painter.build = b;
    this.nextPainter.build = b;
    this.afterPainter.build = b;
  }

  /** Forget the cached strip (its THEN figure shows the look) and redraw everything next frame. */
  invalidate(): void {
    this.stripKey = '';
    this.needFull = true;
  }

  /**
   * Set the internal resolution (device px) and recompute layout.
   * @param hudTop Where the play screen's bottom HUD (progress bar + time)
   *   starts, as a fraction of the height: the feet, their shadow and the
   *   strip stay above it. Omitted (previews, demo bench): layout as before.
   */
  resize(w: number, h: number, showStrip = true, hudTop?: number): void {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const landscape = w / h >= 1.2;
    // A little air above the HUD; Infinity = no HUD to avoid.
    const hudY = hudTop === undefined ? Infinity : h * Math.max(0.7, Math.min(1, hudTop)) - h * 0.015;
    let figX: number, floorY: number, scale: number;
    let strip: Layout['strip'] = null;
    if (landscape) {
      scale = h * 0.6;
      // Feet / shadow reach about 0.05 x scale below the floor line.
      floorY = Math.min(h * 0.86, hudY - scale * FEET_BELOW_FLOOR);
      figX = showStrip ? w * 0.4 : w * 0.5;
      if (showStrip) strip = { x: w * 0.69, y: h * 0.15, w: w * 0.28, h: Math.min(h * 0.64, hudY - h * 0.15), vertical: true };
    } else {
      scale = Math.min(h * 0.46, w * 0.7);
      floorY = h * (showStrip ? 0.66 : 0.84);
      if (!showStrip) floorY = Math.min(floorY, hudY - scale * FEET_BELOW_FLOOR);
      figX = w * 0.5;
      if (showStrip) strip = { x: w * 0.05, y: h * 0.71, w: w * 0.9, h: Math.max(h * 0.12, Math.min(h * 0.2, hudY - h * 0.71)), vertical: false };
    }
    this.layout = { w, h, figX, floorY, scale, strip };
    const c = this.ctx;
    this.bgGrad = c.createLinearGradient(0, 0, 0, h);
    this.bgGrad.addColorStop(0, COLORS.bg0);
    this.bgGrad.addColorStop(0.75, COLORS.bg1);
    this.bgGrad.addColorStop(1, COLORS.bg0);
    this.floorGrad = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    this.floorGrad.addColorStop(0, 'rgba(120, 96, 220, 0.30)');
    this.floorGrad.addColorStop(1, 'rgba(120, 96, 220, 0)');
    this.glowGrad = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    this.glowGrad.addColorStop(0, 'rgba(255, 92, 138, 0.55)');
    this.glowGrad.addColorStop(0.55, 'rgba(255, 92, 138, 0.12)');
    this.glowGrad.addColorStop(1, 'rgba(255, 92, 138, 0)');
    this.glowGrad2 = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    this.glowGrad2.addColorStop(0, 'rgba(75, 227, 192, 0.45)');
    this.glowGrad2.addColorStop(1, 'rgba(75, 227, 192, 0)');
    // The still background, drawn once per size and copied every frame (cheaper than a full-screen gradient).
    this.base = makeLayer(this.canvas, w, h);
    if (this.base) {
      const b = this.base.ctx;
      b.fillStyle = this.bgGrad;
      b.fillRect(0, 0, w, h);
      b.fillStyle = COLORS.floor;
      b.fillRect(0, floorY, w, h - floorY);
    }
    this.glowLayer = null;
    this.staticLayer = null;
    this.bakedEnergy = NaN;
    this.stripKey = '';
    this.needFull = true;
    this.dirty.reset(w, h);
  }

  render(sk: Skeleton, scene: SceneInfo): void {
    const c = this.ctx;
    const L = this.layout;
    // Smooth the energy so section changes fade in over a couple of seconds.
    this.energy += (scene.energy - this.energy) * 0.03;
    if (this.quality.cached && this.base && this.cachedRender(sk, scene)) return;
    this.needFull = true; // back to cached drawing later: start from a clean copy
    this.background(scene);
    this.painter.draw(c, sk, L.figX, L.floorY, L.scale, scene.t);
    if (scene.strip && L.strip) this.strip(scene.strip, scene.t);
  }

  /** Background with the glows following the beat (Full). */
  private background(scene: SceneInfo): void {
    const c = this.ctx;
    const L = this.layout;
    c.globalAlpha = 1;
    if (this.base) c.drawImage(this.base.canvas, 0, 0);
    else {
      c.fillStyle = this.bgGrad!;
      c.fillRect(0, 0, L.w, L.h);
      // Floor plane.
      c.fillStyle = COLORS.floor;
      c.fillRect(0, L.floorY, L.w, L.h - L.floorY);
    }
    // Beat pulse: smooth, at most once per beat (every 2 at half time), small.
    const ph = scene.half ? scene.beat / 2 : scene.beat;
    const f = ph - Math.floor(ph);
    const pulse = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * f), 3);
    this.glows(c, this.energy, pulse, scene.t);
    this.rings(c, ph);
    c.globalAlpha = 1;
  }

  /** Back glows + floor spotlight onto `c` at energy `e` and beat pulse `pulse` (0..1). */
  private glows(c: CanvasRenderingContext2D, e: number, pulse: number, t: number): void {
    const L = this.layout;
    // Back glow behind the coach.
    const gx = L.figX, gy = L.floorY - L.scale * 0.6;
    const gr = L.scale * (0.85 + 0.25 * e);
    c.save();
    c.translate(gx, gy);
    c.scale(gr * 1.15, gr);
    c.globalAlpha = 0.18 + 0.32 * e + 0.08 * e * pulse;
    c.fillStyle = this.glowGrad!;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
    // A second, slowly drifting teal glow for depth in high-energy sections.
    if (e > 0.35) {
      const drift = Math.sin(t * 0.25) * L.scale * 0.5;
      c.save();
      c.translate(gx + drift, gy - L.scale * 0.15);
      c.scale(gr * 0.9, gr * 0.75);
      c.globalAlpha = (e - 0.35) * 0.45;
      c.fillStyle = this.glowGrad2!;
      c.fillRect(-1, -1, 2, 2);
      c.restore();
    }
    // Floor spotlight.
    c.save();
    c.translate(L.figX, L.floorY);
    c.scale(L.scale * 0.75, L.scale * 0.12);
    c.globalAlpha = 0.8 + 0.2 * pulse * e;
    c.fillStyle = this.floorGrad!;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
  }

  /** Bar rings on the floor in energetic sections (one per bar: slow). `ph` = beat phase. */
  private rings(c: CanvasRenderingContext2D, ph: number): void {
    const e = this.energy;
    if (e <= 0.5) return;
    const L = this.layout;
    const bar = ph / 4;
    const bf = bar - Math.floor(bar);
    c.save();
    c.globalAlpha = (e - 0.5) * 0.9 * (1 - bf) * (1 - bf);
    c.strokeStyle = COLORS.band;
    c.lineWidth = Math.max(1, L.scale * 0.006);
    c.beginPath();
    c.ellipse(L.figX, L.floorY, L.scale * (0.25 + bf * 0.9), L.scale * (0.04 + bf * 0.14), 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  /**
   * Smooth tiers: copy back only what changed from the static layer, then
   * draw the moving parts. False when a layer couldn't be made (Full instead).
   */
  private cachedRender(sk: Skeleton, scene: SceneInfo): boolean {
    const L = this.layout;
    const main = this.mainCtx;
    // (Re)bake the glows when the section energy has moved on (a few times a song).
    if (!this.glowLayer || !(Math.abs(this.energy - this.bakedEnergy) < 0.08)) {
      this.glowLayer ??= makeLayer(this.canvas, L.w, L.h);
      if (!this.glowLayer) return false;
      const g = this.glowLayer.ctx;
      g.globalAlpha = 1;
      g.drawImage(this.base!.canvas, 0, 0);
      // The beat pulse's average brightness (mean of the cubed cosine is 5/16), no drift.
      this.glows(g, this.energy, 5 / 16, 0);
      g.globalAlpha = 1;
      this.bakedEnergy = this.energy;
      this.stripKey = '';
      this.needFull = true;
    }
    this.staticLayer ??= makeLayer(this.canvas, L.w, L.h);
    if (!this.staticLayer) return false;
    const st = this.staticLayer;
    const s = scene.strip && L.strip ? scene.strip : null;
    const key = s ? stripKey(s) : '';
    const D = this.dirty;
    if (key !== this.stripKey || this.needFull) {
      // The strip's still parts changed (new move, countdown): redraw them into the static layer.
      if (this.needFull) st.ctx.drawImage(this.glowLayer.canvas, 0, 0);
      else if (L.strip) {
        const r = stripBox(L.strip);
        st.ctx.drawImage(this.glowLayer.canvas, r[0], r[1], r[2] - r[0], r[3] - r[1], r[0], r[1], r[2] - r[0], r[3] - r[1]);
      }
      this.stripDynN = 0;
      if (s && L.strip) {
        this.ctx = st.ctx;
        this.pass = STATIC;
        this.strip(s, scene.t);
        this.pass = ALL;
        this.ctx = main;
        const r = stripBox(L.strip);
        D.add(SLOT_STRIP, r[0], r[1], r[2], r[3]);
      }
      this.stripKey = key;
    }
    // This frame's moving parts.
    const ph = scene.half ? scene.beat / 2 : scene.beat;
    const b = this.box;
    this.painter.bounds(sk, L.figX, L.floorY, L.scale, b);
    D.add(SLOT_FIG, b[0], b[1], b[2], b[3]);
    if (this.energy > 0.5) {
      const bar = ph / 4;
      const bf = bar - Math.floor(bar);
      const rx = L.scale * (0.25 + bf * 0.9) + L.scale * 0.006 + 2, ry = L.scale * (0.04 + bf * 0.14) + L.scale * 0.006 + 2;
      D.add(SLOT_RINGS, L.figX - rx, L.floorY - ry, L.figX + rx, L.floorY + ry);
    }
    if (s) for (let i = 0; i < this.stripDynN; i++) D.add(SLOT_STRIP_DYN + i, this.stripDyn[i * 4], this.stripDyn[i * 4 + 1], this.stripDyn[i * 4 + 2], this.stripDyn[i * 4 + 3]);
    main.globalAlpha = 1;
    if (this.needFull) {
      main.drawImage(st.canvas, 0, 0);
      this.restoredPx = L.w * L.h;
      this.needFull = false;
    } else {
      this.restoredPx = D.restore(main, st.canvas);
    }
    D.swap();
    this.rings(main, ph);
    main.globalAlpha = 1;
    this.painter.draw(main, sk, L.figX, L.floorY, L.scale, scene.t);
    if (s) {
      this.pass = MOVING;
      this.strip(s, scene.t);
      this.pass = ALL;
    }
    return true;
  }

  /** In a STATIC pass: remember a moving part's box so every frame repaints it. */
  private dyn(x0: number, y0: number, x1: number, y1: number): void {
    if (this.pass !== STATIC || this.stripDynN >= this.stripDyn.length / 4) return;
    const o = this.stripDynN++ * 4;
    this.stripDyn[o] = x0 - 2;
    this.stripDyn[o + 1] = y0 - 2;
    this.stripDyn[o + 2] = x1 + 2;
    this.stripDyn[o + 3] = y1 + 2;
  }

  /**
   * Fit text to a box: shrink the font (down to a floor), then ellipsize.
   * Measured at the rounded size actually drawn, with a small safety margin
   * so long names never run up against a card edge. Cached.
   */
  private fitFont(text: string, maxW: number, size: number, weight: number): { size: number; text: string } {
    const key = `${text}|${Math.round(maxW)}|${Math.round(size)}|${weight}`;
    const hit = this.fontCache.get(key);
    if (hit !== undefined) return hit;
    const fit = fitText(this.ctx, text, maxW, size, weight, 0.55, FONT_STACK);
    if (this.fontCache.size > 400) this.fontCache.clear();
    this.fontCache.set(key, fit);
    return fit;
  }

  private text(text: string, x: number, y: number, size: number, weight: number, color: string, maxW: number): void {
    if (this.pass === MOVING) return;
    const c = this.ctx;
    const fit = this.fitFont(text, maxW, size, weight);
    c.font = `${weight} ${fit.size}px ${FONT_STACK}`;
    c.fillStyle = color;
    c.fillText(fit.text, x, y);
  }

  private panel(x: number, y: number, w: number, h: number, r: number, line: string): void {
    if (this.pass === MOVING) return;
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    c.fillStyle = COLORS.panel;
    c.fill();
    c.strokeStyle = line;
    c.lineWidth = Math.max(2, this.layout.h * 0.003);
    c.stroke();
  }

  private strip(s: StripInfo, t: number): void {
    const c = this.ctx;
    const S = this.layout.strip!;
    const H = this.layout.h;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const pad = H * 0.022;
    const rad = H * 0.022;
    const soon = s.beatsToChange <= 4;
    // The countdown dots sit at the right of the label row: keep the label clear of them.
    const dotsW = soon && Number.isFinite(s.beatsToChange) ? H * 0.13 : 0;

    if (S.vertical) {
      // NOW
      const nowH = S.h * 0.25;
      this.panel(S.x, S.y, S.w, nowH, rad, COLORS.panelLine);
      this.text(s.sig ? 'NOW  ·  SONG COMBO' : s.style ? `NOW  ·  ${s.style.toUpperCase()}` : 'NOW', S.x + pad, S.y + pad + H * 0.022, H * 0.024, 800, s.sig ? COLORS.band : COLORS.muted, S.w - pad * 2 - dotsW);
      this.text(s.now, S.x + pad, S.y + pad + H * 0.075, H * 0.048, 900, COLORS.ink, S.w - pad * 2);
      this.progress(S.x + pad, S.y + nowH - pad - H * 0.03, S.w - pad * 2, H * 0.022, s, soon, S.y + pad + H * 0.013);
      // NEXT (animated) and THEN (static) cards.
      const gap = H * 0.02;
      const nextY = S.y + nowH + gap;
      const nextH = S.h * 0.4;
      this.card(s.next, 'NEXT', S.x, nextY, S.w, nextH, soon, this.nextPainter, t, 1);
      const afterY = nextY + nextH + gap;
      const afterH = S.h - (afterY - S.y);
      if (afterH > H * 0.06 && s.after) this.card(s.after, 'THEN', S.x, afterY, S.w, afterH, false, this.afterPainter, t, 0.85);
    } else {
      const wNow = S.w * 0.42;
      this.panel(S.x, S.y, wNow, S.h, rad, COLORS.panelLine);
      this.text(s.sig ? 'NOW · COMBO' : s.style ? `NOW · ${s.style.toUpperCase()}` : 'NOW', S.x + pad, S.y + pad + H * 0.02, H * 0.022, 800, s.sig ? COLORS.band : COLORS.muted, wNow - pad * 2 - dotsW);
      this.text(s.now, S.x + pad, S.y + pad + H * 0.065, H * 0.04, 900, COLORS.ink, wNow - pad * 2);
      this.progress(S.x + pad, S.y + S.h - pad - H * 0.03, wNow - pad * 2, H * 0.02, s, soon, S.y + pad + H * 0.012);
      const gap = S.w * 0.02;
      const cw = (S.w - wNow - gap * 2) / 2;
      this.card(s.next, 'NEXT', S.x + wNow + gap, S.y, cw, S.h, soon, this.nextPainter, t, 1);
      if (s.after) this.card(s.after, 'THEN', S.x + wNow + gap * 2 + cw, S.y, cw, S.h, false, this.afterPainter, t, 0.85);
    }
  }

  private progress(x: number, y: number, w: number, h: number, s: StripInfo, soon: boolean, dotY: number): void {
    const c = this.ctx;
    const r = h / 2;
    if (this.pass === STATIC) {
      // Moving every frame: the bar, and the countdown dots at the end of the label row.
      this.dyn(x, y, x + w, y + h);
      this.dyn(x + w - h * 5.5, dotY - h * 0.5, x + w, dotY + h * 0.5);
      return;
    }
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.beginPath();
    c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
    c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    c.closePath();
    c.fill();
    const p = Math.max(0, Math.min(1, s.progress));
    if (p > 0) {
      const fw = Math.max(h, w * p);
      c.fillStyle = soon ? COLORS.band : COLORS.left;
      c.beginPath();
      c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
      c.arc(x + fw - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      c.closePath();
      c.fill();
    }
    // Beat countdown dots for the last 4 beats before a change.
    if (soon && Number.isFinite(s.beatsToChange)) {
      const left = Math.ceil(s.beatsToChange - 1e-6);
      const dr = h * 0.5;
      const y2 = dotY;
      for (let i = 0; i < 4; i++) {
        const cx = x + w - dr - i * dr * 3;
        c.beginPath();
        c.arc(cx, y2, dr, 0, Math.PI * 2);
        c.fillStyle = i < left ? COLORS.band : 'rgba(255,255,255,0.18)';
        c.fill();
      }
    }
  }

  private wrapCache = new Map<string, string[]>();

  /** Split a name into at most two balanced lines (cached). */
  private wrap(text: string, maxW: number, size: number): string[] {
    const key = `${text}|${Math.round(maxW)}|${Math.round(size)}`;
    const hit = this.wrapCache.get(key);
    if (hit) return hit;
    const c = this.ctx;
    c.font = `850 ${Math.round(size)}px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;
    let lines = [text];
    const words = text.split(' ');
    if (c.measureText(text).width > maxW && words.length > 1) {
      let best = 1;
      let bestW = Infinity;
      for (let i = 1; i < words.length; i++) {
        const w = Math.max(c.measureText(words.slice(0, i).join(' ')).width, c.measureText(words.slice(i).join(' ')).width);
        if (w < bestW) {
          bestW = w;
          best = i;
        }
      }
      lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    if (this.wrapCache.size > 300) this.wrapCache.clear();
    this.wrapCache.set(key, lines);
    return lines;
  }

  private card(card: StripCard | null, label: string, x: number, y: number, w: number, h: number, hot: boolean, painter: FigurePainter, t: number, alpha: number): void {
    const H = this.layout.h;
    const pad = H * 0.018;
    this.panel(x, y, w, h, H * 0.022, hot ? COLORS.band : COLORS.panelLine);
    if (!card) {
      this.text(label, x + pad, y + pad + H * 0.02, H * 0.022, 800, COLORS.muted, w - pad * 2);
      return;
    }
    // Figure on the left, label + name on the right.
    const figW = Math.min(w * 0.42, h * 0.8);
    const tx = x + figW + pad * 0.5;
    const tw = x + w - pad - tx;
    const size = Math.min(H * 0.036, h * 0.2);
    const lines = this.wrap(card.name, tw, size);
    const lh = size * 1.12;
    const blockH = H * 0.03 + lines.length * lh;
    let ty = y + (h - blockH) / 2 + H * 0.022;
    this.text(label, tx, ty, H * 0.022, 800, hot ? COLORS.band : COLORS.muted, tw);
    ty += H * 0.008;
    for (const line of lines) {
      ty += lh;
      this.text(line, tx, ty, size, 850, COLORS.ink, tw);
    }
    if (card.skeleton) {
      // The NEXT figure dances (moving part); THEN's is a still pose (part of the static layer).
      const moving = painter === this.nextPainter;
      if (this.pass === STATIC && moving) {
        this.dyn(x + 2, y + 2, x + 2 + figW, y + h - 2);
        return;
      }
      if (this.pass === MOVING && !moving) return;
      const top = y + pad * 0.6;
      const bottom = y + h - pad * 0.8;
      const sc = (bottom - top) / 1.18;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x + 2, y + 2, figW, h - 4);
      this.ctx.clip();
      painter.draw(this.ctx, card.skeleton, x + pad * 0.5 + figW / 2, bottom - sc * 0.02, sc, t, { mini: true, shadow: false, alpha });
      this.ctx.restore();
    }
  }
}

/** What the strip's still parts show: when it changes, the static layer's strip is redrawn. */
function stripKey(s: StripInfo): string {
  const soon = s.beatsToChange <= 4;
  const dots = soon && Number.isFinite(s.beatsToChange);
  const card = (c: StripCard | null) => (c ? `${c.name}|${c.skeleton ? 1 : 0}` : '-');
  return `${s.now}\u0001${s.sig ? 1 : 0}${soon ? 1 : 0}${dots ? 1 : 0}\u0001${s.style ?? ''}\u0001${card(s.next)}\u0001${card(s.after)}`;
}

/** The strip's rectangle with room for the panel outlines. */
function stripBox(S: { x: number; y: number; w: number; h: number }): [number, number, number, number] {
  return [Math.floor(S.x - 6), Math.floor(S.y - 6), Math.ceil(S.x + S.w + 6), Math.ceil(S.y + S.h + 6)];
}

// ---------------------------------------------------------------------------
// Preview (style chooser cards): one figure dancing a move, no stage / strip.

export interface CoachPreviewOptions {
  /** Catalogue move to loop (default 'step-clap'). */
  moveId?: string;
  /** Clock in seconds (e.g. performance.now() / 1000); the move loops on it. */
  timeSec?: number;
  /** Tempo of the loop (default 120). */
  bpm?: number;
  /** Fill the canvas with the stage colours first (default true). */
  background?: boolean;
  /** Female or male version (default female). */
  build?: CoachBuild;
}

const PREVIEW_MOVE = 'step-clap';
const preview = {
  ev: new PoseEvaluator(),
  pose: createPose(),
  sk: createSkeleton(),
  plans: new Map<string, LoopPlan>(),
  painters: new WeakMap<HTMLCanvasElement, FigurePainter>(),
};

/**
 * Draw one frame of the coach in `style` dancing a looping move onto
 * `canvas` (its full pixel size). Call it per animation frame for a live
 * card, or once with a fixed `timeSec` for a still. Reuses per-canvas state,
 * so the per-frame path allocates nothing.
 */
export function drawCoachPreview(canvas: HTMLCanvasElement, style: CoachStyle, opts: CoachPreviewOptions = {}): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const bpm = opts.bpm ?? 120;
  const id = opts.moveId ?? PREVIEW_MOVE;
  const key = `${id}@${bpm}`;
  let plan = preview.plans.get(key);
  if (!plan) {
    const move = findMove(id) ?? findMove(PREVIEW_MOVE)!;
    plan = loopPlan(move, 60 / bpm);
    preview.plans.set(key, plan);
  }
  const loop = plan.loopBeats * plan.period;
  const t = opts.timeSec ?? 0;
  preview.ev.evaluate(plan, ((t % loop) + loop) % loop, preview.pose, { energy: 0.5 });
  const sk = solveSkeleton(preview.pose, preview.sk);
  let painter = preview.painters.get(canvas);
  if (!painter) {
    painter = new FigurePainter();
    preview.painters.set(canvas, painter);
  }
  painter.style = style;
  painter.build = opts.build ?? DEFAULT_COACH_BUILD;
  const floorY = h * 0.93;
  const scale = Math.min(h * 0.8, w * 1.2);
  if (opts.background !== false) {
    ctx.fillStyle = COLORS.bg1;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, floorY, w, h - floorY);
  }
  // Keep a travelling move centred on the card.
  painter.draw(ctx, sk, w / 2 - sk.p[J.PELVIS * 3] * scale, floorY, scale, t, { shadow: true });
}
