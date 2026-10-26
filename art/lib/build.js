'use strict';
// Builders for 3D primitives used by the raster renderer.
const G = require('./geom');

// Ellipsoid: centre c, radii r=[rx,ry,rz] along the axes of rotation R.
function ell(c, r, R = G.I3()) {
  const A = [0, 1, 2].map(i => [R[i][0] * r[0], R[i][1] * r[1], R[i][2] * r[2]]);
  return { type: 'ell', c: c.slice(), A };
}
const sphere = (c, r) => ell(c, [r, r, r]);
// Ellipsoid whose long axis runs from a to b, with cross radii [rw, rd] (width, depth); `up` orients width.
function ellBetween(a, b, rw, rd = rw, side = [1, 0, 0], extra = 1) {
  const c = G.lerp(a, b, 0.5), ax = G.sub(b, a), l = G.len(ax) / 2 * extra;
  const y = G.norm(ax);
  let x = G.sub(side, G.mul(y, G.dot(side, y)));
  if (G.len(x) < 1e-6) x = Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  x = G.norm(x); const z = G.cross(x, y);
  const R = [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
  return ell(c, [rw, l, rd], R);
}
// Spheres along a 3D polyline with radius profile r(t) -> tube with organic thickness changes.
function sweep(pts, r, { spacing = 0.35, ry = null } = {}) {
  const out = [];
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + G.len(G.sub(pts[i], pts[i - 1])));
  const total = L[L.length - 1] || 1;
  let s = 0;
  const at = s => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return G.lerp(pts[i - 1], pts[i], Math.max(0, Math.min(1, t))); };
  while (s <= total + 1e-6) {
    const t = s / total, rr = typeof r === 'function' ? r(t) : r;
    out.push(sphere(at(s), rr));
    s += Math.max(0.05, rr * spacing);
  }
  return out;
}
// Elliptic cross-section sweep: ellipsoids oriented along the path; rw(t), rd(t) width/depth radii.
function sweepEll(pts, rw, rd, { spacing = 0.33, side = [1, 0, 0], stretch = 1.0 } = {}) {
  const out = [];
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + G.len(G.sub(pts[i], pts[i - 1])));
  const total = L[L.length - 1] || 1;
  const at = s => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return { p: G.lerp(pts[i - 1], pts[i], Math.max(0, Math.min(1, t))), d: G.norm(G.sub(pts[i], pts[i - 1])) }; };
  let s = 0;
  while (s <= total + 1e-6) {
    const t = s / total, w = rw(t), d = rd(t);
    const { p, d: dir } = at(s);
    const len = Math.min(w, d) * 0.9 * stretch;
    out.push(ellBetween(G.sub(p, G.mul(dir, len)), G.add(p, G.mul(dir, len)), w, d, side));
    s += Math.max(0.05, Math.min(w, d) * spacing);
  }
  return out;
}
// Planar shape: origin o, in-plane axes u (a direction) and v (b direction), polygon in (a,b).
function plane(o, u, v, poly, { cup = null, matBack = null } = {}) {
  return { type: 'plane', o: o.slice(), u: u.slice(), v: v.slice(), poly, cup, matBack };
}
// Apply rigid transform to a prim.
function xform(prim, tr) {
  if (prim.type === 'ell') return { ...prim, c: G.tapply(tr, prim.c), A: G.mmul(tr.R, prim.A) };
  if (prim.type === 'plane') return { ...prim, o: G.tapply(tr, prim.o), u: G.mvec(tr.R, prim.u), v: G.mvec(tr.R, prim.v) };
  return prim;
}
// Smooth closed polygon from a few control points (for planar shapes like ears).
const smoothPoly = (ctrl, seg = 8) => G.catmull(ctrl, { closed: true, seg });

module.exports = { ell, sphere, ellBetween, sweep, sweepEll, plane, xform, smoothPoly };
