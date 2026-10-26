'use strict';
// 3/4-ready head constructor (Loomis ball + muzzle volume) for seven species.
// Everything is authored in head-local units (R = cranium radius = 1; x right, y down, z = face forward)
// and placed in the world by a rigid frame and a scale.
const G = require('./geom');
const B = require('./build');
const Cc = require('./color');
const E = require('./eye');
const Ln = require('./line');
const M = require('./march');
const { path, g } = require('./svg');

const mirrorX = p => [-p[0], p[1], p[2]];
const both = (fn) => [fn(-1), fn(1)];

// ---------------- species definitions ----------------
// prims: list of [name, prim] in unit space. ears: ear spec. eyes: placement. nose/mouth: shapes and anchors.
const SPECIES = {
  cat: {
    prims: () => [
      ['cranium', B.ell([0, 0, 0], [1, 0.95, 0.94])],
      ...both(s => ['cheek', B.ell([0.42 * s, 0.32, 0.3], [0.5, 0.44, 0.5])]),
      ['jaw', B.ell([0, 0.52, 0.42], [0.36, 0.3, 0.38])],
      ...both(s => ['muzzle', B.ell([0.16 * s, 0.42, 0.8], [0.22, 0.17, 0.19])]),
      ['muzzle', B.ell([0, 0.6, 0.72], [0.14, 0.11, 0.13])],
      ['muzzle', B.ellBetween([0, 0.0, 0.83], [0, 0.32, 0.97], 0.12, 0.1)],
    ],
    k: 0.07,
    ear: { base: [0.6, -0.6, 0.02], w: 0.42, h: 0.82, out: 0.42, back: -0.12, poly: [[-1, 0], [-0.55, 0.45], [-0.05, 1], [0.35, 0.5], [1, 0.02], [0, -0.1]], cup: [0.6, 0.2] },
    eyes: { theta: 0.47, phi: 0.07, w: 0.3, r: 0.97, tilt: 0.18, pupil: 'slit' },
    nose: { at: [0, 0.24], shape: 'cat', w: 0.2, h: 0.13 },
    mouth: { center: [0, 0.47], corner: [0.22, 0.45], depth: 0.06, kind: 'cat' },
    whiskers: { from: [[0.22, 0.43], [0.22, 0.5]], len: 0.72, spread: 0.2 },
    muzzleBox: [0, 0.48, 0.74, 0.42, 0.3, 0.38],
  },
  fennec: {
    prims: () => [
      ['cranium', B.ell([0, 0, 0], [1, 0.92, 0.92])],
      ...both(s => ['cheek', B.ell([0.42 * s, 0.32, 0.25], [0.5, 0.42, 0.5])]),
      ['jaw', B.ell([0, 0.45, 0.45], [0.36, 0.26, 0.42])],
      ['muzzle', B.ellBetween([0, 0.28, 0.55], [0, 0.42, 1.38], 0.21, 0.17)],
      ['muzzle', B.ellBetween([0, 0.5, 0.55], [0, 0.52, 1.22], 0.15, 0.1)],
    ],
    k: 0.07,
    ear: { base: [0.5, -0.7, -0.05], w: 0.6, h: 1.85, out: 0.32, back: -0.18, poly: [[-1, 0], [-0.75, 0.5], [-0.12, 1], [0.45, 0.55], [1, 0.0], [0, -0.12]], cup: [0.75, 0.15] },
    eyes: { theta: 0.48, phi: 0.06, w: 0.31, r: 0.96, tilt: 0.12, pupil: 'slit' },
    nose: { at: [0, 0.27], shape: 'pad', w: 0.17, h: 0.12, color: '#231a1d', z: 1.36 },
    mouth: { center: [0, 0.5], corner: [0.26, 0.47], depth: 0.04, kind: 'canid' },
    whiskers: { from: [[0.1, 0.36], [0.12, 0.4]], len: 0.8, spread: 0.12, dark: true },
  },
  lion: {
    prims: () => [
      ['cranium', B.ell([0, 0, 0], [1, 0.95, 0.95])],
      ...both(s => ['cheek', B.ell([0.44 * s, 0.36, 0.3], [0.56, 0.5, 0.55])]),
      ['jaw', B.ell([0, 0.6, 0.45], [0.46, 0.34, 0.44])],
      ['muzzle', B.ellBetween([0, 0.02, 0.8], [0, 0.32, 1.05], 0.2, 0.15)],
      ...both(s => ['muzzle', B.ell([0.2 * s, 0.48, 0.84], [0.27, 0.22, 0.24])]),
      ['muzzle', B.ell([0, 0.7, 0.76], [0.2, 0.14, 0.17])],
    ],
    k: 0.07,
    ear: { base: [0.66, -0.58, -0.05], w: 0.34, h: 0.44, out: 0.55, back: -0.1, poly: [[-1, 0], [-0.8, 0.6], [0, 1], [0.8, 0.6], [1, 0], [0, -0.1]], cup: [0.5, 0.3] },
    eyes: { theta: 0.45, phi: 0.06, w: 0.27, r: 0.97, tilt: 0.12, pupil: 'round', pupilR: 0.22 },
    nose: { at: [0, 0.3], shape: 'lion', w: 0.32, h: 0.17 },
    mouth: { center: [0, 0.55], corner: [0.27, 0.53], depth: 0.07, kind: 'cat' },
    whiskers: { from: [[0.26, 0.52], [0.26, 0.6]], len: 0.7, spread: 0.18 },
  },
  cobra: {
    prims: () => [
      ['cranium', B.ell([0, 0.02, 0.05], [0.92, 0.72, 1.02])],
      ...both(s => ['cheek', B.ell([0.42 * s, 0.25, 0.3], [0.5, 0.42, 0.62])]),
      ['muzzle', B.ellBetween([0, 0.15, 0.5], [0, 0.26, 1.28], 0.42, 0.26)],
      ['jaw', B.ellBetween([0, 0.38, 0.2], [0, 0.4, 1.12], 0.38, 0.18)],
    ],
    k: 0.08,
    ear: null,
    eyes: { theta: 0.5, phi: -0.02, w: 0.3, r: 0.95, tilt: 0.22, pupil: 'slit', pupilW: 0.09 },
    nose: { at: [0, 0.14], shape: 'nostrils', w: 0.2, h: 0.06, z: 1.25 },
    mouth: { center: [0, 0.32], corner: [0.38, 0.3], depth: 0.02, kind: 'reptile' },
  },
  croc: {
    prims: () => [
      ['cranium', B.ell([0, 0, 0], [0.95, 0.82, 0.95])],
      ...both(s => ['cheek', B.ell([0.45 * s, 0.3, 0.2], [0.55, 0.45, 0.55])]),
      ['muzzle', B.ellBetween([0, 0.12, 0.45], [0, 0.22, 1.85], 0.4, 0.24)],
      ['jaw', B.ellBetween([0, 0.42, 0.3], [0, 0.42, 1.7], 0.4, 0.2)],
      ...both(s => ['brow', B.ell([0.36 * s, -0.42, 0.42], [0.25, 0.16, 0.22])]),
      ['muzzle', B.ell([0, 0.04, 1.78], [0.22, 0.12, 0.14])],
    ],
    k: 0.07,
    ear: null,
    eyes: { theta: 0.42, phi: -0.2, w: 0.27, r: 0.95, tilt: 0.12, pupil: 'slit', pupilW: 0.1 },
    nose: { at: [0, -0.04], shape: 'nostrils', w: 0.18, h: 0.07, z: 1.86, up: true },
    mouth: { center: [0, 0.34], corner: [0.42, 0.33], depth: 0.02, kind: 'croc' },
  },
  cow: {
    prims: () => [
      ['cranium', B.ell([0, -0.02, 0], [1, 0.98, 0.94])],
      ...both(s => ['cheek', B.ell([0.42 * s, 0.38, 0.28], [0.56, 0.5, 0.55])]),
      ['jaw', B.ell([0, 0.6, 0.45], [0.48, 0.34, 0.45])],
      ['muzzle', B.ellBetween([0, 0.1, 0.7], [0, 0.42, 1.08], 0.42, 0.24)],
      ['muzzle', B.ell([0, 0.52, 0.98], [0.52, 0.3, 0.3])],
    ],
    k: 0.08,
    ear: { base: [0.92, -0.25, 0.0], w: 0.3, h: 0.72, out: 1.25, back: -0.05, poly: [[-1, 0], [-0.9, 0.55], [-0.2, 1], [0.6, 0.7], [1, 0], [0, -0.1]], cup: [0.55, 0.2], droop: 0.25 },
    eyes: { theta: 0.5, phi: 0.04, w: 0.31, r: 0.96, tilt: 0.04, pupil: 'round', pupilR: 0.25 },
    nose: { at: [0, 0.48], shape: 'cow', w: 0.62, h: 0.34, z: 1.25 },
    mouth: { center: [0, 0.74], corner: [0.3, 0.7], depth: 0.05, kind: 'cow' },
  },
  jackal: {
    prims: () => [
      ['cranium', B.ell([0, -0.02, 0], [0.96, 0.92, 0.95])],
      ...both(s => ['cheek', B.ell([0.42 * s, 0.32, 0.22], [0.5, 0.42, 0.5])]),
      ['jaw', B.ell([0, 0.45, 0.4], [0.38, 0.27, 0.42])],
      ['muzzle', B.ellBetween([0, 0.2, 0.55], [0, 0.4, 1.6], 0.25, 0.2)],
      ['muzzle', B.ellBetween([0, 0.48, 0.55], [0, 0.54, 1.4], 0.17, 0.11)],
    ],
    k: 0.07,
    ear: { base: [0.5, -0.72, -0.1], w: 0.42, h: 1.45, out: 0.22, back: -0.2, poly: [[-1, 0], [-0.7, 0.5], [-0.05, 1], [0.5, 0.5], [1, 0], [0, -0.12]], cup: [0.7, 0.15] },
    eyes: { theta: 0.47, phi: 0.04, w: 0.29, r: 0.96, tilt: 0.22, pupil: 'round', pupilR: 0.2 },
    nose: { at: [0, 0.27], shape: 'pad', w: 0.2, h: 0.13, color: '#151217', z: 1.58 },
    mouth: { center: [0, 0.54], corner: [0.25, 0.5], depth: 0.04, kind: 'canid' },
  },
};

// ---------------- geometry helpers in head-local unit space ----------------
function rayHit(prims, o, d) {
  // nearest intersection of ray o + t d (t>0) with the ellipsoids (unit local space)
  let best = null;
  for (const [name, pr] of prims) {
    if (pr.type !== 'ell') continue;
    const Mi = G.inv3(pr.A);
    const oo = G.mvec(Mi, G.sub(o, pr.c)), dd = G.mvec(Mi, d);
    const a = G.dot(dd, dd), b = 2 * G.dot(oo, dd), c = G.dot(oo, oo) - 1;
    const disc = b * b - 4 * a * c; if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a); if (t <= 0) continue;
    if (!best || t < best.t) {
      const u = G.add(oo, G.mul(dd, t));
      const n = G.norm(G.mvec(G.transpose(Mi), u));
      best = { t, p: G.add(o, G.mul(d, t)), n, name };
    }
  }
  return best;
}
// point on the head surface seen from direction dir (unit local)
function onSurface(prims, xy, dir = [0, 0, 1], from = 3) {
  const d = G.norm(dir);
  const o = [xy[0] + d[0] * from, xy[1] + d[1] * from, (xy[2] || 0) + d[2] * from];
  return rayHit(prims, o, G.mul(d, -1));
}

// ---------------- builder ----------------
// opts: { R (cranium radius, world units), frame (rigid T local->world, unit scale), mats: {fur, muzzle?, innerEar, nose}, expr, look }
function build(species, opts = {}) {
  const sp = SPECIES[species];
  if (!sp) throw new Error('unknown species ' + species);
  const R = opts.R || 10;
  const frame = opts.frame || G.T();
  const S = { R: frame.R, t: frame.t };
  const toWorld = p => G.tapply(S, G.mul(p, R));
  const dirWorld = d => G.mvec(S.R, d);
  const prims = (opts.prims || sp.prims)();
  const mats = { fur: 'fur', innerEar: 'innerEar', ...(opts.mats || {}) };
  // world-space parts. Scale prims by R then apply frame.
  const scaleT = { R: G.mmul(S.R, [[R, 0, 0], [0, R, 0], [0, 0, R]]), t: S.t };
  const xf = pr => pr.type === 'ell' ? { ...pr, c: G.tapply(S, G.mul(pr.c, R)), A: G.mmul(scaleT.R, pr.A) } : pr;
  const partFrame = { R: S.R, t: S.t }; // local (world units) -> world
  const byName = {};
  for (const [name, pr] of prims) (byName[name] = byName[name] || []).push(xf(pr));
  const parts = Object.entries(byName).map(([name, ps]) => ({ name: 'head.' + name, mat: (opts.partMats && opts.partMats[name]) || mats.fur, prims: ps, frame: partFrame }));
  const headGroup = { name: opts.groupName || 'head', k: sp.k * R, parts };

  // ears
  const earGroups = [];
  const anchors = {};
  if (sp.ear && opts.ears !== false) {
    const e = { ...sp.ear, ...(opts.ear || {}) };
    for (const s of [-1, 1]) {
      const base = [e.base[0] * s, e.base[1], e.base[2]];
      let v = G.norm([e.out * s * 0.6, -1 + (e.droop || 0) * 1.6, e.back]);
      if (e.droop) v = G.norm([s * e.out, -0.2 + e.droop, e.back]);
      let u = G.norm(G.cross(v, [0, 0, 1])); // along the base
      let n = G.cross(u, v);
      if (n[2] < 0) u = G.mul(u, -1);
      n = G.norm(G.cross(u, v));
      // turn the ear opening slightly outward
      const turn = G.axisAngle(v, -s * (e.turn == null ? 0.35 : e.turn));
      u = G.mvec(turn, u); n = G.norm(G.cross(u, v));
      const poly = B.smoothPoly(e.poly.map(([a, b]) => [a, b]), 6);
      const outer = B.plane(toWorld(base), dirWorld(G.mul(u, e.w * R)), dirWorld(G.mul(v, e.h * R)), poly, { cup: e.cup });
      const inPoly = B.smoothPoly(e.poly.map(([a, b]) => [a * 0.68, 0.1 + b * 0.78]), 6);
      const innerBase = G.add(base, G.mul(n, 0.025));
      const inner = B.plane(toWorld(innerBase), dirWorld(G.mul(u, e.w * R)), dirWorld(G.mul(v, e.h * R)), inPoly, { cup: e.cup });
      earGroups.push({ name: (opts.groupName || 'head') + '.ear' + (s < 0 ? 'L' : 'R'), k: 0.02 * R, parts: [
        { name: 'ear' + (s < 0 ? 'L' : 'R'), mat: mats.earOuter || mats.fur, prims: [outer], frame: partFrame },
        { name: 'earIn' + (s < 0 ? 'L' : 'R'), mat: mats.innerEar, prims: [inner], frame: partFrame, noLine: true },
      ] });
      anchors['ear' + (s < 0 ? 'L' : 'R')] = { base: toWorld(base), tip: toWorld(G.add(base, G.mul(v, e.h))), u: dirWorld(u), v: dirWorld(v), n: dirWorld(n), w: e.w * R, h: e.h * R, s };
    }
  }

  // eyes: on the ball, normal blended toward the face plane (keeps the far eye readable in 3/4)
  const ey = { ...sp.eyes, ...(opts.eyes || {}) };
  for (const s of [-1, 1]) {
    const th = ey.theta * s, ph = ey.phi;
    const ns = G.norm([Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)]);
    const hit = onSurface(prims, [ns[0], ns[1], 0], [ns[0], ns[1], ns[2]], 3) || { p: G.mul(ns, ey.r), n: ns };
    const ne = G.norm(G.add(G.mul(hit.n, 0.45), [0, 0, 0.55]));
    const exr = G.norm([ne[2], 0, -ne[0]]); // horizontal tangent toward +x
    const eyv = G.norm(G.cross(ne, exr));
    const ex = s < 0 ? G.mul(exr, -1) : exr; // toward the outer corner
    anchors['eye' + (s < 0 ? 'L' : 'R')] = { p: toWorld(G.add(hit.p, G.mul(ne, 0.03))), ex: dirWorld(G.mul(ex, ey.w * R)), ey: dirWorld(G.mul(eyv, ey.w * R)), n: dirWorld(ne), s };
  }
  // nose and mouth anchors
  const nz = sp.nose;
  const nh = onSurface(prims, [nz.at[0], nz.at[1], nz.z || 0], nz.up ? [0, -1, 0.2] : [0, 0.05, 1]);
  if (nh) anchors.nose = { p: toWorld(nh.p), n: dirWorld(nh.n), local: nh.p, localN: nh.n };
  anchors.cranium = toWorld([0, 0, 0]);
  anchors.chin = toWorld((onSurface(prims, [0, 0.6, 0], [0, 0.4, 1]) || { p: [0, 0.8, 0.5] }).p);
  anchors.crown = toWorld([0, -1, 0]);

  return {
    species, sp, R, frame: S, toWorld, dirWorld, prims, groups: [headGroup, ...earGroups], anchors,
    surface: (xy, dir) => { const h = onSurface(prims, xy, dir); return h ? { p: toWorld(h.p), n: dirWorld(h.n), local: h.p } : null; },
  };
}

// ---------------- feature drawing (after the raster pass) ----------------
// Visibility clip for a feature lying in a plane through c with axes ex, ey (world), using the depth buffer.
function planeClip(doc, Rs, c3, ex3, ey3, box, eps) {
  const c = Rs.project(c3), a = Rs.project(G.add(c3, ex3)), b = Rs.project(G.add(c3, ey3));
  const ax = [a[0] - c[0], a[1] - c[1], a[2] - c[2]], bx = [b[0] - c[0], b[1] - c[1], b[2] - c[2]];
  const det = ax[0] * bx[1] - ax[1] * bx[0];
  if (Math.abs(det) < 1e-6) return { hidden: true };
  const step = Rs.step, W = Math.ceil(box[2] / step) + 1, H = Math.ceil(box[3] / step) + 1;
  const f = new Float32Array(W * H);
  let vis = 0, hid = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box[0] + i * step, y = box[1] + j * step;
    const dx = x - c[0], dy = y - c[1];
    const u = (dx * bx[1] - dy * bx[0]) / det, v = (ax[0] * dy - ax[1] * dx) / det;
    const z = c[2] + u * ax[2] + v * bx[2];
    const zb = Rs.depthAt(x, y);
    const val = zb <= -1e8 ? 5 : (z - zb + eps);
    f[j * W + i] = val;
    if (val > 0) vis++; else hid++;
  }
  if (!hid) return { all: true };
  if (!vis) return { hidden: true };
  const rings = M.shapes(f, W, H, { x0: box[0], y0: box[1], step, smooth: 1, eps: 0.2 });
  return { clip: doc.clip(G.ringsD(rings), { rule: 'evenodd' }) };
}

// Draw eyes, brows, nose, mouth, whiskers for a built head. expr: expression params.
function features(doc, Rs, head, look = {}) {
  const sp = head.sp, R = head.R, out = [];
  const expr = { ...(look.expr || {}) };
  const view = Rs.view;
  const sc = view.s * R; // screen units per head unit
  const lightDir = look.light || [-0.7, -0.6, 0.38];
  const lineCol = look.lineColor || '#2a1b22';
  // ---- eyes ----
  const camLocal = G.mvec(G.transpose(head.frame.R), G.mvec(G.transpose(view.R), [0, 0, 1]));
  for (const side of ['L', 'R']) {
    const a = head.anchors['eye' + side];
    if (!a) continue;
    const c = Rs.project(a.p), ex = Rs.project(G.add(a.p, a.ex)), eyv = Rs.project(G.add(a.p, a.ey));
    const frame2 = { c: [c[0], c[1]], ex: [ex[0] - c[0], ex[1] - c[1]], ey: [eyv[0] - c[0], eyv[1] - c[1]] };
    // facing: hide when the eye plane turns away from the camera
    const facing = G.dot(G.mvec(view.R, a.n), [0, 0, 1]);
    if (facing < 0.08) continue;
    // auto gaze toward the camera unless given
    const exL = G.norm(a.ex), eyL = G.norm(a.ey);
    const camW = G.mvec(G.transpose(view.R), [0, 0, 1]);
    const gz = expr.gaze || [G.dot(camW, exL) * 0.9 + (expr.gazeShift ? expr.gazeShift[0] * (a.s < 0 ? -1 : 1) : 0), G.dot(camW, eyL) * 0.9 + (expr.gazeShift ? expr.gazeShift[1] : 0)];
    const wink = expr.wink && expr.wink === side ? 'happy' : null;
    const params = {
      ...sp.eyes, ...look.eye, ...expr.eye,
      tilt: (look.eye && look.eye.tilt != null) ? look.eye.tilt : sp.eyes.tilt,
      pupil: sp.eyes.pupil, pupilR: sp.eyes.pupilR, pupilW: sp.eyes.pupilW || 0.13,
      gaze: expr.gaze ? (a.s < 0 ? [-expr.gaze[0], expr.gaze[1]] : expr.gaze) : gz,
      open: expr.open != null ? expr.open : 1, lowerLid: expr.lowerLid || 0,
      closed: wink || expr.closed || null,
      brow: { ...(look.eye && look.eye.brow), ...(expr.brow || {}), ...((expr.browSide && expr.browSide[side]) || {}) },
      light: [lightDir[0] * (a.s < 0 ? -1 : 1), lightDir[1]],
      shade: expr.shade || 0,
    };
    // tilt the brow frame with the eye frame (same local space)
    const box = [Math.min(c[0], ex[0], eyv[0]) - 2.2 * sc * sp.eyes.w, c[1] - 2.4 * sc * sp.eyes.w, 4.4 * sc * sp.eyes.w, 3.8 * sc * sp.eyes.w];
    const vis = planeClip(doc, Rs, a.p, a.ex, a.ey, box, 0.12 * R * view.s);
    if (vis.hidden) continue;
    const svg = E.eye(doc, frame2, params);
    out.push(vis.clip ? g({ 'clip-path': vis.clip }, svg) : svg);
  }
  // ---- nose ----
  const na = head.anchors.nose;
  if (na) {
    const n = sp.nose, c3 = na.p;
    const nW = G.norm(na.n);
    const xw = G.norm(G.cross([0, 1, 0].map((v, i) => head.frame.R[i][1]), nW));
    let xa = G.norm(head.dirWorld([1, 0, 0])); xa = G.norm(G.sub(xa, G.mul(nW, G.dot(xa, nW))));
    const ya = G.norm(G.cross(nW, xa));
    const pc = Rs.project(c3);
    const P2 = (u, v) => { const p = Rs.project(G.add(c3, G.add(G.mul(xa, u * R), G.mul(ya, v * R)))); return [p[0], p[1]]; };
    const facing = G.dot(G.mvec(view.R, nW), [0, 0, 1]);
    if (facing > -0.2 && Rs.visible(pc[0], pc[1], pc[2], 0.2 * R)) out.push(noseShape(doc, n, P2, sc, look));
  }
  // ---- mouth ----
  out.push(mouthShape(doc, Rs, head, expr, look));
  // ---- whiskers ----
  if (sp.whiskers && look.whiskers !== false) {
    const w = sp.whiskers;
    for (const s of [-1, 1]) for (let k = 0; k < w.from.length; k++) {
      const f = w.from[k];
      const hit = onSurface(head.prims, [f[0] * s, f[1], 0], [s * 0.4, 0, 1]);
      if (!hit) continue;
      const p0 = head.toWorld(hit.p);
      const dir = G.norm([s * 1, (k - (w.from.length - 1) / 2) * w.spread + 0.06, -0.15]);
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; const q = G.add(hit.p, G.add(G.mul(dir, w.len * t), [0, 0.12 * t * t, 0])); pts.push(Rs.project(head.toWorld(q))); }
      const p0s = Rs.project(p0);
      if (!Rs.visible(p0s[0], p0s[1], p0s[2], 0.1 * R)) continue;
      const col = w.dark ? '#2b2024' : (look.whiskerColor || '#fbf3e4');
      out.push(path(G.polyD(Ln.taper(pts, 0.026 * sc, { profile: Ln.taperProfile({ start: 0.05, end: 0.9 }) })), { fill: col, opacity: 0.7 }));
    }
  }
  return g({ class: 'face' }, out);
}

function noseShape(doc, n, P2, sc, look) {
  const col = look.noseColor || n.color || '#c47b80';
  const r = Cc.ramp(col);
  const out = [];
  const poly = (pts) => G.polyD(G.catmull(pts.map(([u, v]) => P2(u, v)), { closed: true, seg: 6 }));
  const w = n.w / 2, h = n.h;
  if (n.shape === 'cat' || n.shape === 'lion') {
    const k = n.shape === 'lion' ? 1 : 0.85;
    const pts = [[-w, -h * 0.35], [-w * 0.55, -h * 0.55], [0, -h * 0.5 * k], [w * 0.55, -h * 0.55], [w, -h * 0.35], [w * 0.4, h * 0.15], [0, h * 0.42], [-w * 0.4, h * 0.15]];
    const d = poly(pts);
    const a = P2(0, -h * 0.6), b = P2(0, h * 0.45);
    out.push(path(d, { fill: doc.linear([[0, r.hi], [0.55, col], [1, r.shadow]], { x1: a[0], y1: a[1], x2: b[0], y2: b[1], units: 'userSpaceOnUse' }) }));
    out.push(path(d, { fill: 'none', stroke: r.line, 'stroke-width': 0.035 * sc, 'stroke-linejoin': 'round' }));
    // nostrils
    for (const s of [-1, 1]) out.push(path(G.polyD(Ln.taper([P2(s * w * 0.75, -h * 0.05), P2(s * w * 0.42, h * 0.1), P2(s * w * 0.18, h * 0.06)], 0.045 * sc, { profile: Ln.taperProfile({ start: 0.3, end: 0.4 }) })), { fill: r.line }));
    out.push(path(poly([[-w * 0.35, -h * 0.38], [0, -h * 0.47], [w * 0.2, -h * 0.4], [0, -h * 0.25]]), { fill: '#ffffff', opacity: 0.55 }));
  } else if (n.shape === 'pad') {
    const pts = [[-w, -h * 0.2], [-w * 0.6, -h * 0.55], [0, -h * 0.6], [w * 0.6, -h * 0.55], [w, -h * 0.2], [w * 0.7, h * 0.35], [0, h * 0.45], [-w * 0.7, h * 0.35]];
    const d = poly(pts);
    out.push(path(d, { fill: col }));
    out.push(path(poly([[-w * 0.5, -h * 0.42], [0, -h * 0.5], [w * 0.3, -h * 0.42], [0, -h * 0.22]]), { fill: '#ffffff', opacity: 0.45 }));
    for (const s of [-1, 1]) out.push(path(poly([[s * w * 0.75, h * 0.0], [s * w * 0.4, -h * 0.1], [s * w * 0.3, h * 0.15], [s * w * 0.6, h * 0.22]]), { fill: '#000000', opacity: 0.8 }));
  } else if (n.shape === 'cow') {
    const pts = [[-w, -h * 0.3], [-w * 0.7, -h * 0.6], [0, -h * 0.55], [w * 0.7, -h * 0.6], [w, -h * 0.3], [w * 0.85, h * 0.35], [0, h * 0.5], [-w * 0.85, h * 0.35]];
    const d = poly(pts);
    const a = P2(0, -h * 0.6), b = P2(0, h * 0.5);
    out.push(path(d, { fill: doc.linear([[0, r.hi], [0.5, col], [1, r.mid]], { x1: a[0], y1: a[1], x2: b[0], y2: b[1], units: 'userSpaceOnUse' }) }));
    for (const s of [-1, 1]) out.push(path(poly([[s * w * 0.62, -h * 0.05], [s * w * 0.35, -h * 0.18], [s * w * 0.22, h * 0.1], [s * w * 0.45, h * 0.22]]), { fill: r.deep }));
    out.push(path(poly([[-w * 0.3, -h * 0.42], [0, -h * 0.48], [w * 0.25, -h * 0.4], [0, -h * 0.3]]), { fill: '#ffffff', opacity: 0.5 }));
  } else if (n.shape === 'nostrils') {
    for (const s of [-1, 1]) out.push(path(poly([[s * w * 0.6, 0], [s * w * 0.35, -h * 0.4], [s * w * 0.2, 0.1 * h], [s * w * 0.45, h * 0.5]]), { fill: '#1b1a17', opacity: 0.85 }));
  }
  return g({ class: 'nose' }, out);
}

// Mouth line on the muzzle surface; expression: smile (-1..1), open (0..1), smirk (-1..1), teeth, fangs, tongue
function mouthShape(doc, Rs, head, expr, look) {
  const sp = head.sp, m = sp.mouth, R = head.R, view = Rs.view, sc = view.s * R;
  const smile = expr.smile == null ? 0.3 : expr.smile, open = expr.mouthOpen || 0, smirk = expr.smirk || 0;
  const lineCol = look.mouthLine || '#3a2228';
  const out = [];
  const cx = m.center[0], cy = m.center[1], wx = m.corner[0] * (expr.mouthWidth || 1);
  // surface point helper: front for the centre, sideways toward the corners
  const S = (x, y) => {
    const side = Math.max(-1, Math.min(1, x / Math.max(0.01, wx)));
    const dir = m.kind === 'croc' || m.kind === 'reptile' ? [side * 0.9, 0.1, 0.4] : [side * 0.55, 0.15, 1];
    const h = onSurface(head.prims, [x, y, m.kind === 'croc' ? 1.0 : (m.kind === 'reptile' ? 0.7 : 0.3)], dir);
    return h ? head.toWorld(G.add(h.p, G.mul(h.n, 0.012))) : null;
  };
  const corner = s => {
    const lift = smile * 0.06 + (s > 0 ? smirk : -smirk) * 0.05;
    return [s * wx, m.corner[1] - lift];
  };
  // upper line: centre "w" for cats, straight-ish for canids, long gum line for reptiles
  const upper = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N * 2 - 1, s = Math.sign(t) || 1, a = Math.abs(t);
    const cn = corner(s);
    let x = cx + t * wx, y;
    if (m.kind === 'cat') y = cy + Math.sin(a * Math.PI) * m.depth * (1 - smile * 0.3) + (cn[1] - cy) * a * a;
    else y = cy + (cn[1] - cy) * a * a + Math.sin(a * Math.PI) * m.depth * 0.5;
    upper.push([x, y]);
  }
  const P3 = upper.map(([x, y]) => S(x, y));
  const proj = P3.map(p => p ? Rs.project(p) : null);
  const visible = proj.map(p => p && Rs.visible(p[0], p[1], p[2], 0.14 * R));
  // open mouth interior
  if (open > 0.05) {
    const lower = [];
    for (let i = N; i >= 0; i--) {
      const t = i / N * 2 - 1, a = Math.abs(t);
      const x = cx + t * wx * (0.86 + 0.1 * smile), y = upper[i][1] + open * 0.26 * Math.sqrt(Math.max(0, 1 - a * a)) * (1 + 0.15 * smile);
      lower.push(S(x, y));
    }
    const ring = P3.concat(lower).filter(Boolean).map(p => Rs.project(p)).map(p => [p[0], p[1]]);
    if (ring.length > 6) {
      const d = G.polyD(G.catmull(ring, { closed: true, seg: 3 }));
      const clip = doc.clip(d, { rule: 'nonzero' });
      const inner = [path(d, { fill: '#5a1f2c' })];
      if (expr.tongue !== false) {
        const tg = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * 2 - 1; tg.push(S(cx + t * wx * 0.55, upper[7][1] + open * 0.26 * (0.95 - 0.2 * t * t))); }
        const tp = tg.filter(Boolean).map(p => Rs.project(p));
        if (tp.length > 3) { const top = tp.map(p => [p[0], p[1] - 0.12 * sc * open]); inner.push(path(G.polyD(G.catmull(top.concat(tp.slice().reverse().map(p => [p[0], p[1] + 0.2 * sc])), { closed: true, seg: 3 })), { fill: '#d96b7c' })); }
      }
      if (expr.teeth || m.kind === 'croc') {
        const tl = P3.map(p => p && Rs.project(p)).filter(Boolean);
        for (let i = 1; i < tl.length - 1; i += 2) inner.push(path(G.polyD([[tl[i][0] - 0.03 * sc, tl[i][1]], [tl[i][0] + 0.03 * sc, tl[i][1]], [tl[i][0], tl[i][1] + 0.07 * sc]]), { fill: '#fbf6ec' }));
      }
      out.push(g({ 'clip-path': clip }, inner));
      out.push(path(G.polyD(Ln.taper(lower.filter(Boolean).map(p => Rs.project(p)), 0.03 * sc, { profile: Ln.taperProfile({ start: 0.2, end: 0.2 }) })), { fill: lineCol, opacity: 0.8 }));
    }
  }
  // fangs (small, cute)
  if (expr.fangs || (open > 0.2 && m.kind !== 'cow')) {
    for (const s of [-1, 1]) {
      const i = s < 0 ? 4 : N - 4;
      if (!visible[i] || !proj[i]) continue;
      const p = proj[i];
      out.push(path(G.polyD([[p[0] - 0.035 * sc, p[1] - 0.005 * sc], [p[0] + 0.035 * sc, p[1] - 0.005 * sc], [p[0] + s * 0.005 * sc, p[1] + 0.09 * sc]]), { fill: '#fffaf0', stroke: lineCol, 'stroke-width': 0.012 * sc, 'stroke-linejoin': 'round' }));
    }
  }
  // the line itself, split into visible runs
  const runs = Ln.runs(proj.length, i => visible[i], 2).filter(r => !r.closed);
  const allVis = visible.every(Boolean);
  const segs = allVis ? [proj.map((p, i) => i)] : runs.map(r => r.idx).filter(r => r.length > 1);
  for (const idx of segs) {
    idx.sort((a, b) => a - b);
    const pts = idx.map(i => [proj[i][0], proj[i][1]]);
    out.push(path(G.polyD(Ln.taper(pts, (t) => 0.045 * sc * (0.55 + 0.45 * Math.sin(Math.PI * t)), { profile: Ln.taperProfile({ start: 0.15, end: 0.15 }) })), { fill: lineCol }));
  }
  // philtrum for cats (nose to mouth)
  if (m.kind === 'cat' && head.anchors.nose && visible[N / 2]) {
    const nl = head.anchors.nose.local;
    const a = S(0, nl[1] + 0.06), b = S(0, cy + 0.01);
    if (a && b) { const pa = Rs.project(a), pb = Rs.project(b); out.push(path(G.polyD(Ln.taper([[pa[0], pa[1]], [pb[0], pb[1]]], 0.035 * sc, { profile: Ln.taperProfile({ start: 0.3, end: 0.1 }), step: 0.5 })), { fill: lineCol })); }
  }
  // corner dimple for smiles
  if (smile > 0.3 && !open) for (const s of [-1, 1]) {
    const i = s < 0 ? 0 : N; if (!visible[i]) continue;
    const c = upper[i], q1 = S(c[0] + s * 0.02, c[1] - 0.06), q0 = S(c[0], c[1]);
    if (q1 && q0) { const a = Rs.project(q0), b = Rs.project(q1); out.push(path(G.polyD(Ln.taper([[a[0], a[1]], [b[0], b[1]]], 0.03 * sc, { profile: Ln.taperProfile({ start: 0.1, end: 0.8 }), step: 0.5 })), { fill: lineCol })); }
  }
  return g({ class: 'mouth' }, out);
}

module.exports = { SPECIES, build, features, onSurface, rayHit, planeClip };
