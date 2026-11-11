/**
 * Which songs does this run process? Pure: no I/O.
 */

/** Finer-grained reason stored next to a non-ok state in status.json. */
export type StatusReason = 'blocked' | 'outdated' | 'unavailable' | 'error' | 'too-long' | 'live' | 'filtered';

export interface VideoStatus {
  state: 'ok' | 'blocked' | 'error';
  reason?: StatusReason;
  message?: string;
  attempts: number;
  /** ISO timestamp. */
  lastTried: string;
}

export interface Candidate {
  videoId: string;
  title?: string;
  artist?: string;
  /** Seconds, when known from playlist metadata. */
  duration?: number;
  /** yt-dlp live_status when known: 'is_live' | 'is_upcoming' | 'was_live' | 'not_live' | ... */
  liveStatus?: string;
  origin: 'playlist' | 'starter' | 'added' | 'manual';
}

/**
 * 'add': chosen for a song added by search (not produced by planWork).
 * 'upgrade': the only map is a contributed listening ('tab') map; a real
 * download + analysis replaces it ('cloud' outranks 'tab'). Lowest priority.
 */
export type WorkReason = 'new' | 'retry' | 'stale' | 'forced' | 'add' | 'upgrade';

export interface WorkItem {
  candidate: Candidate;
  why: WorkReason;
}

export interface PlanInput {
  candidates: Candidate[];
  /** videoId -> analyzerVersion of the existing map file (only valid maps). */
  existing: ReadonlyMap<string, string>;
  status: Readonly<Record<string, VideoStatus>>;
  analyzerVersion: string;
  now: Date;
  limit: number;
  force?: boolean;
  /** videoId -> `source` of the existing map; maps from listening ('tab'/'mic') are re-analysed when possible. */
  sources?: ReadonlyMap<string, string>;
  /** Ignore the backoff of songs that failed because YouTube blocked or yt-dlp broke (local sync). */
  retryBlocked?: boolean;
}

/** Map sources that a real download + analysis should replace. */
export const UPGRADABLE_SOURCES: ReadonlySet<string> = new Set(['tab', 'mic']);

export interface Plan {
  todo: WorkItem[];
  /** Up to date at the current analyser version. */
  done: number;
  /** Failed before and still inside the retry backoff window. */
  waiting: number;
  /** Eligible but beyond --limit; picked up by later runs. */
  deferred: number;
}

export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const MAX_DURATION_S = 15 * 60;

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** Cron start times jitter; treat "due in a few minutes" as due. */
const SLACK_MS = 10 * 60_000;

/** Merge candidate lists, first occurrence wins (so playlist metadata beats starter metadata). */
export function unionCandidates(...lists: Candidate[][]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const list of lists) {
    for (const c of list) {
      if (!VIDEO_ID_RE.test(c.videoId) || seen.has(c.videoId)) continue;
      seen.add(c.videoId);
      out.push(c);
    }
  }
  return out;
}

/** How long to wait after a failure before trying the song again. */
export function retryDelayMs(s: VideoStatus): number {
  if (s.state === 'ok') return Infinity;
  const n = Math.max(1, s.attempts);
  const exp = (base: number, cap: number) => Math.min(cap, base * 2 ** (n - 1));
  switch (s.reason ?? (s.state === 'blocked' ? 'blocked' : 'error')) {
    case 'too-long':
      return Infinity; // only with --force
    case 'blocked':
      // Not the song's fault, but don't hammer: 1h, 2h, 4h, 8h, then every 12h.
      return exp(HOUR, 12 * HOUR);
    case 'unavailable':
      return exp(DAY, 30 * DAY);
    case 'live':
    case 'filtered':
      return exp(6 * HOUR, 7 * DAY);
    case 'outdated':
    case 'error':
    default:
      return exp(HOUR, 7 * DAY);
  }
}

export function isDue(s: VideoStatus, now: Date): boolean {
  const last = Date.parse(s.lastTried);
  if (!Number.isFinite(last)) return true;
  return now.getTime() + SLACK_MS >= last + retryDelayMs(s);
}

/**
 * Order: never-tried songs first (in candidate order: playlist, then starter
 * pack), then failed songs whose backoff has expired, then maps made by an
 * older analyser version, then songs whose only map came from listening
 * (contributed 'tab' maps). Capped at `limit`.
 */
export function planWork(p: PlanInput): Plan {
  const groups: Record<Exclude<WorkReason, 'add'>, WorkItem[]> = { forced: [], new: [], retry: [], stale: [], upgrade: [] };
  let done = 0;
  let waiting = 0;
  const due = (st: VideoStatus) =>
    (p.retryBlocked && (st.state === 'blocked' || st.reason === 'blocked' || st.reason === 'outdated')) || isDue(st, p.now);
  for (const c of p.candidates) {
    const version = p.existing.get(c.videoId);
    const st = p.status[c.videoId];
    if (p.force) {
      groups.forced.push({ candidate: c, why: 'forced' });
      continue;
    }
    if (version !== undefined && UPGRADABLE_SOURCES.has(p.sources?.get(c.videoId) ?? '')) {
      // Playable already (a contributed listening map); try a real analysis last, with the usual backoff.
      if (st && st.state !== 'ok' && !due(st)) waiting++;
      else groups.upgrade.push({ candidate: c, why: 'upgrade' });
      continue;
    }
    if (version === p.analyzerVersion) {
      done++;
      continue;
    }
    if (st && st.state !== 'ok') {
      if (due(st)) groups.retry.push({ candidate: c, why: 'retry' });
      else waiting++;
      continue;
    }
    if (version !== undefined) groups.stale.push({ candidate: c, why: 'stale' });
    else groups.new.push({ candidate: c, why: 'new' });
  }
  const all = [...groups.forced, ...groups.new, ...groups.retry, ...groups.stale, ...groups.upgrade];
  const limit = Math.max(0, Math.floor(p.limit));
  return { todo: all.slice(0, limit), done, waiting, deferred: Math.max(0, all.length - limit) };
}

/** Reasons to skip a song without downloading anything, from playlist metadata. */
export function preflightSkip(c: Candidate): { reason: 'too-long' | 'live'; message: string } | null {
  if (c.liveStatus === 'is_live' || c.liveStatus === 'is_upcoming' || c.liveStatus === 'post_live') {
    return { reason: 'live', message: `Skipped: live stream or premiere (${c.liveStatus})` };
  }
  if (c.duration !== undefined && c.duration > MAX_DURATION_S) {
    return { reason: 'too-long', message: `Skipped: ${Math.round(c.duration / 60)} min is longer than the 15 min limit` };
  }
  return null;
}
