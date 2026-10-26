'use strict';
// 1:1 avatar icon: head and shoulders filling the frame, signature expression, accent background.
//   node art/scenes/icon.js nefer
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const { Doc } = require('../lib/svg');
const F = require('../lib/figure');
const { toView, viewOf } = require('../lib/raster');

function icon(ch, { size = 640 } = {}) {
  const doc = new Doc(size, size, { title: `${ch.title} — иконка`, bg: '#1b1730' });
  const ic = ch.icon || {};
  const accent = ic.accent || ch.bgAccent || '#6f8cff';
  const bg = doc.radial([[0, ic.bgInner || '#3c3466'], [0.7, ic.bgMid || '#221c3e'], [1, '#120f22']], { cx: 0.42, cy: 0.38, r: 0.75 });
  doc.add('bg', `<rect width="${size}" height="${size}" fill="${bg}"/>`);
  doc.add('bg', `<circle cx="${size * 0.62}" cy="${size * 0.3}" r="${size * 0.36}" fill="${accent}" opacity="0.28" filter="${doc.blur(size * 0.08)}" style="mix-blend-mode:screen"/>`);
  // a ring motif behind the head (sun disk), cropped by the frame
  doc.add('bg', `<circle cx="${size * 0.5}" cy="${size * 0.44}" r="${size * 0.4}" fill="none" stroke="${ic.ring || '#d9a640'}" stroke-width="${size * 0.012}" opacity="0.55"/>`);
  const pose = ch.poses[ic.pose || 'bust'] || ch.poses.bust;
  const expr = ch.expressions[ic.expr || 'smirk'] || {};
  const p2 = { ...pose, head: { ...(pose.head || {}), ...(expr.head || {}), ...(ic.head || {}) }, hide: ['legL', 'legR', ...(pose.hide || [])] };
  const probe = F.build(ch, { pose: p2, expr });
  const s = ic.scale || (size / (probe.head.R * (ic.zoom || 5.6)));
  const v = { yaw: ic.yaw != null ? ic.yaw : -0.35, pitch: 0, s };
  const c = toView(viewOf(v), probe.head.anchors.cranium);
  v.ox = size * (ic.cx || 0.5) - c[0]; v.oy = size * (ic.cy || 0.47) - c[1];
  const light = { key: [-0.6, -0.55, 0.58], rim: [0.9, -0.3, -0.35], rimOpacity: 0.9, rimColor: ic.rimColor || '#bfe4ff', ...(ch.light || {}) };
  F.render(doc, ch, { pose: p2, expr, view: v, box: { x0: 0, y0: 0, w: size, h: size }, step: 0.75, light, lineScale: Math.max(1, s / 8) });
  const vig = doc.radial([[0.6, '#000', 0], [1, '#000', 0.5]], { cx: 0.5, cy: 0.5, r: 0.72 });
  doc.add('fx', `<rect width="${size}" height="${size}" fill="${vig}"/>`);
  doc.crop('face', [size * 0.2, size * 0.12, size * 0.6, size * 0.6]);
  return doc;
}

if (require.main === module) {
  const name = process.argv[2] || 'nefer';
  const ch = require('../chars/' + name);
  const out = process.argv[3] || path.join(__dirname, '..', 'final', name, `${name}_icon.svg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, icon(ch).toString());
  console.log(out);
}
module.exports = { icon };
