/**
 * yt-dlp provisioning: the official release binary for this platform,
 * downloaded into the helper's app-data folder, verified against the
 * release's SHA2-256SUMS, re-verified at every start, and kept current (a
 * newer release is looked for at most once a day, or sooner after YouTube
 * changes break the current one).
 *
 * The JavaScript runtime yt-dlp needs for YouTube's challenges is the helper
 * itself (see jsruntime.ts), so nothing else is downloaded.
 */
import { join } from './paths.ts';

const REPO = 'https://github.com/yt-dlp/yt-dlp';
const TAG_RE = /^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/;
const DAY_MS = 24 * 3600 * 1000;
const MAX_TOOL_BYTES = 200 * 1024 * 1024;

/** Release asset for this OS/CPU, or null when yt-dlp has no standalone build for it. */
export function ytdlpAsset(os: string, arch: string): string | null {
  if (os === 'darwin') return 'yt-dlp_macos'; // universal (arm64 + x86_64)
  if (os === 'windows') return arch === 'aarch64' ? 'yt-dlp_arm64.exe' : 'yt-dlp.exe';
  if (os === 'linux') return arch === 'aarch64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  return null;
}

/** The checksum for `asset` in a SHA2-256SUMS file ("<hex>  <name>" lines), lowercased. */
export function checksumFor(sums: string, asset: string): string | null {
  for (const line of sums.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(\S+)\s*$/.exec(line.trim());
    if (m && m[2] === asset) return m[1].toLowerCase();
  }
  return null;
}

/** Tag from a /releases/latest redirect ("…/releases/tag/2026.10.26"). */
export function tagFromLocation(location: string | null): string | null {
  const m = /\/releases\/tag\/([^/?#]+)$/.exec(location ?? '');
  const tag = m ? decodeURIComponent(m[1]) : null;
  return tag && TAG_RE.test(tag) ? tag : null;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface Installed {
  tag: string;
  asset: string;
  sha256: string;
  /** Output of `yt-dlp --version`. */
  version: string;
  lastCheck: number;
}

export type ToolPhase = 'checking' | 'downloading' | 'ready' | 'error';

export interface ToolState {
  phase: ToolPhase;
  progress: number | null;
  ytdlpVersion: string | null;
  message: string | null;
}

type Log = (msg: string) => void;

export class Tools {
  private installed: Installed | null = null;
  private st: ToolState = { phase: 'checking', progress: null, ytdlpVersion: null, message: null };
  private busy: Promise<void> | null = null;
  readonly binDir: string;
  readonly asset: string | null;

  constructor(
    appDir: string,
    private readonly log: Log,
    private readonly onChange: (s: ToolState) => void = () => {},
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.binDir = join(appDir, 'bin');
    this.asset = ytdlpAsset(Deno.build.os, Deno.build.arch);
  }

  state(): ToolState {
    return this.st;
  }

  ytdlpPath(): string {
    return join(this.binDir, Deno.build.os === 'windows' ? 'yt-dlp.exe' : 'yt-dlp');
  }

  private set(s: Partial<ToolState>): void {
    this.st = { ...this.st, ...s };
    this.onChange(this.st);
  }

  /** Make sure a verified yt-dlp is installed; update it if the last check is over a day old. */
  ensure(opts: { forceCheck?: boolean } = {}): Promise<void> {
    if (!this.busy) {
      this.busy = this.doEnsure(opts).finally(() => {
        this.busy = null;
      });
    }
    return this.busy;
  }

  /** YouTube broke the current yt-dlp: look for a newer one (at most hourly). */
  maybeUpdateSoon(): void {
    if (this.installed && Date.now() - this.installed.lastCheck > 3600_000) void this.ensure({ forceCheck: true });
  }

  private statePath(): string {
    return join(this.binDir, 'tools.json');
  }

  private async readInstalled(): Promise<Installed | null> {
    try {
      const j = JSON.parse(await Deno.readTextFile(this.statePath())) as Installed;
      if (!j || typeof j.sha256 !== 'string' || typeof j.tag !== 'string') return null;
      const bytes = await Deno.readFile(this.ytdlpPath());
      if ((await sha256Hex(bytes)) !== j.sha256) {
        this.log('installed yt-dlp does not match its recorded checksum; downloading it again');
        return null;
      }
      return j;
    } catch {
      return null;
    }
  }

  private async writeInstalled(i: Installed): Promise<void> {
    await Deno.writeTextFile(this.statePath(), JSON.stringify(i, null, 2));
  }

  private async doEnsure(opts: { forceCheck?: boolean }): Promise<void> {
    try {
      if (!this.asset) throw new Error(`yt-dlp has no ready-made build for ${Deno.build.os} ${Deno.build.arch}`);
      await Deno.mkdir(this.binDir, { recursive: true });
      if (!this.installed) this.installed = await this.readInstalled();
      if (this.installed) this.set({ phase: 'ready', ytdlpVersion: this.installed.version, message: null, progress: null });
      const due = !this.installed || opts.forceCheck || Date.now() - this.installed.lastCheck > DAY_MS;
      if (!due) return;

      let latest: string | null = null;
      try {
        latest = await this.latestTag();
      } catch (err) {
        if (!this.installed) throw err;
        this.log(`update check failed (keeping yt-dlp ${this.installed.version}): ${errText(err)}`);
        return;
      }
      if (this.installed && this.installed.tag === latest) {
        this.installed = { ...this.installed, lastCheck: Date.now() };
        await this.writeInstalled(this.installed);
        return;
      }
      await this.install(latest);
    } catch (err) {
      const message = errText(err);
      this.log(`tool setup failed: ${message}`);
      if (this.installed) this.set({ phase: 'ready', progress: null });
      else this.set({ phase: 'error', progress: null, message: `Could not download yt-dlp: ${message}` });
    }
  }

  private async latestTag(): Promise<string> {
    const res = await this.fetchFn(`${REPO}/releases/latest`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    await res.body?.cancel();
    const tag = tagFromLocation(res.headers.get('Location'));
    if (!tag) throw new Error(`could not find the latest yt-dlp release (HTTP ${res.status})`);
    return tag;
  }

  private async download(url: string, onProgress?: (f: number) => void): Promise<Uint8Array> {
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(10 * 60_000) });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url.split('/').pop()}`);
    const total = Number(res.headers.get('Content-Length')) || 0;
    if (total > MAX_TOOL_BYTES) throw new Error('download is unexpectedly large');
    const chunks: Uint8Array[] = [];
    let got = 0;
    for await (const c of res.body) {
      got += c.byteLength;
      if (got > MAX_TOOL_BYTES) throw new Error('download is unexpectedly large');
      chunks.push(c);
      if (total) onProgress?.(got / total);
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.byteLength;
    }
    return out;
  }

  private async install(tag: string): Promise<void> {
    const asset = this.asset!;
    const base = `${REPO}/releases/download/${encodeURIComponent(tag)}`;
    this.log(`downloading yt-dlp ${tag} (${asset})`);
    if (!this.installed) this.set({ phase: 'downloading', progress: 0, message: null });
    const sums = new TextDecoder().decode(await this.download(`${base}/SHA2-256SUMS`));
    const want = checksumFor(sums, asset);
    if (!want) throw new Error(`no checksum for ${asset} in SHA2-256SUMS`);
    const bytes = await this.download(`${base}/${asset}`, (f) => {
      if (!this.installed) this.set({ phase: 'downloading', progress: f });
    });
    const got = await sha256Hex(bytes);
    if (got !== want) throw new Error(`checksum mismatch for ${asset} (expected ${want.slice(0, 12)}…, got ${got.slice(0, 12)}…)`);

    const tmp = `${this.ytdlpPath()}.download`;
    await Deno.writeFile(tmp, bytes, { mode: 0o755 });
    if (Deno.build.os !== 'windows') await Deno.chmod(tmp, 0o755);
    const version = await runVersion(tmp);
    await Deno.rename(tmp, this.ytdlpPath());
    this.installed = { tag, asset, sha256: got, version, lastCheck: Date.now() };
    await this.writeInstalled(this.installed);
    this.log(`yt-dlp ${version} installed and verified (sha256 ${got.slice(0, 16)}…)`);
    this.set({ phase: 'ready', progress: null, ytdlpVersion: version, message: null });
  }
}

async function runVersion(path: string): Promise<string> {
  const out = await new Deno.Command(path, { args: ['--version'], stdout: 'piped', stderr: 'piped', signal: AbortSignal.timeout(120_000) }).output();
  const v = new TextDecoder().decode(out.stdout).trim();
  if (!out.success || !v) throw new Error('the downloaded yt-dlp does not run on this computer');
  return v.slice(0, 40);
}

export function errText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300);
}
