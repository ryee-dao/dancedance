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

export const FAMILY_LABEL: Readonly<Record<Family, string>> = {
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
