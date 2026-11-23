// 객관 채점: 시뮬(물체 5종 성공 여부, 간섭) + SymPy + 전개도(부품 수) + 구동 장력 + 정성 리스크(근거 명시)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { ALL } from "../src/core/designs";
import { findCollisions } from "../src/core/collide";
import { PATTERNS } from "../src/core/pattern";
import type { ModeName, ObjName } from "../src/core/types";
import common from "../params/common.json";

/** 휴지(완전 개방) 개구 [x, y] mm — calc/capacity.py 와 같은 식 */
function opening(id: string): [number, number] {
  const base = id === "V5" ? "B1" : id === "V5b" ? "B3" : id;
  const p = JSON.parse(readFileSync(`params/${base}.json`, "utf8"));
  const C = common;
  const halfT = (p.hard.plies * C.board_t) / 2;
  const face = halfT + C.pad_t;
  const yp = p.palm.sy / 2 + halfT;
  const x = p.soft.type === "slot" ? 2 * p.soft.x_open : 2 * (p.palm.sx / 2 + p.soft.root_len + C.finray.L);
  const h = p.hard;
  const r = Math.PI / 180;
  const y =
    h.type === "pivot" ? 2 * (yp + h.len * Math.sin(h.psi_open_deg * r) - face)
    : h.type === "slot" ? 2 * (h.y_open - face)
    : 2 * (yp + h.l1 * Math.sin(h.theta1_rest_deg * r) + h.l2 * Math.sin((h.theta1_rest_deg + h.theta2_rest_deg) * r) - face);
  return [x, y];
}

const calc: Record<string, { pass: boolean; derived: Record<string, number | string> }> = {};
for (const id of ["B1", "B2", "B3", "B3o", "B4"]) calc[id] = JSON.parse(readFileSync(`calc/out/${id}.json`, "utf8"));
const baseOf = (id: string) => (id === "V5" ? "B1" : id === "V5b" ? "B3" : id);

const O = common.objects;
type Case = { mode: ModeName; obj: ObjName; ok: (m: Record<string, number>, cols: string[]) => boolean; why: string };
const CASES: Case[] = [
  { mode: "soft", obj: "chip", why: "Fin Ray 접촉 & 손가락당 ≤2.5 N & hard 비접촉", ok: (m, c) => !c.length && m.finrayNodes >= 1 && m.finrayF <= 2.55 && m.gap > 2 * O.chip.b },
  { mode: "soft", obj: "sponge", why: "Fin Ray 2노드 이상 감쌈", ok: (m, c) => !c.length && m.finrayNodes >= 2 },
  { mode: "rigid", obj: "battery", why: "관통 없이 간격 ≤ Ø+1.5 (접촉 또는 가둠), 손톱 끝이 적도(7 mm) 아래", ok: (m, c) => !c.length && m.gap <= O.battery.d + 1.5 && m.tipZ < O.battery.d / 2 },
  { mode: "rigid", obj: "cap", why: "관통 없이 간격 ≤ Ø+1.5, 손톱 끝이 뚜껑 높이 절반(6 mm) 아래", ok: (m, c) => !c.length && m.gap <= O.cap.d + 1.5 && m.tipZ < O.cap.len / 2 },
  { mode: "hybrid", obj: "cable", why: "관통 없이 간격 ≤ Ø+1.5 (가둠 포함), 손톱 끝이 케이블 윗면(5 mm) 아래", ok: (m, c) => !c.length && m.gap <= O.cable.d + 1.5 && m.tipZ < O.cable.d },
];

// 정성 항목 — 근거를 같이 적는다 (점수만 두지 않음)
const RISK: Record<string, [number, string]> = {
  B1: [3.5, "드럼을 접힘 플랩에 직각으로 붙이는 접착부가 약점. 그 외 회전 관절은 빨대 부싱 1종으로 단순."],
  B2: [2.0, "골판지 슬롯+빨대 핀은 마찰·비틀림(racking)으로 걸리기 쉬움. 손바닥 120×104 로 가장 큼."],
  B3: [2.5, "텐던 손가락은 '공중에서 말고 → 내리고 → 조임' 순서가 필요(시뮬에서 jam 발견). 고무줄 강성비 튜닝 필요."],
  B3o: [3.0, "예비 말기 불필요(바닥 미끄럼 구동력 ≥1 N, SymPy J5). 대신 원위 휴지 58° 스토퍼·근위 17° 스토퍼와 k1≈40 N·mm/rad 고무줄을 맞춰야 함."],
  B4: [2.5, "B2 의 슬롯 마찰 미지수 + B3 의 텐던 순서·고무줄 튜닝을 둘 다 가짐. 대신 가운데 경사 벽이 없어 B2 보다 부품이 단순."],
  V5: [3.0, "B1 과 같고, 실 1개라 칩을 쥘 때 S 를 45% 넘기면 hard 가 닫혀 칩을 누름 → 조작 주의."],
  V5b: [2.0, "B3 리스크 + 실 1개라 Fin Ray 가 끝까지 닫혀 Rigid 에서 텐던 손가락과 부딪힘(시뮬 간섭)."],
};
const HAND: Record<string, [number, string]> = {
  B1: [3, "엄지·검지 pinch + 손바닥 감싸기 구도는 손 같지만 손가락이 1관절."],
  B2: [2, "평행 그리퍼 인상. 손 모양 가산점 설명이 약함."],
  B3: [5, "2관절 손가락이 말려 들어감 — 영상에서 '손' 으로 가장 잘 읽힘."],
  B3o: [5, "B3 와 같은 2관절 텐던 손가락, 바닥을 쓸며 들어오는 동작이 손과 비슷."],
  B4: [5, "B3 와 같은 2관절 텐던 손가락."],
  V5: [3, "B1 과 동일."],
  V5b: [5, "B3 과 동일."],
};
const WEIGHTS = { cover: 3, open: 2, verify: 2, build: 2, drive: 1, risk: 2, hand: 1 };

const rows = [];
const partCount = (id: string) => PATTERNS.find((p) => p.id === baseOf(id))!.shapes.reduce((a, s) => a + s.qty, 0);
const counts = ALL.map((d) => partCount(d.id));
const cMin = Math.min(...counts);
const cMax = Math.max(...counts);
for (const d of ALL) {
  const res: string[] = [];
  let okN = 0;
  let colN = 0;
  for (const c of CASES) {
    const ctrl = d.preset(c.mode, c.obj);
    const asm = d.build(ctrl);
    const cols = findCollisions(asm, d);
    colN += cols.length;
    const ok = c.ok(asm.metrics, cols);
    if (ok) okN++;
    res.push(`${c.obj}:${ok ? "✓" : "✗"}`);
  }
  {
    const asm = d.build(d.preset("open", null));
    colN += findCollisions(asm, d).length;
  }
  const cd = calc[baseOf(d.id)];
  const pc = partCount(d.id);
  const softT = Number(cd.derived.soft_string_T_at_limit_N);
  const hardT = Number(cd.derived.hard_string_T_N);
  const Tmax = d.oneString ? softT + hardT : Math.max(softT, hardT);
  const [ox, oy] = opening(d.id);
  const scores = {
    cover: (5 * okN) / CASES.length,
    open: Math.min(5, (5 * Math.min(ox, oy)) / 150),
    verify: (cd.pass ? 3 : 0) + (colN === 0 ? 2 : Math.max(0, 2 - colN * 0.5)),
    build: cMax === cMin ? 5 : 5 - (3 * (pc - cMin)) / (cMax - cMin),
    drive: Math.max(0, Math.min(5, (5 * (70 - Tmax)) / 50)),
    risk: RISK[d.id][0],
    hand: HAND[d.id][0],
  };
  const total = Object.entries(scores).reduce((a, [k, v]) => a + v * WEIGHTS[k as keyof typeof WEIGHTS], 0);
  rows.push({
    id: d.id,
    name: d.name,
    scores,
    total,
    cells: {
      "물체 5종 (시뮬)": `${okN}/5 · ${res.join(" ")}`,
      "간섭 (6자세)": `${colN}건`,
      "개구 x×y": `${ox.toFixed(0)}×${oy.toFixed(0)} mm`,
      "SymPy": cd.pass ? "전부 통과" : "실패 있음",
      "부품 수 (자르는 판)": `${pc}`,
      "최대 실 장력": `${Tmax.toFixed(0)} N${d.oneString ? " (실 1개 합)" : ""}`,
      "리스크": RISK[d.id][1],
      "핸드형": HAND[d.id][1],
    },
    verdict: "",
  });
}
rows.sort((a, b) => b.total - a.total);
rows.forEach((r, i) => (r.verdict = i === 0 ? "1순위" : i === 1 ? "2순위" : ""));
const criteria = [
  { key: "cover", label: "물체 커버리지", weight: WEIGHTS.cover, how: "시뮬에서 칩·스펀지·건전지·뚜껑·케이블 프리셋 파지 성공 수 ×5/5 (기준은 표 아래)" },
  { key: "open", label: "개구 범위", weight: WEIGHTS.open, how: "완전 개방 시 좁은 쪽 개구 150 mm 이상 5점, 비례 감점 (당일 미지 물체·주방 스펀지 110×70 대비)" },
  { key: "verify", label: "검증", weight: WEIGHTS.verify, how: "SymPy 전 조건 통과 3점 + 6자세 간섭 0건 2점 (건당 −0.5)" },
  { key: "build", label: "제작 용이", weight: WEIGHTS.build, how: "자를 판 개수(수량 합) 최소 5점 → 최대 2점 선형" },
  { key: "drive", label: "손 구동", weight: WEIGHTS.drive, how: "최대 실 장력 20 N 이하 5점 → 70 N 0점 선형" },
  { key: "risk", label: "제작 리스크", weight: WEIGHTS.risk, how: "정성 (근거는 세부 지표 표)" },
  { key: "hand", label: "핸드형 가산점", weight: WEIGHTS.hand, how: "정성 — 영상 가산점(핸드형 구조) 설명력" },
];
const top = rows[0];
const sc = Object.fromEntries(rows.map((r) => [r.id, r.total.toFixed(1)]));
const recommendation = [
  `<b>점수:</b> ${rows.map((r) => `${r.id} ${r.total.toFixed(1)}`).join(" · ")}. '개구 범위'(×2)를 넣자 직선 구동 B2·B4 가 내려갔습니다 — B2 는 90×71 mm, 높이 59 mm 까지만 들어가 주방 스펀지(110×70)도 못 잡습니다.`,
  `<b>선택: B3o</b> (B3 최적화, ${sc.B3o}). B3 에서 원위 휴지각을 바깥으로 젖히고(58°) 손가락 길이·텐던 고리를 SymPy 로 다시 잡아, 예비 말기 없이 '내리고 당기기'만으로 손톱이 바닥을 미끄러져 들어옵니다(미끄럼 구동력 ≥ 1.9 N). 텐던 장력 50 → 28 N.`,
  "B3o 의 실제 파지 방식: 둥글거나 낮은 물체(건전지·뚜껑·케이블)는 손톱이 바닥을 쓸며 물체 밑으로 들어가고 원위 패드가 위를 덮는 '떠서 감싸기'입니다. 설계 목표였던 적도 평행 pinch 와는 다르니, 실물에서 건전지가 굴러 빠지는지 먼저 확인하세요.",
  `B1 (${sc.B1})은 점수 1위로 제작 리스크가 가장 낮습니다. B3o 실물이 미끄럼에서 멈추면(골판지-바닥 마찰이 가정보다 크면) hard 만 B1 피벗으로 바꾸는 것이 대안입니다 — soft(플랩+Fin Ray)는 같습니다.`,
  "V5b(B3+1-string)는 Rigid 에서 Fin Ray 와 텐던 손가락이 부딪혀 탈락입니다.",
];
const md = [
  "# 설계안 비교 (자동 생성)",
  "",
  `생성: ${new Date().toISOString()} · \`npx tsx scripts/score.ts\``,
  "",
  "| 설계안 | " + criteria.map((c) => `${c.label} ×${c.weight}`).join(" | ") + " | 합계 | 판정 |",
  "|---|" + criteria.map(() => "---|").join("") + "---|---|",
  ...rows.map((r) => `| ${r.id} | ` + criteria.map((c) => r.scores[c.key as keyof typeof r.scores].toFixed(1)).join(" | ") + ` | **${r.total.toFixed(1)}** | ${r.verdict} |`),
  "",
  "## 세부 지표",
  "",
  ...rows.flatMap((r) => [`### ${r.name}`, "", ...Object.entries(r.cells).map(([k, v]) => `- **${k}**: ${v}`), ""]),
  "## 판정 기준",
  "",
  ...criteria.map((c) => `- **${c.label}** (×${c.weight}): ${c.how}`),
  ...CASES.map((c) => `- ${c.obj} (${c.mode}): ${c.why}`),
  "",
  "## 추천",
  "",
  ...recommendation.map((p) => p.replace(/<\/?b>/g, "**")),
  "",
].join("\n");
writeFileSync("docs/COMPARISON.md", md);
mkdirSync("out", { recursive: true });
const vdPath = "out/viewer-data.json";
const vd = existsSync(vdPath) ? JSON.parse(readFileSync(vdPath, "utf8")) : { patterns: [] };
Object.assign(vd, { generated: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC", criteria, rows, recommendation });
writeFileSync(vdPath, JSON.stringify(vd));
for (const r of rows) console.log(r.id, r.total.toFixed(1), JSON.stringify(r.scores), r.cells["물체 5종 (시뮬)"], r.cells["간섭 (6자세)"]);
