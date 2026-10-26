'use strict';
// Anthro body from simple volumes (ribcage, pelvis, limbs as muscle-profile sweeps) with a small
// pose system: pelvis/chest/head rotations for contrapposto and 2-bone IK for arms and legs.
// Model space: origin = pelvis centre in rest pose, x right (figure's left side on screen), y down, z forward.
const G = require('./geom');
const B = require('./build');

// ---------------- default proportions (an 8-head pin-up figure, headR = 10) ----------------
const DEFAULT = {
  headR: 11,
  neck: { len: 6.5, r: 4.9, rTop: 4.4 },
  torso: [ // y, half width, half depth, z shift
    [-49, 5.8, 4.8, -2.0], [-45, 10.6, 6.6, -1.4], [-40, 11.6, 8.2, -0.4], [-35, 11.6, 8.8, 0.2], [-30, 11.0, 8.6, 0.3],
    [-25, 9.8, 7.8, 0.0], [-19, 8.5, 7.0, -0.4], [-15, 8.4, 6.8, -0.3], [-10, 9.8, 7.3, 0.1], [-5, 13.0, 8.4, 0.0],
    [0, 15.8, 9.6, -0.6], [5, 15.2, 9.8, -1.2], [9, 12.0, 8.2, -1.0]],
  jugularY: -48, shoulder: { x: 12.6, y: -45, z: -1.5 },
  chest: { w: 12.4, h: 13, d: 9.4, y: -35 },
  bust: { r: [5.3, 5.0, 4.6], x: 5.9, y: -33.5, z: 5.4, splay: 0.25, droop: 0.05 },
  waist: { w: 9.0, d: 7.0, y: -17 },
  belly: { w: 9.8, d: 7.4, y: -8 },
  hips: { w: 15.8, d: 10.4, y: 0 },
  glutes: { r: [8.6, 9.6, 8.2], x: 7.0, y: 4, z: -4.6 },
  abs: 0, muscle: 0.2,
  arm: { upper: 23, fore: 20, r: [4.0, 3.4, 2.9, 3.1, 3.25, 2.3] },
  hand: { scale: 1, paw: true, claws: true, fingers: 4 },
  leg: { thigh: 40, shin: 30.5, meta: 15, toes: 7, digitigrade: true, hipX: 8.6, r: [9.4, 7.6, 5.0, 4.6, 5.2, 2.8, 2.3] },
  groundY: 79,
  tail: null,
};

// ---------------- small rigid-transform helpers ----------------
const rot = (yaw = 0, pitch = 0, roll = 0) => G.euler(yaw, pitch, roll);
const about = (pivot, R) => ({ R, t: G.sub(pivot, G.mvec(R, pivot)) }); // rotation around a pivot
const segFrame = (a, b, side = [1, 0, 0]) => {
  // canonical bone space: origin at a, +y toward b, x near `side`
  const y = G.norm(G.sub(b, a));
  let x = G.sub(side, G.mul(y, G.dot(side, y))); if (G.len(x) < 1e-6) x = [0, 0, 1]; x = G.norm(x);
  const z = G.cross(x, y);
  return { R: [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]], t: a.slice() };
};
// 2-bone IK: root a, target t, lengths l1 l2, pole hint -> middle joint
function ik(a, t, l1, l2, pole) {
  let d = G.sub(t, a), dl = G.len(d);
  const maxd = (l1 + l2) * 0.999, mind = Math.abs(l1 - l2) * 1.01 + 1e-3;
  if (dl > maxd) { d = G.mul(G.norm(d), maxd); dl = maxd; t = G.add(a, d); }
  if (dl < mind) { d = G.mul(G.norm(d), mind); dl = mind; t = G.add(a, d); }
  const dn = G.norm(d);
  const x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let pv = G.sub(pole, a); pv = G.sub(pv, G.mul(dn, G.dot(pv, dn))); pv = G.len(pv) < 1e-6 ? [0, 0, 1] : G.norm(pv);
  return { mid: G.add(a, G.add(G.mul(dn, x), G.mul(pv, h))), end: t };
}
// radius profile through control values, t in [0,1]
const profile = (vals) => t => {
  const n = vals.length - 1, x = Math.max(0, Math.min(n, t * n)), i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const u = f * f * (3 - 2 * f);
  return vals[i] + (vals[i + 1] - vals[i]) * u;
};

// ---------------- hand ----------------
// Hand-local space: origin wrist, +y toward the fingertips, +z out of the palm, +x toward the thumb.
const HAND_POSES = {
  relaxed: { curl: [0.25, 0.32, 0.38, 0.45], spread: 0.08, thumb: 0.3, thumbOut: 0.35 },
  open: { curl: [0.05, 0.05, 0.08, 0.1], spread: 0.22, thumb: 0.05, thumbOut: 0.7 },
  fist: { curl: [1.55, 1.6, 1.6, 1.55], spread: 0.0, thumb: 1.0, thumbOut: 0.1 },
  grip: { curl: [1.05, 1.15, 1.2, 1.2], spread: 0.0, thumb: 0.8, thumbOut: 0.35 },
  point: { curl: [0.05, 1.4, 1.45, 1.4], spread: 0.05, thumb: 0.8, thumbOut: 0.2 },
  elegant: { curl: [0.12, 0.3, 0.48, 0.62], spread: 0.12, thumb: 0.25, thumbOut: 0.45 },
  hip: { curl: [0.35, 0.45, 0.55, 0.62], spread: 0.06, thumb: 0.2, thumbOut: 0.6 },
  peace: { curl: [0.05, 0.08, 1.45, 1.4], spread: 0.3, thumb: 0.85, thumbOut: 0.2 },
  claw: { curl: [0.7, 0.75, 0.8, 0.85], spread: 0.25, thumb: 0.5, thumbOut: 0.6 },
  hold: { curl: [0.7, 0.85, 0.95, 1.0], spread: 0.04, thumb: 0.55, thumbOut: 0.45 },
};
function handPrims(spec, poseName, mirror) {
  const hp = typeof poseName === 'object' ? poseName : (HAND_POSES[poseName] || HAND_POSES.relaxed);
  const k = spec.scale || 1, paw = spec.paw;
  const sx = mirror ? -1 : 1;
  const E = (c, r, R) => B.ell(c.map(v => v * k), r.map(v => v * k), R);
  // palm block, knuckle ridge, thumb mound (thenar) and outer mound (hypothenar)
  const palm = [
    E([0, 4.3, 0], [3.35 * (paw ? 1.06 : 1), 4.3, 1.3 * (paw ? 1.12 : 1)]),
    E([0, 7.9, -0.15], [3.2, 1.25, 1.25]),
    E([sx * 2.25, 2.7, 0.55], [1.45, 2.3, 1.15], G.euler(0, 0, -sx * 0.35)),
    E([-sx * 2.35, 3.8, 0.3], [1.05, 2.6, 1.0]),
  ];
  const fingers = [];
  const xs = [2.1, 0.7, -0.7, -2.05], ys = [8.4, 8.75, 8.5, 8.0];
  const lens = [5.6, 6.1, 5.7, 4.6].map(v => v * (paw ? 0.86 : 1)), rad = paw ? 1.06 : 0.92;
  const bendTo = (dir, ang) => { const side = G.norm(G.cross(dir, [0, 0, 1])); return G.mvec(G.axisAngle(side, ang), dir); };
  const tipPads = [];
  for (let f = 0; f < 4; f++) {
    const base = [sx * xs[f] * k, ys[f] * k, 0.1 * k];
    let dir = G.norm([sx * ((f - 1.5) * hp.spread * 0.7 + xs[f] * 0.03), 1, 0]);
    const segs = [0.42, 0.32, 0.26].map(v => v * lens[f] * k);
    const pts = [base]; let p = base;
    for (let s = 0; s < 3; s++) {
      dir = bendTo(dir, hp.curl[f] * (s === 0 ? 0.75 : 1.05)); // curl toward the palm (+z)
      p = G.add(p, G.mul(dir, segs[s])); pts.push(p);
    }
    // knuckle bulges at the joints
    const r = t => rad * k * (1.0 - 0.22 * t + 0.07 * Math.exp(-(((t - 0.42) / 0.06) ** 2)) + 0.06 * Math.exp(-(((t - 0.74) / 0.05) ** 2)));
    const prims = B.sweep(G.catmull(pts, { seg: 5 }), r, { spacing: 0.2 });
    const tip = pts[3], tipDir = G.norm(G.sub(pts[3], pts[2]));
    // pad under the last phalanx (palm side)
    const padN = G.norm(G.sub([0, 0, 1], G.mul(tipDir, G.dot([0, 0, 1], tipDir))));
    tipPads.push({ c: G.add(G.lerp(pts[2], pts[3], 0.55), G.mul(padN, rad * k * 0.55)), r: rad * k * 0.62 });
    if (spec.claws) prims.push(B.ellBetween(G.sub(tip, G.mul(tipDir, 0.25 * k)), G.add(G.add(tip, G.mul(tipDir, 0.95 * k)), G.mul(padN, -0.25 * k)), 0.36 * k, 0.28 * k, [1, 0, 0]));
    fingers.push({ name: 'f' + f, prims, tip, pts, claw: spec.claws });
  }
  // thumb from the thenar mound, swinging across the palm with `thumb`
  const tb = [sx * 2.75 * k, 3.1 * k, 0.95 * k];
  let td = G.norm([sx * (0.4 + hp.thumbOut * 0.55), 0.78, 0.38]);
  td = G.mvec(G.axisAngle([0, 1, 0.2], sx * hp.thumb * 0.9), td); // opposition: swing toward the palm side
  const tpts = [tb]; let tp = tb;
  for (let s = 0; s < 2; s++) {
    td = bendTo(td, hp.thumb * 0.45);
    tp = G.add(tp, G.mul(td, (s ? 2.3 : 2.9) * k * (paw ? 0.92 : 1))); tpts.push(tp);
  }
  const thumb = B.sweep(G.catmull(tpts, { seg: 5 }), t => k * (paw ? 1.18 : 1.05) * (1 - 0.22 * t), { spacing: 0.2 });
  const tdn = G.norm(G.sub(tpts[2], tpts[1]));
  if (spec.claws) thumb.push(B.ellBetween(G.sub(tpts[2], G.mul(tdn, 0.25 * k)), G.add(tpts[2], G.mul(tdn, 0.95 * k)), 0.36 * k, 0.28 * k, [1, 0, 0]));
  tipPads.push({ c: G.add(G.lerp(tpts[1], tpts[2], 0.6), [0, 0, 0.6 * k]), r: 0.7 * k });
  return { palm: { name: 'palm', prims: palm }, thumb: { name: 'thumb', prims: thumb }, fingers, tipPads };
}

// ---------------- build ----------------
// spec: proportions (merged over DEFAULT); pose: see below. mats: { fur, claw, pad }
function build(specIn = {}, pose = {}, mats = {}) {
  const sp = deepMerge(DEFAULT, specIn);
  const m = { fur: 'fur', claw: 'claw', ...mats };
  const groups = [], anchors = {};
  // --- spine transforms (rest torso coords -> world)
  const pel = pose.pelvis || {};
  const pelR = rot(pel.yaw || 0, pel.pitch || 0, pel.roll || 0);
  const pelT = { R: pelR, t: pel.pos || [0, 0, 0] };
  const ch = pose.chest || {};
  const waistPivot = [0, sp.waist.y, 0];
  const chestRel = about(waistPivot, rot(ch.yaw || 0, ch.pitch || 0, ch.roll || 0));
  const chestT = G.tcompose(pelT, chestRel);
  // waist sits between: half the chest rotation
  const waistT = G.tcompose(pelT, about(waistPivot, rot((ch.yaw || 0) / 2, (ch.pitch || 0) / 2, (ch.roll || 0) / 2)));
  const at = (T, prim) => B.xform(prim, T);
  const P = (T, p) => G.tapply(T, p);
  anchors.pelvisT = pelT; anchors.chestT = chestT; anchors.waistT = waistT;

  // --- torso volumes: elliptic sections along the spine (rest coords), bound to chest/waist/pelvis
  const torso = [];
  const add = (name, T, prims, extra = {}) => torso.push({ name, mat: m.fur, frame: T, prims: prims.map(p => at(T, p)), ...extra });
  const prof = sp.torso; // rows [y, halfWidth, halfDepth, zShift]
  const lerpRow = y => {
    let i = 1; while (i < prof.length - 1 && prof[i][0] < y) i++;
    const a = prof[i - 1], c2 = prof[i], f = Math.max(0, Math.min(1, (y - a[0]) / (c2[0] - a[0]))), u = f * f * (3 - 2 * f);
    return a.map((v, k) => v + (c2[k] - v) * u);
  };
  const slices = { chest: [], waist: [], pelvis: [] };
  for (let y = prof[0][0] + 3; y <= prof[prof.length - 1][0] - 3 + 1e-6; y += 1.8) {
    const [, hw, hd, zs] = lerpRow(y);
    const e = B.ell([0, y, zs], [hw, 6.0, hd]);
    (y < -24 ? slices.chest : y < -9 ? slices.waist : slices.pelvis).push(e);
  }
  add('torso.chest', chestT, slices.chest, { k: 1.2 });
  add('torso.waist', waistT, slices.waist, { k: 1.2 });
  add('torso.pelvis', pelT, slices.pelvis, { k: 1.2 });
  // clavicle bar: shoulder width line, sloping into the neck
  add('torso.clav', chestT, [B.ell([0, sp.shoulder.y + 0.5, sp.shoulder.z - 0.5], [sp.shoulder.x + 0.5, 3.6, 5.2]),
    ...[-1, 1].map(s => B.ellBetween([s * 3, sp.jugularY - 2.2, -2.4], [s * (sp.shoulder.x - 2), sp.shoulder.y, -1.6], 3.0, 3.6))]);
  add('torso.glute', pelT, [-1, 1].map(s => B.ell([s * sp.glutes.x, sp.glutes.y, sp.glutes.z], sp.glutes.r, rot(0, -0.2, 0))));
  if (sp.bust && sp.bust.r[0] > 0 && !sp.bust.separate) {
    const bs = sp.bust;
    add('torso.bust', chestT, [-1, 1].map(s => B.ell([s * bs.x, bs.y, bs.z], bs.r, rot(s * bs.splay, -0.3 + bs.droop, 0))));
  }
  if (sp.abs > 0) add('torso.abs', waistT, [-1, 1].flatMap(s => [-1, 0, 1].map(k => B.ell([s * 2.5, sp.waist.y + k * 4.4 - 1, lerpRow(sp.waist.y + k * 4.4 - 1)[2] + lerpRow(sp.waist.y)[3] - 0.9], [2.1, 1.9, 1.3 * sp.abs]))), { noLine: true });
  // neck: from the chest (jugular) to the head base; head pose decides its top
  const hd = pose.head || {};
  const neckBase = P(chestT, [0, sp.jugularY, -1.8]);
  const neckLean = rot(hd.yaw ? hd.yaw * 0.25 : 0, (hd.pitch || 0) * 0.35 + (hd.neckPitch || 0), (hd.roll || 0) * 0.4);
  const neckDir = G.mvec(chestT.R, G.mvec(neckLean, G.norm([0, -1, 0.12])));
  const neckTop = G.add(neckBase, G.mul(neckDir, sp.neck.len));
  const neckSeg = segFrame(neckBase, neckTop);
  torso.push({ name: 'neck', k: 0.8, mat: m.fur, frame: neckSeg, prims: B.sweep([neckBase, G.lerp(neckBase, neckTop, 0.5), neckTop], profile([sp.neck.r * 1.12, sp.neck.r, sp.neck.rTop]), { spacing: 0.22 }) });
  groups.push({ name: 'torso', k: 2.4, parts: torso });
  // head frame: cranium centre above the neck top, rotated by the head pose
  const headR = rot(hd.yaw || 0, hd.pitch || 0, hd.roll || 0);
  const headRW = G.mmul(chestT.R, G.mmul(neckLean, headR));
  const headCenter = G.add(neckTop, G.mvec(headRW, [0, -sp.headR * 0.62, -sp.headR * 0.18]));
  anchors.headT = { R: headRW, t: headCenter };
  anchors.neckTop = neckTop; anchors.neckBase = neckBase;

  // --- bust (own group: contour under it and its cast shadow on the belly)
  if (sp.bust && sp.bust.r[0] > 0 && sp.bust.separate) {
    const b = sp.bust;
    groups.push({ name: 'bust', k: 1.6, parts: [-1, 1].map(s => ({ name: 'bust' + (s < 0 ? 'L' : 'R'), mat: m.fur, frame: chestT,
      prims: [at(chestT, B.ell([s * b.x, b.y, b.z], b.r, rot(s * b.splay, -0.25 + b.droop, 0)))] })) });
    anchors.bustL = P(chestT, [-b.x, b.y, b.z + b.r[2]]); anchors.bustR = P(chestT, [b.x, b.y, b.z + b.r[2]]);
  }

  // --- arms
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const ap = (pose['arm' + side]) || {};
    const sh = P(chestT, [s * sp.shoulder.x, sp.shoulder.y, sp.shoulder.z]);
    const a = sp.arm;
    const handTarget = ap.hand ? (ap.space === 'world' ? ap.hand : P(chestT, ap.hand)) : P(chestT, [s * (sp.shoulder.x + 6), sp.shoulder.y + a.upper + a.fore * 0.92, 2]);
    const pole = ap.pole ? (ap.space === 'world' ? ap.pole : P(chestT, ap.pole)) : P(chestT, [s * (sp.shoulder.x + 14), sp.shoulder.y + 18, -20]);
    const { mid: elbow, end: wrist } = ik(sh, handTarget, a.upper, a.fore, pole);
    const upF = segFrame(sh, elbow, G.mvec(chestT.R, [s, 0, 0])), foF = segFrame(elbow, wrist, G.mvec(chestT.R, [s, 0, 0]));
    const up = B.sweep(G.catmull([sh, G.lerp(sh, elbow, 0.5), elbow], { seg: 3 }), profile([a.r[0], a.r[1], a.r[2]]), { spacing: 0.22 });
    const fo = B.sweep([elbow, G.lerp(elbow, wrist, 0.25), wrist], profile([a.r[3], a.r[4], (a.r[4] + a.r[5]) / 2, a.r[5]]), { spacing: 0.22 });
    const delt = [B.ellBetween(G.add(sh, G.mvec(chestT.R, [s * -1.5, -1.2, 0])), G.lerp(sh, elbow, 0.38), a.r[0] * 1.06, a.r[0] * 0.98, G.mvec(chestT.R, [s, 0, 0]))];
    groups.push({ name: 'arm' + side, k: 1.5, parts: [
      { name: 'arm' + side + '.delt', mat: m.fur, frame: upF, prims: delt },
      { name: 'arm' + side + '.upper', mat: m.fur, frame: upF, prims: up, k: 0.8 },
      { name: 'arm' + side + '.fore', mat: m.fur, frame: foF, prims: fo, k: 0.8 },
    ] });
    anchors['shoulder' + side] = sh; anchors['elbow' + side] = elbow; anchors['wrist' + side] = wrist;
    anchors['upper' + side] = upF; anchors['fore' + side] = foF;
    // hand frame
    const fdir = ap.finger ? G.norm(ap.space === 'world' ? ap.finger : G.mvec(chestT.R, ap.finger)) : G.norm(G.sub(wrist, elbow));
    let pn = ap.palm ? G.norm(ap.space === 'world' ? ap.palm : G.mvec(chestT.R, ap.palm)) : G.mvec(chestT.R, [-s, 0, 0.15]);
    pn = G.norm(G.sub(pn, G.mul(fdir, G.dot(pn, fdir))));
    // thumb side: for the right hand (+x side of the body) thumb points forward when palm faces in
    const xh = G.norm(G.cross(fdir, pn)).map(v => v * (s > 0 ? -1 : 1));
    const handR = [[xh[0], fdir[0], pn[0]], [xh[1], fdir[1], pn[1]], [xh[2], fdir[2], pn[2]]];
    const handT = { R: handR, t: wrist };
    const hpr = handPrims(sp.hand, ap.pose || 'relaxed', false);
    const hparts = [];
    hparts.push({ name: 'hand' + side + '.palm', mat: m.fur, frame: handT, prims: hpr.palm.prims.map(pr => at(handT, pr)), k: 0.5 });
    const hg = { name: 'hand' + side, k: 0.5, parts: hparts };
    groups.push(hg);
    // fingers and thumb as their own groups so a line always separates them
    hpr.fingers.forEach((f, i) => {
      const prims = f.prims.map(pr => at(handT, pr));
      const clawN = f.claw ? 1 : 0;
      const fp = [{ name: 'hand' + side + '.f' + i, mat: m.fur, frame: handT, prims: prims.slice(0, prims.length - clawN) }];
      if (clawN) fp.push({ name: 'hand' + side + '.c' + i, mat: m.claw, frame: handT, prims: prims.slice(-1), noLine: true });
      groups.push({ name: 'hand' + side + '.f' + i, k: 0.3, line: 'always', parts: fp });
    });
    {
      const prims = hpr.thumb.prims.map(pr => at(handT, pr));
      const clawN = sp.hand.claws ? 1 : 0;
      const tp = [{ name: 'hand' + side + '.thumb', mat: m.fur, frame: handT, prims: prims.slice(0, prims.length - clawN) }];
      if (clawN) tp.push({ name: 'hand' + side + '.ct', mat: m.claw, frame: handT, prims: prims.slice(-1), noLine: true });
      groups.push({ name: 'hand' + side + '.thumb', k: 0.3, line: 'always', parts: tp });
    }
    anchors['hand' + side] = handT;
    anchors['fingertips' + side] = hpr.fingers.map(f => G.tapply(handT, f.tip));
    anchors['tipPads' + side] = hpr.tipPads;
  }

  // --- legs
  if (pose.legs !== false) for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const lp = pose['leg' + side] || {};
    const lg = sp.leg;
    const hip = P(pelT, [s * lg.hipX, 3, 0]);
    const groundY = sp.groundY;
    const foot = lp.foot || [s * (lg.hipX + 1), groundY, lg.digitigrade ? 3 : 0];
    let parts;
    if (lg.digitigrade) {
      // hock (heel) raised: solve thigh+shin to the hock, then metatarsus to the toes
      const toe = foot;
      const hock = lp.hock || G.add(toe, [s * 0.4, -lg.meta * 0.93, -lg.meta * 0.36]);
      const pole = lp.pole || G.add(hip, [s * 4, 20, 40]);
      const { mid: knee, end: hk } = ik(hip, hock, lg.thigh, lg.shin, pole);
      const r = lg.r;
      parts = [
        { name: 'leg' + side + '.thigh', frame: segFrame(hip, knee), prims: B.sweep(G.catmull([hip, G.lerp(hip, knee, 0.5), knee], { seg: 3 }), profile([r[0], r[1], r[2]]), { spacing: 0.22 }) },
        { name: 'leg' + side + '.shin', frame: segFrame(knee, hk), prims: B.sweep([knee, G.lerp(knee, hk, 0.3), hk], profile([r[3], r[4], (r[4] + r[5]) / 2, r[5]]), { spacing: 0.22 }) },
        { name: 'leg' + side + '.meta', frame: segFrame(hk, toe), prims: B.sweep([hk, toe], profile([r[5] * 0.95, r[6]]), { spacing: 0.22 }) },
        { name: 'leg' + side + '.paw', frame: segFrame(hk, toe), prims: [B.ell(G.add(toe, [0, -1.6, 2.2]), [3.2, 2.0, 4.0]), ...[-1, 0, 1].map(k2 => B.ell(G.add(toe, [k2 * 1.9, -0.6, 5.2 - Math.abs(k2) * 0.7]), [1.25, 1.2, 1.6]))] },
      ];
      anchors['knee' + side] = knee; anchors['hock' + side] = hk; anchors['toe' + side] = toe;
    } else {
      const ankle = G.add(foot, [0, -4.5, -1]);
      const pole = lp.pole || G.add(hip, [s * 3, 20, 40]);
      const { mid: knee, end: an } = ik(hip, ankle, lg.thigh, lg.shin + lg.meta * 0.4, pole);
      const r = lg.r;
      parts = [
        { name: 'leg' + side + '.thigh', frame: segFrame(hip, knee), prims: B.sweep(G.catmull([hip, G.lerp(hip, knee, 0.5), knee], { seg: 3 }), profile([r[0], r[1], r[2]]), { spacing: 0.22 }) },
        { name: 'leg' + side + '.shin', frame: segFrame(knee, an), prims: B.sweep([knee, G.lerp(knee, an, 0.3), an], profile([r[3], r[4], (r[4] + r[5]) / 2, r[5]]), { spacing: 0.22 }) },
        { name: 'leg' + side + '.foot', frame: segFrame(an, foot), prims: [B.ellBetween(G.add(an, [0, 1, -1.5]), G.add(foot, [0, -1.2, 10]), 3.4, 2.4, [1, 0, 0])] },
      ];
      anchors['knee' + side] = knee; anchors['ankle' + side] = an; anchors['toe' + side] = G.add(foot, [0, 0, 10]);
    }
    groups.push({ name: 'leg' + side, k: 1.8, parts: parts.map(p => ({ k: 0.9, ...p, mat: m.fur })) });
    anchors['hip' + side] = hip;
  }

  // --- tail: control points in pelvis space
  if (sp.tail && pose.tail !== false) {
    const tl = sp.tail;
    const ctrl = (pose.tailCtrl || tl.ctrl).map(p => P(pelT, p));
    const pts = G.catmull(ctrl, { seg: 8 }).map(q => [q[0], q[1], q[2]]);
    const prims = B.sweep(pts, profile(tl.r), { spacing: 0.25 });
    groups.push({ name: 'tail', k: 1.5, parts: [{ name: 'tail', mat: tl.mat || m.fur, frame: pelT, prims, k: 0.6 }] });
    anchors.tail = pts;
  }
  return { spec: sp, groups, anchors };
}

function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b === undefined ? a : b;
  const o = { ...a };
  for (const k of Object.keys(b)) o[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k]) && a[k] !== null) ? deepMerge(a[k], b[k]) : b[k];
  return o;
}

module.exports = { build, DEFAULT, HAND_POSES, handPrims, ik, segFrame, profile, rot, about, deepMerge };
