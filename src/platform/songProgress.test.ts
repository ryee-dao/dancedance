import { describe, expect, it } from 'vitest';
import { summarizeJobs, summarizeRuns, type RunSummary } from '../../cloudflare/add-song-worker/src/runs';
import { addRunDeployFailed, addRunOk, addRunUpdateFailed, ghJob, ghRun } from './pipelineHealth.fixtures';
import { etaText, matchRun, songProgress, SPANS, type ProgressSignals } from './songProgress';

const SENT = Date.parse('2026-11-14T22:10:00Z');
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
const MIN = 60_000;

/** An add run created 15 s after the send, in the given state. */
function run(status: 'queued' | 'in_progress' | 'completed', jobs?: Record<string, unknown>[], conclusion: string | null = null): RunSummary {
  const [r] = summarizeRuns({ workflow_runs: [ghRun({ id: 77, title: 'Add song: A - B', status, conclusion, created: iso(SENT + 15_000) })] });
  if (jobs) r.jobs = summarizeJobs({ jobs });
  return r;
}
const setupJob = () => ghJob('update', 'in_progress', null, iso(SENT + 20_000), null, [['npm ci', 'in_progress', null, iso(SENT + 30_000)]]);
const mapsJob = (stepAt = SENT + 80_000) => ghJob('update', 'in_progress', null, iso(SENT + 20_000), null, [['Make beat maps', 'in_progress', null, iso(stepAt)]]);

const sig = (o: Partial<ProgressSignals>): ProgressSignals => ({ now: SENT, sentAt: SENT, run: null, runsKnown: true, inRepoSince: null, live: false, ...o });

describe('song progress', () => {
  it('starting: just sent, no run yet; the whole job still ahead', () => {
    const p = songProgress(sig({ now: SENT + 10_000 }));
    expect(p).toMatchObject({ stage: 'starting', label: 'Starting the song job', overrun: false });
    expect(p.percent).toBeGreaterThanOrEqual(0);
    expect(p.percent).toBeLessThan(SPANS.setup.from);
    expect(p.eta).toBe('about 11 min left'); // 50 s + 1.5 + 4 + 4 min, rounded up
  });

  it('queued behind another run: says it is waiting and gives no ticking estimate', () => {
    const p = songProgress(sig({ now: SENT + 5 * MIN, run: run('queued'), otherRunning: true }));
    expect(p).toEqual({ stage: 'queued', percent: 4, label: 'Waiting for another song job to finish', eta: null, overrun: false });
    expect(songProgress(sig({ now: SENT + 10 * MIN, run: run('queued') })).eta).toBeNull();
    expect(songProgress(sig({ run: run('queued') })).label).toBe('Waiting for GitHub to start the job');
  });

  it('setup, then analysing, then publishing, driven by the job and step', () => {
    const setup = songProgress(sig({ now: SENT + 50_000, run: run('in_progress', [setupJob()]) }));
    expect(setup).toMatchObject({ stage: 'setup', label: 'Getting the job ready' });
    expect(setup.percent).toBeGreaterThanOrEqual(5);
    expect(setup.percent).toBeLessThan(20);
    expect(setup.eta).toBe('about 9 min left');
    const maps = songProgress(sig({ now: SENT + 80_000 + 2 * MIN, run: run('in_progress', [mapsJob()]) }));
    expect(maps).toMatchObject({ stage: 'analysing', label: 'Finding the song and working out its beats', eta: 'about 6 min left' });
    expect(maps.percent).toBeGreaterThanOrEqual(20);
    expect(maps.percent).toBeLessThan(65);
    const committed = SENT + 5 * MIN;
    const pub = songProgress(sig({ now: committed + 2 * MIN, run: run('in_progress', [ghJob('update', 'completed', 'success', iso(SENT + 20_000), iso(committed)), ghJob('deploy / build', 'in_progress', null, iso(committed + 2000), null)]) }));
    expect(pub).toMatchObject({ stage: 'publishing', label: 'Putting it on the site', eta: 'about 2 min left' });
    expect(pub.percent).toBeGreaterThanOrEqual(65);
    expect(pub.percent).toBeLessThan(97);
  });

  it('time alone never reaches the next stage, and never 100 % before the song is live', () => {
    for (const minutes of [1, 3, 6, 10, 30, 120, 10_000]) {
      const now = SENT + 80_000 + minutes * MIN;
      expect(songProgress(sig({ now, run: run('in_progress', [mapsJob()]) })).percent).toBeLessThan(SPANS.publishing.from);
      expect(songProgress(sig({ now, run: run('in_progress', [setupJob()]) })).percent).toBeLessThan(SPANS.analysing.from);
      expect(songProgress(sig({ now, inRepoSince: SENT + 80_000 })).percent).toBeLessThan(97);
      expect(songProgress(sig({ now })).percent).toBeLessThan(SPANS.setup.from);
    }
    expect(songProgress(sig({ live: true }))).toEqual({ stage: 'live', percent: 100, label: 'On the site', eta: null, overrun: false });
  });

  it('the estimate counts down coarsely and never past zero; an overrun says so', () => {
    const at = (min: number) => songProgress(sig({ now: SENT + min * MIN, inRepoSince: SENT })).eta;
    expect([at(0), at(1.2), at(3.1), at(3.9), at(4.5), at(6.9)]).toEqual(['about 4 min left', 'about 3 min left', 'about 1 min left', 'about 1 min left', 'any moment now', 'any moment now']);
    expect(at(7.1)).toBe('taking longer than usual');
    expect(songProgress(sig({ now: SENT + 7.1 * MIN, inRepoSince: SENT })).overrun).toBe(true);
    // An overrun earlier stage also says so instead of sitting on a number.
    expect(songProgress(sig({ now: SENT + 80_000 + 8 * MIN, run: run('in_progress', [mapsJob()]) })).eta).toBe('taking longer than usual');
    expect([0, -5, 1, 60_000, 60_001, 119_000, 241_000].map(etaText)).toEqual([
      'any moment now',
      'any moment now',
      'about 1 min left',
      'about 1 min left',
      'about 2 min left',
      'about 2 min left',
      'about 5 min left',
    ]);
  });

  it('failed: the job failed before the song got in, or the site didn’t publish it', () => {
    const job = songProgress(sig({ now: Date.parse('2026-11-14T22:46:00Z'), sentAt: Date.parse('2026-11-14T22:39:50Z'), run: addRunUpdateFailed() }));
    expect(job).toMatchObject({ stage: 'failed', failure: 'job', label: 'The song job failed', eta: null });
    const site = songProgress(sig({ now: Date.parse('2026-11-14T22:20:00Z'), run: addRunDeployFailed(), inRepoSince: Date.parse('2026-11-14T22:15:00Z') }));
    expect(site).toMatchObject({ stage: 'failed', failure: 'site', label: 'The site didn’t update', eta: null, percent: 65 });
    // Even before the repository copy shows the song, the deploy job's failure says it.
    expect(songProgress(sig({ now: Date.parse('2026-11-14T22:20:00Z'), run: addRunDeployFailed() })).failure).toBe('site');
    // An update job that went red after committing (rejected YouTube sign-in) still publishes: not a failure.
    const late = run('completed', [ghJob('update', 'completed', 'failure', iso(SENT + 20_000), iso(SENT + 5 * MIN), [['YouTube rejected the sign-in', 'completed', 'failure']]), ghJob('deploy / build', 'in_progress', null, iso(SENT + 5 * MIN), null)], 'failure');
    late.status = 'in_progress';
    expect(songProgress(sig({ now: SENT + 6 * MIN, run: late, inRepoSince: SENT + 5.5 * MIN })).stage).toBe('publishing');
  });

  it('without any run data, one stretch timed from the send; the bar never goes back', () => {
    const blind = songProgress(sig({ now: SENT + 3 * MIN, runsKnown: false }));
    expect(blind).toMatchObject({ stage: 'analysing', label: 'Making the beat map' });
    expect(blind.percent).toBeLessThan(65);
    const later = songProgress(sig({ now: SENT + 3 * MIN, run: run('in_progress', [setupJob()]), floor: blind.percent }));
    expect(later.stage).toBe('setup');
    expect(later.percent).toBe(blind.percent);
  });

  it('matches the run started for the song (not older ones), preferring one still going', () => {
    const old = addRunOk(1, '2026-11-14T21:00:00Z', '2026-11-14T21:07:00Z');
    const a = run('completed', undefined, 'failure');
    const b = { ...run('in_progress'), id: 78, createdAt: iso(SENT + 5 * MIN) };
    expect(matchRun([old], SENT)).toBeNull();
    expect(matchRun([b, a, old], SENT)?.id).toBe(78);
    expect(matchRun([a, old], SENT)?.id).toBe(77);
    expect(matchRun(null, SENT)).toBeNull();
  });

  it('a committed song follows the run that committed it, not a later run still making other maps', () => {
    const sent = Date.parse('2026-11-14T22:10:00Z');
    const stuck = addRunDeployFailed();
    const [next] = summarizeRuns({ workflow_runs: [ghRun({ id: 900, title: 'Add song: ABBA - Waterloo', status: 'in_progress', created: '2026-11-14T22:40:00Z' })] });
    next.jobs = summarizeJobs({ jobs: [mapsJob(Date.parse('2026-11-14T22:41:00Z'))] });
    expect(matchRun([next, stuck], sent, true)?.id).toBe(stuck.id);
    expect(songProgress(sig({ now: Date.parse('2026-11-14T22:42:00Z'), sentAt: sent, run: matchRun([next, stuck], sent, true), inRepoSince: sent })).failure).toBe('site');
    // Once the later run is publishing the site, the song rides along with it.
    next.jobs = summarizeJobs({ jobs: [ghJob('update', 'completed', 'success', '2026-11-14T22:40:05Z', '2026-11-14T22:44:00Z'), ghJob('deploy / build', 'in_progress', null, '2026-11-14T22:44:02Z', null)] });
    expect(matchRun([next, stuck], sent, true)?.id).toBe(900);
    // Not yet committed: the run still going.
    expect(matchRun([next, stuck], sent, false)?.id).toBe(900);
  });
});
