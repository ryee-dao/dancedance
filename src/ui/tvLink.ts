/**
 * Android TV: link a playlist from your phone (no typing on the TV, ever).
 *
 * The shell runs a tiny web server on the local network only while this
 * screen is open; the QR code points at its one page (random-token URL).
 * When the phone submits, the shell has already checked the playlist; this
 * screen reads it, saves the link and goes home.
 *
 * Also hosts the diagnostics panel (versions, frame times, analysis time,
 * cloud status) that the user reads off the projector.
 */

import {
  tvBridge,
  tvState,
  type LinkServerInfo,
  type NativeDiagnostics,
} from '../platform/androidtv';
import { getPlatform } from '../platform/platform';
import { h, type Nav, type Screen } from './dom';
import { ensureFocus, type Scope } from './focusNav';
import { library } from './library';
import { toast } from './toast';

const CSS = `
.tvlink { display:grid; place-items:center; min-height:100vh; padding:2rem var(--gutter); }
.tvlink-panel { width:min(72rem,100%); display:grid; grid-template-columns:auto 1fr; gap:2.5rem; align-items:center;
  padding:2.2rem 2.4rem; border:2px solid var(--line); border-radius:1.4rem; background:var(--bg-2); }
.tvlink-qr { display:flex; flex-direction:column; align-items:center; gap:.8rem; }
.tvlink-qr img, .tvlink-qr .tvlink-qr-ph { width:min(22rem,38vh); height:min(22rem,38vh); border-radius:1rem; background:#fff; display:block; }
.tvlink-qr .tvlink-qr-ph { background:var(--surface); }
.tvlink-url { font-size:1rem; font-weight:700; letter-spacing:.01em; color:var(--accent-2); word-break:break-all; text-align:center; max-width:min(22rem,38vh); margin:0; }
.tvlink .form-row { flex-wrap:nowrap; }
.tvlink-lead { margin:0 0 .6rem; font-size:1.3rem; }
.tvlink-steps { margin:0 0 1rem; padding-left:1.6rem; font-size:1.3rem; }
.tvlink-steps li + li { margin-top:.45rem; }
.tvlink-status { min-height:1.6em; margin:1rem 0 1.4rem; font-size:1.2rem; font-weight:700; color:var(--accent-2); }
.tvlink-status[data-kind='error'] { color:var(--warn); }
.tvdiag { width:min(64rem,100%); padding:1.4rem 2.2rem; border:2px solid var(--line); border-radius:1.4rem; background:var(--bg-2); }
.tvdiag-head { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:.8rem; }
.tvdiag-head .panel-title { margin:0; font-size:1.6rem; }
.tvdiag dl { display:grid; grid-template-columns:max-content 1fr; gap:.1rem 1.4rem; margin:0 0 .8rem; font-size:.92rem; }
.tvdiag dt { color:var(--muted); }
.tvdiag dd { margin:0; font-weight:700; font-variant-numeric:tabular-nums; }
.tvdiag .note { margin:0; font-size:.85rem; }
.tvdiag dd[data-kind='bad'] { color:var(--warn); }
.tvdiag dd[data-kind='good'] { color:var(--accent-2); }
`;

let cssInjected = false;
function injectCss(): void {
  if (cssInjected) return;
  cssInjected = true;
  document.head.appendChild(h('style', { 'data-owner': 'tvLink' }, CSS));
}

export function createTvLink(nav: Nav): Screen {
  injectCss();
  const b = tvBridge();
  const linked = library.link();
  let alive = true;
  let view: 'link' | 'diag' = 'link';
  const offs: (() => void)[] = [];

  const qrBox = h('div', { class: 'tvlink-qr' }, h('div', { class: 'tvlink-qr-ph', 'aria-hidden': 'true' }), h('p', { class: 'tvlink-url' }, 'Starting…'));
  const status = h('p', { class: 'tvlink-status', role: 'status', 'aria-live': 'polite' });
  const buttons = h(
    'div',
    { class: 'form-row' },
    h('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'home' }, linked ? 'Back to songs' : 'Skip for now'),
    h('button', { class: 'btn', type: 'button', 'data-action': 'diag' }, 'Diagnostics'),
    linked && h('button', { class: 'btn btn-quiet', type: 'button', 'data-action': 'unlink' }, 'Unlink playlist'),
  );
  const linkPanel = h(
    'div',
    { class: 'tvlink-panel' },
    qrBox,
    h(
      'div',
      {},
      h('h1', { class: 'panel-title' }, 'Use your phone'),
      h('p', { class: 'tvlink-lead' }, 'Scan the code with your phone. The page that opens lets you:'),
      h(
        'ul',
        { class: 'tvlink-steps' },
        h('li', {}, h('b', {}, linked ? 'Change your playlist' : 'Link your playlist'), ': paste a YouTube playlist link.'),
        h('li', {}, h('b', {}, 'Find a song'), ': search for any song and add it to My added songs.'),
      ),
      h(
        'p',
        { class: 'note' },
        'Your phone must be on the same Wi-Fi as the projector. Playlists must be Public or Unlisted. Nothing to type on the TV.',
      ),
      status,
      buttons,
    ),
  );
  const diagPanel = h('div', { class: 'tvdiag', hidden: true });
  const el = h('main', { class: 'screen tvlink' }, linkPanel, diagPanel);

  function setStatus(text: string, kind: 'info' | 'error' = 'info'): void {
    status.textContent = text;
    status.dataset.kind = kind;
  }

  // --- link server ------------------------------------------------------------

  async function startServer(): Promise<void> {
    if (!b) {
      setStatus('Linking from a phone needs the DanceDance TV app.', 'error');
      return;
    }
    setStatus('Starting…');
    try {
      const info = await b.call<LinkServerInfo>('startLinkServer');
      if (!alive) {
        b.native.stopLinkServer();
        return;
      }
      qrBox.replaceChildren(
        h('img', { src: info.qrDataUrl, alt: 'QR code for the link page' }),
        h('p', { class: 'tvlink-url' }, info.url),
      );
      setStatus('Waiting for your phone…');
    } catch (err) {
      if (!alive) return;
      qrBox.replaceChildren(h('div', { class: 'tvlink-qr-ph', 'aria-hidden': 'true' }));
      setStatus(err instanceof Error ? err.message : String(err), 'error');
      if (!buttons.querySelector('[data-action="retry"]')) {
        buttons.prepend(h('button', { class: 'btn', type: 'button', 'data-action': 'retry' }, 'Try again'));
      }
    }
  }

  if (b) {
    offs.push(
      b.on('linkVisited', () => {
        if (alive) setStatus('Phone connected. Link a playlist or find a song on it.');
      }),
      b.on('addedSongsChanged', ({ added }) => {
        if (alive && added) setStatus(`Added “${added.title}”. Add another, or go back to your songs.`);
      }),
      b.on('linkSubmitted', (d) => {
        if (!alive) return;
        setStatus(`Got it! Reading your playlist (${d.songCount} songs)…`);
        void getPlatform()
          .getPlaylist(d.listId)
          .then(
            (entries) => {
              if (!alive) return;
              library.setLink({ input: d.input, listId: d.listId }, entries);
              toast(`Playlist linked: ${entries.length} songs.`);
              nav.home();
            },
            (err: unknown) => {
              if (alive) setStatus(err instanceof Error ? err.message : String(err), 'error');
            },
          );
      }),
      // The shell stops the server when the app goes to the background; restart it on return.
      b.on('lifecycle', ({ state }) => {
        if (alive && state === 'resume' && view === 'link') void startServer();
      }),
    );
  }

  // --- diagnostics --------------------------------------------------------------

  let diagTimer: ReturnType<typeof setInterval> | null = null;

  function showDiag(): void {
    view = 'diag';
    linkPanel.hidden = true;
    diagPanel.hidden = false;
    renderDiag();
    diagTimer = setInterval(renderDiag, 2000);
    ensureFocus(true);
  }

  function showLink(): void {
    view = 'link';
    if (diagTimer !== null) clearInterval(diagTimer);
    diagTimer = null;
    diagPanel.hidden = true;
    linkPanel.hidden = false;
    ensureFocus(true);
  }

  function renderDiag(): void {
    const native = b ? b.json<NativeDiagnostics>(b.native.getDiagnostics()) : null;
    const f = tvState.frames;
    const a = tvState.lastAnalysis;
    const cloud = tvState.cloud;
    const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
    const rows: [string, string, ('good' | 'bad')?][] = [
      ['App', native ? `${native.appVersion} (${native.versionCode}, ${native.buildType})` : 'unknown'],
      ['NewPipe Extractor', native?.newPipeVersion ?? 'unknown'],
      ['Device', native ? `${native.device} · Android ${native.android}` : 'unknown'],
      ['WebView', native?.webView ?? 'unknown'],
      ['CPU cores / heap', native ? `${native.cpuCores} / ${native.maxHeapMb} MB` : 'unknown'],
      [
        tvState.framesLive ? 'Frame time (now)' : 'Frame time (last song)',
        f ? `${f.avgMs} ms avg = ${f.fps} fps · 95% under ${f.p95Ms} ms · ${f.longFrames} long frames` : 'Play a song first',
        f ? (f.fps >= 50 ? 'good' : f.fps < 30 ? 'bad' : undefined) : undefined,
      ],
      [
        'Last beat analysis',
        a
          ? `${(a.firstMs / 1000).toFixed(1)} s${a.partial ? ` for the first 30 s, ${a.fullMs !== null ? `${(a.fullMs / 1000).toFixed(1)} s` : 'still running'} for all` : ''} · ${Math.round(a.songSeconds)} s song`
          : 'None yet this session',
        a ? (a.firstMs <= 15000 ? 'good' : 'bad') : undefined,
      ],
      ['Last download', native?.lastDownload ?? 'None yet this session'],
      ['Song cache', native ? `${mb(native.cacheBytes)} of ${mb(native.cacheCapBytes)} · ${native.cacheFiles} songs` : 'unknown'],
      ['Cloud beat maps', native?.pagesBaseUrl ?? 'Off in this build'],
      [
        'Cloud trigger',
        !native?.cloudRepo
          ? 'Off in this build'
          : `${native.cloudRepo} · token ${native.hasGithubToken ? `saved (${native.tokenStorage})` : 'not linked'}`,
      ],
      ['This session', cloud ? describeCloud(cloud) : 'Not checked yet'],
      [
        'Last trigger',
        native?.lastCloudTrigger
          ? `${new Date(native.lastCloudTrigger.at).toLocaleString()}: ${native.lastCloudTrigger.status}${'message' in native.lastCloudTrigger ? ` (${native.lastCloudTrigger.message})` : ''}`
          : 'Never',
        native?.lastCloudTrigger?.status === 'failed' ? 'bad' : undefined,
      ],
    ];
    const focusedAction = (document.activeElement as HTMLElement | null)?.dataset?.action;
    diagPanel.replaceChildren(
      h(
        'div',
        { class: 'tvdiag-head' },
        h('h1', { class: 'panel-title' }, 'Diagnostics'),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'diag-back' }, 'Back'),
      ),
      h(
        'dl',
        {},
        ...rows.flatMap(([k, v, kind]) => [h('dt', {}, k), h('dd', kind ? { 'data-kind': kind } : {}, v)]),
      ),
      h(
        'p',
        { class: 'note' },
        'Frame time: under 20 ms (50+ fps) is smooth; above 33 ms (under 30 fps) the coach will look choppy. Analysis: under 15 s is the target.',
      ),
    );
    if (focusedAction === 'diag-back') diagPanel.querySelector<HTMLElement>('[data-action="diag-back"]')?.focus();
  }

  // --- events -----------------------------------------------------------------------

  el.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    switch (action) {
      case 'home':
        nav.home({ focusAction: 'link' });
        break;
      case 'unlink':
        b?.native.unlinkPlaylist();
        library.unlink();
        toast('Playlist unlinked.');
        nav.home({ focusAction: 'link' });
        break;
      case 'retry':
        (e.target as HTMLElement).closest('button')?.remove();
        void startServer();
        break;
      case 'diag':
        showDiag();
        break;
      case 'diag-back':
        showLink();
        break;
    }
  });

  const scope: Scope = {
    root: el,
    onBack: () => (view === 'diag' ? showLink() : nav.home({ focusAction: 'link' })),
    defaultFocus: () =>
      view === 'diag'
        ? diagPanel.querySelector<HTMLElement>('[data-action="diag-back"]')
        : linkPanel.querySelector<HTMLElement>('[data-action="home"]'),
  };

  void startServer();

  return {
    el,
    scope,
    destroy() {
      alive = false;
      for (const off of offs) off();
      if (diagTimer !== null) clearInterval(diagTimer);
      b?.native.stopLinkServer();
    },
  };
}

function describeCloud(c: NonNullable<typeof tvState.cloud>): string {
  const r = c.result;
  switch (r.status) {
    case 'skipped':
      return r.reason;
    case 'started':
      return `Asked the cloud to analyse ${c.missing} new song${c.missing === 1 ? '' : 's'}.`;
    case 'rate-limited':
      return `${c.missing} new songs; asked recently, next try in ${Math.ceil(r.retryAfterSec / 60)} min.`;
    case 'not-needed':
      return 'Every playlist song already has a cloud map (or a known cloud failure).';
    case 'no-token':
      return 'No GitHub token linked.';
    case 'not-configured':
      return 'Off in this build.';
    case 'failed':
      return `Failed: ${r.message}`;
  }
}
