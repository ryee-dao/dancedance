/**
 * Build the helper binaries with `deno compile` (cross-compiling all targets).
 *
 *   deno task build                                  # every target, version from deno.json
 *   deno task build --target aarch64-apple-darwin    # one target
 *   deno task build --repo owner/name --version 1.2.3
 *
 * Output in helper/dist/: the raw binaries plus release archives
 * (macOS .zip and Linux .tar.gz keep the executable bit) and SHA256SUMS.txt.
 * The Pages origin and site address baked into the binary come from --repo
 * (default: GITHUB_REPOSITORY, else the committed build_info.ts).
 */
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const arg = (name: string) => {
  const i = Deno.args.indexOf(`--${name}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
};

const TARGETS = [
  { target: 'aarch64-apple-darwin', name: 'dancedance-helper-macos-arm64', archive: 'zip' },
  { target: 'x86_64-apple-darwin', name: 'dancedance-helper-macos-x64', archive: 'zip' },
  { target: 'x86_64-pc-windows-msvc', name: 'dancedance-helper-windows-x64.exe', archive: null },
  { target: 'x86_64-unknown-linux-gnu', name: 'dancedance-helper-linux-x64', archive: 'tar.gz' },
] as const;

const deno = JSON.parse(await Deno.readTextFile(`${root}deno.json`)) as { version: string };
const version = arg('version') ?? deno.version;
if (!/^[0-9A-Za-z.+-]{1,40}$/.test(version)) throw new Error(`bad version ${version}`);
const repo = arg('repo') ?? Deno.env.get('GITHUB_REPOSITORY') ?? 'ryee-dao/dancedance';
const m = /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(repo);
if (!m) throw new Error(`bad repo ${repo}`);
const owner = m[1].toLowerCase();
const name = m[2];
const pagesOrigin = `https://${owner}.github.io`;
const siteUrl = name.toLowerCase() === `${owner}.github.io` ? `${pagesOrigin}/` : `${pagesOrigin}/${name}/`;
const only = arg('target');
const targets = TARGETS.filter((t) => !only || t.target === only);
if (!targets.length) throw new Error(`unknown target ${only}`);

const infoPath = `${root}src/build_info.ts`;
const original = await Deno.readTextFile(infoPath);
const generated = `// Values baked into the helper binary. scripts/build.ts rewrites this file
// for the duration of a build (from --repo / --version) and restores it after,
// so the committed copy always describes this repository with version "dev".
export const BUILD = {
  version: ${JSON.stringify(version)},
  repo: ${JSON.stringify(repo)},
  siteUrl: ${JSON.stringify(siteUrl)},
  pagesOrigin: ${JSON.stringify(pagesOrigin)},
} as const;
`;

async function run(cmd: string, args: string[], cwd = root): Promise<void> {
  const r = await new Deno.Command(cmd, { args, cwd, stdout: 'inherit', stderr: 'inherit' }).output();
  if (!r.success) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

const dist = `${root}dist/`;
await Deno.mkdir(dist, { recursive: true });
await Deno.writeTextFile(infoPath, generated);
const assets: string[] = [];
try {
  for (const t of targets) {
    const exe = t.name;
    console.log(`building ${t.target} -> dist/${exe} (version ${version}, site ${siteUrl})`);
    await run(Deno.execPath(), [
      'compile', '--quiet', '--no-check=remote',
      '--allow-net', '--allow-read', '--allow-write', '--allow-run', '--allow-env', '--allow-sys',
      '--unstable-worker-options',
      '--target', t.target,
      '--output', `${dist}${exe}`,
      `${root}src/main.ts`,
    ]);
    if (t.archive === 'zip') {
      // The archive holds one file named "DanceDance Helper" (double-clickable; opens in Terminal).
      const stage = `${dist}stage-${t.target}/`;
      await Deno.mkdir(stage, { recursive: true });
      await Deno.copyFile(`${dist}${exe}`, `${stage}DanceDance Helper`);
      await Deno.chmod(`${stage}DanceDance Helper`, 0o755);
      await Deno.remove(`${dist}${t.name}.zip`).catch(() => {});
      await run('zip', ['-q', '-X', `${dist}${t.name}.zip`, 'DanceDance Helper'], stage);
      await Deno.remove(stage, { recursive: true });
      assets.push(`${t.name}.zip`);
    } else if (t.archive === 'tar.gz') {
      const stage = `${dist}stage-${t.target}/`;
      await Deno.mkdir(stage, { recursive: true });
      await Deno.copyFile(`${dist}${exe}`, `${stage}dancedance-helper`);
      await Deno.chmod(`${stage}dancedance-helper`, 0o755);
      await run('tar', ['-czf', `${dist}${t.name}.tar.gz`, 'dancedance-helper'], stage);
      await Deno.remove(stage, { recursive: true });
      assets.push(`${t.name}.tar.gz`);
    } else {
      assets.push(exe);
    }
  }
} finally {
  await Deno.writeTextFile(infoPath, original);
}

const lines: string[] = [];
for (const a of assets) {
  const bytes = await Deno.readFile(`${dist}${a}`);
  const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  lines.push(`${hex}  ${a}`);
  console.log(`${a}: ${(bytes.byteLength / 1e6).toFixed(1)} MB`);
}
await Deno.writeTextFile(`${dist}SHA256SUMS.txt`, lines.join('\n') + '\n');
await Deno.writeTextFile(`${dist}assets.txt`, assets.join('\n') + '\n');
console.log('wrote dist/SHA256SUMS.txt');
