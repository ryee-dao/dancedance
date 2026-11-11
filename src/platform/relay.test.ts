import { describe, expect, it } from 'vitest';
import { explainRelayError, parseRelayUrl, relayAdd, relayHealth } from './relay';

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
  it('sends only the track IDs (and the passphrase header when set)', async () => {
    const f = fake(200, { ok: true, song: { trackId: 5, artist: 'a-ha', title: 'Take On Me', durationSec: 225, artworkUrl: '' } });
    const r = await relayAdd('https://dd.jo.workers.dev', 5, [7, 8], 'disco', f);
    expect(r).toEqual({ ok: true, song: { trackId: 5, artist: 'a-ha', title: 'Take On Me', durationSec: 225, artworkUrl: '' } });
    expect(f.calls[0].url).toBe('https://dd.jo.workers.dev/add');
    expect(f.calls[0].init.method).toBe('POST');
    expect(f.calls[0].init.headers).toEqual({ 'Content-Type': 'application/json', 'X-Add-Passphrase': 'disco' });
    expect(JSON.parse(f.calls[0].init.body as string)).toEqual({ trackId: 5, queue: [7, 8] });
    const g = fake(200, { ok: true, song: { artist: 'x', title: 'y', durationSec: 1 } });
    await relayAdd('https://dd.jo.workers.dev', 5, [], null, g);
    expect(g.calls[0].init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(g.calls[0].init.body as string)).toEqual({ trackId: 5 });
  });
  it.each([
    ['bad-origin', 403, /ALLOWED_ORIGINS/],
    ['passphrase', 401, /passphrase/],
    ['not-found', 404, /catalogue/],
    ['daily-limit', 429, /today/],
    ['github-401', 502, /wrangler secret put GITHUB_TOKEN/],
    ['github-404', 502, /GITHUB_REPO/],
    ['github-unreachable', 502, /couldn’t reach GitHub/],
  ])('maps %s', async (code, status, re) => {
    const r = await relayAdd('https://x.dev', 1, [], null, fake(status, { ok: false, error: code }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(re);
  });
  it('network / CORS failure and odd responses', async () => {
    const r = await relayAdd('https://x.dev', 1, [], null, async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(r).toMatchObject({ ok: false, error: 'network' });
    expect(await relayAdd('https://x.dev', 1, [], null, fake(500, '<html>'))).toMatchObject({ ok: false, code: 'http-500', error: 'server' });
    expect(explainRelayError('passphrase').error).toBe('passphrase');
  });
  it('health', async () => {
    expect(await relayHealth('https://x.dev', fake(200, { ok: true, repo: 'jo/dd', passphrase: true }))).toEqual({ ok: true, repo: 'jo/dd', passphrase: true });
    expect(await relayHealth('https://x.dev', fake(404, {}))).toBeNull();
  });
});
