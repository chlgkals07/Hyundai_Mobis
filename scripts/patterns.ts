// 전개도 → A4 SVG (1:1 mm) + PDF (Chromium 인쇄, 100%) + 뷰어용 데이터
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { PATTERNS, type Shape, type P2 } from "../src/core/pattern";
import { CURRENT } from "../src/core/designs";
const isCurrent = (id: string) => CURRENT.some((d) => d.id === id);

const A4 = { w: 210, h: 297 };
const M = 10; // 여백
const PAD = 6;
const LABEL = 9;

interface Placed { s: Shape; x: number; y: number; rot: boolean }

function dims(s: Shape, rot: boolean) {
  return rot ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
}

/** 라벨 폭 추정 (mm): 한글 ≈ 글자크기, 그 외 ≈ 0.6 × 글자크기 */
function textW(t: string, size = 3.1) {
  let w = 0;
  for (const ch of t) w += /[ㄱ-힝]/.test(ch) ? size : size * 0.6;
  return w;
}
// 전량판(full) 부품은 라벨에 원래 번호·순번이 이미 들어 있음: "#6 바깥 링크 막대 (3/8)"
const labelLine = (s: Shape, idx: number) => ((s as Shape & { full?: boolean }).full ? s.label : `${idx}. ${s.label} ×${s.qty}`);

/** bottom-left 배치: 후보점(왼쪽 위, 기존 부품의 오른쪽·아래)에서 겹치지 않는 가장 위·왼쪽 자리 */
function pack(shapes: Shape[]): Placed[][] {
  const maxW = A4.w - 2 * M;
  const top0 = M + 14;
  const maxY = A4.h - M - 16;
  type R = { x: number; y: number; w: number; h: number };
  type Pg = { items: Placed[]; rects: R[] };
  const pages: Pg[] = [];
  const items = [...shapes].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const s of items) {
    const rot = s.w > maxW;
    const d = dims(s, rot);
    const lw = Math.max(textW(labelLine(s, 99)), textW(`${n(s.w)}×${n(s.h)} · ${s.material}`, 2.6)) * 1.08;
    const bw = Math.min(Math.max(d.w, lw), maxW) + PAD;
    const bh = d.h + LABEL + PAD;
    if (d.w > maxW || d.h + LABEL > maxY - top0) throw new Error(`부품이 A4 보다 큼: ${s.label} ${s.w}×${s.h}`);
    const fits = (pg: Pg, x: number, y: number) =>
      x + bw - PAD <= M + maxW + 0.01 && y + bh - PAD <= maxY && !pg.rects.some((r) => x < r.x + r.w && x + bw > r.x && y < r.y + r.h && y + bh > r.y);
    const place = (pg: Pg) => {
      const cands: [number, number][] = [[M, top0], ...pg.rects.flatMap((r) => [[r.x + r.w, r.y], [r.x, r.y + r.h], [M, r.y + r.h]] as [number, number][])];
      cands.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      for (const [x, y] of cands) {
        if (fits(pg, x, y)) {
          pg.rects.push({ x, y, w: bw, h: bh });
          pg.items.push({ s, x, y, rot });
          return true;
        }
      }
      return false;
    };
    if (!pages.some(place)) {
      const pg: Pg = { items: [], rects: [] };
      pages.push(pg);
      place(pg);
    }
  }
  return pages.map((p) => p.items);
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

function shapeSvg(pl: Placed, idx: number) {
  const { s, x, y, rot } = pl;
  // local → page: rot 이면 (u,v) → (v, w-u)... 시계 반대 90°: (u,v) → (h - v, u) 대신 단순히 (v, u) 전치 후 좌우 유지
  const T = (p: P2): P2 => (rot ? [x + p[1], y + (s.w - p[0])] : [x + p[0], y + p[1]]);
  const out: string[] = [];
  const poly = (pts: P2[], closed: boolean, cls: string) =>
    `<${closed ? "polygon" : "polyline"} class="${cls}" points="${pts.map((p) => T(p).map(n).join(",")).join(" ")}"/>`;
  for (const g of s.glue) {
    const pts: P2[] = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]];
    out.push(poly(pts, true, "glue"));
  }
  for (const c of s.cut) out.push(poly(c.pts, c.closed, "cut"));
  for (const [a, b] of s.score) out.push(poly([a, b], false, "score"));
  for (const [a, b] of s.mark) out.push(poly([a, b], false, "mark"));
  for (const h of s.holes) {
    const c = T(h.c);
    out.push(`<circle class="hole" cx="${n(c[0])}" cy="${n(c[1])}" r="${n(h.d / 2)}"/>`);
    out.push(`<path class="cross" d="M${n(c[0] - 1)} ${n(c[1])}h2M${n(c[0])} ${n(c[1] - 1)}v2"/>`);
  }
  for (const t of s.text) {
    const p = T(t.p);
    out.push(`<text x="${n(p[0])}" y="${n(p[1])}" font-size="${t.size ?? 3}" ${rot ? `transform="rotate(-90 ${n(p[0])} ${n(p[1])})"` : ""}>${t.s}</text>`);
  }
  // 골 방향 화살표
  if (s.flute) {
    const d = dims(s, rot);
    const along = (s.flute === "x") !== rot ? "x" : "y";
    const cx = x + d.w - 9;
    const cy = y + 9;
    out.push(
      along === "x"
        ? `<path class="flute" d="M${n(cx - 5)} ${n(cy)}H${n(cx + 5)}M${n(cx + 3)} ${n(cy - 2)}L${n(cx + 5)} ${n(cy)}L${n(cx + 3)} ${n(cy + 2)}M${n(cx - 3)} ${n(cy - 2)}L${n(cx - 5)} ${n(cy)}L${n(cx - 3)} ${n(cy + 2)}"/>`
        : `<path class="flute" d="M${n(cx)} ${n(cy - 5)}V${n(cy + 5)}M${n(cx - 2)} ${n(cy + 3)}L${n(cx)} ${n(cy + 5)}L${n(cx + 2)} ${n(cy + 3)}M${n(cx - 2)} ${n(cy - 3)}L${n(cx)} ${n(cy - 5)}L${n(cx + 2)} ${n(cy - 3)}"/>`,
    );
  }
  const d = dims(s, rot);
  out.push(`<text class="lbl" x="${n(x)}" y="${n(y + d.h + 4)}">${labelLine(s, idx)}</text>`);
  out.push(`<text class="dim" x="${n(x)}" y="${n(y + d.h + 7.6)}">${n(s.w)}×${n(s.h)} · ${s.material}</text>`);
  return out.join("\n");
}

const STYLE = `<style>
.cut{fill:none;stroke:#000;stroke-width:.3}
.score{fill:none;stroke:#1565c0;stroke-width:.35;stroke-dasharray:2 1.2}
.mark{fill:none;stroke:#777;stroke-width:.25;stroke-dasharray:3 1 .6 1}
.glue{fill:url(#hatch);stroke:none}
.hole{fill:none;stroke:#c62828;stroke-width:.3}
.cross{stroke:#c62828;stroke-width:.2}
.flute{fill:none;stroke:#2e7d32;stroke-width:.35}
text{font-family:"WenQuanYi Zen Hei","IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;fill:#222}
.lbl{font-size:3.1px;font-weight:bold}.dim{font-size:2.6px;fill:#666}
.hdr{font-size:4.2px;font-weight:bold}.small{font-size:2.6px;fill:#555}
</style>`;

function pageSvg(title: string, pageNo: number, pages: number, placed: Placed[], startIdx: number) {
  const parts = placed.map((p, i) => shapeSvg(p, startIdx + i)).join("\n");
  const ry = A4.h - M - 6;
  const ruler: string[] = [`<path class="cut" d="M${M} ${ry}h100"/>`];
  for (let i = 0; i <= 100; i += 10) ruler.push(`<path class="cut" d="M${M + i} ${ry}v${i % 50 === 0 ? -4 : -2.5}"/>`);
  ruler.push(`<text class="small" x="${M}" y="${ry + 4}">100 mm — 인쇄 후 자로 재서 100 mm 가 아니면 배율(실제 크기 100%) 확인</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">
<defs><pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V2" stroke="#e08a00" stroke-width=".35"/></pattern></defs>
${STYLE}
<rect width="210" height="297" fill="#fff"/>
<text class="hdr" x="${M}" y="${M + 4}">${title} — 전개도 ${pageNo}/${pages}</text>
<text class="small" x="${M}" y="${M + 9}">실선 자르기 · 파란 점선 접기(score) · 회색 일점쇄선 붙일 위치 · 주황 빗금 풀칠 · 빨간 원 구멍 · 초록 화살표 골 방향 · 1:1 mm</text>
${parts}
${ruler.join("\n")}
</svg>`;
}

const viewerPatterns: { id: string; name: string; group: string; sheets: string[]; bom: string[]; steps: string[] }[] = [];
const require = createRequire(import.meta.url);
const pdfJobs: { html: string; pdf: string }[] = [];
for (const dp of PATTERNS) {
  const dir = isCurrent(dp.id) ? `patterns/${dp.id}` : `patterns/old/${dp.id}`;
  mkdirSync(dir, { recursive: true });
  const pages = pack(dp.shapes);
  const sparePages = dp.spare ? pack(dp.spare.shapes) : [];
  const total = pages.length + sparePages.length;
  const svgs: string[] = [];
  let idx = 1;
  [...pages, ...sparePages].forEach((pg, i) => {
    const isSpare = i >= pages.length;
    const svg = pageSvg(isSpare ? dp.spare!.title : dp.name, i + 1, total, pg, idx);
    idx += pg.length;
    writeFileSync(`${dir}/page-${i + 1}.svg`, svg);
    svgs.push(svg);
  });
  const md = [
    `# ${dp.name} — 제작 시트`,
    "",
    `인쇄: A4 ${total}장, **실제 크기(100%)**, 여백 없음. 각 장의 100 mm 눈금자를 자로 확인.`,
    "",
    "## 자를 부품",
    "",
    "| # | 부품 | 수량 | 크기 (mm) | 재료 | 메모 |",
    "|---|---|---|---|---|---|",
    ...pages.flat().map((p, i) => `| ${i + 1} | ${p.s.label} | ${p.s.qty} | ${n(p.s.w)}×${n(p.s.h)} | ${p.s.material} | ${p.s.note ?? ""} |`),
    "",
    ...(dp.spare
      ? [
          `## 여분 / B5N 전환 (${pages.length + 1}–${total} 쪽)`,
          "",
          ...dp.spare.notes.map((x) => `- ${x}`),
          "",
          "| # | 부품 | 수량 | 크기 (mm) | 재료 | 메모 |",
          "|---|---|---|---|---|---|",
          ...sparePages.flat().map((p, i) => `| ${pages.flat().length + i + 1} | ${p.s.label} | ${p.s.qty} | ${n(p.s.w)}×${n(p.s.h)} | ${p.s.material} | ${p.s.note ?? ""} |`),
          "",
        ]
      : []),
    "## 부자재 (자르지 않음)",
    "",
    ...dp.cutList.map((c) => `- ${c}`),
    "",
    "## 조립 순서",
    "",
    ...dp.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
  ].join("\n");
  writeFileSync(`${dir}/README.md`, md);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}body{margin:0}svg{display:block;page-break-after:always}</style></head><body>${svgs.join("\n")}</body></html>`;
  writeFileSync(`${dir}/print.html`, html);
  pdfJobs.push({ html: `${dir}/print.html`, pdf: `${dir}/${dp.id}-전개도-A4.pdf` });
  if (dp.spare) {
    // 전량판: 수량만큼 모두 그려서 '인쇄 → 붙이기 → 자르기' 만 하면 되게. 번호는 위 전개도의 # 와 같음
    const nMain = pages.flat().length;
    const expand = (list: Placed[], base: number) => {
      const out: Shape[] = [];
      list.forEach((pl, k) => {
        const sh = pl.s;
        const no = base + k + 1;
        for (let j = 1; j <= sh.qty; j++) out.push({ ...sh, qty: 1, label: sh.qty > 1 ? `#${no} ${sh.label} (${j}/${sh.qty})` : `#${no} ${sh.label}`, full: true } as Shape & { full: boolean });
      });
      return out;
    };
    // 추가분: 번호판(B5E-전개도-A4.pdf, 부품 1개씩)을 이미 뽑은 사람용 → 각 부품 2번째부터만
    const expandFrom2 = (list: Placed[], base: number) =>
      expand(list, base).filter((x) => !/\(1\/\d+\)$/.test(x.label) && /\(\d+\/\d+\)$/.test(x.label));
    const eMain = expand(pages.flat(), 0);
    const eSpare = expand(sparePages.flat(), nMain);
    const fMain = pack(eMain);
    const fSpare = pack(eSpare);
    const fAll = [...fMain, ...fSpare];
    mkdirSync(`${dir}/full`, { recursive: true });
    const fsvgs = fAll.map((pg, i) => {
      const title = i < fMain.length ? `${dp.id} 전량판 — 본 부품 (수량만큼 모두 그림, # = 부품 번호)` : `${dp.id} 전량판 — 여분 / B5N 전환 (필요할 때만)`;
      const svg = pageSvg(title, i + 1, fAll.length, pg, 1);
      writeFileSync(`${dir}/full/page-${i + 1}.svg`, svg);
      return svg;
    });
    console.log(dp.id, `전량판 본 ${eMain.length} 조각 ${fMain.length} 장 + 여분 ${eSpare.length} 조각 ${fSpare.length} 장`);
    writeFileSync(`${dir}/full/print.html`, `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}body{margin:0}svg{display:block;page-break-after:always}</style></head><body>${fsvgs.join("\n")}</body></html>`);
    pdfJobs.push({ html: `${dir}/full/print.html`, pdf: `${dir}/${dp.id}-전개도-전량-A4.pdf` });
    {
      const aMain = expandFrom2(pages.flat(), 0);
      const aSpare = expandFrom2(sparePages.flat(), nMain);
      const pM = pack(aMain);
      const pS = pack(aSpare);
      const pA = [...pM, ...pS];
      mkdirSync(`${dir}/extra`, { recursive: true });
      const asvgs = pA.map((pg, i) => {
        const title = i < pM.length ? `${dp.id} 추가분 — 본 부품 (번호판을 이미 뽑았을 때 나머지 수량)` : `${dp.id} 추가분 — 여분 / B5N 전환 나머지 (필요할 때만)`;
        const svg = pageSvg(title, i + 1, pA.length, pg, 1);
        writeFileSync(`${dir}/extra/page-${i + 1}.svg`, svg);
        return svg;
      });
      writeFileSync(`${dir}/extra/print.html`, `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}body{margin:0}svg{display:block;page-break-after:always}</style></head><body>${asvgs.join("\n")}</body></html>`);
      pdfJobs.push({ html: `${dir}/extra/print.html`, pdf: `${dir}/${dp.id}-전개도-추가분-A4.pdf` });
      console.log(dp.id, `추가분 본 ${aMain.length} 조각 ${pM.length} 장 + 여분 ${aSpare.length} 조각 ${pS.length} 장`);
    }
  }
  viewerPatterns.push({ id: dp.id, name: dp.name, group: isCurrent(dp.id) ? "current" : "old", sheets: svgs.map((s) => s.replace(/width="210mm" height="297mm"/, "")), bom: dp.cutList, steps: dp.steps });
  console.log(dp.id, `${dp.shapes.length} 부품, ${pages.length} 장`);
}

// PDF (Chromium 인쇄, 1:1)
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of pdfJobs) {
  await page.goto(`file://${process.cwd()}/${j.html}`);
  await page.pdf({ path: j.pdf, format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" }, preferCSSPageSize: true });
  console.log("pdf:", j.pdf);
}
await browser.close();

// 뷰어 데이터에 전개도 병합
mkdirSync("out", { recursive: true });
const vdPath = "data/viewer-data.json";
const vd = existsSync(vdPath) ? JSON.parse(readFileSync(vdPath, "utf8")) : { generated: "", criteria: [], rows: [], recommendation: [] };
vd.patterns = viewerPatterns;
writeFileSync(vdPath, JSON.stringify(vd));
