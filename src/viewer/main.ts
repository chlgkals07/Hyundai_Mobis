import * as THREE from "three";
import { ALL } from "../core/designs";
import { findCollisions } from "../core/collide";
import type { Assembly, Controls, Design, ModeName, ObjName, Part } from "../core/types";
import B1c from "../../calc/out/B1.json";
import B2c from "../../calc/out/B2.json";
import B3c from "../../calc/out/B3.json";
import viewerData from "../../out/viewer-data.json";
import { renderCompare, renderPatterns } from "./pages";

interface CalcOut { checks: { id: string; desc: string; value: number; unit: string; pass: boolean }[] }
const CALC: Record<string, CalcOut> = { B1: B1c, B2: B2c, B3: B3c, V5: B1c, V5b: B3c } as unknown as Record<string, CalcOut>;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ----------------------------------------------------------- 상태
const params = new URLSearchParams(location.search);
let design: Design = ALL.find((d) => d.id === params.get("d")) ?? ALL[0];
let mode: ModeName = (params.get("m") as ModeName) ?? "rigid";
let ctrl: Controls = design.preset(mode, (params.get("o") as ObjName) || null);
if (params.has("a")) ctrl.a = Number(params.get("a"));
if (params.has("b")) ctrl.b = Number(params.get("b"));
if (params.has("s")) ctrl.s = Number(params.get("s"));
if (params.has("h")) ctrl.palmH = Number(params.get("h"));
if (params.get("o") === "none") ctrl.obj = null;

// ----------------------------------------------------------- three
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
camera.up.set(0, 0, 1);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Orbit = (THREE as any).OrbitControls;
const controls = new Orbit(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a94, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(180, -260, 420);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.25);
fill.position.set(-200, 200, 100);
scene.add(fill);

function cssVar(n: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#e3e8e5";
}
function applyTheme() {
  scene.background = new THREE.Color(cssVar("--canvas"));
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  applyTheme();
  update();
});
new MutationObserver(() => {
  applyTheme();
  update();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

const COLORS: Record<Part["kind"], number> = {
  board: 0xb98b5a,
  flank: 0xd9b382,
  straw: 0xf1efe9,
  bubble: 0x7fb3d5,
  disk: 0x9c7046,
  pad: 0x333333,
  nail: 0x8a6a45,
  wall: 0xa9845a,
  slot: 0x2a2a2a,
};
const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(kind: Part["kind"], hit: boolean, ghost: boolean) {
  const k = `${kind}${hit}${ghost}`;
  if (!mats.has(k)) {
    const m = new THREE.MeshStandardMaterial({
      color: hit ? 0xe53935 : COLORS[kind],
      roughness: kind === "straw" || kind === "bubble" ? 0.35 : 0.9,
      metalness: 0,
      transparent: kind === "bubble" || ghost,
      opacity: kind === "bubble" ? 0.55 : ghost ? 0.6 : 1,
    });
    mats.set(k, m);
  }
  return mats.get(k)!;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x5a3f22, transparent: true, opacity: 0.35 });
const boxEdges = new THREE.EdgesGeometry(boxGeo);
const RZ = new THREE.Matrix4().makeRotationZ(-Math.PI / 2);

let group = new THREE.Group();
scene.add(group);

function partMesh(p: Part, hit: boolean) {
  const cyl = p.kind === "straw" || p.kind === "bubble" || p.kind === "disk";
  const mesh = new THREE.Mesh(cyl ? cylGeo : boxGeo, mat(p.kind, hit, !!p.ghost));
  mesh.matrixAutoUpdate = false;
  const S = cyl ? new THREE.Matrix4().makeScale(p.size[1], p.size[0], p.size[2]) : new THREE.Matrix4().makeScale(...p.size);
  mesh.matrix.copy(p.m as unknown as THREE.Matrix4);
  if (cyl) mesh.matrix.multiply(RZ);
  mesh.matrix.multiply(S);
  const out: THREE.Object3D[] = [mesh];
  if (!cyl && (p.kind === "board" || p.kind === "wall")) {
    const e = new THREE.LineSegments(boxEdges, edgeMat);
    e.matrixAutoUpdate = false;
    e.matrix.copy(mesh.matrix);
    out.push(e);
  }
  return out;
}

function tube(a: THREE.Vector3, b: THREE.Vector3, d: number, color: number) {
  const len = a.distanceTo(b);
  if (len < 1e-3) return null;
  const m = new THREE.Mesh(cylGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.scale.set(d, len, d);
  return m;
}

function floorMesh(z: number) {
  const g = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2f6b5b, roughness: 1 }));
  plane.position.z = z - 0.05;
  g.add(plane);
  // 커팅매트 10 mm 격자 (굵은 선 50 mm)
  const pts: number[] = [];
  const pts5: number[] = [];
  for (let i = -200; i <= 200; i += 10) {
    const arr = i % 50 === 0 ? pts5 : pts;
    arr.push(i, -200, z, i, 200, z, -200, i, z, 200, i, z);
  }
  for (const [arr, op] of [[pts, 0.25], [pts5, 0.6]] as const) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arr as number[], 3));
    g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd8efe6, transparent: true, opacity: op })));
  }
  return g;
}

function objectMesh(asm: Assembly) {
  const o = asm.object;
  if (!o) return null;
  const s = o.shape;
  const color = { battery: 0x6d7b8d, cap: 0x2e86de, chip: 0xf2c14e, sponge: 0xc6d84f, cable: 0x222222 }[o.name];
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, transparent: true, opacity: 0.92 });
  let mesh: THREE.Mesh;
  if (s.kind === "cyl") {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.len, 32), m);
    if (s.axis === "x") mesh.rotation.z = Math.PI / 2;
    else mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(s.c as unknown as THREE.Vector3);
  } else if (s.kind === "ellip") {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m);
    mesh.scale.set(s.a, s.b, s.c3);
    mesh.position.copy(s.c as unknown as THREE.Vector3);
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(s.sx, s.sy, s.sz), m);
    mesh.position.copy(s.c as unknown as THREE.Vector3);
  }
  return mesh;
}

// ----------------------------------------------------------- 카메라 프리셋
type ViewName = "3d" | "front" | "side" | "top";
const VIEWS: Record<ViewName, [string, [number, number, number]]> = {
  "3d": ["3D", [260, -330, 170]],
  front: ["정면 (x–z, soft)", [0, -460, -40]],
  side: ["측면 (y–z, hard)", [460, 0, -40]],
  top: ["아래에서 (손바닥 밑)", [0.01, -0.01, -520]],
};
let view: ViewName = (params.get("v") as ViewName) ?? "3d";
function setView(v: ViewName) {
  view = v;
  const target = new THREE.Vector3(0, 0, -ctrl.palmH * 0.45);
  const p = VIEWS[v][1];
  camera.position.set(p[0], p[1], p[2] + target.z * (v === "top" ? 0 : 0.2));
  controls.target.copy(target);
  controls.update();
}
const viewsEl = $("views");
for (const [k, [label]] of Object.entries(VIEWS)) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.onclick = () => setView(k as ViewName);
  viewsEl.append(b);
}

// ----------------------------------------------------------- UI
const designsEl = $("designs");
for (const d of ALL) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.id = d.id;
  const [head, ...rest] = d.name.split(" — ");
  b.innerHTML = `<span>${head}</span><small>${rest.join(" — ") || ""}</small>`;
  b.onclick = () => {
    design = d;
    ctrl = d.preset(mode, ctrl.obj);
    syncUI();
    update();
  };
  designsEl.append(b);
}
const MODES: [ModeName, string][] = [
  ["open", "열림"],
  ["soft", "Soft"],
  ["rigid", "Rigid"],
  ["hybrid", "Hybrid"],
];
const modesEl = $("modes");
for (const [m, label] of MODES) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.m = m;
  b.textContent = label;
  b.onclick = () => {
    mode = m;
    ctrl = design.preset(m, null);
    syncUI();
    update();
  };
  modesEl.append(b);
}
const sa = $<HTMLInputElement>("sa");
const sb = $<HTMLInputElement>("sb");
const ss = $<HTMLInputElement>("ss");
const sh = $<HTMLInputElement>("sh");
const objSel = $<HTMLSelectElement>("obj");
sa.oninput = () => ((ctrl.a = +sa.value), update());
sb.oninput = () => ((ctrl.b = +sb.value), update());
ss.oninput = () => ((ctrl.s = +ss.value), update());
sh.oninput = () => ((ctrl.palmH = +sh.value), update());
objSel.onchange = () => ((ctrl.obj = (objSel.value || null) as ObjName | null), update());

function syncUI() {
  for (const b of designsEl.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.id === design.id));
  for (const b of modesEl.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.m === mode));
  sa.value = String(ctrl.a);
  sb.value = String(ctrl.b);
  ss.value = String(ctrl.s);
  sh.value = String(ctrl.palmH);
  objSel.value = ctrl.obj ?? "";
  $("la").hidden = design.oneString;
  $("lb").hidden = design.oneString;
  $("ls").hidden = !design.oneString;
  $("summary").textContent = design.summary;
  const c = CALC[design.id];
  $("checks").innerHTML = c.checks
    .map((k) => `<tr><td><span class="${k.pass ? "mark-ok" : "mark-bad"}">${k.pass ? "✓" : "✗"}</span> ${k.id}</td><td>${k.desc}</td><td class="v">${k.value} ${k.unit}</td></tr>`)
    .join("");
}

let pending = false;
function update() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const t0 = performance.now();
    const asm = design.build(ctrl);
    const cols = findCollisions(asm, design);
    const ms = performance.now() - t0;
    const hitBodies = new Set<string>();
    for (const c of cols) {
      const m = c.match(/: (\S+) ↔ (\S+)/) ?? c.match(/: (\S+)/);
      if (m) for (const b of m.slice(1)) if (b && !b.includes(".")) hitBodies.add(b);
    }
    scene.remove(group);
    group = new THREE.Group();
    for (const p of asm.parts) {
      const hit = hitBodies.has(p.body) && !p.ghost && cols.some((c) => c.startsWith("부품 간섭") || c.startsWith("바닥") || c.startsWith("물체"));
      for (const o of partMesh(p, hit && hitBodies.has(p.body))) group.add(o);
    }
    for (const l of asm.lines) {
      const color = l.kind === "string" ? 0x1b3a6b : l.kind === "rubber" ? 0xe4572e : 0x8e44ad;
      for (let i = 0; i < l.pts.length - 1; i++) {
        const t = tube(l.pts[i] as unknown as THREE.Vector3, l.pts[i + 1] as unknown as THREE.Vector3, l.kind === "rubber" ? 1.6 : 1.0, color);
        if (t) group.add(t);
      }
    }
    group.add(floorMesh(asm.floorZ));
    const om = objectMesh(asm);
    if (om) group.add(om);
    scene.add(group);
    // 계측
    $("oa").textContent = `${Math.round(ctrl.a * 100)}%`;
    $("ob").textContent = `${Math.round(ctrl.b * 100)}%`;
    $("os").textContent = `${Math.round(ctrl.s * 100)}%`;
    $("oh").textContent = `${ctrl.palmH.toFixed(1)} mm`;
    $("read").innerHTML = asm.readouts.map((r) => `<dt>${r.label}</dt><dd class="${r.warn ? "warn" : ""}">${r.value}</dd>`).join("");
    $("cols").innerHTML = cols.length ? cols.map((c) => `<li>${c}</li>`).join("") : `<li class="none">이 자세에서 부품·실·바닥·물체 간섭 없음</li>`;
    const st = $("stat");
    st.textContent = cols.length ? `간섭 ${cols.length}건` : "간섭 없음";
    st.className = `pill ${cols.length ? "bad" : "ok"}`;
    $("ms").textContent = `${asm.parts.length} 부품 · 계산 ${ms.toFixed(0)} ms`;
    document.body.dataset.ready = "1";
  });
}

function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ----------------------------------------------------------- 탭 (hash)
const TABS = ["bench", "compare", "patterns"];
function route() {
  const h = location.hash.slice(1);
  const tab = TABS.includes(h) ? h : "bench";
  for (const t of TABS) $(`page-${t}`).hidden = t !== tab;
  for (const a of document.querySelectorAll<HTMLAnchorElement>("nav.tabs a")) {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (tab === "bench") resize();
}
window.addEventListener("hashchange", route);
renderCompare($("page-compare"), viewerData);
renderPatterns($("page-patterns"), viewerData);
route();

syncUI();
setView(view);
update();
loop();
