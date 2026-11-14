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
