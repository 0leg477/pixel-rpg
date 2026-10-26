'use strict';
// Anatomy check sheet: one heroine in the reference pose seen front / 3/4 / side / back-3/4, framed from
// the ears to mid-thigh, so head, bust and waist shapes can be judged from several angles at once.
//   node art/study/anatomy.js nefer [out.svg]
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const { Doc } = require('../lib/svg');
const F = require('../lib/figure');
const { toView, viewOf } = require('../lib/raster');

const name = process.argv[2] || 'nefer';
const ch = require('../chars/' + name);
const views = [['анфас', 0], ['3/4', -0.62], ['профиль', -1.5], ['со спины 3/4', -2.5]];
const CW = 560, CH = 900, TOP = 70;
const doc = new Doc(CW * views.length, CH + TOP, { title: `${ch.title} — анатомия`, bg: '#d9d4cc' });
doc.add('bg', `<rect width="${CW * views.length}" height="${CH + TOP}" fill="#d9d4cc"/>`);
doc.add('ui', `<text x="20" y="44" font-family="DejaVu Sans, sans-serif" font-size="26" fill="#2a2235">${ch.title}: голова, грудь, талия — четыре ракурса</text>`);
const pose = ch.poses.ref, expr = ch.expressions.neutral || {};
const probe = F.build(ch, { pose, expr });
const top = G.add(probe.head.anchors.cranium, [0, -probe.head.R * 1.6, 0]);
const bottom = G.tapply(probe.body.anchors.pelvisT, [0, 26, 0]);
views.forEach(([label, yaw], i) => {
  const v0 = viewOf({ yaw, s: 1, ox: 0, oy: 0 });
  const a = toView(v0, top), b = toView(v0, bottom);
  const s = (CH - 40) / (b[1] - a[1]);
  const c = toView(v0, G.lerp(top, bottom, 0.5));
  const v = { yaw, s, ox: i * CW + CW / 2 - c[0] * s, oy: TOP + CH / 2 - c[1] * s };
  F.render(doc, ch, { pose, expr, view: v, box: { x0: i * CW, y0: TOP, w: CW, h: CH }, step: 1, light: { key: [-0.55, -0.55, 0.62], rim: [0.9, -0.3, -0.35] }, lineScale: Math.max(0.8, s / 7) });
  doc.add('ui', `<text x="${i * CW + 16}" y="${TOP + 28}" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#2a2235">${label}</text>`);
});
const out = process.argv[3] || path.join(__dirname, `anatomy_${name}.svg`);
fs.writeFileSync(out, doc.toString());
console.log(out);
