import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const output = await build({
  entryPoints: [fileURLToPath(new URL("./scene.js", import.meta.url))],
  bundle: true,
  write: false,
  format: "iife",
});
await writeFile(
  join(process.env.F1_WORK, "render.html"),
  '<!doctype html><meta charset="utf-8"><body><script>' +
    output.outputFiles[0].text.replace(/<\/script/gi, "<\\/script") +
    "</script>",
);
