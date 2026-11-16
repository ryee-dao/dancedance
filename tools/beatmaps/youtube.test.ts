/// <reference types="node" />
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyYtDlpError } from './classify';
import {
  attemptPlan,
  attemptsLine,
  baseArgs,
  COOKIE_CLIENT_FALLBACKS,
  DOWNLOAD_BUDGET_MS,
  DownloadFailure,
  downloadWithFallbacks,
  representative,
  ToolFailure,
  type AttemptFn,
  type DownloadAttempt,
  type YtDlpOptions,
} from './youtube';

const NO_AUDIO = 'ERROR: [youtube] erSoNgCLGRE: Requested format is not available. Use --list-formats for a list of available formats';
const BOT = "ERROR: [youtube] erSoNgCLGRE: Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication.";
const RELOAD = 'ERROR: [youtube] erSoNgCLGRE: The page needs to be reloaded.';
const PRIVATE = 'ERROR: [youtube] erSoNgCLGRE: Private video. Sign in if you have been granted access to this video';
const BROKEN = 'ERROR: [youtube] erSoNgCLGRE: Unable to extract yt initial data; please report this issue. Confirm you are on the latest version using  yt-dlp -U';

const COOKIES: YtDlpOptions = { cookiesFile: '/tmp/x/cookies.txt' };

interface Call {
  client: string | undefined;
  cookies: string | undefined;
  timeoutMs: number;
}

/** A scripted yt-dlp: one stderr per attempt (null = success), recording what each attempt was given. */
function scripted(answers: (string | null)[], calls: Call[], onCall?: () => void): AttemptFn {
  let i = 0;
  return async (id, dir, o, client, timeoutMs) => {
    calls.push({ client, cookies: o.cookiesFile, timeoutMs });
    onCall?.();
    const a = answers[i++];
    // Each attempt leaves a partial file behind; the next must start clean.
    await writeFile(join(dir, `${id}.part-${i}`), 'x');
    if (a === null || a === undefined) {
      const p = join(dir, `${id}.m4a`);
      await writeFile(p, 'audio');
      return { kind: 'file', path: p };
    }
    throw new ToolFailure(classifyYtDlpError(a), 'yt-dlp');
  };
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dd-yt-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const at = (label: string, cookies: boolean, stderr: string): DownloadAttempt => ({ label, cookies, classification: classifyYtDlpError(stderr) });

describe('download attempts', () => {
  it('without cookies: one attempt with yt-dlp’s defaults, exactly as before', () => {
    expect(attemptPlan({})).toEqual([{ cookies: false, label: 'default' }]);
  });

  it('with cookies: defaults, the token-free cookie clients, then the defaults without cookies', () => {
    expect(COOKIE_CLIENT_FALLBACKS).toEqual(['tv', 'tv_downgraded', 'web_safari']);
    expect(attemptPlan(COOKIES).map((a) => [a.label, a.client, a.cookies])).toEqual([
      ['default', undefined, true],
      ['tv', 'tv', true],
      ['tv_downgraded', 'tv_downgraded', true],
      ['web_safari', 'web_safari', true],
      ['no cookies', undefined, false],
    ]);
  });

  it('the first attempt is unchanged: the same options, no client, the old 6 min timeout', async () => {
    const calls: Call[] = [];
    const r = await downloadWithFallbacks('erSoNgCLGRE', dir, COOKIES, scripted([null], calls));
    expect(r.kind).toBe('file');
    expect(calls).toEqual([{ client: undefined, cookies: COOKIES.cookiesFile, timeoutMs: 6 * 60_000 }]);
    expect(baseArgs(COOKIES)).toContain('--cookies');
  });

  it('falls through to a later client, cleaning the folder between attempts', async () => {
    const calls: Call[] = [];
    const r = await downloadWithFallbacks('erSoNgCLGRE', dir, COOKIES, scripted([NO_AUDIO, RELOAD, null], calls));
    expect(r).toEqual({ kind: 'file', path: join(dir, 'erSoNgCLGRE.m4a') });
    expect(calls.map((c) => c.client)).toEqual([undefined, 'tv', 'tv_downgraded']);
    expect((await readdir(dir)).sort()).toEqual(['erSoNgCLGRE.m4a', 'erSoNgCLGRE.part-3']);
  });

  it('the last attempt goes without cookies', async () => {
    const calls: Call[] = [];
    await downloadWithFallbacks('erSoNgCLGRE', dir, COOKIES, scripted([NO_AUDIO, NO_AUDIO, NO_AUDIO, NO_AUDIO, null], calls));
    expect(calls.map((c) => c.cookies)).toEqual([COOKIES.cookiesFile, COOKIES.cookiesFile, COOKIES.cookiesFile, COOKIES.cookiesFile, undefined]);
  });

  it('all failing: every attempt is kept, and "no audio" from all of them is not "out of date"', async () => {
    const calls: Call[] = [];
    const e = await downloadWithFallbacks('erSoNgCLGRE', dir, COOKIES, scripted([NO_AUDIO, RELOAD, RELOAD, NO_AUDIO, BOT], calls)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(DownloadFailure);
    const f = e as DownloadFailure;
    expect(f).toBeInstanceOf(ToolFailure); // the pipeline's classify() still understands it
    expect(f.attempts.map((a) => [a.label, a.classification.kind])).toEqual([
      ['default', 'withheld'],
      ['tv', 'error'],
      ['tv_downgraded', 'error'],
      ['web_safari', 'withheld'],
      ['no cookies', 'blocked'],
    ]);
    // The cookie-less bot check is expected on GitHub's machines: it does not speak for the signed-in session.
    expect(f.classification.kind).toBe('withheld');
    expect(f.classification.detail).toMatch(/Requested format is not available/);
    expect(attemptsLine(f.attempts)).toBe('default: withheld; tv: error; tv_downgraded: error; web_safari: withheld; no cookies: blocked');
    expect((await readdir(dir)).length).toBe(0);
  });

  it('a bot check from a signed-in attempt outranks "no audio"', async () => {
    const e = (await downloadWithFallbacks('erSoNgCLGRE', dir, COOKIES, scripted([NO_AUDIO, BOT, NO_AUDIO, NO_AUDIO, NO_AUDIO], [])).catch((x: unknown) => x)) as DownloadFailure;
    expect(e.classification.kind).toBe('blocked');
  });

  it('a removed or private video stops at once', async () => {
    const calls: Call[] = [];
    const e = (await downloadWithFallbacks('erSoNgCLGRE', dir, COOKIES, scripted([NO_AUDIO, PRIVATE, null], calls)).catch((x: unknown) => x)) as DownloadFailure;
    expect(calls.length).toBe(2);
    expect(e.classification.kind).toBe('unavailable');
    expect(e.attempts.length).toBe(2);
  });

  it('without cookies a failure carries the one attempt and its own classification', async () => {
    const e = (await downloadWithFallbacks('erSoNgCLGRE', dir, {}, scripted([BOT], [])).catch((x: unknown) => x)) as DownloadFailure;
    expect(e.attempts.length).toBe(1);
    expect(e.classification).toEqual(classifyYtDlpError(BOT));
  });

  it('keeps all attempts of one song within the time budget', async () => {
    let t = 0;
    const calls: Call[] = [];
    // Each attempt takes 4 min: the first gets its full 6 min, the next the 6 min left, the third only 2 min, then no more.
    const e = (await downloadWithFallbacks('erSoNgCLGRE', dir, COOKIES, scripted([NO_AUDIO, NO_AUDIO, NO_AUDIO, NO_AUDIO, NO_AUDIO], calls, () => (t += 4 * 60_000)), () => t).catch(
      (x: unknown) => x,
    )) as DownloadFailure;
    expect(DOWNLOAD_BUDGET_MS).toBe(10 * 60_000);
    expect(calls.map((c) => c.timeoutMs)).toEqual([6 * 60_000, 6 * 60_000, 2 * 60_000]);
    expect(e.attempts.length).toBe(3);
    expect(e.classification.kind).toBe('withheld');
  });
});

describe('which attempt speaks for the song', () => {
  it('blocked > outdated > withheld > error, earliest on a tie', () => {
    expect(representative([at('default', true, RELOAD), at('tv', true, NO_AUDIO), at('web_safari', true, NO_AUDIO)], true).label).toBe('tv');
    expect(representative([at('default', true, NO_AUDIO), at('tv', true, BROKEN)], true).classification.kind).toBe('outdated');
    expect(representative([at('default', true, BROKEN), at('tv', true, BOT)], true).classification.kind).toBe('blocked');
  });
  it('the cookie-less bot check counts only without cookies, or when it is all there is', () => {
    expect(representative([at('default', true, RELOAD), at('no cookies', false, BOT)], true).classification.kind).toBe('error');
    expect(representative([at('default', false, BOT)], false).classification.kind).toBe('blocked');
    expect(representative([at('no cookies', false, BOT)], true).classification.kind).toBe('blocked');
  });
});
