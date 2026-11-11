/**
 * Coach character styles ("skins"). Every style draws the same solved
 * skeleton; only the look changes, so the animation, timing and layering
 * rules are shared.
 *
 * Pure TypeScript (no DOM).
 */

export type CoachStyle = 'classic' | 'human' | 'sticker';

export interface CoachStyleInfo {
  id: CoachStyle;
  name: string;
  description: string;
}

/** Every style, in menu order, with a display name and a one-line description. */
export const COACH_STYLES: readonly CoachStyleInfo[] = [
  { id: 'classic', name: 'Classic', description: 'Chunky rounded cartoon with colour-coded limbs.' },
  { id: 'human', name: 'Human', description: 'Stylised human dancer: ponytail, tee, shorts over two-tone leggings.' },
  { id: 'sticker', name: 'Sticker', description: 'Soft, fuller-figured cut-out with light outlines: curly puff, hoodie and two-tone joggers.' },
];

/** Style ids in menu order. */
export const COACH_STYLE_IDS: readonly CoachStyle[] = COACH_STYLES.map((s) => s.id);

export const DEFAULT_COACH_STYLE: CoachStyle = 'classic';

/** Display info for a style id. */
export function coachStyleInfo(id: CoachStyle): CoachStyleInfo {
  return COACH_STYLES.find((s) => s.id === id) ?? COACH_STYLES[0];
}

/** A style id from untrusted input (URL, storage), or null. */
export function parseCoachStyle(v: unknown): CoachStyle | null {
  return typeof v === 'string' && (COACH_STYLE_IDS as readonly string[]).includes(v) ? (v as CoachStyle) : null;
}

// Projection shared by every style (mild perspective around a pivot height).
export const CAM = 4.2;
export const PIV_Y = 0.55;
