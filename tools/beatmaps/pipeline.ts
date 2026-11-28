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
import { ANALYZER_VERSION, analyzeOffline, beatSpan, parse, serialize, type BeatMap } from '../../src/core/analysis';
import type { GenreLookup, SongQuery } from '../../src/genre';
import { decideContribution, parseContribution, type KnownSongs } from './contribute';
import { catalogSongs, dueSongs, genreListsFor, parseGenresFile, putRecord, renderGenresFile, type CatalogSong, type GenreRecord } from './genres';
import type { Classification } from './classify';
import { classifyYtDlpError } from './classify';
import { parseFlatPlaylist, parseStatus, renderIndex, renderPlaylist, renderStatus, type GenreMeta, type MapInfo, type PlaylistInfo } from './output';
import type { OfficialSong } from './itunes';
import { ALT_WINDOW, degradedSearch, fallbackQueries, judgeVideo, mergeSearches, needsMoreSearch, notFoundMessage, parseSearch, parseVideoInfo, rankCandidates, searchQueries, type Ranked, type SearchEntry, type Tier, type VideoVerdict } from './pick';
import { planWork, preflightSkip, unionCandidates, type Candidate, type StatusReason, type VideoStatus, type WorkItem, type WorkReason } from './select';
import { mergeRefusals, parseRequests, parseSongsList, planAdds, recentRefusals, renderSongs, renderSongsStatus, songKey, type AddedSong, type AddRequest, type RequestStatus } from './songs';
import { cleanGenreLevels, cleanGenreList, type SongNote } from '../../src/beat/cloud';
import type { AddResult, Fatal, ResultKind, RunReport, SongResult } from './summary';
import { attemptsLine, DownloadFailure, PCM_RATE, ToolFailure, type DownloadResult, type EmbedCheck } from './youtube';

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
  /** public/genres.json (multi-source genre lookups; see genres.ts). Without it (or lookupGenres), no genres are looked up. */
  genresFile?: string;
}

export interface Deps {
  fetchPlaylist(url: string): Promise<unknown>;
  /** `light`: an alternate upload of a song: only the first routes (see youtube.ts lightAttempts). */
  downloadAudio(videoId: string, dir: string, opts?: { light?: boolean }): Promise<DownloadResult>;
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
  /** `yt-dlp -J` metadata of one video (add mode, a video the person chose). */
  videoInfo?(videoId: string): Promise<unknown>;
  /** Official length from iTunes, for requests without one. */
  lookupOfficial?(req: { artist: string; title: string }): Promise<OfficialSong | null>;
  /** Genres from several public sources (src/genre); `previous` is the song's stored lookup, which serves as the cache. */
  lookupGenres?(song: SongQuery, previous: GenreLookup | null): Promise<GenreLookup>;
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
  /**
   * A contributed beat map (JSON text, the workflow's `map_json`). When set,
   * the run only decides on this map (see contribute.ts) and touches nothing
   * on YouTube: no playlist, no downloads.
   */
  contributed?: string;
  /** Retry songs that failed with 'blocked'/'outdated' now, ignoring their backoff (local sync). */
  retryBlocked?: boolean;
  /** Catalog songs whose genre lookup is missing or due (a source failed or an old 'none' expired) looked up per run (default 5). */
  genreRetries?: number;
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
      out.set(id, { analyzerVersion: map.analyzerVersion, bpm: map.bpm, duration: map.duration, source: map.source, span: beatSpan(map) });
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
/**
 * When YouTube withholds a song's chosen video (no audio, or HTTP 403 for every route), other
 * uploads of the same song that pass the same ranking rules are tried in the same run: at most
 * this many videos per song in all (the first choice plus 4 alternates), each with the light
 * attempt chain, within ALT_BUDGET_S per song and ALT_DOWNLOADS_PER_RUN per run.
 */
export const MAX_VIDEOS_PER_SONG = 5;
const ALT_BUDGET_S = 6 * 60;
const ALT_DOWNLOADS_PER_RUN = 12;

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
  const songsStatus: Record<string, RequestStatus> = prevSongsStatusText ? parseRequests(prevSongsStatusText) : {};
  const prevGenresText = paths.genresFile ? await readText(paths.genresFile) : undefined;
  const genreRecords = parseGenresFile(prevGenresText);
  if (opts.contributed !== undefined) {
    return runContribution(paths, opts, deps, { existing, songs, songsStatus, prevSongsText, prevSongsStatusText, starter, indexPath, genreRecords });
  }
  const addMode = (opts.adds?.length ?? 0) > 0;
  const addPlan = paths.songsFile ? planAdds(opts.adds ?? [], songs, songsStatus, deps.now(), opts.retryBlocked) : { todo: [], skipped: [] };
  const addResults: AddResult[] = [];
  for (const sk of addPlan.skipped) {
    deps.log(`add ${sk.req.artist} - ${sk.req.title}: ${sk.why}`);
    const kind = sk.why === 'already added' ? 'already' : 'skipped';
    const song = songs.find((x) => songKey(x.artist, x.title) === sk.key);
    addResults.push({ artist: sk.req.artist, title: sk.req.title, kind, ...(song ? { videoId: song.videoId } : {}), message: sk.why });
  }
  if (addPlan.todo.length && (!deps.searchVideos || !deps.checkEmbed)) throw new Error('add requests need searchVideos and checkEmbed');
  if (addPlan.todo.some((t) => t.req.videoId) && !deps.videoInfo) throw new Error('add requests with a chosen video need videoInfo');


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
    sources: new Map([...existing].map(([id, m]) => [id, m.source ?? 'cloud'])),
    retryBlocked: opts.retryBlocked,
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
    const search = async (q: string) => {
      await pause();
      let list = parseSearch(await deps.searchVideos!(q));
      if (degradedSearch(list)) {
        // No channels or views in the answer: YouTube's occasional stripped results; ask once more.
        await pause();
        list = parseSearch(await deps.searchVideos!(q));
      }
      lists.push(list);
    };
    for (const q of searchQueries(req)) await search(q);
    let entries = mergeSearches(lists);
    let ranked = rankCandidates(req, entries);
    // Little-known songs: the plain "Artist Title" search often finds what the other two miss;
    // for a credit naming several artists, then "<first artist> Title". One at a time, only while
    // nothing ranks but the last resort (someone else's upload).
    for (const q of fallbackQueries(req)) {
      if (!needsMoreSearch(ranked.ranked)) break;
      await search(q);
      entries = mergeSearches(lists);
      ranked = rankCandidates(req, entries);
    }
    deps.log(`  ${entries.length} search result(s), ${ranked.ranked.length} usable`);
    for (const r of ranked.ranked.slice(0, 5)) {
      deps.log(`    ${r.tier.padEnd(11)} ${r.entry.id} ${r.entry.duration} s ${r.entry.views ?? '?'} views "${r.entry.title}" (${r.entry.channel})`);
    }
    // For alternates only (after YouTube withheld the first choice): the same rules with ALT_WINDOW.
    const alternates = () => rankCandidates(req, entries, { window: ALT_WINDOW }).ranked;
    return { ...ranked, entries, alternates };
  };

  /**
   * Which official length / names to use for a request (iTunes when missing).
   * When the length is given, iTunes is still asked for the genre only
   * (names and length stay as requested); a failed lookup just means no genre.
   */
  const resolveRequest = async (req: AddRequest): Promise<OfficialSong | null> => {
    if (req.durationSec !== undefined) {
      let genre: string | undefined;
      try {
        genre = deps.lookupOfficial ? (await deps.lookupOfficial(req))?.genre : undefined;
      } catch {
        genre = undefined;
      }
      if (genre) deps.log(`  iTunes genre: ${genre}`);
      return { artist: req.artist, title: req.title, durationSec: req.durationSec, ...(genre ? { genre } : {}) };
    }
    const off = deps.lookupOfficial ? await deps.lookupOfficial(req) : null;
    if (off) deps.log(`  iTunes: ${off.artist} - ${off.title}, ${off.durationSec} s${off.genre ? `, ${off.genre}` : ''}`);
    return off;
  };

  /**
   * A video the person chose: its metadata (yt-dlp), the embed check, and the picker's rules
   * (pick.ts judgeVideo). Throws what yt-dlp threw (blocked, unavailable, ...).
   */
  const checkChosen = async (req: { artist: string; title: string; durationSec: number }, id: string): Promise<{ verdict: VideoVerdict; title?: string; channel?: string; seconds?: number }> => {
    await pause();
    const info = parseVideoInfo(await deps.videoInfo!(id));
    if (!info) throw new ToolFailure({ kind: 'error', summary: 'yt-dlp returned no details for this video', detail: '' }, 'yt-dlp');
    const embed = await deps.checkEmbed!(id);
    deps.log(`  chosen video ${id}: "${info.title}" (${info.channel}) ${info.duration ?? '?'} s, ${info.liveStatus ?? 'not live'}, ${info.availability ?? '?'}, embed ${embed}${info.embeddable === false ? ' (not playable in embeds)' : ''}`);
    const seen = { title: info.title, channel: info.channel, ...(info.duration !== null ? { seconds: info.duration } : {}) };
    if (embed === 'gone') return { ...seen, verdict: { kind: 'refuse', reason: 'unavailable', message: 'This video is private, removed or not available.' } };
    const verdict = judgeVideo(req, { ...info, embeddable: embed === 'disabled' ? false : info.embeddable });
    deps.log(`  chosen video ${id}: ${verdict.kind}${verdict.kind === 'match' ? '' : ` (${verdict.reason}): ${verdict.message}`}`);
    return { ...seen, verdict };
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
        if (item.req.videoId) {
          const id = item.req.videoId;
          const c = await checkChosen(req, id);
          const seen = { videoId: id, videoTitle: c.title, channel: c.channel, videoSeconds: c.seconds, officialSeconds: req.durationSec };
          const v = c.verdict;
          if (v.kind === 'refuse') addResults.push({ ...base, ...seen, kind: 'not-found', message: v.message });
          else if (v.kind === 'mismatch' && !item.req.force) addResults.push({ ...base, ...seen, kind: 'mismatch', message: v.message });
          else addResults.push({ ...base, ...seen, kind: 'planned', tier: chosenNote(v).note, message: 'dry run: not downloaded' });
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
    /** Downloads of alternate uploads this run (bounded by ALT_DOWNLOADS_PER_RUN). */
    let altDownloads = 0;
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
    // 'withheld' (no audio for a video) stops a long run too, to go easy on YouTube, but never fails it:
    // songs are listed without their map and retried later.
    const mustStop = () => (runKind === 'blocked' || runKind === 'outdated' || runKind === 'withheld') && runLen >= needed;
    if (playlistError?.kind === 'blocked' || playlistError?.kind === 'outdated') note(playlistError.kind);

    /**
     * Download, decode, analyse and write one video's beat map, and record it
     * in status.json and the results table. `recordFailure: false` (add-mode
     * candidates): a failure is only logged, since the next candidate is tried
     * and songs-status.json reports the request.
     */
    const processVideo = async (
      c: Candidate,
      why: WorkReason,
      prefix: string,
      recordFailure = true,
      /** `count: false`: an alternate upload, which doesn't count towards the run's streaks (the song does, once). */
      extra: { count?: boolean; light?: boolean } = {},
    ): Promise<SongResult> => {
      await pause();
      const t0 = deps.clock();
      const dir = await deps.makeTempDir();
      const base = { videoId: c.videoId, title: c.title, artist: c.artist, why };
      let result: SongResult;
      try {
        const dl = extra.light ? await deps.downloadAudio(c.videoId, dir, { light: true }) : await deps.downloadAudio(c.videoId, dir);
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
          existing.set(c.videoId, { analyzerVersion: map.analyzerVersion, bpm: map.bpm, duration: map.duration, source: map.source, span: beatSpan(map) });
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
        // Several clients tried (signed in): each one's answer goes to the log, their kinds to the message.
        const attempts = e instanceof DownloadFailure && e.attempts.length + e.skipped.length > 1 ? e.attempts : null;
        for (const a of attempts ?? []) {
          const c = a.classification;
          const took = a.ms !== undefined ? ` (${(a.ms / 1000).toFixed(0)} s)` : '';
          const pot = a.diagnostics?.length ? ` | ${a.diagnostics.join(' | ')}` : '';
          deps.log(`${prefix}:   attempt ${a.label}${took}: ${c.kind} - ${sanitizeMessage(c.detail ? `${c.summary}: ${c.detail}` : c.summary, dir)}${sanitizeMessage(pot, dir)}`);
        }
        for (const label of attempts && e instanceof DownloadFailure ? e.skipped : []) deps.log(`${prefix}:   attempt ${label}: not tried (the song's time for downloads was used up)`);
        const text = `${cl.summary}${attempts ? ` [${attemptsLine(attempts)}]` : ''}${cl.detail ? `: ${cl.detail}` : ''}`;
        result = { ...base, kind: cl.kind, reason: cl.kind, message: sanitizeMessage(text, dir), seconds: deps.clock() - t0 };
      } finally {
        await deps.removeDir(dir);
      }
      if (result.kind === 'ok' || recordFailure) {
        results.push(result);
        status[c.videoId] = toStatus(result.kind, result.reason, result.kind === 'ok' ? undefined : result.message, status[c.videoId], nowIso());
      }
      if (extra.count !== false) note(result.kind);
      deps.log(`${prefix}: ${result.kind}${result.bpm !== undefined ? ` ${result.bpm} BPM` : ''}${result.message ? ` - ${result.message}` : ''}`);
      return result;
    };

    /** Multi-source genres for one catalog song (never fails the run; a failed source is retried on a later run). */
    const lookupSongGenres = async (c: CatalogSong) => {
      if (!deps.lookupGenres || !paths.genresFile) return;
      try {
        const l = await deps.lookupGenres(c, genreRecords[c.key] ?? null);
        putRecord(genreRecords, c, l);
        deps.log(`  genres for ${c.artist} - ${c.title}: ${l.genres.length ? l.genres.join(', ') : 'none found'}${l.complete ? '' : ' (some sources will be asked again)'}`);
      } catch (e) {
        deps.log(`  genres for ${c.artist} - ${c.title}: lookup failed (${(e as Error)?.message ?? e})`);
      }
    };
    const catalogEntry = (s: AddedSong): CatalogSong => ({
      videoId: s.videoId,
      key: songKey(s.artist, s.title),
      artist: s.artist,
      title: s.title,
      ...(s.durationSec ? { durationSec: s.durationSec } : {}),
      ...(s.genre ? { itunesGenre: s.genre } : {}),
      added: true,
    });

    // --- Add by search ------------------------------------------------------
    for (const item of addPlan.todo) {
      const label = `${item.req.artist} - ${item.req.title}`;
      const base = { artist: item.req.artist, title: item.req.title };
      // Songs without audio don't hold up adds: an add lists its song even when the download fails.
      if (mustStop() && runKind !== 'withheld') {
        addResults.push({ ...base, kind: 'skipped', message: 'run stopped early; will be retried' });
        continue;
      }
      deps.log(`add [${item.why}] ${label}`);
      const t0 = deps.clock();
      // A chosen video stays with the request: its retry uses it, and the app shows which one was checked.
      const chosenFields = item.req.videoId ? { videoId: item.req.videoId, ...(item.req.force ? { force: true } : {}) } : {};
      const fail = (state: 'not-found' | 'blocked' | 'error' | 'video-mismatch', message: string, durationSec?: number, seen: Partial<AddResult> = {}) => {
        const prev = songsStatus[item.key];
        songsStatus[item.key] = {
          state,
          artist: item.req.artist,
          title: item.req.title,
          ...((durationSec ?? item.req.durationSec) !== undefined ? { durationSec: durationSec ?? item.req.durationSec } : {}),
          ...chosenFields,
          message: sanitizeMessage(message),
          attempts: (prev?.attempts ?? 0) + 1,
          lastTried: nowIso(),
        };
        addResults.push({ ...base, ...seen, kind: state === 'video-mismatch' ? 'mismatch' : state, message, officialSeconds: durationSec, seconds: deps.clock() - t0 });
        deps.log(`  ${state}: ${message}`);
      };
      let req: OfficialSong | null;
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
      const official = req;
      type Pick = { videoId: string; tier?: string; videoTitle?: string; channel?: string; videoSeconds?: number; officialSeconds: number };
      /** List the song with this video and no map yet (the app finds its beat by listening); later runs retry the map. */
      const listPending = async (id: string, note: { note?: SongNote }, pick: Pick, res: SongResult, refused: string[]): Promise<AddResult> => {
        status[id] = toStatus(res.kind, res.kind as StatusReason, res.message, status[id], nowIso());
        const listed: AddedSong = {
          videoId: id,
          title: official.title,
          artist: official.artist,
          addedAt: nowIso(),
          durationSec: official.durationSec,
          hasMap: false,
          ...note,
          ...(official.genre ? { genre: official.genre } : {}),
        };
        songs.push(listed);
        await lookupSongGenres(catalogEntry(listed));
        const prev = songsStatus[item.key];
        const merged = mergeRefusals(prev?.state === 'map-pending' ? prev.refused : undefined, refused, deps.now());
        songsStatus[item.key] = {
          state: 'map-pending',
          artist: official.artist,
          title: official.title,
          durationSec: official.durationSec,
          videoId: id,
          message: MAP_PENDING_MESSAGE,
          attempts: (prev?.attempts ?? 0) + 1,
          lastTried: nowIso(),
          ...(merged.length ? { refused: merged } : {}),
        };
        const others = refused.length ? `; ${refused.length} other upload(s) withheld too` : '';
        return { ...base, kind: 'listed', ...pick, cause: res.kind, seconds: deps.clock() - t0, message: `listed; beat map pending (${res.kind}: ${res.message ?? ''})${others}` };
      };

      if (item.req.videoId) {
        // --- A video the person chose (pasted link): check it, then add it like a found one ---
        const id = item.req.videoId;
        const force = !!item.req.force;
        const dup = songs.find((x) => x.videoId === id);
        if (dup) {
          fail('not-found', `This video is already in the song list as ${dup.artist} - ${dup.title}.`, req.durationSec, { videoId: id });
          continue;
        }
        let checked: Awaited<ReturnType<typeof checkChosen>>;
        try {
          checked = await checkChosen(req, id);
        } catch (e) {
          const cl = classify(e);
          if (cl.kind === 'unavailable') fail('not-found', `YouTube says: ${cl.summary.replace(/\s*\(.*\)$/, '')}. This video can't be used.`, req.durationSec, { videoId: id });
          else {
            // As a search YouTube refused: retried automatically later, with this video.
            note(cl.kind);
            fail(cl.kind === 'blocked' ? 'blocked' : 'error', `YouTube didn't answer about this video: ${cl.summary}`, req.durationSec, { videoId: id });
          }
          continue;
        }
        const v = checked.verdict;
        const pick: Pick = { videoId: id, videoTitle: checked.title, channel: checked.channel, videoSeconds: checked.seconds, officialSeconds: req.durationSec };
        if (v.kind === 'refuse') {
          fail('not-found', v.message, req.durationSec, pick);
          continue;
        }
        if (v.kind === 'mismatch' && !force) {
          fail('video-mismatch', v.message, req.durationSec, pick);
          continue;
        }
        const mark = chosenNote(v);
        pick.tier = mark.note;
        let res: SongResult;
        if (existing.get(id)?.analyzerVersion === ANALYZER_VERSION) {
          res = { videoId: id, why: 'add', kind: 'ok', message: 'beat map already exists' };
          deps.log(`    ${id}: beat map already exists`);
        } else {
          res = await processVideo({ videoId: id, title: req.title, artist: req.artist, origin: 'added' }, 'add', `  ${id}`, false);
        }
        let chosenOutcome: AddResult | null = null;
        if (res.kind === 'ok') {
          const song: AddedSong = { videoId: id, title: req.title, artist: req.artist, addedAt: nowIso(), durationSec: req.durationSec, ...mark, ...(req.genre ? { genre: req.genre } : {}) };
          songs.push(song);
          delete songsStatus[item.key];
          await lookupSongGenres(catalogEntry(song));
          chosenOutcome = { ...base, kind: 'added', ...pick, bpm: res.bpm, seconds: deps.clock() - t0, message: `${res.message ?? ''}; the person chose this video${mark.note === 'user-video-forced' ? ` although it didn't match (${v.kind === 'mismatch' ? v.message : ''})` : ''}` };
        } else if (res.kind === 'withheld' || res.kind === 'blocked' || res.kind === 'outdated') {
          // As for a found video: listed now, its map retried by later runs. No other uploads are
          // tried (tryAlternates skips chosen videos): the person picked this one.
          chosenOutcome = await listPending(id, mark, pick, res, []);
        } else if (res.kind === 'skipped' || res.kind === 'unavailable') {
          fail('not-found', res.kind === 'skipped' ? 'This video is a live stream, a premiere, or longer than 15 minutes, so it can’t be used.' : `YouTube says: ${(res.message ?? 'the video is unavailable').replace(/:.*$/, '')}. This video can't be used.`, req.durationSec, pick);
          continue;
        } else {
          fail('error', `Couldn't make the beat map: ${res.message ?? res.kind}`, req.durationSec, pick);
          continue;
        }
        addResults.push(chosenOutcome);
        deps.log(`  ${chosenOutcome.kind}: ${id} (${mark.note})`);
        continue;
      }

      let found: Awaited<ReturnType<typeof searchAndRank>>;
      try {
        found = await searchAndRank(req);
      } catch (e) {
        const cl = classify(e);
        note(cl.kind);
        fail(cl.kind === 'blocked' ? 'blocked' : 'error', `YouTube search failed: ${cl.summary}`, req.durationSec);
        continue;
      }
      const ranked = found.ranked;
      let checks = 0;
      let analyses = 0;
      let outcome: AddResult | null = null;
      // The first choice YouTube withheld: other uploads that pass the same rules are tried, then it is listed.
      let held: { id: string; tier: Ranked['tier']; pick: Pick; res: SongResult; at: number } | null = null;
      const refused: string[] = [];
      // The first choice comes from `ranked` (the usual rules); once it is withheld, the rest come from
      // the alternates' ranking (ALT_WINDOW), skipping what was already looked at.
      let queue: Ranked[] = ranked;
      const seen = new Set<string>();
      for (let qi = 0; qi < queue.length; qi++) {
        const r = queue[qi];
        if (seen.has(r.entry.id)) continue;
        seen.add(r.entry.id);
        if (checks >= ADD_MAX_EMBED_CHECKS || analyses >= (held ? MAX_VIDEOS_PER_SONG : ADD_MAX_ANALYSES)) break;
        if (held && (altDownloads >= ALT_DOWNLOADS_PER_RUN || deps.clock() - held.at > ALT_BUDGET_S)) break;
        const id = r.entry.id;
        const dup = songs.find((x) => x.videoId === id);
        if (dup) {
          if (held) continue; // another song's video: not an alternate for this one
          outcome = { ...base, kind: 'already', videoId: id, message: `already added as ${dup.artist} - ${dup.title}` };
          break;
        }
        checks++;
        const embed = await deps.checkEmbed!(id);
        if (embed === 'disabled' || embed === 'gone') {
          deps.log(`    ${id}: ${embed === 'disabled' ? 'embedding disabled' : 'removed or private'}, trying the next one`);
          continue;
        }
        const pick: Pick = { videoId: id, tier: r.tier, videoTitle: r.entry.title, channel: r.entry.channel, videoSeconds: r.entry.duration ?? undefined, officialSeconds: req.durationSec };
        let res: SongResult;
        if (existing.get(id)?.analyzerVersion === ANALYZER_VERSION) {
          res = { videoId: id, why: 'add', kind: 'ok', message: 'beat map already exists' };
          deps.log(`    ${id}: beat map already exists`);
        } else {
          analyses++;
          const c: Candidate = { videoId: id, title: req.title, artist: req.artist, origin: 'added' };
          if (held) altDownloads++;
          res = await processVideo(c, held ? 'alternate' : 'add', `  ${id}`, false, held ? { count: false, light: true } : {});
        }
        if (res.kind === 'ok') {
          if (held) note('ok');
          const song: AddedSong = {
            videoId: id,
            title: req.title,
            artist: req.artist,
            addedAt: nowIso(),
            durationSec: req.durationSec,
            ...tierNote(r.tier),
            ...(req.genre ? { genre: req.genre } : {}),
          };
          songs.push(song);
          delete songsStatus[item.key];
          await lookupSongGenres(catalogEntry(song));
          const instead = held ? `; YouTube withheld the first choice ${held.id}${refused.length ? ` and ${refused.length} other upload(s)` : ''}, so this upload is used` : '';
          outcome = { ...base, kind: 'added', ...pick, bpm: res.bpm, seconds: deps.clock() - t0, message: `${res.message ?? ''}${instead}` };
          break;
        }
        if (res.kind === 'withheld') {
          if (!held) {
            held = { id, tier: r.tier, pick, res, at: deps.clock() };
            queue = [...queue.slice(0, qi + 1), ...found.alternates().filter((x) => !seen.has(x.entry.id))];
            deps.log(`    ${id}: YouTube withheld it; trying other uploads of the song (at most ${MAX_VIDEOS_PER_SONG} videos in all)`);
          } else refused.push(id);
          continue;
        }
        if (res.kind === 'blocked' || res.kind === 'outdated') {
          // The right video is known; only the download was refused. List the song now with the best
          // video found (the first choice when YouTube withheld it) and keep trying on later runs.
          outcome = held ? await listPending(held.id, tierNote(held.tier), held.pick, held.res, refused) : await listPending(id, tierNote(r.tier), pick, res, []);
          break;
        }
        deps.log(`    ${id}: ${res.kind}, trying the next one`);
      }
      if (!outcome && held) outcome = await listPending(held.id, tierNote(held.tier), held.pick, held.res, refused);
      if (outcome) {
        addResults.push(outcome);
        deps.log(`  ${outcome.kind}: ${outcome.videoId}${outcome.tier ? ` (${outcome.tier})` : ''}`);
      } else {
        fail(
          'not-found',
          ranked.length
            ? "None of the matching YouTube videos could be used (embedding disabled or unavailable)."
            : notFoundMessage(req, found.entries, found.rejected),
          req.durationSec,
        );
      }
    }

    /**
     * A song added by search, listed without a map, whose video YouTube withheld again: try other
     * uploads of it that pass the same ranking rules as an add (search, length window, embeddable,
     * not another song's video, not in the playlist or starter pack, not refused in the last
     * REFUSED_FOR_MS). The first that gives audio becomes the song's video in songs.json, so the
     * app plays the very upload its beat map was made from. Songs from the playlist or the starter
     * pack keep their video: there the video is the owner's choice (the caller checks origin).
     */
    const tryAlternates = async (c: Candidate, first: SongResult, prefix: string): Promise<void> => {
      const song = songs.find((s) => s.videoId === c.videoId);
      if (!song || !(song.durationSec > 0) || !deps.searchVideos || !deps.checkEmbed) return;
      // The person chose this video (a pasted link): it stays the song's video, retried later as it is.
      if (song.note === 'user-video' || song.note === 'user-video-forced') {
        deps.log(`${prefix}: YouTube withheld it; the person chose this video, so no other upload is tried; retried later`);
        return;
      }
      if (altDownloads >= ALT_DOWNLOADS_PER_RUN || (mustStop() && runKind !== 'withheld')) return;
      const key = songKey(song.artist, song.title);
      const noteNow = songsStatus[key]?.state === 'map-pending' && songsStatus[key].videoId === song.videoId ? songsStatus[key] : undefined;
      const skip = recentRefusals(noteNow?.refused, deps.now());
      const fixed = knownSongs(starter, [], playlist ? JSON.stringify({ videos: playlist.videos }) : await readText(paths.playlistFile)).ids;
      deps.log(`${prefix}: YouTube withheld it; looking for other uploads of the song (at most ${MAX_VIDEOS_PER_SONG - 1})`);
      let ranked: Ranked[];
      try {
        ranked = (await searchAndRank({ artist: song.artist, title: song.title, durationSec: song.durationSec })).alternates();
      } catch (e) {
        deps.log(`${prefix}: search for other uploads failed (${classify(e).summary}); tried again on a later run`);
        return;
      }
      const t0 = deps.clock();
      const refusedNow: string[] = [];
      let tried = 0;
      let checks = 0;
      for (const r of ranked) {
        if (tried >= MAX_VIDEOS_PER_SONG - 1 || checks >= ADD_MAX_EMBED_CHECKS || altDownloads >= ALT_DOWNLOADS_PER_RUN || deps.clock() - t0 > ALT_BUDGET_S) break;
        const id = r.entry.id;
        if (id === song.videoId || skip.has(id) || fixed.has(id) || songs.some((s) => s.videoId === id)) continue;
        checks++;
        const embed = await deps.checkEmbed(id);
        if (embed === 'disabled' || embed === 'gone') continue;
        let res: SongResult;
        if (existing.get(id)?.analyzerVersion === ANALYZER_VERSION) res = { videoId: id, why: 'alternate', kind: 'ok', message: 'beat map already exists' };
        else {
          tried++;
          altDownloads++;
          const alt: Candidate = { videoId: id, title: song.title, artist: song.artist, origin: 'added' };
          res = await processVideo(alt, 'alternate', `${prefix} -> ${id}`, false, { count: false, light: true });
        }
        if (res.kind === 'ok') {
          note('ok');
          const old = song.videoId;
          song.videoId = id;
          const n = tierNote(r.tier).note;
          if (n) song.note = n;
          else delete song.note;
          // The withheld video is no longer anyone's song: its failure would only confuse "Is adding songs working?".
          if (!fixed.has(old)) delete status[old];
          first.replacedBy = id;
          first.message = `${first.message ?? ''}; replaced by ${id}, another upload of the song that YouTube handed over`;
          deps.log(`${prefix}: switched to ${id} (${r.tier}, "${r.entry.title}"); the app plays this upload, with its own beat map`);
          return;
        }
        if (res.kind === 'withheld') refusedNow.push(id);
        else if (res.kind === 'blocked' || res.kind === 'outdated') break; // the session, not the video
      }
      deps.log(
        tried || checks
          ? `${prefix}: no other upload worked (${tried} tried, ${refusedNow.length} withheld); the song keeps ${song.videoId} and is retried later`
          : `${prefix}: no other upload of the song passes the rules for adding one (${ranked.length} acceptable, all known); the song keeps ${song.videoId} and is retried later`,
      );
      if (!refusedNow.length) return;
      const prev = songsStatus[key];
      songsStatus[key] = {
        ...(noteNow ?? {
          state: 'map-pending' as const,
          artist: song.artist,
          title: song.title,
          durationSec: song.durationSec,
          videoId: song.videoId,
          message: MAP_PENDING_MESSAGE,
          attempts: prev?.attempts ?? 0,
          lastTried: nowIso(),
        }),
        refused: mergeRefusals(noteNow?.refused, refusedNow, deps.now()),
      };
    };

    // --- Regular work -------------------------------------------------------
    const total = plan.todo.length;
    for (let i = 0; i < total; i++) {
      if (mustStop()) {
        stoppedEarly = runKind as 'blocked' | 'outdated' | 'withheld';
        if (successes === 0 && (stoppedEarly !== 'withheld' || needed >= 2)) fatal = stoppedEarly;
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
      const res = await processVideo(c, item.why, prefix);
      if (res.kind === 'withheld' && c.origin === 'added' && !existing.has(c.videoId)) await tryAlternates(c, res, prefix);
    }
    // Every download blocked (or yt-dlp broken) with nothing left to try: the run fails. One song
    // YouTube withheld is no failure; several songs and every one withheld (none worked) is, since then
    // it is the session, not the song. (Nothing was skipped either, so it is not "stopped early".)
    if (!stoppedEarly && mustStop()) {
      if (runKind !== 'withheld') {
        stoppedEarly = runKind as 'blocked' | 'outdated';
        if (successes === 0) fatal = stoppedEarly;
      } else if (successes === 0 && needed >= 2) fatal = 'withheld';
    }

    // --- Genres of catalog songs still missing them (or due again) -------------
    // The playlist's songs too (after songs.json and the starter pack): without them a playlist song is danced with
    // no genre at all ("Mixed styles" when its map has no audio traits either).
    const prevIndexText = await readText(indexPath);
    const listed = [...starter, ...playlistSongs(playlist?.videos, await readText(paths.playlistFile))];
    if (deps.lookupGenres && paths.genresFile) {
      const catalog = catalogSongs(songs, listed, songGenres(songs, prevIndexText));
      // failedRetryMs 0: a source that failed is asked again on the next run.
      for (const c of dueSongs(catalog, genreRecords, deps.now(), opts.genreRetries ?? 5, 0)) await lookupSongGenres(c);
    }
    applyGenreLists(songs, genreRecords);

    // --- Shared files -----------------------------------------------------
    const now = nowIso();
    await mkdir(paths.beatmapsDir, { recursive: true });
    // Rebuilt from the map files on disk every run, so it cannot drift from them.
    const idx = renderIndex(prevIndexText, ANALYZER_VERSION, await scanMaps(paths.beatmapsDir), now, songGenres(songs, prevIndexText), songGenreLists(songs, listed, genreRecords, prevIndexText), songGenreMeta(songs, listed, genreRecords, prevIndexText));
    if (await writeIfChanged(indexPath, idx)) written.push(indexPath);
    await writeGenresFile(paths, prevGenresText, genreRecords, now, written);
    const st = renderStatus(prevStatusText, status, now);
    if (await writeIfChanged(statusPath, st)) written.push(statusPath);
    if (playlist) {
      const pl = renderPlaylist(await readText(paths.playlistFile), playlist.playlistId, playlist.videos, now);
      if (await writeIfChanged(paths.playlistFile, pl)) written.push(paths.playlistFile);
    }
    await writeSongFiles(paths, { songs, songsStatus, prevSongsText, prevSongsStatusText, mapIds: new Set(existing.keys()), now, written });
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

/** songs-status.json note for a song listed without a map (not a failure). */
export const MAP_PENDING_MESSAGE =
  'Added: you can dance to it now. A better beat map is being prepared and will arrive on its own.';

/**
 * songs.json and songs-status.json: `hasMap` follows the map files on disk,
 * and a 'map-pending' note goes away once its song has a map.
 */
async function writeSongFiles(
  paths: Paths,
  o: {
    songs: AddedSong[];
    songsStatus: Record<string, RequestStatus>;
    prevSongsText: string | undefined;
    prevSongsStatusText: string | undefined;
    mapIds: ReadonlySet<string>;
    now: string;
    written: string[];
  },
): Promise<void> {
  for (const song of o.songs) song.hasMap = o.mapIds.has(song.videoId);
  for (const [key, st] of Object.entries(o.songsStatus)) {
    if (st.state !== 'map-pending') continue;
    if (!st.videoId || o.mapIds.has(st.videoId) || !o.songs.some((x) => x.videoId === st.videoId)) delete o.songsStatus[key];
    else st.message = MAP_PENDING_MESSAGE; // notes written with older wording read the same as new ones
  }
  // Created on the first add, so a repo that never adds songs gets no extra files.
  if (paths.songsFile && (o.prevSongsText !== undefined || o.songs.length)) {
    if (await writeIfChanged(paths.songsFile, renderSongs(o.prevSongsText, o.songs, o.now))) o.written.push(paths.songsFile);
  }
  if (paths.songsStatusFile && (o.prevSongsStatusText !== undefined || Object.keys(o.songsStatus).length)) {
    const text = renderSongsStatus(o.prevSongsStatusText, o.songsStatus, o.now);
    if (await writeIfChanged(paths.songsStatusFile, text)) o.written.push(paths.songsStatusFile);
  }
}

/**
 * index.json `genre` values: the genres already stored in the previous index
 * (starter-pack songs are not in songs.json), overridden by the iTunes genre of
 * every song in songs.json that has one (with or without a map yet).
 */
export function songGenres(songs: AddedSong[], prevIndexText?: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const prev = (JSON.parse(prevIndexText ?? '{}') as { songs?: Record<string, { genre?: unknown }> }).songs;
    if (prev && typeof prev === 'object') for (const [id, v] of Object.entries(prev)) if (typeof v?.genre === 'string' && v.genre) out.set(id, v.genre);
  } catch {
    // no or unreadable previous index
  }
  for (const x of songs) if (x.genre) out.set(x.videoId, x.genre);
  return out;
}

/** songs.json `genres` (+ `genreLevels`, `artistGenres`): each added song gets its lookup's combined lists (when it found any). */
/** songs.json `note` for a pick from a fallback tier (the official music video, someone else's upload). */
function tierNote(tier: Tier): { note?: SongNote } {
  return tier === 'music-video' || tier === 'third-party' ? { note: tier } : {};
}

/** songs.json `note` for a video the person chose: it passed the rules, or they said "Use it anyway". */
function chosenNote(v: VideoVerdict): { note: SongNote } {
  return { note: v.kind === 'match' ? 'user-video' : 'user-video-forced' };
}

export function applyGenreLists(songs: AddedSong[], records: Readonly<Record<string, GenreRecord>>): void {
  for (const s of songs) {
    const r = records[songKey(s.artist, s.title)];
    if (!r) continue;
    if (r.genres?.length) {
      s.genres = [...r.genres];
      if (r.genreLevels?.length === r.genres.length) s.genreLevels = [...r.genreLevels];
      else delete s.genreLevels;
    }
    if (r.artistGenres?.length) s.artistGenres = [...r.artistGenres];
  }
}

/**
 * index.json `genreLevels` / `artistGenres`: those already stored in the
 * previous index, then every catalog song's lookup, then songs.json's own.
 */
export function songGenreMeta(songs: AddedSong[], starter: Candidate[], records: Readonly<Record<string, GenreRecord>>, prevIndexText?: string): Map<string, GenreMeta> {
  const out = new Map<string, GenreMeta>();
  try {
    const prev = (JSON.parse(prevIndexText ?? '{}') as { songs?: Record<string, { genres?: unknown; genreLevels?: unknown; artistGenres?: unknown }> }).songs;
    if (prev && typeof prev === 'object') {
      for (const [id, v] of Object.entries(prev)) {
        const genreLevels = cleanGenreLevels(v?.genreLevels, cleanGenreList(v?.genres));
        const artistGenres = cleanGenreList(v?.artistGenres);
        if (genreLevels || artistGenres) out.set(id, { ...(genreLevels ? { genreLevels } : {}), ...(artistGenres ? { artistGenres } : {}) });
      }
    }
  } catch {
    // no or unreadable previous index
  }
  for (const c of catalogSongs(songs, starter)) {
    const r = records[c.key];
    if (!r) continue;
    const genreLevels = r.genres?.length && r.genreLevels?.length === r.genres.length ? r.genreLevels : undefined;
    if (genreLevels || r.artistGenres?.length) out.set(c.videoId, { ...(genreLevels ? { genreLevels } : {}), ...(r.artistGenres?.length ? { artistGenres: r.artistGenres } : {}) });
  }
  for (const x of songs) {
    if (x.genreLevels?.length || x.artistGenres?.length) out.set(x.videoId, { ...(x.genreLevels?.length ? { genreLevels: x.genreLevels } : {}), ...(x.artistGenres?.length ? { artistGenres: x.artistGenres } : {}) });
  }
  return out;
}

/**
 * index.json `genres` lists: those already stored in the previous index, then
 * every catalog song's lookup (songs.json and starter pack), then songs.json's own.
 */
export function songGenreLists(songs: AddedSong[], starter: Candidate[], records: Readonly<Record<string, GenreRecord>>, prevIndexText?: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  try {
    const prev = (JSON.parse(prevIndexText ?? '{}') as { songs?: Record<string, { genres?: unknown }> }).songs;
    if (prev && typeof prev === 'object') {
      for (const [id, v] of Object.entries(prev)) {
        const g = cleanGenreList(v?.genres);
        if (g) out.set(id, g);
      }
    }
  } catch {
    // no or unreadable previous index
  }
  for (const [id, g] of genreListsFor(catalogSongs(songs, starter), records)) out.set(id, g);
  for (const x of songs) if (x.genres?.length) out.set(x.videoId, x.genres);
  return out;
}

async function writeGenresFile(paths: Paths, prevText: string | undefined, records: Readonly<Record<string, GenreRecord>>, now: string, written: string[]): Promise<void> {
  if (!paths.genresFile || (prevText === undefined && !Object.keys(records).length)) return;
  if (await writeIfChanged(paths.genresFile, renderGenresFile(prevText, records, now))) written.push(paths.genresFile);
}

/**
 * The playlist's songs with an artist and a title (from this run's read, else the published playlist.json), as
 * genre-lookup candidates beside the starter pack's.
 */
export function playlistSongs(videos: readonly { videoId: string; title?: string; artist?: string }[] | undefined, playlistText: string | undefined): Candidate[] {
  let list = videos;
  if (!list) {
    try {
      const v = (JSON.parse(playlistText ?? '{}') as { videos?: unknown }).videos;
      list = Array.isArray(v) ? (v as { videoId: string; title?: string; artist?: string }[]) : [];
    } catch {
      list = []; // no playlist.json
    }
  }
  const out: Candidate[] = [];
  for (const v of list) {
    if (!v || typeof v.videoId !== 'string' || typeof v.artist !== 'string' || typeof v.title !== 'string' || !v.artist.trim() || !v.title.trim()) continue;
    out.push({ videoId: v.videoId, title: v.title, artist: v.artist, origin: 'playlist' });
  }
  return out;
}

/** Songs a contributed map may belong to: starter pack, songs.json and the published playlist. */
export function knownSongs(starter: Candidate[], songs: AddedSong[], playlistText: string | undefined): KnownSongs {
  const ids = new Set<string>([...starter.map((c) => c.videoId), ...songs.map((s) => s.videoId)]);
  try {
    const videos = (JSON.parse(playlistText ?? '{}') as { videos?: unknown }).videos;
    if (Array.isArray(videos)) for (const v of videos) if (v && typeof (v as { videoId?: unknown }).videoId === 'string') ids.add((v as { videoId: string }).videoId);
  } catch {
    // no playlist.json
  }
  return { ids, durations: new Map(songs.filter((s) => s.durationSec > 0).map((s) => [s.videoId, s.durationSec])) };
}

/** Contributed-map mode (see contribute.ts): decide, write, and update index / songs files. No downloads. */
async function runContribution(
  paths: Paths,
  opts: RunOptions,
  deps: Deps,
  st: {
    existing: Map<string, MapInfo>;
    songs: AddedSong[];
    songsStatus: Record<string, RequestStatus>;
    prevSongsText: string | undefined;
    prevSongsStatusText: string | undefined;
    starter: Candidate[];
    indexPath: string;
    genreRecords: Readonly<Record<string, GenreRecord>>;
  },
): Promise<RunOutcome> {
  const written: string[] = [];
  const known = knownSongs(st.starter, st.songs, await readText(paths.playlistFile));
  const raw = parseContribution(opts.contributed ?? '');
  const peekId = raw && typeof raw === 'object' && typeof (raw as { videoId?: unknown }).videoId === 'string' ? (raw as { videoId: string }).videoId : '';
  const ex = /^[A-Za-z0-9_-]{11}$/.test(peekId) ? st.existing.get(peekId) : undefined;
  const decision = decideContribution(raw, known, ex ? { source: ex.source ?? 'cloud', span: ex.span ?? 0 } : undefined);
  const videoId = decision.kind === 'accept' ? decision.map.videoId : /^[A-Za-z0-9_-]{11}$/.test(peekId) ? peekId : undefined;
  deps.log(`contributed map${videoId ? ` for ${videoId}` : ''}: ${decision.kind}${decision.kind === 'accept' ? (decision.replaces ? ` (replaces the ${decision.replaces} map)` : '') : ` - ${decision.message}`}`);
  if (decision.kind === 'accept' && !opts.dryRun) {
    const map = decision.map;
    await mkdir(paths.beatmapsDir, { recursive: true });
    const out = join(paths.beatmapsDir, `${map.videoId}.json`);
    if (await writeIfChanged(out, `${serialize(map)}\n`)) written.push(out);
    const now = deps.now().toISOString();
    const maps = await scanMaps(paths.beatmapsDir);
    const prevIndexText = await readText(st.indexPath);
    applyGenreLists(st.songs, st.genreRecords);
    const listed = [...st.starter, ...playlistSongs(undefined, await readText(paths.playlistFile))];
    const idx = renderIndex(prevIndexText, ANALYZER_VERSION, maps, now, songGenres(st.songs, prevIndexText), songGenreLists(st.songs, listed, st.genreRecords, prevIndexText), songGenreMeta(st.songs, listed, st.genreRecords, prevIndexText));
    if (await writeIfChanged(st.indexPath, idx)) written.push(st.indexPath);
    await writeSongFiles(paths, { ...st, mapIds: new Set(maps.keys()), now, written });
  }
  const report: RunReport = {
    results: [],
    plan: { todo: 0, done: 0, waiting: 0, deferred: 0 },
    playlist: { configured: !!opts.playlistUrl, skipped: true },
    contribution: {
      ...(videoId ? { videoId } : {}),
      outcome: decision.kind === 'accept' ? 'accepted' : decision.kind === 'reject' ? 'rejected' : 'ignored',
      ...(decision.kind === 'accept' ? { source: decision.map.source, bpm: decision.map.bpm, ...(decision.replaces ? { replaces: decision.replaces } : {}) } : {}),
      message: decision.kind === 'accept' ? `${decision.map.beats.length} beats, ${Math.round(decision.map.duration)} s` : decision.message,
    },
    fatal: null,
    usedCookies: false,
    dryRun: opts.dryRun,
  };
  return { exitCode: 0, report, written };
}
