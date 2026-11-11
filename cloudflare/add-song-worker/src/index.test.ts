import { describe, expect, it } from 'vitest';
import { handle, safeEqual, type Env } from './index';

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

/** Upstream fake: iTunes lookup, GitHub run count, GitHub dispatch. */
function upstream(o: { lookup?: unknown; lookupStatus?: number; count?: number; countStatus?: number; dispatchStatus?: number; dispatchBody?: string } = {}) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (url.startsWith('https://itunes.apple.com/lookup')) {
      return new Response(JSON.stringify(o.lookup ?? { resultCount: 2, results: [TRACK, QUEUED] }), { status: o.lookupStatus ?? 200 });
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
      body: { ok: true, song: { trackId: 1440936016, artist: 'Taylor Swift', title: 'Shake It Off', durationSec: 219, artworkUrl: 'https://is1-ssl.mzstatic.com/a/300x300bb.jpg' } },
    });
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://itunes.apple.com/lookup?id=1440936016,7&entity=song',
      'https://api.github.com/repos/jo/dancedance/actions/workflows/beatmaps.yml/runs?event=workflow_dispatch&per_page=1&created=%3E%3D2026-11-09T12%3A00%3A00Z',
      'https://api.github.com/repos/jo/dancedance/actions/workflows/beatmaps.yml/dispatches',
    ]);
    expect((f.calls[0].init?.headers as Record<string, string>).Authorization).toBeUndefined(); // token never goes to Apple
    const d = f.calls[2].init!;
    expect(d.method).toBe('POST');
    expect((d.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(d.body as string)).toEqual({
      ref: 'main',
      inputs: { add_artist: 'Taylor Swift', add_title: 'Shake It Off', add_duration: '219', add_queue: '[{"artist":"ABBA","title":"Waterloo","duration":165}]' },
    });
  });

  it('ignores any artist/title the caller sends', async () => {
    const f = upstream({ lookup: { results: [TRACK] } });
    await handle(add({ trackId: 1440936016, artist: '$(rm -rf /)', title: 'x' }), env, f, NOW);
    expect(f.calls[2].init!.body as string).not.toContain('rm -rf');
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

  it('unknown track or a failed lookup: nothing is dispatched', async () => {
    const none = upstream({ lookup: { resultCount: 0, results: [] } });
    expect((await read(await handle(add({ trackId: 99 }), env, none, NOW))).body.error).toBe('not-found');
    const tooLong = upstream({ lookup: { results: [{ ...TRACK, trackTimeMillis: 3_600_000 }] } });
    expect((await read(await handle(add({ trackId: 1440936016 }), env, tooLong, NOW))).body.error).toBe('not-found');
    const down = upstream({ lookupStatus: 503 });
    expect((await read(await handle(add({ trackId: 1440936016 }), env, down, NOW))).body.error).toBe('lookup-failed');
    for (const f of [none, tooLong, down]) expect(f.calls.some((c) => c.url.includes('api.github.com'))).toBe(false);
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
    expect(h).toEqual({ status: 200, cors: ORIGIN, body: { ok: true, repo: 'jo/dancedance', passphrase: true, dailyLimit: 30 } });
    expect(JSON.stringify(h.body)).not.toContain('"p"');
    const bare = await read(await handle(add({ trackId: 1 }), { ALLOWED_ORIGINS: ORIGIN }, upstream(), NOW));
    expect(bare.body.error).toBe('not-configured');
  });
});
