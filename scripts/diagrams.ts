// 메커니즘 단면도 → docs/diagrams/*.svg (B5N) · docs/diagrams/B5E/*.svg (B5E)
import { writeFileSync, mkdirSync } from "node:fs";
import { DIAGRAMS } from "../src/core/diagrams";
for (const [id, dir] of [["B5N", "docs/diagrams"], ["B5E", "docs/diagrams/B5E"]] as const) {
  mkdirSync(dir, { recursive: true });
  for (const d of DIAGRAMS(id)) {
    writeFileSync(`${dir}/${d.id}.svg`, d.svg);
    console.log(id, d.id);
  }
}
