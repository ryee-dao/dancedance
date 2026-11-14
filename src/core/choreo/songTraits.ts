/**
 * Absolute per-song audio traits, as a beat map may carry them (`traits`).
 * Pure TypeScript (no DOM).
 *
 * Every field is a number 0..1 and may be absent; the whole object is absent
 * on older maps. Unlike the bar / section energy of a map (relative within
 * the song: a ballad's chorus is its own peak), these are absolute, so they
 * can tell a ballad from a banger by the same band.
 *
 * This declaration mirrors the analysis side's (structurally identical); read
 * a map's traits with `traitsOf`, which validates and clamps defensively.
 */

export interface SongTraits {
  /** 1 = very calm (slow, sparse hits, little percussion, soft); 0 = driving. */
  calm?: number;
  /** Drum / percussive strength. */
  drive?: number;
  /** Steady kick on every beat (house, disco, EDM). */
  fourFloor?: number;
  /** Backbeat at half the counted tempo (trap, drill, dubstep). */
  halfFeel?: number;
  /** Sub-bass weight. */
  bass?: number;
  /** Hi-hat / 16th-note density (trap rolls, drum & bass). */
  hats?: number;
  /** Swung or shuffled 8ths. */
  swing?: number;
  /** Syncopation (dembow, afrobeats). */
  syncop?: number;
  /** Distortion / wall of sound (metal, hard rock). */
  heavy?: number;
  /** Minor-mode likelihood (weak evidence; low weight only). */
  minor?: number;
  /** How hard-hitting the sound is, apart from how rhythmic (analyser 1.4.0+): 0 = soft (voice, piano, acoustic), 1 = distorted / harsh / dense. */
  intensity?: number;
  /** How plausible stepping at half the map's bpm is (analyser 1.4.0+). */
  halfTempo?: number;
  /** How plausible stepping at twice the map's bpm is (analyser 1.4.0+). */
  doubleTempo?: number;
}

/** Every trait a map may carry: the 1.3.0 set and the optional 1.4.0 ones (analysis/traits.ts OPTIONAL_TRAIT_KEYS). Maps without the newer keys behave as before. */
export const TRAIT_KEYS: readonly (keyof SongTraits)[] = ['calm', 'drive', 'fourFloor', 'halfFeel', 'bass', 'hats', 'swing', 'syncop', 'heavy', 'minor', 'intensity', 'halfTempo', 'doubleTempo'];

/** A clean copy of a traits object: finite numbers only, clamped to 0..1; undefined when nothing usable is left. */
export function readTraits(raw: unknown): SongTraits | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const out: SongTraits = {};
  let any = false;
  for (const k of TRAIT_KEYS) {
    const v = src[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[k] = v < 0 ? 0 : v > 1 ? 1 : v;
    any = true;
  }
  return any ? out : undefined;
}

/** The traits a beat map carries (undefined on older maps or bad data). */
export function traitsOf(map: unknown): SongTraits | undefined {
  if (!map || typeof map !== 'object') return undefined;
  return readTraits((map as { traits?: unknown }).traits);
}
