'use strict';
// Emotion sheet: head-and-shoulders cells, one expression each (pose of head and ears included).
//   node art/scenes/emotions.js nefer [list] [out.svg] [cols]
const fs = require('fs');
const path = require('path');
const G = require('../lib/geom');
const { Doc } = require('../lib/svg');
const F = require('../lib/figure');

const NAMES = { neutral: 'спокойствие', smirk: 'ухмылка', lazy: 'лень', wink: 'подмигивание', laugh: 'смех', annoyed: 'раздражение', surprised: 'удивление', sad: 'грусть', flirty: 'кокетство', angry: 'гнев', proud: 'гордость', joy: 'радость', shy: 'смущение', hypno: 'гипноз', sly: 'хитрость', playful: 'игривость', calm: 'покой', mystery: 'загадка', excited: 'азарт', tender: 'нежность', sleepy: 'сонливость', fierce: 'ярость' };

function sheet(ch, list, { cols = 4, cw = 420, chh = 470, title = null, bgCell = null } = {}) {
  const rows = Math.ceil(list.length / cols), TOP = 96;
  const doc = new Doc(cols * cw, TOP + rows * chh, { title: title || `${ch.title} — эмоции`, bg: '#221d33' });
  doc.add('ui', `<text x="24" y="54" font-family="DejaVu Sans, sans-serif" font-size="30" fill="#f2e6cf">${title || ch.title + ' — лист эмоций'}</text>`);
  list.forEach((name, k) => {
    const ex = ch.expressions[name] || {};
    const col = k % cols, row = Math.floor(k / cols);
    const x0 = col * cw, y0 = TOP + row * chh;
    const cell = doc.linear([[0, '#3a2f52'], [1, '#2a2340']]);
    doc.add('bg', `<rect x="${x0 + 6}" y="${y0 + 6}" width="${cw - 12}" height="${chh - 12}" rx="18" fill="${cell}"/>`);
    const base = ch.poses.bust || ch.poses.halfbody;
    const pose = { ...base, head: { ...(base.head || {}), ...(ex.head || {}) }, hide: ['legL', 'legR', ...(base.hide || [])] };
    const s = ch.bustScale || 10.5;
    const v = { yaw: ex.viewYaw != null ? ex.viewYaw : -0.32, pitch: 0, s, ox: x0 + cw / 2, oy: y0 + chh * 0.5 };
    // centre the head: build once to find it, then shift the view
    const probe = F.build(ch, { pose, expr: ex });
    const hc = require('../lib/raster').toView(require('../lib/raster').viewOf(v), probe.head.anchors.cranium);
    v.oy += (y0 + chh * (ch.emoCy || 0.4)) - hc[1]; v.ox += (x0 + cw / 2) - hc[0];
    F.render(doc, ch, { pose, expr: ex, view: v, box: { x0: x0 + 6, y0: y0 + 6, w: cw - 12, h: chh - 12 }, step: 1, light: ch.light || {}, lineScale: 0.95 });
    const lbl = NAMES[name] || name;
    doc.add('ui', `<rect x="${x0 + cw / 2 - lbl.length * 7.5 - 16}" y="${y0 + chh - 52}" width="${lbl.length * 15 + 32}" height="38" rx="19" fill="#1a1526" opacity="0.85"/><text x="${x0 + cw / 2}" y="${y0 + chh - 26}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="22" fill="#f2e6cf">${lbl}</text>`);
  });
  // clip each cell so bodies do not spill into neighbours
  return doc;
}

if (require.main === module) {
  const name = process.argv[2] || 'nefer';
  const ch = require('../chars/' + name);
  const list = (process.argv[3] || 'lazy,smirk,wink,laugh,annoyed,surprised,sad,flirty').split(',');
  const out = process.argv[4] || path.join(__dirname, '..', 'final', name, `${name}_emotions.svg`);
  const cols = +(process.argv[5] || (list.length > 6 ? 4 : 3));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const t0 = Date.now();
  const doc = sheet(ch, list, { cols, title: process.argv[6] });
  fs.writeFileSync(out, doc.toString());
  console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
module.exports = { sheet, NAMES };
