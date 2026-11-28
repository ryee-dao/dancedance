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

/** "21 Savage, Offset & Metro Boomin Rap Saved Me lyrics" + "21 Savage, Offset & Metro Boomin Rap Saved Me official audio" */
export const rapSavedMe = rows([
  ["HXNQfg8OfTg", "c21 Savage, Offset & Metro Boomin - \"Rap Saved Me\" Ft Quavo (Lyrics)", "Melody Masters", false, 3258, 261, "music #lyrics #videolyrics #toplyrics #l"],
  ["TiKiJvRqn_k", "21 Savage, Offset & Metro Boomin - Rap Saved Me feat. Quavo (Lyrics)", "Deprikind.ッ/LyricsChannel", false, 4407, 258, "Artists: 21 Savage, Offset, Metro Boomin"],
  ["LK9rgGmrH7I", "21 Savage, Offset & Metro Boomin - \"Rap Saved Me\" Ft Quavo (Official Audio)", "21 Savage", true, 51449424, 258, "Listen to the official audio of \"Rap Sav"],
  ["NgieuRd1Hqg", "Rap Saved Me - 21 Savage (lyrics)", "SoundClout Lyrics", false, 64706, 255, ""],
  ["51HpCVo3H7g", "21 Savage - Rap Saved Me (Lyrics)", "Elijah Lyrics", false, 5573, 261, "21 Savage - Saved Me (Lyrics) - Enjoy."],
  ["ZPaT0eub0_g", "21 Savage, Offset & Metro Boomin – Rap Saved Me (ft. Quavo) - Lyrics", "RAP TRACK", false, 298497, 260, "Rap Saved Me Lyrics [Intro: 21 Savage & "],
  ["wq8y80S4BVU", "21 Savage & Offset & Metro Boomin & Quavo - Rap Saved Me (Lyrics)", "Lyrical Archive", false, 111, 259, "Album: Without Warning Writer(s): Quavio"],
  ["ywAJSXADr3w", "21 Savage, Offset & Metro Boomin - \"Rap Saved Me\" Ft Quavo 가사/ 해석", "black.", false, 1280, 257, ""],
  ["LPTlvQ1Zet0", "21 Savage, Offset, Metro Boomin - Ric Flair Drip (Official Music Video)", "21 Savage", true, 563671638, 189, "\"Without Warning\" available at http://sm"],
  ["HQsRElU2NN0", "21 Savage, Offset & Metro Boomin – Rap Saved Me ft  Quavo   Lyrics", "ericvfxx x", false, 544, 14, "o own no audio in this video."],
  ["WQL6zlobUJg", "21 Savage, Offset & Metro Boomin - Rap Saved Me Feat. Quavo (Without Warning)", "Quality Control Music", true, 51818, 260, "21 Savage, Offset & Metroo Boomin - AVAI"],
  ["ickaQIf9AhA", "21 Savage, Offset, Metro Boomin - Rap Saved Me (feat. Quavo) | Official Audio", "Top Music Archive", false, 672, 258, "Tired of slow, risky online converters? "],
  ["1u_Fz7opf-M", "21Savage, Offset & Metro Boomin - \"Rap Saved Me\" Ft Quavo (Official Audio)", "21SavageVEVO", false, 1235, 258, ""],
  ["LLnyo8Yqx20", "Rap Saved Me - Metro Boomin, 21 Savage & Offset Ft Quavo Without Warning(Fan Video)", "Big Bang", false, 107926, 260, "rap saved me, 21 savage, offset, metro b"],
  ["YQbpiY2uXmI", "21 Savage, Metro Boomin - Rap Saved Me (ft. Offest) • 432Hz", "Katsuo's Music", false, 2156, 263, "I don't own any of these songs that I po"],
  ["r-sK4jS8w8Y", "21 Savage, Offset, Metro Boomin - Rap Saved Me ft Quavo [official audio]", "21 Savage - Topic", false, 534, 258, ""],
  ["CWtdqDxhKPM", "Metro Boomin, 21 Savage & Offset - Rap Saved Me Feat. Quavo (Without Warning)", "RAPSTAR", true, 2691613, 260, "Metro Boomin, 21 Savage & Offset - Witho"],
]);

/** "Fred again.. & Delilah Montagu Delilah lyrics" + "Fred again.. & Delilah Montagu Delilah official audio" */
export const delilah = rows([
  ["3U5VhRZVD4k", "Fred again.. - Delilah (pull me out of this) [Lyrics]", "Dance Paradise", true, 108195, 251, "Welcome to Dance Paradise Your Home For "],
  ["qivkhBfHZYQ", "fred again.., delilah montagu - delilah (pull me out of this) [ japanese lyrics ]", "onlymaruu", false, 1055, 251, "sub for more of your fav asian artist's "],
  ["Cl6Rz1Uvi2M", "Fred again.. - Delilah (pull me out of this)", "Fred again . .", true, 16894505, 252, "Okayyyy SO I am so so really very VERY h"],
  ["7ZXRc-tTehE", "Delilah Montagu - Delilah (pull me out of this) (Acoustic - Visualiser)", "DelilahMontaguVEVO", false, 410914, 200, "Music video by Delilah Montagu performin"],
  ["RhkBLR9E4po", "Fred again.. - Delilah (pull me out of this) (Lyrics)", "Calm Chubby Cat ", false, 4120, 254, "You can listen here: https://FredAgain.l"],
  ["GA8uMBOrXOk", "Fred again.. - Delilah (pull me out of this) (Lyrics)", "Vibe Alone", false, 383, 311, "Fred again.. - Delilah (pull me out of t"],
  ["2_64XAqYgJ0", "Fred again.. - Delilah (pull me out of this) / Billie (loving arms) | Glastonbury 2023", "BBC Music", true, 9519849, 604, "Fred again.. performs Delilah (pull me o"],
  ["d943B3MUlbg", "Fred Again.. - Delilah (pull me out of this) | Kaleidoscope Orchestra Version", "Kaleidoscope Orchestra", false, 799233, 254, "fredagain #delilah #orchestra Music by B"],
  ["Q7Zk-2zxbfo", "Delilah Montagu - Lost Keys (Lyrics)", "Mr.Radio", true, 26618, 226, "Delilah Montagu - Lost Keys ▪️ Discover "],
  ["0e8rJGXVKHQ", "Fred Again - Shrine LA 11-2-2023 with Delilah Montagu (pull me out of this) Live", "Eric Baja", false, 554647, 451, "Song: Delilah (pull me out of this) Live"],
  ["BxtE6PMmdvg", "Delilah Montagu on the Fred Again Viral Boiler Room Moment", "Songs You Know with Toby Gad", false, 80904, 387, "Full conversation: https://youtu.be/SBLD"],
  ["7exVPb0_KL8", "Fred again..- Delilah (pull me out of this)", "Selected.", true, 1268460, 251, "Selected - Music on a new level. » Spoti"],
  ["vMbaW5xwXSM", "Fred Again.. - Delilah (Pull Me Out Of This)", "Rest Your Soul", false, 4684, 252, "Rest Your Soul - Musics of another world"],
  ["4iQmPv_dTI0", "Fred again..: Tiny Desk Concert", "NPR Music", true, 17853030, 1605, "Teresa Xie | April 10, 2023 When Fred ag"],
  ["GnF67BaFa1g", "Fred again - Delilah (pull me out of this) live rework", "Mr Wolf", false, 151968, 146, "Live rework on London Boiler Room."],
]);

/** "Tito Rojas Quiero Ser Tuyo lyrics" + "Tito Rojas Quiero Ser Tuyo official audio" */
export const quieroSerTuyo = rows([
  ["AcbBKIShKh8", "QUIERO Ser Tuyo 💝 - Tito Rojas [Lyric Video]", "JN Music Group", true, 19079357, 314, "Disfruta de \"Quiero Ser Tuyo\" de Tito Ro"],
  ["-TSWAn0bqAU", "Quiero ser tuyo tito rojas con letra", "RecPlay", false, 3674182, 313, ""],
  ["uHfvfmWgkrg", "Quiero ser tuyo Letra 😏🔥|  Tito rojas | Frases en Salsa", "FrasesEnSalsa", false, 370619, 317, "Canción: Quiero ser tuyo Canta: #titoroj"],
  ["v_wN1LtvSoE", "Quiero Ser Tuyo - Tito Rojas", "Julián Moreno Echavarría", false, 2328799, 315, "Alcoba \"AfroAntillana\"...!!!"],
  ["PoXjsyV4Gqo", "Tito Rojas - Quiero Ser Tuyo - Karaoke", "RITMO , CORAZON Y SABOR.", false, 14184, 314, "CANAL \"DEDICADO EXCLUSIVAMENTE\" A KARAOK"],
  ["VV20Vo-fbyg", "Quiero ser tuyo - Tito rojas - letra", "DJ HOLMES SALSA", true, 40736, 313, "Quiero ser tuyo - Tito rojas - letra ESC"],
  ["xlMqlJQaJwQ", "a ti volveré tito rojas letra", "FELIX VDJ", false, 4961466, 314, "apoyame con tu suscripcion es muy import"],
  ["VbH4zFeg4aM", "TITO ROJAS - Quiero Ser Tuyo (HQS)", "Salsa jjdj 507", false, 340, 316, ""],
  ["f6VYGmmVgf0", "Quiero ser tuyo  - Tito rojas Salsa Con Letra", "DJ ZABALETA MUSIC", false, 93, 317, ""],
  ["ri5RXLge8gY", "QUIERO SER TUYO (LETRA) - TITO ROJAS - #BebayOlvide", "D J   L A R R Y  A L V E S", false, 1110, 316, "LETRASCONAMOR #SALSAROMANTICA."],
  ["bGQTOlPxVcg", "Tito Rojas - Quiero Ser Tuyo (HQ Audio)", "DJ ESCARCHE", false, 1598, 320, "Año: 1993. #salsa #music #trending."],
  ["Zs4gPytzH6A", "Tito Rojas - Quiero Ser Tuyo", "Don Recio", false, 32026, 318, "Tito Rojas - A mi Estilo Album (1993)"],
  ["MQAF1XgGMV8", "QUIERO SER TUYO - TITO ROJAS (FULL AUDIO)", "VDJ EDICIONES", false, 39735, 313, "DISCOGRAFIA ° ° Año de lanzamiento: 1993"],
  ["nmyHk0nTWJg", "Tito Rojas - Quiero Ser Tuyo", "Yulkin German", false, 1268, 317, "Tito Rojas (1993, Vinyl) A Mi Estilo."],
  ["GYSy36GJLuo", "Quiero ser tuyo - Tito Rojas", "Reiher Salsa", false, 2517, 314, "A Mi Estilo (1994) Suscribete'"],
]);

/** "Guy Clark Heavy Metal lyrics" + "Guy Clark Heavy Metal official audio" */
export const heavyMetal = rows([
  ["1mtm499TlPo", "Guy Clark - Heavy Metal (Official Audio)", "Guy Clark", true, 5079, 183, "Track from Old Friends (1988). Sugar HIl"],
  ["p0cNJmpzHLw", "L.A Freeway - Guy Clark - lyrics", "Lyrics Video Synchronized", false, 41530, 290, "Lyric video from the music L.A Freeway s"],
  ["cGKvqe5rVU8", "Heavy Metal", "Guy Clark", true, 4438, 218, "Provided to YouTube by The Orchard Enter"],
  ["Xpa5mOg3Fjs", "Guy Clark - L.A. Freeway | Live From Austin City Limits TV", "Austin City Limits", true, 1094429, 237, "guyclarkmusic performs \"L.A. Freeway\" fr"],
  ["2BoiKi1FytA", "Guy Clark - Ballad of Laverne and Captain Flint", "Barbara Field", false, 326669, 155, "From the movie \"Heartworn Highways\"."],
  ["pV-3-pVUQYg", "The Guitar - Guy Clark", "Crissmith", false, 355, 251, "Live Streams at: https://www.twitch.tv/c"],
  ["pCDfeWw13ZM", "Guy Clark - \"New Cut Road\" [Live from Austin, TX]", "Live From Austin TX", false, 53331, 249, "From the Guy Clark album 'Live From Aust"],
  ["57ln5xN9gI0", "Guy Clark Magnolia Wind (karaoke)  (by request)", "Custom Karaoke 🎤 by Chad Couger ", false, 2827, 274, "Magnolia Wind I don't own any right to t"],
  ["HI3TQqfP2MU", "The Last Gunfighter Ballad, performed by Jeff Del Mastro, written by Guy Clark", "Jeffrey Del Mastro", false, 115, 184, "Recorded on October 27, 2019 in 5K Studi"],
  ["ZwGaGzSYHzs", "Heavy Metal (Don't Mean Rock And Roll to Me) Johnny Cash - Caterpillar D10", "Joe Yip", false, 29523, 169, "Heavy Metal (Don't Mean Rock n Roll) sun"],
  ["3mQ6Dik8FOM", "Tornado Time In Texas", "Guy Clark", true, 2615, 207, "Provided to YouTube by Dualtone Music Gr"],
  ["hEst7MmQrao", "Guy Clark", "Djj9462", false, 408, 292, "from the film HEARTWORN HIGHWAYS, filmed"],
  ["uHdYdLP7LPM", "Guy Clark - Hands (Official Audio)", "Guy Clark", true, 4046, 143, "Track from Old Friends (1988). Sugar HIl"],
  ["1O1qLla4scY", "Guy Clark: Sierra Center Stage", "Peter Berkow", false, 214966, 3277, "The legendary singer/songwriter Guy Clar"],
  ["pprLiYRbthg", "Guy Clark - Old Friends (Official Audio)", "Guy Clark", true, 24079, 193, "Track from Old Friends (1988). Sugar HIl"],
  ["aR42l4jDAVs", "Super heavy metal by Clark..kkk(Ra seang beul)", "sktjdquf", false, 540, 432, "i wrote this shit... AS you know I have "],
]);

/** "Real McCoy Run Away lyrics" + "Real McCoy Run Away official audio" */
export const runAway = rows([
  ["PceXE5lOMJs", "Real McCoy - Run Away (Lyrics)", "Infinite Music", false, 107352, 246, "Real McCoy - Run Away (Lyrics) Turn on n"],
  ["oPksa3VYhQw", "Real McCoy - Run Away (Lyric)", "Dani Scaletta", false, 200069, 244, "I do not own song. I only made lyrics fo"],
  ["A7FW5rJ-khI", "Real McCoy - Run Away - 1994 - Lyrics", "Giraffe EN", false, 2723, 243, "Real McCoy is a German Eurodance and pop"],
  ["_05FMWP-22E", "Real McCoy - Run Away (Video with Lyrics)", "john doe", false, 198162, 275, "Real McCoy - Run Away Released Europe 19"],
  ["kH1fsKK85Qo", "Real McCoy   Runaway", "Ricardo BP", false, 9895247, 233, ""],
  ["6JrcVLy35WQ", "Run away-Real McCoy lyrics", "urthemissing pieceineed", false, 33114, 245, "Do not own this song!!!"],
  ["T22hokDks-w", "Real McCoy - Run Away #lyrics", "Músicas & Letras", false, 803, 249, ""],
  ["arHdOFutc-0", "Run Away (Single Version)", "Real McCoy", true, 7376403, 246, "Provided to YouTube by Arista/BMG Herita"],
  ["HMXrJq6976g", "MC Sar and The Real McCoy - Run Away Subtitulado en Inglés & Español (Official Video)", "darly muñoz", false, 165563, 189, "(Lyrics Sub Español) Official Video."],
  ["_dx0qWHL7dc", "Real McCoy • Run Away (US Version)", "Real McCoy", true, 16441493, 259, "Official Video for ”Run Away” by Real Mc"],
  ["XafHcdtKgYA", "Real McCoy - Run Away (Audio)", "ata ersoy", false, 1650, 245, ""],
  ["Dd_o4pqGXTg", "Real McCoy - Run Away HQ (Audio)", "MusickLife", false, 4430, 246, ""],
  ["6L4xvAmdcOI", "Real McCoy - Run Away", "Andrew Waby", false, 92679, 245, "A great dance tune. Real McCoy - Run Awa"],
  ["gIH2FRYEQJU", "Real McCoy ft. M.C. Sar - Run Away (Top Of The Pops, 26.1.1995)", "Real McCoy", true, 557079, 151, "Real McCoy performing „Run Away“ at Top "],
  ["OqYG87oxlGo", "Another Night", "Real McCoy", true, 24935075, 237, "Provided to YouTube by Arista Another Ni"],
  ["puR8F4I6E6E", "M.C. Sar & The Real McCoy - Run Away (US Version Unreleased) (1994) (VHSrip)", "EURODANCE HD Clips", false, 297334, 242, "remastered video from VHSrip ::: torniks"],
  ["vp3662rrIAE", "M.C. Sar & The Real McCoy - Run Away (1994) HD 4K 60-fps", "EURODANCE HD Clips", false, 16908, 186, "remastered video from DVD to HD ::: torn"],
]);

/** "LingualX Extravagant Escalations lyrics" + "LingualX Extravagant Escalations official audio" + "LingualX Extravagant Escalations" */
export const extravagantEscalations = rows([
  ["M_yLkPZZ1Ys", "Extravagant Escalations", "LingualX - Topic", false, 2, 249, "Provided to YouTube by DistroKid Extrava"],
]);

/** "M-zine Purloin lyrics" + "M-zine Purloin official audio" + "M-zine Purloin" */
export const purloin = rows([
  ["GJIKnYv9zCw", "Crepitate", "M-zine - Topic", false, 325, 370, "Provided to YouTube by Cygnus Music Ltd "],
  ["5_r3l-U-Lpk", "Equate", "M-zine - Topic", false, 493, 297, "Provided to YouTube by IDOL Equate · M-z"],
  ["tst-2z7420w", "Pokémon Scarlet & Violet - Legendary Quartet Battle Music (HQ)", "Pokeli", true, 5779386, 306, "This play when you are challenging The T"],
  ["8dGNOIu4_zA", "Pikachu almost caught Meowth", "Taze", false, 9918744, 32, "Ash's Pikachu almost caught Meowth of Te"],
  ["BRZvsm-SYYk", "“My Own Drum” (Remix) Music & Lyric Video ft. Missy Elliott | Vivo | Netflix Family", "Netflix Family", false, 84020344, 179, "Lin-Manuel Miranda wrote the song. Missy"],
  ["MMxXw43xpk0", "Audiobooks and subtitles: Edgar Allan Poe. The Murders in the rue Morque. Detective, Adventure.", "Audiobooks and Subtitles", false, 195, 6039, "\"The Murders in the Rue Morgue\" is a sho"],
  ["n8meGYMkPGQ", "SKITTY DOES A BARREL ROLL", "Ryan Healy", false, 372, 18, "CORY IN TEH HOUZE REAL MAN any ways, nex"],
  ["pJfhDPC95vw", "Pokemon Black White Jyanobii Chaobuu Futachimaru September CoroCoro", "SkyEFX", false, 4453, 488, "Pokemon Black White pkmn revealed coroco"],
  ["3hPzP4L9-YA", "Let's Play: Watch_Dogs - Part 32: A Bug In the Machine [PS4][HD]", "skorch82", false, 666, 1939, "We guide Bedbug through the building whe"],
  ["EXy3Es51L40", "Trạng Quỳnh Sang Bắc Quốc Dám “Ghẹo” Vợ Vua Tàu Ngay Giữa Triều Đình Và Cái Kết Bất Ngờ", "Chuyện Cũ Bên Bờ Sông", false, 4551, 4248, "Trạng Quỳnh Sang Bắc Quốc Dám “Ghẹo” Vợ "],
  ["zjJTNKQA6dI", "Purloin (Original Mix)", "M-zine - Topic", false, 224, 313, "Provided to YouTube by Triple Vision Rec"],
  ["uqnCObqNO5M", "M-Zine - Galimatias", "ROOTZDNB", false, 901, 430, "All rights to the label and artists. Upl"],
  ["ocO6kEc-RKM", "M-Zine - Eristic", "ROOTZDNB", false, 509, 280, "All rights to the label and artists. Upl"],
  ["MMXKZa6ryq0", "M-Zine - Loon", "ROOTZDNB", false, 588, 348, "Joeri Deyaert, a.k.a. M-Zine, is back on"],
  ["8BlK8kWbsus", "Dark Drum and Bass 2021 - mixed by : GHANDZA part 2", "Ganjan (Jungle / DnB / Hardtek...)", false, 177, 3768, "1.Kid Drama - Impulse 1 (Commix Remix) ("],
  ["USK5ED3vQvI", "Dava - Cold Feet", "NOIR DRUM & BASS", false, 77, 281, "Artist : Dava Title : Cold Feet 2021 Tra"],
  ["tspFFtFZdEI", "Short story reading: The Domain of Arnheim or the Landscape Garden, by Edgar Allan Poe", "whitegreyblackyyc", false, 47, 3443, "SUNDAY SCARIES READING CLUB --] July 9, "],
  ["Mjku9GfR63o", "Sketchy", "Conrad Subs - Topic", false, 314, 313, "Provided to YouTube by Cygnus Music Ltd "],
  ["T8PuKcoLdyg", "M-zine- TFATV", "Sofa Sound Bristol", false, 581, 274, "Support direct - https://sofasoundbristo"],
  ["bf0UKTfHFUI", "M zine - Blinkered - DIS141", "Dispatch Recordings", false, 1160, 380, "M-zine Blinkered DIS141 Buy Links: • Dis"],
  ["fCkrMFn0bmU", "M-zine - Untitled Dub", "Sofa Sound Bristol", false, 742, 364, "Support direct - https://sofasoundbristo"],
  ["tphFqJ_yseM", "M-Zine & Scepticz - Nether - DISLTD026", "Dispatch Recordings", false, 416, 132, "M-Zine & Scepticz Nether DISLTD026 ---- "],
  ["IPPxle0CBRk", "M-Zine - Crepitate", "sheo_ _ʚїɞ", false, 386, 371, "Buy at: https://www.beatport.com/track/c"],
]);

// ---------------------------------------------------------------------------
// 2026-11-14: misses from the random-song evaluation (tools/eval/data/run-20261115).
// Searched 2026-11-14; descriptions are the first 100 characters of the snippet, so art
// tracks keep their "Provided to YouTube by <label> <Title> · <Artist>" credit line.

/**
 * "Black Gryph0n & Baasik Insane lyrics" + "Black Gryph0n & Baasik Insane official audio", plus
 * "Insane (1920)" (from "Black Gryph0n Insane 1920"): the evaluation's searches returned it, today's don't.
 */
export const insane = rows([
  ["AicztQ69Uy8","Black Grpyh0n & Baasik- Insane (Lyrics Video)","Music Terminal",false,10697036,161,"Note: Don't Forget to Like and Subscribe for new content every single day and hit the notification b"],
  ["juJkNKodgdE","INSANE (A Hazbin Hotel Song) - Black Gryph0n & Baasik","Black Gryph0n",true,175081074,163,"STREAM #INSANE ON SPOTIFY: ..."],
  ["v71GQ0wRiGM","Insane (Lyrics) - Black Gryph0n","Music_Room5",false,100597,165,"music #vibes #song #dance #lyrics #popular #lyricsvideo #lyricvideo #pop #happy #blackgryph0n #feelg"],
  ["a_uHESUzNRI","Insane-LYRICS official music video by @BlackGryph0n","RAYPAWS",false,329466,192,"Cloudjumperedits_1 @Ivy_art08."],
  ["_t7oMrDWiAs","INSANE (With Lyrics) // AMV // Hazbin Hotel","Xeorie",false,11746159,169,"Hey folks! Here is an AMV on the first Hazbin Hotel song I discovered, and that made me love Alastor"],
  ["SsSwsLAetDE","Black Grpyh0n & Baasik- Insane (Lyrics Video)","Hitz of music",false,1609,170,"Black Grpyh0n & Baasik- Insane (Lyrics Video) Note: Don't Forget to Like and Subscribe for new conte"],
  ["QVOmJwWxwtc","Black Grpyh0n & Baasik - Insane (Lyrics)","LMD LYRICS",false,125089,162,"BlackGrpyh0n#Baasik#Insane#Lyrics Lien de channel: https://www.youtube.com/channel/UC78AkLcyoZTGEL_o"],
  ["N8upIbB9FYQ","【英語歌詞+読み方付き】 Insane ( A hazbin hotel song ) - Black Gryph0n &Baasik","ham",false,105456,159,""],
  ["e_n-R-5R6Ww","Alastor - 'Insane' (Color Coded Lyrics)","Jenowski",false,831958,160,"All Rights Administered To The Rightful Owners • Artist: Black Gryph0n, Baasik • Song ♫: Insane • Al"],
  ["wMtrYakfKjM","Insane Lyric Video(original by @BlackGryph0n )","Millie’s Plushie Productions",false,42214,206,"Insane belongs to @B@BlackGryph0nPls don't copyright me YouTube :( Tags: #hazbinhotel #alastor #musi"],
  ["A-5GnltcZvM","INSANE (Insanity Remix) - Black Gryph0n & Baasik","",false,null,182,""],
  ["sJ0yPYUnLlE","UPSIDE DOWN (A Hazbin Hotel Song) - Black Gryph0n & Baasik","",false,null,164,""],
  ["3rYmjB55d90","[REUPLOAD] INSANE (Unofficial Music Video) Black Gryphon & Baasik","El Rincon de Brashito",false,null,206,""],
  ["H736aOIHHO8","BAD NEWS (Animated Music Video) - Stellar, Black Gryph0n & Baasik","Black Gryph0n",false,null,146,""],
  ["9e-3m5sNuCM","Insane [An Hour Long] [Song By: @BlackGryph0n]","",false,null,3624,""],
  ["qy9NX7iI6YQ","DAISIES (A Hazbin Hotel Song) - Black Gryph0n & Baasik","",false,null,143,""],
  ["xEFHOpLGibY","INSANE - Hazbin Hotel (acapella) | VoicePlay","",false,null,237,""],
  ["cW45L9OSFRY","Stellar - Bad News ft. Black Gryph0n & Baasik (Official Lyric Video)","",false,null,145,""],
  ["eX5lc10Ot6w","Insane (1920)","Black Gryph0n",true,3868247,166,"Provided to YouTube by DistroKid Insane (1920) · Black Gryph0n · Baasik Insane (1920) ℗ Black Gryph0"],
]);

/** "Lola Jane You Lie lyrics" + "Lola Jane You Lie official audio" + "Lola Jane You Lie" */
export const youLie = rows([
  ["j402JjBD1pw","Lola Jane | 'You Lie'","Lola Jane",false,35116,174,"Lola Jane 'Unsettled' EP: https://ampl.ink/dpvPb Follow Lola Jane: https://www.instagram.com/iamlola"],
  ["nG16UroQcRM","Lola Jane - To, Me (Acoustic)","Lola Jane",false,218477,224,"Hey, my name is Lola Jane. Hope you enjoy my song ! Don't forget to hit 'Like', Subscribe and Share "],
  ["AHI7JjJlpYo","Lola Young - Messy (Lyrics)","7clouds Rock",true,8291429,285,"Follow the official 7clouds playlist on Spotify : http://spoti.fi/2SJsUcZ ​ Lola Young - Messy (Lyri"],
  ["1hpkQ_ag470","Lola Young - Messy (Lyrics)","Vibe Music",true,28201697,290,"Lola Young - Messy Stream/Download: (Lyrics): [Verse 1] You know I'm impatient So why would you leav"],
  ["keVFUQBBc7U","Lola Jane - Kiss Me (Acoustic)","Lola Jane",false,236246,178,"Here is another Lola Jane acoustic track ! Hope you enjoy this! Share, Subscribe, Like & all that go"],
  ["stOK9uYzw7w","Lola Jane | 'Dear...'","Lola Jane",false,8774,186,"Lola Jane 'Unsettled' EP: https://ampl.ink/dpvPb Follow Lola Jane: https://www.instagram.com/iamlola"],
  ["ShTBYGmwDfo","Lola Jane | 'Clouds'","Lola Jane",false,18187,228,"Lola Jane 'Unsettled' EP: https://ampl.ink/dpvPb Follow Lola Jane: https://www.instagram.com/iamlola"],
  ["0gXclofwOuk","Lola Jane | 'Almost'","Lola Jane",false,22532,194,"Lola Jane 'Unsettled' EP: https://ampl.ink/dpvPb Follow Lola Jane: https://www.instagram.com/iamlola"],
  ["k-k2_Liofy8","Lola Young - Messy (Official Video)","Lola Young",true,172988673,285,"My new album 'I'm Only F**cking Myself' is out now! Order here: https://lolayoung.lnk.to/ImOnlyF--ki"],
  ["toU970cdors","Lola Jane - Clouds","ZOUK LOVE MUSIC",false,1765,225,"Músicas e remixes para dançar com o corpo e sentir com o coração. ♥️ Este canal é feito com muito am"],
  ["REbvnRxQx64","Lola Jane & Melvin War - Kiss Me (Bachata Remix)","Musica Salsa",false,47588,234,"Lola Jane & Melvin War - Kiss Me (Bachata Remix)"],
  ["lXIuy82hKfw","#DESAFIODABEREU @ Lola Jane","Ruana Vasquez",false,87,78,"O Desafio é para vocês tentarem reproduzir a coreo em casa, gravar e postar desafiando 2 amigos(as)!"],
  ["kaem0SpxQbE","Lola Jane | 'The Wire'","Lola Jane",false,18735,196,"Lola Jane 'Unsettled' EP: https://ampl.ink/dpvPb Follow Lola Jane: https://www.instagram.com/iamlola"],
  ["v92R-NE1few","nbbr live Lola Jane","Nema's Boom Boom Room",false,499,61,""],
]);

/** "Face to Face Nullification lyrics" + "Face to Face Nullification official audio" */
export const nullification = rows([
  ["Xed2SNsVGE4","Face To Face - Nullification","Worse Than You",false,155,189,"Face To Face Album: Reactionary (Bonus track) Guitar cover: Joseph Fernandez."],
  ["_SAAcAT_S8c","Citizen Soldier - Face to Face [Lyrics]","BlackLightMusicV2",false,235161,222,"[Citizen Soldier] • https://www.youtube.com/channel/UC3JIDpjOFMKXObgctLRQb-A ..."],
  ["osk3TNZCgnI","0TS / soul_splice ft. Utatane Piko","0TS",true,3841,220,"nullify —— [Inst/Lyrics/Animation/Video] 0TS [Vocals] Utatane Piko, Kagamine Len, v4flower [Story/Ch"],
  ["cIk_cR50q50","Nullify, Break and Recoil Every Satanic Arrows, Evil Altars and Verdicts","1001 DAILY PRAYERS",false,1855,573,"NULLIFY, BREAK AND RECOIL EVERY EVIL ALTAR, SATANIC ARROWS, AND VERDICTS In the name of Jesus Christ"],
  ["cwHeF5ZIXhs","emjaay - lost time (Sub. Español & Lyrics)","byedar",false,51,157,"Apoya a emjaay https://soundcloud.com/emjaays https://www.instagram.com/emjaays/ @emjaay Anime: A si"],
  ["L8ZhJFDIRq8","Exodus - Open Season - (Fabulous Disaster - 1989) - Thrash Metal - Lyrics","The Best Classic Rock Ever (70s-80s-90s & more)",false,177,238,"Band: Exodus Topic: Open Season Album: Fabulous Disaster Year: 1989 Country: USA Exodus - Open Seaso"],
  ["MXW54qAA6aA","Both Sides with Jesse Jackson (pt. 3) - Racially Based Jury Nullification w/ Professor Paul Butler","ProfessorPaulButler",false,2870,135,"On this episode of Both Sides with Jesse Jackson, Professor Paul Butler of George Washington Univers"],
  ["R_v9oZv9oVI","All Stars WITH LYRICS- Friday Night Funkin vs Mario’s Madness","Chez2011",false,3006,666,"Bru this description is gonna be so long Lyrics: @n@chez2011Video art: @noo@chez2011omposers: ..."],
  ["80rTOvBFMVs","Megalovania WITH LYRICS | Undertale Cover | FT ‪@wrathstetic","Maelstrom Lyrics and wrathstetic",false,1444728,538,"you picked war. so here i am. #undertale #sans #megalovania !- - Credits- -! Original Composer: Toby"],
  ["sn0UJ7u4EY0","Недо мовик","NULLIFY",false,3,128,"Steam - https://steamcommunity.com/profiles/76561199570606140/ Vk - https://vk.com/alexeydackevich T"],
  ["wdWWgR07Rsw","Nullification (Bonus Track)","officialfacetoface",true,3016,196,"Provided to YouTube by IIP-DDS Nullification (Bonus Track) · Face To Face Reactionary (Bonus Tracks)"],
  ["w4tGNmPTi1Q","VEGAS LAWYERS DISCUSS THE BUNDY VERDICTS AND JURY NULLIFICATION","MrsB Stacy",false,1419,774,"https://itmattershowyoustand.com/2017/09/vegas-lawyers-discuss-the-bundy-verdicts-and-jury-nullifica"],
  ["bRlOvc0xYk0","RUQYAH TO NULLIFY MAGIC THAT DISTORTS THE BEAUTY OF SKIN,TEETH,EYES,EARS, HAIR,CAUSES PAIN,TINGLING","Al Quran",false,52256,1931,"RUQYAH TO NULLIFY MAGIC THAT DISTORTS THE BEAUTY OF SKIN, TEETH, EYES, EARS, HAIR, CAUSES PAIN, TING"],
  ["B9GI-PxHLwM","Nullify All Negative Intentions and Enemies Plans [Copper + Salt + Moldavite Frequency]","The Crystal Wave",false,36378,28800,"Nullify All Negative Intentions and Enemies Plans - Copper + Salt + Moldavite Frequency This frequen"],
  ["kIXrYfqvhr8","Jury Nullification What Gun Owners Need to Know","Armed Attorneys",true,43994,844,"We're dive into the concept of jury nullification and why it's important for gun owners to understan"],
  ["2T1BmcTalfw","The Nullification Crisis Explained: The Showdown That Nearly Divided America | DAILY BELLRINGER","The Daily Bellringer",false,60021,347,"The Nullification Crisis Explained: During Andrew Jackson's presidency, we begin to see the fracturi"],
  ["W8CTw0T4bzY","Lymphatic System Blockage Removal and Enhanced Drainage by Sapien Medicine Ver2.0","Deleted energy work videos",false,338993,487,"Sapien Medicine's original description: The programming in this will help break apart blockages in y"],
  ["LN1LlXChhQU","Kill Dyll - Nullify (Official Audio)","Kill Dyll",true,37132,128,"Stream \"BRAINDEAD\" now: https://killdyll.lnk.to/BRAINDEAD Follow Kill Dyll: https://www.killxdyll.co"],
  ["JRk7gRPbs0k","THE ENEMY ANNIHILATION SUBLIMINAL (obliterate enemies, rude people, bullies etc)","wealthy crowns",false,663633,227,"ALL UNISEX AFFIRMATIONS Calm version: https://youtu.be/O3Lr_puC594 Let's goooo!!!! Listen 3-6 times "],
  ["4_VOiOKJQYg","Ultimate Ruqyah to Nullify & Open the Blockages made by Black Magic & Evil Jinns","The Power of Quran",false,57682,2430,"As salam o alaikum wa rahmatullahi wa barakthu! This is a very powerful and effective ruqyah to Ruqy"],
]);

/** "DJ Prime Cuts Dipped lyrics" + "DJ Prime Cuts Dipped official audio" + "DJ Prime Cuts Dipped" */
export const dipped = rows([
  ["3W9zTpRFlzw","Dua Lipa - Training Season (Lyric Video)","Dua Lipa",true,33644032,211,"Listen to 'Radical Optimism', the new album here: https://dualipa.lnk.to/radicaloptimism Subscribe t"],
  ["CdaIKEcj6ow","Ice Spice - Did It First (Lyrics) ft. Central Cee","Rap Samurai",true,10267532,118,"Ice Spice, Central Cee - Did It First Lyrics by Rap Samurai We aim to bring you the highest quality "],
  ["8Ebqe2Dbzls","ROSÉ & Bruno Mars - APT. (Official Lyric Video)","Bruno Mars",true,67641617,170,"The official lyric video for ROSÉ & Bruno Mars' APT. Listen to APT.: https://rosesarerosie.lnk.to/AP"],
  ["mCHUw7ACS8o","Of Monsters and Men - Dirty Paws (Official Lyric Video)","Of Monsters and Men",true,120798294,275,"Download this song: http://smarturl.it/OMAMalbumitunes Watch Of Monsters and Men cover Post Malone's"],
  ["bNQSMTNSnUw","Nathan Evans - Wellerman (Sea Shanty) (Lyrics)","7clouds",true,46973734,153,"Follow the official 7clouds playlist on Spotify : https://lnkfi.re/7cloudsSpotify​ Nathan Evans - We"],
  ["AyX_LL9nWSE","Olivia Rodrigo - favorite crime (Lyric Video)","Olivia Rodrigo",true,128966038,154,"Listen to 'SOUR': https://OliviaRodrigo.lnk.to/SOUR Listen to 'GUTS': https://OliviaRodrigo.lnk.to/G"],
  ["h5ke4Ka4_mg","Nathan Evans - There once was a ship that put to sea (Wellerman) (Lyrics)","Cassiopeia",true,29630942,157,"Nathan Evans - There once was a ship that put to sea (Wellerman) (Lyrics) Follow Cassiopeia on Spoti"],
  ["XZ9ZngeRP78","Nathan Evans - Wellerman (Sea Shanty) (Lyrics)","cold boy.",true,1955826,155,"Nathan Evans - Wellerman (Sea Shanty) (Lyrics) Turn on notifications to find out about upcoming vide"],
  ["Zu2Spp4nrTM","Laufey - Promise (Official Lyric Video With Chords)","Laufey",true,20444884,234,"Stream or download \"Promise\" from my new album, Bewitched, out now: https://laufey.ffm.to/bewitched "],
  ["Amcm_P7viqk","Lut Gaye (Lyrical) Emraan Hashmi, Yukti | Jubin N, Tanishk B, Manoj M | Bhushan K | Radhika-Vinay","T-Series",true,117959094,249,"Presenting #LutGaye Lyrical video. Gulshan Kumar & T-Series presents Bhushan Kumar's Lut Gaye; a rom"],
  ["0mlnJ7Ic7TM","MAU P @OfficialClubSpace | Miami - Dj Set presented by Link Miami Rebels.","Club Space",true,1663931,7467,"Mau P playing an exclusive dj set for @OfficialClubSpace Miami. - SUBSCRIBE TO OUR CHANNEL: ..."],
  ["EAcXCdMiuEo","DJ Spinall - Dis Love (Official Video) ft. Wizkid, Tiwa Savage","SPINALL",true,41320763,159,"https://smarturl.it/DisLove #DJSpinall #Wizkid #TiwaSavage TheCAPMusic presents the official music v"],
  ["pQPgnnKdMR8","Deep Focus Music – Ultra Focus Beats for High-Performance Work & Study Sessions","Deep Focus Zone",false,1068912,4957,"Work & Productivity Music – Deep Focus Beats for CEO Performance & Calm Study This mix is designed t"],
  ["hJBAzPsLZ00","21 Savage x Young Nudy - Since When (Official Music Video)","21 Savage",true,14708995,209,"Watch the official music video for \"Since When\" by 21 Savage x Young Nudy, produced by Kidd Hazel. S"],
  ["rfgZTk3Zj7A","Big Bunx Riddim MIx Ft. Valiant, Skeng, RajahWild, Najeeriii, Konshens, Vybz Kartel, Roze Don & More","DJ Prime Official",false,7971,893,"This is a fun space used to display different element of DJ Prime from mashups live mix, music (reco"],
  ["PLT68mI5Pwc","Ante Up Remix (featuring Busta Rhymes, Teflon, and Remy Martin) (Official Video)","MOPVEVO",true,51655114,264,"\"Ante Up Remix\" by M.O.P Listen to M.O.P: https://MOP.lnk.to/listenYD Subscribe to the official M.O."],
  ["sVgd0pIZ8fQ","Gucci Mane - Truth (Official Music Video)","Gucci Mane",true,22926585,217,"I AM MY ONLY COMPETITION! https://guccimane.lnk.to/TrapGodClassics Subscribe for more official conte"],
  ["qWWSM3wCiKY","Calvin Harris & Disciples - How Deep Is Your Love (Audio)","Calvin Harris",true,176476030,213,"Calvin Harris & Disciples - How Deep Is Your Love (Official Audio) Sign up for first access to Calvi"],
  ["6wtwpUwxQik","21 Savage & Metro Boomin - No Heart (Official Music Video)","21 Savage",true,304784119,256,"DOPE Presents the official video for \"No Heart\" by 21 Savage & Metro Boomin off the 'Savage Mode' al"],
  ["P00HMxdsVZI","Lizzo - Truth Hurts (Official Video)","Lizzo Music",true,335457190,182,"The official video of \"Truth Hurts\" by Lizzo. Download/Stream: https://Atlantic.lnk.to/TruthHurtsAY "],
  ["q5VFF5Wh9q0","Dipped","Release - Topic",false,295,153,"Provided to YouTube by KudosRecords Dipped · DJ Prime Cuts Chartist EP ℗ The Trilogy Tapes Released "],
  ["7v0SYSnM_bU","Prime Cuts of the past - Dj Cari6aca","Inaudible Sound Recordings",false,26,164,""],
  ["nEOJ-JCv-FA","Kill Switch","Release - Topic",false,292,207,"Provided to YouTube by KudosRecords Kill Switch · DJ Prime Cuts Chartist EP ℗ The Trilogy Tapes Rele"],
  ["84cqvTjdctk","PREVEDELLO06","Spezzapasticcio",false,22,2697,"... SHADOW REZZETT - LEG IT PIPER SPRAY & LENA TSIBIZOVA - EXIT DJ PRIME CUTS - DIPPED DJ TRYSTERO -"],
  ["IqYWypExkoA","Salt Hank Rules the Sandwich World | Sandwich City | NYT Cooking","NYT Cooking",true,1630811,825,"Henry Laporte is famous on TikTok, but you might know him better as Salt Hank. His videos of his oft"],
  ["G1l_yUbex0g","Belly Gang Kushington - Rent Due (Official Music Video)","Belly Gang Kushington ",true,10411837,142,"Belly Gang Kushington - Rent Due (Official Music Video) Listen/Download: https://ffm.to/streetsisyou"],
  ["Gbx9V3WlmBM","Philly, Jersey & Baltimore Club Mix","Diamond Kuts",false,178268,2677,"3 Cities One Mix! New and Classic Club Music!"],
]);

/** "Etovics Impersonator lyrics" + "Etovics Impersonator official audio" + "Etovics Impersonator" */
export const impersonator = rows([
  ["kVLuaG-Azr4","Impersonator","Release - Topic",false,28,307,"Provided to YouTube by WM Music Distribution Ltd Impersonator · Etovics Stolidity ℗ 2026 Etovics Rel"],
  ["x4dzx0uNImI","Wolverine Blues Brothers - Out Of Hand (Entombed cover)","Daniel Szabo",false,117,165,"Live cover of Out Of Hand by Entombed. Wolverine Blues Brothers: Jósa Tamás - vox Németi Tamás - gui"],
]);

/** "Wei Bi 偷偷 lyrics" + "Wei Bi 偷偷 official audio" + "Wei Bi 偷偷" + "偷偷 广播剧《偷偷藏不住》主题曲" + "偷偷" */
export const touTou = rows([
  ["OjMfGs-OYH0","落空 (Fall Through) - 未必 (Wei Bi)《早春晴朗 The Early Spring》Chi/Eng/Pinyin lyrics","Peachey Blossom",false,409404,209,"Song Name (歌名): 落空(Fall Through) Singer (歌手): 未必(Wei Bi) Drama Name (电视剧名字):《早春晴朗The Early Spring》 ."],
  ["9TcqDEv12eg","你是我此生唯一所愿 (You Are My Only Wish) - 张碧晨 (Zhang Bichen)《偷偷藏不住 Hidden Love》Chi/Eng/Pinyin lyrics","Peachey Blossom Backup",false,346464,195,"Song Name (歌名): 你是我此生唯一所愿(You Are My Only Wish) Singer (歌手): 张碧晨(Zhang Bichen) Drama Name (电视剧 ..."],
  ["e0JwzRfIhO0","妳是我此生唯一所願 / You Are My Only Wish in This Life - 張碧晨 Diamond Zhang（《偷偷藏不住Hidden Love》電視劇插曲）【動態歌詞】","Dreamer Music",true,1790656,202,"歌詞在下面❖Lyrics in the song❖ 妳是我此生唯一所願（《偷偷藏不住》電視劇插曲） - 張碧晨作詞: 邱天Tian 作曲: ..."],
  ["EJtcb6SHLPY","Ode to Hsin and Moon: Whither Away? - Official English Lyrics [wuwa Hsin EP song]","Yxelixi",false,57907,215,"Ode to Hsin and Moon: Whither Away? - Official English Lyrics [wuwa Hsin EP song] Wuthering Waves OS"],
  ["1Njf_E5t-2o","【Chi/Eng/Pinyin Lyrics】 刘宇宁 (Liu YuNing) -  她 (Her) | 《早春晴朗 The Early Spring》 OST","Diary Lyrics",false,889123,217,"【Chi/Eng/Pinyin Lyrics】 刘宇宁(Liu YuNing) - 她(Her) | 《早春晴朗The Early Spring》 OST *Watch the Lyrics Vide"],
  ["tB0VMo8W8S0","【Chi/Eng/Pinyin Lyrics】 袁娅维 (Tia Ray) -  此刻 (This Moment) | 《早春晴朗 The Early Spring》 OST","Diary Lyrics",false,150120,210,"【Chi/Eng/Pinyin Lyrics】 袁娅维(Tia Ray) - 此刻(This Moment) | 《早春晴朗The Early Spring》 OST *Watch the Lyric"],
  ["EKGCOhpTjuk","Fall Through 落空 - Wei Bi 未必 | 《早春晴朗 The Early Spring》OST Myanmar Sub #ost #mmsub","Forever Music Channel ",false,1095,209,"theearlyspring #jingboran #sunqian."],
  ["wc2_VzAMyy4","[OST LYRICS] You Are My Only Wish by Zhang Bi Chen (Hidden Love OST)","Love for OST",false,23979,191,"Title: You Are My Only Wish Singer/ Artist: Zhang Bi Chen Released Year: 2023 Movie / Drama: Hidden "],
  ["_V06uzrIZSQ","『冷冰冰 - Double SR/一觉Ysleep』『别冷冰冰 拜托今晚不要对我狠心心』【動態歌詞MV】","Phoenix Music",false,46642,186,"訂閱頻道收聽更多好聽的歌： https://www.youtube.com/channel/UC2kv7-nmZvr5wnnW6wSrOhA ..."],
  ["tNqNnbBDAMc","田馥甄 Hebe Tien《小幸運》Lyrics Chinese | Pinyin | English","Bilingual Lyrics",false,4248918,261,"A great way to learn Chinese is through music. I have included Chinese characters, Pinyin and Englis"],
  ["7H1ObJvb7Hc","【Stage】Diamond Zhang & Neo Hou \"Jia Yi Bing Ding\" #TheTreasuredVoiceS7","天赐的声音 The Treasured Voice Official Channel",true,3637240,227,""],
  ["AUNI_oB3L8g","Tang Rebirth: Emperor Impregnates His Beauty Sister—He's a Martial God, One Hammer Crushes Rebels!","風影劇場_shortTV",false,217374,12221,""],
  ["Xlp4iqAPK3E","Wei Wuxian making a clown out of himself for 3 minutes bi","its frigay",false,387955,192,"guys this video is literally wwx being a clown (he's well known for it), in case you don't know, wat"],
  ["8I6beTYSwnE","Tofu Mom EP233: Fallen from Grace","民視戲劇館 Formosa TV Dramas",true,151086,5858,"00:00:00 Guoqing threatens Jialian, forcing her to abandon her book publication. 00:08:31 Huowang en"],
  ["nKyZDdpfEiQ","六哲 - 畢竟深愛過『你堅持著說要走 說他比我要溫柔 我明白你的追求 終於安靜放了手』【動態歌詞MV/Lyrics】","Nightfall Tunes",false,2782900,285,"Nightfall Tunes 歌曲：畢竟深愛過歌手：六哲歌詞： 你堅持著說要走說他比我要溫柔我明白你的追求終於安靜放了手情歌聽多了 ..."],
  ["jTFhkMrCx3Q","六哲 - 畢竟深愛過【動態歌詞Lyrics】","親親2o音樂LîvË【中文音樂】",true,59803855,284,"感謝你留下喜歡和訂閱♡ 打開鈴鐺接收最新消息→ 訂閱頻道：https://goo.gl/UCX8or ♪ 親親2o音樂LîvË【中文音樂】♪ ..."],
  ["z0QTDftqi9k","【纯享版】张碧晨侯明昊全新演绎《甲乙丙丁(你我怎么两清)》 把爱情里的拉扯 不甘与难以释怀唱到极致！#天赐的声音7 EP11 20260823","浙江卫视音乐频道 ZJSTV Music Channel - 欢迎订阅 -",true,2728353,237,"【纯享版】张碧晨侯明昊全新演绎《甲乙丙丁(你我怎么两清)》 把爱情里的拉扯不甘与难以释怀唱到极致！#天赐的声音7 EP11 ..."],
  ["Ns9YAquNWYI","偷偷（广播剧《偷偷藏不住》主题曲）","未必 - Topic",false,190615,249,"Provided to YouTube by EWway Culture Ltd 偷偷（广播剧《偷偷藏不住》主题曲） · 未必偷偷（广播剧《偷偷藏不住》主题曲） ..."],
  ["cekytQao4ZM","《偷偷藏不住》广播剧 主题曲Ⅱ 「藏不住」","Rei Tan",false,52353,270,"视频来源猫耳FM https://www.missevan.com/sound/3249611 主题曲Ⅰ 《偷偷》https://youtu.be/y7MCVvV-MQc @晋江文学城@ ..."],
  ["y7MCVvV-MQc","《偷偷藏不住》广播剧 主题曲Ⅰ 「偷偷」","Rei Tan",false,115390,250,"视频来源猫耳FM https://www.missevan.com/sound/3021344 主题曲Ⅱ 《藏不住》 https://youtu.be/cekytQao4ZM @晋江文学城@ ..."],
  ["PDlQMzsHuCM","偷偷 (广播剧《偷偷藏不住》主题曲纪念版)","浮梦若薇 - Topic",false,1569,249,"Provided to YouTube by 三糙文化偷偷(广播剧《偷偷藏不住》主题曲纪念版) · 浮梦若薇偷偷(广播剧《偷偷藏不住》主题曲纪念版) ..."],
  ["nmVAOTVo3WE","偷偷（广播剧《偷偷藏不住》主题曲） (和声伴奏版)","未必 - Topic",false,2051,249,"Provided to YouTube by EWway Culture Ltd 偷偷（广播剧《偷偷藏不住》主题曲） (和声伴奏版) · 未必偷偷（广播剧《偷偷藏不 ..."],
  ["24LtnNGnZBg","藏不住 (广播剧《偷偷藏不住》主题曲纪念版)","轩ZONE - Topic",false,1048,270,"Provided to YouTube by 三糙文化藏不住(广播剧《偷偷藏不住》主题曲纪念版) · 轩ZONE 藏不住(广播剧《偷偷藏不住》主题曲纪念 ..."],
  ["F9PT1aOnd-A","听歌系列#4 《偷偷》偷偷藏不住广播剧主题曲🌀🌷","豆腐tofu",false,329,52,"xhs 伊奈."],
  ["F4iRi_bq5iQ","松子茶原著《暗恋翻车后》广播剧 主题曲《偷偷》","sour lemon .停更 Suspend updates temporarily.",false,2712,236,"来自：https://www.missevan.com/sound/7478888 “为我款款而来~” -主题曲- 《偷偷》 演唱：远皓ZIL@远皓ZIL 作词：亦沫@亦沫不 ..."],
  ["co-Jn2E0UV8","偷偷（廣播劇偷偷藏不住） 歌曲 翻唱","湘緗",false,236,243,"反正都參加翻唱大賽，檔案都做好了順便發個cover（？） 天啊人間理想段嘉許."],
  ["HjW3g5fTFd8","《偷偷藏不住》主题曲Ⅰ《偷偷》","星朔雪",false,49,250,"转自：https://www.missevan.com/sound/player?id=3021344 @晋江文学城@小竹已原著，@猫耳FM 、三糙文化@三米造事务所 ..."],
  ["kdw1IuoJjns","偷偷 (feat. 閻韋伶)","Softlipa - Topic",false,3938536,249,"Provided to YouTube by YOYOROCK 偷偷(feat. 閻韋伶) · 蛋堡Winter Sweet ℗ 顏社企業有限公司Released on: 2009-12-31 ..."],
  ["89P00QsRoOQ","黃明志【偷偷】Ft. SWAG (Official Music Video)","Namewee",true,1460822,300,"現實愛情”和“虛擬愛情”的差別在於，虛擬的愛情依然是愛情，而現實的愛情始終現實。 《偷偷》收錄在黃明志第十張全新創作專輯《 ..."],
  ["Hdtd82Xj3Ds","蛋堡,阎韦伶-偷偷「这一刻 我觉得 我能懂得 这是我们的快乐」【動態歌詞/Lyrics Video】","WCY RAP",false,260592,249,"关注WCY Rap❖ Youtube➸https://www.youtube.com/wcyrap Facebook➸https://www.facebook.com/wcyrap ..."],
  ["LM9uN7IlKSI","偷偷愛","美秀集團 Amazing Show",true,20291206,263,"Provided to YouTube by YOYOROCK 偷偷愛· 美秀集團美秀集團同名專輯℗ 火玄火包股份有限公司AmazingShow CO LTD ..."],
  ["ja6FxVMjJyQ","【高音質】蛋堡-偷偷 feat.閻韋伶","Peculiar音樂",false,4824,250,"出處https://www.youtube.com/watch?v=kdw1IuoJjns&ab_channel=SoftLipa-Topic 蛋堡偷偷這是三分鐘之內的第五通訊息透露了 ..."],
  ["rBCmeVLHrZ4","MP魔幻力量 [ 偷偷的 Secretly ] Official Music Video - 三立華劇「幸福兌換券」插曲","相信音樂BinMusic",true,48962664,271,"蕭秉治Xiao Bing Chih《活著Alive》高雄巨蛋演唱會⊹ 8.23 (六) 19：00丨高雄巨蛋2.09 (日) 12：00丨拓元售票全面開 ..."],
  ["f8kIYA7wy_s","偷偷","蔡鹤峰",true,128890,191,"Provided to YouTube by 北京昌禾文化发展有限公司偷偷· 蔡鹤峰· 蔡鶴峰 偷偷℗ 北京昌禾文化发展有限公司Released on: ..."],
  ["GjBIe2G0yMU","en - 我是真的愛上你『我 偷偷的愛上你，卻不敢告訴你。』【高音質|動態歌詞Lyrics】♫ · 翻唱歌曲 (原唱:王傑)","4K Music Make",true,3484743,206,"4KMusicMake◁ 點擊訂閱收聽歌曲: https://www.youtube.com/c/4KMusicMake ..."],
  ["Wij4S5g8fVc","Secretly Loving You - Yuzumi 【Official Music Video】","橙Yuzumi Channel",false,57614,237,"Twitch ➔ https://www.twitch.tv/yuzumi_neon Twitter ➔ https://twitter.com/Yuzumi_Neon FB ➔ https://ww"],
  ["0s63EARduI8","偷偷-蔡鹤峰〔和訳〕「こっそり君を好きになった」","mii",false,23286,191,"【曲名】 偷偷【歌手】 蔡鹤峰作詞：蔡鹤峰作曲：蔡鹤峰リリース日：2020年9月30日. 歌詞の途中に出てくる「小鹿乱撞」という ..."],
]);

/** "Unknown T Homerton B lyrics" + "Unknown T Homerton B official audio" + "Unknown T Homerton B" */
export const homertonB = rows([
  ["o2tB9Cs0dn0","Unknown T - Homerton B Lyrics","UK LYRICS VIDEOS",false,185035,190,"Unknown T - Homerton B Lyrics."],
  ["rXgnW7B0K0Y","Homerton B lyrics - Unknown T","ProdbyJPBeats",false,9691,171,"Soundcloud-https://soundcloud.com/helladubs/unknown-t-homerton-b-hellas-toxic-edit."],
  ["UrnACpUhe98","Unknown T - Homerton B [Music Video] | GRM Daily","GRM Daily",true,30411057,191,"SUBSCRIBE: http://bit.ly/GRMsubscribe VISIT: http://grmdaily.com/ ✓ DOWNLOAD THE GRM DAILY APP FOR i"],
  ["fdvbG9VzAk4","Unknown T - Homerton B [Lyrics]","Real UK Lyrics",false,9933,191,"Beat by Chubz The Producer."],
  ["gA92ec-SMDc","Unknown T Homerton B lyrics","worldwide rap lyrics",false,2593,204,"If you like this video smash the like button and I will post more videos like this. Ps: subscribe :3"],
  ["mlTBXHkaJ6I","Unknown T - Homerton B [Lyric Video]","UKs TopLyrics",false,357,191,"I DO NOT OWN THE RIGHTS TO THIS MUSIC I SIMPLY UPLOAD LYRIC VIDEOS TO THE MUSIC I LIKE FOR OTHER PEO"],
  ["wu7DgR4CYH8","Homerton B UNKN T","ECRP Radio",false,61,190,""],
  ["1A7VI5TMbxk","Homerton B (Lyrics)","Certii Lyrics",false,128,118,""],
  ["BCrMwL8uz28","Unknown T Explains 'Homerton B' To A Classical Music Expert | Classical Kyle | Capital XTRA","Capital XTRA",false,1124950,335,"Here's what happened when 'Homerton B' rapper Unknown T met classical musical expert Kyle. Subscribe"],
  ["E-l84LUXi9Y","SL - Excuse Me (Lyrics) ft. Unknown T","CENSORED",false,27568,190,"SL - Excuse Me (feat. Unknown T) • Follow DRILL YouTube: https://m.youtube.com/channel/UC8lZ2ob7LUjL"],
  ["3_4dn49l80Y","Unknown T (Homerton) - Homerton B (Official Westwood Version) [AUDIO] | Slammer Media","Slammer Media: Music",false,29021,225,"SUBSCRIBE & ENABLE for more: https://bit.ly/2WCyfQy ➡️ Visit our website for the latest videos & new"],
  ["66atxJP9Sso","Unknown T - Homerton B (Hella Toxics Edit)","Bank Music",false,2003174,165,"Unknown T - Homerton B (Hella Toxics Edit) •••••••••••••••••••••••••••••••••••••••••••••••••••••••••"],
  ["4oxgBlFcc9I","Unknown T - Homerton B (432 Hz)","Audio 432",false,2697,193,""],
  ["S2o2bMko4Hc","Unknown T - Homerton B (toxic remix)","Botang",false,333621,165,""],
  ["iMPSAKiHzKM","Unknown T - Homerton B 8D AUDIO","8DWave",false,228,194,"Unknown T - Homerton B 8D AUDIO #8daudio #ukmusic."],
  ["qi5K4D3bHVM","Unknown T - WW2","Unknown T",true,7063284,218,"BLOOD DIAMOND, THE NEW ALBUM (JAN 12) - PRE-ORDER NOW: https://unknownt.lnk.to/blooddiamondID Unknow"],
  ["C6aZT8htIyk","Unknown T - Homerton B (Bass Boosted)","JagguarIsTapped",false,2454,191,"ORIGINAL - https://www.youtube.com/watch?v=UrnACpUhe98 This video features materials protected by th"],
  ["TNSACyrxdmY","Unknown T - Homerton B (Slowed & Reverb)","The GKD Channel",false,8484,214,"Copyright Disclaimer under section 107 of the Copyright Act of 1976, allowance is made for “fair use"],
  ["PXWUU3qH0vw","Unknown T - BBK (Official Video)","Unknown T",true,381654,149,"Official video for Unknown T - BBK Pre save LISTEN. on all platforms → https://drop.cobrand.com/d/Un"],
  ["Y9T3N_trY10","Unknown T - Homerton B (Original Version) #Exclusive | Evolve Media","Evolve Media Entertainment",false,192956,226,"Available on Soundcloud : https://soundcloud.com/evolve-media/unknown-t-homerton-b-exclusive Follow "],
  ["GGmC7JfJ6kY","Unknown T - Homerton B | Homegrown Live With Vimto | Capital XTRA","Capital XTRA",false,92220,257,"Capital XTRA's Homegrown Live took over London's Shepherd's Bush on April 22nd 2019, bringing togeth"],
]);

// ---------------------------------------------------------------------------
// 2026-11-14: channel-name misses from the random-song evaluation (tools/eval/data/run-20261116,
// candidates.json: the saved search results of all three searches; descriptions cut to 100 characters).

/** "Heavy D & The Boyz Now That We Found Love lyrics" + "Heavy D & The Boyz Now That We Found Love official audio" + "Heavy D & The Boyz Now That We Found Love" */
export const nowThatWeFoundLove = rows([
  ["wAHOWd2K2o8","Now That We Found Love- Heavy D and the Boyz Lyrics","LeaseLeeLeeWhatever",false,393757,270,"Now that we found love by heavy d and the boyz- lyrics on screen."],
  ["NNEgUPKxk7A","Heavy D & The Boyz - Now That We Found Love (Official Music Video) ft. Aaron Hall","HeavyDAndTheBoyzVEVO",true,69999039,258,"REMASTERED IN HD!! Official Music Video for Now That We Found Love performed by Heavy D & The Boyz f"],
  ["1eClcEexziE","Heavy D & The Boyz - Now that we found love Ft. Aaron Hall Lyrics","Mix Lyrics",false,33132,267,"Hey! Hope you enjoy! More videos will be coming soon!"],
  ["vswgZ6CKI4k","Heavy D & The Boyz   Now That We Found Love lyrics","Butter tenor",false,2304,259,""],
  ["fAnKORQ4YL0","Heavy D and the boyz - now that we found love ( 1991)","noddi ginge",false,1453514,258,"heavy d and the boyz now that we found love what are we gona do 1991 oldskool track."],
  ["wTWX9xBsIGk","Heavy D & The Boyz - Now That We Found Love (Lyrics)","Futrusic",false,1937,348,""],
  ["RDxfgtAD6fs","Heavy D and The Boyz -  Now That We Found Love  1991 Lyrics","elconejitovibes RNB Vevo",false,751,258,""],
  ["68J1InYzvOI","Now that we found love Heavy D & the Boyz","GPITRAL2 Music for Learning English with subtitles",false,381,269,"In the name of Fair Use and Creativity I uploaded this video only for Educational Purpose, that is L"],
  ["IQKpUTF2tjk","Hitch - Now That We Found Love","PlayNowPlayL8tr",false,244436,102,"Hitch(2005)scene set to Heavy D Now That We Found Love(1991) Lyrics : Now that we found found love W"],
  ["UhRRIT1xms4","Heavy D. & The Boyz - Now That We Found Love (1991)","the90sguy",false,23103,259,"Genre: Hip Hop Style: RnB/Swing, Pop Rap, Conscious Year: 1991."],
  ["jQtZ2GdD2t0","Now That We Found Love (Club Version)","Heavy D - Topic",false,525546,347,"Provided to YouTube by Universal Music Group Now That We Found Love (Club Version) · Heavy D & The B"],
  ["ZPER2vUzVpw","Heavy D  & The Boys feat Aaron Hall -Now That We Found Love","In The Groove With DJ RayRay",false,128,257,""],
  ["363PUwlVy_0","Heavy D & The Boyz (Feat. Aaron Hall) - Now That We Found Love 1991 HQ","The Lonely “Rain and Music” Shepherd",false,1895,257,"Heavy D & The Boyz (Feat. Aaron Hall) - Now That We Found Love 1991 HQ #90sHits #Oldies #HQAudio #고음"],
  ["U0qHdJR0PqQ","Now That We Found Love (Club Version)","Heavy D - Topic",false,502549,348,"Provided to YouTube by Universal Music Group Now That We Found Love (Club Version) · Heavy D & The B"],
  ["pinUhF0AXRk","Now That We Found Love (12\" Version)","Third World - Topic",false,1814916,496,"Provided to YouTube by Universal Music Group Now That We Found Love (12\" Version) · Third World Regg"],
  ["MxKYeAKC5cA","Heavy.D.Ft.The Boyz & Aaron Hall - Now That We Found Love","Peter Koffler (agurez100)",false,3989,256,""],
  ["HK8PumNbD0k","Heavy D & The Boyz - \"Now That We've found Love\" | Phil Wright Choreography | Ig: @phil_wright_","Phil Wright",true,1209837,847,"The Parent Jam** Come Visit me at Millennium Dance Complex Open Hiphop. All souls are Welcome! Follo"],
  ["1k1lGGLKvCE","Heavy D - Now That We Found Love LIVE at the Apollo 1991","TgotSoul",false,33983,227,"Showtime at the Apollo Original airdate: 9/14/91 RIP Heavy D."],
  ["bQ37_b4PJ6M","Heavy D - \"Now That We Found Love\" Live (1992)","KlassicThrowbackTV",false,135538,145,"Performed @ Soul Train Awards (1992)"],
  ["EWWj0N2BSD4","Heavy D & Tyrese Perform 'Now That We Found Love' | Black & Iconic | Black History Month '24","BETNetworks",true,65815,74,"Watch this stellar throwback video of Heavy D joined by special guest Tyrese, performing 'Now that w"],
]);

/** "YOH KAMIYAMA Bunny lyrics" + "YOH KAMIYAMA Bunny official audio" + "YOH KAMIYAMA Bunny" */
export const bunny = rows([
  ["0DAXia5oq48","[Yoh Kamiyama] bunny (Sub. Español)","dazeclipse",false,4448,215,"LEER DESCRIPCION~~~~ bunny -----CREDITOS------ Artista: Yoh Kamiyama (神山羊) Album: ゆめみる こども (Yumemiru"],
  ["1_lap6dzSUc","神山 羊 - YELLOW 「English Lyrics」","神山羊 / Yoh Kamiyama",true,173392494,181,"Music / Vocal: Yoh Kamiyama Music Video: Touyouigaku Official HP: https://ewe.persona.co God goat Tw"],
  ["9-Ymfse8xnU","rabbit / 初音ミク / john / ENG/ROM SUB","lianavich",false,56368,147,"ENGLISH TRANSLATION AND VIDEO NOT MINE. I ONLY EDITED THE SUBTITLES.⚠️ IF JOHN ASKS ME TO DELETE THE"],
  ["YvkeP8xW5ig","카미야마 요우(Yoh Kamiyama) - YELLOW / [가사/번역/발음] / Lyric video","편집사",false,19039,181,"원산지 표기 - https://www.youtube.com/watch?v=1_lap6dzSUc 오늘 준비한 메뉴는 PERSONA님이 주문해주신 카마야마 요우 의 ..."],
  ["2FJGdlTIR9M","Irokousui『English and Spanish lyrics』 Horimiya OP - Yoh Kamiyama","KainerNS Music",false,477,92,"Irokousui『English and Spanish lyrics』 Horimiya OP - Yoh Kamiyama Artist : Yoh Kamiyama SONG: Irokous"],
  ["T-kYbXfmh_o","[youman feat Meika Hime] Tiny Bunny - English subs","PandaKittenhybrid",false,16471,209,"Hope. This is my eighth work. Nevertheless, I hope I can live up to expectations.” Please read trans"],
  ["8RllhQr6j_U","bunny: puddle","puddle",true,3980,220,"singing by ariel wiechmann lyrics by ariel wiechmann production by ariel wiechmann mixing by ariel w"],
  ["7t3GuI_9YFw","Horimiya OP Full /『Yoh Kamiyama - Iro Kousui』/【AMV Lyrics】","Serpentinooo",false,707104,289,"Alerta de SPOILER 1-12 Anime: Hori-san to Miyamura-kun - Horimiya Opening: Iro Kousui Artista: Yoh K"],
  ["vqnMv4t0Xmk","Kamiyama Yoh bunny played by TROFIK","TROFIK",false,134,222,""],
  ["Xm_fcaAGBd8","Bunny - Yoh Kamiyama (sub. español)","lemonkat",false,711,214,"Audio de Bunny: https://youtu.be/Z4PTDfLt3i0 Suscríbete si te gustó el video :) ~~~~~~~~~~~~~~~~~~~~"],
  ["AeSUd1_sCDo","Kamiyama Yoh - bunny [fluffy] - 5.13* osu!","Meow",false,517,223,"Venturing into 5 star maps and managed to pass this one. Love the song and the map quite a lot. Only"],
  ["-CQJLhop824","神山羊 - Laundry【Music Video】/ Yoh Kamiyama - Laundry","神山羊 / Yoh Kamiyama",true,3105348,259,"Digital Single「Laundry」 2020.9.23 Release ▷Listen https://KMYM.lnk.to/laundry 【神山羊Official Infomatio"],
  ["20Kww6tiqvs","Kamiyama Yoh - journey: Funky song, funky map","White_Snakes",false,97,183,""],
  ["wZEktVNpYNM","Yoh Kamiyama - 色香水 (Irokousui) (Instrumental) | Horimiya Opening","Rockstar Beats",false,33549,251,"DOWNLOAD LINK: https://hypeddit.com/73rhc6 Originally produced by 神山羊 (YOH KAMIYAMA) Get access to A"],
  ["Z4PTDfLt3i0","bunny","神山羊 / Yoh Kamiyama",true,1111894,215,"Provided to YouTube by NexTone Inc. bunny · 神山羊 ゆめみるこども Released on: 2019-10-23 Auto-generated by Yo"],
  ["MrRoqikphHs","Yoh Kamiyama -【Bunny】","Akari Oni-chan",false,319,216,"Song: Bunny Artist: Yoh Kamiyama Album: 2nd mini Album ゆめみる こども (Yumemiru Kodomo)"],
  ["qbYHAVk5xOE","bunny [fluffy] Kamiyama Yoh Canada #1","Aze",false,45,223,"https://osu.ppy.sh/beatmapsets/1070206#osu/2240193."],
  ["yhKjscoQlY8","Kamiyama Yoh bunny played by TROFIK","TROFIK",false,27,222,""],
  ["r5n1cPY0SBs","bunny - Kamiyama Yoh (osu!)","Wica",false,151,231,"Canción: bunny Artista: Kamiyama Yoh suscribete baby ;)"],
  ["gK1873gCBGE","Sugar Highway","神山羊 / Yoh Kamiyama",true,295197,269,"Provided to YouTube by NexTone Inc. Sugar Highway · YOH KAMIYAMA SHIAWASE NA OTONA Released on: 2019"],
  ["yYlIRrHfAKk","Kamiyama Yoh Bunny Played By Hypnosophy","Hypnosophy",false,17,222,""],
]);

/** "Legendaire Wayoo lyrics" + "Legendaire Wayoo official audio" + "Legendaire Wayoo" */
export const wayoo = rows([
  ["Q_TzqcWKz00","PLAVE(플레이브) '왜요 왜요 왜? (Why?)' | Official Lyric Video","PLAVE 플레이브",true,8871104,149,"PLAVE(플레이브) Official FanCafe : https://cafe.daum.net/plave Twitter : https://twitter.com/plave_offic"],
  ["_XdMFPXLK48","Rema - YAYO (Lyric Visualizer)","Rema",true,10242591,152,"Rema - YAYO (Visualizer) Steam 'HeIs' by Rema - https://rema.lnk.to/HEIS Follow Rema: Website: https"],
  ["5jixr3Z6dnw","Clipse \"Chains & Whips\" Lyrics & Meaning | Genius Verified","Genius",true,315283,420,"Clipse are at Genius for a one-of-a-kind week dedicated entirely to them! Kicking things off is a Ve"],
  ["IGNiC2hNaw0","Blaqbonez - Chanel (feat. Asake) Lyric Video","Blaqbonez",true,313190,171,"Blaqbonez teams up with Asake on “Chanel” one of the most anticipated Nigerian releases of 2026. Alr"],
  ["n3T-FO29h-E","Cypress Hill \"Insane In The Brain\" Official Lyrics & Meaning | Verified","Genius",true,250421,547,"Legendary Cypress Hill stopped by Genius Studios to break down their hit song “Insane In The Brain.”"],
  ["mov93Av3GQE","Tiwa Savage & Wande Coal & MAVO - Energy (Lyric Video)","Tiwa Savage",true,2674818,138,"Listen to Tiwa Savage & Wande Coal & MAVO - Energy - https://ditto.fm/energy_ Follow Tiwa Savage Ins"],
  ["Qo8gX1Evay8","Christina Aguilera - Loyal Brave True (From \"Mulan\"/Official Lyric Video)","DisneyMusicVEVO",true,15005246,170,"\"Mulan (2020)\" is available on Disney+ Acclaimed filmmaker Niki Caro brings the epic tale of China's"],
  ["UKAlsYb2V6o","Come Holy Spirit (Uthando) Lyric Video - LIVE at LIV","Worship Central South Africa",false,1005348,360,"Come Holy Spirit (Uthando) recorded LIVE at LIV Village. Featuring Mark Counihan, Langa Mbonambi and"],
  ["nytpYtLtHpE","The Grinch | \"You’re a Mean One, Mr. Grinch\" Lyric Video | Illumination","Illumination",true,57903224,114,"The Grinch Subscribe to Illumination: https://www.youtube.com/illumination #TheGrinch #Illumination "],
  ["10kkoSf_bc0","LYRICS That Meant More Than Just a Song… They HIT Different 🎧💔","Top Talent",true,262712,2736,"Lyrics That Mean More Than Just A Song... 00:00 - Aaron J Hart - Ireland's Got Talent 06:16 - Nicoti"],
  ["U8gocOXyKis","Tekno - Wayo (Official Music Video)","Tekno",true,16105383,172,"Wayo” is driven by infectious percussion, hypnotic synths, and lush guitar arrangements, and held to"],
  ["BewrUtHF2Zc","Legendary Lovers","Katy Perry",true,41824200,225,"Provided to YouTube by Universal Music Group Legendary Lovers · Katy Perry PRISM ℗ 2013 Capitol Reco"],
  ["uYwmGgjnId8","WAYO (Live) - Liyathambara (ලියතඹරා) by Athma Liyanage","WAYO",true,9215041,288,"Athma Liyanage - Liyathambara (ලියතඹරා) Become A Wayan: http://bit.ly/WayoYouTube WAYO | Api Kawruda"],
  ["GOY6P-F1PKw","Api Kawuruda (අපි කවුරුද) ft. Senaka Batagoda - WAYO Jeewithe (Life in Concert)","WAYO",true,6204881,310,"Become A Wayan: http://bit.ly/WayoYouTube WAYO - Api Kawuruda --------------------------------------"],
  ["Z2CZn966cUg","Welshly Arms - Legendary","WelshlyArmsBand",true,56195093,218,"Music video by Welshly Arms performing Legendary.© 2017 Position Music, under exclusive license to V"],
  ["tlEzrk_49GM","WAYO (Live) - Lamathani (ළමාතැනී)","WAYO",true,8248184,202,"Become A Wayan: http://bit.ly/WayoYouTube WAYO - Lamathani (ළමාතැනී) by Sangeeth Wijesuriya. Lyrics-"],
  ["RpHK-6oftXE","WAYO (Live) - Sangeeth Medley (සංගීත් Medley)","WAYO",true,17881175,429,"Become A Wayan: http://bit.ly/WayoYouTube WAYO - Sangeeth Medley. WAYO Sangeeth : vocals Ricky : gui"],
  ["s3OGhaSqvm4","Beat Construction 🔥Prod. Foodj🔥 Madrigal, LEGENDAIRE Nivram feat. Akatsuki SN & Mist Cash","Foodj Madrigal",true,122,58,"Beat construction of the new track LEGENDAIRE for Nivram and Akatsuki SN & Mist Cash prod. Foodj Mad"],
  ["pGMptHmLT-w","Katy Perry - Legendary Lovers","Natanael cruz",false,593825,225,"Download \"Unconditionally\" from Katy Perry's 'PRISM': http://smarturl.it/PRISM Official video for Ka"],
  ["KyaTlgEYGGw","Vidéo Projections Soirée Quality Streetz Batofar 2003","Daniel0Kleiman",false,427,111,"Réalisation d'un clip démo d'aprés les Vidéo-projections \"multicam\" diffusées lors de trois soirées "],
  ["8dZZGUK6J-s","Wayoo","Legendaire Officiel",true,125,175,"Provided to YouTube by TuneCore Wayoo · legendaire Melography ℗ 2024 Arab Art Empire Released on: 20"],
  ["k46WASLHhW4","pbz légendaire wayo","Jordan Pobrezo",false,4449,182,""],
  ["nLgX0Zt17cc","WahOo !! Ouverture Collection LÉGENDAIRE KAIBA","chaine Yu-Gi-Oh",false,14773,712,"Abonne toi et active les notifications en cliquant sur la juste au dessus pour voir toutes mes vidéo"],
  ["VrFiDlWjriU","Wahoo McDaniel on his legendary battles in Florida Championship Wrestling!","Title Match Wrestling",true,3094,516,"Wahoo McDaniel discusses his legendary battles in Florida Championship Wrestling involving Johnny Va"],
  ["Q5QE9IKk8hU","USS Wahoo: Russia Discovered America’s Legendary Submarine — What They Found Was Shocking","Reef Discovery",false,1811,1396,"The legendary USS Wahoo was one of America's most feared submarines—until it vanished without a trac"],
  ["XwshpRi2GhE","Legendary Duo-Mush Morton and USS Wahoo-Episode 203","Unauthorized History of the Pacific War Podcast",false,280694,6309,"This week Seth and Bill discuss the patrols of the legendary US fleet boat, USS Wahoo (SS-238), and "],
  ["aS5nk05vVig","USS Wahoo: Russia Found America's Legendary Submarine - What They Saw Was Shocking","Naval Report",false,218980,2735,"USS Wahoo: Russia Found America's Legendary Submarine - What They Saw Was Shocking In 2006, a Russia"],
  ["sbOceEyzScs","Wahoo McDaniel on why he wrestled for Vince McMahon Sr & Never went back!","Title Match Wrestling",true,1625,213,"Wahoo McDaniel discusses wrestling for Vince McMahon Sr's WWWF and the reason he didn't go back. Wah"],
  ["NmB7daag2pk","Wahoo McDaniel on the Toughest Wrestlers He Ever Faced - Johnny Valentine & More!","Title Match Wrestling",true,1931,223,"Wahoo McDaniel discusses the toughest wrestlers he ever faced in his career including Johnny Valenti"],
  ["gGoxvAo8x38","Wahoo McDaniel on why he quit on Dory Funk Sr in TX for his bad payout!","Title Match Wrestling",true,4784,382,"Wahoo McDaniel discusses why he quit on Dory Funk Sr in TX for his bad payout. Wahoo also quit on Ph"],
]);

/** "Fito Olivares Que Te Vas Y Te Vas lyrics" + "Fito Olivares Que Te Vas Y Te Vas official audio" + "Fito Olivares Que Te Vas Y Te Vas" */
export const queTeVas = rows([
  ["02eBacAUMqA","Fito Olivares - Que Te Vas y Te Vas ( Letra/Lyrics) | “ vete y no digas adiós es mejor para los dos”","Lynx.",false,185492,200,"Artista: Fito Olivares Canción: Que Te Vas y Te vas Lanzamiento: 19/11/2023 Género: Cumbia Sigue a F"],
  ["AkLs5ZRRroQ","Que Te Vas Y Te Vas","Fito Olivares Y La Pura Sabrosura",true,8834279,200,"Provided to YouTube by TuneCore Que Te Vas Y Te Vas · Fito Olivares Tambores Y Sabor ℗ 1994 UMG Reco"],
  ["e_pwtPye-nA","Que Te Vas","Fito Olivares Y La Pura Sabrosura",true,708288,207,"Provided to YouTube by Believe SAS Que Te Vas · Fito Olivares Que Te Vas ℗ Pentagon Music / Media Ag"],
  ["jbgDh1aCe_4","Fito Olivares - Que Te Vas Y Te Vas","raiderricardo",false,49635,200,"Fito Olivares - Que Te Vas Y Te Vas."],
  ["ycY9d5H6xcM","Fito Olivares - Que Te Vas y Te Vas (EPICENTER+REEVERB)","JRZ EPICENTER BASS",false,403120,200,""],
  ["4ZJuBRPhWB0","Fito Olivares qué te vas","Vino con Coka",false,18627,191,""],
  ["zVDY16YDg6g","QUE TE VAS Y TE VAS FITO OLIVARES (SIMPLE MIX) DJ EBAROS #tropitangobailable  #tropitango #TIKTOK","djebaros",false,234906,171,"NO SABEN LO AGRADECIDO QUE ESTOY DE TODOS USTEDES GRACIAS POR TANTO PERDON POR TAN POCO!!!! TEMITA ."],
  ["BWMM8u0Q_wM","FITO OLIVARES - QUE TE VAS ( CON GUARACHA ) ","PECHITO REMIX OFICIAL",false,3483,207,"guaracha #fitoolivares #quetevas #remixdj."],
  ["GmfQyM5RFDM","Que Te Vas, Que Te Vas - Fito Olivares","Leyendas Sonideras Vol.2",false,722361,197,"Exitos Del Tropitango Vol.1 - Selección de Oro."],
  ["QN8_pzu45o8","¨Que te vas¨  FITO  OLIVARES","Música Grupera de Siempre",false,1307,212,"Que te vas¨ tema de la inspiracion de Don Rodolfo FITO OLIVARES. Rodolfo Olivares ( Camargo, Tamauli"],
  ["Hlv4P5fvzls","Fito Olivares - que te vas y te vas 🎶","El VenoDiaz",false,541,201,"comparte para que no se pierda la buena musica."],
  ["t7hUnwXJaRU","Que Te vas Y te Vas - Fito Olivares (REVERB)","Dragón_(EPICENTER)",false,2697,201,""],
  ["GA0yfcOhnJ8","Que Te Vas - Fito Olivares","Jose Fernando CL",false,4232,207,"Muy buen ritmo en esta cumbia ..."],
]);

/**
 * Real results of 2026-11-26 (merged as pipeline.ts merges them; "lyrics" came back with
 * most entries stripped of channel and views, "official audio" had them).
 * "Bassnectar The 808 Track lyrics" + "Bassnectar The 808 Track official audio" + "Bassnectar The 808 Track" */
export const the808Track = rows([
  ["IdnBTJiUVDQ","Bassnectar- The 808 Track (feat. Mighty High Coup) [OFFICIAL]","Bassnectar",true,3501815,272,"The 808 Track (feat. Mighty High Coup) f"],
  ["3Mq0VpLSnwc","The 808 Track (Bassnectar)","PURPLETAC0S69",false,90,314,"The 808 Track."],
  ["pAMrGHa7ubM","Bassnectar - 808 Track [HQ]","The Moon Babies",false,111974,272,"From Wildstyle."],
  ["vLTT7jGwm_U","Speakerbox (feat. Lafa Taylor)","",false,null,283,""],
  ["41k1a9wpta0","Bassnectar - The 808 Track","",false,null,272,""],
  ["h5s_0N417rM","Bassnectar- The 808 Track","",false,null,272,""],
  ["gww1rBLMnU8","Bassnectar - Undercover ◈ [Reflective Part 4]","",false,null,149,""],
  ["nGlIDlOqurA","Ellie Goulding - Lights (Bassnectar Remix) [FULL OFFICIAL]","",false,null,304,""],
  ["njqDWNET8Ss","Bassnectar - The Matrix [HQ] [Lyrics]","",false,null,270,""],
  ["JRftXCiqfQ8","Bassnectar - Bass Head (Official)","Bassnectar",true,28536481,397,"Just in time for Spring comes Bassnectar"],
  ["ynDKvg1_P1A","Bassnectar- The 808 Track (feat. Mighty High Coup)","DubSt3pRadio",false,11942,272,"Check out the latest Bassnectar @: Faceb"],
  ["jg-2WWiHV9Q","Bassnectar - The 808 Track (feat. Mighty High Coup)","sharmanhall1 !",false,2118,273,"Title: The 808 Track (feat. Mighty High "],
  ["RUjigR12uvc","Bassnectar & The Mighty High Coup - The 808 Track","MutilateDub",false,305,272,""],
  ["pstwHnVif3s","Bassnectar   The 808","Veverythingmedia12",false,55,273,""],
  ["j1WVuo_LqlQ","Bassnectar  - 808 Track","TheClockWorkStone",false,121,272,"Hope you enjoy the song :D Like subscrib"],
  ["YnMQFg9_dGc","Breaking Bad Season 4 (2011) The 808 Track (Soundtrack OST)","portaps19",false,254628,273,"01 Main Title 02 Bringing It Back 03 Tru"],
  ["CLSS9Fv1olM","Bassnectar \"The 808\" track Summer Camp 2011","4womp2womp0",false,1245,247,"bassnectar at summer camp 2011."],
  ["_d_YQno_Cuc","Bassnectar - Don't Hate The 808 Ft. Lafa Taylor","Bassnectar",true,809012,198,"OUT NOW! - http://www.bassnectar.net Pre"],
]);

/**
 * Real results of 2026-11-26: the two searches, the plain one, then the first-artist one.
 * "Nguyễn Đình Vũ, Neko Lê & flechazowu Liều Thuốc Cho Trái Tim (Slowed) lyrics" + "Nguyễn Đình Vũ, Neko Lê & flechazowu Liều Thuốc Cho Trái Tim (Slowed) official audio" + "Nguyễn Đình Vũ, Neko Lê & flechazowu Liều Thuốc Cho Trái Tim (Slowed)" + "Nguyễn Đình Vũ Liều Thuốc Cho Trái Tim (Slowed)" */
export const lieuThuoc = rows([
  ["O9lg-wWqiWU","Chúng ta sau này - T.R.I × 1 9 6 7 (𝙨𝙡𝙤𝙬𝙚𝙙 + 𝙧𝙚𝙫𝙚𝙧𝙗) /Toxic dope/","Toxic dope",true,6494,258,"Chúng ta sau này - T.R.I × 1 9 6 7 (slow"],
  ["mM5Wgo7zCl8","chiều thứ hai - redt x 1 9 6 7 (𝙨𝙡𝙤𝙬𝙚𝙙 + 𝙧𝙚𝙫𝙚𝙧𝙗) /flechazowu/","flechazowu",true,9457,276,"các bạn nên đeo tai nghe để có trải nghi"],
  ["oPytnWkC09Q","Cảm ơn em đã đến - Quang Hùng MasterD × 1 9 6 7 (𝙨𝙡𝙤𝙬𝙚𝙙 + 𝙧𝙚𝙫𝙚𝙧𝙗) /Toxic dope/","Toxic dope",true,37662,344,"Cảm ơn em đã đến - Quang Hùng MasterD × "],
  ["2BoJRI9yxJE","Khi em lớn - Orange ft. Hoàng Dũng × 1 9 6 7 (𝙨𝙡𝙤𝙬𝙚𝙙 + 𝙧𝙚𝙫𝙚𝙧𝙗) /Toxic dope/","Toxic dope",true,7588,286,"Khi em lớn - Orange ft. Hoàng Dũng × 1 9"],
  ["F33_8e8RIWk","Missing you - Phương Ly ft. Tinle × 1 9 6 7 (𝙨𝙡𝙤𝙬𝙚𝙙 + 𝙧𝙚𝙫𝙚𝙧𝙗) /Toxic dope/","Toxic dope",true,11886,263,"Missing you - Phương Ly ft. Tinle × 1 9 "],
  ["fL1VWvJvltw","Trò đùa ? - Quang Đăng Trần × 1 9 6 7 (𝙨𝙡𝙤𝙬𝙚𝙙 + 𝙧𝙚𝙫𝙚𝙧𝙗) /Toxic dope/","Toxic dope",true,16066,295,"Trò đùa ? - Quang Đăng Trần × 1 9 6 7 (s"],
  ["FYhbInI-sKs","chưa từng mặc váy cưới","gái hmong Hà Giang",false,26,21,""],
  ["SCRcJ1PHxb4","◉ Playlist 47 ~ vì trái tim anh yêu em nhiều lắm...Tổng hợp những bản slowed gây nghiện!!","Toxic dope",true,7990,1896,"Playlist: Vì trái tim anh yêu em nhiều l"],
  ["hLTJD5VmzkM","Liều thuốc cho trái tim - Nguyễn Đình Vũ ft. Neko × 1 9 6 7 (𝙨𝙡𝙤𝙬𝙚𝙙 +𝙧𝙚𝙫𝙚𝙧𝙗)/Toxic dope/","Toxic dope",true,87313,397,"Liều thuốc cho trái tim - Nguyễn Đình Vũ"],
  ["RBH1MnN2ahs","Liều Thuốc Cho Trái Tim [ Lofi Ver. ]- | Nguyễn Đình Vũ x ft. Neko xMinn |- by Present? Music slowed","𝗣𝗿𝗲𝘀𝗲𝗻𝘁?",false,217,439,"Liều Thuốc Cho Trái Tim - Nhạc lofi chil"],
  ["E6jIFSAj3Yk","lyrics LIỀU THUỐC CHO TRÁI TIM | NGUYỄN ĐÌNH VŨ x NEKO | REMAKE","Pi OFFICIAL",false,146,223,"Video Gốc : https://youtu.be/4TMNeEbj0kc"],
  ["Ohe_KqhgdWM","[ Chill Music ]_Liều Thuốc Cho Trái Tim - Nguyễn Đình Vũ ft. Neko x Minn","Kể Truyện Hot",false,348,396,"Chill Music Lyrics Mùa đông như vây kín "],
  ["i9aD-3TNFrA","Liều Thuốc Cho Trái Tim (Lofi Ver.)","Đenn - Topic",false,847,261,"Provided to YouTube by CT Media Liều Thu"],
  ["zsZ-M7N1j3k","Liều Thuốc Cho Trái Tim | Trọn Đời Bên Em 2 | Part4 | Lý Hải","Thiên Mệnh",false,119,216,"Chúc anh chị em cô chú trong cuộc sống l"],
  ["cGRvJ0pESNM","#PLAYLIST04 - Nhạc slowed lofi chill thất tình hợp tâm trạng - for cafe, relax, chill","Cố Niệm",false,12,2611,"00:00 Liều Thuốc Cho Trái Tim - Nguyễn Đ"],
  ["7DkrmNasuHw","Tình yêu của anh - Phú Quí (𝙨𝙡𝙤𝙬𝙚𝙙 + 𝙧𝙚𝙫𝙚𝙧𝙗) /Toxic dope/","Toxic dope",true,3397,217,"Tình yêu của anh - Phú Quí (slowed + rev"],
  ["UkDzoCdZIx0","Giọt Nước Mắt Mạnh Mẽ (#GNMMM) ‣ NGUYỄN ĐÌNH VŨ「Lyric Video」|| MUSIC CHIA TAY","ANH.",false,119,219,"Giúp em đạt 20000 Subscriber với ạ. Em c"],
  ["8CwsfULh28s","Dối Lừa (Thazh x Đông Remix) - Nguyễn Đình Vũ ♫ Anh Đưa Tay Ra Để Cố Vuốt Ve Khuôn Mặt Em Thật Xinh","Air Remix",true,2977998,179,"Dối Lừa (Thazh x Đông Remix) - Nguyễn Đì"],
]);
