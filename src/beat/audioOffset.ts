/**
 * Audio offset setting: shifts everything synced to the music.
 *
 * Positive = the coach moves later (for speakers that lag, e.g. Bluetooth).
 * The play screen hands stage renderers `stageTime(songTime, offset)`.
 */

export const OFFSET_STEP_MS = 10;
export const OFFSET_LIMIT_MS = 500;

/** Clamp to ±500 ms and snap to the 10 ms grid. Non-numbers become 0. */
export function clampOffset(ms: unknown): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return 0;
  const snapped = Math.round(ms / OFFSET_STEP_MS) * OFFSET_STEP_MS;
  const v = Math.max(-OFFSET_LIMIT_MS, Math.min(OFFSET_LIMIT_MS, snapped));
  return v === 0 ? 0 : v; // no -0
}

/** One Left (-1) / Right (+1) press. */
export function stepOffset(ms: number, dir: -1 | 1): number {
  return clampOffset(clampOffset(ms) + dir * OFFSET_STEP_MS);
}

/** "Audio offset +40 ms" */
export function formatOffset(ms: number): string {
  const v = clampOffset(ms);
  return `Audio offset ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} ms`;
}

/** The time the stage sees: positive offset makes it run behind the song. */
export function stageTime(songTime: number, offsetMs: number): number {
  return songTime - clampOffset(offsetMs) / 1000;
}
