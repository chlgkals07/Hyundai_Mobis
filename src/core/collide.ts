import { Vector3 } from "three";
import type { Assembly, Design, Part } from "./types";

interface OBB {
  c: Vector3;
  ax: Vector3[];
  h: number[];
}

const TOL = 0.4; // mm. 접착/맞닿음은 충돌로 보지 않음

function obb(p: Part): OBB {
  const e = p.m.elements;
  const ax = [new Vector3(e[0], e[1], e[2]), new Vector3(e[4], e[5], e[6]), new Vector3(e[8], e[9], e[10])].map((v) =>
    v.normalize(),
  );
  const h = p.size.map((s) => Math.max(s / 2 - TOL, 0.01));
  return { c: new Vector3(e[12], e[13], e[14]), ax, h };
}

function sat(a: OBB, b: OBB) {
  const axes: Vector3[] = [...a.ax, ...b.ax];
  for (const u of a.ax) for (const v of b.ax) {
    const cr = u.clone().cross(v);
    if (cr.lengthSq() > 1e-8) axes.push(cr.normalize());
  }
  const d = b.c.clone().sub(a.c);
  for (const L of axes) {
    const ra = a.h.reduce((s, h, i) => s + h * Math.abs(a.ax[i].dot(L)), 0);
    const rb = b.h.reduce((s, h, i) => s + h * Math.abs(b.ax[i].dot(L)), 0);
    if (Math.abs(d.dot(L)) > ra + rb) return false;
  }
  return true;
}

function corners(o: OBB) {
  const out: Vector3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    out.push(o.c.clone().addScaledVector(o.ax[0], sx * o.h[0]).addScaledVector(o.ax[1], sy * o.h[1]).addScaledVector(o.ax[2], sz * o.h[2]));
  return out;
}

function segHitsObb(a: Vector3, b: Vector3, o: OBB) {
  // slab test in OBB local
  const da = a.clone().sub(o.c);
  const dir = b.clone().sub(a);
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    const p = da.dot(o.ax[i]);
    const dd = dir.dot(o.ax[i]);
    const h = o.h[i] - 0.6;
    if (h <= 0) return false;
    if (Math.abs(dd) < 1e-9) {
      if (Math.abs(p) > h) return false;
    } else {
      let ta = (-h - p) / dd;
      let tb = (h - p) / dd;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** 충돌 목록 (사람이 읽는 문자열). 물체와의 관통은 1.5 mm 이상만 보고. */
export function findCollisions(asm: Assembly, design: Design): string[] {
  const adj = new Set(design.adjacent.map(([a, b]) => [a, b].sort().join("|")));
  const parts = asm.parts.filter((p) => !p.ghost);
  const obbs = parts.map(obb);
  const hits = new Map<string, number>();
  const detail = new Map<string, string>();
  const add = (k: string, d = "") => {
    hits.set(k, (hits.get(k) ?? 0) + 1);
    if (d && !detail.has(k)) detail.set(k, d);
  };
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const A = parts[i];
      const B = parts[j];
      if (A.body === B.body) continue;
      if (adj.has([A.body, B.body].sort().join("|"))) continue;
      if (obbs[i].c.distanceTo(obbs[j].c) > (Math.hypot(...A.size) + Math.hypot(...B.size)) / 2) continue;
      if (sat(obbs[i], obbs[j])) add(`부품 간섭: ${A.body} ↔ ${B.body}`, `${A.id} / ${B.id}`);
    }
  }
  // 바닥 관통 (손톱 nail 은 바닥 접촉 허용)
  for (let i = 0; i < parts.length; i++) {
    const lo = Math.min(...corners(obbs[i]).map((c) => c.z));
    if (lo < asm.floorZ - 1.0) add(`바닥 관통: ${parts[i].body}`, `${parts[i].id} ${(lo - asm.floorZ).toFixed(1)} mm`);
  }
  // 물체 관통
  if (asm.object) {
    const sdf = asm.object.sdf;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].kind === "pad") continue; // 패드는 눌림 허용
      const pts = [obbs[i].c, ...corners(obbs[i])];
      if (pts.some((p) => sdf(p) < -1.5)) add(`물체 관통: ${parts[i].body}`, parts[i].id);
    }
  }
  // 실 경로
  for (const ln of asm.lines) {
    for (let k = 0; k < ln.pts.length - 1; k++) {
      for (let i = 0; i < parts.length; i++) {
        if (ln.attached?.includes(parts[i].body)) continue;
        if (segHitsObb(ln.pts[k], ln.pts[k + 1], obbs[i])) add(`실 걸림: ${ln.id} ↔ ${parts[i].body}`, parts[i].id);
      }
    }
  }
  return [...hits.entries()].map(([k, n]) => `${k}${n > 1 ? ` (×${n})` : ""}${detail.has(k) ? ` [${detail.get(k)}]` : ""}`);
}
