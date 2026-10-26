'use strict';
// Amara — fennec fox, merchant. Cream fur, enormous ears, copper high ponytail, amber eyes,
// raspberry silk, veil and a coin monisto. The smallest of the seven: round doll face + triangle ears.
const G = require('../lib/geom');
const B = require('../lib/build');
const C = require('../lib/costume');
const Cc = require('../lib/color');
const S = require('../lib/species');

const pal = {
  fur: '#efd3a4', cream: '#fcf5e8', mark: '#c07a45', innerEar: '#f6d6cb', nose: '#2a1e20', eye: '#e8962a',
  hair: '#c4552c', silk: '#b8195c', silkDark: '#7c0f3d', gold: '#e2b24a', turq: '#2fb3a6', kohl: '#2a140e', tailTip: '#2a201c',
};
const tailCtrl = [[0, 4, -8], [-7, 10, -16], [-18, 8, -16], [-26, -2, -8], [-27, -14, 0], [-21, -22, 6]];

const ch = {
  name: 'amara', title: 'Амара', species: 'fennec', pal,
  subtitle: 'фенек · торговка · болтливая, азартная',
  palNames: { fur: 'мех', cream: 'морда, грудь', hair: 'волосы', eye: 'глаза', innerEar: 'уши внутри', nose: 'нос', silk: 'шёлк', silkDark: 'шёлк в тени', gold: 'монеты', turq: 'бусины', tailTip: 'кончик хвоста' },
  notes: [
    'Самая миниатюрная: голова крупная, тело меньше остальных на ~12%.',
    'Силуэт: огромные уши + высокий хвост волос + пушистый хвост.',
    'Форма-язык: круг (лицо, щёки) против треугольников (уши).',
    'Характер: болтливая и азартная — открытый рот, прищур, монета в пальцах.',
    'Акцент: малиновый шёлк + золото монет; бирюза мелкими точками.',
    'Монисто звенит: ряды монет на лбу и на поясе.',
  ],
  body: {
    headR: 12.2, scale: 0.86,
    shoulder: { x: 11.6 }, bust: { r: [4.6, 4.4, 4.0], x: 5.4 },
    tail: { r: [2.6, 3.6, 4.6, 5.0, 4.2, 2.2], ctrl: tailCtrl },
    hand: { paw: true, claws: true },
  },
  head: { eyes: { w: 0.36, theta: 0.48 } },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#3a1c12', lash: 0.21, wing: 0.45, wingUp: 0.28, lowerWing: 0.3, tilt: 0.1,
    brow: { color: '#a8562c', width: 0.11, y: -1.45 } },
  noseColor: pal.nose, mouthLine: '#3b2226', whiskers: true,
  hair: { style: 'ponytail', opts: { sheen: '#ffb98a' } },
  hairLines: { lineColor: '#5a1e0c', hiColor: '#f08a52', width: 0.08 },
  materials: {
    fur: { base: pal.fur, sss: true }, innerEar: { base: pal.innerEar, edgeLine: false },
    hair: { base: pal.hair, sss: true, gloss: 0.965, glossK: 0.5, rimT: 0.05 }, 'hair:inner': { base: '#6a2412', shading: 'flat' },
    claw: { base: '#f7efdf', gloss: 0.9 }, gold: { base: pal.gold, shading: 'metal' }, turq: { base: pal.turq, gloss: 0.92 },
    silk: { base: pal.silk, gloss: 0.94, glossK: 0.45, t1: 0.5, line: '#4a0a24' }, veil: { base: '#e6587e', opacity: 0.55, t0: -0.2, line: '#8a1a40' },
  },
  tufts: ({ Rs }) => [
    ...S.SPECIES.fennec.tufts(12.2, Rs.view.s),
    { parts: ['tail'], amp: 1.3 * Rs.view.s, period: 2.6 * Rs.view.s, flow: [0.4, -1], lean: 0.9, inner: false },
  ],
  markings: ({ body, head }) => {
    const R = head.R;
    const m = [...S.SPECIES.fennec.markings(R, pal)];
    const X = require('../lib/textures');
    const pp = X.pathParam(G.catmull(tailCtrl, { seg: 8 }));
    m.push({ parts: ['tail'], color: pal.tailTip, fn: p => { const { s, total } = pp(p); return (s - total + 5.5) * 0.6; } });
    m.push({ parts: ['neck'], color: pal.cream, fn: p => (-p[2] - 1.0) * 0.8 });
    for (const s of ['L', 'R']) m.push(...C.pawPads(s, '#c98a7c', body.anchors['tipPads' + s]));
    // coin hip scarf: gold scallop band with coins on the silk
    m.push({ parts: ['torso.*', 'pants'].flatMap(n => n === 'torso.*' ? C.TORSO : [n]), color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.7, fn: p => {
      const a = Math.atan2(p[0], p[2]); const scal = 1.0 * Math.abs(Math.sin(a * 9));
      return Math.min(p[1] + 3.5, 2.6 + scal - p[1]);
    } });
    m.push({ parts: C.TORSO.concat(['pants']), color: '#fff0b8', opacity: 0.85, stage: 'post', blend: 'screen', fn: p => {
      const a = Math.atan2(p[0], p[2]); const k = Math.round(a * 9 / Math.PI * 2) / (9 / Math.PI * 2); const cx = Math.sin(k) * 15, cz = Math.cos(k) * 10;
      return 0.55 - Math.hypot(p[0] - cx * 0.98, p[1] - 3.2, (p[2] - cz) * 0.4);
    } });
    return m;
  },
  materialFields: () => [
    // cropped silk top (choli) over the chest, bare midriff
    { parts: ['torso.*'], fn: p => { const top = p[1] + 41.5 - 0.012 * p[0] * p[0], bot = -26.5 - p[1]; const d = Math.min(top, bot); return d > 0 ? { mat: 'silk', alt: 'fur', d } : { mat: 'fur', alt: 'silk', d: -d }; } },
    // silk on the pelvis below the hip line (harem trousers start)
    { parts: ['torso.pelvis', 'torso.glute'], fn: p => { const d = p[1] + 4; return d > 0 ? { mat: 'silk', alt: 'fur', d } : null; } },
  ],
  hideParts: () => [],
  extraGroups: ({ body, head }) => {
    const out = [];
    const R = head.R;
    // harem trousers: wide silk legs gathered at the ankle
    for (const s of ['L', 'R']) {
      const hip = body.anchors['hip' + s], knee = body.anchors['knee' + s], hk = body.anchors['hock' + s] || body.anchors['ankle' + s];
      if (!hip || !knee || !hk) continue;
      const pts = G.catmull([G.add(hip, [0, -3, 0]), G.lerp(hip, knee, 0.5), knee, G.lerp(knee, hk, 0.5), hk], { seg: 6 });
      out.push({ name: 'pants' + s, k: 1.2, parts: [{ name: 'pants', mat: 'silk', frame: body.anchors.pelvisT, prims: B.sweep(pts, t => 8.8 + 3.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 5 * Math.max(0, t - 0.82) * 4, { spacing: 0.2 }), k: 1.4 }] });
    }
    // monisto: a row of coins across the forehead between the ears + a crown chain
    const coins = [];
    for (let i = -5; i <= 5; i++) {
      const a = i * 0.13, p = head.toWorld([Math.sin(a) * 1.0, -0.58 + 0.03 * Math.abs(i) - 0.0, Math.cos(a) * 1.0 + 0.06]);
      const n = head.dirWorld([Math.sin(a), -0.15, Math.cos(a)]);
      coins.push(C.disc(G.add(p, head.dirWorld([0, 0.12 * R, 0])), n, 0.085 * R, 0.18));
    }
    out.push({ name: 'jewel.monisto', k: 0.1, parts: [{ name: 'monisto', mat: 'gold', prims: coins }, { name: 'chain', mat: 'gold', prims: C.torus(head.toWorld([0, -0.62, -0.05]), head.dirWorld([0, 1, 0.1]), 1.06 * R, 0.03 * R) }] });
    // veil: sheer silk falling from the crown behind the ponytail
    const vo = head.toWorld([0, -0.75, -0.75]);
    const vu = head.dirWorld([1.5 * R, 0, 0]), vv = head.dirWorld([0, 2.2 * R, -0.9 * R]);
    out.push({ name: 'veil', k: 0.1, parts: [{ name: 'veil', mat: 'veil', prims: [B.plane(vo, vu, vv, B.smoothPoly([[-0.6, 0], [0.6, 0], [1, 0.6], [0.8, 1.15], [0, 1.25], [-0.8, 1.15], [-1, 0.6]], 6), { cup: [-0.6, 0.1] })] }] });
    // bracelets and a coin in the raised hand
    for (const s of ['L', 'R']) { const fo = body.anchors['fore' + s]; if (fo) out.push({ name: 'jewel.wrist' + s, k: 0.3, parts: [C.limbBand(fo, 17.5, 0.86, 2.6, 1.0, { name: 'b1' }), C.limbBand(fo, 17.5, 0.76, 2.75, 0.7, { name: 'b2', mat: 'turq' })] }); }
    const tips = body.anchors.fingertipsL;
    if (tips) { const c = G.lerp(tips[0], body.anchors.fingertipsL[1], 0.5); out.push({ name: 'coin', k: 0.1, parts: [{ name: 'coin', mat: 'gold', prims: [C.disc(G.add(c, [0, -1.2, 1.2]), [0.3, -0.2, 1], 1.7, 0.16)] }] }); }
    return out;
  },
  expressions: {
    neutral: { smile: 0.3 },
    chatty: { smile: 0.6, mouthOpen: 0.45, open: 1.05, brow: { raise: 0.35 }, head: { roll: 0.12, yaw: 0.15 }, ears: { perk: 0.6 } },
    excited: { smile: 0.9, mouthOpen: 0.6, open: 1.15, brow: { raise: 0.6 }, head: { pitch: -0.08, roll: -0.1 }, ears: { perk: 1 } },
    sly: { smile: 0.45, smirk: 0.5, open: 0.6, lowerLid: 0.25, gazeShift: [0.4, 0], brow: { angle: 0.25 }, browSide: { L: { raise: 0.4 } }, head: { roll: -0.15, yaw: 0.2 }, ears: { flat: 0.15 } },
    wink: { smile: 0.75, smirk: 0.2, wink: 'R', mouthOpen: 0.25, head: { roll: 0.15 }, ears: { perk: 0.5 } },
    pout: { smile: -0.35, open: 0.85, brow: { angle: 0.4, raise: 0.1 }, gazeShift: [-0.5, 0.1], head: { yaw: -0.2, roll: 0.08 }, ears: { droop: 0.4 } },
    laugh: { smile: 0.9, mouthOpen: 0.7, closed: 'happy', head: { pitch: -0.12, roll: 0.12 }, ears: { perk: 0.4 } },
    surprised: { smile: 0, mouthOpen: 0.45, open: 1.2, brow: { raise: 0.9 }, ears: { perk: 1 } },
  },
  halfbodyExpr: 'chatty',
  refExpr: 'neutral',
  icon: { expr: 'wink', accent: '#ff7aa8', ring: '#e2b24a', yaw: -0.3, zoom: 4.6, cy: 0.56 },
  bustScale: 8.6, emoCy: 0.46,
  refTop: 2.6,
  refDetails: () => [
    { label: 'голова 3/4', target: b => b.head.anchors.cranium, zoom: 11, yaw: -0.45 },
    { label: 'монисто и уши', target: b => b.head.toWorld([0, -0.8, 0.4]), zoom: 9, yaw: -0.2 },
    { label: 'пояс с монетами', target: b => G.tapply(b.body.anchors.pelvisT, [0, 0, 8]), zoom: 10, yaw: -0.3 },
    { label: 'хвост', target: b => b.body.anchors.tail[Math.floor(b.body.anchors.tail.length * 0.6)], zoom: 8, yaw: 2.4 },
  ],
  poses: {
    ref: {
      pelvis: { roll: 0.04 }, chest: { roll: -0.03 }, head: { pitch: 0.02 },
      armL: { hand: [-19, 0, 4], pose: 'relaxed', palm: [1, 0, 0.3], pole: [-30, -20, -10] }, armR: { hand: [19, 0, 4], pose: 'relaxed', palm: [-1, 0, 0.3], pole: [30, -20, -10] },
      legL: { foot: [-7, 79, 3] }, legR: { foot: [8, 79, 2] },
    },
    bust: { pelvis: {}, chest: { yaw: 0.1 }, head: { yaw: 0.2 }, armL: { hand: [-14, -2, 6], pose: 'relaxed' }, armR: { hand: [14, -2, 6], pose: 'relaxed' } },
    halfbody: {
      pelvis: { roll: -0.14, yaw: 0.15, pos: [-3, 0, 0] }, chest: { roll: 0.12, yaw: -0.08, pitch: -0.05 }, head: { yaw: 0.22, pitch: 0.0, roll: 0.14 },
      armL: { hand: [-11, -52, 13], pole: [-30, -30, -6], pose: 'hold', palm: [0.3, 0, 1], finger: [0.2, -1, 0.1] },
      armR: { hand: [15, -6, 4], pole: [40, -28, -12], pose: 'hip', palm: [-1, 0, 0.15], finger: [-0.1, 1, -0.2] },
      tailCtrl,
    },
  },
  halfbodyView: { yaw: -0.42, s: 12.5, oy: 990 },
  bgAccent: '#ff8ab0',
};
module.exports = ch;
