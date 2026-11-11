/** Brief, non-focusable notifications (announced to screen readers). */

let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (!region || !region.isConnected) {
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

export function toast(message: string, ms = 4000): void {
  const r = ensureRegion();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  r.appendChild(el);
  // Keep at most three on screen.
  while (r.children.length > 3) r.firstElementChild?.remove();
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 400);
  }, ms);
}
