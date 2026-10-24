// Give: pick an amount and the balloon fills; every ฿1,000 is a golf ball's worth (the 2026 price)
// and is dropped beside the basket. The way to give is the club's own (cmirotary.org/donate): a
// transfer to its Bangkok Bank account, then an email with the slip to the treasurer. "I've sent
// it!" lets the balloon go with a thank-you.
//
// The picture: the bag lies limp on the lawn and fills from its mouth up (the baked balloon cut
// into strips, each with its own width), the burner roars as it fills, the basket lifts a little
// at big amounts against two taut tethers, and each thousand lands as a ball that bounces and
// rests in a pile. Ground, balloon and glow are printed once, when the section comes near.
import { look, onLook, clamp, lerp, surface, screen, tone, crayon, path, blob, inkOf } from './riso.js';
import { bakeBalloon, bakeGround, ballSprite, flame } from './scene.js';
import { burst, toast, t2, copyText, dingbatFloat, shareText, calm } from './bits.js';

const TAU = Math.PI * 2, GRAV = 2400, BOUNCE = 0.42, FRIC = 0.86, STRIPS = 72, ROUND = 0.66, REACH = 1.36 / ROUND, PILOT = 0.22, CAP = 20, PULSE = 3.2, SEQ = 4.0;
const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');
const ACCOUNT = '390-4-85413-4', TO = 'treasurer@cmirotary.org';
const e3 = (u) => 1 - Math.pow(1 - clamp(u), 3);
const sm = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const back = (u) => { u = clamp(u); const c = 1.70158, x = u - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const bump = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
const lg = (a) => Math.log10(Math.max(1, a));
const rnd = (a, b) => a + Math.random() * (b - a);
// the envelope's half width at u (0 crown, 1 mouth), as scene.js draws it; used to set a fold across a strip
const halfW = (u) => (u <= 0.36 ? 0.5 * Math.sqrt(Math.max(0, 1 - ((0.36 - u) / 0.36) ** 2)) : 0.13 + 0.37 * Math.pow(Math.cos((((u - 0.36) / 0.64) * Math.PI) / 2), 1.15));
const nowT = () => performance.now() / 1000;
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 24));
// how full the balloon is for an amount. Every amount ends as a round balloon (ROUND, 0.66, is the first
// round one); what a bigger gift adds is size, then lift, pennants, stars and balls. A few baht is a small
// round balloon (sizeOf), not a limp bag: the limp bag is the first fill and the slide-in only.
const LADDER = [[500, 0.66], [1000, 0.76], [2500, 0.86], [5000, 0.93], [10000, 1.0], [100000, 1.06]].map(([a, f]) => [lg(a), f]);
function fillOf(a) {
  if (a < 500) return ROUND;
  const l = lg(a);
  for (let i = 1; i < LADDER.length; i++) if (l <= LADDER[i][0]) return lerp(LADDER[i - 1][1], LADDER[i][1], (l - LADDER[i - 1][0]) / (LADDER[i][0] - LADDER[i - 1][0]));
  return LADDER[LADDER.length - 1][1];
}
// the envelope's size: a smaller round balloon for a smaller gift (0.5 at ฿1, 0.88 at ฿500), to full size at
// ฿10,000, a little more beyond. sizeOf(a) is the part that comes from a gift under ฿500, 0.57 to 1; it is eased
// in the loop, so a typed amount grows the balloon instead of snapping it.
const sizeOf = (a) => (a < 500 ? lerp(0.5, 0.88, clamp((lg(a) - 1) / 1.7)) / 0.88 : 1);
const puffOf = (f, s = 1) => (0.88 + 0.12 * clamp((f - ROUND) / (1 - ROUND)) + Math.max(0, f - 1) * 0.7) * s;
// the email in pieces, so the letter on the page and the mailto link are made of the same words
const MAIL = {
  subject: (a) => `Golf Ball Drop: a gift of ${a}`, hello: 'Hello Treasurer,',
  sent: (a) => `I transferred ${a} to the club's Bangkok Bank account (${ACCOUNT}) for the children's projects, through the Golf Ball Drop page.`,
  name: 'Name:', date: 'Date and time of the transfer:', slip: 'My transfer slip is attached.', th: 'แนบสลิปการโอนมาด้วย ขอบคุณ',
};
const mailBody = (a) => `${MAIL.hello}\n\n${MAIL.sent(a)}\n\n${MAIL.name}\n${MAIL.date}\n\n${MAIL.slip}\n\n${MAIL.th}\n`;
const letterText = (a) => `To: ${TO}\nSubject: ${MAIL.subject(a)}\n\n${mailBody(a)}`;

export function give() {
  const $ = (id) => document.getElementById(id);
  const cv = $('give-cv'), say = $('give-say'), mail = $('give-mail'), other = $('give-amt'), sent = $('give-sent');
  if (!cv) return;
  const ctx = cv.getContext('2d'), dprG = Math.min(devicePixelRatio || 1, 2), dprB = Math.min(devicePixelRatio || 1, 1.5);
  const chips = [...document.querySelectorAll('.chips button')], root = document.documentElement;

  // ── state ──────────────────────────────────────────────────────────────────
  let W = 0, H = 0, bg = null, B = null, G = null;              // the printed pictures, and where things stand
  let amt = 1000, armed = false, wantArm = false, released = false, F = 0, tw = null, lift = 0, seen = false;
  let near = false, vis = true, seeRatio = false, baked = false, dirty = true, gen = 0, baking = false;
  let T = 0, prev = 0, run = false, anchor = 0, cycle = -1, tapT = -9, calmTap = 0;
  let balls = [], fx = [], seq = null, enter = null, pending = false, halfOn = false, halfBorn = -9;
  let liftNow = 0, swayA = 0, pendA = 0, heat = 0, roar = 0, sz = sizeOf(amt), thanked = false;   // sz: the envelope's size for a small gift, eased; thanked: the caption holds the thank-you
  let quiet = false, thx = null, sqT = -9, halfHop = -9, dandeT = -9, envTop = 0, envCx = 0, spots = { half: null, dande: null };   // quiet: sent, and the heap stays; thx: the chalk thank-you
  const cache = { bg: new Map(), bal: new Map() };
  const keep = (map, key, make, cap) => { if (map.has(key)) { const v = map.get(key); map.delete(key); map.set(key, v); return v; } const v = make(); map.set(key, v); if (map.size > cap) map.delete(map.keys().next().value); return v; };

  // ── the letter: what the email will say, with the amount retyped when it changes ──
  const letter = document.createElement('pre'), srLetter = document.createElement('p');
  letter.className = 'letter'; letter.setAttribute('aria-hidden', 'true');
  // the box, so that an unstyled pre never widens a phone's page; the type and the colour come from gbd.css (.letter)
  letter.style.cssText = 'border:2px dashed var(--line);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box';
  srLetter.setAttribute('aria-live', 'polite'); srLetter.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
  const subj = MAIL.subject('\u0001').split('\u0001'), body = MAIL.sent('\u0001').split('\u0001');
  const amtEl = () => { const b = document.createElement('b'); b.dataset.v = ''; return b; }, aSub = amtEl(), aBody = amtEl();
  // exactly what the mailto link sends: To, Subject, then the body as mailBody writes it
  letter.append(`To: ${TO}\nSubject: ${subj[0]}`, aSub, `${subj[1]}\n\n${MAIL.hello}\n\n${body[0]}`, aBody, `${body[1]}\n\n${MAIL.name}\n${MAIL.date}\n\n${MAIL.slip}\n\n${MAIL.th}`);
  // the steps, made here: the amount in step 1's heading, where the details come from under them, what to attach
  // (a mailto link cannot attach), and a copy of the address or of the letter for a phone with no mail app set up
  const steps = [...document.querySelectorAll('.how-give > li')], h1 = steps[0] && steps[0].querySelector('h3'), bank = steps[0] && steps[0].querySelector('.bank');
  const aHead = [];
  if (h1) { h1.innerHTML = '<span class="th">โอน <b data-v></b> เข้าบัญชีสโมสร</span><span class="en">Transfer <b data-v></b> to the club\'s account</span>'; aHead.push(...h1.querySelectorAll('b')); }
  if (bank) {
    const src = document.createElement('p'); src.className = 'src';
    src.innerHTML = '<span class="th">รายละเอียดตามหน้าบริจาคของสโมสร</span><span class="en">Same details as on the club\'s own page: <a href="https://www.cmirotary.org/donate" target="_blank" rel="noopener">cmirotary.org/donate</a></span>';
    bank.after(src);
  }
  const attach = document.createElement('p'), pills = document.createElement('div'), CP = '<i data-dingbat="copy" data-look="riso"></i>';
  attach.className = 'attach'; attach.innerHTML = '<span class="th">แนบสลิป (ภาพหน้าจอก็ได้) ก่อนกดส่ง</span><span class="en">Attach your slip (a screenshot is fine) before you press send.</span>';
  pills.className = 'pills';
  pills.innerHTML = `<button type="button" class="copy" data-copy="${TO}">${CP}<span class="th">คัดลอกอีเมล</span><span class="en">Copy address</span></button><button type="button" class="copy" id="give-copy-letter" data-copy="">${CP}<span class="th">คัดลอกจดหมาย</span><span class="en">Copy letter</span></button>`;
  const copyLetter = pills.querySelector('#give-copy-letter');
  if (mail) { mail.before(letter, srLetter, attach); mail.after(pills); }
  let srT = 0;
  function retype(el, to) {
    const from = el.dataset.v; if (from === to) return; el.dataset.v = to; clearInterval(el._iv); clearTimeout(el._to);
    if (calm || !from) { el.textContent = to; return; }
    let p = 0; while (p < from.length && p < to.length && from[p] === to[p]) p++;
    let q = 0; while (q < from.length - p && q < to.length - p && from[from.length - 1 - q] === to[to.length - 1 - q]) q++;
    const mid = to.slice(p, to.length - q), m = document.createElement('mark'); m.style.cssText = 'background:var(--sun);color:var(--key);padding:0';
    el.textContent = ''; el.append(to.slice(0, p), m, to.slice(to.length - q));
    let i = 0; el._iv = setInterval(() => { m.textContent = mid.slice(0, ++i); if (i >= mid.length) { clearInterval(el._iv); el._to = setTimeout(() => { if (el.dataset.v === to) el.textContent = to; }, 300); } }, 14);
  }
  function words() {
    const k = amt / 1000, nb = k >= 1 ? String(Math.round(k * 4) / 4) : null;
    const th = nb ? `${fmt(amt)} เท่ากับลูกกอล์ฟ ${nb} ลูก (ราคาปี 2569)` : `${fmt(amt)} เท่ากับครึ่งลูก`;
    const en = nb ? `${fmt(amt)} is the price of ${nb} ball${nb == 1 ? '' : 's'} (2026 price)` : `${fmt(amt)} is half a ball`;
    if (!thanked) say.innerHTML = amt < 1000 && amt !== 500 ? `<span class="th">${fmt(amt)} ช่วยได้ทุกบาท</span><span class="en">${fmt(amt)}: every baht helps</span>` : `<span class="th">${th}</span><span class="en">${en}</span>`;
    aHead.forEach((b) => retype(b, fmt(amt))); if (copyLetter) copyLetter.dataset.copy = letterText(fmt(amt));
    mail.href = `mailto:${TO}?subject=` + encodeURIComponent(MAIL.subject(fmt(amt))) + '&body=' + encodeURIComponent(mailBody(fmt(amt)));
    retype(aSub, fmt(amt)); retype(aBody, fmt(amt));
    clearTimeout(srT); srT = setTimeout(() => { srLetter.textContent = `Email to ${TO}. Subject: ${MAIL.subject(fmt(amt))}. ${MAIL.sent(fmt(amt))}`; }, calm ? 0 : 700);
  }

  // ── printing the picture, once, when the section comes near ────────────────
  const measure = () => { const r = cv.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
  // a cheap picture at once, in plain ink fills, while the printed one is made: sky, lawn and the chalk X
  function paper() {
    const [w, h] = measure(); if (!w || !h) return; W = w; H = h; cv.width = w * dprG; cv.height = h * dprG; ctx.setTransform(dprG, 0, 0, dprG, 0, 0);
    const c = ctx, g = geometry(w, h), [X, Y] = g.X, xa = g.xs * 0.72, ya = g.xs * 0.36;
    c.fillStyle = look.paper; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.35; c.fillStyle = inkOf('sky'); c.fillRect(0, 0, w, g.hy);
    c.globalAlpha = 0.5; c.fillStyle = inkOf('leaf'); c.fillRect(0, g.hy, w, h - g.hy); c.globalAlpha = 1;
    c.strokeStyle = look.paper; c.lineWidth = clamp(g.xs * 0.13, 4.6, 6.2); c.lineCap = 'round';
    c.beginPath(); c.moveTo(X - xa, Y - ya); c.lineTo(X + xa, Y + ya); c.moveTo(X + xa, Y - ya); c.lineTo(X - xa, Y + ya); c.stroke(); c.lineCap = 'butt';
  }
  // the basket sits at cx; the pile of balls is to its right (see layout); the right stake stands clear of the pile's far edge, so the
  // tether runs out past the balls instead of through them. On a narrow picture the basket moves left to make the room.
  function geometry(w, h) {
    const S = Math.max(96, Math.round(Math.min(w * 0.74, h * 0.5) / 8) * 8), r = clamp(w / 36, 7, 12), bhw = S * 0.085, span = r * 1.4 + 3.5 * r * 2.04 + r, stake = r * 1.7;
    const cx = Math.min(w * 0.62, w - 8 - stake - span - bhw);
    return { w, h, S, hy: Math.round(h * 0.66), r, X: [w * 0.30, h * 0.90], xs: Math.max(30, w * 0.10), cx, gy: Math.round(h * 0.915), pegH: Math.max(15, S * 0.085), pegR: cx + bhw + span + stake, pegL: Math.max(cx - w * 0.2, w * 0.30 + Math.max(30, w * 0.10) * 0.72 + 12) };
  }
  function bakeCloud(rx, seed, P) {
    const ry = rx * 0.32, w = Math.ceil(rx * 2.9), h = Math.ceil(rx * 1.15), cx = w / 2, cy = h * 0.46, s = surface(w, h, dprG), c = s.ctx, p = new Path2D();
    [[-0.5, 0.1, 0.55], [0, -0.15, 0.7], [0.5, 0.08, 0.5], [0.15, 0.22, 0.6], [-0.25, 0.25, 0.5]].forEach(([dx, dy, q], i) => p.addPath(path(blob(cx + dx * rx, cy + dy * rx * 0.6, rx * q, ry * q * 1.6, seed + i, 0.12))));
    c.fillStyle = look.paper; c.fill(p);
    c.save(); c.globalCompositeOperation = 'multiply'; screen(c, { x0: 0, y0: 0, x1: w, y1: h }, P, tone('sky') + 20, (x, y) => (y > cy + ry * 0.35 ? 0.13 : 0), inkOf('sky'), p); c.restore();
    return { cv: s.cv, w, h };
  }
  // a stake with yellow and black tape, as on the roped lawn in the photos
  function stake(c, x, y, h) {
    c.save(); c.globalCompositeOperation = 'multiply';
    c.fillStyle = inkOf('key'); c.globalAlpha = 0.16; c.beginPath(); c.ellipse(x + 1, y, h * 0.3, h * 0.07, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
    c.fillStyle = inkOf('warm'); c.fillRect(x - 1.5, y - h, 3, h);
    const bh = h * 0.12; for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? inkOf('key') : inkOf('sun'); c.fillRect(x - 2.4, y - h + 1 + k * bh, 4.8, bh); }
    c.fillStyle = inkOf('key'); c.globalAlpha = 0.55; c.fillRect(x + 0.2, y - h, 1.3, h); c.restore();
  }
  function makeGround(g) {
    const P = 4.6, pegs = [[g.pegL, g.gy - g.S * 0.05], [g.pegR, g.gy - g.S * 0.05]];
    const L = { w: g.w, h: g.h, hy: g.hy, x: g.X, xs: g.xs, tape: [], tapeW: 3, pitch: P, reg: 0.8, chedis: [0.12, 0.17, 0.88], clouds: [], skyTone: 0.8 };
    const s = surface(g.w, g.h, dprG); bakeGround(s, L, 17);
    pegs.forEach(([x, y]) => stake(s.ctx, x, y, g.pegH));
    const rx = Math.min(140, g.w * 0.16);
    return { cv: s.cv, pegTop: pegs.map(([x, y]) => [x, y - g.pegH]), clouds: [{ ...bakeCloud(rx * 0.9, 31, P), y: g.hy * 0.14, v: 5, x0: g.w * 0.12 }, { ...bakeCloud(rx * 0.7, 47, P), y: g.hy * 0.36, v: 3.4, x0: g.w * 0.66 }] };
  }
  function makeBalloon(g) {
    const b = bakeBalloon(g.S, dprB, 19), kx = b.cv.width / b.w, ky = b.cv.height / b.h, mY = b.top + b.H, rows = Math.ceil(mY * ky), top0 = Math.max(0, Math.floor((b.top - 3) * ky));
    // a paper keyline: the print's silhouette grown by three pixels, so the sky's dots do not run into the checks
    const halo = document.createElement('canvas'); halo.width = b.cv.width; halo.height = rows; const hc = halo.getContext('2d');
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; hc.drawImage(b.cv, 0, 0, b.cv.width, rows, Math.round(Math.cos(a) * 3 * kx), Math.round(Math.sin(a) * 3 * ky), b.cv.width, rows); }
    hc.globalCompositeOperation = 'source-in'; hc.fillStyle = look.paper; hc.fillRect(0, 0, halo.width, halo.height);
    hc.globalCompositeOperation = 'source-over'; hc.drawImage(b.cv, 0, 0, b.cv.width, rows, 0, 0, b.cv.width, rows);   // the keyline and the print in one, so a frame draws one strip, not two
    // the basket, cables and burner frame, to be drawn under the pilots
    const lower = document.createElement('canvas'); lower.width = b.cv.width; lower.height = b.cv.height - rows; const lc = lower.getContext('2d');
    lc.drawImage(b.cv, 0, rows, b.cv.width, lower.height, 0, 0, b.cv.width, lower.height);
    // the two pilots are cut out of it as a patch, so they can duck behind the rim and stand up to cheer
    const by = b.basket[1], px0 = Math.floor((b.cx - 0.07 * b.S) * kx), px1 = Math.ceil((b.cx + 0.07 * b.S) * kx), py0 = Math.floor((by - 0.094 * b.S) * ky) - rows, py1 = Math.ceil((by - 3) * ky) - rows;
    const pilots = document.createElement('canvas'); pilots.width = px1 - px0; pilots.height = py1 - py0; pilots.getContext('2d').drawImage(lower, px0, py0, pilots.width, pilots.height, 0, 0, pilots.width, pilots.height);
    lc.globalCompositeOperation = 'destination-out'; lc.fillRect(px0, py0, pilots.width, pilots.height); lc.globalCompositeOperation = 'source-over';
    // the glow: the sun drum's halftone on the lower third of the envelope, falling away from the mouth
    const glow = document.createElement('canvas'); glow.width = b.cv.width; glow.height = rows; const gc = glow.getContext('2d'); gc.setTransform(kx, 0, 0, ky, 0, 0);
    const R = 0.35 * b.H; screen(gc, { x0: b.cx - R, y0: mY - R, x1: b.cx + R, y1: mY }, Math.max(2.6, b.S / 60), tone('sun'), (x, y) => 0.55 * clamp(1 - Math.hypot(x - b.cx, (y - mY) * 1.15) / R), inkOf('sun'), b.env);
    return { b, env: halo, lower, pilots, pRect: [px0 / kx, (py0 + rows) / ky, pilots.width / kx, pilots.height / ky], glow, kx, ky, rows, rowsCss: rows / ky, top0 };
  }
  function bake(force) {
    if (!near && !force) { dirty = true; return; }
    const my = ++gen; dirty = false; baking = true;
    idle(() => {
      if (my !== gen) return;
      const [w, h] = measure(); if (!w || !h) { baking = false; dirty = true; return; }
      const g = geometry(w, h), t0 = performance.now();
      const bgE = keep(cache.bg, `${look.name}|${w}x${h}|${dprG}`, () => makeGround(g), 4), t1 = performance.now();
      idle(() => {
        if (my !== gen) return;
        const t2_ = performance.now(), bE = keep(cache.bal, `${look.name}|${g.S}|${dprB}|19`, () => makeBalloon(g), 4);
        W = w; H = h; cv.width = w * dprG; cv.height = h * dprG; ctx.setTransform(dprG, 0, 0, dprG, 0, 0);
        bg = bgE; B = bE; G = g; G.ms = [Math.round(t1 - t0), Math.round(performance.now() - t2_)]; baking = false; baked = true;
        layout(); if (wantArm) { wantArm = false; arm(); } else if (armed && !released) syncBalls(true); maybeShow(); paint1(); kick();
      });
    });
  }
  // where the pile can rest, in the order balls arrive: the first on the X, then a pyramid of 4, 3, 2, 1 beside
  // the basket filled from its bottom row up, then a second pyramid behind it, half a ball over and a ball and
  // a half up, drawn first. The X stays clear.
  function layout() {
    const r = G.r, bw = B.b.basket[2], d = r * 2.04, br = G.cx + bw / 2 + r * 1.4, gyc = G.gy - r, row = (j) => gyc - j * r * 1.74;
    const pyramid = (x0, up, back) => { const out = []; for (let j = 0; j < 4; j++) for (let k = 0; k < 4 - j; k++) out.push({ x: x0 + (k + j * 0.5) * d, y: row(j) - up, back }); return out; };
    G.slots = [{ x: G.X[0] - r * 0.5, y: gyc, back: false }, ...pyramid(br, 0, false), ...pyramid(br + d * 0.5, r * 1.6, true)].slice(0, CAP);
    G.pile = { x: br + 1.5 * d, y: row(3) - r * 1.7 }; G.liftMax = G.h * 0.075;
    balls.forEach((b) => { if (b.keep) { b.x = b.nx * G.w; b.y = b.fy = G.gy - r + b.dy * r; b.r = r; } });
  }

  // ── balls ──────────────────────────────────────────────────────────────────
  const nBalls = () => Math.min(CAP, Math.floor(amt / 1000));
  function spawn(slot, delay) {
    const s = G.slots[slot], r = G.r, x0 = s.x + rnd(-1.5, 1.5) * r, y0 = -r * 2 - rnd(0, 26), h = s.y - y0;
    // the sideways speed that ends on the slot: the flights add up to a known time
    let v = Math.sqrt(2 * GRAV * h), tot = v / GRAV, m = 1; v *= BOUNCE;
    while (v >= 40) { m *= FRIC; tot += ((2 * v) / GRAV) * m; v *= BOUNCE; }
    balls.push({ x: x0, y: y0, vx: (s.x - x0) / tot, vy: 0, r, slot, fy: s.y, st: 'wait', wait: delay, sq: 0, hit: 0, back: s.back });
  }
  function syncBalls(instant) {
    if (!baked || !armed || released || quiet) return;
    const n = nBalls(), mine = balls.filter((b) => b.slot >= 0 && b.st !== 'fly');
    if (instant || calm) { balls = balls.filter((b) => b.keep); for (let i = 0; i < n; i++) balls.push({ x: G.slots[i].x, y: G.slots[i].y, vx: 0, vy: 0, r: G.r, slot: i, fy: G.slots[i].y, st: 'rest', sq: 0, hit: 0, back: G.slots[i].back }); return; }
    if (n > mine.length) { let k = 0; for (let i = mine.length; i < n; i++) spawn(i, 0.05 + 0.11 * k++); }
    else for (const b of mine) if (b.slot >= n) { b.st = 'fly'; b.vy = -420; b.vx = rnd(-30, 30); }
  }
  function floorHit(b) {
    b.hit++; b.y = b.fy; b.vy *= -BOUNCE; b.vx *= FRIC;
    if (b.hit === 1) { b.sq = 0.08; if (b.slot === 0 || b.tossed) fx.push({ k: 'ring', x: b.x, y: b.fy + b.r * 0.8, t0: T, life: 0.5, r0: b.r }); }
    if (Math.abs(b.vy) < 40) {
      b.vy = 0; b.vx = 0; b.st = 'rest'; if (b.slot >= 0) b.x = G.slots[b.slot].x;
      if (b.tossed) { b.tossed = false; b.keep = true; b.slot = -1; b.nx = b.x / G.w; b.dy = (b.y - (G.gy - G.r)) / G.r; }
    }
  }
  function stepBalls(dt) {
    const n = Math.ceil(dt / 0.004), h = dt / n;
    for (const b of balls) {
      if (b.st === 'wait') { b.wait -= dt; if (b.wait <= 0) b.st = 'air'; continue; }
      if (b.sq > 0) b.sq = Math.max(0, b.sq - dt);
      if (b.st === 'fly') { b.vy -= 900 * dt; b.y += b.vy * dt; b.x += b.vx * dt; continue; }
      for (let i = 0; i < n && b.st === 'air'; i++) { b.vy += GRAV * h; b.y += b.vy * h; b.x += b.vx * h; if (b.vy > 0 && b.y >= b.fy) floorHit(b); }
    }
    balls = balls.filter((b) => !(b.st === 'fly' && b.y < -b.r * 2));
  }
  // a tap on a resting ball: it hops, with a ring and a few stars
  function hopBall(b) {
    b.st = 'air'; b.vy = -420; b.vx = 0; b.hit = 1; b.fy = b.y;
    fx.push({ k: 'ring', x: b.x, y: b.y + b.r * 0.8, t0: nowT(), life: 0.5, r0: b.r });
    for (let i = 0; i < 5; i++) fx.push({ k: 'star', x: b.x, y: b.y - b.r * 0.4, vx: rnd(-90, 90), vy: rnd(-230, -110), t0: nowT(), life: 0.75, s: rnd(4, 6.5), c: ['sun', 'warm', 'sky', 'sun', 'warm'][i] });
  }

  // ── the amount, and the balloon's answer ───────────────────────────────────
  function retarget() {
    const to = armed ? fillOf(amt) : 0;
    if (Math.abs(to - F) < 0.002 && !tw) return;
    if (calm) { F = to; tw = null; return; }
    const d = Math.abs(to - F);
    tw = { t0: nowT(), dur: 0.9 + 0.9 * d, from: F, to, os: clamp(0.04 / Math.max(d, 0.01), 0, 0.18), p: 0 };
  }
  function arm() { armed = true; released = false; if (!anchor) anchor = nowT(); retarget(); syncBalls(); kick(); }
  function set(a, from) {
    amt = clamp(Math.round(a) || 0, 1, 10000000);
    chips.forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.amt === amt && from !== 'other')));
    if (from) { quiet = false; thanked = false; fadeThanks(); }   // the caption goes back to the amount sentence
    words();
    if (!baked) { if (from) wantArm = true; return; }
    if (seq || enter) { pending = true; return; }
    if (from === 'chip') { tapT = nowT(); fireAt('ember', 4); }
    if (from) tidy();
    arm();
  }
  // the heap the crew tossed onto the lawn goes up and away when the next gift is picked
  function tidy() {
    if (calm) { balls = balls.filter((b) => !b.keep); return; }
    for (const b of balls) if (b.keep) { b.keep = false; b.st = 'fly'; b.vy = -rnd(300, 460); b.vx = rnd(-40, 40); }
  }
  function fadeThanks() { if (calm) thx = null; else if (thx && thx.out == null) thx.out = nowT(); }
  function maybeShow() { if (baked && near && vis && seeRatio && !seen) { seen = true; if (!armed && !seq && !enter) arm(); } }

  // ── effects ────────────────────────────────────────────────────────────────
  const origin = () => ({ x: G.cx - B.b.w / 2 + (enter ? enter.dx : 0), y: G.gy - (B.b.basket[1] + B.b.basket[3]) - liftNow });
  function fireAt(kind, n) {
    if (!baked || calm) return; const o = origin(), x = o.x + B.b.mouth[0], y = o.y + B.b.mouth[1];
    for (let i = 0; i < n; i++) {
      if (kind === 'ember') fx.push({ k: 'ember', x: x + rnd(-6, 6), y: y - 6, vx: rnd(-14, 14), vy: rnd(-110, -60), t0: nowT(), life: rnd(0.7, 1.1), s: rnd(1.4, 2.6) });
      else fx.push({ k: 'star', x, y: y - 10, vx: rnd(-110, 110), vy: rnd(-260, -90), t0: nowT(), life: 0.8, s: rnd(4, 7), c: ['sun', 'warm', 'sky', 'sun'][i % 4] });
    }
  }
  function confetti(n) {
    const inks = ['warm', 'sun', 'sky', 'key', 'warm', 'sun'];
    for (let i = 0; i < n; i++) fx.push({ k: 'conf', x: rnd(-10, G.w + 10), y: rnd(-150, -8), vx: rnd(-40, 40), vy: rnd(40, 160), t0: nowT(), life: 5, w: rnd(7, 13), h: rnd(4, 7), a: rnd(0, TAU), va: rnd(-9, 9), ph: rnd(0, TAU), c: i % 9 === 0 ? 'ball' : inks[i % inks.length] });
  }
  // a star printed as paper with an ink laid over its heart, so it reads on sky and on lawn
  function star(c, x, y, r, rot, ink) {
    c.save(); c.fillStyle = look.paper; sparkle(c, x, y, r, rot); c.fill(); c.strokeStyle = inkOf('key'); c.lineWidth = 0.9; c.stroke();
    c.globalCompositeOperation = 'multiply'; c.fillStyle = inkOf(ink); sparkle(c, x, y, r * 0.72, rot); c.fill(); c.restore();
  }
  function sparkle(c, x, y, r, rot) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = rot + (i * Math.PI) / 4, q = i % 2 ? r * 0.3 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
  function drawFx(c) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], age = T - f.t0; if (age < 0) continue;
      if (age > f.life) { fx.splice(i, 1); continue; }
      const u = age / f.life;
      if (f.k === 'ring') { const r = f.r0 * (0.8 + 2.8 * e3(u)); c.save(); c.strokeStyle = inkOf('key'); c.lineWidth = 1.7 * (1 - u) + 0.2; c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.34, 0, 0, TAU); c.stroke(); c.restore(); }
      else if (f.k === 'star') {
        const x = f.x + f.vx * age, y = f.y + f.vy * age + 520 * age * age, s = f.s * (1 - sm((u - 0.55) / 0.45)); if (s < 0.3) continue;
        star(c, x, y, s * 1.6, age * 5, f.c);
      } else if (f.k === 'ember') { const x = f.x + f.vx * age + Math.sin(age * 9 + f.s) * 3, y = f.y + f.vy * age; c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = inkOf(u < 0.5 ? 'sun' : 'warm'); c.beginPath(); c.arc(x, y, f.s * (1 - u), 0, TAU); c.fill(); c.restore(); }
      else if (f.k === 'seed') {   // a dandelion seed: a fluff on a hair, drifting up and off
        const x = f.x + f.vx * age + Math.sin(age * 5 + f.ph) * 7, y = f.y + f.vy * age - 16 * age * age, z = f.s * (1 - sm((u - 0.6) / 0.4));
        c.save(); c.strokeStyle = inkOf('key'); c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x - z * 0.9, y + z * 1.6); c.stroke();
        c.fillStyle = look.paper; c.beginPath(); c.arc(x, y, z, 0, TAU); c.fill(); c.stroke(); c.restore();
      } else if (f.k === 'conf') {
        const x = f.x + f.vx * age + Math.sin(age * 3 + f.ph) * 14, y = f.y + f.vy * age + 330 * age * age; if (y > G.h + 12) { fx.splice(i, 1); continue; }
        c.save(); c.translate(x, y); c.rotate(f.a + f.va * age);
        if (f.c === 'ball') { c.fillStyle = look.paper; c.strokeStyle = inkOf('key'); c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 3.4, 0, TAU); c.fill(); c.stroke(); c.fillStyle = inkOf('key'); c.globalAlpha = 0.5; c.beginPath(); c.arc(0.8, 0.8, 0.7, 0, TAU); c.fill(); }
        else { c.globalCompositeOperation = 'multiply'; c.fillStyle = inkOf(f.c); c.scale(1, Math.max(0.15, Math.abs(Math.cos(age * 7 + f.ph)))); c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); }
        c.restore();
      }
    }
  }

  // ── drawing the balloon ────────────────────────────────────────────────────
  // the envelope as strips of the baked print: the mouth fills first, the crown last, the crown flops
  // and ripples while slack, and a few folds draw the limp cloth
  function strips(c, o) {
    const { b, ky, rows, top0 } = B, S = G.S, n = STRIPS, total = rows - top0, my = o.y + rows / ky;
    if (F >= ROUND - 0.002 && !enter) {   // round: every strip is at its own width, so the whole envelope goes down in one piece
      const hh = (total / ky) * o.puff, ww = b.w * o.puff, x = o.x + b.cx - ww / 2; envTop = my - hh; envCx = o.x + b.cx;
      c.drawImage(B.env, 0, top0, B.env.width, total, x, my - hh, ww, hh);
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = clamp(0.25 + 0.75 * Math.min(1, heat)); c.drawImage(B.glow, 0, top0, B.glow.width, total, x, my - hh, ww, hh);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; return;
    }
    const hs = lerp(0.3, 1, sm(F / ROUND)) * o.puff * (enter ? lerp(0.4, 1, back(enter.p)) : 1), slump = enter ? 1 + 1.4 * (1 - enter.p) : 1, geo = []; let yb = my;
    for (let j = n - 1; j >= 0; j--) {
      const sy0 = top0 + Math.round((total * j) / n), sy1 = top0 + Math.round((total * (j + 1)) / n), dh = ((sy1 - sy0) / ky) * hs, u = clamp(((sy0 + sy1) / 2 / ky - b.top) / b.H);
      const g = clamp((REACH * F - (1 - u)) / 0.35), wsc = Math.max(lerp(0.42, 1, back(g)) * o.puff, 1 - Math.max(0, n - 3 - j) * 0.14);
      const off = -(1 - g) * (1 - g) * Math.pow(1 - u, 1.6) * 0.3 * S * slump + (calm ? 0 : Math.sin(u * 11 - T * 7) * 0.02 * S * (1 - g));
      geo[j] = { sy0, sy1, y: yb - dh, h: dh, w: b.w * wsc, x: o.x + b.cx + off - (b.w * wsc) / 2, g, u, wsc };
      yb -= dh;
    }
    envTop = geo[0].y; envCx = geo[0].x + geo[0].w / 2;
    const each = (src, from, op, alpha) => { c.globalCompositeOperation = op; c.globalAlpha = alpha; for (let j = from; j < n; j++) { const s = geo[j]; c.drawImage(src, 0, s.sy0, src.width, s.sy1 - s.sy0, s.x, s.y, s.w, s.h + 0.7); } };
    each(B.env, 0, 'source-over', 1);
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = clamp(0.25 + 0.75 * Math.min(1, heat));   // the glow, two strips at a time: it is soft
    for (let j = Math.floor(n * 0.6) & ~1; j + 1 < n; j += 2) { const a = geo[j], d = geo[j + 1]; c.drawImage(B.glow, 0, a.sy0, B.glow.width, d.sy1 - a.sy0, (a.x + d.x) / 2, a.y, (a.w + d.w) / 2, a.h + d.h + 0.7); }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    [0.2, 0.36, 0.52, 0.66, 0.8].forEach((uu, k) => {
      const s = geo[Math.min(n - 1, Math.floor(uu * n))], sl = 1 - s.g; if (sl < 0.1) return;
      const hw = S * halfW(s.u) * s.wsc, xc = s.x + s.w / 2, yy = s.y + s.h * 0.5;
      crayon(c, [[xc - hw * 0.8, yy + 3], [xc - hw * 0.15, yy - 2.5 + (k % 2) * 2], [xc + hw * 0.7, yy + 2]], { w: Math.max(1, S / 190), color: inkOf('key'), seed: 900 + k, alpha: 0.55 * sl, wobble: 0.5 });
    });
  }
  function drawFlame(c, x, y, k) { flame(c, x, y, G.S * 0.075, k, calm ? 0.4 : T); }
  // two lines from the basket's lower corners to two stakes: taut when the basket lifts, slack on the grass when it is let go.
  // `side` is 0 for the left line, 1 for the right: the right one is drawn after the balls, so it stays in sight over the pile
  function tether(c, o, tens, rel, side) {
    const [bx, by, bw, bh] = B.b.basket, S = G.S, px0 = o.x + B.b.cx, py0 = o.y + B.b.top;
    const P = (x, y) => [px0 + (x - px0) * Math.cos(swayA) - (y - py0) * Math.sin(swayA), py0 + (x - px0) * Math.sin(swayA) + (y - py0) * Math.cos(swayA)];
    const corners = [P(o.x + bx, o.y + by + bh), P(o.x + bx + bw, o.y + by + bh)], np = amt >= 25000 ? 5 : amt >= 10000 ? 4 : amt >= 5000 ? 3 : 0;
    bg.pegTop.forEach(([px, py], i) => {
      if (i !== side) return;
      const dir = i ? 1 : -1, a = corners[i], ex = lerp(a[0], px - dir * G.w * 0.1, sm(rel)), ey = lerp(a[1], G.gy - 1, e3(rel)), sag = lerp((1 - tens) * S * 0.07, S * 0.014, sm(rel)), pts = [];
      for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push([lerp(ex, px, u), lerp(ey, py, u) + Math.sin(u * Math.PI) * sag + Math.sin(u * 14 + i) * 1.2 * sm(rel)]); }
      crayon(c, pts, { w: Math.max(1.1, S / 190), color: inkOf('key'), seed: 77 + i, alpha: 0.9, wobble: 0.25 });
      if (np && rel < 0.05 && armed && !released) for (let q = 0; q < np; q++) {   // pennants on the line from ฿5,000
        const [x0, y0] = pts[2 + Math.round(((q + 0.5) / np) * 8)], z = S * 0.038; c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = inkOf(['warm', 'sun', 'sky'][(q + i) % 3]);
        c.beginPath(); c.moveTo(x0 - z * 0.55, y0); c.lineTo(x0 + z * 0.55, y0); c.lineTo(x0 + (calm ? 0 : Math.sin(T * 4 + q * 1.3 + i) * 1.4), y0 + z * 1.7); c.closePath(); c.fill(); c.restore();
      }
    });
  }
  function crownStars(c, o) {
    const S = G.S, cx = o.x + B.b.cx, cy = o.y + B.b.top + B.b.H * 0.16;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + (calm ? 0 : T * 0.6), z = S * 0.05 * (0.8 + 0.3 * (calm ? 0.5 : Math.sin(T * 4 + i * 1.7)));
      star(c, cx + Math.cos(a) * S * 0.5, cy + Math.sin(a) * S * 0.09 - S * 0.04, z * 1.2, 0, 'sun');
    }
  }
  function tuft(c, x, y, s) {
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = inkOf('leaf');
    [[-0.9, 0.9, -0.5], [-0.45, 1.2, -0.2], [0, 1.45, 0.05], [0.45, 1.15, 0.25], [0.9, 0.85, 0.5]].forEach(([dx, hh, lean]) => { c.beginPath(); c.moveTo(x + dx * s - s * 0.2, y); c.quadraticCurveTo(x + dx * s - s * 0.05, y - hh * s * 0.6, x + dx * s + lean * s * 0.9, y - hh * s); c.quadraticCurveTo(x + dx * s + s * 0.1, y - hh * s * 0.4, x + dx * s + s * 0.2, y); c.fill(); });
    c.restore();
  }
  function chalk(c, str, x, y, px) {
    c.save(); c.font = `800 ${px}px "Bricolage Grotesque","Noto Sans Thai",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.strokeStyle = look.paper; c.lineWidth = 4; c.strokeText(str, x, y); c.fillStyle = inkOf('key'); c.fillText(str, x, y); c.restore();
  }
  // less than a ball: half a ball sunk in a tuft, or a dandelion seed head; a tap hops the one and blows the other
  function smallGift(c) {
    const n = nBalls(), r = G.r, live = armed && !released && !quiet, half = live && n < CAP && amt - n * 1000 >= 500, dande = live && n === 0 && amt < 500;
    spots.half = spots.dande = null;
    if (half !== halfOn) { halfOn = half; if (half) halfBorn = T; }
    if (half) {
      const s = G.slots[n], k = calm ? 1 : back((T - halfBorn) / 0.35), sp = ballSprite(Math.round(r * 2) / 2, dprG), yg = s.y + r;
      const hu = calm ? -1 : (T - halfHop) / 0.75, hop = hu >= 0 && hu < 1 ? 2.7 * r * 4 * hu * (1 - hu) : 0, land = hu >= 0.85 && hu < 1 ? Math.sin(((hu - 0.85) / 0.15) * Math.PI) : 0;
      c.save(); c.beginPath(); c.rect(s.x - r * 2.4, yg - r * 7, r * 4.8, r * 7); c.clip();
      c.translate(s.x, yg); c.scale(1 + 0.12 * land, 1 - 0.12 * land); c.translate(-s.x, -yg);
      c.drawImage(sp.cv, s.x - sp.size / 2, yg + r * (1 - k) - hop - sp.size / 2, sp.size, sp.size); c.restore();
      tuft(c, s.x, yg + 1, r * 0.75 * (1 + (hu >= 0 && hu < 0.4 ? 0.18 * Math.sin((hu / 0.4) * Math.PI) : 0))); chalk(c, '½', s.x, yg - r * 2.4 - hop * 0.45, Math.round(r * 1.3));
      spots.half = { x: s.x, y: yg - r * 0.6, d: r * 2 };
    }
    if (dande) {
      const x = G.slots[0].x, y = G.slots[0].y + r * 0.8, du = calm ? -1 : T - dandeT, shake = du >= 0 && du < 1 ? Math.sin(du * 26) * Math.exp(-du * 4) * 3 : 0, hx = x + (calm ? 0 : Math.sin(T * 1.7) * 1.2) + shake, hy = y - r * 2.1;
      crayon(c, [[x, y], [(x + hx) / 2, y - r], [hx, hy]], { w: 1.3, color: inkOf('leaf'), seed: 61, wobble: 0.3 });
      c.save(); c.strokeStyle = inkOf('key'); c.lineWidth = 0.7;
      for (let i = 0; i < 14; i++) {
        if (du >= 0 && du < 2.6 && !(du < 0.04 + i * 0.03 || du > 1.2 + i * 0.07)) continue;   // blown off, then it grows them back
        const a = (i / 14) * TAU + 0.2, l = r * (0.85 + 0.15 * (i % 2)), x1 = hx + Math.cos(a) * l, y1 = hy + Math.sin(a) * l; c.beginPath(); c.moveTo(hx, hy); c.lineTo(x1, y1); c.stroke(); c.fillStyle = look.paper; c.beginPath(); c.arc(x1, y1, 1.3, 0, TAU); c.fill(); c.stroke();
      }
      c.fillStyle = inkOf('key'); c.beginPath(); c.arc(hx, hy, 1.6, 0, TAU); c.fill(); c.restore(); tuft(c, x, y + 1, r * 0.6);
      spots.dande = { x: hx, y: (hy + y) / 2, d: r * 2.4 };
    }
  }
  function drawBalls(c) {
    const r = G.r, sp = ballSprite(Math.round(r * 2) / 2, dprG), list = balls.filter((b) => b.st !== 'wait').sort((a, b) => (a.back ? 0 : 1) - (b.back ? 0 : 1) || a.y - b.y);
    for (const b of list) {
      const sq = b.sq > 0 ? 0.1 * Math.sin((1 - b.sq / 0.08) * Math.PI) : 0, up = clamp((b.fy - b.y) / 160), gr = b.grow != null ? 0.4 + 0.6 * e3((T - b.grow) / 0.18) : 1;
      if (b.st !== 'fly') { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = inkOf('key'); c.globalAlpha = 0.17 * (1 - up * 0.6); c.beginPath(); c.ellipse(b.x + 1.5, b.fy + r * 0.92, r * (0.95 - up * 0.2), r * 0.24, 0, 0, TAU); c.fill(); c.restore(); }
      c.save(); c.translate(b.x, b.y + r); c.scale((1 + sq) * gr, (1 - sq) * gr); c.drawImage(sp.cv, -sp.size / 2, -r - sp.size / 2, sp.size, sp.size); c.restore();
    }
    const total = Math.floor(amt / 1000);
    if (armed && !released && !quiet && total > CAP) chalk(c, '×' + total.toLocaleString('en-US'), G.pile.x, G.pile.y, Math.round(r * 1.7));
    else if (quiet && total > CAP) { const hs = balls.filter((b) => b.keep && b.st === 'rest'); if (hs.length) chalk(c, '×' + total.toLocaleString('en-US'), hs.reduce((a, b) => a + b.x, 0) / hs.length, Math.min(...hs.map((b) => b.y)) - r * 1.9, Math.round(r * 1.7)); }
  }
  // the thank-you: warm letters with a key edge on paper
  let banner = null;
  const langMode = () => (root.classList.contains('lang-en') ? 'en' : root.classList.contains('lang-th') ? 'th' : 'both');
  const bannerW = () => Math.round(Math.min(G.w * 0.5, 190));
  function makeBanner(w, h) {
    const mode = langMode(), key = `${look.name}|${mode}|${w}|${dprG}`; if (banner && banner.key === key) return banner;
    const s = surface(w, h, dprG), c = s.ctx; c.fillStyle = look.paper; c.beginPath(); c.roundRect(1, 1, w - 2, h - 2, 4); c.fill(); c.strokeStyle = inkOf('key'); c.lineWidth = 2.2; c.stroke();
    c.fillStyle = inkOf('sun'); c.globalCompositeOperation = 'multiply'; c.fillRect(5, h - 9, w - 10, 3); c.globalCompositeOperation = 'source-over';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const line = (str, px, y) => { c.font = `800 ${px}px "Bricolage Grotesque","Noto Sans Thai",sans-serif`; c.strokeStyle = inkOf('key'); c.lineWidth = Math.max(2, px * 0.14); c.strokeText(str, w / 2, y); c.fillStyle = inkOf('warm'); c.fillText(str, w / 2, y); };
    if (mode === 'both') { line('ขอบคุณ', h * 0.4, h * 0.36); line('Thank you', h * 0.27, h * 0.7); } else line(mode === 'th' ? 'ขอบคุณ' : 'Thank you', h * 0.46, h * 0.46);
    return (banner = { key, cv: s.cv, w, h });
  }
  // its right edge is tied at x, and it streams to the left, rippling more the further from the tie
  function drawBanner(c, x, y, reveal, still, w = bannerW()) {
    const h = Math.round(w * 0.3), bn = makeBanner(w, h), n = 24, sw = w / n;
    for (let i = 0; i < n; i++) {
      const dist = (n - 1 - i) / n; if (dist > reveal) continue;
      const rip = still ? 0 : Math.sin((n - i) * sw * 0.05 - T * 8) * 5.5 * dist + 2.5 * bump(dist);
      c.drawImage(bn.cv, Math.floor(i * sw * dprG), 0, Math.ceil(sw * dprG) + 1, bn.cv.height, x - w + i * sw, y - h / 2 + rip, sw + 0.8, h);
    }
    return h;
  }
  // ropes from the basket to the banner, and a string of pennants trailing the other way. Held still (reduced
  // motion) the banner hangs across the envelope's belly, a rope from each end to the envelope's edge, and the
  // pennant string starts from the same height and drapes down the side to the basket.
  function drawHang(c, o, s) {
    const [bx, by, bw, bh] = B.b.basket, S = G.S, key = inkOf('key'), w = bannerW(), h = Math.round(w * 0.3), still = calm && !seq, mx = o.x + B.b.cx;
    // held still, the banner is the one thank-you on the picture, so it is wide enough to read: 70% of the picture, but not wider than the belly it hangs across
    const bwid = still ? Math.round(clamp(G.w * 0.7, w * 0.8, S * 2 * halfW(0.36) * puffOf(F, sz) * 1.06)) : Math.round(w * 0.8);
    const k = still ? 1 : e3((s - 0.5) / 0.45), pts = [];
    if (still) {
      const p = puffOf(F, sz), ay = o.y + B.rows / B.ky - 0.64 * B.b.H * p, hw = S * halfW(0.36) * p, ex = mx + hw, bxr = o.x + bx + bw + 3, byy = o.y + by + bh * 0.05, bow = clamp(G.w - ex - 8, 5, S * 0.12), hb = Math.round(bwid * 0.3);
      drawBanner(c, mx + bwid / 2, ay, 1, true, bwid);
      [[mx - bwid / 2, mx - hw], [mx + bwid / 2, mx + hw]].forEach(([x0, x1], i) => crayon(c, [[x0, ay - hb * 0.4], [(x0 + x1) / 2, ay - hb * 0.4 + 4], [x1, ay - hb * 0.15]], { w: 1.3, color: key, seed: 31 + i, wobble: 0.2 }));
      for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([lerp(ex, bxr, u) + Math.sin(u * Math.PI) * bow, lerp(ay, byy, u)]); }
    } else {
      const ay = o.y + by + bh * 0.05, lx = o.x + bx - 3, rx = o.x + bx + bw + 3;
      crayon(c, [[lx, ay], [lx - 14, ay - h / 2]], { w: 1.2, color: key, seed: 31, wobble: 0.2 }); crayon(c, [[lx, ay], [lx - 14, ay + h / 2]], { w: 1.2, color: key, seed: 32, wobble: 0.2 });
      drawBanner(c, lx - 14, ay, k, false);
      for (let i = 0; i <= 16; i++) { const u = (i / 16) * k; pts.push([rx + u * S * 0.38 + Math.sin(u * 9 - T * 8) * 1.5 * u, ay + u * S * 0.3 + Math.sin(u * Math.PI) * 6]); }
    }
    if (k > 0.05) crayon(c, pts, { w: 1.1, color: key, seed: 33, wobble: 0.2 });
    c.save(); c.globalCompositeOperation = 'multiply';
    for (let q = 1; q < 7; q++) { const [px, py] = pts[Math.round((q / 7) * 16)]; if (!still && (q / 7) > k) break; const z = S * 0.04; c.fillStyle = inkOf(['warm', 'sun', 'sky'][q % 3]); c.beginPath(); c.moveTo(px - z * 0.5, py - z * 0.3); c.lineTo(px + z * 0.5, py + z * 0.3); c.lineTo(px + (still ? 0 : Math.sin(T * 7 + q) * 2.2), py + z * 1.7); c.closePath(); c.fill(); }
    c.restore();
  }
  // the thank-you written on the lawn to the right of the basket, in the language showing, until the next gift is picked
  function drawThanks(c) {
    if (!thx || calm) return;   // held still, the banner on the balloon is the thank-you
    const age = calm ? 99 : T - thx.t0; if (age < 0) return;
    let al = 1; if (thx.out != null) { al = 1 - (T - thx.out) / 0.35; if (al <= 0) { thx = null; return; } }
    const mode = langMode(), x0 = G.cx + B.b.basket[2] / 2 + G.r * 1.5 + 6, aw = G.w - x0 - 16, xc = x0 + aw / 2, f = (px) => `800 ${px}px "Bricolage Grotesque","Noto Sans Thai",sans-serif`;
    const TH = 'ขอบคุณ', EN = 'Thank you', fit = (str, mx) => { c.font = f(100); return Math.min(mx, (100 * aw) / c.measureText(str).width); };
    const lines = mode === 'th' ? [[TH, fit(TH, 44), 0.6]] : mode === 'en' ? [[EN, fit(EN, 38), 0.6]] : [[TH, fit(TH, 34), 0.34], [EN, Math.min(fit(EN, 30), fit(TH, 34) * 0.85), 0.68]];
    const k = e3(age / 0.9), pop = 1 + 0.12 * Math.sin(clamp(age / 0.5) * Math.PI) * (calm ? 0 : 1);
    c.save(); c.globalAlpha = al; c.translate(xc, G.hy + (G.gy - G.hy) * 0.5); c.rotate(-0.045); c.scale(pop, pop); c.translate(-xc, -(G.hy + (G.gy - G.hy) * 0.5));
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const [str, px, at] of lines) {
      const y = G.hy + (G.gy - G.hy) * at;
      c.save(); c.font = f(px); const tw_ = c.measureText(str).width; c.beginPath(); c.rect(xc - tw_ / 2 - 6, y - px, (tw_ + 12) * k, px * 2); c.clip();
      c.strokeStyle = inkOf('key'); c.lineWidth = Math.max(3, px * 0.2); c.strokeText(str, xc, y);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = inkOf('warm'); c.fillText(str, xc + 1.4, y + 1.4);
      c.globalCompositeOperation = 'source-over'; c.fillStyle = look.paper; c.fillText(str, xc, y); c.restore();
    }
    c.restore();
  }
  const fillLift = () => G.h * 0.075 * clamp((lg(amt) - 3.3) / 1.2);

  // ── a frame ────────────────────────────────────────────────────────────────
  function paint1() {
    if (!baked) return;
    const c = ctx, S = G.S, s = seq ? T - seq.t0 : -1;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(bg.cv, 0, 0, G.w, G.h);
    for (const cl of bg.clouds) { const span = G.w + cl.w + 20, x = calm ? cl.x0 : ((((cl.x0 + cl.v * T) % span) + span) % span) - cl.w; c.drawImage(cl.cv, x, cl.y, cl.w, cl.h); }
    // what the balloon is doing: heat, roar, hops, the flight
    const tapA = T - tapT, tapHeat = calm ? (calmTap > 0 ? 1.4 : 0) : 1.4 * Math.exp(-Math.max(0, tapA) * 2.4);
    const ph = anchor ? (((T - anchor) % PULSE) + PULSE) % PULSE : 99;
    roar = calm || !armed || seq || released ? 0 : ph < 0.12 ? e3(ph / 0.12) : ph < 0.45 ? 1 : ph < 1.25 ? 1 - sm((ph - 0.45) / 0.8) : 0;
    const twHeat = tw ? (tw.p < 0.7 ? 1 : 1 - sm((tw.p - 0.7) / 0.3)) : 0, sh = s < 0 ? 0 : s < 1.6 ? 1 : 1 - sm((s - 1.6) / 1.0);
    heat = Math.max(roar, tapHeat, twHeat, sh);
    const tapHop = calm ? 0 : tapA >= 0 && tapA < 0.45 ? 6 * Math.sin(Math.PI * (tapA / 0.45)) : 0, duck = calm ? 0 : tapA >= 0 && tapA < 0.6 ? S * 0.034 * bump(tapA / 0.6) : 0;
    let flightY = 0, headJump = 0;
    liftNow = lift + roar * 2 + tapHop + (calm || lift < 3 || seq ? 0 : 1.5 * Math.sin(T * TAU * 0.7) * Math.min(1, lift / 8));
    swayA = calm || seq ? 0 : 0.0075 * Math.sin(T * 1.9); pendA = calm ? 0 : 0.004 * Math.sin(T * 2.4 + 1);
    let rel = released ? 1 : 0;
    if (seq) {
      const lt = clamp((s - 0.5) / 2.1), ex = G.gy - (B.b.basket[1] + B.b.basket[3]) - lift + B.b.h + S * 0.4 + 40;
      flightY = ex * Math.pow(lt, 1.8); liftNow = lift + (s < 0.45 ? 2 * bump(s / 0.45) : 0);
      swayA = lt > 0 ? ((3 * Math.PI) / 180) * Math.sin(lt * 7) * Math.min(1, lt * 4) : 0; pendA = lt > 0 ? -0.05 * Math.sin(lt * 6 - 0.8) * Math.min(1, lt * 3) : 0;
      headJump = s < 2.4 ? S * 0.03 * Math.abs(Math.sin(T * 13)) : 0; rel = sm(s / 0.4);
    } else if (enter) rel = enter.p < 0.6 ? 1 : 1 - sm((enter.p - 0.6) / 0.4);
    drawThanks(c);
    const o = origin(); o.y -= flightY;
    const tens = armed && !released && !seq && !enter ? 0.3 + 0.7 * clamp(lift / G.liftMax) : 0.3;
    tether(c, o, tens, rel, 0);
    c.save(); const pvx = o.x + B.b.cx, pvy = o.y + B.b.top; c.translate(pvx, pvy); c.rotate(swayA); c.translate(-pvx, -pvy);
    const my = o.y + B.rows / B.ky, mx = o.x + B.b.cx, [bx, by, bw] = B.b.basket;
    c.save(); c.translate(mx, my); c.rotate(pendA); c.translate(-mx, -my);
    c.drawImage(B.lower, 0, 0, B.lower.width, B.lower.height, o.x, my, B.b.w, B.lower.height / B.ky);
    const [qx, qy, qw, qh] = B.pRect, st = 1 + (headJump * 0.4) / qh;   // the pilots: duck behind the rim, or stand tall to cheer
    c.save(); c.beginPath(); c.rect(o.x + qx - 1, o.y + qy - qh * 0.6, qw + 2, qh * 1.6); c.clip();
    c.translate(o.x + qx, o.y + qy + qh + duck); c.scale(1, st); c.drawImage(B.pilots, 0, -qh, qw, qh);
    c.restore(); c.restore();
    const sqA = calm ? -1 : T - sqT, sq = sqA >= 0 && sqA < 1.3 ? 0.13 * Math.exp(-sqA * 5) * Math.sin(sqA * 19) : 0;   // a tap presses the envelope down, and it springs back
    c.save(); if (sq) { c.translate(mx, my); c.scale(1 + sq * 0.55, 1 - sq); c.translate(-mx, -my); }
    strips(c, { x: o.x, y: o.y, puff: puffOf(F, sz) + roar * 0.012 }); c.restore();
    c.save(); c.translate(mx, my); c.rotate(pendA); c.translate(-mx, -my);
    drawFlame(c, o.x + B.b.mouth[0], o.y + B.b.mouth[1], clamp(PILOT + (1.1 - PILOT) * heat, PILOT, 1.25));
    if (seq && s >= 0.5) drawHang(c, o, s); else if (calm && released && !seq && !enter) drawHang(c, o, 9);
    c.restore();
    if (armed && !released && !seq && amt >= 25000 && F > 0.9) crownStars(c, o);
    c.restore();
    smallGift(c); drawBalls(c); tether(c, o, tens, rel, 1);
    drawFx(c);
  }

  // ── the loop ───────────────────────────────────────────────────────────────
  function advance(dt) {
    const sT = sizeOf(amt); sz = calm || Math.abs(sT - sz) < 0.002 ? sT : sz + (sT - sz) * (1 - Math.exp(-dt * 7));
    if (tw) { tw.p = (T - tw.t0) / tw.dur; if (tw.p >= 1) { F = tw.to; tw = null; } else { const u = tw.p, k = 0.78; F = tw.from + (tw.to - tw.from) * (u < k ? sm(u / k) * (1 + tw.os) : 1 + tw.os * (1 - sm((u - k) / (1 - k)))); } }
    const cy = anchor && armed && !seq ? Math.floor((T - anchor) / PULSE) : -1; if (cy !== cycle) { if (cy > 0 && cycle >= 0) fireAt('ember', 5); cycle = cy; }
    if (!seq) { const lt = armed && !released && !enter ? fillLift() : 0; lift = calm ? lt : lift + (lt - lift) * (1 - Math.exp(-dt * 3.5)); }
    stepBalls(dt);
    if (seq) stepSeq();
    if (enter) { enter.p = clamp((T - enter.t0) / 1.1); enter.dx = (1 - e3(enter.p)) * G.w * 0.8; if (enter.p >= 1) {
      enter = null; released = false;
      if (pending) { pending = false; quiet = false; fadeThanks(); tidy(); arm(); }
      else { armed = true; quiet = true; anchor = nowT(); retarget(); }   // a new bag fills to the amount beside the heap; no new balls
    } }
  }
  function stepSeq() {
    const s = T - seq.t0;
    for (const q of seq.toss) if (!q.go && s >= q.at) {   // the crew tosses a ball out of the basket onto the lawn, round the X
      const b = q.ball, o = origin(), [bx, by, bw] = B.b.basket, tf = rnd(0.5, 0.64); q.go = true;
      b.x = o.x + bx + bw / 2; b.y = o.y + by - b.r; b.fy = q.ty; b.vy = (q.ty - b.y - 0.5 * GRAV * tf * tf) / tf;
      // the bounces after the landing carry it on sideways: land short, so that it comes to rest on its spot
      let v = (b.vy + GRAV * tf) * BOUNCE, D = 0, m = 1; while (v >= 40) { m *= FRIC; D += ((2 * v) / GRAV) * m; v *= BOUNCE; }
      b.vx = (q.tx - b.x) / (tf + D); b.st = 'air'; b.hit = 0; b.slot = -1; b.tossed = true; b.grow = T; b.back = false;
    }
    for (let w = 0; w < 3; w++) if (!seq.conf[w] && s >= 1.5 + 0.4 * w) { seq.conf[w] = true; confetti(44); }
    if (s >= SEQ) { seq = null; armed = false; F = 0; tw = null; lift = 0; enter = { t0: T, p: 0, dx: G.w * 0.8 }; anchor = 0; cycle = -1; }
  }
  let lastP = 0;
  function loop(now) {
    const busy = tw || seq || enter || fx.length || sz !== sizeOf(amt) || balls.some((b) => b.st !== 'rest');
    if (!busy && now - lastP < 30) { if (vis) requestAnimationFrame(loop); else { run = false; prev = 0; } return; }   // at rest the picture needs 30 frames a second, not 60
    lastP = now; T = now / 1000; const dt = Math.min(0.05, prev ? T - prev : 0.016); prev = T;
    advance(dt); paint1();
    if (vis && (!calm || busy)) requestAnimationFrame(loop); else { run = false; prev = 0; }
  }
  function kick() { if (!baked) return; if (calm) { T = 0; advance(1); paint1(); return; } if (!run && vis) { run = true; prev = 0; requestAnimationFrame(loop); } }

  // ── "I've sent it!": the crew tosses the balls out, the balloon goes up with a thank-you ──
  // the button is under the steps, a screen below the picture: bring the picture up, then let it go
  let sendWait = false;
  function sendIt() {
    if (!baked || seq || enter) return;
    const r = cv.getBoundingClientRect();
    if (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) < r.height * 0.6) { sendWait = true; scrollTo({ top: Math.max(0, r.top + scrollY - Math.max(72, (innerHeight - r.height) / 2 - 40)), behavior: calm ? 'auto' : 'smooth' }); setTimeout(launch, 1500); } else launch(true);
  }
  // where the tossed balls come to rest: a heap on the chalk X, its rows from the ground up, each ball at least
  // 2.05 radii from the next along the row, so none hides another
  function heapAt(n) {
    const r = G.r, d = r * 2.25, gyc = G.gy - r, m = Math.max(1, Math.ceil((Math.sqrt(8 * n + 1) - 1) / 2)), out = []; let left = n;
    for (let j = 0; left > 0; j++) { const cnt = Math.min(m - j, left); for (let k = 0; k < cnt; k++) out.push([G.X[0] + (k - (cnt - 1) / 2) * d + rnd(-0.09, 0.09) * r, gyc - j * r * 1.74 + rnd(-0.04, 0.04) * r]); left -= cnt; }
    return out;
  }
  function launch(now) {
    if (!now && !sendWait) return; sendWait = false; if (seq || enter) return;
    const mine = balls.filter((b) => b.slot >= 0 && b.st !== 'fly').sort((a, b) => a.slot - b.slot), r = G.r, spot = heapAt(mine.length);
    armed = true; released = true; tapT = -9; quiet = true; thx = { t0: calm ? -99 : nowT() + 1.2, out: null };
    // a balloon that goes up is round and full, whatever it was doing when the button was pressed
    if (calm) { F = Math.max(F, fillOf(amt)); tw = null; } else tw = F < ROUND - 0.002 ? { t0: nowT(), dur: 0.45, from: F, to: ROUND, os: 0.04, p: 0 } : null;
    thank();
    const keepAt = (b, x, y) => { b.x = x; b.y = b.fy = y; b.st = 'rest'; b.slot = -1; b.keep = true; b.back = false; b.nx = x / G.w; b.dy = (y - (G.gy - r)) / r; };
    if (calm) { mine.forEach((b, i) => keepAt(b, spot[i][0], spot[i][1])); kick(); return; }
    mine.forEach((b, i) => { b.go = false; b.tossAt = 0.15 + (mine.length > 1 ? (0.6 * i) / (mine.length - 1) : 0.2); b.tx = spot[i][0]; b.ty = spot[i][1]; });
    seq = { t0: nowT(), toss: mine.map((b) => ({ ball: b, at: b.tossAt, tx: b.tx, ty: b.ty, go: false })), conf: [] };
    kick();
  }

  // the thank-you in words, under the picture: in the caption, which is read out when it changes, with the share button in it.
  // It stays until the next amount is picked (set() writes the amount sentence back). The same in reduced motion.
  const SHARE = () => shareText(t2('ร่วมให้กับโครงการเพื่อเด็กของสโมสรโรตารีสากลเชียงใหม่ ผ่านงานทิ้งลูกกอล์ฟ', "Give to the Chiang Mai International Rotary Club's children's projects through the Golf Ball Drop:"));
  function shareBtn(id) {
    const a = document.createElement('button'); a.type = 'button'; a.className = 'btn sun'; if (id) a.id = id; else a.classList.add('ask2');
    a.innerHTML = '<i data-dingbat="balloon" data-look="riso"></i><span class="th">แชร์ให้เพื่อน</span><span class="en">Share with a friend</span>'; a.addEventListener('click', SHARE); return a;
  }
  function thank() {
    thanked = true;
    say.innerHTML = `<span class="gv-big"><span class="th">ขอบคุณ!</span> <span class="en">Thank you!</span></span><span class="gv-next"><span class="th">ถ้ายังไม่ได้ส่ง ส่งสลิปไปที่ <a href="mailto:${TO}">${TO}</a></span><span class="en">Email your slip to <a href="mailto:${TO}">${TO}</a> if you have not yet.</span></span>`;
    say.append(shareBtn('give-ask'));
  }

  // ── wiring ─────────────────────────────────────────────────────────────────
  // a ball and the number of balls it buys, on each chip: the amount is the first thing the chip says
  chips.forEach((c) => { const k = +c.dataset.amt / 1000; c.innerHTML = `<b class="amt">${fmt(+c.dataset.amt)}</b><span class="cnt" aria-hidden="true"><span class="ball"><i data-dingbat="golf-ball" data-look="riso" data-play="hover" data-bg="${look.paper}"></i></span>${k === 0.5 ? '½' : k}</span>`; });
  // "I've sent it!" promises the balloon
  sent.innerHTML = '<i data-dingbat="balloon" data-look="riso"></i><span class="th">โอนแล้ว!</span><span class="en">I\'ve sent it!</span><small class="sub"><span class="th">ปล่อยบอลลูน</span><span class="en">Let the balloon go</span></small>';
  chips.forEach((c) => c.addEventListener('click', () => { other.value = ''; set(+c.dataset.amt, 'chip'); }));
  other.addEventListener('input', () => { const v = parseInt(other.value.replace(/[^\d]/g, ''), 10); if (v > 0) set(v, 'other'); });
  // a tap: a ball hops; the half ball hops out of its tuft; the dandelion is blown; the balloon is pressed down,
  // springs back and throws stars from its mouth and its crown
  function crownBurst(n) {
    for (let i = 0; i < n; i++) { const a = -Math.PI * (0.12 + 0.76 * (i / Math.max(1, n - 1))); fx.push({ k: 'star', x: envCx + Math.cos(a) * G.S * 0.3, y: envTop + G.S * 0.1 + Math.sin(a) * G.S * 0.08, vx: Math.cos(a) * rnd(60, 150), vy: Math.sin(a) * rnd(150, 260), t0: nowT(), life: 0.95, s: rnd(6.5, 9.5), c: ['sun', 'warm', 'sky'][i % 3] }); }
  }
  cv.addEventListener('click', (e) => {
    if (!baked || seq || enter) return;
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * G.w) / r.width, y = ((e.clientY - r.top) * G.h) / r.height;
    let hit = null, hd = G.r * 1.5; for (const b of balls) { if (b.st !== 'rest') continue; const d = Math.hypot(b.x - x, b.y - y); if (d < hd) { hd = d; hit = b; } }
    if (hit && !calm) { hopBall(hit); kick(); return; }
    const { half, dande } = spots, near_ = (q) => q && Math.hypot(q.x - x, q.y - y) < q.d;
    if (near_(half) && !calm) {
      halfHop = nowT(); fx.push({ k: 'ring', x: half.x, y: half.y + G.r * 1.2, t0: nowT(), life: 0.5, r0: G.r });
      for (let i = 0; i < 5; i++) fx.push({ k: 'star', x: half.x, y: half.y - G.r, vx: rnd(-90, 90), vy: rnd(-250, -120), t0: nowT(), life: 0.75, s: rnd(4, 6.5), c: ['sun', 'warm', 'sky', 'sun', 'warm'][i] });
      kick(); return;
    }
    if (near_(dande) && !calm) {
      dandeT = nowT();
      for (let i = 0; i < 12; i++) fx.push({ k: 'seed', x: dande.x + rnd(-6, 6), y: dande.y - G.r * 0.4 + rnd(-6, 6), vx: rnd(14, 90), vy: rnd(-60, -16), t0: nowT() + i * 0.035, life: rnd(1.4, 2.1), s: rnd(3.2, 4.4), ph: rnd(0, TAU) });
      kick(); return;
    }
    if (calm) { calmTap = 1; paint1(); setTimeout(() => { calmTap = 0; paint1(); }, 600); return; }
    tapT = nowT(); sqT = nowT(); fireAt('star', 9); crownBurst(6); kick();
  });
  document.querySelectorAll('.give .copy').forEach((b) => b.addEventListener('click', (e) => { copyText(b.dataset.copy, t2('คัดลอกแล้ว', 'Copied')); b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1600); burst(e.clientX, e.clientY, 10, true); }));
  sent.addEventListener('click', (e) => {
    sendIt(); if (!baked) thank();
    for (let i = 0; i < 6; i++) setTimeout(() => dingbatFloat(i % 2 ? 'balloon' : 'golf-ball', e.clientX + (Math.random() - 0.5) * 160, e.clientY), i * 140);
    if (innerWidth >= 600) toast(t2('ขอบคุณ!', 'Thank you!'));   // on a phone the caption under the picture says it, and a toast would cover that
    if (!sent.parentNode.querySelector('.ask2')) sent.after(shareBtn());
  });
  // while the Give section is on screen the phone's bottom bar (Get a ball / Give) steps aside: its Give button points at where the donor is, and it covers the chips
  const gsec = document.querySelector('section.give');
  if ('IntersectionObserver' in window && gsec) new IntersectionObserver((e) => root.classList.toggle('in-give', e[0].isIntersecting), { threshold: 0 }).observe(gsec);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { near = e[0].isIntersecting; if (near && (dirty || !baked) && !baking) bake(); }, { rootMargin: '600px 0px' }).observe(cv);
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; seeRatio = e[0].intersectionRatio >= 0.4; if (vis) { maybeShow(); kick(); if (sendWait && e[0].intersectionRatio >= 0.6) launch(); } }, { threshold: [0, 0.4, 0.6] }).observe(cv);
  } else { near = vis = seeRatio = true; }
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const [w] = measure(); if (Math.abs(w - W) < 8) return; dirty = true; if (near) bake(); }, 200); });
  // the ball on a chip is white on paper whatever the chip is (the dingbat takes its paper from what is behind it, which is dark on a dark phone)
  onLook(() => { dirty = true; if (near) bake(); chips.forEach((c) => { const i = c.querySelector('[data-dingbat]'); if (i) i.dataset.bg = look.paper; }); if (window.Dingbats && Dingbats.refresh) Dingbats.refresh(); });
  // the words on the picture follow the language switch
  new MutationObserver(() => { if (baked && (thx || (calm && released))) paint1(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  paper(); words(); chips.forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.amt === amt)));
  // print the pictures at idle, 2.5 s after load, so that a jump to Give from the header finds them done
  const pre = () => setTimeout(() => idle(() => { if (!baked && !baking) bake(true); }), 2500);
  if (document.readyState === 'complete') pre(); else addEventListener('load', pre, { once: true });
  if (!('IntersectionObserver' in window)) bake();
}
