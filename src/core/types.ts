import { Matrix4, Vector3 } from "three";

/** 재질/표현 종류. board=골판지(3mm), flank=라이너 벗긴 골판지, straw=빨대(축/리브), bubble=굵은 빨대(부싱),
 *  disk=드럼(골판지 원판 적층), pad=고무 마찰패드, nail=손톱 플랩, wall=가이드 벽(슬롯) */
export type PartKind = "board" | "flank" | "straw" | "bubble" | "disk" | "pad" | "nail" | "wall" | "slot";

export interface Part {
  id: string;
  /** 같은 body 끼리는 충돌 검사 생략 (한 강체/한 조립체) */
  body: string;
  kind: PartKind;
  /** box: [sx, sy, sz] (local). straw/bubble/disk: 실린더 축 = local x, [len, d, d] */
  size: [number, number, number];
  /** 중심 + 회전 (world) */
  m: Matrix4;
  /** 충돌 검사 제외 */
  ghost?: boolean;
}

export interface Line {
  id: string;
  kind: "string" | "rubber" | "tendon";
  pts: Vector3[];
  /** 충돌 검사에서 제외할 body (실 고정점이 붙어 있는 부품) */
  attached?: string[];
}

export interface Controls {
  /** 실 A (soft) 당김 0..1 */
  a: number;
  /** 실 B (hard) 당김 0..1 */
  b: number;
  /** 1-string 변형용 단일 당김 0..1 (oneString 일 때만 사용) */
  s: number;
  /** 손바닥 아랫면의 바닥 위 높이 */
  palmH: number;
  obj: ObjName | null;
}

export type ObjName = "battery" | "cap" | "chip" | "sponge" | "cable";

export interface ObjInstance {
  name: ObjName;
  sdf: (p: Vector3) => number;
  /** 렌더용 */
  shape:
    | { kind: "cyl"; r: number; len: number; axis: "x" | "z"; c: Vector3 }
    | { kind: "ellip"; a: number; b: number; c3: number; c: Vector3 }
    | { kind: "box"; sx: number; sy: number; sz: number; c: Vector3 };
}

export interface Readout {
  label: string;
  value: string;
  warn?: boolean;
}

export interface Assembly {
  parts: Part[];
  lines: Line[];
  floorZ: number;
  object: ObjInstance | null;
  readouts: Readout[];
  /** 충돌 검사 결과 (외부에서 채움) */
  collisions?: string[];
  /** Fin Ray 손가락 접촉력 추정 [N] */
  finrayForces?: number[];
}

export type ModeName = "open" | "soft" | "rigid" | "hybrid";

export interface Design {
  id: string;
  name: string;
  summary: string;
  oneString: boolean;
  build(ctrl: Controls): Assembly;
  /** 모드/물체에 맞는 기본 컨트롤 */
  preset(mode: ModeName, obj: ObjName | null): Controls;
  /** body 쌍 중 접촉이 정상인 것 (힌지 인접 등) */
  adjacent: [string, string][];
}
