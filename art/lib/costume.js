'use strict';
// Costume building blocks: field-based garments painted on the body surface (they follow pose and
// form), 3D jewellery (tori, gems, discs) shaded as metal, and fabric fold overlays.
const G = require('./geom');
const B = require('./build');
const Ln = require('./line');
const Cc = require('./color');
const { path, g } = require('./svg');

const TORSO = ['torso.chest', 'torso.waist', 'torso.pelvis', 'torso.clav', 'torso.glute', 'torso.bust', 'torso.abs'];

// ---------- usekh broad collar: rows of radial tube beads around the neck base ----------
// rows: [{ w, color, beads: n (cells per radian) | 0, gap }], drops: { len, n, color }
function usekh({ parts = TORSO, c = [0, -48.5, -1.2], r0 = 5.4, rows, drops, gold = '#d9a73e', sx = 1, sy = 1, sz = 0.92, shadow = '#4a3a62' } = {}) {
  const d = p => Math.hypot((p[0] - c[0]) * sx, (p[1] - c[1]) * sy, (p[2] - c[2]) * sz);
  const phi = p => Math.atan2(p[0] - c[0], p[2] - c[2]);
  const out = [];
  let r = r0;
  const outer = r0 + rows.reduce((s, rw) => s + rw.w, 0);
  // base: the whole collar area in gold (separators show through between bead rows)
  const dropEdge = p => {
    if (!drops) return outer - d(p);
    const a = phi(p) * drops.n / 2, k = Math.abs(Math.sin(a));
    return outer + drops.len * Math.pow(1 - k, 0.6) * 0.95 - d(p) - (1 - Math.pow(1 - k, 0.6)) * 0.2;
  };
  // soft contact shadow under the collar edge (the collar is thick and casts onto the chest)
  out.push({ parts, color: shadow, opacity: 0.5, blur: 1.2, blend: 'multiply', fn: p => Math.min(dropEdge(p) + 1.1, d(p) - r0) });
  out.push({ parts, color: gold, edge: Cc.ramp(gold).line, edgeWidth: 0.9, fn: p => Math.min(d(p) - r0, outer - d(p) + 0.01) });
  for (const rw of rows) {
    const a = r, b = r + rw.w; r = b;
    if (!rw.color) continue;
    const gap = rw.gap ?? 0.16;
    out.push({ parts, color: rw.color, fn: p => {
      const dd = d(p); let v = Math.min(dd - a - gap, b - gap - dd);
      if (rw.beads) { const ang = phi(p) * rw.beads, f = ang - Math.round(ang); v = Math.min(v, (0.5 - Math.abs(f)) * 1.6 - gap * 2); }
      return v;
    } });
  }
  if (drops) {
    out.push({ parts, color: gold, edge: Cc.ramp(gold).line, edgeWidth: 0.9, fn: p => Math.min(dropEdge(p), d(p) - outer + 0.02) });
    out.push({ parts, color: drops.color, fn: p => Math.min(dropEdge(p) - 0.32, d(p) - outer - 0.3) });
  }
  return out;
}

// Generic field region with optional edge line.
const region = (parts, fn, color, extra = {}) => ({ parts, fn, color, ...extra });

// Glints on glossy bands: post-shading highlights where the surface faces the half vector.
function glint(parts, fn, { color = '#fff4c8', gloss = 0.9, light = [-0.62, -0.58, 0.52], opacity = 0.9 } = {}) {
  const H = G.norm(G.add(G.norm(light), [0, 0, 1]));
  return { parts, stage: 'post', color, opacity, blend: 'screen', smooth: 1, fn: (p, id, Rs) => {
    const nh = Rs.nx[id] * H[0] + Rs.ny[id] * H[1] + Rs.nz[id] * H[2];
    return Math.min(fn(p), (nh - gloss) * 30);
  } };
}

// ---------- 3D jewellery ----------
// Torus as spheres along a circle: centre c, axis n (normal of the ring plane), ring radius R, tube r.
function torus(c, n, R, r, { seg = 0, phase = 0 } = {}) {
  n = G.norm(n);
  let a = G.norm(G.cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); const b = G.cross(n, a);
  const pts = [], N = seg || Math.max(24, Math.round(2 * Math.PI * R / (r * 0.45)));
  for (let i = 0; i <= N; i++) { const t = phase + i / N * Math.PI * 2; pts.push(G.add(c, G.add(G.mul(a, Math.cos(t) * R), G.mul(b, Math.sin(t) * R)))); }
  return pts.map(p => B.sphere(p, r));
}
// Band around a limb segment frame (canonical bone space): at fraction t of length L, radius rr.
function limbBand(frame, L, t, rr, width, { mat = 'gold', name = 'band' } = {}) {
  const c = G.tapply(frame, [0, L * t, 0]);
  const n = G.mvec(frame.R, [0, 1, 0]);
  const prims = [];
  for (let k = -1; k <= 1; k += 0.5) prims.push(...torus(G.add(c, G.mul(n, k * width / 2.2)), n, rr, width * 0.32));
  return { name, mat, prims, k: 0.25 };
}
// Disc (sun disk) as a thin ellipsoid; ring rim as torus.
function disc(c, n, R, thick = 0.12) {
  n = G.norm(n);
  const Rm = G.rotBetween([0, 0, 1], n);
  return B.ell(c, [R, R, R * thick], Rm);
}

// ---------- fabric folds (overlay lines from tension points) ----------
// lines: arrays of world points along the cloth surface. Visible runs get tapered strokes.
function folds(Rs, lines, { color = '#8b7f73', width = 1.1, opacity = 0.6, hi = '#ffffff', hiOpacity = 0.35 } = {}) {
  const out = [], sc = Rs.view.s;
  for (const ln of lines) {
    const pr = ln.map(p => Rs.project(p));
    const vis = pr.map(p => Rs.visible(p[0], p[1], p[2], 0.6));
    let cur = [];
    const flush = () => { if (cur.length > 3) {
      out.push(path(G.polyD(Ln.taper(cur, width * sc, { profile: Ln.taperProfile({ start: 0.35, end: 0.25 }) })), { fill: color, opacity }));
      if (hi) out.push(path(G.polyD(Ln.taper(cur.map(p => [p[0] + 0.9 * width * sc, p[1]]), width * sc * 0.7, { profile: Ln.taperProfile({ start: 0.45, end: 0.35 }) })), { fill: hi, opacity: hiOpacity, style: 'mix-blend-mode:screen' }));
    } cur = []; };
    pr.forEach((p, i) => { if (vis[i]) cur.push([p[0], p[1]]); else flush(); });
    flush();
  }
  return g({ class: 'folds' }, out);
}

// Skirt: elliptic sections from the waist to the hem, bound to the pelvis (rest coords).
// rows: [[y, halfWidth, halfDepth, zShift], ...]
function skirt(pelvT, rows, { mat = 'linen', name = 'skirt', step = 1.6, k = 1.2, pleats = 0, pleatAmp = 0.35 } = {}) {
  const lerpRow = y => { let i = 1; while (i < rows.length - 1 && rows[i][0] < y) i++; const a = rows[i - 1], b = rows[i]; const f = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0]))); return a.map((v, k2) => v + (b[k2] - v) * f); };
  const prims = [];
  for (let y = rows[0][0] + 2; y <= rows[rows.length - 1][0] - 2; y += step) { const [, w, d, z] = lerpRow(y); prims.push(B.xform(B.ell([0, y, z], [w, 4.5, d]), pelvT)); }
  const bump = pleats ? (p => { const a = Math.atan2(p[0], p[2]); const s = Math.sin(a * pleats + 0.3 * Math.sin(p[1] * 0.08)); const k2 = pleatAmp * G.smoothstep(rows[0][0] + 6, rows[0][0] + 22, p[1]); return [Math.cos(a) * s * k2, 0, -Math.sin(a) * s * k2]; }) : null;
  return { name, k: 1.5, parts: [{ name, mat, frame: pelvT, prims, k, bump }] };
}
// Paw pads in hand-local coordinates: a three-lobed main pad on the palm and one pad per fingertip.
function pawPads(side, color, tipPads, { mirror = false } = {}) {
  const s = mirror ? -1 : 1;
  const main = p => {
    if (p[2] < 0.45) return -1;
    const lobes = [[0, 3.6], [s * 1.3, 4.3], [-s * 1.3, 4.3]].map(([x, y]) => 1.25 - Math.hypot((p[0] - x) * 0.9, (p[1] - y) * 0.75));
    const body = 1.55 - Math.hypot(p[0] * 0.62, (p[1] - 4.9) * 1.1);
    return Math.max(body, ...lobes) * 1.2;
  };
  const out = [{ parts: ['hand' + side + '.palm'], color, fn: main }];
  const fingerParts = ['f0', 'f1', 'f2', 'f3', 'thumb'].map(n => 'hand' + side + '.' + n);
  if (tipPads) out.push({ parts: fingerParts, color, fn: p => { let v = -1; for (const tp of tipPads) v = Math.max(v, tp.r - G.len(G.sub(p, tp.c))); return v * 1.5; } });
  return out;
}
module.exports = { pawPads, skirt, TORSO, usekh, region, glint, torus, limbBand, disc, folds };
