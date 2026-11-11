/**
 * Duo bench (dev tool, not part of the app): /duo-demo.html
 *
 *   ?mode=song   (default) the two-player stage dancing the synthetic song
 *                (level=chill|cardio|sweaty, bpm, style=classic|human|sticker,
 *                build=female|male (P1's version; P2 dances the other),
 *                t=<sec>, freeze=1, sig=gallop,lasso to force a signature)
 *   ?mode=sheet  contact sheet of the partner moves: rows of moves x frames,
 *                both figures per cell (&moves=id1,id2, &page, &per, &frames,
 *                &beats=0,1.5,3 for chosen beats, &cw / &ch cell size)
 *   ?mode=bench  times single vs duo stage frames (results in __demo.result)
 *
 * Debug API: window.__demo.
 */

import { PARTNER_MOVES, type PartnerMove } from '../core/choreo/duoMoves';
import { partnerFrame, contactReport } from '../core/choreo/duoCheck';
import { DUO_HOME } from '../core/choreo/duoMoves';
import type { Intensity } from '../core/choreo/generator';
import { COLORS } from '../core/coach/renderer';
import { DEPTH_RISE, DuoFigure, drawHook, drawRope, PLAYER_COLORS } from '../core/coach/duoRenderer';
import { CAM, DEFAULT_COACH_BUILD, duoBuilds, parseCoachBuild, parseCoachStyle, type CoachStyle } from '../core/coach/styles';
import { createCoachStage } from '../ui/coachStage';
import { createDuoStage } from '../ui/duoStage';
import type { FrameInfo, StageRenderer } from '../ui/play';
import { SimSource } from './synth';

const expose = (o: Record<string, unknown>): void => {
  (window as unknown as { __demo: unknown }).__demo = o;
};

const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'song';
const style: CoachStyle = parseCoachStyle(q.get('style')) ?? 'human';
/** ?build=female|male: the chosen version (P1); P2 dances the other one. */
const build = parseCoachBuild(q.get('build')) ?? DEFAULT_COACH_BUILD;
const level = (q.get('level') ?? 'cardio') as Intensity;
const bpm = Number(q.get('bpm') ?? 120);

document.body.style.cssText = 'margin:0;background:#0f0d17;color:#eee;font:14px system-ui;overflow:hidden';

function runSong(): void {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;';
  document.body.append(host);
  const sim = new SimSource(bpm);
  sim.mode = 'map';
  const sig = q.get('sig');
  const stage = createDuoStage({
    getIntensity: () => level,
    isTV: q.get('tv') === '1',
    getStyle: () => style,
    getBuild: () => build,
    ...(sig ? { getStyleOverride: () => ({ signature: sig.split(',') }) } : {}),
  });
  stage.mount(host);
  let base = Number(q.get('t') ?? 0);
  let wall = performance.now();
  const frozen = q.get('freeze') === '1';
  const now = () => (frozen ? base : base + (performance.now() - wall) / 1000);
  const item = { kind: 'youtube' as const, videoId: q.get('video') ?? 'demo-song', title: q.get('title') ?? 'Demo song' };
  const frame = () => {
    requestAnimationFrame(frame);
    const t = now();
    sim.now = t;
    const fi: FrameInfo = { phase: 'playing', playing: true, duration: sim.fullMap.duration, item, beats: sim, intensity: level, audioOffsetMs: 0 };
    stage.frame(t, fi);
  };
  requestAnimationFrame(frame);
  expose({
    ready: true,
    seek: (t: number) => {
      base = t;
      wall = performance.now();
    },
    stats: () => stage.frameStats(),
  });
}

function runSheet(): void {
  const ids = q.get('moves')?.split(',');
  const list = PARTNER_MOVES.filter((m) => !ids || ids.includes(m.id));
  const per = Number(q.get('per') ?? 6);
  const page = Number(q.get('page') ?? 0);
  // &beats=0,1.5,3 picks the beats shown (default: `frames` evenly over the move).
  const beatList = q.get('beats')?.split(',').map(Number).filter((b) => Number.isFinite(b));
  const frames = beatList?.length ?? Number(q.get('frames') ?? 8);
  const rows = list.slice(page * per, page * per + per);
  const cw = Number(q.get('cw') ?? 230), ch = Number(q.get('ch') ?? 210);
  const labelW = 210;
  const c = document.createElement('canvas');
  c.width = labelW + cw * frames;
  c.height = Math.max(1, rows.length) * ch;
  document.body.append(c);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = COLORS.bg1;
  ctx.fillRect(0, 0, c.width, c.height);
  const f1 = new DuoFigure(1), f2 = new DuoFigure(2);
  f1.style = f2.style = style;
  [f1.build, f2.build] = duoBuilds(build);
  rows.forEach((pm: PartnerMove, r) => {
    const y0 = r * ch;
    ctx.fillStyle = r % 2 ? '#191329' : '#1d1730';
    ctx.fillRect(0, y0, c.width, ch);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '800 17px system-ui';
    ctx.fillText(pm.name, 10, y0 + 28);
    ctx.font = '13px system-ui';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`${pm.id}`, 10, y0 + 48);
    ctx.fillText(`${pm.beats} beats · ${pm.level} · d${pm.difficulty}${pm.jump ? ' · jump' : ''}`, 10, y0 + 66);
    const cr = contactReport(pm);
    ctx.fillText(cr.length ? `contact ${cr.map((x) => x.dist.toFixed(2)).join(' ')}` : 'no contact', 10, y0 + 84);
    if (pm.roles) {
      ctx.fillStyle = PLAYER_COLORS[1].main;
      ctx.fillText(`P1: ${pm.p1.map((m) => m.name).join(' → ')}`, 10, y0 + 104);
      ctx.fillStyle = PLAYER_COLORS[2].main;
      ctx.fillText(`P2: ${pm.p2.map((m) => m.name).join(' → ')}`, 10, y0 + 122);
    }
    for (let k = 0; k < frames; k++) {
      const b = beatList ? beatList[k] : (k / frames) * pm.beats;
      const fr = partnerFrame(pm, b, bpm);
      const x0 = labelW + k * cw;
      ctx.strokeStyle = '#2b2440';
      ctx.strokeRect(x0, y0, cw, ch);
      ctx.fillStyle = COLORS.muted;
      ctx.font = '12px system-ui';
      ctx.fillText(`b${b.toFixed(1)}`, x0 + 4, y0 + 14);
      const scale = Math.min(ch * 0.72, cw / (DUO_HOME + 0.9));
      const floor = y0 + ch - 14;
      const mid = x0 + cw / 2;
      const order: (1 | 2)[] = fr.z[0] > fr.z[1] ? [2, 1] : [1, 2];
      for (const p of order) {
        const z = fr.z[p - 1];
        const kk = CAM / (CAM - z);
        const hx = (p === 1 ? -1 : 1) * (DUO_HOME / 2) * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 + 1, y0 + 1, cw - 2, ch - 2);
        ctx.clip();
        (p === 1 ? f1 : f2).draw(ctx, fr.sk[p - 1], mid + hx * kk, floor + z * scale * DEPTH_RISE, scale * kk, b * 0.5, false);
        ctx.restore();
      }
      if (pm.hook) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 + 1, y0 + 1, cw - 2, ch - 2);
        ctx.clip();
        drawHook(ctx, order[0] === 1 ? f1 : f2, fr.sk[order[0] - 1], pm.hook);
        ctx.restore();
      }
      if (pm.prop === 'rope') drawRope(ctx, f1, f2, scale);
    }
  });
  expose({ ready: true, total: list.length });
}

function runBench(): void {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px;';
  document.body.append(host);
  const sim = new SimSource(120);
  const item = { kind: 'youtube' as const, videoId: 'demo-song', title: 'Demo song' };
  const time = (stage: StageRenderer, n: number): number => {
    stage.mount(host);
    const fi = (_t: number): FrameInfo => ({ phase: 'playing', playing: true, duration: sim.fullMap.duration, item, beats: sim, intensity: level, audioOffsetMs: 0 });
    for (let i = 0; i < 30; i++) {
      sim.now = 20 + i / 60;
      stage.frame(sim.now, fi(sim.now));
    }
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      sim.now = 30 + i / 60;
      stage.frame(sim.now, fi(sim.now));
    }
    const ms = (performance.now() - t0) / n;
    stage.unmount();
    return ms;
  };
  const deps = { getIntensity: () => level, isTV: false, getStyle: () => style, getBuild: () => build };
  const result: Record<string, number> = {};
  for (let rep = 0; rep < 2; rep++) {
    result.single = time(createCoachStage(deps), 300);
    result.duo = time(createDuoStage(deps), 300);
  }
  result.ratio = result.duo / result.single;
  expose({ ready: true, result });
  document.body.append(JSON.stringify(result));
}

if (mode === 'sheet') runSheet();
else if (mode === 'bench') runBench();
else runSong();
