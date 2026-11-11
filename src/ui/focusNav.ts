/**
 * D-pad / keyboard focus navigation.
 *
 * Android TV remotes in a WebView deliver ArrowUp/Down/Left/Right, Enter
 * (OK / DPAD_CENTER) and Escape/Backspace/GoBack (Back), so this one module is
 * both the keyboard and the TV input path.
 *
 * Model: a stack of scopes. The bottom scope is the current screen; overlays
 * (dialogs, pause menu) push their own scope on top. Only the top scope's
 * focusable elements are reachable, and it gets Back and any custom keys.
 *
 * Invariant: after any screen change or DOM update there is a focused element
 * inside the top scope (ensureFocus). If focus is ever lost (element removed,
 * click on empty space), the next key press restores it instead of doing
 * nothing.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Scope {
  root: HTMLElement;
  /** Back (Escape / Backspace / remote Back). */
  onBack?: () => void;
  /** Custom key handling; return true when handled. Runs before navigation. */
  onKey?: (e: KeyboardEvent) => boolean;
  /** Element to focus when the scope opens or focus is lost. */
  defaultFocus?: () => HTMLElement | null;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [data-focusable]';

const stack: Scope[] = [];
/** Last focused element per scope root, to restore focus inside it. */
const lastFocus = new WeakMap<HTMLElement, HTMLElement>();
let reducedMotion = false;

export function initFocusNav(): void {
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('focusin', (e) => {
    const scope = top();
    const t = e.target;
    if (scope && t instanceof HTMLElement && scope.root.contains(t)) lastFocus.set(scope.root, t);
  });
  // Mouse: hovering a focusable focuses it, so mouse and remote share one
  // highlight. Uses mousemove (not mouseover) so content scrolling under a
  // still pointer doesn't steal focus from the keyboard.
  document.addEventListener('mousemove', (e) => {
    const scope = top();
    const el = (e.target as Element | null)?.closest?.(FOCUSABLE);
    if (!scope || !(el instanceof HTMLElement) || !scope.root.contains(el)) return;
    if (el !== document.activeElement && !isTextInput(document.activeElement)) {
      el.focus({ preventScroll: true });
    }
  });
  // If the focused element is removed by a re-render, put focus back.
  new MutationObserver(() => {
    const scope = top();
    if (scope && !scope.root.contains(document.activeElement)) queueEnsure();
  }).observe(document.body, { childList: true, subtree: true });
}

let ensureQueued = false;
function queueEnsure(): void {
  if (ensureQueued) return;
  ensureQueued = true;
  queueMicrotask(() => {
    ensureQueued = false;
    ensureFocus();
  });
}

function top(): Scope | undefined {
  return stack[stack.length - 1];
}

/** Replace the whole stack with a new screen scope. */
export function setScreenScope(scope: Scope): void {
  stack.length = 0;
  stack.push(scope);
  ensureFocus(true);
}

/** Open an overlay scope on top of the current one. */
export function pushScope(scope: Scope): void {
  stack.push(scope);
  ensureFocus(true);
}

/** Close an overlay scope (no-op if it isn't open). Focus returns below. */
export function popScope(scope: Scope): void {
  const i = stack.indexOf(scope);
  if (i < 0) return;
  stack.splice(i);
  ensureFocus(true);
}

export function isScopeOpen(scope: Scope): boolean {
  return stack.includes(scope);
}

/**
 * Make sure something inside the top scope has focus.
 * `fresh`: the scope just opened, so prefer its defaultFocus over memory.
 */
export function ensureFocus(fresh = false): void {
  const scope = top();
  if (!scope) return;
  const active = document.activeElement;
  if (!fresh && active instanceof HTMLElement && scope.root.contains(active) && active !== scope.root) {
    return;
  }
  const remembered = lastFocus.get(scope.root);
  const candidates = fresh
    ? [scope.defaultFocus?.(), remembered]
    : [remembered, scope.defaultFocus?.()];
  for (const el of candidates) {
    if (el && el.isConnected && scope.root.contains(el) && isVisible(el)) {
      focusEl(el, { block: 'center', instant: true });
      return;
    }
  }
  const first = focusables(scope.root)[0];
  if (first) {
    focusEl(first, { block: 'center', instant: true });
    return;
  }
  // Nothing focusable (e.g. play screen without an overlay): focus the root
  // itself so key events still have a home.
  if (!scope.root.hasAttribute('tabindex')) scope.root.tabIndex = -1;
  if (document.activeElement !== scope.root) scope.root.focus({ preventScroll: true });
}

/** Focus an element and scroll it into view. */
export function focusEl(
  el: HTMLElement,
  opts: { block?: ScrollLogicalPosition; instant?: boolean } = {},
): void {
  el.focus({ preventScroll: true });
  const behavior: ScrollBehavior = opts.instant || reducedMotion ? 'auto' : 'smooth';
  // Elements near the top of the page (header buttons, first row): show the
  // page top rather than leaving the header half-scrolled.
  const docTop = el.getBoundingClientRect().top + window.scrollY;
  if (docTop < window.innerHeight * 0.35 && document.scrollingElement) {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  el.scrollIntoView({ block: opts.block ?? 'nearest', inline: 'nearest', behavior });
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible);
}

function isVisible(el: HTMLElement): boolean {
  if (el.closest('[hidden], [inert]')) return false;
  return el.getClientRects().length > 0;
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'submit', 'checkbox', 'radio', 'file', 'range', 'reset'].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

const ARROWS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function isBackKey(e: KeyboardEvent): boolean {
  return e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack';
}

export function isOkKey(e: KeyboardEvent): boolean {
  // keyCode 23 = Android DPAD_CENTER, in case a WebView passes it through raw.
  return e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 23;
}

let stickyX: number | null = null;
let stickyFrom: HTMLElement | null = null;

/** Elements activated on keydown; their keyup must not re-trigger a native click. */
let swallowKeyUp: string | null = null;

function onKeyDown(e: KeyboardEvent): void {
  const scope = top();
  if (!scope || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const active = document.activeElement;
  const typing = isTextInput(active);
  const dir = ARROWS[e.key];

  // While typing, the input owns everything except leaving it vertically and
  // Escape. Backspace edits text.
  if (typing) {
    if (e.key === 'Escape') {
      e.preventDefault();
      scope.onBack?.();
      return;
    }
    if (dir !== 'up' && dir !== 'down') return;
  }

  if (scope.onKey?.(e)) {
    e.preventDefault();
    return;
  }

  // Focus lost? Restore it first; the key press "spends" itself on that.
  if (!(active instanceof HTMLElement) || !scope.root.contains(active)) {
    if (dir || isOkKey(e)) {
      e.preventDefault();
      ensureFocus();
      return;
    }
  }

  if (dir) {
    e.preventDefault();
    const from = document.activeElement as HTMLElement;
    // Sticky column: a run of Up/Down presses keeps aiming at the column it
    // started in, so passing through a short row doesn't drift you left.
    const vertical = dir === 'up' || dir === 'down';
    if (!vertical || stickyFrom !== from) stickyX = null;
    if (vertical && stickyX === null) {
      const r = from.getBoundingClientRect();
      stickyX = r.left + r.width / 2 + window.scrollX;
    }
    const next = findNext(
      from,
      focusables(scope.root).filter((el) => el !== from),
      dir,
      vertical && stickyX !== null ? stickyX - window.scrollX : undefined,
    );
    stickyFrom = next ?? from;
    if (next) {
      // Smooth scrolling chained across held-key repeats lags; jump instead.
      focusEl(next, { instant: e.repeat });
    }
    return;
  }

  if (isOkKey(e) && !typing) {
    e.preventDefault();
    if (e.repeat) return; // holding OK must not fire repeatedly
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== scope.root && scope.root.contains(el)) {
      swallowKeyUp = e.key;
      el.click();
    }
    return;
  }

  if (isBackKey(e)) {
    e.preventDefault();
    if (!e.repeat) scope.onBack?.();
  }
}

function onKeyUp(e: KeyboardEvent): void {
  // We already activated on keydown; stop the button's native Space-keyup click.
  if (swallowKeyUp && e.key === swallowKeyUp) {
    e.preventDefault();
    swallowKeyUp = null;
  }
}

// ---------------------------------------------------------------------------
// Spatial search

/**
 * Up/Down: find the nearest "row" in that direction (candidates whose edge
 * distance is within a small band of the closest one), then pick the element
 * in it that best lines up horizontally. This makes grids behave like grids:
 * Down always lands in the next row, even if that row is shorter.
 *
 * Left/Right: only elements that overlap vertically count (same row), and the
 * closest one wins. At the end of a row nothing happens (no wrap), which
 * stops Right from jumping up into the header.
 */
export function findNext(
  from: HTMLElement,
  candidates: HTMLElement[],
  dir: Dir,
  /** For Up/Down: the x to line up with (defaults to the element's centre). */
  aimX?: number,
): HTMLElement | null {
  const a = from.getBoundingClientRect();
  type Cand = { el: HTMLElement; primary: number; gap: number; offset: number };
  const list: Cand[] = [];
  const ax = aimX ?? a.left + a.width / 2;
  // Horizontal extent used for Up/Down overlap (shifted when aiming).
  const aL = ax - a.width / 2;
  const aR = ax + a.width / 2;
  const ay = a.top + a.height / 2;

  // Leaving a wide element (text field, banner) for smaller ones below/above
  // it: line up left edges, so Down from an input lands on the first button.
  const vOffset = (b: DOMRect, bx: number) =>
    a.width > 1.8 * b.width ? Math.abs(b.left - aL) : Math.abs(bx - ax);

  for (const el of candidates) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    let primary: number;
    let overlap: number;
    let offset: number;
    switch (dir) {
      case 'down':
        if (by <= ay + 1 || b.bottom <= a.bottom) continue;
        primary = Math.max(0, b.top - a.bottom);
        overlap = Math.min(aR, b.right) - Math.max(aL, b.left);
        offset = vOffset(b, bx);
        break;
      case 'up':
        if (by >= ay - 1 || b.top >= a.top) continue;
        primary = Math.max(0, a.top - b.bottom);
        overlap = Math.min(aR, b.right) - Math.max(aL, b.left);
        offset = vOffset(b, bx);
        break;
      case 'right':
        if (bx <= ax + 1 || b.right <= a.right) continue;
        primary = Math.max(0, b.left - a.right);
        overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        offset = Math.abs(by - ay);
        break;
      case 'left':
        if (bx >= ax - 1 || b.left >= a.left) continue;
        primary = Math.max(0, a.left - b.right);
        overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        offset = Math.abs(by - ay);
        break;
    }
    list.push({ el, primary, gap: overlap > 0 ? 0 : -overlap, offset });
  }
  if (!list.length) return null;

  if (dir === 'left' || dir === 'right') {
    const sameRow = list.filter((c) => c.gap === 0);
    if (!sameRow.length) return null;
    sameRow.sort((p, q) => p.primary - q.primary || p.offset - q.offset);
    return sameRow[0].el;
  }

  const minPrimary = Math.min(...list.map((c) => c.primary));
  const band = Math.max(8, Math.min(a.height, a.width) * 0.5);
  const row = list.filter((c) => c.primary <= minPrimary + band);
  row.sort((p, q) => p.gap - q.gap || p.offset - q.offset);
  return row[0].el;
}
