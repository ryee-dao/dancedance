import { describe, expect, it } from 'vitest';
import { generateDuoRoutine } from './duo';
import { TONE_FLOOR, TONE_NEUTRAL, TONE_SOFT, calmToned, generateRoutine, styleGenres, toneFits, toneGate, type Intensity, type MoveInstance, type Routine } from './generator';
import { FAMILY_GENRE, GENRES, SUB_STYLES, THEME_GENRES, type Genre, type SubStyle } from './genres';
import type { Family, Theme } from './families';
import { MOVES } from './moves';
import { publishedSongs } from './published.testutil';
import { resolveSongStyle, type SongStyle } from './songStyle';
import { songMap } from './testutil';
import { moveAggression } from './weights';

/**
 * The tone gate (generator.ts toneGate / toneFits) as a property: genre decides a routine's flavour, the song's
 * audio its tone, and no picked move breaks the tone, whatever set it came from, in both directions (nothing too
 * loud anywhere; no calm-toned move in the main sections of a song with no calm tone). Over every published song
 * (styles as the app resolves them) and a synthetic sweep of every genre set forced open under quiet, mid and loud
 * audio, every level.
 */

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];
const danced = (xs: readonly MoveInstance[]) => xs.filter((i) => !i.move.idle);
/** The main sections: not the intro, the outro or the warm-up (the routine's first phrase). */
function main(xs: readonly MoveInstance[]): MoveInstance[] {
  const d = xs.filter((i) => !i.move.idle && !i.move.cooldown);
  const first = Math.min(...d.filter((i) => i.phrase >= 0).map((i) => i.phrase));
  return d.filter((i) => i.section !== 'intro' && i.section !== 'outro' && i.phrase !== first);
}

/** Every way a routine breaks its song's tone (empty = none). */
function violations(r: Routine, style: SongStyle, tag: string): string[] {
  const gate = toneGate(style, r.bpm);
  const bad: string[] = [];
  for (const i of danced(r.instances)) if (!toneFits(i.move, gate, false)) bad.push(`${tag}: ${i.move.id} aggression ${moveAggression(i.move).toFixed(2)} > ${gate.ceiling.toFixed(2)} @${i.start}`);
  for (const x of r.signature) if (!toneFits(x.move, gate)) bad.push(`${tag}: combo ${x.move.id}`);
  for (const i of main(r.instances)) {
    if (!i.sig && !toneFits(i.move, gate)) bad.push(`${tag}: ${calmToned(i.move) ? 'calm-toned' : 'too soft'} ${i.move.id} (${moveAggression(i.move).toFixed(2)}) in the ${i.section} @${i.start}`);
  }
  return bad;
}

describe('the tone gate', () => {
  it('is set by the audio only: no ceiling without audio intensity or on an ordinary or loud song, the floor on a quiet one', () => {
    const noAudio = resolveSongStyle({ genres: ['heavy metal'] }, { bpm: 70 });
    expect(toneGate(noAudio, 70).ceiling).toBe(1);
    const loud = resolveSongStyle({ genres: ['ballad', 'piano'] }, { bpm: 128, traits: { calm: 0.05, drive: 0.9, intensity: 0.85 } });
    expect(toneGate(loud, 128).ceiling).toBe(1);
    // The same genre names on a quiet recording: the floor.
    const quiet = resolveSongStyle({ genres: ['heavy metal', 'thrash metal'] }, { bpm: 72, traits: { calm: 0.9, drive: 0.15, intensity: 0.05 } });
    expect(toneGate(quiet, 72).ceiling).toBe(TONE_FLOOR);
  });

  it('keeps a song nothing is known of (no genre found, no audio read: "Mixed styles") to the middle', () => {
    const unknown = resolveSongStyle({ title: 'Back in Blood', artist: 'Someone' }, { bpm: 150 });
    expect(unknown.unknown).toBe(true);
    expect(toneGate(unknown, 150)).toMatchObject({ ceiling: TONE_NEUTRAL, floor: TONE_SOFT });
    // A genre name, or the audio, is enough to know the tone by: no neutral gate.
    expect(resolveSongStyle({ genre: 'Hip-Hop/Rap' }, { bpm: 150 }).unknown).toBeUndefined();
    expect(resolveSongStyle({}, { bpm: 150, traits: { calm: 0.1, drive: 0.9, intensity: 0.6 } }).unknown).toBeUndefined();
    const bad: string[] = [];
    let soft = 0;
    for (const bpm of [72, 100, 128, 150]) {
      const style = resolveSongStyle({ title: `Unknown ${bpm}`, artist: 'Someone' }, { bpm });
      for (const lv of LEVELS) {
        const r = generateRoutine(songMap(bpm, `unknown-${bpm}`), lv, { style });
        bad.push(...violations(r, style, `unknown ${bpm} ${lv}`));
        for (const i of main(r.instances)) if (moveAggression(i.move) < TONE_SOFT && !i.sig) soft++;
      }
    }
    expect(bad).toEqual([]);
    expect(soft).toBe(0);
  });

  it('lets the ballad set\'s own moves and the calm-moves file\'s flows through at the floor (measured)', () => {
    for (const m of MOVES.filter((x) => x.genre === 'lyrical')) expect(moveAggression(m), m.id).toBeLessThanOrEqual(TONE_FLOOR);
    // The calm-moves file's flows (calm-toned by their file; the port de bras ARMS also mark two kicks calm-toned, which
    // the gate, by what they measure, keeps off quiet songs all the same).
    const flows = MOVES.filter((x) => calmToned(x) && x.file === 'cooldown');
    expect(flows.length).toBeGreaterThan(10);
    for (const m of flows) expect(toneFits(m, { ceiling: TONE_FLOOR, calm: 1 }), m.id).toBe(true);
  });

  it('holds on every published song at every level, solo and duo (styles as the app resolves them)', () => {
    const bad: string[] = [];
    let n = 0;
    for (const s of publishedSongs()) {
      for (const lv of LEVELS) {
        const r = generateRoutine(s.map, lv, { style: s.style });
        bad.push(...violations(r, s.style, `${s.title} ${lv}`));
        const duo = generateDuoRoutine(s.map, lv, { style: s.style });
        const gate = toneGate(s.style, r.bpm);
        for (const i of [...danced(duo.p1), ...danced(duo.p2)]) if (!toneFits(i.move, gate, false)) bad.push(`${s.title} ${lv} duo: ${i.move.id}`);
        n++;
      }
    }
    expect(bad).toEqual([]);
    expect(n).toBeGreaterThan(250);
  });

  // Audio profiles: a ballad, a quiet groove (calm enough to keep every set open, too quiet for loud moves), an
  // ordinary song, a loud one.
  const PROFILES = {
    ballad: { bpm: 72, traits: { calm: 0.9, drive: 0.15, intensity: 0.05 } },
    quiet: { bpm: 84, traits: { calm: 0.35, drive: 0.3, intensity: 0.08 } },
    mid: { bpm: 105, traits: { calm: 0.4, drive: 0.5, intensity: 0.35 } },
    loud: { bpm: 128, traits: { calm: 0.05, drive: 0.9, intensity: 0.85 } },
  } as const;
  const FAMILY_OF = new Map<Genre, Family>(Object.entries(FAMILY_GENRE).map(([f, g]) => [g as Genre, f as Family]));
  const THEME_OF = new Map<Genre, Theme>(Object.entries(THEME_GENRES).map(([t, g]) => [g as Genre, t as Theme]));
  /** A style with the audio of `profile` that opens `g` (as a wrong genre guess would). */
  function forced(g: Genre, profile: keyof typeof PROFILES): SongStyle {
    const p = PROFILES[profile];
    const s = resolveSongStyle({ genres: ['pop'] }, p);
    const fam = FAMILY_OF.get(g);
    const theme = THEME_OF.get(g);
    if ((SUB_STYLES as readonly string[]).includes(g)) return { ...s, subs: { ...s.subs, [g as SubStyle]: 0.95 } };
    if (fam) return { ...s, families: { [fam]: 1, pop: 0.2 } };
    if (theme) return { ...s, themes: [theme] };
    return s;
  }

  it('holds over every genre set forced open under ballad, quiet, mid and loud audio, at every level; loud songs have no ceiling', () => {
    const bad: string[] = [];
    let opened = 0, quietGenre = 0;
    for (const g of GENRES) {
      for (const profile of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
        const style = forced(g, profile);
        const isOpen = styleGenres(style).has(g);
        if (isOpen) opened++;
        const { bpm } = PROFILES[profile];
        if (profile === 'loud') expect(toneGate(style, bpm).ceiling, g).toBe(1);
        for (const lv of LEVELS) {
          const r = generateRoutine(songMap(bpm, `gate-${g}-${profile}`), lv, { style });
          bad.push(...violations(r, style, `${g} ${profile} ${lv}`));
          // A wrong guess costs only flavour: the open set still dances what of it fits.
          if (isOpen && profile === 'quiet' && r.instances.some((i) => i.move.genre === g)) quietGenre++;
        }
      }
    }
    expect(bad).toEqual([]);
    expect(opened).toBeGreaterThan(GENRES.length * 2);
    expect(quietGenre).toBeGreaterThan(GENRES.length);
  });
});
