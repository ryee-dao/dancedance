import { describe, expect, it } from 'vitest';
import { HttpError, parseRetryAfter, PoliteHttp, type GenreFetch } from './http';

/** A fake clock: sleeping moves time forward instantly. */
function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += Math.max(0, ms)), advance: (ms: number) => void (t += ms) };
}

type Reply = { status: number; retryAfter?: string; body?: unknown } | 'network';

function scripted(clock: ReturnType<typeof fakeClock>, replies: Record<string, Reply[]>, log: { url: string; at: number; inFlight: number }[]): GenreFetch {
  const inFlight = new Map<string, number>();
  return async (url) => {
    const host = new URL(url).host;
    const n = (inFlight.get(host) ?? 0) + 1;
    inFlight.set(host, n);
    log.push({ url, at: clock.now(), inFlight: n });
    await Promise.resolve();
    clock.advance(100); // each request takes 100 ms
    inFlight.set(host, n - 1);
    const r = replies[url]?.shift() ?? { status: 200, body: { ok: url } };
    if (r === 'network') throw new TypeError('Failed to fetch');
    const headers = new Headers(r.retryAfter ? { 'retry-after': r.retryAfter } : {});
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers, json: async () => r.body ?? {} };
  };
}

describe('PoliteHttp', () => {
  it('one request in flight per host, spaced from the end of the previous one; hosts run side by side', async () => {
    const clock = fakeClock();
    const log: { url: string; at: number; inFlight: number }[] = [];
    const http = new PoliteHttp({ fetch: scripted(clock, {}, log), now: clock.now, sleep: clock.sleep, spacingMs: () => 1000 });
    await Promise.all([
      http.getJson('https://a.example/1'),
      http.getJson('https://a.example/2'),
      http.getJson('https://a.example/3'),
      http.getJson('https://b.example/1'),
    ]);
    expect(log.every((l) => l.inFlight === 1)).toBe(true);
    const a = log.filter((l) => l.url.includes('a.example')).map((l) => l.at);
    expect(a[1] - a[0]).toBeGreaterThanOrEqual(1100);
    expect(a[2] - a[1]).toBeGreaterThanOrEqual(1100);
    expect(log.find((l) => l.url.includes('b.example'))!.at).toBeLessThan(a[1]); // b did not wait for a
  });

  it('honours Retry-After on 429 and slows that host down afterwards', async () => {
    const clock = fakeClock();
    const log: { url: string; at: number; inFlight: number }[] = [];
    const replies: Record<string, Reply[]> = { 'https://w.example/x': [{ status: 429, retryAfter: '30' }, { status: 200, body: { done: true } }] };
    const http = new PoliteHttp({ fetch: scripted(clock, replies, log), now: clock.now, sleep: clock.sleep, spacingMs: () => 1000 });
    expect(await http.getJson('https://w.example/x')).toEqual({ done: true });
    expect(log[1].at - log[0].at).toBeGreaterThanOrEqual(30_000);
    // Spacing doubled after the 429.
    await http.getJson('https://w.example/y');
    expect(log[2].at - log[1].at).toBeGreaterThanOrEqual(2000);
  });

  it('backs off exponentially on 5xx without Retry-After, then gives up as transient', async () => {
    const clock = fakeClock();
    const log: { url: string; at: number; inFlight: number }[] = [];
    const replies: Record<string, Reply[]> = { 'https://m.example/q': Array.from({ length: 10 }, () => ({ status: 503 })) };
    const http = new PoliteHttp({ fetch: scripted(clock, replies, log), now: clock.now, sleep: clock.sleep, spacingMs: () => 0, baseBackoffMs: 1000, maxRetries: 3 });
    const err = await http.getJson('https://m.example/q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 503, transient: true });
    expect(log).toHaveLength(4);
    const gaps = log.slice(1).map((l, i) => l.at - log[i].at - 100);
    expect(gaps).toEqual([1000, 2000, 4000]);
  });

  it('a Retry-After longer than the cap: fail now and keep that host closed until then', async () => {
    const clock = fakeClock();
    const log: { url: string; at: number; inFlight: number }[] = [];
    const replies: Record<string, Reply[]> = { 'https://w.example/a': [{ status: 429, retryAfter: '3600' }] };
    const http = new PoliteHttp({ fetch: scripted(clock, replies, log), now: clock.now, sleep: clock.sleep, maxBackoffMs: 60_000 });
    await expect(http.getJson('https://w.example/a')).rejects.toMatchObject({ status: 429, transient: true });
    await expect(http.getJson('https://w.example/b')).rejects.toMatchObject({ transient: true });
    expect(log).toHaveLength(1); // the second request was never sent
    clock.advance(3600_000);
    await expect(http.getJson('https://w.example/c')).resolves.toEqual({ ok: 'https://w.example/c' });
  });

  it('network errors (also how a browser sees a 429 without CORS headers) are retried a little, then transient', async () => {
    const clock = fakeClock();
    const log: { url: string; at: number; inFlight: number }[] = [];
    const replies: Record<string, Reply[]> = { 'https://n.example/1': ['network', { status: 200, body: 1 }], 'https://n.example/2': ['network', 'network', 'network', 'network'] };
    const http = new PoliteHttp({ fetch: scripted(clock, replies, log), now: clock.now, sleep: clock.sleep, spacingMs: () => 0 });
    expect(await http.getJson('https://n.example/1')).toBe(1);
    await expect(http.getJson('https://n.example/2')).rejects.toMatchObject({ status: 0, transient: true });
  });

  it('other 4xx answers are final and not retried', async () => {
    const clock = fakeClock();
    const log: { url: string; at: number; inFlight: number }[] = [];
    const http = new PoliteHttp({ fetch: scripted(clock, { 'https://x.example/404': [{ status: 404 }] }, log), now: clock.now, sleep: clock.sleep });
    await expect(http.getJson('https://x.example/404')).rejects.toMatchObject({ status: 404, transient: false });
    expect(log).toHaveLength(1);
  });

  it('waits at the gate before every request; sends User-Agent only when given', async () => {
    const clock = fakeClock();
    let open = false;
    let waited = 0;
    const headers: (HeadersInit | undefined)[] = [];
    const fetch: GenreFetch = async (_url, init) => {
      headers.push(init?.headers);
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    };
    const gated = new PoliteHttp({
      fetch,
      now: clock.now,
      sleep: clock.sleep,
      gate: async () => {
        while (!open) {
          waited++;
          await clock.sleep(1000);
          if (waited === 3) open = true;
        }
      },
    });
    await gated.getJson('https://g.example/');
    expect(waited).toBe(3);
    expect(headers[0]).toEqual({});
    await new PoliteHttp({ fetch, now: clock.now, sleep: clock.sleep, userAgent: 'App/1.0' }).getJson('https://g.example/');
    expect(headers[1]).toEqual({ 'User-Agent': 'App/1.0', 'Api-User-Agent': 'App/1.0' });
  });

  it('parses Retry-After seconds and dates', () => {
    expect(parseRetryAfter('120', 0)).toBe(120_000);
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:10 GMT', Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'))).toBe(10_000);
    expect(parseRetryAfter('soon', 0)).toBeNull();
    expect(parseRetryAfter(null, 0)).toBeNull();
  });
});
