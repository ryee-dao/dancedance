/** Tiny DOM helpers and the shared screen/navigation types. */

import type { PlayItem } from '../player/types';
import type { Intensity } from '../store';
import type { Scope } from './focusNav';

type Attrs = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | undefined | false;

/** h('button', { class: 'btn', 'data-action': 'x' }, 'Label') */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
  return el;
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A mounted screen. The app swaps these in and out of #app. */
export interface Screen {
  el: HTMLElement;
  scope: Scope;
  /** Called after the element is attached and its scope is active. */
  mounted?(): void;
  destroy(): void;
}

export interface HomeOptions {
  /** Video ID of the tile to focus (e.g. the last played song). */
  focusId?: string;
  /** data-action of a header button to focus instead. */
  focusAction?: string;
}

export interface Nav {
  home(opts?: HomeOptions): void;
  link(): void;
  /**
   * Play a queue. With shuffle, songs continue one after another.
   * `intensity`: the level picked for this run (default: the last used).
   */
  play(queue: PlayItem[], opts?: { shuffle?: boolean; intensity?: Intensity }): void;
  /**
   * Start loading the play screen's code now (a song is being chosen), so
   * play() can start straight away. Optional; harmless to call again.
   */
  prepare?(): void;
  /** Open the file picker ("Play a file"). */
  pickFile(): void;
  /** "Add a song" search screen (web only). */
  addSong(): void;
  /** Options: coach look, audio offset, beat sync, links. */
  options(opts?: { focusAction?: string }): void;
  /** Android TV: the diagnostics readout (opened from Options; Back returns there). `focusAction`: button to focus. */
  diagnostics?(opts?: { focusAction?: string }): void;
  /** The graphics test (from Diagnostics; Back returns there). `run`: start a run straight away. */
  graphicsTest?(opts?: { run?: boolean }): void;
}
