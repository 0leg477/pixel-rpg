'use strict';
// Exercise 6: texture swatches — fur, cobra scales, crocodile scales, translucent linen, gold and gems.
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const B = require('../lib/build');
const C = require('../lib/costume');
const X = require('../lib/textures');
const { Raster, viewOf } = require('../lib/raster');
const T = require('../lib/toon');
const { Doc, path: P } = require('../lib/svg');

const CW = 380, CH = 520, TOP = 110;
const cellBg = (doc, x0, y0, c) => doc.add('bg', `<rect x="${x0 + 8}" y="${y0 + 8}" width="${CW - 16}" height="${CH - 16}" rx="18" fill="${c}"/>`);
const label = (doc, x0, y0, s) => doc.add('ui', `<rect x="${x0 + 24}" y="${y0 + CH - 66}" width="${CW - 48}" height="38" rx="19" fill="#120e1a" opacity="0.85"/><text x="${x0 + CW / 2}" y="${y0 + CH - 40}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="19" fill="#f2e6cf">${s}</text>`);

function sheet() {
  const doc = new Doc(CW * 5, TOP + CH, { title: 'Образцы фактур', bg: '#1f1a2b' });
  doc.add('ui', `<text x="24" y="52" font-family="DejaVu Sans, sans-serif" font-size="30" fill="#f2e6cf">Упражнение 6. Фактуры: мех, чешуя кобры, чешуя крокодила, лён, золото</text>`);
  doc.add('ui', `<text x="24" y="86" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#b9add0">Фактура только поверх правильной формы: сначала свет и тень объёма, потом пучки, чешуйки, складки и отражения.</text>`);
  const box = k => ({ x0: k * CW + 8, y0: TOP + 8, w: CW - 16, h: CH - 16, step: 1 });

  // 1. fur: a fluffy tail
  {
    const k = 0, x0 = k * CW; cellBg(doc, x0, TOP, '#3a3150');
    const ctrl = [[-10, 30, 0], [-4, 10, 4], [6, -6, 2], [4, -24, -2], [-6, -34, 0]];
    const pts = G.catmull(ctrl, { seg: 10 });
    const groups = [{ name: 'tail', k: 1, parts: [{ name: 'tail', mat: 'fur', prims: B.sweep(pts, t => 8.5 * Math.sin(Math.PI * (0.15 + 0.7 * t)) + 1.5, { spacing: 0.2 }), k: 1.2 }] }];
    const v = viewOf({ yaw: 0.2, s: 5.6, ox: x0 + CW / 2, oy: TOP + CH * 0.45 });
    const Rs = new Raster(box(k)).render({ groups }, v);
    const pp = X.pathParam(pts);
    const r = T.figure(Rs, doc, { materials: { fur: { base: '#e7b06c', sss: true } }, add: false, lineScale: 1.2,
      markings: [{ parts: ['tail'], color: '#f8e8cc', fn: p => { const { s, total } = pp(p); return (s - total * 0.78) * 0.5; } }, { parts: ['tail'], color: '#a8693a', opacity: 0.9, fn: p => { const { s } = pp(p); return Math.abs(Math.sin(s * 0.3)) - 0.8; } }],
      tufts: [{ parts: ['tail'], amp: 22, period: 34, flow: [0.3, -1], lean: 0.9 }] });
    doc.add('char', r.svg.replace('<g class="lines">', X.furStrokes(doc, Rs, { parts: ['tail'], spacing: 10, len: 18, width: 2.6, opacity: 0.8, dark: '#7a4320', light: '#fff0cc', flow: (p) => { const { frame } = pp(p); return G.mul(frame.t, -1); } }) + '<g class="lines">'));
    label(doc, x0, TOP, 'мех: пучки по силуэту + штрихи');
  }
  // 2. cobra scales
  {
    const k = 1, x0 = k * CW; cellBg(doc, x0, TOP, '#22313a');
    const ctrl = [[-12, 34, -4], [8, 14, 2], [-6, -6, 6], [8, -26, 0]];
    const pts = G.catmull(ctrl, { seg: 12 });
    const groups = [{ name: 'snake', k: 1, parts: [{ name: 'snake', mat: 'scale', prims: B.sweep(pts, t => 7.5 - 2 * t, { spacing: 0.2 }), k: 1.2 }] }];
    const v = viewOf({ yaw: 0.0, s: 5.8, ox: x0 + CW / 2, oy: TOP + CH * 0.45 });
    const Rs = new Raster(box(k)).render({ groups }, v);
    const pp = X.pathParam(pts);
    const param = p => { const q = pp(p); return { u: q.theta * 7.5 / 2.2, v: q.s / 1.9 }; };
    const ventral = p => { const q = pp(p); return Math.cos(q.theta - 1.57) - 0.55; };
    const r = T.figure(Rs, doc, { materials: { scale: { base: '#1f8a5a', gloss: 0.975 } }, add: false, lineScale: 1.2,
      markings: [...X.ventralPlates(['snake'], param, ventral, { color: '#e8ca52' }), ...X.snakeScales(['snake'], param, { ventral })] });
    doc.add('char', r.svg);
    label(doc, x0, TOP, 'кобра: черепица + брюшные щитки');
  }
  // 3. crocodile scales
  {
    const k = 2, x0 = k * CW; cellBg(doc, x0, TOP, '#2c3324');
    const ctrl = [[-14, 20, 0], [0, 6, 4], [14, -10, 0]];
    const pts = G.catmull(ctrl, { seg: 10 });
    const groups = [{ name: 'croc', k: 1, parts: [{ name: 'croc', mat: 'scale', prims: B.sweep(pts, t => 12 - 4 * t, { spacing: 0.2 }), k: 1.5 }] }];
    const v = viewOf({ yaw: -0.2, pitch: 0.25, s: 6, ox: x0 + CW / 2, oy: TOP + CH * 0.44 });
    const Rs = new Raster(box(k)).render({ groups }, v);
    const pp = X.pathParam(pts);
    const param = p => { const q = pp(p); return { u: q.theta * 11 / 3.2, v: q.s / 3.4 }; };
    const back = p => Math.cos(pp(p).theta + 1.57) - 0.5;
    const r = T.figure(Rs, doc, { materials: { scale: { base: '#6f7d3c', gloss: 0.97 } }, add: false, lineScale: 1.2,
      markings: [{ parts: ['croc'], color: '#d8cf9a', fn: p => Math.cos(pp(p).theta - 1.57) - 0.45 }, ...X.crocScutes(['croc'], param, { back })] });
    doc.add('char', r.svg);
    label(doc, x0, TOP, 'крокодил: пластины + кили');
  }
  // 4. translucent linen over legs
  {
    const k = 3, x0 = k * CW; cellBg(doc, x0, TOP, '#3d3046');
    const v = viewOf({ yaw: 0.3, s: 4.4, ox: x0 + CW / 2, oy: TOP + 60 });
    const legs = { name: 'legs', k: 1, parts: [-1, 1].map(s => ({ name: 'leg', mat: 'fur', prims: B.sweep([[s * 7, 4, 0], [s * 6, 40, 2], [s * 5, 78, 0]], t => 7.5 - 4 * t, { spacing: 0.2 }), k: 1 })) };
    const RsL = new Raster(box(k)).render({ groups: [legs] }, v);
    doc.add('char', T.figure(RsL, doc, { materials: { fur: { base: '#d6a466', sss: true } }, add: false, lineScale: 1 }).svg);
    const sk = C.skirt({ R: G.I3(), t: [0, 0, 0] }, [[-4, 13, 9, 0], [8, 17, 11, 0], [40, 18, 12, 1], [82, 21, 14, 2]], { mat: 'linen', pleats: 22, pleatAmp: 0.45 });
    const RsS = new Raster(box(k)).render({ groups: [sk] }, v);
    const r = T.figure(RsS, doc, { materials: { linen: { base: '#ece4d4', opacity: 0.8, line: '#8a7e70' } }, add: false, lineScale: 1 });
    // folds hanging from the hip (tension points) to the hem
    const lines = [];
    for (let i = 0; i < 9; i++) { const a = -1.4 + i * 0.35, pts = []; for (let y = 6; y <= 80; y += 2) { const t = (y - 6) / 74, rr = 17 + 4 * t; pts.push([Math.sin(a + 0.05 * Math.sin(y * 0.1)) * rr, y, Math.cos(a) * (11 + 3 * t) + 1]); } lines.push(pts); }
    doc.add('char', r.svg.replace('<g class="lines">', C.folds(RsS, lines, { color: '#9a8e80', width: 0.45, opacity: 0.55 }) + '<g class="lines">'));
    label(doc, x0, TOP, 'лён: полупрозрачность + складки');
  }
  // 5. gold and gems
  {
    const k = 4, x0 = k * CW; cellBg(doc, x0, TOP, '#241d30');
    const groups = [
      { name: 'ring', k: 0.3, parts: [{ name: 'ring', mat: 'gold', prims: C.torus([0, 0, 0], [0.3, 1, 0.5], 18, 3.2), k: 0.4 }] },
      { name: 'bead', k: 0.3, parts: [{ name: 'bead', mat: 'gold', prims: [B.sphere([0, 22, 6], 7)] }] },
      { name: 'gem', k: 0.3, parts: [{ name: 'gem', mat: 'lapis', prims: [C.disc([0, 0, 2], [0, -0.3, 1], 10, 0.45)] }, { name: 'gemrim', mat: 'gold', prims: C.torus([0, 0, 2], [0, -0.3, 1], 10.5, 1.4) }] },
      { name: 'carn', k: 0.3, parts: [{ name: 'carn', mat: 'carnelian', prims: [B.ell([-16, 22, 4], [4.5, 6, 4])] }, { name: 'turq', mat: 'turq', prims: [B.ell([16, 22, 4], [4.5, 6, 4])] }] },
    ];
    const v = viewOf({ yaw: 0.2, pitch: 0.1, s: 6.5, ox: x0 + CW / 2, oy: TOP + CH * 0.4 });
    const Rs = new Raster(box(k)).render({ groups }, v);
    doc.add('char', T.figure(Rs, doc, { materials: { gold: { base: '#d9a640', shading: 'metal' }, lapis: { base: '#2347a0', gloss: 0.93 }, carnelian: { base: '#b4452f', gloss: 0.93 }, turq: { base: '#35b4a6', gloss: 0.93 } }, add: false, lineScale: 1.2 }).svg);
    label(doc, x0, TOP, 'золото и камни: отражения + искры');
  }
  return doc;
}
if (require.main === module) {
  const out = path.join(__dirname, 'textures.svg');
  fs.writeFileSync(out, sheet().toString());
  console.log(out);
}
