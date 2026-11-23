/**
 * 팔(R4) + 그리퍼 결합 템플릿.
 *
 * ⚠ params/arm/R4.json 의 치수는 '가정'(placeholder). 팀원이 R4 실측값으로 바꾸면 이 파일은 그대로 동작한다.
 *
 * 좌표: world z 위, 바닥 z = 0, 팔 베이스 중심 = 원점. 그리퍼는 손바닥이 바닥을 향하게(수직) 매달림.
 * 관절: base(yaw, z축) → shoulder(pitch) → elbow(pitch) → wrist pitch(수평 유지 'level' 또는 각도) → wrist roll(z축) → 장착 기둥 → 그리퍼.
 * 그리퍼 local: 손바닥 아랫면 z=0, 윗면 z=6 (src/core 의 B5N 과 같음). 장착 기둥은 손바닥 윗면 가운데 빈 영역(calc/out/envelope.json mount_free_rect).
 */
import { Matrix4, Vector3 } from "three";
import armJson from "../../params/arm/R4.json";
import { V, boxPart, cylPart } from "./build";
import type { Assembly, Design, Line, Part } from "./types";

export type ArmParams = typeof armJson;
export const ARM: ArmParams = armJson;

export interface ArmPose {
  base: number; // rad
  shoulder: number; // rad, 0 = 수평, + 위로
  elbow: number; // rad, 상완 대비, - 아래로 꺾임
  wristPitch: number | "level"; // 'level' = 그리퍼 수직 유지 (평행 링크/실 등으로 수평 유지하는 팔 가정)
  roll: number; // rad
}

const R = (axis: "x" | "y" | "z", a: number) =>
  axis === "x" ? new Matrix4().makeRotationX(a) : axis === "y" ? new Matrix4().makeRotationY(a) : new Matrix4().makeRotationZ(a);
const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);

/** 정기구학: 팔 부품 + 그리퍼 장착 변환 (그리퍼 local → world) */
export function armFK(p: ArmParams, q: ArmPose) {
  const parts: Part[] = [];
  const add = (id: string, body: string, M: Matrix4, size: [number, number, number], kind: Part["kind"] = "board") => {
    const pt = boxPart(id, body, kind, size, V(0, 0, 0));
    pt.m = M.clone();
    parts.push(pt);
  };
  // 베이스
  add("base", "arm_base", T(0, 0, p.base.h / 2), [p.base.w, p.base.w, p.base.h]);
  const M0 = R("z", q.base).premultiply(new Matrix4()).multiply(new Matrix4());
  const Mcol = T(0, 0, p.base.h).multiply(R("z", q.base));
  add("column", "arm_col", Mcol.clone().multiply(T(0, 0, p.column.h / 2)), [p.column.w, p.column.w, p.column.h]);
  // 어깨 (column 위, x 방향으로 뻗음)
  const Msh = Mcol.clone().multiply(T(0, 0, p.column.h)).multiply(R("y", -q.shoulder));
  add("upper", "arm_upper", Msh.clone().multiply(T(p.upper.L / 2, 0, 0)), [p.upper.L, p.upper.w, p.upper.t]);
  const Mel = Msh.clone().multiply(T(p.upper.L, 0, 0)).multiply(R("y", -q.elbow));
  add("fore", "arm_fore", Mel.clone().multiply(T(p.fore.L / 2, 0, 0)), [p.fore.L, p.fore.w, p.fore.t]);
  // 손목: 전완 끝. level 이면 world 에서 그리퍼가 수직(아래)을 향하도록 피치 보정
  const pitchSum = q.shoulder + q.elbow;
  const wp = q.wristPitch === "level" ? -pitchSum : q.wristPitch;
  const Mw = Mel.clone().multiply(T(p.fore.L, 0, 0)).multiply(R("y", -wp));
  // 손목 블록은 전완 끝에서 아래로 매달림 (local -z = 아래)
  add("wrist", "arm_wrist", Mw.clone().multiply(T(0, 0, -p.wrist.h / 2)), [p.wrist.w, p.wrist.w, p.wrist.h]);
  const Mroll = Mw.clone().multiply(T(0, 0, -p.wrist.h)).multiply(R("z", q.roll));
  // 장착 기둥 (손바닥 윗면 중앙 빈 영역에 맞춘 단면)
  add("mount", "arm_mount", Mroll.clone().multiply(T(0, 0, -p.mount.h / 2)), [p.mount.x, p.mount.y, p.mount.h]);
  // 그리퍼 local 원점(손바닥 아랫면) = 기둥 아래 끝에서 손바닥 두께(6)만큼 더 아래
  const Mgrip = Mroll.clone().multiply(T(0, 0, -p.mount.h - 6));
  void M0;
  // 관절 표시 (빨대 축 실린더)
  parts.push(cylPart("jSh", "arm_upper", "straw", new Vector3().setFromMatrixPosition(Msh), new Vector3(0, 1, 0).applyMatrix4(new Matrix4().extractRotation(Msh)), p.upper.w + 10, 6));
  parts.push(cylPart("jEl", "arm_fore", "straw", new Vector3().setFromMatrixPosition(Mel), new Vector3(0, 1, 0).applyMatrix4(new Matrix4().extractRotation(Mel)), p.fore.w + 10, 6));
  return { parts, Mgrip, wristPos: new Vector3().setFromMatrixPosition(Mw) };
}

/** 2링크 평면 역기구학: 손목(전완 끝) 을 수평거리 r, 높이 z 에 (팔꿈치 위로) */
export function armIK(p: ArmParams, r: number, z: number): { shoulder: number; elbow: number } | null {
  const zs = p.base.h + p.column.h;
  const dx = r;
  const dz = z - zs;
  const L1 = p.upper.L;
  const L2 = p.fore.L;
  const D = Math.hypot(dx, dz);
  if (D > L1 + L2 - 1e-6 || D < Math.abs(L1 - L2) + 1e-6) return null;
  const cosE = (D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const e = -Math.acos(Math.max(-1, Math.min(1, cosE))); // 팔꿈치 위로 (아래로 꺾임 = 음수)
  const s = Math.atan2(dz, dx) - Math.atan2(L2 * Math.sin(e), L1 + L2 * Math.cos(e));
  return { shoulder: s, elbow: e };
}

/** 그리퍼 Assembly 를 world 로 옮김 (parts·lines·object·floor) */
export function transformAssembly(asm: Assembly, M: Matrix4): Assembly {
  const mapP = (p: Part): Part => ({ ...p, m: M.clone().multiply(p.m as unknown as Matrix4) as unknown as Part["m"] });
  const mapL = (l: Line): Line => ({ ...l, pts: l.pts.map((v) => (v as unknown as Vector3).clone().applyMatrix4(M)) as unknown as Line["pts"] });
  const obj = asm.object
    ? { ...asm.object, sdf: (v: Vector3) => asm.object!.sdf(v.clone().applyMatrix4(M.clone().invert())), shape: { ...asm.object.shape, c: (asm.object.shape.c as unknown as Vector3).clone().applyMatrix4(M) } }
    : null;
  return { ...asm, parts: asm.parts.map(mapP), lines: asm.lines.map(mapL), object: obj as Assembly["object"], floorZ: 0 };
}

/** 그리퍼 Design 과 팔을 합친 충돌 검사용 Design (인접 관절 쌍은 제외) */
export function combinedDesign(grip: Design): Design {
  return {
    ...grip,
    adjacent: [
      ...grip.adjacent,
      ["arm_base", "arm_col"],
      ["arm_col", "arm_upper"],
      ["arm_upper", "arm_fore"],
      ["arm_fore", "arm_wrist"],
      ["arm_wrist", "arm_mount"],
      ["arm_mount", "palm"],
      // 실·고무줄이 기둥 안·옆을 지나가는 것은 보우덴 처리 대상이라 별도 표시 (충돌에서 제외)
    ],
  };
}

/** 실 경로를 팔 쪽으로 이어 그림 (보우덴 피복 가정: 손바닥 위 → 기둥 → 손목 → 전완·상완 → 베이스) */
export function bowdenPath(arm: ReturnType<typeof armFK>, p: ArmParams, q: ArmPose): Vector3[] {
  void q;
  const pts: Vector3[] = [];
  pts.push(new Vector3(0, 0, 6 + p.mount.h).applyMatrix4(arm.Mgrip));
  pts.push(arm.wristPos.clone());
  // 팔 관절 근처를 지나 베이스로 (관절 축을 지나야 길이 변화 최소)
  return pts;
}
