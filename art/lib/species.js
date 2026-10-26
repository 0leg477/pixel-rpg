'use strict';
// Species defaults: palettes, head markings (3D fields in head-local units), extra head volumes
// (horns, cobra hood) and fur tuft zones. Heroine specs build on these.
const G = require('./geom');
const B = require('./build');

const u = (p, R) => [p[0] / R, p[1] / R, p[2] / R];
const ellField = (q, c, r) => 1 - Math.hypot((q[0] - c[0]) / r[0], (q[1] - c[1]) / r[1], (q[2] - c[2]) / r[2]);
const HEAD_ALL = ['head.cranium', 'head.cheek', 'head.jaw', 'head.muzzle', 'head.brow'];

const SPECIES = {
  cat: {
    pal: { fur: '#d6a466', muzzle: '#f6e4c4', mark: '#9d6436', innerEar: '#e2a29b', nose: '#c67f80', eye: '#1fc2b2' },
    markings: (R, pal) => [
      { parts: HEAD_ALL, color: pal.muzzle, fn: p => { const q = u(p, R); return 0.5 - Math.hypot(q[0] / 1.15, (q[1] - 0.5) * 1.15, (q[2] - 0.58) * 0.8); } },
    ],
    tufts: (R, s) => [{ parts: ['head.cheek', 'head.jaw'], amp: 0.22 * R * s, period: 0.3 * R * s, flow: [0, 1], lean: 0.9, where: n => n[1] > 0.0 }],
  },
  fennec: {
    pal: { fur: '#efd3a4', muzzle: '#fcf5e8', mark: '#c07a45', innerEar: '#f4d2c6', nose: '#2a1e20', eye: '#e39a2a' },
    markings: (R, pal) => [
      { parts: HEAD_ALL, color: pal.muzzle, fn: p => { const q = u(p, R); return Math.max(ellField(q, [0, 0.52, 0.75], [0.62, 0.32, 0.8]), ellField(q, [0, 0.62, 0.2], [0.55, 0.28, 0.5])) * 0.5; } },
      // tear streak from the inner eye corner down the muzzle side
      { parts: HEAD_ALL, color: pal.mark, opacity: 0.85, fn: p => { const q = u(p, R), s = Math.sign(q[0]) || 1; const t = G.clamp((q[1] - 0.12) / 0.3); const x = s * (0.22 - 0.06 * t); return Math.min(0.035 - Math.abs(q[0] - x), q[1] - 0.1, 0.42 - q[1], q[2] - 0.6) ; } },
    ],
    tufts: (R, s) => [{ parts: ['head.cheek', 'head.jaw'], amp: 0.2 * R * s, period: 0.28 * R * s, flow: [0, 1], lean: 0.8, where: n => n[1] > -0.1 }],
  },
  lion: {
    pal: { fur: '#c98a45', muzzle: '#f1dfbd', mark: '#3a2418', innerEar: '#e4b3a0', nose: '#b56b5c', eye: '#f08a1c' },
    markings: (R, pal) => [
      { parts: HEAD_ALL, color: pal.muzzle, fn: p => { const q = u(p, R); return Math.max(ellField(q, [0, 0.62, 0.78], [0.55, 0.3, 0.55]), ellField(q, [0, 0.3, 1.05], [0.1, 0.16, 0.2])) * 0.5; } },
      // whisker spots
      { parts: ['head.muzzle'], color: pal.mark, opacity: 0.7, fn: p => { const q = u(p, R); let v = -1; for (const [x, y] of [[0.16, 0.47], [0.22, 0.52], [0.18, 0.56], [0.27, 0.49]]) for (const s of [-1, 1]) v = Math.max(v, 0.022 - Math.hypot(q[0] - s * x, q[1] - y)); return v * 3; } },
    ],
    tufts: (R, s) => [{ parts: ['head.cheek', 'head.jaw'], amp: 0.12 * R * s, period: 0.25 * R * s, flow: [0, 1], lean: 0.7, where: n => n[1] > 0.2 }],
  },
  cobra: {
    pal: { fur: '#1f8a5a', muzzle: '#e9cc54', mark: '#0f4f37', innerEar: '#e9cc54', nose: '#0d2a1d', eye: '#f2d23a' },
    markings: (R, pal) => [
      // pale throat and lower jaw (ventral scales)
      { parts: HEAD_ALL, color: pal.muzzle, fn: p => { const q = u(p, R); return Math.min(q[1] - 0.3 + 0.06 * Math.abs(q[0]), 0.9 - Math.abs(q[0])) * 1.2; } },
      // darker crown plates
      { parts: ['head.cranium', 'head.muzzle'], color: pal.mark, opacity: 0.55, fn: p => { const q = u(p, R); return Math.min(-q[1] - 0.35, 0.5 - Math.abs(q[0])) * 1.2; } },
    ],
    scales: { kind: 'snake' },
    tufts: () => [],
  },
  croc: {
    pal: { fur: '#6f7d3c', muzzle: '#d9d09c', mark: '#4a5428', innerEar: '#d9d09c', nose: '#1d2010', eye: '#b8e04a' },
    markings: (R, pal) => [
      { parts: HEAD_ALL, color: pal.muzzle, fn: p => { const q = u(p, R); return (q[1] - 0.34 + 0.05 * Math.abs(q[0])) * 1.2; } },
      // osteoderm bumps on top of the head and brow ridges
      { parts: ['head.cranium', 'head.brow'], color: pal.mark, opacity: 0.8, fn: p => { const q = u(p, R); const cx = q[0] / 0.16, cz = q[2] / 0.16; const fx = cx - Math.round(cx), fz = cz - Math.round(cz); return Math.min(0.32 - Math.hypot(fx, fz), -q[1] - 0.5) * 0.4; } },
    ],
    scales: { kind: 'croc' },
    tufts: () => [],
  },
  cow: {
    pal: { fur: '#f3efe7', muzzle: '#f2c6c0', mark: '#6e4128', innerEar: '#f0b6b0', nose: '#e59b9a', eye: '#8a4fc2', horn: '#e8d8b0' },
    markings: (R, pal) => [
      // brown patches: smooth noise blobs on the cranium and around one eye
      { parts: HEAD_ALL, color: pal.mark, fn: p => { const q = u(p, R); return Math.max(ellField(q, [0.55, -0.2, 0.55], [0.42, 0.38, 0.5]), ellField(q, [-0.4, -0.75, 0.1], [0.5, 0.35, 0.6]), ellField(q, [-0.9, 0.1, -0.3], [0.4, 0.45, 0.6])) * 0.4 + 0.05 * Math.sin(q[0] * 9) * Math.sin(q[1] * 7); } },
    ],
    extra: (head, mats) => [hornGroup(head, mats.horn || 'horn')],
    tufts: (R, s) => [{ parts: ['head.cranium'], amp: 0.14 * R * s, period: 0.22 * R * s, flow: [0, 1], lean: 0.5, where: n => n[1] < -0.6 }],
  },
  jackal: {
    pal: { fur: '#26232e', muzzle: '#2f2b38', mark: '#d9a740', innerEar: '#d9a740', nose: '#0e0d12', eye: '#ffc531' },
    markings: (R, pal) => [
      // gold brow marks and a thin gold line along the muzzle bridge
      { parts: HEAD_ALL, color: pal.mark, fn: p => { const q = u(p, R); let v = -1; for (const s of [-1, 1]) v = Math.max(v, 0.07 - Math.hypot((q[0] - s * 0.36) / 1.6, q[1] + 0.32, (q[2] - 0.85) * 0.3)); return v * 2; } },
    ],
    tufts: (R, s) => [{ parts: ['head.cheek', 'head.jaw'], amp: 0.14 * R * s, period: 0.26 * R * s, flow: [0, 1], lean: 0.8, where: n => n[1] > 0.0 }],
  },
};

// Lyre horns (cow / Hathor), in head-local unit space mapped by the head.
function hornGroup(head, mat) {
  const R = head.R, parts = [];
  for (const s of [-1, 1]) {
    const ctrl = [[s * 0.5, -0.72, -0.02], [s * 0.95, -0.95, 0.0], [s * 1.32, -1.32, 0.05], [s * 1.36, -1.78, 0.08], [s * 1.12, -2.08, 0.06]].map(p => head.toWorld(p));
    const pts = G.catmull(ctrl, { seg: 8 });
    parts.push({ name: 'horn' + (s < 0 ? 'L' : 'R'), mat, frame: { R: head.frame.R, t: head.frame.t }, prims: B.sweep(pts, t => R * (0.17 - 0.13 * t), { spacing: 0.25 }), k: 0.05 * R });
  }
  return { name: 'horns', k: 0.02 * R, parts };
}
// Cobra hood: a cupped fan behind the head and neck (planar shape with curvature), front ventral, back patterned.
function hoodGroup(head, { mat = 'hood', matBack = 'hoodBack', w = 1.35, h = 2.7, at = [0, 1.25, -0.5] } = {}) {
  const R = head.R;
  // b axis points up: narrow top behind the head, widest at mid-neck, tapering to the shoulders
  const poly = B.smoothPoly([[0, 1.0], [-0.42, 0.85], [-0.82, 0.45], [-1, -0.05], [-0.82, -0.5], [-0.45, -0.85], [0, -1.0], [0.45, -0.85], [0.82, -0.5], [1, -0.05], [0.82, 0.45], [0.42, 0.85]], 6);
  const o = head.toWorld(at), uu = head.dirWorld([w * R, 0, 0]), vv = head.dirWorld([0, -h * R / 2, 0.12 * R]);
  const pl = B.plane(o, uu, vv, poly, { cup: [-1.1, 0.15], matBack });
  return { name: 'hood', k: 0.02 * R, parts: [{ name: 'hood', mat, prims: [pl], frame: { R: head.frame.R, t: head.frame.t } }] };
}

module.exports = { SPECIES, hornGroup, hoodGroup, HEAD_ALL, ellField };
