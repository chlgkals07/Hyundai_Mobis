import { ALL } from "../src/core/designs";
import { findCollisions } from "../src/core/collide";
import type { ModeName, ObjName } from "../src/core/types";

const cases: [ModeName, ObjName | null][] = [
  ["open", null], ["soft", "chip"], ["soft", "sponge"], ["rigid", "battery"], ["rigid", "cap"], ["hybrid", "cable"],
];
const only = process.argv[2];
let bad = 0;
for (const d of ALL) {
  if (only && d.id !== only) continue;
  console.log(`\n=== ${d.id} ${d.name}`);
  for (const [m, o] of cases) {
    const c = d.preset(m, o);
    const t0 = performance.now();
    const asm = d.build(c);
    const col = findCollisions(asm, d);
    const ms = performance.now() - t0;
    bad += col.length;
    console.log(`-- ${m}/${o ?? "-"} palmH=${c.palmH.toFixed(1)} (${ms.toFixed(0)} ms, ${asm.parts.length} parts)`);
    for (const r of asm.readouts) console.log(`   ${r.warn ? "!" : " "} ${r.label}: ${r.value}`);
    for (const k of col) console.log(`   ✗ ${k}`);
  }
}
console.log(`\ncollisions total: ${bad}`);
