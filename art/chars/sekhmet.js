'use strict';
// Sekhmet — lioness warrior. Tawny fur, lush dark-red mane of hair, orange eyes; red scale armour,
// white shendyt kilt, bronze khopesh and a sun disk. Tallest-but-one and the most athletic:
// broad shoulders, defined abs, strong arms. Shape language: wedges and diagonals (shoulders, blade).
const G = require('../lib/geom');
const B = require('../lib/build');
const C = require('../lib/costume');
const Cc = require('../lib/color');
const S = require('../lib/species');

const pal = {
  fur: '#c88d4e', cream: '#f1dcb4', mark: '#3a2418', innerEar: '#e0ad98', nose: '#a85c52', eye: '#ff8a17',
  hair: '#8c1d22', armor: '#b3242b', armorDark: '#6e1218', gold: '#e0ae45', bronze: '#d69a58', linen: '#e4dccb',
  sun: '#f05a28', grip: '#3b2418', kohl: '#1a0c0a', tuft: '#4a1a12',
};
const tailCtrl = [[0, 5, -8], [-5, 14, -14], [-13, 26, -12], [-17, 40, -6], [-14, 52, -1], [-20, 60, 2]];

// khopesh outline in blade space: a along the grip axis (handle at a<4), b across (negative = the convex edge)
const KHOPESH = [[4, -0.55], [11, -0.65], [13, -2.6], [16, -4.0], [19.5, -4.6], [23, -3.8], [25.8, -1.9], [27.4, 0.9],
  [25.5, -0.3], [23, -1.4], [19.5, -2.0], [16.6, -1.6], [14.2, -0.4], [12.6, 0.7], [4, 0.55]].map(([a, b]) => [4 + (a - 4) * 1.2, b * 1.55]);

const ch = {
  name: 'sekhmet', title: 'Сехмет', species: 'lion', pal,
  scale: 1.1, // height relative to Nefer in the lineup
  subtitle: 'львица · воительница · гордая, вспыльчивая, верная',
  palNames: { fur: 'мех', cream: 'морда, горло', hair: 'волосы', eye: 'глаза', armor: 'броня', armorDark: 'броня в тени', gold: 'золото', bronze: 'бронза хопеша', linen: 'шендит', sun: 'солнечный диск' },
  notes: [
    'Силуэт: широкие плечи-клин, узкий таз, длинные ноги; хопеш — главная диагональ.',
    'Самая атлетичная: пресс, рельеф рук, крепкая шея. Голова меньше относительно тела.',
    'Форма-язык: клинья и диагонали (наплечники, клинок, стрелки глаз).',
    'Пышная тёмно-красная грива волос — рама для лица и «огонь» силуэта.',
    'Красная чешуйчатая броня + белый шендит: тёплое/светлое разделение по поясу.',
    'Солнечный диск над головой — знак богини; пламенный акцент в иконке.',
    'Характер в лице: подбородок вверх, тяжёлые веки, уверенная полуулыбка.',
  ],
  body: {
    headR: 10.6,
    neck: { len: 5.4, r: 5.9, rTop: 5.2 },
    torso: [
      [-49, 6.8, 5.4, -2.0], [-45, 12.8, 7.2, -1.4], [-40, 13.8, 8.8, -0.4], [-35, 13.4, 9.2, 0.2], [-30, 12.4, 8.8, 0.3],
      [-25, 11.0, 8.0, 0.0], [-19, 9.9, 7.4, -0.3], [-15, 9.8, 7.2, -0.2], [-10, 10.8, 7.6, 0.1], [-5, 13.0, 8.4, 0.0],
      [0, 14.8, 9.4, -0.6], [5, 14.4, 9.6, -1.2], [9, 11.6, 8.0, -1.0]],
    shoulder: { x: 15.2, y: -45, z: -1.5 },
    bust: { r: [5.0, 4.7, 4.4], x: 6.2 },
    abs: 0, muscle: 0.6,
    arm: { upper: 23.5, fore: 20.5, r: [5.0, 4.3, 3.4, 3.9, 3.9, 2.6] },
    leg: { thigh: 44, shin: 34, meta: 16, r: [10.0, 8.2, 5.4, 5.3, 5.9, 3.0, 2.5] },
    groundY: 87,
    tail: { r: [2.3, 2.1, 1.9, 1.75, 1.6, 1.5], ctrl: tailCtrl },
    hand: { paw: true, claws: true },
  },
  head: { eyes: { w: 0.37, theta: 0.43 } },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#2a120c', lash: 0.2, wing: 0.75, wingUp: 0.42, lowerWing: 0.6, tilt: 0.24,
    brow: { color: '#5a1a14', width: 0.15, y: -1.4 } },
  noseColor: pal.nose, mouthLine: '#3a1c18', whiskerColor: '#fff2df',
  hair: { style: 'mane', opts: { sheen: '#ff8a64', volume: 1.05 } },
  hairLines: { lineColor: '#3a0a0e', hiColor: '#e0584a', width: 0.09 },
  materials: {
    fur: { base: pal.fur, sss: true }, innerEar: { base: pal.innerEar, edgeLine: false },
    hair: { base: pal.hair, sss: true, gloss: 0.965, glossK: 0.45, rimT: 0.05, ramp: { shadow: '#5e1220', core: '#4a0e1a' } }, 'hair:inner': { base: '#3e0a10', shading: 'flat' },
    claw: { base: '#f3e7cf', gloss: 0.9 }, gold: { base: pal.gold, shading: 'metal' }, bronze: { base: pal.bronze, shading: 'metal' },
    armor: { base: pal.armor, gloss: 0.988, glossK: 0.22, hiK: 0.4, t1: 0.4, line: '#3e070c' }, linen: { base: pal.linen, t0: 0.04, t1: 0.5, line: '#6f6457' },
    sun: { base: pal.sun, gloss: 0.9, glossK: 0.6 }, grip: { base: pal.grip }, tuft: { base: pal.tuft, sss: true },
  },
  tufts: ({ Rs, head }) => [
    ...S.SPECIES.lion.tufts(head.R, Rs.view.s),
    { parts: ['tail.tip'], amp: 0.9 * Rs.view.s, period: 2.2 * Rs.view.s, flow: [0, 1], lean: 0.8, inner: false },
  ],
  markings: ({ body, head }) => {
    const R = head.R;
    const m = [...S.SPECIES.lion.markings(R, { ...S.SPECIES.lion.pal, muzzle: pal.cream, mark: pal.mark })];
    // abs drawn the way artists do it: linea alba + three tendinous lines, not six bumps
    m.push({ parts: ['torso.waist', 'torso.chest', 'torso.pelvis'], color: '#8a5a32', opacity: 0.38, fn: p => {
      if (p[2] < 2) return -1;
      const alba = Math.min(0.22 - Math.abs(p[0]), p[1] + 25, -9 - p[1]);
      let rows = -1;
      for (const [y, k] of [[-21.5, 0], [-17.2, 0.3], [-13, 0.6]]) { const ax = Math.abs(p[0]); rows = Math.max(rows, Math.min(0.2 + 0.08 * (ax - 1) - Math.abs(p[1] - y - 0.25 * (ax - 2.5)), ax - 0.9, 4.2 - k - ax)); }
      return Math.max(alba, rows) * 2;
    } });
    m.push({ parts: ['neck'], color: pal.cream, opacity: 0.9, fn: p => (p[2] - 1.6 - 0.1 * Math.abs(p[0])) * 0.8 });
    // dark backs of the ears
    m.push({ parts: ['head.earL', 'head.earR'], color: '#4a2a1c', opacity: 0.8, fn: p => { const q = p.map(v => v / R); return (Math.abs(q[0]) - 0.82) * 4 - q[2] * 3; } });
    for (const s of ['L', 'R']) m.push(...C.pawPads(s, '#7a3a30', body.anchors['tipPads' + s]));
    // armour: overlapping scale rows (darker crescents), gold trim at the hem and neckline
    m.push({ parts: ['torso.chest', 'torso.clav', 'torso.bust', 'torso.waist'], color: pal.armorDark, opacity: 0.25, fn: p => {
      if (p[1] > -27 || p[1] < -46.5) return -1;
      const row = Math.floor((p[1] + 46) / 2.6), off = row % 2 ? 1.7 : 0;
      const cx = Math.round((p[0] - off) / 3.4) * 3.4 + off, cy = -46 + row * 2.6 + 2.6;
      const d = Math.hypot((p[0] - cx) / 1.7, (p[1] - cy) / 1.25);
      return (d - 0.82) * 1.2;
    } });
    m.push({ parts: C.TORSO, color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.6, fn: p => { const hem = p[1] + 26.5 - 0.02 * p[0] * p[0]; return Math.max(Math.min(hem + 1.1, -hem), Math.min(-(p[1] + 46.8) + 1.1, p[1] + 46.8)); } });
    // belt: gold with red inlay squares above the kilt
    m.push({ parts: C.TORSO, color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.6, fn: p => 1.6 - Math.abs(p[1] + 8.4) });
    m.push({ parts: C.TORSO, color: pal.armor, fn: p => { const a = Math.atan2(p[0], p[2]); return Math.min(0.8 - Math.abs(p[1] + 8.4), 0.25 - Math.abs(Math.sin(a * 10)) * 0.5); } });
    // kilt: front apron panel (red and gold stripes) and pleats are in the skirt bump
    m.push({ parts: ['shendyt'], color: pal.armor, fn: p => { const w = 1.9 + (p[1] + 8) * 0.12; return Math.min(w - Math.abs(p[0]), p[2] - 2); } });
    m.push({ parts: ['shendyt'], color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.5, fn: p => { const h = 21 + p[0] * 0.28; return Math.min(p[1] - h + 1.3, h - p[1] + 0.2); } });
    m.push({ parts: ['shendyt'], color: pal.gold, fn: p => { const w = 1.9 + (p[1] + 8) * 0.12; return Math.min(w - Math.abs(p[0]), p[2] - 2, 0.42 - Math.abs(((p[1] + 100) % 3.0) - 1.5)); } });
    return m;
  },
  materialFields: () => [
    // cuirass over the chest down to the lower ribs; abs bare
    { parts: ['torso.*'], fn: p => { const d = -(p[1] + 26.5 - 0.02 * p[0] * p[0]); const nk = p[1] + 47.2; const v = Math.min(d, nk); return v > 0 ? { mat: 'armor', alt: 'fur', d: v } : { mat: 'fur', alt: 'armor', d: -v }; } },
  ],
  hideParts: () => [],
  extraGroups: ({ body, head, pose }) => {
    const out = [];
    const R = head.R;
    const a = body.anchors;
    // shendyt: short white kilt from the belt to mid-thigh, flared at the front
    // wide enough to contain the thighs in a planted stance; the wrap hem rises toward her left
    out.push(C.skirt(a.pelvisT, [[-9.6, 10.6, 7.7, 0.1], [-5, 13.4, 8.8, 0.2], [1, 16.4, 10.2, 0.3], [8, 18.4, 11.2, 0.4], [16, 19.3, 11.8, 0.6], [26, 19.8, 12.3, 1.0]], { mat: 'linen', name: 'shendyt', pleats: 34, pleatAmp: 0.3, hem: p => 21 + p[0] * 0.28 }));
    // pauldrons: layered armour caps over the deltoids
    for (const s of ['L', 'R']) {
      const up = a['upper' + s]; if (!up) continue;
      const sg = s === 'L' ? -1 : 1;
      // three overlapping lames, each its own group so a line separates them
      // a domed shoulder shell and one lame below it
      for (let k = 0; k < 2; k++) out.push({ name: 'pauldron' + s + k, k: 0.2, line: 'always', parts: [{ name: 'pauldron', mat: 'armor', frame: up, prims: [B.xform(k ? B.ell([sg * 2.9, 4.6, 0], [3.3, 3.4, 5.9]) : B.ell([sg * 2.3, 0.2, 0], [4.0, 5.2, 6.6]), up)] }] });
      const fo = a['fore' + s];
      // bracers: long red guards with gold rims
      if (fo) out.push({ name: 'bracer' + s, k: 0.3, parts: [
        C.limbBand(fo, body.spec.arm.fore, 0.58, 4.25, 3.6, { name: 'bracer', mat: 'armor', th: 0.5, flare: 0.0 }),
        C.limbBand(fo, body.spec.arm.fore, 0.74, 3.85, 3.6, { name: 'bracer2', mat: 'armor', th: 0.5, flare: 0.0 }),
        C.limbBand(fo, body.spec.arm.fore, 0.5, 4.45, 0.7, { name: 'rim1', th: 0.36, flare: 0 }), C.limbBand(fo, body.spec.arm.fore, 0.83, 4.05, 0.7, { name: 'rim2', th: 0.36, flare: 0 })] });
    }
    // greaves: gold bands on the shins
    for (const s of ['L', 'R']) {
      const kn = a['knee' + s], hk = a['hock' + s];
      if (kn && hk) { const fr = Body().segFrame(kn, hk); const L = G.len(G.sub(hk, kn)); out.push({ name: 'greave' + s, k: 0.3, parts: [C.limbBand(fr, L, 0.62, 5.6, 1.0, { name: 'g1' }), C.limbBand(fr, L, 0.8, 5.0, 0.7, { name: 'g2' })] }); }
    }
    // tail tuft
    if (a.tail) { const t = a.tail, e = t[t.length - 1], d = G.norm(G.sub(e, t[t.length - 3])); out.push({ name: 'tail.tuft', k: 0.6, parts: [{ name: 'tail.tip', mat: 'tuft', prims: [B.ellBetween(G.sub(e, G.mul(d, 1.5)), G.add(e, G.mul(d, 5)), 2.6, 2.4)] }] }); }
    // sun disk crowning the mane, gold rim
    const sc = head.toWorld([0, -1.95, -0.55]), sn = head.dirWorld([0, -0.05, 1]);
    out.push({ name: 'sun', k: 0.1, parts: [{ name: 'sun', mat: 'sun', prims: [C.disc(sc, sn, 0.62 * R, 0.16)] }] });
    out.push({ name: 'sun.rim', k: 0.1, line: 'always', parts: [{ name: 'rim', mat: 'gold', prims: C.torus(sc, sn, 0.64 * R, 0.05 * R) }] });
    // khopesh in the right hand: grip through the fist, blade rising out of the thumb side
    const hT = a.handR;
    if (hT && pose.khopesh !== false) {
      const xh = G.mvec(hT.R, [1, 0, 0]);
      const U = pose.bladeDir ? G.norm(pose.bladeDir) : (xh[1] > 0 ? G.mul(xh, -1) : xh); // grip axis, pointing up
      const grip = G.tapply(hT, [0, 5.8, 1.9]);
      let V = G.norm(G.cross([0, 0, 1], U)); if (V[0] > 0) V = G.mul(V, -1); // convex edge faces outward
      const P = (u, v) => G.add(grip, G.add(G.mul(U, u), G.mul(V, v)));
      out.push({ name: 'khopesh.grip', k: 0.2, line: 'always', parts: [{ name: 'grip', mat: 'grip', prims: B.sweep([P(-4.6, 0), P(4.2, 0)], 0.8, { spacing: 0.3 }) }] });
      out.push({ name: 'khopesh.pommel', k: 0.1, parts: [{ name: 'pommel', mat: 'gold', prims: [B.sphere(P(-5.2, 0), 1.05)] }, { name: 'guard', mat: 'gold', prims: [B.ellBetween(P(3.9, 0), P(4.9, 0), 1.25, 1.0)] }] });
      out.push({ name: 'khopesh.blade', k: 0.1, line: 'always', parts: [{ name: 'blade', mat: 'bronze', prims: [B.plane(grip, U, V, KHOPESH, { cup: [0.15, 1.6] })] }] });
    }
    return out;
  },
  expressions: {
    neutral: { smile: 0.15, open: 0.8, lowerLid: 0.1 },
    proud: { smile: 0.35, smirk: 0.25, open: 0.62, lowerLid: 0.18, brow: { angle: 0.15 }, head: { pitch: -0.1, yaw: 0.15 }, ears: { perk: 0.4 } },
    fury: { smile: -0.5, mouthOpen: 0.75, fangs: true, teeth: true, open: 0.85, lowerLid: 0.3, brow: { angle: 0.9, raise: -0.1 }, head: { pitch: 0.08, yaw: -0.12, roll: 0.06 }, ears: { flat: 1 } },
    smirk: { smile: 0.4, smirk: 0.6, open: 0.55, lowerLid: 0.22, brow: { angle: 0.1 }, browSide: { R: { raise: 0.45, angle: -0.25 } }, head: { roll: -0.1, yaw: 0.25 } },
    laugh: { smile: 0.9, mouthOpen: 0.65, closed: 'happy', fangs: true, head: { pitch: -0.18, roll: 0.08 }, ears: { perk: 0.5 } },
    surprised: { smile: 0, mouthOpen: 0.35, open: 1.2, brow: { raise: 0.85 }, head: { pitch: -0.04 }, ears: { perk: 1 } },
    flustered: { smile: -0.1, smirk: -0.2, open: 0.7, gazeShift: [0.6, 0.15], brow: { angle: -0.35, raise: 0.3 }, blush: 1, head: { yaw: -0.2, pitch: 0.1, roll: 0.06 }, ears: { droop: 0.4 } },
  },
  halfbodyExpr: 'proud',
  refExpr: 'neutral',
  icon: { expr: 'proud', accent: '#ff6a3a', ring: '#e0ae45', yaw: -0.32, zoom: 4.9, cy: 0.56, bgInner: '#5a2a3a', bgMid: '#2c1626' },
  bustScale: 8.6, emoCy: 0.47,
  refTop: 2.7,
  refDetails: () => [
    { label: 'голова 3/4', target: b => b.head.anchors.cranium, zoom: 13, yaw: -0.45 },
    { label: 'броня и наплечник', target: b => G.tapply(b.body.anchors.chestT, [7, -38, 6]), zoom: 8.5, yaw: -0.3 },
    { label: 'хопеш', target: b => G.tapply(b.body.anchors.handR, [0, 6, 0]), zoom: 6.5, yaw: -0.1 },
    { label: 'шендит и пояс', target: b => G.tapply(b.body.anchors.pelvisT, [0, 4, 8]), zoom: 8.5, yaw: -0.25 },
  ],
  poses: {
    ref: {
      pelvis: { roll: 0.03 }, chest: { roll: -0.02 }, head: { pitch: -0.03 },
      armL: { hand: [-24, -2, 3], pose: 'relaxed', palm: [1, 0, 0.3], pole: [-30, -20, -10] },
      armR: { hand: [23, -4, 7], pose: 'grip', palm: [-1, 0, 0.2], finger: [0, 0.3, 1], pole: [34, -20, -10] },
      legL: { foot: [-9, 87, 3] }, legR: { foot: [10, 87, 2] },
    },
    bust: { pelvis: {}, chest: { yaw: 0.1 }, head: { yaw: 0.2 }, armL: { hand: [-17, -2, 6], pose: 'relaxed' }, armR: { hand: [17, -2, 6], pose: 'relaxed' }, khopesh: false },
    halfbody: {
      pelvis: { roll: -0.09, yaw: 0.12, pos: [-2, 0, 0] }, chest: { roll: 0.08, yaw: -0.12, pitch: -0.05 }, head: { yaw: 0.2, pitch: -0.08, roll: -0.04 },
      armL: { hand: [-17.5, -8, 3], pole: [-46, -30, -12], pose: 'fist', palm: [1, 0, 0.1], finger: [0.2, 1, 0.3] },
      armR: { hand: [25, -19, 12], pole: [40, -10, -20], pose: 'grip', palm: [-1, 0, 0.2], finger: [-0.2, 0.15, 1] },
      bladeDir: [0.62, -1, 0.15],
      hide: ['legL', 'legR'],
    },
  },
  halfbodyView: { yaw: -0.38, s: 9.6, oy: 980 },
  bgAccent: '#ff7a3a',
};
// lazy require to keep the module graph flat
function Body() { return require('../lib/body'); }
module.exports = ch;
