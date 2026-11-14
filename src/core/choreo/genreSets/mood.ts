/**
 * Move ids of the mood set and the other new genre sets that have no file of
 * their own (see AUTHORING.md, "Genre sets"). Plain id lists, no imports:
 * genres.ts merges them into its sets (after the ids it already lists).
 * Whitespace-separated move ids; `//` comments are allowed.
 *
 *   lyrical   lyrical / contemporary: long reaches and arm sweeps, port de
 *             bras, slow turns, lunges with arcing arms, balances,
 *             contractions and releases, body waves; opened by a calm song
 *             (the audio `calm` trait), ballads, soft / piano rock, ambient,
 *             singer-songwriter, whatever the genre family.
 *   metal     headbanging, the windmill (hair), the horns, chugging squats,
 *             the wall of death crouch; opened by metal names and a heavy,
 *             distorted, driving sound on a rock song.
 *   punk      the pogo, skanking, the hardcore two-step, circle-pit running,
 *             slam dancing; opened by punk / hardcore / ska / emo names and
 *             fast, driving rock (about 150+ BPM).
 *   brazil    samba no pé, axé, frevo, funk carioca (passinho, quadradinho),
 *             forró; opened by Brazilian names (samba, axé, baile funk,
 *             sertanejo, forró, MPB, bossa nova).
 *   amapiano  the vosho, pouncing cat, tshwala bam, the "amapiano shuffle",
 *             slow knee bounces with log-drum hits; opened by amapiano, gqom,
 *             and South African house.
 */

export const moves: Partial<Record<string, string>> = {
  // All in families/lyrical.ts (hand-authored full-body moves, no shared layers).
  lyrical: `
    // low: small and upright (Easy)
    tendu-open halo-sway embrace-release offering-hands gather-open spine-roll-up
    // mid: travelling flow
    opening-walk reach-recover swing-suspend fall-recover spiral-turn arcing-lunge
    // high: deep, sustained range and control (Hard), no jumps
    lunge-sweep-rise grand-plie developpe-side side-tilt spiral-sink`,
  metal: `horns-to-crowd doom-sway hammer-stomp arms-out-lean-back wall-of-death circle-pit-call`,
  punk: `shout-along-bounce slam-bump picking-up-change hardcore-windmill cross-skank
    grounded-pogo arm-in-arm-sway`,
  brazil: `samba-de-roda samba-turn forro-basic axe-wave-step descer-rebolando frevo-scissors passinho-tap frevo-squat`,
  amapiano: `log-drum-bounce amapiano-shuffle low-squat-walk air-piano knee-drop-groove wide-fist-roll`,
};
