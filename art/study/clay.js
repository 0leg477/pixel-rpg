'use strict';
// Clay render of a heroine straight from the raster (normals + depth, no lines, no paint): the same kind
// of image as a sculpt preview, so the forms can be compared with 3D reference models.
//   node art/study/clay.js nefer out_prefix [focus=full|head|torso] [yaws=0,-0.62,-1.5708,3.1416] [pose=ref]
const fs = require('fs');
const G = require('../lib/geom');
const F = require('../lib/figure');
const { Raster, viewOf, toView } = require('../lib/raster');

const [name = 'nefer', out = 'clay', focus = 'full', yawsArg = '0,-0.62,-1.5708,3.1416', poseName = 'ref'] = process.argv.slice(2);
const ch = require('../chars/' + name);
const pose = { ...(ch.poses[poseName] || ch.poses.ref) };
const expr = ch.expressions.neutral || {};
const b = F.build(ch, { pose, expr });
// figure extents in model space: head top (with ears) to the ground
const crown = G.add(b.head.anchors.cranium, G.mvec(b.head.frame.R, [0, -b.head.R * 1.0, 0]));
const top = G.add(b.head.anchors.cranium, G.mvec(b.head.frame.R, [0, -b.head.R * 2.0, 0]));
const ground = [0, b.body.spec.groundY + 1, 0];
const Hm = ground[1] - top[1];
const W = +(process.env.VW || 700), H = +(process.env.VH || 1000);
let target, span;
if (focus === 'head') { target = G.add(b.head.anchors.cranium, [0, b.head.R * 0.1, 0]); span = Hm * 0.27; }
else if (focus === 'torso') { target = [0, top[1] + Hm * 0.38, 0]; span = Hm * 0.52; }
else { target = [0, (top[1] + ground[1]) / 2, 0]; span = Hm * 1.08; }
const L = G.norm([-0.45, -0.6, 0.65]);
for (const [i, yaw] of yawsArg.split(',').map(Number).entries()) {
  const s = H / span;
  const v0 = viewOf({ yaw, s, ox: 0, oy: 0 });
  const c = toView(v0, target);
  const view = viewOf({ yaw, s, ox: W / 2 - c[0], oy: H / 2 - c[1] });
  const R = new Raster({ x0: 0, y0: 0, w: W, h: H, step: 1 }).render(b.model, view);
  const buf = Buffer.alloc(W * H * 3);
  const Lv = G.mvec(view.R, L);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = R.idAt(x, y), o = (y * W + x) * 3;
    let col = [217, 212, 204];
    if (id >= 0 && R.g1[id] >= 0) {
      const n = [R.nx[id], R.ny[id], R.nz[id]];
      const lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const hemi = 0.5 + 0.5 * -n[1];
      const k = 0.32 + 0.5 * lam + 0.22 * hemi;
      col = [201 * k, 184 * k, 166 * k].map(v => Math.min(255, v));
    }
    buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2];
  }
  fs.writeFileSync(`${out}_${i}.ppm`, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), buf]));
}
console.log(out);
