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
  scale: 0.86, // overall height relative to Nefer (used in the lineup); proportions stay in body units
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
    headR: 13,
    shoulder: { x: 11.6 }, bust: { r: [4.6, 4.4, 4.0], x: 5.4 },
    arm: { upper: 21.5, fore: 18.5 }, leg: { thigh: 37, shin: 28.5 }, groundY: 74,
    tail: { r: [2.6, 3.6, 4.6, 5.0, 4.2, 2.2], ctrl: tailCtrl },
    hand: { paw: true, claws: true },
  },
  head: { eyes: { w: 0.36, theta: 0.48 } },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#3a1c12', lash: 0.21, wing: 0.45, wingUp: 0.28, lowerWing: 0.3, tilt: 0.1,
    brow: { color: '#a8562c', width: 0.11, y: -1.45 } },
  noseColor: pal.nose, mouthLine: '#3b2226', whiskers: true,
  hair: { style: 'ponytail', opts: { sheen: '#ffb98a', bangs: 'part', swing: 1.0 } },
  hairLines: { lineColor: '#5a1e0c', hiColor: '#f08a52', width: 0.08 },
  materials: {
    fur: { base: pal.fur, sss: true }, innerEar: { base: pal.innerEar, edgeLine: false },
    hair: { base: pal.hair, sss: true, gloss: 0.965, glossK: 0.5, rimT: 0.05, ramp: { shadow: '#9b3b26', core: '#7d2a1c', deep: '#5c1d16' } }, 'hair:inner': { base: '#6a2412', shading: 'flat' },
    claw: { base: '#f7efdf', gloss: 0.9 }, gold: { base: pal.gold, shading: 'metal' }, turq: { base: pal.turq, gloss: 0.92 },
    silk: { base: pal.silk, gloss: 0.985, glossK: 0.3, t1: 0.5, line: '#4a0a24' }, veil: { base: '#f07a9a', opacity: 0.42, t0: -0.2, line: '#8a1a40' },
  },
  tufts: ({ Rs, head }) => [
    ...S.SPECIES.fennec.tufts(head.R, Rs.view.s),
    { parts: ['tail'], amp: 1.4 * Rs.view.s, period: 5.5 * Rs.view.s, flow: [0.4, -1], lean: 1.1, inner: false },
  ],
  markings: ({ body, head }) => {
    const R = head.R;
    // muzzle patch only: the fennec tear streak reads as two bars on a face this small
    const m = [S.SPECIES.fennec.markings(R, { ...S.SPECIES.fennec.pal, ...pal, muzzle: pal.cream })[0]];
    const X = require('../lib/textures');
    const pp = X.pathParam(G.catmull(tailCtrl, { seg: 8 }));
    m.push({ parts: ['tail'], color: pal.tailTip, fn: p => { const { s, total } = pp(p); return (s - total + 5.5) * 0.6; } });
    m.push({ parts: ['neck'], color: pal.cream, opacity: 0.85, fn: p => (p[2] - 1.2 - 0.12 * Math.abs(p[0])) * 0.8 });
    for (const s of ['L', 'R']) m.push(...C.pawPads(s, '#c98a7c', body.anchors['tipPads' + s]));
    // gold trim along the choli edges
    const choliTop = p => p[1] + 41.5 - 0.012 * p[0] * p[0], choliBot = p => -26.5 - p[1];
    m.push({ parts: C.TORSO, color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.6, fn: p => Math.max(Math.min(choliTop(p), 0.8 - choliTop(p)), Math.min(choliBot(p), 0.9 - choliBot(p))) });
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
    // monisto: a gold band across the forehead in front of the ears, coins hanging from its front arc
    const bc = [0, -0.62, -0.05], bn = G.norm([0, 1, -0.25]), br = 1.08;
    const bv = G.norm(G.cross([1, 0, 0], bn)); // forward direction in the band plane
    out.push({ name: 'jewel.band', k: 0.1, parts: [{ name: 'band', mat: 'gold', prims: C.torus(head.toWorld(bc), head.dirWorld(bn), br * R, 0.028 * R) }] });
    for (let i = -4; i <= 4; i++) {
      const a = i * 0.17;
      const pb = G.add(bc, G.add(G.mul([1, 0, 0], Math.sin(a) * br), G.mul(bv, Math.cos(a) * br)));
      const out3 = G.norm([Math.sin(a), 0.1, Math.cos(a)]);
      const pc = G.add(G.add(pb, [0, 0.085 + (i % 2 ? 0 : 0.03), 0]), G.mul(out3, 0.01));
      out.push({ name: 'jewel.coin' + (i + 4), k: 0.05, line: 'always', parts: [{ name: 'coin', mat: i % 2 ? 'gold' : 'gold', prims: [C.disc(head.toWorld(pc), head.dirWorld(out3), (i % 2 ? 0.05 : 0.065) * R, 0.2)] }] });
    }
    out.push({ name: 'jewel.gem', k: 0.05, parts: [{ name: 'gem', mat: 'turq', prims: [B.sphere(head.toWorld(G.add(G.add(bc, G.mul(bv, br)), [0, -0.01, 0.03])), 0.055 * R)] }] });
    // veil: sheer silk pinned at the crown behind the ponytail, falling down the back past the shoulders
    const vo = head.toWorld([0, -0.85, -0.55]);
    const vu = head.dirWorld([1.0 * R, 0, 0]), vv = head.dirWorld([0, 2.6 * R, -0.75 * R]);
    out.push({ name: 'veil', k: 0.1, parts: [{ name: 'veil', mat: 'veil', prims: [B.plane(vo, vu, vv, B.smoothPoly([[-0.25, 0], [0.25, 0], [0.95, 0.55], [1.25, 1.1], [1.15, 1.55], [0.6, 1.45], [0, 1.6], [-0.6, 1.45], [-1.15, 1.55], [-1.25, 1.1], [-0.95, 0.55]], 6), { cup: [-0.9, 0.05] })] }] });
    // bracelets: gold + turquoise bead band at each wrist
    for (const s of ['L', 'R']) { const fo = body.anchors['fore' + s]; if (fo) out.push({ name: 'jewel.wrist' + s, k: 0.3, parts: [C.limbBand(fo, body.spec.arm.fore, 0.9, 3.15, 1.3, { name: 'b1' }), C.limbBand(fo, body.spec.arm.fore, 0.79, 3.4, 0.75, { name: 'b2', mat: 'turq' })] }); }
    // a coin held up between thumb and index finger
    const tips = body.anchors.fingertipsL;
    if (tips) { const c = G.lerp(tips[0], body.anchors.fingertipsL[1], 0.5); out.push({ name: 'coin', k: 0.1, line: 'always', parts: [{ name: 'coin', mat: 'gold', prims: [C.disc(G.add(c, [0, -1.4, 1.0]), [0.75, -0.3, 0.6], 2.1, 0.16)] }] }); }
    return out;
  },
  expressions: {
    neutral: { smile: 0.3 },
    chatty: { smile: 0.6, mouthOpen: 0.45, open: 1.05, brow: { raise: 0.35 }, head: { roll: 0.12, yaw: 0.15 }, ears: { perk: 0.6 } },
    excited: { smile: 0.9, mouthOpen: 0.6, open: 1.15, brow: { raise: 0.6 }, head: { pitch: -0.08, roll: -0.1 }, ears: { perk: 1 } },
    sly: { smile: 0.45, smirk: 0.5, open: 0.6, lowerLid: 0.25, gazeShift: [0.4, 0], brow: { angle: 0.25 }, browSide: { L: { raise: 0.4 } }, head: { roll: -0.15, yaw: 0.2 }, ears: { flat: 0.15 } },
    wink: { smile: 0.75, smirk: 0.2, wink: 'R', mouthOpen: 0.25, head: { roll: 0.15 }, ears: { perk: 0.5 } },
    pout: { smile: -0.45, smirk: -0.15, open: 0.7, lowerLid: 0.2, brow: { angle: 0.35, raise: 0.05 }, gazeShift: [-0.6, 0.15], blush: 0.8, head: { yaw: 0.1, pitch: 0.08, roll: 0.1 }, ears: { droop: 0.5, flat: 0.2 } },
    laugh: { smile: 0.9, mouthOpen: 0.7, closed: 'happy', head: { pitch: -0.12, roll: 0.12 }, ears: { perk: 0.4 } },
    surprised: { smile: 0, mouthOpen: 0.45, open: 1.2, brow: { raise: 0.9 }, ears: { perk: 1 } },
  },
  halfbodyExpr: 'chatty',
  refExpr: 'neutral',
  icon: { expr: 'wink', accent: '#ff7aa8', ring: '#e2b24a', yaw: -0.3, zoom: 4.6, cy: 0.56 },
  bustScale: 7.3, emoCy: 0.55,
  refTop: 2.6,
  refDetails: () => [
    { label: 'голова 3/4', target: b => b.head.anchors.cranium, zoom: 11, yaw: -0.45 },
    { label: 'монисто и уши', target: b => b.head.toWorld([0, -0.8, 0.4]), zoom: 9, yaw: -0.2 },
    { label: 'пояс с монетами', target: b => G.tapply(b.body.anchors.pelvisT, [0, 0, 8]), zoom: 10, yaw: -0.3 },
    { label: 'хвост', target: b => b.body.anchors.tail[Math.floor(b.body.anchors.tail.length * 0.75)], zoom: 7, yaw: -1.3 },
  ],
  poses: {
    ref: {
      pelvis: { roll: 0.04 }, chest: { roll: -0.03 }, head: { pitch: 0.02 },
      armL: { hand: [-19, 0, 4], pose: 'relaxed', palm: [1, 0, 0.3], pole: [-30, -20, -10] }, armR: { hand: [19, 0, 4], pose: 'relaxed', palm: [-1, 0, 0.3], pole: [30, -20, -10] },
      legL: { foot: [-7, 74, 3] }, legR: { foot: [8, 74, 2] },
    },
    bust: { pelvis: {}, chest: { yaw: 0.1 }, head: { yaw: 0.2 }, armL: { hand: [-14, -2, 6], pose: 'relaxed' }, armR: { hand: [14, -2, 6], pose: 'relaxed' } },
    halfbody: {
      pelvis: { roll: -0.14, yaw: 0.15, pos: [-3, 0, 0] }, chest: { roll: 0.12, yaw: -0.08, pitch: -0.05 }, head: { yaw: 0.22, pitch: 0.0, roll: 0.14 },
      armL: { hand: [-11, -52, 13], pole: [-30, -30, -6], pose: 'hold', palm: [0.3, 0, 1], finger: [0.2, -1, 0.1] },
      armR: { hand: [15, -6, 4], pole: [40, -28, -12], pose: 'hip', palm: [-1, 0, 0.15], finger: [-0.1, 1, -0.2] },
      tailCtrl,
    },
  },
  halfbodyView: { yaw: -0.42, s: 10.2, oy: 1030 },
  bgAccent: '#ff8ab0',
};
module.exports = ch;
