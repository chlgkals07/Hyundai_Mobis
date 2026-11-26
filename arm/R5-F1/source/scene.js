import {
  Vector3 as N,
  Object3D as Oe,
  Shape as yi,
  Path as xi,
  Mesh as Be,
  MeshStandardMaterial as nr,
  CylinderGeometry as Fn,
  BoxGeometry as Nn,
  ExtrudeGeometry as ss,
  Color as jt,
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
} from "three";
import { CURRENT } from "../../../src/core/designs";
import arm from "../../../params/arm/R5-F1.json";
import META from "./chapters.json";
const Li = new Scene(),
  Tn = new PerspectiveCamera(35, 1, 1, 2500),
  Ms = new WebGLRenderer({ antialias: true });
Tn.up.set(0, 0, 1);
Li.add(new HemisphereLight(0xffffff, 0xd47799, 2));
const light = new DirectionalLight(0xffffff, 2);
light.position.set(200, -300, 500);
Li.add(light);
const uc = new Map(),
  X0 = CURRENT.find((d) => d.id === arm.gripper.design);
function drumWithBore(length, diameter) {
  const shape = new yi(),
    bore = new xi();
  shape.absarc(0, 0, diameter / 2, 0, 2 * Math.PI, false);
  bore.absarc(0, 0, 3, 0, 2 * Math.PI, true);
  shape.holes.push(bore);
  return new ss(shape, { depth: length, bevelEnabled: false })
    .translate(0, 0, -length / 2)
    .rotateY(Math.PI / 2);
}
const span = arm.upper.L,
  upperLength = span + arm.upper.rear_overhang + arm.upper.front_overhang;
const upperCenter = upperLength / 2 - arm.upper.rear_overhang;
const lowerLength =
  arm.fore.L + arm.fore.rear_overhang + arm.fore.front_overhang;
const lowerCenter = lowerLength / 2 - arm.fore.rear_overhang;
const shoulder = arm.base.h + arm.column.lower_pin_from_foot;
const WHITE = 0xfdf7ea,
  BOARD = 0xd4aa71,
  PLY = 0xbb8f5f,
  EDGE = 0x9a734c,
  BRASS = 0xe8b355,
  GLUE = 0xf0b555,
  ST = 0x4aafa7,
  W = 0x277bb9,
  A = 0x23845e,
  B = 0xcd5f37,
  Y = 0x8060a7,
  L = 0xd54845;
const V = (...p) => new N(...p),
  vec = (p) => V(...p),
  clamp = (x) => Math.max(0, Math.min(1, x)),
  ease = (x) => ((x = clamp(x)), x * x * (3 - 2 * x));
const TAU = Math.PI * 2;
let ids = [],
  callouts = [],
  group,
  cam,
  sc = -1,
  desk;
function mat(c) {
  if (!uc.has(c)) uc.set(c, new nr({ color: c }));
  return uc.get(c);
}
function mesh(geo, c, p = group) {
  const m = new Be(geo, Array.isArray(c) ? c.map(mat) : mat(c));
  p.add(m);
  return m;
}
function rectPath(x, y, w, h) {
  const p = new xi();
  p.moveTo(x, y);
  p.lineTo(x + w, y);
  p.lineTo(x + w, y + h);
  p.lineTo(x, y + h);
  p.closePath();
  return p;
}
function obj(x, y, z, p = group) {
  let v = new Oe();
  p.add(v);
  v.position.set(x, y, z);
  return v;
}
function add(g, pos) {
  g.position.set(...pos);
  return g;
}
function shapeGeom(shape, t) {
  return new ss(shape, {
    depth: t,
    bevelEnabled: false,
    curveSegments: 32,
  }).translate(0, 0, -t / 2);
}
function shapeHoles(s, holes) {
  for (let [x, y, r, h] of holes) {
    if (h !== undefined) s.holes.push(rectPath(x, y, r, h));
    else {
      let u = new xi();
      u.absarc(x, y, r, 0, TAU, true);
      s.holes.push(u);
    }
  }
}
function plate(
  x,
  y,
  z,
  w,
  h,
  t,
  holes = [],
  side = false,
  c = BOARD,
  p = group,
) {
  let s = new yi();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  shapeHoles(s, holes);
  let g = mesh(shapeGeom(s, t), [c, EDGE], p);
  if (side) g.rotation.x = Math.PI / 2;
  return add(g, [x, y, z]);
}
function ring(x, y, z, r, b, t, c = BOARD, p = group, holes = []) {
  let s = new yi();
  s.absarc(0, 0, r, 0, TAU, false);
  shapeHoles(s, [...(b ? [[0, 0, b]] : []), ...holes]);
  return add(mesh(shapeGeom(s, t), [c, c === ST ? ST : EDGE], p), [x, y, z]);
}
function seg(a, b, r, c, p = group) {
  let v = vec(b).sub(vec(a)),
    g = mesh(new Fn(r, r, v.length(), 14), c, p);
  g.position.copy(vec(a).lerp(vec(b), 0.5));
  g.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize());
  return g;
}
function guide(a, b, r = 3, p = group) {
  const v = vec(b).sub(vec(a)),
    g = obj(...a, p);
  g.quaternion.setFromUnitVectors(V(0, 0, 1), v.clone().normalize());
  const len = v.length();
  ring(0, 0, len / 2, r, r * 0.8, len, ST, g);
  return g;
}
function animate(o, at, end, off = [0, 0, 25]) {
  ids.push({ o, at, end, off, base: o.position.clone() });
  return o;
}
function arc(x, y, z, r, a, b, n = 34) {
  return Array.from({ length: n + 1 }, (_, i) => [
    x + r * Math.cos(a + ((b - a) * i) / n),
    y + r * Math.sin(a + ((b - a) * i) / n),
    z,
  ]);
}
function wire(ps, c, r = 0.68, start = -2, end = -1, p = group) {
  let g = obj(0, 0, 0, p),
    arr = [],
    total = 0;
  for (let i = 1; i < ps.length; i++) {
    const len = vec(ps[i]).distanceTo(vec(ps[i - 1]));
    if (len < 0.001) continue;
    const a = ps[i - 1],
      b = ps[i],
      o = seg(a, b, r, c, g);
    arr.push({ o, a: vec(a), b: vec(b), len, d: total });
    total += len;
  }
  if (start >= 0) ids.push({ line: true, arr, total, at: start, end });
  return g;
}
function tie(x, y, z, c, axis = "z", r = 1.2) {
  let ps = [];
  for (let i = 0; i <= 48; i++) {
    let a = (i / 48) * TAU * 2.2,
      rad = r * (0.8 + 0.2 * Math.sin(a * 0.5));
    let dx = rad * Math.cos(a),
      dy = rad * Math.sin(a),
      dz = (i / 48) * 2.5;
    ps.push(axis === "x" ? [x + dz, y + dx, z + dy] : [x + dx, y + dy, z + dz]);
  }
  return ps;
}
function label(text, pt, screen, from = 0, to = 1) {
  callouts.push({ text, pt, screen, from, to });
}
function camera(pt, axis, dist, drift = 0.11) {
  cam = { pt, axis, dist, drift };
}
function block(x, y, z, w, h, t, c = BOARD, p = group) {
  return add(mesh(new Nn(w, h, t), c, p), [x, y, z]);
}
function setbase(full = true) {
  for (let k = 0; k < 2; k++) {
    let holes = [[0, 0, 5]];
    for (let d of [5, 58, 160, 215]) {
      let ang = (d * Math.PI) / 180;
      let cx = 106 * Math.cos(ang),
        cy = 106 * Math.sin(ang);
      const pts = [];
      for (let [a, b] of [
        [-1, -8],
        [1, -8],
        [1, 8],
        [-1, 8],
      ])
        pts.push([
          cx + a * Math.cos(ang) - b * Math.sin(ang),
          cy + a * Math.sin(ang) + b * Math.cos(ang),
        ]);
      holes.push(pts);
    }
    let sh = new yi();
    sh.moveTo(-140, -140);
    sh.lineTo(140, -140);
    sh.lineTo(140, 140);
    sh.lineTo(-140, 140);
    sh.closePath();
    shapeHoles(sh, [holes[0]]);
    for (let pts of holes.slice(1)) {
      let h = new xi();
      h.moveTo(...pts[0]);
      for (let pt of pts.slice(1)) h.lineTo(...pt);
      h.closePath();
      sh.holes.push(h);
    }
    let m = add(mesh(shapeGeom(sh, 2.95), [k ? BOARD : PLY, EDGE]), [
      0,
      0,
      1.5 + 3 * k,
    ]);
    if (sc === 0) animate(m, 0.02 + k * 0.12, 0.18 + k * 0.12, [0, 0, 35]);
  }
  for (const [i, d] of [-15, 60, 202.5].entries()) {
    let a = (d * Math.PI) / 180;
    let m = block(72 * Math.cos(a), 72 * Math.sin(a), 7.5, 14, 24, 3);
    m.rotation.z = a;
    if (sc === 0) animate(m, 0.32 + i * 0.08, 0.44 + i * 0.08);
  }
  let hub = ring(0, 0, 7, 5, 2, 14);
  if (sc === 0) animate(hub, 0.61, 0.75);
  for (let k = 0; k < (full ? 2 : 1); k++) {
    let v = ring(0, 0, 10.5 + 3 * k, 80, 5.5, 2.94, k ? BOARD : PLY, group, [
      [-66, -24, 1],
      [-66, 24, 1],
    ]);
    if (sc === 0) animate(v, 0.76, 0.95, [0, 0, 45]);
    if (sc === 1 && k) animate(v, 0.45, 0.57, [0, 0, 45]);
  }
  if (!full) return;
  for (let side of [-1, 1]) {
    let p = [
      [-117, side * 80, 12],
      [0, side * 80, 12],
      ...arc(0, 0, 12, 80, (side * Math.PI) / 2, side * (Math.PI - 0.3)),
      [-66, side * 24, 12],
      [-66, side * 24, 13],
      ...tie(-66, side * 24, 12, Y, "x", 1.1),
    ];
    wire(p, Y, 1, sc === 1 ? 0.01 : -2, side === 1 ? 0.43 : 0.34);
  }
  for (let [j, d] of [5, 58, 160, 215].entries()) {
    let a = (d * Math.PI) / 180;
    for (let k = 0; k < 3; k++) {
      let v = block(
        97 * Math.cos(a),
        97 * Math.sin(a),
        7.5 + 3 * k,
        12,
        16,
        2.95,
      );
      v.rotation.z = a;
      if (sc === 1)
        animate(
          v,
          0.54 + 0.024 * (j * 3 + k),
          0.61 + 0.024 * (j * 3 + k),
          [0, 0, 22],
        );
    }
  }
  for (let k = 0; k < 2; k++) {
    let v = ring(0, 0, 17.25 + k * 3, 105, 73, 2.95, k ? 0x799b83 : 0x688979);
    if (sc === 1) animate(v, 0.8 + 0.05 * k, 0.9 + 0.05 * k, [0, 0, 36]);
  }
  for (let [j, d] of [5, 58, 160, 215].entries()) {
    let a = (d * Math.PI) / 180;
    let g = obj(0, 0, 0);
    g.rotation.z = a;
    for (let [x, z, w, h] of [
      [101, 22, 13, 0.6],
      [106.2, 11, 1, 21],
      [114, 0.1, 16, 0.6],
    ])
      block(x, 0, z, w, 13, h, PLY, g);
    if (sc === 1) animate(g, 0.91 + j * 0.009, 0.97 + j * 0.009, [0, 0, 7]);
  }
}
function mast() {
  for (let side of [-1, 1])
    for (let k of [0, 1]) {
      const s = new yi();
      s.moveTo(0, 0);
      s.lineTo(30, 0);
      s.lineTo(0, 45);
      s.closePath();
      let q = mesh(shapeGeom(s, 3), [BOARD, EDGE]);
      q.rotation.order = "ZXY";
      q.rotation.x = Math.PI / 2;
      q.rotation.z = (side * Math.PI) / 2;
      q.position.set(-22 + 3 * k, side * 20, 15);
      if (sc === 2)
        animate(q, 0.48 + 0.05 * k, 0.64 + 0.04 * k, [0, side * 12, 20]);
    }
  for (let j = 0; j < 2; j++) {
    let side = j ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      let v = plate(
        -5,
        side * (15.5 + 3 * k),
        126,
        54,
        222,
        2.95,
        [
          [5, 49, 3],
          [5, 89, 3],
        ],
        true,
        k ? BOARD : PLY,
      );
      if (sc === 2)
        animate(v, 0.02 + j * 0.18 + k * 0.07, 0.17 + j * 0.18 + k * 0.07, [
          0,
          side * 42,
          23,
        ]);
    }
    let d = plate(
      -5,
      side * 21.5,
      194,
      54,
      76,
      3,
      [
        [5, -19, 3],
        [5, 21, 3],
      ],
      true,
    );
    if (sc === 2)
      animate(d, 0.41 + j * 0.06, 0.53 + j * 0.06, [0, side * 40, 0]);
    for (let k = 0; k < 2; k++) {
      let g = plate(
        -31,
        side * (21.5 + 3 * k),
        65,
        62,
        20,
        3,
        [[-23, 0, 3]],
        true,
      );
      if (sc === 2)
        animate(g, 0.71 + 0.035 * (2 * j + k), 0.8 + 0.035 * (2 * j + k), [
          -30,
          side * 20,
          0,
        ]);
    }
  }
  for (let x of [-29, 19])
    for (let k = 0; k < 2; k++) {
      let v = block(x + k * 3, 0, 81, 2.98, 28, 132);
      if (sc === 2)
        animate(
          v,
          0.53 + (x > 0 ? 0.08 : 0) + 0.035 * k,
          0.62 + (x > 0 ? 0.08 : 0) + 0.035 * k,
          [0, 0, 64],
        );
    }
  let b = guide([-54, -19, 65], [-54, 19, 65]);
  let h = seg([-54, -27, 65], [-54, 27, 65], 2, PLY);
  if (sc === 2) {
    animate(b, 0.88, 0.94, [0, -48, 0]);
    animate(h, 0.94, 1, [0, -58, 0]);
  }
}
function wall(sign, p = group, patch = true, anim = false) {
  const yy = sign;
  let v = plate(
    upperCenter,
    yy * 11.5,
    0,
    upperLength,
    arm.upper.t,
    3,
    [
      [-upperCenter, 0, 3],
      [span - upperCenter, 0, 3],
      [5 - upperLength / 2, 0, 1],
    ],
    true,
    BOARD,
    p,
  );
  let w = plate(
    upperCenter,
    yy * 8.5,
    0,
    upperLength,
    arm.upper.web_h,
    3,
    [
      [-upperCenter, 0, 3],
      [span - upperCenter, 0, 3],
      [5 - upperLength / 2, 0, 1],
    ],
    true,
    PLY,
    p,
  );
  if (anim) {
    let at = sign < 0 ? 0.02 : 0.42;
    animate(v, at, at + 0.13, [0, yy * 30, 10]);
    animate(w, at + 0.1, at + 0.23, [0, -yy * 14, 18]);
  }
  if (patch)
    for (let [j, x] of [0, span].entries())
      for (let k = 0; k < 2; k++) {
        let q = plate(
          x,
          yy * (5.5 - 3 * k),
          0,
          28,
          16,
          2.96,
          [[0, 0, 3]],
          true,
          k ? BOARD : PLY,
          p,
        );
        if (anim) {
          let at = (sign < 0 ? 0.22 : 0.66) + 0.044 * (2 * j + k);
          animate(q, at, at + 0.12, [0, -yy * 12, 20]);
        }
      }
}
const lanes = [
  [-4, -7, W],
  [-4, 7, A],
  [4, 0, B],
];
function route(ch, mode, p = group) {
  const [cy, cz, color] = lanes[ch],
    sg = Math.sign(cy),
    rack = obj(0, 0, 0, p);
  if (mode === "active") animate(rack, 0, 0.85, [0, -sg * 0, 0]);
  for (let x of [32, 95]) {
    let tubeBody = guide([x, cy, cz], [x + 12, cy, cz], 3, rack);
    if (mode === "active") {
      tubeBody.children[0].material = new nr({
        color: ST,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
    }

    for (let at of [x + 2, x + 9]) {
      let bead = seg(
        [at, sg * 6.8, cz - 1.5],
        [at + 0.9, sg * 6.8, cz + 1.5],
        0.75,
        GLUE,
        p,
      );
      if (mode === "active") animate(bead, 0.59, 0.68, [0, 0, 0]);
    }
  }
  if (mode === "active") {
    ids.push({ bundle: rack, sg, at: 0.7, end: 0.91 });
  }
  for (let k = 0; k < 2; k++) {
    let y = cy + (k - 0.5) * 1.45,
      z = cz;
    let ps = [
      [24, y - 1, cz + 3],
      [29, y, cz],
      [32, y, z],
      [44, y, z],
      [95, y, z],
      [107, y, z],
      [114, y, z],
      [119, y + 1.5, z + 2],
    ];
    wire(
      ps,
      color,
      0.55,
      mode === "active" ? 0.1 + 0.16 * k : -2,
      0.49 + 0.12 * k,
      rack,
    );
  }
}
function lid(p = group, anim = false) {
  let m = plate(
    upperCenter,
    0,
    16.5,
    upperLength,
    arm.upper.w - 6,
    3,
    [
      [78 - upperLength / 2, -7, 12, 14],
      [upperLength / 2 - 39, -7, 12, 14],
    ],
    false,
    BOARD,
    p,
  );
  if (anim) animate(m, 0.52, 0.96, [0, 0, 36]);
  return m;
}
function upper(p = group) {
  wall(-1, p);
  wall(1, p);
  block(upperCenter, 0, -16.5, upperLength, arm.upper.w - 6, 3, BOARD, p);
  for (let ch = 0; ch < 3; ch++) route(ch, "fixed", p);
  lid(p);
}
function lower(p) {
  for (let s of [-1, 1]) {
    plate(
      lowerCenter,
      s * 11.5,
      0,
      lowerLength,
      arm.fore.t,
      3,
      [
        [-lowerCenter, 0, 3],
        [arm.fore.L - lowerCenter, 0, 3],
      ],
      true,
      BOARD,
      p,
    );
    for (let x of [0, span])
      for (let k of [0, 1])
        plate(x, s * (8.5 - 3 * k), 0, 28, 16, 3, [[0, 0, 3]], true, PLY, p);
  }
  for (let z of [-10.5, 10.5])
    block(lowerCenter, 0, z, lowerLength, arm.fore.w - 6, 3, BOARD, p);
}
function assembleArm(ani = false) {
  let angle = (8 * Math.PI) / 180,
    fx = arm.fore.L * Math.cos(angle),
    fz = shoulder + arm.fore.L * Math.sin(angle);
  for (let k = 0; k < 2; k++) {
    let par = obj(0, 0, shoulder + k * arm.column.pin_spacing);
    par.rotation.y = -angle;
    (k ? upper : lower)(par);
    if (ani) animate(par, 0.02 + 0.16 * k, 0.19 + 0.16 * k, [55, 0, 37]);
  }
  for (let s of [-1, 1])
    for (let k of [0, 1]) {
      let q = plate(
        fx + 6,
        s * (17.5 + 3 * k),
        fz + 17.5,
        39,
        73,
        2.96,
        [
          [-6, -17.5, 3],
          [-6, 22.5, 3],
        ],
        true,
        k ? BOARD : PLY,
      );
      if (ani)
        animate(
          q,
          0.36 + 0.04 * (k + (s > 0 ? 2 : 0)),
          0.48 + 0.04 * (k + (s > 0 ? 2 : 0)),
          [0, s * 32, 10],
        );
    }
  let j = 0;
  for (let x of [0, fx])
    for (let h of [0, arm.column.pin_spacing]) {
      let z = (x ? fz : shoulder) + h;
      let g = guide([x, -13, z], [x, 13, z]);
      let pin = seg([x, -25, z], [x, 25, z], 2.1, PLY);
      if (ani) {
        animate(g, 0.57 + 0.07 * j, 0.65 + 0.07 * j, [0, -48, 0]);
        animate(pin, 0.63 + 0.07 * j, 0.71 + 0.07 * j, [0, -62, 0]);
      }
      for (let s of [-1, 1]) {
        let wa = ring(x, s * (x ? 23 : 24), z, 7, 3, 2.8);
        wa.rotation.x = Math.PI / 2;
        if (ani)
          animate(wa, 0.85 + 0.018 * j, 0.93 + 0.018 * j, [0, s * 30, 0]);
      }
      j++;
    }
  return [fx, fz];
}
function wr(k, p = group) {
  return ring(0, 0, k ? -20.5 : -31.5, 34, 13, 3, BOARD, p);
}
function neck(p = group, ani = false) {
  for (let i = 0; i < 7; i++) {
    let g = ring(0, 0, -36.5 + i * 3, 12, 8, 2.94, i % 2 ? BOARD : PLY, p);
    if (ani) animate(g, 0.015 + i * 0.075, 0.13 + i * 0.075, [0, 0, 35]);
  }
  let v = ring(0, 0, -36.5, 15, 12, 3, PLY, p);
  if (ani) animate(v, 0.61, 0.77, [0, 0, -22]);
  let w = wr(false, p);
  if (ani) animate(w, 0.79, 0.98, [0, 0, 38]);
}
function spool(p = group, ani = false) {
  for (let k = 0; k < 2; k++) {
    let g = ring(0, 0, -27.5 + 3 * k, 20, 12, 2.95, k ? PLY : BOARD, p, [
      [-15, 0, 0.8],
      [15, 0, 0.8],
    ]);
    if (ani) animate(g, k ? 0.83 : 0, k ? 0.99 : 0.12, [0, 0, 19]);
  }
  for (let [i, s] of [-1, 1].entries()) {
    let g = guide([-23, s * 20, -26], [-15, s * 20, -26], 3, p);
    if (ani) animate(g, 0.1 + i * 0.1, 0.24 + i * 0.1, [0, 0, 17]);
    let ps = [
      [-37, s * 20, -26],
      [-23, s * 20, -26],
      [-15, s * 20, -26],
      [0, s * 20, -26],
      ...arc(0, 0, -26, 20, (s * Math.PI) / 2, s > 0 ? 0 : -Math.PI),
      [s * 15, 0, -26],
      [s * 15, 0, -28.5],
      ...tie(s * 15, 0, -28.5, W, "x", 0.8),
    ];
    wire(ps, W, 0.65, ani ? 0.31 + i * 0.15 : -2, 0.65 + i * 0.15, p);
  }
}
function closewr(p = group, ani = false) {
  for (let i = 0; i < 2; i++)
    for (let k = 0; k < 2; k++) {
      let m = block(i ? 28 : -28, 0, -28.5 + 3 * k, 6, 10, 2.98, PLY, p);
      if (ani)
        animate(
          m,
          0.05 + 0.08 * (i * 2 + k),
          0.16 + 0.08 * (i * 2 + k),
          [0, 0, 24],
        );
    }
  for (let x of [-28, 28]) {
    let m = block(x, 0, -23, 6, 10, 2, WHITE, p);
    if (ani) animate(m, 0.4, 0.49, [0, 0, 15]);
  }
  let top = wr(true, p);
  if (ani) animate(top, 0.51, 0.72, [0, 0, 42]);
}
function palmPost(p = group) {
  for (let [x, y, w] of [
    [-10.5, 0, 30],
    [10.5, 0, 30],
    [0, -13.5, 18],
    [0, 13.5, 18],
  ]) {
    const s = new yi(),
      w2 = w / 2;
    s.moveTo(-w2, -7.5);
    s.lineTo(-3, -7.5);
    s.lineTo(-3, -1.5);
    s.lineTo(3, -1.5);
    s.lineTo(3, -7.5);
    s.lineTo(w2, -7.5);
    s.lineTo(w2, 7.5);
    s.lineTo(-w2, 7.5);
    s.closePath();
    const g = mesh(shapeGeom(s, 3), [BOARD, EDGE], p);
    g.rotation.x = Math.PI / 2;
    if (x) g.rotation.z = Math.PI / 2;
    g.position.set(x, y, -45.5);
  }
}
function grip(p) {
  let src = X0.build({ a: 0.64, b: 0.25, s: 0, palmH: 280, obj: null });
  for (let C of src.parts) {
    if (
      C.ghost ||
      C.body.startsWith("whiffle") ||
      (sc === 14 && C.id.startsWith("drum."))
    )
      continue;
    let [d, w, h] = C.size,
      geo = C.id.startsWith("drum.")
        ? drumWithBore(d, w)
        : ["straw", "bubble", "disk"].includes(C.kind)
          ? new Fn(w / 2, w / 2, d, 20).rotateZ(Math.PI / 2)
          : new Nn(d, w, h);
    const g = mesh(
      geo,
      C.kind === "nail"
        ? 0xe6a835
        : C.body.startsWith("flap")
          ? 0x8ca783
          : C.body.startsWith("hard")
            ? 0x628699
            : BOARD,
      p,
    );
    g.matrix.copy(C.m);
    g.matrixAutoUpdate = false;
  }
  return src;
}
function drumcord(src, id, col, start, p) {
  let C = src.parts.find((v) => v.id === id),
    r = C.size[1] / 2 - 2;
  let angle = id.includes("drum.R") || id.includes("drum.L") ? Math.PI : TAU;
  let local = [
    [0, -r, 38],
    [0, -r, 21],
    [0, -r, 0],
  ];
  for (let i = 1; i <= 48; i++) {
    let a = (i * angle) / 48;
    local.push([0, -r * Math.cos(a), -r * Math.sin(a)]);
  }
  const yy = -r * Math.cos(angle),
    zz = -r * Math.sin(angle);
  local.push(
    [1.45, yy, zz],
    [3.6, yy, zz],
    [5, yy, zz],
    ...tie(5, yy, zz, col, "x", 1.15),
  );
  let world = local.map((q) => vec(q).applyMatrix4(C.m).toArray());
  wire(world, col, 0.67, start, start + 0.32, p);
  return world.at(-1);
}
function panel(ani = false) {
  plate(0, 0, 0, 118, 212, 6);
  let colors = [Y, L, W, A, B];
  for (let j = 0; j < 5; j++)
    for (let s of j === 1 ? [0] : [-1, 1]) {
      let y = -82 + j * 41 + 8 * s;
      let m = block(41, y, 4.5, 14, 7, 3);
      let q = guide([35, y, 9], [47, y, 9]);
      if (ani) {
        let j2 = j * 0.06 + (s === 1 ? 0.03 : 0);
        animate(m, j2, 0.07 + j2, [0, 0, 18]);
        animate(q, 0.08 + j2, 0.16 + j2, [0, 0, 22]);
      }
      let tip = [-36, y, 9];
      wire(
        [[68, y, 9], [47, y, 9], [35, y, 9], tip],
        colors[j],
        0.73,
        ani ? 0.36 + 0.05 * j : -2,
        0.54 + 0.05 * j,
      );
      if (j < 3) {
        let h = plate(
          -37,
          y,
          8,
          34,
          10,
          6,
          [
            [-7, 0, 1],
            [7, 0, 1],
          ],
          false,
          PLY,
        );
        if (ani) animate(h, 0.65 + j * 0.045, 0.76 + j * 0.045, [-14, 0, 12]);
        wire(
          [tip, ...tie(-36, y, 9, colors[j], "x", 1.4)],
          colors[j],
          0.65,
          ani ? 0.8 : -2,
          0.97,
        );
      }
    }
  let eq = plate(
    -35,
    41,
    8,
    10,
    34,
    6,
    [
      [0, -12, 1],
      [0, 0, 1],
      [0, 12, 1],
    ],
    false,
    PLY,
  );
  if (ani) animate(eq, 0.77, 0.9, [0, 0, 17]);
  for (let s of [-1, 1])
    wire(
      [
        [-34, 41 + s * 8, 9],
        [-35, 41 + s * 12, 11],
        ...tie(-35, 41 + s * 12, 11, A, "x", 1),
      ],
      A,
      0.65,
      ani ? 0.86 : -2,
      0.98,
    );
}
function showStage(index) {
  if (group) {
    Li.remove(group);
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
  group = new Oe();
  Li.add(group);
  ids = [];
  callouts = [];
  sc = index;
  const lab = (t, p, x, y, f = 0, to = 1) => label(t, p, [x, y], f, to);
  if (sc === 18) {
    for (let side of [-1, 1]) {
      plate(2, side * 11.5, 0, 23, 36, 3, [], true, BOARD);
      plate(2, side * 8.5, 0, 23, 30, 3, [], true, PLY);
    }
    block(2, 0, -16.5, 23, 20, 3);
    for (let [j, [yy, zz, col]] of lanes.entries()) {
      let g = guide([-6, yy, zz], [6, yy, zz]);
      g.children[0].material = new nr({
        color: ST,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
      });
      for (let k of [-1, 1]) {
        seg(
          [k * 3, Math.sign(yy) * 6.6, zz - 1.3],
          [k * 3 + 1, Math.sign(yy) * 6.6, zz + 1.3],
          0.65,
          GLUE,
        );
        wire(
          [
            [18, yy + k * 0.85, zz],
            [6, yy + k * 0.85, zz],
            [-6, yy + k * 0.85, zz],
            [-16, yy + k * 0.85, zz],
          ],
          col,
          0.61,
          0.08 + j * 0.18,
          0.36 + j * 0.19,
        );
      }
    }
    camera([2, 0, 0], [1, -0.1, 0.3], 71, 0.34);
    lab("왼쪽 위 · A 두 가닥", [6, -4, 7], 0.12, 0.27);
    lab("왼쪽 아래 · W 두 가닥", [6, -4, -7], 0.12, 0.73);
    lab("오른쪽 중앙 · B 두 가닥", [6, 4, 0], 0.74, 0.48);
    lab("접착점 · 관 바깥만", [3, 6.6, 1.3], 0.67, 0.72, 0.77);
  } else if (sc < 2) {
    setbase(sc !== 0);
    camera([0, 0, 12], [0.56, -1, 0.81], sc ? 505 : 545);
    lab(
      sc ? "D · 매듭 매립" : "P · 미끄럼 패드",
      sc ? [-66, -24, 13] : [69, -19, 9],
      0.17,
      0.42,
      sc ? 0.05 : 0.35,
      sc ? 0.51 : 0.84,
    );
    if (sc) lab("K · 바닥에 고정", [67, -70, 21], 0.78, 0.66, 0.76);
  } else if (sc === 2) {
    setbase();
    mast();
    camera([-6, 0, 123], [0.65, -1, 0.52], 435);
    lab("TG · 뒤쪽 가이드축", [-54, -24, 65], 0.17, 0.68, 0.75);
    lab("TD · 바깥 덧판", [0, -23, 215], 0.77, 0.29, 0.5);
  } else if (sc === 3) {
    wall(-1, group, true, true);
    wall(1, group, true, true);
    camera([42, 0, 0], [0.32, -1, 0.8], 276);
    lab("J · 축마다 두 겹", [0, -3, 2], 0.14, 0.73, 0.26);
    lab("UW · 안쪽 덧판", [100, 8, 11], 0.73, 0.28, 0.57);
  } else if (sc >= 4 && sc <= 6) {
    let ch = sc - 4,
      s = ch === 2 ? 1 : -1;
    wall(s);
    if (ch === 1) route(0, "fixed");
    route(ch, "active");
    camera([70, s * 6, 0], [s * 0.42, -s * 1, 0.51], 174, 0.25);
    let cy = lanes[ch][0],
      z = lanes[ch][1];
    lab("① 관 입구 · 빨대 투시", [32, cy - s * 15, z], 0.12, 0.33, 0.08, 0.65);
    lab("② 뒤쪽 관 → 앞쪽 관", [96, cy - s * 15, z], 0.64, 0.23, 0.24, 0.68);
    lab("③ 글루점 · 관의 옆면", [98, s * 6.7, z + 1], 0.63, 0.66, 0.62);
    lab(
      ch === 2 ? "오른벽 안쪽" : "왼벽 안쪽",
      [53, s * 7, 12],
      0.17,
      0.62,
      0.68,
    );
  } else if (sc === 7) {
    wall(-1);
    wall(1);
    block(upperCenter, 0, -16.5, upperLength, arm.upper.w - 6, 3);
    for (let ch = 0; ch < 3; ch++) {
      route(ch, "fixed");
      let [y, z, c] = lanes[ch];
      for (let s of [-1, 1]) {
        let yy = y + s * 0.76;
        wire(
          [
            [32, yy, z],
            [25, yy, z + 4],
            [24, yy, 16],
            [24, yy, 51],
            [14, yy, 63],
          ],
          c,
          0.55,
          0.04 + 0.055 * ch,
          0.34 + 0.04 * ch,
        );
        wire(
          [
            [107, yy, z],
            [117, yy, z + 4],
            [122, yy, 18],
            [122, yy, 52],
            [134, yy, 61],
          ],
          c,
          0.55,
          0.1 + 0.06 * ch,
          0.44 + 0.03 * ch,
        );
      }
    }
    lid(group, true);
    camera([49, 0, 19], [0.44, -1, 0.8], 278);
    lab("뒤창 · 기둥 쪽", [24, 0, 18], 0.16, 0.68, 0.54);
    lab("앞창 · 손목 쪽", [122, 0, 18], 0.73, 0.27, 0.55);
  } else if (sc === 8) {
    mast();
    assembleArm(true);
    camera([56, 0, 179], [0.48, -1, 0.46], 400);
    lab("빨대 부싱 → 젓가락 핀", [138, -18, 194], 0.72, 0.55, 0.54);
    lab("와셔는 핀에만 접착", [0, -24, 215], 0.18, 0.34, 0.82);
  } else if (sc === 9) {
    wall(-1);
    wall(1);
    let q = guide([-62, -16, 0], [-48, -16, 0], 2.6);
    animate(q, 0.36, 0.52, [0, -10, 8]);
    let path = [
      [-52, 24, -22],
      [-55, 16, 0],
      [-55, 8, 0],
      [-55, -8, 0],
      [-55, -13, 0],
    ];
    for (let j = 0; j < 64; j++) {
      let a = (j / 63) * TAU * 2;
      path.push([
        -56 + (j / 63) * 3,
        -16 + 2.95 * Math.cos(a),
        2.95 * Math.sin(a),
      ]);
    }
    path.push([-52.8, -14, 2.7], [-53.4, -12.5, 2.4]);
    for (let loop = 0; loop < 2; loop++) {
      const y0 = -12.5 + loop * 2.45;
      for (let j = 0; j <= 30; j++) {
        let a = (j / 30) * TAU,
          rad = 1.55 + 0.25 * Math.sin(a);
        path.push([
          -55 + rad * Math.cos(a),
          y0 + (j / 30) * 1.3,
          rad * Math.sin(a),
        ]);
      }
      path.push(
        [-53.1, y0 + 0.25, -1.1],
        [-54.3, y0 + 0.9, -0.8],
        [-53.5, y0 + 2.2, 0.3],
      );
    }
    path.push([-51, -8, 3.5], [-49, -7, 5]);
    wire(path, L, 0.59, 0.04, 0.92);
    camera([-54, -5, 1], [-0.73, -1, 0.6], 62, 0.25);
    lab("Ø2 꼬리 구멍", [-55, -11.5, 0], 0.14, 0.36, 0.07, 0.47);
    lab("가로 빨대 · 2회 감기", [-55, -17, 1], 0.64, 0.23, 0.45, 0.8);
    lab("끝 매듭", [-51, -13, 1], 0.69, 0.66, 0.78);
  } else if (sc === 10) {
    neck(group, true);
    camera([0, 0, -24], [0.52, -1, 0.76], 119);
    lab("Ø16 · 네 가닥 통로", [0, 0, -16], 0.17, 0.34, 0.15);
    lab("아래 WR · 고정 링", [24, -14, -31], 0.74, 0.65, 0.79);
  } else if (sc === 11) {
    neck();
    spool(group, true);
    camera([-2, 0, -26], [0.4, -1, 1.18], 123, 0.22);
    lab("W 접선 빨대 · 8 mm", [-19, -20, -26], 0.12, 0.6, 0.15, 0.65);
    lab("RF 구멍에 묶기", [15, 0, -26], 0.73, 0.35, 0.65, 0.87);
    lab("윗장으로 매듭 덮기", [8, 12, -24.5], 0.71, 0.61, 0.86);
  } else if (sc === 12) {
    neck();
    spool();
    closewr(group, true);
    for (let s of [-1, 1])
      for (let k of [0, 1]) {
        let q = plate(
          -13,
          s * (17.5 + 3 * k),
          17.5,
          39,
          73,
          2.96,
          [
            [-6, -17.5, 3],
            [-6, 22.5, 3],
          ],
          true,
          BOARD,
        );
        animate(q, 0.72 + 0.04 * k, 0.91 + 0.05 * k, [0, 0, 40]);
      }
    camera([0, 0, -5], [0.48, -1, 0.55], 185);
    lab("WS · 앞뒤 간격재", [28, 0, -25], 0.74, 0.55, 0.2, 0.7);
    lab("C · 아래면에 접착", [-15, -18, -19], 0.13, 0.62, 0.77);
  } else if (sc === 13) {
    neck();
    spool();
    closewr();
    palmPost();
    for (let j = 0; j < 4; j++) {
      let s = j % 2 ? 1 : -1,
        ch = j < 2 ? A : B,
        xx = j < 2 ? s * 3.5 : 0,
        yy = j >= 2 ? s * 3.5 : 0;
      let tx = j < 2 ? s * 24 : 0,
        ty = j >= 2 ? s * 27 : 0;
      wire(
        [
          [xx * 2, yy * 2, 3],
          [xx, yy, -14],
          [xx, yy, -36],
          [xx, yy, -44],
          [tx / 2, ty / 2, -50],
          [tx, ty, -50],
          [tx * 1.12, ty * 1.12, -54],
        ],
        ch,
        0.69,
        0.03 + j * 0.16,
        0.38 + j * 0.16,
      );
    }
    camera([0, 0, -32], [0.55, -1, 0.29], 126, 0.25);
    lab("위 입구 · A와 B만", [0, 0, -16], 0.19, 0.29, 0.02, 0.62);
    lab("M / I 아래 옆문", [10.5, 0, -50], 0.72, 0.67, 0.36);
  } else if (sc === 14) {
    const src = grip(group);
    for (let q of group.children)
      if (q.isMesh) {
        q.material = new nr({
          color: q.material.color,
          transparent: true,
          opacity: 0.24,
          depthWrite: false,
        });
      }
    for (const [j, id] of ["drum.R", "drum.L", "drum.F", "drum.B"].entries()) {
      const C = src.parts.find((k) => k.id === id),
        mount = obj(0, 0, 0);
      mount.matrix.copy(C.m);
      mount.matrixAutoUpdate = false;
      let rad = C.size[1] / 2;
      for (let k of [-1, 0, 1]) {
        let sh = new yi();
        sh.absarc(0, 0, rad - (k === 0 ? 3 : 0), 0, TAU, false);
        shapeHoles(sh, [
          [0, 0, 3],
          ...(k === 1
            ? [[0, -(rad - 2) * Math.cos(j < 2 ? Math.PI : TAU), 0.85]]
            : []),
        ]);
        let q = mesh(
          shapeGeom(sh, 2.94).rotateY(Math.PI / 2),
          [j < 2 ? 0x96ad83 : 0x69889c, EDGE],
          mount,
        );
        q.position.x = k * 3;
        if (k === 1)
          q.material = new nr({
            color: j < 2 ? 0x96ad83 : 0x69889c,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          });
      }
      drumcord(
        src,
        id,
        j < 2 ? A : B,
        j < 2 ? 0.04 + j * 0.04 : 0.52 + (j - 2) * 0.025,
        group,
      );
    }
    camera([30, 33, 6], [1, 0.66, 0.55], 95, 0.15);
    lab("A · 좌우 드럼 / 반 바퀴", [30, 33, 6], 0.14, 0.29, 0.02, 0.45);
    lab("B · 앞뒤 드럼 / 한 바퀴", [0, 37.5, -20], 0.7, 0.66, 0.54);
  } else if (sc === 15) {
    panel(true);
    camera([0, 0, 6], [0.78, -0.45, 1.3], 328, 0.15);
    lab("G2 · 조작판 고정면", [41, -41, 6], 0.73, 0.64, 0.08, 0.52);
    lab("A · 균형막대 양끝", [-35, 41, 9], 0.12, 0.32, 0.7);
  } else if (sc === 16) {
    block(0, 0, 0, 148, 122, 6);
    let root = obj(0, 24, 0);
    for (let k = 0; k < 3; k++) {
      let q = ring(0, 0, 7 + k * 3, k === 1 ? 8 : 10, 2, 2.96, BOARD, root);
      animate(q, 0.04 + k * 0.06, 0.12 + k * 0.06, [0, 0, 18]);
    }
    wire(
      [
        [46, -8, 10],
        [0, -8, 10],
        ...arc(0, 0, 10, 8, -Math.PI / 2, (-3 * Math.PI) / 2),
        [46, 8, 10],
      ],
      B,
      0.8,
      0.2,
      0.43,
      root,
    );
    for (let k of [-1, 1]) {
      let q = plate(
        -8,
        0,
        10 + k * 6.5,
        30,
        12,
        2.97,
        [
          [8, 0, 2],
          [-9, 0, 1],
        ],
        false,
        PLY,
        root,
      );
      animate(q, 0.4 + (k + 1) * 0.025, 0.53 + (k + 1) * 0.02, [0, 0, k * 18]);
    }
    const axle = seg([0, 24, 1], [0, 24, 20], 1.8, PLY);
    animate(axle, 0.51, 0.62, [0, 0, 27]);
    for (let x of [-28, 5])
      for (let k of [0, 1]) block(x, -24, 4.5 + k * 3, 12, 9, 3, BOARD);
    let ps = [
      [59, -32, 8],
      [14, -32, 8],
      [0, -32, 8],
      [-32, -16, 8],
      [-35, -18, 8],
      [-36, -29, 8],
      [-30, -31, 8],
      [7, -16, 8],
      [13, -18, 8],
      [13, -29, 8],
      [9, -31, 8],
      [-29, -16, 8],
      [-36, -18, 8],
      [-36, -29, 8],
      [-29, -31, 8],
      [9, -17, 8],
      [14, -21, 8],
      [4, -26, 10],
      [0, -20, 11],
    ];
    wire(ps, L, 0.85, 0.59, 0.99);
    camera([0, 0, 8], [0.5, -1, 1.1], 207);
    lab("B · 움직도르래", [0, 24, 10], 0.13, 0.28, 0.06, 0.62);
    lab("L · 8자로 감고 걸기", [-10, -24, 9], 0.71, 0.67, 0.6);
  } else {
    setbase();
    mast();
    let [xx, zz] = assembleArm();
    let g = obj(xx + arm.wrist.forward, 0, zz);
    neck(g);
    spool(g);
    closewr(g);
    palmPost(g);
    let hand = obj(0, 0, -59, g);
    grip(hand);
    animate(hand, 0.01, 0.35, [0, 0, -40]);
    let globalRoot = group;
    group = obj(-219, 0, 0, globalRoot);
    panel(false);
    group = globalRoot;
    for (let j = 0; j < 5; j++) {
      let col = [Y, L, W, A, B][j],
        yy = -82 + j * 41;
      for (let sign of j === 1 ? [0] : [-1, 1]) {
        let sy = yy + sign * 8;
        let trail = [
          [-254, sy, 9],
          [-178, sy, 9],
          [-156, sy, 10],
          [-125, sy, 16],
        ];
        if (j === 0) trail.push([-102, sign * 80, 12], [0, sign * 80, 12]);
        else if (j === 1)
          trail.push([-72, -30, 56], [-54, -25, 65], [-55, -15, 207]);
        else
          trail.push(
            [-78, sy * 0.7, 49],
            [-48, sign * (18 + j), 65],
            [-40, sign * (16 + j), 189],
            [-10, sign * 9, 202],
          );
        wire(trail, col, 0.78);
      }
    }
    camera([-25, 0, 115], [0.55, -1, 0.52], 675, 0.26);
    for (let j = 0; j < 3; j++) {
      const [y, z, c] = lanes[j];
      wire(
        [
          [-70, y, 187],
          [-12, y, 203],
          [27, y, 235],
          [37, y, 226],
          [109, y, 237],
          [123, y, 250],
          [145, y, 246],
          [160, y, 219],
          [163, y, 204],
          [xx + 19, y, zz - 16],
        ],
        c,
        0.7,
      );
    }
    lab("U / L · 평행 링크", [65, -10, 220], 0.17, 0.31);
    lab("B5N · 하부 손목", [xx + arm.wrist.forward, 0, zz - 29], 0.75, 0.68);
  }
}
const output = document.createElement("canvas");
output.width = 1280;
output.height = 720;
const ctx = output.getContext("2d");
Ms.setSize(1280, 518, false);
Tn.aspect = 1280 / 518;
Tn.zoom = 1;
Tn.updateProjectionMatrix();
Li.background = new jt(0xf5f2e9);
function frame(index, u) {
  if (sc !== index) showStage(index);
  for (let it of ids) {
    let f = ease((u - it.at) / (it.end - it.at));
    if (it.line) {
      for (let s of it.arr) {
        let h = clamp((f * it.total - s.d) / s.len);
        s.o.visible = h > 0.001;
        if (h > 0) {
          s.o.scale.y = h;
          s.o.position.copy(s.a).lerp(s.b, 0.5 * h);
        }
      }
    } else if (it.bundle) it.bundle.position.y = -it.sg * 15 * (1 - f);
    else {
      it.o.visible = u >= it.at;
      it.o.position.copy(it.base).addScaledVector(vec(it.off), 1 - f);
    }
  }
  if (sc === 14) {
    let blend = ease((u - 0.4) / 0.16);
    cam.pt = [30 * (1 - blend), 33 + 4.5 * blend, 6 - 26 * blend];
  }
  let axis = vec(cam.axis)
      .applyAxisAngle(V(0, 0, 1), (u - 0.5) * cam.drift)
      .normalize(),
    target = vec(cam.pt);
  Tn.position.copy(target).addScaledVector(axis, cam.dist);
  Tn.lookAt(target);
  Tn.updateMatrixWorld();
  Ms.render(Li, Tn);
  ctx.fillStyle = "#f9f6ef";
  ctx.fillRect(0, 0, 1280, 720);
  ctx.drawImage(Ms.domElement, 0, 83, 1280, 518);
  ctx.fillStyle = "#1c6b60";
  ctx.font = "bold 17px system-ui";
  ctx.fillText("R5-F1   /   골판지 로봇팔 제작", 35, 29);
  ctx.fillStyle = "#252f2c";
  ctx.font = "bold 32px system-ui";
  ctx.fillText(
    (index === 18 ? "07a" : String(index + 1).padStart(2, "0")) +
      "    " +
      META[index][0],
    33,
    68,
  );
  ctx.textAlign = "right";
  ctx.font = "19px system-ui";
  ctx.fillText("A3   " + META[index][1], 1243, 57);
  ctx.textAlign = "left";
  for (let l of callouts) {
    if (u < l.from || u > l.to) continue;
    let p = vec(l.pt).project(Tn),
      px = (p.x + 1) * 640,
      py = 83 + (1 - p.y) * 259,
      tx = l.screen[0] * 1280,
      ty = 83 + l.screen[1] * 518;
    ctx.font = "bold 18px system-ui";
    let w = ctx.measureText(l.text).width + 22;
    ctx.strokeStyle = "#47665b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx + w / 2, ty);
    ctx.stroke();
    ctx.fillStyle = "#365d52";
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(tx, ty - 15, w, 29);
    ctx.strokeStyle = "#a3b2a8";
    ctx.strokeRect(tx, ty - 15, w, 29);
    ctx.fillStyle = "#25433d";
    ctx.fillText(l.text, tx + 11, ty + 6);
  }
  ctx.fillStyle = "#203d36";
  ctx.font = "24px system-ui";
  ctx.fillText(META[index][2], 34, 642);
  let x = 35;
  for (const [name, col] of [
    ["W 손목", "#277bb9"],
    ["A Fin Ray", "#23845e"],
    ["B 집게", "#cd5f37"],
    ["Y 받침", "#8060a7"],
    ["L 올림", "#d54845"],
    ["빨대", "#4aafa7"],
  ]) {
    ctx.fillStyle = col;
    ctx.fillRect(x, 674, 18, 6);
    ctx.fillStyle = "#444c46";
    ctx.font = "16px system-ui";
    ctx.fillText(name, x + 25, 683);
    x += 145;
  }
  ctx.fillStyle = "#b3c6ba";
  ctx.fillRect(0, 715, 1280, 5);
  ctx.fillStyle = "#348578";
  ctx.fillRect(0, 715, ((index + u) * 1280) / META.length, 5);
  return output.toDataURL("image/jpeg", 0.88).split(",")[1];
}
window.solidFrame = frame;
