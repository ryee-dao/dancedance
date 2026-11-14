/**
 * Coach bench (dev tool, not part of the app): /coach-demo.html
 *
 * Modes (?mode=...):
 *   song     (default) synthetic song with sections, driven by performance.now()
 *   gallery  one move looping with its name (?move=<id>), or every move in turn
 *   sheet    contact sheet: rows of moves x frames across a loop
 *            (?set=catalogue|foot|arms|accent&page=0&per=12&frames=10;
 *            ?family=<file> = the moves of one family file, ?tag=<family> =
 *            moves tagged with a family, ?moves=id1,id2 = those moves)
 *   bench    times the figure drawing of every style (results in __demo.result)
 *
 *   preview  the style-chooser preview cards (drawCoachPreview) side by side
 *
 * Versions: ?build=female|male (default female) for every mode.
 *
 * Character styles: ?style=classic|human|sticker (or ?coach=...); keys 1-3
 * or the on-screen buttons switch it in song / gallery mode. ?compare=1 shows
 * every style side by side (3-up) dancing the same song in sync, or the same
 * move with ?compare=1&mode=gallery[&move=<id>].
 *
 * Other params: bpm, level=chill|cardio|sweaty, sim=map|live|partial|none,
 * t=<sec> (start time), freeze=1 (stop the clock), ui=0 (hide controls),
 * click=1, beat=<b> (gallery: hold the move at that beat of its loop). A debug API is exposed as window.__demo.
 */

import type { Intensity } from '../core/choreo/generator';
import { ACCENT, ARMS, FOOT } from '../core/choreo/layers';
import { MOVES, composeMove, findMove, type Move } from '../core/choreo/moves';
import { findPoolMove, getPool } from '../core/choreo/pool';
import { FAMILIES } from '../core/choreo/families';
import type { StyleOverride } from '../core/choreo/songStyle';
import { PoseEvaluator } from '../core/coach/animator';
import { loopPlan } from '../core/coach/loop';
import { LOOKS } from '../core/coach/humanPainter';
import { COLORS, FigurePainter, drawCoachPreview, StageRenderer2D, type StripInfo } from '../core/coach/renderer';
import { CH, J, createPose, createSkeleton, solveSkeleton, type Skeleton } from '../core/coach/skeleton';
import { COACH_STYLE_IDS, DEFAULT_COACH_BUILD, coachStyleInfo, parseCoachBuild, parseCoachStyle, VIEW, viewFromParams, type CoachStyle } from '../core/coach/styles';
import { createCoachStage } from '../ui/coachStage';
import type { FrameInfo } from '../ui/play';
import { SECTION_PLAN, SYNTH_MAX_BPM, SYNTH_MIN_BPM, SimSource, type SimMode } from './synth';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'song';
viewFromParams(q);
/** The bench's tempo range (the synthetic map refuses anything else). */
const clampBpm = (v: number): number => (Number.isFinite(v) ? Math.min(SYNTH_MAX_BPM, Math.max(SYNTH_MIN_BPM, Math.round(v))) : 120);
let bpm = clampBpm(Number(q.get('bpm') ?? 120));
let level = (q.get('level') ?? 'cardio') as Intensity;
const showUi = q.get('ui') !== '0';
const compare = q.get('compare') === '1';
let style: CoachStyle = parseCoachStyle(q.get('style')) ?? parseCoachStyle(q.get('coach')) ?? 'classic';
// The coach stage honours ?coach= as a hard override; the bench owns the style instead.
if (q.has('coach')) {
  q.delete('coach');
  q.set('style', style);
  history.replaceState(null, '', `${location.pathname}?${q.toString()}`);
}
const build = parseCoachBuild(q.get('build')) ?? DEFAULT_COACH_BUILD;
const styleListeners: ((s: CoachStyle) => void)[] = [];
function setStyle(s: CoachStyle): void {
  style = s;
  for (const f of styleListeners) f(s);
}

document.body.style.cssText = 'margin:0;background:#0f0d17;color:#f7f4ff;font:14px system-ui,sans-serif;overflow:hidden;';

// --- clock ------------------------------------------------------------------
const clock = {
  base: Number(q.get('t') ?? 0),
  wall: performance.now(),
  running: q.get('freeze') !== '1',
  now(): number {
    return this.running ? this.base + (performance.now() - this.wall) / 1000 : this.base;
  },
  seek(t: number): void {
    this.base = t;
    this.wall = performance.now();
  },
  pause(): void {
    this.base = this.now();
    this.running = false;
  },
  play(): void {
    this.wall = performance.now();
    this.running = true;
  },
};

// --- click track ------------------------------------------------------------
let audio: AudioContext | null = null;
let clickOn = q.get('click') === '1';
/** ?beat=<b> (gallery): hold the move at this beat of its loop (headless capture); __demo.at(b) changes it. */
let fixedBeat: number | null = q.has('beat') ? Number(q.get('beat')) : null;
function click(accent: boolean): void {
  if (!clickOn) return;
  audio ??= new AudioContext();
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.frequency.value = accent ? 1500 : 1000;
  g.gain.setValueAtTime(0.25, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.05);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.06);
}

// --- UI ---------------------------------------------------------------------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}

const panel = el('div', { style: 'position:fixed;left:8px;bottom:8px;z-index:10;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:98vw;background:rgba(20,16,32,.85);padding:6px 8px;border-radius:8px;' });
const info = el('div', { style: 'position:fixed;left:8px;top:8px;z-index:10;font:12px ui-monospace,monospace;white-space:pre;background:rgba(20,16,32,.7);padding:4px 6px;border-radius:6px;' });
if (showUi) document.body.append(panel, info);

function button(label: string, fn: () => void): HTMLButtonElement {
  const b = el('button', { type: 'button' }, label);
  b.onclick = fn;
  panel.append(b);
  return b;
}
function select(opts: string[], value: string, fn: (v: string) => void): HTMLSelectElement {
  const s = el('select');
  for (const o of opts) s.append(el('option', { value: o }, o));
  s.value = value;
  s.onchange = () => fn(s.value);
  panel.append(s);
  return s;
}

declare global {
  interface Window {
    __demo?: Record<string, unknown>;
  }
}

/** Style buttons + number keys (song / gallery). */
function styleSwitcher(): void {
  const label = el('span', { style: 'font-weight:700;margin-left:6px;' });
  const btns = COACH_STYLE_IDS.map((st, i) => {
    const b = button(`${i + 1} ${coachStyleInfo(st).name}`, () => setStyle(st));
    b.dataset.style = st;
    return b;
  });
  const sync = (s: CoachStyle) => {
    for (const b of btns) b.style.cssText = b.dataset.style === s ? 'background:#ffd84a;color:#120e1f;font-weight:700;' : '';
    label.textContent = coachStyleInfo(s).name;
    const u = new URLSearchParams(location.search);
    u.set('style', s);
    history.replaceState(null, '', `${location.pathname}?${u.toString()}`);
  };
  styleListeners.push(sync);
  sync(style);
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const i = Number(e.key) - 1;
    if (Number.isInteger(i) && i >= 0 && i < COACH_STYLE_IDS.length) setStyle(COACH_STYLE_IDS[i]);
  });
}

if (mode === 'sheet') runSheet();
else if (mode === 'bench') runBench();
else if (mode === 'preview') runPreview();
else if (compare && mode === 'gallery') runCompareMove();
else if (compare) runCompareSong();
else if (mode === 'gallery') runGallery();
else runSong();

// ---------------------------------------------------------------------------
function runSong(): void {
  const host = el('div', { style: 'position:fixed;inset:0;' });
  document.body.prepend(host);
  const sim = new SimSource(bpm);
  sim.mode = (q.get('sim') ?? 'map') as SimMode;
  // Song style override (?family=latin&themes=hips,spin&sig=gallop,lasso), editable below.
  let famSel = q.get('family') ?? '';
  let themesIn = q.get('themes') ?? '';
  let sigIn = q.get('sig') ?? '';
  const styleOverride = (): StyleOverride | undefined =>
    famSel || themesIn || sigIn
      ? {
          ...(famSel ? { families: { [famSel]: 1 } } : {}),
          themes: themesIn.split(/[,\s]+/).filter(Boolean),
          ...(sigIn ? { signature: sigIn.split(/[,\s]+/).filter(Boolean) } : {}),
        }
      : undefined;
  const fresh = { mode: (q.get('routine') === 'fresh' ? 'fresh' : 'same') as 'same' | 'fresh', plays: 0 };
  const stage = createCoachStage({
    getIntensity: () => level,
    isTV: q.get('tv') === '1',
    getStyle: () => style,
    getBuild: () => build,
    getStyleOverride: styleOverride,
    getRoutineMode: () => fresh.mode,
    getPlayCount: () => fresh.plays,
  });
  stage.mount(host);
  styleSwitcher();
  select(['', ...FAMILIES], famSel, (v) => (famSel = v)).title = 'Song family (blank = from the title)';
  const themesBox = el('input', { type: 'text', value: themesIn, placeholder: 'themes: hips,spin', style: 'width:9em' });
  themesBox.onchange = () => (themesIn = themesBox.value);
  const sigBox = el('input', { type: 'text', value: sigIn, placeholder: 'signature ids', style: 'width:9em' });
  sigBox.onchange = () => (sigIn = sigBox.value);
  panel.append(themesBox, sigBox);
  button('New routine', () => {
    fresh.mode = 'fresh';
    fresh.plays++;
  });
  let phase: FrameInfo['phase'] = (q.get('phase') as FrameInfo['phase']) ?? 'playing';
  const item = { kind: 'youtube' as const, videoId: 'demo-song', title: 'Demo song' };

  select(['chill', 'cardio', 'sweaty'], level, (v) => (level = v as Intensity));
  const bpmIn = el('input', { type: 'number', value: String(bpm), min: String(SYNTH_MIN_BPM), max: String(SYNTH_MAX_BPM), style: 'width:4em' });
  bpmIn.onchange = () => {
    bpm = clampBpm(Number(bpmIn.value));
    bpmIn.value = String(bpm);
    sim.setBpm(bpm);
  };
  panel.append('BPM', bpmIn);
  select(['map', 'live', 'partial', 'none'], sim.mode, (v) => {
    sim.mode = v as SimMode;
    sim.revision++;
    clock.seek(0);
  });
  button('Map arrives', () => sim.upgrade());
  button('Play/Pause', () => {
    if (phase === 'paused') {
      phase = 'playing';
      clock.play();
    } else {
      phase = 'paused';
      clock.pause();
    }
  });
  button('Countdown', () => {
    phase = 'countdown';
    clock.pause();
    clock.seek(0);
    setTimeout(() => {
      phase = 'playing';
      clock.play();
    }, 3000);
  });
  button('Click', () => (clickOn = !clickOn));
  const per = 60 / bpm;
  let bar = 0;
  for (const [type, bars] of SECTION_PLAN) {
    const start = 0.4 + bar * 4 * per;
    button(type, () => clock.seek(start - 0.05));
    bar += bars;
  }

  let lastBeat = -1;
  function frame(): void {
    requestAnimationFrame(frame);
    const t = clock.now();
    sim.now = t;
    const fi: FrameInfo = { phase, playing: phase === 'playing', duration: sim.fullMap.duration, item, beats: sim, intensity: level, audioOffsetMs: 0 };
    stage.frame(t, fi);
    const bi = sim.fullMap.beats.findIndex((b) => b > t) - 1;
    if (bi !== lastBeat && bi >= 0 && phase === 'playing') click(sim.fullMap.downbeats.includes(bi));
    lastBeat = bi;
    if (showUi) {
      const st = stage.frameStats();
      info.textContent = `${coachStyleInfo(style).name}  t=${t.toFixed(2)}  beat=${bi}  sim=${sim.mode} rev=${sim.revision}  level=${level}  bpm=${bpm}\nframe ${st.frameMs.toFixed(2)} ms (${st.fps.toFixed(0)} fps)  draw ${st.drawMs.toFixed(2)} ms`;
    }
  }
  requestAnimationFrame(frame);
  window.__demo = {
    seek: (t: number) => clock.seek(t),
    pause: () => clock.pause(),
    play: () => clock.play(),
    setPhase: (p: FrameInfo['phase']) => (phase = p),
    setLevel: (l: Intensity) => (level = l),
    setSim: (m: SimMode) => {
      sim.mode = m;
      sim.revision++;
    },
    upgrade: () => sim.upgrade(),
    stats: () => stage.frameStats(),
    setStyle: (s: CoachStyle) => setStyle(s),
  };
}

// ---------------------------------------------------------------------------
/**
 * Gallery list: ?family=<tag> filters by family, ?variations=1 adds the pool's
 * counted variations (the variation browser), ?variations=all adds ornaments too.
 */
function galleryMoves(): Move[] {
  const fam = q.get('family');
  const vq = q.get('variations');
  const pool = getPool();
  let list: Move[] = vq === 'all' ? [...MOVES, ...pool.variations, ...pool.ornaments.all()] : vq ? [...pool.moves] : [...MOVES];
  if (fam) list = list.filter((m) => (m.families as readonly string[]).includes(fam));
  return list.length ? list : [...MOVES];
}

function runGallery(): void {
  const canvas = el('canvas', { style: 'position:fixed;inset:0;width:100%;height:100%;' });
  document.body.prepend(canvas);
  const LIST = galleryMoves();
  const label = (m: Move) => (m.base !== m.id ? `${m.name}  (variation of ${m.base})` : m.name);
  const r = new StageRenderer2D(canvas, style, build);
  styleListeners.push((s) => (r.style = s));
  const resize = () => r.resize(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio, true);
  resize();
  addEventListener('resize', resize);
  let idx = Math.max(0, LIST.findIndex((m) => m.id === q.get('move')));
  let auto = q.get('move') === null;
  let move: Move = LIST[idx];
  let plan = loopPlan(move, 60 / bpm);
  const ev = new PoseEvaluator();
  const pose = createPose();
  const sk = createSkeleton();
  const strip: StripInfo = { now: '', sig: false, progress: 0, beatsToChange: Infinity, next: null, after: null };
  const sel = select(LIST.map((m) => m.id), move.id, (v) => setMove(v));
  button('Prev', () => setMove(LIST[(idx - 1 + LIST.length) % LIST.length].id));
  button('Next', () => setMove(LIST[(idx + 1) % LIST.length].id));
  button('Auto', () => (auto = !auto));
  button('Click', () => (clickOn = !clickOn));
  const bpmIn = el('input', { type: 'number', value: String(bpm), min: String(SYNTH_MIN_BPM), max: String(SYNTH_MAX_BPM), style: 'width:4em' });
  bpmIn.onchange = () => {
    bpm = clampBpm(Number(bpmIn.value));
    bpmIn.value = String(bpm);
    plan = loopPlan(move, 60 / bpm);
  };
  panel.append('BPM', bpmIn);
  styleSwitcher();
  let started = clock.now();
  function setMove(id: string): void {
    const m = LIST.find((x) => x.id === id) ?? findPoolMove(id);
    if (!m) return;
    move = m;
    idx = LIST.indexOf(m);
    sel.value = id;
    plan = loopPlan(move, 60 / bpm);
    started = clock.now();
  }
  let lastBeat = -1;
  function frame(): void {
    requestAnimationFrame(frame);
    const t = clock.now() - started;
    const loopSec = plan.loopBeats * plan.period;
    if (auto && t > loopSec * 2) setMove(LIST[(idx + 1) % LIST.length].id);
    const lt = fixedBeat !== null ? fixedBeat * plan.period : ((t % loopSec) + loopSec) % loopSec;
    ev.evaluate(plan, lt, pose);
    solveSkeleton(pose, sk);
    const bi = Math.floor(lt / plan.period);
    if (bi !== lastBeat) click(bi % 4 === 0);
    lastBeat = bi;
    strip.now = move.name;
    strip.style = move.families.join(' · ');
    strip.progress = lt / loopSec;
    r.render(sk, { t: clock.now(), beat: lt / plan.period, half: false, energy: 0.5, strip });
    if (showUi) info.textContent = `${label(move)}\n${move.id}  ${move.beats} beats  ${move.level}  difficulty ${move.difficulty}  ${move.layered ? `layered: ${move.foot} + ${move.arms}${move.accent ? ' + ' + move.accent : ''}` : 'hand-authored'}${move.mirror ? '  (mirrors)' : ''}`;
  }
  requestAnimationFrame(frame);
  window.__demo = { setMove, seek: (t: number) => clock.seek(t), pause: () => clock.pause(), setStyle: (s: CoachStyle) => setStyle(s), at: (b: number | null) => (fixedBeat = b), ready: true };
}

// ---------------------------------------------------------------------------
function sheetMoves(set: string): Move[] {
  if (set === 'foot') return Object.keys(FOOT).map((f) => composeMove(f, 'rest'));
  if (set === 'arms') return Object.keys(ARMS).map((a) => composeMove('bounce', a));
  if (set === 'accent') return Object.keys(ACCENT).map((a) => composeMove('bounce', 'rest', { accent: a }));
  const ids = q.get('moves');
  if (ids) return ids.split(',').map((id) => findMove(id) ?? findPoolMove(id)).filter((m): m is Move => !!m);
  // ?variations=<base id | type>: the pool's variations of a base move, or of one type.
  const vq = q.get('variations');
  if (vq) {
    const pool = getPool();
    const all = [...pool.variations, ...pool.ornaments.all()];
    return all.filter((m) => m.base === vq || m.id.split('~')[1] === vq);
  }
  // ?family=<file>: the moves a family file defines; ?tag=<family>: moves tagged with it.
  const fam = q.get('family');
  if (fam) return MOVES.filter((m) => m.file === fam);
  const tag = q.get('tag');
  if (tag) return MOVES.filter((m) => (m.families as readonly string[]).includes(tag));
  return MOVES.slice();
}

/**
 * Sheet extras (for headless capture, tools/moves/sheet.ts):
 *   &styles=classic,human,sticker  one row per look for each move (default: ?style)
 *   &views=0,90                    one row per camera yaw (deg; 90 = seen from the
 *                                  figure's left side, shows motion toward the viewer)
 *   &span=<beats>&start=<beat>     the beats the frames cover (default: two loops of
 *                                  the move, at most the whole loop plan)
 *   &trail=1                       an extra cell with the paths of hands, feet and head
 *                                  over the frames' span (how much visibly moves)
 *   &cams=cam/piv/rise/feet[/ghost];... one row per camera (before / after the stage camera)
 *   &form=point|horns|fingers      preview a hand form on both hands
 */
function runSheet(): void {
  const set = q.get('set') ?? 'catalogue';
  const all = sheetMoves(set);
  const per = Number(q.get('per') ?? 12);
  const page = Number(q.get('page') ?? 0);
  const moves = all.slice(page * per, page * per + per);
  const frames = Number(q.get('frames') ?? 10);
  const cellW = Number(q.get('cw') ?? 150);
  const cellH = Number(q.get('ch') ?? 190);
  const styles = (q.get('styles')?.split(',').map((s) => parseCoachStyle(s)).filter((s): s is CoachStyle => !!s) ?? []);
  if (!styles.length) styles.push(style);
  const views = q.get('views')?.split(',').map(Number).filter(Number.isFinite) ?? [Number(q.get('view') ?? 0)];
  const spanQ = q.get('span') !== null ? Number(q.get('span')) : NaN;
  const start = Number(q.get('start') ?? 0);
  const trail = q.get('trail') === '1';
  const formQ = ({ point: 1, horns: 2, fingers: 3 } as Record<string, number>)[q.get('form') ?? ''] ?? 0;
  // &cams=cam/piv/rise/feet[/ghost];...: one row per camera (before / after comparisons in one sheet).
  const view0 = { ...VIEW };
  const cams = (q.get('cams') ?? '').split(';').filter(Boolean).map((c) => {
    const [cam, piv, rise, feet, ghost] = c.split('/').map(Number);
    return { cam: cam || view0.cam, piv: Number.isFinite(piv) ? piv : view0.piv, rise: rise || 0, feet: !!feet, ghost: !!ghost, label: c };
  });
  const labelW = 220;
  const cols = frames + (trail ? 1 : 0);
  const rows: { m: Move; st: CoachStyle; view: number; cam: (typeof cams)[number] | null }[] = [];
  for (const m of moves) for (const st of styles) for (const view of views) for (const cam of cams.length ? cams : [null]) rows.push({ m, st, view, cam });
  const canvas = el('canvas');
  canvas.width = labelW + cols * cellW;
  canvas.height = Math.max(1, rows.length) * cellH;
  canvas.style.cssText = 'display:block;';
  document.body.style.overflow = 'auto';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = COLORS.bg0;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const ev = new PoseEvaluator();
  const pose = createPose();
  const sk = createSkeleton();
  const period = 60 / bpm;
  const TRAIL_JOINTS: readonly [number, string][] = [
    [J.HA_R, '#ff6b6b'], [J.HA_L, '#4dabf7'], [J.TOE_R, '#ffa94d'], [J.TOE_L, '#69db7c'], [J.HEAD, '#e599f7'],
  ];
  rows.forEach(({ m, st, view, cam }, row) => {
    Object.assign(VIEW, cam ? { cam: cam.cam, piv: cam.piv, rise: cam.rise, feet: cam.feet, ghost: cam.ghost } : view0);
    const painter = new FigurePainter();
    painter.style = st;
    painter.build = build;
    const plan = loopPlan(m, period);
    const span = Number.isFinite(spanQ) && spanQ > 0 ? spanQ : Math.min(plan.loopBeats, Math.max(4, m.beats * 2));
    const y0 = row * cellH;
    const firstOfMove = row === 0 || rows[row - 1].m !== m;
    ctx.fillStyle = moves.indexOf(m) % 2 ? '#15112a' : '#1b1633';
    ctx.fillRect(0, y0, canvas.width, cellH);
    if (firstOfMove && row > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, y0, canvas.width, 2);
    }
    ctx.fillStyle = COLORS.ink;
    ctx.font = '700 17px system-ui';
    ctx.fillText(m.name, 10, y0 + 28);
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(m.id, 10, y0 + 48);
    ctx.fillText(`${m.beats}b ${m.level} d${m.difficulty}${m.mirror ? ' mir' : ''}${m.travel ? ' trv' : ''}${m.jump ? ' jump' : ''}`, 10, y0 + 66);
    ctx.fillText(m.layered ? `${m.foot}+${m.arms}${m.accent ? '+' + m.accent : ''}` : 'hand-authored', 10, y0 + 84);
    ctx.fillText(`${m.file}: ${m.families.join(' ')}`, 10, y0 + 102);
    ctx.fillText(`${m.focus.join(' ')}${m.themes.length ? ' / ' + m.themes.join(' ') : ''}`, 10, y0 + 120);
    if (styles.length > 1 || views.length > 1 || view) {
      ctx.fillStyle = COLORS.band;
      ctx.fillText(`${coachStyleInfo(st).name}${view ? `  view ${view}°` : ''}  ${bpm} bpm`, 10, y0 + 138);
    }
    if (cam) {
      ctx.fillStyle = COLORS.band;
      ctx.fillText(`camera ${cam.label}`, 10, y0 + 156);
    }
    const floor = y0 + cellH - 14;
    const scale = cellH * 0.66;
    const solve = (b: number) => {
      ev.evaluate(plan, b * period, pose);
      if (view) pose[CH.SPIN] += view;
      // &form=point|horns|fingers: preview a hand form on every frame (what an author would set).
      if (formQ) pose[CH.FORM_R] = pose[CH.FORM_L] = formQ;
      solveSkeleton(pose, sk);
    };
    for (let f = 0; f < frames; f++) {
      const b = start + (f / frames) * span;
      solve(b);
      const cx = labelW + f * cellW + cellW / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - cellW / 2 + 4, floor);
      ctx.lineTo(cx + cellW / 2 - 4, floor);
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - cellW / 2, y0, cellW, cellH);
      ctx.clip();
      if (VIEW.ghost) {
        // Hand ghost (motion cue): feed the half second before this frame.
        for (let k = 12; k >= 1; k--) {
          const tb = b - (k * 0.04) / period;
          solve(tb);
          painter.project(sk, cx, floor, scale);
          painter.recordHands(sk, cx, floor, scale, tb * period + 100);
        }
        solve(b);
      }
      painter.draw(ctx, sk, cx, floor, scale, VIEW.ghost ? b * period + 100 : f * 0.1, { shadow: true });
      ctx.restore();
      ctx.fillStyle = Number.isInteger(Math.round(b * 1000) / 1000) ? COLORS.band : COLORS.muted;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(b.toFixed(2), labelW + f * cellW + 4, y0 + 14);
    }
    if (trail) {
      // Paths of the hands, toes and head over the span (projected as drawn).
      const cx = labelW + frames * cellW + cellW / 2;
      solve(start);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - cellW / 2, y0, cellW, cellH);
      ctx.clip();
      ctx.globalAlpha = 0.25;
      painter.draw(ctx, sk, cx, floor, scale, 0, { shadow: false });
      ctx.globalAlpha = 1;
      const N = 96;
      const pts = TRAIL_JOINTS.map(() => [] as number[]);
      for (let i = 0; i <= N; i++) {
        solve(start + (i / N) * span);
        painter.project(sk, cx, floor, scale);
        TRAIL_JOINTS.forEach(([j], k) => pts[k].push(painter.jx(j), painter.jy(j)));
      }
      ctx.lineWidth = 2;
      TRAIL_JOINTS.forEach(([, col], k) => {
        ctx.strokeStyle = col;
        ctx.beginPath();
        for (let i = 0; i < pts[k].length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[k][i], pts[k][i + 1]);
        ctx.stroke();
      });
      ctx.restore();
      ctx.fillStyle = COLORS.muted;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('paths', labelW + frames * cellW + 4, y0 + 14);
    }
  });
  document.title = `sheet ${styles.join('+')} ${set} ${page} (${all.length})`;
  window.__demo = { total: all.length, ready: true, width: canvas.width, height: canvas.height };
}

// ---------------------------------------------------------------------------
// Compare: every style side by side, in sync.

/** A row of cells (one per style), each with the style name underneath. Returns the hosts. */
function compareGrid(): HTMLElement[] {
  const grid = el('div', { style: `position:fixed;inset:0;display:grid;grid-template-columns:repeat(${COACH_STYLE_IDS.length}, 1fr);grid-template-rows:1fr;gap:6px;background:#07060c;` });
  document.body.prepend(grid);
  return COACH_STYLE_IDS.map((st, i) => {
    const cell = el('div', { style: 'position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;' });
    const host = el('div', { style: 'position:relative;flex:1;min-height:0;overflow:hidden;' });
    const name = el(
      'div',
      { style: 'flex:none;display:flex;flex-direction:column;gap:2px;padding:6px 14px 10px;background:#15111f;' },
      el('b', { style: 'font-size:22px;' }, `${i + 1}. ${coachStyleInfo(st).name}`),
      el('span', { style: 'color:#b5aed0;font-size:15px;' }, coachStyleInfo(st).description),
    );
    cell.append(host, name);
    grid.append(cell);
    return host;
  });
}

function runCompareSong(): void {
  const hosts = compareGrid();
  const sim = new SimSource(bpm);
  sim.mode = (q.get('sim') ?? 'map') as SimMode;
  let phase: FrameInfo['phase'] = (q.get('phase') as FrameInfo['phase']) ?? 'playing';
  const item = { kind: 'youtube' as const, videoId: 'demo-song', title: 'Demo song' };
  const stages = COACH_STYLE_IDS.map((st, i) => {
    const stage = createCoachStage({ getIntensity: () => level, isTV: false, getStyle: () => st, getBuild: () => build });
    stage.mount(hosts[i]);
    return stage;
  });
  select(['chill', 'cardio', 'sweaty'], level, (v) => (level = v as Intensity));
  button('Play/Pause', () => {
    if (phase === 'paused') {
      phase = 'playing';
      clock.play();
    } else {
      phase = 'paused';
      clock.pause();
    }
  });
  button('Click', () => (clickOn = !clickOn));
  const per = 60 / bpm;
  let bar = 0;
  for (const [type, bars] of SECTION_PLAN) {
    const start = 0.4 + bar * 4 * per;
    button(type, () => clock.seek(start - 0.05));
    bar += bars;
  }
  button('Single view', () => {
    const u = new URLSearchParams(location.search);
    u.delete('compare');
    location.search = u.toString();
  });
  panel.style.left = '50%';
  panel.style.transform = 'translateX(-50%)';
  panel.style.bottom = '50%';
  panel.style.opacity = '0.85';
  info.style.display = 'none';
  let lastBeat = -1;
  function frame(): void {
    requestAnimationFrame(frame);
    const t = clock.now();
    sim.now = t;
    const fi: FrameInfo = { phase, playing: phase === 'playing', duration: sim.fullMap.duration, item, beats: sim, intensity: level, audioOffsetMs: 0 };
    for (const st of stages) st.frame(t, fi);
    const bi = sim.fullMap.beats.findIndex((b) => b > t) - 1;
    if (bi !== lastBeat && bi >= 0 && phase === 'playing') click(sim.fullMap.downbeats.includes(bi));
    lastBeat = bi;
  }
  requestAnimationFrame(frame);
  window.__demo = {
    seek: (t: number) => clock.seek(t),
    pause: () => clock.pause(),
    play: () => clock.play(),
    stats: () => stages.map((s) => s.frameStats()),
  };
}

function runCompareMove(): void {
  const hosts = compareGrid();
  const renderers = hosts.map((h, i) => {
    const c = el('canvas', { style: 'position:absolute;inset:0;width:100%;height:100%;' });
    h.append(c);
    return new StageRenderer2D(c, COACH_STYLE_IDS[i], build);
  });
  const resize = () => {
    for (let i = 0; i < renderers.length; i++) {
      const r = hosts[i].getBoundingClientRect();
      renderers[i].resize(r.width * devicePixelRatio, r.height * devicePixelRatio, true);
    }
  };
  resize();
  addEventListener('resize', resize);
  let idx = Math.max(0, MOVES.findIndex((m) => m.id === q.get('move')));
  let auto = q.get('move') === null;
  let move: Move = MOVES[idx];
  let plan = loopPlan(move, 60 / bpm);
  const ev = new PoseEvaluator();
  const pose = createPose();
  const sk = createSkeleton();
  const strip: StripInfo = { now: '', sig: false, progress: 0, beatsToChange: Infinity, next: null, after: null };
  const sel = select(MOVES.map((m) => m.id), move.id, (v) => setMove(v));
  button('Prev', () => setMove(MOVES[(idx - 1 + MOVES.length) % MOVES.length].id));
  button('Next', () => setMove(MOVES[(idx + 1) % MOVES.length].id));
  button('Auto', () => (auto = !auto));
  button('Click', () => (clickOn = !clickOn));
  panel.style.left = '50%';
  panel.style.transform = 'translateX(-50%)';
  panel.style.bottom = '50%';
  panel.style.opacity = '0.85';
  info.style.display = 'none';
  let started = clock.now();
  function setMove(id: string): void {
    const m = findMove(id);
    if (!m) return;
    move = m;
    idx = MOVES.indexOf(m);
    sel.value = id;
    plan = loopPlan(move, 60 / bpm);
    started = clock.now();
  }
  let lastBeat = -1;
  function frame(): void {
    requestAnimationFrame(frame);
    const t = clock.now() - started;
    const loopSec = plan.loopBeats * plan.period;
    if (auto && t > loopSec * 2) setMove(MOVES[(idx + 1) % MOVES.length].id);
    const lt = fixedBeat !== null ? fixedBeat * plan.period : ((t % loopSec) + loopSec) % loopSec;
    ev.evaluate(plan, lt, pose);
    solveSkeleton(pose, sk);
    const bi = Math.floor(lt / plan.period);
    if (bi !== lastBeat) click(bi % 4 === 0);
    lastBeat = bi;
    strip.now = move.name;
    strip.progress = lt / loopSec;
    for (const r of renderers) r.render(sk, { t: clock.now(), beat: lt / plan.period, half: false, energy: 0.5, strip });
  }
  requestAnimationFrame(frame);
  window.__demo = { setMove, seek: (t: number) => clock.seek(t), pause: () => clock.pause(), at: (b: number | null) => (fixedBeat = b), ready: true };
}

// ---------------------------------------------------------------------------
// Bench: figure drawing cost per style over the whole catalogue.

function runBench(): void {
  const canvas = el('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const period = 60 / bpm;
  const ev = new PoseEvaluator();
  const pose = createPose();
  // Pre-solve a few frames of every move so the timing measures drawing only.
  const sks: Skeleton[] = [];
  for (const m of MOVES) {
    const plan = loopPlan(m, period);
    for (let f = 0; f < 6; f++) {
      ev.evaluate(plan, (f / 6) * plan.loopBeats * period, pose);
      sks.push(solveSkeleton(pose, createSkeleton()));
    }
  }
  const reps = Number(q.get('reps') ?? 3);
  const scale = 1080 * 0.6;
  const run = (styles: readonly CoachStyle[] = COACH_STYLE_IDS): Record<string, number> => {
    const out: Record<string, number> = {};
    for (let pass = 0; pass < 2; pass++) {
      for (const st of styles) {
        const painter = new FigurePainter();
        painter.style = st;
        const t0 = performance.now();
        let n = 0;
        for (let r = 0; r < reps; r++) {
          for (const sk of sks) {
            painter.draw(ctx, sk, 768, 930, scale, n * 0.016);
            n++;
          }
        }
        // Force the raster work to finish.
        ctx.getImageData(0, 0, 1, 1);
        if (pass === 1) out[st] = Math.round(((performance.now() - t0) / n) * 1000) / 1000;
      }
    }
    return out;
  };
  const result = run();
  document.body.append(el('pre', {}, JSON.stringify(result, null, 2)));
  // Dev hook: patch a look and re-run, e.g. __demo.patch('sticker', { rim: null }).
  window.__demo = { result, ready: true, run, looks: LOOKS, patch: (st: 'human' | 'sticker', o: object) => Object.assign(LOOKS[st], o) };
}

// ---------------------------------------------------------------------------
// Preview cards, as a style chooser would show them (drawCoachPreview).

function runPreview(): void {
  const row = el('div', { style: 'display:flex;gap:24px;padding:24px;flex-wrap:wrap;' });
  document.body.prepend(row);
  const moveId = q.get('move') ?? undefined;
  const cards = COACH_STYLE_IDS.map((st) => {
    const c = el('canvas', { width: '320', height: '400', style: 'width:320px;height:400px;border-radius:16px;display:block;' });
    row.append(el('div', {}, c, el('div', { style: 'font-weight:700;font-size:20px;margin-top:8px;' }, coachStyleInfo(st).name)));
    return { c, st };
  });
  function frame(): void {
    requestAnimationFrame(frame);
    const t = clock.now();
    for (const k of cards) drawCoachPreview(k.c, k.st, { moveId, timeSec: t, build });
  }
  requestAnimationFrame(frame);
  window.__demo = { ready: true };
}
