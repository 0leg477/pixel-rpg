'use strict';
// Night temple of Karnak behind a half-body figure: hypostyle columns with papyrus capitals,
// sunk-relief hieroglyphs, moonlight from the clerestory (cool back light, right) and a brazier
// (warm key light, left). Values stay below the character so the face keeps the focus.
const G = require('../lib/geom');
const Cc = require('../lib/color');
const { path, g } = require('../lib/svg');

// ---------- hieroglyphs (unit box 0..1, y down) ----------
const GLYPHS = {
  ankh: [['e', 0.5, 0.22, 0.17, 0.2], ['r', 0.44, 0.38, 0.12, 0.58], ['r', 0.2, 0.42, 0.6, 0.1]],
  reed: [['p', 'M0.5 0.02C0.75 0.25 0.72 0.7 0.52 0.98L0.46 0.98C0.36 0.7 0.3 0.3 0.5 0.02Z']],
  water: [['p', 'M0.02 0.45L0.14 0.35L0.26 0.45L0.38 0.35L0.5 0.45L0.62 0.35L0.74 0.45L0.86 0.35L0.98 0.45L0.98 0.58L0.86 0.48L0.74 0.58L0.62 0.48L0.5 0.58L0.38 0.48L0.26 0.58L0.14 0.48L0.02 0.58Z']],
  sun: [['ring', 0.5, 0.5, 0.36, 0.1], ['e', 0.5, 0.5, 0.09, 0.09]],
  eye: [['p', 'M0.08 0.4C0.3 0.18 0.7 0.18 0.92 0.4C0.7 0.55 0.3 0.55 0.08 0.4Z'], ['e', 0.5, 0.38, 0.09, 0.1], ['p', 'M0.42 0.52L0.36 0.9L0.44 0.9L0.5 0.55Z'], ['p', 'M0.6 0.52C0.75 0.7 0.8 0.85 0.66 0.92L0.62 0.86C0.72 0.8 0.68 0.68 0.56 0.56Z']],
  bird: [['p', 'M0.2 0.85C0.15 0.55 0.35 0.3 0.62 0.3L0.75 0.12L0.86 0.2L0.78 0.36C0.82 0.6 0.7 0.82 0.48 0.88L0.4 0.98L0.3 0.9Z']],
  feather: [['p', 'M0.42 0.98C0.36 0.6 0.4 0.25 0.62 0.02C0.66 0.3 0.6 0.65 0.52 0.98Z']],
  cobra: [['p', 'M0.3 0.95C0.2 0.7 0.7 0.7 0.6 0.45C0.55 0.3 0.4 0.32 0.42 0.18C0.44 0.05 0.62 0.04 0.66 0.16C0.6 0.12 0.52 0.14 0.53 0.22C0.55 0.32 0.75 0.35 0.74 0.52C0.72 0.78 0.34 0.75 0.42 0.95Z']],
  bread: [['p', 'M0.1 0.75C0.1 0.4 0.9 0.4 0.9 0.75Z']],
  djed: [['r', 0.4, 0.15, 0.2, 0.83], ['r', 0.24, 0.18, 0.52, 0.07], ['r', 0.24, 0.3, 0.52, 0.07], ['r', 0.24, 0.42, 0.52, 0.07]],
  was: [['r', 0.46, 0.2, 0.08, 0.78], ['p', 'M0.46 0.24L0.7 0.06L0.76 0.12L0.54 0.3Z'], ['p', 'M0.46 0.94L0.36 0.99L0.4 0.9Z']],
};
const glyphPath = (name, x, y, s, sx = 1) => GLYPHS[name].map(([k, ...a]) => {
  const X = v => G.fmt(x + v * s * sx), Y = v => G.fmt(y + v * s);
  if (k === 'e') return `M${X(a[0] - a[2])} ${Y(a[1])}A${G.fmt(a[2] * s * sx)} ${G.fmt(a[3] * s)} 0 1 0 ${X(a[0] + a[2])} ${Y(a[1])}A${G.fmt(a[2] * s * sx)} ${G.fmt(a[3] * s)} 0 1 0 ${X(a[0] - a[2])} ${Y(a[1])}Z`;
  if (k === 'r') return `M${X(a[0])} ${Y(a[1])}h${G.fmt(a[2] * s * sx)}v${G.fmt(a[3] * s)}h${G.fmt(-a[2] * s * sx)}Z`;
  if (k === 'ring') { const r1 = a[2], r0 = a[2] - a[3]; return `M${X(a[0] - r1)} ${Y(a[1])}A${G.fmt(r1 * s * sx)} ${G.fmt(r1 * s)} 0 1 0 ${X(a[0] + r1)} ${Y(a[1])}A${G.fmt(r1 * s * sx)} ${G.fmt(r1 * s)} 0 1 0 ${X(a[0] - r1)} ${Y(a[1])}ZM${X(a[0] - r0)} ${Y(a[1])}A${G.fmt(r0 * s * sx)} ${G.fmt(r0 * s)} 0 1 1 ${X(a[0] + r0)} ${Y(a[1])}A${G.fmt(r0 * s * sx)} ${G.fmt(r0 * s)} 0 1 1 ${X(a[0] - r0)} ${Y(a[1])}Z`; }
  // path in unit box: transform numbers pairwise
  let i = 0; return a[0].replace(/-?\d*\.?\d+/g, m => (i++ % 2 === 0 ? X(+m) : Y(+m)));
}).join('');

// ---------- column ----------
function column(doc, { x, w, top, bottom, light = 'left', warm = '#ffb468', cool = '#7fa8ff', stone = '#5a4e5e', depth = 0, seed = 1, paint = true, glyphs = true }) {
  const out = [], rnd = G.rng(seed);
  const shade = Cc.ramp(stone);
  const dark = Cc.shift(stone, { dL: -0.18, toward: 270, dh: 20 });
  const lit = light === 'left';
  // shaft: cylinder gradient (warm lit edge toward the torch, cool rim on the far edge)
  const grad = doc.linear([[0, lit ? Cc.mixHex(stone, warm, 0.25) : dark], [0.22, lit ? Cc.mixHex(stone, warm, 0.12) : shade.mid], [0.55, stone], [0.85, dark], [0.97, Cc.mixHex(dark, cool, 0.35)], [1, Cc.mixHex(dark, cool, 0.5)]], { x1: lit ? 0 : 1, y1: 0, x2: lit ? 1 : 0, y2: 0 });
  const capH = w * 0.95, baseTop = bottom - w * 0.18;
  out.push(`<rect x="${G.fmt(x)}" y="${G.fmt(top + capH)}" width="${G.fmt(w)}" height="${G.fmt(baseTop - top - capH)}" fill="${grad}"/>`);
  // painted bands near the top and the bottom
  const bandY = top + capH + w * 0.12;
  const bands = [['#2b4f8f', 0.06], ['#c9a13c', 0.025], ['#a3402e', 0.05], ['#c9a13c', 0.025], ['#2f7d68', 0.04]];
  let by = bandY;
  for (const [c, h] of bands) { if (paint) out.push(`<rect x="${G.fmt(x)}" y="${G.fmt(by)}" width="${G.fmt(w)}" height="${G.fmt(h * w)}" fill="${c}" opacity="0.55"/>`); by += h * w; }
  // hieroglyph registers: vertical columns of sunk-relief glyphs, compressed toward the edges (cylinder)
  if (glyphs) {
    const names = Object.keys(GLYPHS);
    const cols = 3, gs = w * 0.17;
    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols * 1.6 - 0.8; // -0.8..0.8 around the front
      const cx = x + w / 2 + Math.sin(u) * w / 2 * 0.92, sx = Math.cos(u);
      out.push(`<rect x="${G.fmt(cx - gs * 0.62 * sx)}" y="${G.fmt(by + w * 0.08)}" width="${G.fmt(gs * 1.24 * sx)}" height="${G.fmt(baseTop - by - w * 0.3)}" fill="none" stroke="${dark}" stroke-width="1.2" opacity="0.5"/>`);
      for (let gy = by + w * 0.14; gy < baseTop - w * 0.3 - gs; gy += gs * 1.25) {
        const nm = names[Math.floor(rnd() * names.length)];
        const d = glyphPath(nm, cx - gs * 0.5 * sx, gy, gs, sx);
        // sunk relief: carved shadow on the lit side, a thin light edge on the far side
        out.push(path(d, { fill: dark, opacity: 0.75, transform: `translate(${lit ? 1.4 : -1.4} 1.2)` }));
        out.push(path(d, { fill: Cc.mixHex(stone, lit ? warm : cool, 0.3), opacity: 0.55 }));
        if (paint && rnd() < 0.35) out.push(path(d, { fill: ['#2b4f8f', '#a3402e', '#2f7d68'][Math.floor(rnd() * 3)], opacity: 0.4 }));
      }
    }
  }
  // base
  out.push(`<rect x="${G.fmt(x - w * 0.08)}" y="${G.fmt(baseTop)}" width="${G.fmt(w * 1.16)}" height="${G.fmt(bottom - baseTop)}" fill="${grad}"/>`);
  // open papyrus capital: bell flaring upward with sepal stripes, abacus on top
  const cx = x + w / 2, cw0 = w * 0.55, cw1 = w * 0.95;
  const capTop = top + w * 0.12;
  const bell = `M${G.fmt(cx - cw0)} ${G.fmt(top + capH)}C${G.fmt(cx - cw0 * 1.05)} ${G.fmt(top + capH * 0.6)} ${G.fmt(cx - cw1 * 1.05)} ${G.fmt(capTop + capH * 0.25)} ${G.fmt(cx - cw1)} ${G.fmt(capTop)}L${G.fmt(cx + cw1)} ${G.fmt(capTop)}C${G.fmt(cx + cw1 * 1.05)} ${G.fmt(capTop + capH * 0.25)} ${G.fmt(cx + cw0 * 1.05)} ${G.fmt(top + capH * 0.6)} ${G.fmt(cx + cw0)} ${G.fmt(top + capH)}Z`;
  const cgrad = doc.linear([[0, lit ? Cc.mixHex(stone, warm, 0.3) : dark], [0.5, stone], [1, Cc.mixHex(dark, cool, 0.3)]], { x1: lit ? 0 : 1, y1: 0, x2: lit ? 1 : 0, y2: 0 });
  out.push(path(bell, { fill: cgrad }));
  if (paint) for (let k = -4; k <= 4; k++) {
    const t = k / 4.5;
    out.push(path(`M${G.fmt(cx + t * cw0)} ${G.fmt(top + capH)}Q${G.fmt(cx + t * cw1 * 0.85)} ${G.fmt(top + capH * 0.45)} ${G.fmt(cx + t * cw1 * 0.98)} ${G.fmt(capTop + 4)}`, { fill: 'none', stroke: k % 2 ? '#2f7d68' : '#2b4f8f', 'stroke-width': w * 0.03, opacity: 0.45 }));
  }
  out.push(`<rect x="${G.fmt(cx - cw1 * 0.62)}" y="${G.fmt(top)}" width="${G.fmt(cw1 * 1.24)}" height="${G.fmt(w * 0.12)}" fill="${grad}"/>`);
  return g({ filter: depth ? doc.blur(depth) : null }, out);
}

function brazier(doc, x, y, s = 1) {
  const out = [];
  const bronze = doc.linear([[0, '#8a5a2a'], [0.4, '#e0a050'], [0.6, '#b8783a'], [1, '#4a2a18']], { x1: 0, y1: 0, x2: 1, y2: 0 });
  out.push(path(`M${x - 8 * s} ${y + 120 * s}L${x - 4 * s} ${y + 14 * s}L${x + 4 * s} ${y + 14 * s}L${x + 8 * s} ${y + 120 * s}Z`, { fill: bronze }));
  out.push(path(`M${x - 46 * s} ${y}Q${x} ${y + 38 * s} ${x + 46 * s} ${y}Z`, { fill: bronze }));
  out.push(`<ellipse cx="${x}" cy="${y}" rx="${46 * s}" ry="${8 * s}" fill="#3a2016"/>`);
  // flame: layered tongues with glow
  const flame = (w, h, c, o) => path(`M${x - w * s} ${y}C${x - w * s} ${y - h * 0.4 * s} ${x - w * 0.2 * s} ${y - h * 0.55 * s} ${x} ${y - h * s}C${x + w * 0.35 * s} ${y - h * 0.6 * s} ${x + w * s} ${y - h * 0.45 * s} ${x + w * s} ${y}Z`, { fill: c, opacity: o });
  out.push(`<circle cx="${x}" cy="${y - 40 * s}" r="${150 * s}" fill="#ff9a3c" opacity="0.32" filter="${doc.blur(55 * s)}" style="mix-blend-mode:screen"/>`);
  out.push(flame(40, 110, '#c2321c', 0.9), flame(30, 88, '#f06a1e', 0.95), flame(19, 62, '#ffb43c', 1), flame(9, 34, '#fff1b0', 1));
  out.push(`<g filter="${doc.blur(3 * s)}" style="mix-blend-mode:screen">${flame(44, 120, '#ff7a2a', 0.5)}</g>`);
  return g({ class: 'brazier' }, out);
}

// Main background. v: character view (to place the halo behind the head). opts.accent tints the moonlight.
function background(doc, ch, v, opts = {}) {
  const W = doc.w, H = doc.h, out = [];
  const accent = opts.accent || (ch && ch.bgAccent) || '#6f8cff';
  const sky = doc.linear([[0, '#0b0e26'], [0.45, '#1a1838'], [0.8, '#2a1c2c'], [1, '#1c1218']]);
  out.push(`<rect width="${W}" height="${H}" fill="${sky}"/>`);
  // far hall: rows of hazy columns (atmospheric perspective: lighter, bluer, blurred)
  const far = [];
  for (let i = 0; i < 7; i++) far.push(column(doc, { x: 40 + i * 150 - 20, w: 70, top: 300, bottom: 900, stone: '#3c3d62', depth: 3, seed: 10 + i, paint: false, glyphs: false, light: 'right' }));
  out.push(g({ opacity: 0.55 }, far));
  // clerestory window light: moon beams from the upper right
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const x0 = W * (0.62 + i * 0.09), x1 = W * (0.12 + i * 0.12);
    beams.push(path(`M${x0} 0L${x0 + 40} 0L${x1 + 120} ${H}L${x1} ${H}Z`, { fill: accent, opacity: 0.07 + 0.03 * (i % 2) }));
  }
  out.push(g({ filter: doc.blur(18), style: 'mix-blend-mode:screen' }, beams));
  // floor: stone slabs with a warm pool from the brazier and a cool sheen
  const fy = H * 0.8;
  const floor = doc.linear([[0, '#2a1e26'], [1, '#140e14']]);
  out.push(`<rect x="0" y="${fy}" width="${W}" height="${H - fy}" fill="${floor}"/>`);
  for (let k = -8; k <= 8; k++) out.push(path(`M${W / 2 + k * 30} ${fy}L${W / 2 + k * 180} ${H}`, { stroke: '#0c080c', 'stroke-width': 2, opacity: 0.5 }));
  for (let k = 1; k < 6; k++) { const yy = fy + (H - fy) * (k / 6) ** 1.6; out.push(path(`M0 ${yy}L${W} ${yy}`, { stroke: '#0c080c', 'stroke-width': 2, opacity: 0.45 })); }
  out.push(`<ellipse cx="${W * 0.16}" cy="${fy + 60}" rx="${W * 0.32}" ry="70" fill="#ff8a3a" opacity="0.18" filter="${doc.blur(30)}"/>`);
  // near columns: big left column (lit by the brazier), right column behind the figure
  out.push(column(doc, { x: -60, w: 230, top: -40, bottom: fy + 30, stone: '#6a5560', seed: 3, depth: 1.2 }));
  out.push(column(doc, { x: W - 190, w: 210, top: 10, bottom: fy + 20, stone: '#5d5068', seed: 7, depth: 1.6, light: 'left' }));
  // halo behind the head (focus): soft moonlit glow where the face is
  if (v && opts.head) out.push(`<circle cx="${opts.head[0]}" cy="${opts.head[1]}" r="${opts.haloR || 260}" fill="${accent}" opacity="0.22" filter="${doc.blur(70)}" style="mix-blend-mode:screen"/>`);
  out.push(brazier(doc, W * 0.13, fy - 120, 1));
  // dust motes in the beams
  const rnd = G.rng(42), dust = [];
  for (let i = 0; i < 70; i++) { const x = W * (0.3 + 0.7 * rnd()), y = H * rnd() * 0.8; dust.push(`<circle cx="${G.fmt(x)}" cy="${G.fmt(y)}" r="${G.fmt(0.8 + rnd() * 2.2)}" fill="#dfe8ff" opacity="${G.fmt(0.15 + rnd() * 0.4)}"/>`); }
  out.push(g({ style: 'mix-blend-mode:screen' }, dust));
  doc.add('bg', out.join('\n'));
}

// Foreground pass after the character: vignette and a little warm haze from the brazier side.
function foreground(doc) {
  const W = doc.w, H = doc.h;
  const vig = doc.radial([[0.55, '#000000', 0], [1, '#05030a', 0.75]], { cx: 0.5, cy: 0.45, r: 0.75 });
  doc.add('fx', `<rect width="${W}" height="${H}" fill="${vig}" style="mix-blend-mode:multiply"/>`);
  const warm = doc.radial([[0, '#ff9a4a', 0.16], [1, '#ff9a4a', 0]], { cx: 0.1, cy: 0.62, r: 0.5 });
  doc.add('fx', `<rect width="${W}" height="${H}" fill="${warm}" style="mix-blend-mode:screen"/>`);
}

module.exports = { background, foreground, column, brazier, GLYPHS, glyphPath };
