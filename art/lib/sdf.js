'use strict';
// Signed distance fields from the figure model (ellipsoids + thin planar shells) with true smooth unions,
// polygonised by surface nets into triangle meshes. This replaces the depth-only blending of the raster
// (which kept bead-like silhouettes) with sculpt-like continuous surfaces.
const G = require('./geom');
const { polySD } = require('./raster');

// quadratic smooth minimum (iq): blends within k, never inflates by more than k/4
function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function prepPrim(pr) {
  if (pr.type === 'ell') {
    const A = pr.A, r = [0, 1, 2].map(j => Math.hypot(A[0][j], A[1][j], A[2][j]));
    const Rt = [0, 1, 2].map(j => [A[0][j] / r[j], A[1][j] / r[j], A[2][j] / r[j]]); // rows = axes
    const ext = [0, 1, 2].map(i => Math.hypot(A[i][0], A[i][1], A[i][2]));
    return { type: 'ell', c: pr.c, Rt, r, bb: [pr.c[0] - ext[0], pr.c[1] - ext[1], pr.c[2] - ext[2], pr.c[0] + ext[0], pr.c[1] + ext[1], pr.c[2] + ext[2]] };
  }
  if (pr.type === 'plane') {
    const su = G.len(pr.u), sv = G.len(pr.v), uh = G.mul(pr.u, 1 / su), vh = G.mul(pr.v, 1 / sv);
    const n = G.norm(G.cross(uh, vh));
    const t = Math.max(0.3, Math.min(0.6, 0.04 * Math.min(su, sv)));
    const pts = pr.poly.map(([a, b]) => G.add(pr.o, G.add(G.mul(pr.u, a), G.mul(pr.v, b))));
    const lo = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i])) - t - 0.5), hi = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])) + t + 0.5);
    return { type: 'plane', o: pr.o, uh, vh, su, sv, n, t, poly: pr.poly, cup: pr.cup, sc: Math.min(su, sv), bb: [...lo, ...hi] };
  }
  return null;
}

function primDist(q, p) {
  if (q.type === 'ell') {
    const dx = p[0] - q.c[0], dy = p[1] - q.c[1], dz = p[2] - q.c[2];
    const R = q.Rt, r = q.r;
    const l0 = (R[0][0] * dx + R[0][1] * dy + R[0][2] * dz), l1 = (R[1][0] * dx + R[1][1] * dy + R[1][2] * dz), l2 = (R[2][0] * dx + R[2][1] * dy + R[2][2] * dz);
    const k0 = Math.hypot(l0 / r[0], l1 / r[1], l2 / r[2]);
    const k1 = Math.hypot(l0 / (r[0] * r[0]), l1 / (r[1] * r[1]), l2 / (r[2] * r[2]));
    if (k1 < 1e-9) return -Math.min(r[0], r[1], r[2]);
    return k0 * (k0 - 1) / k1;
  }
  const d = [p[0] - q.o[0], p[1] - q.o[1], p[2] - q.o[2]];
  const a = (d[0] * q.uh[0] + d[1] * q.uh[1] + d[2] * q.uh[2]) / q.su, b = (d[0] * q.vh[0] + d[1] * q.vh[1] + d[2] * q.vh[2]) / q.sv;
  let h = d[0] * q.n[0] + d[1] * q.n[1] + d[2] * q.n[2];
  if (q.cup) h += 0.5 * (q.cup[0] * a * a * q.su + q.cup[1] * b * b * q.sv) * 0.25; // gentle bowl
  const inPlane = -polySD(q.poly, a, b) * q.sc;
  return Math.max(inPlane, Math.abs(h) - q.t);
}

// model: { groups: [{ name, k, parts: [{ name, k, prims, frame, keep }] }] }
// sets: [{ name, groups: [names or prefixes], k (cross-group blend) }]
function prepare(model, { partKScale = 0.5, groupKScale = 0.6 } = {}) {
  const parts = [], groups = [];
  model.groups.forEach((g, gi) => {
    const gk = (g.k == null ? 1 : g.k) * groupKScale;
    const pis = [];
    for (const [srcIdx, part] of g.parts.entries()) {
      const prims = part.prims.map(prepPrim).filter(Boolean);
      if (!prims.length) continue;
      const fr = part.frame || G.T();
      const P = { name: part.name, gi, k: (part.k || 0) * partKScale, prims, frame: fr, inv: G.tinv(fr), keep: part.keep || null, disp: part.disp || null, keepScale: part.keepScale || 1, shellT: part.inner === false ? 0 : (part.shellT || 0), src: part, srcIdx, pi: parts.length };
      P.bb = [Math.min(...prims.map(q => q.bb[0])), Math.min(...prims.map(q => q.bb[1])), Math.min(...prims.map(q => q.bb[2])), Math.max(...prims.map(q => q.bb[3])), Math.max(...prims.map(q => q.bb[4])), Math.max(...prims.map(q => q.bb[5]))];
      parts.push(P); pis.push(P.pi);
    }
    groups.push({ name: g.name, k: gk, parts: pis, src: g });
  });
  return { parts, groups };
}

function partDist(P, p) {
  let d = 1e9;
  for (const q of P.prims) {
    if (p[0] < q.bb[0] - 3 || p[0] > q.bb[3] + 3 || p[1] < q.bb[1] - 3 || p[1] > q.bb[4] + 3 || p[2] < q.bb[2] - 3 || p[2] > q.bb[5] + 3) continue;
    d = smin(d, primDist(q, p), P.k);
  }
  // hollow shells (hair caps): keep only a layer of thickness shellT under the outer surface
  if (P.shellT && d < 1e8) d = Math.max(d, -(d + P.shellT));
  if ((P.keep || P.disp) && d < 2) {
    const loc = G.tapply(P.inv, p);
    if (P.disp) d += P.disp(loc);
    if (P.keep) d = Math.max(d, -P.keep(loc) * (P.keepScale || 1));
  }
  return d;
}

// distance of a set of groups: within a group smooth union by the group k, across groups by setK
// (or per-group override g.setK, e.g. 0 for fingers that must stay separate)
function makeSetField(prep, groupIdx, setK, groupSetK = {}) {
  const gs = groupIdx.map(gi => prep.groups[gi]);
  const bbOf = g => { const ps = g.parts.map(pi => prep.parts[pi].bb); return [Math.min(...ps.map(b => b[0])), Math.min(...ps.map(b => b[1])), Math.min(...ps.map(b => b[2])), Math.max(...ps.map(b => b[3])), Math.max(...ps.map(b => b[4])), Math.max(...ps.map(b => b[5]))]; };
  const gbb = gs.map(bbOf);
  const field = (p, info) => {
    let d = 1e9, bestW = -1, bestPart = -1;
    gs.forEach((g, i) => {
      const b = gbb[i];
      if (p[0] < b[0] - 4 || p[0] > b[3] + 4 || p[1] < b[1] - 4 || p[1] > b[4] + 4 || p[2] < b[2] - 4 || p[2] > b[5] + 4) return;
      let dg = 1e9;
      for (const pi of g.parts) {
        const P = prep.parts[pi];
        if (p[0] < P.bb[0] - 4 || p[0] > P.bb[3] + 4 || p[1] < P.bb[1] - 4 || p[1] > P.bb[4] + 4 || p[2] < P.bb[2] - 4 || p[2] > P.bb[5] + 4) continue;
        const dp = partDist(P, p);
        if (info && -dp > bestW) { bestW = -dp; bestPart = pi; }
        dg = smin(dg, dp, g.k);
      }
      const k = groupSetK[g.name] != null ? groupSetK[g.name] : setK;
      d = smin(d, dg, k);
    });
    if (info) info.part = bestPart;
    return d;
  };
  return { field, bb: gbb.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])]) };
}

// Surface nets on a narrow band: coarse sign pass, refine near the surface.
function mesh(field, bb, { h = 0.4, coarse = 4 } = {}) {
  const pad = 2 * h * coarse;
  const x0 = bb[0] - pad, y0 = bb[1] - pad, z0 = bb[2] - pad;
  const nx = Math.ceil((bb[3] - bb[0] + 2 * pad) / h) + 1, ny = Math.ceil((bb[4] - bb[1] + 2 * pad) / h) + 1, nz = Math.ceil((bb[5] - bb[2] + 2 * pad) / h) + 1;
  const vals = new Float32Array(nx * ny * nz).fill(NaN);
  const idx = (i, j, k) => (k * ny + j) * nx + i;
  const P = (i, j, k) => [x0 + i * h, y0 + j * h, z0 + k * h];
  // coarse pass
  const cx = Math.ceil(nx / coarse), cy = Math.ceil(ny / coarse), cz = Math.ceil(nz / coarse);
  const cH = h * coarse;
  for (let k = 0; k <= cz; k++) for (let j = 0; j <= cy; j++) for (let i = 0; i <= cx; i++) {
    const I = Math.min(nx - 1, i * coarse), J = Math.min(ny - 1, j * coarse), K = Math.min(nz - 1, k * coarse);
    const d = field(P(I, J, K));
    if (Math.abs(d) > cH * 1.8) {
      // whole coarse cell around this sample keeps the sign
      for (let kk = Math.max(0, K - coarse / 2); kk <= Math.min(nz - 1, K + coarse / 2); kk++) for (let jj = Math.max(0, J - coarse / 2); jj <= Math.min(ny - 1, J + coarse / 2); jj++) for (let ii = Math.max(0, I - coarse / 2); ii <= Math.min(nx - 1, I + coarse / 2); ii++) {
        const id = idx(ii, jj, kk); if (Number.isNaN(vals[id])) vals[id] = d > 0 ? 1e3 : -1e3;
      }
    }
  }
  // fine pass where undecided
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const id = idx(i, j, k);
    if (Number.isNaN(vals[id])) vals[id] = field(P(i, j, k));
  }
  // surface nets: one vertex per sign-changing cell
  const vIdx = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const verts = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = C.map(([a, b, c]) => vals[idx(i + a, j + b, k + c)]);
    let neg = 0; for (const x of v) if (x < 0) neg++;
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    vIdx[cidx(i, j, k)] = verts.length;
    verts.push([x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h]);
  }
  // quads across sign-changing edges
  const tris = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) tris.push(a, c, b, a, d, c); else tris.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = vals[idx(i, j, k)];
    // edge along x from (i,j,k) to (i+1,j,k)
    if (i < nx - 1) { const v1 = vals[idx(i + 1, j, k)]; if ((v0 < 0) !== (v1 < 0)) quad(vIdx[cidx(i, j - 1, k - 1)], vIdx[cidx(i, j, k - 1)], vIdx[cidx(i, j, k)], vIdx[cidx(i, j - 1, k)], v0 < 0); }
    if (j < ny - 1) { const v1 = vals[idx(i, j + 1, k)]; if ((v0 < 0) !== (v1 < 0)) quad(vIdx[cidx(i - 1, j, k - 1)], vIdx[cidx(i - 1, j, k)], vIdx[cidx(i, j, k)], vIdx[cidx(i, j, k - 1)], v0 < 0); }
    if (k < nz - 1) { const v1 = vals[idx(i, j, k + 1)]; if ((v0 < 0) !== (v1 < 0)) quad(vIdx[cidx(i - 1, j - 1, k)], vIdx[cidx(i, j - 1, k)], vIdx[cidx(i, j, k)], vIdx[cidx(i - 1, j, k)], v0 < 0); }
  }
  // normals from the field gradient
  const e = h * 0.5;
  const normals = verts.map(p => {
    const g = [field([p[0] + e, p[1], p[2]]) - field([p[0] - e, p[1], p[2]]), field([p[0], p[1] + e, p[2]]) - field([p[0], p[1] - e, p[2]]), field([p[0], p[1], p[2] + e]) - field([p[0], p[1], p[2] - e])];
    return G.norm(g);
  });
  // orient every triangle with the field gradient (outward), independent of the quad bookkeeping
  for (let t = 0; t < tris.length; t += 3) {
    const a = verts[tris[t]], b = verts[tris[t + 1]], c = verts[tris[t + 2]];
    const cr = G.cross(G.sub(b, a), G.sub(c, a));
    const na = normals[tris[t]], nb = normals[tris[t + 1]], nc = normals[tris[t + 2]];
    const dot = cr[0] * (na[0] + nb[0] + nc[0]) + cr[1] * (na[1] + nb[1] + nc[1]) + cr[2] * (na[2] + nb[2] + nc[2]);
    if (dot < 0) { const x = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = x; }
  }
  return { verts, normals, tris };
}

// Default split of a figure into smooth sets: the body (fingers stay separate), the head, the hair and
// accessories. Groups inside a set blend by the set k; groups listed in `override` use their own k.
const DEFAULT_SETS = [
  { name: 'body', test: n => /^(torso|bust|arm[LR]|hand[LR]|leg[LR]|tail)/.test(n), k: 1.6, h: 1,
    override: n => (/\.f\d|\.thumb|\.c\d|\.ct/.test(n) ? 0.12 : /^hand[LR]$/.test(n) ? 0.8 : n === 'bust' ? 3.2 : null) },
  { name: 'head', test: n => /^head/.test(n), k: 0.5, h: 0.6 },
  { name: 'hair', test: n => n.startsWith('hair'), k: 0.6, h: 0.6 },
  { name: 'acc', test: () => true, k: 0, h: 0.6 },
];
// model -> [{ name, verts, normals, tris, vpart: [[gi, partIdxInGroup]] }] in model space
function sculpt(model, { h = 0.45, sets = DEFAULT_SETS, only = null } = {}) {
  const prep = prepare(model);
  const used = new Set(), meshes = [];
  for (const st of sets) {
    const gis = prep.groups.map((g, i) => i).filter(i => !used.has(i) && st.test(prep.groups[i].name));
    gis.forEach(i => used.add(i));
    if (!gis.length || (only && !only.includes(st.name))) continue;
    const over = {};
    if (st.override) for (const gi of gis) { const v = st.override(prep.groups[gi].name); if (v != null) over[prep.groups[gi].name] = v; }
    const { field, bb } = makeSetField(prep, gis, st.k, over);
    const m = mesh(field, bb, { h: h * (st.h || 1) });
    const info = {};
    m.vpart = m.verts.map(v => { field(v, info); const P = prep.parts[info.part]; return P ? [P.gi, P.srcIdx] : [-1, -1]; });
    m.name = st.name;
    meshes.push(m);
  }
  return meshes;
}

// minimal binary glTF writer: POSITION, NORMAL, COLOR_0 (optional) per mesh
function writeGLB(meshes) {
  const bufs = [], accessors = [], views = [], meshesJ = [], nodes = [];
  let off = 0;
  const push = (arr, target) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.length % 4)) % 4; bufs.push(b, Buffer.alloc(pad)); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, target }); off += b.length + pad; return views.length - 1; };
  meshes.forEach((m, mi) => {
    const pos = new Float32Array(m.verts.flat()), nor = new Float32Array(m.normals.flat());
    const ind = new Uint32Array(m.tris);
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const v of m.verts) for (let i = 0; i < 3; i++) { if (v[i] < mn[i]) mn[i] = v[i]; if (v[i] > mx[i]) mx[i] = v[i]; }
    const attrs = {};
    accessors.push({ bufferView: push(pos, 34962), componentType: 5126, count: m.verts.length, type: 'VEC3', min: mn, max: mx }); attrs.POSITION = accessors.length - 1;
    accessors.push({ bufferView: push(nor, 34962), componentType: 5126, count: m.verts.length, type: 'VEC3' }); attrs.NORMAL = accessors.length - 1;
    if (m.colors) { accessors.push({ bufferView: push(new Float32Array(m.colors.flat()), 34962), componentType: 5126, count: m.verts.length, type: 'VEC3' }); attrs.COLOR_0 = accessors.length - 1; }
    if (m.extra) for (const [nm, arr, type] of m.extra) { accessors.push({ bufferView: push(new Float32Array(arr.flat()), 34962), componentType: 5126, count: m.verts.length, type }); attrs[nm] = accessors.length - 1; }
    accessors.push({ bufferView: push(ind, 34963), componentType: 5125, count: ind.length, type: 'SCALAR' });
    meshesJ.push({ name: m.name, primitives: [{ attributes: attrs, indices: accessors.length - 1 }] });
    nodes.push({ mesh: mi, name: m.name });
  });
  const bin = Buffer.concat(bufs);
  const json = { asset: { version: '2.0', generator: 'nochi-karnaka sdf' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: meshesJ, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }] };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, c1, js, c2, bin]);
}

module.exports = { smin, prepare, makeSetField, mesh, sculpt, DEFAULT_SETS, writeGLB, primDist, partDist };
