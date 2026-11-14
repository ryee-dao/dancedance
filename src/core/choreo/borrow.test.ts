import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import billieJeanMap from '../../../public/beatmaps/7CTJcHjkq0E.json';
import { GENRE_MAX, GENRE_MIN, LEAD_SHARE, borrowPlan, generateRoutine, leadSubStyle, levelFactor, styleGenres, tierBeats, type Intensity, type Routine } from './generator';
import { BORROW_MAX, CALM_CLOSED, GENRE_MOVES, MIN_GENRE_SET, NEIGHBOURS, SUB_INFO, SUB_STANDALONE, borrowShare, borrowSources, calmGate, genreOpenness, isSubStyle, type Genre } from './genres';
import { resolveSongStyle, type SongStyle } from './songStyle';
import { songMap } from './testutil';
import { calmFactor, moveSmoothness } from './weights';

/**
 * Thin genre sets borrow fitting moves from their neighbours (genres.ts
 * NEIGHBOURS, generator.ts borrowPlan): a minority of their accents, less
 * the bigger the set, never from a closed set, never unsuited to the level
 * or the song's character, and songs of large sets exactly as before.
 */

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];

/** Songs of the thin styles: genre names and a tempo range. */
const THIN: Record<string, [string[], number, number][]> = {
  rnb: [[['R&B', 'pop'], 80, 112], [['Contemporary R&B'], 72, 104], [['Neo soul'], 70, 98]],
  edm: [[['EDM'], 124, 132], [['Big room house'], 126, 130], [['Trance'], 132, 140]],
  bass: [[['Dubstep'], 138, 142], [['Drum and bass'], 168, 176], [['Future bass'], 140, 160]],
  reggaeton: [[['Reggaeton'], 88, 100], [['Dembow'], 110, 124]],
  house: [[['Deep house'], 118, 124], [['UK garage'], 128, 134]],
  drill: [[['UK drill'], 138, 145]],
  amapiano: [[['Amapiano'], 108, 116]],
  punk: [[['Punk rock'], 150, 190], [['Pop punk'], 140, 176]],
  brazil: [[['Samba'], 95, 135], [['Baile funk'], 125, 135], [['Sertanejo'], 90, 130]],
};

interface Song { label: string; style: SongStyle; map: BeatMap }
/** n songs of a thin style: its genre-name variants, tempos across the range, calm 0.25..0.6. */
function thinSongs(name: string, n: number): Song[] {
  const vs = THIN[name];
  const out: Song[] = [];
  for (let k = 0; k < n; k++) {
    const [genres, lo, hi] = vs[k % vs.length];
    const bpm = Math.round(lo + ((hi - lo) * ((k * 7) % n)) / Math.max(1, n - 1));
    const calm = 0.25 + (0.35 * ((k * 5) % n)) / Math.max(1, n - 1);
    const id = `${name}-borrow-${k}`;
    out.push({ label: `${name} ${genres.join('/')} @${bpm} calm ${calm.toFixed(2)}`, style: resolveSongStyle({ videoId: id, title: `${name} ${k}`, genres }, { bpm, traits: { calm } }), map: songMap(bpm, id) });
  }
  return out;
}

/** A routine's genre time: own (open sets) and borrowed (moves of sets the song doesn't open), as tierBeats counts it. */
function genreSplit(r: Routine, style: SongStyle): { own: number; lent: number } {
  const open = styleGenres(style);
  const nod = new Set(style.signature ?? []);
  let own = 0, lent = 0;
  for (const i of r.instances) {
    if (!i.move.genre || i.move.idle || i.move.cooldown || i.section === 'outro' || (i.sig && nod.has(i.move.base))) continue;
    if (open.has(i.move.genre)) own += i.span;
    else lent += i.span;
  }
  return { own, lent };
}

const ids = (r: Routine) => r.instances.map((i) => `${i.move.id}@${i.start}`);

describe('borrowing: the share', () => {
  it('is at most half, shrinks as the set grows, and is none from SUB_STANDALONE moves on', () => {
    expect(borrowShare(0)).toBe(0);
    expect(borrowShare(1)).toBe(BORROW_MAX);
    expect(borrowShare(MIN_GENRE_SET)).toBe(BORROW_MAX);
    expect(BORROW_MAX).toBeLessThanOrEqual(0.5);
    for (let n = 1; n < 40; n++) {
      expect(borrowShare(n + 1)).toBeLessThanOrEqual(borrowShare(n));
      expect(borrowShare(n)).toBeLessThanOrEqual(BORROW_MAX);
    }
    expect(borrowShare(SUB_STANDALONE - 1)).toBeGreaterThan(0);
    expect(borrowShare(SUB_STANDALONE)).toBe(0);
    expect(borrowShare(SUB_STANDALONE + 10)).toBe(0);
  });

  it('a plan never lets a borrowed move be used more than an own move on average (k / (own + k)), and follows the own count', () => {
    for (const name of Object.keys(THIN)) {
      for (const s of thinSongs(name, 6)) {
        for (const lv of LEVELS) {
          for (const [g, p] of borrowPlan(s.style, lv, s.map.bpm)) {
            expect(p.share, `${s.label} ${lv} ${g}`).toBeLessThanOrEqual(Math.min(borrowShare(p.own), p.moves.size / (p.own + p.moves.size)) + 1e-12);
            expect(p.share).toBeGreaterThan(0);
            expect(p.own, `${s.label} ${lv} ${g}`).toBeLessThan(SUB_STANDALONE);
          }
        }
      }
    }
  });

  it('borrowed moves stay a minority of every routine\'s genre time, and borrowing leaves the genre share where it was', () => {
    let lentAll = 0, genreAll = 0, songsThatBorrow = 0;
    const share = (r: Routine, st: SongStyle) => {
      const t = tierBeats(r, st);
      return t.genre / Math.max(1, t.genre + t.global);
    };
    for (const name of Object.keys(THIN)) {
      for (const s of thinSongs(name, 12)) {
        for (const lv of LEVELS) {
          const r = generateRoutine(s.map, lv, { style: s.style });
          const { own, lent } = genreSplit(r, s.style);
          const tag = `${s.label} ${lv}`;
          expect(lent, tag).toBeLessThanOrEqual(BORROW_MAX * (own + lent) + 1e-9);
          if (lent > 0) songsThatBorrow++;
          lentAll += lent;
          genreAll += own + lent;
          // Borrowing only fills the thin set's slots: the kit's genre time (GENRE_MIN..GENRE_MAX, kit.test) stays
          // where it was, or rises to what the plan gave the set where it alone ran out of moves and a slot went global.
          const before = share(generateRoutine(s.map, lv, { style: s.style, borrow: false }), s.style);
          const after = share(r, s.style);
          expect(after, tag).toBeGreaterThanOrEqual(before - 0.03);
          if (before <= GENRE_MAX + 0.02) expect(after, tag).toBeLessThanOrEqual(GENRE_MAX + 0.02);
          if (before >= GENRE_MIN - 0.02) expect(after, tag).toBeGreaterThanOrEqual(GENRE_MIN - 0.02);
        }
      }
    }
    // It does borrow (measured Nov 2026: ~20 % of the thin styles' genre time), never the bulk of it.
    expect(songsThatBorrow).toBeGreaterThan(50);
    expect(lentAll / genreAll).toBeGreaterThan(0.08);
    expect(lentAll / genreAll).toBeLessThan(0.4);
  });

  it('a thin set\'s slots vary more song to song than without borrowing', () => {
    for (const name of ['rnb', 'edm', 'bass']) {
      for (const lv of ['cardio', 'sweaty'] as const) {
        const songs = thinSongs(name, 20);
        const distinct = (borrow: boolean) => {
          const seen = new Set<string>();
          for (const s of songs) {
            const open = styleGenres(s.style);
            for (const i of generateRoutine(s.map, lv, { style: s.style, borrow }).instances) if (i.move.genre && (i.move.genre === name || !open.has(i.move.genre))) seen.add(i.move.base);
          }
          return seen.size;
        };
        expect(distinct(true), `${name} ${lv}`).toBeGreaterThan(distinct(false));
      }
    }
  });
});

describe('a song\'s leading sub-style', () => {
  it('takes the larger part of the genre time when the song opens broader sets too (R&B over disco & funk / hip-hop)', () => {
    for (const lv of ['cardio', 'sweaty'] as const) {
      let lead = 0, all = 0, songs = 0;
      for (const s of thinSongs('rnb', 24)) {
        const open = styleGenres(s.style);
        if (open.size < 2 || !open.has('rnb')) continue;
        songs++;
        for (const i of generateRoutine(s.map, lv, { style: s.style }).instances) {
          if (!i.move.genre || i.sig || i.move.idle || i.move.cooldown || i.section === 'outro') continue;
          all += i.span;
          if (i.move.genre === 'rnb' || !open.has(i.move.genre)) lead += i.span;
        }
      }
      expect(songs, lv).toBeGreaterThan(8);
      // Measured Nov 2026: about 55 % (an even split by openness gave R&B about a third).
      expect(lead / all, lv).toBeGreaterThan(0.5);
    }
    expect(LEAD_SHARE).toBeGreaterThan(0.5);
    expect(leadSubStyle(['rnb', 'discofunk'], new Map([['rnb', 1], ['discofunk', 1]]))).toBe('rnb');
    // Lyrical (a mood) never leads; one open set needs no lead.
    expect(leadSubStyle(['rock', 'lyrical'], new Map([['rock', 0.5], ['lyrical', 1]]))).toBeNull();
    expect(leadSubStyle(['edm'], new Map([['edm', 1]]))).toBeNull();
  });
});

describe('borrowing: what may be borrowed', () => {
  it('songs of large sets come out exactly as without borrowing (nothing to borrow)', () => {
    const big: [string, string[]][] = [
      ['rock', ['Alternative rock']], ['hip-hop', ['Hip hop']], ['latin', ['Salsa']], ['disco', ['Disco']], ['funk', ['Funk']], ['k-pop', ['K-pop']],
      ['country', ['Country']], ['swing', ['Swing']], ['afro', ['Afrobeats']], ['bollywood', ['Bollywood']], ['dancehall', ['Dancehall']], ['pop', ['Pop']], ['ballad', ['Ballad']],
    ];
    for (const [label, genres] of big) {
      for (const bpm of [84, 112, 128, 150]) {
        for (const calm of [undefined, 0.35, 0.7]) {
          const style = resolveSongStyle({ videoId: `big-${label}-${bpm}`, title: label, genres }, { bpm, ...(calm !== undefined ? { traits: { calm } } : {}) });
          // Every open set is either a big one or not a borrower at all.
          for (const g of styleGenres(style)) if (NEIGHBOURS[g]) expect(GENRE_MOVES[g].length, `${label}: ${g}`).toBeGreaterThanOrEqual(SUB_STANDALONE);
          for (const lv of LEVELS) {
            expect(borrowPlan(style, lv, bpm).size, `${label} @${bpm} ${lv}`).toBe(0);
            const map = songMap(bpm, `big-${label}-${bpm}`);
            expect(ids(generateRoutine(map, lv, { style })), `${label} @${bpm} ${lv}`).toEqual(ids(generateRoutine(map, lv, { style, borrow: false })));
          }
        }
      }
    }
  });

  it('never borrows from a set the song closes: calm-closed, or replaced (a replaced parent lends only moves named for the borrower)', () => {
    let checked = 0;
    for (const name of Object.keys(THIN)) {
      for (const s of thinSongs(name, 6)) {
        for (const calm of [0.3, 0.55, 0.7, 0.85]) {
          const style = { ...s.style, calm };
          const src = borrowSources(style);
          const open = genreOpenness(style);
          for (const [host, lenders] of src) {
            for (const [g, lend] of lenders) {
              expect(open.has(g), `${s.label} calm ${calm}: ${host} borrows from open ${g}`).toBe(false);
              expect(calmGate(g, calm), `${s.label} calm ${calm}: ${g} is calm-closed`).toBeGreaterThanOrEqual(CALM_CLOSED);
              const replaced = Object.keys(style.subs ?? {}).some((x) => isSubStyle(x) && open.has(x) && SUB_INFO[x].replaces === g);
              if (replaced) {
                expect(isSubStyle(host) && SUB_INFO[host].parent, `${s.label}: ${host} borrows from replaced ${g}`).toBe(g);
                expect(lend.namedOnly).toBe(true);
              }
            }
          }
          for (const lv of LEVELS) {
            for (const [host, p] of borrowPlan(style, lv, s.map.bpm)) {
              for (const m of p.moves.keys()) {
                checked++;
                expect(src.get(host)?.has(m.genre!), `${m.id} lent to ${host}`).toBe(true);
                expect(calmGate(m.genre!, calm)).toBeGreaterThanOrEqual(CALM_CLOSED);
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    // Reggaeton replaces Latin and is not its child: never a salsa step.
    const rs = resolveSongStyle({ title: 'x', genres: ['Reggaeton'] }, { bpm: 94 });
    for (const lv of LEVELS) for (const p of borrowPlan(rs, lv, 94).values()) for (const m of p.moves.keys()) expect(m.genre, m.id).not.toBe('latin');
  });

  it('Easy never borrows a jump, a fast turn, a high-intensity or a high-impact move', () => {
    for (const name of Object.keys(THIN)) {
      for (const s of thinSongs(name, 12)) {
        for (const p of borrowPlan(s.style, 'chill', s.map.bpm).values()) {
          for (const m of p.moves.keys()) {
            expect(m.jump, `${s.label}: ${m.id}`).toBe(false);
            expect(!!m.fastTurn, m.id).toBe(false);
            expect(m.level, m.id).not.toBe('high');
            expect(levelFactor(m, 'chill')).toBeGreaterThan(0);
          }
        }
        const r = generateRoutine(s.map, 'chill', { style: s.style });
        expect(r.instances.filter((i) => i.move.jump).map((i) => i.move.id), s.label).toEqual([]);
      }
    }
  });

  it('Billie Jean (post-disco, R&B, funk, dance-pop) does not get the hip-hop party dances through its R&B', () => {
    const genres = ['Post-disco', 'R&B', 'funk', 'dance-pop'];
    const styles = [
      resolveSongStyle({ title: 'Billie Jean', genre: 'Pop', genres }),
      resolveSongStyle({ videoId: '7CTJcHjkq0E', title: 'Billie Jean', artist: 'Michael Jackson', genre: 'Pop', genres }, { bpm: 117 }),
    ];
    const maps = [billieJeanMap as unknown as BeatMap, songMap(117, 'billie-jean'), songMap(96, 'billie-jean-slow')];
    for (const style of styles) {
      expect(style.subs?.rnb ?? 0).toBeGreaterThan(0.5);
      const open = styleGenres(style);
      expect(open.has('hiphop')).toBe(false);
      expect(open.has('trap')).toBe(false);
      for (const map of maps) {
        for (const lv of LEVELS) {
          for (const p of borrowPlan(style, lv, map.bpm).values()) for (const m of p.moves.keys()) expect(['hiphop', 'trap'], m.id).not.toContain(m.genre);
          const r = generateRoutine(map, lv, { style });
          const party = r.instances.filter((i) => i.move.genre === 'hiphop' || i.move.genre === 'trap');
          expect(party.map((i) => i.move.id), `${lv} @${map.bpm}`).toEqual([]);
        }
      }
    }
  });

  it('a calm R&B slow jam borrows smooth moves only (no jumps, nothing its calm disfavours)', () => {
    let borrowed = 0;
    for (const [k, genres] of [['Quiet storm'], ['R&B'], ['Neo soul'], ['Slow jam', 'R&B']].entries()) {
      for (const calm of [0.58, 0.62, 0.66]) {
        for (const bpm of [64, 72, 80]) {
          const style = resolveSongStyle({ videoId: `slow-jam-${k}-${bpm}`, title: 'slow jam', genres }, { bpm, traits: { calm } });
          if (!styleGenres(style).has('rnb')) continue;
          for (const lv of LEVELS) {
            const plan = borrowPlan(style, lv, bpm).get('rnb');
            for (const m of plan?.moves.keys() ?? []) {
              expect(m.jump, m.id).toBe(false);
              expect(moveSmoothness(m), `${m.id} smoothness`).toBeGreaterThanOrEqual(0.6);
              expect(calmFactor(m, calm, lv), `${m.id} calm`).toBeGreaterThanOrEqual(1);
              expect(m.themes.some((t) => t === 'kick' || t === 'stomp' || t === 'punch' || t === 'jump'), m.id).toBe(false);
            }
            const r = generateRoutine(songMap(bpm, `slow-jam-${k}-${bpm}`), lv, { style });
            const open = styleGenres(style);
            for (const i of r.instances) {
              if (!i.move.genre || open.has(i.move.genre)) continue;
              borrowed++;
              expect(moveSmoothness(i.move), `${i.move.id} on a slow jam`).toBeGreaterThanOrEqual(0.6);
              expect(i.move.jump).toBe(false);
            }
          }
        }
      }
    }
    expect(borrowed).toBeGreaterThan(0);
  });

  it('every neighbour is a real set, never the borrower itself, closeness in (0, 1]; a parent it does not open lends first', () => {
    for (const [host, list] of Object.entries(NEIGHBOURS) as [Genre, NonNullable<(typeof NEIGHBOURS)[Genre]>][]) {
      const seen = new Set<Genre>();
      for (const nb of list) {
        expect(nb.from).not.toBe(host);
        expect(seen.has(nb.from)).toBe(false);
        seen.add(nb.from);
        expect(nb.w).toBeGreaterThan(0);
        expect(nb.w).toBeLessThanOrEqual(1);
      }
      if (isSubStyle(host) && SUB_INFO[host].parent && !SUB_INFO[host].withParent) expect(list[0].from).toBe(SUB_INFO[host].parent);
    }
  });
});
