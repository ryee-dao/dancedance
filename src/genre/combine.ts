/**
 * Combine what the sources said into ordered genre lists, by agreement, level
 * by level.
 *
 * Levels (types.ts): what a source says about the song itself outranks what
 * is said about its album, which outranks what is said about the artist.
 * Artist genres form their own list (`artistGenres`) and never enter
 * `genres`.
 *
 * 1. Names are put in the common spelling (names.ts).
 * 2. Junk control:
 *    - a crowd tag (MusicBrainz) with a single vote counts only when another
 *      source reports the same genre or a narrower form of it;
 *    - a name whose broad family (rock, pop/dance, urban, country...) agrees
 *      with no other source, when at least two other source groups do say
 *      something placeable, counts CONTRA_SHARE;
 *    - a song (or album) answer that only repeats what the same site says
 *      about the artist, when other sites give the artist that genre too,
 *      is the artist's genre copied onto the track: it counts
 *      echoShare(site) (see ECHO_RATES).
 * 3. Support of a genre g at the song level:
 *      song sources reporting g exactly add weight x factors; reporting a
 *      broader or narrower form add RELATED_SHARE x that; album sources add
 *      ALBUM_SHARE x the same; within one group of related sources
 *      (Wikipedia + Wikidata) only the strongest counts in full, others half.
 *    Score = support + SPEC_WEIGHT x specificity (0..1, from the generated
 *    Wikidata genre graph and the hand tree, names.ts genreSpecificity)
 *    + up to 0.1 for being listed early.
 * 4. The song list holds the genres song sources reported, plus album
 *    genres that narrow one of them ("cumbia" on the album of a song the
 *    store calls "Música tropical"). Then come the other album genres.
 * 5. Umbrella rule: an umbrella (specificity under UMBRELLA_SPEC: pop, rock,
 *    hip hop, R&B, Latin, electronic...) is never ranked above a narrower
 *    form of itself that has credible direct support: one credible song-level source
 *    (CREDIBLE), or two album-level sources (CREDIBLE_ALBUM). So "K-pop" is
 *    not buried under "pop" just because more sources repeat "pop", and an
 *    album two sources call bachata puts "bachata" above the store's
 *    "Música tropical".
 * 6. Album support never lifts a song-level umbrella over the song's own
 *    specific names. Album sources agree most on the album's (and the
 *    artist's) broad genre: R&B for a Rihanna or Justin Bieber album. Added
 *    to the R&B a song source also lists, that put "R&B" above "electro
 *    house" on We Found Love and above "dancehall pop" on Sorry. So when the
 *    song sources report any non-umbrella genre, an umbrella they report is
 *    scored on song-level support only. Album support still counts for every
 *    non-umbrella genre (it confirms "tropical house", it adds "bachata"), and
 *    in full when the song sources only say umbrellas (a store's "Música
 *    tropical": rule 5 decides there).
 *
 * Genres are only ever taken from what a source said exactly; relations
 * only add weight.
 */
import { broaderThan, canonicalGenre, displayName, families, genreSpecificity, related } from './names';
import type { GenreLevel, GenreSource, SourceId, SourceOutcome } from './types';

export const MAX_GENRES = 6;
export const MAX_ARTIST_GENRES = 4;
export const RELATED_SHARE = 0.3;
export const SAME_GROUP_SHARE = 0.5;
export const ALBUM_SHARE = 0.3;
export const SPEC_WEIGHT = 0.6;
export const CONTRA_SHARE = 0.3;
/** The last of a source's n names counts 1 - POSITION_DECAY x (n-1)/n of the first. */
export const POSITION_DECAY = 0.3;

/** The two ranking weights, overridable for measurements (tools/beatmaps/genreMeasure.ts --grid). */
export interface RankWeights {
  specWeight: number;
  positionDecay: number;
  albumShare: number;
  umbrellaSpec: number;
}
/** Specificity below which a genre is an umbrella (pop 0.25, rock 0.2, R&B 0.33, Latin 0.1; funk 0.4, metal 0.38 are not). */
export const UMBRELLA_SPEC = 0.35;
export const DEFAULT_WEIGHTS: RankWeights = { specWeight: SPEC_WEIGHT, positionDecay: POSITION_DECAY, albumShare: ALBUM_SHARE, umbrellaSpec: UMBRELLA_SPEC };
/** Direct album support (before ALBUM_SHARE) from which an album genre outranks the song genre it narrows: two album sources. */
export const CREDIBLE_ALBUM = 1.5;
/** Direct song-level support from which a narrow genre outranks its umbrella (one encyclopedia, or MusicBrainz tags). */
export const CREDIBLE = 0.45;
/**
 * How often each site's song answer is its artist answer repeated, measured
 * on the 102-song catalog (`backfillGenreLists.ts --echo`). A site that does
 * so on at least ECHO_MIN of its songs is taken to copy the artist's genre
 * onto tracks: there, an echoed song answer counts only 1 - rate (at least
 * ECHO_FLOOR). Below ECHO_MIN a match is just a song in its artist's usual
 * genre (MusicBrainz users tag recordings themselves) and counts in full.
 */
export const ECHO_RATES: Partial<Record<SourceId, number>> = {
  // measured 2026-11-14 on the catalog (songs where both answers were found)
  musicbrainz: 0.3, // 30/99
  theaudiodb: 0.83, // 73/88
  itunes: 0.9, // 88/98
  'itunes-album': 0.89, // 82/92
};
export const ECHO_MIN = 0.7;
export const ECHO_FLOOR = 0.1;

export function echoShare(id: SourceId): number {
  const rate = ECHO_RATES[id];
  if (rate === undefined || rate < ECHO_MIN) return 1;
  return Math.max(ECHO_FLOOR, 1 - rate);
}

export interface ScoredGenre {
  name: string;
  key: string;
  score: number;
  level: GenreLevel;
  /** Sources that reported this genre exactly (and counted). */
  by: SourceId[];
}

export interface Combined {
  /** About the song: song level first, then album level. */
  genres: string[];
  levels: GenreLevel[];
  artistGenres: string[];
  moods: string[];
  scored: ScoredGenre[];
  artistScored: ScoredGenre[];
}

type SourceInfo = Pick<GenreSource, 'id' | 'group' | 'weight' | 'strictNames' | 'level' | 'artistTwin'>;

interface Entry {
  key: string;
  /** Position share 1 (first) .. ~0 (last). */
  early: number;
  /** Votes, for crowd tags. */
  count?: number;
  /** Multiplier from the junk and echo rules. */
  factor: number;
}

interface SourceList {
  src: SourceInfo;
  entries: Entry[];
  echo: boolean;
}

/** A source's names -> canonical entries in order (compound labels split), keeping vote counts. */
export function sourceEntries(o: Extract<SourceOutcome, { status: 'found' }>, strict = false, positionDecay = POSITION_DECAY): Entry[] {
  const out: Entry[] = [];
  const seen = new Map<string, Entry>();
  o.genres.forEach((raw, i) => {
    if (typeof raw !== 'string') return;
    const whole = canonicalGenre(raw, strict);
    const parts = whole?.known || !/[/]/.test(raw) ? [whole] : raw.split('/').map((p) => canonicalGenre(p, strict));
    for (const g of parts) {
      if (!g) continue;
      const count = o.counts?.[i];
      const had = seen.get(g.key);
      if (had) {
        if (count !== undefined) had.count = (had.count ?? 0) + count;
        continue;
      }
      const e: Entry = { key: g.key, early: 0, factor: 1, ...(count !== undefined ? { count } : {}) };
      seen.set(g.key, e);
      out.push(e);
    }
  });
  out.forEach((e, i) => {
    e.early = 1 - i / out.length;
    // Sources list the main genre first (infoboxes, Discogs styles, tags by votes): later names count a little less.
    e.factor *= 1 - positionDecay * (i / out.length);
  });
  return out;
}

/**
 * Broad families grouped for the "do the sources even agree?" check: rock,
 * metal and punk are one camp; pop, dance, electronic and disco another; hip
 * hop, R&B, soul, funk and gospel another; country, folk and blues another.
 * "alternative" says too little to disagree with anything.
 */
const CAMP: Record<string, string> = {
  rock: 'rock', metal: 'rock', punk: 'rock', industrial: 'rock',
  pop: 'pop', dance: 'pop', electronic: 'pop', disco: 'pop',
  'hip hop': 'urban', 'r&b': 'urban', soul: 'urban', funk: 'urban', gospel: 'urban',
  country: 'country', folk: 'country', blues: 'country',
};

function camps(key: string): Set<string> {
  return new Set(families(key).filter((f) => f !== 'alternative').map((f) => CAMP[f] ?? f));
}

function readLists(outcomes: Partial<Record<SourceId, SourceOutcome>>, sources: readonly SourceInfo[], positionDecay = POSITION_DECAY): SourceList[] {
  const lists: SourceList[] = [];
  for (const src of sources) {
    const o = outcomes[src.id];
    if (o?.status !== 'found') continue;
    const entries = sourceEntries(o, src.strictNames, positionDecay);
    if (entries.length) lists.push({ src, entries, echo: false });
  }
  return lists;
}

/** Apply the junk and echo rules in place; drops uncorroborated single-vote crowd tags. */
function control(lists: SourceList[]): void {
  const byId = new Map(lists.map((l) => [l.src.id, l]));
  const tier = (l: SourceList) => (l.src.level === 'artist' ? 'artist' : 'song');
  // Single votes need another source.
  for (const l of lists) {
    if (!l.src.strictNames) continue;
    l.entries = l.entries.filter((e) => {
      if (e.count === undefined || e.count > 1) return true;
      // The same genre or a narrower form of it; a broader report ("pop" for "dream pop") says too little.
      return lists.some((m) => m !== l && tier(m) === tier(l) && m.entries.some((x) => x.key === e.key || broaderThan(e.key, x.key)));
    });
  }
  // Echo of the same site's artist answer: every song genre is the site's artist genre. A genre that
  // other sites also give the artist is the artist's known genre copied onto the track; one no
  // other site gives the artist was set for this release (store labels are set per release).
  for (const l of lists) {
    if (l.src.level === 'artist' || !l.src.artistTwin) continue;
    const twin = byId.get(l.src.artistTwin);
    if (!twin) continue;
    const keys = new Set(twin.entries.map((e) => e.key));
    if (!l.entries.every((e) => keys.has(e.key))) continue;
    l.echo = true;
    const elsewhere = new Set(lists.filter((m) => m.src.level === 'artist' && m.src.group !== twin.src.group).flatMap((m) => m.entries.map((e) => e.key)));
    for (const e of l.entries) if (elsewhere.has(e.key)) e.factor *= echoShare(l.src.id);
  }
  // Family that no other source group shares.
  for (const t of ['song', 'artist'] as const) {
    const inTier = lists.filter((l) => tier(l) === t);
    for (const l of inTier) {
      const others = new Map<string, Set<string>>();
      for (const m of inTier) {
        if (m.src.group === l.src.group) continue;
        const set = others.get(m.src.group) ?? new Set<string>();
        for (const e of m.entries) for (const c of camps(e.key)) set.add(c);
        others.set(m.src.group, set);
      }
      const placed = [...others.values()].filter((s) => s.size > 0);
      if (placed.length < 2) continue;
      for (const e of l.entries) {
        const mine = camps(e.key);
        if (mine.size && !placed.some((s) => [...mine].some((c) => s.has(c)))) e.factor *= CONTRA_SHARE;
      }
    }
  }
  for (const l of lists) l.entries = l.entries.filter((e) => e.factor > 0);
}

interface Support {
  total: number;
  direct: number;
  early: number;
  by: SourceId[];
}

/** Support of `g` from `lists`, scaled by `share`; within a group only the strongest counts in full. */
function support(g: string, lists: readonly SourceList[], share: number): Support {
  const byGroup = new Map<string, { v: number; direct: number }[]>();
  const by: SourceId[] = [];
  let early = 0;
  for (const { src, entries } of lists) {
    const exact = entries.find((e) => e.key === g);
    let v = 0;
    let direct = 0;
    if (exact) {
      v = direct = src.weight * exact.factor;
      by.push(src.id);
      early = Math.max(early, exact.early);
    } else {
      const rel = entries.filter((e) => related(e.key, g));
      if (rel.length) v = RELATED_SHARE * src.weight * Math.max(...rel.map((e) => e.factor));
    }
    if (v > 0) byGroup.set(src.group, [...(byGroup.get(src.group) ?? []), { v, direct }]);
  }
  let total = 0;
  let dir = 0;
  for (const list of byGroup.values()) {
    list.sort((a, b) => b.v - a.v);
    list.forEach((x, i) => {
      const k = i === 0 ? 1 : SAME_GROUP_SHARE;
      total += x.v * k;
      dir += x.direct * k;
    });
  }
  return { total: total * share, direct: dir * share, early, by };
}

/** Move every umbrella below the narrower forms of itself that have credible direct support. */
export function umbrellasLast<T extends { key: string }>(list: T[], credible: (x: T) => boolean, umbrellaSpec = UMBRELLA_SPEC): T[] {
  const out = [...list];
  for (let guard = 0; guard < out.length * out.length; guard++) {
    let moved = false;
    for (let i = 0; i < out.length && !moved; i++) {
      for (let j = out.length - 1; j > i; j--) {
        if (credible(out[j]) && genreSpecificity(out[i].key) < umbrellaSpec && broaderThan(out[i].key, out[j].key)) {
          const [u] = out.splice(i, 1);
          out.splice(j, 0, u);
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }
  return out;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

export function combineGenres(outcomes: Partial<Record<SourceId, SourceOutcome>>, sources: readonly SourceInfo[], max = MAX_GENRES, w: RankWeights = DEFAULT_WEIGHTS): Combined {
  const lists = readLists(outcomes, sources, w.positionDecay);
  control(lists);
  const moods: string[] = [];
  for (const src of sources) {
    const o = outcomes[src.id];
    if (o?.status !== 'found') continue;
    for (const m of o.moods ?? []) {
      const t = m.replace(/\s+/g, ' ').trim().toLowerCase();
      if (t && t.length <= 40 && /\p{L}{2}/u.test(t) && !moods.includes(t)) moods.push(t);
    }
  }
  const song = lists.filter((l) => l.src.level === 'song');
  const album = lists.filter((l) => l.src.level === 'album');
  const artist = lists.filter((l) => l.src.level === 'artist');

  const songKeys = new Set(song.flatMap((l) => l.entries.map((e) => e.key)));
  const albumKeys = new Set(album.flatMap((l) => l.entries.map((e) => e.key)));
  // Album genres that narrow a genre the song sources reported join the song list.
  const refining = [...albumKeys].filter((a) => !songKeys.has(a) && [...songKeys].some((s) => broaderThan(s, a)));
  const songTier = new Set([...songKeys, ...refining]);
  const songSpecific = [...songKeys].some((k) => genreSpecificity(k) >= w.umbrellaSpec);

  interface Cand extends ScoredGenre {
    songDirect: number;
    albumDirect: number;
  }
  const scoreOf = (g: string, level: GenreLevel): Cand => {
    const s = support(g, song, 1);
    const a = support(g, album, w.albumShare);
    // Rule 6: beside a specific song-level name, a song-level umbrella is ranked on what the song sources say alone.
    const albumCounts = !(level === 'song' && songSpecific && genreSpecificity(g) < w.umbrellaSpec);
    const score = s.total + (albumCounts ? a.total : 0) + w.specWeight * genreSpecificity(g) + 0.1 * Math.max(s.early, a.early);
    return { name: displayName(g), key: g, score: round(score), level, by: [...s.by, ...a.by], songDirect: s.direct, albumDirect: a.direct / w.albumShare };
  };
  const credible = (x: Cand) => x.songDirect >= CREDIBLE || x.albumDirect >= CREDIBLE_ALBUM;
  const order = (xs: Cand[]) => umbrellasLast(xs.sort((a, b) => b.score - a.score || b.by.length - a.by.length || a.key.localeCompare(b.key)), credible, w.umbrellaSpec);
  const songList = order([...songTier].map((g) => scoreOf(g, songKeys.has(g) ? 'song' : 'album')));
  const albumList = order([...albumKeys].filter((g) => !songTier.has(g)).map((g) => scoreOf(g, 'album')));
  const scored: ScoredGenre[] = [...songList, ...albumList].map(({ songDirect: _s, albumDirect: _a, ...x }) => x);
  const top = scored.slice(0, max);

  const artistKeys = new Set(artist.flatMap((l) => l.entries.map((e) => e.key)));
  const artistScored = umbrellasLast(
    [...artistKeys]
      .map((g) => {
        const s = support(g, artist, 1);
        return { name: displayName(g), key: g, score: round(s.total + 0.5 * w.specWeight * genreSpecificity(g) + 0.1 * s.early), level: 'artist' as const, by: s.by, direct: s.direct };
      })
      .sort((a, b) => b.score - a.score || b.by.length - a.by.length || a.key.localeCompare(b.key)),
    (x) => x.direct >= CREDIBLE,
    w.umbrellaSpec,
  ).map(({ direct: _d, ...x }) => x);

  return {
    genres: top.map((s) => s.name),
    levels: top.map((s) => s.level),
    artistGenres: artistScored.slice(0, MAX_ARTIST_GENRES).map((s) => s.name),
    moods,
    scored,
    artistScored,
  };
}

/** Broad families (pop, rock, hip hop...) each found source's genres belong to. */
export function sourceFamilies(outcomes: Partial<Record<SourceId, SourceOutcome>>, sources: readonly SourceInfo[]): Map<SourceId, Set<string>> {
  const out = new Map<SourceId, Set<string>>();
  for (const l of readLists(outcomes, sources)) {
    const fams = new Set<string>();
    for (const e of l.entries) for (const f of families(e.key)) fams.add(f);
    if (fams.size) out.set(l.src.id, fams);
  }
  return out;
}

/** Pairs of song-level sources whose genres fall in no common camp at all (e.g. one says "rock", another "hip hop"). */
export function familyDisagreements(outcomes: Partial<Record<SourceId, SourceOutcome>>, sources: readonly SourceInfo[]): [SourceId, SourceId][] {
  const fams = [...sourceFamilies(outcomes, sources.filter((s) => (s.level ?? 'song') === 'song')).entries()]
    .map(([id, set]) => [id, new Set([...set].filter((f) => f !== 'alternative').map((f) => CAMP[f] ?? f))] as const)
    .filter(([, set]) => set.size > 0);
  const out: [SourceId, SourceId][] = [];
  for (let i = 0; i < fams.length; i++) {
    for (let j = i + 1; j < fams.length; j++) {
      const [a, fa] = fams[i];
      const [b, fb] = fams[j];
      if (![...fa].some((f) => fb.has(f))) out.push([a, b]);
    }
  }
  return out;
}
