/**
 * GitHub Actions annotations and the Markdown run summary. Pure: no I/O.
 */
import type { StatusReason, WorkReason } from './select';

export type ResultKind = 'ok' | 'blocked' | 'outdated' | 'unavailable' | 'error' | 'skipped';

export interface SongResult {
  videoId: string;
  title?: string;
  artist?: string;
  why: WorkReason;
  kind: ResultKind;
  reason?: StatusReason;
  message?: string;
  bpm?: number;
  seconds?: number;
}

export type Fatal = 'blocked' | 'outdated' | 'playlist' | null;

/** One "add a song by search" request. */
export interface AddResult {
  artist: string;
  title: string;
  /** 'planned' = dry run; 'skipped' = not attempted this run. */
  kind: 'added' | 'already' | 'not-found' | 'blocked' | 'error' | 'skipped' | 'planned';
  videoId?: string;
  tier?: string;
  videoTitle?: string;
  channel?: string;
  videoSeconds?: number;
  officialSeconds?: number;
  bpm?: number;
  seconds?: number;
  message?: string;
}

export interface RunReport {
  results: SongResult[];
  /** Songs added by search (add mode, or automatic retries). */
  adds?: AddResult[];
  plan: { todo: number; done: number; waiting: number; deferred: number };
  /** `skipped`: an add-by-search run, which leaves the playlist for the next regular run. */
  playlist: { configured: boolean; count?: number; error?: string; skipped?: boolean };
  /** Why the run stopped early, if it did. */
  stoppedEarly?: 'blocked' | 'outdated';
  fatal: Fatal;
  usedCookies: boolean;
  dryRun: boolean;
}

/** Escape an annotation message (GitHub workflow-command data). */
export function escapeData(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Escape an annotation property value such as `title`. */
export function escapeProperty(s: string): string {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

export function annotation(level: 'error' | 'warning' | 'notice', title: string, message: string): string {
  return `::${level} title=${escapeProperty(title)}::${escapeData(message)}`;
}

function cell(s: string | undefined): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

const KIND_LABEL: Record<ResultKind, string> = {
  ok: 'OK',
  blocked: 'Blocked',
  outdated: 'yt-dlp outdated',
  unavailable: 'Unavailable',
  error: 'Error',
  skipped: 'Skipped',
};

const ADD_LABEL: Record<AddResult['kind'], string> = {
  added: 'Added',
  already: 'Already added',
  'not-found': 'Not found',
  blocked: 'Blocked',
  error: 'Error',
  skipped: 'Not tried',
  planned: 'Planned',
};

export const COOKIES_HELP =
  'YouTube is bot-blocking the GitHub runner. Add cookies from a spare Google account (never your main one) as the ' +
  'repository secret `YT_COOKIES`: Settings -> Secrets and variables -> Actions -> New repository secret. ' +
  'The README section "When the beat-map job goes red" has step-by-step instructions.';

export const OUTDATED_HELP =
  'yt-dlp could not understand YouTube. The job installs the latest yt-dlp on every run, so a fix usually arrives within ' +
  'a few days of YouTube changing something. If you pinned yt-dlp with the `YTDLP_VERSION` repository variable, raise ' +
  'or delete it. Make sure the job still installs Deno (yt-dlp needs it for YouTube).';

export function renderSummary(r: RunReport): string {
  const out: string[] = [];
  const ok = r.results.filter((x) => x.kind === 'ok').length;
  const failed = r.results.length - ok;
  out.push(`## Beat maps${r.dryRun ? ' (dry run)' : ''}`);
  out.push('');
  if (r.fatal === 'blocked') {
    out.push(`> [!CAUTION]\n> **YouTube is bot-blocking this runner.** ${COOKIES_HELP}${r.usedCookies ? ' Cookies were used on this run, so they may have expired: export fresh ones.' : ''}`);
    out.push('');
  } else if (r.fatal === 'outdated') {
    out.push(`> [!CAUTION]\n> **yt-dlp is out of date or could not run.** ${OUTDATED_HELP}`);
    out.push('');
  } else if (r.stoppedEarly === 'blocked') {
    out.push('> [!WARNING]\n> YouTube started rate-limiting part-way through, so this run stopped early. The rest will be retried on later runs.');
    out.push('');
  }
  if (r.playlist.error) {
    out.push(`> [!WARNING]\n> Could not read the playlist: ${r.playlist.error}`);
    out.push('');
  }
  const pl = r.playlist.skipped
    ? 'playlist: not read on an add-a-song run'
    : r.playlist.configured
    ? r.playlist.count !== undefined
      ? `playlist: ${r.playlist.count} songs`
      : 'playlist: not read'
    : 'playlist: `PLAYLIST_URL` not set (starter pack only)';
  out.push(
    (r.dryRun ? `Would process ${r.results.length} song(s). ` : `Processed ${r.results.length} song(s): ${ok} ok, ${failed} not ok. `) +
      `Already up to date: ${r.plan.done}. Waiting to retry: ${r.plan.waiting}. Left for later runs: ${r.plan.deferred}. ` +
      `${pl}. Cookies: ${r.usedCookies ? 'yes' : 'no'}.`,
  );
  if (r.adds?.length) {
    out.push('');
    out.push('### Added by search');
    out.push('');
    out.push('| Song | Result | Video | Kind | Length (video / official) | Details |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const a of r.adds) {
      const video = a.videoId ? `[${a.videoId}](https://www.youtube.com/watch?v=${a.videoId})${a.videoTitle ? ` ${cell(a.videoTitle)}${a.channel ? ` (${cell(a.channel)})` : ''}` : ''}` : '';
      const len = a.videoSeconds !== undefined || a.officialSeconds !== undefined ? `${a.videoSeconds ?? '?'} s / ${a.officialSeconds ?? '?'} s` : '';
      out.push(`| ${cell(`${a.artist} - ${a.title}`)} | ${ADD_LABEL[a.kind]} | ${video} | ${a.tier ?? ''} | ${len} | ${cell(a.message)} |`);
    }
  }
  if (r.results.length) {
    out.push('');
    out.push('| Video | Song | Why | Result | BPM | Time | Details |');
    out.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const x of r.results) {
      const song = x.title ? (x.artist ? `${x.artist} - ${x.title}` : x.title) : '';
      out.push(
        `| [${x.videoId}](https://www.youtube.com/watch?v=${x.videoId}) | ${cell(song)} | ${x.why} | ${r.dryRun && x.kind === 'ok' ? 'Planned' : KIND_LABEL[x.kind]} | ` +
          `${x.bpm !== undefined ? x.bpm.toFixed(1) : ''} | ${x.seconds !== undefined ? `${x.seconds.toFixed(1)} s` : ''} | ${cell(x.message)} |`,
      );
    }
  }
  out.push('');
  return out.join('\n');
}

/** Annotation lines to print (one per problem type, not one per song). */
export function renderAnnotations(r: RunReport): string[] {
  const lines: string[] = [];
  if (r.fatal === 'blocked') lines.push(annotation('error', 'YouTube is bot-blocking this runner', COOKIES_HELP));
  if (r.fatal === 'outdated') lines.push(annotation('error', 'yt-dlp is out of date', OUTDATED_HELP));
  if (r.fatal === 'playlist') lines.push(annotation('error', 'Could not read the playlist', r.playlist.error ?? 'unknown error'));
  else if (r.playlist.error) lines.push(annotation('warning', 'Could not read the playlist', r.playlist.error));
  if (r.stoppedEarly === 'blocked' && r.fatal !== 'blocked') {
    lines.push(annotation('warning', 'YouTube rate limit', 'Stopped early after several blocked downloads; the rest will be retried later.'));
  }
  for (const a of r.adds ?? []) {
    if (a.kind === 'not-found' || a.kind === 'error') lines.push(annotation('warning', `Could not add ${a.artist} - ${a.title}`, a.message ?? ''));
  }
  for (const x of r.results) {
    if (x.kind === 'ok' || x.kind === 'skipped') continue;
    if ((x.kind === 'blocked' && r.fatal === 'blocked') || (x.kind === 'outdated' && r.fatal === 'outdated')) continue;
    lines.push(annotation('warning', `${KIND_LABEL[x.kind]}: ${x.videoId}`, x.message ?? ''));
  }
  return lines;
}
