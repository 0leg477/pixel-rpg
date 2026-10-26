'use strict';
// Texture brushes: fur strokes, snake / crocodile scale fields on sweeps, fabric fold lines.
const G = require('./geom');
const Ln = require('./line');
const Cc = require('./color');
const { path, g } = require('./svg');

// Arc-length / angle parametrisation of a 3D path (for fields on sweeps like tails and snake bodies).
function pathParam(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + G.len(G.sub(pts[i], pts[i - 1])));
  const frames = pts.map((p, i) => {
    const t = G.norm(G.sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
    let nrm = G.norm(G.cross(t, [1, 0, 0])); if (G.len(G.cross(t, [1, 0, 0])) < 0.2) nrm = G.norm(G.cross(t, [0, 0, 1]));
    return { t, n: nrm, b: G.cross(t, nrm) };
  });
  return p => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const d = (p[0] - pts[i][0]) ** 2 + (p[1] - pts[i][1]) ** 2 + (p[2] - pts[i][2]) ** 2; if (d < bd) { bd = d; best = i; } }
    const f = frames[best], q = G.sub(p, pts[best]);
    return { s: L[best] + G.dot(q, f.t), theta: Math.atan2(G.dot(q, f.b), G.dot(q, f.n)), total: L[L.length - 1], r: Math.sqrt(bd), frame: f };
  };
}

// Overlapping snake scales on (u = around, v = along). Returns marking specs (gaps, sheen).
// param(p) -> { u, v } in scale units; front(p) -> true where ventral plates replace scales.
function snakeScales(parts, param, { gap = '#0c3a28', sheen = '#7fe0b0', opacity = 0.85, ventral = null } = {}) {
  const cell = p => {
    const { u, v } = param(p);
    const row = Math.floor(v), off = (row & 1) * 0.5;
    const cu = u + off, iu = Math.floor(cu);
    const x = cu - iu - 0.5, y = v - row - 0.5; // -0.5..0.5
    return { x, y };
  };
  const inside = ({ x, y }) => 0.42 - (Math.abs(x) * 1.1 + Math.max(0, y) * 0.9 + Math.max(0, -y) * 0.5); // teardrop toward the tail
  const out = [
    { parts, color: gap, opacity, smooth: 1, fn: p => { if (ventral && ventral(p) > 0) return -1; return -inside(cell(p)) * 2 + 0.02; } },
    { parts, stage: 'post', color: sheen, opacity: 0.35, blend: 'screen', smooth: 1, fn: p => { if (ventral && ventral(p) > 0) return -1; const c = cell(p); return Math.min(inside(c) - 0.1, -c.y - 0.05) * 2; } },
  ];
  return out;
}
// Ventral plates: transverse bands along v.
function ventralPlates(parts, param, ventral, { color = '#e9cc54', line = '#a2862a' } = {}) {
  return [
    { parts, color, smooth: 1, fn: p => ventral(p) },
    { parts, color: line, opacity: 0.8, smooth: 1, fn: p => { if (ventral(p) <= 0) return -1; const { v } = param(p); const f = v - Math.floor(v); return 0.08 - Math.min(f, 1 - f); } },
  ];
}
// Crocodile scutes: rectangular plates touching at the edges, darker cracks, raised keels on the back rows.
function crocScutes(parts, param, { crack = '#2f3818', keel = '#8a985a', back = null } = {}) {
  const cell = p => { const { u, v } = param(p); const row = Math.floor(v), off = (row & 1) * 0.3; const cu = u + off; return { x: cu - Math.floor(cu) - 0.5, y: v - row - 0.5 }; };
  return [
    { parts, color: crack, opacity: 0.9, smooth: 1, fn: p => { const c = cell(p); return Math.max(Math.abs(c.x) - 0.44, Math.abs(c.y) - 0.42) * 3; } },
    back && { parts, stage: 'post', color: keel, opacity: 0.6, blend: 'screen', smooth: 1, fn: p => { if (back(p) <= 0) return -1; const c = cell(p); return Math.min(0.12 - Math.abs(c.x), 0.3 - Math.abs(c.y)) * 2; } },
  ].filter(Boolean);
}

// Fur strokes: short tapered arcs over the visible surface of the given parts, following a flow direction.
// flow(pLocal, part) -> model-space direction; colours split by light.
function furStrokes(doc, Rs, { parts, spacing = 9, len = 9, width = 1.5, dark = '#7a4a24', light = '#f4d29a', lightDir = [-0.62, -0.55, 0.56], seed = 1, opacity = 0.55, flow = null }) {
  const pis = new Set(Rs.parts.filter(p => parts.includes(p.name)).map(p => p.pi));
  const out = [], rnd = G.rng(seed);
  const Lk = G.norm(lightDir);
  for (let y = Rs.y0; y < Rs.y0 + Rs.H * Rs.step; y += spacing) for (let x = Rs.x0; x < Rs.x0 + Rs.W * Rs.step; x += spacing) {
    const jx = x + (rnd() - 0.5) * spacing, jy = y + (rnd() - 0.5) * spacing;
    const id = Rs.idAt(jx, jy);
    if (id < 0 || Rs.g1[id] < 0 || !pis.has(Rs.part1[id]) || Rs.f1[id] < 3) continue;
    const n = Rs.normal(id), lam = n[0] * Lk[0] + n[1] * Lk[1] + n[2] * Lk[2];
    // direction: projected flow, default "downward along the surface"
    let d = [0, 1, 0];
    if (flow) { const loc = Rs.toLocal(Rs.part1[id], Rs.pointOf(id)); d = G.mvec(Rs.view.R, flow(loc, Rs.parts[Rs.part1[id]])); }
    let dx = d[0], dy = d[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const L = len * (0.7 + 0.6 * rnd()) * Math.max(0.35, n[2]);
    const bend = (rnd() - 0.5) * 0.6;
    const pts = [[jx, jy], [jx + dx * L * 0.5 - dy * bend * L * 0.25, jy + dy * L * 0.5 + dx * bend * L * 0.25], [jx + dx * L, jy + dy * L]];
    const col = lam > 0.15 ? light : dark;
    out.push(path(G.polyD(Ln.taper(G.qbezPts(pts[0], pts[1], pts[2], 6), width, { profile: Ln.taperProfile({ start: 0.25, end: 0.7 }), step: 0 })), { fill: col, opacity: opacity * (lam > 0.15 ? 0.7 : 1) }));
  }
  return g({ class: 'fur' }, out);
}

module.exports = { pathParam, snakeScales, ventralPlates, crocScutes, furStrokes };
