/**
 * "Is adding songs working?" Everything here is read-only and uses public data:
 *
 *   relay     GET <relay>/health (reachable, set up, version)
 *   runs      the latest Beat maps / Deploy site runs on main: the relay's GET /runs
 *             (relay version 2+), else GitHub's API without a token (60 calls an
 *             hour per IP, so the caller caches; see src/ui/songHealth.ts)
 *   site      what the live site serves: songs.json, beatmaps/index.json
 *   repo      the same files on main in the repository (raw.githubusercontent.com),
 *             plus beatmaps/status.json and songs-status.json (YouTube outcomes)
 *
 * The fetchers never reject; the assessment is pure (tests: pipelineHealth.test.ts).
 */
import {
  parseSongsList,
  parseSongsStatus,
  type AddedSong,
  type SongRequestStatus,
} from '../beat/cloud';
import { summarizeJobs, summarizeRuns, runsNeedingJobs, type RunJob, type RunSummary } from '../../cloudflare/add-song-worker/src/runs';
import { GITHUB_API, WORKFLOW_REF, type RepoRef } from './github';

export type { RunJob, RunSummary };

/**
 * The relay version this app expects (GET /health `version`; the relay's
 * RELAY_VERSION, kept equal by a test). Older relays still add songs; the
 * check then says to redeploy it.
 */
export const RELAY_VERSION = 3;
/**
 * Committed song data normally reaches the site within a few minutes: a data-only
 * deploy takes under a minute (measured 19 s), it may wait behind a code push's
 * deploy (~3 min with the checks), and the app sees the change on its next poll.
 */
export const SITE_GRACE_MS = 10 * 60_000;

type FetchFn = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'> & { headers?: Pick<Headers, 'get'> }>;

// ---------------------------------------------------------------------------
// Runs

export type RunsResult =
  | { state: 'ok'; runs: RunSummary[]; via: 'relay' | 'github'; at: number }
  | { state: 'rate-limited'; until: number; at: number }
  | { state: 'unavailable'; at: number };

function rateLimitUntil(res: { status: number; headers?: Pick<Headers, 'get'> }, body: string, now: number): number | null {
  const remaining = res.headers?.get('x-ratelimit-remaining');
  const reset = Number(res.headers?.get('x-ratelimit-reset'));
  const limited = res.status === 429 || (res.status === 403 && (remaining === '0' || /rate limit/i.test(body)));
  if (!limited) return null;
  return Number.isFinite(reset) && reset * 1000 > now ? Math.min(reset * 1000, now + 3_600_000) : now + 10 * 60_000;
}

/**
 * The latest runs straight from GitHub's API, without a token. One call for the
 * list, plus the jobs of at most three runs (runsNeedingJobs); `knownJobs` holds
 * the jobs of finished runs from earlier calls (they never change) and is updated.
 * `cache: 'no-cache'` lets the browser revalidate with GitHub's ETag.
 */
export async function githubRuns(
  repo: RepoRef,
  knownJobs: Map<number, RunJob[]>,
  now: number,
  fetchFn: FetchFn = (u, i) => fetch(u, i),
): Promise<RunsResult> {
  const base = `${GITHUB_API}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/actions/runs`;
  const init: RequestInit = { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer' };
  let runs: RunSummary[];
  try {
    const res = await fetchFn(`${base}?branch=${WORKFLOW_REF}&per_page=20&exclude_pull_requests=true`, init);
    const text = await res.text();
    if (!res.ok) {
      const until = rateLimitUntil(res, text, now);
      return until ? { state: 'rate-limited', until, at: now } : { state: 'unavailable', at: now };
    }
    runs = summarizeRuns(JSON.parse(text));
  } catch {
    return { state: 'unavailable', at: now };
  }
  for (const id of runsNeedingJobs(runs)) {
    const run = runs.find((r) => r.id === id)!;
    const known = knownJobs.get(id);
    if (known && run.status === 'completed') {
      run.jobs = known;
      continue;
    }
    try {
      const res = await fetchFn(`${base}/${id}/jobs?per_page=20`, init);
      const text = await res.text();
      if (!res.ok) {
        if (rateLimitUntil(res, text, now)) break; // the run list alone still helps
        continue;
      }
      run.jobs = summarizeJobs(JSON.parse(text));
      if (run.status === 'completed') knownJobs.set(id, run.jobs);
    } catch {
      /* the run list alone still helps */
    }
  }
  return { state: 'ok', runs, via: 'github', at: now };
}

/** Newest first by creation time (GitHub already sends them so; saved copies may not be). */
function byNewest(runs: readonly RunSummary[]): RunSummary[] {
  return [...runs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Beat maps runs that can add songs (not contributed-map runs), newest first. */
export function songRuns(runs: readonly RunSummary[]): RunSummary[] {
  return byNewest(runs).filter((r) => r.workflow === 'beatmaps' && r.kind !== 'map');
}

const BAD = new Set(['failure', 'timed_out', 'startup_failure']);
export const failed = (c: string | null | undefined): boolean => !!c && BAD.has(c);

export function updateJob(run: RunSummary): RunJob | undefined {
  return run.jobs?.find((j) => j.part === 'update');
}

/** The site-publishing part of a Beat maps run: 'none' when it didn't run (no changes) or isn't known yet. */
export function deployOutcome(run: RunSummary): { state: 'none' | 'running' | 'success' | 'failure' | 'cancelled'; at: string | null; failedAt?: RunJob['failedAt'] } {
  const jobs = (run.jobs ?? []).filter((j) => j.part === 'deploy');
  const ran = jobs.filter((j) => j.conclusion !== 'skipped' || j.status !== 'completed');
  if (!jobs.length || !ran.length) return { state: 'none', at: null };
  const at = ran.map((j) => j.startedAt).filter((x): x is string => !!x).sort()[0] ?? run.updatedAt;
  const bad = ran.find((j) => failed(j.conclusion));
  if (bad) return { state: 'failure', at, ...(bad.failedAt ? { failedAt: bad.failedAt } : {}) };
  if (ran.some((j) => j.status !== 'completed')) return { state: 'running', at };
  if (ran.some((j) => j.conclusion === 'cancelled')) return { state: 'cancelled', at };
  return { state: 'success', at };
}

// ---------------------------------------------------------------------------
// Site and repository files

export interface VideoAttempt {
  videoId: string;
  state: 'ok' | 'blocked' | 'error';
  reason?: string;
  /** Tries so far (status.json `attempts`), when given. */
  attempts?: number;
  lastTried: string;
}

/** What one copy of the published files says (the live site, or main in the repository). */
export interface SiteData {
  songs: AddedSong[] | null;
  songsAt: string | null;
  mapIds: string[] | null;
  mapsAt: string | null;
  /** beatmaps/status.json (read from the repository only). */
  videos?: VideoAttempt[] | null;
  /** songs-status.json `requests` (read from the repository only). */
  requests?: Record<string, SongRequestStatus> | null;
}

function stamp(text: string | null, key: string): string | null {
  if (text === null) return null;
  try {
    const v = (JSON.parse(text) as Record<string, unknown>)?.[key];
    return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
  } catch {
    return null;
  }
}

function indexIds(text: string | null): string[] | null {
  if (text === null) return null;
  try {
    const ids = (JSON.parse(text) as { ids?: unknown })?.ids;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

/** beatmaps/status.json entries with their state, reason and time. */
export function parseVideoAttempts(text: string | null): VideoAttempt[] | null {
  if (text === null) return null;
  try {
    const videos = (JSON.parse(text) as { videos?: unknown })?.videos;
    if (!videos || typeof videos !== 'object' || Array.isArray(videos)) return null;
    const out: VideoAttempt[] = [];
    for (const [videoId, v] of Object.entries(videos as Record<string, unknown>)) {
      const r = (v ?? {}) as Record<string, unknown>;
      if ((r.state !== 'ok' && r.state !== 'blocked' && r.state !== 'error') || typeof r.lastTried !== 'string') continue;
      out.push({
        videoId,
        state: r.state,
        ...(typeof r.reason === 'string' ? { reason: r.reason } : {}),
        ...(typeof r.attempts === 'number' && Number.isFinite(r.attempts) ? { attempts: r.attempts } : {}),
        lastTried: r.lastTried,
      });
    }
    return out;
  } catch {
    return null;
  }
}

/** Parse fetched copies of the files (null = couldn't fetch). Unknown shapes count as missing. */
export function parseSiteData(t: { songs: string | null; index: string | null; status?: string | null; songsStatus?: string | null }): SiteData {
  const songsAt = stamp(t.songs, 'updatedAt');
  const data: SiteData = {
    songs: t.songs !== null && songsAt ? parseSongsList(t.songs) : null,
    songsAt,
    mapIds: indexIds(t.index),
    mapsAt: stamp(t.index, 'generatedAt'),
  };
  if (t.status !== undefined) data.videos = parseVideoAttempts(t.status);
  if (t.songsStatus !== undefined) data.requests = t.songsStatus === null ? null : stamp(t.songsStatus, 'updatedAt') ? parseSongsStatus(t.songsStatus) : null;
  return data;
}

/** Where the repository's copy of a published file is: raw.githubusercontent.com, main, under public/. */
export function repoFileUrl(repo: RepoRef, path: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/${WORKFLOW_REF}/public/${path}`;
}

// ---------------------------------------------------------------------------
// Assessment

export type CheckState = 'ok' | 'warn' | 'problem' | 'unknown';

export interface HealthCheck {
  id: 'relay' | 'job' | 'site' | 'youtube' | 'live';
  /** Short name of what is checked. */
  title: string;
  state: CheckState;
  /** One plain sentence. */
  text: string;
  /** For warn/problem: what to do. */
  todo?: string;
}

export interface HealthInput {
  now: number;
  /** null: songs aren't added through a relay here, so there is nothing to check. */
  relay: null | { state: 'unreachable' } | { state: 'ok'; configured: boolean; version: number };
  runs: RunsResult | null;
  live: SiteData | null;
  repo: SiteData | null;
}

export interface HealthReport {
  checks: HealthCheck[];
  /** 'problem' if any check has a problem, else 'warn', else 'ok' (or 'unknown' when nothing could be checked). */
  overall: CheckState;
  summary: string;
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago". */
export function ago(iso: string | number | null | undefined, now: number): string {
  const t = typeof iso === 'number' ? iso : iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 'some time ago';
  const min = Math.floor(Math.max(0, now - t) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  return `${Math.floor(hr / 24)} days ago`;
}

const ACTIONS_HINT = 'Open Actions → Beat maps on GitHub: the summary at the top of the red run says why.';
const DEPLOY_AGAIN = 'On GitHub: Actions → Deploy site → Run workflow.';
const COOKIES_TODO = 'Export fresh cookies from the spare YouTube account into the YT_COOKIES secret (README: “When a job goes red”).';
const BLOCKED_TODO = 'Run npm run beatmaps:local -- --push on your Mac, or give the job fresh cookies from the spare account in YT_COOKIES (README: “When a job goes red”).';

function runsUnknown(runs: RunsResult | null, now: number): string {
  if (runs?.state === 'rate-limited') {
    const min = Math.max(1, Math.ceil((runs.until - now) / 60_000));
    return `Couldn’t ask GitHub right now: it only answers a few times an hour without a sign-in. Try again in about ${min} min.`;
  }
  return 'Couldn’t reach GitHub to check.';
}

export function checkRelay(relay: HealthInput['relay']): HealthCheck | null {
  if (!relay) return null;
  const title = 'Relay';
  if (relay.state === 'unreachable') {
    return {
      id: 'relay',
      title,
      state: 'problem',
      text: 'Couldn’t reach the relay that starts the song job.',
      todo: 'Check your internet connection. If that’s fine, check the Worker in Cloudflare, and that ALLOWED_ORIGINS lists this site.',
    };
  }
  if (!relay.configured) {
    return { id: 'relay', title, state: 'problem', text: 'The relay answers, but it isn’t set up.', todo: 'Set GITHUB_REPO and the GITHUB_TOKEN secret in the Worker.' };
  }
  if (relay.version < RELAY_VERSION) {
    return {
      id: 'relay',
      title,
      state: 'warn',
      text: 'The relay works, but it’s an older version than this app.',
      todo: 'Redeploy it: npx wrangler deploy in cloudflare/add-song-worker.',
    };
  }
  return { id: 'relay', title, state: 'ok', text: 'The relay is reachable and up to date.' };
}

export function checkJob(runs: RunsResult | null, now: number): HealthCheck {
  const title = 'Song job';
  if (!runs || runs.state !== 'ok') return { id: 'job', title, state: 'unknown', text: runsUnknown(runs, now) };
  const all = songRuns(runs.runs);
  const running = all.find((r) => r.status !== 'completed');
  const last = all.find((r) => r.status === 'completed');
  const also = running ? (running.status === 'queued' ? ' Another one is waiting to start.' : ' Another one is running now.') : '';
  if (!last) {
    return running
      ? { id: 'job', title, state: 'ok', text: running.status === 'queued' ? 'A song job is waiting to start.' : 'A song job is running now.' }
      : { id: 'job', title, state: 'unknown', text: 'No song job has run recently.' };
  }
  const when = ago(last.updatedAt, now);
  const upd = updateJob(last);
  const deploy = deployOutcome(last);
  const updateFailed = upd ? failed(upd.conclusion) : failed(last.conclusion) && deploy.state !== 'failure';
  if (updateFailed) {
    const signin = !!upd?.signInRejected;
    return {
      id: 'job',
      title,
      state: 'problem',
      text: signin ? `The last song job failed (${when}): YouTube rejected its sign-in.${also}` : `The last song job failed (${when}).${also}`,
      todo: signin ? COOKIES_TODO : ACTIONS_HINT,
    };
  }
  if (last.conclusion === 'cancelled' || upd?.conclusion === 'cancelled') {
    return { id: 'job', title, state: 'warn', text: `The last song job was stopped before it finished (${when}).${also}`, todo: 'If a song is missing, add it again.' };
  }
  return { id: 'job', title, state: 'ok', text: `The last song job worked (${when}).${also}` };
}

type DeployAttempt = { state: 'running' | 'success' | 'failure' | 'cancelled'; at: string; failedAt?: RunJob['failedAt'] };

/** The newest attempt to publish the site: a Deploy site run, or the deploy part of a Beat maps run. */
export function latestDeploy(runs: readonly RunSummary[]): DeployAttempt | null {
  const attempts: DeployAttempt[] = [];
  for (const r of runs) {
    if (r.workflow === 'deploy') {
      const state = r.status !== 'completed' ? 'running' : failed(r.conclusion) ? 'failure' : r.conclusion === 'cancelled' ? 'cancelled' : r.conclusion === 'success' ? 'success' : null;
      const failedAt = state === 'failure' && r.jobs ? deployOutcome(r).failedAt : undefined;
      if (state) attempts.push({ state, at: r.startedAt, ...(failedAt ? { failedAt } : {}) });
    } else {
      const d = deployOutcome(r);
      if (d.state !== 'none') attempts.push({ state: d.state, at: d.at ?? r.updatedAt, ...(d.failedAt ? { failedAt: d.failedAt } : {}) });
    }
  }
  attempts.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return attempts[0] ?? null;
}

export function checkSite(runs: RunsResult | null, now: number): HealthCheck {
  const title = 'Site update';
  if (!runs || runs.state !== 'ok') return { id: 'site', title, state: 'unknown', text: runsUnknown(runs, now) };
  const d = latestDeploy(runs.runs);
  if (!d) return { id: 'site', title, state: 'unknown', text: 'Couldn’t tell when the site last updated.' };
  const when = ago(d.at, now);
  if (d.state === 'running') return { id: 'site', title, state: 'ok', text: 'The site is updating now.' };
  if (d.state === 'failure') {
    // Song data is published without the type-check and tests (deploy.yml data_only), so failed
    // tests only hold back a code change: worth fixing, but songs still reach the site.
    if (d.failedAt === 'tests') {
      return {
        id: 'site',
        title,
        state: 'warn',
        text: `A code change failed its tests (${when}), so the site wasn’t updated with it. Added songs still reach the site.`,
        todo: 'Fix the failing test (the red Deploy site run under Actions on GitHub says which) and push to main.',
      };
    }
    return {
      id: 'site',
      title,
      state: 'problem',
      text: d.failedAt === 'build' ? `The site couldn’t be built or published (${when}).` : `The last site update failed (${when}).`,
      todo: 'Open the red run under Actions on GitHub to see why. Then run Actions → Deploy site → Run workflow.',
    };
  }
  if (d.state === 'cancelled') return { id: 'site', title, state: 'warn', text: `The last site update was stopped (${when}).`, todo: DEPLOY_AGAIN };
  return { id: 'site', title, state: 'ok', text: `The site last updated ${when}.` };
}

/**
 * 'withheld': YouTube offered the job no audio for some songs on its last try
 * (status.json reason 'withheld'). Not a failure: those songs are listed and
 * playable, and later runs retry them by themselves.
 */
export type YoutubeState = 'ok' | 'blocked' | 'outdated' | 'withheld' | 'signin' | 'unknown';

/**
 * Tries after which a song YouTube keeps holding back is worth the owner's look:
 * with the job's backoff (1 h, 2 h, 4 h, then every 6 h) that is about a day.
 */
export const WITHHELD_STUCK_ATTEMPTS = 6;

/**
 * Whether YouTube lets the cloud job download, from its newest attempts: the
 * entries of status.json and songs-status.json tried within 45 min of the newest
 * one, plus a rejected sign-in (signInRejected) in the newest finished run.
 * A 'map-pending' note is told by its video's status.json entry; without one it
 * counts as a song still waiting ('withheld'). For 'withheld': how many songs
 * wait, and whether one has waited WITHHELD_STUCK_ATTEMPTS tries.
 */
export function youtubeState(
  videos: readonly VideoAttempt[] | null | undefined,
  requests: Readonly<Record<string, SongRequestStatus>> | null | undefined,
  runs: readonly RunSummary[] | null,
): { state: YoutubeState; at: string | null; waiting?: number; stuck?: boolean } {
  const last = runs ? songRuns(runs).find((r) => r.status === 'completed') : undefined;
  const upd = last && updateJob(last);
  if (upd?.signInRejected) return { state: 'signin', at: last!.updatedAt };
  const tries: { state: string; reason?: string; attempts?: number; t: number; at: string }[] = [];
  const known = new Set<string>();
  for (const v of videos ?? []) {
    known.add(v.videoId);
    const t = Date.parse(v.lastTried);
    if (Number.isFinite(t)) tries.push({ state: v.state, reason: v.reason, attempts: v.attempts, t, at: v.lastTried });
  }
  for (const r of Object.values(requests ?? {})) {
    const t = Date.parse(r.lastTried);
    if (!Number.isFinite(t) || r.state === 'not-found') continue;
    if (r.state === 'map-pending') {
      if (!r.videoId || !known.has(r.videoId)) tries.push({ state: 'error', reason: 'withheld', t, at: r.lastTried });
      continue;
    }
    tries.push({ state: r.state, t, at: r.lastTried });
  }
  if (!tries.length) return { state: 'unknown', at: null };
  const newest = Math.max(...tries.map((x) => x.t));
  const batch = tries.filter((x) => x.t >= newest - 45 * 60_000);
  const at = tries.find((x) => x.t === newest)!.at;
  if (batch.some((x) => x.state === 'blocked' || x.reason === 'blocked')) return { state: 'blocked', at };
  if (batch.some((x) => x.reason === 'outdated')) return { state: 'outdated', at };
  const held = batch.filter((x) => x.reason === 'withheld');
  if (held.length) return { state: 'withheld', at, waiting: held.length, stuck: held.some((x) => (x.attempts ?? 0) >= WITHHELD_STUCK_ATTEMPTS) };
  return { state: 'ok', at };
}

export function checkYoutube(repo: SiteData | null, runs: RunsResult | null, now: number): HealthCheck {
  const title = 'YouTube';
  const y = youtubeState(repo?.videos, repo?.requests, runs?.state === 'ok' ? runs.runs : null);
  const when = ago(y.at, now);
  switch (y.state) {
    case 'signin':
      return { id: 'youtube', title, state: 'problem', text: `YouTube rejected the cloud job’s sign-in (${when}): its cookies have expired.`, todo: COOKIES_TODO };
    case 'blocked':
      return {
        id: 'youtube',
        title,
        state: 'problem',
        text: `YouTube is blocking the cloud job (last try ${when}). New songs are still listed, but wait for their beat map.`,
        todo: BLOCKED_TODO,
      };
    case 'outdated':
      return {
        id: 'youtube',
        title,
        state: 'warn',
        text: `YouTube refused some downloads on the last try (${when}).`,
        todo: 'This usually fixes itself within a day or two, when the downloader the job uses is updated. Songs are still listed meanwhile.',
      };
    case 'withheld': {
      const n = y.waiting ?? 1;
      const songs = n === 1 ? 'one song' : `${n} songs`;
      if (y.stuck) {
        return {
          id: 'youtube',
          title,
          state: 'warn',
          text: `YouTube still hasn’t handed the cloud job ${songs} after about a day of tries (last try ${when}). ${n === 1 ? 'It plays' : 'They play'} fine meanwhile; only the ready-made beat map is missing.`,
          todo: 'Nothing is broken, and the job keeps trying by itself. To get the beat map sooner, make it on your own computer (README: “Making beat maps on your own computer”).',
        };
      }
      return {
        id: 'youtube',
        title,
        state: 'ok',
        text: `On its last try (${when}) YouTube didn’t hand the cloud job ${songs} yet. You can dance to ${n === 1 ? 'it' : 'them'} now; a better beat map arrives on its own.`,
      };
    }
    case 'ok':
      return { id: 'youtube', title, state: 'ok', text: `YouTube let the cloud job download on its last try (${when}).` };
    default:
      return { id: 'youtube', title, state: 'unknown', text: 'Couldn’t tell whether YouTube is blocking the cloud job.' };
  }
}

const maxTime = (...xs: (string | null | undefined)[]) => Math.max(...xs.map((x) => (x ? Date.parse(x) : NaN)).filter(Number.isFinite), -Infinity);

/** Songs and maps on main that the live site doesn't serve yet (only when the repository's copy is newer). */
export function siteGap(live: SiteData | null, repo: SiteData | null): { songs: AddedSong[]; maps: number; repoAt: number } | null {
  if (!live?.songs || !repo?.songs) return null;
  const repoAt = maxTime(repo.songsAt, repo.mapsAt);
  const liveAt = maxTime(live.songsAt, live.mapsAt);
  if (!(repoAt > liveAt)) return { songs: [], maps: 0, repoAt };
  const liveIds = new Set(live.songs.map((s) => s.videoId));
  const liveMaps = new Set(live.mapIds ?? []);
  return {
    songs: repo.songs.filter((s) => !liveIds.has(s.videoId)),
    maps: live.mapIds && repo.mapIds ? repo.mapIds.filter((id) => !liveMaps.has(id)).length : 0,
    repoAt,
  };
}

function names(songs: AddedSong[]): string {
  const t = songs.map((s) => `“${s.title}”`);
  if (t.length <= 2) return t.join(' and ');
  return `${t.slice(0, 2).join(', ')} and ${t.length - 2} more`;
}

export function checkLive(live: SiteData | null, repo: SiteData | null, siteCheck: HealthCheck | null, now: number): HealthCheck {
  const title = 'Songs on the site';
  if (!repo?.songs) return { id: 'live', title, state: 'unknown', text: 'Couldn’t compare the site with the repository.' };
  if (!live?.songs) return { id: 'live', title, state: 'unknown', text: 'Couldn’t read the site’s song list.' };
  const gap = siteGap(live, repo)!;
  if (!gap.songs.length && !gap.maps) return { id: 'live', title, state: 'ok', text: 'The site has every song that was added.' };
  const n = gap.songs.length;
  if (now - gap.repoAt < SITE_GRACE_MS) {
    return { id: 'live', title, state: 'ok', text: n ? `${n === 1 ? 'A new song is' : `${n} new songs are`} on the way to the site: ${names(gap.songs)}.` : 'New beat maps are on the way to the site.' };
  }
  const deployFailed = siteCheck?.state === 'problem';
  return {
    id: 'live',
    title,
    state: 'problem',
    text: n
      ? `${n === 1 ? 'A song was' : `${n} songs were`} added but ${n === 1 ? 'isn’t' : 'aren’t'} on the site yet: ${names(gap.songs)}.`
      : 'Newer beat maps are in the repository but not on the site yet.',
    todo: deployFailed ? 'They appear once the site update above works again.' : DEPLOY_AGAIN,
  };
}

export function assessHealth(input: HealthInput): HealthReport {
  const { now } = input;
  const site = checkSite(input.runs, now);
  const checks = [checkRelay(input.relay), checkJob(input.runs, now), site, checkYoutube(input.repo, input.runs, now), checkLive(input.live, input.repo, site, now)].filter(
    (c): c is HealthCheck => !!c,
  );
  const problems = checks.filter((c) => c.state === 'problem').length;
  const warns = checks.filter((c) => c.state === 'warn').length;
  const unknown = checks.filter((c) => c.state === 'unknown').length;
  const overall: CheckState = problems ? 'problem' : warns ? 'warn' : unknown === checks.length ? 'unknown' : 'ok';
  const summary = problems
    ? `${problems === 1 ? 'One problem' : `${problems} problems`} with adding songs`
    : warns
      ? `Adding songs works, with ${warns === 1 ? 'one thing' : `${warns} things`} to look at`
      : overall === 'unknown'
        ? 'Couldn’t check song adding right now'
        : unknown
          ? 'Adding songs looks fine (some checks couldn’t run)'
          : 'Adding songs is working';
  return { checks, overall, summary };
}
