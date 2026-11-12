import { describe, expect, it } from 'vitest';
import { chromeVersion, makeWav, parseStored, percentile, shortGpu, summarize, summaryString, tvAppVersion } from './gfxStats';

describe('graphics test stats', () => {
  it('summarizes frame intervals', () => {
    const iv = [16, 17, 16, 17, 16, 50];
    const s = summarize(iv, [1, 2, 3])!;
    expect(s.frames).toBe(6);
    expect(s.fps).toBeCloseTo((6 * 1000) / 132, 1);
    expect(s.med).toBe(16);
    expect(s.p95).toBe(50);
    expect(s.js).toBe(2);
    expect(summarize([16], [])).toBeNull();
  });

  it('takes nearest-rank percentiles', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4], 1)).toBe(4);
    expect(Number.isNaN(percentile([], 0.5))).toBe(true);
  });

  it('builds the summary line by group', () => {
    const line = summaryString(
      [
        { id: 'A1', name: '', fps: 59.6 },
        { id: 'A2', name: '', error: 'boom' },
        { id: 'F1', name: '', fps: 10.2 },
        { id: 'K1', name: '', error: 'needs TV', skipped: true },
      ],
      ['vp960x540@2', ''],
    );
    expect(line).toBe('GT1 A60/- F10 Kx vp960x540@2');
  });

  it('reads versions from user agents', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 12; STI6110 Build/STT1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.7827.91 Mobile Safari/537.36 DanceDanceTV/0.4.0';
    expect(chromeVersion(ua)).toBe('149.0.7827.91');
    expect(tvAppVersion(ua)).toBe('0.4.0');
    expect(tvAppVersion('Mozilla/5.0 Chrome/120.0')).toBeNull();
  });

  it('shortens GPU names', () => {
    expect(shortGpu('ANGLE (ARM, Mali-G31, OpenGL ES 3.2)')).toBe('Mali-G31');
    expect(shortGpu('ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)')).toBe('Apple_M4_Pro');
    expect(shortGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)')).toBe('SwiftShader');
    expect(shortGpu('Mali-G52')).toBe('Mali-G52');
    expect(shortGpu('')).toBe('?');
  });

  it('writes a valid WAV header', () => {
    const w = makeWav(0.1, 8000);
    const v = new DataView(w.buffer);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(v.getUint32(24, true)).toBe(8000);
    expect(v.getUint32(40, true)).toBe(1600);
    expect(w.length).toBe(44 + 1600);
  });

  it('parses stored results defensively', () => {
    expect(parseStored(null)).toBeNull();
    expect(parseStored('{bad')).toBeNull();
    expect(parseStored('{"v":2}')).toBeNull();
    const r = parseStored(JSON.stringify({ v: 1, at: 5, complete: true, env: [['a', 'b']], rows: [{ id: 'A1', name: 'x', fps: 60 }], summary: 'GT1 A60' }));
    expect(r?.rows[0].fps).toBe(60);
    expect(r?.notes).toEqual([]);
  });
});
