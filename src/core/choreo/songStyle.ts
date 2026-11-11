/**
 * A song's dance style: which move families it leans toward, which body
 * parts to favour, and theme hints from its title. Pure TypeScript (no DOM),
 * deterministic.
 *
 * Resolution, each layer only filling what earlier layers left open (themes
 * are unioned across all layers):
 *   (a) curated: `song.style`, else the starter-pack entry's `style`; then
 *       the artist table (any credited artist matches)
 *   (b) genre metadata (iTunes `primaryGenreName`)
 *   (c) title/artist keywords -> themes
 *   (d) weak tempo/energy priors, blended in at <= 15 %
 *   (e) BALANCED_POP
 */
import starterData from '../../data/starter.json';
import { FAMILIES, FAMILY_LABEL, FOCI, isFamily, isTheme, THEMES, type Family, type Focus, type Theme } from './families';

export interface SongStyle {
  /** Weights, normalised to sum 1. */
  families: Partial<Record<Family, number>>;
  /** Multipliers around 1 (e.g. hips: 1.6). */
  focus?: Partial<Record<Focus, number>>;
  themes: Theme[];
  /** Move ids, passed through from curated data. */
  signature?: string[];
  /** Where the families came from, for debugging / tests. */
  source: 'override' | 'artist' | 'genre' | 'fallback';
}

export interface StyleOverride {
  families?: Partial<Record<Family, number>>;
  focus?: Partial<Record<Focus, number>>;
  themes?: string[];
  signature?: string[];
}

export interface SongInfo {
  videoId?: string;
  title?: string;
  artist?: string;
  genre?: string;
  style?: StyleOverride;
}

export interface StylePriors {
  bpm?: number;
  /** Mean section energy 0..1. */
  energy?: number;
}

type Weights = Partial<Record<Family, number>>;
type FocusMap = Partial<Record<Focus, number>>;

/** Fallback mix: pop strongest, then a bit of everything so unknown songs still get variety. */
export const BALANCED_POP: SongStyle = Object.freeze({
  families: Object.freeze({ pop: 0.28, hiphop: 0.15, disco: 0.13, aerobic: 0.11, funk: 0.1, latin: 0.09, party: 0.06, rock: 0.04, kpop: 0.04 }),
  themes: [],
  source: 'fallback',
}) as SongStyle;

// ---------------------------------------------------------------------------
// Helpers

/** Keep valid families with positive finite weights, scaled to sum 1; null when nothing is left. */
function normWeights(w: unknown): Weights | null {
  if (!w || typeof w !== 'object') return null;
  let sum = 0;
  const raw = w as Record<string, unknown>;
  for (const f of FAMILIES) {
    const v = raw[f];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) sum += v;
  }
  if (!(sum > 0)) return null;
  const out: Weights = {};
  for (const f of FAMILIES) {
    const v = raw[f];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[f] = v / sum;
  }
  return out;
}

/** Valid focus keys with positive finite multipliers (clamped to 0.25..3); null when empty. */
function normFocus(f: unknown): FocusMap | null {
  if (!f || typeof f !== 'object') return null;
  const out: FocusMap = {};
  let any = false;
  for (const k of FOCI) {
    const v = (f as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = Math.max(0.25, Math.min(3, v));
      any = true;
    }
  }
  return any ? out : null;
}

function themesOf(list: unknown): Theme[] {
  return Array.isArray(list) ? list.filter(isTheme) : [];
}

/** Lowercase, accents stripped. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// (a) Starter pack curated styles

const STARTER_STYLES: ReadonlyMap<string, StyleOverride> = (() => {
  const m = new Map<string, StyleOverride>();
  for (const raw of starterData as unknown[]) {
    const e = raw as { videoId?: unknown; style?: unknown } | null;
    if (e && typeof e.videoId === 'string' && e.style && typeof e.style === 'object') m.set(e.videoId, e.style as StyleOverride);
  }
  return m;
})();

// ---------------------------------------------------------------------------
// (a) Artist table

interface ArtistStyle {
  families: Weights;
  focus?: FocusMap;
  themes?: Theme[];
  signature?: string[];
}

/** Artist name -> canonical key: accents, punctuation, spaces, "and"/"&" and a leading "the" removed. */
export function artistKey(name: string): string {
  const tokens = fold(name)
    .replace(/\$/g, 's')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (tokens[0] === 'the' && tokens.length > 1) tokens.shift();
  return tokens.filter((t) => t !== 'and').join('');
}

const STRONG_SEP = /\s+(?:feat\.?|ft\.?|featuring|with|x|×|vs\.?|versus)\s+|\s*[()[\]]\s*/;
const WEAK_SEP = /\s*(?:,|&|\+|\/|;|\s(?:and)\s)\s*/;

/** Lookup keys for an artist credit: the whole credit, then each collaborator. */
export function artistCandidates(credit: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const k = artistKey(s);
    if (k && !out.includes(k)) out.push(k);
  };
  const folded = fold(credit);
  add(folded);
  for (const seg of folded.split(STRONG_SEP)) {
    if (!seg.trim()) continue;
    add(seg);
    for (const piece of seg.split(WEAK_SEP)) if (piece.trim()) add(piece);
  }
  return out;
}

const ARTISTS: ReadonlyMap<string, ArtistStyle> = (() => {
  const m = new Map<string, ArtistStyle>();
  const a = (names: string[], families: Weights, extra: Omit<ArtistStyle, 'families'> = {}) => {
    for (const n of names) m.set(artistKey(n), { families, ...extra });
  };
  const HIPS = (x = 1.4): FocusMap => ({ hips: x });

  // --- Latin
  a(['Shakira'], { latin: 1, pop: 0.3 }, { focus: HIPS(1.6), themes: ['hips'] });
  a(['J Balvin'], { latin: 1, hiphop: 0.4 }, { focus: HIPS() });
  a(['Bad Bunny'], { latin: 1, hiphop: 0.5 }, { focus: HIPS() });
  a(['Daddy Yankee'], { latin: 1, hiphop: 0.4 }, { focus: HIPS() });
  a(['Pitbull'], { latin: 0.8, pop: 0.6, party: 0.3, aerobic: 0.3 }, { focus: HIPS(1.3) });
  a(['Enrique Iglesias'], { latin: 0.8, pop: 0.6 }, { focus: HIPS(1.3) });
  a(['Ricky Martin'], { latin: 1, pop: 0.5 }, { focus: HIPS(1.5), themes: ['hips', 'shake'] });
  a(['Luis Fonsi'], { latin: 1, pop: 0.4 }, { focus: HIPS() });
  a(['Jennifer Lopez', 'J.Lo'], { latin: 0.7, pop: 0.7, funk: 0.2 }, { focus: HIPS() });
  a(['Marc Anthony'], { latin: 1, pop: 0.2 }, { focus: HIPS() });
  a(['Karol G'], { latin: 1, hiphop: 0.3 }, { focus: HIPS() });
  a(['Ozuna', 'Maluma', 'Nicky Jam', 'Farruko', 'Don Omar', 'Wisin & Yandel', 'Wisin y Yandel', 'Anuel AA', 'Rauw Alejandro', 'Feid', 'Sech', 'Myke Towers'], { latin: 1, hiphop: 0.4 }, { focus: HIPS() });
  a(['Rosalía'], { latin: 0.9, pop: 0.4, hiphop: 0.3 }, { focus: HIPS(1.3) });
  a(['Becky G', 'Anitta', 'Natti Natasha', 'Tini'], { latin: 0.9, pop: 0.5, hiphop: 0.2 }, { focus: HIPS() });
  a(['Camila Cabello', 'Fifth Harmony'], { latin: 0.6, pop: 0.8 }, { focus: HIPS(1.3) });
  a(['Gloria Estefan', 'Miami Sound Machine'], { latin: 1, disco: 0.3, pop: 0.3 }, { focus: HIPS() });
  a(['Selena', 'Celia Cruz', 'Carlos Vives', 'Juan Luis Guerra', 'Thalía', 'Paulina Rubio', 'Gente de Zona', 'Elvis Crespo'], { latin: 1, pop: 0.3 }, { focus: HIPS() });
  a(['Romeo Santos', 'Prince Royce', 'Aventura'], { latin: 1, pop: 0.2 }, { focus: HIPS(1.5), themes: ['hips'] });
  a(['Peso Pluma', 'Grupo Frontera', 'Carin León'], { latin: 0.9, pop: 0.2, hiphop: 0.2 });
  a(['Los del Río'], { latin: 1, party: 0.5, pop: 0.4 }, { focus: HIPS(), themes: ['hips', 'hands'] });
  a(['Las Ketchup'], { latin: 0.9, party: 0.5, pop: 0.5 }, { focus: HIPS(), themes: ['hands'] });
  a(['Lou Bega'], { latin: 0.7, pop: 0.5, funk: 0.4, party: 0.3 }, { focus: HIPS(1.3) });
  a(['Santana'], { latin: 0.8, rock: 0.6 }, { focus: HIPS(1.2) });
  a(['Gipsy Kings'], { latin: 1, pop: 0.2 }, { themes: ['clap'] });

  // --- Disco
  a(['Bee Gees'], { disco: 1, funk: 0.3 }, { themes: ['point', 'walk'] });
  a(['Earth, Wind & Fire'], { disco: 0.8, funk: 0.9 }, { themes: ['clap', 'spin'] });
  a(['ABBA'], { disco: 1, pop: 0.6 }, { themes: ['spin'] });
  a(['Donna Summer', 'Gloria Gaynor', 'Sister Sledge', 'The Trammps', 'Lipps Inc.', 'Thelma Houston', 'Sylvester', 'Anita Ward', 'Amii Stewart'], { disco: 1, funk: 0.3 });
  a(['Chic', 'Nile Rodgers'], { disco: 1, funk: 0.6 });
  a(['Village People'], { disco: 1, party: 0.6, aerobic: 0.4 }, { themes: ['point', 'clap'] });
  a(['KC and the Sunshine Band'], { disco: 1, funk: 0.6 }, { themes: ['shake'] });
  a(['Kool & the Gang'], { funk: 0.9, disco: 0.8, party: 0.3 }, { themes: ['clap'] });
  a(['Boney M.', 'Baccara', 'Dschinghis Khan'], { disco: 1, pop: 0.4 });
  a(['Diana Ross', 'The Supremes'], { disco: 0.8, pop: 0.5, funk: 0.3 });
  a(['Cher'], { disco: 0.6, pop: 0.8 });
  a(['Kylie Minogue', 'Jessie Ware', 'Sophie Ellis-Bextor', 'Roisin Murphy'], { disco: 0.9, pop: 0.6 });
  a(['Daft Punk'], { disco: 0.8, aerobic: 0.5, funk: 0.4 });
  a(['Dua Lipa'], { disco: 1, pop: 0.7 });
  a(['Bananarama', 'Pet Shop Boys', 'Erasure', 'Dead or Alive'], { pop: 0.7, disco: 0.6, aerobic: 0.3 });
  a(['Jamiroquai', 'Chromeo', 'Breakbot'], { funk: 0.9, disco: 0.7 });

  // --- Funk / soul / R&B
  a(['Michael Jackson'], { funk: 1, pop: 0.7, disco: 0.3 }, { themes: ['kick', 'spin', 'point'], focus: { legs: 1.2, turn: 1.3 } });
  a(['Janet Jackson'], { pop: 0.7, funk: 0.6, hiphop: 0.5 }, { themes: ['point'] });
  a(['The Jackson 5', 'The Jacksons'], { funk: 0.8, disco: 0.5, pop: 0.5 });
  a(['Bruno Mars', 'Silk Sonic'], { funk: 1, pop: 0.6, disco: 0.3 }, { themes: ['walk', 'point'] });
  a(['Mark Ronson'], { funk: 1, pop: 0.4, disco: 0.2 });
  a(['Prince'], { funk: 1, rock: 0.4, pop: 0.4 }, { themes: ['spin'] });
  a(['James Brown'], { funk: 1 }, { themes: ['walk', 'spin'], focus: { legs: 1.3 } });
  a(['Stevie Wonder', 'Marvin Gaye', 'The Temptations', 'Aretha Franklin'], { funk: 0.9, pop: 0.5, disco: 0.2 });
  a(['Rick James', 'Parliament', 'Funkadelic', 'Zapp', 'Sly & the Family Stone', 'Tower of Power', 'The Commodores', 'Wild Cherry'], { funk: 1, disco: 0.3 });
  a(['Anderson .Paak', 'Vulfpeck'], { funk: 0.9, hiphop: 0.4 });
  a(['Pharrell Williams', 'N.E.R.D'], { funk: 0.7, pop: 0.6, hiphop: 0.3 });
  a(['Lizzo'], { funk: 0.8, pop: 0.6, disco: 0.3 }, { focus: HIPS(1.2) });
  a(['Outkast'], { funk: 0.7, hiphop: 0.6, pop: 0.4 });
  a(['Justin Timberlake'], { pop: 0.8, funk: 0.5, hiphop: 0.3 });
  a(['Beyoncé', "Destiny's Child"], { hiphop: 0.6, pop: 0.6, funk: 0.5 }, { focus: HIPS(1.3) });
  a(['Usher', 'Chris Brown', 'Ne-Yo', 'Jason Derulo'], { hiphop: 0.6, pop: 0.6, funk: 0.3 });
  a(['Whitney Houston'], { pop: 0.8, disco: 0.5, funk: 0.2 });
  a(['DNCE', 'Meghan Trainor'], { pop: 0.7, funk: 0.6, disco: 0.2 }, { focus: HIPS(1.2) });
  a(['Portugal. The Man'], { funk: 0.6, rock: 0.6, pop: 0.5 });

  // --- Pop
  a(['Madonna'], { pop: 0.8, disco: 0.6, aerobic: 0.3 }, { themes: ['point'] });
  a(['Lady Gaga'], { pop: 0.9, disco: 0.4, aerobic: 0.3 });
  a(['Kesha', 'Ke$ha', 'Icona Pop', 'Charli XCX'], { pop: 0.7, aerobic: 0.5, party: 0.3 });
  a(['Cyndi Lauper', 'Belinda Carlisle', 'Tiffany', 'Debbie Gibson'], { pop: 0.9, aerobic: 0.4 });
  a(['Wham!', 'George Michael'], { pop: 0.8, disco: 0.3, funk: 0.3 });
  a(['Rick Astley', 'Kim Wilde'], { pop: 0.9, disco: 0.4 });
  a(['a-ha'], { pop: 0.9, aerobic: 0.4, rock: 0.2 });
  a(['Duran Duran', 'Tears for Fears', 'Culture Club', 'Simple Minds'], { pop: 0.8, rock: 0.4, disco: 0.3 });
  a(['Spice Girls', 'Britney Spears', 'Backstreet Boys', '*NSYNC', 'NSYNC', 'Christina Aguilera', 'Little Mix', 'Westlife', 'S Club 7', 'Steps'], { pop: 0.9, hiphop: 0.3, aerobic: 0.3 });
  a(['One Direction', 'Jonas Brothers', 'Shawn Mendes', 'Niall Horan', 'Lewis Capaldi'], { pop: 1, rock: 0.2 });
  a(['Taylor Swift', 'Carly Rae Jepsen', 'Selena Gomez', 'Demi Lovato', 'Hailee Steinfeld', 'Tate McRae', 'Chappell Roan', 'Gracie Abrams'], { pop: 1, aerobic: 0.2, disco: 0.2 });
  a(['Katy Perry', 'Ava Max', 'Sia', 'Bebe Rexha', 'Zara Larsson', 'Anne-Marie', 'Rita Ora', 'Ellie Goulding'], { pop: 0.9, aerobic: 0.4 });
  a(['Ariana Grande'], { pop: 0.8, hiphop: 0.4, disco: 0.2 });
  a(['Justin Bieber', 'The Kid LAROI'], { pop: 0.9, hiphop: 0.3, latin: 0.2 });
  a(['Harry Styles', 'Sabrina Carpenter'], { pop: 0.9, funk: 0.3, disco: 0.3 });
  a(['Miley Cyrus'], { pop: 0.9, rock: 0.3, disco: 0.2 });
  a(['Olivia Rodrigo', 'Avril Lavigne'], { pop: 0.7, rock: 0.6 });
  a(['Billie Eilish', 'Lorde', 'Halsey'], { pop: 0.8, hiphop: 0.4 });
  a(['Ed Sheeran'], { pop: 0.9, latin: 0.2, hiphop: 0.2 });
  a(['Maroon 5'], { pop: 0.8, funk: 0.4, rock: 0.2 });
  a(['Rihanna'], { pop: 0.7, hiphop: 0.5, latin: 0.3 }, { focus: HIPS(1.2) });
  a(['The Weeknd'], { pop: 0.8, disco: 0.4, aerobic: 0.3 });
  a(['Taio Cruz', 'Flo Rida', 'Black Eyed Peas', 'The Black Eyed Peas', 'Fergie'], { pop: 0.7, hiphop: 0.4, aerobic: 0.4, party: 0.4 });
  a(['P!nk', 'Pink', 'Kelly Clarkson'], { pop: 0.7, rock: 0.5 });
  a(['OneRepublic', 'WALK THE MOON', 'Fun.', 'American Authors', 'The Script', 'Train', 'Bastille'], { pop: 0.8, rock: 0.5 });
  a(['Pinkfong'], { pop: 0.7, party: 0.5, aerobic: 0.5 }, { themes: ['clap'] });

  // --- Hip-hop
  a(['Drake', 'Kendrick Lamar', 'Travis Scott', 'Jay-Z', 'Kanye West', 'Ye', 'J. Cole', 'Future', '21 Savage', 'Lil Wayne', 'Ludacris', '50 Cent', 'Nelly', 'Tyga', 'DaBaby', 'Jack Harlow', 'Lil Baby'], { hiphop: 1, pop: 0.2 });
  a(['Cardi B', 'Megan Thee Stallion', 'City Girls', 'GloRilla', 'Latto', 'Ice Spice'], { hiphop: 1, latin: 0.1 }, { focus: HIPS() });
  a(['Nicki Minaj', 'Doja Cat'], { hiphop: 0.8, pop: 0.5, disco: 0.2 }, { focus: HIPS(1.2) });
  a(['Missy Elliott', 'Busta Rhymes', 'Timbaland'], { hiphop: 1, funk: 0.3 });
  a(['Eminem'], { hiphop: 1, rock: 0.2 });
  a(['LMFAO', 'Lil Jon', 'Pitbull & Lil Jon'], { aerobic: 0.6, party: 0.6, hiphop: 0.5, pop: 0.4 }, { themes: ['shake', 'jump'] });
  a(['Macklemore & Ryan Lewis', 'Macklemore'], { hiphop: 0.9, pop: 0.4, aerobic: 0.2 });
  a(['Snoop Dogg', 'Dr. Dre', 'Warren G', 'Coolio'], { hiphop: 1, funk: 0.3 });
  a(['MC Hammer', 'Vanilla Ice', 'Will Smith', 'DJ Jazzy Jeff & the Fresh Prince', 'Bell Biv DeVoe'], { hiphop: 0.8, funk: 0.5, pop: 0.3 }, { themes: ['walk', 'kick'] });
  a(['Silentó', 'Soulja Boy', 'Cupid', 'DJ Casper', 'Mr. C the Slide Man', 'Tag Team', 'Los Del Mar', 'Baha Men'], { hiphop: 0.7, party: 0.7, aerobic: 0.4, pop: 0.3 }, { themes: ['walk', 'clap'] });
  a(['House of Pain', 'Kris Kross'], { hiphop: 0.9, party: 0.3, rock: 0.2 }, { themes: ['jump'] });
  a(['Run-DMC', 'Beastie Boys'], { hiphop: 0.8, rock: 0.5 });
  a(['Lil Nas X', 'Post Malone'], { hiphop: 0.6, pop: 0.6, rock: 0.2 });
  // Style themes open the matching specialty moves (dancehall / afrobeats steps).
  a(['Sean Paul', 'Shaggy', 'Major Lazer'], { latin: 0.6, hiphop: 0.6, pop: 0.3 }, { focus: HIPS(), themes: ['dancehall'] });
  a(['Wizkid', 'Burna Boy', 'Tems', 'Rema', 'Davido', 'Tyla', 'Ayra Starr', 'Fireboy DML', 'CKay', 'Asake'], { latin: 0.5, hiphop: 0.6, pop: 0.4 }, { focus: HIPS(), themes: ['afro'] });
  a(['DJ Snake', 'Dillon Francis'], { aerobic: 0.5, hiphop: 0.4, latin: 0.4 });

  // --- Rock
  a(['Linkin Park'], { rock: 1, hiphop: 0.3 }, { themes: ['stomp'] });
  a(['Red Hot Chili Peppers'], { rock: 0.8, funk: 0.7 });
  a(['twenty one pilots'], { pop: 0.6, hiphop: 0.5, rock: 0.5 });
  a(['Imagine Dragons'], { rock: 0.7, pop: 0.6 }, { themes: ['stomp'] });
  a(['Queen'], { rock: 0.9, pop: 0.3 }, { themes: ['stomp', 'clap'] });
  a(['AC/DC', 'Foo Fighters', 'Green Day', 'Blink-182', 'Nirvana', 'Metallica', "Guns N' Roses", 'Def Leppard', 'Muse', 'Kings of Leon', 'Arctic Monkeys', 'The Strokes', 'Måneskin', 'System of a Down', 'Pearl Jam', 'Soundgarden', 'Evanescence', 'Papa Roach', 'Three Days Grace', 'Breaking Benjamin', 'Shinedown', 'Disturbed', 'Bring Me the Horizon', 'Sum 41', 'The Offspring', 'Ramones', 'Iron Maiden', 'Black Sabbath', 'Led Zeppelin', 'Deep Purple', 'Aerosmith', 'Ozzy Osbourne'], { rock: 1, pop: 0.1 }, { themes: ['stomp'] });
  a(['Joan Jett', 'Joan Jett & the Blackhearts', 'The White Stripes', 'Kiss', 'Twisted Sister', 'Quiet Riot', 'Mötley Crüe'], { rock: 1 }, { themes: ['stomp', 'clap'] });
  a(['Bon Jovi', 'Journey', 'Survivor', 'Europe', 'Heart', 'Boston', 'Foreigner', 'REO Speedwagon', 'Toto'], { rock: 0.9, pop: 0.4 }, { themes: ['punch'] });
  a(['Van Halen'], { rock: 0.9, aerobic: 0.3 }, { themes: ['jump'] });
  a(['Fall Out Boy', 'Panic! At The Disco', 'Paramore', 'My Chemical Romance', 'All Time Low', 'Yungblud', 'Machine Gun Kelly'], { rock: 0.7, pop: 0.6 });
  a(['The Killers', 'Franz Ferdinand', 'Kaiser Chiefs', 'Two Door Cinema Club', 'The Wombats', 'Glass Animals', 'Foster the People', 'MGMT', 'Cage the Elephant'], { rock: 0.6, pop: 0.5, disco: 0.3 });
  a(['The Black Keys', 'Jet', 'Wolfmother', 'The Hives', 'Greta Van Fleet'], { rock: 1, funk: 0.2 }, { themes: ['stomp'] });
  a(['The Rolling Stones'], { rock: 0.9, funk: 0.2 }, { themes: ['walk'] });
  a(['The Beatles'], { rock: 0.6, pop: 0.7 }, { themes: ['twist'] });
  a(['Chubby Checker', 'The Isley Brothers'], { rock: 0.5, pop: 0.6, party: 0.4, funk: 0.3 }, { themes: ['twist'] });
  a(['Elvis Presley'], { rock: 0.8, pop: 0.4 }, { themes: ['hips', 'swing'], focus: HIPS() });
  a(['Chuck Berry', 'Little Richard', 'Jerry Lee Lewis', 'Bill Haley & His Comets'], { rock: 1, pop: 0.3 }, { themes: ['twist', 'walk', 'swing'] });
  // --- Country (country steps are specialty moves: the theme opens them)
  a(['Shania Twain', 'Dolly Parton', 'Billy Ray Cyrus', 'Garth Brooks', 'Brooks & Dunn', 'Luke Combs', 'Morgan Wallen', 'Carrie Underwood', 'Blake Shelton', 'Kenny Chesney', 'Luke Bryan', 'Florida Georgia Line', 'Johnny Cash', 'Zach Bryan', 'Jason Aldean'], { pop: 0.6, rock: 0.5, aerobic: 0.2 }, { themes: ['country'] });
  // --- Bollywood / bhangra
  a(['A. R. Rahman', 'Pritam', 'Vishal-Shekhar', 'Shankar-Ehsaan-Loy', 'Badshah', 'Neha Kakkar'], { pop: 0.7, latin: 0.3, disco: 0.2 }, { themes: ['bollywood'] });
  a(['Diljit Dosanjh', 'Daler Mehndi', 'Panjabi MC', 'AP Dhillon', 'Sidhu Moose Wala'], { pop: 0.6, hiphop: 0.4, aerobic: 0.3 }, { themes: ['bhangra', 'bollywood'] });
  a(['Rage Against the Machine', 'Limp Bizkit', 'Linkin Park & Jay-Z'], { rock: 0.8, hiphop: 0.5 }, { themes: ['punch', 'jump'] });
  a(['Gorillaz'], { hiphop: 0.5, pop: 0.5, funk: 0.4 });

  // --- Dance / electronic
  a(['Avicii', 'David Guetta', 'Calvin Harris', 'Martin Garrix', 'Marshmello', 'Zedd', 'Alesso', 'Kygo', 'Clean Bandit', 'Fred again..', 'Fisher', 'Purple Disco Machine'], { aerobic: 0.6, pop: 0.6, disco: 0.2 });
  a(['Swedish House Mafia', 'Tiësto', 'Armin van Buuren', 'Hardwell', 'Afrojack', 'Steve Aoki', 'Skrillex', 'Deadmau5', 'Scooter', '2 Unlimited', 'Darude'], { aerobic: 0.9, pop: 0.3 }, { themes: ['jump'] });
  a(['The Chainsmokers', 'Galantis', 'Lost Frequencies', 'Robin Schulz'], { pop: 0.8, aerobic: 0.4 });
  a(['Eiffel 65', 'Vengaboys', 'Aqua', 'Haddaway', 'Snap!', 'La Bouche', 'Real McCoy', 'Corona', 'Culture Beat', 'Dr. Alban', 'Alice Deejay', 'Cascada', 'Basshunter'], { aerobic: 0.7, pop: 0.6, party: 0.3, disco: 0.2 });
  a(['Black Lace', 'Whigfield', 'DJ Ötzi', "The B-52's", 'Los Lobos', 'Ylvis', 'Crazy Frog', 'Rednex'], { party: 1, pop: 0.6, aerobic: 0.3 }, { themes: ['clap'] });
  a(['C+C Music Factory', 'Technotronic'], { aerobic: 0.7, hiphop: 0.4, disco: 0.3 });

  // --- K-pop
  a(['BTS', 'Jungkook', 'Jimin', 'SEVENTEEN', 'EXO', 'SHINee', 'Super Junior', 'BIGBANG', 'ENHYPEN', 'TOMORROW X TOGETHER', 'TXT', 'NCT 127', 'NCT Dream', 'ZEROBASEONE', 'RIIZE'], { kpop: 1, pop: 0.4, hiphop: 0.2 });
  a(['Stray Kids', 'ATEEZ', 'G-Dragon', 'BOYNEXTDOOR'], { kpop: 1, hiphop: 0.5 }, { themes: ['stomp'] });
  a(['BLACKPINK', 'LISA', 'JENNIE', 'JISOO', '(G)I-DLE', 'ITZY', 'BABYMONSTER', '2NE1'], { kpop: 1, pop: 0.4, hiphop: 0.3 });
  a(['TWICE', 'NewJeans', 'aespa', 'Red Velvet', 'IVE', 'LE SSERAFIM', "Girls' Generation", 'ILLIT', 'KISS OF LIFE', 'Wonder Girls', 'NMIXX', 'KATSEYE', 'HUNTR/X'], { kpop: 1, pop: 0.5 });
  a(['ROSÉ'], { kpop: 0.6, pop: 0.8, rock: 0.2 });
  a(['PSY'], { kpop: 1, party: 0.5, aerobic: 0.4, pop: 0.3 }, { themes: ['jump', 'kick'] });
  return m;
})();

/** Number of distinct names the artist table knows. */
export const ARTIST_TABLE_SIZE = ARTISTS.size;

function matchArtist(credit: string | undefined): ArtistStyle | null {
  if (!credit) return null;
  for (const k of artistCandidates(credit)) {
    const hit = ARTISTS.get(k);
    if (hit) return hit;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (b) Genre metadata (iTunes primaryGenreName)

interface GenreStyle {
  families: Weights;
  focus?: FocusMap;
}

const LATIN_HIPS: FocusMap = { hips: 1.3 };

const GENRES: ReadonlyMap<string, GenreStyle> = (() => {
  const m = new Map<string, GenreStyle>();
  const g = (names: string[], families: Weights, focus?: FocusMap) => {
    for (const n of names) m.set(genreKey(n), focus ? { families, focus } : { families });
  };
  g(['Pop', 'Teen Pop', 'Adult Contemporary', 'Vocal', 'Singer/Songwriter'], { pop: 1, hiphop: 0.15, disco: 0.1 });
  g(['Dance', 'Dance Pop', 'Eurodance'], { pop: 0.5, aerobic: 0.5, disco: 0.3 });
  g(['Electronic', 'Electronica', 'EDM', 'Electro', 'Trance', 'Techno', 'Hardstyle', 'Dubstep', 'Drum & Bass', 'Breakbeat'], { aerobic: 0.7, pop: 0.4, disco: 0.15 });
  g(['House', 'Deep House', 'Nu Disco'], { disco: 0.5, aerobic: 0.5, pop: 0.3 });
  g(['Hip-Hop/Rap', 'Hip-Hop', 'Hip Hop', 'Rap', 'Trap', 'Gangsta Rap', 'Dirty South', 'Old School Rap', 'UK Hip-Hop', 'Drill'], { hiphop: 1, pop: 0.2, funk: 0.1 });
  g(['R&B/Soul', 'R&B', 'Soul', 'Contemporary R&B', 'Neo-Soul', 'Motown', 'Urban'], { funk: 0.6, hiphop: 0.4, pop: 0.4, disco: 0.15 });
  g(['Funk'], { funk: 1, disco: 0.3 });
  g(['Disco'], { disco: 1, funk: 0.3 });
  g(['Rock', 'Rock & Roll', 'Classic Rock', 'Arena Rock', 'Glam Rock', 'Southern Rock', "Rock 'n' Roll"], { rock: 1, pop: 0.2 });
  g(['Alternative', 'Indie Rock', 'Indie Pop', 'Alternative Rock', 'New Wave', 'College Rock', 'Britpop'], { rock: 0.7, pop: 0.5 });
  g(['Hard Rock', 'Grunge', 'Hair Metal'], { rock: 1 });
  g(['Metal', 'Heavy Metal', 'Nu Metal', 'Death Metal', 'Metalcore'], { rock: 1, aerobic: 0.2 });
  g(['Punk', 'Pop Punk', 'Emo'], { rock: 1, aerobic: 0.3, pop: 0.2 });
  g(['Latin', 'Latino', 'Latin Pop', 'Pop Latino', 'Pop in Spanish', 'Latin Rock', 'Rock y Alternativo'], { latin: 0.9, pop: 0.5 }, LATIN_HIPS);
  g(['Reggaeton', 'Urbano latino', 'Latin Urban', 'Latin Rap', 'Latin Hip-Hop', 'Música Urbana', 'Dembow', 'Latin Trap'], { latin: 1, hiphop: 0.4 }, LATIN_HIPS);
  g(['Salsa y Tropical', 'Salsa', 'Tropical', 'Tropical Music', 'Bachata', 'Merengue', 'Cumbia', 'Brazilian', 'Samba', 'Axé', 'Sertanejo', 'Baile Funk', 'Flamenco', 'Tango'], { latin: 1, pop: 0.2 }, { hips: 1.4 });
  g(['Regional Mexicano', 'Música Mexicana', 'Mariachi', 'Norteño', 'Banda'], { latin: 0.9, pop: 0.2 });
  g(['K-Pop', 'KPop', 'Korean Pop', 'Korean'], { kpop: 1, pop: 0.4, hiphop: 0.2 });
  g(['J-Pop', 'J-Rock', 'Anime', 'C-Pop', 'Mandopop', 'Cantopop'], { pop: 0.8, kpop: 0.5, rock: 0.1 });
  g(['Country', 'Contemporary Country', 'Country Pop', 'Americana', 'Bluegrass', 'Honky Tonk'], { pop: 0.6, rock: 0.4, aerobic: 0.2 });
  g(['Soundtrack', 'Original Score', 'Musicals', 'Film Soundtrack', 'TV Soundtrack', 'Disney'], { pop: 0.7, disco: 0.2, aerobic: 0.2 });
  g(['Fitness & Workout', 'Fitness'], { aerobic: 0.8, pop: 0.5 });
  g(["Children's Music", 'Kids', 'Novelty', 'Comedy'], { party: 0.7, pop: 0.6, aerobic: 0.4 });
  g(['Reggae', 'Dancehall', 'Ska', 'Soca', 'Calypso'], { latin: 0.5, hiphop: 0.4, pop: 0.3 }, LATIN_HIPS);
  g(['Afrobeats', 'Afro-Beat', 'Afrobeat', 'Afro House', 'Afro-Pop', 'African', 'Amapiano'], { latin: 0.5, hiphop: 0.5, pop: 0.4 }, LATIN_HIPS);
  g(['Christian', 'Christian & Gospel', 'Gospel', 'Inspirational'], { pop: 0.7, funk: 0.2 });
  g(['Jazz', 'Swing', 'Big Band', 'Smooth Jazz', 'Blues'], { funk: 0.6, pop: 0.3, rock: 0.2 });
  g(['Holiday', 'Christmas', 'Christmas: Pop'], { pop: 0.8, party: 0.3, disco: 0.2 });
  g(['World', 'Worldwide', 'Bollywood', 'Indian Pop', 'Arabic', 'French Pop', 'German Pop', 'Schlager', 'Turkish', 'Greek'], { pop: 0.7, latin: 0.3, disco: 0.2 });
  return m;
})();

function genreKey(name: string): string {
  return fold(name).replace(/[^a-z0-9&/]+/g, '');
}

/** Coarse words inside an unknown genre name ("Pop Punk Revival"), checked in this order. */
const GENRE_WORDS: [RegExp, string][] = [
  [/k-?pop/, 'K-Pop'],
  [/reggaeton|urban[oa]|latin|latino|salsa|bachata|cumbia/, 'Latin'],
  [/metal/, 'Metal'],
  [/punk/, 'Punk'],
  [/rock/, 'Rock'],
  [/hip-?hop|rap|trap/, 'Hip-Hop/Rap'],
  [/r&b|soul/, 'R&B/Soul'],
  [/funk/, 'Funk'],
  [/disco/, 'Disco'],
  [/house/, 'House'],
  [/electr|techno|trance|edm/, 'Electronic'],
  [/dance/, 'Dance'],
  [/country/, 'Country'],
  [/pop/, 'Pop'],
];

function matchGenre(genre: string | undefined): GenreStyle | null {
  if (!genre || !genre.trim()) return null;
  const exact = GENRES.get(genreKey(genre));
  if (exact) return exact;
  const f = fold(genre);
  for (const [re, name] of GENRE_WORDS) if (re.test(f)) return GENRES.get(genreKey(name)) ?? null;
  return null;
}

/** Family weights for an iTunes genre name, or null when unknown. */
export function genreFamilies(genre: string | undefined): Weights | null {
  const g = matchGenre(genre);
  return g ? normWeights(g.families) : null;
}

/** Style themes implied by a genre (afro, dancehall, soca, swing, country, folk ...). */
const GENRE_THEMES: [RegExp, Theme[]][] = [
  [/afro|highlife|naija|amapiano/, ['afro']],
  [/amapiano/, ['amapiano']],
  [/dancehall/, ['dancehall']],
  [/reggae(?!ton)/, ['reggae']],
  [/soca|calypso/, ['soca']],
  [/jazz|swing|big band|blues|rockabilly|doo-?wop|rock\s*(?:&|and|'?n'?)\s*roll/, ['swing']],
  [/country|bluegrass|americana/, ['country']],
  [/folk/, ['folk']],
  [/bollywood|indian|hindi|filmi|desi/, ['bollywood']],
  [/punjabi|bhangra/, ['bhangra', 'bollywood']],
  [/arab|middle east|turk|khaleeji|raqs|belly/, ['bellydance']],
  [/hawai/, ['hula']],
  [/gujarat|garba|dandiya/, ['garba']],
];

export function genreThemes(genre: string | undefined): Theme[] {
  if (!genre) return [];
  const f = fold(genre);
  const out = new Set<Theme>();
  for (const [re, th] of GENRE_THEMES) if (re.test(f)) for (const t of th) out.add(t);
  return THEMES.filter((t) => out.has(t));
}

// ---------------------------------------------------------------------------
// (c) Title / artist keywords -> themes

const word = (alts: string) => new RegExp(`(?<![a-z0-9])(?:${alts})(?![a-z0-9])`);

const KEYWORDS: [RegExp, Theme[]][] = [
  [word("hips?|booty|body|bodies|twerk(?:s|ing|in')?"), ['hips', 'shake']],
  [word("shake|shakes|shakin'?|shaking|shakedown|shook|wiggle"), ['shake']],
  [word("jump|jumps|jumping|jumpin'?|bounce|bounces|bouncing|bouncin'?|hop|hops|hopping|hoppin'?"), ['jump']],
  [word("clap|claps|clapping|clappin'?|hands?"), ['clap', 'hands']],
  [word("twist|twists|twisted|twisting|twistin'?"), ['twist']],
  [word("spin|spins|spinning|spinnin'?|round|around|turn|turns|turning|turnin'?"), ['spin']],
  [word("walk|walks|walking|walkin'?|moonwalk|strut|step|steps|stepping|steppin'?|run|runs|running|runnin'?"), ['walk']],
  [word("stomp|stomps|stomping|stompin'?|rock|rocks|rocking|rockin'?"), ['stomp']],
  [word("point|points|pointing|pointin'?"), ['point']],
  [word("punch|punches|punching|fight|fights|fighting|fighter"), ['punch']],
  [word("wave|waves|waving|wavin'?"), ['wave']],
  [word("kick|kicks|kicking|kickin'?"), ['kick']],
  [word("ball|ballin'?|game|games|champion|champions|winner|winners|olympic|olympics|basketball|football|soccer|goal|goals|knockout|slam dunk"), ['sport']],
  [word("tiger|tigers|lion|lions|dog|dogs|cat|cats|bird|birds|chicken|chickens|horse|horses|pony|monkey|monkeys|bear|bears|wolf|wolves|shark|sharks|bee|bees|duck|ducks|penguin|penguins|bunny|frog|frogs|snake|snakes|elephant|gorilla|kangaroo|zebra|panda|dinosaur"), ['animal']],
  [word("bhangra"), ['bhangra', 'bollywood']],
  [word("bollywood"), ['bollywood']],
  [word("garba|dandiya"), ['garba']],
  [word("hula|aloha|hawaii|hawaiian"), ['hula']],
  [word("capoeira"), ['capoeira']],
  [word("bellydance|belly dance|habibi"), ['bellydance']],
];

/** Themes suggested by words in a title or artist name (whole words only). */
export function keywordThemes(...texts: (string | undefined)[]): Theme[] {
  const found = new Set<Theme>();
  for (const t of texts) {
    if (!t) continue;
    const s = fold(t).replace(/[‘’]/g, "'");
    for (const [re, themes] of KEYWORDS) if (re.test(s)) for (const th of themes) found.add(th);
  }
  return THEMES.filter((t) => found.has(t));
}

// ---------------------------------------------------------------------------
// (d) Tempo / energy priors

/** A weak family lean from tempo and energy, normalised; null when there is nothing to say. */
function priorWeights(p: StylePriors | undefined): Weights | null {
  if (!p) return null;
  const w: Record<Family, number> = { latin: 0, disco: 0, funk: 0, hiphop: 0, pop: 0, rock: 0, kpop: 0, party: 0, aerobic: 0 };
  let any = false;
  const bpm = p.bpm;
  if (typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0) {
    any = true;
    if (bpm < 85) Object.assign(w, { hiphop: 0.6, pop: 0.4 });
    else if (bpm <= 104) Object.assign(w, { latin: 0.5, hiphop: 0.5 });
    else if (bpm <= 118) Object.assign(w, { funk: 0.5, hiphop: 0.3, disco: 0.2 });
    else if (bpm <= 132) Object.assign(w, { disco: 0.4, pop: 0.4, aerobic: 0.2 });
    else if (bpm < 160) Object.assign(w, { pop: 0.5, aerobic: 0.3, rock: 0.2 });
    else Object.assign(w, { rock: 0.6, aerobic: 0.4 });
  }
  const e = p.energy;
  if (typeof e === 'number' && Number.isFinite(e)) {
    if (e >= 0.75) {
      w.aerobic += 0.5;
      w.rock += 0.2;
      any = true;
    } else if (e <= 0.3) {
      w.pop += 0.3;
      w.funk += 0.2;
      any = true;
    }
  }
  return any ? normWeights(w) : null;
}

/** How much of the final mix the priors may take, by where the families came from (at most 15 %). */
const PRIOR_SHARE: Record<SongStyle['source'], number> = { override: 0.05, artist: 0.08, genre: 0.12, fallback: 0.15 };

// ---------------------------------------------------------------------------
// Resolution

function ordered(w: Weights): Weights {
  const out: Weights = {};
  for (const f of FAMILIES) if (w[f]) out[f] = w[f];
  return out;
}

// ---------------------------------------------------------------------------
// Signature-move nods: famous songs whose association with one or two single
// moves is obvious. The moves open every chorus (the generator composes the
// rest). Keyed by a title key + artist key (any credited artist).

const SONG_SIGNATURES: readonly (readonly [string, string, readonly string[]])[] = [
  ['gangnamstyle', 'psy', ['gallop', 'lasso']],
  ['hipsdontlie', 'shakira', ['hip-sway', 'hip-shake']],
  ['thetwist', 'chubbychecker', ['the-twist']],
  ['letstwistagain', 'chubbychecker', ['the-twist']],
  ['twistandshout', 'beatles', ['the-twist']],
  ['twistandshout', 'isleybrothers', ['the-twist']],
  ['stayinalive', 'beegees', ['disco-point']],
  ['nightfever', 'beegees', ['disco-point']],
  ['lefreak', 'chic', ['disco-point']],
  ['thehustle', 'vanmccoy', ['hustle-tap']],
  ['billiejean', 'michaeljackson', ['heel-swivel', 'spin-pose']],
  ['beatit', 'michaeljackson', ['kick-point', 'heel-swivel']],
  ['dontstoptilyougetenough', 'michaeljackson', ['heel-swivel', 'spin-pose']],
  ['smoothcriminal', 'michaeljackson', ['spin-pose']],
  ['getup', 'jamesbrown', ['jb-slide']],
  ['getupsexmachine', 'jamesbrown', ['jb-slide']],
  ['partyrockanthem', 'lmfao', ['running-man-shuffle']],
  ['watchmewhipnaenae', 'silento', ['the-whip', 'nae-nae']],
  ['watchme', 'silento', ['the-whip', 'nae-nae']],
  ['stankylegg', 'gsboyz', ['stanky-leg']],
  ['ucanttouchthis', 'mchammer', ['hammer-dance']],
  ['canttouchthis', 'mchammer', ['hammer-dance']],
  ['teachmehowtodougie', 'caliswagdistrict', ['dougie']],
  ['tootseeroll', '69boyz', ['tootsie-roll']],
  ['walkitout', 'unk', ['walk-it-out']],
  ['millyrock', '2milly', ['milly-rock']],
  ['shoot', 'blocboyjb', ['the-shoot']],
  ['swagsurfin', 'fastlifeyungstaz', ['swag-surf']],
  ['jumparound', 'houseofpain', ['jump-around']],
  ['mambono5', 'loubega', ['mambo-rock']],
  ['september', 'earthwindfire', ['disco-point']],
  ['dancingqueen', 'abba', ['hip-bump']],
];

function titleKey(t: string | undefined): string {
  return fold(t ?? '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft)\b.*$/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** The signature nod for a famous song, if any. */
export function songSignature(title: string | undefined, artist: string | undefined): string[] | undefined {
  const tk = titleKey(title);
  if (!tk) return undefined;
  const artists = artist ? artistCandidates(artist) : [];
  for (const [t, a, sig] of SONG_SIGNATURES) if (t === tk && artists.includes(a)) return [...sig];
  return undefined;
}

/** Every move id named by a signature nod (tests check they exist). */
export function signatureMoveIds(): string[] {
  const ids = new Set<string>(SONG_SIGNATURES.flatMap(([, , s]) => s));
  for (const st of STARTER_STYLES.values()) for (const id of st.signature ?? []) ids.add(id);
  return [...ids];
}

export function resolveSongStyle(song: SongInfo, priors?: StylePriors): SongStyle {
  const curated = song.style ?? (song.videoId ? STARTER_STYLES.get(song.videoId) : undefined);
  const artist = matchArtist(song.artist);
  const genre = matchGenre(song.genre);

  let families: Weights | null = null;
  let source: SongStyle['source'] = 'fallback';
  const layers: [SongStyle['source'], unknown][] = [
    ['override', curated?.families],
    ['artist', artist?.families],
    ['genre', genre?.families],
  ];
  for (const [src, w] of layers) {
    const n = normWeights(w);
    if (n) {
      families = n;
      source = src;
      break;
    }
  }
  if (!families) families = { ...BALANCED_POP.families };

  const prior = priorWeights(priors);
  if (prior) {
    const share = PRIOR_SHARE[source];
    const mixed: Weights = {};
    for (const f of FAMILIES) {
      const v = (1 - share) * (families[f] ?? 0) + share * (prior[f] ?? 0);
      if (v > 0) mixed[f] = v;
    }
    families = normWeights(mixed) ?? families;
  }

  const themeSet = new Set<Theme>([...themesOf(curated?.themes), ...(artist?.themes ?? []), ...genreThemes(song.genre), ...keywordThemes(song.title, song.artist)]);
  const themes = THEMES.filter((t) => themeSet.has(t));

  let focus = normFocus(curated?.focus) ?? normFocus(artist?.focus) ?? normFocus(genre?.focus);
  if (!focus && themeSet.has('hips')) focus = { hips: 1.3 };

  const signature = Array.isArray(curated?.signature)
    ? curated.signature.filter((s): s is string => typeof s === 'string')
    : (songSignature(song.title, song.artist) ?? artist?.signature);

  const out: SongStyle = { families: ordered(families), themes, source };
  if (focus) out.focus = focus;
  if (signature && signature.length) out.signature = [...signature];
  return out;
}

/** The 1–2 strongest families, strongest first (ties in FAMILIES order). */
function topFamilies(s: SongStyle): Family[] {
  const list = FAMILIES.filter((f) => (s.families[f] ?? 0) > 0).sort((a, b) => (s.families[b] ?? 0) - (s.families[a] ?? 0));
  if (!list.length) return [];
  const w1 = s.families[list[0]] ?? 0;
  const w2 = list[1] ? (s.families[list[1]] ?? 0) : 0;
  return w2 > 0 && w2 >= 0.6 * w1 ? list.slice(0, 2) : list.slice(0, 1);
}

/** Human label, e.g. "Latin groove", "Rock", "Disco · Funk". */
export function styleLabel(s: SongStyle): string {
  const top = topFamilies(s);
  return top.length ? top.map((f) => FAMILY_LABEL[f]).join(' · ') : FAMILY_LABEL.pop;
}

/** Short stable string for seeding: "disco:0.50,funk:0.50|kick,spin". */
export function styleKey(s: SongStyle): string {
  const fam = Object.keys(s.families)
    .filter(isFamily)
    .filter((f) => (s.families[f] ?? 0) > 0)
    .sort()
    .map((f) => `${f}:${(s.families[f] ?? 0).toFixed(2)}`)
    .join(',');
  const th = [...s.themes].filter(isTheme).sort().join(',');
  return `${fam}|${th}`;
}

/** Exposed for tests and tooling: the curated style of a starter song. */
export function starterStyle(videoId: string): StyleOverride | undefined {
  return STARTER_STYLES.get(videoId);
}
