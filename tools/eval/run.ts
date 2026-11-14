/// <reference types="node" />
/**
 * Song-style evaluation runner: real songs through the real pipeline.
 *
 *   npx tsx tools/eval/run.ts --stage find    --sample S --work W
 *   npx tsx tools/eval/run.ts --stage genres  --sample S --work W   (optional: src/genre lookup)
 *   npx tsx tools/eval/run.ts --stage analyse --sample S --work W
 *   npx tsx tools/eval/run.ts --stage score   --sample S --work W --out results.json
 *                             [--expect expectations.json] [--verdicts verdicts.json]
 *                             [--genres genres.json] [--verdicts-b verdicts-b.json]
 *   npx tsx tools/eval/report.ts results.json [--detail]  (markdown table + counts)
 * (`--stage eval` is the same as `score`.)
 *
 * Audio readings alone (tempo, beat grid, character traits) against researched
 * audio targets (common.ts AudioTarget, an `audio` field of expectations.json or
 * a separate audio-targets.json):
 *   npx tsx tools/eval/audio.ts --targets T.json --maps W/maps
 *   npx tsx tools/eval/stats.ts --audio <dir> --out W/stats.json   (record trait
 *     statistics while the audio is at hand; tools/eval/realmusic.test.ts re-maps
 *     them on every test run, so no audio is committed)
 * Sets with targets and recorded stats: data/run-20261113 (tuning),
 * data/heldout-20261114 (held out, seed 20261114, researched before analysis),
 * data/famous14 (the songs the traits were first calibrated on).
 *
 * Re-run the 2026-11-13 judgement offline (maps, video picks, lookups and
 * verdicts are saved; nothing is downloaded or looked up):
 *   D=tools/eval/data/run-20261113
 *   npx tsx tools/eval/run.ts --stage score --sample $D/sample.json --work $D --out /tmp/results.json \
 *     --expect $D/expectations.json --verdicts $D/verdicts.json --genres $D/genres.json --verdicts-b $D/verdicts-b.json
 * To compare another genre source, write its lists as {trackId: [names]} and
 * pass that file as --genres (pass B); verdicts must then be redone by a judge.
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
 *
 * Since run-20261115:
 *   --audio-dir DIR  where analyse downloads (default $TMPDIR/dancedance-eval-audio,
 *                    outside the repository); each song's audio is deleted after decoding.
 *   find             mirrors the cloud job exactly (degraded answers asked again, the
 *                    plain fallbackQuery search when the two searches rank nothing:
 *                    still a strict pick, marked fallbackSearch); --no-comments skips comments.
 *                    A hand-chosen video (VideoPick.manual) is judged apart.
 *   analyse          also records the trait statistics (stats.ts format) in W/stats.json.
 *   score            pass B is what the app passes (src/ui/coachStage.ts routineInfo):
 *                    the looked-up list with its levels and the artist's genres; per level
 *                    also the borrowed share, the tempo feel and the danced tempo.
 * Round two (seed 20261115, sample drawn with --exclude of both earlier samples) and
 * round one re-scored with the current code: data/run-20261115 (and its round1-rescore/).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ANALYZER_VERSION, analyzeFeatures, extractFeatures, toBeatMap, type BeatMap } from '../../src/core/analysis';
import { traitStats } from '../../src/core/analysis/traits';
import { generateRoutine, isHalfTime, styleGenres, tierBeats, type Intensity } from '../../src/core/choreo/generator';
import { genreOpenness } from '../../src/core/choreo/genres';
import { resolveSongStyle, styleLabel } from '../../src/core/choreo/songStyle';
import { traitsOf } from '../../src/core/choreo/songTraits';
import { degradedSearch, fallbackQuery, mergeSearches, parseSearch, rankCandidates, searchQueries, type SearchEntry } from '../beatmaps/pick';
import { decodeWithFfmpeg, downloadAudio, PCM_RATE, searchVideos } from '../beatmaps/youtube';
import { lookupGenres, type GenreLookup } from '../../src/genre';
import type { RecordedStats } from './stats';
import { genreHttp } from '../beatmaps/genreClient';
import { arg, sleep, type Expectation, type LevelSummary, type ResultsFile, type SampleFile, type SongResult, type StyleSummary, type Verdict, type VideoPick } from './common';

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
// Downloads go to a scratch directory outside the repository (--audio-dir), deleted per song.
const audioRoot = resolve(arg('audio-dir') ?? join(tmpdir(), 'dancedance-eval-audio'));
mkdirSync(mapsDir, { recursive: true });
const pause = () => sleep(3000 + Math.random() * 5000);

async function find() {
  const videos = readJson<Record<string, VideoPick>>(videosPath, {});
  for (const s of sample.songs) {
    if (videos[s.key]?.status === 'ok' || videos[s.key]?.status === 'not-found') continue;
    console.error(`find ${s.artist} - ${s.title}`);
    try {
      // As the cloud job does (tools/beatmaps/pipeline.ts searchAndRank): the two searches
      // (a degraded answer is asked once more), then the plain "Artist Title" search when
      // they rank nothing. A pick from these is strict; only after that are the view floors relaxed.
      const lists: SearchEntry[][] = [];
      const search = async (q: string) => {
        await pause();
        let list = parseSearch(await searchVideos(q, {}));
        if (degradedSearch(list)) {
          await pause();
          list = parseSearch(await searchVideos(q, {}));
        }
        lists.push(list);
      };
      for (const q of searchQueries(s)) await search(q);
      const req = { artist: s.artist, title: s.title, durationSec: s.durationSec };
      let entries = mergeSearches(lists);
      let ranked = rankCandidates(req, entries).ranked;
      let fallback = false;
      if (!ranked.length) {
        fallback = true;
        await search(fallbackQuery(req));
        entries = mergeSearches(lists);
        ranked = rankCandidates(req, entries).ranked;
      }
      let strict = true;
      if (!ranked.length) {
        // The cloud job would give up here; ignore only its view floors (marked strictPick: false).
        strict = false;
        ranked = rankCandidates(req, entries.map((e) => ({ ...e, views: Math.max(e.views ?? 0, 10_000_000) }))).ranked;
      }
      const r = ranked[0];
      if (!r) {
        videos[s.key] = { status: 'not-found', message: `${entries.length} search results (3 searches), none matches the song and its length` };
      } else {
        const e = entries.find((x) => x.id === r.entry.id)!;
        videos[s.key] = { status: 'ok', id: e.id, title: e.title, channel: e.channel, tier: `${strict ? '' : 'relaxed-'}${fallback ? 'plain-' : ''}${r.tier}`, seconds: e.duration, views: e.views, strictPick: strict, fallbackSearch: fallback };
        if (!process.argv.includes('--no-comments')) {
          await pause();
          videos[s.key].comments = topComments(e.id);
        }
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

/**
 * The multi-source genre lookup (src/genre) for every song, one at a time
 * (PoliteHttp paces per host and backs off). Full answers -> W/genre-lookups.json;
 * the combined lists -> W/genres.json (the --genres input of eval).
 */
async function genres() {
  const lookupsPath = join(work!, 'genre-lookups.json');
  const lookups = readJson<Record<string, GenreLookup>>(lookupsPath, {});
  const http = genreHttp((l) => console.error(`  http: ${l}`));
  for (const s of sample.songs) {
    const prev = lookups[s.key];
    if (prev?.complete) continue;
    console.error(`genres ${s.artist} - ${s.title}`);
    const l = await lookupGenres(
      { artist: s.artist, title: s.title, durationSec: s.durationSec, ...(s.genre ? { itunesGenre: s.genre } : {}) },
      { http, previous: prev ?? null, log: (x) => console.error(x) },
    );
    lookups[s.key] = l;
    console.error(`  => ${l.genres.join(', ') || '-'}${l.complete ? '' : ' [some sources failed]'}`);
    writeFileSync(lookupsPath, `${JSON.stringify(lookups, null, 2)}\n`);
    writeFileSync(join(work!, 'genres.json'), `${JSON.stringify(Object.fromEntries(Object.entries(lookups).map(([k, v]) => [k, v.genres])), null, 2)}\n`);
  }
  console.error(`requests sent: ${JSON.stringify(Object.fromEntries(http.sent))}`);
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
      // analyzeOffline (the cloud job's analyser, source 'cloud'), with the trait statistics
      // recorded from the same features (stats.ts format) while the audio is at hand.
      const features = extractFeatures(pcm, PCM_RATE);
      const result = analyzeFeatures(features, { duration: pcm.length / PCM_RATE });
      const map = toBeatMap(result, { videoId: v.id, duration: pcm.length / PCM_RATE, source: 'cloud', partial: false });
      writeFileSync(mapPath, `${JSON.stringify(map)}\n`);
      const statsPath = join(work!, 'stats.json');
      const stats = readJson<RecordedStats>(statsPath, { analyzerVersion: ANALYZER_VERSION, songs: {} });
      const r4 = (x: unknown): unknown => (typeof x === 'number' ? Math.round(x * 10000) / 10000 : x);
      stats.analyzerVersion = ANALYZER_VERSION;
      stats.songs[s.key] = {
        bpm: Math.round(result.bpm * 100) / 100,
        beats: result.beats.length,
        stats: JSON.parse(JSON.stringify(traitStats(features, { beats: result.beats, downbeats: result.downbeats, bpm: result.bpm }), (_, x) => r4(x))),
      };
      writeFileSync(statsPath, `${JSON.stringify(stats, null, 1)}\n`);
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
  const open = styleGenres(style);
  const danced = r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
  const borrowBeats: Record<string, number> = {};
  let genreAll = 0;
  for (const i of danced) {
    if (!i.move.genre) continue;
    genreAll += i.span;
    if (!open.has(i.move.genre)) borrowBeats[i.move.genre] = (borrowBeats[i.move.genre] ?? 0) + i.span;
  }
  const borrowed = Object.values(borrowBeats).reduce((a, b) => a + b, 0);
  const beats = danced.reduce((a, i) => a + i.span, 0) || 1;
  const sum = (f: (i: (typeof danced)[number]) => boolean) => danced.filter(f).reduce((a, i) => a + i.span, 0) / beats;
  const genreBeats: Record<string, number> = {};
  const byName = new Map<string, { tier: string; beats: number; id: string }>();
  for (const i of danced) {
    if (i.move.genre) genreBeats[i.move.genre] = (genreBeats[i.move.genre] ?? 0) + i.span;
    const name = i.move.name;
    const tier = i.sig ? `combo${i.move.genre ? `/${i.move.genre}` : ''}` : (i.move.genre ?? 'global');
    const e = byName.get(name) ?? { tier, beats: 0, id: i.move.id };
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
    borrowShare: r3(borrowed / Math.max(1, genreAll)),
    borrowBeats,
    ...(r.feel && r.feel !== 1 ? { feel: r.feel } : {}),
    ...(r.freeTime ? { freeTime: true } : {}),
    bpmDanced: Math.round((r.bpm ?? map.bpm) * 10) / 10,
    top: [...byName].sort((a, b) => b[1].beats - a[1].beats).slice(0, 10).map(([name, e]) => ({ name, id: e.id, tier: e.tier, beats: e.beats })),
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
  const lookups = readJson<Record<string, GenreLookup>>(join(work!, 'genre-lookups.json'), {});
  const verdictsB = readJson<Record<string, Verdict>>(arg('verdicts-b'), {});
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
    const secs = map.sections ?? [];
    const energy = secs.length ? secs.reduce((a, x) => a + x.energy, 0) / secs.length : undefined;
    // As the app passes them (src/ui/coachStage.ts routineInfo): the list with its levels
    // when they match it entry for entry, the artist's genres apart.
    const lk = lookups[s.key];
    const pass = (list?: string[]) => {
      const levels = list?.length && lk?.genreLevels?.length === list.length && lk.genres.join('|') === list.join('|') ? lk.genreLevels : undefined;
      const artistGenres = list && lk?.artistGenres?.length ? lk.artistGenres : undefined;
      const style = resolveSongStyle(
        {
          videoId: map.videoId, title: s.title, artist: s.artist, genre: s.genre,
          ...(list?.length ? { genres: list } : {}),
          ...(levels && levels.every((l) => l === 'song' || l === 'album') ? { genreLevels: levels } : {}),
          ...(artistGenres ? { artistGenres } : {}),
        },
        { bpm: map.bpm, energy, traits: traitsOf(map) },
      );
      const summary: StyleSummary = {
        label: styleLabel(style),
        source: style.source,
        ...(style.calm !== undefined ? { calm: style.calm } : {}),
        families: Object.fromEntries(Object.entries(style.families).map(([f, w]) => [f, r3(w ?? 0)])),
        ...(style.subs ? { subs: style.subs as Record<string, number> } : {}),
        themes: style.themes,
        ...(style.subName ? { subName: style.subName } : {}),
        open: [...styleGenres(style)],
        openness: Object.fromEntries([...genreOpenness(style)].map(([g, w]) => [g, r3(w)])),
      };
      return { style: summary, levels: LEVELS.map((l) => summarise(map, style, l)) };
    };
    const a = pass();
    const row: SongResult = { ...base, bpm: map.bpm, traits: (map.traits ?? {}) as Record<string, number>, ...a, halfCount: isHalfTime(map.bpm) };
    if (genresFile) {
      const list = genres[s.key] ?? [];
      const said = Object.fromEntries(
        Object.entries(lookups[s.key]?.sources ?? {}).map(([id, o]) => [id, o ? (o.status === 'found' ? `found: ${o.genres.join(', ')}${o.ref ? ` (${o.ref})` : ''}` : `${o.status}: ${o.reason}`) : '?']),
      );
      // Pass B is what the app dances: the list (with levels) and the artist's genres, whenever the lookup has either.
      const hasAny = list.length || lookups[s.key]?.artistGenres?.length;
      row.b = {
        genres: list,
        ...(lookups[s.key]?.genreLevels ? { genreLevels: lookups[s.key].genreLevels } : {}),
        ...(lookups[s.key]?.artistGenres?.length ? { artistGenres: lookups[s.key].artistGenres } : {}),
        said,
        ...(hasAny ? pass(list) : {}),
        ...(verdictsB[s.key] ? { verdict: verdictsB[s.key] } : {}),
      };
    }
    results.push(row);
  }
  const file: ResultsFile = { createdAt: new Date().toISOString(), analyzerVersion: ANALYZER_VERSION, sample: resolve(samplePath!), ...(genresFile ? { genresFile: resolve(genresFile) } : {}), results };
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  console.error(`${results.filter((r) => r.status === 'ok').length}/${results.length} songs evaluated -> ${out}`);
}

const stages: Record<string, () => unknown> = { find, genres, analyse, eval: evaluate, score: evaluate };
if (!stages[stage]) {
  console.error(`unknown stage ${stage}`);
  process.exit(1);
}
Promise.resolve(stages[stage]()).catch((e) => {
  console.error(e);
  process.exit(1);
});
