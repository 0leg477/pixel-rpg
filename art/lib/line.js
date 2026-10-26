'use strict';
// Tapered lines drawn as filled outlines instead of constant-width strokes.
const G = require('./geom');

// Outward normal = left of travel (marching-squares rings keep the inside on the right).
function leftNormals(pts, closed) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
    return [ty / L, -tx / L];
  });
}
// Width profile with tapered ends. t in [0,1].
function taperProfile({ start = 0.18, end = 0.18, min = 0, shape = 'smooth' } = {}) {
  const ease = x => shape === 'linear' ? x : Math.sin(Math.min(1, x) * Math.PI / 2);
  return t => {
    let k = 1;
    if (start > 0 && t < start) k = Math.min(k, ease(t / start));
    if (end > 0 && t > 1 - end) k = Math.min(k, ease((1 - t) / end));
    return min + (1 - min) * k;
  };
}
// Open stroke -> closed polygon. width: number | (t, i, p) => number. offset shifts the centreline along the normal.
function taper(pts, width, { profile = taperProfile(), step = 1.2, offset = 0, smooth = true } = {}) {
  let p = pts.map(q => q.slice(0, 2));
  if (p.length < 2) return [];
  if (step) p = G.resample(p, step, false);
  if (p.length < 2) return [];
  if (smooth && p.length > 4) p = G.laplace(p, 1, 0.5, false);
  const L = G.polyLength(p, false) || 1;
  const nrm = leftNormals(p, false);
  let acc = 0;
  const left = [], right = [];
  for (let i = 0; i < p.length; i++) {
    if (i) acc += G.d2(p[i - 1], p[i]);
    const t = acc / L;
    const w = (typeof width === 'function' ? width(t, i, p[i]) : width) * profile(t);
    const o = typeof offset === 'function' ? offset(t) : offset;
    const n = nrm[i];
    left.push([p[i][0] + n[0] * (o + w / 2), p[i][1] + n[1] * (o + w / 2)]);
    right.push([p[i][0] + n[0] * (o - w / 2), p[i][1] + n[1] * (o - w / 2)]);
  }
  return left.concat(right.reverse());
}
// Closed ring -> band (outer ring + inner ring, draw with evenodd). widths per point via fn(i, p, n).
function band(ring, width, { step = 1.2, bias = 0, smooth = true } = {}) {
  let p = ring;
  if (step) p = G.resample(p, step, true);
  if (smooth && p.length > 6) p = G.laplace(p, 1, 0.5, true);
  const nrm = leftNormals(p, true);
  const outer = [], inner = [];
  for (let i = 0; i < p.length; i++) {
    const n = nrm[i];
    const w = typeof width === 'function' ? width(i, p[i], n) : width;
    const o = bias * w; // >0 pushes the band outward
    outer.push([p[i][0] + n[0] * (o + w / 2), p[i][1] + n[1] * (o + w / 2)]);
    inner.push([p[i][0] + n[0] * (o - w / 2), p[i][1] + n[1] * (o - w / 2)]);
  }
  return [outer, inner.reverse()];
}
// Split a ring into open runs where pred(i) holds; returns arrays of point indices runs (wrap-aware).
function runs(n, pred, minLen = 3) {
  const flags = Array.from({ length: n }, (_, i) => !!pred(i));
  if (flags.every(Boolean)) return [{ idx: Array.from({ length: n }, (_, i) => i), closed: true }];
  const out = [];
  let start = flags.findIndex(f => !f);
  let cur = null;
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    if (flags[i]) { if (!cur) cur = []; cur.push(i); }
    else if (cur) { if (cur.length >= minLen) out.push({ idx: cur, closed: false }); cur = null; }
  }
  if (cur && cur.length >= minLen) out.push({ idx: cur, closed: false });
  return out;
}

// A hand-drawn style line along a curve given by control points (Catmull-Rom).
function inkCurve(ctrl, width, opt = {}) {
  const pts = G.catmull(ctrl, { seg: opt.seg || 12, closed: false });
  return taper(pts, width, opt);
}

module.exports = { leftNormals, taperProfile, taper, band, runs, inkCurve };
