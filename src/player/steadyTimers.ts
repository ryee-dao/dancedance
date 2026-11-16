/**
 * Timers that keep time while the tab is in the background.
 *
 * A background tab's own timers are held back by the browser: Chrome runs
 * them at most once a second, and once the tab has been hidden for five
 * minutes (and silent for 30 s) a chain of them only once a minute. The
 * song's start sequence (YouTubePlayer's poll) and the 3-2-1 countdown are
 * timers, so a song chosen and then left in another tab would crawl to its
 * start. These timers run on the page's own timers while it is visible
 * (nothing changes for a visible page or the TV) and on a small Worker's
 * while it is hidden (workers are not held back, and the message that
 * reports one runs at once); a pending timer moves across when the
 * visibility changes, keeping its due time.
 *
 * An interval that fell behind skips the ticks it missed (no burst of
 * queued ticks when the tab comes back). Without Worker support everything
 * stays on the page's timers.
 */

export interface WorkerLike {
  postMessage(msg: unknown): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}

export interface SteadyTimerDeps {
  /** Whether the page is hidden right now. */
  hidden(): boolean;
  /** Call `fn` whenever the visibility changes. */
  onVisibilityChange(fn: () => void): void;
  now(): number;
  /** A timer worker (null: not available here). */
  makeWorker(): WorkerLike | null;
}

interface Timer {
  fn: () => void;
  /** Interval period in ms (0: a one-off timeout). */
  every: number;
  due: number;
  /** Bumped on every (re)arm; a stale report is ignored. */
  arm: number;
  handle: ReturnType<typeof setTimeout> | null;
  onWorker: boolean;
}

export class SteadyTimers {
  private readonly timers = new Map<number, Timer>();
  /** Arm number -> timer id, for the worker's reports. */
  private readonly armed = new Map<number, number>();
  private nextId = 1;
  private nextArm = 1;
  private worker: WorkerLike | null = null;
  private workerBroken = false;
  private listening = false;

  constructor(private readonly d: SteadyTimerDeps) {}

  /** Run `fn` once after `ms`. Returns a cancel function. */
  timeout(fn: () => void, ms: number): () => void {
    return this.add(fn, ms, 0);
  }

  /** Run `fn` every `ms`. Returns a cancel function. */
  interval(fn: () => void, ms: number): () => void {
    return this.add(fn, ms, Math.max(1, ms));
  }

  /** Pending timers (tests / diagnostics). */
  size(): number {
    return this.timers.size;
  }

  private add(fn: () => void, ms: number, every: number): () => void {
    this.listen();
    const id = this.nextId++;
    const t: Timer = { fn, every, due: this.d.now() + Math.max(0, ms), arm: 0, handle: null, onWorker: false };
    this.timers.set(id, t);
    this.arm(id, t);
    return () => this.cancel(id);
  }

  private cancel(id: number): void {
    const t = this.timers.get(id);
    if (!t) return;
    this.disarm(t);
    this.timers.delete(id);
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    this.d.onVisibilityChange(() => {
      for (const [id, t] of this.timers) {
        const wantWorker = this.useWorker();
        if (wantWorker === t.onWorker) continue;
        this.disarm(t);
        this.arm(id, t);
      }
    });
  }

  private useWorker(): boolean {
    return this.d.hidden() && !!this.getWorker();
  }

  private getWorker(): WorkerLike | null {
    if (this.worker || this.workerBroken) return this.worker;
    let w: WorkerLike | null = null;
    try {
      w = this.d.makeWorker();
    } catch {
      w = null;
    }
    if (!w) {
      this.workerBroken = true;
      return null;
    }
    w.onmessage = (e) => {
      const arm = e.data as number;
      const id = this.armed.get(arm);
      this.armed.delete(arm);
      if (id !== undefined) this.fire(id, arm);
    };
    w.onerror = () => this.dropWorker();
    this.worker = w;
    return w;
  }

  /** The worker failed (e.g. blocked from loading): everything back on the page's timers. */
  private dropWorker(): void {
    const w = this.worker;
    this.worker = null;
    this.workerBroken = true;
    try {
      w?.terminate();
    } catch {
      /* ignore */
    }
    for (const [id, t] of this.timers) {
      if (!t.onWorker) continue;
      this.disarm(t);
      this.arm(id, t);
    }
  }

  private arm(id: number, t: Timer): void {
    const arm = this.nextArm++;
    t.arm = arm;
    const delay = Math.max(0, t.due - this.d.now());
    const w = this.useWorker() ? this.worker : null;
    if (w) {
      t.onWorker = true;
      this.armed.set(arm, id);
      w.postMessage({ type: 'set', id: arm, ms: delay });
    } else {
      t.onWorker = false;
      t.handle = setTimeout(() => this.fire(id, arm), delay);
    }
  }

  private disarm(t: Timer): void {
    if (t.handle !== null) clearTimeout(t.handle);
    t.handle = null;
    if (t.onWorker) {
      this.armed.delete(t.arm);
      try {
        this.worker?.postMessage({ type: 'clear', id: t.arm });
      } catch {
        /* ignore */
      }
    }
    t.onWorker = false;
    t.arm = 0;
  }

  private fire(id: number, arm: number): void {
    const t = this.timers.get(id);
    if (!t || t.arm !== arm) return;
    t.handle = null;
    t.onWorker = false;
    if (t.every > 0) {
      const now = this.d.now();
      t.due += t.every;
      if (t.due <= now) t.due = now + t.every; // fell behind: skip the missed ticks
      this.arm(id, t);
    } else {
      this.timers.delete(id);
    }
    t.fn();
  }
}

function browserDeps(): SteadyTimerDeps {
  return {
    hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    onVisibilityChange: (fn) => {
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', fn);
    },
    now: () => performance.now(),
    makeWorker: () =>
      typeof Worker === 'undefined'
        ? null
        : (new Worker(new URL('../workers/timer.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike),
  };
}

let shared: SteadyTimers | null = null;

function timers(): SteadyTimers {
  return (shared ??= new SteadyTimers(browserDeps()));
}

/** setTimeout that keeps time in a background tab. Returns a cancel function. */
export function steadyTimeout(fn: () => void, ms: number): () => void {
  return timers().timeout(fn, ms);
}

/** setInterval that keeps time in a background tab. Returns a cancel function. */
export function steadyInterval(fn: () => void, ms: number): () => void {
  return timers().interval(fn, ms);
}
