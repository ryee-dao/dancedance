/**
 * Web Worker: plain timeouts for steadyTimers.ts. A page's own timers are
 * held back while its tab is in the background (Chrome: at most once a
 * second, after five hidden minutes once a minute); a dedicated worker's are
 * not, and the message that reports one runs on the page straight away.
 *
 * Messages in:  { type: 'set', id, ms } / { type: 'clear', id }.
 * Message out:  id, when that timeout is due.
 */

export type TimerRequest = { type: 'set'; id: number; ms: number } | { type: 'clear'; id: number };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<TimerRequest>) => void) | null;
  postMessage(msg: unknown): void;
};

const pending = new Map<number, ReturnType<typeof setTimeout>>();

scope.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'set') {
    pending.set(
      m.id,
      setTimeout(() => {
        pending.delete(m.id);
        scope.postMessage(m.id);
      }, m.ms),
    );
  } else if (m.type === 'clear') {
    const t = pending.get(m.id);
    if (t !== undefined) clearTimeout(t);
    pending.delete(m.id);
  }
};
