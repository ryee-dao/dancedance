/**
 * Anatomy checks on a solved skeleton: is the body the coach draws one a
 * person could be in? Used by tools/moves/anatomy.ts (report over the whole
 * catalogue and a routine sample) and anatomy.test.ts (guards).
 *
 * Pure TypeScript (no DOM). Not on the per-frame drawing path.
 *
 * Every check returns an amount past its limit (> 0 = violation), so reports
 * can rank the worst offenders. Limits are deliberately generous: they flag
 * what reads as broken (a knee bending backwards, a hand inside the chest,
 * a planted foot skating), not a stylised pose.
 */

import { PoseEvaluator, type PlanView } from './animator';
import { BODY, CH, J, createPose, createSkeleton, solveSkeleton, type Pose, type Skeleton } from './skeleton';
import { FOOT_LEN, FOOT_TOE_Y, footContact } from './foot';

export const VIOLATIONS = [
  'kneeBack', // knee bends backwards (hyperextension) against the pelvis front
  'kneeTwist', // bent knee over a planted foot points far from its toes (torsion)
  'elbowFold', // forearm folded flatter onto the upper arm than an elbow allows
  'elbowBack', // elbow bends backwards (no humerus rotation could produce it)
  'bone', // a bone (thigh, shin, upper arm, forearm, foot) longer / shorter than itself
  'floor', // ankle or toe below the floor
  'float', // a foot authored on the floor drawn off it while the body is not airborne
  'flatFoot', // a planted, weight-bearing foot that is not flat on the floor
  'legsCross', // feet / shins pass through each other
  'handTorso', // a hand inside the torso
  'handHead', // a hand inside the head
  'twist', // chest twisted against the pelvis past what a spine turns
  'lean', // side bend / forward bend / back bend past a spine's range
  'neck', // head nod / roll / turn past a neck's range
  'footSlide', // a planted foot skating along the floor (not a slide / swivel / pivot)
] as const;

export type Violation = (typeof VIOLATIONS)[number];

export interface AnatomyHit {
  kind: Violation;
  /** How far past the limit (units or degrees, by kind). */
  amount: number;
  detail: string;
}

/** Limits (exported for the report). */
export const LIMITS = {
  kneeBackDot: -0.25, // knee bend direction . the pelvis front below this, with the knee bent >= 8 deg
  kneeTwistDeg: 60,
  elbowFoldDeg: 160,
  elbowBackDeg: 130, // bend direction this far round from the arm's front
  // ... checked up to this upper-arm elevation: higher, the humerus rotates out
  // as it rises (a hand behind the head is fine) and the carried front no longer says.
  elbowBackMaxElev: 100,
  boneTol: 0.03, // fraction of the bone
  footTol: 0.06,
  floorEps: 0.003,
  floatEps: 0.012,
  flatDeg: 8, // a planted, unpitched foot's sole within this of the floor
  legGap: 0.035, // shin / foot centre lines closer than this (legs are ~0.035..0.05 thick)
  twistDeg: 65,
  leanDeg: 45,
  bendFwdDeg: 80,
  bendBackDeg: 35,
  nodDeg: 50,
  rollDeg: 45,
  turnDeg: 80,
  slideSpeed: 0.35, // units / s for an ankle that stays on the floor
} as const;

const DEG = 180 / Math.PI;

function len3(p: Float64Array, a: number, b: number): number {
  const dx = p[a * 3] - p[b * 3], dy = p[a * 3 + 1] - p[b * 3 + 1], dz = p[a * 3 + 2] - p[b * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Closest distance between segments a0-a1 and b0-b1 (joint indices). */
function segDist(p: Float64Array, a0: number, a1: number, b0: number, b1: number): number {
  const ax = p[a0 * 3], ay = p[a0 * 3 + 1], az = p[a0 * 3 + 2];
  const ux = p[a1 * 3] - ax, uy = p[a1 * 3 + 1] - ay, uz = p[a1 * 3 + 2] - az;
  const bx = p[b0 * 3], by = p[b0 * 3 + 1], bz = p[b0 * 3 + 2];
  const vx = p[b1 * 3] - bx, vy = p[b1 * 3 + 1] - by, vz = p[b1 * 3 + 2] - bz;
  const wx = ax - bx, wy = ay - by, wz = az - bz;
  const a = ux * ux + uy * uy + uz * uz, b = ux * vx + uy * vy + uz * vz, c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz, e = vx * wx + vy * wy + vz * wz;
  const D = a * c - b * b;
  let s = D > 1e-12 ? (b * e - c * d) / D : 0;
  s = s < 0 ? 0 : s > 1 ? 1 : s;
  let t = c > 1e-12 ? (b * s + e) / c : 0;
  if (t < 0) {
    t = 0;
    s = a > 1e-12 ? Math.min(1, Math.max(0, -d / a)) : 0;
  } else if (t > 1) {
    t = 1;
    s = a > 1e-12 ? Math.min(1, Math.max(0, (b - d) / a)) : 0;
  }
  const dx = wx + s * ux - t * vx, dy = wy + s * uy - t * vy, dz = wz + s * uz - t * vz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const U = [0, 0, 0], F = [0, 0, 0];
const NO_GLIDE: readonly boolean[] = [false, false];

/** Unit direction a -> b in the torso frame, x mirrored by side, into out. */
function localDir(sk: Skeleton, a: number, b: number, side: number, out: number[]): void {
  const p = sk.p, rt = sk.rt;
  const vx = p[b * 3] - p[a * 3], vy = p[b * 3 + 1] - p[a * 3 + 1], vz = p[b * 3 + 2] - p[a * 3 + 2];
  const x = (rt[0] * vx + rt[3] * vy + rt[6] * vz) * side;
  const y = rt[1] * vx + rt[4] * vy + rt[7] * vz;
  const z = rt[2] * vx + rt[5] * vy + rt[8] * vz;
  const l = Math.sqrt(x * x + y * y + z * z) || 1;
  out[0] = x / l;
  out[1] = y / l;
  out[2] = z / l;
}

/**
 * Elbow of the solved skeleton (side 1 right, -1 left): [flexion deg,
 * upper-arm elevation deg, angle (deg) of the bend direction from the arm's
 * front]. The front starts as the body's front with the arm hanging and is
 * carried along the arm's swing (the shoulder raises the arm in its swing
 * plane); the humerus can then rotate it about +-90 deg either way.
 */
export function elbowAngles(sk: Skeleton, side: number): [number, number, number] {
  localDir(sk, side === 1 ? J.SH_R : J.SH_L, side === 1 ? J.EL_R : J.EL_L, side, U);
  localDir(sk, side === 1 ? J.EL_R : J.EL_L, side === 1 ? J.HA_R : J.HA_L, side, F);
  const e1 = Math.acos(Math.max(-1, Math.min(1, -U[1]))) * DEG;
  const p1 = Math.atan2(U[2], U[0]) * DEG;
  const dot = U[0] * F[0] + U[1] * F[1] + U[2] * F[2];
  const flex = Math.acos(Math.max(-1, Math.min(1, dot))) * DEG;
  // Bend direction: forearm minus its part along the upper arm.
  let bx = F[0] - dot * U[0], by = F[1] - dot * U[1], bz = F[2] - dot * U[2];
  const bl = Math.sqrt(bx * bx + by * by + bz * bz);
  if (bl < 1e-6) return [flex, e1, 0];
  bx /= bl; by /= bl; bz /= bl;
  // Front (0,0,1) rotated by e1 about k = (-sin p, 0, cos p) (the swing axis taking down -> h).
  const pr = p1 / DEG, er = e1 / DEG;
  const kx = -Math.sin(pr), kz = Math.cos(pr);
  // Rodrigues: v cos + (k x v) sin + k (k.v)(1 - cos), v = (0,0,1).
  const c = Math.cos(er), s = Math.sin(er), kv = kz;
  // k x v = (ky*1 - kz*0, kz*0 - kx*1, kx*0 - ky*0) = (0, -kx, 0)
  const ax = kx * kv * (1 - c), ay = -kx * s, az = c + kz * kv * (1 - c);
  const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  const cosA = (bx * ax + by * ay + bz * az) / al;
  return [flex, e1, Math.acos(Math.max(-1, Math.min(1, cosA))) * DEG];
}

/**
 * Per-frame checker. Holds the previous frame's ankles for the slide check;
 * call reset() between unrelated sequences.
 */
export class AnatomyChecker {
  private prev = new Float64Array(6);
  private prevOn = [false, false];
  private has = false;

  reset(): void {
    this.has = false;
  }

  /**
   * Violations of one frame (dt: seconds since the previous frame, 0 = no
   * slide check). gliding[0 / 1]: the right / left foot is on its way to a
   * key that slides it (the pose's slide flag only switches late in the
   * travel; the caller knows the key ahead).
   */
  check(pose: Pose, sk: Skeleton, dt = 0, gliding: readonly boolean[] = NO_GLIDE): AnatomyHit[] {
    const hits: AnatomyHit[] = [];
    const p = sk.p;
    const add = (kind: Violation, amount: number, detail: string): void => {
      hits.push({ kind, amount, detail });
    };
    const airborne = pose[CH.Y] > 0.002;

    for (let s = 0; s < 2; s++) {
      const R = s === 0;
      const name = R ? 'R' : 'L';
      const hip = R ? J.HIP_R : J.HIP_L, kn = R ? J.KN_R : J.KN_L, an = R ? J.AN_R : J.AN_L, toe = R ? J.TOE_R : J.TOE_L;
      // Bones.
      const th = len3(p, hip, kn), sh = len3(p, kn, an), ft = len3(p, an, toe);
      const dTh = Math.abs(th / BODY.thigh - 1), dSh = Math.abs(sh / BODY.shin - 1), dFt = Math.abs(ft / FOOT_LEN - 1);
      if (dTh > LIMITS.boneTol) add('bone', dTh, `thigh ${name} ${(th / BODY.thigh).toFixed(3)}x`);
      if (dSh > LIMITS.boneTol) add('bone', dSh, `shin ${name} ${(sh / BODY.shin).toFixed(3)}x`);
      if (dFt > LIMITS.footTol) add('bone', dFt, `foot ${name} ${(ft / FOOT_LEN).toFixed(3)}x`);
      // Knee direction vs the foot.
      const hx = p[hip * 3], hy = p[hip * 3 + 1], hz = p[hip * 3 + 2];
      const ax = p[an * 3], ay = p[an * 3 + 1], az = p[an * 3 + 2];
      let lx = ax - hx, ly = ay - hy, lz = az - hz;
      const ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
      lx /= ll; ly /= ll; lz /= ll;
      const kx = p[kn * 3] - hx, ky = p[kn * 3 + 1] - hy, kz = p[kn * 3 + 2] - hz;
      const kd = kx * lx + ky * ly + kz * lz;
      let nx = kx - kd * lx, ny = ky - kd * ly, nz = kz - kd * lz;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const bendDeg = (Math.PI - Math.acos(Math.max(-1, Math.min(1, ((hx - p[kn * 3]) * (ax - p[kn * 3]) + (hy - p[kn * 3 + 1]) * (ay - p[kn * 3 + 1]) + (hz - p[kn * 3 + 2]) * (az - p[kn * 3 + 2])) / (th * sh))))) * DEG;
      let fx = p[toe * 3] - ax, fz = p[toe * 3 + 2] - az;
      const fl = Math.sqrt(fx * fx + fz * fz);
      if (nl > 1e-6) {
        nx /= nl; ny /= nl; nz /= nl;
        // Backwards: against the pelvis's front (hips turn the knees with them).
        const yaw = (pose[CH.SPIN] + pose[CH.HIPTWIST]) / DEG;
        const dot = nx * Math.sin(yaw) + nz * Math.cos(yaw);
        if (bendDeg >= 8 && dot < LIMITS.kneeBackDot) add('kneeBack', LIMITS.kneeBackDot - dot, `knee ${name} bends back (${bendDeg.toFixed(0)} deg, dot ${dot.toFixed(2)})`);
        // Torsion: a bent knee over a foot on the floor points roughly where its toes do.
        const hn = Math.sqrt(nx * nx + nz * nz);
        if (bendDeg >= 15 && hn > 0.3 && fl > 1e-6 && ay - BODY.ankleY < 0.01) {
          fx /= fl; fz /= fl;
          const ang = Math.acos(Math.max(-1, Math.min(1, (nx * fx + nz * fz) / hn))) * DEG;
          if (ang > LIMITS.kneeTwistDeg) add('kneeTwist', ang - LIMITS.kneeTwistDeg, `knee ${name} ${ang.toFixed(0)} deg off its toes`);
        }
      }
      // Floor.
      const ty = p[toe * 3 + 1];
      if (ay < BODY.ankleY - LIMITS.floorEps) add('floor', BODY.ankleY - ay, `ankle ${name} y ${ay.toFixed(3)}`);
      if (ty < -LIMITS.floorEps) add('floor', -ty, `toe ${name} y ${ty.toFixed(3)}`);
      // Authored on the floor, not airborne, drawn off it (out of reach).
      const lift = pose[R ? CH.RFT_Y : CH.LFT_Y], pitch = pose[R ? CH.PITCH_R : CH.PITCH_L];
      if (!airborne && lift <= 0.001 && pitch <= 1) {
        const off = ay - BODY.ankleY;
        if (off > LIMITS.floatEps) add('float', off, `foot ${name} ${off.toFixed(3)} off the floor`);
      }
      // A weight-bearing foot is flat: sole slope (ankle -> toe, against the flat foot's own slope) small.
      if (!airborne && footContact(ay - BODY.ankleY) > 0.999 && Math.abs(pitch) < 1) {
        const slope = Math.atan2(ty - (ay - (BODY.ankleY - FOOT_TOE_Y)), Math.max(1e-6, Math.hypot(p[toe * 3] - ax, p[toe * 3 + 2] - az))) * DEG;
        if (Math.abs(slope) > LIMITS.flatDeg) add('flatFoot', Math.abs(slope) - LIMITS.flatDeg, `foot ${name} sole ${slope.toFixed(0)} deg off the floor`);
      }
      // Slide: ankle stays on the floor between frames and moves fast, not flagged as a slide / on the ball.
      const on = ay - BODY.ankleY < 0.003 && pitch < 3 && pose[R ? CH.SLIDE_R : CH.SLIDE_L] < 0.5 && !gliding[s];
      if (dt > 0 && this.has && on && this.prevOn[s]) {
        const v = Math.hypot(ax - this.prev[s * 3], az - this.prev[s * 3 + 2]) / dt;
        if (v > LIMITS.slideSpeed) add('footSlide', v - LIMITS.slideSpeed, `foot ${name} skates ${v.toFixed(2)} u/s`);
      }
      this.prev[s * 3] = ax;
      this.prev[s * 3 + 1] = ay;
      this.prev[s * 3 + 2] = az;
      this.prevOn[s] = on;
    }
    this.has = true;

    // Legs through each other.
    const dShin = segDist(p, J.KN_R, J.AN_R, J.KN_L, J.AN_L);
    const dFeet = segDist(p, J.AN_R, J.TOE_R, J.AN_L, J.TOE_L);
    const dFR = segDist(p, J.AN_R, J.TOE_R, J.KN_L, J.AN_L);
    const dFL = segDist(p, J.AN_L, J.TOE_L, J.KN_R, J.AN_R);
    const dLeg = Math.min(dShin, dFeet, dFR, dFL);
    if (dLeg < LIMITS.legGap) add('legsCross', LIMITS.legGap - dLeg, `legs ${dLeg.toFixed(3)} apart (${dLeg === dShin ? 'shins' : dLeg === dFeet ? 'feet' : 'foot / shin'})`);

    // Hands through the torso / head (torso frame: x side, y up from the pelvis, z front).
    const rt = sk.rt;
    for (let s = 0; s < 2; s++) {
      const ha = s === 0 ? J.HA_R : J.HA_L;
      const vx = p[ha * 3] - p[0], vy = p[ha * 3 + 1] - p[1], vz = p[ha * 3 + 2] - p[2];
      // local = RT^T v
      const x = rt[0] * vx + rt[3] * vy + rt[6] * vz;
      const y = rt[1] * vx + rt[4] * vy + rt[7] * vz;
      const z = rt[2] * vx + rt[5] * vy + rt[8] * vz;
      if (y > -0.04 && y < BODY.torso + 0.02) {
        const hw = 0.075 + 0.045 * Math.max(0, Math.min(1, y / BODY.torso));
        const hd = 0.06;
        const q = (x / hw) * (x / hw) + (z / hd) * (z / hd);
        if (q < 1) add('handTorso', 1 - Math.sqrt(q), `hand ${s === 0 ? 'R' : 'L'} inside the torso`);
      }
      const d = len3(p, ha, J.HEAD);
      if (d < BODY.headR * 0.8) add('handHead', BODY.headR * 0.8 - d, `hand ${s === 0 ? 'R' : 'L'} inside the head`);
    }

    // Elbows.
    for (let s = 0; s < 2; s++) {
      const [flex, elev, back] = elbowAngles(sk, s === 0 ? 1 : -1);
      if (flex > LIMITS.elbowFoldDeg) add('elbowFold', flex - LIMITS.elbowFoldDeg, `elbow ${s === 0 ? 'R' : 'L'} folded ${flex.toFixed(0)} deg`);
      if (flex > 25 && back > LIMITS.elbowBackDeg && elev <= LIMITS.elbowBackMaxElev) add('elbowBack', back - LIMITS.elbowBackDeg, `elbow ${s === 0 ? 'R' : 'L'} bends ${back.toFixed(0)} deg from the front (${flex.toFixed(0)} deg)`);
    }

    // Spine: chest yaw against the pelvis from the solved frames (their z axes); lean / neck from the channels.
    const tw = Math.abs(Math.atan2(sk.rt[2] * sk.rp[8] - sk.rt[8] * sk.rp[2], sk.rt[2] * sk.rp[2] + sk.rt[8] * sk.rp[8]) * DEG);
    if (tw > LIMITS.twistDeg) add('twist', tw - LIMITS.twistDeg, `chest ${tw.toFixed(0)} deg against the pelvis`);
    const lean = Math.abs(pose[CH.LEAN] - pose[CH.HIPS] * 70);
    if (lean > LIMITS.leanDeg) add('lean', lean - LIMITS.leanDeg, `side bend ${lean.toFixed(0)} deg`);
    const bend = pose[CH.BEND];
    if (bend > LIMITS.bendFwdDeg) add('lean', bend - LIMITS.bendFwdDeg, `forward bend ${bend.toFixed(0)} deg`);
    if (-bend > LIMITS.bendBackDeg) add('lean', -bend - LIMITS.bendBackDeg, `back bend ${(-bend).toFixed(0)} deg`);
    const nod = Math.abs(pose[CH.HEAD_NOD]), roll = Math.abs(pose[CH.HEAD_ROLL]), turn = Math.abs(pose[CH.HEAD_TURN]);
    if (nod > LIMITS.nodDeg) add('neck', nod - LIMITS.nodDeg, `head nod ${pose[CH.HEAD_NOD].toFixed(0)} deg`);
    if (roll > LIMITS.rollDeg) add('neck', roll - LIMITS.rollDeg, `head roll ${pose[CH.HEAD_ROLL].toFixed(0)} deg`);
    if (turn > LIMITS.turnDeg) add('neck', turn - LIMITS.turnDeg, `head turn ${pose[CH.HEAD_TURN].toFixed(0)} deg`);
    return hits;
  }
}


/**
 * Play a plan through the animator and the solver at `fps` for `beats` beats
 * from its first grid time and check every frame; `each(hits, beat)` sees
 * each frame's violations. Returns the number of frames. Slide hints come
 * from the keys ahead (a foot gliding to a slide key is not skating).
 */
export function scanPlan(plan: PlanView, beats: number, fps: number, each: (hits: AnatomyHit[], beat: number) => void, spin = 0): number {
  const ev = new PoseEvaluator();
  const ahead = new PoseEvaluator();
  const pose = createPose();
  const poseAhead = createPose();
  const sk = createSkeleton();
  const chk = new AnatomyChecker();
  const glide = [false, false];
  const n = Math.ceil(beats * plan.period * fps);
  const t0 = plan.grid[0] ?? 0;
  for (let f = 0; f <= n; f++) {
    const t = t0 + f / fps;
    ev.evaluate(plan, t, pose);
    pose[CH.SPIN] += spin;
    solveSkeleton(pose, sk);
    glide[0] = pose[CH.SLIDE_R] > 0.5;
    glide[1] = pose[CH.SLIDE_L] > 0.5;
    for (const k of [0.5, 1]) {
      ahead.evaluate(plan, t + plan.period * k, poseAhead, { layers: false });
      glide[0] ||= poseAhead[CH.SLIDE_R] > 0.5;
      glide[1] ||= poseAhead[CH.SLIDE_L] > 0.5;
    }
    each(chk.check(pose, sk, f === 0 ? 0 : 1 / fps, glide), ev.beat);
  }
  return n + 1;
}
