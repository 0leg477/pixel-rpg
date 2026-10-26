'use strict';
// Vector, matrix and curve helpers. Screen/model frame: x right, y down, z toward the viewer.

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const len = a => Math.sqrt(dot(a, a));
const norm = a => { const l = len(a) || 1; return a.map(v => v / l); };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const deg = d => d * Math.PI / 180;
const mix = (a, b, t) => a + (b - a) * t;

// 3x3 matrices as arrays of rows.
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mmul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mvec = (A, v) => A.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const transpose = A => [0, 1, 2].map(i => [A[0][i], A[1][i], A[2][i]]);
function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error('singular matrix');
  const k = 1 / det;
  return [
    [A * k, -(b * i - c * h) * k, (b * f - c * e) * k],
    [B * k, (a * i - c * g) * k, -(a * f - c * d) * k],
    [C * k, -(a * h - b * g) * k, (a * e - b * d) * k],
  ];
}
// Rotations. yaw turns the front (+z) toward screen right, pitch > 0 lifts the front up, roll tilts clockwise.
const rotY = t => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const rotX = t => [[1, 0, 0], [0, Math.cos(t), Math.sin(t)], [0, -Math.sin(t), Math.cos(t)]];
const rotZ = t => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const euler = (yaw = 0, pitch = 0, roll = 0) => mmul(rotY(yaw), mmul(rotX(pitch), rotZ(roll)));
// Rotation that maps unit vector a onto unit vector b.
function rotBetween(a, b) {
  a = norm(a); b = norm(b);
  const v = cross(a, b), c = dot(a, b);
  if (c < -0.9999) { const p = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const ax = norm(cross(a, p)); return axisAngle(ax, Math.PI); }
  const k = 1 / (1 + c);
  return [
    [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1]],
    [v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0]],
    [v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c],
  ];
}
function axisAngle(ax, t) {
  const [x, y, z] = norm(ax), c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [
    [x * x * C + c, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, y * y * C + c, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, z * z * C + c],
  ];
}

// Rigid transform {R, t}: p -> R p + t.
const T = (R = I3(), t = [0, 0, 0]) => ({ R, t });
const tapply = (tr, p) => add(mvec(tr.R, p), tr.t);
const tcompose = (a, b) => ({ R: mmul(a.R, b.R), t: add(mvec(a.R, b.t), a.t) }); // a after b
const tinv = tr => { const Ri = transpose(tr.R); return { R: Ri, t: mul(mvec(Ri, tr.t), -1) }; };

// ---------- 2D polylines ----------
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function polyLength(pts, closed) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += d2(pts[i - 1], pts[i]);
  if (closed && pts.length > 1) L += d2(pts[pts.length - 1], pts[0]);
  return L;
}
function signedArea(pts) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
// Resample to (approximately) equal spacing.
function resample(pts, step, closed) {
  if (pts.length < 2) return pts.slice();
  const src = closed ? pts.concat([pts[0]]) : pts;
  const out = [src[0].slice()];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i]; const L = d2(a, b);
    let t = step - carry;
    while (t <= L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += step; }
    carry = L - (t - step);
  }
  if (!closed) { const last = src[src.length - 1]; if (d2(out[out.length - 1], last) > step * 0.25) out.push(last.slice()); else out[out.length - 1] = last.slice(); }
  else if (out.length > 2 && d2(out[out.length - 1], out[0]) < step * 0.3) out.pop();
  return out;
}
// Chaikin corner cutting.
function chaikin(pts, iters = 1, closed = true) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const o = []; const n = p.length;
    if (!closed) o.push(p[0]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i], b = p[(i + 1) % n];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) o.push(p[n - 1]);
    p = o;
  }
  return p;
}
// Laplacian smoothing keeps the polygon size better than Chaikin for noisy contours.
function laplace(pts, iters = 2, k = 0.5, closed = true) {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    const n = p.length; const o = new Array(n);
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) { o[i] = p[i]; continue; }
      const a = p[(i - 1 + n) % n], b = p[(i + 1) % n], c = p[i];
      o[i] = [c[0] + k * ((a[0] + b[0]) / 2 - c[0]), c[1] + k * ((a[1] + b[1]) / 2 - c[1])];
    }
    p = o;
  }
  return p;
}
// Ramer-Douglas-Peucker.
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop(); const a = pts[s], b = pts[e];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
    let md = -1, mi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; stack.push([s, mi], [mi, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function rdpClosed(pts, eps) {
  if (pts.length < 8) return pts;
  // split at the farthest pair to keep a stable start.
  let far = 0, fd = 0; for (let i = 1; i < pts.length; i++) { const d = d2(pts[0], pts[i]); if (d > fd) { fd = d; far = i; } }
  const a = rdp(pts.slice(0, far + 1), eps), b = rdp(pts.slice(far).concat([pts[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}
// Outward normals of a ring (assumes no orientation; uses signed area).
function ringNormals(pts) {
  const n = pts.length, s = signedArea(pts) > 0 ? 1 : -1; // y-down screen: positive area = clockwise visually
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty) || 1;
    return [s * ty / L, -s * tx / L];
  });
}
function lineNormals(pts) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty) || 1;
    return [-ty / L, tx / L];
  });
}

// ---------- splines ----------
// Centripetal Catmull-Rom through points -> dense polyline.
function catmull(pts, { closed = false, seg = 10, alpha = 0.5 } = {}) {
  const P = pts.map(p => p.slice());
  const d2 = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  if (P.length < 3) return P;
  const n = P.length, out = [];
  const get = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const t0 = 0, t1 = t0 + Math.pow(d2(p0, p1) || 1e-6, alpha), t2 = t1 + Math.pow(d2(p1, p2) || 1e-6, alpha), t3 = t2 + Math.pow(d2(p2, p3) || 1e-6, alpha);
    for (let k = 0; k < seg; k++) {
      const t = t1 + (t2 - t1) * k / seg;
      const A1 = lerp(p0, p1, (t - t0) / (t1 - t0)), A2 = lerp(p1, p2, (t - t1) / (t2 - t1)), A3 = lerp(p2, p3, (t - t2) / (t3 - t2));
      const B1 = lerp(A1, A2, (t - t0) / (t2 - t0)), B2 = lerp(A2, A3, (t - t1) / (t3 - t1));
      out.push(lerp(B1, B2, (t - t1) / (t2 - t1)));
    }
  }
  if (!closed) out.push(P[n - 1]);
  return out;
}
// Cubic bezier sampling: ctrl = [p0,c1,c2,p1] in any dimension.
function bez(ctrl, t) {
  const u = 1 - t; const [a, b, c, d] = ctrl;
  return a.map((_, i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i]);
}
function bezPts(ctrl, n = 24) { const o = []; for (let i = 0; i <= n; i++) o.push(bez(ctrl, i / n)); return o; }
// Quadratic bezier.
function qbez(a, c, b, t) { const u = 1 - t; return a.map((_, i) => u * u * a[i] + 2 * u * t * c[i] + t * t * b[i]); }
function qbezPts(a, c, b, n = 20) { const o = []; for (let i = 0; i <= n; i++) o.push(qbez(a, c, b, i / n)); return o; }

// SVG path data.
const fmt = v => (Math.round(v * 10) / 10).toString();
function polyD(pts, closed = true) {
  if (!pts.length) return '';
  let s = 'M' + fmt(pts[0][0]) + ' ' + fmt(pts[0][1]);
  for (let i = 1; i < pts.length; i++) s += 'L' + fmt(pts[i][0]) + ' ' + fmt(pts[i][1]);
  return closed ? s + 'Z' : s;
}
const ringsD = rings => rings.map(r => polyD(r, true)).join('');

// Point in polygon (even-odd over rings).
function inRings(rings, x, y) {
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
  }
  return inside;
}
function bbox(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const p of r) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [x0, y0, x1, y1];
}
// Deterministic noise.
function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash1(x) { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return mix(hash1(i), hash1(i + 1), u) * 2 - 1; }

module.exports = {
  add, sub, mul, dot, len, norm, lerp, cross, clamp, smoothstep, deg, mix,
  I3, mmul, mvec, transpose, inv3, rotX, rotY, rotZ, euler, rotBetween, axisAngle,
  T, tapply, tcompose, tinv,
  d2, polyLength, signedArea, resample, chaikin, laplace, rdp, rdpClosed, ringNormals, lineNormals,
  catmull, bez, bezPts, qbez, qbezPts, polyD, ringsD, fmt, inRings, bbox, rng, hash1, noise1,
};
