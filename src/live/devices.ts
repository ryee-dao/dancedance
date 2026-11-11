/**
 * Live capture devices for one visit to the play screen. The mic or tab
 * capture is opened at most once and reused by every song in a Shuffle run
 * (so tab sharing doesn't have to be re-confirmed per song), and everything
 * is stopped when the play screen closes.
 */
import { LiveError, startCapture, type Capture } from './capture';
import { micSupported, openMic, trackLatency } from './mic';
import { openTabAudio, tabShareSupported } from './tabAudio';

export class LiveDevices {
  private mic: Promise<Capture> | null = null;
  private tab: Capture | null = null;
  private released = false;
  /** Set when the user stops tab sharing from the browser UI. */
  onTabEnded: (() => void) | null = null;

  readonly micSupported = micSupported();
  readonly tabSupported = tabShareSupported();

  /** Open (or reuse) the microphone capture. */
  getMic(): Promise<Capture> {
    if (this.released) return Promise.reject(new LiveError('cancelled'));
    if (!this.mic) {
      const p = openMic().then(async (stream) => {
        if (this.released) {
          for (const t of stream.getTracks()) t.stop();
          throw new LiveError('cancelled');
        }
        return startCapture(stream);
      });
      this.mic = p;
      p.catch(() => {
        if (this.mic === p) this.mic = null; // allow a retry later
      });
    }
    return this.mic;
  }

  /** The open tab capture, if it is still running. */
  currentTab(): Capture | null {
    if (this.tab && !this.tab.alive()) {
      this.tab.stop();
      this.tab = null;
    }
    return this.tab;
  }

  /** Ask to share this tab's audio (must run from a user gesture). */
  async getTab(): Promise<Capture> {
    if (this.released) throw new LiveError('cancelled');
    const existing = this.currentTab();
    if (existing) return existing;
    const stream = await openTabAudio();
    if (this.released) {
      for (const t of stream.getTracks()) t.stop();
      throw new LiveError('cancelled');
    }
    const cap = await startCapture(stream);
    this.tab = cap;
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (this.tab === cap) {
        cap.stop();
        this.tab = null;
        this.onTabEnded?.();
      }
    });
    return cap;
  }

  /** Stop using the mic (e.g. after switching to tab audio). */
  closeMic(): void {
    const m = this.mic;
    this.mic = null;
    void m?.then((c) => c.stop()).catch(() => {});
  }

  micLatencyParts(cap: Capture): { contextLatency: number; trackLatency: number } {
    return { contextLatency: cap.contextLatency(), trackLatency: trackLatency(cap.stream) };
  }

  release(): void {
    this.released = true;
    this.closeMic();
    this.tab?.stop();
    this.tab = null;
    this.onTabEnded = null;
  }
}
