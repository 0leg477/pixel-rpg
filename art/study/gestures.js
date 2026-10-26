'use strict';
// Exercise 4: ten gesture silhouettes with the line of action (head -> neck -> chest -> pelvis -> weight foot).
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const Bd = require('../lib/body');
const H = require('../lib/head');
const { Raster, viewOf, toView } = require('../lib/raster');
const T = require('../lib/toon');
const M = require('../lib/march');
const { Doc, path: P } = require('../lib/svg');

const tail = { r: [2.4, 2.2, 2.0, 1.6], ctrl: [[0, 5, -8], [-8, 16, -14], [-16, 28, -10], [-12, 44, -6]] };
const POSES = [
  ['контрапост', { pelvis: { roll: 0.16, pos: [3, 0, 0] }, chest: { roll: -0.14 }, head: { roll: 0.12 }, armL: { hand: [-21, -2, 3], pose: 'relaxed' }, armR: { hand: [20, 4, 5] }, legL: { foot: [2, 79, 3] }, legR: { foot: [19, 77, -2] } }, -0.25, 'L'],
  ['рука на бедре', { pelvis: { roll: 0.22, yaw: 0.1, pos: [4, 0, 0] }, chest: { roll: -0.16, yaw: -0.1 }, head: { roll: -0.18 }, armL: { hand: [-17, -6, 4], pole: [-40, -28, -14], pose: 'hip', palm: [1, 0, 0] }, armR: { hand: [24, 6, 4] }, legL: { foot: [3, 79, 4] }, legR: { foot: [20, 78, 2] } }, -0.4, 'L'],
  ['шаг', { pelvis: { yaw: 0.12, roll: 0.05 }, chest: { yaw: -0.2, pitch: 0.05 }, head: { pitch: -0.05 }, armL: { hand: [-10, -6, 16] }, armR: { hand: [14, -2, -14] }, legL: { foot: [-6, 76, 26] }, legR: { foot: [8, 79, -18] } }, 1.15, 'R'],
  ['тянется вверх', { pelvis: { pitch: -0.12, roll: 0.1 }, chest: { pitch: -0.32, roll: -0.08 }, head: { pitch: -0.45 }, armL: { hand: [-12, -88, -4], pole: [-30, -60, -10], pose: 'open' }, armR: { hand: [4, -90, -2], pole: [30, -60, -10], pose: 'open' }, legL: { foot: [-1, 79, 4] }, legR: { foot: [14, 77, -4] } }, 0.9, 'L'],
  ['наклон вперёд', { pelvis: { pitch: 0.3, pos: [0, 3, -4] }, chest: { pitch: 0.5 }, head: { pitch: -0.4 }, armL: { hand: [-9, 20, 24] }, armR: { hand: [9, 20, 24] }, legL: { foot: [-9, 79, 4] }, legR: { foot: [9, 79, 4] } }, 1.3, 'L'],
  ['оглядывается', { pelvis: { yaw: -0.5, roll: 0.12, pos: [3, 0, 0] }, chest: { yaw: 0.7, roll: -0.1 }, head: { yaw: 0.75, roll: 0.15 }, armL: { hand: [-16, -2, 10] }, armR: { hand: [22, 4, -4] }, legL: { foot: [3, 79, 4] }, legR: { foot: [16, 78, -6] } }, 2.25, 'L'],
  ['танец', { pelvis: { roll: 0.26, yaw: 0.2, pos: [4, 0, 0] }, chest: { roll: -0.28 }, head: { roll: 0.25, pitch: -0.1 }, armL: { hand: [-10, -86, 6], pole: [-34, -60, 0], pose: 'elegant' }, armR: { hand: [36, -40, 8], pose: 'elegant' }, legL: { foot: [2, 79, 3] }, legR: { foot: [28, 62, 14] } }, -0.3, 'L'],
  ['выпад с хопешем', { pelvis: { yaw: -0.35, pitch: 0.1, pos: [0, 12, 0] }, chest: { yaw: -0.25, pitch: 0.25 }, head: { yaw: 0.35, pitch: -0.2 }, armL: { hand: [-4, -26, 46], pose: 'grip', pole: [-30, -20, 0] }, armR: { hand: [26, -20, -22], pose: 'open' }, legL: { foot: [-10, 79, 34] }, legR: { foot: [12, 79, -36] } }, 1.05, 'R'],
  ['с посохом', { pelvis: { roll: 0.1, pos: [2, 0, 0] }, chest: { roll: -0.08, pitch: -0.05 }, head: { pitch: 0.08, roll: 0.08 }, armL: { hand: [-26, -24, 14], pose: 'grip', pole: [-44, -10, 0] }, armR: { hand: [20, 4, 4] }, legL: { foot: [1, 79, 3] }, legR: { foot: [16, 78, 1] } }, -0.35, 'L'],
  ['руки за головой', { pelvis: { roll: -0.18, pos: [-3, 0, 0] }, chest: { roll: 0.14, pitch: -0.14 }, head: { roll: -0.18, pitch: -0.05 }, armL: { hand: [-5, -70, -7], pole: [-36, -64, 0] }, armR: { hand: [5, -70, -7], pole: [36, -64, 0] }, legL: { foot: [-19, 78, 1] }, legR: { foot: [-1, 79, 4] } }, -0.45, 'R'],
];
const CW = 300, CH = 560, TOP = 110, COLS = 5;

function sheet() {
  const doc = new Doc(CW * COLS, TOP + CH * 2, { title: 'Жестовые позы: силуэты и линия действия', bg: '#efe6d4' });
  doc.add('ui', `<text x="24" y="52" font-family="DejaVu Sans, sans-serif" font-size="30" fill="#2a2235">Упражнение 4. Десять жестовых поз: силуэт + линия действия</text>`);
  doc.add('ui', `<text x="24" y="86" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#5a4e6a">Красная кривая: голова → шея → грудь → таз → опорная стопа. Силуэт должен читаться без деталей.</text>`);
  POSES.forEach(([name, pose, yaw, weight], k) => {
    const col = k % COLS, row = Math.floor(k / COLS), x0 = col * CW, y0 = TOP + row * CH;
    const body = Bd.build({ tail }, pose, {});
    const head = H.build('cat', { R: 11, frame: body.anchors.headT });
    const groups = [...body.groups, ...head.groups];
    const v = viewOf({ yaw, s: 2.95, ox: x0 + CW / 2, oy: y0 + 262 });
    const Rs = new Raster({ x0, y0, w: CW, h: CH - 40, step: 1 }).render({ groups }, v);
    const sil = M.shapes(Rs.cov, Rs.W, Rs.H, { x0: Rs.x0, y0: Rs.y0, step: 1, smooth: 2, eps: 0.2 });
    doc.add('char', P(G.ringsD(sil), { fill: '#1d1826', 'fill-rule': 'evenodd' }));
    // line of action
    const a = body.anchors;
    const pts = [a.headT.t, a.neckTop, a.neckBase, G.tapply(a.chestT, [0, -30, 0]), G.tapply(a.pelvisT, [0, 0, 0]), a['knee' + weight] || a['hip' + weight], a['toe' + weight]].filter(Boolean).map(p => toView(v, p));
    const curve = G.catmull(pts.map(p => [p[0], p[1]]), { seg: 10 });
    doc.add('fx', P(G.polyD(curve, false), { fill: 'none', stroke: '#e23b3b', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.9 }));
    const e = curve[curve.length - 1];
    doc.add('fx', `<circle cx="${G.fmt(e[0])}" cy="${G.fmt(e[1])}" r="7" fill="#e23b3b"/>`);
    doc.add('ui', `<text x="${x0 + CW / 2}" y="${y0 + CH - 16}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="18" fill="#2a2235">${name}</text>`);
  });
  return doc;
}
if (require.main === module) {
  const out = path.join(__dirname, 'gestures.svg');
  fs.writeFileSync(out, sheet().toString());
  console.log(out);
}
