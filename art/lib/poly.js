'use strict';
// Polygon booleans and offsets on "shapes" = arrays of rings ([[x,y],...]). Wraps Clipper (integer coords).
const C = require('clipper-lib');
const S = 100;
const toC = rings => rings.filter(r => r.length > 2).map(r => r.map(p => ({ X: Math.round(p[0] * S), Y: Math.round(p[1] * S) })));
const fromC = paths => paths.map(p => p.map(q => [q.X / S, q.Y / S])).filter(r => r.length > 2);

function boolOp(type, a, b) {
  const c = new C.Clipper();
  c.AddPaths(toC(a), C.PolyType.ptSubject, true);
  if (b && b.length) c.AddPaths(toC(b), C.PolyType.ptClip, true);
  const out = new C.Paths();
  c.Execute(type, out, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return fromC(out);
}
// Even-odd input variant (marching-squares output with holes keeps orientation, but be safe).
function normalize(rings) {
  const c = new C.Clipper(); c.AddPaths(toC(rings), C.PolyType.ptSubject, true);
  const out = new C.Paths(); c.Execute(C.ClipType.ctUnion, out, C.PolyFillType.pftEvenOdd, C.PolyFillType.pftEvenOdd);
  return fromC(out);
}
const union = (...shapes) => boolOp(C.ClipType.ctUnion, [].concat(...shapes), []);
const diff = (a, b) => boolOp(C.ClipType.ctDifference, a, b);
const inter = (a, b) => boolOp(C.ClipType.ctIntersection, a, b);
const xor = (a, b) => boolOp(C.ClipType.ctXor, a, b);

function offset(rings, delta, { join = 'round', arc = 0.15 } = {}) {
  if (!rings.length) return [];
  const co = new C.ClipperOffset(2, arc * S);
  const jt = join === 'miter' ? C.JoinType.jtMiter : join === 'square' ? C.JoinType.jtSquare : C.JoinType.jtRound;
  co.AddPaths(toC(rings), jt, C.EndType.etClosedPolygon);
  const out = new C.Paths(); co.Execute(out, delta * S);
  return fromC(out);
}
// Offset of open polylines: a constant-width stroke polygon.
function strokeOpen(lines, width, { cap = 'round' } = {}) {
  const co = new C.ClipperOffset(2, 0.15 * S);
  const et = cap === 'butt' ? C.EndType.etOpenButt : C.EndType.etOpenRound;
  co.AddPaths(lines.map(r => r.map(p => ({ X: Math.round(p[0] * S), Y: Math.round(p[1] * S) }))), C.JoinType.jtRound, et);
  const out = new C.Paths(); co.Execute(out, width / 2 * S);
  return fromC(out);
}
// Morphological closing fills concave corners (fillets), opening removes slivers.
const close = (rings, r) => offset(offset(rings, r), -r);
const open = (rings, r) => offset(offset(rings, -r), r);
const translate = (rings, dx, dy) => rings.map(r => r.map(p => [p[0] + dx, p[1] + dy]));
const scaleAbout = (rings, k, cx, cy) => rings.map(r => r.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]));
function area(rings) {
  let a = 0;
  for (const r of rings) { let s = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; s += p[0] * q[1] - q[0] * p[1]; } a += s / 2; }
  return Math.abs(a);
}
// "Lit side removed" crescent: the part of the shape away from direction (dx,dy) by distance d.
// shadowCrescent(shape, towardLight, d) = shape minus shape shifted toward the light.
const crescent = (rings, dx, dy, d) => diff(rings, translate(rings, dx * d, dy * d));
const ellipseRing = (cx, cy, rx, ry, rot = 0, n = 72) => {
  const o = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry; o.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return o;
};

module.exports = { union, diff, inter, xor, offset, strokeOpen, close, open, translate, scaleAbout, area, crescent, normalize, ellipseRing };
