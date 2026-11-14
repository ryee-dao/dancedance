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
 *   mexican, cumbia (grown, families/mexican.ts), flamenco (grown,
 *             families/flamenco.ts), bellydance (grown, families/world2.ts).
 *   dangdut   (new) the joget sway and the goyang: saw, dribble, broken hip
 *             hits; opened by dangdut / koplo / joget, and less firmly by
 *             Thai luk thung / mor lam (families/world3.ts).
 *   schlager  (new) schunkeln, the stein toast, the bird-dance beak snaps and
 *             wing flaps; opened by Schlager, Oktoberfest, apres-ski, party
 *             Schlager names; folk lends the polka (families/world3.ts).
 *   synthpop  (new, round three) the new wave / synth-pop floor: the side step
 *             with the arms swinging across, robot ticks, New Romantic poses,
 *             keytar, shoulder pops, the stiff bounce and the pogo, the kick
 *             shuffle, the post-punk flail stomp (families/synthpop.ts).
 *   indie     (new, round three) the indie gig / indie disco floor: pockets
 *             nod, shoegaze sway, the head shake, fringe sweep, twee claps,
 *             tambourine, the gig two-step, baggy shuffle, festival arms, the
 *             front-row jump and the stomp (families/indie.ts).
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
  // New: dangdut and Schlager (families/world3.ts).
  dangdut: `joget-sway goyang-gergaji goyang-dribble goyang-patah`,
  schlager: `schunkeln prost-toast beak-snaps wing-flaps`,
  // Salsa shines (families/latin2.ts); house footwork and an amapiano groove (families/club.ts).
  salsa: `salsa-cross-step salsa-flare`,
  house: `house-farmer`,
  amapiano: `tshwala-groove`,
  // Round three (Nov 2026): synth-pop / new wave and indie (families/synthpop.ts, families/indie.ts).
  synthpop: `
    // low (Easy)
    new-wave-side-step robot-tick new-romantic-pose keytar-groove shoulder-pops stiff-bounce finger-snap-glide
    // mid
    kick-shuffle mannequin-hits skip-swing romantic-arm-sweep
    // high
    pogo-point flail-stomp`,
  indie: `
    // low (Easy)
    pocket-nod shoegaze-sway indie-head-shake loose-arm-swing twee-clap tambourine-shake fringe-sweep
    // mid
    indie-two-step baggy-shuffle jangle-strum festival-arms
    // high
    arms-round-jump indie-disco-stomp`,
};
