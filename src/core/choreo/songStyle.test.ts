import { describe, expect, it } from 'vitest';
import starterData from '../../data/starter.json';
import { FAMILIES, THEMES } from './families';
import {
  ARTIST_TABLE_SIZE,
  artistCandidates,
  artistKey,
  BALANCED_POP,
  genreFamilies,
  keywordThemes,
  resolveSongStyle,
  styleKey,
  styleLabel,
  type SongStyle,
} from './songStyle';

const sum = (s: SongStyle) => Object.values(s.families).reduce((a, b) => a + (b ?? 0), 0);
const top = (s: SongStyle) => Object.entries(s.families).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0];
const starter = starterData as { videoId: string; title: string; artist: string }[];

describe('resolution order', () => {
  it('override beats artist beats genre beats fallback', () => {
    const base = { title: 'Some Song', artist: 'Shakira', genre: 'Rock' };
    const o = resolveSongStyle({ ...base, style: { families: { disco: 1 } } });
    expect(o.source).toBe('override');
    expect(o.families).toEqual({ disco: 1 });
    const a = resolveSongStyle(base);
    expect(a.source).toBe('artist');
    expect(top(a)).toBe('latin');
    const g = resolveSongStyle({ ...base, artist: 'Nobody Known' });
    expect(g.source).toBe('genre');
    expect(top(g)).toBe('rock');
    const f = resolveSongStyle({ title: 'Some Song', artist: 'Nobody Known' });
    expect(f.source).toBe('fallback');
    expect(f.families).toEqual(BALANCED_POP.families);
  });

  it('later layers fill what earlier layers left open, and themes are unioned', () => {
    // Override decides families only: focus comes from the artist, themes from override + artist + title.
    const s = resolveSongStyle({ title: 'Twist', artist: 'Shakira', style: { families: { pop: 1 }, themes: ['wave', 'nonsense'] } });
    expect(s.source).toBe('override');
    expect(s.families).toEqual({ pop: 1 });
    expect(s.focus).toEqual({ hips: 1.6 });
    expect(s.themes).toEqual(['hips', 'twist', 'wave']);
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
    const s = resolveSongStyle({ artist: 'Linkin Park', style: { families: { latin: -1, bogus: 3 } as never } });
    expect(s.source).toBe('artist');
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
    ];
    for (const s of songs) {
      for (const p of [undefined, { bpm: 95 }, { bpm: 170, energy: 0.9 }, { energy: 0.1 }]) {
        const a = resolveSongStyle(s, p);
        expect(sum(a)).toBeCloseTo(1, 9);
        expect(resolveSongStyle(s, p)).toEqual(a);
        expect(Object.keys(a.families).every((f) => (FAMILIES as readonly string[]).includes(f))).toBe(true);
      }
    }
  });
});

describe('artist normalisation', () => {
  it('matches any credited artist', () => {
    const s = resolveSongStyle({ title: 'Hips Don’t Lie', artist: 'Shakira feat. Wyclef Jean' });
    expect(s.source).toBe('artist');
    expect(top(s)).toBe('latin');
    expect(s.focus?.hips).toBeGreaterThan(1);
    expect(resolveSongStyle({ artist: 'Wyclef Jean ft. Shakira' }).source).toBe('artist');
    expect(resolveSongStyle({ artist: 'Someone & Bruno Mars' }).source).toBe('artist');
    expect(resolveSongStyle({ artist: 'Someone x J Balvin' }).source).toBe('artist');
    expect(resolveSongStyle({ artist: 'Someone with Pitbull' }).source).toBe('artist');
  });

  it('strips accents, punctuation, "&"/"and" and a leading "the"', () => {
    expect(artistKey('Beyoncé')).toBe(artistKey('Beyonce'));
    expect(resolveSongStyle({ artist: 'Beyonce' }).source).toBe('artist');
    expect(resolveSongStyle({ artist: 'BEYONCÉ' }).source).toBe('artist');
    expect(artistKey('The Weeknd')).toBe('weeknd');
    expect(artistKey('Weeknd')).toBe('weeknd');
    expect(resolveSongStyle({ artist: 'Weeknd' }).source).toBe('artist');
    expect(artistKey('Earth, Wind & Fire')).toBe(artistKey('Earth Wind and Fire'));
    expect(top(resolveSongStyle({ artist: 'Earth Wind and Fire' }))).toBe('funk');
    expect(artistKey('Ke$ha')).toBe('kesha');
  });

  it('keeps whole names that contain separators', () => {
    expect(artistCandidates('AC/DC')[0]).toBe('acdc');
    expect(resolveSongStyle({ artist: 'AC/DC' }).source).toBe('artist');
    expect(resolveSongStyle({ artist: 'TOMORROW X TOGETHER' }).families.kpop).toBeGreaterThan(0.5);
    expect(resolveSongStyle({ artist: 'Lil Nas X' }).source).toBe('artist');
    expect(top(resolveSongStyle({ artist: 'Kool and the Gang' }))).toBe('funk');
  });

  it('knows a generous set of artists', () => {
    expect(ARTIST_TABLE_SIZE).toBeGreaterThan(200);
    for (const [artist, fam] of [
      ['Michael Jackson', 'funk'],
      ['Linkin Park', 'rock'],
      ['Dua Lipa', 'disco'],
      ['BLACKPINK', 'kpop'],
      ['PSY', 'kpop'],
      ['Bee Gees', 'disco'],
      ['Daddy Yankee', 'latin'],
      ['Red Hot Chili Peppers', 'rock'],
    ] as const) {
      expect(top(resolveSongStyle({ artist })), artist).toBe(fam);
    }
    expect(resolveSongStyle({ artist: 'Red Hot Chili Peppers' }).families.funk).toBeGreaterThan(0.3);
    expect(resolveSongStyle({ artist: 'Michael Jackson' }).themes).toEqual(expect.arrayContaining(['kick', 'spin', 'point']));
    expect(resolveSongStyle({ artist: 'LMFAO' }).families.party).toBeGreaterThan(0.2);
    expect(BALANCED_POP.families.party).toBeGreaterThan(0);
    expect(resolveSongStyle({ videoId: 'zIh5AHxh-Ok' }).families.party).toBeGreaterThan(0.2); // Party Rock Anthem
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
    expect(resolveSongStyle({ genre: 'Reggaeton' }).focus?.hips).toBeGreaterThan(1);
  });

  it('is case and accent insensitive, guesses from words, and ignores unknown genres', () => {
    expect(genreFamilies('hip-hop/rap')).toEqual(genreFamilies('Hip-Hop/Rap'));
    expect(genreFamilies('Música Urbana')).not.toBeNull();
    expect(top(resolveSongStyle({ genre: 'Pop Punk Revival' }))).toBe('rock');
    expect(genreFamilies('Spoken Word')).toBeNull();
    expect(genreFamilies('')).toBeNull();
    expect(resolveSongStyle({ genre: 'Spoken Word' }).source).toBe('fallback');
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
  it('styleLabel names the top one or two families', () => {
    expect(styleLabel(st({ latin: 0.8, pop: 0.2 }))).toBe('Latin groove');
    expect(styleLabel(st({ rock: 1 }))).toBe('Rock');
    expect(styleLabel(st({ disco: 0.5, funk: 0.4, pop: 0.1 }))).toBe('Disco · Funk');
    expect(styleLabel(st({ funk: 0.45, disco: 0.45, pop: 0.1 }))).toBe('Disco · Funk');
    expect(styleLabel(st({ kpop: 0.6, pop: 0.3, hiphop: 0.1 }))).toBe('K-pop');
    expect(styleLabel(BALANCED_POP)).toBe('Pop');
    expect(styleLabel(resolveSongStyle({ artist: 'Shakira' }))).toBe('Latin groove');
    expect(styleLabel(resolveSongStyle({ artist: 'Linkin Park' }))).toBe('Rock');
  });

  it('styleKey is short, sorted and stable', () => {
    expect(styleKey(st({ funk: 0.5, disco: 0.5 }, ['spin', 'kick']))).toBe('disco:0.50,funk:0.50|kick,spin');
    expect(styleKey(st({ disco: 0.5, funk: 0.5 }, ['kick', 'spin']))).toBe(styleKey(st({ funk: 0.5, disco: 0.5 }, ['spin', 'kick'])));
    expect(styleKey(BALANCED_POP)).toBe('aerobic:0.11,disco:0.13,funk:0.10,hiphop:0.15,kpop:0.04,latin:0.09,party:0.06,pop:0.28,rock:0.04|');
  });
});
