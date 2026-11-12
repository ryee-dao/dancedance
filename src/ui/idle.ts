/**
 * Background work that must not get in the way of the remote: run a job only
 * once the user has left the keys alone for a moment and the main thread is
 * idle. On a weak TV chip one slice of work can take a while, so a key press
 * should never land in the middle of it if we can help it.
 */

let lastInput = -Infinity;
let listening = false;

function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const note = () => {
    lastInput = performance.now();
  };
  for (const type of ['keydown', 'pointerdown', 'wheel', 'touchstart']) {
    window.addEventListener(type, note, { capture: true, passive: true });
  }
}

/** Start noticing key presses (call early, so the first quiet period is real). */
export function trackInput(): void {
  listen();
}

/**
 * Call `job` once there has been no key press for `quietMs` and the browser
 * reports idle time. `job` gets about how many ms it may use.
 */
export function whenQuiet(job: (budgetMs: number) => void, quietMs = 1200): void {
  listen();
  const ric = (window as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
  const check = () => {
    const wait = lastInput + quietMs - performance.now();
    if (wait > 0) {
      setTimeout(check, wait + 20);
      return;
    }
    if (ric) {
      ric(
        (d) => {
          if (performance.now() - lastInput < quietMs) check();
          else job(Math.max(8, Math.min(25, d.timeRemaining())));
        },
        { timeout: 3000 },
      );
    } else {
      setTimeout(() => job(12), 0);
    }
  };
  check();
}

/**
 * Run a sliced job (`step` returns true when finished) right away, one short
 * slice per task, so key presses still get in between the slices.
 */
export function runSliced(step: (budgetMs: number) => boolean, budgetMs = 12): void {
  const slice = () => {
    if (!step(budgetMs)) setTimeout(slice, 0);
  };
  setTimeout(slice, 0);
}

/**
 * Run a sliced job (`step` returns true when finished) in quiet idle moments,
 * one slice at a time.
 */
export function runWhenQuiet(step: (budgetMs: number) => boolean, quietMs = 1200): void {
  whenQuiet(function slice(budget) {
    if (!step(budget)) whenQuiet(slice, quietMs);
  }, quietMs);
}
