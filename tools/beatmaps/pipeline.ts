/// <reference types="node" />
/**
 * The beat-map job: plan -> (download -> decode -> analyse -> write) per song
 * -> index.json / status.json / playlist.json.
 *
 * Every side effect that touches YouTube, ffmpeg, the clock or randomness is
 * injected through `Deps`, so tests can run the whole pipeline with stubs.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ANALYZER_VERSION, analyzeOffline, parse, serialize, type BeatMap } from '../../src/core/analysis';
import type { Classification } from './classify';
import { classifyYtDlpError } from './classify';
import { parseFlatPlaylist, parseStatus, renderIndex, renderPlaylist, renderStatus, type MapInfo, type PlaylistInfo } from './output';
import type { OfficialSong } from './itunes';
import { mergeSearches, parseSearch, rankCandidates, searchQueries, type SearchEntry } from './pick';
import { planWork, preflightSkip, unionCandidates, type Candidate, type StatusReason, type VideoStatus, type WorkItem, type WorkReason } from './select';
import { parseSongsList, parseSongsStatus, planAdds, renderSongs, renderSongsStatus, songKey, type AddedSong, type AddRequest, type SongRequestStatus } from './songs';
import type { AddResult, Fatal, ResultKind, RunReport, SongResult } from './summary';
import { PCM_RATE, ToolFailure, type DownloadResult, type EmbedCheck } from './youtube';

export interface Paths {
  /** public/beatmaps */
  beatmapsDir: string;
  /** public/playlist.json */
  playlistFile: string;
  /** src/data/starter.json */
  starterFile: string;
  /** public/songs.json (songs added by search). Without it, add requests are ignored. */
  songsFile?: string;
  /** public/songs-status.json (add requests that failed). */
  songsStatusFile?: string;
}

export interface Deps {
  fetchPlaylist(url: string): Promise<unknown>;
  downloadAudio(videoId: string, dir: string): Promise<DownloadResult>;
  /** Decode to mono PCM at PCM_RATE (22050 Hz). */
  decode(path: string): Promise<Float32Array>;
  makeTempDir(): Promise<string>;
  removeDir(dir: string): Promise<void>;
  sleep(ms: number): Promise<void>;
  random(): number;
  now(): Date;
  /** Monotonic seconds, for timings. */
  clock(): number;
  log(line: string): void;
  analyze?(pcm: Float32Array, videoId: string): BeatMap;
  /** yt-dlp flat search JSON for a query (add mode). */
  searchVideos?(query: string): Promise<unknown>;
  /** oEmbed check (add mode). */
  checkEmbed?(videoId: string): Promise<EmbedCheck>;
  /** Official length from iTunes, for requests without one. */
  lookupOfficial?(req: { artist: string; title: string }): Promise<OfficialSong | null>;
}

export interface RunOptions {
  playlistUrl?: string;
  only?: string;
  limit: number;
  force: boolean;
  dryRun: boolean;
  usedCookies: boolean;
  /** Consecutive blocked/outdated failures that stop the run (default 3). */
  stopAfter?: number;
  /** Random pause between downloads, seconds [min, max] (default [3, 8]). */
  pause?: [number, number];
  /**
   * Songs to add by search. When any are given, this run only handles add
   * requests (and songs.json entries still lacking a map); the playlist and
   * the starter pack wait for the next regular run.
   */
  adds?: AddRequest[];
}

export interface RunOutcome {
  exitCode: number;
  report: RunReport;
  /** Files written (paths), empty when nothing changed. */
  written: string[];
}

const RESERVED = new Set(['index.json', 'status.json']);
const MIN_AUDIO_S = 5;

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** Write only when the content differs; returns whether it wrote. */
export async function writeIfChanged(path: string, text: string): Promise<boolean> {
  if ((await readText(path)) === text) return false;
  await writeFile(path, text, 'utf8');
  return true;
}

/** videoId -> version, BPM and duration for every valid `<id>.json` map in the directory. */
export async function scanMaps(dir: string, log?: (s: string) => void): Promise<Map<string, MapInfo>> {
  const out = new Map<string, MapInfo>();
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of names.sort()) {
    if (!name.endsWith('.json') || RESERVED.has(name)) continue;
    const id = name.slice(0, -5);
    try {
      const map = parse((await readText(join(dir, name))) ?? '');
      if (map.videoId !== id) throw new Error(`videoId ${map.videoId} does not match the file name`);
      out.set(id, { analyzerVersion: map.analyzerVersion, bpm: map.bpm, duration: map.duration });
    } catch (e) {
      log?.(`warning: ignoring ${name}: ${(e as Error).message}`);
    }
  }
  return out;
}

export function readStarter(text: string | undefined): Candidate[] {
  if (!text) return [];
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .filter((x): x is { videoId: string; title?: unknown; artist?: unknown } => !!x && typeof x.videoId === 'string')
    .map((x) => ({
      videoId: x.videoId,
      ...(typeof x.title === 'string' ? { title: x.title } : {}),
      ...(typeof x.artist === 'string' ? { artist: x.artist } : {}),
      origin: 'starter' as const,
    }));
}

/** Strip temp paths and home directories from messages that end up in the public status.json. */
export function sanitizeMessage(msg: string, tempDir?: string): string {
  let m = msg;
  if (tempDir) m = m.split(tempDir).join('<tmp>');
  m = m.replace(/\/(?:Users|home)\/[^/\s]+/g, '~').replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, '~');
  return m.length > 300 ? `${m.slice(0, 299)}…` : m;
}

function toStatus(kind: ResultKind, reason: StatusReason | undefined, message: string | undefined, prev: VideoStatus | undefined, now: string): VideoStatus {
  const attempts = (prev?.attempts ?? 0) + 1;
  if (kind === 'ok') return { state: 'ok', attempts, lastTried: now };
  return {
    state: kind === 'blocked' ? 'blocked' : 'error',
    reason: reason ?? (kind === 'skipped' ? 'filtered' : (kind as StatusReason)),
    ...(message ? { message } : {}),
    attempts,
    lastTried: now,
  };
}

function classify(e: unknown): Classification {
  if (e instanceof ToolFailure) return e.classification;
  return { kind: 'error', summary: 'Analysis failed', detail: (e as Error)?.message ?? String(e) };
}

function describe(c: Candidate): string {
  return c.title ? `${c.videoId} (${c.artist ? `${c.artist} - ` : ''}${c.title})` : c.videoId;
}

/** At most this many candidates are checked / analysed per add request. */
const ADD_MAX_EMBED_CHECKS = 8;
const ADD_MAX_ANALYSES = 3;

export async function runBeatmaps(paths: Paths, opts: RunOptions, deps: Deps): Promise<RunOutcome> {
  const stopAfter = opts.stopAfter ?? 3;
  const [pauseMin, pauseMax] = opts.pause ?? [3, 8];
  const analyze = deps.analyze ?? ((pcm: Float32Array, videoId: string) => analyzeOffline(pcm, PCM_RATE, { videoId, source: 'cloud' }));
  const written: string[] = [];
  const nowIso = () => deps.now().toISOString();

  const existing = await scanMaps(paths.beatmapsDir, deps.log);
  const statusPath = join(paths.beatmapsDir, 'status.json');
  const indexPath = join(paths.beatmapsDir, 'index.json');
  const prevStatusText = await readText(statusPath);
  const status = parseStatus(prevStatusText);
  const starter = readStarter(await readText(paths.starterFile));

  // --- Songs added by search -----------------------------------------------
  const prevSongsText = paths.songsFile ? await readText(paths.songsFile) : undefined;
  const prevSongsStatusText = paths.songsStatusFile ? await readText(paths.songsStatusFile) : undefined;
  const songs: AddedSong[] = prevSongsText ? parseSongsList(prevSongsText) : [];
  const songsStatus: Record<string, SongRequestStatus> = prevSongsStatusText ? parseSongsStatus(prevSongsStatusText) : {};
  const addMode = (opts.adds?.length ?? 0) > 0;
  const addPlan = paths.songsFile ? planAdds(opts.adds ?? [], songs, songsStatus, deps.now()) : { todo: [], skipped: [] };
  const addResults: AddResult[] = [];
  for (const sk of addPlan.skipped) {
    deps.log(`add ${sk.req.artist} - ${sk.req.title}: ${sk.why}`);
    const kind = sk.why === 'already added' ? 'already' : 'skipped';
    const song = songs.find((x) => songKey(x.artist, x.title) === sk.key);
    addResults.push({ artist: sk.req.artist, title: sk.req.title, kind, ...(song ? { videoId: song.videoId } : {}), message: sk.why });
  }
  if (addPlan.todo.length && (!deps.searchVideos || !deps.checkEmbed)) throw new Error('add requests need searchVideos and checkEmbed');

  // --- Playlist -----------------------------------------------------------
  let playlist: PlaylistInfo | undefined;
  let playlistError: Classification | undefined;
  const fetchList = !!opts.playlistUrl && !opts.only && !addMode;
  if (fetchList) {
    try {
      playlist = parseFlatPlaylist(await deps.fetchPlaylist(opts.playlistUrl!));
      deps.log(`playlist ${playlist.playlistId}: ${playlist.videos.length} videos`);
    } catch (e) {
      playlistError = e instanceof ToolFailure ? e.classification : classifyYtDlpError(String((e as Error)?.message ?? e));
      deps.log(`playlist: ${playlistError.summary} (${playlistError.detail})`);
    }
  }

  // --- Plan ---------------------------------------------------------------
  const addedCandidates: Candidate[] = songs.map((x) => ({ videoId: x.videoId, title: x.title, artist: x.artist, origin: 'added' }));
  let candidates = addMode ? addedCandidates : unionCandidates(playlist?.candidates ?? [], starter, addedCandidates);
  if (opts.only) {
    const found = unionCandidates(candidates, starter, addedCandidates).find((c) => c.videoId === opts.only);
    candidates = [found ?? { videoId: opts.only, origin: 'manual' }];
  }
  const plan = planWork({
    candidates,
    existing: new Map([...existing].map(([id, m]) => [id, m.analyzerVersion])),
    status,
    analyzerVersion: ANALYZER_VERSION,
    now: deps.now(),
    limit: opts.limit,
    force: opts.force,
  });
  deps.log(
    `${candidates.length} candidate(s): ${plan.todo.length} to process, ${plan.done} up to date, ${plan.waiting} waiting to retry, ${plan.deferred} left for later runs` +
      (addPlan.todo.length ? `; ${addPlan.todo.length} song(s) to add by search` : ''),
  );

  const results: SongResult[] = [];
  let fatal: Fatal = null;
  let stoppedEarly: RunReport['stoppedEarly'];

  let requests = 0;
  const pause = async () => {
    if (requests > 0) await deps.sleep(Math.round((pauseMin + deps.random() * (pauseMax - pauseMin)) * 1000));
    requests++;
  };

  /** Search YouTube for a request and rank the results. */
  const searchAndRank = async (req: { artist: string; title: string; durationSec: number }) => {
    const lists: SearchEntry[][] = [];
    for (const q of searchQueries(req)) {
      await pause();
      lists.push(parseSearch(await deps.searchVideos!(q)));
    }
    const entries = mergeSearches(lists);
    const ranked = rankCandidates(req, entries);
    deps.log(`  ${entries.length} search result(s), ${ranked.ranked.length} usable`);
    for (const r of ranked.ranked.slice(0, 5)) {
      deps.log(`    ${r.tier.padEnd(11)} ${r.entry.id} ${r.entry.duration} s ${r.entry.views ?? '?'} views "${r.entry.title}" (${r.entry.channel})`);
    }
    return ranked;
  };

  /** Which official length / names to use for a request (iTunes when missing). */
  const resolveRequest = async (req: AddRequest) => {
    if (req.durationSec !== undefined) return { artist: req.artist, title: req.title, durationSec: req.durationSec };
    const off = deps.lookupOfficial ? await deps.lookupOfficial(req) : null;
    if (off) deps.log(`  iTunes: ${off.artist} - ${off.title}, ${off.durationSec} s`);
    return off;
  };

  if (opts.dryRun) {
    for (const item of addPlan.todo) {
      const base = { artist: item.req.artist, title: item.req.title };
      deps.log(`would add [${item.why}] ${base.artist} - ${base.title}`);
      try {
        const req = await resolveRequest(item.req);
        if (!req) {
          addResults.push({ ...base, kind: 'not-found', message: "couldn't find the song's official length on iTunes" });
          continue;
        }
        const { ranked } = await searchAndRank(req);
        let pick: (typeof ranked)[number] | undefined;
        for (const r of ranked.slice(0, ADD_MAX_EMBED_CHECKS)) {
          const embed = await deps.checkEmbed!(r.entry.id);
          if (embed === 'disabled' || embed === 'gone') {
            deps.log(`    ${r.entry.id}: embedding ${embed}, next`);
            continue;
          }
          pick = r;
          break;
        }
        addResults.push(
          pick
            ? { ...base, kind: 'planned', videoId: pick.entry.id, tier: pick.tier, videoTitle: pick.entry.title, channel: pick.entry.channel, videoSeconds: pick.entry.duration ?? undefined, officialSeconds: req.durationSec, message: 'dry run: not downloaded' }
            : { ...base, kind: 'not-found', officialSeconds: req.durationSec, message: 'no suitable embeddable video' },
        );
      } catch (e) {
        const cl = classify(e);
        addResults.push({ ...base, kind: cl.kind === 'blocked' ? 'blocked' : 'error', message: cl.summary });
      }
    }
    for (const item of plan.todo) {
      deps.log(`would process [${item.why}] ${describe(item.candidate)}`);
      const pre = preflightSkip(item.candidate);
      results.push({
        videoId: item.candidate.videoId,
        title: item.candidate.title,
        artist: item.candidate.artist,
        why: item.why,
        kind: pre ? 'skipped' : 'ok',
        message: pre ? pre.message : 'dry run: not downloaded',
      });
    }
  } else {
    const downloads = plan.todo.filter((w) => !preflightSkip(w.candidate)).length + addPlan.todo.length;
    const needed = Math.max(1, Math.min(stopAfter, downloads + (playlistError ? 1 : 0)));
    let successes = 0;
    let runKind = null as ResultKind | null;
    let runLen = 0;
    const note = (kind: ResultKind) => {
      if (kind === 'ok') successes++;
      if (kind === runKind) runLen++;
      else {
        runKind = kind;
        runLen = 1;
      }
    };
    const mustStop = () => (runKind === 'blocked' || runKind === 'outdated') && runLen >= needed;
    if (playlistError?.kind === 'blocked' || playlistError?.kind === 'outdated') note(playlistError.kind);

    /**
     * Download, decode, analyse and write one video's beat map, and record it
     * in status.json and the results table. `recordFailure: false` (add-mode
     * candidates): a failure is only logged, since the next candidate is tried
     * and songs-status.json reports the request.
     */
    const processVideo = async (c: Candidate, why: WorkReason, prefix: string, recordFailure = true): Promise<SongResult> => {
      await pause();
      const t0 = deps.clock();
      const dir = await deps.makeTempDir();
      const base = { videoId: c.videoId, title: c.title, artist: c.artist, why };
      let result: SongResult;
      try {
        const dl = await deps.downloadAudio(c.videoId, dir);
        if (dl.kind === 'filtered') {
          result = { ...base, kind: 'skipped', reason: 'filtered', message: dl.message };
        } else {
          const tDl = deps.clock();
          const pcm = await deps.decode(dl.path);
          if (pcm.length < MIN_AUDIO_S * PCM_RATE) throw new Error(`decoded audio is only ${(pcm.length / PCM_RATE).toFixed(1)} s long`);
          const tDec = deps.clock();
          const map = analyze(pcm, c.videoId);
          const text = `${serialize(map)}\n`;
          const out = join(paths.beatmapsDir, `${c.videoId}.json`);
          await mkdir(paths.beatmapsDir, { recursive: true });
          if (await writeIfChanged(out, text)) written.push(out);
          existing.set(c.videoId, { analyzerVersion: map.analyzerVersion, bpm: map.bpm, duration: map.duration });
          const tEnd = deps.clock();
          result = {
            ...base,
            kind: 'ok',
            bpm: map.bpm,
            seconds: tEnd - t0,
            message: `${map.beats.length} beats, ${map.sections.length} sections, ${Math.round(map.duration)} s song; download ${(tDl - t0).toFixed(1)} s, decode ${(tDec - tDl).toFixed(1)} s, analyse ${(tEnd - tDec).toFixed(1)} s`,
          };
        }
      } catch (e) {
        const cl = classify(e);
        const message = sanitizeMessage(cl.detail ? `${cl.summary}: ${cl.detail}` : cl.summary, dir);
        result = { ...base, kind: cl.kind, reason: cl.kind, message, seconds: deps.clock() - t0 };
      } finally {
        await deps.removeDir(dir);
      }
      if (result.kind === 'ok' || recordFailure) {
        results.push(result);
        status[c.videoId] = toStatus(result.kind, result.reason, result.kind === 'ok' ? undefined : result.message, status[c.videoId], nowIso());
      }
      note(result.kind);
      deps.log(`${prefix}: ${result.kind}${result.bpm !== undefined ? ` ${result.bpm} BPM` : ''}${result.message ? ` - ${result.message}` : ''}`);
      return result;
    };

    // --- Add by search ------------------------------------------------------
    for (const item of addPlan.todo) {
      const label = `${item.req.artist} - ${item.req.title}`;
      const base = { artist: item.req.artist, title: item.req.title };
      if (mustStop()) {
        addResults.push({ ...base, kind: 'skipped', message: 'run stopped early; will be retried' });
        continue;
      }
      deps.log(`add [${item.why}] ${label}`);
      const t0 = deps.clock();
      const fail = (state: SongRequestStatus['state'], message: string, durationSec?: number) => {
        const prev = songsStatus[item.key];
        songsStatus[item.key] = {
          state,
          artist: item.req.artist,
          title: item.req.title,
          ...((durationSec ?? item.req.durationSec) !== undefined ? { durationSec: durationSec ?? item.req.durationSec } : {}),
          message: sanitizeMessage(message),
          attempts: (prev?.attempts ?? 0) + 1,
          lastTried: nowIso(),
        };
        addResults.push({ ...base, kind: state, message, officialSeconds: durationSec, seconds: deps.clock() - t0 });
        deps.log(`  ${state}: ${message}`);
      };
      let req: { artist: string; title: string; durationSec: number } | null;
      try {
        req = await resolveRequest(item.req);
      } catch {
        req = null;
      }
      if (!req) {
        fail('not-found', "Couldn't find this song's official length on iTunes.");
        continue;
      }
      const canonicalKey = songKey(req.artist, req.title);
      const already = songs.find((x) => songKey(x.artist, x.title) === canonicalKey);
      if (already) {
        addResults.push({ ...base, kind: 'already', videoId: already.videoId, message: 'already added' });
        delete songsStatus[item.key];
        continue;
      }
      let ranked: Awaited<ReturnType<typeof searchAndRank>>['ranked'];
      try {
        ranked = (await searchAndRank(req)).ranked;
      } catch (e) {
        const cl = classify(e);
        note(cl.kind);
        fail(cl.kind === 'blocked' ? 'blocked' : 'error', `YouTube search failed: ${cl.summary}`, req.durationSec);
        continue;
      }
      let checks = 0;
      let analyses = 0;
      let outcome: AddResult | null = null;
      let transient: SongResult | null = null;
      for (const r of ranked) {
        if (checks >= ADD_MAX_EMBED_CHECKS || analyses >= ADD_MAX_ANALYSES) break;
        const id = r.entry.id;
        const dup = songs.find((x) => x.videoId === id);
        if (dup) {
          outcome = { ...base, kind: 'already', videoId: id, message: `already added as ${dup.artist} - ${dup.title}` };
          break;
        }
        checks++;
        const embed = await deps.checkEmbed!(id);
        if (embed === 'disabled' || embed === 'gone') {
          deps.log(`    ${id}: ${embed === 'disabled' ? 'embedding disabled' : 'removed or private'}, trying the next one`);
          continue;
        }
        const pick = { videoId: id, tier: r.tier, videoTitle: r.entry.title, channel: r.entry.channel, videoSeconds: r.entry.duration ?? undefined, officialSeconds: req.durationSec };
        let res: SongResult;
        if (existing.get(id)?.analyzerVersion === ANALYZER_VERSION) {
          res = { videoId: id, why: 'add', kind: 'ok', message: 'beat map already exists' };
          deps.log(`    ${id}: beat map already exists`);
        } else {
          analyses++;
          const c: Candidate = { videoId: id, title: req.title, artist: req.artist, origin: 'added' };
          res = await processVideo(c, 'add', `  ${id}`, false);
        }
        if (res.kind === 'ok') {
          const song: AddedSong = {
            videoId: id,
            title: req.title,
            artist: req.artist,
            addedAt: nowIso(),
            durationSec: req.durationSec,
            ...(r.tier === 'music-video' ? { note: 'music-video' as const } : {}),
          };
          songs.push(song);
          delete songsStatus[item.key];
          outcome = { ...base, kind: 'added', ...pick, bpm: res.bpm, seconds: deps.clock() - t0, message: res.message };
          break;
        }
        if (res.kind === 'blocked' || res.kind === 'outdated') {
          transient = res;
          break;
        }
        deps.log(`    ${id}: ${res.kind}, trying the next one`);
      }
      if (outcome) {
        addResults.push(outcome);
        deps.log(`  ${outcome.kind}: ${outcome.videoId}${outcome.tier ? ` (${outcome.tier})` : ''}`);
      } else if (transient) {
        fail(transient.kind === 'blocked' ? 'blocked' : 'error', transient.message ?? 'YouTube refused the download', req.durationSec);
      } else {
        fail(
          'not-found',
          ranked.length
            ? "None of the matching YouTube videos could be used (embedding disabled or unavailable)."
            : "Couldn't find a YouTube video of this song that matches its official length.",
          req.durationSec,
        );
      }
    }

    // --- Regular work -------------------------------------------------------
    const total = plan.todo.length;
    for (let i = 0; i < total; i++) {
      if (mustStop()) {
        stoppedEarly = runKind as 'blocked' | 'outdated';
        if (successes === 0) fatal = stoppedEarly;
        deps.log(`stopping early: ${runLen} consecutive ${runKind} result(s)`);
        break;
      }
      const item: WorkItem = plan.todo[i];
      const c = item.candidate;
      const prefix = `[${i + 1}/${total}] ${describe(c)}`;
      const pre = preflightSkip(c);
      if (pre) {
        results.push({ videoId: c.videoId, title: c.title, artist: c.artist, why: item.why, kind: 'skipped', reason: pre.reason, message: pre.message });
        status[c.videoId] = toStatus('skipped', pre.reason, pre.message, status[c.videoId], nowIso());
        deps.log(`${prefix}: ${pre.message}`);
        continue;
      }
      await processVideo(c, item.why, prefix);
    }
    if (!stoppedEarly && mustStop()) {
      stoppedEarly = runKind as 'blocked' | 'outdated';
      if (successes === 0) fatal = stoppedEarly;
    }

    // --- Shared files -----------------------------------------------------
    const now = nowIso();
    await mkdir(paths.beatmapsDir, { recursive: true });
    // Rebuilt from the map files on disk every run, so it cannot drift from them.
    const idx = renderIndex(await readText(indexPath), ANALYZER_VERSION, await scanMaps(paths.beatmapsDir), now);
    if (await writeIfChanged(indexPath, idx)) written.push(indexPath);
    const st = renderStatus(prevStatusText, status, now);
    if (await writeIfChanged(statusPath, st)) written.push(statusPath);
    if (playlist) {
      const pl = renderPlaylist(await readText(paths.playlistFile), playlist.playlistId, playlist.videos, now);
      if (await writeIfChanged(paths.playlistFile, pl)) written.push(paths.playlistFile);
    }
    // Created on the first add, so a repo that never adds songs gets no extra files.
    if (paths.songsFile && (prevSongsText !== undefined || songs.length)) {
      if (await writeIfChanged(paths.songsFile, renderSongs(prevSongsText, songs, now))) written.push(paths.songsFile);
    }
    if (paths.songsStatusFile && (prevSongsStatusText !== undefined || Object.keys(songsStatus).length)) {
      const text = renderSongsStatus(prevSongsStatusText, songsStatus, now);
      if (await writeIfChanged(paths.songsStatusFile, text)) written.push(paths.songsStatusFile);
    }
  }

  if (!fatal && playlistError) {
    const anyOk = !opts.dryRun && results.some((r) => r.kind === 'ok');
    fatal = !anyOk && (playlistError.kind === 'blocked' || playlistError.kind === 'outdated') ? playlistError.kind : 'playlist';
  }
  const report: RunReport = {
    results,
    ...(addResults.length ? { adds: addResults } : {}),
    plan: { todo: plan.todo.length, done: plan.done, waiting: plan.waiting, deferred: plan.deferred },
    playlist: {
      configured: !!opts.playlistUrl,
      ...(playlist ? { count: playlist.videos.length } : {}),
      ...(playlistError ? { error: `${playlistError.summary}${playlistError.detail ? `: ${playlistError.detail}` : ''}` } : {}),
      ...(addMode ? { skipped: true } : {}),
    },
    ...(stoppedEarly ? { stoppedEarly } : {}),
    fatal,
    usedCookies: opts.usedCookies,
    dryRun: opts.dryRun,
  };
  return { exitCode: fatal ? 1 : 0, report, written };
}
