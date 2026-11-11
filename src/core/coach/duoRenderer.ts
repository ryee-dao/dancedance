/**
 * Canvas 2D renderer for the two-player stage: two coaches side by side
 * (P1 left, P2 right), each with its own colour identity (floor ring, "P1" /
 * "P2" tag, tinted top) and look, plus a duo now / next strip that shows one
 * shared card when both do the same move and split P1 / P2 cards when they
 * differ. Left / right limb colours stay as in single player.
 *
 * Uses the shared FigurePainter (classic look) or HumanPainter (human /
 * sticker looks, recoloured per player). The per-frame path allocates
 * nothing (gradients cached per resize).
 */

import { DUO_HOME } from '../choreo/duoMoves';
import { COLORS, FigurePainter } from './renderer';
import { HumanPainter, LOOKS, type HumanLook } from './humanPainter';
import { J, NUM_JOINTS, type Skeleton } from './skeleton';
import { CAM, PIV_Y, type CoachStyle } from './styles';

export const PLAYER_COLORS = {
  1: { main: '#ffb534', light: '#ffe2a6', dark: '#a86a00', top: '#ffe6ad', hood: '#ffd47a' },
  2: { main: '#4fc3ff', light: '#c4ecff', dark: '#1a77a8', top: '#bfe6ff', hood: '#8fd2ff' },
} as const;

/** Look of P2 for each P1 style (two different coaches). */
export function partnerStyle(s: CoachStyle): 'human' | 'sticker' {
  return s === 'sticker' ? 'human' : 'sticker';
}

function tinted(base: HumanLook, p: 1 | 2): HumanLook {
  const c = PLAYER_COLORS[p];
  return { ...base, top: c.top, ...(base.hood ? { hood: c.hood } : {}) };
}

/** One on-stage figure: classic via FigurePainter, human looks via a recoloured HumanPainter. */
export class DuoFigure {
  private fp = new FigurePainter();
  private hp: HumanPainter | null = null;
  private lookKey = '';
  private readonly px = new Float64Array(NUM_JOINTS * 2);
  private readonly ps = new Float64Array(NUM_JOINTS);
  style: CoachStyle = 'classic';
  /** Screen x / y of the head top after draw (tag placement). */
  headX = 0;
  headY = 0;
  /** Screen positions of the hands after draw: [rx, ry, lx, ly]. */
  readonly hands = new Float64Array(4);

  constructor(private player: 1 | 2) {}

  draw(ctx: CanvasRenderingContext2D, sk: Skeleton, cx: number, floorY: number, scale: number, t: number, mini = false, alpha = 1): void {
    if (this.style === 'classic') {
      this.fp.style = 'classic';
      this.fp.draw(ctx, sk, cx, floorY, scale, t, { mini, shadow: !mini, alpha });
      this.headX = this.fp.jx(J.HEAD);
      this.headY = this.fp.jy(J.HEAD) - 0.11 * scale;
      this.hands[0] = this.fp.jx(J.HA_R);
      this.hands[1] = this.fp.jy(J.HA_R);
      this.hands[2] = this.fp.jx(J.HA_L);
      this.hands[3] = this.fp.jy(J.HA_L);
      return;
    }
    const key = `${this.style}`;
    if (key !== this.lookKey || !this.hp) {
      const look = tinted(LOOKS[this.style], this.player);
      if (!this.hp) this.hp = new HumanPainter(look);
      else this.hp.setLook(look);
      this.lookKey = key;
    }
    const p = sk.p;
    for (let j = 0; j < NUM_JOINTS; j++) {
      const x = p[j * 3], y = p[j * 3 + 1], z = p[j * 3 + 2];
      const s = CAM / (CAM - z);
      this.ps[j] = s;
      this.px[j * 2] = cx + x * s * scale;
      this.px[j * 2 + 1] = floorY - (PIV_Y + (y - PIV_Y) * s) * scale;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (!mini) {
      const air = sk.air;
      const x = cx + ((p[J.AN_L * 3] + p[J.AN_R * 3]) * 0.5) * scale;
      const spread = Math.abs(p[J.AN_R * 3] - p[J.AN_L * 3]);
      const k = Math.max(0.35, 1 - air * 3.2);
      ctx.globalAlpha = alpha * 0.55 * k;
      ctx.fillStyle = '#05040a';
      ctx.beginPath();
      ctx.ellipse(x, floorY + 0.01 * scale, (0.2 + spread * 0.5) * k * scale, 0.035 * k * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    this.hp.draw(ctx, sk, this.px, this.ps, cx, floorY, scale, t, mini);
    ctx.restore();
    this.headX = this.px[J.HEAD * 2];
    this.headY = this.px[J.HEAD * 2 + 1] - 0.115 * scale * this.ps[J.HEAD];
    this.hands[0] = this.px[J.HA_R * 2];
    this.hands[1] = this.px[J.HA_R * 2 + 1];
    this.hands[2] = this.px[J.HA_L * 2];
    this.hands[3] = this.px[J.HA_L * 2 + 1];
  }
}

export interface DuoCard {
  /** One card for both (same move) or per player. */
  shared: boolean;
  name1: string;
  name2: string;
  /** Thumbnails (null = none). For a shared partner move both are drawn as a pair. */
  sk1: Skeleton | null;
  sk2: Skeleton | null;
  pair: boolean;
}

export interface DuoStripInfo {
  /** Phrase label (e.g. 'MIRROR EACH OTHER'). */
  label: string;
  sig: boolean;
  now: DuoCard;
  progress: number;
  beatsToChange: number;
  next: DuoCard | null;
  after: DuoCard | null;
}

export interface DuoSceneInfo {
  t: number;
  beat: number;
  half: boolean;
  energy: number;
  /** Depth offsets (toward the viewer) of each player, figure units. */
  z1: number;
  z2: number;
  /** Prop between the players (tug-of-war rope), or null. */
  prop: 'rope' | null;
  strip: DuoStripInfo | null;
}

export interface DuoLayout {
  w: number;
  h: number;
  cx: number;
  floorY: number;
  scale: number;
  strip: { x: number; y: number; w: number; h: number; vertical: boolean } | null;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export class DuoRenderer2D {
  private ctx: CanvasRenderingContext2D;
  private fig1 = new DuoFigure(1);
  private fig2 = new DuoFigure(2);
  private mini1 = new DuoFigure(1);
  private mini2 = new DuoFigure(2);
  private mini3 = new DuoFigure(1);
  private mini4 = new DuoFigure(2);
  private bgGrad: CanvasGradient | null = null;
  private glow1: CanvasGradient | null = null;
  private glow2: CanvasGradient | null = null;
  private energy = 0.4;
  private fontCache = new Map<string, number>();
  layout: DuoLayout = { w: 1, h: 1, cx: 0, floorY: 0, scale: 1, strip: null };
  private _style: CoachStyle = 'classic';

  constructor(readonly canvas: HTMLCanvasElement, style: CoachStyle = 'classic') {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.style = style;
  }

  get style(): CoachStyle {
    return this._style;
  }
  set style(s: CoachStyle) {
    this._style = s;
    const p2 = partnerStyle(s);
    this.fig1.style = this.mini1.style = this.mini3.style = s;
    this.fig2.style = this.mini2.style = this.mini4.style = p2;
  }

  resize(w: number, h: number, showStrip = true): void {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const landscape = w / h >= 1.2;
    let strip: DuoLayout['strip'] = null;
    let cx: number, floorY: number, scale: number;
    if (landscape) {
      scale = Math.min(h * 0.54, (showStrip ? w * 0.66 : w) / 2.15);
      floorY = h * 0.86;
      cx = showStrip ? w * 0.345 : w * 0.5;
      if (showStrip) strip = { x: w * 0.69, y: h * 0.1, w: w * 0.29, h: h * 0.74, vertical: true };
    } else {
      scale = Math.min(h * 0.36, w / 2.3);
      floorY = h * (showStrip ? 0.62 : 0.84);
      cx = w * 0.5;
      if (showStrip) strip = { x: w * 0.04, y: h * 0.67, w: w * 0.92, h: h * 0.29, vertical: false };
    }
    this.layout = { w, h, cx, floorY, scale, strip };
    const c = this.ctx;
    this.bgGrad = c.createLinearGradient(0, 0, 0, h);
    this.bgGrad.addColorStop(0, COLORS.bg0);
    this.bgGrad.addColorStop(0.75, COLORS.bg1);
    this.bgGrad.addColorStop(1, COLORS.bg0);
    this.glow1 = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    this.glow1.addColorStop(0, 'rgba(255, 181, 52, 0.42)');
    this.glow1.addColorStop(1, 'rgba(255, 181, 52, 0)');
    this.glow2 = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    this.glow2.addColorStop(0, 'rgba(79, 195, 255, 0.42)');
    this.glow2.addColorStop(1, 'rgba(79, 195, 255, 0)');
  }

  /** Screen x of a player's home spot. */
  homeX(p: 1 | 2): number {
    const L = this.layout;
    return L.cx + (p === 1 ? -1 : 1) * (DUO_HOME / 2) * L.scale;
  }

  render(sk1: Skeleton, sk2: Skeleton, scene: DuoSceneInfo): void {
    const c = this.ctx;
    const L = this.layout;
    this.energy += (scene.energy - this.energy) * 0.03;
    this.background(scene);
    // Floor markers at home (fixed: where each player stands).
    this.marker(1, sk1, scene);
    this.marker(2, sk2, scene);
    // Figures: back one first.
    const order: (1 | 2)[] = scene.z1 > scene.z2 ? [2, 1] : [1, 2];
    for (const p of order) {
      const sk = p === 1 ? sk1 : sk2;
      const z = p === 1 ? scene.z1 : scene.z2;
      const k = CAM / (CAM - z);
      const fig = p === 1 ? this.fig1 : this.fig2;
      const hx = this.homeX(p);
      fig.draw(c, sk, L.cx + (hx - L.cx) * k, L.floorY + z * L.scale * 0.28, L.scale * k, scene.t);
    }
    if (scene.prop === 'rope') drawRope(c, this.fig1, this.fig2, L.scale);
    for (const p of order) this.tag(p);
    if (scene.strip && L.strip) this.strip(scene.strip, scene.t);
  }

  private background(scene: DuoSceneInfo): void {
    const c = this.ctx;
    const L = this.layout;
    const e = this.energy;
    c.globalAlpha = 1;
    c.fillStyle = this.bgGrad!;
    c.fillRect(0, 0, L.w, L.h);
    c.fillStyle = COLORS.floor;
    c.fillRect(0, L.floorY, L.w, L.h - L.floorY);
    const ph = scene.half ? scene.beat / 2 : scene.beat;
    const f = ph - Math.floor(ph);
    const pulse = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * f), 3);
    for (const p of [1, 2] as const) {
      const gx = this.homeX(p), gy = L.floorY - L.scale * 0.6;
      const gr = L.scale * (0.6 + 0.2 * e);
      c.save();
      c.translate(gx, gy);
      c.scale(gr, gr * 1.1);
      c.globalAlpha = 0.14 + 0.26 * e + 0.08 * e * pulse;
      c.fillStyle = p === 1 ? this.glow1! : this.glow2!;
      c.fillRect(-1, -1, 2, 2);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  private marker(p: 1 | 2, _sk: Skeleton, scene: DuoSceneInfo): void {
    const c = this.ctx;
    const L = this.layout;
    const x = this.homeX(p);
    const col = PLAYER_COLORS[p];
    const ph = scene.half ? scene.beat / 2 : scene.beat;
    const f = ph - Math.floor(ph);
    c.save();
    c.globalAlpha = 0.85;
    c.strokeStyle = col.main;
    c.lineWidth = Math.max(2, L.scale * 0.012);
    c.beginPath();
    c.ellipse(x, L.floorY + L.scale * 0.012, L.scale * 0.27, L.scale * 0.045, 0, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.18 + 0.12 * (1 - f);
    c.fillStyle = col.main;
    c.fill();
    // Label on the floor in front of the ring.
    c.globalAlpha = 1;
    c.font = `900 ${Math.round(L.scale * 0.075)}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = col.main;
    c.fillText(p === 1 ? 'PLAYER 1' : 'PLAYER 2', x, L.floorY + L.scale * 0.115);
    c.restore();
  }

  /** "P1" / "P2" pill over the figure's head. */
  private tag(p: 1 | 2): void {
    const c = this.ctx;
    const L = this.layout;
    const fig = p === 1 ? this.fig1 : this.fig2;
    const col = PLAYER_COLORS[p];
    const s = L.scale * 0.07;
    const w = s * 1.9, hgt = s * 1.15;
    const x = fig.headX, y = Math.max(hgt, fig.headY - s * 0.9);
    c.save();
    c.fillStyle = col.main;
    c.strokeStyle = COLORS.outline;
    c.lineWidth = Math.max(2, s * 0.12);
    this.round(x - w / 2, y - hgt / 2, w, hgt, hgt / 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(x - s * 0.25, y + hgt / 2 - 1);
    c.lineTo(x + s * 0.25, y + hgt / 2 - 1);
    c.lineTo(x, y + hgt / 2 + s * 0.35);
    c.closePath();
    c.fill();
    c.font = `900 ${Math.round(s * 0.8)}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#16111f';
    c.fillText(p === 1 ? 'P1' : 'P2', x, y + s * 0.04);
    c.restore();
  }

  private round(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private panel(x: number, y: number, w: number, h: number, line: string): void {
    const c = this.ctx;
    this.round(x, y, w, h, this.layout.h * 0.02);
    c.fillStyle = COLORS.panel;
    c.fill();
    c.strokeStyle = line;
    c.lineWidth = Math.max(2, this.layout.h * 0.003);
    c.stroke();
  }

  private fit(text: string, maxW: number, size: number, weight: number): number {
    const key = `${text}|${Math.round(maxW)}|${Math.round(size)}|${weight}`;
    const hit = this.fontCache.get(key);
    if (hit !== undefined) return hit;
    const c = this.ctx;
    c.font = `${weight} ${size}px ${FONT}`;
    const w = c.measureText(text).width;
    const s = w > maxW ? Math.max(size * 0.5, (size * maxW) / w) : size;
    if (this.fontCache.size > 400) this.fontCache.clear();
    this.fontCache.set(key, s);
    return s;
  }

  private text(text: string, x: number, y: number, size: number, weight: number, color: string, maxW: number): void {
    const c = this.ctx;
    const s = this.fit(text, maxW, size, weight);
    c.font = `${weight} ${Math.round(s)}px ${FONT}`;
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  /** A coloured "P1" / "P2" chip; returns its width. */
  private chip(p: 1 | 2, x: number, y: number, size: number): number {
    const c = this.ctx;
    const w = size * 1.7, h = size * 1.05;
    c.fillStyle = PLAYER_COLORS[p].main;
    this.round(x, y - h * 0.78, w, h, h / 2);
    c.fill();
    c.font = `900 ${Math.round(size * 0.72)}px ${FONT}`;
    c.fillStyle = '#16111f';
    c.textAlign = 'center';
    c.fillText(p === 1 ? 'P1' : 'P2', x + w / 2, y - h * 0.08);
    c.textAlign = 'left';
    return w;
  }

  private strip(s: DuoStripInfo, t: number): void {
    const c = this.ctx;
    const S = this.layout.strip!;
    const H = this.layout.h;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const pad = H * 0.02;
    const soon = s.beatsToChange <= 4;
    const vertical = S.vertical;
    const nowW = vertical ? S.w : S.w * 0.4;
    const nowH = vertical ? S.h * 0.3 : S.h;
    const gap = H * 0.018;
    // NOW
    this.panel(S.x, S.y, nowW, nowH, s.sig ? COLORS.band : COLORS.panelLine);
    this.text(`NOW · ${s.label}`, S.x + pad, S.y + pad + H * 0.02, H * 0.022, 800, s.sig ? COLORS.band : COLORS.muted, nowW - pad * 2 - (soon ? H * 0.12 : 0));
    const n = s.now;
    if (n.shared) {
      this.text(n.name1, S.x + pad, S.y + pad + H * 0.078, H * 0.046, 900, COLORS.ink, nowW - pad * 2);
      const cy = S.y + pad + H * 0.118;
      let x = S.x + pad;
      x += this.chip(1, x, cy, H * 0.024) + H * 0.006;
      this.chip(2, x, cy, H * 0.024);
      this.text('both', x + H * 0.05, cy, H * 0.022, 700, COLORS.muted, nowW);
    } else {
      const lh = H * 0.05;
      for (const p of [1, 2] as const) {
        const y = S.y + pad + H * 0.07 + (p - 1) * lh;
        const cw = this.chip(p, S.x + pad, y, H * 0.026);
        this.text(p === 1 ? n.name1 : n.name2, S.x + pad + cw + H * 0.012, y, H * 0.036, 900, p === 1 ? PLAYER_COLORS[1].light : PLAYER_COLORS[2].light, nowW - pad * 2 - cw - H * 0.012);
      }
    }
    this.progress(S.x + pad, S.y + nowH - pad - H * 0.022, nowW - pad * 2, H * 0.02, s, soon, S.y + pad + H * 0.013);
    // NEXT / THEN
    if (vertical) {
      const nextY = S.y + nowH + gap;
      const nextH = S.h * 0.44;
      this.card(s.next, 'NEXT', S.x, nextY, S.w, nextH, soon, t, true);
      const afterY = nextY + nextH + gap;
      const afterH = S.y + S.h - afterY;
      if (s.after && afterH > H * 0.05) this.card(s.after, 'THEN', S.x, afterY, S.w, afterH, false, t, false);
    } else {
      const cw = (S.w - nowW - gap * 2) / 2;
      this.card(s.next, 'NEXT', S.x + nowW + gap, S.y, cw, S.h, soon, t, true);
      if (s.after) this.card(s.after, 'THEN', S.x + nowW + gap * 2 + cw, S.y, cw, S.h, false, t, false);
    }
  }

  private progress(x: number, y: number, w: number, h: number, s: DuoStripInfo, soon: boolean, dotY: number): void {
    const c = this.ctx;
    const r = h / 2;
    c.fillStyle = 'rgba(255,255,255,0.14)';
    this.round(x, y, w, h, r);
    c.fill();
    const p = Math.max(0, Math.min(1, s.progress));
    if (p > 0) {
      c.fillStyle = soon ? COLORS.band : COLORS.left;
      this.round(x, y, Math.max(h, w * p), h, r);
      c.fill();
    }
    if (soon && Number.isFinite(s.beatsToChange)) {
      const left = Math.ceil(s.beatsToChange - 1e-6);
      const dr = h * 0.5;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(x + w - dr - i * dr * 3, dotY, dr, 0, Math.PI * 2);
        c.fillStyle = i < left ? COLORS.band : 'rgba(255,255,255,0.18)';
        c.fill();
      }
    }
  }

  private card(card: DuoCard | null, label: string, x: number, y: number, w: number, h: number, hot: boolean, t: number, figures: boolean): void {
    const H = this.layout.h;
    const pad = H * 0.016;
    this.panel(x, y, w, h, hot ? COLORS.band : COLORS.panelLine);
    const c = this.ctx;
    if (!card) {
      this.text(label, x + pad, y + pad + H * 0.02, H * 0.022, 800, COLORS.muted, w - pad * 2);
      return;
    }
    const alpha = figures ? 1 : 0.85;
    if (card.shared) {
      const figW = figures && (card.sk1 || card.sk2) ? Math.min(w * (card.pair ? 0.5 : 0.36), h * (card.pair ? 1.2 : 0.75)) : 0;
      const tx = x + pad + figW;
      const tw = x + w - pad - tx;
      const size = Math.min(H * 0.034, h * 0.2);
      let ty = y + h / 2 - size * 0.4;
      this.text(label, tx, ty, H * 0.02, 800, hot ? COLORS.band : COLORS.muted, tw);
      ty += size * 1.15;
      this.text(card.name1, tx, ty, size, 850, COLORS.ink, tw);
      if (figW > 0) this.thumbs(card, x + pad * 0.5, y, figW, h, t, alpha);
    } else {
      // Two rows: P1 then P2.
      const rowH = h / 2;
      this.text(label, x + pad, y + pad + H * 0.018, H * 0.02, 800, hot ? COLORS.band : COLORS.muted, w - pad * 2);
      for (const p of [1, 2] as const) {
        const ry = y + (p - 1) * rowH;
        const sk = p === 1 ? card.sk1 : card.sk2;
        const figW = figures && sk ? Math.min(w * 0.26, rowH * 0.8) : 0;
        const tx = x + pad + figW + (figW ? pad * 0.3 : 0);
        const size = Math.min(H * 0.03, rowH * 0.3);
        const by = ry + rowH / 2 + size * (p === 1 ? 0.75 : 0.45);
        const cw = this.chip(p, tx, by, size * 0.8);
        this.text(p === 1 ? card.name1 : card.name2, tx + cw + pad * 0.5, by, size, 850, PLAYER_COLORS[p].light, x + w - pad - tx - cw - pad * 0.5);
        if (figW > 0 && sk) {
          const top = ry + pad * (p === 1 ? 1.8 : 0.4);
          const bottom = ry + rowH - pad * 0.4;
          const sc = (bottom - top) / 1.2;
          c.save();
          c.beginPath();
          c.rect(x + 2, ry + 2, figW + pad, rowH - 4);
          c.clip();
          (p === 1 ? this.mini1 : this.mini2).draw(c, sk, x + pad * 0.5 + figW / 2 - sk.p[J.PELVIS * 3] * sc, bottom - sc * 0.02, sc, t, true, alpha);
          c.restore();
        }
      }
    }
  }

  private thumbs(card: DuoCard, x: number, y: number, figW: number, h: number, t: number, alpha: number): void {
    const c = this.ctx;
    const H = this.layout.h;
    const pad = H * 0.012;
    const top = y + pad;
    const bottom = y + h - pad;
    c.save();
    c.beginPath();
    c.rect(x + 2, y + 2, figW, h - 4);
    c.clip();
    if (card.pair && card.sk1 && card.sk2) {
      const sc = Math.min((bottom - top) / 1.2, figW / (DUO_HOME + 0.75));
      const mid = x + figW / 2;
      this.mini3.draw(c, card.sk1, mid - (DUO_HOME / 2) * sc, bottom - sc * 0.02, sc, t, true, alpha);
      this.mini4.draw(c, card.sk2, mid + (DUO_HOME / 2) * sc, bottom - sc * 0.02, sc, t, true, alpha);
    } else {
      const sk = card.sk1 ?? card.sk2!;
      const sc = (bottom - top) / 1.2;
      this.mini3.draw(c, sk, x + figW / 2 - sk.p[J.PELVIS * 3] * sc, bottom - sc * 0.02, sc, t, true, alpha);
    }
    c.restore();
  }
}

/** A rope from P1's back (left) hand through both grips to P2's back (right) hand, with a little slack beyond. */
export function drawRope(c: CanvasRenderingContext2D, f1: DuoFigure, f2: DuoFigure, scale: number): void {
  const x1 = f1.hands[2], y1 = f1.hands[3];
  const x2 = f2.hands[0], y2 = f2.hands[1];
  const dx = x2 - x1, dy = y2 - y1;
  const ext = 0.12 * scale;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#120e1f';
  c.lineWidth = Math.max(3, scale * 0.03);
  c.beginPath();
  c.moveTo(x1 - ux * ext, y1 - uy * ext + ext * 0.5);
  c.quadraticCurveTo(x1 - ux * ext * 0.5, y1, x1, y1);
  c.lineTo(x2, y2);
  c.quadraticCurveTo(x2 + ux * ext * 0.5, y2, x2 + ux * ext, y2 + uy * ext + ext * 0.5);
  c.stroke();
  c.strokeStyle = '#e8c27a';
  c.lineWidth = Math.max(2, scale * 0.018);
  c.stroke();
  c.restore();
}
