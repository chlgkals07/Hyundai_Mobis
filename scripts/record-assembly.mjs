// 조립 애니메이션 → mp4. out/assembly-local.html 의 window.__render(t) 를 프레임마다 호출해 캡처 → ffmpeg.
// 사용: node scripts/record-assembly.mjs [fps=20] [out=docs/B5N-조립과정.mp4]
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const fps = Number(process.argv[2] ?? 20);
const outFile = process.argv[3] ?? "docs/B5N-조립과정.mp4";
const frames = "out/frames";
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const LOCAL = {
  "three.min.js": readFileSync("node_modules/three-r128/build/three.min.js"),
  "OrbitControls.js": readFileSync("node_modules/three-r128/examples/js/controls/OrbitControls.js"),
};
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 1 });
await page.route("**/*", (r) => {
  const u = r.request().url();
  for (const [k, v] of Object.entries(LOCAL)) if (u.endsWith(k)) return r.fulfill({ body: v, contentType: "application/javascript" });
  if (u.startsWith("file:")) return r.continue();
  return r.fulfill({ body: "" });
});
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(`file://${resolve("out/assembly-local.html")}?capture=1`);
await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 30000 });
const T = await page.evaluate(() => window.__T);
const stage = await page.$("#stage");
const n = Math.round(T * fps);
const t0 = Date.now();
for (let i = 0; i <= n; i++) {
  await page.evaluate((t) => window.__render(t), i / fps);
  await stage.screenshot({ path: `${frames}/${String(i).padStart(5, "0")}.png` });
  if (i % 200 === 0) console.log(`frame ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
if (errs.length) console.log("page errors:", errs.slice(0, 3));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${frames}/%05d.png`, "-vf", "scale=1280:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", outFile]);
console.log("wrote", outFile);
