'use strict';
// Placeholder temple background (replaced by the full scene later).
function background(doc, ch, v) {
  const sky = doc.linear([[0, '#0f1430'], [0.6, '#2a2346'], [1, '#4a3040']]);
  doc.add('bg', `<rect width="${doc.w}" height="${doc.h}" fill="${sky}"/>`);
}
module.exports = { background };
