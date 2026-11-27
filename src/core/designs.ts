import { Vector3 } from "three";
import B1p from "../../params/B1.json";
import B2p from "../../params/B2.json";
import B3p from "../../params/B3.json";
import B3op from "../../params/B3o.json";
import B4p from "../../params/B4.json";
import B5p from "../../params/B5.json";
import B5Tp from "../../params/B5T.json";
import B5Fp from "../../params/B5F.json";
import B5Np from "../../params/B5N.json";
import B5Ep from "../../params/B5E.json";
import B6Pp from "../../params/B6P.json";
import B6Fp from "../../params/B6F.json";
import B1c from "../../calc/out/B1.json";
import B2c from "../../calc/out/B2.json";
import B3c from "../../calc/out/B3.json";
import B3oc from "../../calc/out/B3o.json";
import B4c from "../../calc/out/B4.json";
import B5c from "../../calc/out/B5.json";
import B5Tc from "../../calc/out/B5T.json";
import B5Fc from "../../calc/out/B5F.json";
import B5Nc from "../../calc/out/B5N.json";
import B5Ec from "../../calc/out/B5E.json";
import B6Pc from "../../calc/out/B6P.json";
import B6Fc from "../../calc/out/B6F.json";
import { DEG, V, boxPart, clamp, cylPart, lerp, segPart } from "./build";
import { makeObject, sceneSdf } from "./objects";
import {
  C,
  X,
  Y,
  Z,
  Z_TOP,
  across,
  firstContact,
  leverArm,
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
    if (soft.tops.length === 2) {
      const ws = whiffletree(soft.tops, Z_TOP + 55, "A", Z_TOP + 95);
      parts.push(...ws.parts);
      lines.push(...ws.lines);
    }
    if (hard.tops.length === 2) {
      const wh = whiffletree(hard.tops, Z_TOP + 45, "B", Z_TOP + 95);
      parts.push(...wh.parts);
      lines.push(...wh.lines);
    }
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
  const tape = (h as { tape_hinge?: boolean }).tape_hinge === true;
  if (!tape) R.push(cylPart("axle", "hard", "straw", P.clone(), X, h.width + 14, C.straw_d));
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
  if (!tape)
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

function hardTendon(p: { palm: { sy: number }; hard: typeof B3p.hard & { precurl?: boolean } }, d: Derived, b: number, sdfScene: (v: Vector3) => number): HardOut {
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
  // 물리 단위 모드(B3o): calc 가 준 복원 고무줄 강성 상한의 70% 를 쓰고 T 는 N (b=1 → pinch 8 N 장력).
  // 정규화 모드(B3): b=1 의 자유 닫힘이 pinch 자세를 12° 넘도록 k1 을 맞춘 무차원 값.
  const phys = d["tendon_k1_max_Nmm_per_rad"] !== undefined;
  const k1 = phys ? ((h as { k1_spec_Nmm_per_rad?: number }).k1_spec_Nmm_per_rad ?? 0.7 * num(d, "tendon_k1_max_Nmm_per_rad")) : h.r1 / (t10 - t1p + 12 * DEG);
  const k2 = k1 * k2k1;
  const Tscale = phys ? num(d, "hard_string_T_N") : 1;
  const penK = phys ? 1500 : 40;
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
    let e = 0.5 * k1 * (t1 - t10) ** 2 + 0.5 * k2 * (t2 - t20) ** 2 + Tscale * T * (h.r1 * t1 + h.r2 * t2);
    for (const s of samples(t1, t2)) {
      for (const x of across(h.width)) {
        const pen = 0.3 - sdf(s.clone().setX(x));
        if (pen > 0) e += penK * pen * pen;
      }
      // 대칭면 y=0: 앞·뒤 손가락이 서로 맞닿음 (거울상이므로 y < 0.5 면 상대 손가락 관통)
      const py = 0.5 - s.y;
      if (py > 0) e += penK * py * py;
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
  // 패턴 탐색(16 방향): 바닥 접촉 시 에너지 골짜기가 좁고 휘어 있어, 경사 하강은 법선 방향만 보고 멈춘다
  // (B3o 에서 SymPy 는 미끄럼 구동력 1.9 N 인데 시뮬이 접촉점에서 멈춘 원인). 방향을 넓게 시도해 골짜기를 따라감.
  const DIRS = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);
  const relax = (T: number) => {
    let step = 2 * DEG;
    let e0 = E(t1, t2, T);
    for (let it = 0; it < 900 && step > 0.004 * DEG; it++) {
      let best = e0;
      let bi = -1;
      for (let i = 0; i < DIRS.length; i++) {
        const n1 = clamp(t1 + step * DIRS[i][0], ...lim1);
        const n2 = clamp(t2 + step * DIRS[i][1], ...lim2);
        const en = E(n1, n2, T);
        if (en < best - 1e-9) {
          best = en;
          bi = i;
        }
      }
      if (bi >= 0) {
        t1 = clamp(t1 + step * DIRS[bi][0], ...lim1);
        t2 = clamp(t2 + step * DIRS[bi][1], ...lim2);
        e0 = best;
        step = Math.min(step * 1.25, 3 * DEG);
      } else step *= 0.5;
    }
  };

  // precurl=false (B3o): 예비 말기 없이 바로 당김 — 바닥 미끄럼으로 pinch 에 도달하도록 SymPy(J1, J2)로 설계됨
  const pre = h.precurl !== false;
  const Tpre = pre ? Math.min(Tc, TENDON_PRE) : 0;
  lift = pre ? TENDON_LIFT : 0;
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
  const tape = (h as { tape_hinge?: boolean }).tape_hinge === true;
  if (!tape) R.push(cylPart("axle", "hard", "straw", P.clone(), X, h.width + 14, C.straw_d));
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
  if (!tape)
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
      { label: phys ? "텐던 장력" : "텐던 장력 (정규화)", value: phys ? `${(Tc * Tscale).toFixed(1)} N (${(Tc * 100).toFixed(0)}%)` : `${(Tc * 100).toFixed(0)}%` },
      { label: "원위 패드 y (중앙)", value: `${faceY.toFixed(1)} mm` },
      { label: "손톱 끝 높이", value: `${(k.tip.z).toFixed(1)} mm (손바닥 기준)` },
    ],
  };
}

export function makeB3(oneString = false, opt = false): Design {
  const p = (opt ? B3op : B3p) as typeof B3p & { hard: { precurl?: boolean } };
  const d = (opt ? B3oc.derived : B3c.derived) as unknown as Derived;
  const id = oneString ? "V5b" : opt ? "B3o" : "B3";
  return {
    id,
    name: oneString ? "V5b = B3 + 1-string 순차" : p.name,
    summary: oneString
      ? "B3 기구 그대로, 실 1가닥 순차 구동."
      : opt
        ? `B3 치수 최적화. 원위지골을 스토퍼로 ${p.hard.theta2_rest_deg}° 바깥으로 젖혀 두고 근위 휴지 ${p.hard.theta1_rest_deg}°. 당기면 손톱이 바깥(y≈63)에서 바닥에 먼저 닿아 미끄러져 들어오고, 원위지골이 거의 수직(+${p.hard.target_distal_deg}°)인 자세로 건전지를 평행 pinch. 예비 말기 불필요(SymPy J1·J2·J5: 미끄럼 구동력 ≥ 1 N), 텐던 장력 50→28 N, 근위 복원 고무줄 k1=${(p.hard as { k1_spec_Nmm_per_rad?: number }).k1_spec_Nmm_per_rad} N·mm/rad.`
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

// ================================================================== B4 (하이브리드)

export function makeB4(): Design {
  const p = B4p;
  const d = B4c.derived as unknown as Derived;
  return {
    id: "B4",
    name: p.name,
    summary:
      "B2 의 soft(가이드 벽 슬롯 + 빨대 핀 캐리지, 레버 없는 직선 구동)와 B3 의 2마디 텐던 hard 를 결합. 가운데 경사 벽이 없어져 hard 경로가 비고, 손 모양(말리는 손가락)과 낮은 실 A 장력을 같이 노린 안. Fin Ray 를 3.6 mm 줄여(뿌리 2 mm) 텐던 손가락의 Rigid 높이에 맞춤.",
    oneString: false,
    adjacent: [
      ["palm", "carR"],
      ["palm", "carL"],
      ["palm", "hardF"],
      ["palm", "hardB"],
      ["hardF", "hard2F"],
      ["hardB", "hard2B"],
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
      const hard = hardTendon(p, d, ctrl.b, sdf);
      hard.metrics.tipZ -= floorZ;
      return assemble({ id: "B4", oneString: false }, palmPart(p.palm.sx, p.palm.sy), soft, hard, floorZ, obj, []);
    },
  };
}

// ================================================================== B5 계열 (평행사변형 링크 hard, 텐던 1가닥 루프) + 수직 순응 옵션

interface CompCfg {
  type: "tip" | "float" | "nail";
  theta_max_deg?: number;
  travel?: number;
  engage_N?: number;
  force_at_travel_N?: number;
  sleeve_len?: number;
}

function hardParallel(p: typeof B5p, d: Derived, b: number, objSdf: (v: Vector3) => number, floorZ: number): HardOut {
  const h = p.hard as typeof B5p.hard & { compliance?: CompCfg };
  const comp = h.compliance;
  const halfT = (h.plies * C.board_t) / 2;
  const linkT = h.link_plies * C.board_t;
  const yp = num(d, "hard_pivot_y");
  const Lc = num(d, "hard_coupler_below_E");
  const psiOpen = h.psi_open_deg * DEG;
  const psiMin = (num(d, "hard_psi_min_deg") + 0.3) * DEG;
  const qmax = psiOpen - psiMin;
  let lift = 0; // float: 브래킷 전체가 위로 밀려 올라간 양
  const at = (q: number) => {
    const zP = -h.bracket_drop + lift;
    const psi = psiOpen - q;
    const u = V(0, Math.sin(psi), -Math.cos(psi));
    const P1 = V(0, yp, zP); // 안쪽 피벗
    const P2 = V(0, yp + h.d, zP); // 바깥 피벗 (드럼)
    const E1 = P1.clone().addScaledVector(u, h.L);
    const E2 = P2.clone().addScaledVector(u, h.L);
    const tip = E1.clone().add(V(0, 0, -Lc));
    return { psi, zP, P1, P2, E1, E2, tip };
  };
  // 손끝판 패드면 + 손톱 안쪽 면이 물체에 닿는 첫 q (손톱은 안쪽 스토퍼로 쥐는 방향 강성 → 쥐는 면의 일부)
  const pen = (q: number) => {
    const g = at(q);
    for (const x of across(h.width)) {
      for (let k = 0; k <= 8; k++) {
        const s = V(x, g.tip.y - halfT - C.pad_t, g.tip.z + h.nail_len + ((g.E1.z - 3 - g.tip.z - h.nail_len) * k) / 8);
        if (objSdf(s) < 0.2) return true;
      }
      for (let k = 0; k <= 4; k++) if (objSdf(V(x, g.tip.y - halfT, g.tip.z + 0.5 + (h.nail_len * k) / 4)) < 0.2) return true;
    }
    return false;
  };
  const qcmd = clamp(b, 0, 1) * qmax;
  let q = firstContact(qcmd, pen);
  if (comp?.type === "float") {
    // 접근 중 손끝이 바닥을 누르면 브래킷이 텔레스코프 따라 올라감 (손톱 플랩은 그 위 잔여분만)
    lift = clamp(floorZ + 0.3 - at(q).tip.z, 0, comp.travel ?? 0);
    if (lift > 0) q = firstContact(qcmd, pen);
  }
  const g = at(q);
  const zP = g.zP;
  // 손끝판 관절 (tip): 피벗 Pv = E_in 아래 4.5. 바닥이 밀면 아래쪽 끝이 안쪽·위로 꺾임 (반대 방향은 스토퍼)
  const Pv = g.E1.clone().add(V(0, 0, -4.5));
  let theta = 0;
  const rotV = (v: Vector3) => V(v.x, v.y * Math.cos(theta) + v.z * Math.sin(theta), -v.y * Math.sin(theta) + v.z * Math.cos(theta));
  const rotP = (pt: Vector3) => Pv.clone().add(rotV(pt.clone().sub(Pv)));
  if (comp?.type === "tip") {
    const thMax = (comp.theta_max_deg ?? 50) * DEG;
    for (let k = 0; k <= 200; k++) {
      theta = (thMax * k) / 200;
      if (rotP(g.tip).z >= floorZ + 0.3) break;
    }
  }
  const plateAxis = rotV(V(0, 0, -1));
  const plateN = rotV(V(0, 1, 0)); // 바깥 법선 (앞 손가락)
  const tipR = rotP(g.tip);
  const R: Part[] = [];
  const W = h.width - 2;
  const plateBody = comp?.type === "tip" ? "hard_t" : "hard_c";
  const brBody = comp?.type === "float" ? "hard_br" : "palm";
  // 링크 막대 = y–z 평면 판 (x 두께 barT, 운동 평면 안 높이 barH). 앞·뒤(안쪽/바깥) 링크는 같은 x 평면(±7.5)을 쓰고
  // 수직 거리 d·cosψ ≥ barH+2 로 분리(SymPy H7). 드럼(±4.5)은 바깥 링크 막대 두 장 사이에 끼워 면 접착 → 빨대는 핀만.
  const barT = linkT;
  const barH = (h as { link_bar_h?: number }).link_bar_h ?? 12;
  const bxl = 4.5 + barT / 2;
  for (const sx of [1, -1]) {
    R.push(segPart(`linkIn${sx}`, "hard_l2", "board", g.P1.clone().setX(sx * bxl), g.E1.clone().setX(sx * bxl), barT, barH, X));
    R.push(segPart(`linkOut${sx}`, "hard", "board", g.P2.clone().setX(sx * bxl), g.E2.clone().setX(sx * bxl), barT, barH, X));
  }
  const lev = (h as { lever?: { r: number; w: number; gamma_open_deg: number; hole_y: number } }).lever;
  const levTip = (gg: typeof g) => {
    const ga = lev!.gamma_open_deg * DEG + (psiOpen - gg.psi);
    return { dir: V(0, -Math.cos(ga), Math.sin(ga)), tip: gg.P2.clone().addScaledVector(V(0, -Math.cos(ga), Math.sin(ga)), lev!.r) };
  };
  if (lev) {
    // B5E: 드럼 자리(바깥 링크 막대 2개 사이)에 레버 판 3겹 면 접착. 바깥 피벗 → 안쪽 피벗 쪽, 닫히면 위로 돎
    const { dir, tip } = levTip(g);
    R.push(segPart("lever", "hard", "board", g.P2.clone().addScaledVector(dir, -5), tip.clone().addScaledVector(dir, 4), 9, lev.w, X));
  } else R.push(cylPart("drum", "hard", "disk", g.P2.clone(), X, 9, h.drum_r * 2));
  R.push(segPart("couplerBar", "hard_c", "board", g.E1.clone().add(V(0, -halfT, 0)), g.E2.clone().add(V(0, 4, 0)), h.width, 2 * halfT, X));
  for (const [n, e] of [["pinIn", g.E1], ["pinOut", g.E2]] as const) R.push(cylPart(n, "hard_c", "straw", e.clone(), X, h.width + 6, C.straw_d));
  // 손끝판 + 패드 + 손톱 (tip 옵션이면 Pv 기준 회전)
  const plateTop = Pv.clone();
  const plateBot = rotP(g.tip.clone().add(V(0, 0, h.nail_len)));
  R.push(segPart("tipPlate", plateBody, "board", plateTop.clone().addScaledVector(plateAxis, comp?.type === "tip" ? 3.5 : 0), plateBot, h.width, 2 * halfT, X));
  const padLen = Math.min(22, Pv.z - 8 - (g.tip.z + h.nail_len));
  const padBotP = plateBot.clone().addScaledVector(plateN, -halfT - C.pad_t / 2);
  R.push(segPart("pad", plateBody, "pad", padBotP.clone().addScaledVector(plateAxis, -padLen), padBotP, h.width - 4, C.pad_t, X));
  const hinge = plateBot.clone().addScaledVector(plateN, -halfT + 1);
  const nail = nailFold(hinge, plateAxis, plateN, h.nail_len, floorZ);
  R.push(segPart("nail", plateBody, "nail", hinge, nail.tip, h.width - 2, 2, X));
  if (comp?.type === "tip") {
    R.push(cylPart("tipPin", plateBody, "straw", Pv.clone(), X, h.width + 6, C.straw_d));
    // 스토퍼 블록 (커플러 바 아래 바깥쪽): 손끝판이 pinch 반력으로 바깥으로 도는 것을 막음
    R.push(boxPart("tipStop", "hard_c", "board", [h.width - 6, 4, 6], g.E1.clone().add(V(0, halfT + 2.5, -7))));
  }
  // 브래킷 + 고정 축 2개 (float 면 브래킷도 함께 움직임)
  const bx = h.width / 2 + 2.5;
  const brH = h.bracket_drop + 7;
  for (const sx of [1, -1]) R.push(boxPart(`bracket${sx}`, brBody, "board", [3, h.d + 12, brH], V(sx * bx, yp + h.d / 2, -brH / 2 + lift)));
  R.push(cylPart("axleIn", brBody, "straw", g.P1.clone(), X, h.width + 8, C.straw_d));
  R.push(cylPart("axleOut", brBody, "straw", g.P2.clone(), X, h.width + 8, C.straw_d));
  // 열림 스토퍼 탭 (브래킷 안쪽 면 → 링크 막대 평면까지 돌출): ψ_open 에서 바깥 링크 윗면이 기댐 (SymPy H11 접촉점)
  const pso = h.psi_open_deg * DEG;
  const tabC = V(0, num(d, "hard_stop_tab_y") + 3.2 * Math.cos(pso), num(d, "hard_stop_tab_z") + lift + 3.2 * Math.sin(pso));
  const bIn = h.width / 2 + 1;
  for (const sx of [1, -1]) R.push(boxPart(`stopTab${sx}`, brBody, "board", [bIn - (bxl + barT / 2 - 1.5), 6, 6], tabC.clone().setX(sx * ((bIn + bxl + barT / 2 - 1.5) / 2))));
  // 브래킷 삼각 보강 (바깥 면, 안쪽 끝): 쥐는 힘 × 약 100 mm 레버가 브래킷 접착면에 거는 모멘트 대비
  if (comp?.type !== "float") for (const sx of [1, -1]) R.push(boxPart(`gusset${sx}`, brBody, "board", [3, 10, 10], V(sx * (bx + 3), yp - 1, -5)));
  if (comp?.type === "float") {
    // 텔레스코프 2쌍은 손바닥 '위'(y=yp+2): 굵은 빨대 슬리브(손바닥 윗면 고정) ↔ 일반 빨대(브래킷 위끝에서 손바닥 구멍 통과).
    // (손바닥 아래 브래킷 옆에 두었더니 Fin Ray 와 간섭 → 위로 옮김). 브래킷 윗부분은 손바닥 슬롯을 지나 함께 올라감.
    const sl = comp.sleeve_len ?? 30;
    const sy = yp + 2;
    for (const sx of [1, -1]) {
      R.push(cylPart(`sleeve${sx}`, "palm", "bubble", V(sx * bx, sy, Z_TOP + sl / 2), Z, sl, C.bubble_d));
      R.push(cylPart(`slider${sx}`, brBody, "straw", V(sx * bx, sy, Z_TOP + sl / 2 - 6 + lift), Z, sl + 12, C.straw_d));
    }
  }
  const RL: Line[] = [];
  RL.push({
    id: "returnB",
    kind: "rubber",
    pts: [V(h.width / 2 - 4, g.E2.y + 4, g.E2.z), V(h.width / 2 - 4, yp + h.d + 6, zP + 6)],
    attached: ["hard_c", "palm", "hard", "hard_br"],
  });
  if (comp?.type === "tip") {
    RL.push({ id: "tipRubber", kind: "rubber", pts: [g.E1.clone().add(V(h.width / 2 - 3, halfT + 4, -2)), rotP(g.E1.clone().add(V(h.width / 2 - 3, halfT + 1, -24)))], attached: ["hard_c", "hard_t"] });
  }
  if (comp?.type === "float") {
    // 프리로드 고무줄: 슬리브 위끝 ↔ 슬라이더 아래 (브래킷을 아래로 당김)
    const sl = comp.sleeve_len ?? 30;
    RL.push({ id: "floatRubber", kind: "rubber", pts: [V(bx + 7, yp + 2, Z_TOP + sl), V(bx + 7, yp + 2, Z_TOP + 2)], attached: ["palm", "hard_br"] });
  }
  const parts: Part[] = [];
  const lines: Line[] = [];
  const bodyF = (b0: string) => (b0 === "palm" ? "palm" : b0.replace("hard", "hardF"));
  const bodyB = (b0: string) => (b0 === "palm" ? "palm" : b0.replace("hard", "hardB"));
  for (const pp of R) {
    parts.push({ ...pp, id: pp.id + ".F", body: bodyF(pp.body) });
    parts.push(mirrorPart(pp, 1, -1, ".B", bodyB(pp.body)));
  }
  const attF = ["hardF_c", "hardF", "hardF_l2", "hardF_t", "hardF_br", "palm"];
  for (const l of RL) {
    lines.push({ ...l, id: l.id + ".F", attached: attF });
    lines.push(mirrorLine(l, 1, -1, ".B", attF.map((s) => s.replace("F", "B"))));
  }
  // 텐던 1가닥 연속 루프: 앞 드럼 안쪽 접선 → 위 → 모터 풀리 → 아래 → 뒤 드럼. 양쪽 장력이 같아 자동 균형.
  const ty = lev ? lev.hole_y : yp + h.d - h.drum_r;
  const zTopLoop = Z_TOP + 40;
  const lt = lev ? levTip(g).tip : null;
  let armNow = h.drum_r;
  if (lev && lt) armNow = leverArm([lt.y - g.P2.y, lt.z - g.P2.z], [ty - lt.y, 0 - lt.z]);
  lines.push({
    id: "tendonLoop",
    kind: "tendon",
    pts: lt
      ? [lt, V(0, ty, 0), V(0, ty, zTopLoop), V(0, 0, zTopLoop + 6), V(0, -ty, zTopLoop), V(0, -ty, 0), V(0, -lt.y, lt.z)]
      : [V(0, ty, zP), V(0, ty, zTopLoop), V(0, 0, zTopLoop + 6), V(0, -ty, zTopLoop), V(0, -ty, zP)],
    attached: ["hardF", "hardB", "hardF_br", "hardB_br", "palm", "motor"],
  });
  const motor = cylPart("motorPulley", "motor", "disk", V(0, 0, zTopLoop + 3), X, 6, 2 * ty + 6);
  motor.ghost = true;
  parts.push(motor);
  // 쥐는 면 간격: 패드면·손톱 안쪽 면 중 가장 안쪽
  const facePts = [padBotP.clone().addScaledVector(plateN, -C.pad_t / 2), padBotP.clone().addScaledVector(plateN, -C.pad_t / 2).addScaledVector(plateAxis, -padLen), nail.tip.clone().addScaledVector(plateN, -1)];
  const faceY = Math.min(...facePts.map((v) => v.y));
  let vdef = 0;
  let floorF = 0;
  const compRead: Readout[] = [];
  if (comp?.type === "tip") {
    vdef = rotP(g.tip).z - g.tip.z;
    floorF = theta > 0 ? (num(d, "tip_preload_Nmm") + num(d, "tip_rubber_k_Nmm_per_rad") * theta) / halfT : 0;
    compRead.push({ label: "손끝판 꺾임 (바닥 순응)", value: `${(theta / DEG).toFixed(1)}° → 손끝 ${vdef.toFixed(1)} mm 상승, 바닥 누름 ≈ ${floorF.toFixed(1)} N`, warn: theta >= ((comp.theta_max_deg ?? 50) - 0.5) * DEG });
  } else if (comp?.type === "float") {
    vdef = lift;
    floorF = lift > 0 ? (comp.engage_N ?? 0) + num(d, "float_k_N_per_mm") * lift : 0;
    compRead.push({ label: "브래킷 떠오름 (텔레스코프)", value: `${lift.toFixed(1)} / ${comp.travel} mm, 바닥 누름 ≈ ${floorF.toFixed(1)} N`, warn: lift >= (comp.travel ?? 0) - 0.1 });
  }
  const nailRise = h.nail_len * (1 - Math.cos(nail.al));
  compRead.push({ label: "손톱 플랩 접힘", value: `${(nail.al / DEG).toFixed(0)}° (${nailRise.toFixed(1)} mm)`, warn: nail.al > 79 * DEG });
  return {
    parts,
    lines,
    tops: [],
    metrics: { gap: 2 * faceY, tipZ: Math.min(nail.tip.z, tipR.z + 0) - floorZ, hardTravel: q / qmax, vdef: vdef + nailRise },
    readouts: [
      { label: "링크 각 ψ (0 = 수직)", value: `${(g.psi / DEG).toFixed(1)}° (지령 ${((psiOpen - qcmd) / DEG).toFixed(1)}°)` },
      { label: "손끝 간격 (쥐는 면)", value: `${(2 * faceY).toFixed(1)} mm` },
      { label: "손톱 끝 높이 (바닥 위)", value: `${(nail.tip.z - floorZ).toFixed(1)} mm` },
      ...compRead,
      lev
        ? { label: "hard 레버 모멘트 팔", value: `${armNow.toFixed(1)} mm (r ${lev.r}) · 루프 당김 ≈ ${(armNow * q).toFixed(1)} mm` }
        : { label: "텐던 루프 당김", value: `${(h.drum_r * q).toFixed(1)} mm (모터 풀리 기준, 손가락당)` },
    ],
  };
}

const B5_SUMMARY: Record<string, string> = {
  B5: "soft 는 B1(접는 플랩 + Fin Ray). hard 는 평행사변형 4절 링크: 손바닥 아래 브래킷의 안쪽·바깥 피벗(간격 24) → 같은 길이 링크 2개 → 수평 커플러 + 항상 수직인 손끝판. 피벗을 안쪽(y=±13.5)에 둬 건전지 pinch 때 링크가 수직 = 손끝 궤적 최저점. 텐던 1가닥 연속 루프(모터 풀리 1개). 수직 순응은 손톱 플랩 5 mm 뿐.",
  B5T: "B5 + 손끝판 관절: 손끝판을 커플러에 빨대 핀으로 달고 고무줄로 스토퍼에 눌러 둠. pinch 반력은 스토퍼 쪽, 바닥 힘은 반대쪽으로 돌림(SymPy C1) → 공중에선 평행 pinch, 바닥에선 손끝이 안쪽·위로 꺾임(10 mm 에 46°, 안쪽 14 mm). 꺾이면 패드면이 기움.",
  B5F: "B5 + 플로팅 브래킷: 손가락 전체(브래킷·링크·손끝)를 손바닥 위 굵은 빨대 슬리브 2개에 일반 빨대로 꽂아(손바닥 구멍 통과) 수직 13 mm 이동, 고무줄 프리로드 3 N. 손끝이 기울지 않고 평행 유지. 쥐는 순간 슬리브 마찰로 잠겨 들어올릴 때 처지지 않음.",
  B5N: "B5 + 긴 손톱(14 mm): 손톱 플랩이 바깥·위로 접히며 최대 11.6 mm 순응. 추가 부품 없음. 접히기 전에는 손톱 안쪽 면이 쥐는 면(안쪽 스토퍼).",
  B5E: "B5N 쉬운 버전(영상용): 형상 그대로, 드럼 6개(18장) → 레버 판 4개. 실은 레버 끝 구멍에 매듭 하나. soft 레버 r26(모멘트 팔 19.6–26, 드럼 13 대비 장력 ↓), hard 레버 r16(13.8–16). soft 열림 30°(팔 결합 기준), 힘은 영상용 pinch 1.5 N · Fin Ray 0.5 N/손가락.",
};
const B5P: Record<string, typeof B5p> = { B5: B5p, B5T: B5Tp as unknown as typeof B5p, B5F: B5Fp as unknown as typeof B5p, B5N: B5Np as unknown as typeof B5p, B5E: B5Ep as unknown as typeof B5p };
const B5C: Record<string, unknown> = { B5: B5c, B5T: B5Tc, B5F: B5Fc, B5N: B5Nc, B5E: B5Ec };

export function makeB5(id: "B5" | "B5T" | "B5F" | "B5N" | "B5E" = "B5"): Design {
  const p = B5P[id];
  const d = (B5C[id] as { derived: unknown }).derived as Derived;
  const adj: [string, string][] = [
    ["palm", "flapR"],
    ["palm", "flapL"],
    ["palm", "motor"],
  ];
  for (const s of ["F", "B"]) {
    adj.push([`hard${s}`, `hard${s}_c`], [`hard${s}_l2`, `hard${s}_c`], [`hard${s}_c`, `hard${s}_t`], [`hard${s}`, `hard${s}_t`]);
    adj.push(["palm", `hard${s}`], ["palm", `hard${s}_l2`], ["palm", `hard${s}_br`], [`hard${s}_br`, `hard${s}`], [`hard${s}_br`, `hard${s}_l2`]);
  }
  return {
    id,
    name: p.name,
    summary: B5_SUMMARY[id],
    oneString: false,
    adjacent: adj,
    preset: (mode, obj) => presetFlap(d, d, mode, obj, false, p.soft.phi_open_deg),
    build(ctrl) {
      const floorZ = -ctrl.palmH;
      const obj = ctrl.obj ? makeObject(ctrl.obj, floorZ) : null;
      const sdf = sceneSdf(obj, floorZ);
      const sl = (p.soft as { lever?: { r: number; w: number; beta_open_deg: number; guide_x: number; guide_dz: number } }).lever;
      const fv = (p as { force_video?: { soft_per_finger_N: number } }).force_video;
      const soft = softFlap(
        {
          xh: num(d, "soft_hinge_x"),
          rootLen: p.soft.root_len,
          phiOpen: p.soft.phi_open_deg * DEG,
          phiMin: num(d, "soft_phi_min_deg") * DEG,
          drumR: p.soft.drum_r,
          drumY: p.soft.drum_y,
          joint: "score",
          Flim: fv ? fv.soft_per_finger_N : C.force.chip_limit_N / 2,
          lever: sl ? { r: sl.r, w: sl.w, beta0: sl.beta_open_deg * DEG, guideX: sl.guide_x, guideDz: sl.guide_dz } : undefined,
        },
        ctrl.a,
        sdf,
      );
      const hard = hardParallel(p, d, ctrl.b, obj ? obj.sdf : () => 1e9, floorZ);
      // soft 닫힘 스토퍼 블록 (손바닥 아랫면, 플랩 안쪽): 플랩이 φ_min 에서 블록 아래 바깥 모서리에 닿음
      const sp = p.soft as typeof p.soft & { stop_block_h?: number };
      const hb = sp.stop_block_h ?? 8;
      const fx0 = num(d, "soft_stop_face_x");
      for (const sx of [1, -1]) soft.parts.push(boxPart(`softStop${sx}`, "palm", "board", [6, 20, hb], V(sx * (fx0 - 3), -10, -hb / 2)));
      return assemble({ id, oneString: false }, palmPart(p.palm.sx, p.palm.sy), soft, hard, floorZ, obj, []);
    },
  };
}

// ================================================================== B6 (쉬운 버전: 매듭 soft + 접는 평행사변형 / 2마디 손가락)

type B6PP = typeof B6Pp;
/** B6P hard: 띠 한 장을 접은 평행사변형 상자. 윗변 = 손바닥 아래 풀칠, 링크 판 2장(폭 24, 두께 3), 아랫변 + 손끝판·손톱 */
function hardFold(p: B6PP, d: Derived, b: number, objSdf: (v: Vector3) => number, floorZ: number): HardOut {
  const h = p.hard;
  const halfT = (h.plies * C.board_t) / 2;
  const pt = h.panel_t;
  const yp = num(d, "hard_pivot_y");
  const Lc = num(d, "hard_coupler_below_E");
  const psiOpen = h.psi_open_deg * DEG;
  const psiMin = (num(d, "hard_psi_min_deg") + 0.3) * DEG;
  const qmax = psiOpen - psiMin;
  const zP = h.hinge_z;
  const at = (q: number) => {
    const psi = psiOpen - q;
    const u = V(0, Math.sin(psi), -Math.cos(psi));
    const P1 = V(0, yp, zP);
    const P2 = V(0, yp + h.d, zP);
    const E1 = P1.clone().addScaledVector(u, h.L);
    const E2 = P2.clone().addScaledVector(u, h.L);
    return { psi, u, P1, P2, E1, E2, tip: E1.clone().add(V(0, 0, -Lc)) };
  };
  const pen = (q: number) => {
    const g = at(q);
    for (const x of across(h.width)) {
      for (let k = 0; k <= 8; k++) {
        const sp = V(x, g.tip.y - halfT - C.pad_t, g.tip.z + h.nail_len + ((g.E1.z - 3 - g.tip.z - h.nail_len) * k) / 8);
        if (objSdf(sp) < 0.2) return true;
      }
      for (let k = 0; k <= 4; k++) if (objSdf(V(x, g.tip.y - halfT, g.tip.z + 0.5 + (h.nail_len * k) / 4)) < 0.2) return true;
    }
    return false;
  };
  const qcmd = clamp(b, 0, 1) * qmax;
  const q = firstContact(qcmd, pen);
  const g = at(q);
  const R: Part[] = [];
  const W = h.width;
  // 윗변(손바닥에 풀칠), 두 링크 판, 아랫변 (판 두께 pt, 링크 판은 서로 마주보는 면이 접는 선)
  R.push(boxPart("foldTop", "palm", "board", [W, h.d + pt, pt], V(0, yp + h.d / 2, zP + pt / 2)));
  R.push(segPart("foldOut", "hard", "board", g.P2, g.E2, W, pt, X));
  R.push(segPart("foldIn", "hard_l2", "board", g.P1, g.E1, W, pt, X));
  R.push(segPart("foldBot", "hard_c", "board", g.E1.clone().add(V(0, 0, -pt / 2)), g.E2.clone().add(V(0, 0, -pt / 2)), W, pt, X));
  // 손끝판 (2겹, 아랫변 안쪽 끝에서 수직으로) + 패드 + 손톱
  const plateTop = g.E1.clone().add(V(0, 0, -pt));
  const plateBot = g.tip.clone().add(V(0, 0, h.nail_len));
  R.push(segPart("tipPlate", "hard_c", "board", plateTop, plateBot, W, 2 * halfT, X));
  const padLen = Math.min(22, plateTop.z - plateBot.z - 2);
  const N = V(0, 1, 0);
  const padBot = plateBot.clone().addScaledVector(N, -halfT - C.pad_t / 2);
  R.push(segPart("pad", "hard_c", "pad", padBot.clone().add(V(0, 0, padLen)), padBot, W - 4, C.pad_t, X));
  const hingeN = plateBot.clone().addScaledVector(N, -halfT + 1);
  const nail = nailFold(hingeN, V(0, 0, -1), N, h.nail_len, floorZ);
  R.push(segPart("nail", "hard_c", "nail", hingeN, nail.tip, W - 2, 2, X));
  const RL: Line[] = [];
  // 복원 고무줄: 아랫변 바깥 끝 ↔ 손바닥 아랫면 바깥쪽
  RL.push({ id: "returnB", kind: "rubber", pts: [g.E2.clone().add(V(W / 2 - 3, 2, 0)), V(W / 2 - 3, yp + h.d + 4, 0)], attached: ["hard_c", "palm", "hard"] });
  const parts: Part[] = [];
  const lines: Line[] = [];
  const bF = (b0: string) => (b0 === "palm" ? "palm" : b0.replace("hard", "hardF"));
  const bB = (b0: string) => (b0 === "palm" ? "palm" : b0.replace("hard", "hardB"));
  for (const pp of R) {
    parts.push({ ...pp, id: pp.id + ".F", body: bF(pp.body) });
    parts.push(mirrorPart(pp, 1, -1, ".B", bB(pp.body)));
  }
  const attF = ["hardF", "hardF_l2", "hardF_c", "palm"];
  for (const l of RL) {
    lines.push({ ...l, id: l.id + ".F", attached: attF });
    lines.push(mirrorLine(l, 1, -1, ".B", attF.map((x) => x.replace("F", "B"))));
  }
  // 텐던 1가닥 루프. 교차 실: 앞 안쪽 링크 매듭 → 뒤쪽 구멍(+dx, −hole_y) → 손잡이 → 앞쪽 구멍(−dx, +hole_y) → 뒤 매듭
  const kn = h.knot as { s: number; hole_y: number; dx?: number; cross?: boolean };
  const K = g.P1.clone().addScaledVector(g.u, kn.s).add(V(0, -pt / 2, 0));
  const hy = kn.cross ? -kn.hole_y : kn.hole_y;
  const dx = kn.dx ?? 0;
  const G = V(dx, hy, 0);
  const GB = V(-dx, -hy, 0);
  const top = V(0, 0, Z_TOP + 40);
  lines.push({ id: "tendonLoop", kind: "tendon", pts: [K, G, G.clone().setZ(Z_TOP), top, GB.clone().setZ(Z_TOP), GB, V(K.x, -K.y, K.z)], attached: ["hardF_l2", "hardB_l2", "palm", "hardF", "hardB"] });
  const armNow = leverArm([K.y - g.P1.y, K.z - g.P1.z], [G.y - K.y, G.z - K.z]);
  const faceY = plateBot.y - halfT - C.pad_t;
  const nailRise = h.nail_len * (1 - Math.cos(nail.al));
  return {
    parts,
    lines,
    tops: [],
    metrics: { gap: 2 * Math.min(faceY, nail.tip.y - 1), tipZ: nail.tip.z - floorZ, hardTravel: q / qmax, vdef: nailRise },
    readouts: [
      { label: "링크 각 ψ (0 = 수직)", value: `${(g.psi / DEG).toFixed(1)}° (지령 ${((psiOpen - qcmd) / DEG).toFixed(1)}°)` },
      { label: "손끝 간격 (쥐는 면)", value: `${(2 * faceY).toFixed(1)} mm` },
      { label: "손톱 끝 높이 (바닥 위)", value: `${(nail.tip.z - floorZ).toFixed(1)} mm` },
      { label: "손톱 플랩 접힘", value: `${(nail.al / DEG).toFixed(0)}° (${nailRise.toFixed(1)} mm)`, warn: nail.al > 79 * DEG },
      { label: "매듭 실 모멘트 팔", value: `${armNow.toFixed(1)} mm` },
    ],
  };
}

const B6_SUMMARY: Record<string, string> = {
  B6P: "쉬운 버전 (평행 유지): hard 평행 링크를 띠 한 장을 접은 '납작한 상자'로 — 윗변은 손바닥 아래 풀칠, 두 링크 판·아랫변은 접는 선 + 테이프 힌지. 핀·빨대 구멍 0, 길이만 맞으면 평행. 실은 안쪽 링크 매듭 → 손바닥 가운데 구멍(앞·뒤 한 가닥 루프). soft 는 레버 없이 플랩 매듭 → 손바닥 구멍(좌·우 한 가닥 루프). 손톱 수직 순응은 B5N 과 같음.",
  B6F: "쉬운 버전 (손가락형): hard 를 2마디 텐던 손가락으로 — 손바닥 가장자리 테이프 힌지(J1) + 마디 테이프 힌지(J2), 안쪽 빨대 터널(받침으로 띄워 모멘트 팔), 바깥 고무줄 복원. 당기면 말려 들어가며 손톱이 물체 밑을 떠서 쥠(B3 계열). 공중에서 60% 당겨 원위를 말고 → 내림 → 조임 순서. soft 는 B6P 와 같음.",
};

export function makeB6(id: "B6P" | "B6F"): Design {
  const p = (id === "B6P" ? B6Pp : B6Fp) as unknown as B6PP & typeof B6Fp;
  const d = (id === "B6P" ? B6Pc : B6Fc).derived as unknown as Derived;
  const adj: [string, string][] = [
    ["palm", "flapR"],
    ["palm", "flapL"],
  ];
  if (id === "B6P")
    for (const s of ["F", "B"]) adj.push(["palm", `hard${s}`], ["palm", `hard${s}_l2`], [`hard${s}`, `hard${s}_c`], [`hard${s}_l2`, `hard${s}_c`]);
  else adj.push(["palm", "hardF"], ["palm", "hardB"], ["hardF", "hard2F"], ["hardB", "hard2B"]);
  return {
    id,
    name: p.name,
    summary: B6_SUMMARY[id],
    oneString: false,
    adjacent: adj,
    preset: (mode, obj) => presetFlap(d, d, mode, obj, false, p.soft.phi_open_deg),
    build(ctrl) {
      const floorZ = -ctrl.palmH;
      const obj = ctrl.obj ? makeObject(ctrl.obj, floorZ) : null;
      const sdf = sceneSdf(obj, floorZ);
      const soft = softFlap(
        {
          xh: num(d, "soft_hinge_x"),
          rootLen: p.soft.root_len,
          phiOpen: p.soft.phi_open_deg * DEG,
          phiMin: num(d, "soft_phi_min_deg") * DEG,
          drumR: 10,
          drumY: p.soft.drum_y,
          joint: "score",
          Flim: p.force_video.soft_per_finger_N,
          knot: { s: p.soft.knot.s, holeX: p.soft.knot.hole_x, dy: (p.soft.knot as { dy?: number }).dy, cross: (p.soft.knot as { cross?: boolean }).cross },
          finrayL: (p.soft as { finray_L?: number }).finray_L,
        },
        ctrl.a,
        sdf,
      );
      let hard: HardOut;
      if (id === "B6P") hard = hardFold(p, d, ctrl.b, obj ? obj.sdf : () => 1e9, floorZ);
      else {
        const pf = { ...B6Fp, hard: { ...B6Fp.hard, tape_hinge: true } } as unknown as Parameters<typeof hardTendon>[0];
        hard = hardTendon(pf, d, ctrl.b, sdf);
        hard.metrics.tipZ -= floorZ;
      }
      // soft 실은 한 가닥 루프 (균형막대 없음): 좌·우 구멍 위에서 손잡이 한 점으로
      const handle = V(0, 0, Z_TOP + 70);
      for (const l of soft.lines) if (l.id.startsWith("stringA")) l.pts.push(handle);
      soft.tops = [];
      // soft 닫힘 스토퍼 블록 (실 경로 y=0 을 피해 stop_block_y)
      const hb = p.soft.stop_block_h;
      const [y0, y1] = p.soft.stop_block_y;
      const fx0 = num(d, "soft_stop_face_x");
      for (const sx of [1, -1]) soft.parts.push(boxPart(`softStop${sx}`, "palm", "board", [6, y1 - y0, hb], V(sx * (fx0 - 3), (y0 + y1) / 2, -hb / 2)));
      return assemble({ id, oneString: false }, palmPart(p.palm.sx, p.palm.sy), soft, hard, floorZ, obj, []);
    },
  };
}

/** 현재 후보 (B5 계열: 평행 링크 hard + 수직 순응 옵션) */
export const CURRENT: Design[] = [makeB6("B6P"), makeB6("B6F"), makeB5("B5N")];
/** 보관 (old): 하민 피드백으로 내려간 안. 비교용으로만 유지 */
export const OLD: Design[] = [makeB5("B5E"), makeB5("B5F"), makeB5("B5"), makeB5("B5T"), makeB1(), makeB2(), makeB3(), makeB3(false, true), makeB4(), makeB1(true), makeB3(true)];
export const OLD_REASON: Record<string, string> = {
  B5E: "실물 시도(2026-11-27): 판 82조각·빨대 구멍 16개 — 골판지로 ±1 mm 구멍 정렬이 안 나오고 조립이 너무 어려움 → B6P/B6F 로 단순화",
  B5F: "플로팅 브래킷 — 순응은 B5N 과 같은 14 mm 인데 텔레스코프 2쌍·손바닥 슬롯이 추가. 하민: 최종(B5N) + 쉬운 버전(B5E) 두 개만 남김 (2026-11-25)",
  B5: "B5N 의 바탕 (손톱 5 mm, 수직 순응 4 mm) — 긴 손톱(B5N)으로 대체",
  B5T: "손끝판 관절 — 바닥 힘이 손끝을 물체 쪽으로 돌려, 쥐고 있을 때 물체가 막아 순응 안 됨. 반대로 돌리면 pinch 반력과 분리 불가 (SymPy C1·C3)",
  B1: "단일 피벗 hard — 손끝이 비스듬(쐐기 패드 필요), 수직 순응은 손톱 5 mm",
  B2: "직선 슬롯 — 개구 90×71 mm·높이 59 mm 제한 (주방 스펀지 불가)",
  B3: "텐던 2마디 — 수직 순응·개구는 가장 좋지만(점수 최상위) 예비 말기 순서 필요, 장력 50 N. 하민이 링크 기반 단순 구조로 방향 전환",
  B3o: "B3 최적화 — 원위를 58° 젖힌 '벌어진 끝' 이 어색, 스토퍼·고무줄 튜닝 의존",
  B4: "B2 soft + B3 hard — 두 안의 약점(슬롯 마찰·텐던 튜닝)을 모두 가짐",
  V5: "B1 + 실 1개 — B1 이 보관으로 감",
  V5b: "B3 + 실 1개 — B3 계열과 함께 보관 (전에 보고한 Fin Ray↔텐던 간섭은 Fin Ray 솔버 터널링 버그였고 수정 후 사라짐)",
};
export const ALL: Design[] = [...CURRENT, ...OLD];
void lerp;
