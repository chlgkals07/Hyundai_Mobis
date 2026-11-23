import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { makeB5 } from "../../src/core/designs";
const scene = new T.Scene();
scene.background = new T.Color(0xf5f2eb);
const camera = new T.PerspectiveCamera(35, 1, 1, 2500);
camera.up.set(0, 0, 1);
camera.position.set(540, -850, 510);
const renderer = new T.WebGLRenderer({ antialias: true });
document.querySelector("main")!.append(renderer.domElement);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(5, -2, 87);
orbit.update();
scene.add(new T.HemisphereLight(0xffffff, 0xd4c3a9, 2));
const light = new T.DirectionalLight(0xffffff, 2);
light.position.set(200, -300, 500);
scene.add(light);
const model = new T.Group();
scene.add(model);
const design = makeB5("B5N"),
  rad = Math.PI / 180;
const mats = new Map<number, T.Material>();
function mesh(parent: T.Object3D, g: T.BufferGeometry, c: number) {
  if (!mats.has(c)) mats.set(c, new T.MeshStandardMaterial({ color: c }));
  const m = new T.Mesh(g, mats.get(c));
  parent.add(m);
  return m;
}
const kraft = 0xb98652,
  edge = 0x80572f,
  roll = 0x437b84;
function box(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  c = kraft,
) {
  const m = mesh(p, new T.BoxGeometry(w, d, h), c);
  m.position.set(x, y, z);
  return m;
}
function disc(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  c: number,
) {
  const m = mesh(p, new T.CylinderGeometry(r, r, h, 48), c);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
const val = (id: string) =>
  Number((document.getElementById(id) as HTMLInputElement).value);
function update() {
  model.traverse((n) => {
    if (n instanceof T.Mesh || n instanceof T.Line) n.geometry.dispose();
  });
  model.clear();
  const pitch = -val("p") * rad,
    yaw = val("y") * rad,
    twist = val("r") * rad;
  box(model, 0, 0, 3, 280, 280, 6);
  const base = new T.Group();
  model.add(base);
  base.rotation.z = yaw;
  disc(base, 0, 0, 11, 80, 8, edge);
  // Keep the 28 mm internal gap. Add reinforcement only outside the tower.
  for (const side of [-1, 1]) {
    box(base, -5, side * 17, 108.5, 54, 6, 187);
    box(base, -5, side * 21.5, 159, 54, 3, 76, edge);
    for (const x of [-24, 12]) {
      const triangle = new T.Shape();
      triangle.moveTo(0, 0);
      triangle.lineTo(30, 0);
      triangle.lineTo(0, 45);
      triangle.closePath();
      const rib = mesh(
        base,
        new T.ExtrudeGeometry(triangle, { depth: 6, bevelEnabled: false }),
        kraft,
      );
      rib.quaternion.setFromRotationMatrix(
        new T.Matrix4().makeBasis(
          new T.Vector3(0, side, 0),
          new T.Vector3(0, 0, 1),
          new T.Vector3(side, 0, 0),
        ),
      );
      rib.position.set(x - side * 3, side * 20, 15);
    }
  }
  const reach = 180 * Math.cos(pitch),
    height = 140 + 180 * Math.sin(pitch);
  for (const h of [140, 180]) {
    const link = new T.Group();
    base.add(link);
    link.position.z = h;
    link.rotation.y = -pitch;
    box(link, h === 180 ? 67.5 : 90, 0, 0, h === 180 ? 255 : 210, 26, 24);
    for (const x of [0, 180]) {
      const pin = mesh(link, new T.CylinderGeometry(2.8, 2.8, 50, 20), edge);
      pin.position.x = x;
    }
  }
  const end = new T.Group();
  base.add(end);
  end.position.set(reach, 0, height);
  for (const y of [-17, 17]) box(end, 6, y, 20, 40, 6, 68);
  box(end, 29, 0, 20, 6, 60, 68);
  // Cantilever is a closed hollow beam. Two cheeks transfer bending to the existing end plate.
  for (const y of [-16.5, 16.5]) box(end, 66, y, 47, 68, 3, 24);
  for (const z of [36.5, 57.5]) box(end, 66, 0, z, 68, 30, 3);
  // Fork at the distal end carries an annular bearing, leaving the axial passage clear.
  for (const y of [-15, 15]) box(end, 109, y, 51, 24, 6, 9);
  const axis = 127,
    palmZ = 20;
  function ring(
    p: T.Object3D,
    x: number,
    z: number,
    outer: number,
    inner: number,
    h: number,
    c: number,
  ) {
    const s = new T.Shape();
    s.absarc(0, 0, outer, 0, 2 * Math.PI, false);
    const hole = new T.Path();
    hole.absarc(0, 0, inner, 0, 2 * Math.PI, true);
    s.holes.push(hole);
    const m = mesh(
      p,
      new T.ExtrudeGeometry(s, {
        depth: h,
        bevelEnabled: false,
        curveSegments: 36,
      }),
      c,
    );
    m.position.set(x, 0, z);
  }
  ring(end, axis, 50, 25, 13, 3, edge);
  ring(end, axis, 61, 25, 13, 3, edge);
  for (const side of [-1, 1]) box(end, axis, side * 23, 57, 10, 4, 8);
  const hand = new T.Group();
  end.add(hand);
  hand.position.set(axis, 0, palmZ);
  hand.rotation.z = twist;
  ring(hand, 0, 26, 12, 8, 14, roll);
  ring(hand, 0, 34, 20, 8, 6, roll);
  for (const x of [-10.5, 10.5]) box(hand, x, 0, 16, 3, 30, 20);
  for (const y of [-13.5, 13.5]) box(hand, 0, y, 16, 18, 3, 20);
  ring(hand, 0, 25, 15, 8, 3, roll);
  const palmH = height + palmZ,
    a = (90 - 30 + ((30 + 7.9676) * val("a")) / 100) / (90 + 7.9676);
  const asm = design.build({ a, b: val("b") / 100, s: 0, palmH, obj: null });
  for (const p of asm.parts) {
    if (p.ghost || p.body.startsWith("whiffle")) continue;
    const [w, d, h] = p.size;
    const cyl = ["straw", "bubble", "disk"].includes(p.kind);
    const g = cyl
      ? new T.CylinderGeometry(d / 2, d / 2, w, 28).rotateZ(Math.PI / 2)
      : new T.BoxGeometry(w, d, h);
    const m = mesh(
      hand,
      g,
      p.kind === "nail"
        ? 0xe7a242
        : p.body.startsWith("flap")
          ? 0x7b9e86
          : p.body.startsWith("hard")
            ? 0x587d99
            : kraft,
    );
    m.matrix.copy(p.m);
    m.matrixAutoUpdate = false;
  }
  const colors = [0x8053aa, 0xe69818, 0x00867f, 0xcb452f, 0x1479bf];
  const V = (x, y, z) => new T.Vector3(x, y, z);
  model.updateMatrixWorld(true);
  const world = (o, x, y, z) => o.localToWorld(V(x, y, z));
  const lane = Number(
    (document.querySelector("#filter") as HTMLSelectElement).value,
  );
  function cord(i, points, r = 1.5) {
    if (lane !== -1 && lane !== i) return;
    const curve = new T.CurvePath<T.Vector3>();
    for (let k = 1; k < points.length; k++) {
      if (points[k].distanceTo(points[k - 1]) > 0.001)
        curve.add(new T.LineCurve3(points[k - 1], points[k]));
    }
    if (!curve.curves.length) return;
    // One cylinder per straight span keeps the passage through guide points exact.
    for (const c of curve.curves) {
      const a = c.getPoint(0),
        b = c.getPoint(1),
        d = b.clone().sub(a);
      const m = mesh(
        model,
        new T.CylinderGeometry(r, r, d.length(), 8),
        colors[i],
      );
      m.position.copy(a).lerp(b, 0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    }
  }
  function knot(i, p) {
    if (lane === -1 || lane === i)
      mesh(model, new T.SphereGeometry(2.6, 10, 8), colors[i]).position.copy(p);
  }
  function guide(i, p) {
    if (lane === -1 || lane === i)
      mesh(model, new T.SphereGeometry(2.5, 8, 8), 0xb09069).position.copy(p);
  }
  const panelX = -219;
  box(model, panelX, 0, 3, 118, 212, 6);
  const ys = [-82, -41, 0, 41, 82];
  const panel = (i, off = 0, dx = 0) => V(panelX + dx, ys[i] + off, 12);
  for (let i = 0; i < 5; i++) {
    const c = colors[i];
    box(model, panelX - 38, ys[i], 9, 9, 26, 6, c);
  }
  function arcPoints(center, r, angle, sweep, z) {
    return Array.from({ length: 13 }, (_, k) =>
      world(
        center,
        r * Math.cos(angle + (sweep * k) / 12),
        r * Math.sin(angle + (sweep * k) / 12),
        z,
      ),
    );
  }
  // Station 1: two tails anchored on a rotating rim; stationary guides leave opposite tangents.
  for (const sign of [-1, 1]) {
    const y = sign * 80,
      angle = (sign * Math.PI) / 2;
    const tangent = V(0, y, 11),
      rim = arcPoints(base, 80, angle - yaw, -sign * 0.95 + yaw, 11);
    const g = V(-101, y, 11),
      grip = panel(0, sign * 8, -8 + sign * 80 * yaw * 0.48);
    cord(0, [grip, panel(0, sign * 8, 51), g, tangent, ...rim]);
    guide(0, g);
    knot(0, rim.at(-1));
    knot(0, grip);
  }
  // All fixed-to-moving control housings have a rear service loop. Coordinates indicate guide centrelines.
  function feed(i, off, side, z) {
    const y = ys[i] + off;
    const start = panel(i, off, 51),
      fixed = V(-125, y, 21);
    const moving = world(base, -44, side, 48);
    const bend = new T.CubicBezierCurve3(
      fixed,
      V(-81, y, 23),
      world(base, -90, side, 70),
      moving,
    );
    guide(i, start);
    guide(i, fixed);
    guide(i, moving);
    return [start, ...bend.getPoints(12), world(base, -38, side, z)];
  }
  const tail = world(
    base,
    -55 * Math.cos(pitch),
    0,
    180 - 55 * Math.sin(pitch),
  );
  const liftGuide = world(base, -54, 0, 65);
  const liftGrip = panel(1, 0, -10 + 55 * Math.sin(-pitch));
  cord(1, [liftGrip, ...feed(1, 0, -30, 65), liftGuide, tail]);
  guide(1, liftGuide);
  knot(1, tail);
  knot(1, liftGrip);
  const Atravel = (13 * (30 + 7.9676) * rad * val("a")) / 100;
  const Btravel = parseFloat(
    asm.readouts.find((o) => o.label.includes("루프 당김"))!.value,
  );
  const equalizer = panel(3, 0, -Atravel);
  box(model, equalizer.x, equalizer.y, 12, 5, 24, 4, edge);
  cord(3, [equalizer, panel(3, 0, -32 - Atravel)]);
  knot(3, panel(3, 0, -32 - Atravel));
  const loopCenter = panel(4, 0, -Btravel);
  disc(model, loopCenter.x, loopCenter.y, 12, 8, 4, edge);
  const loop = Array.from({ length: 15 }, (_, k) =>
    loopCenter
      .clone()
      .add(
        V(
          -8 * Math.sin((Math.PI * k) / 14),
          8 * Math.cos((Math.PI * k) / 14),
          1,
        ),
      ),
  );
  cord(4, loop);
  cord(4, [loopCenter, panel(4, 0, -29 - Btravel)]);
  for (let i = 2; i <= 4; i++)
    for (const sign of [-1, 1]) {
      const off = sign * 8,
        side = sign * (i === 2 ? 20 : i === 3 ? 9 : 4);
      const start =
        i === 4
          ? loopCenter.clone().add(V(0, off, 1))
          : i === 3
            ? equalizer.clone().add(V(0, off, 0))
            : panel(i, off, -8 + sign * twist * 13);
      const f = feed(i, off, sign * (26 + 3 * (i - 2)), 160 + 3 * i);
      const hinge = world(base, 4, side, 180 + 5);
      const front = world(end, -12, side, 44);
      const beam = world(end, 47, side, 47);
      const tip = world(end, 90, side, 47);
      const pts = [start, ...f, hinge, front, beam, tip];
      for (const pt of [hinge, front, beam]) guide(i, pt);
      if (i === 2) {
        const tangent = world(end, axis, sign * 20, 57),
          g = world(end, 92, sign * 20, 57);
        const arc = arcPoints(
          hand,
          20,
          (sign * Math.PI) / 2 - twist,
          -sign * 1.9 + twist,
          37,
        );
        cord(i, [...pts, g, tangent, ...arc]);
        guide(i, g);
        knot(i, arc.at(-1));
        knot(i, start);
      } else {
        // Four independent short flexible sleeves rise above the bearing then enter the central bore.
        const lx = i === 3 ? sign * 3 : 0,
          ly = i === 4 ? sign * 3 : 0;
        const entry = world(hand, lx, ly, 49);
        const bend = new T.CubicBezierCurve3(
          tip,
          world(end, 86, side, 95 + 3 * i),
          world(hand, lx, ly, 92 + 3 * i),
          entry,
        );
        const bottom = world(hand, lx, ly, 9);
        // Side ports above the palm lead to each original drum exit.
        const raw =
          i === 3
            ? asm.lines.find(
                (l) => l.id === "stringA." + (sign === 1 ? "R" : "L"),
              )
            : asm.lines.find((l) => l.id === "tendonLoop");
        const exit =
          i === 3
            ? raw.pts.at(-2)
            : raw.pts[sign === 1 ? 0 : raw.pts.length - 1];
        const local = exit.clone();
        const port = world(hand, local.x, local.y, 11);
        cord(
          i,
          [
            ...pts,
            ...bend.getPoints(15).slice(1),
            bottom,
            port,
            hand.localToWorld(local.clone()),
          ],
          1.05,
        );
        guide(i, entry);
        guide(i, port);
        if (i === 3) {
          const wrap = raw.pts
            .slice(0, -1)
            .map((p) => hand.localToWorld(p.clone()));
          cord(i, wrap, 1.05);
          knot(i, wrap[0]);
        } else {
          const wrap = Array.from({ length: 22 }, (_, k) => {
            const t = (k / 21) * (2 * Math.PI - Btravel / 16);
            return world(
              hand,
              0,
              local.y + sign * 16 * (1 - Math.cos(t)),
              local.z - 16 * Math.sin(t),
            );
          });
          cord(i, wrap, 1.05);
          knot(i, wrap.at(-1));
        }
      }
    }
  if ((document.querySelector("#xray") as HTMLInputElement).checked) {
    const faded = new Set([kraft, edge, roll, 0x7b9e86, 0x587d99, 0xe7a242]);
    for (const [c, m] of mats) {
      if (faded.has(c)) {
        m.transparent = true;
        m.opacity = 0.23;
        m.depthWrite = false;
      }
    }
  } else {
    for (const m of mats.values()) {
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
    }
  }

  document.querySelector("output")!.textContent =
    "손바닥 높이 " +
    palmH.toFixed(1) +
    " mm · 받침 " +
    val("y") +
    "° · 내림 " +
    val("p") +
    "° · 손목 " +
    val("r") +
    "°";
  renderer.render(scene, camera);
}
orbit.addEventListener("change", () => renderer.render(scene, camera));
document
  .querySelectorAll("input")
  .forEach((e) => e.addEventListener("input", update));
new ResizeObserver(() => {
  const e = document.querySelector("main")!;
  renderer.setSize(e.clientWidth, e.clientHeight);
  camera.aspect = e.clientWidth / e.clientHeight;
  camera.zoom = Math.min(1.55, camera.aspect * 1.22);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}).observe(document.querySelector("main")!);
update();

document.querySelector("select").onchange = update;
let playing = false,
  origin = 0,
  prev = 0;
function tick(time) {
  if (playing && time - prev > 80) {
    const phase = (time - origin) / 1450;
    const weights = [0, 1, 2, 3, 4].map(
      (j) =>
        (1 -
          Math.cos(
            2 * Math.PI * Math.max(0, Math.min(1, (phase - j * 0.62) / 3)),
          )) /
        2,
    );
    for (const [j, id] of ["y", "p", "r", "a", "b"].entries()) {
      const el = document.getElementById(id) as HTMLInputElement;
      el.value = String(weights[j] * Number(el.max));
    }
    update();
    prev = time;
    if (phase > 5.55) {
      playing = false;
      document.querySelector("button").textContent = "자동 시연";
    }
  }
  requestAnimationFrame(tick);
}
document.querySelector("button").onclick = () => {
  playing = !playing;
  origin = performance.now();
  document.querySelector("button").textContent = playing ? "정지" : "자동 시연";
};
document.querySelectorAll("input[type=range]").forEach((el) =>
  el.addEventListener("input", () => {
    playing = false;
    document.querySelector("button").textContent = "자동 시연";
  }),
);
requestAnimationFrame(tick);
