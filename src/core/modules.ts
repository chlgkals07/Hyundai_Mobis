/**
 * 그룹 모듈: soft(Fin Ray) 플랩/슬롯, hard 피벗/슬롯/텐던.
 * 각 모듈은 "오른쪽-앞(+x,+y)" 한 손가락만 풀고 나머지는 거울상으로 만든다 (물체가 원점 대칭이라 정당).
 */
import { Matrix4, Vector3 } from "three";
import common from "../../params/common.json";
import { finrayGenForce, type Frame, type FinraySpec, type FinrayResult } from "./finray";
import { DEG, V, arc, basis, boxPart, clamp, cylPart, finrayParts, segPart } from "./build";
import type { Line, Part, Readout } from "./types";

export const C = common;
export const Z_TOP = C.board_t * C.palm_layers;
export const X = V(1, 0, 0);
export const Y = V(0, 1, 0);
export const Z = V(0, 0, 1);

export const FINRAY: FinraySpec = {
  L: C.finray.L,
  base: C.finray.base,
  width: C.finray.width,
  nSeg: 10,
  ribIdx: [2, 4, 6, 8],
  EI: 600, // N·mm² — 단면 골판지 띠 22 mm 폭, 미보정. 목요일 실물로 보정할 값.
};

export type Sdf = (p: Vector3) => number;

/** world 점 거울상 */
const mir = (p: Vector3, sx: number, sy: number) => V(p.x * sx, p.y * sy, p.z);
export function mirrorResult(r: FinrayResult, sx: number, sy: number): FinrayResult {
  const f = (p: Vector3) => mir(p, sx, sy);
  return {
    ...r,
    contact: r.contact.map(f),
    back: r.back.map(f),
    ribs: r.ribs.map(([a, b]) => [f(a), f(b)] as [Vector3, Vector3]),
    contactCentroid: r.contactCentroid ? f(r.contactCentroid) : null,
  };
}
export function mirrorPart(p: Part, sx: number, sy: number, suffix: string, body: string): Part {
  const S = new Matrix4().makeScale(sx, sy, 1);
  // 반사 후 오른손 좌표 유지: local y 축 반전 (x 반사·y 반사 각각 det -1, 둘 다면 +1)
  const flip = sx * sy < 0 ? new Matrix4().makeScale(1, -1, 1) : new Matrix4();
  const m = S.clone().multiply(p.m).multiply(flip);
  return { ...p, id: p.id + suffix, body, m };
}
export function mirrorLine(l: Line, sx: number, sy: number, suffix: string, attached?: string[]): Line {
  return { ...l, id: l.id + suffix, pts: l.pts.map((p) => mir(p, sx, sy)), attached: attached ?? l.attached };
}

// ------------------------------------------------------------------ soft: 플랩 (B1 score / B3 axle)

export interface FlapCfg {
  xh: number;
  rootLen: number;
  phiOpen: number; // rad
  phiMin: number; // rad (스토퍼)
  drumR: number;
  drumY: number;
  joint: "score" | "axle";
  Flim: number;
}

export interface SoftOut {
  parts: Part[];
  lines: Line[];
  readouts: Readout[];
  forces: number[];
  /** 실 A 상단 (whiffletree 로 연결할 점) */
  tops: Vector3[];
  metrics: Record<string, number>;
}

export function softFlap(cfg: FlapCfg, a: number, sdf: Sdf): SoftOut {
  const qmax = cfg.phiOpen - cfg.phiMin;
  const qcmd = clamp(a, 0, 1) * qmax;
  const yf = C.finray.pair_y;
  const hinge = (s: number) => V(s * cfg.xh, 0, Z_TOP);
  const axisAt = (phi: number) => V(Math.sin(phi), 0, -Math.cos(phi));
  const outAt = (phi: number) => V(Math.cos(phi), 0, Math.sin(phi));
  const frameAt = (q: number): Frame => {
    const phi = cfg.phiOpen - q;
    const A = axisAt(phi);
    return { O: hinge(1).add(V(0, yf, 0)).addScaledVector(A, cfg.rootLen), A, N: outAt(phi), W: Y };
  };
  const forceAt = (q: number) => {
    const { res, Q } = finrayGenForce(FINRAY, frameAt, 0, q, 0.004, sdf);
    let F = 0;
    if (res.contactCentroid) {
      const h = hinge(1).add(V(0, yf, 0));
      const d = Math.max(10, res.contactCentroid.clone().sub(h).setY(0).length());
      F = Q / d;
    }
    return { res, F, Q };
  };
  // 직렬 고무줄 힘 제한: F(q) = Flim 이 되는 q 에서 멈춤 (고무줄이 나머지 당김을 흡수)
  let q = qcmd;
  let sol = forceAt(q);
  if (sol.F > cfg.Flim) {
    let lo = 0;
    let hi = qcmd;
    for (let k = 0; k < 10; k++) {
      const mid = (lo + hi) / 2;
      const s2 = forceAt(mid);
      if (s2.F > cfg.Flim) hi = mid;
      else {
        lo = mid;
        sol = s2;
      }
    }
    q = lo;
    if (lo === 0) sol = forceAt(0);
  }
  const phi = cfg.phiOpen - q;
  const parts: Part[] = [];
  const lines: Line[] = [];
  const tops: Vector3[] = [];
  const A = axisAt(phi);
  const N = outAt(phi);
  // 오른쪽 플랩 한 개를 만들고 거울
  const R: Part[] = [];
  const RL: Line[] = [];
  const h = hinge(1);
  const yLo = -yf - C.finray.width / 2 - 2;
  const yHi = cfg.drumY + 5;
  const yc = (yLo + yHi) / 2;
  const a0 = h.clone().setY(yc).addScaledVector(N, 1.5);
  R.push(segPart("flap", "flap", "board", a0, a0.clone().addScaledVector(A, cfg.rootLen), yHi - yLo, C.board_t, Y));
  const fr = sol.res;
  R.push(...finrayParts("finray.F", "flap", fr, Y, C.finray.width, C.flank_t, C.straw_d));
  R.push(...finrayParts("finray.B", "flap", mirrorResult(fr, 1, -1), Y, C.finray.width, C.flank_t, C.straw_d));
  // 드럼 (골판지 원판 3겹: 큰-작은-큰 → 홈)
  R.push(cylPart("drum", "flap", "disk", h.clone().setY(cfg.drumY), Y, 9, cfg.drumR * 2));
  if (cfg.joint === "axle") {
    R.push(cylPart("axle", "flap", "straw", h.clone().setY(yc), Y, yHi - yLo + 10, C.straw_d));
  }
  // 실 A: 드럼 안쪽 접선 → 위로 (드럼이 회전해도 접선점은 고정)
  const tan = V(cfg.xh - cfg.drumR, cfg.drumY, Z_TOP);
  const wrapC = h.clone().setY(cfg.drumY + 4.6);
  const wrap = arc(wrapC, cfg.drumR, X.clone().negate(), Z.clone().negate(), 0, Math.PI / 2 - phi * 0.0 + 0.6, 8);
  RL.push({ id: "stringA", kind: "string", pts: [...wrap.reverse(), V(tan.x, tan.y + 4.6, Z_TOP + 55)], attached: ["flap", "palm"] });
  tops.push(V(tan.x, tan.y + 4.6, Z_TOP + 55));
  // 복원 고무줄: 플랩 바깥면 → 손바닥 윗면 고정점 (상시 열림)
  const rb0 = h.clone().setY(-yf).addScaledVector(A, cfg.rootLen * 0.7).addScaledVector(N, 3.2);
  RL.push({ id: "returnA", kind: "rubber", pts: [rb0, V(cfg.xh - 14, -yf, Z_TOP + 0.5)], attached: ["flap", "palm"] });
  for (const p of R) {
    parts.push({ ...p, id: p.id + ".R", body: "flapR" });
    parts.push(mirrorPart(p, -1, 1, ".L", "flapL"));
  }
  for (const l of RL) {
    lines.push({ ...l, id: l.id + ".R", attached: ["flapR", "palm"] });
    lines.push(mirrorLine(l, -1, 1, ".L", ["flapL", "palm"]));
  }
  tops.push(mir(tops[0], -1, 1));
  if (cfg.joint === "axle") {
    // 굵은 빨대 부싱 (손바닥 쪽에 접착)
    for (const s of [1, -1]) parts.push(cylPart(`bush.${s > 0 ? "R" : "L"}`, "palm", "bubble", V(s * cfg.xh, yc, Z_TOP), Y, 20, C.bubble_d));
  }
  const stretch = (qcmd - q) * cfg.drumR;
  const T = (2 * sol.Q) / cfg.drumR;
  const readouts: Readout[] = [
    { label: "Soft 플랩 각 φ", value: `${(phi / DEG).toFixed(1)}° (지령 ${((cfg.phiOpen - qcmd) / DEG).toFixed(1)}°, 스토퍼 ${(cfg.phiMin / DEG).toFixed(1)}°)` },
    { label: "Fin Ray 접촉력 (추정, 손가락당)", value: `${sol.F.toFixed(2)} N`, warn: sol.F > cfg.Flim + 0.05 },
    { label: "직렬 고무줄 늘어남 (힘 제한)", value: `${stretch.toFixed(1)} mm` },
    { label: "실 A 장력 (추정)", value: `${T.toFixed(1)} N` },
    { label: "Fin Ray 접촉 노드", value: `${fr.nContact} / ${FINRAY.nSeg}` },
  ];
  return { parts, lines, readouts, forces: [sol.F, sol.F, sol.F, sol.F], tops, metrics: { finrayF: sol.F, finrayNodes: fr.nContact, softT: T, softStretch: stretch } };
}

// ------------------------------------------------------------------ soft: 슬롯 캐리지 (B2)

export interface SlotSoftCfg {
  xMin: number;
  xOpen: number;
  wallY: number;
  slotZ: number;
  rootLen: number;
  Flim: number;
}

export function softSlot(cfg: SlotSoftCfg, a: number, sdf: Sdf): SoftOut {
  const yf = C.finray.pair_y;
  const qmax = cfg.xOpen - cfg.xMin;
  const qcmd = clamp(a, 0, 1) * qmax;
  const frameAt = (q: number): Frame => ({
    O: V(cfg.xOpen - q, yf, cfg.slotZ - cfg.rootLen),
    A: V(0, 0, -1),
    N: X.clone(),
    W: Y,
  });
  const forceAt = (q: number) => {
    const { res, Q } = finrayGenForce(FINRAY, frameAt, 0, q, 0.05, sdf);
    return { res, F: Q, Q };
  };
  let q = qcmd;
  let sol = forceAt(q);
  if (sol.F > cfg.Flim) {
    let lo = 0;
    let hi = qcmd;
    for (let k = 0; k < 10; k++) {
      const mid = (lo + hi) / 2;
      const s2 = forceAt(mid);
      if (s2.F > cfg.Flim) hi = mid;
      else {
        lo = mid;
        sol = s2;
      }
    }
    q = lo;
    if (lo === 0) sol = forceAt(0);
  }
  const u = cfg.xOpen - q;
  const R: Part[] = [];
  const RL: Line[] = [];
  const fr = sol.res;
  R.push(...finrayParts("finray.F", "car", fr, Y, C.finray.width, C.flank_t, C.straw_d));
  R.push(...finrayParts("finray.B", "car", mirrorResult(fr, 1, -1), Y, C.finray.width, C.flank_t, C.straw_d));
  // 캐리지 판 (y-z 평면) + 핀 2개 (빨대, y 방향, 벽 슬롯 관통)
  const zTop = cfg.slotZ + 5;
  const zBot = cfg.slotZ - cfg.rootLen;
  R.push(boxPart("carriage", "car", "board", [3, 2 * cfg.wallY - 4, zTop - zBot], V(u + 1.5, 0, (zTop + zBot) / 2)));
  // 캐리지 위 보강 리브 (핀 2개를 잇는 판)
  R.push(boxPart("carriage.top", "car", "board", [12, 2 * cfg.wallY - 4, 3], V(u + 7, 0, cfg.slotZ + 3.5)));
  for (const dx of [4, 10]) R.push(cylPart(`pin${dx}`, "car", "straw", V(u + dx, 0, cfg.slotZ), Y, 2 * cfg.wallY + 10, C.straw_d));
  // 실 A: 캐리지 양 끝 → 안쪽 x=16 → 위 (손바닥 구멍)
  const ys = cfg.wallY - 4;
  const sx = 16;
  RL.push({ id: "stringA", kind: "string", pts: [V(u, ys, cfg.slotZ), V(sx, ys, cfg.slotZ), V(sx, ys, Z_TOP + 55)], attached: ["car", "palm"] });
  RL.push({ id: "returnA", kind: "rubber", pts: [V(u + 10, -ys, cfg.slotZ + 1), V(cfg.xOpen + 12, -ys, cfg.slotZ + 1)], attached: ["car", "palm"] });
  const parts: Part[] = [];
  const lines: Line[] = [];
  for (const p of R) {
    parts.push({ ...p, id: p.id + ".R", body: "carR" });
    parts.push(mirrorPart(p, -1, 1, ".L", "carL"));
  }
  for (const l of RL) {
    lines.push({ ...l, id: l.id + ".R", attached: ["carR", "palm"] });
    lines.push(mirrorLine(l, -1, 1, ".L", ["carL", "palm"]));
  }
  // 가이드 벽 (손바닥에 접착) + 슬롯 표시
  const wx0 = cfg.xMin - 2;
  const wx1 = cfg.xOpen + 13;
  for (const s of [1, -1]) for (const t of [1, -1]) {
    parts.push(boxPart(`wallS.${s}${t}`, "palm", "wall", [wx1 - wx0, 3, -cfg.slotZ + 10], V(s * (wx0 + wx1) / 2, t * (cfg.wallY + 1.5 + 1), (cfg.slotZ - 10) / 2)));
    parts.push({ ...boxPart(`slotS.${s}${t}`, "palm", "slot", [wx1 - wx0 - 4, 3.4, C.straw_d + 0.6], V(s * (wx0 + wx1) / 2, t * (cfg.wallY + 2.5), cfg.slotZ)), ghost: true });
  }
  const tops = [V(sx, ys, Z_TOP + 55), V(-sx, ys, Z_TOP + 55)];
  const T = sol.Q * 2;
  return {
    parts,
    lines,
    tops,
    forces: [sol.F, sol.F, sol.F, sol.F],
    metrics: { finrayF: sol.F, finrayNodes: fr.nContact, softT: T, softStretch: qcmd - q },
    readouts: [
      { label: "Soft 캐리지 x", value: `${u.toFixed(1)} mm (지령 ${(cfg.xOpen - qcmd).toFixed(1)}, 스토퍼 ${cfg.xMin})` },
      { label: "Fin Ray 접촉력 (추정, 손가락당)", value: `${sol.F.toFixed(2)} N`, warn: sol.F > cfg.Flim + 0.05 },
      { label: "직렬 고무줄 늘어남", value: `${(qcmd - q).toFixed(1)} mm` },
      { label: "실 A 장력 (추정, 마찰 제외)", value: `${T.toFixed(1)} N` },
      { label: "Fin Ray 접촉 노드", value: `${fr.nContact} / ${FINRAY.nSeg}` },
    ],
  };
}

// ------------------------------------------------------------------ hard 공통: 손끝 샘플 / 손톱 플랩

/** 손가락 폭 방향 3점 */
export const across = (w: number) => [-w / 2 + 2, 0, w / 2 - 2];

/** 손톱 플랩: hinge 에서 축 A 방향, 바닥에 밀리면 바깥(N)쪽으로만 꺾임 (안쪽은 스토퍼) */
export function nailFold(hinge: Vector3, A: Vector3, N: Vector3, len: number, floorZ: number) {
  for (let k = 0; k <= 85; k++) {
    const al = k * DEG;
    const d = A.clone().multiplyScalar(Math.cos(al)).addScaledVector(N, Math.sin(al));
    const tip = hinge.clone().addScaledVector(d, len);
    if (tip.z >= floorZ + 0.3) return { al, d, tip };
  }
  const al = 85 * DEG;
  const d = A.clone().multiplyScalar(Math.cos(al)).addScaledVector(N, Math.sin(al));
  return { al, d, tip: hinge.clone().addScaledVector(d, len) };
}

/** 쐐기 패드: 손가락 축 A 를 바깥(N)으로 wedge 만큼 돌린 방향의 판 */
export function wedgePad(id: string, body: string, end: Vector3, A: Vector3, N: Vector3, wedge: number, faceOff: number, len: number, w: number) {
  const ap = A.clone().multiplyScalar(Math.cos(wedge)).addScaledVector(N, Math.sin(wedge));
  const np = N.clone().multiplyScalar(Math.cos(wedge)).addScaledVector(A, -Math.sin(wedge));
  const c = end.clone().addScaledVector(N, -faceOff - C.pad_t / 2).addScaledVector(ap, -len / 2);
  const ex = ap;
  const ez = np; // 두께 방향
  const ey = ez.clone().cross(ex).normalize();
  return { part: { id, body, kind: "pad" as const, size: [len, w, C.pad_t] as [number, number, number], m: basis(ex, ey, ez, c) }, ap, np, c };
}

/** 첫 접촉까지 q 를 늘림 (강체 손가락). pen(q) > 0 이면 관통. */
export function firstContact(qcmd: number, pen: (q: number) => boolean, step = 0.25 * DEG) {
  let q = 0;
  if (pen(0)) return 0;
  while (q + step <= qcmd) {
    if (pen(q + step)) {
      let lo = q;
      let hi = q + step;
      for (let k = 0; k < 10; k++) {
        const m = (lo + hi) / 2;
        if (pen(m)) hi = m;
        else lo = m;
      }
      return lo;
    }
    q += step;
  }
  return pen(qcmd) ? q : qcmd;
}

export function whiffletree(tops: Vector3[], z: number, id: string, handleZ: number): { parts: Part[]; lines: Line[] } {
  const [a, b] = tops;
  const mid = a.clone().add(b).multiplyScalar(0.5).setZ(z + 3);
  const dir = b.clone().sub(a).setZ(0).normalize();
  const side = V(0, 0, 1).cross(dir).normalize();
  const bar = segPart(`whiffle.${id}`, `whiffle.${id}`, "board", a.clone().setZ(z + 3), b.clone().setZ(z + 3), 10, 3, side);
  bar.ghost = true;
  return {
    parts: [bar],
    lines: [{ id: `handle.${id}`, kind: "string", pts: [mid, mid.clone().setZ(handleZ)], attached: [`whiffle.${id}`] }],
  };
}
