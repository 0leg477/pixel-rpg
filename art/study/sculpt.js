'use strict';
// Build a heroine as smooth SDF meshes (body / hair / accessories) and save a .glb for a 3D clay preview.
//   node art/study/sculpt.js nefer out.glb [pose=ref] [h=0.45]
const fs = require('fs');
const G = require('../lib/geom');
const F = require('../lib/figure');
const S = require('../lib/sdf');

const [name = 'nefer', out = 'sculpt.glb', poseName = 'ref', hArg = '0.45'] = process.argv.slice(2);
const ch = require('../chars/' + name);
const pose = { ...(ch.poses[poseName] || ch.poses.ref), hide: [] };
const b = F.build(ch, { pose, expr: ch.expressions.neutral || {} });
const t0 = Date.now();
const meshes = S.sculpt(b.model, { h: +hArg, only: process.env.SETS ? process.env.SETS.split(',') : null });
for (const m of meshes) {
  // model space is y-down with the face toward +z: a 180° turn about z gives glTF's y-up with the face
  // still toward +z (a proper rotation, so neither the figure nor the winding is mirrored)
  m.verts = m.verts.map(v => [-v[0], -v[1], v[2]]);
  m.normals = m.normals.map(n => [-n[0], -n[1], n[2]]);
  console.log(m.name, 'verts', m.verts.length, 'tris', m.tris.length / 3, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
fs.writeFileSync(out, S.writeGLB(meshes));
console.log(out);
