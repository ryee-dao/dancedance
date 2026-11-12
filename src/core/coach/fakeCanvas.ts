/**
 * Test helper: a canvas / 2D context stand-in for node that draws nothing
 * and counts draw calls per context (the sprite tiers' op accounting).
 */

export interface OpCounts {
  beginPath: number;
  fill: number;
  stroke: number;
  clip: number;
  fillRect: number;
  clearRect: number;
  drawImage: number;
  fillText: number;
}

const zero = (): OpCounts => ({ beginPath: 0, fill: 0, stroke: 0, clip: 0, fillRect: 0, clearRect: 0, drawImage: 0, fillText: 0 });

export interface FakeCanvas {
  width: number;
  height: number;
  ownerDocument: FakeDocument;
  ops: OpCounts;
  getContext(kind: string): CanvasRenderingContext2D;
}

export interface FakeDocument {
  createElement(tag: string): FakeCanvas;
  /** Every canvas made so far. */
  canvases: FakeCanvas[];
}

export function fakeDocument(): FakeDocument {
  const doc: FakeDocument = {
    canvases: [],
    createElement: () => {
      const c = fakeCanvas(doc);
      doc.canvases.push(c);
      return c;
    },
  };
  return doc;
}

function fakeCanvas(doc: FakeDocument): FakeCanvas {
  const ops = zero();
  let ctx: CanvasRenderingContext2D | null = null;
  const c: FakeCanvas = {
    width: 300,
    height: 150,
    ownerDocument: doc,
    ops,
    getContext: () => (ctx ??= fakeContext(c, ops)),
  };
  return c;
}

function fakeContext(canvas: FakeCanvas, ops: OpCounts): CanvasRenderingContext2D {
  const noop = (): void => {};
  const grad = { addColorStop: noop };
  const o: Record<string, unknown> = {
    canvas,
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
    measureText: (t: string) => ({ width: t.length * 6 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
  };
  for (const k of ['save', 'restore', 'translate', 'rotate', 'scale', 'setTransform', 'transform', 'resetTransform', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'rect', 'setLineDash', 'putImageData', 'strokeRect', 'strokeText']) o[k] = noop;
  for (const k of Object.keys(ops) as (keyof OpCounts)[]) {
    o[k] = () => {
      ops[k]++;
    };
  }
  return o as unknown as CanvasRenderingContext2D;
}

/** Copy and reset a canvas's counters. */
export function takeOps(c: FakeCanvas): OpCounts {
  const r = { ...c.ops };
  for (const k of Object.keys(c.ops) as (keyof OpCounts)[]) c.ops[k] = 0;
  return r;
}
