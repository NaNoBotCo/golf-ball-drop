// The page's drawing kit: flat colour (Nan, 2026-10-24: "Style should be sophisticated but flat",
// "sunny days with hot air balloons are supposed to be beautiful"). Solid fills, clean edges, one
// palette. The file keeps its old name and exports so the toys' physics did not have to move; the
// halftones, crayon wobble, off-register inks and paper wear it used to draw are gone.

// One palette. The roles keep the names the drawing code already uses:
//   sky   the cool accent      warm  the balloon's coral      sun  gold
//   key   the dark (lines, the balloon's slate, words)        leaf the lawn
export const PAL = {
  paper: '#F7F5F0', card: '#FFFFFF', line: '#E4DFD4',
  skyTop: '#9FCDEB', skyLow: '#EAF4F6', sunDisc: '#FFF6DC',
  hillFar: '#C9DFD6', hillMid: '#AECDB8', tree: '#78A981', treeDeep: '#5E9068', trunk: '#7A6656',
  lawn: '#A9CF8F', lawnStripe: '#B6D79D', lawnFront: '#9DC584',
  coral: '#E5806A', coralDeep: '#CB6650', pale: '#F2EEE8', slate: '#6A7891', gold: '#F1BE4F',
  wicker: '#C08B57', wickerDeep: '#9C6C41', chalk: '#FFFFFF', chedi: '#FBF8F1', chediShade: '#E8E0D0',
  ink: '#1F2A3D', mute: '#5C6577',
};
const FLAT = { name: 'Flat', paper: PAL.paper, sky: '#3E7CB1', warm: PAL.coral, sun: PAL.gold, key: PAL.ink, leaf: PAL.lawn, text: PAL.ink, chart: { paid: '#3E7CB1', gift: '#E2735C' }, dingbat: { pink: PAL.coral, blue: '#3E7CB1', yellow: PAL.gold, teal: '#5E9068', ink: PAL.ink } };
export const LOOKS = { flat: FLAT, picnic: FLAT, rotary: FLAT, fluoro: FLAT };
export const ORDER = ['sun', 'leaf', 'sky', 'warm', 'key'];

export let look = FLAT;
const listeners = [];
export function onLook(fn) { listeners.push(fn); }
export function setLook() {
  look = FLAT;
  const r = document.documentElement, s = r.style;
  r.dataset.look = 'flat';
  for (const k of ['paper', 'sky', 'warm', 'sun', 'key']) s.setProperty('--' + k, look[k]);
  s.setProperty('--leaf', look.leaf); s.setProperty('--paid', look.chart.paid); s.setProperty('--gift', look.chart.gift);
  listeners.forEach((f) => f(look));
}
export const inkOf = (name) => look[name] || look.key;

// ── numbers ──────────────────────────────────────────────────────────────────
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function hex(c) { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(c); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : [0, 0, 0]; }
export function mix(a, b, t = 0.5) { const p = hex(a), q = hex(b); return '#' + p.map((v, i) => Math.round(lerp(v, q[i], t)).toString(16).padStart(2, '0')).join(''); }
export function noise(seed) {
  const h = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi); return lerp(lerp(h(xi, yi), h(xi + 1, yi), fx), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), fx), fy); };
}

// ── surfaces ─────────────────────────────────────────────────────────────────
export function surface(w, h, dpr = 1) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cv, ctx, w, h, dpr };
}

// What used to be a halftone screen is now a flat wash: the tone function is sampled on a coarse grid,
// stepped to a few levels, and laid as solid colour with soft edges. Tone 1 is the full colour.
export function screen(ctx, box, pitch, ang, tone, color, clip) {
  const x0 = Math.max(0, Math.floor(box.x0)), y0 = Math.max(0, Math.floor(box.y0)), cw = Math.ceil(box.x1 - x0), ch = Math.ceil(box.y1 - y0);
  if (cw <= 0 || ch <= 0) return;
  const cell = 3, gw = Math.max(1, Math.ceil(cw / cell)), gh = Math.max(1, Math.ceil(ch / cell));
  const g = document.createElement('canvas'); g.width = gw; g.height = gh;
  const gc = g.getContext('2d'), id = gc.createImageData(gw, gh), [r, gg, b] = hex(color);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    let t = tone(x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell); if (!(t > 0.04)) continue;
    t = Math.min(1, Math.round(Math.min(1, t) * 4) / 4 || 0.25);
    const k = (j * gw + i) * 4; id.data[k] = r; id.data[k + 1] = gg; id.data[k + 2] = b; id.data[k + 3] = Math.round(t * 255);
  }
  gc.putImageData(id, 0, 0);
  ctx.save(); if (clip) ctx.clip(clip); ctx.imageSmoothingEnabled = true; ctx.drawImage(g, x0, y0, gw * cell, gh * cell); ctx.restore();
}
export const tone = () => 0;

// A clean line: constant width, round ends, no wobble.
export function crayon(ctx, pts, { w = 2, color = '#000', alpha = 1, close = false } = {}) {
  if (pts.length < 2) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath(); ctx.stroke(); ctx.restore();
}
// a smooth path through points (Catmull-Rom)
export function spline(pts, close = true, per = 6) {
  const out = [], n = pts.length, at = (i) => pts[close ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  if (!close) out.push(pts[n - 1]);
  return out;
}
export function path(pts, close = true) { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); return p; }
export function blob(cx, cy, rx, ry, seed, lumpy = 0.08, n = 14) {
  const r = rng(seed), ph = r() * 6.28;
  return spline(Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = 1 + lumpy * (Math.sin(a * 3 + ph) * 0.6 + (r() - 0.5) * 0.5); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; }), true, 5);
}

// Plates, kept for the code that still hands its marks over by ink: each ink's marks drawn in order,
// flat, on top of one another. No misregistration, no wear, no multiply.
export const STRENGTH = 1;
export function print(dest, plates, { paper = true } = {}) {
  const { ctx, w, h } = dest;
  if (paper) { ctx.save(); ctx.fillStyle = look.paper; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  ORDER.forEach((ink) => {
    const fn = plates[ink]; if (!fn) return;
    const color = inkOf(ink);
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; fn(ctx, color, dest); ctx.restore();
  });
  return dest;
}
// the greens: lawn marks go on the leaf ink
export function greens(plates, fn) { plates.leaf = (c, ink, L) => fn(c, 'leaf', 1, L); return plates; }
