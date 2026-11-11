/**
 * Home: header actions, "My playlist" (if linked), and the starter pack in
 * rows (eras, plus one row per artist with 5+ songs).
 *
 * Rendering: a full render on library 'change'; on 'song' only that tile is
 * patched so focus and scroll stay put while titles stream in.
 */

import { getPlatform } from '../platform/platform';
import type { PlayItem } from '../player/types';
import { h, type HomeOptions, type Nav, type Screen } from './dom';
import { ensureFocus, focusEl, type Scope } from './focusNav';
import { library, thumbnailUrl, type Song } from './library';
import { toast } from './toast';

export function createHome(nav: Nav, opts: HomeOptions = {}): Screen {
  const platform = getPlatform();
  const tiles = new Map<string, HTMLButtonElement>();

  const linkBtn = h('button', { class: 'btn', 'data-action': 'link', type: 'button' });
  const actions = h(
    'div',
    { class: 'home-actions' },
    h(
      'button',
      { class: 'btn btn-primary', 'data-action': 'shuffle', type: 'button' },
      icon('shuffle'),
      'Shuffle',
    ),
    linkBtn,
    platform.canPlayFiles &&
      h('button', { class: 'btn', 'data-action': 'file', type: 'button' }, icon('file'), 'Play a file'),
  );
  const header = h(
    'header',
    { class: 'home-header' },
    h('div', { class: 'brand' }, brandMark(), h('h1', { class: 'brand-name' }, 'DanceDance')),
    actions,
  );
  const body = h('div', { class: 'home-body' });
  const hint = h(
    'p',
    { class: 'home-hint' },
    platform.canPlayFiles
      ? 'Arrows to move · OK or Enter to play · drop an MP3 or M4A anywhere to dance to it'
      : 'Arrows to move · OK to play',
  );
  const el = h('main', { class: 'screen home' }, header, body, hint);

  // --- rendering -------------------------------------------------------------

  function render(): void {
    // Remember what was focused so a re-render doesn't lose the user's place.
    const active = document.activeElement as HTMLElement | null;
    const keepId = el.contains(active) ? active?.dataset.id : undefined;
    const keepAction = el.contains(active) ? active?.dataset.action : undefined;

    linkBtn.replaceChildren(icon('link'), library.link() ? 'Change playlist' : 'Link playlist');
    tiles.clear();
    const sections: HTMLElement[] = [];
    const status = library.playlistStatus();

    if (status.kind !== 'none') {
      const songs = library.playlistSongs();
      const heading = h(
        'h2',
        { class: 'shelf-title' },
        'My playlist',
        songs.length > 0 && h('span', { class: 'shelf-count' }, `${songs.length} songs`),
        status.kind === 'ready' && status.refreshing && h('span', { class: 'shelf-note' }, 'Updating…'),
      );
      const parts: (HTMLElement | false)[] = [heading];
      if (status.kind === 'loading') {
        parts.push(h('p', { class: 'shelf-status' }, 'Reading your playlist…'));
      } else if (status.kind === 'error') {
        parts.push(
          h(
            'div',
            { class: 'shelf-status shelf-error' },
            h(
              'p',
              {},
              status.showingCache
                ? `${status.message} Showing the songs from last time.`
                : status.message,
            ),
            h('button', { class: 'btn btn-small', 'data-action': 'retry', type: 'button' }, 'Try again'),
            !status.showingCache &&
              h('button', { class: 'btn btn-small', 'data-action': 'link', type: 'button' }, 'Change playlist'),
          ),
        );
      }
      if (songs.length) parts.push(grid(songs));
      sections.push(h('section', { class: 'shelf', 'aria-label': 'My playlist' }, ...parts));
    }

    const groups = library.starterGroups();
    sections.push(
      h(
        'section',
        { class: 'shelf', 'aria-label': 'Starter pack' },
        h('h2', { class: 'shelf-title' }, 'Starter pack'),
        ...groups.map((g) =>
          h(
            'div',
            { class: 'group', 'data-group': g.id },
            h('h3', { class: 'group-title' }, g.title, h('span', { class: 'shelf-count' }, String(g.songs.length))),
            grid(g.songs),
          ),
        ),
      ),
    );
    body.replaceChildren(...sections);

    const restore =
      (keepId && tiles.get(keepId)) ||
      (keepAction && el.querySelector<HTMLElement>(`[data-action="${keepAction}"]`));
    if (!el.isConnected) return; // first render: the app focuses after mounting
    if (restore) focusEl(restore, { instant: true });
    else ensureFocus();
  }

  function grid(songs: Song[]): HTMLElement {
    return h('div', { class: 'grid', role: 'list' }, ...songs.map(tile));
  }

  function tile(song: Song): HTMLButtonElement {
    const btn = h(
      'button',
      { class: 'tile', type: 'button', 'data-id': song.videoId, role: 'listitem' },
      h(
        'span',
        { class: 'thumb' },
        h('img', { src: thumbnailUrl(song.videoId), alt: '', loading: 'lazy', decoding: 'async' }),
        h('span', { class: 'badges' }),
      ),
      h('span', { class: 'meta' }, h('span', { class: 'title' }), h('span', { class: 'artist' })),
    );
    tiles.set(song.videoId, btn);
    patchTile(btn, song);
    return btn;
  }

  function patchTile(btn: HTMLButtonElement, song: Song): void {
    const title = btn.querySelector('.title')!;
    const artist = btn.querySelector('.artist')!;
    const badges = btn.querySelector('.badges')!;
    title.textContent = song.title ?? 'Loading title…';
    title.classList.toggle('pending', song.title === null);
    artist.textContent = song.artist ?? '';
    const blocked = library.blockReason(song.videoId);
    const isNew = library.isNew(song.videoId);
    btn.classList.toggle('blocked', !!blocked);
    badges.replaceChildren(
      ...(blocked
        ? [h('span', { class: 'badge badge-blocked' }, blocked === 'embed' ? "Can't play here" : 'Unavailable')]
        : []),
      ...(isNew && !blocked ? [h('span', { class: 'badge badge-new' }, 'New')] : []),
    );
    const label = [song.title ?? 'Untitled video', song.artist, blocked ? "can't play here" : isNew ? 'new' : null]
      .filter(Boolean)
      .join(', ');
    btn.setAttribute('aria-label', label);
  }

  // --- events ----------------------------------------------------------------

  const onChange = () => render();
  const onSong = (e: Event) => {
    const id = (e as CustomEvent<string>).detail;
    const btn = tiles.get(id);
    const song = library.find(id);
    if (btn && song) patchTile(btn, song);
  };
  library.addEventListener('change', onChange);
  library.addEventListener('song', onSong);

  el.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || !el.contains(target)) return;
    const id = target.dataset.id;
    if (id) {
      const song = library.find(id);
      if (song) nav.play([toItem(song)]);
      return;
    }
    switch (target.dataset.action) {
      case 'shuffle': {
        const songs = shuffle(library.playable());
        if (!songs.length) toast('No playable songs yet.');
        else nav.play(songs.map(toItem), { shuffle: true });
        break;
      }
      case 'link':
        nav.link();
        break;
      case 'file':
        nav.pickFile();
        break;
      case 'retry':
        void library.refresh();
        break;
    }
  });

  render();

  const scope: Scope = {
    root: el,
    defaultFocus: () => {
      if (opts.focusId) {
        const t = tiles.get(opts.focusId);
        if (t) return t;
      }
      if (opts.focusAction) {
        const b = el.querySelector<HTMLElement>(`[data-action="${opts.focusAction}"]`);
        if (b) return b;
      }
      return el.querySelector<HTMLElement>('.tile') ?? el.querySelector<HTMLElement>('[data-action="shuffle"]');
    },
  };

  return {
    el,
    scope,
    destroy() {
      library.removeEventListener('change', onChange);
      library.removeEventListener('song', onSong);
    },
  };
}

function toItem(song: Song): PlayItem {
  return {
    kind: 'youtube',
    videoId: song.videoId,
    title: song.title ?? 'YouTube video',
    artist: song.artist ?? undefined,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- original artwork ----------------------------------------------------------

function svg(markup: string, cls: string): HTMLElement {
  const span = h('span', { class: cls, 'aria-hidden': 'true' });
  span.innerHTML = markup;
  return span;
}

function brandMark(): HTMLElement {
  // Two offset sound-wave arcs over a dot: "a beat with two dancers".
  return svg(
    `<svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="30" r="6" fill="currentColor"/>` +
      `<path d="M10 26a14 14 0 0 1 28 0" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M4 22a20 20 0 0 1 40 0" fill="none" stroke="var(--accent-2)" stroke-width="4" stroke-linecap="round" opacity=".8"/></svg>`,
    'brand-mark',
  );
}

function icon(name: 'shuffle' | 'link' | 'file'): HTMLElement {
  const paths: Record<typeof name, string> = {
    shuffle:
      '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    file: '<path d="M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM19 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return svg(`<svg viewBox="0 0 24 24" width="24" height="24">${paths[name]}</svg>`, 'icon');
}
