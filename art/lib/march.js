'use strict';
// Marching squares: scalar grid -> closed rings around the region where f > iso.
// Rings are oriented with the inside on the visual right (y-down screen), so the outward normal is the left.
const G = require('./geom');

function contours(f, W, H, { x0 = 0, y0 = 0, step = 1, iso = 0 } = {}) {
  // padded accessor: outside the grid counts as empty
  const v = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? -1e9 : f[j * W + i] - iso;
  const PW = W + 2; // edge id space for padded cells i,j in [-1, W]
  const hid = (i, j) => ((j + 1) * (PW + 1) + (i + 1)) * 2;      // edge (i,j)-(i+1,j)
  const vid = (i, j) => ((j + 1) * (PW + 1) + (i + 1)) * 2 + 1;  // edge (i,j)-(i,j+1)
  const segs = new Map(); // startEdge -> [endEdge, startPt, endPt]
  const X = i => x0 + i * step, Y = j => y0 + j * step;
  const interp = (pa, pb, va, vb) => { const t = va / (va - vb); return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]; };
  for (let j = -1; j < H; j++) {
    for (let i = -1; i < W; i++) {
      const vals = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)]; // TL TR BR BL (clockwise)
      const ins = vals.map(x => x > 0);
      if (ins[0] === ins[1] && ins[1] === ins[2] && ins[2] === ins[3]) continue;
      const pts = [[X(i), Y(j)], [X(i + 1), Y(j)], [X(i + 1), Y(j + 1)], [X(i), Y(j + 1)]];
      const eid = [hid(i, j), vid(i + 1, j), hid(i, j + 1), vid(i, j)];
      const ept = k => interp(pts[k], pts[(k + 1) % 4], vals[k], vals[(k + 1) % 4]);
      // orientation is combinatorial: a segment runs from an exit edge (in->out clockwise) to an entry edge
      const exits = [], entries = [];
      for (let k = 0; k < 4; k++) {
        const a = ins[k], b = ins[(k + 1) % 4];
        if (a && !b) exits.push(k); else if (!a && b) entries.push(k);
      }
      const link = (ex, en) => segs.set(eid[ex], [eid[en], ept(ex), ept(en)]);
      if (exits.length === 1) link(exits[0], entries[0]);
      else {
        const center = (vals[0] + vals[1] + vals[2] + vals[3]) / 4 > 0;
        for (let k = 0; k < 4; k++) {
          if (center && !ins[k]) link((k + 3) % 4, k);       // outside corner cut off
          if (!center && ins[k]) link(k, (k + 3) % 4);       // inside corner cut off
        }
      }
    }
  }
  const rings = [];
  while (segs.size) {
    const [start] = segs.keys();
    const ring = [];
    let k = start, guard = 0;
    while (segs.has(k) && guard++ < 1e7) {
      const [nk, sp] = segs.get(k); segs.delete(k); ring.push(sp); k = nk;
    }
    if (ring.length > 2) rings.push(ring);
  }
  return rings;
}

// Contours + cleanup: drop tiny islands, smooth and simplify.
function shapes(f, W, H, opt = {}) {
  const { minArea = 4, smooth = 2, eps = 0.18, step = 1 } = opt;
  let rings = contours(f, W, H, opt);
  rings = rings.filter(r => Math.abs(G.signedArea(r)) >= minArea);
  return rings.map(r => {
    let p = r;
    if (smooth) p = G.laplace(p, smooth, 0.5, true);
    return G.rdpClosed(p, eps * step);
  }).filter(r => r.length > 2);
}

module.exports = { contours, shapes };
