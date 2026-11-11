import { describe, expect, it } from 'vitest';
import type { BeatMap } from '../analysis/beatmap';
import { generateDuoRoutine, mirrorInstance, type DuoRoutine } from './duo';
import { contactReport, validatePartner } from './duoCheck';
import { PARTNER_ERRORS, PARTNER_MOVES, partnerOf } from './duoMoves';
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
      for (const i of [...chill.p1, ...chill.p2]) {
        if (i.move.idle || i.move.cooldown) continue;
        expect(i.move.jump, i.move.id).toBe(false);
        expect(i.move.difficulty, i.move.id).toBe(1);
        expect(i.move.fastTurn, i.move.id).toBe(false);
      }
      expect(chill.phrases.some((p) => p.kind === 'trade')).toBe(false);
      const cardio = generateDuoRoutine(songMap(118, vid), 'cardio');
      for (const i of [...cardio.p1, ...cardio.p2]) expect(i.move.difficulty, i.move.id).toBeLessThanOrEqual(2);
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
