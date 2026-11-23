// 접근 높이 오차 테스트: Rigid(건전지·케이블) 프리셋에서 손바닥을 e mm 더 내렸을 때 (팔 높이 오차) 파지가 유지되는가
import { ALL } from "../src/core/designs";
import { findCollisions } from "../src/core/collide";
import common from "../params/common.json";
import type { ObjName } from "../src/core/types";

export const ERRORS = [0, 2, 4, 6, 8, 10, 12, 14];
const O = common.objects;
export function approachOk(id: string, obj: ObjName, e: number) {
  const d = ALL.find((x) => x.id === id)!;
  const c = d.preset(obj === "cable" ? "hybrid" : "rigid", obj);
  c.palmH -= e;
  const asm = d.build(c);
  const cols = findCollisions(asm, d);
  const r = obj === "cable" ? O.cable.d / 2 : O.battery.d / 2;
  const dia = obj === "cable" ? O.cable.d : O.battery.d;
  const ok = !cols.length && asm.metrics.gap <= dia + 1.5 && asm.metrics.tipZ < 2 * r;
  return { ok, cols, m: asm.metrics, read: asm.readouts };
}
/** 연속으로 성공하는 최대 오차 */
export function maxApproachError(id: string) {
  let best = -1;
  for (const e of ERRORS) {
    if (approachOk(id, "battery", e).ok && approachOk(id, "cable", e).ok) best = e;
    else break;
  }
  return best;
}
if (process.argv[1]?.endsWith("approach.ts")) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL.map((d) => d.id);
  for (const id of ids) {
    const row = ERRORS.map((e) => {
      const r = approachOk(id, "battery", e);
      return `${e}:${r.ok ? "✓" : "✗"}`;
    });
    console.log(id.padEnd(4), "max", maxApproachError(id), "mm |", row.join(" "));
  }
}
