// Every piece of visible text against the background behind it, light and dark:
// node tools/contrast.mjs [--w 390] [--scheme dark|light]   prints each pair under 4.5:1 (3:1 for large text)
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/annikapeacock/Developer/claude code projects/anidoodle-motdang/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i < 0 ? d : A[i + 1]; };
const W = +opt('--w', '390'), scheme = opt('--scheme', 'dark'), lang = opt('--lang', 'both');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => { let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SHELL = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', SHELL, 'chrome-headless-shell-mac-arm64/chrome-headless-shell') });
const page = await browser.newPage({ viewport: { width: W, height: 900 }, colorScheme: scheme });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(1500);
const total = await page.evaluate(() => document.body.scrollHeight); for (let y = 0; y < total; y += 500) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(120); } await page.waitForTimeout(1200);
const bad = await page.evaluate(() => {
  const rgb = (s) => { const m = s.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return null; const c = rgb(cs.backgroundColor); if ((c[3] ?? 1) > 0) { stack.push(c); if ((c[3] ?? 1) >= 1) break; } } let base = rgb(getComputedStyle(document.body).backgroundColor); for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base); return base; };
  const out = [], seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const el = n.parentElement, t = n.textContent.trim(); if (!t || !el) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('[hidden],dialog:not([open]),canvas,svg')) continue;
    if (getComputedStyle(el).display === 'none' || el.offsetParent === null && cs.position !== 'fixed') continue;
    const bg = bgOf(el); if (!bg) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; if (op < 0.05) continue;
    const fg = blend([...rgb(cs.color).slice(0, 3), (rgb(cs.color)[3] ?? 1) * op], bg);
    const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
    if (cr < (big ? 3 : 4.5)) { const k = el.className + '|' + t.slice(0, 30); if (seen.has(k)) continue; seen.add(k); out.push(`${cr.toFixed(2)}  <${el.tagName.toLowerCase()} class="${el.className}"> ${t.slice(0, 50)}  in ${el.closest('section,header,footer,nav')?.className || ''}`); }
  }
  return out;
});
console.log(`${scheme} ${W}px: ${bad.length} under the bar`); bad.slice(0, 80).forEach((b) => console.log('  ' + b));
await browser.close(); server.close();
