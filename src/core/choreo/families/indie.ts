/**
 * Indie pop, indie rock, shoegaze and dream pop: the `indie` set (see
 * AUTHORING.md, "Genre sets", and ../genreSets/variety.ts, which lists every
 * id here under its set).
 *
 * How the floor of an indie gig or an indie disco moves: not headbanging but
 * the head thrown from side to side (Wendy Fonarow, "Empire of Dirt: The
 * Aesthetics and Rituals of British Indie Music", 2006: where metal fans
 * headbang, indie fans throw their heads side to side), the nod with the
 * hands in the pockets, the shoegaze sway looking down at the shoes, the
 * loose arm swing, the fringe pushed out of the eyes, the twee handclap, the
 * tambourine, the gig two-step with the fist pumped at the band, the baggy
 * (Madchester) shuffle with the maracas up (Bez of the Happy Mondays:
 * Wikipedia "Bez (dancer)", "Baggy"), the jangly guitar strummed high on the
 * chest, festival arms, the front-row jump with the arms round your mates'
 * shoulders and the indie-disco stomp. Sources: Fonarow (above, and her
 * Guardian "Ask the indie professor" columns on why audiences dance or not);
 * Wikipedia "Indie pop", "Shoegaze" (named for the performers looking down at
 * their effects pedals), "Jangle pop", "Twee pop", "Madchester"; YouTube
 * "Electric Feels. Indie Rock + Indie Dance Party" (7EXUvZRb_c4) and indie
 * gig crowd footage for the floor; never a routine.
 *
 * Tempos: dream pop and shoegaze 70-100 (the sway, the nod, the fringe: these
 * keep the set for calm songs, which also open lyrical), indie pop 110-130,
 * indie rock and indie disco 120-150 (the two-step, the stomp, the jump).
 * All are hand-authored full-body moves (no shared layer patterns).
 */
import { FIST, OPEN, at, mir, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

const E_OUT = [1, -0.3, -0.2] as const;
const E_DOWN = [0.5, -1, -0.2] as const;
const E_UP = [1, 0.3, -0.2] as const;
const STRAIGHT = [1, 0, 0] as const;

// --- Hands-in-pockets nod: thumbs in the front pockets, shoulders up, nodding hard on the beat ---------
const POCKET_R = at(1, 0.11, 0.5, 0.07, [1, 0, -0.6]);
const POCKET_L = at(-1, -0.11, 0.5, 0.07, [1, 0, -0.6]);
const pn = (s: 1 | -1, down: boolean): PoseSpec => ({
  y: down ? -0.075 : -0.04, x: 0.015 * s, hips: 0.025 * s, tilt: 3 * s, lean: down ? 3 * s : s, bend: down ? 6 : 2,
  nod: down ? 20 : -2, head: 3 * s, shR: 0.5, shL: 0.5,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: down ? 0.1 : 0.02, kneeL: down ? 0.1 : 0.02,
  r: POCKET_R, l: POCKET_L, handR: 0.3, handL: 0.3,
});

// --- Shoegaze sway: eyes on the shoes, swaying slowly over two beats each way, the arms hanging and drifting ---------
const sg = (s: 1 | -1, deep: boolean): PoseSpec => ({
  x: 0.05 * s, y: deep ? -0.07 : -0.05, hips: 0.04 * s, tilt: 5 * s, lean: (deep ? 9 : 6) * s, bend: 6, nod: 21, head: 8 * s, chestX: 0.015 * s,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: s < 0 ? 0.1 : 0.02, kneeL: s > 0 ? 0.1 : 0.02, pitchR: s < 0 ? 12 : 0, pitchL: s > 0 ? 12 : 0,
  r: at(1, 0.16 + (deep ? 0.08 : 0.05) * s, 0.5, 0.08, E_DOWN), l: at(-1, -0.16 + (deep ? 0.08 : 0.05) * s, 0.5, 0.08, E_DOWN), handR: 0.6, handL: 0.6,
});

// --- Head shake: shift the weight and throw the head over to the other side, the loose fists swinging low ---------
const hs = (s: 1 | -1): PoseSpec => ({
  x: 0.025 * s, y: -0.07, hips: 0.035 * s, tilt: 4 * s, lean: 4 * s, head: -28 * s, turn: -16 * s, nod: 8, chestX: 0.02 * s,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: s < 0 ? 0.1 : 0.02, kneeL: s > 0 ? 0.1 : 0.02,
  r: at(1, 0.2 + 0.07 * s, 0.56, 0.12, E_OUT), l: at(-1, -0.2 + 0.07 * s, 0.56, 0.12, E_OUT), ...FIST,
});
const HS_MID: PoseSpec = {
  x: 0, y: -0.04, hips: 0, tilt: 0, lean: 0, head: 0, turn: 0, nod: -4, chestX: 0,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.03, kneeL: 0.03,
  r: at(1, 0.2, 0.58, 0.12, E_OUT), l: at(-1, -0.2, 0.58, 0.12, E_OUT), ...FIST,
};

// --- Loose arm swing: the shoulders twist and the hanging arms fling round the body, knees bouncing ---------
const las = (s: 1 | -1): PoseSpec => ({
  y: -0.07, twist: 24 * s, hipTwist: -6 * s, lean: -2 * s, nod: 4, turn: 10 * s, hips: -0.01 * s,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.08, kneeL: 0.08, pitchR: s < 0 ? 10 : 0, pitchL: s > 0 ? 10 : 0,
  r: s > 0 ? at(1, 0.38, 0.6, -0.06, STRAIGHT) : at(1, -0.12, 0.58, 0.16, STRAIGHT),
  l: s > 0 ? at(-1, 0.12, 0.58, 0.16, STRAIGHT) : at(-1, -0.38, 0.6, -0.06, STRAIGHT), handR: 0.7, handL: 0.7,
});
const LAS_MID: PoseSpec = {
  y: -0.04, twist: 0, hipTwist: 0, lean: 0, nod: -2, turn: 0, hips: 0,
  rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeR: 0.02, kneeL: 0.02, pitchR: 0, pitchL: 0,
  r: at(1, 0.2, 0.5, 0.06, STRAIGHT), l: at(-1, -0.2, 0.5, 0.06, STRAIGHT), handR: 0.7, handL: 0.7,
};

// --- Twee handclap: small claps under the chin, elbows in, a heel lifting and the head tipping each clap ---------
const tc = (s: 1 | -1, clap: boolean): PoseSpec => ({
  y: clap ? -0.05 : -0.035, x: 0.01 * s, hips: 0.025 * s, tilt: 3 * s, head: 12 * s, nod: clap ? 6 : 0, turn: 6 * s,
  rf: [0.08, 0, 0], lf: [-0.08, 0, 0], pitchR: s < 0 ? 26 : 0, pitchL: s > 0 ? 26 : 0, kneeR: s < 0 ? -0.15 : 0.03, kneeL: s > 0 ? -0.15 : 0.03,
  r: clap ? at(1, 0.018, 0.86, 0.2, E_DOWN) : at(1, 0.1, 0.84, 0.19, E_DOWN), l: clap ? at(-1, -0.018, 0.86, 0.2, E_DOWN) : at(-1, -0.1, 0.84, 0.19, E_DOWN), ...OPEN,
});

// --- Tambourine shake: smack it on the hip on the beat, shake it up by the head on the "and", stepping side to side ---------
const tb = (s: 1 | -1, hit: boolean): PoseSpec => ({
  x: 0.03 * s, y: hit ? -0.075 : -0.04, hips: 0.04 * s, tilt: 5 * s, lean: hit ? -2 : 3, head: hit ? -4 : 6, nod: hit ? 8 : -6, turn: hit ? 0 : 10,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: s < 0 ? 0.1 : 0.02, kneeL: s > 0 ? 0.1 : 0.02, pitchR: s < 0 ? 12 : 0, pitchL: s > 0 ? 12 : 0,
  r: hit ? at(1, 0.24, 0.52, 0.05, [1, 0, -0.4]) : at(1, 0.3, 0.9, 0.1, E_UP), l: at(-1, -0.2, hit ? 0.6 : 0.54, 0.12, E_OUT), handR: 0.3, handL: 0.7,
});

// --- Fringe sweep: one hand sweeps the fringe off the forehead and back over the ear, the head tossing back ---------
const FSW: readonly PoseSpec[] = [
  { x: 0.03, y: -0.06, hips: 0.035, tilt: 4, lean: 2, head: 4, nod: 10, turn: 0,
    rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeL: 0.08, pitchL: 10, r: at(1, -0.01, 0.95, 0.15, [1, -0.3, 0]), l: at(-1, -0.2, 0.52, 0.08, E_DOWN), handR: 1, handL: 0.6 },
  { x: 0.04, y: -0.04, hips: 0.04, tilt: 5, lean: 4, head: 10, nod: -12, turn: 14,
    rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeL: 0.06, pitchL: 12, r: at(1, 0.2, 1.0, -0.02, [1, 0.4, -0.4]), l: at(-1, -0.2, 0.52, 0.08, E_DOWN), handR: 1, handL: 0.6 },
  { x: 0.0, y: -0.06, hips: 0, tilt: 0, lean: 0, head: 0, nod: 4, turn: 4,
    rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.05, kneeL: 0.05, r: at(1, 0.26, 0.56, 0.06, E_DOWN), l: at(-1, -0.2, 0.52, 0.08, E_DOWN), handR: 0.6, handL: 0.6 },
  { x: -0.03, y: -0.05, hips: -0.035, tilt: -4, lean: -2, head: -4, nod: 6, turn: -4,
    rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.08, pitchR: 10, r: at(1, 0.2, 0.52, 0.08, E_DOWN), l: at(-1, -0.16, 0.66, 0.16, E_DOWN), handR: 0.6, handL: 1 },
];
const fsw = (k: number): PoseSpec => FSW[k];

// --- Indie two-step: step out and close with a bounce, one fist pumped up at the band on each step ---------
const itStep: PoseSpec = {
  x: 0.05, y: -0.08, hips: 0.03, tilt: 3, lean: -2, nod: -8, head: -3,
  rf: [0.21, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.1, kneeL: 0.06, pitchL: 12,
  r: at(1, 0.16, 1.0, 0.16, E_UP), l: at(-1, -0.22, 0.56, 0.08, E_OUT), ...FIST,
};
const itUp: PoseSpec = {
  x: 0.08, y: -0.03, hips: 0.015, tilt: 1, lean: 0, nod: 6, head: 0,
  rf: [0.21, 0, 0], lf: [0.0, 0, 0], kneeR: 0.02, kneeL: 0.02, pitchL: 0,
  r: at(1, 0.18, 0.76, 0.18, E_OUT), l: at(-1, -0.2, 0.58, 0.1, E_OUT), ...FIST,
};
const itClose: PoseSpec = {
  x: 0.11, y: -0.08, hips: 0.0, tilt: 0, lean: 2, nod: -8, head: 3,
  rf: [0.21, 0, 0], lf: [0.05, 0, 0], kneeR: 0.08, kneeL: 0.08, pitchL: 0,
  r: at(1, 0.16, 1.0, 0.16, E_UP), l: at(-1, -0.18, 0.56, 0.1, E_OUT), ...FIST,
};

// --- Baggy shuffle: knees loose, flick one foot out low with the knee turned in, both maracas up by the head ---------
const bsFlick = (s: 1 | -1): PoseSpec => ({
  y: -0.08, x: -0.015 * s, hips: -0.03 * s, tilt: -4 * s, lean: -7 * s, head: -8 * s, nod: -6, bend: 4,
  rf: s > 0 ? [0.22, 0.035, 0.03] : [0.08, 0, 0], lf: s < 0 ? [-0.22, 0.035, 0.03] : [-0.08, 0, 0],
  kneeR: s > 0 ? -0.3 : 0.12, kneeL: s < 0 ? -0.3 : 0.12, pitchR: s > 0 ? -12 : 0, pitchL: s < 0 ? -12 : 0,
  r: at(1, 0.3, s > 0 ? 1.0 : 0.9, 0.12, E_OUT), l: at(-1, -0.3, s < 0 ? 1.0 : 0.9, 0.12, E_OUT), ...FIST,
});
const bsMid = (s: 1 | -1): PoseSpec => ({
  y: -0.05, x: 0, hips: 0, tilt: 0, lean: -2 * s, head: -2 * s, nod: 4, bend: 6,
  rf: [0.08, 0, 0], lf: [-0.08, 0, 0], kneeR: 0.06, kneeL: 0.06, pitchR: 0, pitchL: 0,
  r: at(1, 0.26, s > 0 ? 0.88 : 0.96, 0.14, E_OUT), l: at(-1, -0.26, s < 0 ? 0.88 : 0.96, 0.14, E_OUT), ...FIST,
});

// --- Jangle strum: a guitar slung high on the chest, the right hand strumming down and up, side to side ---------
const js = (s: 1 | -1, down: boolean): PoseSpec => ({
  x: 0.025 * s, y: down ? -0.07 : -0.04, hips: 0.035 * s, tilt: 4 * s, lean: -2 * s, nod: down ? 10 : -4, head: 4, turn: -12,
  rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: s < 0 ? 0.1 : 0.02, kneeL: s > 0 ? 0.1 : 0.02,
  r: down ? at(1, 0.12, 0.62, 0.2, E_OUT) : at(1, 0.15, 0.8, 0.2, E_OUT), handR: 0.2,
  l: at(-1, -0.34, 0.86, 0.14, [1, -0.6, 0]), handL: 0.2,
});

// --- Festival arms: both arms up overhead, swaying together from side to side on every beat, bouncing ---------
const fa = (s: 1 | -1): PoseSpec => ({
  y: -0.08, x: 0.02 * s, hips: 0.02 * s, tilt: 2 * s, lean: 6 * s, head: 6 * s, nod: -14,
  rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.1, kneeL: 0.1,
  r: at(1, 0.3 + 0.12 * s, 1.0, 0.1, STRAIGHT), l: at(-1, -0.3 + 0.12 * s, 1.0, 0.1, STRAIGHT), ...OPEN,
});
const FA_UP: PoseSpec = {
  y: -0.02, x: 0, hips: 0, tilt: 0, lean: 0, head: 0, nod: -16, rf: [0.12, 0, 0], lf: [-0.12, 0, 0], kneeR: 0.02, kneeL: 0.02, pitchR: 16, pitchL: 16,
  r: at(1, 0.28, 1.04, 0.1, STRAIGHT), l: at(-1, -0.28, 1.04, 0.1, STRAIGHT), ...OPEN,
};

// --- Arms-round jump: arms draped round the shoulders either side, jumping on the spot with the row ---------
const DRAPE_R = at(1, 0.4, 0.76, 0.06, [1, 0.6, -0.2]);
const DRAPE_L = at(-1, -0.4, 0.76, 0.06, [1, 0.6, -0.2]);
const arLand = (s: 1 | -1): PoseSpec => ({
  y: -0.09, x: 0.015 * s, lean: 3 * s, head: 10 * s, nod: 6, bend: 6,
  rf: [0.1, 0, 0], lf: [-0.1, 0, 0], kneeR: 0.12, kneeL: 0.12, pitchR: 0, pitchL: 0,
  r: DRAPE_R, l: DRAPE_L, shR: 0.3, shL: 0.3, handR: 0.5, handL: 0.5,
});
const arAir = (s: 1 | -1): PoseSpec => ({
  y: 0.045, x: 0.02 * s, lean: 4 * s, head: -14 * s, nod: -12, bend: 0,
  rf: [0.09, 0.035, 0], lf: [-0.09, 0.035, 0], kneeR: 0.04, kneeL: 0.04, pitchR: 28, pitchL: 28,
  r: at(1, 0.4, 0.82, 0.06, [1, 0.6, -0.2]), l: at(-1, -0.4, 0.82, 0.06, [1, 0.6, -0.2]), shR: 0.6, shL: 0.6, handR: 0.5, handL: 0.5,
});

// --- Indie-disco stomp: stamp out into a wide knee, the opposite arm swinging hard across, the other knee coming up ---------
const isStomp: PoseSpec = {
  x: 0.05, y: -0.11, hips: 0.03, tilt: 4, lean: -4, twist: -16, nod: 10, head: -4,
  rf: [0.21, 0, 0.02], lf: [-0.1, 0, 0], kneeR: 0.18, kneeL: 0.08,
  r: at(1, 0.32, 0.58, -0.04, E_OUT), l: at(-1, 0.14, 0.78, 0.18, E_OUT), ...FIST,
};
const isLift: PoseSpec = {
  x: 0.04, y: -0.05, hips: 0.02, tilt: 2, lean: 0, twist: 4, nod: -6, head: 0,
  rf: [0.21, 0, 0.02], lf: [-0.07, 0.12, 0.05], kneeR: 0.06, kneeL: 0.22,
  r: at(1, 0.2, 0.7, 0.16, E_OUT), l: at(-1, -0.22, 0.64, 0.12, E_OUT), ...FIST,
};

export const patterns: PatternSet = {};

export const moves: MoveDef[] = [
  // --- Easy ---------------------------------------------------------------------
  full({
    id: 'pocket-nod', name: 'Hands-in-Pockets Nod', tags: 'pop rock | full |', beats: 2, level: 'low', d: 1, parts: ['torso', 'legs'], bounce: 0.2,
    desc: 'The indie gig stance: thumbs in the front pockets and the shoulders up, nod the head down hard on every beat with a knee bounce, the shoulders rocking a little from side to side.',
    keys: [[0, pn(1, true)], [0.5, pn(1, false)], [1, pn(-1, true)], [1.5, pn(-1, false)]],
  }),
  full({
    id: 'shoegaze-sway', name: 'Shoegaze Sway', tags: 'pop rock | hips | wave', beats: 4, level: 'low', d: 1, parts: ['hips', 'torso'], bounce: 0.1,
    desc: 'Eyes down on the shoes, sway the whole body slowly over to one side for two beats and then to the other, the head rolling with it and the arms hanging loose and drifting along.',
    keys: [[0, sg(1, false)], [1, sg(1, true)], [2, sg(-1, false)], [3, sg(-1, true)]],
  }),
  full({
    id: 'indie-head-shake', name: 'Indie Head Shake', tags: 'pop rock | full | shake', beats: 2, level: 'low', d: 1, parts: ['torso', 'hips'], bounce: 0.2,
    desc: 'The indie answer to the headbang: shift the weight to one side and throw the head over to the other on the beat, back up through the middle, then the other way, loose fists swinging low.',
    keys: [[0, hs(1)], [0.5, HS_MID], [1, hs(-1)], [1.5, HS_MID]],
  }),
  full({
    id: 'loose-arm-swing', name: 'Loose Arm Swing', tags: 'pop rock | arms | twist', beats: 2, level: 'low', d: 1, parts: ['arms', 'torso'], bounce: 0.3,
    desc: 'Knees bouncing, twist the shoulders from side to side and let the hanging arms fling round the body, one slapping across the front and the other swinging out behind.',
    keys: [[0, las(1)], [0.5, LAS_MID], [1, las(-1)], [1.5, LAS_MID]],
  }),
  full({
    id: 'twee-clap', name: 'Twee Handclap', tags: 'pop | arms | clap', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], bounce: 0.1,
    desc: 'Small, neat claps just under the chin with the elbows tucked in, one heel lifting and the head tipping toward that shoulder on each clap; then the other heel.',
    keys: [[0, tc(1, true)], [0.5, tc(1, false)], [1, tc(-1, true)], [1.5, tc(-1, false)]],
  }),
  full({
    id: 'tambourine-shake', name: 'Tambourine Shake', tags: 'pop rock | arms | shake', beats: 2, level: 'low', d: 1, parts: ['arms', 'hips'], bounce: 0.2,
    desc: 'Rocking from foot to foot, smack a tambourine against the hip on the beat and shake it up beside the head on the "and", the other hand loose.',
    keys: [[0, tb(1, true)], [0.5, tb(1, false)], [1, tb(-1, true)], [1.5, tb(-1, false)]],
  }),
  full({
    id: 'fringe-sweep', name: 'Fringe Sweep', tags: 'pop | arms hips | hands', beats: 4, level: 'low', d: 1, parts: ['arms', 'hips'], mirror: true, bounce: 0.1,
    desc: 'Swaying to one side, push the fringe off the forehead with that hand and sweep it back over the ear as the head tosses back, let the hand drop, and sway over to the other side.',
    keys: [[0, fsw(0)], [1, fsw(1)], [2, fsw(2)], [3, fsw(3)]],
  }),

  // --- Medium -------------------------------------------------------------------
  full({
    id: 'indie-two-step', name: 'Indie Two-Step', tags: 'rock pop | legs arms | punch', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.11,
    desc: 'The gig-floor two-step: step out and close with a bounce, one fist pumping up at the band on each step and back down to the chest in between; step back the other way.',
    keys: [[0, itStep], [0.5, itUp], [1, itClose], [1.5, { ...itUp, x: 0.11, lf: [0.05, 0, 0] }]],
  }),
  full({
    id: 'baggy-shuffle', name: 'Baggy Shuffle', tags: 'pop funk | legs arms | shake', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], bounce: 0.3,
    desc: 'Madchester style, loose-limbed: flick one foot out low to the side with the knee turned in and the body leaning away, both fists up by the head shaking maracas, then the other foot.',
    keys: [[0, bsFlick(1)], [0.5, bsMid(1)], [1, bsFlick(-1)], [1.5, bsMid(-1)]],
  }),
  full({
    id: 'jangle-strum', name: 'Jangle Strum', tags: 'rock pop | arms | hands', beats: 2, level: 'mid', d: 2, parts: ['arms', 'hips'], bounce: 0.2,
    desc: 'A guitar slung high on the chest, the left hand up on the neck by the shoulder, strum down and up on every beat and the "and", rocking from foot to foot and nodding along.',
    keys: [[0, js(1, true)], [0.5, js(1, false)], [1, js(-1, true)], [1.5, js(-1, false)]],
  }),
  full({
    id: 'festival-arms', name: 'Festival Arms', tags: 'pop rock | arms | wave', beats: 2, level: 'mid', d: 1, parts: ['arms', 'legs'], bounce: 0.3,
    desc: 'Both arms straight up in a wide V with the hands open, sway them together over to one side on the beat with a knee bounce, back up through the middle onto the toes, then over to the other side.',
    keys: [[0, fa(1)], [0.5, FA_UP], [1, fa(-1)], [1.5, FA_UP]],
  }),

  // --- Hard ---------------------------------------------------------------------
  full({
    id: 'arms-round-jump', name: 'Arms-Round Jump', tags: 'rock pop | full | jump', beats: 2, level: 'high', d: 2, parts: ['jump', 'torso'], jump: true, impact: true,
    desc: 'The front row: arms draped round the shoulders of the people either side, jump up and down on the spot with them, the head thrown from side to side as you land.',
    keys: [[0, arLand(1)], [0.5, arAir(1)], [1, arLand(-1)], [1.5, arAir(-1)]],
  }),
  full({
    id: 'indie-disco-stomp', name: 'Indie Disco Stomp', tags: 'rock pop | legs arms | stomp', beats: 2, level: 'high', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Stamp one foot out into a bent knee with the other arm swinging hard across the chest, then lift the other knee and stamp it out the other way, chest out and the head down.',
    keys: [[0, isStomp], [0.5, isLift], [1, mir(isStomp)], [1.5, mir(isLift)]],
  }),
];
