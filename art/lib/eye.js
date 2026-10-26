'use strict';
// Eye constructor. Geometry is authored in eye-local 2D units (1 = eye half-width; x toward the
// outer corner, y down) and mapped to the screen with an affine frame from the 3D head.
const G = require('./geom');
const L = require('./line');
const Cc = require('./color');
const { path, g } = require('./svg');

const DEFAULTS = {
  open: 1, lowerLid: 0, tilt: 0.16, gaze: [0, 0], irisR: 0.62, irisRy: 0.68,
  pupil: 'slit', pupilW: 0.13, pupilH: 0.5,
  iris: '#2bb3a8', sclera: '#f6f1ea', lidColor: '#1d1420', lashColor: '#140d17',
  lash: 0.21, wing: 0.55, wingUp: 0.32, lowerWing: 0.0, lashes: 2, crease: true,
  brow: { raise: 0, angle: 0, curve: 0.25, color: null, width: 0.17, x0: -0.75, x1: 0.95, y: -1.42 },
  closed: null, // 'happy' (^) | 'calm' (u) | 'sleepy' (half lid)
  glow: 0, light: [-0.7, -0.6], shade: 0,
};

// Bezier helpers in local space
const cubic = (a, b, c, d, n = 28) => G.bezPts([a, b, c, d], n);

function geometry(p) {
  const I = [-1, 0.06], O = [1, -0.1 - p.tilt];
  const op = Math.max(0.02, p.open);
  const upTop = -0.95 * op, lowBot = 0.52 * Math.max(0.05, 1 - p.lowerLid) * Math.min(1.15, 0.55 + 0.45 * op);
  const upper = cubic(I, [-0.62, upTop * 0.92 + 0.05], [0.42, upTop * 1.02], O);
  const lower = cubic(O, [0.5, lowBot * 0.95 - p.tilt * 0.4], [-0.45, lowBot], I);
  return { I, O, upper, lower, white: upper.concat(lower.slice(1)) };
}

// Build SVG for one eye. frame: { c:[x,y], ex:[x,y], ey:[x,y] } maps local units to screen.
function eye(doc, frame, params = {}) {
  const p = { ...DEFAULTS, ...params, brow: { ...DEFAULTS.brow, ...(params.brow || {}) } };
  const map = q => [frame.c[0] + q[0] * frame.ex[0] + q[1] * frame.ey[0], frame.c[1] + q[0] * frame.ex[1] + q[1] * frame.ey[1]];
  const mapAll = arr => arr.map(map);
  const scale = Math.sqrt(Math.abs(frame.ex[0] * frame.ey[1] - frame.ex[1] * frame.ey[0])); // screen units per local unit
  const sx = Math.hypot(...frame.ex);
  const out = [];
  const ink = (pts, w, prof, col, extra = {}) => out.push(path(G.polyD(L.taper(mapAll(pts), w, { profile: prof, step: Math.max(0.4, scale * 0.04) })), { fill: col, ...extra }));
  const lidCol = p.lidColor, lashCol = p.lashColor;
  const browCol = p.brow.color || lidCol;

  // ---- brow (tapered fur brow) ----
  if (p.brow && p.brow.width > 0) {
    const b = p.brow, y0 = b.y - b.raise * 0.35 + b.angle * 0.22, y1 = b.y - b.raise * 0.35 - b.angle * 0.18 + 0.05;
    const mid = (y0 + y1) / 2 - b.curve * 0.5 - b.raise * 0.05;
    const bp = G.qbezPts([b.x0, y0], [(b.x0 + b.x1) / 2 - 0.1, mid], [b.x1, y1], 24);
    ink(bp, scale * b.width, L.taperProfile({ start: 0.08, end: 0.75 }), browCol);
  }

  // ---- eyeshadow: a soft coloured band over the upper lid, strongest toward the outer corner ----
  if (p.eyeshadow) {
    const g0 = geometry(p.closed ? { ...p, open: 0.28 } : p); // closed eyes: a thin band hugging the lid line
    const band = g0.upper.concat(g0.upper.slice().reverse().map(q => [q[0] * 1.06 + 0.04, q[1] - 0.32 - 0.22 * Math.max(0, (q[0] + 1) / 2)]));
    out.push(path(G.polyD(mapAll(band)), { fill: p.eyeshadow, opacity: p.eyeshadowOpacity ?? 0.75, filter: doc.blur(scale * 0.09) }));
  }

  if (p.closed === 'happy' || p.closed === 'calm') {
    // closed eye: one thick arc with lashes at the outer end
    const up = p.closed === 'happy' ? -0.55 : 0.35;
    const arc = cubic([-1, 0.12], [-0.5, up], [0.45, up - 0.05], [1, -0.08 - p.tilt]);
    ink(arc, scale * 0.17, L.taperProfile({ start: 0.25, end: 0.1 }), lashCol);
    const tip = arc[arc.length - 1];
    const wing = G.qbezPts(tip, [tip[0] + 0.25, tip[1] - 0.05], [tip[0] + p.wing * 0.8, tip[1] - p.wingUp * 0.7], 10);
    ink(wing, scale * 0.12, L.taperProfile({ start: 0, end: 0.9 }), lashCol);
    if (p.closed === 'happy') ink(cubic([-0.55, 0.42], [-0.2, 0.55], [0.25, 0.55], [0.55, 0.38], 12), scale * 0.05, L.taperProfile({ start: 0.4, end: 0.4 }), lidCol, { opacity: 0.45 });
    return g({ class: 'eye' }, out);
  }

  const geo = geometry(p);
  const whiteD = G.polyD(mapAll(geo.white));
  const clip = doc.clip(whiteD, { rule: 'nonzero' });
  // ---- eyeball ----
  const inner = [];
  inner.push(path(whiteD, { fill: p.sclera }));
  // sclera shading: soft darker edges, lid shadow
  inner.push(path(whiteD, { fill: 'none', stroke: '#a594b8', 'stroke-width': scale * 0.32, opacity: 0.55, filter: doc.blur(scale * 0.12), style: 'mix-blend-mode:multiply' }));
  // iris
  const ic = [p.gaze[0] * 0.38, 0.06 + p.gaze[1] * 0.22];
  const irisPts = [];
  for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; irisPts.push([ic[0] + Math.cos(t) * p.irisR, ic[1] + Math.sin(t) * p.irisRy]); }
  const irisD = G.polyD(mapAll(irisPts));
  const ir = Cc.ramp(p.iris);
  const dark = Cc.shift(p.iris, { dL: -0.3, cK: 1.1, toward: 260, dh: 18 });
  const light = Cc.shift(p.iris, { dL: 0.16, cK: 1.05, toward: 95, dh: 18 });
  const top = map([ic[0], ic[1] - p.irisRy]), bot = map([ic[0], ic[1] + p.irisRy]);
  const grad = doc.linear([[0, dark], [0.38, ir.mid], [0.72, p.iris], [1, light]], { x1: top[0], y1: top[1], x2: bot[0], y2: bot[1], units: 'userSpaceOnUse' });
  inner.push(path(irisD, { fill: grad }));
  // lower glow crescent (light passing through the iris)
  const glowPts = []; for (let i = 0; i <= 24; i++) { const t = Math.PI * (0.12 + 0.76 * i / 24); glowPts.push([ic[0] + Math.cos(t) * p.irisR * 0.8, ic[1] + Math.sin(t) * p.irisRy * 0.8]); }
  for (let i = 24; i >= 0; i--) { const t = Math.PI * (0.12 + 0.76 * i / 24); glowPts.push([ic[0] + Math.cos(t) * p.irisR * 0.45, ic[1] + 0.12 + Math.sin(t) * p.irisRy * 0.42]); }
  inner.push(path(G.polyD(mapAll(glowPts)), { fill: light, opacity: 0.75, filter: doc.blur(scale * 0.08) }));
  // radial streaks
  for (let k = 0; k < 14; k++) {
    const t = k / 14 * Math.PI * 2 + 0.2, r0 = 0.28, r1 = 0.56 + 0.04 * Math.sin(k * 3);
    const a = [ic[0] + Math.cos(t) * p.irisR * r0 / 0.62, ic[1] + Math.sin(t) * p.irisRy * r0 / 0.62], b2 = [ic[0] + Math.cos(t) * p.irisR * r1 / 0.62, ic[1] + Math.sin(t) * p.irisRy * r1 / 0.62];
    ink([a, b2], scale * 0.035, L.taperProfile({ start: 0.3, end: 0.5 }), k % 2 ? light : dark, { opacity: 0.35 });
  }
  const streaks = out.splice(out.length - 14, 14);
  inner.push(...streaks);
  // limbal ring
  const ring = L.band(mapAll(irisPts), scale * 0.07, { step: 0, smooth: false });
  inner.push(path(G.polyD(ring[0]) + G.polyD(ring[1]), { fill: dark, 'fill-rule': 'evenodd', opacity: 0.9 }));
  // pupil
  let pupPts = [];
  if (p.pupil === 'slit') { for (let i = 0; i < 32; i++) { const t = i / 32 * Math.PI * 2; pupPts.push([ic[0] + Math.cos(t) * p.pupilW * (1 - 0.35 * Math.abs(Math.sin(t)) ** 4), ic[1] + Math.sin(t) * p.pupilH]); } }
  else if (p.pupil === 'hslit') { for (let i = 0; i < 32; i++) { const t = i / 32 * Math.PI * 2; pupPts.push([ic[0] + Math.cos(t) * 0.34, ic[1] + 0.02 + Math.sin(t) * 0.16]); } }
  else { const r = p.pupilR || 0.27; for (let i = 0; i < 32; i++) { const t = i / 32 * Math.PI * 2; pupPts.push([ic[0] + Math.cos(t) * r, ic[1] + Math.sin(t) * r * 1.05]); } }
  inner.push(path(G.polyD(mapAll(pupPts)), { fill: Cc.shift(dark, { dL: -0.2 }) }));
  // upper lid shadow over sclera and iris
  const lidShadow = geo.upper.map(q => q).concat(geo.upper.slice().reverse().map(q => [q[0], q[1] + 0.42 + 0.1 * Math.sin((q[0] + 1) * Math.PI / 2)]));
  inner.push(path(G.polyD(mapAll(lidShadow)), { fill: '#5d4a72', opacity: 0.42, filter: doc.blur(scale * 0.07), style: 'mix-blend-mode:multiply' }));
  if (p.shade > 0) inner.push(path(whiteD, { fill: '#7a68a0', opacity: 0.35 * p.shade, style: 'mix-blend-mode:multiply' }));
  // highlights (main toward the light, secondary opposite)
  const lx = p.light[0], ly = p.light[1], lm = Math.hypot(lx, ly) || 1;
  const hc = [ic[0] + lx / lm * 0.26, ic[1] + ly / lm * 0.3];
  const hl = []; for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; hl.push([hc[0] + Math.cos(t) * 0.17, hc[1] + Math.sin(t) * 0.14]); }
  inner.push(path(G.polyD(mapAll(hl)), { fill: '#ffffff' }));
  const h2c = [ic[0] - lx / lm * 0.24, ic[1] - ly / lm * 0.26 + 0.05];
  const h2 = []; for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; h2.push([h2c[0] + Math.cos(t) * 0.07, h2c[1] + Math.sin(t) * 0.06]); }
  inner.push(path(G.polyD(mapAll(h2)), { fill: '#ffffff', opacity: 0.85 }));
  if (p.glow) inner.push(path(irisD, { fill: light, opacity: 0.5 * p.glow, filter: doc.glow(scale * 0.25, 1.2), style: 'mix-blend-mode:screen' }));
  out.push(g({ 'clip-path': clip }, inner));
  if (p.glow) out.push(path(irisD, { fill: light, opacity: 0.35 * p.glow, filter: doc.blur(scale * 0.5), style: 'mix-blend-mode:screen' }));

  // ---- lids and lashes ----
  // lower lid: thin, lighter, outer two thirds
  const lowSeg = geo.lower.slice(0, Math.round(geo.lower.length * 0.7));
  ink(lowSeg, scale * 0.06, L.taperProfile({ start: 0.15, end: 0.6 }), lidCol, { opacity: 0.85 });
  // lower kohl wing (Egyptian eye)
  if (p.lowerWing > 0) {
    const o = geo.O;
    ink(G.qbezPts([o[0] - 0.25, o[1] + 0.12], [o[0] + 0.2, o[1] + 0.12], [o[0] + p.lowerWing, o[1] - 0.08], 12), scale * 0.06, L.taperProfile({ start: 0.3, end: 0.8 }), lashCol, { opacity: 0.9 });
  }
  // upper lash mass: thick, tapered at the inner corner, continuing into a wing
  const o = geo.O;
  const wingPts = G.qbezPts(o, [o[0] + p.wing * 0.45, o[1] - p.wingUp * 0.25], [o[0] + p.wing, o[1] - p.wingUp], 12);
  const lashLine = geo.upper.concat(wingPts.slice(1));
  const n = lashLine.length, nu = geo.upper.length;
  ink(lashLine, (t, i) => {
    const s = i < nu ? i / nu : 1 + (i - nu) / (n - nu);
    const body = s < 1 ? (0.35 + 0.65 * G.smoothstep(0, 0.7, s)) : 1 - (s - 1) * 0.6;
    return scale * p.lash * body;
  }, L.taperProfile({ start: 0.06, end: 0.35 }), lashCol);
  // lash spikes near the outer corner
  for (let k = 0; k < p.lashes; k++) {
    const t = 0.8 + k * 0.1;
    const i = Math.min(nu - 2, Math.round(t * (nu - 1)));
    const a = geo.upper[i], b = geo.upper[i + 1];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const nrm = [ty / tl, -tx / tl]; // outward (up)
    const len = 0.2 + 0.05 * k;
    const tip = [a[0] + nrm[0] * len + 0.3 + 0.08 * k, a[1] + nrm[1] * len + 0.04];
    ink(G.qbezPts(a, [a[0] + nrm[0] * len * 0.8 + 0.02, a[1] + nrm[1] * len * 0.8], tip, 8), scale * 0.1, L.taperProfile({ start: 0, end: 0.95 }), lashCol);
  }
  // lid crease
  if (p.crease) {
    const cr = geo.upper.slice(Math.round(nu * 0.25), Math.round(nu * 0.9)).map(q => [q[0] + 0.04, q[1] - 0.24 - 0.08 * Math.sin((q[0] + 1) * Math.PI / 2)]);
    ink(cr, scale * 0.045, L.taperProfile({ start: 0.4, end: 0.4 }), lidCol, { opacity: 0.55 });
  }
  return g({ class: 'eye' }, out);
}

module.exports = { eye, geometry, DEFAULTS };
