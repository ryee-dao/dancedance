/**
 * "Contributed map" mode: a beat map a player's browser made (by listening to
 * tab audio, source 'tab', or by analysing a local download, source
 * 'device'), forwarded by the relay as the workflow input `map_json`.
 * Pure decision logic; pipeline.ts does the file I/O.
 *
 * Accepted only when:
 *  - it passes `checkSharedMap` (validateBeatMap + the sharing rules),
 *  - its video is a known song (starter pack, songs.json or the published
 *    playlist) and, for songs added by search, its length fits,
 *  - and there is no existing map of equal or higher rank:
 *      cloud > device > file > tab > mic (sourceRank). A cloud map is never
 *      replaced; a device map is not replaced by another device map; an
 *      existing tab map is only replaced by a tab map whose beats cover
 *      clearly more of the song (TAB_BETTER_SPAN), otherwise the first stays.
 * Nothing from the payload is executed or interpolated anywhere: it is
 * parsed as JSON, validated, normalised and written back as JSON.
 */
import { beatSpan, checkSharedMap, sourceRank, type BeatMap, type BeatMapSource } from '../../src/core/analysis';

/** A newer tab map must cover this much more of the song (fraction of the duration) to replace an older one. */
export const TAB_BETTER_SPAN = 0.05;
/** For songs added by search: the map's length must be within this of the official length (s). */
export const LENGTH_SLACK: [number, number] = [-10, 90];

export interface KnownSongs {
  ids: ReadonlySet<string>;
  /** Official length (s) of songs added by search, when known. */
  durations: ReadonlyMap<string, number>;
}

export interface ExistingMap {
  source: BeatMapSource | string;
  span: number;
}

export type ContributionDecision =
  | { kind: 'accept'; map: BeatMap; replaces?: string }
  | { kind: 'reject'; rule: string; message: string }
  | { kind: 'ignore'; reason: string; message: string };

export function parseContribution(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function decideContribution(raw: unknown, known: KnownSongs, existing: ExistingMap | undefined): ContributionDecision {
  if (raw === undefined) return { kind: 'reject', rule: 'json', message: 'map_json is not valid JSON' };
  const chk = checkSharedMap(raw);
  if (!chk.ok) return { kind: 'reject', rule: chk.rule, message: `the map breaks the "${chk.rule}" rule` };
  const map = chk.map;
  if (!known.ids.has(map.videoId)) return { kind: 'reject', rule: 'unknown-song', message: `${map.videoId} is not a song in the starter pack, songs.json or the playlist` };
  const official = known.durations.get(map.videoId);
  if (official && official > 0) {
    const d = map.duration - official;
    if (d < LENGTH_SLACK[0] || d > LENGTH_SLACK[1]) {
      return { kind: 'reject', rule: 'length', message: `the map is ${Math.round(map.duration)} s long but the song is ${official} s` };
    }
  }
  if (existing) {
    const er = sourceRank(existing.source as BeatMapSource);
    const ir = sourceRank(map.source);
    if (existing.source === 'cloud' || er > ir) {
      return { kind: 'ignore', reason: 'has-better-map', message: `a ${existing.source} map already exists` };
    }
    if (er === ir) {
      const better = map.source === 'tab' && beatSpan(map) >= existing.span + TAB_BETTER_SPAN;
      if (!better) return { kind: 'ignore', reason: 'has-map', message: `a ${existing.source} map already exists and this one is not clearly better` };
    }
    return { kind: 'accept', map, replaces: String(existing.source) };
  }
  return { kind: 'accept', map };
}
