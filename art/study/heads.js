'use strict';
// Exercise 1: heads of all seven species in five views (front, 3/4 left, 3/4 right, profile, from above)
// with Loomis construction lines (brow line and centre line on the cranium ball).
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const B = require('../lib/build');
const { Raster, viewOf } = require('../lib/raster');
const T = require('../lib/toon');
const { Doc, path: P, g } = require('../lib/svg');
const H = require('../lib/head');
const S = require('../lib/species');
const Ln = require('../lib/line');

const ORDER = [['cat', 'Кошка (Нефер)'], ['fennec', 'Фенек (Амара)'], ['lion', 'Львица (Сехмет)'], ['cobra', 'Кобра (Уаджит)'], ['croc', 'Крокодил (Себека)'], ['cow', 'Корова (Хатхор)'], ['jackal', 'Шакал (Анпут)']];
const VIEWS = [['анфас', 0, 0], ['3/4 влево', -0.62, 0], ['3/4 вправо', 0.62, 0], ['профиль', 1.48, 0], ['сверху', 0.35, 0.72]];
const CW = 300, CH = 290, TOP = 110, LEFT = 0;

function construction(Rs, head) {
  const out = [], R = head.R;
  const lines = [];
  const lat = 0.04; const ring = []; for (let i = 0; i <= 96; i++) { const lo = -Math.PI + i / 96 * 2 * Math.PI; ring.push([Math.sin(lo) * Math.cos(lat), Math.sin(lat), Math.cos(lo) * Math.cos(lat)]); }
  lines.push(ring);
  const mer = []; for (let i = 0; i <= 64; i++) { const la = -Math.PI / 2 + i / 64 * Math.PI; mer.push([0, Math.sin(la), Math.cos(la)]); }
  lines.push(mer);
  for (const ln of lines) {
    const pr = ln.map(p => Rs.project(head.toWorld(G.mul(p, 1.01))));
    let cur = [];
    const flush = () => { if (cur.length > 2) out.push(P(G.polyD(cur, false), { fill: 'none', stroke: '#7fe7ff', 'stroke-width': 1.1, 'stroke-dasharray': '5 4', opacity: 0.75 })); cur = []; };
    pr.forEach(p => { if (Rs.visible(p[0], p[1], p[2], 0.05 * R)) cur.push([p[0], p[1]]); else flush(); });
    flush();
  }
  return g({ class: 'construction' }, out);
}

function sheet() {
  const W = CW * VIEWS.length, Hh = TOP + CH * ORDER.length;
  const doc = new Doc(W, Hh, { title: 'Головы семи видов в пяти ракурсах', bg: '#262236' });
  doc.add('ui', `<text x="24" y="52" font-family="DejaVu Sans, sans-serif" font-size="30" fill="#f2e6cf">Упражнение 1. Головы семи видов в пяти ракурсах</text>`);
  doc.add('ui', `<text x="24" y="86" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#b9add0">Шар Лумиса + объём морды; голубой пунктир — линия бровей и центральная линия черепа. Один источник света слева сверху.</text>`);
  VIEWS.forEach(([name], k) => doc.add('ui', `<text x="${k * CW + CW / 2}" y="${TOP - 4}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="15" fill="#9d93b5">${name}</text>`));
  ORDER.forEach(([sp, label], row) => {
    const def = S.SPECIES[sp], pal = def.pal;
    doc.add('ui', `<text x="10" y="${TOP + row * CH + 22}" font-family="DejaVu Sans, sans-serif" font-size="17" fill="#f2e6cf">${label}</text>`);
    VIEWS.forEach(([, yaw, pitch], col) => {
      const R = 10, s = sp === 'croc' || sp === 'cobra' ? 7.2 : 8.2;
      const head = H.build(sp, { R, mats: { fur: 'fur', innerEar: 'innerEar' } });
      const neck = { name: 'neck', k: 2, parts: [{ name: 'neck', mat: 'fur', k: 0.8, prims: B.sweep([[0, 5, -3], [0, 24, -4]], sp === 'cow' ? 6.2 : 5.2) }] };
      const groups = [neck, ...head.groups];
      if (def.extra) groups.push(...def.extra(head, { horn: 'horn' }));
      if (sp === 'cobra') groups.push(S.hoodGroup(head, { mat: 'hoodFront', matBack: 'fur' }));
      const cx = col * CW + CW / 2, cy = TOP + row * CH + CH * 0.5 + (sp === 'cow' ? 18 : 0);
      const view = viewOf({ yaw, pitch, s, ox: cx, oy: cy });
      const Rs = new Raster({ x0: col * CW, y0: TOP + row * CH, w: CW, h: CH, step: 1 }).render({ groups }, view);
      const mats = { fur: { base: pal.fur, sss: sp !== 'cobra' && sp !== 'croc', gloss: sp === 'cobra' || sp === 'croc' ? 0.975 : null, rimK: sp === 'jackal' ? 1.8 : 1, hiK: sp === 'jackal' ? 2.2 : 1 }, innerEar: { base: pal.innerEar, edgeLine: false }, horn: { base: pal.horn || '#e8d8b0', gloss: 0.9 }, hoodFront: { base: pal.muzzle, gloss: 0.94 } };
      const r = T.figure(Rs, doc, { materials: mats, markings: def.markings(R, pal), tufts: def.tufts ? def.tufts(R, s) : [], lineScale: 0.8, add: false });
      const feat = H.features(doc, Rs, head, { expr: { smile: 0.3 }, eye: { iris: pal.eye, lashColor: '#140f18', lidColor: sp === 'jackal' ? pal.mark : '#2a1a24', brow: { color: sp === 'jackal' ? pal.mark : '#4a3226', width: 0.1 } }, noseColor: pal.nose, whiskers: sp === 'cat' || sp === 'lion' || sp === 'fennec' });
      doc.add('char', r.svg.replace('<g class="lines">', feat + '<g class="lines">'));
      doc.add('fx', construction(Rs, head));
    });
  });
  return doc;
}

if (require.main === module) {
  const t0 = Date.now();
  const doc = sheet();
  const out = path.join(__dirname, 'heads.svg');
  fs.writeFileSync(out, doc.toString());
  console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
