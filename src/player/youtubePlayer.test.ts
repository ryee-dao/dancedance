/**
 * State-machine tests for YouTubePlayer's start sequence against a scripted
 * fake of the IFrame API (no network, fake timers).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YTEvent, YTPlayerOptions } from './ytApi';

const S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

interface Script {
  /** Preroll ad length in ms (0 = none). */
  adMs?: number;
  /** What getVideoData().video_id reports during the ad. */
  adVideoId?: string;
  /** Player state reported during the ad. */
  adState?: number;
  /** Browser refuses to start until playVideo() is called by the user. */
  autoplayBlocked?: boolean;
  /** Fire this error code shortly after loading. */
  errorCode?: number;
  /** Content duration in seconds. */
  duration?: number;
}

/** Scripted stand-in for YT.Player. Time advances via a 50 ms interval. */
class FakeYT {
  state = S.UNSTARTED;
  t = 0;
  vid = '';
  muted = false;
  /** True if any content time elapsed while unmuted before play() was intended. */
  heardAd = false;
  private target = '';
  private adLeft = 0;
  private playing = false;
  events: YTPlayerOptions['events'] = {};

  constructor(private script: Script) {
    setInterval(() => this.tick(50), 50);
  }
  private emitState(s: number) {
    this.state = s;
    this.events?.onStateChange?.({ target: this as never, data: s } as YTEvent<number>);
  }
  private tick(ms: number) {
    if (!this.playing) return;
    if (this.adLeft > 0) {
      this.adLeft -= ms;
      if (!this.muted) this.heardAd = true;
      if (this.adLeft <= 0) {
        this.vid = this.target;
        this.emitState(S.PLAYING);
      }
      return;
    }
    this.t += ms / 1000;
    const d = this.script.duration ?? 200;
    if (this.t >= d) {
      this.t = d;
      this.playing = false;
      this.emitState(S.ENDED);
    }
  }
  mute() {
    this.muted = true;
  }
  unMute() {
    this.muted = false;
  }
  isMuted() {
    return this.muted;
  }
  loadVideoById({ videoId }: { videoId: string }) {
    this.target = videoId;
    this.t = 0;
    this.vid = '';
    if (this.script.errorCode) {
      setTimeout(() => this.events?.onError?.({ target: this as never, data: this.script.errorCode! }), 300);
      return;
    }
    if (this.script.autoplayBlocked) {
      this.emitState(S.CUED);
      return;
    }
    this.start();
  }
  private start() {
    this.adLeft = this.script.adMs ?? 0;
    this.playing = true;
    if (this.adLeft > 0) {
      this.vid = this.script.adVideoId ?? '';
      this.emitState(this.script.adState ?? S.PLAYING);
    } else {
      this.vid = this.target;
      this.emitState(S.PLAYING);
    }
  }
  playVideo() {
    if (this.state === S.CUED || this.state === S.UNSTARTED) {
      this.script.autoplayBlocked = false;
      this.start();
      return;
    }
    this.playing = true;
    this.emitState(S.PLAYING);
  }
  pauseVideo() {
    this.playing = false;
    this.emitState(S.PAUSED);
  }
  seekTo(s: number) {
    this.t = s;
  }
  getPlayerState() {
    return this.state;
  }
  getCurrentTime() {
    return this.adLeft > 0 ? 0 : this.t;
  }
  getDuration() {
    return this.script.duration ?? 200;
  }
  getVideoData() {
    return { video_id: this.vid };
  }
  getPlaylist() {
    return null;
  }
  cuePlaylist() {}
  stopVideo() {}
  getIframe() {
    return null as never;
  }
  destroy() {}
}

let fake: FakeYT;
let script: Script = {};

vi.mock('./ytApi', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./ytApi')>();
  return {
    ...orig,
    createYTPlayer: async (events: YTPlayerOptions['events']) => {
      fake = new FakeYT(script);
      fake.events = events;
      return { player: fake, el: { remove() {} } };
    },
  };
});

const { YouTubePlayer } = await import('./youtubePlayer');
const { PlayerError } = await import('./types');

const ITEM = { kind: 'youtube' as const, videoId: 'abcdefghijk', title: 'Test' };

async function run(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('YouTubePlayer start sequence', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('without an ad: resolves paused at 0, unmuted, after confirming playback', async () => {
    script = {};
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    let done = false;
    void p.load(ITEM).then(() => (done = true));
    await run(600);
    expect(done).toBe(false); // needs ~1 s of advancing time first
    expect(fake.muted).toBe(true);
    await run(2000);
    expect(done).toBe(true);
    expect(fake.state).toBe(S.PAUSED);
    expect(fake.t).toBe(0);
    expect(fake.muted).toBe(false);
    expect(statuses).toEqual(['loading']);
    p.destroy();
  });

  it('waits out a muted preroll ad and reports it', async () => {
    script = { adMs: 15000, adVideoId: 'AD_VIDEO_01' };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    let done = false;
    void p.load(ITEM).then(() => (done = true));
    await run(10000);
    expect(done).toBe(false);
    expect(statuses).toContain('ad');
    await run(8000);
    expect(done).toBe(true);
    expect(fake.heardAd).toBe(false); // muted for the entire ad
    expect(fake.muted).toBe(false);
    expect(fake.t).toBe(0);
    p.destroy();
  });

  it('is not fooled by an ad that reports our own video ID', async () => {
    script = { adMs: 8000, adVideoId: ITEM.videoId };
    const p = new YouTubePlayer();
    let done = false;
    void p.load(ITEM).then(() => (done = true));
    await run(7000);
    expect(done).toBe(false); // content time stays at 0 during the ad
    await run(4000);
    expect(done).toBe(true);
    expect(fake.heardAd).toBe(false);
    p.destroy();
  });

  it('asks for a press when autoplay is blocked, then continues after play()', async () => {
    script = { autoplayBlocked: true };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    let done = false;
    void p.load(ITEM).then(() => (done = true));
    await run(7000);
    expect(statuses).toContain('needs-gesture');
    expect(done).toBe(false);
    p.play(); // user pressed OK
    await run(2500);
    expect(done).toBe(true);
    expect(fake.muted).toBe(false);
    p.destroy();
  });

  it('reports slow after the timeout but keeps waiting', async () => {
    script = { adMs: 120000 };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    void p.load(ITEM).catch(() => {});
    await run(46000);
    expect(statuses).toContain('slow');
    p.destroy();
  });

  it('rejects load() with an embed-blocked error for 150', async () => {
    script = { errorCode: 150 };
    const p = new YouTubePlayer();
    const result = p.load(ITEM).then(
      () => null,
      (e: unknown) => e,
    );
    await run(1000);
    const err = await result;
    expect(err).toBeInstanceOf(PlayerError);
    expect((err as InstanceType<typeof PlayerError>).embedBlocked).toBe(true);
    p.destroy();
  });

  it('plays, advances a smooth clock, pauses, and fires onEnded', async () => {
    script = { duration: 5 };
    const p = new YouTubePlayer();
    let ended = false;
    p.onEnded = () => (ended = true);
    const loaded = p.load(ITEM);
    await run(3000);
    await loaded;
    expect(p.time()).toBe(0);
    expect(p.duration()).toBe(5);
    p.play();
    await run(1000);
    expect(p.isPlaying()).toBe(true);
    expect(p.time()).toBeGreaterThan(0.85);
    expect(p.time()).toBeLessThan(1.15);
    p.pause();
    const t = p.time();
    await run(1000);
    expect(p.time()).toBeCloseTo(t, 5);
    p.play();
    await run(5000);
    expect(ended).toBe(true);
    p.destroy();
  });

  it('a second load() cancels the first', async () => {
    script = {};
    const p = new YouTubePlayer();
    const first = p.load(ITEM).then(
      () => 'resolved',
      (e: InstanceType<typeof PlayerError>) => e.code,
    );
    await run(100);
    const second = p.load({ ...ITEM, videoId: 'zyxwvutsrqp' });
    await run(3000);
    expect(await first).toBe('cancelled');
    await expect(second).resolves.toBeUndefined();
    p.destroy();
  });
});
