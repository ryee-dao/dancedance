/// <reference types="node" />
/**
 * Seeded random song sample for the song-style evaluation.
 *
 *   npx tsx tools/eval/sample.ts --seed 20261113 --out <dir>/sample.json [--known 20] [--obscure 20]
 *                                [--famous tools/eval/data/famous.json]
 *                                [--exclude a/sample.json,b/sample.json]
 *
 * Two halves:
 *   known    the dice pick a source (an iTunes genre chart or a genre / decade
 *            search term, spanning hip-hop, rock / metal, electronic, Latin,
 *            country, R&B, K-pop, ballads ...), then a random track from it;
 *   obscure  a random /usr/share/dict/words word as an iTunes search term,
 *            then a random result that is a studio track by an artist not in
 *            the `--famous` list (artists the judge would expect a casual
 *            listener to know; a pick by one of them is re-rolled and recorded).
 * --exclude: earlier samples; a pick of a song or an artist already in one of
 * them is re-rolled (recorded as "in an earlier sample"), so a new
 * measurement shares nothing with the sets the code was tuned on.
 * Skipped: spoken word, podcasts, karaoke / tribute / cover / medley / "in the style
 * of", sound effects, children's sing-alongs, fitness remixes, live, remix,
 * instrumental versions, tracks under 90 s or over 10 min. Every skip is
 * recorded in the output with its reason.
 *
 * Only the search text goes to iTunes, with default headers, >= 3.5 s apart,
 * backing off on 403 / 429. Same seed + same famous list = same sample
 * (as long as iTunes answers the same).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { arg, pick, politeJson, rng, type SampledSong, type SampleFile, type SkippedPick } from './common';

interface Track {
  trackId?: number;
  kind?: string;
  wrapperType?: string;
  artistName?: string;
  trackName?: string;
  collectionName?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  collectionArtistName?: string;
}

const seed = Number(arg('seed', '20261113'));
const out = arg('out');
const nKnown = Number(arg('known', '20'));
const nObscure = Number(arg('obscure', '20'));
const famousFile = arg('famous');
if (!out) {
  console.error('usage: tools/eval/sample.ts --seed N --out sample.json [--known 20] [--obscure 20] [--famous famous.json]');
  process.exit(1);
}
const excludeFiles = (arg('exclude') ?? '').split(',').filter(Boolean);
const famous = new Set<string>((famousFile ? (JSON.parse(readFileSync(famousFile, 'utf8')) as string[]) : []).map((a) => norm(a)));

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Sources for the known half: iTunes genre charts (country / genre id) and search terms. */
const CHARTS: [string, number | null][] = [
  ['us', 14], ['us', 18], ['us', 21], ['us', 20], ['us', 17], ['us', 7], ['us', 15], ['us', 6], ['us', 12], ['us', 51],
  ['us', 24], ['us', 10], ['us', 1153], ['us', 11], ['us', 22], ['mx', null], ['br', null], ['kr', null], ['gb', null], ['de', null], ['in', null],
];
const TERMS = [
  '70s hits', '80s hits', '90s hits', '2000s hits', '2010s hits', 'classic rock', 'heavy metal', 'old school hip hop', 'gangsta rap', 'trap',
  'reggaeton', 'salsa', 'bachata', 'cumbia', 'k-pop', 'disco classics', 'motown', 'love ballads', 'power ballads', 'country classics',
  'house music', 'techno', 'drum and bass', 'afrobeats', 'dancehall', 'bollywood', 'punk rock', 'slow jams', 'r&b classics', 'grunge',
  'eurodance', 'sertanejo', 'soul classics', 'emo', 'nu metal', 'synthpop', 'dubstep', 'jazz standards', 'blues', 'outlaw country',
];

const SKIP_GENRE = /spoken word|podcast|audiobook|children|kids|comedy|fitness|workout|karaoke|sound effect|nature|meditation|asmr|educational/i;
const SKIP_TEXT =
  /karaoke|\bmedley\b|tribute|in the style of|made famous|originally performed|cover version|\bcovers?\b|sing-?along|nursery|lullaby renditions|sound effects?|white noise|\blive\b|\bremix|\bmix\)|instrumental|re-?recorded|8-?bit|piano version|acoustic version|workout|bpm\)|sped up|slowed|speech|interview|commentary|chapter \d|audiobook|meditation|\d+\s*hz\b|\bhz\b|frequency zone|binaural|solfeggio|healing tones?|sleep music|parasympathetic|hypertension/i;

function why(t: Track): string | null {
  if (t.wrapperType !== 'track' || t.kind !== 'song') return `not a song (${t.kind ?? t.wrapperType ?? '?'})`;
  if (!t.artistName || !t.trackName || !t.trackId) return 'incomplete record';
  if (t.primaryGenreName && SKIP_GENRE.test(t.primaryGenreName)) return `genre ${t.primaryGenreName}`;
  const text = `${t.trackName} ${t.collectionName ?? ''} ${t.artistName}`;
  const m = SKIP_TEXT.exec(text);
  if (m) return `"${m[0]}" in title / album / artist`;
  const s = (t.trackTimeMillis ?? 0) / 1000;
  if (s < 90 || s > 600) return `length ${Math.round(s)} s`;
  return null;
}

function toSong(t: Track, half: SampledSong['half'], source: string): SampledSong {
  const year = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : undefined;
  return {
    key: String(t.trackId),
    half,
    artist: t.artistName!,
    title: t.trackName!,
    ...(t.collectionName ? { collection: t.collectionName } : {}),
    ...(t.primaryGenreName ? { genre: t.primaryGenreName } : {}),
    durationSec: Math.round((t.trackTimeMillis ?? 0) / 1000),
    ...(year && Number.isFinite(year) ? { releaseYear: year } : {}),
    source,
  };
}

const search = async (term: string, limit = 50) =>
  (((await politeJson(`https://itunes.apple.com/search?${new URLSearchParams({ term, entity: 'song', limit: String(limit) })}`)) as { results?: Track[] }).results ?? []);

async function chartIds(country: string, genre: number | null): Promise<string[]> {
  const url = `https://itunes.apple.com/${country}/rss/topsongs/limit=100${genre ? `/genre=${genre}` : ''}/json`;
  const feed = (await politeJson(url)) as { feed?: { entry?: unknown } };
  const raw = feed.feed?.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries.map((e) => (e as { id?: { attributes?: Record<string, string> } }).id?.attributes?.['im:id']).filter((x): x is string => !!x);
}

async function lookup(id: string, country: string): Promise<Track | null> {
  const r = (await politeJson(`https://itunes.apple.com/lookup?${new URLSearchParams({ id, country })}`)) as { results?: Track[] };
  return r.results?.[0] ?? null;
}

async function main() {
  const r = rng(seed);
  const songs: SampledSong[] = [];
  const skipped: SkippedPick[] = [];
  const have = new Set<string>();
  const artists = new Set<string>();
  const earlier = excludeFiles.flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as SampleFile).songs);
  const earlierKeys = new Set(earlier.map((x) => x.key));
  const earlierArtists = new Set(earlier.map((x) => norm(x.artist)));
  const accept = (t: Track, half: SampledSong['half'], source: string, obscure: boolean): boolean => {
    const w = why(t);
    if (w) {
      skipped.push({ source, artist: t.artistName, title: t.trackName, genre: t.primaryGenreName, why: w });
      return false;
    }
    const a = norm(t.artistName!);
    if (earlierKeys.has(String(t.trackId)) || earlierArtists.has(a)) {
      skipped.push({ source, artist: t.artistName, title: t.trackName, genre: t.primaryGenreName, why: 'in an earlier sample (song or artist)' });
      return false;
    }
    if (have.has(String(t.trackId)) || artists.has(a)) {
      skipped.push({ source, artist: t.artistName, title: t.trackName, genre: t.primaryGenreName, why: 'artist already sampled' });
      return false;
    }
    // Every credited name counts ("Lee Konitz & Miles Davis", "X feat. Y").
    const credited = [a, ...t.artistName!.split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\bwith\b|\band\b|\bx\b)\s*/i).map(norm).filter(Boolean)];
    if (obscure && credited.some((c) => [...famous].some((f) => c === f || (f.length >= 5 && c.startsWith(f))))) {
      skipped.push({ source, artist: t.artistName, title: t.trackName, genre: t.primaryGenreName, why: 'artist too well known for the obscure half' });
      return false;
    }
    songs.push(toSong(t, half, source));
    have.add(String(t.trackId));
    artists.add(a);
    console.error(`  + ${half} ${t.artistName} - ${t.trackName} [${t.primaryGenreName}] (${source})`);
    return true;
  };

  // --- Known half
  const chartCache = new Map<string, string[]>();
  const termCache = new Map<string, Track[]>();
  let tries = 0;
  while (songs.length < nKnown && tries++ < nKnown * 6) {
    if (r() < 0.5) {
      const [country, genre] = pick(r, CHARTS);
      const src = `chart ${country}${genre ? `/${genre}` : ''}`;
      const ck = `${country}/${genre}`;
      try {
        if (!chartCache.has(ck)) chartCache.set(ck, await chartIds(country, genre));
      } catch (e) {
        skipped.push({ source: src, why: `chart unavailable: ${(e as Error).message}` });
        chartCache.set(ck, []);
      }
      const ids = chartCache.get(ck)!;
      if (!ids.length) continue;
      const id = pick(r, ids);
      const t = await lookup(id, country).catch(() => null);
      if (!t) {
        skipped.push({ source: src, why: `lookup failed for ${id}` });
        continue;
      }
      accept(t, 'known', src, false);
    } else {
      const term = pick(r, TERMS);
      const src = `term '${term}'`;
      if (!termCache.has(term)) termCache.set(term, await search(term).catch(() => []));
      const list = termCache.get(term)!;
      if (!list.length) continue;
      accept(pick(r, list), 'known', src, false);
    }
  }

  // --- Obscure half
  const words = readFileSync('/usr/share/dict/words', 'utf8').split('\n').map((w) => w.trim()).filter((w) => /^[a-z]{4,12}$/.test(w));
  tries = 0;
  while (songs.length < nKnown + nObscure && tries++ < nObscure * 12) {
    const w = pick(r, words);
    const src = `word '${w}'`;
    const list = await search(w).catch(() => [] as Track[]);
    if (!list.length) {
      skipped.push({ source: src, why: 'no iTunes results' });
      continue;
    }
    // Up to three random draws from this word's results before rolling a new word.
    for (let k = 0; k < 3; k++) if (accept(pick(r, list), 'obscure', src, true)) break;
  }

  const file: SampleFile = { seed, createdAt: new Date().toISOString(), songs, skipped };
  writeFileSync(out!, `${JSON.stringify(file, null, 2)}\n`);
  console.error(`${songs.length} songs (${songs.filter((s) => s.half === 'known').length} known), ${skipped.length} skipped -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
