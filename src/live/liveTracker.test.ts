import { describe, expect, it } from 'vitest';
import { synthClickTrack } from '../core/analysis/synth.testutil';
import type { CaptureChunk, ChunkSource } from './capture';
import { LiveTracker, MIN_SAVE_SECONDS } from './liveTracker';

/**
 * Simulated room: the song plays from song time 0; the capture hears it
 * `latency` seconds later and delivers 1024-sample chunks in real time. The
 * player clock and performance.now() are driven by the simulation.
 */
function simulate(o: { bpm: number; seconds: number; latency: number; pauseAt?: number; pauseFor?: number; startSong?: number; dropAt?: number; dropChunks?: number }) {
  const sr = 48000;
  const s = synthClickTrack({ bpm: o.bpm, duration: o.seconds + 2, sampleRate: sr });
  let perf = 0; // ms
  let song = o.startSong ?? 0;
  let playing = true;
  const src: ChunkSource = { sampleRate: sr, onChunk: null };
  const tracker = new LiveTracker(src, { source: 'mic', latency: o.latency, clock: { time: () => song, playing: () => playing }, now: () => perf });
  const CH = 1024;
  let heardSongTime = (o.startSong ?? 0) - o.latency; // song time of the sound reaching the mic now
  const total = Math.floor((o.seconds * sr) / CH);
  for (let k = 0; k < total; k++) {
    const dt = CH / sr;
    perf += dt * 1000;
    const paused = o.pauseAt !== undefined && song >= o.pauseAt && song < o.pauseAt + 0.001 && (o.pauseFor ?? 0) > 0;
    if (paused) {
      // Room is silent while paused; time passes, song doesn't.
      playing = false;
      const silent = new Float32Array(CH);
      for (let n = 0; n < Math.round(((o.pauseFor ?? 0) * sr) / CH); n++) {
        perf += dt * 1000;
        src.onChunk?.({ pcm: silent, perfEnd: perf - 3 } as CaptureChunk);
      }
      o.pauseFor = 0;
      playing = true;
    }
    song += dt;
    heardSongTime += dt;
    const i0 = Math.round(Math.max(0, heardSongTime - dt) * sr);
    const pcm = heardSongTime - dt < 0 ? new Float32Array(CH) : s.pcm.slice(i0, i0 + CH);
    // A capture glitch: a few buffers never arrive (the song goes on).
    if (o.dropAt !== undefined && song >= o.dropAt && (o.dropChunks ?? 0) > 0) {
      o.dropChunks = (o.dropChunks ?? 0) - 1;
      continue;
    }
    // Delivered a few ms after capture, with jitter.
    src.onChunk?.({ pcm: pcm.length === CH ? pcm : new Float32Array(CH), perfEnd: perf - 2 - (k % 5) });
  }
  return { tracker, truth: s.beats, song: () => song };
}

function nearestErr(t: number, truth: number[]): number {
  let best = Infinity;
  for (const b of truth) if (Math.abs(t - b) < Math.abs(best)) best = t - b;
  return best;
}

describe('LiveTracker (song-time mapping end to end)', () => {
  it('locks and reports beats in song time, compensating for latency', () => {
    const { tracker, truth } = simulate({ bpm: 120, seconds: 30, latency: 0.08 });
    const live = tracker.live();
    expect(live.locked).toBe(true);
    expect(live.bpm).toBeGreaterThan(118);
    expect(live.bpm).toBeLessThan(122);
    expect(tracker.lockSongTime).toBeGreaterThan(0);
    expect(tracker.lockSongTime).toBeLessThan(12);
    const late = live.beats.filter((b) => b > 12);
    expect(late.length).toBeGreaterThan(20);
    const errs = late.map((b) => nearestErr(b, truth));
    const meanAbs = errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
    expect(meanAbs).toBeLessThan(0.03);
    expect(live.nextBeats.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps the mapping across a pause (chunks are ignored while paused)', () => {
    const { tracker, truth } = simulate({ bpm: 100, seconds: 40, latency: 0.03, pauseAt: 15, pauseFor: 4 });
    const live = tracker.live();
    expect(live.locked).toBe(true);
    const errs = live.beats.filter((b) => b > 20).map((b) => nearestErr(b, truth));
    const meanAbs = errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
    expect(meanAbs).toBeLessThan(0.03);
  });

  it('finalizes into a song-time map; >= 45 s of coverage is worth saving', () => {
    const { tracker, truth } = simulate({ bpm: 128, seconds: 50, latency: 0.05 });
    const res = tracker.finalize('vid', 200)!;
    expect(res.covered).toBeGreaterThanOrEqual(MIN_SAVE_SECONDS);
    expect(res.map.source).toBe('mic');
    expect(res.map.partial).toBe(true); // 50 s of a 200 s song
    const errs = res.map.beats.filter((b) => b > 5 && b < 45).map((b) => nearestErr(b, truth));
    const meanAbs = errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
    expect(meanAbs).toBeLessThan(0.025);
  });

  it('a few lost capture buffers mid-song do not shift the beats before them in the saved map', () => {
    const { tracker, truth } = simulate({ bpm: 120, seconds: 80, latency: 0.04, dropAt: 40, dropChunks: 4 }); // ~85 ms lost at 40 s
    const res = tracker.finalize('vid', 80)!;
    const meanAbs = (lo: number, hi: number) => {
      const errs = res.map.beats.filter((b) => b > lo && b < hi).map((b) => nearestErr(b, truth));
      return errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
    };
    expect(meanAbs(8, 38)).toBeLessThan(0.02);
    expect(meanAbs(42, 78)).toBeLessThan(0.02);
  });
});
