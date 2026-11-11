/** App shell: screen switching, file picking and drag-and-drop. */

import { getPlatform, setPlatform } from '../platform/platform';
import { createWebPlatform } from '../platform/web';
import { fileTitle, isSupportedAudioFile } from '../player/audioPlayer';
import type { PlayItem } from '../player/types';
import type { Nav, Screen } from './dom';
import { initFocusNav, setScreenScope } from './focusNav';
import { createHome } from './home';
import { library } from './library';
import { createLinkPlaylist } from './linkPlaylist';
import { createPlay } from './play';
import { toast } from './toast';

export function startApp(root: HTMLElement): void {
  // Later phase: pick androidtv.ts here when window.DanceBridge exists.
  setPlatform(createWebPlatform());
  initFocusNav();

  let current: Screen | null = null;
  const show = (screen: Screen) => {
    current?.destroy();
    current = screen;
    root.replaceChildren(screen.el);
    window.scrollTo(0, 0);
    setScreenScope(screen.scope);
    screen.mounted?.();
  };

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a';
  fileInput.className = 'visually-hidden';
  fileInput.tabIndex = -1;
  fileInput.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fileInput);

  const playFile = (file: File) => {
    if (!isSupportedAudioFile(file)) {
      toast('Only MP3 and M4A files can be played.');
      return;
    }
    nav.play([{ kind: 'file', file, title: fileTitle(file) }]);
  };

  const nav: Nav = {
    home: (opts) => show(createHome(nav, opts)),
    link: () => show(createLinkPlaylist(nav)),
    play: (queue: PlayItem[], opts) => {
      if (queue.length) show(createPlay(nav, queue, opts));
    },
    pickFile: () => {
      fileInput.value = '';
      fileInput.click();
    },
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) playFile(file);
  });

  if (getPlatform().canPlayFiles) setupDrop(playFile);

  void library.refresh();
  nav.home();
}

/** Drop an audio file anywhere on the window. */
function setupDrop(onFile: (f: File) => void): void {
  let depth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    depth++;
    document.body.classList.add('dragging');
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) document.body.classList.remove('dragging');
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); // required to allow dropping
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dragging');
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });
}
