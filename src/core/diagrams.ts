/**
 * 메커니즘 단면도 (SVG 문자열). params / calc 값에서 그리므로 치수가 바뀌면 그림도 바뀜.
 * D1 soft 정면 단면 · D2 hard 측면 단면 · D3 드럼 만들기 · D4 바깥 축 단면(드럼 샌드위치) · D5 위에서 본 실 경로
 */
import common from "../../params/common.json";
import B5Np from "../../params/B5N.json";
import B5Nc from "../../calc/out/B5N.json";
import B5Ep from "../../params/B5E.json";
import B5Ec from "../../calc/out/B5E.json";

const C = common;
type SLev = { r: number; w: number; beta_open_deg: number; guide_x: number; guide_dz: number; slot_depth: number };
type HLev = { r: number; w: number; gamma_open_deg: number; hole_y: number };
type PP = typeof B5Np & { soft: typeof B5Np.soft & { lever?: SLev }; hard: typeof B5Np.hard & { lever?: HLev } };
// 현재 그리는 설계 (DIAGRAMS(id) 가 바꿈). B5E = 드럼 대신 레버
let P = B5Np as PP;
let D = B5Nc.derived as unknown as Record<string, number>;
const deg = Math.PI / 180;
const zt = C.board_t * C.palm_layers;

type Pt = [number, number];
const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** world(mm, 위가 +) → svg 좌표 */
class Fig {
  out: string[] = [];
  constructor(
    public x0: number,
    public x1: number,
    public z0: number,
    public z1: number,
    public s = 3,
    public title = "",
  ) {}
  X = (x: number) => (x - this.x0) * this.s;
  Z = (z: number) => (this.z1 - z) * this.s;
  get w() {
    return (this.x1 - this.x0) * this.s;
  }
  get h() {
    return (this.z1 - this.z0) * this.s;
  }
  poly(pts: Pt[], cls: string, closed = true) {
    const d = pts.map((p) => `${n(this.X(p[0]))},${n(this.Z(p[1]))}`).join(" ");
    this.out.push(closed ? `<polygon class="${cls}" points="${d}"/>` : `<polyline class="${cls}" points="${d}"/>`);
  }
  rect(x0: number, z0: number, x1: number, z1: number, cls: string) {
    this.poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], cls);
  }
  line(a: Pt, b: Pt, cls: string) {
    this.poly([a, b], cls, false);
  }
  circle(c: Pt, r: number, cls: string) {
    this.out.push(`<circle class="${cls}" cx="${n(this.X(c[0]))}" cy="${n(this.Z(c[1]))}" r="${n(r * this.s)}"/>`);
  }
  zig(a: Pt, b: Pt, cls = "rubber", k = 8, amp = 1.6) {
    const pts: Pt[] = [a];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L = Math.hypot(dx, dz);
    const nx = -dz / L;
    const nz = dx / L;
    for (let i = 1; i < k; i++) pts.push([a[0] + (dx * i) / k + nx * amp * (i % 2 ? 1 : -1), a[1] + (dz * i) / k + nz * amp * (i % 2 ? 1 : -1)]);
    pts.push(b);
    this.poly(pts, cls, false);
  }
  /** 라벨 + 지시선 */
  label(at: Pt, text: string, to: Pt, anchor: "start" | "end" | "middle" = "start", cls = "lbl") {
    this.line(at, to, "lead");
    this.out.push(`<circle class="dot" cx="${n(this.X(to[0]))}" cy="${n(this.Z(to[1]))}" r="2"/>`);
    const lines = text.split("\n");
    lines.forEach((t, i) => this.out.push(`<text class="${cls}" x="${n(this.X(at[0]))}" y="${n(this.Z(at[1]) + i * 14 - (lines.length - 1) * 7 + 4)}" text-anchor="${anchor}">${t}</text>`));
  }
  /** 폭 w 막대 (a→b) */
  bar(a: Pt, b: Pt, w: number, cls: string) {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    const o: Pt = [(-dz / l) * (w / 2), (dx / l) * (w / 2)];
    this.poly([[a[0] + o[0], a[1] + o[1]], [b[0] + o[0], b[1] + o[1]], [b[0] - o[0], b[1] - o[1]], [a[0] - o[0], a[1] - o[1]]], cls);
  }
  text(at: Pt, t: string, cls = "note", anchor: "start" | "end" | "middle" = "start") {
    this.out.push(`<text class="${cls}" x="${n(this.X(at[0]))}" y="${n(this.Z(at[1]))}" text-anchor="${anchor}">${t}</text>`);
  }
  svg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(this.w)} ${n(this.h)}" role="img" aria-label="${this.title}">${STYLE}${this.out.join("")}</svg>`;
  }
}

const STYLE = `<style>
.board{fill:#d8b48a;stroke:#6b4a2a;stroke-width:1.2}
.board2{fill:#c9a274;stroke:#6b4a2a;stroke-width:1.2}
.ghost{fill:none;stroke:#8a7a68;stroke-width:1;stroke-dasharray:5 4}
.flank{fill:#f3dfbd;stroke:#9a7a4a;stroke-width:1.2}
.flankg{fill:none;stroke:#b09a7a;stroke-width:1;stroke-dasharray:5 4}
.drum{fill:#a87a4c;stroke:#5a3d22;stroke-width:1.2}
.groove{fill:none;stroke:#3d2714;stroke-width:1;stroke-dasharray:3 3}
.straw{fill:#f7f5f0;stroke:#888;stroke-width:1}
.string{fill:none;stroke:#1b3a6b;stroke-width:2.2}
.tendon{fill:none;stroke:#7d3c98;stroke-width:2.4}
.rubber{fill:none;stroke:#e4572e;stroke-width:2}
.stop{fill:#4f7d6c;stroke:#244a3d;stroke-width:1.2}
.nail{fill:#8a6a45;stroke:#4a3520;stroke-width:1.2}
.pad{fill:#333}
.obj{fill:#8f9cad;stroke:#4d5866;stroke-width:1.2}
.floor{stroke:#2f6b5b;stroke-width:3}
.pivot{fill:#fff;stroke:#222;stroke-width:1.5}
.lead{fill:none;stroke:#555;stroke-width:.8}
.dot{fill:#555}
.glue{fill:url(#hatch);stroke:none}
text{font-family:"IBM Plex Sans KR","WenQuanYi Zen Hei","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.lbl{font-size:12.5px;fill:#1d2422}
.note{font-size:11px;fill:#5b6763}
.hd{font-size:15px;font-weight:700;fill:#1d2422}
.dim{font-size:11px;fill:#244a3d;font-family:"IBM Plex Mono",monospace}
</style><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="#e08a00" stroke-width="1.6"/></pattern></defs>`;

// ------------------------------------------------------------------ D1 soft 정면 단면
export function softSection() {
  const f = new Fig(-235, 300, -112, 100, 2.0, "soft 정면 단면");
  const xh = P.palm.sx / 2;
  const rel = (P.soft as { palm_edge_relief?: number }).palm_edge_relief ?? 0;
  const Rr = P.soft.root_len;
  const L = C.finray.L;
  const b = C.finray.base;
  const phiMin = D.soft_phi_min_deg * deg;
  const r = P.soft.drum_r;
  const flapAt = (s: number, phi: number) => {
    const A: Pt = [s * Math.sin(phi), -Math.cos(phi)];
    const N: Pt = [s * Math.cos(phi), Math.sin(phi)];
    const H: Pt = [s * xh, zt];
    const at = (u: number, v: number): Pt => [H[0] + A[0] * u * s + N[0] * v * 1, H[1] + A[1] * u + N[1] * v];
    return { A, N, H, at };
  };
  // 손바닥 (윗장 + relief 아랫장)
  f.rect(-xh, 3, xh, 6, "board");
  f.rect(-xh + rel, 0, xh - rel, 3, "board2");
  const sl = P.soft.lever;
  const phiO = P.soft.phi_open_deg * deg;
  for (const s of [1, -1]) {
    // 열린 자세 점선 (B5N 90° 펼침 / B5E 30°)
    if (!sl) {
      const o = flapAt(s, 90 * deg);
      const Ho = o.H;
      f.poly([Ho, [Ho[0] + s * Rr, Ho[1]], [Ho[0] + s * (Rr + L), Ho[1]], [Ho[0] + s * Rr, Ho[1] + b]], "flankg");
    } else {
      const Ao: Pt = [s * Math.sin(phiO), -Math.cos(phiO)];
      const No: Pt = [s * Math.cos(phiO), Math.sin(phiO)];
      const Hh: Pt = [s * xh, zt];
      const po = (u: number, v: number): Pt => [Hh[0] + Ao[0] * u + No[0] * v, Hh[1] + Ao[1] * u + No[1] * v];
      f.poly([po(Rr, 0), po(Rr + L, 0), po(Rr, b)], "flankg");
      f.line(po(0, 0), po(Rr, 0), "flankg");
      const bo = sl.beta_open_deg * deg;
      f.bar(Hh, [Hh[0] - s * sl.r * Math.cos(bo), Hh[1] + sl.r * Math.sin(bo)], sl.w, "ghost");
    }
    // 닫힌 자세 (φ_min)
    const phi = phiMin;
    const A: Pt = [s * Math.sin(phi), -Math.cos(phi)];
    const N: Pt = [s * Math.cos(phi), Math.sin(phi)];
    const H: Pt = [s * xh, zt];
    const pt = (u: number, v: number): Pt => [H[0] + A[0] * u + N[0] * v, H[1] + A[1] * u + N[1] * v];
    f.poly([pt(0, 0), pt(Rr, 0), pt(Rr, 3), pt(0, 3)], "board");
    f.poly([pt(Rr, 0), pt(Rr + L, 0), pt(Rr, b)], "flank");
    for (const i of [2, 4, 6, 8]) f.line(pt(Rr + (L * i) / 10, 0), pt(Rr + (L * i) / 10, b * (1 - i / 10)), "straw");
    if (sl) {
      // 레버 (V자: 발은 플랩 바깥면, 팔은 손바닥 위 안쪽). 닫힘 자세 β = β0 + (φ_open − φ)
      const be = sl.beta_open_deg * deg + (phiO - phi);
      const tip: Pt = [H[0] - s * sl.r * Math.cos(be), H[1] + sl.r * Math.sin(be)];
      f.bar(pt(0, 3 + sl.w / 2), pt(16, 3 + sl.w / 2), sl.w, "drum");
      f.bar(H, tip, sl.w, "drum");
      f.circle(tip, 1.2, "pivot");
      f.poly([tip, [s * sl.guide_x, zt + sl.guide_dz]], "string", false);
    } else {
      // 드럼 (힌지 중심)
      f.circle(H, r, "drum");
      f.circle(H, r - 3, "groove");
      // 실 A: 안쪽 접선에서 위로 → 균형막대
      f.poly([[s * (xh - r), zt], [s * (xh - r), 62]], "string", false);
    }
    // 복원 고무줄
    f.zig(pt(Rr * 0.7, 3.2), [s * (xh - 14), zt + 0.5], "rubber", 6, 1.2);
    // 닫힘 스토퍼 블록
    const fx0 = D.soft_stop_face_x;
    const hb = (P.soft as { stop_block_h?: number }).stop_block_h ?? 8;
    f.rect(s * (fx0 - 6), -hb, s * fx0, 0, "stop");
  }
  // 균형막대 + 직렬 고무줄 + 손잡이
  const wx = sl ? sl.guide_x : xh - r;
  f.rect(-wx - 4, 61, wx + 4, 64, "board");
  f.zig([0, 64], [0, 80], "rubber", 8, 2);
  f.poly([[0, 80], [0, 92]], "string", false);
  f.text([0, 94], "손잡이 (실 A)", "lbl", "middle");
  // 라벨 (왼쪽 열: 끝 정렬 x=-112, 오른쪽 열: x=112)
  const Lx = -118;
  const Rx = 118;
  f.label([Lx, 88], "실 A 를 위로 당기면 플랩이 닫힘", [0, 88], "end");
  const fv = (P as { force_video?: { soft_per_finger_N: number } }).force_video;
  f.label([Lx, 72], fv ? `직렬 고무줄 = 힘 제한 (${fv.soft_per_finger_N} N/Fin Ray)` : "직렬 고무줄 = 힘 제한 (Fin Ray 당 2.5 N)", [0, 72], "end");
  f.label([Rx, 62], "균형막대: 먼저 닿은 쪽은 멈추고 반대쪽이 계속", [wx + 4, 62.5]);
  if (sl) {
    const be = sl.beta_open_deg * deg + (phiO - phiMin);
    const tip: Pt = [xh - sl.r * Math.cos(be), zt + sl.r * Math.sin(be)];
    f.label([Rx, 42], `레버 r${sl.r} (2겹 V자): 팔 끝 구멍에 실 A 매듭`, [tip[0] + 2, tip[1]]);
    f.label([Rx, 28], `레버 발은 플랩 바깥면에 세워 풀칠 + 삼각 보강`, [xh + 6, zt - 6]);
    f.label([Rx, 10], `점선 = 열림 ${P.soft.phi_open_deg}° · 레버가 손바닥에 닿는 ${n(D.soft_lever_stop_phi_deg)}° 가 열림 스토퍼`, [xh - 14, zt + 4]);
  } else {
    f.label([Rx, 40], `드럼 r${r} (원판 3장, 가운데 홈)`, [xh + 8, zt + 10]);
    f.label([Rx, 26], "드럼 중심 = 접는 선 = 힌지, 실은 안쪽 접선에서 위로", [xh - r, 30]);
    f.label([Rx, 10], "플랩 = 윗장이 이어져 접힘 · 점선 = 펼침(90°)", [xh + 6, -6]);
  }
  f.label([Lx, 10], `아랫장 좌우 ${rel} mm 좁게 (−8° 접힐 공간)`, [-(xh - rel) + 0.5, 1.5], "end");
  f.label([Lx, -12], `닫힘 스토퍼 블록 (${n(D.soft_phi_min_deg)}° 에서 멈춤)`, [-(D.soft_stop_face_x - 3), -4], "end");
  f.label([Rx, -40], "Fin Ray: 단면 골판지 띠 + 빨대 리브", [xh + 8, -50]);
  f.label([Rx, -58], "물체에 닿으면 끝이 물체 쪽으로 감쌈", [xh + 2, -80]);
  f.label([Lx, -40], "복원 고무줄: 실을 놓으면 펼쳐짐", [-(xh - 6), 3], "end");
  f.text([-232, -108], `정면 단면 (x–z) · 실선 = 닫힘(−8°), 점선 = 열림(${sl ? P.soft.phi_open_deg : 90}°) · 단위 mm`, "note");
  return f.svg();
}

// ------------------------------------------------------------------ D2 hard 측면 단면
export function hardSection() {
  const h = P.hard;
  const f = new Fig(-215, 215, -112, 66, 2.3, "hard 측면 단면");
  const yp = D.hard_pivot_y;
  const zP = -h.bracket_drop;
  const Lc = D.hard_coupler_below_E;
  const H = D.rigid_palm_height;
  const halfT = (h.plies * C.board_t) / 2;
  const barH = (h as { link_bar_h?: number }).link_bar_h ?? 12;
  f.rect(-P.palm.sy / 2, 0, P.palm.sy / 2, zt, "board");
  // 바닥 + 건전지 (pinch 자세 기준)
  f.line([-115, -H], [115, -H], "floor");
  f.circle([0, -H + 7], 7, "obj");
  for (const t of [1, -1]) {
    // 브래킷
    f.rect(t * (yp - 8), zP - 7, t * (yp + h.d + 8), 0, "ghost");
    const drawFinger = (psi: number, solid: boolean) => {
      const u: Pt = [t * Math.sin(psi), -Math.cos(psi)];
      const P1: Pt = [t * yp, zP];
      const P2: Pt = [t * (yp + h.d), zP];
      const E1: Pt = [P1[0] + u[0] * h.L, P1[1] + u[1] * h.L];
      const E2: Pt = [P2[0] + u[0] * h.L, P2[1] + u[1] * h.L];
      const nrm: Pt = [-u[1] * t, u[0] * t].map((v) => v) as Pt;
      const bar = (a: Pt, b: Pt) => {
        const ny = -(b[1] - a[1]);
        const nz = b[0] - a[0];
        const l = Math.hypot(ny, nz);
        const o: Pt = [(ny / l) * (barH / 2), (nz / l) * (barH / 2)];
        f.poly([[a[0] + o[0], a[1] + o[1]], [b[0] + o[0], b[1] + o[1]], [b[0] - o[0], b[1] - o[1]], [a[0] - o[0], a[1] - o[1]]], solid ? "board" : "ghost");
      };
      void nrm;
      bar(P2, E2);
      bar(P1, E1);
      // 커플러 바 + 손끝판 + 손톱
      f.poly([[E1[0], E1[1] + 4.5], [E2[0] + t * 4, E2[1] + 4.5], [E2[0] + t * 4, E2[1] - 4.5], [E1[0], E1[1] - 4.5]], solid ? "board2" : "ghost");
      const tipZ = E1[1] - Lc;
      f.rect(E1[0] - halfT, tipZ + h.nail_len, E1[0] + halfT, E1[1] - 4.5, solid ? "board2" : "ghost");
      f.rect(E1[0] - t * halfT - 0.5, tipZ, E1[0] - t * halfT + t * 1.5, tipZ + h.nail_len, solid ? "nail" : "ghost");
      if (solid) for (const e of [E1, E2]) f.circle(e, 3, "pivot");
    };
    drawFinger(h.psi_open_deg * deg, false);
    drawFinger(0, true);
    const hl = h.lever;
    if (hl) {
      // 레버 (발 = 바깥 링크 방향, 팔 = 안쪽 피벗 쪽). 쥔 자세(ψ=0) 실선, 열림 점선
      const P2: Pt = [t * (yp + h.d), zP];
      for (const [psi, cls] of [[h.psi_open_deg * deg, "ghost"], [0, "drum"]] as [number, string][]) {
        const ga = hl.gamma_open_deg * deg + (h.psi_open_deg * deg - psi);
        const tip: Pt = [P2[0] - t * hl.r * Math.cos(ga), P2[1] + hl.r * Math.sin(ga)];
        const u: Pt = [t * Math.sin(psi), -Math.cos(psi)];
        f.bar(P2, [P2[0] + u[0] * 26, P2[1] + u[1] * 26], hl.w, cls);
        f.bar(P2, tip, hl.w, cls);
        if (cls === "drum") {
          f.circle(tip, 1.2, "pivot");
          f.poly([tip, [t * hl.hole_y, 0]], "tendon", false);
        }
      }
    } else {
      // 드럼 (바깥 피벗)
      f.circle([t * (yp + h.d), zP], h.drum_r, "drum");
      f.circle([t * (yp + h.d), zP], h.drum_r - 3, "groove");
    }
    f.circle([t * yp, zP], 3, "pivot");
    f.circle([t * (yp + h.d), zP], 3, "pivot");
    // 스토퍼 탭
    f.rect(t * D.hard_stop_tab_y - 3, D.hard_stop_tab_z, t * D.hard_stop_tab_y + 3, D.hard_stop_tab_z + 6, "stop");
    // 복원 고무줄 (바깥 링크 → 브래킷 위)
    f.zig([t * (yp + h.d + 3), zP - 30], [t * (yp + h.d + 6), zP + 6], "rubber", 7, 1.5);
  }
  // 텐던 루프
  const ty = h.lever ? h.lever.hole_y : yp + h.d - h.drum_r;
  f.poly([[ty, h.lever ? 0 : zP], [ty, 44], [0, 52], [-ty, 44], [-ty, h.lever ? 0 : zP]], "tendon", false);
  f.circle([0, 50], 5, "drum");
  f.text([0, 59], "손잡이 / 모터 풀리 (텐던 1가닥 루프)", "lbl", "middle");
  const Lx = -82;
  const Rx = 82;
  const what = h.lever ? "레버" : "드럼";
  f.label([Lx, 40], `텐던 1가닥: 앞 ${what} → 풀리 → 뒤 ${what}`, [-ty, 30], "end");
  f.label([Lx, 26], "양쪽 같은 장력 → 앞·뒤 동시에 닫힘", [-ty, 20], "end");
  if (h.lever) {
    f.label([Rx, 26], `레버 r${h.lever.r} (3겹): 발을 링크 막대 사이에 접착`, [yp + h.d + 4, zP - 12]);
    f.label([Rx, 12], `레버 끝 매듭 → 손바닥 구멍 y=±${n(ty)} → 위로`, [ty, 0]);
  } else {
    f.label([Rx, 26], `드럼 r${h.drum_r}: 바깥 링크 막대 사이에 면 접착`, [yp + h.d + 10, zP + 8]);
    f.label([Rx, 12], `실은 드럼 안쪽 접선(y=±${n(ty)})에서 위로`, [ty, 0]);
  }
  f.label([Rx, -40], `평행사변형: 피벗 간격 ${h.d} = 핀 간격 ${h.d}, 링크 ${h.L}`, [yp + h.d / 2 + 3, zP - 28]);
  f.label([Rx, -54], "→ 손끝판 항상 수직 (평행 pinch)", [yp, -H + 30]);
  f.label([Rx, -8], `열림 ${h.psi_open_deg}° 스토퍼 탭 (점선 = 열림 자세)`, [D.hard_stop_tab_y, D.hard_stop_tab_z + 3]);
  f.label([Rx, -86], "건전지 pinch: 링크 수직 = 손끝 최저점", [9, -H + 7]);
  f.label([Lx, -78], `긴 손톱 ${h.nail_len} mm (3겹): 바닥에 눌리면 접힘`, [-yp + halfT, -H + 6], "end");
  f.label([Lx, -14], "복원 고무줄: 실을 놓으면 바깥으로 열림", [-(yp + h.d + 4.5), zP - 14], "end");
  f.text([-212, -108], `측면 단면 (y–z), 손바닥 아래 높이 ${n(H)} mm 에서 건전지 · 단위 mm`, "note");
  return f.svg();
}

// ------------------------------------------------------------------ D3 드럼 만들기
export function drumHowTo() {
  const f = new Fig(0, 300, -10, 120, 2.6, "드럼 만들기");
  const R = P.hard.drum_r;
  const ell = (cx: number, cz: number, r: number, cls: string) =>
    f.out.push(`<ellipse class="${cls}" cx="${n(f.X(cx))}" cy="${n(f.Z(cz))}" rx="${n(r * f.s)}" ry="${n(r * f.s * 0.35)}"/>`);
  // 1. 원판 3장
  f.text([10, 112], "① 원판 3장 자르기", "hd");
  ell(30, 85, R, "drum");
  ell(70, 85, R - 3, "drum");
  ell(110, 85, R, "drum");
  f.text([30, 65], `큰판 r${R}`, "note", "middle");
  f.text([70, 65], `작은판 r${R - 3}`, "note", "middle");
  f.text([110, 65], `큰판 r${R}`, "note", "middle");
  f.text([10, 55], "중심 십자에 송곳 → 짧은 직선으로 끊어 자르고 칼로 다듬기", "note");
  // 2. 빨대 지그로 적층
  f.text([160, 112], "② 빨대에 꽂아 중심 맞춰 풀칠", "hd");
  f.rect(205, 30, 208, 108, "straw");
  ell(206.5, 90, R, "drum");
  ell(206.5, 80, R - 3, "drum");
  ell(206.5, 70, R, "drum");
  f.label([235, 80], "가운데가 3 mm 작음\n→ 깊이 3 mm 실 홈", [206.5 + R - 4, 80]);
  // 3. 실 매듭 + 테이프
  f.text([10, 40], "③ 홈에 테이프 1바퀴(골판지 단면 마감) · 큰판 가장자리 구멍에 실 매듭", "hd");
  f.circle([60, 12], R, "drum");
  f.circle([60, 12], R - 3, "groove");
  f.circle([60, 12 + R - 3], 1.2, "pivot");
  f.poly([[60, 12 + R - 3], [60 + R + 3, 12 + 2], [60 + R + 3, -8]], "string", false);
  f.label([110, 22], "감는 방향: 실을 위로 당길 때\n손가락이 닫히는 쪽 (조립 후 손으로 확인)", [60 + R + 3, 5]);
  f.text([170, 12], "④ hard 드럼 → 바깥 링크 막대 사이(D4)", "lbl");
  f.text([170, 0], "④ soft 드럼 → 플랩 바깥 힌지선에 세워 + 삼각 보강", "lbl");
  return f.svg();
}

// ------------------------------------------------------------------ D3' 레버 만들기 (B5E)
export function leverHowTo() {
  const f = new Fig(0, 300, -14, 120, 2.6, "레버 만들기");
  const hl = P.hard.lever!;
  const sl = P.soft.lever!;
  const vshape = (cx: number, cz: number, arm: number, foot: number, w: number, alphaDeg: number, cls: string) => {
    const a = alphaDeg * deg;
    f.bar([cx, cz], [cx + arm, cz], w, cls);
    f.bar([cx, cz], [cx + foot * Math.cos(a), cz + foot * Math.sin(a)], w, cls);
    f.circle([cx + arm, cz], 1.2, "pivot");
  };
  const aH = 360 - (270 - hl.gamma_open_deg - P.hard.psi_open_deg);
  const aS = 360 - (270 - sl.beta_open_deg - P.soft.phi_open_deg);
  f.text([10, 112], "① V자 판 자르기 (전개도 그대로)", "hd");
  vshape(40, 70, hl.r, 26, hl.w, aH, "drum");
  f.circle([40, 70], 3, "pivot");
  f.text([30, 48], `hard 레버 ×3장: 팔 ${hl.r} · 발 26 · ${n(aH)}°`, "note");
  vshape(150, 70, sl.r, 16, sl.w, aS, "drum");
  f.text([135, 48], `soft 레버 ×2장: 팔 ${sl.r} · 발 16 · ${n(aS)}°`, "note");
  f.text([10, 34], "② 같은 판끼리 겹쳐 풀칠 (hard 3겹 = 두께 9, soft 2겹) — 원판과 달리 중심 맞출 필요 없음", "hd");
  f.text([10, 16], "③ 팔 끝 구멍(Ø1.5)에 실을 꿰어 매듭 → 감기 없음. 매듭에 풀 한 방울", "hd");
  f.text([10, 2], "④ hard 레버: 꼭짓점 구멍 = 바깥 축, 발을 바깥 링크 막대 사이에 면 접착(D4)", "lbl");
  f.text([10, -10], "④ soft 레버: 꼭짓점 = 힌지선, 발을 플랩 바깥면에 세워 풀칠 + 삼각 보강", "lbl");
  return f.svg();
}

// ------------------------------------------------------------------ D4 바깥 축 단면 (드럼 샌드위치)
export function hubSection() {
  const h = P.hard;
  const f = new Fig(-40, 52, -26, 24, 7, "바깥 축 단면");
  const barT = h.link_plies * C.board_t;
  const bIn = h.width / 2 + 1;
  const r = 8;
  for (const s of [1, -1]) {
    f.rect(s * bIn, -r - 6, s * (bIn + 3), r + 6, "ghost");
    f.rect(s * 4.5, -r, s * (4.5 + barT), r, "board");
    f.rect(s * 4.5 - s * 0.6, -r, s * 4.5 + s * 0.6, r, "glue");
  }
  if (h.lever) f.rect(-4.5, -r, 4.5, r, "drum");
  else {
    f.rect(-4.5, -h.drum_r / 2, -1.5, h.drum_r / 2, "drum");
    f.rect(-1.5, -h.drum_r / 2 + 3, 1.5, h.drum_r / 2 - 3, "drum");
    f.rect(1.5, -h.drum_r / 2, 4.5, h.drum_r / 2, "drum");
  }
  f.rect(-bIn - 5, -C.straw_d / 2, bIn + 5, C.straw_d / 2, "straw");
  f.label([-39, 19], "브래킷 (손바닥에 고정)\n구멍 = 시험편 지름", [-bIn - 1.5, 10]);
  f.label([18, 20], "바깥 링크 막대 (2장 적층)", [4.5 + barT / 2, r - 1]);
  f.label([-39, -18], h.lever ? "레버 발(3겹)을 막대 사이에\n면 풀칠(빗금) → 토크는 골판지로" : "드럼(큰-작은-큰)을 막대 사이에\n면 풀칠(빗금) → 토크는 골판지로", [-4.5, -2]);
  f.label([20, -16], "빨대 = 핀만 (회전, 토크 X)\n속에 종이 말아 넣어 보강", [15, 0]);
  f.text([-39, -25], "위에서 본 바깥 피벗 (x 방향 단면, 확대)", "note");
  return f.svg();
}

// ------------------------------------------------------------------ D5 위에서 본 실 경로
export function routingTop() {
  const f = new Fig(-150, 150, -60, 60, 2.6, "실 경로 (위에서)");
  const sx = P.palm.sx / 2;
  const sy = P.palm.sy / 2;
  const yp = D.hard_pivot_y;
  const h = P.hard;
  const ty = h.lever ? h.lever.hole_y : yp + h.d - h.drum_r;
  const sl = P.soft.lever;
  // soft 실 A 가 올라가는 x (레버 = 레버 끝, 드럼 = 안쪽 접선)
  const ax = sl ? sx - sl.r * Math.cos(sl.beta_open_deg * deg) : sx - P.soft.drum_r;
  // 좌표: 가로 = x, 세로 = y (위 = +y)
  f.rect(-sx, -sy, sx, sy, "board");
  for (const s of [1, -1]) {
    f.rect(s * sx, -26 * 1, s * (sx + P.soft.root_len), P.soft.drum_y + 5, "board2");
    f.rect(s * (sx + P.soft.root_len), -C.finray.pair_y - 11, s * (sx + P.soft.root_len + 85), -C.finray.pair_y + 11, "flankg");
    f.rect(s * (sx + P.soft.root_len), C.finray.pair_y - 11, s * (sx + P.soft.root_len + 85), C.finray.pair_y + 11, "flankg");
    if (sl) f.rect(s * ax, P.soft.drum_y - 3, s * (sx + 4), P.soft.drum_y + 3, "drum");
    else f.rect(s * (sx - P.soft.drum_r), P.soft.drum_y - 4.5, s * (sx + P.soft.drum_r), P.soft.drum_y + 4.5, "drum");
    f.circle([s * ax, P.soft.drum_y], 2.5, "pivot");
    f.zig([s * (sx + 9), -13], [s * (sx - 14), -13], "rubber", 6, 1.2);
  }
  for (const t of [1, -1]) {
    f.rect(-h.width / 2, t * yp, h.width / 2, t * (yp + h.d), "ghost");
    f.circle([0, t * ty], 2.5, "pivot");
  }
  f.line([-ax, P.soft.drum_y], [ax, P.soft.drum_y], "string");
  f.line([0, ty], [0, -ty], "tendon");
  f.label([-148, 52], sl ? "실 A: 레버 끝(손바닥 위)에서 위로\n(파란선 = 손바닥 위 균형막대)" : "실 A 구멍 없이 드럼 안쪽에서 바로 위로\n(파란선 = 손바닥 위 균형막대)", [-ax, P.soft.drum_y]);
  f.label([60, 52], `텐던 구멍 2개 (x=0, y=±${n(ty)})\n보라선 = 손바닥 위 루프`, [0, ty]);
  f.label([60, -48], "Fin Ray 4개 (점선, 플랩 펼친 상태)", [sx + 60, -C.finray.pair_y]);
  f.label([-148, -48], "hard 손가락 영역 (점선, 앞·뒤)", [-h.width / 2, -yp - 10]);
  f.label([-148, -30], "복원 고무줄 고정 구멍", [-(sx - 14), -13]);
  f.text([-148, -57], "위에서 본 손바닥 (x–y) · 플랩 펼친 상태", "note");
  return f.svg();
}

/** id 별 단면도. B5E 는 드럼 대신 레버 */
export const DIAGRAMS = (id: "B5N" | "B5E" = "B5N") => {
  P = (id === "B5E" ? B5Ep : B5Np) as PP;
  D = (id === "B5E" ? B5Ec : B5Nc).derived as unknown as Record<string, number>;
  const lev = id === "B5E";
  const w = lev ? "레버" : "드럼";
  return [
    { id: "soft", title: `Soft — 플랩 · ${w} · 실 A (정면 단면)`, svg: softSection() },
    { id: "hard", title: `Hard — 평행 링크 · ${w} · 텐던 루프 (측면 단면)`, svg: hardSection() },
    lev ? { id: "lever", title: "V자 레버 만드는 법", svg: leverHowTo() } : { id: "drum", title: "원형 드럼 만드는 법", svg: drumHowTo() },
    { id: "hub", title: `바깥 축: ${lev ? "레버를" : "드럼을"} 링크 막대 사이에 끼우기 (확대)`, svg: hubSection() },
    { id: "route", title: "위에서 본 실 경로", svg: routingTop() },
  ];
};
