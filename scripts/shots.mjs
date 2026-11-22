// Playwright 스크린샷: out/local.html 을 열고 CDN 요청은 node_modules 의 three r128 로 대체.
// 사용: node scripts/shots.mjs "B1:rigid:battery:3d" "B2:soft:chip:front" ...  (인자 없으면 기본 세트)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL = {
  "three.min.js": readFileSync("node_modules/three-r128/build/three.min.js"),
  "OrbitControls.js": readFileSync("node_modules/three-r128/examples/js/controls/OrbitControls.js"),
};
const args = process.argv.slice(2);
const sets = args.length
  ? args
  : ["B1", "B2", "B3", "V5", "V5b"].flatMap((d) => [`${d}:open:none:3d`, `${d}:soft:chip:3d`, `${d}:rigid:battery:3d`, `${d}:rigid:battery:side`, `${d}:hybrid:cable:front`]);
const outDir = process.env.SHOTS ?? "docs/shots";
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
await page.route("**/*", (route) => {
  const u = route.request().url();
  for (const [k, v] of Object.entries(LOCAL)) if (u.endsWith(k)) return route.fulfill({ body: v, contentType: "application/javascript" });
  if (u.startsWith("file:")) return route.continue();
  return route.fulfill({ body: "", contentType: "text/css" }); // 폰트 등 외부 차단
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
for (const s of sets) {
  const [d, m, o, v, extra] = s.split(":");
  const q = new URLSearchParams({ d, m, o, v });
  if (extra) for (const kv of extra.split(",")) { const [k, val] = kv.split("="); q.set(k, val); }
  await page.goto(`file://${resolve("out/local.html")}?${q}`);
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const el = await page.$(process.env.FULL ? "body" : "#stage");
  const f = `${outDir}/${s.replace(/[:,=]/g, "_")}.png`;
  await el.screenshot({ path: f });
  const status = await page.textContent("#stat");
  console.log(f, "|", status);
}
if (errors.length) console.log("page errors:", errors);
await browser.close();
