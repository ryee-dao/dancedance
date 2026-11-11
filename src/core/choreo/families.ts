/**
 * Style vocabulary shared by the move catalogue and the song style profile.
 * Pure TypeScript (no DOM).
 */

/** Dance style families a move belongs to / a song leans toward. */
/** `party`: mime, sports and novelty party moves. */
export type Family = 'latin' | 'disco' | 'funk' | 'hiphop' | 'pop' | 'rock' | 'kpop' | 'party' | 'aerobic';
export const FAMILIES: readonly Family[] = ['latin', 'disco', 'funk', 'hiphop', 'pop', 'rock', 'kpop', 'party', 'aerobic'];

/** Which part of the body a move is about. */
export type Focus = 'hips' | 'arms' | 'legs' | 'full' | 'turn';
export const FOCI: readonly Focus[] = ['hips', 'arms', 'legs', 'full', 'turn'];

/**
 * Theme keys: a song's title/artist can suggest one (see songStyle.ts) and
 * moves carrying it are boosted.
 */
export type Theme =
  | 'hips' | 'shake' | 'jump' | 'clap' | 'hands' | 'twist' | 'spin' | 'walk' | 'stomp' | 'point' | 'punch' | 'wave' | 'kick'
  // Style themes (set by genre / artist, not by title words).
  | 'afro' | 'dancehall' | 'soca' | 'amapiano' | 'reggae' | 'swing' | 'country' | 'folk' | 'bollywood' | 'bhangra'
  // Party mimes a title can call for.
  | 'sport' | 'animal'
  // World dance styles.
  | 'garba' | 'bellydance' | 'hula' | 'capoeira';
export const THEMES: readonly Theme[] = [
  'hips', 'shake', 'jump', 'clap', 'hands', 'twist', 'spin', 'walk', 'stomp', 'point', 'punch', 'wave', 'kick',
  'afro', 'dancehall', 'soca', 'amapiano', 'reggae', 'swing', 'country', 'folk', 'bollywood', 'bhangra',
  'sport', 'animal', 'garba', 'bellydance', 'hula', 'capoeira',
];

/**
 * Style themes that name a dance tradition. A move carrying one is a
 * "specialty" move: the generator only uses it for songs whose style asks
 * for that tradition (see `specialtyOf` in generator.ts).
 */
export type Tradition = Extract<Theme, 'afro' | 'dancehall' | 'soca' | 'amapiano' | 'reggae' | 'swing' | 'country' | 'folk' | 'bollywood' | 'bhangra' | 'garba' | 'bellydance' | 'hula' | 'capoeira'> | 'latin';
export const TRADITION_THEMES: readonly Theme[] = ['afro', 'dancehall', 'soca', 'amapiano', 'reggae', 'swing', 'country', 'folk', 'bollywood', 'bhangra', 'garba', 'bellydance', 'hula', 'capoeira'];

/** Traditions a song theme opens (close neighbours share vocabulary). */
export const THEME_TRADITIONS: Readonly<Partial<Record<Theme, readonly Tradition[]>>> = {
  afro: ['afro', 'amapiano'],
  amapiano: ['amapiano', 'afro'],
  dancehall: ['dancehall', 'reggae', 'soca'],
  reggae: ['reggae', 'dancehall'],
  soca: ['soca', 'dancehall'],
  swing: ['swing'],
  country: ['country'],
  folk: ['folk'],
  bollywood: ['bollywood', 'bhangra', 'garba'],
  bhangra: ['bhangra', 'bollywood'],
  garba: ['garba', 'bollywood'],
  bellydance: ['bellydance'],
  hula: ['hula'],
  capoeira: ['capoeira'],
};

/**
 * Traditional steps with no tradition theme, by id: the named social /
 * folk dances of the latin file (salsa, merengue, cumbia, bachata, cha-cha,
 * samba, flamenco, paso doble, folklórico), and the untagged moves of the
 * world / retro files. Generic latin grooves (hip sway, reggaeton bounce,
 * booty shake ...) are not listed: they stay ordinary latin-family moves.
 */
export const TRADITION_BY_ID: Readonly<Record<string, readonly Tradition[]>> = (() => {
  const t: Record<string, Tradition[]> = {};
  const set = (ids: string, tr: Tradition[]) => {
    for (const id of ids.split(/\s+/).filter(Boolean)) t[id] = tr;
  };
  set(`merengue merengue-clap merengue-turn merengue-side salsa-basic salsa-back-basic side-salsa salsa-right-turn
    cumbia-step cumbia-machete cumbia-sau cumbia-candle cha-cha cha-cha-chasse cha-cha-spot-turn cucaracha mambo-rock new-yorker
    bachata-side bachata-basic samba-basic samba-whisk bota-fogo samba-reggae-drum samba-no-pe
    flamenco-arms flamenco-palmas flamenco-turn paso-doble-cape folklorico-skirt
    tango-walk frevo-hop hat-dance-heels huayno-skip`, ['latin']);
  set('waltz-balance waltz-turn', ['swing']);
  set('poi-swing slap-dance', ['hula']);
  set('natta-heel-strike', ['bollywood']);
  set('para-para-sweep fan-arc ribbon-eight taiko-strike balinese-agem', ['folk']);
  return t;
})();
/** Family files whose every move is a specialty move (world / retro / afro traditions). */
export const TRADITION_FILES: ReadonlySet<string> = new Set(['world', 'retro', 'afro']);

export const FAMILY_LABEL:Readonly<Record<Family, string>> = {
  latin: 'Latin groove',
  disco: 'Disco',
  funk: 'Funk',
  hiphop: 'Hip-hop',
  pop: 'Pop',
  rock: 'Rock',
  kpop: 'K-pop',
  party: 'Party',
  aerobic: 'Aerobics',
};

export function isFamily(v: unknown): v is Family {
  return typeof v === 'string' && (FAMILIES as readonly string[]).includes(v);
}
export function isFocus(v: unknown): v is Focus {
  return typeof v === 'string' && (FOCI as readonly string[]).includes(v);
}
export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v);
}
