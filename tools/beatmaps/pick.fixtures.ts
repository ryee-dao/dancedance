/**
 * Real yt-dlp flat search results (2026-11-10, trimmed: description is the
 * first 40 characters of the search snippet), for the two queries of each song.
 * Columns: id, title, channel, verified, views, duration, description.
 */
import type { SearchEntry } from './pick';

type Row = [string, string, string, boolean, number | null, number | null, string];
const rows = (r: Row[]): SearchEntry[] =>
  r.map(([id, title, channel, verified, views, duration, description]) => ({ id, title, channel, verified, views, duration, description, liveStatus: null }));

/** "Taylor Swift Shake It Off lyrics" + "Taylor Swift Shake It Off official audio" */
export const shakeItOff = rows([
  ["Z4A9ZZo_rAE", "Taylor Swift - Shake It Off (Lyrics)", "Lost Panda", true, 10438162, 220, "Welcome to Lost Panda “Taylor Swift - Sh"],
  ["8xG7mH8i-WE", "Shake It Off - Taylor Swift (Lyrics) 🎵", "Pillow", false, 55341345, 218, "Check out PillowQuotes: https://www.yout"],
  ["XJSGoZo9888", "Taylor Swift - Shake It Off (Lyrics - LEGENDADO) (Official Video)", "Victor Oliveira", false, 171568, 231, "Jessie J, Ariana Grande, Nicki Minaj - B"],
  ["zIOVMHMNfJ4", "Shake It Off (With Lyrics) - Taylor Swift", "LyricsBy KatieB", false, 44134136, 216, "Shake It Off By Taylor Swift With Lyrics"],
  ["YytmnsOPWyk", "Shake It Off - Taylor Swift (Lyrics) 🎵", "Pillow", false, 1695657, 223, "Check out PillowQuotes: https://www.yout"],
  ["w9uTc7_FB_0", "Taylor Swift - Shake It Off (Lyrics)", "Watermelon Music", true, 315778, 219, "Taylor Swift - Shake It Off (Taylor's Ve"],
  ["mvVBuG4IOW4", "Taylor Swift - Shake It Off (Taylor's Version) (Lyric Video)", "Taylor Swift", true, 33012580, 225, "Watch the official lyric video for “Shak"],
  ["sM1KXG-RtYg", "Taylor Swift - Shake It Off (Lyrics)", "Khant's Lyrics", false, 33393, 227, "Taylor Swift - Shake It Off (Lyrics) Fol"],
  ["c-AgYomOouY", "Taylor Swift - Shake It Off (Lyrics)", "LyricLandia", false, 122168, 220, "Thank you very much for watching! /// He"],
  ["ldWguMzyyPk", "Taylor Swift - Shake It Off (Taylor's Version) // Sub Español + Lyrics // Video Oficial", "BrunoTraductor Official", true, 919916, 232, "Ayúdanos con una donación, si deseas: pa"],
  ["nfWlot6h_JM", "Taylor Swift - Shake It Off", "Taylor Swift", true, 3750108493, 242, "Music video by Taylor Swift performing S"],
  ["H59xVMF4zxE", "Shake It Off (Taylor's Version)", "Taylor Swift", true, 7336651, 220, "Provided to YouTube by Universal Music G"],
  ["w9E7tRTkf5E", "Taylor Swift - Shake It Off (Audio)", "Music Topic BR", false, 1908097, 220, "Album 1989 D.L.X."],
  ["k0TEcUm7lTk", "Taylor Swift   Shake It Off Audio HQ", "Tyler Heller", false, 1783356, 220, "Description."],
  ["9M-h3AthyMU", "Taylor Swift - Shake It Off (Audio)", "gran republica records", false, 6861, 221, "Taylor's Swift #1989TS.DLX. http://smart"],
  ["enE6l4pq3hY", "Taylor Swift - Shake It Off - Official Music HQ Sound", "BKLYN SOUNDS", false, 1088550, 220, "Descripción."],
  ["P8ZnjqbOuyc", "Taylor Swift - Shake It Off (in the Live Lounge)", "BBCRadio1VEVO", true, 6109436, 225, "Taylor Swift performs Shake It Off in th"],
]);

/** "Bee Gees Stayin' Alive lyrics" + "Bee Gees Stayin' Alive official audio" */
export const stayinAlive = rows([
  ["WlgoUlOkyzU", "Bee Gees Stayin' Alive   lyrics", "Music n Lyrics", false, 20878299, 249, "Please like and Subscribe Visit my Chann"],
  ["KaU8tQOuNUQ", "Bee Gees  - Stayin' Alive (Lyrics)", "Tu Lyrics", false, 182371, 243, ""],
  ["_Vj092UgKwQ", "Stayin' Alive - Bee Gees (lyrics)", "Kristina Khatib", false, 51325752, 284, "Stayin' Alive lyrics! Enjoy! NOTE: No co"],
  ["UMANMEfZtYA", "Bee Gees - Stayin' Alive [Lyrics]", "GlyphoricVibes", true, 6913689, 286, "If you're enjoying the content, you're w"],
  ["ptN-V9m-p8A", "The Bee Gees - Staying Alive (Lyrics HD)", "Song Lyrics HD", false, 17136, 293, "Listen to \"Staying Alive\" By The Bee Gee"],
  ["fNFzfwLM72c", "Bee Gees - Stayin' Alive (Official Music Video)", "beegees", true, 514269307, 250, "Bee Gees \"Stayin' Alive\" official music "],
  ["qr-_iuS3EZ8", "The Lyrics Of The Bee Gees- Stayin' Alive", "LyricsOfTheBeeGees", false, 714694, 293, "The Lyrics Of The Bee Gees brings you th"],
  ["TnMoap8yBpE", "Bee Gees - Stayin' Alive (Lyrics)", "Cool Lyrics ", false, 1574, 250, "StayinAlive #BeeGees #Lyrics Bee Gees - "],
  ["S1iuOIu7esM", "Bee gee's - Stayin' Alive ~ LYRICS", "AstrumTheMusicMan", false, 582, 284, "this is gonna be at my funeral."],
  ["sduGaRBNAsc", "Bee Gees Stayin' Alive Lyrics", "Magzshus", false, 624, 286, "Stayin' Alive [Lyrics]  : [Verse 1] Well"],
  ["bVVwmRbBZ-I", "Bee Gees - Staying Alive (Audio)", "YOUMUSIC", true, 1130383, 243, ""],
  ["GbsFCYEJGZ0", "Stayin' Alive (From \"Saturday Night Fever\" Soundtrack)", "beegees", true, 650756, 285, "Provided to YouTube by Universal Music G"],
  ["I_izvAbhExY", "Bee Gees - Stayin' Alive (Official Video)", "beegees", true, 951475810, 250, "Bee Gees \"Stayin' Alive\" official music "],
  ["ZTh6TsARvWI", "The Bee Gees - Stayin' Alive (2021 Remaster)", "Stereo Classics", false, 61001, 291, "New remaster of the six Bee Gees tracks "],
  ["8lytDLaMfls", "Bee Gees - Stayin' Alive (Remastered)", "Vevo Music Group", false, 343484, 420, "Provided to YouTube by UMG Stayin' Alive"],
  ["aZ5fQyiZgns", "Stayin' Alive", "beegees", true, 6894849, 93, "Provided to YouTube by Universal Music G"],
  ["orrBiGO-gGs", "Bee Gees - Stayin' Alive (Remastered / Audio)", "TheStruckFernVEVO", false, 2991, 287, "Music video by Bee Gees performing Stayi"],
  ["DY7pipZGUkg", "Bee Gees ~ Stayin' Alive 1977 Disco Purrfection Version", "DJDiscoCat", false, 6911162, 631, "Robert Stigwood was looking around for a"],
  ["nAm7PJ0vH9w", "Bee Gees - Stayin' Alive [ HQ - FLAC ]", "Music Spasm", false, 111149, 281, "The Bee Gees were a music group formed i"],
]);

/** "Shakira Hips Don't Lie lyrics" + "Shakira Hips Don't Lie official audio" */
export const hipsDontLie = rows([
  ["fNRXD393cfs", "Shakira - Hips Don't Lie (Lyrics) ft. Wyclef Jean", "7clouds", true, 20527037, 219, "Follow the official 7clouds playlist on "],
  ["DUT5rEU6pqM", "Shakira - Hips Don't Lie (featuring Wyclef Jean) (Official 4K Video) ft. Wyclef Jean", "Shakira", true, 1936881761, 219, "Official 4K Video \"Hips Don't Lie\" by Sh"],
  ["Au10FTUDdSg", "Shakira & Wyclef Jean - \"Hips don't lie\" (Lyrics)", "𝗚𝗼𝗼𝗱 𝗩𝗶𝗯𝗲𝘀", false, 10891, 215, "Shakira, Shakira           Video quality"],
  ["p3pEe6aAJ4k", "Shakira - Hips Don't Lie (Lyrics) ft. Wyclef Jean", "7clouds Rock", true, 67730574, 219, "Follow the official 7clouds playlist on "],
  ["EPKHC59Fpko", "Shakira - Hips Don't Lie + Lyrics", "lgplyrics", false, 25539690, 215, "Shakira featuring Wyclef Jean - Hips Don"],
  ["dWErisOfeyE", "Shakira-Hips Don't Lie lyrics!", "Citlali Jimenez", false, 126231064, 225, "I apologize for any mistakes in the vide"],
  ["H83MftsV480", "Shakira - Hips Don't Lie (Lyrics) ft. Wyclef Jean", "Vibe Music", true, 2692715, 218, "Shakira - Hips Don't Lie ft. Wyclef Jean"],
  ["MyBisbAFRDw", "Shakira, Wyclef Jean - Hips Don't Lie (Lyrics)", "Chivateando x world", false, 11754, 219, "CHIVATEANDO X WORLD• Video lyrics con fl"],
  ["blOVPZFLiFo", "Shakira - Hips Don't Lie (Lyrics) ft. Wyclef Jean", "7clouds TikTok ", true, 7170855, 219, "Follow the official 7clouds playlist on "],
  ["eqmP9dcMtWM", "Shakira Hips Don't Lie Lyrics", "Galaxy Beat", false, 99, 215, "Shakira #HipsDontLie #DanceChallenge #Mu"],
  ["rONPuz9xMdo", "Shakira Hips Don't Lie Audio", "StitchTheStitch", false, 615081, 224, ""],
  ["2Ndra-1Pwug", "Shakira & Wyclef Jean - Hips Don't Lie (Live from LMYNL World Tour)", "Shakira", true, 124376418, 296, "Shakira & Wyclef Jean reunite on stage t"],
  ["JDjunuWB3Jo", "Shakira - Hips Don't Lie feat. Wycleaf Jean", "Pizza Music", true, 2740840, 220, "Shakira - Hips Don't Lie (Lyrics) ft. wy"],
  ["41ZY18JqI2A", "Shakira, Ed Sheeran, Beéle - Hips Don't Lie (Anniversary Version)", "Shakira and 2 more", true, 121908938, 217, "Shakira performs Hips Don't Lie with Ed "],
  ["y46mHQA5d0w", "Shakira - Hips Don't Lie (ft. Wyclef Jean) [Audio]", "musicinthemorning", false, 2974, 220, "Shakira - Hips Don't Lie (ft. Wyclef Jea"],
  ["Q0zYjFJhd-4", "Hips Don't Lie - Bamboo", "Shakira", true, 4916265, 216, "Provided to YouTube by Epic Hips Don't L"],
  ["hYpkyM-DMqM", "Shakira - Hips Don't Lie (Lyrics/Letra) ft. Wyclef Jean", "ReggaetonVibes Channel", false, 175185, 221, "Shakira - Hips Don't Lie (Lyrics/Letra) "],
]);

/** "a-ha Take On Me lyrics" + "a-ha Take On Me official audio" */
export const takeOnMe = rows([
  ["hGPL5rzd3tQ", "a-ha - Take On Me (Lyrics)", "Vibe Music", true, 4715467, 226, "a-ha - Take On Me Stream/Download: • a-h"],
  ["kmDBDn8Ju6w", "a-ha - Take On Me (Lyrics)", "7clouds Acoustic", false, 4030621, 227, "Follow the official 7clouds playlist on "],
  ["irljBY9J5ig", "a-Ha - Take On Me [lyrics]", "Lyricosaurus", false, 11980495, 230, "Mirai Nikki OP 3 https://www.youtube.com"],
  ["djV11Xbc914", "a-ha - Take On Me (Official Video) [4K]", "a-ha", true, 2531336217, 244, "Take On Me” has been remastered in stunn"],
  ["II4sfbrsdn4", "a-ha - Take On Me (Lyrics)", "Aqua Lyrics", false, 4371770, 226, "a-ha - Take On Me (Lyrics) Follow a-ha :"],
  ["rINQoPWVc_U", "a-ha - Take On Me (lyrics)", "Gootie Music", true, 852965, 228, "https://www.facebook.com/gootiealbernaz "],
  ["NJMDEsCI9Sg", "a ha   Take On Me Lyrics", "Martin Reyes Reyes", false, 221, 226, ""],
  ["n-Xp75yJ6xc", "a-ha - Take On Me (Lyrics)", "Pizza Music", true, 3862976, 226, "a-ha - Take On Me Get: Lyrics: [Verse 1]"],
  ["1IAOJtnB6pA", "a-Ha - Take On Me [lyrics]", "MIKA Studioz", false, 2059, 230, "a-Ha - Take On Me [lyrics] AND THANKS FO"],
  ["592NXqBIp8w", "a-ha - Take On Me // Lyircs + Español // Video Oficial", "BrunoTraductor Official", true, 34242, 245, "Ayúdanos con una donación, si deseas: ht"],
  ["NaQ083rNUwc", "Take on Me (2016 Remaster)", "a-ha", true, 8526488, 228, "Provided to YouTube by Rhino/Warner Reco"],
  ["-iKeUC5_Wyw", "Take on Me (Video Version) [2015 Remaster]", "a-ha", true, 4570465, 225, "Provided to YouTube by Rhino/Warner Reco"],
  ["gRTm0Ej2mq8", "A-Ha - Take On Me (HQ audio)", "Hotgrenade", false, 815678, 229, "Subscribe to my new channel: https://www"],
  ["hyPudrPNSuQ", "A-ha - Take on Me (MTV Unplugged - Summer Solstice) [Tradução]", "Mais 1 Clipe Com Legenda", false, 1063131, 235, "Performance acústica da banda Norueguesa"],
  ["X50VeoRaNmY", "a-ha - Take On Me (Symphonic Version) (Official Audio)", "a-ha", true, 1165321, 232, "You're listening to the official audio o"],
  ["QchhC4yhdhc", "A-ha  Take On Me live 2017", "Our memory", false, 362924, 325, "A-ha - MTV Unplugged: Summer Solstice 20"],
  ["uAqW9uJi2-g", "A-ha  - Take On Me (Official 1984 Music Video)", "Old But Gold - Musik Nostalgie", false, 76763, 203, "The official Video for \"Take On Me\" made"],
]);
