// The hero: a riso print of the drop that plays. The balloon hangs on its tethers and breathes; tap
// it and the burner roars and it lifts; drag it and it swings back. A ball leaves the basket every
// few seconds and rolls to rest on the lawn; pull the cord and all 300 pour out, then chalk rings
// grow from the X to the three closest. A finger through the balls scatters them; a tap on a ball
// hands its number to the Get a ball panel; the people hop when tapped; a tap on the sky lets a
// small balloon go; a tap on the lawn drops a ball there and says how far it is from the X.
import { look, onLook, clamp, lerp, rng, surface } from './riso.js';
import { bakeBalloon, bakeGround, bakeCloud, ballSprite, flame, crowd, person, bakeKapok } from './scene.js';
import { burst, toast, dingbatFloat, t2 } from './bits.js';

const TAU = Math.PI * 2;

export function hero({ calm }) {
  const stage = document.getElementById('stage'), cv = document.getElementById('hero-cv'), cordBtn = document.getElementById('cord');
  if (!stage || !cv) return;
  const hint = stage.querySelector('.hint'), numIn = document.getElementById('num');
  // the second gold pill, for after the crown; and a 48 px grab that follows the cord's ring so a finger can pull it (the picture itself scrolls the page)
  const buy = Object.assign(document.createElement('a'), { className: 'cord buy', id: 'cord-buy', href: '#balls', innerHTML: '<span class="th">ซื้อลูกกอล์ฟ ฿1,000</span><span class="en">Get a ball<span class="pr"> ฿1,000</span></span>' });
  const grab = Object.assign(document.createElement('div'), { className: 'cord-grab' }); grab.setAttribute('aria-hidden', 'true');
  stage.append(buy, grab);
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), R = rng(42), probe = document.createElement('canvas').getContext('2d');
  let W = 0, H = 0, bg = null, B = null, L = null, G = null, people = [], balls = [], wide = false, clouds = [], birds = [], fx = [], rings = [], tag = null;
  let zX = 0.5, zTape = 0.7, gyA = 0, gyB = 0, rb = 4, nextDrop = 0, nextLife = 0, winners = null, running = false, vis = true, last = 0, t = 0, dirty = true;
  let pill = 'show', again = false, pillBackAt = 0, poured = 0, touched = false, lift = 0, liftMax = 40, dTag = null, ballHint = false, hintTimer = 0;
  const bal = { ax: 0, ay: 0, x: 0, y: 0, vx: 0, vy: 0, heat: 0, burn: 0, lean: 0, drag: null };
  const cord = { pull: 0, v: 0, drag: null, len: 0, ring: null, tuck: 0 };
  let ptr = null;
  const SQ = 0.36;   // how much a circle on the lawn is squashed on the page
  const GRAV = 0.22; // px per frame squared: a ball falls slowly enough to follow from the basket
  const FLAG = { cap: [40, 28, 18], fs: [13, 12, 12], slot: [[0, -56], [-44, -28], [44, -28]] };   // the crown's banners: pole heights, type, where each hangs from the X

  // where things stand, for a stage this size
  function layout() {
    const r = stage.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height);
    if (!W || !H) return false;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wide = W >= 900;
    // on a wide page the stage is as tall as the copy beside it, often taller than the window: lay the picture out against what the first screen shows, and let plain lawn run on below it
    const vh = wide ? Math.min(H, Math.max(560, Math.round(innerHeight - (r.top + (window.scrollY || 0)) - 12))) : H;
    const hy = Math.round(vh * (wide ? 0.6 : 0.58));
    const S = wide ? Math.round(Math.min(280, vh * 0.38)) : Math.round(Math.min(W * 0.41, vh * 0.34));
    const cx = W * (wide ? 0.72 : 0.6);
    gyA = hy; gyB = vh - 6;
    B = bakeBalloon(S, dpr, 11, { cables: false });
    // the balloon hangs high: bare sky over the crown, and the basket a hundred px or more over the X so the pour has a drop to show.
    // The X (and the tape in front of it) sit as far down the lawn as that takes.
    const topM = wide ? 28 : 32, xs = Math.max(26, S * 0.2), zFor = (y) => ((y - gyA) / (gyB - gyA) - 0.05) / 0.92;
    bal.ax = cx - B.w / 2; bal.ay = topM - B.top;
    const foot = bal.ay + B.basket[1] + B.basket[3];
    zX = clamp(zFor(foot + (wide ? 112 : 100)), wide ? 0.4 : 0.3, wide ? 0.5 : 0.46);
    const yX = gy(zX);
    zTape = clamp(Math.max(wide ? 0.66 : 0.64, zFor(yX + xs * 1.3 + 8)), 0.5, 0.82);
    const yT = gy(zTape);
    liftMax = topM + 14;          // the balloon may rise until a little of its crown leaves the picture
    // the tape hangs about 5 px between stakes (a stake at every 4th point), with a ripple on top, drawn live
    const tape = [], step = wide ? 70 : 52; for (let x = wide ? W * 0.44 : -10; x <= W + 10; x += step) { const f = (tape.length % 4) / 4; tape.push([x, yT + Math.sin(x * 0.01) * 3 + 5 * 4 * f * (1 - f)]); }
    L = { w: W, h: vh, fullH: H, hy, x: [cx, yX], xs, tape, tapeW: wide ? 4 : 3, pitch: wide ? 4.4 : 3.8, reg: wide ? 1.2 : 0.9, chedis: wide ? [0.48, 0.52, 0.9] : [0.12, 0.17, 0.88], clouds: [], liveTape: true, kapok: wide ? 'right' : 'left' };
    rb = wide ? Math.max(3.2, Math.min(6, W / 170)) : Math.max(4, Math.min(6, W / 100));
    bg = surface(W, H, dpr); G = bakeGround(bg, L, 3);
    // the kapok on the stage's top layer, above the balloon, the balls, the people and the buttons (Nan, 2026-10-24)
    { const tc = document.getElementById('hero-tree'); if (tc && L.kapok) { const t = bakeKapok(W, H, hy, L.kapok, dpr); tc.width = t.cv.width; tc.height = t.cv.height; tc.getContext('2d').drawImage(t.cv, 0, 0); } }
    // the cord's ring hangs above the X, never on its crossing: as long as the room under the basket allows, 16 px at the least
    const armH = 0.494 * L.xs;
    cord.len = clamp(yX - armH - 24 - foot, 16, S * 0.22);
    if ((!bal.x && !bal.y) || (!touched && !bal.drag)) { bal.x = bal.ax; bal.y = bal.ay; bal.vx = bal.vy = 0; }
    const ph = Math.min(78, (vh - yT) * 0.62), x0 = wide ? W * 0.47 : W * 0.13, x1 = wide ? W * 0.64 : W * 0.4, front = vh - 0.18 * ph;
    people = crowd(31, x0, x1, () => front, ph).concat(crowd(37, W * (wide ? 0.86 : 0.78), W + 10, () => front, ph * 0.96)).sort((a, b) => a.base - b.base);
    people.forEach((p) => (p.still = calm));
    balls.forEach((b) => (b.z = Math.min(b.z, zTape - 0.03)));
    // three clouds as their own sprites, small and slow to large and quick
    clouds = [[0.22, 0.2, 0.6, 3], [0.64, 0.12, 0.85, 5], [0.92, 0.3, 1.15, 8]].map(([fx0, fy0, sz, v], k) => {
      const rx = Math.min(140, W * 0.16) * sz, sp = bakeCloud(rx, k + 2, dpr); return { sp, x: W * fx0 - sp.w / 2, y: hy * fy0 + 20 - sp.h / 2, v };
    });
    placeCord();
    dirty = true;
    return true;
  }
  function gy(z) { return gyA + (gyB - gyA) * (0.05 + 0.92 * z); }
  function sc(z) { return 0.55 + 0.7 * z; }
  const basketAt = () => { const [bx, by, bw, bh] = B.basket; return [bal.x + bx + bw / 2, bal.y + by + bh]; };
  const bbOf = () => B.basket[1] + B.basket[3];

  // ── balls ──────────────────────────────────────────────────────────────────
  function drop(k = 1, opts = {}) {
    if (!B) return;
    const [x0, y0] = basketAt();
    for (let i = 0; i < k; i++) {
      const z = clamp(zX + (R() - 0.5) * (opts.spread || 0.12), 0.02, zTape - 0.04);
      balls.push({ x: x0 + (R() - 0.5) * B.S * 0.12, z, h: gy(z) - y0, vh: 0, vx: (R() - 0.5) * (opts.spread ? 5.5 : 1.1), vz: (R() - 0.5) * 0.004, rest: false, n: opts.n ? opts.n[i] : 0, wait: opts.stagger ? i * opts.stagger : 0, medal: 0, tagN: 0, spin: 0, rot: 0 });
    }
    if (balls.length > 760) balls.splice(0, balls.length - 760);
    dirty = true; kick();
  }
  // the lawn's depth for a y on the page, and the metres from the X the Try-a-drop board would call it (play.js: MET 30)
  const zOf = (y) => clamp(((y - gyA) / (gyB - gyA) - 0.05) / 0.92, 0.02, zTape - 0.04);
  const metres = (b) => Math.hypot((b.x - L.x[0]) / (0.32 + 0.95 * b.z) / W, (b.z - zX) * 0.75) * 30;
  const blank = (o) => ({ x: 0, z: 0, h: 0, vh: 0, vx: 0, vz: 0, rest: false, n: 0, wait: 0, medal: 0, tagN: 0, spin: 0, rot: 0, ...o });
  // a ball let go at the basket that comes down at (tx, tz): the sideways speeds are set so it reaches that spot as it lands
  function aimBall(tx, tz, opts = {}) {
    if (!B) return null;
    const [x0, y0] = basketAt(), h0 = Math.max(20, gy(zX) - y0), T = Math.max(8, Math.sqrt((2 * h0) / GRAV + 0.25) - 0.5), bx = x0 + (R() - 0.5) * B.S * 0.03;
    const b = blank({ x: bx, z: zX, h: h0, vx: (tx - bx) / T, vz: (tz - zX) / T, aim: { x: tx, z: tz, roll: opts.roll || 0, react: !!opts.react }, ask: !!opts.ask });
    balls.push(b); if (balls.length > 760) balls.splice(0, balls.length - 760);
    dirty = true; kick(); return b;
  }
  // a spot on the grass round the X and never on it: 1.5 half-widths out at the least
  function ringSpot(reach = 1.7) { const a = R() * TAU, rad = L.xs * (1.5 + reach * R()); return [clamp(L.x[0] + Math.cos(a) * rad, 8, W - 8), zOf(L.x[1] + Math.sin(a) * rad * SQ)]; }
  function scatter(k, reach) {
    const fresh = []; for (let i = 0; i < k; i++) { const [x, z] = ringSpot(reach); fresh.push(blank({ x, z, rest: true })); }
    balls.push(...fresh); relax(fresh); dirty = true;
  }
  // a ball lands where the finger was: dust, and the nearest person hops
  function landFx(b, a) {
    if (calm) return; const now = performance.now(), y = gy(b.z);
    for (let i = 0; i < (a.react ? 5 : 2); i++) fx.push({ type: 'dust', x: b.x + (R() - 0.5) * 12, y: y + (R() - 0.5) * 3, dx: (R() - 0.5) * 10, rise: 0, r: 1.2 + R() * 1.4, t0: now + i * 30, life: 600 });
    if (a.react) { let q = null, qd = 1e9; for (const p of people) { const d = Math.abs(p.x - b.x); if (d < qd) { q = p; qd = d; } } if (q) q.hop = now; }
  }
  function step(dt) {
    let moving = false; const f = dt * 60, landed = [];
    for (const b of balls) {
      if (b.rest) continue;
      if (b.wait > 0) { b.wait -= dt; const [x0, y0] = basketAt(); b.x = x0 + (R() - 0.5) * 6; b.h = gy(b.z) - y0; moving = true; continue; }
      b.vh -= GRAV * f; b.h += b.vh * f; b.x += b.vx * f; b.z += b.vz * f;
      if (b.z > zTape - 0.03) { b.z = zTape - 0.03; b.vz = -Math.abs(b.vz) * 0.5; }
      if (b.z < 0.01) { b.z = 0.01; b.vz = Math.abs(b.vz) * 0.5; }
      if (b.x < 4 || b.x > W - 4) { b.x = clamp(b.x, 4, W - 4); b.vx *= -0.5; }
      if (b.h <= 0) {
        b.h = 0;
        if (b.aim) { const a = b.aim; b.aim = null; b.x = a.x; b.z = a.z; b.vx = (R() - 0.5) * a.roll; b.vz = 0; landFx(b, a); }
        if (b.vh < -1.6) { b.vh = -b.vh * 0.38; b.vx *= 0.75; b.vz *= 0.75; }
        else {
          b.vh = 0; const fr = Math.pow(Math.abs(b.vx) > 2 ? 0.9 : 0.965, f);   // scraping, then rolling
          b.vx *= fr; b.vz *= fr; b.rot += b.vx / Math.max(1.5, rb * sc(b.z)) * f;
          if (Math.abs(b.vx) < 0.05 && Math.abs(b.vz) < 0.0004) { b.rest = true; b.vx = b.vz = 0; landed.push(b); }
        }
      }
      moving = true;
    }
    if (landed.length) { relax(landed); dirty = true; landed.forEach((b) => { if (b.ask) { b.ask = false; distTag(b); } }); }
    if (moving) dirty = true;
    return moving;
  }
  // a ball that comes to rest pushes the balls it overlaps apart: a pile that spreads into a scatter
  function relax(list) {
    const cell = 2.4 * rb, grid = new Map(), mine = new Set(list), ky = (gyB - gyA) * 0.92, put = (b) => { const k = Math.floor(b.x / cell) * 4096 + Math.floor(gy(b.z) / cell); (grid.get(k) || grid.set(k, []).get(k)).push(b); };
    for (const b of balls) if (b.rest && !mine.has(b)) put(b);
    for (const b of list) {
      for (let it = 0; it < 2; it++) {
        const cx = Math.floor(b.x / cell), cy = Math.floor(gy(b.z) / cell); let seen = 0;
        for (let ox = -1; ox <= 1 && seen < 8; ox++) for (let oy = -1; oy <= 1 && seen < 8; oy++) {
          const arr = grid.get((cx + ox) * 4096 + cy + oy); if (!arr) continue;
          for (const o of arr) {
            if (o === b || seen >= 8) continue; seen++;
            let dx = b.x - o.x, dy = gy(b.z) - gy(o.z), d = Math.hypot(dx, dy); const need = (sc(b.z) + sc(o.z)) * rb * 0.98;
            if (d >= need) continue;
            if (d < 0.05) { const a = R() * TAU; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
            const push = (need - d) * 0.9;
            b.x = clamp(b.x + (dx / d) * push, 4, W - 4); b.z = clamp(b.z + ((dy / d) * push) / ky, 0.01, zTape - 0.03);
          }
        }
      }
      put(b);
    }
  }
  const distX = (b) => Math.hypot(b.x - L.x[0], (gy(b.z) - L.x[1]) / SQ);
  function crown(now) {
    const pool = balls.filter((b) => b.n);
    if (pool.length < 3 || pool.some((b) => !b.rest)) return;
    pool.sort((a, b) => distX(a) - distX(b)); const top = pool.slice(0, 3);
    balls.forEach((b) => (b.medal = 0));
    top.forEach((b, i) => (b.medal = i + 1));
    winners = top.map((b) => b.n);
    // the reveal: a chalk ring grows from the X to the third, then the second, then the first
    rings = [3, 2, 1].map((m, i) => ({ b: top[m - 1], medal: m, r: distX(top[m - 1]), at: calm ? -1e9 : now + i * 280, fired: calm }));
    pillBackAt = calm ? 0 : now + 3000;
    ballsHint();
    if (calm) { announce(); pillShow(); }
  }
  // after the first crown the hint says what the balls do, for six seconds
  function ballsHint() {
    if (ballHint || !hint) return; ballHint = true;
    const th = hint.querySelector('.th'), en = hint.querySelector('.en'); if (th) th.textContent = 'แตะลูกดูเลข'; if (en) en.textContent = 'Tap a ball for its number';
    hint.style.transition = calm ? 'none' : 'opacity .6s'; hint.style.opacity = '1'; hint.style.pointerEvents = 'none';
    hintTimer = setTimeout(() => (hint.style.opacity = '0'), 6000);
  }
  // a toast that takes its text's width (see css/hero.css), so a short line stays one line
  function say(msg) {
    toast(msg); const tt = document.getElementById('toast'); if (!tt) return;
    tt.classList.add('one'); clearTimeout(say.h); say.h = setTimeout(() => tt.classList.remove('one'), 3200);
  }
  // one line: the second and third numbers are on the banners
  function announce() {
    say(t2(`ลูก ${winners[0]} ชนะ!`, `Ball ${winners[0]} wins!`));
    const top = balls.find((b) => b.medal === 1), r = cv.getBoundingClientRect();
    if (top) burst(r.left + top.x, r.top + gy(top.z) - 10, 22, true);
  }
  function pour() {
    if (!B) return;
    const now = performance.now();
    balls.forEach((b) => (b.n = 0, b.medal = 0)); winners = null; rings = []; tag = null; dTag = null;
    const nums = Array.from({ length: 300 }, (_, i) => i + 1).sort(() => R() - 0.5);
    drop(300, { n: nums, spread: 0.32, stagger: 0.006 });
    if (!calm) bal.heat = Math.max(bal.heat, 0.8); poured = 0; pillHide(); wave(now);
    if (!calm) for (let i = 0; i < 5; i++) birds.push({ x: W * (0.28 + 0.44 * R()), y: L.hy - 30 - R() * 40, vx: (W / 4) * (0.8 + R() * 0.4) * (R() < 0.12 ? -1 : 1), vy: -(L.hy * 0.3) / 4 * (0.6 + R() * 0.8), s: 9 + R() * 4, ph: R() * TAU, t0: now + i * 70 });
    if (calm) { balls.forEach((b) => { b.wait = 0; b.h = 0; b.vh = 0; b.x += (R() - 0.5) * W * 0.3 * sc(b.z); b.rest = true; }); relax(balls.filter((b) => b.n)); crown(now); draw(performance.now()); }
  }
  // the cord's pill leaves while the balls pour and returns, worded for another go, three seconds after the crown; a second gold pill comes with it, to buy a ball
  function pillHide() {
    pill = 'hid'; if (!cordBtn) return;
    cordBtn.inert = true; cordBtn.style.transition = calm ? 'none' : 'transform .5s cubic-bezier(.5,0,.8,.4), opacity .35s'; cordBtn.style.transform = `translateY(${H + 60}px)`; cordBtn.style.opacity = '0'; cordBtn.style.pointerEvents = 'none';
    buyHide();
  }
  function pillShow() {
    pill = 'show'; again = true; if (!cordBtn) return;
    const th = cordBtn.querySelector('.th'), en = cordBtn.querySelector('.en'); if (th) th.textContent = 'อีกครั้ง'; if (en) en.textContent = 'Again';
    cordBtn.inert = false; cordBtn.style.transition = calm ? 'none' : 'transform .5s cubic-bezier(.3,1.5,.5,1), opacity .35s'; cordBtn.style.transform = ''; cordBtn.style.opacity = '1'; cordBtn.style.pointerEvents = '';
    buyShow();
  }
  function buyHide() {
    buy.inert = true; buy.setAttribute('aria-hidden', 'true'); buy.tabIndex = -1; buy.style.transition = calm ? 'none' : 'transform .4s cubic-bezier(.5,0,.8,.4), opacity .3s'; buy.style.transform = 'translateY(46px)'; buy.style.opacity = '0'; buy.style.pointerEvents = 'none';
  }
  function buyShow() {
    buy.inert = false; buy.removeAttribute('aria-hidden'); buy.tabIndex = 0; buy.style.transition = calm ? 'none' : 'transform .5s cubic-bezier(.3,1.5,.5,1) .12s, opacity .35s .12s'; buy.style.transform = ''; buy.style.opacity = '1'; buy.style.pointerEvents = '';
    placeCord();
  }
  // people look up, one after another along the row, 40 ms apart
  function wave(now) { people.slice().sort((a, b) => a.x - b.x).forEach((p, i) => (p.waveAt = now + i * 40)); }

  // ── drawing ────────────────────────────────────────────────────────────────
  const bobOf = (ms) => (calm ? 0 : Math.sin(ms / 1300) * 2);
  function pilot(now) { const q = (now / 1000) % 3.5; return calm || q > 0.4 ? 0 : Math.sin((q / 0.4) * Math.PI); }   // the pilot light flares every 3.5 s
  function frameOf(now) {            // where the envelope and the basket are, about the basket's foot
    const pj = pilot(now), pivot = [bal.x + B.cx, bal.y + bbOf()];
    const ang = clamp(bal.vx * 0.004 + bal.lean * 0.0025, -0.12, 0.12) + (calm ? 0 : Math.sin((now / 1000 / 6.2) * TAU) * 0.021);
    return { px: pivot[0], py: pivot[1] - pj * 3, ang, pj, bobE: bobOf(now), bobL: bobOf(now - 400) };
  }
  function toScreen(F, x, y, bob) { const lx = x - B.cx, ly = y - bbOf(), c = Math.cos(F.ang), s = Math.sin(F.ang); return [F.px + lx * c - ly * s, F.py + bob + lx * s + ly * c]; }
  function draw(now) {
    if (!bg) return;
    ctx.drawImage(bg.cv, 0, 0, W, H);
    clouds.forEach((c) => ctx.drawImage(c.sp.cv, c.x, c.y, c.sp.w, c.sp.h));
    drawBirds(now);
    drawTape(now);
    // tethers to two stakes either side of the X
    const F = frameOf(now), [bx, by] = basketAt();
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = look.key; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.75;
    [[-B.S * 0.62, 0.05], [B.S * 0.7, 0.12]].forEach(([dx, dz]) => { const ex = L.x[0] + dx, ey = gy(zX + dz); ctx.beginPath(); ctx.moveTo(bx + Math.sign(dx) * B.basket[2] * 0.45, by - 2); ctx.quadraticCurveTo((bx + ex) / 2, (by + ey) / 2 + 12, ex, ey); ctx.stroke(); });
    ctx.restore();
    [[-B.S * 0.62, 0.05], [B.S * 0.7, 0.12]].forEach(([dx, dz]) => { const ex = L.x[0] + dx, ey = gy(zX + dz); ctx.save(); ctx.fillStyle = look.paper; ctx.fillRect(ex - 2.2, ey - 10, 4.4, 13); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = look.sun; ctx.fillRect(ex - 2.2, ey - 10, 4.4, 13); ctx.fillStyle = look.key; ctx.globalAlpha = 0.5; ctx.fillRect(ex + 0.3, ey - 10, 1.9, 13); ctx.globalAlpha = 0.85; ctx.fillRect(ex - 2.2, ey - 10, 0.9, 13); ctx.fillRect(ex - 2.2, ey - 10, 4.4, 0.9); ctx.restore(); });
    // balls far to near; the balloon's shadow under them
    if (dirty) { balls.sort((a, b) => a.z - b.z); dirty = false; }
    // the light is upper left, so the balloon's shadow falls down and to the right of the X, off its arms; it shrinks as the balloon rises
    const sh = 1 - 0.0065 * clamp(lift, 0, 50);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = look.key; ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.ellipse(bal.x + B.w / 2 + B.S * 0.3, gy(zX) + B.S * 0.07, B.S * 0.32 * sh, B.S * 0.05 * sh, 0, 0, TAU); ctx.fill(); ctx.restore();
    for (const b of balls) drawBall(b, now);
    drawSpot(now);       // the crown: the court goes pale, the chalk grows from the X, the three balls stand out
    drawRings(now);
    drawWinners(now);
    drawBalloon(now, F);
    drawCord(now);
    drawBanners(now);
    drawDist(now);
    for (const p of people) person(ctx, p, now);
    drawFx(now);
  }
  function drawBalloon(now, F) {
    const bb = bbOf(), tt = now / 1000, heat = clamp(bal.heat, 0, 1.2);
    const br = calm ? 0 : Math.sin((tt / 3.1) * TAU), swell = 1 + 0.03 * clamp((heat - 0.2) / 0.8, 0, 1);
    const sx = (1 + 0.008 * br) * swell, sy = (1 - 0.005 * br) * swell, my = B.top + B.H - bb;
    // the envelope and its coral skirt: breathes about the mouth
    ctx.save(); ctx.translate(F.px, F.py + F.bobE); ctx.rotate(F.ang); ctx.translate(0, my); ctx.scale(sx, sy); ctx.translate(0, -my);
    ctx.drawImage(B.cv, 0, 0, B.cv.width, B.cut * dpr, -B.cx, -bb, B.w, B.cut);
    ctx.restore();
    // cables run live from the skirt to the frame, since the basket lags the envelope by 0.4 s
    ctx.save(); ctx.strokeStyle = look.key; ctx.lineWidth = Math.max(0.7, B.S / 300); ctx.lineCap = 'round'; ctx.beginPath();
    B.cables.forEach(([x0, y0, x1, y1]) => { const a = toScreen(F, x0, y0, F.bobE), c = toScreen(F, x1, y1, F.bobL); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); }); ctx.stroke(); ctx.restore();
    // the basket, the pilots, the burner and its flame
    ctx.save(); ctx.translate(F.px, F.py + F.bobL); ctx.rotate(F.ang);
    ctx.drawImage(B.cv, 0, B.cut * dpr, B.cv.width, B.cv.height - B.cut * dpr, -B.cx, -bb + B.cut, B.w, B.h - B.cut);
    flame(ctx, B.mouth[0] - B.cx, B.mouth[1] - bb, B.S * 0.07, 0.25 + F.pj * 0.35 + heat * 0.9, tt);
    ctx.restore();
  }
  // a ball rests on its shadow: its centre is a radius above the ground point
  function drawBall(b, now) {
    if (b.wait > 0) return;
    const s = sc(b.z), r = rb * s, gyb = gy(b.z), y = gyb - b.h - r, air = 1 - Math.min(1, b.h / 120);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = look.key; ctx.globalAlpha = 0.22 * air; ctx.beginPath(); ctx.ellipse(b.x + r * 0.45, gyb + r * 0.08, r * 1.05, r * 0.34, 0, 0, TAU); ctx.fill(); ctx.restore();
    // a ball falling fast leaves a streak of paper above it
    if (b.vh < -2.5 && b.h > 6) { ctx.save(); ctx.strokeStyle = look.paper; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x, y - r - 1); ctx.lineTo(b.x, y - r - 1 - Math.min(14, -b.vh * 2.2)); ctx.stroke(); ctx.restore(); }
    const sp = ballSprite(Math.round(r * 2) / 2, dpr);
    if (b.spin > 0) { ctx.save(); ctx.translate(b.x, y); ctx.rotate(b.rot * 2); ctx.drawImage(sp.cv, -sp.size / 2, -sp.size / 2, sp.size, sp.size); ctx.restore(); }
    else ctx.drawImage(sp.cv, b.x - sp.size / 2, y - sp.size / 2, sp.size, sp.size);
  }
  // the crown, part one: once the rings start the court goes 30% paper, so the pile steps back
  function drawSpot(now) {
    if (!rings.length) return;
    const k = clamp((now - rings[0].at) / 320); if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = 0.3 * k; ctx.fillStyle = look.paper; ctx.fillRect(0, L.hy + 2, W, Math.max(0, gy(zTape) - 6 - L.hy - 2)); ctx.restore();
  }
  // how far a winner has popped: 1 to 1.6 times its size, with a little overshoot
  const popOf = (rg, now) => { const k = clamp((now - rg.at - 380) / 260); return k <= 0 ? 1 : 1 + 0.6 * k + 0.25 * Math.sin(k * Math.PI); };
  // part two: the three balls again at 1.6x, a ring in the medal's ink round each
  function drawWinners(now) {
    rings.forEach((rg) => {
      const b = rg.b; if (!b || now < rg.at + 380) return;
      const p = popOf(rg, now), r = rb * sc(b.z) * p, c = gy(b.z) - b.h - rb * sc(b.z) * p, sp = ballSprite(Math.round(r * 2) / 2, dpr);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = look.key; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.ellipse(b.x + r * 0.45, gy(b.z) + r * 0.08, r * 1.05, r * 0.34, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.drawImage(sp.cv, b.x - sp.size / 2, c - sp.size / 2, sp.size, sp.size);
      ctx.save(); ctx.beginPath(); ctx.arc(b.x, c, r + 1.6, 0, TAU); ctx.strokeStyle = look.paper; ctx.globalAlpha = 0.95; ctx.lineWidth = 3.4; ctx.stroke(); ctx.globalAlpha = 1; ctx.strokeStyle = [look.sun, look.key, look.warm][rg.medal - 1]; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    });
  }
  // the winners: each ball keeps a pole, its top at most 40, 28 and 18 px over the ball, and the three banners hang in a fan over the X (1st straight up, 2nd left, 3rd right),
  // each on a 1 px leader from its pole. A banner is a rank in a disc and the ball's number on the medal's ink, its swallow tail to the right like the others in the wind.
  function drawBanners(now) {
    const kw = wide ? 1.25 : 1, [X, Y] = L.x;
    rings.forEach((rg) => {
      const k = clamp((now - rg.at - 380) / 240); if (k <= 0 || !rg.b) return;
      const b = rg.b, m = rg.medal - 1, e = 1 + 0.35 * Math.sin(k * Math.PI) * (1 - k), s = k < 1 ? clamp(k * 1.4, 0, 1) * e : 1, g = clamp(k * 1.4);
      const rr = rb * sc(b.z) * popOf(rg, now), foot = gy(b.z) - b.h - 2 * rr - 1.6, top = foot - FLAG.cap[m] * kw * g, col = [look.sun, look.paper, look.warm][m];
      const fs = FLAG.fs[m] * kw, fh = fs + 6, dr = fh / 2, notch = 6, label = String(b.n), dir = 1, flut = calm ? 0 : Math.sin(now / 170 + b.n) * 1.4;
      ctx.save(); ctx.font = `700 ${fs}px "Inter","Noto Sans Thai",sans-serif`; const fw = dr * 2 + 4 + ctx.measureText(label).width + notch + 6; ctx.restore();
      const bx = clamp(X + FLAG.slot[m][0] * kw, fw / 2 + 4, W - fw / 2 - 4), by = Y + FLAG.slot[m][1] * kw;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // the pole and its knob, and the leader to the banner's nearest edge
      ctx.strokeStyle = look.key; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(b.x, foot); ctx.lineTo(b.x, top); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.x, top, 2.2, 0, TAU); ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
      const lx = clamp(b.x, bx - fw / 2, bx + fw / 2), ly = clamp(top, by - fh / 2, by + fh / 2);
      if (Math.hypot(lx - b.x, ly - top) > 2) { ctx.beginPath(); ctx.moveTo(b.x, top); ctx.lineTo(lx, ly); ctx.strokeStyle = look.paper; ctx.globalAlpha = 0.8; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; ctx.strokeStyle = look.key; ctx.lineWidth = 1; ctx.stroke(); }
      // the banner
      ctx.translate(bx, by); ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(-dir * fw / 2, -fh / 2); ctx.lineTo(dir * fw / 2, -fh / 2 + flut * 0.4); ctx.lineTo(dir * (fw / 2 - notch), flut); ctx.lineTo(dir * fw / 2, fh / 2 + flut * 0.6); ctx.lineTo(-dir * fw / 2, fh / 2); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = look.key; ctx.lineWidth = 1.5; ctx.stroke();
      // the rank in a key disc at the pole's end of the banner, the ball's number after it
      const dx = -dir * (fw / 2 - dr - 0.5);
      ctx.beginPath(); ctx.arc(dx, 0, dr - 2, 0, TAU); ctx.fillStyle = look.key; ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${fs * 0.9}px "Inter","Noto Sans Thai",sans-serif`; ctx.fillStyle = look.paper; ctx.fillText(String(rg.medal), dx, 0.8);
      ctx.font = `700 ${fs}px "Inter","Noto Sans Thai",sans-serif`; ctx.fillStyle = look.key; ctx.fillText(label, dx + dir * (dr + 2 + (fw - dr * 2 - 4 - notch) / 2 - 1), 0.8 + flut * 0.3);
      ctx.restore();
    });
    // a tapped ball's number: a small pennant on a pole over that ball, a tap on it goes to the Give panel
    if (tag) {
      if (now - tag.t0 > 7000 || !tag.b) tag = null;
      else {
        const b = tag.b, r = rb * sc(b.z), gyb = gy(b.z), s = clamp((now - tag.t0) / 160), fs = 11, label = String(tag.n), fw = Math.max(26, label.length * fs * 0.62 + 10), fh = fs + 5, flut = calm ? 0 : Math.sin(now / 170 + b.n) * 1.4;
        const px = b.x, foot = gyb - b.h - r * 2 + 1, top = foot - 3 - 24 * s, d = px > W - fw - 8 ? -1 : 1;
        ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = look.key; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(px, foot); ctx.lineTo(px, top); ctx.stroke();
        ctx.translate(px, top); ctx.scale(s, s);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d * fw, flut * 0.4); ctx.lineTo(d * (fw - 6), fh / 2 + flut); ctx.lineTo(d * fw, fh + flut * 0.6); ctx.lineTo(0, fh); ctx.closePath();
        ctx.fillStyle = look.paper; ctx.fill(); ctx.strokeStyle = look.key; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.fillStyle = look.key; ctx.font = `700 ${fs}px "Inter","Noto Sans Thai",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, d * (fw / 2 - 2), fh / 2 + 1 + flut * 0.4);
        ctx.restore();
        tag.box = [d > 0 ? px : px - fw, top, fw, fh];
      }
    }
  }
  // how far a ball from a tap on the lawn is from the X, in the board's metres, in a small label above it
  function distTag(b) { dTag = { b, m: (Math.round(metres(b) * 10) / 10).toFixed(1), t0: performance.now() }; dirty = true; }
  function drawDist(now) {
    if (!dTag) return;
    const age = now - dTag.t0; if ((!calm && age > 3400) || !dTag.b) { dTag = null; return; }
    const b = dTag.b, r = rb * sc(b.z), c = gy(b.z) - b.h - r, txt = t2(`ห่าง X ${dTag.m} ม.`, `${dTag.m} m from X`), al = calm ? 1 : clamp(age / 140) * clamp((3400 - age) / 400);
    ctx.save(); ctx.globalAlpha = al; ctx.font = `700 11px "Noto Sans Thai","Inter",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 14, h = 19, x = clamp(b.x - w / 2, 4, W - w - 4), above = c - r - 11 - h > 4, y = above ? c - r - 11 - h : c + r + 11;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fillStyle = look.paper; ctx.fill(); ctx.strokeStyle = look.key; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); const tx = clamp(b.x, x + 8, x + w - 8); if (above) { ctx.moveTo(tx - 4, y + h); ctx.lineTo(tx, y + h + 6); ctx.lineTo(tx + 4, y + h); } else { ctx.moveTo(tx - 4, y); ctx.lineTo(tx, y - 6); ctx.lineTo(tx + 4, y); }
    ctx.fillStyle = look.paper; ctx.fill(); ctx.stroke();
    ctx.fillStyle = look.paper; ctx.fillRect(tx - 3, above ? y + h - 2 : y - 0.5, 6, 2.5);
    ctx.fillStyle = look.key; ctx.fillText(txt, x + w / 2, y + h / 2 + 0.8); ctx.restore();
  }
  // chalk rings measured from the X: the radius is how far the ball is, in the lawn's own squash, but never under 12, 22 and 32 px
  // (times the lawn's scale at the X): the three grow as a bullseye of nested ellipses, and a short chalk leader runs from each ring to its ball
  function drawRings(now) {
    if (!rings.length) return;
    const [X, Y] = L.x, base = sc(zX), floor = [12, 22, 32]; ctx.save(); ctx.lineCap = 'round';
    rings.forEach((rg) => {
      const k = clamp((now - rg.at) / 380); if (k <= 0) return; const e = 1 - Math.pow(1 - k, 3), R0 = Math.max(rg.r, floor[rg.medal - 1] * base), r = R0 * e, tint = [look.sun, look.key, look.warm][rg.medal - 1];
      const stroke = (wp, wc, dash) => {
        ctx.strokeStyle = look.paper; ctx.globalAlpha = 0.95; ctx.lineWidth = wp; ctx.stroke();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = tint; ctx.lineWidth = wc; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
      };
      ctx.beginPath(); ctx.ellipse(X, Y, Math.max(1, r), Math.max(0.4, r * SQ), 0, 0, TAU); stroke(3.2, 1.6, rg.medal === 2 ? [5, 4] : []);
      const b = rg.b; if (!b || k < 0.6 || R0 - rg.r < 1.5) return;
      const by = gy(b.z), a = Math.atan2((by - Y) / SQ, b.x - X), rx = X + Math.cos(a) * R0, ry = Y + Math.sin(a) * R0 * SQ, br = rb * sc(b.z), cy = by - b.h - br, d = Math.hypot(b.x - rx, cy - ry);
      if (d < br + 3) return;
      const ex = b.x - ((b.x - rx) / d) * (br + 1.5), ey = cy - ((cy - ry) / d) * (br + 1.5), lk = clamp((k - 0.6) / 0.4);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + (ex - rx) * lk, ry + (ey - ry) * lk); stroke(2.6, 1.1, []);
    });
    ctx.restore();
  }
  // the tape: yellow with black stripes, rippling in a wind that travels along it
  function drawTape(now) {
    const pts = L.tape; if (pts.length < 2) return;
    const tw = Math.max(2.2, L.tapeW), tt = calm ? 0 : now / 1000, line = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
      for (let k = 0; k < n; k++) { const f = k / n, x = lerp(x0, x1, f), span = ((i % 4) + f) / 4; line.push([x, lerp(y0, y1, f) + (calm ? 0 : Math.sin(span * Math.PI) * 3.4 * Math.sin((x / 90 - tt / 2) * TAU))]); }
    }
    line.push(pts[pts.length - 1]);
    ctx.save(); ctx.lineJoin = 'round'; ctx.beginPath(); line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = look.paper; ctx.lineWidth = tw + 1.6; ctx.stroke();
    ctx.strokeStyle = look.sun; ctx.lineWidth = tw; ctx.stroke();
    ctx.strokeStyle = look.key; ctx.globalAlpha = 0.92; ctx.setLineDash([tw * 1.2, tw * 1.2]); ctx.stroke(); ctx.restore();
  }
  // a startled bird: a 2 px body and two tapered crescent wings whose angle follows the flap; a paper edge 3 px wide under a key fill
  function drawBirds(now) {
    if (!birds.length) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    birds.forEach((b) => {
      const q = (now - b.t0) / 1000; if (q < 0) return;
      const x = b.x + b.vx * q, y = b.y + b.vy * q + Math.sin(q * 3 + b.ph) * 3, fl = Math.sin(q * 16 + b.ph), a = 0.2 + 0.75 * fl, s = b.s, tilt = Math.atan2(b.vy, Math.abs(b.vx)) * 0.35 * (Math.sign(b.vx) || 1);
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      [-1, 1].forEach((sg) => {
        ctx.save(); ctx.scale(sg, 1); ctx.rotate(-a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.38, -s * 0.7, s, s * 0.12); ctx.quadraticCurveTo(s * 0.5, -s * 0.16, 0, s * 0.07); ctx.closePath();
        ctx.strokeStyle = look.paper; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = look.key; ctx.fill();
        ctx.restore();
      });
      ctx.beginPath(); ctx.arc(0, s * 0.04, 1.3, 0, TAU); ctx.fillStyle = look.paper; ctx.fill(); ctx.strokeStyle = look.paper; ctx.lineWidth = 1.5; ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * 0.04, 1.1, 0, TAU); ctx.fillStyle = look.key; ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }
  function drawFx(now) {
    fx = fx.filter((f) => now - f.t0 < f.life);
    fx.forEach((f) => {
      const k = (now - f.t0) / f.life;
      if (f.type === 'dust') { ctx.save(); ctx.globalAlpha = 0.6 * (1 - k); ctx.fillStyle = look.paper; ctx.beginPath(); ctx.arc(f.x + f.dx * k, f.y - 10 * k, f.r * (1 - 0.4 * k), 0, TAU); ctx.fill(); ctx.restore(); }
      else if (f.type === 'ring') { const e = 1 - Math.pow(1 - k, 2); ctx.save(); ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = look.paper; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * e, f.r * e * 0.45, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = look.warm; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
    });
  }
  function drawCord(now) {
    const open = 1 - (calm ? (winners ? 1 : 0) : cord.tuck);
    if (open < 0.03) { cord.ring = null; return; }
    const [x, y] = basketAt(), len = (cord.len + cord.pull) * open, sway = calm ? 0 : Math.sin(now / 700) * 3;
    const ex = x + sway, ey = y + len;
    ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = open;
    ctx.strokeStyle = look.paper; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 2, y + len / 2, ex, ey); ctx.stroke();
    ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = look.warm; ctx.setLineDash([4, 4]); ctx.lineWidth = 3.4; ctx.stroke(); ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = look.key; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(ex, ey + 7 * open, 7 * open, 0, TAU); ctx.stroke();
    ctx.restore();
    cord.ring = open > 0.9 ? [ex, ey + 7] : null;
  }
  // the pill: beside the basket on a wide stage; on a phone, across the tape below the X, and up in the sky once it reads 'again', clear of the pile.
  // The buy pill takes the tape's place once the cord's pill has gone up. The grab sits on the cord's ring.
  function placeCord() {
    if (!B || !cordBtn) return;
    const [x, y] = basketAt(), pw = cordBtn.offsetWidth || 160, ph = cordBtn.offsetHeight || 30;
    const left = wide ? x + B.basket[2] / 2 + 12 : again ? W - pw - 10 : x - pw / 2, top = wide ? y - B.basket[3] * 0.5 - ph / 2 : again ? 10 : gy(zTape) - ph - 6;
    cordBtn.style.left = Math.round(clamp(left, 8, W - pw - 8)) + 'px'; cordBtn.style.top = Math.round(top) + 'px';
    const bw = buy.offsetWidth || 190, bh = buy.offsetHeight || 30;
    buy.style.left = Math.round(clamp(L.x[0] - bw / 2, 8, W - bw - 8)) + 'px'; buy.style.top = Math.round(gy(zTape) - bh - 6) + 'px';
    const on = !!cord.ring && pill !== 'hid';
    if (on) { grab.style.left = Math.round(cord.ring[0] - 24) + 'px'; grab.style.top = Math.round(cord.ring[1] - 24) + 'px'; }
    if (grab.hidden === on) grab.hidden = !on;
  }

  // ── motion ─────────────────────────────────────────────────────────────────
  function physics(dt, now) {
    // the balloon: a spring to where it should be, the burner's lift, the pour's lightening, a drag on a tether
    let tx = bal.ax + bal.lean, ty = bal.ay - bal.heat * 22 - lift;
    if (bal.drag) { tx = bal.drag.x; ty = bal.drag.y; const dx = tx - bal.ax, dy = ty - bal.ay, d = Math.hypot(dx, dy), m = B.S * 0.45; if (d > m) { tx = bal.ax + (dx / d) * m; ty = bal.ay + (dy / d) * m; } }
    const k = bal.drag ? 0.25 : 0.035, damp = bal.drag ? 0.6 : 0.9, f = dt * 60;
    bal.vx = (bal.vx + (tx - bal.x) * k * f) * Math.pow(damp, f); bal.vy = (bal.vy + (ty - bal.y) * k * f) * Math.pow(damp, f);
    bal.x += bal.vx * f; bal.y += bal.vy * f;
    if (bal.burn > 0) { bal.burn -= dt; bal.heat = Math.max(bal.heat, 0.85); } else bal.heat = Math.max(0, bal.heat - dt * 0.55);
    // up to 46 px as the balls leave it, 26 while the crown stands, back down once the pill returns
    const rise = pill === 'hid' ? (winners ? 26 : 46 * (poured / 300)) : 0;
    lift = lerp(lift, Math.min(rise, liftMax), 1 - Math.pow(pill === 'hid' ? 0.9 : 0.94, f));
    // the cord is drawn up out of the way while the crown stands, and let down again for the next pour
    cord.tuck = calm ? (winners ? 1 : 0) : lerp(cord.tuck, winners ? 1 : 0, 1 - Math.pow(0.88, f));
    // the cord springs back
    if (!cord.drag) { cord.v = (cord.v - cord.pull * 0.18) * 0.78; cord.pull = Math.max(0, cord.pull + cord.v); }
  }
  function frame(now) {
    if (!vis) { running = false; return; }
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
    if (!calm && B) {
      if (now > nextDrop) { const [tx, tz] = ringSpot(); aimBall(tx, tz, { roll: 1.4 }); wave(now); nextDrop = now + 2400 + R() * 2600; }
      if (now > nextLife && people.length) { const q = people[Math.floor(R() * people.length)]; if (R() < 0.5) q.hop = now; else q.phoneUntil = now + 2600; nextLife = now + 6000 + R() * 3000; }
      clouds.forEach((c) => { c.x += c.v * dt; if (c.x > W + 8) c.x = -c.sp.w; });
      birds = birds.filter((b) => now - b.t0 < 4600);
    }
    if (pill === 'hid' && winners === null) { let n = 0; for (const b of balls) if (b.n && b.wait <= 0) n++; poured = n; }
    physics(dt, now);
    const moving = step(dt);
    if (!moving && winners === null && balls.some((b) => b.n)) crown(now);
    // the rings arrive on the beat: the crowd hops with each, the toast comes with the last
    rings.forEach((rg) => { if (!rg.fired && now >= rg.at) { rg.fired = true; people.slice().sort(() => R() - 0.5).slice(0, 3).forEach((q, i) => (q.hop = now + i * 60)); if (rg.medal === 1) announce(); } });
    if (pill === 'hid' && winners && pillBackAt && now >= pillBackAt) { pillBackAt = 0; pillShow(); }
    // a finger dragged through resting balls scatters them
    if (ptr && down && down.drag && now - ptr.t < 90) for (const b of balls) { if (!b.rest || b.medal) continue; const y = gy(b.z) - rb * sc(b.z); if (Math.abs(b.x - ptr.x) < 22 && Math.abs(y - ptr.y) < 16) { touch(); b.rest = false; b.vh = 2.4 + R() * 3; b.vx = Math.sign(b.x - ptr.x || 1) * (0.8 + R() * 1.8) + ptr.vx * 0.12; b.vz = (R() - 0.5) * 0.008; } }
    // the people turn their heads to the balloon, higher when it is high
    const bx = bal.x + B.cx, high = clamp((gy(zX) - (bal.y + B.basket[1] + B.basket[3])) / ((L.h || H) * 0.3), 0, 1);
    for (const p of people) { p.gaze = clamp((bx - p.x) / (W * 0.5), -1, 1); const wv = p.waveAt ? clamp((now - p.waveAt) / 700, 0, 1) : 1; p.tilt = high * 0.8 + 0.7 * (wv < 1 && wv > 0 ? Math.sin(wv * Math.PI) : 0); }
    draw(now); placeCord();
    requestAnimationFrame(frame);
  }
  function kick() { if (!running && vis && !calm) { running = true; last = 0; requestAnimationFrame(frame); } else if (calm) { draw(performance.now()); placeCord(); } }

  // ── hands ──────────────────────────────────────────────────────────────────
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onBalloon = (p) => {
    const F = frameOf(performance.now()), bb = bbOf(), dx = p.x - F.px, dy = p.y - (F.py + F.bobE), c = Math.cos(-F.ang), s = Math.sin(-F.ang);
    const x = dx * c - dy * s + B.cx, y = dx * s + dy * c + bb;
    return probe.isPointInPath(B.env, x, y) || (x > B.basket[0] - 6 && x < B.basket[0] + B.basket[2] + 6 && y > B.basket[1] - 6 && y < B.basket[1] + B.basket[3] + 6);
  };
  const hitPerson = (p) => { for (let i = people.length - 1; i >= 0; i--) { const q = people[i], u = q.h / 10; if (Math.abs(p.x - q.x) < 2.4 * u && p.y < q.base + u && p.y > q.base - 11 * u) return q; } return null; };
  const hitBall = (p) => { let best = null, bd = 1e9; for (const b of balls) { if (!b.rest) continue; const r = rb * sc(b.z), d = Math.hypot(p.x - b.x, p.y - (gy(b.z) - r)); if (d < r + 6 && d < bd) { best = b; bd = d; } } return best; };
  // the hint goes once the hand has done something: a drag, or a tap that hit a part of the picture (a swipe past it is the page's)
  const touch = () => { if (touched) return; touched = true; if (hint) { clearTimeout(hintTimer); hint.style.transition = 'opacity .6s'; hint.style.opacity = '0'; hint.style.pointerEvents = 'none'; } };
  let down = null;
  // a numbered ball: its number goes to the Get a ball panel, a pennant shows it, a second tap on the pennant goes to Give
  function ballTap(b, e) {
    if (!b.tagN) b.tagN = b.n || 1 + Math.floor(R() * 300);
    const n = b.tagN; tag = { b, n, t0: performance.now(), box: null };
    if (numIn) { numIn.value = n; numIn.dispatchEvent(new Event('input', { bubbles: true })); }
    say(t2(`ลูกหมายเลข ${n} · ฿1,000`, `Ball ${n} · ฿1,000`));
    if (!calm) { b.rest = false; b.vh = 1.7; b.vx = (R() < 0.5 ? -1 : 1) * 0.42; b.vz = 0; b.spin = 1; setTimeout(() => (b.spin = 0), 900); if (navigator.vibrate) navigator.vibrate(8); burst(e.clientX, e.clientY, 4); }
    dirty = true; kick();
  }
  // a tap on the lawn lets a ball go from the basket to that spot; it says how far from the X it came to rest
  function dropAt(p, e) {
    const tx = clamp(p.x, 6, W - 6), tz = zOf(p.y);
    burst(e.clientX, e.clientY, 5);
    if (calm) { const b = blank({ x: tx, z: tz, rest: true }); balls.push(b); relax([b]); distTag(b); dirty = true; kick(); return; }
    aimBall(tx, tz, { react: true, ask: true });
  }
  // the cord: a pull of the ring, or a tap on it
  function cordDown(e) {
    const p = at(e), now = performance.now(); down = { ...p, t: now, moved: 0, drag: false, hit: 'cord' }; touch();
    cord.drag = { y0: p.y - cord.pull }; e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); kick();
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!B) return;
    const p = at(e), now = performance.now(); down = { ...p, t: now, moved: 0, drag: false, cx: e.clientX, cy: e.clientY, act: null };
    if (cord.ring && pill !== 'hid' && Math.hypot(p.x - cord.ring[0], p.y - cord.ring[1]) < 24) { cordDown(e); return; }
    if (onBalloon(p)) { touch(); bal.drag = { x: bal.x, y: bal.y, ox: p.x - bal.x, oy: p.y - bal.y }; cv.setPointerCapture(e.pointerId); return; }
    // everything else answers a tap, when the finger comes up where it went down
    const me = { clientX: e.clientX, clientY: e.clientY };
    if (tag && tag.box && p.x > tag.box[0] - 4 && p.x < tag.box[0] + tag.box[2] + 4 && p.y > tag.box[1] - 4 && p.y < tag.box[1] + tag.box[3] + 4) { down.hit = 'tag'; down.act = () => { const g = document.getElementById('give'); if (g) g.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); }; return; }
    const q = hitPerson(p); if (q) { down.hit = 'person'; down.act = () => { if (!calm) q.hop = performance.now(); burst(me.clientX, me.clientY, 10); kick(); }; return; }
    const b = hitBall(p); if (b) { down.hit = 'ball'; down.act = () => ballTap(b, me); return; }
    if (Math.abs(p.x - L.x[0]) < L.xs * 2 && Math.abs(p.y - L.x[1]) < L.xs) {
      down.hit = 'x';
      down.act = () => {
        drop(1); burst(me.clientX, me.clientY, 16, true);
        if (!calm) for (let i = 0; i < 6; i++) fx.push({ type: 'dust', x: p.x + (R() - 0.5) * 22, y: p.y + (R() - 0.5) * 6, dx: (R() - 0.5) * 8, rise: 0, r: 1.3 + R() * 1.4, t0: performance.now() + i * 40, life: 700 });
        kick();
      };
      return;
    }
    if (p.y < L.hy - 10) down.act = () => dingbatFloat('balloon', me.clientX, me.clientY);
    else if (p.y > L.hy && p.y < gy(zTape)) down.act = () => dropAt(p, me);
    else if (p.y >= gy(zTape)) down.act = () => { let q2 = null, qd = 1e9; for (const o of people) { const d = Math.abs(o.x - p.x); if (d < qd) { q2 = o; qd = d; } } if (q2 && qd < 70) { if (!calm) q2.hop = performance.now(); burst(me.clientX, me.clientY, 8); kick(); } };
  });
  function onMove(e) {
    const p = at(e), now = performance.now();
    ptr = { x: p.x, y: p.y, vx: ptr ? p.x - ptr.x : 0, t: now };
    if (down) { down.moved = Math.max(down.moved, Math.hypot(p.x - down.x, p.y - down.y)); if (down.moved > 6 && !down.hit && !cord.drag && !bal.drag) down.drag = true; }
    if (cord.drag) { cord.pull = clamp(p.y - cord.drag.y0, 0, 90); kick(); return; }
    if (bal.drag) { bal.drag.x = p.x - bal.drag.ox; bal.drag.y = p.y - bal.drag.oy; kick(); return; }
    if (!calm && e.pointerType === 'mouse') bal.lean = clamp((p.x - (bal.ax + B.w / 2)) * 0.06, -26, 26);
    if (down && down.drag) kick();
  }
  const up = (e) => {
    const ok = !e || e.type !== 'pointercancel';
    if (cord.drag) { const pulled = cord.pull; cord.drag = null; if (ok && (pulled > 28 || (down && down.moved < 6))) { cord.v = -6; if (calm) cord.pull = 0; pour(); } }
    else if (bal.drag) {
      const tap = ok && down && down.moved < 7; bal.drag = null;
      if (tap) {
        const now = performance.now(), r = cv.getBoundingClientRect(), F = frameOf(now), m = toScreen(F, B.mouth[0], B.mouth[1], F.bobL);
        if (!calm) { bal.heat = 1; bal.burn = 1.2; } burst(r.left + m[0], r.top + m[1], 12);
        // a ring at the mouth, and three people nearby look up and hop 120 ms apart
        if (!calm) fx.push({ type: 'ring', x: m[0], y: m[1], r: B.S * 0.32, t0: now, life: 520 });
        if (!calm) people.slice().sort((a, b) => Math.abs(a.x - m[0]) - Math.abs(b.x - m[0])).slice(0, 3).forEach((q, i) => { q.hop = now + i * 120; q.waveAt = now + i * 120; });
      }
    } else if (ok && down && down.act && !down.drag && down.moved < 8) { touch(); down.act(); }
    down = null; kick();
  };
  cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { ptr = null; bal.lean = 0; });
  grab.addEventListener('pointerdown', cordDown); grab.addEventListener('pointermove', onMove); grab.addEventListener('pointerup', up); grab.addEventListener('pointercancel', up);
  cordBtn && cordBtn.addEventListener('click', () => { touch(); cord.pull = calm ? 0 : 60; cord.v = -4; pour(); kick(); });

  // ── life ───────────────────────────────────────────────────────────────────
  function rebuild() { if (layout()) { if (calm && !balls.length) scatter(140, 3.2); draw(performance.now()); kick(); } }
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(rebuild, 180); });
  // the stage can change size with no window resize (on a wide page it is as tall as the copy beside it, and that grows when the fonts arrive): print the picture again at its true size
  if ('ResizeObserver' in window) new ResizeObserver(() => { const r = stage.getBoundingClientRect(); if (Math.round(r.width) !== W || Math.round(r.height) !== H) { clearTimeout(rt); rt = setTimeout(rebuild, 120); } }).observe(stage);
  onLook(() => rebuild());
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { vis = e[0].isIntersecting; if (vis) kick(); }).observe(stage);
  rebuild();
  // a few balls already on the grass when the page opens, round the X and clear of it
  buyHide();
  if (!calm) { scatter(14, 1.8); draw(performance.now()); kick(); }
  return { pour };
}
