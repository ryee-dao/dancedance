/**
 * Android TV in-app update: the state the shell reports (bridge v5, see
 * Updates.kt) and what Options and the home screen show for it. The shell
 * does all the work (GitHub check, download, verification, system installer);
 * this side only shows status strings and progress numbers and passes the
 * remote's button presses back.
 */

export type UpdatePhase =
  | 'off'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'needs-permission'
  | 'installing'
  | 'error'
  | 'manual';

export interface UpdateState {
  phase: UpdatePhase;
  /** Installed versionName / versionCode. */
  installed: string;
  installedCode: number;
  /** The release on offer (display name, e.g. "0.6.0"). */
  latest: string | null;
  /** Reason (error), a note ("Update cancelled.") or instructions (needs-permission, manual). */
  message: string | null;
  /** For 'error': what failed. */
  stage: 'check' | 'update' | null;
  /** For 'manual': the Downloader address. */
  manualUrl: string | null;
  /** Download progress in bytes (total 0 = unknown). */
  received: number;
  total: number;
}

/** What the platform offers the UI (absent on web and in shells older than bridge v5). */
export interface AppUpdates {
  state(): UpdateState;
  /** Called on every state change; returns an unsubscribe function. */
  onChange(fn: (s: UpdateState) => void): () => void;
  /** Without `force` only the first call per app start asks GitHub. */
  check(force?: boolean): void;
  start(): void;
  cancel(): void;
  openSettings(): void;
}

const PHASES: readonly UpdatePhase[] = [
  'off',
  'idle',
  'checking',
  'up-to-date',
  'available',
  'downloading',
  'verifying',
  'needs-permission',
  'installing',
  'error',
  'manual',
];

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v.slice(0, 400) : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Read the shell's JSON (string or parsed); null if it isn't an update state. */
export function parseUpdateState(raw: unknown): UpdateState | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const phase = PHASES.find((p) => p === r.phase);
  if (!phase) return null;
  const url = str(r.manualUrl);
  return {
    phase,
    installed: str(r.installed) ?? '?',
    installedCode: num(r.installedCode),
    latest: str(r.latest),
    message: str(r.message),
    stage: r.stage === 'check' || r.stage === 'update' ? r.stage : null,
    // Only ever an https address (it's shown for typing into Downloader).
    manualUrl: url && /^https:\/\/[^\s]+$/.test(url) ? url : null,
    received: num(r.received),
    total: num(r.total),
  };
}

export type UpdateAction = 'update-start' | 'update-retry' | 'update-check' | 'update-cancel' | 'update-settings';

export interface UpdateButton {
  action: UpdateAction;
  label: string;
  primary?: boolean;
  quiet?: boolean;
}

export interface UpdateView {
  /** The row's main line. */
  status: string;
  /** A second line (instructions, notes), if any. */
  detail: string | null;
  /** An address to show on screen (manual reinstall). */
  url: string | null;
  buttons: UpdateButton[];
  /** 0..1 while downloading with a known size, else null. */
  progress: number | null;
  /** Work in progress that Back should cancel. */
  cancellable: boolean;
}

const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);

/** What the Options row shows for a state. */
export function describeUpdate(s: UpdateState): UpdateView {
  const installed = `Installed ${s.installed}`;
  const latest = s.latest ?? 'a new version';
  const view = (status: string, buttons: UpdateButton[] = [], detail: string | null = s.message): UpdateView => ({
    status,
    detail,
    url: null,
    buttons,
    progress: null,
    cancellable: false,
  });
  const cancel: UpdateButton = { action: 'update-cancel', label: 'Cancel' };
  switch (s.phase) {
    case 'off':
      return view(installed, [], 'Update checks are off in this build.');
    case 'idle':
    case 'checking':
      return view(`${installed} · Checking for updates…`, [], null);
    case 'up-to-date':
      return view(`${installed} · Up to date`, [{ action: 'update-check', label: 'Check again', quiet: true }]);
    case 'available':
      return view(`${installed} · Update available: ${latest}`, [{ action: 'update-start', label: 'Update', primary: true }]);
    case 'downloading': {
      const known = s.total > 0;
      const pct = known ? Math.min(100, Math.floor((100 * s.received) / s.total)) : null;
      return {
        status:
          pct !== null
            ? `Downloading ${latest}… ${pct}% (${mb(s.received)} of ${mb(s.total)} MB)`
            : `Downloading ${latest}… ${mb(s.received)} MB`,
        detail: 'Press Back to cancel.',
        url: null,
        buttons: [cancel],
        progress: known ? Math.min(1, s.received / s.total) : null,
        cancellable: true,
      };
    }
    case 'verifying':
      return { ...view(`Checking the download of ${latest}…`, [cancel], null), progress: 1, cancellable: true };
    case 'needs-permission':
      return {
        ...view(
          'Almost there: Android needs your OK once',
          [{ action: 'update-settings', label: 'Open settings', primary: true }, cancel],
          s.message ??
            'In the screen that opens, turn on DanceDance (“Allow from this source”), then press Back. The update continues by itself.',
        ),
        cancellable: true,
      };
    case 'installing':
      return {
        ...view(
          `Installing ${latest}…`,
          [cancel],
          'Choose Install on the screen Android shows. DanceDance closes while it updates; if it doesn’t open again by itself, start it from the Apps row.',
        ),
        cancellable: true,
      };
    case 'error':
      return s.stage === 'update'
        ? view(`${installed} · Update failed: ${s.message ?? 'something went wrong'}`, [{ action: 'update-start', label: 'Try again', primary: true }], null)
        : view(`${installed} · Couldn’t check (${s.message ?? 'unknown reason'})`, [{ action: 'update-retry', label: 'Retry' }], null);
    case 'manual':
      return {
        ...view(`${installed} · Update available: ${latest}`, [{ action: 'update-check', label: 'Check again', quiet: true }]),
        detail: `${s.message ?? 'This update needs a manual reinstall with Downloader from'}:`,
        url: s.manualUrl,
      };
  }
}

/** The home screen's small hint, or null when there's nothing to say. */
export function updateHint(s: UpdateState | null): string | null {
  if (!s) return null;
  if (s.phase === 'available' || s.phase === 'manual') return s.latest ? `Update available: ${s.latest}` : 'Update available';
  return null;
}
