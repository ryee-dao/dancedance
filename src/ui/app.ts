/** App shell: screen switching, file picking and drag-and-drop. */

import { loadCloudIndex } from '../beat/bpmIndex';
import { createBackgroundFill, setBackgroundFill } from '../beat/helperFill';
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
import { store } from '../store';
import { runSliced, runWhenQuiet, trackInput, whenQuiet } from './idle';
import { createTvLink } from './tvLink';
import { toast } from './toast';

type PlayChunk = typeof import('./playChunk');

export function startApp(root: HTMLElement): void {
  // Inside the Android TV shell (window.DanceBridge) use the TV platform.
  const tv = hasTvBridge();
  setPlatform(tv ? createAndroidTvPlatform() : createWebPlatform());
  // TV-only CSS (cheaper focus effects for a weak GPU) keys off this class.
  document.documentElement.classList.toggle('tv', getPlatform().isTV);
  trackInput();

  // The play screen, the coach and Options live in a separate chunk with the
  // move library (see playChunk.ts): loaded after the home screen is up.
  let chunk: Promise<PlayChunk> | null = null;
  const loadChunk = (): Promise<PlayChunk> =>
    (chunk ??= import('./playChunk').then(
      (m) => {
        // The coach dances on the play screen. `?stage=pulse` swaps in the plain
        // beat-pulse ring instead (handy for checking sync by eye).
        if (new URLSearchParams(location.search).get('stage') !== 'pulse') {
          const isTV = getPlatform().isTV;
          // The stored look applies unless the URL says ?coach=<style> (the stage checks that).
          m.setStageRenderer(() =>
            m.createCoachStage({
              getIntensity: () => store.settings().intensity,
              isTV,
              getStyle: () => store.settings().coachStyle,
              getBuild: () => store.settings().coachBuild,
              getRoutineMode: () => store.settings().routineMode,
              getPlayCount: (id) => store.playCount(id),
              getGenre: (id) => songGenre(id),
              getPlayers: () => store.settings().players,
              getGraphics: () => store.settings().graphics,
            }),
          );
        }
        return m;
      },
      (err: unknown) => {
        chunk = null; // try again next time
        throw err;
      },
    ));
  initFocusNav();

  let current: Screen | null = null;
  /** Bumped on every navigation, so a screen that finished loading late doesn't replace a newer choice. */
  let navNo = 0;
  /** Show a screen from the play chunk once it's loaded (usually it already is). */
  const showLazy = (make: (m: PlayChunk) => Screen) => {
    const no = ++navNo;
    loadChunk().then(
      (m) => {
        if (no === navNo) show(make(m));
      },
      () => {
        if (no !== navNo) return;
        // Usually a tab left open across a site update (the old chunk is gone): reload once.
        if (reloadOnce()) return;
        toast("Couldn't load the dance screen. Check the connection and try again.", 6000);
      },
    );
  };
  const show = (screen: Screen) => {
    navNo++;
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
      if (queue.length) showLazy((m) => m.createPlay(nav, queue, opts));
    },
    // A song is being chosen: load the play chunk and build the routine
    // generator's caches now (in short slices), while the level is picked.
    prepare: () =>
      void loadChunk().then(
        (m) => runSliced((budget) => m.warmGenerator(budget)),
        () => {},
      ),
    pickFile: () => {
      fileInput.value = '';
      fileInput.click();
    },
    addSong: () => {
      // Search and the GitHub token are web-only; the TV just shows the published list.
      if (tv) show(createHome(nav));
      else show(createAddSong(nav));
    },
    options: (opts) => showLazy((m) => m.createOptions(nav, opts)),
    ...(tv
      ? {
          diagnostics: (o?: { focusAction?: string }) =>
            show(createTvLink(nav, { view: 'diag', focusAction: o?.focusAction, back: () => nav.options({ focusAction: 'diag' }) })),
        }
      : {}),
    // Graphics test (its own small chunk; the coach rows load the play chunk through loadChunk).
    graphicsTest: (o) => {
      const no = ++navNo;
      import('./graphicsTest').then(
        (m) => {
          if (no !== navNo) return;
          show(
            m.createGraphicsTest({
              loadChunk,
              isTV: getPlatform().isTV,
              autostart: !!o?.run,
              back: () => (nav.diagnostics ? nav.diagnostics({ focusAction: 'gfxtest' }) : nav.options()),
            }),
          );
        },
        () => {
          if (no === navNo) toast("Couldn't load the graphics test.", 5000);
        },
      );
    },
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) playFile(file);
  });

  if (getPlatform().canPlayFiles) setupDrop(playFile);

  void library.refresh();
  void loadCloudIndex(getPlatform().beatmapBase);
  // Web + helper app: find beats of map-less songs in the background (see helperFill.ts).
  const localHelper = getPlatform().localHelper;
  if (localHelper) {
    const fill = createBackgroundFill(getPlatform().beatmapBase, localHelper, () => library.playable().map((s) => s.videoId));
    setBackgroundFill(fill);
    fill.start();
  }
  // TV, first run without a playlist: offer phone linking straight away.
  // `?gfxtest=1` opens the graphics test (`?gfxtest=run` starts it).
  const gfxTest = new URLSearchParams(location.search).get('gfxtest');
  if (gfxTest) nav.graphicsTest?.({ run: gfxTest === 'run' });
  else if (tv && shouldOfferTvLink()) nav.link();
  else nav.home();

  // Each time the remote has been left alone for a moment, one step: build
  // the move catalogue (the biggest single piece), then load the rest of the
  // play chunk, then fill the routine generator's caches a slice at a time.
  // Choosing a song then waits for none of it. (A song chosen sooner loads
  // whatever is missing itself.)
  const quietMs = 1500;
  whenQuiet(() => {
    void import('../core/choreo/moves').then(
      () =>
        whenQuiet(() => {
          void loadChunk().then(
            (m) => runWhenQuiet((budget) => m.warmGenerator(budget), quietMs),
            () => {},
          );
        }, quietMs),
      () => {},
    );
  }, quietMs);
}

/** Reload the page, unless that was already tried in the last minute. True if reloading. */
function reloadOnce(): boolean {
  const KEY = 'dd.chunkReload';
  if (navigator.onLine === false) return false; // offline: a reload would only show an error page
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
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
