/**
 * Progress of one song being added: a stage, a percentage and a cautious
 * estimate of the time left. Pure (tests: songProgress.test.ts).
 *
 * Stages and their share of the bar, with the time each is expected to take.
 * Measured on a real add since song data deploys without the tests (2026-11-14,
 * run 43648725768): whole run 2 min 14 s; `update` 1 min 44 s (about 1 min
 * installing tools, then ~30-40 s per song it handles: it can also handle other
 * waiting songs); `deploy` 19 s; then the app notices on its next 30 s poll.
 * The expectations below are deliberately longer (about 4 min 45 s in all,
 * against ~3 min in practice), so the song tends to arrive early, not late.
 *
 *   starting    0-5 %   the request is sent, GitHub hasn't shown the run yet    45 s
 *   queued      5 %     the run waits for another song job (no estimate)
 *   setup       5-35 %  the job installs its tools                              1 min 15 s
 *   analysing   35-75 % finding the song on YouTube and working out its beats   1 min 30 s
 *   publishing  75-97 % the beat map is committed; the site is being updated    1 min 15 s
 *   live        100 %   only once the song is in the site's own song list
 *
 * A stage counts as overrun (and says "taking longer than usual") after 1.5x
 * its expected time plus a minute, e.g. when the site update waits behind a code
 * push's deploy, which still runs the full checks (~3 min).
 *
 * Real signals pick the stage (the run, its jobs and current step, the song
 * appearing in the repository, then on the site). Time only fills the bar
 * within a stage, slowing down as it nears the end, and never reaches the next
 * stage's start on its own. Without any run data (GitHub couldn't be asked),
 * "starting" to "analysing" is one stretch timed from when the song was sent.
 */
import { deployOutcome, failed, updateJob, type RunSummary } from './pipelineHealth';

export type Stage = 'starting' | 'queued' | 'setup' | 'analysing' | 'publishing' | 'live' | 'failed';

export interface ProgressSignals {
  now: number;
  /** When this browser sent the song (epoch ms). */
  sentAt: number;
  /** The Beat maps run handling this song (matchRun), if known. */
  run: RunSummary | null;
  /** Whether run data could be fetched at all (false: GitHub rate-limited or unreachable). */
  runsKnown: boolean;
  /** Another Beat maps run is going (so a queued run waits behind it). */
  otherRunning?: boolean;
  /** First time the song was seen in the repository's songs.json (epoch ms), or null. */
  inRepoSince: number | null;
  /** The song is in the live site's songs.json. */
  live: boolean;
  /** The highest percentage shown so far for this song (the bar never goes back). */
  floor?: number;
}

export interface Progress {
  stage: Stage;
  /** 0-100; 100 only when live. */
  percent: number;
  /** What is happening, e.g. "Making the beat map". */
  label: string;
  /** "about 5 min left", "about 1 min left", "any moment now", "taking longer than usual", or null (waiting / failed / live). */
  eta: string | null;
  overrun: boolean;
  /** For 'failed': which part failed. */
  failure?: 'job' | 'site';
}

const MIN = 60_000;
interface Span {
  from: number;
  to: number;
  ms: number;
}
export const SPANS = {
  starting: { from: 0, to: 5, ms: 0.75 * MIN },
  setup: { from: 5, to: 35, ms: 1.25 * MIN },
  analysing: { from: 35, to: 75, ms: 1.5 * MIN },
  publishing: { from: 75, to: 97, ms: 1.25 * MIN },
} satisfies Record<string, Span>;
const QUEUED_PERCENT = 5;
/** Without run data: starting + setup + analysing as one stretch. */
const BLIND: Span = { from: 0, to: SPANS.analysing.to, ms: SPANS.starting.ms + SPANS.setup.ms + SPANS.analysing.ms };
/** A stage counts as overrun once it has taken this much longer than expected. */
export const overrunAfter = (ms: number) => ms * 1.5 + MIN;

/** Share of a stage done after `elapsed`: linear to 85 % at the expected time, then creeping towards (never reaching) 99 %. */
function fill(elapsed: number, ms: number): number {
  const e = Math.max(0, elapsed);
  if (e <= ms) return (0.85 * e) / ms;
  return 0.85 + 0.14 * (1 - Math.exp(-(e - ms) / ms));
}

function pct(span: Span, elapsed: number): number {
  const p = Math.floor(span.from + (span.to - span.from) * fill(elapsed, span.ms));
  return Math.min(Math.max(p, span.from), span.to - 1);
}

/** Coarse, rounded-up time left. */
export function etaText(remainingMs: number): string {
  if (remainingMs <= 0) return 'any moment now';
  if (remainingMs <= MIN) return 'about 1 min left';
  return `about ${Math.ceil(remainingMs / MIN)} min left`;
}

const t = (iso: string | null | undefined): number | null => {
  const v = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(v) ? v : null;
};

/**
 * The run that handles a song sent at `sentAt`: the Beat maps "Add song" runs
 * created since then (90 s allowed for clock differences), oldest first; the
 * first still going, else the newest finished one. (A later add sends the
 * songs still waiting along with it, so a newer run can handle this song too.)
 */
export function matchRun(runs: readonly RunSummary[] | null, sentAt: number, inRepo = false): RunSummary | null {
  if (!runs) return null;
  const mine = runs
    .filter((r) => r.workflow === 'beatmaps' && r.kind === 'add' && Date.parse(r.createdAt) >= sentAt - 90_000)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (inRepo) {
    // Already committed: what matters is the run that committed it, until a later run's site update is under way.
    const committed = mine.find((r) => r.status === 'completed' && (updateJob(r) ? updateJob(r)!.conclusion === 'success' : r.conclusion === 'success'));
    if (committed) {
      const later = mine.filter((r) => r !== committed && Date.parse(r.createdAt) > Date.parse(committed.createdAt));
      const publishing = [...later].reverse().find((r) => ['running', 'success'].includes(deployOutcome(r).state));
      return publishing ?? committed;
    }
  }
  return mine.find((r) => r.status !== 'completed') ?? mine[mine.length - 1] ?? null;
}

export function songProgress(s: ProgressSignals): Progress {
  const { now, run } = s;
  if (s.live) return { stage: 'live', percent: 100, label: 'On the site', eta: null, overrun: false };
  const floor = Math.min(s.floor ?? 0, 96);
  const upd = run ? updateJob(run) : undefined;
  const dep = run ? deployOutcome(run) : null;

  // Failures: the job failed before the song got in, or the site didn't publish it.
  const updFailed = !!run && run.status === 'completed' && (upd ? failed(upd.conclusion) : failed(run.conclusion) && s.inRepoSince === null);
  if (updFailed && s.inRepoSince === null) {
    return { stage: 'failed', percent: Math.max(floor, SPANS.setup.from), label: 'The song job failed', eta: null, overrun: false, failure: 'job' };
  }
  // (The update job can also go red after committing, e.g. on a rejected YouTube sign-in: then the deploy still runs.)
  const siteFailed = !!run && run.status === 'completed' && (dep?.state === 'failure' || (!run.jobs && failed(run.conclusion) && s.inRepoSince !== null));
  if (siteFailed) {
    return { stage: 'failed', percent: Math.max(floor, SPANS.publishing.from), label: 'The site didn’t update', eta: null, overrun: false, failure: 'site' };
  }

  const at = (stage: Exclude<Stage, 'queued' | 'live' | 'failed'>, span: Span, since: number, label: string, laterMs: number): Progress => {
    const elapsed = now - since;
    const overrun = elapsed > overrunAfter(span.ms);
    const remaining = Math.max(0, span.ms - elapsed) + laterMs;
    return {
      stage,
      percent: Math.max(floor, pct(span, elapsed)),
      label,
      eta: overrun ? 'taking longer than usual' : etaText(remaining),
      overrun,
    };
  };

  // Publishing: the map is committed (seen in the repository, or the update job finished well), or the deploy job runs.
  const updDone = upd?.status === 'completed' && upd.conclusion === 'success';
  if (s.inRepoSince !== null || updDone || dep?.state === 'running' || (run?.status === 'completed' && run.conclusion === 'success')) {
    const since = Math.min(
      ...[t(upd?.completedAt), dep?.state === 'running' ? t(dep.at) : null, s.inRepoSince, run?.status === 'completed' ? t(run.updatedAt) : null].filter(
        (x): x is number => x !== null,
      ),
      now,
    );
    return at('publishing', SPANS.publishing, since, 'Putting it on the site', 0);
  }

  if (run && run.status === 'queued') {
    return {
      stage: 'queued',
      percent: Math.max(floor, QUEUED_PERCENT),
      label: s.otherRunning ? 'Waiting for another song job to finish' : 'Waiting for GitHub to start the job',
      eta: null,
      overrun: false,
    };
  }

  if (run && run.status === 'in_progress') {
    if (upd && upd.status === 'in_progress' && upd.phase === 'work') {
      const since = t(upd.phaseStartedAt) ?? t(upd.startedAt) ?? t(run.startedAt) ?? now;
      return at('analysing', SPANS.analysing, since, 'Finding the song and working out its beats', SPANS.publishing.ms);
    }
    if (upd) {
      const since = t(upd.startedAt) ?? t(run.startedAt) ?? now;
      return at('setup', SPANS.setup, since, 'Getting the job ready', SPANS.analysing.ms + SPANS.publishing.ms);
    }
    // Running, but its jobs aren't known: setup and analysing as one stretch from the run's start.
    const span: Span = { from: SPANS.setup.from, to: SPANS.analysing.to, ms: SPANS.setup.ms + SPANS.analysing.ms };
    return at('analysing', span, t(run.startedAt) ?? now, 'Making the beat map', SPANS.publishing.ms);
  }

  if (!s.runsKnown) return at('analysing', BLIND, s.sentAt, 'Making the beat map', SPANS.publishing.ms);
  return at('starting', SPANS.starting, s.sentAt, 'Starting the song job', SPANS.setup.ms + SPANS.analysing.ms + SPANS.publishing.ms);
}
