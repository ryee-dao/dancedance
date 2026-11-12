/**
 * Options: the coach's look (live preview cards) and which version of it
 * dances (female / male; two players get both), routine (same / new each
 * play), audio offset, beat-sync
 * fallback (web), links to playlist linking and the GitHub connection, and
 * on the TV the app update row. Everything applies as soon as it is chosen.
 */

import { formatOffset, stepOffset } from '../beat/audioOffset';
import { findMove } from '../core/choreo/moves';
import { PoseEvaluator } from '../core/coach/animator';
import { loopPlan, type LoopPlan } from '../core/coach/loop';
import { FigurePainter } from '../core/coach/renderer';
import { createPose, createSkeleton, solveSkeleton } from '../core/coach/skeleton';
import { COACH_BUILDS, COACH_STYLES, type CoachBuild, type CoachStyle } from '../core/coach/styles';
import { repoFromLocation } from '../platform/github';
import { backgroundFill, describeFill } from '../beat/helperFill';
import { helperDownloadUrl, setHelperOptIn, type HelperClient } from '../platform/helper';
import { getPlatform } from '../platform/platform';
import { describeUpdate, type UpdateAction, type UpdateState } from '../platform/appUpdate';
import type { GraphicsPref } from '../core/coach/quality';
import { store, type LiveSyncPref, type RoutineMode } from '../store';
import { h, type Nav, type Screen } from './dom';
import { focusEl, type Scope } from './focusNav';
import { connectionLabel, disconnectGithub, githubConnection, openConnectDialog } from './githubConnect';
import { library } from './library';
import { toast } from './toast';

const PREVIEW_MOVE = 'step-clap';
const PREVIEW_BPM = 112;

const LIVE_SYNC: { value: LiveSyncPref; label: string; hint: string }[] = [
  { value: 'ask', label: 'Ask first', hint: 'Explain, then ask to use the microphone' },
  { value: 'mic', label: 'Microphone', hint: 'Listen straight away' },
  { value: 'off', label: 'Off', hint: 'No live listening' },
];

const GRAPHICS: { value: GraphicsPref; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Adapts to this device' },
  { value: 'smooth', label: 'Smooth (simpler)', hint: 'Pre-drawn coach, steadier on slow TVs' },
  { value: 'full', label: 'Full', hint: 'Every effect, always' },
];

const FPS: { value: boolean; label: string; hint: string }[] = [
  { value: false, label: 'Off', hint: 'Nothing extra on screen' },
  { value: true, label: 'On', hint: 'Frame rate and graphics level in a corner' },
];

const ROUTINE: { value: RoutineMode; label: string; hint: string }[] = [
  { value: 'same', label: 'Same every time', hint: 'Learn a song’s routine by heart' },
  { value: 'fresh', label: 'New every time', hint: 'A different routine each play' },
];

export function createOptions(nav: Nav, opts: { focusAction?: string } = {}): Screen {
  const platform = getPlatform();
  const urlStyle = new URLSearchParams(location.search).get('coach');

  // --- coach look ------------------------------------------------------------
  const cards = COACH_STYLES.map((info) =>
    h(
      'button',
      { class: 'style-card', type: 'button', 'data-style': info.id, 'aria-pressed': 'false' },
      h('canvas', { class: 'style-preview', width: 320, height: 300, 'aria-hidden': 'true' }),
      h(
        'span',
        { class: 'style-text' },
        h('span', { class: 'style-name' }, info.name, h('span', { class: 'style-check', 'aria-hidden': 'true' }, '✓ In use')),
        h('span', { class: 'style-blurb' }, info.description),
      ),
    ),
  );
  // --- which version dances (single player; two players dance as the pair) ----
  const buildButtons = COACH_BUILDS.map((b) =>
    h(
      'button',
      { class: 'btn choice-btn', type: 'button', 'data-build': b.id, 'aria-pressed': 'false' },
      h('span', { class: 'choice-name' }, b.name),
      h('span', { class: 'choice-hint' }, b.description),
    ),
  );
  const styleNote = urlStyle
    ? h('p', { class: 'note' }, `This page’s address sets the coach with ?coach=${urlStyle}, which wins over the choice here.`)
    : null;

  // --- audio offset ------------------------------------------------------------
  const offsetValue = h('span', { class: 'offset-value', 'aria-live': 'polite' });
  const offsetRow = h(
    'div',
    { class: 'opt-row' },
    h('button', { class: 'btn', type: 'button', 'data-action': 'offset-down', 'aria-label': 'Earlier by 10 milliseconds' }, '−10 ms'),
    offsetValue,
    h('button', { class: 'btn', type: 'button', 'data-action': 'offset-up', 'aria-label': 'Later by 10 milliseconds' }, '+10 ms'),
    h('button', { class: 'btn btn-quiet btn-small', type: 'button', 'data-action': 'offset-reset' }, 'Reset'),
  );

  // --- live sync (web) ---------------------------------------------------------
  const syncButtons = LIVE_SYNC.map((o) =>
    h(
      'button',
      { class: 'btn choice-btn', type: 'button', 'data-sync': o.value, 'aria-pressed': 'false' },
      h('span', { class: 'choice-name' }, o.label),
      h('span', { class: 'choice-hint' }, o.hint),
    ),
  );

  // --- helper app (web) ----------------------------------------------------------
  const helper = platform.localHelper as HelperClient | undefined;
  const helperStatus = h('span', { class: 'opt-status', 'aria-live': 'polite' });
  const fillNote = h('p', { class: 'note', hidden: true });
  const fill = backgroundFill();
  const helperSection =
    !!helper &&
    !platform.isTV &&
    h(
      'section',
      { class: 'opt-section' },
      h('h2', { class: 'opt-title' }, 'Helper app'),
      h('p', { class: 'note' }, 'A small free app for your computer. While it runs, songs without a beat map are downloaded on this computer so the beat is found automatically, without the microphone.'),
      h(
        'div',
        { class: 'opt-row' },
        helperStatus,
        h('a', { class: 'btn btn-small', href: helperDownloadUrl(repoFromLocation(location)), target: '_blank', rel: 'noopener', 'data-action': 'helper-get' }, 'Get the helper'),
        h('button', { class: 'btn btn-small btn-quiet', type: 'button', 'data-action': 'helper-check' }, 'Check again'),
      ),
      fillNote,
      h(
        'details',
        { class: 'note' },
        h('summary', {}, 'First-time steps'),
        h('p', {}, 'Mac: download the macOS file (Apple chip = arm64, Intel = x64) and open the zip. Double-click “DanceDance Helper”. If macOS says it can’t check the app, open System Settings → Privacy & Security, scroll down and click “Open Anyway”, then open it again.'),
        h('p', {}, 'Windows: download the .exe and open it. If Windows says it protected your PC, click “More info” → “Run anyway”.'),
        h('p', {}, 'A window and a status page open: leave them open while you dance. If your browser asks whether this site may connect to apps on this device, choose Allow.'),
      ),
    );
  function renderHelper(): void {
    if (!helper) return;
    const info = helper.info();
    helperStatus.textContent = !helper.checked()
      ? 'Not checked yet'
      : !info
        ? 'Not running'
        : info.ready
          ? `Running (version ${info.version})`
          : info.state === 'error'
            ? 'Running, but it couldn’t get ready (see its window)'
            : 'Running · getting ready…';
    const line = info && fill ? describeFill(fill.state()) : null;
    fillNote.hidden = !line;
    fillNote.textContent = line ?? '';
  }
  const onHelperChange = () => renderHelper();
  helper?.addEventListener('change', onHelperChange);
  fill?.addEventListener('change', onHelperChange);

  // --- routine -------------------------------------------------------------------
  const routineButtons = ROUTINE.map((o) =>
    h(
      'button',
      { class: 'btn choice-btn', type: 'button', 'data-routine': o.value, 'aria-pressed': 'false' },
      h('span', { class: 'choice-name' }, o.label),
      h('span', { class: 'choice-hint' }, o.hint),
    ),
  );

  // --- graphics --------------------------------------------------------------------
  const gfxButtons = GRAPHICS.map((o) =>
    h(
      'button',
      { class: 'btn choice-btn', type: 'button', 'data-gfx': o.value, 'aria-pressed': 'false' },
      h('span', { class: 'choice-name' }, o.label),
      h('span', { class: 'choice-hint' }, o.hint),
    ),
  );
  const fpsButtons = FPS.map((o) =>
    h(
      'button',
      { class: 'btn choice-btn', type: 'button', 'data-fps': String(o.value), 'aria-pressed': 'false' },
      h('span', { class: 'choice-name' }, o.label),
      h('span', { class: 'choice-hint' }, o.hint),
    ),
  );

  // --- app update (TV, shell bridge v5+) ---------------------------------------
  const updates = platform.isTV ? platform.appUpdates : undefined;
  const updStatus = h('span', { class: 'opt-status update-status', 'aria-live': 'polite' });
  const updButtons = h('span', { class: 'update-buttons' });
  const updRow = h('div', { class: 'opt-row update-row' }, updStatus, updButtons);
  const updBar = h('div', { class: 'update-bar', hidden: true }, h('div', { class: 'update-bar-fill' }));
  const updDetail = h('p', { class: 'note update-detail', hidden: true });
  const updUrl = h('p', { class: 'update-url', hidden: true });
  const updSection = h(
    'section',
    { class: 'opt-section', 'data-section': 'update' },
    h('h2', { class: 'opt-title' }, 'App update'),
    h('p', { class: 'note' }, 'New versions come from DanceDance’s releases on GitHub. Your playlist and settings stay.'),
    updRow,
    updBar,
    updDetail,
    updUrl,
  );
  /** Keep the whole row in view (its note and the Downloader address sit under the buttons). */
  const revealUpdate = () => {
    if (updRow.contains(document.activeElement)) updSection.scrollIntoView({ block: 'nearest' });
  };
  let updKey = '';
  function renderUpdate(s: UpdateState): void {
    const v = describeUpdate(s);
    updStatus.textContent = v.status;
    updDetail.hidden = !v.detail;
    updDetail.textContent = v.detail ?? '';
    updUrl.hidden = !v.url;
    updUrl.textContent = v.url ?? '';
    updBar.hidden = v.progress === null;
    (updBar.firstElementChild as HTMLElement).style.width = `${Math.round((v.progress ?? 0) * 100)}%`;
    // Rebuild the buttons only when they change (progress ticks keep the focused one as it is).
    const key = v.buttons.map((b) => `${b.action}:${b.label}`).join('|');
    if (key === updKey) {
      revealUpdate();
      return;
    }
    updKey = key;
    const active = document.activeElement as HTMLElement | null;
    const hadFocus = !!active && updRow.contains(active);
    const was = active?.dataset.action;
    updButtons.replaceChildren(
      ...v.buttons.map((b) =>
        h(
          'button',
          { class: `btn btn-small${b.primary ? ' btn-primary' : ''}${b.quiet ? ' btn-quiet' : ''}`, type: 'button', 'data-action': b.action },
          b.label,
        ),
      ),
    );
    // With no button (checking), the status line holds focus so it doesn't jump to the top.
    if (v.buttons.length) updStatus.removeAttribute('data-focusable');
    else updStatus.setAttribute('data-focusable', '');
    updStatus.tabIndex = v.buttons.length ? -1 : 0;
    if (hadFocus) focusEl(updateFocusTarget(was), { instant: true });
    revealUpdate();
  }
  /** The next step (primary button) first, else the button that had focus, else the first one. */
  function updateFocusTarget(prefer?: string): HTMLElement {
    return (
      updButtons.querySelector<HTMLElement>('.btn-primary') ||
      (prefer && updButtons.querySelector<HTMLElement>(`[data-action="${prefer}"]`)) ||
      updButtons.querySelector<HTMLElement>('button') ||
      updStatus
    );
  }
  const offUpdate = updates?.onChange(renderUpdate);
  if (updates) {
    renderUpdate(updates.state());
    updates.check(false); // at most once per app start; then the cached result
  }
  const updateSection = !!updates && updSection;
  updRow.addEventListener('focusin', () => requestAnimationFrame(revealUpdate));
  const updateBusy = () => !!updates && describeUpdate(updates.state()).cancellable;

  // --- links -------------------------------------------------------------------
  const ghLine = h('div', { class: 'opt-row' });

  const section = (title: string, ...children: (Node | null | false)[]) =>
    h('section', { class: 'opt-section' }, h('h2', { class: 'opt-title' }, title), ...children);

  const el = h(
    'main',
    { class: 'screen options-screen' },
    h(
      'header',
      { class: 'add-header' },
      h('button', { class: 'btn btn-small', type: 'button', 'data-action': 'back' }, '← Back'),
      h('h1', { class: 'panel-title add-title' }, 'Options'),
    ),
    section(
      'Coach',
      h('div', { class: 'style-grid' }, ...cards),
      styleNote,
      h('p', { class: 'note build-note' }, 'Who dances in single player. With two players, both dance together: player 1 is this one, player 2 the other.'),
      h('div', { class: 'opt-row' }, ...buildButtons),
    ),
    section(
      'Routine',
      h('p', { class: 'note' }, 'Whether the coach dances the same moves each time you play a song, or makes up a new routine.'),
      h('div', { class: 'opt-row' }, ...routineButtons),
    ),
    section(
      'Audio offset',
      h('p', { class: 'note' }, 'If the coach looks early or late, which is common with Bluetooth speakers because they add a delay, nudge this. Positive makes the coach move later. You can also press Left or Right during a song.'),
      offsetRow,
    ),
    section(
      'Graphics',
      h(
        'p',
        { class: 'note' },
        platform.isTV
          ? 'How the coach is drawn. Auto starts with the simpler drawing on the TV: still glows behind the coach, and the coach put together from pre-drawn pieces, which slow TV chips draw much faster. If the projector still can’t keep up it lowers the resolution. Full draws every effect fresh each frame but can look choppy on a projector.'
          : 'How the coach is drawn. Auto shows every effect and switches to the simpler drawing (still glows, the coach put together from pre-drawn pieces, then a lower resolution) only if this device can’t keep up.',
      ),
      h('div', { class: 'opt-row' }, ...gfxButtons),
      h('p', { class: 'note opt-subnote' }, 'Show the frame rate on the play screen:'),
      h('div', { class: 'opt-row' }, ...fpsButtons),
      !!nav.diagnostics &&
        h(
          'div',
          { class: 'opt-row opt-subrow' },
          h('button', { class: 'btn', type: 'button', 'data-action': 'diag' }, 'Diagnostics'),
          h('span', { class: 'opt-status' }, 'Versions, frame times, beat analysis and cloud status.'),
        ),
    ),
    platform.liveSync &&
      section(
        'Songs without a beat map',
        h('p', { class: 'note' }, 'How the app finds the beat for songs the cloud hasn’t analysed yet.'),
        h('div', { class: 'opt-row' }, ...syncButtons),
      ),
    helperSection,
    section(
      'Songs',
      h(
        'div',
        { class: 'opt-row' },
        h('button', { class: 'btn', type: 'button', 'data-action': 'link' }, library.link() ? 'Change playlist' : 'Link playlist'),
      ),
      !platform.isTV && ghLine,
    ),
    updateSection,
  );

  function renderState(): void {
    const s = store.settings();
    for (const c of cards) {
      const on = c.dataset.style === s.coachStyle;
      c.classList.toggle('selected', on);
      c.setAttribute('aria-pressed', String(on));
    }
    for (const b of buildButtons) {
      const on = b.dataset.build === s.coachBuild;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    offsetValue.textContent = formatOffset(s.audioOffsetMs);
    for (const b of syncButtons) {
      const on = b.dataset.sync === s.liveSync;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const b of gfxButtons) {
      const on = b.dataset.gfx === s.graphics;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const b of fpsButtons) {
      const on = b.dataset.fps === String(s.showFps);
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const b of routineButtons) {
      const on = b.dataset.routine === s.routineMode;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    const c = githubConnection();
    const label = connectionLabel(c);
    ghLine.replaceChildren(
      ...(label
        ? [
            h('span', { class: 'opt-status' }, label),
            c.relaySource === 'build'
              ? h('button', { class: 'btn btn-small', type: 'button', 'data-action': 'gh-pass' }, 'Relay passphrase')
              : h('button', { class: 'btn btn-small', type: 'button', 'data-action': 'gh-disconnect' }, 'Disconnect'),
          ]
        : [
            h('button', { class: 'btn', type: 'button', 'data-action': 'gh-connect' }, 'Connect to GitHub'),
            h('span', { class: 'opt-status' }, 'Needed to add songs by search.'),
          ]),
    );
  }

  el.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-action="helper-get"]');
    if (a) setHelperOptIn(true); // the browser may now ask about apps on this device: that's expected
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || !el.contains(t) || t.closest('.picker-backdrop')) return;
    if (t.dataset.style) {
      store.updateSettings({ coachStyle: t.dataset.style as CoachStyle });
      renderState();
      return;
    }
    if (t.dataset.build) {
      store.updateSettings({ coachBuild: t.dataset.build as CoachBuild });
      renderState();
      if (!raf) raf = requestAnimationFrame(draw); // a still preview (reduced motion) redraws once
      return;
    }
    if (t.dataset.sync) {
      store.updateSettings({ liveSync: t.dataset.sync as LiveSyncPref });
      renderState();
      return;
    }
    if (t.dataset.gfx) {
      store.updateSettings({ graphics: t.dataset.gfx as GraphicsPref });
      renderState();
      return;
    }
    if (t.dataset.fps) {
      store.updateSettings({ showFps: t.dataset.fps === 'true' });
      renderState();
      return;
    }
    if (t.dataset.routine) {
      store.updateSettings({ routineMode: t.dataset.routine as RoutineMode });
      renderState();
      return;
    }
    if (updates && t.dataset.action?.startsWith('update-')) {
      switch (t.dataset.action as UpdateAction) {
        case 'update-start':
          updates.start();
          break;
        case 'update-retry':
        case 'update-check':
          updates.check(true);
          break;
        case 'update-cancel':
          updates.cancel();
          break;
        case 'update-settings':
          updates.openSettings();
          break;
      }
      return;
    }
    const off = store.settings().audioOffsetMs;
    switch (t.dataset.action) {
      case 'back':
        nav.home({ focusAction: 'options' });
        break;
      case 'offset-down':
        store.updateSettings({ audioOffsetMs: stepOffset(off, -1) });
        break;
      case 'offset-up':
        store.updateSettings({ audioOffsetMs: stepOffset(off, 1) });
        break;
      case 'offset-reset':
        store.updateSettings({ audioOffsetMs: 0 });
        break;
      case 'link':
        nav.link();
        return;
      case 'diag':
        nav.diagnostics?.();
        return;
      case 'helper-check':
        setHelperOptIn(true);
        helperStatus.textContent = 'Checking…';
        void helper?.detect({ force: true }).then(renderHelper);
        return;
      case 'gh-pass':
        openConnectDialog({ parent: el, returnFocus: t, mode: 'passphrase', onConnected: () => toast('Passphrase saved in this browser.') });
        return;
      case 'gh-connect':
        openConnectDialog({
          parent: el,
          returnFocus: t,
          onConnected: () => {
            renderState();
            toast('Connected. You can now add songs by search.');
            const d = ghLine.querySelector<HTMLElement>('[data-action="gh-disconnect"]');
            if (d) focusEl(d, { instant: true });
          },
        });
        return;
      case 'gh-disconnect': {
        disconnectGithub();
        renderState();
        toast('Disconnected. The token was removed from this browser. You can also delete it on GitHub.', 6000);
        const b = ghLine.querySelector<HTMLElement>('[data-action="gh-connect"]');
        if (b) focusEl(b, { instant: true });
        return;
      }
    }
    renderState();
  });

  // --- live previews -------------------------------------------------------------
  const move = findMove(PREVIEW_MOVE);
  const plan: LoopPlan | null = move ? loopPlan(move, 60 / PREVIEW_BPM) : null;
  const previews = cards.map((card) => {
    const canvas = card.querySelector('canvas')!;
    const painter = new FigurePainter();
    painter.style = card.dataset.style as CoachStyle;
    return { canvas, ctx: canvas.getContext('2d'), painter, ev: new PoseEvaluator(), pose: createPose(), sk: createSkeleton() };
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let frame = 0;
  const t0 = performance.now();
  const draw = () => {
    raf = 0;
    if (!plan) return;
    frame++;
    // Four small figures: every other frame on the TV is plenty.
    if (!platform.isTV || frame % 2 === 0 || reduced) {
      const t = reduced ? plan.period * 0.5 : (performance.now() - t0) / 1000;
      const loopSec = plan.loopBeats * plan.period;
      const lt = ((t % loopSec) + loopSec) % loopSec;
      const build = store.settings().coachBuild;
      for (const p of previews) {
        p.painter.build = build;
        if (!p.ctx) continue;
        const { width: w, height: hh } = p.canvas;
        p.ctx.clearRect(0, 0, w, hh);
        p.ev.evaluate(plan, lt, p.pose);
        solveSkeleton(p.pose, p.sk);
        p.painter.draw(p.ctx, p.sk, w / 2, hh * 0.93, hh * 0.62, t, { shadow: true });
      }
    }
    if (!reduced) raf = requestAnimationFrame(draw);
  };

  renderState();
  renderHelper();
  if (helper && !helper.checked()) void helper.detect().then(renderHelper);

  const scope: Scope = {
    root: el,
    // Back while an update downloads (or waits) cancels it and stays here.
    onBack: () => {
      if (updateBusy()) {
        updates?.cancel();
        return;
      }
      nav.home({ focusAction: 'options' });
    },
    defaultFocus: () =>
      (opts.focusAction === 'update' && updateSection ? updateFocusTarget() : null) ||
      (opts.focusAction && el.querySelector<HTMLElement>(`[data-action="${opts.focusAction}"]`)) ||
      cards.find((c) => c.classList.contains('selected')) ||
      cards[0],
  };

  return {
    el,
    scope,
    mounted() {
      raf = requestAnimationFrame(draw);
    },
    destroy() {
      offUpdate?.();
      // Leaving Options stops a download that nobody can see any more.
      if (updates && ['downloading', 'verifying'].includes(updates.state().phase)) updates.cancel();
      helper?.removeEventListener('change', onHelperChange);
      fill?.removeEventListener('change', onHelperChange);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
