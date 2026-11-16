/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KOTLIN_FIXTURES, kotlinFixtures } from './pickFixturesKotlin';
import {
  bunny,
  delilah,
  dipped,
  extravagantEscalations,
  heavyMetal,
  hipsDontLie,
  homertonB,
  impersonator,
  insane,
  nowThatWeFoundLove,
  nullification,
  purloin,
  queTeVas,
  quieroSerTuyo,
  rapSavedMe,
  runAway,
  shakeItOff,
  stayinAlive,
  takeOnMe,
  touTou,
  wayoo,
  youLie,
} from './pick.fixtures';
import {
  ALT_WINDOW,
  artistVariants,
  cleanRequest,
  coreTokens,
  degradedSearch,
  fallbackQuery,
  parseQueue,
  parseSearch,
  rankCandidates,
  searchQueries,
  splitArtistTitle,
  type SearchEntry,
  type SongRequest,
  WINDOW,
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

describe('rankCandidates on real search results: cases that used to be "not found"', () => {
  it('Rap Saved Me: the official upload writes the title in double quotes', () => {
    const req = { artist: '21 Savage, Offset & Metro Boomin', title: 'Rap Saved Me (feat. Quavo)', durationSec: 258 };
    expect(ids(req, rapSavedMe)).toEqual(['official:LK9rgGmrH7I']);
    // Look-alikes in the same results stay out.
    expect(reasonFor(req, rapSavedMe, '1u_Fz7opf-M')).toBe("unverified channel using the artist's name"); // "21SavageVEVO"
    expect(reasonFor(req, rapSavedMe, 'r-sK4jS8w8Y')).toBe('art track with only 534 views'); // fake "21 Savage - Topic"
    expect(reasonFor(req, rapSavedMe, 'YQbpiY2uXmI')).toBe('other media'); // 432 Hz
    expect(reasonFor(req, rapSavedMe, 'ywAJSXADr3w')).toBe('translation'); // 가사/ 해석
    expect(reasonFor(req, rapSavedMe, 'LPTlvQ1Zet0')).toBe('different song or artist');
    expect(reasonFor(req, rapSavedMe, 'WQL6zlobUJg')).toMatch(/not official/); // label upload titled with the album
  });

  it('quoted text: the quoted song title counts; a quoted other song, a longer title or an appended lyric line do not', () => {
    const req = { artist: '21 Savage, Offset & Metro Boomin', title: 'Rap Saved Me (feat. Quavo)', durationSec: 258 };
    const up = (id: string, title: string) => e({ id, title, channel: '21 Savage', verified: true, duration: 258 });
    expect(ids(req, [up('QUOTEDCURLY', '21 Savage – “Rap Saved Me” (Official Audio)')])).toEqual(['official:QUOTEDCURLY']);
    expect(ids(req, [up('QUOTEDNODSH', '21 Savage "Rap Saved Me" (Official Audio)')])).toEqual(['official:QUOTEDNODSH']);
    expect(reasonFor(req, [up('QUOTEDOTHER', '21 Savage, Offset & Metro Boomin - "Ric Flair Drip" (Official Audio)')], 'QUOTEDOTHER')).toBe('different song or artist');
    expect(reasonFor(req, [up('QUOTEDLONGR', '21 Savage - "Rap Saved Me Again" (Official Audio)')], 'QUOTEDLONGR')).toBe('different song or artist');
    expect(reasonFor(req, [up('QUOTEDLIVE0', '21 Savage - "Rap Saved Me" (Live) (Official Audio)')], 'QUOTEDLIVE0')).toBe('live');
    const hot = { artist: 'Chappell Roan', title: 'HOT TO GO!', durationSec: 184 };
    const lyricLine = e({ id: 'HOTTOGOLINE', title: 'Chappell Roan - HOT TO GO! (Lyrics) "you can take me hot to go"', channel: 'Lyrics', duration: 185 });
    expect(ids(hot, [lyricLine])).toEqual(['lyric:HOTTOGOLINE']);
    // The quoted lyric line is not the title of another song either.
    expect(reasonFor({ ...hot, title: 'You Can Take Me Hot To Go' }, [lyricLine], 'HOTTOGOLINE')).toBe('different song or artist');
  });

  it("Delilah (pull me out of this): the song title's own brackets don't stop the official upload counting as its video", () => {
    const req = { artist: 'Fred again.. & Delilah Montagu', title: 'Delilah (pull me out of this)', durationSec: 251 };
    expect(ids(req, delilah)).toEqual(['music-video:Cl6Rz1Uvi2M']);
    expect(reasonFor(req, delilah, 'd943B3MUlbg')).toBe('acoustic'); // orchestra version
    expect(reasonFor(req, delilah, '7ZXRc-tTehE')).toBe('acoustic');
    // Any other bracket still means "not the plain upload".
    const session = e({ id: 'PARISSESSN0', title: 'Fred again.. - Delilah (pull me out of this) (Paris Session)', channel: 'Fred again . .', verified: true, duration: 255 });
    expect(reasonFor(req, [session], 'PARISSESSN0')).toBe('official upload, but not lyric/audio');
  });

  it('Quiero Ser Tuyo: "Letra" is a lyric video; karaoke and a -2 s upload stay out', () => {
    const req = { artist: 'Tito Rojas', title: 'Quiero Ser Tuyo', durationSec: 316 };
    expect(ids(req, quieroSerTuyo)[0]).toBe('lyric:uHfvfmWgkrg'); // 370 k views, 317 s
    expect(reasonFor(req, quieroSerTuyo, 'AcbBKIShKh8')).toMatch(/length 314/);
    expect(reasonFor(req, quieroSerTuyo, 'PoXjsyV4Gqo')).toBe('karaoke');
    expect(reasonFor(req, quieroSerTuyo, 'VV20Vo-fbyg')).toMatch(/length 313/); // verified, "letra", but 3 s short
    // "Letra" with too few views is still not enough.
    expect(reasonFor(req, quieroSerTuyo, 'ri5RXLge8gY')).toMatch(/only 1110 views/);
  });

  it("Heavy Metal (Guy Clark): an art track on the artist's own verified channel needs no view count", () => {
    const req = { artist: 'Guy Clark', title: 'Heavy Metal', durationSec: 218 };
    expect(ids(req, heavyMetal)).toEqual(['topic:cGKvqe5rVU8']); // 4438 views
    expect(reasonFor(req, heavyMetal, '1mtm499TlPo')).toMatch(/length 183/); // another recording
    // The same upload on an unverified channel of that name is not trusted.
    const unverified = heavyMetal.map((x) => ({ ...x, verified: false }));
    expect(reasonFor(req, unverified, 'cGKvqe5rVU8')).toBe('art track with only 4438 views');
  });

  it('Run Away: "(Single Version)" is the released recording; "(US Version)" is not', () => {
    const req = { artist: 'Real McCoy', title: 'Run Away', durationSec: 245 };
    expect(ids(req, runAway)).toEqual(['topic:arHdOFutc-0']);
    expect(reasonFor(req, runAway, '_dx0qWHL7dc')).toBe('version');
    expect(reasonFor(req, runAway, 'puR8F4I6E6E')).toBe('version');
    const versions = ['Album Version', 'Explicit Version', 'Single Version'].map((v, i) =>
      e({ id: `SAMEREC${String(i).padStart(4, '0')}`, title: `Real McCoy - Run Away (${v}) (Lyrics)`, channel: 'Lyrics', duration: 246 }),
    );
    expect(ids(req, versions)).toHaveLength(3);
    const others = ['Video Version', '2024 Version', 'Extended Version', 'Acoustic Version'].map((v, i) =>
      e({ id: `OTHERVR${String(i).padStart(4, '0')}`, title: `Real McCoy - Run Away (${v}) (Lyrics)`, channel: 'Lyrics', duration: 246 }),
    );
    expect(ids(req, others)).toEqual([]);
  });

  it('Purloin (M-zine): "(Original Mix)" is the original; remixes and extended mixes are not', () => {
    const req = { artist: 'M-zine', title: 'Purloin', durationSec: 313 };
    expect(ids(req, purloin)).toEqual(['topic:zjJTNKQA6dI']);
    expect(reasonFor(req, purloin, 'Mjku9GfR63o')).toBe('different song'); // another artist's track on its own Topic channel
    const mixes = ['Dava Remix', 'Extended Mix', 'Club Mix'].map((m, i) =>
      e({ id: `MIXES${String(i).padStart(6, '0')}`, title: `Purloin (${m})`, channel: 'M-zine - Topic', duration: 313, views: 300, description: 'Provided to YouTube by Triple Vision' }),
    );
    expect(mixes.map((m) => reasonFor(req, mixes, m.id))).toEqual(['remix', 'remix', 'remix']);
  });

  it('Extravagant Escalations (LingualX): a genuine 2-view art track of a little-known song', () => {
    const req = { artist: 'LingualX', title: 'Extravagant Escalations', durationSec: 249 };
    expect(ids(req, extravagantEscalations)).toEqual(['topic:M_yLkPZZ1Ys']);
    const art = extravagantEscalations[0];
    const not = (x: SearchEntry, more: SearchEntry[] = []) => reasonFor(req, [x, ...more], x.id);
    // Look-alikes: 2 s off the official length; no "Provided to YouTube" text; not a "- Topic" channel;
    // another channel's art track; and a song that has a popular upload (then a real art track has views).
    expect(not({ ...art, duration: 251 })).toBe('art track with only 2 views');
    expect(not({ ...art, description: 'Extravagant Escalations · LingualX' })).toBe('art track with only 2 views');
    expect(not({ ...art, channel: 'LingualX', description: 'Provided to YouTube by DistroKid' })).toBe('art track with only 2 views');
    expect(not({ ...art, channel: 'Chill Beats - Topic' })).toMatch(/art track from another channel|artist not named/);
    const popular = e({ id: 'POPULARLYRC', title: 'LingualX - Extravagant Escalations (Lyrics)', channel: 'Lyrics Hub', views: 2e6, duration: 249 });
    expect(not(art, [popular])).toBe('art track with only 2 views');
  });

  it('the third search is plain "Artist Title"; a degraded answer is recognised', () => {
    expect(fallbackQuery({ artist: 'Shakira', title: "Hips Don't Lie (feat. Wyclef Jean)" })).toBe("Shakira Hips Don't Lie");
    expect(fallbackQuery({ artist: 'Taylor Swift', title: "Shake It Off (Taylor's Version)" })).toBe("Taylor Swift Shake It Off (Taylor's Version)");
    expect(degradedSearch([e({ id: 'NOCHANNEL00', title: 'x', channel: '', views: null })])).toBe(true);
    expect(degradedSearch([e({ id: 'NOCHANNEL00', title: 'x', channel: '', views: null }), e({ id: 'WITHCHANNEL', title: 'y', channel: 'C' })])).toBe(false);
    expect(degradedSearch([])).toBe(false);
  });
});

describe('rankCandidates on real search results: misses from the 2026-11-14 random sample', () => {
  it('Insane: the original (175 M views) before "Insane (1920)", a 1920s re-arrangement (3.9 M), which stays a last resort', () => {
    const req = { artist: 'Black Gryph0n & Baasik', title: 'Insane', durationSec: 160 };
    // "(A Hazbin Hotel Song)" only describes the song, so the official upload counts as its video.
    expect(ids(req, insane)).toEqual(['music-video:juJkNKodgdE', 'topic:eX5lc10Ot6w']);
    expect(ids(req, insane.filter((x) => x.id !== 'juJkNKodgdE'))).toEqual(['topic:eX5lc10Ot6w']);
    // Asked for by name, the tagged upload is the request.
    expect(ids({ ...req, title: 'Insane (1920)' }, insane)[0]).toBe('topic:eX5lc10Ot6w');
  });

  it('era and style tags: a style tag goes after any untagged upload, a bare year only after one with 10x the views; remasters are the original', () => {
    const req = { artist: 'a-ha', title: 'Take On Me', durationSec: 225 };
    const art = (id: string, title: string, views: number) =>
      e({ id, title, channel: 'a-ha', verified: true, views, duration: 226, description: `Provided to YouTube by Rhino ${title} · a-ha` });
    const mv = e({ id: 'MUSICVIDEO0', title: 'a-ha - Take On Me (Official Video)', channel: 'a-ha', verified: true, views: 2e9, duration: 244 });
    const lyric = e({ id: 'LYRICVIDEO0', title: 'a-ha - Take On Me (Lyrics)', channel: 'Lyrics', views: 400_000, duration: 225 });
    expect(ids(req, [art('STYLETAG000', 'Take On Me (1920s Style)', 9e7), { ...mv, views: 1e6 }])).toEqual(['music-video:MUSICVIDEO0', 'topic:STYLETAG000']);
    expect(ids(req, [art('STYLETAG001', 'Take On Me (80s)', 9e7), lyric])).toEqual(['lyric:LYRICVIDEO0', 'topic:STYLETAG001']);
    expect(ids({ ...req, title: 'Take On Me (1920s Style)' }, [art('STYLETAG000', 'Take On Me (1920s Style)', 9e7), mv])).toEqual(['topic:STYLETAG000', 'music-video:MUSICVIDEO0']);
    expect(ids(req, [art('SWINGTAG000', 'Take On Me (Swing)', 9e7), mv])).toEqual(['music-video:MUSICVIDEO0', 'topic:SWINGTAG000']);
    expect(ids(req, [art('YEARTAG0000', 'Take On Me (1985)', 9e7), mv])).toEqual(['music-video:MUSICVIDEO0', 'topic:YEARTAG0000']);
    expect(ids(req, [art('YEARTAG0000', 'Take On Me (1985)', 9e7), { ...mv, views: 5e8 }])).toEqual(['topic:YEARTAG0000', 'music-video:MUSICVIDEO0']);
    expect(ids(req, [art('REMASTER000', 'Take On Me (2015 Remastered)', 9e7), mv])).toEqual(['topic:REMASTER000', 'music-video:MUSICVIDEO0']);
    expect(ids(req, [art('REMASTER001', 'Take On Me (Remastered 2009)', 9e7), mv])).toEqual(['topic:REMASTER001', 'music-video:MUSICVIDEO0']);
  });

  it("You Lie (Lola Jane): \"Artist | 'Title'\" is parsed, but her channel is unverified and an unverified channel using the artist's name is still not trusted", () => {
    const req = { artist: 'Lola Jane', title: 'You Lie', durationSec: 173 };
    expect(ids(req, youLie)).toEqual([]);
    expect(reasonFor(req, youLie, 'j402JjBD1pw')).toBe("unverified channel using the artist's name");
    expect(reasonFor(req, youLie, 'stOK9uYzw7w')).toBe('different song'); // "Lola Jane | 'Dear...'"
    // The same upload on a verified channel would be her video.
    expect(ids(req, youLie.map((x) => (x.id === 'j402JjBD1pw' ? { ...x, verified: true } : x)))).toEqual(['music-video:j402JjBD1pw']);
    const lev = { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 };
    expect(ids(lev, [e({ id: 'PIPELYRIC00', title: "Dua Lipa | 'Levitating' (Lyrics)", channel: 'Lyrics Hub', duration: 204 })])).toEqual(['lyric:PIPELYRIC00']);
    expect(reasonFor(lev, [e({ id: 'PIPEOTHER00', title: 'Lyrics Hub | Dua Lipa - Physical', channel: 'Lyrics Hub', duration: 204 })], 'PIPEOTHER00')).toBe('different song or artist');
  });

  it('Nullification (Face to Face): "officialfacetoface" is the band\'s own channel', () => {
    const req = { artist: 'Face to Face', title: 'Nullification (Bonus Track)', durationSec: 195 };
    expect(ids(req, nullification)).toEqual(['topic:wdWWgR07Rsw']);
    const art = nullification.find((x) => x.id === 'wdWWgR07Rsw')!;
    for (const channel of ['FaceToFaceBand', 'Face To Face Music', 'facetofaceVEVO', 'Face to Face Official', 'officialfacetoface']) {
      expect(ids(req, [{ ...art, channel }])).toEqual(['topic:wdWWgR07Rsw']);
    }
    // Other names, or the same name unverified with few views, are not the band's art track.
    expect(ids(req, [{ ...art, channel: 'officialfacestoface' }])).toEqual([]);
    expect(reasonFor(req, [{ ...art, verified: false }], 'wdWWgR07Rsw')).toBe('art track with only 3016 views');
  });

  it('Dipped, Impersonator: a label\'s "Release - Topic" art track whose credit line names the artist', () => {
    const dip = { artist: 'DJ Prime Cuts', title: 'Dipped', durationSec: 152 };
    expect(ids(dip, dipped)).toEqual(['topic:q5VFF5Wh9q0']);
    expect(reasonFor(dip, dipped, 'nEOJ-JCv-FA')).toBe('different song'); // "Kill Switch", same EP
    const imp = { artist: 'Etovics', title: 'Impersonator', durationSec: 306 };
    expect(ids(imp, impersonator)).toEqual(['topic:kVLuaG-Azr4']);
    const art = dipped.find((x) => x.id === 'q5VFF5Wh9q0')!;
    const not = (x: SearchEntry, more: SearchEntry[] = []) => reasonFor(dip, [x, ...more], x.id);
    // No credit (or cut off), another artist credited, the name only later in the line, a credit for another title.
    expect(not({ ...art, description: 'Provided to YouTube by KudosRecords Dip' })).toBe('artist not named');
    expect(not({ ...art, description: 'Provided to YouTube by KudosRecords Dipped · DJ Other Chartist EP' })).toBe('artist not named');
    expect(not({ ...art, description: 'Provided to YouTube by KudosRecords Dipped · Various Tribute to DJ Prime Cuts' })).toBe('artist not named');
    expect(not({ ...art, title: 'Dipped', description: 'Provided to YouTube by KudosRecords Kill Switch · DJ Prime Cuts Chartist EP' })).toBe('artist not named');
    // Not an auto-generated "- Topic" channel; not exactly the requested title.
    expect(not({ ...art, channel: 'Release' })).toBe('artist not named');
    expect(reasonFor({ ...dip, title: 'Dipped (Dub)' }, [{ ...art, title: 'Dipped' }], art.id)).toMatch(/different song|artist not named/);
    // Off the official length by 2 s, or a song that has a popular upload (a real art track then has views).
    expect(not({ ...art, duration: 154 })).toBe('label art track 154 s vs 152 s');
    const popular = e({ id: 'POPULARLYRC', title: 'DJ Prime Cuts - Dipped (Lyrics)', channel: 'Lyrics Hub', views: 2e6, duration: 152 });
    expect(not(art, [popular])).toBe('label art track of a known song');
  });

  it('偷偷 (Wei Bi, credited 未必 on YouTube): not found, and a title-only search would not be safe', () => {
    const req = { artist: 'Wei Bi', title: '偷偷(广播剧《偷偷藏不住》主题曲)', durationSec: 249 };
    expect(ids(req, touTou)).toEqual([]);
    // Searching the title alone brings other singers' songs of that title at exactly 249 s.
    const sameLength = touTou.filter((x) => x.duration === 249 && /偷偷/.test(x.title) && !/未必/.test(x.channel)).map((x) => x.channel);
    expect(sameLength).toEqual(expect.arrayContaining(['浮梦若薇 - Topic', 'Softlipa - Topic']));
  });

  it('Homerton B (Unknown T): the music video on GRM Daily (verified premiere platform) is the fallback', () => {
    const req = { artist: 'Unknown T', title: 'Homerton B', durationSec: 192 };
    expect(ids(req, homertonB)).toEqual(['music-video:UrnACpUhe98']);
    expect(reasonFor(req, homertonB, 'o2tB9Cs0dn0')).toBe('length 190 s vs 192 s');
    expect(reasonFor(req, homertonB, 'fdvbG9VzAk4')).toBe('lyric video with only 9933 views');
    // An unverified channel of that name is not the platform.
    expect(reasonFor(req, homertonB.map((x) => ({ ...x, verified: false })), 'UrnACpUhe98')).toBe('not official, not a lyric video');
  });
});

describe('rankCandidates on real search results: channel-name misses from run-20261116', () => {
  it('Now That We Found Love (Heavy D & The Boyz): "HeavyDAndTheBoyzVEVO" spells "&" as "and"', () => {
    const req = { artist: 'Heavy D & The Boyz', title: 'Now That We Found Love (feat. Aaron Hall)', durationSec: 258 };
    expect(ids(req, nowThatWeFoundLove)).toEqual(['music-video:NNEgUPKxk7A']); // 258 s, 70 M views
    expect(reasonFor(req, nowThatWeFoundLove, 'jQtZ2GdD2t0')).toBe('version'); // Club Version, 347 s
    expect(reasonFor(req, nowThatWeFoundLove, '1k1lGGLKvCE')).toBe('live');
    // Unverified, the same channel name is still an impostor.
    const vevo = nowThatWeFoundLove.find((x) => x.id === 'NNEgUPKxk7A')!;
    expect(reasonFor(req, [{ ...vevo, verified: false }], vevo.id)).toBe("unverified channel using the artist's name");
    // Both ways round, and "+" too.
    const sg = { artist: 'Simon and Garfunkel', title: 'The Boxer', durationSec: 308 };
    expect(ids(sg, [e({ id: 'SIMONGARF00', title: 'Simon & Garfunkel - The Boxer (Official Audio)', channel: 'Simon & Garfunkel', verified: true, duration: 308 })])).toEqual(['official:SIMONGARF00']);
    const fm = { artist: 'Florence + The Machine', title: 'Dog Days Are Over', durationSec: 252 };
    expect(ids(fm, [e({ id: 'FLORENCEMAC', title: 'Florence + The Machine - Dog Days Are Over (Official Audio)', channel: 'FlorenceAndTheMachineVEVO', verified: true, duration: 252 })])).toEqual(['official:FLORENCEMAC']);
  });

  it('bunny (YOH KAMIYAMA): his verified channel "神山羊 / Yoh Kamiyama" names him in two scripts', () => {
    const req = { artist: 'YOH KAMIYAMA', title: 'Bunny', durationSec: 214 };
    expect(ids(req, bunny)).toEqual(['topic:Z4PTDfLt3i0']); // art track, 215 s, 1.1 M views
    expect(reasonFor(req, bunny, 'Xm_fcaAGBd8')).toBe('translation');
    const art = bunny.find((x) => x.id === 'Z4PTDfLt3i0')!;
    for (const channel of ['神山羊 | Yoh Kamiyama', '神山羊／Yoh Kamiyama', 'Yoh Kamiyama / 神山羊']) {
      expect(ids(req, [{ ...art, channel }])).toEqual(['topic:Z4PTDfLt3i0']);
    }
    // Only a verified channel's name is split: unverified, "<anything> / Artist" is not the artist's.
    expect(reasonFor(req, [{ ...art, verified: false }], art.id)).toBe('art track from another channel');
    const lev = { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 };
    const fan = e({ id: 'FANSLASH000', title: 'Dua Lipa - Levitating (Official Audio)', channel: 'Fan Uploads / Dua Lipa', duration: 204, views: 2e6 });
    expect(ids(lev, [fan])).toEqual([]);
    // Nor is a name without spaced separators ("AC/DC"), or a verified channel naming someone else.
    expect(ids(lev, [{ ...fan, id: 'OTHERSLASH0', channel: 'Pop Hits / Lyrics', verified: true }])).toEqual([]);
  });

  it('Wayoo (Legendaire): "Legendaire Officiel" is the artist\'s own channel; "official" in other languages too', () => {
    const req = { artist: 'Legendaire', title: 'Wayoo', durationSec: 174 };
    expect(ids(req, wayoo)).toEqual(['topic:8dZZGUK6J-s']); // art track, 175 s, 125 views, verified
    expect(reasonFor(req, wayoo, 'U8gocOXyKis')).toBe('different artist'); // Tekno - Wayo
    const art = wayoo.find((x) => x.id === '8dZZGUK6J-s')!;
    for (const channel of ['Legendaire Oficial', 'LegendaireOffiziell', 'Legendaire Ufficiale', 'Legendaire 公式', 'Legendaire オフィシャル', 'Legendaire 官方', 'Legendaire 공식', 'Officiel Legendaire']) {
      expect(ids(req, [{ ...art, channel }])).toEqual(['topic:8dZZGUK6J-s']);
    }
    // Unverified with 125 views it is not trusted; another name with the affix is not the artist.
    expect(reasonFor(req, [{ ...art, verified: false }], art.id)).toBe('art track with only 125 views');
    expect(ids(req, [{ ...art, channel: 'Legendaires Officiel' }])).toEqual([]);
    // An unverified "Dua Lipa Officiel" is the impostor case: not official.
    const lev = { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 };
    const fake = e({ id: 'OFFICIEL000', title: 'Dua Lipa - Levitating (Official Lyric Video)', channel: 'Dua Lipa Officiel', duration: 204, views: 2e6 });
    expect(reasonFor(lev, [fake], fake.id)).toBe("unverified channel using the artist's name");
  });

  it('Que Te Vas Y Te Vas (Fito Olivares): his verified channel bills him with his band, "Fito Olivares Y La Pura Sabrosura"', () => {
    const req = { artist: 'Fito Olivares', title: 'Que Te Vas Y Te Vas', durationSec: 199 };
    expect(ids(req, queTeVas)).toEqual(['topic:AkLs5ZRRroQ']); // art track, 200 s, 8.8 M views
    expect(reasonFor(req, queTeVas, 'e_pwtPye-nA')).toBe('different song'); // "Que Te Vas", same channel
    expect(reasonFor(req, queTeVas, 'zVDY16YDg6g')).toBe('remix');
    const art = queTeVas.find((x) => x.id === 'AkLs5ZRRroQ')!;
    for (const channel of ['Fito Olivares and the Sabrosura Band', 'Fito Olivares & His Band', 'Fito Olivares con La Pura Sabrosura', 'Fito Olivares + Orquesta', 'FitoOlivaresVEVO & The Band']) {
      expect(ids(req, [{ ...art, channel }])).toEqual(['topic:AkLs5ZRRroQ']);
    }
    // Unverified, the billing is not trusted: a few views and it is another channel's art track.
    expect(reasonFor(req, [{ ...art, verified: false, views: 5_000 }], art.id)).toBe('art track from another channel');
    // Only the first-billed side, and only before a band billing: a duo or a feature is another act.
    for (const channel of ['La Pura Sabrosura y Fito Olivares', 'Fito Olivares y Bronco', 'Fito Olivares & Ramón Ayala', 'Grupo Fito Olivares Tributo y La Banda']) {
      expect(reasonFor(req, [{ ...art, channel }], art.id)).toBe('art track from another channel');
    }
    const lev = { artist: 'Dua Lipa', title: 'Levitating', durationSec: 203 };
    const duo = e({ id: 'DUOCHANNEL0', title: 'Dua Lipa - Levitating (Official Audio)', channel: 'Calvin Harris & Dua Lipa', verified: true, duration: 204 });
    expect(reasonFor(lev, [duo], duo.id)).toBe('not official, not a lyric video');
    // An unverified "Dua Lipa & The Band" is the impostor case.
    expect(reasonFor(lev, [{ ...duo, channel: 'Dua Lipa & The Band', verified: false }], duo.id)).toBe('not official, not a lyric video');
  });

  it('Never Since (Refraction): still not found; the only upload is 9 s longer than iTunes and on an unverified channel', () => {
    const req = { artist: 'Refraction', title: 'Never Since', durationSec: 361 };
    const only = e({ id: 'NhDi46hdlxo', title: 'Refraction ~ Never Since', channel: 'Chris Broomhead', views: 481, duration: 370, description: "Melbourne jazz trio Refraction performing 'Never Since' composed by Chris Broomhead and recorded o" });
    expect(reasonFor(req, [only], only.id)).toBe('length 370 s vs 361 s');
    // Even at the official length it is neither official nor a popular lyric video.
    expect(reasonFor(req, [{ ...only, duration: 361 }], only.id)).toBe('not official, not a lyric video');
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
    // A search for a known song always brings its popular uploads, and then a genuine art track has views.
    expect(reasonFor(req, [fake, thirdParty], 'FAKETOPIC00')).toMatch(/art track with only 1204 views/);
    expect(reasonFor(req, [fake, { ...official, duration: 260 }], 'FAKETOPIC00')).toMatch(/art track with only 1204 views/);
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

  it('the TV tests use the same fixtures (PickFixtures.kt is generated from pick.fixtures.ts)', () => {
    // Out of date: run `npx tsx tools/beatmaps/pickFixturesKotlin.ts`.
    expect(readFileSync(KOTLIN_FIXTURES, 'utf8')).toBe(kotlinFixtures());
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

describe('the alternates window (after YouTube withheld the first choice)', () => {
  const req = { artist: 'Nightwish', title: 'While Your Lips Are Still Red', durationSec: 259 };
  const lyric = (id: string, duration: number, views = 900_000) => e({ id, title: 'Nightwish - While Your Lips Are Still Red (Lyrics)', channel: `Lyrics ${id}`, duration, views });
  const alt = (entries: SearchEntry[]) => rankCandidates(req, entries, { window: ALT_WINDOW }).ranked.map((r) => r.entry.id);

  it('is 3 s shorter to 6 s longer; the first choice keeps -1..+6 s', () => {
    expect(WINDOW).toEqual([-1, 6]);
    expect(ALT_WINDOW).toEqual([-3, 6]);
    const entries = [lyric('minus2sec01', 257), lyric('minus3sec01', 256), lyric('minus4sec01', 255), lyric('plus7sec001', 266)];
    // First choice: unchanged, -2 s is still out.
    expect(ids(req, entries)).toEqual([]);
    expect(reasonFor(req, entries, 'minus2sec01')).toBe('length 257 s vs 259 s');
    // Alternates: -2 and -3 s in, -4 s and +7 s out.
    expect(alt(entries)).toEqual(['minus2sec01', 'minus3sec01']);
    expect(rankCandidates(req, entries, { window: ALT_WINDOW }).rejected.map((r) => r.reason)).toEqual(['length 255 s vs 259 s', 'length 266 s vs 259 s']);
  });

  it('puts uploads inside the usual window first, then the newly allowed ones', () => {
    // More views would rank the -2 s upload first within its tier; the in-window ones still go first.
    const entries = [lyric('minus2sec01', 257, 5_000_000), lyric('exact000001', 259, 400_000), lyric('plus3sec001', 262, 600_000)];
    expect(alt(entries)).toEqual(['plus3sec001', 'exact000001', 'minus2sec01']);
    expect(ids(req, entries)).toEqual(['lyric:plus3sec001', 'lyric:exact000001']);
  });

  it('every other rule stays: views, live, remixes', () => {
    const entries = [
      lyric('fewviews001', 257, 5_000),
      e({ id: 'livewemb001', title: 'Nightwish - While Your Lips Are Still Red (Live at Wembley)', channel: 'Fan', duration: 257, views: 9e6 }),
      e({ id: 'remix000001', title: 'Nightwish - While Your Lips Are Still Red (Remix) Lyrics', channel: 'Remixes', duration: 257, views: 9e6 }),
    ];
    expect(alt(entries)).toEqual([]);
  });
});
