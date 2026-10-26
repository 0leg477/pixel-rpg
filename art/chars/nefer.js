'use strict';
// Nefer — cat, priestess of Bastet. Sand-gold tabby, turquoise eyes, blue-black bob with blunt bangs.
// Pin-up build: hourglass figure, fur that runs from the face down the throat into a chest tuft,
// tabby stripes that wrap arms, thighs and tail. Shape language: soft S-curves + sharp kohl wings and ear tips.
const G = require('../lib/geom');
const B = require('../lib/build');
const C = require('../lib/costume');
const Cc = require('../lib/color');

const pal = {
  fur: '#e8b66a', cream: '#fbead0', stripe: '#a5622c', hair: '#1a1f4a', sheen: '#7f9cff',
  eye: '#19c6b4', nose: '#c26f78', innerEar: '#f0a99e', pad: '#c4767c',
  linen: '#f3ede0', lapis: '#2449b0', gold: '#e8b444', turq: '#35c0b0', kohl: '#0d0a18',
};

const tailCtrl = [[0, 5, -8], [-6, 13, -15], [-17, 15, -9], [-21, 6, 3], [-15, -2, 11], [-7, -4, 13]];
const skirtTop = -6.5;
// V-neck crop top: neckline dips to the centre, straps at the shoulders; hem under the bust
const topField = p => { const ax = Math.abs(p[0]); const neck = ax < 6.5 ? -37.5 - 1.25 * ax : -46.5; return Math.min(p[1] - neck, -27.5 - p[1] + 0.012 * p[0] * p[0]); };

const ch = {
  name: 'nefer', title: 'Нефер', species: 'cat', pal, style: 'pinup',
  scale: 1,
  subtitle: 'кошка · жрица Бастет · ленивая, язвительная, кокетливая',
  palNames: { fur: 'мех', cream: 'горло, грудка', stripe: 'полоски табби', hair: 'волосы', eye: 'глаза', nose: 'нос', innerEar: 'уши внутри', linen: 'лён', lapis: 'лазурит', gold: 'золото', turq: 'бирюза' },
  notes: [
    'Пин-ап «песочные часы»: полная грудь, узкая талия, широкие бёдра, сильные бёдра ног.',
    'Мех непрерывен: кремовое горло переходит в пучок на груди поверх выреза.',
    'Полоски табби обвивают руки, бёдра и хвост — голова и тело одного зверя.',
    'Лицо: короткая мордочка, острый подбородок, тяжёлые веки и длинные стрелки.',
    'Каре с тупой чёлкой до бровей; уши большие, торчат над волосами.',
    'Акцент: лазурит и золото у лица, на поясе и в разрезе юбки.',
  ],
  refDetails: () => [
    { label: 'голова 3/4', target: b => b.head.anchors.cranium, zoom: 13, yaw: -0.45 },
    { label: 'вырез и пучок на груди', target: b => G.tapply(b.body.anchors.chestT, [0, -40, 7]), zoom: 10, yaw: -0.25 },
    { label: 'лапа и браслеты', target: b => G.tapply(b.body.anchors.handR, [0, 2, 0]), zoom: 11, yaw: -0.2, pitch: 0.05 },
    { label: 'разрез и пояс', target: b => G.tapply(b.body.anchors.pelvisT, [-8, 8, 8]), zoom: 6.5, yaw: -0.4 },
  ],
  icon: { expr: 'wink', accent: '#4fd1c5', ring: '#e8b444', yaw: -0.3, zoom: 4.3, cy: 0.52 },
  body: {
    headR: 13.4,
    neck: { len: 6.0, r: 4.6, rTop: 4.2 },
    torso: [
      [-49, 6.0, 4.8, -2.0], [-45, 11.0, 6.8, -1.4], [-40, 12.0, 8.4, -0.2], [-35, 12.0, 9.0, 0.4], [-30, 11.0, 8.6, 0.4],
      [-25, 9.2, 7.4, 0.0], [-19, 7.9, 6.5, -0.4], [-15, 8.1, 6.5, -0.3], [-10, 10.6, 7.4, 0.1], [-5, 14.6, 8.8, 0.0],
      [0, 17.2, 10.0, -0.6], [5, 16.8, 10.4, -1.2], [9, 13.6, 9.0, -1.0]],
    shoulder: { x: 12.2 },
    bust: { r: [6.5, 6.1, 5.8], x: 6.0, y: -33.2, z: 5.4, splay: 0.22, droop: 0.08, separate: true },
    glutes: { r: [9.6, 10.6, 9.2], x: 7.6 },
    arm: { upper: 22.5, fore: 19.5, r: [4.1, 3.6, 3.0, 3.3, 3.35, 2.4] },
    leg: { thigh: 41, shin: 31, meta: 15, hipX: 8.8, r: [11.2, 9.0, 5.6, 5.0, 5.4, 2.9, 2.4] },
    tail: { r: [2.6, 2.45, 2.3, 2.15, 1.8], ctrl: tailCtrl },
    hand: { paw: true, claws: true },
  },
  head: { eyes: { w: 0.39 } },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#1c1222', lash: 0.3, wing: 0.9, wingUp: 0.45, lowerWing: 0.5, tilt: 0.22,
    brow: { color: '#1a1f4a', width: 0.1, y: -1.55 } },
  noseColor: pal.nose, mouthLine: '#3b2226', whiskers: false,
  hair: { style: 'bob', opts: { bang: -0.36, winX: 0.98, winZ: -0.1, cut: 0.72, sheen: '#7d9cff', bangSpread: 0.86, ring: true } },
  bustScale: 7.0, emoCy: 0.5,
  hairLines: { lineColor: '#090b18', hiColor: '#5a78d0', width: 0.08 },
  materials: {
    fur: { base: pal.fur, sss: true, gloss: 0.966, glossK: 0.4 }, cream: { base: pal.cream, sss: true, gloss: 0.96, glossK: 0.5 },
    innerEar: { base: pal.innerEar, edgeLine: false },
    hair: { base: pal.hair, rimT: 0.05, t1: 0.3, rimK: 0.8, gloss: 0.962, glossK: 0.7 }, 'hair:inner': { base: '#0b0e26', shading: 'flat' },
    claw: { base: '#f5ecd8', gloss: 0.9 }, linen: { base: pal.linen, t0: 0.02, t1: 0.55, gloss: 0.975, glossK: 0.35, line: '#7a6b5a' },
    gold: { base: pal.gold, shading: 'metal' }, lapis: { base: pal.lapis, gloss: 0.9 },
  },
  tufts: ({ Rs, head }) => [
    { parts: ['head.cheek', 'head.jaw'], amp: 0.2 * head.R * Rs.view.s, period: 0.26 * head.R * Rs.view.s, flow: [0, 1], lean: 1.0, where: n => n[1] > -0.1 },
    // elbow and tail tip fluff keep the body furry, not a mannequin
    { parts: ['tail'], amp: 0.5 * Rs.view.s, period: 2.4 * Rs.view.s, flow: [0, 1], lean: 0.8, inner: false, where: n => n[1] > 0.3 },
  ],
  markings: ({ body, head, pose }) => {
    const R = head.R, u = p => p.map(v => v / R);
    const tc = pose.tailCtrl || tailCtrl;
    const tailPts = G.catmull(tc, { seg: 8 });
    const tailS = p => {
      let bd = 1e9, acc = 0, sAt = 0;
      for (let i = 0; i < tailPts.length; i++) { if (i) acc += G.len(G.sub(tailPts[i], tailPts[i - 1])); const d = G.len(G.sub(p, tailPts[i])); if (d < bd) { bd = d; sAt = acc; } }
      return { s: sAt, total: acc };
    };
    const m = [];
    // cream under the snout, chin and throat; it continues down the neck to the chest tuft
    // soft oval under the snout + chin (no straight edges: a band read as a mask)
    m.push({ parts: ['head.muzzle', 'head.jaw', 'head.cheek'], color: pal.cream, fn: p => { const q = u(p); return Math.max(0.5 - Math.hypot(q[0] / 0.3, (q[1] - 0.52) / 0.2, (q[2] - 0.85) / 0.5), 0.5 - Math.hypot(q[0] / 0.26, (q[1] - 0.68) / 0.16, (q[2] - 0.45) / 0.5)) * 0.8; } });
    m.push({ parts: ['neck'], color: pal.cream, fn: p => (p[2] - 1.0 - 0.08 * Math.abs(p[0])) * 0.9 });
    // tabby: brow stripes peeking under the bangs, cheek flicks
    m.push({ parts: ['head.cheek', 'head.cranium'], color: pal.stripe, opacity: 0.85, fn: p => {
      const q = u(p), ax = Math.abs(q[0]);
      let v = -1;
      for (const [y0, k] of [[0.14, 0.0], [0.3, 0.07]]) { const yy = y0 + (ax - 0.6) * 0.4 + k; const along = G.smoothstep(0.66, 0.8, ax) * (1 - G.smoothstep(1.02, 1.12, ax)); v = Math.max(v, 0.024 * along - Math.abs(q[1] - yy)); }
      return v * 3;
    } });
    // arm stripes wrap the outer arm; paws a shade darker (gloves) so hands belong to the same animal
    for (const s of ['L', 'R']) {
      m.push({ parts: ['arm' + s + '.fore', 'arm' + s + '.upper'], color: pal.stripe, opacity: 0.8, fn: p => {
        const centers = [4, 9, 13.2, 17.4], widths = [0.7, 0.55, 0.75, 0.5];
        let band = -9; centers.forEach((c0, i) => { band = Math.max(band, widths[i] * (1 + 0.3 * Math.sin(p[2] * 0.9 + i)) - Math.abs(p[1] - c0 - 0.6 * Math.sin(p[2] * 0.5))); });
        const outer = (s === 'L' ? -p[0] : p[0]) * 0.35 + p[2] * 0.12 + 0.6;
        return Math.min(band, outer);
      } });
      m.push(...C.pawPads(s, pal.pad, body.anchors['tipPads' + s]));
      // thigh stripes (seen through the skirt slit)
      m.push({ parts: ['leg' + s + '.thigh'], color: pal.stripe, opacity: 0.8, fn: p => { let v = -9; for (const c0 of [10, 17, 24, 31]) v = Math.max(v, 0.8 * (1 + 0.3 * Math.sin(p[0] * 0.7)) - Math.abs(p[1] - c0 - 1.2 * Math.sin(p[2] * 0.4))); return Math.min(v, (s === 'L' ? -p[0] : p[0]) * 0.3 + p[2] * 0.2 + 1.2); } });
    }
    // tail rings and a dark tip
    m.push({ parts: ['tail'], color: pal.stripe, fn: p => { const { s, total } = tailS(p); return Math.max(Math.abs(Math.sin(s * 0.42)) - 0.72, (s - total + 6) * 0.3) * 3; } });
    // chest fluff: a cream V from the throat with a jagged lower edge, lying over the neckline
    m.push({ parts: ['torso.chest', 'torso.clav', 'neck'], color: pal.cream, fn: p => {
      if (p[2] < 1) return -1;
      const ax = Math.abs(p[0]), tri = 1 - Math.abs(((ax / 1.5) % 1) * 2 - 1);
      return Math.min(4.6 - ax - Math.max(0, p[1] + 48) * 0.28, -40.2 + 1.7 * tri - p[1]) * 1.4;
    } });
    // gold trim on the crop top edges
    m.push({ parts: [...C.TORSO, 'bustL', 'bustR'], color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.5, fn: p => { const d = topField(p); return Math.min(d, 0.65 - d); } });
    // low belt: lapis band with gold borders sitting on the hips
    m.push({ parts: [...C.TORSO, 'skirt'], color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.6, fn: p => 1.5 - Math.abs(p[1] - skirtTop - 0.5 - 0.012 * p[0] * p[0]) });
    m.push({ parts: [...C.TORSO, 'skirt'], color: pal.lapis, fn: p => 0.85 - Math.abs(p[1] - skirtTop - 0.5 - 0.012 * p[0] * p[0]) });
    // skirt: lapis-and-gold hem band along the slit edge
    m.push({ parts: ['skirt'], color: pal.lapis, fn: p => { const a = Math.atan2(p[0], p[2]); const hw = 0.16 + 0.011 * Math.max(0, p[1] - 4); return Math.min(0.13 - Math.abs(Math.abs(a + 0.9) - hw - 0.07), p[1] - 4); } });
    return m;
  },
  materialFields: () => [
    { parts: ['torso.*', 'bustL', 'bustR'], fn: p => { const d = topField(p); return d > 0 ? { mat: 'linen', alt: 'fur', d } : { mat: 'fur', alt: 'linen', d: -d }; } },
  ],
  postShade: () => '',
  hideParts: () => ['legR.thigh', 'legR.shin'],
  extraGroups: ({ body, head }) => {
    const out = [];
    const R = head.R, a = body.anchors;
    // diadem over the bangs with a lapis sun at the front
    const hc = head.toWorld([0, -0.5, -0.06]), axis = head.dirWorld([0, 1, 0.08]);
    const front = head.toWorld([0, -0.52, 1.1]), fn = head.dirWorld([0, -0.1, 1]);
    out.push({ name: 'jewel.diadem', k: 0.3, parts: [
      { name: 'diadem', mat: 'gold', prims: C.torus(hc, axis, 1.1 * R, 0.04 * R), k: 0.2 },
      { name: 'diadem.gem', mat: 'lapis', prims: [C.disc(front, fn, 0.12 * R, 0.4)] },
      { name: 'diadem.rim', mat: 'gold', prims: C.torus(front, fn, 0.135 * R, 0.028 * R) },
    ] });
    // choker with a lapis drop
    const nb = a.neckBase, nt = a.neckTop, nd = G.norm(G.sub(nt, nb));
    const cc = G.lerp(nb, nt, 0.62);
    out.push({ name: 'jewel.choker', k: 0.2, parts: [{ name: 'choker', mat: 'gold', prims: C.torus(cc, nd, 4.75, 0.42) }] });
    const fwd = G.norm(G.mvec(a.chestT.R, [0, 0, 1]));
    out.push({ name: 'jewel.drop', k: 0.1, line: 'always', parts: [{ name: 'drop', mat: 'lapis', prims: [B.ellBetween(G.add(cc, G.add(G.mul(fwd, 4.6), G.mul(nd, -0.6))), G.add(cc, G.add(G.mul(fwd, 4.9), G.mul(nd, -2.6))), 0.75, 0.45)] }] });
    // long linen skirt from a low waist, high slit on her left
    const slit = p => { const a2 = Math.atan2(p[0], p[2]); const hw = 0.16 + 0.011 * Math.max(0, p[1] - 4); return Math.max(4 - p[1], Math.abs(a2 + 0.9) - hw); };
    // deep enough at the back to contain the glutes (they poked through)
    const sk = C.skirt(a.pelvisT, [[skirtTop, 15.8, 10.6, -1.0], [-1, 17.8, 12.4, -1.8], [5, 18.8, 13.6, -2.0], [12, 18.6, 13.4, -1.4], [30, 16.2, 11.6, 0.6], [54, 14.8, 11.0, 1.6], [72, 16.0, 12.0, 2.2]], { mat: 'linen', pleats: 30, pleatAmp: 0.28 });
    const keep0 = sk.parts[0].keep;
    sk.parts[0].keep = p => Math.min(keep0(p), slit(p));
    out.push(sk);
    // arm bands and bracelets
    for (const s of ['L', 'R']) {
      const up = a['upper' + s], fo = a['fore' + s];
      if (up) out.push({ name: 'jewel.arm' + s, k: 0.3, parts: [C.limbBand(up, body.spec.arm.upper, 0.36, 4.25, 1.6, { th: 0.36, flare: 0 })] });
      if (fo) out.push({ name: 'jewel.wrist' + s, k: 0.3, parts: [C.limbBand(fo, body.spec.arm.fore, 0.86, 2.95, 1.3, { name: 'cuff1', th: 0.34, flare: 0 }), C.limbBand(fo, body.spec.arm.fore, 0.74, 3.25, 0.6, { name: 'cuff2', mat: 'lapis', th: 0.28, flare: 0 })] });
    }
    return out;
  },
  expressions: {
    neutral: { smile: 0.25, open: 0.82, lowerLid: 0.08 },
    lazy: { smile: 0.25, open: 0.45, lowerLid: 0.15, brow: { raise: -0.15 }, head: { roll: -0.2, pitch: 0.08, yaw: 0.2 }, ears: { droop: 0.25 } },
    smirk: { smile: 0.4, smirk: 0.55, open: 0.66, lowerLid: 0.16, blush: 0.35, brow: { raise: 0.1 }, browSide: { R: { raise: 0.45, angle: -0.2 } }, head: { roll: -0.12, yaw: 0.25 } },
    wink: { smile: 0.65, smirk: 0.3, wink: 'R', open: 0.85, blush: 0.4, head: { roll: 0.16, yaw: 0.2 }, ears: { perk: 0.6 } },
    laugh: { smile: 0.85, mouthOpen: 0.55, closed: 'happy', head: { pitch: -0.12, roll: 0.1 }, ears: { perk: 0.4 } },
    annoyed: { smile: -0.4, open: 0.5, lowerLid: 0.3, brow: { angle: 0.6 }, gazeShift: [0.55, 0], head: { yaw: -0.25, roll: 0.05 }, ears: { flat: 0.7 } },
    surprised: { smile: 0, mouthOpen: 0.35, open: 1.15, brow: { raise: 0.9 }, head: { pitch: -0.08 }, ears: { perk: 1 } },
    sad: { smile: -0.5, open: 0.75, brow: { angle: -0.75, raise: 0.35 }, gazeShift: [0, 0.4], head: { pitch: 0.18, roll: -0.08 }, ears: { droop: 0.9 } },
    flirty: { smile: 0.5, smirk: 0.2, open: 0.6, lowerLid: 0.2, blush: 0.6, gazeShift: [-0.35, 0.1], brow: { raise: 0.2 }, head: { roll: 0.22, yaw: 0.3, pitch: 0.05 } },
  },
  halfbodyExpr: 'smirk',
  poses: {
    ref: {
      pelvis: { roll: 0.05 }, chest: { roll: -0.04 }, head: { pitch: 0.02 },
      armL: { hand: [-21, 0, 4], pose: 'relaxed', palm: [1, 0, 0.3], pole: [-30, -20, -10] }, armR: { hand: [21, 0, 4], pose: 'relaxed', palm: [-1, 0, 0.3], pole: [30, -20, -10] },
      legL: { foot: [-8, 79, 5] }, legR: { foot: [8, 79, 2] },
      tailCtrl: [[0, 5, -8], [8, 14, -14], [20, 26, -12], [26, 44, -6], [22, 60, 0], [27, 70, 2]],
    },
    bust: {
      pelvis: {}, chest: { yaw: 0.1 }, head: { yaw: 0.2 },
      armL: { hand: [-15, -2, 6], pose: 'relaxed' }, armR: { hand: [15, -2, 6], pose: 'relaxed' },
    },
    halfbody: {
      pelvis: { roll: 0.16, yaw: -0.18, pos: [3, 0, 0] }, chest: { roll: -0.14, yaw: 0.2, pitch: -0.06 }, head: { yaw: 0.26, pitch: 0.06, roll: 0.16 },
      // pin-up: one hand behind the head (elbow high), the other on the hip
      armR: { hand: [5, -63, -5], pole: [30, -70, 2], pose: 'relaxed', palm: [-0.4, 0.2, -0.9], finger: [-1, -0.2, 0.1] },
      // the other hand rests on the bare thigh at the slit, fingers down
      armL: { hand: [-15.5, 6, 10.5], pole: [-44, -24, -12], pose: 'elegant', palm: [0.85, 0.1, -0.5], finger: [0.15, 1, 0.25] },
      tailCtrl: [[0, 5, -8], [9, 11, -14], [19, 8, -12], [25, -2, -5], [23, -12, 3], [17, -18, 8]],
      legL: { foot: [-12, 79, 13] }, legR: { foot: [9, 79, -2] },
    },
  },
  halfbodyView: { yaw: -0.5, s: 8.0, oy: 830 },
};
module.exports = ch;
