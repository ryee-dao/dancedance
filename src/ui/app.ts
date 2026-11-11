/** App shell: screen switching, file picking and drag-and-drop. */

import { loadCloudIndex } from '../beat/bpmIndex';
import { getPlatform, setPlatform } from '../platform/platform';
import { createAndroidTvPlatform, hasTvBridge, shouldOfferTvLink } from '../platform/androidtv';
import { createWebPlatform } from '../platform/web';
import { fileTitle, isSupportedAudioFile } from '../player/audioPlayer';
import type { PlayItem } from '../player/types';
import type { Nav, Screen } from './dom';
import { initFocusNav, setScreenScope } from './focusNav';
import { createHome } from './home';
import { library, songGenre } from './library';
import { createLinkPlaylist } from './linkPlaylist';
import { createAddSong } from './addSong';
import { createOptions } from './options';
import { store } from '../store';
import { createCoachStage } from './coachStage';
import { createPlay, setStageRenderer } from './play';
import { createTvLink } from './tvLink';
import { toast } from './toast';

export function startApp(root: HTMLElement): void {
  // Inside the Android TV shell (window.DanceBridge) use the TV platform.
  const tv = hasTvBridge();
  setPlatform(tv ? createAndroidTvPlatform() : createWebPlatform());
  // The coach dances on the play screen. `?stage=pulse` swaps in the plain
  // beat-pulse ring instead (handy for checking sync by eye).
  if (new URLSearchParams(location.search).get('stage') !== 'pulse') {
    const isTV = getPlatform().isTV;
    // The stored look applies unless the URL says ?coach=<style> (the stage checks that).
    setStageRenderer(() =>
      createCoachStage({
        getIntensity: () => store.settings().intensity,
        isTV,
        getStyle: () => store.settings().coachStyle,
        getRoutineMode: () => store.settings().routineMode,
        getPlayCount: (id) => store.playCount(id),
        getGenre: (id) => songGenre(id),
        getPlayers: () => store.settings().players,
      }),
    );
  }
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
    link: () => show(tv ? createTvLink(nav) : createLinkPlaylist(nav)),
    play: (queue: PlayItem[], opts) => {
      if (queue.length) show(createPlay(nav, queue, opts));
    },
    pickFile: () => {
      fileInput.value = '';
      fileInput.click();
    },
    addSong: () => {
      // Search and the GitHub token are web-only; the TV just shows the published list.
      if (tv) show(createHome(nav));
      else show(createAddSong(nav));
    },
    options: () => show(createOptions(nav)),
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) playFile(file);
  });

  if (getPlatform().canPlayFiles) setupDrop(playFile);

  void library.refresh();
  void loadCloudIndex(getPlatform().beatmapBase);
  // TV, first run without a playlist: offer phone linking straight away.
  if (tv && shouldOfferTvLink()) nav.link();
  else nav.home();
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
