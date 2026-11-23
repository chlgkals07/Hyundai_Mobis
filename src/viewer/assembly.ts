/**
 * B5N 제작 과정 애니메이션: 전개도(2D) 자르기 → 커팅매트 위 부품 → 단계별 조립(3D) → 실 당겨 동작 → 실현성 카드.
 * window.__render(t) 로 결정적(deterministic) 렌더 → scripts/record-assembly.mjs 가 프레임 캡처 → mp4.
 */
import * as THREE from "three";
import { ALL } from "../core/designs";
import { PATTERNS } from "../core/pattern";
import type { Assembly, Part } from "../core/types";
import viewerData from "../../out/viewer-data.json";

const DESIGN_ID = "B5N";
const design = ALL.find((d) => d.id === DESIGN_ID)!;
const pattern = PATTERNS.find((p) => p.id === DESIGN_ID)!;
const sheets: string[] = ((viewerData as { patterns?: { id: string; sheets: string[] }[] }).patterns ?? []).find((p) => p.id === DESIGN_ID)?.sheets ?? [];

// ------------------------------------------------------------------ 실현성 수치 (전개도에서 집계, 시간은 추정)
const boardPieces = pattern.shapes.reduce((a, s) => a + s.qty, 0);
const circles = pattern.shapes.filter((s) => /드럼 (큰|작은)판/.test(s.label)).reduce((a, s) => a + s.qty, 0);
// 골판지 면적 (판 두께 겹수 고려 안 함: 전개도 부품 면적 × 수량)
const areaM2 = pattern.shapes.reduce((a, s) => a + s.w * s.h * s.qty, 0) / 1e6;
const strawText = pattern.cutList.join(" ");
const FEAS = {
  boardPieces,
  circles,
  straight: boardPieces - circles,
  // 추정: 직선 부품 1.5 분, 원판 3 분, Fin Ray 띠(라이너 벗기기 포함) 6 분/개
  cutMin: Math.round((boardPieces - circles - 4) * 1.5 + circles * 3 + 4 * 6),
  areaM2,
  // 택배상자 1개(약 40×30×25 cm)에서 평평하게 쓸 수 있는 면적 ≈ 0.35 m², 버리는 부분 감안 60 %
  boxes: Math.max(1, Math.ceil(areaM2 / (0.35 * 0.6))),
};
void strawText;

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
const STEPS: Step[] = [
  { t0: 0, t1: 4, title: "B5N 골판지 그리퍼 — 만드는 과정", craft: "평행 링크 hard (긴 손톱) + 플랩 Fin Ray soft · 1:1 전개도 A4 3장", feas: "", level: 1 },
  { t0: 4, t1: 10, title: "1. 도면 출력 → 골판지에 붙이기 → 자르기", craft: "A4 실제 크기(100%) 인쇄, 100 mm 눈금자 확인 → 딱풀로 택배상자에 붙임 → 커터칼+쇠자로 실선을 자름", feas: `판 부품 ${FEAS.boardPieces}개 (원판 ${FEAS.circles}) · 자르기 약 ${Math.round(FEAS.cutMin / 10) * 10}분 (추정)`, level: 1 },
  { t0: 10, t1: 16, title: "2. 접는 선·구멍", craft: "파란 점선 = 볼펜으로 자 대고 꾹 눌러 score → 깔끔하게 접힘. 빨간 원 = 송곳으로 뚫고 연필로 넓혀 빨대 구멍", feas: "구멍 위치 ±1 mm 가 평행 링크의 평행도를 좌우 — 가장 꼼꼼해야 하는 단계", level: 2 },
  { t0: 16, t1: 22, title: "3. Fin Ray 띠 — 한쪽 라이너 벗기기", craft: "Fin Ray 띠 4개는 골판지 한쪽 종이(라이너)를 물에 살짝 적셔 벗긴 '단면 골판지' → 골이 폭 방향이라 길이 방향으로 잘 휨", feas: "벗기기 + 건조 시간 필요 (드라이어로 5분)", level: 2 },
  { t0: 22, t1: 27, title: "4. 잘린 부품들", craft: "커팅매트 위에 모두 펼친 상태. 같은 부품은 겹쳐 붙여(적층) 두께를 만듦 — 링크·손끝판·브래킷", feas: "적층은 목공풀(얇게) 또는 글루건. 글루건은 두께가 생겨 치수 오차↑", level: 1 },
  { t0: 27, t1: 33, title: "5. 손바닥 + 플랩", craft: "윗장·아랫장 골 방향 엇갈려 풀칠 (플랩 부분은 풀칠 금지). 플랩은 score 선에서 접힘 = 힌지", feas: "쉬움", level: 1 },
  { t0: 33, t1: 41, title: "6. Fin Ray 접기 + 리브", craft: "띠를 접는 선 3곳에서 삼각형으로 → 탭 풀칠. 빨대 리브 4개를 R2–R8 표시에 테이프로 양끝 힌지", feas: "Fin Ray 4개 × 약 10분. 리브 길이 22/17/11/6 mm 빨대 자르기", level: 2 },
  { t0: 41, t1: 46, title: "7. Fin Ray → 플랩, 드럼", craft: "Fin Ray 밑판 탭을 플랩 끝에 수직으로 풀칠. 드럼(원판 큰-작은-큰)을 플랩 바깥 힌지선에 세워 붙이고 삼각 보강", feas: "드럼 직각 접착부가 약점 — 삼각 보강 필수", level: 2 },
  { t0: 46, t1: 52, title: "8. 브래킷 + 축 (hard)", craft: "브래킷 4장: 위 탭을 접어 손바닥 아랫면에 평행하게 풀칠. 구멍에 굵은 빨대 부싱 → 일반 빨대 축 2개", feas: "두 브래킷 평행·구멍 정렬이 핵심. 축을 먼저 끼운 채로 풀칠하면 정렬이 맞음", level: 3 },
  { t0: 52, t1: 58, title: "9. 평행 링크", craft: "바깥 링크 막대 + 드럼을 바깥 축에 풀칠(한 몸 회전). 안쪽 링크 두 갈래는 안쪽 축에 (드럼 양옆)", feas: "링크 2개의 구멍 간격(55 mm)이 같아야 평행사변형 — 두 막대를 겹쳐 함께 뚫기", level: 3 },
  { t0: 58, t1: 64, title: "10. 커플러 + 손끝판 + 긴 손톱", craft: "L자 측판 2장 + 손끝판 → 링크 끝 핀 2개. 손톱(14 mm, 3겹)을 테이프 힌지 + 안쪽 스토퍼", feas: "⚠ 손끝판이 8 mm 뿐이고 손톱 14 mm 가 쥐는 면 — 손톱 3겹 + 고무줄 감기 권장", level: 3 },
  { t0: 64, t1: 70, title: "11. 실·텐던·고무줄", craft: "soft: 드럼 → 위로 → 균형막대. hard: 텐던 1가닥 루프(앞 드럼 → 손잡이/모터 → 뒤 드럼). 복원 고무줄", feas: "실 길이 맞추기·매듭이 의외로 시간 소모 (30분 이상)", level: 2 },
  { t0: 70, t1: 84, title: "12. 동작 — 건전지 (Rigid) · 감자칩 (Soft)", craft: "실 B 를 당기면 앞·뒤 손끝판이 수직을 유지한 채 닫힘 · 실 A 를 당기면 Fin Ray 가 감쌈 (직렬 고무줄 2.5 N/손가락 제한)", feas: "시뮬 결과 재생 (마찰·골판지 휨 미포함)", level: 1 },
  { t0: 84, t1: 94, title: "실현 가능한가?", craft: "", feas: "", level: 1 },
];
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
const ctrlOpen = design.preset("open", null);
const finalAsm = design.build(ctrlOpen);
const FLOOR = finalAsm.floorZ;

function stepOf(p: Part): number {
  const id = p.id;
  if (p.ghost) return 11;
  if (/^palm/.test(id) || /^flap\./.test(id)) return 5;
  if (/^finray/.test(id)) return 6; // 6 접기 → 7 부착
  if (/^drum/.test(id) && p.body.startsWith("flap")) return 7;
  if (/^(bracket|axle)/.test(id)) return 8;
  if (/^(link|drum)/.test(id)) return 9;
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
// 매트 위 배치: 단계별로 줄을 나눠 앞쪽(-y) 에 펼침
const rowY: Record<number, number> = { 5: -150, 6: -215, 7: -150, 8: -270, 9: -270, 10: -325, 11: -325 };
const rowX: Record<number, number> = {};
const MAT_Z = FLOOR;
// Fin Ray 손가락별 띠 순서 (contact c0..c9 → back b9..b0 → base) 를 직선으로 펼침
const finKeys = new Map<string, Part[]>();
for (const p of finalAsm.parts) {
  const m = p.id.match(/^finray\.([FB])\.(c|b)(\d+)\.(R|L)$/) ?? p.id.match(/^finray\.([FB])\.(base)()\.(R|L)$/);
  if (m) {
    const key = `${m[1]}${m[4]}`;
    if (!finKeys.has(key)) finKeys.set(key, []);
    finKeys.get(key)!.push(p);
  }
}
const finStart = new Map<string, THREE.Matrix4>();
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
const BENCH = new THREE.Vector3(0, -150, 0); // Fin Ray 를 접어 놓는 작업대 오프셋 (최종 위치 기준)

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
{
  const h = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m} min`);
  const cutTot = FEAS.cutMin + 20; // 인쇄·붙이기 20 분
  const rows: [string, number, string, boolean][] = [
    [`인쇄·붙이기·자르기 (판 ${FEAS.boardPieces}장, 그중 원판 ${FEAS.circles})`, cutTot, "가능 — 2인 분담 시 절반", true],
    ["Fin Ray 4개 (라이너 벗기기·리브)", 60, "가능 — 띠 1개 먼저 시험", true],
    ["손바닥·플랩·드럼", 30, "드럼 직각 접착 → 삼각 보강", false],
    ["브래킷·평행 링크", 60, "구멍 간격 ±1 mm — 링크 2장 겹쳐 함께 뚫기", false],
    ["커플러·손끝·긴 손톱", 30, "손끝판 8 mm + 손톱 14 mm — 손톱 3겹 필요", false],
    ["실·텐던·고무줄·조정", 45, "가능 — 매듭 대신 테이프 고정 후 조정", true],
  ];
  const tot = rows.reduce((a, r) => a + r[1], 0);
  document.getElementById("endRows")!.innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${h(r[1])}</td><td class="${r[3] ? "ok" : "warn"}">${r[2]}</td></tr>`).join("");
  document.getElementById("endSum")!.innerHTML = `합계 약 <b>${(tot / 60).toFixed(1)} 시간 (1인)</b>, 2인이면 약 ${(tot / 60 / 1.7).toFixed(1)} 시간. 골판지 면적 ${FEAS.areaM2.toFixed(2)} m² → 택배상자 약 ${FEAS.boxes}–${FEAS.boxes + 1}개 + Fin Ray 용 여분. 그 외: 일반 빨대 10개, 버블티 빨대 2개, 고무줄, 실, 테이프, 목공풀. 시간은 모두 추정.`;
}
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

// 결정적 렌더 (캡처용)
(window as unknown as { __render: (t: number) => void; __T: number }).__render = (t: number) => {
  resize();
  render(t);
};
(window as unknown as { __T: number }).__T = T_END;

// 재생 UI
const scrub = document.getElementById("scrub") as HTMLInputElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
scrub.max = String(T_END);
let playing = !new URLSearchParams(location.search).has("capture");
let t = 0;
let last = performance.now();
playBtn.onclick = () => {
  playing = !playing;
  playBtn.textContent = playing ? "일시정지" : "재생";
  if (t >= T_END) t = 0;
};
playBtn.textContent = playing ? "일시정지" : "재생";
scrub.oninput = () => {
  t = +scrub.value;
  render(t);
};
const chapters = document.getElementById("chapters")!;
for (const s of STEPS.slice(1)) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = s.title.split(" ")[0].replace(".", "") || "끝";
  b.title = s.title;
  b.onclick = () => {
    t = s.t0 + 0.01;
    render(t);
  };
  chapters.append(b);
}
function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (playing) {
    t = Math.min(T_END, t + dt);
    scrub.value = String(t);
    render(t);
    if (t >= T_END) {
      playing = false;
      playBtn.textContent = "재생";
    }
  }
  requestAnimationFrame(loop);
}
render(0);
document.body.dataset.ready = "1";
if (playing) requestAnimationFrame(loop);
else requestAnimationFrame(loop);
