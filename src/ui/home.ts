/**
 * Home: header actions, "My playlist" (if linked), "My added songs" (songs
 * added by search, plus ones still being added), and the starter pack in
 * rows (eras, plus one row per artist with 5+ songs).
 *
 * Rendering: a full render on library 'change' (skipped when the shelves and
 * their songs are unchanged; tiles are reused, not rebuilt); on 'song' only
 * that tile is patched so focus and scroll stay put while titles stream in.
 * Patching a tile with what it already shows touches nothing.
 */

import { bpmEvents, knownBpm } from '../beat/bpmIndex';
import { getPlatform } from '../platform/platform';
import type { PlayItem } from '../player/types';
import { store, type Intensity } from '../store';
import { addedSongs, type PendingView } from './addedSongs';
import { h, type HomeOptions, type Nav, type Screen } from './dom';
import { isConnected, openConnectDialog, sendSong } from './githubConnect';
import { ensureFocus, focusEl, type Scope } from './focusNav';
import { openLevelPicker } from './levelPicker';
import { library, thumbnailUrl, type Song, type ThumbSize } from './library';
import { toast } from './toast';

export function createHome(nav: Nav, opts: HomeOptions = {}): Screen {
  const platform = getPlatform();
  /** Tiles by video ID. Kept across renders: a re-render moves them, it doesn't rebuild them (or reload their thumbnails). */
  let tiles = new Map<string, HTMLButtonElement>();
  /** Tiles placed by the render in progress. */
  let placed = new Map<string, HTMLButtonElement>();
  /** What the last render laid out; a 'change' that leaves it the same only refreshes the tiles. */
  let lastLayout = '';
  let closePicker: (() => void) | null = null;

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
    !platform.isTV && h('button', { class: 'btn', 'data-action': 'add', type: 'button' }, icon('add'), 'Add a song'),
    linkBtn,
    platform.canPlayFiles &&
      h('button', { class: 'btn', 'data-action': 'file', type: 'button' }, icon('file'), 'Play a file'),
    h('button', { class: 'btn', 'data-action': 'options', type: 'button' }, icon('options'), 'Options'),
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

    const status = library.playlistStatus();
    const playlist = status.kind !== 'none' ? library.playlistSongs() : [];
    const added = library.addedSongs();
    const pending = platform.isTV ? [] : addedSongs.pending();
    const hiddenCount = addedSongs.hiddenCount();
    const groups = library.starterGroups();
    const linkLabel = platform.isTV ? 'Add songs from your phone' : library.link() ? 'Change playlist' : 'Link playlist';
    const ids = (songs: Song[]) => songs.map((s) => s.videoId);
    const layout = JSON.stringify([
      linkLabel,
      status,
      ids(playlist),
      ids(added),
      pending,
      hiddenCount,
      groups.map((g) => [g.id, g.title, ids(g.songs)]),
    ]);
    if (layout === lastLayout) {
      // Same shelves and songs (e.g. the added-songs list arrived unchanged): just refresh the tiles.
      refreshTiles();
      return;
    }
    lastLayout = layout;

    // TV: one entry for everything done from the phone (link a playlist, add songs).
    linkBtn.replaceChildren(icon(platform.isTV ? 'add' : 'link'), linkLabel);
    placed = new Map();
    const sections: HTMLElement[] = [];

    if (status.kind !== 'none') {
      const songs = playlist;
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

    if (added.length || pending.length || hiddenCount) {
      sections.push(
        h(
          'section',
          { class: 'shelf', 'aria-label': 'My added songs' },
          h(
            'h2',
            { class: 'shelf-title' },
            'My added songs',
            added.length > 0 && h('span', { class: 'shelf-count' }, `${added.length} song${added.length === 1 ? '' : 's'}`),
            hiddenCount > 0 &&
              h('button', { class: 'btn btn-small btn-quiet', 'data-action': 'unhide', type: 'button' }, `Show ${hiddenCount} removed`),
          ),
          pending.length > 0 && h('div', { class: 'pending-list' }, ...pending.map(pendingCard)),
          added.length > 0 && grid(added),
          added.length > 0 &&
            h(
              'p',
              { class: 'shelf-foot' },
              platform.removeLocalAddedSong
                ? 'Removing a song added from your phone deletes it from this projector. Songs in your cloud song list are only hidden here.'
                : 'Removing a song hides it on this device only. It stays in your song list in the cloud.',
            ),
        ),
      );
    }

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
    tiles = placed;
    useThumbs();

    const restore =
      (keepId && tiles.get(keepId)) ||
      (keepAction && el.querySelector<HTMLElement>(`[data-action="${keepAction}"]`));
    if (!el.isConnected) return; // first render: the app focuses after mounting
    if (restore) focusEl(restore, { instant: true });
    else ensureFocus();
  }

  function pendingCard(p: PendingView): HTMLElement {
    const btn = (action: string, label: string, primary = false) =>
      h('button', { class: `btn btn-small${primary ? ' btn-primary' : ''}`, type: 'button', 'data-action': action, 'data-key': p.key }, label);
    const buttons =
      p.state === 'failed'
        ? [btn('add-retry', 'Try again', true), btn('add-dismiss', 'Dismiss')]
        : p.state === 'slow'
          ? [btn('add-retry', 'Send again', true), btn('add-dismiss', 'Stop waiting')]
          : p.state === 'retrying'
            ? [btn('add-dismiss', 'Stop waiting')]
            : [];
    return h(
      'div',
      { class: 'pending-card', 'data-state': p.state, 'data-key': p.key, role: 'group', 'aria-label': `${p.title} by ${p.artist}: ${p.message}` },
      p.artworkUrl ? h('img', { class: 'pending-art', src: p.artworkUrl, alt: '', loading: 'lazy' }) : h('span', { class: 'pending-art' }),
      h(
        'div',
        { class: 'pending-text' },
        h('span', { class: 'pending-title' }, p.title),
        h('span', { class: 'artist' }, p.artist),
        h('span', { class: 'pending-msg' }, p.state === 'waiting' && h('span', { class: 'spinner', 'aria-hidden': 'true' }), p.message),
        buttons.length > 0 && h('span', { class: 'pending-buttons' }, ...buttons),
      ),
    );
  }

  /** "Try again" / "Send again" on a pending card. */
  async function resend(key: string, from: HTMLElement): Promise<void> {
    const p = addedSongs.pending().find((x) => x.key === key);
    if (!p) return;
    const go = async (): Promise<void> => {
      from.setAttribute('disabled', '');
      const res = await sendSong({ key: p.key, artist: p.artist, title: p.title, durationSec: p.durationSec, artworkUrl: p.artworkUrl, trackId: p.trackId });
      from.removeAttribute('disabled');
      if (res.ok) toast(`Sent again. “${p.title}” usually takes 3–5 minutes.`);
      else if (res.needs) {
        openConnectDialog({ parent: el, returnFocus: from, message: res.message, mode: res.needs, submitLabel: 'Save and send', onConnected: () => void go() });
      } else toast(res.message, 6000);
    };
    if (!isConnected()) openConnectDialog({ parent: el, returnFocus: from, submitLabel: 'Connect and send', onConnected: () => void go() });
    else await go();
  }

  function grid(songs: Song[]): HTMLElement {
    return h('div', { class: 'grid', role: 'list' }, ...songs.map(tile));
  }

  function tile(song: Song): HTMLButtonElement {
    let btn = tiles.get(song.videoId);
    if (!btn) {
      // The thumbnail's src is set once its size is known (useThumbs).
      const img = h('img', { alt: '', loading: 'lazy', decoding: 'async' });
      unsized.push([img, song.videoId]);
      btn = h(
        'button',
        { class: 'tile', type: 'button', 'data-id': song.videoId, role: 'listitem' },
        h('span', { class: 'thumb' }, img, h('span', { class: 'badges' }), h('span', { class: 'bpm-badge', hidden: true })),
        h('span', { class: 'meta' }, h('span', { class: 'title' }), h('span', { class: 'artist' })),
      );
    }
    placed.set(song.videoId, btn);
    patchTile(btn, song);
    return btn;
  }

  /** Thumbnails waiting for their src. */
  const unsized: [HTMLImageElement, string][] = [];

  /** Lazy thumbnails not loaded yet, in page order (prefetchThumbs). */
  const notLoaded: HTMLImageElement[] = [];
  let prefetching = false;

  /**
   * Give new thumbnails their src. On TV the size is picked from the laid-out
   * tile: YouTube's 320 px thumbnail when it is about as wide as the tile in
   * device pixels (a third of the pixels to fetch and decode), else the 480 px one.
   * They load lazily (the first screen first), then prefetchThumbs fetches the rest.
   */
  function useThumbs(): void {
    if (!unsized.length || !el.isConnected) return;
    if (!thumbSize) {
      const thumb = el.querySelector<HTMLElement>('.thumb');
      const w = (thumb?.offsetWidth ?? 0) * (window.devicePixelRatio || 1);
      if (!(w > 0)) return;
      thumbSize = platform.isTV && w <= 352 ? 'mq' : 'hq';
    }
    for (const [img, id] of unsized.splice(0)) {
      img.src = thumbnailUrl(id, thumbSize);
      notLoaded.push(img);
    }
    if (!prefetching) {
      prefetching = true;
      const step = () => {
        if (!prefetchThumbs()) setTimeout(step, 120);
      };
      setTimeout(step, 120);
    }
  }

  /**
   * Start a few more of the thumbnails further down (every 120 ms after the
   * first screen is up), so scrolling later doesn't wait for, or stutter on,
   * them arriving. True when there's nothing left (or the screen is gone).
   */
  function prefetchThumbs(): boolean {
    if (!el.isConnected) return true;
    let started = 0;
    while (notLoaded.length && started < 6) {
      const img = notLoaded.shift()!;
      if (!img.isConnected || img.complete) continue;
      img.loading = 'eager';
      started++;
    }
    if (notLoaded.length) return false;
    prefetching = false;
    return true;
  }

  function refreshTiles(): void {
    for (const [id, btn] of tiles) {
      const song = library.find(id);
      if (song) patchTile(btn, song);
    }
  }

  function patchTile(btn: HTMLButtonElement, song: Song): void {
    const bpm = knownBpm(song.videoId);
    // Listed before the cloud could make its map: the coach learns the beat by listening the first time.
    const learning = bpm === null && addedSongs.find(song.videoId)?.hasMap === false;
    const blocked = library.blockReason(song.videoId);
    const isNew = library.isNew(song.videoId);
    // Unchanged since the last patch (most 'song' and tempo events): leave the DOM alone.
    const state = `${bpm}|${learning}|${blocked}|${isNew}|${song.title}|${song.artist}`;
    if (tileState.get(btn) === state) return;
    tileState.set(btn, state);
    const title = btn.querySelector('.title')!;
    const artist = btn.querySelector('.artist')!;
    const badges = btn.querySelector('.badges')!;
    const bpmBadge = btn.querySelector<HTMLElement>('.bpm-badge')!;
    bpmBadge.hidden = bpm === null && !learning;
    bpmBadge.textContent = bpm !== null ? `${bpm} BPM` : learning ? 'Learning the beat' : '';
    bpmBadge.classList.toggle('bpm-learning', learning);
    title.textContent = song.title ?? 'Loading title…';
    title.classList.toggle('pending', song.title === null);
    artist.textContent = song.artist ?? '';
    btn.classList.toggle('blocked', !!blocked);
    badges.replaceChildren(
      ...(blocked
        ? [h('span', { class: 'badge badge-blocked' }, blocked === 'embed' ? "Can't play here" : 'Unavailable')]
        : []),
      ...(isNew && !blocked ? [h('span', { class: 'badge badge-new' }, 'New')] : []),
    );
    const label = [
      song.title ?? 'Untitled video',
      song.artist,
      blocked ? "can't play here" : isNew ? 'new' : null,
      bpm !== null && !blocked ? `${bpm} BPM` : learning && !blocked ? 'learning the beat' : null,
    ]
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
  const onBpm = () => refreshTiles();
  library.addEventListener('change', onChange);
  library.addEventListener('song', onSong);
  // Polling finds new songs while the app sits on the home screen.
  void addedSongs.refresh();
  bpmEvents.addEventListener('change', onBpm);

  /** Ask for the level, then play. */
  function pickLevel(
    title: string,
    initial: Intensity,
    from: HTMLElement,
    play: (level: Intensity) => void,
    extra?: { label: string; onSelect(): void },
  ): void {
    closePicker?.();
    // Load the play screen's code while the level is being chosen.
    nav.prepare?.();
    closePicker = openLevelPicker({
      parent: el,
      title,
      initial,
      returnFocus: from,
      extra: extra && {
        label: extra.label,
        onSelect: () => {
          closePicker = null;
          extra.onSelect();
        },
      },
      onPick: (level) => {
        closePicker = null;
        store.updateSettings({ intensity: level });
        play(level);
      },
    });
  }

  /**
   * "Remove from My added songs": a device song (TV) is removed for real, a
   * cloud song is hidden here. Focus moves to a neighbouring tile first, so
   * the re-render keeps it there instead of jumping to the top.
   */
  async function removeAdded(id: string, title: string): Promise<void> {
    const from = tiles.get(id);
    const next = from?.isConnected ? neighbourOf(from) : null;
    if (next) focusEl(next, { instant: true });
    const r = await addedSongs.remove(id);
    toast(
      r.removedLocal && r.hidden
        ? `Removed “${title}” from this projector and hid it here. It stays in your song list in the cloud.`
        : r.removedLocal
          ? `Removed “${title}” from this projector.`
          : `Hidden “${title}” on this device. It stays in your song list in the cloud.`,
      6000,
    );
    ensureFocus();
  }

  /** Next tile in the same row, else the previous one, else the nearest tile anywhere, else Shuffle. */
  function neighbourOf(btn: HTMLElement): HTMLElement | null {
    const sib = btn.nextElementSibling ?? btn.previousElementSibling;
    if (sib instanceof HTMLElement && sib.classList.contains('tile')) return sib;
    const all = [...el.querySelectorAll<HTMLElement>('.tile')];
    const i = all.indexOf(btn);
    return (i >= 0 && (all[i + 1] ?? all[i - 1])) || el.querySelector<HTMLElement>('[data-action="shuffle"]');
  }

  el.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || !el.contains(target)) return;
    const id = target.dataset.id;
    if (id) {
      const song = library.find(id);
      if (!song) return;
      const initial = store.songLevel(id) ?? store.settings().intensity;
      pickLevel(
        song.title ?? 'This song',
        initial,
        target,
        (level) => {
          store.setSongLevel(id, level);
          nav.play([toItem(song)], { intensity: level });
        },
        song.source === 'added'
          ? {
              label: 'Remove from My added songs',
              onSelect: () => void removeAdded(id, song.title ?? 'This song'),
            }
          : undefined,
      );
      return;
    }
    switch (target.dataset.action) {
      case 'shuffle': {
        const songs = shuffle(library.playable());
        if (!songs.length) toast('No playable songs yet.');
        else
          pickLevel('Shuffle', store.settings().intensity, target, (level) =>
            nav.play(songs.map(toItem), { shuffle: true, intensity: level }),
          );
        break;
      }
      case 'link':
        nav.link();
        break;
      case 'add':
        nav.addSong();
        break;
      case 'options':
        nav.options();
        break;
      case 'unhide':
        addedSongs.unhideAll();
        break;
      case 'add-retry':
        if (target.dataset.key) void resend(target.dataset.key, target);
        break;
      case 'add-dismiss':
        if (target.dataset.key) {
          addedSongs.removePending(target.dataset.key);
          ensureFocus();
        }
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
    // Android TV: BACK on the home screen leaves the app (web: no-op).
    onBack: platform.exitApp ? () => platform.exitApp?.() : undefined,
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
    mounted: useThumbs,
    destroy() {
      closePicker?.();
      bpmEvents.removeEventListener('change', onBpm);
      library.removeEventListener('change', onChange);
      library.removeEventListener('song', onSong);
    },
  };
}

/** Thumbnail size, decided from the first laid-out tile (see useThumbs). */
let thumbSize: ThumbSize | null = null;
/** Last state each tile was patched with. */
const tileState = new WeakMap<HTMLButtonElement, string>();

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

function icon(name: 'shuffle' | 'link' | 'file' | 'add' | 'options'): HTMLElement {
  const paths: Record<typeof name, string> = {
    add: '<path d="M11 5a6 6 0 1 0 3.9 10.6L19 19.7M8 11h6M11 8v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    options:
      '<path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    shuffle:
      '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    file: '<path d="M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM19 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return svg(`<svg viewBox="0 0 24 24" width="24" height="24">${paths[name]}</svg>`, 'icon');
}
