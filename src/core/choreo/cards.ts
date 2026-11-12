/**
 * Cards: what the dancer sees as "a move", and the hard rule that none of
 * them flashes by. Pure TypeScript (no DOM).
 *
 * A CARD is a maximal run of consecutive instances that show the same name
 * on the NOW card (and the same combo flag): one move repeated, including its
 * phrase-end flourish (which keeps the move's name) and the song combo
 * (named as one move, "Gallop + Lasso"). A variation with its own name ("Hip
 * Sway · arms up") is a new card. The conductor groups the strip the same way
 * (sameCard).
 *
 * THE RULE (enforceCards, run once at the end of assembly, so no path can
 * break it): every card lasts at least MIN_CARD_BEATS beats (one bar) and at
 * least MIN_CARD_SEC seconds of song time; the assembly itself aims for two
 * bars or more (PREF_CARD_BEATS). A card that is too short is never filled
 * with a brief extra move: it is absorbed. The previous move carries on over
 * it, or the next move starts early (a card that starts on a drop keeps its
 * start and takes beats from the card after it instead). Beats a move's
 * length doesn't divide are danced as a PART of that move (its first or last
 * beats, same name), or, for a travelling move, as a pause on its first pose.
 */

import type { Move, MoveKey, Track } from './catalog';
import type { MoveInstance } from './generator';

/** Hard minimum length of a card, in song beats (one bar) ... */
export const MIN_CARD_BEATS = 4;
/** ... and in seconds of song time (4 beats are enough up to 120 BPM; faster songs need 8). */
export const MIN_CARD_SEC = 2;
/** What the assembly aims for (two bars). */
export const PREF_CARD_BEATS = 8;

/** The name a card shows, plus the combo flag. */
export function cardKey(i: MoveInstance): string {
  return i.sig ? `★${i.move.name}` : i.move.name;
}

/** Two instances belong to the same card when they show the same name (and combo flag). */
export function sameCard(a: MoveInstance, b: MoveInstance): boolean {
  return a.sig === b.sig && a.move.name === b.move.name;
}

export interface Card {
  /** First beat, beat past the end. */
  start: number;
  end: number;
  /** Instance index range [from, to). */
  from: number;
  to: number;
}

/** The cards of a contiguous instance list. */
export function cardsOf(ins: readonly MoveInstance[]): Card[] {
  const out: Card[] = [];
  for (let k = 0; k < ins.length; k++) {
    const i = ins[k];
    const l = out[out.length - 1];
    if (l && sameCard(ins[l.to - 1], i)) {
      l.to = k + 1;
      l.end = i.start + i.span;
    } else out.push({ start: i.start, end: i.start + i.span, from: k, to: k + 1 });
  }
  return out;
}

/** Seconds of song time between two beat indices (beat times; extrapolated past the end). */
export function beatSeconds(times: readonly number[], a: number, b: number): number {
  const n = times.length;
  if (n < 2) return (b - a) * 0.5;
  const per = (times[n - 1] - times[0]) / (n - 1);
  const at = (x: number) => {
    if (x <= 0) return times[0] + x * per;
    if (x >= n - 1) return times[n - 1] + (x - n + 1) * per;
    const i = Math.floor(x);
    return times[i] + (times[i + 1] - times[i]) * (x - i);
  };
  return at(b) - at(a);
}

/** Whether a card [a, b) satisfies the hard minimum. */
export function cardLongEnough(times: readonly number[], a: number, b: number): boolean {
  return b - a >= MIN_CARD_BEATS && beatSeconds(times, a, b) >= MIN_CARD_SEC - 1e-6;
}

/** Floor x offset of an instance at move beat `at` of it: its origin plus the part of its drift covered by then. */
export function rootOffset(i: MoveInstance, at: number): number {
  if (!i.drift) return i.origin;
  const f = (at * (i.half ? 2 : 1)) / i.span;
  return i.origin + i.drift * (f < 0 ? 0 : f > 1 ? 1 : f);
}

/** Floor x where an instance leaves the coach (origin + travel + drift). */
export function endOffset(i: MoveInstance): number {
  return i.origin + (i.move.part ? 0 : i.move.travel * (i.mirror ? -1 : 1)) + (i.drift ?? 0);
}

// ---------------------------------------------------------------------------
// Parts of a move (same name): what a leftover beat or two is danced as

const PARTS = new Map<string, Move>();

function cutTrack(t: Track, from: number, to: number): Track {
  const cut = (keys: readonly MoveKey[]): MoveKey[] => {
    let ks = keys.filter((k) => k.at >= from - 1e-9 && k.at < to - 1e-9).map((k) => ({ at: k.at - from, pose: k.pose }));
    // A track with no key in the window keeps the one in force at its start.
    if (ks.length === 0 || ks[0].at > 1e-9) {
      let lead = keys[keys.length - 1];
      for (const k of keys) if (k.at <= from + 1e-9) lead = k;
      ks = [{ at: 0, pose: lead.pose }, ...ks];
    }
    return ks;
  };
  return { keys: cut(t.keys), mirrorKeys: cut(t.mirrorKeys) };
}

/**
 * Move beats [from, to) of `m` as a move of its own with the same name: the
 * first beats of a move (a leftover after its last full repeat) or its last
 * beats (a lead-in before its first). In-place moves only; cached.
 */
export function partOf(m: Move, from: number, to: number): Move {
  const key = `${m.id}|${from}|${to}|${m.name}`;
  let p = PARTS.get(key);
  if (!p) {
    const tracks = m.tracks.map((t) => cutTrack(t, from, to)) as unknown as [Track, Track, Track];
    const comp = cutTrack({ keys: m.keys, mirrorKeys: m.mirrorKeys }, from, to);
    p = { ...m, id: `${m.id}~part${from}-${to}`, beats: (to - from) as Move['beats'], travel: 0, tracks, keys: comp.keys, mirrorKeys: comp.mirrorKeys, icon: 0, part: true };
    PARTS.set(key, p);
  }
  return p;
}

/** `m`'s first pose held for `beats` move beats, same name (a travelling move's leftover: a pause, no slide). */
export function pauseOf(m: Move, beats: number): Move {
  const key = `${m.id}|pause|${beats}|${m.name}`;
  let p = PARTS.get(key);
  if (!p) {
    const one = (t: Track): Track => ({ keys: [{ at: 0, pose: t.keys[0].pose }], mirrorKeys: [{ at: 0, pose: t.mirrorKeys[0].pose }] });
    const tracks = m.tracks.map(one) as unknown as [Track, Track, Track];
    p = { ...m, id: `${m.id}~pause${beats}`, beats: beats as Move['beats'], travel: 0, tracks, keys: [{ at: 0, pose: m.keys[0].pose }], mirrorKeys: [{ at: 0, pose: m.mirrorKeys[0].pose }], icon: 0, part: true };
    PARTS.set(key, p);
  }
  return p;
}

const RENAMED = new Map<Move, Map<string, Move>>();
/** `m` showing another name (identity stable per name): flourishes keep their move's name, combos show one name. */
export function renamed(m: Move, name: string): Move {
  if (m.name === name) return m;
  let byName = RENAMED.get(m);
  if (!byName) RENAMED.set(m, (byName = new Map()));
  let r = byName.get(name);
  if (!r) byName.set(name, (r = { ...m, name }));
  return r;
}

// ---------------------------------------------------------------------------
// Tiling

/**
 * Instances of `m` covering [from, to): whole repeats, sides alternating,
 * travelling moves in out-and-back pairs. A repeat never runs across an
 * irregular bar line (one that isn't a whole bar of 4 from the repeat's
 * start), so 4-beat moves stay on the downbeats of odd bars too. Beats a
 * repeat doesn't fit are danced as part of the move (in place) or a pause on
 * its first pose (travelling). `tail`: the odd beats come first, as a lead-in
 * of the move's last beats (a move starting early).
 */
export function tileMove(
  m: Move, from: number, to: number, mult: number, cuts: readonly number[], base: Omit<MoveInstance, 'move' | 'mirror' | 'start' | 'span' | 'origin' | 'unitStart'>,
  o: { mirror?: boolean; origin?: number; unitStart?: boolean; tail?: boolean } = {},
): MoveInstance[] {
  const out: MoveInstance[] = [];
  const span = m.beats * mult;
  let mirror = !!o.mirror;
  let origin = o.origin ?? 0;
  let first = !!o.unitStart;
  const travel = m.travel !== 0;
  const push = (move: Move, s: number, len: number, mir: boolean) => {
    out.push({ ...base, move, mirror: mir, start: s, span: len, origin, unitStart: first, half: base.half });
    first = false;
  };
  const part = (s: number, len: number, lead: boolean) => {
    const mb = len / mult;
    if (travel) push(pauseOf(m, mb), s, len, false);
    else push(lead ? partOf(m, m.beats - mb, m.beats) : partOf(m, 0, mb), s, len, m.mirror ? (lead ? !mirror : mirror) : false);
  };
  let s = from;
  if (o.tail) {
    const rest = (to - from) % span;
    if (rest > 0) part(s, rest, true);
    s += rest;
  }
  let c = 0;
  while (c < cuts.length && cuts[c] <= s) c++;
  while (s < to) {
    // The next irregular bar line inside a repeat starting at s.
    let block = to;
    for (let j = c; j < cuts.length && cuts[j] < Math.min(to, s + span) && span <= 4; j++) {
      if (!o.tail && (cuts[j] - s) % 4 !== 0) {
        block = cuts[j];
        break;
      }
    }
    if (s + span <= block) {
      const mir = m.mirror ? mirror : false;
      push(m, s, span, mir);
      origin += m.travel * (mir ? -1 : 1);
      if (m.mirror) mirror = !mirror;
      s += span;
    } else {
      part(s, block - s, false);
      s = block;
    }
    while (c < cuts.length && cuts[c] <= s) c++;
  }
  // Travelling moves come home: an unpaired last repeat is danced on the spot
  // (it drifts back as far as it travels).
  if (travel && Math.abs(origin) > 1e-9) {
    for (let k = out.length - 1; k >= 0; k--) {
      if (out[k].move === m) {
        out[k] = { ...out[k], drift: -m.travel * (out[k].mirror ? -1 : 1) };
        const home = endOffset(out[k]);
        for (let j = k + 1; j < out.length; j++) out[j] = { ...out[j], origin: home };
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The rule

export interface CardContext {
  /** Beat times (s). */
  times: readonly number[];
  /** Bar starts (beat indices, ascending). */
  bars: readonly number[];
  /** Beats where a drop starts (a card there keeps its start). */
  drops: ReadonlySet<number>;
  /** Song beats per move beat (2 at half time). */
  mult: number;
}

/** The move a card dances (its first whole repeat; a combo or the groove can't be stretched). */
function mainOf(ins: readonly MoveInstance[], c: Card): Move | null {
  for (let k = c.from; k < c.to; k++) {
    const i = ins[k];
    if (i.sig || i.move.idle) return null;
    if (!i.move.part) return i.move;
  }
  return null;
}

const baseOf = (i: MoveInstance) => ({ half: i.half, section: i.section, sig: false, phrase: i.phrase });

/** The move continuing after `c` up to `to`. */
function extendForward(ins: MoveInstance[], c: Card, to: number, ctx: CardContext): MoveInstance[] {
  const m = mainOf(ins, c)!;
  let lastFull: MoveInstance | null = null;
  for (let k = c.to - 1; k >= c.from && !lastFull; k--) if (ins[k].move === m) lastFull = ins[k];
  const last = ins[c.to - 1];
  return tileMove(m, c.end, to, ctx.mult, ctx.bars, baseOf(last), { mirror: m.mirror && lastFull ? !lastFull.mirror : false, origin: endOffset(last) });
}

/** The move of card `c` starting early, at `from` (a lead-in of its last beats, then whole repeats). */
function extendBackward(ins: MoveInstance[], c: Card, from: number, ctx: CardContext): MoveInstance[] {
  const m = mainOf(ins, c)!;
  const first = ins[c.from];
  const want = m.mirror ? !first.mirror : false;
  for (const mirror of [false, true]) {
    const t = tileMove(m, from, c.start, ctx.mult, ctx.bars, baseOf(first), { mirror, origin: first.origin, tail: true, unitStart: first.unitStart });
    let lastFull: MoveInstance | undefined;
    for (const i of t) if (i.move === m) lastFull = i;
    if (!m.mirror || !lastFull || lastFull.mirror === want) {
      if (t.length) first.unitStart = false;
      return t;
    }
  }
  return [];
}

/**
 * The combo card `c`'s steps over [from, to): continuing after it (its steps
 * from the first, round and round) or, `lead`, leading into it (its last
 * steps). A step that doesn't fit is danced in part. Same card (name, combo flag).
 */
function comboSteps(ins: readonly MoveInstance[], c: Card, from: number, to: number, ctx: CardContext, lead: boolean): MoveInstance[] {
  const steps = ins.slice(c.from, c.to).filter((i) => !i.move.part);
  if (!steps.length) return [];
  const out: MoveInstance[] = [];
  const piece = (i: MoveInstance, len: number, tail: boolean): Move => {
    const mb = len / ctx.mult;
    if (i.move.travel !== 0) return pauseOf(i.move, mb);
    return tail ? partOf(i.move, i.move.beats - mb, i.move.beats) : partOf(i.move, 0, mb);
  };
  if (lead) {
    let b = to;
    for (let k = steps.length - 1, guard = 0; b > from && guard < 256; k = (k - 1 + steps.length) % steps.length, guard++) {
      const s = steps[k];
      const len = Math.min(s.span, b - from);
      b -= len;
      out.unshift({ ...s, start: b, span: len, unitStart: false, ...(len < s.span ? { move: piece(s, len, true), origin: 0, mirror: s.move.travel !== 0 ? false : s.mirror } : {}) });
    }
    if (out.length) out[0].unitStart = true;
  } else {
    let b = from;
    for (let k = 0, guard = 0; b < to && guard < 256; k = (k + 1) % steps.length, guard++) {
      const s = steps[k];
      const len = Math.min(s.span, to - b);
      out.push({ ...s, start: b, span: len, unitStart: false, ...(len < s.span ? { move: piece(s, len, false), mirror: s.move.travel !== 0 ? false : s.mirror } : {}) });
      b += len;
    }
  }
  return out;
}

/**
 * Enforce the card minimum on a contiguous routine (see the header): every
 * card of at least MIN_CARD_BEATS beats and MIN_CARD_SEC seconds, short
 * ones absorbed by their neighbours. Returns the new instance list.
 */
export function enforceCards(input: readonly MoveInstance[], ctx: CardContext): MoveInstance[] {
  let ins = input.slice();
  const ok = (a: number, b: number) => cardLongEnough(ctx.times, a, b);
  // The first bar start at or after beat b where [a, b') is long enough.
  const longEnd = (a: number, limit: number) => {
    for (const s of ctx.bars) if (s > a && s <= limit && ok(a, s)) return s;
    return ok(a, limit) ? limit : -1;
  };
  for (let guard = 0; guard < 2000; guard++) {
    const cards = cardsOf(ins);
    if (cards.length < 2) break;
    const k = cards.findIndex((c) => !ok(c.start, c.end));
    if (k < 0) break;
    const c = cards[k];
    const P = k > 0 ? cards[k - 1] : null;
    const N = k + 1 < cards.length ? cards[k + 1] : null;
    const pm = P ? mainOf(ins, P) : null;
    const nm = N ? mainOf(ins, N) : null;
    const cm = mainOf(ins, c);
    const onDrop = ctx.drops.has(c.start) && k > 0;
    const nOnDrop = !!N && ctx.drops.has(N.start);
    let next: MoveInstance[] | null = null;
    // 1. A card starting on a drop keeps its start: it takes beats from the next card.
    if (onDrop && cm && N && nm) {
      let e = longEnd(c.start, N.end);
      if (e < 0 || !ok(e, N.end)) e = N.end;
      const grow = extendForward(ins, c, e, ctx);
      const rest = e < N.end ? tileMove(nm, e, N.end, ctx.mult, ctx.bars, baseOf(ins[N.from]), { unitStart: true }) : [];
      next = [...ins.slice(0, c.to), ...grow, ...rest, ...ins.slice(N.to)];
    }
    // 2. The previous move carries on (unless the next is a better fit: in place vs travelling, or the song's first card).
    if (!next && P && pm && !(onDrop) && !(nm && !nOnDrop && pm.travel !== 0 && nm.travel === 0)) {
      next = [...ins.slice(0, P.to), ...extendForward(ins, P, c.end, ctx), ...ins.slice(c.to)];
    }
    // 3. The next move starts early (the song's first card always may: a pickup is never the drop).
    if (!next && N && nm && (!nOnDrop || k === 0)) {
      next = [...ins.slice(0, c.from), ...extendBackward(ins, N, c.start, ctx), ...ins.slice(N.from)];
    }
    // 3b. The song combo starts early (the pickup, a drop, or nothing else can take the beats):
    //     its last steps lead in, same card.
    if (!next && N && ins[N.from].sig && (!P || !pm || onDrop)) {
      const head = { ...ins[N.from], unitStart: false };
      next = [...ins.slice(0, c.from), ...comboSteps(ins, N, c.start, N.start, ctx, true), head, ...ins.slice(N.from + 1)];
    }
    // 4. Fallbacks: grow the card itself into the next one, or let the previous one carry on regardless.
    if (!next && cm && N && nm) {
      let e = longEnd(c.start, N.end);
      if (e < 0 || !ok(e, N.end)) e = N.end;
      const rest = e < N.end ? tileMove(nm, e, N.end, ctx.mult, ctx.bars, baseOf(ins[N.from]), { unitStart: true }) : [];
      next = [...ins.slice(0, c.to), ...extendForward(ins, c, e, ctx), ...rest, ...ins.slice(N.to)];
    }
    if (!next && P && pm) next = [...ins.slice(0, P.to), ...extendForward(ins, P, c.end, ctx), ...ins.slice(c.to)];
    // 5. The song combo carries on.
    if (!next && P && ins[P.from].sig) next = [...ins.slice(0, P.to), ...comboSteps(ins, P, c.start, c.end, ctx, false), ...ins.slice(c.to)];
    if (!next) break;
    ins = next;
  }
  return ins;
}
