'use strict';
// Pin-up base shared by the heroines: an hourglass body generator and garment fields (bikini top and
// bottom) that read the same on every figure. Proportions follow the genre: small shoulders, big high
// bust, very narrow waist, wide hips, thighs thicker than the waist, small knees, hands and feet.
const G = require('./geom');
const Body = require('./body');
const Cc = require('./color');
const C = require('./costume');

// k: { bust, waist, hips, thighs, shoulders, arms, muscle, belly } scale factors around 1.
function body(k = {}, extra = {}) {
  const b = k.bust ?? 1, w = k.waist ?? 1, h = k.hips ?? 1, t = k.thighs ?? 1, sh = k.shoulders ?? 1, ar = k.arms ?? 1, bel = k.belly ?? 0;
  // ribcage egg (widest a third of the way up from its bottom), a SHORT waist just above the navel,
  // a slight forward belly, then a quick flare into the hips (the iliac crest is soft on women)
  const R = (y, hw, hd, z) => [y, hw, hd, z];
  const mixW = (a, f) => a * f;
  // z shifts give the S-curve seen on the references: ribcage forward, lower back hollow, pelvis and glutes back
  const torso = [
    R(-49, 5.8 * sh, 4.8, -1.4), R(-45, 9.6 * sh, 6.6, -0.6), R(-41, 10.8 * (0.4 + 0.6 * sh), 8.0, 0.4), R(-36, 11.2 * (0.6 + 0.4 * sh), 8.6, 1.0),
    R(-31, 10.6, 8.2, 1.2), R(-27, mixW(9.0, 0.5 + 0.5 * w), 7.2, 1.0), R(-23, mixW(7.8, w), 6.3, 0.7), R(-19, mixW(8.1, w), 6.2 + bel * 0.5, 0.6 + bel * 0.3),
    R(-15, mixW(10.0, (w + h) / 2), 6.6 + bel * 0.8, 0.5 + bel * 0.6), R(-11, mixW(12.8, (w + 2 * h) / 3), 7.2 + bel * 0.6, 0.2 + bel * 0.4),
    R(-6, 15.6 * h, 8.4, -0.4), R(-1, 17.4 * h, 9.4, -1.2), R(4, 17.0 * h, 9.8, -1.8), R(9, 13.8 * h, 8.6, -1.8)];
  return Body.deepMerge({
    neck: { len: 5.2, r: 5.0, rTop: 4.5 },
    torso,
    // shoulders lower than the jugular notch: the neck-to-shoulder line slopes down (trapezius)
    shoulder: { x: 11.6 * sh, y: -43.6, z: -1.2 },
    bust: { r: [6.9 * b, 6.5 * b, 6.6 * b], x: 6.2 * Math.sqrt(b), y: -34.0, z: 6.4 + (b - 1) * 2.4, splay: 0.3, droop: 0.06, separate: true, teardrop: true, slope: 8 },
    glutes: { r: [9.4 * h, 10.0 * h, 9.2 * h], x: 7.6 * h, y: 1.5, z: -5.2 },
    arm: { upper: 21, fore: 18.5, r: [3.4, 2.9, 2.3, 2.65, 2.65, 1.85].map(v => v * ar) },
    // thighs thickest at the top and tapering to a small knee; calves with a bulge, slim ankles
    leg: { thigh: 40, shin: 33, meta: 14, digitigrade: false, hipX: 9.0 * Math.sqrt(h), r: [10.0, 10.0, 5.0, 4.2, 4.9, 2.5, 2.1], thighR: [9.8, 9.6, 8.4, 6.6, 4.9].map((v, i) => v * (i < 3 ? t : 1 + (t - 1) * 0.5)) },
    abs: 0, muscle: k.muscle || 0, slopedShoulders: true,
    groundY: 77,
  }, extra);
}

// Triangle bikini cups in chest coordinates (the bust spec decides where they sit).
function bikiniTop(bust, { size = 1, apex = 7.5, strap = 0.42, neckX = 3.4 } = {}) {
  const bx = bust.x, by = bust.y + 0.8, base = bust.r[1] * 0.92 * size, half = bust.r[0] * 0.9 * size;
  const cup = p => { if (p[2] < 0.5) return -1; const sx = p[0] < 0 ? -1 : 1, dx = p[0] - sx * bx, dy = p[1] - by; return Math.min(base - dy, dy + apex * size - Math.abs(dx), half - Math.abs(dx)); };
  const top = by - apex * size;
  const straps = p => { if (p[1] > top + 0.5 || p[1] < -49) return -1; const t = (p[1] - top) / (-49 - top), x = bx - (bx - neckX) * t; return strap - Math.abs(Math.abs(p[0]) - x); };
  return { cup, straps, underY: by + base };
}

// Bikini bottom in pelvis coordinates: classic front cut, the back rises to cover the glutes, sides high.
function bikiniBottom({ front = 2.2, back = -8.4, crotch = 11.2, backLeg = 17.5, vcut = 0.72 } = {}) {
  const top = (x, z = 10) => { const bk = G.smoothstep(6, -3, z); return (front + 0.012 * x * x) * (1 - bk) + (back + 0.02 * x * x) * bk; };
  const body = p => {
    const ax = Math.abs(p[0]), bk = G.smoothstep(6, -3, p[2]);
    // front: a V narrowing to the crotch; back: full coverage
    const leg = (crotch - vcut * ax) * (1 - bk) + (backLeg - 0.2 * ax) * bk;
    return Math.min(p[1] - top(p[0], p[2]), leg - p[1]);
  };
  return { top, body };
}

// Material fields that put a garment field (pelvis coords) on the pelvis, glutes and the tops of the thighs.
function pelvisGarment(ctx, field, mat, alt = 'fur') {
  const { body } = ctx;
  const out = [{ parts: ['torso.pelvis', 'torso.glute'], fn: p => { const d = field(p); return d > 0 ? { mat, alt, d } : null; } }];
  const inv = G.tinv(body.anchors.pelvisT);
  for (const s of ['L', 'R']) {
    const hip = body.anchors['hip' + s], knee = body.anchors['knee' + s];
    if (!hip || !knee) continue;
    const fr = Body.segFrame(hip, knee);
    out.push({ parts: ['leg' + s + '.thigh'], fn: p => { const d = field(G.tapply(inv, G.tapply(fr, p))); return d > 0 ? { mat, alt, d } : null; } });
  }
  return out;
}
// Same field mapped from a thigh part into pelvis space (for masking markings under the garment).
function thighToPelvis(ctx, side) {
  const { body } = ctx;
  const hip = body.anchors['hip' + side], knee = body.anchors['knee' + side];
  if (!hip || !knee) return null;
  const fr = Body.segFrame(hip, knee), inv = G.tinv(body.anchors.pelvisT);
  return p => G.tapply(inv, G.tapply(fr, p));
}

// Gold edge marking for any garment field.
const trim = (parts, field, color, width = 0.55, edgeWidth = 0.45) => ({ parts, color, edge: Cc.ramp(color).line, edgeWidth, fn: p => { const d = field(p); return Math.min(d, width - d); } });

// Navel + soft centre line of the belly.
const navel = (color = '#9a5a2a') => [
  { parts: ['torso.waist', 'torso.pelvis'], color, opacity: 0.75, fn: p => (p[2] < 3 ? -1 : 0.5 - Math.hypot(p[0] / 0.55, (p[1] + 12) / 0.9)) },
  { parts: ['torso.waist'], color, opacity: 0.25, fn: p => (p[2] < 3 ? -1 : Math.min(0.16 - Math.abs(p[0]), p[1] + 26, -12 - p[1])) },
];

// Thigh band around one leg at fraction t of the thigh.
// rr: outer radius; null = fit to the thigh profile at t
function thighBand(body, side, t = 0.45, rr = null, width = 1.5, opts = {}) {
  const hip = body.anchors['hip' + side], knee = body.anchors['knee' + side];
  if (!hip || !knee) return null;
  const fr = Body.segFrame(hip, knee);
  const lg = body.spec.leg;
  if (rr == null) rr = Body.profile(lg.thighR || [lg.r[0], lg.r[1], lg.r[2]])(t) + 0.9;
  return { name: 'jewel.thigh' + side, k: 0.3, parts: [C.limbBand(fr, G.len(G.sub(knee, hip)), t, rr, width, { th: 0.6, flare: 0, ...opts })] };
}

module.exports = { body, bikiniTop, bikiniBottom, pelvisGarment, thighToPelvis, trim, navel, thighBand };
