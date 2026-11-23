/** 팔 + 그리퍼 결합 시뮬 (params/arm/R4.json 가정 치수). 팀원이 실측값으로 바꾸고 확장하는 출발점. */
import * as THREE from "three";
import { ALL } from "../core/designs";
import { findCollisions } from "../core/collide";
import { ARM, armFK, armIK, combinedDesign, transformAssembly } from "../core/arm";
import type { Part } from "../core/types";
import B5Nc from "../../calc/out/B5N.json";
import env from "../../calc/out/envelope.json";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const grip = ALL.find((d) => d.id === ARM.gripper.design)!;
const dv = B5Nc.derived as unknown as Record<string, number>;
const H0 = dv.rigid_palm_height;

const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ece9);
const camera = new THREE.PerspectiveCamera(35, 1, 1, 6000);
camera.up.set(0, 0, 1);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const controls = new (THREE as any).OrbitControls(camera, renderer.domElement);
controls.target.set(120, 0, 120);
camera.position.set(420, -520, 380);
controls.update();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a94, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(300, -400, 600);
scene.add(sun);
{
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(900, 700), new THREE.MeshStandardMaterial({ color: 0x2f6b5b, roughness: 1 }));
  fl.position.set(150, 0, -0.1);
  scene.add(fl);
  const g = new THREE.GridHelper(900, 90, 0xd8efe6, 0xd8efe6);
  g.rotation.x = Math.PI / 2;
  g.position.set(150, 0, 0);
  (g.material as THREE.Material).transparent = true;
  (g.material as THREE.Material).opacity = 0.18;
  scene.add(g);
}
const COLORS: Record<string, number> = { board: 0xb98b5a, flank: 0xd9b382, straw: 0xf1efe9, bubble: 0x7fb3d5, disk: 0x9c7046, pad: 0x333333, nail: 0x8a6a45, wall: 0xa9845a, slot: 0x2a2a2a };
const mats = new Map<string, THREE.Material>();
const mat = (k: string, hit: boolean, arm: boolean) => {
  const key = k + hit + arm;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: hit ? 0xe53935 : arm ? 0x7d8f86 : COLORS[k] ?? 0xb98b5a, roughness: 0.85 }));
  return mats.get(key)!;
};
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const RZ = new THREE.Matrix4().makeRotationZ(-Math.PI / 2);
const isCyl = (p: Part) => p.kind === "straw" || p.kind === "bubble" || p.kind === "disk";
let group = new THREE.Group();
scene.add(group);

const S = {
  r: $<HTMLInputElement>("r"),
  yaw: $<HTMLInputElement>("yaw"),
  roll: $<HTMLInputElement>("roll"),
  lim: $<HTMLInputElement>("lim"),
  a: $<HTMLInputElement>("a"),
  b: $<HTMLInputElement>("b"),
  lift: $<HTMLInputElement>("lift"),
};
const obj = $<HTMLSelectElement>("obj");
S.lim.value = String(ARM.gripper.soft_open_limit_deg);
for (const el of [...Object.values(S), obj]) el.addEventListener("input", update);

function update() {
  const r = +S.r.value;
  const lim = +S.lim.value;
  const lift = +S.lift.value;
  const palmH = H0 + lift;
  const wristZ = palmH + 6 + ARM.mount.h + ARM.wrist.h;
  const ik = armIK(ARM, r, wristZ);
  const out = $("out");
  if (!ik) {
    out.innerHTML = `<li class="bad">도달 불가: 손목을 r=${r}, 높이 ${wristZ.toFixed(0)} 에 둘 수 없음 (상완+전완 길이 부족/과다)</li>`;
    return;
  }
  const arm = armFK(ARM, { base: (+S.yaw.value * Math.PI) / 180, shoulder: ik.shoulder, elbow: ik.elbow, wristPitch: "level", roll: (+S.roll.value * Math.PI) / 180 });
  const phiMin = dv.soft_phi_min_deg;
  const aOpen = Math.max(0, (90 - lim) / (90 - phiMin));
  const a = aOpen + (1 - aOpen) * +S.a.value;
  const o = obj.value ? (obj.value as "battery") : null;
  const ctrl = { ...grip.preset("open", null), a, b: +S.b.value, palmH, obj: o };
  const gAsm = grip.build(ctrl);
  const world = transformAssembly(gAsm, arm.Mgrip);
  const all = { ...world, parts: [...world.parts, ...arm.parts], lines: [] };
  const cols = findCollisions(all, combinedDesign(grip)).filter((c) => !c.startsWith("실 걸림"));
  const hit = new Set<string>();
  for (const c of cols) {
    const m = c.match(/: (\S+) ↔ (\S+)/) ?? c.match(/: (\S+)/);
    if (m) m.slice(1).forEach((x) => x && hit.add(x));
  }
  scene.remove(group);
  group = new THREE.Group();
  for (const p of all.parts) {
    const isArm = p.body.startsWith("arm_");
    const mesh = new THREE.Mesh(isCyl(p) ? cylGeo : boxGeo, mat(p.kind, hit.has(p.body) && cols.some((c) => c.includes("arm_")), isArm));
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(p.m as unknown as THREE.Matrix4);
    if (isCyl(p)) mesh.matrix.multiply(RZ).multiply(new THREE.Matrix4().makeScale(p.size[1], p.size[0], p.size[2]));
    else mesh.matrix.multiply(new THREE.Matrix4().makeScale(...p.size));
    group.add(mesh);
  }
  // 실 (보우덴 가정 경로: 손바닥 위 → 손목)
  for (const l of world.lines) {
    const pts = l.pts as unknown as THREE.Vector3[];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: l.kind === "string" ? 0x1b3a6b : l.kind === "rubber" ? 0xe4572e : 0x8e44ad })));
  }
  if (world.object) {
    const s = world.object.shape;
    if (s.kind === "cyl") {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.len, 24), new THREE.MeshStandardMaterial({ color: 0x6d7b8d }));
      m.position.copy(s.c as unknown as THREE.Vector3);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(arm.Mgrip));
      m.rotateZ(Math.PI / 2);
      group.add(m);
    }
  }
  scene.add(group);
  const armCols = cols.filter((c) => c.includes("arm_"));
  out.innerHTML = [
    `<li>어깨 ${((ik.shoulder * 180) / Math.PI).toFixed(0)}°, 팔꿈치 ${((ik.elbow * 180) / Math.PI).toFixed(0)}° · 손바닥 높이 ${palmH.toFixed(0)} mm</li>`,
    `<li>soft 열림 제한 ${lim}° → 반폭 x ≈ ${(env.soft_open_table.find((t) => t.phi_open_deg === lim)?.half_width_x ?? "–")} mm</li>`,
    armCols.length ? armCols.map((c) => `<li class="bad">${c}</li>`).join("") : `<li class="ok">팔 ↔ 그리퍼 간섭 없음</li>`,
    ...cols.filter((c) => !c.includes("arm_")).map((c) => `<li class="warn">그리퍼 내부: ${c}</li>`),
  ].join("");
  $("lv").textContent = `${lim}°`;
  $("rv").textContent = `${r} mm`;
}
function resize() {
  const rr = stage.getBoundingClientRect();
  renderer.setSize(rr.width, rr.height, false);
  camera.aspect = rr.width / Math.max(1, rr.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();
update();
document.body.dataset.ready = "1";
(function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();
