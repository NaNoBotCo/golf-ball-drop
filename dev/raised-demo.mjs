// Screenshots the raised-so-far section with sample totals served in place of the live feed.
// node dev/raised-demo.mjs [--w 390] [--look picnic]  -> dev/out/raised-demo-<w>.png
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/annikapeacock/Developer/claude code projects/anidoodle-motdang/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2), W = A.includes('--w') ? +A[A.indexOf('--w') + 1] : 390, look = A.includes('--look') ? A[A.indexOf('--look') + 1] : 'picnic';
const series = [['2026-11-02', 8000], ['2026-11-05', 15000], ['2026-11-12', 26000], ['2026-11-20', 31000], ['2026-11-28', 44500], ['2026-12-05', 52000], ['2026-12-14', 64000], ['2026-12-20', 71500]].map(([d, raised]) => ({ d, raised }));
const demo = { balls: 300, price: 1000, goal: 300000, issued: 180, sold: 92, paid: 64, ballBaht: 64000, gifts: 3, giftBaht: 7500, raised: 71500, pct: 23.8, series, updated: Date.parse('2026-12-20T16:00:00+07:00') };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => { let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SHELL = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', SHELL, 'chrome-headless-shell-mac-arm64/chrome-headless-shell') });
const page = await browser.newPage({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2, isMobile: W < 700, hasTouch: W < 700 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.route('https://line.motdang.net/gbd/totals', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(demo) }));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?look=${look}#raised`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.addStyleTag({ content: '.dock{display:none!important}' });
const svg = await page.$('#r-line'); const b = await svg.boundingBox(); await page.mouse.move(b.x + b.width * 0.62, b.y + b.height * 0.5); await page.waitForTimeout(300);
await (await page.$('.r-card')).screenshot({ path: path.join(root, `dev/out/raised-demo-${W}-${look}.png`) });
console.log('pill:', await page.$eval('#raised-pill', (p) => p.innerText.replace(/\s+/g, ' ')), errs.length ? errs.join('; ') : 'no errors');
await browser.close(); server.close();
