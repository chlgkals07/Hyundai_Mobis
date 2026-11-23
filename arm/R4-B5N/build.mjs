import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const local = (name) => new URL(name, import.meta.url);
const result = await build({
  entryPoints: [fileURLToPath(local("viewer.ts"))],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const template = await readFile(local("template.html"), "utf8");
await writeFile(
  local("R4-B5N.html"),
  template.replace("<!-- VIEWER -->", () => "<script>" + script + "</script>"),
);
