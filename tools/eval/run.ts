/// <reference types="node" />
/**
 * Song-style evaluation runner: real songs through the real pipeline.
 *
 *   npx tsx tools/eval/run.ts --stage find    --sample S --work W
 *   npx tsx tools/eval/run.ts --stage analyse --sample S --work W
 *   npx tsx tools/eval/run.ts --stage eval    --sample S --work W --out results.json
 *                             [--expect expectations.json] [--verdicts verdicts.json] [--genres genres.json]
 *   npx tsx tools/eval/report.ts results.json            (markdown table + counts)
 *
 * Stages (each resumable; finished songs are skipped):
 *   find     the YouTube video for each song, chosen as the cloud job does
 *            (tools/beatmaps/pick.ts: two yt-dlp searches, rankCandidates on
 *            the iTunes length). When the job's ranking finds nothing (obscure
 *            art tracks under its view floors) a relaxed pick ignores the view
 *            floors and is marked strictPick: false. Also a few top listener
 *            comments of that video (yt-dlp, anonymous). -> W/videos.json
 *   (judge)  research each song and write expectations.json BEFORE analysing.
 *   analyse  download (yt-dlp, anonymous, default client) into
 *            W/../eval-audio/<key>/, decode with ffmpeg, analyzeOffline (the
 *            cloud job's analyser, source 'cloud'), keep only the beat map
 *            (W/maps/<key>.json); the audio is deleted right away.
 *   eval     pure: resolveSongStyle from the iTunes genre (+ the genres.json
 *            list, if given), the map's bpm and traits; generateRoutine at
 *            chill / cardio / sweaty; summaries -> results.json, merged with
 *            expectations and verdicts. Re-run it with --genres to compare a
 *            second genre source: nothing is downloaded again.
 * Requests are paced (3-8 s between yt-dlp calls); a blocked / failed song is
 * recorded and skipped, never retried in a loop.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ANALYZER_VERSION, analyzeOffline, type BeatMap } from '../../src/core/analysis';
import { generateRoutine, isHalfTime, styleGenres, tierBeats, type Intensity } from '../../src/core/choreo/generator';
import { genreOpenness } from '../../src/core/choreo/genres';
import { resolveSongStyle, styleLabel } from '../../src/core/choreo/songStyle';
import { traitsOf } from '../../src/core/choreo/songTraits';
import { parseSearch, rankCandidates, searchQueries, type SearchEntry } from '../beatmaps/pick';
import { decodeWithFfmpeg, downloadAudio, PCM_RATE, searchVideos } from '../beatmaps/youtube';
import { arg, sleep, type Expectation, type LevelSummary, type ResultsFile, type SampleFile, type SongResult, type Verdict, type VideoPick } from './common';

const stage = arg('stage', 'eval')!;
const samplePath = arg('sample');
const work = arg('work');
if (!samplePath || !work) {
  console.error('usage: tools/eval/run.ts --stage find|analyse|eval --sample sample.json --work <dir> [--out results.json] [--expect e.json] [--verdicts v.json] [--genres g.json]');
  process.exit(1);
}
const sample = JSON.parse(readFileSync(samplePath, 'utf8')) as SampleFile;
const readJson = <T>(p: string | undefined, dflt: T): T => (p && existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : dflt);
const videosPath = join(work, 'videos.json');
const mapsDir = join(work, 'maps');
const audioRoot = resolve(work, '..', 'eval-audio');
mkdirSync(mapsDir, { recursive: true });
const pause = () => sleep(3000 + Math.random() * 5000);

async function find() {
  const videos = readJson<Record<string, VideoPick>>(videosPath, {});
  for (const s of sample.songs) {
    if (videos[s.key]?.status === 'ok' || videos[s.key]?.status === 'not-found') continue;
    console.error(`find ${s.artist} - ${s.title}`);
    try {
      const lists: SearchEntry[][] = [];
      for (const q of searchQueries(s)) {
        await pause();
        lists.push(parseSearch(await searchVideos(q, {})));
      }
      const seen = new Set<string>();
      const entries = lists.flat().filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
      const req = { artist: s.artist, title: s.title, durationSec: s.durationSec };
      let strict = true;
      let ranked = rankCandidates(req, entries).ranked;
      const relax = (es: SearchEntry[]) => rankCandidates(req, es.map((e) => ({ ...e, views: Math.max(e.views ?? 0, 10_000_000) }))).ranked;
      if (!ranked.length) {
        // The cloud job would give up here; ignore only its view floors.
        strict = false;
        ranked = relax(entries);
      }
      if (!ranked.length) {
        // Obscure songs: the job's "... lyrics" / "... official audio" searches can come back
        // empty while the plain "artist title" search finds the art track.
        await pause();
        const plain = parseSearch(await searchVideos(`${s.artist} ${s.title}`.replace(/\s+/g, ' ').trim(), {})).filter((e) => !seen.has(e.id));
        entries.push(...plain);
        ranked = relax(entries);
        if (ranked.length) ranked = ranked.map((r) => ({ ...r, tier: `plain-${r.tier}` as typeof r.tier }));
      }
      const r = ranked[0];
      if (!r) {
        videos[s.key] = { status: 'not-found', message: `${entries.length} search results, none matches the song and its length` };
      } else {
        const e = entries.find((x) => x.id === r.entry.id)!;
        videos[s.key] = { status: 'ok', id: e.id, title: e.title, channel: e.channel, tier: strict ? r.tier : `relaxed-${r.tier}`, seconds: e.duration, views: e.views, strictPick: strict };
        await pause();
        videos[s.key].comments = topComments(e.id);
      }
    } catch (err) {
      videos[s.key] = { status: 'error', message: String((err as Error).message ?? err).slice(0, 300) };
    }
    console.error(`  ${videos[s.key].status} ${videos[s.key].tier ?? ''} ${videos[s.key].id ?? videos[s.key].message ?? ''} (${videos[s.key].comments?.length ?? 0} comments)`);
    writeFileSync(videosPath, `${JSON.stringify(videos, null, 2)}\n`);
  }
}

/** Up to 12 top comments (text only), anonymously; [] on any failure. */
function topComments(id: string): string[] {
  const r = spawnSync(
    'yt-dlp',
    ['--ignore-config', '--skip-download', '--write-comments', '--extractor-args', 'youtube:max_comments=12,12,0,0;comment_sort=top', '-J', '--', `https://www.youtube.com/watch?v=${id}`],
    { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 180_000 },
  );
  if (r.status !== 0) return [];
  try {
    const info = JSON.parse(r.stdout) as { comments?: { text?: string; parent?: string }[] };
    return (info.comments ?? []).filter((c) => !c.parent || c.parent === 'root').map((c) => (c.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 280)).filter(Boolean).slice(0, 12);
  } catch {
    return [];
  }
}

async function analyse() {
  const videos = readJson<Record<string, VideoPick>>(videosPath, {});
  for (const s of sample.songs) {
    const v = videos[s.key];
    const mapPath = join(mapsDir, `${s.key}.json`);
    const errPath = join(mapsDir, `${s.key}.error.txt`);
    if (!v?.id || existsSync(mapPath) || existsSync(errPath)) continue;
    console.error(`analyse ${s.artist} - ${s.title} (${v.id})`);
    const dir = join(audioRoot, s.key);
    mkdirSync(dir, { recursive: true });
    try {
      await pause();
      const dl = await downloadAudio(v.id, dir, {});
      if (dl.kind !== 'file') throw new Error(dl.message);
      const pcm = await decodeWithFfmpeg(dl.path);
      rmSync(dir, { recursive: true, force: true });
      const t0 = Date.now();
      const map = analyzeOffline(pcm, PCM_RATE, { videoId: v.id, source: 'cloud' });
      writeFileSync(mapPath, `${JSON.stringify(map)}\n`);
      console.error(`  ${map.bpm} BPM, ${map.beats.length} beats, analysed in ${((Date.now() - t0) / 1000).toFixed(1)} s, traits ${JSON.stringify(map.traits)}`);
    } catch (err) {
      writeFileSync(errPath, String((err as Error).message ?? err).slice(0, 500));
      console.error(`  failed: ${(err as Error).message}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function summarise(map: BeatMap, style: ReturnType<typeof resolveSongStyle>, level: Intensity): LevelSummary {
  const r = generateRoutine(map, level, { style });
  const t = tierBeats(r, style);
  const danced = r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
  const beats = danced.reduce((a, i) => a + i.span, 0) || 1;
  const sum = (f: (i: (typeof danced)[number]) => boolean) => danced.filter(f).reduce((a, i) => a + i.span, 0) / beats;
  const genreBeats: Record<string, number> = {};
  const byName = new Map<string, { tier: string; beats: number }>();
  for (const i of danced) {
    if (i.move.genre) genreBeats[i.move.genre] = (genreBeats[i.move.genre] ?? 0) + i.span;
    const name = i.move.name;
    const tier = i.sig ? `combo${i.move.genre ? `/${i.move.genre}` : ''}` : (i.move.genre ?? 'global');
    const e = byName.get(name) ?? { tier, beats: 0 };
    e.beats += i.span;
    byName.set(name, e);
  }
  return {
    level,
    genreShare: r3(t.genre / Math.max(1, t.genre + t.global)),
    genreBeats,
    halfInstances: r3(danced.filter((i) => i.half).length / Math.max(1, danced.length)),
    halfBeats: r3(sum((i) => i.half)),
    jumpShare: r3(sum((i) => i.move.jump)),
    highShare: r3(sum((i) => i.move.level === 'high')),
    distinctMoves: new Set(danced.map((i) => i.move.base)).size,
    top: [...byName].sort((a, b) => b[1].beats - a[1].beats).slice(0, 10).map(([name, e]) => ({ name, tier: e.tier, beats: e.beats })),
  };
}

function evaluate() {
  const out = arg('out');
  if (!out) throw new Error('--out results.json is required for --stage eval');
  const videos = readJson<Record<string, VideoPick>>(videosPath, {});
  const expect = readJson<Record<string, Expectation>>(arg('expect'), {});
  const verdicts = readJson<Record<string, Verdict>>(arg('verdicts'), {});
  const genresFile = arg('genres');
  const genres = readJson<Record<string, string[]>>(genresFile, {});
  const results: SongResult[] = [];
  for (const s of sample.songs) {
    const v = videos[s.key];
    const base: SongResult = { song: s, status: 'ok', ...(v ? { video: v } : {}), ...(expect[s.key] ? { expectation: expect[s.key] } : {}), ...(verdicts[s.key] ? { verdict: verdicts[s.key] } : {}) };
    const mapPath = join(mapsDir, `${s.key}.json`);
    const errPath = join(mapsDir, `${s.key}.error.txt`);
    if (!v || v.status !== 'ok') {
      results.push({ ...base, status: 'not-found', message: v?.message ?? 'no video search yet' });
      continue;
    }
    if (!existsSync(mapPath)) {
      results.push({ ...base, status: 'fetch-failed', message: existsSync(errPath) ? readFileSync(errPath, 'utf8') : 'not analysed yet' });
      continue;
    }
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as BeatMap;
    const list = genres[s.key];
    const secs = map.sections ?? [];
    const energy = secs.length ? secs.reduce((a, x) => a + x.energy, 0) / secs.length : undefined;
    const style = resolveSongStyle(
      { videoId: map.videoId, title: s.title, artist: s.artist, genre: s.genre, ...(list?.length ? { genres: list } : {}) },
      { bpm: map.bpm, energy, traits: traitsOf(map) },
    );
    const openness = Object.fromEntries([...genreOpenness(style)].map(([g, w]) => [g, r3(w)]));
    results.push({
      ...base,
      bpm: map.bpm,
      traits: (map.traits ?? {}) as Record<string, number>,
      ...(list?.length ? { genres: list } : {}),
      style: {
        label: styleLabel(style),
        source: style.source,
        ...(style.calm !== undefined ? { calm: style.calm } : {}),
        families: Object.fromEntries(Object.entries(style.families).map(([f, w]) => [f, r3(w ?? 0)])),
        ...(style.subs ? { subs: style.subs as Record<string, number> } : {}),
        themes: style.themes,
        ...(style.subName ? { subName: style.subName } : {}),
        open: [...styleGenres(style)],
        openness,
      },
      halfCount: isHalfTime(map.bpm),
      levels: LEVELS.map((l) => summarise(map, style, l)),
    });
  }
  const file: ResultsFile = { createdAt: new Date().toISOString(), analyzerVersion: ANALYZER_VERSION, sample: resolve(samplePath!), ...(genresFile ? { genresFile: resolve(genresFile) } : {}), results };
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  console.error(`${results.filter((r) => r.status === 'ok').length}/${results.length} songs evaluated -> ${out}`);
}

const stages: Record<string, () => unknown> = { find, analyse, eval: evaluate };
if (!stages[stage]) {
  console.error(`unknown stage ${stage}`);
  process.exit(1);
}
Promise.resolve(stages[stage]()).catch((e) => {
  console.error(e);
  process.exit(1);
});
