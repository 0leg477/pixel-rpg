'use strict';
// Sebeka — crocodile. Olive scales, pale belly plates, lime eyes, wavy dark-teal hair, a lotus.
// Teal silk and silver. The broadest of the seven: strong and soft at once (wide shoulders, thick
// waist, big hips, solid arms). Good-natured and playful. Shape language: big soft rounds + the long snout.
const G = require('../lib/geom');
const B = require('../lib/build');
const C = require('../lib/costume');
const Cc = require('../lib/color');
const S = require('../lib/species');
const X = require('../lib/textures');

const pal = {
  scale: '#71803e', belly: '#ddd39f', mark: '#4a5428', eye: '#b8e04a', hair: '#1d5b5c', sheen: '#7fe0d0',
  silk: '#1f8f8a', silkDark: '#13605e', silver: '#c9d3d8', turq: '#3cc7b8', lotus: '#f7d3e0', lotusTip: '#e46c98', kohl: '#14200e',
};
const tailCtrl = [[0, 6, -9], [2, 16, -20], [4, 30, -28], [3, 48, -30], [0, 62, -24], [-4, 72, -10]];

// lotus: two rings of cupped petals around a gold heart, oriented by n (facing) and u (up hint)
function lotus(c, n, R, { mat = 'lotus' } = {}) {
  n = G.norm(n);
  let a = G.norm(G.cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); const b = G.cross(n, a);
  const prims = [];
  const petal = [[-0.32, 0], [0.32, 0], [0.42, 0.45], [0.2, 0.85], [0, 1], [-0.2, 0.85], [-0.42, 0.45]];
  for (const [count, len, lift, off] of [[8, 1.0, 0.35, 0], [6, 0.78, 0.7, 0.4]]) {
    for (let i = 0; i < count; i++) {
      const ang = (i + off) / count * Math.PI * 2;
      const dir = G.add(G.mul(a, Math.cos(ang)), G.mul(b, Math.sin(ang)));
      const out = G.norm(G.add(dir, G.mul(n, lift))); // petals rise toward the facing direction
      const side = G.norm(G.cross(out, n));
      prims.push(B.plane(G.add(c, G.mul(dir, 0.08 * R)), G.mul(side, R * len * 0.9), G.mul(out, R * len), petal, { cup: [-1.2, 0.4], matBack: mat }));
    }
  }
  return { prims, heart: G.add(c, G.mul(n, 0.12 * R)) };
}

const ch = {
  name: 'sebeka', title: 'Себека', species: 'croc', pal,
  scale: 1.06,
  subtitle: 'крокодилица · добродушная, игривая, сильная',
  palNames: { scale: 'чешуя', belly: 'брюхо', eye: 'глаза', hair: 'волосы', silk: 'бирюзовый шёлк', silkDark: 'шёлк в тени', silver: 'серебро', turq: 'бирюза', lotus: 'лотос', lotusTip: 'кончики лепестков' },
  notes: [
    'Самая крупная: широкие плечи, мягкая талия, большие бёдра — сила и мягкость сразу.',
    'Силуэт: длинная морда + тяжёлый хвост + пышные волнистые волосы.',
    'Форма-язык: большие мягкие овалы; острое — только зубки и гребень хвоста.',
    'Бирюза и серебро — прохладная пара к оливковой чешуе; лотос — розовый акцент у лица.',
    'Характер: широкая улыбка (у крокодила она «встроена»), игривый прищур.',
    'Брюшные щитки светлые, поперечные; на спине и хвосте — щитки с гребнем.',
  ],
  body: {
    headR: 12,
    neck: { len: 6.2, r: 6.2, rTop: 5.6 },
    torso: [
      [-49, 7.0, 5.6, -2.0], [-45, 13.4, 7.6, -1.4], [-40, 14.4, 9.6, -0.4], [-35, 14.2, 10.2, 0.2], [-30, 13.4, 9.8, 0.4],
      [-25, 12.4, 9.2, 0.4], [-19, 11.6, 8.8, 0.6], [-15, 11.8, 9.0, 0.8], [-10, 13.4, 9.4, 0.8], [-5, 16.0, 10.2, 0.4],
      [0, 18.2, 11.2, -0.4], [5, 17.6, 11.4, -1.0], [9, 14.4, 9.6, -1.0]],
    shoulder: { x: 15.4 },
    bust: { r: [6.6, 6.2, 5.7], x: 6.6, y: -33.5, z: 6.2 },
    glutes: { r: [10.2, 11.0, 9.6], x: 8.2 },
    arm: { upper: 23.5, fore: 20.5, r: [5.0, 4.6, 3.8, 4.3, 4.2, 2.9] },
    hand: { paw: false, claws: true },
    leg: { thigh: 41, shin: 33, meta: 14, digitigrade: false, hipX: 9.6, r: [11.6, 9.6, 6.4, 6.0, 6.4, 3.6, 3.0] },
    groundY: 82,
    tail: { r: [7.6, 7.0, 6.2, 5.2, 4.0, 2.6, 1.0], ctrl: tailCtrl },
  },
  head: { eyes: {} },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#1c2a12', lash: 0.25, wing: 0.55, wingUp: 0.35, lowerWing: 0.4, tilt: 0.08,
    brow: { color: '#2a3a1a', width: 0.12, y: -1.5 } },
  noseColor: '#1d2010', mouthLine: '#1d2010', whiskers: false,
  hair: { style: 'wavy', opts: { sheen: '#7fe0d0', volume: 1.2, locks: 11, front: true, bang: -0.48, winX: 0.98, bangClumps: 5, wave: 0.36 } },
  hairLines: { lineColor: '#08262a', hiColor: '#5fc0b8', width: 0.08 },
  materials: {
    fur: { base: pal.scale, gloss: 0.975, glossK: 0.35, sss: true }, innerEar: { base: pal.belly },
    hair: { base: pal.hair, sss: true, gloss: 0.965, glossK: 0.5, rimT: 0.05 }, 'hair:inner': { base: '#0b2c2e', shading: 'flat' },
    claw: { base: '#e8e2c8', gloss: 0.9 }, silver: { base: pal.silver, shading: 'metal' }, turq: { base: pal.turq, gloss: 0.92 },
    silk: { base: pal.silk, gloss: 0.985, glossK: 0.35, t1: 0.5, line: '#07302e' },
    lotus: { base: pal.lotus, t1: 0.55, line: '#9a3a5e', sss: true }, gold: { base: '#e6b84a', shading: 'metal' },
  },
  tufts: () => [],
  markings: ({ body, head, pose }) => {
    const R = head.R;
    const m = [...S.SPECIES.croc.markings(R, { ...S.SPECIES.croc.pal, muzzle: pal.belly, mark: pal.mark })];
    // belly plates from throat to navel: pale band with transverse seams
    m.push({ parts: ['neck'], color: pal.belly, fn: p => (p[2] - 2.2 - 0.06 * Math.abs(p[0])) * 1.2 });
    const half = p => 5.0 + 0.1 * (p[1] + 25);
    // rounded top under the halter, soft side edges
    m.push({ parts: ['torso.waist', 'torso.pelvis'], color: pal.belly, opacity: 0.9, fn: p => Math.min(half(p) - Math.abs(p[0]) - 0.15 * Math.max(0, -24 - p[1]) ** 1.5, p[2] - 2, 4 - p[1]) });
    m.push({ parts: ['torso.waist', 'torso.pelvis'], color: '#a99f6a', opacity: 0.45, fn: p => { const f = (p[1] / 2.8) - Math.floor(p[1] / 2.8); return Math.min(half(p) - 0.8 - Math.abs(p[0]), p[2] - 2, p[1] + 25, 4 - p[1], 0.09 - Math.min(f, 1 - f)); } });
    // halter straps from the band up to the neck
    m.push({ parts: ['torso.chest', 'torso.clav', 'torso.bust'], color: pal.silk, fn: p => { if (p[2] < 0 || p[1] > -39) return -1; const t = (p[1] + 39) / -9; const x = 4.2 - 1.6 * t; return 1.0 - Math.abs(Math.abs(p[0]) - x); } });
    // scutes on the outer arms and shoulders
    for (const s of ['L', 'R']) m.push(...X.crocScutes(['arm' + s + '.upper', 'arm' + s + '.delt'], p => ({ u: Math.atan2(p[0], p[2]) * 2.0, v: p[1] / 2.2 }), { crack: '#3f4a22' }).map(x => ({ ...x, opacity: 0.16 })));
    // tail: scutes all round with raised keels on top, pale underside
    const pts = G.catmull(pose.tailCtrl || tailCtrl, { seg: 8 });
    const pp = X.pathParam(pts);
    const param = p => { const q = pp(p); return { u: q.theta * 6 / 2.4, v: q.s / 2.2 }; };
    m.push({ parts: ['tail'], color: pal.belly, fn: p => { const q = pp(p); return Math.cos(q.theta - 1.57) - 0.5; } });
    m.push(...X.crocScutes(['tail'], param, { crack: '#3f4a22', keel: '#a6b468', back: p => { const q = pp(p); return Math.cos(q.theta + 1.57) - 0.4; } }).map(x => ({ ...x, opacity: 0.6 })));
    // silver collar with turquoise beads
    m.push(...C.usekh({ gold: pal.silver, c: [0, -48.5, -1.4], r0: 6.4, sz: 0.9, rows: [{ w: 0.6, color: null }, { w: 1.3, color: pal.turq, beads: 12 }, { w: 0.6, color: null }], drops: { len: 1.6, n: 26, color: pal.turq }, shadow: '#2a4a40' }));
    // silver trim on the halter and the sarong top
    const top = p => p[1] + 40.0 - 0.014 * p[0] * p[0], bot = p => -26.5 - p[1];
    m.push({ parts: C.TORSO, color: pal.silver, edge: Cc.ramp(pal.silver).line, edgeWidth: 0.5, fn: p => Math.max(Math.min(top(p), 0.7 - top(p)), Math.min(bot(p), 0.7 - bot(p))) });
    m.push({ parts: C.TORSO, color: pal.silver, edge: Cc.ramp(pal.silver).line, edgeWidth: 0.6, fn: p => 1.3 - Math.abs(p[1] + 3.2 + 0.02 * p[0] * p[0] * 0) });
    // sarong: wave hem band and a darker teal panel
    m.push({ parts: ['sarong'], color: pal.silkDark, opacity: 0.7, fn: p => 1.8 - Math.abs(p[1] - 40 - 1.2 * Math.sin(Math.atan2(p[0], p[2]) * 7)) });
    return m;
  },
  materialFields: () => [
    // halter band over the bust; soft midriff bare; sarong from the hip line
    { parts: ['torso.*'], fn: p => { const d = Math.min(p[1] + 40.0 - 0.014 * p[0] * p[0], -26.5 - p[1]); return d > 0 ? { mat: 'silk', alt: 'fur', d } : { mat: 'fur', alt: 'silk', d: -d }; } },
    { parts: ['torso.pelvis', 'torso.glute'], fn: p => { const d = p[1] + 3.2; return d > 0 ? { mat: 'silk', alt: 'fur', d } : null; } },
  ],
  hideParts: () => ['legL.thigh', 'legR.thigh', 'legL.shin', 'legR.shin'],
  extraGroups: ({ body, head, pose }) => {
    const out = [];
    const R = head.R, a = body.anchors;
    // long sarong (wrap skirt) with a side slit look via a slanted hem
    out.push(C.skirt(a.pelvisT, [[-3.4, 16.4, 10.8, -0.4], [2, 18.6, 11.8, -0.4], [8, 19.4, 12.4, -0.2], [20, 18.2, 12.4, 0.4], [40, 16.4, 12.0, 1.2], [62, 16.0, 12.0, 2.0], [76, 17.2, 12.8, 2.4]], { mat: 'silk', name: 'sarong', pleats: 22, pleatAmp: 0.4, hem: p => 74 - Math.max(0, -p[0]) * 1.4 }));
    // silver arm cuffs and bracelets
    for (const s of ['L', 'R']) {
      const up = a['upper' + s], fo = a['fore' + s];
      if (up) out.push({ name: 'jewel.arm' + s, k: 0.3, parts: [C.limbBand(up, body.spec.arm.upper, 0.4, 5.6, 1.4, { mat: 'silver', th: 0.42, flare: 0 })] });
      if (fo) out.push({ name: 'jewel.wrist' + s, k: 0.3, parts: [C.limbBand(fo, body.spec.arm.fore, 0.86, 4.0, 1.2, { mat: 'silver', name: 'c1', th: 0.4, flare: 0 }), C.limbBand(fo, body.spec.arm.fore, 0.76, 4.35, 0.6, { mat: 'turq', name: 'c2', th: 0.32, flare: 0 })] });
    }
    // lotus behind the right side of the head (where an ear would be)
    const lh = lotus(head.toWorld([0.95, -0.45, -0.05]), head.dirWorld([0.75, -0.25, 0.55]), R * 0.46);
    out.push({ name: 'lotus.head', k: 0.05, line: 'always', parts: [{ name: 'lotusHead', mat: 'lotus', prims: lh.prims }] });
    out.push({ name: 'lotus.heart', k: 0.05, parts: [{ name: 'lotusHeart', mat: 'gold', prims: [B.sphere(lh.heart, R * 0.06)] }] });
    // a lotus held in the raised hand
    if (pose.lotusHand) {
      const hT = a['hand' + pose.lotusHand];
      const c = G.tapply(hT, [0, 7.5, 3.2]);
      const lf = lotus(c, G.add(G.mvec(hT.R, [0, 0.3, 1]), [0, -0.6, 0.4]), R * 0.58);
      out.push({ name: 'lotus.hand', k: 0.05, line: 'always', parts: [{ name: 'lotusHand', mat: 'lotus', prims: lf.prims }] });
      out.push({ name: 'lotus.heart2', k: 0.05, parts: [{ name: 'lotusHeart2', mat: 'gold', prims: [B.sphere(lf.heart, R * 0.07)] }] });
    }
    return out;
  },
  expressions: {
    neutral: { smile: 0.45, open: 0.9 },
    joy: { smile: 0.9, mouthOpen: 0.35, open: 1.0, brow: { raise: 0.45 }, head: { roll: 0.1, pitch: -0.05 } },
    playful: { smile: 0.75, smirk: 0.3, wink: 'R', tongue: true, mouthOpen: 0.2, head: { roll: -0.14, yaw: 0.15 } },
    laugh: { smile: 1, mouthOpen: 0.6, closed: 'happy', head: { pitch: -0.14, roll: 0.1 } },
    shy: { smile: 0.3, open: 0.65, lowerLid: 0.15, gazeShift: [-0.5, 0.25], blush: 1, brow: { angle: -0.3, raise: 0.25 }, head: { pitch: 0.12, roll: 0.12, yaw: -0.1 } },
    surprised: { smile: 0.1, mouthOpen: 0.4, open: 1.2, brow: { raise: 0.85 }, head: { pitch: -0.05 } },
    tender: { smile: 0.55, open: 0.35, closed: 'calm', blush: 0.5, head: { roll: 0.18, pitch: 0.06 } },
  },
  halfbodyExpr: 'joy',
  refExpr: 'neutral',
  icon: { expr: 'playful', accent: '#5fe0c8', ring: '#c9d3d8', yaw: -0.5, zoom: 5.4, cy: 0.52, cx: 0.44, bgInner: '#2a4a48', bgMid: '#162a2c' },
  bustScale: 7.0, emoCy: 0.5, emoYaw: -0.55, emoFocus: [0, 0.1, 0.55],
  refTop: 2.1,
  refDetails: () => [
    { label: 'голова 3/4', target: b => b.head.toWorld([0, 0, 0.6]), zoom: 9.5, yaw: -0.6 },
    { label: 'лотос и волосы', target: b => b.head.toWorld([0.86, -0.42, -0.1]), zoom: 11, yaw: 0.6 },
    { label: 'колье и пояс', target: b => G.tapply(b.body.anchors.chestT, [0, -26, 8]), zoom: 6.5, yaw: -0.25 },
    { label: 'хвост с гребнем', target: b => b.body.anchors.tail[Math.floor(b.body.anchors.tail.length * 0.5)], zoom: 7.5, yaw: -1.5 },
  ],
  poses: {
    ref: {
      pelvis: { roll: 0.03 }, chest: { roll: -0.03 }, head: { pitch: 0.02 },
      armL: { hand: [-25, 0, 5], pose: 'relaxed', palm: [1, 0, 0.3], pole: [-30, -20, -10] }, armR: { hand: [25, 0, 5], pose: 'relaxed', palm: [-1, 0, 0.3], pole: [30, -20, -10] },
      legL: { foot: [-9, 82, 2] }, legR: { foot: [10, 82, 1] },
    },
    bust: { pelvis: {}, chest: { yaw: 0.1 }, head: { yaw: 0.25 }, armL: { hand: [-18, -2, 6], pose: 'relaxed' }, armR: { hand: [18, -2, 6], pose: 'relaxed' } },
    halfbody: {
      pelvis: { roll: 0.12, yaw: -0.14, pos: [2, 0, 0] }, chest: { roll: -0.1, yaw: 0.16, pitch: -0.03 }, head: { yaw: -0.3, pitch: 0.04, roll: 0.14 },
      armL: { hand: [-6, -46, 16], pole: [-30, -22, -4], pose: 'hold', palm: [0.2, 0, 1], finger: [0.25, -1, 0.15] },
      armR: { hand: [19, -6, 5], pole: [44, -30, -12], pose: 'hip', palm: [-1, 0, 0.15], finger: [-0.1, 1, -0.2] },
      lotusHand: 'L',
      hide: ['legL', 'legR'],
    },
  },
  halfbodyView: { yaw: -0.48, s: 9.4, oy: 1010 },
  bgAccent: '#5fe0c8',
};
module.exports = ch;
