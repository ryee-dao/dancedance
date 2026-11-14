import { describe, expect, it } from 'vitest';
import { RELAY_VERSION as WORKER_RELAY_VERSION } from '../../cloudflare/add-song-worker/src/index';
import { summarizeRuns } from '../../cloudflare/add-song-worker/src/runs';
import {
  addRunDeployFailed,
  addRunOk,
  addRunUpdateFailed,
  deployRun,
  filesText,
  ghJob,
  ghRun,
  IMMORTAL,
  LIVE_SONGS,
  NOW,
  SECRET_TITLE,
  statusText,
} from './pipelineHealth.fixtures';
import {
  ago,
  assessHealth,
  githubRuns,
  latestDeploy,
  parseSiteData,
  RELAY_VERSION,
  repoFileUrl,
  youtubeState,
  type HealthCheck,
  type HealthInput,
  type RunsResult,
  type SiteData,
} from './pipelineHealth';

const ok = (runs: ReturnType<typeof addRunOk>[]): RunsResult => ({ state: 'ok', runs, via: 'github', at: NOW });
const relayOk: HealthInput['relay'] = { state: 'ok', configured: true, version: RELAY_VERSION };

const goodVideos = statusText({ aaaaaaaaaaa: { state: 'ok', lastTried: '2026-11-14T22:33:00Z' }, bbbbbbbbbbb: { state: 'ok', lastTried: '2026-11-14T22:32:00Z' } });

function site(o: { songs?: typeof LIVE_SONGS; at?: string; ids?: string[]; status?: string | null; songsStatus?: string | null }, repo = false): SiteData {
  const t = filesText({ songs: o.songs ?? LIVE_SONGS, songsAt: o.at ?? '2026-11-14T22:00:00Z', ids: o.ids ?? ['_Vj092UgKwQ'], mapsAt: o.at ?? '2026-11-14T22:00:00Z' });
  return parseSiteData(repo ? { ...t, status: o.status ?? goodVideos, songsStatus: o.songsStatus ?? JSON.stringify({ updatedAt: '2026-11-14T22:00:00Z', requests: {} }) } : t);
}

function byId(checks: HealthCheck[]): Record<string, HealthCheck> {
  return Object.fromEntries(checks.map((c) => [c.id, c]));
}

describe('song adding health: fixtures', () => {
  it('all ok', () => {
    const r = assessHealth({ now: NOW, relay: relayOk, runs: ok([addRunOk()]), live: site({}), repo: site({}, true) });
    expect(r.overall).toBe('ok');
    expect(r.summary).toBe('Adding songs is working');
    expect(r.checks.map((c) => [c.id, c.state])).toEqual([
      ['relay', 'ok'],
      ['job', 'ok'],
      ['site', 'ok'],
      ['youtube', 'ok'],
      ['live', 'ok'],
    ]);
    const c = byId(r.checks);
    expect(c.job.text).toBe('The last song job worked (23 min ago).');
    expect(c.site.text).toBe('The site last updated 25 min ago.');
    expect(r.checks.every((x) => !x.todo)).toBe(true);
  });

  it('update failed, YouTube blocking', () => {
    const blocked = statusText({ aaaaaaaaaaa: { state: 'blocked', reason: 'blocked', lastTried: '2026-11-14T22:44:00Z' }, bbbbbbbbbbb: { state: 'ok', lastTried: '2026-11-13T10:00:00Z' } });
    const r = assessHealth({ now: NOW, relay: relayOk, runs: ok([addRunUpdateFailed(), addRunOk()]), live: site({}), repo: site({ status: blocked }, true) });
    const c = byId(r.checks);
    expect(r.overall).toBe('problem');
    expect(c.job).toMatchObject({ state: 'problem', text: 'The last song job failed (15 min ago).' });
    expect(c.job.todo).toMatch(/Actions → Beat maps/);
    expect(c.youtube.state).toBe('problem');
    expect(c.youtube.text).toMatch(/^YouTube is blocking the cloud job/);
    expect(c.youtube.todo).toMatch(/beatmaps:local/);
    // The older run's deploy is still the latest site update, and it worked.
    expect(c.site.state).toBe('ok');
    expect(r.summary).toBe('2 problems with adding songs');
  });

  it('update ok, deploy failed (2026-11-14: a unit test failed), and the site is behind', () => {
    const repo = site({ songs: [...LIVE_SONGS, IMMORTAL], at: '2026-11-14T22:14:43Z', ids: ['_Vj092UgKwQ', IMMORTAL.videoId] }, true);
    const r = assessHealth({ now: NOW, relay: relayOk, runs: ok([addRunDeployFailed(), addRunOk(600, '2026-11-14T21:30:00Z', '2026-11-14T21:37:00Z')]), live: site({}), repo });
    const c = byId(r.checks);
    expect(c.job).toMatchObject({ state: 'ok', text: 'The last song job worked (42 min ago).' });
    expect(c.site.state).toBe('problem');
    expect(c.site.text).toBe('The site didn’t update after the last change (45 min ago): a test failed while it was being built.');
    expect(c.site.todo).toMatch(/Fix the failing test/);
    expect(c.live.state).toBe('problem');
    expect(c.live.text).toBe('A song was added but isn’t on the site yet: “My Immortal”.');
    expect(c.live.todo).toBe('They appear once the site update above works again.');
  });

  it('a later push deploy that worked counts as the latest site update', () => {
    const runs = [deployRun(9, 'success', '2026-11-14T22:30:00Z'), addRunDeployFailed()];
    expect(latestDeploy(runs)).toMatchObject({ state: 'success' });
    expect(latestDeploy([deployRun(10, 'success', '2026-11-14T22:40:00Z', 'in_progress'), ...runs])).toMatchObject({ state: 'running' });
  });

  it('relay unreachable', () => {
    const r = assessHealth({ now: NOW, relay: { state: 'unreachable' }, runs: ok([addRunOk()]), live: site({}), repo: site({}, true) });
    expect(byId(r.checks).relay).toMatchObject({ state: 'problem', text: 'Couldn’t reach the relay that starts the song job.' });
    expect(r.overall).toBe('problem');
  });

  it('relay outdated (no version in /health), or not set up', () => {
    const r = assessHealth({ now: NOW, relay: { state: 'ok', configured: true, version: 1 }, runs: ok([addRunOk()]), live: site({}), repo: site({}, true) });
    expect(byId(r.checks).relay).toMatchObject({ state: 'warn', todo: 'Redeploy it: npx wrangler deploy in cloudflare/add-song-worker.' });
    expect(r.overall).toBe('warn');
    expect(r.summary).toBe('Adding songs works, with one thing to look at');
    const bare = assessHealth({ now: NOW, relay: { state: 'ok', configured: false, version: 2 }, runs: null, live: null, repo: null });
    expect(byId(bare.checks).relay.state).toBe('problem');
    // Not using a relay (TV, or a token): no relay line at all.
    expect(assessHealth({ now: NOW, relay: null, runs: ok([addRunOk()]), live: site({}), repo: site({}, true) }).checks.map((c) => c.id)).not.toContain('relay');
  });

  it('API rate-limited: "couldn’t check", never an error', () => {
    const r = assessHealth({ now: NOW, relay: relayOk, runs: { state: 'rate-limited', until: NOW + 25 * 60_000, at: NOW }, live: site({}), repo: site({}, true) });
    const c = byId(r.checks);
    expect(c.job.state).toBe('unknown');
    expect(c.job.text).toMatch(/Try again in about 25 min\.$/);
    expect(c.site.state).toBe('unknown');
    // The checks that don't need GitHub's API still answer.
    expect(c.youtube.state).toBe('ok');
    expect(c.live.state).toBe('ok');
    expect(r.overall).toBe('ok');
    expect(r.summary).toBe('Adding songs looks fine (some checks couldn’t run)');
    const nothing = assessHealth({ now: NOW, relay: null, runs: { state: 'unavailable', at: NOW }, live: null, repo: null });
    expect(nothing.overall).toBe('unknown');
    expect(nothing.summary).toBe('Couldn’t check song adding right now');
  });

  it('site behind repo: on the way at first, a problem after the grace period', () => {
    const repo = (at: string) => site({ songs: [...LIVE_SONGS, IMMORTAL], at, ids: ['_Vj092UgKwQ', IMMORTAL.videoId] }, true);
    const fresh = byId(assessHealth({ now: NOW, relay: null, runs: ok([addRunOk()]), live: site({}), repo: repo('2026-11-14T22:55:00Z') }).checks).live;
    expect(fresh).toMatchObject({ state: 'ok', text: 'A new song is on the way to the site: “My Immortal”.' });
    const stale = byId(assessHealth({ now: NOW, relay: null, runs: ok([addRunOk()]), live: site({}), repo: repo('2026-11-14T22:30:00Z') }).checks).live;
    expect(stale).toMatchObject({ state: 'problem', todo: 'On GitHub: Actions → Deploy site → Run workflow.' });
    // Only maps changed (e.g. a local sync whose deploy failed).
    const maps = byId(assessHealth({ now: NOW, relay: null, runs: null, live: site({}), repo: site({ at: '2026-11-14T22:00:00Z', ids: ['_Vj092UgKwQ', 'ccccccccccc'] }, true) }).checks).live;
    expect(maps.state).toBe('ok'); // same timestamps: not behind
    const maps2 = byId(
      assessHealth({ now: NOW, relay: null, runs: null, live: site({}), repo: site({ at: '2026-11-14T22:20:00Z', ids: ['_Vj092UgKwQ', 'ccccccccccc'] }, true) }).checks,
    ).live;
    expect(maps2).toMatchObject({ state: 'problem', text: 'Newer beat maps are in the repository but not on the site yet.' });
    // A site newer than the repository (e.g. the dev server) is never "behind".
    expect(byId(assessHealth({ now: NOW, relay: null, runs: null, live: site({ at: '2026-11-14T22:50:00Z' }), repo: site({}, true) }).checks).live.state).toBe('ok');
    // Missing files: couldn't compare.
    expect(byId(assessHealth({ now: NOW, relay: null, runs: null, live: site({}), repo: null }).checks).live.state).toBe('unknown');
  });
});

describe('YouTube state', () => {
  it('looks at the newest attempts only', () => {
    const v = (state: 'ok' | 'blocked' | 'error', lastTried: string, reason?: string) => ({ videoId: 'x', state, lastTried, ...(reason ? { reason } : {}) });
    expect(youtubeState([v('blocked', '2026-11-10T00:00:00Z'), v('ok', '2026-11-14T22:00:00Z')], {}, null).state).toBe('ok');
    expect(youtubeState([v('ok', '2026-11-14T21:40:00Z'), v('error', '2026-11-14T22:00:00Z', 'outdated')], {}, null).state).toBe('outdated');
    expect(youtubeState([], { k: { state: 'map-pending', artist: 'a', title: 't', attempts: 1, lastTried: '2026-11-14T22:00:00Z' } }, null).state).toBe('blocked');
    expect(youtubeState(null, null, null).state).toBe('unknown');
  });
  it('a red "YouTube rejected the sign-in" step means the cookies expired', () => {
    const [run] = summarizeRuns({ workflow_runs: [ghRun({ id: 7, event: 'schedule', conclusion: 'failure', created: '2026-11-14T22:23:00Z' })] });
    run.jobs = [{ name: 'update', part: 'update', status: 'completed', conclusion: 'failure', startedAt: null, completedAt: null, failedStep: 'YouTube rejected the sign-in' }];
    expect(youtubeState([], {}, [run]).state).toBe('signin');
    const r = byId(assessHealth({ now: NOW, relay: null, runs: ok([run]), live: null, repo: null }).checks);
    expect(r.youtube.todo).toMatch(/YT_COOKIES/);
    expect(r.job.text).toMatch(/YouTube rejected its sign-in/);
  });
});

describe('fetching runs from GitHub without a token', () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
  it('one list call, jobs of the runs that need them, finished jobs remembered; titles never kept', async () => {
    const calls: string[] = [];
    const list = {
      workflow_runs: [
        ghRun({ id: 2, title: SECRET_TITLE, status: 'in_progress', created: '2026-11-14T22:50:00Z' }),
        ghRun({ id: 1, title: SECRET_TITLE, conclusion: 'failure', created: '2026-11-14T22:10:00Z' }),
        { ...ghRun({ id: 3, created: '2026-11-14T22:00:00Z' }), path: '.github/workflows/android.yml' },
      ],
    };
    const fetchFn = async (url: string) => {
      calls.push(url);
      const body = url.includes('/jobs') ? { jobs: [ghJob('update', 'in_progress', null, '2026-11-14T22:50:05Z', null, [['Make beat maps', 'in_progress', null]])] } : list;
      return { ok: true, status: 200, text: async () => JSON.stringify(body), headers: headers({}) };
    };
    const known = new Map();
    const r = await githubRuns({ owner: 'jo', repo: 'dd' }, known, NOW, fetchFn);
    expect(r.state).toBe('ok');
    if (r.state !== 'ok') return;
    expect(calls).toEqual([
      'https://api.github.com/repos/jo/dd/actions/runs?branch=main&per_page=20&exclude_pull_requests=true',
      'https://api.github.com/repos/jo/dd/actions/runs/2/jobs?per_page=20',
      'https://api.github.com/repos/jo/dd/actions/runs/1/jobs?per_page=20',
    ]);
    expect(r.runs.map((x) => [x.id, x.kind, x.status])).toEqual([
      [2, 'add', 'in_progress'],
      [1, 'add', 'completed'],
    ]);
    expect(r.runs[0].jobs?.[0]).toMatchObject({ part: 'update', step: 'Make beat maps' });
    const text = JSON.stringify(r);
    expect(text).not.toContain('Evanescence');
    expect(text).not.toContain('someone');
    expect(text).not.toContain('secret commit');
    // Finished runs' jobs are not asked for again.
    calls.length = 0;
    await githubRuns({ owner: 'jo', repo: 'dd' }, known, NOW, fetchFn);
    expect(calls.filter((u) => u.includes('/jobs'))).toEqual(['https://api.github.com/repos/jo/dd/actions/runs/2/jobs?per_page=20']);
  });

  it('rate limits become "try again at", other failures "unavailable"', async () => {
    const reset = Math.floor((NOW + 20 * 60_000) / 1000);
    const limited = async () => ({ ok: false, status: 403, text: async () => '{"message":"API rate limit exceeded for 1.2.3.4."}', headers: headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }) });
    expect(await githubRuns({ owner: 'jo', repo: 'dd' }, new Map(), NOW, limited)).toEqual({ state: 'rate-limited', until: reset * 1000, at: NOW });
    const secondary = async () => ({ ok: false, status: 429, text: async () => '', headers: headers({}) });
    expect(await githubRuns({ owner: 'jo', repo: 'dd' }, new Map(), NOW, secondary)).toMatchObject({ state: 'rate-limited', until: NOW + 10 * 60_000 });
    const down = async () => ({ ok: false, status: 502, text: async () => 'bad gateway', headers: headers({}) });
    expect(await githubRuns({ owner: 'jo', repo: 'dd' }, new Map(), NOW, down)).toEqual({ state: 'unavailable', at: NOW });
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await githubRuns({ owner: 'jo', repo: 'dd' }, new Map(), NOW, offline)).toEqual({ state: 'unavailable', at: NOW });
  });
});

describe('helpers', () => {
  it('site files: odd or missing files count as missing', () => {
    expect(parseSiteData({ songs: '<!doctype html>', index: null })).toEqual({ songs: null, songsAt: null, mapIds: null, mapsAt: null });
    expect(repoFileUrl({ owner: 'ryee-dao', repo: 'dancedance' }, 'beatmaps/index.json')).toBe('https://raw.githubusercontent.com/ryee-dao/dancedance/main/public/beatmaps/index.json');
  });
  it('plain times', () => {
    expect(ago(NOW - 20_000, NOW)).toBe('just now');
    expect(ago(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(ago(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago');
    expect(ago(NOW - 3 * 86_400_000, NOW)).toBe('3 days ago');
    expect(ago(null, NOW)).toBe('some time ago');
  });
  it('the app expects the relay version the relay code reports', () => {
    expect(RELAY_VERSION).toBe(WORKER_RELAY_VERSION);
  });
});
