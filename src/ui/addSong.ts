/**
 * "Add a song" (web): search real songs (iTunes), pick one, and ask the
 * GitHub beat-map job to find it on YouTube and make its beat map. The song
 * then waits in "My added songs" on the home screen until it is published.
 */

import starterData from '../data/starter.json';
import { songKey } from '../beat/cloud';
import { addedSongs } from './addedSongs';
import { formatTime, h, type Nav, type Screen } from './dom';
import { ensureFocus, focusEl, popScope, pushScope, type Scope } from './focusNav';
import { connectionLabel, disconnectGithub, githubConnection, isConnected, openConnectDialog, sendSong } from './githubConnect';
import { searchSongs, SongSearchError, type SongHit } from './songSearch';
import { toast } from './toast';

const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;

const STARTER_KEYS = new Set(
  (starterData as { title: string; artist: string }[]).map((s) => songKey(s.artist.replace(/\s+(?:ft\.|feat\.).*$/i, ''), s.title)),
);

type Have = 'added' | 'pending' | 'starter' | null;

function have(hit: SongHit): Have {
  return addedSongs.stateOf(hit.key) ?? (STARTER_KEYS.has(hit.key) ? 'starter' : null);
}

export function createAddSong(nav: Nav): Screen {
  const input = h('input', {
    id: 'song-search',
    class: 'text-input search-input',
    type: 'search',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
    placeholder: 'Song or artist, e.g. Levitating',
    'aria-describedby': 'search-status',
    'aria-controls': 'search-results',
  });
  const status = h('p', { id: 'search-status', class: 'search-status', role: 'status', 'aria-live': 'polite' });
  const list = h('div', { id: 'search-results', class: 'results', role: 'list', 'aria-label': 'Songs found' });
  const connLine = h('div', { class: 'conn-line' });

  const el = h(
    'main',
    { class: 'screen add-screen' },
    h(
      'header',
      { class: 'add-header' },
      h('button', { class: 'btn btn-small', type: 'button', 'data-action': 'back' }, '← Back'),
      h('h1', { class: 'panel-title add-title' }, 'Add a song'),
    ),
    h('label', { class: 'field-label', for: 'song-search' }, 'Find a song'),
    input,
    status,
    list,
    connLine,
  );

  let hits: SongHit[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ctl: AbortController | null = null;
  let seq = 0;
  let lastTerm = '';
  let alive = true;
  let closeDialog: (() => void) | null = null;

  function setStatus(text: string, kind: 'info' | 'error' | 'muted' = 'muted', retry = false): void {
    status.replaceChildren(text);
    status.dataset.kind = kind;
    if (retry) status.append(' ', h('button', { class: 'btn btn-small', type: 'button', 'data-action': 'retry' }, 'Try again'));
  }

  function renderConn(): void {
    const c = githubConnection();
    const label = connectionLabel(c);
    connLine.replaceChildren(
      label
        ? h(
            'p',
            { class: 'note' },
            `${label} `,
            c.relaySource !== 'build' && h('button', { class: 'btn btn-small btn-quiet', type: 'button', 'data-action': 'disconnect' }, 'Disconnect'),
          )
        : h('p', { class: 'note' }, 'The first time you add a song, DanceDance asks how to reach your GitHub repository’s beat-map job: a relay address or a GitHub token.'),
    );
  }

  function renderResults(): void {
    list.replaceChildren(
      ...hits.map((hit, i) => {
        const state = have(hit);
        const badge =
          state === 'added' || state === 'starter' ? 'In your songs' : state === 'pending' ? 'Being added' : null;
        return h(
          'button',
          {
            class: 'result-row',
            type: 'button',
            role: 'listitem',
            'data-index': i,
            'aria-label': `${hit.title} by ${hit.artist}, ${formatTime(hit.durationSec)}${badge ? `, ${badge.toLowerCase()}` : ''}`,
          },
          hit.artworkUrl ? h('img', { class: 'result-art', src: hit.artworkUrl, alt: '', loading: 'lazy', decoding: 'async' }) : h('span', { class: 'result-art' }),
          h(
            'span',
            { class: 'result-text' },
            h('span', { class: 'result-title' }, hit.title),
            h('span', { class: 'result-artist' }, hit.artist),
            h('span', { class: 'result-album' }, [hit.album, hit.year].filter(Boolean).join(' · ')),
          ),
          badge && h('span', { class: `badge result-badge${state === 'pending' ? ' badge-pending' : ''}` }, badge),
          h('span', { class: 'result-time' }, formatTime(hit.durationSec)),
        );
      }),
    );
  }

  async function runSearch(term: string): Promise<void> {
    const my = ++seq;
    ctl?.abort();
    ctl = new AbortController();
    lastTerm = term;
    setStatus('Searching…', 'info');
    try {
      const found = await searchSongs(term, { signal: ctl.signal });
      if (!alive || my !== seq) return;
      hits = found;
      renderResults();
      setStatus(
        found.length
          ? `${found.length} song${found.length === 1 ? '' : 's'} found. Press Down to choose one.`
          : `No songs found for “${term}”. Check the spelling, or try the artist’s name too.`,
        found.length ? 'muted' : 'error',
      );
    } catch (e) {
      if (!alive || my !== seq || (e as Error)?.name === 'AbortError') return;
      hits = [];
      renderResults();
      const kind = e instanceof SongSearchError ? e.kind : 'failed';
      if (kind === 'offline') setStatus('You’re offline. Connect to the internet to search for songs.', 'error', true);
      else if (kind === 'busy') setStatus('The song search is busy. Wait a minute and try again.', 'error', true);
      else setStatus('Couldn’t search right now. Try again in a moment.', 'error', true);
    }
  }

  function schedule(now = false): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const term = input.value.trim();
    if (term.length < MIN_CHARS) {
      seq++;
      ctl?.abort();
      hits = [];
      renderResults();
      setStatus(term ? 'Keep typing…' : 'Type a song title, an artist, or both.');
      return;
    }
    if (!now && term === lastTerm && hits.length) return;
    timer = setTimeout(() => void runSearch(term), now ? 0 : DEBOUNCE_MS);
  }

  input.addEventListener('input', () => schedule());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      schedule(true);
    }
  });
  const onOnline = () => {
    if (status.dataset.kind === 'error' && input.value.trim().length >= MIN_CHARS) schedule(true);
  };
  window.addEventListener('online', onOnline);

  /** Confirm dialog for one result. */
  function openConfirm(hit: SongHit, from: HTMLElement): void {
    closeDialog?.();
    const state = have(hit);
    const addBtn = h('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'confirm-add' }, 'Add song');
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const already =
      state === 'added'
        ? 'This song is already in My added songs.'
        : state === 'pending'
          ? 'This song is already being added. It shows up on the home screen when it’s ready.'
          : state === 'starter'
            ? 'This song is already in the Starter pack.'
            : null;
    const card = h(
      'div',
      { class: 'picker-card dialog-card confirm-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Add ${hit.title}` },
      h(
        'div',
        { class: 'confirm-song' },
        hit.artworkUrl ? h('img', { class: 'confirm-art', src: hit.artworkUrl, alt: '' }) : h('span', { class: 'confirm-art' }),
        h(
          'div',
          {},
          h('p', { class: 'picker-kicker' }, 'Add a song'),
          h('p', { class: 'confirm-title' }, hit.title),
          h('p', { class: 'confirm-meta' }, `${hit.artist} · ${formatTime(hit.durationSec)}`),
        ),
      ),
      h(
        'p',
        { class: 'dialog-text' },
        already ??
          'Your GitHub repository’s beat-map job finds this song on YouTube and works out its beats. It usually appears on the home screen in 3–5 minutes.',
      ),
      msg,
      h(
        'div',
        { class: 'form-row' },
        !already && addBtn,
        h('button', { class: 'btn', type: 'button', 'data-action': 'cancel' }, already ? 'OK' : 'Cancel'),
      ),
    );
    const root = h('div', { class: 'picker-backdrop' }, card);
    let open = true;
    let busy = false;
    const close = (refocus: boolean) => {
      if (!open) return;
      open = false;
      closeDialog = null;
      popScope(scope);
      root.remove();
      if (refocus && from.isConnected) focusEl(from, { instant: true });
    };
    const scope: Scope = { root, onBack: () => close(true), defaultFocus: () => (already ? null : addBtn) };

    const send = async () => {
      if (busy) return;
      if (!isConnected()) {
        close(false);
        openConnectDialog({
          parent: el,
          returnFocus: from,
          submitLabel: 'Connect and add',
          onConnected: () => {
            renderConn();
            openConfirm(hit, from);
            void closeDialogSend?.();
          },
        });
        return;
      }
      busy = true;
      addBtn.textContent = 'Sending…';
      msg.textContent = '';
      const res = await sendSong({
        key: hit.key,
        artist: hit.artist,
        title: hit.title,
        durationSec: hit.durationSec,
        artworkUrl: hit.artworkUrl || undefined,
        trackId: hit.trackId || undefined,
      });
      busy = false;
      addBtn.textContent = 'Add song';
      if (!alive) return;
      if (res.ok) {
        close(true);
        renderResults();
        const again = list.querySelector<HTMLElement>(`[data-index="${hits.indexOf(hit)}"]`);
        if (again) focusEl(again, { instant: true });
        toast(`“${hit.title}” is being added. It usually takes 3–5 minutes. You’ll find it on the home screen.`, 6000);
        return;
      }
      if (res.needs) {
        close(false);
        openConnectDialog({
          parent: el,
          returnFocus: from,
          message: res.message,
          mode: res.needs,
          submitLabel: res.needs === 'passphrase' ? 'Save and add' : 'Connect and add',
          onConnected: () => {
            renderConn();
            openConfirm(hit, from);
            void closeDialogSend?.();
          },
        });
        return;
      }
      msg.textContent = res.message;
      addBtn.textContent = 'Try again';
    };
    closeDialogSend = send;
    root.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (a === 'confirm-add') void send();
      else if (a === 'cancel' || !card.contains(e.target as Node)) close(true);
    });
    el.appendChild(root);
    pushScope(scope);
    closeDialog = () => close(false);
  }
  /** The latest confirm dialog's send(), so "Connect and add" can continue straight away. */
  let closeDialogSend: (() => Promise<void>) | null = null;

  el.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || !el.contains(t) || t.closest('.picker-backdrop')) return;
    if (t.dataset.index !== undefined) {
      const hit = hits[Number(t.dataset.index)];
      if (hit) openConfirm(hit, t);
      return;
    }
    switch (t.dataset.action) {
      case 'back':
        nav.home({ focusAction: 'add' });
        break;
      case 'retry':
        schedule(true);
        input.focus();
        break;
      case 'disconnect':
        disconnectGithub();
        renderConn();
        ensureFocus();
        toast('Disconnected. The token was removed from this browser. You can also delete it on GitHub.', 6000);
        break;
    }
  });

  const onAdded = () => {
    if (hits.length) {
      const active = document.activeElement as HTMLElement | null;
      const idx = active?.dataset.index;
      renderResults();
      if (idx !== undefined) {
        const again = list.querySelector<HTMLElement>(`[data-index="${idx}"]`);
        if (again) focusEl(again, { instant: true });
      }
    }
  };
  addedSongs.addEventListener('change', onAdded);

  renderConn();
  setStatus('Type a song title, an artist, or both.');

  const scope: Scope = {
    root: el,
    onBack: () => nav.home({ focusAction: 'add' }),
    defaultFocus: () => input,
  };

  return {
    el,
    scope,
    destroy() {
      alive = false;
      closeDialog?.();
      ctl?.abort();
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      addedSongs.removeEventListener('change', onAdded);
    },
  };
}
