// 객관 채점: 시뮬(물체 5종 성공 여부, 간섭) + SymPy + 전개도(부품 수) + 구동 장력 + 정성 리스크(근거 명시)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { ALL } from "../src/core/designs";
import { findCollisions } from "../src/core/collide";
import { PATTERNS } from "../src/core/pattern";
import type { ModeName, ObjName } from "../src/core/types";
import common from "../params/common.json";

const calc: Record<string, { pass: boolean; derived: Record<string, number | string> }> = {};
for (const id of ["B1", "B2", "B3"]) calc[id] = JSON.parse(readFileSync(`calc/out/${id}.json`, "utf8"));
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
  V5: [3.0, "B1 과 같고, 실 1개라 칩을 쥘 때 S 를 45% 넘기면 hard 가 닫혀 칩을 누름 → 조작 주의."],
  V5b: [2.0, "B3 리스크 + 실 1개라 Fin Ray 가 끝까지 닫혀 Rigid 에서 텐던 손가락과 부딪힘(시뮬 간섭)."],
};
const HAND: Record<string, [number, string]> = {
  B1: [3, "엄지·검지 pinch + 손바닥 감싸기 구도는 손 같지만 손가락이 1관절."],
  B2: [2, "평행 그리퍼 인상. 손 모양 가산점 설명이 약함."],
  B3: [5, "2관절 손가락이 말려 들어감 — 영상에서 '손' 으로 가장 잘 읽힘."],
  V5: [3, "B1 과 동일."],
  V5b: [5, "B3 과 동일."],
};
const WEIGHTS = { cover: 3, verify: 2, build: 2, drive: 1, risk: 2, hand: 1 };

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
  const scores = {
    cover: (5 * okN) / CASES.length,
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
  { key: "verify", label: "검증", weight: WEIGHTS.verify, how: "SymPy 전 조건 통과 3점 + 6자세 간섭 0건 2점 (건당 −0.5)" },
  { key: "build", label: "제작 용이", weight: WEIGHTS.build, how: "자를 판 개수(수량 합) 최소 5점 → 최대 2점 선형" },
  { key: "drive", label: "손 구동", weight: WEIGHTS.drive, how: "최대 실 장력 20 N 이하 5점 → 70 N 0점 선형" },
  { key: "risk", label: "제작 리스크", weight: WEIGHTS.risk, how: "정성 (근거는 세부 지표 표)" },
  { key: "hand", label: "핸드형 가산점", weight: WEIGHTS.hand, how: "정성 — 영상 가산점(핸드형 구조) 설명력" },
];
const top = rows[0];
const sc = Object.fromEntries(rows.map((r) => [r.id, r.total.toFixed(1)]));
const recommendation = [
  `<b>점수:</b> ${rows.map((r) => `${r.id} ${r.total.toFixed(1)}`).join(" · ")}. 상위 3개(B2·B1·B3)는 모두 물체 5종을 시뮬에서 잡고 간섭 0건이라, 차이는 제작·구동·리스크에서 났습니다.`,
  `<b>목요일 결정 규칙:</b> Fin Ray 4개는 모든 안에 공통이니 먼저 만든다 → B2 슬롯 벽 1장 + 빨대 핀만 잘라 10분 미끄럼 테스트 → 핀이 손가락 힘으로 걸림 없이 왕복하면 B2(${sc.B2}), 걸리면 B1(${sc.B1}).`,
  "B2 가 점수 1위인 이유: 슬롯 직선 구동이라 레버 손해가 없어 실 장력이 가장 낮고(마찰 제외 9 N vs B1 36 N), 자를 판 수도 가장 적고, 경사 슬롯 덕에 '닫히면 손끝이 내려가는' 높이 순서가 기구적으로 보장됩니다. 대신 골판지 슬롯 마찰·비틀림은 시뮬로 검증할 수 없는 가장 큰 미지수입니다.",
  "B1 은 회전 관절이 '빨대 부싱 + 빨대 축' 한 종류라 제작 리스크가 가장 낮은 안전한 선택입니다. 약점은 hard 손가락 레버(112 mm)를 드럼(25 mm)으로 돌려 실 장력이 큰 것과 드럼 직각 접착부입니다.",
  "B3 는 영상 가산점(핸드형)이 가장 크지만 텐던 손가락이 바닥에서 걸리는 문제가 시뮬에서 드러났고, '공중에서 실 B 60% → 내림 → 조임' 순서로만 동작합니다. B1/B2 가 돌아가면 hard 만 B3 식 텐던으로 바꾸는 하이브리드가 다음 iteration 후보입니다.",
  "V5(1-string)는 B1 위에서 간섭 없이 동작합니다(실 1개 장력 합이 커서 구동 점수는 낮음). 본선 액추에이터가 1개로 확정되면 V5 방식이 기본안입니다. V5b(B3+1-string)는 Rigid 에서 Fin Ray 와 텐던 손가락이 부딪혀 탈락입니다.",
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
