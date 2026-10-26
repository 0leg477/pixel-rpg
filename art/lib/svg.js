'use strict';
// Minimal SVG document builder with layers, defs, cached filters and QA metadata.
const G = require('./geom');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function attrs(a) {
  return Object.entries(a || {}).filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
}
const el = (tag, a, children) => children == null || children === '' ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${Array.isArray(children) ? children.join('') : children}</${tag}>`;
const path = (d, a) => d ? el('path', { d, ...a }) : '';
const g = (a, children) => el('g', a, children);

class Doc {
  constructor(w, h, { title = '', bg = null } = {}) {
    this.w = w; this.h = h; this.title = title; this.bg = bg;
    this.defs = []; this.layers = new Map(); this.order = ['bg', 'back', 'char', 'front', 'fx', 'ui'];
    this.n = 0; this.cache = new Map(); this.crops = {}; this.meta = {};
  }
  uid(p = 'id') { return `${p}${++this.n}`; }
  def(s) { this.defs.push(s); }
  add(layer, s) { if (!s) return; if (!this.layers.has(layer)) this.layers.set(layer, []); this.layers.get(layer).push(s); }
  // cached gaussian blur filter
  blur(std, { region = 0.35 } = {}) {
    const key = 'blur' + std;
    if (!this.cache.has(key)) {
      const id = this.uid('blur');
      this.def(`<filter id="${id}" x="-${region}" y="-${region}" width="${1 + 2 * region}" height="${1 + 2 * region}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${std}"/></filter>`);
      this.cache.set(key, id);
    }
    return `url(#${this.cache.get(key)})`;
  }
  glow(std, strength = 1.4) {
    const key = `glow${std}_${strength}`;
    if (!this.cache.has(key)) {
      const id = this.uid('glow');
      this.def(`<filter id="${id}" x="-1" y="-1" width="3" height="3" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${std}" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope="${strength}"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
      this.cache.set(key, id);
    }
    return `url(#${this.cache.get(key)})`;
  }
  // subtle paper/fur grain overlay filter
  grain(freq = 0.9, opacity = 0.06, seed = 3) {
    const key = `grain${freq}_${opacity}_${seed}`;
    if (!this.cache.has(key)) {
      const id = this.uid('grain');
      this.def(`<filter id="${id}" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 ${opacity * 6} -${opacity * 2.5}"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
      this.cache.set(key, id);
    }
    return `url(#${this.cache.get(key)})`;
  }
  clip(d, { rule = 'evenodd' } = {}) {
    const id = this.uid('clip');
    this.def(`<clipPath id="${id}"><path d="${d}" clip-rule="${rule}"/></clipPath>`);
    return `url(#${id})`;
  }
  linear(stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1, units = 'objectBoundingBox' } = {}) {
    const id = this.uid('lg');
    this.def(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="${units}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`);
    return `url(#${id})`;
  }
  radial(stops, { cx = 0.5, cy = 0.5, r = 0.5, fx = null, fy = null, units = 'objectBoundingBox', transform = null } = {}) {
    const id = this.uid('rg');
    this.def(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx != null ? ` fx="${fx}" fy="${fy}"` : ''} gradientUnits="${units}"${transform ? ` gradientTransform="${transform}"` : ''}>${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`);
    return `url(#${id})`;
  }
  crop(name, box) { this.crops[name] = box.map(v => Math.round(v)); }
  toString() {
    const body = [];
    if (this.bg) body.push(`<rect width="${this.w}" height="${this.h}" fill="${this.bg}"/>`);
    const keys = [...new Set([...this.order, ...this.layers.keys()])];
    for (const k of keys) if (this.layers.has(k)) body.push(`<g data-layer="${k}">${this.layers.get(k).join('\n')}</g>`);
    const meta = esc(JSON.stringify({ crops: this.crops, ...this.meta }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" data-meta="${meta}">` +
      (this.title ? `<title>${esc(this.title)}</title>` : '') +
      `<defs>${this.defs.join('\n')}</defs>\n${body.join('\n')}</svg>`;
  }
}

module.exports = { Doc, el, path, g, attrs, esc, d: G.polyD, rd: G.ringsD };
