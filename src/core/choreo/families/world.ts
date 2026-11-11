/**
 * World dance-fitness basics: Bollywood, bhangra and garba steps beyond the
 * kpop.ts set, belly-dance fitness basics, dabke and halay line steps,
 * hula and Polynesian steps, East Asian festival / pop-fitness steps,
 * Southeast Asian steps, capoeira ginga, Andean and Brazilian basics.
 * Individual steps only, presented as dance-fitness basics: the generator
 * does all sequencing (no set dance's order is reproduced).
 *
 * Pattern ids are global; the ones here are prefixed `w` to stay unique.
 */

import { ARM, FIST, OPEN, at, circle, mir, wide, type ArmAngles, type PoseSpec } from '../poseKit';
import { full, type MoveDef, type PatternSet } from '../catalog';

// Elbow hints [out, up, fwd].
const OUT_DN = [1, -0.4, -0.2] as const;
const OUT_UP = [1, 0.4, -0.2] as const;
const DOWN = [0.3, -1, 0] as const;
const ACROSS = [0.3, -1, -0.2] as const;
const straight = (e: number): ArmAngles => [e, 0, e, 0];

// ---------------------------------------------------------------------------
// Bollywood / bhangra / garba

// Garba clap positions (hands meeting beside the right side).
// Hands meet near the midline (arm reach is 0.315); the chest twist and lean carry the clap to the side.
const clapLowR: PoseSpec = { r: at(1, 0.07, 0.62, 0.21, OUT_DN), l: at(-1, 0.03, 0.62, 0.22, ACROSS), ...OPEN };
const clapHighR: PoseSpec = { r: at(1, 0.09, 0.95, 0.2, OUT_DN), l: at(-1, 0.04, 0.95, 0.21, OUT_DN), ...OPEN };
const clapApartR: PoseSpec = { r: at(1, 0.3, 0.72, 0.1, OUT_DN), l: at(-1, -0.05, 0.7, 0.2, ACROSS), ...OPEN };

// Luddi: one hand on the small of the back, the other palm-out in front of the face.
const luddiArms: PoseSpec = { r: at(1, 0.12, 0.56, -0.14, [1, -0.2, 0]), l: at(-1, -0.01, 0.93, 0.21, [0.8, -0.6, -0.2]), handR: 1, handL: 1 };

// Tribhanga-style S pose: hip out, rib cage the other way, head tilted.
const sPoseA: PoseSpec = {
  y: -0.05, hips: 0.08, tilt: 11, chestX: -0.06, lean: -7, head: 12, turn: -8,
  rf: [0.11, 0, 0], lf: [-0.13, 0.025, 0.05], kneeL: -0.18,
  r: at(1, 0.4, 0.62, 0.08, DOWN), l: at(-1, -0.17, 0.98, 0.12, OUT_DN), ...OPEN,
};

// Aaja beckon: palm-up reach forward, curl back in.
const reachFwd: ArmAngles = at(1, 0.38, 0.8, 0.18, OUT_DN);
const curlIn: ArmAngles = at(1, 0.13, 0.8, 0.16, DOWN);

// Bollywood open palms at the shoulders (for shoulder pops).
const palmsUp: PoseSpec = { r: at(1, 0.27, 0.66, 0.15, DOWN), l: at(-1, -0.26, 0.68, 0.15, DOWN), ...OPEN };
const palmsPop: PoseSpec = { r: at(1, 0.27, 0.86, 0.12, OUT_DN), l: at(-1, -0.25, 0.66, 0.15, DOWN), ...OPEN };

// Screw the bulb with both hands up by the head.
const bulbs = (k: number): PoseSpec => ({
  r: [150, 10, 150 + 12 * k, 20 + 50 * k],
  l: [150, 10, 150 - 12 * k, 20 - 50 * k],
  handR: 0.55, handL: 0.55,
});


// Naagin: one hand a cobra hood over the head, the other at the chin.
const naagin: PoseSpec = { r: at(1, 0.07, 1.05, 0.15, [1, 0, -0.1]), l: at(-1, -0.03, 0.8, 0.24, ACROSS), handR: 0.6, handL: 0.5 };
// Kathak line: one arm long at shoulder height, the other hand at the chest.
const kathakArms: PoseSpec = { r: straight(88), l: at(-1, 0.02, 0.78, 0.21, ACROSS), handR: 1, handL: 1 };
const tatkar = (side: 1 | -1, y: number, head: number): PoseSpec => ({
  y, kneeR: 0.18, kneeL: 0.18, head,
  rf: [0.1, side > 0 ? 0 : 0.035, 0], lf: [-0.1, side > 0 ? 0.035 : 0, 0],
  ...kathakArms,
});

// ---------------------------------------------------------------------------
// Belly-dance fitness basics

// Egyptian frame: arms out to the sides, a little forward, soft elbows.
const frameArms: PoseSpec = { r: at(1, 0.39, 0.8, 0.11, OUT_DN), l: at(-1, -0.39, 0.8, 0.11, OUT_DN), ...OPEN };
const twistBase: PoseSpec = { y: -0.07, rf: [0.06, 0.03, 0.12], lf: [-0.1, 0, 0], ...frameArms };
// Egyptian walk arms: one arm curved in front of the chest, the other out.
const walkArms: PoseSpec = { r: at(1, 0.08, 0.8, 0.24, OUT_DN), l: at(-1, -0.39, 0.82, 0.08, OUT_DN), ...OPEN };
// Snake arms: one elbow lifts while its wrist drops, the other the reverse.
// Big alternating rise and fall, the wrist trailing the elbow (bigger than the latin snake float).
const snake = (k: number): PoseSpec => ({ r: [90 + 30 * k, 6, 90 + 6 * k, 6], l: [90 - 30 * k, 6, 90 - 6 * k, 6], ...OPEN });

// ---------------------------------------------------------------------------
// Dabke / Black Sea line steps (solo: the hands hold imaginary neighbours).
const linkedLow: PoseSpec = { r: at(1, 0.3, 0.52, 0.09, DOWN), l: at(-1, -0.3, 0.52, 0.09, DOWN), ...OPEN };
// Halay: little fingers linked with the forearms forward at chest height, elbows down.
const linkedShoulder: PoseSpec = { r: at(1, 0.3, 0.74, 0.14, DOWN), l: at(-1, -0.3, 0.74, 0.14, DOWN), ...OPEN };
const linkedShoulderDip: PoseSpec = { r: at(1, 0.25, 0.68, 0.22, DOWN), l: at(-1, -0.25, 0.68, 0.22, DOWN), ...OPEN };
const linkedSwing: PoseSpec = { r: at(1, 0.27, 0.58, 0.2, DOWN), l: at(-1, -0.27, 0.58, 0.2, DOWN), ...OPEN };
const horonArms: PoseSpec = { r: at(1, 0.27, 1.0, 0.05, OUT_DN), l: at(-1, -0.27, 1.0, 0.05, OUT_DN), ...FIST };

// ---------------------------------------------------------------------------
// Hula / Polynesian
// Kaholo wave: both arms reach toward the travel side, the wrists rippling.
const waveSide = (k: number): PoseSpec => ({ r: [86, 8, 86 + 16 * k, 8], l: at(-1, 0.17, 0.8 - 0.04 * k, 0.21, ACROSS), ...OPEN });
// Hela: both arms extend toward the pointed foot.
const helaArms: PoseSpec = { r: at(1, 0.38, 0.74, 0.13, OUT_DN), l: at(-1, 0.12, 0.74, 0.22, ACROSS), ...OPEN };
const helaIn: PoseSpec = { r: at(1, 0.15, 0.76, 0.22, DOWN), l: at(-1, -0.15, 0.76, 0.22, DOWN), ...OPEN };
// 'Uwehe arms: both hands reach to one side at chest height, the far hand across the body.
const uweheArms: PoseSpec = { r: at(1, 0.36, 0.84, 0.12, OUT_DN), l: at(-1, 0.06, 0.82, 0.23, ACROSS), ...OPEN };
// Poi: the hands spin small circles beside the hips.
const poi = (ph: number): PoseSpec => ({
  r: circle(0.3, 0.58, 0.12, 0.08, ph, 1, OUT_DN),
  l: circle(-0.3, 0.58, 0.12, 0.08, Math.PI - ph, -1, OUT_DN),
  handR: 0.2, handL: 0.2,
});

// ---------------------------------------------------------------------------
// East / Southeast Asian festival and pop-fitness steps
const odoriR: PoseSpec = { r: at(1, 0.34, 0.9, 0.1, OUT_DN), l: at(-1, 0.1, 0.86, 0.23, ACROSS), ...OPEN };
const paraOut = (y: number): ArmAngles => at(1, 0.36, y, 0.1, OUT_DN);
const paraAcross: ArmAngles = at(1, -0.04, 0.92, 0.23, OUT_DN);
const paraChest: ArmAngles = at(1, 0.1, 0.72, 0.2, DOWN);
const fanHand: PoseSpec = { l: at(-1, -0.19, 0.6, 0.16, DOWN), handL: 1 };
const ramHigh: ArmAngles = at(1, 0.29, 0.9, 0.12, OUT_DN);
const ramLow: ArmAngles = at(1, 0.25, 0.6, 0.17, DOWN);

// ---------------------------------------------------------------------------
// Capoeira, huayno
const guardFace: ArmAngles = at(1, -0.01, 0.9, 0.21, OUT_DN);
const kerchief = (ph: number): PoseSpec => ({ r: circle(0.17, 1.05, 0.1, 0.05, ph, 1, OUT_DN), l: ARM.hip, handR: 0.4, handL: 0 });

// Awa odori: hands raised high, the same-side hand leading the stepping foot.
const awa = (side: 1 | -1, flick: number): PoseSpec => {
  const lead: ArmAngles = at(1, 0.16, 1.07, 0.14, OUT_DN);
  const back: ArmAngles = at(1, 0.24, 0.98, 0.08, OUT_DN);
  const r = side > 0 ? lead : back;
  const l = mir({ r: side > 0 ? back : lead }).l;
  return { r, l, handR: flick, handL: flick };
};
// Ribbon figure eight traced by one hand in front of the body.
const EIGHT: readonly (readonly [number, number])[] = [[0.13, 0.86], [0.27, 0.98], [0.38, 0.86], [0.27, 0.74], [0.13, 0.86], [0.0, 0.98], [-0.06, 0.86], [0.0, 0.74]];
const ribbon = (i: number): PoseSpec => ({ r: at(1, EIGHT[i][0], EIGHT[i][1], 0.2, OUT_DN), l: at(-1, -0.33, 0.6, 0.08, DOWN), handR: 1, handL: 1 });

// Balinese agem: elbows lifted to shoulder height, hands flexed up.
const agem: PoseSpec = { r: at(1, 0.33, 0.9, 0.08, [1, -0.1, -0.2]), l: at(-1, -0.33, 0.9, 0.08, [1, -0.1, -0.2]), ...OPEN };
// Lezginka: one arm straight out to the side, the other fist in front of the chest.
const lezgR: PoseSpec = { r: [92, 2, 92, 2], l: at(-1, 0.03, 0.82, 0.22, ACROSS), ...FIST };

export const patterns: PatternSet = {
  foot: {},
  arms: {},
  accent: {},
};

export const moves: MoveDef[] = [
  // --- Garba / Bollywood / bhangra
  full({
    id: 'garba-two-clap', name: 'Garba Two-Clap', tags: 'kpop party | full | clap folk garba', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs', 'torso'], mirror: true,
    desc: 'Step out and dip toward that side clapping low by the hip, rise and clap again up by the shoulder; then the other side.',
    keys: [
      [0, { y: -0.09, lean: 10, twist: -16, nod: 7, rf: [0.17, 0, 0.07], lf: [-0.09, 0, 0], ...clapLowR }],
      [0.5, { y: -0.05, lean: 5, twist: -8, nod: 3, rf: [0.17, 0, 0.07], lf: [-0.09, 0, 0], ...clapApartR }],
      [1, { y: -0.01, lean: 4, twist: -12, nod: -6, turn: 14, rf: [0.14, 0, 0.05], lf: [-0.06, 0.03, 0.03], ...clapHighR }],
      [1.5, { y: -0.04, lean: 0, twist: 0, nod: 2, turn: 0, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.22, 0.74, 0.16, OUT_DN), l: at(-1, -0.22, 0.74, 0.16, OUT_DN), ...OPEN }],
    ],
  }),
  full({
    id: 'garba-three-clap', name: 'Garba Three-Clap', tags: 'kpop party | full | clap folk garba', beats: 4, level: 'mid', d: 3, parts: ['arms', 'legs', 'torso'], mirror: true,
    desc: 'Step and clap three times travelling round the body: low by the right hip, at the chest, high on the left; then open the arms and close the feet.',
    keys: [
      [0, { y: -0.09, lean: 10, twist: -16, nod: 7, rf: [0.17, 0, 0.07], lf: [-0.09, 0, 0], ...clapLowR }],
      [1, { y: -0.04, lean: 0, twist: 0, nod: 0, rf: [0.12, 0, 0.02], lf: [-0.12, 0, 0.04], r: ARM.clap, l: ARM.clap, ...OPEN }],
      [2, { y: -0.03, lean: -6, twist: 14, nod: -7, turn: -14, rf: [0.09, 0, 0], lf: [-0.17, 0, 0.07], ...mir(clapHighR) }],
      [3, { y: -0.05, lean: 0, twist: 0, nod: 0, turn: 0, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: [70, 10, 78, 20], l: [70, 10, 78, 20], ...OPEN }],
    ],
  }),
  full({
    id: 'luddi', name: 'Luddi', tags: 'kpop | full | hands folk bhangra bollywood', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso', 'legs'], mirror: true,
    desc: 'One hand on the small of the back, the other palm-out in front of the face, bouncing from foot to foot as the head sways side to side.',
    keys: [
      [0, { y: -0.07, x: 0.015, rf: [0.1, 0, 0], lf: [-0.1, 0.05, 0.02], head: 13, lean: -3, ...luddiArms }],
      [0.5, { y: -0.02, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], head: 4, lean: 0, ...luddiArms }],
      [1, { y: -0.07, x: -0.015, rf: [0.1, 0.05, 0.02], lf: [-0.1, 0, 0], head: -13, lean: 3, ...luddiArms }],
      [1.5, { y: -0.02, rf: [0.1, 0, 0], lf: [-0.1, 0, 0], head: -4, lean: 0, ...luddiArms }],
    ],
  }),
  full({
    id: 's-pose-hit', name: 'Tribhanga S-Pose', tags: 'kpop | hips full | hips bollywood', beats: 2, level: 'low', d: 1, parts: ['hips', 'torso', 'arms'], mirror: true,
    desc: 'Hit a three-bend S pose: hip pushed out, rib cage and head tilted the other way, one hand curved by the head and the other arm reaching low; hold, then switch.',
    keys: [
      [0, sPoseA],
      [1, { ...sPoseA, y: -0.04, hips: 0.075, tilt: 10, head: 10 }],
    ],
  }),
  full({
    id: 'aaja-beckon', name: 'Aaja Beckon', tags: 'kpop pop | arms legs | hands walk bollywood', beats: 2, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Step out reaching one palm up toward the viewer, curl the fingers back in to the chest to say "come here", twice, then the other side.',
    keys: [
      [0, { y: -0.05, x: 0.03, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], head: -6, nod: -4, r: reachFwd, l: ARM.hip, handR: 1, handL: 0 }],
      [0.5, { y: -0.02, x: 0.03, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], head: 5, nod: 3, r: curlIn, l: ARM.hip, handR: 0.3, handL: 0 }],
      [1, { y: -0.05, x: 0.06, rf: [0.2, 0, 0], lf: [0.03, 0.02, 0.01], head: -6, nod: -4, r: reachFwd, l: ARM.hip, handR: 1, handL: 0 }],
      [1.5, { y: -0.02, x: 0.03, rf: [0.13, 0, 0], lf: [-0.07, 0, 0], head: 5, nod: 3, r: curlIn, l: ARM.hip, handR: 0.3, handL: 0 }],
    ],
  }),
  full({
    id: 'shoulder-pop-walk', name: 'Bollywood Shoulder-Pop Walk', tags: 'kpop pop | full | walk bollywood', beats: 2, level: 'low', d: 2, parts: ['legs', 'torso'], mirror: true, travel: 0.2,
    desc: 'Walk sideways with palms open by the shoulders, popping the leading shoulder up on every step with a head tilt toward it.',
    keys: [
      [0, { y: -0.05, x: 0.1, rf: [0.26, 0, 0], lf: [-0.09, 0, 0], shR: 1.3, shL: 0, head: 12, lean: -2, ...palmsPop }],
      [0.5, { y: -0.02, x: 0.12, rf: [0.26, 0, 0], lf: [-0.02, 0.02, 0.01], shR: 0.1, shL: 0, head: 2, lean: 0, ...palmsUp }],
      [1, { y: -0.05, x: 0.2, rf: [0.33, 0, 0], lf: [0.12, 0, 0], shR: 1.3, shL: 0, head: 12, lean: -2, ...palmsPop }],
      [1.5, { y: -0.02, x: 0.2, rf: [0.3, 0, 0], lf: [0.12, 0, 0], shR: 0.1, shL: 0.1, head: 0, lean: 0, ...palmsUp }],
    ],
  }),
  full({
    id: 'screw-the-bulbs', name: 'Screw the Bulbs Down', tags: 'kpop party | arms legs | hands twist bollywood', beats: 4, level: 'mid', d: 2, parts: ['arms', 'legs', 'hips'],
    desc: 'Both hands up screwing in light bulbs, the hips and wrists twisting every half beat as you screw yourself down into a low squat over two beats, then twist back up.',
    keys: [
      [0, wide(-0.01, { hipTwist: 14, twist: -6, ...bulbs(1) })],
      [0.5, wide(-0.05, { hipTwist: -14, twist: 6, kneeR: 0.06, kneeL: 0.06, ...bulbs(-1) })],
      [1, wide(-0.09, { hipTwist: 14, twist: -6, kneeR: 0.1, kneeL: 0.1, ...bulbs(1) })],
      [1.5, wide(-0.13, { hipTwist: -14, twist: 6, kneeR: 0.14, kneeL: 0.14, ...bulbs(-1) })],
      [2, wide(-0.16, { hipTwist: 14, twist: -6, kneeR: 0.16, kneeL: 0.16, ...bulbs(1) })],
      [2.5, wide(-0.12, { hipTwist: -14, twist: 6, kneeR: 0.12, kneeL: 0.12, ...bulbs(-1) })],
      [3, wide(-0.08, { hipTwist: 14, twist: -6, kneeR: 0.08, kneeL: 0.08, ...bulbs(1) })],
      [3.5, wide(-0.04, { hipTwist: -14, twist: 6, kneeR: 0.03, kneeL: 0.03, ...bulbs(-1) })],
    ],
  }),
  full({
    id: 'naagin-sway', name: 'Naagin Sway', tags: 'kpop party | full | hands hips bollywood', beats: 4, level: 'low', d: 2, parts: ['arms', 'hips', 'legs'], mirror: true,
    desc: 'One hand curved over the head like a cobra hood, the other at the chin, swaying the hips side to side as you sink lower each beat, then rise.',
    keys: [
      [0, { y: -0.03, x: 0.02, hips: 0.06, tilt: 7, lean: -3, head: 8, rf: [0.11, 0, 0], lf: [-0.1, 0.02, 0.02], ...naagin }],
      [1, { y: -0.08, x: -0.02, hips: -0.06, tilt: -7, lean: 3, head: -8, rf: [0.11, 0.02, 0.02], lf: [-0.1, 0, 0], ...naagin }],
      [2, { y: -0.13, x: 0.02, hips: 0.06, tilt: 7, lean: -3, head: 8, kneeR: 0.12, kneeL: 0.12, rf: [0.12, 0, 0], lf: [-0.11, 0.015, 0.02], ...naagin }],
      [3, { y: -0.08, x: -0.02, hips: -0.06, tilt: -7, lean: 3, head: -8, rf: [0.11, 0.02, 0.02], lf: [-0.1, 0, 0], ...naagin }],
    ],
  }),
  full({
    id: 'kathak-tatkar', name: 'Kathak Tatkar', tags: 'kpop latin | legs arms | stomp bollywood', beats: 4, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Quick flat-footed stamps right, left on every half beat with the knees turned out, one arm long at shoulder height and the other hand at the chest, the head gliding side to side.',
    keys: [
      [0, tatkar(1, -0.07, 5)], [0.5, tatkar(-1, -0.06, 5)], [1, tatkar(1, -0.07, -5)], [1.5, tatkar(-1, -0.06, -5)],
      [2, tatkar(1, -0.07, 5)], [2.5, tatkar(-1, -0.06, 5)], [3, tatkar(1, -0.07, -5)], [3.5, tatkar(-1, -0.06, -5)],
    ],
  }),

  // --- Belly-dance fitness basics
  full({
    id: 'belly-hip-twist', name: 'Belly Dance Hip Twist', tags: 'latin pop | hips | hips twist', beats: 2, level: 'low', d: 2, parts: ['hips'], mirror: true,
    desc: 'One foot a little forward on the ball, knees soft, twist the hips to swing that knee in and out on every half beat, arms held out in a soft frame.',
    keys: [
      [0, { ...twistBase, hipTwist: 32, hips: 0.04, tilt: 6, kneeR: -0.5, twist: -7, head: 4 }],
      [0.5, { ...twistBase, hipTwist: -26, hips: -0.03, tilt: -4, kneeR: 0.4, twist: 6, head: -3 }],
      [1, { ...twistBase, hipTwist: 32, hips: 0.04, tilt: 6, kneeR: -0.5, twist: -7, head: 4 }],
      [1.5, { ...twistBase, hipTwist: -26, hips: -0.03, tilt: -4, kneeR: 0.4, twist: 6, head: -3 }],
    ],
  }),
  full({
    id: 'egyptian-walk', name: 'Basic Egyptian Walk', tags: 'latin pop | hips legs | hips walk bellydance', beats: 2, level: 'low', d: 2, parts: ['hips', 'legs'], mirror: true, travel: 0.24,
    desc: 'Step to the side and touch the other foot in on its ball, lifting that hip as it lands; one arm curved in front, the other out to the side.',
    keys: [
      [0, { x: 0.11, y: -0.04, hips: -0.065, tilt: -11, lean: 3, head: -4, rf: [0.21, 0, 0], lf: [0.04, 0.03, 0.03], kneeL: -0.15, ...walkArms }],
      [0.5, { x: 0.12, y: -0.02, hips: 0, tilt: 0, lean: 0, head: 0, rf: [0.21, 0, 0], lf: [0.04, 0.01, 0.02], ...walkArms }],
      [1, { x: 0.23, y: -0.04, hips: -0.065, tilt: -11, lean: 3, head: -4, rf: [0.33, 0, 0], lf: [0.16, 0.03, 0.03], kneeL: -0.15, ...walkArms }],
      [1.5, { x: 0.24, y: -0.02, hips: 0, tilt: 0, lean: 0, head: 0, rf: [0.33, 0, 0], lf: [0.15, 0, 0], ...walkArms }],
    ],
  }),
  full({
    id: 'hip-drop-kick', name: 'Hip Drop Kick', tags: 'latin pop | hips legs | hips kick bellydance', beats: 2, level: 'mid', d: 2, parts: ['hips', 'legs'], mirror: true,
    desc: 'One foot forward on its ball, drop that hip down hard, lift it, then flick the same foot in a low kick to the front diagonal; one arm curved in front and the other out to the side.',
    keys: [
      [0, { y: -0.08, hips: -0.07, tilt: -12, lean: 3, head: -4, rf: [0.08, 0.035, 0.11], lf: [-0.1, 0, 0], kneeR: -0.15, ...walkArms }],
      [0.5, { y: -0.05, hips: 0.03, tilt: 5, lean: -1, head: 2, rf: [0.08, 0.03, 0.1], lf: [-0.1, 0, 0], kneeR: -0.05, ...walkArms }],
      [1, { y: -0.04, hips: 0.0, tilt: 0, lean: -3, head: 0, rf: [0.18, 0.11, 0.2], lf: [-0.1, 0, 0], ...walkArms }],
      [1.5, { y: -0.05, hips: 0, tilt: 0, lean: 0, rf: [0.1, 0, 0.02], lf: [-0.1, 0, 0], ...walkArms }],
    ],
  }),
  full({
    id: 'snake-arm-shimmy', name: 'Snake Arm Shimmy', tags: 'latin disco | arms full | shake wave bellydance', beats: 2, level: 'mid', d: 2, parts: ['arms', 'torso'],
    desc: 'Shoulders shimmying while the arms ripple like snakes, one rising elbow-first as the other sinks, the wrists trailing behind.',
    keys: [
      [0, { y: -0.04, twist: 5, shR: 0.6, shL: 0, ...snake(1) }],
      [0.5, { y: -0.035, twist: -5, shR: 0, shL: 0.6, ...snake(0) }],
      [1, { y: -0.04, twist: 5, shR: 0.6, shL: 0, ...snake(-1) }],
      [1.5, { y: -0.035, twist: -5, shR: 0, shL: 0.6, ...snake(0) }],
    ],
  }),

  // --- Dabke / Black Sea
  full({
    id: 'dabke-cross-hop', name: 'Dabke Cross & Hop', tags: 'party | legs full | walk kick folk', beats: 4, level: 'high', d: 3, parts: ['legs', 'jump'], mirror: true, travel: 0.26, jump: true,
    desc: 'Hands linked low with imaginary neighbours, step to the side, cross the other foot behind, step again, then hop on that foot kicking the free foot low across the front as the arms swing forward.',
    keys: [
      [0, { x: 0.065, y: -0.06, shR: 0.4, shL: 0.4, rf: [0.22, 0, 0], lf: [-0.09, 0, 0], ...linkedLow }],
      [1, { x: 0.15, y: -0.07, hipTwist: -10, shR: 0, shL: 0, rf: [0.22, 0, 0], lf: [0.13, 0, -0.06], ...linkedLow }],
      [2, { x: 0.22, y: -0.06, shR: 0.4, shL: 0.4, rf: [0.35, 0, 0], lf: [0.13, 0, -0.06], ...linkedLow }],
      [2.5, { x: 0.24, y: -0.09, rf: [0.33, 0, 0], lf: [0.17, 0.02, 0], ...linkedLow }],
      [3, { x: 0.25, y: 0.035, lean: -3, shR: 0, shL: 0, rf: [0.34, 0.03, 0], lf: [0.25, 0.09, 0.16], ...linkedSwing }],
      [3.5, { x: 0.26, y: -0.06, rf: [0.35, 0, 0], lf: [0.17, 0, 0], ...linkedLow }],
    ],
  }),
  full({
    id: 'horon-shimmy', name: 'Horon Shimmy', tags: 'party rock | full | shake folk', beats: 2, level: 'high', d: 2, parts: ['torso', 'legs', 'arms'], impact: true,
    desc: 'Fists up beside the head, elbows out, quick small stamps in place with the shoulders shivering, rocking forward and back.',
    keys: [
      [0, { y: -0.08, bend: 7, nod: 4, shR: 0.7, shL: 0.1, rf: [0.08, 0, 0.03], lf: [-0.08, 0.03, 0.01], kneeR: 0.08, kneeL: 0.08, ...horonArms }],
      [0.5, { y: -0.05, bend: 4, nod: 2, shR: 0.1, shL: 0.7, rf: [0.08, 0.03, 0.01], lf: [-0.08, 0, 0.03], ...horonArms }],
      [1, { y: -0.07, bend: -2, nod: -3, shR: 0.7, shL: 0.1, rf: [0.08, 0, 0], lf: [-0.08, 0.03, 0.01], kneeR: 0.08, kneeL: 0.08, ...horonArms }],
      [1.5, { y: -0.05, bend: 1, nod: 0, shR: 0.1, shL: 0.7, rf: [0.08, 0.03, 0.01], lf: [-0.08, 0, 0], ...horonArms }],
    ],
  }),

  full({
    id: 'halay-dip', name: 'Halay Step & Dip', tags: 'party | legs full | walk folk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso'], mirror: true, travel: 0.18,
    desc: 'Little fingers linked with the forearms forward at chest height, step to the side, close and dip the knees with the shoulders shrugging forward and the hands pressing forward, then step on and lift the trailing knee.',
    keys: [
      [0, { x: 0.065, y: -0.04, rf: [0.22, 0, 0], lf: [-0.09, 0, 0], ...linkedShoulder }],
      [0.5, { x: 0.1, y: -0.13, bend: 8, nod: 6, shR: 0.8, shL: 0.8, kneeR: 0.1, kneeL: 0.1, rf: [0.22, 0, 0], lf: [0.0, 0, 0], ...linkedShoulderDip }],
      [1, { x: 0.16, y: -0.03, bend: 0, nod: 0, shR: 0, shL: 0, rf: [0.27, 0, 0], lf: [0.0, 0, 0], ...linkedShoulder }],
      [1.5, { x: 0.18, y: -0.02, rf: [0.27, 0, 0], lf: [0.07, 0.12, 0.1], ...linkedShoulder }],
    ],
  }),

  // --- Hula / Polynesian
  full({
    id: 'kaholo-wave', name: 'Kaholo Wave', tags: 'latin pop | legs arms hips | walk wave hula', beats: 4, level: 'low', d: 2, parts: ['legs', 'hips', 'arms'], mirror: true, travel: 0.26,
    desc: 'Hula side travel: step, close, step, tap with soft knees and swaying hips, both arms reaching the way you go with the wrists rippling like waves.',
    keys: [
      [0, { x: 0.065, y: -0.07, hips: 0.05, tilt: 6, head: -4, rf: [0.22, 0, 0], lf: [-0.09, 0, 0], ...waveSide(1) }],
      [1, { x: 0.13, y: -0.07, hips: -0.05, tilt: -6, head: -4, rf: [0.22, 0, 0], lf: [0.04, 0, 0], ...waveSide(-1) }],
      [2, { x: 0.195, y: -0.07, hips: 0.05, tilt: 6, head: -4, rf: [0.35, 0, 0], lf: [0.04, 0, 0], ...waveSide(1) }],
      [3, { x: 0.26, y: -0.06, hips: 0.06, tilt: 7, head: -2, rf: [0.35, 0, 0], lf: [0.18, 0.02, 0.02], kneeL: -0.12, ...waveSide(-1) }],
    ],
  }),
  full({
    id: 'hela-point', name: 'Hela', tags: 'latin pop | legs hips arms | point hula', beats: 2, level: 'low', d: 1, parts: ['legs', 'hips', 'arms'], mirror: true,
    desc: 'Sink on one knee and point the other foot out to the front diagonal, hips swaying away from it, both arms reaching out over the pointed foot; bring it in and point the other.',
    keys: [
      [0, { y: -0.08, x: -0.02, hips: -0.055, tilt: -7, head: -6, turn: 12, rf: [0.21, 0.005, 0.1], lf: [-0.09, 0, 0], kneeL: 0.1, ...helaArms }],
      [0.5, { y: -0.08, x: -0.02, hips: -0.05, tilt: -6, head: -5, turn: 10, rf: [0.21, 0.005, 0.1], lf: [-0.09, 0, 0], kneeL: 0.1, ...helaArms }],
      [1, { y: -0.04, x: 0, hips: 0.01, tilt: 0, head: 0, turn: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...helaIn }],
    ],
  }),
  full({
    id: 'uwehe', name: "'Uwehe", tags: 'latin pop | legs hips | hips hula', beats: 2, level: 'low', d: 2, parts: ['legs', 'hips'], mirror: true,
    desc: 'Lift one foot and set it down, then rise onto the balls of both feet and pop the knees open so the hips lift; both arms reaching out to the side of the lifted foot.',
    keys: [
      [0, { y: -0.05, hips: -0.045, tilt: -6, head: -5, rf: [0.09, 0.09, 0.04], lf: [-0.09, 0, 0], kneeL: 0.05, ...uweheArms }],
      [0.5, { y: -0.05, hips: 0.0, tilt: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...uweheArms }],
      [1, { y: -0.12, hips: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.6, kneeL: 0.6, nod: 3, shR: 0.3, shL: 0.3, ...uweheArms }],
      [1.5, { y: -0.04, hips: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0, kneeL: 0, nod: 0, shR: 0, shL: 0, ...uweheArms }],
    ],
  }),
  full({
    id: 'tamau-hips', name: 'Tahitian Tamau', tags: 'latin party | hips | hips shake hula', beats: 2, level: 'mid', d: 2, parts: ['hips'],
    desc: 'Feet together and knees deeply bent, flick the hips side to side on every half beat with the upper body still and both arms straight out at shoulder height, palms down.',
    keys: [
      [0, { y: -0.1, hips: 0.085, tilt: 13, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.1, kneeL: 0.1, r: ARM.out, l: ARM.out, ...OPEN }],
      [0.5, { y: -0.1, hips: -0.085, tilt: -13, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.1, kneeL: 0.1, r: ARM.out, l: ARM.out, ...OPEN }],
      [1, { y: -0.1, hips: 0.085, tilt: 13, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.1, kneeL: 0.1, r: ARM.out, l: ARM.out, ...OPEN }],
      [1.5, { y: -0.1, hips: -0.085, tilt: -13, rf: [0.07, 0, 0], lf: [-0.07, 0, 0], kneeR: 0.1, kneeL: 0.1, r: ARM.out, l: ARM.out, ...OPEN }],
    ],
  }),
  full({
    id: 'poi-swing', name: 'Poi Swing Step', tags: 'party pop | arms legs | wave', beats: 2, level: 'low', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Step-touch side to side while both hands spin small circles beside the hips, as if twirling poi on short cords.',
    keys: [
      [0, { y: -0.05, x: 0.03, rf: [0.2, 0, 0], lf: [-0.09, 0, 0], ...poi(0) }],
      [0.25, { y: -0.035, x: 0.04, rf: [0.2, 0, 0], lf: [-0.06, 0.01, 0], ...poi(Math.PI / 2) }],
      [0.5, { y: -0.03, x: 0.05, rf: [0.2, 0, 0], lf: [-0.02, 0.02, 0.01], ...poi(Math.PI) }],
      [0.75, { y: -0.04, x: 0.055, rf: [0.2, 0, 0], lf: [0.0, 0.01, 0], ...poi(Math.PI * 1.5) }],
      [1, { y: -0.05, x: 0.06, rf: [0.2, 0, 0], lf: [0.02, 0.02, 0.02], ...poi(0) }],
      [1.25, { y: -0.035, x: 0.04, rf: [0.17, 0, 0], lf: [-0.02, 0, 0], ...poi(Math.PI / 2) }],
      [1.5, { y: -0.03, x: 0.02, rf: [0.12, 0, 0], lf: [-0.07, 0, 0], ...poi(Math.PI) }],
      [1.75, { y: -0.04, x: 0.0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], ...poi(Math.PI * 1.5) }],
    ],
  }),
  full({
    id: 'slap-dance', name: "Fa'ataupati Slaps", tags: 'party | full | clap hands', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Samoan slap-dance basics on a wide bouncing stance: clap, slap the chest with both palms, then slap both thighs twice.',
    keys: [
      [0, wide(-0.05, { nod: -3, r: ARM.clap, l: ARM.clap, ...OPEN })],
      [0.5, wide(-0.04, { nod: 2, r: at(1, 0.08, 0.68, 0.15, OUT_DN), l: at(-1, -0.08, 0.68, 0.15, OUT_DN), ...OPEN })],
      [1, wide(-0.11, { bend: 9, nod: 6, kneeR: 0.12, kneeL: 0.12, r: at(1, 0.15, 0.44, 0.13, OUT_DN), l: at(-1, -0.15, 0.44, 0.13, OUT_DN), ...OPEN })],
      [1.5, wide(-0.09, { bend: 7, nod: 5, kneeR: 0.1, kneeL: 0.1, r: at(1, 0.16, 0.46, 0.14, OUT_DN), l: at(-1, -0.16, 0.46, 0.14, OUT_DN), ...OPEN })],
    ],
  }),
  // --- East / Southeast Asian
  full({
    id: 'bon-odori-clap', name: 'Bon Odori Clap Step', tags: 'party pop | full | clap walk folk', beats: 4, level: 'low', d: 2, parts: ['arms', 'legs'], mirror: true,
    desc: 'Step forward on one foot with both hands floating up to that side, step the other foot with the hands drifting across, then close and clap twice.',
    keys: [
      [0, { y: -0.05, turn: 14, head: -4, rf: [0.13, 0, 0.1], lf: [-0.09, 0, 0], ...odoriR }],
      [1, { y: -0.05, turn: -14, head: 4, rf: [0.13, 0, 0.1], lf: [-0.11, 0, 0.12], ...mir(odoriR) }],
      [2, { y: -0.04, turn: 0, head: 0, nod: 4, rf: [0.09, 0, 0.04], lf: [-0.09, 0, 0.04], r: ARM.clap, l: ARM.clap, ...OPEN }],
      [2.5, { y: -0.02, nod: 0, rf: [0.09, 0, 0.04], lf: [-0.09, 0, 0.04], r: [40, 40, 52, 70], l: [40, 40, 52, 70], ...OPEN }],
      [3, { y: -0.04, nod: 4, rf: [0.09, 0, 0.02], lf: [-0.09, 0, 0.02], r: ARM.clap, l: ARM.clap, ...OPEN }],
      [3.5, { y: -0.02, nod: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: [40, 30, 52, 60], l: [40, 30, 52, 60], ...OPEN }],
    ],
  }),
  full({
    id: 'para-para-sweep', name: 'Para Para Sweep', tags: 'kpop pop | arms | hands wave', beats: 2, level: 'mid', d: 2, parts: ['arms'],
    desc: 'Step-touch while each hand in turn flies out high to its side and sweeps palm-out across in front of the face, on every half beat.',
    keys: [
      [0, { y: -0.04, x: 0.02, turn: 10, rf: [0.17, 0, 0], lf: [-0.07, 0, 0], r: paraOut(1.0), l: mir({ r: paraChest }).l, ...OPEN }],
      [0.5, { y: -0.03, x: 0.02, turn: -6, rf: [0.17, 0, 0], lf: [-0.04, 0.02, 0.01], r: paraAcross, l: mir({ r: paraChest }).l, ...OPEN }],
      [1, { y: -0.04, x: -0.02, turn: -10, rf: [0.07, 0, 0], lf: [-0.17, 0, 0], r: paraChest, l: mir({ r: paraOut(1.0) }).l, ...OPEN }],
      [1.5, { y: -0.03, x: -0.02, turn: 6, rf: [0.04, 0.02, 0.01], lf: [-0.17, 0, 0], r: paraChest, l: mir({ r: paraAcross }).l, ...OPEN }],
    ],
  }),
  full({
    id: 'fan-arc', name: 'Fan Dance Arc', tags: 'kpop pop | arms | wave hands', beats: 2, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'On small steps on the balls of the feet, one hand sweeps a big arc from in front of the face, over the head and out to the side as if opening a fan; the other hand rests low.',
    keys: [
      [0, { y: -0.03, turn: -8, nod: -2, rf: [0.05, 0.01, 0.06], lf: [-0.09, 0, 0], r: at(1, 0.0, 0.95, 0.24, OUT_DN), handR: 0.6, ...fanHand }],
      [0.5, { y: -0.01, turn: 0, nod: -8, rf: [0.06, 0, 0.06], lf: [-0.09, 0.01, 0], r: at(1, 0.1, 1.08, 0.12, OUT_UP), handR: 1, ...fanHand }],
      [1, { y: -0.04, turn: 18, nod: -2, rf: [0.06, 0, 0.06], lf: [-0.09, 0, 0], r: at(1, 0.41, 0.86, 0.06, OUT_DN), handR: 1, ...fanHand }],
      [1.5, { y: -0.03, turn: 6, nod: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.22, 0.68, 0.18, DOWN), handR: 0.6, ...fanHand }],
    ],
  }),
  full({
    id: 'yangge-cross-step', name: 'Yangge Cross Step', tags: 'party pop | full | twist walk folk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'hips', 'arms'], mirror: true,
    desc: 'Cross one foot over in front with a hip twist and a bounce as the same-side hand flourishes up high in front and the other swings low behind; step back and cross the other.',
    keys: [
      [0, { y: -0.07, x: -0.01, hipTwist: -18, twist: 8, turn: -10, head: 5, rf: [-0.03, 0, 0.09], lf: [-0.09, 0, 0], r: at(1, 0.18, 1.02, 0.2, OUT_DN), l: at(-1, -0.3, 0.56, -0.02, DOWN), handR: 1, handL: 1 }],
      [0.5, { y: -0.03, x: -0.01, hipTwist: -10, twist: 4, turn: -5, head: 2, rf: [-0.03, 0, 0.09], lf: [-0.09, 0, 0], r: at(1, 0.26, 0.96, 0.16, OUT_DN), l: at(-1, -0.3, 0.6, 0.02, DOWN), handR: 0.5, handL: 1 }],
      [1, { y: -0.06, x: 0, hipTwist: 0, twist: 0, turn: 0, head: 0, rf: [0.1, 0, 0], lf: [-0.09, 0, 0], r: at(1, 0.24, 0.7, 0.18, DOWN), l: at(-1, -0.24, 0.7, 0.18, DOWN), handR: 1, handL: 1 }],
      [1.5, { y: -0.03, rf: [0.1, 0.02, 0.01], lf: [-0.09, 0, 0], r: at(1, 0.24, 0.72, 0.18, DOWN), l: at(-1, -0.24, 0.72, 0.18, DOWN), handR: 1, handL: 1 }],
    ],
  }),
  full({
    id: 'tinikling-hops', name: 'Tinikling Hops', tags: 'party aerobic | legs | jump folk', beats: 2, level: 'high', d: 3, parts: ['jump', 'legs'], mirror: true, jump: true,
    desc: 'Hands on hips, hop twice in the middle (one foot, then the other) as if between bamboo poles, then hop out wide to the side.',
    keys: [
      [0, { y: 0.03, x: -0.01, rf: [0.06, 0.08, 0.02], lf: [-0.03, 0.01, 0], r: ARM.hip, l: ARM.hip, ...FIST }],
      [0.25, { y: -0.06, x: -0.01, rf: [0.06, 0.05, 0.02], lf: [-0.03, 0, 0] }],
      [0.5, { y: 0.03, x: 0.01, rf: [0.03, 0.01, 0], lf: [-0.06, 0.08, 0.02] }],
      [0.75, { y: -0.06, x: 0.01, rf: [0.03, 0, 0], lf: [-0.06, 0.05, 0.02] }],
      [1, { y: 0.04, x: 0.07, rf: [0.19, 0.02, 0], lf: [-0.02, 0.08, 0.02], r: ARM.hip, l: ARM.hip, ...FIST }],
      [1.5, { y: -0.07, x: 0.07, rf: [0.19, 0, 0], lf: [0.0, 0.07, 0.02] }],
    ],
  }),
  full({
    id: 'ramwong-hands', name: 'Ramwong Hands', tags: 'kpop pop | arms legs | hands walk folk', beats: 4, level: 'low', d: 1, parts: ['arms', 'legs'], mirror: true,
    desc: 'Slow gentle steps with a soft knee dip, one hand curled back high by the shoulder and the other low by the waist, swapping smoothly every two beats.',
    keys: [
      [0, { y: -0.06, x: 0.02, head: 6, rf: [0.11, 0, 0.04], lf: [-0.09, 0.015, 0], r: ramHigh, l: mir({ r: ramLow }).l, handR: 1, handL: 1 }],
      [1, { y: -0.03, x: -0.02, head: 3, rf: [0.11, 0.015, 0], lf: [-0.09, 0, 0.04], r: at(1, 0.3, 0.84, 0.13, OUT_DN), l: mir({ r: at(1, 0.26, 0.64, 0.16, DOWN) }).l, handR: 1, handL: 1 }],
      [2, { y: -0.06, x: 0.02, head: -6, rf: [0.11, 0, 0.04], lf: [-0.09, 0.015, 0], r: ramLow, l: mir({ r: ramHigh }).l, handR: 1, handL: 1 }],
      [3, { y: -0.03, x: -0.02, head: -3, rf: [0.11, 0.015, 0], lf: [-0.09, 0, 0.04], r: at(1, 0.26, 0.64, 0.16, DOWN), l: mir({ r: at(1, 0.3, 0.84, 0.13, OUT_DN) }).l, handR: 1, handL: 1 }],
    ],
  }),

  // --- Capoeira, Andean
  full({
    id: 'ginga', name: 'Capoeira Ginga', tags: 'latin hiphop | full | walk capoeira', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms', 'torso'], mirror: true,
    desc: 'From a wide low base, rock one foot back on the diagonal with that arm guarding across the face and the other arm low, then back to base; alternate sides.',
    keys: [
      [0, { y: -0.13, x: 0.02, bend: 9, twist: -12, turn: -4, rf: [0.17, 0, -0.17], lf: [-0.14, 0, 0.03], kneeL: 0.08, r: guardFace, l: at(-1, -0.3, 0.55, 0.06, DOWN), handR: 1, handL: 1 }],
      [1, wide(-0.1, { x: 0, bend: 4, twist: 0, turn: 0, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], r: at(1, 0.22, 0.72, 0.18, DOWN), l: at(-1, -0.22, 0.7, 0.18, DOWN), handR: 1, handL: 1 })],
    ],
  }),
  full({
    id: 'esquiva-dodge', name: 'Standing Esquiva', tags: 'latin hiphop | full | twist capoeira', beats: 2, level: 'mid', d: 2, parts: ['legs', 'torso', 'arms'], mirror: true,
    desc: 'From a wide stance, sink and lean away to one side to dodge, the opposite forearm shielding the face and the other arm reaching low for balance; come back up.',
    keys: [
      [0, wide(-0.16, { x: 0.05, lean: 14, bend: 6, hips: -0.03, nod: 4, rf: [0.17, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.12, r: at(1, 0.38, 0.5, 0.08, DOWN), l: mir({ r: guardFace }).l, handR: 1, handL: 1 })],
      [0.5, wide(-0.16, { x: 0.05, lean: 13, bend: 6, hips: -0.03, nod: 4, rf: [0.17, 0, 0], lf: [-0.15, 0, 0], kneeR: 0.12, r: at(1, 0.38, 0.5, 0.08, DOWN), l: mir({ r: guardFace }).l, handR: 1, handL: 1 })],
      [1, wide(-0.07, { x: 0, lean: 0, bend: 2, hips: 0, nod: 0, rf: [0.15, 0, 0], lf: [-0.15, 0, 0], r: at(1, 0.2, 0.74, 0.19, DOWN), l: at(-1, -0.2, 0.74, 0.19, DOWN), handR: 1, handL: 1 })],
    ],
  }),
  full({
    id: 'huayno-skip', name: 'Huayno Stamp Skip', tags: 'latin party | legs | stomp folk', beats: 2, level: 'mid', d: 3, parts: ['legs', 'arms'], mirror: true, impact: true,
    desc: 'Stamp, quick change of feet and stamp again in a skipping rhythm, one hand twirling a handkerchief above the head and the other on the hip.',
    keys: [
      [0, { y: -0.08, rf: [0.1, 0, 0.02], lf: [-0.09, 0.04, 0], kneeR: 0.08, ...kerchief(0) }],
      [0.5, { y: -0.03, rf: [0.1, 0.03, 0.02], lf: [-0.09, 0, 0], ...kerchief(Math.PI / 2) }],
      [0.75, { y: -0.05, rf: [0.1, 0.04, 0.02], lf: [-0.09, 0, 0], ...kerchief(Math.PI * 0.75) }],
      [1, { y: -0.08, rf: [0.1, 0, 0.02], lf: [-0.09, 0.04, 0], kneeR: 0.08, ...kerchief(Math.PI) }],
      [1.5, { y: -0.03, rf: [0.1, 0, 0.02], lf: [-0.09, 0.03, 0], ...kerchief(Math.PI * 1.5) }],
    ],
  }),
  full({
    id: 'awa-odori-walk', name: 'Awa Odori Step', tags: 'party kpop | full | hands walk folk', beats: 2, level: 'mid', d: 2, parts: ['arms', 'legs'],
    desc: 'Low, bent-knee steps on the spot with both hands raised high, the hand on the stepping side lifting higher with a wrist flick each step.',
    keys: [
      [0, { y: -0.1, x: 0.02, turn: 8, rf: [0.13, 0, 0.09], lf: [-0.09, 0, 0], kneeR: 0.1, ...awa(1, 1) }],
      [0.5, { y: -0.06, x: 0.01, rf: [0.12, 0, 0.06], lf: [-0.09, 0.03, 0.02], ...awa(1, 0.4) }],
      [1, { y: -0.1, x: -0.02, turn: -8, rf: [0.09, 0, 0], lf: [-0.13, 0, 0.09], kneeL: 0.1, ...awa(-1, 1) }],
      [1.5, { y: -0.06, x: -0.01, rf: [0.09, 0.03, 0.02], lf: [-0.12, 0, 0.06], ...awa(-1, 0.4) }],
    ],
  }),
  full({
    id: 'frevo-hop', name: 'Frevo Kick Hop', tags: 'latin party | legs | jump kick', beats: 2, level: 'high', d: 3, parts: ['jump', 'legs'], mirror: true, jump: true,
    desc: 'One fist held high as if twirling a small umbrella, hop and flick one foot out to the side with the knee bent, land in a small crouch, then flick the other foot.',
    keys: [
      [0, { y: 0.03, lean: -5, rf: [0.26, 0.1, 0.03], lf: [-0.07, 0.02, 0], kneeR: 0.3, r: at(1, 0.2, 1.08, 0.06, OUT_DN), l: at(-1, -0.36, 0.62, 0.1, DOWN), handR: 0, handL: 1 }],
      [0.5, { y: -0.1, lean: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.2, 1.06, 0.06, OUT_DN), l: at(-1, -0.33, 0.66, 0.1, DOWN), handR: 0, handL: 1 }],
      [1, { y: 0.03, lean: 5, rf: [0.07, 0.02, 0], lf: [-0.26, 0.1, 0.03], kneeL: 0.3, r: at(1, 0.2, 1.08, 0.06, OUT_DN), l: at(-1, -0.36, 0.62, 0.1, DOWN), handR: 0, handL: 1 }],
      [1.5, { y: -0.1, lean: 0, rf: [0.09, 0, 0], lf: [-0.09, 0, 0], kneeR: 0.1, kneeL: 0.1, r: at(1, 0.2, 1.06, 0.06, OUT_DN), l: at(-1, -0.33, 0.66, 0.1, DOWN), handR: 0, handL: 1 }],
    ],
  }),
  full({
    id: 'ribbon-eight', name: 'Ribbon Figure Eight', tags: 'kpop pop | arms | wave', beats: 4, level: 'low', d: 1, parts: ['arms'], mirror: true,
    desc: 'Up on the balls of the feet with tiny steps, one hand draws a big sideways figure eight in front of the body as if trailing a ribbon, the other arm low and out.',
    keys: EIGHT.map((_, i) => [i * 0.5, { y: i % 2 ? -0.015 : -0.03, rf: [0.08, i % 4 === 1 ? 0.02 : 0, 0.02], lf: [-0.08, i % 4 === 3 ? 0.02 : 0, 0.02], ...ribbon(i) }] as const),
  }),
  full({
    id: 'natta-heel-strike', name: 'Natta Heel Strike', tags: 'kpop | legs arms | point stomp', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true,
    desc: 'In a turned-out half plié with hands on the hips, strike one heel out to the side as that arm shoots straight out over it, then draw both back in.',
    keys: [
      [0, { y: -0.1, x: -0.02, turn: 18, rf: [0.27, 0.0, 0.04], lf: [-0.1, 0, 0], kneeL: 0.3, kneeR: 0.2, r: [92, 4, 92, 4], l: ARM.hip, handR: 1, handL: 0 }],
      [0.5, { y: -0.1, x: -0.02, turn: 18, rf: [0.27, 0.0, 0.04], lf: [-0.1, 0, 0], kneeL: 0.3, kneeR: 0.2, r: [91, 4, 91, 4], l: ARM.hip, handR: 1, handL: 0 }],
      [1, { y: -0.1, x: 0, turn: 0, rf: [0.11, 0, 0], lf: [-0.11, 0, 0], kneeL: 0.3, kneeR: 0.3, r: ARM.hip, l: ARM.hip, ...FIST }],
    ],
  }),
  full({
    id: 'taiko-strike', name: 'Taiko Drum Strike', tags: 'party rock | arms full | punch', beats: 2, level: 'high', d: 2, parts: ['arms', 'legs'], impact: true,
    desc: 'In a wide, low stance, beat a big drum in front: one fist raised high overhead while the other strikes down, alternating every beat with a knee bounce.',
    keys: [
      [0, wide(-0.13, { rf: [0.17, 0, 0], lf: [-0.17, 0, 0], bend: 6, nod: 6, lean: -3, kneeR: 0.14, kneeL: 0.14, r: at(1, 0.2, 1.07, 0.03, OUT_DN), l: at(-1, -0.14, 0.6, 0.26, DOWN), ...FIST })],
      [0.5, wide(-0.08, { rf: [0.17, 0, 0], lf: [-0.17, 0, 0], bend: 3, nod: 2, lean: 0, kneeR: 0.08, kneeL: 0.08, r: at(1, 0.25, 0.98, 0.1, OUT_DN), l: at(-1, -0.25, 0.98, 0.1, OUT_DN), ...FIST })],
      [1, wide(-0.13, { rf: [0.17, 0, 0], lf: [-0.17, 0, 0], bend: 6, nod: 6, lean: 3, kneeR: 0.14, kneeL: 0.14, r: at(1, 0.14, 0.6, 0.26, DOWN), l: at(-1, -0.2, 1.07, 0.03, OUT_DN), ...FIST })],
      [1.5, wide(-0.08, { rf: [0.17, 0, 0], lf: [-0.17, 0, 0], bend: 3, nod: 2, lean: 0, kneeR: 0.08, kneeL: 0.08, r: at(1, 0.25, 0.98, 0.1, OUT_DN), l: at(-1, -0.25, 0.98, 0.1, OUT_DN), ...FIST })],
    ],
  }),
  full({
    id: 'balinese-agem', name: 'Balinese Agem Shift', tags: 'kpop | full | hands', beats: 2, level: 'low', d: 2, parts: ['torso', 'arms', 'hips'], mirror: true,
    desc: 'Knees bent and turned out, elbows lifted to shoulder height with the hands flexed up, shift the weight to one side as the head slides the other way and the eyes look out.',
    keys: [
      [0, { y: -0.1, x: 0.04, hips: 0.05, tilt: 6, lean: -4, chestX: -0.04, head: -9, turn: -14, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.3, kneeL: 0.3, ...agem }],
      [0.5, { y: -0.1, x: 0.04, hips: 0.05, tilt: 6, lean: -4, chestX: -0.04, head: -9, turn: -14, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.3, kneeL: 0.3, ...agem }],
      [1, { y: -0.08, x: 0, hips: 0, tilt: 0, lean: 0, chestX: 0, head: 0, turn: 0, rf: [0.13, 0, 0], lf: [-0.13, 0, 0], kneeR: 0.3, kneeL: 0.3, ...agem }],
    ],
  }),
  full({
    id: 'itik-itik', name: 'Itik-Itik Duck Step', tags: 'party | legs arms | walk folk', beats: 2, level: 'mid', d: 2, parts: ['legs', 'arms'], mirror: true, travel: 0.2,
    desc: 'Tiny quick choppy steps travelling sideways like a duck, both arms out at the sides flapping up and down from the wrists.',
    keys: [
      [0, { x: 0.025, y: -0.05, rf: [0.14, 0, 0.02], lf: [-0.09, 0, 0], r: [82, 4, 70, 4], l: [82, 4, 70, 4], ...OPEN }],
      [0.5, { x: 0.05, y: -0.03, rf: [0.14, 0, 0.02], lf: [-0.02, 0.02, 0.01], r: [86, 4, 104, 4], l: [86, 4, 104, 4], ...OPEN }],
      [1, { x: 0.125, y: -0.05, rf: [0.24, 0, 0.02], lf: [0.03, 0, 0], r: [82, 4, 70, 4], l: [82, 4, 70, 4], ...OPEN }],
      [1.5, { x: 0.2, y: -0.03, rf: [0.29, 0, 0], lf: [0.11, 0.02, 0.01], r: [86, 4, 104, 4], l: [86, 4, 104, 4], ...OPEN }],
    ],
  }),
  full({
    id: 'lezginka-steps', name: 'Lezginka Toe Steps', tags: 'rock party | legs arms | walk folk', beats: 2, level: 'high', d: 3, parts: ['legs', 'arms'], mirror: true,
    desc: 'Quick proud steps on the balls of the feet with the knees lifting, one arm held straight out to the side and the other fist in front of the chest; switch arms sharply.',
    keys: [
      [0, { y: 0.0, lean: -2, nod: -4, turn: 12, rf: [0.08, 0.13, 0.08], lf: [-0.08, 0.01, 0], ...lezgR }],
      [0.5, { y: -0.02, nod: -4, turn: 12, rf: [0.08, 0.01, 0.02], lf: [-0.08, 0.13, 0.08], ...lezgR }],
      [1, { y: 0.0, lean: -2, nod: -4, turn: 12, rf: [0.08, 0.13, 0.08], lf: [-0.08, 0.01, 0], ...lezgR }],
      [1.5, { y: -0.02, nod: -4, turn: 12, rf: [0.08, 0.01, 0.02], lf: [-0.08, 0.13, 0.08], ...lezgR }],
    ],
  }),
];

