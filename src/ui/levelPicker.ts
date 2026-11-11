/**
 * Compact "Chill / Cardio / Sweaty" level picker shown when a song (or
 * Shuffle) is chosen. The last-used level is pre-focused, so OK, OK starts
 * right away; Back / Escape cancels and returns focus to where it came from.
 * Values are the stored intensities ('chill' | 'cardio' | 'sweaty').
 */
import type { Intensity } from '../store';
import { h } from './dom';
import { focusEl, popScope, pushScope, type Scope } from './focusNav';

export const LEVELS: readonly { value: Intensity; label: string; hint: string }[] = [
  { value: 'chill', label: 'Chill', hint: 'Gentle steps' },
  { value: 'cardio', label: 'Cardio', hint: 'Keeps you moving' },
  { value: 'sweaty', label: 'Sweaty', hint: 'Big moves, full out' },
];

export interface LevelPickerOptions {
  /** Element the picker is appended to (the screen). */
  parent: HTMLElement;
  /** Heading, e.g. the song title or "Shuffle". */
  title: string;
  initial: Intensity;
  /** Focus goes back here on cancel. */
  returnFocus: HTMLElement | null;
  onPick(level: Intensity): void;
  /** A secondary action under the levels (e.g. "Remove from My added songs"). */
  extra?: { label: string; onSelect(): void };
}

/** Opens the picker; returns a function that closes it without picking. */
export function openLevelPicker(o: LevelPickerOptions): () => void {
  const buttons = LEVELS.map((l) =>
    h(
      'button',
      {
        class: `btn level-btn${l.value === o.initial ? ' level-last' : ''}`,
        type: 'button',
        'data-level': l.value,
        'aria-label': `${l.label}: ${l.hint}`,
      },
      h('span', { class: 'level-name' }, l.label),
      h('span', { class: 'level-hint' }, l.hint),
    ),
  );
  const card = h(
    'div',
    { class: 'picker-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Choose a level for ${o.title}` },
    h('p', { class: 'picker-kicker' }, 'Choose your level'),
    h('p', { class: 'picker-title' }, o.title),
    h('div', { class: 'picker-levels' }, ...buttons),
    o.extra && h('div', { class: 'picker-extra' }, h('button', { class: 'btn btn-quiet btn-small', type: 'button', 'data-extra': '1' }, o.extra.label)),
  );
  const root = h('div', { class: 'picker-backdrop' }, card);
  let open = true;

  const close = (refocus: boolean) => {
    if (!open) return;
    open = false;
    popScope(scope);
    root.remove();
    if (refocus && o.returnFocus?.isConnected) focusEl(o.returnFocus, { instant: true });
  };
  const scope: Scope = {
    root,
    onBack: () => close(true),
    defaultFocus: () => buttons.find((b) => b.dataset.level === o.initial) ?? buttons[1],
  };
  root.addEventListener('click', (e) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest('[data-extra]')) {
      close(false);
      o.extra?.onSelect();
      return;
    }
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-level]');
    if (b) {
      const level = b.dataset.level as Intensity;
      close(false);
      o.onPick(level);
    } else if (!card.contains(e.target as Node)) {
      close(true); // click on the backdrop
    }
  });
  o.parent.appendChild(root);
  pushScope(scope);
  return () => close(true);
}
