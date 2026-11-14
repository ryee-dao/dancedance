/**
 * GitHub Actions runs reduced to what the app's "song adding" health check and
 * progress need. Pure, no dependencies: used by the relay's GET /runs and by
 * the app itself when it asks GitHub directly (src/platform/pipelineHealth.ts),
 * so both give the same answer.
 *
 * Only run state, times, the kind of run and job/step names (which come from
 * the workflow files) are kept: never run titles (they hold song names),
 * inputs, logs or anything else.
 */

/** The run-name beatmaps.yml gives contributed-map runs. */
export const MAP_RUN_TITLE = 'Contributed beat map';
/** The run-name prefix beatmaps.yml gives runs started by "add a song". */
export const ADD_RUN_TITLE = 'Add song:';

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

export type RunStatus = (typeof STATUSES)[number];

export interface RunJob {
  name: string;
  /** 'update' = makes the beat maps and commits them; 'deploy' = builds and publishes the site. */
  part: (typeof PARTS)[number];
  status: RunStatus;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** The step running now. */
  step?: string;
  stepStartedAt?: string;
  /** The first step that failed. */
  failedStep?: string;
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

/** GitHub's `{ jobs: [...] }` for one run: name, state, times, the running step and the first failed step. */
export function summarizeJobs(raw: unknown): RunJob[] {
  const jobs = obj(raw) && Array.isArray(raw.jobs) ? raw.jobs : [];
  const out: RunJob[] = [];
  for (const j of jobs.slice(0, 10)) {
    if (!obj(j)) continue;
    const name = shortName(j.name);
    if (!name) continue;
    const steps = Array.isArray(j.steps) ? j.steps.filter(obj) : [];
    const running = steps.find((s) => s.status === 'in_progress');
    const failed = steps.find((s) => s.conclusion === 'failure' || s.conclusion === 'timed_out');
    const job: RunJob = {
      name,
      part: name === 'update' ? 'update' : name === 'deploy' || name.startsWith('deploy /') ? 'deploy' : 'other',
      status: runStatus(j.status),
      conclusion: conclusion(j.conclusion),
      startedAt: iso(j.started_at),
      completedAt: iso(j.completed_at),
    };
    const step = running && shortName(running.name);
    if (step) {
      job.step = step;
      const at = iso(running.started_at);
      if (at) job.stepStartedAt = at;
    }
    const failedStep = failed && shortName(failed.name);
    if (failedStep) job.failedStep = failedStep;
    out.push(job);
  }
  return out;
}

/**
 * Which runs get their jobs looked up: Beat maps runs still going (at most 2)
 * and the newest finished one that isn't a contributed map. At most 3 lookups.
 */
export function runsNeedingJobs(runs: readonly RunSummary[]): number[] {
  const beat = runs.filter((r) => r.workflow === 'beatmaps' && r.kind !== 'map');
  const ids = beat.filter((r) => r.status !== 'completed').slice(0, 2).map((r) => r.id);
  const done = beat.find((r) => r.status === 'completed');
  if (done) ids.push(done.id);
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
    if (!(KINDS as readonly unknown[]).includes(r.kind) || !(STATUSES as readonly unknown[]).includes(r.status)) continue;
    const run: RunSummary = {
      id: r.id,
      workflow: r.workflow,
      kind: r.kind as RunSummary['kind'],
      status: r.status as RunStatus,
      conclusion: conclusion(r.conclusion),
      createdAt,
      startedAt: iso(r.startedAt) ?? createdAt,
      updatedAt: iso(r.updatedAt) ?? createdAt,
    };
    if (Array.isArray(r.jobs)) {
      run.jobs = [];
      for (const j of r.jobs.slice(0, 10)) {
        const name = obj(j) ? shortName(j.name) : undefined;
        if (!obj(j) || !name || !(PARTS as readonly unknown[]).includes(j.part) || !(STATUSES as readonly unknown[]).includes(j.status)) continue;
        const job: RunJob = {
          name,
          part: j.part as RunJob['part'],
          status: j.status as RunStatus,
          conclusion: conclusion(j.conclusion),
          startedAt: iso(j.startedAt),
          completedAt: iso(j.completedAt),
        };
        const step = shortName(j.step);
        if (step) job.step = step;
        const stepAt = iso(j.stepStartedAt);
        if (step && stepAt) job.stepStartedAt = stepAt;
        const failedStep = shortName(j.failedStep);
        if (failedStep) job.failedStep = failedStep;
        run.jobs.push(job);
      }
    }
    out.push(run);
  }
  return out;
}
