// The things drawn on this page, printed with js/riso.js. Reference: Nan's photos of the
// 31 Jan 2026 drop (img/2026): a checkered balloon, about 45% coral, 30% pale grey and 25% plum
// slate with a few yellow cells and navy gores only below the waist; a coral mouth; a lined
// lawn with chalk; yellow-and-black tape on wooden stakes; a crowd seen from behind in hoods,
// hats, bags and bare calves; rain trees, droopy willows, palms, a thorny kapok trunk and white
// chedis behind; a hot afternoon sky.
import { look, inkOf, rng, clamp, lerp, hex, surface, screen, tone, crayon, spline, path, blob, print, greens } from './riso.js';

const TAU = Math.PI * 2;
const probe = document.createElement('canvas').getContext('2d');
const inPath = (p, x, y) => probe.isPointInPath(p, x, y);
// A shape as a lookup: painted once, read per halftone node (isPointInPath per node is slow on big paths).
function maskOf(w, h, paint) {
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w); cv.height = Math.ceil(h);
  const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#000'; paint(c);
  const d = c.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
  return (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi >= 0 && yi >= 0 && xi < W && yi < H && d[(yi * W + xi) * 4 + 3] > 127; };
}
// riso.screen() prints a dot of radius 0.71*sqrt(t)*pitch: a tone of 0.63 or more closes into a
// solid and a mid tone lands about 1.6x heavier than written. scr() writes tones at 0.62.
const GAM = 0.62;
// riso.screen() walks the whole box's grid for every call. With `b` (the clip's bounds, {x0,x1,y0,y1}) it walks only
// the lattice nodes whose dots can land inside them: the same lattice, the same dots, a fraction of the visits.
function screenIn(ctx, box, pitch, ang, tone, color, clip, b) {
  const a = (ang * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const x0 = Math.max(b.x0, box.x0 - pitch) - pitch, x1 = Math.min(b.x1, box.x1 + pitch) + pitch, y0 = Math.max(b.y0, box.y0 - pitch) - pitch, y1 = Math.min(b.y1, box.y1 + pitch) + pitch;
  if (x1 < x0 || y1 < y0) return;
  let iMin = 1e9, iMax = -1e9, jMin = 1e9, jMax = -1e9;
  [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y]) => { const u = ((x - cx) * ca + (y - cy) * sa) / pitch, v = ((y - cy) * ca - (x - cx) * sa) / pitch; iMin = Math.min(iMin, u); iMax = Math.max(iMax, u); jMin = Math.min(jMin, v); jMax = Math.max(jMax, v); });
  ctx.save(); if (clip) ctx.clip(clip);
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = Math.floor(iMin); i <= Math.ceil(iMax); i++) for (let j = Math.floor(jMin); j <= Math.ceil(jMax); j++) {
    const u = i * pitch, v = j * pitch, x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const t = tone(x, y); if (!(t > 0.015)) continue;
    const r = pitch * 0.71 * Math.sqrt(Math.min(1.1, t));
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill(); ctx.restore();
}
const scr = (c, box, P, a, fn, ink, clip, b) => (b ? screenIn(c, box, P, a, (x, y) => fn(x, y) * GAM, ink, clip, b) : screen(c, box, P, a, (x, y) => fn(x, y) * GAM, ink, clip));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// An ink laid at a coverage over paper, and inks overprinted: the colour a halftone averages to.
const tintCache = new Map();
function tint(...parts) {
  const key = look.name + look.paper + parts.map((p) => p[0] + p[1]).join('|'); if (tintCache.has(key)) return tintCache.get(key);
  let c = hex(look.paper).map(Number);
  parts.forEach(([n, a]) => { const q = n === 'paper' ? [255, 255, 255] : hex(inkOf(n)); c = c.map((v, i) => v * (1 - a + (a * q[i]) / 255)); });
  const out = '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  tintCache.set(key, out); return out;
}

// ── the balloon ──────────────────────────────────────────────────────────────
// Its envelope in a box S wide: the crown is round to the equator at 36% of the height, then it
// tapers in a long convex cone to a mouth 20% as wide. Nine gores face us (her photo counts about eight across the face);
// eleven rows of panels.
const EQ = 0.36, MOUTH = 0.10;
export function halfW(u) {
  if (u <= EQ) { const k = (EQ - u) / EQ; return 0.5 * Math.sqrt(Math.max(0, 1 - k * k)); }
  const t = (u - EQ) / (1 - EQ); return MOUTH + (0.5 - MOUTH) * Math.pow(Math.cos((t * Math.PI) / 2), 1.3);
}
const ROWS = [0, 0.055, 0.125, 0.205, 0.29, 0.375, 0.46, 0.545, 0.635, 0.735, 0.9, 1];
const GORES = 9;
// the photo: a coral checkerboard with grey and slate on the other parity, navy only in the long
// lower gores, a coral mouth, a few yellow cells where coral would be
function cellKind(i, j) {
  if (i >= 10) return 'coral';
  if (i >= 8) return j % 2 ? 'grey' : 'navy';
  if ((i === 5 && (j === 0 || j === 2)) || (i === 6 && j === 1) || (i === 4 && j === 1)) return 'yellow';
  return (i + j) % 2 === 1 ? 'coral' : (((j >> 1) + (i >> 2)) % 2 ? 'slate' : 'grey');
}
// the light comes from the upper left, a little in front
const LX = -0.52, LY = -0.62, LZ = 0.59;
function shade(u, s) {           // s = x / halfW in -1..1
  const phi = u <= EQ ? (Math.PI / 2) * ((EQ - u) / EQ) : -1.05 * ((u - EQ) / (1 - EQ)), th = Math.asin(clamp(s, -1, 1));
  const nx = Math.sin(th) * Math.cos(phi), ny = -Math.sin(phi), nz = Math.cos(th) * Math.cos(phi);
  return clamp(nx * LX + ny * LY + nz * LZ, -1, 1);
}
// a panel's outline, sampled down its two meridians
function cell(cx, top, S, H, i, j) {
  const u0 = ROWS[i], u1 = ROWS[i + 1], a0 = -Math.PI / 2 + (j / GORES) * Math.PI, a1 = a0 + Math.PI / GORES, pts = [];
  for (let k = 0; k <= 6; k++) { const u = lerp(u0, u1, k / 6); pts.push([cx + S * halfW(u) * Math.sin(a0), top + H * u]); }
  for (let k = 6; k >= 0; k--) { const u = lerp(u0, u1, k / 6); pts.push([cx + S * halfW(u) * Math.sin(a1), top + H * u]); }
  return pts;
}
// Bake the balloon (envelope, coral mouth, cables, burner frame, a pale basket with two pilots)
// into a sprite. Returns { cv, w, h, mouth:[x,y] (the burner, where the flame sits), basket:[x,y,w,h],
// env: Path2D in sprite px, cut: y where the envelope ends and the basket's side begins }.
// opts.cables === false leaves the four cables off the sprite and returns them as B.cables, for a
// caller that draws them live between an envelope and a basket that move apart.
export function bakeBalloon(S, dpr = 2, seed = 11, opts = {}) {
  const H = S * 1.12, pad = S * 0.06, W = S + pad * 2, BH = S * 0.2, total = pad + H + S * 0.2 + BH + pad;
  const s = surface(W, total, dpr), cx = W / 2, top = pad, mY = top + H;
  const envPts = []; for (let k = 0; k <= 40; k++) { const u = k / 40; envPts.push([cx + S * halfW(u), top + H * u]); } for (let k = 40; k >= 0; k--) { const u = k / 40; envPts.push([cx - S * halfW(u), top + H * u]); }
  const env = path(envPts);
  const kinds = { coral: [], grey: [], slate: [], navy: [], yellow: [] };
  for (let i = 0; i < ROWS.length - 1; i++) for (let j = 0; j < GORES; j++) { const pts = cell(cx, top, S, H, i, j), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]); kinds[cellKind(i, j)].push({ p: path(pts), x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1, y0: Math.min(...ys) - 1, y1: Math.max(...ys) + 1 }); }
  const box = { x0: 0, y0: 0, x1: W, y1: total }, P = Math.max(2.6, S / 60);
  const cs = (c, a, f, ink, o, pitch = P) => scr(c, box, pitch, a, (x, y) => (x < o.x0 || x > o.x1 || y < o.y0 || y > o.y1 ? 0 : f(x, y)), ink, o.p, o);   // a panel's screen, walked and computed only inside its box
  const lit = (x, y) => { const u = (y - top) / H, hw = S * halfW(u); return hw > 0.5 ? shade(u, (x - cx) / hw) : 0; };
  const fade = (x, y) => 1 - 0.38 * Math.pow(Math.max(0, lit(x, y)), 6);   // the highlight lifts the ink
  const sk = mY + S * 0.07, skirt = path([[cx - S * MOUTH, mY], [cx + S * MOUTH, mY], [cx + S * MOUTH * 0.9, sk], [cx - S * MOUTH * 0.9, sk]]);
  const coilTop = mY + S * 0.115, coilH = S * 0.018, coilW = S * 0.06, fy = coilTop + coilH, fw = S * 0.075;
  const bx = cx - S * 0.085, by = mY + S * 0.235, bw = S * 0.17, bh = BH * 0.7, basket = path([[bx, by], [bx + bw, by], [bx + bw * 0.96, by + bh], [bx + bw * 0.04, by + bh]]);
  const label = path([[bx + bw * 0.3, by + bh * 0.2], [bx + bw * 0.7, by + bh * 0.2], [bx + bw * 0.69, by + bh * 0.84], [bx + bw * 0.31, by + bh * 0.84]]);
  // two pilots: a shoulder spline, a head
  const pw = S * 0.045, psh = by - S * 0.05, hr = S * 0.02;
  const pilots = [cx - S * 0.04, cx + S * 0.04].map((px) => ({ px, hy: psh - hr * 0.85, body: path(spline([[px - pw / 2, by + 1], [px - pw * 0.47, psh + S * 0.016], [px - pw * 0.27, psh], [px + pw * 0.27, psh], [px + pw * 0.47, psh + S * 0.016], [px + pw / 2, by + 1]], false, 4)) }));
  const cables = [-1, 1, -0.45, 0.45].map((a) => [cx + S * MOUTH * 0.9 * a, sk, cx + fw * a, fy]);
  const g = s.ctx;
  // paper under everything the envelope and the basket are made of: pale cells are paper, not sky
  g.fillStyle = look.paper; g.fill(env); g.fill(skirt); g.fill(basket); pilots.forEach((q) => { g.fill(q.body); g.beginPath(); g.arc(q.px, q.hy, hr, 0, TAU); g.fill(); });
  g.fillRect(cx - coilW / 2, coilTop, coilW, coilH);
  print(s, {
    sun: (c, ink) => {
      kinds.yellow.forEach((o) => cs(c, tone('sun'), (x, y) => 0.98 * fade(x, y), ink, o));
    },
    sky: (c, ink) => {
      kinds.navy.forEach((o) => cs(c, tone('sky'), () => 0.55, ink, o));
      scr(c, box, P * 0.8, tone('sky'), () => 0.5, ink, label);
    },
    warm: (c, ink) => {
      kinds.coral.forEach((o) => cs(c, tone('warm'), (x, y) => 1.05 * fade(x, y), ink, o));
      kinds.slate.forEach((o) => cs(c, tone('warm'), () => 0.26, ink, o));
      kinds.grey.forEach((o) => cs(c, tone('warm'), () => 0.07, ink, o));
      kinds.yellow.forEach((o) => cs(c, tone('warm'), () => 0.16, ink, o));
      scr(c, box, P, tone('warm'), (x, y) => 0.9 * (1 - 0.3 * clamp((x - cx) / (S * MOUTH) * 0.5 + 0.2)), ink, skirt);   // the mouth's fabric is coral
      c.save(); c.globalAlpha = 0.92; c.fill(pilots[0].body);             // one pilot in a coral jacket
      c.globalAlpha = 0.3; pilots.forEach((q) => { c.beginPath(); c.arc(q.px, q.hy, hr, 0, TAU); c.fill(); }); c.restore();   // faces
    },
    key: (c, ink) => {
      kinds.grey.forEach((o) => cs(c, tone('key'), (x, y) => 0.27 * fade(x, y) + 0.04, ink, o));
      kinds.slate.forEach((o) => cs(c, tone('key'), (x, y) => 0.42 * fade(x, y), ink, o));
      kinds.navy.forEach((o) => cs(c, tone('key'), (x, y) => 0.95 * fade(x, y), ink, o));
      // the round form: shadow away from the light, over every panel, and the right third turned fully away (0 at the centre, 0.22 at the edge)
      const turn = (x, y) => { const hw = S * halfW((y - top) / H); return hw < 0.5 ? 0 : 0.22 * smooth(0.05, 0.6, (x - cx) / hw); };
      scr(c, box, P * 0.9, tone('key') + 30, (x, y) => { const l = lit(x, y); return (l < 0.05 ? Math.pow((0.05 - l) / 1.05, 1.25) * 0.8 : 0) + turn(x, y); }, ink, env);
      scr(c, box, P, tone('key'), (x, y) => 0.14 + 0.1 * clamp((cx - x) / (S * MOUTH)), ink, skirt);
      scr(c, box, P * 0.7, tone('key'), () => 0.12, ink, basket);
      scr(c, box, P * 0.7, tone('key'), () => 0.7, ink, label);
      // seams: the gores' meridians and the rows' load tapes
      for (let j = 1; j < GORES; j++) { const a = -Math.PI / 2 + (j / GORES) * Math.PI, pts = []; for (let k = 0; k <= 30; k++) { const u = k / 30; pts.push([cx + S * halfW(u) * Math.sin(a), top + H * u]); } crayon(c, pts, { w: Math.max(0.6, S / 360), color: ink, seed: 100 + j, alpha: 0.5, wobble: 0.3 }); }
      for (let i = 1; i < ROWS.length - 1; i++) { const u = ROWS[i], hw = S * halfW(u), pts = []; for (let k = 0; k <= 24; k++) { const a = -Math.PI / 2 + (k / 24) * Math.PI; pts.push([cx + hw * Math.sin(a), top + H * u + Math.cos(a) * S * 0.012]); } crayon(c, pts, { w: Math.max(0.6, S / 360), color: ink, seed: 200 + i, alpha: 0.42, wobble: 0.3 }); }
      // the envelope's edge: two open strokes down the sides and a lip at the mouth
      const left = [], right = []; for (let k = 0; k <= 40; k++) { const u = k / 40; left.push([cx - S * halfW(u), top + H * u]); right.push([cx + S * halfW(u), top + H * u]); }
      const ew = Math.max(1.4, S / 140);
      crayon(c, left, { w: ew, color: ink, seed: 300, wobble: 0.6 }); crayon(c, right, { w: ew, color: ink, seed: 301, wobble: 0.6 });
      const lip = []; for (let k = 0; k <= 14; k++) { const t = k / 14; lip.push([cx + (t * 2 - 1) * S * MOUTH, mY + Math.sin(t * Math.PI) * S * 0.01]); }
      crayon(c, lip, { w: Math.max(0.9, S / 220), color: ink, seed: 302, wobble: 0.3 });
      // the coral skirt: two sides, a hem
      crayon(c, [[cx - S * MOUTH, mY], [cx - S * MOUTH * 0.9, sk]], { w: Math.max(0.8, S / 260), color: ink, seed: 305 }); crayon(c, [[cx + S * MOUTH, mY], [cx + S * MOUTH * 0.9, sk]], { w: Math.max(0.8, S / 260), color: ink, seed: 306 });
      const hem = []; for (let k = 0; k <= 10; k++) { const t = k / 10; hem.push([cx + (t * 2 - 1) * S * MOUTH * 0.9, sk + Math.sin(t * Math.PI) * S * 0.006]); } crayon(c, hem, { w: Math.max(0.9, S / 240), color: ink, seed: 307, wobble: 0.3 });
      // cables to the burner frame, the coil, the frame, the pilots, the basket
      if (opts.cables !== false) cables.forEach(([x0, y0, x1, y1], k) => crayon(c, [[x0, y0], [x1, y1]], { w: Math.max(0.7, S / 300), color: ink, seed: 400 + k, wobble: 0.2 }));
      c.save(); c.globalAlpha = 0.92; c.fillRect(cx - coilW / 2, coilTop, coilW, coilH); c.restore();
      for (let k = 1; k < 4; k++) crayon(c, [[cx - coilW / 2 + (coilW * k) / 4, coilTop], [cx - coilW / 2 + (coilW * k) / 4, coilTop + coilH]], { w: Math.max(0.5, S / 500), color: look.paper, seed: 408 + k, alpha: 0.7, wobble: 0.1 });
      crayon(c, [[cx - fw, fy], [cx + fw, fy]], { w: Math.max(1.2, S / 180), color: ink, seed: 410 });
      [-1, 1].forEach((a, k) => crayon(c, [[cx + fw * a, fy], [cx + fw * a * 1.1, by]], { w: Math.max(0.8, S / 280), color: ink, seed: 420 + k }));
      // the pilots: a shoulder line and the head; one wears a cap; the left one points at the burner, the right one holds the rim
      pilots.forEach((q, k) => {
        const ol = [[q.px - pw / 2, by], [q.px - pw * 0.47, psh + S * 0.016], [q.px - pw * 0.27, psh], [q.px + pw * 0.27, psh], [q.px + pw * 0.47, psh + S * 0.016], [q.px + pw / 2, by]];
        crayon(c, spline(ol, false, 3), { w: Math.max(0.7, S / 300), color: ink, seed: 460 + k, wobble: 0.15 });
        const circ = []; for (let a = 0; a <= 16; a++) circ.push([q.px + Math.cos((a / 16) * TAU) * hr, q.hy + Math.sin((a / 16) * TAU) * hr]);
        crayon(c, circ, { w: Math.max(0.7, S / 300), color: ink, seed: 470 + k, wobble: 0.1 });
        if (k === 1) { c.beginPath(); c.arc(q.px, q.hy - hr * 0.1, hr * 1.02, Math.PI * 1.02, TAU * 0.999); c.closePath(); c.fill(); c.fillRect(q.px - hr * 0.2, q.hy - hr * 0.2, hr * 1.5, hr * 0.28); }
        else { c.beginPath(); c.arc(q.px, q.hy - hr * 0.1, hr * 1.04, Math.PI * 1.1, TAU * 0.96); c.lineTo(q.px, q.hy - hr * 0.2); c.closePath(); c.fill(); }   // hair
      });
      crayon(c, [[pilots[0].px - pw * 0.4, psh + S * 0.012], [pilots[0].px - S * 0.05, by - S * 0.008]], { w: Math.max(0.8, S / 260), color: ink, seed: 480 });             // rests on the rim
      crayon(c, [[pilots[0].px + pw * 0.35, psh + S * 0.008], [pilots[0].px + S * 0.028, psh - S * 0.03], [cx - S * 0.004, fy + S * 0.006]], { w: Math.max(0.8, S / 260), color: ink, seed: 481 });   // points at the burner
      crayon(c, [[pilots[1].px + pw * 0.4, psh + S * 0.012], [pilots[1].px + S * 0.05, by - S * 0.008]], { w: Math.max(0.8, S / 260), color: ink, seed: 482 });
      crayon(c, [[pilots[1].px - pw * 0.35, psh + S * 0.012], [pilots[1].px - S * 0.03, by - S * 0.01]], { w: Math.max(0.8, S / 260), color: ink, seed: 483 });
      // the basket: a darker rim, woven lines, a label panel, rope ticks at the corners
      c.save(); c.globalAlpha = 0.9; c.fill(path([[bx - 1, by - 3], [bx + bw + 1, by - 3], [bx + bw + 1, by + 1], [bx - 1, by + 1]])); c.restore();
      for (let k = 1; k < 4; k++) crayon(c, [[bx + bw * 0.02, by + (bh * k) / 4], [bx + bw * 0.98, by + (bh * k) / 4]], { w: Math.max(0.5, S / 450), color: ink, seed: 430 + k, alpha: 0.35, wobble: 0.4 });
      for (let k = 1; k < 7; k++) crayon(c, [[bx + (bw * k) / 7, by], [bx + (bw * k) / 7 - bw * 0.01, by + bh]], { w: Math.max(0.5, S / 520), color: ink, seed: 440 + k, alpha: 0.28, wobble: 0.3 });
      crayon(c, [[bx + bw * 0.3, by + bh * 0.2], [bx + bw * 0.7, by + bh * 0.2], [bx + bw * 0.69, by + bh * 0.84], [bx + bw * 0.31, by + bh * 0.84], [bx + bw * 0.3, by + bh * 0.2]], { w: Math.max(0.6, S / 400), color: ink, seed: 449, wobble: 0.2 });
      crayon(c, [[bx, by], [bx + bw * 0.04, by + bh], [bx + bw * 0.96, by + bh], [bx + bw, by]], { w: Math.max(1, S / 220), color: ink, seed: 450 });
      [[bx, 1], [bx + bw, -1]].forEach(([x, d], k) => { const t = []; for (let a = 0; a <= 8; a++) { const q = (a / 8) * Math.PI; t.push([x + d * Math.sin(q) * S * 0.012, by - Math.cos(q) * S * 0.014 - S * 0.012]); } crayon(c, t, { w: Math.max(0.6, S / 400), color: ink, seed: 455 + k, wobble: 0.1 }); });
    },
  }, { seed, paper: false, reg: Math.max(0.5, S / 260) });
  return { cv: s.cv, w: W, h: total, mouth: [cx, coilTop], basket: [bx, by, bw, bh], env, cx, top, S, H, cut: sk, cables: opts.cables === false ? cables : null, frame: [cx - fw, fy, cx + fw, fy] };
}

// ── a wicker basket, seen a little from above ───────────────────────────────
// For a hopper that balls drop into: two sprites of one size. `back` is the far half (the dark inside and the far lip) and `cv` the
// near half (the woven wall and the rope-wrapped near lip); draw back, then the balls, then cv, and the balls sit in the basket.
// Returns { cv, back, w, h, mouth: { cx, cy, rx, ry } (the opening, in sprite px), wallTop, floor }.
export function bakeBasket(width, dpr = 2, seed = 5) {
  const w = Math.max(40, width), pad = 2, rx = w / 2 - pad, ry = w * 0.085, cx = w / 2, rimY = pad + ry + 1, wallH = w * 0.52, bottomY = rimY + wallH, bw = rx * 0.86, h = Math.ceil(bottomY + ry * 0.9 + pad + 1);
  const front = surface(w, h, dpr), back = surface(w, h, dpr), box = { x0: 0, y0: 0, x1: w, y1: h }, P = Math.max(2.4, w / 55);
  const rimF = (x) => rimY + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));            // the near lip's y at x
  const botF = (x) => bottomY + ry * 0.9 * Math.sqrt(Math.max(0, 1 - ((x - cx) / bw) ** 2));    // the foot's y at x
  const edgeAt = (t, x) => lerp(rimF(x), botF(x), t);
  const wall = new Path2D(); wall.moveTo(cx - rx, rimY); wall.lineTo(cx - bw, bottomY); wall.ellipse(cx, bottomY, bw, ry * 0.9, 0, Math.PI, 0, true); wall.lineTo(cx + rx, rimY); wall.ellipse(cx, rimY, rx, ry, 0, 0, Math.PI, false); wall.closePath();
  const mouth = new Path2D(); mouth.ellipse(cx, rimY, rx, ry, 0, 0, TAU);
  const farLip = new Path2D(); farLip.ellipse(cx, rimY, rx, ry, 0, Math.PI, TAU, false);
  // the far half: paper, the dark inside, the far lip
  back.ctx.fillStyle = look.paper; back.ctx.fill(mouth);
  print(back, {
    sun: (c, ink) => { scr(c, box, P, tone('sun'), () => 0.6, ink, mouth); },
    warm: (c, ink) => { scr(c, box, P, tone('warm'), () => 0.2, ink, mouth); },
    key: (c, ink) => {
      scr(c, box, P * 0.9, tone('key'), (x, y) => 0.55 + 0.3 * clamp((y - (rimY - ry)) / (ry * 2)) * 0, ink, mouth);
      const lip = []; for (let k = 0; k <= 30; k++) { const a = Math.PI + (k / 30) * Math.PI; lip.push([cx + Math.cos(a) * rx, rimY + Math.sin(a) * ry]); }
      crayon(c, lip, { w: Math.max(1.2, w / 90), color: ink, seed: seed + 1, wobble: 0.3 });
    },
  }, { seed, paper: false, reg: Math.max(0.5, w / 260) });
  // the near half: the wall, woven in courses, shaded away from the light, a rope-wrapped lip
  const g = front.ctx; g.fillStyle = look.paper; g.fill(wall);
  const cs = Math.max(5, w * 0.075), courses = 7, cols = Math.max(6, Math.round((rx * 2) / cs));
  print(front, {
    sun: (c, ink) => { scr(c, box, P, tone('sun'), (x, y) => 0.7 - 0.12 * clamp((x - cx) / rx), ink, wall); },
    warm: (c, ink) => { scr(c, box, P, tone('warm'), (x, y) => 0.1 + 0.14 * clamp((y - rimY) / wallH), ink, wall); },
    key: (c, ink) => {
      scr(c, box, P * 0.9, tone('key') + 30, (x, y) => 0.5 * smooth(-0.1, 1, (x - cx) / rx) + 0.12 * clamp((y - rimY) / wallH), ink, wall);
      // the weave: curved courses, and short uprights that swap sides on each course
      for (let j = 1; j < courses; j++) {
        const t = j / courses, pts = []; for (let k = 0; k <= 24; k++) { const x = lerp(cx - lerp(rx, bw, t), cx + lerp(rx, bw, t), k / 24); pts.push([x, edgeAt(t, x)]); }
        crayon(c, pts, { w: Math.max(0.7, w / 220), color: ink, seed: seed + 10 + j, alpha: 0.55, wobble: 0.25 });
      }
      for (let j = 0; j < courses; j++) {
        const t0 = j / courses, t1 = (j + 1) / courses;
        for (let i = 0; i <= cols; i++) {
          const u = -1 + ((i + (j % 2 ? 0.5 : 0)) / cols) * 2; if (Math.abs(u) > 0.97) continue;
          const x0 = cx + u * lerp(rx, bw, t0), x1 = cx + u * lerp(rx, bw, t1);
          crayon(c, [[x0, edgeAt(t0, x0) + 0.5], [x1, edgeAt(t1, x1) - 0.5]], { w: Math.max(0.6, w / 280), color: ink, seed: seed + 40 + j * 31 + i, alpha: 0.4, wobble: 0.2 });
        }
      }
      // the wall's outline and the near lip: a thick rope with its wraps
      const left = [[cx - rx, rimY], [cx - bw, bottomY]], right = [[cx + rx, rimY], [cx + bw, bottomY]], foot = []; for (let k = 0; k <= 30; k++) { const x = lerp(cx - bw, cx + bw, k / 30); foot.push([x, botF(x)]); }
      crayon(c, left, { w: Math.max(1.3, w / 80), color: ink, seed: seed + 2, wobble: 0.4 }); crayon(c, right, { w: Math.max(1.5, w / 75), color: ink, seed: seed + 3, wobble: 0.4 }); crayon(c, foot, { w: Math.max(1.4, w / 80), color: ink, seed: seed + 4, wobble: 0.4 });
      const lipPts = []; for (let k = 0; k <= 40; k++) { const x = lerp(cx - rx, cx + rx, k / 40); lipPts.push([x, rimF(x)]); }
      crayon(c, lipPts, { w: Math.max(2.2, w / 40), color: ink, seed: seed + 5, wobble: 0.3, alpha: 0.9 });
      for (let k = 1; k < 24; k++) { const x = lerp(cx - rx, cx + rx, k / 24), y = rimF(x), tw = Math.max(1.6, w / 48); crayon(c, [[x - tw * 0.4, y + tw * 0.55], [x + tw * 0.4, y - tw * 0.55]], { w: Math.max(0.6, w / 300), color: look.paper, seed: seed + 60 + k, alpha: 0.75, wobble: 0.1 }); }
    },
  }, { seed: seed + 1, paper: false, reg: Math.max(0.5, w / 260) });
  return { cv: front.cv, back: back.cv, w, h, mouth: { cx, cy: rimY, rx, ry }, wallTop: rimY, floor: bottomY };
}

// The burner's flame, live: a narrow ragged plume of paper, sun and coral over the dark fabric, `k` 0..1 how hard
// it burns. The tip leans on a slow sine; two small licks at the foot flicker at about 7 Hz and 11 Hz.
export function flame(ctx, x, y, size, k, t) {
  if (k <= 0.02) return;
  const h = size * (0.9 + 2.6 * k) * 1.3 * (0.92 + 0.1 * Math.sin(t * 31) + 0.06 * Math.sin(t * 17.3)), w = size * (0.42 + 0.3 * k) * 0.5;
  const lean = Math.sin(t * 1.7) * w * 1.1 + Math.sin(t * 5.3) * w * 0.25;
  const tongue = (sx, sy, col) => {
    const tipX = x + lean * sy + Math.sin(t * 19) * w * 0.3;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * sx, y);
    ctx.bezierCurveTo(x - w * sx * 1.25, y - h * 0.45 * sy, x - w * 0.1 + lean * 0.5 * sy + Math.sin(t * 23) * w * 0.2, y - h * 0.8 * sy, tipX, y - h * sy);
    ctx.bezierCurveTo(x + w * 0.1 + lean * 0.5 * sy, y - h * 0.7 * sy, x + w * sx * 1.25, y - h * 0.4 * sy, x + w * sx, y);
    ctx.closePath(); ctx.fill();
  };
  // a ragged side lick: a thin curl that leans away from the plume, its height pulsing at `hz`
  const lick = (side, hz, ph, col, tall) => {
    const q = 0.5 + 0.5 * Math.sin(t * TAU * hz + ph), lh = h * tall * (0.55 + 0.45 * q), bx = x + side * w * 0.9, tx = bx + side * w * (0.9 + 1.1 * q) + lean * 0.3;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx - w * 0.55, y); ctx.quadraticCurveTo(bx - side * w * 0.1, y - lh * 0.55, tx, y - lh);
    ctx.quadraticCurveTo(bx + side * w * 0.9, y - lh * 0.4, bx + w * 0.55, y); ctx.closePath(); ctx.fill();
  };
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  lick(-1, 7, 0, look.paper, 0.4); lick(1, 11, 1.7, look.paper, 0.34);
  tongue(1.35, 1.12, look.paper);
  lick(-1, 7, 0, inkOf('sun'), 0.34); lick(1, 11, 1.7, inkOf('sun'), 0.28);
  tongue(1, 1, inkOf('sun')); tongue(0.62, 0.74, inkOf('warm')); tongue(0.28, 0.45, look.paper);
  ctx.restore();
}

// ── a golf ball ──────────────────────────────────────────────────────────────
// The whitest thing on the lawn: paper, a thin sky crescent on the shadow side (not on a small ball), a key rim, a
// paper highlight, dimples that grow with the ball.
const ballCache = new Map();
export function ballSprite(r, dpr = 2) {
  const key = look.name + ':' + r.toFixed(1) + ':' + dpr; if (ballCache.has(key)) return ballCache.get(key);
  const pad = 2, s = surface(r * 2 + pad * 2, r * 2 + pad * 2, dpr), c = s.ctx, x = r + pad, y = r + pad;
  c.fillStyle = look.paper; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); c.globalCompositeOperation = 'multiply';
  // the shadow side: ball minus a circle toward the light, and a thinner crescent at the edge
  const small = r < 4.2;      // a small ball is a white dot: no sky crescent, a lighter rim, a bigger highlight
  if (!small) { c.fillStyle = inkOf('sky'); c.globalAlpha = 0.1; c.beginPath(); c.arc(x, y, r * 1.02, 0, TAU); c.moveTo(x - r * 0.36 + r * 0.9, y - r * 0.42); c.arc(x - r * 0.36, y - r * 0.42, r * 0.9, 0, TAU); c.fill('evenodd'); }
  c.fillStyle = inkOf('key'); c.globalAlpha = 0.12; c.beginPath(); c.arc(x, y, r * 1.02, 0, TAU); c.moveTo(x - r * 0.12 + r * 1.0, y - r * 0.14); c.arc(x - r * 0.12, y - r * 0.14, r * 1.0, 0, TAU); c.fill('evenodd');
  if (r > 3) {
    const dots = [];
    if (r < 7) { for (let k = 0; k < 5; k++) { const a = -0.2 + k * 0.55, d = r * (0.5 + (k % 2) * 0.16); dots.push([Math.cos(a) * d * 0.9 + r * 0.12, Math.sin(a) * d * 0.9 + r * 0.14 + (k % 2 ? r * 0.06 : 0), 0.35]); } }
    else { for (let ry = -2; ry <= 2; ry++) for (let rx = -2; rx <= 2; rx++) { const px = (rx + (ry & 1 ? 0.5 : 0)) * r * 0.38, py = ry * r * 0.33; if (Math.hypot(px, py) > r * 0.74 || dots.length >= 12) continue; dots.push([px, py, px * LX + py * LY > 0 ? 0.15 : 0.3]); } }
    dots.forEach(([dx, dy, a]) => { c.globalAlpha = a; c.beginPath(); c.arc(x + dx, y + dy, Math.max(0.4, r * 0.07), 0, TAU); c.fill(); });
  }
  c.restore();
  c.strokeStyle = inkOf('key'); c.lineWidth = Math.max(0.7, r / 6); c.globalAlpha = small ? 0.35 : 0.5; c.beginPath(); c.arc(x + 0.2, y + 0.15, r - c.lineWidth / 2, 0.15, TAU + 0.05); c.stroke();
  c.globalAlpha = 1; c.fillStyle = look.paper; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, small ? r * 0.34 : r * 0.28, small ? r * 0.22 : r * 0.18, -0.6, 0, TAU); c.fill();
  const out = { cv: s.cv, size: r * 2 + pad * 2, r };
  ballCache.set(key, out); return out;
}
export function clearCaches() { ballCache.clear(); tintCache.clear(); }

// ── a cloud ──────────────────────────────────────────────────────────────────
// A cloud as its own sprite so it can drift: paper, with the sky ink's dots gathering under it.
export function bakeCloud(rx, seed = 1, dpr = 2) {
  const r = rng(seed * 7 + 3), ry = rx * 0.3, w = Math.ceil(rx * 2.5), h = Math.ceil(ry * 4.2), s = surface(w, h, dpr), c = s.ctx, cx = w / 2, cy = h * 0.5;
  const p = new Path2D(), n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, bump = Math.sin(t * Math.PI), q = (0.34 + 0.46 * bump) * (0.8 + r() * 0.4);
    p.addPath(path(blob(cx + (t - 0.5) * rx * 1.7 + (r() - 0.5) * rx * 0.14, cy - bump * ry * (0.2 + r() * 0.5) - ry * 0.1, rx * q, ry * q * 1.7, seed * 10 + i, 0.12)));
  }
  p.addPath(path(blob(cx, cy + ry * 0.35, rx * (0.8 + r() * 0.15), ry * 0.5, seed * 10 + 9, 0.08)));
  c.fillStyle = look.paper; c.fill(p);
  const box = { x0: 0, y0: 0, x1: w, y1: h }, Pc = clamp(rx * 0.04, 2.6, 4.4);
  c.save(); c.clip(p);
  screen(c, box, Pc, tone('sky') + 20, (x, y) => clamp((y - (cy - ry * 0.3)) / (ry * 1.4)) * 0.3, inkOf('sky'));
  c.restore();
  return { cv: s.cv, w, h, rx };
}

// ── people seen from behind, watching ────────────────────────────────────────
// Eight people, each drawn once into a small sprite (two when the arms go up), the head apart so
// it can turn to the balloon. Heads are 0.8u in radius on a body 9.65u tall; u = height / 10.
// Light comes from the upper left, so a contact shadow falls right and down.
const ARCH = [
  { top: () => tint(['sun', 0.5], ['warm', 0.2], ['key', 0.12]), alt: () => tint(['key', 0.32]), bot: 'long', botCol: () => tint(['sky', 0.8], ['key', 0.3]), shoe: 'dark', sleeve: 'long' },                      // 0 tan hoodie, hood up, hands in pockets, jeans
  { top: () => look.paper, alt: () => tint(['sky', 0.16]), bot: 'skirt', botCol: () => tint(['sun', 0.3], ['warm', 0.15]), shoe: 'pale', sleeve: 'short' },                                              // 1 long dark hair, white top, beige long skirt, shoulder bag
  { top: () => tint(['sky', 0.36]), alt: () => tint(['sun', 0.3]), bot: 'long', botCol: () => tint(['sun', 0.55], ['warm', 0.1], ['key', 0.16]), shoe: 'dark', sleeve: 'short' },                       // 2 straw hat, light blue shirt, khakis, one arm waving
  { top: () => tint(['sun', 0.22], ['sky', 0.1]), alt: () => tint(['sky', 0.22], ['sun', 0.1]), bot: 'shorts', botCol: () => tint(['key', 0.34]), shoe: 'pale', sleeve: 'short', dots: true },           // 3 patterned shirt, grey shorts, bare calves, grey hair
  { top: () => tint(['warm', 0.95]), alt: () => tint(['sky', 0.9]), bot: 'shorts', botCol: () => tint(['key', 0.6], ['sky', 0.3]), shoe: 'white', sleeve: 'short' },                                       // 4 child in a red tee and white sneakers
  { top: () => tint(['sky', 0.5], ['sun', 0.35]), alt: () => tint(['warm', 0.5], ['sun', 0.2]), bot: 'long', botCol: () => tint(['key', 0.45]), shoe: 'dark', sleeve: 'short' },                           // 5 backpack
  { top: () => tint(['warm', 0.5], ['sun', 0.25]), alt: () => tint(['sky', 0.45]), bot: 'long', botCol: () => tint(['key', 0.82]), shoe: 'pale', sleeve: 'long' },                                        // 6 both arms up with a phone
  { top: () => tint(['key', 0.4]), alt: () => tint(['key', 0.4]), bot: 'long', botCol: () => tint(['key', 0.85]), shoe: 'dark', sleeve: 'long', vest: true },                                           // 7 hi-vis crew vest
];

function limb(pts, ws) {      // a tapered arm or leg as a polygon through points, widths in the same units
  const L = [], R = [];
  pts.forEach((pt, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    L.push([pt[0] - dy * ws[i] / 2, pt[1] + dx * ws[i] / 2]); R.push([pt[0] + dy * ws[i] / 2, pt[1] - dx * ws[i] / 2]);
  });
  return L.concat(R.reverse());
}

function figure(c, p, u, pose) {
  const A = ARCH[p.arch], KEY = inkOf('key'), lw = Math.max(0.65, u * 0.115), sd = p.seed || 1;
  const skin = tint(['warm', 0.18 + 0.1 * (p.skinV || 0)], ['sun', 0.16 + 0.04 * (p.skinV || 0)]);
  const topC = p.alt ? A.alt() : A.top(), botC = A.botCol(), shoeC = A.shoe === 'dark' ? tint(['key', 0.95]) : look.paper;
  const poly = (pts) => { const q = new Path2D(); pts.forEach(([x, y], i) => (i ? q.lineTo(x * u, y * u) : q.moveTo(x * u, y * u))); q.closePath(); return q; };
  const fillS = (q, col, a = 0.85) => { c.fillStyle = col; c.fill(q); c.save(); c.translate(0.45, 0.3); c.strokeStyle = KEY; c.lineWidth = lw; c.lineJoin = 'round'; c.globalAlpha = a; c.stroke(q); c.restore(); };
  const ln = (pts, a = 0.5, w = lw, k = 0) => crayon(c, pts.map(([x, y]) => [x * u, y * u]), { w, color: KEY, seed: sd + k, alpha: a, wobble: 0.18 });
  const ell = (x, y, rx, ry, rot = 0) => { const q = new Path2D(); q.ellipse(x * u, y * u, rx * u, ry * u, rot, 0, TAU); return q; };
  c.save(); c.scale(p.build || 1, 1);
  // legs: a 0.3u gap of lawn between them
  const legL = [[-1.3, -4.35], [-1.24, -2.4], [-1.08, -0.45], [-0.22, -0.45], [-0.2, -2.4], [-0.14, -4.35]], legR = legL.map(([x, y]) => [-x, y]);
  if (A.bot === 'long') { fillS(poly(legL), botC); fillS(poly(legR), botC); ln([[-1.2, -2.4], [-0.3, -2.4]], 0.3, lw * 0.8, 1); ln([[0.3, -2.4], [1.2, -2.4]], 0.3, lw * 0.8, 2); }
  else if (A.bot === 'shorts') {
    fillS(poly(legL), skin); fillS(poly(legR), skin);
    const sL = [[-1.32, -4.35], [-1.3, -2.85], [-0.2, -2.85], [-0.14, -4.35]]; fillS(poly(sL), botC); fillS(poly(sL.map(([x, y]) => [-x, y])), botC);
    ln([[-1.2, -1.2], [-0.4, -1.2]], 0.22, lw * 0.7, 3); ln([[0.4, -1.2], [1.2, -1.2]], 0.22, lw * 0.7, 4);
  } else {
    fillS(poly([[-1.15, -1.6], [-1.08, -0.45], [-0.22, -0.45], [-0.25, -1.6]]), skin); fillS(poly([[1.15, -1.6], [1.08, -0.45], [0.22, -0.45], [0.25, -1.6]]), skin);
  }
  // shoes: key ellipses 1.1u by 0.45u with a paper heel highlight
  [-0.65, 0.65].forEach((x) => { fillS(ell(x, -0.22, 0.55, 0.23), shoeC); c.save(); c.globalAlpha = 0.75; c.fillStyle = look.paper; c.fill(ell(x - 0.14, -0.3, 0.18, 0.07, -0.2)); c.restore(); });
  if (A.bot === 'skirt') {
    fillS(poly([[-1.42, -4.95], [-1.62, -3.2], [-1.85, -1.5], [1.85, -1.5], [1.62, -3.2], [1.42, -4.95]]), botC);
    ln([[-0.7, -4.7], [-1.0, -1.7]], 0.4, lw, 5); ln([[0.1, -4.7], [0.15, -1.65]], 0.4, lw, 6); ln([[0.85, -4.7], [1.2, -1.7]], 0.4, lw, 7);
    ln([[-1.8, -1.75], [-0.9, -1.62], [0, -1.7], [0.9, -1.62], [1.8, -1.75]], 0.5, lw, 8);
  }
  // torso with a sloped yoke from the neck to shoulder tips at +-1.72u
  const torso = new Path2D(); torso.moveTo(-1.5 * u, -4.25 * u); torso.lineTo(-1.38 * u, -5.0 * u); torso.quadraticCurveTo(-1.66 * u, -6.2 * u, -1.72 * u, -7.45 * u); torso.quadraticCurveTo(-1.2 * u, -7.74 * u, -0.42 * u, -7.88 * u); torso.lineTo(0.42 * u, -7.88 * u);
  torso.quadraticCurveTo(1.2 * u, -7.74 * u, 1.72 * u, -7.45 * u); torso.quadraticCurveTo(1.66 * u, -6.2 * u, 1.38 * u, -5.0 * u); torso.lineTo(1.5 * u, -4.25 * u); torso.closePath();
  fillS(torso, A.vest ? tint(['key', 0.4]) : topC);
  if (A.dots) { c.save(); c.clip(torso); c.fillStyle = tint(['warm', 0.9]); for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 5; rx++) { c.beginPath(); c.arc(((rx - 2 + (ry & 1 ? 0.5 : 0)) * 0.95) * u, (-7.2 + ry * 0.7) * u, 0.24 * u, 0, TAU); c.fill(); } c.restore(); }
  if (A.vest) {
    fillS(poly([[-1.46, -7.6], [-0.5, -7.82], [0.5, -7.82], [1.46, -7.6], [1.52, -4.45], [-1.52, -4.45]]), tint(['warm', 0.88], ['sun', 0.6]));
    c.fillStyle = look.paper; c.fillRect(-1.5 * u, -6.5 * u, 3.0 * u, 0.3 * u); c.fillRect(-1.5 * u, -5.5 * u, 3.0 * u, 0.3 * u);
    ln([[0, -7.8], [0, -4.5]], 0.4, lw, 9);
  }
  if (p.arch === 5) {     // backpack: a key rectangle with strap lines and a zip
    fillS(poly([[-1.28, -7.15], [-1.1, -7.3], [1.1, -7.3], [1.28, -7.15], [1.3, -4.15], [-1.3, -4.15]]), tint(['key', 0.88]));
    c.save(); c.globalAlpha = 0.7; c.fillStyle = look.paper; c.fillRect(-0.12 * u, -7.0 * u, 0.24 * u, 2.5 * u); c.restore();
    c.save(); c.strokeStyle = look.paper; c.globalAlpha = 0.55; c.lineWidth = lw; c.beginPath(); c.moveTo(-1.2 * u, -6.0 * u); c.lineTo(-0.2 * u, -6.0 * u); c.moveTo(1.2 * u, -6.0 * u); c.lineTo(0.2 * u, -6.0 * u); c.stroke(); c.restore();
    ln([[-0.95, -7.3], [-1.45, -7.75]], 0.8, lw * 1.2, 10); ln([[0.95, -7.3], [1.45, -7.75]], 0.8, lw * 1.2, 11);
  }
  if (p.arch === 1) {     // shoulder bag: a strap across the back and a bag at the hip
    ln([[1.45, -7.7], [0.2, -6.0], [-1.55, -4.6]], 0.9, lw * 1.5, 12);
    fillS(poly([[-2.05, -5.0], [-0.9, -5.0], [-0.85, -3.7], [-2.1, -3.7]]), tint(['sky', 0.55], ['key', 0.3]));
    ln([[-2.05, -4.75], [-0.9, -4.75]], 0.6, lw * 0.9, 13);
  }
  if (p.arch === 0) {     // ribbed hem of the hoodie and jeans pockets
    ln([[-1.5, -4.62], [1.5, -4.62]], 0.55, lw, 14);
    ln([[-1.0, -4.1], [-0.55, -3.7], [-0.2, -4.1]], 0.4, lw * 0.8, 15); ln([[1.0, -4.1], [0.55, -3.7], [0.2, -4.1]], 0.4, lw * 0.8, 16);
  } else if (!A.vest) ln([[-1.46, -4.78], [0, -4.7], [1.46, -4.78]], 0.5, lw, 14);   // waistband
  ln([[-0.52, -7.84], [0, -7.52], [0.52, -7.84]], 0.5, lw, 17);                         // collar
  // neck
  c.fillStyle = skin; c.fillRect(-0.36 * u, -8.35 * u, 0.72 * u, 0.62 * u); ln([[-0.36, -8.3], [-0.38, -7.8]], 0.5, lw * 0.8, 18); ln([[0.36, -8.3], [0.38, -7.8]], 0.5, lw * 0.8, 19);
  // arms: upper arm and forearm drawn separately with an elbow bend
  const sleeveC = A.vest ? tint(['key', 0.4]) : topC, longS = A.sleeve === 'long', hand = (x, y, rx = 0.27, ry = 0.36) => fillS(ell(x, y, rx, ry), skin, 0.8);
  const thick = (a, b, wd, col) => {      // a limb segment: key outline under, the cloth over, round at both ends
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.save(); c.translate(0.45, 0.3); c.globalAlpha = 0.85; c.strokeStyle = KEY; c.lineWidth = wd * u + lw * 2; c.beginPath(); c.moveTo(a[0] * u, a[1] * u); c.lineTo(b[0] * u, b[1] * u); c.stroke(); c.restore();
    return () => { c.strokeStyle = col; c.lineWidth = wd * u; c.beginPath(); c.moveTo(a[0] * u, a[1] * u); c.lineTo(b[0] * u, b[1] * u); c.stroke(); };
  };
  const arm = (s, P3, up, phone) => {
    const [a, b, d] = P3.map(([x, y]) => [x * s, y]);
    const paintFore = thick(b, d, 0.58, longS ? sleeveC : skin), paintUpper = thick(a, b, 0.74, sleeveC);
    paintFore(); paintUpper();
    const hx = d[0], hy = d[1];
    ln([[b[0] - 0.32, b[1] + 0.12], [b[0] + 0.32, b[1] + 0.18]], 0.5, lw, 20 + s);        // sleeve hem
    if (up) {
      hand(hx, hy - 0.2, 0.3, 0.36);
      for (let k = 0; k < 4; k++) { const ang = -Math.PI / 2 + (k - 1.5) * 0.3 + (s < 0 ? 0.1 : -0.1); ln([[hx + Math.cos(ang) * 0.2, hy - 0.4 + Math.sin(ang) * 0.2], [hx + Math.cos(ang) * 0.68, hy - 0.4 + Math.sin(ang) * 0.68]], 0.85, lw * 0.85, 30 + k + s); }
    } else if (!phone) hand(hx, hy + 0.18);
  };
  const hang = [[1.72, -7.38], [2.12, -5.95], [1.98, -4.62]], pocket = [[1.72, -7.38], [2.12, -6.0], [1.5, -4.85]], raised = [[1.72, -7.38], [2.55, -8.9], [2.42, -10.45]], hold = [[1.72, -7.38], [2.6, -8.8], [0.95, -10.0]];
  const allUp = pose === 'up';
  if (p.arch === 0 && !allUp) { arm(-1, pocket, false); arm(1, pocket, false); }
  else if (p.arch === 6 || pose === 'phone') { arm(-1, hold, false, true); arm(1, hold, false, true); hand(-0.78, -10.1); hand(0.78, -10.1); fillS(poly([[-0.5, -11.5], [0.5, -11.5], [0.5, -9.8], [-0.5, -9.8]]), tint(['key', 0.92])); c.fillStyle = look.paper; c.beginPath(); c.arc(-0.2 * u, -11.15 * u, 0.12 * u, 0, TAU); c.fill(); }
  else if (allUp) { arm(-1, raised, true); arm(1, raised, true); }
  else if (p.arch === 2) { arm(-1, hang, false); arm(1, raised, true); }
  else { arm(-1, hang, false); arm(1, hang, false); }
  c.restore();
}

function head(c, p, u) {
  const A = p.arch, KEY = inkOf('key'), lw = Math.max(0.65, u * 0.115), sd = (p.seed || 1) + 400;
  const skin = tint(['warm', 0.18 + 0.1 * (p.skinV || 0)], ['sun', 0.16 + 0.04 * (p.skinV || 0)]);
  const hair = [tint(['key', 0.92]), tint(['key', 0.55], ['warm', 0.3]), tint(['key', 0.9])][p.hairV || 0], grey = tint(['key', 0.22]);
  const fillS = (q, col, a = 0.85) => { c.fillStyle = col; c.fill(q); c.save(); c.translate(0.4, 0.3); c.strokeStyle = KEY; c.lineWidth = lw; c.lineJoin = 'round'; c.globalAlpha = a; c.stroke(q); c.restore(); };
  const ell = (x, y, rx, ry, rot = 0, a0 = 0, a1 = TAU) => { const q = new Path2D(); q.ellipse(x * u, y * u, rx * u, ry * u, rot, a0, a1); return q; };
  const ln = (pts, a = 0.5, w = lw, k = 0) => crayon(c, pts.map(([x, y]) => [x * u, y * u]), { w, color: KEY, seed: sd + k, alpha: a, wobble: 0.15 });
  const poly = (pts) => { const q = new Path2D(); pts.forEach(([x, y], i) => (i ? q.lineTo(x * u, y * u) : q.moveTo(x * u, y * u))); q.closePath(); return q; };
  const ears = () => { fillS(ell(-0.8, 0.12, 0.15, 0.22), skin, 0.6); fillS(ell(0.8, 0.12, 0.15, 0.22), skin, 0.6); };
  if (A === 0) {   // hood up: a cowl round the head, bunched on the shoulders, a seam down the back
    const cowl = new Path2D(); cowl.moveTo(-1.25 * u, 0.2 * u); cowl.bezierCurveTo(-1.4 * u, -1.5 * u, 1.4 * u, -1.5 * u, 1.25 * u, 0.2 * u); cowl.bezierCurveTo(1.7 * u, 0.7 * u, 1.55 * u, 1.3 * u, 0.9 * u, 1.45 * u); cowl.quadraticCurveTo(0, 1.8 * u, -0.9 * u, 1.45 * u); cowl.bezierCurveTo(-1.55 * u, 1.3 * u, -1.7 * u, 0.7 * u, -1.25 * u, 0.2 * u); cowl.closePath();
    fillS(cowl, p.alt ? ARCH[0].alt() : ARCH[0].top()); ln([[0, -1.2], [0.04, 0.2], [0, 1.2]], 0.55, lw, 1); ln([[-1.2, 0.35], [-0.5, 0.75], [0, 0.8], [0.5, 0.75], [1.2, 0.35]], 0.45, lw, 2);
    return;
  }
  ears();
  if (A === 1) {   // long dark hair down the back
    const d = new Path2D(); d.moveTo(-0.84 * u, -0.1 * u); d.lineTo(-0.98 * u, 1.3 * u); d.quadraticCurveTo(-0.9 * u, 2.2 * u, 0, 2.15 * u); d.quadraticCurveTo(0.9 * u, 2.2 * u, 0.98 * u, 1.3 * u); d.lineTo(0.84 * u, -0.1 * u); d.closePath();
    fillS(d, tint(['key', 0.92])); fillS(ell(0, 0, 0.84, 0.82), tint(['key', 0.92]));
    ln([[-0.4, 0.2], [-0.5, 1.2], [-0.35, 2.0]], 0.35, lw * 0.9, 1); ln([[0.4, 0.2], [0.5, 1.1], [0.38, 2.0]], 0.35, lw * 0.9, 2);
    c.save(); c.globalAlpha = 0.5; c.fillStyle = tint(['key', 0.5], ['warm', 0.2]); c.fill(ell(-0.28, -0.4, 0.26, 0.14, -0.5)); c.restore();
    return;
  }
  const hc = A === 3 ? grey : hair;
  if (A === 6) { const bob = new Path2D(); bob.moveTo(-0.86 * u, -0.2 * u); bob.lineTo(-0.92 * u, 0.7 * u); bob.quadraticCurveTo(0, 1.0 * u, 0.92 * u, 0.7 * u); bob.lineTo(0.86 * u, -0.2 * u); bob.closePath(); fillS(bob, hc); }
  fillS(ell(0, 0, 0.82, 0.8), hc);
  ln([[-0.45, -0.3], [-0.1, -0.5], [0.4, -0.35]], 0.35, lw * 0.9, 3);
  if (A === 2) {   // straw hat
    fillS(ell(0, -0.55, 1.95, 0.44), tint(['sun', 0.6], ['warm', 0.16]));
    const crown = new Path2D(); crown.ellipse(0, -0.62 * u, 1.02 * u, 0.74 * u, 0, Math.PI, TAU); crown.closePath(); fillS(crown, tint(['sun', 0.6], ['warm', 0.16]));
    c.save(); c.fillStyle = tint(['key', 0.6]); c.fillRect(-1.02 * u, -0.78 * u, 2.04 * u, 0.22 * u); c.restore();
    for (let k = 0; k < 9; k++) { const a = (k / 8) * Math.PI * 0.9 + 0.05; ln([[Math.cos(a) * 1.35, -0.45 + Math.sin(a) * 0.3], [Math.cos(a) * 1.85, -0.45 + Math.sin(a) * 0.42]], 0.3, lw * 0.7, 10 + k); }
  } else if (A === 4) {   // ponytail with a tie
    fillS(ell(0.52, -0.12, 0.3, 0.55, -0.35), hair); c.fillStyle = tint(['warm', 0.95]); c.beginPath(); c.arc(0.46 * u, -0.5 * u, 0.15 * u, 0, TAU); c.fill();
  } else if (A === 5) {   // a cap: dome, button, the strap at the back
    const cap = new Path2D(); cap.ellipse(0, -0.12 * u, 0.9 * u, 0.78 * u, 0, Math.PI, TAU); cap.closePath(); fillS(cap, tint(['key', 0.78]));
    c.fillStyle = look.paper; c.globalAlpha = 0.7; c.fillRect(-0.28 * u, 0.0 * u, 0.56 * u, 0.15 * u); c.globalAlpha = 1; ln([[0, -0.9], [0, -0.1]], 0.4, lw, 11);
  } else if (A === 7) {   // hard hat in sun, a rear lip
    fillS(ell(0, -0.1, 1.0, 0.3), tint(['sun', 0.95])); const hat = new Path2D(); hat.ellipse(0, -0.2 * u, 0.9 * u, 0.82 * u, 0, Math.PI, TAU); hat.closePath(); fillS(hat, tint(['sun', 0.95]));
    ln([[0, -1.0], [0, -0.2]], 0.45, lw, 12);
  } else if (A === 3) { ln([[-0.62, 0.3], [-0.3, 0.52], [0.3, 0.52], [0.62, 0.3]], 0.35, lw * 0.9, 13); }
}

const figCache = new WeakMap();
function sprites(p, k) {
  const tag = look.name + look.paper + ':' + k; let sp = figCache.get(p);
  if (!sp || sp.tag !== tag) { sp = { tag }; figCache.set(p, sp); }
  return sp;
}
function bodySprite(p, pose, k) {
  const sp = sprites(p, k); if (sp[pose]) return sp[pose];
  const u = p.h / 10, w = 10 * u, h = 14 * u, ox = w / 2, oy = 12.6 * u, s = surface(w, h, k), c = s.ctx; c.translate(ox, oy);
  figure(c, p, u, pose);
  // the key drum's shade: a halftone gathering on the side away from the light
  c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.5;
  screen(c, { x0: -5 * u, y0: -12.6 * u, x1: 5 * u, y1: 1.4 * u }, Math.max(1.4, u * 0.27), 45, (x, y) => 0.55 * smooth(0.2 * u, 2.3 * u, x) * (0.7 + 0.3 * smooth(-10 * u, -3 * u, y)), inkOf('key'));
  c.restore();
  return (sp[pose] = { cv: s.cv, ox, oy, w, h });
}
function headSprite(p, k) {
  const sp = sprites(p, k); if (sp.head) return sp.head;
  const u = (p.h / 10) * (p.arch === 4 ? 1.28 : 1), w = 8 * u, h = 6.4 * u, ox = w / 2, oy = 3.6 * u, s = surface(w, h, k), c = s.ctx; c.translate(ox, oy);
  head(c, p, u); return (sp.head = { cv: s.cv, ox, oy, w, h, u });
}

// One person. p: x, base (the feet's y), h, arch (0..7), flip, hop (start in ms, or -1), ph; the
// caller may set gaze (-1..1 toward the balloon), tilt (0..1 how high they look), phoneUntil and still.
export function person(ctx, p, now) {
  const k = ctx.getTransform().a || 1, u = p.h / 10, still = p.still || !now;
  const sw = still ? 0 : Math.sin((now / 1000) * TAU * 0.4 + (p.ph || 0)) * 0.5;
  let up = 0, sy = 1, sx = 1, pose = 'rest', air = 0;
  if (p.hop > 0 && now) {
    const t = now - p.hop;
    if (t >= 0 && t < 90) { sy = 1 - 0.1 * Math.sin((t / 90) * Math.PI / 2); }                                               // crouch
    else if (t >= 90 && t < 530) { const q = (t - 90) / 440; air = 4 * q * (1 - q); up = air * p.h * 0.32; pose = 'up'; }     // up, both arms raised
    else if (t >= 530 && t < 700) { const q = Math.sin(((t - 530) / 170) * Math.PI); sy = 1 - 0.09 * q; sx = 1 + 0.07 * q; }   // landing squash
    else if (t >= 700) p.hop = -1;
  }
  if (pose === 'rest' && p.phoneUntil > now) pose = 'phone';
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.17; ctx.fillStyle = inkOf('key');
  ctx.beginPath(); ctx.ellipse(p.x + sw + 0.8 * u, p.base + 0.28 * u, u * 1.9 * (1 - 0.4 * air), u * 0.4 * (1 - 0.4 * air), 0, 0, TAU); ctx.fill(); ctx.restore();
  const sp = bodySprite(p, pose, k);
  ctx.save(); ctx.translate(p.x + sw, p.base - up); ctx.scale(sx * (p.flip ? -1 : 1), sy); ctx.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h); ctx.restore();
  const hs = headSprite(p, k), g = still ? 0 : clamp(p.gaze || 0, -1, 1), tl = still ? 0 : clamp(p.tilt || 0, 0, 1.3);
  ctx.save(); ctx.translate(p.x + sw + g * 0.35 * u * (p.arch === 4 ? 1.2 : 1), p.base - up - 8.85 * u * sy - tl * 0.3 * u); ctx.rotate(g * 0.07 - (pose === 'rest' ? 0 : 0)); ctx.scale(p.flip ? -1 : 1, 1);
  ctx.drawImage(hs.cv, -hs.ox, -hs.oy, hs.w, hs.h); ctx.restore();
}
// A line of people from x0 to x1, two rows (the back row 0.85 scale, a tenth of the height higher),
// each of the eight drawn before any repeats. baseAt(x) is the front row's feet line.
export function crowd(seed, x0, x1, baseAt, h) {
  const r = rng(seed), out = [], deck = [];
  const refill = () => { const d = [0, 1, 2, 3, 4, 5, 6, 7]; for (let i = 7; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } deck.push(...d); };
  for (let x = x0; x < x1; x += h * (0.27 + r() * 0.2)) {
    if (!deck.length) refill();
    const arch = deck.shift(), back = r() < 0.38, sc = back ? 0.85 : 1, kid = arch === 4;
    out.push({ x, base: baseAt(x) - r() * 0.1 * h - (back ? 0.1 * h : 0), h: h * sc * (kid ? 0.62 : 0.9 + r() * 0.2), arch, back, flip: r() < 0.5, hop: -1, ph: r() * TAU, seed: 1 + Math.floor(r() * 90000), hairV: Math.floor(r() * 3), skinV: Math.floor(r() * 3), alt: r() < 0.45, build: 0.94 + r() * 0.14 });
  }
  out.sort((a, b) => a.base - b.base);
  return out;
}

// ── the ground: sky, hills, trees, chedis, the lined lawn, the X ─────────────
// L: { w, h, hy (horizon), x:[x,y] (the X), xs (its half-size), tape: [[x,y],…], tapeW, pitch, reg,
//      chedis, clouds, liveTape (the caller draws the tape; the paper under it is still kept),
//      kapok ('left' | 'right' | none: a foreground trunk), palms (false for none),
//      fullH (the surface is taller than h: plain lawn runs on below h to fullH) }
export function bakeGround(dest, L, seed = 3) {
  const { w, h, hy } = L, r = rng(seed), rv = rng(seed * 13 + 5), P = L.pitch || 5.2, wide = w >= 900, U = clamp(h / 470, 0.85, 1.7), full = Math.max(h, L.fullH || h);
  const box = { x0: 0, y0: 0, x1: w, y1: full };
  const gz = (y) => clamp((y - hy) / (h - hy));       // 0 at the horizon, 1 at the front
  const sc = (y) => 0.25 + 0.95 * gz(y);              // how big things are at that depth
  // far hills, two ranges
  const hill = (base, amp, s) => { const pts = [[-10, h]]; for (let x = -10; x <= w + 10; x += w / 24) pts.push([x, base - amp * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.009 * (1 + s) + s * 3) * Math.cos(x * 0.004 + s)))]); pts.push([w + 10, h]); return path(pts); };
  const far = hill(hy - 4, Math.min(70, h * 0.09), 1), near = hill(hy + 2, Math.min(44, h * 0.055), 2);

  // the tree line: seven or more authored trees from three shapes, a pair of leaning palms
  const palms = []; if (L.palms !== false) [[0.22, 1], [0.8, -1]].forEach(([f, d], k) => palms.push({ x: w * f, y: hy + 4 * U, h: 0.15 * h, d, lean: ((6 + 3 * r()) * Math.PI) / 180, s: k }));
  const holes = [], lobes = [], trunks = [], strands = [], cycle = ['rain', 'mango', 'rain', 'willow', 'rain', 'mango', 'willow', 'rain'];
  const count = clamp(Math.round(w / (wide ? 88 : 52)), 7, 14);
  for (let i = 0; i < count; i++) {
    let x = (w * (i + 0.5 + (r() - 0.5) * 0.55)) / count;
    palms.forEach((pm) => { if (Math.abs(pm.x - x) < 30 * U) x += (x < pm.x ? -1 : 1) * 34 * U; });
    const kind = cycle[(i * 3 + seed) % cycle.length], s = (0.8 + r() * 0.45) * U, base = hy + 2 + r() * 5, sd = Math.floor(r() * 1000);
    const lobe = (cx, cy, rx, ry, k) => { const o = { cx, cy, rx, ry, p: path(blob(cx, cy, rx, ry, sd + k, 0.15, 12)) }; lobes.push(o); return o; };
    // each tree its own trunk: a bare single stem, a fork, or a lean of up to 12 degrees; 0.6 to 1.3 of the height; 1 to 2.5 px thick
    const style = rv(), hk = 0.6 + 0.7 * rv(), tk = () => (1 + 1.5 * rv()) * clamp(U, 1, 1.3), sg = rv() < 0.5 ? -1 : 1;
    if (kind === 'rain') {
      const lean = style > 0.62 ? sg * Math.tan(((7 + 5 * rv()) * Math.PI) / 180) : 0;
      const th = (26 + r() * 10) * s * hk, rx0 = (24 + r() * 20) * s * (0.85 + 0.15 * hk), n = 3 + (r() < 0.5 ? 1 : 0), xc = x + lean * th, cyc = base - th - 7 * s, fork = base - th * (0.3 + 0.25 * rv());
      for (let q = 0; q < n; q++) { const o = q - (n - 1) / 2, rx = rx0 * (1 - 0.14 * Math.abs(o)); lobe(xc + o * rx0 * 0.92, cyc - Math.abs(o) * 2 * s + (r() - 0.5) * 2 * s, rx, rx * 0.5, q); }
      if (style < 0.28) trunks.push({ pts: [[x, base], [x + lean * th * 0.5 + (rv() - 0.5) * 2 * s, base - th * 0.55], [xc + (rv() - 0.5) * 3 * s, base - th + 4 * s]], w: tk() });
      else if (style < 0.62) { const a = (0.14 + 0.3 * rv()) * rx0, b = (0.14 + 0.3 * rv()) * rx0; trunks.push({ pts: [[x - 0.5 * s, base], [x, fork]], w: tk() }, { pts: [[x, fork], [x - a * 0.5, fork - (fork - (base - th)) * 0.55], [x - a, base - th + 4 * s]], w: tk() * 0.8 }, { pts: [[x, fork], [x + b * 0.5, fork - (fork - (base - th)) * 0.5], [x + b, base - th + 4 * s]], w: tk() * 0.8 }); }
      else trunks.push({ pts: [[x, base], [x + lean * th * 0.5, base - th * 0.5], [xc, base - th + 4 * s]], w: tk() }, { pts: [[x + lean * th * 0.55, base - th * 0.55], [xc - sg * rx0 * 0.22, base - th * 0.85]], w: tk() * 0.6 });
      for (let q = 0; q < 6; q++) holes.push({ x: xc + (r() - 0.5) * rx0 * 1.6, y: cyc + (r() - 0.6) * rx0 * 0.4, rx: (2 + r() * 3.2) * s, ry: (1.4 + r() * 2) * s });
    } else if (kind === 'willow') {
      const rx = (22 + r() * 8) * s * (0.85 + 0.15 * hk), ry = (33 + r() * 7) * s * (0.55 + 0.45 * hk), lean = style > 0.7 ? sg * Math.tan((9 * Math.PI) / 180) : 0, cy = base - ry - (3 + 9 * rv()) * s, xc = x + lean * (base - cy); lobe(xc, cy, rx, ry, 0);
      trunks.push({ pts: [[x - 0.8 * s, base], [x + lean * (base - cy) * 0.4, base - (base - cy) * 0.35], [xc + 0.4 * s, cy + ry * 0.4]], w: tk() });
      for (let q = 0; q < 6; q++) { const a = 0.18 * Math.PI + (q / 5) * 0.64 * Math.PI, sx = xc + Math.cos(a) * rx * 0.95, sy = cy + Math.sin(a) * ry * 0.9, len = (14 + r() * 14) * s * (0.6 + 0.4 * hk); strands.push({ pts: [[sx, sy], [sx + (r() - 0.5) * 2 * s, sy + len * 0.5], [sx + (r() - 0.5) * 3 * s, sy + len]], w: Math.max(0.9, 1.1 * s) }); }
      for (let q = 0; q < 5; q++) holes.push({ x: xc + (r() - 0.5) * rx * 1.2, y: cy + (r() - 0.7) * ry * 0.9, rx: (1.8 + r() * 2.6) * s, ry: (1.4 + r() * 2) * s });
    } else {
      const rx = (24 + r() * 10) * s * (0.85 + 0.15 * hk), ry = (30 + r() * 10) * s * (0.55 + 0.45 * hk), lean = style > 0.55 ? sg * Math.tan(((5 + 7 * rv()) * Math.PI) / 180) : 0, cy = base - ry - (4 + 10 * rv()) * s, xc = x + lean * (base - cy); lobe(xc, cy, rx, ry, 0); lobe(xc + rx * 0.35, cy + ry * 0.2, rx * 0.7, ry * 0.7, 1);
      if (style < 0.28) trunks.push({ pts: [[x - 0.8 * s, base], [x + lean * (base - cy) * 0.5, base - (base - cy) * 0.5], [xc + 0.2 * s, cy + ry * 0.5]], w: tk() });
      else trunks.push({ pts: [[x - 0.8 * s, base], [x + lean * (base - cy) * 0.5, base - (base - cy) * 0.5], [xc + 0.2 * s, cy + ry * 0.5]], w: tk() }, { pts: [[xc, cy + ry * 0.15], [xc - sg * rx * 0.3, cy - ry * 0.15]], w: tk() * 0.6 });
      for (let q = 0; q < 6; q++) holes.push({ x: xc + (r() - 0.5) * rx * 1.3, y: cy + (r() - 0.55) * ry * 1.0, rx: (1.8 + r() * 2.8) * s, ry: (1.4 + r() * 2) * s });
    }
  }
  // a kapok trunk in the foreground: the venue's own tree, thorny, leaning in from an edge
  const kapok = (() => {
    if (!L.kapok) return null;
    const left = L.kapok === 'left', bw = wide ? clamp(w * 0.055, 56, 84) : w * 0.085, tw = bw * 0.62, x0 = left ? w * 0.03 : w * 0.965, yb = full + 8, yt = hy - 0.2 * h, lean = (left ? 1 : -1) * Math.tan((8 * Math.PI) / 180) * (yb - yt);
    const edgeL = spline([[x0 - bw / 2, yb], [x0 - bw * 0.52 + lean * 0.4, (yb + yt) / 2], [x0 + lean - tw / 2, yt]], false, 8), edgeR = spline([[x0 + lean + tw / 2, yt], [x0 + bw * 0.5 + lean * 0.5, (yb + yt) / 2 + 8], [x0 + bw / 2, yb]], false, 8);
    const p = path(edgeL.concat(edgeR)), top = [x0 + lean, yt];
    const mid = (t) => lerp(edgeL[Math.min(edgeL.length - 1, Math.round(t * (edgeL.length - 1)))][0], edgeR[Math.min(edgeR.length - 1, Math.round((1 - t) * (edgeR.length - 1)))][0], 0.5);
    return { p, edgeL, edgeR, top, left, bw, tw, x0, yb, yt, mid, lean, cw: wide ? clamp(w * 0.04, 40, 64) : w * 0.08 };
  })();
  // a crown of leaves at the end of it, drawn like any other canopy, and two branches into it
  if (kapok) [[-0.15, -0.35, 1.0, 0.55], [0.7, -0.1, 0.8, 0.5], [-0.85, -0.05, 0.7, 0.45], [0.2, -0.75, 0.7, 0.4], [-0.55, -0.7, 0.55, 0.35]].forEach(([dx, dy, a, b], i) => { const cx = kapok.top[0] + dx * kapok.cw * 1.9, cy = kapok.top[1] + dy * kapok.cw * 1.9, rx = kapok.cw * 1.7 * a, ry = kapok.cw * 1.7 * b; lobes.push({ cx, cy, rx, ry, p: path(blob(cx, cy, rx, ry, 90 + i, 0.2, 10)) }); });
  if (kapok) { const [tx, ty] = kapok.top; trunks.push({ pts: [[tx, ty + 6], [tx - kapok.cw * 0.5, ty - kapok.cw * 0.5], [tx - kapok.cw * 1.2, ty - kapok.cw * 0.7]], w: kapok.cw * 0.16 }, { pts: [[tx, ty + 6], [tx + kapok.cw * 0.4, ty - kapok.cw * 0.6], [tx + kapok.cw * 1.2, ty - kapok.cw * 0.6]], w: kapok.cw * 0.14 }); }
  // keep a hole only where a lobe holds it
  const holeP = holes.filter((q) => lobes.some((o) => ((q.x - o.cx) / o.rx) ** 2 + ((q.y - o.cy) / o.ry) ** 2 < 0.62)).map((q) => ({ ...q, p: path(blob(q.x, q.y, q.rx, q.ry, Math.floor(q.x * 7), 0.2, 8)) }));
  const holeAll = new Path2D(); holeP.forEach((q) => holeAll.addPath(q.p));
  const treeAll = new Path2D(); lobes.forEach((o) => treeAll.addPath(o.p)); treeAll.addPath(path([[-20, hy - 6], [w + 20, hy - 6], [w + 20, hy + 6], [-20, hy + 6]]));
  const treeTop = Math.min(...lobes.map((o) => o.cy - o.ry)) - 2;
  // chedis: whitewashed, a gold finial, standing behind the tree line
  const chedis = (L.chedis || [0.3, 0.34, 0.83]).map((f, k) => { const x = w * f, s = (k === 1 ? 0.72 : 1) * clamp(w * 0.07, 30, 62) * 1.4 * clamp(U, 1, 1.25), b = hy - 0.04 * h; return { x, b, s, p: path([[x - s * 0.42, hy + 3], [x + s * 0.42, hy + 3], [x + s * 0.42, b], [x + s * 0.42, b], [x + s * 0.34, b - s * 0.18], [x + s * 0.26, b - s * 0.24], [x + s * 0.26, b - s * 0.42], [x + s * 0.1, b - s * 0.62], [x + s * 0.03, b - s * 1.25], [x - s * 0.03, b - s * 1.25], [x - s * 0.1, b - s * 0.62], [x - s * 0.26, b - s * 0.42], [x - s * 0.26, b - s * 0.24], [x - s * 0.34, b - s * 0.18], [x - s * 0.42, b]]) }; });
  const chediAll = new Path2D(); chedis.forEach((c) => chediAll.addPath(c.p));
  // the lawn: mown stripes, chalk lines round the X, the X, a ring
  const [X, Y] = L.x, S = L.xs, chalk = [], SQ = 0.36;
  const gridN = 4, gw = S * 3.6, gd = S * 1.3;
  const proj = (u, v) => { const y = Y + v * gd, k = sc(y) / sc(Y); return [X + u * gw * k, y]; };
  for (let k = -gridN / 2; k <= gridN / 2; k++) { chalk.push([proj(k / (gridN / 2), -1), proj(k / (gridN / 2), 1), 1.1]); chalk.push([proj(-1, k / (gridN / 2)), proj(1, k / (gridN / 2)), 1.1]); }
  // the X: arms at about 34 degrees on the lawn, inside the ring, one constant chalk width
  const xw = clamp(S * 0.13, 4.6, 5.6), xa = proj(-0.2, -0.38), xb = proj(0.2, 0.38), xc = proj(0.2, -0.38), xd = proj(-0.2, 0.38);
  const ringR = 1.5 * S, ring = []; for (let k = 0; k <= 48; k++) { const a = (k / 48) * TAU; ring.push([X + Math.cos(a) * ringR, Y + Math.sin(a) * ringR * SQ]); }
  const stripe = (x, y) => (Math.floor((x - X) / (90 * sc(y)) + (y - hy) / 40) % 2 === 0 ? 1 : 0.86);
  const tape = L.tape || [];
  // the tape's stakes: wood, taller than the tape is high (22-28 px on a phone), one at every 4th tape point, the tape tied to the top
  const stakes = tape.filter((_, k) => k % 4 === 0).map(([x, y]) => ({ x, y0: y - 3, y1: y + (22 + 6 * gz(y)) * (wide ? 1.3 : 1), ww: 3.2 * clamp(sc(y), 0.8, 1.2) }));
  const stakeSun = (c) => stakes.forEach((q) => c.fillRect(q.x - q.ww / 2, q.y0, q.ww, q.y1 - q.y0));
  const clouds = (L.clouds || [[0.18, 0.2, 1], [0.62, 0.12, 0.8], [0.9, 0.3, 0.6]]).map(([fx, fy, s0], k) => { const cx = w * fx, cy = hy * fy + 20, rx = Math.min(140, w * 0.16) * s0, ry = rx * 0.32; const p = new Path2D(); [[-0.5, 0.1, 0.55], [0, -0.15, 0.7], [0.5, 0.08, 0.5], [0.15, 0.22, 0.6], [-0.25, 0.25, 0.5]].forEach(([dx, dy, q], i) => p.addPath(path(blob(cx + dx * rx, cy + dy * rx * 0.6, rx * q, ry * q * 1.6, k * 10 + i, 0.12)))); return { p, cx, cy, rx, ry }; });
  const mh = Math.ceil(hy + 8);
  const inCloud = clouds.length ? maskOf(w, mh, (c) => clouds.forEach((q) => c.fill(q.p))) : () => false;
  const inHole = maskOf(w, mh, (c) => c.fill(holeAll)), inChedi = maskOf(w, mh, (c) => c.fill(chediAll));
  const occ = maskOf(w, mh, (c) => { c.fill(far); c.fill(treeAll); c.fill(chediAll); if (kapok) c.fill(kapok.p); c.globalCompositeOperation = 'destination-out'; c.fill(holeAll); });
  const occluded = (x, y) => occ(x, y);
  const litOf = (o) => (x, y) => clamp(1.15 - 1.5 * ((y - (o.cy - o.ry)) / (2 * o.ry)) - 0.25 * ((x - o.cx) / o.rx), 0, 1);
  const inLobeBox = (o) => (x, y) => x > o.cx - o.rx * 1.3 && x < o.cx + o.rx * 1.3 && y > o.cy - o.ry * 1.3 && y < o.cy + o.ry * 1.3;
  const kapokBox = kapok ? (() => { const xs = kapok.edgeL.concat(kapok.edgeR).map((q) => q[0]); return [Math.min(...xs) - kapok.bw * 3, Math.max(...xs) + kapok.bw * 3]; })() : null;
  const kapokB = kapok ? { x0: kapokBox[0], x1: kapokBox[1], y0: kapok.yt - 6, y1: kapok.yb + 6 } : null;
  const lb = (o) => ({ x0: o.cx - o.rx * 1.3, x1: o.cx + o.rx * 1.3, y0: o.cy - o.ry * 1.3, y1: o.cy + o.ry * 1.3 });
  const plates = {
    sun: (c, ink) => {
      scr(c, box, P, tone('sun'), (x, y) => (y < hy && !inCloud(x, y) && !occluded(x, y) ? 0.1 * Math.pow(y / hy, 3) : 0), ink);
      chedis.forEach((ch) => { c.beginPath(); c.arc(ch.x, ch.b - ch.s * 1.27, ch.s * 0.06, 0, TAU); c.fill(); c.fillRect(ch.x - ch.s * 0.025, ch.b - ch.s * 1.34, ch.s * 0.05, ch.s * 0.2); });
      if (kapok) scr(c, box, P * 0.8, tone('sun'), (x, y) => (x > kapokBox[0] && x < kapokBox[1] && x < kapok.mid(clamp((kapok.yb - y) / (kapok.yb - kapok.yt))) ? 0.55 : 0), ink, kapok.p, kapokB);   // sun dots on the lit side
      if (look.leaf) stakeSun(c);
      if (tape.length > 1 && !L.liveTape) { c.lineWidth = Math.max(2.2, L.tapeW || 3); c.lineJoin = 'round'; c.beginPath(); tape.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    },
    sky: (c, ink) => {
      scr(c, box, P, tone('sky'), (x, y) => { if (y >= hy + 3 || inCloud(x, y) || occluded(x, y)) return 0; return (L.skyTone ?? 1) * (0.14 + 0.44 * Math.pow(1 - y / hy, 1.4)); }, ink);
      clouds.forEach((cl) => scr(c, box, P, tone('sky') + 20, (x, y) => (y > cl.cy + cl.ry * 0.2 ? 0.12 : 0), ink, cl.p));
      scr(c, box, P, tone('sky'), (x, y) => (y < hy + 2 ? 0.38 : 0), ink, far);
      chedis.forEach((ch) => scr(c, box, P * 0.8, tone('sky'), (x) => (x > ch.x + ch.s * 0.05 ? 0.16 : 0), ink, ch.p));
    },
    warm: (c, ink) => {
      // (the stakes are the sun drum's now)
    },
    key: (c, ink) => {
      scr(c, box, P, tone('key'), (x, y) => (y < hy + 2 ? 0.1 : 0), ink, far);
      // trees: a crayon trunk, a canopy lit from above-left and dark underneath, a scalloped lower edge
      lobes.forEach((o) => { const lit = litOf(o), ib = inLobeBox(o); scr(c, box, P, tone('key'), (x, y) => (!ib(x, y) || inHole(x, y) || inChedi(x, y) ? 0 : 0.28 * (1 - lit(x, y)) * (1 - lit(x, y)) + 0.03), ink, o.p, lb(o)); });
      trunks.forEach((t, i) => crayon(c, spline(t.pts, false, 5), { w: t.w, color: ink, seed: 900 + i, wobble: 0.4 }));
      strands.forEach((t, i) => crayon(c, spline(t.pts, false, 4), { w: t.w, color: ink, seed: 950 + i, wobble: 0.5, alpha: 0.85 }));
      lobes.forEach((o, i) => { const pts = []; for (let k = 0; k <= 30; k++) { const a = (0.04 + (k / 30) * 0.92) * Math.PI - 0.0, rr = 1 + 0.06 * Math.sin(k * 2.1); pts.push([o.cx + Math.cos(a) * o.rx * rr, o.cy + Math.sin(a) * o.ry * rr]); } crayon(c, pts, { w: 1.1, color: ink, seed: 1000 + i, wobble: 0.5, alpha: 0.85 }); });
      scr(c, box, P, tone('key'), (x, y) => (y > hy && y < hy + 10 ? 0.3 * (1 - (y - hy) / 10) : 0), ink);
      // palms: a leaning trunk ringed like a coconut's, and a burst of feathered fronds
      palms.forEach((pm) => {
        const lean = pm.d * pm.h * Math.tan(pm.lean), top = [pm.x + lean, pm.y - pm.h], tw = Math.max(2.2, 2.4 * U);
        const trunk = spline([[pm.x, pm.y], [pm.x + lean * 0.2, pm.y - pm.h * 0.4], [pm.x + lean * 0.62, pm.y - pm.h * 0.78], top], false, 5);
        crayon(c, trunk, { w: tw, color: ink, seed: 500 + pm.s });
        for (let q = 3; q < trunk.length - 2; q += 3) crayon(c, [[trunk[q][0] - tw * 0.55, trunk[q][1]], [trunk[q][0] + tw * 0.55, trunk[q][1] - 1]], { w: 0.7, color: look.paper, seed: 530 + q, alpha: 0.6, wobble: 0.1 });
        for (let k = 0; k < 9; k++) {
          const th = (0.12 + (k / 8) * 0.76) * Math.PI, dx = Math.cos(th), dy = -Math.sin(th), Lf = pm.h * (0.4 + 0.14 * Math.abs(dx) + 0.05 * ((k * 5) % 3));
          const mid = [top[0] + dx * Lf * 0.55, top[1] + dy * Lf * 0.5], tip = [top[0] + dx * Lf * 0.98, top[1] + dy * Lf * 0.3 + Lf * 0.42 * Math.pow(Math.abs(dx), 1.2)];
          const f = spline([top, mid, tip], false, 7); crayon(c, f, { w: Math.max(1.0, 1.15 * U), color: ink, seed: 520 + k + pm.s * 9 });
          for (let q = 2; q < f.length - 1; q++) {
            const [fx, fy] = f[q], [nx, ny] = f[q + 1], tl = Math.hypot(nx - fx, ny - fy) || 1, tx = (nx - fx) / tl, ty = (ny - fy) / tl, ll = Lf * 0.15 * (1 - (q / f.length) * 0.6);
            [-1, 1].forEach((sd) => crayon(c, [[fx, fy], [fx + (-ty * sd + tx * 0.5) * ll, fy + (tx * sd + ty * 0.5) * ll + ll * 0.3]], { w: 0.65, color: ink, seed: 560 + q + k * 13 + sd, alpha: 0.8, wobble: 0.1 }));
          }
        }
      });
      // chedis: ring contours, a key edge, the finial's stem
      chedis.forEach((ch, k) => {
        crayon(c, spline([[ch.x - ch.s * 0.42, ch.b], [ch.x - ch.s * 0.3, ch.b - ch.s * 0.2], [ch.x - ch.s * 0.26, ch.b - ch.s * 0.42], [ch.x - ch.s * 0.08, ch.b - ch.s * 0.64], [ch.x, ch.b - ch.s * 1.25], [ch.x + ch.s * 0.08, ch.b - ch.s * 0.64], [ch.x + ch.s * 0.26, ch.b - ch.s * 0.42], [ch.x + ch.s * 0.3, ch.b - ch.s * 0.2], [ch.x + ch.s * 0.42, ch.b]], false, 4), { w: 1.1, color: ink, seed: 600 + k, alpha: 0.85 });
        [-1, 1].forEach((sd, q) => crayon(c, [[ch.x + sd * ch.s * 0.42, ch.b], [ch.x + sd * ch.s * 0.42, hy + 3]], { w: 1, color: ink, seed: 630 + k * 2 + q, alpha: 0.6, wobble: 0.3 }));
        [[0.18, 0.34], [0.24, 0.26], [0.42, 0.26]].forEach(([dy, hw], q) => crayon(c, [[ch.x - ch.s * hw, ch.b - ch.s * dy], [ch.x, ch.b - ch.s * dy + ch.s * 0.025], [ch.x + ch.s * hw, ch.b - ch.s * dy]], { w: 0.9, color: ink, seed: 640 + k * 5 + q, alpha: 0.75, wobble: 0.3 }));
      });
      // the tape's black stripes (unless the caller draws it) and its stakes' shadow sides
      if (tape.length > 1 && !L.liveTape) { c.save(); c.lineWidth = Math.max(2.2, L.tapeW || 3); c.setLineDash([5, 5]); c.beginPath(); tape.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.restore(); }
      // the stakes: a key outline, a shaded right side, a knot where the tape is tied, a shadow on the grass
      stakes.forEach((q, k) => {
        const hw = q.ww / 2, ln = (a0, b0, w0, al = 0.9) => crayon(c, [a0, b0], { w: w0, color: ink, seed: 1300 + k, alpha: al, wobble: 0.15 });
        ln([q.x - hw, q.y0], [q.x - hw * 1.05, q.y1], 0.9); ln([q.x + hw, q.y0], [q.x + hw * 1.05, q.y1], 1.1); ln([q.x - hw, q.y0], [q.x + hw, q.y0 + 0.3], 0.9); ln([q.x - hw, q.y1], [q.x + hw, q.y1], 0.9);
        c.save(); c.globalAlpha = 0.5; c.fillRect(q.x + hw * 0.1, q.y0, hw * 0.9, q.y1 - q.y0); c.globalAlpha = 0.28; c.beginPath(); c.ellipse(q.x + hw * 2, q.y1 + 0.8, hw * 2.6, 1.2, 0, 0, TAU); c.fill(); c.restore();
        c.beginPath(); c.arc(q.x, q.y0 + 3, Math.max(1.2, hw * 0.55), 0, TAU); c.fill();
      });
      // the kapok: its photo's trunk is all conical thorns. A light screen under them, darker on the shaded side; thorns 8-14 px in rows that follow the trunk, each with its paper glint
      if (kapok) {
        const frac = (y) => clamp((kapok.yb - y) / (kapok.yb - kapok.yt)), flat = Math.hypot(kapok.yb - kapok.yt, kapok.x0 - kapok.top[0]);
        scr(c, box, P, tone('key'), (x, y) => { if (x < kapokBox[0] || x > kapokBox[1]) return 0; return x > kapok.mid(frac(y)) ? 0.62 : 0.3; }, ink, kapok.p, kapokB);
        const kr = rng(seed + 77), tz = clamp(kapok.bw / 28, 1, 1.5), gap = 11 * tz, rows = Math.max(3, Math.round(flat / gap));
        for (let q = 0; q <= rows; q++) {
          const t = q / rows, y = lerp(kapok.yb, kapok.yt, t), m = kapok.mid(t), half = lerp(kapok.bw, kapok.tw, t) / 2, cnt = Math.max(3, Math.round((half * 2) / (7 * tz)));
          for (let i = 0; i < cnt; i++) {
            const f = -1 + ((i + 0.5 + (q % 2 ? 0.5 : 0)) * 2) / cnt; if (f > 1.05) continue;
            const bx = m + f * half * 0.95 + (kr() - 0.5) * 2, by = y + (kr() - 0.5) * 3, sz = (8 + kr() * 6 * (1 - 0.25 * t)) * tz, ang = -Math.PI / 2 + f * 0.55 + (kr() - 0.5) * 0.35, dx = Math.cos(ang), dy = Math.sin(ang), bwid = sz * 0.52, px = -dy, py = dx;
            c.beginPath(); c.moveTo(bx + px * bwid / 2, by + py * bwid / 2); c.lineTo(bx - px * bwid / 2, by - py * bwid / 2); c.lineTo(bx + dx * sz, by + dy * sz); c.closePath(); c.fill();
            c.save(); c.globalCompositeOperation = 'destination-out'; c.lineCap = 'round'; c.lineWidth = Math.max(0.8, sz * 0.09); c.beginPath(); c.moveTo(bx + dx * sz * 0.2 - px * bwid * 0.14, by + dy * sz * 0.2 - py * bwid * 0.14); c.lineTo(bx + dx * sz * 0.62 - px * bwid * 0.05, by + dy * sz * 0.62 - py * bwid * 0.05); c.stroke(); c.restore();   // a bare-paper glint down each thorn's lit edge
          }
        }
        crayon(c, kapok.edgeL, { w: 1.4, color: ink, seed: 1200, wobble: 0.5 }); crayon(c, kapok.edgeR, { w: 1.6, color: ink, seed: 1201, wobble: 0.5 });
      }
    },
  };
  // the greens: the yellow (or the leaf) laid solid over the lawn; the blue as a screen that carries the mown stripes
  greens(plates, (c, ink, k) => {
    if (ink === 'sun' || ink === 'leaf') {
      c.fillRect(0, hy + 1, w, full - hy);
      if (ink === 'leaf') { c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; screen(c, box, P, 75, (x, y) => (y < hy + 1 || stripe(x, y) > 0.9 ? 0 : 0.2 + 0.1 * gz(y)), '#000'); c.restore(); }
    } else screen(c, box, P * 0.8, 75, (x, y) => (y < hy + 1 ? 0 : (0.44 - 0.24 * gz(y)) * (stripe(x, y) > 0.9 ? 1 : 0.72)), inkOf(ink));
    c.fillStyle = inkOf(ink);
    scr(c, box, P, tone(ink), (x, y) => (y < hy + 3 && inPath(near, x, y) ? 0.5 : 0), inkOf(ink));
    // canopies: lit tops (yellow-green), shaded undersides
    const T = { sun: [0.7, 1], sky: [0.5, 0.18], leaf: [1, 0.5] }[ink];
    lobes.forEach((o) => {
      const lit = litOf(o), ib = inLobeBox(o);
      scr(c, box, P, tone(ink), (x, y) => (!ib(x, y) || inHole(x, y) || inChedi(x, y) ? 0 : lerp(T[0], T[1], lit(x, y))), inkOf(ink), o.p, lb(o));
    });
    // reserved paper: chalk lines, the X, the ring, a halo under the tape
    c.save(); c.globalCompositeOperation = 'destination-out'; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#000';
    chalk.forEach(([a, b, wd]) => { c.lineWidth = wd * sc((a[1] + b[1]) / 2) * 1.5 + 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
    c.lineCap = 'butt'; c.lineWidth = xw + 3; [[xa, xb], [xc, xd]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }); c.lineCap = 'round';
    stakes.forEach((q) => c.fillRect(q.x - q.ww / 2 - 1.3, q.y0 - 1.3, q.ww + 2.6, q.y1 - q.y0 + 2.6));
    if (kapok) c.fill(kapok.p);      // the trunk is bare paper under its own screen, so the thorns read against it
    c.lineWidth = 1.4 * sc(Y) * 1.5 + 1; c.beginPath(); ring.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    if (tape.length > 1) { c.lineWidth = Math.max(2.2, L.tapeW || 3) * 1.4; c.beginPath(); tape.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    c.restore();
    if (ink === 'sun') { c.fillStyle = inkOf('sun'); stakeSun(c); }
  });
  print(dest, plates, { seed, reg: L.reg || 1 });
  // chalk: bare paper, drawn again by a hand with a line marker; the X in two passes
  const c = dest.ctx; c.save();
  chalk.forEach(([a, b, wd], k) => crayon(c, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], { w: wd * sc((a[1] + b[1]) / 2) * 1.3, color: look.paper, seed: 800 + k, alpha: 0.9, wobble: 0.4 }));
  crayon(c, ring, { w: 1.4 * sc(Y) * 1.3, color: look.paper, seed: 790, alpha: 0.9, wobble: 0.5 });
  // the X: one stroke per arm, constant width, butt ends; a key shadow 1.5 px below and to the right gives the chalk its thickness; a grain of key flecks
  const xr = rng(seed + 41);
  [[xa, xb], [xc, xd]].forEach(([a, b]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, bow = (xr() - 0.5) * 1.2, ctl = [(a[0] + b[0]) / 2 + nx * bow, (a[1] + b[1]) / 2 + ny * bow];
    const arm = () => { c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(ctl[0], ctl[1], b[0], b[1]); c.stroke(); };
    c.save(); c.lineCap = 'butt'; c.lineWidth = xw;
    c.save(); c.translate(1.1, 1.5); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.3; c.strokeStyle = look.key; arm(); c.restore();
    c.strokeStyle = look.paper; c.globalAlpha = 0.97; arm();
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.11; c.fillStyle = look.key; c.beginPath();
    for (let q = 0, n = Math.round(len * 0.5); q < n; q++) { const t = xr(), o = (xr() - 0.5) * xw * 0.8, px = lerp(a[0], b[0], t) + nx * o, py = lerp(a[1], b[1], t) + ny * o, rr = 0.3 + xr() * 0.45; c.moveTo(px + rr, py); c.arc(px, py, rr, 0, TAU); }
    c.fill(); c.restore();
  });
  c.restore();
  return { chalk, proj, sc, gz, ring: { rx: ringR, ry: ringR * SQ, squash: SQ } };
}
