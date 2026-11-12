/**
 * Graphics test: a fixed run of short frame-rate tests that shows where the
 * time goes on a device we can't see (Options → Graphics → Diagnostics →
 * Run graphics test on the TV; `?gfxtest=1` or `?gfxtest=run` on the web,
 * `&gfxonly=A,F1` to run some rows only).
 *
 * Every test runs an animation-frame loop for a moment and reports frames
 * per second, the median and 95th-percentile frame interval, the JS time
 * inside the frame callback and, where the browser has the Long Animation
 * Frames API, how much of the time the main thread was busy in long frames
 * (and how much of that was style / layout / paint). The table ends with a
 * short summary string to read out, and the last results are kept in
 * localStorage.
 *
 * The coach rows use the real stages from the play chunk (gfxBenchCoach.ts),
 * loaded with the app's own loadChunk().
 */

import { tvBridge, tvState, type DanceBridgeNative, type NativeGraphicsInfo } from '../platform/androidtv';
import { store } from '../store';
import { formatTime, h, type Screen } from './dom';
import { ensureFocus, type Scope } from './focusNav';
import {
  chromeVersion,
  makeWav,
  parseStored,
  round,
  shortGpu,
  summarize,
  summaryString,
  tvAppVersion,
  type GfxRow,
  type StoredResults,
} from './gfxStats';

type PlayChunk = typeof import('./playChunk');

export interface GraphicsTestDeps {
  loadChunk(): Promise<PlayChunk>;
  /** Back (to Diagnostics on the TV). */
  back(): void;
  isTV: boolean;
  /** Start a run straight away (the "Run graphics test" button). */
  autostart?: boolean;
}

const STORE_KEY = 'dd.gfxtest.v1';
const WARM_MS = 300;
const MEASURE_MS = 1800;
const GAP_MS = 250;
const SETUP_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Tests

type FrameFn = (now: number) => void;

interface Prepared {
  /** Per frame (null: an empty loop). */
  frame: FrameFn | null;
  /** Tear down; may return a note for the results. */
  cleanup?: () => string | void;
  note?: string;
}

interface Ctx {
  stage: HTMLElement;
  chunk(): Promise<PlayChunk>;
  isTV: boolean;
  native: DanceBridgeNative | null;
  /** Draw calls per frame, e.g. "coach p85 f23 s79 c1 i4 h0" (one notes line). */
  ops: string[];
  /** Per-row details, e.g. "F1 1280x720" (one notes line). */
  details: string[];
  /** Extra tokens for the summary line. */
  tokens: string[];
}

interface TestDef {
  id: string;
  name: string;
  run(c: Ctx): Promise<Prepared>;
}

class SkipError extends Error {}

const COLORS = ['#ff5c8a', '#4be3c0', '#ffd84a', '#8a7dff', '#ff9a6b', '#5cc8ff'];

/** A canvas in the stage. `css`: 'full' (scaled to the whole screen) or a CSS size centred, unscaled. */
function addCanvas(stage: HTMLElement, w: number, h0: number, css: 'full' | [number, number], opts?: CanvasRenderingContext2DSettings) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h0;
  c.style.cssText =
    css === 'full'
      ? 'position:absolute;inset:0;width:100%;height:100%;display:block;'
      : `position:absolute;display:block;left:calc(50% - ${css[0] / 2}px);top:calc(50% - ${css[1] / 2}px);width:${css[0]}px;height:${css[1]}px;`;
  stage.append(c);
  const ctx = c.getContext('2d', opts);
  if (!ctx) throw new Error('no 2D context');
  return { c, ctx };
}

/** C/D/E rows: clear + one small moving rect. */
function rectTest(w: number, h0: number, css: 'full' | [number, number] = 'full', opts?: CanvasRenderingContext2DSettings) {
  return async (c: Ctx): Promise<Prepared> => {
    const { ctx } = addCanvas(c.stage, w, h0, css, opts);
    const s = Math.max(4, Math.round(w / 32));
    return {
      frame: (now) => {
        ctx.clearRect(0, 0, w, h0);
        ctx.fillStyle = COLORS[0];
        ctx.fillRect((now / 4) % (w - s), h0 / 2 - s / 2, s, s);
      },
    };
  };
}

/** Limb-sized shapes scattered over a 1280x720 canvas, wobbling a little each frame. */
interface Item {
  x: number;
  y: number;
  a: number;
  ph: number;
  col: string;
}
function items(n: number, w: number, h0: number): Item[] {
  const out: Item[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) out.push({ x: 60 + rnd() * (w - 120), y: 70 + rnd() * (h0 - 140), a: rnd() * Math.PI, ph: rnd() * 6.28, col: COLORS[i % COLORS.length] });
  return out;
}
const LIMB_W = 28;
const LIMB_H = 120;

function capsule(ctx: CanvasRenderingContext2D, w: number, len: number): void {
  const r = w / 2;
  ctx.moveTo(-r, -len / 2 + r);
  ctx.arc(0, -len / 2 + r, r, Math.PI, 0);
  ctx.lineTo(r, len / 2 - r);
  ctx.arc(0, len / 2 - r, r, 0, Math.PI);
  ctx.closePath();
}

type ShapeKind = 'path' | 'rect' | 'sprite' | 'fill' | 'strokeRound' | 'strokeButt' | 'concave' | 'thin';

/**
 * A torso-like closed outline (shoulders, pinched waist, hips, a neckline
 * dip), as the coach's shirt is drawn: a smooth curve through the midpoints
 * of these points (x, y pairs around the centre). Concave, so it can't use a
 * GPU's fast convex-path fill.
 */
const TORSO = [-8, -55, -30, -54, -38, -40, -26, -12, -22, 10, -34, 40, -32, 55, 32, 55, 34, 40, 22, 10, 26, -12, 38, -40, 30, -54, 8, -55, 0, -45];

function torsoPath(ctx: CanvasRenderingContext2D): void {
  const n = TORSO.length / 2;
  const mx = (i: number) => (TORSO[(i % n) * 2] + TORSO[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (TORSO[(i % n) * 2 + 1] + TORSO[((i + 1) % n) * 2 + 1]) / 2;
  ctx.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(TORSO[i * 2], TORSO[i * 2 + 1], mx(i), my(i));
  ctx.closePath();
}

function shapeTest(kind: ShapeKind, n: number) {
  return async (c: Ctx): Promise<Prepared> => {
    const W = 1280;
    const H = 720;
    const { ctx } = addCanvas(c.stage, W, H, 'full');
    const list = items(n, W, H);
    // Sprites: each colour's limb rendered once.
    const sprites = COLORS.map((col) => {
      const s = document.createElement('canvas');
      s.width = LIMB_W + 8;
      s.height = LIMB_H + 8;
      const g = s.getContext('2d')!;
      g.translate(s.width / 2, s.height / 2);
      g.beginPath();
      capsule(g, LIMB_W, LIMB_H);
      g.fillStyle = col;
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#1a0610';
      g.stroke();
      return s;
    });
    return {
      frame: (now) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = kind === 'path' ? 3 : kind === 'thin' ? 1.5 : 24;
        ctx.strokeStyle = '#1a0610';
        ctx.lineCap = kind === 'strokeButt' ? 'butt' : 'round';
        ctx.lineJoin = kind === 'strokeButt' ? 'miter' : 'round';
        for (let i = 0; i < list.length; i++) {
          const it = list[i];
          const x = it.x + Math.sin(now / 500 + it.ph) * 30;
          const y = it.y + Math.cos(now / 650 + it.ph) * 12;
          if (kind === 'rect') {
            ctx.fillStyle = it.col;
            ctx.fillRect(x - LIMB_W / 2, y - LIMB_H / 2, LIMB_W, LIMB_H);
            continue;
          }
          const a = it.a + Math.sin(now / 700 + it.ph) * 0.6;
          const cs = Math.cos(a);
          const sn = Math.sin(a);
          ctx.setTransform(cs, sn, -sn, cs, x, y);
          if (kind === 'sprite') {
            const s = sprites[i % sprites.length];
            ctx.drawImage(s, -s.width / 2, -s.height / 2);
            continue;
          }
          ctx.beginPath();
          if (kind === 'concave') {
            torsoPath(ctx);
            ctx.fillStyle = it.col;
            ctx.fill();
            continue;
          }
          if (kind === 'strokeRound' || kind === 'strokeButt' || kind === 'thin') {
            ctx.moveTo(0, -LIMB_H / 2 + 12);
            ctx.lineTo(10, 0);
            ctx.lineTo(0, LIMB_H / 2 - 12);
            ctx.strokeStyle = it.col;
            ctx.stroke();
            continue;
          }
          capsule(ctx, LIMB_W, LIMB_H);
          ctx.fillStyle = it.col;
          ctx.fill();
          if (kind === 'path') ctx.stroke();
        }
      },
    };
  };
}

/** The real play screen's DOM (same classes, so the same CSS), optionally with its HUD ticking as play.ts does. */
function playDom(stage: HTMLElement): { host: HTMLElement; tick: FrameFn } {
  const host = h('div', { id: 'coach-stage', class: 'coach-stage', 'data-mount': 'coach' });
  const fill = h('div', { class: 'progress-fill' });
  const elapsed = h('span', { class: 'elapsed' }, '0:50');
  stage.append(
    h(
      'main',
      { class: 'screen play' },
      host,
      h('div', { class: 'hud hud-top' }, h('div', { class: 'now-title' }, 'Graphics test'), h('div', { class: 'now-artist' }, 'DanceDance')),
      h('div', { class: 'sync-chip', 'data-kind': 'ok' }, h('i', { class: 'sync-dot' }), h('span', { class: 'sync-chip-text' }, 'Beat map')),
      h(
        'div',
        { class: 'hud hud-bottom' },
        h('div', { class: 'progress' }, fill),
        h('div', { class: 'time' }, elapsed, h('span', { class: 'time-sep' }, ' / '), h('span', { class: 'total' }, '3:00')),
      ),
    ),
  );
  const t0 = performance.now();
  let lastQ = -1;
  let lastS = -1;
  return {
    host,
    // Like play.ts: the bar only when it visibly moves, the time once a second.
    tick: (now) => {
      const t = 50 + (now - t0) / 1000;
      const q = Math.round(Math.min(1, t / 180) * 2000);
      if (q !== lastQ) {
        lastQ = q;
        fill.style.transform = `scaleX(${q / 2000})`;
      }
      const s = Math.floor(t);
      if (s !== lastS) {
        lastS = s;
        elapsed.textContent = formatTime(t);
      }
    },
  };
}

interface CoachOpts {
  players: 1 | 2;
  tier: 0 | 1 | 2;
  dom: 'play' | 'bare';
  /** Count draw calls (once, untimed) and add them to the notes under this label. */
  countAs?: string;
  /** Draw one frame only (then just the HUD ticks). */
  still?: boolean;
  /** Sprite drawing on / off (the F rows: off, as measured before sprites existed). */
  sprites?: boolean;
}

function coachTest(o: CoachOpts) {
  return async (c: Ctx): Promise<Prepared> => {
    const m = await c.chunk();
    let host: HTMLElement;
    let tick: FrameFn | null = null;
    if (o.dom === 'play') {
      const p = playDom(c.stage);
      host = p.host;
      tick = p.tick;
    } else {
      host = h('div', { style: 'position:absolute;inset:0;' });
      c.stage.append(host);
    }
    const s = store.settings();
    const st = m.benchStage({ players: o.players, tier: o.tier, isTV: c.isTV, style: s.coachStyle, build: s.coachBuild, sprites: o.sprites });
    st.mount(host);
    st.frame(0); // builds the routine
    // Sprites: make the ones the measured stretch needs first (a real song's countdown does this).
    if (o.sprites) st.prewarm(0, 0.4 + (WARM_MS + MEASURE_MS) / 1000 + 3);
    const s0 = st.spriteStats();
    if (o.countAs) {
      const ops = countOps(() => {
        for (let i = 1; i <= 10; i++) st.frame(i / 30);
      }, 10);
      c.ops.push(`${o.countAs} ${ops.text}`);
      c.tokens.push(`o${o.players}:${ops.short}`);
    }
    const t0 = performance.now();
    const note = st.describe().replace(/^\S+ /, ''); // the canvas size (the row names the tier)
    if (o.still) return { frame: tick, cleanup: () => st.unmount(), note };
    const cleanup = (): string | void => {
      const s1 = st.spriteStats();
      st.unmount();
      if (!s1 || !s0) return;
      // New sprites / parts drawn with paths during the measurement, and the cache's size.
      return `sprites ${s1.entries} (${Math.round(s1.usedBytes / 2 ** 20)} of ${Math.round(s1.bytes / 2 ** 20)} MB), new ${s1.made - s0.made}, paths ${s1.direct - s0.direct}`;
    };
    return {
      frame: (now) => {
        tick?.(now);
        st.frame(0.4 + (now - t0) / 1000);
      },
      cleanup,
      note,
    };
  };
}

/** L rows: the real figure painter alone, with or without a clip region (the dirty-rect code clips). */
function figureTest(clip: boolean) {
  return async (c: Ctx): Promise<Prepared> => {
    const m = await c.chunk();
    const s = store.settings();
    const draw = m.benchFigure(s.coachStyle, s.coachBuild);
    const W = 1280;
    const H = 720;
    const { ctx } = addCanvas(c.stage, W, H, 'full');
    if (!clip) {
      const ops = countOps(() => draw(ctx, W, H, 0), 1);
      c.ops.push(`figure alone ${ops.text}`);
    }
    const t0 = performance.now();
    return {
      frame: (now) => {
        const sec = (now - t0) / 1000;
        ctx.clearRect(0, 0, W, H);
        if (clip) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(W / 2 - H * 0.42, H * 0.02, H * 0.84, H * 0.96);
          ctx.clip();
          draw(ctx, W, H, sec);
          ctx.restore();
        } else draw(ctx, W, H, sec);
      },
    };
  };
}

/** B: a compositor-only CSS animation; we can only see the rAF rate it leaves us. */
async function cssAnimTest(c: Ctx): Promise<Prepared> {
  const box = h('div', {
    style: `position:absolute;left:10vw;top:40vh;width:12vh;height:12vh;border-radius:2vh;background:${COLORS[1]};will-change:transform;`,
  });
  c.stage.append(box);
  const anim = box.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(60vw)' }], { duration: 1500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  return { frame: null, cleanup: () => anim.cancel() };
}

/** H: a coach stand-in made of 15 rounded divs moved with transforms (no canvas). */
async function domCoachTest(c: Ctx): Promise<Prepared> {
  const list = items(15, innerWidth, innerHeight);
  const els = list.map((it) => {
    const el = h('div', {
      style: `position:absolute;left:0;top:0;width:${LIMB_W}px;height:${LIMB_H}px;border-radius:${LIMB_W / 2}px;background:${it.col};border:3px solid #1a0610;will-change:transform;`,
    });
    c.stage.append(el);
    return el;
  });
  return {
    frame: (now) => {
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const x = it.x + Math.sin(now / 500 + it.ph) * 30;
        const a = it.a + Math.sin(now / 700 + it.ph) * 0.6;
        els[i].style.transform = `translate(${x.toFixed(1)}px,${it.y.toFixed(1)}px) rotate(${a.toFixed(3)}rad)`;
      }
    },
  };
}

/** I: 15 coloured quads on a 1280x720 WebGL canvas. */
async function webglTest(c: Ctx): Promise<Prepared> {
  const W = 1280;
  const H = 720;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  c.stage.append(cv);
  const gl = cv.getContext('webgl');
  if (!gl) throw new SkipError('not available (no WebGL context)');
  let lost = false;
  cv.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
  });
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s) ?? '?'}`);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec3 c;varying vec3 v;uniform vec2 r;void main(){v=c;gl_Position=vec4(p/r*2.0-1.0,0,1);gl_Position.y=-gl_Position.y;}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec3 v;void main(){gl_FragColor=vec4(v,1);}'));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('WebGL program did not link');
  gl.useProgram(prog);
  const list = items(15, W, H);
  const data = new Float32Array(list.length * 6 * 5);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  const ap = gl.getAttribLocation(prog, 'p');
  const ac = gl.getAttribLocation(prog, 'c');
  gl.enableVertexAttribArray(ap);
  gl.enableVertexAttribArray(ac);
  gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(ac, 3, gl.FLOAT, false, 20, 8);
  gl.uniform2f(gl.getUniformLocation(prog, 'r'), W, H);
  gl.viewport(0, 0, W, H);
  const rgb = list.map((it) => [1, 3, 5].map((k) => parseInt(it.col.slice(k, k + 2), 16) / 255));
  return {
    frame: (now) => {
      if (lost || gl.isContextLost()) throw new Error('WebGL context lost');
      let o = 0;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const x = it.x + Math.sin(now / 500 + it.ph) * 30;
        const a = it.a + Math.sin(now / 700 + it.ph) * 0.6;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        const corner = (dx: number, dy: number) => {
          data[o++] = x + dx * cs - dy * sn;
          data[o++] = it.y + dx * sn + dy * cs;
          data[o++] = rgb[i][0];
          data[o++] = rgb[i][1];
          data[o++] = rgb[i][2];
        };
        const hw = LIMB_W / 2;
        const hh = LIMB_H / 2;
        corner(-hw, -hh);
        corner(hw, -hh);
        corner(hw, hh);
        corner(-hw, -hh);
        corner(hw, hh);
        corner(-hw, hh);
      }
      gl.clearColor(0.06, 0.05, 0.09, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.drawArrays(gl.TRIANGLES, 0, list.length * 6);
    },
    cleanup: () => {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** J: run another test while a quiet generated WAV loops through an <audio> element (as the TV plays songs). */
function withAudio(inner: (c: Ctx) => Promise<Prepared>) {
  return async (c: Ctx): Promise<Prepared> => {
    const url = URL.createObjectURL(new Blob([makeWav(2) as BlobPart], { type: 'audio/wav' }));
    const a = new Audio();
    a.loop = true;
    a.src = url;
    let updates = 0;
    const onTime = () => updates++;
    a.addEventListener('timeupdate', onTime);
    const stop = () => {
      a.removeEventListener('timeupdate', onTime);
      a.pause();
      a.removeAttribute('src');
      a.load();
      URL.revokeObjectURL(url);
    };
    try {
      await withTimeout(a.play(), 4000, 'audio did not start within 4 s');
      const until = performance.now() + 1500;
      while (a.currentTime === 0 && performance.now() < until) await sleep(50);
      if (a.currentTime === 0) throw new Error('audio started but its time is not moving');
    } catch (err) {
      stop();
      throw err;
    }
    let p: Prepared;
    try {
      p = await inner(c);
    } catch (err) {
      stop();
      throw err;
    }
    return {
      frame: p.frame,
      note: p.note,
      cleanup: () => {
        const playing = !a.paused && updates > 0;
        p.cleanup?.();
        stop();
        return playing ? 'audio ok' : 'audio NOT playing';
      },
    };
  };
}

/** K: the same test with the WebView's View layer type switched natively. */
function withLayer(type: 'hardware' | 'software', inner: (c: Ctx) => Promise<Prepared>) {
  return async (c: Ctx): Promise<Prepared> => {
    const set = c.native?.setWebViewLayerType;
    if (!c.native || typeof set !== 'function') throw new SkipError('skipped: needs the TV app (layer type is native)');
    const got = set.call(c.native, type);
    if (got !== type) throw new Error(`could not set layer: ${got}`);
    await sleep(700);
    const p = await inner(c);
    return { ...p, note: `layer ${got}${p.note ? `, ${p.note}` : ''}` };
  };
}

const empty = async (): Promise<Prepared> => ({ frame: null });

export const TESTS: readonly TestDef[] = [
  { id: 'A1', name: 'Empty loop, bare page', run: empty },
  {
    id: 'A2',
    name: 'Empty loop + play-screen DOM',
    run: async (c) => {
      playDom(c.stage);
      return { frame: null };
    },
  },
  { id: 'A3', name: 'Play DOM + still coach, HUD ticks', run: coachTest({ players: 1, tier: 1, dom: 'play', still: true, sprites: false }) },
  { id: 'B1', name: 'CSS-animated box (rAF rate)', run: cssAnimTest },
  { id: 'C1', name: '2D 1280x720, clear + 1 rect', run: rectTest(1280, 720) },
  { id: 'C2', name: 'C1 opaque (alpha:false)', run: rectTest(1280, 720, 'full', { alpha: false }) },
  { id: 'C3', name: 'C1 desynchronized', run: rectTest(1280, 720, 'full', { desynchronized: true }) },
  { id: 'C4', name: 'C1 CPU canvas (willReadFreq.)', run: rectTest(1280, 720, 'full', { willReadFrequently: true }) },
  { id: 'D1', name: '2D 960x540 scaled up', run: rectTest(960, 540) },
  { id: 'D2', name: '2D 640x360 scaled up', run: rectTest(640, 360) },
  { id: 'D3', name: '2D 320x180 scaled up', run: rectTest(320, 180) },
  {
    id: 'E1',
    name: '2D small on screen, 480x270',
    run: (c) => {
      const d = window.devicePixelRatio || 1;
      return rectTest(Math.round(480 * d), Math.round(270 * d), [480, 270])(c);
    },
  },
  // F: the coach drawn with paths (the Smooth tiers before sprites), for comparison with earlier runs.
  { id: 'F1', name: 'Coach Smooth, paths (play DOM)', run: coachTest({ players: 1, tier: 1, dom: 'play', countAs: 'coach paths', sprites: false }) },
  { id: 'F2', name: 'Coach Smoothest, paths (30/s)', run: coachTest({ players: 1, tier: 2, dom: 'play', sprites: false }) },
  { id: 'F3', name: 'Duo Smooth, paths (play DOM)', run: coachTest({ players: 2, tier: 1, dom: 'play', countAs: 'duo paths', sprites: false }) },
  { id: 'F4', name: 'Coach Smooth, paths, bare page', run: coachTest({ players: 1, tier: 1, dom: 'bare', sprites: false }) },
  { id: 'P1', name: 'Paths fill+stroke x20', run: shapeTest('path', 20) },
  { id: 'P2', name: 'Paths fill+stroke x60', run: shapeTest('path', 60) },
  { id: 'P3', name: 'Paths fill+stroke x180', run: shapeTest('path', 180) },
  { id: 'R1', name: 'fillRect x20', run: shapeTest('rect', 20) },
  { id: 'R2', name: 'fillRect x60', run: shapeTest('rect', 60) },
  { id: 'R3', name: 'fillRect x180', run: shapeTest('rect', 180) },
  { id: 'G1', name: 'Sprites drawImage x20', run: shapeTest('sprite', 20) },
  { id: 'G2', name: 'Sprites drawImage x60', run: shapeTest('sprite', 60) },
  { id: 'G3', name: 'Sprites drawImage x180', run: shapeTest('sprite', 180) },
  { id: 'S1', name: 'Fills only x60', run: shapeTest('fill', 60) },
  { id: 'S2', name: 'Thick strokes, round x60', run: shapeTest('strokeRound', 60) },
  { id: 'S3', name: 'Thick strokes, butt x60', run: shapeTest('strokeButt', 60) },
  { id: 'L1', name: 'Real figure, no clip', run: figureTest(false) },
  { id: 'L2', name: 'Real figure inside clip()', run: figureTest(true) },
  { id: 'H1', name: 'DOM coach, 15 divs', run: domCoachTest },
  { id: 'I1', name: 'WebGL, 15 quads', run: webglTest },
  { id: 'J1', name: 'Empty loop + <audio>', run: withAudio(empty) },
  { id: 'J2', name: 'C1 + <audio>', run: withAudio(rectTest(1280, 720)) },
  { id: 'J3', name: 'F1 + <audio> (like a song)', run: withAudio(coachTest({ players: 1, tier: 1, dom: 'play', sprites: false })) },
  { id: 'K1', name: 'C1, hardware layer', run: withLayer('hardware', rectTest(1280, 720)) },
  { id: 'K2', name: 'F1, hardware layer', run: withLayer('hardware', coachTest({ players: 1, tier: 1, dom: 'play', sprites: false })) },
  { id: 'K3', name: 'C1, software layer', run: withLayer('software', rectTest(1280, 720)) },
  { id: 'K4', name: 'F1, software layer', run: withLayer('software', coachTest({ players: 1, tier: 1, dom: 'play', sprites: false })) },
  // W: the coach and the duo as the Smooth tiers now draw them (pre-drawn sprites; prewarmed first, as a song's countdown does).
  { id: 'W1', name: 'Coach Smooth, sprites (play DOM)', run: coachTest({ players: 1, tier: 1, dom: 'play', countAs: 'coach sprites', sprites: true }) },
  { id: 'W2', name: 'Duo Smooth, sprites (play DOM)', run: coachTest({ players: 2, tier: 1, dom: 'play', countAs: 'duo sprites', sprites: true }) },
  { id: 'W3', name: 'Coach Smoothest, sprites (30/s)', run: coachTest({ players: 1, tier: 2, dom: 'play', sprites: true }) },
  { id: 'W4', name: 'Duo Smoothest, sprites (30/s)', run: coachTest({ players: 2, tier: 2, dom: 'play', sprites: true }) },
  // Q: are non-convex fills slow too (the torsos are still filled per frame)? T: strokes as such, or their width?
  { id: 'Q1', name: 'Concave fills, no stroke x60', run: shapeTest('concave', 60) },
  { id: 'Q2', name: 'Concave fills, no stroke x180', run: shapeTest('concave', 180) },
  { id: 'T1', name: 'Thin strokes 1.5 px x60', run: shapeTest('thin', 60) },
];

// ---------------------------------------------------------------------------
// Measuring

interface Measured {
  row: Pick<GfxRow, 'fps' | 'med' | 'p95' | 'js' | 'busy' | 'paint'>;
  error?: string;
}

const LOAF = (() => {
  try {
    return typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes ?? []).includes('long-animation-frame');
  } catch {
    return false;
  }
})();

function measure(frame: FrameFn | null, aborted: () => boolean): Promise<Measured> {
  return new Promise((resolve) => {
    const intervals: number[] = [];
    const js: number[] = [];
    const loafs: { start: number; end: number; style: number }[] = [];
    let po: PerformanceObserver | null = null;
    if (LOAF) {
      try {
        po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const x = e as PerformanceEntry & { styleAndLayoutStart?: number };
            loafs.push({ start: e.startTime, end: e.startTime + e.duration, style: x.styleAndLayoutStart || e.startTime + e.duration });
          }
        });
        po.observe({ type: 'long-animation-frame', buffered: false });
      } catch {
        po = null;
      }
    }
    const begin = performance.now();
    let mStart = -1;
    let last = -1;
    let raf = 0;
    let done = false;
    let error: string | undefined;
    const hard = setTimeout(() => finish(), WARM_MS + MEASURE_MS + 4000);
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(hard);
      const end = last;
      if (po) {
        for (const e of po.takeRecords()) {
          const x = e as PerformanceEntry & { styleAndLayoutStart?: number };
          loafs.push({ start: e.startTime, end: e.startTime + e.duration, style: x.styleAndLayoutStart || e.startTime + e.duration });
        }
        po.disconnect();
      }
      const s = summarize(intervals, js);
      if (!s) {
        resolve({ row: {}, error: error ?? `only ${intervals.length + (mStart >= 0 ? 1 : 0)} frames in ${round((performance.now() - begin) / 1000, 1)} s` });
        return;
      }
      const row: Measured['row'] = { fps: s.fps, med: s.med, p95: s.p95, js: s.js };
      if (po && end > mStart) {
        const inWin = loafs.filter((l) => l.end > mStart && l.start < end);
        const busy = inWin.reduce((a, l) => a + (Math.min(l.end, end) - Math.max(l.start, mStart)), 0);
        row.busy = Math.round((busy / (end - mStart)) * 100);
        row.paint = inWin.length ? round(inWin.reduce((a, l) => a + (l.end - l.style), 0) / inWin.length, 1) : 0;
      }
      resolve({ row, error });
    };
    const cb = (ts: number) => {
      if (done) return;
      raf = requestAnimationFrame(cb);
      const t0 = performance.now();
      if (frame) {
        try {
          frame(t0);
        } catch (err) {
          error = errText(err);
          finish();
          return;
        }
      }
      const t1 = performance.now();
      if (mStart < 0) {
        if (t0 - begin >= WARM_MS) {
          mStart = ts;
          last = ts;
        }
        return;
      }
      intervals.push(ts - last);
      js.push(t1 - t0);
      last = ts;
      if (ts - mStart >= MEASURE_MS || aborted()) finish();
    };
    raf = requestAnimationFrame(cb);
  });
}

interface OpCounts {
  text: string;
  short: string;
}

const COUNTED = ['beginPath', 'fill', 'stroke', 'clip', 'fillRect', 'clearRect', 'strokeRect', 'drawImage', 'fillText', 'strokeText', 'putImageData'] as const;

/** Count 2D draw calls made by `run` (all canvases), per `frames`. Untimed. */
function countOps(run: () => void, frames: number): OpCounts {
  const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const n: Record<string, number> = { shadow: 0, gradient: 0, filter: 0 };
  const saved = new Map<string, (...a: unknown[]) => unknown>();
  for (const k of COUNTED) {
    const orig = proto[k];
    if (typeof orig !== 'function') continue;
    saved.set(k, orig);
    n[k] = 0;
    proto[k] = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
      n[k]++;
      if (k === 'fill' || k === 'stroke' || k === 'fillRect' || k === 'fillText' || k === 'drawImage') {
        if (this.shadowBlur > 0 && !/rgba\(0, 0, 0, 0\)|transparent/.test(this.shadowColor)) n.shadow++;
        if (k !== 'stroke' && k !== 'drawImage' && typeof this.fillStyle !== 'string') n.gradient++;
        if (this.filter && this.filter !== 'none') n.filter++;
      }
      return orig.apply(this, a);
    };
  }
  try {
    run();
  } finally {
    for (const [k, f] of saved) proto[k] = f;
  }
  const per = (k: string) => Math.round((n[k] ?? 0) / frames);
  const v = {
    paths: per('beginPath'),
    fills: per('fill'),
    strokes: per('stroke'),
    clips: per('clip'),
    rects: per('fillRect') + per('clearRect') + per('strokeRect'),
    images: per('drawImage') + per('putImageData'),
    text: per('fillText') + per('strokeText'),
    shadow: per('shadow'),
    gradient: per('gradient'),
    filter: per('filter'),
  };
  return {
    text: `p${v.paths} f${v.fills} s${v.strokes} c${v.clips} r${v.rects} i${v.images} t${v.text} h${v.shadow} g${v.gradient}${v.filter ? ` filter${v.filter}` : ''}`,
    short: `p${v.paths}f${v.fills}s${v.strokes}c${v.clips}i${v.images}h${v.shadow}`,
  };
}

// ---------------------------------------------------------------------------
// Environment

interface Env {
  rows: [string, string][];
  tokens: string[];
}

function webglInfo(): { text: string; gpu: string; caveat: boolean | null } {
  try {
    const c = document.createElement('canvas');
    let ver = 'WebGL 2';
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = c.getContext('webgl2');
    if (!gl) {
      ver = 'WebGL 1';
      gl = c.getContext('webgl');
    }
    if (!gl) return { text: 'not available', gpu: 'none', caveat: null };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const vendor = String(gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    // Chrome refuses this when WebGL would be software-only (SwiftShader) or blocklisted.
    const c2 = document.createElement('canvas');
    const g2 = c2.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    g2?.getExtension('WEBGL_lose_context')?.loseContext();
    return { text: `${ver} · ${renderer} · ${vendor}`, gpu: renderer, caveat: !g2 };
  } catch (err) {
    return { text: `error: ${errText(err)}`, gpu: 'error', caveat: null };
  }
}

function collectEnv(isTV: boolean, native: DanceBridgeNative | null): Env {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const dpr = window.devicePixelRatio || 1;
  const iw = window.innerWidth;
  const ih = window.innerHeight;
  const gl = webglInfo();
  const s = store.settings();
  const rows: [string, string][] = [
    ['App', tvAppVersion(ua) ?? tvState.config?.appVersion ?? (isTV ? 'TV (version unknown)' : 'web')],
    ['Chrome / WebView', chromeVersion(ua) ?? ua.slice(0, 60)],
    ['Window', `${iw}x${ih} CSS px × DPR ${round(dpr, 2)} = ${Math.round(iw * dpr)}x${Math.round(ih * dpr)} px`],
    ['Screen', `${screen.width}x${screen.height}`],
    ['CPU / memory', `${nav.hardwareConcurrency ?? '?'} cores · ${nav.deviceMemory !== undefined ? `${nav.deviceMemory} GB` : 'memory not reported'}`],
    ['WebGL', gl.text],
    ['GPU WebGL', gl.caveat === null ? 'n/a' : gl.caveat ? 'NO (software or blocklisted)' : 'yes'],
    ['APIs', `OffscreenCanvas ${typeof OffscreenCanvas !== 'undefined' ? 'yes' : 'no'} · long frames ${LOAF ? 'yes' : 'no'}`],
    ['Coach', `${s.coachStyle} / ${s.coachBuild}`],
  ];
  const tokens = [`vp${iw}x${ih}@${round(dpr, 2)}`, `gl:${shortGpu(gl.gpu)}${gl.caveat ? '!sw' : ''}`];
  const info = nativeInfo(native);
  if (info) {
    rows.push(
      ['Android', `${info.android} · ${info.device}`],
      ['WebView view', `hardware accelerated: ${info.viewHardwareAccelerated ? 'yes' : 'NO'} · window: ${info.windowHardwareAccelerated ? 'yes' : 'NO'} · layer ${info.layerType} · ${info.viewPx}`],
      ['Display', `${info.displayMode} · ${info.density} dpi · modes ${info.modes}`],
    );
    tokens.push(`hw${info.viewHardwareAccelerated ? 1 : 0}`, `d${info.displayMode.replace(/\s/g, '')}`);
  } else if (isTV) rows.push(['Android', 'native details not available in this app version']);
  return { rows, tokens };
}

function nativeInfo(native: DanceBridgeNative | null): NativeGraphicsInfo | null {
  if (!native || typeof native.getGraphicsInfo !== 'function') return null;
  try {
    return JSON.parse(native.getGraphicsInfo()) as NativeGraphicsInfo;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Screen

const CSS = `
.gt { position:fixed; inset:0; overflow:hidden; background:var(--bg); outline:none;
  font-size:min(2.05vh, 1.1vw); line-height:1.18; padding:.9em 1.6em; display:flex; flex-direction:column; gap:.4em; }
.gt-head { display:flex; align-items:center; gap:1em; }
.gt-head h1 { font-size:1.7em; margin:0 auto 0 0; }
.gt-head .btn { font-size:1.1em; min-height:0; padding:.35em 1.1em; }
.gt-when { color:var(--muted); }
.gt-env { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); grid-auto-flow:row dense; gap:0 2em; }
.gt-env div { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gt-env div.wide { grid-column:1 / -1; }
.gt-env b { color:var(--muted); font-weight:600; margin-right:.5em; }
.gt-tables { display:grid; grid-template-columns:1fr 1fr; gap:0 2em; }
.gt table { border-collapse:collapse; width:100%; font-variant-numeric:tabular-nums; table-layout:fixed; }
.gt th { color:var(--muted); font-weight:600; text-align:right; padding:0 .3em; }
.gt td { padding:0 .3em; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gt tr + tr td { border-top:1px solid var(--surface-2); }
.gt col.c-id { width:2.3em; } .gt col.c-n { width:auto; } .gt col.c-v { width:3.6em; }
.gt th.n, .gt td.n { text-align:left; }
.gt td.id { text-align:left; font-weight:900; color:var(--accent-2); }
.gt td.fps { font-weight:800; }
.gt td.good { color:var(--accent-2); } .gt td.bad { color:var(--warn); }
.gt td.err { text-align:left; color:var(--warn); font-size:.9em; }
.gt td.skip { text-align:left; color:var(--muted); font-size:.9em; }
.gt-notes { color:var(--muted); font-size:.9em; }
.gt-notes p { margin:0; }
.gt-sum { font-family:ui-monospace, Menlo, Consolas, monospace; font-size:1.05em; overflow-wrap:anywhere; background:var(--surface);
  padding:.3em .6em; border-radius:.4em; color:var(--text); }
.gt-intro { font-size:1.3em; max-width:50em; }
.gt-stage { position:fixed; inset:0; overflow:hidden; background:var(--bg); }
.gt-label { position:fixed; left:2vw; bottom:2vh; z-index:5; font-size:3vh; font-weight:700; padding:.3em .7em;
  background:var(--surface); border-radius:.4em; color:var(--text); }
`;

let cssInjected = false;
function injectCss(): void {
  if (cssInjected) return;
  cssInjected = true;
  document.head.appendChild(h('style', { 'data-owner': 'graphicsTest' }, CSS));
}

export function createGraphicsTest(deps: GraphicsTestDeps): Screen {
  injectCss();
  const native = tvBridge()?.native ?? null;
  let alive = true;
  let running = false;
  let aborted = false;
  let layerChanged = false;

  const results = h('div', { class: 'gt' });
  const stage = h('div', { class: 'gt-stage', hidden: true });
  const label = h('div', { class: 'gt-label', hidden: true });
  const el = h('main', { class: 'screen gtest' }, results, stage, label);

  const only = (() => {
    try {
      const v = new URLSearchParams(location.search).get('gfxonly');
      return v ? v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : null;
    } catch {
      return null;
    }
  })();
  const tests = only ? TESTS.filter((t) => only.some((p) => t.id.startsWith(p))) : TESTS;

  function load(): StoredResults | null {
    try {
      return parseStored(localStorage.getItem(STORE_KEY));
    } catch {
      return null;
    }
  }
  function save(r: StoredResults): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(r));
    } catch {
      /* private mode / full: the table is still on screen */
    }
  }

  function render(r: StoredResults | null): void {
    const head = h(
      'div',
      { class: 'gt-head' },
      h('h1', {}, 'Graphics test'),
      r ? h('span', { class: 'gt-when' }, `${new Date(r.at).toLocaleString()}${r.complete ? '' : ' · stopped early'}`) : null,
      h('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'gt-run' }, r ? 'Run again' : 'Run graphics test'),
      h('button', { class: 'btn', type: 'button', 'data-action': 'gt-back' }, 'Back'),
    );
    if (!r) {
      const env = collectEnv(deps.isTV, native);
      results.replaceChildren(
        head,
        envBlock(env.rows),
        h(
          'p',
          { class: 'gt-intro' },
          `About ${Math.round((tests.length * (WARM_MS + MEASURE_MS + GAP_MS + 150)) / 1000 / 5) * 5} seconds of test patterns (moving shapes, coaches, a quiet tone). Leave the remote alone until the table appears, then photograph it or read out the line at the bottom.`,
        ),
      );
    } else {
      const half = Math.ceil(r.rows.length / 2);
      results.replaceChildren(
        head,
        envBlock(r.env),
        h('div', { class: 'gt-tables' }, table(r.rows.slice(0, half)), table(r.rows.slice(half))),
        h(
          'div',
          { class: 'gt-notes' },
          h('p', {}, 'fps = frames per second · med / p95 = frame interval ms · JS = ms in our frame code · busy = % of time in long main-thread frames · paint = style+layout+paint ms in them'),
          ...r.notes.map((n) => h('p', {}, n)),
        ),
        h('div', { class: 'gt-sum' }, r.summary),
      );
    }
    ensureFocus(true);
  }

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    aborted = false;
    const b = tvBridge();
    try {
      b?.native.setKeepScreenOn(true);
    } catch {
      /* ignore */
    }
    const env = collectEnv(deps.isTV, native);
    results.hidden = true;
    stage.hidden = false;
    label.hidden = false;
    label.textContent = 'Graphics test · preparing the coach… · Back stops';
    await sleep(100); // let that show before the (blocking) warm-up below
    // The coach code and the routine generator's caches, loaded and built
    // before any test (otherwise idle-time warming would run during the tests).
    const chunkReady: Promise<PlayChunk> = withTimeout(deps.loadChunk(), 30_000, 'the coach code did not load').then((m) => {
      m.warmAll();
      return m;
    });
    await chunkReady.catch(() => {});
    const ctx: Ctx = {
      stage,
      isTV: deps.isTV,
      native,
      ops: [],
      details: [],
      tokens: [],
      chunk: () => chunkReady,
    };
    const rows: GfxRow[] = [];
    const t0 = performance.now();
    for (let i = 0; i < tests.length && !aborted && alive; i++) {
      const t = tests[i];
      const left = Math.max(0, Math.round(((tests.length - i) * (performance.now() - t0)) / Math.max(1, i) / 1000));
      label.textContent = `Graphics test · ${t.id} ${t.name} · ${i + 1} of ${tests.length}${i ? ` · about ${left} s left` : ''} · Back stops`;
      label.hidden = false;
      rows.push(await runOne(t, ctx));
    }
    if (layerChanged) restoreLayer();
    try {
      b?.native.setKeepScreenOn(false);
    } catch {
      /* ignore */
    }
    running = false;
    const summary = summaryString(rows, [...env.tokens, ...ctx.tokens]);
    const notes = [
      ...(ctx.ops.length ? [`Draw calls per frame (p paths, f fills, s strokes, c clips, r rects, i images, t text, h with shadow, g gradient fills): ${ctx.ops.join(' · ')}`] : []),
      ...(ctx.details.length ? [`Details: ${ctx.details.join(' · ')}`] : []),
    ];
    const r: StoredResults = { v: 1, at: Date.now(), complete: !aborted && rows.length === tests.length, env: env.rows, rows, notes, summary };
    if (rows.length) save(r);
    if (!alive) return;
    stage.hidden = true;
    label.hidden = true;
    results.hidden = false;
    render(rows.length ? r : load());
  }

  async function runOne(t: TestDef, ctx: Ctx): Promise<GfxRow> {
    stage.replaceChildren();
    await sleep(GAP_MS);
    const row: GfxRow = { id: t.id, name: t.name };
    let prep: Prepared | null = null;
    try {
      if (t.id.startsWith('K')) layerChanged = true;
      const pending = t.run(ctx);
      prep = await withTimeout(pending, SETUP_TIMEOUT_MS, `setup took over ${SETUP_TIMEOUT_MS / 1000} s`).catch((err: unknown) => {
        // A setup that finishes late must still be torn down.
        void pending.then((p) => p.cleanup?.(), () => {});
        throw err;
      });
      label.hidden = true; // nothing of ours on screen while measuring
      const m = await measure(prep.frame, () => aborted || !alive);
      Object.assign(row, m.row);
      if (m.error) row.error = m.error;
      const extra = prep.cleanup?.();
      const note = [prep.note, extra].filter(Boolean).join(', ');
      prep = null;
      if (note) ctx.details.push(`${t.id} ${note}`);
    } catch (err) {
      row.error = errText(err);
      if (err instanceof SkipError) row.skipped = true;
    } finally {
      try {
        prep?.cleanup?.();
      } catch {
        /* ignore */
      }
      stage.replaceChildren();
    }
    return row;
  }

  function restoreLayer(): void {
    layerChanged = false;
    try {
      native?.setWebViewLayerType?.('none');
    } catch {
      /* ignore */
    }
  }

  function stopAndBack(): void {
    aborted = true;
    deps.back();
  }

  el.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (a === 'gt-run') void run();
    else if (a === 'gt-back') stopAndBack();
  });

  const scope: Scope = {
    root: el,
    onBack: stopAndBack,
    defaultFocus: () => (running ? null : results.querySelector<HTMLElement>('[data-action="gt-run"]')),
  };

  render(load());

  return {
    el,
    scope,
    mounted() {
      if (deps.autostart) void run();
    },
    destroy() {
      alive = false;
      aborted = true;
      stage.replaceChildren();
      if (layerChanged) restoreLayer();
      if (running) {
        try {
          tvBridge()?.native.setKeepScreenOn(false);
        } catch {
          /* ignore */
        }
      }
    },
  };
}

/** Environment rows long enough to need the full width. */
const WIDE_ENV = ['Window', 'WebGL', 'WebView view', 'Display'];

function envBlock(rows: readonly [string, string][]): HTMLElement {
  return h(
    'div',
    { class: 'gt-env' },
    ...rows.map(([k, v]) => h('div', { title: v, class: WIDE_ENV.includes(k) ? 'wide' : null }, h('b', {}, k), v)),
  );
}

function table(rows: readonly GfxRow[]): HTMLElement {
  const num = (v: number | undefined, d = 1) => (v === undefined ? '–' : v.toFixed(d));
  return h(
    'table',
    {},
    h('colgroup', {}, h('col', { class: 'c-id' }), h('col', { class: 'c-n' }), ...[0, 1, 2, 3, 4, 5].map(() => h('col', { class: 'c-v' }))),
    h(
      'tr',
      {},
      h('th', { class: 'n' }, ''),
      h('th', { class: 'n' }, 'Test'),
      ...['fps', 'med', 'p95', 'JS', 'busy', 'paint'].map((x) => h('th', {}, x)),
    ),
    ...rows.map((r) =>
      h(
        'tr',
        {},
        h('td', { class: 'id' }, r.id),
        h('td', { class: 'n', title: r.name }, r.name),
        ...(r.error
          ? [h('td', { class: r.skipped ? 'skip' : 'err', colspan: 6, title: r.error }, r.error)]
          : [
              h('td', { class: `fps ${r.fps === undefined ? '' : r.fps >= 50 ? 'good' : r.fps < 30 ? 'bad' : ''}` }, num(r.fps, 0)),
              h('td', {}, num(r.med)),
              h('td', {}, num(r.p95)),
              h('td', {}, num(r.js)),
              h('td', {}, r.busy === undefined ? 'n/a' : `${r.busy}%`),
              h('td', {}, r.paint === undefined ? 'n/a' : r.paint.toFixed(1)),
            ]),
      ),
    ),
  );
}

function errText(err: unknown): string {
  const s = err instanceof Error ? err.message : String(err);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
