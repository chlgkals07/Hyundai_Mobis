/**
 * 전개도 부품 정의 (2D, mm). 같은 params / calc 값에서 생성 → 3D 시뮬과 치수 일치.
 * 선 규칙: cut = 실선(자르기), score = 점선(접기), mark = 일점쇄선(붙일 위치), glue = 빗금(풀칠), hole = 원(빨대·실),
 * flute = 화살표(골 방향).
 */
import common from "../../params/common.json";
import B1p from "../../params/B1.json";
import B2p from "../../params/B2.json";
import B3p from "../../params/B3.json";
import B3op from "../../params/B3o.json";
import B4p from "../../params/B4.json";
import B5p from "../../params/B5.json";
import B5Fp from "../../params/B5F.json";
import B5Np from "../../params/B5N.json";
import B1c from "../../calc/out/B1.json";
import B2c from "../../calc/out/B2.json";
import B3c from "../../calc/out/B3.json";
import B3oc from "../../calc/out/B3o.json";
import B4c from "../../calc/out/B4.json";
import B5c from "../../calc/out/B5.json";
import B5Fc from "../../calc/out/B5F.json";
import B5Nc from "../../calc/out/B5N.json";

export type P2 = [number, number];
export interface Shape {
  label: string;
  qty: number;
  material: string;
  note?: string;
  w: number;
  h: number;
  cut: { pts: P2[]; closed: boolean }[];
  score: [P2, P2][];
  mark: [P2, P2][];
  glue: { x: number; y: number; w: number; h: number }[];
  holes: { c: P2; d: number }[];
  /** 골 방향: 'x' = 가로, 'y' = 세로 */
  flute?: "x" | "y";
  text: { p: P2; s: string; size?: number }[];
}
export interface DesignPattern {
  id: string;
  name: string;
  shapes: Shape[];
  /** 자르지 않는 부자재 */
  cutList: string[];
  steps: string[];
}

const C = common;
const T = C.board_t;
const FR = C.finray;
const fx = (n: number) => Math.round(n * 10) / 10;

function blank(label: string, qty: number, material: string, w: number, h: number, note?: string): Shape {
  return { label, qty, material, note, w, h, cut: [], score: [], mark: [], glue: [], holes: [], text: [] };
}
function rectCut(s: Shape, x: number, y: number, w: number, h: number) {
  s.cut.push({ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true });
}
function rect(label: string, qty: number, material: string, w: number, h: number, note?: string, flute?: "x" | "y") {
  const s = blank(label, qty, material, w, h, note);
  rectCut(s, 0, 0, w, h);
  s.flute = flute;
  return s;
}
function disk(label: string, qty: number, r: number, hole: number | null, note?: string) {
  const s = blank(label, qty, "B골 3 mm", 2 * r, 2 * r, note);
  const pts: P2[] = [];
  for (let i = 0; i < 48; i++) pts.push([r + r * Math.cos((i / 48) * 2 * Math.PI), r + r * Math.sin((i / 48) * 2 * Math.PI)]);
  s.cut.push({ pts, closed: true });
  if (hole) s.holes.push({ c: [r, r], d: hole });
  return s;
}

/** Fin Ray 띠: contact flank | back flank | 밑변 | 풀칠 탭. 단면 골판지(한쪽 라이너 벗김), 골은 폭 방향. */
function finrayStrip(k = 0): Shape {
  const L = FR.L;
  const b = FR.base;
  const Lb = Math.hypot(L, b);
  const tab = 12;
  const W = FR.width;
  const total = L + Lb + b + tab;
  const s = blank(k ? `Fin Ray 띠 ${k}/4` : "Fin Ray 띠", k ? 1 : 4, "단면 골판지 (한쪽 라이너 벗김)", total, W, `접는 선 3개로 삼각형 고리 → 탭을 contact flank 뿌리 안쪽에 풀칠. 리브 위치 R2–R8 에 빨대를 테이프 힌지로.`);
  rectCut(s, 0, 0, total, W);
  for (const x of [L, L + Lb, L + Lb + b]) s.score.push([[x, 0], [x, W]]);
  s.glue.push({ x: L + Lb + b, y: 0, w: tab, h: W });
  const n = 10;
  for (const i of [2, 4, 6, 8]) {
    const xc = (i * L) / n;
    const xb = L + ((n - i) * Lb) / n;
    s.mark.push([[xc, 2], [xc, W - 2]]);
    s.mark.push([[xb, 2], [xb, W - 2]]);
    s.text.push({ p: [xc + 1, W / 2], s: `R${i}`, size: 3 });
    s.text.push({ p: [xb + 1, W / 2], s: `R${i}`, size: 3 });
  }
  s.text.push({ p: [L / 2 - 14, 4], s: "contact (물체 쪽)", size: 3 });
  s.text.push({ p: [L + Lb / 2 - 6, 4], s: "back", size: 3 });
  s.text.push({ p: [L + Lb + 2, 4], s: "밑변", size: 3 });
  s.text.push({ p: [-0.5, W + 4], s: "↑ 손가락 끝은 contact 와 back 사이 접는 선", size: 3 });
  s.flute = "y";
  return s;
}

function finrayCutList(): string[] {
  const n = 10;
  const ribs = [2, 4, 6, 8].map((i) => fx(FR.base * (1 - i / n)));
  return [
    `일반 빨대(Ø${C.straw_d}) Fin Ray 리브: 손가락당 ${ribs.join(" / ")} mm × 4개 손가락 (+ 테이프 힌지 양끝)`,
  ];
}

// ---------------------------------------------------------------------------- B1

/** B1 (soft 플랩 부품은 B5 도 재사용: pIn 으로 손바닥 치수만 바꾸고 hard 피벗 슬롯은 pivot 형일 때만) */
function b1(pIn: { palm: { sx: number; sy: number }; soft: typeof B1p.soft; hard: { type: string; drum_r: number } } = B1p, dIn: Record<string, unknown> = B1c.derived): DesignPattern {
  const p = pIn as typeof B1p;
  const d = dIn as unknown as Record<string, number>;
  const pivot = pIn.hard.type === "pivot";
  const sx = p.palm.sx;
  const sy = p.palm.sy;
  const rl = p.soft.root_len;
  const yf = FR.pair_y;
  const yLo = -yf - FR.width / 2 - 2;
  const yHi = p.soft.drum_y + 5;
  const shapes: Shape[] = [];
  // 손바닥 윗장 + 플랩 (한 장, 좌우 score 로 접어 내림)
  const top = blank("손바닥 윗장 + Soft 플랩", 1, "B골 3 mm", sx + 2 * rl, sy, "좌우 플랩은 점선에서 아래로 90° 접힘(=닫힌 자세). 펼친 상태가 완전 개방(90°).");
  const oy = (y: number) => y + sy / 2; // 손바닥 y → 도면 y
  const pts: P2[] = [
    [0, oy(yLo)], [rl, oy(yLo)], [rl, 0], [rl + sx, 0], [rl + sx, oy(yLo)], [2 * rl + sx, oy(yLo)],
    [2 * rl + sx, oy(yHi)], [rl + sx, oy(yHi)], [rl + sx, sy], [rl, sy], [rl, oy(yHi)], [0, oy(yHi)],
  ];
  top.cut.push({ pts, closed: true });
  top.score.push([[rl, oy(yLo)], [rl, oy(yHi)]], [[rl + sx, oy(yLo)], [rl + sx, oy(yHi)]]);
  // 드럼 슬롯 (soft: 힌지선에서 안쪽 drum_r, 폭 10) / hard 드럼 슬롯 (앞뒤 가장자리 중앙)
  const sr = p.soft.drum_r;
  for (const s of [-1, 1]) {
    const xEdge = s > 0 ? rl + sx : rl;
    const x0 = s > 0 ? xEdge - sr : xEdge;
    rectCut(top, x0, oy(p.soft.drum_y) - 5, sr, 10);
  }
  const hr = p.hard.drum_r;
  if (pivot) for (const t of [0, 1]) rectCut(top, rl + sx / 2 - 5, t ? sy - hr : 0, 10, hr);
  // 고무줄 고정 구멍
  for (const s of [-1, 1]) top.holes.push({ c: [rl + sx / 2 + s * (sx / 2 - 14), oy(-yf)], d: 3 });
  top.text.push({ p: [rl + 4, sy / 2], s: "윗장 (골 ↔)", size: 4 });
  top.flute = "x";
  shapes.push(top);
  const bot = rect("손바닥 아랫장", 1, "B골 3 mm", sx, sy, "윗장과 골 방향을 엇갈리게(↕) 풀칠. 같은 위치에 드럼 슬롯을 자름.", "y");
  for (const s of [-1, 1]) rectCut(bot, s > 0 ? sx - sr : 0, oy(p.soft.drum_y) - 5, sr, 10);
  if (pivot) for (const t of [0, 1]) rectCut(bot, sx / 2 - 5, t ? sy - hr : 0, 10, hr);
  shapes.push(bot);
  // Fin Ray
  shapes.push(...[1, 2, 3, 4].map((k) => finrayStrip(k)));
  const base = rect("Fin Ray 밑판", 4, "B골 3 mm", FR.base + 8, FR.width, "플랩 끝(뿌리)에 수직으로 붙이고 Fin Ray 밑변을 그 위에 풀칠. 8 mm 는 플랩 접착 탭.", "x");
  base.score.push([[8, 0], [8, FR.width]]);
  base.glue.push({ x: 0, y: 0, w: 8, h: FR.width });
  shapes.push(base);
  // 드럼
  shapes.push(disk("Soft 드럼 큰판", 4, sr, null, "큰-작은-큰 3장 적층 = 실 홈. 플랩 바깥면에 힌지선 중심으로 세워 붙이고 삼각 보강."));
  shapes.push(disk("Soft 드럼 작은판", 2, sr - 3, null));
  const gus = blank("드럼 삼각 보강", 4, "B골 3 mm", 15, 15);
  gus.cut.push({ pts: [[0, 0], [15, 0], [0, 15]], closed: true });
  shapes.push(gus);
  shapes.push(disk("Hard 드럼 큰판", 4, hr, C.straw_d + 0.5, "가운데 구멍 = 빨대 축. 손가락 뿌리 가운데 슬롯(폭 9)에 끼워 풀칠."));
  shapes.push(disk("Hard 드럼 작은판", 2, hr - 3, C.straw_d + 0.5));
  // Hard 손가락 (3겹)
  const Lbar = p.hard.len - p.hard.nail_len;
  const w = p.hard.width;
  const ply = blank("Hard 손가락 판", 6, "B골 3 mm", w, Lbar + 6, `3장 적층(가운데 장만 뿌리 슬롯 9×${hr}). 축 구멍 중심 = 위에서 6 mm. 길이 방향 골.`);
  rectCut(ply, 0, 0, w, Lbar + 6);
  ply.holes.push({ c: [w / 2, 6], d: C.straw_d + 0.5 });
  ply.mark.push([[w / 2 - 4.5, 0], [w / 2 - 4.5, hr]], [[w / 2 + 4.5, 0], [w / 2 + 4.5, hr]]);
  ply.text.push({ p: [1, hr + 5], s: "가운데 장만 ⋯ 사이 잘라냄", size: 3 });
  ply.flute = "y";
  shapes.push(ply);
  // 쐐기 패드 받침 (wedge)
  const wedge = Number(d.hard_face_wedge_deg);
  const wl = 25;
  const wt = wl * Math.tan((wedge * Math.PI) / 180);
  const wsh = blank(`쐐기 받침 (${fx(wedge)}°)`, 2, "B골 3 mm 적층 or 종이", wl, wt, `두꺼운 쪽(${fx(wt)} mm)이 손끝 쪽 → 건전지 파지 자세에서 패드면이 수직. 위에 고무줄 감아 마찰 패드.`);
  wsh.cut.push({ pts: [[0, 0], [wl, 0], [wl, wt], [0, 0.6]], closed: true });
  shapes.push(wsh);
  const nail = rect("손톱 플랩", 2, "B골 3 mm 2겹 + 테이프", w - 2, p.hard.nail_len + 6, "위 6 mm 를 손가락 끝 바깥면에 테이프 힌지. 안쪽으로는 스토퍼에 막힘, 바깥(위)으로만 꺾임.", "x");
  nail.score.push([[0, 6], [w - 2, 6]]);
  shapes.push(nail);
  const stop = rect("손톱 스토퍼", 2, "B골 3 mm", w - 2, 8, "손가락 끝 안쪽 면에 풀칠, 손톱보다 2 mm 아래로 튀어나오게.", "x");
  shapes.push(stop);
  // 균형막대
  const wt1 = blank("균형막대 (whiffletree)", 2, "B골 3 mm 2겹", 80, 10, "양끝 구멍 = 좌·우(또는 앞·뒤) 실, 가운데 = 손잡이 실.");
  rectCut(wt1, 0, 0, 80, 10);
  for (const x of [5, 40, 75]) wt1.holes.push({ c: [x, 5], d: 3 });
  shapes.push(wt1);
  return {
    id: "B1",
    name: p.name,
    shapes,
    cutList: [
      ...finrayCutList(),
      `굵은 빨대(Ø${C.bubble_d}) 부싱: 7 mm × 4 (hard 피벗, 손바닥 앞·뒤 모서리 윗면)`,
      `일반 빨대 축: ${p.hard.width + 14} mm × 2 (hard)`,
      `실 A: 드럼 2개 각 3바퀴 + 위로 150 mm / 실 B: 동일`,
      `직렬 고무줄(힘 제한): 실 A 손잡이 바로 아래 1토막, 옆에 눈금 (2.5 N/손가락에서 늘어나기 시작하도록 1차 실물로 길이 조정)`,
      `복원 고무줄: 플랩 2, hard 2`,
    ],
    steps: [
      "윗장 플랩 점선을 자 대고 볼펜으로 눌러 score, 아랫장과 골 방향 엇갈려 풀칠 (플랩 부분은 풀칠 금지).",
      "Fin Ray 띠 4개: 리브 빨대를 R2–R8 표시에 테이프 힌지로 붙이고 → 삼각형으로 접어 탭 풀칠 → 밑판에 고정.",
      "Fin Ray 2개씩 플랩 끝에 밑판 탭으로 수직 고정 (contact flank 가 안쪽).",
      "Soft 드럼(큰-작은-큰)을 플랩 바깥면 힌지선 위에 세워 붙이고 삼각 보강, 손바닥 슬롯으로 아래 절반이 지나가는지 확인.",
      "Hard 손가락 3장 적층(가운데 장 슬롯) → 드럼 끼워 풀칠 → 빨대 축 → 손바닥 모서리 굵은 빨대 부싱에 끼움.",
      "쐐기 받침 + 고무줄 패드, 손톱 플랩(테이프 힌지) + 스토퍼.",
      "실 감기: 드럼 안쪽 접선에서 위로. 좌·우 실 A → 균형막대 → 직렬 고무줄 → 손잡이. 실 B 도 같은 방식.",
      "복원 고무줄 걸고, 실 A/B 를 놓았을 때 완전 개방(플랩 수평, hard 40°)으로 돌아오는지 확인.",
    ],
  };
}

// ---------------------------------------------------------------------------- B2

/** B2 (또는 soft 슬롯 값만 바꾼 변형). hard 관련 부품은 B2 hard 가 있을 때만 의미 있음. */
function b2(pIn: typeof B2p = B2p, dIn: Record<string, unknown> = B2c.derived): DesignPattern {
  const p = pIn;
  const d = dIn as unknown as Record<string, number>;
  const shapes: Shape[] = [];
  const sx = p.palm.sx;
  const sy = p.palm.sy;
  const xMin = Number(d.soft_x_min);
  const wy = p.soft.wall_y;
  for (const [lbl, fl] of [["손바닥 윗장", "x"], ["손바닥 아랫장", "y"]] as const) {
    const s = rect(lbl, 1, "B골 3 mm", sx, sy, lbl === "손바닥 윗장" ? "실 구멍 6개: soft 4 (x=±16, y=±26), hard 2 (가운데 벽 옆)." : "윗장과 골 방향 엇갈림.", fl);
    for (const a of [-1, 1]) for (const b of [-1, 1]) s.holes.push({ c: [sx / 2 + a * 16, sy / 2 + b * (wy - 4)], d: 3 });
    for (const b of [-1, 1]) s.holes.push({ c: [sx / 2 + 1.8, sy / 2 + b * 2], d: 3 });
    // 가이드 벽 위치 표시
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const x0 = sx / 2 + a * (xMin - 2);
      const x1 = sx / 2 + a * (p.soft.x_open + 13);
      const y = sy / 2 + b * (wy + 2.5);
      s.mark.push([[x0, y], [x1, y]]);
    }
    s.mark.push([[sx / 2, sy / 2 - (p.hard.y_open + 12)], [sx / 2, sy / 2 + (p.hard.y_open + 12)]]);
    shapes.push(s);
  }
  // soft 가이드 벽 (수평 슬롯)
  const wl = p.soft.x_open + 13 - (xMin - 2);
  const wh = -p.soft.slot_z + 10;
  const wall = blank("Soft 가이드 벽", 4, "B골 3 mm 2겹", wl, wh + 8, `위 8 mm 는 손바닥 접착 탭(점선에서 90°). 슬롯 = 빨대 핀 통로 (폭 ${C.straw_d + 1}).`);
  rectCut(wall, 0, 0, wl, wh + 8);
  wall.score.push([[0, 8], [wl, 8]]);
  wall.glue.push({ x: 0, y: 0, w: wl, h: 8 });
  const sz = 8 + -p.soft.slot_z; // 슬롯 중심 (탭 아래에서)
  const sw = C.straw_d + 1;
  const s0 = xMin + 4 - (xMin - 2) - sw / 2;
  const s1 = p.soft.x_open + 10 - (xMin - 2) + sw / 2;
  wall.cut.push({ pts: [[s0, sz - sw / 2], [s1, sz - sw / 2], [s1, sz + sw / 2], [s0, sz + sw / 2]], closed: true });
  wall.text.push({ p: [1, wh + 6], s: "← 안쪽 (손바닥 중심)", size: 3 });
  wall.flute = "y";
  shapes.push(wall);
  // soft 캐리지
  const carH = 5 + p.soft.root_len;
  const car = rect("Soft 캐리지 판", 2, "B골 3 mm 2겹", 2 * wy - 4, carH, `핀 2개(빨대)는 캐리지 위 보강판을 관통. Fin Ray 밑판을 아래 가장자리에 붙임 (y=±${FR.pair_y}).`, "x");
  for (const b of [-1, 1]) car.mark.push([[wy - 2 + b * FR.pair_y - FR.width / 2, carH], [wy - 2 + b * FR.pair_y + FR.width / 2, carH]]);
  shapes.push(car);
  const carTop = rect("Soft 캐리지 보강판", 2, "B골 3 mm", 12 + 8, 2 * wy - 4, "핀 구멍 2개 (캐리지 앞면에서 4, 10 mm). 8 mm 탭은 캐리지 판에 풀칠.", "y");
  carTop.score.push([[8, 0], [8, 2 * wy - 4]]);
  carTop.glue.push({ x: 0, y: 0, w: 8, h: 2 * wy - 4 });
  shapes.push(carTop);
  shapes.push(...[1, 2, 3, 4].map((k) => finrayStrip(k)));
  const base = rect("Fin Ray 밑판", 4, "B골 3 mm", FR.base + 8, FR.width, "캐리지 판 아래 가장자리에 탭으로 수직 고정.", "x");
  base.score.push([[8, 0], [8, FR.width]]);
  shapes.push(base);
  // hard 가운데 벽 (경사 슬롯)
  const al = (p.hard.slope_deg * Math.PI) / 180;
  const yMin = p.hard.plies * T / 2 + C.pad_t + 0.3;
  const carZ = (yc: number) => -12 - (p.hard.y_open - yc) * Math.tan(al);
  const wallBot = carZ(yMin) - 12;
  const hw = 2 * (p.hard.y_open + 12);
  const hwall = blank("Hard 가운데 벽 (경사 슬롯 30°)", 1, "B골 3 mm 2겹", hw, -wallBot + 8, "위 8 mm 탭을 좌우로 갈라 손바닥에 풀칠. 슬롯 2개는 대칭.");
  rectCut(hwall, 0, 0, hw, -wallBot + 8);
  hwall.score.push([[0, 8], [hw, 8]]);
  hwall.glue.push({ x: 0, y: 0, w: hw, h: 8 });
  for (const t of [-1, 1]) {
    const a0: P2 = [hw / 2 + t * (p.hard.y_open + 7 * Math.cos(al)), 8 - carZ(p.hard.y_open) + 7 * Math.sin(al)];
    const a1: P2 = [hw / 2 + t * (yMin - 7 * Math.cos(al)), 8 - carZ(yMin) - 7 * Math.sin(al)];
    // 슬롯 = 두 점 사이 폭 sw 의 띠
    const dx = a1[0] - a0[0];
    const dy = a1[1] - a0[1];
    const l = Math.hypot(dx, dy);
    const nx = (-dy / l) * (sw / 2);
    const ny = (dx / l) * (sw / 2);
    hwall.cut.push({ pts: [[a0[0] + nx, a0[1] + ny], [a1[0] + nx, a1[1] + ny], [a1[0] - nx, a1[1] - ny], [a0[0] - nx, a0[1] - ny]], closed: true });
  }
  hwall.flute = "y";
  shapes.push(hwall);
  const prongH = p.hard.reach_open - 20 + 8;
  const prong = rect("Hard 갈래판 (prong)", 4, "B골 3 mm 3겹 적층", p.hard.width / 2 - 2, prongH, "손가락 1개 = 갈래 2장(벽 양쪽) + 아래 브리지. 위쪽 16 mm 에 핀 구멍 2개 (슬롯 방향 ±7).", "y");
  prong.holes.push({ c: [(p.hard.width / 2 - 2) / 2, 4], d: C.straw_d + 0.5 }, { c: [(p.hard.width / 2 - 2) / 2, 14], d: C.straw_d + 0.5 });
  shapes.push(prong);
  shapes.push(rect("Hard 브리지", 2, "B골 3 mm 3겹", p.hard.width, 18, "두 갈래판 아래끝을 잇는 판. 벽 바닥보다 항상 아래 (시뮬 확인).", "x"));
  shapes.push(rect("손톱 플랩", 2, "B골 3 mm 2겹 + 테이프", p.hard.width - 2, p.hard.nail_len + 6, "B1 과 같음. 패드면이 이미 수직이라 쐐기 없음.", "x"));
  const wt1 = blank("균형막대 (whiffletree)", 2, "B골 3 mm 2겹", 80, 10);
  rectCut(wt1, 0, 0, 80, 10);
  for (const x of [5, 40, 75]) wt1.holes.push({ c: [x, 5], d: 3 });
  shapes.push(wt1);
  return {
    id: "B2",
    name: p.name,
    shapes,
    cutList: [
      ...finrayCutList(),
      `일반 빨대 핀: soft ${2 * wy + 10} mm × 4, hard ${p.hard.width + 4} mm × 4`,
      "실 A: 캐리지 양끝 → 안쪽 → 손바닥 구멍, 실 B: 캐리지 → 슬롯 아래 고리 → 벽 면 따라 위로",
      "복원 고무줄: 캐리지마다 1개(바깥쪽으로 당김)",
    ],
    steps: [
      "손바닥 2장 엇갈려 풀칠, 벽 위치(일점쇄선)와 실 구멍 표시.",
      "가이드 벽 4장·가운데 벽 1장의 탭을 접어 손바닥 아랫면에 풀칠. 직각 유지가 중요(삼각 보강 권장).",
      "슬롯에 빨대 핀을 넣어 캐리지가 걸림 없이 미끄러지는지 먼저 확인 (안 되면 슬롯 폭 +0.5 mm, 빨대에 연필심 문지르기).",
      "Fin Ray 4개 조립 → 캐리지 판에 고정 → 핀으로 벽에 걸기.",
      "Hard 갈래판 2장을 벽 양쪽에 두고 핀 2개로 연결 → 아래 브리지 → 패드·손톱.",
      "실·고무줄 연결 후 완전 개방 위치로 돌아오는지 확인.",
    ],
  };
}

// ---------------------------------------------------------------------------- B3

function b3(pIn: typeof B3p = B3p, dIn: Record<string, unknown> = B3c.derived): DesignPattern {
  const p = pIn;
  const d = dIn as unknown as Record<string, number>;
  const base = b1();
  const shapes = base.shapes.filter((s) => !s.label.startsWith("Hard") && !s.label.startsWith("쐐기") && !s.label.startsWith("손톱") && !s.label.startsWith("손바닥"));
  const bot = rect("손바닥 아랫장", 1, "B골 3 mm", p.palm.sx, p.palm.sy, "윗장과 골 방향 엇갈림. 텐던 구멍·드럼 슬롯 같은 위치.", "y");
  for (const t of [-1, 1]) bot.holes.push({ c: [p.palm.sx / 2, p.palm.sy / 2 + t * (p.palm.sy / 2 + (p.hard.plies * T) / 2 - p.hard.r1)], d: 3 });
  for (const s of [-1, 1]) rectCut(bot, s > 0 ? p.palm.sx - p.soft.drum_r : 0, p.soft.drum_y + p.palm.sy / 2 - 5, p.soft.drum_r, 10);
  shapes.unshift(bot);
  const sx = p.palm.sx;
  const sy = p.palm.sy;
  const yf = FR.pair_y;
  const yLo = -yf - FR.width / 2 - 2;
  const yHi = p.soft.drum_y + 5;
  const top = rect("손바닥 윗장", 1, "B골 3 mm", sx, sy, "플랩이 분리 부품(빨대 축). 텐던 구멍 2개.", "x");
  for (const t of [-1, 1]) top.holes.push({ c: [sx / 2, sy / 2 + t * (sy / 2 + (p.hard.plies * T) / 2 - p.hard.r1)], d: 3 });
  for (const s of [-1, 1]) rectCut(top, s > 0 ? sx - p.soft.drum_r : 0, p.soft.drum_y + sy / 2 - 5, p.soft.drum_r, 10);
  shapes.unshift(top);
  const flap = rect("Soft 플랩 (분리형)", 2, "B골 3 mm 2겹", p.soft.root_len + 6, yHi - yLo, "위 6 mm 에 굵은 빨대 부싱을 감싸 붙임 → 손바닥 모서리의 일반 빨대 축에 끼움.", "x");
  flap.score.push([[6, 0], [6, yHi - yLo]]);
  shapes.push(flap);
  const w = p.hard.width;
  const l1 = blank("텐던 근위지골 판", 6, "B골 3 mm", w, p.hard.l1 + 6, "3장 적층. 위 6 mm 중심 = 축 구멍. 바깥 장은 원위지골 판과 한 장으로 이어 J2 를 score 힌지로 만들어도 됨.");
  rectCut(l1, 0, 0, w, p.hard.l1 + 6);
  l1.holes.push({ c: [w / 2, 6], d: C.straw_d + 0.5 });
  l1.mark.push([[2, 6 + 12], [w - 2, 6 + 12]], [[2, p.hard.l1 - 2], [w - 2, p.hard.l1 - 2]]);
  l1.text.push({ p: [2, 6 + 16], s: `텐던 고리 (안쪽 ${p.hard.r1} mm 띄움)`, size: 3 });
  l1.flute = "y";
  shapes.push(l1);
  const l2len = p.hard.l2 - p.hard.nail_len;
  const l2 = rect("텐던 원위지골 판", 6, "B골 3 mm", w, l2len, "3장 적층. 끝에 손톱(가운데 장을 6 mm 길게 남겨도 됨).", "y");
  l2.mark.push([[2, 8], [w - 2, 8]], [[2, l2len - 12], [w - 2, l2len - 12]]);
  shapes.push(l2);
  const wedge = Number(d.hard_face_wedge_deg);
  const wl = 22;
  const wt = wl * Math.tan((wedge * Math.PI) / 180);
  const wsh = blank(`원위 쐐기 받침 (${fx(wedge)}°)`, 2, "B골 3 mm 적층", wl, wt, "두꺼운 쪽이 손끝. 고무줄 감아 패드.");
  wsh.cut.push({ pts: [[0, 0], [wl, 0], [wl, wt], [0, 0.6]], closed: true });
  shapes.push(wsh);
  shapes.push(rect("텐던 고리 받침", 8, "B골 3 mm 적층", 8, p.hard.r1, `빨대 토막(8 mm)을 이 받침 끝에 붙여 텐던 고리로. 근위 ${p.hard.r1} mm / 원위 ${p.hard.r2} mm 로 높이 맞춤.`, "x"));
  const t20 = p.hard.theta2_rest_deg;
  const stopParts: Shape[] = [];
  const extraCut: string[] = [];
  if (t20 > 0) {
    // 원위 젖힘 스토퍼: 근위 끝 바깥면에 붙이는 삼각 블록, 빗변에 원위가 기대어 θ2 = t20 에서 멈춤
    const a = 18;
    const st = blank(`원위 젖힘 스토퍼 (${t20}°)`, 2, "B골 3 mm 3겹 적층", a, a * Math.tan((t20 * Math.PI) / 180), `근위지골 끝 바깥면(J2 바로 위)에 직각변을 붙임. 원위지골이 빗변에 닿아 휴지 θ2=${t20}° 유지.`);
    st.cut.push({ pts: [[0, 0], [a, 0], [0, a * Math.tan((t20 * Math.PI) / 180)]], closed: true });
    stopParts.push(st);
  }
  const t10s = p.hard.theta1_rest_deg;
  const st1 = blank(`근위 휴지 스토퍼 (${t10s}°)`, 2, "B골 3 mm 3겹 적층", 20, 20 * Math.tan((t10s * Math.PI) / 180), `손바닥 앞·뒤 모서리 바깥에 붙임. 근위지골이 ${t10s}° 에서 기대어 멈춤 (복원 고무줄이 여기로 당김).`);
  st1.cut.push({ pts: [[0, 0], [20, 0], [0, 20 * Math.tan((t10s * Math.PI) / 180)]], closed: true });
  stopParts.push(st1);
  const k1s = (p.hard as { k1_spec_Nmm_per_rad?: number }).k1_spec_Nmm_per_rad;
  if (k1s) {
    const k2s = k1s * Number(d.tendon_k2_over_k1);
    const arm1 = 10;
    const arm2 = 8;
    extraCut.push(
      `복원 고무줄 강성 (SymPy J3·J5): J1 k1=${fx(k1s)} N·mm/rad → 레버 ${arm1} mm 에서 고무줄 ${fx(k1s / arm1 ** 2)} N/mm, J2 k2=${fx(k2s)} N·mm/rad → 레버 ${arm2} mm 에서 ${fx(k2s / arm2 ** 2)} N/mm. 상한 k1 ≤ ${fx(Number(d.tendon_k1_max_Nmm_per_rad))} — 너무 센 고무줄이면 바닥에서 안 미끄러짐.`,
      "조작: 손바닥을 내려 손톱을 바닥에 대고 실 B 를 당기기만 하면 됨 (예비 말기 불필요)",
    );
  }
  return {
    id: (p as { id?: string }).id ?? "B3",
    name: p.name,
    shapes: [...shapes, ...stopParts],
    cutList: [
      ...extraCut,
      ...finrayCutList(),
      `굵은 빨대 부싱: soft 플랩 ${yHi - yLo} mm × 2, hard 7 mm × 4`,
      `일반 빨대 축: soft ${yHi - yLo + 10} mm × 2, hard ${w + 14} mm × 2, 텐던 고리 8 mm × 8`,
      `고무줄: J1 복원 2, J2 복원 2 (k2/k1 ≈ ${fx(Number(d.tendon_k2_over_k1))} → J2 쪽을 두 겹)`,
      ...((p.hard as { precurl?: boolean }).precurl === false ? [] : ["조작 순서: 공중에서 실 B 60% → 내림 → 끝까지 (바닥에서 말면 원위지골이 걸림, 시뮬 확인)"]),
    ],
    steps: [
      "손바닥 2장 엇갈려 풀칠. 모서리에 굵은 빨대 부싱(플랩용)·짧은 부싱(hard용) 풀칠.",
      "Fin Ray 조립은 B1 과 같음. 분리형 플랩에 붙이고 빨대 축으로 손바닥에 끼움.",
      "텐던 손가락: 근위·원위 판을 각각 3장 적층, J2 는 바깥 장 이어붙여 score 힌지 또는 테이프 힌지.",
      "안쪽 면에 고리 받침+빨대 토막 4개(근위 2, 원위 2). 실을 손바닥 구멍 → 고리 → 원위 끝에 묶음.",
      "바깥 면에 J1·J2 복원 고무줄. J2 는 두 겹(k2/k1 비).",
      "실을 놓으면 θ1=40° 열림·원위 일직선으로 돌아오는지, 공중에서 당기면 원위가 수직을 넘어 말리는지 확인.",
    ],
  };
}

// ---------------------------------------------------------------------------- B4 (하이브리드)

function b4(): DesignPattern {
  const p = B4p;
  // soft 슬롯 부품은 B2 생성기에 B4 soft 값을 넣어 만들고, hard 는 B3 텐던 부품을 그대로 가져옴
  const softSrc = b2({ ...B2p, palm: p.palm, soft: p.soft }, { ...B2c.derived, ...B4c.derived });
  const hardSrc = b3({ ...B3p, palm: p.palm, hard: p.hard }, B4c.derived);
  const soft = softSrc.shapes.filter((s) => /^(Soft|Fin Ray|균형막대)/.test(s.label));
  const hard = hardSrc.shapes.filter((s) => /^(텐던|원위 쐐기)/.test(s.label));
  const sx = p.palm.sx;
  const sy = p.palm.sy;
  const wy = p.soft.wall_y;
  const xMin = Number(B4c.derived.soft_x_min);
  const palms = (["손바닥 윗장", "손바닥 아랫장"] as const).map((lbl, i) => {
    const s = rect(lbl, 1, "B골 3 mm", sx, sy, i === 0 ? "실 A 구멍 4 (x=±16, y=±26), 텐던 구멍 2 (가장자리 중앙)." : "윗장과 골 방향 엇갈림.", i === 0 ? "x" : "y");
    for (const a of [-1, 1]) for (const b of [-1, 1]) s.holes.push({ c: [sx / 2 + a * 16, sy / 2 + b * (wy - 4)], d: 3 });
    for (const t of [-1, 1]) s.holes.push({ c: [sx / 2, sy / 2 + t * (sy / 2 + (p.hard.plies * T) / 2 - p.hard.r1)], d: 3 });
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const y = sy / 2 + b * (wy + 2.5);
      s.mark.push([[sx / 2 + a * (xMin - 2), y], [sx / 2 + a * (p.soft.x_open + 13), y]]);
    }
    return s;
  });
  return {
    id: "B4",
    name: p.name,
    shapes: [...palms, ...soft, ...hard],
    cutList: [
      ...finrayCutList(),
      `일반 빨대 핀: soft ${2 * wy + 10} mm × 4 / hard 축 ${p.hard.width + 14} mm × 2, 텐던 고리 8 mm × 8`,
      "굵은 빨대 부싱 7 mm × 4 (텐던 손가락 피벗, 손바닥 앞·뒤 모서리)",
      `고무줄: 캐리지 복원 2, J1 2, J2 2 (k2/k1 ≈ ${fx(Number(B4c.derived.tendon_k2_over_k1))} → J2 를 두 겹)`,
      "조작 순서(B3 와 같음): 공중에서 실 B 60% → 내림 → 끝까지",
    ],
    steps: [
      "손바닥 2장 엇갈려 풀칠, 가이드 벽 위치·실/텐던 구멍 표시.",
      "Soft 가이드 벽 4장을 손바닥 아랫면에 접착, 빨대 핀 미끄럼부터 확인 (B2 와 같은 10분 테스트).",
      "Fin Ray 4개 조립 → 캐리지(뿌리 2 mm 로 짧음)에 고정 → 핀으로 벽에 걸기.",
      "텐던 손가락 2개: 근위·원위 3장 적층, J2 힌지, 안쪽 고리 4개, 바깥 고무줄 (B3 와 같음).",
      "손바닥 앞·뒤 모서리 부싱에 텐던 손가락 축 끼우고, 텐던을 손바닥 구멍으로 올림.",
      "놓았을 때 캐리지 x=45, 손가락 θ1=40° 로 돌아오는지 확인.",
    ],
  };
}

// ---------------------------------------------------------------------------- B5 (평행사변형 링크)

/** 둥근 끝 막대 프로파일 (y–z 평면 판, 두께는 골판지) + 양끝 구멍 간격 L */
function linkBar(label: string, qty: number, L: number, h: number, note: string, hole = C.straw_d + 0.5) {
  const w = L + h;
  const s = blank(label, qty, "B골 3 mm", w, h, note);
  const pts: P2[] = [];
  const r = h / 2;
  for (let i = 0; i <= 12; i++) pts.push([r + L + r * Math.cos(-Math.PI / 2 + (i / 12) * Math.PI), r + r * Math.sin(-Math.PI / 2 + (i / 12) * Math.PI)]);
  for (let i = 0; i <= 12; i++) pts.push([r + r * Math.cos(Math.PI / 2 + (i / 12) * Math.PI), r + r * Math.sin(Math.PI / 2 + (i / 12) * Math.PI)]);
  s.cut.push({ pts, closed: true });
  s.holes.push({ c: [r, r], d: hole }, { c: [r + L, r], d: hole });
  s.flute = "x";
  return s;
}

function b5(pIn: typeof B5p = B5p, dIn: Record<string, unknown> = B5c.derived): DesignPattern {
  const p = pIn;
  const d = dIn as unknown as Record<string, number>;
  const h = p.hard as typeof B5p.hard & { compliance?: { type: string; travel?: number; sleeve_len?: number; engage_N?: number } };
  const comp = h.compliance;
  const base = b1(p, dIn);
  const keep = base.shapes.filter((s) => /^(손바닥|Fin Ray|Soft|드럼 삼각|균형막대|손톱)/.test(s.label));
  const halfT = (h.plies * T) / 2;
  const Lc = Number(d.hard_coupler_below_E);
  const shapes: Shape[] = [...keep];
  // 브래킷: 위 8 mm 탭(손바닥 접착), 피벗 구멍 2개(굵은 빨대 부싱 Ø12)
  const bh = h.bracket_drop + 8 + 8;
  const bw = h.d + 16;
  const br = blank("링크 브래킷", 4, "B골 3 mm 2겹", bw, bh, comp?.type === "float"
    ? `손가락당 2장(x=±${fx(h.width / 2 + 2.5)}). 손바닥에 붙이지 않음: 위 탭을 꺾어 두 브래킷을 잇는 '다리'로 쓰고, 다리 위에 슬라이더 빨대 2개를 세워 손바닥 구멍으로 올림. 브래킷은 손바닥 슬롯 안에서 ${comp.travel} mm 오르내림.`
    : `손가락당 2장(링크 양옆 x=±${fx(h.width / 2 + 2.5)}). 위 8 mm 탭을 꺾어 손바닥 아랫면 y=±${fx(Number(d.hard_pivot_y))}~${fx(Number(d.hard_pivot_y) + h.d)} 에 풀칠. 구멍엔 굵은 빨대 부싱.`);
  rectCut(br, 0, 0, bw, bh);
  br.score.push([[0, 8], [bw, 8]]);
  br.glue.push({ x: 0, y: 0, w: bw, h: 8 });
  br.holes.push({ c: [8, 8 + h.bracket_drop], d: C.bubble_d + 0.5 }, { c: [8 + h.d, 8 + h.bracket_drop], d: C.bubble_d + 0.5 });
  br.text.push({ p: [4, 8 + h.bracket_drop + 9], s: "안쪽", size: 3 }, { p: [h.d + 2, 8 + h.bracket_drop + 9], s: "바깥(드럼)", size: 3 });
  br.flute = "y";
  shapes.push(br);
  shapes.push(linkBar("바깥 링크 막대", 4, h.L, 12, "손가락당 2장 (x=±11). 바깥 축(빨대)에 풀칠 → 축·드럼·링크가 한 몸으로 회전, 축은 브래킷 부싱 안에서 돎."));
  shapes.push(linkBar("안쪽 링크 막대", 4, h.L, 12, "손가락당 2장 (x=±11, 갈래). 가운데 드럼을 비켜 감. 양끝 핀은 자유 회전."));
  // 커플러 측판: L 자 (수평 팔 E_in→E_out, 수직 다리 E_in→손끝)
  const arm = h.d + 12;
  const leg = Lc - h.nail_len + 6;
  const cs = blank("커플러 측판 (L자)", 4, "B골 3 mm 2겹", arm, leg, `손가락당 2장. 구멍 간격 = 링크 피벗 간격 ${h.d} mm → 평행사변형. 수직 다리 안쪽에 손끝판을 끼워 풀칠.`);
  cs.cut.push({ pts: [[0, 0], [arm, 0], [arm, 12], [12, 12], [12, leg], [0, leg]], closed: true });
  cs.holes.push({ c: [6, 6], d: C.straw_d + 0.5 }, { c: [6 + h.d, 6], d: C.straw_d + 0.5 });
  cs.flute = "y";
  shapes.push(cs);
  shapes.push(rect("손끝판 (패드)", 6, "B골 3 mm", h.width, Lc - h.nail_len + 2, `3장 적층 → 두 측판의 수직 다리 사이(안쪽 면)에 풀칠. 패드면은 항상 수직(평행 pinch, 쐐기 없음). 안쪽에 고무줄 감기 + V컷.`, "y"));
  shapes.push(disk("Hard 드럼 큰판", 4, h.drum_r, C.straw_d + 0.5, "바깥 축에 풀칠 (큰-작은-큰 = 실 홈). 링크 막대 사이 가운데."));
  shapes.push(disk("Hard 드럼 작은판", 2, h.drum_r - 3, C.straw_d + 0.5));
  const ty = Number(d.hard_pivot_y) + h.d - h.drum_r;
  const compCut: string[] = [];
  if (comp?.type === "float") {
    // 손바닥 슬롯(브래킷 통과) + 슬라이더 구멍
    const yp0 = Number(d.hard_pivot_y);
    const bxx = h.width / 2 + 2.5;
    for (const sh of shapes.filter((x) => x.label.startsWith("손바닥"))) {
      const ox = sh.label.includes("윗장") ? p.soft.root_len : 0;
      for (const sx of [1, -1]) for (const t of [1, -1]) {
        const cx = ox + p.palm.sx / 2 + sx * bxx;
        const y0 = p.palm.sy / 2 + t * (yp0 - 6);
        const y1 = p.palm.sy / 2 + t * (yp0 + h.d + 6);
        rectCut(sh, cx - 2.5, Math.min(y0, y1), 5, Math.abs(y1 - y0));
        sh.holes.push({ c: [cx, p.palm.sy / 2 + t * (yp0 + 2)], d: C.straw_d + 1 });
      }
      sh.note = (sh.note ?? "") + " 플로팅: 브래킷 슬롯 4개(폭 5)·슬라이더 구멍 4개.";
    }
    compCut.push(
      `플로팅 텔레스코프: 굵은 빨대 슬리브 ${comp.sleeve_len} mm × 4 (손바닥 윗면에 세워 풀칠), 일반 빨대 슬라이더 ${(comp.sleeve_len ?? 30) + 12} mm × 4 (브래킷 다리에 세움)`,
      `프리로드 고무줄: 슬리브 위끝 ↔ 슬라이더 아래, ${comp.engage_N} N 에서 뜨기 시작, 10 mm 에서 6 N (≈ ${fx(Number(d.float_k_N_per_mm))} N/mm, 손가락당 2개 합)`,
    );
  }
  if (comp?.type === "nail") compCut.push(`긴 손톱 ${h.nail_len} mm: 테이프 힌지 + 안쪽 스토퍼. 접히면 최대 ${fx(Number(d.vertical_compliance_mm))} mm 순응. 손톱 안쪽에도 고무줄 감기(접히기 전엔 쥐는 면)`);
  return {
    id: (p as { id?: string }).id ?? "B5",
    name: p.name,
    shapes,
    cutList: [
      ...compCut,
      ...finrayCutList(),
      `일반 빨대 축/핀: 손가락당 4개 × ${h.width + 8} mm (안쪽 축, 바깥 축, E_in 핀, E_out 핀)`,
      `굵은 빨대 부싱: 손가락당 4개 × 4 mm (브래킷 구멍)`,
      `텐던 1가닥 연속 루프: 앞 드럼(3바퀴) → 손바닥 구멍 y=+${fx(ty)} → 모터 풀리(또는 손잡이) → 구멍 y=-${fx(ty)} → 뒤 드럼. 풀리에서 루프를 당기면 두 손가락이 같은 장력으로 닫힘`,
      `복원 고무줄: 손가락당 1개 (바깥 링크 끝 ↔ 브래킷 바깥 위)`,
      `텐던 장력 ${fx(Number(d.hard_string_T_N))} N (pinch 8 N), 당김 ${fx(Number(d.hard_pull_mm))} mm`,
    ],
    steps: [
      "손바닥 2장(플랩 포함 윗장) 엇갈려 풀칠. 가운데 텐던 구멍 2개.",
      "Fin Ray·soft 플랩·드럼은 B1 과 같음.",
      "브래킷 4장: 탭을 접어 손바닥 아랫면에 링크 폭(28)만큼 띄워 2장씩 평행하게 풀칠, 구멍에 굵은 빨대 부싱.",
      "바깥 축(빨대) = 드럼 + 바깥 링크 막대 2장을 풀칠해 한 몸. 안쪽 축은 안쪽 링크 막대 2장과 풀칠.",
      "커플러 측판 2장 + 손끝판 3겹 → 'ㄷ' 모양 손끝. 링크 끝 핀 2개로 연결 → 평행사변형 확인(손끝판이 항상 수직인지 손으로 돌려봄).",
      "손톱 플랩·스토퍼·패드 고무줄. 텐던 루프 감고 복원 고무줄 걸기.",
    ],
  };
}

export const PATTERNS: DesignPattern[] = [
  b5(B5Np as unknown as typeof B5p, B5Nc.derived),
  b5(B5Fp as unknown as typeof B5p, B5Fc.derived),
  b5(),
  b1(),
  b2(),
  b3(),
  b3(B3op as unknown as typeof B3p, B3oc.derived),
  b4(),
];
