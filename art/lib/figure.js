'use strict';
// One call that turns a character spec + pose + expression + view into vector layers.
const G = require('./geom');
const Body = require('./body');
const Head = require('./head');
const Hair = require('./hair');
const { Raster, viewOf } = require('./raster');
const T = require('./toon');
const { g } = require('./svg');

function build(ch, { pose = {}, expr = {} } = {}) {
  const body = Body.build(ch.body, pose, ch.bodyMats || {});
  const head = Head.build(ch.species, { R: body.spec.headR, frame: body.anchors.headT, eyes: ch.head && ch.head.eyes, ear: ch.head && ch.head.ear, mats: ch.headMats || {}, partMats: ch.head && ch.head.partMats });
  const hair = ch.hair ? Hair.build(ch.hair.style, head, ch.hair.opts || {}) : { groups: [], markings: [], strands: [], extras: [] };
  const ctx = { body, head, hair, pose, expr, ch };
  const extra = ch.extraGroups ? ch.extraGroups(ctx) : [];
  const model = { groups: [...body.groups, ...head.groups, ...hair.groups, ...extra] };
  // garments as field-assigned materials: ch.materialFields = [{ parts: [names|prefixes], fn: localP -> {mat, alt, d} | null }]
  for (const mf of (ch.materialFields ? ch.materialFields(ctx) : [])) {
    for (const grp of model.groups) for (const part of grp.parts) {
      if (mf.parts.some(n => part.name === n || (n.endsWith('*') && part.name.startsWith(n.slice(0, -1))))) {
        const prev = part.matField;
        part.matField = prev ? (p => mf.fn(p) || prev(p)) : mf.fn;
      }
    }
  }
  if (pose.hide) model.groups = model.groups.filter(gr => !pose.hide.some(h => gr.name.startsWith(h)));
  return { ...ctx, model };
}

// view: { yaw, pitch, roll, s, ox, oy }, box: { x0, y0, w, h }
function render(doc, ch, { pose = {}, expr = {}, view, box, step = 1, light = {}, lineScale = 1, layer = 'char', add = true, name = ch.name } = {}) {
  const b = build(ch, { pose, expr });
  const v = viewOf(view);
  const Rs = new Raster({ ...box, step }).render(b.model, v);
  const ctx = { ...b, Rs, view: v, light };
  const markings = [...(ch.markings ? ch.markings(ctx) : []), ...b.hair.markings];
  const tufts = ch.tufts ? ch.tufts(ctx) : [];
  const res = T.figure(Rs, doc, { materials: ch.materials, markings, tufts, light, lineScale, add: false, name, shadowDist: { head: b.head.R * 0.45, 'head.earL': b.head.R * 0.3, 'head.earR': b.head.R * 0.3, ...(ch.shadowDist || {}) },
    postShade: () => ch.postShade ? ch.postShade(doc, ctx) : '' });
  const over = [];
  over.push(Head.features(doc, Rs, b.head, { expr, eye: ch.eye, light: light.key, lineColor: ch.lineColor, noseColor: ch.noseColor, mouthLine: ch.mouthLine, whiskers: ch.whiskers, whiskerColor: ch.whiskerColor }));
  if (b.hair.strands.length) over.push(Hair.overlay(doc, Rs, b.head, b.hair, ch.hairLines || {}));
  if (ch.overlays) over.push(ch.overlays(doc, ctx));
  // features belong above the shading but below the outer contour lines of the hair: insert before lines
  const svg = res.svg.replace('<g class="lines">', `${over.join('')}<g class="lines">`);
  const out = g({ class: 'character ' + (name || '') }, svg);
  if (add) doc.add(layer, out);
  return { ...ctx, res, svg: out };
}

module.exports = { build, render };
