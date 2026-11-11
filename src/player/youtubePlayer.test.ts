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
  /** loadVideoById does nothing at all (no state events ever). */
  silent?: boolean;
  /**
   * Prerolls as real Chrome reports them (2026-11): state stays UNSTARTED
   * while getCurrentTime() climbs through each ad (ms lengths here) and
   * resets to 0 for the next one; video_id and duration already report the
   * song. Then BUFFERING, then PLAYING from 0.
   */
  realAds?: number[];
  /** The first N players created get stuck in BUFFERING at 0 with no duration. */
  stuckPlayers?: number;
}

/** How many fake players have been created (fresh-player checks). */
let created = 0;

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
  private realAds: number[] = [];
  private realAdT = 0;
  private bufferLeft = 0;
  readonly stuck: boolean;
  destroyed = false;
  events: YTPlayerOptions['events'] = {};

  constructor(private script: Script) {
    created++;
    this.stuck = created <= (script.stuckPlayers ?? 0);
    setInterval(() => this.tick(50), 50);
  }
  private emitState(s: number) {
    this.state = s;
    this.events?.onStateChange?.({ target: this as never, data: s } as YTEvent<number>);
  }
  private tick(ms: number) {
    if (!this.playing || this.destroyed) return;
    if (this.realAds.length > 0) {
      if (!this.muted) this.heardAd = true;
      this.realAdT += ms;
      this.t = this.realAdT / 1000;
      if (this.realAdT >= this.realAds[0]) {
        this.realAds.shift();
        this.realAdT = 0;
        this.t = 0;
        if (this.realAds.length === 0) {
          this.bufferLeft = 400;
          this.emitState(S.BUFFERING);
        }
      }
      return;
    }
    if (this.bufferLeft > 0) {
      this.bufferLeft -= ms;
      if (this.bufferLeft <= 0) this.emitState(S.PLAYING);
      return;
    }
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
  /** Test hook: start an ad in the middle of playback. */
  midroll(ms: number) {
    this.adLeft = ms;
  }
  loadVideoById({ videoId }: { videoId: string }) {
    if (this.script.silent) return;
    this.target = videoId;
    this.t = 0;
    this.vid = '';
    if (this.stuck) {
      this.vid = videoId;
      this.emitState(S.UNSTARTED);
      this.emitState(S.BUFFERING);
      return;
    }
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
    if (this.script.realAds?.length) {
      this.realAds = [...this.script.realAds];
      this.realAdT = 0;
      this.vid = this.target; // real prerolls already report the song's ID
      this.emitState(S.UNSTARTED);
      return;
    }
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
    return this.stuck ? 0 : (this.script.duration ?? 200);
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
  destroy() {
    this.destroyed = true;
  }
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

  it('real preroll pattern (UNSTARTED with advancing time, x2): reports the ad, never "not responding"', async () => {
    script = { realAds: [15000, 15500], duration: 200 };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    let done = false;
    void p.load(ITEM).then(() => (done = true));
    await run(3000);
    expect(statuses).toEqual(['loading', 'ad']);
    expect(p.loadingDetail()).toMatch(/^Ad playing: \d+ s so far$/);
    await run(14000); // into the second ad: time reset to 0 without a seek
    expect(done).toBe(false);
    expect(p.loadingDetail()).toMatch(/^Ad 2: ads for \d+ s so far$/);
    await run(14000); // 31 s in: past the 30 s "slow" budget, still in ads
    expect(done).toBe(false);
    expect(statuses).not.toContain('slow');
    await run(4000); // ads over: BUFFERING, then PLAYING from 0, confirmed
    expect(done).toBe(true);
    expect(statuses).toEqual(['loading', 'ad']);
    expect(fake.heardAd).toBe(false);
    expect(fake.muted).toBe(false);
    expect(fake.t).toBe(0);
    expect(fake.state).toBe(S.PAUSED);
    p.destroy();
  });

  it('after 90 s of ads says "still in ads" (skip offered), still no "slow", then starts', async () => {
    script = { realAds: [50000, 50000] };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    let done = false;
    void p.load(ITEM).then(() => (done = true));
    await run(80000);
    expect(statuses).toEqual(['loading', 'ad']);
    await run(15000);
    expect(statuses).toEqual(['loading', 'ad', 'ad-long']);
    expect(done).toBe(false);
    await run(10000);
    expect(done).toBe(true);
    expect(statuses).not.toContain('slow');
    p.destroy();
  });

  it('a true stall (no state change, no time movement) still gets "slow" after 30 s', async () => {
    script = { adMs: 120000, adState: S.BUFFERING };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    void p.load(ITEM).catch(() => {});
    await run(28000);
    expect(statuses).not.toContain('slow');
    await run(4000);
    expect(statuses).toContain('slow');
    p.destroy();
  });

  it('stuck in BUFFERING with no duration: retries once with a brand-new player, which plays', async () => {
    created = 0;
    script = { stuckPlayers: 1 };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    let done = false;
    void p.load(ITEM).then(() => (done = true));
    await run(9000);
    expect(created).toBe(1);
    await run(5000);
    expect(created).toBe(2);
    expect(done).toBe(true);
    expect(statuses).not.toContain('slow');
    p.destroy();
  });

  it('stuck again after the retry: offers the escape options ~30 s after the start', async () => {
    created = 0;
    script = { stuckPlayers: 5 };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    void p.load(ITEM).catch(() => {});
    await run(28000);
    expect(statuses).not.toContain('slow');
    await run(5000);
    expect(statuses).toContain('slow');
    expect(created).toBe(2); // exactly one retry
    p.destroy();
  });

  it('every load() gets a brand-new IFrame player and destroys the old one', async () => {
    created = 0;
    script = {};
    const p = new YouTubePlayer();
    await Promise.all([p.load(ITEM), run(3000)]);
    const first = fake;
    await Promise.all([p.load({ ...ITEM, videoId: 'zyxwvutsrqp' }), run(3000)]);
    expect(created).toBe(2);
    expect(first.destroyed).toBe(true);
    expect(fake).not.toBe(first);
    p.destroy();
    expect(fake.destroyed).toBe(true);
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

  it('after play(): reports a mid-song ad, freezes the clock, and clears it when the song moves again', async () => {
    script = {};
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    void p.load(ITEM);
    await run(3000);
    p.play();
    await run(2000);
    expect(p.isPlaying()).toBe(true);
    fake.midroll(8000);
    await run(1000);
    const frozenAt = p.time();
    await run(3000);
    expect(statuses).toContain('ad');
    expect(p.isPlaying()).toBe(false);
    expect(p.time()).toBeLessThanOrEqual(frozenAt + 0.01);
    await run(6000);
    expect(statuses[statuses.length - 1]).toBe('playing');
    expect(p.isPlaying()).toBe(true);
    p.destroy();
  });

  it('asks for a press (with retry/skip in the UI) within ~6 s when the player never reacts', async () => {
    script = { silent: true };
    const p = new YouTubePlayer();
    const statuses: string[] = [];
    p.onStatus = (s) => statuses.push(s);
    void p.load(ITEM).catch(() => {});
    await run(7000);
    expect(statuses).toContain('needs-gesture');
    p.destroy();
  });
});
