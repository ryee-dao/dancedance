/**
 * Move ids of the sets added or grown in the genre survey (Nov 2026,
 * tools/eval/data/genre-dance-survey.md; see AUTHORING.md, "Genre sets").
 * Plain id lists, no imports: genres.ts merges them into its sets (after the
 * ids it already lists). Whitespace-separated move ids; `//` comments are
 * allowed.
 *
 *   gospel    the choir step and clap, the choir two-step, raised-hand
 *             praise, lifted hands, pointing up, the handkerchief wave, the
 *             tambourine, the bow and rise, the praise-break shout and its
 *             hops, step-team stomps; opened by gospel / worship / praise
 *             names (families/gospel.ts).
 *   country   (grown) heel splits, the zydeco
 *             rubboard scratch, the rolling vine, slappin' leather
 *             (families/country2.ts).
 *   bachata   (grown) the turn, the body wave, the hair comb, Dominican
 *             cross steps, the double tap (families/latin2.ts).
 *   tango     (grown) forward ochos, the boleo, the cruzada, the lunge, the
 *             caricia, the molinete (families/latin2.ts).
 */

export const moves: Partial<Record<string, string>> = {
  gospel: `
    // low (Easy)
    choir-step-clap raised-hand-praise lifted-hands-sway point-to-heaven
    // mid
    choir-two-step handkerchief-wave tambourine-praise praise-bow-rise praise-shout
    // high
    shout-hop step-team-stomp-clap`,
  // More country (families/country2.ts), added to the line-dance / hoedown set.
  country: `heel-splits rubboard-scratch rolling-vine slap-leather`,
  // The thin Latin-dance sets (families/latin2.ts).
  bachata: `bachata-turn bachata-body-wave bachata-hair-comb dominican-cross-step bachata-double-tap`,
  tango: `tango-ocho tango-boleo tango-cruzada tango-lunge tango-caricia tango-molinete`,
  // Regional Mexican and cumbia (families/mexican.ts), flamenco (families/flamenco.ts).
  mexican: `zapateado campanas puntas remate caballito quebradita-hop`,
  cumbia: `cumbia-side-basic cumbia-kick-back cumbia-circle cumbia-hat-sway pollera-wave cumbia-turn`,
  flamenco: `flamenco-braceo flamenco-marcaje flamenco-llamada`,
  // Arabic, Turkish and North African pop (families/world2.ts).
  bellydance: `hip-lifts hip-slides maya hip-shimmy khaleeji-hair-toss khaleeji-step saidi-cane-hop`,
};
