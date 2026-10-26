'use strict';
// Exercise 5: one head (Nefer) under three light schemes: warm key, cold back light, fire from below.
const fs = require('fs');
const path = require('path');
const { Doc } = require('../lib/svg');
const F = require('../lib/figure');
const { toView, viewOf } = require('../lib/raster');
const ch = require('../chars/nefer');

const SCHEMES = [
  ['тёплый ключевой (факел слева сверху)', { key: [-0.62, -0.55, 0.56], rim: [0.9, -0.3, -0.35], tint: '#a98fc6', keyColor: '#ffe2b8', keyOpacity: 0.3, rimColor: '#ffd9a6', rimOpacity: 0.5 }, ['#3d2a2e', '#1a1424'], '#ffb45c'],
  ['холодный контровой (луна сзади справа)', { key: [0.78, -0.35, -0.45], rim: [0.85, -0.3, -0.42], tint: '#6f7fbf', keyColor: '#cfe0ff', keyOpacity: 0.5, rimColor: '#c6e6ff', rimOpacity: 1, rimWidth: 7, ambient: '#9aa6d6', ambientOpacity: 0.35, shadowExtra: '#3a4478', shadowExtraOpacity: 0.75 }, ['#0e1530', '#1c2850'], '#8fb8ff'],
  ['снизу от огня (жуткий ракурс FNAF)', { key: [0.05, 0.9, 0.45], rim: [-0.6, 0.6, -0.5], tint: '#8a4a7a', keyColor: '#ff9a4a', keyOpacity: 0.45, rimColor: '#ff7a3a', rimOpacity: 0.7, ambient: '#7a4a6a', ambientOpacity: 0.3, bounce: [0, -1, 0.2], bounceColor: '#5a6aa8', shadowExtra: '#3a1838', shadowExtraOpacity: 0.7 }, ['#140a12', '#3a1a12'], '#ff7a2a'],
];
const CW = 620, CH = 760, TOP = 110;

function sheet() {
  const doc = new Doc(CW * 3, TOP + CH, { title: 'Одна голова при трёх схемах света', bg: '#1d1828' });
  doc.add('ui', `<text x="24" y="52" font-family="DejaVu Sans, sans-serif" font-size="30" fill="#f2e6cf">Упражнение 5. Одна голова — три схемы света</text>`);
  doc.add('ui', `<text x="24" y="86" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#b9add0">Один источник на сцену: тени, падающие тени, контровой и рефлекс согласованы с ним. Меняется направление и цвет света.</text>`);
  SCHEMES.forEach(([name, light, bg, glow], k) => {
    const x0 = k * CW, y0 = TOP;
    const grad = doc.linear([[0, bg[0]], [1, bg[1]]]);
    doc.add('bg', `<rect x="${x0 + 8}" y="${y0 + 8}" width="${CW - 16}" height="${CH - 16}" rx="18" fill="${grad}"/>`);
    // light source hint
    const lx = x0 + CW / 2 + light.key[0] * 260, ly = y0 + CH * 0.42 + light.key[1] * 300;
    if (light.key[2] > -0.2) doc.add('bg', `<circle cx="${lx}" cy="${Math.min(y0 + CH - 40, Math.max(y0 + 40, ly))}" r="90" fill="${glow}" opacity="0.35" filter="${doc.blur(40)}"/>`);
    else doc.add('bg', `<circle cx="${x0 + CW - 90}" cy="${y0 + 120}" r="120" fill="${glow}" opacity="0.4" filter="${doc.blur(50)}"/>`);
    const pose = { ...ch.poses.bust, head: { yaw: 0.25, pitch: 0.04, roll: -0.08 }, hide: ['legL', 'legR'] };
    const ex = ch.expressions.smirk;
    const v = { yaw: -0.35, s: 13, ox: 0, oy: 0 };
    const probe = F.build(ch, { pose, expr: ex });
    const hc = toView(viewOf(v), probe.head.anchors.cranium);
    v.ox = x0 + CW / 2 - hc[0]; v.oy = y0 + CH * 0.4 - hc[1];
    F.render(doc, ch, { pose, expr: { ...ex, shade: light.key[2] < 0 ? 0.8 : light.key[1] > 0.5 ? 0.6 : 0 }, view: v, box: { x0: x0 + 8, y0: y0 + 8, w: CW - 16, h: CH - 16 }, light, lineScale: 1.1 });
    doc.add('ui', `<rect x="${x0 + 24}" y="${y0 + CH - 70}" width="${CW - 48}" height="40" rx="20" fill="#120e1a" opacity="0.8"/><text x="${x0 + CW / 2}" y="${y0 + CH - 43}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="19" fill="#f2e6cf">${name}</text>`);
  });
  return doc;
}
if (require.main === module) {
  const out = path.join(__dirname, 'lighting.svg');
  fs.writeFileSync(out, sheet().toString());
  console.log(out);
}
