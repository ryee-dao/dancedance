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
  { id: 'human', name: 'Human', description: 'Stylised human dancer: tee and shorts over two-tone leggings.' },
  { id: 'sticker', name: 'Sticker', description: 'Soft, fuller-figured cut-out with light outlines and two-tone joggers.' },
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

/**
 * Every look comes as a female and a male dancer: same drawing style, own
 * build, hair and outfit. Single player shows the chosen one; two players
 * get the pair (P1 the chosen one, P2 the other).
 */
export type CoachBuild = 'female' | 'male';

export interface CoachBuildInfo {
  id: CoachBuild;
  name: string;
  /** What changes, per look, in a few words. */
  description: string;
}

export const COACH_BUILDS: readonly CoachBuildInfo[] = [
  { id: 'female', name: 'Female', description: 'Ponytail, curly puff or headband tails; slimmer build.' },
  { id: 'male', name: 'Male', description: 'Short hair or a beanie; broader shoulders, longer shorts.' },
];

/** Today's figures (ponytail, puff, headband tails) are the female versions. */
export const DEFAULT_COACH_BUILD: CoachBuild = 'female';

export function parseCoachBuild(v: unknown): CoachBuild | null {
  return v === 'female' || v === 'male' ? v : null;
}

/** The other version: two players dance as a female + male pair of one look. */
export function partnerBuild(b: CoachBuild): CoachBuild {
  return b === 'female' ? 'male' : 'female';
}

/** Builds of P1 and P2 on the two-player stage: P1 the chosen version, P2 the other. */
export function duoBuilds(chosen: CoachBuild): readonly [CoachBuild, CoachBuild] {
  return [chosen, partnerBuild(chosen)];
}

// Projection shared by every style (mild perspective around a pivot height).
export const CAM = 4.2;
export const PIV_Y = 0.55;
