'use strict';
// Hairstyles as 3D volumes around a built head: shells with a face window and cut planes,
// sweeps for tails and locks, plus strand lines and an "angel ring" highlight.
// Head-local unit space (R = 1): x right, y down, z = face forward.
const G = require('./geom');
const B = require('./build');
const Ln = require('./line');
const Cc = require('./color');
const { path, g } = require('./svg');

// signed "inside the face window" field: positive where the face shows through
const windowField = (u, w) => Math.min(u[1] - w.bang, w.x - Math.abs(u[0]) * (1 + Math.max(0, u[1] - w.bang) * (w.taper || 0)), u[2] - w.z);

function makeX(head) {
  const R = head.R, S = head.frame;
  const scale = [[R, 0, 0], [0, R, 0], [0, 0, R]];
  return pr => pr.type === 'ell' ? { ...pr, c: head.toWorld(pr.c), A: G.mmul(G.mmul(S.R, scale), pr.A) } : pr;
}

// A clump of hair: flattened sweep that follows an ellipsoidal surface (c, r) from (lat0, lon0) to (lat1, lon1),
// width w (along the surface, sideways) and thickness t (along the normal), lifted `lift` off the surface.
function clump(c, r, { lat0, lon0, lat1, lon1, w, t = 0.09, lift = 0.02, tip = 0.55, curl = 0, bulge = 0.04, n = 22 }) {
  const P = (la, lo, off) => {
    const nrm = G.norm([Math.cos(la) * Math.sin(lo) / r[0], Math.sin(la) / r[1], Math.cos(la) * Math.cos(lo) / r[2]]);
    const s = [c[0] + r[0] * Math.cos(la) * Math.sin(lo), c[1] + r[1] * Math.sin(la), c[2] + r[2] * Math.cos(la) * Math.cos(lo)];
    return { p: G.add(s, G.mul(nrm, off)), n: nrm };
  };
  const pts = [], nrms = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, la = lat0 + (lat1 - lat0) * f, lo = lon0 + (lon1 - lon0) * f;
    const off = lift + t + bulge * Math.sin(Math.PI * f) + curl * f * f;
    const q = P(la, lo, off); pts.push(q.p); nrms.push(q.n);
  }
  const prims = [];
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n, a = pts[i], b = pts[i + 1];
    const width = w * (f < 0.15 ? 0.75 + f * 1.6 : 1 - (1 - tip) * G.smoothstep(0.55, 1, f));
    const dir = G.norm(G.sub(b, a)), nm = nrms[i];
    const side = G.norm(G.cross(dir, nm));
    prims.push(B.ellBetween(G.lerp(a, b, -1.1), G.lerp(a, b, 2.1), width / 2, t, side));
  }
  return { prims, pts };
}

// Path helper for locks: catmull through control points (unit space)
const lockPath = (ctrl, seg = 8) => G.catmull(ctrl, { seg });

function build(style, head, opt = {}) {
  const R = head.R, X = makeX(head);
  const frame = { R: head.frame.R, t: head.frame.t };
  const mat = opt.mat || 'hair';
  const groups = [], markings = [], strands = [], extras = [];
  const parts = [];
  const u = p => [p[0] / R, p[1] / R, p[2] / R];
  const addShell = (name, prims, keepU, extra = {}) => parts.push({ name, mat, frame, prims: prims.map(X), keep: keepU ? (p => keepU(u(p))) : null, inner: true, k: 0.08 * R, ...extra });
  const addLock = (name, ctrl, rprof, extra = {}) => {
    const pts = lockPath(ctrl);
    parts.push({ name, mat, frame, prims: B.sweep(pts, rprof, { spacing: 0.25 }).map(X), k: 0.05 * R, ...extra });
    strands.push({ kind: 'lock', pts, r: rprof, n: extra.strands || 3 });
    return pts;
  };
  const o = opt;
  if (style === 'bob') {
    const w = { bang: o.bang ?? -0.3, x: o.winX ?? 0.74, z: o.winZ ?? 0.0, taper: 0.05 };
    const cut = o.cut ?? 0.66;
    const cc = [0, -0.08, -0.05], rr = [1.1, 1.06, 1.1];
    addShell('hair.cap', [B.ell(cc, [1.1, 1.06, 1.1]), B.ell([0, 0.4, -0.14], [1.03, 0.62, 0.98])],
      p => Math.min(cut + 0.06 * p[2] - p[1], -windowField(p, w)));
    // bangs: a row of blunt clumps from the crown to the brow line
    const latOf = y => Math.asin(Math.max(-1, Math.min(1, (y - cc[1]) / rr[1])));
    const nb = o.bangClumps || 9;
    for (let i = 0; i < nb; i++) {
      const f = i / (nb - 1) * 2 - 1, lon1 = f * (o.bangSpread ?? 0.78);
      const cl = clump(cc, rr, { lat0: -1.25, lon0: lon1 * 0.35, lat1: latOf(w.bang) + 0.02 * Math.cos(i * 2.1), lon1, w: 0.36, t: 0.07, lift: 0.0, tip: 0.85, bulge: 0.05 });
      parts.push({ name: 'hair.bang' + i, mat, frame, prims: cl.prims.map(X), k: 0.04 * R });
    }
    // side curtains: vertical clumps falling to the cut line
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const lon = s * (1.0 + i * 0.32);
      const cl = clump(cc, [1.1, 1.06, 1.06], { lat0: -1.0, lon0: lon * 0.85, lat1: latOf(cut) + 0.06, lon1: lon + s * 0.04, w: 0.4, t: 0.075, lift: 0.0, tip: 0.85, bulge: 0.05, curl: -0.1, n: 18 });
      parts.push({ name: 'hair.side' + (s < 0 ? 'L' : 'R') + i, mat, frame, prims: cl.prims.map(X), k: 0.04 * R });
    }
    markings.push(ring({ c: cc, lat: -0.62, width: 0.04, jag: 0.05, n: 30 }));
  } else if (style === 'ponytail') {
    const w = { bang: -0.62, x: 0.82, z: 0.32, taper: 0.4 };
    addShell('hair.cap', [B.ell([0, -0.1, -0.04], [1.08, 1.05, 1.08])], p => Math.min(0.2 - p[1] + p[2] * 0.4, -windowField(p, w)));
    strands.push({ kind: 'shell', c: [0, -0.1, -0.04], r: [1.1, 1.07, 1.1], cut: p => 0.2 - p[1] + p[2] * 0.4, win: p => -windowField(p, w), count: 26, from: -1.35 });
    const tail = addLock('hair.tail', [[0, -0.92, -0.55], [0, -1.35, -1.0], [0, -1.15, -1.55], [0, -0.2, -1.85], [0.1, 0.9, -1.75], [0.25, 1.85, -1.45]],
      t => 0.24 + 0.36 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.85) * (1 - t * 0.55) - 0.08 * t, { strands: 4 });
    extras.push({ kind: 'tie', at: tail[3], dir: G.norm(G.sub(tail[4], tail[2])), r: 0.3 });
    // side-swept bangs
    addLock('hair.bangL', [[-0.1, -1.0, 0.75], [-0.45, -0.72, 0.95], [-0.72, -0.35, 0.88], [-0.82, 0.05, 0.62]], t => 0.2 - 0.15 * t, { strands: 2 });
    addLock('hair.bangR', [[0.15, -1.02, 0.7], [0.5, -0.8, 0.9], [0.82, -0.42, 0.75], [0.95, 0.1, 0.42]], t => 0.17 - 0.13 * t, { strands: 2 });
    markings.push(ring({ c: [0, -0.1, -0.04], lat: -0.7, width: 0.06, jag: 0.05, n: 22 }));
  } else if (style === 'mane') {
    const w = { bang: -0.42, x: 0.86, z: 0.15, taper: 0.1 };
    addShell('hair.mane', [B.ell([0, 0.05, -0.28], [1.55, 1.5, 1.42]), B.ell([0, 0.9, -0.5], [1.5, 1.0, 1.1])], p => Math.min(1.85 - p[1], -windowField(p, w)));
    for (const s of [-1, 1]) addLock('hair.tress' + (s < 0 ? 'L' : 'R'), [[s * 0.92, -0.2, 0.25], [s * 1.0, 0.6, 0.35], [s * 0.95, 1.4, 0.45], [s * 0.85, 2.25, 0.55]], t => 0.34 - 0.08 * t, { strands: 3 });
    strands.push({ kind: 'shell', c: [0, 0.05, -0.28], r: [1.57, 1.52, 1.44], cut: p => 1.85 - p[1], win: p => -windowField(p, w), count: 40 });
  } else if (style === 'straight') {
    const w = { bang: o.bang ?? -0.62, x: 0.76, z: 0.05, taper: 0.06 };
    addShell('hair.cap', [B.ell([0, -0.08, -0.05], [1.12, 1.08, 1.12])], p => Math.min(0.75 - p[1], -windowField(p, w)));
    addShell('hair.back', [B.ellBetween([0, -0.2, -0.75], [0, 4.6, -1.15], 1.1, 0.42, [1, 0, 0])], null, { inner: false, k: 0.1 * R });
    for (const s of [-1, 1]) {
      const pts = addLock('hair.front' + (s < 0 ? 'L' : 'R'), [[s * 0.85, -0.3, 0.2], [s * 0.98, 0.6, 0.25], [s * 1.02, 1.6, 0.42], [s * 0.95, 2.9, 0.55]], t => 0.24 - 0.04 * t, { strands: 3 });
      if (o.rings) for (const t of [0.42, 0.62, 0.82]) { const i = Math.round(t * (pts.length - 1)); extras.push({ kind: 'tie', at: pts[i], dir: G.norm(G.sub(pts[Math.min(pts.length - 1, i + 1)], pts[i - 1])), r: 0.24 }); }
    }
    strands.push({ kind: 'shell', c: [0, -0.08, -0.05], r: [1.14, 1.1, 1.14], cut: p => 0.75 - p[1], win: p => -windowField(p, w), count: 30 });
    strands.push({ kind: 'sheet', a: [0, -0.2, -0.75], b: [0, 4.6, -1.15], w: 1.1, d: 0.42, count: 12 });
    markings.push(ring({ c: [0, -0.08, -0.05], lat: -0.66, width: 0.06, jag: 0.06, n: 24 }));
  } else if (style === 'wavy') {
    const long = o.long ?? 1;
    const w = { bang: o.bang ?? -0.55, x: 0.8, z: 0.1, taper: 0.1 };
    addShell('hair.cap', [B.ell([0, -0.1, -0.06], [1.13, 1.08, 1.13])], p => Math.min(0.5 - p[1], -windowField(p, w)));
    strands.push({ kind: 'shell', c: [0, -0.1, -0.06], r: [1.15, 1.1, 1.15], cut: p => 0.5 - p[1], win: p => -windowField(p, w), count: 28 });
    const locks = o.locks || 9;
    for (let i = 0; i < locks; i++) {
      const a = -1.15 + 2.3 * i / (locks - 1); // angle around the back of the head
      const side = Math.sin(a), back = -Math.cos(a);
      const r0 = 1.05, len = (2.2 + 0.6 * Math.cos(a * 2)) * long;
      const base = [side * r0, 0.15, back * r0 * 0.95];
      const out = [side * 1.25, 0, back * 0.6 - (Math.abs(side) > 0.7 ? -0.25 : 0)];
      const ctrl = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5, wave = Math.sin(t * Math.PI * 2.2 + i) * 0.22 * t;
        ctrl.push([base[0] + out[0] * 0.35 * t + wave * Math.cos(a), base[1] + len * t, base[2] + out[2] * 0.3 * t + wave * Math.sin(a) * 0.4 + (Math.abs(side) > 0.8 ? 0.35 * t : 0)]);
      }
      addLock('hair.lock' + i, ctrl, t => (0.36 - 0.22 * t) * (o.volume || 1), { strands: 2 });
    }
    if (o.front) for (const s of [-1, 1]) addLock('hair.front' + (s < 0 ? 'L' : 'R'), [[s * 0.8, -0.35, 0.45], [s * 1.02, 0.4, 0.4], [s * 0.95, 1.2, 0.55], [s * 1.08, 2.0 * long, 0.62]], t => 0.26 - 0.12 * t, { strands: 2 });
    markings.push(ring({ c: [0, -0.1, -0.06], lat: -0.68, width: 0.06, jag: 0.05, n: 20 }));
  } else if (style === 'hime') {
    const w = { bang: o.bang ?? -0.36, x: 0.72, z: 0.0, taper: 0.0 };
    // side locks cut level at the jaw in front, back hair continues long
    addShell('hair.cap', [B.ell([0, -0.08, -0.05], [1.13, 1.09, 1.13]), B.ell([0, 0.3, -0.05], [1.17, 0.72, 1.08])],
      p => Math.min((p[2] > -0.15 ? 0.62 : 1.0) - p[1], -windowField(p, w)));
    addShell('hair.back', [B.ellBetween([0, -0.1, -0.78], [0, 4.4, -1.2], 1.12, 0.4, [1, 0, 0])], null, { inner: false, k: 0.1 * R });
    strands.push({ kind: 'shell', c: [0, -0.08, -0.05], r: [1.15, 1.11, 1.15], cut: p => (p[2] > -0.15 ? 0.62 : 1.0) - p[1], win: p => -windowField(p, w), count: 36 });
    strands.push({ kind: 'sheet', a: [0, -0.1, -0.78], b: [0, 4.4, -1.2], w: 1.12, d: 0.4, count: 12 });
    markings.push(ring({ c: [0, -0.08, -0.05], lat: -0.62, width: 0.07, jag: 0.06, n: 28 }));
  }
  const main = parts.filter(p => !/\.(bang|side)\d|\.(bang|side)[LR]\d/.test(p.name));
  groups.push({ name: opt.group || 'hair', k: 0.06 * R, parts: main });
  parts.filter(p => !main.includes(p)).forEach(p => groups.push({ name: (opt.group || 'hair') + '.' + p.name, k: 0.02 * R, line: 'always', lineK: 0.6, parts: [p] }));

  // angel-ring highlight fields (evaluated on the visible hair surface, drawn after shading)
  function ring({ c, lat, width, jag, n }) {
    return {
      parts: parts.map(p => p.name), stage: 'post', color: opt.sheen || '#9fb6ff', opacity: 0.55, blend: 'screen', smooth: 1,
      fn: (p, id, Rs) => {
        const q = G.norm(G.sub(u(p), c)); const la = Math.asin(Math.max(-1, Math.min(1, q[1]))), lo = Math.atan2(q[0], q[2]);
        const spike = Math.pow(Math.abs(Math.sin(lo * n * 0.5)), 0.6) * jag;
        const lit = Rs ? Math.max(0, Rs.nx[id] * -0.62 + Rs.ny[id] * -0.58 + Rs.nz[id] * 0.52) : 1;
        return Math.min(width - Math.abs(la - lat) + spike * (la > lat ? 1 : 0.3), (lit - 0.15) * 0.4) * R;
      },
    };
  }
  return { groups, markings, strands, extras, mat };
}

// Strand lines and hair ties, drawn after the figure (uses the depth buffer for visibility).
function overlay(doc, Rs, head, hair, { lineColor = '#0d0f1e', hiColor = '#5f7fc8', width = 0.9, gold = '#d8a640' } = {}) {
  const R = head.R, out = [];
  const W = p => head.toWorld(p);
  const visRuns = (pts3) => {
    const pr = pts3.map(p => Rs.project(W(p)));
    const vis = pr.map(p => Rs.visible(p[0], p[1], p[2], 0.06 * R));
    const runs = []; let cur = [];
    pr.forEach((p, i) => { if (vis[i]) cur.push([p[0], p[1]]); else { if (cur.length > 3) runs.push(cur); cur = []; } });
    if (cur.length > 3) runs.push(cur);
    return runs;
  };
  const sc = Rs.view.s;
  for (const st of hair.strands) {
    if (st.kind === 'shell') {
      for (let k = 0; k < st.count; k++) {
        const lon = -Math.PI + (k + 0.5) / st.count * 2 * Math.PI + 0.07 * Math.sin(k * 3.1);
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const th = (st.from ?? 0.15) + i / 40 * 2.6; // polar angle from the crown
          const p = [st.c[0] + st.r[0] * Math.sin(th) * Math.sin(lon), st.c[1] - st.r[1] * Math.cos(th), st.c[2] + st.r[2] * Math.sin(th) * Math.cos(lon)];
          if (st.cut(p) < 0.03 || st.win(p) < 0.03) { if (pts.length) break; else continue; }
          pts.push(p);
        }
        if (pts.length < 4) continue;
        const keepFrom = Math.floor(pts.length * (0.15 + 0.35 * G.hash1(k * 1.7)));
        for (const run of visRuns(pts.slice(keepFrom))) out.push(path(G.polyD(Ln.taper(run, width * sc * (0.5 + 0.5 * G.hash1(k)), { profile: Ln.taperProfile({ start: 0.5, end: 0.12 }) })), { fill: k % 3 ? lineColor : hiColor, opacity: k % 3 ? 0.55 : 0.4 }));
      }
    } else if (st.kind === 'lock') {
      const pts = st.pts;
      for (let k = 0; k < st.n; k++) {
        const ang = (k + 0.5) / st.n * Math.PI - Math.PI / 2;
        const line = pts.map((p, i) => {
          const t = i / (pts.length - 1), a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          const d = G.norm(G.sub(b, a)); let side = G.norm(G.cross(d, [0, 0, 1])); if (G.len(side) < 0.1) side = [1, 0, 0];
          const up = G.norm(G.cross(side, d));
          const r = st.r(t) * 0.85;
          return G.add(p, G.add(G.mul(side, Math.sin(ang) * r), G.mul(up, -Math.cos(ang) * r * 0.2 + r * 0.75)));
        });
        for (const run of visRuns(line.slice(1))) out.push(path(G.polyD(Ln.taper(run, width * sc * 0.8, { profile: Ln.taperProfile({ start: 0.3, end: 0.2 }) })), { fill: lineColor, opacity: 0.5 }));
      }
    } else if (st.kind === 'sheet') {
      for (let k = 0; k < st.count; k++) {
        const x = -st.w * 0.9 + (k + 0.5) / st.count * st.w * 1.8;
        const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; const c = G.lerp(st.a, st.b, t); pts.push([c[0] + x, c[1], c[2] + st.d * 0.98 * Math.sqrt(Math.max(0, 1 - (x / st.w) ** 2))]); }
        for (const run of visRuns(pts.slice(3))) out.push(path(G.polyD(Ln.taper(run, width * sc * 0.8, { profile: Ln.taperProfile({ start: 0.4, end: 0.3 }) })), { fill: lineColor, opacity: 0.45 }));
      }
    }
  }
  // ties and rings: small gold bands around a lock
  for (const ex of hair.extras) {
    if (ex.kind !== 'tie') continue;
    const c = Rs.project(W(ex.at));
    if (!Rs.visible(c[0], c[1], c[2] + ex.r * R * sc, 0.3 * R)) continue;
    const d = G.mvec(Rs.view.R, head.dirWorld(ex.dir));
    const rr = ex.r * R * sc * 1.05, wdt = ex.r * R * sc * 0.9;
    const ang = Math.atan2(d[1], d[0]) * 180 / Math.PI;
    const tilt = Math.abs(d[2]) * 0.9 + 0.12;
    const gr = Cc.ramp(gold);
    const grad = doc.linear([[0, gr.deep], [0.3, gold], [0.48, gr.hi], [0.55, '#fff6d0'], [0.7, gold], [1, gr.shadow]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    out.push(`<g transform="translate(${G.fmt(c[0])} ${G.fmt(c[1])}) rotate(${G.fmt(ang + 90)})">` +
      path(`M${-rr} ${-wdt / 2}L${rr} ${-wdt / 2}A${rr} ${rr * tilt} 0 0 1 ${rr} ${wdt / 2}L${-rr} ${wdt / 2}A${rr} ${rr * tilt} 0 0 1 ${-rr} ${-wdt / 2}Z`, { fill: grad, stroke: gr.line, 'stroke-width': 0.08 * R * sc }) + '</g>');
  }
  return g({ class: 'hair-strands' }, out);
}

module.exports = { build, overlay, windowField };
