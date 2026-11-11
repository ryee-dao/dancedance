/** The small status page the helper opens in the browser (served at GET /). */

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function statusPage(o: { version: string; siteUrl: string }): string {
  // ?helper=1 tells DanceDance this browser uses the helper (so it may look for it).
  let href = o.siteUrl;
  try {
    const u = new URL(o.siteUrl);
    u.searchParams.set('helper', '1');
    href = u.href;
  } catch { /* keep as is */ }
  const site = esc(href);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DanceDance helper</title>
<style>
  :root { color-scheme: light dark; --bg: #faf7f2; --fg: #1d1b19; --muted: #6b645c; --card: #fff; --accent: #d9480f; --ok: #2b8a3e; --bad: #c92a2a; }
  @media (prefers-color-scheme: dark) { :root { --bg: #171513; --fg: #f1ece6; --muted: #a59d94; --card: #221f1c; --accent: #ff8a4c; --ok: #69db7c; --bad: #ff8787; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 34rem; margin: 0 auto; padding: 2.5rem 1rem; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  .card { background: var(--card); border-radius: 14px; padding: 1.25rem 1.25rem 1rem; margin: 1.25rem 0; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .dot { display: inline-block; width: .7em; height: .7em; border-radius: 50%; background: var(--muted); margin-right: .4em; }
  .dot.ok { background: var(--ok); } .dot.bad { background: var(--bad); }
  a.btn, button { display: inline-block; font: inherit; font-weight: 600; border: 0; border-radius: 999px; padding: .65rem 1.3rem; cursor: pointer; text-decoration: none; }
  a.btn { background: var(--accent); color: #fff; }
  button { background: transparent; color: var(--muted); border: 1px solid currentColor; }
  .muted { color: var(--muted); font-size: .92rem; }
  ul { padding-left: 1.1rem; margin: .5rem 0 0; } li { margin: .15rem 0; }
  progress { width: 100%; }
</style>
</head>
<body>
<main>
  <h1>DanceDance helper is running</h1>
  <p>Leave this open while you dance. DanceDance uses it to find the beat of new songs on this computer.</p>
  <p><a class="btn" href="${site}" rel="noopener">Open DanceDance</a></p>
  <div class="card">
    <p id="state"><span class="dot"></span>Checking…</p>
    <progress id="prog" hidden max="1"></progress>
    <p class="muted" id="detail"></p>
    <ul id="recent" class="muted"></ul>
  </div>
  <p class="muted">If your browser asks whether DanceDance may connect to “apps on this device” or “your local network”, choose <b>Allow</b>. The helper only talks to YouTube and to DanceDance on this computer. Song audio is deleted as soon as DanceDance has found the beat.</p>
  <p class="muted">To stop the helper, close its window or press <button id="quit" type="button">Stop the helper</button></p>
  <p class="muted">Version ${esc(o.version)}</p>
</main>
<script>
const $ = (id) => document.getElementById(id);
const say = (cls, text) => { $('state').innerHTML = ''; const d = document.createElement('span'); d.className = 'dot ' + cls; $('state').append(d, text); };
const MSG = { blocked: 'YouTube asked this computer to prove it is not a bot. Try again later.', outdated: 'YouTube changed something; the helper is updating its downloader.', unavailable: 'Video not available.', network: 'Could not reach YouTube.', error: 'Download failed.' };
async function tick() {
  try {
    const s = await (await fetch('/status', { cache: 'no-store' })).json();
    if (s.state === 'ready') say('ok', 'Ready. yt-dlp ' + (s.ytdlp || '') + '.');
    else if (s.state === 'error') say('bad', s.message || 'Something went wrong getting ready.');
    else say('', 'Getting ready: downloading the YouTube downloader (first run only)…');
    $('prog').hidden = s.state !== 'preparing' || s.progress == null;
    if (s.progress != null) $('prog').value = s.progress;
    const cur = (s.current || []).map((j) => 'Getting a song' + (j.fraction != null ? ' (' + Math.round(j.fraction * 100) + '%)' : '') + '…');
    $('detail').textContent = cur.join(' ');
    $('recent').replaceChildren(...(s.recent || []).slice(0, 5).map((r) => {
      const li = document.createElement('li');
      li.textContent = new Date(r.at).toLocaleTimeString() + ' · ' + (r.ok ? 'song ready (' + Math.round(r.bytes / 1e5) / 10 + ' MB, ' + Math.round(r.ms / 100) / 10 + ' s)' : (MSG[r.code] || r.code));
      return li;
    }));
  } catch { say('bad', 'The helper has stopped. Start it again to use it.'); }
}
$('quit').onclick = async () => { try { await fetch('/quit', { method: 'POST' }); } catch {} say('bad', 'The helper has stopped. You can close this tab.'); clearInterval(timer); };
const timer = setInterval(tick, 2000); tick();
</script>
</body>
</html>`;
}
