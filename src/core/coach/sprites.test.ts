import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { partnerDepth, partnerOf } from '../choreo/duoMoves';
import { findMove } from '../choreo/moves';
import { synthMap } from '../../demo/synth';
import { PoseEvaluator } from './animator';
import { Conductor } from './conductor';
import { DuoRenderer2D, type DuoSceneInfo, type DuoStripInfo } from './duoRenderer';
import { DuoTracks } from './duoTracks';
import { fakeDocument, takeOps, type FakeCanvas, type FakeDocument, type OpCounts } from './fakeCanvas';
import { loopPlan } from './loop';
import { StageRenderer2D, type SceneInfo, type StripInfo } from './renderer';
import { CH, createPose, createSkeleton, solveSkeleton, type Skeleton } from './skeleton';
import { SpriteCache, setSharedSpriteCache, sharedSpriteCache, spriteKey, type PieceArtist } from './sprites';
import type { CoachBuild, CoachStyle } from './styles';

let doc: FakeDocument;
const g = globalThis as { document?: unknown };
const savedDoc = g.document;
beforeAll(() => {
  doc = fakeDocument();
  g.document = doc;
});
afterAll(() => {
  g.document = savedDoc;
  setSharedSpriteCache(null);
});

const LOOKS: [CoachStyle, CoachBuild][] = [
  ['classic', 'female'],
  ['classic', 'male'],
  ['human', 'female'],
  ['human', 'male'],
  ['sticker', 'female'],
  ['sticker', 'male'],
];

/** Per-frame skeletons of a routine window (solved once, replayed identically). */
function singleFrames(videoId: string, from: number, secs: number): Skeleton[] {
  const map = synthMap(120, videoId);
  const tl = { map, live: null, revision: 1 };
  const c = new Conductor();
  const pose = createPose();
  const out: Skeleton[] = [];
  for (let i = 0; i < secs * 60; i++) {
    const t = from + i / 60;
    c.update(tl, videoId, 'cardio', t);
    c.evaluate(t, pose, 0.7);
    out.push(solveSkeleton(pose, createSkeleton()));
  }
  return out;
}

function duoFrames(videoId: string, from: number, secs: number): { sk1: Skeleton; sk2: Skeleton; z1: number; z2: number; hook: 0 | 1 | -1; rope: boolean }[] {
  const map = synthMap(120, videoId);
  const tl = { map, live: null, revision: 1 };
  const c = new Conductor();
  const tracks = new DuoTracks();
  const e1 = new PoseEvaluator();
  const e2 = new PoseEvaluator();
  const p1 = createPose();
  const p2 = createPose();
  const depth: [number, number] = [0, 0];
  const out = [];
  for (let i = 0; i < secs * 60; i++) {
    const t = from + i / 60;
    c.update(tl, videoId, 'cardio', t);
    tracks.sync(c.plan, 'cardio', videoId);
    e1.evaluate(tracks.v1!, t, p1, { energy: 0.7 });
    e2.evaluate(tracks.v2!, t, p2, { energy: 0.7 });
    depth[0] = depth[1] = 0;
    const i1 = e1.inst(tracks.v1!, e1.instIndex);
    const own = partnerOf(i1.move);
    if (own) partnerDepth(own.pm, own.part * 4 + (e1.beat - i1.start) / (i1.half ? 2 : 1), p1[CH.SPIN], p2[CH.SPIN], depth);
    out.push({ sk1: solveSkeleton(p1, createSkeleton()), sk2: solveSkeleton(p2, createSkeleton()), z1: depth[0], z2: depth[1], hook: own?.pm.hook ?? 0, rope: own?.pm.prop === 'rope' });
  }
  return out;
}

const loop = loopPlan(findMove('step-clap')!, 0.5);
const loopEv = new PoseEvaluator();
function loopSkeleton(t: number): Skeleton {
  const pose = createPose();
  loopEv.evaluate(loop, t % (loop.loopBeats * loop.period), pose, { energy: 0.5 });
  return solveSkeleton(pose, createSkeleton());
}

const add = (a: OpCounts, b: OpCounts): void => {
  for (const k of Object.keys(a) as (keyof OpCounts)[]) a[k] += b[k];
};

/** Most path fills a figure still makes per frame in sprite mode (its torso shapes; see the painters). */
const TORSO_FILLS: Record<CoachStyle, Record<CoachBuild, number>> = {
  classic: { female: 3, male: 4 },
  human: { female: 4, male: 5 },
  sticker: { female: 7, male: 6 },
};

describe('sprite tiers: per-frame draw calls (steady state)', () => {
  const singles = singleFrames('s4', 94, 3).concat(singleFrames('s4', 63.5, 2));
  const duos = duoFrames('demo-song', 125.5, 3).concat(duoFrames('demo-song', 87, 2));

  for (const [style, build] of LOOKS) {
    it(`single, ${style} ${build}: blits and rect fills only, no strokes; torso fills bounded`, () => {
      setSharedSpriteCache(new SpriteCache(undefined, 12));
      const canvas = doc.createElement('canvas') as unknown as FakeCanvas;
      const r = new StageRenderer2D(canvas as unknown as HTMLCanvasElement, style, build);
      r.quality = { cached: true, sprites: true };
      r.resize(1280, 720, true, 0.9);
      const strip: StripInfo = { now: 'Twist', sig: false, progress: 0.3, beatsToChange: 3, next: { name: 'Step Clap', skeleton: null }, after: { name: 'March', skeleton: loopSkeleton(0.3) } };
      const scene: SceneInfo = { t: 0, beat: 0, half: false, energy: 0.8, strip };
      const frame = (i: number, budget: number) => {
        r.spriteBudget = budget;
        scene.t = i / 60;
        scene.beat = i / 30;
        strip.progress = (i % 120) / 120;
        strip.next!.skeleton = loopSkeleton(i / 60);
        r.render(singles[i], scene);
      };
      // Warm-up passes make every sprite the window needs (the second once the
      // smoothed energy has reached the floor rings); the measured pass must not need new ones.
      for (let k = 0; k < 2; k++) for (let i = 0; i < singles.length; i++) frame(i, Infinity);
      const cache = sharedSpriteCache();
      cache.resetStats();
      takeOps(canvas);
      const total: OpCounts = { beginPath: 0, fill: 0, stroke: 0, clip: 0, fillRect: 0, clearRect: 0, drawImage: 0, fillText: 0 };
      let maxFill = 0;
      for (let i = 0; i < singles.length; i++) {
        frame(i, 0);
        const ops = takeOps(canvas);
        expect(ops.stroke).toBe(0);
        expect(ops.clip).toBeLessThanOrEqual(1); // the NEXT card's rect clip
        maxFill = Math.max(maxFill, ops.fill);
        add(total, ops);
      }
      const st = cache.stats();
      expect(st.made).toBe(0);
      expect(st.direct).toBe(0);
      // Main coach + the NEXT card's figure.
      expect(maxFill).toBeLessThanOrEqual(2 * TORSO_FILLS[style][build]);
      const n = singles.length;
      console.log(`single ${style}/${build}: per frame ${(total.drawImage / n).toFixed(0)} drawImage, ${(total.fillRect / n).toFixed(1)} fillRect, ${(total.fill / n).toFixed(1)} path fills (max ${maxFill}), 0 strokes, ${(total.clip / n).toFixed(0)} rect clip; cache ${st.entries} entries, ${(st.usedBytes / 2 ** 20).toFixed(1)} MB`);
    });

    it(`duo, ${style} ${build}: blits and rect fills only, no strokes; torso fills bounded`, () => {
      setSharedSpriteCache(new SpriteCache(undefined, 16));
      const canvas = doc.createElement('canvas') as unknown as FakeCanvas;
      const r = new DuoRenderer2D(canvas as unknown as HTMLCanvasElement, style, build);
      r.quality = { cached: true, sprites: true };
      r.resize(1280, 720, true, 0.9);
      const card = { shared: true, name1: 'Elbow Swing', name2: 'Elbow Swing', sk1: null as Skeleton | null, sk2: null as Skeleton | null, pair: true };
      const strip: DuoStripInfo = { label: 'PARTNER MOVE', sig: false, now: { ...card }, progress: 0.4, beatsToChange: 2, next: card, after: { ...card, sk1: null, sk2: null } };
      const scene: DuoSceneInfo = { t: 0, beat: 0, half: false, energy: 0.8, z1: 0, z2: 0, prop: null, hook: 0, strip };
      const frame = (i: number, budget: number) => {
        const f = duos[i];
        r.spriteBudget = budget;
        scene.t = i / 60;
        scene.beat = i / 30;
        scene.z1 = f.z1;
        scene.z2 = f.z2;
        // The routine may not schedule the elbow swing in these windows, so the
        // interlocked-forearm redraw is also exercised directly now and then.
        scene.hook = f.hook || (i % 60 < 20 ? 1 : 0);
        scene.prop = f.rope || i % 90 < 30 ? 'rope' : null; // the rope too, now and then
        strip.progress = (i % 120) / 120;
        card.sk1 = duos[(i + 40) % duos.length].sk1;
        card.sk2 = duos[(i + 40) % duos.length].sk2;
        r.render(f.sk1, f.sk2, scene);
      };
      for (let i = 0; i < duos.length; i++) frame(i, Infinity);
      const cache = sharedSpriteCache();
      cache.resetStats();
      takeOps(canvas);
      const total: OpCounts = { beginPath: 0, fill: 0, stroke: 0, clip: 0, fillRect: 0, clearRect: 0, drawImage: 0, fillText: 0 };
      let maxFill = 0;
      let hooks = 0;
      for (let i = 0; i < duos.length; i++) {
        frame(i, 0);
        const ops = takeOps(canvas);
        expect(ops.stroke).toBe(0);
        expect(ops.fillText).toBe(0); // labels and tags are badges
        expect(ops.clip).toBeLessThanOrEqual(1);
        maxFill = Math.max(maxFill, ops.fill);
        if (scene.hook) hooks++;
        add(total, ops);
      }
      const st = cache.stats();
      expect(st.made).toBe(0);
      expect(st.direct).toBe(0);
      expect(hooks).toBeGreaterThan(0); // the window includes the elbow swing
      // Two coaches (P1 one build, P2 the other) + the NEXT card's pair.
      expect(maxFill).toBeLessThanOrEqual(2 * (TORSO_FILLS[style].female + TORSO_FILLS[style].male));
      const n = duos.length;
      console.log(`duo ${style}/${build}: per frame ${(total.drawImage / n).toFixed(0)} drawImage, ${(total.fillRect / n).toFixed(1)} fillRect, ${(total.fill / n).toFixed(1)} path fills (max ${maxFill}), 0 strokes, ${(total.clip / n).toFixed(0)} rect clip; cache ${st.entries} entries, ${(st.usedBytes / 2 ** 20).toFixed(1)} MB`);
    });
  }

  it('the still strip (redrawn when the move changes) is drawn without strokes too', () => {
    setSharedSpriteCache(new SpriteCache(undefined, 12));
    const canvas = doc.createElement('canvas') as unknown as FakeCanvas;
    const before = doc.canvases.length;
    const r = new StageRenderer2D(canvas as unknown as HTMLCanvasElement, 'human', 'female');
    r.quality = { cached: true, sprites: true };
    r.resize(1280, 720, true, 0.9);
    const layers = () => doc.canvases.slice(before).filter((c) => c !== canvas && c.width === 1280);
    const strip: StripInfo = { now: 'A', sig: false, progress: 0, beatsToChange: 3, next: { name: 'B', skeleton: loopSkeleton(0) }, after: { name: 'C', skeleton: loopSkeleton(0.5) } };
    const scene: SceneInfo = { t: 0, beat: 0, half: false, energy: 0.6, strip };
    r.spriteBudget = Infinity;
    r.render(singles[0], scene);
    strip.now = 'D'; // warm the next strip too
    r.render(singles[1], scene);
    for (const l of layers()) takeOps(l);
    r.spriteBudget = 0;
    strip.now = 'A';
    r.render(singles[0], scene);
    let strokes = 0, texts = 0;
    for (const l of layers()) {
      const o = takeOps(l);
      strokes += o.stroke;
      texts += o.fillText;
    }
    expect(texts).toBeGreaterThan(0); // the static layer was redrawn (text stays text: drawn only on a change)
    expect(strokes).toBe(0);
  });
});

describe('sprite cache', () => {
  class Box implements PieceArtist {
    n = 0;
    drawPiece(ctx: CanvasRenderingContext2D): void {
      this.n++;
      ctx.fillRect(0, 0, 10, 10);
    }
  }

  it('makes an entry once, then reuses it; respects the per-frame budget', () => {
    const c = new SpriteCache(undefined, 2, 256);
    const a = new Box();
    c.beginFrame(1);
    const k1 = spriteKey(16, 1, 200, 0, 0, 0, 1);
    const k2 = spriteKey(16, 1, 200, 0, 0, 0, 2);
    expect(c.get(k1)).toBeNull();
    expect(c.miss(k1, 0, 0, 10, 10, a, 0)).not.toBeNull();
    expect(c.miss(k2, 0, 0, 10, 10, a, 0)).toBeNull(); // budget used up
    c.beginFrame(1);
    expect(c.get(k1)).not.toBeNull();
    expect(a.n).toBe(1);
    expect(c.stats()).toMatchObject({ entries: 1, made: 1, misses: 2, pages: 1 });
  });

  it('is bounded: the least recently used page is cleared for new entries', () => {
    const c = new SpriteCache(undefined, 2, 128);
    const a = new Box();
    const keys: number[] = [];
    for (let i = 0; i < 40; i++) {
      c.beginFrame(Infinity);
      const k = spriteKey(16, 1, 200, 0, 0, 0, i);
      keys.push(k);
      c.miss(k, 0, 0, 50, 50, a, 0); // 4 per page (52 + gutters)
    }
    const s = c.stats();
    expect(s.pages).toBe(2);
    expect(s.bytes).toBe(2 * 128 * 128 * 4);
    expect(s.evictions).toBeGreaterThan(0);
    expect(c.get(keys[39])).not.toBeNull();
    expect(c.get(keys[0])).toBeNull();
  });

  it('never clears a page used in the current frame', () => {
    const c = new SpriteCache(undefined, 1, 64);
    const a = new Box();
    c.beginFrame(Infinity);
    const k1 = spriteKey(16, 1, 200, 0, 0, 0, 1);
    c.miss(k1, 0, 0, 50, 50, a, 0);
    // The page is full and in use this frame: a second entry can't be made now.
    expect(c.miss(spriteKey(16, 1, 200, 0, 0, 0, 2), 0, 0, 50, 50, a, 0)).toBeNull();
    expect(c.get(k1)).not.toBeNull();
  });
});
