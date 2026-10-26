'use strict';
// Half-body illustration (4:5) of one heroine.
//   node art/scenes/halfbody.js nefer [out.svg]
const path = require('path');
const fs = require('fs');
const G = require('../lib/geom');
const { Doc } = require('../lib/svg');
const F = require('../lib/figure');

function compose(ch, { expr = 'smirk', W = 1000, H = 1250, view, bg = null } = {}) {
  const doc = new Doc(W, H, { title: `${ch.title} — поясной портрет`, bg: '#1b1830' });
  const sc = ch.halfbodyView || {};
  const v = { yaw: -0.5, pitch: 0.0, s: 11, ox: 500, oy: 1000, ...sc, ...(view || {}) };
  if (bg) bg(doc, ch, v);
  const light = { key: [-0.62, -0.55, 0.56], rim: [0.9, -0.3, -0.35], ...(ch.light || {}) };
  const r = F.render(doc, ch, { pose: ch.poses.halfbody, expr: ch.expressions[expr] || ch.expressions.neutral, view: v, box: { x0: 0, y0: 0, w: W, h: H }, step: 1, light, lineScale: 1.15 });
  // QA crops: face and hands
  const hc = r.Rs.project(r.head.anchors.cranium);
  const fr = r.head.R * v.s * 2.4;
  doc.crop('face', [hc[0] - fr * 0.75, hc[1] - fr * 0.7, fr * 1.5, fr * 1.4]);
  const hands = ['L', 'R'].map(s => r.body.anchors['hand' + s]).filter(Boolean).map(t => r.Rs.project(G.tapply(t, [0, 6, 0])));
  if (hands.length) {
    const xs = hands.map(p => p[0]), ys = hands.map(p => p[1]);
    const x0 = Math.max(0, Math.min(...xs) - 120), y0 = Math.max(0, Math.min(...ys) - 120);
    doc.crop('hands', [x0, y0, Math.min(W - x0, Math.max(...xs) - x0 + 120), Math.min(H - y0, Math.max(...ys) - y0 + 120)]);
  }
  return { doc, r };
}

if (require.main === module) {
  const name = process.argv[2] || 'nefer';
  const ch = require('../chars/' + name);
  const out = process.argv[3] || path.join(__dirname, '..', 'final', name, `${name}_halfbody.svg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const t0 = Date.now();
  const scene = require('./temple');
  const { doc } = compose(ch, { expr: process.argv[4] || ch.halfbodyExpr || 'smirk', bg: scene.background });
  fs.writeFileSync(out, doc.toString());
  console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's', (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
}
module.exports = { compose };
