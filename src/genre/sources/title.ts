/**
 * The song's own title as genre evidence: a song called "Reggaeton" or
 * "Sertanejo" says its genre (Tony Sunshine's "Reggaeton", for which no
 * source but the store's "Pop" answered). No request is sent.
 *
 * Mechanical and guarded: the title, without "feat." credits, brackets and a
 * " - Remastered"-style tail, must be exactly a genre name of the vocabulary
 * (the hand tree, or the generated Wikidata / MusicBrainz genre list), not an
 * umbrella (specificity under UMBRELLA_SPEC: "Pop", "Rock", "Jazz" say too
 * little), not a song form ("Lullaby": songStyle.ts reads calm titles), and
 * not an ordinary English word that is also a genre name ("House", "Trap",
 * "Soul", "Bounce", "Funk"). Its weight is modest (a store label's is 0.6):
 * a specific name on its own beats an umbrella, but one or two sources that
 * say otherwise outweigh it, and the junk rules apply to it as to any source.
 */
import { UMBRELLA_SPEC } from '../combine';
import { mbKnows, wdKnows } from '../hierarchy';
import { stripFeat } from '../match';
import { canonicalGenre, genreSpecificity, keyOf } from '../names';
import type { GenreSource, SourceAnswer } from '../types';

/** Ordinary English words that are also genre names: as a title they name something else. */
const COMMON_WORDS = new Set([
  'house', 'trap', 'drill', 'soul', 'swing', 'grime', 'bounce', 'garage', 'jungle', 'industrial', 'ambient', 'dance', 'emo', 'beat',
  'noise', 'drone', 'march', 'roots', 'surf', 'goth', 'glam', 'screw', 'snap', 'rage', 'breaks', 'footwork', 'juke', 'worship', 'chant',
  'hymn', 'boogie', 'hustle', 'twist', 'freestyle', 'funk', 'gospel', 'blues', 'country', 'metal', 'punk', 'opera', 'dub', 'groove',
  'shuffle', 'rave', 'acid', 'trip', 'stomp', 'step', 'electro', 'classical', 'romantic', 'tropical', 'urban', 'world', 'latin', 'christian',
  'holiday', 'christmas', 'gangsta', 'horror', 'space', 'progressive', 'experimental', 'alternative', 'indie', 'new age', 'easy listening',
  'children', 'novelty', 'comedy', 'spoken word', 'standards', 'hardcore', 'heavy', 'smooth', 'cool', 'hot', 'fusion', 'crossover', 'minimal',
]);

/** The title as a genre name would be written: no credits, brackets or " - Remastered 2003" tail. */
export function titleAsGenre(title: string): string {
  return stripFeat(title)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .split(/\s+[-–—]\s+/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

/** The genre a title names exactly, or null. */
export function titleGenre(title: string): string | null {
  const t = titleAsGenre(title);
  if (!t || t.length > 40) return null;
  const k = keyOf(t);
  if (!k || COMMON_WORDS.has(k)) return null;
  const g = canonicalGenre(t);
  if (!g || g.form || COMMON_WORDS.has(g.key)) return null;
  // Only a name the vocabulary knows (the hand tree, or Wikidata's / MusicBrainz's genre lists), as written.
  if (!g.known && !mbKnows(k) && !wdKnows(k)) return null;
  if (genreSpecificity(g.key) < UMBRELLA_SPEC) return null;
  return t;
}

export const titleSource: GenreSource = {
  id: 'title',
  level: 'song',
  group: 'title',
  weight: 0.5,
  local: true,
  async lookup(song): Promise<SourceAnswer> {
    const g = titleGenre(song.title);
    return g ? { status: 'found', genres: [g], ref: 'title' } : { status: 'none', reason: 'the title is not a genre name' };
  },
};
