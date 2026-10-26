'use strict';
// Analytic raster of a 3D model built from ellipsoids and planar shapes.
// Produces per-pixel depth, normal, group/material labels and continuous signed fields
// so that marching squares can turn every region into clean vector shapes.
//
// Model:
//   { groups: [{ name, k, parts: [{ name, mat, matInner, frame, keep, prims: [...] }] }] }
//   prim: { type: 'ell', c: [x,y,z], A: 3x3 (columns are semi-axes) }
//       | { type: 'plane', o, u, v, poly: [[a,b]...], matBack, cup: [ca, cb] }
// View: { R, s, ox, oy }  screen = s * R p + (ox, oy), depth z = s * (R p).z (toward viewer)
const G = require('./geom');

const NEG = -1e9;

function viewOf({ yaw = 0, pitch = 0, roll = 0, s = 1, ox = 0, oy = 0, R = null }) {
  return { R: R || G.euler(yaw, pitch, roll), s, ox, oy };
}
function toView(view, p) {
  const q = G.mvec(view.R, p);
  return [q[0] * view.s + view.ox, q[1] * view.s + view.oy, q[2] * view.s];
}
function dirToView(view, d) { return G.mvec(view.R, d); }

// polygon signed distance (positive inside) in its own coordinates
function polySD(poly, a, b) {
  let inside = false, md = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[i], q = poly[j];
    if (((p[1] > b) !== (q[1] > b)) && (a < (q[0] - p[0]) * (b - p[1]) / (q[1] - p[1]) + p[0])) inside = !inside;
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const t = Math.max(0, Math.min(1, ((a - p[0]) * ex + (b - p[1]) * ey) / (ex * ex + ey * ey || 1)));
    const dx = a - p[0] - ex * t, dy = b - p[1] - ey * t;
    md = Math.min(md, dx * dx + dy * dy);
  }
  md = Math.sqrt(md);
  return inside ? md : -md;
}

class Raster {
  constructor({ x0 = 0, y0 = 0, w, h, step = 1 }) {
    this.x0 = x0; this.y0 = y0; this.step = step;
    this.W = Math.ceil(w / step) + 1; this.H = Math.ceil(h / step) + 1;
    const N = this.W * this.H;
    this.cov = new Float32Array(N).fill(-50);   // union coverage field (approx signed distance)
    this.z1 = new Float32Array(N).fill(NEG);     // top group depth
    this.z2 = new Float32Array(N).fill(NEG);     // second group depth
    this.g1 = new Int16Array(N).fill(-1);
    this.g2 = new Int16Array(N).fill(-1);
    this.f1 = new Float32Array(N).fill(-50);     // coverage field of top group
    this.mat1 = new Int16Array(N).fill(-1);      // top material id
    this.mf1 = new Float32Array(N).fill(1e6);    // margin of top material over the next material in that group
    this.mat2 = new Int16Array(N).fill(-1);      // runner-up material in that group
    this.part1 = new Int16Array(N).fill(-1);
    this.nx = new Float32Array(N); this.ny = new Float32Array(N); this.nz = new Float32Array(N).fill(1);
    this.matIds = new Map(); this.matNames = [];
    this.parts = []; this.groups = [];
  }
  matId(name) {
    if (!this.matIds.has(name)) { this.matIds.set(name, this.matNames.length); this.matNames.push(name); }
    return this.matIds.get(name);
  }
  idx(i, j) { return j * this.W + i; }
  // world (svg) -> grid
  gx(x) { return (x - this.x0) / this.step; }
  gy(y) { return (y - this.y0) / this.step; }
  px(i) { return this.x0 + i * this.step; }
  py(j) { return this.y0 + j * this.step; }

  // ---------- prim preparation ----------
  prepPrim(view, part, prim) {
    if (prim.type === 'ell') {
      const c = toView(view, prim.c);
      const M = G.mmul(view.R, prim.A).map(r => r.map(v => v * view.s));
      const Mi = G.inv3(M);
      const d = [Mi[0][2], Mi[1][2], Mi[2][2]];
      const rx = Math.hypot(M[0][0], M[0][1], M[0][2]), ry = Math.hypot(M[1][0], M[1][1], M[1][2]);
      // projected ellipse semi-axes
      const a = M[0][0] ** 2 + M[0][1] ** 2 + M[0][2] ** 2, b = M[0][0] * M[1][0] + M[0][1] * M[1][1] + M[0][2] * M[1][2], cc = M[1][0] ** 2 + M[1][1] ** 2 + M[1][2] ** 2;
      const tr = (a + cc) / 2, dt = Math.sqrt(Math.max(0, ((a - cc) / 2) ** 2 + b * b));
      const rmin = Math.sqrt(Math.max(1e-6, tr - dt));
      return { type: 'ell', c, Mi, d, dd: G.dot(d, d), bb: [c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry], rmin, src: prim };
    }
    if (prim.type === 'plane') {
      const o = toView(view, prim.o);
      const u = G.mvec(view.R, prim.u).map(v => v * view.s), v = G.mvec(view.R, prim.v).map(q => q * view.s);
      const det = u[0] * v[1] - u[1] * v[0];
      if (Math.abs(det) < 1e-6) return null; // edge-on
      const inv = [[v[1] / det, -v[0] / det], [-u[1] / det, u[0] / det]];
      const n = G.norm(G.cross(u, v));
      const pts = prim.poly.map(([a, b]) => [o[0] + a * u[0] + b * v[0], o[1] + a * u[1] + b * v[1]]);
      const bb = G.bbox([pts]);
      // local->screen scale (min singular value) for distance conversion
      const su = Math.hypot(u[0], u[1]), sv = Math.hypot(v[0], v[1]);
      const sc = Math.abs(det) / Math.max(su, sv);
      return { type: 'plane', o, u, v, inv, n, bb, sc, src: prim, uh: G.norm(u), vh: G.norm(v) };
    }
    throw new Error('unknown prim ' + prim.type);
  }

  // Intersect: returns {f, z, n:[...], side} or null (outside bbox)
  // f is a signed field (screen units) positive where the prim covers the pixel.
  hit(pp, part, x, y) {
    if (pp.type === 'ell') {
      const ox = x - pp.c[0], oy = y - pp.c[1], oz = -pp.c[2];
      const Mi = pp.Mi;
      const o0 = Mi[0][0] * ox + Mi[0][1] * oy + Mi[0][2] * oz;
      const o1 = Mi[1][0] * ox + Mi[1][1] * oy + Mi[1][2] * oz;
      const o2 = Mi[2][0] * ox + Mi[2][1] * oy + Mi[2][2] * oz;
      const d = pp.d, od = o0 * d[0] + o1 * d[1] + o2 * d[2], oo = o0 * o0 + o1 * o1 + o2 * o2;
      const q = oo - od * od / pp.dd; // squared closest distance to unit-sphere centre
      const rho = Math.sqrt(Math.max(0, q));
      let f = (1 - rho) * pp.rmin;
      if (q >= 1) return { f, z: NEG, n: null, side: 0 };
      const disc = Math.sqrt(od * od - pp.dd * (oo - 1));
      const tF = (-od + disc) / pp.dd, tB = (-od - disc) / pp.dd;
      const front = this._ellPoint(pp, o0, o1, o2, tF);
      if (!part.keepV) return { f, z: tF, n: front.n, side: 0 };
      const kf = part.keepV(x, y, tF);
      if (kf > 0) return { f: Math.min(f, kf), z: tF, n: front.n, side: 0 };
      if (part.inner) {
        const kb = part.keepV(x, y, tB);
        if (kb > 0) { const back = this._ellPoint(pp, o0, o1, o2, tB); return { f: Math.min(f, kb), z: tB, n: back.n.map(v => -v), side: 1 }; }
        return { f: Math.max(kf, kb), z: NEG, n: null, side: 0 };
      }
      return { f: kf, z: NEG, n: null, side: 0 };
    }
    // plane
    const dx = x - pp.o[0], dy = y - pp.o[1];
    const a = pp.inv[0][0] * dx + pp.inv[0][1] * dy, b = pp.inv[1][0] * dx + pp.inv[1][1] * dy;
    const sd = polySD(pp.src.poly, a, b) * pp.sc;
    if (sd <= 0) return { f: sd, z: NEG, n: null, side: 0 };
    const z = pp.o[2] + a * pp.u[2] + b * pp.v[2];
    let n = pp.n.slice(), side = 0;
    if (n[2] < 0) { n = n.map(v => -v); side = 1; }
    const cup = pp.src.cup;
    if (cup) {
      const sgn = side ? -1 : 1;
      n = G.norm([n[0] + sgn * (cup[0] * a * pp.uh[0] + cup[1] * b * pp.vh[0]), n[1] + sgn * (cup[0] * a * pp.uh[1] + cup[1] * b * pp.vh[1]), n[2] + sgn * (cup[0] * a * pp.uh[2] + cup[1] * b * pp.vh[2])]);
      if (n[2] < 0.02) n[2] = 0.02;
    }
    let f = sd;
    if (part.keepV) { const k = part.keepV(x, y, z); f = Math.min(f, k); if (k <= 0) return { f, z: NEG, n: null, side: 0 }; }
    return { f, z, n, side };
  }
  _ellPoint(pp, o0, o1, o2, t) {
    const d = pp.d, u0 = o0 + t * d[0], u1 = o1 + t * d[1], u2 = o2 + t * d[2];
    const Mi = pp.Mi; // normal ∝ Mi^T u
    const n = [Mi[0][0] * u0 + Mi[1][0] * u1 + Mi[2][0] * u2, Mi[0][1] * u0 + Mi[1][1] * u1 + Mi[2][1] * u2, Mi[0][2] * u0 + Mi[1][2] * u1 + Mi[2][2] * u2];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return { n: [n[0] / l, n[1] / l, n[2] / l] };
  }

  // Part depth query at an arbitrary point (hard max over its prims). Returns {z, f, n} or null.
  partAt(pi, x, y) {
    const part = this.parts[pi]; let best = null, pm = NEG, ps = 0;
    for (const pp of part.pp) {
      if (x < pp.bb[0] - 1 || x > pp.bb[2] + 1 || y < pp.bb[1] - 1 || y > pp.bb[3] + 1) continue;
      const h = this.hit(pp, part, x, y);
      if (h.z > NEG && h.f > 0 && (!best || h.z > best.z)) best = h;
      if (part.kv && h.z > NEG) { if (h.z > pm) { ps = (pm <= NEG ? 0 : ps * Math.exp((pm - h.z) / part.kv)) + 1; pm = h.z; } else ps += Math.exp((h.z - pm) / part.kv); }
    }
    if (best && part.kv && pm > NEG) best = { ...best, z: pm + part.kv * Math.log(ps) };
    return best;
  }

  // ---------- main pass ----------
  render(model, view) {
    this.view = view; this.model = model;
    const S = this.step;
    model.groups.forEach((grp, gi) => {
      const k = (grp.k == null ? 6 : grp.k) * view.s; // blend radius in screen units
      const parts = grp.parts.map(part => {
        const pi = this.parts.length;
        const P = { ...part, gi, pi, kv: part.k ? part.k * view.s : 0, mid: this.matId(part.mat), midInner: this.matId(part.matInner || part.mat + ':inner'), midBack: null };
        if (part.keep) {
          // keep() works in the part-local frame; build view->local mapping
          const fr = part.frame || G.T();
          const Rt = G.transpose(view.R), FRt = G.transpose(fr.R);
          P.keepV = (x, y, z) => {
            const pm = G.mvec(Rt, [(x - view.ox) / view.s, (y - view.oy) / view.s, z / view.s]);
            const pl = G.mvec(FRt, G.sub(pm, fr.t));
            return part.keep(pl) * view.s;
          };
          P.inner = !!part.inner;
        }
        P.pp = part.prims.map(pr => this.prepPrim(view, P, pr)).filter(Boolean);
        P.pp.forEach(pp => { if (pp.src.matBack) pp.midBack = this.matId(pp.src.matBack); });
        P.bb = G.bbox([P.pp.flatMap(pp => [[pp.bb[0], pp.bb[1]], [pp.bb[2], pp.bb[3]]])]);
        this.parts.push(P);
        return P;
      });
      this.groups.push({ name: grp.name, k, parts: parts.map(p => p.pi), line: grp.line });
      if (!parts.length) return;
      // group bbox in grid coords
      const gb = G.bbox([parts.flatMap(p => [[p.bb[0], p.bb[1]], [p.bb[2], p.bb[3]]])]);
      const i0 = Math.max(0, Math.floor(this.gx(gb[0])) - 2), i1 = Math.min(this.W - 1, Math.ceil(this.gx(gb[2])) + 2);
      const j0 = Math.max(0, Math.floor(this.gy(gb[1])) - 2), j1 = Math.min(this.H - 1, Math.ceil(this.gy(gb[3])) + 2);
      if (i1 < i0 || j1 < j0) return;
      const GW = i1 - i0 + 1, GH = j1 - j0 + 1, GN = GW * GH;
      const fG = new Float32Array(GN).fill(-50);
      const m = new Float32Array(GN).fill(NEG), sum = new Float32Array(GN), nsx = new Float32Array(GN), nsy = new Float32Array(GN), nsz = new Float32Array(GN);
      const zt = new Float32Array(GN).fill(NEG), mt = new Int16Array(GN).fill(-1), z2m = new Float32Array(GN).fill(NEG), m2 = new Int16Array(GN).fill(-1), pt = new Int16Array(GN).fill(-1);
      for (const P of parts) {
        const a0 = Math.max(i0, Math.floor(this.gx(P.bb[0])) - 2), a1 = Math.min(i1, Math.ceil(this.gx(P.bb[2])) + 2);
        const b0 = Math.max(j0, Math.floor(this.gy(P.bb[1])) - 2), b1 = Math.min(j1, Math.ceil(this.gy(P.bb[3])) + 2);
        for (let j = b0; j <= b1; j++) {
          const y = this.py(j);
          for (let i = a0; i <= a1; i++) {
            const x = this.px(i);
            // hard max over the part's prims
            let bz = NEG, bf = -50, bn = null, bside = 0, bpp = null;
            let pm = NEG, ps = 0, px = 0, py = 0, pz = 0;
            for (const pp of P.pp) {
              if (x < pp.bb[0] - 2 * S || x > pp.bb[2] + 2 * S || y < pp.bb[1] - 2 * S || y > pp.bb[3] + 2 * S) continue;
              const h = this.hit(pp, P, x, y);
              if (h.f > bf) bf = h.f;
              if (h.z > bz) { bz = h.z; bn = h.n; bside = h.side; bpp = pp; }
              if (P.kv && h.z > NEG) { // smooth union inside the part
                if (h.z > pm) { const r = pm <= NEG ? 0 : Math.exp((pm - h.z) / P.kv); ps = ps * r + 1; px = px * r + h.n[0]; py = py * r + h.n[1]; pz = pz * r + h.n[2]; pm = h.z; }
                else { const w = Math.exp((h.z - pm) / P.kv); ps += w; px += w * h.n[0]; py += w * h.n[1]; pz += w * h.n[2]; }
              }
            }
            if (P.kv && pm > NEG) { bz = pm + P.kv * Math.log(ps); const l = Math.hypot(px, py, pz) || 1; bn = [px / l, py / l, pz / l]; }
            const gi2 = (j - j0) * GW + (i - i0);
            if (bf > fG[gi2]) fG[gi2] = bf;
            if (bz <= NEG) continue;
            const mat = bside ? (bpp && bpp.midBack != null && bpp.src.type === 'plane' ? bpp.midBack : P.midInner) : P.mid;
            // log-sum-exp smooth max with streaming rescale
            if (bz > m[gi2]) {
              const r = m[gi2] <= NEG ? 0 : Math.exp((m[gi2] - bz) / k);
              sum[gi2] = sum[gi2] * r + 1; nsx[gi2] = nsx[gi2] * r + bn[0]; nsy[gi2] = nsy[gi2] * r + bn[1]; nsz[gi2] = nsz[gi2] * r + bn[2];
              m[gi2] = bz;
            } else {
              const w = Math.exp((bz - m[gi2]) / k);
              sum[gi2] += w; nsx[gi2] += w * bn[0]; nsy[gi2] += w * bn[1]; nsz[gi2] += w * bn[2];
            }
            // material ranking inside the group (hard)
            if (mat === mt[gi2]) { if (bz > zt[gi2]) { zt[gi2] = bz; pt[gi2] = P.pi; } }
            else if (bz > zt[gi2]) { if (mt[gi2] >= 0) { z2m[gi2] = zt[gi2]; m2[gi2] = mt[gi2]; } zt[gi2] = bz; mt[gi2] = mat; pt[gi2] = P.pi; }
            else if (bz > z2m[gi2]) { z2m[gi2] = bz; m2[gi2] = mat; }
          }
        }
      }
      // merge group into global buffers
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const gi2 = (j - j0) * GW + (i - i0), id = j * this.W + i;
        const f = fG[gi2];
        if (f > this.cov[id]) this.cov[id] = f;
        if (m[gi2] <= NEG || f <= -1.5 * S) continue;
        const z = m[gi2] + k * Math.log(sum[gi2]);
        if (z > this.z1[id]) {
          this.z2[id] = this.z1[id]; this.g2[id] = this.g1[id];
          this.z1[id] = z; this.g1[id] = gi; this.f1[id] = f;
          const l = Math.hypot(nsx[gi2], nsy[gi2], nsz[gi2]) || 1;
          this.nx[id] = nsx[gi2] / l; this.ny[id] = nsy[gi2] / l; this.nz[id] = nsz[gi2] / l;
          this.mat1[id] = mt[gi2]; this.mat2[id] = m2[gi2]; this.mf1[id] = z2m[gi2] <= NEG ? 1e6 : zt[gi2] - z2m[gi2]; this.part1[id] = pt[gi2];
        } else if (z > this.z2[id]) { this.z2[id] = z; this.g2[id] = gi; }
      }
    });
    return this;
  }

  // ---------- fields ----------
  // Visible region field for a group (positive where the group is front-most and covers).
  groupField(gi) {
    const N = this.W * this.H, out = new Float32Array(N);
    for (let id = 0; id < N; id++) {
      if (this.g1[id] === gi) out[id] = this.g2[id] >= 0 ? Math.min(this.f1[id], this.z1[id] - this.z2[id]) : this.f1[id];
      else if (this.g2[id] === gi) out[id] = this.z2[id] - this.z1[id];
      else out[id] = -2 * this.step;
    }
    return out;
  }
  // Visible region field for a label (group + material).
  labelField(gi, mid) {
    const N = this.W * this.H, out = new Float32Array(N);
    for (let id = 0; id < N; id++) {
      if (this.g1[id] === gi) {
        const vis = this.g2[id] >= 0 ? Math.min(this.f1[id], this.z1[id] - this.z2[id]) : this.f1[id];
        if (this.mat1[id] === mid) out[id] = Math.min(vis, this.mf1[id]);
        else if (this.mat2[id] === mid) out[id] = Math.min(vis, -this.mf1[id]);
        else out[id] = Math.min(vis, -this.step);
      } else if (this.g2[id] === gi) out[id] = this.z2[id] - this.z1[id];
      else out[id] = -2 * this.step;
    }
    return out;
  }
  labels() {
    const set = new Map();
    const N = this.W * this.H;
    for (let id = 0; id < N; id++) if (this.g1[id] >= 0 && this.f1[id] > 0) {
      const key = this.g1[id] + ':' + this.mat1[id];
      if (!set.has(key)) set.set(key, { gi: this.g1[id], mid: this.mat1[id], count: 0, zsum: 0 });
      const e = set.get(key); e.count++; e.zsum += this.z1[id];
    }
    return [...set.values()].map(e => ({ ...e, zavg: e.zsum / e.count, group: this.groups[e.gi].name, mat: this.matNames[e.mid] }));
  }
  // Map a per-pixel function over covered pixels; returns field (others get `outside`).
  mapField(fn, { outside = -1, where = null } = {}) {
    const N = this.W * this.H, out = new Float32Array(N).fill(outside);
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      const id = j * this.W + i;
      if (this.g1[id] < 0 || this.z1[id] <= NEG) continue;
      if (where && !where(id)) continue;
      out[id] = fn(id, i, j);
    }
    return out;
  }
  // Distance (svg units) from each covered pixel to the silhouette (two-pass chamfer).
  silhouetteDistance() {
    if (this._sd) return this._sd;
    const W = this.W, H = this.H, N = W * H, INF = 1e9, d = new Float32Array(N);
    for (let id = 0; id < N; id++) d[id] = this.cov[id] > 0 ? INF : 0;
    const a = 1, b = Math.SQRT2;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const id = j * W + i; if (!d[id]) continue; let v = d[id];
      if (i > 0) v = Math.min(v, d[id - 1] + a); if (j > 0) { v = Math.min(v, d[id - W] + a); if (i > 0) v = Math.min(v, d[id - W - 1] + b); if (i < W - 1) v = Math.min(v, d[id - W + 1] + b); } d[id] = v; }
    for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const id = j * W + i; if (!d[id]) continue; let v = d[id];
      if (i < W - 1) v = Math.min(v, d[id + 1] + a); if (j < H - 1) { v = Math.min(v, d[id + W] + a); if (i < W - 1) v = Math.min(v, d[id + W + 1] + b); if (i > 0) v = Math.min(v, d[id + W - 1] + b); } d[id] = v; }
    for (let id = 0; id < N; id++) d[id] = d[id] >= INF ? 0 : (d[id] - 0.5) * this.step;
    return (this._sd = d);
  }
  normal(id) { return [this.nx[id], this.ny[id], this.nz[id]]; }
  // bilinear sample of a buffer at svg coords
  sample(buf, x, y, dflt = NEG) {
    const gx = this.gx(x), gy = this.gy(y);
    const i = Math.floor(gx), j = Math.floor(gy);
    if (i < 0 || j < 0 || i >= this.W - 1 || j >= this.H - 1) return dflt;
    const fx = gx - i, fy = gy - j, W = this.W;
    const a = buf[j * W + i], b = buf[j * W + i + 1], c = buf[(j + 1) * W + i], d = buf[(j + 1) * W + i + 1];
    if (a <= NEG || b <= NEG || c <= NEG || d <= NEG) { // nearest valid
      const n = buf[Math.round(gy) * W + Math.round(gx)]; return n <= NEG ? dflt : n;
    }
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  depthAt(x, y) { return this.sample(this.z1, x, y, NEG); }
  // nearest-pixel id at svg coords
  idAt(x, y) {
    const i = Math.round(this.gx(x)), j = Math.round(this.gy(y));
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    return j * this.W + i;
  }
  // view-space point for pixel id
  pointOf(id) { const i = id % this.W, j = (id / this.W) | 0; return [this.px(i), this.py(j), this.z1[id]]; }
  // part-local coordinates of a view-space point
  toLocal(pi, p) {
    const view = this.view, part = this.parts[pi], fr = part.frame || G.T();
    const pm = G.mvec(G.transpose(view.R), [(p[0] - view.ox) / view.s, (p[1] - view.oy) / view.s, p[2] / view.s]);
    return G.mvec(G.transpose(fr.R), G.sub(pm, fr.t));
  }
  // model -> view helpers bound to this raster's view
  project(p) { return toView(this.view, p); }
  visible(x, y, z, eps = 1.5) { const zb = this.depthAt(x, y); return zb <= NEG || z >= zb - eps * this.view.s; }

  // Shadow map: render the model again from the light (orthographic) and compare depths.
  // Returns a continuous field (occluder height above the point, minus bias) per screen pixel.
  shadowMap(Lview, { bias = 1.5, smooth = 1 } = {}) {
    const view = this.view, s = view.s;
    const Lw = G.norm(G.mvec(G.transpose(view.R), Lview)); // light direction in model space
    const Rl = G.rotBetween(Lw, [0, 0, 1]);
    // bounds of the model in light space
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const grp of this.model.groups) for (const part of grp.parts) for (const pr of part.prims) {
      const c = pr.type === 'ell' ? pr.c : pr.o;
      const q = G.mvec(Rl, c); const ext = pr.type === 'ell' ? Math.max(...[0, 1, 2].map(i => Math.hypot(pr.A[i][0], pr.A[i][1], pr.A[i][2]))) : G.len(pr.u) + G.len(pr.v);
      x0 = Math.min(x0, q[0] - ext); y0 = Math.min(y0, q[1] - ext); x1 = Math.max(x1, q[0] + ext); y1 = Math.max(y1, q[1] + ext);
    }
    const pad = 4 / s;
    const lv = { R: Rl, s, ox: -(x0 - pad) * s, oy: -(y0 - pad) * s };
    const LR = new Raster({ x0: 0, y0: 0, w: (x1 - x0 + 2 * pad) * s, h: (y1 - y0 + 2 * pad) * s, step: this.step }).render(this.model, lv);
    this.lightRaster = LR;
    const N = this.W * this.H, out = new Float32Array(N).fill(-1);
    const Rt = G.transpose(view.R);
    const LW = LR.W, LH = LR.H;
    for (let id = 0; id < N; id++) {
      if (this.g1[id] < 0) continue;
      const i = id % this.W, j = (id / this.W) | 0;
      const pm = G.mvec(Rt, [(this.px(i) - view.ox) / s, (this.py(j) - view.oy) / s, this.z1[id] / s]);
      const q = G.mvec(Rl, pm);
      const qx = q[0] * s + lv.ox, qy = q[1] * s + lv.oy, qz = q[2] * s;
      const gx = LR.gx(qx), gy = LR.gy(qy), a = Math.floor(gx), b = Math.floor(gy);
      if (a < 0 || b < 0 || a >= LW - 1 || b >= LH - 1) continue;
      const fx = gx - a, fy = gy - b, own = this.g1[id];
      let zs = 0, w = 0;
      const acc = (k, ww) => { if (LR.g1[k] >= 0 && LR.g1[k] !== own) { zs += LR.z1[k] * ww; w += ww; } };
      acc(b * LW + a, (1 - fx) * (1 - fy)); acc(b * LW + a + 1, fx * (1 - fy)); acc((b + 1) * LW + a, (1 - fx) * fy); acc((b + 1) * LW + a + 1, fx * fy);
      if (w < 0.3) continue;
      out[id] = Math.min(8, zs / w - qz - bias) * Math.min(1, w * 1.6);
    }
    for (let it = 0; it < smooth; it++) {
      const src = out.slice(), W = this.W;
      for (let j = 1; j < this.H - 1; j++) for (let i = 1; i < W - 1; i++) {
        const id = j * W + i; if (this.g1[id] < 0) continue;
        let sm = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = id + dj * W + di; if (this.g1[k] === this.g1[id]) { sm += src[k]; n++; } }
        out[id] = sm / n;
      }
    }
    return out;
  }

  // Screen-space cast shadows: march toward the light through the depth buffer of *other* groups.
  // The value is the (smoothed) height of the occluder above the ray, so the edge vectorises cleanly.
  castShadow(L, { stepLen = 1.25, maxLen = 160, bias = 2.0, start = 3, smooth = 2 } = {}) {
    const N = this.W * this.H, out = new Float32Array(N).fill(-1);
    const Ld = G.norm(L), W = this.W, H = this.H;
    const zAt = (qx, qy, own) => { // bilinear over other-group pixels
      const gx = this.gx(qx), gy = this.gy(qy), i = Math.floor(gx), j = Math.floor(gy);
      if (i < 0 || j < 0 || i >= W - 1 || j >= H - 1) return null;
      const fx = gx - i, fy = gy - j; let s = 0, w = 0;
      const acc = (id, ww) => { if (this.g1[id] >= 0 && this.g1[id] !== own) { s += this.z1[id] * ww; w += ww; } };
      acc(j * W + i, (1 - fx) * (1 - fy)); acc(j * W + i + 1, fx * (1 - fy)); acc((j + 1) * W + i, (1 - fx) * fy); acc((j + 1) * W + i + 1, fx * fy);
      return w > 0.35 ? s / w : null;
    };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const id = j * W + i;
      if (this.g1[id] < 0) continue;
      const own = this.g1[id], x = this.px(i), y = this.py(j), z = this.z1[id];
      let best = -bias;
      for (let t = start; t < maxLen; t += stepLen) {
        const qx = x + Ld[0] * t, qy = y + Ld[1] * t, qz = z + Ld[2] * t;
        if (qx < this.x0 || qy < this.y0 || qx > this.px(W - 1) || qy > this.py(H - 1)) break;
        const zb = zAt(qx, qy, own);
        if (zb == null) continue;
        const occ = zb - qz - bias;
        if (occ > best) best = occ;
        if (best > 8) break;
      }
      out[id] = best;
    }
    for (let it = 0; it < smooth; it++) {
      const src = out.slice();
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        const id = j * W + i; if (this.g1[id] < 0) continue;
        let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = id + dj * W + di; if (this.g1[q] === this.g1[id]) { s += src[q]; n++; } }
        out[id] = s / n;
      }
    }
    return out;
  }
  // Ambient occlusion relative to the tangent plane: convex forms stay clean, contacts and creases darken.
  ambientOcclusion(radius = 10, { bias = 0.6 } = {}) {
    const W = this.W, H = this.H, N = W * H, out = new Float32Array(N).fill(-1);
    const dirs = [];
    for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; for (const rr of [0.45, 1]) dirs.push([Math.cos(t) * radius * rr, Math.sin(t) * radius * rr]); }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const id = j * W + i;
      if (this.g1[id] < 0) continue;
      const z = this.z1[id], nz = Math.max(0.3, this.nz[id]), nx = this.nx[id], ny = this.ny[id];
      let occ = 0;
      for (const [dx, dy] of dirs) {
        const qi = Math.round(i + dx / this.step), qj = Math.round(j + dy / this.step);
        if (qi < 0 || qj < 0 || qi >= W || qj >= H) continue;
        const qid = qj * W + qi;
        if (this.g1[qid] < 0) continue;
        const zt = z - (nx * dx + ny * dy) / nz; // tangent plane prediction
        const d = this.z1[qid] - zt - bias;
        if (d > 0) occ += Math.min(d, radius) / radius;
      }
      out[id] = occ / dirs.length;
    }
    return out;
  }
}

module.exports = { Raster, viewOf, toView, dirToView, NEG, polySD };
