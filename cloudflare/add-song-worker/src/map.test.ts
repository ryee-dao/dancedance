/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSharedMap } from '../../../src/core/analysis';
import { handle, MAP_MAX_BYTES, MAP_RUN_TITLE, validateSharedMap, type Env } from './index';

const TOKEN = 'github_pat_SECRET_TOKEN_never_in_responses_0123456789';
const ORIGIN = 'https://jo.github.io';
const env: Env = { GITHUB_TOKEN: TOKEN, GITHUB_REPO: 'jo/dancedance', ALLOWED_ORIGINS: ORIGIN };
const NOW = () => new Date('2026-11-11T06:00:00.000Z');
const PUBLIC = join(__dirname, '../../../public/beatmaps');
const REAL = JSON.parse(readFileSync(join(PUBLIC, 'fw-QRyQcFH8.json'), 'utf8'));
const TAB = { ...REAL, source: 'tab' };

interface Call {
  url: string;
  init?: RequestInit;
}

/** GitHub fake: run list (with titles) and dispatch. */
function github(o: { runs?: string[]; total?: number; listStatus?: number; dispatchStatus?: number } = {}) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (url.includes('/runs?')) {
      const runs = (o.runs ?? []).map((t) => ({ display_title: t }));
      return new Response(JSON.stringify({ total_count: o.total ?? runs.length, workflow_runs: runs }), { status: o.listStatus ?? 200 });
    }
    if (url.endsWith('/dispatches')) return new Response(null, { status: o.dispatchStatus ?? 204 });
    throw new Error(`unexpected ${url}`);
  };
  return Object.assign(fn, { calls });
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://relay.example/map', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function read(res: Response) {
  const text = await res.text();
  expect(text).not.toContain(TOKEN);
  return { status: res.status, body: JSON.parse(text) };
}

describe('relay POST /map', () => {
  it('validates, counts contributed runs and dispatches the compact map as map_json', async () => {
    const f = github({ runs: ['Add song: A - B', `${MAP_RUN_TITLE}`] });
    const r = await read(await handle(post(TAB), env, f, NOW));
    expect(r).toEqual({ status: 200, body: { ok: true, videoId: 'fw-QRyQcFH8' } });
    expect(f.calls[0].url).toBe(
      'https://api.github.com/repos/jo/dancedance/actions/workflows/beatmaps.yml/runs?event=workflow_dispatch&per_page=100&created=%3E%3D2026-11-10T06%3A00%3A00Z',
    );
    const d = JSON.parse(f.calls[1].init!.body as string);
    expect(Object.keys(d)).toEqual(['ref', 'inputs']);
    expect(Object.keys(d.inputs)).toEqual(['map_json']);
    expect(JSON.parse(d.inputs.map_json)).toEqual(TAB);
    expect(d.inputs.map_json).not.toContain(' ');
    expect(f.calls[1].init!.body!.toString().length).toBeLessThan(60_000);
    expect((f.calls[1].init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('accepts device maps too', async () => {
    expect((await read(await handle(post({ ...REAL, source: 'device' }), env, github(), NOW))).status).toBe(200);
  });

  it('same origin check and passphrase as /add; content type and size limit', async () => {
    const f = github();
    expect((await read(await handle(post(TAB, { Origin: 'https://evil.example' }), env, f, NOW))).body.error).toBe('bad-origin');
    expect((await read(await handle(post(TAB), { ...env, ADD_PASSPHRASE: 'disco' }, f, NOW))).body.error).toBe('passphrase');
    expect((await read(await handle(post(TAB, { 'Content-Type': 'text/plain' }), env, f, NOW))).status).toBe(415);
    const big = { ...TAB, beats: [...TAB.beats, ...Array.from({ length: 8000 }, (_, i) => 200 + i)] };
    expect(JSON.stringify(big).length).toBeGreaterThan(MAP_MAX_BYTES);
    expect(await read(await handle(post(big), env, f, NOW))).toEqual({ status: 413, body: { ok: false, error: 'bad-request', detail: 'too-large' } });
    expect((await read(await handle(post('{"v":'), env, f, NOW))).body.detail).toBe('json');
    expect(f.calls).toEqual([]);
    expect((await handle(new Request('https://relay.example/map', { headers: { Origin: ORIGIN } }), env, f, NOW)).status).toBe(405);
  });

  it('its own soft daily cap counts only contributed-map runs; add runs no longer count them', async () => {
    const full = github({ runs: Array.from({ length: 60 }, () => MAP_RUN_TITLE) });
    expect(await read(await handle(post(TAB), env, full, NOW))).toEqual({ status: 429, body: { ok: false, error: 'daily-limit' } });
    expect(full.calls.some((c) => c.url.endsWith('/dispatches'))).toBe(false);
    expect((await handle(post(TAB), { ...env, MAP_DAILY_LIMIT: '2' }, github({ runs: [MAP_RUN_TITLE, MAP_RUN_TITLE] }), NOW)).status).toBe(429);
    // 40 add runs + 60 map runs: adds are under their cap of 30? No: 40 >= 30. 20 add runs: fine.
    const mixed = github({ runs: [...Array.from({ length: 20 }, () => 'Add song: A - B'), ...Array.from({ length: 60 }, () => MAP_RUN_TITLE)] });
    const add = new Request('https://relay.example/add', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{"trackId":1}' });
    const apple = async (url: string, init?: RequestInit) =>
      url.startsWith('https://itunes.apple.com/')
        ? new Response(JSON.stringify({ results: [{ wrapperType: 'track', kind: 'song', trackId: 1, artistName: 'A', trackName: 'T', trackTimeMillis: 200000 }] }))
        : mixed(url, init);
    expect((await handle(add, env, apple, NOW)).status).toBe(200);
    expect((await read(await handle(post(TAB), env, github({ listStatus: 403 }), NOW))).body.error).toBe('github-403');
    expect((await read(await handle(post(TAB), env, github({ dispatchStatus: 422 }), NOW))).body.error).toBe('github-422');
  });

  const sec = TAB.sections;
  const last = sec.length - 1;
  it.each<[string, Record<string, unknown>, string]>([
    ['an extra top-level field', { ...TAB, note: 'hi' }, 'extra-field'],
    ['an extra section field', { ...TAB, sections: sec.map((s: object, i: number) => (i ? s : { ...s, run: 'x' })) }, 'extra-field'],
    ['a wrong version', { ...TAB, v: 2 }, 'version'],
    ['a bad analyzerVersion', { ...TAB, analyzerVersion: '1.1.0; rm' }, 'analyzer-version'],
    ['a short video ID', { ...TAB, videoId: 'abc' }, 'video-id'],
    ['a mic map', { ...TAB, source: 'mic' }, 'source'],
    ['a cloud map', { ...TAB, source: 'cloud' }, 'source'],
    ['a partial map', { ...TAB, partial: true }, 'partial'],
    ['a 20 s song', { ...TAB, duration: 20 }, 'duration'],
    ['a 1000 s song', { ...TAB, duration: 1000, sections: sec.map((s: { end: number }, i: number) => (i === last ? { ...s, end: 1000 } : s)) }, 'duration'],
    ['bpm 50', { ...TAB, bpm: 50 }, 'bpm'],
    ['bpm 230', { ...TAB, bpm: 230 }, 'bpm'],
    ['a non-finite number', { ...TAB, bpm: 'NaN' }, 'invalid'],
    ['beats out of order', { ...TAB, beats: [TAB.beats[1], TAB.beats[0], ...TAB.beats.slice(2)] }, 'invalid'],
    ['a beat past the end', { ...TAB, beats: [...TAB.beats.slice(0, -1), TAB.duration + 5] }, 'invalid'],
    ['too few beats', { ...TAB, beats: TAB.beats.slice(0, 10), downbeats: [] }, 'beat-count'],
    ['beats covering only part of the song', { ...TAB, beats: TAB.beats.slice(0, Math.floor(TAB.beats.length / 2)), downbeats: [] }, 'beat-span'],
    ['every other beat', { ...TAB, beats: TAB.beats.filter((_: number, i: number) => i % 2 === 0), downbeats: [] }, 'beat-count'],
    ['a downbeat past the beats', { ...TAB, downbeats: [...TAB.downbeats, TAB.beats.length] }, 'invalid'],
    ['a gap between sections', { ...TAB, sections: sec.map((s: { start: number }, i: number) => (i === 1 ? { ...s, start: s.start + 1 } : s)) }, 'sections'],
    ['sections ending early', { ...TAB, sections: sec.map((s: { end: number }, i: number) => (i === last ? { ...s, end: s.end - 3 } : s)) }, 'sections'],
    ['an unknown section type', { ...TAB, sections: sec.map((s: object, i: number) => (i ? s : { ...s, type: 'bridge' })) }, 'invalid'],
    ['no sections', { ...TAB, sections: [] }, 'invalid'],
  ])('rejects %s (bad-map), dispatching nothing', async (_, map, rule) => {
    const f = github();
    expect(await read(await handle(post(map), env, f, NOW))).toEqual({ status: 400, body: { ok: false, error: 'bad-map', detail: rule } });
    expect(f.calls).toEqual([]);
  });

  it('agrees with the app/job validator (checkSharedMap) on every real map and on broken ones', () => {
    const names = readdirSync(PUBLIC).filter((f) => /^[A-Za-z0-9_-]{11}\.json$/.test(f));
    const cases: unknown[] = [];
    for (const n of names) {
      const m = JSON.parse(readFileSync(join(PUBLIC, n), 'utf8'));
      cases.push({ ...m, source: 'tab' }, { ...m, source: 'device' }, m, { ...m, source: 'tab', bpm: m.bpm * 1.2 }, { ...m, source: 'tab', beats: m.beats.slice(0, 40), downbeats: [] });
    }
    for (const c of cases) {
      const a = validateSharedMap(c);
      const b = checkSharedMap(c);
      expect(a.ok).toBe(b.ok);
      if (a.ok && b.ok) expect(a.map).toEqual(b.map);
    }
  });
});
