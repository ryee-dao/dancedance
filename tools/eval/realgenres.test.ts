/// <reference types="node" />
/**
 * Genre names -> dance sets on the recorded real songs, without audio or
 * network: every source's stored answer (genre-lookups.json) recombined with
 * the current src/genre rules, the analyser's recorded trait statistics
 * (stats.json) re-mapped with the current traitsFromStats, and the style the
 * app would resolve from them. Sets: run-20261115 (round two, 37 songs
 * analysed), its round1-rescore/ (round one looked up again, 30), and the
 * catalog's lookups (public/genres.json, ~100 songs, no audio).
 *
 * First the rules over every song (enough songs that a rule holding by luck
 * would show), then the round-two findings song by song, then the fixes that
 * came before them.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { traitsFromStats } from '../../src/core/analysis/traits';
import { styleGenres } from '../../src/core/choreo/generator';
import { resolveSongStyle, styleLabel, type SongStyle } from '../../src/core/choreo/songStyle';
import { combineGenres } from '../../src/genre/combine';
import { DEFAULT_SOURCES, recombineStored } from '../../src/genre/lookup';
import { isForm } from '../../src/genre/names';
import type { GenreLookup } from '../../src/genre/types';
import type { RecordedStats } from './stats';

const DATA = join(__dirname, 'data');
const ROUND2 = join(DATA, 'run-20261115');
const ROUND1 = join(ROUND2, 'round1-rescore');
const CATALOG = join(__dirname, '..', '..', 'public', 'genres.json');
const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

interface Song {
  key: string;
  name: string;
  genre?: string;
  lists: Awaited<ReturnType<typeof recombineStored>>;
  style: SongStyle;
  open: ReadonlySet<string>;
  label: string;
}

async function loadSet(dir: string): Promise<Song[]> {
  const sample = read<{ songs: { key: string; artist: string; title: string; genre?: string; durationSec: number }[] }>(join(dir, 'sample.json')).songs;
  const stats = read<RecordedStats>(join(dir, 'stats.json')).songs;
  const lookups = read<Record<string, GenreLookup>>(join(dir, 'genre-lookups.json'));
  const out: Song[] = [];
  for (const s of sample) {
    const st = stats[s.key];
    const l = lookups[s.key];
    if (!st || !l) continue;
    const lists = await recombineStored(l, { artist: s.artist, title: s.title, durationSec: s.durationSec });
    const style = resolveSongStyle(
      { title: s.title, artist: s.artist, genre: s.genre, genres: lists.genres, ...(lists.genreLevels ? { genreLevels: lists.genreLevels } : {}), ...(lists.artistGenres ? { artistGenres: lists.artistGenres } : {}) },
      { bpm: st.bpm, traits: traitsFromStats(st.stats) },
    );
    out.push({ key: s.key, name: `${s.artist} - ${s.title}`, genre: s.genre, lists, style, open: styleGenres(style), label: styleLabel(style) });
  }
  return out;
}

const have = existsSync(join(ROUND2, 'genre-lookups.json')) && existsSync(join(ROUND1, 'genre-lookups.json'));

describe.skipIf(!have)('recorded songs: genre names -> dance sets', () => {
  let round2: Song[] = [];
  let round1: Song[] = [];
  const by = (name: RegExp) => {
    const s = [...round2, ...round1].find((x) => name.test(x.name));
    if (!s) throw new Error(`no recorded song ${name}`);
    return s;
  };
  beforeAll(async () => {
    round2 = await loadSet(ROUND2);
    round1 = await loadSet(ROUND1);
  });

  it('loads enough songs for the rules to mean something', () => {
    expect(round2.length).toBeGreaterThanOrEqual(35);
    expect(round1.length).toBeGreaterThanOrEqual(30);
  });

  it('every list: genres first, at most one song form at the end, song level', () => {
    for (const s of [...round2, ...round1]) {
      const forms = s.lists.genres.map((g, i) => [g, i] as const).filter(([g]) => isForm(g));
      expect(forms.length, s.name).toBeLessThanOrEqual(1);
      for (const [, i] of forms) {
        expect(i, s.name).toBe(s.lists.genres.length - 1);
        expect(s.lists.genreLevels?.[i], s.name).toBe('song');
      }
    }
  });

  it('no song is led by an album genre that a single album source gives (catalog and both rounds)', () => {
    const catalog = existsSync(CATALOG) ? Object.values(read<{ songs: Record<string, GenreLookup> }>(CATALOG).songs) : [];
    const recs = [...catalog, ...Object.values(read<Record<string, GenreLookup>>(join(ROUND2, 'genre-lookups.json'))), ...Object.values(read<Record<string, GenreLookup>>(join(ROUND1, 'genre-lookups.json')))];
    expect(recs.length).toBeGreaterThan(100);
    const album = new Set(DEFAULT_SOURCES.filter((s) => s.level === 'album').map((s) => s.id));
    for (const r of recs) {
      if (!r.sources) continue;
      const c = combineGenres(r.sources, DEFAULT_SOURCES);
      const first = c.scored[0];
      if (!first || first.level === 'song') continue;
      const hasSong = c.scored.some((x) => x.level === 'song');
      if (hasSong) expect(first.by.filter((id) => album.has(id)).length, `${first.name} leads ${r.genres.join(', ')}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('jazz never opens disco & funk; C-pop never K-pop; plain folk never the folk-dance set', () => {
    for (const s of [...round2, ...round1]) {
      const names = [...s.lists.genres, s.genre ?? ''].join(' | ').toLowerCase();
      if (/jazz|swing|big band|\bbop\b/.test(names) && !/funk|disco|soul/.test(names)) expect(s.open.has('discofunk'), s.name).toBe(false);
      if (/c-pop|mandopop|cantopop/.test(names)) expect(s.open.has('kpop'), s.name).toBe(false);
      if (/\bfolk\b/.test(names) && !/celtic|polka|traditional|folklore|folk dance/.test(names)) expect(s.open.has('folk'), s.name).toBe(false);
    }
  });

  it('round two, song by song', () => {
    // A. Genre names that opened the wrong set.
    expect(by(/Desirae Garcia/).open.has('folk')).toBe(false);
    for (const re of [/Sentimental Mood/, /Lee Konitz/]) {
      expect(by(re).open.has('discofunk'), String(re)).toBe(false);
      expect(by(re).open.has('swing'), String(re)).toBe(true);
    }
    const sertanejo = by(/Peão Carreiro/);
    expect(sertanejo.open.has('brazil')).toBe(false);
    expect(sertanejo.open.has('country')).toBe(true);
    expect(by(/Wei Bi/).open.has('kpop')).toBe(false);
    expect(by(/Wei Bi/).label).toBe('C-pop');
    for (const re of [/Face to Face/, /Nacromatic/, /Underground Lovers/]) {
      expect(by(re).open.has('metal'), String(re)).toBe(false);
      expect(by(re).label, String(re)).not.toMatch(/Metal/);
    }
    expect(by(/Face to Face/).open.has('punk')).toBe(true);
    const abc = by(/Poison Arrow/);
    expect(abc.open.has('house')).toBe(false);
    expect(abc.open.has('edm')).toBe(false);
    expect(abc.open.has('discofunk')).toBe(true);
    // B. One junk word no longer opens a whole set.
    expect(by(/Hey Sexy Lady/).open.has('tango')).toBe(false);
    expect(by(/Hey Sexy Lady/).open.has('caribbean')).toBe(true);
    // C. Lookup combination.
    const celine = by(/Power of Love/);
    expect(celine.lists.genres[0]).not.toBe('new jack swing');
    expect(celine.lists.genres).toContain('ballad');
    expect(by(/I'm Yours/).lists.genres).toContain('reggae');
    expect(by(/I'm Yours/).open.has('swing')).toBe(false);
    const tony = by(/Tony Sunshine/);
    expect(tony.lists.genres[0]).toBe('reggaeton');
    expect(tony.open.has('reggaeton')).toBe(true);
    // Heavy names and heavy audio keep metal: nu metal, metal tags, and the bare "Rock" of a thrash band.
    for (const re of [/Deftones/, /STASIS/, /Saints Can Lie/]) expect(by(re).open.has('metal'), String(re)).toBe(true);
    expect(by(/Sky Church/).label).toMatch(/Metal/);
  });

  it('round one, re-looked-up: the earlier fixes hold', () => {
    // Labels and sets as the round-one rescore (results.json) had them: the round-two rules move none of them.
    const frozen = read<{ results: { song: { key: string }; b?: { style?: { label: string; open: string[] } } }[] }>(join(ROUND1, 'results.json')).results;
    let same = 0;
    for (const r of frozen) {
      const s = round1.find((x) => x.key === r.song.key);
      if (!s || !r.b?.style) continue;
      if (s.label === r.b.style.label && [...s.open].sort().join() === [...r.b.style.open].sort().join()) same++;
      else console.log(`[realgenres] round one changed: ${s.name}: ${r.b.style.label} [${r.b.style.open}] -> ${s.label} [${[...s.open]}]`);
    }
    expect(same).toBeGreaterThanOrEqual(28);
    // K-pop's scene leads; bachata and cumbia keep their dances.
    for (const s of round1) {
      if (s.lists.genres.slice(0, 3).some((g) => /^k-pop$/i.test(g)) && s.lists.genreLevels?.[s.lists.genres.findIndex((g) => /^k-pop$/i.test(g))] === 'song') expect(s.open.has('kpop'), s.name).toBe(true);
      if (/^bachata$/i.test(s.lists.genres[0] ?? '')) expect(s.open.has('bachata'), s.name).toBe(true);
      if (/^cumbia$/i.test(s.lists.genres[0] ?? '')) expect(s.open.has('cumbia'), s.name).toBe(true);
    }
  });

  it.skipIf(!existsSync(CATALOG))('catalog: We Found Love and Sorry do not lead with R&B', () => {
    const songs = read<{ songs: Record<string, GenreLookup & { title: string; artist: string }> }>(CATALOG).songs;
    for (const re of [/we found love/, /sorry/]) {
      const [k, r] = Object.entries(songs).find(([key]) => re.test(key))!;
      const l = combineGenres(r.sources, DEFAULT_SOURCES);
      expect(l.genres[0], k).not.toBe('R&B');
      const s = resolveSongStyle({ title: r.title, artist: r.artist, genres: l.genres, genreLevels: l.levels, artistGenres: l.artistGenres });
      expect(styleLabel(s), k).not.toMatch(/^R&B/);
    }
  });
});
