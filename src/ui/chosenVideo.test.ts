/**
 * "Paste a YouTube link" in the web app: link parsing, the request bodies (relay and direct
 * GitHub token), the songs-status.json states the app reads, and the pending cards' states.
 */
import { describe, expect, it } from 'vitest';
import { parseSongsList, parseSongsStatus, songKey } from '../beat/cloud';
import { dispatchRequest } from '../platform/github';
import { explainRelayError, relayAdd, relayBody, RELAY_MAX_BODY_BYTES, RELAY_VIDEO_VERSION } from '../platform/relay';
import { RELAY_VERSION } from '../platform/pipelineHealth';
import { parseVideoLink } from '../player/playlistReader';
import { reconcile, WAITING_FOR_PERSON } from './addedSongs';

const ID = '8O7yWgX6--4';

describe('parseVideoLink', () => {
  it('reads the video ID from every common link form', () => {
    for (const link of [
      ID,
      `https://www.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/watch?v=${ID}&list=RD${ID}&start_radio=1`,
      `https://www.youtube.com/watch?list=PL123&v=${ID}&t=42s`,
      `youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}?si=abcDEF123`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://music.youtube.com/watch?v=${ID}&feature=share`,
      `https://www.youtube.com/embed/${ID}?autoplay=1`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `  ${ID}  `,
    ]) {
      expect(parseVideoLink(link), link).toEqual({ ok: true, videoId: ID });
    }
  });
  it('says plainly what is wrong otherwise', () => {
    expect(parseVideoLink('')).toEqual({ ok: false, error: 'Paste a YouTube video link first.' });
    expect(parseVideoLink('https://vimeo.com/12345')).toMatchObject({ ok: false, error: expect.stringMatching(/isn't a YouTube link/) });
    expect(parseVideoLink('https://www.youtube.com/playlist?list=PL0123456789abcdef')).toMatchObject({ ok: false, error: expect.stringMatching(/playlist/) });
    expect(parseVideoLink('https://www.youtube.com/watch?v=tooShort')).toMatchObject({ ok: false, error: "That link doesn't point to a YouTube video." });
    expect(parseVideoLink('https://www.youtube.com/@bassnectar')).toMatchObject({ ok: false });
    expect(parseVideoLink('javascript:alert(1)')).toMatchObject({ ok: false });
    expect(parseVideoLink('the 808 track')).toMatchObject({ ok: false });
  });
});

describe('requests with a chosen video', () => {
  const song = { trackId: 5, artist: 'Bassnectar', title: 'The 808 Track (feat. Mighty High Coup)', durationSec: 271 };
  it('relay body: video and force for the song and queued songs; a queued song with a video never goes by ID only', () => {
    const body = JSON.parse(relayBody({ ...song, videoId: ID, force: true }, [{ trackId: 6, artist: 'A', title: 'B', durationSec: 200, videoId: '3Mq0VpLSnwc' }, { trackId: 7, artist: 'C', title: 'D', durationSec: 200 }]));
    expect(body).toEqual({
      trackId: 5,
      song: { artist: song.artist, title: song.title, durationSec: 271 },
      video: ID,
      force: true,
      queue: [
        { trackId: 6, song: { artist: 'A', title: 'B', durationSec: 200 }, video: '3Mq0VpLSnwc' },
        { trackId: 7, song: { artist: 'C', title: 'D', durationSec: 200 } },
      ],
    });
    expect(JSON.parse(relayBody(song, []))).not.toHaveProperty('video');
    expect(JSON.parse(relayBody({ ...song, videoId: 'bad' }, []))).not.toHaveProperty('video');
    // Full: queued songs with a video go with their video but without details, or wait for the next send.
    const long = 'x'.repeat(190);
    const queue = Array.from({ length: 9 }, (_, i) => ({ trackId: 100 + i, artist: long, title: long, durationSec: 200, videoId: ID }));
    const text = relayBody(song, queue);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(RELAY_MAX_BODY_BYTES);
    for (const q of JSON.parse(text).queue) expect(typeof q === 'object' && q.video).toBe(ID);
  });
  it('relay answer: the forwarded video is echoed; an older relay’s answer has none', async () => {
    const reply = (body: unknown) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    const ok = { ok: true, song: { artist: 'Bassnectar', title: 'T', durationSec: 271 } };
    expect(await relayAdd('https://r', { ...song, videoId: ID }, [], null, reply({ ...ok, video: ID }))).toMatchObject({ ok: true, video: ID });
    expect(await relayAdd('https://r', { ...song, videoId: ID }, [], null, reply(ok))).not.toHaveProperty('video');
    expect(explainRelayError('bad-request', 'video').message).toMatch(/YouTube link/);
  });
  it('direct GitHub token: the same inputs as the relay sends', () => {
    const { init } = dispatchRequest('t', { owner: 'jo', repo: 'dd' }, { ...song, videoId: ID, force: true }, [{ artist: 'A', title: 'B', durationSec: 200, videoId: '3Mq0VpLSnwc' }, { artist: 'C', title: 'D', durationSec: 200 }]);
    const inputs = JSON.parse(String(init.body)).inputs;
    expect(inputs).toEqual({
      add_artist: song.artist,
      add_title: song.title,
      add_duration: '271',
      add_video: ID,
      add_video_force: 'true',
      add_queue: JSON.stringify([{ artist: 'A', title: 'B', duration: 200, video: '3Mq0VpLSnwc' }, { artist: 'C', title: 'D', duration: 200 }]),
    });
    const plain = JSON.parse(String(dispatchRequest('t', { owner: 'jo', repo: 'dd' }, song, []).init.body)).inputs;
    expect(Object.keys(plain).sort()).toEqual(['add_artist', 'add_duration', 'add_title']);
  });
  it('the app needs relay version 3 for links', () => {
    expect(RELAY_VIDEO_VERSION).toBe(3);
    expect(RELAY_VERSION).toBeGreaterThanOrEqual(RELAY_VIDEO_VERSION);
  });
});

describe('what the app reads', () => {
  it('songs-status.json: video-mismatch with its video, force only with a video; songs.json user-video notes', () => {
    const st = parseSongsStatus(JSON.stringify({ requests: {
      a: { state: 'video-mismatch', artist: 'A', title: 'T', videoId: ID, message: 'This video is 5:14 but the song is 4:31.', attempts: 1, lastTried: 'x' },
      b: { state: 'blocked', artist: 'A', title: 'U', videoId: ID, force: true, attempts: 1, lastTried: 'x' },
      c: { state: 'blocked', artist: 'A', title: 'V', force: true, attempts: 1, lastTried: 'x' },
      d: { state: 'something-new', artist: 'A', title: 'W', attempts: 1, lastTried: 'x' },
    } }));
    expect(st.a).toMatchObject({ state: 'video-mismatch', videoId: ID });
    expect(st.b.force).toBe(true);
    expect(st.c).not.toHaveProperty('force');
    expect(st).not.toHaveProperty('d');
    const songs = parseSongsList(JSON.stringify({ songs: ['user-video', 'user-video-forced', 'odd'].map((note, i) => ({ videoId: `${ID.slice(0, 10)}${i}`, title: 'T', artist: 'A', note })) }));
    expect(songs.map((s) => s.note)).toEqual(['user-video', 'user-video-forced', undefined]);
  });
  it('pending cards: not found offers a link; a mismatch asks "Use it anyway"; neither is polled or re-sent with others', () => {
    const T = Date.parse('2026-11-10T12:00:00Z');
    const key = songKey('Bassnectar', 'The 808 Track');
    const p = { key, artist: 'Bassnectar', title: 'The 808 Track', durationSec: 271, sentAt: T };
    const st = (o: Record<string, unknown>) => ({ [key]: { artist: 'Bassnectar', title: 'The 808 Track', attempts: 1, lastTried: '2026-11-10T12:03:00Z', ...o } as never });
    expect(reconcile([p], [], st({ state: 'not-found', message: 'No video.' }), T).views[0]).toMatchObject({ state: 'failed', canPaste: true });
    const check = reconcile([{ ...p, videoId: '3Mq0VpLSnwc' }], [], st({ state: 'video-mismatch', videoId: '3Mq0VpLSnwc', message: 'This video is 5:14 but the song is 4:31.' }), T).views[0];
    expect(check).toMatchObject({ state: 'check', canPaste: true, checkedVideo: '3Mq0VpLSnwc', message: 'This video is 5:14 but the song is 4:31.' });
    // An answer about another video (an older paste) doesn't count for this one.
    expect(reconcile([{ ...p, videoId: ID }], [], st({ state: 'video-mismatch', videoId: '3Mq0VpLSnwc' }), T).views[0].state).toBe('waiting');
    // After "Use it anyway" (sent later), the old answer is stale.
    expect(reconcile([{ ...p, videoId: '3Mq0VpLSnwc', force: true, sentAt: T + 3_600_000 }], [], st({ state: 'video-mismatch', videoId: '3Mq0VpLSnwc' }), T + 3_600_000).views[0].state).toBe('waiting');
    expect(reconcile([p], [], st({ state: 'blocked', videoId: ID }), T).views[0].state).toBe('retrying');
    // A link pasted a moment after "not found": that answer was about the search, not this video.
    expect(reconcile([{ ...p, videoId: ID }], [], st({ state: 'not-found', message: 'No video.' }), T).views[0].state).toBe('waiting');
    expect(reconcile([{ ...p, videoId: ID }], [], st({ state: 'not-found', videoId: ID, message: 'Removed.' }), T).views[0]).toMatchObject({ state: 'failed', checkedVideo: ID });
    // "Use it anyway" a moment after the warning: the warning is not shown again.
    expect(reconcile([{ ...p, videoId: ID, force: true }], [], st({ state: 'video-mismatch', videoId: ID }), T).views[0].state).toBe('waiting');
    expect(WAITING_FOR_PERSON).toEqual(['failed', 'check']);
  });
});
