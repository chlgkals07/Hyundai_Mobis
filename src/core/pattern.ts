/**
 * 전개도 부품 정의 (2D, mm). 같은 params / calc 값에서 생성 → 3D 시뮬과 치수 일치.
 * 선 규칙: cut = 실선(자르기), score = 점선(접기), mark = 일점쇄선(붙일 위치), glue = 빗금(풀칠), hole = 원(빨대·실),
 * flute = 화살표(골 방향).
 */
import common from "../../params/common.json";
import B1p from "../../params/B1.json";
import B2p from "../../params/B2.json";
import B3p from "../../params/B3.json";
import B1c from "../../calc/out/B1.json";
import B2c from "../../calc/out/B2.json";
import B3c from "../../calc/out/B3.json";

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

function b1(): DesignPattern {
  const p = B1p;
  const d = B1c.derived as Record<string, number>;
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
  for (const t of [0, 1]) rectCut(top, rl + sx / 2 - 5, t ? sy - hr : 0, 10, hr);
  // 고무줄 고정 구멍
  for (const s of [-1, 1]) top.holes.push({ c: [rl + sx / 2 + s * (sx / 2 - 14), oy(-yf)], d: 3 });
  top.text.push({ p: [rl + 4, sy / 2], s: "윗장 (골 ↔)", size: 4 });
  top.flute = "x";
  shapes.push(top);
  const bot = rect("손바닥 아랫장", 1, "B골 3 mm", sx, sy, "윗장과 골 방향을 엇갈리게(↕) 풀칠. 같은 위치에 드럼 슬롯을 자름.", "y");
  for (const s of [-1, 1]) rectCut(bot, s > 0 ? sx - sr : 0, oy(p.soft.drum_y) - 5, sr, 10);
  for (const t of [0, 1]) rectCut(bot, sx / 2 - 5, t ? sy - hr : 0, 10, hr);
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

function b2(): DesignPattern {
  const p = B2p;
  const d = B2c.derived as unknown as Record<string, number>;
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

function b3(): DesignPattern {
  const p = B3p;
  const d = B3c.derived as Record<string, number>;
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
  return {
    id: "B3",
    name: p.name,
    shapes,
    cutList: [
      ...finrayCutList(),
      `굵은 빨대 부싱: soft 플랩 ${yHi - yLo} mm × 2, hard 7 mm × 4`,
      `일반 빨대 축: soft ${yHi - yLo + 10} mm × 2, hard ${w + 14} mm × 2, 텐던 고리 8 mm × 8`,
      `고무줄: J1 복원 2, J2 복원 2 (k2/k1 ≈ ${fx(Number(d.tendon_k2_over_k1))} → J2 쪽을 두 겹)`,
      "조작 순서: 공중에서 실 B 60% → 내림 → 끝까지 (바닥에서 말면 원위지골이 걸림, 시뮬 확인)",
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

export const PATTERNS: DesignPattern[] = [b1(), b2(), b3()];
