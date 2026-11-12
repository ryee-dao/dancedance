/**
 * Pure helpers for the graphics test (graphicsTest.ts): frame statistics,
 * the compact summary string, the stored-results format and a tiny WAV
 * generator. No DOM.
 */

export interface FrameSummary {
  /** Animation frames per second. */
  fps: number;
  /** Median and 95th-percentile interval between frames, ms. */
  med: number;
  p95: number;
  /** Mean time spent inside the frame callback, ms. */
  js: number;
  frames: number;
}

/** `q` in 0..1 of an ascending array (nearest rank). */
export function percentile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i];
}

/** Stats from frame intervals (ms) and the per-frame JS times (ms). Null if fewer than 2 intervals. */
export function summarize(intervals: readonly number[], jsTimes: readonly number[]): FrameSummary | null {
  const iv = intervals.filter((d) => Number.isFinite(d) && d > 0);
  if (iv.length < 2) return null;
  const sorted = [...iv].sort((a, b) => a - b);
  const total = iv.reduce((a, b) => a + b, 0);
  const js = jsTimes.length ? jsTimes.reduce((a, b) => a + b, 0) / jsTimes.length : 0;
  return {
    fps: round((iv.length * 1000) / total, 1),
    med: round(percentile(sorted, 0.5), 1),
    p95: round(percentile(sorted, 0.95), 1),
    js: round(js, 2),
    frames: iv.length,
  };
}

export function round(v: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}

export interface GfxRow {
  id: string;
  name: string;
  fps?: number;
  med?: number;
  p95?: number;
  js?: number;
  /** % of the measured time the main thread spent in long animation frames (> 50 ms); undefined = API missing. */
  busy?: number;
  /** Mean style + layout + paint ms inside those long frames. */
  paint?: number;
  note?: string;
  /** Failed or skipped: why (shown instead of the numbers). */
  error?: string;
  skipped?: boolean;
}

export interface StoredResults {
  v: 1;
  at: number;
  complete: boolean;
  env: [string, string][];
  rows: GfxRow[];
  notes: string[];
  summary: string;
}

/**
 * The compact line read out from the TV: rows grouped by letter, fps per
 * row joined by '/', '-' for a failure, 'x' for a skip; then short extras.
 *   "GT1 A60/60/59 B60 C60/60/60/58 D[...]... vp960x540@2 gl:Mali-G52"
 */
export function summaryString(rows: readonly GfxRow[], extras: readonly string[] = []): string {
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const g = r.id.replace(/\d+$/, '');
    const v = r.skipped ? 'x' : r.error || r.fps === undefined ? '-' : String(Math.round(r.fps));
    const list = groups.get(g) ?? [];
    list.push(v);
    groups.set(g, list);
  }
  const parts = ['GT1', ...[...groups].map(([g, vs]) => g + vs.join('/')), ...extras.filter(Boolean)];
  return parts.join(' ');
}

/** "Chrome 149.0.7827.91" style version from a user agent, or null. */
export function chromeVersion(ua: string): string | null {
  const m = /(?:Chrome|Chromium)\/([\d.]+)/.exec(ua);
  return m ? m[1] : null;
}

/** "0.4.0" from the TV shell's user-agent suffix ("DanceDanceTV/0.4.0"), or null. */
export function tvAppVersion(ua: string): string | null {
  const m = /DanceDanceTV\/(\S+)/.exec(ua);
  return m ? m[1] : null;
}

/** A short GPU name for the summary line: vendor noise dropped, at most 28 characters, no spaces. */
export function shortGpu(renderer: string): string {
  if (/swiftshader/i.test(renderer)) return 'SwiftShader';
  let s = renderer.trim();
  // "ANGLE (vendor, renderer, api)": keep the renderer part.
  const angle = /^ANGLE \((.*)\)$/.exec(s);
  if (angle) {
    const parts = angle[1].split(', ');
    s = parts[1] ?? parts[0];
  }
  s = s
    .replace(/ANGLE|Metal Renderer:|OpenGL ES( [\d.]+)?|OpenGL( [\d.]+)?|Direct3D11|vs_\S+|ps_\S+|Unspecified Version/g, '')
    .replace(/[(),]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
  return s.slice(0, 28) || '?';
}

/** A mono 16-bit PCM WAV: a quiet tone (inaudible at normal volume) so the media pipeline really runs. */
export function makeWav(seconds: number, rate = 22050, hz = 440, amplitude = 0.0015): Uint8Array {
  const n = Math.max(1, Math.round(seconds * rate));
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * amplitude * 32767), true);
  }
  return new Uint8Array(buf);
}

export function parseStored(text: string | null): StoredResults | null {
  if (!text) return null;
  try {
    const s = JSON.parse(text) as Partial<StoredResults>;
    if (s.v !== 1 || !Array.isArray(s.rows) || !Array.isArray(s.env) || typeof s.summary !== 'string') return null;
    return { v: 1, at: Number(s.at) || 0, complete: !!s.complete, env: s.env, rows: s.rows, notes: Array.isArray(s.notes) ? s.notes : [], summary: s.summary };
  } catch {
    return null;
  }
}
