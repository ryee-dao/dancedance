/**
 * Song-shaped stress: a synthetic song with a beat switch (96 -> 150 BPM) and
 * a 5 s silent gap in between, analysed like an on-device song (first 30 s
 * map, then the full map swapped in mid-song), danced end to end at 30 fps by
 * the conductor (single and two players), with the TV player's clock and
 * watchdog fed the element time. Nothing may throw, produce a non-finite
 * pose, stall, jump, or take long per frame.
 */
import { describe, expect, it } from 'vitest';
import type { BeatTimeline } from '../../beat/beatSource';
import { analyzeOffline } from '../analysis/offline';
import { validateBeatMap, type BeatMap } from '../analysis/beatmap';
import { synthClickTrack } from '../analysis/synth.testutil';
import { generateDuoRoutine } from '../choreo/duo';
import { generateRoutine, isUsableBeatMap, type Intensity } from '../choreo/generator';
import { SmoothClock } from '../../player/clock';
import { PlaybackWatchdog } from '../../player/watchdog';
import { Conductor } from './conductor';
import { DuoTracks } from './duoTracks';
import { J, createPose, createSkeleton, solveSkeleton } from './skeleton';

const SR = 22050;

function beatSwitchSong(): { pcm: Float32Array; gapStart: number; gapEnd: number } {
  const a = synthClickTrack({ bpm: 96, duration: 70, pattern: 'pop', hihat: true, sampleRate: SR, seed: 3 });
  const b = synthClickTrack({ bpm: 150, duration: 95, pattern: 'pop', hihat: true, sampleRate: SR, seed: 4 });
  const gap = 5 * SR;
  const pcm = new Float32Array(a.pcm.length + gap + b.pcm.length);
  pcm.set(a.pcm, 0);
  pcm.set(b.pcm, a.pcm.length + gap);
  return { pcm, gapStart: a.pcm.length / SR, gapEnd: (a.pcm.length + gap) / SR };
}

describe('a song with a beat switch and a silent gap', () => {
  const song = beatSwitchSong();
  const full = analyzeOffline(song.pcm, SR, { videoId: 'switch-gap', source: 'device' });
  const partial: BeatMap = { ...analyzeOffline(song.pcm, SR, { videoId: 'switch-gap', source: 'device', maxSeconds: 30 }), partial: true };

  it('analyses to valid, usable maps', () => {
    for (const m of [full, partial]) {
      expect(() => validateBeatMap(m)).not.toThrow();
      expect(isUsableBeatMap(m)).toBe(true);
      for (let i = 1; i < m.beats.length; i++) expect(m.beats[i]).toBeGreaterThan(m.beats[i - 1]);
    }
    expect(full.duration).toBeCloseTo(song.pcm.length / SR, 1);
    // Beats on both sides of the gap.
    expect(full.beats.some((t) => t < song.gapStart)).toBe(true);
    expect(full.beats.some((t) => t > song.gapEnd + 10)).toBe(true);
  });

  it('every level generates a routine covering the song, solo and duo', () => {
    for (const level of ['chill', 'cardio', 'sweaty'] as Intensity[]) {
      const r = generateRoutine(full, level);
      expect(r.instances.length).toBeGreaterThan(10);
      for (let i = 1; i < r.instances.length; i++) {
        expect(r.instances[i].start).toBe(r.instances[i - 1].start + r.instances[i - 1].span);
      }
      const d = generateDuoRoutine(full, level, {});
      expect(d.p1.length).toBeGreaterThan(0);
      expect(d.p2.length).toBeGreaterThan(0);
    }
  });

  it('dances through it (partial map, then the full map at 41 s) without stalls, jumps or slow frames', () => {
    const c = new Conductor();
    const duo = new DuoTracks();
    const pose = createPose();
    const sk = createSkeleton();
    const prev = new Float64Array(sk.p.length);
    let wall = 0;
    const clock = new SmoothClock({ now: () => wall, maxHold: 0.5 });
    const dog = new PlaybackWatchdog();
    const tl: BeatTimeline = { map: partial, live: null, revision: 1 };
    let maxStep = 0;
    let worstMs = 0;
    let lastT = -1;
    const end = full.duration + 3;
    for (let f = 0; f < end * 30; f++) {
      wall = (f * 1000) / 30;
      const media = f / 30; // the element plays straight through (silence included)
      if (media >= 41 && tl.map !== full) {
        tl.map = full;
        tl.revision++;
      }
      clock.update(media, true);
      expect(dog.check({ now: wall, wantPlay: true, time: media, ended: false, duration: full.duration })).toBe('none');
      const t = clock.time();
      expect(t).toBeGreaterThanOrEqual(lastT);
      lastT = t;
      const a = performance.now();
      c.update(tl, 'switch-gap', 'sweaty', t);
      duo.sync(c.plan, 'sweaty', 'switch-gap');
      c.evaluate(t, pose, c.sectionAt(t).energy);
      c.upcoming(t);
      solveSkeleton(pose, sk);
      worstMs = Math.max(worstMs, performance.now() - a);
      for (let i = 0; i < pose.length; i++) expect(Number.isFinite(pose[i])).toBe(true);
      if (f > 0) for (let j = 0; j < J.HEAD_UP * 3; j += 3) maxStep = Math.max(maxStep, Math.hypot(sk.p[j] - prev[j], sk.p[j + 1] - prev[j + 1], sk.p[j + 2] - prev[j + 2]));
      prev.set(sk.p);
    }
    expect(c.plan!.liveFrom).toBe(Infinity); // the full map took over
    // 30 fps steps at up to 150 BPM (the continuity bound of the other conductor tests, per 1/60 s, doubled).
    expect(maxStep).toBeLessThan(2 * 0.095 * (150 / 100));
    // Generous: building a plan is the slowest frame (a few ms here; the TV is ~10x slower).
    expect(worstMs).toBeLessThan(250);
  });
});
