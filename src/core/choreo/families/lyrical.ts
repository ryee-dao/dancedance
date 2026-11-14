/**
 * Moves of the new genre sets (see AUTHORING.md, "Genre sets", and
 * ../genreSets/mood.ts, which lists every id here under its set):
 *
 *   lyrical   lyrical / contemporary for calm songs: reaches, port de bras,
 *             swings and suspensions, falls and recoveries, slow turns,
 *             lunges with arcing arms, extensions. Low = small and upright
 *             (Easy), mid = travelling flow, high = deep, sustained range
 *             and control (Hard), never jumps.
 *   metal     horns, doom sway, hammer stomps, the wall-of-death crouch.
 *   punk      shout-along bounce, slam dancing, hardcore arm windmills,
 *             picking up change, the cross skank.
 *   brazil    samba de roda, a samba no pé turn, forró, axé, frevo, passinho,
 *             descer rebolando.
 *   amapiano  log-drum bounces, the shuffle, knee drops, air piano, the low walk.
 *
 * All are hand-authored full-body moves (no shared layer patterns), so none
 * of them recombines with another set's layers.
 */
import { ARM, FIST, OPEN, at, mir, type ArmAngles, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

// ---------------------------------------------------------------------------
// Shared shapes

/** Ballet arm positions, hands soft and open. */
const BAS_R = at(1, 0.05, 0.5, 0.15, [1, -0.2, 0]);
const BAS_L = at(-1, -0.05, 0.5, 0.15, [1, -0.2, 0]);
const FIRST_R = at(1, 0.06, 0.68, 0.23, [1, -0.2, 0]);
const FIRST_L = at(-1, -0.06, 0.68, 0.23, [1, -0.2, 0]);
const FIFTH_R = at(1, 0.06, 1.06, 0.1, [1, 0, 0]);
const FIFTH_L = at(-1, -0.06, 1.06, 0.1, [1, 0, 0]);
const SECOND: ArmAngles = [86, 8, 92, 16];
const HIGH_V: ArmAngles = [140, 8, 146, 12];
/** A palm resting on the sternum. */
const HEART_L = at(-1, -0.03, 0.76, 0.16, [1, -0.3, 0]);
/** Arms wrapped around yourself: right hand on the left upper arm, left hand on the right ribs. */
const HUG_R = at(1, -0.15, 0.75, 0.16, [0, -1, 0.5]);
const HUG_L = at(-1, 0.08, 0.68, 0.2, [0.3, -1, 0.2]);
const TOES = { pitchR: 28, pitchL: 28 } as const;
const HORNS = { handR: 0, handL: 0, formR: 'horns', formL: 'horns' } as const;
const E_OUT = [1, -0.3, 0] as const;
const E_DOWN = [0.4, -1, 0] as const;

export const patterns: PatternSet = {};

// ---------------------------------------------------------------------------
// Lyrical

const lyrical: MoveDef[] = [
  // --- Low: small, upright, gentle (Easy) ------------------------------------
  full({
    id: 'tendu-open', name: 'Tendu & Open Arm', tags: 'pop | legs arms |', beats: 4, level: 'low', d: 1, parts: ['legs', 'arms'], mirror: true, bounce: 0.1,
    desc: 'Slide one foot out to the side to a pointed toe as the same arm lifts through the front and opens out to the side, eyes following the hand; close the foot and let the arm float down.',
    keys: [
      [0, { y: -0.03, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], nod: 4, r: BAS_R, l: BAS_L, ...OPEN }],
      [1, { y: -0.01, x: -0.015, rf: [0.27, 0, 0.03], lf: [-0.07, 0, 0], pitchR: 40, slideR: true, turn: 8, r: FIRST_R, l: BAS_L, ...OPEN }],
      [2, { y: 0, x: -0.02, lean: -3, rf: [0.28, 0, 0.03], lf: [-0.07, 0, 0], pitchR: 45, turn: 24, nod: -5, r: [98, 6, 104, 14], l: at(-1, -0.08, 0.6, 0.2, E_OUT), ...OPEN }],
      [3, { y: -0.04, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], slideR: true, turn: 6, nod: 2, r: [40, 10, 46, 18], l: BAS_L, ...OPEN }],
    ],
  }),
  full({
    id: 'halo-sway', name: 'Halo Sway', tags: 'pop | arms hips |', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true, bounce: 0.15,
    desc: 'Sway slowly from one foot to the other while one hand rises up the middle, draws a halo over the head and opens out to the side; the other palm rests on the chest.',
    keys: [
      [0, { x: -0.03, hips: -0.03, lean: -2, head: -4, y: -0.04, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, -0.07, 0.58, 0.22, E_OUT), l: HEART_L, ...OPEN }],
      [1, { x: -0.01, hips: -0.01, y: -0.03, nod: -4, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.02, 0.96, 0.25, E_OUT), l: HEART_L, ...OPEN }],
      [2, { x: 0.02, hips: 0.02, lean: 3, nod: -9, turn: 8, y: -0.02, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: at(1, 0.14, 1.08, 0.07, [1, 0.2, 0]), l: HEART_L, ...OPEN }],
      [3, { x: 0.035, hips: 0.035, lean: 5, head: 5, turn: 14, y: -0.04, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], r: [98, 4, 104, 10], l: HEART_L, ...OPEN }],
    ],
  }),
  full({
    id: 'embrace-release', name: 'Embrace & Release', tags: 'pop | arms |', beats: 4, level: 'low', d: 1, parts: ['arms', 'torso'], mirror: true, bounce: 0.15,
    desc: 'Wrap both arms around yourself and lean into the hug, then let one arm unwind and reach long out to the side, the weight and the gaze following it.',
    keys: [
      [0, { y: -0.03, x: -0.01, bend: 5, nod: 8, head: -6, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: HUG_R, l: HUG_L, ...OPEN }],
      [1, { y: -0.05, x: -0.03, hips: -0.02, lean: -3, bend: 8, nod: 10, head: -10, shR: 0.4, shL: 0.4, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: HUG_R, l: HUG_L, ...OPEN }],
      [2, { y: -0.02, x: 0.03, hips: 0.025, lean: 4, bend: -2, nod: -4, turn: 20, head: 4, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], pitchL: 20, r: at(1, 0.42, 0.94, 0.14, E_DOWN), l: at(-1, -0.02, 0.72, 0.17, E_OUT), ...OPEN }],
      [3, { y: -0.01, x: 0.035, hips: 0.03, lean: 5, nod: -6, turn: 24, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], pitchL: 25, r: at(1, 0.44, 0.98, 0.16, E_DOWN), l: at(-1, -0.02, 0.72, 0.17, E_OUT), handR: 0.8, handL: 1 }],
    ],
  }),
  full({
    id: 'offering-hands', name: 'Offering Hands', tags: 'pop | arms | hands', beats: 4, level: 'low', d: 1, parts: ['arms'], bounce: 0.15,
    desc: 'Both hands crossed over the heart, then float them forward and up as if offering something, open them wide toward the sky, and let them drift down.',
    keys: [
      [0, { y: -0.04, nod: 9, head: 4, r: at(1, -0.01, 0.72, 0.17, E_OUT), l: at(-1, 0.02, 0.69, 0.19, E_OUT), ...OPEN }],
      [1.5, { y: -0.02, nod: -4, r: at(1, 0.13, 0.86, 0.29, [0.6, -0.8, 0]), l: at(-1, -0.13, 0.86, 0.29, [0.6, -0.8, 0]), ...OPEN }],
      [2.5, { y: 0, nod: -10, bend: -3, ...TOES, r: at(1, 0.3, 0.98, 0.2, E_DOWN), l: at(-1, -0.3, 0.98, 0.2, E_DOWN), ...OPEN }],
      [3.5, { y: -0.05, nod: 2, r: [34, 10, 40, 20], l: [34, 10, 40, 20], ...OPEN }],
    ],
  }),
  full({
    id: 'gather-open', name: 'Gather In & Open Out', tags: 'pop | arms full |', beats: 4, level: 'low', d: 1, parts: ['arms', 'torso'], bounce: 0.1,
    desc: 'From arms open wide, scoop everything in: wrists cross at the chest, the back rounds and the knees soften; hold it, then rise onto the toes and open out into a wide high V.',
    keys: [
      [0, { y: -0.02, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], nod: -2, r: SECOND, l: SECOND, ...OPEN }],
      [1, { y: -0.05, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], bend: 10, nod: 12, shR: 0.4, shL: 0.4, r: at(1, -0.05, 0.72, 0.2, [1, -0.4, 0]), l: at(-1, 0.05, 0.7, 0.23, [1, -0.4, 0]), handR: 0.6, handL: 0.6 }],
      [2, { y: -0.06, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], bend: 13, nod: 14, shR: 0.5, shL: 0.5, r: at(1, -0.05, 0.7, 0.19, [1, -0.4, 0]), l: at(-1, 0.05, 0.68, 0.22, [1, -0.4, 0]), handR: 0.4, handL: 0.4 }],
      [3, { y: -0.01, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], bend: -6, nod: -10, ...TOES, r: HIGH_V, l: HIGH_V, ...OPEN }],
    ],
  }),
  full({
    id: 'spine-roll-up', name: 'Spine Roll & Open', tags: 'pop | full | wave', beats: 4, level: 'low', d: 2, parts: ['torso', 'legs', 'arms'], bounce: 0.1,
    desc: 'Start curled forward over soft knees, head hanging and arms dangling by the knees, then roll up through the body: knees, hips, chest and finally the head, the arms floating up the middle and opening high.',
    // A roll is a side-view motion, so from the front it is shown as a sequence that travels
    // a long way up the screen: the knees straighten first (the body rises while the head and
    // the dangling hands stay low), then the chest lifts and the shoulders roll back, then the
    // head comes up last as the hands float up the middle and open.
    keys: [
      [0, { y: -0.13, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.12, kneeL: 0.12, bend: 24, nod: 22, shR: 0.6, shL: 0.6, r: at(1, 0.09, 0.4, 0.2, E_DOWN), l: at(-1, -0.09, 0.4, 0.2, E_DOWN), handR: 0.7, handL: 0.7 }],
      [1, { y: -0.05, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.04, kneeL: 0.04, bend: 20, nod: 20, shR: 0.5, shL: 0.5, r: at(1, 0.08, 0.46, 0.22, E_DOWN), l: at(-1, -0.08, 0.46, 0.22, E_DOWN), handR: 0.7, handL: 0.7 }],
      [2, { y: -0.03, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], bend: 4, nod: 16, shR: 0.1, shL: 0.1, r: at(1, 0.05, 0.72, 0.24, E_OUT), l: at(-1, -0.05, 0.72, 0.24, E_OUT), ...OPEN }],
      [3, { y: -0.005, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], bend: -4, nod: -10, pitchR: 20, pitchL: 20, r: HIGH_V, l: HIGH_V, ...OPEN }],
    ],
  }),

  // --- Mid: travelling flow, bigger range ------------------------------------
  full({
    id: 'opening-walk', name: 'Walk & Open', tags: 'pop | legs arms | walk', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.24, bounce: 0.1,
    desc: 'Walk slowly to the side, side, cross in front, side, touch, while the arms open from crossed low in front, through the chest, out wide and up, the chest lifting.',
    keys: [
      [0, { x: 0.05, y: -0.06, rf: [0.19, 0, 0], lf: [-0.09, 0, 0], twist: -6, nod: 6, r: at(1, -0.03, 0.56, 0.2, E_OUT), l: at(-1, 0.03, 0.58, 0.22, E_OUT), ...OPEN }],
      [1, { x: 0.13, y: -0.04, rf: [0.19, 0, 0], lf: [0.23, 0, 0.08], twist: -10, turn: 8, r: FIRST_R, l: FIRST_L, ...OPEN }],
      [2, { x: 0.21, y: -0.07, rf: [0.33, 0, 0], lf: [0.23, 0, 0.08], turn: 18, nod: -4, r: SECOND, l: [70, 20, 76, 30], ...OPEN }],
      [3, { x: 0.24, y: -0.02, rf: [0.33, 0, 0], lf: [0.2, 0, 0.02], pitchL: 30, turn: 22, nod: -8, r: [128, 6, 134, 10], l: [112, 10, 118, 14], ...OPEN }],
    ],
  }),
  full({
    id: 'reach-recover', name: 'Reach & Recover', tags: 'pop | full |', beats: 4, level: 'mid', d: 1, parts: ['legs', 'arms', 'torso'], mirror: true, bounce: 0.1,
    desc: 'Step out into a soft lunge and stretch one long line from the low back hand to the high front hand, rise onto the back toe to hang there, then pull back to the middle with the chest curled in.',
    keys: [
      [0, { y: -0.05, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], bend: 6, nod: 8, r: BAS_R, l: BAS_L, ...OPEN }],
      [1, { x: 0.07, y: -0.1, hips: 0.02, lean: 9, turn: 20, nod: -6, rf: [0.28, 0, 0.03], lf: [-0.1, 0, 0], r: at(1, 0.4, 1.04, 0.12, E_DOWN), l: at(-1, -0.36, 0.52, 0.06, [1, 0, -0.3]), ...OPEN }],
      [2, { x: 0.09, y: -0.07, hips: 0.03, lean: 12, turn: 24, nod: -9, rf: [0.28, 0, 0.03], lf: [-0.1, 0, 0], pitchL: 30, r: at(1, 0.44, 1.07, 0.1, E_DOWN), l: at(-1, -0.39, 0.5, 0.04, [1, 0, -0.3]), ...OPEN }],
      [3, { x: 0.02, y: -0.07, bend: 12, nod: 12, shR: 0.4, shL: 0.4, rf: [0.12, 0, 0], lf: [-0.1, 0, 0], r: at(1, 0.06, 0.66, 0.22, E_OUT), l: at(-1, -0.06, 0.66, 0.22, E_OUT), handR: 0.6, handL: 0.6 }],
    ],
  }),
  full({
    id: 'swing-suspend', name: 'Swing & Suspend', tags: 'pop | full |', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true, bounce: 0.1,
    desc: 'Both arms high to one side, swing them down through a deep knee bend with the body folding, up to the other side onto the toes, and hang there for a beat before swinging back.',
    keys: [
      [0, { x: 0.04, hips: 0.03, y: -0.01, lean: 10, head: 6, nod: -6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchL: 30, r: [150, 0, 156, 0], l: [170, 4, 174, 6], ...OPEN }],
      [1, { x: 0, y: -0.15, bend: 24, nod: 14, rf: [0.14, 0, 0], lf: [-0.14, 0, 0], kneeR: 0.15, kneeL: 0.15, r: at(1, 0.05, 0.52, 0.27, E_OUT), l: at(-1, -0.05, 0.52, 0.27, E_OUT), ...OPEN }],
      [2, mir({ x: 0.04, hips: 0.03, y: -0.01, lean: 10, head: 6, nod: -6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchL: 30, r: [150, 0, 156, 0], l: [170, 4, 174, 6], ...OPEN })],
      [3, mir({ x: 0.045, hips: 0.035, y: 0, lean: 12, head: 8, nod: -8, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchL: 35, r: [154, 0, 160, 0], l: [172, 4, 176, 6], ...OPEN })],
    ],
  }),
  full({
    id: 'fall-recover', name: 'Fall & Recover', tags: 'pop | full |', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true, bounce: 0.1,
    desc: 'Rise onto the toes with the arms overhead and tip sideways until you have to catch yourself with a big step into a lunge, arms swinging down and out, then pull back up to the middle.',
    keys: [
      [0, { y: 0, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], ...TOES, nod: -8, r: FIFTH_R, l: FIFTH_L, ...OPEN }],
      [1, { y: 0, x: 0.03, lean: 9, head: 6, nod: -6, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], ...TOES, r: FIFTH_R, l: FIFTH_L, ...OPEN }],
      [2, { x: 0.1, y: -0.15, hips: 0.02, lean: 13, head: 8, nod: 12, rf: [0.31, 0, 0.04], lf: [-0.06, 0, 0], kneeR: 0.2, r: at(1, 0.36, 0.4, 0.16, [1, 0, -0.3]), l: [128, -10, 134, -16], ...OPEN }],
      [3, { x: 0.02, y: -0.07, bend: 10, nod: 10, rf: [0.12, 0, 0], lf: [-0.06, 0, 0], r: FIRST_R, l: FIRST_L, ...OPEN }],
    ],
  }),
  full({
    id: 'spiral-turn', name: 'Slow Spiral Turn', tags: 'pop | turn arms | spin', beats: 4, level: 'mid', d: 2, parts: ['turn', 'arms'], mirror: true, bounce: 0.05,
    desc: 'Wind the arms low across the body, then turn slowly all the way round on the balls of the feet as the arms unwind up through the chest to overhead and open out to the sides.',
    keys: [
      [0, { y: -0.07, rf: [0.055, 0, 0], lf: [-0.055, 0, 0], kneeR: 0.1, kneeL: 0.1, spin: 0, twist: -16, nod: 6, r: at(1, -0.08, 0.58, 0.22, E_OUT), l: at(-1, -0.02, 0.64, 0.25, E_OUT), ...OPEN }],
      [1, { y: -0.03, rf: [0.055, 0, 0], lf: [-0.055, 0, 0], pitchR: 20, pitchL: 20, spin: 110, twist: -4, r: FIRST_R, l: FIRST_L, ...OPEN }],
      [2, { y: -0.01, rf: [0.055, 0, 0], lf: [-0.055, 0, 0], pitchR: 25, pitchL: 25, spin: 220, nod: -8, r: FIFTH_R, l: FIFTH_L, ...OPEN }],
      [3, { y: -0.04, rf: [0.055, 0, 0], lf: [-0.055, 0, 0], pitchR: 15, pitchL: 15, spin: 320, r: SECOND, l: SECOND, ...OPEN }],
    ],
  }),
  full({
    id: 'arcing-lunge', name: 'Side Lunge & Arcing Arm', tags: 'pop aerobic | legs arms |', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true, bounce: 0.1,
    desc: 'From a wide stance, sink slowly into one bent knee as the far arm sweeps out, up and over the head toward the lunge and the near hand slides down toward the shin; draw the arm back down across the body as you rise.',
    keys: [
      [0, { y: -0.05, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], nod: 4, r: [28, 0, 32, 8], l: [28, 0, 32, 8], ...OPEN }],
      [1, { x: 0.05, y: -0.1, hips: 0.01, lean: 4, turn: 10, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.2, r: at(1, 0.3, 0.5, 0.14, [1, 0, -0.3]), l: [112, 0, 118, 4], ...OPEN }],
      [2, { x: 0.09, y: -0.17, hips: 0.02, lean: 18, head: 8, nod: 2, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], kneeR: 0.25, r: at(1, 0.34, 0.42, 0.12, [1, 0, -0.3]), l: [166, 0, 192, 0], ...OPEN }],
      [3, { x: 0.03, y: -0.08, lean: 4, nod: 6, rf: [0.22, 0, 0], lf: [-0.22, 0, 0], r: at(1, 0.2, 0.62, 0.2, E_OUT), l: at(-1, 0.12, 0.76, 0.26, [1, -0.4, 0]), ...OPEN }],
    ],
  }),

  // --- High: deep, sustained, big range (Hard) -------------------------------
  full({
    id: 'lunge-sweep-rise', name: 'Lunge Sweep & Rise', tags: 'pop aerobic | full |', beats: 4, level: 'high', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true, bounce: 0.05,
    desc: 'In a deep wide lunge, sweep both hands low across the floor from one foot to the other through a deep bend, then rise out of the lunge and reach both arms high on that side.',
    keys: [
      [0, { x: -0.1, y: -0.22, hips: -0.02, bend: 22, lean: -10, nod: 10, rf: [0.27, 0, 0], lf: [-0.27, 0, 0], kneeL: 0.25, r: at(1, -0.12, 0.48, 0.24, E_OUT), l: at(-1, -0.34, 0.45, 0.16, [1, 0, -0.3]), ...OPEN }],
      [1, { x: 0, y: -0.25, bend: 26, nod: 12, rf: [0.27, 0, 0], lf: [-0.27, 0, 0], kneeR: 0.3, kneeL: 0.3, r: at(1, 0.1, 0.45, 0.28, E_OUT), l: at(-1, -0.1, 0.45, 0.28, E_OUT), ...OPEN }],
      [2, { x: 0.1, y: -0.22, hips: 0.02, bend: 22, lean: 10, nod: 10, rf: [0.27, 0, 0], lf: [-0.27, 0, 0], kneeR: 0.25, r: at(1, 0.34, 0.45, 0.16, [1, 0, -0.3]), l: at(-1, 0.12, 0.48, 0.24, E_OUT), ...OPEN }],
      [3, { x: 0.1, y: -0.09, hips: 0.03, lean: 8, nod: -10, turn: 16, rf: [0.27, 0, 0], lf: [-0.27, 0, 0], pitchL: 30, r: [150, 0, 156, 0], l: [164, 0, 182, 0], ...OPEN }],
    ],
  }),
  full({
    id: 'grand-plie', name: 'Grand Plié & Port de Bras', tags: 'pop aerobic | legs arms |', beats: 4, level: 'high', d: 2, parts: ['legs', 'arms'], bounce: 0,
    desc: 'Wide, turned-out second position with the arms open: bend slowly into a deep plié as the arms sweep down and gather low, then rise as they lift through the chest to overhead and open again.',
    keys: [
      [0, { y: -0.05, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], kneeR: 0.5, kneeL: 0.5, nod: -2, r: SECOND, l: SECOND, ...OPEN }],
      [1.5, { y: -0.25, bend: 5, nod: 10, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], kneeR: 0.55, kneeL: 0.55, r: at(1, 0.05, 0.6, 0.2, [1, -0.2, 0]), l: at(-1, -0.05, 0.6, 0.2, [1, -0.2, 0]), ...OPEN }],
      [2.5, { y: -0.13, nod: 2, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], kneeR: 0.5, kneeL: 0.5, r: at(1, 0.06, 0.74, 0.24, [1, -0.2, 0]), l: at(-1, -0.06, 0.74, 0.24, [1, -0.2, 0]), ...OPEN }],
      [3.5, { y: -0.04, nod: -9, rf: [0.21, 0, 0], lf: [-0.21, 0, 0], kneeR: 0.5, kneeL: 0.5, r: FIFTH_R, l: FIFTH_L, ...OPEN }],
    ],
  }),
  full({
    id: 'developpe-side', name: 'Développé to the Side', tags: 'pop | legs arms |', beats: 4, level: 'high', d: 3, parts: ['legs', 'arms'], mirror: true, bounce: 0,
    desc: 'Draw one foot up the standing leg to the knee as the arms come to the chest, unfold the leg slowly out to the side as the arms open, hold it there, then lower it to a pointed toe and close.',
    keys: [
      [0, { y: -0.04, rf: [0.06, 0, 0], lf: [-0.06, 0, 0], kneeR: 0.3, kneeL: 0.3, nod: 4, r: BAS_R, l: BAS_L, ...OPEN }],
      [1, { y: -0.01, x: -0.03, hips: -0.02, rf: [0.02, 0.24, 0.06], lf: [-0.06, 0, 0], kneeR: 0.7, r: FIRST_R, l: FIRST_L, ...OPEN }],
      [2, { y: 0, x: -0.05, hips: -0.025, lean: -5, nod: -4, turn: 10, rf: [0.46, 0.3, 0.05], lf: [-0.06, 0, 0], kneeR: 0.3, r: SECOND, l: SECOND, ...OPEN }],
      [2.75, { y: 0, x: -0.05, hips: -0.025, lean: -6, nod: -6, turn: 12, rf: [0.47, 0.31, 0.05], lf: [-0.06, 0, 0], kneeR: 0.3, r: [96, 8, 102, 14], l: [96, 8, 102, 14], ...OPEN }],
      [3.5, { y: -0.03, x: -0.02, rf: [0.26, 0, 0.03], lf: [-0.06, 0, 0], pitchR: 40, r: [50, 10, 56, 18], l: [50, 10, 56, 18], ...OPEN }],
    ],
  }),
  full({
    id: 'side-tilt', name: 'Side Tilt', tags: 'pop | full |', beats: 4, level: 'high', d: 3, parts: ['legs', 'arms', 'torso'], mirror: true, bounce: 0,
    desc: 'Gather in a soft knee bend, lift one knee, then tip the whole body away as that leg extends out to the side, arms long in a T so you make one tilted line; hold, then lower.',
    keys: [
      [0, { y: -0.06, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.1, kneeL: 0.1, bend: 6, nod: 6, r: at(1, -0.04, 0.58, 0.2, E_OUT), l: at(-1, 0.04, 0.6, 0.22, E_OUT), ...OPEN }],
      [1, { y: -0.02, x: -0.03, hips: -0.02, lean: -10, rf: [0.14, 0.18, 0.08], lf: [-0.07, 0, 0], kneeR: 0.5, r: [70, 10, 76, 16], l: [70, 10, 76, 16], ...OPEN }],
      [2, { y: -0.02, x: -0.06, hips: -0.03, lean: -24, head: -10, rf: [0.48, 0.48, 0.02], lf: [-0.07, 0, 0], kneeR: 0.3, r: [96, 0, 100, 0], l: [96, 0, 100, 0], ...OPEN }],
      [2.75, { y: -0.02, x: -0.06, hips: -0.03, lean: -26, head: -12, rf: [0.48, 0.5, 0.02], lf: [-0.07, 0, 0], kneeR: 0.3, r: [100, 0, 104, 0], l: [94, 0, 98, 0], ...OPEN }],
    ],
  }),
  full({
    id: 'spiral-sink', name: 'Spiral Down & Up', tags: 'pop | full | twist', beats: 4, level: 'high', d: 2, parts: ['legs', 'torso', 'arms'], mirror: true, bounce: 0,
    desc: 'Arms overhead, twist the chest to one side and spiral down low with the arms wrapping around the body, then unwind and rise with the arms opening out wide.',
    keys: [
      [0, { y: -0.01, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], nod: -8, r: FIFTH_R, l: FIFTH_L, ...OPEN }],
      [1, { y: -0.12, twist: 26, hipTwist: 10, turn: 14, nod: 4, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.1, kneeL: -0.1, r: at(1, 0.3, 0.6, -0.04, [0.6, -0.3, -0.6]), l: at(-1, 0.1, 0.62, 0.3, [0.3, -1, 0.3]), ...OPEN }],
      [2, { y: -0.23, twist: 38, hipTwist: 14, bend: 18, turn: 20, nod: 12, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.15, kneeL: -0.15, r: at(1, 0.3, 0.52, -0.06, [0.6, -0.3, -0.6]), l: at(-1, 0.12, 0.52, 0.3, [0.3, -1, 0.3]), ...OPEN }],
      [3, { y: -0.08, twist: 8, nod: -2, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], r: [100, 6, 106, 12], l: [100, 6, 106, 12], ...OPEN }],
    ],
  }),
];

// ---------------------------------------------------------------------------
// Metal

// Staged big: the whole body swings well over each foot, the hanging fists swinging with it.
const DOOM_A: PoseSpec = { x: 0.075, hips: 0.045, tilt: 6, y: -0.13, bend: 12, lean: 13, head: 10, nod: 16, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.2, r: at(1, 0.3, 0.42, 0.1, [1, 0, -0.3]), l: at(-1, 0.06, 0.46, 0.22, E_DOWN), ...FIST };
const DOOM_B: PoseSpec = { x: 0.05, hips: 0.03, tilt: 4, y: -0.1, bend: 8, lean: 8, head: 5, nod: 2, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.12, r: at(1, 0.26, 0.45, 0.1, [1, 0, -0.3]), l: at(-1, 0.0, 0.5, 0.22, E_DOWN), ...FIST };
const STOMP_A: PoseSpec = { y: -0.13, bend: 12, nod: 12, rf: [0.2, 0, 0.03], lf: [-0.15, 0, 0], kneeR: 0.15, kneeL: 0.15, r: at(1, 0.1, 0.58, 0.26, [1, -0.4, 0]), l: at(-1, -0.18, 0.8, 0.14, E_DOWN), ...FIST };
const STOMP_B: PoseSpec = { y: -0.04, bend: 0, nod: -6, rf: [0.17, 0, 0.02], lf: [-0.15, 0.13, 0.06], kneeL: 0.2, r: at(1, 0.2, 0.8, 0.12, E_DOWN), l: at(-1, -0.22, 1.08, 0.08, [1, 0.2, -0.2]), ...FIST };

const metal: MoveDef[] = [
  full({
    id: 'horns-to-crowd', name: 'Horns to the Crowd', tags: 'rock | arms |', beats: 1, level: 'low', d: 1, parts: ['arms', 'legs'], bounce: 0.3,
    desc: 'Wide stance, knees chugging on the beat; throw both hands up and out toward the stage in the horns on every beat with a small nod, pulling them back to the shoulders in between.',
    keys: [
      [0, { y: -0.1, bend: 5, nod: 10, rf: [0.19, 0, 0], lf: [-0.19, 0, 0], kneeR: 0.12, kneeL: 0.12, r: at(1, 0.2, 1.08, 0.18, [1, -0.4, 0]), l: at(-1, -0.2, 1.08, 0.18, [1, -0.4, 0]), ...HORNS }],
      [0.5, { y: -0.055, nod: -3, rf: [0.19, 0, 0], lf: [-0.19, 0, 0], r: at(1, 0.16, 0.84, 0.17, [1, -0.6, 0]), l: at(-1, -0.16, 0.84, 0.17, [1, -0.6, 0]), ...HORNS }],
    ],
  }),
  full({
    id: 'doom-sway', name: 'Doom Sway', tags: 'rock | full |', beats: 4, level: 'low', d: 1, parts: ['torso', 'hips'], bounce: 0.1,
    desc: 'Slow and heavy: bent over in a wide stance, sway the whole body from side to side with the arms hanging and swinging like weights, the head dropping on every other beat.',
    keys: [[0, DOOM_A], [1, DOOM_B], [2, mir(DOOM_A)], [3, mir(DOOM_B)]],
  }),
  full({
    id: 'hammer-stomp', name: 'Hammer Stomp', tags: 'rock | full | stomp', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'On the half-time beat, stomp one foot and hammer the same fist down in front as the chest bows; lift the other knee and raise its fist ready for the next one.',
    keys: [[0, STOMP_A], [1, STOMP_B]],
  }),
  full({
    id: 'arms-out-lean-back', name: 'Arms-Out Lean Back', tags: 'rock | full |', beats: 4, level: 'mid', d: 1, parts: ['torso', 'arms'], bounce: 0.1,
    desc: 'Crunch down over the fists in a wide stance, then fling the arms out wide and lean back with the face up as if the wall of sound hits you; hold it and come back down.',
    keys: [
      [0, { y: -0.14, bend: 16, nod: 14, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.15, kneeL: 0.15, r: at(1, 0.06, 0.6, 0.24, [1, -0.4, 0]), l: at(-1, -0.06, 0.6, 0.24, [1, -0.4, 0]), ...FIST }],
      [1, { y: -0.06, bend: -10, nod: -14, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], r: [96, -12, 100, -20], l: [96, -12, 100, -20], ...OPEN }],
      [2, { y: -0.07, bend: -12, nod: -16, shR: 0.3, shL: 0.3, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], r: [100, -14, 104, -22], l: [100, -14, 104, -22], ...OPEN }],
      [3, { y: -0.1, bend: 4, nod: 4, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], r: [60, 0, 64, 6], l: [60, 0, 64, 6], ...FIST }],
    ],
  }),
  full({
    id: 'wall-of-death', name: 'Wall of Death Crouch', tags: 'rock aerobic | legs full |', beats: 4, level: 'high', d: 2, parts: ['legs', 'arms'], impact: true, bounce: 0.2,
    desc: 'Crouch low and wide with the arms spread, bouncing as you wait for the drop, then spring up tall with both fists thrown high.',
    keys: [
      [0, { y: -0.22, bend: 20, nod: 6, rf: [0.22, 0, 0.02], lf: [-0.22, 0, -0.02], kneeR: 0.2, kneeL: 0.2, r: at(1, 0.3, 0.62, 0.2, E_OUT), l: at(-1, -0.3, 0.62, 0.2, E_OUT), ...FIST }],
      [1, { y: -0.18, bend: 16, nod: 2, rf: [0.22, 0, 0.02], lf: [-0.22, 0, -0.02], kneeR: 0.2, kneeL: 0.2, r: at(1, 0.31, 0.66, 0.18, E_OUT), l: at(-1, -0.31, 0.66, 0.18, E_OUT), ...FIST }],
      [2, { y: -0.23, bend: 20, nod: 8, rf: [0.22, 0, 0.02], lf: [-0.22, 0, -0.02], kneeR: 0.2, kneeL: 0.2, r: at(1, 0.3, 0.6, 0.2, E_OUT), l: at(-1, -0.3, 0.6, 0.2, E_OUT), ...FIST }],
      [3, { y: -0.03, bend: -4, nod: -10, rf: [0.22, 0, 0.02], lf: [-0.22, 0, -0.02], r: [160, 10, 166, 14], l: [160, 10, 166, 14], ...FIST }],
    ],
  }),
  full({
    id: 'circle-pit-call', name: 'Circle Pit Call', tags: 'rock | arms | point', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true, bounce: 0.3,
    desc: 'Bouncing in a wide stance, raise one index finger high and stir it round in a circle over your head to call the pit, the other fist at the chest.',
    // The stirring circle is drawn in the front plane above the head (radius 0.12): a flat
    // horizontal circle showed as a wave from the front.
    keys: [0, 1, 2, 3].map((k) => {
      const a = (k * Math.PI) / 2;
      return [k / 2, {
        y: k % 2 ? -0.05 : -0.08, nod: k % 2 ? 0 : 4, rf: [0.17, 0, 0], lf: [-0.17, 0, 0],
        r: at(1, 0.15 + 0.12 * Math.cos(a), 1.0 + 0.08 * Math.sin(a), 0.06 - 0.06 * Math.sin(a), [1, 0.6, 0]),
        l: at(-1, -0.12, 0.72, 0.18, E_DOWN), handR: 0, handL: 0, formR: 'point',
      }] as [number, PoseSpec];
    }),
  }),
];

// ---------------------------------------------------------------------------
// Punk

const SLAM_A: PoseSpec = { y: 0.07, x: 0.06, lean: 14, twist: -12, shR: 1.0, rf: [0.14, 0.05, 0], lf: [-0.02, 0.06, 0], r: at(1, 0.26, 0.74, 0.12, [1, 0.4, 0]), l: [30, 0, 60, 30], ...FIST };
const CHANGE_A: PoseSpec = { y: -0.2, x: 0.04, hips: 0.02, bend: 30, nod: 8, rf: [0.18, 0, 0.04], lf: [-0.14, 0, 0], kneeR: 0.2, kneeL: 0.1, r: at(1, 0.24, 0.48, 0.28, [1, -0.2, 0]), l: [30, -20, 46, -10], handR: 1, handL: 0 };
const CHANGE_B: PoseSpec = { y: -0.11, x: 0, bend: 16, nod: 4, rf: [0.16, 0, 0.02], lf: [-0.16, 0, 0.02], r: at(1, 0.12, 0.66, 0.22, E_DOWN), l: at(-1, -0.12, 0.6, 0.2, E_DOWN), ...FIST };
// The kick across goes well past the other foot and a little up, so the cross shows head-on.
const SKANK_X: PoseSpec = { y: -0.08, bend: 8, nod: 4, lean: -4, rf: [-0.09, 0.06, 0.07], lf: [-0.09, 0, 0], kneeR: -0.2, pitchR: -10, r: at(1, 0.22, 0.62, -0.08, [0.5, -0.3, -1]), l: at(-1, -0.1, 0.82, 0.24, E_DOWN), ...FIST };
const SKANK_O: PoseSpec = { y: -0.03, bend: 4, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.18, 0.7, 0.1, E_DOWN), l: at(-1, -0.18, 0.7, 0.1, E_DOWN), ...FIST };

/** Arms draped over the shoulders of the people either side (the sing-along sway). */
const DRAPE_R = at(1, 0.4, 0.74, 0.06, [1, 0.6, -0.2]);
const DRAPE_L = at(-1, -0.4, 0.74, 0.06, [1, 0.6, -0.2]);
const ARMSWAY_A: PoseSpec = { y: -0.05, x: 0.04, hips: 0.035, tilt: 4, lean: 8, head: 5, nod: -8, rf: [0.13, 0, 0], lf: [-0.13, 0.015, 0], kneeL: 0.08, r: DRAPE_R, l: DRAPE_L, handR: 0.5, handL: 0.5 };

const punk: MoveDef[] = [
  full({
    id: 'grounded-pogo', name: 'Grounded Pogo', tags: 'rock | legs |', beats: 1, level: 'low', d: 1, parts: ['legs', 'torso'], bounce: 0.2,
    desc: 'The pogo without leaving the floor: body stiff and upright with the fists crossed over the chest, spring up onto the balls of the feet on every beat and drop back onto the heels, the head nodding down hard.',
    keys: [
      [0, { y: 0.01, nod: -8, shR: 0.6, shL: 0.6, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], pitchR: 40, pitchL: 40, r: at(1, -0.06, 0.72, 0.17, [0.6, -1, 0]), l: at(-1, 0.06, 0.69, 0.2, [0.6, -1, 0]), ...FIST }],
      [0.5, { y: -0.085, nod: 14, shR: 0.1, shL: 0.1, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.06, kneeL: 0.06, r: at(1, -0.06, 0.7, 0.17, [0.6, -1, 0]), l: at(-1, 0.06, 0.67, 0.2, [0.6, -1, 0]), ...FIST }],
    ],
  }),
  full({
    id: 'arm-in-arm-sway', name: 'Arm-in-Arm Sway', tags: 'rock | arms hips | wave', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips', 'torso'], bounce: 0.2,
    desc: 'The sing-along sway: arms out and draped over the shoulders of the people either side, chin up and singing, sway slowly from side to side with the whole row, two beats each way.',
    keys: [[0, ARMSWAY_A], [1, { ...ARMSWAY_A, y: -0.04, lean: 7 }], [2, mir(ARMSWAY_A)], [3, mir({ ...ARMSWAY_A, y: -0.04, lean: 7 })]],
  }),
  full({
    id: 'shout-along-bounce', name: 'Shout-Along Bounce', tags: 'rock | arms | punch', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true, bounce: 0.4,
    desc: 'Bounce on the balls of the feet, one hand cupped at the mouth shouting the chorus, the other fist punching the air on every beat.',
    keys: [
      [0, { y: -0.07, nod: -10, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: [168, 8, 174, 8], l: at(-1, -0.05, 0.88, 0.15, [1, -0.2, 0]), handR: 0, handL: 0.7 }],
      [0.5, { y: -0.02, nod: -4, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], ...TOES, r: at(1, 0.2, 0.88, 0.1, E_DOWN), l: at(-1, -0.05, 0.88, 0.15, [1, -0.2, 0]), handR: 0, handL: 0.7 }],
      [1, { y: -0.07, nod: -10, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], r: [168, 8, 174, 8], l: at(-1, -0.05, 0.88, 0.15, [1, -0.2, 0]), handR: 0, handL: 0.7 }],
      [1.5, { y: -0.02, nod: -4, rf: [0.08, 0, 0], lf: [-0.08, 0, 0], ...TOES, r: at(1, 0.2, 0.88, 0.1, E_DOWN), l: at(-1, -0.05, 0.88, 0.15, [1, -0.2, 0]), handR: 0, handL: 0.7 }],
    ],
  }),
  full({
    id: 'slam-bump', name: 'Slam Dance Bump', tags: 'rock | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'arms', 'torso'], mirror: true, jump: true, impact: true,
    desc: 'Dip, then hop sideways throwing one shoulder and elbow out as if bumping into the crowd, land, and bounce back to the middle; switch sides.',
    keys: [
      [0, { y: -0.08, x: -0.02, bend: 6, rf: [0.08, 0, 0], lf: [-0.1, 0, 0], r: at(1, 0.16, 0.66, 0.14, E_DOWN), l: at(-1, -0.16, 0.66, 0.14, E_DOWN), ...FIST }],
      [0.5, SLAM_A],
      [1, { y: -0.09, x: 0.06, lean: 4, twist: -4, shR: 0.4, rf: [0.15, 0, 0], lf: [-0.03, 0, 0], r: at(1, 0.22, 0.7, 0.12, [1, 0.2, 0]), l: [30, 0, 60, 30], ...FIST }],
      [1.5, { y: -0.03, x: 0.02, rf: [0.11, 0, 0], lf: [-0.07, 0, 0], r: at(1, 0.16, 0.68, 0.14, E_DOWN), l: at(-1, -0.16, 0.68, 0.14, E_DOWN), ...FIST }],
    ],
  }),
  full({
    id: 'picking-up-change', name: 'Picking Up Change', tags: 'rock | full |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'], bounce: 0.2,
    desc: 'Hardcore floor move: bend low and sweep one hand down to the floor as if scooping up coins, come up a little, then sweep the other hand down on the other side.',
    keys: [[0, CHANGE_A], [0.5, CHANGE_B], [1, mir(CHANGE_A)], [1.5, CHANGE_B]],
  }),
  full({
    id: 'hardcore-windmill', name: 'Hardcore Windmill', tags: 'rock | arms full |', beats: 2, level: 'high', d: 2, parts: ['arms', 'legs'], bounce: 0.3,
    desc: 'Crouched and bent forward in a wide stance, swing both straight arms in big circles, up, forward, down and out at the side, one up while the other is down, the knees bouncing.',
    keys: [
      [0, { y: -0.15, bend: 16, nod: 6, twist: 8, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.15, kneeL: 0.15, r: [170, 6, 174, 6], l: [24, 10, 28, 10], ...FIST }],
      [0.5, { y: -0.11, bend: 14, nod: 2, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], r: [82, 66, 86, 76], l: [100, 6, 104, 6], ...FIST }],
      [1, { y: -0.15, bend: 16, nod: 6, twist: -8, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.15, kneeL: 0.15, r: [24, 10, 28, 10], l: [170, 6, 174, 6], ...FIST }],
      [1.5, { y: -0.11, bend: 14, nod: 2, rf: [0.2, 0, 0], lf: [-0.2, 0, 0], r: [100, 6, 104, 6], l: [82, 66, 86, 76], ...FIST }],
    ],
  }),
  full({
    id: 'cross-skank', name: 'Cross Skank', tags: 'rock | legs | kick', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], bounce: 0.3,
    desc: 'Ska skank crossing the feet: kick one foot across in front of the other on the beat, step back out, then the other, elbows bent and fists swinging like a runner.',
    keys: [[0, SKANK_X], [0.5, SKANK_O], [1, mir(SKANK_X)], [1.5, SKANK_O]],
  }),
];

// ---------------------------------------------------------------------------
// Brazil

const UMBRELLA_R = at(1, 0.2, 1.08, 0.06, [1, -0.4, 0]);
const SKIRT_R = at(1, 0.25, 0.52, 0.14, E_DOWN);
const SKIRT_L = at(-1, -0.25, 0.52, 0.14, E_DOWN);
const RODA_A: PoseSpec = { y: -0.06, x: 0.02, hips: 0.055, tilt: 8, kneeL: 0.15, bend: 8, nod: 4, rf: [0.1, 0, 0.03], lf: [-0.09, 0, -0.01], pitchL: 20, slideR: true, r: at(1, 0.27, 0.54, 0.12, E_DOWN), l: SKIRT_L, handR: 0.3, handL: 0.3 };
const RODA_B: PoseSpec = { y: -0.03, x: 0.0, hips: -0.015, tilt: -2, kneeL: 0, bend: 8, nod: 2, rf: [0.1, 0, 0.03], lf: [-0.08, 0, -0.02], pitchR: 20, r: SKIRT_R, l: SKIRT_L, handR: 0.3, handL: 0.3 };
const FRAME_R = at(1, 0.34, 0.9, 0.14, [0.6, -0.8, 0]);
const FRAME_L = at(-1, 0.04, 0.82, 0.28, [1, -0.3, 0]);
const SCISSOR_X: PoseSpec = { y: -0.1, rf: [-0.07, 0, 0.05], lf: [-0.1, 0, 0], kneeR: -0.25, kneeL: 0.1, ...TOES, lean: 3, r: UMBRELLA_R, l: at(-1, -0.38, 0.66, 0.1, E_DOWN), handR: 0, handL: 1 };
const SCISSOR_O: PoseSpec = { y: -0.06, rf: [0.16, 0, 0], lf: [-0.16, 0, 0], kneeR: 0.25, kneeL: 0.25, ...TOES, lean: 0, r: UMBRELLA_R, l: at(-1, -0.36, 0.7, 0.1, E_DOWN), handR: 0, handL: 1 };

const brazil: MoveDef[] = [
  full({
    id: 'samba-de-roda', name: 'Samba de Roda', tags: 'latin | legs hips | hips', beats: 1, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true, bounce: 0.2,
    desc: 'Leaning in a little with the hands holding a skirt out at the hips, tiny shuffling samba steps where the feet barely leave the floor, the hips swaying from side to side on every step.',
    keys: [[0, RODA_A], [0.5, RODA_B]],
  }),
  full({
    id: 'samba-turn', name: 'Samba No Pé Turn', tags: 'latin | turn legs | spin hips', beats: 4, level: 'mid', d: 3, parts: ['turn', 'legs', 'hips'], bounce: 0.2,
    desc: 'Keep the quick samba step going, a step and a ball change on every beat with the hips swinging, while turning slowly all the way round, arms up in a high V with flicking wrists.',
    keys: [0, 1, 2, 3].flatMap((b) => {
      const s = b % 2 === 0 ? 1 : -1;
      const step: PoseSpec = { y: -0.06, hips: 0.03 * s, tilt: 4 * s, rf: [s > 0 ? 0.1 : 0.08, 0, s > 0 ? 0.04 : -0.02], lf: [s > 0 ? -0.08 : -0.1, 0, s > 0 ? -0.02 : 0.04], pitchR: 15, pitchL: 15, spin: b * 90, r: [146, 6, 158, 10], l: [146, 6, 158, 10], handR: 1, handL: 1 };
      const ball: PoseSpec = { y: -0.03, hips: -0.01 * s, tilt: -s, rf: [0.09, 0, 0.01], lf: [-0.09, 0, 0.01], pitchR: s > 0 ? 15 : 35, pitchL: s > 0 ? 35 : 15, spin: b * 90 + 60, r: [140, 6, 134, 10], l: [140, 6, 134, 10], handR: 0.8, handL: 0.8 };
      return [[b, step], [b + 0.75, ball]] as const;
    }),
  }),
  full({
    id: 'forro-basic', name: 'Forró Side Basic', tags: 'latin | legs hips | walk', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips'], mirror: true, travel: 0.1, bounce: 0.2,
    desc: 'Arms in a dance hold, step to the side, close, and step again with a soft bounce and a sway of the hips; then two to the other side.',
    keys: [
      [0, { x: 0.05, y: -0.07, hips: 0.03, tilt: 4, rf: [0.19, 0, 0], lf: [-0.09, 0, 0], turn: -10, r: FRAME_R, l: FRAME_L, ...OPEN }],
      [0.5, { x: 0.09, y: -0.03, hips: 0, rf: [0.19, 0, 0], lf: [0.1, 0, 0], pitchL: 25, turn: -10, r: FRAME_R, l: FRAME_L, ...OPEN }],
      [1, { x: 0.1, y: -0.07, hips: 0.03, tilt: 4, rf: [0.19, 0, 0], lf: [0.1, 0, 0], turn: -12, r: FRAME_R, l: FRAME_L, ...OPEN }],
      [1.5, { x: 0.1, y: -0.04, hips: 0.01, rf: [0.19, 0, 0], lf: [0.1, 0.02, 0.01], turn: -8, r: FRAME_R, l: FRAME_L, ...OPEN }],
    ],
  }),
  full({
    id: 'axe-wave-step', name: 'Axé Wave Step', tags: 'latin party | full | wave', beats: 2, level: 'mid', d: 1, parts: ['legs', 'arms', 'hips'], bounce: 0.4,
    desc: 'Bouncy step-touch from side to side with a swing of the hips while both arms wave overhead from one side to the other, carnival style.',
    keys: [
      [0, { x: 0.05, y: -0.08, hips: 0.04, tilt: 6, rf: [0.2, 0, 0], lf: [-0.04, 0, 0], lean: 6, r: [150, 0, 156, 0], l: [176, 6, 186, 10], ...OPEN }],
      [0.5, { x: 0.04, y: -0.03, hips: 0.02, rf: [0.2, 0, 0], lf: [0.07, 0.03, 0.02], lean: 2, r: [160, 0, 166, 0], l: [160, 0, 166, 0], ...OPEN }],
      [1, { x: -0.05, y: -0.08, hips: -0.04, tilt: -6, lf: [-0.2, 0, 0], rf: [0.04, 0, 0], lean: -6, l: [150, 0, 156, 0], r: [176, 6, 186, 10], ...OPEN }],
      [1.5, { x: -0.04, y: -0.03, hips: -0.02, lf: [-0.2, 0, 0], rf: [-0.07, 0.03, 0.02], lean: -2, r: [160, 0, 166, 0], l: [160, 0, 166, 0], ...OPEN }],
    ],
  }),
  full({
    id: 'descer-rebolando', name: 'Descer Rebolando', tags: 'latin | hips legs | hips', beats: 4, level: 'mid', d: 2, parts: ['hips', 'legs'], bounce: 0.1,
    desc: 'Go down swivelling: in a wide stance with one hand up, roll the hips from side to side as you sink lower on every beat, then come back up.',
    keys: [
      [0, { y: -0.05, x: 0.02, hips: 0.07, tilt: 9, lean: -3, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.2, kneeL: 0.2, r: at(1, 0.14, 1.04, 0.06, [1, 0.2, 0]), l: ARM.hip, handR: 1, handL: 0 }],
      [1, { y: -0.12, x: -0.02, hips: -0.07, tilt: -9, lean: 3, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.25, kneeL: 0.25, r: at(1, 0.14, 1.0, 0.08, [1, 0.2, 0]), l: ARM.hip, handR: 1, handL: 0 }],
      [2, { y: -0.2, x: 0.02, hips: 0.07, tilt: 9, lean: -3, bend: 8, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.3, kneeL: 0.3, r: at(1, 0.16, 0.96, 0.1, [1, 0.2, 0]), l: ARM.hip, handR: 1, handL: 0 }],
      [3, { y: -0.1, x: -0.02, hips: -0.06, tilt: -8, lean: 2, bend: 3, rf: [0.17, 0, 0], lf: [-0.17, 0, 0], kneeR: 0.2, kneeL: 0.2, r: at(1, 0.14, 1.02, 0.07, [1, 0.2, 0]), l: ARM.hip, handR: 1, handL: 0 }],
    ],
  }),
  full({
    id: 'frevo-scissors', name: 'Frevo Scissor Step', tags: 'latin party | legs |', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], bounce: 0.3,
    desc: 'On the balls of the feet with one fist up as if holding a little umbrella, cross one leg in front of the other, open both out wide with bent knees, then cross the other.',
    keys: [[0, SCISSOR_X], [0.5, SCISSOR_O], [1, mir({ ...SCISSOR_X, r: at(1, 0.38, 0.66, 0.1, E_DOWN), l: at(-1, -0.2, 1.08, 0.06, [1, -0.4, 0]), handR: 1, handL: 0 })], [1.5, SCISSOR_O]],
  }),
  full({
    id: 'passinho-tap', name: 'Passinho Tap & Swivel', tags: 'hiphop latin | legs |', beats: 2, level: 'mid', d: 3, parts: ['legs', 'hips'], mirror: true, bounce: 0.3,
    desc: 'Funk carioca footwork kept simple: turned a little toward the working foot, tap its toe out in front, flick it out wide to the side, then swivel both heels as the feet come back under you, shoulders loose.',
    // The tap in front is turned 30 deg toward the foot (head-on it hid in front of the shin);
    // the flick goes wide and the swivels point both knees well to one side, then the other.
    keys: [
      [0, { spin: 30, y: -0.06, x: -0.02, rf: [0.12, 0, 0.14], lf: [-0.09, 0, 0], pitchR: 40, kneeL: 0.15, twist: 6, r: at(1, 0.26, 0.66, 0.1, E_DOWN), l: at(-1, -0.2, 0.62, 0.16, E_DOWN), ...FIST }],
      [0.5, { spin: 10, y: -0.04, x: -0.03, rf: [0.28, 0.07, 0.02], lf: [-0.09, 0, 0], kneeR: 0.3, lean: -4, twist: -6, r: at(1, 0.3, 0.72, 0.08, E_DOWN), l: at(-1, -0.16, 0.66, 0.18, E_DOWN), ...FIST }],
      [1, { spin: 0, y: -0.09, x: 0.01, rf: [0.09, 0, 0], lf: [-0.07, 0, 0], kneeR: -0.4, kneeL: 0.4, slideR: true, slideL: true, hips: 0.03, tilt: 4, twist: 4, r: at(1, 0.2, 0.64, 0.14, E_DOWN), l: at(-1, -0.2, 0.64, 0.14, E_DOWN), ...FIST }],
      [1.5, { spin: 0, y: -0.06, x: -0.01, rf: [0.07, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.4, kneeL: -0.4, slideR: true, slideL: true, hips: -0.03, tilt: -4, twist: -4, r: at(1, 0.2, 0.66, 0.14, E_DOWN), l: at(-1, -0.2, 0.66, 0.14, E_DOWN), ...FIST }],
    ],
  }),
  full({
    id: 'frevo-squat', name: 'Frevo Knee Swivel', tags: 'latin party | legs |', beats: 2, level: 'high', d: 2, parts: ['legs'], impact: true, bounce: 0.2,
    desc: 'Squat low on the balls of the feet with the umbrella fist up, and swing both knees in and out on every half beat.',
    keys: [
      [0, { y: -0.18, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchR: 35, pitchL: 35, kneeR: 0.5, kneeL: 0.5, bend: 6, r: UMBRELLA_R, l: at(-1, -0.36, 0.62, 0.12, E_DOWN), handR: 0, handL: 1 }],
      [0.5, { y: -0.15, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchR: 35, pitchL: 35, kneeR: -0.3, kneeL: -0.3, bend: 4, r: UMBRELLA_R, l: at(-1, -0.34, 0.66, 0.12, E_DOWN), handR: 0, handL: 1 }],
      [1, { y: -0.18, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchR: 35, pitchL: 35, kneeR: 0.5, kneeL: 0.5, bend: 6, r: UMBRELLA_R, l: at(-1, -0.36, 0.62, 0.12, E_DOWN), handR: 0, handL: 1 }],
      [1.5, { y: -0.15, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], pitchR: 35, pitchL: 35, kneeR: -0.3, kneeL: -0.3, bend: 4, r: UMBRELLA_R, l: at(-1, -0.34, 0.66, 0.12, E_DOWN), handR: 0, handL: 1 }],
    ],
  }),
];

// ---------------------------------------------------------------------------
// Amapiano

// Fingers spread over the keys at the waist, elbows out, the hands a hand's width apart.
const PIANO = (x: number, y: number): PoseSpec => ({ r: at(1, x + 0.09, y, 0.2, [1, -0.3, -0.2]), l: at(-1, x - 0.09, y, 0.2, [1, -0.3, -0.2]), ...OPEN, formR: 'fingers', formL: 'fingers' });
const SHOULDER_A: PoseSpec = { y: -0.09, x: 0.02, hips: 0.015, chestX: 0.035, twist: -12, lean: 4, nod: 4, shR: 1.0, shL: 0, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, r: at(1, 0.2, 0.6, 0.18, E_DOWN), l: at(-1, -0.16, 0.56, 0.1, E_DOWN), handR: 0.5, handL: 0.5 };
const KNEE_A: PoseSpec = { y: -0.11, x: -0.02, hips: -0.03, tilt: -6, lean: 3, nod: 4, rf: [0.11, 0, 0.02], lf: [-0.11, 0, 0], kneeR: -0.45, kneeL: 0.1, pitchR: 20, r: at(1, -0.02, 0.6, 0.22, E_DOWN), l: at(-1, -0.28, 0.56, 0.06, E_DOWN), handR: 0.5, handL: 0.5 };

// Wide plié fist roll (the 2024 amapiano dance commonly called "Tshwala Bam", after the song):
// a wide, low, planted stance with the knees open over the toes, sinking on every beat, the fists
// churning round each other in front of the belly as the shoulders pop in turn. The real roll goes
// toward and away from the body; staged as a wheel in the front plane so it reads head-on.
const fistRoll = (k: number): PoseSpec => {
  const a = Math.PI / 2 - (k * Math.PI) / 2;
  const cx = 0.07, cy = 0.64, rad = 0.09; // 0.045 vanished at TV size
  const side: 1 | -1 = k % 2 ? -1 : 1;
  return {
    y: k % 2 ? -0.1 : -0.16, bend: 8, nod: k % 2 ? 3 : 6, twist: -9 * side, turn: -6 * side,
    shR: side > 0 ? 1.0 : 0.2, shL: side > 0 ? 0.2 : 1.0,
    rf: [0.2, 0, 0], lf: [-0.2, 0, 0], kneeR: 0.32, kneeL: 0.32,
    // Each fist circles on its own side, half a turn apart: they roll round each other.
    r: at(1, cx + rad * Math.cos(a), cy + rad * Math.sin(a), 0.19, [1, -0.1, -0.2]),
    l: at(-1, -cx - rad * Math.cos(a), cy - rad * Math.sin(a), 0.19, [1, -0.1, -0.2]), ...FIST,
  };
};

const amapiano: MoveDef[] = [
  full({
    id: 'log-drum-bounce', name: 'Log Drum Bounce', tags: 'hiphop | legs | amapiano', beats: 2, level: 'low', d: 1, parts: ['legs', 'torso'], bounce: 0.2,
    desc: 'Slow, heavy knee bounce: sink on the beat with the chest dropping, rebound a little, dip again on the log-drum hit just after, then come up loose.',
    keys: [
      [0, { y: -0.1, bend: 7, nod: 6, shR: 0.2, shL: 0.2, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.16, 0.58, 0.16, E_DOWN), l: at(-1, -0.16, 0.58, 0.16, E_DOWN), handR: 0.5, handL: 0.5 }],
      [0.5, { y: -0.07, bend: 4, nod: 2, shR: 0.4, shL: 0.4, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.06, kneeL: 0.06, r: at(1, 0.17, 0.6, 0.15, E_DOWN), l: at(-1, -0.17, 0.6, 0.15, E_DOWN), handR: 0.5, handL: 0.5 }],
      [0.75, { y: -0.11, bend: 9, nod: 8, shR: 0.1, shL: 0.1, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.12, kneeL: 0.12, r: at(1, 0.16, 0.55, 0.17, E_DOWN), l: at(-1, -0.16, 0.55, 0.17, E_DOWN), handR: 0.5, handL: 0.5 }],
      [1.5, { y: -0.03, bend: 1, nod: -3, shR: 0.6, shL: 0.6, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], r: at(1, 0.18, 0.62, 0.14, E_DOWN), l: at(-1, -0.18, 0.62, 0.14, E_DOWN), handR: 0.5, handL: 0.5 }],
    ],
  }),
  full({
    id: 'amapiano-shuffle', name: 'Amapiano Shuffle', tags: 'hiphop | legs | amapiano walk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.12, bounce: 0.3,
    desc: 'Laid-back slide to the side: one foot glides out, the other drags in to meet it, knees bouncing low and loose arms swinging the other way.',
    keys: [
      [0, { x: 0.05, y: -0.1, lean: -3, rf: [0.24, 0, 0], lf: [-0.09, 0, 0], slideR: true, kneeR: 0.15, r: at(1, 0.08, 0.6, 0.2, E_DOWN), l: at(-1, -0.3, 0.6, 0.04, E_DOWN), handR: 0.5, handL: 0.5 }],
      [0.5, { x: 0.07, y: -0.06, lean: -2, rf: [0.24, 0, 0], lf: [-0.07, 0, 0], r: at(1, 0.12, 0.62, 0.18, E_DOWN), l: at(-1, -0.26, 0.62, 0.06, E_DOWN), handR: 0.5, handL: 0.5 }],
      [1, { x: 0.12, y: -0.11, lean: 2, rf: [0.24, 0, 0], lf: [0.05, 0, 0], slideL: true, pitchL: 15, r: at(1, 0.3, 0.6, 0.04, E_DOWN), l: at(-1, -0.04, 0.6, 0.2, E_DOWN), handR: 0.5, handL: 0.5 }],
      [1.5, { x: 0.13, y: -0.06, rf: [0.23, 0, 0], lf: [0.03, 0, 0], r: at(1, 0.26, 0.62, 0.06, E_DOWN), l: at(-1, -0.08, 0.62, 0.18, E_DOWN), handR: 0.5, handL: 0.5 }],
    ],
  }),
  full({
    id: 'shoulder-groove', name: 'Shoulder-Led Groove', tags: 'hiphop | full | amapiano', beats: 2, level: 'low', d: 1, parts: ['torso', 'arms'], mirror: true, bounce: 0.3,
    desc: 'Let one shoulder lift and lead the chest forward to that side as the knees dip, elbows loose and trailing, then the other shoulder takes over.',
    keys: [[0, SHOULDER_A], [1, { ...SHOULDER_A, y: -0.05, chestX: 0.02, twist: -6, shR: 0.5, nod: 0 }]],
  }),
  full({
    id: 'low-squat-walk', name: 'Low Rocking Walk', tags: 'hiphop | legs | amapiano walk', beats: 4, level: 'high', d: 2, parts: ['legs', 'torso'], mirror: true, travel: 0.16, bounce: 0.2,
    desc: 'Sink low with the knees wide and walk slowly to the side in small steps, the upper body rocking over each foot, hands loose in front.',
    // Restaged bigger: each step lands wide with the whole body rocking over that foot (hips,
    // lean and head together) and the loose hands swinging the other way; it read as a held squat.
    keys: ([[0, 0.06, 0.25, -0.13, 1], [1, 0.09, 0.25, -0.01, -1], [2, 0.14, 0.33, -0.01, 1], [3, 0.17, 0.33, 0.07, -1]] as const).map(([t, x, r, l, s]) => [t, {
      x, y: s > 0 ? -0.18 : -0.15, lean: 11 * s, hips: 0.045 * s, tilt: 8 * s, head: 6 * s, bend: 9, nod: s > 0 ? 5 : 2,
      rf: [r, 0, 0], lf: [l, s < 0 ? 0.04 : 0, 0], kneeR: 0.32, kneeL: 0.32, pitchL: s < 0 ? 15 : 0,
      r: at(1, 0.14 - 0.07 * s, 0.56, 0.22, E_DOWN), l: at(-1, -0.12 - 0.07 * s, 0.56, 0.22, E_DOWN), handR: 0.5, handL: 0.5,
    }] as [number, PoseSpec]),
  }),
  full({
    id: 'air-piano', name: 'Air Piano Groove', tags: 'hiphop | arms | amapiano hands', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.3,
    desc: 'Knees bouncing, play a keyboard in front of the waist with the fingers spread: press the keys on one side, slide along to the other side and press again, the weight following the hands.',
    // The hands travel the length of the keyboard (0.3) and drop visibly on each press.
    keys: [
      [0, { y: -0.09, x: 0.03, hips: 0.03, tilt: 4, nod: 10, turn: 12, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...PIANO(0.15, 0.6) }],
      [0.5, { y: -0.05, x: 0.0, hips: 0, nod: 4, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...PIANO(0.0, 0.68) }],
      [1, { y: -0.09, x: -0.03, hips: -0.03, tilt: -4, nod: 10, turn: -12, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...PIANO(-0.15, 0.6) }],
      [1.5, { y: -0.05, x: 0.0, hips: 0, nod: 4, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], ...PIANO(0.0, 0.68) }],
    ],
  }),
  full({
    id: 'knee-drop-groove', name: 'Knee Drop Groove', tags: 'hiphop | legs hips | amapiano', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips'], mirror: true, bounce: 0.2,
    desc: 'Weight on one leg, drop the other knee in toward it with the hip sinking, arms swinging loosely across, then pop back up tall; switch sides.',
    keys: [[0, KNEE_A], [1, { y: -0.04, x: 0, hips: 0, tilt: 0, nod: -2, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.05, kneeL: 0.05, r: at(1, 0.2, 0.62, 0.12, E_DOWN), l: at(-1, -0.2, 0.62, 0.12, E_DOWN), handR: 0.5, handL: 0.5 }]],
  }),
  // Commonly called "Tshwala Bam" (named after the song): descriptive name.
  full({
    id: 'wide-fist-roll', name: 'Wide Plié Fist Roll', tags: 'hiphop | full | amapiano', beats: 2, level: 'mid', d: 1, parts: ['arms', 'legs', 'torso'], bounce: 0.2,
    desc: 'Feet wide and turned out, knees open over the toes, sink on every beat while the fists roll round each other in front of the belly and the shoulders pop one after the other.',
    keys: [[0, fistRoll(0)], [0.5, fistRoll(1)], [1, fistRoll(2)], [1.5, fistRoll(3)]],
  }),
];

export const moves: MoveDef[] = [...lyrical, ...metal, ...punk, ...brazil, ...amapiano];
