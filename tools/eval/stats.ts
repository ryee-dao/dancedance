/// <reference types="node" />
/**
 * Record what the analyser reads from real songs, without keeping the audio:
 * per song the tempo, the beat count and the raw trait statistics
 * (traits.ts TraitStats). tools/eval/realmusic.test.ts re-maps the recorded
 * statistics with traitsFromStats and checks them against the songs' audio
 * targets, so changes to the trait mapping are tested on real music.
 *
 *   npx tsx tools/eval/stats.ts --audio DIR --out stats.json [--codec 64]
 *
 * DIR holds <key>/<audio file> (as run.ts --stage analyse downloads them) or
 * <key>.<ext> files. --codec re-encodes to Opus at that bitrate first (what
 * the app downloads is ~64-70 kbps). Needs ffmpeg. Re-record whenever the
 * feature extraction, the tempo / beat stages or traitStats change (the
 * recorded file names the analyser version it came from).
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ANALYZER_VERSION, analyzeFeatures, extractFeatures } from '../../src/core/analysis';
import { traitStats, type TraitStats } from '../../src/core/analysis/traits';
import { arg } from './common';

export interface RecordedSong {
  bpm: number;
  beats: number;
  stats: TraitStats;
}

export interface RecordedStats {
  analyzerVersion: string;
  codec?: string;
  songs: Record<string, RecordedSong>;
}

const AUDIO = /\.(webm|m4a|opus|mp4|ogg|mp3|wav|flac)$/i;

function decode(path: string, codec?: string): Float32Array {
  let src = path;
  let tmp: string | undefined;
  if (codec) {
    tmp = mkdtempSync(join(tmpdir(), 'dd-stats-'));
    src = join(tmp, 'x.opus');
    const e = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', path, '-vn', '-c:a', 'libopus', '-b:a', `${codec}k`, src]);
    if (e.status !== 0) throw new Error(`ffmpeg could not re-encode ${path}`);
  }
  const r = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '22050', '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${path}`);
  const b = r.stdout as Buffer;
  const out = new Float32Array(Math.floor(b.byteLength / 4));
  new Uint8Array(out.buffer).set(b.subarray(0, out.length * 4));
  return out;
}

const r4 = (x: unknown): unknown => (typeof x === 'number' ? Math.round(x * 10000) / 10000 : x);

function main() {
  const dir = arg('audio');
  const out = arg('out');
  const codec = arg('codec');
  if (!dir || !out) {
    console.error('usage: tools/eval/stats.ts --audio DIR --out stats.json [--codec 64]');
    process.exit(1);
  }
  const songs: Record<string, RecordedSong> = {};
  for (const d of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = d.isDirectory() ? readdirSync(join(dir, d.name)).find((f) => AUDIO.test(f)) : AUDIO.test(d.name) ? d.name : undefined;
    if (!file) continue;
    const key = d.isDirectory() ? d.name : d.name.replace(AUDIO, '');
    const f = extractFeatures(decode(d.isDirectory() ? join(dir, d.name, file) : join(dir, file), codec), 22050);
    const a = analyzeFeatures(f);
    const stats = JSON.parse(JSON.stringify(traitStats(f, { beats: a.beats, downbeats: a.downbeats, bpm: a.bpm }), (_, v) => r4(v))) as TraitStats;
    songs[key] = { bpm: Math.round(a.bpm * 100) / 100, beats: a.beats.length, stats };
    console.error(`${key} ${songs[key].bpm} BPM, ${songs[key].beats} beats`);
  }
  const file: RecordedStats = { analyzerVersion: ANALYZER_VERSION, ...(codec ? { codec: `opus ${codec} kbps` } : {}), songs };
  writeFileSync(out, `${JSON.stringify(file, null, 1)}\n`);
}

if (process.argv[1]?.endsWith('stats.ts')) main();
