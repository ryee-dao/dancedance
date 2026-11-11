/**
 * Default stage renderer until the coach is swapped in: a ring that pulses on
 * every beat, flashes harder on downbeats, four bar dots, and the current
 * section's name. It is also the visual proof that sync works.
 *
 * When there are no beats yet it draws nothing at all (the play screen
 * explains in words what is going on): nothing here should look like a
 * loading spinner or a broken animation.
 *
 * Test hook: if `window.__ddPulseLog` is an array, every pulse pushes
 * `{ beat, t, perf, downbeat, from }` (beat time, stage time when shown,
 * performance.now()).
 */
import type { BeatTimeline } from '../beat/beatSource';
import { lastBeat, sectionAtTime } from '../beat/timeline';
import { h } from './dom';
import type { FrameInfo, StageRenderer } from './play';

interface PulseRecord {
  beat: number;
  t: number;
  perf: number;
  downbeat: boolean;
  from: 'map' | 'live';
}

declare global {
  interface Window {
    __ddPulseLog?: PulseRecord[];
  }
}

const SECTION_LABEL: Record<string, string> = {
  intro: 'Intro',
  verse: 'Verse',
  chorus: 'Chorus',
  drop: 'Drop',
  outro: 'Outro',
};

export class BeatPulseStage implements StageRenderer {
  private root: HTMLElement | null = null;
  private ring: HTMLElement | null = null;
  private core: HTMLElement | null = null;
  private label: HTMLElement | null = null;
  private dots: HTMLElement[] = [];
  private idle: boolean | null = null;
  private lastPulse = NaN;
  private barPos = -1;
  private shownLabel = '';
  private shownDot = -2;

  mount(stage: HTMLElement): void {
    this.ring = h('div', { class: 'bp-ring' });
    this.core = h('div', { class: 'bp-core' });
    this.label = h('div', { class: 'bp-section' });
    this.dots = [0, 1, 2, 3].map((i) => h('i', { class: i === 0 ? 'bp-dot bp-dot-one' : 'bp-dot' }));
    this.root = h(
      'div',
      { class: 'bp-stage', 'aria-hidden': 'true' },
      h('div', { class: 'ph-floor' }),
      this.core,
      this.ring,
      this.label,
      h('div', { class: 'bp-dots' }, ...this.dots),
    );
    stage.appendChild(this.root);
  }

  frame(timeSec: number, info: FrameInfo): void {
    if (!this.ring || !this.core || !this.label) return;
    const tl: BeatTimeline | null = info.beats ? info.beats.current() : null;
    const hit = tl ? lastBeat(tl, timeSec) : null;

    let k = 0;
    let down = false;
    if (hit) {
      const since = timeSec - hit.time;
      if (since >= 0 && since < hit.period * 1.5) k = Math.exp(-since / 0.14);
      down = hit.downbeat;
      // New beat = clearly after the last one shown (live predictions can be
      // revised slightly backwards; a big jump back means a new song).
      if (hit.time < this.lastPulse - 2) this.lastPulse = NaN;
      const isNew = !(hit.time < this.lastPulse + 0.5 * hit.period);
      if (isNew && info.playing) {
        this.lastPulse = hit.time;
        this.barPos = down ? 0 : this.barPos < 0 ? 0 : (this.barPos + 1) % 4;
        const log = window.__ddPulseLog;
        if (Array.isArray(log)) log.push({ beat: hit.time, t: timeSec, perf: performance.now(), downbeat: down, from: hit.from });
      }
    } else {
      this.barPos = -1;
    }

    const idle = !hit;
    if (idle !== this.idle) {
      this.idle = idle;
      this.root?.classList.toggle('bp-idle', idle);
    }
    const amp = down ? 0.2 : 0.1;
    this.ring.style.transform = `translate(-50%, -50%) scale(${(1 + amp * k).toFixed(4)})`;
    this.ring.style.opacity = (hit ? 0.35 + 0.65 * k : 0).toFixed(3);
    this.core.style.opacity = (k * (down ? 0.85 : 0.3)).toFixed(3);
    this.core.style.transform = `translate(-50%, -50%) scale(${(0.6 + 0.4 * k).toFixed(4)})`;

    if (this.barPos !== this.shownDot) {
      this.shownDot = this.barPos;
      this.dots.forEach((d, i) => d.classList.toggle('on', i === this.barPos));
    }
    const sec = tl ? sectionAtTime(tl, timeSec) : undefined;
    const text = sec && hit ? (SECTION_LABEL[sec.type] ?? '') : '';
    if (text !== this.shownLabel) {
      this.shownLabel = text;
      this.label.textContent = text;
    }
  }

  unmount(): void {
    this.root?.remove();
    this.root = this.ring = this.core = this.label = null;
    this.dots = [];
  }
}
