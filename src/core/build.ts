import { Matrix4, Quaternion, Vector3 } from "three";
import type { Part, PartKind } from "./types";
import type { FinrayResult } from "./finray";

export const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
export const DEG = Math.PI / 180;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** 기저 (ex, ey, ez — 서로 직교 unit) + 중심 → Matrix4 */
export function basis(ex: Vector3, ey: Vector3, ez: Vector3, c: Vector3) {
  return new Matrix4().makeBasis(ex, ey, ez).setPosition(c);
}

/** 두 점 사이 막대/판: local x = a→b, local z ≈ up 힌트와 직교, size = [|ab|, sy, sz] */
export function segPart(
  id: string,
  body: string,
  kind: PartKind,
  a: Vector3,
  b: Vector3,
  sy: number,
  sz: number,
  side: Vector3,
): Part {
  const ex = b.clone().sub(a);
  const len = ex.length();
  ex.normalize();
  const ey = side.clone().sub(ex.clone().multiplyScalar(side.dot(ex))).normalize();
  const ez = ex.clone().cross(ey);
  return { id, body, kind, size: [len, sy, sz], m: basis(ex, ey, ez, a.clone().add(b).multiplyScalar(0.5)) };
}

export function boxPart(id: string, body: string, kind: PartKind, size: [number, number, number], c: Vector3, m?: Matrix4): Part {
  const mm = m ? m.clone() : new Matrix4();
  mm.setPosition(c);
  return { id, body, kind, size, m: mm };
}

/** 실린더(빨대/드럼): 축 dir, 중심 c, 길이 len, 지름 d */
export function cylPart(id: string, body: string, kind: PartKind, c: Vector3, dir: Vector3, len: number, d: number): Part {
  const q = new Quaternion().setFromUnitVectors(V(1, 0, 0), dir.clone().normalize());
  const m = new Matrix4().makeRotationFromQuaternion(q).setPosition(c);
  return { id, body, kind, size: [len, d, d], m };
}

/** Fin Ray 결과 → 부품 (플랭크 마디 = flank 판, 리브 = 빨대, 밑변 = board) */
export function finrayParts(id: string, body: string, r: FinrayResult, W: Vector3, width: number, flankT: number, strawD: number): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < r.contact.length - 1; i++)
    out.push(segPart(`${id}.c${i}`, body, "flank", r.contact[i], r.contact[i + 1], width, flankT, W));
  for (let i = 0; i < r.back.length - 1; i++)
    out.push(segPart(`${id}.b${i}`, body, "flank", r.back[i], r.back[i + 1], width, flankT, W));
  r.ribs.forEach(([a, b], k) => {
    const ex = b.clone().sub(a);
    const len = ex.length();
    // 리브 = 빨대: 폭 방향(W)으로 눕힌 빨대가 아니라, c—b 를 잇는 빨대 (양끝 테이프 힌지)
    out.push(cylPart(`${id}.rib${k}`, body, "straw", a.clone().add(b).multiplyScalar(0.5), ex, len, strawD));
  });
  out.push(segPart(`${id}.base`, body, "board", r.contact[0], r.back[0], width, 3, W));
  return out;
}

/** 실린더 외부의 접선점: 원 중심 c(평면), 반지름 r, 접선 방향 t(unit) 이 주어지면 접점 */
export function tangentPoint(c: Vector3, r: number, normalOut: Vector3) {
  return c.clone().addScaledVector(normalOut.clone().normalize(), r);
}

/** 원호 점열 (드럼에 감긴 실 표시) */
export function arc(c: Vector3, r: number, u: Vector3, v: Vector3, a0: number, a1: number, n = 10) {
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(c.clone().addScaledVector(u, r * Math.cos(a)).addScaledVector(v, r * Math.sin(a)));
  }
  return pts;
}
