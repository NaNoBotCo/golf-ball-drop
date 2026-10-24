// The things drawn on this page, flat (Nan, 2026-10-24: "sophisticated but flat", "sunny days with
// hot air balloons are supposed to be beautiful"). Reference: her photos of the 31 Jan 2026 drop: a
// checkered balloon in coral, pale grey and slate with a few yellow cells and long gores below the
// waist; a lined lawn with a chalk X; tape on stakes; a crowd from behind; trees and white chedis.
// Solid fills, no outlines, one soft shadow per form. The exports keep the shapes the toys expect.
import { PAL, look, rng, clamp, lerp, surface, path, blob, spline, mix } from './riso.js';

const TAU = Math.PI * 2;

// ── the balloon ──────────────────────────────────────────────────────────────
// The envelope in a box S wide: round to its equator at 36% of the height, then a convex taper to
// a mouth 26% as wide.
const EQ = 0.36, MOUTH = 0.13;
export function halfW(u) {
  if (u <= EQ) { const k = (EQ - u) / EQ; return 0.5 * Math.sqrt(Math.max(0, 1 - k * k)); }
  const t = (u - EQ) / (1 - EQ); return MOUTH + (0.5 - MOUTH) * Math.pow(Math.cos((t * Math.PI) / 2), 1.15);
}
const ROWS = [0, 0.07, 0.15, 0.24, 0.33, 0.42, 0.51, 0.6, 0.7, 0.82, 0.93, 1];
const GORES = 10;
function cellColour(i, j) {
  if (i >= 10) return PAL.coralDeep;
  if (i >= 8) return j % 2 ? PAL.pale : PAL.slate;
  if ((i === 5 && j === 1) || (i === 6 && j === 2) || (i === 4 && j === 2) || (i === 5 && j === 3)) return PAL.gold;
  return [PAL.coral, PAL.pale, PAL.slate][(((j - i) % 3) + 3) % 3];
}
function cellPath(cx, top, S, H, i, j) {
  const u0 = ROWS[i], u1 = ROWS[i + 1], a0 = -Math.PI / 2 + (j / GORES) * Math.PI, a1 = a0 + Math.PI / GORES, pts = [];
  for (let k = 0; k <= 6; k++) { const u = lerp(u0, u1, k / 6); pts.push([cx + S * halfW(u) * Math.sin(a0), top + H * u]); }
  for (let k = 6; k >= 0; k--) { const u = lerp(u0, u1, k / 6); pts.push([cx + S * halfW(u) * Math.sin(a1), top + H * u]); }
  return path(pts);
}
// Returns { cv, w, h, mouth:[x,y] (the flame), basket:[x,y,w,h], env (Path2D, sprite px), cx, top, S, H,
// cut (the y where the cables start), cables (when opts.cables === false), frame }.
export function bakeBalloon(S, dpr = 2, seed = 11, opts = {}) {
  const H = S * 1.12, pad = Math.ceil(S * 0.04), W = Math.ceil(S + pad * 2), cx = W / 2, top = pad;
  const sk = top + H + S * 0.045, fy = sk + S * 0.12, bw = S * 0.15, bh = S * 0.12, by = fy + S * 0.025, bx = cx - bw / 2;
  const total = Math.ceil(by + bh + pad), s = surface(W, total, dpr), c = s.ctx;
  const envPts = []; for (let k = 0; k <= 48; k++) { const u = k / 48; envPts.push([cx + S * halfW(u), top + H * u]); } for (let k = 48; k >= 0; k--) { const u = k / 48; envPts.push([cx - S * halfW(u), top + H * u]); }
  const env = path(envPts);
  // panels, flat
  for (let i = 0; i < ROWS.length - 1; i++) for (let j = 0; j < GORES; j++) { c.fillStyle = cellColour(i, j); c.fill(cellPath(cx, top, S, H, i, j)); c.strokeStyle = c.fillStyle; c.lineWidth = 0.6; c.stroke(cellPath(cx, top, S, H, i, j)); }
  // one soft form: the side away from the sun a shade darker, a crescent (the envelope minus itself moved toward the light)
  { const cres = new Path2D(); cres.addPath(env); cres.addPath(env, new DOMMatrix().translate(-S * 0.16, -H * 0.02)); c.save(); c.clip(env); c.fillStyle = 'rgba(31,42,61,0.12)'; c.fill(cres, 'evenodd'); c.restore(); }
  // the skirt
  c.fillStyle = PAL.coralDeep; c.fill(path([[cx - S * MOUTH, top + H - 1], [cx + S * MOUTH, top + H - 1], [cx + S * MOUTH * 0.82, sk], [cx - S * MOUTH * 0.82, sk]]));
  // cables, the burner frame and its coil, the basket, two pilots
  const fw = bw * 0.42, cables = [-1, 1, -0.45, 0.45].map((a) => [cx + S * MOUTH * 0.8 * a, sk, cx + fw * a, fy]);
  c.strokeStyle = 'rgba(31,42,61,0.55)'; c.lineWidth = Math.max(0.8, S / 280); c.lineCap = 'round';
  if (opts.cables !== false) { c.beginPath(); cables.forEach(([x0, y0, x1, y1]) => { c.moveTo(x0, y0); c.lineTo(x1, y1); }); c.stroke(); }
  c.fillStyle = PAL.ink; c.fillRect(cx - fw, fy - S * 0.008, fw * 2, Math.max(1.4, S * 0.012));
  const coilTop = fy - S * 0.03; c.fillStyle = '#8A93A3'; c.beginPath(); c.roundRect(cx - S * 0.022, coilTop, S * 0.044, S * 0.026, S * 0.008); c.fill();
  [-0.22, 0.22].forEach((f, k) => { const hx = cx + f * bw; c.fillStyle = k ? '#B07A55' : '#E2B48E'; c.beginPath(); c.arc(hx, by - S * 0.012, S * 0.018, 0, TAU); c.fill(); c.fillStyle = k ? PAL.gold : PAL.slate; c.beginPath(); c.arc(hx, by - S * 0.02, S * 0.018, Math.PI, TAU); c.fill(); });
  c.fillStyle = PAL.wicker; c.beginPath(); c.roundRect(bx, by, bw, bh, S * 0.012); c.fill();
  c.fillStyle = PAL.wickerDeep; c.fillRect(bx, by, bw, bh * 0.16); c.fillRect(bx + bw * 0.62, by + bh * 0.16, bw * 0.38, bh * 0.84);
  return { cv: s.cv, w: W, h: total, mouth: [cx, coilTop], basket: [bx, by, bw, bh], env, cx, top, S, H, cut: sk, cables: opts.cables === false ? cables : null, frame: [cx - fw, fy, cx + fw, fy] };
}

// A basket on its own, for the lucky machine's hopper. { cv, back, w, h, mouth:{cx,cy,rx,ry}, wallTop, floor }
export function bakeBasket(width, dpr = 2) {
  const w = Math.max(40, width), h = Math.ceil(w * 0.78), s = surface(w, h, dpr), b = surface(w, h, dpr), c = s.ctx, rx = w / 2 - 2, ry = w * 0.08, cx = w / 2, rimY = 2 + ry, floor = h - 3;
  b.ctx.fillStyle = PAL.wickerDeep; b.ctx.beginPath(); b.ctx.ellipse(cx, rimY, rx, ry, 0, 0, TAU); b.ctx.fill();
  c.fillStyle = PAL.wicker; c.beginPath(); c.moveTo(cx - rx, rimY); c.lineTo(cx - rx * 0.86, floor); c.lineTo(cx + rx * 0.86, floor); c.lineTo(cx + rx, rimY); c.ellipse(cx, rimY, rx, ry, 0, 0, Math.PI); c.closePath(); c.fill();
  c.fillStyle = PAL.wickerDeep; c.fillRect(cx + rx * 0.3, rimY, rx * 0.62, floor - rimY);
  return { cv: s.cv, back: b.cv, w, h, mouth: { cx, cy: rimY, rx, ry }, wallTop: rimY, floor };
}

// The burner's flame: a gold tongue with a warm heart; k 0..1 how hard it burns.
export function flame(ctx, x, y, size, k, t) {
  if (k <= 0.02) return;
  const h = size * (0.5 + 1.7 * k) * (0.92 + 0.08 * Math.sin(t * 29)), w = size * (0.2 + 0.12 * k), lean = Math.sin(t * 3.1) * w * 0.25;
  const tongue = (sw, sh, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w * sw, y); ctx.quadraticCurveTo(x - w * sw * 1.1, y - h * sh * 0.55, x + lean, y - h * sh); ctx.quadraticCurveTo(x + w * sw * 1.1, y - h * sh * 0.55, x + w * sw, y); ctx.closePath(); ctx.fill(); };
  ctx.save(); tongue(1, 1, PAL.gold); tongue(0.6, 0.66, '#F08A4B'); tongue(0.28, 0.36, '#FFF3C8'); ctx.restore();
}

// ── a golf ball: white, a shadow crescent on the side away from the sun ──────
const ballCache = new Map();
export function ballSprite(r, dpr = 2) {
  const key = r.toFixed(1) + ':' + dpr; if (ballCache.has(key)) return ballCache.get(key);
  const pad = 1, s = surface(r * 2 + pad * 2, r * 2 + pad * 2, dpr), c = s.ctx, x = r + pad, y = r + pad;
  c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); c.fillStyle = '#DCE1E8'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.4, r * 1.05, 0, TAU); c.rect(x - r * 2, y - r * 2, r * 4, r * 4); c.fill('evenodd'); c.restore();
  const out = { cv: s.cv, size: r * 2 + pad * 2, r }; ballCache.set(key, out); return out;
}
export function clearCaches() { ballCache.clear(); }

// A cloud: overlapping rounds on a flat bottom, white. { cv, w, h, rx }
export function bakeCloud(rx, seed = 1, dpr = 2) {
  const r = rng(seed * 7 + 3), ry = rx * 0.34, w = Math.ceil(rx * 2.4), h = Math.ceil(ry * 3), s = surface(w, h, dpr), c = s.ctx, cx = w / 2, base = h * 0.78;
  c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath();
  const n = 4 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, rr = ry * (0.7 + Math.sin(t * Math.PI) * 0.9) * (0.85 + r() * 0.3), x = cx + (t - 0.5) * rx * 1.6; c.moveTo(x + rr, base); c.arc(x, base - rr * 0.55, rr, 0, TAU); }
  c.fill(); c.clearRect(0, base, w, h - base);
  return { cv: s.cv, w, h, rx };
}

// ── people seen from behind ──────────────────────────────────────────────────
const SHIRTS = [PAL.coral, PAL.slate, PAL.gold, '#7FA6C9', '#F1EDE6', '#8FB08A', '#C9879A', '#E7D7B9'];
const SKIN = ['#F1C7A5', '#D9A27E', '#B97E5A', '#8D5A3B'];
const HAIR = ['#2E2A28', '#5A4335', '#B9B2A8', '#1F2A3D'];
// One person. p: x, base (the feet's y), h, arch, flip, hop (start in ms, or -1), ph; the caller may set
// gaze, tilt, phoneUntil, point and still.
export function person(ctx, p, now) {
  const u = p.h / 10, still = p.still || !now;
  const sw = still ? 0 : Math.sin((now / 1000) * TAU * 0.4 + (p.ph || 0)) * 0.4;
  let up = 0, sy = 1, arms = p.point ? 'one' : 'down', air = 0;
  if (p.hop > 0 && now) {
    const t = now - p.hop;
    if (t >= 0 && t < 90) sy = 0.93;
    else if (t >= 90 && t < 530) { const q = (t - 90) / 440; air = 4 * q * (1 - q); up = air * p.h * 0.3; arms = 'up'; }
    else if (t >= 530 && t < 700) sy = 0.95;
    else if (t >= 700) p.hop = -1;
  }
  if (arms === 'down' && p.phoneUntil > now) arms = 'phone';
  const shirt = SHIRTS[(p.arch || 0) % SHIRTS.length], skin = SKIN[(p.skinV || 0) % SKIN.length], hair = HAIR[(p.hairV || 0) % HAIR.length], legs = (p.arch || 0) % 3 === 1 ? '#C9B79C' : '#33405A';
  ctx.save();
  ctx.fillStyle = 'rgba(31,42,61,0.12)'; ctx.beginPath(); ctx.ellipse(p.x + sw + u * 0.6, p.base + u * 0.2, u * 1.8 * (1 - 0.4 * air), u * 0.36, 0, 0, TAU); ctx.fill();
  ctx.translate(p.x + sw, p.base - up); ctx.scale(p.flip ? -1 : 1, sy);
  ctx.fillStyle = legs; ctx.beginPath(); ctx.roundRect(-1.15 * u, -4.4 * u, 1.05 * u, 4.4 * u, 0.4 * u); ctx.roundRect(0.1 * u, -4.4 * u, 1.05 * u, 4.4 * u, 0.4 * u); ctx.fill();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(-1.7 * u, -8.1 * u, 3.4 * u, 4.2 * u, [1.1 * u, 1.1 * u, 0.4 * u, 0.4 * u]); ctx.fill();
  const arm = (side, ang) => { ctx.save(); ctx.translate(side * 1.75 * u, -7.6 * u); ctx.rotate(ang); ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(-0.36 * u, 0, 0.72 * u, 3.4 * u, 0.36 * u); ctx.fill(); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 3.4 * u, 0.36 * u, 0, TAU); ctx.fill(); ctx.restore(); };
  if (arms === 'up') { arm(-1, 2.6); arm(1, -2.6); } else if (arms === 'one') { arm(-1, 0.08); arm(1, -2.5); } else if (arms === 'phone') { arm(-1, 0.08); arm(1, -2.2); } else { arm(-1, 0.08); arm(1, -0.08); }
  const g = still ? 0 : clamp(p.gaze || 0, -1, 1) * (p.flip ? -1 : 1), tl = still ? 0 : clamp(p.tilt || 0, 0, 1.2);
  ctx.translate(g * 0.3 * u, -9.1 * u - tl * 0.2 * u);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 0, 1.1 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -0.05 * u, 1.12 * u, Math.PI * 0.92, TAU * 1.04); ctx.lineTo(1.02 * u, 0.7 * u); ctx.lineTo(-1.02 * u, 0.7 * u); ctx.closePath(); ctx.fill();
  if ((p.arch || 0) % 4 === 2) { ctx.fillStyle = '#E8DCC0'; ctx.beginPath(); ctx.ellipse(0, -0.8 * u, 1.9 * u, 0.4 * u, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, -1.1 * u, 1.05 * u, 0.75 * u, 0, Math.PI, TAU); ctx.fill(); }
  ctx.restore();
}
// A line of people from x0 to x1, two rows (the back row smaller and a little higher).
export function crowd(seed, x0, x1, baseAt, h) {
  const r = rng(seed), out = [];
  for (let x = x0; x < x1; x += h * (0.27 + r() * 0.2)) {
    const arch = Math.floor(r() * 8), back = r() < 0.38, kid = arch === 4, sc = back ? 0.85 : 1;
    out.push({ x, base: baseAt(x) - r() * 0.1 * h - (back ? 0.1 * h : 0), h: h * sc * (kid ? 0.62 : 0.9 + r() * 0.2), arch, back, flip: r() < 0.5, hop: -1, ph: r() * TAU, seed: 1 + Math.floor(r() * 90000), hairV: Math.floor(r() * 4), skinV: Math.floor(r() * 4) });
  }
  out.sort((a, b) => a.base - b.base);
  return out;
}

// ── the kapok: the venue's own tall tree, drawn by the hero on its top layer ──
// { cv, w, h } the size of the stage; side 'left' | 'right'.
export function bakeKapok(w, h, hy, side, dpr = 2) {
  const s = surface(w, h, dpr), c = s.ctx, left = side !== 'right', wide = w >= 900;
  const bw = wide ? clamp(w * 0.05, 52, 78) : w * 0.08, tw = bw * 0.58, x0 = left ? w * 0.035 : w * 0.965, yb = h + 6, yt = hy - 0.24 * h, lean = (left ? 1 : -1) * Math.tan((7 * Math.PI) / 180) * (yb - yt);
  const L = spline([[x0 - bw / 2, yb], [x0 - bw * 0.5 + lean * 0.4, (yb + yt) / 2], [x0 + lean - tw / 2, yt]], false, 8), R = spline([[x0 + lean + tw / 2, yt], [x0 + bw * 0.5 + lean * 0.5, (yb + yt) / 2 + 6], [x0 + bw / 2, yb]], false, 8);
  const trunk = path(L.concat(R)), top = [x0 + lean, yt], cw = wide ? clamp(w * 0.045, 44, 70) : w * 0.09;
  // the crown first, behind the trunk's top
  [[-0.2, -0.3, 1.1, 0.6, PAL.treeDeep], [0.75, -0.05, 0.85, 0.5, PAL.treeDeep], [-0.95, 0, 0.75, 0.45, PAL.treeDeep], [0.1, -0.7, 0.8, 0.45, PAL.tree], [-0.6, -0.55, 0.7, 0.42, PAL.tree], [0.6, -0.45, 0.65, 0.4, PAL.tree]].forEach(([dx, dy, a, b, col], i) => { c.fillStyle = col; c.beginPath(); c.ellipse(top[0] + dx * cw * 1.8, top[1] + dy * cw * 1.8, cw * 1.7 * a, cw * 1.7 * b, 0, 0, TAU); c.fill(); });
  // branches into it
  c.strokeStyle = '#8E8A7E'; c.lineCap = 'round'; [[-1, 0.16], [1, 0.14]].forEach(([d, wd]) => { c.lineWidth = cw * wd; c.beginPath(); c.moveTo(top[0], top[1] + 6); c.quadraticCurveTo(top[0] + d * cw * 0.5, top[1] - cw * 0.5, top[0] + d * cw * 1.2, top[1] - cw * 0.65); c.stroke(); });
  // the trunk: grey-green bark, a shaded side, rows of small thorns as flat triangles
  c.fillStyle = '#A3A495'; c.fill(trunk);
  c.save(); c.clip(trunk); c.fillStyle = '#8A8B7D'; c.beginPath(); c.rect(left ? x0 + lean * 0.5 : x0 - bw, yt - 10, bw * 1.2, yb - yt + 20); c.fill(); c.restore();
  const r = rng(77); c.fillStyle = '#7C7D70';
  for (let y = yb - 14; y > yt + 10; y -= 16) {
    const t = (yb - y) / (yb - yt), mx = lerp(x0, x0 + lean, t), half = lerp(bw, tw, t) / 2;
    for (let f = -0.8; f <= 0.81; f += 0.4) { const bx = mx + (f + (r() - 0.5) * 0.15) * half, by = y + (r() - 0.5) * 6, sz = 4 + r() * 3; c.beginPath(); c.moveTo(bx - sz * 0.45, by); c.lineTo(bx + sz * 0.45, by); c.lineTo(bx, by - sz); c.closePath(); c.fill(); }
  }
  return { cv: s.cv, w, h };
}

// ── the ground: sky, a sun, hills, the tree line, chedis, the lawn, chalk, the X, the tape ──
// L: { w, h, hy (horizon), x:[x,y] (the X), xs (its half-size), tape, tapeW, chedis, clouds, liveTape,
//      fullH, balloons (false for none) }. Returns { chalk, proj, sc, gz, ring }.
export function bakeGround(dest, L, seed = 3) {
  const { w, h, hy } = L, c = dest.ctx, r = rng(seed), wide = w >= 900, full = Math.max(h, L.fullH || h);
  const gz = (y) => clamp((y - hy) / (h - hy));
  const sc = (y) => 0.25 + 0.95 * gz(y);
  // sky: one quiet gradient, lighter at the horizon
  const sky = c.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, PAL.skyTop); sky.addColorStop(1, PAL.skyLow);
  c.fillStyle = sky; c.fillRect(0, 0, w, hy + 2);
  // the sun, high and to the left, the side the balloon is lit from
  const sx = w * (wide ? 0.08 : 0.16), sy = hy * 0.16, sr = Math.min(w, h) * 0.06;
  c.fillStyle = 'rgba(255,248,224,0.45)'; c.beginPath(); c.arc(sx, sy, sr * 2.1, 0, TAU); c.fill();
  c.fillStyle = PAL.sunDisc; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
  // clouds
  (L.clouds || [[0.3, 0.22, 0.9], [0.86, 0.12, 0.7]]).forEach(([fx, fy, s0], k) => { const cl = bakeCloud(Math.min(130, w * 0.15) * s0, 10 + k, dest.dpr || 2); c.drawImage(cl.cv, w * fx - cl.w / 2, hy * fy, cl.w, cl.h); });
  // a few balloons far off, small and pale with distance
  if (L.balloons !== false) [[0.22, 0.42, 0.045, PAL.gold, '#E8A93A'], [0.9, 0.5, 0.035, '#7FA6C9', '#5E86AB'], [0.58, 0.18, 0.03, '#D98C9C', '#C26F81']].forEach(([fx, fy, fs, a, b]) => {
    const s = Math.min(w, h) * fs, x = w * fx, y = hy * fy;
    c.save(); c.globalAlpha = 0.85; c.fillStyle = a; c.beginPath(); c.moveTo(x, y + s * 1.05); c.bezierCurveTo(x - s * 0.9, y + s * 0.4, x - s * 0.85, y - s * 0.8, x, y - s * 0.85); c.bezierCurveTo(x + s * 0.85, y - s * 0.8, x + s * 0.9, y + s * 0.4, x, y + s * 1.05); c.fill();
    c.fillStyle = b; c.beginPath(); c.moveTo(x, y - s * 0.85); c.bezierCurveTo(x + s * 0.85, y - s * 0.8, x + s * 0.9, y + s * 0.4, x, y + s * 1.05); c.bezierCurveTo(x + s * 0.3, y + s * 0.3, x + s * 0.3, y - s * 0.5, x, y - s * 0.85); c.fill();
    c.fillStyle = '#8A6A4C'; c.fillRect(x - s * 0.13, y + s * 1.2, s * 0.26, s * 0.2); c.restore();
  });
  // hills: two ranges, paler with distance
  const ridge = (base, amp, f, ph, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(-10, hy + 4); for (let x = -10; x <= w + 10; x += 8) c.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(x * f + ph)) * (0.7 + 0.3 * Math.sin(x * f * 2.3 + ph * 2))); c.lineTo(w + 10, hy + 4); c.closePath(); c.fill(); };
  ridge(hy - 6, Math.min(70, h * 0.1), 0.006, 1.2, PAL.hillFar);
  ridge(hy, Math.min(44, h * 0.065), 0.011, 3.1, PAL.hillMid);
  // chedis behind the trees: white bells, a shaded side, a gold spire
  (L.chedis || [0.3, 0.83]).forEach((f, k) => {
    const x = w * f, s = clamp(w * 0.05, 24, 46) * (k === 1 ? 0.8 : 1), b = hy - 2;
    const bell = path([[x - s * 0.45, b], [x + s * 0.45, b], [x + s * 0.4, b - s * 0.22], [x + s * 0.3, b - s * 0.26], [x + s * 0.3, b - s * 0.48], [x + s * 0.12, b - s * 0.7], [x + s * 0.05, b - s * 1.3], [x - s * 0.05, b - s * 1.3], [x - s * 0.12, b - s * 0.7], [x - s * 0.3, b - s * 0.48], [x - s * 0.3, b - s * 0.26], [x - s * 0.4, b - s * 0.22]]);
    c.fillStyle = PAL.chedi; c.fill(bell); c.save(); c.clip(bell); c.fillStyle = PAL.chediShade; c.fillRect(x + s * 0.06, b - s * 1.4, s, s * 1.5); c.restore();
    c.fillStyle = PAL.gold; c.beginPath(); c.moveTo(x - s * 0.05, b - s * 1.3); c.lineTo(x + s * 0.05, b - s * 1.3); c.lineTo(x, b - s * 1.62); c.closePath(); c.fill();
  });
  // the tree line: round crowns in two greens on short trunks
  const count = clamp(Math.round(w / (wide ? 70 : 48)), 7, 20);
  for (let i = 0; i < count; i++) {
    const x = (w * (i + 0.5 + (r() - 0.5) * 0.6)) / count, s = (wide ? 1 : 0.8) * (0.8 + r() * 0.5) * clamp(h / 520, 0.8, 1.4), th = 10 * s, cr = (16 + r() * 10) * s, cy = hy - th - cr * 0.55;
    c.fillStyle = PAL.trunk; c.fillRect(x - 1.2 * s, hy - th - 2, 2.4 * s, th + 4);
    c.fillStyle = PAL.treeDeep; c.beginPath(); c.ellipse(x, cy, cr, cr * 0.72, 0, 0, TAU); c.fill();
    c.fillStyle = PAL.tree; c.beginPath(); c.ellipse(x - cr * 0.18, cy - cr * 0.1, cr * 0.8, cr * 0.55, 0, 0, TAU); c.fill();
  }
  // the lawn: flat green, wide mown stripes in perspective, a deeper green toward us
  c.fillStyle = PAL.lawn; c.fillRect(0, hy, w, full - hy + 2);
  const [X, Y] = L.x, S = L.xs, SQ = 0.36;
  c.save(); c.beginPath(); c.rect(0, hy, w, full - hy); c.clip(); c.fillStyle = PAL.lawnStripe;
  for (let k = -12; k <= 12; k += 2) { const a = X + k * 70, b = X + (k + 1) * 70; c.beginPath(); c.moveTo(X + (a - X) * 0.25, hy); c.lineTo(X + (b - X) * 0.25, hy); c.lineTo(X + (b - X) * 2.4, full); c.lineTo(X + (a - X) * 2.4, full); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(120,169,129,0.18)'; c.fillRect(0, lerp(hy, h, 0.78), w, full);
  c.restore();
  // chalk: a square of lines around the X, a ring, the X
  const chalk = [], gridN = 4, gw = S * 3.6, gd = S * 1.3;
  const proj = (u, v) => { const y = Y + v * gd, k = sc(y) / sc(Y); return [X + u * gw * k, y]; };
  for (let k = -gridN / 2; k <= gridN / 2; k++) { chalk.push([proj(k / (gridN / 2), -1), proj(k / (gridN / 2), 1), 1.1]); chalk.push([proj(-1, k / (gridN / 2)), proj(1, k / (gridN / 2)), 1.1]); }
  const ringR = 1.5 * S;
  c.save(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineCap = 'round';
  chalk.forEach(([a, b, wd]) => { c.lineWidth = wd * sc((a[1] + b[1]) / 2) * 1.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
  c.lineWidth = 1.6 * sc(Y); c.beginPath(); c.ellipse(X, Y, ringR, ringR * SQ, 0, 0, TAU); c.stroke();
  const xw = clamp(S * 0.14, 4.6, 6.4), xa = proj(-0.2, -0.38), xb = proj(0.2, 0.38), xc = proj(0.2, -0.38), xd = proj(-0.2, 0.38);
  c.strokeStyle = '#FFFFFF'; c.lineWidth = xw; [[xa, xb], [xc, xd]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
  c.restore();
  // the tape on its stakes, unless the hero draws it live
  const tape = L.tape || [];
  if (tape.length > 1 && !L.liveTape) {
    c.save(); c.lineWidth = Math.max(2, L.tapeW || 3); c.lineJoin = 'round';
    c.strokeStyle = PAL.gold; c.beginPath(); tape.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.setLineDash([6, 6]); c.strokeStyle = PAL.ink; c.stroke(); c.restore();
  }
  if (tape.length > 1) tape.forEach(([x, y], k) => { if (k % 3) return; const s = sc(y); c.fillStyle = PAL.wickerDeep; c.fillRect(x - 1.2 * s, y - 2 * s, 2.4 * s, 22 * s); });
  return { chalk, proj, sc, gz, ring: { rx: ringR, ry: ringR * SQ, squash: SQ } };
}
