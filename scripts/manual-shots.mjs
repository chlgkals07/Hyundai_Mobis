// 제작 설명서 그림: 조립 페이지(B5E)의 결정적 렌더(__render / __setBlock)에서 장면을 캡처 → docs/manual-img/*.png
// 사용: npm run build && node scripts/manual-shots.mjs [B6P|B5E]  (B6P 는 파일 이름 앞에 b6p-)
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const LOCAL = {
  "three.min.js": readFileSync("node_modules/three-r128/build/three.min.js"),
  "OrbitControls.js": readFileSync("node_modules/three-r128/examples/js/controls/OrbitControls.js"),
};
const OUT = "docs/manual-img";
mkdirSync(OUT, { recursive: true });
// [파일, 모드, 블록 id 또는 null, 시간]
const DID = process.argv[2] ?? "B5E";
const PRE = DID === "B5E" ? "" : DID.toLowerCase() + "-";
const SHOTS_B6P = [
  ["00-overview", "full", null, 69.5],
  ["01-cut-pattern", "full", null, 8.5],
  ["02-parts", "full", null, 25.5],
  ["03-palm", "blocks", "soft", 2.3],
  ["04-finray", "blocks", "finray", 8.8],
  ["05-soft", "blocks", "soft", 7.4],
  ["06-fold-strip", "blocks", "drum", 2.0],
  ["07-fold-box", "blocks", "drum", 5.8],
  ["08-fold-skew", "blocks", "drum", 8.6],
  ["09-hard-top", "blocks", "hard", 2.4],
  ["10-hard-box", "blocks", "hard", 5.4],
  ["11-hard-tip", "blocks", "hard", 9.4],
  ["12-strings", "blocks", "strings", 3.9],
  ["13-grip-battery", "full", null, 76.5],
  ["14-grip-chip", "full", null, 82.5],
];
const SHOTS_B5E = [
  ["00-overview", "full", null, 69.5],
  ["01-cut-pattern", "full", null, 8.5],
  ["02-parts", "full", null, 25.5],
  ["03-palm", "blocks", "soft", 2.3],
  ["04-finray", "blocks", "finray", 8.8],
  ["05-soft-lever", "blocks", "soft", 7.4],
  ["06-hard-lever", "blocks", "drum", 9.5],
  ["07-hard-bracket", "blocks", "hard", 3.4],
  ["08-hard-links", "blocks", "hard", 7.4],
  ["09-hard-tip", "blocks", "hard", 11.4],
  ["10-strings", "blocks", "strings", 3.9],
  ["11-grip-battery", "full", null, 76.5],
  ["12-grip-chip", "full", null, 82.5],
];
const SHOTS = DID === "B6P" ? SHOTS_B6P : SHOTS_B5E;
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 860 }, deviceScaleFactor: 1 });
await page.route("**/*", (r) => {
  const u = r.request().url();
  for (const [k, v] of Object.entries(LOCAL)) if (u.endsWith(k)) return r.fulfill({ body: v, contentType: "application/javascript" });
  if (u.startsWith("file:")) return r.continue();
  return r.fulfill({ body: "" });
});
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
for (const [name, mode, block, t] of SHOTS) {
  await page.goto(`file://${resolve("out/assembly-local.html")}?capture=1&d=${DID}`); // 해시 없이: 탭 전환이 자동 재생을 켜서 장면을 덮어씀
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 30000 });
  if (block) await page.evaluate((b) => window.__setBlock(b), block);
  await page.evaluate((tt) => window.__render(tt), t);
  // 자막·시간 숨김 (그림만), 전개도 장면은 종이 유지
  await page.evaluate(() => {
    for (const id of ["cap", "time"]) document.getElementById(id).style.visibility = "hidden";
  });
  // 자막 자리(왼쪽 ~18%)는 비어 있으니 잘라냄 (전개도 장면은 가운데라 그대로)
  const bb = await (await page.$("#stage")).boundingBox();
  const cut = name.includes("cut-pattern") ? 0 : 0.16;
  await page.screenshot({ path: `${OUT}/${PRE}${name}.png`, clip: { x: bb.x + bb.width * cut, y: bb.y, width: bb.width * (1 - cut), height: bb.height } });
  console.log(name);
}
await browser.close();
if (errs.length) console.log("page errors:", errs.slice(0, 3));
