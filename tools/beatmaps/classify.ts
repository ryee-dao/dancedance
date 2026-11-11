/**
 * Classify yt-dlp failures from their stderr text.
 *
 *  - blocked:     YouTube is refusing this machine (bot check, rate limit, login wall). Cookies may help.
 *  - outdated:    yt-dlp could not understand YouTube's current page or player (update yt-dlp), or its
 *                 JavaScript challenge solver could not run.
 *  - unavailable: this one video is private, removed, region-locked, members-only, age-restricted...
 *  - error:       anything else (network hiccups, ffmpeg, our own bugs). Retried later.
 *
 * Pure: no I/O.
 */

export type FailureKind = 'blocked' | 'outdated' | 'unavailable' | 'error';

export interface Classification {
  kind: FailureKind;
  /** Short plain-English explanation for summaries and status.json. */
  summary: string;
  /** The most relevant yt-dlp error line (trimmed, at most 300 chars). */
  detail: string;
}

interface Rule {
  kind: FailureKind;
  re: RegExp;
  summary: string;
}

const JS_RUNTIME_RE = /no supported javascript runtime|javascript runtime (?:could not|was not) (?:be )?found|challenge solving failed|ejs[^\n]*(?:not (?:installed|found|available)|missing)/i;
const JS_RUNTIME_SUMMARY = "yt-dlp could not solve YouTube's JavaScript challenge (is Deno installed? is yt-dlp current?)";

// Order matters: the first matching rule wins. Rate-limit wording contains
// "isn't available", so the blocked rules come before the unavailable ones.
const RULES: Rule[] = [
  { kind: 'blocked', re: /sign in to confirm (?:that )?you(?:'|’)?re not a bot/i, summary: 'YouTube asked this machine to prove it is not a bot' },
  { kind: 'blocked', re: /HTTP Error 429|Too Many Requests/i, summary: 'YouTube is rate-limiting this machine (HTTP 429)' },
  { kind: 'blocked', re: /content isn(?:'|’)?t available,? try again later|rate[- ]limited by YouTube/i, summary: 'YouTube is rate-limiting this machine ("try again later")' },
  { kind: 'blocked', re: /your IP (?:address )?(?:is likely being|has been) blocked/i, summary: 'YouTube is blocking this IP address' },

  // Video-specific problems. These often also say "use --cookies", so they come before the login rule.
  { kind: 'unavailable', re: /sign in to confirm your age|age[- ]restricted|inappropriate for some users/i, summary: 'Age-restricted video (needs cookies from an age-verified account)' },
  { kind: 'unavailable', re: /members[- ]only|join this channel to get access|available to this channel(?:'|’)?s members/i, summary: 'Members-only video' },
  { kind: 'unavailable', re: /private video|video is private/i, summary: 'Private video' },
  { kind: 'unavailable', re: /removed by the uploader|has been removed|no longer available|account associated with this video has been terminated|deleted video/i, summary: 'Video was removed' },
  { kind: 'unavailable', re: /not (?:made this video )?available in your country|blocked it in your country|geo[- ]?restrict/i, summary: 'Video is region-locked' },
  { kind: 'unavailable', re: /copyright (?:claim|grounds)/i, summary: 'Video was taken down for copyright' },
  { kind: 'unavailable', re: /premieres in|live event will begin|this live event/i, summary: 'Video is a premiere or live event that has not started' },
  { kind: 'unavailable', re: /live stream recording is not available/i, summary: 'Live stream (no recording available)' },
  { kind: 'unavailable', re: /incomplete youtube id|is not a valid url|unsupported url/i, summary: 'Not a valid YouTube video ID' },
  { kind: 'unavailable', re: /the playlist does not exist|this playlist is private|playlist (?:is private|does not exist)/i, summary: 'Playlist is private or does not exist (it must be Public or Unlisted)' },
  { kind: 'unavailable', re: /video (?:is )?unavailable|this video (?:is not|isn(?:'|’)?t) available/i, summary: 'Video is unavailable' },

  { kind: 'blocked', re: /login required|requires? (?:a )?log ?in|use --cookies-from-browser or --cookies for the authentication|need to log in/i, summary: 'YouTube wants a signed-in session for this request' },

  { kind: 'outdated', re: JS_RUNTIME_RE, summary: JS_RUNTIME_SUMMARY },
  { kind: 'outdated', re: /unable to extract|signature extraction failed|nsig extraction failed|failed to extract any player response|failed to parse json|confirm you are on the latest version|yt-dlp -U|requested format is not available|only images are available/i, summary: 'yt-dlp could not read YouTube; it is probably out of date' },
  { kind: 'outdated', re: /HTTP Error 403/i, summary: 'YouTube refused the media download (HTTP 403); usually fixed by a newer yt-dlp' },

  { kind: 'error', re: /timed out|connection (?:reset|refused|aborted)|getaddrinfo|name resolution|network is unreachable|unable to download webpage|remote end closed/i, summary: 'Network error talking to YouTube' },
];

const MAX_DETAIL = 300;

/** The most relevant error line: the last `ERROR:` line, else the last non-empty line. */
export function errorDetail(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errLines = lines.filter((l) => /^ERROR:/i.test(l));
  let line = errLines.length ? errLines[errLines.length - 1] : (lines[lines.length - 1] ?? '');
  line = line.replace(/^ERROR:\s*/i, '');
  return line.length > MAX_DETAIL ? `${line.slice(0, MAX_DETAIL - 1)}…` : line;
}

/**
 * Classify a failed yt-dlp run. ERROR lines are matched first (they are what
 * actually failed); warnings are consulted only when no ERROR line matches,
 * because yt-dlp prints harmless warnings on successful runs too.
 */
export function classifyYtDlpError(stderr: string): Classification {
  const detail = errorDetail(stderr);
  const errors = stderr
    .split(/\r?\n/)
    .filter((l) => /^\s*ERROR:/i.test(l))
    .join('\n');
  for (const text of [errors, stderr]) {
    if (!text) continue;
    for (const r of RULES) {
      if (!r.re.test(text)) continue;
      // "Requested format is not available" is usually the symptom; a missing JS runtime warning is the cause.
      if (r.kind === 'outdated' && JS_RUNTIME_RE.test(stderr)) return { kind: 'outdated', summary: JS_RUNTIME_SUMMARY, detail };
      return { kind: r.kind, summary: r.summary, detail };
    }
  }
  return { kind: 'error', summary: 'yt-dlp failed', detail: detail || 'yt-dlp failed without an error message' };
}
