/**
 * Move ids of the urban genre sets (see AUTHORING.md, "Genre sets").
 * Plain id lists, no imports: genres.ts merges them into its sets.
 * Whitespace-separated move ids; `//` comments are allowed.
 *
 *   trap       trap-era party dances: the whip, nae nae, shoot, woah, griddy,
 *              hitting quick poses on the hats, the bounce on the half-time
 *              snare; opened by trap and its regional names, and a half-time
 *              feel with hi-hat rolls and heavy 808s.
 *   drill      UK / NY / Chicago drill: the drill bounce, arm swings and
 *              shoulder rocks, the shmoney, the woo walk; opened by drill and
 *              a half-time feel with syncopated, sliding hats and bass.
 *   rnb        contemporary R&B: body rolls, smooth two-steps, shoulder and
 *              hip isolations, slow grind grooves; opened by R&B, neo-soul,
 *              new jack swing, a swung, unhurried groove.
 *   reggaeton  perreo and dembow steps: the reggaeton bounce, hip rolls, the
 *              dembow step, the gasolina; opened by reggaeton, dembow, urbano,
 *              Latin trap, and dembow-like syncopation around 88-100 BPM.
 */

export const moves: Partial<Record<string, string>> = {
  // families/urban.ts (genres.ts RAW already lists the-whip the-shoot the-woah griddy jet-griddy nae-nae)
  trap: `shoulder-lean lean-two-step hit-and-hold rap-hands turn-up-jump`,
  // (RAW already lists shmoney)
  drill: `drill-bounce shoulder-rock drill-arm-swing woo-walk sturdy-hop drill-glide drill-two-step`,
  rnb: `body-roll slow-hip-roll hip-roll-down snap-sway slow-jam-sway`,
  reggaeton: `dembow-step perreo-bounce reggaeton-hip-roll dembow-knee-pop sandungueo-bounce dembow-shimmy`,
};
