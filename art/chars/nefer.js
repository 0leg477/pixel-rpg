'use strict';
// Nefer — cat, priestess of Bastet. Sand fur with tabby stripes, turquoise eyes, blue-black bob.
// Shape language: soft S-curves + sharp kohl wings and ear tips (lazy elegance with a sting).
const G = require('../lib/geom');
const B = require('../lib/build');
const C = require('../lib/costume');
const Cc = require('../lib/color');

const pal = {
  fur: '#d6a466', cream: '#f6e4c4', stripe: '#9d6436', hair: '#161c3b', sheen: '#6a8be0',
  eye: '#1fc2b2', nose: '#c67f80', innerEar: '#e2a29b', pad: '#b9787a',
  linen: '#d3c6ad', lapis: '#2347a0', gold: '#d9a640', turq: '#35b4a6', carn: '#b4452f', kohl: '#120e1c',
};

const tailCtrl = [[0, 5, -8], [-6, 13, -15], [-17, 15, -9], [-21, 6, 3], [-15, -2, 11], [-7, -4, 13]];

const ch = {
  name: 'nefer', title: 'Нефер', species: 'cat', pal,
  subtitle: 'кошка · жрица Бастет · ленивая, язвительная, кокетливая',
  palNames: { fur: 'мех', cream: 'морда, горло', stripe: 'полоски табби', hair: 'волосы', eye: 'глаза', nose: 'нос', innerEar: 'уши внутри', linen: 'лён', lapis: 'лазурит', gold: 'золото', turq: 'бирюза', carn: 'сердолик' },
  notes: [
    'Форма-язык: мягкие S-кривые тела + острые стрелки глаз и кончики ушей.',
    'Характер в лице: полуприкрытые веки, ухмылка, голова чуть набок.',
    'Каре — тяжёлый блок чёрного; лицо открыто в окне чёлки.',
    'Акцент (золото, лазурит) только у лица и кистей; лён — зона отдыха.',
    'Табби-полоски на щеках, руках и хвосте; горло и морда кремовые.',
    'Серьги-кольца прямо в ушах — отсылка к бронзовой кошке Бастет.',
    'Пропорции: голова крупнее реализма (аниме-фурри), «песочные часы».',
  ],
  refDetails: () => [
    { label: 'голова 3/4', target: b => b.head.anchors.cranium, zoom: 13, yaw: -0.45 },
    { label: 'усех и пояс', target: b => G.tapply(b.body.anchors.chestT, [0, -36, 8]), zoom: 11, yaw: -0.25 },
    { label: 'лапа и браслеты', target: b => G.tapply(b.body.anchors.handR, [0, 2, 0]), zoom: 11, yaw: -0.2, pitch: 0.05 },
    { label: 'серьги в ушах', target: b => G.lerp(b.head.anchors.earR.base, b.head.anchors.earR.tip, 0.45), zoom: 13, yaw: 0.55 },
  ],
  icon: { expr: 'wink', accent: '#4fd1c5', ring: '#d9a640', yaw: -0.3, zoom: 4.1, cy: 0.53 },
  body: {
    headR: 12.5,
    bust: { r: [5.4, 5.1, 4.7] },
    tail: { r: [2.5, 2.35, 2.25, 2.1, 1.7], ctrl: tailCtrl },
    hand: { paw: true, claws: true },
  },
  head: { eyes: { w: 0.35, theta: 0.46 } },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#2a1a24', lash: 0.24, wing: 0.7, wingUp: 0.38, lowerWing: 0.55, tilt: 0.2,
    brow: { color: '#5a3a26', width: 0.12, y: -1.5 } },
  noseColor: pal.nose, mouthLine: '#3b2226', whiskerColor: '#fff6e6',
  hair: { style: 'bob', opts: { bang: -0.4, winX: 0.98, winZ: -0.1, cut: 0.8, sheen: '#7d9cff' } },
  bustScale: 8.2,
  hairLines: { lineColor: '#090b18', hiColor: '#4e6bb8', width: 0.08 },
  materials: {
    fur: { base: pal.fur, sss: true }, innerEar: { base: pal.innerEar, edgeLine: false }, hair: { base: pal.hair, rimT: 0.05, t1: 0.3, hiK: 0.35, rimK: 0.8, gloss: 0.968, glossK: 0.6 },
    claw: { base: '#f5ecd8', gloss: 0.9 }, linen: { base: pal.linen, t0: 0.02, t1: 0.6, edgeLine: true, line: '#6f6255' }, 'hair:inner': { base: '#0b0e22', shading: 'flat' }, gold: { base: pal.gold, shading: 'metal' }, lapis: { base: pal.lapis, gloss: 0.9 },
  },
  tufts: ({ Rs }) => [
    { parts: ['head.cheek', 'head.jaw'], amp: 0.22 * 12.5 * Rs.view.s, period: 0.3 * 12.5 * Rs.view.s, flow: [0, 1], lean: 0.9, where: n => n[1] > 0.0 },
  ],
  markings: ({ body, head }) => {
    const R = head.R, u = p => p.map(v => v / R);
    const tailPts = G.catmull(tailCtrl, { seg: 8 });
    const tailS = p => { // arc-length param of the nearest tail point (pelvis rest coords)
      let best = 0, bd = 1e9, acc = 0, sAt = 0;
      for (let i = 0; i < tailPts.length; i++) { if (i) acc += G.len(G.sub(tailPts[i], tailPts[i - 1])); const d = G.len(G.sub(p, tailPts[i])); if (d < bd) { bd = d; sAt = acc; } }
      return { s: sAt, total: acc };
    };
    const m = [];
    // cream muzzle, chin and throat
    m.push({ parts: ['head.muzzle', 'head.jaw', 'head.cheek'], color: pal.cream, fn: p => { const q = u(p); return 0.5 - Math.hypot(q[0] / 1.15, (q[1] - 0.5) * 1.15, (q[2] - 0.58) * 0.8); } });
    m.push({ parts: ['neck'], color: pal.cream, fn: p => (-p[2] - 1.2) * 0.8 + 0.4 * Math.sin(p[1] * 0.6) });
    // tabby stripes on the cheeks (two curved strokes per side)
    m.push({ parts: ['head.cheek', 'head.cranium'], color: pal.stripe, opacity: 0.9, fn: p => {
      const q = u(p), s = Math.sign(q[0]) || 1, ax = Math.abs(q[0]);
      let v = -1;
      for (const [y0, k] of [[0.12, 0.0], [0.3, 0.06]]) {
        const yy = y0 + (ax - 0.6) * 0.35 + k;
        const along = G.smoothstep(0.62, 0.78, ax) * (1 - G.smoothstep(1.05, 1.15, ax));
        v = Math.max(v, (0.022 * along - Math.abs(q[1] - yy)));
      }
      return v * 3;
    } });
    // arm stripes (bands across forearm and upper arm, outer side only)
    for (const s of ['L', 'R']) {
      m.push({ parts: ['arm' + s + '.fore', 'arm' + s + '.upper'], color: pal.stripe, opacity: 0.85, fn: p => {
        const centers = [3.5, 8.5, 12.8, 17.5, 21.5], widths = [0.7, 0.55, 0.8, 0.5, 0.65];
        let band = -9; centers.forEach((c0, i) => { band = Math.max(band, widths[i] * (1 + 0.25 * Math.sin(p[2] * 0.9 + i)) - Math.abs(p[1] - c0 - 0.6 * Math.sin(p[2] * 0.5))); });
        const outer = (s === 'L' ? -p[0] : p[0]) * 0.35 + p[2] * 0.12 + 0.6;
        return Math.min(band, outer);
      } });
    }
    // tail rings and dark tip
    m.push({ parts: ['tail'], color: pal.stripe, fn: p => { const { s, total } = tailS(p); return Math.max(Math.abs(Math.sin(s * 0.42)) - 0.72, (s - total + 6) * 0.3) * 3; } });
    // paw pads on the palm side
    for (const s of ['L', 'R']) m.push({ parts: ['hand' + s + '.palm'], color: pal.pad, fn: p => Math.min(p[2] - 0.6, 2.3 - Math.hypot(p[0] * 0.85, (p[1] - 5.0) * 0.95)) });
    // belt: lapis band with gold borders and a front knot
    m.push({ parts: C.TORSO, color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.8, fn: p => 1.9 - Math.abs(p[1] + 14.5) });
    m.push({ parts: C.TORSO, color: pal.lapis, fn: p => Math.min(1.2 - Math.abs(p[1] + 14.5), 0.25 - Math.abs(Math.sin(Math.atan2(p[0], p[2]) * 9)) * 0.0 + 1) });
    // broad collar (usekh): gold separators, lapis / turquoise / carnelian tube beads, lapis drops
    m.push(...C.usekh({ gold: pal.gold, rows: [
      { w: 0.9, color: null }, { w: 1.7, color: pal.lapis, beads: 9 }, { w: 0.55, color: null },
      { w: 1.5, color: pal.turq, beads: 11 }, { w: 0.55, color: null }, { w: 1.4, color: pal.carn, beads: 13 }, { w: 0.6, color: null },
    ], drops: { len: 2.3, n: 34, color: pal.lapis } }));
    return m;
  },
  materialFields: () => [
    // linen dress: straight neckline above the bust
    { parts: ['torso.*'], fn: p => { const d = p[1] + 41 - 0.01 * p[0] * p[0]; return d > 0 ? { mat: 'linen', alt: 'fur', d } : { mat: 'fur', alt: 'linen', d: -d }; } },
  ],
  postShade: (doc, { Rs }) => '',
  hideParts: () => ['legL.thigh', 'legL.shin', 'legR.thigh', 'legR.shin'],
  extraGroups: ({ body, head }) => {
    const out = [];
    const R = head.R;
    // diadem over the bangs with a lapis-and-gold sun at the front
    const hc = head.toWorld([0, -0.5, -0.06]), axis = head.dirWorld([0, 1, 0.08]);
    const ring = C.torus(hc, axis, 1.1 * R, 0.045 * R);
    const front = head.toWorld([0, -0.52, 1.1]), fn = head.dirWorld([0, -0.1, 1]);
    out.push({ name: 'jewel.diadem', k: 0.3, parts: [
      { name: 'diadem', mat: 'gold', prims: ring, k: 0.2 },
      { name: 'diadem.gem', mat: 'lapis', prims: [C.disc(front, fn, 0.13 * R, 0.4)] },
      { name: 'diadem.rim', mat: 'gold', prims: C.torus(front, fn, 0.145 * R, 0.03 * R) },
    ] });
    // ear hoops (pierced ears like the bronze Bastet cat)
    for (const s of ['L', 'R']) {
      const e = head.anchors['ear' + s]; if (!e) continue;
      // outer edge of the ear: the side of u that points away from the head centre
      const away = G.dot(e.u, G.sub(e.base, head.anchors.cranium)) > 0 ? 1 : -1;
      for (const k of [0.42, 0.56]) {
        const at = G.add(G.add(e.base, G.mul(e.v, e.h * k)), G.mul(e.u, away * e.w * (1.02 - k * 0.95)));
        out.push({ name: 'jewel.hoop' + s + k, k: 0.2, parts: [{ name: 'hoop', mat: 'gold', prims: C.torus(G.add(at, G.mul(e.u, away * 0.12)), e.v, 0.62, 0.15) }] });
      }
    }
    // linen skirt from the belt down
    out.push(C.skirt(body.anchors.pelvisT, [[-12.4, 9.4, 7.7, 0.2], [-8, 12.0, 8.6, 0.3], [-2, 15.4, 10.0, 0], [4, 17.6, 11.4, -0.4], [14, 17.4, 11.6, 0.2], [36, 14.8, 11.2, 1.2], [56, 13.8, 11.0, 1.8], [70, 15.4, 12.0, 2.2]], { mat: 'linen', pleats: 34, pleatAmp: 0.3 }));
    // arm bands and bracelets
    for (const s of ['L', 'R']) {
      const up = body.anchors['upper' + s], fo = body.anchors['fore' + s];
      if (up) out.push({ name: 'jewel.arm' + s, k: 0.3, parts: [C.limbBand(up, 23, 0.34, 4.45, 2.2)] });
      if (fo) out.push({ name: 'jewel.wrist' + s, k: 0.3, parts: [C.limbBand(fo, 20, 0.88, 3.0, 1.6, { name: 'cuff1' }), C.limbBand(fo, 20, 0.73, 3.3, 0.9, { name: 'cuff2' })] });
    }
    return out;
  },
  expressions: {
    neutral: { smile: 0.15 },
    lazy: { smile: 0.2, open: 0.42, lowerLid: 0.12, brow: { raise: -0.15 }, head: { roll: -0.2, pitch: 0.08, yaw: 0.2 }, ears: { droop: 0.25 } },
    smirk: { smile: 0.35, smirk: 0.6, open: 0.62, lowerLid: 0.15, brow: { raise: 0.1 }, browSide: { R: { raise: 0.5, angle: -0.2 } }, head: { roll: -0.12, yaw: 0.25 } },
    wink: { smile: 0.65, smirk: 0.3, wink: 'R', open: 0.9, head: { roll: 0.16, yaw: 0.2 }, ears: { perk: 0.6 } },
    laugh: { smile: 0.85, mouthOpen: 0.65, closed: 'happy', head: { pitch: -0.12, roll: 0.1 }, ears: { perk: 0.4 } },
    annoyed: { smile: -0.4, open: 0.5, lowerLid: 0.3, brow: { angle: 0.6 }, gazeShift: [0.55, 0], head: { yaw: -0.25, roll: 0.05 }, ears: { flat: 0.7 } },
    surprised: { smile: 0, mouthOpen: 0.4, open: 1.2, brow: { raise: 0.9 }, head: { pitch: -0.08 }, ears: { perk: 1 } },
    sad: { smile: -0.5, open: 0.75, brow: { angle: -0.75, raise: 0.35 }, gazeShift: [0, 0.4], head: { pitch: 0.18, roll: -0.08 }, ears: { droop: 0.9 } },
    flirty: { smile: 0.5, smirk: 0.2, open: 0.68, lowerLid: 0.2, gazeShift: [-0.35, 0.1], brow: { raise: 0.2 }, head: { roll: 0.22, yaw: 0.3, pitch: 0.05 } },
  },
  poses: {
    ref: {
      pelvis: { roll: 0.05 }, chest: { roll: -0.04 }, head: { pitch: 0.02 },
      armL: { hand: [-21, 0, 4], pose: 'relaxed', palm: [1, 0, 0.3], pole: [-30, -20, -10] }, armR: { hand: [21, 0, 4], pose: 'relaxed', palm: [-1, 0, 0.3], pole: [30, -20, -10] },
      legL: { foot: [-7, 79, 3] }, legR: { foot: [8, 79, 2] },
      tailCtrl: [[0, 5, -8], [8, 14, -14], [20, 26, -12], [26, 44, -6], [22, 60, 0], [27, 70, 2]],
    },
    bust: {
      pelvis: {}, chest: { yaw: 0.1 }, head: { yaw: 0.2 },
      armL: { hand: [-15, -2, 6], pose: 'relaxed' }, armR: { hand: [15, -2, 6], pose: 'relaxed' },
    },
    halfbody: {
      pelvis: { roll: 0.17, yaw: -0.12, pos: [3.5, 0, 0] }, chest: { roll: -0.13, yaw: 0.16, pitch: -0.06 }, head: { yaw: 0.26, pitch: 0.06, roll: 0.1 },
      armL: { hand: [-4.5, -40, 11.5], pole: [-26, -20, -4], pose: 'elegant', palm: [0.6, 0.1, -0.8], finger: [0.55, -0.6, 0.45] },
      armR: { hand: [15.5, -6, 4.5], pole: [44, -30, -12], pose: 'hip', palm: [-1, 0, 0.15], finger: [-0.1, 1, -0.2] },
      hide: ['legL', 'legR'],
    },
  },
};
module.exports = ch;
