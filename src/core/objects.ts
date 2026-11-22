import { Vector3 } from "three";
import common from "../../params/common.json";
import type { ObjInstance, ObjName } from "./types";

const O = common.objects;

/** 바닥(z = floorZ) 위, 원점 중심에 놓인 물체. SDF 는 바깥 양수. */
export function makeObject(name: ObjName, floorZ: number): ObjInstance {
  switch (name) {
    case "battery":
    case "cable": {
      const o = O[name];
      const r = o.d / 2;
      const c = new Vector3(0, 0, floorZ + r);
      return {
        name,
        shape: { kind: "cyl", r, len: o.len, axis: "x", c },
        sdf: (p) => {
          const dr = Math.hypot(p.y - c.y, p.z - c.z) - r;
          const dl = Math.abs(p.x - c.x) - o.len / 2;
          return sdfCyl(dr, dl);
        },
      };
    }
    case "cap": {
      const o = O.cap;
      const r = o.d / 2;
      const c = new Vector3(0, 0, floorZ + o.len / 2);
      return {
        name,
        shape: { kind: "cyl", r, len: o.len, axis: "z", c },
        sdf: (p) => sdfCyl(Math.hypot(p.x, p.y) - r, Math.abs(p.z - c.z) - o.len / 2),
      };
    }
    case "chip": {
      const o = O.chip;
      const c = new Vector3(0, 0, floorZ + o.c);
      return {
        name,
        shape: { kind: "ellip", a: o.a, b: o.b, c3: o.c, c },
        sdf: (p) => {
          const q = new Vector3((p.x - c.x) / o.a, (p.y - c.y) / o.b, (p.z - c.z) / o.c);
          return (q.length() - 1) * Math.min(o.a, o.b, o.c);
        },
      };
    }
    case "sponge": {
      const o = O.sponge;
      const c = new Vector3(0, 0, floorZ + o.sz / 2);
      return {
        name,
        shape: { kind: "box", sx: o.sx, sy: o.sy, sz: o.sz, c },
        sdf: (p) => {
          const qx = Math.abs(p.x - c.x) - o.sx / 2;
          const qy = Math.abs(p.y - c.y) - o.sy / 2;
          const qz = Math.abs(p.z - c.z) - o.sz / 2;
          const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
          return out + Math.min(Math.max(qx, qy, qz), 0);
        },
      };
    }
  }
}

function sdfCyl(dr: number, dl: number) {
  return Math.min(Math.max(dr, dl), 0) + Math.hypot(Math.max(dr, 0), Math.max(dl, 0));
}

/** 물체 + 바닥을 합친 SDF */
export function sceneSdf(obj: ObjInstance | null, floorZ: number) {
  return (p: Vector3) => {
    const df = p.z - floorZ;
    return obj ? Math.min(df, obj.sdf(p)) : df;
  };
}
