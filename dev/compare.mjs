// Every look at phone size, side by side: node dev/compare.mjs [--w 390] [--out dev/out/compare.png]
// Takes the whole page in each look, cuts the same sections from each, and lays them in columns.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/annikapeacock/Developer/claude code projects/anidoodle-motdang/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i < 0 ? d : A[i + 1]; };
const W = +opt('--w', '390'), out = path.resolve(root, opt('--out', 'dev/out/compare.png')), looks = opt('--looks', 'flat').split(',');
const sel = opt('--sections', '.hero,.how,.play,.prizes,.balls,.give,.projects').split(',');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SHELL = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', SHELL, 'chrome-headless-shell-mac-arm64/chrome-headless-shell') });
const shots = [];
for (const lk of looks) {
  const page = await browser.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?look=${lk}`, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  // wake every canvas: scroll through once
  const total = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += 600) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(160); }
  await page.evaluate(() => scrollTo(0, 0)); await page.addStyleTag({ content: '.top,.dock{position:static!important;transform:none!important}.dock{display:none!important}' }); await page.waitForTimeout(600);
  const parts = [];
  for (const s of sel) { const el = await page.$(s); if (!el) continue; parts.push((await el.screenshot()).toString('base64')); }
  shots.push({ lk, parts, errs });
  await page.close();
}
const page = await browser.newPage({ viewport: { width: (W + 24) * looks.length + 24, height: 800 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;background:#888;font:600 15px system-ui"><div style="display:flex;gap:24px;padding:24px;align-items:flex-start">${shots.map((s) => `<div style="width:${W}px"><div style="color:#fff;padding:0 0 8px">${s.lk}${s.errs.length ? ' · ERR ' + s.errs.join('; ') : ''}</div>${s.parts.map((p) => `<img style="display:block;width:${W}px;margin-bottom:12px" src="data:image/png;base64,${p}">`).join('')}</div>`).join('')}</div></body>`);
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: true });
console.log(out, shots.map((s) => s.lk + (s.errs.length ? ' ERR' : ' ok')).join(' · '));
await browser.close(); server.close();
