/**
 * The mutable BeatSource the play screen hands to stage renderers.
 *
 * `current()` returns the same object until something changes, so consumers
 * can compare by identity. `revision` bumps only when the map is replaced.
 */
import type { BeatMap } from '../core/analysis';
import type { BeatSource, BeatTimeline, LiveBeats } from './beatSource';

export class BeatHub implements BeatSource {
  private tl: BeatTimeline = { map: null, live: null, revision: 0 };

  current(): BeatTimeline {
    return this.tl;
  }

  map(): BeatMap | null {
    return this.tl.map;
  }

  setMap(map: BeatMap | null): void {
    if (map === this.tl.map) return;
    this.tl = { map, live: this.tl.live, revision: this.tl.revision + 1 };
  }

  setLive(live: LiveBeats | null): void {
    if (live === this.tl.live) return;
    this.tl = { map: this.tl.map, live, revision: this.tl.revision };
  }
}
