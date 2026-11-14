import { describe, expect, it } from 'vitest';
import starterData from '../../data/starter.json';
import { FAMILIES, THEMES } from './families';
import { songGenres } from './genres';
import {
  ARTIST_SHARE,
  artistCandidates,
  artistKey,
  BALANCED_POP,
  genreFamilies,
  keywordThemes,
  resolveSongStyle,
  songSignature,
  styleKey,
  styleLabel,
  type SongStyle,
} from './songStyle';

const sum = (s: SongStyle) => Object.values(s.families).reduce((a, b) => a + (b ?? 0), 0);
const top = (s: SongStyle) => Object.entries(s.families).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0];
const starter = starterData as { videoId: string; title: string; artist: string }[];

describe('resolution order', () => {
  it('override beats genre names beats traits beats fallback; the artist name never decides', () => {
    const base = { title: 'Some Song', artist: 'Shakira', genre: 'Rock' };
    const o = resolveSongStyle({ ...base, style: { families: { disco: 1 } } });
    expect(o.source).toBe('override');
    expect(o.families).toEqual({ disco: 1 });
    // A famous Latin artist on a song tagged Rock: the song's tag decides.
    const g = resolveSongStyle(base);
    expect(g.source).toBe('genre');
    expect(top(g)).toBe('rock');
    expect(resolveSongStyle({ ...base, artist: 'Nobody Known' })).toEqual(g);
    const t = resolveSongStyle({ title: 'Some Song', artist: 'Shakira' }, { traits: { heavy: 0.9, drive: 0.9, calm: 0.1 } });
    expect(t.source).toBe('traits');
    expect(top(t)).toBe('rock');
    const f = resolveSongStyle({ title: 'Some Song', artist: 'Shakira' });
    expect(f.source).toBe('fallback');
    expect(f.families).toEqual(BALANCED_POP.families);
  });

  it('later layers fill what earlier layers left open, and themes are unioned', () => {
    // Override decides families only: focus comes from the genre names, themes from override + genre + title.
    const s = resolveSongStyle({ title: 'Twist', artist: 'Shakira', genre: 'Afrobeats', style: { families: { pop: 1 }, themes: ['wave', 'nonsense'] } });
    expect(s.source).toBe('override');
    expect(s.families).toEqual({ pop: 1 });
    expect(s.focus).toEqual({ hips: 1.3 });
    expect(s.themes).toEqual(['twist', 'wave', 'afro']);
  });

  it('a starter song uses its curated style by videoId; an explicit style wins over it', () => {
    const id = '7CTJcHjkq0E'; // Billie Jean
    const s = resolveSongStyle({ videoId: id, title: 'Billie Jean', artist: 'Michael Jackson' });
    expect(s.source).toBe('override');
    expect(top(s)).toBe('funk');
    expect(s.themes).toEqual(expect.arrayContaining(['kick', 'spin', 'point']));
    expect(resolveSongStyle({ videoId: id, style: { families: { rock: 2 } } }).families).toEqual({ rock: 1 });
  });

  it('invalid override weights fall through to the next layer', () => {
    const s = resolveSongStyle({ artist: 'Linkin Park', genre: 'Alternative', style: { families: { latin: -1, bogus: 3 } as never } });
    expect(s.source).toBe('genre');
    expect(top(s)).toBe('rock');
  });

  it('signature passes through from the override', () => {
    expect(resolveSongStyle({ style: { families: { pop: 1 }, signature: ['a', 'b'] } }).signature).toEqual(['a', 'b']);
    expect(resolveSongStyle({ artist: 'Unknown' }).signature).toBeUndefined();
  });

  it('is deterministic and always normalised', () => {
    const songs = [
      { title: 'X', artist: 'Bruno Mars' },
      { title: 'Y', genre: 'Reggaeton' },
      { title: 'Z' },
      { title: 'W', style: { families: { rock: 3, funk: 1 } } },
      { title: 'V', genre: 'Pop', genres: ['Post-disco', 'R&B', 'funk', 'dance-pop'], artistGenre: 'Funk' },
    ];
    for (const s of songs) {
      for (const p of [undefined, { bpm: 95 }, { bpm: 170, energy: 0.9 }, { energy: 0.1 }, { bpm: 140, traits: { calm: 0.2, halfFeel: 0.8, hats: 0.9 } }, { traits: { calm: 'x', heavy: NaN } }]) {
        const a = resolveSongStyle(s, p);
        expect(sum(a)).toBeCloseTo(1, 9);
        expect(resolveSongStyle(s, p)).toEqual(a);
        expect(Object.keys(a.families).every((f) => (FAMILIES as readonly string[]).includes(f))).toBe(true);
      }
    }
  });
});

describe('artist credits (signature nods only)', () => {
  it('match a song\'s nod by any credited artist', () => {
    expect(songSignature('Hips Don’t Lie', 'Shakira feat. Wyclef Jean')).toEqual(['hip-sway', 'hip-shake']);
    expect(songSignature('Hips Don’t Lie', 'Wyclef Jean ft. Shakira')).toEqual(['hip-sway', 'hip-shake']);
    expect(songSignature('Gangnam Style', 'Someone x PSY')).toEqual(['gallop', 'lasso']);
    expect(songSignature('Hips Don’t Lie', 'Someone Else')).toBeUndefined();
  });

  it('strips accents, punctuation, "&"/"and" and a leading "the"', () => {
    expect(artistKey('Beyoncé')).toBe(artistKey('Beyonce'));
    expect(artistKey('BEYONCÉ')).toBe('beyonce');
    expect(artistKey('The Weeknd')).toBe('weeknd');
    expect(artistKey('Weeknd')).toBe('weeknd');
    expect(artistKey('Earth, Wind & Fire')).toBe(artistKey('Earth Wind and Fire'));
    expect(songSignature('September', 'Earth Wind and Fire')).toEqual(['disco-point']);
    expect(artistKey('Ke$ha')).toBe('kesha');
  });

  it('keeps whole names that contain separators', () => {
    expect(artistCandidates('AC/DC')[0]).toBe('acdc');
    expect(artistCandidates('TOMORROW X TOGETHER')[0]).toBe('tomorrowxtogether');
    expect(artistCandidates('Lil Nas X')[0]).toBe('lilnasx');
    expect(artistCandidates('Kool and the Gang')[0]).toBe(artistKey('Kool & the Gang'));
  });

  it('never decide a style: well-known names alone resolve to the fallback mix', () => {
    for (const artist of ['Michael Jackson', 'Linkin Park', 'Dua Lipa', 'BLACKPINK', 'PSY', 'Daddy Yankee', 'Evanescence', 'Billie Eilish']) {
      const s = resolveSongStyle({ title: 'Untitled', artist });
      expect(s.source, artist).toBe('fallback');
      expect(s.families, artist).toEqual(BALANCED_POP.families);
    }
    expect(BALANCED_POP.families.party).toBeGreaterThan(0);
    expect(resolveSongStyle({ videoId: 'zIh5AHxh-Ok' }).families.party).toBeGreaterThan(0.2); // Party Rock Anthem (curated)
  });

  it('an artist genre is a small blended score at most, never the base', () => {
    const plain = resolveSongStyle({ title: 'Z', genre: 'Pop' });
    const withArtist = resolveSongStyle({ title: 'Z', genre: 'Pop', artistGenre: 'Heavy Metal' });
    expect(withArtist.source).toBe('genre');
    expect(top(withArtist)).toBe('pop');
    for (const f of FAMILIES) expect(Math.abs((withArtist.families[f] ?? 0) - (plain.families[f] ?? 0)), f).toBeLessThanOrEqual(0.15 + 1e-9);
    expect(withArtist.subs?.metal ?? 0).toBeLessThanOrEqual(ARTIST_SHARE + 1e-9);
    expect(songGenres(withArtist).has('metal')).toBe(false);
    // Alone it is not a base either: the fallback mix, nudged.
    const alone = resolveSongStyle({ title: 'Z', artistGenre: 'Heavy Metal' });
    expect(alone.source).toBe('fallback');
    expect(top(alone)).toBe('pop');
  });

  it("the artist's whole list is still a small score: together at most ARTIST_SHARE", () => {
    const plain = resolveSongStyle({ title: 'Z', genres: ['pop'] });
    const many = resolveSongStyle({ title: 'Z', genres: ['pop'], artistGenres: ['heavy metal', 'thrash metal', 'death metal', 'nu metal'] });
    for (const f of FAMILIES) expect(Math.abs((many.families[f] ?? 0) - (plain.families[f] ?? 0)), f).toBeLessThanOrEqual(0.15 + 1e-9);
    expect(many.subs?.metal ?? 0).toBeLessThanOrEqual(ARTIST_SHARE + 1e-9);
    expect(songGenres(many).has('metal')).toBe(false);
    // The list replaces the single name: its first entry alone gives the same as `artistGenre`.
    const one = resolveSongStyle({ title: 'Z', genres: ['pop'], artistGenre: 'disco' });
    expect(resolveSongStyle({ title: 'Z', genres: ['pop'], artistGenres: ['disco'] }).families).toEqual(one.families);
  });
});

describe('genre levels: album names are a weaker score beside the song\'s own', () => {
  const S = 'song', A = 'album';
  const open = (genres: string[], genreLevels?: string[]) => songGenres(resolveSongStyle({ title: 'Z', genres, ...(genreLevels ? { genreLevels } : {}) }));

  it('an album name that narrows a broad song-level name adds its dance', () => {
    // A song the sources call only "Latin pop" / "tropical", whose album says which dance.
    expect(open(['Latin pop', 'bachata', 'tropical'], [S, A, S]).has('bachata')).toBe(true);
    expect(open(['tropical', 'cumbia'], [S, A]).has('cumbia')).toBe(true);
    expect(open(['hip hop', 'trap'], [S, A]).has('trap')).toBe(true);
    // The label stays the song's own name, with the dance it narrows to.
    expect(styleLabel(resolveSongStyle({ title: 'Z', genres: ['tropical', 'cumbia'], genreLevels: [S, A] }))).toBe('Tropical · Cumbia');
  });

  it('an album name of another family neither names the song nor opens its set', () => {
    // A song whose own names say electro house; the album (and artist) are R&B.
    const s = resolveSongStyle({ title: 'Z', genres: ['R&B', 'electro house', 'EDM'], genreLevels: [A, S, S] });
    expect(styleLabel(s)).not.toMatch(/R&B/);
    expect(songGenres(s).has('rnb')).toBe(false);
    expect(songGenres(s).has('edm')).toBe(true);
    expect(top(s)).toBe(top(resolveSongStyle({ title: 'Z', genres: ['electro house', 'EDM'] })));
    // The same name at song level does both: the level is what changed.
    expect(styleLabel(resolveSongStyle({ title: 'Z', genres: ['R&B', 'electro house', 'EDM'] }))).toBe('R&B');
  });

  it('a broad album name does not dilute a scene or a specific song-level name', () => {
    const songOnly = resolveSongStyle({ title: 'Z', genres: ['pop rap', 'K-pop', 'pop', 'hip hop'] });
    const withAlbum = resolveSongStyle({ title: 'Z', genres: ['pop rap', 'K-pop', 'pop', 'hip hop', 'pop rock', 'rock'], genreLevels: [S, S, S, S, A, A] });
    const asSong = resolveSongStyle({ title: 'Z', genres: ['pop rap', 'K-pop', 'pop', 'hip hop', 'pop rock', 'rock'] });
    expect(styleLabel(withAlbum)).toBe('K-pop');
    expect(songGenres(withAlbum).has('rock')).toBe(false);
    expect(withAlbum.families.rock ?? 0).toBeLessThan(asSong.families.rock ?? 0);
    expect(Math.abs((withAlbum.families.kpop ?? 0) - (songOnly.families.kpop ?? 0))).toBeLessThan(0.03);
  });

  it('an album dance in a family the song already names specifically stays weak', () => {
    // The song says which metal; the album's nu metal adds no evidence of its own.
    const base = resolveSongStyle({ title: 'Z', genres: ['soft rock', 'alternative metal'] });
    const s = resolveSongStyle({ title: 'Z', genres: ['soft rock', 'alternative metal', 'nu metal'], genreLevels: [S, S, A] });
    expect(s.subs?.metal).toBe(base.subs?.metal);
    // An album's metal beside a song-level "alternative rock" and a specific "punk": the song said punk, metal stays closed.
    expect(open(['punk', 'alternative rock', 'metal'], [S, S, A]).has('metal')).toBe(false);
  });

  it('calm still closes the showpiece sets whatever the levels say', () => {
    const calm = { calm: 0.92, intensity: 0.2, drive: 0.2, heavy: 0.3 };
    const s = resolveSongStyle({ title: 'Z', genres: ['alternative metal', 'soft rock', 'alternative rock', 'gothic rock', 'nu metal', 'pop rock'], genreLevels: [S, S, S, S, A, S] }, { bpm: 76, traits: calm });
    const g = songGenres(s);
    expect(g.has('metal')).toBe(false);
    expect(g.has('rock')).toBe(false);
    expect(g.has('lyrical')).toBe(true);
  });

  it('with no song-level name, album names act nearly as song-level ones', () => {
    const alb = resolveSongStyle({ title: 'Z', genres: ['bachata', 'Latin pop'], genreLevels: [A, A] });
    const sng = resolveSongStyle({ title: 'Z', genres: ['bachata', 'Latin pop'] });
    expect(styleLabel(alb)).toBe(styleLabel(sng));
    expect(songGenres(alb)).toEqual(songGenres(sng));
    expect(alb.subs?.bachata ?? 0).toBeGreaterThanOrEqual(0.85 * (sng.subs?.bachata ?? 0) - 1e-9);
  });

  it('without levels, or levels that do not match the list, every name is song-level', () => {
    const genres = ['Latin pop', 'R&B', 'bachata'];
    const plain = resolveSongStyle({ title: 'Z', genres });
    expect(resolveSongStyle({ title: 'Z', genres, genreLevels: [S, S, S] })).toEqual(plain);
    expect(resolveSongStyle({ title: 'Z', genres, genreLevels: [S, A] })).toEqual(plain);
  });
});

describe('genre mapping', () => {
  it('maps iTunes primary genres to families', () => {
    const t = (g: string) => top(resolveSongStyle({ genre: g }));
    expect(t('Hip-Hop/Rap')).toBe('hiphop');
    expect(t('Rock')).toBe('rock');
    expect(t('Hard Rock')).toBe('rock');
    expect(t('Metal')).toBe('rock');
    expect(t('Alternative')).toBe('rock');
    expect(t('Latin')).toBe('latin');
    expect(t('Reggaeton')).toBe('latin');
    expect(t('Urbano latino')).toBe('latin');
    expect(t('Salsa y Tropical')).toBe('latin');
    expect(t('Pop Latino')).toBe('latin');
    expect(t('K-Pop')).toBe('kpop');
    expect(t('Disco')).toBe('disco');
    expect(t('Funk')).toBe('funk');
    expect(t('R&B/Soul')).toBe('funk');
    expect(t('Electronic')).toBe('aerobic');
    expect(t('Pop')).toBe('pop');
    expect(t('Singer/Songwriter')).toBe('pop');
    expect(t('Soundtrack')).toBe('pop');
    expect(t('Country')).toBe('pop');
    expect(resolveSongStyle({ genre: 'Country' }).themes).toContain('country');
    expect(resolveSongStyle({ genre: 'Reggaeton' }).focus?.hips).toBeGreaterThan(1);
  });

  it('reads genre names by words and compounds, blends a list, and ignores names it cannot place', () => {
    const t = (genres: string[], genre?: string) => top(resolveSongStyle({ genres, genre }));
    expect(t(['Southern hip hop'])).toBe('hiphop');
    expect(t(['Nu metal', 'rap rock'])).toBe('rock');
    expect(t(['Drum and bass', 'liquid funk'])).toBe('aerobic');
    expect(t(['Country pop'])).toBe('pop');
    expect(resolveSongStyle({ genres: ['Country pop'] }).themes).toContain('country');
    expect(t(['Bedroom pop'])).toBe('pop');
    expect(resolveSongStyle({ genres: ['Phonk'] }).subs?.bass).toBeGreaterThanOrEqual(0.9);
    // The label is the music's own name (it says the sub-style already).
    expect(styleLabel(resolveSongStyle({ genres: ['Phonk'] }))).toBe('Phonk');
    expect(styleLabel(resolveSongStyle({ genres: ['Dubstep'] }))).toBe('Dubstep');
    expect(resolveSongStyle({ genres: ['UK drill'] }).subs?.drill).toBeGreaterThanOrEqual(0.9);
    expect(resolveSongStyle({ genres: ['Amapiano'] }).subs?.amapiano).toBeGreaterThanOrEqual(0.9);
    // A list blends: the first names weigh most, the tag is a tie-breaker.
    const mixed = resolveSongStyle({ genres: ['Latin pop', 'reggaeton'], genre: 'Pop' });
    expect(top(mixed)).toBe('latin');
    expect(mixed.subs?.reggaeton).toBeGreaterThan(0.5);
    // Names nothing places are ignored (the tag, then the fallback, decide).
    expect(resolveSongStyle({ genres: ['Zzyzx wave of nothing'], genre: 'Hip-Hop/Rap' }).source).toBe('genre');
    expect(top(resolveSongStyle({ genres: ['Zzyzx wave of nothing'], genre: 'Hip-Hop/Rap' }))).toBe('hiphop');
    expect(resolveSongStyle({ genres: ['Zzyzx'] }).source).toBe('fallback');
    // "Hardcore hip hop" is hip-hop, not hardcore punk.
    expect(resolveSongStyle({ genres: ['Hardcore hip hop'] }).subs?.punk).toBeUndefined();
  });

  it('is case and accent insensitive, guesses from words, and ignores unknown genres', () => {
    expect(genreFamilies('hip-hop/rap')).toEqual(genreFamilies('Hip-Hop/Rap'));
    expect(genreFamilies('Música Urbana')).not.toBeNull();
    expect(top(resolveSongStyle({ genre: 'Pop Punk Revival' }))).toBe('rock');
    expect(genreFamilies('Zzyzx Wave')).toBeNull();
    expect(genreFamilies('')).toBeNull();
    expect(resolveSongStyle({ genre: 'Zzyzx Wave' }).source).toBe('fallback');
    // Not dance music is placed honestly: a neutral mix under its own name.
    const spoken = resolveSongStyle({ genre: 'Spoken Word' });
    expect(spoken.source).toBe('genre');
    expect(spoken.still).toBe(true);
    expect(styleLabel(spoken)).toBe('Spoken Word');
  });
});

describe('keyword themes', () => {
  it('finds themes in titles', () => {
    expect(keywordThemes('Hips Don’t Lie')).toEqual(expect.arrayContaining(['hips']));
    expect(keywordThemes('Jump Around')).toEqual(expect.arrayContaining(['jump']));
    expect(keywordThemes('Twist and Shout')).toEqual(['twist']);
    expect(keywordThemes('Shake It Off')).toEqual(['shake']);
    expect(keywordThemes('Shakedown Street')).toEqual(['shake']);
    expect(keywordThemes('Rock Your Body')).toEqual(['hips', 'shake', 'stomp']);
    expect(keywordThemes('Clap Your Hands')).toEqual(['clap', 'hands']);
    expect(keywordThemes('Turn Around')).toEqual(['spin']);
    expect(keywordThemes('Kickstart', 'Kickin’ It')).toEqual(['kick']);
    expect(keywordThemes('Shakin’ All Over')).toEqual(['shake']);
  });

  it('avoids false positives', () => {
    expect(keywordThemes("Can't Stop the Feeling!")).toEqual([]);
    expect(keywordThemes('Shut Up and Dance')).toEqual([]);
    expect(keywordThemes('Return')).toEqual([]);
    expect(keywordThemes('Gangnam Style')).toEqual([]);
    expect(keywordThemes('Rocket Man')).toEqual([]);
    expect(keywordThemes('I Wanna Dance with Somebody')).toEqual([]);
    expect(keywordThemes('Jumpsuit')).toEqual([]);
    expect(keywordThemes('Shakira')).toEqual([]);
    expect(resolveSongStyle({ title: 'Gangnam Style', artist: 'Nobody' }).themes).toEqual([]);
  });

  it('adds themes to the resolved style, with a hips focus when nothing else decided one', () => {
    const s = resolveSongStyle({ title: 'Hips Don’t Lie', artist: 'Unknown Band' });
    expect(s.themes).toEqual(['hips', 'shake']);
    expect(s.focus).toEqual({ hips: 1.3 });
    expect(resolveSongStyle({ title: 'Jump Around' }).themes).toEqual(['jump', 'spin']);
  });
});

describe('priors', () => {
  it('nudge families slightly, at most ~15 %', () => {
    const plain = resolveSongStyle({ title: 'Z' });
    const slow = resolveSongStyle({ title: 'Z' }, { bpm: 95 });
    expect(slow.families.latin!).toBeGreaterThan(plain.families.latin!);
    expect(slow.families.hiphop!).toBeGreaterThan(plain.families.hiphop!);
    const fast = resolveSongStyle({ title: 'Z' }, { bpm: 172, energy: 0.9 });
    expect(fast.families.rock!).toBeGreaterThan(plain.families.rock!);
    expect(fast.families.aerobic!).toBeGreaterThan(plain.families.aerobic!);
    for (const f of FAMILIES) expect(Math.abs((fast.families[f] ?? 0) - (plain.families[f] ?? 0))).toBeLessThanOrEqual(0.15 + 1e-9);
  });

  it('never override a curated decision', () => {
    const s = resolveSongStyle({ style: { families: { rock: 1 } } }, { bpm: 95, energy: 0.1 });
    expect(s.families.rock!).toBeGreaterThanOrEqual(0.95 - 1e-9);
    expect(s.source).toBe('override');
    expect(resolveSongStyle({ title: 'Z' }, { bpm: NaN, energy: undefined })).toEqual(resolveSongStyle({ title: 'Z' }));
  });
});

describe('style comes from the song (owner examples)', () => {
  it('"Hip-Hop/Rap" with no artist resolves to hip-hop', () => {
    const s = resolveSongStyle({ title: 'Back in Blood', genre: 'Hip-Hop/Rap' });
    expect(top(s)).toBe('hiphop');
    expect(styleLabel(s)).toBe('Hip-hop');
    expect(songGenres(s).has('hiphop')).toBe(true);
  });

  it('Back in Blood (Hip hop, drill, trap) opens drill and trap and never resolves to pop', () => {
    for (const p of [undefined, { bpm: 140 }, { bpm: 140, traits: { calm: 0.25, halfFeel: 0.8, hats: 0.8, bass: 0.85, syncop: 0.6 } }]) {
      const s = resolveSongStyle({ title: 'Back in Blood', genre: 'Hip-Hop/Rap', genres: ['Hip hop', 'drill', 'trap'] }, p);
      expect(top(s)).toBe('hiphop');
      const open = songGenres(s);
      expect(open.has('drill')).toBe(true);
      expect(open.has('trap')).toBe(true);
      expect(open.has('hiphop')).toBe(true);
      // Drill leads the names; trap-like audio may tip the label to its sibling.
      expect(styleLabel(s)).toMatch(p?.traits ? /^Hip-hop · (Drill|Trap)$/ : /^Hip-hop · Drill$/);
    }
  });

  it('My Immortal ("Hard Rock" or ["Alternative rock"], calm ~0.9) is a ballad: no rock showpiece sets', () => {
    for (const info of [{ title: 'My Immortal', genre: 'Hard Rock' }, { title: 'My Immortal', genre: 'Hard Rock', genres: ['Alternative rock'] }]) {
      const s = resolveSongStyle(info, { bpm: 78, traits: { calm: 0.9, heavy: 0.2, drive: 0.15 } });
      expect(s.calm).toBeGreaterThan(0.85);
      expect(styleLabel(s)).toMatch(/^(Hard Rock|Alternative rock) · Ballad$/);
      const open = songGenres(s);
      for (const g of ['rock', 'metal', 'punk'] as const) expect(open.has(g), g).toBe(false);
      expect(open.has('lyrical')).toBe(true);
    }
    // The same band's banger stays rock (and metal).
    const loud = resolveSongStyle({ title: 'Bring Me to Life', genre: 'Hard Rock', genres: ['Nu metal', 'rap rock', 'alternative rock', 'gothic metal'] }, { traits: { calm: 0.3, heavy: 0.85, drive: 0.8 } });
    expect(styleLabel(loud)).toBe('Nu metal');
    expect(songGenres(loud).has('rock')).toBe(true);
    expect(songGenres(loud).has('metal')).toBe(true);
  });

  it('Billie Jean (Post-disco, R&B, funk, dance-pop) leans disco / funk, not plain pop', () => {
    const s = resolveSongStyle({ title: 'Billie Jean', genre: 'Pop', genres: ['Post-disco', 'R&B', 'funk', 'dance-pop'] });
    expect(['disco', 'funk']).toContain(top(s));
    expect((s.families.disco ?? 0) + (s.families.funk ?? 0)).toBeGreaterThan(2 * (s.families.pop ?? 0));
    expect(styleLabel(s)).not.toMatch(/^Pop/);
    expect(songGenres(s).has('discofunk')).toBe(true);
    expect(songGenres(s).has('hiphop')).toBe(false);
  });

  it('a bad genre tag is only a tie-breaker when the song has genre names (Crazy in Love: "Soundtrack")', () => {
    const s = resolveSongStyle({ title: 'Crazy in Love', genre: 'Soundtrack', genres: ['Pop', 'hip-hop', 'R&B'] });
    expect(['pop', 'hiphop']).toContain(top(s));
    expect(s.families.hiphop ?? 0).toBeGreaterThan(0.25);
    expect(s.subs?.rnb).toBeGreaterThan(0.5);
  });

  it('TV ("Alternative", no article, calm) is a ballad, not upbeat pop', () => {
    const s = resolveSongStyle({ title: 'TV', genre: 'Alternative' }, { bpm: 72, traits: { calm: 0.85, drive: 0.2 } });
    expect(styleLabel(s)).toMatch(/Ballad$/);
    expect(songGenres(s).has('rock')).toBe(false);
  });

  it('no genre at all: the traits and tempo decide the lean, not a pop mix', () => {
    const trap = resolveSongStyle({ title: 'X' }, { bpm: 140, traits: { calm: 0.25, halfFeel: 0.85, hats: 0.8, bass: 0.8, drive: 0.6, heavy: 0.1, fourFloor: 0.1 } });
    expect(trap.source).toBe('traits');
    expect(top(trap)).toBe('hiphop');
    expect(top(trap)).not.toBe('pop');
    // A half-time feel is what any song counted at double tempo shows: without a trap name it doesn't open trap.
    expect(songGenres(trap).has('trap')).toBe(false);
    expect(styleLabel(trap)).toBe('Hip-hop');
    expect(songGenres(resolveSongStyle({ title: 'X', genres: ['trap'] }, { bpm: 140, traits: { calm: 0.25, halfFeel: 0.85, hats: 0.8, bass: 0.8, drive: 0.6 } })).has('trap')).toBe(true);
    const house = resolveSongStyle({ title: 'X' }, { bpm: 124, traits: { calm: 0.3, fourFloor: 0.9, drive: 0.7 } });
    expect(styleLabel(house)).toBe('Electronic · House');
    const metal = resolveSongStyle({ title: 'X' }, { bpm: 170, traits: { calm: 0.15, heavy: 0.9, drive: 0.9 } });
    expect(top(metal)).toBe('rock');
    expect(songGenres(metal).has('metal')).toBe(true);
    const ballad = resolveSongStyle({ title: 'X' }, { bpm: 70, traits: { calm: 0.9, drive: 0.1 } });
    expect(top(ballad)).toBe('pop');
    // Known only by its audio: a ballad, not "Pop".
    expect(styleLabel(ballad)).toBe('Ballad');
    // Partial traits are fine; missing traits are neutral.
    expect(resolveSongStyle({ title: 'X' }, { traits: { heavy: 0.95 } }).source).toBe('traits');
    expect(resolveSongStyle({ title: 'X' }, { traits: {} }).source).toBe('fallback');
  });

  it('traits are read defensively: non-numbers dropped, values clamped', () => {
    const s = resolveSongStyle({ title: 'X', genre: 'Rock' }, { traits: { calm: 7, heavy: 'loud', drive: -3, bass: Infinity } });
    expect(s.calm).toBe(1);
    expect(resolveSongStyle({ title: 'X', genre: 'Rock' }, { traits: 'nonsense' })).toEqual(resolveSongStyle({ title: 'X', genre: 'Rock' }));
    expect(resolveSongStyle({ title: 'X', genre: 'Rock' }, { traits: null })).toEqual(resolveSongStyle({ title: 'X', genre: 'Rock' }));
  });
});

describe('fallback', () => {
  it('an unknown song still gets a varied mix led by pop', () => {
    const s = resolveSongStyle({ title: 'Untitled', artist: 'Some Garage Band' });
    expect(s.source).toBe('fallback');
    expect(top(s)).toBe('pop');
    expect(Object.keys(s.families).length).toBeGreaterThanOrEqual(6);
    expect(sum(s)).toBeCloseTo(1, 9);
    expect(resolveSongStyle({}).source).toBe('fallback');
  });
});

describe('starter pack', () => {
  it('every entry resolves from its curated style', () => {
    expect(starter.length).toBe(97);
    for (const e of starter) {
      const s = resolveSongStyle({ videoId: e.videoId, title: e.title, artist: e.artist });
      expect(s.source, e.title).toBe('override');
      expect(Object.keys(s.families).length, e.title).toBeGreaterThan(0);
      expect(sum(s)).toBeCloseTo(1, 9);
      expect(s.themes.every((t) => (THEMES as readonly string[]).includes(t))).toBe(true);
    }
  });

  it('curated styles carry only known families, themes and foci, and no signatures yet', () => {
    for (const e of starterData as { style: { families: object; themes: string[]; focus?: object; signature?: unknown } }[]) {
      expect(Object.keys(e.style.families).every((f) => (FAMILIES as readonly string[]).includes(f))).toBe(true);
      expect(e.style.themes.every((t) => (THEMES as readonly string[]).includes(t))).toBe(true);
      expect(e.style.signature).toBeUndefined();
    }
  });
});

describe('labels and keys', () => {
  const st = (families: SongStyle['families'], themes: SongStyle['themes'] = []): SongStyle => ({ families, themes, source: 'override' });
  it('styleLabel names the top one or two families as music styles (never "Aerobics")', () => {
    expect(styleLabel(st({ latin: 0.8, pop: 0.2 }))).toBe('Latin');
    expect(styleLabel(st({ aerobic: 0.8, pop: 0.2 }))).toBe('Dance');
    expect(styleLabel(st({ rock: 1 }))).toBe('Rock');
    expect(styleLabel(st({ disco: 0.5, funk: 0.4, pop: 0.1 }))).toBe('Disco · Funk');
    expect(styleLabel(st({ funk: 0.45, disco: 0.45, pop: 0.1 }))).toBe('Disco · Funk');
    expect(styleLabel(st({ kpop: 0.6, pop: 0.3, hiphop: 0.1 }))).toBe('K-pop');
    // Nothing known: no pretend style.
    expect(styleLabel(BALANCED_POP)).toBe('Mixed styles');
    expect(styleLabel(resolveSongStyle({ genre: 'Latin' }))).toBe('Latin');
    expect(styleLabel(resolveSongStyle({ genre: 'Rock' }))).toBe('Rock');
  });

  it('styleLabel names the sub-style when one clearly applies, and the ballad when the song is calm', () => {
    expect(styleLabel(st({ hiphop: 1 }))).toBe('Hip-hop');
    expect(styleLabel({ ...st({ hiphop: 1 }), subs: { drill: 0.9 } })).toBe('Hip-hop · Drill');
    expect(styleLabel({ ...st({ hiphop: 1 }), subs: { drill: 0.4 } })).toBe('Hip-hop');
    expect(styleLabel({ ...st({ rock: 1 }), calm: 0.85 })).toBe('Rock · Ballad');
    expect(styleLabel({ ...st({ rock: 1 }), subs: { metal: 0.9 }, calm: 0.85 })).toBe('Rock · Ballad');
    expect(styleLabel({ ...st({ latin: 1 }), subs: { reggaeton: 1 } })).toBe('Latin · Reggaeton');
    // A sub-style whose group doesn't lead the song doesn't name it.
    expect(styleLabel({ ...st({ funk: 0.6, disco: 0.4 }), subs: { rnb: 0.9 } })).toBe('Funk · Disco');
    expect(styleLabel(st({ pop: 0.6, rock: 0.4 }, ['country']))).toBe('Country');
  });

  it('styleKey is short, sorted and stable', () => {
    expect(styleKey(st({ funk: 0.5, disco: 0.5 }, ['spin', 'kick']))).toBe('disco:0.50,funk:0.50|kick,spin');
    expect(styleKey(st({ disco: 0.5, funk: 0.5 }, ['kick', 'spin']))).toBe(styleKey(st({ funk: 0.5, disco: 0.5 }, ['spin', 'kick'])));
    expect(styleKey(BALANCED_POP)).toBe('aerobic:0.11,disco:0.13,funk:0.10,hiphop:0.15,kpop:0.04,latin:0.09,party:0.06,pop:0.28,rock:0.04|');
    // Sub-styles and the calm seed too (a ballad and a banger of the same family differ).
    expect(styleKey({ ...st({ rock: 1 }), subs: { metal: 0.9 }, calm: 0.3 })).toBe('rock:1.00||metal:0.90|c0.30');
  });
});
