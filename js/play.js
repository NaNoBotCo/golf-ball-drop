// Try a drop: the lucky number machine and the drop itself.
//
// The machine is a Galton board of golf tees: a ball leaves the balloon's basket, pings down
// through ninety tees into one of ten cups on a turf strip, and the cup plus the tees it pinged
// make a number from 1 to 300, which is printed on a ticket that slides out of the cup and
// carries over to the drop. The drop is 300 numbered balls from the balloon onto the lawn: a
// breeze, a pile that settles, the three closest to the X measured with tape in a photo-finish
// loupe, your own ball flagged all the way down.
//
// Everything is printed with js/riso.js: one drum per ink, each through its own registration.
// Live marks are made the same way: an ink is multiplied through its offset, key goes on top.
import { look, onLook, clamp, lerp, rng, surface, screen, tone, print, crayon, greens, inkOf, path } from './riso.js';
import { bakeBalloon, bakeGround, bakeCloud, flame, crowd, person } from './scene.js';
import { burst, t2, shareText, calm, dingbatFloat, PAGE } from './bits.js';
import { encodeQr } from './qr.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const $ = (id) => document.getElementById(id);
const FONT = '"Bricolage Grotesque","Noto Sans Thai",sans-serif', THAI = '"Noto Sans Thai","Bricolage Grotesque",sans-serif';
const ease = { out: (t) => 1 - Math.pow(1 - clamp(t), 3), io: (t) => { t = clamp(t); return t * t * (3 - 2 * t); }, back: (t) => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };
// where each drum lands on a live mark: the same offsets js/riso.js prints with
const OFF = { sun: [-1.6, 1.3], warm: [1.5, -1.0], sky: [-1.1, 0.7] };
const pen = (n) => (n % 1 ? n.toFixed(1) : n + '.0');

// a different seed every page load: the numbers are no one's script
function rand32() { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return (Math.random() * 4294967296) >>> 0; } }
// requestIdleCallback, or the next turn
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 700 }) : setTimeout(fn, 0));
// a sprite or a bake kept until the look changes
const kept = new Map();
onLook(() => kept.clear());
function keep(key, make) { let v = kept.get(key); if (v === undefined) { v = make(); kept.set(key, v); } return v; }

// ── sound: one AudioContext, made on the first tap ───────────────────────────
const sound = { ac: null, voices: 0, muted: false };
try { sound.muted = localStorage.getItem('gbd-mute') === '1'; } catch (e) {}
function wake() {
  try { if (!sound.ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) sound.ac = new C(); } if (sound.ac && sound.ac.state === 'suspended') sound.ac.resume(); } catch (e) {}
}
function voice(freq, dur, gain, type = 'triangle', slide = 0) {
  const ac = sound.ac; if (!ac || sound.muted || sound.voices >= 6) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.03); sound.voices++;
    o.onended = () => { sound.voices--; try { g.disconnect(); } catch (e) {} };
  } catch (e) {}
}
const PENTA = [0, 2, 4, 7, 9];
const buzz = (ms) => { if (calm) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
// each picture that shows a speaker asks to be redrawn when the other one flips it
const muteWatchers = [];
const setMute = (m) => { sound.muted = m; try { localStorage.setItem('gbd-mute', m ? '1' : '0'); } catch (e) {} muteWatchers.forEach((f) => f()); };
// the pentatonic scale from a middle C: k steps up it, oct octaves on
const note = (k, oct = 0) => 523.25 * Math.pow(2, PENTA[k % 5] / 12 + Math.floor(k / 5) + oct);
// the page's two pictures share one mute: a small speaker in a corner, its centre at x, y
function paintSpeaker(c, x, y) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1.7; c.strokeStyle = look.key; c.fillStyle = look.paper;
  c.beginPath(); c.moveTo(-9, -3.5); c.lineTo(-4.5, -3.5); c.lineTo(1, -8); c.lineTo(1, 8); c.lineTo(-4.5, 3.5); c.lineTo(-9, 3.5); c.closePath(); c.fill(); c.stroke();
  if (sound.muted) { c.beginPath(); c.moveTo(5, -4); c.lineTo(11, 4); c.moveTo(11, -4); c.lineTo(5, 4); c.stroke(); }
  else { c.beginPath(); c.arc(1, 0, 5.5, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(1, 0, 9.5, -0.9, 0.9); c.stroke(); }
  c.restore();
}
// a small paper chip with a key outline: the machine's running tally, the drop's place
function chipAt(c, x, y, text) {
  c.save(); c.font = `800 12px ${FONT}`; const w = Math.ceil(c.measureText(text).width) + 16, h = 21;
  c.fillStyle = look.paper; c.strokeStyle = look.key; c.lineWidth = 1.8; c.beginPath(); c.roundRect(x, y, w, h, 7); c.fill(); c.stroke();
  c.fillStyle = look.key; c.textBaseline = 'middle'; c.fillText(text, x + 8, y + h / 2 + 0.5); c.restore();
  return w;
}
// ── chalk: lettering and arrows on the open paper and the open lawn ─────────
// A word in chalk: the key drum a hair off to the lower right, the paper on top. lines are [text, px, dy] from the point; the Thai goes in
// whenever English is not the only language showing. a is the opacity, k the breathing scale.
const hasLang = (v) => document.documentElement.classList.contains('lang-' + v);
function chalkWords(c, x, y, rot, k, lines, a = 1) {
  c.save(); c.translate(x, y); c.scale(k, k); c.rotate(rot); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  lines.forEach(([text, px, dy, thai]) => {
    if (thai && hasLang('en')) return; if (!thai && hasLang('th') && px < 20) return;
    c.font = `800 ${px}px ${thai ? THAI : FONT}`;
    if (thai) { c.globalAlpha = a; c.lineWidth = 4.5; c.strokeStyle = look.paper; c.strokeText(text, 0, dy); c.fillStyle = look.key; c.fillText(text, 0, dy); }
    else { c.fillStyle = look.key; c.globalAlpha = 0.9 * a; c.fillText(text, 1.6, dy + 1.8); c.fillStyle = look.paper; c.globalAlpha = a; c.fillText(text, 0, dy); }
  });
  c.restore();
}
// a crayon line in chalk: key a hair off to the lower right, paper on top
function chalkLine(c, pts, a = 1, seed = 9, w = 2.2) {
  [[look.key, w * 0.65, w * 0.7, 0.9], [look.paper, 0, 0, 1]].forEach(([col, dx, dy, al]) => { c.save(); c.translate(dx, dy); crayon(c, pts, { w, color: col, seed, wobble: 0.5, alpha: al * a }); c.restore(); });
}
// an arrow along pts, its head turned to the way the last stretch runs
function chalkArrow(c, pts, a = 1, seed = 9, w = 2.2) {
  const n = pts.length, [ax, ay] = pts[n - 1], [px, py] = pts[n - 2], d = Math.atan2(ay - py, ax - px), hl = 4 * w + 1;
  chalkLine(c, pts, a, seed, w);
  chalkLine(c, [[ax - Math.cos(d - 0.6) * hl, ay - Math.sin(d - 0.6) * hl], [ax, ay], [ax - Math.cos(d + 0.6) * hl, ay - Math.sin(d + 0.6) * hl]], a, seed + 1, w);
}
// what this visitor has been shown, kept for the page's life: the first completed drop brings the 'drag to aim' note until the basket has been dragged
const seen = { drops: 0, aimed: false, ghost: false };

// ── golf balls ───────────────────────────────────────────────────────────────
// For the drop: a paper disc, a key outline, a key crescent on the lower right, a few dimples on
// the lit side. Not tinted with sky, so it stays a white ball on the dark lawn.
const DIMPLES = [[-0.42, -0.34], [-0.05, -0.56], [-0.6, 0.04], [0.22, -0.24], [-0.3, 0.34], [0.12, 0.2]];
function dropBall(r, dpr) {
  return keep(`ball:${look.name}:${r}:${dpr}`, () => {
    const pad = 2, d = r * 2 + pad * 2, s = surface(d, d, dpr), c = s.ctx, x = d / 2, y = d / 2, key = inkOf('key');
    c.fillStyle = look.paper; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.globalCompositeOperation = 'multiply'; c.fillStyle = key; c.globalAlpha = 0.4;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.arc(x - r * 0.4, y - r * 0.44, r * 0.98, 0, TAU); c.fill('evenodd');
    if (r >= 3.5) { c.globalAlpha = 0.6; const dr = Math.max(0.4, r * 0.085); DIMPLES.forEach(([a, b], i) => { if (i > 5) return; c.beginPath(); c.arc(x + a * r, y + b * r, dr, 0, TAU); c.fill(); }); }
    // seen through the loupe or on the share card the ball is large, and a few more dimples wrap round its lit side
    if (r >= 11) { c.globalAlpha = 0.5; FACE.slice(0, 8).forEach(([a, b]) => { c.beginPath(); c.arc(x + (a * 0.9 - 0.12) * r, y + (b * 0.9 - 0.1) * r, r * 0.07, 0, TAU); c.fill(); }); }
    c.restore();
    c.strokeStyle = key; c.lineWidth = Math.max(0.8, r / 5); c.globalAlpha = 0.9; c.beginPath(); c.arc(x + 0.2, y + 0.15, r - c.lineWidth / 2, 0, TAU); c.stroke();
    return { cv: s.cv, size: d, r };
  });
}
// For the machine: the same ball in three layers, so the face can turn under a fixed light:
// the paper disc, the face that rotates (dimples, a key seam, a warm dot), the shade and outline.
const FACE = [[0, 0], [0.5, 0], [0.25, 0.43], [-0.25, 0.43], [-0.5, 0], [-0.25, -0.43], [0.25, -0.43], [0.82, 0.2], [-0.82, 0.2], [0.58, -0.68], [-0.58, -0.68], [0, 0.88], [0.05, -0.9]];
function rollBall(r, dpr) {
  return keep(`roll:${look.name}:${r.toFixed(1)}:${dpr}`, () => {
    const pad = 2, d = r * 2 + pad * 2, key = inkOf('key'), mk = () => surface(d, d, dpr), x = d / 2;
    const base = mk(), face = mk(), shade = mk();
    base.ctx.fillStyle = look.paper; base.ctx.beginPath(); base.ctx.arc(x, x, r, 0, TAU); base.ctx.fill();
    let c = face.ctx; c.save(); c.beginPath(); c.arc(x, x, r, 0, TAU); c.clip();
    c.fillStyle = key; c.globalAlpha = 0.55; FACE.forEach(([a, b]) => { c.beginPath(); c.arc(x + a * r, x + b * r, Math.max(0.55, r * 0.085), 0, TAU); c.fill(); });
    c.globalAlpha = 0.9; c.strokeStyle = key; c.lineWidth = Math.max(1, r * 0.13); c.lineCap = 'round'; c.beginPath(); c.arc(x, x, r * 0.66, 0.35, 0.35 + 4 / (r * 0.66)); c.stroke();
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.95; c.fillStyle = inkOf('warm'); c.beginPath(); c.arc(x - r * 0.36, x + r * 0.3, r * 0.17, 0, TAU); c.fill();
    c.restore();
    c = shade.ctx; c.save(); c.beginPath(); c.arc(x, x, r, 0, TAU); c.clip(); c.globalCompositeOperation = 'multiply'; c.fillStyle = key; c.globalAlpha = 0.5;
    c.beginPath(); c.arc(x, x, r, 0, TAU); c.arc(x - r * 0.38, x - r * 0.42, r * 0.98, 0, TAU); c.fill('evenodd'); c.restore();
    c.strokeStyle = key; c.lineWidth = Math.max(1.5, r / 4.2); c.beginPath(); c.arc(x + 0.2, x + 0.15, r - c.lineWidth / 2, 0, TAU); c.stroke();
    return { base: base.cv, face: face.cv, shade: shade.cv, size: d };
  });
}
function drawRoll(c, sp, x, y, ang) {
  const h = sp.size / 2;
  c.drawImage(sp.base, x - h, y - h, sp.size, sp.size);
  c.save(); c.translate(x, y); c.rotate(ang); c.drawImage(sp.face, -h, -h, sp.size, sp.size); c.restore();
  c.drawImage(sp.shade, x - h, y - h, sp.size, sp.size);
}

// ── the golf tee ─────────────────────────────────────────────────────────────
// In profile, in units of u (the cup's half-width is 1.35 u): a dished cup with a thick rim, a bell
// that narrows to a neck (the top 45 percent of the height), then a shaft that tapers to a point (the
// other 55 percent). One colour to a tee, as a bag of them is: coral, blue, yellow, or the blue over
// the yellow for green; a key crayon outline that breaks where the light lands, a dark crescent
// for the cup's concavity, one shade line down the shaft, wood-grain ticks, a bare-paper band on the
// neck and a small blue contact shadow. Four authored variants (colour, length, bow, a chip).
const TEE = [{ len: 6.2, bow: 0, nick: 0, ink: 'warm' }, { len: 5.7, bow: 0.14, nick: 0, ink: 'sky' }, { len: 6.0, bow: -0.1, nick: 1, ink: 'sun' }, { len: 5.5, bow: 0.06, nick: 2, ink: 'leaf' }];
const TEE_HEAD = [[0, 1.35], [0.17, 1.38], [0.45, 1.2], [0.75, 0.9], [1.05, 0.62], [1.4, 0.45]];
function teeHalf(o, y) {
  const pts = TEE_HEAD.concat([[o.len * 0.45, 0.37], [o.len * 0.72, 0.3], [o.len * 0.93, 0.15], [o.len, 0]]);
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const [y0, w0] = pts[i - 1], [y1, w1] = pts[i]; return lerp(w0, w1, (y - y0) / (y1 - y0 || 1)); }
  return 0;
}
function teeSprite(u, dpr, v) {
  return keep(`tee:${look.name}:${u.toFixed(2)}:${dpr}:${v}`, () => {
    const o = TEE[v], pad = 3, w = Math.ceil(2.8 * u + pad * 2 + 3), h = Math.ceil((o.len + 0.5) * u + pad * 2 + 2), ox = w / 2, ry = pad + 0.45 * u;
    const s = surface(w, h, dpr), P = (a, b) => [ox + a * u, ry + b * u];
    const bowAt = (y) => o.bow * Math.sin((Math.max(0, y - 1.3) / (o.len - 1.3)) * Math.PI * 0.9);
    const ys = [0, 0.17, 0.45, 0.75, 1.05, 1.4]; for (let k = 1; k <= 9; k++) ys.push(1.4 + ((o.len * 0.94 - 1.4) * k) / 9); ys.push(o.len);
    const side = (sg) => ys.map((y) => P(sg * teeHalf(o, y) + bowAt(y), y));
    const R = side(1), L = side(-1), sil = R.concat(L.slice().reverse().slice(0, -1)), all = path(sil, true);
    const cupEnd = 5;                                                      // ys[5] = 1.4: the cup and its bell
    const head = path(R.slice(0, cupEnd + 1).concat(L.slice(0, cupEnd + 1).reverse()), true);
    const fillAll = (c) => { c.fill(all); };
    const plates = {
      sky: (c) => {
        if (o.ink === 'sky') { c.fill(all); return; }
        // the contact shadow: the tee's outline moved right and down, with the tee itself cut out of it
        c.save(); c.globalAlpha = 0.34; c.translate(1.7, 1.4); c.fill(all); c.restore();
        c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fill(all); c.restore();
        // the green is the blue thinned over the yellow
        if (o.ink === 'leaf' && !look.leaf) { c.save(); c.globalAlpha = 0.7; c.fill(all); c.restore(); }
      },
      key: (c, ink) => {
        const lw = Math.max(1, u * 0.24), rim = (k) => Array.from({ length: 13 }, (_, q) => P(1.35 * Math.cos((q / 12) * TAU), 0.3 * Math.sin((q / 12) * TAU) * (o.nick === 1 && q > 7 ? 0.6 : 1) + (k || 0)));
        // the cup's concavity: the far wall seen over the lip, a dark crescent under the back of the rim
        c.save(); c.globalAlpha = 0.85; c.beginPath(); c.ellipse(ox, ry + 0.02 * u, 1.22 * u, 0.25 * u, 0, 0, TAU); c.ellipse(ox, ry + 0.15 * u, 1.18 * u, 0.2 * u, 0, 0, TAU); c.fill('evenodd'); c.restore();
        crayon(c, rim(0), { w: lw * 0.85, color: ink, seed: 3 + v });
        // the right side, the tip and the left shaft run full; the lit left of the cup is broken
        crayon(c, R.slice(0, -1).concat([P(bowAt(o.len), o.len)]), { w: lw, color: ink, seed: 8 + v, wobble: 0.35 });
        crayon(c, L.slice(2, 7), { w: lw * 0.8, color: ink, seed: 18 + v, alpha: 0.45, wobble: 0.3 });
        crayon(c, L.slice(7).concat([P(bowAt(o.len), o.len)]), { w: lw * 0.85, color: ink, seed: 21 + v, alpha: 0.9, wobble: 0.3 });
        crayon(c, [L[0], L[1]], { w: lw * 0.8, color: ink, seed: 28 + v, alpha: 0.9 });
        // one shade line down the shaft on the side away from the light, and grain ticks across it
        crayon(c, [P(0.1 + bowAt(2.4), 2.1), P(0.09 + bowAt(o.len * 0.75), o.len * 0.78)], { w: Math.max(0.7, u * 0.15), color: ink, seed: 38 + v, alpha: 0.85 });
        [0.55, 0.68, 0.8].forEach((f, q) => { const y = o.len * f; crayon(c, [P(-0.12 + bowAt(y), y), P(0.1 + bowAt(y), y + 0.12)], { w: Math.max(0.6, u * 0.1), color: ink, seed: 60 + q + v, alpha: 0.5, wobble: 0.1 }); });
        if (o.nick === 1) crayon(c, [P(0.7, 0.62), P(0.95, 0.8)], { w: lw * 0.6, color: ink, seed: 48, alpha: 0.7 });
      },
    };
    if (o.ink === 'warm') plates.warm = (c) => { c.fill(all); if (o.nick === 2) { c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(...P(1.3, 0.1), u * 0.22, 0, TAU); c.fill(); } };
    if (o.ink === 'sun') plates.sun = fillAll;
    if (o.ink === 'leaf') { if (look.leaf) plates.leaf = fillAll; else plates.sun = fillAll; }
    print(s, plates, { seed: 40 + v, paper: false, reg: 0.55 });
    // after the drums, bare paper: a band round the neck, a glint on the lit side of the bell
    const c = s.ctx; c.save();
    crayon(c, [P(-teeHalf(o, 1.75) + bowAt(1.75) - 0.02, 1.75), P(teeHalf(o, 1.75) + bowAt(1.75) + 0.02, 1.8)], { w: Math.max(1, u * 0.3), color: look.paper, seed: 70 + v, alpha: 0.95, wobble: 0.15 });
    crayon(c, [P(-1.05, 0.36), P(-0.8, 0.66), P(-0.5, 0.95)], { w: Math.max(0.8, u * 0.2), color: look.paper, seed: 74 + v, alpha: 0.85, wobble: 0.15 });
    c.restore();
    return { cv: s.cv, w, h, ox, oy: ry + 0.45 * u, u, len: o.len };
  });
}

// The hopper is the balloon's basket, printed with the recipe scene.js uses for it (a pale wicker
// body, a navy label panel, a key rim and weave) at the size the machine needs. bakeBalloon at
// that size costs 375 ms on a phone for a basket 31 px wide, so the basket alone is printed. The
// sun and the warm drums are kept off the label so it prints navy (sky and key over bare paper),
// the wicker holds a quarter of the sun, four key posts stand at the corners and a golf ball
// is printed on the label.
function basketSprite(width, dpr) {
  return keep(`basket:${look.name}:${Math.round(width)}:${dpr}`, () => {
    const w = Math.round(width), h = Math.round(width * 0.74), s = surface(w, h, dpr), P = 2.3, box = { x0: 0, y0: 0, x1: w, y1: h };
    const lx0 = w * 0.27, lx1 = w * 0.73, ly0 = h * 0.2, ly1 = h * 0.84;
    const body = path([[0, 0], [w, 0], [w * 0.95, h], [w * 0.05, h]]), label = path([[lx0, ly0], [lx1, ly0], [lx1 - w * 0.01, ly1], [lx0 + w * 0.01, ly1]]);
    // the wicker is the body with the label cut out: the label runs the other way round, so a nonzero clip leaves a hole
    const wick = new Path2D(); wick.addPath(body); wick.addPath(path([[lx0, ly0], [lx0 + w * 0.01, ly1], [lx1 - w * 0.01, ly1], [lx1, ly0]]));
    s.ctx.fillStyle = look.paper; s.ctx.fill(body);
    const post = (c, x0, x1, seed, wd) => crayon(c, [[x0, 0], [(x0 + x1) / 2, h * 0.5], [x1, h]], { w: wd, color: c.strokeStyle, seed, wobble: 0.3 });
    print(s, {
      sun: (c, ink) => screen(c, box, P, tone('sun'), () => 0.25, ink, wick),
      sky: (c, ink) => screen(c, box, P * 0.8, tone('sky'), () => 0.7, ink, label),
      warm: (c, ink) => screen(c, box, P, tone('warm'), () => 0.3, ink, wick),
      key: (c, ink) => {
        screen(c, box, P * 0.7, tone('key'), () => 0.09, ink, wick); screen(c, box, P * 0.7, tone('key'), () => 0.38, ink, label);
        // the weave runs between the posts and stops at the label
        for (let k = 1; k < 4; k++) { const y = (h * k) / 4; [[w * 0.02, lx0], [lx1, w * 0.98]].forEach(([a, b], q) => crayon(c, [[a, y], [b, y]], { w: 0.7, color: ink, seed: 430 + k * 2 + q, alpha: 0.55, wobble: 0.3 })); }
        for (let k = 1; k < 7; k++) { const x = (w * k) / 7; if (x > lx0 - 1 && x < lx1 + 1) continue; crayon(c, [[x, h * 0.12], [x - w * 0.01, h]], { w: 0.6, color: ink, seed: 440 + k, alpha: 0.4, wobble: 0.3 }); }
        // four corner posts: the two outer edges of the basket and the two that frame the label
        post(c, w * 0.012, w * 0.058, 460, 2.4); post(c, w * 0.988, w * 0.942, 461, 2.4); post(c, w * 0.18, w * 0.2, 462, 1.9); post(c, w * 0.82, w * 0.8, 463, 1.9);
        c.fillRect(-0.5, 0, w + 1, 3);
        crayon(c, [[0, 1.5], [w * 0.5, 1.7], [w, 1.5]], { w: 1.3, color: ink, seed: 464 });
        crayon(c, [[w * 0.05, h - 0.8], [w * 0.5, h - 0.6], [w * 0.95, h - 0.8]], { w: 1.5, color: ink, seed: 465 });
        crayon(c, [[lx0, ly0], [lx1, ly0], [lx1 - w * 0.01, ly1], [lx0 + w * 0.01, ly1]], { w: 1.2, color: ink, seed: 466, close: true });
      },
    }, { seed: 17, paper: false, reg: 0.5 });
    // after the drums: a golf ball on the label, bare paper with a key outline and dimples
    const c = s.ctx, bx = w / 2, by = (ly0 + ly1) / 2 + 1, br = Math.min((lx1 - lx0) * 0.3, (ly1 - ly0) * 0.34);
    c.fillStyle = look.paper; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
    c.strokeStyle = look.key; c.lineWidth = Math.max(1, br / 5); c.beginPath(); c.arc(bx, by, br - c.lineWidth / 2, 0, TAU); c.stroke();
    c.fillStyle = look.key; c.globalAlpha = 0.55; [[-0.35, -0.3], [0.1, -0.45], [-0.45, 0.15], [0.3, 0.05], [-0.05, 0.35]].forEach(([a, b]) => { c.beginPath(); c.arc(bx + a * br, by + b * br, Math.max(0.5, br * 0.1), 0, TAU); c.fill(); }); c.globalAlpha = 1;
    return { cv: s.cv, w, h };
  });
}
// the balloon's coral mouth: the skirt the cables hang from, a key outline, gore lines, a ring at its lower edge
function mouthSprite(width, dpr) {
  return keep(`mouth:${look.name}:${Math.round(width)}:${dpr}`, () => {
    const w = Math.round(width), h = 17, s = surface(w, h, dpr), b = w * 0.2, P = 2.3, box = { x0: 0, y0: 0, x1: w, y1: h };
    const skirt = path([[0, 0], [w, 0], [w - b, h - 2], [b, h - 2]]);
    s.ctx.fillStyle = look.paper; s.ctx.fill(skirt);
    print(s, {
      warm: (c, ink) => { c.fill(skirt); },
      key: (c, ink) => {
        screen(c, box, P * 0.7, tone('key'), (x) => 0.12 + 0.18 * Math.abs(x / w - 0.5), ink, skirt);
        for (let k = 1; k < 5; k++) { const f = k / 5; crayon(c, [[w * f, 0], [lerp(w * f, b + (w - 2 * b) * f, 1), h - 2]], { w: 0.9, color: ink, seed: 480 + k, alpha: 0.6, wobble: 0.2 }); }
        crayon(c, [[0, 0], [b, h - 2]], { w: 1.7, color: ink, seed: 485 }); crayon(c, [[w, 0], [w - b, h - 2]], { w: 1.7, color: ink, seed: 486 });
        crayon(c, [[b, h - 1.5], [w * 0.5, h - 1.2], [w - b, h - 1.5]], { w: 2.6, color: ink, seed: 487 });
      },
    }, { seed: 19, paper: false, reg: 0.5 });
    return { cv: s.cv, w, h, b };
  });
}

// ── the lucky number machine ─────────────────────────────────────────────────
// A Galton quincunx: ten cups, even rows of ten tees at (j+0.5) gaps, odd rows of nine at j gaps,
// so the last row sits on the cup dividers and every cup is a funnel.
const BINS = 10;
function galton(W, H) {
  const m = 9, x0 = m, bw = W - 2 * m, gap = bw / BINS, k = W / 353;
  const u = gap * 0.115, r = gap * 0.31, cr = u * 1.1;                  // the ball is the hero: nearly two tee heads across
  const skyB = m + Math.round(H * 0.2), turfH = Math.round(H * 0.17), turfTop = H - m - turfH;
  const y1 = skyB + gap * 0.62, ideal = gap * 0.82, span = turfTop - ideal * 0.95 - y1;
  const n = 2 * Math.max(3, Math.round((span / ideal + 1) / 2)), pitch = span / (n - 1);
  const R = rng(5), pegs = []; let hole = null;
  for (let i = 0; i < n; i++) {
    const odd = i % 2, y = y1 + i * pitch;
    for (let j = odd ? 1 : 0; j < BINS; j++) {
      const bx = x0 + (odd ? j : j + 0.5) * gap, mj = odd ? BINS - j : BINS - 1 - j;
      if (i === 4 && j === 9) { hole = { x: bx, y }; continue; }
      // the jitter mirrors across the board, so the odds do not lean
      const q = rng(1000 + i * 20 + Math.min(j, mj)), sg = j <= mj ? 1 : -1, x = bx + sg * (q() - 0.5) * 2, yy = y + (q() - 0.5) * 3;
      // each tee leans a little away from the middle and a little of its own accord (plus or minus 12 degrees); the lean is only drawn, the physics are the peg
      pegs.push({ x, y: yy, row: i, col: clamp(Math.round((bx - x0) / gap - 0.5), 0, BINS - 1), v: 1 + Math.floor(R() * 29), tilt: ((x - W / 2) / W) * 24 * DEG + (R() - 0.5) * 24 * DEG, variant: Math.floor(R() * 4), hitT: -9, ws: 1, wa: 10 * DEG, wT: -9, popT: -9, last: -9 });
    }
  }
  const cupY = turfTop + turfH * 0.56;
  return { kick: 4, e: 0.55, rel: 7, rx: 0.5, g: 0.26 * (0.9 + 0.1 * (n - 8)), thr: 1.4, W, H, m, x0, bw, gap, k, r, u, cr, skyB, turfH, turfTop, cupY, cupRx: gap * 0.36, restY: cupY - r * 0.25, y1, pitch, n, pegs, hole, lastY: y1 + (n - 1) * pitch, xl: x0 + r + 1.5, xr: x0 + bw - r - 1.5, rc: r + cr + 3 };
}
function newBall(M, seed, x, y) {
  const q = rng(seed);
  return { x: x ?? M.W / 2 + (q() - 0.5) * M.gap * (M.rx ?? 0.5), y: y ?? M.skyB - 24, vx: (q() - 0.5) * 2 * (M.rel ?? 0.55) * M.k, vy: 0, r: M.r, ang: 0, spin: 0, sum: 0, hits: 0, t: 0, rng: q, slot: -1, landed: false, slow: 0 };
}
// One physics step of f 60-Hz frames (f <= 1). Hits above a small speed are reported.
function stepBall(b, M, f, onHit) {
  const g = (M.g ?? 0.2) * M.k; b.t += f / 60;
  b.vy += g * f; b.vx *= Math.pow(0.997, f); b.x += b.vx * f; b.y += b.vy * f; b.ang += (b.vx / b.r) * f + b.spin * f; b.spin *= Math.pow(0.97, f);
  if (b.x < M.xl) { b.x = M.xl; b.vx = Math.abs(b.vx) * 0.55; } else if (b.x > M.xr) { b.x = M.xr; b.vx = -Math.abs(b.vx) * 0.55; }
  for (const p of M.pegs) {
    const dy = b.y - p.y; if (dy > M.rc || dy < -M.rc) continue;
    const dx = b.x - p.x, d2 = dx * dx + dy * dy, m = b.r + M.cr;
    if (d2 < m * m && d2 > 1e-6) {
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
      b.x = p.x + nx * m; b.y = p.y + ny * m;
      if (vn < 0) {
        const e1 = 1 + (M.e ?? 0.55); b.vx -= e1 * vn * nx; b.vy -= e1 * vn * ny; if (-vn > (M.kthr ?? 1.2) * M.k) b.vx += (b.rng() - 0.5) * (M.kick ?? 0.9) * M.k; b.spin += -nx * 0.05 * Math.sign(b.vy || 1);
        if (-vn > (M.thr ?? 0.8) * M.k && b.t - p.last > 0.09) { p.last = b.t; b.sum += p.v; b.hits++; onHit && onHit(p, -vn, Math.sign(dx) || 1); }
      }
    }
  }
  // a ball that has all but stopped on the pegs is jostled, as a real board is tapped: by time, not by step
  if (b.y < M.lastY && Math.hypot(b.vx, b.vy) < 0.4 * M.k) { b.slow += f / 60; if (b.slow > 0.3) { b.slow = 0; b.vx += (b.rng() - 0.5) * 4 * M.k; b.vy -= 0.8 * M.k; } } else b.slow = 0;
  if (b.y > M.lastY + 2) {
    const k = clamp(Math.floor((b.x - M.x0) / M.gap), 0, BINS - 1), lo = M.x0 + k * M.gap + b.r + 1.5, hi = M.x0 + (k + 1) * M.gap - b.r - 1.5;
    if (b.x < lo) { b.x = lo; b.vx = Math.abs(b.vx) * 0.4; } else if (b.x > hi) { b.x = hi; b.vx = -Math.abs(b.vx) * 0.4; }
  }
  if (b.y >= M.restY) {
    b.y = M.restY;
    if (b.vy > 1.3 * M.k) { b.vy *= -0.3; b.vx *= 0.8; } else { b.vy = 0; b.landed = true; b.slot = clamp(Math.floor((b.x - M.x0) / M.gap), 0, BINS - 1); }
  }
  return b.landed;
}
// along the turf to the cup's middle; true when it is there and still
function rollStep(b, M, f) {
  const cx = M.x0 + (b.slot + 0.5) * M.gap;
  b.vx = (b.vx + (cx - b.x) * 0.014 * f) * Math.pow(0.86, f); b.x += b.vx * f; b.ang += (b.vx / b.r) * f;
  return Math.abs(cx - b.x) < 0.8 && Math.abs(b.vx) < 0.06;
}
// the machine's physics step in 60-Hz frames: fixed, so a 120-Hz phone and a 60-Hz one see the same ball
const STEP = 0.5;
const numberOf = (slot, sum) => slot * 30 + 1 + (sum % 30);
// the whole run at once: the reduced-motion machine, and the way the odds are checked
function simulate(M, seed, f = STEP, x0) {
  M.pegs.forEach((p) => (p.last = -9));
  const b = newBall(M, seed, x0), trace = [], pings = []; let n = 0;
  while (!stepBall(b, M, f, (p) => pings.push(p)) && n++ < 9000 / f) if (n % Math.round(3 / f) === 0) trace.push([b.x, b.y]);
  const cx = M.x0 + (b.slot + 0.5) * M.gap; b.x = cx; b.vx = 0;
  return { b, trace, pings, frames: n, slot: b.slot, sum: b.sum, n: numberOf(Math.max(0, b.slot), b.sum) };
}

// ── the ticket ───────────────────────────────────────────────────────────────
// A perforated stub, three digit wheels on a sun burst, 'No.' small. Painted at its own centre with
// its own size, so the page and the share card print the same ticket: e is the seconds since the wheels
// began to turn, still holds them on the number.
function ticketBody(c, w2, h2, th) {
  const rr = 7;
  c.beginPath(); c.moveTo(-w2 + rr, -h2); c.lineTo(w2 - rr, -h2); c.arcTo(w2, -h2, w2, -h2 + rr, rr); c.lineTo(w2, h2 - rr); c.arcTo(w2, h2, w2 - rr, h2, rr); c.lineTo(-w2 + rr, h2);
  const n = Math.max(5, Math.round(th / 15)), st = (th - 2 * rr) / n;
  for (let q = 0; q < n; q++) { const cy = h2 - rr - st * (q + 0.5); c.lineTo(-w2, cy + 3.2); c.arc(-w2, cy, 3.2, Math.PI / 2, -Math.PI / 2, true); }
  c.lineTo(-w2, -h2 + rr); c.arcTo(-w2, -h2, -w2 + rr, -h2, rr); c.closePath();
}
function paintTicket(c, { tw, th, n, e = 9, start = [0, 0, 0], still = false }) {
  const w2 = tw / 2, h2 = th / 2, stub = Math.min(30, tw * 0.13), body = () => ticketBody(c, w2, h2, th);
  // the warm drum's copy of the ticket, offset, then the paper
  c.save(); c.globalCompositeOperation = 'multiply'; c.translate(3, 2.5); c.fillStyle = look.warm; body(); c.fill(); c.restore();
  c.fillStyle = look.paper; body(); c.fill();
  c.save(); body(); c.clip();
  const D = String(n).length, fsz = Math.min(56, th * 0.6), cw = fsz * 0.62, cx0 = stub / 2, mid = (cx0 + w2) / 2 - w2 / 2 + 6;
  // the burst behind the number, on the sun drum
  c.save(); c.globalCompositeOperation = 'multiply'; c.translate(OFF.sun[0] + mid, OFF.sun[1] + 2); c.fillStyle = look.sun; c.globalAlpha = 0.95;
  for (let q = 0; q < 16; q++) { const a = (q / 16) * TAU + 0.2, a2 = a + 0.14; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * th * 0.9, Math.sin(a) * th * 0.9); c.lineTo(Math.cos(a2) * th * 0.9, Math.sin(a2) * th * 0.9); c.closePath(); c.fill(); }
  c.beginPath(); c.arc(0, 0, th * 0.34, 0, TAU); c.fill(); c.restore();
  // the digit wheels: each rolls ten ticks and more, the hundreds first
  const digs = String(n).split('').map(Number);
  c.font = `800 ${fsz}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  digs.forEach((dg, i) => {
    const cx = mid + (i - (D - 1) / 2) * cw, u0 = clamp((e - 0.06 - i * 0.1) / 0.55), s0 = start[i], ticks = 10 + ((dg - s0 + 10) % 10), v = still ? dg : s0 + ticks * ease.out(u0), d0 = Math.floor(v) % 10, fr = v - Math.floor(v), cellH = fsz * 1.02;
    c.save(); c.beginPath(); c.rect(cx - cw / 2, -cellH * 0.62, cw, cellH * 1.24); c.clip();
    for (const [dd, dy] of [[d0, -fr * cellH], [(d0 + 1) % 10, (1 - fr) * cellH]]) {
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = look.warm; c.fillText(dd, cx + 2.2, dy + 2.4 + fsz * 0.04); c.restore();
      c.fillStyle = look.key; c.fillText(dd, cx, dy + fsz * 0.04);
    }
    c.restore();
  });
  // the stub: a cut line of dots and 'No.' set small
  c.fillStyle = look.key; c.globalAlpha = 0.7; for (let q = -h2 + 6; q < h2 - 3; q += 6) { c.beginPath(); c.arc(-w2 + stub, q, 1, 0, TAU); c.fill(); }
  c.globalAlpha = 1; c.save(); c.translate(-w2 + stub * 0.5 + 2, 0); c.rotate(-Math.PI / 2); c.font = `800 ${Math.round(clamp(th * 0.13, 9, 12))}px ${FONT}`; c.fillText('No.', 0, 0); c.restore();
  c.restore();
  c.strokeStyle = look.key; c.lineWidth = 2.4; c.lineJoin = 'round'; body(); c.stroke();
}
// a little eighth note in key with a paper edge, for the tees and pennants that are tapped
function drawNote(c, x, y, a, k = 0) {
  c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate((k % 2 ? 0.12 : -0.12));
  for (const pass of [0, 1]) {
    c.strokeStyle = pass ? look.key : look.paper; c.fillStyle = pass ? look.key : look.paper; c.lineWidth = pass ? 1.8 : 5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.ellipse(-2.5, 6, 3.6, 2.7, -0.4, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0.7, 5.3); c.lineTo(0.7, -8); c.quadraticCurveTo(5.5, -5.5, 5.2, -0.5); c.stroke();
  }
  c.restore();
}

export function luck() {
  const cv = $('luck-cv'), out = $('luck-out'), go = $('luck-go');
  if (!cv) return;
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0, M = null, bg = null, baked = false, hop = null, mouth = null, cloud = null, sprites = [], fallen = null;
  let S = 'idle', ball = null, trace = [], lastTrace = 0, ticket = null, swing = null, flags = [], twitch = 0, pendingBake = false;
  let run = false, vis = true, prev = 0, tally = null, zones = {}, speaker = null;
  let hx = 0, hxT = 0, aim = null, suppress = -1e9, notes = [];
  let tapT0 = -1, ghost = null, ghostAt = 0;                 // when the machine was first in view, the basket's one demonstration drag, when it may start

  function size() { const r = cv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height); if (!w || !h) return false; const ch = w !== W || h !== H; W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ch || true; }
  // until it is baked: a flat sheet of paper with the key border
  function flat() { ctx.fillStyle = look.paper; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = look.key; ctx.lineWidth = 3; ctx.strokeRect(10.5, 10.5, W - 21, H - 21); }
  function bake() {
    if (!size()) return;
    performance.mark('gbd:luck-bake-start');
    M = galton(W, H); const { x0, bw, gap, m, skyB, turfTop, turfH, cupY, r, u, cupRx, n, y1, pitch } = M;
    const bwid = r * 4.4;
    hop = basketSprite(bwid, dpr); mouth = mouthSprite(bwid * 0.9, dpr);
    M.hopW = bwid; M.py = m + mouth.h - 3; M.len = Math.max(16, skyB + 3 - hop.h - M.py);
    M.fs = Math.round(clamp(gap * 0.28, 8, 17)); M.fw = clamp(gap * 0.66, 18, 46); M.fh = M.fs * 2 + 3;
    sprites = [0, 1, 2, 3].map((v) => teeSprite(u, dpr, v));
    cloud = bakeCloud(clamp(bw * 0.13, 28, 54), 3, dpr);
    bg = surface(W, H, dpr);
    const box = { x0: 0, y0: 0, x1: W, y1: H }, P = 5.6, face = new Path2D(); face.roundRect(x0, m, bw, H - 2 * m, 10);
    const edge = (x) => turfTop + Math.sin(x * 0.09 + 1) * 1.6 + Math.sin(x * 0.23) * 0.8;
    const plates = {
      sky: (c, ink) => {
        // the sky the basket hangs in, thinning toward the pegs; below it the pegboard's own tint, a screen at 0.06
        screen(c, box, P, tone('sky'), (x, y) => (y < skyB ? 0.4 - 0.22 * ((y - m) / (skyB - m)) : y < skyB + 30 ? 0.18 * (1 - (y - skyB) / 30) : 0), ink, face);
        screen(c, box, 4.4, tone('sky') + 8, (x, y) => (y > skyB + 14 && y < edge(x) - 2 ? 0.06 * clamp((y - skyB - 14) / 20) : 0), ink, face);
      },
      warm: (c, ink) => {
        // the board's offset copy, like the page's cards: only what sticks out past the board
        c.save(); const o = new Path2D(); o.rect(0, 0, W, H); o.addPath(face); c.clip(o, 'evenodd');
        c.beginPath(); c.roundRect(x0 + 4, m + 3.5, bw, H - 2 * m, 10); c.fill(); c.restore();
      },
      key: (c, ink) => {
        c.lineWidth = 3; c.lineJoin = 'round'; c.stroke(face);
        c.save(); c.clip(face);
        // the pegboard's drill holes: every site of the lattice a tee is not standing in
        c.save(); c.globalAlpha = 0.62;
        for (let i = 0; i < n; i++) for (let kk = 1; kk < 20; kk++) { if (kk % 2 !== i % 2) continue; c.beginPath(); c.arc(x0 + (kk * gap) / 2, y1 + i * pitch, 1.3, 0, TAU); c.fill(); }
        c.restore();
        // each cup is a funnel: dividers from the last tees to the turf's front lip
        for (let k = 1; k < BINS; k++) crayon(c, [[x0 + k * gap, M.lastY + M.cr * 0.7], [x0 + k * gap + (k % 2 ? 0.4 : -0.3), turfTop + turfH * 0.9], [x0 + k * gap, turfTop + turfH]], { w: 2, color: ink, seed: 30 + k, wobble: 0.5 });
        // the turf's back edge, with its grass: hand-placed drifts and bare rests
        const gr = rng(77); const edgePts = []; for (let x = x0; x <= x0 + bw + 4; x += 6) edgePts.push([x, edge(x)]);
        crayon(c, edgePts, { w: 1.6, color: ink, seed: 61, wobble: 0.7 });
        for (let x = x0 + 4; x < x0 + bw - 2;) {
          if (gr() < 0.2) { x += 9 + gr() * 16; continue; }                 // a bare rest
          const n = 1 + Math.floor(gr() * 3);
          for (let q = 0; q < n; q++) { const bx = x + q * 2.6, hh = 2.5 + gr() * 4.5, lean = (gr() - 0.5) * 3; crayon(c, [[bx, edge(bx) + 0.5], [bx + lean, edge(bx) - hh]], { w: 1, color: ink, seed: 100 + Math.floor(bx), alpha: 0.85 }); }
          x += 7 + gr() * 7;
        }
        // the cups: dark ovals cut into the turf, a lip, and a flag pole beside each
        for (let k = 0; k < BINS; k++) {
          const cx = x0 + (k + 0.5) * gap, rx = cupRx, ry = rx * 0.4;
          c.beginPath(); c.ellipse(cx, cupY, rx, ry, 0, 0, TAU); c.fill();
          crayon(c, Array.from({ length: 17 }, (_, q) => [cx + (rx + 1.6) * Math.cos((q / 16) * TAU), cupY + (ry + 1.2) * Math.sin((q / 16) * TAU)]), { w: 1.3, color: ink, seed: 200 + k, alpha: 0.8 });
          const px = x0 + k * gap + gap * 0.22; crayon(c, [[px, cupY + 3], [px + 0.4, cupY - turfH * 0.5]], { w: 1.5, color: ink, seed: 300 + k });
        }
        // the tee that was pulled from row four leaves its hole
        if (M.hole) { c.beginPath(); c.ellipse(M.hole.x, M.hole.y + 1, u * 0.55, u * 0.3, 0, 0, TAU); c.globalAlpha = 0.8; c.fill(); }
        c.restore();
      },
    };
    greens(plates, (c, ink, k) => screen(c, box, P, tone(ink) + 5, (x, y) => (y < edge(x) ? 0 : (0.66 + 0.12 * Math.sin(x * 0.05)) * k), inkOf(ink), face));
    print(bg, plates, { seed: 21, reg: 0.8 });
    // after the drums: paper left bare, the way the chalk is. A lip of paper under each cup
    const c = bg.ctx; c.save(); c.globalAlpha = 0.85;
    for (let k = 0; k < BINS; k++) { const cx = x0 + (k + 0.5) * gap, rx = cupRx, ry = rx * 0.4; crayon(c, Array.from({ length: 8 }, (_, q) => { const a = 0.15 * Math.PI + (q / 7) * 0.7 * Math.PI; return [cx + rx * Math.cos(a), cupY + ry * Math.sin(a) + 1.5]; }), { w: 1.3, color: look.paper, seed: 400 + k }); }
    c.restore();
    // the tee that fell over lies on the turf's back edge between two cups; it is live, so a tap can roll it
    fallen = { x: x0 + 6 * gap + 15, y: edge(x0 + 6 * gap) - 4, ang: 86 * DEG, side: 1, roll: null };
    flags = Array.from({ length: BINS }, (_, k) => ({ x: x0 + k * gap + gap * 0.22, y: cupY - turfH * 0.5, ph: k * 1.7 + (k % 3) * 0.6, lo: k * 30 + 1, hi: (k + 1) * 30, fT: -1e9 }));
    baked = true; trace = []; ball = null; S = 'idle'; ticket = null; tally = null; notes = []; hx = hxT = W / 2; aim = null;
    performance.mark('gbd:luck-bake-end'); performance.measure('gbd:luck-bake', 'gbd:luck-bake-start', 'gbd:luck-bake-end');
    draw(performance.now());
  }
  function ensure() { if (!baked) { if (!size()) return false; bake(); } return baked; }

  // ── drawing ────────────────────────────────────────────────────────────────
  // the hopper rocks five degrees at 0.7 Hz on its cables, and swings out the way the ball goes
  const hopperAt = (now) => {
    const a = calm ? 0 : Math.sin((now / 1000) * TAU * 0.7) * 5 * DEG, sw = swing ? swing.a * Math.exp(-3.2 * (now - swing.t0) / 1000) * Math.sin(((now - swing.t0) / 1000) * 11) : 0;
    return { ang: a + sw, px: hx, py: M.py, len: M.len };
  };
  // where the fallen tee's head and tip are, and its tip as the pivot it rolls round
  function fallenPose(now) {
    const f = fallen, L = sprites[0].len * M.u; let x = f.x, y = f.y, ang = f.ang;
    if (f.roll) {
      const k = ease.out((now - f.roll.t0) / f.roll.dur), d = f.roll.turn * k, tx = f.x - Math.sin(f.ang) * L, ty = f.y + Math.cos(f.ang) * L, cs = Math.cos(d), sn = Math.sin(d);
      x = tx + cs * (f.x - tx) - sn * (f.y - ty); y = ty + sn * (f.x - tx) + cs * (f.y - ty) - 6 * Math.sin(Math.PI * clamp(k * 1.3)); ang = f.ang + d;
    }
    return { x, y, ang, L };
  }
  // everything that is the picture, painted on any context: the page draws it live, the share card once
  function paint(c, now, o = {}) {
    const t = now / 1000, { x0, gap, u, cr, r, m, bw, skyB } = M, still = calm || !!o.still;
    c.drawImage(bg.cv, 0, 0, W, H);
    // one paper cloud drifts through the sky behind the hopper
    // (it keeps to the right of the chalk 'TAP', and fades in as it comes from behind it)
    { const cw = cloud.w, lo = W * 0.34, span = W - lo + cw, cxp = still ? W * 0.6 : lo - cw + ((t * 7 + W * 0.3) % span);
      c.save(); c.beginPath(); c.rect(x0 + 2, m + 2, bw - 4, skyB - m - 8); c.clip(); c.globalAlpha = clamp((cxp + cw * 0.7 - lo) / 70); c.drawImage(cloud.cv, cxp, m + 16, cw, cloud.h); c.restore(); }
    // the path so far, a dotted warm crayon line that stays printed after the ball is down
    if (trace.length > 1) {
      c.save(); c.globalCompositeOperation = 'multiply'; c.strokeStyle = look.warm; c.globalAlpha = 0.85; c.lineWidth = 2.1; c.lineCap = 'round'; c.setLineDash([0.1, 5.2]);
      c.beginPath(); trace.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (ball && S === 'fall') c.lineTo(ball.x, ball.y); c.stroke(); c.restore();
    }
    // the cup the hopper is aimed at: its funnel tinted, its lip ringed
    if (!ball && !o.still && Math.abs(hx - W / 2) > 2) {
      const k = clamp(Math.floor((hx - x0) / gap), 0, BINS - 1), cx = x0 + (k + 0.5) * gap, yT = M.lastY + M.cr * 0.7, yB = M.turfTop + M.turfH * 0.9;
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = look.warm; c.globalAlpha = 0.17; c.fillRect(x0 + k * gap + 1, yT, gap - 2, yB - yT);
      c.globalAlpha = 0.85; c.strokeStyle = look.warm; c.lineWidth = 2.4; c.beginPath(); c.ellipse(cx, M.cupY, M.cupRx + 3, M.cupRx * 0.4 + 2.2, 0, 0, TAU); c.stroke(); c.restore();
    }
    // ripples under the tees that were hit
    if (!still) {
      c.save(); c.globalCompositeOperation = 'multiply'; c.strokeStyle = look.warm; c.lineWidth = 2;
      for (const p of M.pegs) { const a = (now - p.hitT) / 220; if (a >= 0 && a < 1) { c.globalAlpha = 0.6 * (1 - a); c.beginPath(); c.arc(p.x + OFF.warm[0] * 0.4, p.y + OFF.warm[1] * 0.4, cr * (1 + 1.2 * ease.out(a)), 0, TAU); c.stroke(); } }
      c.restore();
    }
    // the tee that fell over
    { const f = fallenPose(now), sp = sprites[0];
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = look.key; c.globalAlpha = 0.16; c.beginPath(); c.ellipse(f.x - Math.sin(f.ang) * f.L * 0.5 + 1.5, f.y + Math.cos(f.ang) * f.L * 0.5 + 3.4, f.L * 0.5, u * 0.5, f.ang - Math.PI / 2, 0, TAU); c.fill(); c.restore();
      c.save(); c.translate(f.x, f.y); c.rotate(f.ang); c.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h); c.restore(); }
    // the tees: each tilts a little of its own accord, and wobbles where it was hit
    for (const p of M.pegs) {
      const sp = sprites[p.variant], a = (now - p.wT) / 1000, wob = !still && a >= 0 && a < 0.9 ? p.wa * Math.sin(24 * a) * Math.exp(-7 * a) * p.ws : 0;
      c.save(); c.translate(p.x, p.y); c.rotate(p.tilt + wob); c.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h); c.restore();
    }
    // the value of a tee, shown for a moment when it is pinged
    c.save(); c.textAlign = 'center'; c.font = `800 ${Math.round(clamp(gap * 0.3, 10, 12))}px ${FONT}`; c.lineJoin = 'round';
    for (const p of M.pegs) {
      const a = now - p.popT; if (a < 0 || a > 650) continue;
      const k = still ? 1 : ease.back(a / 140), y = p.y - cr - 5 - (still ? 0 : 7 * ease.out(a / 260)), q = a > 480 ? 1 - (a - 480) / 170 : 1;
      c.globalAlpha = q; c.lineWidth = 3.5; c.strokeStyle = look.paper; c.fillStyle = look.key; c.save(); c.translate(p.x, y); c.scale(k, k); c.strokeText('+' + p.v, 0, 0); c.fillText('+' + p.v, 0, 0); c.restore();
    }
    c.restore();
    // a note that rises from a tee or a pennant that was tapped
    for (const nt of notes) { const a = (now - nt.t0) / 900; if (a < 0 || a > 1) continue; drawNote(c, nt.x + (still ? 0 : Math.sin(a * 7) * 3), nt.y - (still ? 0 : 20 * ease.out(a)), 1 - clamp((a - 0.6) / 0.4), nt.k); }
    // pennants on the cups, their range on two lines; a tap flutters one at four times the wave for 600 ms
    c.save(); const fs = M.fs, fw = M.fw, fh = M.fh;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${fs}px ${FONT}`;
    flags.forEach((f, k) => {
      const age = now - f.fT, fk = age >= 0 && age < 600 ? (age < 450 ? 4 : lerp(4, 1, (age - 450) / 150)) : 1;
      const wv = (a, x) => (still ? 0 : Math.sin(t * TAU * 0.8 + f.ph + x * 5) * a * fk);
      const top = [[0, 0], [fw * 0.5, wv(0.9, 0.5)], [fw, wv(1.5, 1)]], bot = [[fw, fh + wv(1.5, 1)], [fw * 0.5, fh + wv(0.9, 0.5)], [0, fh]];
      const poly = () => { c.beginPath(); top.concat(bot).forEach(([x, y], i) => (i ? c.lineTo(f.x + x, f.y + y) : c.moveTo(f.x + x, f.y + y))); c.closePath(); };
      c.globalAlpha = 1; c.fillStyle = look.paper; poly(); c.fill();
      c.save(); c.globalCompositeOperation = 'multiply'; c.translate(OFF.warm[0] * 0.6, OFF.warm[1] * 0.6); c.fillStyle = look.warm; c.globalAlpha = 0.92; poly(); c.fill(); c.restore();
      c.strokeStyle = look.key; c.lineWidth = 1.1; poly(); c.stroke();
      c.fillStyle = look.key; const mx = f.x + fw * 0.5 + 0.6; c.fillText(f.lo + '–', mx, f.y + fh * 0.3 + wv(0.5, 0.5)); c.fillText(f.hi + '', mx, f.y + fh * 0.72 + wv(0.5, 0.5));
    });
    c.restore();
    // the ball is behind the hopper, so it comes out of the bottom of it: a world position, turning
    if (ball) {
      let by = ball.y, clipY = null;
      if (S === 'sink') { const k = ease.io((now - ball.sinkT) / 260); by = ball.y + k * r * 1.9; clipY = M.cupY + 1; }
      c.save(); if (clipY !== null) { c.beginPath(); c.rect(0, 0, W, clipY); c.clip(); }
      c.globalCompositeOperation = 'multiply'; c.fillStyle = look.key; c.globalAlpha = 0.14 * (S === 'fall' ? clamp(1 - (M.restY - ball.y) / 120) : 1); c.beginPath(); c.ellipse(ball.x + r * 0.35, M.cupY + r * 0.55, r * 0.95, r * 0.32, 0, 0, TAU); if (ball.y > M.lastY) c.fill();
      c.restore();
      c.save(); if (clipY !== null) { c.beginPath(); c.rect(0, 0, W, clipY); c.clip(); }
      if (S === 'fall' || S === 'roll') {
        // a sun-ink disc a half-ball wider than the ball, printed a little off, so it reads at a glance
        c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = look.sun; c.beginPath(); c.arc(ball.x + OFF.sun[0], by + OFF.sun[1], r * 1.5, 0, TAU); c.fill(); c.restore();
        // and three fading arcs behind it, the way a bounce is drawn
        const sp = Math.hypot(ball.vx, ball.vy);
        if (S === 'fall' && sp > 1.1 * M.k) {
          const ux = ball.vx / sp, uy = ball.vy / sp, back = Math.atan2(-uy, -ux);
          c.save(); c.strokeStyle = look.key; c.lineCap = 'round';
          for (let q = 1; q <= 3; q++) { c.globalAlpha = 1.05 - 0.27 * q; c.lineWidth = 3.1 - 0.6 * q; c.beginPath(); c.arc(ball.x - ux * (q + 0.55) * r * 0.78, by - uy * (q + 0.55) * r * 0.78, r * (1.0 - 0.1 * q), back - 0.85, back + 0.85); c.stroke(); }
          c.restore();
        }
      }
      drawRoll(c, rollBall(r, dpr), ball.x, by, ball.ang); c.restore();
    }
    // the cup's front lip over the ball as it goes in
    if (S === 'sink' && ball) { const cx = M.x0 + (ball.slot + 0.5) * gap, rx = M.cupRx, ry = rx * 0.4; c.save(); c.strokeStyle = look.key; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.ellipse(cx, M.cupY, rx + 1, ry + 0.6, 0, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke(); c.restore(); }
    // the hopper: the balloon's mouth, cables, the waiting ball, the basket
    const h = hopperAt(now), rim = h.len, bwid = M.hopW;
    c.drawImage(mouth.cv, h.px - mouth.w / 2, m - 3, mouth.w, mouth.h);
    c.save(); c.translate(h.px, h.py); c.rotate(h.ang);
    const cx0 = mouth.w / 2 - mouth.b - 1;
    crayon(c, [[-cx0, 0], [-bwid * 0.46, rim + 1]], { w: 1.3, color: look.key, seed: 11 }); crayon(c, [[cx0, 0], [bwid * 0.46, rim + 1]], { w: 1.3, color: look.key, seed: 12 });
    if (!ball) {
      // the waiting ball hops every 2.4 s, turning as it goes
      const ph = still ? 1 : (now % 2400) / 2400, hp = ph < 0.18 ? Math.sin((ph / 0.18) * Math.PI) : 0;
      c.save(); c.beginPath(); c.rect(-40, -10, 80, rim + 11.5); c.clip(); drawRoll(c, rollBall(r, dpr), 0, rim - r * 0.45 - hp * r * 0.9, 0.2 + hp * 0.9); c.restore();
    }
    c.drawImage(hop.cv, -bwid / 2, rim, bwid, hop.h);
    c.restore();
    // the chalk on the open paper, breathing, while the machine waits: 'TAP THE BASKET' for the first six seconds it is in view, then 'TAP';
    // once a ticket has come out, 'drag the basket to aim' until the basket has been dragged
    if (!ball && !o.still && (S === 'idle' || S === 'done') && Math.abs(hx - W / 2) < 4) {
      const aimHint = seen.drops > 0 && !seen.aimed, intro = !aimHint && (calm || tapT0 < 0 || now - tapT0 < 6000), thTop = hasLang('th');
      const k = still ? 1 : 1 + 0.06 * (0.5 + 0.5 * Math.sin(t * 2.6)), tx = W * 0.2, ty = M.skyB - 46;
      chalkWords(c, tx, ty, -6 * DEG, k, aimHint ? [['AIM', 27, 0], ['drag the basket', 12.5, 19], ['ลากเพื่อเล็ง', 17, thTop ? 25 : 39, true]]
        : intro ? [['TAP', 27, 0], ['THE BASKET', 12.5, 19], ['แตะตะกร้า', 17, thTop ? 25 : 39, true]] : [['TAP', 27, 0], ['แตะ', 18, 25, true]]);
      // the arrow ends on the basket's wicker, not beside it
      const ax = h.px - bwid * 0.4, ay = M.skyB + 3 - hop.h * 0.55;
      chalkArrow(c, [[tx + 30, ty - 2], [tx + 46, ty - 9], [tx + 60, ty - 4], [ax, ay]]);
      // and two chevrons either side of it, breathing outward, say it goes sideways
      if (aimHint) { const pu = still ? 0 : Math.max(0, Math.sin(t * 5)) * 3, yy = M.skyB + 3 - hop.h * 0.5, xl = h.px - bwid * 0.5 - 8 - pu, xr = h.px + bwid * 0.5 + 8 + pu; chalkLine(c, [[xl + 4, yy - 7], [xl - 3, yy], [xl + 4, yy + 7]], 1, 21); chalkLine(c, [[xr - 4, yy - 7], [xr + 3, yy], [xr - 4, yy + 7]], 1, 23); }
    }
  }
  function draw(now) {
    if (!baked) return;
    const c = ctx, { m } = M;
    c.clearRect(0, 0, W, H); notes = notes.filter((nt) => now - nt.t0 < 900);
    paint(c, now);
    // the tally: the running total of the tees pinged, then 'slot + pings'
    if (tally) chipAt(c, m + 8, m + 9, tally);
    drawSpeaker(c);
    if (ticket) drawTicket(c, now);
  }
  function drawSpeaker(c) { const x = W - M.m - 24, y = M.m + 20; speaker = { x, y, r: 22 }; paintSpeaker(c, x, y); }
  // the ticket: the shared one, slid out of the cup; Share and Drop it hang below
  function ticketPos(now) { const k = ticket.closing ? 1 - ease.io((now - ticket.tc) / 220) : ease.out((now - ticket.t0) / 450); return k; }
  const ticketBox = () => { const tw = W * 0.62, th = H * 0.2; return [W / 2 - tw / 2, M.turfTop - 44 - th, tw, th]; };
  function drawTicket(c, now) {
    const k = calm && !ticket.closing ? 1 : ticketPos(now);
    if (k <= 0.001) { if (ticket.closing) ticket = null; return; }
    const tw = W * 0.62, th = H * 0.2, fx = W / 2, fy = M.turfTop - 44 - th / 2, sx = M.x0 + (ticket.slot + 0.5) * M.gap, y = lerp(M.cupY, fy, k), x = lerp(sx, fx, k), sc = lerp(0.35, 1, k);
    c.save(); c.beginPath(); c.rect(0, 0, W, M.cupY + (k < 1 ? 2 : 400)); c.clip();
    c.translate(x, y); c.rotate(2 * DEG * k); c.scale(sc, sc);
    paintTicket(c, { tw, th, n: ticket.n, e: (now - ticket.t0) / 1000, start: ticket.start, still: calm });
    c.restore();
    // pills hang below, flat on the sheet
    if (k >= 0.999 && !ticket.closing) {
      const pw = [W * 0.27, W * 0.34], ph = 34, gp = 8, tot = pw[0] + pw[1] + gp, py = fy + th / 2 + 8, a = ease.back((now - ticket.t0 - 450) / 200);
      const px = [W / 2 - tot / 2, W / 2 - tot / 2 + pw[0] + gp];
      zones = { share: [px[0] - 4, py - 5, pw[0] + 8, ph + 10], drop: [px[1] - 4, py - 5, pw[1] + 8, ph + 10] };
      c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 14px ${FONT}`;
      [['share', t2('แชร์', 'Share'), look.paper, look.key], ['drop', t2('ทิ้งเลย', 'Drop it'), look.sun, '#000']].forEach(([id, label, fill, ink], i) => {
        c.save(); const cx = px[i] + pw[i] / 2, cy = py + ph / 2; c.translate(cx, cy + (1 - a) * 8); c.scale(a, a);
        c.fillStyle = look.key; c.beginPath(); c.roundRect(-pw[i] / 2 + 2.5, -ph / 2 + 2.5, pw[i], ph, 14); c.fill();
        c.fillStyle = fill; c.strokeStyle = look.key; c.lineWidth = 2.2; c.beginPath(); c.roundRect(-pw[i] / 2, -ph / 2, pw[i], ph, 14); c.fill(); c.stroke();
        c.fillStyle = ink; c.font = `800 ${/[฀-๿]/.test(label) ? 13 : 14}px ${/[฀-๿]/.test(label) ? THAI : FONT}`; c.fillText(label, 0, 1); c.restore();
      });
      c.restore();
    } else zones = {};
  }

  // ── the run ────────────────────────────────────────────────────────────────
  function onHit(p, speed, side) {
    const now = performance.now(); p.hitT = now; p.wT = now; p.popT = now; p.ws = -side; p.wa = 10 * DEG;
    if (!ball) return;
    tally = 'Σ ' + (ball.sum % 30);
    voice(784 * Math.pow(2, PENTA[p.col % 5] / 12 - p.row / 8), 0.16, 0.05);
    if (speed > 2) buzz(3);
  }
  function release() {
    if (!ensure()) return;
    if (S === 'fall' || S === 'roll' || S === 'sink' || S === 'ticket') return;
    wake();
    const now = performance.now();
    if (ticket && !ticket.closing) { ticket.closing = true; ticket.tc = now; if (calm) ticket = null; }
    M.pegs.forEach((p) => (p.last = -9));
    trace = []; lastTrace = 0; tally = 'Σ 0'; out.textContent = '…';
    if (ghost) { ghost = null; hxT = W / 2; } ghostAt = 0;
    hx = hxT; const seed = rand32();
    if (calm) {
      const sm = simulate(M, seed, STEP, Math.abs(hx - W / 2) > 2 ? hx : undefined); trace = sm.trace; ball = null; S = 'done'; hx = hxT = W / 2;
      ticket = { n: sm.n, slot: sm.slot, sum: sm.sum % 30, t0: 0, start: [0, 0, 0] }; land(ticket, true); return;
    }
    // the ball leaves the basket on the swing: out along the way the basket leans
    const h = hopperAt(now), d = h.len - M.r * 0.45;
    ball = newBall(M, seed, h.px - d * Math.sin(h.ang), h.py + d * Math.cos(h.ang));
    swing = { t0: now, a: 0.3 * (ball.vx < 0 ? -1 : 1) };
    S = 'fall'; kick();
  }
  // the ball is in the cup: a thunk, a buzz, a burst, and the number on its ticket
  function land(tk, quiet) {
    const r = cv.getBoundingClientRect(), n = tk.n; seen.drops++;
    tally = `${tk.slot * 30 + 1} + ${tk.sum}`; hxT = W / 2;
    voice(110, 0.12, 0.1, 'sine', 62); buzz(8);
    burst(r.left + M.x0 + (tk.slot + 0.5) * M.gap, r.top + M.cupY, 18, true);
    // the number is on the ticket, in #luck-out (a live region) and in #num: no toast over the picture
    const final = () => { out.textContent = n; const num = $('num'); if (num) num.value = n; };
    if (quiet) { final(); draw(performance.now()); return; }
    let spins = 0; const it = setInterval(() => { out.textContent = 1 + Math.floor(Math.random() * 300); if (++spins > 13) { clearInterval(it); final(); S = 'done'; ghostAt = performance.now() + 1500; if (pendingBake) { pendingBake = false; bake(); } kick(); } }, 50);
  }
  let acc = 0;
  function update(now, dt) {
    // time-based: a run takes the same seconds at any frame rate, a third faster than the physics were tuned at
    if (S === 'fall' || S === 'roll') {
      acc += Math.min(3, dt * 60 * 1.35); let guard = 0;
      while (acc >= STEP && guard++ < 14 && (S === 'fall' || S === 'roll')) {
        acc -= STEP;
        if (S === 'fall') { if (stepBall(ball, M, STEP, onHit)) S = 'roll'; } else if (rollStep(ball, M, STEP)) { S = 'sink'; ball.sinkT = now; }
      }
      if (S === 'fall' && now - lastTrace > 50) { lastTrace = now; trace.push([ball.x, ball.y]); }
    } else acc = 0;
    if (S === 'sink' && ball && now - ball.sinkT > 260) {
      ticket = { n: numberOf(ball.slot, ball.sum), slot: ball.slot, sum: ball.sum % 30, t0: now, start: [0, 1, 2].map(() => Math.floor(Math.random() * 10)) };
      S = 'ticket'; ball = null; land(ticket);
    }
    // the hopper follows a finger, then goes home to the middle
    // once, after the first ticket, the basket slides 44 px out and back by itself, so the funnel tint under it says it can be aimed
    if (ghost) { const k = (now - ghost.t0) / 1800; if (k >= 1 || S !== 'done' || aim) { ghost = null; hxT = W / 2; } else hxT = W / 2 + 44 * Math.sin(k * TAU); }
    else if (!calm && !seen.ghost && !seen.aimed && S === 'done' && ghostAt && now > ghostAt && !aim && vis) { seen.ghost = true; ghost = { t0: now }; }
    hx += (hxT - hx) * Math.min(1, dt * 14); if (Math.abs(hxT - hx) < 0.2) hx = hxT;
    // every so often a tee twitches: a ripple and a wobble of sixteen degrees
    if (!calm && now > twitch) { twitch = now + 1200; const p = M.pegs[Math.floor(Math.random() * M.pegs.length)]; p.wT = now; p.hitT = now; p.wa = 16 * DEG; p.ws = Math.random() < 0.5 ? -1 : 1; }
  }
  const busy = () => S === 'fall' || S === 'roll' || S === 'sink' || S === 'ticket';
  function loop(now) {
    const dt = Math.min(0.05, (now - (prev || now)) / 1000); prev = now;
    update(now, dt); draw(now);
    if (vis && (!calm || busy())) requestAnimationFrame(loop); else { run = false; prev = 0; }
  }
  function kick() { if (!run && vis && baked) { run = true; prev = 0; requestAnimationFrame(loop); } else if (!run && baked) draw(performance.now()); }

  // ── the share card: the ticket, the path it came by, the QR ───────────────
  async function buildTicketCard(tk) {
    try { await Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 50px "Noto Sans Thai"')]); } catch (e) {}
    const CW = 1080, CH = 1350, cd = document.createElement('canvas'); cd.width = CW; cd.height = CH; const g = cd.getContext('2d');
    g.fillStyle = look.paper; g.fillRect(0, 0, CW, CH);
    // the words come first, in both languages
    const head = `My lucky number is ${tk.n}`, thai = `เลขนำโชคของฉันคือ ${tk.n}`;
    g.textBaseline = 'alphabetic'; g.font = `800 88px ${FONT}`;
    g.globalCompositeOperation = 'multiply'; g.fillStyle = look.warm; g.fillText(head, 63, 133); g.globalCompositeOperation = 'source-over'; g.fillStyle = look.key; g.fillText(head, 60, 130);
    g.font = `700 50px ${THAI}`; g.fillText(thai, 60, 200);
    // the ticket, large, a little askew, the way it slides out of the cup
    const tw0 = 240, th0 = 100, f = 880 / tw0;
    g.save(); g.translate(CW / 2, 255 + (th0 * f) / 2 + 12); g.rotate(-2 * DEG); g.scale(f, f); paintTicket(g, { tw: tw0, th: th0, n: tk.n, still: true }); g.restore();
    // the machine, the path the ball took printed on it, framed like the page's cards
    const fh = 570, fw = Math.round((fh * W) / H), fx = 60, fy = 1290 - fh, s = fw / W;
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = look.warm; g.fillRect(fx + 12, fy + 12, fw, fh); g.restore();
    g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip(); g.translate(fx, fy); g.scale(s, s); paint(g, 1e12, { still: true }); g.restore();
    g.strokeStyle = look.key; g.lineWidth = 6; g.strokeRect(fx, fy, fw, fh);
    // beside it: what to do, when and where, and the page's QR dark on white
    const rx = fx + fw + 56;
    g.fillStyle = look.key; g.font = `800 52px ${FONT}`; g.fillText('Try your own', rx, fy + 56); g.fillText('lucky number', rx, fy + 116);
    g.font = `700 36px ${THAI}`; g.fillText('ลองเลขนำโชคของคุณ', rx, fy + 176);
    g.font = `800 40px ${FONT}`; g.fillText('Golf Ball Drop', rx, fy + 234); g.font = `600 30px ${FONT}`; g.fillText('Sat 30 Jan 2027', rx, fy + 278); g.fillText('Horizon Village', rx, fy + 316);
    g.font = `700 27px ${THAI}`; g.fillText('เสาร์ 30 ม.ค. 2570', rx, fy + 356);
    const { size, modules } = encodeQr(PAGE, { ecl: 'M' }), n = size + 8, q = 200, qx = CW - 60 - q, qy = 1290 - q, mq = q / n;
    g.fillStyle = '#fff'; g.fillRect(qx, qy, q, q); g.fillStyle = '#1b2240';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) g.fillRect(Math.floor(qx + (x + 4) * mq), Math.floor(qy + (y + 4) * mq), Math.ceil(mq), Math.ceil(mq));
    g.strokeStyle = look.key; g.lineWidth = 4; g.strokeRect(qx, qy, q, q);
    return cd;
  }
  // the ticket's picture as a file when the phone can share one, its words when it cannot
  async function shareTicket() {
    if (!ticket) return;
    const text = `My lucky number for the Golf Ball Drop is ${ticket.n}. The real drop is 30 Jan 2027 at Horizon Village.`, fallback = () => shareText(text);
    try {
      if (!(navigator.canShare && navigator.share)) return fallback();
      const cd = await buildTicketCard(ticket), blob = await new Promise((res) => cd.toBlob(res, 'image/png'));
      const file = new File([blob], `golf-ball-drop-lucky-${ticket.n}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: document.title, text, url: PAGE }).catch(() => {}); return; }
      fallback();
    } catch (e) { fallback(); }
  }

  // ── hands ──────────────────────────────────────────────────────────────────
  const hit = (z, x, y) => z && x >= z[0] && x <= z[0] + z[2] && y >= z[1] && y <= z[1] + z[3];
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function dropIt(n) {
    const num = $('num'); if (num) num.value = n;
    const b = $('cv'); if (b) b.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => { const g = $('go'); g && g.click(); }, calm ? 0 : 650);
  }
  // is a point on the hopper (the mouth, the cables, the basket), in the frame it rocks in
  function onHopper(p, now) {
    const h = hopperAt(now), dx = p.x - h.px, dy = p.y - M.m, ca = Math.cos(h.ang), sa = Math.sin(h.ang), lx = dx * ca + (p.y - h.py) * sa, ly = -dx * sa + (p.y - h.py) * ca;
    return dy > -2 && Math.abs(lx) < M.hopW * 0.5 + 12 && ly < h.len + hop.h + 8;
  }
  // the tee whose head or shaft is under a finger, if one is
  function teeAt(x, y) {
    let best = null, bd = 1e9;
    for (const p of M.pegs) {
      const L = sprites[p.variant].len * M.u, dx = -Math.sin(p.tilt) * L, dy = Math.cos(p.tilt) * L, t = clamp(((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy)), d = Math.hypot(x - (p.x + dx * t), y - (p.y + dy * t)) - (t < 0.22 ? 6 : 3);
      if (d < bd) { bd = d; best = p; }
    }
    return bd < 5 ? best : null;
  }
  const flagAt = (x, y) => flags.findIndex((f) => x > f.x - 5 && x < f.x + M.fw + 3 && y > f.y - 1 && y < f.y + M.fh + 5);
  const fallenAt = (x, y, now) => { const f = fallenPose(now), mx = f.x - Math.sin(f.ang) * f.L * 0.5, my = f.y + Math.cos(f.ang) * f.L * 0.5; return Math.hypot(x - mx, (y - my) * 1.3) < f.L * 0.5 + 9; };
  // a tee that is tapped wobbles, rings, says its number and sings; it does not let a ball go
  function poke(p, x, now) {
    wake(); p.ws = x < p.x ? 1 : -1; p.wa = 14 * DEG; p.wT = now; p.hitT = now; p.popT = now;
    voice(note(p.col, -1), 0.3, 0.07); buzz(4); notes.push({ x: p.x, y: p.y - M.cr - 8, t0: now, k: p.col });
    if (calm) setTimeout(kick, 950); kick();
  }
  function wave(k, now) { wake(); flags[k].fT = now; voice(note(k, 0), 0.34, 0.06); voice(note(k + 2, 0), 0.34, 0.035); buzz(4); notes.push({ x: flags[k].x + M.fw * 0.5, y: flags[k].y - 6, t0: now, k }); if (calm) setTimeout(kick, 950); kick(); }
  // the fallen tee rolls round its point, over the top, and lies the other way
  function rollTee(now) {
    wake(); if (fallen.roll) return;
    fallen.roll = { t0: now, dur: 900, turn: -fallen.side * Math.PI * 3 };
    voice(196, 0.16, 0.08, 'triangle', 262); setTimeout(() => voice(330, 0.14, 0.05), 760);
    if (calm) { const tx = fallen.x - Math.sin(fallen.ang) * sprites[0].len * M.u, ty = fallen.y + Math.cos(fallen.ang) * sprites[0].len * M.u; fallen.x = tx + (tx - fallen.x); fallen.y = ty + (ty - fallen.y); fallen.ang += Math.PI; fallen.side *= -1; fallen.roll = null; kick(); return; }
    kick();
    setTimeout(() => {
      if (!fallen.roll) return; const f = fallenPose(fallen.roll.t0 + fallen.roll.dur);
      fallen.x = f.x; fallen.y = f.y - 0; fallen.ang = f.ang; fallen.side *= -1; fallen.roll = null; fallen.y += 0; kick();
    }, 920);
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!baked || busy() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = pt(e); if (!onHopper(p, performance.now())) return;
    ghost = null; seen.ghost = true; aim = { id: e.pointerId, x0: p.x, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  });
  cv.addEventListener('pointermove', (e) => {
    if (!baked) return;
    const p = pt(e);
    if (!aim) { if (e.pointerType === 'mouse') cv.style.cursor = !busy() && onHopper(p, performance.now()) ? 'grab' : 'pointer'; return; }
    if (!aim.moved && Math.abs(p.x - aim.x0) > 6) { aim.moved = true; wake(); cv.style.cursor = 'grabbing'; }
    if (aim.moved) { hxT = clamp(p.x, W * 0.12, W * 0.88); if (calm) hx = hxT; kick(); }
  });
  const endAim = (e, drop) => {
    if (!aim) return; const was = aim; aim = null; cv.style.cursor = 'pointer'; try { cv.releasePointerCapture(was.id); } catch (er) {}
    if (was.moved) { seen.aimed = true; suppress = performance.now(); if (drop) release(); else { hxT = W / 2; kick(); } }
  };
  cv.addEventListener('pointerup', (e) => endAim(e, true));
  cv.addEventListener('pointercancel', (e) => endAim(e, false));
  cv.addEventListener('click', (e) => {
    const now = performance.now(); if (now - suppress < 450) return;
    const { x, y } = pt(e);
    if (baked && speaker && Math.hypot(x - speaker.x, y - speaker.y) < 24) { wake(); setMute(!sound.muted); if (!sound.muted) voice(880, 0.12, 0.05); draw(now); return; }
    if (baked && ticket && !ticket.closing && S === 'done') {
      if (hit(zones.share, x, y)) { shareTicket(); return; }
      if (hit(zones.drop, x, y)) { dropIt(ticket.n); return; }
    }
    // a tee, a pennant or the tee on its side answers a tap; only the hopper, the chalk and open paper let a ball go
    if (baked && !(ticket && !ticket.closing && hit(ticketBox(), x, y))) {
      if (fallenAt(x, y, now)) { rollTee(now); return; }
      const tee = teeAt(x, y); if (tee) { poke(tee, x, now); return; }
      const fi = flagAt(x, y); if (fi >= 0) { wave(fi, now); return; }
    }
    release();
  });
  go && go.addEventListener('click', release);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; if (vis) kick(); }).observe(cv);
    // the six seconds of 'TAP THE BASKET' start when most of the picture is on the screen
    new IntersectionObserver((e) => { if (e[0].isIntersecting && tapT0 < 0) { tapT0 = performance.now(); kick(); } }, { threshold: 0.4 }).observe(cv);
  }
  muteWatchers.push(() => { if (baked) kick(); });
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const w = Math.round(cv.getBoundingClientRect().width); if (!baked || w === W) return; if (busy()) { pendingBake = true; return; } bake(); kick(); }, 200); });
  onLook(() => { if (!baked) return; if (busy()) { pendingBake = true; return; } bake(); kick(); });
  // the paper first; the bake when it is near the screen
  size(); flat();
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { io.disconnect(); idle(() => { if (ensure()) kick(); }); } }, { rootMargin: '600px 0px' }); io.observe(cv); }
  else idle(() => { if (ensure()) kick(); });
}

// the machine's odds can be checked in a page: const { sim } = await import('/js/play.js'); sim.simulate(sim.galton(353, 467), seed)
export const sim = { galton, simulate, numberOf };

// The chalk X on the lawn is bare paper, and 300 balls bury it. It is printed again on top: a key
// outline, a paper under-stroke, the warm drum in crayon a hair off register, and a small ring at
// the crossing that the tapes start from. arms are two [ax, ay, bx, by] offsets from the centre.
function paintX(c, ctr, arms, { w = 2.6, ring = 6, k = 1 } = {}) {
  const lay = (lw, col) => {
    c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    arms.forEach(([ax, ay, bx, by]) => { c.moveTo(ctr[0] + ax, ctr[1] + ay); c.lineTo(ctr[0] + bx, ctr[1] + by); });
    c.moveTo(ctr[0] + ring, ctr[1]); c.arc(ctr[0], ctr[1], ring, 0, TAU); c.stroke(); c.restore();
  };
  lay(w + 3.4 * k, look.key); lay(w + 0.7 * k, look.paper);
  c.save(); c.globalCompositeOperation = 'multiply'; c.translate(OFF.warm[0] * 0.5 * k, OFF.warm[1] * 0.5 * k);
  arms.forEach(([ax, ay, bx, by], i) => crayon(c, [[ctr[0] + ax, ctr[1] + ay], [ctr[0] + (ax + bx) / 2, ctr[1] + (ay + by) / 2], [ctr[0] + bx, ctr[1] + by]], { w, color: look.warm, seed: 900 + i, wobble: 0.25 * k }));
  crayon(c, Array.from({ length: 25 }, (_, q) => [ctr[0] + Math.cos((q / 24) * TAU) * ring, ctr[1] + Math.sin((q / 24) * TAU) * ring]), { w: w * 0.85, color: look.warm, seed: 903, wobble: 0.2 * k });
  c.restore();
}
function xSprite(arms, w, ring, dpr) {
  const half = Math.ceil(Math.max(ring, ...arms.flat().map(Math.abs)) + w + 5), s = surface(half * 2, half * 2, dpr);
  paintX(s.ctx, [half, half], arms, { w, ring });
  return { cv: s.cv, half, size: half * 2 };
}

// ── the drop ─────────────────────────────────────────────────────────────────
// The lawn is a plane: a ball has an x on the screen, a depth z (0 at the horizon, 1 at the front),
// a height h above the ground. Where z lands on the screen is gy(z), how big a thing is there sc(z).
const zX = 0.48, zT = 0.76, zMax = zT - 0.05;                  // the X, the tape, the nearest a ball may land
const SPREAD = 5.2, MET = 30;                                                // metres to a unit of dist(): winners come in under a metre, the middle ball near eight
const REVEAL = { hold: 0.5, dim: [0.5, 0.8], loupe: [0.5, 0.95], tape: [0.95, 1.45, 1.95], per: 0.5, end: 2.75 };

export function board() {
  const cv = $('cv'), num = $('num'), res = $('res'), go = $('go'), wind = $('wind');
  if (!cv || !num || !res || !go || !wind) return;
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), R = rng(rand32());
  const probe = document.createElement('canvas').getContext('2d');
  let W = 0, H = 0, bg = null, B = null, L = null, baked = false, pendingBake = false;
  let balls = [], order = [], mine = 0, mineBall = null, phase = 'idle', settled = true;
  let T = 0, T0 = 0, revT = 0, frame = 0, run = false, vis = true, prev = 0, pos = 0, nearer = 0;
  let people = [], sock = { ang: 0, x: 0, y: 0, len: 0 }, wh = -1e9, nextWh = 1200, stamp = -1e9, newBest = false;
  let medals = [], labels = [], loupe = null, last = '', resHTML = '', shown = false, sprs = {};
  let veil = null, xMk = null, xArms = null, xw = 2.6, xr = 6;
  let gw = 0, gh = 0, gHead = null, gNext = null;
  let dropped = false, dropT = -1e9, revSnd = [true, true, true, true], lastPat = 0, speaker = null;     // a first drop fades the chalk; which reveal beats have sounded; the mute's place
  const goTh = go.querySelector('.th'), goEn = go.querySelector('.en'), go0 = [goTh ? goTh.textContent : '', goEn ? goEn.textContent : ''];

  // a first press is no one's script: the number is a fresh pick unless the visitor has typed their own
  if (num.value === '137') num.value = 1 + Math.floor(R() * 300);

  const gy = (z) => L.hy + (H - L.hy) * (0.04 + 0.94 * z), sc = (z) => 0.32 + 0.95 * z;
  const rOf = (z) => Math.round(Math.max(3, (W / 95) * sc(z)) * 2) / 2;
  const sprite = (r) => { const k = (r * 2) | 0; return sprs[k] || (sprs[k] = dropBall(r, dpr)); };
  const dist = (b) => Math.hypot((b.x - L.x[0]) / sc(b.z) / W, (b.z - zX) * 0.75);
  const metres = (b) => dist(b) * MET;
  // how far from the X, as it is printed: centimetres under a metre, so a photo finish keeps its order; th for the Thai units
  const dm = (o, th) => { const m = metres(o), cm = Math.round(m * 100); return cm < 100 ? `${cm} ${th ? 'ซม.' : 'cm'}` : `${pen(Math.round(m * 10) / 10)} ${th ? 'ม.' : 'm'}`; };
  // your ball is the hero: drawn a third larger than its neighbours, from the first frame of the fall
  const heroR = (p) => (p === mineBall ? Math.round(rOf(p.z) * 1.3 * 2) / 2 : rOf(p.z));
  const centre = (p) => { const r = heroR(p); return [p.x, gy(p.z) - p.h - r]; };
  // where your number's pill rides: above the ring round your ball
  const minePill = (p) => { const [cx, cy] = centre(p); return [cx, cy - (heroR(p) + 4) - 11]; };
  const wval = () => +wind.value || 0;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function size() { const r = cv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height); if (!w || !h) return false; W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return true; }
  function flat() { ctx.fillStyle = look.paper; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = look.key; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3); }

  // ── baking ─────────────────────────────────────────────────────────────────
  function bake() {
    if (!size()) return;
    performance.mark('gbd:board-bake-start');
    const phone = W < 600, hy = Math.round(H * (phone ? 0.42 : 0.36));
    L = { w: W, h: H, hy, x: [W / 2, 0], xs: Math.max(28, W * 0.05), tape: [], tapeW: phone ? 3 : 4, pitch: phone ? 4.6 : 5.2, reg: 1.1, chedis: [0.1, 0.14, 0.86], clouds: [[0.2, 0.25, 0.7], [0.75, 0.15, 0.6]] };
    L.x[1] = gy(zX);
    // the tape on its stakes across the near lawn, as in the photos and the hero
    const yT = gy(zT); for (let x = -10; x <= W + 10; x += phone ? 52 : 70) L.tape.push([x, yT + Math.sin(x * 0.01) * 3]);
    bg = surface(W, H, dpr); const G = bakeGround(bg, L, 9);
    // the X printed again over the pile, and the veil that steps the field back: both baked once
    const [X0, X1] = L.x, pa = G.proj(-0.28, -0.28), pb = G.proj(0.28, 0.28), pc = G.proj(0.28, -0.28), pd = G.proj(-0.28, 0.28);
    xArms = [[pa[0] - X0, pa[1] - X1, pb[0] - X0, pb[1] - X1], [pc[0] - X0, pc[1] - X1, pd[0] - X0, pd[1] - X1]]; xw = Math.max(2.6, L.xs * 0.085); xr = Math.max(6, L.xs * 0.22);
    xMk = xSprite(xArms, xw, xr, dpr);
    veil = surface(W, H, dpr); screen(veil.ctx, { x0: 0, y0: 0, x1: W, y1: H }, phone ? 4.4 : 5.2, tone('key'), () => 0.15, inkOf('key'));
    const S = Math.min(W * (phone ? 0.3 : 0.2), (L.hy - 16) / 1.52);
    B = bakeBalloon(S, dpr, 13);
    // the crowd below the tape, watching, as the hero's
    const ph = Math.min(78, (H - yT) * 0.62);
    people = crowd(31, W * 0.02, W * 0.4, () => H - 4, ph).concat(crowd(37, W * 0.84, W + 10, () => H - 2, ph * 0.96));
    people.forEach((p) => (p.bx = p.x));
    sock.len = clamp(hy * 0.32, 36, 66); sock.x = W - clamp(sock.len * 0.85 + 14, 56, 100); sock.y = hy + 8;
    sprs = {}; gw = Math.ceil(W / 12) + 3; gh = Math.ceil(H / 12) + 3; gHead = new Int32Array(gw * gh); gNext = new Int32Array(400);
    baked = true; sock.ang = wval() * 14;
    performance.mark('gbd:board-bake-end'); performance.measure('gbd:board-bake', 'gbd:board-bake-start', 'gbd:board-bake-end');
    if (phase === 'reveal' || phase === 'done') { layoutReveal(); }
    draw(performance.now());
  }
  function ensure() { if (!baked) { if (!size()) return false; bake(); } return baked; }

  // ── the basket, the breeze, the flame ──────────────────────────────────────
  const bal = (now) => {
    const wb = now - wh, bob = wb >= 0 && wb < 500 ? -2 * Math.sin((wb / 500) * Math.PI) : 0;
    return { x: W / 2 - B.w / 2 + (calm ? 0 : Math.sin(now / 1600) * W * 0.012), y: Math.max(4, L.hy * 0.04) + bob };
  };
  const basketAt = (now) => { const b = bal(now), [bx, by, bw, bh] = B.basket; return [b.x + bx + bw / 2, b.y + by + bh, bw]; };
  const flameK = (now) => { const wb = now - wh; if (wb >= 0 && wb < 500) return Math.max(phase === 'fall' ? 0.9 : 0.25, 1 - Math.max(0, wb - 350) / 150 * 0.75); return phase === 'fall' ? 0.9 : 0.25; };

  // ── the drop ───────────────────────────────────────────────────────────────
  function drop() {
    if (!ensure()) return;
    wake();
    mine = clamp(parseInt(num.value, 10) || 1, 1, 300); num.value = mine;
    const now = performance.now(), [bx, by] = basketAt(now), wk = clamp(W / 390, 0.85, 1.9), w = wval() * 0.55 * wk;    // the scatter and the breeze grow with the picture
    // every ball a different number, every press a different shuffle
    const nums = shuffle(Array.from({ length: 300 }, (_, i) => i + 1));
    balls = nums.map((n, i) => {
      const z = clamp(zX + (R() * 2 - 1) * (zMax - zX), 0.04, zMax);
      return { n, x: bx + (R() - 0.5) * B.S * 0.1, z, h: gy(z) - by, vh: 0, vx: (R() + R() - 1) * SPREAD * wk * sc(z) + w * sc(z), vz: (R() - 0.5) * 0.006, wait: i * 0.007, rest: false, medal: 0, sq: -9, near: false, pl: -1, trail: [] };
    });
    mineBall = balls.find((b) => b.n === mine); order = balls.slice();
    medals = []; labels = []; loupe = null; shown = false; resHTML = ''; newBest = false; stamp = -1e9;
    phase = 'fall'; settled = false; T0 = T; res.textContent = ''; revSnd = [false, false, false, false];
    if (!dropped) { dropped = true; dropT = now; }
    if (calm) { balls.forEach((p) => { p.wait = 0; p.h = 0; p.x += p.vx * 40; p.rest = true; p.pl = 0; }); separateAll(); finish(); return; }
    kick();
  }
  const rank = () => balls.slice().sort((a, b) => dist(a) - dist(b));
  function finish() {
    const r = rank();
    pos = r.findIndex((o) => o.n === mine) + 1; nearer = pos - 1;
    r.slice(0, 3).forEach((o, i) => (o.medal = i + 1));
    medals = r.slice(0, 3);
    settled = true; phase = 'reveal'; revT = calm ? 9 : 0;
    // the best this browser has seen, and whether this run beat it
    let best = 0; try { best = +localStorage.getItem('gbd-best') || 0; } catch (e) {}
    newBest = best > 0 && pos < best; if (!best || pos < best) { try { localStorage.setItem('gbd-best', String(pos)); } catch (e) {} }
    const mm = dm(mineBall), mmT = dm(mineBall, true), ord1 = ord(pos), both = (th, en) => `<span class="th">${th}</span><span class="en">${en}</span>`;
    // the payoff in one big line a language: how far, and where that came. The winners are in the glass, so they are not read out again
    const head = pos <= 3 ? both(`<b class="big">อันดับ ${pos}!</b> · ห่างกากบาท ${mmT}`, `<b class="big">${ord1} place!</b> · ${mm} from the X`)
      : both(`<b class="big">ห่าง ${mmT}</b> · อันดับที่ ${pos}`, `<b class="big">${mm}</b> · ${ord1} of 300`);
    const sub = pos <= 3 ? both(`ลูกหมายเลข ${mine} ได้รางวัล! (จำลอง)`, `Ball ${mine} wins a prize! (simulated)`)
      : both(`ลูกหมายเลข ${mine} · มี ${nearer} ลูกอยู่ใกล้กว่า (จำลอง)`, `Ball ${mine} · ${nearer} ball${nearer === 1 ? ' was' : 's were'} nearer (simulated)`);
    last = pos <= 3 ? `My ball #${mine} finished ${ord1} in the Golf Ball Drop simulator, ${mm} from the X. The real one is 30 Jan 2027 at Horizon Village.` : `My ball #${mine} came to rest ${mm} from the X in the Golf Ball Drop simulator (${ord1} of 300). The real one is 30 Jan 2027 at Horizon Village.`;
    // after Share, a way to buy a ball for everyone the simulator did not give a prize
    const buy = pos <= 3 ? '' : '<a class="btn sun real" href="#balls"><span class="th">ซื้อลูกจริง ฿1,000</span><span class="en">Get a real ball</span></a>';
    resHTML = `<div class="res-main">${head}</div><div class="res-sub">${sub}</div><div class="res-acts"><button type="button" class="sh" id="sh-res"><span class="th">แชร์ผล</span><span class="en">Share</span></button>${buy}</div>`;
    layoutReveal();
    if (calm) showResult();
    kick();
  }
  // what is said once the tape has reached all three
  function showResult() {
    if (shown) return; shown = true;
    res.innerHTML = resHTML; $('sh-res').addEventListener('click', () => shareCard());
    // a second try is a repeat of the first unless the button says so
    if (goTh) goTh.textContent = 'ทิ้งอีกครั้ง'; if (goEn) goEn.textContent = 'Drop again';
    if (pos <= 3 && mineBall) {
      const [x, y] = centre(mineBall), rr = cv.getBoundingClientRect(); burst(rr.left + x, rr.top + y - 6, 30, true);
      if (!calm) [0, 2, 3].forEach((k, i) => setTimeout(() => voice(note(k, 0), 0.3, 0.08), i * 110));      // a three-note arpeggio up the scale
    } else if (!calm) voice(note(2, -1), 0.22, 0.045, 'triangle', note(2, -1) * 1.5);
    if (newBest) stamp = performance.now();
    keepResultInView();
  }
  // the dock (under 900 px) is 76 px high at the bottom of the screen: if the sentence lands under it, or under the fold, scroll it clear. Never up,
  // and never so far that the glass leaves the top of the screen
  function keepResultInView() {
    const r = res.getBoundingClientRect(), cr = cv.getBoundingClientRect(), vh = innerHeight, dk = document.getElementById('dock');
    if (cr.bottom < 120 || cr.top > vh - 120) return;                                // the visitor is elsewhere: not our place to move them
    const cover = dk && getComputedStyle(dk).display !== 'none' && !dk.classList.contains('away') ? 84 : 16;
    if (r.bottom <= vh - cover) return;
    const bar = document.querySelector('.top'), barH = bar ? bar.getBoundingClientRect().bottom : 60;
    const keep = loupe ? cr.top + loupe.cy - loupe.R - barH - 8 : cr.top + H * 0.2 - barH;
    const dy = Math.min(r.bottom - vh + cover + 12, Math.max(0, keep));
    if (dy > 2) scrollBy({ top: dy, behavior: calm ? 'auto' : 'smooth' });
  }

  // ── physics ────────────────────────────────────────────────────────────────
  // each ball's first touch of the ground is a tick; at most one in 35 ms, so three hundred of them fall like rain
  function patter() { const n = performance.now(); if (n - lastPat < 35) return; lastPat = n; voice(1500 + Math.random() * 900, 0.03, 0.015, 'square'); }
  function step(dt) {
    T += dt; const f = dt * 60; let moving = false;
    for (const b of balls) {
      if (b.rest) continue;
      if (b.wait > 0) { b.wait -= dt; moving = true; continue; }
      b.vh -= 0.45 * f; b.h += b.vh * f; b.x += b.vx * f; b.z += b.vz * f;
      if (b.z > zMax) { b.z = zMax; b.vz = -Math.abs(b.vz) * 0.5; } else if (b.z < 0.02) { b.z = 0.02; b.vz = Math.abs(b.vz) * 0.5; }
      if (b.x < 3 || b.x > W - 3) { b.x = clamp(b.x, 3, W - 3); b.vx *= -0.5; }
      if (b.h <= 0) {
        b.h = 0;
        if (b.vh < -1.5) { if (b.sq < 0) { b.sq = T; b.near = b.z > 0.6; patter(); } b.vh = -b.vh * 0.35; b.vx *= 0.7; b.vz *= 0.7; }
        else { b.vh = 0; const fr = Math.pow(0.88, f); b.vx *= fr; b.vz *= fr; if (Math.abs(b.vx) < 0.04 && Math.abs(b.vz) < 0.0003) { b.rest = true; if (b.pl < 0) b.pl = T; } }
      }
      moving = true;
    }
    separate(2);
    if (T - T0 > 11) balls.forEach((b) => { if (!b.rest) { b.rest = true; b.pl = b.pl < 0 ? T : b.pl; b.h = 0; } });
    return moving;
  }
  // Balls on the ground push each other apart: a 12-px hash, two passes, half the overlap each,
  // so the pile forms, settles into its gaps, and "closest to the X" is a contact fight.
  function separate(passes) {
    const n = balls.length;
    for (let it = 0; it < passes; it++) {
      gHead.fill(-1);
      for (let i = 0; i < n; i++) {
        const b = balls[i]; if (b.wait > 0 || b.h > 1.6) { gNext[i] = -2; continue; }
        const cx = clamp((b.x / 12) | 0, 0, gw - 1), cy = clamp((gy(b.z) / 12) | 0, 0, gh - 1), k = cx + cy * gw; gNext[i] = gHead[k]; gHead[k] = i;
      }
      for (let i = 0; i < n; i++) {
        if (gNext[i] === -2) continue;
        const a = balls[i], ra = rOf(a.z), ya = gy(a.z), cx = clamp((a.x / 12) | 0, 0, gw - 1), cy = clamp((ya / 12) | 0, 0, gh - 1);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const qx = cx + ox, qy = cy + oy; if (qx < 0 || qy < 0 || qx >= gw || qy >= gh) continue;
          for (let j = gHead[qx + qy * gw]; j >= 0; j = gNext[j]) {
            if (j <= i) continue;
            const b = balls[j], dx = b.x - a.x, dy = (gy(b.z) - ya) * 1.25, d = Math.hypot(dx, dy), md = (ra + rOf(b.z)) * 0.92;
            if (d >= md) continue;
            const ux = d > 1e-3 ? dx / d : 1, uy = d > 1e-3 ? dy / d : 0, push = (md - d) / 2, dz = (uy * push) / 1.25 / ((H - L.hy) * 0.94);
            a.x -= ux * push; b.x += ux * push; a.z = clamp(a.z - dz, 0.02, zMax); b.z = clamp(b.z + dz, 0.02, zMax);
            if (push > 0.12) { if (a.rest) { a.rest = false; a.vx = a.vz = 0; } if (b.rest) { b.rest = false; b.vx = b.vz = 0; } }
          }
        }
      }
    }
  }
  function separateAll() { separate(6); }

  // push labels apart until no two overlap: each box is w by h, and the pair gives way along the axis it overlaps least
  function declutter(items, w, h) {
    for (let it = 0; it < 80; it++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j], dx = b.x - a.x || 0.01, dy = b.y - a.y || 0.01, ox = w - Math.abs(dx), oy = h - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue; moved = true;
        const fa = a.fixed ? 0 : b.fixed ? 2 : 1, fb = b.fixed ? 0 : a.fixed ? 2 : 1;
        if (ox / w < oy / h) { const k = (ox / 2 + 0.5) * Math.sign(dx); a.x -= k * fa; b.x += k * fb; } else { const k = (oy / 2 + 0.5) * Math.sign(dy); a.y -= k * fa; b.y += k * fb; }
      }
      if (!moved) break;
    }
  }
  // ── the reveal: where the three are, how the labels and the loupe sit ──────
  function layoutReveal() {
    if (!baked || !medals.length) return;
    const ang = [-60, -120, 90], items = medals.map((p, i) => { const [x, y] = centre(p), a = ang[i] * DEG; return { p, bx: x, by: y, x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 26 }; });
    // your own number rides above your ball on a blue pill and stays where it is: the three give way to it, by its width
    if (mineBall && !mineBall.medal) { const [mx, my] = minePill(mineBall); items.push({ fixed: true, x: mx, y: my }); }
    declutter(items, 54, 22); if (items.length > 3) items.length = 3;
    items.forEach((q) => { q.x = clamp(q.x, 16, W - 16); q.y = clamp(q.y, 14, H - 12); });
    labels = items;
    // the loupe: upper right of the cluster if there is room, clear of the X, the three, your ball and the sock
    const Rl = Math.min(W * 0.26, H * 0.3), X = L.x, avoid = [[X[0], X[1], 14], ...medals.map((p) => { const [x, y] = centre(p); return [x, y, 10]; })];
    if (mineBall) { const [x, y] = centre(mineBall); avoid.push([x, y, 14]); if (!mineBall.medal) { const [px, py] = minePill(mineBall); avoid.push([px, py, 20]); } }
    labels.forEach((q) => avoid.push([q.x, q.y, 14]));
    const soft = [[56, 20, 52], [W - 26, 26, 26]];                 // the place chip and the speaker: worth a detour, not a lost glass
    const bb = bal(0), bc = [bb.x + B.w / 2, bb.y + B.h * 0.4];
    let bestC = null, bestS = 1e9;
    for (const da of [-45, -25, -65, -5, -85, 15, 35, 195, 215, 235, 175]) for (const dd of [1.15, 1.35, 1.6]) {
      const a = da * DEG, cx = clamp(X[0] + Math.cos(a) * Rl * dd, Rl + 4, W - Rl - 4), cy = clamp(X[1] + Math.sin(a) * Rl * dd, Rl + 4, H - Rl - 4);
      let s = Math.abs(da + 45) * 0.02 + dd * 0.3;
      avoid.forEach(([x, y, m]) => { if (Math.hypot(x - cx, y - cy) < Rl + m) s += 50; });
      soft.forEach(([x, y, m]) => { if (Math.hypot(x - cx, y - cy) < Rl + m) s += 16; });
      if (Math.hypot(sock.x - cx, sock.y - sock.len * 0.5 - cy) < Rl + 22) s += 7;
      if (Math.hypot(bc[0] - cx, bc[1] - cy) < Rl + B.S * 0.3) s += 9;
      if (s < bestS) { bestS = s; bestC = [cx, cy]; }
    }
    if (!bestC) { loupe = null; return; }
    // the winners land inside one ball's width of the X, so the glass is set by how far the farthest of them is:
    // that one sits at half the glass's radius, however tight the finish (2.4 times at the least, 8 at the most)
    const reach = Math.max(...medals.map((p) => Math.hypot(p.x - X[0], gy(p.z) - X[1]))), Z = clamp((0.5 * Rl) / Math.max(reach, 8), 2.4, 8), wk = Math.min(Z / 2.4, 2);
    const [cx, cy] = bestC, to = (x, y) => [cx + (x - X[0]) * Z, cy + (y - X[1]) * Z];
    // a label for each ball, hung on the glass's rim so nothing in the glass is covered: a paper chip with the number on its pill (a medal's with its
    // place) over the distance, on a leader to its own ball. Each takes the seat on the rim, in 15-degree steps, that is nearest the line from the
    // X through its ball (so the tape, the ball and the leader run one way), clear of the other chips, the handle, the speaker and the edges.
    const gm = medals.map((p) => { const r = heroR(p) * Z, [x, yb] = to(p.x, gy(p.z)); return { p, br: r, bx: x, by: yb - r }; });
    probe.font = `800 12px ${FONT}`;
    const words = [...medals.map((p, i) => `${['1st', '2nd', '3rd'][i]} · ${dm(p)}`), `you · ${dm(mineBall)}`, ...medals.map((p, i) => `ที่ ${i + 1} · ${dm(p, true)}`)];
    const UW = Math.max(60, Math.ceil(Math.max(...words.map((w) => probe.measureText(w).width))) + 16), UH = 40;
    const adiff = (u, v) => Math.abs(Math.atan2(Math.sin(u - v), Math.cos(u - v))), toX = Math.atan2(X[1] - cy, X[0] - cx), hand = toX + Math.PI;
    const SEATS = Array.from({ length: 24 }, (_, k) => k * 15 * DEG).map((th) => {
      const ext = Math.abs(Math.cos(th)) * UW / 2 + Math.abs(Math.sin(th)) * UH / 2, d = Rl + ext * 0.9 - 8, x0 = cx + Math.cos(th) * d, y0 = cy + Math.sin(th) * d;
      const x = clamp(x0, UW / 2 + 6, W - UW / 2 - 6), y = clamp(y0, UH / 2 + 6, H - UH / 2 - 6);
      let c0 = Math.hypot(x - x0, y - y0) * 3;
      if (adiff(th, hand) < 0.45) c0 += 200; if (adiff(th, toX) < 0.26) c0 += 80;                      // the handle, the dashed leader to the X
      if (Math.abs(x - (W - 26)) < UW / 2 + 24 && y < 26 + UH / 2 + 24) c0 += 300;                      // the speaker
      if (x - UW / 2 < 70 && y - UH / 2 < 34) c0 += 150;                                                // the place chip
      return { th, x, y, c0 };
    });
    const clashes = (s1, s2) => Math.abs(s1.x - s2.x) < UW + 2 && Math.abs(s1.y - s2.y) < UH + 2;
    const segDist = (px, py, ax, ay, bx2, by2) => { const dx = bx2 - ax, dy = by2 - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)); return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); };
    const prefOf = (g, i) => (Math.hypot(g.bx - cx, g.by - cy) < g.br * 0.4 ? [-60, -120, 90][i] * DEG : Math.atan2(g.by - cy, g.bx - cx));
    // what a seat costs a ball: the turn away from its own line, the seat's own faults, and a leader that would run through another winner
    const seatCost = (g, i, k) => { const st = SEATS[k]; let c0 = st.c0 + adiff(st.th, prefOf(g, i)) * 60; gm.forEach((o) => { if (o !== g && segDist(o.bx, o.by, g.bx, g.by, st.x, st.y) < o.br + 4) c0 += 60; }); return c0; };
    const cost3 = gm.map((g, i) => SEATS.map((_, k) => seatCost(g, i, k)));
    let pick = [0, 8, 16], pd = 1e12;
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { if (j === i || clashes(SEATS[i], SEATS[j])) continue; for (let k = 0; k < 24; k++) { if (k === i || k === j || clashes(SEATS[i], SEATS[k]) || clashes(SEATS[j], SEATS[k])) continue; const t = cost3[0][i] + cost3[1][j] + cost3[2][k]; if (t < pd) { pd = t; pick = [i, j, k]; } } }
    const li = gm.map((g, i) => ({ ...g, x: SEATS[pick[i]].x, y: SEATS[pick[i]].y }));
    // the visitor's ball, if it is in the glass and not one of the three, has its own chip on the best seat left
    if (mineBall && !mineBall.medal) {
      const r = heroR(mineBall) * Z, [x, yb] = to(mineBall.x, gy(mineBall.z)), by = yb - r;
      if (Math.hypot(x - cx, by - cy) < Rl - r * 0.4) {
        const me = { p: mineBall, you: true, br: r, bx: x, by }; let bk = -1, bc = 1e12;
        SEATS.forEach((st, k) => { if (li.some((q) => clashes(st, q))) return; const t = seatCost(me, 0, k) + (Math.hypot(st.x - x, st.y - by) > Rl * 1.9 ? 100 : 0); if (t < bc) { bc = t; bk = k; } });
        if (bk >= 0) li.push({ ...me, x: SEATS[bk].x, y: SEATS[bk].y });
      }
    }
    loupe = { cx, cy, R: Rl, Z, wk, to, UW, UH, lab: li, near: balls.filter((p) => Math.abs(p.x - X[0]) < Rl / Z + 12 && Math.abs(gy(p.z) - X[1]) < Rl / Z + 12).sort((p, q) => p.z - q.z) };
  }

  // ── drawing ────────────────────────────────────────────────────────────────
  function draw(now) {
    if (!baked) return;
    const c = ctx; c.drawImage(bg.cv, 0, 0, W, H);
    const b = bal(now), [bx, by] = basketAt(now), t = now / 1000, k = wval();
    // the balloon's shadow on the lawn, and its tethers to two stakes either side of the X
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = look.key; c.globalAlpha = 0.1; c.beginPath(); c.ellipse(L.x[0] + B.S * 0.3, gy(zX + 0.05), B.S * 0.34, B.S * 0.05, 0, 0, TAU); c.fill(); c.restore();
    [[-B.S * 0.78, 0.05, 1], [B.S * 0.84, 0.12, -1]].forEach(([dx, dz, sg], q) => {
      const ex = L.x[0] + dx, ey = gy(zX + dz), sx = bx + sg * -B.basket[2] * 0.45, sy = by - 2, sway = calm ? 0 : Math.sin(t * 1.3 + q) * 1.6, cxp = (sx + ex) / 2 + k * 5 + sway, cyp = (sy + ey) / 2 + 12;
      const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([(1 - u) * (1 - u) * sx + 2 * u * (1 - u) * cxp + u * u * ex, (1 - u) * (1 - u) * sy + 2 * u * (1 - u) * cyp + u * u * ey]); }
      c.save(); c.globalCompositeOperation = 'multiply'; crayon(c, pts, { w: 1.2, color: look.key, seed: 700 + q, alpha: 0.8, wobble: 0.35 }); c.fillStyle = look.warm; c.fillRect(ex - 1.5, ey - 7, 3, 9); c.fillStyle = look.key; c.globalAlpha = 0.6; c.fillRect(ex + 0.3, ey - 7, 1.3, 9); c.restore();
    });
    // before the first drop, chalk on the lawn says what to do; it fades as the balls leave the basket
    chalkBoard(c, now);
    // the balls, far to near, all at full strength; the veil steps the field back; the X is printed over
    // the pile; then the three and yours go on top, so they are the only things left bright
    if (frame % 6 === 0) order.sort((p, q) => p.z - q.z);
    const rev = phase === 'reveal' || phase === 'done', dimK = rev ? ease.io((revT - REVEAL.dim[0]) / (REVEAL.dim[1] - REVEAL.dim[0])) : 0;
    for (const p of order) if (p.wait <= 0) ballDraw(p, now, 1);
    if (dimK > 0.002) { c.save(); c.beginPath(); c.rect(0, L.hy + 1, W, H - L.hy); c.clip(); c.globalAlpha = dimK * 0.8; c.drawImage(veil.cv, 0, 0, W, H); c.restore(); }
    c.save(); c.globalAlpha = phase === 'fall' || phase === 'reveal' ? 1 : 0.8; c.drawImage(xMk.cv, L.x[0] - xMk.half, L.x[1] - xMk.half, xMk.size, xMk.size); c.restore();
    if (rev) { for (const p of medals) ballDraw(p, now, 1, true); if (mineBall && !mineBall.medal) ballDraw(mineBall, now, 1, true); }
    // the balloon, with its flame
    c.save(); c.translate(b.x, b.y); c.drawImage(B.cv, 0, 0, B.w, B.h); flame(c, B.mouth[0], B.mouth[1], B.S * 0.07, flameK(now), t); c.restore();
    drawSock(c, now);
    people.forEach((p, i) => { p.x = p.bx + (calm ? 0 : Math.sin(now / 900 + i) * 0.6); person(c, p, now); });
    if (phase === 'reveal' || phase === 'done') drawReveal(c, now);
    else if (mineBall && (phase === 'fall')) mineMarks(c, mineBall, now);
    if (stamp > 0) drawStamp(c, now);
    // where your ball came, on paper in the corner once the tapes have landed; and the speaker, where the sound is
    if (shown && mineBall && (phase === 'reveal' || phase === 'done')) chipAt(c, 10, 10, hasLang('th') ? `#${mine} · ที่ ${pos}` : `#${mine} · ${ord(pos)}`);
    speaker = { x: W - 26, y: 26 }; paintSpeaker(c, speaker.x, speaker.y);
  }
  // 'TAP' with a crayon arrow to the X, left of the chalk court, while nothing has been dropped
  function chalkBoard(c, now) {
    const a = !dropped ? 1 : calm ? 0 : clamp(1 - (now - dropT) / 450);
    if (a <= 0.01 || (phase !== 'idle' && !dropped)) return;
    const [X0, X1] = L.x, k = clamp(W / 560, 1, 1.35) * (calm ? 1 : 1 + 0.05 * (0.5 + 0.5 * Math.sin((now / 1000) * 2.6))), tx = clamp(X0 - Math.max(W * 0.3, L.xs * 3.2), 42, W * 0.3), ty = L.hy + (X1 - L.hy) * 0.5;
    chalkWords(c, tx, ty, -6 * DEG, k, [['TAP', 27, 0], ['แตะ', 18, 25, true]], a);
    chalkArrow(c, [[tx + 34, ty + 4], [tx + (X0 - tx) * 0.34, ty + 20], [tx + (X0 - tx) * 0.7, X1 - 10], [X0 - L.xs * 0.66, X1 - 2]], a, 14, 3.1);
  }
  function ballDraw(p, now, a, noShadow) {
    const c = ctx, s = sc(p.z), r = rOf(p.z), yg = gy(p.z), x = p.x, h = Math.max(0, p.h), hk = Math.min(1, h / 80);
    // a cast shadow that grows and thins with height, offset away from the upper-left light
    if (!noShadow) {
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = look.key; c.globalAlpha = (0.18 - 0.1 * hk) * a;
      const sr = r * (1 + 0.5 * h / 80); c.beginPath(); c.ellipse(x + 0.4 * r, yg + 0.3 * r, sr, sr * 0.34, 0, 0, TAU); c.fill(); c.restore();
    }
    const mineP = p === mineBall, rd = mineP ? heroR(p) : r, sp = sprite(rd), yc = yg - h - rd, sq = T - p.sq;
    c.globalAlpha = a;
    // yours has what the machine's ball has: a disc of sun ink, a hair off register, on a bare-paper ground so it is bright on the lawn
    if (mineP) { c.save(); c.globalAlpha = 0.9 * a; c.fillStyle = look.paper; c.beginPath(); c.arc(x, yc, r * 1.7, 0, TAU); c.fill(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = a; c.fillStyle = look.sun; c.beginPath(); c.arc(x + OFF.sun[0], yc + OFF.sun[1], r * 1.7, 0, TAU); c.fill(); c.restore(); }
    if (sq >= 0 && sq < 0.08 && h < 2) {
      // landing: squashed wide and low for 80 ms, three ticks off a near ball
      c.save(); c.translate(x, yg); c.scale(1.2, 0.75); c.drawImage(sp.cv, -sp.size / 2, -rd - sp.size / 2, sp.size, sp.size); c.restore();
    } else c.drawImage(sp.cv, x - sp.size / 2, yc - sp.size / 2, sp.size, sp.size);
    if (p.near && sq >= 0 && sq < 0.14) { c.strokeStyle = look.key; c.lineWidth = 1.2; c.lineCap = 'round'; c.globalAlpha = a * (1 - sq / 0.14); [-150, -90, -30].forEach((d) => { const q = d * DEG; c.beginPath(); c.moveTo(x + Math.cos(q) * (r + 1.5), yg + Math.sin(q) * (r + 1.5) - r * 0.3); c.lineTo(x + Math.cos(q) * (r + 5.5), yg + Math.sin(q) * (r + 5.5) - r * 0.3); c.stroke(); }); }
    c.globalAlpha = 1;
    if (p === mineBall && !calm && phase === 'fall' && frame % 2 === 0 && !p.rest) { p.trail.push([x, yc]); if (p.trail.length > 8) p.trail.shift(); }
  }
  // a ring in the machine's own two inks: bare paper under it, the sun drum, the warm drum on that, a key line each side. Bright on the lawn.
  function mineRing(c, x, y, rr, wd = 3) {
    c.save(); c.strokeStyle = look.paper; c.lineWidth = wd * 2; c.globalAlpha = 0.92; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke(); c.globalAlpha = 1;
    c.globalCompositeOperation = 'multiply'; c.strokeStyle = look.sun; c.lineWidth = wd * 1.9; c.beginPath(); c.arc(x + OFF.sun[0] * 0.5, y + OFF.sun[1] * 0.5, rr, 0, TAU); c.stroke();
    c.strokeStyle = look.warm; c.lineWidth = wd; c.beginPath(); c.arc(x + OFF.warm[0] * 0.5, y + OFF.warm[1] * 0.5, rr, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'source-over'; c.strokeStyle = look.key; c.lineWidth = Math.max(1, wd * 0.4); c.beginPath(); c.arc(x, y, rr + wd, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, Math.max(0.5, rr - wd), 0, TAU); c.stroke();
    c.restore();
  }
  // your ball: a pulsing ring, a number on a blue pill riding above it, a tail of dots, a pennant that plants itself
  function mineMarks(c, p, now, part = 'all') {
    const r = heroR(p), [cx, cy] = centre(p), pulse = calm ? 0 : Math.sin((now / 900) * TAU) * 1.5, medal = p.medal > 0, rr = (medal ? r + 12 : r + 4) + pulse;
    if (part === 'pill') { if (!medal) { const [tx, ty] = minePill(p); tag(c, p, tx, ty, 12, 4); } return; }
    if (!calm && p.trail.length) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = look.warm; p.trail.forEach(([x, y], i) => { c.globalAlpha = 0.15 + 0.45 * (i / p.trail.length); c.beginPath(); c.arc(x, y, Math.max(1, r * 0.4), 0, TAU); c.fill(); }); c.restore(); }
    mineRing(c, cx, cy, rr, 2.2);
    // the pennant: riding on the ball while it falls, planted on the lawn once it rests
    const ph = p.pl >= 0 ? clamp((T - p.pl) / 0.3) : 0, sS = 0.8 + 0.5 * sc(p.z), px = lerp(cx, cx + r + 2.5, ease.out(ph)), pb = lerp(cy - r * 0.6, gy(p.z) + 1, ease.out(ph)), hh = lerp(13, 21, ph) * sS;
    pennant(c, px, pb, hh, now, medal);
    if (!medal && part === 'all') { const [tx, ty] = minePill(p); tag(c, p, tx, ty, 12, 4); }
  }
  function pennant(c, x, y, h, now, gold) {
    const fl = calm ? 0 : Math.sin(now / 130) * 1.1, fw = h * 0.62, fh = h * 0.44, poly = () => { c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + fw, y - h + fh / 2 + fl); c.lineTo(x, y - h + fh); c.closePath(); };
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.fillStyle = look.paper; poly(); c.fill();
    c.globalCompositeOperation = 'multiply'; c.save(); c.translate(OFF.sun[0] * 0.5, OFF.sun[1] * 0.5); c.fillStyle = look.sun; poly(); c.fill(); c.restore();
    if (gold) { c.save(); c.translate(OFF.warm[0] * 0.5, OFF.warm[1] * 0.5); c.fillStyle = look.warm; c.globalAlpha = 0.55; poly(); c.fill(); c.restore(); }
    c.globalCompositeOperation = 'source-over'; c.strokeStyle = look.key; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke(); c.lineWidth = 1; poly(); c.stroke();
    c.restore();
  }
  // the windsock: a pole, a ring, four tapering stripes that lean with the breeze and flap
  function drawSock(c, now) {
    const t = now / 1000, k = wval(), want = k * 14; sock.ang += (want - sock.ang) * (calm ? 1 : 0.06);
    const x0 = sock.x, y0 = sock.y, top = y0 - sock.len, seg = sock.len * 0.22, n = 4, a0 = sock.ang * DEG;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = look.key; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, top); c.stroke();
    let x = x0, y = top, rad = sock.len * 0.085; const wob = calm ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const lean = a0 * (0.55 + 0.45 * (i / (n - 1))) + wob * Math.sin(t * 9 + i * 1.4) * (0.05 + 0.025 * Math.abs(k)), ex = x + Math.sin(lean) * seg, ey = y + Math.cos(lean) * seg, r2 = rad * 0.78, nx = Math.cos(lean), ny = -Math.sin(lean);
      const quad = () => { c.beginPath(); c.moveTo(x - nx * rad, y - ny * rad); c.lineTo(ex - nx * r2, ey - ny * r2); c.lineTo(ex + nx * r2, ey + ny * r2); c.lineTo(x + nx * rad, y + ny * rad); c.closePath(); };
      c.fillStyle = look.paper; quad(); c.fill();
      if (i % 2 === 0) { c.save(); c.globalCompositeOperation = 'multiply'; c.translate(OFF.warm[0] * 0.6, OFF.warm[1] * 0.6); c.fillStyle = look.warm; c.globalAlpha = 0.95; quad(); c.fill(); c.restore(); }
      c.strokeStyle = look.key; c.lineWidth = 1.2; quad(); c.stroke();
      x = ex; y = ey; rad = r2;
    }
    c.strokeStyle = look.key; c.lineWidth = 1.8; c.beginPath(); c.arc(x0, top, sock.len * 0.085, 0, TAU); c.stroke();
    c.restore();
    sock.hit = [x0 - sock.len * 0.2, top - 6, x0 + sock.len * 1.05, top + seg * n + 8];
  }
  const mid = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  // the start of a tape: out from the X at the edge of its ring, so the crossing stays an open X (a ball sitting on the ring gets what is left)
  const fromRing = (a, b, rr) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), t = Math.min(rr, d * 0.6) / (d || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  // a tape from a to b, drawn out to k of the way, in its medal's ink: paper under, then gold the sun drum under key dashes 6 on 6 off,
  // bronze the warm drum under the same, silver bare paper with key dots (as its ring); an L-hook at the end
  function tapeDraw(c, a, b, k, w, hook, dash = 6, medal = 1) {
    const e = mid(a, b, k), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    // a path is fixed where it was drawn, so each offset copy is drawn again at its offset
    const lay = (ox = 0, oy = 0, hk = true) => { c.beginPath(); c.moveTo(a[0] + ox, a[1] + oy); c.lineTo(e[0] + ox, e[1] + oy); if (hk) { c.moveTo(e[0] + ox, e[1] + oy); c.lineTo(e[0] + nx * hook + ox, e[1] + ny * hook + oy); } };
    c.save(); c.lineCap = 'butt'; c.lineJoin = 'round';
    lay(); c.strokeStyle = look.paper; c.lineWidth = w + 2; c.stroke();
    if (medal === 2) {
      c.strokeStyle = look.key; c.lineWidth = Math.max(0.9, w * 0.2); c.globalAlpha = 0.85; lay(nx * w * 0.5, ny * w * 0.5, false); c.stroke(); lay(-nx * w * 0.5, -ny * w * 0.5, false); c.stroke();
      c.globalAlpha = 0.6; c.lineWidth = w * 0.72; c.lineCap = 'round'; c.setLineDash([0.1, w * 0.95]); lay(); c.stroke(); c.setLineDash([]);
    } else {
      const ink = medal === 3 ? look.warm : look.sun, o = medal === 3 ? OFF.warm : OFF.sun;
      c.globalCompositeOperation = 'multiply'; c.strokeStyle = ink; c.lineWidth = w; lay(o[0] * 0.5, o[1] * 0.5); c.stroke();
      c.strokeStyle = look.key; c.lineWidth = w; c.setLineDash([dash, dash]); c.globalAlpha = 0.9; lay(); c.stroke(); c.setLineDash([]);
    }
    c.restore();
    return e;
  }
  // a few words on a paper pill with a key line: it keeps its edge over the magnified halftone, where a stroked halo would not
  function label(c, text, x, y, size) {
    c.save(); c.font = `800 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = Math.ceil(c.measureText(text).width) + 10, h = size + 5;
    c.fillStyle = look.paper; c.strokeStyle = look.key; c.lineWidth = 1.3; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2); c.fill(); c.stroke();
    c.fillStyle = look.key; c.fillText(text, x, y + 0.5); c.restore();
  }
  // a number on a pill in its medal's ink: gold is the sun drum, silver bare paper with a key screen, bronze the warm drum. A medal's pill
  // carries its place on a small paper disc at the upper left, the way a rosette carries it.
  function tag(c, p, x, y, size, kind = p.medal) {
    c.save(); c.font = `800 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const rd = clamp(size * 0.4, 5, 16), place = kind >= 1 && kind <= 3, more = place ? rd * 0.9 : 0, w = Math.ceil(c.measureText(p.n).width) + 12 + more, h = size + 7, sh = Math.max(1.5, size / 9), tx = x + more / 2;
    c.fillStyle = look.key; c.beginPath(); c.roundRect(x - w / 2 + sh, y - h / 2 + sh, w, h, h / 2); c.fill();
    c.fillStyle = kind === 1 ? look.sun : kind === 2 ? look.paper : kind === 4 ? look.sky : look.warm; c.strokeStyle = look.key; c.lineWidth = Math.max(1.6, size / 8); c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2); c.fill(); c.stroke();
    if (kind === 2) { c.save(); c.clip(); c.fillStyle = look.key; c.globalAlpha = 0.4; for (let q = -w / 2 + 2; q < w / 2; q += 3.2) for (let r = -h / 2 + 2 + ((q / 3.2) % 2 ? 1.6 : 0); r < h / 2; r += 3.2) { c.beginPath(); c.arc(x + q, y + r, 0.8, 0, TAU); c.fill(); } c.restore(); }
    c.fillStyle = kind === 1 ? '#000' : kind === 4 ? look.paper : look.key; c.fillText(p.n, tx, y + 0.5);
    if (place) {
      const dx = x - w / 2 + rd * 0.55, dy = y - h / 2 + rd * 0.25;
      c.fillStyle = look.paper; c.strokeStyle = look.key; c.lineWidth = Math.max(1.2, size / 9); c.beginPath(); c.arc(dx, dy, rd, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = look.key; c.font = `800 ${Math.round(rd * 1.35)}px ${FONT}`; c.fillText(kind, dx, dy + rd * 0.06);
    }
    c.restore();
  }
  // a ring that is two printed drums and a key outline
  function ring(c, x, y, rr, medal, wd, a = 1, ol = 1.4) {
    c.save(); c.globalAlpha = a;
    if (medal === 2) {                                                  // silver: bare paper with a 40 percent key screen
      c.strokeStyle = look.paper; c.lineWidth = wd; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
      c.globalAlpha = a * 0.5; c.strokeStyle = look.key; c.lineWidth = wd * 0.78; c.lineCap = 'round'; c.setLineDash([0.1, wd * 0.95]); c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = a;
    } else {
      const ink = medal === 1 ? look.sun : look.warm, o = medal === 1 ? OFF.sun : OFF.warm;
      c.globalCompositeOperation = 'multiply'; c.strokeStyle = ink; c.lineWidth = wd; c.beginPath(); c.arc(x + o[0], y + o[1], rr, 0, TAU); c.stroke(); c.globalCompositeOperation = 'source-over';
    }
    c.strokeStyle = look.key; c.lineWidth = ol; c.beginPath(); c.arc(x, y, rr + wd / 2, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, Math.max(0.5, rr - wd / 2), 0, TAU); c.stroke();
    c.restore();
  }
  // the staged reveal: the field steps back, the loupe opens, the tape goes out to bronze, silver, gold
  function drawReveal(c, now) {
    const X = L.x, order3 = [medals[2], medals[1], medals[0]];            // bronze first, for suspense
    // your ball, when it is not on the podium (its number is drawn last, over the glass, so the glass never cuts it)
    if (mineBall) mineMarks(c, mineBall, now, 'ring');
    // the tapes start at the edge of the X's ring and go out first, each in its medal's ink, so every medal ring sits over its tape
    order3.forEach((p, i) => { if (!p) return; const t0 = REVEAL.tape[i]; if (revT < t0) return; const k = ease.io((revT - t0) / REVEAL.per), [cx, cy] = centre(p), r = heroR(p), end = [cx, cy + r * 0.2]; tapeDraw(c, fromRing(X, end, xr), end, k, 4, 7, 6, p.medal); });
    order3.forEach((p, i) => { if (!p) return; const t0 = REVEAL.tape[i]; if (revT < t0) return; const [cx, cy] = centre(p), r = heroR(p); ring(c, cx, cy, (r + 2.8) * ease.back((revT - t0) / 0.28), p.medal, 3); });
    // the labels, each on its own leader
    labels.forEach((q) => {
      const i = 3 - q.p.medal, t0 = REVEAL.tape[i] + REVEAL.per; if (revT < t0) return;
      const a = ease.back((revT - t0) / 0.2), dx = q.x - q.bx, dy = q.y - q.by, d = Math.hypot(dx, dy) || 1, r = rOf(q.p.z) + 5.5;
      c.save(); c.strokeStyle = look.key; c.lineWidth = 1.2; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(q.bx + (dx / d) * r, q.by + (dy / d) * r); c.lineTo(q.x - (dx / d) * 8, q.y - (dy / d) * 6); c.stroke(); c.restore();
      c.save(); c.translate(q.x, q.y); c.scale(a, a); tag(c, q.p, 0, 0, 13); c.restore();
    });
    if (loupe) drawLoupe(c, now);
    if (mineBall) mineMarks(c, mineBall, now, 'pill');
  }
  // the photo-finish glass. From the bottom up: the lawn at Z times with a quarter of paper over it, the balls at full strength,
  // the veil, the X overprinted, the tapes, a pill and leader for each of the three and for you, the three and your ball on top,
  // and the rings over everything. Rings, tapes and hooks are as heavy as the glass is strong (to twice the page's weight).
  function drawLoupe(c, now) {
    const { cx, cy, R: Rl, Z, wk, to, lab, near } = loupe, g = ease.back((revT - REVEAL.loupe[0]) / (REVEAL.loupe[1] - REVEAL.loupe[0])), Rk = Rl * Math.max(0.001, g), X = L.x, a = Math.atan2(X[1] - cy, X[0] - cx);
    if (g <= 0) return;
    const dimK = ease.io((revT - REVEAL.dim[0]) / (REVEAL.dim[1] - REVEAL.dim[0])), win = [medals[2], medals[1], medals[0]];
    // the dashed leader from the X to the glass goes down first, then the handle
    c.save(); c.strokeStyle = look.key; c.lineWidth = 1.6; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X[0], X[1]); c.lineTo(cx + Math.cos(a) * Rk, cy + Math.sin(a) * Rk); c.stroke(); c.setLineDash([]);
    c.lineCap = 'round'; c.lineWidth = 7; c.beginPath(); c.moveTo(cx - Math.cos(a) * Rk * 1.0, cy - Math.sin(a) * Rk * 1.0); c.lineTo(cx - Math.cos(a) * (Rk + 18), cy - Math.sin(a) * (Rk + 18)); c.stroke();
    c.globalCompositeOperation = 'multiply'; c.strokeStyle = look.warm; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - Math.cos(a) * (Rk + 2) + 1.5, cy - Math.sin(a) * (Rk + 2) - 1); c.lineTo(cx - Math.cos(a) * (Rk + 17) + 1.5, cy - Math.sin(a) * (Rk + 17) - 1); c.stroke(); c.restore();
    c.save(); c.beginPath(); c.arc(cx, cy, Rk, 0, TAU); c.clip();
    // the glass: the printed lawn at Z times, so the halftone is magnified too, a quarter of paper over it
    const sw = (2 * Rk) / Z; c.drawImage(bg.cv, (X[0] - sw / 2) * dpr, (X[1] - sw / 2) * dpr, sw * dpr, sw * dpr, cx - Rk, cy - Rk, 2 * Rk, 2 * Rk);
    c.globalAlpha = 0.25; c.fillStyle = look.paper; c.fillRect(cx - Rk, cy - Rk, 2 * Rk, 2 * Rk); c.globalAlpha = 1;
    const gball = (p, shadow) => {
      const r = heroR(p) * Z, [x, yb] = to(p.x, gy(p.z)), sp = sprite(Math.round(r * 2) / 2);
      // your ball keeps its disc of sun ink on bare paper, magnified with the rest
      if (p === mineBall) { const dr = rOf(p.z) * Z * 1.55; c.save(); c.globalAlpha = 0.9; c.fillStyle = look.paper; c.beginPath(); c.arc(x, yb - r, dr, 0, TAU); c.fill(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 1; c.fillStyle = look.sun; c.beginPath(); c.arc(x + OFF.sun[0] * wk, yb - r + OFF.sun[1] * wk, dr, 0, TAU); c.fill(); c.restore(); }
      if (shadow) { c.save(); c.globalAlpha = 0.18; c.globalCompositeOperation = 'multiply'; c.fillStyle = look.key; c.beginPath(); c.ellipse(x + 0.4 * r, yb + 0.3 * r, r, r * 0.34, 0, 0, TAU); c.fill(); c.restore(); }
      c.drawImage(sp.cv, x - sp.size / 2, yb - r - sp.size / 2, sp.size, sp.size);
    };
    for (const p of near) if (!p.medal && p !== mineBall) gball(p, true);
    if (mineBall && !mineBall.medal && near.includes(mineBall)) gball(mineBall, true);
    if (dimK > 0.002) { c.save(); c.globalAlpha = dimK * 0.8; c.drawImage(veil.cv, 0, 0, W, H); c.restore(); }
    // the X, printed over the pile: slim in the glass, so the three stay the picture
    paintX(c, [cx, cy], xArms.map((arm) => arm.map((v) => v * Z * 0.34)), { w: Math.max(2.4, xw * wk * 0.7), ring: Math.max(5, xr * wk * 0.8), k: wk * 0.8 });
    // the rings, behind the balls: the three touch, so each ring shows round the edge of its own ball
    win.forEach((p, i) => {
      if (!p) return; const t0 = REVEAL.tape[i]; if (revT < t0) return;
      const r = heroR(p) * Z, [x, yb] = to(p.x, gy(p.z));
      ring(c, x, yb - r, (r + 3.5 * wk) * ease.back((revT - t0) / 0.28), p.medal, 5 * wk, 1, 1.4 * Math.min(wk, 1.6));
    });
    if (mineBall && near.includes(mineBall)) { const r = heroR(mineBall) * Z, [x, yb] = to(mineBall.x, gy(mineBall.z)); mineRing(c, x, yb - r, r + (mineBall.medal ? 5 * wk + 9 : 4 * wk), 3.2 * wk); }
    // the three, and your ball, on top
    for (const p of win) if (p && near.includes(p)) gball(p, false);
    if (mineBall && !mineBall.medal && near.includes(mineBall)) gball(mineBall, false);
    // the tapes run from the edge of the X's ring to the middle of each ball, over it, each in its medal's ink: when a ball sits on the X this
    // is the only place the measure shows
    const xrG = Math.max(5, xr * wk * 0.8);
    win.forEach((p, i) => {
      if (!p) return; const t0 = REVEAL.tape[i]; if (revT < t0) return;
      const k = ease.io((revT - t0) / REVEAL.per), r = heroR(p) * Z, [x, yb] = to(p.x, gy(p.z)), end = [x, yb - r + r * 0.2];
      tapeDraw(c, fromRing([cx, cy], end, xrG + 2), end, k, 5 * wk, 6 * wk, 6 * wk, p.medal);
    });
    c.restore();
    c.save(); c.strokeStyle = look.key; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, Rk, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'multiply'; c.strokeStyle = look.warm; c.lineWidth = 3; c.beginPath(); c.arc(cx + 1.5, cy - 1, Rk + 1.5, 0, TAU); c.stroke(); c.restore();
    // the callouts, last and outside the glass's clip: each on a leader to its own ball, the number on its pill (a medal's with its place) over its
    // distance on paper. They come when their tape has landed.
    const th = hasLang('th'), place = ['1st', '2nd', '3rd'], placeTh = ['ที่ 1', 'ที่ 2', 'ที่ 3'];
    lab.forEach((q) => {
      const i = q.p.medal ? 3 - q.p.medal : 2, t0 = REVEAL.tape[i] + REVEAL.per; if (revT < t0 || g < 0.98) return;
      const al = ease.back((revT - t0) / 0.2), dx = q.x - q.bx, dy = q.y - q.by, d = Math.hypot(dx, dy) || 1, r = q.br + 5 * wk + 4;
      if (d > r + 4) { c.save(); c.lineCap = 'round'; const x1 = q.bx + (dx / d) * r, y1 = q.by + (dy / d) * r, x2 = q.x - (dx / d) * 6, y2 = q.y - (dy / d) * 6; c.strokeStyle = look.paper; c.lineWidth = 4.4; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = look.key; c.lineWidth = 1.7; c.stroke(); c.restore(); }
      const words = q.you ? `${th ? 'คุณ' : 'you'} · ${dm(q.p, th)}` : `${th ? placeTh[q.p.medal - 1] : place[q.p.medal - 1]} · ${dm(q.p, th)}`;
      c.save(); c.translate(q.x, q.y); c.scale(al, al); tag(c, q.p, 0, -9, 14, q.you ? 4 : q.p.medal); label(c, words, 0, 10, 12); c.restore();
    });
  }
  // a rubber stamp in the warm drum: Thai over English when both show, on the side the loupe is not
  function drawStamp(c, now) {
    const age = (now - stamp) / 1000, k = calm ? 1 : ease.out(age / 0.2), s = lerp(1.7, 1, k);
    const both = !document.documentElement.classList.contains('lang-th') && !document.documentElement.classList.contains('lang-en'), lines = both ? ['สถิติใหม่!', 'New best'] : [t2('สถิติใหม่!', 'New best')];
    c.save(); c.font = `800 ${both ? 16 : 19}px ${FONT}`; const w = Math.ceil(Math.max(...lines.map((l) => c.measureText(l).width))) + 26, h = lines.length * 22 + 12;
    const left = !loupe || loupe.cx > W / 2, x = left ? w / 2 + 14 : W - w / 2 - 14, y = Math.max(h / 2 + 10, L.hy * 0.42);
    c.translate(x, y); c.rotate((left ? -6 : 6) * DEG); c.scale(s, s); c.globalAlpha = Math.min(1, k * 1.4); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = look.paper; c.beginPath(); c.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 9); c.fill();
    c.globalCompositeOperation = 'multiply'; c.strokeStyle = look.warm; c.fillStyle = look.warm; c.lineWidth = 3.5; c.beginPath(); c.roundRect(-w / 2 + 1.5, -h / 2 - 1, w, h, 7); c.stroke(); lines.forEach((l, i) => c.fillText(l, 1.5, (i - (lines.length - 1) / 2) * 22 - 0.5));
    c.globalCompositeOperation = 'source-over'; c.strokeStyle = look.key; c.lineWidth = 1.3; c.beginPath(); c.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 9); c.stroke();
    c.restore();
  }

  // ── time ───────────────────────────────────────────────────────────────────
  function update(dt, now) {
    let moving = false; frame++;
    if (phase === 'fall') { moving = step(dt); if (!moving) finish(); }
    if (phase === 'reveal') {
      if (!calm) revT += dt;
      // the beats: the glass opens, then bronze, silver and gold each land on their own note
      if (!calm) {
        if (!revSnd[3] && revT >= REVEAL.loupe[0]) { revSnd[3] = true; voice(220, 0.32, 0.05, 'sine', 520); }
        REVEAL.tape.forEach((t0, i) => { if (revSnd[i] || revT < t0) return; revSnd[i] = true; if (i === 0) voice(392, 0.25, 0.08); else if (i === 1) voice(523, 0.25, 0.08); else { voice(784, 0.4, 0.1); voice(1175, 0.4, 0.05); } buzz(10); });
      }
      if (revT < REVEAL.end + 0.2 || (stamp > 0 && now - stamp < 400)) moving = true;
      if (revT >= REVEAL.tape[2] + REVEAL.per && !shown) { showResult(); if (!calm) people.forEach((p, i) => (p.hop = now + (i % 6) * 45)); }
      if (revT >= REVEAL.end && shown) { phase = 'done'; revT = 9; if (pendingBake) rebake(pendingBake === 'size'); }
    }
    // every three seconds the burner roars; the basket lifts a hair
    if (!calm && now > nextWh) { wh = now; nextWh = now + 3000; }
    return moving;
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - (prev || now)) / 1000); prev = now;
    const moving = update(dt, now); draw(now);
    if (vis && (moving || !calm)) requestAnimationFrame(loop); else { run = false; prev = 0; }
  }
  function kick() { if (!run && vis && baked) { run = true; prev = 0; requestAnimationFrame(loop); } else if (!run && baked) draw(performance.now()); }

  // ── the Share card: the lawn round the X and your ball, the three ringed with their numbers, a tape to the X, the QR ───
  async function buildCard() {
    try { await Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 50px "Noto Sans Thai"')]); } catch (e) {}
    const CW = 1080, CH = 1350, cd = document.createElement('canvas'); cd.width = CW; cd.height = CH; const g = cd.getContext('2d');
    g.fillStyle = look.paper; g.fillRect(0, 0, CW, CH);
    // the words come first: they set where the picture starts
    const d = dm(mineBall), dT = dm(mineBall, true), head = pos <= 3 ? `Ball ${mine} finished ${ord(pos)}!` : `Ball ${mine} landed ${d} from the X`;
    const thai = pos <= 3 ? `ลูกหมายเลข ${mine} ได้อันดับ ${pos} ห่างกากบาท ${dT}` : `ลูกหมายเลข ${mine} ตกห่างจากกากบาท ${dT}`;
    g.textBaseline = 'alphabetic'; g.font = `800 84px ${FONT}`;
    const lines = ['']; head.split(' ').forEach((w) => { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (g.measureText(t).width > 960 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
    lines.length = Math.min(2, lines.length);
    lines.forEach((l, i) => { g.globalCompositeOperation = 'multiply'; g.fillStyle = look.warm; g.fillText(l, 63, 112 + i * 92); g.globalCompositeOperation = 'source-over'; g.fillStyle = look.key; g.fillText(l, 60, 109 + i * 92); });
    const ty = 109 + (lines.length - 1) * 92 + 62; g.font = `700 46px ${THAI}`; g.fillStyle = look.key; g.fillText(thai, 60, ty);
    // the picture, cropped tight: the X, the three, your ball and a margin, at up to six times the page's size; on a warm offset, framed in key
    const wx = 60, wy = ty + 40, ww = 960, wh2 = 1010 - wy, asp = ww / wh2, gnd = (p) => [p.x, gy(p.z)];
    const pts = [[L.x[0], L.x[1]]].concat(medals.map(gnd), [gnd(mineBall)]), top = Math.min(...pts.map((q) => q[1])) - 3 * rOf(0.9), bot = Math.max(...pts.map((q) => q[1])) + 8;
    const x0 = Math.min(...pts.map((q) => q[0])) - 30, x1 = Math.max(...pts.map((q) => q[0])) + 30;
    let cw = Math.max(x1 - x0, (bot - top + 30) * asp, 150), ch = cw / asp;
    if (cw > W) { cw = W; ch = cw / asp; } if (ch > H) { ch = H; cw = ch * asp; }
    const s = ww / cw, sx = clamp((x0 + x1) / 2 - cw / 2, 0, W - cw), sy = clamp((top + bot) / 2 - ch / 2, 0, H - ch), P = (x, y) => [wx + (x - sx) * s, wy + (y - sy) * s];
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = look.warm; g.fillRect(wx + 12, wy + 12, ww, wh2); g.restore();
    g.save(); g.beginPath(); g.rect(wx, wy, ww, wh2); g.clip();
    g.drawImage(bg.cv, sx * dpr, sy * dpr, cw * dpr, ch * dpr, wx, wy, ww, wh2);
    const ballAt = (p, k = 1) => { const r = heroR(p) * s * k, [x, yb] = P(p.x, gy(p.z)); return { r, x, y: yb - r, yb }; };
    for (const p of order.slice().sort((a, b) => a.z - b.z)) { const b = ballAt(p), sp = dropBall(Math.round(b.r * 2) / 2, 1); g.drawImage(sp.cv, b.x - sp.size / 2, b.yb - b.r - sp.size / 2, sp.size, sp.size); }
    // the field steps back under a wash of paper, as it does on the page; the X is printed over the pile
    g.save(); g.globalAlpha = 0.3; g.fillStyle = look.paper; g.fillRect(wx, wy, ww, wh2); g.restore();
    const [ax, ay] = P(L.x[0], L.x[1]), kx = Math.max(1, s / 2.2);
    paintX(g, [ax, ay], xArms.map((arm) => arm.map((v) => v * s * 0.85)), { w: xw * kx * 1.3, ring: xr * s * 0.9, k: kx });
    // your ball's tape from the X at its full length, and the distance on a pill at its middle
    const mb = ballAt(mineBall), tw = Math.max(12, s * 1.9);
    // rings behind the three and yours, then the balls themselves over the rings
    const keep3 = medals.concat(mineBall.medal ? [] : [mineBall]);
    keep3.forEach((p) => { const b = ballAt(p); if (p === mineBall && !p.medal) mineRing(g, b.x, b.y, b.r + Math.max(10, s * 1.5), Math.max(4, s * 0.8)); else ring(g, b.x, b.y, b.r + Math.max(7, s * 1.1), p.medal, Math.max(8, s * 1.5), 1, 3); });
    keep3.forEach((p) => { const b = ballAt(p), sp = dropBall(Math.round(b.r * 2) / 2, 1); g.drawImage(sp.cv, b.x - sp.size / 2, b.yb - b.r - sp.size / 2, sp.size, sp.size); });
    const mEnd = [mb.x, mb.y + mb.r * 0.2]; tapeDraw(g, fromRing([ax, ay], mEnd, xr * s * 0.9 + 6), mEnd, 1, tw, tw * 1.7, tw * 1.2, mineBall.medal || 1);
    const pill = (txt, x, y, size) => {
      g.save(); g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = g.measureText(txt).width + size * 0.9, h = size * 1.55;
      g.fillStyle = look.key; g.beginPath(); g.roundRect(x - w / 2 + 4, y - h / 2 + 4, w, h, h / 2); g.fill();
      g.fillStyle = look.paper; g.strokeStyle = look.key; g.lineWidth = 4; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill(); g.stroke();
      g.fillStyle = look.key; g.fillText(txt, x, y + size * 0.04); g.restore();
    };
    const tl = Math.hypot(mb.x - ax, mb.y - ay), nx = tl > 1 ? -(mb.y - ay) / tl : 0, ny = tl > 1 ? (mb.x - ax) / tl : -1, off = tl < 150 ? 62 : 0, sgn = ny > 0 ? -1 : 1;
    pill(d, (ax + mb.x) / 2 + nx * off * sgn, (ay + mb.y) / 2 + ny * off * sgn, 38);
    // a pill with the number for each of the three and one for you, on leaders, on the sides away from the tape
    const cl = medals.map((p) => ballAt(p)), cxm = cl.reduce((t, b) => t + b.x, 0) / cl.length, cym = cl.reduce((t, b) => t + b.y, 0) / cl.length, away = Math.atan2(ay - mb.y, ax - mb.x), seatR = Math.max(...cl.map((b) => Math.hypot(b.x - cxm, b.y - cym) + b.r)) + Math.max(70, s * 9);
    const seats = [-120, -60, 90, -150, -30, 150, 30, 180, 0, -90, 120, 60].map((dg) => { const t = dg * DEG; return [cxm + Math.cos(t) * seatR, cym + Math.sin(t) * seatR * 0.8, Math.abs(Math.atan2(Math.sin(t - away), Math.cos(t - away)))]; }).sort((u, v) => u[2] - v[2]);
    const take = []; seats.forEach((q) => { if (take.length < 3 && take.every((o) => Math.hypot(q[0] - o[0], q[1] - o[1]) > 150)) take.push(q); });
    let pick = [0, 1, 2], pd = 1e9; for (const q of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) { const dd = cl.reduce((t, b, i) => t + Math.hypot(b.x - take[q[i]][0], b.y - take[q[i]][1]), 0); if (dd < pd) { pd = dd; pick = q; } }
    const its = medals.map((p, i) => ({ p, b: cl[i], x: take[pick[i]][0], y: take[pick[i]][1], kind: p.medal }));
    if (!mineBall.medal) its.push({ p: mineBall, b: mb, x: mb.x, y: Math.max(wy + 50, mb.y - mb.r - 84), kind: 4, fixed: true });
    declutter(its, 150, 64);
    its.forEach((q) => { q.x = clamp(q.x, wx + 80, wx + ww - 80); q.y = clamp(q.y, wy + 50, wy + wh2 - 50); });
    its.forEach((q) => {
      const dx = q.x - q.b.x, dy = q.y - q.b.y, dl = Math.hypot(dx, dy) || 1, r0 = q.b.r + Math.max(12, s * 1.9);
      g.save(); g.strokeStyle = look.key; g.lineWidth = 4; g.beginPath(); g.moveTo(q.b.x + (dx / dl) * r0, q.b.y + (dy / dl) * r0); g.lineTo(q.x - (dx / dl) * 30, q.y - (dy / dl) * 22); g.stroke(); g.restore();
      tag(g, q.p, q.x, q.y, 36, q.kind);
    });
    // the page's own stamp: this is a simulation, in the frame
    { g.save(); g.translate(wx + ww - 168, wy + wh2 - 64); g.rotate(-5 * DEG); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 34px ${FONT}`;
      const bw = 262, bh = 92; g.fillStyle = look.paper; g.beginPath(); g.roundRect(-bw / 2 - 5, -bh / 2 - 5, bw + 10, bh + 10, 14); g.fill();
      g.globalCompositeOperation = 'multiply'; g.strokeStyle = look.warm; g.fillStyle = look.warm; g.lineWidth = 6; g.beginPath(); g.roundRect(-bw / 2 + 3, -bh / 2 - 1, bw, bh, 11); g.stroke(); g.fillText('Simulated', 3, -17); g.font = `800 30px ${THAI}`; g.fillText('ภาพจำลอง', 3, 22);
      g.globalCompositeOperation = 'source-over'; g.strokeStyle = look.key; g.lineWidth = 2.5; g.beginPath(); g.roundRect(-bw / 2 - 5, -bh / 2 - 5, bw + 10, bh + 10, 14); g.stroke(); g.restore(); }
    g.restore();
    g.strokeStyle = look.key; g.lineWidth = 6; g.strokeRect(wx, wy, ww, wh2);
    // the footer, and the page's QR dark on white at 220 px
    g.fillStyle = look.key; g.font = `800 40px ${FONT}`; g.fillText('Golf Ball Drop', 60, 1110); g.font = `600 32px ${FONT}`; g.fillText('Sat 30 Jan 2027 · Horizon Village', 60, 1160);
    g.font = `700 30px ${THAI}`; g.fillText('เสาร์ 30 ม.ค. 2570 · ฮอไรซอน วิลเลจ', 60, 1212);
    const { size, modules } = encodeQr(PAGE, { ecl: 'M' }), n = size + 8, q = 220, qx = CW - 60 - q, qy = CH - 60 - q, m = q / n;
    g.fillStyle = '#fff'; g.fillRect(qx, qy, q, q); g.fillStyle = '#1b2240';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) g.fillRect(Math.floor(qx + (x + 4) * m), Math.floor(qy + (y + 4) * m), Math.ceil(m), Math.ceil(m));
    g.strokeStyle = look.key; g.lineWidth = 4; g.strokeRect(qx, qy, q, q);
    return cd;
  }
  async function shareCard() {
    const fallback = () => shareText(last);
    try {
      if (!(navigator.canShare && navigator.share)) return fallback();
      const cd = await buildCard(), blob = await new Promise((r) => cd.toBlob(r, 'image/png'));
      const file = new File([blob], `golf-ball-drop-${mine}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: document.title, text: last, url: PAGE }).catch(() => {}); return; }
      fallback();
    } catch (e) { fallback(); }
  }

  // ── hands ──────────────────────────────────────────────────────────────────
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onBalloon = (p, now) => { const b = bal(now), x = p.x - b.x, y = p.y - b.y; return probe.isPointInPath(B.env, x, y) || (x > B.basket[0] - 6 && x < B.basket[0] + B.basket[2] + 6 && y > B.basket[1] - 6 && y < B.basket[1] + B.basket[3] + 6); };
  const onSock = (p) => sock.hit && p.x > sock.hit[0] && p.x < sock.hit[2] && p.y > sock.hit[1] && p.y < sock.hit[3];
  const hitPerson = (p) => { for (let i = people.length - 1; i >= 0; i--) { const q = people[i], u = q.h / 10; if (Math.abs(p.x - q.x) < 2.4 * u && p.y < q.base && p.y > q.base - 11 * u) return q; } return null; };
  function setWind(v) { wind.value = v; wind.dispatchEvent(new Event('input', { bubbles: true })); }
  cv.addEventListener('click', (e) => {
    if (!ensure()) return;
    const p = at(e), now = performance.now(), rr = cv.getBoundingClientRect();
    // the speaker answers at any time, so a drop can be muted as it patters
    if (speaker && Math.hypot(p.x - speaker.x, p.y - speaker.y) < 24) { wake(); setMute(!sound.muted); if (!sound.muted) voice(880, 0.12, 0.05); draw(now); return; }
    if (busy()) return;                                                // a drop in progress is not restarted by a tap on the picture
    if (onSock(p)) { const v = +wind.value + 1; setWind(v > +wind.max ? +wind.min : v); burst(e.clientX, e.clientY, 8); return; }
    if (onBalloon(p, now)) { wh = now; nextWh = now + 3000; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; burst(rr.left + p.x + Math.cos(a) * 18, rr.top + p.y + Math.sin(a) * 18, 1, true); } kick(); return; }
    const q = hitPerson(p); if (q) { q.hop = now; q.point = !q.point; burst(e.clientX, e.clientY, 10); kick(); return; }
    if (p.y < L.hy - 8) { dingbatFloat('balloon', e.clientX, e.clientY); return; }
    drop();
  });
  go.addEventListener('click', drop);
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') drop(); });
  wind.addEventListener('input', () => { if (baked) kick(); });
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { vis = e[0].isIntersecting; if (vis) kick(); }).observe(cv);
  // a new width starts the picture again; a new look only reprints it. Never in the middle of a drop.
  function rebake(resized) {
    pendingBake = false;
    if (resized) { balls = []; order = []; mineBall = null; medals = []; labels = []; loupe = null; phase = 'idle'; settled = true; shown = false; setIdle(); if (goTh) goTh.textContent = go0[0]; if (goEn) goEn.textContent = go0[1]; }
    bake(); kick();
  }
  // under the picture, until the first drop: what is about to happen, in the words the page uses. It is written quietly: it is not news.
  function setIdle() {
    res.setAttribute('aria-live', 'off');
    res.innerHTML = '<span class="res-idle"><span class="th">กดปล่อย! ลูก 300 ลูกจะร่วง สามลูกที่ใกล้ X ที่สุดชนะ</span><span class="en">Press Drop! 300 balls fall and the three nearest the X win.</span></span>';
    setTimeout(() => res.setAttribute('aria-live', 'polite'), 400);
  }
  // beside the number: a quiet button that picks one and lets it go, for a second try that is not a repeat
  (function luckyPick() {
    const lab = num.closest('label'); if (!lab || $('lucky-pick')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'lucky-pick'; b.className = 'btn quiet';
    b.innerHTML = '<span class="th">สุ่มเลข</span><span class="en">Lucky pick</span>';
    b.addEventListener('click', () => { num.value = 1 + (rand32() % 300); drop(); });
    lab.after(b);
  })();
  muteWatchers.push(() => { if (baked) kick(); });
  watchDock();
  const busy = () => phase === 'fall' || phase === 'reveal';
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => {
    const w = Math.round(cv.getBoundingClientRect().width); if (!baked || w === W) return;
    if (busy()) pendingBake = 'size'; else rebake(true);
  }, 200); });
  onLook(() => { if (!baked) return; if (busy()) { pendingBake = pendingBake || 'look'; return; } rebake(false); });
  // the paper first; the bake when it is near the screen, in idle time
  size(); flat(); setIdle();
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { io.disconnect(); idle(() => { if (ensure()) kick(); }); } }, { rootMargin: '600px 0px' }); io.observe(cv); }
  else idle(() => { if (ensure()) kick(); });
}

// Under 900 px a dock of two buttons sits fixed at the bottom of the screen. While one of the two pictures fills more than half the screen it
// slides away (css/toys.css says how), so it never covers the result; it comes back as the picture goes.
let dockWatched = false;
function watchDock() {
  if (dockWatched) return; dockWatched = true;
  const dk = document.getElementById('dock'), els = ['luck-cv', 'cv'].map($).filter(Boolean); if (!dk || !els.length) return;
  let queued = 0;
  const check = () => { queued = 0; const vh = innerHeight; const fill = Math.max(...els.map((e) => { const r = e.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)); })); dk.classList.toggle('away', fill > vh * 0.5); };
  const ask = () => { if (!queued) queued = requestAnimationFrame(check); };
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); check();
}
