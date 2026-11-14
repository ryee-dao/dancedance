import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import { CALM_GENTLE, PARTNER_RICH, generateDuoRoutine, mirrorInstance, songPartnerMoves, type DuoRoutine } from './duo';
import { contactReport, jointWorld, partnerFrame, validatePartner } from './duoCheck';
import { findPartnerMove, PARTNER_ERRORS, PARTNER_MOVES, PERCUSSIVE_THEMES, partnerDepth, partnerOf, partnerSpeed, partnerTempoMode } from './duoMoves';
import { J } from '../coach/skeleton';
import { GENRE_MAX, generateRoutine, mapTempo, styleGenres, type Intensity, type MoveInstance } from './generator';
import type { Genre } from './genres';
import { MOVES } from './moves';
import { publishedSongs } from './published.testutil';
import { resolveSongStyle } from './songStyle';
import { LEVEL_SPEED } from './speed';
import { songMap } from './testutil';
import { buildCues } from '../coach/duoTracks';

const LEVELS: Intensity[] = ['chill', 'cardio', 'sweaty'];

function covers(ins: readonly MoveInstance[], beats: number): void {
  let b = 0;
  for (const i of ins) {
    expect(i.start).toBe(b);
    expect(i.span).toBeGreaterThan(0);
    b += i.span;
  }
  expect(b).toBe(beats);
}

const sig = (r: DuoRoutine) => [...r.p1, ...r.p2].map((i) => `${i.move.id}${i.mirror ? 'L' : 'R'}@${i.start}`).join(' ');

describe('partner moves', () => {
  it('all build, and none enters the single-player pool', () => {
    expect(PARTNER_ERRORS).toEqual([]);
    expect(PARTNER_MOVES.length).toBeGreaterThanOrEqual(20);
    const single = new Set(MOVES.map((m) => m.id));
    for (const pm of PARTNER_MOVES) {
      for (const m of [...pm.p1, ...pm.p2]) expect(single.has(m.id)).toBe(false);
      expect(pm.p1.length).toBe(pm.beats / 4);
      expect(pm.p2.length).toBe(pm.beats / 4);
      expect(pm.families.length).toBeGreaterThan(0);
    }
  });

  it.each(PARTNER_MOVES.map((m) => [m.id, m] as const))('%s: both tracks are valid', (_id, pm) => {
    expect(validatePartner(pm)).toEqual([]);
  });

  it.each(PARTNER_MOVES.filter((m) => m.contacts.length).map((m) => [m.id, m] as const))('%s: contact points meet', (_id, pm) => {
    for (const c of contactReport(pm)) expect(c.dist, `beat ${c.at}`).toBeLessThanOrEqual(c.tol);
  });

  it('has easy (chill-safe) partner moves and harder travelling / jumping ones', () => {
    expect(PARTNER_MOVES.filter((m) => m.difficulty === 1 && !m.jump).length).toBeGreaterThanOrEqual(8);
    expect(PARTNER_MOVES.some((m) => m.jump)).toBe(true);
    expect(PARTNER_MOVES.some((m) => m.orbit > 0)).toBe(true);
    expect(PARTNER_MOVES.some((m) => m.depth.length > 0)).toBe(true);
  });
});

/** Horizontal facing (x, z) of a player's chest at a solved frame, in pair space. */
function facing(f: ReturnType<typeof partnerFrame>, p: 1 | 2): [number, number] {
  const rt = f.sk[p - 1].rt;
  return [rt[2], rt[8]]; // torso frame's forward (+z) axis in world x / z
}

describe('partner moves make physical sense', () => {
  it('bodies never pass through each other (chests and pelvises stay apart)', () => {
    for (const pm of PARTNER_MOVES) {
      for (let b = 0; b < pm.beats; b += 0.25) {
        const f = partnerFrame(pm, b);
        for (const j of [J.CHEST, J.PELVIS]) {
          const a = jointWorld(f, 1, j), c = jointWorld(f, 2, j);
          expect(Math.hypot(a[0] - c[0], a[2] - c[2]), `${pm.id} b${b}`).toBeGreaterThan(0.25);
        }
      }
    }
  });

  it('elbow swing: turned toward each other, right elbows hooked, circling the shared centre', () => {
    const pm = findPartnerMove('duo-elbow-swing')!;
    expect(pm.hook).toBe(1);
    const xs = new Set<number>();
    for (let b = 0; b < pm.beats; b += 0.5) {
      const f = partnerFrame(pm, b);
      const p1 = jointWorld(f, 1, J.PELVIS), p2 = jointWorld(f, 2, J.PELVIS);
      // P2 is P1 turned 180 deg about the pair's centre.
      expect(p1[0] + p2[0], `b${b}`).toBeCloseTo(0, 2);
      expect(p1[2] + p2[2], `b${b}`).toBeCloseTo(0, 2);
      xs.add(Math.sign(Math.round(p1[0] * 100)));
      // Each faces the partner more than the viewer would allow side by side: forward . (to partner) > 0.5.
      for (const [me, other, p] of [[p1, p2, 1], [p2, p1, 2]] as const) {
        const [fx, fz] = facing(f, p);
        const dx = other[0] - me[0], dz = other[2] - me[2];
        const d = Math.hypot(dx, dz);
        expect((fx * dx + fz * dz) / d, `P${p} b${b}`).toBeGreaterThan(0.5);
      }
      // The hooking elbows sit together between them, below the shoulders.
      const e1 = jointWorld(f, 1, J.EL_R), e2 = jointWorld(f, 2, J.EL_R);
      expect(Math.hypot(e1[0] - e2[0], e1[1] - e2[1], e1[2] - e2[2]), `b${b}`).toBeLessThan(0.1);
      expect(Math.hypot(e1[0], e1[2]), `b${b}`).toBeLessThan(0.08);
      expect(e1[1]).toBeLessThan(jointWorld(f, 1, J.SH_R)[1]);
      // Each hand reaches over the partner's arm: closer to the partner's upper arm than to its own shoulder line's far side.
      const h1 = jointWorld(f, 1, J.HA_R), s2 = jointWorld(f, 2, J.SH_R);
      const mid = [(e2[0] + s2[0]) / 2, (e2[1] + s2[1]) / 2, (e2[2] + s2[2]) / 2];
      expect(Math.hypot(h1[0] - mid[0], h1[1] - mid[1], h1[2] - mid[2]), `b${b}`).toBeLessThan(0.12);
    }
    // They really go round: P1 is on both sides of the centre during the move.
    expect(xs.has(1) && xs.has(-1)).toBe(true);
  });

  it('do-si-do and star turn: partners face along their own path, not the viewer', () => {
    const dsd = findPartnerMove('duo-do-si-do')!;
    for (let b = 0; b < dsd.beats; b += 1) {
      const f = partnerFrame(dsd, b);
      // P1 faces screen right (toward where P2 started), P2 faces screen left.
      expect(facing(f, 1)[0], `b${b}`).toBeGreaterThan(0.6);
      expect(facing(f, 2)[0], `b${b}`).toBeLessThan(-0.6);
    }
    const star = findPartnerMove('duo-star-turn')!;
    for (let b = 0; b < star.beats; b += 0.5) {
      const f = partnerFrame(star, b);
      const h1 = jointWorld(f, 1, J.HA_L), h2 = jointWorld(f, 2, J.HA_L);
      expect(Math.hypot(h1[0] - h2[0], h1[1] - h2[1], h1[2] - h2[2]), `b${b}`).toBeLessThan(0.08);
      expect(h1[1]).toBeGreaterThan(0.9);
    }
  });
});

describe('duo routine', () => {
  for (const level of LEVELS) {
    for (const bpm of [120, 170]) {
      it(`covers every beat for both players (${level}, ${bpm} BPM)`, () => {
        const map = songMap(bpm, 'duo-song');
        const r = generateDuoRoutine(map, level);
        expect(r.beats).toBe(map.beats.length);
        covers(r.p1, r.beats);
        covers(r.p2, r.beats);
        // Partner halves always come in matching pairs at the same beats.
        for (const [a, b] of [[r.p1, r.p2], [r.p2, r.p1]] as const) {
          for (const i of a) {
            const own = partnerOf(i.move);
            if (!own) continue;
            const j = b.find((x) => x.start === i.start)!;
            expect(j, `${i.move.id}@${i.start}`).toBeTruthy();
            expect(partnerOf(j.move)?.pm).toBe(own.pm);
          }
        }
      });
    }
  }

  it('is deterministic per song and level, different across songs', () => {
    const a = generateDuoRoutine(songMap(124, 'song-x'), 'cardio');
    const b = generateDuoRoutine(songMap(124, 'song-x'), 'cardio');
    const c = generateDuoRoutine(songMap(124, 'song-y'), 'cardio');
    expect(sig(a)).toBe(sig(b));
    expect(sig(a)).not.toBe(sig(c));
    // A salt (fresh-routine mode) changes it too.
    expect(sig(generateDuoRoutine(songMap(124, 'song-x'), 'cardio', {}, 'play3'))).not.toBe(sig(a));
  });

  it('varies phrase kinds by section; choruses stay unison / signature', () => {
    for (const level of LEVELS) {
      const r = generateDuoRoutine(songMap(120, 'kinds-song'), level);
      const verseKinds = new Set(r.phrases.filter((p) => p.section === 'verse').map((p) => p.kind));
      expect(verseKinds.size, level).toBeGreaterThanOrEqual(level === 'chill' ? 2 : 3);
      expect(verseKinds.has('partner') || verseKinds.has('trade')).toBe(true);
      // Every signature unit is unison or a role split; the first one is unison.
      const sigPhrases = r.phrases.filter((p) => r.p1.some((i) => i.sig && i.start >= p.start && i.start < p.end));
      expect(sigPhrases.length).toBeGreaterThan(0);
      expect(sigPhrases[0].kind).toBe('unison');
      for (const p of sigPhrases) expect(['unison', 'split']).toContain(p.kind);
      if (level !== 'chill') expect(sigPhrases.some((p) => p.kind === 'split')).toBe(true);
      // Outro is unison.
      for (const p of r.phrases.filter((p) => p.section === 'outro')) expect(p.kind).toBe('unison');
    }
  });

  it('applies the level rules to both tracks', () => {
    for (const vid of ['lv-a', 'lv-b', 'lv-c']) {
      const chill = generateDuoRoutine(songMap(118, vid), 'chill');
      let n = 0, hard = 0;
      for (const i of [...chill.p1, ...chill.p2]) {
        if (i.move.idle || i.move.cooldown) continue;
        expect(i.move.jump, i.move.id).toBe(false);
        expect(i.move.fastTurn, i.move.id).toBe(false);
        n += i.span;
        if (i.move.difficulty > 1) hard += i.span;
      }
      // Difficulty is weighted (Easy: nearly all simple moves), jumps are ruled out.
      expect(hard / n, vid).toBeLessThan(0.15);
      expect(chill.phrases.some((p) => p.kind === 'trade')).toBe(false);
    }
    // Medium rarely uses difficulty 3: measured over many songs, since one routine's share swings with its few
    // picks (40 songs, Nov 2026: mean 0.044, about 1 routine in 15 at 0.15 or more, max 0.28 before and after
    // the genre-set merge; the three songs above alone hit 0.22 / 0.14 / 0.03 or 0 / 0.06 / 0.05 by chance).
    const d3s = Array.from({ length: 24 }, (_, k) => {
      const cardio = generateDuoRoutine(songMap(118, k < 3 ? `lv-${'abc'[k]}` : `lv-${k}`), 'cardio');
      const ins = [...cardio.p1, ...cardio.p2];
      return ins.filter((i) => i.move.difficulty > 2).reduce((t, i) => t + i.span, 0) / ins.reduce((t, i) => t + i.span, 0);
    });
    expect(d3s.reduce((t, x) => t + x, 0) / d3s.length).toBeLessThan(0.08);
    expect(d3s.filter((x) => x >= 0.15).length, d3s.map((x) => x.toFixed(2)).join(' ')).toBeLessThanOrEqual(2);
    // Sweaty uses more partner travel / jumps than cardio over a few songs.
    const travel = (lv: Intensity) =>
      ['s1', 's2', 's3', 's4'].reduce((n, v) => n + generateDuoRoutine(songMap(126, v), lv).phrases.filter((p) => p.kind === 'trade').length, 0);
    expect(travel('sweaty')).toBeGreaterThan(travel('cardio'));
  });

  it('splits a two-move signature into roles (gallop / lasso)', () => {
    const style = resolveSongStyle({ title: 'Gangnam Style', artist: 'PSY' });
    const r = generateDuoRoutine(songMap(132, 'gangnam'), 'cardio', { style });
    const ids = new Set(r.signature.map((s) => s.move.base));
    const split = r.phrases.find((p) => p.kind === 'split');
    expect(split).toBeTruthy();
    // Somewhere in the split, the two players do different signature moves at the same time.
    let different = 0;
    for (const i of r.p1) {
      if (!i.sig || i.start < split!.start || i.start >= split!.end) continue;
      const j = r.p2.find((x) => x.start <= i.start && x.start + x.span > i.start)!;
      if (j.sig && j.move !== i.move) different++;
    }
    expect(different).toBeGreaterThan(0);
    if (ids.has('gallop') && ids.has('lasso')) {
      const at = r.p1.find((i) => i.sig && i.start >= split!.start && i.move.base === 'gallop')!;
      const other = r.p2.find((x) => x.start === at.start)!;
      expect(other.move.base).toBe('lasso');
    }
  });

  it('a bad or unknown song still yields a valid duo routine', () => {
    const bad: BeatMap = { ...songMap(120, 'bad'), beats: [0, 0, 0, 1, Number.NaN] };
    const r = generateDuoRoutine(bad, 'cardio');
    covers(r.p1, r.beats);
    covers(r.p2, r.beats);
    const empty: BeatMap = { ...songMap(120, 'empty'), beats: [], downbeats: [], sections: [] };
    const e = generateDuoRoutine(empty, 'sweaty');
    expect(e.p1).toEqual([]);
    const noSections: BeatMap = { ...songMap(120, 'nosec'), sections: [] };
    const n = generateDuoRoutine(noSections, 'chill');
    covers(n.p1, n.beats);
    covers(n.p2, n.beats);
  });

  it('strip cues cover the routine; split roles give per-player cues', () => {
    const style = resolveSongStyle({ title: 'Gangnam Style', artist: 'PSY' });
    const r = generateDuoRoutine(songMap(120, 'cues'), 'sweaty', { style });
    const cues = buildCues(r);
    expect(cues[0].start).toBe(0);
    for (let k = 1; k < cues.length; k++) expect(cues[k].start).toBe(cues[k - 1].end);
    expect(cues[cues.length - 1].end).toBe(r.beats);
    const split = r.phrases.find((p) => p.kind === 'split')!;
    expect(cues.some((c) => c.start >= split.start && c.start < split.end && c.name1 !== c.name2)).toBe(true);
    const partner = r.phrases.find((p) => p.kind === 'partner')!;
    expect(cues.some((c) => c.start === partner.start && c.partner?.id === partner.partner)).toBe(true);
  });

  it('mirrors instances for live plans', () => {
    const m = MOVES.find((x) => x.mirror && x.travel !== 0)!;
    const i: MoveInstance = { move: m, mirror: false, start: 4, span: m.beats, half: false, origin: 0.2, section: 'verse', sig: false, unitStart: true, phrase: 0 };
    const j = mirrorInstance(i);
    expect(j.mirror).toBe(true);
    expect(j.origin).toBeCloseTo(-0.2);
    expect(j.start).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Partner moves fit the song: style, calm, tempo

/** Songs of each style, resolved the way the app does (genre names + audio traits). */
const styled = (genres: string[], bpm: number, traits: Record<string, number>) => ({ bpm, style: resolveSongStyle({ title: 'X', genres }, { bpm, traits }) });
const STYLED = {
  ballad: styled(['pop ballad'], 72, { calm: 0.9, drive: 0.1 }),
  rockBallad: styled(['soft rock'], 78, { calm: 0.85, drive: 0.15 }),
  pop: styled(['pop', 'dance-pop'], 118, { calm: 0.35, drive: 0.6 }),
  metal: styled(['heavy metal'], 120, { calm: 0.15, heavy: 0.9, drive: 0.9 }),
  punk: styled(['punk rock'], 172, { calm: 0.15, drive: 0.9 }),
  trap: styled(['trap'], 140, { calm: 0.25, halfFeel: 0.85, hats: 0.8, bass: 0.8 }),
  drill: styled(['UK drill'], 142, { calm: 0.3, halfFeel: 0.8, syncop: 0.7 }),
  rnb: styled(['R&B', 'neo soul'], 92, { calm: 0.5, swing: 0.6 }),
  house: styled(['deep house'], 122, { calm: 0.3, fourFloor: 0.9 }),
  edm: styled(['EDM', 'big room'], 128, { calm: 0.2, fourFloor: 0.9, drive: 0.9 }),
  dnb: styled(['drum and bass'], 174, { calm: 0.2, hats: 0.9 }),
  reggaeton: styled(['reggaeton'], 95, { calm: 0.3, syncop: 0.7 }),
  brazil: styled(['samba', 'axé'], 108, { calm: 0.3 }),
  amapiano: styled(['amapiano'], 112, { calm: 0.35 }),
  disco: styled(['disco'], 118, { calm: 0.3 }),
};

/** Every partner move danced in a routine (one per phrase). */
const partnersOf = (r: DuoRoutine) => r.phrases.filter((p) => p.partner).map((p) => findPartnerMove(p.partner!)!);

const genreTime = (ins: readonly MoveInstance[]) => {
  let g = 0, t = 0;
  for (const i of ins) {
    if (i.move.idle || i.move.cooldown) continue;
    t += i.span;
    const own = partnerOf(i.move);
    if (own ? own.pm.styles.length > 0 : !!i.move.genre) g += i.span;
  }
  return { g, t };
};

describe('partner moves by style', () => {
  const GROUPS: Record<string, readonly Genre[]> = {
    lyrical: ['lyrical'],
    'hip-hop': ['hiphop', 'trap', 'drill'],
    electronic: ['house', 'edm', 'bass'],
    'R&B and Latin': ['rnb', 'latin', 'reggaeton', 'brazil', 'caribbean'],
    rock: ['rock', 'metal', 'punk'],
  };

  it('every style group has partner moves for Easy, Medium and Hard', () => {
    for (const [name, gs] of Object.entries(GROUPS)) {
      const own = PARTNER_MOVES.filter((m) => m.styles.some((g) => gs.includes(g)));
      // Easy: difficulty 1, no jumps, no crossing.
      expect(own.filter((m) => m.difficulty === 1 && !m.jump && !m.trade).length, name).toBeGreaterThanOrEqual(1);
      expect(own.filter((m) => m.difficulty <= 2).length, name).toBeGreaterThanOrEqual(2);
      expect(own.filter((m) => m.level === 'high' || m.difficulty >= 2).length, name).toBeGreaterThanOrEqual(1);
    }
  });

  it('gentle partner moves have no jumps, impact or hits; crossings have a depth track', () => {
    for (const pm of PARTNER_MOVES) {
      if (pm.gentle) {
        expect(pm.jump || pm.impact, pm.id).toBe(false);
        expect(pm.themes.some((t) => PERCUSSIVE_THEMES.has(t)), pm.id).toBe(false);
      }
      if (pm.trade) expect(pm.depth.length, pm.id).toBeGreaterThan(0);
      if (pm.styles.includes('lyrical')) expect(pm.gentle, pm.id).toBe(true);
    }
  });

  it('a calm ballad gets only gentle partner moves (no jumps, no hits) at every level', () => {
    let lyrical = 0;
    for (const { bpm, style } of [STYLED.ballad, STYLED.rockBallad]) {
      expect(style.calm!).toBeGreaterThanOrEqual(CALM_GENTLE);
      for (const level of LEVELS) {
        for (let k = 0; k < 8; k++) {
          const r = generateDuoRoutine(songMap(bpm, `ballad-${k}`), level, { style });
          for (const pm of partnersOf(r)) {
            expect(pm.gentle, `${level} ${pm.id}`).toBe(true);
            expect(pm.jump || pm.impact, `${level} ${pm.id}`).toBe(false);
            expect(pm.themes.some((t) => PERCUSSIVE_THEMES.has(t)), `${level} ${pm.id}`).toBe(false);
            if (pm.styles.includes('lyrical')) lyrical++;
          }
          // P2's own moves (complement) never jump on a ballad either.
          for (const p of r.phrases.filter((x) => x.kind === 'complement')) {
            for (const i of r.p2) if (i.start >= p.start && i.start < p.end) expect(i.move.jump, i.move.id).toBe(false);
          }
        }
      }
    }
    // Ballads dance the lyrical partner moves (they had nothing of their own before).
    expect(lyrical).toBeGreaterThan(20);
  });

  it('style-tagged partner moves appear only on songs that open their style, and do appear there', () => {
    const seen = new Map<string, number>();
    for (const [name, { bpm, style }] of Object.entries(STYLED)) {
      const open = styleGenres(style);
      for (const level of LEVELS) {
        for (let k = 0; k < 6; k++) {
          for (const pm of partnersOf(generateDuoRoutine(songMap(bpm, `${name}-${k}`), level, { style }))) {
            if (!pm.styles.length) continue;
            expect(pm.styles.some((g) => open.has(g)), `${name} ${level} ${pm.id}`).toBe(true);
            seen.set(name, (seen.get(name) ?? 0) + 1);
          }
        }
      }
    }
    for (const name of ['ballad', 'metal', 'punk', 'trap', 'drill', 'rnb', 'house', 'edm', 'reggaeton', 'brazil', 'amapiano']) expect(seen.get(name) ?? 0, name).toBeGreaterThan(0);
    // Pop and disco open no style set with partner moves: general ones only.
    expect(seen.get('pop') ?? 0).toBe(0);
    expect(seen.get('disco') ?? 0).toBe(0);
    // Published songs too (their styles as the app resolves them).
    for (const s of publishedSongs()) {
      const open = styleGenres(s.style);
      for (const pm of partnersOf(generateDuoRoutine(s.map, 'cardio', { style: s.style }))) {
        if (pm.styles.length) expect(pm.styles.some((g) => open.has(g)), `${s.title} ${pm.id}`).toBe(true);
      }
    }
  });

  it('keeps the genre time of each track within the single-player share', () => {
    for (const [name, { bpm, style }] of Object.entries(STYLED)) {
      for (const level of LEVELS) {
        for (let k = 0; k < 4; k++) {
          const map = songMap(bpm, `${name}-g${k}`);
          const single = genreTime(generateRoutine(map, level, { style }).instances);
          const cap = Math.max(GENRE_MAX * single.t, single.g) + 1e-9;
          const r = generateDuoRoutine(map, level, { style });
          for (const ins of [r.p1, r.p2]) expect(genreTime(ins).g, `${name} ${level} ${k}`).toBeLessThanOrEqual(cap);
        }
      }
    }
  });

  it('complement: P2 dances a move of the open sets, at P1\'s tempo mode', () => {
    let n = 0, same = 0;
    for (const [name, { bpm, style }] of Object.entries(STYLED)) {
      const open = styleGenres(style);
      for (const level of LEVELS) {
        for (let k = 0; k < 4; k++) {
          const r = generateDuoRoutine(songMap(bpm, `${name}-c${k}`), level, { style });
          for (const p of r.phrases.filter((x) => x.kind === 'complement')) {
            const a = r.p1.find((i) => i.start === p.start)!;
            const b = r.p2.find((i) => i.start === p.start)!;
            if (b.move.genre) expect(open.has(b.move.genre), `${name} ${b.move.id}`).toBe(true);
            n++;
            if (a.half === b.half) same++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(50);
    expect(same / n).toBeGreaterThan(0.95);
  });

  it('a thin partner pool leans on the solo kinds instead', () => {
    // Calm but not yet lyrical: the four gentle general partner moves only on Easy.
    const thin = resolveSongStyle({ title: 'X', genres: ['pop'] }, { bpm: 90, traits: { calm: 0.64, drive: 0.3 } });
    const rich = resolveSongStyle({ title: 'X', genres: ['pop'] }, { bpm: 90, traits: { calm: 0.4, drive: 0.4 } });
    expect(songPartnerMoves(thin, 90, 'chill').length).toBeLessThan(PARTNER_RICH);
    expect(songPartnerMoves(rich, 90, 'chill').length).toBeGreaterThanOrEqual(PARTNER_RICH);
    const share = (style: typeof thin) => {
      let p = 0, t = 0;
      for (let k = 0; k < 16; k++) {
        for (const ph of generateDuoRoutine(songMap(90, `thin-${k}`), 'chill', { style }).phrases) {
          t += ph.end - ph.start;
          if (ph.kind === 'partner') p += ph.end - ph.start;
        }
      }
      return p / t;
    };
    expect(share(thin)).toBeLessThan(share(rich));
  });
});

describe('partner moves at tempo', () => {
  // Every published song at every level, built once for the tests below.
  let cache: { s: ReturnType<typeof publishedSongs>[number]; level: Intensity; r: DuoRoutine }[] | null = null;
  const published = () => (cache ??= publishedSongs().flatMap((s) => LEVELS.map((level) => ({ s, level, r: generateDuoRoutine(s.map, level, { style: s.style }) }))));

  it('every partner move has a speed limit from both tracks; the mode follows it', () => {
    for (const pm of PARTNER_MOVES) {
      const { limit } = partnerSpeed(pm);
      expect(limit, pm.id).toBeGreaterThanOrEqual(90);
      expect(partnerTempoMode(pm, limit - 1, 'cardio'), pm.id).toBe('full');
      expect(partnerTempoMode(pm, limit + 1, 'cardio'), pm.id).not.toBe('full');
    }
  });

  it('no partner move is danced over its speed limit on any published map', () => {
    for (const { s, level, r } of published()) {
      const bpm = mapTempo(s.map);
      for (const i of r.p1) {
        const own = partnerOf(i.move);
        if (!own) continue;
        const eff = i.half ? bpm / 2 : bpm;
        expect(eff, `${s.title} ${level} ${own.pm.id}`).toBeLessThanOrEqual(partnerSpeed(own.pm).limit * LEVEL_SPEED[level] + 1e-9);
      }
    }
  });

  it('both players cover the same beats; partner and complement tiles land on bar lines, with mixed tempo modes', () => {
    let mixed = 0, partnerHalf = 0, partnerFull = 0;
    const fast = [STYLED.punk, STYLED.dnb, STYLED.trap].flatMap(({ bpm, style }) =>
      LEVELS.flatMap((level) => [0, 1, 2].map((k) => ({ map: songMap(bpm, `fast-${bpm}-${k}`), level, r: generateDuoRoutine(songMap(bpm, `fast-${bpm}-${k}`), level, { style }) }))),
    );
    for (const { map, level, r } of [...published().map((x) => ({ map: x.s.map, level: x.level, r: x.r })), ...fast]) {
      covers(r.p1, r.beats);
      covers(r.p2, r.beats);
      const down = new Set(map.downbeats);
      const modes = new Set<boolean>();
      for (const i of r.p1) {
        const own = partnerOf(i.move);
        if (!own) {
          if (!i.move.idle && !i.move.cooldown) modes.add(i.half);
          continue;
        }
        modes.add(i.half);
        if (i.half) partnerHalf++;
        else partnerFull++;
        // The two halves of a partner move: same beats, same speed, same move.
        const j = r.p2.find((x) => x.start === i.start)!;
        expect(j, `${level} ${own.pm.id}@${i.start}`).toBeTruthy();
        expect(partnerOf(j.move)?.pm).toBe(own.pm);
        expect([j.span, j.half]).toEqual([i.span, i.half]);
        expect(down.has(i.start), `${map.videoId} ${level} ${own.pm.id}@${i.start}`).toBe(true);
      }
      for (const p of r.phrases.filter((x) => x.kind === 'complement')) {
        for (const i of r.p2) {
          if (i.start < p.start || i.start >= p.end || i.span < 4) continue;
          expect(down.has(i.start), `${map.videoId} ${level} complement ${i.move.id}@${i.start}`).toBe(true);
        }
      }
      if (modes.size > 1) mixed++;
    }
    expect(mixed).toBeGreaterThan(10);
    expect(partnerHalf).toBeGreaterThan(0);
    expect(partnerFull).toBeGreaterThan(partnerHalf);
  });

  it('level rules hold for both tracks on every style', () => {
    for (const [name, { bpm, style }] of Object.entries(STYLED)) {
      for (let k = 0; k < 3; k++) {
        const r = generateDuoRoutine(songMap(bpm, `${name}-lv${k}`), 'chill', { style });
        for (const i of [...r.p1, ...r.p2]) {
          expect(i.move.jump, `${name} ${i.move.id}`).toBe(false);
          expect(i.move.fastTurn, `${name} ${i.move.id}`).toBe(false);
        }
        for (const pm of partnersOf(r)) expect([pm.difficulty, pm.trade], `${name} ${pm.id}`).toEqual([1, false]);
        const cardio = generateDuoRoutine(songMap(bpm, `${name}-lv${k}`), 'cardio', { style });
        for (const pm of partnersOf(cardio)) expect(pm.difficulty, `${name} ${pm.id}`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('partnerDepth', () => {
  it('stays between its keys a hair before a key (float noise once sent the figures 16 units deep)', () => {
    const out: [number, number] = [0, 0];
    for (const pm of PARTNER_MOVES) {
      if (pm.orbit > 0 || !pm.depth.length) continue;
      const vals = pm.depth.flatMap((k) => [k[1], k[2]]);
      const lo = Math.min(...vals) - 1e-9;
      const hi = Math.max(...vals) + 1e-9;
      for (const k of pm.depth) {
        for (const b of [k[0] - 3e-14, k[0], k[0] + 3e-14, k[0] + 0.5]) {
          partnerDepth(pm, b, 0, 0, out);
          for (const z of out) {
            expect(z).toBeGreaterThanOrEqual(lo);
            expect(z).toBeLessThanOrEqual(hi);
          }
        }
      }
    }
    const cross = findPartnerMove('duo-cross-over')!;
    partnerDepth(cross, 0.99999999999997, 0, 0, out);
    expect(out[0]).toBeCloseTo(0.2, 6);
  });
});
