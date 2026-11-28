// B6P 최종 인쇄 묶음: 표지(목차·인쇄 설정) + 전량판 전개도(A4 1:1) + 도면(단면도·손바닥 지도, A4 가로) + 부품표
// 사용: npx tsx scripts/patterns.ts && npx tsx scripts/diagrams.ts && node scripts/final-print.mjs [팔 원척 PDF 경로(선택)]
// 결과: docs/print/B6P-최종-전개도+도면-A4.pdf (그리고 팔 PDF 를 주면 docs/print 밖 out/print/…+팔.pdf)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = "out/print";
mkdirSync(OUT, { recursive: true });
mkdirSync("docs/print", { recursive: true });
const calc = JSON.parse(readFileSync("calc/out/B6P.json", "utf8")).derived;
const readme = readFileSync("patterns/B6P/README.md", "utf8");
const fullPdf = "patterns/B6P/B6P-전개도-전량-A4.pdf";
const nFull = Number(execFileSync("python3", ["-c", `import pypdf;print(len(pypdf.PdfReader(${JSON.stringify(fullPdf)}).pages))`]).toString());
const DIAG = [
  ["palm-top", "도면 1 · 손바닥 윗장 — 구멍·Fin Ray 풀칠 자리 (위에서, 실제 좌표)"],
  ["palm-bottom", "도면 2 · 손바닥 아랫면 — 접는 상자·스토퍼 블록 자리"],
  ["hard", "도면 3 · hard 측면 단면 — 접는 상자(평행사변형) · 교차 실"],
  ["soft", "도면 4 · soft 정면 단면 — 날개 · Fin Ray · 교차 실"],
  ["fold", "도면 5 · 접는 상자 만드는 법"],
];
const nDiag = DIAG.length;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = `body{margin:0;font-family:"WenQuanYi Zen Hei","IBM Plex Sans KR",sans-serif;color:#1d2422}
h1{font-size:19pt;margin:0 0 3mm}.sub{color:#555;font-size:10pt;margin-bottom:6mm}
table{border-collapse:collapse;width:100%;font-size:9.5pt;margin-bottom:5mm}td,th{border-bottom:.3mm solid #ccc;padding:1.6mm 2mm;text-align:left;vertical-align:top}th{color:#555;font-weight:500}
.box{border:.5mm solid #2f6b5b;border-radius:2mm;padding:3mm 4mm;font-size:10pt;line-height:1.55;margin-bottom:5mm}.box b{color:#2f6b5b}
.ruler{position:relative;height:10mm;margin-top:4mm}.ruler .l{position:absolute;left:0;top:0;width:100mm;border-top:.3mm solid #000}.ruler i{position:absolute;top:0;border-left:.3mm solid #000;height:2.5mm}.ruler span{position:absolute;top:4mm;font-size:8pt;color:#555}`;
const ruler = `<div class="ruler"><div class="l"></div>${Array.from({ length: 11 }, (_, i) => `<i style="left:${i * 10}mm;height:${i % 5 ? 2.5 : 4}mm"></i>`).join("")}<span>100 mm</span></div>`;
const p1 = 2;
const pD = 2 + nFull;
const pB = pD + nDiag;
const cover = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>@page{size:A4;margin:0}${css}.pg{width:210mm;height:297mm;box-sizing:border-box;padding:16mm 15mm}</style></head><body><div class="pg">
<h1>B6P 골판지 그리퍼 — 최종 전개도 + 도면</h1>
<div class="sub">영상 과제용 간이 그리퍼 · 접는 평행사변형 hard + Fin Ray soft · 교차 실 · ${new Date().toISOString().slice(0, 10)}</div>
<div class="box"><b>인쇄</b>: A4 · <b>실제 크기 100%</b> ("페이지에 맞춤" 끄기) · 여백 없음 · 방향 자동 (도면 쪽은 가로)<br>
인쇄 후 아래 100 mm 눈금과 전개도 각 쪽 눈금을 자로 확인. <b>전개도는 1:1</b>, 도면은 설명용(축척 없음 — 치수는 적힌 숫자 기준).</div>
<table><thead><tr><th>쪽</th><th>내용</th><th>메모</th></tr></thead><tbody>
<tr><td>1</td><td>표지</td><td>인쇄 생략 가능</td></tr>
<tr><td>${p1}–${p1 + nFull - 1}</td><td><b>전개도 전량판</b> (26조각, 1:1)</td><td>수량만큼 모두 그려짐 → 붙이고 자르기만. #번호 = 설명서 번호</td></tr>
<tr><td>${pD}–${pD + nDiag - 1}</td><td><b>도면</b> 5장</td><td>손바닥 윗면·아랫면 지도(구멍·풀칠 자리), hard·soft 단면, 접는 상자</td></tr>
<tr><td>${pB}</td><td>부품표 · 실 경로 · 준비물</td><td>작업대 옆에 두고 보기</td></tr>
</tbody></table>
<table><thead><tr><th>핵심 수치 (SymPy)</th><th></th></tr></thead><tbody>
<tr><td>건전지 집을 때 손바닥 높이</td><td>${calc.rigid_palm_height.toFixed(1)} mm</td></tr>
<tr><td>hard 개구 / soft 열림</td><td>${calc.hard_opening_mm.toFixed(0)} mm / 30°</td></tr>
<tr><td>실 장력 (손가락 하나, 영상용 힘)</td><td>hard ${calc.hard_string_T_video_N.toFixed(1)} N · soft ${calc.soft_string_T_video_N.toFixed(1)} N</td></tr>
<tr><td>손잡이 힘 (두 가닥 + 구멍 빨대, 팔 마찰 제외)</td><td>hard ${calc.hard_hand_loop_straw_N.toFixed(0)} N · soft ${calc.soft_hand_loop_straw_N.toFixed(0)} N</td></tr>
<tr><td>당기는 거리</td><td>hard ${calc.hard_pull_mm.toFixed(0)} mm · soft ${calc.soft_pull_mm.toFixed(0)} mm</td></tr>
<tr><td>손톱 수직 순응</td><td>${calc.vertical_compliance_mm.toFixed(1)} mm</td></tr>
</tbody></table>
<div class="box"><b>꼭 지킬 3가지</b>: ① 접는 상자 두 링크(75 mm) 길이 동일 ② 날개 접는 선에 풀 금지 ③ Fin Ray 빨대 끝은 테이프 (풀 금지)<br>
<b>먼저</b>: 손가락 1개 + Fin Ray 1개를 만들어 휘는 정도·관절·실 당김을 확인한 뒤 나머지.</div>
${ruler}</div></body></html>`;
const diagPages = DIAG.map(([id, title]) => {
  const svg = readFileSync(`docs/diagrams/B6P/${id}.svg`, "utf8");
  return `<div class="pg"><div class="t">${esc(title)}</div><div class="f">${svg}</div><div class="n">설명용 도면 · 축척 없음 · 단위 mm · 실선 = 쥔/닫힌 자세, 점선 = 열린 자세</div></div>`;
}).join("");
const diag = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:0}${css}
.pg{width:297mm;height:210mm;box-sizing:border-box;padding:10mm 12mm;page-break-after:always;display:flex;flex-direction:column}
.t{font-size:14pt;font-weight:700;margin-bottom:3mm}.f{flex:1;display:flex;align-items:center;justify-content:center;min-height:0}.f svg{width:100%;height:100%;max-height:170mm}.n{font-size:8.5pt;color:#666}</style></head><body>${diagPages}</body></html>`;
// 부품표 (README 의 표·부자재·조립 순서)
const md = readme.split("\n");
const rows = md.filter((l) => /^\| \d+ \|/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
const sub = (h) => {
  const i = md.findIndex((l) => l.startsWith(h));
  const out = [];
  for (let k = i + 1; k < md.length && !md[k].startsWith("## "); k++) if (md[k].trim()) out.push(md[k].replace(/^[-\d.]+\s*/, ""));
  return out;
};
const bom = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>@page{size:A4;margin:0}${css}.pg{width:210mm;height:297mm;box-sizing:border-box;padding:12mm 12mm}table{font-size:8.2pt}li{font-size:8.6pt;margin-bottom:1mm;line-height:1.4}h2{font-size:11pt;margin:3mm 0 2mm}</style></head><body><div class="pg">
<h1>부품표 · 실 경로 · 조립 순서</h1>
<table><thead><tr><th>#</th><th>부품</th><th>수량</th><th>크기</th><th>재료</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join("")}</tbody></table>
<h2>부자재 · 실 · 고무줄</h2><ul>${sub("## 부자재").map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<h2>조립 순서</h2><ol>${sub("## 조립 순서").map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
</div></body></html>`;
writeFileSync(`${OUT}/cover.html`, cover);
writeFileSync(`${OUT}/diagrams.html`, diag);
writeFileSync(`${OUT}/bom.html`, bom);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const n of ["cover", "diagrams", "bom"]) {
  await page.goto(`file://${resolve(`${OUT}/${n}.html`)}`);
  await page.pdf({ path: `${OUT}/${n}.pdf`, printBackground: true, preferCSSPageSize: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
}
await browser.close();
const final = "docs/print/B6P-최종-전개도+도면-A4.pdf";
const arm = process.argv[2];
const merge = (files, out) =>
  execFileSync("python3", ["-c", `import pypdf,sys\nw=pypdf.PdfWriter()\nfor f in sys.argv[2:]:\n  [w.add_page(p) for p in pypdf.PdfReader(f).pages]\nw.write(sys.argv[1])\nprint(len(pypdf.PdfReader(sys.argv[1]).pages))`, out, ...files]).toString().trim();
console.log(final, merge([`${OUT}/cover.pdf`, fullPdf, `${OUT}/diagrams.pdf`, `${OUT}/bom.pdf`], final), "쪽");
if (arm && existsSync(arm)) {
  const withArm = `${OUT}/B6P-최종-전개도+도면+팔R5F1-A4.pdf`;
  console.log(withArm, merge([final, arm], withArm), "쪽");
}
