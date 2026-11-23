// 메커니즘 단면도 → docs/diagrams/*.svg
import { writeFileSync, mkdirSync } from "node:fs";
import { DIAGRAMS } from "../src/core/diagrams";
mkdirSync("docs/diagrams", { recursive: true });
for (const d of DIAGRAMS()) {
  writeFileSync(`docs/diagrams/${d.id}.svg`, d.svg);
  console.log(d.id);
}
