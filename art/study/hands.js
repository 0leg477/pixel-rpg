'use strict';
// Exercise 3: hands and paws in six positions (cat paws: palm block + finger blocks, pads, small claws).
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const B = require('../lib/build');
const Bd = require('../lib/body');
const { Raster, viewOf, toView } = require('../lib/raster');
const T = require('../lib/toon');
const { Doc } = require('../lib/svg');

const pal = { fur: '#d6a466', pad: '#c4807f', claw: '#f6eedc', stripe: '#9d6436', gold: '#d9a640' };
const CASES = [
  ['расслабленная', { hand: [9, -30, 14], pose: 'relaxed', palm: [-0.5, 0.2, 0.8], finger: [0.2, 1, 0.1] }, { yaw: -0.3, pitch: 0.1 }],
  ['раскрытая ладонь', { hand: [8, -36, 16], pose: 'open', palm: [0, 0, 1], finger: [0.15, -1, 0.1] }, { yaw: 0.05, pitch: 0 }],
  ['кулак', { hand: [9, -34, 15], pose: 'fist', palm: [-0.9, 0, 0.4], finger: [0.1, -1, 0.3] }, { yaw: 0.35, pitch: 0.1 }],
  ['указательный жест', { hand: [10, -36, 17], pose: 'point', palm: [-0.3, 0.6, 0.7], finger: [0.8, -0.4, 0.4] }, { yaw: 0.0, pitch: 0.15 }],
  ['хват посоха', { hand: [9, -33, 15], pose: 'grip', palm: [-1, 0, 0.1], finger: [0.05, 0.1, 1] }, { yaw: 0.6, pitch: 0.05 }],
  ['пин-ап (изящная)', { hand: [8, -38, 15], pose: 'elegant', palm: [-0.4, 0.3, 0.86], finger: [0.45, -0.85, 0.2] }, { yaw: -0.2, pitch: 0 }],
];
const CW = 480, CH = 500, TOP = 110, COLS = 3;

function sheet() {
  const doc = new Doc(CW * COLS, TOP + CH * 2, { title: 'Кисти и лапы: шесть положений', bg: '#241f33' });
  doc.add('ui', `<text x="24" y="52" font-family="DejaVu Sans, sans-serif" font-size="30" fill="#f2e6cf">Упражнение 3. Кисти и лапы: шесть положений</text>`);
  doc.add('ui', `<text x="24" y="86" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#b9add0">Блок ладони + блоки пальцев по фалангам; подушечки на ладони; короткие когти над подушечками. Линия всегда разделяет пальцы.</text>`);
  CASES.forEach(([name, arm, vw], k) => {
    const col = k % COLS, row = Math.floor(k / COLS), x0 = col * CW, y0 = TOP + row * CH;
    doc.add('bg', `<rect x="${x0 + 8}" y="${y0 + 8}" width="${CW - 16}" height="${CH - 16}" rx="18" fill="#3a3150"/>`);
    const body = Bd.build({}, { armR: { ...arm, pole: [30, -10, -10] }, armL: { hand: [-15, 0, 4] }, legs: false }, { claw: 'claw' });
    const groups = body.groups.filter(g => g.name.startsWith('handR') || g.name === 'armR');
    const wrist = body.anchors.wristR, hc = G.tapply(body.anchors.handR, [0, 6, 0]);
    const v = { yaw: vw.yaw, pitch: vw.pitch, s: 19 };
    const vv = viewOf(v); const c = toView(vv, hc);
    v.ox = x0 + CW / 2 - c[0]; v.oy = y0 + CH * 0.47 - c[1];
    const Rs = new Raster({ x0: x0 + 8, y0: y0 + 8, w: CW - 16, h: CH - 16, step: 1 }).render({ groups }, viewOf(v));
    const pads = require('../lib/costume').pawPads('R', pal.pad, body.anchors.tipPadsR);
    const stripes = { parts: ['armR.fore'], color: pal.stripe, opacity: 0.85, fn: p => Math.min(0.7 - Math.abs(p[1] - 14), p[0] * 0.3 + 0.6) };
    T.figure(Rs, doc, { materials: { fur: { base: pal.fur, sss: true }, claw: { base: pal.claw, gloss: 0.9 } }, markings: [stripes, ...pads], lineScale: 1.6, silWidth: 3.4, occWidth: 2.6 });
    doc.add('ui', `<rect x="${x0 + CW / 2 - name.length * 7 - 16}" y="${y0 + CH - 58}" width="${name.length * 14 + 32}" height="36" rx="18" fill="#1a1526" opacity="0.85"/><text x="${x0 + CW / 2}" y="${y0 + CH - 33}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#f2e6cf">${name}</text>`);
  });
  return doc;
}
if (require.main === module) {
  const out = path.join(__dirname, 'hands.svg');
  fs.writeFileSync(out, sheet().toString());
  console.log(out);
}
