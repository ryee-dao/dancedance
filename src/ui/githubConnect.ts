/**
 * How the web app is allowed to add songs, and sending a song to the cloud
 * job. Two ways, the relay preferred when configured:
 *   relay - a Cloudflare Worker (cloudflare/add-song-worker) holds the GitHub
 *           token; the app sends only an iTunes track ID. Its address comes
 *           from VITE_ADD_SONG_URL at build time, or is typed once (dd.addRelay).
 *   token - a fine-grained GitHub token pasted into this browser
 *           (dd.githubToken), sent only to api.github.com.
 */

import { songKey } from '../beat/cloud';
import {
  checkTokenShape,
  dispatchAddSong,
  parseRepo,
  repoString,
  resolveRepo,
  type RepoRef,
  type RepoSource,
} from '../platform/github';
import { parseRelayUrl, relayAdd, relayHealth } from '../platform/relay';
import { store, type PendingAdd } from '../store';
import { addedSongs } from './addedSongs';
import { h } from './dom';
import { focusEl, popScope, pushScope, type Scope } from './focusNav';

export interface Connection {
  relay: string | null;
  relaySource: 'build' | 'saved' | null;
  repo: RepoRef | null;
  repoSource: RepoSource | null;
  token: string | null;
}

export function githubConnection(): Connection {
  const builtRelay = parseRelayUrl(import.meta.env.VITE_ADD_SONG_URL as string | undefined);
  const savedRelay = parseRelayUrl(store.addRelay());
  const r = resolveRepo({
    location: typeof location !== 'undefined' ? { hostname: location.hostname, pathname: location.pathname } : undefined,
    envRepo: import.meta.env.VITE_GITHUB_REPO as string | undefined,
    saved: store.githubRepo(),
  });
  return {
    relay: builtRelay ?? savedRelay,
    relaySource: builtRelay ? 'build' : savedRelay ? 'saved' : null,
    repo: r?.repo ?? null,
    repoSource: r?.source ?? null,
    token: store.githubToken(),
  };
}

export function isConnected(c: Connection = githubConnection()): boolean {
  return !!c.relay || (!!c.repo && !!c.token);
}

/** One line for Options / the search screen. */
export function connectionLabel(c: Connection = githubConnection()): string | null {
  if (c.relay) return `Songs are added through your relay (${new URL(c.relay).host}).`;
  if (c.repo && c.token) return `Connected to GitHub (${repoString(c.repo)}).`;
  return null;
}

/** Forget everything typed into this browser: token, repository, relay address, passphrase. */
export function disconnectGithub(): void {
  store.setGithubToken(null);
  store.setGithubRepo(null);
  store.setAddRelay(null);
  store.setAddPassphrase(null);
}

export type SendResult =
  | { ok: true; key: string }
  | {
      ok: false;
      error: string;
      message: string;
      /** What the UI should ask for before trying again. */
      needs?: 'connect' | 'passphrase';
    };

/** Start the cloud job for this song; on success it shows as pending on the home screen. */
export async function sendSong(song: Omit<PendingAdd, 'sentAt'>): Promise<SendResult> {
  const c = githubConnection();
  const others = addedSongs.queueFor(song.key);
  if (c.relay) {
    if (!song.trackId) return { ok: false, error: 'no-track', message: 'Search for this song again to add it through the relay.' };
    const res = await relayAdd(c.relay, song.trackId, others.map((p) => p.trackId).filter((x): x is number => !!x), store.addPassphrase());
    if (!res.ok) return { ok: false, error: res.error, message: res.message, ...(res.error === 'passphrase' ? { needs: 'passphrase' as const } : {}) };
    // Apple's names, exactly as the job will write them to songs.json.
    const key = songKey(res.song.artist, res.song.title);
    addedSongs.addPending({ ...song, key, artist: res.song.artist, title: res.song.title, durationSec: res.song.durationSec, sentAt: Date.now() });
    return { ok: true, key };
  }
  if (!c.repo || !c.token) return { ok: false, error: 'not-connected', message: 'Connect to GitHub first.', needs: 'connect' };
  const res = await dispatchAddSong(c.token, c.repo, song, others);
  if (!res.ok) {
    const reconnect = res.error === 'auth' || res.error === 'permission' || res.error === 'not-found';
    return { ok: false, error: res.error, message: res.message, ...(reconnect ? { needs: 'connect' as const } : {}) };
  }
  addedSongs.addPending({ ...song, sentAt: Date.now() });
  return { ok: true, key: song.key };
}

export interface ConnectDialogOptions {
  parent: HTMLElement;
  returnFocus: HTMLElement | null;
  /** Shown above the form, e.g. why the last attempt failed. */
  message?: string;
  submitLabel?: string;
  /** 'passphrase': only ask for the relay passphrase. Default: the full connect step. */
  mode?: 'connect' | 'passphrase';
  /** Called after the token is saved (not called on cancel). */
  onConnected(): void;
}

const TOKEN_STEPS =
  'On GitHub: Settings → Developer settings → Fine-grained tokens → Generate new token. Repository access: only this repository. Repository permissions → Actions: Read and write.';

/**
 * The "Connect to GitHub" step as a dialog ('connect'), or just the relay
 * passphrase ('passphrase'). Returns a function that closes it.
 */
export function openConnectDialog(o: ConnectDialogOptions): () => void {
  const c = githubConnection();
  const mode = o.mode ?? (c.relaySource === 'build' ? 'passphrase' : 'connect');
  const askRepo = !c.repo || c.repoSource === 'saved';
  const input = (id: string, type: string, placeholder: string) =>
    h('input', { id, class: 'text-input', type, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder, 'aria-describedby': 'gh-msg' });
  const relay = input('gh-relay', 'url', 'https://dancedance-add-song.you.workers.dev');
  const pass = input('gh-pass', 'password', mode === 'passphrase' ? 'Passphrase' : 'Only if your relay has one');
  const token = input('gh-token', 'password', 'github_pat_…');
  const repo = input('gh-repo', 'text', 'your-username/dancedance');
  if (c.relaySource === 'saved' && c.relay) relay.value = c.relay;
  if (c.repo) repo.value = repoString(c.repo);
  const msg = h('p', { id: 'gh-msg', class: 'form-msg', role: 'alert' }, o.message ?? '');
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, o.submitLabel ?? (mode === 'passphrase' ? 'Save' : 'Connect'));
  const help = c.repo
    ? h('a', { class: 'inline-link', href: `https://github.com/${c.repo.owner}/${c.repo.repo}#adding-a-song-by-search`, target: '_blank', rel: 'noopener noreferrer' }, 'Step-by-step guide')
    : null;
  const buttons = h('div', { class: 'form-row' }, submit, h('button', { class: 'btn', type: 'button', 'data-action': 'cancel' }, 'Cancel'));
  const form =
    mode === 'passphrase'
      ? h('form', { class: 'connect-form', novalidate: true }, h('label', { class: 'field-label', for: 'gh-pass' }, 'Relay passphrase'), pass, msg, buttons)
      : h(
          'form',
          { class: 'connect-form', novalidate: true },
          h('fieldset', { class: 'connect-way' },
            h('legend', { class: 'connect-legend' }, 'Through your relay'),
            h('label', { class: 'field-label', for: 'gh-relay' }, 'Relay address'),
            relay,
            h('label', { class: 'field-label field-gap', for: 'gh-pass' }, 'Passphrase'),
            pass,
          ),
          h('p', { class: 'connect-or' }, 'or'),
          h('fieldset', { class: 'connect-way' },
            h('legend', { class: 'connect-legend' }, 'With a GitHub token'),
            h('p', { class: 'dialog-help' }, TOKEN_STEPS, ' ', help),
            h('label', { class: 'field-label', for: 'gh-token' }, 'GitHub token'),
            token,
            askRepo && h('label', { class: 'field-label field-gap', for: 'gh-repo' }, 'Repository (owner/name)'),
            askRepo && repo,
          ),
          msg,
          buttons,
        );
  const card = h(
    'div',
    { class: 'picker-card dialog-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gh-title' },
    h('h2', { id: 'gh-title', class: 'dialog-title' }, mode === 'passphrase' ? 'Relay passphrase' : 'Connect to GitHub'),
    h(
      'p',
      { class: 'dialog-text' },
      mode === 'passphrase'
        ? 'Your relay asks for a passphrase before it adds songs. Type it once; it is stored only in this browser.'
        : 'Songs are added by the beat-map job in your GitHub repository. If you set up the optional Cloudflare relay, paste its address and nothing secret is kept here; otherwise paste a GitHub token that can only run this repository’s jobs, stored only in this browser.',
    ),
    form,
  );
  const root = h('div', { class: 'picker-backdrop' }, card);
  let open = true;
  let busy = false;
  const close = (refocus: boolean) => {
    if (!open) return;
    open = false;
    token.value = '';
    pass.value = '';
    popScope(scope);
    root.remove();
    if (refocus && o.returnFocus?.isConnected) focusEl(o.returnFocus, { instant: true });
  };
  const scope: Scope = { root, onBack: () => close(true), defaultFocus: () => (mode === 'passphrase' ? pass : relay) };
  const done = () => {
    close(false);
    o.onConnected();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    msg.textContent = '';
    if (mode === 'passphrase') {
      if (!pass.value) {
        msg.textContent = 'Type the passphrase first.';
        return;
      }
      store.setAddPassphrase(pass.value);
      done();
      return;
    }
    if (relay.value.trim()) {
      const url = parseRelayUrl(relay.value);
      if (!url) {
        msg.textContent = 'The relay address should start with https://, for example https://dancedance-add-song.you.workers.dev';
        relay.focus();
        return;
      }
      busy = true;
      submit.textContent = 'Checking…';
      const health = await relayHealth(url);
      busy = false;
      submit.textContent = o.submitLabel ?? 'Connect';
      if (!open) return;
      if (!health) {
        msg.textContent = 'Couldn’t reach the relay at that address, or it doesn’t accept this site. Check the address and ALLOWED_ORIGINS.';
        return;
      }
      if (!health.ok) {
        msg.textContent = 'The relay answered, but it isn’t set up yet: it needs GITHUB_REPO and the GITHUB_TOKEN secret.';
        return;
      }
      if (health.passphrase && !pass.value) {
        msg.textContent = 'This relay needs its passphrase.';
        pass.focus();
        return;
      }
      store.setAddRelay(url);
      store.setAddPassphrase(pass.value || null);
      done();
      return;
    }
    const t = checkTokenShape(token.value);
    if (!t.ok) {
      msg.textContent = token.value.trim() ? t.message : 'Paste a relay address or a GitHub token.';
      token.focus();
      return;
    }
    if (askRepo) {
      const r = parseRepo(repo.value);
      if (!r) {
        msg.textContent = 'Type the repository as owner/name, for example jo/dancedance.';
        repo.focus();
        return;
      }
      store.setGithubRepo(repoString(r));
    }
    store.setGithubToken(t.token);
    done();
  });
  root.addEventListener('click', (e) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest('[data-action="cancel"]')) close(true);
    else if (!card.contains(e.target as Node)) close(true);
  });
  o.parent.appendChild(root);
  pushScope(scope);
  return () => close(true);
}
