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
} as const;

export const NUM_CHANNELS = 28;

/**
 * Channels that wrap and interpolate the short way round: only the swing
 * PLANES. Elevations are linear (0..~240 are distinct paths), so a sweep from
 * the hip to over the head always goes up the outside.
 */
export const ANGULAR_CHANNELS: readonly number[] = [13, 15, 17, 19];

/** Channels whose sign flips when mirroring (left/right swap handled separately). */
const MIRROR_NEGATE: readonly number[] = [CH.X, CH.LEAN, CH.TWIST, CH.HIPS, CH.HIPTWIST, CH.HEAD_ROLL, CH.HEAD_TURN];

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
  for (const c of MIRROR_NEGATE) out[c] = -out[c];
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
  ankleY: 0.035,
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
  /**
   * Torso and pelvis rotation matrices (row-major 3x3) from the last solve, for
   * renderers that hang body shapes off the torso / pelvis frames.
   */
  rt: Float64Array;
  rp: Float64Array;
}

export function createSkeleton(): Skeleton {
  const rt = new Float64Array(9);
  const rp = new Float64Array(9);
  rt[0] = rt[4] = rt[8] = 1;
  rp[0] = rp[4] = rp[8] = 1;
  return { p: new Float64Array(NUM_JOINTS * 3), air: 0, handR: 0.5, handL: 0.5, rt, rp };
}

const DEG = Math.PI / 180;

// Scratch (module-level; solveSkeleton is not re-entrant, which is fine on one thread).
const RT = new Float64Array(9); // torso rotation
const RP = new Float64Array(9); // pelvis rotation
const RH = new Float64Array(9); // head rotation
const V = new Float64Array(3);
const V2 = new Float64Array(3);

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
  swingDir(V, side, pose[cE + 2], pose[cE + 3]);
  place(p, ha, el, RT, V[0] * BODY.forearm, V[1] * BODY.forearm, V[2] * BODY.forearm);
}

/** Two-bone IK for a leg; hip joint already placed; ankle target in V2. */
function leg(sk: Skeleton, side: number, hip: number, knee: number, ankle: number, toe: number): void {
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
  // Knee pole: forward and a little outward (knees track over the toes).
  let nx = side * 0.38, ny = 0.0, nz = 1;
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
  // Toe: forward and slightly out; tips with the shin when the foot is lifted.
  const sx = p[ankle * 3] - p[knee * 3];
  const sy = p[ankle * 3 + 1] - p[knee * 3 + 1];
  const sz = p[ankle * 3 + 2] - p[knee * 3 + 2];
  const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
  // Foot direction roughly perpendicular to the shin, pointing forward/out.
  let fx = side * 0.35, fy = -0.15, fz = 1;
  const fd = (fx * sx + fy * sy + fz * sz) / (sl * sl);
  fx -= fd * sx; fy -= fd * sy; fz -= fd * sz;
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const L = 0.085;
  p[toe * 3] = p[ankle * 3] + (fx / fl) * L;
  p[toe * 3 + 1] = Math.max(0.004, p[ankle * 3 + 1] + (fy / fl) * L - 0.012);
  p[toe * 3 + 2] = p[ankle * 3 + 2] + (fz / fl) * L;
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

  // Pelvis rotation: yaw + a little roll from the hip shift (hip bump lifts that hip).
  const hips = pose[CH.HIPS];
  rotation(RP, -hips * 140, 0, pose[CH.HIPTWIST]);

  const px = pose[CH.X] + hips;
  let py = BODY.hipY + rootY;
  const pz = 0;

  // Ankle targets (feet travel with the body while airborne).
  const rax = pose[CH.RFT_X], ray = BODY.ankleY + Math.max(0, pose[CH.RFT_Y]) + air, raz = pose[CH.RFT_Z];
  const lax = pose[CH.LFT_X], lay = BODY.ankleY + Math.max(0, pose[CH.LFT_Y]) + air, laz = pose[CH.LFT_Z];

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
  rotation(RT, lean, pose[CH.BEND], pose[CH.TWIST]);

  place(p, J.WAIST, J.PELVIS, RT, 0, BODY.torso * 0.45, 0);
  place(p, J.CHEST, J.PELVIS, RT, 0, BODY.torso, 0);
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
  leg(sk, 1, J.HIP_R, J.KN_R, J.AN_R, J.TOE_R);
  V2[0] = lax; V2[1] = lay; V2[2] = laz;
  leg(sk, -1, J.HIP_L, J.KN_L, J.AN_L, J.TOE_L);
  sk.rt.set(RT);
  sk.rp.set(RP);
  return sk;
}

/** Distance between joint a and b. */
export function jointDist(sk: Skeleton, a: number, b: number): number {
  const p = sk.p;
  const dx = p[a * 3] - p[b * 3], dy = p[a * 3 + 1] - p[b * 3 + 1], dz = p[a * 3 + 2] - p[b * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
