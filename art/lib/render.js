'use strict';
// SVG -> PNG (2x) plus QA variants: grayscale, black silhouette, mirror, 100px thumbnail,
// 3x crops of face and hands (boxes from the svg data-meta), and a QA contact sheet.
//
//   node art/lib/render.js file.svg [more.svg ...] [--qa] [--scale 2] [--qadir art/qa]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function readMeta(svg) {
  const m = svg.match(/data-meta="([^"]*)"/);
  if (!m) return { crops: {} };
  try { return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&')); } catch { return { crops: {} }; }
}
function size(svg) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return [Math.round(+m[1]), Math.round(+m[2])];
}
const page = (body, css = '') => `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff}${css}</style></head><body>${body}</body></html>`;

async function shot(browser, html, w, h, scale, out, clip = null) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: out, clip: clip || { x: 0, y: 0, width: w, height: h }, omitBackground: false });
  await p.close();
}

async function renderOne(browser, file, { scale = 2, qa = false, qadir = null } = {}) {
  const svg = fs.readFileSync(file, 'utf8');
  const [w, h] = size(svg);
  const meta = readMeta(svg);
  const png = file.replace(/\.svg$/, '.png');
  await shot(browser, page(svg), w, h, scale, png);
  const res = { png, qa: {} };
  if (!qa) return res;
  const base = path.basename(file, '.svg');
  const dir = qadir || path.join(path.dirname(file), '..', 'qa');
  fs.mkdirSync(dir, { recursive: true });
  const q = n => path.join(dir, `${base}_${n}.png`);
  // grayscale (value check)
  await shot(browser, page(svg, 'svg{filter:grayscale(1)}'), w, h, 1, q('bw'));
  // black silhouette of the character layer only
  await shot(browser, page(svg, 'g[data-layer]{display:none} g[data-layer="char"]{display:inline;filter:brightness(0)} svg>rect{display:none}'), w, h, 1, q('sil'));
  // mirror
  await shot(browser, page(svg, 'svg{transform:scaleX(-1)}'), w, h, 1, q('mirror'));
  // 100 px thumbnail (fits into 100x100)
  const k = 100 / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
  await shot(browser, page(svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${tw}" height="${th}"`)), tw, th, 1, q('thumb100'));
  // crops at 3x
  for (const [name, box] of Object.entries(meta.crops || {})) {
    const [x, y, cw, ch] = box;
    await shot(browser, page(svg), w, h, 3, q(name), { x, y, width: cw, height: ch });
    res.qa[name] = q(name);
  }
  // contact sheet
  const imgs = ['bw', 'sil', 'mirror', 'thumb100', ...Object.keys(meta.crops || {})].map(n => q(n)).filter(fs.existsSync);
  const H = 420;
  const cells = [png, ...imgs].map(f => {
    const data = fs.readFileSync(f).toString('base64');
    const label = path.basename(f).replace(base + '_', '').replace('.png', '');
    return `<figure><img src="data:image/png;base64,${data}"><figcaption>${label}</figcaption></figure>`;
  }).join('');
  const sheet = `<!doctype html><html><head><style>body{margin:0;background:#222;color:#ddd;font:13px sans-serif;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:1580px}
    figure{margin:0;background:#333;padding:4px} img{height:${H}px;display:block;image-rendering:auto} figure:nth-child(5) img{height:auto} figcaption{text-align:center}</style></head><body>${cells}</body></html>`;
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await p.setContent(sheet, { waitUntil: 'load' });
  await p.screenshot({ path: q('qa'), fullPage: true });
  await p.close();
  res.qa.sheet = q('qa');
  return res;
}

async function render(files, opt = {}) {
  const browser = await chromium.launch();
  const out = [];
  try { for (const f of files) out.push(await renderOne(browser, f, opt)); }
  finally { await browser.close(); }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const files = args.filter(a => a.endsWith('.svg'));
  const opt = { qa: args.includes('--qa') };
  const si = args.indexOf('--scale'); if (si >= 0) opt.scale = +args[si + 1];
  const qi = args.indexOf('--qadir'); if (qi >= 0) opt.qadir = args[qi + 1];
  render(files, opt).then(r => r.forEach(x => console.log(x.png, x.qa.sheet || ''))).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { render };
