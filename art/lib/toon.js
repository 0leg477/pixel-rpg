'use strict';
// Raster -> vector toon rendering: label fills, markings, light/shadow families and contour lines.
const G = require('./geom');
const M = require('./march');
const P = require('./poly');
const L = require('./line');
const Cc = require('./color');
const { NEG } = require('./raster');
const { path, g } = require('./svg');

const DEF_LIGHT = {
  key: [-0.62, -0.58, 0.52],    // toward the light (view space): upper left, in front
  rim: [0.85, -0.25, -0.45],    // back light from the right
  bounce: [0.1, 1, 0.25],       // floor bounce from below
  tint: '#b4a0cc',              // multiply shadow tint (cool, hue-shifted)
  deepTint: '#7e6aa8',
  coreColor: '#e2643c',         // warm subsurface band at the terminator
  rimColor: '#bfe4ff',
  bounceColor: '#f0b77a',
  hiColor: '#fff2d2',
  aoColor: '#6e5a8a',
};

function shapesOf(R, field, opt = {}) {
  return M.shapes(field, R.W, R.H, { x0: R.x0, y0: R.y0, step: R.step, smooth: 2, eps: 0.2, minArea: 2 * R.step * R.step, ...opt });
}
const D = rings => G.ringsD(rings);

function materialSpec(materials, name) {
  const inner = name.endsWith(':inner');
  const baseName = inner ? name.slice(0, -6) : name;
  const m = materials[baseName] || { base: '#ff00ff' };
  const r = Cc.ramp(m.base);
  const spec = { shading: 'toon', t0: 0.06, t1: 0.42, sss: false, gloss: null, edgeLine: true, ...m, ramp: { ...r, ...(m.ramp || {}) } };
  spec.fill = inner ? (m.inner || Cc.shift(m.base, { dL: -0.16, cK: 1.05, toward: 275, dh: 18 })) : m.base;
  spec.lineColor = m.line || r.line;
  return spec;
}

// Main entry: draws a figure from a rendered raster into doc (layer 'char' by default).
function figure(R, doc, opt = {}) {
  const light = { ...DEF_LIGHT, ...(opt.light || {}) };
  const materials = opt.materials || {};
  const layer = opt.layer || 'char';
  const lw = opt.lineScale || 1;
  const K = 30; // scale for dot-product fields (1.0 -> 30 svg units)
  const Lk = G.norm(light.key), Lr = G.norm(light.rim), Lb = G.norm(light.bounce);
  const Hk = G.norm(G.add(Lk, [0, 0, 1]));
  const L2 = G.norm([Lk[0], Lk[1]]);
  const spec = R.matNames.map(n => materialSpec(materials, n));
  const out = [];

  // ---------- 1. label fills ----------
  const labels = R.labels().sort((a, b) => a.zavg - b.zavg);
  const labelShapes = [];
  for (const lb of labels) {
    const rings = shapesOf(R, R.labelField(lb.gi, lb.mid));
    if (!rings.length) continue;
    const sp = spec[lb.mid];
    labelShapes.push({ ...lb, rings, spec: sp });
    out.push(path(D(rings), { fill: sp.fill, stroke: sp.fill, 'stroke-width': 0.7 * R.step, 'fill-rule': 'evenodd', 'stroke-linejoin': 'round', opacity: sp.opacity }));
  }
  const allShape = P.union(labelShapes.flatMap(l => P.normalize(l.rings)));
  const allClip = doc.clip(D(allShape), { rule: 'nonzero' });

  // ---------- 2. markings (3D fields evaluated on the visible surface) ----------
  const drawMarking = (mk) => {
    const pis = new Set(R.parts.filter(p => mk.parts.includes(p.name)).map(p => p.pi));
    if (!pis.size) return null;
    const f = R.mapField(id => {
      const pi = R.part1[id];
      if (!pis.has(pi)) return -R.step * 2;
      return mk.fn(R.toLocal(pi, R.pointOf(id)), id, R) * (mk.scale || R.view.s);
    }, { outside: -R.step * 2 });
    const rings = shapesOf(R, f, { smooth: mk.smooth == null ? 2 : mk.smooth });
    if (!rings.length) return null;
    // clip to the visible region of the groups that own these parts
    const gis = new Set(R.parts.filter(p => pis.has(p.pi)).map(p => p.gi));
    const own = P.union(labelShapes.filter(l => gis.has(l.gi)).flatMap(l => P.normalize(l.rings)));
    if (!own.length) return null;
    const clip = doc.clip(D(own), { rule: 'nonzero' });
    const body = [path(D(rings), { 'clip-path': clip, fill: mk.color, opacity: mk.opacity == null ? 1 : mk.opacity, 'fill-rule': 'evenodd', filter: mk.blur ? doc.blur(mk.blur) : null, style: mk.blend ? `mix-blend-mode:${mk.blend}` : null })];
    if (mk.edge) for (const r of rings) { const [a, b] = L.band(r, mk.edgeWidth || 1.0 * lw, { step: 1.2 * lw }); body.push(path(G.polyD(a) + G.polyD(b), { 'clip-path': clip, fill: mk.edge, 'fill-rule': 'evenodd', opacity: mk.edgeOpacity || 0.9 })); }
    return body.join('');
  };
  for (const mk of (opt.markings || [])) if (mk.stage !== 'post') { const s = drawMarking(mk); if (s) out.push(s); }
  // extra flat overlays drawn under the shading (e.g. painted patterns) supplied by caller
  if (opt.underShade) out.push(opt.underShade);

  // ---------- 3. light & shadow families on toon materials ----------
  // Shading is computed per group on a sub-grid, the field is extended a few pixels past the
  // group edge and the result is clipped by the group's smooth region: no stair-steps at seams.
  const isToon = id => { const s = spec[R.mat1[id]]; return s && s.shading === 'toon'; };
  const lam = id => R.nx[id] * Lk[0] + R.ny[id] * Lk[1] + R.nz[id] * Lk[2];
  const shadowDist = opt.shadowDist || {}; // { groupName: max occluder distance in model units }
  const cast = opt.castShadows === false ? null : R.shadowMap(Lk, { bias: 1.2 * R.view.s / 5, maxDist: gi => { const v = shadowDist[R.groups[gi].name]; return v == null ? null : v * R.view.s; } });
  const ao = opt.ao === false ? null : R.ambientOcclusion(opt.aoRadius || 12);
  const rimW = (opt.rimWidth || 3.2) * lw;
  const sdist = R.silhouetteDistance();
  const shadowV = id => {
    const s = spec[R.mat1[id]];
    let v = (s.t0 - lam(id)) * K;
    if (cast && !s.noCast) v = Math.max(v, Math.min(cast[id], 4) * 3);
    return v;
  };
  // 'pinup': the anime-furry pin-up look — saturated base, one crisp cel shadow, sharp glossy highlights
  // with a soft halo and a thin rim; no terminator core, no deep gradient, almost no AO (they read as mud)
  const PIN = opt.style === 'pinup';
  const LAYERS = [
    // light colour on the lit side and ambient colour everywhere (warm torch, cold moon, fire...)
    light.keyColor && { fn: id => (lam(id) - spec[R.mat1[id]].t0) * K, fill: light.keyColor, opacity: light.keyOpacity == null ? 0.35 : light.keyOpacity, blur: 1.5 * lw, blend: light.keyBlend || 'multiply' },
    light.ambient && { fn: () => 10, fill: light.ambient, opacity: light.ambientOpacity == null ? 0.25 : light.ambientOpacity, blend: 'multiply' },
    // halftone: soft gradient on the turning side
    { fn: id => (spec[R.mat1[id]].t1 - lam(id)) * K, fill: tn => tn.mid, opacity: PIN ? 0.2 : 0.32, blur: 8 * lw },
    // extra scene darkening of the shadow side (backlight, night, fire from below)
    light.shadowExtra && { fn: shadowV, fill: light.shadowExtra, opacity: light.shadowExtraOpacity == null ? 0.6 : light.shadowExtraOpacity, blur: 0.8 * lw },
    // cel shadow (form + cast), slightly softened edge
    { fn: shadowV, fill: tn => tn.shadow, opacity: 1, blur: (PIN ? 0.4 : 0.6) * lw },
    // warm core band at the terminator on organic materials (subsurface scattering)
    !PIN && { fn: id => { const s = spec[R.mat1[id]]; if (!s.sss) return -K; const l = lam(id); return Math.min((s.t0 + 0.01 - l) * K, (l - (s.t0 - 0.12)) * K); }, fill: light.coreColor, opacity: 0.07, blur: 2.2 * lw, blend: 'normal' },
    // deep shadow gradient
    { fn: id => (-0.4 - lam(id)) * K, fill: tn => tn.deep, opacity: PIN ? 0.16 : 0.45, blur: 7 * lw },
    // ambient occlusion in creases and contacts
    ao && { fn: id => (ao[id] - 0.16) * 120, fill: light.aoColor, opacity: PIN ? 0.12 : 0.32, blur: 4 * lw },
    // reflected light from the floor inside the shadow
    { fn: id => Math.min(shadowV(id), (R.nx[id] * Lb[0] + R.ny[id] * Lb[1] + R.nz[id] * Lb[2] - 0.45) * K), fill: light.bounceColor, opacity: 0.2, blur: 5 * lw, blend: 'screen' },
    // soft key highlight
    !PIN && { fn: id => (lam(id) - 0.86) * K, fill: light.hiColor, opacity: 0.26, blur: 7 * lw, blend: 'screen', k: 'hiK' },
    // rim light: constant-width band along the silhouette on the side facing the back light
    { fn: id => {
      const facing = (R.nx[id] * Lr[0] + R.ny[id] * Lr[1] + R.nz[id] * Lr[2] - (spec[R.mat1[id]].rimT || 0.12)) * K;
      const edge = (rimW * (0.4 + 0.6 * Math.max(0, R.nx[id] * Lr[0] + R.ny[id] * Lr[1])) - sdist[id]) * 4;
      return Math.min(facing, edge);
    }, fill: light.rimColor, opacity: light.rimOpacity || 0.75, blur: 0.7 * lw, blend: 'screen', k: 'rimK' },
    // specular on glossy materials
    // pin-up gloss halo: a soft bloom around the sharp highlight (oiled / satin look)
    PIN && { fn: id => { const s = spec[R.mat1[id]]; if (!s.gloss) return -K; const nh = R.nx[id] * Hk[0] + R.ny[id] * Hk[1] + R.nz[id] * Hk[2]; return (nh - s.gloss + 0.045) * K * 3; }, fill: '#ffffff', opacity: 0.22, blur: 3 * lw, blend: 'screen', k: 'glossK' },
    { fn: id => { const s = spec[R.mat1[id]]; if (!s.gloss) return -K; const nh = R.nx[id] * Hk[0] + R.ny[id] * Hk[1] + R.nz[id] * Hk[2]; return (nh - s.gloss) * K * 3; }, fill: '#ffffff', opacity: PIN ? 0.92 : 0.75, blur: (PIN ? 0.45 : 0.9) * lw, blend: 'screen', k: 'glossK' },
  ].filter(Boolean);
  for (const lb of labelShapes.filter(l => l.spec.shading === 'toon')) {
    const gi = lb.gi, mid = lb.mid;
    const region = P.normalize(lb.rings);
    if (!region.length) continue;
    const clip = doc.clip(D(region), { rule: 'nonzero' });
    const box = subgrid(R, G.bbox(region), 4);
    const inG = id => R.g1[id] === gi && R.mat1[id] === mid;
    const layers = [];
    const tints = groupTints(lb.spec, light);
    for (const ly of LAYERS) {
      const f = box.field(ly.fn, inG, -K);
      const rings = M.shapes(f, box.W, box.H, { x0: box.x0, y0: box.y0, step: R.step, smooth: 2, eps: 0.2, minArea: 2 });
      if (!rings.length) continue;
      const fill = typeof ly.fill === 'function' ? ly.fill(tints) : ly.fill;
      const dark = Cc.lightness(lb.spec.fill) < 0.36 ? 0.45 : 1; // screen layers lift dark materials too much
      const opk = (ly.k && lb.spec[ly.k] != null ? lb.spec[ly.k] : 1) * (ly.blend === 'screen' && ly.k ? dark : 1);
      if (opk <= 0) continue;
      layers.push(path(D(rings), { 'clip-path': clip, fill, 'fill-rule': 'evenodd', opacity: ly.opacity * opk, filter: ly.blur ? doc.blur(ly.blur) : null, style: (ly.blend || 'multiply') === 'normal' ? null : `mix-blend-mode:${ly.blend || 'multiply'}` }));
    }
    out.push(...layers);
  }

  for (const mk of (opt.markings || [])) if (mk.stage === 'post') { const s = drawMarking(mk); if (s) out.push(s); }
  if (opt.postShade) out.push(typeof opt.postShade === 'function' ? opt.postShade() : opt.postShade);

  // ---------- 4. metals (matcap-like reflections) ----------
  const metalLabels = labelShapes.filter(l => l.spec.shading === 'metal');
  if (metalLabels.length) {
    const isMetal = id => { const s = spec[R.mat1[id]]; return s && s.shading === 'metal'; };
    const mclip = doc.clip(D(P.union(metalLabels.flatMap(l => P.normalize(l.rings)))), { rule: 'nonzero' });
    const ml = [];
    const metalLayer = (fn, colorFn, o) => {
      // one layer per metal material colour
      const mats = [...new Set(metalLabels.map(l => l.mid))];
      for (const mid of mats) {
        const sp = spec[mid];
        const rings = shapesOf(R, R.mapField(id => R.mat1[id] === mid ? fn(id) : -K, { where: isMetal, outside: -K }), { smooth: 2 });
        if (rings.length) ml.push(path(D(rings), { 'clip-path': mclip, fill: colorFn(sp), 'fill-rule': 'evenodd', ...o }));
      }
    };
    const env = id => R.ny[id] + 0.35 * R.nx[id] * Lk[0];
    metalLayer(id => (env(id) - 0.05) * K, sp => sp.ramp.deep, { opacity: 0.9 });
    metalLayer(id => (env(id) - 0.38) * K, sp => Cc.shift(sp.ramp.deep, { dL: -0.1 }), { opacity: 0.8 });
    metalLayer(id => (-env(id) - 0.42) * K, sp => sp.ramp.hi, { opacity: 0.95 });
    metalLayer(id => { const nh = R.nx[id] * Hk[0] + R.ny[id] * Hk[1] + R.nz[id] * Hk[2]; return (nh - 0.93) * K * 3; }, () => '#fffbe8', { opacity: 0.95, filter: doc.blur(0.6 * lw) });
    metalLayer(id => (R.nx[id] * Lr[0] + R.ny[id] * Lr[1] + R.nz[id] * Lr[2] - 0.35) * K, () => light.rimColor, { opacity: 0.7, style: 'mix-blend-mode:screen' });
    out.push(...ml);
  }

  // ---------- 5. lines ----------
  const lines = [];
  const lineCol = id => { const s = spec[R.mat1[id]]; return s ? s.lineColor : '#2a1f2e'; };
  // 5a. silhouette: thick, heavier on the side away from the light
  const silRings = shapesOf(R, R.cov, { smooth: 2 });
  const silW = (opt.silWidth || 3.6) * lw;
  const tuftSpecs = (opt.tufts || []).map(tf => ({ ...tf, pis: new Set(R.parts.filter(p => tf.parts.includes(p.name)).map(p => p.pi)) }));
  const tuftMask = (pts, nrm, tf, closed) => smoothMask(pts.map((p, i) => {
    const id = R.idAt(p[0] - nrm[i][0] * 2.2, p[1] - nrm[i][1] * 2.2);
    if (id < 0 || !tf.pis.has(R.part1[id])) return 0;
    return tf.where && !tf.where(nrm[i]) ? 0 : 1;
  }), 3, closed);
  const tuftFills = [];
  for (const ring of silRings) {
    let pts = G.resample(ring, 1.2 * lw, true);
    let nrm = L.leftNormals(pts, true);
    for (const tf of tuftSpecs) {
      const mask = tuftMask(pts, nrm, tf, true);
      if (!mask.some(v => v > 0.05)) continue;
      const tp = tuftify(pts, nrm, mask, tf);
      const spikes = P.open(P.xor([tp], [pts]), 0.25);
      const mi = mask.findIndex(v => v > 0.5), mp = pts[Math.max(0, mi)];
      const id = R.idAt(mp[0] - nrm[Math.max(0, mi)][0] * 2.5, mp[1] - nrm[Math.max(0, mi)][1] * 2.5);
      const col = tf.color || (id >= 0 && R.mat1[id] >= 0 ? spec[R.mat1[id]].fill : '#888');
      // split spikes into lit and shadowed by the shading at their root
      for (const sp of spikes) {
        const c0 = sp.reduce((a, q) => [a[0] + q[0] / sp.length, a[1] + q[1] / sp.length], [0, 0]);
        let best = null, bd = 1e9; for (let i = 0; i < pts.length; i += 2) { const d = G.d2(pts[i], c0); if (d < bd) { bd = d; best = i; } }
        const rid = best == null ? -1 : R.idAt(pts[best][0] - nrm[best][0] * 2.5, pts[best][1] - nrm[best][1] * 2.5);
        const inShadow = rid >= 0 && R.g1[rid] >= 0 && isToon(rid) && shadowV(rid) > 0;
        const fc = inShadow ? Cc.multiply(col, groupTints(spec[R.mat1[rid]], light).shadow, 1) : col;
        tuftFills.push(path(G.polyD(sp), { fill: fc, stroke: fc, 'stroke-width': 0.6 }));
      }
      pts = tp; nrm = L.leftNormals(pts, true);
    }
    // colour runs by the material just inside
    const cols = pts.map((p, i) => { const id = R.idAt(p[0] - nrm[i][0] * 1.5, p[1] - nrm[i][1] * 1.5); return id >= 0 && R.g1[id] >= 0 ? lineCol(id) : null; });
    // tuft tips sit outside every material: give them the colour of the nearest coloured point on the ring
    if (cols.some(c => c == null) && cols.some(Boolean)) {
      const n = cols.length, fw = new Array(n).fill(null), bw = new Array(n).fill(null);
      let last = null, dl = 0;
      for (let k = 0; k < 2 * n; k++) { const i = k % n; if (cols[i]) { last = cols[i]; dl = 0; } else if (last) { dl++; if (k >= n || !fw[i]) fw[i] = [last, dl]; } }
      last = null; dl = 0;
      for (let k = 2 * n - 1; k >= 0; k--) { const i = k % n; if (cols[i]) { last = cols[i]; dl = 0; } else if (last) { dl++; if (k < n || !bw[i]) bw[i] = [last, dl]; } }
      for (let i = 0; i < n; i++) if (!cols[i]) { const a = fw[i], b = bw[i]; cols[i] = a && b ? (a[1] <= b[1] ? a[0] : b[0]) : (a || b)[0]; }
    }
    const width = i => { const sh = Math.max(0, -(nrm[i][0] * L2[0] + nrm[i][1] * L2[1])); return silW * (0.68 + 0.62 * sh) * (1 + 0.08 * G.noise1(i * 0.07)); };
    const colorsUsed = [...new Set(cols.filter(Boolean))];
    if (colorsUsed.length <= 1) {
      const [o, inn] = L.band(pts, (i) => width(i), { step: 0, bias: 0.15 });
      lines.push(path(G.polyD(o) + G.polyD(inn), { fill: colorsUsed[0] || '#2a1f2e', 'fill-rule': 'evenodd' }));
    } else {
      for (const col of colorsUsed) {
        for (const run of L.runs(pts.length, i => cols[i] === col || (cols[i] == null && cols[(i + 1) % pts.length] === col), 2)) {
          const idx = run.closed ? run.idx.concat([run.idx[0]]) : [run.idx[0] > 0 ? run.idx[0] - 1 : pts.length - 1, ...run.idx, (run.idx[run.idx.length - 1] + 1) % pts.length];
          const seg = idx.map(i => [pts[i][0] + nrm[i][0] * 0.15 * width(i), pts[i][1] + nrm[i][1] * 0.15 * width(i)]);
          lines.push(path(G.polyD(L.taper(seg, (t, k) => width(idx[Math.min(k, idx.length - 1)]), { profile: L.taperProfile({ start: 0.0, end: 0.0 }), step: 0, smooth: false })), { fill: col, 'stroke': col, 'stroke-width': 0.4 }));
        }
      }
    }
  }
  // 5b. occluding contours from each part's rim over a farther surface
  const occW = (opt.occWidth || 2.4) * lw;
  const tau0 = (opt.tau0 || 2.5) * Math.max(1, R.view.s / 4), tau1 = (opt.tau1 || 14) * Math.max(1, R.view.s / 4);
  for (const part of R.parts) {
    if (part.noLine) continue;
    const pf = partField(R, part.pi);
    if (!pf) continue;
    const rings = M.shapes(pf.f, pf.W, pf.H, { x0: pf.x0, y0: pf.y0, step: R.step, smooth: 2, eps: 0.2, minArea: 4 });
    for (const ring of rings) {
      const pts = G.resample(ring, 1.2 * lw, true);
      const nrm = L.leftNormals(pts, true);
      const gap = pts.map((p, i) => {
        const pin = [p[0] - nrm[i][0] * 0.9, p[1] - nrm[i][1] * 0.9], pout = [p[0] + nrm[i][0] * 1.6, p[1] + nrm[i][1] * 1.6];
        const h = R.partAt(part.pi, pin[0], pin[1]);
        if (!h) return null;
        const zg = R.depthAt(pin[0], pin[1]);
        if (zg > NEG && h.z < zg - 0.9 * R.step) return null; // hidden behind something else (or blended away)
        const zo = R.depthAt(pout[0], pout[1]);
        if (zo <= NEG) return null; // silhouette: drawn by 5a
        return h.z - zo;
      });
      const always = pts.map((p, i) => {
        if (gap[i] == null) return false;
        const oid = R.idAt(p[0] + nrm[i][0] * 1.6, p[1] + nrm[i][1] * 1.6);
        if (oid < 0 || R.g1[oid] < 0 || R.g1[oid] === part.gi) return false;
        // 'always' groups get their minimum line from the visible-region pass (5b') below
        return false;
      });
      const wAt = i => gap[i] == null ? 0 : Math.max(always[i] ? 0.5 * occW : 0, occW * G.smoothstep(tau0, tau1, gap[i]));
      for (const run of L.runs(pts.length, i => wAt(i) > 0.12 * occW, 3)) {
        const idx = run.idx;
        let seg = idx.map(i => pts[i]);
        for (const tf of tuftSpecs) {
          if (!tf.pis.has(part.pi) || tf.inner === false) continue;
          const sn = idx.map(i => nrm[i]);
          const mask = smoothMask(sn.map((n, k) => (tf.where && !tf.where(n) ? 0 : 1) * Math.min(1, k / 4, (idx.length - 1 - k) / 4)), 2, false);
          const tp = tuftify(seg, sn, mask, tf);
          const fillPoly = seg.concat(tp.slice().reverse());
          const mid = idx[Math.floor(idx.length / 2)], pm2 = pts[mid];
          const rid = R.idAt(pm2[0] - nrm[mid][0] * 2.5, pm2[1] - nrm[mid][1] * 2.5);
          const fcol0 = tf.color || spec[part.mid].fill;
          const fcol = rid >= 0 && R.g1[rid] >= 0 && isToon(rid) && shadowV(rid) > 0 ? Cc.multiply(fcol0, groupTints(spec[part.mid], light).shadow, 1) : fcol0;
          tuftFills.push(path(G.polyD(fillPoly), { fill: fcol, stroke: fcol, 'stroke-width': 0.5 }));
          seg = tp;
        }
        const mid = idx[Math.floor(idx.length / 2)], pm = pts[mid];
        const id = R.idAt(pm[0] - nrm[mid][0] * 2, pm[1] - nrm[mid][1] * 2);
        const col = id >= 0 && R.g1[id] >= 0 ? lineCol(id) : '#2a1f2e';
        lines.push(path(G.polyD(L.taper(seg, (t, k) => wAt(idx[Math.min(k, idx.length - 1)]), { profile: L.taperProfile({ start: run.closed ? 0 : 0.12, end: run.closed ? 0 : 0.12 }), step: 0 })), { fill: col }));
      }
    }
  }
  // 5b'. groups that always get a line (locks, fingers, coins): trace the boundary of the *visible* region,
  // so a lock sunk into the cap gets a clean line along the intersection instead of a dashed rim
  R.groups.forEach((grp, gi) => {
    if (grp.line !== 'always') return;
    const bb = [1e9, 1e9, -1e9, -1e9];
    for (const part of R.parts) if (part.gi === gi && part.bb) { bb[0] = Math.min(bb[0], part.bb[0]); bb[1] = Math.min(bb[1], part.bb[1]); bb[2] = Math.max(bb[2], part.bb[2]); bb[3] = Math.max(bb[3], part.bb[3]); }
    if (bb[2] < bb[0]) return;
    const i0 = Math.max(0, Math.floor(R.gx(bb[0])) - 3), i1 = Math.min(R.W - 1, Math.ceil(R.gx(bb[2])) + 3);
    const j0 = Math.max(0, Math.floor(R.gy(bb[1])) - 3), j1 = Math.min(R.H - 1, Math.ceil(R.gy(bb[3])) + 3);
    if (i1 <= i0 || j1 <= j0) return;
    const W = i1 - i0 + 1, H = j1 - j0 + 1, f = new Float32Array(W * H);
    let any = false;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const id = (j + j0) * R.W + (i + i0);
      let v;
      if (R.g1[id] === gi) { v = R.g2[id] >= 0 ? Math.min(R.f1[id], R.z1[id] - R.z2[id]) : R.f1[id]; any = true; }
      else if (R.g2[id] === gi) v = R.z2[id] - R.z1[id];
      else v = -2 * R.step;
      f[j * W + i] = v;
    }
    if (!any) return;
    const rings = M.shapes(f, W, H, { x0: R.px(i0), y0: R.py(j0), step: R.step, smooth: 2, eps: 0.2, minArea: 3 });
    for (const ring of rings) {
      const pts = G.resample(ring, 1.2 * lw, true);
      const nrm = L.leftNormals(pts, true);
      const inner = pts.map((p, i) => { const oid = R.idAt(p[0] + nrm[i][0] * 1.6, p[1] + nrm[i][1] * 1.6); return oid >= 0 && R.g1[oid] >= 0 && R.g1[oid] !== gi; });
      for (const run of L.runs(pts.length, i => inner[i], 3)) {
        const idx = run.idx, seg = idx.map(i => pts[i]);
        const mid = idx[Math.floor(idx.length / 2)], pm = pts[mid];
        const id = R.idAt(pm[0] - nrm[mid][0] * 2, pm[1] - nrm[mid][1] * 2);
        const col = id >= 0 && R.g1[id] >= 0 ? lineCol(id) : '#2a1f2e';
        const wv = (grp.lineK || 0.5) * occW;
        lines.push(path(G.polyD(L.taper(seg, wv, { profile: L.taperProfile({ start: run.closed ? 0 : 0.15, end: run.closed ? 0 : 0.15 }), step: 0 })), { fill: col }));
      }
    }
  });
  // 5c. material edges inside a group (collar edge, dress hem...)
  const edgeW = (opt.edgeWidth || 1.15) * lw;
  for (const ls of labelShapes) {
    if (!ls.spec.edgeLine) continue;
    for (const ring of ls.rings) {
      const pts = G.resample(ring, 1.2 * lw, true);
      const nrm = L.leftNormals(pts, true);
      const ok = pts.map((p, i) => {
        const id = R.idAt(p[0] + nrm[i][0] * 1.6, p[1] + nrm[i][1] * 1.6);
        if (id < 0 || R.g1[id] < 0 || R.f1[id] <= 0) return false;
        if (R.g1[id] !== ls.gi) return false;
        const other = R.mat1[id];
        if (other === ls.mid) return false;
        // draw the edge once: from the nearer material, or from the one with edgeLine when the other has none
        const os = spec[other];
        return !(os && os.edgeLine && ls.zavg < labels.find(l => l.gi === ls.gi && l.mid === other)?.zavg);
      });
      for (const run of L.runs(pts.length, i => ok[i], 3)) {
        const seg = run.idx.map(i => pts[i]);
        lines.push(path(G.polyD(L.taper(seg, edgeW, { profile: L.taperProfile({ start: 0.15, end: 0.15 }), step: 0 })), { fill: ls.spec.lineColor }));
      }
    }
  }
  out.push(g({ class: 'tufts' }, tuftFills));
  out.push(g({ class: 'lines' }, lines));
  const svg = g({ class: opt.name || 'figure' }, out);
  if (opt.add !== false) doc.add(layer, svg);
  return { svg, labelShapes, silhouette: silRings, allShape, clip: allClip, cast, spec };
}

// Multiply tints that turn a group's dominant material into its own hue-shifted ramp colours,
// pulled a little toward the scene tint so every material still shares one light.
function groupTints(spec, light) {
  const base = Cc.hexToRgb(spec.fill), sceneT = Cc.hexToRgb(light.tint);
  const ratio = (target, k) => {
    const t = Cc.hexToRgb(target);
    return Cc.rgbToHex(t.map((v, i) => {
      const r = Math.min(1, v / Math.max(0.03, base[i]));
      return r * (1 - k) + sceneT[i] * k;
    }));
  };
  const r = spec.ramp;
  return { shadow: spec.shadowTint || ratio(r.shadow, 0.18), mid: ratio(r.mid, 0.1), deep: ratio(r.deep, 0.2) };
}

// Fur tufts: displace a run of contour points into curved spikes. mask[i] in [0,1] says where.
function tuftify(pts, nrm, mask, { amp = 6, period = 7, flow = [0, 1], lean = 0.6, seed = 0 } = {}) {
  const out = []; let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += G.d2(pts[i - 1], pts[i]);
    const m = mask[i];
    if (m <= 0) { out.push(pts[i]); continue; }
    const k = Math.floor(s / period + seed), ph = s / period + seed - k;
    const a = amp * (0.7 + 0.6 * G.hash1(k * 7.3 + seed));
    const prof = ph < 0.72 ? Math.pow(ph / 0.72, 1.7) : Math.pow((1 - ph) / 0.28, 0.9);
    const n = nrm[i];
    // lean the tips along the flow direction (tangential part only)
    const fdot = flow[0] * n[0] + flow[1] * n[1];
    const ft = [flow[0] - n[0] * fdot, flow[1] - n[1] * fdot];
    // the tip bends further along the flow than the base: curved, flame-like tufts
    const bendK = lean * (0.35 + 0.9 * prof);
    const dx = n[0] + ft[0] * bendK, dy = n[1] + ft[1] * bendK;
    out.push([pts[i][0] + dx * a * prof * m, pts[i][1] + dy * a * prof * m]);
  }
  return out;
}
function smoothMask(mask, it = 3, closed = true) {
  let m = mask.slice(); const n = m.length;
  for (let k = 0; k < it; k++) { const o = m.slice(); for (let i = 0; i < n; i++) { const a = closed ? m[(i - 1 + n) % n] : m[Math.max(0, i - 1)], b = closed ? m[(i + 1) % n] : m[Math.min(n - 1, i + 1)]; o[i] = (a + 2 * m[i] + b) / 4; } m = o; }
  return m;
}

// Sub-grid over a bbox: evaluate fn on pixels where mask holds, then extend values 3 px outward
// (average of filled neighbours) so iso-lines stay smooth where the region is clipped.
function subgrid(R, bb, pad = 4) {
  const i0 = Math.max(0, Math.floor(R.gx(bb[0])) - pad), i1 = Math.min(R.W - 1, Math.ceil(R.gx(bb[2])) + pad);
  const j0 = Math.max(0, Math.floor(R.gy(bb[1])) - pad), j1 = Math.min(R.H - 1, Math.ceil(R.gy(bb[3])) + pad);
  const W = Math.max(1, i1 - i0 + 1), H = Math.max(1, j1 - j0 + 1);
  return {
    W, H, x0: R.px(i0), y0: R.py(j0),
    field(fn, mask, outside = -30, grow = 3) {
      const f = new Float32Array(W * H).fill(outside), ok = new Uint8Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const id = (j + j0) * R.W + (i + i0);
        if (R.g1[id] >= 0 && mask(id)) { f[j * W + i] = fn(id); ok[j * W + i] = 1; }
      }
      for (let it = 0; it < grow; it++) {
        const add = [];
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const k = j * W + i; if (ok[k]) continue;
          let s = 0, n = 0;
          if (i > 0 && ok[k - 1]) { s += f[k - 1]; n++; } if (i < W - 1 && ok[k + 1]) { s += f[k + 1]; n++; }
          if (j > 0 && ok[k - W]) { s += f[k - W]; n++; } if (j < H - 1 && ok[k + W]) { s += f[k + W]; n++; }
          if (n) add.push([k, s / n]);
        }
        for (const [k, v] of add) { f[k] = v; ok[k] = 1; }
      }
      return f;
    },
  };
}

// Coverage field of a single part over its bbox (aligned to the raster grid).
function partField(R, pi) {
  const part = R.parts[pi];
  const i0 = Math.max(0, Math.floor(R.gx(part.bb[0])) - 2), i1 = Math.min(R.W - 1, Math.ceil(R.gx(part.bb[2])) + 2);
  const j0 = Math.max(0, Math.floor(R.gy(part.bb[1])) - 2), j1 = Math.min(R.H - 1, Math.ceil(R.gy(part.bb[3])) + 2);
  if (i1 <= i0 || j1 <= j0) return null;
  const W = i1 - i0 + 1, H = j1 - j0 + 1, f = new Float32Array(W * H).fill(-5);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = R.px(i + i0), y = R.py(j + j0);
    let best = -5;
    for (const pp of part.pp) {
      if (x < pp.bb[0] - 2 || x > pp.bb[2] + 2 || y < pp.bb[1] - 2 || y > pp.bb[3] + 2) continue;
      const h = R.hit(pp, part, x, y);
      if (h.f > best) best = h.f;
    }
    f[j * W + i] = best;
  }
  return { f, W, H, x0: R.px(i0), y0: R.py(j0) };
}

module.exports = { figure, partField, subgrid, DEF_LIGHT, materialSpec, shapesOf };
