/// <reference types="node" />
/**
 * Land this run's generated JSON on top of a newer branch tip (the "Commit beat maps" step of
 * .github/workflows/beatmaps.yml, after its push was rejected because another run pushed first).
 *
 *   npx --no-install tsx tools/beatmaps/mergeData.ts --base <sha> --ours <sha> --theirs <sha>
 *
 * base   = the commit this run started from (the parent of its own commit)
 * ours   = this run's commit
 * theirs = the new branch tip; the working tree must be checked out at it
 *
 * A textual rebase conflicts whenever both runs touched the same aggregate file (every one carries
 * a timestamp, and two runs often add entries next to each other), and "take ours" / "take theirs"
 * would silently drop the other run's songs or maps. So this is a three-way merge of the data:
 *
 * - Map files (public/beatmaps/<videoId>.json) are one file per video: whichever side changed it,
 *   this run's version if both did. A map file one side deleted and the other changed is kept.
 * - Aggregates are merged entry by entry, keyed by what the pipeline keys them by:
 *     songs.json         songs[]   by songKey(artist, title)
 *     songs-status.json  requests  by song key
 *     beatmaps/status.json  videos by video id
 *     beatmaps/index.json   songs  by video id (ids is rebuilt from it, bpm/duration from the map file)
 *     genres.json        songs     by song key
 *   An entry only one side changed (added, edited, removed) takes that side's version; one both
 *   changed takes this run's version; one changed by one side and removed by the other is kept.
 *   Other top-level fields (playlist.json as a whole, analyzerVersion, ...) follow the same rule.
 * - The timestamp (updatedAt / generatedAt) is the later of the two sides' when the merged content
 *   differs from the tip, and the tip's bytes are kept when it does not.
 * - Then the rules the pipeline applies on every run are applied to the result, so it reads as if
 *   one run had made it: songs.json `hasMap` follows the map files, a 'map-pending' note goes once
 *   its song has a map (or is no longer listed), and a failed request goes once its song is listed.
 *
 * It refuses (exit 1 with an ::error line, writing nothing) rather than guess: unreadable JSON, a
 * collection that is not the expected shape, two songs.json entries with the same key, a path
 * outside the allowed set, or an index.json that would list a map file that does not exist.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { songKey } from '../../src/beat/cloud';

/** The only paths the job ever commits (the same list as the workflow's stage()). */
export const ALLOWED_PATH = /^public\/(beatmaps\/[A-Za-z0-9_-]+|playlist|songs|songs-status|genres)\.json$/;
const MAP_PATH = /^public\/beatmaps\/([A-Za-z0-9_-]+)\.json$/;

export class MergeError extends Error {}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

/** A file's three versions; undefined = the file does not exist on that side. */
export interface Versions {
  base?: string;
  ours?: string;
  theirs?: string;
}

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Order-insensitive for object keys (the pipeline sorts some), order-sensitive for arrays. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/**
 * Three-way choice for one value (undefined = absent). Only one side changed it: that side.
 * Both changed it: ours, except that a value one side removed and the other changed is kept.
 */
export function pick3<T>(base: T | undefined, ours: T | undefined, theirs: T | undefined): T | undefined {
  if (deepEqual(ours, theirs)) return ours;
  if (deepEqual(base, ours)) return theirs;
  if (deepEqual(base, theirs)) return ours;
  if (ours === undefined) return theirs;
  return ours;
}

/** Keyed collections merged entry by entry with pick3; keys come out sorted, as the pipeline writes them. */
export function mergeKeyed(base: Obj, ours: Obj, theirs: Obj): Obj {
  const out: Obj = {};
  const keys = [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])].sort();
  for (const k of keys) {
    const v = pick3(base[k], ours[k], theirs[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function parseJson(text: string | undefined, what: string): Json | undefined {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as Json;
  } catch (e) {
    throw new MergeError(`${what} is not valid JSON (${(e as Error).message})`);
  }
}

const TS_KEYS = ['updatedAt', 'generatedAt'] as const;

/** The keyed collection of each aggregate file, and how to turn it into / out of an object. */
interface Shape {
  field: string;
  /** songs.json keeps a list; the others an object keyed by id. */
  list?: (s: Obj) => string;
}

const songsListKey = (s: Obj) => {
  if (typeof s.artist !== 'string' || typeof s.title !== 'string') throw new MergeError('a songs.json entry has no artist or title');
  return songKey(s.artist, s.title);
};

export const SHAPES: Record<string, Shape> = {
  'public/songs.json': { field: 'songs', list: songsListKey },
  'public/songs-status.json': { field: 'requests' },
  'public/genres.json': { field: 'songs' },
  'public/beatmaps/status.json': { field: 'videos' },
  'public/beatmaps/index.json': { field: 'songs' },
  'public/playlist.json': { field: '' },
};

function collection(doc: Obj | undefined, shape: Shape, path: string, side: string): Obj {
  if (!doc || !shape.field) return {};
  const raw = doc[shape.field];
  if (raw === undefined) return {};
  if (shape.list) {
    if (!Array.isArray(raw)) throw new MergeError(`${path} (${side}): "${shape.field}" is not a list`);
    const out: Obj = {};
    for (const e of raw) {
      if (!isObj(e)) throw new MergeError(`${path} (${side}): an entry of "${shape.field}" is not an object`);
      const k = shape.list(e);
      if (k in out) throw new MergeError(`${path} (${side}): two entries for "${k}"`);
      out[k] = e;
    }
    return out;
  }
  if (!isObj(raw)) throw new MergeError(`${path} (${side}): "${shape.field}" is not an object`);
  return raw;
}

/** songs.json order: oldest first, then by key (songs.ts sortSongs), so appending never reorders. */
function songsList(byKey: Obj): Json[] {
  return Object.entries(byKey)
    .map(([k, s]) => ({ k, s: s as Obj, at: String((s as Obj).addedAt ?? '') }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.k.localeCompare(b.k)))
    .map((x) => x.s);
}

export function toJsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function laterTs(...ts: unknown[]): string | undefined {
  const s = ts.filter((x): x is string => typeof x === 'string' && Number.isFinite(Date.parse(x)));
  return s.length ? s.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : undefined;
}

/** Same content apart from the timestamp field. */
function sameButTs(a: Obj, b: Obj): boolean {
  const strip = (o: Obj) => Object.fromEntries(Object.entries(o).filter(([k]) => !(TS_KEYS as readonly string[]).includes(k)));
  return deepEqual(strip(a), strip(b));
}

/** Render a merged document: the tip's bytes when nothing differs from it, else with the later timestamp. */
export function renderMerged(doc: Obj, theirsText: string | undefined, ...stamps: unknown[]): string {
  const theirs = theirsText === undefined ? undefined : (JSON.parse(theirsText) as Obj);
  if (theirs && sameButTs(doc, theirs)) return theirsText!;
  const out: Obj = {};
  const tsKey = TS_KEYS.find((k) => k in doc);
  for (const [k, v] of Object.entries(doc)) out[k] = k === tsKey ? (laterTs(v, ...stamps) ?? v) : v;
  return toJsonText(out);
}

/**
 * Merge one aggregate file. Returns the new text, or undefined when the file should not exist.
 * Only called when both sides changed it.
 */
export function mergeAggregate(path: string, v: Versions): string | undefined {
  const shape = SHAPES[path];
  if (!shape) throw new MergeError(`${path}: no merge rule for this file`);
  const docs = (['base', 'ours', 'theirs'] as const).map((side) => {
    const d = parseJson(v[side], `${path} (${side})`);
    if (d !== undefined && !isObj(d)) throw new MergeError(`${path} (${side}) is not a JSON object`);
    return d as Obj | undefined;
  });
  const [base, ours, theirs] = docs;
  if (!ours || !theirs) {
    // One side deleted a whole aggregate the other changed: nothing the job does, so do not guess.
    throw new MergeError(`${path}: one side deleted the file and the other changed it`);
  }
  const b = base ?? {};
  const merged = shape.field
    ? mergeKeyed(collection(base, shape, path, 'base'), collection(ours, shape, path, 'ours'), collection(theirs, shape, path, 'theirs'))
    : {};
  const isIndex = path === 'public/beatmaps/index.json';
  // Fields in this run's order, then any only the tip has.
  const out: Obj = {};
  for (const k of [...Object.keys(ours), ...Object.keys(theirs).filter((x) => !(x in ours))]) {
    let val: Json | undefined;
    if (shape.field && k === shape.field) val = shape.list ? songsList(merged) : merged;
    else if (isIndex && k === 'ids') val = Object.keys(merged).sort(); // rebuilt from songs, as renderIndex does
    else if ((TS_KEYS as readonly string[]).includes(k)) val = laterTs(ours[k], theirs[k]) ?? ours[k] ?? theirs[k];
    else val = pick3(b[k], ours[k], theirs[k]);
    if (val !== undefined) out[k] = val;
  }
  return renderMerged(out, v.theirs);
}

/** Merge one map file. Undefined = deleted. */
export function mergeMapFile(path: string, v: Versions): string | undefined {
  const id = MAP_PATH.exec(path)?.[1];
  for (const side of ['ours', 'theirs'] as const) {
    const d = parseJson(v[side], `${path} (${side})`);
    if (d !== undefined && (!isObj(d) || d.videoId !== id)) throw new MergeError(`${path} (${side}) is not a beat map for ${id}`);
  }
  // Compared as text: a map file is written once, as a whole.
  if (v.ours === v.theirs) return v.ours;
  if (v.base === v.ours) return v.theirs;
  if (v.base === v.theirs) return v.ours;
  return v.ours ?? v.theirs;
}

/**
 * What the pipeline would do to this tree on its next run, so that files from the two sides agree:
 * hasMap follows the map files, map-pending notes go once mapped (or unlisted), failed requests go
 * once their song is listed. Returns only the files that change.
 */
export function applyPipelineRules(files: { songs?: string; songsStatus?: string }, hasMapFile: (id: string) => boolean, stamp: string): { songs?: string; songsStatus?: string } {
  const out: { songs?: string; songsStatus?: string } = {};
  const songsDoc = parseJson(files.songs, 'public/songs.json');
  const listed = new Map<string, string>(); // songKey -> videoId
  if (songsDoc !== undefined) {
    if (!isObj(songsDoc) || !Array.isArray(songsDoc.songs)) throw new MergeError('public/songs.json has no songs list');
    const before = JSON.stringify(songsDoc.songs);
    for (const s of songsDoc.songs) {
      if (!isObj(s) || typeof s.videoId !== 'string') throw new MergeError('public/songs.json has an entry without a videoId');
      listed.set(songsListKey(s), s.videoId);
      s.hasMap = hasMapFile(s.videoId);
    }
    if (JSON.stringify(songsDoc.songs) !== before) out.songs = renderMerged(songsDoc, undefined, stamp);
  }
  const statusDoc = parseJson(files.songsStatus, 'public/songs-status.json');
  if (statusDoc !== undefined) {
    if (!isObj(statusDoc) || !isObj(statusDoc.requests)) throw new MergeError('public/songs-status.json has no requests object');
    const reqs = statusDoc.requests;
    const listedIds = new Set(listed.values());
    let changed = false;
    for (const [key, r] of Object.entries(reqs)) {
      if (!isObj(r)) continue;
      const pending = r.state === 'map-pending';
      const drop = pending
        ? typeof r.videoId !== 'string' || hasMapFile(r.videoId) || (songsDoc !== undefined && !listedIds.has(r.videoId))
        : listed.has(key);
      if (drop) {
        delete reqs[key];
        changed = true;
      }
    }
    if (changed) out.songsStatus = renderMerged(statusDoc, undefined, stamp);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Git side (thin; the merging above is pure)

export interface Git {
  /** File text at a commit, or undefined when it does not exist there. */
  show(rev: string, path: string): string | undefined;
  /** Paths changed between two commits (both trees must be present; no merge base needed). */
  changed(from: string, to: string): string[];
}

export function gitCli(cwd: string): Git {
  const run = (args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    show(rev, path) {
      try {
        run(['cat-file', '-e', `${rev}:${path}`]);
      } catch {
        return undefined;
      }
      return run(['show', `${rev}:${path}`]);
    },
    changed(from, to) {
      return run(['diff', '--name-only', '--no-renames', '-z', from, to, '--', 'public']).split('\0').filter(Boolean);
    },
  };
}

export interface LandResult {
  /** Path -> new text (undefined = delete). */
  writes: Map<string, string | undefined>;
  notes: string[];
}

/**
 * Work out the files to write over a checkout of `theirs` so it carries this run's work too:
 * every path this run changed, merged with the tip's version where the tip changed it too.
 */
export function planLanding(git: Git, revs: { base: string; ours: string; theirs: string }): LandResult {
  const notes: string[] = [];
  const ourPaths = git.changed(revs.base, revs.ours);
  const theirPaths = new Set(git.changed(revs.base, revs.theirs));
  const bad = ourPaths.filter((p) => !ALLOWED_PATH.test(p));
  if (bad.length) throw new MergeError(`this run's commit changes files other than beat-map JSON: ${bad.slice(0, 5).join(', ')}`);
  const writes = new Map<string, string | undefined>();
  const versions = (p: string): Versions => ({ base: git.show(revs.base, p), ours: git.show(revs.ours, p), theirs: git.show(revs.theirs, p) });

  // Map files first: the aggregates' checks depend on which maps exist.
  const maps = ourPaths.filter((p) => MAP_PATH.test(p) && !SHAPES[p]);
  const aggregates = ourPaths.filter((p) => SHAPES[p]);
  for (const p of maps) {
    const v = versions(p);
    if (!theirPaths.has(p)) writes.set(p, v.ours);
    else {
      const r = mergeMapFile(p, v);
      if (v.ours !== undefined && v.theirs !== undefined && v.ours !== v.theirs && v.base !== v.theirs) notes.push(`${p}: both sides wrote this map; keeping this run's`);
      writes.set(p, r);
    }
  }
  for (const p of aggregates) {
    const v = versions(p);
    if (!theirPaths.has(p)) writes.set(p, v.ours);
    else {
      writes.set(p, mergeAggregate(p, v));
      notes.push(`${p}: merged entry by entry`);
    }
  }
  return { writes, notes };
}

/** The checks that must hold after landing; throws MergeError otherwise. */
export function checkTree(read: (p: string) => string | undefined, addedMaps: Iterable<string>): void {
  const indexText = read('public/beatmaps/index.json');
  const index = parseJson(indexText, 'public/beatmaps/index.json');
  if (index === undefined) return;
  if (!isObj(index) || !Array.isArray(index.ids) || !isObj(index.songs)) throw new MergeError('public/beatmaps/index.json has no ids list or songs object');
  const ids = index.ids as Json[];
  if (!deepEqual([...Object.keys(index.songs)].sort(), ids)) throw new MergeError('public/beatmaps/index.json: ids and songs disagree');
  for (const id of ids) {
    if (typeof id !== 'string' || read(`public/beatmaps/${id}.json`) === undefined) throw new MergeError(`public/beatmaps/index.json lists ${String(id)}, which has no map file`);
  }
  const listed = new Set(ids as string[]);
  for (const p of addedMaps) {
    const id = MAP_PATH.exec(p)?.[1];
    if (id && !SHAPES[p] && read(p) !== undefined && !listed.has(id)) throw new MergeError(`${p} exists but public/beatmaps/index.json does not list it`);
  }
}

/** index.json bpm/duration follow the map file (only for maps whose winner differs from the tip). */
export function syncIndexWithMaps(indexText: string, mapTexts: Map<string, string>, stamp: string): string {
  const index = JSON.parse(indexText) as Obj;
  const songs = index.songs as Obj;
  let changed = false;
  for (const [id, text] of mapTexts) {
    const e = songs[id];
    if (!isObj(e)) continue;
    const m = JSON.parse(text) as Obj;
    if (typeof m.bpm !== 'number' || typeof m.duration !== 'number') continue;
    const bpm = Math.round(m.bpm * 10) / 10;
    const duration = Math.round(m.duration);
    if (e.bpm !== bpm || e.duration !== duration) {
      e.bpm = bpm;
      e.duration = duration;
      changed = true;
    }
  }
  return changed ? renderMerged(index, undefined, stamp) : indexText;
}

function main(argv: string[]): number {
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    const v = i >= 0 ? argv[i + 1] : undefined;
    if (!v || !/^[0-9a-f]{7,64}$/i.test(v)) throw new MergeError(`${k} <commit sha> is required`);
    return v;
  };
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const git = gitCli(root);
  const revs = { base: arg('--base'), ours: arg('--ours'), theirs: arg('--theirs') };
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const theirsFull = execFileSync('git', ['rev-parse', revs.theirs], { cwd: root, encoding: 'utf8' }).trim();
  if (head !== theirsFull) throw new MergeError(`the checkout must be at --theirs (${theirsFull}), not ${head}`);

  const { writes, notes } = planLanding(git, revs);
  // Everything is decided and checked in memory first; nothing is written if anything fails.
  const tree = new Map(writes);
  const read = (p: string) => (tree.has(p) ? tree.get(p) : existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : undefined);
  const stamp = laterTs(...[...writes.values()].map((t) => {
    try {
      const d = t === undefined ? undefined : (JSON.parse(t) as Obj);
      return d?.updatedAt ?? d?.generatedAt;
    } catch {
      return undefined;
    }
  })) ?? new Date().toISOString();

  // Maps whose final text differs from the tip's: their index entry follows the map.
  const mapWinners = new Map<string, string>();
  for (const [p, t] of writes) {
    const id = MAP_PATH.exec(p)?.[1];
    if (id && !SHAPES[p] && t !== undefined && t !== git.show(revs.theirs, p)) mapWinners.set(id, t);
  }
  const idx = read('public/beatmaps/index.json');
  if (idx !== undefined && mapWinners.size) {
    const synced = syncIndexWithMaps(idx, mapWinners, stamp);
    if (synced !== idx) tree.set('public/beatmaps/index.json', synced);
  }
  const fixed = applyPipelineRules({ songs: read('public/songs.json'), songsStatus: read('public/songs-status.json') }, (id) => read(`public/beatmaps/${id}.json`) !== undefined, stamp);
  if (fixed.songs !== undefined) tree.set('public/songs.json', fixed.songs);
  if (fixed.songsStatus !== undefined) tree.set('public/songs-status.json', fixed.songsStatus);

  const addedMaps = [...git.changed(revs.base, revs.ours), ...git.changed(revs.base, revs.theirs)].filter((p) => MAP_PATH.test(p));
  checkTree(read, addedMaps);
  for (const [p, t] of tree) if (t !== undefined) parseJson(t, p); // never write invalid JSON

  for (const [p, t] of tree) {
    const abs = join(root, p);
    if (t === undefined) rmSync(abs, { force: true });
    else writeFileSync(abs, t, 'utf8');
  }
  for (const n of notes) console.log(n);
  console.log(`Landed ${tree.size} file(s) of this run on top of ${theirsFull.slice(0, 7)}.`);
  return 0;
}

// Real paths on both sides, so a symlinked checkout still runs it (a silent no-op would lose work).
const isMain = !!process.argv[1] && existsSync(process.argv[1]) && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    const msg = (e as Error).message.replace(/\r?\n/g, ' ');
    console.log(`::error title=Could not merge with the newer commit::${e instanceof MergeError ? msg : `merge crashed: ${msg}`}. This run's work was not pushed.`);
    process.exitCode = 1;
  }
}
