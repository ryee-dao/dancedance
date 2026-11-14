/**
 * Two-player (duo) choreography. Pure TypeScript (no DOM).
 *
 * A duo routine is two synchronized move tracks (P1 = left figure, P2 =
 * right figure) on the SAME beat grid, built from the single-player routine
 * (same sections, units, song style, signature combo and level rules), so it
 * never forks the generator. Each unit of the single routine (one move
 * repeated, or the signature combo) becomes one duo phrase of a kind chosen
 * per section from designed templates:
 *
 *   unison      both the same move (choruses, the signature's first showing)
 *   chase       unison on a travelling move: both travel the same way, then back
 *   mirror      same move, mirrored: they move toward / away from each other
 *   complement  P2 a different move that fits (other body parts, same level)
 *   call        P1 plays the move while P2 grooves, then P2 answers
 *   canon       same move, P2 one or two beats later
 *   split       the signature combo split into roles (P1 block A while P2
 *               block B, then swap): Gangnam's gallop + lasso becomes one
 *               rider holding the reins while the other swings the lasso
 *   partner     a two-player-only move (duoMoves.ts): high fives, elbow
 *               swing, pat-a-cake, see-saw ...
 *   trade       a partner move that crosses over (do-si-do, cross over)
 *
 * A phrase plan repeats within a section (so players can pick it up) and
 * alternate runs of a section type get a fresh one; deterministic per (seed
 * key, level). Each chorus / drop opens the signature in unison; its later
 * showings split the roles. Chill uses only difficulty-1 partner
 * moves (no jumps, no crossing); Sweaty favours travelling partner moves and
 * jumps.
 *
 * Partner moves fit the song the way single-player moves do (the same song
 * information: open genre sets, calm, level, tempo):
 *   - style: a partner move tagged with genre sets (PartnerMove.styles: a
 *     dap for hip-hop, a counterbalance for lyrical) is only danced on songs
 *     whose style opens one of them, and is favoured there; it counts as
 *     genre time, so the duo never goes past the single-player genre share
 *     (generator.ts GENRE_MAX, or the routine's own share when higher).
 *     Untagged ones (high five, clap patterns) suit any song their
 *     character fits;
 *   - calm: from CALM_GENTLE up (ballads) only gentle partner moves (no
 *     jumps, no impact, no claps or slaps); below it the single-player
 *     character weight (weights.ts calmFactor) leans the pick;
 *   - tempo: every partner move has its own speed limit (duoMoves.ts
 *     partnerSpeed, both tracks and the depth); above it the pair dance it
 *     at half time together, or it is left out (partnerTempoMode).
 * When a song leaves few partner moves to choose from, some of the template's
 * partner phrases go to the single-player kinds (complement, canon, mirror,
 * call) instead, so a thin pool doesn't repeat itself.
 */

import type { BeatMap, SectionType } from '../analysis/beatmap';
import { genreOpenness, type Genre } from './genres';
import { GENRE_MAX, comboName, feelMap, generateRoutine, genreFits, hashString, mulberry32, styleGenres, toneFits, toneGate, type Intensity, type MoveInstance, type Routine, type SigStep, type ToneGate } from './generator';
import type { SongStyle } from './songStyle';
import { IDLE_MOVE, MOVES, type Move } from './moves';
import { PARTNER_MOVES, partnerCard, partnerOf, partnerTempoMode, type PartnerMove } from './duoMoves';
import { partOf, renamed, rootOffset, tileMove as cardTile } from './cards';
import { CH } from '../coach/skeleton';
import { moveTempoMode, type TempoMode } from './speed';
import { calmFactor } from './weights';
import { WALK_SPEED, smoothSteps } from './flow';

export type DuoKind = 'unison' | 'chase' | 'mirror' | 'complement' | 'call' | 'canon' | 'split' | 'partner' | 'trade';

export interface DuoPhrase {
  start: number;
  end: number;
  kind: DuoKind;
  section: SectionType;
  /** The partner move (partner / trade). */
  partner?: string;
}

export interface DuoRoutine {
  p1: MoveInstance[];
  p2: MoveInstance[];
  phrases: DuoPhrase[];
  signature: readonly SigStep[];
  half: boolean;
  beats: number;
}

export interface DuoOpts {
  /** Seed key (video id, plus any fresh-routine salt). */
  seedKey: string;
  intensity: Intensity;
  /**
   * The song's style: P2's own moves follow the same genre gating as the
   * routine (generator.ts). Without it, only the genres the routine itself
   * uses are open.
   */
  style?: SongStyle;
  /** The song's tempo (Routine.bpm, else from its beat times). */
  bpm?: number;
  /** The map's downbeats (beat indices): partner and complement tiles start on them. Without them, on regular bars only. */
  downbeats?: readonly number[];
  /** The tone gate (generator.ts toneGate; default on). */
  toneGate?: boolean;
}

// ---------------------------------------------------------------------------
// Templates

const TEMPLATES: Record<Intensity, Partial<Record<SectionType | 'warmup', DuoKind[][]>>> = {
  chill: {
    warmup: [['unison', 'mirror']],
    intro: [['unison', 'mirror']],
    verse: [['mirror', 'partner'], ['partner', 'mirror'], ['complement', 'partner'], ['call', 'partner']],
    chorus: [['unison', 'partner'], ['unison', 'mirror']],
    drop: [['unison', 'partner']],
    outro: [['unison']],
  },
  cardio: {
    warmup: [['unison', 'mirror']],
    intro: [['unison', 'mirror']],
    verse: [['mirror', 'partner', 'call', 'partner'], ['complement', 'partner', 'canon', 'trade'], ['partner', 'mirror', 'partner', 'complement'], ['call', 'trade', 'mirror', 'partner']],
    chorus: [['unison', 'unison', 'partner', 'unison'], ['unison', 'mirror', 'partner', 'unison']],
    drop: [['unison', 'partner', 'unison', 'partner']],
    outro: [['unison']],
  },
  sweaty: {
    warmup: [['unison', 'mirror']],
    intro: [['unison', 'mirror']],
    verse: [['partner', 'trade', 'call', 'partner'], ['complement', 'partner', 'canon', 'trade'], ['trade', 'mirror', 'partner', 'call'], ['call', 'partner', 'trade', 'partner']],
    chorus: [['unison', 'partner', 'unison', 'trade'], ['unison', 'mirror', 'partner', 'unison']],
    drop: [['unison', 'partner', 'trade', 'partner']],
    outro: [['unison']],
  },
};

/**
 * From this calm up (a ballad) a song gets only gentle partner moves. Analyser
 * 1.4.0 reads soft songs on a steady beat at calm ~0.4-0.64 and ballads from
 * ~0.79 (recorded sets, Nov 2026); lyrical opens from ~0.74 (songStyle.ts
 * LYRICAL_CALM). 0.7 keeps soft-but-steady songs' claps and slaps.
 */
export const CALM_GENTLE = 0.7;
/** A song with fewer partner moves than this to choose from leans on the single-player kinds instead. */
export const PARTNER_RICH = 6;
/** Pick weight of a style-tagged partner move on a song that opens its style (times the openness). */
const STYLE_W = 2.5;
/** What a thin pool's partner phrases become instead, in turn. */
const SOLO_KINDS: readonly DuoKind[] = ['complement', 'canon', 'mirror', 'call'];

// ---------------------------------------------------------------------------
// Unit grouping

interface Unit {
  ins: MoveInstance[];
  start: number;
  end: number;
  section: SectionType;
  phrase: number;
  sig: boolean;
}

function units(instances: readonly MoveInstance[]): Unit[] {
  const out: Unit[] = [];
  for (const inst of instances) {
    const u = out[out.length - 1];
    const fresh = !u || inst.unitStart || inst.phrase !== u.phrase || inst.section !== u.section || (inst.phrase === -1) !== (u.phrase === -1);
    if (fresh) out.push({ ins: [inst], start: inst.start, end: inst.start + inst.span, section: inst.section, phrase: inst.phrase, sig: inst.sig });
    else {
      u.ins.push(inst);
      u.end = inst.start + inst.span;
      u.sig = u.sig || inst.sig;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builder

const copy = (i: MoveInstance, o: Partial<MoveInstance> = {}): MoveInstance => ({ ...i, ...o });

/**
 * The groove for `n` beats (a player waiting on a call, or for a canon to
 * start). `name`: shown under the move being called, so the waiting
 * player's card doesn't flick to the groove and back (one card per phrase).
 */
function idle(start: number, n: number, section: SectionType, phrase: number, firstMirror = false, name?: string): MoveInstance[] {
  const out: MoveInstance[] = [];
  const m = name ? renamed(IDLE_MOVE, name) : IDLE_MOVE;
  for (let k = 0; k < n; k++) out.push({ move: m, mirror: (k % 2 === 1) !== firstMirror, start: start + k, span: 1, half: false, origin: 0, section, sig: false, unitStart: k === 0, phrase });
  return out;
}

/** Tile one move over [start, end) (alternating sides, travel pairs; beats it doesn't divide danced as part of it). */
function tileOne(m: Move, start: number, end: number, half: boolean, section: SectionType, phrase: number, mirrorFirst = false): MoveInstance[] {
  if (end <= start) return [];
  return cardTile(m, start, end, half ? 2 : 1, [], { half, section, sig: false, phrase }, { mirror: m.mirror && mirrorFirst, unitStart: true });
}

function partsOverlap(a: Move, b: Move): number {
  let inter = 0;
  for (const p of a.parts) if (b.parts.includes(p)) inter++;
  const union = a.parts.length + b.parts.length - inter;
  return union ? inter / union : 0;
}

function difficultyOk(d: number, intensity: Intensity): boolean {
  return intensity === 'chill' ? d === 1 : intensity === 'cardio' ? d <= 2 : true;
}

function partnerAllowed(pm: PartnerMove, intensity: Intensity, section: SectionType): boolean {
  if (!difficultyOk(pm.difficulty, intensity)) return false;
  if (pm.jump && intensity === 'chill') return false;
  if (pm.trade && intensity === 'chill') return false;
  if ((section === 'intro' || section === 'outro') && pm.level !== 'low') return false;
  return true;
}

/** Danced beats of an instance list by tier (idle groove and cool-down aside): genre = genre-set moves and style-tagged partner moves. */
function genreBeats(ins: readonly MoveInstance[]): number {
  let g = 0;
  for (const i of ins) {
    if (i.move.idle || i.move.cooldown) continue;
    const own = partnerOf(i.move);
    if (own ? own.pm.styles.length > 0 : !!i.move.genre) g += i.span;
  }
  return g;
}

/**
 * Whether a partner move suits a song by style (its genre sets open), character (gentle only from CALM_GENTLE up) and
 * tone (generator.ts toneFits: neither player's half too loud for the song).
 */
function suitsSong(pm: PartnerMove, open: ReadonlySet<Genre> | null, calm: number | undefined, gate?: ToneGate): boolean {
  if (pm.styles.length && !pm.styles.some((g) => open?.has(g))) return false;
  if (calm !== undefined && calm >= CALM_GENTLE && !pm.gentle) return false;
  if (gate && ![...pm.p1, ...pm.p2].every((m) => toneFits(m, gate, false))) return false;
  return true;
}

/**
 * The partner moves a song offers at a level (style, calm, tempo and level
 * rules; verse sections, crossings included), as the duo choreographer
 * chooses among them. For tests and reports.
 */
export function songPartnerMoves(style: SongStyle | undefined, bpm: number | undefined, intensity: Intensity): PartnerMove[] {
  const open = style ? styleGenres(style) : null;
  const gate = style ? toneGate(style, bpm) : undefined;
  return PARTNER_MOVES.filter((pm) => partnerAllowed(pm, intensity, 'verse') && suitsSong(pm, open, style?.calm, gate) && partnerTempoMode(pm, bpm, intensity) !== 'out');
}

/** Median beat interval of a beat-time list -> BPM (undefined when unusable). */
function bpmOfTimes(times: readonly number[] | undefined): number | undefined {
  if (!times || times.length < 3) return undefined;
  const iv: number[] = [];
  for (let k = 1; k < times.length; k++) {
    const d = times[k] - times[k - 1];
    if (d > 0 && Number.isFinite(d)) iv.push(d);
  }
  if (!iv.length) return undefined;
  iv.sort((a, b) => a - b);
  const bpm = 60 / iv[iv.length >> 1];
  return Number.isFinite(bpm) && bpm > 0 ? bpm : undefined;
}

export class DuoChoreographer {
  private rng: () => number;
  private memo = new Map<string, { kind: DuoKind; partner?: PartnerMove }>();
  private complements = new Map<string, Move | null>();
  private recentPartners: PartnerMove[] = [];
  private familyW = new Map<string, number>();
  private sigRun = '';
  /** P2's name for the split combo (its blocks the other way round). */
  private splitName = '';
  private open: ReadonlySet<Genre> | null = null;
  /** How strongly the song opens each genre (genres.ts genreOpenness), 1 when only the routine is known. */
  private openness = new Map<Genre, number>();
  /** The song's calm (SongStyle.calm), when known. */
  private calm: number | undefined;
  /** The song's tone gate (generator.ts toneGate), when its style is known. */
  private gate: ToneGate | undefined;
  /** The routine's tempo (each move's own half time, speed.ts), when known. */
  private bpm: number | undefined;
  /** Genre time each track may have (beats) and has so far: the single routine's, then as phrases change it. */
  private genreCap = Infinity;
  private genre1 = 0;
  private genre2 = 0;
  /** Partner moves (not crossing) this song offers at this level, whatever the section: thin = lean on the solo kinds. */
  private poolSize = 0;
  private soloTurn = 0;
  private tempoModes = new Map<PartnerMove, TempoMode>();
  private downbeats: ReadonlySet<number> | null = null;

  constructor(private o: DuoOpts) {
    this.rng = mulberry32(hashString(`${o.seedKey}|duo|${o.intensity}`));
    this.toneRng = mulberry32(hashString(`${o.seedKey}|duo-tone|${o.intensity}`));
  }

  /** The gate's own random stream (its re-picks only: the main stream draws as without the gate). */
  private toneRng: () => number;

  /** Whether a move fits the song's tone gate (generator.ts toneGate): not too loud; `main`: not below its floor. */
  private toneOk(m: Move, main: boolean): boolean {
    const g = this.gate;
    return !g || toneFits(m, { ceiling: g.ceiling, calm: 1, ...(main && g.floor ? { floor: g.floor } : {}) }, main);
  }

  build(r: Routine): DuoRoutine {
    const half = r.half;
    this.bpm = this.o.bpm ?? r.bpm ?? bpmOfTimes(r.times);
    this.downbeats = this.o.downbeats?.length ? new Set(this.o.downbeats) : null;
    const h = r.signature.length >> 1;
    this.splitName = comboName([...r.signature.slice(h), ...r.signature.slice(0, h)]);
    if (this.o.style) {
      this.open = styleGenres(this.o.style);
      const all = genreOpenness(this.o.style);
      for (const g of this.open) this.openness.set(g, all.get(g) ?? 1);
      this.calm = this.o.style.calm;
      if (this.o.toneGate !== false) this.gate = toneGate(this.o.style, this.bpm);
    } else {
      // No style given: the genres the single routine uses (its signature nod aside).
      const open = new Set<Genre>();
      for (const inst of r.instances) if (inst.move.genre && !inst.sig) open.add(inst.move.genre);
      this.open = open;
      for (const g of open) this.openness.set(g, 1);
      // Lyrical only opens on a calm song (songStyle.ts): a routine that dances it is one.
      if (open.has('lyrical')) this.calm = 0.75;
    }
    // Genre time: never past the single-player share (GENRE_MAX, or the routine's own when it is higher).
    let danced = 0;
    for (const inst of r.instances) if (!inst.move.idle && !inst.move.cooldown) danced += inst.span;
    const g0 = genreBeats(r.instances);
    this.genreCap = Math.max(g0, GENRE_MAX * danced);
    this.genre1 = this.genre2 = g0;
    this.poolSize = PARTNER_MOVES.filter((pm) => !pm.trade && partnerAllowed(pm, this.o.intensity, 'verse') && this.suits(pm)).length;
    // The song's style, as the single routine expressed it: family weights from its moves.
    for (const inst of r.instances) {
      if (inst.move.idle || inst.move.cooldown) continue;
      inst.move.families.forEach((f, i) => this.familyW.set(f, (this.familyW.get(f) ?? 0) + (i === 0 ? 1 : 0.5) * inst.span));
    }
    const p1: MoveInstance[] = [];
    const p2: MoveInstance[] = [];
    const phrases: DuoPhrase[] = [];
    const us = units(r.instances);
    let lastKind: DuoKind | null = null;
    let phraseNo = -99;
    let idxInPhrase = 0;
    let template: DuoKind[] = ['unison'];
    const runIndex = new Map<string, number>();
    let warm = true;
    let prevSection: SectionType | null = null;
    for (const u of us) {
      if (u.phrase !== phraseNo) {
        phraseNo = u.phrase;
        idxInPhrase = 0;
        if (u.section !== prevSection) {
          runIndex.set(u.section, (runIndex.get(u.section) ?? -1) + 1);
          prevSection = u.section;
        }
        const isWarm = warm && u.section !== 'intro' && u.ins.some((i) => !i.move.idle) && phrases.length < 3 && us.indexOf(u) < 3;
        const key = isWarm ? 'warmup' : u.section;
        const list = TEMPLATES[this.o.intensity][key] ?? TEMPLATES[this.o.intensity].verse!;
        template = list[(phraseNo >= 0 ? phraseNo : 0) % list.length];
        if (!isWarm) warm = false;
      }
      const memoKey = `${u.section}|${phraseNo >= 0 ? (runIndex.get(u.section) ?? 0) % 2 : 'f'}|${idxInPhrase}`;
      let kind: DuoKind;
      let partner: PartnerMove | undefined;
      const allIdle = u.ins.every((i) => i.move.idle);
      if (u.phrase === -1 || allIdle) kind = 'unison';
      else if (u.ins.some((i) => i.move.cooldown)) kind = 'unison';
      else if (u.sig) {
        // Each chorus / drop opens the combo in unison (recognisable), later showings split the roles.
        const run = `${u.section}|${runIndex.get(u.section) ?? 0}`;
        kind = run !== this.sigRun ? 'unison' : 'split';
        this.sigRun = run;
      }
      else {
        const m = this.memo.get(memoKey);
        kind = m?.kind ?? template[idxInPhrase % template.length];
        partner = m?.partner;
        // A thin partner pool (a ballad on Easy, a style with few partner moves): some of its phrases go to the solo kinds.
        if (!m && kind === 'partner' && this.poolSize < PARTNER_RICH && this.rng() * PARTNER_RICH >= this.poolSize) kind = this.soloKind(lastKind);
        if (kind === lastKind && kind !== 'unison' && kind !== 'partner') kind = 'mirror' === kind ? 'unison' : 'mirror';
      }
      const made = this.make(u, kind, partner, half, p1[p1.length - 1], p2[p2.length - 1]);
      const gu = genreBeats(u.ins);
      this.genre1 += genreBeats(made.p1) - gu;
      this.genre2 += genreBeats(made.p2) - gu;
      if (!u.sig && u.phrase !== -1 && !this.memo.has(memoKey)) this.memo.set(memoKey, { kind: made.kind, partner: made.partner });
      p1.push(...made.p1);
      p2.push(...made.p2);
      phrases.push({ start: u.start, end: u.end, kind: made.kind, section: u.section, ...(made.partner ? { partner: made.partner.id } : {}) });
      lastKind = made.kind;
      idxInPhrase++;
    }
    // Walk in to partner moves and back out at a dancer's pace (never a slide in a beat).
    placeTrack(p1);
    placeTrack(p2);
    const times = r.times ?? Array.from({ length: r.beats + 1 }, (_, k) => k * 0.5);
    smoothSteps(p1, times, duoOwner, isPartner);
    smoothSteps(p2, times, duoOwner, isPartner);
    return { p1, p2, phrases, signature: r.signature, half, beats: r.beats };
  }

  private make(
    u: Unit, kind: DuoKind, partner: PartnerMove | undefined, half: boolean, prev1?: MoveInstance, prev2?: MoveInstance,
  ): { p1: MoveInstance[]; p2: MoveInstance[]; kind: DuoKind; partner?: PartnerMove } {
    const main = u.ins.find((i) => !i.move.idle)?.move;
    const travels = !!main && main.travel !== 0 && !u.sig;
    const unison = () => ({ p1: u.ins.map((i) => copy(i)), p2: u.ins.map((i) => copy(i)), kind: (travels ? 'chase' : 'unison') as DuoKind });
    // The main move keeps the speed the single routine danced it at (moves are half time each on their own).
    const mainHalf = (main && u.ins.find((i) => i.move === main)?.half) ?? half;
    const mult = mainHalf ? 2 : 1;
    switch (kind) {
      case 'unison':
      case 'chase':
        return unison();
      case 'mirror': {
        if (!main || Math.abs(main.travel) > 0.32) return unison();
        return { p1: u.ins.map((i) => copy(i)), p2: u.ins.map((i) => copy(i, { mirror: i.move.mirror ? !i.mirror : i.mirror, origin: -i.origin, ...(i.drift ? { drift: -i.drift } : {}) })), kind };
      }
      case 'complement': {
        if (!main || main.travel !== 0) return this.make(u, 'mirror', undefined, half, prev1, prev2);
        // P2's own move may add genre time only while the track stays within the genre share.
        const room = this.genreCap - this.genre2 + genreBeats(u.ins) + 1e-9;
        const b = this.complementOf(main, mainHalf, room >= u.end - u.start);
        const bMode = b && this.bpm ? moveTempoMode(b, this.bpm, this.o.intensity) : null;
        if (!b || bMode === 'out') return this.make(u, 'mirror', undefined, half, prev1, prev2);
        const bHalf = bMode ? bMode === 'half' : mainHalf;
        if (!this.onBars(u, b.beats * (bHalf ? 2 : 1))) return this.make(u, 'mirror', undefined, half, prev1, prev2);
        const p2 = tileOne(b, u.start, u.end, bHalf, u.section, u.phrase, true);
        if (genreBeats(p2) > room) return this.make(u, 'mirror', undefined, half, prev1, prev2);
        return { p1: u.ins.map((i) => copy(i)), p2, kind };
      }
      case 'call': {
        if (!main) return unison();
        const len = u.end - u.start;
        const span = main.beats * mult;
        const halfLen = Math.floor(len / 2);
        if (span > halfLen || main.travel !== 0) return this.make(u, 'canon', undefined, half, prev1, prev2);
        const mid = u.start + halfLen;
        return {
          p1: [...tileOne(main, u.start, mid, mainHalf, u.section, u.phrase, false), ...idle(mid, u.end - mid, u.section, u.phrase, false, main.name)],
          p2: [...idle(u.start, halfLen, u.section, u.phrase, false, main.name), ...tileOne(main, mid, u.end, mainHalf, u.section, u.phrase, true)],
          kind,
        };
      }
      case 'canon': {
        if (!main || main.travel !== 0) return this.make(u, 'mirror', undefined, half, prev1, prev2);
        const moving = u.ins.filter((i) => i.move === main);
        if (moving.length < 3) return this.make(u, 'mirror', undefined, half, prev1, prev2);
        const lag = Math.max(1, Math.min(2, (main.beats * mult) / 2));
        const p2: MoveInstance[] = idle(u.start, lag, u.section, u.phrase, false, main.name);
        for (const i of u.ins) {
          if (i.start + lag + i.span > u.end) break;
          p2.push(copy(i, { start: i.start + lag, unitStart: false }));
        }
        const end2 = p2.length ? p2[p2.length - 1].start + p2[p2.length - 1].span : u.start;
        p2.push(...idle(end2, u.end - end2, u.section, u.phrase, false, main.name));
        return { p1: u.ins.map((i) => copy(i)), p2, kind };
      }
      case 'split': {
        const sp = splitSignature(u, this.splitName);
        return sp ? { ...sp, kind } : unison();
      }
      case 'partner':
      case 'trade': {
        const pm = partner && partner.trade === (kind === 'trade') && this.partnerOk(partner, u, half, prev1, prev2) ? partner : this.pickPartner(u, kind === 'trade', half, prev1, prev2);
        if (!pm) return kind === 'trade' ? this.make(u, 'partner', undefined, half, prev1, prev2) : this.make(u, 'mirror', undefined, half, prev1, prev2);
        const tiles = tilePartner(pm, u.start, u.end, this.partnerHalf(pm, half), u.section, u.phrase);
        if (!tiles) return this.make(u, 'mirror', undefined, half, prev1, prev2);
        return { ...tiles, kind: pm.trade ? 'trade' : 'partner', partner: pm };
      }
    }
  }

  /** How the pair dance a partner move on this song at this level (cached). */
  private modeOf(pm: PartnerMove): TempoMode {
    let m = this.tempoModes.get(pm);
    if (!m) this.tempoModes.set(pm, (m = partnerTempoMode(pm, this.bpm, this.o.intensity)));
    return m;
  }

  /** A partner move at half time on this song (its own speed limit); the routine's count when the tempo is unknown. */
  private partnerHalf(pm: PartnerMove, half: boolean): boolean {
    return this.bpm ? this.modeOf(pm) === 'half' : half;
  }

  /** Whether a partner move suits this song at all: its style, the song's calm, its tempo. */
  private suits(pm: PartnerMove): boolean {
    return suitsSong(pm, this.open, this.calm) && this.modeOf(pm) !== 'out';
  }

  /** Whether a partner move may fill this unit: level, song, exact fit, flow, and the genre share. */
  private partnerOk(pm: PartnerMove, u: Unit, half: boolean, prev1?: MoveInstance, prev2?: MoveInstance): boolean {
    if (!partnerAllowed(pm, this.o.intensity, u.section) || !this.suits(pm)) return false;
    const len = u.end - u.start;
    const span = pm.beats * (this.partnerHalf(pm, half) ? 2 : 1);
    if (span > len || len % span !== 0 || !joins(pm, prev1, prev2) || !this.onBars(u, 4 * (span / pm.beats))) return false;
    if (pm.styles.length) {
      const gu = genreBeats(u.ins);
      if (Math.max(this.genre1, this.genre2) - gu + len > this.genreCap + 1e-9) return false;
    }
    return true;
  }

  /**
   * Whether tiles of `step` beats from the unit's start all start on bar
   * lines: on the map's downbeats when known; otherwise only units of whole
   * 4-beat bars whose own instances are whole moves (an odd bar shows up in
   * the single routine as a part of a move or a fill).
   */
  private onBars(u: Unit, step: number): boolean {
    if (this.downbeats) {
      for (let b = u.start; b < u.end; b += step) if (!this.downbeats.has(b)) return false;
      return true;
    }
    return (u.end - u.start) % 4 === 0 && u.ins.every((i) => !i.fill && !i.move.part);
  }

  /** The next solo kind for a partner phrase a thin pool gives up (never the kind just danced). */
  private soloKind(last: DuoKind | null): DuoKind {
    let k = SOLO_KINDS[this.soloTurn++ % SOLO_KINDS.length];
    if (k === last) k = SOLO_KINDS[this.soloTurn++ % SOLO_KINDS.length];
    return k;
  }

  private pickPartner(u: Unit, trade: boolean, half: boolean, prev1?: MoveInstance, prev2?: MoveInstance): PartnerMove | undefined {
    const it = this.o.intensity;
    const sectionHigh = u.section === 'chorus' || u.section === 'drop';
    // Partner moves that suit the song, fill the phrase exactly (no half-done move at its end), and can follow
    // what the two are doing (straight after another partner move: from where it left them).
    const pool = PARTNER_MOVES.filter((pm) => pm.trade === trade && this.partnerOk(pm, u, half, prev1, prev2));
    const total = [...this.familyW.values()].reduce((a, b) => a + b, 0) || 1;
    const weights = pool.map((pm) => {
      // Flow: closer to where each dancer is and how they face, the better (the walk-in is shorter).
      let w = Math.exp(-POS_W * (entryGap(pm, prev1, prev2)));
      let fam = 0;
      pm.families.forEach((f, i) => (fam += (this.familyW.get(f) ?? 0) * (i === 0 ? 1 : 0.5)));
      w *= 0.4 + 2.5 * (fam / total);
      // The song's own style: a partner move of a set it opens is its vocabulary.
      if (pm.styles.length) w *= 1 + STYLE_W * Math.max(...pm.styles.map((g) => this.openness.get(g) ?? 0));
      // The song's character, as for single-player moves (smooth on calm songs, vigorous on driving ones).
      w *= partnerCalm(pm, this.calm, it);
      if (pm.level === 'high') w *= sectionHigh ? 2 : it === 'sweaty' ? 1.2 : 0.5;
      if (pm.level === 'low') w *= it === 'chill' ? 1.6 : sectionHigh ? 0.5 : 1;
      if (it === 'sweaty' && (pm.jump || pm.difficulty >= 2)) w *= 1.8;
      if (this.recentPartners.includes(pm)) w *= 0.08;
      return w;
    });
    let sum = 0;
    for (const w of weights) sum += w;
    if (sum <= 0) return undefined;
    let r = this.rng() * sum;
    let pick = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      if (r < weights[i]) {
        pick = pool[i];
        break;
      }
      r -= weights[i];
    }
    // The tone gate: a partner move with a half too loud for the song is re-picked from the gate's own stream.
    const fits = (pm: PartnerMove) => [...pm.p1, ...pm.p2].every((m) => this.toneOk(m, false));
    if (!fits(pick)) {
      const w = weights.map((x, i) => (fits(pool[i]) ? x : 0));
      const tot = w.reduce((a, b) => a + b, 0);
      if (tot <= 0) return undefined;
      let r2 = this.toneRng() * tot;
      pick = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) {
        if (r2 < w[i]) {
          pick = pool[i];
          break;
        }
        r2 -= w[i];
      }
    }
    this.recentPartners.push(pick);
    if (this.recentPartners.length > 4) this.recentPartners.shift();
    return pick;
  }

  /**
   * P2's move for a complement phrase: a different in-place move of the same
   * length and level from the song's open sets (genre ones only when
   * `genreOk`: the track has genre time left), danced at the same tempo mode
   * as P1's when one exists (both full or both half time), fitting the song's
   * character (no jumps on a calm song).
   */
  private complementOf(m: Move, mainHalf: boolean, genreOk: boolean): Move | undefined {
    const key = `${m.id}|${mainHalf ? 'h' : 'f'}|${genreOk ? 'g' : ''}`;
    const hit = this.complements.get(key);
    if (hit !== undefined) return hit ?? undefined;
    const it = this.o.intensity;
    const calm = this.calm;
    const mode = (c: Move): TempoMode => (this.bpm ? moveTempoMode(c, this.bpm, it) : mainHalf ? 'half' : 'full');
    const all = MOVES.filter(
      (c) =>
        !c.idle && !c.cooldown && c !== m && c.base !== m.base && c.beats === m.beats && c.travel === 0 && !c.fastTurn && difficultyOk(c.difficulty, it) && !(c.jump && it === 'chill') &&
        !(c.jump && calm !== undefined && calm >= CALM_GENTLE) && c.level === m.level && (!this.open || genreFits(c, this.open)) && (genreOk || !c.genre) && mode(c) !== 'out',
    );
    const want: TempoMode = mainHalf ? 'half' : 'full';
    const same = all.filter((c) => mode(c) === want);
    const pool = same.length ? same : all;
    let best: Move | undefined;
    let bestS = -Infinity;
    // The best one that fits the song's tone too (the gate: when the best one doesn't, it is P2's move instead).
    let bestFit: Move | undefined;
    let bestFitS = -Infinity;
    for (const c of pool) {
      // Different body parts / focus, a shared style family, plus a little seeded spice.
      let s = 1 - partsOverlap(m, c);
      if (!c.focus.some((f) => m.focus.includes(f))) s += 0.6;
      if (c.families.some((f) => m.families.includes(f))) s += 0.5;
      if (m.genre && c.genre === m.genre) s += 0.4;
      if (c.jump !== m.jump) s -= 0.6;
      s += 0.6 * Math.log(calmFactor(c, calm, it));
      s += this.rng() * 0.5;
      if (s > bestS) {
        bestS = s;
        best = c;
      }
      if (s > bestFitS && this.toneOk(c, true)) {
        bestFitS = s;
        bestFit = c;
      }
    }
    if (best && !this.toneOk(best, true)) best = bestFit;
    this.complements.set(key, best ?? null);
    return best;
  }
}

/** The single-player character weight (weights.ts calmFactor) of a partner move: the mean over both players' halves. */
function partnerCalm(pm: PartnerMove, calm: number | undefined, level: Intensity): number {
  if (calm === undefined) return 1;
  let s = 0;
  const hs = [...pm.p1, ...pm.p2];
  for (const m of hs) s += Math.log(calmFactor(m, calm, level));
  return Math.exp(s / hs.length);
}

/** P1 plays the signature as is; P2 plays it rotated by half (the other block first), so the roles swap. */
function splitSignature(u: Unit, name: string): { p1: MoveInstance[]; p2: MoveInstance[] } | null {
  const sigIns = u.ins.filter((i) => i.sig);
  if (sigIns.length < 2) return null;
  // One combo = the sig instances up to the first repeat of the opening step's start pattern.
  // Find the combo length: smallest prefix whose moves repeat.
  let comboLen = sigIns.length;
  for (let n = 1; n < sigIns.length; n++) {
    if (sigIns.length % n !== 0) continue;
    let ok = true;
    for (let k = n; k < sigIns.length; k++) if (sigIns[k].move !== sigIns[k % n].move || sigIns[k].mirror !== sigIns[k % n].mirror) ok = false;
    if (ok) {
      comboLen = n;
      break;
    }
  }
  const combo = sigIns.slice(0, comboLen);
  const comboBeats = combo.reduce((t, i) => t + i.span, 0);
  // Split point: half the combo's beats, on a move boundary, with a different move after it.
  let acc = 0;
  let cut = -1;
  for (let k = 0; k < combo.length; k++) {
    if (acc * 2 === comboBeats && combo[k].move !== combo[0].move) {
      cut = k;
      break;
    }
    acc += combo[k].span;
  }
  if (cut < 0) return null;
  const rotated = [...combo.slice(cut), ...combo.slice(0, cut)];
  const p2: MoveInstance[] = [];
  let si = 0;
  for (const i of u.ins) {
    if (!i.sig) {
      p2.push(copy(i));
      continue;
    }
    if (si++ % comboLen !== 0) continue;
    // A whole combo from here: the rotated order, mirrored so the two face each other.
    let b = i.start;
    let origin = 0;
    for (const s of rotated) {
      const mirror = s.move.mirror ? !s.mirror : s.mirror;
      p2.push(copy(s, { move: renamed(s.move, name), start: b, mirror, origin, unitStart: b === u.start }));
      origin += s.move.travel * (mirror ? -1 : 1);
      b += s.span;
    }
  }
  return { p1: u.ins.map((i) => copy(i)), p2 };
}

/** Tile a partner move over [start, end); groove for the rest. Null if it doesn't fit. */
export function tilePartner(pm: PartnerMove, start: number, end: number, half: boolean, section: SectionType, phrase: number): { p1: MoveInstance[]; p2: MoveInstance[] } | null {
  const mult = half ? 2 : 1;
  const span = 4 * mult;
  if (end - start < pm.beats * mult) return null;
  const p1: MoveInstance[] = [];
  const p2: MoveInstance[] = [];
  let b = start;
  // Whole halves in order, round and round; a last half that doesn't fit is danced in part.
  for (let k = 0; b < end; k = (k + 1) % pm.p1.length) {
    const len = Math.min(span, end - b);
    const base = { mirror: false, start: b, span: len, half, origin: 0, section, sig: false, unitStart: b === start, phrase };
    const a1 = partnerCard(pm.p1[k]), a2 = partnerCard(pm.p2[k]);
    p1.push({ ...base, move: len === span ? a1 : partOf(a1, 0, len / mult) });
    p2.push({ ...base, move: len === span ? a2 : partOf(a2, 0, len / mult) });
    b += len;
  }
  return { p1, p2 };
}

// ---------------------------------------------------------------------------
// Stage positions
//
// Partner moves key each dancer's root where the move needs them (side by
// side, linked, crossing over); every other move dances on the dancer's own
// spot. Between the two the dancers WALK: a stretch of the moves before a
// partner move drifts them in toward its start, a stretch after it drifts
// them back home (MoveInstance.drift, at most WALK_SPEED per beat, never
// under a bar), so nobody slides across the stage in a beat. A partner move
// straight after another one must start where that one left them (joins).

/** Weight of the entry distance in the partner-move pick. */
const POS_W = 2.5;
/** Largest jump between two partner moves played back to back (floor units / degrees). */
const JOIN_X = 0.12;
const JOIN_SPIN = 30;

/** One owner per partner move (both halves), else the base move: the root steps inside one are authored (flow.ts). */
export const duoOwner = (i: MoveInstance): string => partnerOf(i.move)?.pm.id ?? i.move.base;
const isPartner = (i: MoveInstance): boolean => !!partnerOf(i.move);

function bodyKeys(i: MoveInstance) {
  return i.move.tracks[0][i.mirror && i.move.mirror ? 'mirrorKeys' : 'keys'];
}
/** Root x and facing of an instance's first / last body key. */
function rootAt(i: MoveInstance, last: boolean): { x: number; spin: number } {
  const ks = bodyKeys(i);
  const k = last ? ks[ks.length - 1] : ks[0];
  return { x: k.pose[CH.X] + rootOffset(i, k.at), spin: k.pose[CH.SPIN] };
}
const spinGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
/** How far the dancers must come from their last instances into a partner move's start (x units + facing / 90 deg). */
function entryGap(pm: PartnerMove, prev1?: MoveInstance, prev2?: MoveInstance): number {
  let g = 0;
  for (const [prev, m] of [[prev1, pm.p1[0]], [prev2, pm.p2[0]]] as const) {
    if (!prev) continue;
    const a = rootAt(prev, true);
    const k = m.tracks[0].keys[0].pose;
    g += Math.abs(k[CH.X] - a.x) + spinGap(k[CH.SPIN], a.spin) / 90;
  }
  return g / 2;
}
/** Whether a partner move may follow these instances: anything after a solo move; after a partner move, only from where it ended. */
function joins(pm: PartnerMove, prev1?: MoveInstance, prev2?: MoveInstance): boolean {
  for (const [prev, m] of [[prev1, pm.p1[0]], [prev2, pm.p2[0]]] as const) {
    if (!prev || !partnerOf(prev.move)) continue;
    const a = rootAt(prev, true);
    const k = m.tracks[0].keys[0].pose;
    if (Math.abs(k[CH.X] - a.x) > JOIN_X || spinGap(k[CH.SPIN], a.spin) > JOIN_SPIN) return false;
  }
  return true;
}

/**
 * Walk one dancer between partner moves (anchors, keyed where the move
 * needs them) and solo stretches (danced on the spot): each solo stretch
 * starts where the anchor before it left the dancer and ends where the next
 * anchor needs them, drifting at WALK_SPEED over whole instances of at
 * least a bar (the whole stretch when it is short). In place.
 */
export function placeTrack(ins: MoveInstance[]): void {
  const anchor = (i: MoveInstance) => !!partnerOf(i.move);
  let k = 0;
  while (k < ins.length) {
    if (anchor(ins[k])) {
      k++;
      continue;
    }
    let e = k;
    while (e < ins.length && !anchor(ins[e])) e++;
    // Solo stretch [k, e).
    const a = ins[k], z = ins[e - 1];
    const inOff = k > 0 ? rootAt(ins[k - 1], true).x - rootAt(a, false).x : 0;
    const outOff = e < ins.length ? rootAt(ins[e], false).x - rootAt(z, true).x : 0;
    if (Math.abs(inOff) > 0.02 || Math.abs(outOff) > 0.02) shiftStretch(ins, k, e, inOff, outOff);
    k = e;
  }
}

/** Offsets over instances [k, e): `inOff` at the start easing to 0, then 0 easing to `outOff` at the end. */
function shiftStretch(ins: MoveInstance[], k: number, e: number, inOff: number, outOff: number): void {
  const t0 = ins[k].start;
  const t1 = ins[e - 1].start + ins[e - 1].span;
  const len = t1 - t0;
  const need = (off: number) => Math.min(len, Math.max(4, Math.abs(off) / WALK_SPEED));
  // Ramp lengths, rounded out to whole instances.
  const snapUp = (b: number) => {
    for (let j = k; j < e; j++) if (ins[j].start + ins[j].span >= b) return ins[j].start + ins[j].span;
    return t1;
  };
  const snapDown = (b: number) => {
    for (let j = e - 1; j >= k; j--) if (ins[j].start <= b) return ins[j].start;
    return t0;
  };
  const outEnd = Math.abs(inOff) > 0.02 ? snapUp(t0 + need(inOff)) : t0;
  const inStart = Math.abs(outOff) > 0.02 ? snapDown(t1 - need(outOff)) : t1;
  // Too short for both walks: one straight line from where the dancer is to where they must be.
  const off = inStart < outEnd
    ? (b: number) => inOff + ((outOff - inOff) * (b - t0)) / len
    : (b: number) => (b <= outEnd ? (outEnd > t0 ? inOff * (1 - (b - t0) / (outEnd - t0)) : 0) : b >= inStart ? (t1 > inStart ? (outOff * (b - inStart)) / (t1 - inStart) : 0) : 0);
  for (let j = k; j < e; j++) {
    const i = ins[j];
    const a = off(i.start);
    const b = off(i.start + i.span);
    if (Math.abs(a) < 1e-9 && Math.abs(b - a) < 1e-9) continue;
    ins[j] = { ...i, origin: i.origin + a, drift: (i.drift ?? 0) + (b - a) };
  }
}

/** Duo routine from a single-player routine. */
export function duoFromRoutine(r: Routine, o: DuoOpts): DuoRoutine {
  return new DuoChoreographer(o).build(r);
}

/** Generate the duo routine for a beat map (wraps generateRoutine). */
export function generateDuoRoutine(map: BeatMap, intensity: Intensity, opts: Parameters<typeof generateRoutine>[2] = {}, salt = ''): DuoRoutine {
  const r = generateRoutine(map, intensity, opts);
  // The downbeats of the grid the routine is danced on: the map's, a tempo feel's own (half / twice the counted
  // tempo: other beat indices), none on a free-time grid (regular bars).
  const downbeats = r.times === undefined || r.times === map.beats ? map.downbeats : r.feel && r.feel !== 1 ? feelMap(map, r.feel).downbeats : undefined;
  return duoFromRoutine(r, { seedKey: `${map.videoId}${salt ? `|${salt}` : ''}`, intensity, style: opts.style, ...(downbeats ? { downbeats } : {}), ...(opts.toneGate === false ? { toneGate: false } : {}) });
}

/** P2's mirror-unison instance for a P1 instance (live / idle plans). */
export function mirrorInstance(i: MoveInstance): MoveInstance {
  if (partnerOf(i.move)) return i;
  return { ...i, mirror: i.move.mirror ? !i.mirror : i.mirror, origin: -i.origin, ...(i.drift ? { drift: -i.drift } : {}) };
}

/** A looping plan of a partner move for one player (previews, sheets, tests). */
export function partnerLoop(pm: PartnerMove, player: 1 | 2, period: number, reps = 2): { grid: number[]; instances: MoveInstance[]; period: number; loopBeats: number } {
  const instances: MoveInstance[] = [];
  const moves = player === 1 ? pm.p1 : pm.p2;
  let b = 0;
  for (let r = 0; r <= reps; r++) {
    for (const m of moves) {
      instances.push({ move: m, mirror: false, start: b, span: 4, half: false, origin: 0, section: 'verse', sig: false, unitStart: b === 0, phrase: 0 });
      b += 4;
    }
  }
  const grid: number[] = [];
  for (let k = 0; k <= b + 1; k++) grid.push(k * period);
  return { grid, instances, period, loopBeats: reps * pm.beats };
}
