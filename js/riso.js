// Printing on screen the way a risograph prints on paper (anidoodle's risograph plate, the
// lighthouse, is the method): one drum per ink, each ink drawn on its own layer and multiplied
// onto the paper through its own slightly-off registration. Every colour that is not an ink is
// an overprint (sky blue over yellow is the lawn). Tone is a halftone screen whose dots grow
// with a tone function, each ink on its own screen angle. White is bare paper. A drum never
// prints perfectly: a few specks of paper show through and the ink lies a little unevenly.

// Three ink sets. Each names its drums by the job they do in the picture.
//   sky   the sky, water, the cool half of every overprint
//   warm  the balloon's coral cells, the flame's heart, the tape posts
//   sun   yellow: sunlight, the lawn's warm half, gold
//   key   the dark drum: lines, the balloon's slate cells, people, words
//   leaf  (optional) its own green; without it the lawn is sky over sun
export const LOOKS = {
  picnic: { name: 'Picnic', paper: '#f7f1e3', sky: '#0078bf', warm: '#ff665e', sun: '#ffe800', key: '#2f3f73', text: '#1f2a4f', chart: { paid: '#0078bf', gift: '#ff665e' }, dingbat: { pink: '#ff665e', blue: '#0078bf', yellow: '#ffe800', teal: '#00a95c', ink: '#2f3f73' } },
  rotary: { name: 'Rotary', paper: '#f6f3ea', sky: '#3255a4', warm: '#ff6c2f', sun: '#ffb511', key: '#1d2a4d', leaf: '#3db36b', text: '#17213f', chart: { paid: '#3255a4', gift: '#ff6c2f' }, dingbat: { pink: '#ff6c2f', blue: '#3255a4', yellow: '#ffb511', teal: '#00a95c', ink: '#1d2a4d' } },
  fluoro: { name: 'Fluoro', paper: '#f8f2e6', sky: '#5ec8e5', warm: '#ff48b0', sun: '#ffe800', key: '#3d3a78', text: '#231f52', chart: { paid: '#2a9fc2', gift: '#ff48b0' }, dingbat: { pink: '#ff48b0', blue: '#5ec8e5', yellow: '#ffe800', teal: '#00838a', ink: '#3d3a78' } },
};
export const ORDER = ['sun', 'leaf', 'sky', 'warm', 'key'];
// where each drum lands, in CSS pixels, against the key
const REG = { sky: [-1.1, 0.7], warm: [1.5, -1.0], sun: [-1.6, 1.3], leaf: [0.9, 1.1], key: [0, 0] };
// screen angles, so the inks rosette instead of moiré
const ANG = { sky: 15, warm: 75, sun: 0, leaf: 45, key: 45 };

export let look = LOOKS.picnic;
const listeners = [];
export function onLook(fn) { listeners.push(fn); }
export function setLook(name) {
  look = LOOKS[name] || LOOKS.picnic;
  const r = document.documentElement, s = r.style;
  r.dataset.look = LOOKS[name] ? name : 'picnic';
  for (const k of ['paper', 'sky', 'warm', 'sun', 'key', 'text']) s.setProperty('--' + k, look[k]);
  s.setProperty('--leaf', look.leaf || mix(look.sky, look.sun));
  s.setProperty('--paid', look.chart.paid); s.setProperty('--gift', look.chart.gift);
  if (window.Dingbats && Dingbats.riso) Dingbats.riso(look.dingbat);
  listeners.forEach((f) => f(look));
}
export const inkOf = (name) => look[name] || (name === 'leaf' ? mix(look.sky, look.sun) : look.key);

// ── numbers ──────────────────────────────────────────────────────────────────
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function hex(c) { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(c); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : [0, 0, 0]; }
export function mix(a, b) { const p = hex(a), q = hex(b); return '#' + p.map((v, i) => Math.round((v * q[i]) / 255).toString(16).padStart(2, '0')).join(''); }
// value noise in 0..1, smooth, seeded
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

// A halftone screen over a box: a dot at every node of a grid turned by `ang` degrees, its
// area following tone(x, y) in 0..1. Tone 1 closes into a solid.
export function screen(ctx, box, pitch, ang, tone, color, clip) {
  const a = (ang * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, R = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2 + pitch;
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.fillStyle = color; ctx.beginPath();
  const n = Math.ceil(R / pitch);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const u = i * pitch, v = j * pitch, x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
    if (x < box.x0 - pitch || x > box.x1 + pitch || y < box.y0 - pitch || y > box.y1 + pitch) continue;
    const t = tone(x, y); if (!(t > 0.015)) continue;
    const r = pitch * 0.71 * Math.sqrt(Math.min(1.1, t));
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill(); ctx.restore();
}
export const tone = (ink) => ANG[ink] ?? 45;

// A crayon line: it swells and thins, wobbles a little, and the stroke is not quite even.
export function crayon(ctx, pts, { w = 2, color = '#000', seed = 1, wobble = 0.6, alpha = 1, close = false } = {}) {
  if (pts.length < 2) return;
  const r = rng(seed), P = close ? pts.concat([pts[0]]) : pts;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i], k = i / (P.length - 1);
    ctx.lineWidth = w * (0.72 + 0.5 * Math.sin(k * Math.PI) + (r() - 0.5) * 0.3);
    ctx.beginPath(); ctx.moveTo(x0 + (r() - 0.5) * wobble, y0 + (r() - 0.5) * wobble); ctx.lineTo(x1 + (r() - 0.5) * wobble, y1 + (r() - 0.5) * wobble); ctx.stroke();
  }
  ctx.restore();
}
// a smooth closed or open path through points (Catmull-Rom), as Path2D
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
export function blob(cx, cy, rx, ry, seed, lumpy = 0.18, n = 14) {
  const r = rng(seed), ph = r() * 6.28;
  return spline(Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = 1 + lumpy * (Math.sin(a * 3 + ph) * 0.6 + (r() - 0.5)); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; }), true, 5);
}

// What a drum does to its own layer: specks where the ink missed, and an uneven lay.
function wear(s, seed) {
  const { ctx, w, h } = s, r = rng(seed), nz = noise(seed);
  ctx.save(); ctx.globalCompositeOperation = 'destination-out';
  // the uneven lay: a soft field of lighter patches
  const g = surface(Math.ceil(w / 14), Math.ceil(h / 14), 1);
  const id = g.ctx.createImageData(g.cv.width, g.cv.height);
  for (let y = 0; y < g.cv.height; y++) for (let x = 0; x < g.cv.width; x++) {
    const v = nz(x / 9, y / 9) * 0.65 + nz(x / 3 + 40, y / 3) * 0.35, i = (y * g.cv.width + x) * 4;
    id.data[i + 3] = Math.round(clamp((v - 0.42) * 1.6) * 70);
  }
  g.ctx.putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(g.cv, 0, 0, w, h);
  // specks and hairs of bare paper
  ctx.fillStyle = '#000'; ctx.beginPath();
  const n = Math.round((w * h) / 260);
  for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, rr = 0.35 + r() * r() * 1.1; ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, 6.283); }
  ctx.fill();
  ctx.restore();
}

// Print a picture: fill the paper, then each drum in ORDER on its own layer, worn, multiplied
// through its registration. `plates` maps a drum name to a function that draws that drum's
// marks with ctx.fillStyle already set to its ink (and gets the ink as its second argument).
export function print(dest, plates, { seed = 7, paper = true, reg = 1, offset = [0, 0] } = {}) {
  const { ctx, w, h, dpr } = dest;
  if (paper) { ctx.save(); ctx.fillStyle = look.paper; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  ORDER.forEach((ink, k) => {
    const fn = plates[ink]; if (!fn) return;
    if (ink === 'leaf' && !look.leaf) return;
    const L = surface(w, h, dpr), color = inkOf(ink);
    L.ctx.fillStyle = color; L.ctx.strokeStyle = color;
    fn(L.ctx, color, L);
    wear(L, seed * 31 + k);
    const [ox, oy] = REG[ink];
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(L.cv, Math.round((ox * reg + offset[0]) * dpr), Math.round((oy * reg + offset[1]) * dpr));
    ctx.restore();
  });
  return dest;
}
// Plates whose lawn is its own green when the look has one, and sky over sun when it does not:
// a helper for the green drums.
export function greens(plates, fn) {
  if (look.leaf) plates.leaf = (c, ink, L) => fn(c, 'leaf', 0.72, L);
  else {
    const sky = plates.sky, sun = plates.sun;
    plates.sky = (c, ink, L) => { sky && sky(c, ink, L); c.fillStyle = ink; fn(c, 'sky', 0.62, L); };
    plates.sun = (c, ink, L) => { sun && sun(c, ink, L); c.fillStyle = ink; fn(c, 'sun', 1, L); };
  }
  return plates;
}
