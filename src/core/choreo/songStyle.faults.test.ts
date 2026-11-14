import { describe, expect, it } from 'vitest';
import type { SongTraits } from './songTraits';
import { styleGenres } from './generator';
import { resolveSongStyle, styleLabel, type SongInfo } from './songStyle';

/**
 * Genre names -> dance sets: the faults the round-two random-song evaluation
 * found (tools/eval/data/run-20261115), as rules. The song-level recordings
 * themselves are checked in tools/eval/realgenres.test.ts.
 */

const open = (info: SongInfo, traits?: SongTraits, bpm?: number) => styleGenres(resolveSongStyle(info, { ...(traits ? { traits } : {}), ...(bpm ? { bpm } : {}) }));

// Distorted, driving guitar music (Face to Face: heavy 1.0, drive 0.96).
const HEAVY: SongTraits = { calm: 0, drive: 0.96, fourFloor: 0, halfFeel: 0.3, bass: 0.5, hats: 0.6, swing: 0, syncop: 0.6, heavy: 1, minor: 0.75, intensity: 0.98 };
// A four-on-the-floor club beat at ~125 BPM (ABC "Poison Arrow").
const FOUR: SongTraits = { calm: 0, drive: 1, fourFloor: 1, halfFeel: 0, bass: 0.4, hats: 0.55, swing: 0, syncop: 0.07, heavy: 0.16, minor: 0.3, intensity: 0.77 };

describe('the audio refines a bare umbrella, never a name that says the form', () => {
  it('heavy guitars make "Rock" metal, not "Alternative", punk or post-punk', () => {
    expect(open({ genre: 'Rock', genres: ['rock'] }, HEAVY, 120).has('metal')).toBe(true);
    for (const g of ['Alternative', 'Punk']) expect(open({ genre: g, genres: [g.toLowerCase()] }, HEAVY, 120).has('metal'), g).toBe(false);
    expect(open({ genres: ['post-punk', 'shoegaze'], genre: 'Alternative' }, HEAVY, 120).has('metal')).toBe(false);
    // A name that allows metal (hard rock) keeps the audio's say; no genre at all leaves it to the audio.
    expect(open({ genres: ['hard rock'] }, HEAVY, 120).has('metal')).toBe(true);
    expect(open({}, HEAVY, 120).has('metal')).toBe(true);
  });

  it('four-on-the-floor makes "Pop" or "Electronic" house, not 1982 disco, new wave and synth-pop', () => {
    expect(open({ genre: 'Electronic', genres: ['electronic'] }, FOUR, 124).has('house')).toBe(true);
    expect(open({ genre: 'Pop' }, FOUR, 124).has('house')).toBe(true);
    const abc = open({ genre: 'Pop', genres: ['disco', 'new wave', 'dance-pop', 'synth-pop', 'new pop', 'orchestral pop'] }, FOUR, 125.6);
    expect(abc.has('house')).toBe(false);
    expect(abc.has('edm')).toBe(false);
    expect(abc.has('discofunk')).toBe(true);
    // A store tag of another family ("R&B/Soul" on a eurodance track) says nothing about EDM's family: the audio may.
    expect(open({ genre: 'R&B/Soul' }, { ...FOUR, drive: 1 }, 135).has('edm')).toBe(true);
  });

  it('audio swing alone never opens the swing-dance set', () => {
    const swingy: SongTraits = { calm: 0.25, drive: 0.9, swing: 0.95, syncop: 0.2, heavy: 0, fourFloor: 0.2, halfFeel: 0.9, intensity: 0.22, minor: 0.13 };
    expect(open({}, swingy, 151).has('swing')).toBe(false);
    expect(open({ genre: 'Pop', genres: ['soft rock', 'folk pop', 'surf pop', 'pop rock', 'pop'] }, swingy, 151).has('swing')).toBe(false);
    expect(open({ genres: ['swing'] }, swingy, 151).has('swing')).toBe(true);
  });
});

describe('a bare umbrella from the store, refined by the artist within its family', () => {
  it('"Alternative" + the artist\'s punk dances punk-flavoured alternative; the tag keeps the label', () => {
    const s = resolveSongStyle({ genre: 'Alternative', genres: ['alternative'], genreLevels: ['song'], artistGenres: ['punk', 'alternative', 'pop rock'] }, { traits: HEAVY, bpm: 93 });
    expect(styleGenres(s).has('punk')).toBe(true);
    expect(styleGenres(s).has('metal')).toBe(false);
    expect(styleLabel(s)).toMatch(/^Alternative/);
  });

  it('never across families: "Country" + the artist\'s hip hop stays country', () => {
    const s = resolveSongStyle({ genre: 'Country', genres: ['country'], artistGenres: ['hip hop', 'trap'] });
    expect(styleLabel(s)).toBe('Country');
    expect(styleGenres(s).has('hiphop')).toBe(false);
    expect(styleGenres(s).has('trap')).toBe(false);
  });

  it('only when the song level is the bare tag: a song-level name keeps the artist a weak score', () => {
    const bare = resolveSongStyle({ genre: 'Alternative', genres: ['alternative'], artistGenres: ['punk'] });
    const named = resolveSongStyle({ genre: 'Alternative', genres: ['indie rock', 'alternative'], artistGenres: ['punk'] });
    expect(bare.subs?.punk ?? 0).toBeGreaterThanOrEqual(0.5);
    expect(named.subs?.punk ?? 0).toBeLessThan(0.5);
    // A specific tag is not bare: "R&B/Soul" + the artist's trap stays R&B.
    expect(styleGenres(resolveSongStyle({ genre: 'R&B/Soul', genres: ['R&B'], artistGenres: ['trap'] })).has('trap')).toBe(false);
  });

  it('the artist outside the family (pop vs R&B, house) stays the weak score', () => {
    const s = resolveSongStyle({ genre: 'Pop', genres: ['pop'], artistGenres: ['R&B', 'house'] });
    expect(styleGenres(s).has('rnb')).toBe(false);
    expect(styleGenres(s).has('house')).toBe(false);
    expect(styleLabel(s)).toBe('Pop');
  });
});

describe('genre names that opened the wrong set', () => {
  it('plain / Western folk is gentle; a named folk tradition dances the world folk set', () => {
    const gentle: SongTraits = { calm: 0.57, drive: 0.69, fourFloor: 0, halfFeel: 0.85, heavy: 0, minor: 0.1, intensity: 0.1 };
    expect(open({ genre: 'Folk', genres: ['folk'], artistGenres: ['folk'] }, gentle, 101).has('folk')).toBe(false);
    expect(open({ genre: 'Folk', genres: ['folk'] }, gentle, 101).has('country')).toBe(false);
    for (const g of ['Russian folk', 'Irish folk', 'polka', 'klezmer', 'traditional folk', 'Celtic']) expect(open({ genres: [g] }).has('folk'), g).toBe(true);
    // Bright folk (major key, a steady unsoft beat) dances the country floor; minor folk stays gentle.
    const bright: SongTraits = { calm: 0.3, drive: 0.8, fourFloor: 0.2, heavy: 0.05, minor: 0.15, intensity: 0.55 };
    expect(open({ genre: 'Folk', genres: ['folk'] }, bright, 112).has('country')).toBe(true);
    expect(open({ genre: 'Folk', genres: ['folk'] }, { ...bright, minor: 0.8 }, 112).has('country')).toBe(false);
    // Not from a folk name further down a pop list.
    expect(open({ genres: ['soft rock', 'folk pop', 'pop'] }, bright, 112).has('country')).toBe(false);
  });

  it('jazz is the swing set or smooth flow, never disco & funk', () => {
    for (const genres of [['jazz', 'big band'], ['bop', 'jazz'], ['vocal jazz', 'swing'], ['cool jazz']]) {
      const o = open({ genre: 'Jazz', genres });
      expect(o.has('discofunk'), genres.join()).toBe(false);
      expect(o.has('swing'), genres.join()).toBe(true);
    }
    expect(styleLabel(resolveSongStyle({ genre: 'Pop', genres: ['vocal jazz', 'traditional pop'] }))).not.toMatch(/Funk/);
  });

  it('sertanejo is Brazil\'s country music, not samba', () => {
    const o = open({ genre: 'Sertanejo', genres: ['sertanejo'] });
    expect(o.has('country')).toBe(true);
    expect(o.has('brazil')).toBe(false);
    expect(styleLabel(resolveSongStyle({ genre: 'Sertanejo' }))).toBe('Sertanejo');
    expect(open({ genres: ['samba'] }).has('brazil')).toBe(true);
  });

  it('C-pop / Mandopop: its own scene, no K-pop aegyo set; K-pop and J-pop keep theirs', () => {
    for (const g of ['C-pop', 'Mandopop', 'Cantopop']) {
      const s = resolveSongStyle({ genre: g, genres: [g] });
      expect(styleLabel(s), g).toBe('C-pop');
      expect(styleGenres(s).has('kpop'), g).toBe(false);
    }
    expect(open({ genres: ['K-pop'] }).has('kpop')).toBe(true);
    expect(open({ genres: ['J-pop'] }).has('kpop')).toBe(true);
  });
});

describe('song forms ("ballad") are calm, soft, slow evidence, not a set', () => {
  it('a song-level "ballad" after the genres softens the song and slows its tempo hint, opening nothing', () => {
    const traits: SongTraits = { calm: 0.18, drive: 0.75, fourFloor: 0, halfFeel: 0.09, heavy: 0, minor: 0.05, intensity: 0.4 };
    const base: SongInfo = { genre: 'Pop', genres: ['pop', 'soft rock', 'electronic'], genreLevels: ['song', 'album', 'song'] };
    const plain = resolveSongStyle(base, { traits, bpm: 140 });
    const ballad = resolveSongStyle({ ...base, genres: [...base.genres!, 'ballad'], genreLevels: [...base.genreLevels!, 'song'] }, { traits, bpm: 140 });
    expect(ballad.soft!).toBeGreaterThan(plain.soft! + 0.15);
    expect(ballad.calm!).toBeGreaterThan(plain.calm!);
    expect(ballad.bpm!).toBeLessThan(plain.bpm!);
    expect([...styleGenres(ballad)].filter((g) => !styleGenres(plain).has(g) && g !== 'lyrical')).toEqual([]);
    // The genres still name the song.
    expect(styleLabel(ballad)).toBe(styleLabel(plain));
  });
});
