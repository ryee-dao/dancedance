import { describe, expect, it } from 'vitest';
import { checkTokenShape, dispatchAddSong, parseRepo, repoFromLocation, resolveRepo } from './github';

const TOKEN = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTU';
const repo = { owner: 'jo', repo: 'dancedance' };
const song = { artist: 'a-ha', title: 'Take On Me', durationSec: 225.4 };

function fakeFetch(status: number, body = '', headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, headers: new Headers(headers), text: async () => body };
  };
  return Object.assign(fn, { calls });
}

describe('dispatchAddSong', () => {
  it('POSTs the workflow dispatch to api.github.com with the token only in the Authorization header', async () => {
    const f = fakeFetch(204);
    const res = await dispatchAddSong(TOKEN, repo, song, [{ artist: 'ABBA', title: 'Waterloo', durationSec: 165 }], f);
    expect(res).toEqual({ ok: true });
    expect(f.calls).toHaveLength(1);
    const { url, init } = f.calls[0];
    expect(url).toBe('https://api.github.com/repos/jo/dancedance/actions/workflows/beatmaps.yml/dispatches');
    expect(url).not.toContain(TOKEN);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string)).toEqual({
      ref: 'main',
      inputs: {
        add_artist: 'a-ha',
        add_title: 'Take On Me',
        add_duration: '225',
        add_queue: '[{"artist":"ABBA","title":"Waterloo","duration":165}]',
      },
    });
    expect(init.body as string).not.toContain(TOKEN);
  });

  it('leaves add_queue out when nothing else is waiting', async () => {
    const f = fakeFetch(204);
    await dispatchAddSong(TOKEN, repo, song, [], f);
    expect(Object.keys(JSON.parse(f.calls[0].init.body as string).inputs)).toEqual(['add_artist', 'add_title', 'add_duration']);
  });

  it.each([
    [401, '{"message":"Bad credentials"}', {}, 'auth', /didn’t accept this token/],
    [403, '{"message":"Resource not accessible by personal access token"}', {}, 'permission', /Actions: Read and write/],
    [403, '{"message":"API rate limit exceeded"}', { 'x-ratelimit-remaining': '0' }, 'rate-limit', /Wait a few minutes/],
    [404, '{"message":"Not Found"}', {}, 'not-found', /couldn’t find the Beat maps workflow in jo\/dancedance/],
    [422, '{"message":"Unexpected inputs provided: [\\"add_queue\\"]"}', {}, 'invalid', /older than this app/],
    [422, '{"message":"No ref found for: main"}', {}, 'invalid', /no main branch/],
    [422, '{"message":"Workflow does not have \'workflow_dispatch\' trigger"}', {}, 'invalid', /can’t be started/],
    [502, '<html>', {}, 'server', /trouble/],
  ] as const)('maps %i %s to a plain-English message', async (status, body, headers, error, re) => {
    const res = await dispatchAddSong(TOKEN, repo, song, [], fakeFetch(status, body, headers));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe(error);
    expect(res.message).toMatch(re);
    expect(res.message).not.toContain(TOKEN);
  });

  it('network failure', async () => {
    const res = await dispatchAddSong(TOKEN, repo, song, [], async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(res).toMatchObject({ ok: false, error: 'network' });
  });

  it('accepts 200 (newer API versions return run details)', async () => {
    expect(await dispatchAddSong(TOKEN, repo, song, [], fakeFetch(200, '{"workflow_run_id":1}'))).toEqual({ ok: true });
  });
});

describe('repository and token', () => {
  it('derives owner/repo from a GitHub Pages address', () => {
    expect(repoFromLocation({ hostname: 'jo.github.io', pathname: '/dancedance/' })).toEqual(repo);
    expect(repoFromLocation({ hostname: 'jo.github.io', pathname: '/dancedance/index.html' })).toEqual(repo);
    expect(repoFromLocation({ hostname: 'jo.github.io', pathname: '/' })).toEqual({ owner: 'jo', repo: 'jo.github.io' });
    expect(repoFromLocation({ hostname: 'localhost', pathname: '/' })).toBeNull();
  });
  it('prefers Pages, then the build setting, then what was typed', () => {
    const pages = { hostname: 'jo.github.io', pathname: '/dancedance/' };
    const local = { hostname: 'localhost', pathname: '/' };
    expect(resolveRepo({ location: pages, envRepo: 'x/y', saved: 'a/b' })).toEqual({ repo, source: 'pages' });
    expect(resolveRepo({ location: local, envRepo: 'x/y', saved: 'a/b' })).toEqual({ repo: { owner: 'x', repo: 'y' }, source: 'build' });
    expect(resolveRepo({ location: local, envRepo: '', saved: 'a/b' })).toEqual({ repo: { owner: 'a', repo: 'b' }, source: 'saved' });
    expect(resolveRepo({ location: local })).toBeNull();
  });
  it('parses typed repository names', () => {
    expect(parseRepo('https://github.com/jo/dancedance.git')).toEqual(repo);
    expect(parseRepo(' jo/dancedance ')).toEqual(repo);
    expect(parseRepo('jo.github.io/dancedance')).toEqual(repo);
    expect(parseRepo('jo')).toBeNull();
    expect(parseRepo('jo/../x')).toBeNull();
    expect(parseRepo('-bad/x')).toBeNull();
  });
  it('checks the token shape', () => {
    expect(checkTokenShape(` ${TOKEN}\n`)).toEqual({ ok: true, token: TOKEN });
    expect(checkTokenShape('')).toMatchObject({ ok: false });
    expect(checkTokenShape('hello world')).toMatchObject({ ok: false, message: expect.stringMatching(/spaces/) });
    expect(checkTokenShape('sk-notatoken')).toMatchObject({ ok: false, message: expect.stringMatching(/github_pat_/) });
  });
});
