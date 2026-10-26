'use strict';
// Reference sheet: full body front + 3/4, height in heads, palette with hex, close-ups of the face,
// jewellery and hands, short design notes.
//   node art/scenes/refsheet.js nefer
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const Cc = require('../lib/color');
const { Doc, path: P, g } = require('../lib/svg');
const F = require('../lib/figure');
const { toView, viewOf } = require('../lib/raster');

const W = 2000, H = 1250;
const font = 'DejaVu Sans, sans-serif';
const text = (x, y, s, size = 18, fill = '#3a2f45', extra = '') => `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`;

function fullBody(doc, ch, { yaw, x, w, top, bottom, pose, expr, light }) {
  const probe = F.build(ch, { pose, expr });
  const a = probe.body.anchors;
  // fit: from the ear tips (or hair top) to the ground
  const v0 = viewOf({ yaw, s: 1, ox: 0, oy: 0 });
  const headTop = toView(v0, G.add(probe.head.anchors.cranium, G.mvec(probe.head.frame.R, [0, -probe.head.R * (ch.refTop || 2.0), 0])))[1];
  const ground = toView(v0, [0, probe.body.spec.groundY + 1, 0])[1];
  const s = (bottom - top) / (ground - headTop);
  const v = { yaw, s, ox: x + w / 2, oy: top - headTop * s };
  const r = F.render(doc, ch, { pose, expr, view: v, box: { x0: x, y0: top - 40, w, h: bottom - top + 80 }, step: 1, light, lineScale: Math.max(0.75, s / 6.5) });
  // ground shadow
  doc.add('back', `<ellipse cx="${x + w / 2}" cy="${bottom + 4}" rx="${w * 0.28}" ry="10" fill="#2a2235" opacity="0.18"/>`);
  return { r, s, v, headTop: top, ground: bottom };
}

function detail(doc, ch, { box, target, yaw = -0.35, pitch = 0, zoom = 20, pose, expr, light, label }) {
  const [x0, y0, bw, bh] = box;
  const probe = F.build(ch, { pose, expr });
  const tp = target(probe);
  const v = { yaw, pitch, s: zoom };
  const c = toView(viewOf(v), tp);
  v.ox = x0 + bw / 2 - c[0]; v.oy = y0 + bh / 2 - c[1];
  const clip = doc.clip(`M${x0} ${y0}h${bw}v${bh}h${-bw}Z`, { rule: 'nonzero' });
  doc.add('char', `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="14" fill="#e9dfcd"/>`);
  const r = F.render(doc, ch, { pose, expr, view: v, box: { x0, y0, w: bw, h: bh }, step: 1, light, lineScale: Math.max(0.8, zoom / 9), add: false });
  doc.add('char', `<g clip-path="${clip}">${r.svg}</g>`);
  doc.add('char', `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="14" fill="none" stroke="#8a7a68" stroke-width="2"/>`);
  if (label) doc.add('ui', `<rect x="${x0 + 8}" y="${y0 + bh - 36}" width="${label.length * 10 + 20}" height="28" rx="14" fill="#2a2235" opacity="0.85"/>` + text(x0 + 18, y0 + bh - 16, label, 15, '#f2e6cf'));
}

function sheet(ch) {
  const doc = new Doc(W, H, { title: `${ch.title} — реф-лист`, bg: '#f2ead9' });
  const light = { key: [-0.55, -0.55, 0.62], rim: [0.9, -0.3, -0.35], rimOpacity: 0.45, ...(ch.refLight || {}) };
  const pose = ch.poses.ref || ch.poses.bust;
  const expr = ch.expressions[ch.refExpr || 'neutral'] || {};
  // paper texture and header
  doc.add('bg', `<rect width="${W}" height="${H}" fill="#f2ead9"/><rect x="0" y="0" width="${W}" height="96" fill="#2a2235"/>`);
  doc.add('ui', text(32, 62, `${ch.title}`, 40, '#f6e3b0', 'font-weight="bold"') + text(32 + ch.title.length * 26 + 30, 60, ch.subtitle || '', 22, '#cdbfe0'));
  doc.add('ui', text(W - 420, 60, 'Ночи Карнака · реф-лист', 20, '#cdbfe0'));
  // figures
  const top = 170, bottom = H - 60;
  const f1 = fullBody(doc, ch, { yaw: 0, x: 60, w: 470, top, bottom, pose, expr, light });
  const f2 = fullBody(doc, ch, { yaw: -0.62, x: 520, w: 470, top, bottom, pose, expr, light });
  doc.add('ui', text(200, 140, 'анфас', 20) + text(680, 140, '3/4', 20));
  // height bar in heads
  const headH = (f1.r.head.R * 2.05) * f1.s; // crown to chin in screen units
  const crownY = toView(f1.r.view, G.add(f1.r.head.anchors.cranium, G.mvec(f1.r.head.frame.R, [0, -f1.r.head.R, 0])))[1];
  const n = Math.round((bottom - crownY) / headH * 10) / 10;
  let bars = '';
  for (let k = 0; k * headH < bottom - crownY - 1; k++) {
    const y = crownY + k * headH;
    bars += `<rect x="30" y="${G.fmt(y)}" width="12" height="${G.fmt(Math.min(headH, bottom - y))}" fill="${k % 2 ? '#c9b89c' : '#8a7a68'}"/>`;
  }
  doc.add('ui', bars + text(14, crownY - 12, `${n} головы`, 15, '#5a4e6a'));
  // palette
  const px = 1030, py = 140;
  doc.add('ui', text(px, py, 'Палитра', 22, '#3a2f45', 'font-weight="bold"'));
  const pal = Object.entries(ch.palNames || {}).map(([k, nm]) => [nm, ch.pal[k]]).filter(([, c]) => c);
  pal.forEach(([nm, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = px + col * 230, y = py + 22 + row * 58;
    doc.add('ui', `<rect x="${x}" y="${y}" width="46" height="46" rx="10" fill="${c}" stroke="#3a2f45" stroke-width="1.5"/>` + text(x + 58, y + 20, nm, 15) + text(x + 58, y + 40, c.toUpperCase(), 14, '#6a5e7a', 'font-family="DejaVu Sans Mono, monospace"'));
  });
  const prow = Math.ceil(pal.length / 2);
  // details
  const dy = py + 40 + prow * 58;
  const dx = 1500, dw = 470;
  doc.add('ui', text(dx, py, 'Детали', 22, '#3a2f45', 'font-weight="bold"'));
  const details = ch.refDetails ? ch.refDetails() : [];
  details.forEach((d, i) => detail(doc, ch, { ...d, pose: d.pose || pose, expr: d.expr || expr, light, box: d.box || [dx, py + 20 + i * 250, dw, 236] }));
  // notes
  const notes = ch.notes || [];
  doc.add('ui', text(px, dy + 30, 'Заметки', 22, '#3a2f45', 'font-weight="bold"'));
  // wrap notes to the column width
  let ly = dy + 62;
  for (const t of notes) {
    const words = ('• ' + t).split(' '); let line = '';
    for (const w of words) { if ((line + ' ' + w).length > 52) { doc.add('ui', text(px, ly, line, 15, '#3a2f45')); ly += 24; line = '   ' + w; } else line = line ? line + ' ' + w : w; }
    doc.add('ui', text(px, ly, line, 15, '#3a2f45')); ly += 30;
  }
  return doc;
}

if (require.main === module) {
  const name = process.argv[2] || 'nefer';
  const ch = require('../chars/' + name);
  const out = process.argv[3] || path.join(__dirname, '..', 'final', name, `${name}_ref.svg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const t0 = Date.now();
  fs.writeFileSync(out, sheet(ch).toString());
  console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
module.exports = { sheet };
