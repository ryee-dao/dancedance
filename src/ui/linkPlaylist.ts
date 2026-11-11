/** Screen for pasting a YouTube playlist link once. */

import { getPlatform } from '../platform/platform';
import { parsePlaylistLink, PLAYLIST_READ_FAILED } from '../player/playlistReader';
import { h, type Nav, type Screen } from './dom';
import type { Scope } from './focusNav';
import { library } from './library';
import { toast } from './toast';

export function createLinkPlaylist(nav: Nav): Screen {
  const current = library.link();
  const input = h('input', {
    id: 'playlist-input',
    class: 'text-input',
    type: 'text',
    inputmode: 'url',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: 'https://www.youtube.com/playlist?list=…',
    'aria-describedby': 'playlist-msg',
  });
  if (current) input.value = current.input;

  const msg = h('p', { id: 'playlist-msg', class: 'form-msg', role: 'alert' });
  const saveBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save playlist');
  const form = h(
    'form',
    { class: 'link-form', novalidate: true },
    h('label', { class: 'field-label', for: 'playlist-input' }, 'Playlist link'),
    input,
    msg,
    h(
      'div',
      { class: 'form-row' },
      saveBtn,
      h('button', { class: 'btn', type: 'button', 'data-action': 'cancel' }, 'Cancel'),
      current && h('button', { class: 'btn btn-quiet', type: 'button', 'data-action': 'unlink' }, 'Unlink playlist'),
    ),
  );

  const el = h(
    'main',
    { class: 'screen link-screen' },
    h(
      'div',
      { class: 'panel' },
      h('h1', { class: 'panel-title' }, current ? 'Change your playlist' : 'Link your YouTube playlist'),
      h(
        'ol',
        { class: 'steps' },
        h('li', {}, 'Open the playlist on YouTube.'),
        h('li', {}, 'Choose Share, then Copy link.'),
        h('li', {}, 'Paste it here. DanceDance re-reads it every time it opens.'),
      ),
      h(
        'p',
        { class: 'note' },
        'The playlist must be Public or Unlisted. Watch Later and Liked videos are private and won’t work.',
      ),
      form,
    ),
  );

  let busy = false;
  let alive = true;

  function setMsg(text: string, kind: 'error' | 'info' = 'error'): void {
    msg.textContent = text;
    msg.dataset.kind = kind;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const parsed = parsePlaylistLink(input.value);
    if (!parsed.ok) {
      setMsg(parsed.error);
      input.focus();
      return;
    }
    busy = true;
    saveBtn.textContent = 'Reading playlist…';
    setMsg('Reading your playlist. This takes a few seconds.', 'info');
    try {
      const entries = await getPlatform().getPlaylist(parsed.listId);
      if (!alive) return;
      library.setLink({ input: input.value.trim(), listId: parsed.listId }, entries);
      toast(`Playlist linked: ${entries.length} songs.`);
      nav.home();
    } catch (err) {
      if (!alive) return;
      setMsg(err instanceof Error && err.message ? err.message : PLAYLIST_READ_FAILED);
    } finally {
      busy = false;
      saveBtn.textContent = 'Save playlist';
    }
  });

  el.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'cancel') nav.home({ focusAction: 'link' });
    if (action === 'unlink') {
      library.unlink();
      toast('Playlist unlinked.');
      nav.home({ focusAction: 'link' });
    }
  });

  const scope: Scope = {
    root: el,
    onBack: () => nav.home({ focusAction: 'link' }),
    defaultFocus: () => input,
  };

  return {
    el,
    scope,
    destroy() {
      alive = false;
    },
  };
}
