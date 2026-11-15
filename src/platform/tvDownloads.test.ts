import { describe, expect, it } from 'vitest';
import { RETAIN_MS, TvDownloads } from './tvDownloads';

/** A fake shell: downloads the test resolves by hand; cancelled ones reject. */
function shell() {
  const started: string[] = [];
  const cancelled: string[] = [];
  const pending = new Map<string, { resolve: (v: string) => void; reject: (e: unknown) => void }>();
  const timers: (() => void)[] = [];
  const d = new TvDownloads<string>(
    (id) => {
      started.push(id);
      return new Promise<string>((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    (id) => {
      cancelled.push(id);
      pending.get(id)?.reject(new Error('cancelled'));
    },
    (fn) => timers.push(fn),
  );
  return { d, started, cancelled, finish: (id: string) => pending.get(id)!.resolve(`file:${id}`), retainOver: () => timers.splice(0).forEach((f) => f()) };
}

describe('TV downloads: the background yields to the user', () => {
  it('a song opened mid-background-download starts at once and the background download is cancelled', async () => {
    const { d, started, cancelled, finish } = shell();
    const bg = d.prepare('BGSONG00001', true);
    bg.catch(() => {});
    expect(d.foregroundLoading()).toBe(false); // the background alone never counts as the user's loading
    // The user opens another song: the beat-finding abandons its song (BeatSession holds it) ...
    expect(d.abandonBackground('BGSONG00001', 'USERSONG001')).toBe(true);
    const fg = d.prepare('USERSONG001');
    // ... its download is cancelled (the shell's slot and the bandwidth are free), the user's started straight away.
    expect(cancelled).toEqual(['BGSONG00001']);
    expect(started).toEqual(['BGSONG00001', 'USERSONG001']);
    await expect(bg).rejects.toThrow('cancelled');
    expect(d.foregroundLoading()).toBe(true);
    finish('USERSONG001');
    await expect(fg).resolves.toBe('file:USERSONG001');
  });

  it('opening the very song the background is downloading keeps that download (it is the user\'s now)', async () => {
    const { d, started, cancelled, finish } = shell();
    const bg = d.prepare('SAMESONG001', true);
    expect(d.abandonBackground('SAMESONG001', 'SAMESONG001')).toBe(false);
    const fg = d.prepare('SAMESONG001');
    expect(fg).toBe(bg); // one download, shared
    expect(cancelled).toEqual([]);
    expect(started).toEqual(['SAMESONG001']);
    expect(d.foregroundLoading()).toBe(true);
    finish('SAMESONG001');
    await fg;
  });

  it('the background waits while the user\'s song loads and for its analysis time after, then resumes', async () => {
    const { d, finish, retainOver } = shell();
    const fg = d.prepare('USERSONG001');
    expect(d.foregroundLoading()).toBe(true);
    finish('USERSONG001');
    await fg;
    expect(d.foregroundLoading()).toBe(true); // still within RETAIN_MS: its analysis may be running
    expect(RETAIN_MS).toBeGreaterThan(0);
    retainOver();
    expect(d.foregroundLoading()).toBe(false); // the background may go on
    // A background download a user's song joins is not abandoned.
    const bg = d.prepare('BGSONG00002', true);
    d.prepare('BGSONG00002');
    expect(d.abandonBackground('BGSONG00002', null)).toBe(false);
    finish('BGSONG00002');
    await bg;
  });
});
