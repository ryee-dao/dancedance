/**
 * "Add a song" -> GitHub: start the repository's Beat maps workflow
 * (workflow_dispatch) with the chosen song as inputs.
 *
 * The token is a fine-grained personal access token limited to this one
 * repository with "Actions: Read and write". It is only ever sent to
 * https://api.github.com, in the Authorization header: never in a URL, never
 * logged.
 */

export const GITHUB_API = 'https://api.github.com';
export const WORKFLOW_FILE = 'beatmaps.yml';
export const WORKFLOW_REF = 'main';

export interface RepoRef {
  owner: string;
  repo: string;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function repoString(r: RepoRef): string {
  return `${r.owner}/${r.repo}`;
}

/** "owner/repo", "https://github.com/owner/repo(.git)" or "owner.github.io/repo". */
export function parseRepo(input: string | null | undefined): RepoRef | null {
  let s = (input ?? '').trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  let m = /^github\.com\/([^/]+)\/([^/]+)$/i.exec(s);
  if (!m) {
    const pages = /^([^./]+)\.github\.io(?:\/([^/]+))?$/i.exec(s);
    if (pages) m = [s, pages[1], pages[2] ?? `${pages[1]}.github.io`] as unknown as RegExpExecArray;
  }
  if (!m) m = /^([^/]+)\/([^/]+)$/.exec(s);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2];
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === '.' || repo === '..') return null;
  return { owner, repo };
}

/** The repository when the app is hosted at https://<owner>.github.io/<repo>/. */
export function repoFromLocation(loc: { hostname: string; pathname: string }): RepoRef | null {
  const host = /^([a-z0-9-]+)\.github\.io$/i.exec(loc.hostname);
  if (!host) return null;
  const first = loc.pathname.split('/').filter(Boolean)[0];
  // A user site (<owner>.github.io with no project path) lives in the repo of that name.
  const repo = first && !/\.html?$/i.test(first) ? decodeURIComponent(first) : `${host[1]}.github.io`;
  return parseRepo(`${host[1]}/${repo}`);
}

export type RepoSource = 'pages' | 'build' | 'saved';

/** Where to send requests: the Pages address, then VITE_GITHUB_REPO, then what the user typed. */
export function resolveRepo(o: {
  location?: { hostname: string; pathname: string };
  envRepo?: string;
  saved?: string | null;
}): { repo: RepoRef; source: RepoSource } | null {
  const fromPages = o.location ? repoFromLocation(o.location) : null;
  if (fromPages) return { repo: fromPages, source: 'pages' };
  const fromEnv = parseRepo(o.envRepo);
  if (fromEnv) return { repo: fromEnv, source: 'build' };
  const saved = parseRepo(o.saved);
  if (saved) return { repo: saved, source: 'saved' };
  return null;
}

/** Quick shape check before anything is stored; GitHub has the final word. */
export function checkTokenShape(input: string): { ok: true; token: string } | { ok: false; message: string } {
  const token = input.trim();
  if (!token) return { ok: false, message: 'Paste the token first.' };
  if (/\s/.test(token)) return { ok: false, message: 'The token has spaces or line breaks in it. Copy it again from GitHub.' };
  if (!/^(?:github_pat_|ghp_)[A-Za-z0-9_]{20,255}$/.test(token)) {
    return {
      ok: false,
      message: 'That doesn’t look like a GitHub token. A fine-grained token starts with github_pat_.',
    };
  }
  return { ok: true, token };
}

export interface SongInput {
  artist: string;
  title: string;
  durationSec: number;
}

export type DispatchError =
  | 'auth' // 401: bad, expired or revoked token
  | 'permission' // 403: token lacks Actions: write on this repo
  | 'not-found' // 404: repo/workflow missing or not visible to the token
  | 'invalid' // 422: workflow too old, no main branch, ...
  | 'rate-limit'
  | 'server'
  | 'network';

export type DispatchResult = { ok: true } | { ok: false; error: DispatchError; message: string };

type FetchFn = (url: string, init: RequestInit) => Promise<Pick<Response, 'status' | 'ok' | 'headers' | 'text'>>;

/** At most this many other waiting songs ride along in `add_queue`. */
export const MAX_QUEUE = 9;

/** The exact request the app sends (exported for tests). */
export function dispatchRequest(token: string, repo: RepoRef, song: SongInput, queue: SongInput[]): { url: string; init: RequestInit } {
  const inputs: Record<string, string> = {
    add_artist: song.artist,
    add_title: song.title,
    add_duration: String(Math.round(song.durationSec)),
  };
  const others = queue.slice(0, MAX_QUEUE).map((q) => ({ artist: q.artist, title: q.title, duration: Math.round(q.durationSec) }));
  // Only sent when non-empty, so an older workflow without this input still accepts single adds.
  if (others.length) inputs.add_queue = JSON.stringify(others);
  return {
    url: `${GITHUB_API}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: WORKFLOW_REF, inputs }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    },
  };
}

/** Plain-English message for a GitHub error response. */
export function explainDispatchError(status: number, apiMessage: string, repo: RepoRef, rateLimited: boolean): { error: DispatchError; message: string } {
  const where = repoString(repo);
  const m = apiMessage.toLowerCase();
  if (status === 401) {
    return { error: 'auth', message: 'GitHub didn’t accept this token. It may be mistyped, expired or revoked. Make a new one and paste it here.' };
  }
  if (rateLimited || status === 429 || (status === 403 && m.includes('rate limit'))) {
    return { error: 'rate-limit', message: 'GitHub is limiting requests from this token right now. Wait a few minutes and try again.' };
  }
  if (status === 403) {
    return {
      error: 'permission',
      message: `This token isn’t allowed to start the beat-map job in ${where}. It needs Repository permissions → Actions: Read and write, with access to ${where}.`,
    };
  }
  if (status === 404) {
    return {
      error: 'not-found',
      message: `GitHub couldn’t find the Beat maps workflow in ${where}. Check the repository name, that the token was given access to it, and that .github/workflows/${WORKFLOW_FILE} is on the ${WORKFLOW_REF} branch.`,
    };
  }
  if (status === 422) {
    if (m.includes('unexpected inputs')) {
      return { error: 'invalid', message: 'The Beat maps workflow on GitHub is older than this app. Push the latest .github/workflows/beatmaps.yml, then try again.' };
    }
    if (m.includes('no ref found') || m.includes('ref')) {
      return { error: 'invalid', message: `GitHub has no ${WORKFLOW_REF} branch in ${where}. Push the project to ${WORKFLOW_REF} first.` };
    }
    if (m.includes('workflow_dispatch')) {
      return { error: 'invalid', message: 'The Beat maps workflow on GitHub can’t be started by the app. Push the latest .github/workflows/beatmaps.yml, then try again.' };
    }
    return { error: 'invalid', message: `GitHub refused the request${apiMessage ? `: ${apiMessage.slice(0, 200)}` : '.'}` };
  }
  if (status >= 500) return { error: 'server', message: 'GitHub is having trouble right now. Try again in a minute.' };
  return { error: 'invalid', message: `GitHub answered with an unexpected error (${status}). Try again later.` };
}

/** Ask GitHub to run the Beat maps workflow for this song (plus others still waiting). */
export async function dispatchAddSong(
  token: string,
  repo: RepoRef,
  song: SongInput,
  queue: SongInput[] = [],
  fetchFn: FetchFn = (u, i) => fetch(u, i),
): Promise<DispatchResult> {
  const { url, init } = dispatchRequest(token, repo, song, queue);
  let res: Awaited<ReturnType<FetchFn>>;
  try {
    res = await fetchFn(url, init);
  } catch {
    return { ok: false, error: 'network', message: 'Couldn’t reach GitHub. Check your internet connection and try again.' };
  }
  // 204 No Content; newer API versions may answer 200 with run details.
  if (res.status === 204 || res.ok) return { ok: true };
  let apiMessage = '';
  try {
    const body = JSON.parse(await res.text()) as { message?: unknown };
    if (typeof body.message === 'string') apiMessage = body.message;
  } catch {
    /* not JSON */
  }
  const rateLimited = res.headers.get('x-ratelimit-remaining') === '0';
  return { ok: false, ...explainDispatchError(res.status, apiMessage, repo, rateLimited) };
}
