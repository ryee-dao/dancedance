/**
 * The genre vocabulary songStyle.ts was reviewed against (tests and
 * tools/eval/genreTable.ts): the iTunes primary genre names (music, incl. the
 * regional and sub-genre names the store returns) and the common Wikipedia /
 * MusicBrainz / TheAudioDB names. Tests only.
 */

export const ITUNES_GENRES: readonly string[] = [
  'Alternative', 'Anime', 'Blues', 'Brazilian', "Children's Music", 'Chinese', 'Christian & Gospel', 'Christian', 'Gospel', 'Classical', 'Comedy',
  'Country', 'Dance', 'Disney', 'Easy Listening', 'Electronic', 'Enka', 'Fitness & Workout', 'French Pop', 'German Folk', 'German Pop', 'Hip-Hop/Rap',
  'Hip-Hop', 'Holiday', 'Indian', 'Instrumental', 'J-Pop', 'Jazz', 'K-Pop', 'Kayokyoku', 'Korean', 'Latin', 'New Age', 'Opera', 'Pop', 'R&B/Soul',
  'Reggae', 'Rock', 'Singer/Songwriter', 'Soundtrack', 'Spoken Word', 'Tex-Mex', 'Vocal', 'World', 'Worldwide', 'Afrikaans', 'Arabic', 'Turkish',
  'Hard Rock', 'Metal', 'Punk', 'Pop Latino', 'Música tropical', 'Música Mexicana', 'Regional Mexicano', 'Urbano latino', 'Salsa y Tropical',
  'Baladas y Boleros', 'Alternativo & Rock Latino', 'Raíces', 'Contemporary Latin', 'Afrobeats', 'Afro-Pop', 'Afro-Beat', 'House', 'Techno',
  'Trance', 'Dubstep', 'Drum & Bass', 'Hardcore', 'Ambient', 'Downtempo', 'Electronica', 'Breakbeat', 'Jungle', 'Garage', 'Indie Pop', 'Indie Rock',
  'Pop/Rock', 'Teen Pop', 'Soft Rock', 'Adult Alternative', 'College Rock', 'Goth Rock', 'Grunge', 'Prog-Rock/Art Rock', 'Rock & Roll', 'Rockabilly',
  'Roots Rock', 'Psychedelic', 'Contemporary R&B', 'Disco', 'Doo Wop', 'Funk', 'Motown', 'Neo-Soul', 'Quiet Storm', 'Soul', 'Gangsta Rap',
  'Hardcore Rap', 'Underground Rap', 'West Coast Rap', 'East Coast Rap', 'Dirty South', 'Alternative Rap', 'Old School Rap', 'UK Hip-Hop',
  'Bluegrass', 'Contemporary Country', 'Honky Tonk', 'Outlaw Country', 'Traditional Country', 'Urban Cowboy', 'Americana', 'Country Blues',
  'Delta Blues', 'Electric Blues', 'Chicago Blues', 'Acoustic Blues', 'Classic Blues', 'Contemporary Blues', 'Big Band', 'Bebop', 'Smooth Jazz',
  'Latin Jazz', 'Vocal Jazz', 'Avant-Garde Jazz', 'Cool Jazz', 'Crossover Jazz', 'Dixieland', 'Fusion', 'Hard Bop', 'Ragtime', 'Trad Jazz',
  'Baroque Era', 'Romantic Era', 'Classical Era', 'Renaissance', 'Medieval Era', 'Minimalism', 'Impressionist', 'Chamber Music', 'Choral',
  'Orchestral', 'Art Song', 'Cantata', 'Modern Era', 'Celtic', 'Celtic Folk', 'Cajun', 'Zydeco', 'Calypso', 'Soca', 'Dancehall', 'Modern Dancehall',
  'Roots Reggae', 'Dub', 'Ska', 'Lovers Rock', 'Klezmer', 'Polka', 'Hawaii', 'Worldbeat', 'Axé', 'Bossa Nova', 'Choro', 'Forró', 'Frevo', 'MPB',
  'Pagode', 'Samba', 'Sertanejo', 'Baile Funk', 'Bollywood', 'Tamil', 'Telugu', 'Regional Indian', 'Devotional & Spiritual', 'Sufi',
  'Indian Classical', 'Carnatic Classical', 'Hindustani Classical', 'Ghazals', 'Indian Pop', 'Punjabi', 'Cantopop/HK-Pop', 'Mandopop',
  'Tai-Pop', 'Khaleeji', 'Levant', 'Maghreb', 'Arabic Pop', 'Dangdut', 'Original Pilipino Music', 'Vocaloid', 'Visual-kei', 'J-Rock',
  'Fitness', 'Lullabies', 'Musicals', 'Show Tunes', 'Film Soundtrack', 'TV Soundtrack', 'Original Score', 'Video Game',
];

export const LIST_GENRES: readonly string[] = [
  // Pop and rock
  'pop', 'dance-pop', 'electropop', 'synth-pop', 'art pop', 'indie pop', 'dream pop', 'bedroom pop', 'hyperpop', 'teen pop', 'bubblegum pop',
  'europop', 'power pop', 'pop rock', 'soft rock', 'yacht rock', 'alternative rock', 'indie rock', 'garage rock', 'britpop', 'post-punk',
  'new wave', 'post-rock', 'shoegaze', 'math rock', 'progressive rock', 'psychedelic rock', 'glam rock', 'arena rock', 'heartland rock',
  'classic rock', 'blues rock', 'southern rock', 'folk rock', 'gothic rock', 'industrial rock', 'noise rock', 'krautrock', 'emo', 'midwest emo',
  'pop punk', 'punk rock', 'hardcore punk', 'post-hardcore', 'ska punk', 'grunge', 'post-grunge', 'hard rock', 'heavy metal', 'nu metal',
  'alternative metal', 'rap metal', 'metalcore', 'progressive metalcore', 'deathcore', 'death metal', 'black metal', 'thrash metal',
  'doom metal', 'sludge metal', 'gothic metal', 'symphonic metal', 'power metal', 'industrial metal', 'djent', 'grindcore', 'rap rock',
  'funk rock', 'rock and roll', 'rockabilly', 'surf rock', 'doo-wop', 'power ballad', 'piano rock',
  // Hip-hop, R&B, soul, funk, disco
  'hip hop', 'pop rap', 'boom bap', 'trap', 'drill', 'UK drill', 'grime', 'cloud rap', 'emo rap', 'gangsta rap', 'conscious hip hop',
  'southern hip hop', 'crunk', 'phonk', 'drift phonk', 'jazz rap', 'chopped and screwed', 'G-funk', 'R&B', 'contemporary R&B',
  'alternative R&B', 'neo soul', 'new jack swing', 'quiet storm', 'soul', 'Southern soul', 'Northern soul', 'funk', 'go-go', 'disco', 'nu-disco',
  'post-disco', 'boogie', 'Euro disco', 'Italo disco', 'Hi-NRG',
  // Electronic
  'electronic', 'EDM', 'house', 'deep house', 'tech house', 'progressive house', 'electro house', 'big room house', 'tropical house',
  'afro house', 'UK garage', '2-step', 'techno', 'trance', 'psytrance', 'hardstyle', 'happy hardcore', 'gabber', 'Eurodance', 'eurobeat',
  'dubstep', 'riddim', 'drum and bass', 'liquid funk', 'jungle', 'breakcore', 'breakbeat', 'big beat', 'future bass', 'trap EDM', 'IDM',
  'glitch', 'electro', 'electroclash', 'synthwave', 'vaporwave', 'chillwave', 'downtempo', 'trip hop', 'lo-fi', 'lo-fi hip hop', 'chillout',
  'ambient', 'dark ambient', 'drone', 'new-age', 'industrial', 'EBM', 'darkwave', 'chiptune', 'jersey club', 'footwork', 'electro swing',
  // Latin and Brazil
  'Latin pop', 'reggaeton', 'Latin trap', 'dembow', 'salsa', 'salsa romántica', 'timba', 'son cubano', 'mambo', 'bachata', 'merengue',
  'cumbia', 'cumbia sonidera', 'vallenato', 'champeta', 'cha-cha-chá', 'rumba', 'danzón', 'bolero', 'Latin ballad', 'tango', 'nuevo tango',
  'flamenco', 'flamenco pop', 'rumba flamenca', 'paso doble', 'sevillanas', 'regional Mexican', 'banda', 'norteño', 'mariachi', 'ranchera',
  'corrido', 'corridos tumbados', 'Tejano', 'huapango', 'Latin rock', 'rock en español', 'samba', 'bossa nova', 'axé', 'forró', 'sertanejo',
  'MPB', 'baile funk', 'funk carioca', 'pagode', 'moombahton', 'Latin jazz', 'tropical',
  // Caribbean and Africa
  'reggae', 'roots reggae', 'dub', 'dancehall', 'reggae fusion', 'ska', 'rocksteady', 'lovers rock', 'soca', 'calypso', 'zouk', 'kompa',
  'afrobeats', 'Afrobeat', 'afropop', 'afroswing', 'highlife', 'amapiano', 'gqom', 'kwaito', 'kuduro', 'kizomba', 'coupé-décalé', 'soukous',
  'bongo flava',
  // Country, folk, traditions
  'country', 'country pop', 'bro-country', 'outlaw country', 'Americana', 'bluegrass', 'alt-country', 'country rap', 'Western swing', 'folk',
  'indie folk', 'contemporary folk', 'singer-songwriter', 'acoustic', 'Celtic', 'polka', 'klezmer', 'Balkan', 'schlager', 'chanson', 'fado',
  'Bollywood', 'filmi', 'bhangra', 'Punjabi', 'qawwali', 'garba', 'Arabic pop', 'mahraganat', 'raï', 'dabke', 'Turkish pop', 'dangdut',
  'K-pop', 'J-pop', 'C-pop', 'Mandopop', 'Cantopop', 'T-pop', 'city pop', 'J-rock', 'anime', 'enka',
  // Jazz, blues, swing
  'jazz', 'swing', 'big band', 'bebop', 'vocal jazz', 'smooth jazz', 'acid jazz', 'jazz fusion', 'free jazz', 'jump blues', 'boogie-woogie',
  'blues', 'Texas blues', 'delta blues', 'soul blues', 'electric blues',
  // Not dance music, and contexts
  'classical', 'baroque', 'opera', 'contemporary classical', 'neoclassical', 'film score', 'video game music', 'choral', 'hymn',
  'Gregorian chant', 'gospel', 'contemporary Christian', 'worship', 'spoken word', 'comedy', 'poetry', 'soundtrack', 'musical theatre',
  'show tunes', 'easy listening', 'adult contemporary', 'traditional pop', 'lounge', 'exotica', 'ballad', 'lullaby', 'children\'s music',
  'Christmas', 'novelty', 'experimental', 'avant-garde', 'world music',
];

/** Names that are not genres and stay unplaced on purpose (ignored, never guessed). */
export const UNPLACED_GENRES: readonly string[] = ['Karaoke', '80s', 'todd in the shadows', 'favourites', 'seen live', 'female vocalists'];
