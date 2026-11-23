import { Vector3 } from "three";

/**
 * Fin Ray 2D 준정적 모델 (손가락 평면 안).
 *
 * local 좌표: u = 손가락 축(뿌리→끝), v = 바깥(뒤 플랭크) 방향.
 *   contact flank: c0=(0,0) ... cn=(L,0)  (물체와 닿는 면)
 *   back flank   : b0=(0,base) ... b_{n-1}, 끝은 cn 공유
 *   rib          : c_i—b_i (i ∈ ribIdx), 양끝 핀 (테이프 힌지 / 슬롯-탭)
 * 플랭크는 연속 띠 → 마디마다 굽힘 강성(EI). 리브 양끝은 핀이라 굽힘 강성 없음.
 * 순수 핀 링크면 mechanism(자유도 남음)이므로 플랭크 굽힘이 유일한 복원력이다.
 *
 * 풀이: PBD(위치 기반) — 길이 제약(강체), 굽힘(i-1,i+1 거리 → 부드러운 제약), 접촉(SDF 밖으로 투영).
 * 힘 추정: 물리 굽힘 에너지 E = Σ EI θ² / (2 l) 를 actuator 좌표 q 로 미분 → generalized force.
 */
export interface FinraySpec {
  L: number;
  base: number;
  width: number;
  nSeg: number;
  ribIdx: number[];
  /** 플랭크 굽힘 강성 N·mm² (골판지 미보정 추정값) */
  EI: number;
}

export interface Frame {
  O: Vector3; // base contact corner (world)
  A: Vector3; // 축 (unit)
  N: Vector3; // 바깥 (unit)
  W: Vector3; // 손가락 폭 방향 (unit)
}

type P2 = [number, number];

export interface FinrayResult {
  contact: Vector3[]; // c0..cn
  back: Vector3[]; // b0..b_{n-1}, cn
  ribs: [Vector3, Vector3][];
  energy: number;
  /** contact 노드가 접촉 중인 개수 */
  nContact: number;
  /** 접촉점 중심 (world), 없으면 null */
  contactCentroid: Vector3 | null;
  local: { c: P2[]; b: P2[] };
}

export function restShape(s: FinraySpec): { c: P2[]; b: P2[] } {
  const c: P2[] = [];
  const b: P2[] = [];
  for (let i = 0; i <= s.nSeg; i++) c.push([(s.L * i) / s.nSeg, 0]);
  for (let i = 0; i < s.nSeg; i++) b.push([(s.L * i) / s.nSeg, s.base * (1 - i / s.nSeg)]);
  return { c, b };
}

const toWorld = (f: Frame, p: P2) => f.O.clone().addScaledVector(f.A, p[0]).addScaledVector(f.N, p[1]);

/** 손가락 폭 전체(가장자리 2 + 중앙)에서 최소 SDF */
function sdfWide(sdf: (p: Vector3) => number, f: Frame, s: FinraySpec, p: P2) {
  const w = toWorld(f, p);
  const h = s.width / 2 - 1;
  return Math.min(sdf(w), sdf(w.clone().addScaledVector(f.W, h)), sdf(w.clone().addScaledVector(f.W, -h)));
}

function grad2(fn: (p: P2) => number, p: P2): P2 {
  const e = 0.05;
  return [
    (fn([p[0] + e, p[1]]) - fn([p[0] - e, p[1]])) / (2 * e),
    (fn([p[0], p[1] + e]) - fn([p[0], p[1] - e])) / (2 * e),
  ];
}

function dist(a: P2, b: P2) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** 거리 제약 투영. wa, wb = inverse mass (0 = 고정) */
function proj(a: P2, b: P2, rest: number, wa: number, wb: number, k = 1) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1e-9;
  const w = wa + wb;
  if (w === 0) return;
  const corr = (k * (d - rest)) / d / w;
  a[0] += wa * corr * dx;
  a[1] += wa * corr * dy;
  b[0] -= wb * corr * dx;
  b[1] -= wb * corr * dy;
}

function turn(a: P2, b: P2, c: P2) {
  const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = t2 - t1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function bendEnergy(s: FinraySpec, c: P2[], b: P2[]) {
  const lc = s.L / s.nSeg;
  const lb = Math.hypot(lc, s.base / s.nSeg);
  let E = 0;
  // contact flank: 뿌리 clamp (가상점 (-lc,0)) 포함
  const cc: P2[] = [[-lc, 0], ...c];
  for (let i = 1; i < cc.length - 1; i++) E += (s.EI * turn(cc[i - 1], cc[i], cc[i + 1]) ** 2) / (2 * lc);
  const r0 = restShape(s);
  const db: P2 = [r0.b[1][0] - r0.b[0][0], r0.b[1][1] - r0.b[0][1]];
  const bb: P2[] = [[b[0][0] - db[0], b[0][1] - db[1]], ...b, c[c.length - 1]];
  for (let i = 1; i < bb.length - 1; i++) E += (s.EI * turn(bb[i - 1], bb[i], bb[i + 1]) ** 2) / (2 * lb);
  return E;
}

/**
 * frameAt(q) 로 뿌리 자세가 주어질 때 q0(접촉 없는 열린 자세) → q 까지 단계적으로 풀이 (터널링 방지).
 */
export function solveFinray(
  s: FinraySpec,
  frameAt: (q: number) => Frame,
  q0: number,
  q: number,
  sdf: (p: Vector3) => number,
  steps = 8,
  iters = 60,
): FinrayResult {
  const rest = restShape(s);
  const lc = s.L / s.nSeg;
  const lb = Math.hypot(lc, s.base / s.nSeg);
  // 상태 (local, 매 단계 frame 이 바뀌어도 local 좌표로 유지 → 강체 운동은 frame 이 담당)
  const c: P2[] = rest.c.map((p) => [p[0], p[1]] as P2);
  const b: P2[] = rest.b.map((p) => [p[0], p[1]] as P2);
  const virtC: P2 = [-lc, 0];
  const db: P2 = [rest.b[1][0] - rest.b[0][0], rest.b[1][1] - rest.b[0][1]];
  const virtB: P2 = [rest.b[0][0] - db[0], rest.b[0][1] - db[1]];
  const kBend = 0.25;
  let f = frameAt(q0);
  for (let st = 1; st <= steps; st++) {
    const qs = q0 + ((q - q0) * st) / steps;
    f = frameAt(qs);
    const fn = (p: P2) => sdfWide(sdf, f, s, p);
    for (let it = 0; it < iters; it++) {
      // 굽힘 (부드러운)
      proj(virtC, c[1], 2 * lc, 0, 1, kBend);
      for (let i = 1; i < s.nSeg; i++) proj(c[i - 1], c[i + 1], 2 * lc, i - 1 === 0 ? 0 : 1, 1, kBend);
      proj(virtB, b[1], 2 * lb, 0, 1, kBend);
      for (let i = 1; i < s.nSeg - 1; i++) proj(b[i - 1], b[i + 1], 2 * lb, i - 1 === 0 ? 0 : 1, 1, kBend);
      // 길이 (강체)
      for (let i = 0; i < s.nSeg; i++) proj(c[i], c[i + 1], lc, i === 0 ? 0 : 1, 1);
      for (let i = 0; i < s.nSeg - 1; i++) proj(b[i], b[i + 1], lb, i === 0 ? 0 : 1, 1);
      proj(b[s.nSeg - 1], c[s.nSeg], lb, 1, 1);
      for (const i of s.ribIdx) proj(c[i], b[i], s.base * (1 - i / s.nSeg), 1, 1);
      // 접촉 (강체 물체/바닥 → 투영)
      for (const arr of [c, b]) {
        for (let i = 1; i < arr.length; i++) {
          const p = arr[i];
          const d = fn(p);
          if (d < 0.6) {
            const g = grad2(fn, p);
            const gl = Math.hypot(g[0], g[1]) || 1;
            const push = 0.6 - d;
            p[0] += (g[0] / gl) * push;
            p[1] += (g[1] / gl) * push;
          }
        }
      }
    }
  }
  const fnF = (p: P2) => sdfWide(sdf, f, s, p);
  let nContact = 0;
  const cen = new Vector3();
  for (const p of c) {
    if (fnF(p) < 1.2) {
      nContact++;
      cen.add(toWorld(f, p));
    }
  }
  const contactW = c.map((p) => toWorld(f, p));
  const backW = [...b.map((p) => toWorld(f, p)), contactW[contactW.length - 1]];
  return {
    contact: contactW,
    back: backW,
    ribs: s.ribIdx.map((i) => [contactW[i], backW[i]] as [Vector3, Vector3]),
    energy: bendEnergy(s, c, b),
    nContact,
    contactCentroid: nContact ? cen.multiplyScalar(1 / nContact) : null,
    local: { c, b },
  };
}

/**
 * generalized force: dE/dq (q 가 각도면 N·mm/rad, 거리면 N). 수치 미분.
 * 닫힘 방향으로 q 가 증가한다고 가정.
 */
export function finrayGenForce(
  s: FinraySpec,
  frameAt: (q: number) => Frame,
  q0: number,
  q: number,
  dq: number,
  sdf: (p: Vector3) => number,
  /** 단계당 최대 q 증가량 (회전 rad / 직선 mm). 고정 8단계는 큰 각도에서 손끝이 물체 안으로 점프(터널링)함 */
  maxStep = Infinity,
) {
  const steps = Math.max(8, Math.ceil(Math.abs(q - q0) / maxStep));
  const r1 = solveFinray(s, frameAt, q0, q, sdf, steps);
  if (r1.nContact === 0) return { res: r1, Q: 0 };
  const r2 = solveFinray(s, frameAt, q0, q + dq, sdf, steps);
  return { res: r1, Q: Math.max(0, (r2.energy - r1.energy) / dq) };
}
