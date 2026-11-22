import { Vector3 } from "three";
import B1p from "../../params/B1.json";
import B2p from "../../params/B2.json";
import B3p from "../../params/B3.json";
import B1c from "../../calc/out/B1.json";
import B2c from "../../calc/out/B2.json";
import B3c from "../../calc/out/B3.json";
import { DEG, V, boxPart, clamp, cylPart, lerp, segPart } from "./build";
import { makeObject, sceneSdf } from "./objects";
import {
  C,
  X,
  Y,
  Z_TOP,
  across,
  firstContact,
  mirrorLine,
  mirrorPart,
  nailFold,
  softFlap,
  softSlot,
  wedgePad,
  whiffletree,
  type SoftOut,
} from "./modules";
import type { Assembly, Controls, Design, Line, ModeName, ObjName, Part, Readout } from "./types";

type Derived = Record<string, number | string>;
const num = (d: Derived, k: string) => Number(d[k]);

function palmPart(sx: number, sy: number): Part {
  return boxPart("palm", "palm", "board", [sx, sy, Z_TOP], V(0, 0, Z_TOP / 2));
}

interface HardOut {
  parts: Part[];
  lines: Line[];
  readouts: Readout[];
  tops: Vector3[];
  /** gap = 마주보는 쥐는 면 간격, tipZ = 손톱 끝 높이(바닥 위) */
  metrics: Record<string, number>;
}

/** 1-string(V5) 순차 매핑: s 하나로 soft 먼저, 장력이 프리로드 T0 를 넘으면 hard */
export const ONE_STRING = { softEnd: 0.4, hardStart: 0.45 };
function effAB(ctrl: Controls, one: boolean) {
  if (!one) return { a: ctrl.a, b: ctrl.b };
  return {
    a: clamp(ctrl.s / ONE_STRING.softEnd, 0, 1),
    b: clamp((ctrl.s - ONE_STRING.hardStart) / (1 - ONE_STRING.hardStart), 0, 1),
  };
}

function assemble(
  design: { id: string; oneString: boolean },
  palm: Part,
  soft: SoftOut,
  hard: HardOut,
  floorZ: number,
  obj: Assembly["object"],
  extra: Readout[],
): Assembly {
  const parts = [palm, ...soft.parts, ...hard.parts];
  const lines = [...soft.lines, ...hard.lines];
  if (design.oneString) {
    // 실 1개: soft whiffletree 중심과 hard whiffletree 중심을 하나의 상위 균형막대로 묶음
    const ws = whiffletree(soft.tops, Z_TOP + 55, "A", Z_TOP + 75);
    const wh = whiffletree(hard.tops, Z_TOP + 45, "B", Z_TOP + 75);
    const ma = ws.lines[0].pts[1];
    const mb = wh.lines[0].pts[1];
    const wt = whiffletree([ma, mb], Z_TOP + 75, "S", Z_TOP + 105);
    parts.push(...ws.parts, ...wh.parts, ...wt.parts);
    lines.push(...ws.lines, ...wh.lines, ...wt.lines);
    lines.push({ id: "seriesSpring.soft", kind: "rubber", pts: [ma.clone().setZ(Z_TOP + 62), ma.clone().setZ(Z_TOP + 72)], attached: ["whiffle.A", "whiffle.S"] });
    lines.push({ id: "preload.hard", kind: "rubber", pts: [mb.clone().setZ(Z_TOP + 50), mb.clone().setZ(Z_TOP + 72)], attached: ["whiffle.B", "whiffle.S"] });
  } else {
    const ws = whiffletree(soft.tops, Z_TOP + 55, "A", Z_TOP + 95);
    const wh = whiffletree(hard.tops, Z_TOP + 45, "B", Z_TOP + 95);
    parts.push(...ws.parts, ...wh.parts);
    lines.push(...ws.lines, ...wh.lines);
  }
  return { parts, lines, floorZ, object: obj, readouts: [...extra, ...soft.readouts, ...hard.readouts], finrayForces: [], metrics: { ...soft.metrics, ...hard.metrics } };
}

// ================================================================== B1

function hardPivot(p: typeof B1p, d: Derived, b: number, sdf: (v: Vector3) => number, floorZ: number): HardOut {
  const h = p.hard;
  const halfT = (h.plies * C.board_t) / 2;
  const yp = p.palm.sy / 2 + halfT;
  const psiOpen = h.psi_open_deg * DEG;
  const psiMin = (num(d, "hard_psi_min_deg") + 0.3) * DEG;
  const wedge = num(d, "hard_face_wedge_deg") * DEG;
  const Lbar = h.len - h.nail_len;
  const qmax = psiOpen - psiMin;
  const P = V(0, yp, Z_TOP);
  const at = (q: number) => {
    const psi = psiOpen - q;
    const A = V(0, Math.sin(psi), -Math.cos(psi));
    const N = V(0, Math.cos(psi), Math.sin(psi));
    return { psi, A, N, end: P.clone().addScaledVector(A, Lbar) };
  };
  // 관통 판정: 패드 면 + 막대 안쪽 면 (물체만, 바닥은 손톱이 처리)
  const pen = (q: number) => {
    const { A, N, end } = at(q);
    const pad = wedgePad("x", "x", end, A, N, wedge, halfT, 25, h.width - 4);
    for (const x of across(h.width)) {
      for (let k = 0; k <= 5; k++) {
        const s = pad.c.clone().addScaledVector(pad.ap, -12.5 + 5 * k).addScaledVector(pad.np, -C.pad_t / 2).setX(x);
        if (sdf(s) < 0.2) return true;
      }
      for (let k = 0; k <= 6; k++) {
        const s = P.clone().addScaledVector(A, Lbar - 30 - 8 * k).addScaledVector(N, -halfT).setX(x);
        if (sdf(s) < 0.2) return true;
      }
      // 손톱 안쪽 면 (스토퍼로 안쪽 강성 → 쥐는 면의 일부)
      for (let k = 0; k <= 3; k++) {
        const s = end.clone().addScaledVector(A, (h.nail_len * k) / 3).addScaledVector(N, -halfT).setX(x);
        if (sdf(s) < 0.2) return true;
      }
    }
    return false;
  };
  const objOnly = (v: Vector3) => sdf(v);
  const qcmd = clamp(b, 0, 1) * qmax;
  const q = firstContact(qcmd, pen);
  const { psi, A, N, end } = at(q);
  const R: Part[] = [];
  R.push(segPart("bar", "hard", "board", P, end, h.width, 2 * halfT, X));
  R.push(cylPart("drum", "hard", "disk", P.clone(), X, 9, h.drum_r * 2));
  R.push(cylPart("axle", "hard", "straw", P.clone(), X, h.width + 14, C.straw_d));
  R.push(wedgePad("pad", "hard", end, A, N, wedge, halfT, 25, h.width - 4).part);
  // V홈 표시 (패드 중앙의 노치) — 렌더용 고스트
  const nail = nailFold(end.clone().addScaledVector(N, -halfT + 1), A, N, h.nail_len, floorZ);
  const nailPart = segPart("nail", "hard", "nail", end.clone().addScaledVector(N, -halfT + 1), nail.tip, h.width - 2, 2, X);
  R.push(nailPart);
  const RL: Line[] = [];
  const tanY = yp - h.drum_r;
  RL.push({ id: "stringB", kind: "string", pts: [V(0, tanY, Z_TOP - 2), V(0, tanY, Z_TOP + 45)], attached: ["hard", "palm"] });
  RL.push({
    id: "returnB",
    kind: "rubber",
    pts: [P.clone().addScaledVector(A, 30).addScaledVector(N, halfT + 0.5).setX(h.width / 2 - 3), V(h.width / 2 - 3, yp + halfT + 8, Z_TOP + 6)],
    attached: ["hard", "palm"],
  });
  const parts: Part[] = [];
  const lines: Line[] = [];
  for (const pp of R) {
    parts.push({ ...pp, id: pp.id + ".F", body: "hardF" });
    parts.push(mirrorPart(pp, 1, -1, ".B", "hardB"));
  }
  // 손바닥 쪽 부싱 (굵은 빨대 2개, 손가락 양옆)
  for (const t of [1, -1]) for (const sx of [1, -1])
    parts.push(cylPart(`bushH.${t}${sx}`, "palm", "bubble", V(sx * (h.width / 2 + 4), t * yp, Z_TOP), X, 7, C.bubble_d));
  for (const l of RL) {
    lines.push({ ...l, id: l.id + ".F", attached: ["hardF", "palm"] });
    lines.push(mirrorLine(l, 1, -1, ".B", ["hardB", "palm"]));
  }
  void objOnly;
  const faceY = end.clone().addScaledVector(N, -halfT - C.pad_t).y;
  return {
    parts,
    lines,
    tops: [V(0, tanY, Z_TOP + 45), V(0, -tanY, Z_TOP + 45)],
    metrics: { gap: 2 * faceY, tipZ: nail.tip.z - floorZ, hardTravel: q / qmax },
    readouts: [
      { label: "Hard 각 ψ", value: `${(psi / DEG).toFixed(1)}° (지령 ${((psiOpen - qcmd) / DEG).toFixed(1)}°)` },
      { label: "Hard 손끝 간격 (패드면)", value: `${(2 * faceY).toFixed(1)} mm` },
      { label: "손톱 플랩 꺾임", value: `${(nail.al / DEG).toFixed(0)}°`, warn: nail.al > 60 * DEG },
      { label: "Hard 손톱 끝 높이 (바닥 위)", value: `${(nail.tip.z - floorZ).toFixed(1)} mm` },
    ],
  };
}

function presetFlap(d: Derived, cDer: Derived, mode: ModeName, obj: ObjName | null, oneString: boolean, phiOpenDeg: number): Controls {
  const Rs = num(d, "soft_reach");
  const xh = num(d, "soft_hinge_x");
  const phiC = num(d, "soft_phi_chip_deg") * DEG;
  const softH = Rs * Math.cos(phiC) - Z_TOP + 2;
  const rigidH = num(cDer, "rigid_palm_height");
  const phiMin = num(d, "soft_phi_min_deg");
  // Fin Ray 끝(contact flank)이 x 에 오도록 하는 실 A 당김
  const aFor = (x: number) => clamp((phiOpenDeg - Math.asin((x - xh) / Rs) / DEG) / (phiOpenDeg - phiMin), 0, 1);
  return presetCommon(mode, obj, softH, rigidH, oneString, aFor);
}

/** aFor(x): soft 손가락 끝을 x 위치에 두는 실 A 당김 (Rigid 에서 건전지 끝에 '가볍게' 대기 위함) */
function presetCommon(mode: ModeName, obj: ObjName | null, softH: number, rigidH: number, oneString: boolean, aFor: (x: number) => number): Controls {
  const o = obj ?? ({ open: null, soft: "chip", rigid: "battery", hybrid: "cable" } as const)[mode];
  switch (mode) {
    case "open":
      return { a: 0, b: 0, s: 0, palmH: rigidH + 10, obj: o };
    case "soft":
      return { a: 1, b: 0, s: ONE_STRING.hardStart, palmH: o === "sponge" ? softH + 3 : softH, obj: o };
    case "rigid": {
      const xEnd = o === "battery" ? C.objects.battery.len / 2 + 0.5 : o === "cap" ? C.objects.cap.d / 2 + 0.5 : 26;
      return { a: aFor(xEnd), b: 1, s: 1, palmH: rigidH, obj: o };
    }
    case "hybrid":
      return { a: aFor(22), b: 1, s: 1, palmH: rigidH, obj: o };
  }
  void oneString;
}

export function makeB1(oneString = false): Design {
  const p = B1p;
  const d = B1c.derived as Derived;
  const id = oneString ? "V5" : "B1";
  return {
    id,
    name: oneString ? "V5 = B1 + 1-string 순차 (액추에이터 1개 대비)" : p.name,
    summary: oneString
      ? "B1 기구 그대로, 실 1가닥. 상위 균형막대에서 soft 쪽은 직렬 고무줄(약), hard 쪽은 프리로드 고무줄(강) → 당기면 Fin Ray 가 먼저 닫히고, 장력이 프리로드를 넘으면 hard 가 닫힌다."
      : "손바닥 윗면을 접어 내린 플랩(score 힌지)에 Fin Ray 2개씩. 앞·뒤 hard 는 빨대 축 단일 피벗 + 쐐기 패드 + 손톱 플랩. 플랩·피벗 모두 드럼(풀리)으로 구동 → 각도 무관 모멘트 팔 일정.",
    oneString,
    adjacent: [
      ["palm", "flapR"],
      ["palm", "flapL"],
      ["palm", "hardF"],
      ["palm", "hardB"],
    ],
    preset: (mode, obj) => presetFlap(d, d, mode, obj, oneString, p.soft.phi_open_deg),
    build(ctrl) {
      const floorZ = -ctrl.palmH;
      const obj = ctrl.obj ? makeObject(ctrl.obj, floorZ) : null;
      const sdf = sceneSdf(obj, floorZ);
      const objSdf = obj ? obj.sdf : () => 1e9;
      const { a, b } = effAB(ctrl, oneString);
      const soft = softFlap(
        {
          xh: num(d, "soft_hinge_x"),
          rootLen: p.soft.root_len,
          phiOpen: p.soft.phi_open_deg * DEG,
          phiMin: num(d, "soft_phi_min_deg") * DEG,
          drumR: p.soft.drum_r,
          drumY: p.soft.drum_y,
          joint: "score",
          Flim: C.force.chip_limit_N / 2, // 한쪽 = Fin Ray 2개 → 손가락당 절반
        },
        a,
        sdf,
      );
      const hard = hardPivot(p, d, b, objSdf, floorZ);
      return assemble({ id, oneString }, palmPart(p.palm.sx, p.palm.sy), soft, hard, floorZ, obj, oneStringReadout(ctrl, oneString));
    },
  };
}

function oneStringReadout(ctrl: Controls, one: boolean): Readout[] {
  if (!one) return [];
  const zone = ctrl.s <= ONE_STRING.hardStart ? "soft 전용 구간 (칩 안전)" : "hard 진입 — 취성물이면 여기서 멈출 것";
  return [{ label: "단일 실 당김 s", value: `${(ctrl.s * 100).toFixed(0)}% · ${zone}`, warn: ctrl.s > ONE_STRING.hardStart && ctrl.obj === "chip" }];
}

// ================================================================== B2

function hardSlot(p: typeof B2p, b: number, sdf: (v: Vector3) => number, floorZ: number): HardOut {
  const h = p.hard;
  const halfT = (h.plies * C.board_t) / 2;
  const face = halfT + C.pad_t;
  const al = h.slope_deg * DEG;
  const yMin = face + 0.3;
  const yOpen = h.y_open;
  const ycAt = (q: number) => yOpen - q;
  const qmax = yOpen - yMin;
  const tipZ = (yc: number) => -h.reach_open - (yOpen - yc) * Math.tan(al);
  const carZ = (yc: number) => -12 - (yOpen - yc) * Math.tan(al);
  const prongX = [h.width / 4 + 1, -(h.width / 4 + 1)];
  const prongW = h.width / 2 - 2;
  const pen = (q: number) => {
    const yc = ycAt(q);
    const tz = tipZ(yc);
    for (const x of across(h.width)) {
      for (let k = 0; k <= 8; k++) {
        const s = V(x, yc - face, tz + h.nail_len + 4 * k);
        if (sdf(s) < 0.2) return true;
      }
    }
    return false;
  };
  const qcmd = clamp(b, 0, 1) * qmax;
  const q = firstContact(qcmd, pen, 0.3);
  const yc = ycAt(q);
  const tz = tipZ(yc);
  const cz = carZ(yc);
  const barTop = cz - 8;
  const barBot = tz + h.nail_len;
  const R: Part[] = [];
  // 캐리지: 가운데 벽을 사이에 두고 양쪽 판 2장 + 핀 2개
  for (const x of prongX) {
    R.push(boxPart(`car${x > 0 ? "+" : "-"}`, "hard", "board", [prongW, 16, 16], V(x, yc, cz)));
    R.push(boxPart(`prong${x > 0 ? "+" : "-"}`, "hard", "board", [prongW, 2 * halfT, barTop - barBot], V(x, yc, (barTop + barBot) / 2)));
  }
  // 아래쪽 연결판 (벽 아래, 두 prong 을 잇는 브리지 — 벽 바닥보다 항상 낮음)
  R.push(boxPart("bridge", "hard", "board", [h.width, 2 * halfT, 18], V(0, yc, barBot + 9)));
  const sd = V(0, -Math.cos(al), -Math.sin(al));
  for (const k of [-7, 7]) R.push(cylPart(`pin${k}`, "hard", "straw", V(0, yc, cz).addScaledVector(sd, k), X, h.width + 4, C.straw_d));
  R.push(boxPart("pad", "hard", "pad", [h.width - 4, C.pad_t, 24], V(0, yc - halfT - C.pad_t / 2, barBot + 12)));
  const hinge = V(0, yc - halfT + 1, barBot);
  const nail = nailFold(hinge, V(0, 0, -1), V(0, 1, 0), h.nail_len, floorZ);
  R.push(segPart("nail", "hard", "nail", hinge, nail.tip, h.width - 2, 2, X));
  const RL: Line[] = [];
  // 실 B: 캐리지 → 슬롯 방향 아래 안쪽 끝 고리 → 벽 면을 따라 위로
  const eye = V(1.8, yMin - 2, carZ(yMin) - 4);
  RL.push({ id: "stringB", kind: "string", pts: [V(1.8, yc, cz), eye, V(1.8, 2, Z_TOP + 45)], attached: ["hard", "palm"] });
  RL.push({ id: "returnB", kind: "rubber", pts: [V(-1.8, yc + 8, cz + 4), V(-1.8, yOpen + 8, -6)], attached: ["hard", "palm"] });
  const parts: Part[] = [];
  const lines: Line[] = [];
  for (const pp of R) {
    parts.push({ ...pp, id: pp.id + ".F", body: "hardF" });
    parts.push(mirrorPart(pp, 1, -1, ".B", "hardB"));
  }
  for (const l of RL) {
    lines.push({ ...l, id: l.id + ".F", attached: ["hardF", "palm"] });
    lines.push(mirrorLine(l, 1, -1, ".B", ["hardB", "palm"]));
  }
  // 가운데 가이드 벽 (x=0, y-z 평면) + 경사 슬롯 표시
  const wallBot = carZ(yMin) - 12;
  parts.push(boxPart("wallH", "palm", "wall", [3, 2 * (yOpen + 12), -wallBot], V(0, 0, wallBot / 2)));
  for (const t of [1, -1]) {
    const a0 = V(0, t * yOpen, carZ(yOpen));
    const a1 = V(0, t * yMin, carZ(yMin));
    const sp = segPart(`slotH.${t}`, "palm", "slot", a0.clone().addScaledVector(a1.clone().sub(a0).normalize(), -9), a1.clone().addScaledVector(a1.clone().sub(a0).normalize(), 9), 3.4, C.straw_d + 0.6, X);
    sp.ghost = true;
    parts.push(sp);
  }
  return {
    parts,
    lines,
    tops: [V(1.8, 2, Z_TOP + 45), V(1.8, -2, Z_TOP + 45)],
    metrics: { gap: 2 * (yc - face), tipZ: nail.tip.z - floorZ, hardTravel: q / qmax },
    readouts: [
      { label: "Hard 캐리지 y", value: `${yc.toFixed(1)} mm (지령 ${(yOpen - qcmd).toFixed(1)})` },
      { label: "Hard 손끝 간격 (패드면)", value: `${(2 * (yc - face)).toFixed(1)} mm` },
      { label: "손톱 플랩 꺾임", value: `${(nail.al / DEG).toFixed(0)}°`, warn: nail.al > 60 * DEG },
      { label: "Hard 손톱 끝 높이 (바닥 위)", value: `${(nail.tip.z - floorZ).toFixed(1)} mm` },
    ],
  };
}

export function makeB2(): Design {
  const p = B2p;
  const d = B2c.derived as Derived;
  return {
    id: "B2",
    name: p.name,
    summary:
      "Fin Ray 2개를 단 캐리지가 손바닥 아래 가이드 벽의 수평 슬롯을 빨대 핀 2개로 따라 x 평행이동. hard 는 가운데 벽의 30° 경사 슬롯을 따라 안쪽·아래로 이동 → 닫히면서 손끝이 내려가 Soft/Rigid 높이 순서가 자동으로 맞는다. 진짜 평행 pinch.",
    oneString: false,
    adjacent: [
      ["palm", "carR"],
      ["palm", "carL"],
      ["palm", "hardF"],
      ["palm", "hardB"],
    ],
    preset(mode, obj) {
      const Rs = num(d, "soft_reach");
      const xMin = num(d, "soft_x_min");
      const aFor = (x: number) => clamp((p.soft.x_open - x) / (p.soft.x_open - xMin), 0, 1);
      return presetCommon(mode, obj, Rs - 2, num(d, "rigid_palm_height"), false, aFor);
    },
    build(ctrl) {
      const floorZ = -ctrl.palmH;
      const obj = ctrl.obj ? makeObject(ctrl.obj, floorZ) : null;
      const sdf = sceneSdf(obj, floorZ);
      const soft = softSlot(
        { xMin: num(d, "soft_x_min"), xOpen: p.soft.x_open, wallY: p.soft.wall_y, slotZ: p.soft.slot_z, rootLen: p.soft.root_len, Flim: C.force.chip_limit_N / 2 },
        ctrl.a,
        sdf,
      );
      const hard = hardSlot(p, ctrl.b, obj ? obj.sdf : () => 1e9, floorZ);
      return assemble({ id: "B2", oneString: false }, palmPart(p.palm.sx, p.palm.sy), soft, hard, floorZ, obj, []);
    },
  };
}

// ================================================================== B3

export const TENDON_PRE = 0.6;
export const TENDON_LIFT = 30;

function hardTendon(p: typeof B3p, d: Derived, b: number, sdfScene: (v: Vector3) => number): HardOut {
  // 손바닥을 lift 만큼 올린 상황 = 장면을 lift 만큼 내린 것
  let lift = 0;
  const sdf = (v: Vector3) => sdfScene(V(v.x, v.y, v.z + lift));
  const h = p.hard;
  const halfT = (h.plies * C.board_t) / 2;
  const yp = p.palm.sy / 2 + halfT;
  const t10 = h.theta1_rest_deg * DEG;
  const t20 = h.theta2_rest_deg * DEG;
  const t1p = num(d, "hard_theta1_pinch_deg") * DEG;
  const k2k1 = num(d, "tendon_k2_over_k1");
  // T 정규화: b=1 일 때 자유 닫힘이 pinch 자세를 12° 넘도록 (물체를 누를 여유)
  const k1 = h.r1 / (t10 - t1p + 12 * DEG);
  const k2 = k1 * k2k1;
  const wedge = -h.target_distal_deg * DEG;
  const P = V(0, yp, Z_TOP);
  const dirAt = (th: number) => V(0, Math.sin(th), -Math.cos(th));
  const nrmAt = (th: number) => V(0, Math.cos(th), Math.sin(th));
  const kin = (t1: number, t2: number) => {
    const A1 = dirAt(t1);
    const J2 = P.clone().addScaledVector(A1, h.l1);
    const A2 = dirAt(t1 + t2);
    const tip = J2.clone().addScaledVector(A2, h.l2);
    return { A1, J2, A2, tip, N1: nrmAt(t1), N2: nrmAt(t1 + t2) };
  };
  const samples = (t1: number, t2: number) => {
    const k = kin(t1, t2);
    const pts: Vector3[] = [];
    for (let i = 2; i <= 6; i++) pts.push(P.clone().addScaledVector(k.A1, (h.l1 * i) / 6).addScaledVector(k.N1, -halfT));
    // 패드는 손톱 시작점까지만, 그 아래는 얇은 손톱(안쪽 면 = 축에서 -halfT+1)
    for (let i = 0; i <= 6; i++) pts.push(k.J2.clone().addScaledVector(k.A2, ((h.l2 - h.nail_len) * i) / 6).addScaledVector(k.N2, -halfT - C.pad_t));
    pts.push(k.tip.clone());
    for (const sg of [1, -1]) pts.push(k.tip.clone().addScaledVector(k.A2, -h.nail_len).addScaledVector(k.N2, sg * halfT));
    return pts;
  };
  const E = (t1: number, t2: number, T: number) => {
    let e = 0.5 * k1 * (t1 - t10) ** 2 + 0.5 * k2 * (t2 - t20) ** 2 + T * (h.r1 * t1 + h.r2 * t2);
    for (const s of samples(t1, t2)) {
      for (const x of across(h.width)) {
        const pen = 0.3 - sdf(s.clone().setX(x));
        if (pen > 0) e += 40 * pen * pen;
      }
      // 대칭면 y=0: 앞·뒤 손가락이 서로 맞닿음 (거울상이므로 y < 0.5 면 상대 손가락 관통)
      const py = 0.5 - s.y;
      if (py > 0) e += 40 * py * py;
    }
    return e;
  };
  let t1 = t10;
  let t2 = t20;
  const Tc = clamp(b, 0, 1);
  const lim1: [number, number] = [-50 * DEG, t10];
  const lim2: [number, number] = [-100 * DEG, t20];
  // 조작 순서 (시뮬에서 발견한 jam 회피): ① 공중(lift 30 mm)에서 실 B 를 T_pre 까지 당겨 원위지골을 수직 너머로 말고
  //  ② 그 장력을 유지한 채 손바닥을 내린 뒤 ③ 끝까지 당긴다. 바닥에 손톱이 먼저 닿은 채 말면 원위지골이 수직을
  //  넘지 못해 걸린다 (마찰 없는 바닥에서도).
  const relax = (T: number) => {
    let step = 2 * DEG;
    for (let it = 0; it < 500 && step > 0.005 * DEG; it++) {
      const e = 1e-5;
      const e0 = E(t1, t2, T);
      const g1 = (E(t1 + e, t2, T) - e0) / e;
      const g2 = (E(t1, t2 + e, T) - e0) / e;
      const gn = Math.hypot(g1, g2) || 1;
      const n1 = clamp(t1 - (step * g1) / gn, ...lim1);
      const n2 = clamp(t2 - (step * g2) / gn, ...lim2);
      if (E(n1, n2, T) < e0) {
        t1 = n1;
        t2 = n2;
        step = Math.min(step * 1.3, 3 * DEG);
      } else step *= 0.5;
    }
  };
  const Tpre = Math.min(Tc, TENDON_PRE);
  lift = TENDON_LIFT;
  for (let st = 1; st <= 8; st++) relax((Tpre * st) / 8);
  for (let st = 1; st <= 10; st++) {
    lift = TENDON_LIFT * (1 - st / 10);
    relax(Tpre);
  }
  lift = 0;
  for (let st = 1; st <= 8; st++) relax(Tpre + ((Tc - Tpre) * st) / 8);
  const k = kin(t1, t2);
  const R: Part[] = [];
  R.push(segPart("phal1", "hard", "board", P, k.J2, h.width, 2 * halfT, X));
  const nailStart = k.tip.clone().addScaledVector(k.A2, -h.nail_len);
  R.push(segPart("phal2", "hard2", "board", k.J2, nailStart, h.width, 2 * halfT, X));
  R.push(cylPart("axle", "hard", "straw", P.clone(), X, h.width + 14, C.straw_d));
  R.push(wedgePad("pad", "hard2", k.tip.clone().addScaledVector(k.A2, -h.nail_len), k.A2, k.N2, wedge, halfT, 22, h.width - 4).part);
  // 손톱: 원위지골 끝 고정 (얇은 골판지 3겹 + 테이프)
  R.push(segPart("nail", "hard2", "nail", nailStart.clone().addScaledVector(k.A2, -3), k.tip.clone(), h.width - 2, 2, X));
  // 텐던 경로: 손바닥 구멍 → 근위 고리 2개(오프셋 r1) → 원위 고리 → 고정점
  const RL: Line[] = [];
  const in1 = (s: number) => P.clone().addScaledVector(k.A1, s).addScaledVector(k.N1, -halfT - (h.r1 - halfT));
  const in2 = (s: number) => k.J2.clone().addScaledVector(k.A2, s).addScaledVector(k.N2, -halfT - (h.r2 - halfT) - 1);
  RL.push({
    id: "tendon",
    kind: "tendon",
    pts: [V(0, yp - h.r1, Z_TOP + 45), V(0, yp - h.r1, Z_TOP - 1), in1(12), in1(h.l1 - 8), in2(8), in2(h.l2 - h.nail_len - 12)],
    attached: ["hard", "hard2", "palm"],
  });
  const out1 = (s: number) => P.clone().addScaledVector(k.A1, s).addScaledVector(k.N1, halfT + 0.5);
  const out2 = (s: number) => k.J2.clone().addScaledVector(k.A2, s).addScaledVector(k.N2, halfT + 0.5);
  RL.push({ id: "rubberJ2", kind: "rubber", pts: [out1(h.l1 - 18), out2(16)], attached: ["hard", "hard2"] });
  RL.push({ id: "rubberJ1", kind: "rubber", pts: [V(0, yp + halfT + 6, Z_TOP + 4), out1(20)], attached: ["hard", "palm"] });
  const parts: Part[] = [];
  const lines: Line[] = [];
  for (const pp of R) {
    const body = pp.body === "hard" ? "hardF" : "hard2F";
    parts.push({ ...pp, id: pp.id + ".F", body });
    parts.push(mirrorPart(pp, 1, -1, ".B", body.replace("F", "B")));
  }
  for (const t of [1, -1]) for (const sx of [1, -1])
    parts.push(cylPart(`bushH.${t}${sx}`, "palm", "bubble", V(sx * (h.width / 2 + 4), t * yp, Z_TOP), X, 7, C.bubble_d));
  for (const l of RL) {
    lines.push({ ...l, id: l.id + ".F", attached: ["hardF", "hard2F", "palm"] });
    lines.push(mirrorLine(l, 1, -1, ".B", ["hardB", "hard2B", "palm"]));
  }
  const faceY = samples(t1, t2)[8].y;
  // 쥐는 면 최소 y (원위 패드 + 손톱 끝)
  function minInnerY(a: number, b2: number) {
    const ss = samples(a, b2).slice(5);
    return Math.min(...ss.map((v) => v.y));
  }
  return {
    parts,
    lines,
    tops: [V(0, yp - h.r1, Z_TOP + 45), V(0, -(yp - h.r1), Z_TOP + 45)],
    metrics: { gap: 2 * minInnerY(t1, t2), tipZ: k.tip.z, hardTravel: Tc },
    readouts: [
      { label: "Tendon θ1 / θ2", value: `${(t1 / DEG).toFixed(1)}° / ${(t2 / DEG).toFixed(1)}° (원위 절대각 ${((t1 + t2) / DEG).toFixed(1)}°)` },
      { label: "텐던 장력 (정규화)", value: `${(Tc * 100).toFixed(0)}%` },
      { label: "원위 패드 y (중앙)", value: `${faceY.toFixed(1)} mm` },
      { label: "손톱 끝 높이", value: `${(k.tip.z).toFixed(1)} mm (손바닥 기준)` },
    ],
  };
}

export function makeB3(oneString = false): Design {
  const p = B3p;
  const d = B3c.derived as Derived;
  const id = oneString ? "V5b" : "B3";
  return {
    id,
    name: oneString ? "V5b = B3 + 1-string 순차" : p.name,
    summary: oneString
      ? "B3 기구 그대로, 실 1가닥 순차 구동."
      : "soft 는 B1 과 같지만 플랩을 굵은 빨대 부싱 + 빨대 축으로 단다(score 접힘 대신). hard 는 2마디 텐던 손가락: 안쪽 빨대 고리로 텐던, 바깥 고무줄로 복원. 원위 관절이 늦게 굽도록 스프링비 k2/k1 을 SymPy 로 결정 → 손끝이 바닥을 긁으며 말려 들어간다.",
    oneString,
    adjacent: [
      ["palm", "flapR"],
      ["palm", "flapL"],
      ["palm", "hardF"],
      ["palm", "hardB"],
      ["hardF", "hard2F"],
      ["hardB", "hard2B"],
    ],
    preset: (mode, obj) => presetFlap(d, d, mode, obj, oneString, p.soft.phi_open_deg),
    build(ctrl) {
      const floorZ = -ctrl.palmH;
      const obj = ctrl.obj ? makeObject(ctrl.obj, floorZ) : null;
      const sdf = sceneSdf(obj, floorZ);
      const { a, b } = effAB(ctrl, oneString);
      const soft = softFlap(
        {
          xh: num(d, "soft_hinge_x"),
          rootLen: p.soft.root_len,
          phiOpen: p.soft.phi_open_deg * DEG,
          phiMin: num(d, "soft_phi_min_deg") * DEG,
          drumR: p.soft.drum_r,
          drumY: p.soft.drum_y,
          joint: "axle",
          Flim: C.force.chip_limit_N / 2, // 한쪽 = Fin Ray 2개 → 손가락당 절반
        },
        a,
        sdf,
      );
      const hard = hardTendon(p, d, b, sdf);
      hard.metrics.tipZ -= floorZ;
      return assemble({ id, oneString }, palmPart(p.palm.sx, p.palm.sy), soft, hard, floorZ, obj, oneStringReadout(ctrl, oneString));
    },
  };
}

export const DESIGNS: Design[] = [makeB1(), makeB2(), makeB3()];
export const VARIANTS: Design[] = [makeB1(true), makeB3(true)];
export const ALL: Design[] = [...DESIGNS, ...VARIANTS];
void lerp;
