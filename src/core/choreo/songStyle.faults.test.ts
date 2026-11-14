/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SongTraits } from './songTraits';
import { danceFeel, generateRoutine, styleGenres, tierBeats } from './generator';
import { genreDepth, genreOpenness } from './genres';
import { keywordThemes, resolveSongStyle, styleLabel, type SongInfo } from './songStyle';
import { songMap } from './testutil';

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
    // Face to Face: counted 93 with a strong double (0.79): the audio's drive at 187 is punk's.
    const s = resolveSongStyle({ genre: 'Alternative', genres: ['alternative'], genreLevels: ['song'], artistGenres: ['punk', 'alternative', 'pop rock'] }, { traits: { ...HEAVY, doubleTempo: 0.79 }, bpm: 93 });
    expect(styleGenres(s).has('punk')).toBe(true);
    expect(styleGenres(s).has('metal')).toBe(false);
    expect(styleLabel(s)).toMatch(/^Alternative/);
  });

  it('the artist\'s genre opens a set only as far as the song\'s audio agrees where it can tell (round three)', () => {
    // SlugWeed "Landway": "Alternative" + the artist's "metal" on a four-on-the-floor track with no distorted guitars.
    const clean: SongTraits = { calm: 0, drive: 0.96, fourFloor: 1, halfFeel: 0, bass: 0.73, hats: 1, swing: 0, syncop: 0.93, heavy: 0, minor: 0.66, intensity: 0.71, doubleTempo: 0.18 };
    const metal = resolveSongStyle({ genre: 'Alternative', genres: ['alternative'], artistGenres: ['metal'] }, { traits: clean, bpm: 81 });
    expect(styleGenres(metal).has('metal')).toBe(false);
    expect(metal.subs?.metal ?? 0).toBeGreaterThan(0.25);
    expect(styleLabel(metal)).toBe('Alternative');
    expect(styleGenres(resolveSongStyle({ genre: 'Alternative', genres: ['alternative'], artistGenres: ['metal'] }, { traits: HEAVY, bpm: 120 })).has('metal')).toBe(true);
    // The punk drive heard at neither octave: a flavour.
    expect(styleGenres(resolveSongStyle({ genre: 'Alternative', genres: ['alternative'], artistGenres: ['punk'] }, { traits: { ...HEAVY, doubleTempo: 0 }, bpm: 93 })).has('punk')).toBe(false);
    // Anuel AA "Little Demon": the store's "Urbano latino" is an umbrella; the artist's reggaeton without dembow syncopation stays a flavour.
    const trap: SongTraits = { calm: 0.21, drive: 0.98, fourFloor: 0, halfFeel: 0, bass: 0.85, hats: 0.8, swing: 0, syncop: 0.1, heavy: 0, minor: 0.76, intensity: 0.19, halfTempo: 0, doubleTempo: 0.14 };
    const anuel = resolveSongStyle({ genre: 'Urbano latino', genres: ['urbano'], genreLevels: ['song'], artistGenres: ['reggaeton', 'Latin trap', 'puerto rican hip hop', 'urbano'] }, { traits: trap, bpm: 100 });
    expect(styleGenres(anuel).has('reggaeton')).toBe(false);
    expect([...styleGenres(anuel)].sort()).toEqual(['hiphop', 'latin']);
    // ... while a dembow beat (syncopated, 95 BPM, bass) opens it from the umbrella alone.
    const dembow: SongTraits = { ...trap, syncop: 0.8, fourFloor: 0.1 };
    expect(styleGenres(resolveSongStyle({ genre: 'Urbano latino', genres: ['urbano'] }, { traits: dembow, bpm: 95 })).has('reggaeton')).toBe(true);
    // Where the audio can't tell (cumbia), the artist's name within the umbrella refines it: Fito Olivares, the store's
    // "Pop Latino" (the list spells it "Latin pop") and the artist's MusicBrainz "cumbia".
    const fito = resolveSongStyle({ genre: 'Pop Latino', genres: ['Latin pop'], genreLevels: ['song'], artistGenres: ['cumbia', 'latin', 'cumbia mexicana', 'tejano'] }, { traits: { ...FOUR, syncop: 0.09 }, bpm: 94 });
    expect(styleGenres(fito).has('cumbia')).toBe(true);
    expect(styleLabel(fito)).toMatch(/^Latin pop/);
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
    }
    expect(styleLabel(resolveSongStyle({ genre: 'Pop', genres: ['vocal jazz', 'traditional pop'] }))).not.toMatch(/Funk/);
  });

  it('the swing set needs the swing era\'s names or a lively song: a calm piano trio is jazz danced gently (round three)', () => {
    // Refraction "Never Since": an ECM-style piano trio, calm 0.43, intensity 0.04.
    const trio: SongTraits = { calm: 0.43, drive: 0.92, fourFloor: 0, halfFeel: 0.8, bass: 0.77, hats: 0.76, swing: 0, syncop: 0.09, heavy: 0, minor: 0, intensity: 0.04 };
    const lively: SongTraits = { calm: 0.2, drive: 0.85, fourFloor: 0.1, halfFeel: 0, bass: 0.5, hats: 0.6, swing: 0.6, syncop: 0.3, heavy: 0, minor: 0.3, intensity: 0.55 };
    for (const genres of [['jazz'], ['bop', 'jazz'], ['cool jazz']]) {
      expect(open({ genre: 'Jazz', genres }, trio, 102).has('swing'), genres.join()).toBe(false);
      expect(open({ genre: 'Jazz', genres }, lively, 160).has('swing'), genres.join()).toBe(true);
    }
    for (const genres of [['jazz', 'big band'], ['vocal jazz', 'swing'], ['jump blues'], ['dixieland']]) expect(open({ genre: 'Jazz', genres }, trio, 102).has('swing'), genres.join()).toBe(true);
    expect(styleLabel(resolveSongStyle({ genre: 'Jazz', genres: ['jazz'] }, { traits: trio, bpm: 102 }))).toBe('Jazz');
  });

  it('sertanejo is Brazil\'s country music, not samba', () => {
    const o = open({ genre: 'Sertanejo', genres: ['sertanejo'] });
    expect(o.has('country')).toBe(true);
    expect(o.has('brazil')).toBe(false);
    expect(styleLabel(resolveSongStyle({ genre: 'Sertanejo' }))).toBe('Sertanejo');
    expect(open({ genres: ['samba'] }).has('brazil')).toBe(true);
  });

  it('C-pop / Mandopop and J-pop: their own scenes, no K-pop aegyo set; K-pop and idol pop keep it', () => {
    for (const [g, label] of [['C-pop', 'C-pop'], ['Mandopop', 'C-pop'], ['Cantopop', 'C-pop'], ['J-Pop', 'J-pop'], ['J-pop', 'J-pop']]) {
      const s = resolveSongStyle({ genre: g, genres: [g] });
      expect(styleLabel(s), g).toBe(label);
      expect(styleGenres(s).has('kpop'), g).toBe(false);
    }
    expect(open({ genres: ['K-pop'] }).has('kpop')).toBe(true);
    // YOH KAMIYAMA "Bunny": the store's, the album's and the artist's "J-pop" are a scene, not idol pop.
    expect(open({ genre: 'J-Pop', genres: ['J-pop'], artistGenres: ['J-pop'] }).has('kpop')).toBe(false);
    // An idol name at the song level says the idol floor.
    expect(open({ genre: 'J-Pop', genres: ['idol pop', 'J-pop'] }).has('kpop')).toBe(true);
    // AKB48: the store's "J-Pop" shelf and the artist's MusicBrainz "idol" (3 votes, kept as "idol pop"): the idol
    // floor leads, the shelf keeps the label. Another pop name of the artist (J-rock, anime) does not.
    const akb = resolveSongStyle({ genre: 'J-Pop', genres: ['J-pop'], genreLevels: ['song'], artistGenres: ['J-pop', 'bubblegum pop', 'pop rock', 'idol pop'] });
    expect(styleGenres(akb).has('kpop')).toBe(true);
    expect(styleLabel(akb)).toBe('J-pop');
    expect(open({ genre: 'J-Pop', genres: ['J-pop'], artistGenres: ['J-rock', 'anime'] }).has('kpop')).toBe(false);
    // Not under a song-level name beyond the shelf, nor under K-pop (not a shelf).
    expect(open({ genre: 'J-Pop', genres: ['J-pop', 'J-rock'], artistGenres: ['idol pop'] }).has('kpop')).toBe(false);
  });

  it('Latin trap is the trap floor with Latin hips, leaning to reggaeton (as "urbano")', () => {
    const s = resolveSongStyle({ genre: 'Urbano latino', genres: ['Latin trap'] });
    expect(styleGenres(s).has('trap')).toBe(true);
    expect(styleGenres(s).has('reggaeton')).toBe(false);
    expect(s.subs?.reggaeton ?? 0).toBeGreaterThan(0.3);
    expect(styleGenres(resolveSongStyle({ genre: 'Urbano latino', genres: ['Latin trap', 'reggaeton'] })).has('reggaeton')).toBe(true);
  });
});

describe('round three: album names, title words, the tempo feel', () => {
  it('only the album\'s first dance of a family narrows the song\'s umbrella (Aventura: no salsa in the bachata)', () => {
    const s = resolveSongStyle({ genre: 'Música tropical', genres: ['bachata', 'tropical', 'latin', 'merengue', 'salsa'], genreLevels: ['album', 'song', 'song', 'album', 'album'] });
    const o = styleGenres(s);
    expect(o.has('bachata')).toBe(true);
    expect(o.has('salsa')).toBe(false);
    expect(o.has('merengue')).toBe(false);
    // A later album name saying the same dance still counts (son cubano after salsa).
    expect(styleGenres(resolveSongStyle({ genre: 'Latin', genres: ['latin', 'salsa', 'son cubano'], genreLevels: ['song', 'album', 'album'] })).has('salsa')).toBe(true);
  });

  it('title words are dance cues only at the head of the title or as a cue\'s object (every catalog title)', () => {
    const songs = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'public', 'songs.json'), 'utf8')) as { songs: { title: string }[] }).songs;
    const starter = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'starter.json'), 'utf8')) as { title: string }[];
    const titles = [...songs.map((s) => s.title), ...starter.map((s) => s.title)];
    expect(titles.length).toBeGreaterThan(100);
    const hits = Object.fromEntries(titles.map((t) => [t, keywordThemes(t)] as const).filter(([, th]) => th.length));
    expect(hits).toEqual({ "Hips Don't Lie (feat. Wyclef Jean)": ['hips', 'shake'], 'Shake It Off': ['shake'] });
    // Narration is no cue; the head word, a cue title's other words and a cue's body object are.
    for (const t of ['As the Sky Turns Black', 'One Step Closer', 'Guns for Hands', 'Party Rock Anthem', 'Conceal Your Game', 'One Step Beyond']) expect(keywordThemes(t), t).toEqual([]);
    expect(keywordThemes('Rock Around the Clock')).toEqual(['spin', 'stomp']);
    expect(keywordThemes('Do the Twist')).toEqual(['twist']);
    expect(keywordThemes('Move Your Body')).toEqual(['hips', 'shake']);
    expect(keywordThemes('Bunny')).toEqual(['animal']);
    // Music that is not dance music takes no title cue.
    expect(resolveSongStyle({ title: 'Jump Around', genre: 'Ambient' }).themes).toEqual([]);
  });

  it('the tempo feel: album-level names don\'t drive the half-time exemption; a double stays within its genre\'s reach', () => {
    // A soundtrack album's "trap EDM" beside a song-level "K-pop": the half-time backbeat still halves a ballad's count.
    const ballad: SongTraits = { calm: 0.35, drive: 0.63, fourFloor: 0, halfFeel: 1, bass: 0.83, hats: 0.55, swing: 0, syncop: 0.06, heavy: 0, minor: 0.24, intensity: 0.35, halfTempo: 1, doubleTempo: 0 };
    const free = resolveSongStyle({ genre: 'K-Pop', genres: ['K-pop', 'electropop', 'pop', 'trap EDM', 'R&B'], genreLevels: ['song', 'album', 'album', 'album', 'album'] }, { traits: ballad, bpm: 140 });
    expect(free.songLevel?.subs?.bass ?? 0).toBeLessThan(free.subs?.bass ?? 0);
    expect(danceFeel(free, 140, { half: 1, halfBackbeat: 1, double: 0 }, { intensity: 0.35, drive: 0.63 })).toBe(0.5);
    // The same name at the song level keeps the count (trap EDM is that at its counted tempo).
    const named = resolveSongStyle({ genre: 'Dance', genres: ['trap EDM'] }, { traits: { ...ballad, calm: 0.1, intensity: 0.8 }, bpm: 140 });
    expect(danceFeel(named, 140, { half: 1, halfBackbeat: 1, double: 0 }, { intensity: 0.8, drive: 0.63 })).toBe(1);
    // A strong double: pop at 80 steps at 160; a country-pop duet at 92 does not step at 185; skate punk at 93 does at 187.
    const loud = { intensity: 0.85, drive: 1 };
    const energetic: SongTraits = { calm: 0, drive: 1, fourFloor: 1, halfFeel: 0, bass: 0.5, hats: 0.75, swing: 0, syncop: 0.5, heavy: 0.3, minor: 0.4, intensity: 0.85, halfTempo: 0, doubleTempo: 1 };
    expect(danceFeel(resolveSongStyle({ genre: 'Pop', genres: ['dance-pop', 'pop'] }, { traits: energetic, bpm: 80 }), 80, { double: 1 }, loud)).toBe(2);
    expect(danceFeel(resolveSongStyle({ genre: 'Country', genres: ['country pop', 'country', 'pop'] }, { traits: energetic, bpm: 92.3 }), 92.3, { double: 1 }, loud)).toBe(1);
    expect(danceFeel(resolveSongStyle({ genre: 'Alternative', genres: ['skate punk'] }, { traits: { ...HEAVY, doubleTempo: 0.79 }, bpm: 93.4 }), 93.4, { double: 0.79 }, { intensity: 0.98, drive: 0.96 })).toBe(2);
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

describe('a tradition theme follows its name\'s place in the list', () => {
  const mraz: SongInfo = { genre: 'Pop', genres: ['soft rock', 'folk pop', 'surf pop', 'pop rock', 'pop', 'reggae'], artistGenres: ['pop rock', 'blue-eyed soul', 'pop', 'alternative rock'] };
  const at = (i: number): SongInfo => {
    const g = ['soft rock', 'folk pop', 'surf pop', 'pop rock', 'pop'];
    return { genre: 'Pop', genres: [...g.slice(0, i), 'reggae', ...g.slice(i)] };
  };
  const share = (s: ReturnType<typeof resolveSongStyle>) => {
    const t = tierBeats(generateRoutine(songMap(76, 'flavour'), 'cardio', { style: s }), s);
    return t.genre / (t.genre + t.global);
  };

  it('a sixth-listed "Reggae" under soft rock is a flavour: a little Caribbean, not the whole set', () => {
    const s = resolveSongStyle(mraz, { bpm: 76 });
    expect(s.themes).toContain('reggae');
    expect(s.themeW?.reggae).toBeLessThan(0.4);
    expect(genreOpenness(s).get('caribbean')!).toBeLessThan(0.4);
    expect(genreDepth(s)).toBeLessThan(0.4);
    expect(styleLabel(s)).not.toMatch(/reggae/i);
    expect(share(s)).toBeGreaterThan(0);
    expect(share(s)).toBeLessThan(0.25);
  });

  it('the first three names say the tradition whole; it fades from the fourth', () => {
    for (const i of [0, 1, 2]) {
      const s = resolveSongStyle(at(i), { bpm: 76 });
      expect(s.themeW?.reggae, `place ${i + 1}`).toBeUndefined();
      expect(genreDepth(s), `place ${i + 1}`).toBe(1);
    }
    const w = [3, 4, 5].map((i) => resolveSongStyle(at(i), { bpm: 76 }).themeW?.reggae ?? 1);
    expect(w[0]).toBeGreaterThan(w[1]);
    expect(w[1]).toBeGreaterThan(w[2]);
    expect(w[0]).toBeLessThan(1);
    // The whole set when the song leads with it, or the store's tag is all there is.
    expect(genreDepth(resolveSongStyle({ genre: 'Reggae' }, { bpm: 76 }))).toBe(1);
    expect(share(resolveSongStyle(at(1), { bpm: 76 }))).toBeGreaterThan(0.35);
  });

  it('a flavour theme beside another open set leaves that set whole', () => {
    const s = resolveSongStyle({ genre: 'Rock', genres: ['rock', 'hard rock', 'alternative rock', 'pop rock', 'pop punk', 'ska'] }, { bpm: 120 });
    const o = genreOpenness(s);
    expect(o.get('rock')).toBe(1);
    if (o.has('caribbean')) expect(o.get('caribbean')!).toBeLessThan(0.5);
    expect(genreDepth(s)).toBe(1);
  });
});
