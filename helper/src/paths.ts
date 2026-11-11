/** Tiny path helpers (no dependencies). */
export const SEP = Deno.build.os === 'windows' ? '\\' : '/';

export function join(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/[\\/]+$/, '') : p.replace(/^[\\/]+|[\\/]+$/g, '')))
    .join(SEP);
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i > 0 ? p.slice(0, i) : p;
}

/** Where the helper keeps yt-dlp, its log and nothing else. */
export function appDataDir(): string {
  const env = (k: string) => Deno.env.get(k) ?? '';
  const override = env('DANCEDANCE_HELPER_HOME');
  if (override) return override;
  const home = env('HOME') || env('USERPROFILE');
  if (Deno.build.os === 'darwin') return join(home, 'Library', 'Application Support', 'DanceDance Helper');
  if (Deno.build.os === 'windows') return join(env('LOCALAPPDATA') || join(home, 'AppData', 'Local'), 'DanceDance Helper');
  return join(env('XDG_DATA_HOME') || join(home, '.local', 'share'), 'dancedance-helper');
}
