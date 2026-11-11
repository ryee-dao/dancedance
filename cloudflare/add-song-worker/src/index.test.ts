import { describe, expect, it } from 'vitest';
import { handle, PROBE_TRACK_ID, safeEqual, type Env } from './index';

const TOKEN = 'github_pat_SECRET_TOKEN_never_in_responses_0123456789';
const ORIGIN = 'https://jo.github.io';
const env: Env = { GITHUB_TOKEN: TOKEN, GITHUB_REPO: 'jo/dancedance', ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:5173/` };
const NOW = () => new Date('2026-11-10T12:00:00.000Z');

const TRACK = { wrapperType: 'track', kind: 'song', trackId: 1440936016, artistName: 'Taylor Swift', trackName: 'Shake It Off', trackTimeMillis: 219209, artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg' };
const QUEUED = { wrapperType: 'track', kind: 'song', trackId: 7, artistName: 'ABBA', trackName: 'Waterloo', trackTimeMillis: 165000 };

interface Call {
  url: string;
  init?: RequestInit;
}

type AppleReply = { status?: number; body?: unknown; hang?: boolean; throws?: boolean };

/** Upstream fake: iTunes lookup (one reply per attempt, the last repeats), GitHub run count, GitHub dispatch. */
function upstream(
  o: { lookup?: unknown; lookupStatus?: number; apple?: AppleReply[]; count?: number; countStatus?: number; dispatchStatus?: number; dispatchBody?: string } = {},
) {
  const calls: Call[] = [];
  let appleCalls = 0;
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (url.startsWith('https://itunes.apple.com/lookup')) {
      const replies = o.apple ?? [{ status: o.lookupStatus, body: o.lookup }];
      const r = replies[Math.min(appleCalls++, replies.length - 1)];
      if (r.throws) throw new TypeError('network connection lost');
      if (r.hang) {
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
      }
      const body = r.body ?? { resultCount: 2, results: [TRACK, QUEUED] };
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: r.status ?? 200 });
    }
    if (url.includes('/runs?')) return new Response(JSON.stringify({ total_count: o.count ?? 3 }), { status: o.countStatus ?? 200 });
    if (url.endsWith('/dispatches')) return new Response(o.dispatchBody ?? null, { status: o.dispatchStatus ?? 204 });
    throw new Error(`unexpected ${url}`);
  };
  return Object.assign(fn, { calls });
}

function add(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://relay.example.workers.dev/add', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function read(res: Response) {
  const text = await res.text();
  expect(text).not.toContain(TOKEN);
  return { status: res.status, body: JSON.parse(text), cors: res.headers.get('Access-Control-Allow-Origin') };
}

describe('add-song relay', () => {
  it('looks the track up on iTunes and dispatches with Apple’s names and length', async () => {
    const f = upstream();
    const r = await read(await handle(add({ trackId: 1440936016, queue: [7, 7, 'x', 1440936016] }), env, f, NOW));
    expect(r).toEqual({
      status: 200,
      cors: ORIGIN,
      body: {
        ok: true,
        source: 'apple',
        song: { trackId: 1440936016, artist: 'Taylor Swift', title: 'Shake It Off', durationSec: 219, artworkUrl: 'https://is1-ssl.mzstatic.com/a/300x300bb.jpg' },
      },
    });
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://itunes.apple.com/lookup?id=1440936016,7&entity=song',
      'https://api.github.com/repos/jo/dancedance/actions/workflows/beatmaps.yml/runs?event=workflow_dispatch&per_page=100&created=%3E%3D2026-11-09T12%3A00%3A00Z',
      'https://api.github.com/repos/jo/dancedance/actions/workflows/beatmaps.yml/dispatches',
    ]);
    const appleHeaders = f.calls[0].init?.headers as Record<string, string>;
    expect(appleHeaders.Authorization).toBeUndefined(); // token never goes to Apple
    expect(appleHeaders.Accept).toBe('application/json');
    expect(appleHeaders['User-Agent']).toMatch(/^Mozilla\/5\.0/);
    const d = f.calls[2].init!;
    expect(d.method).toBe('POST');
    expect((d.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(d.body as string)).toEqual({
      ref: 'main',
      inputs: { add_artist: 'Taylor Swift', add_title: 'Shake It Off', add_duration: '219', add_queue: '[{"artist":"ABBA","title":"Waterloo","duration":165}]' },
    });
  });

  it('uses Apple’s names whenever Apple answers, ignoring what the caller sends', async () => {
    const f = upstream({ lookup: { results: [TRACK] } });
    const r = await read(
      await handle(add({ trackId: 1440936016, artist: '$(rm -rf /)', song: { artist: 'Fake', title: 'Spoof', durationSec: 30 } }), env, f, NOW),
    );
    expect(r.body).toMatchObject({ ok: true, source: 'apple', song: { artist: 'Taylor Swift', title: 'Shake It Off', durationSec: 219 } });
    expect(r.body.detail).toBeUndefined();
    expect(f.calls[2].init!.body as string).not.toContain('rm -rf');
    expect(f.calls[2].init!.body as string).not.toContain('Spoof');
  });

  it('rejects other origins (and answers their preflight with 403, no CORS headers)', async () => {
    const f = upstream();
    const r = await read(await handle(add({ trackId: 1 }, { Origin: 'https://evil.example' }), env, f, NOW));
    expect(r).toEqual({ status: 403, cors: null, body: { ok: false, error: 'bad-origin' } });
    const noOrigin = new Request('https://relay.example/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"trackId":1}' });
    expect((await read(await handle(noOrigin, env, f, NOW))).body.error).toBe('bad-origin');
    const pre = await handle(new Request('https://relay.example/add', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env, f, NOW);
    expect(pre.status).toBe(403);
    const ok = await handle(new Request('https://relay.example/add', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }), env, f, NOW);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('X-Add-Passphrase');
    expect(f.calls).toEqual([]);
  });

  it('checks method, content type, size and body shape', async () => {
    const f = upstream();
    const get = new Request('https://relay.example/add', { headers: { Origin: ORIGIN } });
    expect((await handle(get, env, f, NOW)).status).toBe(405);
    expect((await read(await handle(add('{"trackId":1}', { 'Content-Type': 'text/plain' }), env, f, NOW))).status).toBe(415);
    expect((await read(await handle(add({ trackId: 1, pad: 'x'.repeat(3000) }), env, f, NOW))).status).toBe(413);
    expect((await read(await handle(add('not json'), env, f, NOW))).body.error).toBe('bad-request');
    expect((await read(await handle(add({ trackId: -4 }), env, f, NOW))).body.error).toBe('bad-request');
    expect(f.calls).toEqual([]);
  });

  it('requires the passphrase when one is set', async () => {
    const e = { ...env, ADD_PASSPHRASE: 'disco ball' };
    const f = upstream();
    expect((await read(await handle(add({ trackId: 1440936016 }), e, f, NOW))).body).toEqual({ ok: false, error: 'passphrase' });
    expect((await read(await handle(add({ trackId: 1440936016 }, { 'X-Add-Passphrase': 'disco bal' }), e, f, NOW))).status).toBe(401);
    expect(f.calls).toEqual([]);
    expect((await read(await handle(add({ trackId: 1440936016 }, { 'X-Add-Passphrase': 'disco ball' }), e, f, NOW))).status).toBe(200);
    expect(safeEqual('a', 'a')).toBe(true);
    expect(safeEqual('a', 'b')).toBe(false);
  });

  it('unknown track or a failed lookup without client details: nothing is dispatched', async () => {
    const none = upstream({ lookup: { resultCount: 0, results: [] } });
    expect((await read(await handle(add({ trackId: 99 }), env, none, NOW))).body).toEqual({ ok: false, error: 'not-found', detail: 'apple-not-listed' });
    const tooLong = upstream({ lookup: { results: [{ ...TRACK, trackTimeMillis: 3_600_000 }] } });
    expect((await read(await handle(add({ trackId: 1440936016 }), env, tooLong, NOW))).body).toEqual({ ok: false, error: 'not-found', detail: 'apple-length' });
    const down = upstream({ lookupStatus: 503 });
    expect(await read(await handle(add({ trackId: 1440936016 }), env, down, NOW))).toMatchObject({
      status: 502,
      body: { ok: false, error: 'lookup-failed', detail: 'apple-503' },
    });
    expect(down.calls.map((c) => c.url)).toEqual([
      'https://itunes.apple.com/lookup?id=1440936016&entity=song',
      'https://itunes.apple.com/lookup?id=1440936016&country=us',
    ]);
    for (const f of [none, tooLong, down]) expect(f.calls.some((c) => c.url.includes('api.github.com'))).toBe(false);
    expect(none.calls).toHaveLength(1); // Apple answered: no retry
  });

  describe('when Apple’s lookup fails', () => {
    const SONG = { artist: 'Taylor Swift', title: 'Shake It Off', durationSec: 219 };
    const FAST = { appleTimeoutMs: 20 };

    it.each<[string, AppleReply, string]>([
      ['403', { status: 403, body: '<html>Forbidden</html>' }, 'apple-403'],
      ['a timeout', { hang: true }, 'apple-timeout'],
      ['non-JSON', { status: 200, body: '<html>Please wait</html>' }, 'apple-bad-json'],
      ['a network error', { throws: true }, 'apple-network'],
      ['a non-lookup JSON answer', { status: 200, body: { error: 'x' } }, 'apple-bad-shape'],
    ])('%s: dispatches with the client’s details (source client, detail %s)', async (_, reply, detail) => {
      const f = upstream({ apple: [reply] });
      const body = {
        trackId: 1440936016,
        song: { artist: '  Taylor Swift ', title: 'Shake It Off', durationSec: 219 },
        queue: [{ trackId: 7, song: { artist: 'ABBA', title: 'Waterloo' } }, 8],
      };
      const r = await read(await handle(add(body), env, f, NOW, FAST));
      expect(r).toEqual({ status: 200, cors: ORIGIN, body: { ok: true, source: 'client', detail, song: { trackId: 1440936016, ...SONG, artworkUrl: '' } } });
      expect(JSON.stringify(r.body)).not.toContain('Forbidden');
      const apple = f.calls.filter((c) => c.url.startsWith('https://itunes.apple.com/'));
      expect(apple.map((c) => c.url)).toEqual([
        'https://itunes.apple.com/lookup?id=1440936016,7,8&entity=song',
        'https://itunes.apple.com/lookup?id=1440936016,7,8&country=us',
      ]);
      const d = f.calls.find((c) => c.url.endsWith('/dispatches'))!;
      // Queued 8 had no details, so it is left for a later run; 7 has no length, so the job looks it up.
      expect(JSON.parse(d.init!.body as string)).toEqual({
        ref: 'main',
        inputs: { add_artist: 'Taylor Swift', add_title: 'Shake It Off', add_duration: '219', add_queue: '[{"artist":"ABBA","title":"Waterloo"}]' },
      });
    });

    it('the retry succeeds: Apple’s data is used', async () => {
      const f = upstream({ apple: [{ status: 403 }, { status: 200, body: { results: [TRACK] } }] });
      const r = await read(await handle(add({ trackId: 1440936016, song: { artist: 'X', title: 'Y' } }), env, f, NOW, FAST));
      expect(r.body).toMatchObject({ ok: true, source: 'apple', song: { artist: 'Taylor Swift', durationSec: 219 } });
      expect(r.body.detail).toBeUndefined();
    });

    it('both attempts fail differently: both are reported', async () => {
      const f = upstream({ apple: [{ status: 403 }, { hang: true }] });
      const r = await read(await handle(add({ trackId: 1440936016 }), env, f, NOW, FAST));
      expect(r.body).toEqual({ ok: false, error: 'lookup-failed', detail: 'apple-403/apple-timeout' });
    });

    it('a client song without a length is dispatched with an empty length', async () => {
      const f = upstream({ apple: [{ status: 429 }] });
      const r = await read(await handle(add({ trackId: 5, song: { artist: 'a-ha', title: 'Take On Me' } }), env, f, NOW, FAST));
      expect(r.body).toEqual({ ok: true, source: 'client', detail: 'apple-429', song: { trackId: 5, artist: 'a-ha', title: 'Take On Me', artworkUrl: '' } });
      const d = f.calls.find((c) => c.url.endsWith('/dispatches'))!;
      expect(JSON.parse(d.init!.body as string).inputs).toEqual({ add_artist: 'a-ha', add_title: 'Take On Me', add_duration: '' });
    });

    it('still respects the daily cap when falling back', async () => {
      const f = upstream({ apple: [{ status: 403 }], count: 30 });
      expect((await read(await handle(add({ trackId: 1440936016, song: SONG }), env, f, NOW, FAST))).body.error).toBe('daily-limit');
      expect(f.calls.some((c) => c.url.endsWith('/dispatches'))).toBe(false);
    });
  });

  it('Apple says the ID is not a song: not-found, even with client details', async () => {
    const SONG = { artist: 'Taylor Swift', title: 'Shake It Off', durationSec: 219 };
    const album = upstream({ lookup: { results: [{ wrapperType: 'collection', collectionId: 1440936016 }] } });
    expect((await read(await handle(add({ trackId: 1440936016, song: SONG }), env, album, NOW))).body).toEqual({
      ok: false,
      error: 'not-found',
      detail: 'apple-not-listed',
    });
    const video = upstream({ lookup: { results: [{ ...TRACK, kind: 'music-video' }] } });
    expect((await read(await handle(add({ trackId: 1440936016, song: SONG }), env, video, NOW))).body).toEqual({
      ok: false,
      error: 'not-found',
      detail: 'apple-not-song',
    });
    const gone = upstream({ lookup: { resultCount: 0, results: [] } });
    expect(await read(await handle(add({ trackId: 1440936016, song: SONG }), env, gone, NOW))).toMatchObject({ status: 404, body: { error: 'not-found' } });
    for (const f of [album, video, gone]) {
      expect(f.calls.some((c) => c.url.includes('api.github.com'))).toBe(false);
      expect(f.calls).toHaveLength(1);
    }
  });

  it.each<[string, unknown, string]>([
    ['song is not an object', 'Taylor Swift - Shake It Off', 'song'],
    ['song is an array', ['a', 'b'], 'song'],
    ['missing artist', { title: 'Shake It Off' }, 'song-artist'],
    ['blank title', { artist: 'A', title: '   ' }, 'song-title'],
    ['artist not a string', { artist: 42, title: 'T' }, 'song-artist'],
    ['newline in title', { artist: 'A', title: 'Shake\nIt Off' }, 'song-title'],
    ['carriage return inside artist', { artist: 'A\rB', title: 'T' }, 'song-artist'],
    ['trailing newline in artist', { artist: 'A\n', title: 'T' }, 'song-artist'],
    ['tab in title', { artist: 'A', title: 'Shake\tIt' }, 'song-title'],
    ['NUL in artist', { artist: 'A\u0000B', title: 'T' }, 'song-artist'],
    ['C1 control in title', { artist: 'A', title: 'T\u0085x' }, 'song-title'],
    ['line separator in title', { artist: 'A', title: 'T\u2028x' }, 'song-title'],
    ['artist over 200 characters', { artist: 'a'.repeat(201), title: 'T' }, 'song-artist'],
    ['title over 200 characters', { artist: 'A', title: 'é'.repeat(201) }, 'song-title'],
    ['fractional length', { artist: 'A', title: 'T', durationSec: 219.5 }, 'song-duration'],
    ['length as a string', { artist: 'A', title: 'T', durationSec: '219' }, 'song-duration'],
    ['length too short', { artist: 'A', title: 'T', durationSec: 19 }, 'song-duration'],
    ['length too long', { artist: 'A', title: 'T', durationSec: 901 }, 'song-duration'],
  ])('rejects malformed client details (%s) before any lookup', async (_, song, detail) => {
    const f = upstream({ apple: [{ status: 403 }] });
    const r = await read(await handle(add({ trackId: 1440936016, song }), env, f, NOW));
    expect(r).toEqual({ status: 400, cors: ORIGIN, body: { ok: false, error: 'bad-request', detail } });
    expect(f.calls).toEqual([]);
  });

  it('rejects malformed details on a queued song, and a non-array queue', async () => {
    const f = upstream();
    const bad = await read(await handle(add({ trackId: 1440936016, queue: [{ trackId: 7, song: { artist: 'ABBA', title: 'Water\nloo' } }] }), env, f, NOW));
    expect(bad.body).toEqual({ ok: false, error: 'bad-request', detail: 'queue-song-title' });
    expect((await read(await handle(add({ trackId: 1440936016, queue: '7' }), env, f, NOW))).body.detail).toBe('queue');
    expect(f.calls).toEqual([]);
  });

  it('accepts the edge values (200 characters, 20 and 900 seconds, trimmed spaces)', async () => {
    for (const durationSec of [20, 900]) {
      const f = upstream({ apple: [{ status: 403 }] });
      const song = { artist: ` ${'a'.repeat(200)} `, title: 'T', durationSec };
      const r = await read(await handle(add({ trackId: 1, song }), env, f, NOW, { appleTimeoutMs: 20 }));
      expect(r.body).toMatchObject({ ok: true, source: 'client', song: { artist: 'a'.repeat(200), durationSec } });
    }
  });

  it('health ?probe=1 does one Apple lookup of a fixed song and reports the outcome, never secrets', async () => {
    const PROBE = { ...TRACK, trackId: PROBE_TRACK_ID };
    const ok = upstream({ lookup: { results: [PROBE] } });
    const h = await read(await handle(new Request('https://relay.example/health?probe=1', { headers: { Origin: ORIGIN } }), env, ok, NOW));
    expect(h.body).toEqual({ ok: true, repo: 'jo/dancedance', passphrase: false, dailyLimit: 30, mapDailyLimit: 60, apple: 'ok' });
    expect(ok.calls.map((c) => c.url)).toEqual([`https://itunes.apple.com/lookup?id=${PROBE_TRACK_ID}&entity=song`]);
    expect((ok.calls[0].init?.headers as Record<string, string>).Authorization).toBeUndefined();
    const probe = async (f: ReturnType<typeof upstream>) =>
      (await read(await handle(new Request('https://relay.example/health?probe=1'), env, f, NOW, { appleTimeoutMs: 20 }))).body.apple;
    expect(await probe(upstream({ apple: [{ status: 403, body: `secret ${TOKEN}` }] }))).toBe('apple-403');
    expect(await probe(upstream({ apple: [{ hang: true }] }))).toBe('apple-timeout');
    expect(await probe(upstream({ apple: [{ body: 'not json' }] }))).toBe('apple-bad-json');
    expect(await probe(upstream({ apple: [{ throws: true }] }))).toBe('apple-network');
    expect(await probe(upstream({ apple: [{ body: { results: [] } }] }))).toBe('apple-not-listed');
    // Without ?probe=1 Apple is not contacted.
    const quiet = upstream();
    expect((await read(await handle(new Request('https://relay.example/health'), env, quiet, NOW))).body.apple).toBeUndefined();
    expect(quiet.calls).toEqual([]);
  });

  it('stops at the daily cap', async () => {
    const f = upstream({ count: 30 });
    expect(await read(await handle(add({ trackId: 1440936016 }), env, f, NOW))).toMatchObject({ status: 429, body: { error: 'daily-limit' } });
    expect(f.calls.some((c) => c.url.endsWith('/dispatches'))).toBe(false);
    const low = upstream({ count: 2 });
    expect((await handle(add({ trackId: 1440936016 }), { ...env, DAILY_LIMIT: '2' }, low, NOW)).status).toBe(429);
  });

  it('maps GitHub errors to github-<status> without passing the body through', async () => {
    const leak = upstream({ dispatchStatus: 401, dispatchBody: `{"message":"Bad credentials ${TOKEN}"}` });
    expect((await read(await handle(add({ trackId: 1440936016 }), env, leak, NOW))).body).toEqual({ ok: false, error: 'github-401' });
    expect((await read(await handle(add({ trackId: 1440936016 }), env, upstream({ countStatus: 403 }), NOW))).body.error).toBe('github-403');
    expect((await read(await handle(add({ trackId: 1440936016 }), env, upstream({ dispatchStatus: 422 }), NOW))).body.error).toBe('github-422');
  });

  it('health shows the repo and whether a passphrase is needed, never secrets; missing config is reported', async () => {
    const h = await read(await handle(new Request('https://relay.example/health', { headers: { Origin: ORIGIN } }), { ...env, ADD_PASSPHRASE: 'p' }, upstream(), NOW));
    expect(h).toEqual({ status: 200, cors: ORIGIN, body: { ok: true, repo: 'jo/dancedance', passphrase: true, dailyLimit: 30, mapDailyLimit: 60 } });
    expect(JSON.stringify(h.body)).not.toContain('"p"');
    const bare = await read(await handle(add({ trackId: 1 }), { ALLOWED_ORIGINS: ORIGIN }, upstream(), NOW));
    expect(bare.body.error).toBe('not-configured');
  });
});
