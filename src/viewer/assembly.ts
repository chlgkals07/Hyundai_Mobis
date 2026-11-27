/**
 * B5E(쉬운 버전) / B5N(최종) 제작 과정 애니메이션 (?d=B5E|B5N, 페이지 버튼으로 전환): 전개도(2D) 자르기 → 커팅매트 위 부품 → 단계별 조립(3D) → 실 당겨 동작 → 실현성 카드.
 * window.__render(t) 로 결정적(deterministic) 렌더 → scripts/record-assembly.mjs 가 프레임 캡처 → mp4.
 */
import * as THREE from "three";
import { ALL } from "../core/designs";
import { PATTERNS } from "../core/pattern";
import type { Assembly, Part } from "../core/types";
import viewerData from "../../data/viewer-data.json";
import { DIAGRAMS } from "../core/diagrams";
import manualB5E from "../../docs/B5E-제작설명서.md?raw";
import manualB6P from "../../docs/B6P-제작설명서.md?raw";
import { mdToHtml } from "./md";

type DId = "B6P" | "B5N" | "B5E";
const DESIGNS: DId[] = ["B6P", "B5N", "B5E"];
const qs = new URLSearchParams(location.search);
let DESIGN_ID: DId = (() => {
  const q = qs.get("d");
  if (DESIGNS.includes(q as DId)) return q as DId;
  try {
    const v = localStorage.getItem("asm-design");
    if (DESIGNS.includes(v as DId)) return v as DId;
  } catch {
    /* 저장소 없음 */
  }
  return "B6P";
})();
let LEV = DESIGN_ID === "B5E";
/** B6P: 접는 상자 hard + 매듭 soft (레버·드럼 없음) */
let FOLD = DESIGN_ID === "B6P";
let design = ALL.find((d) => d.id === DESIGN_ID)!;
let pattern = PATTERNS.find((p) => p.id === DESIGN_ID)!;
const sheetsOf = (id: string): string[] => ((viewerData as { patterns?: { id: string; sheets: string[] }[] }).patterns ?? []).find((p) => p.id === id)?.sheets ?? [];
let sheets = sheetsOf(DESIGN_ID);

// ------------------------------------------------------------------ 실현성 수치 (전개도에서 집계, 시간은 추정)
function feasOf() {
  const boardPieces = pattern.shapes.reduce((a, s) => a + s.qty, 0);
  // 원판(드럼) 또는 V자 레버 — 곡선·꺾인 윤곽이라 자르기 시간이 김
  const circles = pattern.shapes.filter((s) => /드럼 (큰|작은)판|레버$/.test(s.label)).reduce((a, s) => a + s.qty, 0);
  const areaM2 = pattern.shapes.reduce((a, s) => a + s.w * s.h * s.qty, 0) / 1e6;
  return {
    boardPieces,
    circles,
    straight: boardPieces - circles,
    // 추정: 직선 부품 1.5 분, 원판 3 분 / V자 레버 2 분, Fin Ray 띠(라이너 벗기기 포함) 6 분/개
    cutMin: Math.round((boardPieces - circles - 4) * 1.5 + circles * (LEV ? 2 : 3) + 4 * 6),
    areaM2,
    // 택배상자 1개(약 40×30×25 cm)에서 평평하게 쓸 수 있는 면적 ≈ 0.35 m², 버리는 부분 감안 60 %
    boxes: Math.max(1, Math.ceil(areaM2 / (0.35 * 0.6))),
  };
}
let FEAS = feasOf();

// ------------------------------------------------------------------ 타임라인
interface Step {
  t0: number;
  t1: number;
  title: string;
  craft: string;
  feas: string;
  level: 1 | 2 | 3; // 난이도
}
const T_PATTERN = [4, 22]; // 2D 전개도
function stepsOf(): Step[] {
  if (FOLD) return stepsB6P();
  const fv = LEV;
  return [
    { t0: 0, t1: 4, title: `${DESIGN_ID} 골판지 그리퍼 — 만드는 과정`, craft: LEV ? "B5N 과 같은 형상, 드럼 대신 V자 레버 (영상용 쉬운 버전) · 1:1 전개도 A4 3장" : "평행 링크 hard (긴 손톱) + 플랩 Fin Ray soft · 1:1 전개도 A4 3장", feas: "", level: 1 },
    { t0: 4, t1: 10, title: "1. 도면 출력 → 골판지에 붙이기 → 자르기", craft: "A4 실제 크기(100%) 인쇄, 100 mm 눈금자 확인 → 딱풀로 택배상자에 붙임 → 구멍 맞춤 시험편부터 자르고 빨대 구멍 지름 결정 → 커터칼+쇠자", feas: `판 부품 ${FEAS.boardPieces}개 (${LEV ? "V자 레버" : "원판"} ${FEAS.circles}) · 자르기 약 ${Math.round(FEAS.cutMin / 10) * 10}분 (추정)`, level: 1 },
    { t0: 10, t1: 16, title: "2. 접는 선·구멍", craft: "파란 점선 = 볼펜으로 자 대고 꾹 눌러 score → 깔끔하게 접힘. 빨간 원 = 송곳으로 뚫고 연필로 넓혀 빨대 구멍", feas: "구멍 위치 ±1 mm 가 평행 링크의 평행도를 좌우 — 가장 꼼꼼해야 하는 단계", level: 2 },
    { t0: 16, t1: 22, title: "3. Fin Ray 띠 — 한쪽 라이너 벗기기", craft: "Fin Ray 띠 4개는 골판지 한쪽 종이(라이너)를 물에 살짝 적셔 벗긴 '단면 골판지' → 골이 폭 방향이라 길이 방향으로 잘 휨", feas: "벗기기 + 건조 시간 필요 (드라이어로 5분)", level: 2 },
    { t0: 22, t1: 27, title: "4. 잘린 부품들", craft: `커팅매트 위에 모두 펼친 상태. 같은 부품은 겹쳐 붙여(적층) 두께를 만듦 — 링크·손끝판·브래킷${LEV ? "·레버" : ""}`, feas: "적층은 목공풀(얇게) 또는 글루건. 글루건은 두께가 생겨 치수 오차↑", level: 1 },
    { t0: 27, t1: 33, title: "5. 손바닥 + 플랩", craft: "윗장·아랫장(좌우 1.5 mm 좁게) 골 방향 엇갈려 풀칠, 플랩 부분 풀칠 금지. 플랩은 score 선 = 힌지. 닫힘 스토퍼 블록 부착", feas: "쉬움", level: 1 },
    { t0: 33, t1: 41, title: "6. Fin Ray 접기 + 리브", craft: "띠를 접는 선 3곳에서 삼각형으로 → 탭 풀칠. 빨대 리브 4개를 R2–R8 표시에 테이프로 양끝 힌지", feas: "Fin Ray 4개 × 약 10분. 리브 길이 22/17/11/6 mm 빨대 자르기", level: 2 },
    LEV
      ? { t0: 41, t1: 46, title: "7. Fin Ray → 플랩, soft 레버", craft: "Fin Ray 밑판 탭을 플랩 끝에 수직으로 풀칠. soft 레버(V자 2겹)는 꼭짓점을 힌지선에 맞추고 발을 플랩 바깥면에 세워 풀칠 + 삼각 보강, 팔은 손바닥 슬롯을 지나 윗면 위로", feas: "원판 중심 맞춤·홈 없음. 레버가 손바닥에 닿는 약 35° 가 열림 스토퍼", level: 1 }
      : { t0: 41, t1: 46, title: "7. Fin Ray → 플랩, 드럼", craft: "Fin Ray 밑판 탭을 플랩 끝에 수직으로 풀칠. 드럼(원판 큰-작은-큰)을 플랩 바깥 힌지선에 세워 붙이고 삼각 보강", feas: "드럼 직각 접착부가 약점 — 삼각 보강 필수", level: 2 },
    { t0: 46, t1: 52, title: "8. 브래킷 + 축 (hard)", craft: "브래킷 4장: 위 탭을 접어 손바닥 아랫면에 평행하게 풀칠 + 삼각 보강. 축 빨대 2개 (구멍 지름은 시험편으로 결정)", feas: "두 브래킷 평행·구멍 정렬이 핵심. 축을 먼저 끼운 채로 풀칠하면 정렬이 맞음", level: 3 },
    LEV
      ? { t0: 52, t1: 58, title: "9. 평행 링크 + hard 레버", craft: "hard 레버(V자 3겹)의 발을 바깥 링크 막대 2개 사이에 끼워 면 풀칠, 꼭짓점 구멍 = 바깥 축. 안쪽 링크 막대 2개는 레버 양옆 같은 평면", feas: "레버 끝 ↔ 안쪽 축 여유 약 1 mm (SymPy E5) — 끝까지 돌려 확인. 링크 2개는 겹쳐 함께 뚫기", level: 3 }
      : { t0: 52, t1: 58, title: "9. 평행 링크", craft: "드럼을 바깥 링크 막대 2개 사이에 끼워 면 풀칠 (토크는 골판지로, 빨대는 핀만). 안쪽 링크 막대 2개는 드럼 양옆 같은 평면", feas: "링크 2개의 구멍 간격(55 mm)이 같아야 평행사변형 — 두 막대를 겹쳐 함께 뚫기", level: 3 },
    { t0: 58, t1: 64, title: "10. 커플러 + 손끝판 + 긴 손톱", craft: "L자 측판 2장 + 손끝판 → 링크 끝 핀 2개. 손톱(14 mm, 3겹)을 테이프 힌지 + 안쪽 스토퍼. 열림 스토퍼 탭 (54°)", feas: "⚠ 손끝판이 8 mm 뿐이고 손톱 14 mm 가 쥐는 면 — 손톱 3겹 + 고무줄 감기 권장", level: 3 },
    LEV
      ? { t0: 64, t1: 70, title: "11. 실·텐던·고무줄", craft: "soft: 레버 끝 매듭 → 위로 → 균형막대. hard: 텐던 1가닥 루프(앞 레버 끝 매듭 → 손바닥 구멍 → 손잡이 → 뒤 레버 끝 매듭). 복원 고무줄은 약하게", feas: "감기 없이 매듭 4개. 실 길이는 테이프로 임시 고정 후 조정", level: 1 }
      : { t0: 64, t1: 70, title: "11. 실·텐던·고무줄", craft: "soft: 드럼 → 위로 → 균형막대. hard: 텐던 1가닥 루프(앞 드럼 → 손잡이/모터 → 뒤 드럼). 복원 고무줄", feas: "실 길이 맞추기·매듭이 의외로 시간 소모 (30분 이상)", level: 2 },
    { t0: 70, t1: 84, title: "12. 동작 — 건전지 (Rigid) · 감자칩 (Soft)", craft: fv ? "실 B 를 당기면 앞·뒤 손끝판이 수직을 유지한 채 닫힘 · 실 A 를 당기면 Fin Ray 가 감쌈 (영상용: 손가락당 0.5 N, pinch 1.5 N)" : "실 B 를 당기면 앞·뒤 손끝판이 수직을 유지한 채 닫힘 · 실 A 를 당기면 Fin Ray 가 감쌈 (직렬 고무줄 2.5 N/손가락 제한)", feas: "시뮬 결과 재생 (마찰·골판지 휨 미포함)", level: 1 },
    { t0: 84, t1: 94, title: "실현 가능한가?", craft: "", feas: "", level: 1 },
  ];
}
function stepsB6P(): Step[] {
  return [
    { t0: 0, t1: 4, title: "B6P 골판지 그리퍼 — 만드는 과정", craft: "접는 상자(평행사변형) hard + 매듭 soft · 핀·빨대 구멍 0 · 전량판 A4 4장", feas: "", level: 1 },
    { t0: 4, t1: 10, title: "1. 도면 출력 → 골판지에 붙이기 → 자르기", craft: "A4 실제 크기(100%) 인쇄, 100 mm 눈금 확인 → 딱풀로 택배상자에 → 커터칼+쇠자로 실선 자르기. 수량만큼 모두 그려진 전량판이라 따라 그릴 필요 없음", feas: `판 부품 ${FEAS.boardPieces}개 · 자르기 약 ${Math.round(FEAS.cutMin / 10) * 10}분 (추정)`, level: 1 },
    { t0: 10, t1: 16, title: "2. 접는 선·구멍", craft: "파란 점선 = 볼펜으로 자 대고 꾹. 빨간 원 = 송곳으로 Ø3 실 구멍 (빨대 구멍 없음)", feas: "정밀 구멍 없음 — 위치가 1–2 mm 틀려도 동작", level: 1 },
    { t0: 16, t1: 22, title: "3. Fin Ray 띠 — 한쪽 라이너 벗기기", craft: "Fin Ray 띠 4개: 한쪽 겉종이를 물에 살짝 적셔 벗김 → 길이 방향으로 잘 휨", feas: "벗기기 + 건조 (드라이어 5분)", level: 2 },
    { t0: 22, t1: 27, title: "4. 잘린 부품들", craft: "손바닥 2장, Fin Ray 띠 4, 접는 상자 띠 2, 손끝판·손톱·스토퍼", feas: "적층은 손끝판(2장)·손톱(3장)·스토퍼 블록(2장)뿐", level: 1 },
    { t0: 27, t1: 33, title: "5. 손바닥 + 플랩", craft: "윗장·아랫장(좌우 1.5 mm 좁게) 골 방향 엇갈려 풀칠, 플랩 부분 풀칠 금지. 구멍 7개 함께 뚫기. 닫힘 스토퍼 블록", feas: "쉬움", level: 1 },
    { t0: 33, t1: 41, title: "6. Fin Ray 접기 + 리브", craft: "띠를 접는 선 4곳에서 접어 삼각형 → 끝 탭 풀칠. 빨대 리브 4개를 R2–R8 에 테이프 힌지", feas: "Fin Ray 4개 × 약 10분", level: 2 },
    { t0: 41, t1: 46, title: "7. Fin Ray → 플랩", craft: "Fin Ray 앞 탭(12 mm)을 플랩 안쪽 면 빗금 자리에 풀칠 → contact 면이 플랩과 한 줄. 플랩 하나에 2개", feas: "밑판·레버 없음", level: 1 },
    { t0: 46, t1: 52, title: "8. 접는 상자 만들기 → 손바닥에", craft: "띠의 접는 선 4개를 깊게 눌러 양방향으로 길들이고 바깥 면 테이프 → 끝 탭을 윗변 안쪽 끝에 겹쳐 풀칠(납작한 상자) → 윗변을 손바닥 아랫면 빗금 자리에 풀칠", feas: "안쪽 링크(매듭 구멍)가 손바닥 가운데 쪽", level: 2 },
    { t0: 52, t1: 58, title: "9. 접는 상자 — 링크·아랫변", craft: "바깥 링크·아랫변·안쪽 링크가 평행사변형으로 매달림. 손으로 밀어 아랫변이 수평을 유지하는지 확인", feas: "두 링크(75 mm) 길이가 같으면 평행 — 구멍 정렬 필요 없음", level: 2 },
    { t0: 58, t1: 64, title: "10. 손끝판 + 손톱", craft: "ㄱ자 손끝판(2장)을 아랫변 아래 안쪽 끝에 풀칠 + 삼각 보강. 손톱(3겹) 테이프 힌지 + 스토퍼 + 고무줄 2바퀴", feas: "손끝판이 수직인지 상자를 기울여 확인", level: 2 },
    { t0: 64, t1: 70, title: "11. 실·고무줄", craft: "soft: 좌 매듭 → 구멍 → 손잡이 → 구멍 → 우 매듭 (한 가닥). hard: 앞 매듭 → 가운데 구멍 → 손잡이 → 같은 구멍 → 뒤 매듭 (한 가닥). 복원 고무줄은 약하게", feas: "매듭 4개, 균형막대 없음. 실 장력 약 10 N — 매끄러운 실", level: 1 },
    { t0: 70, t1: 84, title: "12. 동작 — 건전지 (Rigid) · 감자칩 (Soft)", craft: "hard 실을 당기면 손끝판이 수직을 유지한 채 닫힘 · soft 실을 당기면 Fin Ray 가 감쌈 (영상용 0.5 N/손가락)", feas: "시뮬 결과 재생 (마찰·골판지 휨 미포함)", level: 1 },
    { t0: 84, t1: 94, title: "실현 가능한가?", craft: "", feas: "", level: 1 },
  ];
}
let STEPS: Step[] = stepsOf();
const T_END = 94;

// ------------------------------------------------------------------ three
const stage = document.getElementById("stage")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ece9);
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 1, 5000);
camera.up.set(0, 0, 1);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a94, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(200, -300, 500);
scene.add(sun);

const COLORS: Record<Part["kind"], number> = {
  board: 0xb98b5a, flank: 0xd9b382, straw: 0xf1efe9, bubble: 0x7fb3d5, disk: 0x9c7046, pad: 0x333333, nail: 0x8a6a45, wall: 0xa9845a, slot: 0x2a2a2a,
};
const matCache = new Map<string, THREE.MeshStandardMaterial>();
const mat = (k: Part["kind"], ghost: boolean, hi = false) => {
  const key = k + ghost + hi;
  if (!matCache.has(key))
    matCache.set(key, new THREE.MeshStandardMaterial({ color: hi ? 0xf0b25a : COLORS[k], roughness: 0.85, transparent: ghost || k === "bubble", opacity: ghost ? 0.35 : k === "bubble" ? 0.6 : 1, emissive: hi ? 0x6b3d00 : 0x000000, emissiveIntensity: hi ? 0.35 : 0 }));
  return matCache.get(key)!;
};
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 18);
const RZ = new THREE.Matrix4().makeRotationZ(-Math.PI / 2);
const isCyl = (p: Part) => p.kind === "straw" || p.kind === "bubble" || p.kind === "disk";
function localScale(p: Part) {
  return isCyl(p) ? new THREE.Matrix4().multiplyMatrices(RZ, new THREE.Matrix4().makeScale(p.size[1], p.size[0], p.size[2])) : new THREE.Matrix4().makeScale(Math.max(p.size[0], 0.3), Math.max(p.size[1], 0.3), Math.max(p.size[2], 0.3));
}

// ------------------------------------------------------------------ 최종(열린) 조립 + 부품 단계 분류
let finalAsm = design.build(design.preset("open", null));
let FLOOR = finalAsm.floorZ;

function stepOf(p: Part): number {
  const id = p.id;
  if (p.ghost) return 11;
  if (/^palm/.test(id) || /^flap\./.test(id)) return 5;
  if (/^finray/.test(id)) return 6; // 6 접기 → 7 부착
  if (/^(drum|lever)/.test(id) && p.body.startsWith("flap")) return 7;
  if (/^(bracket|axle|foldTop)/.test(id)) return 8;
  if (/^(link|drum|lever|foldOut|foldIn|foldBot)/.test(id)) return 9;
  return 10;
}

interface Anim {
  part: Part;
  mesh: THREE.Mesh;
  start: THREE.Matrix4; // 매트 위 평평
  bench?: THREE.Matrix4; // (Fin Ray) 작업대 위 접힌 상태
  final: THREE.Matrix4;
  step: number;
}

const decompose = (m: THREE.Matrix4) => {
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(p, q, s);
  return { p, q };
};

/** 가장 얇은 local 축을 world Z 로 눕힌 자세 (cyl 은 축을 X 로) */
function flatRotation(p: Part) {
  const s = p.size;
  if (isCyl(p)) return new THREE.Quaternion(); // local x = 축 → world x, 눕힘
  const thin = s.indexOf(Math.min(...s));
  const q = new THREE.Quaternion();
  if (thin === 0) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  if (thin === 1) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  return q;
}

const anims: Anim[] = [];
const group = new THREE.Group();
scene.add(group);
const finStart = new Map<string, THREE.Matrix4>();
const BENCH = new THREE.Vector3(0, -150, 0); // Fin Ray 를 접어 놓는 작업대 오프셋 (최종 위치 기준)
let MAT_Z = FLOOR;
/** 최종 조립 → 매트 위 시작 자세 + 단계 분류 (설계 바꿀 때 다시 호출) */
function buildAnims() {
  anims.length = 0;
  group.clear();
  MAT_Z = FLOOR;
  // 매트 위 배치: 단계별로 줄을 나눠 앞쪽(-y) 에 펼침
  const rowY: Record<number, number> = { 5: -150, 6: -215, 7: -150, 8: -270, 9: -270, 10: -325, 11: -325 };
  const rowX: Record<number, number> = {};
  // 매트 위 배치: 단계별로 줄을 나눠 앞쪽(-y) 에 펼침
  // Fin Ray 손가락별 띠 순서 (contact c0..c9 → back b9..b0 → base) 를 직선으로 펼침
  finStart.clear();
    const finKeys = new Map<string, Part[]>();
  for (const p of finalAsm.parts) {
    const m = p.id.match(/^finray\.([FB])\.(c|b)(\d+)\.(R|L)$/) ?? p.id.match(/^finray\.([FB])\.(base)()\.(R|L)$/);
    if (m) {
      const key = `${m[1]}${m[4]}`;
      if (!finKeys.has(key)) finKeys.set(key, []);
      finKeys.get(key)!.push(p);
    }
  }
  let fi = 0;
  for (const [key, list] of finKeys) {
    const order = [
      ...list.filter((p) => /\.c\d/.test(p.id)).sort((a, b) => +a.id.match(/c(\d+)/)![1] - +b.id.match(/c(\d+)/)![1]),
      ...list.filter((p) => /\.b\d/.test(p.id)).sort((a, b) => +b.id.match(/b(\d+)/)![1] - +a.id.match(/b(\d+)/)![1]),
      ...list.filter((p) => /base/.test(p.id)),
    ];
    // 손가락마다 x 열 하나, 띠 조각을 y 방향으로 이어 붙여 펼침
    let yy = -110;
    for (const p of order) {
      const len = p.size[0];
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
      finStart.set(p.id, new THREE.Matrix4().compose(new THREE.Vector3(-250 + fi * 30, yy - len / 2, MAT_Z + 1.2), q, new THREE.Vector3(1, 1, 1)));
      yy -= len;
    }
    fi++;
  }

  for (const p of finalAsm.parts) {
    const step = stepOf(p);
    const mesh = new THREE.Mesh(isCyl(p) ? cylGeo : boxGeo, mat(p.kind, !!p.ghost));
    mesh.matrixAutoUpdate = false;
    const final = (p.m as unknown as THREE.Matrix4).clone();
    let start: THREE.Matrix4;
    if (finStart.has(p.id)) start = finStart.get(p.id)!;
    else {
      rowX[step] = rowX[step] ?? (step === 9 || step === 10 ? 40 : 60);
      const fr = flatRotation(p);
      const sz = isCyl(p) ? [p.size[0], p.size[1], p.size[1]] : p.size;
      const flatW = Math.max(sz[0], sz[1], sz[2]);
      const thick = Math.min(...sz);
      start = new THREE.Matrix4().compose(new THREE.Vector3(rowX[step] + flatW / 2, rowY[step], MAT_Z + thick / 2 + 0.3), fr.multiply(new THREE.Quaternion()), new THREE.Vector3(1, 1, 1));
      rowX[step] += flatW + 8;
      if (rowX[step] > 330) {
        rowX[step] = 60;
        rowY[step] -= 45;
      }
    }
    const a: Anim = { part: p, mesh, start, final, step };
    if (/^finray/.test(p.id)) a.bench = final.clone().premultiply(new THREE.Matrix4().makeTranslation(BENCH.x, BENCH.y, BENCH.z));
    anims.push(a);
    group.add(mesh);
  }
}
buildAnims();

// 매트 + 격자
const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(760, 520), new THREE.MeshStandardMaterial({ color: 0x2f6b5b, roughness: 1 }));
matMesh.position.set(40, -110, MAT_Z - 0.05);
scene.add(matMesh);
{
  const pts: number[] = [];
  for (let x = -340; x <= 420; x += 10) pts.push(x, -370, MAT_Z, x, 150, MAT_Z);
  for (let y = -370; y <= 150; y += 10) pts.push(-340, y, MAT_Z, 420, y, MAT_Z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd8efe6, transparent: true, opacity: 0.22 })));
}

// 실 (단계 11 에서 길이 방향으로 자라남)
const lineGroup = new THREE.Group();
scene.add(lineGroup);
function drawLines(asm: Assembly, frac: number) {
  lineGroup.clear();
  for (const l of asm.lines) {
    const color = l.kind === "string" ? 0x1b3a6b : l.kind === "rubber" ? 0xe4572e : 0x8e44ad;
    let total = 0;
    for (let i = 0; i < l.pts.length - 1; i++) total += l.pts[i].distanceTo(l.pts[i + 1]);
    let budget = total * frac;
    for (let i = 0; i < l.pts.length - 1 && budget > 0; i++) {
      const a = l.pts[i] as unknown as THREE.Vector3;
      let b = l.pts[i + 1] as unknown as THREE.Vector3;
      const seg = a.distanceTo(b);
      if (seg > budget) b = a.clone().lerp(b, budget / seg);
      budget -= seg;
      const len = a.distanceTo(b);
      if (len < 0.1) continue;
      const m = new THREE.Mesh(cylGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.scale.set(l.kind === "rubber" ? 1.6 : 1.1, len, l.kind === "rubber" ? 1.6 : 1.1);
      lineGroup.add(m);
    }
  }
}

// 동작 단계: 시뮬을 그대로 재생 (palm 고정, 바닥·물체가 올라옴)
const liveGroup = new THREE.Group();
scene.add(liveGroup);
const objMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
function drawLive(asm: Assembly) {
  liveGroup.clear();
  for (const p of asm.parts) {
    const m = new THREE.Mesh(isCyl(p) ? cylGeo : boxGeo, mat(p.kind, !!p.ghost));
    m.matrixAutoUpdate = false;
    m.matrix.copy(p.m as unknown as THREE.Matrix4).multiply(localScale(p));
    liveGroup.add(m);
  }
  const o = asm.object;
  if (o) {
    const s = o.shape;
    let mesh: THREE.Mesh;
    if (s.kind === "cyl") {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.len, 28), objMat(o.name === "battery" ? 0x6d7b8d : 0x222222));
      if (s.axis === "x") mesh.rotation.z = Math.PI / 2;
      else mesh.rotation.x = Math.PI / 2;
    } else if (s.kind === "ellip") {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14), objMat(0xf2c14e));
      mesh.scale.set(s.a, s.b, s.c3);
    } else mesh = new THREE.Mesh(new THREE.BoxGeometry(s.sx, s.sy, s.sz), objMat(0xc6d84f));
    mesh.position.copy(s.c as unknown as THREE.Vector3);
        liveGroup.add(mesh);
  }
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(500, 400), new THREE.MeshStandardMaterial({ color: 0x2f6b5b, roughness: 1 }));
  fl.position.set(0, 0, asm.floorZ - 0.05);
  liveGroup.add(fl);
  drawLines(asm, 1);
}

// ------------------------------------------------------------------ 보간
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
function blend(a: THREE.Matrix4, b: THREE.Matrix4, u: number, lift = 0) {
  const A = decompose(a);
  const B = decompose(b);
  P.lerpVectors(A.p, B.p, u);
  P.z += lift * Math.sin(Math.PI * u);
  Q.slerpQuaternions(A.q, B.q, u);
  return new THREE.Matrix4().compose(P.clone(), Q.clone(), new THREE.Vector3(1, 1, 1));
}
const stepWin = (n: number) => STEPS.find((s) => s.title.startsWith(`${n}.`))!;

// ------------------------------------------------------------------ 카메라 경로
function setCamera(t: number) {
  const r = stage.getBoundingClientRect();
  if (t >= 22 && t < 84) camera.setViewOffset(r.width, r.height, -r.width * 0.16, 0, r.width, r.height);
  else camera.clearViewOffset();
  let target = new THREE.Vector3(0, -60, FLOOR + 40);
  let pos = new THREE.Vector3(260, -620, 420);
  if (t >= 22 && t < 27) {
    target = new THREE.Vector3(40, -170, FLOOR);
    pos = new THREE.Vector3(60, -520, 380);
  } else if (t >= 27 && t < 70) {
    const u = (t - 27) / 43;
    const ang = -1.2 + u * 0.9;
    target = new THREE.Vector3(0, -40, -40 + u * 10);
    pos = new THREE.Vector3(Math.sin(ang) * -480, Math.cos(ang) * -480, 140 + 120 * (1 - u));
  } else if (t >= 70) {
    const u = Math.min(1, (t - 70) / 14);
    const ang = 0.4 + u * 0.8;
    target = new THREE.Vector3(0, 0, -55);
    pos = new THREE.Vector3(Math.sin(ang) * 330, -Math.cos(ang) * 330, 30);
  }
  camera.position.copy(pos);
  camera.lookAt(target);
}

// ------------------------------------------------------------------ 오버레이 (자막 + 2D 전개도)
const cap = document.getElementById("cap")!;
const capTitle = document.getElementById("capTitle")!;
const capCraft = document.getElementById("capCraft")!;
const capFeas = document.getElementById("capFeas")!;
const capLevel = document.getElementById("capLevel")!;
const sheetBox = document.getElementById("sheet")!;
const endCard = document.getElementById("end")!;
const timeEl = document.getElementById("time")!;
function fillEnd() {
  const h = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m} min`);
  const cutTot = FEAS.cutMin + 20; // 인쇄·붙이기 20 분
  const rows = FOLD
    ? ([
        [`인쇄·붙이기·자르기 (판 ${FEAS.boardPieces}장)`, cutTot, "가능 — 전량판, 따라 그리기 없음", true],
        ["Fin Ray 4개 (라이너 벗기기·리브)", 60, "가능 — 띠 1개 먼저 시험", true],
        ["손바닥·플랩·Fin Ray 붙이기", 20, "쉬움 — 레버·밑판 없음", true],
        ["접는 상자 2개", 30, "두 링크 길이만 맞으면 평행. 관절 테이프 수명은 실물 확인", false],
        ["손끝판·손톱", 20, "손톱 3겹 테이프 힌지", true],
        ["실·고무줄·조정", 25, "매듭 4개, 실 장력 약 10 N — 매끄러운 실", false],
      ] as [string, number, string, boolean][])
    : [
    [`인쇄·붙이기·자르기 (판 ${FEAS.boardPieces}장, 그중 원판 ${FEAS.circles})`, cutTot, "가능 — 2인 분담 시 절반", true],
    ["Fin Ray 4개 (라이너 벗기기·리브)", 60, "가능 — 띠 1개 먼저 시험", true],
    LEV ? ["손바닥·플랩·soft 레버", 25, "V자 레버 발 풀칠 + 삼각 보강 (원판 없음)", true] : ["손바닥·플랩·드럼", 30, "드럼 직각 접착 → 삼각 보강", false],
    ["브래킷·평행 링크" + (LEV ? "·hard 레버" : ""), LEV ? 50 : 60, LEV ? "구멍 간격 ±1 mm · 레버 끝 ↔ 안쪽 축 1 mm 확인" : "구멍 간격 ±1 mm — 링크 2장 겹쳐 함께 뚫기", false],
    ["커플러·손끝·긴 손톱", 30, "손끝판 8 mm + 손톱 14 mm — 손톱 3겹 필요", false],
    ["실·텐던·고무줄·조정", LEV ? 30 : 45, LEV ? "레버 끝 매듭 4개, 감기 없음" : "가능 — 매듭 대신 테이프 고정 후 조정", true],
  ] as [string, number, string, boolean][];
  const tot = rows.reduce((a, r) => a + r[1], 0);
  document.getElementById("endRows")!.innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${h(r[1])}</td><td class="${r[3] ? "ok" : "warn"}">${r[2]}</td></tr>`).join("");
  document.getElementById("endSum")!.innerHTML = `합계 약 <b>${(tot / 60).toFixed(1)} 시간 (1인)</b>, 2인이면 약 ${(tot / 60 / 1.7).toFixed(1)} 시간. 골판지 면적 ${FEAS.areaM2.toFixed(2)} m² → 택배상자 약 ${FEAS.boxes}–${FEAS.boxes + 1}개 + Fin Ray 용 여분. 그 외: 일반 빨대 ${FOLD ? "3개 (Fin Ray 리브만)" : "10개"}${LEV || FOLD ? "" : ", 버블티 빨대 2개"}, 고무줄, 실, 테이프, 목공풀. 시간은 모두 추정.`;
}
fillEnd();
let shownSheet = -1;
function showSheet(i: number) {
  if (shownSheet === i) return;
  shownSheet = i;
  sheetBox.innerHTML = sheets[i] ?? "";
  // 자르는 선 길이 계산해 dash 준비
  for (const el of sheetBox.querySelectorAll<SVGGeometryElement>(".cut, .score")) {
    const L = el.getTotalLength ? el.getTotalLength() : 100;
    el.style.strokeDasharray = `${L}`;
    el.style.strokeDashoffset = `${L}`;
    el.dataset.len = String(L);
  }
}
function animateSheet(u: number, phase: "cut" | "score") {
  const cuts = [...sheetBox.querySelectorAll<SVGGeometryElement>(".cut")];
  const scores = [...sheetBox.querySelectorAll<SVGGeometryElement>(".score")];
  const holes = [...sheetBox.querySelectorAll<SVGElement>(".hole, .cross")];
  const glue = [...sheetBox.querySelectorAll<SVGElement>(".glue")];
  const run = (els: SVGGeometryElement[], v: number) =>
    els.forEach((el, i) => {
      const L = +(el.dataset.len ?? 100);
      const local = Math.min(1, Math.max(0, v * els.length - i * 0.85));
      el.style.strokeDashoffset = `${L * (1 - local)}`;
    });
  if (phase === "cut") {
    run(cuts, u);
    run(scores, 0);
    holes.forEach((h) => (h.style.opacity = "0.25"));
    glue.forEach((g) => (g.style.opacity = "0.25"));
  } else {
    run(cuts, 1);
    run(scores, u);
    holes.forEach((h) => (h.style.opacity = String(0.25 + 0.75 * Math.min(1, u * 1.5))));
    glue.forEach((g) => (g.style.opacity = String(0.25 + 0.75 * Math.min(1, u * 1.5))));
  }
}

function setCaption(t: number) {
  const s = [...STEPS].reverse().find((x) => t >= x.t0) ?? STEPS[0];
  capTitle.textContent = s.title;
  capCraft.textContent = s.craft;
  capFeas.textContent = s.feas;
  capFeas.hidden = !s.feas;
  capLevel.textContent = s.t0 > 0 && s.t0 < 84 ? `난이도 ${"●".repeat(s.level)}${"○".repeat(3 - s.level)}` : "";
  cap.hidden = t >= 84;
  endCard.hidden = t < 84;
  timeEl.textContent = `${t.toFixed(1)} / ${T_END} s`;
}

// ------------------------------------------------------------------ 메인 렌더
function render(t: number) {
  blockGroup.visible = false;
  setCaption(t);
  const in2D = t >= T_PATTERN[0] && t < T_PATTERN[1];
  sheetBox.hidden = !in2D;
  if (in2D) {
    const page = Math.min(sheets.length - 1, Math.floor(((t - 4) / 18) * sheets.length));
    showSheet(page);
    const local = ((t - 4) / 18) * sheets.length - page;
    if (t < 16) animateSheet(Math.min(1, local / 0.8), local < 0.8 ? "cut" : "score");
    else animateSheet(1, "score");
  }
  setCamera(t);
  const live = t >= 70;
  group.visible = !live;
  liveGroup.visible = live;
  if (!live) {
    for (const a of anims) {
      let m: THREE.Matrix4;
      if (a.step === 6) {
        const w1 = stepWin(6);
        const w2 = stepWin(7);
        if (t < w1.t0) m = a.start;
        else if (t < w2.t0) m = blend(a.start, a.bench!, ease((t - w1.t0) / (w1.t1 - w1.t0 - 1)), /rib/.test(a.part.id) ? 60 : 25);
        else m = blend(a.bench!, a.final, ease((t - w2.t0) / (w2.t1 - w2.t0 - 1)), 30);
      } else {
        const w = a.step === 11 ? stepWin(11) : stepWin(a.step);
        m = blend(a.start, a.final, ease((t - w.t0) / (w.t1 - w.t0 - 1.5)), 70);
      }
      a.mesh.matrix.copy(m).multiply(localScale(a.part));
      const w = stepWin(Math.min(a.step, 11));
      const active = t >= w.t0 && t < w.t1;
      (a.mesh.material as THREE.Material) = mat(a.part.kind, !!a.part.ghost, active && !a.part.ghost);
    }
    const w11 = stepWin(11);
    drawLines(finalAsm, ease((t - w11.t0) / (w11.t1 - w11.t0 - 1)));
    lineGroup.visible = t >= w11.t0;
    matMesh.visible = true;
  } else {
    // 동작: 건전지 (70–77), 감자칩 (77–84)
    const battery = t < 77;
    const u = battery ? (t - 70) / 7 : (t - 77) / 7;
    const base = design.preset(battery ? "rigid" : "soft", battery ? "battery" : "chip");
    const open = design.preset("open", null);
    const descend = ease(Math.min(1, u / 0.35));
    const close = ease(Math.min(1, Math.max(0, (u - 0.35) / 0.45)));
    const ctrl = {
      ...base,
      palmH: open.palmH + (base.palmH - open.palmH) * descend + 25 * (1 - descend),
      a: battery ? base.a * close : base.a * close,
      b: battery ? close : 0,
    };
    drawLive(design.build(ctrl));
    matMesh.visible = false;
  }
  renderer.render(scene, camera);
}

function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ================================================================== 블록별 조립
interface BStep {
  t0: number;
  t1: number;
  match: RegExp;
  from: [number, number, number]; // 분해(exploded) 위치 오프셋
  cap: string;
}
interface Block {
  id: string;
  title: string;
  dur: number;
  /** 이 블록에 속하는 최종 부품 */
  parts: (p: Part) => boolean;
  lines: RegExp | null;
  steps: BStep[];
  /** 동작 구간: [시작, 컨트롤 함수] */
  act?: [number, (u: number) => { a: number; b: number; obj: "battery" | "chip" | null }];
  feas: string;
  custom?: (t: number, g: THREE.Group) => void;
}
const R_ = (s: string) => new RegExp(s);
const isSoftR = (p: Part) => (p.body === "flapR" || /^(palm$|softStop1)/.test(p.id)) && !p.ghost;
const isHardF = (p: Part) => (/^hardF/.test(p.body) || (p.body === "palm" && /\.F$/.test(p.id) && !/finray/.test(p.id)) || p.id === "palm") && !p.ghost;
// B5E: 블록 A = V자 레버 만들기 (원판 대신)
const LEVER_BLOCK: Block = {
  id: "drum",
  title: "A. V자 레버 만들기 (hard 레버 r16 기준)",
  dur: 10,
  parts: () => false,
  lines: null,
  steps: [
    { t0: 0, t1: 3, match: R_("x"), from: [0, 0, 0], cap: "V자 판 3장 (팔 16 · 발 26 · 사이각 128°) 을 전개도대로 자름 — 직선 위주, 원판 없음" },
    { t0: 3, t1: 6, match: R_("x"), from: [0, 0, 0], cap: "3장 겹쳐 풀칠 (두께 9). 꼭짓점 구멍에 빨대 = 바깥 축" },
    { t0: 6, t1: 10, match: R_("x"), from: [0, 0, 0], cap: "팔 끝 구멍(Ø1.5)에 실을 꿰어 매듭 → 감기 없음. 발은 바깥 링크 막대 사이에 면 접착" },
  ],
  feas: "중심 맞춤·홈·감기가 없어 드럼보다 쉬움. soft 레버(팔 26 · 발 16, 2겹)도 같은 방법",
  custom: (t, g) => {
    const arm = 16;
    const foot = 26;
    const w = 8;
    const al = (128 * Math.PI) / 180;
    const shape = new THREE.Shape();
    // V 윤곽 (팔 = +u, 발 = 사이각 al 방향)
    const f = [Math.cos(al), Math.sin(al)];
    const nf = [Math.sin(al), -Math.cos(al)];
    const hw = w / 2;
    const tt = (hw * (1 + Math.cos(al))) / Math.sin(al);
    const pts: [number, number][] = [[arm + hw, -hw], [arm + hw, hw], [tt * f[0] + hw * nf[0], tt * f[1] + hw * nf[1]], [foot * f[0] + hw * nf[0], foot * f[1] + hw * nf[1]], [foot * f[0] - hw * nf[0], foot * f[1] - hw * nf[1]]];
    for (let i = 0; i <= 8; i++) {
      const th = al + Math.PI / 2 + ((1.5 * Math.PI - al - Math.PI / 2) * i) / 8;
      pts.push([hw * Math.cos(th), hw * Math.sin(th)]);
    }
    shape.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) shape.lineTo(q[0], q[1]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    const u = ease(Math.min(1, Math.max(0, (t - 3) / 2.5)));
    [-1, 0, 1].forEach((k) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: k === 0 ? 0x8a6038 : 0x9c7046, roughness: 0.85 }));
      m.rotation.y = Math.PI / 2; // 판 두께 → world x
      m.position.set(k * 3 - 1.5 + (1 - u) * k * 30, 0, 0);
      g.add(m);
    });
    if (t >= 3) {
      const st = new THREE.Mesh(cylGeo, mat("straw", false));
      st.scale.set(6, 50, 6);
      st.rotation.z = Math.PI / 2;
      g.add(st);
    }
    if (t >= 6) {
      // 팔 끝 (local (arm, 0)) → world: rotation.y=π/2 로 local x → world −z
      const tip = new THREE.Vector3(0, 0, -arm);
      const wv = ease(Math.min(1, (t - 6.5) / 2.5));
      const pts3 = [tip.clone(), tip.clone().add(new THREE.Vector3(0, 0, -2)), tip.clone().add(new THREE.Vector3(0, 6, -4 - 30 * wv))];
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3), 40, 0.8, 6, false);
      g.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: 0x8e44ad })));
      const knot = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8e44ad }));
      knot.position.copy(tip).add(new THREE.Vector3(2, 0, 0));
      g.add(knot);
    }
  },
};
// B6P: 블록 A = 접는 상자 만들기 (펼친 띠 → 납작한 상자 → 기울기)
const FOLD_BLOCK: Block = {
  id: "drum",
  title: "A. 접는 상자 만들기 (hard 손가락 1개)",
  dur: 10,
  parts: () => false,
  lines: null,
  steps: [
    { t0: 0, t1: 2.5, match: R_("x"), from: [0, 0, 0], cap: "띠 1장: 윗변 24 · 바깥 링크 75 · 아랫변 24 · 안쪽 링크 75 · 탭 12 — 접는 선 4개를 깊게 누르고 바깥 면 테이프" },
    { t0: 2.5, t1: 6, match: R_("x"), from: [0, 0, 0], cap: "접어서 납작한 상자로: 끝 탭을 윗변 안쪽 끝에 겹쳐 풀칠 → 그다음 윗변을 손바닥 아랫면에 풀칠" },
    { t0: 6, t1: 10, match: R_("x"), from: [0, 0, 0], cap: "옆으로 밀면 평행사변형으로 기움 → 아랫변은 항상 수평 = 손끝판 항상 수직" },
  ],
  feas: "핀·빨대 구멍 0. 두 링크 길이(75)만 같으면 평행",
  custom: (t, g) => {
    const d = 24;
    const L = 75;
    const W = 24;
    const u = ease(Math.min(1, Math.max(0, (t - 2.5) / 3)));
    const sk = ease(Math.min(1, Math.max(0, (t - 6) / 2.5)));
    const ang = (Math.sin(t * 1.2) * 0.5 + 0.5) * 30 * sk * (Math.PI / 180) + (10 * Math.PI) / 180 * u;
    // 접힌 상자 꼭짓점 (y–z): 윗변 (0,0)-(d,0), 바깥 링크 (d,0)→(d+s,−c), 아랫변 → (s,−c), 안쪽 링크 → (0,0), 탭 (0,0)→(12,0)
    const s = L * Math.sin(ang);
    const c = L * Math.cos(ang);
    const fold: [number, number][] = [[0, 0], [d, 0], [d + s, -c], [s, -c], [0, 0], [12, 0]];
    const flat: [number, number][] = [[0, 0], [d, 0], [d + L, 0], [2 * d + L, 0], [2 * d + 2 * L, 0], [2 * d + 2 * L + 12, 0]];
    const raw = fold.map((f, i) => [flat[i][0] + (f[0] - flat[i][0]) * u, flat[i][1] + (f[1] - flat[i][1]) * u] as [number, number]);
    // 화면 가운데로 (카메라는 원점을 봄)
    const cy = (Math.min(...raw.map((q) => q[0])) + Math.max(...raw.map((q) => q[0]))) / 2;
    const cz = (Math.min(...raw.map((q) => q[1])) + Math.max(...raw.map((q) => q[1]))) / 2;
    const pts = raw.map((q) => [q[0] - cy + 60, q[1] - cz - 40] as [number, number]);
    const cols = [0xe0a24a, 0x9c7046, 0x8a6038, 0x9c7046, 0xe0a24a];
    for (let i = 0; i < 5; i++) {
      const a = new THREE.Vector3(0, pts[i][0] - 60, pts[i][1] + 40);
      const b = new THREE.Vector3(0, pts[i + 1][0] - 60, pts[i + 1][1] + 40);
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.85 }));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.scale.set(W, Math.max(len, 0.5), 3);
      g.add(m);
    }
    // 관절 테이프 (접는 선 4개)
    for (const i of [1, 2, 3, 4]) {
      const tp = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xd9d9d9 }));
      tp.position.set(0, pts[i][0] - 60, pts[i][1] + 40);
      tp.scale.set(W + 1, 4, 4);
      g.add(tp);
    }
  },
};
function makeBlocks(): Block[] {
  return FOLD ? blocksB6P() : makeBlocksBase();
}
function makeBlocksBase(): Block[] {
  return [
    LEV ? LEVER_BLOCK : 
  {
    id: "drum",
    title: "A. 원형 드럼 만들기 (hard 드럼 r16 기준)",
    dur: 10,
    parts: () => false,
    lines: null,
    steps: [
      { t0: 0, t1: 3, match: R_("x"), from: [0, 0, 0], cap: "원판 3장 (큰 r16 – 작은 r13 – 큰 r16) 을 잘라 중심에 송곳 구멍" },
      { t0: 3, t1: 6, match: R_("x"), from: [0, 0, 0], cap: "빨대를 지그로 꽂아 중심 맞춰 풀칠 → 가운데 3 mm 홈" },
      { t0: 6, t1: 10, match: R_("x"), from: [0, 0, 0], cap: "홈 바닥 테이프 1바퀴 → 큰판 가장자리 구멍에 실 매듭 → 홈에 1바퀴 감기" },
    ],
    feas: "원은 짧은 직선으로 끊어 자르고 다듬기. 지름 32 mm 정도는 커터칼로 충분",
    custom: (t, g) => {
      const R = 16;
      const disk = (r: number, x: number, color: number) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
        m.rotation.z = Math.PI / 2;
        m.position.set(x, 0, 0);
        g.add(m);
      };
      const u = ease(Math.min(1, Math.max(0, (t - 3) / 2.5)));
      const xs = [-3, 0, 3].map((x0, i) => x0 + (1 - u) * (i - 1) * 30);
      disk(R, xs[0], 0x9c7046);
      disk(R - 3, xs[1], 0x8a6038);
      disk(R, xs[2], 0x9c7046);
      if (t >= 3) {
        const st = new THREE.Mesh(cylGeo, mat("straw", false));
        st.scale.set(6, 70, 6);
        st.rotation.z = Math.PI / 2;
        g.add(st);
      }
      if (t >= 6) {
        // 홈 테이프 + 실 1바퀴 + 위로
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 3 + 0.3, 0.6, 8, 48), new THREE.MeshStandardMaterial({ color: 0xdedede }));
        ring.rotation.y = Math.PI / 2;
        g.add(ring);
        const w = ease(Math.min(1, (t - 6.5) / 2.5));
        const pts: THREE.Vector3[] = [];
        const turns = 1 * w;
        for (let i = 0; i <= 60; i++) {
          const a = -Math.PI / 2 + (turns * 2 * Math.PI * i) / 60;
          pts.push(new THREE.Vector3(0, (R - 2) * Math.cos(a), (R - 2) * Math.sin(a)));
        }
        pts.push(new THREE.Vector3(0, -(R - 2), 40 * w));
        const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.8, 6, false);
        g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1b3a6b })));
      }
    },
  },
  {
    id: "finray",
    title: "B. Fin Ray 1개 접기",
    dur: 9,
    parts: (p) => /^finray\.F\.(c\d|b\d|rib\d|base)\.R$/.test(p.id),
    lines: null,
    steps: [
      { t0: 0, t1: 4, match: R_("finray\\.F\\.(c|b)\\d|base"), from: [0, 0, -70], cap: "단면 골판지 띠: 접는 선 3곳에서 삼각형으로 접고 탭 풀칠 (contact flank 가 물체 쪽)" },
      { t0: 4, t1: 7, match: R_("rib"), from: [0, -40, 20], cap: "빨대 리브 4개 (22/17/11/6 mm) 를 R2–R8 표시에, 양끝 테이프 힌지 (회전해야 Fin Ray 거동)" },
      { t0: 7, t1: 9, match: R_("base"), from: [0, 0, 0], cap: "밑판을 붙여 완성 → 플랩 끝에 수직으로" },
    ],
    feas: "Fin Ray 4개 × 약 10분. 리브 테이프가 너무 단단하면 Fin Ray 가 안 휨",
  },
  {
    id: "soft",
    title: "C. Soft 플랩 모듈 (오른쪽)",
    dur: 13,
    parts: isSoftR,
    lines: /^(stringA|returnA)\.R$/,
    steps: [
      { t0: 0, t1: 2.5, match: R_("^(palm|flap)"), from: [0, 0, -60], cap: "윗장(플랩 포함) + 아랫장(좌우 1.5 mm 좁게) 풀칠. 플랩은 score 선에서 접힘 = 힌지" },
      { t0: 2.5, t1: 4, match: R_("softStop"), from: [0, 0, -50], cap: "닫힘 스토퍼 블록: 손바닥 아랫면 — 플랩이 −8° 에서 기댐" },
      LEV
        ? { t0: 4, t1: 5.5, match: R_("^lever"), from: [40, 0, 40], cap: "soft 레버(V자 2겹): 꼭짓점 = 힌지선, 발을 플랩 바깥면에 세워 풀칠 + 삼각 보강 — 팔은 손바닥 슬롯을 지나 윗면 위로" }
        : { t0: 4, t1: 5.5, match: R_("^drum"), from: [40, 0, 40], cap: "soft 드럼(r13, 3장) 을 플랩 바깥 힌지선에 세워 붙이고 삼각 보강 — 아래 절반은 손바닥 슬롯 통과" },
      { t0: 5.5, t1: 7.5, match: R_("^finray"), from: [60, 0, -40], cap: "Fin Ray 2개를 플랩 끝에 밑판으로 고정 (contact flank 안쪽)" },
      { t0: 7.5, t1: 8.5, match: R_("zzz"), from: [0, 0, 0], cap: LEV ? "실 A: 레버 끝 구멍에 매듭 → 위로 (감기 없음) · 복원 고무줄(약하게): 플랩 ↔ 손바닥 구멍" : "실 A: 드럼 매듭 → 1/2바퀴 → 안쪽 접선에서 위로 · 복원 고무줄: 플랩 ↔ 손바닥 구멍" },
    ],
    act: [8.5, (u) => ({ a: u < 0.5 ? u * 2 : 2 - u * 2, b: 0, obj: null })],
    feas: LEV ? "레버 발 직각 접착 → 삼각 보강 2개. 레버가 손바닥에 닿는 약 35° 가 열림 스토퍼" : "드럼 직각 접착이 약점 → 삼각 보강 2개",
  },
  {
    id: "hard",
    title: "D. Hard 손가락 (앞쪽) — 평행 링크",
    dur: 17,
    parts: isHardF,
    lines: /^(returnB)\.F$/,
    steps: [
      { t0: 0, t1: 2.5, match: R_("^(palm$|bracket|gusset)"), from: [0, 0, -50], cap: "브래킷 2장: 탭을 접어 손바닥 아랫면에 평행하게 풀칠 + 삼각 보강" },
      { t0: 2.5, t1: 3.5, match: R_("^axle"), from: [60, 0, 0], cap: "축 빨대 2개 (안쪽·바깥). 구멍은 시험편으로 고른 지름" },
      { t0: 3.5, t1: 6, match: R_("^(linkOut|drum|lever)"), from: [0, 0, -45], cap: LEV ? "바깥 링크 막대 2개 사이에 hard 레버 발(3겹)을 끼워 면 풀칠 → 토크는 골판지로, 빨대는 핀만" : "바깥 링크 막대 2개 사이에 드럼을 끼워 면 풀칠 → 토크는 골판지로, 빨대는 핀만" },
      { t0: 6, t1: 7.5, match: R_("^linkIn"), from: [0, 30, -45], cap: `안쪽 링크 막대 2개 (${LEV ? "레버" : "드럼"} 양옆, 같은 평면). 바깥 막대와 겹쳐 함께 뚫어 구멍 간격 일치` },
      { t0: 7.5, t1: 10.5, match: R_("^(coupler|pin|tipPlate|pad|nail)"), from: [0, -20, -60], cap: "커플러 측판 + 손끝판 + 핀 2개 → 평행사변형. 긴 손톱(3겹) 테이프 힌지 + 스토퍼" },
      { t0: 10.5, t1: 11.5, match: R_("^stopTab"), from: [40, 0, 0], cap: "열림 스토퍼 탭 (브래킷 안쪽 면) + 복원 고무줄" },
    ],
    act: [11.5, (u) => ({ a: 0, b: u < 0.55 ? u / 0.55 : 1 - (u - 0.55) / 0.45, obj: "battery" })],
    feas: LEV ? "구멍 간격 ±1 mm · 레버 끝 ↔ 안쪽 축 여유 1 mm — 손으로 끝까지 돌려 확인" : "구멍 간격 ±1 mm 가 평행도를 좌우 — 손으로 돌려 손끝판이 수직인지 확인",
  },
  {
    id: "strings",
    title: "E. 실 연결 + 전체 동작",
    dur: 14,
    parts: (p) => !p.ghost,
    lines: /./,
    steps: [{ t0: 0, t1: 4, match: R_("zzz"), from: [0, 0, 0], cap: LEV ? "실 A (파랑): 좌·우 레버 끝 → 균형막대 → 직렬 고무줄 → 손잡이 · 텐던(보라): 앞 레버 끝 → 손바닥 구멍 → 손잡이 → 뒤 레버 끝 (1가닥 루프)" : "실 A (파랑): 좌·우 드럼 → 균형막대 → 직렬 고무줄 → 손잡이 · 텐던(보라): 앞 드럼 → 손잡이/모터 → 뒤 드럼 (1가닥 루프)" }],
    act: [4, (u) => ({ a: Math.min(1, u * 2), b: Math.max(0, Math.min(1, (u - 0.3) * 2)), obj: "battery" })],
    feas: "실 길이 맞추기는 매듭 대신 테이프 임시 고정 → 전 범위 동작 확인 후 매듭",
  },
];
}
function blocksB6P(): Block[] {
  const base = makeBlocksBase();
  const fin = base.find((b) => b.id === "finray")!;
  const str = base.find((b) => b.id === "strings")!;
  return [
    FOLD_BLOCK,
    fin,
    {
      id: "soft",
      title: "C. Soft 플랩 모듈 (오른쪽)",
      dur: 12,
      parts: isSoftR,
      lines: /^(stringA|returnA)\.R$/,
      steps: [
        { t0: 0, t1: 2.5, match: R_("^(palm|flap)"), from: [0, 0, -60], cap: "윗장(플랩 포함) + 아랫장(좌우 1.5 mm 좁게) 풀칠. 플랩은 접는 선 = 힌지. 매듭 구멍은 접는 선에서 14 mm" },
        { t0: 2.5, t1: 4, match: R_("softStop"), from: [0, 0, -50], cap: "닫힘 스토퍼 블록 (실 경로 y=0 을 피해 뒤쪽): 플랩이 −8° 에서 기댐" },
        { t0: 4, t1: 6.5, match: R_("^finray"), from: [60, 0, -40], cap: "Fin Ray 2개: 앞 탭을 플랩 안쪽 면 빗금 자리에 풀칠 → contact 면이 플랩과 한 줄" },
        { t0: 6.5, t1: 7.5, match: R_("zzz"), from: [0, 0, 0], cap: "실: 플랩 매듭 → 손바닥 구멍 → 위 (좌·우 한 가닥) · 복원 고무줄: 플랩 ↔ 손바닥 구멍" },
      ],
      act: [7.5, (uu) => ({ a: uu < 0.5 ? uu * 2 : 2 - uu * 2, b: 0, obj: null })],
      feas: "레버·밑판 없음 — 매듭 하나로 구동",
    },
    {
      id: "hard",
      title: "D. Hard 손가락 (앞쪽) — 접는 상자",
      dur: 13,
      parts: isHardF,
      lines: /^(returnB)\.F$/,
      steps: [
        { t0: 0, t1: 2.5, match: R_("^(palm$|foldTop)"), from: [0, 0, -50], cap: "접는 상자 윗변을 손바닥 아랫면 빗금 자리에 풀칠" },
        { t0: 2.5, t1: 5.5, match: R_("^(foldOut|foldIn|foldBot)"), from: [0, 0, -45], cap: "미리 접어 둔 상자의 바깥 링크·아랫변·안쪽 링크 (관절 = 접는 선 + 테이프). 안쪽 링크가 가운데 쪽" },
        { t0: 5.5, t1: 8.5, match: R_("^(tipPlate|pad|nail)"), from: [0, -20, -60], cap: "ㄱ자 손끝판(2겹)을 아랫변 밑 안쪽 끝에 + 삼각 보강. 손톱(3겹) 테이프 힌지 + 스토퍼" },
        { t0: 8.5, t1: 9.5, match: R_("zzz"), from: [0, 0, 0], cap: "안쪽 링크 '매듭' 구멍에 실 → 손바닥 가운데 구멍 · 복원 고무줄" },
      ],
      act: [9.5, (uu) => ({ a: 0, b: uu < 0.55 ? uu / 0.55 : 1 - (uu - 0.55) / 0.45, obj: "battery" })],
      feas: "손으로 기울여 손끝판이 수직인지 확인 — 기울면 두 링크 길이 차이",
    },
    { ...str, steps: [{ t0: 0, t1: 4, match: R_("zzz"), from: [0, 0, 0], cap: "soft 실(파랑): 좌 매듭 → 구멍 → 손잡이 → 구멍 → 우 매듭 · hard 실(보라): 앞 매듭 → 가운데 구멍 → 손잡이 → 뒤 매듭 (각각 한 가닥)" }] },
  ];
}
let BLOCKS: Block[] = makeBlocks();
let mode: "full" | "blocks" = "full";
let blockIdx = 0;
const blockGroup = new THREE.Group();
scene.add(blockGroup);
const anchorsOf = () => {
  const m = new Map<string, THREE.Vector3>();
  for (const b of BLOCKS) {
    const ps = finalAsm.parts.filter(b.parts);
    const c = new THREE.Vector3();
    for (const p of ps) c.add(decompose(p.m as unknown as THREE.Matrix4).p);
    m.set(b.id, ps.length ? c.multiplyScalar(1 / ps.length) : new THREE.Vector3());
  }
  return m;
};
let blockAnchor = anchorsOf();
function renderBlock(t: number) {
  const b = BLOCKS[blockIdx];
  blockGroup.clear();
  const st = [...b.steps].reverse().find((s) => t >= s.t0) ?? b.steps[0];
  const inAct = b.act && t >= b.act[0];
  capTitle.textContent = b.title;
  capCraft.textContent = inAct ? "동작 확인 (시뮬 재생)" : st.cap;
  capFeas.textContent = b.feas;
  capFeas.hidden = false;
  capLevel.textContent = "";
  cap.hidden = false;
  endCard.hidden = true;
  sheetBox.hidden = true;
  timeEl.textContent = `${t.toFixed(1)} / ${b.dur} s`;
  group.visible = false;
  liveGroup.visible = false;
  lineGroup.visible = false;
  matMesh.visible = false;
  blockGroup.visible = true;
  // 카메라
  const anc = blockAnchor.get(b.id)!;
  const dist = b.id === "drum" ? (FOLD ? 300 : 110) : b.id === "finray" ? 190 : b.id === "strings" ? 420 : 260;
  const az = b.id === "hard" ? 0.9 : b.id === "soft" ? -0.25 : FOLD && b.id === "drum" ? 1.35 : -0.6;
  const target = b.id === "drum" ? new THREE.Vector3() : anc.clone();
  camera.clearViewOffset();
  const r0 = stage.getBoundingClientRect();
  camera.setViewOffset(r0.width, r0.height, -r0.width * 0.16, 0, r0.width, r0.height);
  camera.position.set(target.x + Math.sin(az) * dist, target.y - Math.cos(az) * dist, target.z + dist * 0.35);
  camera.lookAt(target);
  if (b.custom) {
    blockGroup.position.set(0, 0, 0);
    b.custom(t, blockGroup);
    renderer.render(scene, camera);
    return;
  }
  let asm = finalAsm;
  if (inAct) {
    const u = Math.min(1, (t - b.act![0]) / (b.dur - b.act![0]));
    const c = b.act![1](u);
    const base = c.obj ? design.preset("rigid", c.obj) : design.preset("open", null);
    asm = design.build({ ...base, a: b.id === "hard" ? 0 : c.a * base.a + (b.id === "soft" ? c.a * (1 - base.a) : 0), b: c.b, obj: c.obj, palmH: c.obj ? base.palmH : finalAsm.floorZ * -1 });
  }
  const finSteps = b.id === "finray";
  for (const p of asm.parts) {
    if (!b.parts(p)) continue;
    const id = p.id.replace(/\.(R|L|F|B)$/, "");
    let m = (p.m as unknown as THREE.Matrix4).clone();
    if (!inAct) {
      const s = b.steps.find((x) => x.match.test(id));
      if (finSteps && /^finray/.test(p.id) && !/rib|base/.test(p.id)) {
        // 띠: 평평한 매트 위 → 접힌 삼각형 (최종 위치 근처)
        const s0 = finStart.get(p.id);
        const fin = m.clone();
        const flat = s0 ? s0.clone().premultiply(new THREE.Matrix4().makeTranslation(anc.x + 250, anc.y + 110, anc.z - MAT_Z - 40)) : fin;
        const u = ease((t - 0) / 3.5);
        m = blend(flat, fin, u, 20);
      } else if (s) {
        if (t < s.t0) continue;
        const u = ease((t - s.t0) / Math.max(0.5, s.t1 - s.t0 - 0.3));
        const from = m.clone().premultiply(new THREE.Matrix4().makeTranslation(...s.from));
        m = blend(from, m, u, 0);
      }
    }
    const active = !inAct && b.steps.some((x) => x.match.test(id) && t >= x.t0 && t < x.t1);
    const mesh = new THREE.Mesh(isCyl(p) ? cylGeo : boxGeo, mat(p.kind, false, active));
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(m).multiply(localScale(p));
    blockGroup.add(mesh);
  }
  // 실
  if (b.lines) {
    const lastStep = b.steps[b.steps.length - 1];
    const frac = inAct ? 1 : ease((t - lastStep.t0) / Math.max(0.5, lastStep.t1 - lastStep.t0));
    if (frac > 0 && (inAct || t >= lastStep.t0)) {
      const sub = { ...asm, lines: asm.lines.filter((l) => b.lines!.test(l.id)) };
      drawLines(sub as Assembly, frac);
      lineGroup.visible = true;
    }
  }
  if (inAct && asm.object) {
    const o = asm.object;
    const s = o.shape;
    if (s.kind === "cyl") {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.len, 28), objMat(0x6d7b8d));
      if (s.axis === "x") mesh.rotation.z = Math.PI / 2;
      mesh.position.copy(s.c as unknown as THREE.Vector3);
      blockGroup.add(mesh);
    }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshStandardMaterial({ color: 0x2f6b5b, roughness: 1 }));
    fl.position.set(0, 0, asm.floorZ - 0.05);
    blockGroup.add(fl);
  }
  renderer.render(scene, camera);
}

// 결정적 렌더 (캡처용): mode=full 이면 전체, blocks 면 ?block=id
(window as unknown as { __render: (t: number) => void; __T: number; __setBlock: (id: string) => number }).__render = (t: number) => {
  resize();
  if (mode === "blocks") renderBlock(t);
  else render(t);
};
(window as unknown as { __T: number }).__T = T_END;
(window as unknown as { __setBlock: (id: string) => number }).__setBlock = (id: string) => {
  mode = "blocks";
  blockIdx = Math.max(0, BLOCKS.findIndex((b) => b.id === id));
  return BLOCKS[blockIdx].dur;
};

// ------------------------------------------------------------------ 탭 + 재생 UI
const scrub = document.getElementById("scrub") as HTMLInputElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
let playing = !new URLSearchParams(location.search).has("capture");
let t = 0;
let last = performance.now();
const durNow = () => (mode === "blocks" ? BLOCKS[blockIdx].dur : T_END);
const draw = () => (mode === "blocks" ? renderBlock(t) : render(t));
playBtn.onclick = () => {
  playing = !playing;
  playBtn.textContent = playing ? "일시정지" : "재생";
  if (t >= durNow()) t = 0;
};
playBtn.textContent = playing ? "일시정지" : "재생";
scrub.oninput = () => {
  t = +scrub.value;
  draw();
};
const chapters = document.getElementById("chapters")!;
function buildChapters() {
  chapters.innerHTML = "";
  if (mode === "full") {
    for (const s of STEPS.slice(1)) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.title.split(" ")[0].replace(".", "") || "끝";
      b.title = s.title;
      b.onclick = () => {
        t = s.t0 + 0.01;
        draw();
      };
      chapters.append(b);
    }
  } else {
    BLOCKS.forEach((bl, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = bl.title.split(" (")[0];
      b.setAttribute("aria-pressed", String(i === blockIdx));
      b.onclick = () => {
        blockIdx = i;
        t = 0;
        playing = true;
        playBtn.textContent = "일시정지";
        buildChapters();
        scrub.max = String(durNow());
        draw();
      };
      chapters.append(b);
    });
  }
}
// 탭 (hash): full / blocks / sections / patterns
const TABS = ["full", "blocks", "sections", "video", "patterns", "manual"];
const playerBox = document.getElementById("player")!;
function route() {
  const hsh = location.hash.slice(1);
  const tab = TABS.includes(hsh) ? hsh : "full";
  for (const a of document.querySelectorAll<HTMLAnchorElement>("nav.tabs a")) {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  playerBox.hidden = !(tab === "full" || tab === "blocks");
  document.getElementById("page-sections")!.hidden = tab !== "sections";
  document.getElementById("page-patterns")!.hidden = tab !== "patterns";
  document.getElementById("page-video")!.hidden = tab !== "video";
  document.getElementById("page-manual")!.hidden = tab !== "manual";
  if (tab !== "video") (document.getElementById("vid") as HTMLVideoElement).pause();
  if (tab === "full" || tab === "blocks") {
    const newMode = tab as "full" | "blocks";
    if (newMode !== mode) {
      mode = newMode;
      t = 0;
      playing = true;
      playBtn.textContent = "일시정지";
    }
    group.visible = mode === "full";
    blockGroup.visible = mode === "blocks";
    scrub.max = String(durNow());
    buildChapters();
    resize();
    draw();
  }
}
window.addEventListener("hashchange", route);
// 단면도 + 전개도 페이지 채우기
const NAMES: Record<DId, string> = { B6P: "B6P 쉬운 버전 (접는 상자)", B5N: "B5N 기준 (드럼)", B5E: "B5E 보관 (레버)" };
// 영상·PDF 경로: Artifact 는 media/ (publish 의 files), docs/site 는 빌드가 window.__MEDIA 로 레포 상대 경로를 넣음
const MEDIA: Record<DId, { video: string; pdf: string }> = (window as unknown as { __MEDIA?: Record<DId, { video: string; pdf: string }> }).__MEDIA ?? {
  B6P: { video: "media/B6P-assembly.mp4", pdf: "media/B6P-pattern-A4.pdf" },
  B5E: { video: "media/B5E-assembly.mp4", pdf: "media/B5E-pattern-A4.pdf" },
  B5N: { video: "media/B5N-assembly.mp4", pdf: "media/B5N-pattern-A4.pdf" },
};
// 제작 설명서: B6P → docs/B6P-제작설명서.md, B5E → docs/B5E-제작설명서.md (B5N 은 B5E 설명서 + 부록)
// 사진: Artifact 는 media/manual/ (publish 의 files), docs/site 는 빌드가 window.__IMG_BASE 로 레포 경로
function fillManual() {
  const id: "B6P" | "B5E" = DESIGN_ID === "B6P" ? "B6P" : "B5E";
  const figs = Object.fromEntries(DIAGRAMS(id).map((d) => [d.id, d]));
  const imgBase = (window as unknown as { __IMG_BASE?: string }).__IMG_BASE ?? "media/manual/";
  const note = DESIGN_ID === "B5N" ? `<p class="note">B5N 전용 설명서는 없어요. B5E 설명서의 '부록: B5N(드럼)으로 바꿀 때'를 보세요.</p>` : "";
  document.getElementById("manual")!.innerHTML = note + mdToHtml(id === "B6P" ? manualB6P : manualB5E, figs, imgBase);
}
function fillPages() {
  fillManual();
  document.getElementById("sections")!.innerHTML = DIAGRAMS(DESIGN_ID)
    .map((d) => `<figure class="fig"><figcaption>${d.title}</figcaption>${d.svg}</figure>`)
    .join("");
  document.getElementById("patternSheets")!.innerHTML = sheets.map((s) => `<div class="pg">${s}</div>`).join("");
  document.getElementById("patternBom")!.innerHTML = `<p><b>재료·실 경로</b></p><ul>${pattern.cutList.map((c) => `<li>${c}</li>`).join("")}</ul><p><b>조립 순서</b></p><ol>${pattern.steps.map((c) => `<li>${c}</li>`).join("")}</ol>`;
  document.getElementById("hdrTitle")!.textContent = `골판지 그리퍼 조립 과정 — ${NAMES[DESIGN_ID]}`;
  document.getElementById("patPath")!.textContent = `patterns/${DESIGN_ID}/`;
  const vid = document.getElementById("vid") as HTMLVideoElement;
  if (vid.getAttribute("src") !== MEDIA[DESIGN_ID].video) vid.src = MEDIA[DESIGN_ID].video;
  (document.getElementById("vidLink") as HTMLAnchorElement).href = MEDIA[DESIGN_ID].video;
  (document.getElementById("pdfLink") as HTMLAnchorElement).href = MEDIA[DESIGN_ID].pdf;
  document.getElementById("pdfLink")!.textContent = FOLD ? "B6P 전량판 PDF 받기 (A4 4장: 수량만큼 모두 그림)" : LEV ? "B5E 전량판 PDF 받기 (A4 9장: 수량만큼 모두 그림 — 본 6 + 여분 3)" : "B5N 전개도 PDF 받기 (A4 3장)";
  for (const b of document.querySelectorAll<HTMLButtonElement>("#dsel button")) b.setAttribute("aria-pressed", String(b.dataset.d === DESIGN_ID));
}
/** 설계 전환: 모든 설계 의존 상태를 다시 만듦 */
function setDesign(id: DId) {
  DESIGN_ID = id;
  LEV = id === "B5E";
  FOLD = id === "B6P";
  try {
    localStorage.setItem("asm-design", id);
  } catch {
    /* 저장 안 됨 */
  }
  design = ALL.find((d) => d.id === id)!;
  pattern = PATTERNS.find((p) => p.id === id)!;
  sheets = sheetsOf(id);
  shownSheet = -1;
  FEAS = feasOf();
  STEPS = stepsOf();
  finalAsm = design.build(design.preset("open", null));
  FLOOR = finalAsm.floorZ;
  buildAnims();
  matMesh.position.z = MAT_Z - 0.05;
  BLOCKS = makeBlocks();
  blockAnchor = anchorsOf();
  fillEnd();
  fillPages();
}
fillPages();
// 파일 받기: Artifact 뷰어에서는 일반 다운로드 링크가 막혀 있어 downloads 캡ability 로 저장.
// 로컬(docs/site) 에서는 claude.use 가 없거나 null → 기본 링크 동작.
type DL = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
let downloads: DL | null = null;
const cl = (window as unknown as { claude?: { use: (n: string) => Promise<unknown> } }).claude;
if (cl?.use) cl.use("downloads").then((d) => (downloads = (d as DL) ?? null)).catch(() => {});
const FNAME: Record<string, (id: DId) => string> = { pdfLink: (id) => `${id}-전개도-A4.pdf`, vidLink: (id) => `${id}-조립과정.mp4` };
for (const id of ["pdfLink", "vidLink"]) {
  const a = document.getElementById(id) as HTMLAnchorElement;
  a.addEventListener("click", async (ev) => {
    if (!downloads) return;
    ev.preventDefault();
    const label = a.textContent;
    try {
      a.textContent = "준비 중…";
      const blob = await (await fetch(a.href)).blob();
      a.textContent = label;
      await downloads.save({ filename: FNAME[id](DESIGN_ID), data: blob });
    } catch (e) {
      a.textContent = label;
      const code = (e as { code?: string }).code;
      if (code && code !== "declined") a.insertAdjacentText("afterend", ` (저장 안 됨: ${code})`);
    }
  });
}
for (const b of document.querySelectorAll<HTMLButtonElement>("#dsel button"))
  b.onclick = () => {
    if (b.dataset.d === DESIGN_ID) return;
    setDesign(b.dataset.d as DId);
    t = 0;
    buildChapters();
    scrub.max = String(durNow());
    draw();
  };

function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (playing && !playerBox.hidden) {
    t = Math.min(durNow(), t + dt);
    scrub.value = String(t);
    draw();
    if (t >= durNow()) {
      playing = false;
      playBtn.textContent = "재생";
    }
  }
  requestAnimationFrame(loop);
}
route();
document.body.dataset.ready = "1";
requestAnimationFrame(loop);
