import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import { generateDuoRoutine, mirrorInstance, type DuoRoutine } from './duo';
import { contactReport, jointWorld, partnerFrame, validatePartner } from './duoCheck';
import { findPartnerMove, PARTNER_ERRORS, PARTNER_MOVES, partnerDepth, partnerOf } from './duoMoves';
import { J } from '../coach/skeleton';
import { type Intensity, type MoveInstance } from './generator';
import { MOVES } from './moves';
import { resolveSongStyle } from './songStyle';
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
      const cardio = generateDuoRoutine(songMap(118, vid), 'cardio');
      const ins = [...cardio.p1, ...cardio.p2];
      const d3 = ins.filter((i) => i.move.difficulty > 2).reduce((t, i) => t + i.span, 0) / ins.reduce((t, i) => t + i.span, 0);
      expect(d3, vid).toBeLessThan(0.15);
    }
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
