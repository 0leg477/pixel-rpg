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
// triangle bikini cups (chest coords): base under the bust, apex toward the halter strap; the cups meet at the centre
const cupField = p => { if (p[2] < 0.5) return -1; const sx = p[0] < 0 ? -1 : 1, dx = p[0] - sx * 6.6, dy = p[1] + 33.0; return Math.min(4.9 - dy, dy + 7.0 - Math.abs(dx) * 1.0, 6.6 - Math.abs(dx)); };
// halter straps from the cup apex to the back of the neck
const strapField = p => { if (p[1] > -39.5 || p[1] < -49) return -1; const t = (p[1] + 39.5) / -9.5, x = 6.6 - 3.2 * t; return 0.42 - Math.abs(Math.abs(p[0]) - x); };
// bikini bottom (pelvis coords): low front edge, high-cut leg openings, thin side ties along the top edge
// the top edge rises at the back to cover the glutes (their tops sit well above the hip line)
const bottomTop = (x, z = 10) => { const back = G.smoothstep(6, -3, z); return (2.2 + 0.012 * x * x) * (1 - back) + (-8.4 + 0.02 * x * x) * back; };
// the back is full-coverage (leg line drops low behind), the front is a classic bikini cut
const bottomBody = p => {
  const ax = Math.abs(p[0]), top = bottomTop(p[0], p[2]);
  const back = G.smoothstep(6, -3, p[2]);
  const leg = (10.8 - 0.4 * ax) * (1 - back) + (17.5 - 0.2 * ax) * back;
  return Math.min(p[1] - top, leg - p[1]);
};
const bottomField = p => Math.max(bottomBody(p), Math.min(0.5 - Math.abs(p[1] - bottomTop(p[0], p[2]) - 0.45), 0.6));

const ch = {
  name: 'nefer', title: 'Нефер', species: 'cat', pal, style: 'pinup',
  scale: 1,
  subtitle: 'кошка · жрица Бастет · ленивая, язвительная, кокетливая',
  palNames: { fur: 'мех', cream: 'горло, грудка', stripe: 'полоски табби', hair: 'волосы', eye: 'глаза', nose: 'нос', innerEar: 'уши внутри', linen: 'лён', lapis: 'лазурит', gold: 'золото', turq: 'бирюза' },
  notes: [
    'Пин-ап «песочные часы»: крупная высокая грудь, очень узкая талия, широкие бёдра, бёдра ног толще талии.',
    'Мех непрерывен: кремовое горло переходит в пучок на груди.',
    'Полоски табби обвивают руки, бёдра и хвост — голова и тело одного зверя.',
    'Лицо: огромные низко посаженные глаза, тяжёлые веки, бирюзовые тени, мордочка-бугорок.',
    'Каре с тупой чёлкой до бровей; уши большие, торчат над волосами.',
    'Наряд жрицы-танцовщицы: бикини из льна с золотом, передники с лазуритом, браслеты на бёдрах.',
  ],
  refDetails: () => [
    { label: 'голова 3/4', target: b => b.head.anchors.cranium, zoom: 13, yaw: -0.45 },
    { label: 'лиф и колье', target: b => G.tapply(b.body.anchors.chestT, [0, -38, 7]), zoom: 9, yaw: -0.25 },
    { label: 'лапа и браслеты', target: b => G.tapply(b.body.anchors.handR, [0, 2, 0]), zoom: 11, yaw: -0.2, pitch: 0.05 },
    { label: 'пояс и передник', target: b => G.tapply(b.body.anchors.pelvisT, [0, 6, 10]), zoom: 6.5, yaw: -0.3 },
  ],
  icon: { expr: 'wink', accent: '#4fd1c5', ring: '#e8b444', yaw: -0.3, zoom: 3.9, cy: 0.5 },
  body: {
    headR: 14.6,
    neck: { len: 5.6, r: 4.4, rTop: 4.0 },
    torso: [
      [-49, 5.6, 4.6, -2.0], [-45, 10.2, 6.6, -1.4], [-40, 11.2, 8.0, -0.2], [-35, 11.0, 8.4, 0.4], [-30, 10.0, 8.0, 0.4],
      [-25, 8.2, 7.0, 0.2], [-19, 7.0, 6.2, -0.2], [-15, 7.4, 6.5, 0.1], [-10, 10.8, 7.8, 0.5], [-5, 15.6, 9.3, 0.5],
      [0, 18.8, 10.6, -0.3], [5, 18.4, 11.0, -1.2], [9, 14.6, 9.4, -1.0]],
    shoulder: { x: 11.4 },
    bust: { r: [7.8, 7.4, 7.0], x: 6.6, y: -33.4, z: 6.0, splay: 0.2, droop: 0.1, separate: true },
    glutes: { r: [10.8, 11.6, 10.2], x: 8.2 },
    arm: { upper: 21, fore: 18.5, r: [3.7, 3.2, 2.6, 2.95, 3.0, 2.1] },
    // thigh thickest a quarter of the way down; a small sphere at the joint so the pelvis (and the bikini on it) stays visible
    leg: { thigh: 40, shin: 30, meta: 14, hipX: 9.0, r: [10.0, 10.0, 5.2, 4.8, 5.4, 2.7, 2.2], thighR: [8.6, 11.4, 10.2, 7.6, 5.4] },
    groundY: 77,
    tail: { r: [2.7, 2.55, 2.4, 2.25, 2.0], ctrl: tailCtrl },
    hand: { paw: true, claws: true },
  },
  head: { eyes: {} },
  eye: { iris: pal.eye, lashColor: pal.kohl, lidColor: '#1c1222', lash: 0.34, wing: 0.85, wingUp: 0.45, lowerWing: 0.45, tilt: 0.14, eyeshadow: '#2fa8c8', irisR: 0.68, irisRy: 0.74,
    brow: { color: '#1a1f4a', width: 0.1, y: -1.55 } },
  noseColor: pal.nose, mouthLine: '#3b2226', whiskers: false,
  hair: { style: 'bob', opts: { bang: -0.36, winX: 1.12, winZ: -0.1, cut: 0.72, sheen: '#7d9cff', bangSpread: 0.9, bangClumps: 13, bangTip: 0.62, ring: true } },
  bustScale: 6.2, emoCy: 0.5,
  hairLines: { lineColor: '#090b18', hiColor: '#5a78d0', width: 0.08 },
  materials: {
    fur: { base: pal.fur, sss: true, gloss: 0.962, glossK: 0.55 }, cream: { base: pal.cream, sss: true, gloss: 0.96, glossK: 0.5 },
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
      const hipS = body.anchors['hip' + s], kneeS = body.anchors['knee' + s];
      const frS = hipS && kneeS ? require('../lib/body').segFrame(hipS, kneeS) : null, invP = G.tinv(body.anchors.pelvisT);
      m.push({ parts: ['leg' + s + '.thigh'], color: pal.stripe, opacity: 0.8, fn: p => { if (frS && bottomBody(G.tapply(invP, G.tapply(frS, p))) > -0.3) return -1; let v = -9; for (const c0 of [10, 17, 24, 31]) v = Math.max(v, 0.8 * (1 + 0.3 * Math.sin(p[0] * 0.7)) - Math.abs(p[1] - c0 - 1.2 * Math.sin(p[2] * 0.4))); return Math.min(v, (s === 'L' ? -p[0] : p[0]) * 0.3 + p[2] * 0.2 + 1.2); } });
    }
    // tail rings and a dark tip
    m.push({ parts: ['tail'], color: pal.stripe, fn: p => { const { s, total } = tailS(p); return Math.max(Math.abs(Math.sin(s * 0.42)) - 0.72, (s - total + 6) * 0.3) * 3; } });
    // chest fluff: a cream V from the throat with a jagged lower edge, lying over the neckline
    m.push({ parts: ['torso.chest', 'torso.clav', 'neck'], color: pal.cream, fn: p => {
      if (p[2] < 1) return -1;
      const ax = Math.abs(p[0]), tri = 1 - Math.abs(((ax / 1.5) % 1) * 2 - 1);
      return Math.min(3.6 - ax - Math.max(0, p[1] + 48) * 0.3, -42.2 + 1.5 * tri - p[1]) * 1.4;
    } });
    // gold edges on the bikini cups, gold halter straps and under-band
    m.push({ parts: [...C.TORSO, 'bustL', 'bustR'], color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.45, fn: p => { const d = cupField(p); return Math.min(d, 0.55 - d); } });
    m.push({ parts: [...C.TORSO, 'bustL', 'bustR', 'neck'], color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.4, fn: strapField });
    m.push({ parts: ['torso.chest', 'torso.waist'], color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.4, fn: p => (p[2] > 4 ? -1 : 0.38 - Math.abs(p[1] + 27.6)) });
    // navel and a soft centre line on the belly
    m.push({ parts: ['torso.waist', 'torso.pelvis'], color: '#9a5a2a', opacity: 0.75, fn: p => (p[2] < 3 ? -1 : 0.5 - Math.hypot(p[0] / 0.55, (p[1] + 9.5) / 0.9)) });
    m.push({ parts: ['torso.waist'], color: '#b8783a', opacity: 0.3, fn: p => (p[2] < 3 ? -1 : Math.min(0.16 - Math.abs(p[0]), p[1] + 26, -12 - p[1])) });
    // low belt on the hips: gold with lapis inlay
    const beltY = p => bottomTop(p[0], p[2]) + 0.15;
    m.push({ parts: [...C.TORSO, 'legL.thigh', 'legR.thigh'], color: pal.gold, edge: Cc.ramp(pal.gold).line, edgeWidth: 0.5, fn: p => 1.2 - Math.abs(p[1] - beltY(p)) });
    m.push({ parts: [...C.TORSO], color: pal.lapis, fn: p => Math.min(0.6 - Math.abs(p[1] - beltY(p)), 0.3 - Math.abs(Math.sin(Math.atan2(p[0], p[2]) * 11)) * 0.35 + 0.1) });
    return m;
  },
  materialFields: ({ body }) => [
    { parts: ['torso.*', 'bustL', 'bustR'], fn: p => { const d = cupField(p); return d > 0 ? { mat: 'linen', alt: 'fur', d } : null; } },
    { parts: ['torso.pelvis', 'torso.glute'], fn: p => { const d = bottomField(p); return d > 0 ? { mat: 'linen', alt: 'fur', d } : null; } },
    // the bikini continues onto the tops of the thighs: evaluate the same field in pelvis space
    ...['L', 'R'].map(s => {
      const hip = body.anchors['hip' + s], knee = body.anchors['knee' + s];
      if (!hip || !knee) return null;
      const fr = require('../lib/body').segFrame(hip, knee), inv = G.tinv(body.anchors.pelvisT);
      return { parts: ['leg' + s + '.thigh'], fn: p => { const q = G.tapply(inv, G.tapply(fr, p)); const d = bottomBody(q); return d > 0 ? { mat: 'linen', alt: 'fur', d } : null; } };
    }).filter(Boolean),
  ],
  postShade: () => '',
  hideParts: () => [],
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
    // lapis amulet hanging from the belt at the front (instead of aprons: they cut into the forward thigh)
    const pT = a.pelvisT;
    const am0 = G.tapply(pT, [0, 1.4, 10.9]), am1 = G.tapply(pT, [0, 4.6, 11.6]);
    out.push({ name: 'jewel.amulet', k: 0.1, line: 'always', parts: [{ name: 'amulet', mat: 'lapis', prims: [B.ellBetween(am0, am1, 1.5, 0.6)] }] });
    out.push({ name: 'jewel.amuletRim', k: 0.1, parts: [{ name: 'amuletRim', mat: 'gold', prims: [B.ellBetween(G.add(am0, G.mvec(pT.R, [0, -0.3, -0.25])), G.add(am1, G.mvec(pT.R, [0, 0.35, -0.25])), 1.85, 0.5)] }] });
    // gold bands high on the thighs
    const Body = require('../lib/body');
    for (const s of ['L', 'R']) {
      const hip = a['hip' + s], knee = a['knee' + s];
      if (hip && knee) { const fr = Body.segFrame(hip, knee); out.push({ name: 'jewel.thigh' + s, k: 0.3, parts: [C.limbBand(fr, G.len(G.sub(knee, hip)), 0.45, 11.7, 1.5, { th: 0.6, flare: 0 })] }); }
    }
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
    smirk: { smile: 0.4, smirk: 0.55, open: 0.66, lowerLid: 0.16, blush: 0.7, brow: { raise: 0.1 }, browSide: { R: { raise: 0.45, angle: -0.2 } }, head: { roll: -0.12, yaw: 0.25 } },
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
      legL: { foot: [-8, 77, 5] }, legR: { foot: [8, 77, 2] },
      tailCtrl: [[0, 5, -8], [8, 14, -14], [20, 26, -12], [26, 44, -6], [22, 60, 0], [27, 70, 2]],
    },
    bust: {
      pelvis: {}, chest: { yaw: 0.1 }, head: { yaw: 0.2 },
      armL: { hand: [-15, -2, 6], pose: 'relaxed' }, armR: { hand: [15, -2, 6], pose: 'relaxed' },
    },
    halfbody: {
      // contrapposto: weight on her right leg, hip thrust out, shoulders counter-tilted
      pelvis: { roll: 0.2, yaw: -0.22, pos: [3.5, 0, 0] }, chest: { roll: -0.17, yaw: 0.22, pitch: -0.07 }, head: { yaw: 0.3, pitch: 0.05, roll: 0.18 },
      armR: { hand: [5, -64, -6], pole: [30, -72, 2], pose: 'relaxed', palm: [-0.4, 0.2, -0.9], finger: [-1, -0.2, 0.1] },
      armL: { hand: [-18.5, -3, 4.5], pole: [-44, -28, -14], pose: 'hip', palm: [1, 0, 0.1], finger: [0.25, 0.65, 0.7] },
      tailCtrl: [[0, 5, -8], [9, 11, -14], [19, 8, -12], [25, -2, -5], [23, -12, 3], [17, -18, 8]],
      legL: { foot: [-3, 77, 14] }, legR: { foot: [11, 77, -2] },
    },
  },
  halfbodyView: { yaw: -0.48, s: 7.4, oy: 760 },
};
module.exports = ch;
