/**
 * Songs whose request GitHub dropped (cancelled for a newer request, a job that failed before
 * adding it, a job that finished without it) are sent again by the app itself, a few times at most.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { songKey, type SongRequestStatus } from '../beat/cloud';
import { addRunOk, addRunUpdateFailed } from '../platform/pipelineHealth.fixtures';
import type { RunSummary } from '../platform/pipelineHealth';
import { store, type PendingAdd } from '../store';
import {
  AddedSongs,
  AUTO_BACKOFF_MS,
  AUTO_JITTER_MS,
  AUTO_RESEND_CAP,
  AUTO_RETRY_MS,
  autoFailure,
  autoJitter,
  autoResendAt,
  reconcile,
  type AutoSendResult,
  type CloudFacts,
} from './addedSongs';

const MIN = 60_000;
const SENT = Date.parse('2026-11-20T20:00:00Z');
const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z');
const pend = (o: Partial<PendingAdd> = {}): PendingAdd => ({ key: songKey('ABBA', 'Waterloo'), artist: 'ABBA', title: 'Waterloo', durationSec: 200, trackId: 1422648512, sentAt: SENT, ...o });
const run = (o: Partial<RunSummary> & { at: number; end?: number }): RunSummary => ({
  id: o.id ?? 900,
  workflow: 'beatmaps',
  kind: 'add',
  status: o.status ?? 'completed',
  conclusion: o.conclusion === undefined ? 'cancelled' : o.conclusion,
  createdAt: iso(o.at),
  startedAt: iso(o.at),
  updatedAt: iso(o.end ?? o.at + 30_000),
});
/** My request's run, cancelled 3 min after it was sent (another request took its waiting place). */
const cancelled = run({ at: SENT + 2_000, end: SENT + 3 * MIN });
const facts = (runs: RunSummary[] | null, o: Partial<CloudFacts> = {}): CloudFacts => ({
  runs,
  repoSongs: [],
  inRepoSince: {},
  runsAt: SENT + 4 * MIN,
  auto: { stopped: {} },
  ...o,
});
const view = (p: PendingAdd, now: number, f: CloudFacts, status: Record<string, SongRequestStatus> = {}) => reconcile([p], [], status, now, f).views[0];

describe('dropped requests: which ones', () => {
  const now = SENT + 4 * MIN;

  it('my run cancelled, nothing since still going: sent again by itself', () => {
    const v = view(pend(), now, facts([cancelled]));
    expect(v).toMatchObject({ state: 'retrying', dropped: 'cancelled' });
    expect(v.message).toBe('GitHub dropped this request because another song was sent at about the same time. It’s sent again by itself in a few minutes.');
    expect(v.autoAt).toBe(SENT + 3 * MIN + AUTO_BACKOFF_MS[0] + autoJitter(pend(), 0));
  });

  it('a later run is still going (it may be one this browser sent, carrying the song): not dropped', () => {
    for (const status of ['queued', 'in_progress'] as const) {
      const later = run({ id: 901, at: SENT + 2.5 * MIN, status, conclusion: null });
      const v = view(pend(), now, facts([cancelled, later]));
      expect(v.state).toBe('waiting');
      expect(v.dropped).toBeUndefined();
      expect(v.autoAt).toBeUndefined();
    }
  });

  it('a job that failed before adding it, or finished well without it (and without an answer)', () => {
    const failedRun = addRunUpdateFailed(); // created 22:40, failed 22:45
    const p = pend({ sentAt: Date.parse('2026-11-14T22:39:50Z') });
    const f = facts([failedRun], { runsAt: Date.parse('2026-11-14T22:46:00Z') });
    expect(view(p, Date.parse('2026-11-14T22:46:00Z'), f)).toMatchObject({ state: 'retrying', dropped: 'failed', message: expect.stringMatching(/^The song job failed before it could add this song\. It’s sent again/) });

    const ok = addRunOk(); // created 22:30, finished 22:37
    const q = pend({ sentAt: Date.parse('2026-11-14T22:29:00Z') });
    const g = facts([ok], { runsAt: Date.parse('2026-11-14T22:30:00Z') });
    // Within 6 min of the end the repository's files may still be cached: not yet.
    expect(view(q, Date.parse('2026-11-14T22:41:00Z'), g).dropped).toBeUndefined();
    const v = view(q, Date.parse('2026-11-14T22:44:00Z'), g);
    expect(v).toMatchObject({ state: 'retrying', dropped: 'finished' });
    expect(v.autoAt).toBe(Date.parse('2026-11-14T22:43:00Z') + AUTO_BACKOFF_MS[0] + autoJitter(q, 0));
  });

  it('never for a song the job answered: not found, video mismatch, or one it retries itself', () => {
    const st = (state: SongRequestStatus['state'], extra: Partial<SongRequestStatus> = {}) => ({
      [pend().key]: { state, artist: 'ABBA', title: 'Waterloo', attempts: 1, lastTried: iso(SENT + 2 * MIN), ...extra },
    });
    const f = facts([cancelled]);
    expect(view(pend(), now, f, st('not-found'))).toMatchObject({ state: 'failed', canPaste: true });
    expect(view(pend(), now, f, st('video-mismatch', { videoId: 'Xl8j9GLEdcE' }))).toMatchObject({ state: 'check' });
    for (const s of ['blocked', 'error'] as const) {
      const v = view(pend(), now, f, st(s));
      expect(v.state).toBe('retrying');
      expect(v.message).toMatch(/tries again by itself within a few hours/);
    }
    for (const s of ['not-found', 'video-mismatch', 'blocked', 'error'] as const) {
      const v = view(pend(), now, f, st(s, { videoId: 'Xl8j9GLEdcE' }));
      expect(v.autoAt, s).toBeUndefined();
      expect(v.dropped, s).toBeUndefined();
    }
  });

  it('not while unsure: repository unread, runs unknown, or a runs list from before the send settled', () => {
    expect(view(pend(), now, facts([cancelled], { repoSongs: null })).autoAt).toBeUndefined();
    expect(view(pend(), now, facts(null)).autoAt).toBeUndefined();
    expect(view(pend(), now, facts([cancelled], { runsAt: SENT + 30_000 })).autoAt).toBeUndefined();
    // Already committed (in the repository's songs.json): not dropped, whatever the run says.
    const committed = view(pend(), now, facts([cancelled], { repoSongs: [{ videoId: 'Xl8j9GLEdcE', artist: 'ABBA', title: 'Waterloo', addedAt: '', durationSec: 200 }] }));
    expect(committed.dropped).toBeUndefined();
  });

  it('without an automatic sender (or after the cap) it is today’s manual "Send it again"', () => {
    const manual = view(pend(), now, facts([cancelled], { auto: undefined }));
    expect(manual).toMatchObject({ state: 'slow', dropped: 'cancelled', message: 'GitHub dropped this request because another song was sent at about the same time. Send it again to retry.' });
    expect(manual.autoAt).toBeUndefined();
    const capped = view(pend({ autoResends: AUTO_RESEND_CAP }), now, facts([cancelled]));
    expect(capped).toMatchObject({ state: 'slow', message: manual.message });
    expect(capped.autoAt).toBeUndefined();
    const failedRun = addRunUpdateFailed();
    const jobCapped = view(pend({ sentAt: Date.parse('2026-11-14T22:39:50Z'), autoResends: AUTO_RESEND_CAP }), Date.parse('2026-11-14T22:46:00Z'), facts([failedRun], { runsAt: Date.parse('2026-11-14T22:46:00Z') }));
    expect(jobCapped).toMatchObject({ state: 'failed', message: 'The song job failed before it could add this song. Options → Songs says why.' });
  });

  it('the relay’s daily limit, or an answer the person must act on, stops it with that message', () => {
    expect(view(pend({ autoStop: 'daily-limit' }), now, facts([cancelled]))).toMatchObject({
      state: 'slow',
      message: 'The relay has added as many songs as it allows today. Try again tomorrow.',
    });
    const msg = 'The relay needs its passphrase. Type it once and this browser remembers it.';
    expect(view(pend(), now, facts([cancelled], { auto: { stopped: { [pend().key]: msg } } }))).toMatchObject({ state: 'slow', message: msg });
  });
});

describe('autoResendAt: cap, backoff and jitter', () => {
  it('waits 2, 5, then 10 min (plus up to a minute) after the drop, then stops', () => {
    const at = (n: number) => autoResendAt(pend({ autoResends: n || undefined }), SENT + 3 * MIN);
    for (let n = 0; n < AUTO_RESEND_CAP; n++) {
      const wait = at(n)! - (SENT + 3 * MIN);
      expect(wait).toBeGreaterThanOrEqual(AUTO_BACKOFF_MS[n]);
      expect(wait).toBeLessThan(AUTO_BACKOFF_MS[n] + AUTO_JITTER_MS);
    }
    expect(AUTO_BACKOFF_MS[0]).toBeGreaterThan(90_000); // clear of matchRun's 90 s window
    expect(at(AUTO_RESEND_CAP)).toBeNull();
    expect(autoResendAt(pend({ autoStop: 'daily-limit' }), SENT)).toBeNull();
  });
  it('a try that never got through waits before the next one', () => {
    const tried = SENT + 10 * MIN;
    expect(autoResendAt(pend({ autoTriedAt: tried }), SENT + 3 * MIN)).toBe(tried + AUTO_RETRY_MS);
  });
  it('jitter differs between browsers (their own send times) and attempts, and is stable', () => {
    const a = autoJitter(pend(), 0);
    expect(autoJitter(pend(), 0)).toBe(a);
    const others = [1, 2, 3, 517, 9_001].map((d) => autoJitter(pend({ sentAt: SENT + d }), 0));
    expect(new Set([a, ...others]).size).toBeGreaterThan(3);
    for (const j of others) expect(j >= 0 && j < AUTO_JITTER_MS).toBe(true);
  });
  it('sorts send failures', () => {
    expect(autoFailure('network')).toBe('later');
    expect(autoFailure('daily-limit')).toBe('daily-limit');
    for (const e of ['lookup-failed', 'server', 'rate-limit']) expect(autoFailure(e)).toBe('count');
    for (const e of ['passphrase', 'not-connected', 'old-relay', 'bad-request', 'not-found', 'github', 'auth', 'no-track']) expect(autoFailure(e)).toBe('stop');
  });
});

describe('pending adds keep the automatic-resend bookkeeping', () => {
  afterEach(() => store.setPendingAdds([]));
  it('round-trips, and drops odd values', () => {
    store.setPendingAdds([pend({ autoResends: 2, autoTriedAt: SENT + MIN, autoStop: 'daily-limit', videoId: 'Xl8j9GLEdcE', force: true })]);
    expect(store.pendingAdds()[0]).toMatchObject({ autoResends: 2, autoTriedAt: SENT + MIN, autoStop: 'daily-limit', videoId: 'Xl8j9GLEdcE', force: true });
    store.setPendingAdds([{ ...pend(), autoResends: 1.5, autoTriedAt: 'soon', autoStop: 'forever' } as unknown as PendingAdd]);
    const p = store.pendingAdds()[0];
    expect(p).not.toHaveProperty('autoResends');
    expect(p).not.toHaveProperty('autoTriedAt');
    expect(p).not.toHaveProperty('autoStop');
  });
});

describe('AddedSongs sends a dropped song again by itself', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(SENT + 4 * MIN);
    store.setPendingAdds([]);
  });
  afterEach(() => {
    vi.useRealTimers();
    store.setPendingAdds([]);
  });

  /** A model whose site fetches fail (nothing published), with the cancelled run as the cloud's facts. */
  function setup(p: PendingAdd, send: (p: PendingAdd, m: AddedSongs) => Promise<AutoSendResult>) {
    const m = new AddedSongs(async () => ({ ok: false, text: async () => '' }));
    const calls: PendingAdd[] = [];
    m.setAutoSend(async (x) => {
      calls.push(x);
      return send(x, m);
    });
    store.setPendingAdds([p]);
    m.start('https://jo.github.io/dd/');
    m.setCloudFacts({ runs: [cancelled], runsAt: Date.now(), repoSongs: [], repoRequests: {} });
    return { m, calls };
  }
  const untilDue = async () => {
    await vi.advanceTimersByTimeAsync(AUTO_BACKOFF_MS[0] + AUTO_JITTER_MS + 11_000);
  };

  it('once, with the same choice, and the count survives (persisted with the pending add)', async () => {
    const p = pend({ videoId: 'Xl8j9GLEdcE', force: true });
    const { m, calls } = setup(p, async (x, model) => {
      model.addPending({ ...x, autoResends: (x.autoResends ?? 0) + 1, autoTriedAt: undefined, sentAt: Date.now() });
      return { ok: true };
    });
    expect(m.pending()[0]).toMatchObject({ state: 'retrying', dropped: 'cancelled' });
    await vi.advanceTimersByTimeAsync(AUTO_BACKOFF_MS[0] - 60_000);
    expect(calls).toHaveLength(0); // not before the backoff
    await untilDue();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ key: p.key, videoId: 'Xl8j9GLEdcE', force: true, sentAt: SENT });
    expect(store.pendingAdds()[0]).toMatchObject({ autoResends: 1, videoId: 'Xl8j9GLEdcE', force: true });
    // The new request is waiting now (its run not listed yet): nothing else is sent.
    expect(m.pending()[0].state).toBe('waiting');
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(calls).toHaveLength(1);
  });

  it('a request that never left is tried again later without counting; the daily limit stops it', async () => {
    let answer: AutoSendResult = { ok: false, error: 'network', message: 'Couldn’t reach the relay.' };
    const { m, calls } = setup(pend(), async () => answer);
    await untilDue();
    expect(calls).toHaveLength(1);
    expect(store.pendingAdds()[0].autoResends).toBeUndefined();
    expect(store.pendingAdds()[0].autoTriedAt).toBeGreaterThan(SENT);
    expect(m.pending()[0].state).toBe('retrying');
    answer = { ok: false, error: 'daily-limit', message: 'The relay has added as many songs as it allows today. Try again tomorrow.' };
    await vi.advanceTimersByTimeAsync(AUTO_RETRY_MS + 11_000);
    expect(calls).toHaveLength(2);
    expect(store.pendingAdds()[0].autoStop).toBe('daily-limit');
    expect(m.pending()[0]).toMatchObject({ state: 'slow', message: answer.message });
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(calls).toHaveLength(2); // no hammering
  });

  it('counted failures stop at the cap, then the manual message', async () => {
    const { m, calls } = setup(pend(), async () => ({ ok: false, error: 'server', message: 'The relay had a problem.' }));
    await vi.advanceTimersByTimeAsync(40 * MIN);
    expect(calls).toHaveLength(AUTO_RESEND_CAP);
    expect(store.pendingAdds()[0].autoResends).toBe(AUTO_RESEND_CAP);
    expect(m.pending()[0]).toMatchObject({ state: 'slow', message: expect.stringMatching(/Send it again to retry\.$/) });
  });

  it('an answer the person must act on stops it for the session, with that answer', async () => {
    const msg = 'The relay needs its passphrase. Type it once and this browser remembers it.';
    const { m, calls } = setup(pend(), async () => ({ ok: false, error: 'passphrase', message: msg }));
    await vi.advanceTimersByTimeAsync(40 * MIN);
    expect(calls).toHaveLength(1);
    expect(m.pending()[0]).toMatchObject({ state: 'slow', message: msg });
  });

  it('another tab already trying it: this one doesn’t', async () => {
    const { calls } = setup(pend(), async () => ({ ok: true }));
    store.setPendingAdds([{ ...store.pendingAdds()[0], autoTriedAt: Date.now() + AUTO_BACKOFF_MS[0] + 30_000 }]);
    await vi.advanceTimersByTimeAsync(AUTO_BACKOFF_MS[0] + AUTO_JITTER_MS + 11_000);
    expect(calls).toHaveLength(0);
  });
});

describe('the automatic resend goes the way "Send again" does', () => {
  const posts: { url: string; body: unknown }[] = [];
  beforeEach(() => {
    posts.length = 0;
    vi.stubEnv('VITE_ADD_SONG_URL', 'https://relay.test');
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url === 'https://relay.test/health') return new Response(JSON.stringify({ ok: true, repo: 'jo/dd', passphrase: false, version: 3 }));
      if (url === 'https://relay.test/add') {
        const body = JSON.parse(String(init?.body)) as { trackId: number; song: { artist: string; title: string; durationSec: number } };
        posts.push({ url, body });
        return new Response(JSON.stringify({ ok: true, source: 'apple', video: (body as { video?: string }).video, song: { ...body.song, trackId: body.trackId, artworkUrl: '' } }));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    store.setPendingAdds([]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    store.setPendingAdds([]);
  });

  it('the same song with the pasted link, this browser’s other waiting songs, one more counted', async () => {
    const { autoResend, resendRequest } = await import('./githubConnect');
    const { addedSongs } = await import('./addedSongs');
    const p = pend({ videoId: 'Xl8j9GLEdcE', force: true, autoResends: 1, autoTriedAt: SENT + 9 * MIN, artworkUrl: 'https://x.test/a.jpg' });
    const other = { key: songKey('a-ha', 'Take On Me'), artist: 'a-ha', title: 'Take On Me', durationSec: 225, trackId: 1, sentAt: SENT + MIN };
    expect(resendRequest(p, 'same')).toEqual({ key: p.key, artist: 'ABBA', title: 'Waterloo', durationSec: 200, artworkUrl: 'https://x.test/a.jpg', trackId: 1422648512, videoId: 'Xl8j9GLEdcE', force: true });
    expect(resendRequest(p, 'search')).not.toHaveProperty('videoId');
    store.setPendingAdds([p, other]);
    addedSongs.setCloudFacts({ runs: null, repoSongs: null, repoRequests: null }); // both shown as waiting: the other rides along
    const res = await autoResend(p);
    expect(res).toEqual({ ok: true, key: p.key });
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({
      trackId: 1422648512,
      song: { artist: 'ABBA', title: 'Waterloo', durationSec: 200 },
      video: 'Xl8j9GLEdcE',
      force: true,
      queue: [{ trackId: 1, song: { artist: 'a-ha', title: 'Take On Me', durationSec: 225 } }],
    });
    const stored = store.pendingAdds().find((x) => x.key === p.key)!;
    expect(stored).toMatchObject({ autoResends: 2, videoId: 'Xl8j9GLEdcE', force: true });
    expect(stored.sentAt).toBeGreaterThan(SENT);
    expect(stored).not.toHaveProperty('autoTriedAt');
  });
});
