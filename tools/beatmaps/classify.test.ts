import { describe, expect, it } from 'vitest';
import { classifyYtDlpError, errorDetail } from './classify';

const head = (id: string) =>
  `[youtube] Extracting URL: https://www.youtube.com/watch?v=${id}\n[youtube] ${id}: Downloading webpage\n[youtube] ${id}: Downloading tv client config\n[youtube] ${id}: Downloading tv player API JSON\n`;

const SAMPLES: { name: string; stderr: string; kind: string; summary?: RegExp }[] = [
  {
    name: 'bot check (curly apostrophe, current wording)',
    stderr:
      head('TUVcZfQe-Kw') +
      'ERROR: [youtube] TUVcZfQe-Kw: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication. See  https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp  for how to manually pass cookies. Also see  https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies  for tips on effectively exporting YouTube cookies\n',
    kind: 'blocked',
    summary: /not a bot/,
  },
  {
    name: 'bot check (straight apostrophe)',
    stderr: "ERROR: [youtube] abcdefghijk: Sign in to confirm you're not a bot. This helps protect our community. Learn more\n",
    kind: 'blocked',
  },
  {
    name: 'HTTP 429',
    stderr:
      head('abcdefghijk') +
      'ERROR: [youtube] abcdefghijk: Unable to download webpage: HTTP Error 429: Too Many Requests (caused by <HTTPError 429: Too Many Requests>)\n',
    kind: 'blocked',
    summary: /429/,
  },
  {
    name: 'session rate-limited ("try again later")',
    stderr:
      head('abcdefghijk') +
      'WARNING: [youtube] The current session has been rate-limited by YouTube for up to an hour. It is recommended to use `-t sleep` to add a delay between video requests to avoid exceeding the rate limit. For more information, refer to  https://github.com/yt-dlp/yt-dlp/wiki/Extractors#this-content-isnt-available-try-again-later\n' +
      'ERROR: [youtube] abcdefghijk: Video unavailable. This content isn’t available, try again later.\n',
    kind: 'blocked',
    summary: /rate-limiting/,
  },
  {
    name: 'login required',
    stderr: 'ERROR: [youtube] abcdefghijk: Login required to access this content. Use --cookies-from-browser or --cookies for the authentication.\n',
    kind: 'blocked',
  },
  {
    name: 'age-restricted (video-specific, not a runner block)',
    stderr:
      'ERROR: [youtube] abcdefghijk: Sign in to confirm your age. This video may be inappropriate for some users. Use --cookies-from-browser or --cookies for the authentication. See  https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp  for how to manually pass cookies.\n',
    kind: 'unavailable',
    summary: /Age-restricted/,
  },
  {
    name: 'private video (mentions cookies too)',
    stderr: "ERROR: [youtube] abcdefghijk: Private video. Sign in if you've been granted access to this video. Use --cookies-from-browser or --cookies for the authentication.\n",
    kind: 'unavailable',
    summary: /Private/,
  },
  {
    name: 'removed by uploader',
    stderr: 'ERROR: [youtube] abcdefghijk: Video unavailable. This video has been removed by the uploader\n',
    kind: 'unavailable',
    summary: /removed/,
  },
  {
    name: 'terminated account',
    stderr:
      'ERROR: [youtube] abcdefghijk: Video unavailable. This video is no longer available because the YouTube account associated with this video has been terminated.\n',
    kind: 'unavailable',
  },
  {
    name: 'region-locked',
    stderr:
      'ERROR: [youtube] abcdefghijk: The uploader has not made this video available in your country\nYou might want to use a VPN or a proxy server (with --proxy) to workaround.\n',
    kind: 'unavailable',
    summary: /region/,
  },
  {
    name: 'members-only',
    stderr: 'ERROR: [youtube] abcdefghijk: Join this channel to get access to members-only content like this video, and other exclusive perks.\n',
    kind: 'unavailable',
  },
  {
    name: 'premiere',
    stderr: 'ERROR: [youtube] abcdefghijk: Premieres in 2 hours\n',
    kind: 'unavailable',
  },
  {
    // Captured from yt-dlp 2026.10.26.
    name: 'bad ID (real output)',
    stderr: head('zzzzzzzzzzz') + 'ERROR: [youtube] zzzzzzzzzzz: This video is unavailable\n',
    kind: 'unavailable',
  },
  {
    // Captured from yt-dlp 2026.10.26.
    name: 'live stream without recording (real output)',
    stderr: head('jfKfPfyJRdk') + 'ERROR: [youtube] jfKfPfyJRdk: This live stream recording is not available.\n',
    kind: 'unavailable',
  },
  {
    name: 'private playlist',
    stderr: 'ERROR: [youtube:tab] PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx: The playlist does not exist.\n',
    kind: 'unavailable',
    summary: /Public or Unlisted/,
  },
  {
    name: 'unable to extract (yt-dlp out of date)',
    stderr:
      'ERROR: [youtube] abcdefghijk: Unable to extract yt initial data; please report this issue on  https://github.com/yt-dlp/yt-dlp/issues?q= , filling out the appropriate issue template. Confirm you are on the latest version using  yt-dlp -U\n',
    kind: 'outdated',
    summary: /out of date/,
  },
  {
    name: 'nsig failure then missing formats',
    stderr:
      'WARNING: [youtube] abcdefghijk: nsig extraction failed: Some formats may be missing\n         n = AbCdEf ; player = https://www.youtube.com/s/player/12345678/player_ias.vflset/en_US/base.js\n' +
      'ERROR: [youtube] abcdefghijk: Requested format is not available. Use --list-formats for a list of available formats\n',
    kind: 'outdated',
  },
  {
    name: 'no JS runtime (real warning) then missing formats',
    stderr:
      'WARNING: [youtube] No supported JavaScript runtime could be found. Only deno is enabled by default; to use another runtime add  --js-runtimes RUNTIME[:PATH]  to your command/config. YouTube extraction without a JS runtime has been deprecated, and some formats may be missing. See  https://github.com/yt-dlp/yt-dlp/wiki/EJS  for details on installing one\n' +
      'ERROR: [youtube] abcdefghijk: Requested format is not available. Use --list-formats for a list of available formats\n',
    kind: 'outdated',
    summary: /Deno/,
  },
  {
    name: 'HTTP 403 on media',
    stderr: '[download] Destination: /tmp/x/abcdefghijk.webm\nERROR: unable to download video data: HTTP Error 403: Forbidden\n',
    kind: 'outdated',
  },
  {
    name: 'DNS failure',
    stderr:
      'ERROR: [youtube] abcdefghijk: Unable to download webpage: <urlopen error [Errno -3] Temporary failure in name resolution> (caused by TransportError("<urlopen error [Errno -3] Temporary failure in name resolution>"))\n',
    kind: 'error',
    summary: /Network/,
  },
  {
    name: 'unknown',
    stderr: 'ERROR: something nobody has seen before\n',
    kind: 'error',
  },
  {
    name: 'harmless warning does not decide when the ERROR line is clear',
    stderr: 'WARNING: [youtube] abcdefghijk: nsig extraction failed: Some formats may be missing\nERROR: [youtube] abcdefghijk: Private video. Sign in if you have been granted access\n',
    kind: 'unavailable',
  },
];

describe('classifyYtDlpError', () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const c = classifyYtDlpError(s.stderr);
      expect(c.kind).toBe(s.kind);
      if (s.summary) expect(c.summary).toMatch(s.summary);
      expect(c.detail.length).toBeGreaterThan(0);
      expect(c.detail.length).toBeLessThanOrEqual(300);
      expect(c.detail).not.toMatch(/^ERROR:/);
    });
  }

  it('empty stderr is a plain error', () => {
    expect(classifyYtDlpError('').kind).toBe('error');
  });
});

describe('errorDetail', () => {
  it('uses the last ERROR line', () => {
    expect(errorDetail('[youtube] x\nERROR: first\nsomething\nERROR: second\n')).toBe('second');
  });
  it('falls back to the last line and truncates', () => {
    const d = errorDetail(`a\n${'x'.repeat(500)}\n`);
    expect(d.length).toBe(300);
    expect(d.endsWith('…')).toBe(true);
  });
});
