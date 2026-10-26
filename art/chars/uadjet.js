'use strict';
// Uadjet — cobra naga. Emerald scales, yellow belly plates from throat to tail, open hood, slit pupils,
// black straight hair with gold rings; black silk and gold. A snake body instead of legs, the thinnest
// waist and the longest neck of the seven. Shape language: the S-curve (neck, waist, tail) + the fan of the hood.
const G = require('../lib/geom');
const B = require('../lib/build');
const C = require('../lib/costume');
const Cc = require('../lib/color');
const S = require('../lib/species');
const X = require('../lib/textures');

const pal = {
  scale: '#1f8a5a', belly: '#e9cc54', mark: '#0f4f37', eye: '#f2d23a', hair: '#12131c', sheen: '#5fd0a0',
  silk: '#17141f', gold: '#e0b047', emerald: '#18a86a', hoodIn: '#e4c95a', hoodBand: '#2a5a3a', kohl: '#06070c',
};
// snake body in pelvis space: down from the hips, then a coil on the floor (ground y = 84)
const tailRef = [[0, 2, -1], [0, 14, 1], [-2, 30, 4], [0, 46, 7], [6, 60, 8], [14, 70, 4], [20, 76, -8], [12, 78, -20], [-6, 78.5, -22],
  [-20, 78, -10], [-20, 77, 6], [-10, 75, 14], [2, 72, 18], [8, 66, 21]];
// halfbody: the body sweeps down and the tail tip curls back up beside her hip (an S that answers the neck)
const tailHalf = [[0, 2, -1], [0, 14, 1], [3, 28, 4], [10, 40, 8], [20, 44, 10], [28, 36, 10], [30, 22, 8], [27, 10, 9], [23, 0, 12], [22, -8, 14]];
const tailR = [11.0, 10.5, 9.9, 9.2, 8.5, 7.8, 7.1, 6.4, 5.6, 4.8, 3.9, 2.9, 1.9, 0.9];

const ch = {
  name: 'uadjet', title: 'Уаджит', species: 'cobra', pal,
  scale: 1.04,
  subtitle: 'кобра-нага · гипнотичная, спокойная, опасная',
  palNames: { scale: 'чешуя', belly: 'брюшные щитки', eye: 'глаза', hair: 'волосы', silk: 'чёрный шёлк', gold: 'золото', emerald: 'изумруд', hoodIn: 'капюшон внутри' },
  notes: [
    'Силуэт: веер капюшона + S-кривая шеи, талии и хвоста; ног нет — кольца хвоста на полу.',
    'Самая тонкая талия и самая длинная шея; плечи узкие, движения «текучие».',
    'Жёлтые брюшные щитки идут непрерывно от горла через живот по хвосту — читается как одна линия.',
    'Чёрное с золотом: шёлк почти без бликов, всё сияние — в золоте и глазах.',
    'Взгляд — главный приём: тяжёлые веки, вертикальный зрачок, длинная стрелка.',
    'Прямые чёрные волосы с золотыми кольцами — вертикали против кривых тела.',
  ],
  body: {
    headR: 11,
    legs: false,
    neck: { len: 8.6, r: 4.4, rTop: 4.0 },
    torso: [
      [-49, 5.4, 4.6, -2.0], [-45, 10.0, 6.2, -1.4], [-40, 11.0, 7.8, -0.4], [-35, 11.0, 8.4, 0.2], [-30, 10.2, 8.0, 0.3],
      [-25, 8.6, 7.0, 0.0], [-19, 7.0, 6.0, -0.4], [-15, 7.0, 6.0, -0.3], [-10, 8.6, 6.8, 0.1], [-5, 11.0, 8.0, 0.0],
      [0, 12.4, 9.0, -0.4], [5, 11.8, 9.2, -0.6], [9, 10.8, 8.8, -0.4]],
    shoulder: { x: 11.8 },
    bust: { r: [5.2, 4.9, 4.5], x: 5.6 },
    arm: { upper: 23, fore: 20.5, r: [3.7, 3.2, 2.7, 3.0, 3.1, 2.1] },
    hand: { paw: false, claws: true },
    groundY: 84,
    tail: { r: tailR, ctrl: tailRef },
  },
  head: { eyes: { w: 0.4, theta: 0.44 } },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#0c120e', lash: 0.26, wing: 0.95, wingUp: 0.5, lowerWing: 0.75, tilt: 0.28, pupilW: 0.08,
    brow: { color: '#0c120e', width: 0.1, y: -1.55 } },
  noseColor: '#0d2a1d', mouthLine: '#0d2a1d', whiskers: false,
  hair: { style: 'straight', opts: { rings: true, sheen: '#5d7a96', bang: -0.6, winX: 1.0, frontR: 0.17 } },
  hairLines: { lineColor: '#000000', hiColor: '#4a6aa0', width: 0.08 },
  materials: {
    fur: { base: pal.scale, gloss: 0.975, glossK: 0.3, rimT: 0.06 }, scale: { base: pal.scale, gloss: 0.975, glossK: 0.3 },
    hair: { base: pal.hair, rimT: 0.05, t1: 0.3, hiK: 0.35, rimK: 0.8, gloss: 0.968, glossK: 0.6 }, 'hair:inner': { base: '#05060a', shading: 'flat' },
    claw: { base: '#1b2a20', gloss: 0.9 }, gold: { base: pal.gold, shading: 'metal' }, emerald: { base: pal.emerald, gloss: 0.9, glossK: 0.8 },
    silk: { base: pal.silk, gloss: 0.985, glossK: 0.3, t1: 0.5, line: '#000000' },
    hood: { base: pal.hoodIn, t1: 0.5, line: '#3a4a1a' }, hoodBack: { base: pal.scale, gloss: 0.97 },
  },
  shadowDist: { tail: 30 },
  tufts: () => [],
  markings: ({ body, head, pose }) => {
    const R = head.R;
    const m = [...S.SPECIES.cobra.markings(R, { ...S.SPECIES.cobra.pal, muzzle: pal.belly, mark: pal.mark })];
    // belly plates: one band from the throat down the front of the torso, then along the underside of the tail
    const plates = (p, half) => Math.min(half - Math.abs(p[0]), p[2] - 1.5);
    m.push({ parts: ['neck'], color: pal.belly, fn: p => (p[2] - 1.4 - 0.05 * Math.abs(p[0])) * 1.2 });
    const bellyHalf = p => 3.4 + 0.07 * (p[1] + 25);
    m.push({ parts: ['torso.waist', 'torso.pelvis'], color: pal.belly, fn: p => Math.min(plates(p, bellyHalf(p)), p[1] + 29) });
    m.push({ parts: ['torso.waist', 'torso.pelvis'], color: '#a2862a', opacity: 0.7, fn: p => { const f = (p[1] / 2.2) - Math.floor(p[1] / 2.2); return Math.min(plates(p, bellyHalf(p)), p[1] + 29, 0.09 - Math.min(f, 1 - f)); } });
    const tctrl = pose.tailCtrl || tailRef;
    const pts = G.catmull(tctrl, { seg: 8 });
    const pp = X.pathParam(pts);
    const param = p => { const q = pp(p); return { u: q.theta * 9 / 2.4, v: q.s / 2.0 }; };
    // the underside of the tail: the side facing forward/down along the body (theta measured from the path normal)
    const ventral = p => { const q = pp(p); return Math.cos(q.theta - 1.57) - 0.45; };
    m.push(...X.ventralPlates(['tail'], param, ventral, { color: pal.belly }));
    m.push(...X.snakeScales(['tail'], param, { ventral, gap: '#0d3a26', sheen: '#7fe0b0', opacity: 0.5 }));
    // fine scales on arms and shoulders (flat tiling in bone space)
    for (const s of ['L', 'R']) m.push(...X.snakeScales(['arm' + s + '.upper', 'arm' + s + '.fore', 'arm' + s + '.delt'], p => ({ u: Math.atan2(p[0], p[2]) * 4.5, v: p[1] / 0.95 }), { gap: '#11402c', sheen: '#7fe0b0', opacity: 0.22 }));
    m.push(...X.snakeScales(['head.cranium'], p => ({ u: Math.atan2(p[0], p[2]) * 6.5, v: p[1] / (0.08 * R) }), { gap: '#0f4f37', sheen: '#9ff0c8', opacity: 0.18, ventral: p => p[1] / R - 0.15 }));
    // hood: dark bands across the pale inside
    m.push({ parts: ['hood'], color: pal.hoodBand, opacity: 0.85, fn: p => 0.12 - Math.abs(((p[1] / R + 10) % 0.55) - 0.275) });
    // gold collar
    m.push(...C.usekh({ gold: pal.gold, c: [0, -48.5, -1.2], r0: 4.8, rows: [
      { w: 0.7, color: null }, { w: 1.4, color: pal.emerald, beads: 11 }, { w: 0.5, color: null }, { w: 1.3, color: pal.silk, beads: 13 }, { w: 0.6, color: null },
    ], drops: { len: 2.0, n: 30, color: pal.emerald } }));
    // gold trim on the silk band
    const bandTop = p => p[1] + 40.5 - 0.012 * p[0] * p[0], bandBot = p => -29 - p[1];
    m.push({ parts: C.TORSO, color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.5, fn: p => Math.max(Math.min(bandTop(p), 0.7 - bandTop(p)), Math.min(bandBot(p), 0.7 - bandBot(p))) });
    // gold girdle where the scales meet the silk wrap
    m.push({ parts: C.TORSO.concat(['tail']), color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.7, fn: p => 1.4 - Math.abs(p[1] + 1.0 - 0.02 * p[0] * p[0]) });
    return m;
  },
  materialFields: () => [
    // black silk band across the bust
    { parts: ['torso.*'], fn: p => { const top = p[1] + 40.5 - 0.012 * p[0] * p[0], bot = -29 - p[1]; const d = Math.min(top, bot); return d > 0 ? { mat: 'silk', alt: 'fur', d } : { mat: 'fur', alt: 'silk', d: -d }; } },
  ],
  extraGroups: ({ body, head, pose }) => {
    const out = [];
    const R = head.R;
    // the plane's normal side faces backward, so the dorsal (scaled) material goes on it and the pale inside on the back
    out.push(S.hoodGroup(head, { mat: 'hoodBack', matBack: 'hood', w: 2.35, h: 3.9, at: [0, 1.3, -0.75] }));
    // silk apron panels hanging from the girdle (front and back), gold hem
    const pT = body.anchors.pelvisT;
    const o = G.tapply(pT, [0, -0.5, 10.4]), u = G.mvec(pT.R, [1, 0, 0]), v = G.norm(G.mvec(pT.R, [0, 1, 0.22]));
    const apron = [[-4.6, 0], [4.6, 0], [5.0, 12], [3.4, 17], [0, 18.5], [-3.4, 17], [-5.0, 12]];
    out.push({ name: 'apron', k: 0.1, parts: [{ name: 'apron', mat: 'silk', prims: [B.plane(o, u, v, apron, { cup: [-0.18, 0.02], matBack: 'silk' })] }] });
    // gold border: a slightly larger gold panel just behind the silk one
    const nrm = G.norm(G.cross(u, v)), ob = G.add(o, G.mul(nrm, -0.25));
    out.push({ name: 'apron.gold', k: 0.1, parts: [{ name: 'apronGold', mat: 'gold', prims: [B.plane(ob, u, v, apron.map(([a, b]) => [a * 1.13, b * 1.07 - 0.2]), { cup: [-0.18, 0.02], matBack: 'gold' })] }] });
    // snake armlets (three coils) and bracelets
    for (const s of ['L', 'R']) {
      const up = body.anchors['upper' + s], fo = body.anchors['fore' + s];
      if (up) out.push({ name: 'jewel.arm' + s, k: 0.2, parts: [0, 1, 2].map(k => C.limbBand(up, body.spec.arm.upper, 0.32 + k * 0.08, 4.1 - k * 0.15, 0.75, { name: 'coil' + k, th: 0.32, flare: 0 })) });
      if (fo) out.push({ name: 'jewel.wrist' + s, k: 0.3, parts: [C.limbBand(fo, body.spec.arm.fore, 0.88, 2.75, 1.4, { name: 'cuff', th: 0.36, flare: 0 })] });
    }
    // emerald at the girdle front
    out.push({ name: 'jewel.gem', k: 0.05, parts: [{ name: 'gem', mat: 'emerald', prims: [B.ell(G.tapply(pT, [0, -1.2, 10.6]), [1.3, 1.0, 0.7])] }] });
    return out;
  },
  overlays: (doc, { Rs }) => '',
  expressions: {
    neutral: { smile: 0.2, open: 0.75, lowerLid: 0.15 },
    hypno: { smile: 0.35, open: 0.78, lowerLid: 0.12, brow: { raise: 0.05 }, eye: { glow: 0.3 }, head: { roll: 0.14, yaw: 0.16, pitch: 0.05 } },
    smirk: { smile: 0.4, smirk: 0.55, open: 0.55, lowerLid: 0.25, browSide: { R: { raise: 0.4, angle: -0.2 } }, head: { roll: -0.12, yaw: 0.25 } },
    calm: { smile: 0.15, open: 0.3, lowerLid: 0.1, closed: 'calm', head: { pitch: 0.1, roll: 0.08 } },
    angry: { smile: -0.4, mouthOpen: 0.45, fangs: true, open: 1.0, brow: { angle: 0.7 }, head: { pitch: 0.05, yaw: -0.1 } },
    playful: { smile: 0.7, mouthOpen: 0.3, tongue: true, wink: 'L', head: { roll: -0.18, yaw: 0.15 } },
    surprised: { smile: 0, mouthOpen: 0.3, open: 1.2, brow: { raise: 0.85 }, head: { pitch: -0.06 } },
  },
  halfbodyExpr: 'hypno',
  refExpr: 'neutral',
  icon: { expr: 'hypno', accent: '#3fe0a0', ring: '#e0b047', yaw: -0.25, zoom: 5.6, cy: 0.5, bgInner: '#1f4a40', bgMid: '#13262a' },
  bustScale: 7.4, emoCy: 0.5,
  refTop: 2.4,
  refDetails: () => [
    { label: 'голова и капюшон', target: b => b.head.anchors.cranium, zoom: 8.5, yaw: -0.4 },
    { label: 'колье и пояс', target: b => G.tapply(b.body.anchors.chestT, [0, -30, 6]), zoom: 6.5, yaw: -0.25 },
    { label: 'чешуя хвоста', target: b => b.body.anchors.tail[Math.floor(b.body.anchors.tail.length * 0.3)], zoom: 9, yaw: -0.5 },
    { label: 'браслеты-змеи', target: b => G.tapply(b.body.anchors.upperR, [0, 8, 0]), zoom: 10, yaw: -0.6 },
  ],
  poses: {
    ref: {
      pelvis: { roll: 0.02 }, chest: { roll: -0.02 }, head: { pitch: 0.03 },
      armL: { hand: [-20, 0, 5], pose: 'elegant', palm: [1, 0, 0.3], pole: [-30, -20, -10] }, armR: { hand: [20, 0, 5], pose: 'elegant', palm: [-1, 0, 0.3], pole: [30, -20, -10] },
    },
    bust: { pelvis: {}, chest: { yaw: 0.08 }, head: { yaw: 0.15 }, armL: { hand: [-15, -2, 6], pose: 'relaxed' }, armR: { hand: [15, -2, 6], pose: 'relaxed' } },
    halfbody: {
      pelvis: { roll: 0.12, yaw: -0.1, pos: [2, 0, 0] }, chest: { roll: -0.14, yaw: 0.12, pitch: -0.04 }, head: { yaw: 0.2, pitch: 0.08, roll: 0.2, neckPitch: -0.12 },
      armL: { hand: [-8, -50, 12], pole: [-28, -24, -6], pose: 'elegant', palm: [0.5, 0.2, -0.8], finger: [0.3, -0.8, 0.5] },
      armR: { hand: [14, -16, 9], pole: [34, -26, -12], pose: 'elegant', palm: [-0.6, 0.2, 0.7], finger: [0.3, 0.6, 0.6] },
      tailCtrl: tailHalf,
    },
  },
  halfbodyView: { yaw: -0.4, s: 10.0, oy: 1020 },
  bgAccent: '#3fe0a0',
};
module.exports = ch;
