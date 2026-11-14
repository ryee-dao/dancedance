/**
 * Move ids of the simple basics added so every genre set has enough moves
 * for Easy (Nov 2026): difficulty 1, low impact, no jumps or spins, feet
 * under the body, the arms carrying the style. Before this, Easy (which keeps
 * to difficulty-1 moves, generator.ts EASY_HARD_CAP) couldn't reach half
 * genre time on sets with only a few simple moves (Latin had 2 of its 21).
 * Plain id lists, no imports: genres.ts merges them into its sets.
 * Whitespace-separated move ids; `//` comments are allowed.
 *
 * The moves live in families/basics*.ts, one file per group of styles.
 */

export const moves: Partial<Record<string, string>> = {
  // families/basicsLatin.ts
  latin: `merengue-twist-march merengue-hip-circle cha-cha-side-basic guiro-scrape bongo-hands`,
  salsa: `salsa-basic-in-place salsa-tap-basic salsa-cumbia-basic salsa-front-back-tap salsa-piano-step salsa-diagonal-break`,
  bachata: `bachata-basic-in-place bachata-hand-slide bachata-arm-wave bachata-arm-drop bachata-hip-roll`,
  cumbia: `cumbia-forward-shuffle`,
  reggaeton: `reggaeton-knee-lift reggaeton-reach-pull reggaeton-hip-hit`,
  // families/basicsIbero.ts
  tango: `tango-cadencia tango-cunita tango-side-step tango-golpecitos tango-ocho-cortado`,
  flamenco: `sevillanas-step palmas-step floreo flamenco-skirt`,
  mexican: `atole-step mecedora push-step norteno-two-step`,
  brazil: `forro-forward-back xote samba-basic-in-place`,
  // families/basicsRetro.ts
  country: `toe-fan heel-bounce sugar-foot heel-toe`,
  swing: `rock-triple spank-baby side-triples peckin`,
  gospel: `reach-receive`,
  // families/basicsIsland.ts
  caribbean: `one-drop-rock rocksteady-sway steppers-skank soca-chip waist-wine`,
  hula: `kao-ocean kao-sun kao-aloha kao-flower ami-hula`,
  capoeira: `ginga-basic roda-palmas berimbau-sway maculele-strike`,
  afro: `azonto-iron azonto-swim galala`,
  amapiano: `hamba-wena shirt-pluck bhenga-tap`,
  // families/basicsFolk.ts
  folk: `hora-walk polka-walk an-dro morris-walk dabke-walk pandanggo-sway`,
  bellydance: `belly-shoulder-shimmy chest-slides snake-arms`,
  dangdut: `joget-helicopter joget-tug koplo-swing`,
  schlager: `polonaise clap-along`,
  // families/basicsClub.ts
  house: `side-jack house-heel-toe jack-step-touch rolling-jack`,
  bass: `dnb-skank wobble-arms clam-shell drift-steer`,
  edm: `build-up-clap`,
  metal: `horns-sway fist-bang horns-step breakdown-nod`,
  punk: `ska-stroll skank-punches grounded-two-step`,
  drill: `below-the-knee woo-bounce drill-sway`,
};
