import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import gangnamMap from '../../../public/beatmaps/iSF26HsmeRI.json';
import levitatingMap from '../../../public/beatmaps/1j_XvebOg4c.json';
import partyRockMap from '../../../public/beatmaps/zIh5AHxh-Ok.json';
import onTheFloorMap from '../../../public/beatmaps/9lybsz-7TFM.json';
import { generateDuoRoutine } from './duo';
import {
  LivePlanner, MAX_NAME, SPICE_ALLOWANCE, generateRoutine, shortName, specialtyFits, specialtyOf, styleTraditions,
  type Intensity, type MoveInstance, type Routine,
} from './generator';
import { MOVES, findMove } from './moves';
import { getPool } from './pool';
import { resolveSongStyle, type SongInfo, type SongStyle } from './songStyle';
import { songMap } from './testutil';

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];

function covered(r: Routine): void {
  let b = 0;
  for (const i of r.instances) {
    expect(i.start).toBe(b);
    expect(i.span).toBeGreaterThan(0);
    b += i.span;
  }
  expect(b).toBe(r.beats);
}

function sigRuns(r: Routine): string[] {
  // Each maximal run of consecutive signature instances, as a string.
  const runs: string[] = [];
  let cur: MoveInstance[] = [];
  for (const i of r.instances) {
    if (i.sig) cur.push(i);
    else if (cur.length) {
      runs.push(cur.map((x) => `${x.move.id}${x.mirror ? 'L' : 'R'}`).join(' '));
      cur = [];
    }
  }
  if (cur.length) runs.push(cur.map((x) => `${x.move.id}${x.mirror ? 'L' : 'R'}`).join(' '));
  return runs;
}

const beatsOf = (r: Routine, f: (i: MoveInstance) => boolean) => r.instances.filter(f).reduce((t, i) => t + i.span, 0);

describe('generateRoutine', () => {
  const map = songMap(120);
  const downbeats = new Set(map.downbeats);

  it('covers every beat exactly once, for every level and tempo', () => {
    for (const bpm of [72, 100, 120, 128, 140, 165, 178]) {
      for (const lv of LEVELS) covered(generateRoutine(songMap(bpm, `v${bpm}`), lv));
    }
  });

  it('starts units (and every 4-beat move) on downbeats', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      for (const i of r.instances) {
        if (i.unitStart) expect(downbeats.has(i.start)).toBe(true);
        if (i.move.beats === 4 && !i.half) expect(downbeats.has(i.start)).toBe(true);
      }
    }
  });

  it('handles irregular bars, pickups and missing downbeats', () => {
    const m = songMap(124, 'odd');
    m.downbeats = m.downbeats.filter((_, k) => k % 7 !== 3).map((d) => d + 1);
    for (const lv of LEVELS) covered(generateRoutine(m, lv));
    const none = { ...songMap(124, 'nodb'), downbeats: [] };
    covered(generateRoutine(none, 'cardio'));
    const empty = { ...songMap(124, 'empty'), beats: [], downbeats: [] };
    expect(generateRoutine(empty, 'cardio').instances.length).toBe(0);
  });

  it('mixes intensity measurably; Easy never jumps', () => {
    const songs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => songMap(122, id));
    const frac = (lv: Intensity, f: (i: MoveInstance) => boolean) => {
      let hit = 0;
      let all = 0;
      for (const s of songs) {
        const r = generateRoutine(s, lv);
        hit += beatsOf(r, f);
        all += r.beats;
      }
      return hit / all;
    };
    const impact = LEVELS.map((lv) => frac(lv, (i) => i.move.impact));
    expect(impact[0]).toBeLessThan(impact[1]);
    expect(impact[1]).toBeLessThan(impact[2]);
    expect(frac('chill', (i) => i.move.jump)).toBe(0);
    expect(frac('sweaty', (i) => i.move.jump)).toBeGreaterThan(frac('cardio', (i) => i.move.jump));
  });

  it('drives difficulty and change rate by level', () => {
    const songs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => songMap(122, id));
    const stats = LEVELS.map((lv) => {
      let dSum = 0;
      let n = 0;
      let distinctPerMin = 0;
      let changesPerMin = 0;
      let maxD = 0;
      for (const s of songs) {
        const r = generateRoutine(s, lv);
        const mins = (s.beats[s.beats.length - 1] - s.beats[0]) / 60;
        const dance = r.instances.filter((i) => !i.move.idle && !i.move.cooldown);
        for (const i of dance) {
          dSum += i.move.difficulty * i.span;
          n += i.span;
          maxD = Math.max(maxD, i.move.difficulty);
        }
        distinctPerMin += new Set(dance.map((i) => i.move.id)).size / mins;
        let ch = 0;
        for (let k = 1; k < dance.length; k++) if (dance[k].move !== dance[k - 1].move) ch++;
        changesPerMin += ch / mins;
      }
      return { meanD: dSum / n, distinct: distinctPerMin / songs.length, changes: changesPerMin / songs.length, maxD };
    });
    expect(stats[0].maxD).toBe(1);
    expect(stats[1].maxD).toBeLessThanOrEqual(2);
    expect(stats[2].maxD).toBe(3);
    expect(stats[0].meanD).toBeLessThan(stats[1].meanD);
    expect(stats[1].meanD).toBeLessThan(stats[2].meanD);
    expect(stats[0].distinct).toBeLessThan(stats[1].distinct);
    expect(stats[1].distinct).toBeLessThan(stats[2].distinct);
    expect(stats[0].changes).toBeLessThan(stats[2].changes);
  });

  it('Easy holds each move for at least 4 bars (outside fillers)', () => {
    const r = generateRoutine(map, 'chill');
    let runStart = 0;
    for (let k = 1; k <= r.instances.length; k++) {
      const prev = r.instances[k - 1];
      const cur = r.instances[k];
      if (!cur || cur.move !== prev.move || cur.sig !== prev.sig) {
        const len = prev.start + prev.span - r.instances[runStart].start;
        if (!prev.move.idle && !prev.sig && !prev.fill) expect(len).toBeGreaterThanOrEqual(16);
        runStart = k;
      }
    }
  });

  it('opens every chorus/drop with the same signature combo', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      expect(r.signature.length).toBeGreaterThan(0);
      const sigBeats = r.signature.reduce((t, s) => t + s.move.beats, 0);
      expect(sigBeats).toBe(8);
      const one = r.signature.map((s) => `${s.move.id}${s.mirror ? 'L' : 'R'}`).join(' ');
      // Each peak section starts with the combo.
      for (const sec of map.sections.filter((s) => s.type === 'chorus' || s.type === 'drop')) {
        const startBeat = map.beats.findIndex((t) => t >= sec.start - 1e-6);
        const first = r.instances.findIndex((i) => i.start === startBeat);
        expect(first).toBeGreaterThanOrEqual(0);
        const seq = r.instances.slice(first, first + r.signature.length).map((x) => `${x.move.id}${x.mirror ? 'L' : 'R'}`).join(' ');
        expect(seq).toBe(one);
        expect(r.instances[first].sig).toBe(true);
      }
      // And the combo only ever appears as whole copies of the same sequence.
      for (const run of sigRuns(r)) expect(run.split(' ').length % r.signature.length).toBe(0);
      for (const run of sigRuns(r)) expect(run.startsWith(one)).toBe(true);
    }
  });

  it('cools down in the outro and warms up at the start', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      const outro = r.instances.filter((i) => i.section === 'outro' && !i.move.idle);
      expect(outro.length).toBeGreaterThan(0);
      // Stretches, or the calm flows of the cooldown file (low intensity).
      for (const i of outro) expect(i.move.cooldown || (i.move.file === 'cooldown' && i.move.level === 'low')).toBe(true);
      const firstBars = r.instances.filter((i) => i.start < 32);
      for (const i of firstBars) expect(i.move.level).not.toBe('high');
    }
    // A song without an outro still ends with a cooldown.
    const noOutro = songMap(118, 'no-outro', [['verse', 16, 0.5], ['chorus', 16, 0.8], ['verse', 8, 0.5]]);
    const r = generateRoutine(noOutro, 'cardio');
    const last = r.instances[r.instances.length - 1].move;
    expect(last.cooldown || last.idle || (last.file === 'cooldown' && last.level === 'low')).toBe(true);
  });

  it('is deterministic per (song, level) and differs between songs', () => {
    const key = (r: Routine) => r.instances.map((i) => `${i.move.id}${i.mirror ? 'L' : ''}@${i.start}`).join(',');
    for (const lv of LEVELS) {
      expect(key(generateRoutine(songMap(120, 'same'), lv))).toBe(key(generateRoutine(songMap(120, 'same'), lv)));
      expect(key(generateRoutine(songMap(120, 'one'), lv))).not.toBe(key(generateRoutine(songMap(120, 'two'), lv)));
    }
    expect(key(generateRoutine(songMap(120, 'same'), 'chill'))).not.toBe(key(generateRoutine(songMap(120, 'same'), 'sweaty')));
  });

  it('performs moves at half time above 150 BPM', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(songMap(170, 'fast'), lv);
      expect(r.half).toBe(true);
      for (const i of r.instances) {
        if (!i.move.idle) {
          expect(i.half).toBe(true);
          expect(i.span).toBe(i.move.beats * 2);
        }
      }
      const slow = generateRoutine(songMap(128, 'fast'), lv);
      expect(slow.half).toBe(false);
    }
  });

  it('never repeats the same move across a phrase boundary (Medium/Hard)', () => {
    for (const lv of ['cardio', 'sweaty'] as const) {
      const r = generateRoutine(map, lv);
      const dance = r.instances.filter((i) => !i.move.idle && !i.sig && !i.move.cooldown);
      for (let k = 1; k < dance.length; k++) {
        if (dance[k].phrase !== dance[k - 1].phrase) expect(dance[k].move).not.toBe(dance[k - 1].move);
      }
    }
  });

  it('returns travelling moves to centre at unit ends', () => {
    for (const lv of LEVELS) {
      const r = generateRoutine(map, lv);
      for (let k = 0; k < r.instances.length; k++) {
        const i = r.instances[k];
        const next = r.instances[k + 1];
        const end = i.origin + i.move.travel * (i.mirror ? -1 : 1);
        if (!next || next.unitStart) expect(Math.abs(end)).toBeLessThan(1e-9);
        else expect(Math.abs(next.origin - end)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('LivePlanner', () => {
  it('extends phrase by phrase, contiguous, with periodic bigger phrases', () => {
    const out: MoveInstance[] = [];
    const lp = new LivePlanner('live-song', 'cardio', 124, 6);
    lp.extend(out, 20);
    expect(out[0].start).toBe(6);
    const n1 = out.length;
    expect(lp.end).toBeGreaterThanOrEqual(20);
    lp.extend(out, 400);
    expect(out.length).toBeGreaterThan(n1);
    let b = 6;
    for (const i of out) {
      expect(i.start).toBe(b);
      b += i.span;
    }
    expect(out.some((i) => i.sig)).toBe(true);
    expect(out.some((i) => i.section === 'chorus')).toBe(true);
    // Deterministic.
    const out2: MoveInstance[] = [];
    const lp2 = new LivePlanner('live-song', 'cardio', 124, 6);
    lp2.extend(out2, 400);
    expect(out2.map((i) => i.move.id)).toEqual(out.map((i) => i.move.id));
  });
});

// ---------------------------------------------------------------------------
// Specialty moves (tradition-specific steps) and gap fills

const REAL_MAPS = [gangnamMap, levitatingMap, partyRockMap, onTheFloorMap] as unknown as BeatMap[];
const styleOf = (info: SongInfo): SongStyle => resolveSongStyle(info);
/** Mainstream styles: their routines draw from their own families, specialty moves only as Hard's spice. */
const MAINSTREAM: [string, SongInfo][] = [
  ['kpop/party', { videoId: 'iSF26HsmeRI', title: 'Gangnam Style', artist: 'PSY' }],
  ['disco', { videoId: '-sVB91NTa4A', title: 'Dancing Queen', artist: 'ABBA' }],
  ['rock', { videoId: '-qZxMY7FZf8', title: 'Numb', artist: 'Linkin Park' }],
  ['funk', { videoId: '7CTJcHjkq0E', title: 'Billie Jean', artist: 'Michael Jackson' }],
  ['pop fallback', { videoId: 'unknown-song', title: 'Some Song', artist: 'Nobody Known' }],
];
/** Tradition-led styles: their specialty moves must show up. */
const TRADITIONAL: [string, SongInfo, string][] = [
  ['latin', { videoId: 'latin-song', title: 'Hips', artist: 'Shakira', genre: 'Latin' }, 'latin'],
  ['afro', { videoId: 'afro-song', title: 'Last Last', artist: 'Burna Boy', genre: 'Afrobeats' }, 'afro'],
  ['country', { videoId: 'country-song', title: 'Any Man of Mine', artist: 'Shania Twain', genre: 'Country' }, 'country'],
  ['swing', { videoId: 'swing-song', title: 'Johnny B. Goode', artist: 'Chuck Berry', genre: "Rock 'n' Roll" }, 'swing'],
  ['bollywood', { videoId: 'bolly-song', title: 'Jai Ho', artist: 'A. R. Rahman', genre: 'Bollywood' }, 'bollywood'],
];
const mapsFor = (id: string): BeatMap[] => [songMap(122, id), songMap(96, `${id}-b`), { ...(REAL_MAPS[hashLen(id) % REAL_MAPS.length]), videoId: id }];
const hashLen = (s: string) => [...s].reduce((t, c) => t + c.charCodeAt(0), 0);

describe('specialty moves', () => {
  it('are identified from tradition themes, the latin traditional subset and the world / retro / afro files', () => {
    const sp = MOVES.filter((m) => specialtyOf(m).length > 0);
    expect(sp.length).toBeGreaterThan(120);
    for (const m of MOVES) if (['world', 'retro', 'afro'].includes(m.file)) expect(specialtyOf(m).length, m.id).toBeGreaterThan(0);
    for (const id of ['kathak-tatkar', 'hat-dance-heels', 'pas-de-basque', 'chaffa', 'tango-walk', 'para-para-sweep', 'cumbia-step', 'horon-shimmy', 'clogging-basic', 'merengue-turn', 'side-salsa', 'sailor-step', 'gaze-afar', 'thumka', 'charleston']) {
      expect(specialtyOf(findMove(id)!).length, id).toBeGreaterThan(0);
    }
    // Generic grooves that merely carry a secondary family tag stay ordinary.
    for (const id of ['hip-sway', 'booty-shake', 'hip-shake', 'reggaeton-bounce', 'gallop', 'big-heart', 'hula-hoop', 'conga']) expect(specialtyOf(findMove(id)!), id).toEqual([]);
    // Variations inherit their base move's traditions.
    for (const v of getPool().variations) {
      const base = findMove(v.base);
      if (base) for (const t of specialtyOf(base)) expect(specialtyOf(v)).toContain(t);
    }
  });

  it('opens traditions from style themes and a latin-led family mix only', () => {
    expect([...styleTraditions(styleOf(MAINSTREAM[0][1]))]).toEqual([]);
    expect(styleTraditions(styleOf(TRADITIONAL[0][1])).has('latin')).toBe(true);
    expect(styleTraditions(styleOf(TRADITIONAL[1][1])).has('afro')).toBe(true);
    // Afrobeats / dancehall use the latin family for hip grooves: no salsa or bachata steps.
    expect(styleTraditions(styleOf(TRADITIONAL[1][1])).has('latin')).toBe(false);
    expect(styleTraditions(styleOf(TRADITIONAL[2][1])).has('country')).toBe(true);
    // A pop song with a latin tinge doesn't get salsa / merengue steps.
    expect(styleTraditions(styleOf({ videoId: '_dK2tDK9grQ', title: 'Shape of You', artist: 'Ed Sheeran' })).has('latin')).toBe(false);
  });

  it('keeps non-matching traditions out of mainstream songs (Hard: at most the spice allowance, never in the chorus combo)', () => {
    for (const [name, info] of MAINSTREAM) {
      const style = styleOf(info);
      const open = styleTraditions(style);
      for (const map of mapsFor(info.videoId!)) {
        for (const lv of LEVELS) {
          const r = generateRoutine(map, lv, { style });
          const out = r.instances.filter((i) => !specialtyFits(i.move, open));
          const bases = new Set(out.map((i) => i.move.base));
          expect(bases.size, `${name} ${lv}: ${[...bases].join(', ')}`).toBeLessThanOrEqual(SPICE_ALLOWANCE[lv]);
          expect(out.some((i) => i.sig || i.section === 'outro')).toBe(false);
          expect(r.signature.every((s) => specialtyFits(s.move, open))).toBe(true);
          if (lv !== 'sweaty') expect(out.length).toBe(0);
          // The two-player routine follows the same gating.
          const duo = generateDuoRoutine(map, lv, { style });
          const duoOut = new Set([...duo.p1, ...duo.p2].filter((i) => !specialtyFits(i.move, open)).map((i) => i.move.base));
          expect(duoOut.size, `${name} duo ${lv}: ${[...duoOut].join(', ')}`).toBeLessThanOrEqual(SPICE_ALLOWANCE[lv]);
        }
      }
    }
  });

  it('gives tradition-led songs their specialty moves prominently', () => {
    for (const [name, info, tradition] of TRADITIONAL) {
      const style = styleOf(info);
      const open = styleTraditions(style);
      expect(open.has(tradition as never), name).toBe(true);
      for (const lv of ['cardio', 'sweaty'] as const) {
        let match = 0, total = 0;
        for (const map of mapsFor(info.videoId!)) {
          const r = generateRoutine(map, lv, { style });
          for (const i of r.instances) {
            total += i.span;
            if (specialtyOf(i.move).some((t) => t === tradition || open.has(t))) match += i.span;
            expect(specialtyFits(i.move, open) || lv === 'sweaty', `${name} ${lv} ${i.move.id}`).toBe(true);
          }
        }
        expect(match / total, `${name} ${lv}`).toBeGreaterThan(0.08);
      }
    }
  });

  it('keeps the fallback mix varied', () => {
    const r = generateRoutine(songMap(120, 'fallback-variety'), 'cardio');
    const dance = r.instances.filter((i) => !i.move.cooldown && !i.fill);
    expect(new Set(dance.map((i) => i.move.base)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(dance.map((i) => i.move.families[0])).size).toBeGreaterThanOrEqual(4);
  });
});

describe('gap fills', () => {
  it('never shows the idle groove inside a routine (odd bars, pickups, real beat maps)', () => {
    const odd = songMap(124, 'odd-gaps');
    odd.downbeats = odd.downbeats.filter((_, k) => k % 7 !== 3).map((d) => d + 1);
    const maps = [...REAL_MAPS, odd, songMap(170, 'fast-gaps'), songMap(88, 'slow-gaps')];
    for (const map of maps) {
      for (const lv of LEVELS) {
        const r = generateRoutine(map, lv);
        covered(r);
        expect(r.instances.filter((i) => i.move.idle).map((i) => i.start), `${map.videoId} ${lv}`).toEqual([]);
        for (const i of r.instances) if (i.fill) expect(i.move.travel).toBe(0);
        const duo = generateDuoRoutine(map, lv);
        // P2 may wait (call / canon / split kinds); P1 never idles mid-routine except while waiting on a call.
        const kinds = new Map(duo.phrases.map((p) => [p.start, p.kind]));
        for (const i of duo.p1) if (i.move.idle) expect(['call', 'canon', 'split'].includes([...kinds.entries()].filter(([s]) => s <= i.start).pop()?.[1] ?? ''), `${map.videoId} ${lv} duo p1 @${i.start}`).toBe(true);
      }
    }
  });

  it('fills a lone leftover beat with a 1-beat move of the style', () => {
    const odd = songMap(120, 'lone-beat');
    // Every 4th bar has 5 beats.
    const db: number[] = [];
    for (let b = 0, k = 0; b < odd.beats.length; k++) {
      db.push(b);
      b += k % 4 === 3 ? 5 : 4;
    }
    odd.downbeats = db;
    const r = generateRoutine(odd, 'cardio');
    const fills = r.instances.filter((i) => i.fill);
    expect(fills.length).toBeGreaterThan(0);
    for (const f of fills) expect(f.move.idle).toBe(false);
  });

  it('is deterministic', () => {
    for (const map of REAL_MAPS) {
      const a = generateRoutine(map, 'sweaty').instances.map((i) => `${i.move.id}@${i.start}`);
      const b = generateRoutine(map, 'sweaty').instances.map((i) => `${i.move.id}@${i.start}`);
      expect(a).toEqual(b);
    }
  });
});

describe('display names', () => {
  it(`keeps variation names within ${MAX_NAME} characters`, () => {
    const p = getPool();
    for (const v of [...p.variations, ...p.ornaments.all()]) {
      const n = shortName(v.name);
      const base = findMove(v.base);
      if (n.length > MAX_NAME) expect(n, v.id).toBe(base?.name);
      else expect(n.length).toBeLessThanOrEqual(MAX_NAME);
    }
    expect(shortName('Bachata Side · bachata belly')).toBe('Bachata Side · belly');
    expect(shortName('Bankhead Bounce · double time')).toBe('Bankhead Bounce · double');
    expect(shortName('Bhangra Hop · peace by the eyes')).toBe('Bhangra Hop');
    expect(shortName('Hip Sway · low')).toBe('Hip Sway · low');
  });

  it('routines only show shortened variation names', () => {
    for (const map of REAL_MAPS) {
      for (const lv of LEVELS) {
        for (const i of generateRoutine(map, lv).instances) {
          if (i.move.base !== i.move.id) expect(i.move.name.length, i.move.name).toBeLessThanOrEqual(Math.max(MAX_NAME, findMove(i.move.base)?.name.length ?? 0));
        }
      }
    }
  });
});
