/**
 * The coach's body: pose channels, proportions and the pose -> joint solver.
 *
 * Pure TypeScript (no DOM), allocation-free in the hot path.
 *
 * Coordinate system (figure units, 1.0 = standing height to the top of the head):
 *   x: screen right (+). The coach is drawn MIRROR-STYLE, so "R" channels are
 *      the USER's right, which is the coach's screen-right side.
 *   y: up (+), floor at 0.
 *   z: toward the viewer (+).
 *
 * A Pose is a flat Float64Array of channels (see CH). Angles are degrees.
 *
 * Arms are forward kinematics with two "swing" angles per bone, measured in
 * the torso frame and mirrored per side:
 *   elevation e: 0 = hanging down, 90 = horizontal, 180 = straight up,
 *                >180 = past vertical toward the other side.
 *   plane p:     0 = in the side (frontal) plane pointing outward,
 *                90 = pointing at the viewer, >90 = across the body in front,
 *                <0 = behind the body.
 *   direction = (side * sin e * cos p, -cos e, sin e * sin p)
 * Interpolating these angles (not positions) makes hands travel on arcs.
 *
 * Legs are inverse kinematics: each foot has a floor target (x, lift, z). A
 * planted foot keeps its target, so it stays put while the hips move.
 */

import { ANKLE_HEIGHT, FLAT_DEG, FOOT_LEN, footContact } from './foot';

// ---------------------------------------------------------------------------
// Channels

export const CH = {
  X: 0, // root x offset (body sway / travel), units
  Y: 1, // root vertical: < 0 squat / knee bend, > 0 airborne (jump)
  LEAN: 2, // side bend, deg, + = upper body toward screen right
  TWIST: 3, // chest yaw, deg, + = chest turns toward screen right
  BEND: 4, // forward bend, deg, + = toward the viewer
  HIPS: 5, // pelvis x shift relative to root, units (hip bump)
  HIPTWIST: 6, // pelvis yaw, deg
  HEAD_ROLL: 7, // deg, + = top of head toward screen right
  HEAD_NOD: 8, // deg, + = chin down
  HEAD_TURN: 9, // deg, + = looks toward screen right
  SH_R: 10, // shoulder shrug 0..1
  SH_L: 11,
  RA_E: 12, // right upper arm elevation
  RA_P: 13, // right upper arm plane
  RF_E: 14, // right forearm elevation
  RF_P: 15, // right forearm plane
  LA_E: 16,
  LA_P: 17,
  LF_E: 18,
  LF_P: 19,
  RFT_X: 20, // right foot floor x (absolute, relative to move origin)
  RFT_Y: 21, // right foot lift above the floor
  RFT_Z: 22, // right foot forward
  LFT_X: 23,
  LFT_Y: 24,
  LFT_Z: 25,
  HAND_R: 26, // 0 = fist, 1 = open hand
  HAND_L: 27,
  HIP_TILT: 28, // pelvis roll on top of the hip-shift roll, deg, + = user's right hip up
  CHEST_X: 29, // rib-cage slide relative to the pelvis, units, + = toward screen right
  SPIN: 30, // whole-body turn about the vertical axis, deg (0..360 wraps), + = front turns toward screen right
  KNEE_R: 31, // knee / toe turn-out, + = out, - = in (knee pops, heel swivels)
  KNEE_L: 32,
  SLIDE_R: 33, // 1 = the foot slides to its next spot along the floor (no step arc)
  SLIDE_L: 34,
  FORM_R: 35, // hand form: 0 = plain (fist / open by HAND_R), 1 = pointing index finger, 2 = horns, 3 = spread fingers
  FORM_L: 36,
  PITCH_R: 37, // foot pitch, deg: + = up on the ball of the foot (heel raised), - = heel dig (toes up)
  PITCH_L: 38,
} as const;

export const NUM_CHANNELS = 39;

/** Hand forms (CH.FORM_R / FORM_L values). */
export const HAND_FORM = { plain: 0, point: 1, horns: 2, fingers: 3 } as const;

/**
 * Channels that wrap and interpolate the short way round: only the swing
 * PLANES. Elevations are linear (0..~240 are distinct paths), so a sweep from
 * the hip to over the head always goes up the outside.
 */
export const ANGULAR_CHANNELS: readonly number[] = [13, 15, 17, 19, 30];

/** Channels whose sign flips when mirroring (left/right swap handled separately). */
const MIRROR_NEGATE: readonly number[] = [CH.X, CH.LEAN, CH.TWIST, CH.HIPS, CH.HIPTWIST, CH.HEAD_ROLL, CH.HEAD_TURN, CH.HIP_TILT, CH.CHEST_X, CH.SPIN];

/** Pairs of channels swapped when mirroring: [right, left]. */
const MIRROR_SWAP: readonly (readonly [number, number])[] = [
  [CH.SH_R, CH.SH_L],
  [CH.RA_E, CH.LA_E],
  [CH.RA_P, CH.LA_P],
  [CH.RF_E, CH.LF_E],
  [CH.RF_P, CH.LF_P],
  [CH.RFT_Y, CH.LFT_Y],
  [CH.RFT_Z, CH.LFT_Z],
  [CH.HAND_R, CH.HAND_L],
  [CH.KNEE_R, CH.KNEE_L],
  [CH.SLIDE_R, CH.SLIDE_L],
  [CH.FORM_R, CH.FORM_L],
  [CH.PITCH_R, CH.PITCH_L],
];

export type Pose = Float64Array;

export function createPose(): Pose {
  return new Float64Array(NUM_CHANNELS);
}

export function copyPose(src: Pose, out: Pose): Pose {
  out.set(src);
  return out;
}

/** Mirror left/right (screen x flips). `out` may be `src`. */
export function mirrorPose(src: Pose, out: Pose): Pose {
  if (out !== src) out.set(src);
  for (const c of MIRROR_NEGATE) out[c] = out[c] === 0 ? 0 : -out[c];
  for (const [r, l] of MIRROR_SWAP) {
    const t = out[r];
    out[r] = out[l];
    out[l] = t;
  }
  // Foot x: right foot takes the negated left foot x and vice versa.
  const rx = out[CH.RFT_X];
  out[CH.RFT_X] = -out[CH.LFT_X];
  out[CH.LFT_X] = -rx;
  return out;
}

// ---------------------------------------------------------------------------
// Proportions (figure units)

export const BODY = {
  hipY: 0.5, // pelvis centre height at rest
  hipHalf: 0.07,
  torso: 0.29, // pelvis centre -> shoulder line
  shoulderHalf: 0.125,
  neck: 0.05,
  headR: 0.092,
  headUp: 0.082, // neck top -> head centre
  upperArm: 0.165,
  forearm: 0.15,
  handR: 0.038,
  thigh: 0.245,
  shin: 0.235,
  ankleY: ANKLE_HEIGHT,
  footHalfX: 0.09, // neutral foot x
} as const;

export const LEG_MAX = BODY.thigh + BODY.shin - 0.004;

// ---------------------------------------------------------------------------
// Joints

export const J = {
  PELVIS: 0,
  CHEST: 1,
  NECK: 2,
  HEAD: 3,
  SH_R: 4,
  EL_R: 5,
  HA_R: 6,
  SH_L: 7,
  EL_L: 8,
  HA_L: 9,
  HIP_R: 10,
  KN_R: 11,
  AN_R: 12,
  HIP_L: 13,
  KN_L: 14,
  AN_L: 15,
  TOE_R: 16,
  TOE_L: 17,
  WAIST: 18,
  HEAD_UP: 19, // unit-ish point above head centre (head orientation)
  HEAD_FWD: 20, // point in front of head centre (face direction)
} as const;

export const NUM_JOINTS = 21;

export interface Skeleton {
  /** xyz per joint, J.* * 3. */
  p: Float64Array;
  /** Root height above rest (> 0 airborne), for the floor shadow. */
  air: number;
  /** Hand openness 0..1. */
  handR: number;
  handL: number;
  /** Hand forms (HAND_FORM), rounded. */
  formR: number;
  formL: number;
  /**
   * Torso and pelvis rotation matrices (row-major 3x3) from the last solve, for
   * renderers that hang body shapes off the torso / pelvis frames.
   */
  rt: Float64Array;
  rp: Float64Array;
  /** Whole-body turn (deg) from the last solve; 180 = back to the viewer. */
  spin: number;
}

export function createSkeleton(): Skeleton {
  const rt = new Float64Array(9);
  const rp = new Float64Array(9);
  rt[0] = rt[4] = rt[8] = 1;
  rp[0] = rp[4] = rp[8] = 1;
  return { p: new Float64Array(NUM_JOINTS * 3), air: 0, handR: 0.5, handL: 0.5, formR: 0, formL: 0, rt, rp, spin: 0 };
}

const DEG = Math.PI / 180;

// Scratch (module-level; solveSkeleton is not re-entrant, which is fine on one thread).
const RT = new Float64Array(9); // torso rotation
const RP = new Float64Array(9); // pelvis rotation
const RH = new Float64Array(9); // head rotation
const V = new Float64Array(3);
const V2 = new Float64Array(3);
const RY = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]); // spin

/** Build R = Rz(-roll) * Rx(pitch) * Ry(yaw): twist first, then bend, then lean. */
function rotation(out: Float64Array, rollDeg: number, pitchDeg: number, yawDeg: number): void {
  // Lean (+ = top toward +x): rotation about z by -roll.
  const r = -rollDeg * DEG;
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  // Bend (+ = top toward +z): y -> z.
  const b = pitchDeg * DEG;
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  // Twist (+ = +x side goes back to -z).
  const y = yawDeg * DEG;
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  // Ry (x' = x cy + z sy, z' = -x sy + z cy)
  // Rx (y' = y cb - z sb, z' = y sb + z cb)
  // Rz (x' = x cr - y sr, y' = x sr + y cr)
  // M = Rz * Rx * Ry
  const ry00 = cy, ry02 = sy, ry20 = -sy, ry22 = cy;
  // Rx*Ry
  const a00 = ry00, a01 = 0, a02 = ry02;
  const a10 = -sb * ry20, a11 = cb, a12 = -sb * ry22;
  const a20 = cb * ry20, a21 = sb, a22 = cb * ry22;
  out[0] = cr * a00 - sr * a10;
  out[1] = cr * a01 - sr * a11;
  out[2] = cr * a02 - sr * a12;
  out[3] = sr * a00 + cr * a10;
  out[4] = sr * a01 + cr * a11;
  out[5] = sr * a02 + cr * a12;
  out[6] = a20;
  out[7] = a21;
  out[8] = a22;
}

function mul(out: Float64Array, a: Float64Array, b: Float64Array): void {
  for (let i = 0; i < 3; i++) {
    const a0 = a[i * 3], a1 = a[i * 3 + 1], a2 = a[i * 3 + 2];
    out[i * 3] = a0 * b[0] + a1 * b[3] + a2 * b[6];
    out[i * 3 + 1] = a0 * b[1] + a1 * b[4] + a2 * b[7];
    out[i * 3 + 2] = a0 * b[2] + a1 * b[5] + a2 * b[8];
  }
}

const RLOC = new Float64Array(9);

/** Set joint j = base + R * (x, y, z). */
function place(p: Float64Array, j: number, base: number, R: Float64Array, x: number, y: number, z: number): void {
  const b = base * 3;
  p[j * 3] = p[b] + R[0] * x + R[1] * y + R[2] * z;
  p[j * 3 + 1] = p[b + 1] + R[3] * x + R[4] * y + R[5] * z;
  p[j * 3 + 2] = p[b + 2] + R[6] * x + R[7] * y + R[8] * z;
}

/** Arm-swing direction in a side-mirrored frame, written to V. */
export function swingDir(out: Float64Array, side: number, eDeg: number, pDeg: number): void {
  const e = eDeg * DEG;
  const p = pDeg * DEG;
  const se = Math.sin(e);
  out[0] = side * se * Math.cos(p);
  out[1] = -Math.cos(e);
  out[2] = se * Math.sin(p);
}

function arm(sk: Skeleton, pose: Pose, side: number, sh: number, el: number, ha: number, cE: number): void {
  const p = sk.p;
  swingDir(V, side, pose[cE], pose[cE + 1]);
  place(p, el, sh, RT, V[0] * BODY.upperArm, V[1] * BODY.upperArm, V[2] * BODY.upperArm);
  const ux = V[0], uy = V[1], uz = V[2];
  swingDir(V, side, pose[cE + 2], pose[cE + 3]);
  // An elbow can't fold flat (the forearm can't lie on the upper arm): past
  // ELBOW_MAX the forearm is eased out toward the front of the upper arm, the
  // more the further it folds. Soft and always toward the same side, so a
  // forearm swinging right past its upper arm goes round in front without a
  // jump (opening it in its own bend plane flips when it passes dead flat).
  const c = ux * V[0] + uy * V[1] + uz * V[2];
  if (c < ELBOW_COS) {
    // Front of the upper arm: torso forward made square to it (up when the arm points forward).
    let dx = -uz * ux, dy = -uz * uy, dz = 1 - uz * uz;
    let dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dl < 0.2) {
      dx = -uy * ux; dy = 1 - uy * uy; dz = -uy * uz;
      dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    }
    const k0 = (ELBOW_EASE * (ELBOW_COS - c)) / dl;
    V[0] += dx * k0; V[1] += dy * k0; V[2] += dz * k0;
    const vl = Math.sqrt(V[0] * V[0] + V[1] * V[1] + V[2] * V[2]) || 1;
    V[0] /= vl; V[1] /= vl; V[2] /= vl;
  }
  place(p, ha, el, RT, V[0] * BODY.forearm, V[1] * BODY.forearm, V[2] * BODY.forearm);
}

/** Elbow fold (deg between the upper arm's and the forearm's directions) past which the forearm is eased open. */
export const ELBOW_MAX = 150;
const ELBOW_COS = Math.cos(ELBOW_MAX * DEG);
/** How hard a forearm folded past ELBOW_MAX is eased toward the front of its upper arm. */
const ELBOW_EASE = 3;

/** Two-bone IK for a leg; hip joint already placed; ankle target in V2. */
function leg(sk: Skeleton, side: number, hip: number, knee: number, ankle: number, toe: number, turn: number, pitch = 0, rise = 0): void {
  const p = sk.p;
  const hx = p[hip * 3], hy = p[hip * 3 + 1], hz = p[hip * 3 + 2];
  let dx = V2[0] - hx, dy = V2[1] - hy, dz = V2[2] - hz;
  let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const a = BODY.thigh, b = BODY.shin;
  const dMin = Math.abs(a - b) + 0.02;
  if (d > LEG_MAX) {
    // Out of reach: pull the foot toward the hip along the line (foot leaves the floor).
    const k = LEG_MAX / d;
    dx *= k; dy *= k; dz *= k;
    d = LEG_MAX;
  } else if (d < dMin) {
    const k = dMin / Math.max(d, 1e-6);
    dx *= k; dy *= k; dz *= k;
    d = dMin;
  }
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  // Knee pole: forward and a little outward (knees track over the toes). A
  // knee turned in (knee pops, heel splits) points in at most KNEE_IN, so the
  // knees meet rather than pass through each other.
  const kt = 0.38 + turn;
  let nx = side * (kt < -KNEE_IN ? -KNEE_IN : kt), ny = 0.0, nz = 1;
  const dot = nx * ux + ny * uy + nz * uz;
  nx -= dot * ux; ny -= dot * uy; nz -= dot * uz;
  let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (nl < 1e-5) {
    nx = 0; ny = 0; nz = 1; nl = 1;
  }
  nx /= nl; ny /= nl; nz /= nl;
  const al = a * cosA, pe = a * sinA;
  p[knee * 3] = hx + ux * al + nx * pe;
  p[knee * 3 + 1] = hy + uy * al + ny * pe;
  p[knee * 3 + 2] = hz + uz * al + nz * pe;
  p[ankle * 3] = hx + dx;
  p[ankle * 3 + 1] = hy + dy;
  p[ankle * 3 + 2] = hz + dz;
  // Toe. The foot's heading on the floor: forward and a little out (turn-out
  // with the knee). On the floor (contact 1) the foot is FLAT: sole along the
  // floor, whatever the shin does (a bent knee leans the shin forward over a
  // flat foot). In the air (contact 0) it hangs off the shin, roughly
  // perpendicular to it and relaxed a little toe-down. Pitch tips either:
  // + = toes down (up on the ball / pointed), - = toes up (heel dig).
  const sx = p[ankle * 3] - p[knee * 3];
  const sy = p[ankle * 3 + 1] - p[knee * 3 + 1];
  const sz = p[ankle * 3 + 2] - p[knee * 3 + 2];
  const sl2 = sx * sx + sy * sy + sz * sz || 1;
  let ex = side * (0.35 + turn * 1.3), ez = 1;
  const el = Math.sqrt(ex * ex + ez * ez);
  ex /= el;
  ez /= el;
  // The foot stays in the vertical plane of its heading; only its angle a
  // (deg below the horizontal, past 90 = toes pointing back down) changes, so
  // it turns continuously whatever the leg does.
  //
  // Hanging (in the air): about level (a little toe-down) as far as the ankle
  // allows: "neutral ankle" is the standing foot tipped with the shin (the
  // shin's lean in this plane), give or take ANKLE_UP (toes up) / ANKLE_DOWN
  // (toes down). A low step stays nearly flat, a heel kicked back to the seat
  // points the toes down, a kneeling back leg tucks them under, a leg kicking
  // forward tips them up.
  const sl = Math.sqrt(sl2);
  const bh = (sx * ex + sz * ez) / sl, bv = sy / sl;
  // Shin lean in the plane (deg, + = ankle ahead of the knee).
  const lean = Math.atan2(bh, -bv) / DEG;
  const sq = FLAT_DEG - lean;
  const want = FLAT_DEG + HANG_RELAX;
  // The ankle turns from neutral toward `want` (the short way round), within
  // its range; the effort fades out as `want` gets to the far side of the
  // circle (a foot whose neutral points the opposite way just stays neutral,
  // with no side to flip to).
  let dw = (((want - sq + 180) % 360) + 360) % 360 - 180;
  const far = dw < 0 ? -dw : dw;
  dw = dw < -ANKLE_UP ? -ANKLE_UP : dw > ANKLE_DOWN ? ANKLE_DOWN : dw;
  let hang = sq + (far <= 90 ? dw : dw * Math.cos((far - 90) * DEG));
  // A shin lying across the plane (a leg out to the side) says little about
  // it: there the foot just hangs about level (blended as directions, so the
  // lean's wrap-around at +-180 stays invisible).
  const inPlane = Math.sqrt(bh * bh + bv * bv);
  if (inPlane < 0.7) {
    let w = inPlane < 0.3 ? 0 : (inPlane - 0.3) / 0.4;
    w = w * w * (3 - 2 * w);
    const vx = w * Math.cos(hang * DEG) + (1 - w) * Math.cos(want * DEG);
    const vy = w * Math.sin(hang * DEG) + (1 - w) * Math.sin(want * DEG);
    hang = Math.atan2(vy, vx) / DEG;
  }
  // On the floor: flat. Pitch tips either (on the floor: toes stay down, heel up / heel down, toes up; in the air: points / flexes).
  const ay = p[ankle * 3 + 1];
  const c = footContact(ay - BODY.ankleY - rise);
  let fa = FLAT_DEG * c + hang * (1 - c) + pitch;
  // Never through the floor: a toe that would go under it tips up toward the front (the foot keeps its length).
  const m = (ay - TOE_MIN_Y) / FOOT_LEN;
  if (m < 1) {
    const edge = Math.asin(m < -1 ? -1 : m) / DEG;
    if (fa > edge && fa < 180 - edge) fa = edge;
  }
  const ca = Math.cos(fa * DEG), sa = Math.sin(fa * DEG);
  p[toe * 3] = p[ankle * 3] + ex * ca * FOOT_LEN;
  p[toe * 3 + 1] = ay - sa * FOOT_LEN;
  p[toe * 3 + 2] = p[ankle * 3 + 2] + ez * ca * FOOT_LEN;
}

/** Most a knee pole points inward (x per unit forward). */
const KNEE_IN = 0.15;
/** A lifted foot hangs this much (deg) toe-down from level. */
const HANG_RELAX = 8;
/** Ankle range (deg) from square to the shin: toes up (dorsiflexion) / down (plantar flexion). */
const ANKLE_UP = 20;
const ANKLE_DOWN = 55;
/** Lowest a toe joint goes (a toe on the floor). */
const TOE_MIN_Y = 0.004;

/**
 * How much the ankle rises when the foot is pitched by `pitch` deg on the
 * floor (+ = up on the ball: the toe stays where a flat foot's toe is).
 */
export function pitchRise(pitch: number): number {
  if (pitch <= 0) return 0;
  const a = Math.min(70, pitch) + FLAT_DEG;
  return FOOT_LEN * (Math.sin(a * DEG) - Math.sin(FLAT_DEG * DEG));
}

/**
 * Solve joint positions for a pose. Origin offsets (travel) must already be
 * included in the pose's X / foot-x channels.
 */
export function solveSkeleton(pose: Pose, sk: Skeleton): Skeleton {
  const p = sk.p;
  const rootY = pose[CH.Y];
  const air = rootY > 0 ? rootY : 0;
  sk.air = air;
  sk.handR = pose[CH.HAND_R];
  sk.handL = pose[CH.HAND_L];
  sk.formR = Math.round(pose[CH.FORM_R]);
  sk.formL = Math.round(pose[CH.FORM_L]);

  // Pelvis rotation: yaw + a little roll from the hip shift (hip bump lifts that hip).
  const hips = pose[CH.HIPS];
  rotation(RP, -hips * 140 - pose[CH.HIP_TILT], 0, pose[CH.HIPTWIST]);

  const px = pose[CH.X] + hips;
  let py = BODY.hipY + rootY;
  const pz = 0;

  // Ankle targets (feet travel with the body while airborne).
  // Up on the ball of the foot (pitch > 0): the heel (ankle) rises so the toes stay on the floor.
  const riseR = pitchRise(pose[CH.PITCH_R]);
  const riseL = pitchRise(pose[CH.PITCH_L]);
  const rax = pose[CH.RFT_X], ray = BODY.ankleY + Math.max(0, pose[CH.RFT_Y]) + air + riseR, raz = pose[CH.RFT_Z];
  const lax = pose[CH.LFT_X], lay = BODY.ankleY + Math.max(0, pose[CH.LFT_Y]) + air + riseL, laz = pose[CH.LFT_Z];

  // Grounded feet must stay reachable: lower the pelvis rather than slide a foot.
  if (rootY <= 0.0001) {
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      const fy = s === 0 ? pose[CH.RFT_Y] : pose[CH.LFT_Y];
      if (fy > 0.01) continue; // lifted foot: fine to pull it
      const ax = s === 0 ? rax : lax, ay = s === 0 ? ray : lay, az = s === 0 ? raz : laz;
      const hx = px + RP[0] * side * BODY.hipHalf;
      const hyOff = RP[3] * side * BODY.hipHalf;
      const hz = pz + RP[6] * side * BODY.hipHalf;
      const h2 = (ax - hx) * (ax - hx) + (az - hz) * (az - hz);
      const reach = LEG_MAX * 0.995;
      if (h2 < reach * reach) {
        const maxY = ay + Math.sqrt(reach * reach - h2) - hyOff;
        if (py > maxY) py = maxY;
      }
    }
  }

  p[0] = px;
  p[1] = py;
  p[2] = pz;

  // Torso: automatic contrapposto (shoulders counter the hip shift).
  const lean = pose[CH.LEAN] - hips * 70;
  rotation(RT, lean, pose[CH.BEND], pose[CH.HIPTWIST] + spineTwist(pose[CH.TWIST] - pose[CH.HIPTWIST]));

  // Rib-cage isolation: the chest slides over the pelvis, shoulders level.
  const cx = pose[CH.CHEST_X];
  place(p, J.CHEST, J.PELVIS, RT, cx, BODY.torso, 0);
  // Waist: on the spine curve (see spineBend), not the straight pelvis -> chest line.
  spineBend(p, RT, RP, 0.45, V);
  p[J.WAIST * 3] = p[0] + (p[J.CHEST * 3] - p[0]) * 0.45 + V[0];
  p[J.WAIST * 3 + 1] = p[1] + (p[J.CHEST * 3 + 1] - p[1]) * 0.45 + V[1];
  p[J.WAIST * 3 + 2] = p[2] + (p[J.CHEST * 3 + 2] - p[2]) * 0.45 + V[2];
  place(p, J.NECK, J.CHEST, RT, 0, BODY.neck, 0);

  rotation(RLOC, pose[CH.HEAD_ROLL], pose[CH.HEAD_NOD], pose[CH.HEAD_TURN]);
  mul(RH, RT, RLOC);
  place(p, J.HEAD, J.NECK, RH, 0, BODY.headUp, 0);
  place(p, J.HEAD_UP, J.HEAD, RH, 0, 1, 0);
  place(p, J.HEAD_FWD, J.HEAD, RH, 0, 0, 1);

  // Shoulders (shrug lifts them).
  place(p, J.SH_R, J.CHEST, RT, BODY.shoulderHalf, pose[CH.SH_R] * 0.065, 0);
  place(p, J.SH_L, J.CHEST, RT, -BODY.shoulderHalf, pose[CH.SH_L] * 0.065, 0);
  arm(sk, pose, 1, J.SH_R, J.EL_R, J.HA_R, CH.RA_E);
  arm(sk, pose, -1, J.SH_L, J.EL_L, J.HA_L, CH.LA_E);

  // Hips + legs.
  place(p, J.HIP_R, J.PELVIS, RP, BODY.hipHalf, 0, 0);
  place(p, J.HIP_L, J.PELVIS, RP, -BODY.hipHalf, 0, 0);
  V2[0] = rax; V2[1] = ray; V2[2] = raz;
  leg(sk, 1, J.HIP_R, J.KN_R, J.AN_R, J.TOE_R, pose[CH.KNEE_R], pose[CH.PITCH_R], riseR);
  V2[0] = lax; V2[1] = lay; V2[2] = laz;
  leg(sk, -1, J.HIP_L, J.KN_L, J.AN_L, J.TOE_L, pose[CH.KNEE_L], pose[CH.PITCH_L], riseL);
  sk.spin = pose[CH.SPIN];
  // Turn: the whole solved body rotates about the vertical axis through the root.
  const sp = pose[CH.SPIN];
  if (sp !== 0) {
    const a = sp * DEG;
    const c = Math.cos(a), s = Math.sin(a);
    const ox = pose[CH.X];
    for (let j = 0; j < NUM_JOINTS; j++) {
      const x = p[j * 3] - ox, z = p[j * 3 + 2];
      p[j * 3] = ox + x * c + z * s;
      p[j * 3 + 2] = -x * s + z * c;
    }
    RY[0] = c; RY[2] = s; RY[6] = -s; RY[8] = c;
    mul(sk.rt, RY, RT);
    mul(sk.rp, RY, RP);
  } else {
    sk.rt.set(RT);
    sk.rp.set(RP);
  }
  return sk;
}

/**
 * Chest twist against the pelvis (deg) the spine actually makes for an
 * authored one: as authored up to TWIST_FREE, then only TWIST_GAIN of the rest
 * (a spine turns about 45..60 deg in all; more reads as a broken waist).
 */
export function spineTwist(rel: number): number {
  const a = rel < 0 ? -rel : rel;
  if (a <= TWIST_FREE) return rel;
  const v = TWIST_FREE + (a - TWIST_FREE) * TWIST_GAIN;
  return rel < 0 ? -v : v;
}
const TWIST_FREE = 50;
const TWIST_GAIN = 0.35;

/**
 * How far the spine at fraction u (0 = pelvis, 1 = chest joint) bends off
 * the straight pelvis -> chest line, into out[0..2]. The spine is drawn as a
 * curve that leaves the pelvis along the pelvis frame's up axis and arrives
 * at the chest along the chest frame's (cubic Hermite, tangents the
 * spine's length): a side bend or forward bend becomes an arc, a rib-cage
 * slide (chestX) or a hip shift against the shoulders an S, instead of a
 * rigid box pivoting at the hips. Joint positions are untouched (renderers
 * only use it for the torso outline / waist). p: solved joints; RT / RP:
 * the torso / pelvis rotations in the same space.
 */
export function spineBend(p: Float64Array, RT: Float64Array, RP: Float64Array, u: number, out: Float64Array): void {
  const c = J.CHEST * 3;
  const dx = p[c] - p[0], dy = p[c + 1] - p[1], dz = p[c + 2] - p[2];
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const u2 = u * u, u3 = u2 * u;
  const h10 = u3 - 2 * u2 + u, h11 = u3 - u2;
  // Hermite minus the chord: h01 P1 + h00 P0 - (P0 + u (P1 - P0)) = (h01 - u)(P1 - P0).
  const k = -2 * u3 + 3 * u2 - u;
  out[0] = h10 * RP[1] * L + h11 * RT[1] * L + k * dx;
  out[1] = h10 * RP[4] * L + h11 * RT[4] * L + k * dy;
  out[2] = h10 * RP[7] * L + h11 * RT[7] * L + k * dz;
}

/** Distance between joint a and b. */
export function jointDist(sk: Skeleton, a: number, b: number): number {
  const p = sk.p;
  const dx = p[a * 3] - p[b * 3], dy = p[a * 3 + 1] - p[b * 3 + 1], dz = p[a * 3 + 2] - p[b * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
