/**
 * Recorded answers (2026-11-14) of the iTunes Search API and Deezer's search
 * for "artist title" searches, as the app makes them (12 iTunes rows, 10
 * Deezer rows), trimmed to the fields the parsers read. Used by
 * songMerge.test.ts and, through tools/beatmaps/catalogFixturesKotlin.ts, by
 * the TV's SongMergeTest.kt.
 */
export interface CatalogFixture {
  term: string;
  itunes: { results: Record<string, unknown>[] };
  deezer: { data: Record<string, unknown>[] };
}

export const theBox: CatalogFixture = {
 "term": "Roddy Ricch The Box",
 "itunes": {
  "results": [
   {
    "kind": "song",
    "trackId": 1470317582,
    "artistName": "Mustard & Roddy Ricch",
    "trackName": "Ballin’",
    "collectionName": "Perfect Ten",
    "trackTimeMillis": 180435,
    "releaseDate": "2019-06-28T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/2e/c6/ee/2ec6ee34-3456-183c-8de6-352e8280c296/19UMGIM55037.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1508028869,
    "artistName": "DaBaby",
    "trackName": "ROCKSTAR (feat. Roddy Ricch)",
    "collectionName": "BLAME IT ON BABY",
    "trackTimeMillis": 181853,
    "releaseDate": "2020-04-17T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/1b/63/04/1b630400-490e-245b-a26f-0120f6f253c8/20UMGIM28168.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1584779002,
    "artistName": "EC Twins",
    "trackName": "The Box",
    "collectionName": "The Box - Single",
    "trackTimeMillis": 210732,
    "releaseDate": "2021-10-08T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Electronic",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/dc/1b/67/dc1b6712-0403-e6b0-68d3-6f29a414c59b/886449548347.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1493891016,
    "artistName": "Karaoke Pro",
    "trackName": "The Box (Originally Performed by Roddy Ricch) [Instrumental Version]",
    "collectionName": "The Box (Originally Performed by Roddy Ricch) [Karaoke Version] - Single",
    "trackTimeMillis": 204406,
    "releaseDate": "2020-01-07T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/4d/97/cc/4d97cc4e-75e7-708a-7cd5-cd987f9690c5/195039002238_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1493291722,
    "artistName": "3 Dope Brothas",
    "trackName": "The Box (Originally Performed by Roddy Ricch) [Instrumental]",
    "collectionName": "The Box (Originally Performed by Roddy Ricch) [Instrumental] - Single",
    "trackTimeMillis": 192911,
    "releaseDate": "2019-12-31T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/90/7d/7c/907d7cda-66f5-b4de-903c-a75f46746333/7d421b17-a263-4e30-9003-505a8b449003.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1566868904,
    "artistName": "Harrison",
    "trackName": "The Box (feat. SEBASTIEN DIOR)",
    "collectionName": "The Box (feat. SEBASTIEN DIOR) - Single",
    "trackTimeMillis": 158659,
    "releaseDate": "2021-06-11T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Dance",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d1/0c/7d/d10c7db6-4e78-e7a0-e397-3282072b321f/886449290710.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1498727931,
    "artistName": "EdKara",
    "trackName": "The Box (Originally Performed by Roddy Ricch) [Karaoke No Guide Melody Version]",
    "collectionName": "The Box (Originally Performed by Roddy Ricch) [Karaoke No Guide Melody Version] - Single",
    "trackTimeMillis": 200108,
    "releaseDate": "2020-02-14T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/d6/93/65/d6936510-ab9f-b6d2-efb7-d9e303088dd2/The_Box_Originally_Performed_by_Roddy_Ricch_Karaoke_No_Guide_Melody_Version.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1498828768,
    "artistName": "Singer's Edge Karaoke",
    "trackName": "The Box (Originally Performed by Roddy Ricch) [Karaoke]",
    "collectionName": "The Box (Originally Performed by Roddy Ricch) [Karaoke Version] - Single",
    "trackTimeMillis": 199028,
    "releaseDate": "2020-02-12T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/2b/ad/c6/2badc66a-e402-f14c-8590-b88999a1cae7/805570051588.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1440913918,
    "artistName": "Snot",
    "trackName": "The Box",
    "collectionName": "Get Some",
    "trackTimeMillis": 205000,
    "releaseDate": "1997-05-27T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hard Rock",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/39/7a/19/397a191a-31e6-7aa2-c174-443f3e537e79/00720642511022.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 307031291,
    "artistName": "Randy Travis",
    "trackName": "The Box",
    "collectionName": "I Told You So: The Ultimate Hits of Randy Travis",
    "trackTimeMillis": 202000,
    "releaseDate": "1994-04-26T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Country",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music/e8/1f/98/mzi.azfllboh.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1589012304,
    "artistName": "ICE NINE KILLS",
    "trackName": "The Box (feat. Brandon Saller & Ryan Kirby)",
    "collectionName": "Welcome To Horrorwood: The Silver Scream 2",
    "trackTimeMillis": 215133,
    "releaseDate": "2021-10-15T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Metal",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f5/62/b7/f562b788-e918-0fbc-b31e-e3ef88a753e2/21CRGIM29936.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 302164577,
    "artistName": "Randy Travis",
    "trackName": "The Box",
    "collectionName": "This Is Me",
    "trackTimeMillis": 200987,
    "releaseDate": "1994-04-26T07:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Pop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/12/55/e8/1255e8d6-88c9-291a-4301-ad1b1f8bb53e/mzi.cbkeuotq.jpg/100x100bb.jpg"
   }
  ]
 },
 "deezer": {
  "data": [
   {
    "type": "track",
    "title": "The Box",
    "duration": 196,
    "explicit_lyrics": true,
    "artist": {
     "name": "Roddy Ricch"
    },
    "album": {
     "title": "Please Excuse Me for Being Antisocial",
     "md5_image": "4cecb47ae25837b9dd022004b5cacbdc"
    }
   },
   {
    "type": "track",
    "title": "slow it down (feat. Ty Dolla $ign & Alex Isley)",
    "duration": 54,
    "explicit_lyrics": true,
    "artist": {
     "name": "Roddy Ricch"
    },
    "album": {
     "title": "LIVE LIFE FAST",
     "md5_image": "209db1f1f16d04f6c11f450498b4c461"
    }
   },
   {
    "type": "track",
    "title": "The Box (8-Bit Roddy Ricch Emulation)",
    "duration": 196,
    "explicit_lyrics": false,
    "artist": {
     "name": "8-Bit Arcade"
    },
    "album": {
     "title": "By Request, Vol. 66",
     "md5_image": "b1ee0397d7c831fd65e66a17e95581e2"
    }
   },
   {
    "type": "track",
    "title": "Down Below",
    "duration": 224,
    "explicit_lyrics": true,
    "artist": {
     "name": "Roddy Ricch"
    },
    "album": {
     "title": "Feed Tha Streets II",
     "md5_image": "d7c386afd4b4f22f7ebb58557ed56576"
    }
   },
   {
    "type": "track",
    "title": "How It Is (feat. Roddy Ricch, Chip & Yxng Bane)",
    "duration": 277,
    "explicit_lyrics": true,
    "artist": {
     "name": "The Plug"
    },
    "album": {
     "title": "How It Is (feat. Roddy Ricch, Chip & Yxng Bane)",
     "md5_image": "f4172e715f48da37741cc1ab8ab53575"
    }
   },
   {
    "type": "track",
    "title": "How",
    "duration": 218,
    "explicit_lyrics": true,
    "artist": {
     "name": "Ella Mai"
    },
    "album": {
     "title": "Heart On My Sleeve",
     "md5_image": "d85b346a6f35f4901a59daaf6cf3f094"
    }
   },
   {
    "type": "track",
    "title": "BODY IN MOTION (feat. Bryson Tiller, Lil Baby & Roddy Ricch)",
    "duration": 306,
    "explicit_lyrics": true,
    "artist": {
     "name": "DJ Khaled"
    },
    "album": {
     "title": "KHALED KHALED",
     "md5_image": "db27a0f87adb079d4d601b4ae3d1c909"
    }
   },
   {
    "type": "track",
    "title": "The Box (Sped Up Version)",
    "duration": 163,
    "explicit_lyrics": true,
    "artist": {
     "name": "sped up nightcore"
    },
    "album": {
     "title": "The Box (Roddy Ricch) (Sped Up Version)",
     "md5_image": "72963f97f98f1e33920cf6ebe9e4cb55"
    }
   },
   {
    "type": "track",
    "title": "God's Eyes",
    "duration": 135,
    "explicit_lyrics": true,
    "artist": {
     "name": "Roddy Ricch"
    },
    "album": {
     "title": "Please Excuse Me for Being Antisocial",
     "md5_image": "4cecb47ae25837b9dd022004b5cacbdc"
    }
   },
   {
    "type": "track",
    "title": "Passionate (feat. Roddy Ricch)",
    "duration": 170,
    "explicit_lyrics": true,
    "artist": {
     "name": "Blxst"
    },
    "album": {
     "title": "Just For Clarity 2",
     "md5_image": "609a871b3dbf77759a894ab5e2a397b1"
    }
   }
  ]
 }
};

export const fukumean: CatalogFixture = {
 "term": "Gunna fukumean",
 "itunes": {
  "results": [
   {
    "kind": "song",
    "trackId": 1693517755,
    "artistName": "Gunna",
    "trackName": "umean",
    "collectionName": "a Gift & a Curse",
    "trackTimeMillis": 125040,
    "releaseDate": "2023-06-16T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/af/f8/ef/aff8ef1c-e1e7-8c70-75fa-2201d8785f3d/075679678492.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1697558224,
    "artistName": "Gunna",
    "trackName": "fukumean (instrumental)",
    "collectionName": "fukumean - EP",
    "trackTimeMillis": 125040,
    "releaseDate": "2023-07-21T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/5c/9d/0c/5c9d0c9b-ae5a-5b4c-fb27-f2d1a606411d/075679675576.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1710747925,
    "artistName": "Seener",
    "trackName": "Fukumean",
    "collectionName": "Terapia",
    "trackTimeMillis": 125039,
    "releaseDate": "2023-10-04T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/28/20/d0/2820d082-9120-061f-399e-9ba7b207b6e2/artwork.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1703591338,
    "artistName": "Covers Unplugged",
    "trackName": "Fukumean (slowed + reverb)",
    "collectionName": "LOFI CAFE VOL. 2 (Slowed & Reverbed)",
    "trackTimeMillis": 162052,
    "releaseDate": "2023-08-31T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7d/70/16/7d701618-845a-1555-4512-526e2df7ef3e/cover_4062851414098.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 6832913209,
    "artistName": "Type beats to the world",
    "trackName": "Gunna \"Fukumean\"Type beat 130BPM",
    "collectionName": "Type your life",
    "trackTimeMillis": 136615,
    "releaseDate": "2024-04-22T07:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ea/14/f0/ea14f0f4-aa3c-7505-d117-7302cbb45ef5/6923672298602.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1770972382,
    "artistName": "Heater & Crunch, Drama B & Benz Boyz",
    "trackName": "Fukumean",
    "collectionName": "Fukumean - Single",
    "trackTimeMillis": 161633,
    "releaseDate": "2024-10-11T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Electronic",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/db/2d/7d/db2d7dff-a954-d446-5256-e5c9544bad3a/5063585456025_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1820078987,
    "artistName": "210 Toven",
    "trackName": "FukuMean (feat. BunnaB)",
    "collectionName": "FukuMean (feat. BunnaB) - Single",
    "trackTimeMillis": 121056,
    "releaseDate": "2025-06-20T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c9/55/90/c95590f6-5532-ed99-f7c0-36d082c01732/199316110531_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1706531307,
    "artistName": "Singer's Edge Karaoke",
    "trackName": "Fukumean (Originally Performed By Gunna) [Karaoke]",
    "collectionName": "Fukumean (Originally Performed By Gunna) [Karaoke Version] - Single",
    "trackTimeMillis": 126310,
    "releaseDate": "2023-09-08T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/5f/1e/4f/5f1e4f65-6167-77d6-700a-10bbff10ebf5/805570077694.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1794362565,
    "artistName": "Bolo3k",
    "trackName": "Fukumean (Radio Edit)",
    "collectionName": "Fukumean (Radio Edit) - Single",
    "trackTimeMillis": 107703,
    "releaseDate": "2025-01-15T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8d/7b/93/8d7b9385-a5cf-f7dc-10fc-67e88fcd3370/055905965589.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1727939657,
    "artistName": "Island Lofi",
    "trackName": "Fukumean",
    "collectionName": "Island Smooth Lofi",
    "trackTimeMillis": 231539,
    "releaseDate": "2024-01-31T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/aa/02/68/aa026833-55cc-40f5-e498-0b27d80dca19/artwork.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1802726822,
    "artistName": "home alone.",
    "trackName": "fukumean",
    "collectionName": "kill 'em with kindness",
    "trackTimeMillis": 192000,
    "releaseDate": "2025-03-17T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1c/14/92/1c1492b5-5851-44d5-6875-8459ac1456fa/artwork.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1715207620,
    "artistName": "Producer_Max",
    "trackName": "Fukumean (instrumental Chopped n' Screwed)",
    "collectionName": "Fukumean (instrumental Chopped n' Screwed) - Single",
    "trackTimeMillis": 167547,
    "releaseDate": "2023-11-03T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/c4/f9/24/c4f924cb-ad45-08ee-e23a-0b09c18cb89f/artwork.jpg/100x100bb.jpg"
   }
  ]
 },
 "deezer": {
  "data": [
   {
    "type": "track",
    "title": "fukumean",
    "duration": 125,
    "explicit_lyrics": true,
    "artist": {
     "name": "Gunna"
    },
    "album": {
     "title": "a Gift & a Curse",
     "md5_image": "35446b14e181f0a3fe415c06fec08d0b"
    }
   },
   {
    "type": "track",
    "title": "fukumean (chopped 'n screwed)",
    "duration": 155,
    "explicit_lyrics": true,
    "artist": {
     "name": "Gunna"
    },
    "album": {
     "title": "fukumean",
     "md5_image": "bb26e1551dfee0f2f7f379e16905b3b1"
    }
   },
   {
    "type": "track",
    "title": "fukumean (sped up version)",
    "duration": 100,
    "explicit_lyrics": true,
    "artist": {
     "name": "Gunna"
    },
    "album": {
     "title": "fukumean",
     "md5_image": "bb26e1551dfee0f2f7f379e16905b3b1"
    }
   },
   {
    "type": "track",
    "title": "fukumean (instrumental)",
    "duration": 125,
    "explicit_lyrics": false,
    "artist": {
     "name": "Gunna"
    },
    "album": {
     "title": "fukumean",
     "md5_image": "bb26e1551dfee0f2f7f379e16905b3b1"
    }
   },
   {
    "type": "track",
    "title": "fukumean (reversed)",
    "duration": 125,
    "explicit_lyrics": true,
    "artist": {
     "name": "Gunna"
    },
    "album": {
     "title": "fukumean",
     "md5_image": "bb26e1551dfee0f2f7f379e16905b3b1"
    }
   },
   {
    "type": "track",
    "title": "fukumean (feat. Gunna) (REMIX)",
    "duration": 155,
    "explicit_lyrics": true,
    "artist": {
     "name": "JOM THE ONE"
    },
    "album": {
     "title": "fukumean (feat. Gunna) [REMIX]",
     "md5_image": "ecfcfaf4bfb8bb38accb03ed8895c59e"
    }
   },
   {
    "type": "track",
    "title": "Fukumean Gunna",
    "duration": 208,
    "explicit_lyrics": false,
    "artist": {
     "name": "Tegazine"
    },
    "album": {
     "title": "Fukumean Gunna",
     "md5_image": "996f288289a5f606bb25a8bea6a68931"
    }
   },
   {
    "type": "track",
    "title": "fukumean (8-Bit Gunna Emulation)",
    "duration": 125,
    "explicit_lyrics": false,
    "artist": {
     "name": "8-Bit Arcade"
    },
    "album": {
     "title": "By Request, Vol. 221",
     "md5_image": "c1cbb63f4a3ef4abf540c3844820b8f5"
    }
   },
   {
    "type": "track",
    "title": "[FREE] Gunna x Young Thug Type Beat 2025 - \"Fukumean 2.0\"",
    "duration": 186,
    "explicit_lyrics": false,
    "artist": {
     "name": "ImpoetlKeepSober"
    },
    "album": {
     "title": "[FREE] Gunna x Young Thug Type Beat 2025 - \"Fukumean 2.0\"",
     "md5_image": "d09406b0738796569534e8bccb2df16f"
    }
   },
   {
    "type": "track",
    "title": "Gunna fuckumean",
    "duration": 86,
    "explicit_lyrics": false,
    "artist": {
     "name": "Gali Troya"
    },
    "album": {
     "title": "Gunna fuckumean",
     "md5_image": "458ab3ecbdbe76e7536177490d75bd7c"
    }
   }
  ]
 }
};

export const freakOn: CatalogFixture = {
 "term": "Missy Elliott Get Ur Freak On",
 "itunes": {
  "results": [
   {
    "kind": "song",
    "trackId": 83134409,
    "artistName": "Missy Elliott",
    "trackName": "Get Ur Freak On (Amended LP Version)",
    "collectionName": "Miss E...So Addictive",
    "trackTimeMillis": 237011,
    "releaseDate": "2001-03-06T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music/71/c2/4f/mzi.gsutnxrb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1231269658,
    "artistName": "Havana Maestros",
    "trackName": "Get Ur Freak On (feat. Missy Elliott)",
    "collectionName": "AMERiCUBA",
    "trackTimeMillis": 192000,
    "releaseDate": "2017-05-26T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Worldwide",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/11/13/ab/1113abf6-9f10-fef7-1245-860eb0bddd8f/075597936476.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 184941467,
    "artistName": "Missy Elliott",
    "trackName": "Get Ur Freak On (Amended LP Version)",
    "collectionName": "Respect M.E.",
    "trackTimeMillis": 237067,
    "releaseDate": "2001-03-06T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music/99/74/0e/mzi.vllefkco.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 849344484,
    "artistName": "Missy Elliott & The Black Keys",
    "trackName": "Get Ur Freak On / Keep Me",
    "collectionName": "Neighbors (Original Motion Picture Soundtrack)",
    "trackTimeMillis": 207413,
    "releaseDate": "2014-04-29T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Soundtrack",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/1b/6c/c3/1b6cc3b3-a1b8-5619-c347-41ea32970ebb/075679941343.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1264527,
    "artistName": "Missy Elliott",
    "trackName": "Work It",
    "collectionName": "Under Construction",
    "trackTimeMillis": 292933,
    "releaseDate": "2002-09-13T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Features124/v4/67/63/8e/67638ee7-4bf1-5bcd-75af-0c7868c23478/dj.mzvpzeqc.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1440771529,
    "artistName": "Keyshia Cole",
    "trackName": "Let It Go (feat. Missy Elliott & Lil 'Kim)",
    "collectionName": "Just Like You",
    "trackTimeMillis": 238333,
    "releaseDate": "2007-06-19T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "R&B/Soul",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4e/1f/7a/4e1f7a41-58d4-d08c-0855-6715641a3d06/07UMGIM12395.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 253641165,
    "artistName": "SWV",
    "trackName": "Can We (feat. Missy Elliott)",
    "collectionName": "Release Some Tension",
    "trackTimeMillis": 290627,
    "releaseDate": "1997-02-11T08:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "R&B/Soul",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/47/f3/b8/47f3b873-57dc-479e-dc71-34b12f082348/mzi.kpgncrjx.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 275765402,
    "artistName": "Fantasia",
    "trackName": "Free Yourself (feat. Missy Elliott)",
    "collectionName": "Free Yourself",
    "trackTimeMillis": 257427,
    "releaseDate": "2004-11-23T08:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "R&B/Soul",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/c9/08/bb/c908bb0d-c0a4-e29e-cc83-c9a880a7c198/dj.ihuchfks.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 73240545,
    "artistName": "Missy Elliott",
    "trackName": "Lose Control (feat. Ciara & Fat Man Scoop)",
    "collectionName": "The Cookbook",
    "trackTimeMillis": 226896,
    "releaseDate": "2005-07-04T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Features125/v4/74/34/58/7434589c-4c48-5334-56b2-aa1388935851/dj.xilerauv.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1407408189,
    "artistName": "KT Tunstall",
    "trackName": "Get Ur Freak On (BBC Radio 1 Live Lounge Session 2005)",
    "collectionName": "BBC Live Sessions - EP",
    "trackTimeMillis": 194540,
    "releaseDate": "2018-07-13T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Rock",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/26/e5/f2/26e5f2c8-f373-2354-3c4c-9d4361fa9c6b/00602567878438.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1878053569,
    "artistName": "Shawn Lee's Ping Pong Orchestra",
    "trackName": "Get Ur Freak On",
    "collectionName": "Hits the Hits",
    "trackTimeMillis": 140520,
    "releaseDate": "2007-10-09T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Funk",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/54/dc/5c/54dc5c05-5e07-ca1a-9be4-adef3a665028/62901.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1487391153,
    "artistName": "Quantic & Los Miticos Del Ritmo",
    "trackName": "Get UR Freak On",
    "collectionName": "Hip Hop En Cumbia EP",
    "trackTimeMillis": 159928,
    "releaseDate": "2011-06-13T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Electronic",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/f0/2e/7f/f02e7fcb-2562-ff5c-5e63-1f320d4c89fe/5060609662189.jpg/100x100bb.jpg"
   }
  ]
 },
 "deezer": {
  "data": [
   {
    "type": "track",
    "title": "Get Ur Freak On",
    "duration": 236,
    "explicit_lyrics": true,
    "artist": {
     "name": "Missy Elliott"
    },
    "album": {
     "title": "Miss E... So Addictive",
     "md5_image": "d506a6d8b28483240daee6f379fd866c"
    }
   },
   {
    "type": "track",
    "title": "Get Ur Freak On",
    "duration": 237,
    "explicit_lyrics": false,
    "artist": {
     "name": "Missy Elliott"
    },
    "album": {
     "title": "Respect M.E.",
     "md5_image": "99740ee2cfbce2e27fd4c27e3d3bc1b0"
    }
   },
   {
    "type": "track",
    "title": "Get Ur Freak On (feat. Missy Elliott)",
    "duration": 192,
    "explicit_lyrics": false,
    "artist": {
     "name": "Havana Maestros"
    },
    "album": {
     "title": "AMERiCUBA",
     "md5_image": "f0937aac8cc643225b9bbcb1e5305144"
    }
   },
   {
    "type": "track",
    "title": "Get UR Freak On (Originally by Missy Elliott)",
    "duration": 207,
    "explicit_lyrics": false,
    "artist": {
     "name": "Jaymz Bee & The Deep Lounge Coalition"
    },
    "album": {
     "title": "Sub Urban",
     "md5_image": "8a72faf445c0118102d319dd22e6e7a9"
    }
   },
   {
    "type": "track",
    "title": "Get Ur Freak On (In the Style of Missy Elliott) [Karaoke Instrumental Version]",
    "duration": 213,
    "explicit_lyrics": false,
    "artist": {
     "name": "All Hits Gold"
    },
    "album": {
     "title": "Pop Instrumentals: Noughties Classics, Vol. 3",
     "md5_image": "716f853fa8f95569b28aaffaaf5e2887"
    }
   },
   {
    "type": "track",
    "title": "Get Ur Freak On (By Missy Elliott) (Instrumental Karaoke Version)",
    "duration": 221,
    "explicit_lyrics": false,
    "artist": {
     "name": "ZZang KARAOKE"
    },
    "album": {
     "title": "ZZang KARAOKE 2026 POP Vol.269",
     "md5_image": "84108a368363f7c30ed93e969e6c9356"
    }
   },
   {
    "type": "track",
    "title": "Get Ur Freak On (Radio Version) [In the Style of Missy Elliott] [Karaoke Version]",
    "duration": 243,
    "explicit_lyrics": true,
    "artist": {
     "name": "The Karaoke Channel"
    },
    "album": {
     "title": "The Karaoke Channel - Sing Get Ur Freak On (Radio Version) Like Missy Elliott",
     "md5_image": "30bed46f1fea2b2e8ec9a42b2a94ca2d"
    }
   }
  ]
 }
};

export const loseYourself: CatalogFixture = {
 "term": "Eminem Lose Yourself",
 "itunes": {
  "results": [
   {
    "kind": "song",
    "trackId": 1440903439,
    "artistName": "Eminem",
    "trackName": "Lose Yourself",
    "collectionName": "8 Mile (Music from and Inspired By the Motion Picture)",
    "trackTimeMillis": 321960,
    "releaseDate": "2002-10-29T08:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Soundtrack",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/08/23/fc/0823fcd9-cb44-695b-32bf-b3bf51d9f800/00606949351229.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1649859279,
    "artistName": "Eminem",
    "trackName": "Lose Yourself (Instrumental)",
    "collectionName": "8 Mile (Music From And Inspired By The Motion Picture (Expanded Edition))",
    "trackTimeMillis": 323787,
    "releaseDate": "2002-01-01T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/60/6d/47/606d47e4-fc4e-eee7-eebf-b1db921b1b9d/22UMGIM82604.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1783944410,
    "artistName": "TM.",
    "trackName": "Eminem (Lose Yourself) [Epic Version]",
    "collectionName": "Eminem (Lose Yourself) [Epic Version] - Single",
    "trackTimeMillis": 138995,
    "releaseDate": "2024-12-04T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Instrumental",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/5e/71/8c/5e718c8d-e97d-19fc-b502-f8ec16bf87ab/859798534286_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1440723561,
    "artistName": "Eminem",
    "trackName": "Lose Yourself (Soundtrack Version) [Edited Version]",
    "collectionName": "Curtain Call: The Hits",
    "trackTimeMillis": 321213,
    "releaseDate": "2002-10-29T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/27/79/d5/2779d529-ff10-c15d-1c50-08cd46dd1237/06UMGIM17625.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1443175779,
    "artistName": "Eminem",
    "trackName": "Lose Yourself (Demo Version)",
    "collectionName": "SHADYXV",
    "trackTimeMillis": 180253,
    "releaseDate": "2014-11-24T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/a0/93/7f/a0937f91-ca3f-5ce8-e053-95eaed3d92fb/00602547130129.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1462482098,
    "artistName": "Power Music Workout",
    "trackName": "Lose Yourself (Trap Workout Remix)",
    "collectionName": "Lose Yourself (Workout Remix) - Single",
    "trackTimeMillis": 321882,
    "releaseDate": "2019-05-03T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Fitness & Workout",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/6c/41/85/6c4185ca-b931-0d32-9747-9c26a61cb544/LoseYourself_Gen_3000.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1443175650,
    "artistName": "Eminem",
    "trackName": "Lose Yourself",
    "collectionName": "SHADYXV",
    "trackTimeMillis": 320573,
    "releaseDate": "2002-10-22T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/a0/93/7f/a0937f91-ca3f-5ce8-e053-95eaed3d92fb/00602547130129.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1002132692,
    "artistName": "Can You Flow?",
    "trackName": "Lose Yourself (Instrumental)",
    "collectionName": "Can You Flow? Presents Instrumental Renditions of Eminem's Greatest Hits",
    "trackTimeMillis": 291947,
    "releaseDate": "2006-10-31T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music7/v4/4d/c5/89/4dc589f9-15e0-893b-aad2-1b9c94564aa6/1410_300dpi.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 344792230,
    "artistName": "Doug Munro",
    "trackName": "Lose Yourself",
    "collectionName": "Boogaloo to Eminem",
    "trackTimeMillis": 346344,
    "releaseDate": "2009-11-18T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Jazz",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music/8a/fb/e5/mzi.nvxmppll.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1579469213,
    "artistName": "Beedle The Bardcore",
    "trackName": "Lose Yourself (Medieval Bardcore Version)",
    "collectionName": "Medieval Eminem",
    "trackTimeMillis": 198408,
    "releaseDate": "2021-08-03T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Instrumental",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f9/92/ab/f992abad-9437-aee2-b9dd-4e0c2ef6d475/198001393693.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 499865862,
    "artistName": "Cut Down Clay",
    "trackName": "Lose Yourself (Punk Remix) [As Made Famous By Eminem]",
    "collectionName": "Hip Hop Goes Punk",
    "trackTimeMillis": 306364,
    "releaseDate": "2012-02-02T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Rock",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/23/3c/2f/233c2fc9-d7ec-7f49-3b26-d8bfde9cdbae/mzi.dgvarmlt.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 910752867,
    "artistName": "Rockabye Baby!",
    "trackName": "Lose Yourself",
    "collectionName": "Lullaby Renditions of Eminem",
    "trackTimeMillis": 194720,
    "releaseDate": "2014-10-28T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Children's Music",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music1/v4/0e/52/8a/0e528a50-a9db-8535-daea-a1a7aefbad8e/9703_300dpi.jpg/100x100bb.jpg"
   }
  ]
 },
 "deezer": {
  "data": [
   {
    "type": "track",
    "title": "Lose Yourself",
    "duration": 326,
    "explicit_lyrics": true,
    "artist": {
     "name": "Eminem"
    },
    "album": {
     "title": "Curtain Call: The Hits",
     "md5_image": "e2b36a9fda865cb2e9ed1476b6291a7d"
    }
   },
   {
    "type": "track",
    "title": "Lose Yourself (Original Demo Version)",
    "duration": 180,
    "explicit_lyrics": true,
    "artist": {
     "name": "Eminem"
    },
    "album": {
     "title": "8 Mile (Music From And Inspired By The Motion Picture Expanded Edition)",
     "md5_image": "a16423673867af8c78f5f6a5337529fd"
    }
   },
   {
    "type": "track",
    "title": "Eminem (Lose Yourself)[Epic Version]",
    "duration": 139,
    "explicit_lyrics": false,
    "artist": {
     "name": "TM."
    },
    "album": {
     "title": "Eminem (Lose Yourself)[Epic Version]",
     "md5_image": "e1e0dac92d9a8af5816f5011b83e0f36"
    }
   },
   {
    "type": "track",
    "title": "Lose Yourself (From \"8 Mile\")",
    "duration": 266,
    "explicit_lyrics": false,
    "artist": {
     "name": "Eminem"
    },
    "album": {
     "title": "Best Ever Soundtracks",
     "md5_image": "572c482ba64339e66e03bd27f5b5aecd"
    }
   },
   {
    "type": "track",
    "title": "Lose Yourself",
    "duration": 257,
    "explicit_lyrics": false,
    "artist": {
     "name": "Maria Fiselier"
    },
    "album": {
     "title": "Beste Zangers Seizoen 11 (Aflevering 4 - Hoofdartiest Davina Michelle)",
     "md5_image": "f708e4e5970387ec49ff239fa4654212"
    }
   },
   {
    "type": "track",
    "title": "Lose Yourself (Tabata)",
    "duration": 242,
    "explicit_lyrics": false,
    "artist": {
     "name": "Tabata Songs"
    },
    "album": {
     "title": "Tabata Songs Classics",
     "md5_image": "b94439a25230905eb2fdf267ed4c5550"
    }
   },
   {
    "type": "track",
    "title": "Lose Yourself (cover Eminem)",
    "duration": 328,
    "explicit_lyrics": false,
    "artist": {
     "name": "Art'Skull"
    },
    "album": {
     "title": "Blackwaters",
     "md5_image": "35fc8b8e4fda412660dba544c385d0ea"
    }
   },
   {
    "type": "track",
    "title": "Lose yourself- Eminem (Sohtech rework)",
    "duration": 304,
    "explicit_lyrics": false,
    "artist": {
     "name": "Sohtech"
    },
    "album": {
     "title": "Lose yourself- Eminem (Sohtech rework)",
     "md5_image": "7aa32b4316232134d97561fd65e8ed28"
    }
   },
   {
    "type": "track",
    "title": "8 Mile - Lose Yourself - Main Theme",
    "duration": 320,
    "explicit_lyrics": true,
    "artist": {
     "name": "Geek Music"
    },
    "album": {
     "title": "8 Mile - Lose Yourself - Main Theme",
     "md5_image": "38e15bdcacaf7f9ead6bb3e04443072b"
    }
   },
   {
    "type": "track",
    "title": "Lose Yourself (Instrumental)",
    "duration": 336,
    "explicit_lyrics": false,
    "artist": {
     "name": "Sparsh Shah"
    },
    "album": {
     "title": "Purhythm (Tribute to Eminem)",
     "md5_image": "8c1b27717f21c0dd3db5525df9e495d3"
    }
   }
  ]
 }
};

export const notLikeUs: CatalogFixture = {
 "term": "Kendrick Lamar Not Like Us",
 "itunes": {
  "results": [
   {
    "kind": "song",
    "trackId": 1781353929,
    "artistName": "Kendrick Lamar",
    "trackName": "Not Like Us",
    "collectionName": "Not Like Us - Single",
    "trackTimeMillis": 274192,
    "releaseDate": "2024-05-04T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/3a/3f/313a3fbc-bb8f-80c7-b5a2-e226869a38cd/24UMGIM51924.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1828811586,
    "artistName": "Twinkle Twinkle Little Rock Star",
    "trackName": "Not Like Us",
    "collectionName": "Lullaby Versions of Kendrick Lamar",
    "trackTimeMillis": 170028,
    "releaseDate": "2025-08-15T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4e/8d/67/4e8d67e1-8cb8-e761-f39d-6362e8ceb0ae/198704631979_Cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1745553596,
    "artistName": "3 Dope Brothas",
    "trackName": "Not Like Us (Originally Performed by Kendrick Lamar) [Instrumental]",
    "collectionName": "Not Like Us (Originally Performed by Kendrick Lamar) [Instrumental] - Single",
    "trackTimeMillis": 270193,
    "releaseDate": "2024-05-09T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/43/4f/20/434f202f-a53e-3e25-0496-830eb4b3760b/198009695850.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1745763906,
    "artistName": "Troy Tha Studio Rat",
    "trackName": "Not Like Us (Originally Performed by Kendrick Lamar) [Instrumental Version]",
    "collectionName": "Not Like Us (Originally Performed by Kendrick Lamar) [Instrumental Version] - Single",
    "trackTimeMillis": 276836,
    "releaseDate": "2024-05-09T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4d/58/6c/4d586c4b-af89-36fd-b21e-c49eb87651f3/198342811542_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1765914317,
    "artistName": "Daxzeal",
    "trackName": "Kendrick Lamar (Not like us instrumental)",
    "collectionName": "Kendrick Lamar (Not like us instrumental) - Single",
    "trackTimeMillis": 175256,
    "releaseDate": "2024-08-28T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/2e/4b/212e4bdb-1704-5ea6-6e2e-26a1124713c4/artwork.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1889959299,
    "artistName": "Steve Hackman",
    "trackName": "Not Like Us (String Orchestra)",
    "collectionName": "THE KENDRICK LAMAR SUITE - EP",
    "trackTimeMillis": 165440,
    "releaseDate": "2026-04-24T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Pop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/86/4a/c3/864ac315-5ed8-ad9a-9e74-ee7bf89da2fd/1963624460133_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1473863127,
    "artistName": "Brantley Gilbert",
    "trackName": "Not Like Us",
    "collectionName": "Fire & Brimstone",
    "trackTimeMillis": 183933,
    "releaseDate": "2019-04-11T07:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Country",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/83/c7/06/83c706b5-5418-bbe1-68d8-c8dcc81be4dd/19OPBMR00635.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1746607700,
    "artistName": "Instrumental Legends",
    "trackName": "Not Like Us (In the Style of Kendrick Lamar) [Karaoke Version]",
    "collectionName": "Not Like Us (In the Style of Kendrick Lamar) [Karaoke Version] - Single",
    "trackTimeMillis": 142689,
    "releaseDate": "2024-05-15T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/cb/95/14/cb95145f-7fbb-540a-e04d-eca3caaa4b4b/197342616768_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1532910591,
    "artistName": "Brantley Gilbert",
    "trackName": "Not Like Us",
    "collectionName": "Fire & Brimstone (Deluxe Edition)",
    "trackTimeMillis": 183933,
    "releaseDate": "2019-04-11T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Country",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/6b/c0/13/6bc013e8-0a55-7ed6-9951-17991445dce2/20BMR0001598.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1756581130,
    "artistName": "Obsession",
    "trackName": "Not Like Us (Live)",
    "collectionName": "Obsession Live @ the Mgm (6.16.24)",
    "trackTimeMillis": 108682,
    "releaseDate": "2024-07-14T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "R&B/Soul",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/83/1f/30/831f3075-f77f-5b46-0349-5ffa7b9a4199/artwork.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1793867672,
    "artistName": "Unwrapped",
    "trackName": "Not Like Us (feat. Conrad Bauer & Karen Briggs)",
    "collectionName": "Unwrapped Vol. 9: The Songs of Kendrick Lamar Reimagined",
    "trackTimeMillis": 194851,
    "releaseDate": "2025-02-07T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Jazz",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0a/7a/b4/0a7ab40a-3c0c-22e4-ffc7-20196d0e1a62/25SYMIM17923.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1323125911,
    "artistName": "Ayo & Teo",
    "trackName": "Like Us",
    "collectionName": "Like Us - Single",
    "trackTimeMillis": 220227,
    "releaseDate": "2017-12-22T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/64/e0/e3/64e0e3e4-11be-5fc2-ea5a-1bfe3092f491/886446902203.jpg/100x100bb.jpg"
   }
  ]
 },
 "deezer": {
  "data": [
   {
    "type": "track",
    "title": "Not Like Us",
    "duration": 274,
    "explicit_lyrics": true,
    "artist": {
     "name": "Kendrick Lamar"
    },
    "album": {
     "title": "Not Like Us",
     "md5_image": "84345d29bc2ed8e713112425f8417e97"
    }
   },
   {
    "type": "track",
    "title": "Kendrick Lamar (Not like us instrumental)",
    "duration": 175,
    "explicit_lyrics": false,
    "artist": {
     "name": "Daxzeal"
    },
    "album": {
     "title": "Kendrick Lamar (Not like us instrumental)",
     "md5_image": "dc2948c630df597ba882b733448ac43c"
    }
   },
   {
    "type": "track",
    "title": "Super Bowl LIX Halftime Show (Live)",
    "duration": 800,
    "explicit_lyrics": true,
    "artist": {
     "name": "Kendrick Lamar"
    },
    "album": {
     "title": "Super Bowl LIX Live From New Orleans, LA",
     "md5_image": "4c4bba7669b11e452d0ab32315a4fcbc"
    }
   },
   {
    "type": "track",
    "title": "Not Like Us (8-Bit Kendrick Lamar Emulation)",
    "duration": 272,
    "explicit_lyrics": false,
    "artist": {
     "name": "8-Bit Arcade"
    },
    "album": {
     "title": "By Request, Vol. 259",
     "md5_image": "c4daccfce734ae0a7b6bdac756987aa9"
    }
   },
   {
    "type": "track",
    "title": "Not like us (Kendrick Lamar Disss)",
    "duration": 272,
    "explicit_lyrics": true,
    "artist": {
     "name": "TF Rocstar"
    },
    "album": {
     "title": "Not like us (Kendrick Lamar Disss)",
     "md5_image": "7dfa40e5e11d20c40fe982d30a74e882"
    }
   },
   {
    "type": "track",
    "title": "Like Us They Not (Parody of “Not Like Us” by Kendrick Lamar)",
    "duration": 97,
    "explicit_lyrics": true,
    "artist": {
     "name": "JD Charisma"
    },
    "album": {
     "title": "Like Us They Not (Parody of “Not Like Us” by Kendrick Lamar)",
     "md5_image": "401e059b44d066ff0e33a2fbadeb0627"
    }
   },
   {
    "type": "track",
    "title": "Not Like Us (Kendrick Lamar) [GAME BOY Sound]",
    "duration": 43,
    "explicit_lyrics": false,
    "artist": {
     "name": "ViralTrendTunz - Japan"
    },
    "album": {
     "title": "Not Like Us (Kendrick Lamar) [GAME BOY Sound]",
     "md5_image": "1cc0451c9fb1fdc1e6c25e9ec378a678"
    }
   },
   {
    "type": "track",
    "title": "Not Like U.S. — Parody of Not Like Us by Kendrick Lamar",
    "duration": 107,
    "explicit_lyrics": false,
    "artist": {
     "name": "Mat Ryxx"
    },
    "album": {
     "title": "Mat's Way (and No One Liked It)",
     "md5_image": "c067b9970f333a2b2f5c667640508aad"
    }
   },
   {
    "type": "track",
    "title": "Not Like Us",
    "duration": 195,
    "explicit_lyrics": false,
    "artist": {
     "name": "Unwrapped"
    },
    "album": {
     "title": "Unwrapped Vol. 9: The Songs of Kendrick Lamar Reimagined",
     "md5_image": "42ac6e57cb247cb7a84595030453a86a"
    }
   },
   {
    "type": "track",
    "title": "Feel It (Kendrick Lamar They Not Like Us mix)",
    "duration": 110,
    "explicit_lyrics": true,
    "artist": {
     "name": "Tay Rolla"
    },
    "album": {
     "title": "Feel It (Kendrick Lamar They Not Like Us mix)",
     "md5_image": "8ccd2f4e8093b9d71a349aa8c54cdf15"
    }
   }
  ]
 }
};

export const lucidDreams: CatalogFixture = {
 "term": "Juice WRLD Lucid Dreams",
 "itunes": {
  "results": [
   {
    "kind": "song",
    "trackId": 1447177630,
    "artistName": "Juice WRLD",
    "trackName": "Lucid Dreams",
    "collectionName": "Lucid Dreams - Single",
    "trackTimeMillis": 239960,
    "releaseDate": "2017-06-15T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/75/9b/af/759baf5f-f3c9-b8c7-d3cf-55a3079914b9/18UMGIM24792.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1687713627,
    "artistName": "Juice WRLD",
    "trackName": "Lucid Dreams (feat. Lil Uzi Vert) [Remix]",
    "collectionName": "Goodbye & Good Riddance (5 Year Anniversary Edition)",
    "trackTimeMillis": 240437,
    "releaseDate": "2021-05-28T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/bb/7d/d3/bb7dd31e-d32a-6e8c-c4f5-5d80e5d72426/23UMGIM49821.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1618089381,
    "artistName": "Juice WRLD",
    "trackName": "Lucid Dreams",
    "collectionName": "Goodbye & Good Riddance (Anniversary)",
    "trackTimeMillis": 239836,
    "releaseDate": "2017-06-15T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/f8/6c/2a/f86c2ae0-b4eb-578c-1f02-3acb8409b815/21UMGIM53733.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1687712926,
    "artistName": "Juice WRLD",
    "trackName": "Lucid Dreams",
    "collectionName": "Goodbye & Good Riddance (5 Year Anniversary Edition)",
    "trackTimeMillis": 239836,
    "releaseDate": "2017-06-15T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/bb/7d/d3/bb7dd31e-d32a-6e8c-c4f5-5d80e5d72426/23UMGIM49821.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1618089738,
    "artistName": "Juice WRLD",
    "trackName": "Lucid Dreams (feat. Lil Uzi Vert) [Remix]",
    "collectionName": "Goodbye & Good Riddance (Anniversary)",
    "trackTimeMillis": 240437,
    "releaseDate": "2021-05-28T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Hip-Hop/Rap",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/f8/6c/2a/f86c2ae0-b4eb-578c-1f02-3acb8409b815/21UMGIM53733.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1406587629,
    "artistName": "Instrumental King",
    "trackName": "Lucid Dreams (In the Style of Juice WRLD) [Karaoke Version]",
    "collectionName": "Lucid Dreams (In the Style of Juice WRLD) [Karaoke Version] - Single",
    "trackTimeMillis": 205714,
    "releaseDate": "2018-07-05T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Karaoke",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/83/52/5c/83525c21-f82a-aa0c-be88-8ee6d0fd60f6/888915667064_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1533003206,
    "artistName": "Twinkle Twinkle Little Rock Star",
    "trackName": "Lucid Dreams",
    "collectionName": "Lullaby Versions of Juice WRLD",
    "trackTimeMillis": 356727,
    "releaseDate": "2020-10-02T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Children's Music",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/ba/fb/df/bafbdfee-72c7-8a4f-1de8-d01a2bbf485a/192641567827_Cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1627840447,
    "artistName": "Imaginary Landscapes",
    "trackName": "Lucid Dreams",
    "collectionName": "Lucid Dreams - Single",
    "trackTimeMillis": 237656,
    "releaseDate": "2021-01-12T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "New Age",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/a3/c8/86/a3c8866c-d1e2-1bfa-7957-83a983faca86/196697574129.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1629888045,
    "artistName": "Lofi Fruits Music & Chill Fruits Music",
    "trackName": "Lucid Dreams (Shape Of My Heart)",
    "collectionName": "Lofi Fruits Remix, Vol. 1 - EP",
    "trackTimeMillis": 120625,
    "releaseDate": "2022-06-24T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Easy Listening",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/be/e6/3f/bee63fc7-f189-5426-8b51-3e383ca8db15/190296084621.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1832554976,
    "artistName": "311",
    "trackName": "Lucid Dreams",
    "collectionName": "Voyager",
    "trackTimeMillis": 229379,
    "releaseDate": "2019-07-12T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Rock",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/fd/55/3efd557c-dfcc-4e69-48d0-dcd5e92d9ffd/4050538515244.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1523386092,
    "artistName": "Brandy",
    "trackName": "Lucid Dreams",
    "collectionName": "b7",
    "trackTimeMillis": 221492,
    "releaseDate": "2020-07-31T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "R&B/Soul",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/0b/8e/a2/0b8ea2f0-333d-a6f9-70f9-acf9e9457ae5/634164638528.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1781638256,
    "artistName": "JYYE & Julia Temos",
    "trackName": "Lucid Dreams",
    "collectionName": "Lucid Dreams - Single",
    "trackTimeMillis": 173212,
    "releaseDate": "2024-12-20T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "House",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e5/18/53/e51853da-4a7c-26cc-7e5c-7a6670c897c2/cover.jpg/100x100bb.jpg"
   }
  ]
 },
 "deezer": {
  "data": [
   {
    "type": "track",
    "title": "Lucid Dreams",
    "duration": 239,
    "explicit_lyrics": true,
    "artist": {
     "name": "Juice WRLD"
    },
    "album": {
     "title": "Goodbye & Good Riddance",
     "md5_image": "f8c4db1b0f346d6e4b1558f734ad4523"
    }
   },
   {
    "type": "track",
    "title": "Lucid Dreams (Remix)",
    "duration": 240,
    "explicit_lyrics": true,
    "artist": {
     "name": "Juice WRLD"
    },
    "album": {
     "title": "Goodbye & Good Riddance (Anniversary)",
     "md5_image": "6ce190e9b4364b1a33df9daf9e18ad83"
    }
   },
   {
    "type": "track",
    "title": "Lucid Dreams (Originally Performed By Juice Wrld) (Karaoke Version)",
    "duration": 224,
    "explicit_lyrics": false,
    "artist": {
     "name": "B Lou"
    },
    "album": {
     "title": "Lucid Dreams (Originally Performed By Juice Wrld) (Karaoke Version)",
     "md5_image": "7b8c9b035bc9e80b632cbd3b0e9e4858"
    }
   },
   {
    "type": "track",
    "title": "Lucid Dreams (R.I.P Juice Wrld) (Live)",
    "duration": 140,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sosa Xo"
    },
    "album": {
     "title": "Long Live Chris Jeffries",
     "md5_image": "89896b5c568f6874e07f5e3775ff6824"
    }
   },
   {
    "type": "track",
    "title": "Lucid Dreams (Instrumental)",
    "duration": 200,
    "explicit_lyrics": false,
    "artist": {
     "name": "Lo-Fi Dreamers"
    },
    "album": {
     "title": "Lofi Renditions of Juice Wrld (Instrumental)",
     "md5_image": "c8fb28b00b1e2d470c8a9b7046be85cb"
    }
   },
   {
    "type": "track",
    "title": "juice wrld lucid dreams",
    "duration": 319,
    "explicit_lyrics": false,
    "artist": {
     "name": "Aiden Yoo"
    },
    "album": {
     "title": "juice wrld lucid dreams",
     "md5_image": "ce4a4215e132a78b401ac1aa347c0816"
    }
   },
   {
    "type": "track",
    "title": "Juice Wrld Lucid Dreams",
    "duration": 133,
    "explicit_lyrics": false,
    "artist": {
     "name": "Lee Sang Gul"
    },
    "album": {
     "title": "Wrong Turn 2",
     "md5_image": "117745bf91a1f0ece0a04618e1987835"
    }
   },
   {
    "type": "track",
    "title": "Juice Wrld Lucid Dreams",
    "duration": 133,
    "explicit_lyrics": false,
    "artist": {
     "name": "Aiden Yoo"
    },
    "album": {
     "title": "Wrong Turn 2",
     "md5_image": "d84e4ac7ac9a5004c92b682251378642"
    }
   },
   {
    "type": "track",
    "title": "rockstar song",
    "duration": 161,
    "explicit_lyrics": false,
    "artist": {
     "name": "Aiden Yoo"
    },
    "album": {
     "title": "juice wrld lucid dreams",
     "md5_image": "ce4a4215e132a78b401ac1aa347c0816"
    }
   },
   {
    "type": "track",
    "title": "dulla bagga pind",
    "duration": 161,
    "explicit_lyrics": false,
    "artist": {
     "name": "Aiden Yoo"
    },
    "album": {
     "title": "juice wrld lucid dreams",
     "md5_image": "ce4a4215e132a78b401ac1aa347c0816"
    }
   }
  ]
 }
};

export const espresso: CatalogFixture = {
 "term": "Sabrina Carpenter Espresso",
 "itunes": {
  "results": [
   {
    "kind": "song",
    "trackId": 1746801012,
    "artistName": "Sabrina Carpenter",
    "trackName": "Espresso (On Vacation Version)",
    "collectionName": "Espresso EP",
    "trackTimeMillis": 175459,
    "releaseDate": "2024-05-17T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Pop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/57/e8/7b/57e87ba0-5057-9bb9-c247-ce7dbe426e89/24UMGIM55213.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1752214923,
    "artistName": "Sabrina Carpenter",
    "trackName": "Espresso",
    "collectionName": "Short n' Sweet",
    "trackTimeMillis": 175459,
    "releaseDate": "2024-06-14T07:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Pop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1744253558,
    "artistName": "Sabrina Carpenter",
    "trackName": "Espresso",
    "collectionName": "Espresso - Single",
    "trackTimeMillis": 175459,
    "releaseDate": "2024-06-14T12:00:00Z",
    "trackExplicitness": "cleaned",
    "primaryGenreName": "Pop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3a/09/fa/3a09fabd-7a71-d0d7-3e6a-7f3c4c89014e/24UMGIM32304.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1776626304,
    "artistName": "Linneo",
    "trackName": "Espresso (Piano Version)",
    "collectionName": "Piano Covers (Vol. 2)",
    "trackTimeMillis": 206184,
    "releaseDate": "2024-11-06T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Classical Crossover",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ba/5a/12/ba5a1280-9b66-2f75-26b2-176d25d802b1/196872592191.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1755237069,
    "artistName": "Vitamin String Quartet",
    "trackName": "Espresso",
    "collectionName": "Espresso - Single",
    "trackTimeMillis": 175463,
    "releaseDate": "2024-07-19T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Classical Crossover",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/90/09/c0/9009c06c-ce1c-5747-ba12-9c1db0baf77f/1786.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1760370421,
    "artistName": "blue toro",
    "trackName": "Espresso (Piano Version)",
    "collectionName": "Espresso (Piano Version) - Single",
    "trackTimeMillis": 212385,
    "releaseDate": "2024-08-07T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Classical Crossover",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/39/20/f4/3920f4ec-7a9c-e1a1-6d32-b0d09023e990/5059449187396.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1750307079,
    "artistName": "Sabrina Carpenter",
    "trackName": "Taste",
    "collectionName": "Short n' Sweet",
    "trackTimeMillis": 157280,
    "releaseDate": "2024-08-23T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Pop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f6/15/d0/f615d0ab-e0c4-575d-907e-1cc084642357/24UMGIM61704.rgb.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1755191503,
    "artistName": "Piano Covers",
    "trackName": "Sabrina Carpenter - Espresso - Piano Cover",
    "collectionName": "Sabrina Carpenter - Espresso - Piano Cover - Single",
    "trackTimeMillis": 195633,
    "releaseDate": "2024-07-02T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Pop",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/86/73/11/86731123-5375-c359-1c82-a3e346bf4606/8721093433835.png/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1771197939,
    "artistName": "Wrightsmind Media",
    "trackName": "Espresso - Sabrina Carpenter (Wrightsmind Media Remix)",
    "collectionName": "Espresso - Sabrina Carpenter (Wrightsmind Media Remix) - Single",
    "trackTimeMillis": 218200,
    "releaseDate": "2024-09-25T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "House",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1f/c9/3b/1fc93bbf-42f1-4385-0a3a-34d60f4e0451/artwork.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1754872588,
    "artistName": "Thomas The Beat Engine & Lullaby Dreams",
    "trackName": "Espresso - Sabrina Carpenter for Babies (Lullapop)",
    "collectionName": "Espresso - Sabrina Carpenter for Babies (Lullapop) - Single",
    "trackTimeMillis": 133421,
    "releaseDate": "2024-07-26T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Lullabies",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a6/ed/d0/a6edd010-b23e-e4f2-4b14-64005e94c679/1963622313158_cover.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1757890026,
    "artistName": "Vitamin String Quartet",
    "trackName": "Espresso",
    "collectionName": "VSQ Performs the Hits Of 2024",
    "trackTimeMillis": 175773,
    "releaseDate": "2024-07-19T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Classical Crossover",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c5/63/57/c5635747-b6c7-0411-e458-660ef71e3a5a/1789.jpg/100x100bb.jpg"
   },
   {
    "kind": "song",
    "trackId": 1754873078,
    "artistName": "Thomas The Beat Engine & Lullapop Dreams",
    "trackName": "Espresso - Sabrina Carpenter for Babies (Lullapop)",
    "collectionName": "Lullapop - Lullaby Pop Covers Vol. 2 - EP",
    "trackTimeMillis": 133421,
    "releaseDate": "2024-07-26T12:00:00Z",
    "trackExplicitness": "notExplicit",
    "primaryGenreName": "Lullabies",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/cd/75/c8/cd75c864-5b5f-8396-a305-8d0e727b8d7b/1963622313271_cover.jpg/100x100bb.jpg"
   }
  ]
 },
 "deezer": {
  "data": [
   {
    "type": "track",
    "title": "Espresso",
    "duration": 175,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso",
     "md5_image": "e3221287a77eb262944e6528766eeba4"
    }
   },
   {
    "type": "track",
    "title": "Espresso (Mark Ronson x FNZ Working Late Remix)",
    "duration": 184,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso (Working Late Remixes)",
     "md5_image": "24ea34fedcbdf347c3d768c2174899cc"
    }
   },
   {
    "type": "track",
    "title": "Espresso (Espressooooo Version)",
    "duration": 295,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso EP",
     "md5_image": "49188ee5df33ede750354e21ad20a13c"
    }
   },
   {
    "type": "track",
    "title": "Espresso (Double Shot Version)",
    "duration": 149,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso EP",
     "md5_image": "49188ee5df33ede750354e21ad20a13c"
    }
   },
   {
    "type": "track",
    "title": "Espresso (On Vacation Version)",
    "duration": 175,
    "explicit_lyrics": false,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso EP",
     "md5_image": "49188ee5df33ede750354e21ad20a13c"
    }
   },
   {
    "type": "track",
    "title": "Espresso (Decaf Version)",
    "duration": 194,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso EP",
     "md5_image": "49188ee5df33ede750354e21ad20a13c"
    }
   },
   {
    "type": "track",
    "title": "Espresso (Mark Ronson x FNZ Working Later Remix)",
    "duration": 338,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso (Working Late Remixes)",
     "md5_image": "24ea34fedcbdf347c3d768c2174899cc"
    }
   },
   {
    "type": "track",
    "title": "Espresso (Mochapella Version)",
    "duration": 175,
    "explicit_lyrics": true,
    "artist": {
     "name": "Sabrina Carpenter"
    },
    "album": {
     "title": "Espresso EP",
     "md5_image": "49188ee5df33ede750354e21ad20a13c"
    }
   },
   {
    "type": "track",
    "title": "Espresso (From Sabrina Carpenter)",
    "duration": 208,
    "explicit_lyrics": true,
    "artist": {
     "name": "Oliver"
    },
    "album": {
     "title": "Espresso (From Sabrina Carpenter)",
     "md5_image": "e081f867ebb8fd8f769c6f7a87d1fb96"
    }
   },
   {
    "type": "track",
    "title": "Espresso - Sabrina Carpenter for Babies",
    "duration": 133,
    "explicit_lyrics": false,
    "artist": {
     "name": "Thomas The Beat Engine"
    },
    "album": {
     "title": "Espresso - Sabrina Carpenter for Babies",
     "md5_image": "84e7f39e02be16f9b80dfb34473e1859"
    }
   }
  ]
 }
};
