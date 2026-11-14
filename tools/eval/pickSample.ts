/**
 * Songs for the picker measurement (tools/eval/pickEval.ts): what a user might
 * type into "Add a song". Weighted to hip-hop/rap (several credited artists,
 * feat. credits, quoted titles on official uploads, explicit and clean
 * versions), then pop, rock, electronic, Latin, K-pop, country, R&B, older
 * songs and less famous artists.
 *
 * The iTunes Search API (anonymous, as the app calls it) lists only clean
 * versions of explicit songs (checked 2026-11-14, also with explicit=Yes), so
 * those are the names and lengths the app works with. `tap` is the title as
 * iTunes lists it when that differs from what the user typed (a censored title).
 */
export interface SampleSong {
  artist: string;
  title: string;
  genre: string;
  tap?: string;
}

const s = (genre: string, artist: string, title: string, tap?: string): SampleSong => ({ artist, title, genre, ...(tap ? { tap } : {}) });

export const SAMPLE: SampleSong[] = [
  // --- hip-hop / rap -------------------------------------------------------------------------
  s('hip-hop', '21 Savage', 'Rap Saved Me'),
  s('hip-hop', 'Metro Boomin', "Creepin'"),
  s('hip-hop', 'Travis Scott', 'SICKO MODE'),
  s('hip-hop', 'Drake', "God's Plan"),
  s('hip-hop', 'Kendrick Lamar', 'Not Like Us'),
  s('hip-hop', 'Kendrick Lamar', 'luther'),
  s('hip-hop', 'Future', 'Like That'),
  s('hip-hop', 'Gunna', 'fukumean', 'umean'),
  s('hip-hop', 'Jack Harlow', 'Lovin On Me'),
  s('hip-hop', 'Megan Thee Stallion', 'Savage'),
  s('hip-hop', 'Cardi B', 'Bodak Yellow'),
  s('hip-hop', 'Cardi B', 'WAP'),
  s('hip-hop', 'Post Malone', 'Sunflower'),
  s('hip-hop', 'DaBaby', 'ROCKSTAR'),
  s('hip-hop', 'Roddy Ricch', 'The Box'),
  s('hip-hop', 'Pop Smoke', 'Dior'),
  s('hip-hop', 'Eminem', 'Lose Yourself'),
  s('hip-hop', 'Eminem', 'Without Me'),
  s('hip-hop', '50 Cent', 'In Da Club'),
  s('hip-hop', 'OutKast', 'Hey Ya!'),
  s('hip-hop', 'Nelly', 'Hot In Herre'),
  s('hip-hop', 'Kanye West', 'Stronger'),
  s('hip-hop', 'JAY-Z', 'Empire State of Mind'),
  s('hip-hop', 'Lil Wayne', 'Lollipop'),
  s('hip-hop', 'Migos', 'Bad and Boujee'),
  s('hip-hop', 'Lil Uzi Vert', 'XO Tour Llif3'),
  s('hip-hop', 'Juice WRLD', 'Lucid Dreams'),
  s('hip-hop', 'Playboi Carti', 'Magnolia'),
  s('hip-hop', 'Doja Cat', 'Paint The Town Red'),
  s('hip-hop', 'Nicki Minaj', 'Super Bass'),
  s('hip-hop', 'GloRilla', 'Tomorrow 2'),
  s('hip-hop', 'Sexyy Red', 'SkeeYee'),
  s('hip-hop', 'Tyler, The Creator', 'EARFQUAKE'),
  s('hip-hop', 'J. Cole', 'No Role Modelz'),
  s('hip-hop', 'A$AP Rocky', 'Praise The Lord'),
  s('hip-hop', 'Drake', 'Rich Flex'),
  s('hip-hop', '21 Savage', 'a lot'),
  s('hip-hop', 'Polo G', 'RAPSTAR'),
  s('hip-hop', 'Lil Tecca', 'Ransom'),
  s('hip-hop', 'Central Cee', 'Sprinter'),
  s('hip-hop', 'Ice Spice', 'Princess Diana'),
  s('hip-hop', 'The Notorious B.I.G.', 'Juicy'),
  s('hip-hop', '2Pac', 'California Love'),
  s('hip-hop', 'Snoop Dogg', "Drop It Like It's Hot"),
  s('hip-hop', 'Missy Elliott', 'Get Ur Freak On'),
  s('hip-hop', 'Rae Sremmurd', 'Black Beatles'),
  s('hip-hop', 'Migos', 'Walk It Talk It'),
  s('hip-hop', 'Gunna', 'pushin P'),
  s('hip-hop', 'Lil Baby', 'Drip Too Hard'),
  s('hip-hop', 'Kodak Black', 'ZEZE'),
  s('hip-hop', 'BigXthaPlug', 'Mmhmm'),
  s('hip-hop', 'That Mexican OT', 'Johnny Dang'),
  s('hip-hop', 'Real Boston Richey', 'Help Me'),
  s('hip-hop', 'Travis Scott', 'FE!N'),
  s('hip-hop', 'Lil Nas X', 'Old Town Road'),
  s('hip-hop', 'Don Toliver', 'No Idea'),
  // --- pop -----------------------------------------------------------------------------------
  s('pop', 'Dua Lipa', 'Houdini'),
  s('pop', 'Sabrina Carpenter', 'Espresso'),
  s('pop', 'Taylor Swift', 'Anti-Hero'),
  s('pop', 'The Weeknd', 'Blinding Lights'),
  s('pop', 'Billie Eilish', 'BIRDS OF A FEATHER'),
  s('pop', 'Harry Styles', 'As It Was'),
  s('pop', 'Olivia Rodrigo', 'good 4 u'),
  s('pop', 'Chappell Roan', 'Good Luck, Babe!'),
  s('pop', 'Lady Gaga', 'Die With A Smile'),
  s('pop', 'Ariana Grande', '7 rings'),
  s('pop', 'Justin Bieber', 'Peaches'),
  // --- rock ----------------------------------------------------------------------------------
  s('rock', 'Queen', 'Bohemian Rhapsody'),
  s('rock', 'Nirvana', 'Smells Like Teen Spirit'),
  s('rock', 'Arctic Monkeys', 'Do I Wanna Know?'),
  s('rock', 'Foo Fighters', 'Everlong'),
  s('rock', 'The Killers', 'Mr. Brightside'),
  s('rock', 'Linkin Park', 'Numb'),
  s('rock', 'AC/DC', 'Back In Black'),
  s('rock', 'Fleetwood Mac', 'Dreams'),
  // --- electronic ----------------------------------------------------------------------------
  s('electronic', 'Daft Punk', 'Get Lucky'),
  s('electronic', 'Avicii', 'Wake Me Up'),
  s('electronic', 'Fred again..', 'Delilah (pull me out of this)'),
  s('electronic', 'Skrillex', 'Bangarang'),
  s('electronic', 'David Guetta', 'Titanium'),
  s('electronic', 'Disclosure', 'Latch'),
  s('electronic', 'Swedish House Mafia', "Don't You Worry Child"),
  // --- Latin ---------------------------------------------------------------------------------
  s('latin', 'Bad Bunny', 'DtMF'),
  s('latin', 'Bad Bunny', 'Tití Me Preguntó'),
  s('latin', 'Daddy Yankee', 'Gasolina'),
  s('latin', 'Luis Fonsi', 'Despacito'),
  s('latin', 'KAROL G', 'TQG'),
  s('latin', 'Peso Pluma', 'Ella Baila Sola'),
  s('latin', 'J Balvin', 'Mi Gente'),
  s('latin', 'ROSALÍA', 'DESPECHÁ'),
  // --- K-pop ---------------------------------------------------------------------------------
  s('k-pop', 'BTS', 'Dynamite'),
  s('k-pop', 'BLACKPINK', 'How You Like That'),
  s('k-pop', 'NewJeans', 'Super Shy'),
  s('k-pop', 'ROSÉ', 'APT.'),
  s('k-pop', 'aespa', 'Supernova'),
  s('k-pop', 'Jung Kook', 'Seven'),
  // --- country -------------------------------------------------------------------------------
  s('country', 'Morgan Wallen', 'Last Night'),
  s('country', 'Luke Combs', 'Fast Car'),
  s('country', 'Zach Bryan', 'Something in the Orange'),
  s('country', 'Shaboozey', 'A Bar Song (Tipsy)'),
  s('country', 'Post Malone', 'I Had Some Help'),
  s('country', 'Dolly Parton', 'Jolene'),
  s('country', 'Chris Stapleton', 'Tennessee Whiskey'),
  // --- R&B -----------------------------------------------------------------------------------
  s('r&b', 'SZA', 'Kill Bill'),
  s('r&b', 'Beyoncé', 'Crazy In Love'),
  s('r&b', 'Usher', 'Yeah!'),
  s('r&b', 'Frank Ocean', 'Thinkin Bout You'),
  s('r&b', 'Summer Walker', 'Girls Need Love'),
  s('r&b', 'Brent Faiyaz', 'Dead Man Walking'),
  s('r&b', 'Daniel Caesar', 'Best Part'),
  // --- older ---------------------------------------------------------------------------------
  s('older', 'Michael Jackson', 'Billie Jean'),
  s('older', 'Earth, Wind & Fire', 'September'),
  s('older', 'ABBA', 'Dancing Queen'),
  s('older', 'Whitney Houston', 'I Wanna Dance with Somebody (Who Loves Me)'),
  s('older', 'Prince', 'Kiss'),
  s('older', 'Marvin Gaye', "Let's Get It On"),
  // --- less famous ---------------------------------------------------------------------------
  s('indie', 'Khruangbin', 'Time (You and I)'),
  s('indie', 'Men I Trust', 'Show Me How'),
  s('indie', 'Still Woozy', 'Goodie Bag'),
  s('indie', 'Wallows', 'Are You Bored Yet?'),
  s('indie', 'Cafuné', 'Tek It'),
  s('indie', 'Mk.gee', 'Are You Looking Up'),
];

/**
 * Explicit-heavy songs for the search measurement (tools/eval/searchEval.ts):
 * rap, trap, drill, reggaeton and metal, many of them without a clean version
 * (so missing from the anonymous iTunes search) or with a censored clean title.
 */
export const EXPLICIT_SAMPLE: SampleSong[] = [
  // --- rap / trap ----------------------------------------------------------------------------
  s('rap', 'Drake', 'Nokia'),
  s('rap', 'Kendrick Lamar', 'HUMBLE.'),
  s('rap', 'Kendrick Lamar', 'tv off'),
  s('rap', 'Travis Scott', 'goosebumps'),
  s('rap', 'Travis Scott', 'HIGHEST IN THE ROOM'),
  s('rap', '21 Savage', 'redrum'),
  s('rap', 'Metro Boomin', 'Superhero (Heroes & Villains)'),
  s('rap', 'Yeat', 'Get Busy'),
  s('rap', 'Ken Carson', 'Fighting My Demons'),
  s('rap', 'Playboi Carti', 'Sky'),
  s('rap', 'Lil Uzi Vert', 'Just Wanna Rock'),
  s('rap', 'Cardi B', 'Up'),
  s('rap', 'Megan Thee Stallion', 'HISS'),
  s('rap', 'Sexyy Red', 'Pound Town'),
  s('rap', 'GloRilla', "F.N.F. (Let's Go)"),
  s('rap', 'Doechii', 'DENIAL IS A RIVER'),
  s('rap', 'City Girls', 'Act Up'),
  s('rap', 'Lil Jon & The East Side Boyz', 'Get Low'),
  s('rap', 'Juvenile', 'Back That Azz Up'),
  s('rap', 'Future', 'Mask Off'),
  s('rap', 'A$AP Ferg', 'Plain Jane'),
  s('rap', 'Lil Pump', 'Gucci Gang'),
  s('rap', 'Kanye West', 'Carnival'),
  s('rap', 'Tyga', 'Rack City'),
  // --- drill ---------------------------------------------------------------------------------
  s('drill', 'Pop Smoke', 'Welcome To The Party'),
  s('drill', 'Fivio Foreign', 'Big Drip'),
  s('drill', 'Kay Flock', 'Shake It'),
  s('drill', 'Chief Keef', 'Love Sosa'),
  s('drill', 'King Von', 'Crazy Story'),
  s('drill', 'Central Cee', 'Doja'),
  s('drill', 'Digga D', 'Woi'),
  s('drill', 'Sheff G', 'No Suburban'),
  s('drill', 'Unknown T', 'Homerton B'),
  s('drill', 'Headie One', 'Both'),
  // --- reggaeton -----------------------------------------------------------------------------
  s('reggaeton', 'Bad Bunny', 'Safaera'),
  s('reggaeton', 'Bad Bunny', 'MONACO'),
  s('reggaeton', 'Bad Bunny', 'Yo Perreo Sola'),
  s('reggaeton', 'Myke Towers', 'LALA'),
  s('reggaeton', 'Feid', 'Normal'),
  s('reggaeton', 'Rauw Alejandro', 'Todo de Ti'),
  s('reggaeton', 'Anuel AA', 'China'),
  s('reggaeton', 'Daddy Yankee', 'Con Calma'),
  s('reggaeton', 'Young Miko', 'offline'),
  // --- metal ---------------------------------------------------------------------------------
  s('metal', 'Slipknot', 'Duality'),
  s('metal', 'Slipknot', 'Psychosocial'),
  s('metal', 'System Of A Down', 'Chop Suey!'),
  s('metal', 'Rage Against The Machine', 'Killing In the Name'),
  s('metal', 'Bring Me The Horizon', 'Can You Feel My Heart'),
  s('metal', 'Limp Bizkit', 'Break Stuff'),
  s('metal', 'Korn', 'Freak On a Leash'),
  s('metal', 'Disturbed', 'Down with the Sickness'),
  s('metal', 'Pantera', 'Walk'),
];
