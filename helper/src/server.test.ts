// deno test (see helper/deno.json "test" task)
import { assert, assertEquals } from './testutil.ts';
import { AudioFailure, createHandler, type HandlerDeps, type Health } from './server.ts';
import { classifyFailure, classifyNoFile, isAllowedOrigin, Limiter, normalizeOrigin } from './policy.ts';
import { resolveConfig } from './config.ts';
import { checksumFor, tagFromLocation, ytdlpAsset } from './tools.ts';
import { parseProgress, ytdlpArgs } from './ytdlp.ts';

const PAGES = 'https://ryee-dao.github.io';
const PORT = 47800;
const BASE = `http://127.0.0.1:${PORT}`;

function health(ready = true): Health {
  return { ok: true, app: 'dancedance-helper', version: 't', ytdlp: '2026.10.26', platform: 'macos-arm64', ready, state: ready ? 'ready' : 'preparing', progress: null, message: null };
}

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps & { calls: string[] } {
  const calls: string[] = [];
  const limiter = new Limiter({ maxConcurrent: 2, maxPerWindow: 100, windowMs: 60_000 });
  return {
    calls,
    port: PORT,
    origins: { allowed: new Set([PAGES]), allowDev: true },
    health: () => health(),
    status: () => ({ current: [], recent: [] }),
    acquire: () => limiter.tryAcquire(),
    getAudio: (id) => {
      calls.push(id);
      return Promise.resolve({ bytes: new Uint8Array([1, 2, 3]), contentType: 'audio/mp4', ext: 'm4a' });
    },
    statusPage: () => '<html>',
    quit: () => calls.push('quit'),
    ...over,
  };
}

function req(path: string, init: RequestInit & { origin?: string | null; host?: string } = {}): Request {
  const h = new Headers(init.headers);
  h.set('Host', init.host ?? `127.0.0.1:${PORT}`);
  if (init.origin) h.set('Origin', init.origin);
  return new Request(`${BASE}${path}`, { ...init, headers: h });
}

const audioPost = (body: unknown, origin: string | null = PAGES, type = 'application/json') =>
  req('/audio', { method: 'POST', origin, body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': type } });

Deno.test('POST /audio from the Pages origin returns the audio with CORS', async () => {
  const d = deps();
  const res = await createHandler(d)(audioPost({ videoId: '1j_XvebOg4c' }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Content-Type'), 'audio/mp4');
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), PAGES);
  assertEquals(new Uint8Array(await res.arrayBuffer()).length, 3);
  assertEquals(d.calls, ['1j_XvebOg4c']);
});

Deno.test('origin rules: wrong origin refused everywhere, no origin refused for POST, dev origins allowed', async () => {
  const d = deps();
  const h = createHandler(d);
  assertEquals((await h(audioPost({ videoId: '1j_XvebOg4c' }, 'https://evil.example'))).status, 403);
  assertEquals((await h(audioPost({ videoId: '1j_XvebOg4c' }, null))).status, 403);
  assertEquals((await h(audioPost({ videoId: '1j_XvebOg4c' }, 'null'))).status, 403);
  assertEquals((await h(req('/health', { origin: 'https://evil.example' }))).status, 403);
  assertEquals((await h(req('/health'))).status, 200);
  assertEquals((await h(audioPost({ videoId: '1j_XvebOg4c' }, 'http://localhost:5191'))).status, 200);
  assertEquals((await h(audioPost({ videoId: '1j_XvebOg4c' }, 'https://ryee-dao.github.io.evil.example'))).status, 403);
  assertEquals(d.calls.length, 1);
  const noDev = createHandler(deps({ origins: { allowed: new Set([PAGES]), allowDev: false } }));
  assertEquals((await noDev(audioPost({ videoId: '1j_XvebOg4c' }, 'http://localhost:5191'))).status, 403);
});

Deno.test('DNS rebinding: a foreign Host header is refused', async () => {
  const res = await createHandler(deps())(req('/health', { host: 'evil.example:47800' }));
  assertEquals(res.status, 403);
});

Deno.test('preflight: allowed origin gets CORS + Private Network Access headers; others get nothing', async () => {
  const h = createHandler(deps());
  const ok = await h(req('/audio', {
    method: 'OPTIONS',
    origin: PAGES,
    headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type', 'Access-Control-Request-Private-Network': 'true' },
  }));
  assertEquals(ok.status, 204);
  assertEquals(ok.headers.get('Access-Control-Allow-Origin'), PAGES);
  assertEquals(ok.headers.get('Access-Control-Allow-Private-Network'), 'true');
  assertEquals(ok.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  const evil = await h(req('/audio', { method: 'OPTIONS', origin: 'https://evil.example', headers: { 'Access-Control-Request-Method': 'POST' } }));
  assertEquals(evil.status, 403);
  assertEquals(evil.headers.get('Access-Control-Allow-Origin'), null);
  const odd = await h(req('/audio', { method: 'OPTIONS', origin: PAGES, headers: { 'Access-Control-Request-Method': 'PUT' } }));
  assertEquals(odd.status, 403);
});

Deno.test('only an 11-character video ID is accepted', async () => {
  const d = deps();
  const h = createHandler(d);
  for (const bad of [
    { videoId: 'short' },
    { videoId: '1j_XvebOg4c1' },
    { videoId: '../../etc/pa' },
    { videoId: 'https://youtu.be/x' },
    { videoId: '1j_XvebOg4c', args: ['--exec', 'rm'] },
    { url: 'https://example.com' },
    ['1j_XvebOg4c'],
    'not json',
  ]) {
    const res = await h(audioPost(bad));
    assertEquals(res.status, 400, JSON.stringify(bad));
    assertEquals((await res.json()).code, 'bad-request');
  }
  assertEquals((await h(audioPost({ videoId: '1j_XvebOg4c' }, PAGES, 'text/plain'))).status, 400);
  assertEquals((await h(audioPost(JSON.stringify({ videoId: '1j_XvebOg4c', pad: 'x'.repeat(5000) })))).status, 400);
  assertEquals(d.calls, []);
});

Deno.test('not ready, busy and rate limits', async () => {
  assertEquals((await (await createHandler(deps({ health: () => health(false) }))(audioPost({ videoId: '1j_XvebOg4c' }))).json()).code, 'not-ready');
  let t = 0;
  const lim = new Limiter({ maxConcurrent: 1, maxPerWindow: 2, windowMs: 60_000, now: () => t });
  const a = lim.tryAcquire();
  assert(a.ok);
  const b = lim.tryAcquire();
  assertEquals(b.ok ? null : b.code, 'busy');
  if (a.ok) a.release();
  const c = lim.tryAcquire();
  assert(c.ok);
  if (c.ok) c.release();
  const d = lim.tryAcquire();
  assertEquals(d.ok ? null : d.code, 'rate-limited');
  t = 61_000;
  assert(lim.tryAcquire().ok);
});

Deno.test('yt-dlp failures become plain codes', async () => {
  const d = deps({ getAudio: () => Promise.reject(new AudioFailure('blocked', 'bot check')) });
  const res = await createHandler(d)(audioPost({ videoId: '1j_XvebOg4c' }));
  assertEquals(res.status, 502);
  assertEquals((await res.json()).code, 'blocked');
  assertEquals(classifyFailure("ERROR: [youtube] x: Sign in to confirm you're not a bot").code, 'blocked');
  assertEquals(classifyFailure('ERROR: [youtube] x: Video unavailable. This video is private').code, 'unavailable');
  assertEquals(classifyFailure('ERROR: unable to extract player response; please report').code, 'outdated');
  assertEquals(classifyFailure('WARNING: No supported JavaScript runtime could be found\nERROR: Requested format is not available').code, 'outdated');
  assertEquals(classifyFailure('ERROR: Unable to download webpage: <urlopen error [Errno 8] nodename nor servname provided> (caused by getaddrinfo failed)').code, 'network');
  assertEquals(classifyFailure('ERROR: something odd').code, 'error');
  assertEquals(classifyNoFile('[download] audio does not pass filter (!is_live & duration <=? 900), skipping ..').code, 'unavailable');
});

Deno.test('quit only from the status page itself', async () => {
  const d = deps();
  const h = createHandler(d);
  assertEquals((await h(req('/quit', { method: 'POST', origin: PAGES }))).status, 403);
  assertEquals((await h(req('/quit', { method: 'POST' }))).status, 403);
  assertEquals((await h(req('/quit', { method: 'POST', origin: BASE }))).status, 200);
  await new Promise((r) => setTimeout(r, 150));
  assertEquals(d.calls, ['quit']);
});

Deno.test('origin normalisation and config file', () => {
  assertEquals(normalizeOrigin('https://me.github.io/dancedance/'), 'https://me.github.io');
  assertEquals(normalizeOrigin('ftp://x'), null);
  assertEquals(normalizeOrigin('javascript:alert(1)'), null);
  assertEquals(normalizeOrigin('https://u:p@x.io'), null);
  assert(!isAllowedOrigin('http://localhost.evil.example', { allowed: new Set(), allowDev: true }));
  const c = resolveConfig({ allowedOrigins: ['https://dance.example.com/', 'nope'], siteUrl: 'https://dance.example.com/app/', allowLocalhost: false });
  assertEquals(c.allowedOrigins.sort(), ['https://dance.example.com', PAGES].sort());
  assertEquals(c.siteUrl, 'https://dance.example.com/app/');
  assertEquals(c.allowLocalhost, false);
  assertEquals(c.warnings.length, 1);
  assertEquals(resolveConfig(undefined).allowedOrigins, [PAGES]);
});

Deno.test('tool provisioning helpers', () => {
  assertEquals(ytdlpAsset('darwin', 'aarch64'), 'yt-dlp_macos');
  assertEquals(ytdlpAsset('windows', 'x86_64'), 'yt-dlp.exe');
  assertEquals(ytdlpAsset('linux', 'x86_64'), 'yt-dlp_linux');
  const sums = 'e51e  yt-dlp\n0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa  yt-dlp_macos\n';
  assertEquals(checksumFor(sums, 'yt-dlp_macos'), '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa');
  assertEquals(checksumFor(sums, 'yt-dlp_macos.zip'), null);
  assertEquals(tagFromLocation('https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26'), '2026.10.26');
  assertEquals(tagFromLocation('https://github.com/yt-dlp/yt-dlp/releases/tag/..%2F..%2Fx'), null);
});

Deno.test('yt-dlp arguments carry only the video ID from the page', () => {
  const a = ytdlpArgs({ videoId: '1j_XvebOg4c', jsRuntime: '/apps/helper', cacheDir: '/tmp/c' }, '/tmp/j');
  assertEquals(a.slice(-2), ['--', 'https://www.youtube.com/watch?v=1j_XvebOg4c']);
  assert(a.includes('--ignore-config'));
  assertEquals(a[a.indexOf('--js-runtimes') + 1], 'deno:/apps/helper');
  assertEquals(parseProgress('[ddh] 500 1000'), 0.5);
  assertEquals(parseProgress('[ddh] 500 NA'), null);
});
