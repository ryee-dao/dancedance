/**
 * The helper doubles as yt-dlp's JavaScript runtime.
 *
 * Current yt-dlp needs a JavaScript runtime to solve YouTube's player
 * challenges (Deno is its default). The helper *is* a Deno program, so it
 * passes itself to yt-dlp as `--js-runtimes deno:<helper>` with
 * DANCEDANCE_HELPER_ROLE=js-runtime in the environment. yt-dlp then runs:
 *
 *   <helper> --version                      -> must print "deno <version>"
 *   <helper> run [deno flags…] -            -> the solver script on stdin;
 *                                              its console.log output is the answer
 *
 * The script (yt-dlp's bundled solver plus YouTube's player code) runs in a
 * Worker with every permission denied: no network, files, subprocesses or
 * environment, like `deno run` without --allow-* flags. Anything on stderr
 * or a non-zero exit is treated by yt-dlp as a failure, as with real Deno.
 */
export const JS_RUNTIME_ENV = 'DANCEDANCE_HELPER_ROLE';

const NO_PERMISSIONS = { net: false, read: false, write: false, run: false, env: false, sys: false, ffi: false, import: false };

function toDataUrl(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:text/javascript;base64,${btoa(bin)}`;
}

const BOOT = `self.onmessage = async (e) => {
  try { await import(e.data); self.postMessage({ ok: true }); }
  catch (err) { self.postMessage({ ok: false, error: String((err && err.stack) || err) }); }
};`;

export async function runJsRuntime(args: string[]): Promise<number> {
  if (args[0] === '--version' || args[0] === '-V') {
    console.log(`deno ${Deno.version.deno}`);
    return 0;
  }
  if (args[0] !== 'run' || args.length < 2) {
    console.error('DanceDance helper: unsupported JavaScript runtime call');
    return 2;
  }
  const last = args[args.length - 1];
  const code = last === '-' ? await new Response(Deno.stdin.readable).text() : await Deno.readTextFile(last);
  const worker = new Worker(`data:text/javascript,${encodeURIComponent(BOOT)}`, {
    type: 'module',
    deno: { permissions: NO_PERMISSIONS },
  } as WorkerOptions);
  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'timed out after 60 s' }), 60_000);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    };
    worker.postMessage(toDataUrl(code));
  });
  worker.terminate();
  if (!result.ok) {
    console.error(result.error ?? 'script failed');
    return 1;
  }
  return 0;
}
