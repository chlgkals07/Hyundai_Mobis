// 객관 채점: 시뮬(물체 5종 성공 여부, 간섭) + SymPy + 전개도(부품 수) + 구동 장력 + 정성 리스크(근거 명시)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { ALL, CURRENT, OLD_REASON } from "../src/core/designs";
import { maxApproachError } from "./approach";
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
    h.type === "parallel" ? 2 * (h.L * Math.sin(h.psi_open_deg * r) + C.objects.battery.d / 2)
    : h.type === "pivot" ? 2 * (yp + h.len * Math.sin(h.psi_open_deg * r) - face)
    : h.type === "slot" ? 2 * (h.y_open - face)
    : 2 * (yp + h.l1 * Math.sin(h.theta1_rest_deg * r) + h.l2 * Math.sin((h.theta1_rest_deg + h.theta2_rest_deg) * r) - face);
  return [x, y];
}

const calc: Record<string, { pass: boolean; derived: Record<string, number | string> }> = {};
for (const id of ["B1", "B2", "B3", "B3o", "B4", "B5", "B5T", "B5F", "B5N"]) calc[id] = JSON.parse(readFileSync(`calc/out/${id}.json`, "utf8"));
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
  B5: [3.5, "빨대 핀 4개/손가락의 평행사변형 — 핀 구멍 위치 정확도(±1 mm)가 평행도를 좌우. 고무줄 튜닝 없음, 동작 순서 없음."],
  B5T: [2.5, "손끝판 핀 + 고무줄 + 스토퍼. 순응 방향이 물체 쪽이라 쥘 때 무력화(SymPy C3)."],
  B5F: [3.0, "빨대-in-빨대 텔레스코프 2쌍 + 손바닥 슬롯. 텔레스코프가 기울면 걸릴 수 있음(슬리브 30 mm 로 완화)."],
  B5N: [4.0, "B5 에서 손톱 플랩만 14 mm 로 — 추가 부품 없음. 손톱 테이프 힌지 내구성이 관건."],
  B4: [2.5, "B2 의 슬롯 마찰 미지수 + B3 의 텐던 순서·고무줄 튜닝을 둘 다 가짐. 대신 가운데 경사 벽이 없어 B2 보다 부품이 단순."],
  V5: [3.0, "B1 과 같고, 실 1개라 칩을 쥘 때 S 를 45% 넘기면 hard 가 닫혀 칩을 누름 → 조작 주의."],
  V5b: [2.0, "B3 리스크 + 실 1개라 Fin Ray 가 끝까지 닫혀 Rigid 에서 텐던 손가락과 부딪힘(시뮬 간섭)."],
};
const HAND: Record<string, [number, string]> = {
  B1: [3, "엄지·검지 pinch + 손바닥 감싸기 구도는 손 같지만 손가락이 1관절."],
  B2: [2, "평행 그리퍼 인상. 손 모양 가산점 설명이 약함."],
  B3: [5, "2관절 손가락이 말려 들어감 — 영상에서 '손' 으로 가장 잘 읽힘."],
  B3o: [5, "B3 와 같은 2관절 텐던 손가락, 바닥을 쓸며 들어오는 동작이 손과 비슷."],
  B5: [3, "평행 그리퍼 손끝(항상 수직) — 엄지·검지 pinch 로 설명 가능하나 관절이 손처럼 굽지는 않음."],
  B5T: [3, "B5 와 같음."],
  B5F: [3, "B5 와 같음."],
  B5N: [3, "B5 와 같음."],
  B4: [5, "B3 와 같은 2관절 텐던 손가락."],
  V5: [3, "B1 과 동일."],
  V5b: [5, "B3 과 동일."],
};
const WEIGHTS = { cover: 3, vert: 2, open: 2, verify: 2, build: 2, drive: 1, risk: 2, hand: 1 };

const rows = [];
const partCount = (id: string): number => {
  const pt = PATTERNS.find((p) => p.id === baseOf(id));
  return pt ? pt.shapes.reduce((a, s) => a + s.qty, 0) : partCount("B5") + 6; // B5T: 전개도 미작성(탈락), 핀·판 추정
};
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
  const ve = maxApproachError(d.id);
  const scores = {
    cover: (5 * okN) / CASES.length,
    vert: Math.max(0, Math.min(5, (5 * ve) / 10)),
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
      "수직 순응 (접근 오차)": ve < 0 ? "0 mm 에서도 실패" : `${ve} mm 까지 건전지·케이블 유지`,
      "개구 x×y": `${ox.toFixed(0)}×${oy.toFixed(0)} mm`,
      "SymPy": cd.pass ? "전부 통과" : "실패 있음",
      "부품 수 (자르는 판)": `${pc}`,
      "최대 실 장력": `${Tmax.toFixed(0)} N${d.oneString ? " (실 1개 합)" : ""}`,
      "리스크": RISK[d.id][1],
      "핸드형": HAND[d.id][1],
    },
    verdict: "",
    group: CURRENT.some((c) => c.id === d.id) ? "current" : "old",
    reason: OLD_REASON[d.id] ?? "",
  });
}
rows.sort((a, b) => (a.group === b.group ? b.total - a.total : a.group === "current" ? -1 : 1));
rows.filter((r) => r.group === "current").forEach((r, i) => (r.verdict = i === 0 ? "1순위" : i === 1 ? "2순위" : ""));
const criteria = [
  { key: "cover", label: "물체 커버리지", weight: WEIGHTS.cover, how: "시뮬에서 칩·스펀지·건전지·뚜껑·케이블 프리셋 파지 성공 수 ×5/5 (기준은 표 아래)" },
  { key: "vert", label: "수직 순응", weight: WEIGHTS.vert, how: "Rigid(건전지·케이블) 에서 손바닥을 e mm 더 내려도(팔 높이 오차) 간섭 없이 파지 유지되는 최대 e. 10 mm 이상 5점 (scripts/approach.ts)" },
  { key: "open", label: "개구 범위", weight: WEIGHTS.open, how: "완전 개방 시 좁은 쪽 개구 150 mm 이상 5점, 비례 감점 (당일 미지 물체·주방 스펀지 110×70 대비)" },
  { key: "verify", label: "검증", weight: WEIGHTS.verify, how: "SymPy 전 조건 통과 3점 + 6자세 간섭 0건 2점 (건당 −0.5)" },
  { key: "build", label: "제작 용이", weight: WEIGHTS.build, how: "자를 판 개수(수량 합) 최소 5점 → 최대 2점 선형" },
  { key: "drive", label: "손 구동", weight: WEIGHTS.drive, how: "최대 실 장력 20 N 이하 5점 → 70 N 0점 선형" },
  { key: "risk", label: "제작 리스크", weight: WEIGHTS.risk, how: "정성 (근거는 세부 지표 표)" },
  { key: "hand", label: "핸드형 가산점", weight: WEIGHTS.hand, how: "정성 — 영상 가산점(핸드형 구조) 설명력" },
];
const top = rows[0];
const sc = Object.fromEntries(rows.map((r) => [r.id, r.total.toFixed(1)]));
const cur = rows.filter((r) => r.group === "current");
const recommendation = [
  `<b>현재 후보 (hard = 평행 링크 + 텐던 1가닥, 수직 순응 옵션):</b> ${cur.map((r) => `${r.id} ${r.total.toFixed(1)}`).join(" · ")}. 닫힘 방향 순응·힘 제한은 soft Fin Ray 가 맡으므로 hard 는 바닥 쪽(수직) 순응만 평가했습니다 — 목표 ±10 mm (팔 높이 오차 가정).`,
  `<b>B5N (긴 손톱, ${sc.B5N})</b>: 추가 부품 없이 손톱 플랩 5 → 14 mm 로 12 mm 까지 순응. 접히기 전엔 손톱 안쪽 면이 건전지를 쥐는 면. 가장 싸고 단순 → 목요일 1차 제작 추천.`,
  `<b>B5F (플로팅, ${sc.B5F})</b>: 손가락 전체를 손바닥 위 빨대 텔레스코프에 띄워 14 mm 까지 순응, 손끝이 기울지 않음. 쥐는 순간 슬리브 마찰로 잠겨 들어올릴 때 안 처짐. 텔레스코프가 기울어 걸리는지가 실물 리스크 → B5N 손톱이 약하면 이걸로.`,
  "탈락: B5T(손끝판 관절)는 바닥 힘이 손끝을 물체 쪽으로 돌려, 물체를 쥐고 있으면 물체가 막아 순응이 사라집니다(SymPy C3: 10 mm 에 안쪽 14 mm). 손바닥 힌지 방식은 10 mm 상승에 손끝이 22 mm 안쪽으로 휘어 calc 단계에서 제외. 나머지 이전 안들은 '보관(old)' 표에 이유와 함께 모았습니다.",
];
const md = [
  "# 설계안 비교 (자동 생성) — 현재 후보",
  "",
  `생성: ${new Date().toISOString()} · \`npx tsx scripts/score.ts\``,
  "",
  "| 설계안 | " + criteria.map((c) => `${c.label} ×${c.weight}`).join(" | ") + " | 합계 | 판정 |",
  "|---|" + criteria.map(() => "---|").join("") + "---|---|",
  ...cur.map((r) => `| ${r.id} | ` + criteria.map((c) => r.scores[c.key as keyof typeof r.scores].toFixed(1)).join(" | ") + ` | **${r.total.toFixed(1)}** | ${r.verdict} |`),
  "",
  "## 보관 (old) — 하민 피드백·검증으로 내려간 안",
  "",
  "| 설계안 | 합계 | 내려간 이유 |",
  "|---|---|---|",
  ...rows.filter((r) => r.group === "old").map((r) => `| ${r.id} | ${r.total.toFixed(1)} | ${r.reason} |`),
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
