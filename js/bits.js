// The small things every part of the page shares: the language switch, a toast, sparks, a
// dingbat balloon let go, the countdown, sharing, the QR, the sample ticket, the prize coins.
import { look, onLook, rng, surface } from './riso.js';
import { encodeQr } from './qr.js';

export const PAGE = 'https://nanobotco.github.io/golf-ball-drop/';
export const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

// the words in whichever language is showing; both, Thai first, when both are
export function t2(th, en) { return root.classList.contains('lang-en') ? en : root.classList.contains('lang-th') ? th : th + ' · ' + en; }

export function lang() {
  const btns = document.querySelectorAll('.lang button');
  function set(v) { root.classList.remove('lang-th', 'lang-en', 'lang-both'); root.classList.add('lang-' + v); root.lang = v === 'en' ? 'en' : 'th'; btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === v))); }
  btns.forEach((b) => b.addEventListener('click', () => { set(b.dataset.set); try { b.dataset.set === 'both' ? localStorage.removeItem('md-lang') : localStorage.setItem('md-lang', b.dataset.set); } catch (e) {} }));
  let v = null; try { v = localStorage.getItem('md-lang'); } catch (e) {}
  if (v === 'th' || v === 'en') set(v);
}

export function toast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2800);
}

// sparks in the page's inks
export function burst(x, y, n = 14, star = false) {
  if (calm) return;
  const inks = ['#F1BE4F', '#E2735C', '#7FA6C9', '#78A981'];
  for (let i = 0; i < n; i++) {
    const e = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 54;
    e.className = 'spark' + (star || i % 3 === 0 ? ' star' : ''); e.style.left = x - 4 + 'px'; e.style.top = y - 4 + 'px'; e.style.background = inks[i % inks.length];
    e.style.setProperty('--dx', Math.cos(a) * d + 'px'); e.style.setProperty('--dy', Math.sin(a) * d - 22 + 'px');
    document.body.appendChild(e); e.addEventListener('animationend', () => e.remove());
  }
}

// a dingbat let go from a point, rising off the top of the screen
export function dingbatFloat(name, x, y) {
  if (calm || document.querySelectorAll('.float-db').length > 18) return;
  const cols = [['#F1BE4F', '#E2A93A'], ['#7FA6C9', '#5E86AB'], ['#E2735C', '#C25B47'], ['#D98C9C', '#C26F81']], [a, b] = cols[Math.floor(Math.random() * cols.length)];
  const e = document.createElement('div'); e.className = 'float-db'; e.setAttribute('aria-hidden', 'true');
  e.innerHTML = name === 'golf-ball'
    ? '<svg viewBox="0 0 30 38" width="30" height="38"><circle cx="15" cy="15" r="11" fill="#fff"/><path d="M26 15a11 11 0 0 1-21 5 11 11 0 0 0 21-5z" fill="#DCE1E8"/></svg>'
    : `<svg viewBox="0 0 30 38" width="30" height="38"><path d="M15 27C5 21 3 12 5 8 8 2 22 2 25 8c2 4 0 13-10 19z" fill="${a}"/><path d="M15 2c5 0 9 2 10 6 2 4 0 13-10 19 4-6 5-15 0-25z" fill="${b}"/><rect x="12.5" y="30" width="5" height="4" rx="1" fill="#9C6C41"/><path d="M12 27l1 3M18 27l-1 3" stroke="#5C6577" stroke-width=".7"/></svg>`;
  e.style.left = x - 15 + 'px'; e.style.top = y - 30 + 'px';
  e.style.setProperty('--d', 6 + Math.random() * 5 + 's'); e.style.setProperty('--x', (Math.random() * 120 - 60) + 'px'); e.style.setProperty('--r', (Math.random() * 20 - 10) + 'deg');
  document.body.appendChild(e); e.addEventListener('animationend', () => e.remove());
}

// days, hours and minutes to the drop, as an odometer
export function countdown() {
  const el = document.getElementById('count'); if (!el) return;
  const DROP = Date.parse('2027-01-30T15:00:00+07:00');
  function render() {
    const ms = DROP - Date.now();
    if (ms <= 0) { el.innerHTML = '<span class="th">วันนี้แล้ว!</span><span class="en">It is today!</span>'; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    const odo = (n, w) => '<span class="odo">' + String(n).padStart(w, '0').split('').map((c) => '<b>' + c + '</b>').join('') + '</span>';
    el.innerHTML = `<span class="th">อีก</span><span class="en">In</span> ${odo(d, 2)} <span class="th">วัน</span><span class="en">days</span> ${odo(h, 2)} <span class="th">ชม.</span><span class="en">hrs</span> ${odo(m, 2)} <span class="th">นาที บอลลูนจะปล่อยลูก</span><span class="en">min the balls drop</span>`;
  }
  render(); setInterval(render, 30000);
}

export function share() {
  const nat = document.getElementById('sh-native');
  if (nat && navigator.share) { nat.hidden = false; nat.addEventListener('click', () => navigator.share({ title: document.title, url: PAGE }).catch(() => {})); }
  const copy = document.getElementById('sh-copy');
  copy && copy.addEventListener('click', (e) => { copyText(PAGE, t2('คัดลอกลิงก์แล้ว', 'Link copied')); burst(e.clientX, e.clientY, 12); });
}
export function shareText(text) {
  if (navigator.share) return navigator.share({ title: document.title, text, url: PAGE }).catch(() => {});
  copyText(text + ' ' + PAGE, t2('คัดลอกแล้ว', 'Copied'));
}
export function copyText(text, said) {
  const done = () => toast(said || t2('คัดลอกแล้ว', 'Copied'));
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => prompt('', text));
  else prompt('', text);
}

// the phone's bottom bar, once the hero has scrolled away
export function dock() {
  const d = document.getElementById('dock'), h = document.querySelector('.hero');
  if (d && h && 'IntersectionObserver' in window) new IntersectionObserver((e) => d.classList.toggle('on', !e[0].isIntersecting)).observe(h);
}

export function lightbox() {
  const lb = document.getElementById('lb'); if (!lb || !lb.showModal) return;
  const im = lb.querySelector('img');
  document.querySelectorAll('.ph').forEach((b) => b.addEventListener('click', () => { im.src = b.dataset.src; im.alt = b.querySelector('img').alt; lb.showModal(); }));
  lb.addEventListener('click', () => lb.close());
}

// the page's own QR, dark on white at better than 7:1, with the quiet zone the spec asks for
export function qr() {
  const cv = document.getElementById('qr-cv'); if (!cv) return;
  const { size, modules } = encodeQr(PAGE, { ecl: 'M' }), border = 4, n = size + border * 2;
  function paint() {
    const px = Math.max(160, Math.round(cv.getBoundingClientRect().width || 240)), dpr = Math.min(devicePixelRatio || 1, 2), m = px / n;
    cv.width = px * dpr; cv.height = px * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#fff'; c.fillRect(0, 0, px, px); c.fillStyle = '#1b2240';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) c.fillRect(Math.floor((x + border) * m), Math.floor((y + border) * m), Math.ceil(m), Math.ceil(m));
  }
  paint(); addEventListener('resize', paint);
  cv.addEventListener('click', (e) => { cv.classList.remove('boing'); void cv.offsetWidth; cv.classList.add('boing'); burst(e.clientX, e.clientY, 12); copyText(PAGE, t2('คัดลอกลิงก์แล้ว', 'Link copied')); });
}

// small things that answer a tap
export function taps() {
  document.querySelectorAll('img.wheel').forEach((w) => w.addEventListener('click', (e) => { e.preventDefault(); w.classList.remove('spin'); void w.offsetWidth; w.classList.add('spin'); burst(e.clientX, e.clientY, 10, true); }));
  const tk = document.getElementById('ticket'), tn = document.getElementById('tnum');
  if (tk && tn) tk.addEventListener('click', (e) => {
    tk.classList.remove('shake'); void tk.offsetWidth; tk.classList.add('shake');
    let k = 0; const it = setInterval(() => { tn.textContent = 1 + Math.floor(Math.random() * 300); if (++k > 9) { clearInterval(it); burst(e.clientX, e.clientY, 16); } }, calm ? 0 : 55);
  });
}

// prizes: a medal flips and its amount pours down as coins that pile at the bottom
export function prizes() {
  const sec = document.getElementById('prizes'), cv = document.getElementById('coin-cv'); if (!sec || !cv) return;
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), R = rng(5);
  let W = 0, H = 0, coins = [], run = false, sprite = null;
  function size() { const r = sec.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sprite = null; }
  function coin(r) {
    if (sprite && sprite.r === r) return sprite;
    const s = surface(r * 2 + 4, r * 2 + 4, dpr), c = s.ctx, x = r + 2;
    c.fillStyle = look.sun; c.beginPath(); c.arc(x, x, r, 0, 6.29); c.fill();
    c.globalCompositeOperation = 'multiply'; c.fillStyle = look.warm; c.globalAlpha = 0.35; c.beginPath(); c.arc(x + r * 0.3, x + r * 0.35, r * 0.85, 0, 6.29); c.fill();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.strokeStyle = look.key; c.lineWidth = Math.max(1.2, r / 7); c.beginPath(); c.arc(x, x, r - c.lineWidth / 2, 0, 6.29); c.stroke();
    c.fillStyle = look.key; c.font = `700 ${r * 1.15}px "Inter",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('฿', x, x + r * 0.06);
    return (sprite = { cv: s.cv, r, size: r * 2 + 4 });
  }
  function loop() {
    ctx.clearRect(0, 0, W, H); let moving = false;
    const r = Math.max(9, Math.min(16, W / 46)), sp = coin(r);
    for (const c of coins) {
      if (!c.rest) {
        c.vy += 0.5; c.x += c.vx; c.y += c.vy; c.a += c.va; moving = true;
        if (c.x < r || c.x > W - r) c.vx *= -0.6;
        const floor = H - r - c.stack;
        if (c.y >= floor) { c.y = floor; if (c.vy > 3) { c.vy *= -0.35; c.vx *= 0.7; } else { c.rest = true; } }
      }
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(Math.abs(Math.cos(c.a)) * 0.85 + 0.15, 1); ctx.drawImage(sp.cv, -sp.size / 2, -sp.size / 2, sp.size, sp.size); ctx.restore();
    }
    if (moving) requestAnimationFrame(loop); else run = false;
  }
  function rain(n, x0) {
    if (calm) return;
    if (!W) size();
    const r = Math.max(9, Math.min(16, W / 46));
    for (let i = 0; i < n; i++) {
      const x = x0 + (R() - 0.5) * W * 0.25, col = Math.round(x / (r * 1.6));
      const stack = coins.filter((c) => c.col === col).length * r * 0.42;
      coins.push({ x, y: -20 - R() * 260, vx: (R() - 0.5) * 2, vy: R() * 2, a: R() * 6, va: 0.12 + R() * 0.2, rest: false, col, stack: Math.min(stack, H * 0.4) });
    }
    if (coins.length > 260) coins.splice(0, coins.length - 260);
    if (!run) { run = true; requestAnimationFrame(loop); }
  }
  sec.querySelectorAll('.medal').forEach((m) => m.addEventListener('click', (e) => {
    m.classList.remove('flip'); void m.offsetWidth; m.classList.add('flip');
    const amt = +m.dataset.amt || 1000, r = sec.getBoundingClientRect();
    rain(Math.round(amt / 1000), e.clientX - r.left); burst(e.clientX, e.clientY, 18, true);
  }));
  addEventListener('resize', () => { size(); coins = []; });
  onLook(() => { sprite = null; });
}
