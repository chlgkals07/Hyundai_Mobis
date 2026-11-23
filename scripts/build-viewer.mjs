// 뷰어 빌드: TS(core+viewer) → IIFE 한 파일 (three 는 전역 THREE, cdnjs r128 UMD) → page.html 에 인라인
// 결과: out/gripper-bench.html (Artifact 용, doctype 없음), out/local.html (로컬/스크린샷용 전체 문서)
import { build } from "vite";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

mkdirSync("out", { recursive: true });
if (!existsSync("out/viewer-data.json")) writeFileSync("out/viewer-data.json", JSON.stringify({ generated: "", criteria: [], rows: [], recommendation: [], patterns: [] }));

async function bundle(entry, name) {
  await build({
    logLevel: "warn",
    configFile: false,
    build: {
      outDir: `out/js-${name}`,
      emptyOutDir: true,
      minify: true,
      lib: { entry, formats: ["iife"], name: "App_" + name.replace(/\W/g, "_"), fileName: () => "app.js" },
      rollupOptions: { external: ["three"], output: { globals: { three: "THREE" } } },
    },
  });
  return readFileSync(`out/js-${name}/app.js`, "utf8").replace(/<\/script/g, "<\\/script");
}
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js",
];
const tags = CDN.map((u) => `<script src="${u}"></script>`).join("\n");
const doc = (page) =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>\n${page}\n</body></html>`;
for (const [entry, tpl, out] of [
  ["src/viewer/main.ts", "src/viewer/page.html", "gripper-bench"],
  ["src/viewer/assembly.ts", "src/viewer/assembly.html", "assembly"],
]) {
  const js = await bundle(entry, out);
  const page = readFileSync(tpl, "utf8").replace("<!--APP-->", `${tags}\n<script>\n${js}\n</script>`);
  writeFileSync(`out/${out}.html`, page);
  writeFileSync(`out/${out === "gripper-bench" ? "local" : out + "-local"}.html`, doc(page));
  console.log(out, (page.length / 1024).toFixed(0), "KB");
}
