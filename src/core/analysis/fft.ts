/**
 * Radix-2 real FFT.
 *
 * A real signal of length N is packed into a complex signal of length N/2
 * (even samples -> real part, odd samples -> imaginary part), transformed with
 * an iterative in-place radix-2 FFT and then split into the N/2 + 1 unique
 * bins of the real spectrum. All tables and work buffers are allocated once in
 * the constructor, so `forward` / `power` allocate nothing.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */
export class RealFFT {
  readonly size: number;
  private readonly half: number;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly cosT: Float64Array;
  private readonly sinT: Float64Array;
  private readonly splitCos: Float64Array;
  private readonly splitSin: Float64Array;
  private readonly rev: Uint32Array;

  constructor(size: number) {
    if (!Number.isInteger(size) || size < 4 || (size & (size - 1)) !== 0) {
      throw new Error(`RealFFT size must be a power of two >= 4, got ${size}`);
    }
    this.size = size;
    const m = size >> 1;
    this.half = m;
    this.re = new Float64Array(m);
    this.im = new Float64Array(m);
    this.cosT = new Float64Array(m >> 1 || 1);
    this.sinT = new Float64Array(m >> 1 || 1);
    for (let i = 0; i < m >> 1; i++) {
      this.cosT[i] = Math.cos((2 * Math.PI * i) / m);
      this.sinT[i] = Math.sin((2 * Math.PI * i) / m);
    }
    this.splitCos = new Float64Array(m + 1);
    this.splitSin = new Float64Array(m + 1);
    for (let k = 0; k <= m; k++) {
      this.splitCos[k] = Math.cos((2 * Math.PI * k) / size);
      this.splitSin[k] = Math.sin((2 * Math.PI * k) / size);
    }
    this.rev = new Uint32Array(m);
    let bits = 0;
    while (1 << bits < m) bits++;
    for (let i = 0; i < m; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      this.rev[i] = r;
    }
  }

  /** Number of unique output bins: size / 2 + 1. */
  get bins(): number {
    return this.half + 1;
  }

  /**
   * Forward transform of `input` (length >= size; extra samples ignored).
   * Writes bins 0..size/2 into outRe / outIm (length >= size/2 + 1).
   */
  forward(input: ArrayLike<number>, outRe: Float64Array, outIm: Float64Array): void {
    this.transformPacked(input);
    const m = this.half;
    const re = this.re;
    const im = this.im;
    for (let k = 0; k <= m; k++) {
      const i1 = k === m ? 0 : k;
      const i2 = k === 0 ? 0 : m - k;
      const a = re[i1];
      const b = im[i1];
      const c = re[i2];
      const d = im[i2];
      const feRe = 0.5 * (a + c);
      const feIm = 0.5 * (b - d);
      const foRe = 0.5 * (b + d);
      const foIm = -0.5 * (a - c);
      const cs = this.splitCos[k];
      const sn = this.splitSin[k];
      outRe[k] = feRe + cs * foRe + sn * foIm;
      outIm[k] = feIm + cs * foIm - sn * foRe;
    }
  }

  /** Power spectrum |X[k]|^2 for k = 0..size/2 into `out` (length >= size/2 + 1). */
  power(input: ArrayLike<number>, out: Float64Array | Float32Array): void {
    this.transformPacked(input);
    const m = this.half;
    const re = this.re;
    const im = this.im;
    for (let k = 0; k <= m; k++) {
      const i1 = k === m ? 0 : k;
      const i2 = k === 0 ? 0 : m - k;
      const a = re[i1];
      const b = im[i1];
      const c = re[i2];
      const d = im[i2];
      const feRe = 0.5 * (a + c);
      const feIm = 0.5 * (b - d);
      const foRe = 0.5 * (b + d);
      const foIm = -0.5 * (a - c);
      const cs = this.splitCos[k];
      const sn = this.splitSin[k];
      const xr = feRe + cs * foRe + sn * foIm;
      const xi = feIm + cs * foIm - sn * foRe;
      out[k] = xr * xr + xi * xi;
    }
  }

  private transformPacked(input: ArrayLike<number>): void {
    const m = this.half;
    const re = this.re;
    const im = this.im;
    const rev = this.rev;
    for (let n = 0; n < m; n++) {
      const j = rev[n];
      re[j] = input[2 * n];
      im[j] = input[2 * n + 1];
    }
    const cosT = this.cosT;
    const sinT = this.sinT;
    for (let size = 2; size <= m; size <<= 1) {
      const halfSize = size >> 1;
      const step = m / size;
      for (let start = 0; start < m; start += size) {
        for (let k = 0; k < halfSize; k++) {
          const wr = cosT[k * step];
          const wi = -sinT[k * step];
          const a = start + k;
          const b = a + halfSize;
          const tr = wr * re[b] - wi * im[b];
          const ti = wr * im[b] + wi * re[b];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }
}
