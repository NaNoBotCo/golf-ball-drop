// node tools/shot.mjs <path?query> --w 1300 --h 700 --out file.png [--full] [--dpr 1] [--wait 600]
// Serves the repo over localhost and screenshots a page in headless Chrome. Reports page errors.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/annikapeacock/Developer/claude code projects/anidoodle-motdang/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i < 0 ? d : A[i + 1]; };
const target = A[0] && !A[0].startsWith('--') ? A[0] : '', W = +opt('--w', '1300'), H = +opt('--h', '800'), out = opt('--out', 'dev/out/shot.png'), dpr = +opt('--dpr', '1'), wait = +opt('--wait', '700');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.ics': 'text/calendar' };
const server = http.createServer((req, res) => { let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SHELL = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', SHELL, 'chrome-headless-shell-mac-arm64/chrome-headless-shell') });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, isMobile: W < 700, hasTouch: W < 700 });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/${target}`, { waitUntil: 'load' });
await page.waitForTimeout(wait);
fs.mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
await page.screenshot({ path: path.resolve(root, out), fullPage: A.includes('--full') });
console.log(out, (Date.now() - t0) + 'ms', errs.length ? '\n' + errs.join('\n') : 'no errors');
await browser.close(); server.close();
