/**
 * Move ids of the electronic genre sets (see AUTHORING.md, "Genre sets").
 * Plain id lists, no imports: genres.ts merges them into its sets.
 * Whitespace-separated move ids; `//` comments are allowed.
 *
 *   house  house dance: jacking, lofting, heel-toe footwork, the skate / train /
 *          farmer, voguing hands; opened by house, deep house, nu-disco, garage,
 *          and steady four-on-the-floor around 115-127 BPM.
 *   edm    festival / rave: fist pumping, the shuffle (cutting shapes), the
 *          jump on the drop, hands-up builds; opened by EDM, big room, electro
 *          house, trance, techno, hardstyle, and four-on-the-floor at 124+ BPM.
 *   bass   dubstep, drum & bass, phonk and other bass music: the skank, rail /
 *          wobble bounce, liquid and popping hits, phonk drift arms; opened by
 *          those names, and heavy sub-bass with a half-time feel (dubstep) or
 *          dense hats at ~170 BPM (drum & bass).
 */

export const moves: Partial<Record<string, string>> = {
  // genres.ts RAW already lists vogue-arms vogue-pose box-frame loose-legs for house.
  house: `house-jack house-stomp crossroads floor-sweep scissor-step`,
  edm: `hands-up-bounce drop-jump cutting-shapes jumpstyle-kick hakken pound-and-pump trance-sweep
    techno-stomp dj-scratch build-and-drop`,
  bass: `half-time-bounce wobble-bounce popping-hits liquid-hands drift-lean cowbell-hits sky-points half-time-stomp
    strobe-arm`,
};
