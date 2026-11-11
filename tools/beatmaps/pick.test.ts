import { describe, expect, it } from 'vitest';
import { hipsDontLie, shakeItOff, stayinAlive, takeOnMe } from './pick.fixtures';
import {
  artistVariants,
  cleanRequest,
  coreTokens,
  parseQueue,
  parseSearch,
  rankCandidates,
  searchQueries,
  splitArtistTitle,
  type SearchEntry,
  type SongRequest,
} from './pick';
import { cleanGenre, parseItunes, pickOfficialLength } from './itunes';
import { embedFromStatus } from './youtube';

const e = (o: Partial<SearchEntry> & Pick<SearchEntry, 'id' | 'title' | 'channel'>): SearchEntry => ({
  verified: false,
  views: 1_000_000,
  duration: 200,
  description: '',
  liveStatus: null,
  ...o,
});

const ids = (req: SongRequest, entries: SearchEntry[]) => rankCandidates(req, entries).ranked.map((r) => `${r.tier}:${r.entry.id}`);
const reasonFor = (req: SongRequest, entries: SearchEntry[], id: string) =>
  rankCandidates(req, entries).rejected.find((r) => r.entry.id === id)?.reason;

describe('rankCandidates on real search results', () => {
  it('Shake It Off: original-length lyric videos; never "Taylor\'s Version", fake Topic/label channels or Live Lounge', () => {
    const req = { artist: 'Taylor Swift', title: 'Shake It Off', durationSec: 219 };
    const ranked = ids(req, shakeItOff);
    expect(ranked[0]).toBe('lyric:8xG7mH8i-WE'); // 55 M views, 218 s
    expect(ranked.slice(0, 4)).toEqual(['lyric:8xG7mH8i-WE', 'lyric:Z4A9ZZo_rAE', 'lyric:YytmnsOPWyk', 'lyric:w9uTc7_FB_0']);
    // Official music video (242 s) is only the last resort.
    expect(ranked.at(-1)).toBe('music-video:nfWlot6h_JM');
    // The re-recording, even on the artist's own channel and inside the length window.
    expect(reasonFor(req, shakeItOff, 'mvVBuG4IOW4')).toBe('version');
    expect(reasonFor(req, shakeItOff, 'H59xVMF4zxE')).toBe('version');
    // "Music Topic BR" and "gran republica records": audio uploads by look-alike channels.
    expect(reasonFor(req, shakeItOff, 'w9E7tRTkf5E')).toMatch(/not official/);
    expect(reasonFor(req, shakeItOff, '9M-h3AthyMU')).toMatch(/not official/);
    expect(reasonFor(req, shakeItOff, 'P8ZnjqbOuyc')).toBe('live');
    expect(reasonFor(req, shakeItOff, 'XJSGoZo9888')).toBe('translation');
    expect(reasonFor(req, shakeItOff, 'c-AgYomOouY')).toMatch(/only 122168 views/);
    expect(reasonFor(req, shakeItOff, 'zIOVMHMNfJ4')).toMatch(/length 216/);
  });

  it('asking for "Taylor\'s Version" picks the re-recording instead', () => {
    const req = { artist: 'Taylor Swift', title: "Shake It Off (Taylor's Version)", durationSec: 219 };
    const ranked = ids(req, shakeItOff);
    expect(ranked[0]).toBe('official:mvVBuG4IOW4'); // official lyric video, 225 s
    expect(ranked).toContain('topic:H59xVMF4zxE');
    expect(ranked).not.toContain('lyric:8xG7mH8i-WE');
  });

  it("Stayin' Alive (album length 4:45): lyric videos, then the art track; no fake VEVO, no 10-minute version", () => {
    const req = { artist: 'Bee Gees', title: "Stayin' Alive (From \"Saturday Night Fever\" Soundtrack)", durationSec: 285 };
    expect(ids(req, stayinAlive)).toEqual(['lyric:_Vj092UgKwQ', 'lyric:UMANMEfZtYA', 'topic:GbsFCYEJGZ0']);
    expect(reasonFor(req, stayinAlive, 'orrBiGO-gGs')).toMatch(/not official/); // "TheStruckFernVEVO", unverified
    expect(reasonFor(req, stayinAlive, '8lytDLaMfls')).toMatch(/length 420/); // "Vevo Music Group" "Provided to YouTube"
    expect(reasonFor(req, stayinAlive, 'DY7pipZGUkg')).toBe('version'); // 10:31 disco version
    expect(reasonFor(req, stayinAlive, 'qr-_iuS3EZ8')).toBe('different song');
  });

  it("Stayin' Alive single edit (4:09 requested): the longer film/album versions don't fit", () => {
    const req = { artist: 'Bee Gees', title: "Stayin' Alive", durationSec: 249 };
    const ranked = ids(req, stayinAlive);
    expect(ranked[0]).toBe('lyric:WlgoUlOkyzU'); // 249 s, 20 M views
    expect(ranked).not.toContain('topic:GbsFCYEJGZ0'); // 285 s film version
    expect(ranked).not.toContain('lyric:_Vj092UgKwQ');
    // The music videos (250 s) qualify as a fallback only, most viewed first.
    expect(ranked.filter((r) => r.startsWith('music-video'))).toEqual(['music-video:I_izvAbhExY', 'music-video:fNFzfwLM72c']);
  });

  it("Hips Don't Lie: feat. credits are fine; anniversary version, live and other songs are not", () => {
    const req = { artist: 'Shakira', title: "Hips Don't Lie (feat. Wyclef Jean)", durationSec: 218 };
    const ranked = ids(req, hipsDontLie);
    expect(ranked[0]).toBe('lyric:p3pEe6aAJ4k');
    expect(ranked.at(-1)).toBe('music-video:DUT5rEU6pqM');
    expect(reasonFor(req, hipsDontLie, '41ZY18JqI2A')).toBe('version');
    expect(reasonFor(req, hipsDontLie, '2Ndra-1Pwug')).toBe('live');
    expect(reasonFor(req, hipsDontLie, 'Q0zYjFJhd-4')).toBe('different song'); // "Hips Don't Lie - Bamboo"
  });

  it('Take On Me: lyric videos, then the genuine art track; acoustic channel and symphonic version rejected', () => {
    const req = { artist: 'a-ha', title: 'Take On Me', durationSec: 225 };
    const ranked = ids(req, takeOnMe);
    expect(ranked.slice(0, 2)).toEqual(['lyric:irljBY9J5ig', 'lyric:hGPL5rzd3tQ']);
    expect(ranked).toContain('topic:NaQ083rNUwc');
    expect(reasonFor(req, takeOnMe, 'kmDBDn8Ju6w')).toBe('acoustic channel');
    expect(reasonFor(req, takeOnMe, 'X50VeoRaNmY')).toBe('acoustic');
    expect(reasonFor(req, takeOnMe, '-iKeUC5_Wyw')).toBe('version'); // "Video Version"
  });
});

describe('rankCandidates traps', () => {
  const req = { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 };
  const official = e({ id: 'OFFLYRIC000', title: 'Dua Lipa - Levitating (Official Lyrics Video)', channel: 'Dua Lipa', verified: true, duration: 205, views: 140e6 });
  const officialAudio = e({ id: 'OFFAUDIO000', title: 'Dua Lipa - Levitating (Official Audio)', channel: 'DuaLipaVEVO', verified: true, duration: 204, views: 9e6 });
  const thirdParty = e({ id: 'LYRIC000000', title: 'Dua Lipa - Levitating (Lyrics)', channel: 'ChillTracks', duration: 208, views: 112e6 });
  const topic = e({ id: 'TOPIC000000', title: 'Levitating', channel: 'Dua Lipa', verified: true, duration: 203, views: 80e6, description: 'Provided to YouTube by Warner Records Lev' });

  it('prefers the official lyric video, then official audio, then third-party lyrics, then the art track', () => {
    expect(ids(req, [topic, thirdParty, officialAudio, official])).toEqual([
      'official:OFFLYRIC000',
      'official:OFFAUDIO000',
      'lyric:LYRIC000000',
      'topic:TOPIC000000',
    ]);
  });

  it('a fake "Topic" channel with a tiny view count is not an art track', () => {
    const fake = e({ id: 'FAKETOPIC00', title: 'Levitating', channel: 'Dua Lipa - Topic', duration: 203, views: 1_204, description: 'Provided to YouTube by DistroKid Levitat' });
    expect(reasonFor(req, [fake], 'FAKETOPIC00')).toMatch(/art track with only 1204 views/);
    const elsewhere = e({ id: 'OTHERTOPIC0', title: 'Levitating', channel: 'Pop Hits - Topic', duration: 203, views: 5e6, description: 'Provided to YouTube by Kontor' });
    expect(reasonFor(req, [elsewhere], 'OTHERTOPIC0')).toMatch(/art track from another channel|artist not named/);
  });

  it('channels impersonating the artist are not official', () => {
    const sameName = e({ id: 'IMPOSTER000', title: 'Dua Lipa - Levitating (Official Lyric Video)', channel: 'Dua Lipa', verified: false, duration: 204, views: 40_000 });
    const lookAlike = e({ id: 'LOOKALIKE00', title: 'Dua Lipa - Levitating (Official Audio)', channel: 'Dua Lipá Officiall', verified: false, duration: 204, views: 2e6 });
    const homoglyph = e({ id: 'HOMOGLYPH00', title: 'Dua Lipa - Levitating (Official Audio)', channel: 'DuaLlpaVEVO', verified: true, duration: 204, views: 2e6 });
    expect(reasonFor(req, [sameName], 'IMPOSTER000')).toBe("unverified channel using the artist's name");
    expect(ids(req, [lookAlike, homoglyph])).toEqual([]);
  });

  it('rejects remix, sped up, nightcore, 8D, karaoke, instrumental, 1 hour, extended, clean, reaction, mashup, cover', () => {
    const titles = [
      'Dua Lipa - Levitating (Remix) (Lyrics)',
      'Dua Lipa - Levitating (Sped Up) Lyrics',
      'Nightcore - Levitating (Lyrics)',
      'Dua Lipa - Levitating (8D Audio) Lyrics',
      'Dua Lipa - Levitating (Karaoke Version)',
      'Dua Lipa - Levitating (Instrumental) Lyrics',
      'Dua Lipa - Levitating [1 Hour] Lyrics',
      'Dua Lipa - Levitating (Extended Mix) Lyrics',
      'Dua Lipa - Levitating (Clean) (Lyrics)',
      'Dua Lipa - Levitating REACTION lyrics',
      'Dua Lipa - Levitating / Physical Mashup (Lyrics)',
      'Levitating - Dua Lipa (Cover) Lyrics',
      'Dua Lipa - Levitating (Slowed + Reverb) Lyrics',
      'Dua Lipa - Levitating (Radio Edit) Lyrics',
    ];
    const entries = titles.map((t, i) => e({ id: `BADWORD${String(i).padStart(4, '0')}`, title: t, channel: 'Some Lyrics', duration: 204 }));
    expect(ids(req, entries)).toEqual([]);
  });

  it('rejects another artist\'s song of the same name and a different song containing the title', () => {
    const other = e({ id: 'OTHERART000', title: 'Olivia Newton-John - Levitating (Lyrics)', channel: 'Lyrics Hub', duration: 204 });
    const longer = e({ id: 'LONGER00000', title: 'Dua Lipa - Levitating Again (Lyrics)', channel: 'Lyrics Hub', duration: 204 });
    expect(reasonFor(req, [other], 'OTHERART000')).toBe('different artist');
    expect(reasonFor(req, [longer], 'LONGER00000')).toBe('different song or artist');
  });

  it('keeps words that are part of the requested song ("Live", "Remix", "Clean")', () => {
    const live = { artist: 'Oasis', title: 'Live Forever', durationSec: 276 };
    expect(ids(live, [e({ id: 'LIVEFOREVER', title: 'Oasis - Live Forever (Lyrics)', channel: 'Lyrics', duration: 277 })])).toEqual(['lyric:LIVEFOREVER']);
    const clean = { artist: 'Clean Bandit', title: 'Rather Be (feat. Jess Glynne)', durationSec: 228 };
    expect(ids(clean, [e({ id: 'RATHERBE000', title: 'Clean Bandit - Rather Be ft. Jess Glynne (Lyrics)', channel: 'Lyrics', duration: 228 })])).toEqual([
      'lyric:RATHERBE000',
    ]);
  });

  it('length window is -1 .. +6 s (music-video fallback -2 .. +60 s)', () => {
    const at = (d: number, i: number) => e({ id: `LEN${String(i).padStart(8, '0')}`, title: 'Dua Lipa - Levitating (Lyrics)', channel: 'Lyrics', duration: d });
    expect(ids(req, [at(201, 1), at(202, 2), at(209, 3), at(210, 4)])).toEqual(['lyric:LEN00000002', 'lyric:LEN00000003']);
    const mv = (d: number, i: number) => e({ id: `MV${String(i).padStart(9, '0')}`, title: 'Dua Lipa - Levitating (Official Music Video)', channel: 'Dua Lipa', verified: true, duration: d });
    expect(ids(req, [mv(270, 1), mv(240, 2), mv(215, 3)])).toEqual(['music-video:MV000000003', 'music-video:MV000000002']);
  });

  it('skips live streams and entries without a length', () => {
    expect(ids(req, [{ ...thirdParty, liveStatus: 'is_live' }, { ...official, duration: null }])).toEqual([]);
  });
});

describe('helpers', () => {
  it('parses yt-dlp flat search JSON', () => {
    const out = parseSearch({
      entries: [
        { id: 'abcdefghijk', title: 'A - B (Lyrics)', channel: 'Chan', channel_is_verified: true, view_count: 5, duration: 200, description: 'x' },
        { id: 'abcdefghijk', title: 'dup' },
        { id: 'short', title: 'bad id' },
        { id: 'lmnopqrstuv', title: 'C', uploader: 'Up', live_status: 'is_live' },
      ],
    });
    expect(out).toEqual([
      { id: 'abcdefghijk', title: 'A - B (Lyrics)', channel: 'Chan', verified: true, views: 5, duration: 200, description: 'x', liveStatus: null },
      { id: 'lmnopqrstuv', title: 'C', channel: 'Up', verified: false, views: null, duration: null, description: '', liveStatus: 'is_live' },
    ]);
    expect(parseSearch(null)).toEqual([]);
  });

  it('builds the two search queries without feat./soundtrack noise but with versions', () => {
    expect(searchQueries({ artist: 'Shakira', title: "Hips Don't Lie (feat. Wyclef Jean)" })).toEqual([
      "Shakira Hips Don't Lie lyrics",
      "Shakira Hips Don't Lie official audio",
    ]);
    expect(searchQueries({ artist: 'Taylor Swift', title: "Shake It Off (Taylor's Version)" })[0]).toBe("Taylor Swift Shake It Off (Taylor's Version) lyrics");
  });

  it('title and artist normalisation', () => {
    expect(coreTokens('Shake It Off - Taylor Swift (Lyrics) 🎵')).toEqual(['shake', 'it', 'off', 'taylor', 'swift']);
    expect(coreTokens('Chappell Roan - HOT TO GO! (Lyrics) "you can take me hot to go"')).toEqual(['chappell', 'roan', 'hot', 'to', 'go']);
    expect(artistVariants('ROSÉ & Bruno Mars')).toEqual(['rosebrunomars', 'rose', 'brunomars']);
    expect(artistVariants('Earth, Wind & Fire')).toEqual(['earthwindfire', 'earth']);
  });

  it('validates requests from the workflow, the CLI and the app queue', () => {
    expect(cleanRequest(' a-ha ', ' Take  On Me ', '225')).toEqual({ artist: 'a-ha', title: 'Take On Me', durationSec: 225 });
    expect(cleanRequest('a-ha', 'Take On Me', '')).toEqual({ artist: 'a-ha', title: 'Take On Me' });
    expect(cleanRequest('a-ha', 'Take On Me', '99999')).toEqual({ artist: 'a-ha', title: 'Take On Me' });
    expect(cleanRequest('', 'x')).toBeNull();
    expect(cleanRequest('a\nb', 'x')).toEqual({ artist: 'a b', title: 'x' });
    expect(cleanRequest('a\u0000b', 'x')).toBeNull();
    expect(cleanRequest('a'.repeat(201), 'x')).toBeNull();
    expect(splitArtistTitle('a-ha - Take On Me')).toEqual({ artist: 'a-ha', title: 'Take On Me' });
    expect(splitArtistTitle('no separator')).toBeNull();
    expect(parseQueue('[{"artist":"A","title":"B","duration":200},{"artist":""},5]')).toEqual([{ artist: 'A', title: 'B', durationSec: 200 }]);
    expect(parseQueue('not json')).toEqual([]);
    expect(parseQueue(JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ artist: 'A', title: `T${i}` }))))).toHaveLength(10);
  });

  it('maps oEmbed statuses', () => {
    expect([200, 401, 403, 404, 400, 500, 429].map(embedFromStatus)).toEqual(['ok', 'disabled', 'disabled', 'gone', 'gone', 'unknown', 'unknown']);
  });
});

describe('official length from iTunes', () => {
  const tracks = parseItunes({
    results: [
      { artistName: 'Taylor Swift', trackName: 'Shake It Off', collectionName: '1989', trackTimeMillis: 219209, releaseDate: '2014-08-19T07:00:00Z' },
      { artistName: 'Taylor Swift', trackName: "Shake It Off (Taylor's Version)", collectionName: "1989 (Taylor's Version)", trackTimeMillis: 219209, releaseDate: '2023-10-27T12:00:00Z' },
      { artistName: 'Mariah Carey', trackName: 'Shake It Off', collectionName: 'The Emancipation Of Mimi', trackTimeMillis: 232840, releaseDate: '2005-04-12T07:00:00Z' },
      { artistName: 'KIDZ BOP Kids', trackName: 'Shake It Off', collectionName: 'KIDZ BOP Greatest Hits!', trackTimeMillis: 208970 },
      { artistName: 'Taylor Swift', trackName: 'Shake It Off', collectionName: '1989 (Deluxe Edition)', trackTimeMillis: 219200, releaseDate: '2014-08-19T07:00:00Z' },
      { artistName: 'Taylor Swift', trackName: 'Shake It Off (Live)', collectionName: 'Tour', trackTimeMillis: 260000 },
      { nope: true },
    ],
  });
  it('picks the original by the requested artist', () => {
    expect(pickOfficialLength({ artist: 'taylor swift', title: 'shake it off' }, tracks)).toEqual({ artist: 'Taylor Swift', title: 'Shake It Off', durationSec: 219 });
    expect(pickOfficialLength({ artist: 'Mariah Carey', title: 'Shake It Off' }, tracks)?.durationSec).toBe(233);
    expect(pickOfficialLength({ artist: 'Taylor Swift', title: "Shake It Off (Taylor's Version)" }, tracks)?.title).toBe("Shake It Off (Taylor's Version)");
    expect(pickOfficialLength({ artist: 'Nobody', title: 'Shake It Off' }, tracks)).toBeNull();
  });
  it('prefers plain titles and the most common length', () => {
    const t = parseItunes({
      results: [
        { artistName: 'a-ha', trackName: 'Take On Me (2015 Remastered)', trackTimeMillis: 229000, releaseDate: '1985-06-01T00:00:00Z' },
        { artistName: 'a-ha', trackName: 'Take On Me (2015 Remastered)', trackTimeMillis: 229100, releaseDate: '1985-06-01T00:00:00Z' },
        { artistName: 'a-ha', trackName: 'Take On Me', trackTimeMillis: 225400, releaseDate: '1985-06-01T00:00:00Z' },
      ],
    });
    expect(pickOfficialLength({ artist: 'a-ha', title: 'Take On Me' }, t)).toEqual({ artist: 'a-ha', title: 'Take On Me', durationSec: 225 });
  });
  it('captures the primary genre when iTunes gives one', () => {
    const t = parseItunes({
      results: [
        { artistName: 'Shakira', trackName: "Hips Don't Lie (feat. Wyclef Jean)", trackTimeMillis: 218000, releaseDate: '2006-02-28T00:00:00Z', primaryGenreName: 'Pop' },
        { artistName: 'Shakira', trackName: "Hips Don't Lie", trackTimeMillis: 218100, releaseDate: '2006-02-28T00:00:00Z', primaryGenreName: ' Latin  Pop ' },
      ],
    });
    expect(pickOfficialLength({ artist: 'Shakira', title: "Hips Don't Lie" }, t)).toEqual({ artist: 'Shakira', title: "Hips Don't Lie", durationSec: 218, genre: 'Latin Pop' });
    // No genre on the chosen track: borrow one from the same cluster; none at all: no field.
    const u = parseItunes({ results: [{ artistName: 'a-ha', trackName: 'Take On Me', trackTimeMillis: 225400 }, { artistName: 'a-ha', trackName: 'Take On Me', trackTimeMillis: 225000, primaryGenreName: 'Pop', releaseDate: '2000-01-01T00:00:00Z' }] });
    expect(pickOfficialLength({ artist: 'a-ha', title: 'Take On Me' }, u)?.genre).toBe('Pop');
    expect(cleanGenre(42)).toBeUndefined();
    expect(cleanGenre('   ')).toBeUndefined();
    expect(cleanGenre('x'.repeat(61))).toBeUndefined();
  });
});
