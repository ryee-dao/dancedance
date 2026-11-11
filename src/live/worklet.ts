/**
 * AudioWorklet processor: downmixes the captured input to mono and posts it
 * to the main thread in 1024-sample chunks (~21 ms at 48 kHz), each tagged
 * with the AudioContext time just after its last sample.
 *
 * Loaded with audioWorklet.addModule() (see capture.ts). Runs in the
 * AudioWorkletGlobalScope, whose globals are declared here because the DOM
 * lib doesn't include them.
 */

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;
declare const currentTime: number;
declare const sampleRate: number;

const CHUNK = 1024;

class CaptureProcessor extends AudioWorkletProcessor {
  private buf = new Float32Array(CHUNK);
  private n = 0;

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;
    const len = input[0].length;
    const chs = input.length;
    for (let i = 0; i < len; i++) {
      let v = 0;
      for (let c = 0; c < chs; c++) v += input[c][i];
      this.buf[this.n++] = v / chs;
      if (this.n === CHUNK) {
        const end = currentTime + (i + 1) / sampleRate;
        this.port.postMessage({ pcm: this.buf, end }, [this.buf.buffer]);
        this.buf = new Float32Array(CHUNK);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor('dd-capture', CaptureProcessor);

export {};
