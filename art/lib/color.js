'use strict';
// Colour in OKLab/OKLCH: perceptually even lightness, so ramps keep their value steps.

const clamp01 = x => Math.max(0, Math.min(1, x));
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}
function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
}
const toLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const toSrgb = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

function rgbToOklab([r, g, b]) {
  r = toLin(r); g = toLin(g); b = toLin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabToRgb([L, a, b]) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
function hexToOklch(h) {
  const [L, a, b] = rgbToOklab(hexToRgb(h));
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
}
const inGamut = rgb => rgb.every(v => v >= -0.001 && v <= 1.001);
function oklchToHex([L, C, H]) {
  // reduce chroma until the colour fits in sRGB
  let c = C;
  for (let i = 0; i < 30; i++) {
    const rgb = oklabToRgb([L, c * Math.cos(H * Math.PI / 180), c * Math.sin(H * Math.PI / 180)]);
    if (inGamut(rgb)) return rgbToHex(rgb);
    c *= 0.92;
  }
  return rgbToHex(oklabToRgb([L, 0, 0]));
}
// Shortest signed hue difference.
const hueDelta = (from, to) => ((to - from + 540) % 360) - 180;
const turnHue = (h, toward, amount) => {
  const d = hueDelta(h, toward);
  const step = Math.sign(d) * Math.min(Math.abs(d), amount);
  return (h + step + 360) % 360;
};

// Adjust a colour: dL lightness delta, cK chroma multiplier, hue rotated toward `toward` by `dh` degrees.
function shift(hex, { dL = 0, cK = 1, toward = null, dh = 0, L = null, C = null } = {}) {
  const [l, c, h] = hexToOklch(hex);
  const nh = toward == null ? (h + dh + 360) % 360 : turnHue(h, toward, dh);
  return oklchToHex([L == null ? clamp01(l + dL) : L, C == null ? Math.max(0, c * cK) : C, nh]);
}
function mixHex(a, b, t) {
  const A = rgbToOklab(hexToRgb(a)), B = rgbToOklab(hexToRgb(b));
  return rgbToHex(oklabToRgb(A.map((v, i) => v + (B[i] - v) * t)));
}
const lightness = hex => hexToOklch(hex)[0];
const luma = hex => { const [r, g, b] = hexToRgb(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// Light environment: key light warm (torch / sun), shadows cool. Reversible for cold moonlight.
const WARM = 70, COOL = 275, RED = 30;
// Material ramp with hue shift: shadows cooler and a bit more saturated, highlights warmer and less saturated.
function ramp(base, { warmLight = true, depth = 1 } = {}) {
  const hot = warmLight ? WARM : COOL, cold = warmLight ? COOL : WARM;
  const [L, C] = hexToOklch(base);
  const low = L < 0.35; // dark materials: lift shadows less, rely on rim
  return {
    base,
    hi: shift(base, { dL: 0.10 * depth, cK: 0.80, toward: hot, dh: 14 }),
    light: shift(base, { dL: 0.05 * depth, cK: 0.92, toward: hot, dh: 7 }),
    mid: shift(base, { dL: -0.05 * depth, cK: 1.04, toward: cold, dh: 6 }),
    shadow: shift(base, { dL: -(low ? 0.07 : 0.14) * depth, cK: 1.12, toward: cold, dh: 18 }),
    core: shift(base, { dL: -0.06 * depth, cK: 1.45, toward: RED, dh: 16 }), // warm terminator band (subsurface)
    deep: shift(base, { dL: -(low ? 0.12 : 0.26) * depth, cK: 1.05, toward: cold, dh: 26 }),
    line: shift(base, { L: Math.min(0.30, L * 0.42 + 0.04), cK: C > 0.04 ? 1.1 : 1, toward: cold, dh: 20 }),
    rim: shift(base, { dL: 0.22, cK: 0.55, toward: cold, dh: 30 }),
  };
}
// Scene shadow colour for multiply layers (one light per scene -> one shadow tint).
function multiplyTint(key = 'torch') {
  return { torch: '#a796c8', moon: '#7d8fc4', sun: '#b3a2cf', fire: '#a07ab0', neutral: '#b8b0c8' }[key] || key;
}

module.exports = { hexToRgb, rgbToHex, hexToOklch, oklchToHex, shift, mixHex, ramp, lightness, luma, multiplyTint, turnHue, hueDelta };
