// The share card: node tools/card.mjs [--look picnic] -> card.jpg (1200 x 630)
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/annikapeacock/Developer/claude code projects/anidoodle-motdang/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2), look = (A[A.indexOf('--look') + 1] && A.includes('--look')) ? A[A.indexOf('--look') + 1] : 'picnic', out = A.includes('--out') ? A[A.indexOf('--out') + 1] : 'card.jpg';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SHELL = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', SHELL, 'chrome-headless-shell-mac-arm64/chrome-headless-shell') });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/dev/card.html?look=${look}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 20000 });
await page.screenshot({ path: path.resolve(root, out), type: 'jpeg', quality: 88 });
console.log(out, look, errs.length ? errs.join('; ') : 'no errors');
await browser.close(); server.close();
