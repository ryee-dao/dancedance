/**
 * GitHub API answers (trimmed to the fields used, plus a few that must be
 * dropped) modelled on real runs of 2026-11-14, for the health and progress tests.
 */
import { summarizeJobs, summarizeRuns, type RunSummary } from '../../cloudflare/add-song-worker/src/runs';

export const NOW = Date.parse('2026-11-14T23:00:00Z');
export const SECRET_TITLE = 'Add song: Evanescence - My Immortal';

type Raw = Record<string, unknown>;

export function ghRun(o: { id: number; wf?: 'beatmaps' | 'deploy'; event?: string; title?: string; status?: string; conclusion?: string | null; created: string; updated?: string }): Raw {
  return {
    id: o.id,
    name: o.wf === 'deploy' ? 'Deploy site' : 'Beat maps',
    path: `.github/workflows/${o.wf === 'deploy' ? 'deploy' : 'beatmaps'}.yml`,
    event: o.event ?? 'workflow_dispatch',
    display_title: o.title ?? 'Beat maps',
    status: o.status ?? 'completed',
    conclusion: o.status && o.status !== 'completed' ? null : (o.conclusion ?? 'success'),
    created_at: o.created,
    run_started_at: o.created,
    updated_at: o.updated ?? o.created,
    head_commit: { message: 'secret commit message', author: { email: 'someone@example.com' } },
    actor: { login: 'someone' },
  };
}

export function ghJob(name: string, status: string, conclusion: string | null, started: string | null, completed: string | null, steps: [string, string, string | null, string?][] = []): Raw {
  return {
    name,
    status,
    conclusion,
    started_at: started,
    completed_at: completed,
    steps: steps.map(([n, st, c, at]) => ({ name: n, status: st, conclusion: c, started_at: at ?? started })),
  };
}

/** Today's failure: the update job committed the song, then the deploy's tests failed. */
export function addRunDeployFailed(): RunSummary {
  const [run] = summarizeRuns({
    workflow_runs: [ghRun({ id: 43646660709, title: SECRET_TITLE, conclusion: 'failure', created: '2026-11-14T22:10:18Z', updated: '2026-11-14T22:17:31Z' })],
  });
  run.jobs = summarizeJobs({
    jobs: [
      ghJob('update', 'completed', 'success', '2026-11-14T22:10:21Z', '2026-11-14T22:14:51Z'),
      ghJob('deploy / build', 'completed', 'failure', '2026-11-14T22:14:53Z', '2026-11-14T22:17:30Z', [
        ['npm ci', 'completed', 'success'],
        ['Run npm test', 'completed', 'failure'],
      ]),
      ghJob('deploy / deploy', 'completed', 'skipped', '2026-11-14T22:17:31Z', '2026-11-14T22:17:30Z'),
    ],
  });
  return run;
}

/** An add run whose update job failed in the beat-map step (YouTube refused it). */
export function addRunUpdateFailed(): RunSummary {
  const [run] = summarizeRuns({
    workflow_runs: [ghRun({ id: 501, title: SECRET_TITLE, conclusion: 'failure', created: '2026-11-14T22:40:00Z', updated: '2026-11-14T22:45:00Z' })],
  });
  run.jobs = summarizeJobs({
    jobs: [
      ghJob('update', 'completed', 'failure', '2026-11-14T22:40:03Z', '2026-11-14T22:45:00Z', [
        ['Install yt-dlp', 'completed', 'success'],
        ['Make beat maps', 'completed', 'failure'],
        ['Commit beat maps', 'completed', 'success'],
      ]),
      ghJob('deploy', 'completed', 'skipped', null, null),
    ],
  });
  return run;
}

/** A good add run that published the site. */
export function addRunOk(id = 600, created = '2026-11-14T22:30:00Z', updated = '2026-11-14T22:37:00Z'): RunSummary {
  const [run] = summarizeRuns({ workflow_runs: [ghRun({ id, title: 'Add song: ABBA - Waterloo', created, updated })] });
  const at = (sec: number) => new Date(Date.parse(created) + sec * 1000).toISOString().replace('.000Z', 'Z');
  run.jobs = summarizeJobs({
    jobs: [
      ghJob('update', 'completed', 'success', created, at(270)),
      ghJob('deploy / build', 'completed', 'success', at(272), at(400)),
      ghJob('deploy / deploy', 'completed', 'success', at(401), updated),
    ],
  });
  return run;
}

export function deployRun(id: number, conclusion: string, created: string, status = 'completed'): RunSummary {
  return summarizeRuns({ workflow_runs: [ghRun({ id, wf: 'deploy', event: 'push', title: 'Some commit', status, conclusion, created })] })[0];
}

const song = (videoId: string, artist: string, title: string) => ({ videoId, title, artist, addedAt: '2026-11-14T22:14:00Z', durationSec: 260, hasMap: true });

export const LIVE_SONGS = [song('_Vj092UgKwQ', 'Bee Gees', "Stayin' Alive")];
export const IMMORTAL = song('5anLPw0Efmo', 'Evanescence', 'My Immortal');

export function filesText(o: { songs: ReturnType<typeof song>[]; songsAt: string; ids: string[]; mapsAt: string }): { songs: string; index: string } {
  return {
    songs: JSON.stringify({ updatedAt: o.songsAt, songs: o.songs }),
    index: JSON.stringify({ analyzerVersion: '1.4.0', generatedAt: o.mapsAt, ids: o.ids, songs: {} }),
  };
}

export function statusText(videos: Record<string, { state: string; reason?: string; lastTried: string }>): string {
  return JSON.stringify({ updatedAt: '2026-11-14T22:14:43Z', videos: Object.fromEntries(Object.entries(videos).map(([k, v]) => [k, { ...v, attempts: 1 }])) });
}
