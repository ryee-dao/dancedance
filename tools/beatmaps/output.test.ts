import { describe, expect, it } from 'vitest';
import {
  normalizeCookies,
  parseFlatPlaylist,
  parseStatus,
  playlistIdFromUrl,
  renderIndex,
  renderPlaylist,
  renderStatus,
  splitTitle,
} from './output';
import type { VideoStatus } from './select';

const T1 = '2026-11-10T10:00:00.000Z';
const T2 = '2026-11-10T11:00:00.000Z';

describe('renderIndex', () => {
  const info = (bpm: number, duration: number, analyzerVersion = '1.0.0') => ({ analyzerVersion, bpm, duration });
  const maps = (entries: [string, ReturnType<typeof info>][]) => new Map(entries);

  it('sorts IDs and song keys, rounds bpm/duration, and keeps the old timestamp when nothing changed', () => {
    const a = renderIndex(undefined, '1.0.0', maps([['bbbbbbbbbbb', info(170.78, 263.4)], ['aaaaaaaaaaa', info(103.05, 229.6)]]), T1);
    expect(a).toBe(
      JSON.stringify(
        {
          analyzerVersion: '1.0.0',
          generatedAt: T1,
          ids: ['aaaaaaaaaaa', 'bbbbbbbbbbb'],
          songs: { aaaaaaaaaaa: { bpm: 103.1, duration: 230 }, bbbbbbbbbbb: { bpm: 170.8, duration: 263 } },
        },
        null,
        2,
      ) + '\n',
    );
    expect(Object.keys(JSON.parse(a).songs)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    // Same content, later run, different input order: byte-identical.
    expect(renderIndex(a, '1.0.0', maps([['aaaaaaaaaaa', info(103.05, 229.6)], ['bbbbbbbbbbb', info(170.78, 263.4)]]), T2)).toBe(a);
  });
  it('moves the timestamp when IDs, a song BPM or the analyser version change', () => {
    const a = renderIndex(undefined, '1.0.0', maps([['aaaaaaaaaaa', info(120, 200)]]), T1);
    expect(JSON.parse(renderIndex(a, '1.0.0', maps([['aaaaaaaaaaa', info(120, 200)], ['ccccccccccc', info(90, 180)]]), T2)).generatedAt).toBe(T2);
    expect(JSON.parse(renderIndex(a, '1.0.0', maps([['aaaaaaaaaaa', info(121, 200)]]), T2)).generatedAt).toBe(T2);
    expect(JSON.parse(renderIndex(a, '1.1.0', maps([['aaaaaaaaaaa', info(120, 200)]]), T2)).generatedAt).toBe(T2);
  });
  it('rewrites an unreadable previous file', () => {
    expect(JSON.parse(renderIndex('{oops', '1.0.0', new Map(), T2)).generatedAt).toBe(T2);
  });
});

describe('renderStatus', () => {
  const videos: Record<string, VideoStatus> = {
    zzzzzzzzzzz: { state: 'ok', attempts: 1, lastTried: T1 },
    aaaaaaaaaaa: { lastTried: T1, attempts: 2, message: 'nope', reason: 'blocked', state: 'blocked' } as VideoStatus,
  };
  it('has sorted keys and a fixed field order, and is stable across runs', () => {
    const a = renderStatus(undefined, videos, T1);
    expect(Object.keys(JSON.parse(a).videos)).toEqual(['aaaaaaaaaaa', 'zzzzzzzzzzz']);
    expect(Object.keys(JSON.parse(a).videos.aaaaaaaaaaa)).toEqual(['state', 'reason', 'message', 'attempts', 'lastTried']);
    expect(renderStatus(a, parseStatus(a), T2)).toBe(a);
  });
  it('drops message/reason from ok entries', () => {
    const a = renderStatus(undefined, { aaaaaaaaaaa: { state: 'ok', reason: 'error', message: 'old', attempts: 3, lastTried: T1 } }, T1);
    expect(JSON.parse(a).videos.aaaaaaaaaaa).toEqual({ state: 'ok', attempts: 3, lastTried: T1 });
  });
  it('parseStatus ignores junk', () => {
    expect(parseStatus('{"videos":{"a":{"state":"weird"},"b":null,"c":{"state":"ok"}}}')).toEqual({ c: { state: 'ok', attempts: 0, lastTried: '' } });
    expect(parseStatus('not json')).toEqual({});
    expect(parseStatus(undefined)).toEqual({});
  });
});

describe('renderPlaylist', () => {
  it('omits empty artists and is stable', () => {
    const v = [
      { videoId: 'aaaaaaaaaaa', title: 'One', artist: 'Someone' },
      { videoId: 'bbbbbbbbbbb', title: 'Two' },
    ];
    const a = renderPlaylist(undefined, 'PL123', v, T1);
    expect(JSON.parse(a)).toEqual({ updatedAt: T1, playlistId: 'PL123', videos: v });
    expect(renderPlaylist(a, 'PL123', v, T2)).toBe(a);
    expect(JSON.parse(renderPlaylist(a, 'PL123', v.slice(0, 1), T2)).updatedAt).toBe(T2);
  });
});

describe('splitTitle', () => {
  it.each([
    ['Dua Lipa - Levitating (Official Music Video)', 'DuaLipaVEVO', { artist: 'Dua Lipa', title: 'Levitating' }],
    ['The Weeknd - Blinding Lights (Official Audio)', undefined, { artist: 'The Weeknd', title: 'Blinding Lights' }],
    ['a-ha - Take On Me (Official Video) [4K Remastered]', undefined, { artist: 'a-ha', title: 'Take On Me' }],
    ['Espresso', 'Sabrina Carpenter - Topic', { artist: 'Sabrina Carpenter', title: 'Espresso' }],
    ['Flowers (Lyrics)', 'MileyCyrusVEVO', { title: 'Flowers' }],
    ['Song Name', 'Some Channel', { artist: 'Some Channel', title: 'Song Name' }],
  ])('%s', (raw, channel, expected) => {
    expect(splitTitle(raw, channel)).toEqual(expected);
  });
});

describe('parseFlatPlaylist', () => {
  // Shape of `yt-dlp --flat-playlist -J` output (trimmed).
  const json = {
    id: 'PLabcdefghijklmnop',
    title: 'Dance',
    _type: 'playlist',
    entries: [
      { _type: 'url', ie_key: 'Youtube', id: 'TUVcZfQe-Kw', url: 'https://www.youtube.com/watch?v=TUVcZfQe-Kw', title: 'Dua Lipa - Levitating (Official Music Video)', channel: 'Dua Lipa', duration: 243, live_status: null, availability: null },
      { _type: 'url', id: 'xxxxxxxxxxx', title: '[Private video]', duration: null, channel: null },
      { _type: 'url', id: 'yyyyyyyyyyy', title: '[Deleted video]' },
      { _type: 'url', id: 'TUVcZfQe-Kw', title: 'duplicate' },
      { _type: 'url', id: 'jfKfPfyJRdk', title: 'lofi hip hop radio', channel: 'Lofi Girl', live_status: 'is_live' },
      { _type: 'url', id: 'short', title: 'bad id' },
    ],
  };
  it('keeps real videos in order with metadata for the planner', () => {
    const p = parseFlatPlaylist(json);
    expect(p.playlistId).toBe('PLabcdefghijklmnop');
    expect(p.videos).toEqual([
      { videoId: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa' },
      { videoId: 'jfKfPfyJRdk', title: 'lofi hip hop radio', artist: 'Lofi Girl' },
    ]);
    expect(p.candidates[0]).toMatchObject({ videoId: 'TUVcZfQe-Kw', duration: 243, origin: 'playlist' });
    expect(p.candidates[1].liveStatus).toBe('is_live');
  });
  it('tolerates garbage', () => {
    expect(parseFlatPlaylist(null)).toEqual({ playlistId: '', videos: [], candidates: [] });
  });
});

describe('playlistIdFromUrl', () => {
  it('reads list= from links', () => {
    expect(playlistIdFromUrl('https://www.youtube.com/playlist?list=PLabcdefghijk123&si=x')).toBe('PLabcdefghijk123');
    expect(playlistIdFromUrl('https://music.youtube.com/watch?v=TUVcZfQe-Kw&list=PLabcdefghijk123')).toBe('PLabcdefghijk123');
    expect(playlistIdFromUrl('nonsense link')).toBeNull();
  });
});

describe('normalizeCookies', () => {
  it('adds the Netscape header and fixes line endings', () => {
    const t = normalizeCookies('.youtube.com\tTRUE\t/\tTRUE\t0\tPREF\tx\r\n');
    expect(t).toBe('# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tPREF\tx\n');
  });
  it('keeps an existing header', () => {
    expect(normalizeCookies('# Netscape HTTP Cookie File\nline')).toBe('# Netscape HTTP Cookie File\nline\n');
  });
});
