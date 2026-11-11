import { describe, expect, it } from 'vitest';
import { explainRelayError, parseRelayUrl, relayAdd, relayBody, relayDetails, relayHealth, RELAY_MAX_BODY_BYTES } from './relay';

const SONG = { trackId: 5, artist: 'a-ha', title: 'Take On Me', durationSec: 225 };
const one = (trackId: number) => ({ trackId, artist: 'x', title: 'y', durationSec: 200 });

function fake(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
  return Object.assign(fn, { calls });
}

describe('relay client', () => {
  it('accepts https (and http on localhost) relay addresses only', () => {
    expect(parseRelayUrl(' https://dd.jo.workers.dev/ ')).toBe('https://dd.jo.workers.dev');
    expect(parseRelayUrl('http://localhost:8787')).toBe('http://localhost:8787');
    expect(parseRelayUrl('http://dd.jo.workers.dev')).toBeNull();
    expect(parseRelayUrl('https://dd.jo.workers.dev/?x=1')).toBeNull();
    expect(parseRelayUrl('https://user:pw@dd.jo.workers.dev')).toBeNull();
    expect(parseRelayUrl('javascript:alert(1)')).toBeNull();
  });
  it('sends the track IDs with the details from the app’s own search (and the passphrase header when set)', async () => {
    const f = fake(200, { ok: true, source: 'apple', song: { trackId: 5, artist: 'a-ha', title: 'Take On Me', durationSec: 225, artworkUrl: '' } });
    const r = await relayAdd('https://dd.jo.workers.dev', SONG, [{ trackId: 7, artist: 'ABBA', title: 'Waterloo', durationSec: 165 }, one(8)], 'disco', f);
    expect(r).toEqual({ ok: true, source: 'apple', song: { trackId: 5, artist: 'a-ha', title: 'Take On Me', durationSec: 225, artworkUrl: '' } });
    expect(f.calls[0].url).toBe('https://dd.jo.workers.dev/add');
    expect(f.calls[0].init.method).toBe('POST');
    expect(f.calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'X-Add-Passphrase': 'disco' });
    expect(JSON.parse(f.calls[0].init.body as string)).toEqual({
      trackId: 5,
      song: { artist: 'a-ha', title: 'Take On Me', durationSec: 225 },
      queue: [
        { trackId: 7, song: { artist: 'ABBA', title: 'Waterloo', durationSec: 165 } },
        { trackId: 8, song: { artist: 'x', title: 'y', durationSec: 200 } },
      ],
    });
    const g = fake(200, { ok: true, song: { artist: 'x', title: 'y', durationSec: 1 } });
    const old = await relayAdd('https://dd.jo.workers.dev', SONG, [], null, g);
    expect(old).toMatchObject({ ok: true, source: 'apple' }); // an older relay sends no source
    expect(g.calls[0].init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(g.calls[0].init.body as string)).toEqual({ trackId: 5, song: { artist: 'a-ha', title: 'Take On Me', durationSec: 225 } });
  });
  it('reports a fallback to the app’s details (source client, detail), keeping our length if the relay sent none', async () => {
    const f = fake(200, { ok: true, source: 'client', detail: 'apple-403', song: { trackId: 5, artist: 'a-ha', title: 'Take On Me', artworkUrl: '' } });
    expect(await relayAdd('https://x.dev', SONG, [], null, f)).toEqual({
      ok: true,
      source: 'client',
      detail: 'apple-403',
      song: { trackId: 5, artist: 'a-ha', title: 'Take On Me', durationSec: 225, artworkUrl: '' },
    });
    const odd = fake(200, { ok: true, source: 'client', detail: '<b>hi</b>', song: { artist: 'a', title: 'b' } });
    expect(await relayAdd('https://x.dev', SONG, [], null, odd)).not.toHaveProperty('detail');
  });
  it('only sends details the relay accepts, and keeps the body under its size limit', () => {
    expect(relayDetails({ artist: '  a-ha ', title: 'Take On Me', durationSec: 225.4 })).toEqual({ artist: 'a-ha', title: 'Take On Me', durationSec: 225 });
    expect(relayDetails({ artist: 'a-ha', title: 'Take On Me', durationSec: 5000 })).toEqual({ artist: 'a-ha', title: 'Take On Me' });
    expect(relayDetails({ artist: 'a\nb', title: 'T' })).toBeNull();
    expect(relayDetails({ artist: 'a', title: 'x'.repeat(201) })).toBeNull();
    expect(relayDetails({ artist: ' ', title: 'T' })).toBeNull();
    expect(JSON.parse(relayBody({ trackId: 1, artist: 'a\tb', title: 'T', durationSec: 200 }, []))).toEqual({ trackId: 1 });
    // Ten long songs: the body stays within the limit; songs that don't fit with details go by ID; at most 9 queued.
    const long = (i: number) => ({ trackId: 100 + i, artist: 'ü'.repeat(200), title: 'ö'.repeat(200), durationSec: 300 });
    const text = relayBody(long(0), Array.from({ length: 12 }, (_, i) => long(i + 1)));
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(RELAY_MAX_BODY_BYTES);
    const b = JSON.parse(text);
    expect(b.song.artist).toBe('ü'.repeat(200));
    expect(b.queue).toHaveLength(9);
    expect(b.queue[0]).toEqual({ trackId: 101, song: { artist: 'ü'.repeat(200), title: 'ö'.repeat(200), durationSec: 300 } });
    expect(b.queue[8]).toBe(109);
    // The song itself is never queued again.
    expect(JSON.parse(relayBody(one(3), [one(3), one(4)])).queue).toEqual([{ trackId: 4, song: { artist: 'x', title: 'y', durationSec: 200 } }]);
  });
  it.each([
    ['bad-origin', 403, /ALLOWED_ORIGINS/],
    ['passphrase', 401, /passphrase/],
    ['not-found', 404, /catalogue/],
    ['lookup-failed', 502, /npx wrangler deploy/],
    ['bad-request', 400, /understand/],
    ['daily-limit', 429, /today/],
    ['github-401', 502, /wrangler secret put GITHUB_TOKEN/],
    ['github-404', 502, /GITHUB_REPO/],
    ['github-unreachable', 502, /couldn’t reach GitHub/],
  ])('maps %s', async (code, status, re) => {
    const r = await relayAdd('https://x.dev', one(1), [], null, fake(status, { ok: false, error: code }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(re);
  });
  it('shows the relay’s detail with lookup and request errors', async () => {
    const r = await relayAdd('https://x.dev', SONG, [], null, fake(502, { ok: false, error: 'lookup-failed', detail: 'apple-403/apple-timeout' }));
    expect(r).toMatchObject({ ok: false, error: 'lookup-failed', code: 'lookup-failed', detail: 'apple-403/apple-timeout' });
    if (!r.ok) expect(r.message).toMatch(/Apple’s music catalogue.*apple-403\/apple-timeout/);
    const bad = await relayAdd('https://x.dev', SONG, [], null, fake(400, { ok: false, error: 'bad-request', detail: 'song-title' }));
    expect(bad).toMatchObject({ ok: false, error: 'bad-request', detail: 'song-title' });
    if (!bad.ok) expect(bad.message).toMatch(/name or length.*song-title/);
    expect(explainRelayError('not-found', 'apple-not-song').message).toMatch(/no longer lists.*apple-not-song/);
    expect(explainRelayError('lookup-failed').message).not.toMatch(/detail/i);
  });
  it('network / CORS failure and odd responses', async () => {
    const r = await relayAdd('https://x.dev', one(1), [], null, async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(r).toMatchObject({ ok: false, error: 'network' });
    expect(await relayAdd('https://x.dev', one(1), [], null, fake(500, '<html>'))).toMatchObject({ ok: false, code: 'http-500', error: 'server' });
    expect(explainRelayError('passphrase').error).toBe('passphrase');
  });
  it('health', async () => {
    expect(await relayHealth('https://x.dev', fake(200, { ok: true, repo: 'jo/dd', passphrase: true }))).toEqual({ ok: true, repo: 'jo/dd', passphrase: true });
    expect(await relayHealth('https://x.dev', fake(404, {}))).toBeNull();
  });
});
