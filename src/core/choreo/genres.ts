/**
 * The two tiers of the move library. Pure TypeScript (no DOM).
 *
 *   GLOBAL moves (every move not listed below) read fine on any music: the
 *   aerobic, pop, party and groove steps, and style steps that don't need
 *   their own music. They are used on every song, where the level allows,
 *   weighted by the song's style, the tempo and the level (weights.ts).
 *
 *   GENRE-EXCLUSIVE moves (listed in GENRE_MOVES) only make sense with their
 *   music: headbangs and air guitar for rock, salsa and cumbia steps for
 *   Latin, line-dance steps for country, Lindy steps for swing ... They are
 *   only ever used on songs whose style opens that genre (songGenres), and
 *   there they are the kit's accents, 20-40 % of the danced time
 *   (generator.ts GENRE_MIN / GENRE_MAX).
 *
 * Variations and ornaments of a move share its tier; a recombined variation
 * takes the genre of a layer that belongs to one (variations.ts).
 * Signature nods (songStyle.ts SONG_SIGNATURES) are separate: they open the
 * chorus of their own song, whatever tier their moves are in.
 */

import { FAMILIES, type Family, type Theme } from './families';

export type Genre =
  | 'rock' | 'hiphop' | 'latin' | 'discofunk' | 'kpop'
  | 'country' | 'swing' | 'afro' | 'caribbean' | 'southasian'
  | 'folk' | 'bellydance' | 'hula' | 'capoeira';

export const GENRES: readonly Genre[] = ['rock', 'hiphop', 'latin', 'discofunk', 'kpop', 'country', 'swing', 'afro', 'caribbean', 'southasian', 'folk', 'bellydance', 'hula', 'capoeira'];

export const GENRE_LABEL: Readonly<Record<Genre, string>> = {
  rock: 'Rock',
  hiphop: 'Hip-hop',
  latin: 'Latin',
  discofunk: 'Disco & funk',
  kpop: 'K-pop',
  country: 'Country',
  swing: 'Swing & rock-and-roll',
  afro: 'Afrobeats & amapiano',
  caribbean: 'Dancehall, reggae & soca',
  southasian: 'Bollywood, bhangra & garba',
  folk: 'Folk',
  bellydance: 'Belly dance',
  hula: 'Hula & Polynesian',
  capoeira: 'Capoeira',
};

export function isGenre(v: unknown): v is Genre {
  return typeof v === 'string' && (GENRES as readonly string[]).includes(v);
}

/** Genres a song theme opens (themes come from the artist table, genre metadata and title words). */
export const THEME_GENRES: Readonly<Partial<Record<Theme, Genre>>> = {
  country: 'country',
  swing: 'swing',
  afro: 'afro',
  amapiano: 'afro',
  dancehall: 'caribbean',
  reggae: 'caribbean',
  soca: 'caribbean',
  bollywood: 'southasian',
  bhangra: 'southasian',
  garba: 'southasian',
  folk: 'folk',
  bellydance: 'bellydance',
  hula: 'hula',
  capoeira: 'capoeira',
};

/** Genres a style family opens (disco and funk share one set). */
export const FAMILY_GENRE: Readonly<Partial<Record<Family, Genre>>> = {
  rock: 'rock',
  hiphop: 'hiphop',
  latin: 'latin',
  disco: 'discofunk',
  funk: 'discofunk',
  kpop: 'kpop',
};

/** A family genre opens when its family weighs at least this share of the song's strongest family ... */
export const FAMILY_OPEN_SHARE = 0.65;
/**
 * Themes whose genre / artist styles use the latin family as a stand-in for
 * hip-led grooves: they never open the Latin set (no salsa on afrobeats).
 */
const LATIN_PROXY_THEMES: readonly Theme[] = ['afro', 'amapiano', 'dancehall', 'reggae', 'soca'];

/** The parts of a song style that decide its genres. */
export interface GenreSource {
  families: Partial<Record<Family, number>>;
  themes: readonly Theme[];
}

/**
 * Genres a song's style opens: the genre of each of its style themes, plus
 * each family genre whose family weighs at least FAMILY_OPEN_SHARE of the
 * strongest family (only the strongest family itself when a theme already
 * names a tradition, so a country song isn't also "rock").
 */
export function songGenres(style: GenreSource): ReadonlySet<Genre> {
  const out = new Set<Genre>();
  for (const t of style.themes) {
    const g = THEME_GENRES[t];
    if (g) out.add(g);
  }
  const themed = out.size > 0;
  let max = 0;
  for (const f of FAMILIES) max = Math.max(max, style.families[f] ?? 0);
  if (max <= 0) return out;
  const fw = new Map<Genre, number>();
  for (const f of FAMILIES) {
    const g = FAMILY_GENRE[f];
    if (g) fw.set(g, Math.max(fw.get(g) ?? 0, style.families[f] ?? 0));
  }
  const proxy = style.themes.some((t) => LATIN_PROXY_THEMES.includes(t));
  for (const [g, w] of fw) {
    if (w <= 0) continue;
    if (g === 'latin' && proxy) continue;
    if (themed ? w >= max - 1e-9 : w >= FAMILY_OPEN_SHARE * max - 1e-9) out.add(g);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The genre sets (move ids). Everything else is global.

const RAW: Readonly<Record<Genre, string>> = {
  rock: `
    headbang headbang-arms-up low-headbang side-headbang hair-swing headbang-fist
    pogo pogo-fist side-pogo mosh-two-step circle-pit shoulder-barge
    air-guitar power-lunge guitar-neck-raise windmill power-windmill strum-kick guitar-spin guitar-solo duck-walk rock-star-jump chug-squat
    air-bass air-drums tom-roll cymbal-crash
    mic-grab mic-stand-tilt monitor-foot ska-skank
    // named: recombinations promoted in families/named.ts
    heel-toe-bass-slap jump-around-v-pump knee-lift-fist-bang swaying-drummer slow-sway-fist-bang march-bass-slap
    march-v-pump march-windmill pogo-beat-clap pogo-arena-wave pogo-drums pogo-fist-bang pogo-windmill
    barge-v-pump stomp-kick-bass-slap stomp-kick-windmill snap-kick-v-pump step-touch-windmill
    sumo-squat-bass-slap sumo-squat-v-pump`,
  hiphop: `
    dougie milly-rock cat-daddy the-whip nae-nae the-shoot harlem-shake stanky-leg tootsie-roll the-woah
    jersey-club-kick jerkin bankhead-bounce swag-surf walk-it-out lean-and-snap brush-off steve-martin
    krump-stomp krump-arm-swing krump-chest-pop toprock-step-out indian-step
    cabbage-patch the-reebok bart-simpson hammer-dance roger-rabbit kick-step skeeter-rabbit butterfly-knees loose-legs tut-box
    the-wop the-smurf smurf-two-step shmoney bernie lean-back griddy jet-griddy toprock-cross-step toprock-kick-step humpty-hop
    // named: recombinations promoted in families/named.ts
    booty-shake-dougie-arms jump-around-dougie-arms jump-around-bankhead-arms side-out-bankhead-arms
    swag-walk-cabbage-patch swag-walk-bankhead-arms`,
  latin: `
    merengue merengue-clap merengue-turn merengue-side
    salsa-basic salsa-back-basic side-salsa salsa-right-turn new-yorker mambo-rock
    cha-cha cha-cha-chasse cha-cha-spot-turn cucaracha
    cumbia-step cumbia-machete cumbia-sau cumbia-candle
    bachata-side bachata-basic
    samba-basic samba-whisk bota-fogo samba-reggae-drum samba-no-pe frevo-hop
    flamenco-arms flamenco-palmas flamenco-turn paso-doble-cape tango-walk
    folklorico-skirt hat-dance-heels huayno-skip maraca-shake
    // named: recombinations promoted in families/named.ts
    bota-fogo-drum-hits box-step-mambo-arms box-step-maracas cha-cha-chasse-cha-cha-arm cha-cha-chasse-fan
    cha-cha-chasse-flow cha-cha-chasse-shimmy conga-maracas cucaracha-snake-arms merengue-side-cha-cha-arm
    merengue-side-fan merengue-side-mambo-arms samba-whisk-carnival-arms samba-whisk-shimmy side-salsa-flow
    step-touch-maracas`,
  discofunk: `
    disco-point double-disco-point kick-point fever-pose disco-vine disco-dip disco-spin bump-point hip-swing-point
    hustle-tap hustle-basic hustle-turn hitch-turn roll-the-dice roller-glide roller-crossover roller-swizzle
    vogue-arms vogue-pose box-frame
    hitchhike the-monkey the-jerk the-pony the-watusi mashed-potato the-freddie philly-dog batusi the-fly
    funky-chicken camel-walk good-foot popcorn jb-slide which-a-way boogaloo four-corners bump-slide funky-guitar
    the-lock lock-drop scoobot uncle-sam-point wrist-twirl muscle-man give-yourself-five
    fresno tick-arm dime-stop king-tut
    // named: recombinations promoted in families/named.ts
    back-tap-disco-point jazz-walk-disco-point jazz-walk-wings kickline-disco-point pas-de-bourree-disco-point
    shake-down-disco-point step-touch-disco-point twist-down-wings`,
  kpop: `
    big-heart cheek-tap-sway bunny-ears shy-shoulders cute-clasp-sway cat-paws peace-eyes
    salute-flick twin-point clock-arms pump-pump-open fan-chant-clap rain-down wiper-hands freeze-hit lunge-line
    point-step toe-tap-point
    // named: recombinations promoted in families/named.ts
    box-step-aegyo-clasp box-step-wipers chasse-pump-and-open cross-travel-cat-paws cross-travel-cheek-taps
    cross-travel-clock-arms cross-travel-fan-chant cross-travel-shy-shoulders cross-travel-wipers
    heel-toe-aegyo-clasp jazz-walk-big-heart jazz-walk-aegyo-clasp jazz-walk-wipers side-lunge-wipers
    march-pump-and-open shake-down-big-heart shake-down-aegyo-clasp slide-bunny-ears slide-cheek-taps
    slide-clock-arms slide-aegyo-clasp slide-peace-eyes slide-shy-shoulders step-touch-big-heart
    step-touch-cat-paws step-touch-wipers swag-walk-fan-chant triple-wipers twist-down-fan-chant
    twist-down-pump-and-open v-step-aegyo-clasp v-step-wipers grapevine-big-heart grapevine-pump-and-open`,
  country: `
    heel-hook heel-switches vine-hitch-clap heel-strut boot-scoot cowboy-kick scuff-hitch sailor-step monterey-turn
    clogging-basic hoedown-slap gallop gallop-lasso lasso
    // named: recombinations promoted in families/named.ts
    heel-hook-double-clap heel-hook-slap-clap heel-dig-hitch-clap heel-toe-lasso jazz-walk-lasso
    side-rock-hitch-clap slide-lasso cowboy-strut vine-hitch-one-arm-up`,
  swing: `
    charleston charleston-kick hand-jive truckin shorty-george bees-knees suzy-q
    gaze-afar tacky-annie boogie-back boogie-forward fall-off-the-log mess-around stomp-off crossover-push apple-jacks
    chicken-walk hitch-kick quickstep-kick shuffle-off-to-buffalo waltz-balance waltz-turn
    // named: recombinations promoted in families/named.ts
    box-step-suzie-q-arms charleston-kick-high-clap charleston-kick-snaps jazz-walk-hand-jive kick-cross-hand-jive
    bourree-charleston shorty-george-clap shorty-george-jazz-hands shorty-george-snaps step-touch-hand-jive
    the-twist-hand-jive triple-shorty-arms`,
  afro: `
    shaku-shaku gwara-gwara shoki azonto-twist soapy zanku afro-groove legwork-cross
    pouncing-cat vosho
    indlamu-stomp gumboot-slap spray-money ndombolo kuduro-stomp lamban-swing harvest-scoop kuku-step sabar-knee`,
  caribbean: `
    willie-bounce bogle signal-di-plane thunder-clap tek-weh-yuhself gully-creepa log-on pon-di-river wacky-dip
    reggae-skank jump-and-wave wine-and-wave palance bacchanal-jump`,
  southasian: `
    thumka light-bulb matka-step namaste-open lotus-rise heel-flick jhummar-sway kite-pull ghoomar-twirl
    s-pose-hit aaja-beckon shoulder-pop-walk screw-the-bulbs naagin-sway kathak-tatkar natta-heel-strike
    bhangra-shoulders boli-call bhangra-hop dhamaal chaffa luddi
    dandiya-strike garba-two-clap garba-three-clap
    // named: recombinations promoted in families/named.ts
    bhangra-hop-one-arm-up bhangra-hop-boli-call box-step-thumka-arm cross-travel-kite-pull
    cross-travel-light-bulb dhamaal-boli-call double-step-bhangra slide-lotus-rise step-touch-kite-pull
    swag-walk-bhangra swag-walk-light-bulb swag-walk-thumka-arm`,
  folk: `
    polka-step heel-toe-polka hora-step sirtaki-step kalinka-heel-toe schuhplattler tarantella-skip can-can-kick
    irish-threes irish-sevens irish-cut-rock highland-fling morris-step pas-de-basque
    dabke-stomp dabke-cross-hop yemenite-step horon-shimmy halay-dip lezginka-steps
    bon-odori-clap awa-odori-walk para-para-sweep fan-arc ribbon-eight taiko-strike yangge-cross-step balinese-agem
    tinikling-hops itik-itik`,
  bellydance: `egyptian-walk hip-drop-kick snake-arm-shimmy`,
  hula: `kaholo-wave hela-point uwehe tamau-hips poi-swing slap-dance`,
  capoeira: `ginga esquiva-dodge`,
};

/** Move ids of each genre set (named variations included; see families/named.ts). */
export const GENRE_MOVES: Readonly<Record<Genre, readonly string[]>> = Object.fromEntries(
  GENRES.map((g) => [g, RAW[g].replace(/\/\/[^\n]*/g, " ").split(/\s+/).filter(Boolean)]),
) as unknown as Record<Genre, readonly string[]>;

const BY_ID = new Map<string, Genre>();
/** Ids listed in more than one genre set (the tier test requires none). */
export const GENRE_CONFLICTS: string[] = [];
for (const g of GENRES) {
  for (const id of GENRE_MOVES[g]) {
    if (BY_ID.has(id) && BY_ID.get(id) !== g) GENRE_CONFLICTS.push(`${id}: ${BY_ID.get(id)} and ${g}`);
    else BY_ID.set(id, g);
  }
}

/** The genre a catalogue move id is exclusive to (undefined = global). */
export function genreOfId(id: string): Genre | undefined {
  return BY_ID.get(id);
}

/** Every listed id (tests check they exist). */
export function genreListedIds(): string[] {
  return [...BY_ID.keys()];
}
