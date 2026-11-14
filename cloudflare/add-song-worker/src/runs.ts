/**
 * GitHub Actions runs reduced to what the app's "song adding" health check and
 * progress need. Pure, no dependencies: used by the relay's GET /runs and by
 * the app itself when it asks GitHub directly (src/platform/pipelineHealth.ts),
 * so both give the same answer.
 *
 * Kept: run and job status, conclusion and times, the kind of run, job names,
 * and a few fixed flags worked out here from the steps (which part of a job is
 * running, where a failure happened, whether YouTube rejected the sign-in).
 * Never kept: run titles (they hold song names), step names, inputs, actors,
 * commits, logs or anything else.
 */

/** The run-name beatmaps.yml gives contributed-map runs. */
export const MAP_RUN_TITLE = 'Contributed beat map';
/** The run-name prefix beatmaps.yml gives runs started by "add a song". */
export const ADD_RUN_TITLE = 'Add song:';

/** Step names in beatmaps.yml / deploy.yml the flags are worked out from. */
const STEP_SIGNIN = 'YouTube rejected the sign-in';
const STEP_MAPS = 'Make beat maps';
/** Update-job steps after its tools are installed (the song work itself). */
const WORK_STEPS = new Set([STEP_MAPS, 'Keep the YouTube session fresh', 'Commit beat maps', STEP_SIGNIN]);
/** deploy.yml's check steps ("Run npm test", "Run npm run typecheck"). */
const CHECK_STEP_RE = /\bnpm (?:test|run typecheck)\b/;

const RUN_WORKFLOWS: Record<string, 'beatmaps' | 'deploy'> = {
  '.github/workflows/beatmaps.yml': 'beatmaps',
  '.github/workflows/deploy.yml': 'deploy',
};
const CONCLUSIONS = new Set(['success', 'failure', 'cancelled', 'skipped', 'timed_out', 'action_required', 'neutral', 'stale', 'startup_failure']);
const ISO_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const CTRL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const KINDS = ['add', 'map', 'scheduled', 'manual', 'push', 'other'] as const;
const PARTS = ['update', 'deploy', 'other'] as const;
const STATUSES = ['queued', 'in_progress', 'completed'] as const;
const PHASES = ['setup', 'work'] as const;
const FAILED_AT = ['tests', 'build', 'download', 'other'] as const;

export type RunStatus = (typeof STATUSES)[number];

export interface RunJob {
  name: string;
  /** 'update' = makes the beat maps and commits them; 'deploy' = builds and publishes the site. */
  part: (typeof PARTS)[number];
  status: RunStatus;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Update job, while running: installing its tools ('setup'), or finding and analysing songs ('work'). */
  phase?: (typeof PHASES)[number];
  phaseStartedAt?: string;
  /**
   * Where the job failed: 'tests' (the site's type-check or tests), 'build' (building or
   * publishing the site), 'download' (finding or analysing songs), 'other'.
   */
  failedAt?: (typeof FAILED_AT)[number];
  /** YouTube rejected the job's sign-in (the cookies have expired). */
  signInRejected?: true;
}

export interface RunSummary {
  id: number;
  workflow: 'beatmaps' | 'deploy';
  kind: (typeof KINDS)[number];
  status: RunStatus;
  conclusion: string | null;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
  jobs?: RunJob[];
}

const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
/** GitHub's statuses: queued, waiting, requested, pending (all "not started") / in_progress / completed. */
const runStatus = (v: unknown): RunStatus => (v === 'completed' ? 'completed' : v === 'in_progress' ? 'in_progress' : 'queued');
const conclusion = (v: unknown): string | null => (typeof v === 'string' && CONCLUSIONS.has(v) ? v : null);
const iso = (v: unknown): string | null => (typeof v === 'string' && ISO_RE.test(v) ? v : null);
const shortName = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 && v.length <= 80 && !CTRL_RE.test(v) ? v : undefined);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined => ((list as readonly unknown[]).includes(v) ? (v as T) : undefined);

/** One GitHub workflow run (REST API shape) reduced; null for other workflows or odd data. */
export function summarizeRun(raw: unknown): RunSummary | null {
  if (!obj(raw)) return null;
  const workflow = typeof raw.path === 'string' ? RUN_WORKFLOWS[raw.path] : undefined;
  const id = raw.id;
  const createdAt = iso(raw.created_at);
  if (!workflow || typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || !createdAt) return null;
  const title = typeof raw.display_title === 'string' ? raw.display_title : '';
  const event = raw.event;
  const kind: RunSummary['kind'] =
    workflow === 'deploy'
      ? event === 'push'
        ? 'push'
        : 'manual'
      : title.startsWith(MAP_RUN_TITLE)
        ? 'map'
        : title.startsWith(ADD_RUN_TITLE)
          ? 'add'
          : event === 'schedule'
            ? 'scheduled'
            : event === 'workflow_dispatch'
              ? 'manual'
              : 'other';
  return {
    id,
    workflow,
    kind,
    status: runStatus(raw.status),
    conclusion: conclusion(raw.conclusion),
    createdAt,
    startedAt: iso(raw.run_started_at) ?? createdAt,
    updatedAt: iso(raw.updated_at) ?? createdAt,
  };
}

/** GitHub's `{ workflow_runs: [...] }` reduced (other workflows dropped), newest first as GitHub sends them. */
export function summarizeRuns(raw: unknown): RunSummary[] {
  const list = obj(raw) && Array.isArray(raw.workflow_runs) ? raw.workflow_runs : [];
  return list.map(summarizeRun).filter((r): r is RunSummary => !!r);
}

/** GitHub's `{ jobs: [...] }` for one run: name, state, times and the flags above (no step names). */
export function summarizeJobs(raw: unknown): RunJob[] {
  const jobs = obj(raw) && Array.isArray(raw.jobs) ? raw.jobs : [];
  const out: RunJob[] = [];
  for (const j of jobs.slice(0, 10)) {
    if (!obj(j)) continue;
    const name = shortName(j.name);
    if (!name) continue;
    // Beat maps: "update", "deploy / build", "deploy / deploy"; Deploy site on its own: "build", "deploy".
    const part: RunJob['part'] = name === 'update' ? 'update' : name === 'deploy' || name === 'build' || name.startsWith('deploy /') ? 'deploy' : 'other';
    const steps = Array.isArray(j.steps) ? j.steps.filter(obj) : [];
    const stepName = (s: Record<string, unknown> | undefined) => (s && typeof s.name === 'string' ? s.name : '');
    const running = steps.find((s) => s.status === 'in_progress');
    const failedStep = stepName(steps.find((s) => s.conclusion === 'failure' || s.conclusion === 'timed_out'));
    const job: RunJob = {
      name,
      part,
      status: runStatus(j.status),
      conclusion: conclusion(j.conclusion),
      startedAt: iso(j.started_at),
      completedAt: iso(j.completed_at),
    };
    if (part === 'update' && running) {
      const work = WORK_STEPS.has(stepName(running));
      job.phase = work ? 'work' : 'setup';
      // When the phase began: the first work step's start, or the job's own.
      const first = work ? steps.find((s) => WORK_STEPS.has(stepName(s)) && iso(s.started_at)) : undefined;
      const at = first ? iso(first.started_at) : iso(j.started_at);
      if (at) job.phaseStartedAt = at;
    }
    if (failedStep) {
      job.failedAt =
        part === 'deploy' ? (CHECK_STEP_RE.test(failedStep) ? 'tests' : 'build') : failedStep === STEP_MAPS || failedStep === STEP_SIGNIN ? 'download' : 'other';
      if (failedStep === STEP_SIGNIN) job.signInRejected = true;
    }
    out.push(job);
  }
  return out;
}

/**
 * Which runs get their jobs looked up: Beat maps runs still going (at most 2),
 * the newest finished one that isn't a contributed map, and the newest Deploy
 * site run when it failed (to tell failed tests from a failed build). At most 4;
 * finished runs never change, so callers keep their jobs.
 */
export function runsNeedingJobs(runs: readonly RunSummary[]): number[] {
  const beat = runs.filter((r) => r.workflow === 'beatmaps' && r.kind !== 'map');
  const ids = beat.filter((r) => r.status !== 'completed').slice(0, 2).map((r) => r.id);
  const done = beat.find((r) => r.status === 'completed');
  if (done) ids.push(done.id);
  const deploy = runs.find((r) => r.workflow === 'deploy');
  if (deploy && deploy.status === 'completed' && (deploy.conclusion === 'failure' || deploy.conclusion === 'timed_out')) ids.push(deploy.id);
  return ids;
}

/** Strict check of an already reduced list (the relay's answer, or a saved copy). Bad entries are dropped. */
export function parseRunSummaries(raw: unknown): RunSummary[] | null {
  if (!Array.isArray(raw)) return null;
  const out: RunSummary[] = [];
  for (const r of raw.slice(0, 50)) {
    if (!obj(r)) continue;
    const createdAt = iso(r.createdAt);
    if (typeof r.id !== 'number' || !Number.isSafeInteger(r.id) || !createdAt) continue;
    if (r.workflow !== 'beatmaps' && r.workflow !== 'deploy') continue;
    const kind = oneOf(KINDS, r.kind);
    const status = oneOf(STATUSES, r.status);
    if (!kind || !status) continue;
    const run: RunSummary = {
      id: r.id,
      workflow: r.workflow,
      kind,
      status,
      conclusion: conclusion(r.conclusion),
      createdAt,
      startedAt: iso(r.startedAt) ?? createdAt,
      updatedAt: iso(r.updatedAt) ?? createdAt,
    };
    if (Array.isArray(r.jobs)) {
      run.jobs = [];
      for (const j of r.jobs.slice(0, 10)) {
        if (!obj(j)) continue;
        const name = shortName(j.name);
        const part = oneOf(PARTS, j.part);
        const jstatus = oneOf(STATUSES, j.status);
        if (!name || !part || !jstatus) continue;
        const job: RunJob = { name, part, status: jstatus, conclusion: conclusion(j.conclusion), startedAt: iso(j.startedAt), completedAt: iso(j.completedAt) };
        const phase = oneOf(PHASES, j.phase);
        if (phase) {
          job.phase = phase;
          const at = iso(j.phaseStartedAt);
          if (at) job.phaseStartedAt = at;
        }
        const failedAt = oneOf(FAILED_AT, j.failedAt);
        if (failedAt) job.failedAt = failedAt;
        if (j.signInRejected === true) job.signInRejected = true;
        run.jobs.push(job);
      }
    }
    out.push(run);
  }
  return out;
}
