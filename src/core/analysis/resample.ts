/**
 * Streaming band-limited resampler (windowed-sinc, polyphase table).
 *
 * Output sample j sits exactly at input time j * inRate / outRate (zero group
 * delay: the kernel is symmetric), so frame times computed on the output
 * timeline map directly back to the input timeline. The result is identical
 * no matter how the input is split into chunks, which is what lets the
 * streaming analyser's `finalize` reproduce the offline result.
 *
 * Pure TypeScript: no DOM, Web Audio or Node APIs.
 */

const PHASES = 1024;
const ZERO_CROSSINGS = 8;
const CUTOFF = 0.9; // fraction of the lower Nyquist frequency

export class Resampler {
  readonly inRate: number;
  readonly outRate: number;
  private readonly passthrough: boolean;
  private readonly k: number; // taps each side
  private readonly taps: number;
  private readonly table: Float32Array;
  private hist: Float32Array;
  private histStart = 0; // global input index of hist[0]
  private histLen = 0;
  private inCount = 0;
  private outIndex = 0;
  private outBuf: Float32Array = new Float32Array(0);

  constructor(inRate: number, outRate: number) {
    if (!(inRate > 0) || !(outRate > 0) || !Number.isFinite(inRate) || !Number.isFinite(outRate)) {
      throw new Error(`Invalid sample rates ${inRate} -> ${outRate}`);
    }
    this.inRate = inRate;
    this.outRate = outRate;
    this.passthrough = inRate === outRate;
    // Cutoff in cycles per input sample.
    const fc = 0.5 * Math.min(1, outRate / inRate) * CUTOFF;
    const halfWidth = ZERO_CROSSINGS / (2 * fc); // in input samples
    this.k = Math.ceil(halfWidth);
    this.taps = 2 * this.k;
    this.table = new Float32Array(this.passthrough ? 0 : (PHASES + 1) * this.taps);
    if (!this.passthrough) {
      for (let p = 0; p <= PHASES; p++) {
        const frac = p / PHASES;
        let sum = 0;
        const base = p * this.taps;
        for (let t = 0; t < this.taps; t++) {
          const x = t - this.k + 1 - frac; // offset of tap from the output position
          let v = 0;
          if (Math.abs(x) < halfWidth) {
            const arg = 2 * fc * x;
            const sinc = arg === 0 ? 1 : Math.sin(Math.PI * arg) / (Math.PI * arg);
            const wx = x / halfWidth;
            const w = 0.42 + 0.5 * Math.cos(Math.PI * wx) + 0.08 * Math.cos(2 * Math.PI * wx);
            v = sinc * w;
          }
          this.table[base + t] = v;
          sum += v;
        }
        for (let t = 0; t < this.taps; t++) this.table[base + t] /= sum;
      }
    }
    this.hist = new Float32Array(this.passthrough ? 0 : 8192);
  }

  /** Delay (in input samples) between receiving a sample and being able to emit it. */
  get latencySamples(): number {
    return this.passthrough ? 0 : this.k;
  }

  /**
   * Feed input samples. Returns the output samples that became available.
   * The returned array is an internal buffer, valid until the next call.
   * In passthrough mode (equal rates) the input array itself is returned.
   */
  process(input: Float32Array): Float32Array {
    if (this.passthrough) {
      this.inCount += input.length;
      return input;
    }
    this.append(input);
    return this.emit(false);
  }

  /** Emit the remaining tail (input treated as zero beyond its end). */
  flush(): Float32Array {
    if (this.passthrough) return new Float32Array(0);
    return this.emit(true);
  }

  private append(input: Float32Array): void {
    const needed = this.histLen + input.length;
    if (needed > this.hist.length) {
      const next = new Float32Array(Math.max(needed, this.hist.length * 2));
      next.set(this.hist.subarray(0, this.histLen));
      this.hist = next;
    }
    this.hist.set(input, this.histLen);
    this.histLen += input.length;
    this.inCount += input.length;
  }

  private emit(final: boolean): Float32Array {
    const { inRate, outRate, k, taps, table } = this;
    const totalOut = final ? Math.ceil((this.inCount * outRate) / inRate) : Infinity;
    // Outputs j are computable while floor(j * in / out) + k < inCount.
    let jEnd: number;
    if (final) {
      jEnd = totalOut;
    } else {
      const ok = (j: number) => Math.floor((j * inRate) / outRate) + k < this.inCount;
      jEnd = Math.max(this.outIndex, Math.ceil(((this.inCount - k) * outRate) / inRate));
      while (jEnd > this.outIndex && !ok(jEnd - 1)) jEnd--;
      while (ok(jEnd)) jEnd++;
    }
    const count = Math.max(0, jEnd - this.outIndex);
    if (this.outBuf.length < count) this.outBuf = new Float32Array(Math.max(count, 1024));
    const out = this.outBuf;
    const hist = this.hist;
    const hs = this.histStart;
    const hl = this.histLen;
    for (let n = 0; n < count; n++) {
      const j = this.outIndex + n;
      const c = (j * inRate) / outRate;
      const i0 = Math.floor(c);
      const p = Math.round((c - i0) * PHASES); // 0..PHASES (table has PHASES + 1 rows)
      const first = i0 - k + 1 - hs;
      const base = p * taps;
      let acc = 0;
      if (first >= 0 && first + taps <= hl) {
        for (let t = 0; t < taps; t++) acc += table[base + t] * hist[first + t];
      } else {
        for (let t = 0; t < taps; t++) {
          const idx = first + t;
          if (idx >= 0 && idx < hl) acc += table[base + t] * hist[idx];
        }
      }
      out[n] = acc;
    }
    this.outIndex += count;
    // Discard input no longer needed.
    const nextI0 = Math.floor((this.outIndex * inRate) / outRate);
    const keepFrom = nextI0 - k; // a little slack
    const drop = keepFrom - this.histStart;
    if (drop > 4096 && drop <= this.histLen) {
      this.hist.copyWithin(0, drop, this.histLen);
      this.histLen -= drop;
      this.histStart += drop;
    }
    return out.subarray(0, count);
  }
}

/** One-shot convenience: resample a whole buffer. */
export function resample(pcm: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate) return pcm;
  const r = new Resampler(inRate, outRate);
  const a = r.process(pcm);
  const head = new Float32Array(a);
  const tail = r.flush();
  const out = new Float32Array(head.length + tail.length);
  out.set(head);
  out.set(tail, head.length);
  return out;
}
