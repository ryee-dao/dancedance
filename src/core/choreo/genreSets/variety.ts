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
 */

export const moves: Partial<Record<string, string>> = {
  gospel: `
    // low (Easy)
    choir-step-clap raised-hand-praise lifted-hands-sway point-to-heaven
    // mid
    choir-two-step handkerchief-wave tambourine-praise praise-bow-rise praise-shout
    // high
    shout-hop step-team-stomp-clap`,
};
