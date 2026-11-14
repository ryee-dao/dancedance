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
  lyrical: ``,
  metal: ``,
  punk: ``,
  brazil: ``,
  amapiano: ``,
};
