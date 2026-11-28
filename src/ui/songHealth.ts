/**
 * "Song adding" health: gathers what src/platform/pipelineHealth.ts assesses,
 * shows it (createHealthPanel: Add a song, Options → Songs), and feeds the
 * pending songs' progress (addedSongs.setCloudFacts).
 *
 * Network use, all public and read-only:
 *   - the relay's /health, and its /runs when it has one (relay version 2+);
 *   - otherwise GitHub's API without a token, which allows 60 calls an hour per
 *     IP: the answer is kept (also across reloads) for 5 min, 2 min while a song
 *     is on its way (10 min once that has taken over half an hour), and when
 *     GitHub says "rate limited" nothing is asked until it says to try again;
 *   - the site's songs.json and beatmaps/index.json, and the repository's copies
 *     on raw.githubusercontent.com (plus beatmaps/status.json and songs-status.json).
 * Nothing about this device or the user is sent.
 */

import { absoluteBase } from '../beat/cloud';
import { parseRunSummaries, type RunJob } from '../../cloudflare/add-song-worker/src/runs';
import { parseRepo, repoFromLocation, type RepoRef } from '../platform/github';
import {
  ago,
  assessHealth,
  githubRuns,
  parseSiteData,
  repoFileUrl,
  type HealthCheck,
  type HealthInput,
  type HealthReport,
  type RunsResult,
  type SiteData,
} from '../platform/pipelineHealth';
import { getPlatform } from '../platform/platform';
import { relayHealth, relayRuns } from '../platform/relay';
import { store } from '../store';
import { addedSongs, bust } from './addedSongs';
import { h } from './dom';
import { focusEl } from './focusNav';
import { githubConnection } from './githubConnect';

const MIN = 60_000;
/** How long a runs answer is reused. */
export function runsMaxAge(via: 'relay' | 'github' | null, pendingAgeMs: number | null, force: boolean): number {
  if (via === 'relay') return force ? 20_000 : MIN;
  if (force) return 30_000;
  if (pendingAgeMs === null) return 5 * MIN;
  return pendingAgeMs < 30 * MIN ? 2 * MIN : 10 * MIN;
}

/** A saved runs answer, validated (anything odd counts as none). */
export function restoreRuns(raw: Record<string, unknown> | null): RunsResult | null {
  if (!raw || typeof raw.at !== 'number') return null;
  if (raw.state === 'rate-limited' && typeof raw.until === 'number') return { state: 'rate-limited', until: raw.until, at: raw.at };
  if (raw.state === 'ok' && (raw.via === 'relay' || raw.via === 'github')) {
    const runs = parseRunSummaries(raw.runs);
    return runs ? { state: 'ok', runs, via: raw.via, at: raw.at } : null;
  }
  return null;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

class SongHealth extends EventTarget {
  private report: HealthReport | null = null;
  private checkedAt: number | null = null;
  private checking: Promise<void> | null = null;
  private runs: RunsResult | null = restoreRuns(store.healthRuns());
  private knownJobs = new Map<number, RunJob[]>();
  private relayRepo: string | null = null;
  /** false once the relay answered /runs with "no such endpoint" (an older relay). */
  private relayHasRuns: boolean | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor(private readonly fetchFn: FetchFn = (u, i) => fetch(u, i)) {
    super();
  }

  /** Follow pending songs: poll the cloud for their progress while any is on its way. */
  start(): void {
    if (this.started) return;
    this.started = true;
    addedSongs.addEventListener('change', () => this.schedulePending());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.schedulePending(true);
      });
    }
    this.schedulePending(true);
  }

  latest(): { report: HealthReport | null; checkedAt: number | null; checking: boolean } {
    return { report: this.report, checkedAt: this.checkedAt, checking: !!this.checking };
  }

  /** The full check. Reuses a check under 30 s old unless `force`. Never rejects. */
  check(force = false): Promise<void> {
    if (this.checking) return this.checking;
    if (!force && this.checkedAt !== null && Date.now() - this.checkedAt < 30_000) return Promise.resolve();
    this.checking = this.runCheck(force).finally(() => {
      this.checking = null;
      this.dispatchEvent(new Event('change'));
    });
    this.dispatchEvent(new Event('change'));
    return this.checking;
  }

  private async runCheck(force: boolean): Promise<void> {
    const now = Date.now();
    const relay = await this.relayState();
    const repo = this.repo();
    const [runs, live, repoData] = await Promise.all([
      this.getRuns(now, force),
      this.siteData(now),
      repo ? this.repoData(repo, now, true) : Promise.resolve(null),
    ]);
    const input: HealthInput = { now: Date.now(), relay, runs, live, repo: repoData };
    this.report = assessHealth(input);
    this.checkedAt = Date.now();
    this.feed(runs, repoData);
  }

  private feed(runs: RunsResult | null, repo: SiteData | null): void {
    addedSongs.setCloudFacts({
      runs: runs?.state === 'ok' ? runs.runs : null,
      ...(runs?.state === 'ok' ? { runsAt: runs.at } : {}),
      repoSongs: repo?.songs ?? null,
      repoRequests: repo?.requests ?? null,
    });
  }

  private async relayState(): Promise<HealthInput['relay']> {
    const relay = githubConnection().relay;
    if (!relay) return null;
    const hh = await relayHealth(relay, this.fetchFn);
    if (!hh) return { state: 'unreachable' };
    this.relayRepo = hh.repo;
    return { state: 'ok', configured: hh.ok, version: hh.version };
  }

  /** The repository: from the connection, the site's own address (also the TV's), else what the relay reports. */
  private repo(): RepoRef | null {
    const c = githubConnection();
    if (c.repo) return c.repo;
    try {
      const u = new URL(absoluteBase(getPlatform().beatmapBase));
      const fromBase = repoFromLocation({ hostname: u.hostname, pathname: u.pathname });
      if (fromBase) return fromBase;
    } catch {
      /* platform not ready */
    }
    return parseRepo(this.relayRepo);
  }

  private pendingAge(now: number): number | null {
    const list = store.pendingAdds();
    return list.length ? now - Math.min(...list.map((p) => p.sentAt)) : null;
  }

  private async getRuns(now: number, force: boolean): Promise<RunsResult | null> {
    const cached = this.runs;
    if (cached?.state === 'rate-limited' && now < cached.until) return cached;
    const via = cached?.state === 'ok' ? cached.via : null;
    if (cached && cached.state !== 'rate-limited' && now - cached.at < runsMaxAge(via, this.pendingAge(now), force)) return cached;
    let result: RunsResult | null = null;
    const relay = githubConnection().relay;
    if (relay && this.relayHasRuns !== false) {
      const r = await relayRuns(relay, this.fetchFn);
      if (r === 'unsupported') this.relayHasRuns = false;
      else if (r) {
        this.relayHasRuns = true;
        result = { state: 'ok', runs: r, via: 'relay', at: now };
      }
    }
    if (!result) {
      const repo = this.repo();
      result = repo ? await githubRuns(repo, this.knownJobs, now, this.fetchFn) : { state: 'unavailable', at: now };
    }
    // Keep the last good list when this attempt couldn't get one (it says "couldn't check" only when there's nothing).
    if (result.state === 'unavailable' && cached?.state === 'ok' && now - cached.at < 30 * MIN) return cached;
    this.runs = result;
    if (result.state !== 'unavailable') store.setHealthRuns(result as unknown as Record<string, unknown>);
    return result;
  }

  private async text(url: string, now: number, step: number): Promise<string | null> {
    try {
      const res = await this.fetchFn(bust(url, now, step), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  }

  private async siteData(now: number): Promise<SiteData | null> {
    let base: string;
    try {
      base = absoluteBase(getPlatform().beatmapBase);
    } catch {
      return null;
    }
    const [songs, index] = await Promise.all([this.text(new URL('songs.json', base).href, now, MIN), this.text(new URL('beatmaps/index.json', base).href, now, MIN)]);
    return songs === null && index === null ? null : parseSiteData({ songs, index });
  }

  private async repoData(repo: RepoRef, now: number, full: boolean): Promise<SiteData | null> {
    const get = (path: string) => this.text(repoFileUrl(repo, path), now, 30_000);
    const [songs, index, status, songsStatus] = await Promise.all([
      get('songs.json'),
      full ? get('beatmaps/index.json') : Promise.resolve(null),
      full ? get('beatmaps/status.json') : Promise.resolve(null),
      get('songs-status.json'),
    ]);
    if (songs === null && songsStatus === null) return null;
    return parseSiteData({ songs, index, ...(full ? { status } : {}), songsStatus });
  }

  /** While songs are on their way: every minute (visible page only), runs (cached as above) and the repository's song files. */
  private schedulePending(soon = false): void {
    if (!addedSongs.hasPending()) {
      if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
      return;
    }
    if (this.pendingTimer !== null && !soon) return;
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(
      () => {
        this.pendingTimer = null;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; // resumes on visibilitychange
        void this.pollPending().finally(() => this.schedulePending());
      },
      soon ? 2_000 : MIN,
    );
  }

  private async pollPending(): Promise<void> {
    if (!addedSongs.hasPending()) return;
    const now = Date.now();
    if (githubConnection().relay && this.relayRepo === null) await this.relayState();
    const repo = this.repo();
    const [runs, repoData] = await Promise.all([this.getRuns(now, false), repo ? this.repoData(repo, now, false) : Promise.resolve(null)]);
    this.feed(runs, repoData);
  }
}

export const songHealth = new SongHealth();

// ---------------------------------------------------------------------------
// The panel

const MARK: Record<HealthCheck['state'], string> = { ok: '✓', warn: '!', problem: '✕', unknown: '?' };
const SPOKEN: Record<HealthCheck['state'], string> = { ok: 'OK', warn: 'Worth a look', problem: 'Problem', unknown: 'Couldn’t check' };

/**
 * The check as a list: one line per check with what to do for a problem.
 * `compact` (the Add a song screen): only the summary and the checks that need
 * attention. Starts a check when created (at most every 30 s).
 */
export function createHealthPanel(opts: { compact?: boolean; title?: string } = {}): { el: HTMLElement; destroy(): void } {
  const summary = h('p', { class: 'health-summary' });
  const when = h('span', { class: 'health-when' });
  const again = h('button', { class: 'btn btn-small', type: 'button', 'data-action': 'health-check' }, 'Check again');
  const list = h('ul', { class: 'health-list' });
  const el = h(
    'section',
    { class: `health${opts.compact ? ' health-compact' : ''}`, 'aria-label': opts.title ?? 'Song adding' },
    h('div', { class: 'health-head' }, summary, when, again),
    list,
  );

  const render = () => {
    const { report, checkedAt, checking } = songHealth.latest();
    el.dataset.state = report?.overall ?? 'unknown';
    summary.textContent = report ? report.summary : checking ? 'Checking song adding…' : 'Song adding hasn’t been checked yet';
    when.textContent = !checking && checkedAt ? `Checked ${ago(checkedAt, Date.now())}` : '';
    // Not disabled while checking: on the TV that would drop the remote's focus.
    again.textContent = checking ? 'Checking…' : 'Check again';
    const rows = (report?.checks ?? []).filter((c) => !opts.compact || c.state === 'warn' || c.state === 'problem');
    const active = document.activeElement as HTMLElement | null;
    const focusedId = active && list.contains(active) ? active.dataset.check : undefined;
    list.replaceChildren(
      ...rows.map((c) =>
        h(
          'li',
          {
            class: 'health-row',
            'data-state': c.state,
            'data-check': c.id,
            'data-focusable': true,
            tabindex: 0,
            'aria-label': `${c.title}. ${SPOKEN[c.state]}. ${c.text}${c.todo ? ` What to do: ${c.todo}` : ''}`,
          },
          h('span', { class: 'health-mark', 'aria-hidden': 'true' }, MARK[c.state]),
          h(
            'div',
            { class: 'health-body' },
            h('p', { class: 'health-title' }, c.title),
            h('p', { class: 'health-text' }, c.text),
            c.todo && h('p', { class: 'health-todo' }, h('strong', {}, 'What to do: '), c.todo),
          ),
        ),
      ),
    );
    list.hidden = rows.length === 0;
    if (focusedId) {
      const again2 = list.querySelector<HTMLElement>(`[data-check="${focusedId}"]`);
      if (again2) focusEl(again2, { instant: true });
    }
  };

  again.addEventListener('click', (e) => {
    e.stopPropagation();
    void songHealth.check(true);
  });
  songHealth.addEventListener('change', render);
  const tick = setInterval(render, 30_000); // keeps "Checked 2 min ago" true
  render();
  void songHealth.check();
  return {
    el,
    destroy() {
      clearInterval(tick);
      songHealth.removeEventListener('change', render);
    },
  };
}
