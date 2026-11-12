import { describe, expect, it } from 'vitest';
import { describeUpdate, parseUpdateState, updateHint, type UpdateState } from './appUpdate';

const base: UpdateState = {
  phase: 'idle',
  installed: '0.5.0',
  installedCode: 1040,
  latest: null,
  message: null,
  stage: null,
  manualUrl: null,
  received: 0,
  total: 0,
};
const st = (o: Partial<UpdateState>): UpdateState => ({ ...base, ...o });

describe('parseUpdateState', () => {
  it('reads what the shell sends', () => {
    const s = parseUpdateState(
      JSON.stringify({ phase: 'available', installed: '0.5.0', installedCode: 1040, latest: '0.6.0', message: null, stage: null, manualUrl: null, received: 0, total: 0 }),
    );
    expect(s).toEqual(st({ phase: 'available', latest: '0.6.0' }));
  });

  it('accepts an already-parsed event payload', () => {
    expect(parseUpdateState({ phase: 'downloading', installed: '0.5.0', received: 10, total: 20 })?.received).toBe(10);
  });

  it('rejects garbage and unknown phases', () => {
    expect(parseUpdateState('not json')).toBeNull();
    expect(parseUpdateState(null)).toBeNull();
    expect(parseUpdateState({ phase: 'explode' })).toBeNull();
    expect(parseUpdateState('[]')).toBeNull();
  });

  it('cleans odd fields', () => {
    const s = parseUpdateState({ phase: 'manual', installed: 7, received: -5, total: 'x', stage: 'nope', manualUrl: 'javascript:alert(1)' })!;
    expect(s.installed).toBe('?');
    expect(s.received).toBe(0);
    expect(s.total).toBe(0);
    expect(s.stage).toBeNull();
    expect(s.manualUrl).toBeNull();
  });
});

describe('describeUpdate', () => {
  it('up to date, with Check again', () => {
    const v = describeUpdate(st({ phase: 'up-to-date', latest: '0.5.0' }));
    expect(v.status).toBe('Installed 0.5.0 · Up to date');
    expect(v.buttons.map((b) => b.action)).toEqual(['update-check']);
  });

  it('update available, with Update', () => {
    const v = describeUpdate(st({ phase: 'available', latest: '0.6.0' }));
    expect(v.status).toBe('Installed 0.5.0 · Update available: 0.6.0');
    expect(v.buttons).toEqual([{ action: 'update-start', label: 'Update', primary: true }]);
    expect(v.cancellable).toBe(false);
  });

  it("couldn't check, with Retry", () => {
    const v = describeUpdate(st({ phase: 'error', stage: 'check', message: 'no internet connection' }));
    expect(v.status).toBe('Installed 0.5.0 · Couldn’t check (no internet connection)');
    expect(v.buttons.map((b) => b.label)).toEqual(['Retry']);
  });

  it('update failed, with Try again', () => {
    const v = describeUpdate(st({ phase: 'error', stage: 'update', latest: '0.6.0', message: 'the download was incomplete' }));
    expect(v.status).toContain('Update failed: the download was incomplete');
    expect(v.buttons[0].action).toBe('update-start');
  });

  it('downloading shows progress and can be cancelled', () => {
    const v = describeUpdate(st({ phase: 'downloading', latest: '0.6.0', received: 5 * 1048576, total: 20 * 1048576 }));
    expect(v.status).toBe('Downloading 0.6.0… 25% (5.0 of 20.0 MB)');
    expect(v.progress).toBeCloseTo(0.25);
    expect(v.cancellable).toBe(true);
    expect(v.buttons.map((b) => b.action)).toEqual(['update-cancel']);
    // Unknown size: megabytes only, no bar.
    const u = describeUpdate(st({ phase: 'downloading', latest: '0.6.0', received: 3 * 1048576 }));
    expect(u.status).toBe('Downloading 0.6.0… 3.0 MB');
    expect(u.progress).toBeNull();
  });

  it('asks for the install permission', () => {
    const v = describeUpdate(st({ phase: 'needs-permission', latest: '0.6.0' }));
    expect(v.buttons.map((b) => b.action)).toEqual(['update-settings', 'update-cancel']);
    expect(v.detail).toContain('Allow from this source');
  });

  it('manual reinstall shows the Downloader address', () => {
    const url = 'https://github.com/o/r/releases/latest/download/dancedance.apk';
    const v = describeUpdate(st({ phase: 'manual', latest: '0.6.0', message: 'This one needs a manual reinstall with Downloader from', manualUrl: url }));
    expect(v.url).toBe(url);
    expect(v.detail).toBe('This one needs a manual reinstall with Downloader from:');
    expect(v.buttons.some((b) => b.action === 'update-start')).toBe(false);
  });

  it('checking has no buttons; off says so', () => {
    expect(describeUpdate(st({ phase: 'checking' })).buttons).toEqual([]);
    expect(describeUpdate(st({ phase: 'off' })).detail).toBe('Update checks are off in this build.');
  });
});

describe('updateHint', () => {
  it('only when there is something to install', () => {
    expect(updateHint(st({ phase: 'available', latest: '0.6.0' }))).toBe('Update available: 0.6.0');
    expect(updateHint(st({ phase: 'manual', latest: '0.6.0' }))).toBe('Update available: 0.6.0');
    expect(updateHint(st({ phase: 'up-to-date' }))).toBeNull();
    expect(updateHint(st({ phase: 'downloading' }))).toBeNull();
    expect(updateHint(null)).toBeNull();
  });
});
