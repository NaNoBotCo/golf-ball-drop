// Raised so far: the live totals from the Golf Ball Drop bot's ledger (line.motdang.net/gbd/totals:
// numbers only, no names). Nan, 2026-10-24: the goal is all 300 balls at the ball price; ball
// payments and the treasurer's recorded gifts count; baht shown. Members record payments in the
// club's LINE group with @nanobotco, the treasurer records gifts with "@nanobotco gift 5000".
// Re-read every minute while the section is on screen.
import { look, onLook } from './riso.js';
import { burst, t2 } from './bits.js';

const FEED = 'https://line.motdang.net/gbd/totals';
const START = '2026-11-01', END = '2027-01-30';
const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');
const day = (d) => Date.parse(d + 'T12:00:00+07:00');
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], EN_M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (ms) => { const d = new Date(ms + 7 * 3600e3); return { th: `${d.getUTCDate()} ${TH_M[d.getUTCMonth()]}`, en: `${d.getUTCDate()} ${EN_M[d.getUTCMonth()]}` }; };
const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

export function tally() {
  const sec = document.getElementById('raised'); if (!sec) return;
  const $ = (id) => document.getElementById(id);
  let data = null, vis = false, timer = 0, lastRaised = null;

  async function load() {
    try {
      const r = await fetch(FEED, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
    } catch (e) { if (!data) { sec.classList.add('off'); $('r-note').innerHTML = '<span class="th">ยังอ่านยอดไม่ได้ในขณะนี้</span><span class="en">The totals cannot be read just now.</span>'; } return; }
    sec.classList.remove('off');
    render();
  }

  function render() {
    const d = data, paidB = d.ballBaht, giftB = d.giftBaht, goal = d.goal || 300000;
    $('r-raised').textContent = fmt(d.raised);
    $('r-pct').textContent = d.pct.toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%';
    $('r-goal').textContent = fmt(goal);
    $('r-balls').textContent = d.paid;
    $('r-ballb').textContent = fmt(paidB);
    $('r-gifts').textContent = d.gifts;
    $('r-giftb').textContent = fmt(giftB);
    // the bar: ball payments then gifts, a 2 px gap between, a rounded end
    const w1 = Math.min(100, (paidB / goal) * 100), w2 = Math.min(100 - w1, (giftB / goal) * 100);
    $('r-bar-paid').style.width = w1 + '%'; $('r-bar-gift').style.width = w2 + '%';
    $('r-bar-gift').style.display = w2 > 0 ? '' : 'none';
    $('r-bar').setAttribute('aria-valuenow', String(Math.round(d.pct))); $('r-bar').setAttribute('aria-valuetext', `${fmt(d.raised)} of ${fmt(goal)}`);
    grid(d); line(d); table(d);
    const pill = $('raised-pill');
    if (pill) { pill.hidden = false; pill.innerHTML = `<b>${fmt(d.raised)}</b> <span class="th">ระดมได้แล้ว ${d.pct}%</span><span class="en">raised · ${d.pct}%</span>`; }
    $('r-note').innerHTML = d.updated
      ? `<span class="th">บันทึกล่าสุด ${dmy(d.updated).th}</span><span class="en">Last entry ${dmy(d.updated).en}</span>`
      : '<span class="th">ยังไม่มียอด ลูกกอล์ฟเริ่มแจกสมาชิก 1 พ.ย.</span><span class="en">Nothing recorded yet: balls go out to members on 1 Nov.</span>';
    if (lastRaised !== null && d.raised > lastRaised) { const r = $('r-raised').getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 24, true); }
    lastRaised = d.raised;
  }

  // 300 balls, one dot each: paid balls, then gifts counted in balls at the ball price, then empty
  function grid(d) {
    const g = $('r-grid'), n = d.balls || 300, giftBalls = Math.floor(d.giftBaht / (d.price || 1000));
    if (g.childElementCount !== n) { g.textContent = ''; for (let i = 0; i < n; i++) { const b = document.createElement('i'); g.appendChild(b); } }
    [...g.children].forEach((b, i) => { b.className = i < d.paid ? 'p' : i < d.paid + giftBalls ? 'g' : ''; });
    g.setAttribute('aria-label', t2(`ลูกที่จ่ายแล้ว ${d.paid} จาก ${n} และเงินบริจาคเท่ากับอีก ${giftBalls} ลูก`, `${d.paid} of ${n} balls paid, and gifts worth ${giftBalls} more`));
  }

  // the running total by day, 1 Nov to the drop, with the goal as a line
  function line(d) {
    const svg = $('r-line'), box = svg.getBoundingClientRect(), W = Math.max(280, box.width || 600), H = W < 500 ? 190 : 230;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.textContent = '';
    const m = { l: 52, r: 16, t: 16, b: 28 }, x0 = day(START), x1 = day(END), goal = d.goal || 300000;
    const ymax = Math.max(goal, d.raised) * 1.08;
    const X = (ms) => m.l + ((ms - x0) / (x1 - x0)) * (W - m.l - m.r), Y = (v) => H - m.b - (v / ymax) * (H - m.t - m.b);
    const ink = getComputedStyle(document.documentElement), text = ink.getPropertyValue('--text').trim() || '#1f2a4f';
    // grid: three hairlines and their ticks
    for (const v of [0, goal / 2, goal]) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: text, 'stroke-opacity': v === goal ? 0.55 : 0.14, 'stroke-width': 1 }, svg);
      const t = el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, svg); t.textContent = v >= 1000 ? Math.round(v / 1000) + 'K' : '0';
    }
    const L = root().contains('lang-th') ? 'th' : root().contains('lang-en') ? 'en' : 'both';
    const gl = el('text', { x: W - m.r, y: Y(goal) - 6, 'text-anchor': 'end', class: 'lab' }, svg); gl.textContent = { th: 'เป้า ' + fmt(goal), en: 'Goal ' + fmt(goal), both: 'เป้า · Goal ' + fmt(goal) }[L];
    for (const [dd, th, en] of [['2026-11-01', '1 พ.ย.', '1 Nov'], ['2026-12-01', '1 ธ.ค.', '1 Dec'], ['2027-01-01', '1 ม.ค.', '1 Jan'], ['2027-01-30', '30 ม.ค.', '30 Jan']]) {
      const t = el('text', { x: X(day(dd)), y: H - 8, 'text-anchor': dd === END ? 'end' : dd === START ? 'start' : 'middle', class: 'tick' }, svg); t.textContent = L === 'th' ? th : en;
    }
    const pts = (d.series || []).map((p) => [day(p.d), p.raised]).filter(([ms]) => ms >= x0 - 864e5 * 40);
    if (!pts.length) { const t = el('text', { x: (m.l + W - m.r) / 2, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'lab' }, svg); t.textContent = t2('ยังไม่มีข้อมูล', 'Nothing recorded yet'); return; }
    // step up on each day's money, hold until the next; carry the last value to today
    const now = Math.min(x1, Date.now()), path = [[X(Math.max(x0, pts[0][0])), Y(0)]];
    pts.forEach(([ms, v], i) => { const x = X(Math.max(x0, ms)); path.push([x, Y(i ? pts[i - 1][1] : 0)], [x, Y(v)]); });
    path.push([X(Math.max(now, pts[pts.length - 1][0])), Y(pts[pts.length - 1][1])]);
    const dstr = path.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join('');
    const paid = look.chart.paid;
    el('path', { d: dstr + `L${path[path.length - 1][0].toFixed(1)} ${Y(0)}Z`, fill: paid, 'fill-opacity': 0.1, stroke: 'none' }, svg);
    el('path', { d: dstr, fill: 'none', stroke: paid, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const [ex, ey] = path[path.length - 1];
    el('circle', { cx: ex, cy: ey, r: 5, fill: paid, stroke: 'var(--card)', 'stroke-width': 2 }, svg);
    const vl = el('text', { x: Math.min(ex, W - m.r - 4), y: ey - 10, 'text-anchor': ex > W * 0.7 ? 'end' : 'start', class: 'val' }, svg); vl.textContent = fmt(pts[pts.length - 1][1]);
    // crosshair and readout
    const cross = el('line', { y1: m.t, y2: H - m.b, stroke: text, 'stroke-opacity': 0.4, 'stroke-width': 1, visibility: 'hidden' }, svg);
    const dot = el('circle', { r: 5, fill: paid, stroke: 'var(--card)', 'stroke-width': 2, visibility: 'hidden' }, svg);
    const tip = $('r-tip');
    const at = (cx) => { const ms = x0 + ((cx - m.l) / (W - m.l - m.r)) * (x1 - x0); let v = 0; for (const [t, val] of pts) if (t <= ms + 432e5) v = val; return [ms, v]; };
    const show = (e) => {
      const r = svg.getBoundingClientRect(), cx = ((e.clientX - r.left) / r.width) * W; if (cx < m.l || cx > W - m.r) return hide();
      const [ms, v] = at(cx), x = X(ms), y = Y(v);
      if (ms > Math.max(now, pts[pts.length - 1][0]) + 432e5 || ms < pts[0][0] - 432e5) return hide();
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('visibility', 'visible');
      const dd = dmy(ms); tip.hidden = false; tip.innerHTML = `<b>${fmt(v)}</b><span class="th">${dd.th}</span><span class="en">${dd.en}</span>`;
      const left = (x / W) * r.width; tip.style.left = Math.max(8, Math.min(r.width - tip.offsetWidth - 8, left - tip.offsetWidth / 2)) + 'px'; tip.style.top = Math.max(0, (y / H) * r.height - 54) + 'px';
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.onpointermove = show; svg.onpointerdown = show; svg.onpointerleave = hide;
  }
  const root = () => document.documentElement.classList;

  function table(d) {
    const tb = $('r-table').querySelector('tbody'); tb.textContent = '';
    if (!d.series.length) { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 2; td.innerHTML = '<span class="th">ยังไม่มีข้อมูล</span><span class="en">Nothing recorded yet</span>'; return; }
    for (const p of d.series) { const tr = tb.insertRow(), dd = dmy(day(p.d)); tr.insertCell().innerHTML = `<span class="th">${dd.th}</span><span class="en">${dd.en}</span>`; tr.insertCell().textContent = fmt(p.raised); }
  }

  $('r-grid').addEventListener('click', (e) => { const b = e.target.closest('i'); if (!b) return; b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop'); burst(e.clientX, e.clientY, 8); });
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { vis = e[0].isIntersecting; clearInterval(timer); if (vis) { load(); timer = setInterval(load, 60000); } }).observe(sec);
  onLook(() => data && render());
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => data && line(data), 200); });
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => data && line(data)));
  load();
}
